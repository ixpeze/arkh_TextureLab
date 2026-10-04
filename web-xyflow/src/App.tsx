import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  BackgroundVariant,
  PanOnScrollMode,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import type { Connection, Edge, Node, NodeTypes, EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Maximize2,
  Trash2,
  Keyboard,
  Undo2,
  Redo2,
  MessageSquare,
  Download,
  FolderOpen,
  Sparkles,
} from 'lucide-react';

import { TextureInputNode } from './components/nodes/TextureInputNode';
import { ChannelPackNode, ChannelCombinerNode } from './components/nodes/ChannelPackNode';
import { ChannelUnpackNode, ChannelSplitterNode } from './components/nodes/ChannelUnpackNode';
import { ChannelMixerNode, ChannelSwizzleNode } from './components/nodes/ChannelMixerNode';
import { ColorNode, ConstantColorNode } from './components/nodes/ColorNode';
import { ConstantScalarNode } from './components/nodes/ConstantScalarNode';
import { CommentBoxNode } from './components/nodes/CommentBoxNode';
import { InvertNode } from './components/nodes/InvertNode';
import { LevelsNode } from './components/nodes/LevelsNode';
import { ResizeNode } from './components/nodes/ResizeNode';
import { UpscaleNode } from './components/nodes/UpscaleNode';
import { NormalFlipNode } from './components/nodes/NormalFlipNode';
import { NormalBlendNode } from './components/nodes/NormalBlendNode';
import { BlendNode } from './components/nodes/BlendNode';
import {
  MathNode,
  LerpNode,
  MultiplyNode,
  AddNode,
  SubtractNode,
  DivideNode,
  ClampNode,
  SaturateNode,
  PowerNode,
  OneMinusNode,
  MinNode,
  MaxNode,
  AbsNode,
} from './components/nodes/MathNode';
import { CompareNode } from './components/nodes/CompareNode';
import { SeamCheckNode } from './components/nodes/SeamCheckNode';
import { LoadFolderNode } from './components/nodes/LoadFolderNode';
import { NormalizeNode } from './components/nodes/NormalizeNode';
import { ForEachNode } from './components/nodes/ForEachNode';
import { BatchExportNode } from './components/nodes/BatchExportNode';
import { TextureOutputNode } from './components/nodes/TextureOutputNode';

import { DualMarchingAntsEdge, PulsingChannelEdge } from './components/edges/AnimatedEdge';
import { FloatingNodeLibrary } from './components/FloatingNodeLibrary';
import { FloatingDetailsPanel } from './components/FloatingDetailsPanel';
import { SpawnPalette } from './components/SpawnPalette';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ExportModal } from './components/ExportModal';

import { PixelEngine, type TextureBuffer } from './engine/pixelEngine';
import { LexicalNormalizer } from './engine/normalizer';
import { NodeBufferContext } from './context/NodeBufferContext';
import { GraphEvaluator } from './engine/graphEvaluator';
import { graphContentHash } from './graph/hash';

const SAMPLE_BASE = import.meta.env.DEV ? '/samples/4k' : '/samples/1k';

const BENCHMARK_MAPS = [
  {
    nodeId: 'input_ao',
    role: 'Ambient Occlusion',
    roleKey: 'ao',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete ambientocclusion 4k.png`,
    socket: 'r',
    color: 'var(--pbr-ao)',
  },
  {
    nodeId: 'input_rough',
    role: 'Roughness',
    roleKey: 'rough',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete roughness 4k.png`,
    socket: 'g',
    color: 'var(--pbr-rough)',
  },
  {
    nodeId: 'input_metal',
    role: 'Metallic',
    roleKey: 'metal',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete metallic 4k.png`,
    socket: 'b',
    color: 'var(--pbr-metal)',
  },
  {
    nodeId: 'input_height',
    role: 'Height',
    roleKey: 'height',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete height 4k.png`,
    socket: 'a',
    color: 'var(--pbr-height)',
  },
];

