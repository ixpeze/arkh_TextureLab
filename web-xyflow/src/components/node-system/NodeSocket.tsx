import React, { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';

export type SocketShape = 'circle' | 'diamond' | 'square';

export interface NodeSocketProps {
  id: string;
  type: 'target' | 'source';
  label: string;
  color?: string;
  shape?: SocketShape;
  secondaryText?: string;
  fullWidth?: boolean;
  isSection?: boolean;
  sectionTag?: string;
  style?: React.CSSProperties;
}

/**
 * Standard Node Socket with Node-to-Node Border Handle Anchoring & Full-Row Click-to-Connect.
 * Wires attach strictly to the left or right border pin (node-to-node).
 * Clicking or dragging anywhere across the horizontal row initiates the wire drag from the handle.
 */
export const NodeSocket: React.FC<NodeSocketProps> = ({
  id,
  type,
  label,
  color = '#38bdf8',
  shape = 'circle',
  secondaryText,
  fullWidth = true,
  isSection = false,
  sectionTag,
  style = {},
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const isInput = type === 'target';
  const handlePosition = isInput ? Position.Left : Position.Right;

  const shapeClass =
    shape === 'diamond'
      ? 'handle-diamond'
      : shape === 'square'
      ? 'handle-square'
      : 'handle-circle';

  // Forward clicks anywhere across the horizontal row to the border handle
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!handleRef.current) return;
    if (e.target === handleRef.current) return;

    e.stopPropagation();
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
      buttons: e.buttons,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      isPrimary: e.isPrimary,
    });
    handleRef.current.dispatchEvent(event);
  };

  return (
    <div
      className={`node-socket-row ${isSection ? 'is-section-row' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isSection ? 'space-between' : isInput ? 'flex-start' : 'flex-end',
        flexDirection: isInput ? 'row' : 'row-reverse',
        height: isSection ? 22 : 19,
        position: 'relative',
        margin: fullWidth ? (isSection ? '3px -7px' : '0 -7px') : '0',
        paddingLeft: isInput ? 10 : 8,
        paddingRight: isInput ? 8 : 10,
        backgroundColor: isSection
          ? isHovered
            ? `${color}25`
            : `${color}0e`
          : isHovered
          ? `${color}18`
          : 'transparent',
        border: isSection
          ? isHovered
            ? `1px solid ${color}`
            : `1px solid ${color}35`
          : 'none',
        borderLeft: isInput
          ? isSection
            ? `3px solid ${color}`
            : isHovered
            ? `2px solid ${color}`
            : '2px solid transparent'
          : isSection
          ? isHovered
            ? `1px solid ${color}`
            : `1px solid ${color}35`
          : 'none',
        borderRight: !isInput
          ? isSection
            ? `3px solid ${color}`
            : isHovered
            ? `2px solid ${color}`
            : '2px solid transparent'
          : isSection
          ? isHovered
            ? `1px solid ${color}`
            : `1px solid ${color}35`
          : 'none',
        borderRadius: isSection ? 4 : 3,
        boxShadow: isSection && isHovered ? `0 0 12px ${color}35` : 'none',
        transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
        cursor: 'crosshair',
        ...style,
      }}
    >
      {/* Target (Input) Handle: Physically anchored on the LEFT border of the node card */}
      {isInput && (
        <Handle
          ref={handleRef}
          type="target"
          position={handlePosition}
          id={id}
          className={shapeClass}
          style={{
            position: 'absolute',
            left: -5,
            top: '50%',
            transform: shape === 'diamond' ? 'translateY(-50%) rotate(45deg)' : 'translateY(-50%)',
            width: isSection ? 11 : 10,
            height: isSection ? 11 : 10,
            backgroundColor: color,
            borderColor: '#0c0e14',
            borderWidth: 1.5,
            borderStyle: 'solid',
            boxShadow: isHovered ? `0 0 12px ${color}` : `0 0 5px ${color}60`,
            cursor: 'crosshair',
            zIndex: 15,
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
        />
      )}

      {/* Socket Label & Direction Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          maxWidth: '100%',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 2,
        }}
      >
        {isInput && (
          <div
            style={{
              width: isSection ? 5 : 4,
              height: isSection ? 5 : 4,
              borderRadius: shape === 'circle' ? '50%' : 1,
              backgroundColor: isHovered ? '#ffffff' : color,
              flexShrink: 0,
              transition: 'background-color 120ms ease',
            }}
          />
        )}

        <span
          style={{
            fontSize: isSection ? 9.5 : 9,
            fontWeight: isSection ? 700 : isHovered ? 600 : 500,
            color: isHovered ? '#ffffff' : isSection ? '#f8fafc' : '#cbd5e1',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            transition: 'color 120ms ease',
          }}
        >
          {label}
        </span>

        {secondaryText && (
          <span
            style={{
              fontSize: 7.5,
              fontFamily: 'monospace',
              color: isHovered ? color : '#94a3b8',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '0 3px',
              borderRadius: 2,
              lineHeight: '12px',
            }}
          >
            {secondaryText}
          </span>
        )}

        {!isInput && (
          <div
            style={{
              width: isSection ? 5 : 4,
              height: isSection ? 5 : 4,
              borderRadius: shape === 'circle' ? '50%' : 1,
              backgroundColor: isHovered ? '#ffffff' : color,
              flexShrink: 0,
              transition: 'background-color 120ms ease',
            }}
          />
        )}
      </div>

      {/* Optional Section Tag Badge for Composite Horizontal Sections */}
      {sectionTag && (
        <span
          style={{
            fontSize: 7,
            fontWeight: 700,
            fontFamily: "'Geist Mono', monospace",
            color: isHovered ? '#ffffff' : color,
            backgroundColor: isHovered ? color : `${color}20`,
            border: `1px solid ${color}40`,
            padding: '1px 4px',
            borderRadius: 2,
            letterSpacing: '0.04em',
            lineHeight: 1,
            flexShrink: 0,
            transition: 'all 120ms ease',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {sectionTag}
        </span>
      )}

      {/* Source (Output) Handle: Physically anchored on the RIGHT border of the node card */}
      {!isInput && (
        <Handle
          ref={handleRef}
          type="source"
          position={handlePosition}
          id={id}
          className={shapeClass}
          style={{
            position: 'absolute',
            right: -5,
            top: '50%',
            transform: shape === 'diamond' ? 'translateY(-50%) rotate(45deg)' : 'translateY(-50%)',
            width: isSection ? 11 : 10,
            height: isSection ? 11 : 10,
            backgroundColor: color,
            borderColor: '#0c0e14',
            borderWidth: 1.5,
            borderStyle: 'solid',
            boxShadow: isHovered ? `0 0 12px ${color}` : `0 0 5px ${color}60`,
            cursor: 'crosshair',
            zIndex: 15,
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
        />
      )}
    </div>
  );
};

/* ========================================================================= */
/* DUAL SOCKET RE-EXPORT                                                     */
/* ========================================================================= */
export { NodeDualSocket } from './NodeDualSocket';
export type { DualSocketEndpoint, NodeDualSocketProps } from './NodeDualSocket';

/* ========================================================================= */
/* SOCKET GROUP CONTAINER                                                    */
/* ========================================================================= */
export interface NodeSocketGroupProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const NodeSocketGroup: React.FC<NodeSocketGroupProps> = ({ children, style = {} }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
