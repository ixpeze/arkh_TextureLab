import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/* ========================================================================= */
/* 1. NODE SLIDER (Filled, Scrubbable, Inline-Editable DCC Slider)           */
/* ========================================================================= */
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
  const [isDragging, setIsDragging] = useState(false);
  const [isResetFlashing, setIsResetFlashing] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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

  // Reset to default value with visual feedback
  const handleReset = useCallback(() => {
    onChange(roundToStep(resolvedDefault));
    setIsResetFlashing(true);
    setTimeout(() => setIsResetFlashing(false), 200);
  }, [onChange, resolvedDefault, roundToStep]);

  // Pointer scrub handler supporting Middle-Click reset, Shift fine-scrub, and Ctrl snap
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;

    // Middle Mouse Button (Wheel Click): Reset to Default
    if (e.button === 1) {
      e.stopPropagation();
      e.preventDefault();
      handleReset();
      return;
    }

    // Only process Left Click for dragging
    if (e.button !== 0) return;

    // CRITICAL: Stop propagation so React Flow never moves the node!
    e.stopPropagation();
    e.preventDefault();

    const track = trackRef.current;
    if (!track) return;

    const startX = e.clientX;
    const startVal = value;

    const updateFromPointer = (clientX: number, isShift: boolean, isCtrl: boolean) => {
      const rect = track.getBoundingClientRect();
      let nextVal: number;

      if (isShift) {
        // Shift: Fine-tuning mode (5x micro-precision relative to start position)
        const deltaX = clientX - startX;
        const fineRatio = (deltaX / rect.width) * 0.2;
        nextVal = startVal + fineRatio * safeRange;
      } else {
        // Normal Scrub: Absolute position on slider track
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        nextVal = min + ratio * safeRange;
      }

      // Ctrl: Snap to rounded intervals (e.g. 10%, 25%, or 10 units)
      if (isCtrl) {
        const snapInterval = safeRange >= 10 ? 10 : safeRange >= 1 ? 0.25 : 0.05;
        nextVal = Math.round(nextVal / snapInterval) * snapInterval;
      }

      onChange(roundToStep(nextVal));
    };

    updateFromPointer(e.clientX, e.shiftKey, e.ctrlKey);
    setIsDragging(true);

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.stopPropagation();
      moveEvt.preventDefault();
      updateFromPointer(moveEvt.clientX, moveEvt.shiftKey, moveEvt.ctrlKey);
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.stopPropagation();
      upEvt.preventDefault();
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Native non-passive Wheel listener to cleanly scrub without triggering React Flow canvas zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      // Critical: preventDefault in non-passive listener and stop propagation so React Flow never zooms
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const direction = e.deltaY < 0 ? 1 : -1;
      const multiplier = e.shiftKey ? 0.1 : e.ctrlKey ? 5 : 1;
      const delta = (step || 0.01) * multiplier * direction;
      onChange(roundToStep(valueRef.current + delta));
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, [step, onChange, roundToStep]);

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

  // Track keydown for slider shortcuts when focused
  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.stopPropagation();
      e.preventDefault();
      handleReset();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.stopPropagation();
      e.preventDefault();
      const mult = e.shiftKey ? 0.1 : e.ctrlKey ? 5 : 1;
      onChange(roundToStep(value + step * mult));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.stopPropagation();
      e.preventDefault();
      const mult = e.shiftKey ? 0.1 : e.ctrlKey ? 5 : 1;
      onChange(roundToStep(value - step * mult));
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      handleStartEdit(e as any);
    }
  };

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
              pointerEvents: 'none', // lets pointer events hit the track for scrub
            }}
          >
            {/* Label on Left */}
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

            {/* Value on Right */}
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
                pointerEvents: 'auto', // allows clicking directly on value to edit
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

/* ========================================================================= */
/* 2. NODE INPUT (TEXT & NUMBER)                                            */
/* ========================================================================= */
export interface NodeInputProps {
  label?: string;
  value: string | number;
  type?: 'text' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: any) => void;
}

