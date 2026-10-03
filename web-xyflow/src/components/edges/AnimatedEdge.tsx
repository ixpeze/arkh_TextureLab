import React from 'react';
import { getBezierPath, type EdgeProps } from '@xyflow/react';

export interface CustomEdgeData {
  channelType?: 'rgba' | 'r' | 'g' | 'b' | 'a' | 'scalar';
  color?: string;
  wireStyle?: 'dual-marching' | 'triple-marching' | 'pulsing-single' | 'dotted';
}

/**
 * Dual Line with Marching Ants Animation (Used for RGBA composite streams)
 */
export const DualMarchingAntsEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) => {
  // Offset paths by +/- 3px for genuine dual-rail wires
  const [pathTop] = getBezierPath({
    sourceX,
    sourceY: sourceY - 3,
    sourcePosition,
    targetX,
    targetY: targetY - 3,
    targetPosition,
    curvature: 0.25,
  });

  const [pathBottom] = getBezierPath({
    sourceX,
    sourceY: sourceY + 3,
    sourcePosition,
    targetX,
    targetY: targetY + 3,
    targetPosition,
    curvature: 0.25,
  });

  const [centerPath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const strokeColor = (style?.stroke as string) || '#a855f7'; // NanoFlow purple default for composite

  return (
    <g className={`react-flow__edge-custom ${selected ? 'selected' : ''}`}>
      {/* Invisible thicker hit-box path for easy clicking / selecting */}
      <path
        d={centerPath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="react-flow__edge-interaction"
      />

      {/* Subtle background glow rail */}
      <path
        d={centerPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 8 : 6}
        strokeOpacity={0.15}
        strokeLinecap="round"
      />

      {/* Rail 1: Top Track */}
      <path
        id={`${id}_top`}
        d={pathTop}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeOpacity={0.85}
        className="marching-ants-path"
      />

      {/* Rail 2: Bottom Track */}
      <path
        id={`${id}_bottom`}
        d={pathBottom}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeOpacity={0.85}
        className="marching-ants-path"
        markerEnd={markerEnd}
      />
    </g>
  );
};

/**
 * Pulsing Single Channel Edge (Used for R, G, B, A, Scalar channels)
 */
export const PulsingChannelEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const strokeColor = (style?.stroke as string) || '#38bdf8';

  return (
    <g className={`react-flow__edge-custom ${selected ? 'selected' : ''}`}>
      {/* Invisible click hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="react-flow__edge-interaction"
      />

      {/* Base wire track */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 2.5 : 1.8}
        strokeOpacity={0.4}
        strokeLinecap="round"
      />

      {/* Animated directional pulsing dash */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 2.5 : 1.8}
        strokeDasharray="4 6"
        className="channel-flow-path"
        strokeLinecap="round"
        markerEnd={markerEnd}
      />
    </g>
  );
};
