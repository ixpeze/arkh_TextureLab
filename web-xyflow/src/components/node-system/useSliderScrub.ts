import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface UseSliderScrubParams {
  trackRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  value: number;
  min: number;
  max: number;
  step: number;
  safeRange: number;
  resolvedDefault: number;
  isEditing: boolean;
  onChange: (value: number) => void;
  roundToStep: (val: number) => number;
  handleStartEdit: (e: React.MouseEvent) => void;
}

export function useSliderScrub({
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
}: UseSliderScrubParams) {
  void max;
  const [isDragging, setIsDragging] = useState(false);
  const [isResetFlashing, setIsResetFlashing] = useState(false);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleReset = useCallback(() => {
    onChange(roundToStep(resolvedDefault));
    setIsResetFlashing(true);
    setTimeout(() => setIsResetFlashing(false), 200);
  }, [onChange, resolvedDefault, roundToStep]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;

    if (e.button === 1) {
      e.stopPropagation();
      e.preventDefault();
      handleReset();
      return;
    }

    if (e.button !== 0) return;

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
        const deltaX = clientX - startX;
        const fineRatio = (deltaX / rect.width) * 0.2;
        nextVal = startVal + fineRatio * safeRange;
      } else {
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        nextVal = min + ratio * safeRange;
      }

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
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
  }, [step, onChange, roundToStep, containerRef]);

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
      handleStartEdit(e as unknown as React.MouseEvent);
    }
  };

  return {
    isDragging,
    isResetFlashing,
    handleReset,
    handlePointerDown,
    handleTrackKeyDown,
  };
}
