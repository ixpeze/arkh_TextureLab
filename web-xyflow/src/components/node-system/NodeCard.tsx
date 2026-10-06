// src/components/node-system/NodeCard.tsx
import React from 'react';
import { useViewport } from '@xyflow/react';

export interface NodeCardProps {
  selected?: boolean;
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  headerAction?: React.ReactNode;
  width?: number | string;
  minWidth?: number;
  isBypassed?: boolean;
  nodeId?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

function useSafeZoom(): number {
  const vp = useViewport();
  return vp?.zoom ?? 1;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  selected = false,
  title,
  icon,
  accentColor = 'var(--accent)',
  headerAction,
  width = 176,
  minWidth = 150,
  isBypassed = false,
  className = '',
  style = {},
  children,
}) => {
  const zoom = useSafeZoom();
  const isBlockLod = zoom < 0.35;
  const isCompactLod = zoom < 0.6;

  const lodClass = isBlockLod
    ? 'tl-node-card--block'
    : isCompactLod
    ? 'tl-node-card--compact'
    : 'tl-node-card--full';

  const selectedClass = selected ? 'tl-node-card--selected' : '';
  const bypassedClass = isBypassed ? 'tl-node-card--bypassed' : '';

  const dynamicCardStyle: React.CSSProperties = {
    width: isBlockLod ? 120 : width,
    minWidth: isBlockLod ? 100 : minWidth,
    ...style,
  };

  return (
    <div
      className={`tl-node-card ${lodClass} ${selectedClass} ${bypassedClass} ${className}`.trim()}
      style={dynamicCardStyle}
      data-testid="node-card"
      data-lod={isBlockLod ? 'block' : isCompactLod ? 'compact' : 'full'}
    >
      {/* 2px Category Color Accent Bar (P5-T2) */}
      <div
        className="tl-node-card__category-bar"
        style={{ backgroundColor: isBypassed ? 'var(--danger)' : accentColor }}
      />

      {/* Node Header */}
      <div className="tl-node-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          {icon && !isBlockLod && (
            <div style={{ color: isBypassed ? 'var(--danger)' : accentColor, display: 'flex', alignItems: 'center' }}>
              {icon}
            </div>
          )}

          <span className="tl-node-card__title" title={title}>
            {title}
          </span>

          {isBypassed && !isBlockLod && (
            <span className="tl-node-card__muted-chip">MUTED</span>
          )}
        </div>

        {!isBlockLod && headerAction && <div>{headerAction}</div>}
      </div>

      {/* 6% Diagonal Hatch Overlay for Bypassed Nodes (P5-T2) */}
      {isBypassed && <div className="tl-node-card__hatch" />}

      {/* Node Body with Controls & Sockets */}
      <div className="tl-node-card__body">{children}</div>
    </div>
  );
};
