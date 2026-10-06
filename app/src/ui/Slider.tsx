// src/ui/Slider.tsx
import React, { useState, useRef, useCallback } from 'react';
import { useSliderScrub } from '../components/node-system/useSliderScrub';

export interface SliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  onChange: (val: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue,
  unit = '',
  onChange,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editString, setEditString] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const safeRange = Math.max(max - min, 0.0001);
  const resolvedDefault = defaultValue !== undefined ? defaultValue : min;

  const roundToStep = useCallback(
    (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      const decimals = (step.toString().split('.')[1] || '').length;
      return Number(clamped.toFixed(Math.min(decimals, 4)));
    },
    [min, max, step]
  );

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditString(value.toString());
      setIsEditing(true);
    },
    [value]
  );

  const handleCommitEdit = useCallback(() => {
    // Parse decimal with comma or dot support
    const normalized = editString.replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed)) {
      onChange(roundToStep(parsed));
    }
    setIsEditing(false);
  }, [editString, onChange, roundToStep]);

  const {
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

  const percentage = Math.max(0, Math.min(100, ((value - min) / safeRange) * 100));

  return (
    <div ref={containerRef} className={`tl-slider nowheel ${className}`.trim()}>
      {label && <span className="tl-slider__label">{label}</span>}

      <div
        ref={trackRef}
        className="tl-slider__track-container nodrag"
        onPointerDown={handlePointerDown}
        onKeyDown={handleTrackKeyDown}
        tabIndex={0}
        role="slider"
        aria-label={label || 'Slider'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="tl-slider__track">
          {/* Dynamic geometry: percentage width is allowed per exception */}
          <div className="tl-slider__fill" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {isEditing ? (
        <input
          type="text"
          className="tl-slider__value-input nodrag"
          value={editString}
          autoFocus
          onChange={(e) => setEditString(e.target.value)}
          onBlur={handleCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommitEdit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
        />
      ) : (
        <span
          className="tl-slider__value"
          onDoubleClick={handleStartEdit}
          title="Drag to scrub. Shift=fine. Ctrl=snap. Double-click=type. Middle-click=reset."
        >
          {value}
          {unit}
        </span>
      )}
    </div>
  );
};
