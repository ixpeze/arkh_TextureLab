import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Toolbar } from './app/Toolbar';
import { Canvas } from './app/Canvas';
import { StatusBar } from './app/StatusBar';
import { LibraryPanel } from './features/library/LibraryPanel';
import { InspectorPanel } from './features/inspector/InspectorPanel';
import { EmptyStateCard } from './features/project/EmptyStateCard';
import { WorkbenchModals } from './app/WorkbenchModals';

import { useGraphActions } from './app/useGraphActions';
import { useTextureDrop } from './app/useTextureDrop';
import { createSpawnedNode } from './app/spawn';
import { useAppShortcutsAndMenus } from './app/useAppShortcutsAndMenus';
import { useDockResizing } from './features/layout/useDockResizing';
import { useProjectFiles } from './features/project/useProjectFiles';
import { useClipboardOperations } from './features/project/useClipboardOperations';
import { useWorkbenchActions } from './app/useWorkbenchActions';
import { useAppStore } from './store/useAppStore';
import type { TextureBuffer } from './types/buffer';

function Workbench() {
  const doc = useAppStore((s) => s.doc);
  const nodes = doc.graph.nodes;
  const edges = doc.graph.edges;
  const onNodesChange = useAppStore((s) => s.onNodesChange);
  const onEdgesChange = useAppStore((s) => s.onEdgesChange);
  const onNodeDragStart = useAppStore((s) => s.onNodeDragStart);
  const onNodeDragStop = useAppStore((s) => s.onNodeDragStop);
  const setNodes = useAppStore((s) => s.setNodes);
  const setEdges = useAppStore((s) => s.setEdges);
  const addNode = useAppStore((s) => s.addNode);
  const updateNodeData = useAppStore((s) => s.updateNodeData);
  const updateExportSettings = useAppStore((s) => s.updateExportSettings);

  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const setActiveNodeId = useAppStore((s) => s.setActiveNodeId);
  const palettePos = useAppStore((s) => s.palettePos);
  const setPalettePos = useAppStore((s) => s.setPalettePos);
  const isShortcutsOpen = useAppStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = useAppStore((s) => s.setIsShortcutsOpen);
  const isExportModalOpen = useAppStore((s) => s.isExportModalOpen);
  const setIsExportModalOpen = useAppStore((s) => s.setIsExportModalOpen);
  const isRelinkModalOpen = useAppStore((s) => s.isRelinkModalOpen);
  const setIsRelinkModalOpen = useAppStore((s) => s.setIsRelinkModalOpen);
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setIsSettingsOpen);
  const isPackWizardOpen = useAppStore((s) => s.isPackWizardOpen);
  const setIsPackWizardOpen = useAppStore((s) => s.setIsPackWizardOpen);
  const missingAssets = useAppStore((s) => s.missingAssets);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const projectName = useAppStore((s) => s.projectName);
  const isDirty = useAppStore((s) => s.isDirty);

  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo());
  const canRedo = useAppStore((s) => s.canRedo());
  const toggleLibrary = useAppStore((s) => s.toggleLibrary);
  const toggleInspector = useAppStore((s) => s.toggleInspector);

  const {
    libraryWidth,
    inspectorWidth,
    isLibraryOpen,
    isInspectorOpen,
    handleMouseDownLeft,
    handleMouseDownRight,
  } = useDockResizing();

  const canvasMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const [sourceBuffers, setSourceBuffers] = useState<Record<string, TextureBuffer>>({});
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow();

  const { handleSave, handleSaveAs, handleNewProject, handleOpenDialog } = useProjectFiles();

  const {
    handleDuplicate: origDuplicate,
    handleDelete,
    handleClearGraph,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
    onEdgeClick,
  } = useGraphActions({
    nodes,
    edges,
    setNodes,
    setEdges,
    pushSnapshot: () => {},
    setStatusMessage,
    activeNodeId,
    setActiveNodeId,
  });

  const setSourceBuffer = useCallback((id: string, buf: TextureBuffer) => {
    setSourceBuffers((prev) => ({ ...prev, [id]: buf }));
  }, []);

  const [evaluatedBuffers] = useState<Record<string, TextureBuffer>>({});

  const nodeBufferContextValue = useMemo(
    () => ({
      evaluatedBuffers,
      sourceBuffers,
      setSourceBuffer,
      onUpdateNodeData: updateNodeData,
    }),
    [evaluatedBuffers, sourceBuffers, setSourceBuffer, updateNodeData]
  );

  useEffect(() => {
    if (activeNodeId && !nodes.some((n) => n.id === activeNodeId)) {
      setActiveNodeId(null);
    }
  }, [nodes, activeNodeId, setActiveNodeId]);

  const selectedNode = useMemo(() => {
    if (!activeNodeId) return null;
    return nodes.find((n) => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  const activeBuffer = useMemo<TextureBuffer | null>(() => {
    if (!selectedNode) return null;
    return evaluatedBuffers[selectedNode.id] || sourceBuffers[selectedNode.id] || null;
  }, [selectedNode, evaluatedBuffers, sourceBuffers]);

  const {
    spawnCommentBox,
    toggleBypassSelected,
    autoWireORMH,
    loadBenchmarkTextures,
    loadBatchPipelineExample,
    loadTemplate,
    selectAll,
    handleAssetChange,
    handleExport,
  } = useWorkbenchActions({
    nodes,
    edges,
    setNodes,
    setEdges,
    activeNodeId,
    setActiveNodeId,
    updateNodeData,
    updateExportSettings,
    setStatusMessage,
    activeBuffer,
    setSourceBuffers,
    canvasMousePosRef,
    screenToFlowPosition,
    addNode,
  });

  const spawnNode = useCallback(
    (typeKey: string, customPos?: { x: number; y: number }) => {
      let pos: { x: number; y: number };
      if (customPos) {
        pos = customPos;
      } else if (canvasMousePosRef.current) {
        const flowPos = screenToFlowPosition(canvasMousePosRef.current);
        pos = { x: flowPos.x - 86, y: flowPos.y - 12 };
      } else {
        const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        pos = { x: center.x - 86, y: center.y - 12 };
      }

      const newNode = createSpawnedNode({
        typeKey,
        position: pos,
        primaryAsset: doc.export.settings.primaryAsset,
      });

      addNode(newNode);
      setActiveNodeId(newNode.id);
      setStatusMessage(`Spawned ${newNode.type} node`);
    },
    [doc.export.settings.primaryAsset, addNode, screenToFlowPosition, setActiveNodeId, setStatusMessage]
  );

  const { handleCopy, handlePaste, handleCut, handleDuplicateWithWires } = useClipboardOperations({
    nodes,
    edges,
    assets: doc.assets,
    activeNodeId,
    setNodes,
    setEdges,
    handleDelete,
    origDuplicate,
    screenToFlowPosition,
    canvasMousePosRef,
    setStatusMessage,
  });

  useAppShortcutsAndMenus({
    handleUndo: undo,
    handleRedo: redo,
    fitView: () => fitView({ duration: 300 }),
    autoWireORMH,
    spawnCommentBox,
    toggleBypassSelected,
    handleDuplicate: handleDuplicateWithWires,
    handleDelete,
    selectAll,
    spawnNode,
    togglePalette: () => {
      const pos = canvasMousePosRef.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      setPalettePos(palettePos ? null : pos);
    },
    toggleShortcuts: () => setIsShortcutsOpen(!isShortcutsOpen),
    toggleExportModal: () => setIsExportModalOpen(!isExportModalOpen),
    isModalOpen: isShortcutsOpen || isExportModalOpen || isRelinkModalOpen || isSettingsOpen || isPackWizardOpen,
    handleSave,
    handleSaveAs,
    handleOpenDialog,
    handleNewProject,
    handleCopy,
    handlePaste,
    handleCut,
    handleClearGraph,
    setStatusMessage,
    toggleLibrary,
    toggleInspector,
    togglePackWizard: () => setIsPackWizardOpen(!isPackWizardOpen),
    toggleSettings: () => setIsSettingsOpen(!isSettingsOpen),
  });

  const { handleDragOver, handleDrop } = useTextureDrop({
    screenToFlowPosition,
    spawnNode,
    setNodes,
    setSourceBuffers,
    setActiveNodeId,
    setStatusMessage,
  });

  const currentZoom = getViewport().zoom || 1;

  return (
    <div className="tl-workstation">
      <Toolbar
        projectName={projectName}
        isDirty={isDirty}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenDialog}
        onSaveProject={handleSave}
        onLoadBatchPipeline={loadBatchPipelineExample}
        onLoadBenchmark={loadBenchmarkTextures}
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onOpenPackWizard={() => setIsPackWizardOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onSpawnCommentBox={spawnCommentBox}
        onFitView={() => fitView({ duration: 300 })}
        onClearGraph={handleClearGraph}
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={toggleLibrary}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={toggleInspector}
      />

      <div className="tl-workstation__body">
        {isLibraryOpen && (
          <aside className="tl-workstation__pane-left" style={{ width: libraryWidth }}>
            <LibraryPanel onSpawnNode={(k) => spawnNode(k)} />
          </aside>
        )}

        {isLibraryOpen && (
          <div className="tl-workstation__resizer" onMouseDown={handleMouseDownLeft} />
        )}

        <div className="tl-workstation__canvas-wrap">
          <Canvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onReconnectStart={onReconnectStart}
            onReconnect={onReconnect}
            onReconnectEnd={onReconnectEnd}
            onEdgeClick={onEdgeClick}
            onNodeClick={(_e, node) => setActiveNodeId(node.id)}
            onPaneClick={() => {
              setActiveNodeId(null);
              setPalettePos(null);
            }}
            onPaneContextMenu={(e) => {
              e.preventDefault?.();
              const clientX = 'clientX' in e && typeof e.clientX === 'number' ? e.clientX : window.innerWidth / 2;
              const clientY = 'clientY' in e && typeof e.clientY === 'number' ? e.clientY : window.innerHeight / 2;
              setPalettePos({ x: clientX, y: clientY });
            }}
            canvasMousePosRef={canvasMousePosRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            palettePos={palettePos}
            setPalettePos={setPalettePos}
            spawnNode={spawnNode}
            nodeBufferContextValue={nodeBufferContextValue}
          />

          {nodes.length === 0 && (
            <EmptyStateCard
              onOpenWizard={() => setIsPackWizardOpen(true)}
              onOpenUnpackWizard={() => setIsPackWizardOpen(true)}
              onLoadSample={loadBenchmarkTextures}
              onLoadTemplate={loadTemplate}
            />
          )}
        </div>

        {isInspectorOpen && (
          <div className="tl-workstation__resizer" onMouseDown={handleMouseDownRight} />
        )}

        {isInspectorOpen && (
          <aside className="tl-workstation__pane-right" style={{ width: inspectorWidth }}>
            <InspectorPanel
              selectedNode={selectedNode}
              nodes={nodes}
              primaryAsset={doc.export.settings.primaryAsset}
              onAssetChange={handleAssetChange}
              activeBuffer={activeBuffer}
              edges={edges}
              onUpdateNodeData={updateNodeData}
              onExportTarget={handleExport}
            />
          </aside>
        )}
      </div>

      <StatusBar
        statusMessage={statusMessage}
        zoom={currentZoom}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        onFitView={() => fitView({ duration: 300 })}
      />

      <WorkbenchModals
        isPackWizardOpen={isPackWizardOpen}
        setIsPackWizardOpen={setIsPackWizardOpen}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isShortcutsOpen={isShortcutsOpen}
        setIsShortcutsOpen={setIsShortcutsOpen}
        isExportModalOpen={isExportModalOpen}
        setIsExportModalOpen={setIsExportModalOpen}
        isRelinkModalOpen={isRelinkModalOpen}
        setIsRelinkModalOpen={setIsRelinkModalOpen}
        nodes={nodes}
        edges={edges}
        evaluatedBuffers={evaluatedBuffers}
        primaryAsset={doc.export.settings.primaryAsset}
        onAssetChange={handleAssetChange}
        onUpdateNodeData={updateNodeData}
        setStatusMessage={setStatusMessage}
        missingAssets={missingAssets}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workbench />
    </ReactFlowProvider>
  );
}
