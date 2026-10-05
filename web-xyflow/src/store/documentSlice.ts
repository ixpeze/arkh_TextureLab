import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge as xyflowAddEdge } from '@xyflow/react';
import { produceWithPatches } from 'immer';
import type {
  TlabDocument,
  AssetRecord,
  ProjectExportSettings,
  ProjectView,
} from '../types/project';
import { initialNodes, initialEdges } from '../app/initialGraph';
import { sanitizeNodeData } from '../graph/migrate';
import type { HistoryManager } from './history';

export function createDefaultDocument(): TlabDocument {
  const cleanInitialNodes = initialNodes.map((n) => ({
    ...n,
    data: sanitizeNodeData((n.data as Record<string, unknown>) || {}),
  }));

  const now = new Date().toISOString();
  return {
    format: 'arkh-texturelab',
    schemaVersion: 1,
    appVersion: '0.2.0',
    meta: {
      id: `proj_${Date.now()}`,
      name: 'Anthracite_Concrete',
      createdAt: now,
      modifiedAt: now,
    },
    assets: [],
    graph: {
      nodes: cleanInitialNodes,
      edges: [...initialEdges],
    },
    export: {
      settings: {
        primaryAsset: 'Anthracite_Concrete',
        exportPattern: 'T_{asset}_{slot}.{format}',
        exportDirRel: '',
      },
      presets: [],
    },
    view: {
      zoom: 1,
      pan: [0, 0],
    },
  };
}

export interface DocumentSliceState {
  doc: TlabDocument;
  nodeDragStartPositions: Record<string, { x: number; y: number }>;
}

