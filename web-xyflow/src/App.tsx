import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Toolbar } from './app/Toolbar';
import { Canvas } from './app/Canvas';
import { useGraphActions } from './app/useGraphActions';
import { useTextureDrop } from './app/useTextureDrop';
import { createSpawnedNode, createCommentBoxNode } from './app/spawn';
import { buildORMHEdges } from './app/autoWire';
import { fetchBenchmarkBuffers, getBatchPipelineExample } from './app/initialGraph';
import { useAppShortcutsAndMenus } from './app/useAppShortcutsAndMenus';
import { PixelEngine, type TextureBuffer } from './engine/pixelEngine';
import { GraphEvaluator } from './engine/graphEvaluator';
import { graphContentHash } from './graph/hash';
import { useAppStore } from './store/useAppStore';
import { useProjectFiles } from './features/project/useProjectFiles';
import { RelinkModal } from './features/project/RelinkModal';
import { useClipboardOperations } from './features/project/useClipboardOperations';

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
  const missingAssets = useAppStore((s) => s.missingAssets);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const projectName = useAppStore((s) => s.projectName);
  const isDirty = useAppStore((s) => s.isDirty);

  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo());
  const canRedo = useAppStore((s) => s.canRedo());

  const canvasMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const [sourceBuffers, setSourceBuffers] = useState<Record<string, TextureBuffer>>({});
  const { screenToFlowPosition, fitView } = useReactFlow();

  const {
    handleSave,
    handleSaveAs,
    handleNewProject,
    handleOpenDialog,
  } = useProjectFiles();

  const {
    handleDuplicate: origDuplicate,
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
    pushSnapshot: () => {},
    setStatusMessage,
    activeNodeId,
    setActiveNodeId,
  });

  const setSourceBuffer = useCallback((nodeOrAssetId: string, buffer: TextureBuffer) => {
    setSourceBuffers((prev) => ({ ...prev, [nodeOrAssetId]: buffer }));
  }, []);

  const graphStructureKey = useMemo(() => graphContentHash(nodes, edges), [nodes, edges]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const evaluatedBuffers = useMemo(() => {
    return GraphEvaluator.evaluate(nodesRef.current, edgesRef.current, sourceBuffers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphStructureKey, sourceBuffers]);

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

  const spawnCommentBox = useCallback(() => {
    const targetNodes = nodes.filter((n) => (n.selected || n.id === activeNodeId) && n.type !== 'commentBox');
    const fallbackPos = canvasMousePosRef.current
      ? screenToFlowPosition(canvasMousePosRef.current)
      : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const newCommentNode = createCommentBoxNode(targetNodes, fallbackPos);
    addNode(newCommentNode);
    setStatusMessage('Created Comment Box (UE5)');
  }, [nodes, activeNodeId, addNode, screenToFlowPosition, setStatusMessage]);

  const toggleBypassSelected = useCallback(() => {
    const target = nodes.find((n) => n.selected || n.id === activeNodeId);
    if (target) {
      const current = !!target.data?.isBypassed;
      updateNodeData(target.id, { isBypassed: !current });
      setStatusMessage('Toggled Bypass state on selected node (D)');
    }
  }, [nodes, activeNodeId, updateNodeData, setStatusMessage]);

  const autoWireORMH = useCallback(() => {
    const updatedEdges = buildORMHEdges(nodes, edges);
    if (updatedEdges) {
      setEdges(updatedEdges);
      setStatusMessage('Auto-wired PBR channels into ORMH Combiner');
    }
  }, [nodes, edges, setEdges, setStatusMessage]);

  const loadBenchmarkTextures = useCallback(async () => {
    setStatusMessage('Loading Anthracite Concrete benchmark maps...');
    try {
      const loaded = await fetchBenchmarkBuffers((url) => PixelEngine.loadFromUrl(url));
      setSourceBuffers(loaded);
      setStatusMessage('Loaded benchmark maps & initialized live graph');
    } catch (err) {
      console.error(err);
      setStatusMessage('Benchmark ready');
    }
  }, [setStatusMessage]);

  const loadBatchPipelineExample = useCallback(() => {
    const { nodes: exNodes, edges: exEdges } = getBatchPipelineExample();
    setNodes(exNodes);
    setEdges(exEdges);
    setActiveNodeId(null);
    setStatusMessage('Loaded working Batch Asset Pipeline example');
  }, [setEdges, setNodes, setActiveNodeId, setStatusMessage]);

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setStatusMessage('Selected all nodes');
  }, [setNodes, setStatusMessage]);

  // Clipboard operations (P3-T10)
  const {
    handleCopy,
    handlePaste,
    handleCut,
    handleDuplicateWithWires,
  } = useClipboardOperations({
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
    isModalOpen: isShortcutsOpen || isExportModalOpen || isRelinkModalOpen,
    handleSave,
    handleSaveAs,
    handleOpenDialog,
    handleNewProject,
    handleCopy,
    handlePaste,
    handleCut,
    handleClearGraph,
    setStatusMessage,
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
      updateExportSettings({ primaryAsset: newAsset });
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
    [updateExportSettings, setNodes]
  );

  const handleExport = useCallback(
    (filename: string) => {
      if (activeBuffer) {
        PixelEngine.downloadBuffer(activeBuffer, filename);
        setStatusMessage(`Downloaded ${filename} successfully!`);
      }
    },
    [activeBuffer, setStatusMessage]
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
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onSpawnCommentBox={spawnCommentBox}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onFitView={() => fitView({ duration: 300 })}
        onClearGraph={handleClearGraph}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenDialog}
        onSaveProject={handleSave}
        projectName={projectName}
        isDirty={isDirty}
      />

      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
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
        primaryAsset={doc.export.settings.primaryAsset}
        onAssetChange={handleAssetChange}
        onUpdateNodeData={updateNodeData}
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

      <RelinkModal
        isOpen={isRelinkModalOpen}
        onClose={() => setIsRelinkModalOpen(false)}
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
