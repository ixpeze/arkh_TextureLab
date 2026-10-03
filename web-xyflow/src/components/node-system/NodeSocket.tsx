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
      className="node-socket-row"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isInput ? 'flex-start' : 'flex-end',
        height: 19,
        position: 'relative',
        margin: fullWidth ? '0 -7px' : '0',
        paddingLeft: isInput ? 10 : 6,
        paddingRight: isInput ? 6 : 10,
        backgroundColor: isHovered ? `${color}18` : 'transparent',
        borderLeft: isInput && isHovered ? `2px solid ${color}` : '2px solid transparent',
        borderRight: !isInput && isHovered ? `2px solid ${color}` : '2px solid transparent',
        borderRadius: 3,
        transition: 'background-color 120ms ease, border-color 120ms ease',
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
            width: 10,
            height: 10,
            backgroundColor: color,
            borderColor: '#0c0e14',
            borderWidth: 1.5,
            borderStyle: 'solid',
            boxShadow: isHovered ? `0 0 10px ${color}` : `0 0 5px ${color}60`,
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
              width: 4,
              height: 4,
              borderRadius: shape === 'circle' ? '50%' : 1,
              backgroundColor: isHovered ? '#ffffff' : color,
              flexShrink: 0,
              transition: 'background-color 120ms ease',
            }}
          />
        )}

        <span
          style={{
            fontSize: 9,
            fontWeight: isHovered ? 600 : 500,
            color: isHovered ? '#ffffff' : '#cbd5e1',
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
              width: 4,
              height: 4,
              borderRadius: shape === 'circle' ? '50%' : 1,
              backgroundColor: isHovered ? '#ffffff' : color,
              flexShrink: 0,
              transition: 'background-color 120ms ease',
            }}
          />
        )}
      </div>

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
            width: 10,
            height: 10,
            backgroundColor: color,
            borderColor: '#0c0e14',
            borderWidth: 1.5,
            borderStyle: 'solid',
            boxShadow: isHovered ? `0 0 10px ${color}` : `0 0 5px ${color}60`,
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
/* DUAL SOCKET ROW (In on Left Border, Out on Right Border)                 */
/* ========================================================================= */
export interface DualSocketEndpoint {
  id: string;
  label: string;
  color?: string;
  shape?: SocketShape;
  secondaryText?: string;
}

export interface NodeDualSocketProps {
  input: DualSocketEndpoint;
  output: DualSocketEndpoint;
  centerLabel?: string;
  style?: React.CSSProperties;
}

/**
 * Split Horizontal Row:
 * - Target (Input) handle anchored at the LEFT BORDER (left: -5).
 * - Source (Output) handle anchored at the RIGHT BORDER (right: -5).
 * - Clicking left half triggers the Input handle.
 * - Clicking right half triggers the Output handle.
 * Guarantees crisp Node-to-Node connections on both borders!
 */
