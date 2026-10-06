import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';

import { DualMarchingAntsEdge, PulsingChannelEdge } from '../components/edges/AnimatedEdge';
import { SpawnPalette } from '../components/SpawnPalette';
import { nodeRegistry } from '../nodes/registry';
import { NodeBufferContext, type NodeBufferContextType } from '../context/NodeBufferContext';

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
  palettePos: { x: number; y: number } | null;
  setPalettePos: (pos: { x: number; y: number } | null) => void;
  spawnNode: (typeKey: string, customPos?: { x: number; y: number }) => void;
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
  palettePos,
  setPalettePos,
  spawnNode,
  nodeBufferContextValue,
}) => {
  const { screenToFlowPosition } = useReactFlow();

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
        className="tl-workstation__canvas-wrap"
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
          connectionLineStyle={{ stroke: '#FFB02E', strokeWidth: 1.5 }}
          defaultEdgeOptions={{ type: 'pulsingChannel' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1.2}
            color="rgba(255, 255, 255, 0.05)"
          />
        </ReactFlow>

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
      </div>
    </NodeBufferContext.Provider>
  );
};
