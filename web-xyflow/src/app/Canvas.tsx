import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import { Maximize2 } from 'lucide-react';

import { DualMarchingAntsEdge, PulsingChannelEdge } from '../components/edges/AnimatedEdge';
import { FloatingNodeLibrary } from '../components/FloatingNodeLibrary';
import { FloatingDetailsPanel } from '../components/FloatingDetailsPanel';
import { SpawnPalette } from '../components/SpawnPalette';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { ExportModal } from '../components/ExportModal';

import { nodeRegistry } from '../nodes/registry';
import { NodeBufferContext, type NodeBufferContextType } from '../context/NodeBufferContext';
import type { TextureBuffer } from '../engine/pixelEngine';

export interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeDragStart?: OnNodeDrag<Node>;
  onNodeDragStop?: OnNodeDrag<Node>;
  onConnect: (connection: Connection) => void;
  onReconnectStart: () => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  onReconnectEnd: (event: MouseEvent | TouchEvent, edge: Edge) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onPaneContextMenu: (event: MouseEvent | React.MouseEvent) => void;
  canvasMousePosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  statusMessage: string;
  setStatusMessage: (msg: string) => void;
  selectedNode: Node | null;
  activeBuffer: TextureBuffer | null;
  primaryAsset: string;
  onAssetChange: (asset: string) => void;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  onExportTarget: (filename: string) => void;
  palettePos: { x: number; y: number } | null;
  setPalettePos: (pos: { x: number; y: number } | null) => void;
  spawnNode: (typeKey: string, customPos?: { x: number; y: number }) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  evaluatedBuffers: Record<string, TextureBuffer>;
  nodeBufferContextValue: NodeBufferContextType;
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeDragStart,
  onNodeDragStop,
  onConnect,
  onReconnectStart,
  onReconnect,
  onReconnectEnd,
  onEdgeClick,
  onNodeClick,
  onPaneClick,
  onPaneContextMenu,
  canvasMousePosRef,
  onDragOver,
  onDrop,
  statusMessage,
  setStatusMessage,
  selectedNode,
  activeBuffer,
  primaryAsset,
  onAssetChange,
  onUpdateNodeData,
  onExportTarget,
  palettePos,
  setPalettePos,
  spawnNode,
  isShortcutsOpen,
  setIsShortcutsOpen,
  isExportModalOpen,
  setIsExportModalOpen,
  evaluatedBuffers,
  nodeBufferContextValue,
}) => {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const nodeTypes: NodeTypes = useMemo(() => nodeRegistry.getNodeTypes(), []);

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      dualMarching: DualMarchingAntsEdge,
      pulsingChannel: PulsingChannelEdge,
    }),
    []
  );

  return (
    <NodeBufferContext.Provider value={nodeBufferContextValue}>
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onMouseMove={(e) => {
          canvasMousePosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <ReactFlow
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
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll
          zoomOnPinch
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          snapToGrid
          snapGrid={[16, 16]}
          connectionLineStyle={{ stroke: '#38bdf8', strokeWidth: 2 }}
          defaultEdgeOptions={{ type: 'pulsingChannel' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1.2}
            color="rgba(255, 255, 255, 0.05)"
          />
        </ReactFlow>

        {/* Tactical DCC Bottom Telemetry HUD */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'rgba(10, 12, 18, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '4px 10px',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => fitView({ duration: 300 })}
            title="Reset Zoom to 100% (Fit View)"
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 4,
              color: '#38bdf8',
              padding: '2px 6px',
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
          onAssetChange={onAssetChange}
          activeBuffer={activeBuffer}
          edges={edges}
          onUpdateNodeData={onUpdateNodeData}
          onExportTarget={onExportTarget}
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
          onAssetChange={onAssetChange}
          onUpdateNodeData={onUpdateNodeData}
          onExportComplete={(msg) => setStatusMessage(msg)}
        />
      </div>
    </NodeBufferContext.Provider>
  );
};
