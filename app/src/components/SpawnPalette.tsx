import React, { useState, useEffect, useRef } from 'react';
import { Search, CornerDownLeft, X } from 'lucide-react';

interface SpawnPaletteProps {
  x: number;
  y: number;
  onSelectNode: (type: string) => void;
  onClose: () => void;
}

const PALETTE_ITEMS = [
  { cat: 'Inputs', name: 'Texture Input', key: 'textureInput', shortcut: 'T', color: '#38bdf8' },
  { cat: 'Inputs', name: 'Color', key: 'color', shortcut: '3', color: '#f43f5e' },
  { cat: 'Inputs', name: 'Constant Color (Legacy)', key: 'constantColor', color: '#f43f5e' },
  { cat: 'Inputs', name: 'Constant Scalar', key: 'constantScalar', shortcut: '1', color: '#e2e8f0' },
  { cat: 'Routing', name: 'Channel Pack', key: 'channelPack', shortcut: 'M', color: '#a855f7' },
  { cat: 'Routing', name: 'Channel Unpack', key: 'channelUnpack', shortcut: 'S', color: '#a855f7' },
  { cat: 'Routing', name: 'Channel Mixer', key: 'channelMixer', color: '#818cf8' },
  { cat: 'Routing', name: 'Channel Combiner (Legacy)', key: 'channelCombiner', color: '#a855f7' },
  { cat: 'Routing', name: 'Channel Splitter (Legacy)', key: 'channelSplitter', color: '#a855f7' },
  { cat: 'Routing', name: 'Channel Swizzle (Legacy)', key: 'channelSwizzle', color: '#818cf8' },
  { cat: 'Math', name: 'Lerp (Linear Interpolate)', key: 'lerp', color: '#38bdf8' },
  { cat: 'Math', name: 'Multiply', key: 'multiply', color: '#22c55e' },
  { cat: 'Math', name: 'Add', key: 'add', color: '#eab308' },
  { cat: 'Math', name: 'Subtract', key: 'subtract', color: '#f97316' },
  { cat: 'Math', name: 'Divide', key: 'divide', color: '#ef4444' },
  { cat: 'Math', name: 'Clamp', key: 'clamp', color: '#818cf8' },
  { cat: 'Math', name: 'Saturate', key: 'saturate', color: '#06b6d4' },
  { cat: 'Math', name: 'Power', key: 'power', color: '#a855f7' },
  { cat: 'Math', name: 'One Minus (1 - X)', key: 'oneMinus', color: '#ec4899' },
  { cat: 'Math', name: 'Min', key: 'min', color: '#14b8a6' },
  { cat: 'Math', name: 'Max', key: 'max', color: '#f59e0b' },
  { cat: 'Math', name: 'Abs', key: 'abs', color: '#6366f1' },
  { cat: 'Math', name: 'Math (Expression)', key: 'math', color: '#22c55e' },
  { cat: 'Processing', name: 'Levels (Remap)', key: 'levels', shortcut: 'L', color: '#22c55e' },
  { cat: 'Processing', name: 'Resize', key: 'resize', color: '#38bdf8' },
  { cat: 'Processing', name: 'Upscale', key: 'upscale', color: '#a855f7' },
  { cat: 'Filters', name: 'Normal Flip Green', key: 'normalFlip', shortcut: 'N', color: '#06b6d4' },
  { cat: 'Filters', name: 'Normal Blend (RNM)', key: 'normalBlend', color: '#06b6d4' },
  { cat: 'Filters', name: 'Invert (1 - x)', key: 'invert', shortcut: 'I', color: '#fb7185' },
  { cat: 'Filters', name: 'Texture Blend (Legacy)', key: 'blend', shortcut: 'B', color: '#f59e0b' },
  { cat: 'Inspection', name: 'Compare (A/B Wipe & Diff)', key: 'compare', color: '#38bdf8' },
  { cat: 'Inspection', name: 'Seam Check (Tiled)', key: 'seamCheck', color: '#f59e0b' },
  { cat: 'Batch', name: 'Load Folder', key: 'loadFolder', color: '#38bdf8' },
  { cat: 'Batch', name: 'Normalize', key: 'normalize', color: '#10b981' },
  { cat: 'Batch', name: 'For Each Loop', key: 'forEach', color: '#8b5cf6' },
  { cat: 'Batch', name: 'Batch Export', key: 'batchExport', color: '#22c55e' },
  { cat: 'Outputs', name: 'Texture Output', key: 'textureOutput', shortcut: 'O', color: '#4ade80' },
  { cat: 'Organization', name: 'Comment Box', key: 'commentBox', shortcut: 'C', color: '#38bdf8' },
];

export const SpawnPalette: React.FC<SpawnPaletteProps> = ({ x, y, onSelectNode, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = PALETTE_ITEMS.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.cat.toLowerCase().includes(search.toLowerCase()) ||
    (item.shortcut && item.shortcut.toLowerCase() === search.toLowerCase())
  );


  // Keep highlighted item in view
  useEffect(() => {
    if (itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Global Escape & Tab listener
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKey, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKey, { capture: true });
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) {
        onSelectNode(filtered[activeIndex].key);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
      {/* Invisible Fullscreen Backdrop to guarantee quick cancel on click outside */}
      <div
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 998,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Spawn Palette Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: Math.max(16, Math.min(y, window.innerHeight - 340)),
          left: Math.max(16, Math.min(x, window.innerWidth - 280)),
          width: 270,
          backgroundColor: 'rgba(18, 21, 30, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(168, 85, 247, 0.45)',
          borderRadius: 10,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(168, 85, 247, 0.16)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          padding: 8,
          gap: 8,
        }}
      >
        {/* Search Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(12, 14, 20, 0.85)',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Search size={13} color="#a855f7" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Search nodes or press Esc..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: 11,
              outline: 'none',
              width: '100%',
              fontWeight: 500,
            }}
          />
          <button
            onClick={onClose}
            title="Cancel (Esc)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
            }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Results List */}
        <div
          style={{
            maxHeight: 250,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            paddingRight: 2,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: 10 }}>
              No matching nodes found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={item.key}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    onSelectNode(item.key);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.18)' : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(168, 85, 247, 0.4)'
                      : '1px solid transparent',
                    color: isSelected ? '#ffffff' : '#e2e8f0',
                    transition: 'all 80ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 2,
                        backgroundColor: item.color,
                        boxShadow: isSelected ? `0 0 8px ${item.color}` : 'none',
                      }}
                    />
                    <span style={{ fontWeight: isSelected ? 600 : 500 }}>{item.name}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.shortcut && (
                      <span
                        style={{
                          fontSize: 8,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: isSelected ? '#ffffff' : '#94a3b8',
                          background: isSelected ? 'rgba(168, 85, 247, 0.3)' : 'rgba(0, 0, 0, 0.35)',
                          padding: '1px 5px',
                          borderRadius: 3,
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        {item.shortcut}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 9,
                        color: isSelected ? '#a855f7' : '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      {item.cat}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#64748b',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'monospace', background: 'rgba(255, 255, 255, 0.06)', padding: '1px 3px', borderRadius: 2 }}>↑↓</span>
            <span>Navigate</span>
            <span style={{ fontFamily: 'monospace', background: 'rgba(255, 255, 255, 0.06)', padding: '1px 3px', borderRadius: 2, marginLeft: 4 }}>
              <CornerDownLeft size={8} style={{ display: 'inline' }} />
            </span>
            <span>Spawn</span>
          </div>
          <span style={{ color: '#94a3b8' }}>Esc Cancel</span>
        </div>
      </div>
    </>
  );
};
