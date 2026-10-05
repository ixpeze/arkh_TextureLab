import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { AssetRecord } from '../../types/project';
import { useAppStore } from '../../store/useAppStore';
import {
  createClipboardPayload,
  parseClipboardText,
  preparePasteNodes,
  duplicateWithWires,
} from './clipboard';

export interface UseClipboardOperationsOptions {
  nodes: Node[];
  edges: Edge[];
  assets: AssetRecord[];
  activeNodeId: string | null;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>> | ((fn: (nds: Node[]) => Node[]) => void);
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>> | ((fn: (eds: Edge[]) => Edge[]) => void);
  handleDelete: () => void;
  origDuplicate: () => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  canvasMousePosRef: React.RefObject<{ x: number; y: number } | null>;
  setStatusMessage: (msg: string) => void;
}

export function useClipboardOperations({
  nodes,
  edges,
  assets,
  activeNodeId,
  setNodes,
  setEdges,
  handleDelete,
  origDuplicate,
  screenToFlowPosition,
  canvasMousePosRef,
  setStatusMessage,
}: UseClipboardOperationsOptions) {
  const handleCopy = useCallback(() => {
    const selected = nodes.filter((n) => n.selected || n.id === activeNodeId);
    const payload = createClipboardPayload(selected, edges, assets);
    if (payload) {
      void navigator.clipboard?.writeText(JSON.stringify(payload));
      setStatusMessage(`Copied ${selected.length} node(s)`);
    }
  }, [nodes, activeNodeId, edges, assets, setStatusMessage]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard?.readText();
      const payload = parseClipboardText(text);
      if (!payload) return;

      const targetPos = canvasMousePosRef.current
        ? screenToFlowPosition(canvasMousePosRef.current)
        : undefined;

      const { nodes: newNodes, edges: newEdges, assetsToAdd } = preparePasteNodes(
        payload,
        targetPos,
        assets
      );

      setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes]);
      setEdges((prev) => [...prev, ...newEdges]);
      for (const a of assetsToAdd) {
        useAppStore.getState().registerAssetRecord(a);
      }
      setStatusMessage(`Pasted ${newNodes.length} node(s)`);
    } catch (err) {
      console.warn('Clipboard paste failed:', err);
    }
  }, [screenToFlowPosition, assets, setNodes, setEdges, setStatusMessage, canvasMousePosRef]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDelete();
  }, [handleCopy, handleDelete]);

  const handleDuplicateWithWires = useCallback(() => {
    const selected = nodes.filter((n) => n.selected || n.id === activeNodeId);
    if (selected.length === 0) {
      origDuplicate();
      return;
    }
    const { newNodes, newEdges } = duplicateWithWires(selected, edges);
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((prev) => [...prev, ...newEdges]);
    setStatusMessage(`Duplicated ${newNodes.length} node(s) with connections`);
  }, [nodes, activeNodeId, edges, origDuplicate, setNodes, setEdges, setStatusMessage]);

  return {
    handleCopy,
    handlePaste,
    handleCut,
    handleDuplicateWithWires,
  };
}
