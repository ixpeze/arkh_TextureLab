import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  PanOnScrollMode,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, Node, NodeTypes, EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Maximize2,
  Trash2,
  Keyboard,
} from 'lucide-react';

import { TextureInputNode } from './components/nodes/TextureInputNode';
import { ChannelCombinerNode } from './components/nodes/ChannelCombinerNode';
import { ChannelSplitterNode } from './components/nodes/ChannelSplitterNode';
import { InvertNode } from './components/nodes/InvertNode';
import { LevelsNode } from './components/nodes/LevelsNode';
import { NormalFlipNode } from './components/nodes/NormalFlipNode';
import { TextureOutputNode } from './components/nodes/TextureOutputNode';
import { ConstantScalarNode } from './components/nodes/ConstantScalarNode';
import { ConstantColorNode } from './components/nodes/ConstantColorNode';

import { DualMarchingAntsEdge, PulsingChannelEdge } from './components/edges/AnimatedEdge';
import { FloatingNodeLibrary } from './components/FloatingNodeLibrary';
import { FloatingDetailsPanel } from './components/FloatingDetailsPanel';
import { SpawnPalette } from './components/SpawnPalette';
import { ShortcutsModal } from './components/ShortcutsModal';

import { PixelEngine, type TextureBuffer } from './engine/pixelEngine';
import { LexicalNormalizer } from './engine/normalizer';

