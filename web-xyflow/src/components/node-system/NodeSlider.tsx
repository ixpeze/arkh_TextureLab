import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useSliderScrub } from './useSliderScrub';

export interface NodeSliderProps {
  label: string;
  value: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  accentColor?: string;
  onChange: (value: number) => void;
}

export const NodeSlider: React.FC<NodeSliderProps> = ({
  label,
  value,
  defaultValue,
  min = 0,
  max = 1,
  step = 0.01,
  unit = '',
  accentColor = '#38bdf8',
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const trackRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Decimal precision derived from step
  const decimals = useMemo(() => {
    if (Number.isInteger(step)) return 0;
    const s = step.toString();
    const idx = s.indexOf('.');
    return idx >= 0 ? Math.min(4, s.length - idx - 1) : 2;
  }, [step]);

  // Round value safely to step
  const roundToStep = useCallback(
    (val: number): number => {
      const clamped = Math.max(min, Math.min(max, val));
      const inv = 1 / step;
      const rounded = Math.round(clamped * inv) / inv;
      return parseFloat(rounded.toFixed(decimals));
    },
    [min, max, step, decimals]
  );

  // Smart resolved default value
  const resolvedDefault = useMemo(() => {
    if (defaultValue !== undefined) return defaultValue;
    const l = label.toLowerCase();
    if (l.includes('gamma') || l.includes('strength') || l.includes('opacity') || l.includes('intensity')) {
      return 1.0;
    }
    if (l.includes('white') || l.includes('max')) {
      return max;
    }
    if (l.includes('black') || l.includes('min')) {
      return min;
    }
    if (min <= 0 && max >= 1) {
      return min === 0 && max === 1 ? 1.0 : 0;
    }
    return min;
  }, [defaultValue, label, min, max]);

  // Format value for display
  const displayValue = useMemo(() => {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    return decimals === 0 ? Math.round(value).toString() : value.toFixed(decimals);
  }, [value, decimals]);

  // Fill percentage
  const safeRange = Math.max(0.0001, max - min);
  const pct = Math.max(0, Math.min(100, ((value - min) / safeRange) * 100));

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditValue(displayValue);
    setIsEditing(true);
  };

  const handleCommitEdit = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(roundToStep(parsed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleCommitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const {
    isDragging,
    isResetFlashing,
    handleReset,
    handlePointerDown,
    handleTrackKeyDown,
  } = useSliderScrub({
    trackRef,
    containerRef,
    value,
    min,
    max,
    step,
    safeRange,
    resolvedDefault,
    isEditing,
    onChange,
    roundToStep,
    handleStartEdit,
  });

  return (
    <div
      ref={containerRef}
      className="nodrag nopan nowheel"
      onPointerDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          handleReset();
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          handleReset();
        }
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          handleReset();
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
      }}
    >
      {/* Slider Track with Filled Progress Bar & Overlaid Text */}
      <div
        ref={trackRef}
        tabIndex={0}
        className="nowheel"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleStartEdit}
        onKeyDown={handleTrackKeyDown}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            handleReset();
          }
        }}
        title="Middle-click: Reset to default • Drag: Scrub • Shift+Drag: Fine-tune (5x) • Ctrl+Drag: Snap • Wheel: Nudge • Del/Bksp: Reset • Click: Type"
        style={{
          position: 'relative',
          height: 20,
          backgroundColor: isResetFlashing ? `${accentColor}30` : '#0c0e15',
          border: isDragging
            ? `1px solid ${accentColor}`
            : isResetFlashing
            ? `1px solid ${accentColor}`
            : '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: 3,
          overflow: 'hidden',
          cursor: isEditing ? 'default' : 'ew-resize',
          boxShadow: isDragging
            ? `0 0 8px ${accentColor}40`
            : isResetFlashing
            ? `0 0 10px ${accentColor}60`
            : 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
          transition: 'border-color 100ms ease, box-shadow 100ms ease, background-color 150ms ease',
          outline: 'none',
        }}
      >
        {/* Filled bar spanning 0 to pct% */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${accentColor}30 0%, ${accentColor}60 100%)`,
            borderRight: pct > 0 && pct < 100 ? `1.5px solid ${accentColor}` : 'none',
            borderRadius: '2px 0 0 2px',
            pointerEvents: 'none',
            transition: isDragging ? 'none' : 'width 60ms ease-out',
          }}
        />

        {/* Text Overlaid Directly on the Filled Slider */}
        {isEditing ? (
          <div
            className="nodrag nopan"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
              backgroundColor: '#0a0c12',
              zIndex: 3,
            }}
          >
            <span style={{ fontSize: 8, color: '#94a3b8', marginRight: 4, flexShrink: 0 }}>
              {label}:
            </span>
            <input
              autoFocus
              type="number"
              step={step}
              min={min}
              max={max}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommitEdit}
              onKeyDown={handleKeyDown}
              className="nodrag nopan"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                height: 16,
                background: 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${accentColor}`,
                borderRadius: 2,
                color: '#f8fafc',
                fontSize: 8.5,
                fontFamily: "'Geist Mono', monospace",
                fontWeight: 600,
                padding: '0 4px',
                outline: 'none',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100%',
              padding: '0 6px',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: '#cbd5e1',
                letterSpacing: '0.02em',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '65%',
              }}
            >
              {label}
            </span>

            <span
              onClick={handleStartEdit}
              onPointerDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleReset();
                }
              }}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleReset();
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleReset();
                }
              }}
              title="Click to type • Middle-click: Reset to default"
              style={{
                fontSize: 8.5,
                fontFamily: "'Geist Mono', monospace",
                fontWeight: 700,
                color: '#f8fafc',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
                pointerEvents: 'auto',
                cursor: 'text',
                padding: '0 3px',
                borderRadius: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {displayValue}
              {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
