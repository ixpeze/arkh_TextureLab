import React, { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SocketShape } from './NodeSocket';

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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, side: 'left' | 'right') => {
    const targetRef = side === 'left' ? inputRef : outputRef;
    if (!targetRef.current) return;
    if (e.target === targetRef.current) return;

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
    targetRef.current.dispatchEvent(event);
  };

  return (
    <div
      className="node-socket-row is-dual-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 19,
        position: 'relative',
        margin: '0 -7px',
        backgroundColor:
          hoverSide === 'left'
            ? `${inColor}14`
            : hoverSide === 'right'
            ? `${outColor}14`
            : 'transparent',
        transition: 'background-color 0.12s ease',
        ...style,
      }}
    >
      {/* ── LEFT HALF: INPUT (Target) ── */}
      <div
        className="dual-side-left"
        onMouseEnter={() => setHoverSide('left')}
        onMouseLeave={() => setHoverSide(null)}
        onPointerDown={(e) => handlePointerDown(e, 'left')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          height: '100%',
          paddingLeft: 10,
          cursor: 'crosshair',
          position: 'relative',
        }}
      >
        <div
          ref={inputRef}
          style={{
            position: 'absolute',
            left: -5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 10,
            height: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          <Handle
            id={input.id}
            type="target"
            position={Position.Left}
            className={`socket-handle ${inShapeClass}`}
            style={{
              position: 'relative',
              left: 0,
              top: 0,
              transform: 'none',
              width: 8,
              height: 8,
              backgroundColor: hoverSide === 'left' ? '#ffffff' : inColor,
              borderColor: hoverSide === 'left' ? inColor : '#0f172a',
              borderWidth: 1.5,
              borderStyle: 'solid',
              boxShadow: hoverSide === 'left' ? `0 0 6px ${inColor}` : 'none',
              transition: 'background-color 0.12s, box-shadow 0.12s',
            }}
          />
        </div>

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
            fontSize: 8.5,
            fontWeight: 600,
            color: hoverSide === 'left' ? inColor : '#94a3b8',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {input.label}
        </span>
        {input.secondaryText && (
          <span style={{ fontSize: 7, color: '#475569', marginLeft: 1 }}>{input.secondaryText}</span>
        )}
      </div>

      {/* ── CENTER LABEL (Optional) ── */}
      {centerLabel && (
        <span
          style={{
            fontSize: 7,
            color: '#475569',
            padding: '0 4px',
            userSelect: 'none',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {centerLabel}
        </span>
      )}

      {/* ── RIGHT HALF: OUTPUT (Source) ── */}
      <div
        className="dual-side-right"
        onMouseEnter={() => setHoverSide('right')}
        onMouseLeave={() => setHoverSide(null)}
        onPointerDown={(e) => handlePointerDown(e, 'right')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          flex: 1,
          height: '100%',
          paddingRight: 10,
          cursor: 'crosshair',
          position: 'relative',
        }}
      >
        <div
          ref={outputRef}
          style={{
            position: 'absolute',
            right: -5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 10,
            height: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          <Handle
            id={output.id}
            type="source"
            position={Position.Right}
            className={`socket-handle ${outShapeClass}`}
            style={{
              position: 'relative',
              right: 0,
              top: 0,
              transform: 'none',
              width: 8,
              height: 8,
              backgroundColor: hoverSide === 'right' ? '#ffffff' : outColor,
              borderColor: hoverSide === 'right' ? outColor : '#0f172a',
              borderWidth: 1.5,
              borderStyle: 'solid',
              boxShadow: hoverSide === 'right' ? `0 0 6px ${outColor}` : 'none',
              transition: 'background-color 0.12s, box-shadow 0.12s',
            }}
          />
        </div>

        {output.secondaryText && (
          <span style={{ fontSize: 7, color: '#475569', marginRight: 1 }}>{output.secondaryText}</span>
        )}
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 600,
            color: hoverSide === 'right' ? outColor : '#94a3b8',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
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
  );
};