export const NodeInput: React.FC<NodeInputProps> = ({
  label,
  value,
  type = 'text',
  placeholder = '',
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}) => {
  return (
    <div
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {label && (
        <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(12, 14, 20, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          padding: '2px 5px',
          gap: 4,
          transition: 'border-color 120ms ease',
        }}
      >
        {prefix && (
          <span style={{ fontSize: 8.5, fontFamily: 'monospace', color: 'var(--text-dim)' }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          min={min}
          max={max}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          className="nodrag nopan"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 9,
            fontFamily: type === 'number' ? "'Geist Mono', monospace" : 'inherit',
            color: '#f8fafc',
            fontWeight: 500,
          }}
        />
        {suffix && (
          <span style={{ fontSize: 8.5, fontFamily: 'monospace', color: 'var(--text-dim)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 3. NODE TOGGLE / SWITCH                                                  */
/* ========================================================================= */
export interface NodeToggleProps {
  label: string;
  checked: boolean;
  activeColor?: string;
  onChange: (checked: boolean) => void;
}

export const NodeToggle: React.FC<NodeToggleProps> = ({
  label,
  checked,
  activeColor = '#a855f7',
  onChange,
}) => {
  return (
    <div
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        padding: '2px 0',
      }}
    >
      <span style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 500 }}>{label}</span>
      <div
        style={{
          width: 22,
          height: 12,
          borderRadius: 6,
          backgroundColor: checked ? activeColor : 'rgba(255, 255, 255, 0.1)',
          position: 'relative',
          transition: 'background-color 140ms ease',
          boxShadow: checked ? `0 0 6px ${activeColor}60` : 'none',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            position: 'absolute',
            top: 2,
            left: checked ? 12 : 2,
            transition: 'left 140ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 4. NODE CHECKBOX                                                          */
/* ========================================================================= */
export interface NodeCheckboxProps {
  label: string;
  checked: boolean;
  activeColor?: string;
  onChange: (checked: boolean) => void;
}

export const NodeCheckbox: React.FC<NodeCheckboxProps> = ({
  label,
  checked,
  activeColor = '#a855f7',
  onChange,
}) => {
  return (
    <div
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        padding: '2px 0',
      }}
    >
      <div
        style={{
          width: 11,
          height: 11,
          borderRadius: 2.5,
          backgroundColor: checked ? activeColor : 'rgba(12, 14, 20, 0.8)',
          border: checked ? `1px solid ${activeColor}` : '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease',
        }}
      >
        {checked && <Check size={8} color="#ffffff" strokeWidth={3} />}
      </div>
      <span style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 500 }}>{label}</span>
    </div>
  );
};

/* ========================================================================= */
/* 5. NODE SELECT / DROPDOWN                                                */
/* ========================================================================= */
export interface NodeSelectProps {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

export const NodeSelect: React.FC<NodeSelectProps> = ({
  label,
  value,
  options,
  onChange,
}) => {
  return (
    <div
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {label && (
        <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
      )}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(12, 14, 20, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
        }}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="nodrag nopan"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 9,
            color: '#f8fafc',
            fontWeight: 500,
            padding: '3px 18px 3px 6px',
            appearance: 'none',
            cursor: 'pointer',
          }}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ backgroundColor: '#151822', color: '#f8fafc' }}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={10}
          color="#94a3b8"
          style={{ position: 'absolute', right: 5, pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 6. NODE DIVIDER                                                          */
/* ========================================================================= */
export const NodeDivider: React.FC<{ style?: React.CSSProperties }> = ({ style = {} }) => (
  <div
    style={{
      height: 1,
      backgroundColor: 'var(--border-subtle)',
      margin: '2px 0',
      ...style,
    }}
  />
);

/* ========================================================================= */
/* 7. NODE BADGE                                                            */
/* ========================================================================= */
export interface NodeBadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'subtle';
}

export const NodeBadge: React.FC<NodeBadgeProps> = ({
  children,
  color = '#a855f7',
  variant = 'subtle',
}) => {
  return (
    <span
      style={{
        fontSize: 7.5,
        fontWeight: 700,
        fontFamily: "'Geist Mono', monospace",
        color: variant === 'solid' ? '#0c0e14' : color,
        backgroundColor: variant === 'solid' ? color : `${color}18`,
        border: `1px solid ${color}${variant === 'solid' ? 'ff' : '35'}`,
        padding: '1px 4px',
        borderRadius: 3,
        letterSpacing: 0.4,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        lineHeight: '11px',
      }}
    >
      {children}
    </span>
  );
};
