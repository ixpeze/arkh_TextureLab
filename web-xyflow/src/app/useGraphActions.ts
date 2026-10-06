import { useCallback, useRef } from 'react';
import { addEdge, reconnectEdge, type Connection, type Edge, type Node } from '@xyflow/react';
import { validateConnection } from '../graph/validate';
import { getEdgeConfig } from './autoWire';
import { duplicateNodes, deleteNodes } from './graphActions';

export interface UseGraphActionsProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  pushSnapshot: () => void;
  setStatusMessage: (msg: string) => void;
  activeNodeId: string | null;
  setActiveNodeId: (id: string | null) => void;
}

export function useGraphActions({
  nodes,
  edges,
  setNodes,
  setEdges,
  pushSnapshot,
  setStatusMessage,
  activeNodeId,
  setActiveNodeId,
}: UseGraphActionsProps) {
  const edgeReconnectSuccessful = useRef(true);

  // Bi-directional node data updater for node card controls
  const handleUpdateNodeData = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...patch,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  // Pure Duplicate action using P1-A3 helper
  const handleDuplicate = useCallback(
    (customTargetIds?: string[]) => {
      const targetIds =
        customTargetIds && customTargetIds.length > 0
          ? customTargetIds
          : nodes.filter((n) => n.selected).map((n) => n.id);

      if (targetIds.length === 0 && activeNodeId) {
        targetIds.push(activeNodeId);
      }
      if (targetIds.length === 0) return;

      pushSnapshot();
      const res = duplicateNodes(nodes, edges, targetIds);
      setNodes(res.nodes);
      setEdges(res.edges);

      const firstNew = res.newNodes[0];
      if (firstNew) {
        setActiveNodeId(firstNew.id);
      }
      setStatusMessage(`Duplicated ${res.newNodes.length} node(s)`);
    },
    [nodes, edges, activeNodeId, pushSnapshot, setNodes, setEdges, setActiveNodeId, setStatusMessage]
  );

  // Pure Delete action using P1-A3 helper
  const handleDelete = useCallback(
    (customTargetIds?: string[]) => {
      const targetIds =
        customTargetIds && customTargetIds.length > 0
          ? customTargetIds
          : nodes.filter((n) => n.selected).map((n) => n.id);

      if (targetIds.length === 0 && activeNodeId) {
        targetIds.push(activeNodeId);
      }
      if (targetIds.length === 0) return;

      pushSnapshot();
      const res = deleteNodes(nodes, edges, targetIds);
      setNodes(res.nodes);
      setEdges(res.edges);

      if (activeNodeId && targetIds.includes(activeNodeId)) {
        setActiveNodeId(null);
      }
      setStatusMessage(`Deleted ${targetIds.length} node(s)`);
    },
    [nodes, edges, activeNodeId, pushSnapshot, setNodes, setEdges, setActiveNodeId, setStatusMessage]
  );

  // Clear entire graph
  const handleClearGraph = useCallback(() => {
    if (nodes.length === 0) return;
    pushSnapshot();
    setNodes([]);
    setEdges([]);
    setActiveNodeId(null);
    setStatusMessage('Canvas cleared');
  }, [nodes.length, pushSnapshot, setNodes, setEdges, setActiveNodeId, setStatusMessage]);

  // Connect wires
  const onConnect = useCallback(
    (params: Connection) => {
      const validation = validateConnection(params, edges);
      if (!validation.isValid) {
        setStatusMessage(`Wire rejected: ${validation.reason}`);
        return;
      }

      pushSnapshot();
      const cfg = getEdgeConfig(params.sourceHandle, params.targetHandle);

      // Single-input socket rule (DCC standard): replace existing wire connected to this target handle
      setEdges((eds) => {
        const filtered = eds.filter(
          (e) => !(e.target === params.target && (e.targetHandle || null) === (params.targetHandle || null))
        );
        return addEdge(
          {
            ...params,
            ...cfg,
          },
          filtered
        );
      });
      setStatusMessage(`Connected wire from ${params.source} to ${params.target}`);
    },
    [edges, pushSnapshot, setEdges, setStatusMessage]
  );

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const validation = validateConnection(
        newConnection,
        edges.filter((e) => e.id !== oldEdge.id)
      );
      if (!validation.isValid) {
        setStatusMessage(`Wire rejected: ${validation.reason}`);
        return;
      }

      edgeReconnectSuccessful.current = true;
      pushSnapshot();
      const cfg = getEdgeConfig(newConnection.sourceHandle, newConnection.targetHandle);
      setEdges((els) => {
        const filtered = els.filter(
          (e) =>
            e.id === oldEdge.id ||
            !(e.target === newConnection.target && (e.targetHandle || null) === (newConnection.targetHandle || null))
        );
        return reconnectEdge(oldEdge, { ...newConnection, ...cfg }, filtered);
      });
      setStatusMessage('Reconnected wire');
    },
    [edges, pushSnapshot, setEdges, setStatusMessage]
  );

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        pushSnapshot();
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        setStatusMessage(`Disconnected wire from ${edge.target}`);
      }
      edgeReconnectSuccessful.current = true;
    },
    [pushSnapshot, setEdges, setStatusMessage]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      pushSnapshot();
      const deletedIds = new Set(deletedNodes.map((n) => n.id));
      setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)));
      if (activeNodeId && deletedIds.has(activeNodeId)) {
        setActiveNodeId(null);
      }
      setStatusMessage(`Deleted ${deletedNodes.length} node(s)`);
    },
    [activeNodeId, pushSnapshot, setEdges, setActiveNodeId, setStatusMessage]
  );

  // UE5 Alt + Click wire cutting
  const onEdgeClick = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      if (e.altKey) {
        pushSnapshot();
        setEdges((eds) => eds.filter((ed) => ed.id !== edge.id));
        setStatusMessage(`Cut wire ${edge.id} (Alt+Click)`);
      }
    },
    [pushSnapshot, setEdges, setStatusMessage]
  );

  const isValidConnection = useCallback(
    (conn: Edge | Connection) => validateConnection(conn, edges).isValid,
    [edges]
  );

  return {
    handleUpdateNodeData,
    handleDuplicate,
    handleDelete,
    handleClearGraph,
    onConnect,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
    onNodesDelete,
    onEdgeClick,
    isValidConnection,
  };
}
