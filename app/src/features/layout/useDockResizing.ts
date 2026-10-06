import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function useDockResizing() {
  const libraryWidth = useAppStore((s) => s.libraryWidth);
  const setLibraryWidth = useAppStore((s) => s.setLibraryWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);
  const isLibraryOpen = useAppStore((s) => s.isLibraryOpen);
  const setLibraryOpen = useAppStore((s) => s.setLibraryOpen);
  const isInspectorOpen = useAppStore((s) => s.isInspectorOpen);
  const setInspectorOpen = useAppStore((s) => s.setInspectorOpen);

  const [resizing, setResizing] = useState<'left' | 'right' | null>(null);

  // Auto-collapse library when window < 1280px per P5-T13
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280 && isLibraryOpen) {
        setLibraryOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLibraryOpen, setLibraryOpen]);

  const handleMouseDownLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing('left');
  }, []);

  const handleMouseDownRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing('right');
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing === 'left') {
        const newWidth = Math.max(240, Math.min(480, e.clientX));
        setLibraryWidth(newWidth);
      } else if (resizing === 'right') {
        const newWidth = Math.max(260, Math.min(600, window.innerWidth - e.clientX));
        setInspectorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, setLibraryWidth, setInspectorWidth]);

  return {
    libraryWidth,
    inspectorWidth,
    isLibraryOpen,
    isInspectorOpen,
    resizing,
    handleMouseDownLeft,
    handleMouseDownRight,
    setLibraryOpen,
    setInspectorOpen,
  };
}
