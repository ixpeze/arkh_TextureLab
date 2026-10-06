import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { buildORMHEdges } from './autoWire';
import { fetchBenchmarkBuffers, getBatchPipelineExample, getTemplateGraph } from './initialGraph';
import { createCommentBoxNode } from './spawn';
import { decodeImage } from '../io/decode';
import { ExportEngine } from '../engine/exportEngine';
import type { TextureBuffer } from '../types/buffer';

export interface UseWorkbenchActionsProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  activeNodeId: string | null;
  setActiveNodeId: (id: string | null) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  updateExportSettings: (patch: { primaryAsset?: string }) => void;
  setStatusMessage: (msg: string) => void;
  activeBuffer: TextureBuffer | null;
  setSourceBuffers: React.Dispatch<React.SetStateAction<Record<string, TextureBuffer>>>;
  canvasMousePosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  addNode: (node: Node) => void;
}

export function useWorkbenchActions({
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
}: UseWorkbenchActionsProps) {
  const spawnCommentBox = useCallback(() => {
    const targets = nodes.filter((n) => (n.selected || n.id === activeNodeId) && n.type !== 'commentBox');
    const fallback = canvasMousePosRef.current
      ? screenToFlowPosition(canvasMousePosRef.current)
      : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const box = createCommentBoxNode(targets, fallback);
    addNode(box);
    setStatusMessage('Created Comment Box (UE5)');
  }, [nodes, activeNodeId, addNode, screenToFlowPosition, canvasMousePosRef, setStatusMessage]);

  const toggleBypassSelected = useCallback(() => {
    const target = nodes.find((n) => n.selected || n.id === activeNodeId);
    if (target) {
      updateNodeData(target.id, { isBypassed: !target.data?.isBypassed });
      setStatusMessage('Toggled Bypass state on selected node (D)');
    }
  }, [nodes, activeNodeId, updateNodeData, setStatusMessage]);

  const autoWireORMH = useCallback(() => {
    const updated = buildORMHEdges(nodes, edges);
    if (updated) {
      setEdges(updated);
      setStatusMessage('Auto-wired PBR channels into ORMH Combiner');
    }
  }, [nodes, edges, setEdges, setStatusMessage]);

  const loadBenchmarkTextures = useCallback(async () => {
    setStatusMessage('Loading Anthracite Concrete benchmark maps...');
    try {
      const loaded = await fetchBenchmarkBuffers(async (url) => {
        const res = await fetch(url);
        const ab = await res.arrayBuffer();
        const decoded = await decodeImage(ab, url);
        return { width: decoded.width, height: decoded.height, data: decoded.data } as TextureBuffer;
      });
      setSourceBuffers(loaded);
      setStatusMessage('Loaded benchmark maps & initialized live graph');
    } catch {
      setStatusMessage('Benchmark ready');
    }
  }, [setSourceBuffers, setStatusMessage]);

  const loadBatchPipelineExample = useCallback(() => {
    const { nodes: exNodes, edges: exEdges } = getBatchPipelineExample();
    setNodes(exNodes);
    setEdges(exEdges);
    setActiveNodeId(null);
    setStatusMessage('Loaded working Batch Asset Pipeline example');
  }, [setEdges, setNodes, setActiveNodeId, setStatusMessage]);

  const loadTemplate = useCallback(
    (preset: 'orm' | 'ormh' | 'ue5' | 'unity' | 'unpack') => {
      const { nodes: tNodes, edges: tEdges } = getTemplateGraph(preset);
      setNodes(tNodes);
      setEdges(tEdges);
      setActiveNodeId(null);
      setStatusMessage(`Loaded ${preset.toUpperCase()} graph template`);
    },
    [setNodes, setEdges, setActiveNodeId, setStatusMessage]
  );

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setStatusMessage('Selected all nodes');
  }, [setNodes, setStatusMessage]);

  const handleAssetChange = useCallback(
    (newAsset: string) => {
      updateExportSettings({ primaryAsset: newAsset });
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'textureOutput') {
            const d = (n.data as Record<string, unknown>) || {};
            const slot = (typeof d.slot === 'string' && d.slot) || 'ORM';
            const fmt =
              typeof d.formatOverride === 'string' && d.formatOverride !== 'inherit'
                ? d.formatOverride.toLowerCase()
                : (typeof d.format === 'string' ? d.format : 'png').toLowerCase();
            return { ...n, data: { ...n.data, outputFilename: `T_${newAsset}_${slot}.${fmt}` } };
          }
          return n;
        })
      );
    },
    [updateExportSettings, setNodes]
  );

  const handleExport = useCallback(
    async (filename: string) => {
      if (activeBuffer) {
        const blob = await ExportEngine.encodeImageBlob(activeBuffer, 'PNG');
        ExportEngine.triggerDownload(blob, filename);
        setStatusMessage(`Downloaded ${filename} successfully!`);
      }
    },
    [activeBuffer, setStatusMessage]
  );

  return {
    spawnCommentBox,
    toggleBypassSelected,
    autoWireORMH,
    loadBenchmarkTextures,
    loadBatchPipelineExample,
    loadTemplate,
    selectAll,
    handleAssetChange,
    handleExport,
  };
}