export const NodeDualSocket: React.FC<NodeDualSocketProps> = ({
  input,
  output,
  centerLabel,
  style = {},
}) => {
  const [hoverSide, setHoverSide] = useState<'left' | 'right' | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const inColor = input.color || 'var(--pbr-rough)';
  const outColor = output.color || 'var(--pbr-rough)';

  const inShapeClass =
    input.shape === 'diamond'
      ? 'handle-diamond'
      : input.shape === 'square'
      ? 'handle-square'
      : 'handle-circle';

  const outShapeClass =
    output.shape === 'diamond'
      ? 'handle-diamond'
      : output.shape === 'square'
      ? 'handle-square'
      : 'handle-circle';

  const handleLeftPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!inputRef.current) return;
    if (e.target === inputRef.current) return;
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
    inputRef.current.dispatchEvent(event);
  };

  const handleRightPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!outputRef.current) return;
    if (e.target === outputRef.current) return;
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
    outputRef.current.dispatchEvent(event);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 20,
        position: 'relative',
        margin: '0 -7px',
        borderRadius: 3,
        ...style,
      }}
    >
      {/* Left 50% Hit Section: Target (Input) */}
      <div
        onMouseEnter={() => setHoverSide('left')}
        onMouseLeave={() => setHoverSide(null)}
        onPointerDown={handleLeftPointerDown}
        style={{
          width: '50%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 10,
          position: 'relative',
          backgroundColor: hoverSide === 'left' ? `${inColor}18` : 'transparent',
          borderLeft: hoverSide === 'left' ? `2px solid ${inColor}` : '2px solid transparent',
          borderRadius: '3px 0 0 3px',
          cursor: 'crosshair',
          transition: 'background-color 120ms ease, border-color 120ms ease',
        }}
      >
        <Handle
          ref={inputRef}
          type="target"
          position={Position.Left}
          id={input.id}
          className={inShapeClass}
          style={{
            position: 'absolute',
            left: -5,
            top: '50%',
            transform:
              input.shape === 'diamond'
                ? 'translateY(-50%) rotate(45deg)'
                : 'translateY(-50%)',
            width: 10,
            height: 10,
            backgroundColor: inColor,
            borderColor: '#0c0e14',
            borderWidth: 1.5,
            borderStyle: 'solid',
            boxShadow: hoverSide === 'left' ? `0 0 10px ${inColor}` : `0 0 5px ${inColor}60`,
            cursor: 'crosshair',
            zIndex: 15,
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
        />

        {/* Left Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none', zIndex: 2 }}>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: input.shape === 'circle' ? '50%' : 1,
              backgroundColor: hoverSide === 'left' ? '#ffffff' : inColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: hoverSide === 'left' ? 600 : 500,
              color: hoverSide === 'left' ? '#ffffff' : '#cbd5e1',
            }}
          >
            {input.label}
          </span>
        </div>
      </div>

      {/* Center Optional Label */}
      {centerLabel && (
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            fontSize: 7.5,
            color: 'var(--text-dim)',
            fontStyle: 'italic',
            letterSpacing: '0.02em',
            zIndex: 11,
            whiteSpace: 'nowrap',
          }}
        >
          {centerLabel}
        </span>
      )}

      {/* Right 50% Hit Section: Source (Output) */}
      <div
        onMouseEnter={() => setHoverSide('right')}
        onMouseLeave={() => setHoverSide(null)}
        onPointerDown={handleRightPointerDown}
        style={{
          width: '50%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 10,
          position: 'relative',
          backgroundColor: hoverSide === 'right' ? `${outColor}18` : 'transparent',
          borderRight: hoverSide === 'right' ? `2px solid ${outColor}` : '2px solid transparent',
          borderRadius: '0 3px 3px 0',
          cursor: 'crosshair',
          transition: 'background-color 120ms ease, border-color 120ms ease',
        }}
      >
        <Handle
          ref={outputRef}
          type="source"
          position={Position.Right}
          id={output.id}
          className={outShapeClass}
          style={{
            position: 'absolute',
            right: -5,
            top: '50%',
            transform:
              output.shape === 'diamond'
                ? 'translateY(-50%) rotate(45deg)'
                : 'translateY(-50%)',
            width: 10,
            height: 10,
            backgroundColor: outColor,
            borderColor: '#0c0e14',
            borderWidth: 1.5,
            borderStyle: 'solid',
            boxShadow: hoverSide === 'right' ? `0 0 10px ${outColor}` : `0 0 5px ${outColor}60`,
            cursor: 'crosshair',
            zIndex: 15,
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
        />

        {/* Right Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none', zIndex: 2 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: hoverSide === 'right' ? 600 : 500,
              color: hoverSide === 'right' ? '#ffffff' : '#cbd5e1',
            }}
          >
            {output.label}
          </span>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: output.shape === 'circle' ? '50%' : 1,
              backgroundColor: hoverSide === 'right' ? '#ffffff' : outColor,
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
};

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
