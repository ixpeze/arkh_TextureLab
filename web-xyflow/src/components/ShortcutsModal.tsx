import React, { useEffect } from 'react';
import { X, Keyboard, Command, Sparkles, Sliders } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'spawn' | 'graph' | 'viewport' | 'slider';
  tag?: string;
  tagColor?: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // Node Spawning
  { keys: ['T'], description: 'Texture Input Node', category: 'spawn', tag: 'Input', tagColor: '#38bdf8' },
  { keys: ['1'], description: 'Constant Scalar Node (Float)', category: 'spawn', tag: 'Constant', tagColor: '#e2e8f0' },
  { keys: ['3'], description: 'Constant Color Node (Vector)', category: 'spawn', tag: 'Constant', tagColor: '#f43f5e' },
  { keys: ['M'], description: 'Channel Combiner (Pack)', category: 'spawn', tag: 'Routing', tagColor: '#a855f7' },
  { keys: ['S'], description: 'Channel Splitter (Unpack)', category: 'spawn', tag: 'Routing', tagColor: '#a855f7' },
  { keys: ['B'], description: 'Texture Blend (Mix / Math)', category: 'spawn', tag: 'Blend', tagColor: '#f59e0b' },
  { keys: ['L'], description: 'Levels / Remap Node', category: 'spawn', tag: 'Adjust', tagColor: '#22c55e' },
  { keys: ['I'], description: 'Invert Node (1 - x)', category: 'spawn', tag: 'Adjust', tagColor: '#fb7185' },
  { keys: ['N'], description: 'Normal Flip Green (DirectX <=> OpenGL)', category: 'spawn', tag: 'Filter', tagColor: '#06b6d4' },
  { keys: ['O'], description: 'Texture Output Target', category: 'spawn', tag: 'Output', tagColor: '#4ade80' },
  { keys: ['C'], description: 'Group selected nodes into Comment Box (UE5)', category: 'spawn', tag: 'Group', tagColor: '#38bdf8' },

  // Graph Productivity
  { keys: ['Ctrl', 'Z'], description: 'Undo last graph action', category: 'graph' },
  { keys: ['Ctrl', 'Y'], description: 'Redo last graph action (or Ctrl+Shift+Z)', category: 'graph' },
  { keys: ['Ctrl', 'E'], description: 'Open Texture Export Hub Modal', category: 'graph', tag: 'Export', tagColor: '#4ade80' },
  { keys: ['D'], description: 'Bypass / Mute selected node', category: 'graph', tag: 'Mute', tagColor: '#ef4444' },
  { keys: ['Del', 'Bksp'], description: 'Delete selected node(s) and connected wires', category: 'graph' },
  { keys: ['Ctrl', 'D'], description: 'Duplicate selected node(s)', category: 'graph' },
  { keys: ['Ctrl', 'A'], description: 'Select all nodes on canvas', category: 'graph' },
  { keys: ['W'], description: 'Auto-wire PBR maps into ORMH Combiner', category: 'graph', tag: 'Smart', tagColor: '#a855f7' },
  { keys: ['F'], description: 'Focus extents (Fit all nodes in view)', category: 'graph' },

  // Slider & Value Controls (DCC Style)
  { keys: ['Middle Click'], description: 'Reset slider to default value (Blender / UE5)', category: 'slider', tag: 'DCC Reset', tagColor: '#38bdf8' },
  { keys: ['Shift', 'Drag'], description: 'Fine-precision micro scrub (5x sensitivity)', category: 'slider', tag: 'Precision', tagColor: '#a855f7' },
  { keys: ['Ctrl', 'Drag'], description: 'Snap to interval increments (10%, 25%, 0.1)', category: 'slider', tag: 'Snap', tagColor: '#f59e0b' },
  { keys: ['Mouse Wheel'], description: 'Nudge value up or down over slider track', category: 'slider' },
  { keys: ['Del', 'Bksp'], description: 'Reset focused slider value to default', category: 'slider' },
  { keys: ['Click Value'], description: 'Direct numeric keyboard typing input', category: 'slider', tag: 'Direct', tagColor: '#4ade80' },

  // Viewport & Navigation
  { keys: ['Tab'], description: 'Toggle Quick Search & Spawn Palette at cursor', category: 'viewport' },
  { keys: ['Alt', 'Click'], description: 'Cut / disconnect wire wireline (UE5 style)', category: 'viewport' },
  { keys: ['Right Drag'], description: 'Pan canvas workspace', category: 'viewport' },
  { keys: ['Wheel'], description: 'Smooth zoom in / out', category: 'viewport' },
  { keys: ['?'], description: 'Toggle this Keyboard Shortcuts Cheatsheet', category: 'viewport' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const spawnShortcuts = SHORTCUTS.filter((s) => s.category === 'spawn');
  const graphShortcuts = SHORTCUTS.filter((s) => s.category === 'graph');
  const sliderShortcuts = SHORTCUTS.filter((s) => s.category === 'slider');
  const viewportShortcuts = SHORTCUTS.filter((s) => s.category === 'viewport');

  const renderSection = (title: string, icon: React.ReactNode, items: ShortcutItem[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 4, borderBottom: '1px solid var(--border-subtle)' }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#f8fafc', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#cbd5e1' }}>{item.description}</span>
              {item.tag && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: item.tagColor || '#94a3b8',
                    backgroundColor: item.tagColor ? `${item.tagColor}15` : 'rgba(255, 255, 255, 0.05)',
                    border: item.tagColor ? `1px solid ${item.tagColor}30` : 'var(--border-subtle)',
                    padding: '1px 4px',
                    borderRadius: 3,
                  }}
                >
                  {item.tag}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {item.keys.map((k, kIdx) => (
                <kbd
                  key={kIdx}
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#f8fafc',
                    backgroundColor: 'rgba(21, 24, 34, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 2px 0 rgba(0, 0, 0, 0.5)',
                    padding: '2px 6px',
                    borderRadius: 3,
                  }}
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: '92vw',
          maxHeight: '88vh',
          backgroundColor: 'rgba(18, 21, 30, 0.96)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 32px rgba(168, 85, 247, 0.15)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(12, 14, 20, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a855f7',
              }}
            >
              <Keyboard size={14} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                Keyboard Shortcuts
                <span
                  style={{
                    fontSize: 8,
                    color: '#a855f7',
                    background: 'rgba(168, 85, 247, 0.12)',
                    padding: '2px 5px',
                    borderRadius: 3,
                    fontWeight: 700,
                  }}
                >
                  NANOFLOW
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Complete cheat sheet for high-velocity texture packing</div>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {renderSection('Quick Node Spawning', <Sparkles size={12} color="#a855f7" />, spawnShortcuts)}
          {renderSection('Graph & Selection Productivity', <Command size={12} color="#38bdf8" />, graphShortcuts)}
          {renderSection('DCC Slider & Parameter Controls', <Sliders size={12} color="#f59e0b" />, sliderShortcuts)}
          {renderSection('Viewport & Canvas Navigation', <Keyboard size={12} color="#22c55e" />, viewportShortcuts)}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(12, 14, 20, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#64748b',
          }}
        >
          <span>Press <kbd style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>?</kbd> anytime to toggle this modal</span>
          <span style={{ color: '#94a3b8' }}>Esc to Dismiss</span>
        </div>
      </div>
    </>
  );
};