export interface DocumentSliceActions {
  setDocument: (newDoc: TlabDocument, pushHistory?: boolean) => void;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>, description?: string) => void;
  addNode: (node: Node) => void;
  removeNodes: (nodeIds: string[]) => void;
  setNodes: (nodesOrUpdater: Node[] | ((prev: Node[]) => Node[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onNodeDragStart: (_event: unknown, node: Node, nodes: Node[]) => void;
  onNodeDragStop: (_event: unknown, node: Node, nodes: Node[]) => void;
  addEdge: (edge: Edge | Connection) => void;
  removeEdges: (edgeIds: string[]) => void;
  setEdges: (edgesOrUpdater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  registerAssetRecord: (asset: AssetRecord) => void;
  updateExportSettings: (patch: Partial<ProjectExportSettings>) => void;
  updateView: (view: Partial<ProjectView>) => void;
}

export type DocumentSlice = DocumentSliceState & DocumentSliceActions;

export function createDocumentSlice(
  set: (fn: (prev: DocumentSlice) => Partial<DocumentSlice>) => void,
  get: () => DocumentSlice,
  history: HistoryManager
): DocumentSlice {
  return {
    doc: createDefaultDocument(),
    nodeDragStartPositions: {},

    setDocument: (newDoc: TlabDocument, pushHistory = false) => {
      if (pushHistory) {
        const currentDoc = get().doc;
        const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, () => newDoc);
        history.push(patches, inversePatches, 'Load Project');
        set(() => ({ doc: nextDoc }));
      } else {
        history.clear();
        set(() => ({ doc: newDoc }));
      }
    },

    updateNodeData: (nodeId: string, patch: Record<string, unknown>, description = 'Update Node Data') => {
      const currentDoc = get().doc;
      const cleanPatch = sanitizeNodeData(patch);

      if (history.isInTransaction()) {
        // Coalescing in active transaction (e.g. slider scrubbing)
        const nextNodes = currentDoc.graph.nodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: { ...(n.data || {}), ...cleanPatch },
            };
          }
          return n;
        });
        set(() => ({
          doc: {
            ...currentDoc,
            graph: {
              ...currentDoc.graph,
              nodes: nextNodes,
            },
          },
        }));
      } else {
        const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
          const target = draft.graph.nodes.find((n) => n.id === nodeId);
          if (target) {
            target.data = { ...(target.data || {}), ...cleanPatch };
          }
        });
        history.push(patches, inversePatches, description);
        set(() => ({ doc: nextDoc }));
      }
    },

    addNode: (node: Node) => {
      const currentDoc = get().doc;
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.graph.nodes.push(node);
      });
      history.push(patches, inversePatches, `Add ${node.type} Node`);
      set(() => ({ doc: nextDoc }));
    },

    removeNodes: (nodeIds: string[]) => {
      const currentDoc = get().doc;
      const idSet = new Set(nodeIds);
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.graph.nodes = draft.graph.nodes.filter((n) => !idSet.has(n.id));
        draft.graph.edges = draft.graph.edges.filter(
          (e) => !idSet.has(e.source) && !idSet.has(e.target)
        );
      });
      history.push(patches, inversePatches, 'Delete Nodes');
      set(() => ({ doc: nextDoc }));
    },

    setNodes: (nodesOrUpdater) => {
      const currentDoc = get().doc;
      const newNodes = typeof nodesOrUpdater === 'function' ? nodesOrUpdater(currentDoc.graph.nodes) : nodesOrUpdater;
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.graph.nodes = newNodes;
      });
      history.push(patches, inversePatches, 'Set Nodes');
      set(() => ({ doc: nextDoc }));
    },

    onNodesChange: (changes: NodeChange[]) => {
      // React Flow internal changes (dragging position, selection, dimension)
      // Per P3-T1: Position/selection/dimension changes do NOT create history steps.
      const currentDoc = get().doc;
      const updatedNodes = applyNodeChanges(changes, currentDoc.graph.nodes);
      set(() => ({
        doc: {
          ...currentDoc,
          graph: {
            ...currentDoc.graph,
            nodes: updatedNodes,
          },
        },
      }));
    },

    onNodeDragStart: (_event, _node, nodes) => {
      const startPositions: Record<string, { x: number; y: number }> = {};
      for (const n of nodes) {
        startPositions[n.id] = { x: n.position.x, y: n.position.y };
      }
      set(() => ({ nodeDragStartPositions: startPositions }));
    },

    onNodeDragStop: (_event, _node, nodes) => {
      const startPositions = get().nodeDragStartPositions;
      const currentDoc = get().doc;

      // Check if any dragged node actually moved
      let didMove = false;
      for (const n of nodes) {
        const start = startPositions[n.id];
        if (start && (start.x !== n.position.x || start.y !== n.position.y)) {
          didMove = true;
          break;
        }
      }

      if (!didMove) return;

      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        for (const n of nodes) {
          const target = draft.graph.nodes.find((item) => item.id === n.id);
          if (target) {
            target.position = { x: n.position.x, y: n.position.y };
          }
        }
      });

      // Synthetic inverse patches that restore initial start positions
      const actualInversePatches = inversePatches.map((p) => {
        if (p.path.length >= 3 && p.path[0] === 'graph' && p.path[1] === 'nodes' && p.path[3] === 'position') {
          const nodeIndex = Number(p.path[2]);
          const targetNode = currentDoc.graph.nodes[nodeIndex];
          if (targetNode && startPositions[targetNode.id]) {
            return {
              ...p,
              value: startPositions[targetNode.id],
            };
          }
        }
        return p;
      });

      history.push(patches, actualInversePatches, 'Move Nodes');
      set(() => ({ doc: nextDoc, nodeDragStartPositions: {} }));
    },

    addEdge: (edgeOrConnection: Edge | Connection) => {
      const currentDoc = get().doc;
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.graph.edges = xyflowAddEdge(edgeOrConnection, draft.graph.edges);
      });
      history.push(patches, inversePatches, 'Connect Edge');
      set(() => ({ doc: nextDoc }));
    },

    removeEdges: (edgeIds: string[]) => {
      const currentDoc = get().doc;
      const idSet = new Set(edgeIds);
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.graph.edges = draft.graph.edges.filter((e) => !idSet.has(e.id));
      });
      history.push(patches, inversePatches, 'Disconnect Edge');
      set(() => ({ doc: nextDoc }));
    },

    setEdges: (edgesOrUpdater) => {
      const currentDoc = get().doc;
      const newEdges = typeof edgesOrUpdater === 'function' ? edgesOrUpdater(currentDoc.graph.edges) : edgesOrUpdater;
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.graph.edges = newEdges;
      });
      history.push(patches, inversePatches, 'Set Edges');
      set(() => ({ doc: nextDoc }));
    },

    onEdgesChange: (changes: EdgeChange[]) => {
      const currentDoc = get().doc;
      const updatedEdges = applyEdgeChanges(changes, currentDoc.graph.edges);
      set(() => ({
        doc: {
          ...currentDoc,
          graph: {
            ...currentDoc.graph,
            edges: updatedEdges,
          },
        },
      }));
    },

    registerAssetRecord: (asset: AssetRecord) => {
      const currentDoc = get().doc;
      if (currentDoc.assets.some((a) => a.id === asset.id)) return;
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.assets.push(asset);
      });
      history.push(patches, inversePatches, 'Register Asset');
      set(() => ({ doc: nextDoc }));
    },

    updateExportSettings: (patch: Partial<ProjectExportSettings>) => {
      const currentDoc = get().doc;
      const [nextDoc, patches, inversePatches] = produceWithPatches(currentDoc, (draft) => {
        draft.export.settings = { ...draft.export.settings, ...patch };
      });
      history.push(patches, inversePatches, 'Update Export Settings');
      set(() => ({ doc: nextDoc }));
    },

    updateView: (viewPatch: Partial<ProjectView>) => {
      const currentDoc = get().doc;
      set(() => ({
        doc: {
          ...currentDoc,
          view: {
            ...currentDoc.view,
            ...viewPatch,
          },
        },
      }));
    },
  };
}