const initialNodes: Node[] = [
  {
    id: 'input_ao',
    type: 'textureInput',
    position: { x: -400, y: 40 },
    data: {
      title: 'Input: Ambient Occlusion',
      role: 'Ambient Occlusion',
      roleColor: 'var(--pbr-ao)',
      res: '4K',
      previewUrl: '',
      channels: { r: 'AO', g: 'AO', b: 'AO', a: '1.0' },
    },
  },
  {
    id: 'input_rough',
    type: 'textureInput',
    position: { x: -400, y: 250 },
    data: {
      title: 'Input: Roughness',
      role: 'Roughness',
      roleColor: 'var(--pbr-rough)',
      res: '4K',
      previewUrl: '',
      channels: { r: 'Roughness', g: 'Roughness', b: 'Roughness', a: '1.0' },
    },
  },
  {
    id: 'input_metal',
    type: 'textureInput',
    position: { x: -400, y: 460 },
    data: {
      title: 'Input: Metallic',
      role: 'Metallic',
      roleColor: 'var(--pbr-metal)',
      res: '4K',
      previewUrl: '',
      channels: { r: 'Metallic', g: 'Metallic', b: 'Metallic', a: '1.0' },
    },
  },
  {
    id: 'combiner_ormh',
    type: 'channelCombiner',
    position: { x: 30, y: 230 },
    data: {
      fallbacks: { r: 255, g: 128, b: 0, a: 255 },
    },
  },
  {
    id: 'output_ormh',
    type: 'textureOutput',
    position: { x: 360, y: 230 },
    data: {
      title: 'Texture Output Target',
      slot: 'ORM',
      outputFilename: 'T_Anthracite_Concrete_ORM.png',
      format: 'PNG',
      bitDepth: '8b',
      colorSpace: 'linear',
      enabled: true,
      res: '4K',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e_ao_r', source: 'input_ao', sourceHandle: 'r', target: 'combiner_ormh', targetHandle: 'r', type: 'pulsingChannel', style: { stroke: 'var(--pbr-ao)' } },
  { id: 'e_rough_g', source: 'input_rough', sourceHandle: 'g', target: 'combiner_ormh', targetHandle: 'g', type: 'pulsingChannel', style: { stroke: 'var(--pbr-rough)' } },
  { id: 'e_metal_b', source: 'input_metal', sourceHandle: 'b', target: 'combiner_ormh', targetHandle: 'b', type: 'pulsingChannel', style: { stroke: 'var(--pbr-metal)' } },
  { id: 'e_comb_out', source: 'combiner_ormh', sourceHandle: 'rgba', target: 'output_ormh', targetHandle: 'rgba', type: 'dualMarching', style: { stroke: 'var(--pbr-packed)' } },
];

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

  // Live in-memory source buffers (uploaded or benchmark maps)
  const [sourceBuffers, setSourceBuffers] = useState<Record<string, TextureBuffer>>({});
  const [statusMessage, setStatusMessage] = useState('Ready | Tactical DCC Workstation online');

  // History stack for Undo/Redo
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const redoRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const { screenToFlowPosition, fitView } = useReactFlow();
  const { zoom } = useViewport();

  // Bi-directional node data updater for node card controls
  const handleUpdateNodeData = useCallback((nodeId: string, patch: any) => {
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
  }, [setNodes]);

  // Source buffer updater for texture uploads
  const setSourceBuffer = useCallback((nodeId: string, buffer: TextureBuffer) => {
    setSourceBuffers((prev) => ({ ...prev, [nodeId]: buffer }));
  }, []);

  // Stable functional signature of nodes (independent of selection, position, dragging or measurements)
  const graphStructureKey = useMemo(() => graphContentHash(nodes, edges), [nodes, edges]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Topologically evaluate the entire graph live in real-time
  // Evaluates strictly when graph topology, node data parameters, or source buffers change
  // Selecting or dragging nodes NEVER triggers topological re-evaluation!
  const evaluatedBuffers = useMemo(() => {
    return GraphEvaluator.evaluate(nodesRef.current, edgesRef.current, sourceBuffers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphStructureKey, sourceBuffers]);

  // Memoized context value to prevent unselected nodes from re-rendering on selection/deselection
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

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      textureInput: TextureInputNode as any,
      color: ColorNode as any,
      constantColor: ConstantColorNode as any,
      constantScalar: ConstantScalarNode as any,
      channelPack: ChannelPackNode as any,
      channelCombiner: ChannelCombinerNode as any,
      channelUnpack: ChannelUnpackNode as any,
      channelSplitter: ChannelSplitterNode as any,
      channelMixer: ChannelMixerNode as any,
      channelSwizzle: ChannelSwizzleNode as any,
      math: MathNode as any,
      lerp: LerpNode as any,
      multiply: MultiplyNode as any,
      add: AddNode as any,
      subtract: SubtractNode as any,
      divide: DivideNode as any,
      clamp: ClampNode as any,
      saturate: SaturateNode as any,
      power: PowerNode as any,
      oneMinus: OneMinusNode as any,
      min: MinNode as any,
      max: MaxNode as any,
      abs: AbsNode as any,
      levels: LevelsNode as any,
      resize: ResizeNode as any,
      upscale: UpscaleNode as any,
      compare: CompareNode as any,
      seamCheck: SeamCheckNode as any,
      loadFolder: LoadFolderNode as any,
      normalize: NormalizeNode as any,
      forEach: ForEachNode as any,
      batchExport: BatchExportNode as any,
      textureOutput: TextureOutputNode as any,
      commentBox: CommentBoxNode as any,
      invert: InvertNode as any,
      normalFlip: NormalFlipNode as any,
      blend: BlendNode as any,
      normalBlend: NormalBlendNode as any,
    }),
    []
  );

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      dualMarching: DualMarchingAntsEdge,
      pulsingChannel: PulsingChannelEdge,
    }),
    []
  );

  // Snapshot current graph for Undo
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

  // Undo action
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
    setStatusMessage('Undo');
  }, [nodes, edges, setNodes, setEdges]);

  // Redo action
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
    setStatusMessage('Redo');
  }, [nodes, edges, setNodes, setEdges]);

  // Automatic semantic wire configuration based on source handle
  const getEdgeConfig = useCallback((sourceHandle?: string | null, targetHandle?: string | null) => {
    if (sourceHandle === 'rgba' || targetHandle === 'rgba') {
      return {
        type: 'dualMarching',
        style: { stroke: 'var(--pbr-packed)' },
      };
    }
    let strokeColor = 'var(--pbr-metal)';
    if (sourceHandle === 'r') strokeColor = 'var(--pbr-ao)';
    else if (sourceHandle === 'g') strokeColor = 'var(--pbr-rough)';
    else if (sourceHandle === 'b') strokeColor = 'var(--pbr-metal)';
    else if (sourceHandle === 'a') strokeColor = 'var(--pbr-height)';
    else if (sourceHandle === 'base' || targetHandle === 'base' || sourceHandle === 'detail' || targetHandle === 'detail') strokeColor = 'var(--pbr-normal)';
    else if (sourceHandle === 'mask' || targetHandle === 'mask') strokeColor = 'var(--pbr-scalar)';
    else if (sourceHandle === 'output' || targetHandle === 'output') strokeColor = 'var(--pbr-rough)';

    return {
      type: 'pulsingChannel',
      style: { stroke: strokeColor },
    };
  }, []);

  // Currently selected or inspected node
  const selectedNode = useMemo(() => {
    if (!activeNodeId) return null;
    return nodes.find((n) => n.id === activeNodeId) || null;
  }, [nodes, activeNodeId]);

  // Derive active buffer directly from evaluated graph or source buffer (strictly dynamic!)
  const activeBuffer = useMemo<TextureBuffer | null>(() => {
    if (!selectedNode) return null;
    return evaluatedBuffers[selectedNode.id] || sourceBuffers[selectedNode.id] || null;
  }, [selectedNode, evaluatedBuffers, sourceBuffers]);

  // Load benchmark textures and initialize live graph
  const loadBenchmarkTextures = useCallback(async () => {
    setStatusMessage('Loading Anthracite Concrete benchmark maps...');
    try {
      const loaded: Record<string, TextureBuffer> = {};
      for (const m of BENCHMARK_MAPS) {
        try {
          const buf = await PixelEngine.loadFromUrl(m.url);
          loaded[m.nodeId] = buf;
        } catch {
          loaded[m.nodeId] = PixelEngine.createSolid(512, 512, m.socket === 'r' ? 255 : 128, 128, 0, 255);
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

  const onConnect = useCallback(
    (params: Connection) => {
      const validation = GraphEvaluator.validateConnection(params, edges);
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
    [edges, getEdgeConfig, pushSnapshot, setEdges]
  );

  // Wire Reconnection & Drag-to-Disconnect handlers
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const validation = GraphEvaluator.validateConnection(
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
    [edges, getEdgeConfig, pushSnapshot, setEdges]
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
    [pushSnapshot, setEdges]
  );

  // Clean up connected edges when nodes are deleted
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
    [activeNodeId, pushSnapshot, setEdges]
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
    [pushSnapshot, setEdges]
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setActiveNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setActiveNodeId(null);
    setPalettePos(null);
  }, []);

  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    setPalettePos({ x: e.clientX, y: e.clientY });
  }, []);

  const isValidConnection = useCallback(
    (conn: Edge | Connection) => GraphEvaluator.validateConnection(conn, edges).isValid,
    [edges]
  );

  // Node spawning helper with Top-Center cursor alignment
  const spawnNode = useCallback(
    (typeKey: string, customPos?: { x: number; y: number }) => {
      pushSnapshot();
      const id = `node_${Date.now()}`;
      
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

      let newNode: Node;
      if (typeKey === 'channelPack' || typeKey === 'channelCombiner') {
        newNode = { id, type: 'channelPack', position: pos, data: { slot: 'ORM' } };
      } else if (typeKey === 'channelUnpack' || typeKey === 'channelSplitter') {
        newNode = { id, type: 'channelUnpack', position: pos, data: { channels: { r: 'R', g: 'G', b: 'B', a: 'A' } } };
      } else if (typeKey === 'channelMixer' || typeKey === 'channelSwizzle') {
        newNode = { id, type: 'channelMixer', position: pos, data: { rSrc: 'r', gSrc: 'g', bSrc: 'b', aSrc: 'a', exportOutputs: ['rgba'] } };
      } else if (typeKey === 'color' || typeKey === 'constantColor') {
        newNode = { id, type: 'color', position: pos, data: { color: '#f43f5e' } };
      } else if (typeKey === 'constantScalar') {
        newNode = { id, type: 'constantScalar', position: pos, data: { value: 1.0 } };
      } else if (typeKey === 'invert') {
        newNode = { id, type: 'invert', position: pos, data: {} };
      } else if (typeKey === 'levels') {
        newNode = { id, type: 'levels', position: pos, data: { blackPoint: 0, gamma: 1.0, whitePoint: 255, outBlack: 0, outWhite: 255, channel: 'all' } };
      } else if (typeKey === 'resize') {
        newNode = { id, type: 'resize', position: pos, data: { targetWidth: 1024, targetHeight: 1024, potMode: 'none', mode: 'preserve' } };
      } else if (typeKey === 'upscale') {
        newNode = { id, type: 'upscale', position: pos, data: { scale: 2, tileSize: 512 } };
      } else if (typeKey === 'compare') {
        newNode = { id, type: 'compare', position: pos, data: { mode: 'wipe', wipeProgress: 0.5, diffGain: 1.0 } };
      } else if (typeKey === 'seamCheck') {
        newNode = { id, type: 'seamCheck', position: pos, data: { repeats: 2, showBorders: true } };
      } else if (typeKey === 'loadFolder') {
        newNode = { id, type: 'loadFolder', position: pos, data: { folderName: 'Textures', recursive: true } };
      } else if (typeKey === 'normalize') {
        newNode = { id, type: 'normalize', position: pos, data: { cleanStem: true, flipGreen: true, deduplicate: true } };
      } else if (typeKey === 'forEach') {
        newNode = { id, type: 'forEach', position: pos, data: { filter: '*' } };
      } else if (typeKey === 'batchExport') {
        newNode = { id, type: 'batchExport', position: pos, data: { destinationFolder: 'Export/Textures', format: 'PNG', bitDepth: '8b', namingPattern: '{set}_{map}_{res}.{format}', collisionPolicy: 'rename' } };
      } else if (
        [
          'lerp',
          'multiply',
          'add',
          'subtract',
          'divide',
          'clamp',
          'saturate',
          'power',
          'oneMinus',
          'min',
          'max',
          'abs',
          'math',
        ].includes(typeKey)
      ) {
        newNode = { id, type: typeKey, position: pos, data: { op: typeKey } };
      } else if (typeKey === 'normalFlip') {
        newNode = { id, type: 'normalFlip', position: pos, data: {} };
      } else if (typeKey === 'normalBlend') {
        newNode = { id, type: 'normalBlend', position: pos, data: { detailStrength: 1.0 } };
      } else if (typeKey === 'blend') {
        newNode = { id, type: 'blend', position: pos, data: { mode: 'lerp', opacity: 1.0 } };
      } else if (typeKey === 'commentBox') {
        newNode = {
          id,
          type: 'commentBox',
          position: pos,
          style: { width: 340, height: 220, zIndex: -1 },
          data: { title: 'Comment Group', color: '#38bdf8' },
        };
      } else if (typeKey === 'textureOutput') {
        newNode = {
          id,
          type: 'textureOutput',
          position: pos,
          data: {
            title: 'Texture Output Target',
            slot: 'ORM',
            outputFilename: `T_${primaryAsset}_ORM.png`,
            format: 'PNG',
            bitDepth: '8b',
            colorSpace: 'linear',
            enabled: true,
            res: '4K',
          },
        };
      } else {
        newNode = {
          id,
          type: 'textureInput',
          position: pos,
          data: {
            title: 'Texture Input',
            role: 'Custom Map',
            roleColor: 'var(--pbr-metal)',
            res: '4K',
            previewUrl: '',
            channels: { r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha' },
          },
        };
      }

      setNodes((nds) => [...nds, newNode]);
      setActiveNodeId(newNode.id);
      setStatusMessage(`Spawned ${newNode.type} node`);
      return newNode;
    },
    [primaryAsset, pushSnapshot, screenToFlowPosition, setNodes]
  );

  // Load working Batch Pipeline: Load Folder → For Each → Normalize/Resize → Batch Export
  const loadBatchPipelineExample = useCallback(() => {
    pushSnapshot();
    const exampleNodes: Node[] = [
      {
        id: 'batch_load_folder',
        type: 'loadFolder',
        position: { x: -480, y: 150 },
        data: {
          title: 'Load Source Folder',
          folderName: 'Cobblestone_4K',
          itemCount: 4,
          setCount: 1,
          recursive: true,
        },
      },
      {
        id: 'batch_for_each',
        type: 'forEach',
        position: { x: -220, y: 150 },
        data: {
          title: 'For Each Texture',
          filter: '*',
        },
      },
      {
        id: 'batch_normalize',
        type: 'normalize',
        position: { x: 40, y: 70 },
        data: {
          title: 'Normalize PBR Stems',
          cleanStem: true,
          flipGreen: true,
          deduplicate: true,
        },
      },
      {
        id: 'batch_resize',
        type: 'resize',
        position: { x: 290, y: 70 },
        data: {
          title: 'Power-of-Two Resize',
          targetWidth: 2048,
          targetHeight: 2048,
          potMode: 'nearest',
          mode: 'preserve',
        },
      },
      {
        id: 'batch_export',
        type: 'batchExport',
        position: { x: 550, y: 150 },
        data: {
          title: 'Batch Export Target',
          destinationFolder: 'Export/Normalized',
          format: 'PNG',
          bitDepth: '8b',
          namingPattern: '{set}_{map}_{res}.{format}',
          collisionPolicy: 'rename',
        },
      },
    ];

    const exampleEdges: Edge[] = [
      {
        id: 'e_load_to_loop',
        source: 'batch_load_folder',
        sourceHandle: 'collection',
        target: 'batch_for_each',
        targetHandle: 'collection',
        type: 'dualMarching',
        style: { stroke: '#38bdf8' },
      },
      {
        id: 'e_loop_to_norm',
        source: 'batch_for_each',
        sourceHandle: 'item',
        target: 'batch_normalize',
        targetHandle: 'input',
        type: 'dualMarching',
        style: { stroke: '#ffffff' },
      },
      {
        id: 'e_norm_to_resize',
        source: 'batch_normalize',
        sourceHandle: 'output',
        target: 'batch_resize',
        targetHandle: 'input',
        type: 'dualMarching',
        style: { stroke: '#10b981' },
      },
      {
        id: 'e_resize_to_collect',
        source: 'batch_resize',
        sourceHandle: 'output',
        target: 'batch_for_each',
        targetHandle: 'collect',
        type: 'dualMarching',
        style: { stroke: '#38bdf8' },
      },
      {
        id: 'e_loop_to_export',
        source: 'batch_for_each',
        sourceHandle: 'collection',
        target: 'batch_export',
        targetHandle: 'collection',
        type: 'dualMarching',
        style: { stroke: '#8b5cf6' },
      },
    ];

    setNodes(exampleNodes);
    setEdges(exampleEdges);
    setActiveNodeId('batch_export');
    setStatusMessage('Loaded working Batch Pipeline: Load Folder → For Each → Normalize/Resize → Batch Export');
    setTimeout(() => fitView({ duration: 300 }), 50);
  }, [fitView, pushSnapshot, setEdges, setNodes]);

  // UE5 style Comment Box grouping (C Key)
  const spawnCommentBox = useCallback(() => {
    pushSnapshot();
    const id = `comment_${Date.now()}`;
    const targetNodes = nodes.filter((n) => (n.selected || n.id === activeNodeId) && n.type !== 'commentBox');

    let pos: { x: number; y: number };
    let size: { width: number; height: number };

    if (targetNodes.length > 0) {
      const minX = Math.min(...targetNodes.map((n) => n.position.x));
      const minY = Math.min(...targetNodes.map((n) => n.position.y));
      const maxX = Math.max(...targetNodes.map((n) => n.position.x + (Number(n.width) || 172)));
      const maxY = Math.max(...targetNodes.map((n) => n.position.y + (Number(n.height) || 180)));

      pos = { x: minX - 25, y: minY - 36 };
      size = { width: Math.max(220, maxX - minX + 50), height: Math.max(140, maxY - minY + 56) };
    } else if (canvasMousePosRef.current) {
      const flowPos = screenToFlowPosition(canvasMousePosRef.current);
      pos = { x: flowPos.x - 120, y: flowPos.y - 20 };
      size = { width: 340, height: 220 };
    } else {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      pos = { x: center.x - 120, y: center.y - 20 };
      size = { width: 340, height: 220 };
    }

    const newCommentNode: Node = {
      id,
      type: 'commentBox',
      position: pos,
      style: { width: size.width, height: size.height, zIndex: -1 },
      data: {
        title: targetNodes.length > 0 ? 'PBR Channel Group' : 'Comment Group',
        color: '#38bdf8',
      },
    };

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
    const matchesRole = (n: Node, roleKey: string) => {
      const d = n.data || {};
      const r = `${(d.detectedRole || '')} ${(d.role || '')}`.toLowerCase();
      if (roleKey === 'ao') return r.includes('ambient') || r.includes('ao') || r.includes('occlusion');
      if (roleKey === 'roughness') return r.includes('rough') || r.includes('gloss');
      if (roleKey === 'metallic') return r.includes('metal');
      if (roleKey === 'height') return r.includes('height') || r.includes('disp');
      return false;
    };

    const inputAo = nodes.find((n) => matchesRole(n, 'ao'));
    const inputRough = nodes.find((n) => matchesRole(n, 'roughness'));
    const inputMetal = nodes.find((n) => matchesRole(n, 'metallic'));
    const inputHeight = nodes.find((n) => matchesRole(n, 'height'));
    const combiner = nodes.find((n) => n.type === 'channelCombiner' || n.type === 'channelPack');
    const output = nodes.find((n) => n.type === 'textureOutput');

    if (!combiner) return;

    const newEdges: Edge[] = [];
    if (inputAo) newEdges.push({ id: `e_${inputAo.id}_r`, source: inputAo.id, sourceHandle: 'r', target: combiner.id, targetHandle: 'r', type: 'pulsingChannel', style: { stroke: 'var(--pbr-ao)' } });
    if (inputRough) newEdges.push({ id: `e_${inputRough.id}_g`, source: inputRough.id, sourceHandle: 'g', target: combiner.id, targetHandle: 'g', type: 'pulsingChannel', style: { stroke: 'var(--pbr-rough)' } });
    if (inputMetal) newEdges.push({ id: `e_${inputMetal.id}_b`, source: inputMetal.id, sourceHandle: 'b', target: combiner.id, targetHandle: 'b', type: 'pulsingChannel', style: { stroke: 'var(--pbr-metal)' } });
    if (inputHeight) newEdges.push({ id: `e_${inputHeight.id}_a`, source: inputHeight.id, sourceHandle: 'a', target: combiner.id, targetHandle: 'a', type: 'pulsingChannel', style: { stroke: 'var(--pbr-height)' } });
    if (output) newEdges.push({ id: `e_${combiner.id}_out`, source: combiner.id, sourceHandle: 'rgba', target: output.id, targetHandle: 'rgba', type: 'dualMarching', style: { stroke: 'var(--pbr-packed)' } });

    setEdges((prev) => [...prev.filter((e) => e.target !== combiner.id && e.source !== combiner.id), ...newEdges]);
    setStatusMessage('Auto-wired PBR channels into ORMH Combiner');
  }, [nodes, pushSnapshot, setEdges]);



  // Keyboard navigation & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing in inputs, textareas, or selects
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Ctrl + Z: Undo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl + Y or Ctrl + Shift + Z: Redo
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Tab: Toggle Quick Spawn Palette at mouse cursor
      if (e.key === 'Tab') {
        e.preventDefault();
        setPalettePos((prev) => {
          if (prev) return null;
          const mouseX = canvasMousePosRef.current?.x ?? window.innerWidth / 2;
          const mouseY = canvasMousePosRef.current?.y ?? window.innerHeight / 2;
          return { x: mouseX, y: mouseY };
        });
        return;
      }

      // 'F' Key: Focus Extents
      if (e.key === 'f' || e.key === 'F') {
        fitView({ duration: 300 });
        return;
      }

      // '?' or Shift + '/': Toggle Shortcuts Cheatsheet Modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Ctrl + E: Toggle Export Textures Hub Modal
      if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setIsExportModalOpen((prev) => !prev);
        return;
      }

      // 'W': Auto-wire PBR channels to ORMH Combiner
      if (e.key === 'w' || e.key === 'W') {
        autoWireORMH();
        return;
      }

      // 'C': Group selected nodes into Comment Box (or spawn at cursor)
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
        spawnCommentBox();
        return;
      }

      // 'D': Toggle Bypass / Mute on selected node (without Ctrl)
      if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        toggleBypassSelected();
        return;
      }

      // Ctrl + D: Duplicate selected node(s)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        pushSnapshot();
        setNodes((nds) => {
          const selectedNodes = nds.filter((n) => n.selected || n.id === activeNodeId);
          if (selectedNodes.length === 0) return nds;
          const duplicates = selectedNodes.map((n, i) => ({
            ...n,
            id: `node_${Date.now()}_${i}`,
            selected: true,
            position: { x: n.position.x + 40, y: n.position.y + 40 },
          }));
          setStatusMessage(`Duplicated ${duplicates.length} node(s)`);
          return [
            ...nds.map((n) => ({ ...n, selected: false })),
            ...duplicates,
          ];
        });
        return;
      }

      // Ctrl + A: Select all nodes
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setNodes((nds) => {
          setStatusMessage(`Selected all ${nds.length} nodes`);
          return nds.map((n) => ({ ...n, selected: true }));
        });
        return;
      }

      // Delete / Backspace: Delete selected node(s) and connected wires
      if (e.key === 'Delete' || e.key === 'Backspace') {
        pushSnapshot();
        setNodes((nds) => {
          const toDelete = nds.filter((n) => n.selected || n.id === activeNodeId);
          if (toDelete.length === 0) return nds;
          const idsToDelete = new Set(toDelete.map((n) => n.id));
          setEdges((eds) => eds.filter((ed) => !idsToDelete.has(ed.source) && !idsToDelete.has(ed.target)));
          setStatusMessage(`Deleted ${toDelete.length} node(s)`);
          return nds.filter((n) => !idsToDelete.has(n.id));
        });
        setActiveNodeId(null);
        return;
      }

      // Hotkey spawning (relative to mouse pointer via spawnNode)
      if (e.key === 't' || e.key === 'T') {
        spawnNode('textureInput');
      } else if (e.key === '1') {
        spawnNode('constantScalar');
      } else if (e.key === '3') {
        spawnNode('constantColor');
      } else if (e.key === 'm' || e.key === 'M') {
        spawnNode('channelCombiner');
      } else if (e.key === 's' || e.key === 'S') {
        spawnNode('channelSplitter');
      } else if (e.key === 'i' || e.key === 'I') {
        spawnNode('invert');
      } else if (e.key === 'l' || e.key === 'L') {
        spawnNode('levels');
      } else if (e.key === 'n' || e.key === 'N') {
        spawnNode('normalFlip');
      } else if (e.key === 'o' || e.key === 'O') {
        spawnNode('textureOutput');
      } else if (e.key === 'b' || e.key === 'B') {
        spawnNode('blend');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    fitView,
    spawnNode,
    spawnCommentBox,
    toggleBypassSelected,
    handleUndo,
    handleRedo,
    activeNodeId,
    autoWireORMH,
    pushSnapshot,
    setEdges,
    setNodes,
  ]);

  // Drag over handler for canvas
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Drop handler: Handles BOTH dragged nodes from Library AND dropped texture files from OS
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      // 1. Check for node drag from FloatingNodeLibrary
      const nodeTypeKey = e.dataTransfer.getData('application/reactflow') || e.dataTransfer.getData('text/plain');
      if (nodeTypeKey) {
        const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const alignedPos = { x: dropPos.x - 110, y: dropPos.y - 15 }; // Top-center alignment
        spawnNode(nodeTypeKey, alignedPos);
        return;
      }

      // 2. Check for image files dropped from disk
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/') || /\.(png|jpe?g|tga|webp|exr|tiff?)$/i.test(f.name)
      );

      if (files.length === 0) return;

      const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = LexicalNormalizer.normalizeFilename(file.name);
        let buf: TextureBuffer | undefined;
        try {
          buf = await PixelEngine.loadFromFile(file);
        } catch (err) {
          console.error(err);
        }

        const resLabel = buf
          ? buf.width >= 3840
            ? '4K'
            : buf.width >= 1920
            ? '2K'
            : '1K'
          : meta.resolution || '4K';

        const nodeId = `input_${Date.now()}_${i}`;
        const newNode: Node = {
          id: nodeId,
          type: 'textureInput',
          position: { x: dropPos.x - 86, y: dropPos.y - 12 + i * 210 },
          data: {
            title: meta.assetName ? `${meta.assetName} (${meta.roleLabel})` : `Input: ${meta.roleLabel}`,
            role: meta.roleLabel,
            detectedRole: meta.detectedRole,
            roleColor: meta.roleColor,
            colorSpace: meta.colorSpace,
            res: meta.resolution || resLabel,
            previewUrl: buf?.dataUrl || '',
            channels: meta.channels,
          },
        };

        setNodes((nds) => [...nds, newNode]);
        if (buf) {
          setSourceBuffers((prev) => ({ ...prev, [nodeId]: buf! }));
          setActiveNodeId(newNode.id);
        }
      }

      setStatusMessage(`Ingested ${files.length} texture(s) onto canvas`);
    },
    [screenToFlowPosition, setNodes, spawnNode]
  );

  // Asset name change
  const handleAssetChange = useCallback((newAsset: string) => {
    setPrimaryAsset(newAsset);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === 'textureOutput') {
          const slot = (n.data as any)?.slot || 'ORM';
          const format = ((n.data as any)?.formatOverride && (n.data as any)?.formatOverride !== 'inherit')
            ? (n.data as any)?.formatOverride.toLowerCase()
            : ((n.data as any)?.format || 'png').toLowerCase();
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
  }, [setNodes]);

  // Clear Graph with Undo safety
  const handleClearGraph = useCallback(() => {
    pushSnapshot();
    setNodes([]);
    setEdges([]);
    setActiveNodeId(null);
    setStatusMessage('Canvas cleared (Ctrl+Z to Undo)');
  }, [pushSnapshot, setEdges, setNodes]);

  // Export buffer
  const handleExport = useCallback((filename: string) => {
    if (activeBuffer) {
      PixelEngine.downloadBuffer(activeBuffer, filename);
      setStatusMessage(`Downloaded ${filename} successfully!`);
    }
  }, [activeBuffer]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Tactical DCC Workstation Top Header Bar */}
      <header
        style={{
          height: 38,
          backgroundColor: 'var(--bg-inset)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          zIndex: 30,
          userSelect: 'none',
        }}
      >
        {/* Left Branding: Strictly Minimalist Name & Batch Pipeline Example */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: "'Geist', sans-serif",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            TextureLAB
          </span>

          <button
            type="button"
            onClick={loadBatchPipelineExample}
            title="Load Example Pipeline: Load Folder → For Each → Normalize/Resize → Batch Export"
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 8.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
            }}
          >
            <FolderOpen size={10} />
            <span>Batch Pipeline Example</span>
          </button>

          <button
            type="button"
            onClick={loadBenchmarkTextures}
            title="Load Anthracite Concrete (Benchmark Maps)"
            style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#c084fc',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 8.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
            }}
          >
            <Sparkles size={10} />
            <span>Load Benchmark</span>
          </button>
        </div>

        {/* Right Toolbar Controls: 1:1 Square Icon-Only Buttons with Rich Hover Tooltip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Undo */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="tactical-tool-btn"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Undo</span>
                <span className="tactical-tooltip-badge">Ctrl+Z</span>
              </div>
              <span className="tactical-tooltip-desc">Revert last graph change</span>
            </div>
          </div>

          {/* Redo */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="tactical-tool-btn"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Redo</span>
                <span className="tactical-tooltip-badge">Ctrl+Y</span>
              </div>
              <span className="tactical-tooltip-desc">Reapply undone change</span>
            </div>
          </div>

          {/* Comment Box */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={spawnCommentBox}
              className="tactical-tool-btn"
              title="Comment Box (C)"
            >
              <MessageSquare size={13} color="#38bdf8" />
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Comment Box</span>
                <span className="tactical-tooltip-badge">C</span>
              </div>
              <span className="tactical-tooltip-desc">Enclose selected nodes in comment frame</span>
            </div>
          </div>

          {/* Global Export Button */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="tactical-tool-btn"
              title="Export Textures Hub (Ctrl+E)"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80',
                width: 'auto',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 700,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.28)';
                e.currentTarget.style.borderColor = '#4ade80';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.35)';
              }}
            >
              <Download size={12} strokeWidth={2.5} />
              <span style={{ fontSize: 9.5 }}>Export</span>
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Export Hub</span>
                <span className="tactical-tooltip-badge">Ctrl+E</span>
              </div>
              <span className="tactical-tooltip-desc">Batch export graph textures with token naming</span>
            </div>
          </div>

          <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Shortcuts */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="tactical-tool-btn"
              title="Shortcuts (?)"
            >
              <Keyboard size={13} color="#a855f7" />
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Keybindings</span>
                <span className="tactical-tooltip-badge">?</span>
              </div>
              <span className="tactical-tooltip-desc">View keyboard shortcut cheatsheet</span>
            </div>
          </div>

          {/* Focus */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={() => fitView({ duration: 300 })}
              className="tactical-tool-btn"
              title="Focus Extents (F)"
            >
              <Maximize2 size={13} color="#38bdf8" />
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Focus View</span>
                <span className="tactical-tooltip-badge">F</span>
              </div>
              <span className="tactical-tooltip-desc">Fit all nodes to screen</span>
            </div>
          </div>

          {/* Clear */}
          <div className="tactical-btn-wrapper">
            <button
              onClick={handleClearGraph}
              className="tactical-tool-btn danger"
              title="Clear Canvas (Del)"
            >
              <Trash2 size={13} color="#f87171" />
            </button>
            <div className="tactical-tooltip">
              <div className="tactical-tooltip-header">
                <span className="tactical-tooltip-title">Clear Graph</span>
                <span className="tactical-tooltip-badge">Delete</span>
              </div>
              <span className="tactical-tooltip-desc">Remove all nodes and connections</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main 100vw x 100vh Canvas Area with Floating HUD Panels */}
      <NodeBufferContext.Provider value={nodeBufferContextValue}>
        <div
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          onMouseMove={(e) => {
            canvasMousePosRef.current = { x: e.clientX, y: e.clientY };
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnectStart={onReconnectStart}
            onReconnect={onReconnect}
            onReconnectEnd={onReconnectEnd}
            onEdgeClick={onEdgeClick}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={handlePaneContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            onNodesDelete={onNodesDelete}
            fitView
            panOnScrollMode={PanOnScrollMode.Free}
            panOnDrag={[1, 2]} // Middle click or Right click pan (UE5)
            selectionOnDrag={true}
            connectionRadius={40}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="rgba(255, 255, 255, 0.08)" />
          </ReactFlow>

          {/* Minimalist Tactical Canvas Status Pill (DCC Workstation Telemetry) */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              backgroundColor: 'rgba(13, 16, 23, 0.88)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              fontSize: 9.5,
              fontFamily: "'Geist Mono', monospace",
              color: '#94a3b8',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}
          >
            {/* Zoom Level & Fit Button */}
            <button
              type="button"
              onClick={() => fitView({ duration: 250 })}
              title="Click to Reset View (Fit Extents / F)"
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 8.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
              }}
            >
              <Maximize2 size={9} />
              <span>{Math.round(zoom * 100)}%</span>
            </button>

            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>

            {/* Node & Wire Telemetry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>{nodes.length} Nodes</span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ color: '#cbd5e1' }}>{edges.length} Wires</span>
            </div>

            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>

            {/* Tactical Engine Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8.5 }}>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                }}
              />
              <span style={{ color: '#94a3b8', letterSpacing: '0.02em' }}>{statusMessage}</span>
            </div>
          </div>

          {/* Floating Left Panel: Categorized Node Library */}
          <FloatingNodeLibrary onSpawnNode={(typeKey) => spawnNode(typeKey)} />

          {/* Floating Right Panel: Node Details & Viewport */}
          <FloatingDetailsPanel
            selectedNode={selectedNode}
            nodes={nodes}
            primaryAsset={primaryAsset}
            onAssetChange={handleAssetChange}
            activeBuffer={activeBuffer}
            edges={edges}
            onUpdateNodeData={handleUpdateNodeData}
            onExportTarget={handleExport}
          />

          {/* Searchable Spawn Palette on Tab or Right-Click */}
          {palettePos && (
            <SpawnPalette
              x={palettePos.x}
              y={palettePos.y}
              onSelectNode={(typeKey) => {
                const pos = screenToFlowPosition({ x: palettePos.x, y: palettePos.y });
                spawnNode(typeKey, { x: pos.x - 86, y: pos.y - 12 });
              }}
              onClose={() => setPalettePos(null)}
            />
          )}

          {/* Keyboard Shortcuts Cheatsheet Modal */}
          <ShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />

          {/* Global Substance-Style Export Hub Modal */}
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            nodes={nodes}
            edges={edges}
            evaluatedBuffers={evaluatedBuffers}
            primaryAsset={primaryAsset}
            onAssetChange={handleAssetChange}
            onUpdateNodeData={handleUpdateNodeData}
            onExportComplete={(msg) => setStatusMessage(msg)}
          />
        </div>
      </NodeBufferContext.Provider>
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
