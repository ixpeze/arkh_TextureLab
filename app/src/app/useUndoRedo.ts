import { useState, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';

export interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export function useUndoRedo(
  nodes: Node[],
  edges: Edge[],
  setNodes: (updater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  onStatusChange?: (msg: string) => void
) {
  const historyRef = useRef<GraphSnapshot[]>([]);
  const redoRef = useRef<GraphSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushSnapshot = useCallback(() => {
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    redoRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    onStatusChange?.('Undo');
  }, [nodes, edges, setNodes, setEdges, onStatusChange]);

  const handleRedo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current.pop()!;
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    setNodes(next.nodes);
    setEdges(next.edges);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    onStatusChange?.('Redo');
  }, [nodes, edges, setNodes, setEdges, onStatusChange]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    pushSnapshot,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
