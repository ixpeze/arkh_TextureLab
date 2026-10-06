// src/components/edges/AnimatedEdge.tsx
import React, { useState } from 'react';
import { getBezierPath, type EdgeProps } from '@xyflow/react';

export interface CustomEdgeData {
  channelType?: 'rgba' | 'r' | 'g' | 'b' | 'a' | 'scalar';
  color?: string;
  wireStyle?: 'dual-marching' | 'pulsing-single';
  isRecomputing?: boolean;
}

/**
 * Static 1.5px wire by default; 2.5px amber when hovered/selected;
 * Animates (dashes) ONLY when selected or recomputing.
 * No drop-shadow filter (closes F-17, satisfies P5-T3).
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
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const [centerPath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const baseColor = (style?.stroke as string) || 'var(--pbr-packed, #B79CF5)';
  const activeColor = 'var(--accent, #FFB02E)';
  const isHighlighted = selected || isHovered;
  const strokeColor = isHighlighted ? activeColor : baseColor;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const isAnimated = selected || Boolean((data as CustomEdgeData)?.isRecomputing);

  return (
    <g
      className={`react-flow__edge-custom ${selected ? 'selected' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible thicker hit-box path for easy clicking / selecting */}
      <path
        d={centerPath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="react-flow__edge-interaction"
      />

      {/* Static clean wire (P5-T3) */}
      <path
        id={id}
        d={centerPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={isHighlighted ? 1 : 0.85}
        strokeLinecap="round"
        className={isAnimated ? 'marching-ants-path' : ''}
        markerEnd={markerEnd}
      />
    </g>
  );
};

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
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const baseColor = (style?.stroke as string) || 'var(--info, #5CC8E8)';
  const activeColor = 'var(--accent, #FFB02E)';
  const isHighlighted = selected || isHovered;
  const strokeColor = isHighlighted ? activeColor : baseColor;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const isAnimated = selected || Boolean((data as CustomEdgeData)?.isRecomputing);

  return (
    <g
      className={`react-flow__edge-custom ${selected ? 'selected' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible click hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="react-flow__edge-interaction"
      />

      {/* Single clean wire */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={isHighlighted ? 1 : 0.85}
        strokeLinecap="round"
        strokeDasharray={isAnimated ? '4 6' : undefined}
        className={isAnimated ? 'channel-flow-path' : ''}
        markerEnd={markerEnd}
      />
    </g>
  );
};
