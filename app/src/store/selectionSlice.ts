export interface SelectionSliceState {
  activeNodeId: string | null;
  selectedNodeIds: string[];
}

export interface SelectionSliceActions {
  setActiveNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  selectAllNodes: (allNodeIds: string[]) => void;
  clearSelection: () => void;
}

export type SelectionSlice = SelectionSliceState & SelectionSliceActions;

export function createSelectionSlice(
  set: (fn: (prev: SelectionSlice) => Partial<SelectionSlice>) => void
): SelectionSlice {
  return {
    activeNodeId: 'output_ormh',
    selectedNodeIds: [],

    setActiveNodeId: (id) => {
      set(() => ({ activeNodeId: id }));
    },

    setSelectedNodeIds: (ids) => {
      set(() => ({ selectedNodeIds: ids }));
    },

    selectAllNodes: (allNodeIds) => {
      set(() => ({ selectedNodeIds: allNodeIds }));
    },

    clearSelection: () => {
      set(() => ({ activeNodeId: null, selectedNodeIds: [] }));
    },
  };
}
