import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Toolbar } from './app/Toolbar';
import { Canvas } from './app/Canvas';
import { useUndoRedo } from './app/useUndoRedo';
import { useGraphActions } from './app/useGraphActions';
import { useTextureDrop } from './app/useTextureDrop';
import { createSpawnedNode, createCommentBoxNode } from './app/spawn';
import { buildORMHEdges } from './app/autoWire';
import {
  BENCHMARK_MAPS,
  initialNodes,
  initialEdges,
  getBatchPipelineExample,
} from './app/initialGraph';
import { useAppHotkeys } from './app/useAppHotkeys';
import { useMenuCommands } from './app/useMenuCommands';
import { PixelEngine, type TextureBuffer } from './engine/pixelEngine';
import { GraphEvaluator } from './engine/graphEvaluator';
import { graphContentHash } from './graph/hash';

function Workbench() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [primaryAsset, setPrimaryAsset] = useState('Anthracite_Concrete');
  const [activeNodeId, setActiveNodeId] = useState<string | null>('output_ormh');
  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Mouse cursor tracking on canvas
  const canvasMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Live in-memory source buffers
  const [sourceBuffers, setSourceBuffers] = useState<Record<string, TextureBuffer>>({});
  const [statusMessage, setStatusMessage] = useState('Ready | Tactical DCC Workstation online');

  const { screenToFlowPosition, fitView } = useReactFlow();

  // Undo / Redo engine
  const { pushSnapshot, handleUndo, handleRedo, canUndo, canRedo } = useUndoRedo(
    nodes,
    edges,
    setNodes,
    setEdges,
    setStatusMessage
  );

  // Graph mutations
  const {
    handleUpdateNodeData,
    handleDuplicate,
    handleDelete,
    handleClearGraph,
    onConnect,
    onReconnectStart,
    onReconnect,
    onReconnectEnd,
    onEdgeClick,
  } = useGraphActions({
    nodes,
    edges,
    setNodes,
    setEdges,
    pushSnapshot,
    setStatusMessage,
    activeNodeId,
    setActiveNodeId,
  });

  // Source buffer updater for texture uploads
  const setSourceBuffer = useCallback((nodeId: string, buffer: TextureBuffer) => {
    setSourceBuffers((prev) => ({ ...prev, [nodeId]: buffer }));
  }, []);

  // Stable functional signature of nodes
  const graphStructureKey = useMemo(() => graphContentHash(nodes, edges), [nodes, edges]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Topologically evaluate the entire graph live in real-time
  const evaluatedBuffers = useMemo(() => {
    return GraphEvaluator.evaluate(nodesRef.current, edgesRef.current, sourceBuffers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphStructureKey, sourceBuffers]);

  const nodeBufferContextValue = useMemo(
    () => ({
      evaluatedBuffers,
      sourceBuffers,
      setSourceBuffer,
      onUpdateNodeData: handleUpdateNodeData,
    }),
    [evaluatedBuffers, sourceBuffers, setSourceBuffer, handleUpdateNodeData]
  );

  // Clean up selected node if it was removed from the graph
  useEffect(() => {
    if (activeNodeId && !nodes.some((n) => n.id === activeNodeId)) {
      setActiveNodeId(null);
    }
  }, [nodes, activeNodeId]);

  // Selected or inspected node
  const selectedNode = useMemo(() => {
    if (!activeNodeId) return null;
    return nodes.find((n) => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  const activeBuffer = useMemo<TextureBuffer | null>(() => {
    if (!selectedNode) return null;
    return evaluatedBuffers[selectedNode.id] || sourceBuffers[selectedNode.id] || null;
  }, [selectedNode, evaluatedBuffers, sourceBuffers]);

  // Node spawning helper with Top-Center cursor alignment
  const spawnNode = useCallback(
    (typeKey: string, customPos?: { x: number; y: number }) => {
      pushSnapshot();
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
        primaryAsset,
      });

      setNodes((nds) => [...nds, newNode]);
      setActiveNodeId(newNode.id);
      setStatusMessage(`Spawned ${newNode.type} node`);
    },
    [primaryAsset, pushSnapshot, screenToFlowPosition, setNodes]
  );

  // UE5 style Comment Box grouping (C Key)
  const spawnCommentBox = useCallback(() => {
    pushSnapshot();
    const targetNodes = nodes.filter((n) => (n.selected || n.id === activeNodeId) && n.type !== 'commentBox');
    const fallbackPos = canvasMousePosRef.current
      ? screenToFlowPosition(canvasMousePosRef.current)
      : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const newCommentNode = createCommentBoxNode(targetNodes, fallbackPos);
    setNodes((nds) => [newCommentNode, ...nds]);
    setStatusMessage('Created Comment Box (UE5)');
  }, [nodes, activeNodeId, pushSnapshot, screenToFlowPosition, setNodes]);

  // Toggle Bypass / Mute on selected node (D Key)
  const toggleBypassSelected = useCallback(() => {
    pushSnapshot();
    setNodes((nds) =>
      nds.map((n) => {
        if (n.selected || n.id === activeNodeId) {
          const currentBypassed = !!n.data?.isBypassed;
          return {
            ...n,
            data: {
              ...n.data,
              isBypassed: !currentBypassed,
            },
          };
        }
        return n;
      })
    );
    setStatusMessage('Toggled Bypass / Mute state on selected node (D)');
  }, [activeNodeId, pushSnapshot, setNodes]);

  // Auto-Wire ORMH Combiner
  const autoWireORMH = useCallback(() => {
    pushSnapshot();
    const updatedEdges = buildORMHEdges(nodes, edges);
    if (updatedEdges) {
      setEdges(updatedEdges);
      setStatusMessage('Auto-wired PBR channels into ORMH Combiner');
    }
  }, [nodes, edges, pushSnapshot, setEdges]);

  // Load benchmark textures and initialize live graph
  const loadBenchmarkTextures = useCallback(async () => {
    setStatusMessage('Loading Anthracite Concrete benchmark maps...');
    try {
      const loaded: Record<string, TextureBuffer> = {};
      for (const m of BENCHMARK_MAPS) {
        try {
          const buf = await PixelEngine.loadFromUrl(m.url);
          loaded[m.nodeId] = buf;
        } catch (e) {
          console.warn(`Could not fetch ${m.url}`, e);
        }
      }

      setSourceBuffers(loaded);
      setNodes((prev) =>
        prev.map((node) => {
          const buf = loaded[node.id];
          if (buf && buf.dataUrl) {
            return {
              ...node,
              data: {
                ...node.data,
                previewUrl: buf.dataUrl,
              },
            };
          }
          return node;
        })
      );
      setStatusMessage('Loaded benchmark maps & initialized live graph');
    } catch (err) {
      console.error(err);
      setStatusMessage('Benchmark ready');
    }
  }, [setNodes]);

  // Load Batch Pipeline Example
  const loadBatchPipelineExample = useCallback(() => {
    pushSnapshot();
    const { nodes: exNodes, edges: exEdges } = getBatchPipelineExample();
    setNodes(exNodes);
    setEdges(exEdges);
    setActiveNodeId(null);
    setStatusMessage('Loaded working Batch Asset Pipeline example');
  }, [pushSnapshot, setEdges, setNodes]);

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setStatusMessage('Selected all nodes');
  }, [setNodes]);

  useAppHotkeys({
    handleUndo,
    handleRedo,
    fitView: () => fitView({ duration: 300 }),
    autoWireORMH,
    spawnCommentBox,
    toggleBypassSelected,
    handleDuplicate,
    handleDelete,
    selectAll,
    spawnNode,
    togglePalette: () => setPalettePos((p) => (p ? null : { x: canvasMousePosRef.current?.x ?? window.innerWidth / 2, y: canvasMousePosRef.current?.y ?? window.innerHeight / 2 })),
    toggleShortcuts: () => setIsShortcutsOpen((p) => !p),
    toggleExportModal: () => setIsExportModalOpen((p) => !p),
    isModalOpen: isShortcutsOpen || isExportModalOpen,
  });

  useMenuCommands({
    handleUndo, handleRedo, fitView: () => fitView({ duration: 300 }),
    handleDuplicate, handleDelete, selectAll,
    toggleExportModal: () => setIsExportModalOpen((p) => !p),
    toggleShortcuts: () => setIsShortcutsOpen((p) => !p),
    handleClearGraph, setStatusMessage,
  });

  const { handleDragOver, handleDrop } = useTextureDrop({
    screenToFlowPosition,
    spawnNode,
    setNodes,
    setSourceBuffers,
    setActiveNodeId,
    setStatusMessage,
  });

  const handleAssetChange = useCallback(
    (newAsset: string) => {
      setPrimaryAsset(newAsset);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'textureOutput') {
            const d = (n.data as Record<string, unknown>) || {};
            const slot = (typeof d.slot === 'string' && d.slot) || 'ORM';
            const format =
              typeof d.formatOverride === 'string' && d.formatOverride !== 'inherit'
                ? d.formatOverride.toLowerCase()
                : (typeof d.format === 'string' ? d.format : 'png').toLowerCase();
            return {
              ...n,
              data: {
                ...n.data,
                outputFilename: `T_${newAsset}_${slot}.${format}`,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleExport = useCallback(
    (filename: string) => {
      if (activeBuffer) {
        PixelEngine.downloadBuffer(activeBuffer, filename);
        setStatusMessage(`Downloaded ${filename} successfully!`);
      }
    },
    [activeBuffer]
  );

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Toolbar
        onLoadBatchPipeline={loadBatchPipelineExample}
        onLoadBenchmark={loadBenchmarkTextures}
        onUndo={handleUndo}
        canUndo={canUndo}
        onRedo={handleRedo}
        canRedo={canRedo}
        onSpawnCommentBox={spawnCommentBox}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onFitView={() => fitView({ duration: 300 })}
        onClearGraph={handleClearGraph}
      />

      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
          e.preventDefault();
          setPalettePos({ x: e.clientX, y: e.clientY });
        }}
        canvasMousePosRef={canvasMousePosRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        statusMessage={statusMessage}
        setStatusMessage={setStatusMessage}
        selectedNode={selectedNode}
        activeBuffer={activeBuffer}
        primaryAsset={primaryAsset}
        onAssetChange={handleAssetChange}
        onUpdateNodeData={handleUpdateNodeData}
        onExportTarget={handleExport}
        palettePos={palettePos}
        setPalettePos={setPalettePos}
        spawnNode={spawnNode}
        isShortcutsOpen={isShortcutsOpen}
        setIsShortcutsOpen={setIsShortcutsOpen}
        isExportModalOpen={isExportModalOpen}
        setIsExportModalOpen={setIsExportModalOpen}
        evaluatedBuffers={evaluatedBuffers}
        nodeBufferContextValue={nodeBufferContextValue}
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
