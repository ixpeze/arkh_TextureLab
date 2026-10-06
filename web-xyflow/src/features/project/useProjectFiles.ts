import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getPlatform } from '../../platform/PlatformService';
import { serializeProject, deserializeProject } from '../../graph/serialize';
import { createDefaultDocument } from '../../store/documentSlice';
import { auditProjectAssets } from '../../engine/assetRelink';
import { shouldPerformAutosave, checkRecoveryEligibility } from './autosave';
import { migrateSettingsFromLocalStorage } from '../../platform/settingsMigration';

export function useProjectFiles() {
  const doc = useAppStore((state) => state.doc);
  const isDirty = useAppStore((state) => state.isDirty);
  const projectName = useAppStore((state) => state.projectName);
  const readOnly = useAppStore((state) => state.readOnly);
  const setDocument = useAppStore((state) => state.setDocument);
  const markSaved = useAppStore((state) => state.markSaved);
  const setProjectPath = useAppStore((state) => state.setProjectPath);
  const setProjectName = useAppStore((state) => state.setProjectName);
  const setReadOnly = useAppStore((state) => state.setReadOnly);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);
  const setIsRelinkModalOpen = useAppStore((state) => state.setIsRelinkModalOpen);

  const platform = getPlatform();
  const lastEditTimeRef = useRef<number>(0);
  const lastAutosaveTimeRef = useRef<number>(0);

  // Track edit timestamps for idle detection
  useEffect(() => {
    lastEditTimeRef.current = Date.now();
  }, [doc]);

  // Sync window title and dirty state
  useEffect(() => {
    const title = `${projectName}${isDirty ? '*' : ''} - TextureLab`;
    platform.setDirtyState(isDirty, projectName);
    platform.setTitle(title);
  }, [isDirty, projectName, platform]);

  // Initial settings migration (TC-360) and autosave recovery check
  useEffect(() => {
    void migrateSettingsFromLocalStorage(
      (k) => platform.getUserData(k),
      (k, v) => platform.setUserData(k, v)
    );

    // Startup check for autosaves (TC-340..343)
    void (async () => {
      try {
        const autosaves = await platform.getAutosaves();
        if (autosaves.length > 0) {
          const newest = autosaves.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
          const eligibility = checkRecoveryEligibility(newest.mtimeMs, undefined);
          if (eligibility.eligible) {
            const raw = await platform.readAutosave(newest.filePath);
            const res = deserializeProject(raw);
            if (res.ok) {
              const recover = window.confirm(
                `TextureLab detected an unsaved autosave from a previous session (${res.doc.meta.name}).\nWould you like to recover it?`
              );
              if (recover) {
                setDocument(res.doc, false);
                setProjectName(res.doc.meta.name);
                setStatusMessage('Recovered previous autosaved project');
              } else {
                await platform.deleteAutosave(newest.projectId);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Autosave recovery check failed:', err);
      }
    })();
  }, [platform, setDocument, setProjectName, setStatusMessage]);

  // Save implementation
  const handleSave = useCallback(
    async function performSave(asNewPath?: string): Promise<boolean> {
      const currentState = useAppStore.getState();
      const targetPath = asNewPath || currentState.projectPath;
      if (!targetPath) {
        // Show Save As dialog
        const chosenPath = await platform.showSaveDialog({
          title: 'Save TextureLab Project',
          defaultPath: `${currentState.projectName}.tlab`,
          filters: [
            { name: 'TextureLab Project (*.tlab)', extensions: ['tlab'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
        });
        if (!chosenPath) return false;
        return await performSave(chosenPath);
      }

      if (readOnly && !asNewPath) {
        setStatusMessage('Project was opened in read-only mode. Use Save As to save.');
        return false;
      }

      try {
        setStatusMessage(`Saving ${targetPath}...`);
        const jsonStr = serializeProject(currentState.doc);
        await platform.writeAtomicFile(targetPath, jsonStr);

        markSaved(targetPath);
        setProjectPath(targetPath);
        setReadOnly(false);

        // Derive name from filename
        const parts = targetPath.replace(/\\/g, '/').split('/');
        const fileBase = parts[parts.length - 1]?.replace(/\.tlab$/i, '') || 'Project';
        setProjectName(fileBase);

        // Update recent projects
        await platform.addRecentProject(targetPath);

        // Clean up autosave for this project on clean save (P3-T8)
        await platform.deleteAutosave(currentState.doc.meta.id);

        setStatusMessage(`Saved project successfully to ${fileBase}.tlab`);
        return true;
      } catch (err) {
        console.error('Save failed:', err);
        setStatusMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [platform, readOnly, markSaved, setProjectPath, setProjectName, setReadOnly, setStatusMessage]
  );

  const handleSaveAs = useCallback(async () => {
    return await handleSave(undefined);
  }, [handleSave]);

  // Guard against losing unsaved changes
  const confirmCloseOrDiscard = useCallback(async (): Promise<boolean> => {
    const currentState = useAppStore.getState();
    if (!currentState.isDirty) return true;
    const choice = await platform.showCloseGuardDialog(currentState.projectName);
    if (choice === 'save') {
      return await handleSave();
    }
    if (choice === 'dont-save') {
      return true;
    }
    return false; // cancel
  }, [platform, handleSave]);

  // New Project
  const handleNewProject = useCallback(async () => {
    const allowed = await confirmCloseOrDiscard();
    if (!allowed) return;

    const defaultDoc = createDefaultDocument();
    setDocument(defaultDoc, false);
    setProjectPath(null);
    setProjectName('Untitled_Project');
    setReadOnly(false);
    setStatusMessage('Created new project');
  }, [confirmCloseOrDiscard, setDocument, setProjectPath, setProjectName, setReadOnly, setStatusMessage]);

  // Open Project File
  const handleOpenPath = useCallback(
    async (filePath: string): Promise<boolean> => {
      try {
        setStatusMessage(`Loading ${filePath}...`);
        const bytes = await platform.readFile(filePath);
        const decoder = new TextDecoder('utf-8');
        const jsonStr = decoder.decode(bytes);

        const res = deserializeProject(jsonStr);
        if (!res.ok) {
          setStatusMessage(`Failed to open project: ${res.error}`);
          return false;
        }

        const projectDir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
        const parts = filePath.replace(/\\/g, '/').split('/');
        const fileBase = parts[parts.length - 1]?.replace(/\.tlab$/i, '') || 'Project';

        setDocument(res.doc, false);
        setProjectPath(filePath);
        setProjectName(fileBase);
        setReadOnly(res.isNewerVersion);
        markSaved(filePath);

        await platform.addRecentProject(filePath);

        // Check for missing assets (P3-T9: TC-345..348)
        if (res.doc.assets.length > 0) {
          const audit = auditProjectAssets(res.doc.assets, projectDir, () => true);
          if (!audit.allResolved) {
            setIsRelinkModalOpen(true, audit.missing);
          }
        }

        if (res.warnings.length > 0) {
          setStatusMessage(`Opened with warnings: ${res.warnings[0]}`);
        } else {
          setStatusMessage(`Opened project: ${fileBase}.tlab`);
        }
        return true;
      } catch (err) {
        console.error('Open project failed:', err);
        // TC-335: If file does not exist, remove from recent
        await platform.removeRecentProject(filePath);
        setStatusMessage(`Could not open file: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [platform, setDocument, setProjectPath, setProjectName, setReadOnly, markSaved, setIsRelinkModalOpen, setStatusMessage]
  );

  const handleOpenDialog = useCallback(async () => {
    const allowed = await confirmCloseOrDiscard();
    if (!allowed) return;

    const files = await platform.showOpenDialog({
      title: 'Open TextureLab Project',
      filters: [
        { name: 'TextureLab Project (*.tlab)', extensions: ['tlab'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (files && files.length > 0) {
      await handleOpenPath(files[0]);
    }
  }, [confirmCloseOrDiscard, platform, handleOpenPath]);

  // Periodic autosave loop (P3-T8: TC-340..343)
  useEffect(() => {
    const timer = setInterval(async () => {
      const currentState = useAppStore.getState();
      const shouldSave = shouldPerformAutosave({
        isDirty: currentState.isDirty,
        lastEditTimeMs: lastEditTimeRef.current,
        lastAutosaveTimeMs: lastAutosaveTimeRef.current,
      });

      if (shouldSave) {
        try {
          const jsonStr = serializeProject(currentState.doc);
          await platform.saveAutosave(currentState.doc.meta.id, jsonStr);
          lastAutosaveTimeRef.current = Date.now();
        } catch (err) {
          console.warn('Autosave tick failed:', err);
        }
      }
    }, 5000); // Check every 5s

    return () => clearInterval(timer);
  }, [platform]);

  // Handle second-instance or file association launch from Explorer (TC-334)
  useEffect(() => {
    return platform.onOpenFile((openedPath) => {
      void handleOpenPath(openedPath);
    });
  }, [platform, handleOpenPath]);

  return {
    handleSave,
    handleSaveAs,
    handleNewProject,
    handleOpenDialog,
    handleOpenPath,
  };
}
