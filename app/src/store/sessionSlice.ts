export interface SessionSliceState {
  projectPath: string | null;
  projectName: string;
  isDirty: boolean;
  readOnly: boolean;
  lastSavedRevision: number;
}

export interface SessionSliceActions {
  setProjectPath: (path: string | null) => void;
  setProjectName: (name: string) => void;
  setReadOnly: (readOnly: boolean) => void;
  setIsDirty: (isDirty: boolean) => void;
  markSaved: (path?: string) => void;
}

export type SessionSlice = SessionSliceState & SessionSliceActions;

export function createSessionSlice(
  set: (fn: (prev: SessionSlice) => Partial<SessionSlice>) => void
): SessionSlice {
  return {
    projectPath: null,
    projectName: 'Anthracite_Concrete',
    isDirty: false,
    readOnly: false,
    lastSavedRevision: 0,

    setProjectPath: (path) => set(() => ({ projectPath: path })),
    setProjectName: (name) => set(() => ({ projectName: name })),
    setReadOnly: (readOnly) => set(() => ({ readOnly })),
    setIsDirty: (isDirty) => set(() => ({ isDirty })),
    markSaved: (savedPath) =>
      set((prev) => ({
        isDirty: false,
        projectPath: savedPath !== undefined ? savedPath : prev.projectPath,
      })),
  };
}