const BENCHMARK_MAPS = [
  {
    role: 'Ambient Occlusion',
    roleKey: 'ao',
    url: '/sample_textures/anthracite smooth cast concrete ambientocclusion 4k.png',
    socket: 'r',
    color: 'var(--pbr-ao)',
  },
  {
    role: 'Roughness',
    roleKey: 'rough',
    url: '/sample_textures/anthracite smooth cast concrete roughness 4k.png',
    socket: 'g',
    color: 'var(--pbr-rough)',
  },
  {
    role: 'Metallic',
    roleKey: 'metal',
    url: '/sample_textures/anthracite smooth cast concrete metallic 4k.png',
    socket: 'b',
    color: 'var(--pbr-metal)',
  },
  {
    role: 'Height',
    roleKey: 'height',
    url: '/sample_textures/anthracite smooth cast concrete height 4k.png',
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
      previewUrl: '/sample_textures/anthracite smooth cast concrete ambientocclusion 4k.png',
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
      previewUrl: '/sample_textures/anthracite smooth cast concrete roughness 4k.png',
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
      previewUrl: '/sample_textures/anthracite smooth cast concrete metallic 4k.png',
      channels: { r: 'Metallic', g: 'Metallic', b: 'Metallic', a: '1.0' },
    },
  },
  {
    id: 'combiner_ormh',
    type: 'channelCombiner',
    position: { x: 30, y: 230 },
    data: {},
  },
  {
    id: 'output_ormh',
    type: 'textureOutput',
    position: { x: 360, y: 230 },
    data: {
      title: 'Texture Output Target',
      outputFilename: 'T_Anthracite_Concrete_ORMH.png',
      format: 'PNG',
      bitDepth: '8b',
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

  // Mouse cursor tracking on canvas
  const canvasMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Live in-memory buffers
  const [buffers, setBuffers] = useState<Record<string, TextureBuffer>>({});
  const [activeBuffer, setActiveBuffer] = useState<TextureBuffer | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ready | Drag nodes from Library or drop textures onto canvas');

  const { screenToFlowPosition, fitView } = useReactFlow();

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      textureInput: TextureInputNode as any,
      channelCombiner: ChannelCombinerNode as any,
      channelSplitter: ChannelSplitterNode as any,
      invert: InvertNode as any,
      levels: LevelsNode as any,
      normalFlip: NormalFlipNode as any,
      textureOutput: TextureOutputNode as any,
      constantScalar: ConstantScalarNode as any,
      constantColor: ConstantColorNode as any,
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

  // Sync active buffer when inspected node changes
  useEffect(() => {
    if (!selectedNode) return;
    if (buffers[selectedNode.id]) {
      setActiveBuffer(buffers[selectedNode.id]);
    } else if (buffers['packed_ormh'] && (selectedNode.type === 'channelCombiner' || selectedNode.type === 'textureOutput')) {
      setActiveBuffer(buffers['packed_ormh']);
    }
  }, [selectedNode, buffers]);

  // Load benchmark textures and compute initial merged buffer
  const loadBenchmarkTextures = useCallback(async () => {
    setStatusMessage('Loading Anthracite Concrete 4K maps...');
    try {
      const loaded: Record<string, TextureBuffer> = {};
      for (const m of BENCHMARK_MAPS) {
        try {
          const buf = await PixelEngine.loadFromUrl(m.url);
          loaded[m.roleKey] = buf;
        } catch {
          loaded[m.roleKey] = PixelEngine.createSolid(512, 512, m.socket === 'r' ? 255 : 128, 128, 0, 255);
        }
      }

      // Merge into ORMH buffer
      const packed = PixelEngine.combineChannels(
        loaded['ao'],
        loaded['rough'],
        loaded['metal'],
        loaded['height'],
        1024
      );

      loaded['packed_ormh'] = packed;
      setBuffers(loaded);
      setActiveBuffer(packed);
      setStatusMessage('Loaded 4K benchmark maps & computed ORMH buffer');
    } catch (err) {
      console.error(err);
      setStatusMessage('Benchmark ready');
    }
  }, []);

  useEffect(() => {
    loadBenchmarkTextures();
  }, [loadBenchmarkTextures]);

  const onConnect = useCallback(
    (params: Connection) => {
      const cfg = getEdgeConfig(params.sourceHandle, params.targetHandle);
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...cfg,
          },
          eds
        )
      );
    },
    [getEdgeConfig, setEdges]
  );

  // UE5 Alt + Click wire cutting
  const onEdgeClick = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      if (e.altKey) {
        setEdges((eds) => eds.filter((ed) => ed.id !== edge.id));
      }
    },
    [setEdges]
  );

  // Node spawning helper with Top-Center cursor alignment
  const spawnNode = useCallback(
    (typeKey: string, customPos?: { x: number; y: number }) => {
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
      if (typeKey === 'channelCombiner') {
        newNode = { id, type: 'channelCombiner', position: pos, data: {} };
      } else if (typeKey === 'channelSplitter') {
        newNode = { id, type: 'channelSplitter', position: pos, data: {} };
      } else if (typeKey === 'invert') {
        newNode = { id, type: 'invert', position: pos, data: {} };
      } else if (typeKey === 'levels') {
        newNode = { id, type: 'levels', position: pos, data: { blackPoint: 0, gamma: 1.0, whitePoint: 255 } };
      } else if (typeKey === 'normalFlip') {
        newNode = { id, type: 'normalFlip', position: pos, data: {} };
      } else if (typeKey === 'constantScalar') {
        newNode = { id, type: 'constantScalar', position: pos, data: { value: 1.0 } };
      } else if (typeKey === 'constantColor') {
        newNode = { id, type: 'constantColor', position: pos, data: { color: '#f43f5e' } };
      } else if (typeKey === 'textureOutput') {
        newNode = {
          id,
          type: 'textureOutput',
          position: pos,
          data: {
            title: 'Texture Output Target',
            outputFilename: `T_${primaryAsset}_ORMH.png`,
            format: 'PNG',
            bitDepth: '8b',
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
    [primaryAsset, screenToFlowPosition, setNodes]
  );

  // Auto-Wire ORMH Combiner
  const autoWireORMH = useCallback(() => {
    const inputAo = nodes.find((n) => n.data?.role === 'Ambient Occlusion');
    const inputRough = nodes.find((n) => n.data?.role === 'Roughness');
    const inputMetal = nodes.find((n) => n.data?.role === 'Metallic');
    const inputHeight = nodes.find((n) => n.data?.role === 'Height / Displacement' || n.data?.role === 'Height');
    const combiner = nodes.find((n) => n.type === 'channelCombiner');
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
  }, [nodes, setEdges]);

  // Keyboard navigation & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing in inputs, textareas, or selects
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
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

      // 'W': Auto-wire PBR channels to ORMH Combiner
      if (e.key === 'w' || e.key === 'W') {
        autoWireORMH();
        return;
      }

      // Ctrl + D: Duplicate selected node(s)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitView, spawnNode, activeNodeId, autoWireORMH, setEdges, setNodes]);

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

        const nodeId = `input_${Date.now()}_${i}`;
        const newNode: Node = {
          id: nodeId,
          type: meta.isPacked ? 'channelSplitter' : 'textureInput',
          position: { x: dropPos.x - 86, y: dropPos.y - 12 + i * 190 },
          data: {
            title: `Input: ${meta.roleLabel}`,
            role: meta.roleLabel,
            roleColor: meta.roleColor,
            res: meta.resolution || '4K',
            previewUrl: buf?.dataUrl || '',
            channels: meta.channels,
          },
        };

        setNodes((nds) => [...nds, newNode]);
        if (buf) {
          setBuffers((prev) => ({ ...prev, [nodeId]: buf! }));
          setActiveBuffer(buf);
          setActiveNodeId(newNode.id);
        }
      }

      setStatusMessage(`Ingested ${files.length} texture(s) onto canvas`);
    },
    [screenToFlowPosition, setNodes, spawnNode]
  );

  // Update node data (sliders, inputs, renames) from Details Panel
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

  // Asset name change
  const handleAssetChange = useCallback((newAsset: string) => {
    setPrimaryAsset(newAsset);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === 'textureOutput') {
          return {
            ...n,
            data: {
              ...n.data,
              outputFilename: `T_${newAsset}_ORMH.png`,
            },
          };
        }
        return n;
      })
    );
  }, [setNodes]);

  // Clear Graph
  const handleClearGraph = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setActiveNodeId(null);
    setActiveBuffer(null);
    setStatusMessage('Canvas cleared');
  }, [setNodes, setEdges]);


  // Export buffer
  const handleExport = useCallback((filename: string) => {
    if (activeBuffer) {
      PixelEngine.downloadBuffer(activeBuffer, filename);
      setStatusMessage(`Downloaded ${filename} successfully!`);
    }
  }, [activeBuffer]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Minimal Top Header Bar: Strictly "TextureLAB" NanoFlow Dark Studio */}
      <header
        style={{
          height: 38,
          backgroundColor: 'var(--bg-inset)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 30,
          userSelect: 'none',
        }}
      >
        {/* Left Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: "'Geist', sans-serif",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.06em',
              background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            TextureLAB
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: '#a855f7',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            NanoFlow v1.0
          </span>
        </div>

        {/* Right Status & Utility Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {statusMessage}
          </span>

          <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard Shortcuts Cheatsheet (?)"
            style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#d8b4fe',
              borderRadius: 6,
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
              e.currentTarget.style.color = '#d8b4fe';
            }}
          >
            <Keyboard size={12} color="#a855f7" />
            <span>Shortcuts (?)</span>
          </button>

          <button
            onClick={() => fitView({ duration: 300 })}
            title="Focus Extents (F)"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              color: '#cbd5e1',
              borderRadius: 6,
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            <Maximize2 size={12} color="#38bdf8" />
            <span>Focus (F)</span>
          </button>

          <button
            onClick={handleClearGraph}
            title="Clear All Nodes and Edges"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              borderRadius: 6,
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
          >
            <Trash2 size={12} />
            <span>Clear Graph</span>
          </button>
        </div>
      </header>

      {/* Main 100vw x 100vh Canvas Area with Floating HUD Panels */}
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
          onEdgeClick={onEdgeClick}
          onNodeClick={(_, node) => {
            setActiveNodeId(node.id);
          }}
          onPaneClick={() => {
            setActiveNodeId(null);
            setPalettePos(null);
          }}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            setPalettePos({ x: e.clientX, y: e.clientY });
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          panOnScrollMode={PanOnScrollMode.Free}
          panOnDrag={[1, 2]} // Middle click or Right click pan (UE5)
          selectionOnDrag={true}
          connectionRadius={40}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="rgba(255, 255, 255, 0.08)" />
          <Controls style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6 }} />
          <MiniMap
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}
            nodeColor={() => '#a855f7'}
          />
        </ReactFlow>

        {/* Floating Left Panel: Categorized Node Library */}
        <FloatingNodeLibrary onSpawnNode={(typeKey) => spawnNode(typeKey)} />

        {/* Floating Right Panel: Node Details & Viewport */}
        <FloatingDetailsPanel
          selectedNode={selectedNode}
          primaryAsset={primaryAsset}
          onAssetChange={handleAssetChange}
          activeBuffer={activeBuffer}
          onUpdateNodeData={handleUpdateNodeData}
          onExportTarget={handleExport}
          onLoadBenchmark={loadBenchmarkTextures}
          onAutoWireORMH={autoWireORMH}
          nodeCount={nodes.length}
          edgeCount={edges.length}
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
      </div>
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
