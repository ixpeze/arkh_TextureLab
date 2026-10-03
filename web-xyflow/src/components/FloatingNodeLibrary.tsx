import React, { useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  UnfoldHorizontal,
  FoldHorizontal,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
  Palette,
  Binary,
  MessageSquare,
  Shuffle,
  Scaling,
  Sparkles,
  Columns,
  Grid,
  FolderOpen,
  Wand2,
  Repeat,
  Calculator,
} from 'lucide-react';

export interface NodeCategory {
  name: string;
  items: {
    key: string;
    label: string;
    shortcut?: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }[];
}

const CATEGORIES: NodeCategory[] = [
  {
    name: 'Inputs & Constants',
    items: [
      {
        key: 'textureInput',
        label: 'Texture Input',
        shortcut: 'T',
        description: 'Load files & drag-drop with filename inference',
        icon: <Layers size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'color',
        label: 'Color',
        shortcut: '3',
        description: 'Responsive color picker with RGB/A outputs',
        icon: <Palette size={13} />,
        color: 'var(--pbr-albedo)',
      },
      {
        key: 'constantScalar',
        label: 'Constant Scalar',
        shortcut: '1',
        description: 'Single float scalar value',
        icon: <Binary size={13} />,
        color: 'var(--pbr-scalar)',
      },
    ],
  },
  {
    name: 'Channel Routing',
    items: [
      {
        key: 'channelPack',
        label: 'Channel Pack',
        shortcut: 'M',
        description: 'Pack R, G, B, A (defaults 0) into RGBA',
        icon: <FoldHorizontal size={13} />,
        color: 'var(--pbr-packed)',
      },
      {
        key: 'channelUnpack',
        label: 'Channel Unpack',
        shortcut: 'S',
        description: 'Unpack RGBA/RGB/Scalar with semantic names',
        icon: <UnfoldHorizontal size={13} />,
        color: 'var(--pbr-packed)',
      },
      {
        key: 'channelMixer',
        label: 'Channel Mixer',
        description: 'Straight-wire schematic routing & inline math',
        icon: <Shuffle size={13} />,
        color: '#818cf8',
      },
    ],
  },
  {
    name: 'Composable Math (UE5)',
    items: [
      {
        key: 'lerp',
        label: 'Lerp',
        description: 'Linear Interpolate A to B via Alpha',
        icon: <Calculator size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'multiply',
        label: 'Multiply',
        description: 'Multiply A × B (vector/scalar)',
        icon: <Calculator size={13} />,
        color: '#22c55e',
      },
      {
        key: 'add',
        label: 'Add',
        description: 'Add A + B with UE5 coercion',
        icon: <Calculator size={13} />,
        color: '#eab308',
      },
      {
        key: 'subtract',
        label: 'Subtract',
        description: 'Subtract A - B safely',
        icon: <Calculator size={13} />,
        color: '#f97316',
      },
      {
        key: 'divide',
        label: 'Divide',
        description: 'Safe division with zero protection',
        icon: <Calculator size={13} />,
        color: '#ef4444',
      },
      {
        key: 'clamp',
        label: 'Clamp',
        description: 'Clamp values to Min..Max range',
        icon: <Calculator size={13} />,
        color: '#818cf8',
      },
      {
        key: 'saturate',
        label: 'Saturate',
        description: 'Clamp values to [0.0..1.0]',
        icon: <Calculator size={13} />,
        color: '#06b6d4',
      },
      {
        key: 'power',
        label: 'Power',
        description: 'Exponential power Base^Exp',
        icon: <Calculator size={13} />,
        color: '#a855f7',
      },
      {
        key: 'oneMinus',
        label: 'One Minus',
        description: 'Invert channel 1 - X',
        icon: <Calculator size={13} />,
        color: '#ec4899',
      },
      {
        key: 'min',
        label: 'Min',
        description: 'Minimum of A and B',
        icon: <Calculator size={13} />,
        color: '#14b8a6',
      },
      {
        key: 'max',
        label: 'Max',
        description: 'Maximum of A and B',
        icon: <Calculator size={13} />,
        color: '#f59e0b',
      },
      {
        key: 'abs',
        label: 'Abs',
        description: 'Absolute value |X|',
        icon: <Calculator size={13} />,
        color: '#6366f1',
      },
    ],
  },
  {
    name: 'Adjustments & Processing',
    items: [
      {
        key: 'levels',
        label: 'Levels',
        shortcut: 'L',
        description: 'In/Out ranges, gamma & per-channel control',
        icon: <SlidersHorizontal size={13} />,
        color: 'var(--pbr-rough)',
      },
      {
        key: 'resize',
        label: 'Resize',
        description: 'Dimensions, PoT modes, and aspect ratio',
        icon: <Scaling size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'upscale',
        label: 'Upscale',
        description: 'Tiled neural super-resolution worker',
        icon: <Sparkles size={13} />,
        color: '#a855f7',
      },
      {
        key: 'normalFlip',
        label: 'Normal Green Flip',
        shortcut: 'N',
        description: 'DirectX (-Y) <=> OpenGL (+Y) & strength',
        icon: <ArrowUpDown size={13} />,
        color: 'var(--pbr-normal)',
      },
      {
        key: 'normalBlend',
        label: 'Normal Blend (RNM)',
        description: 'UE5 Reoriented Normal Mapping algorithm',
        icon: <Layers size={13} />,
        color: 'var(--pbr-normal)',
      },
    ],
  },
  {
    name: 'Inspection',
    items: [
      {
        key: 'compare',
        label: 'Compare',
        description: 'A/B wipe, side-by-side, diff & pixel probe',
        icon: <Columns size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'seamCheck',
        label: 'Seam Check',
        description: 'Repeated tiled preview & boundary overlay',
        icon: <Grid size={13} />,
        color: '#f59e0b',
      },
    ],
  },
  {
    name: 'Batch Operations',
    items: [
      {
        key: 'loadFolder',
        label: 'Load Folder',
        description: 'Recursive scan & texture-set detection',
        icon: <FolderOpen size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'normalize',
        label: 'Normalize',
        description: 'Vendor strip, GL/DX flip & PascalCase stems',
        icon: <Wand2 size={13} />,
        color: '#10b981',
      },
      {
        key: 'forEach',
        label: 'For Each',
        description: 'Loop graph over collection with progress',
        icon: <Repeat size={13} />,
        color: '#8b5cf6',
      },
      {
        key: 'batchExport',
        label: 'Batch Export',
        description: 'Template naming & collision resolution',
        icon: <Download size={13} />,
        color: '#22c55e',
      },
    ],
  },
  {
    name: 'Outputs & Frames',
    items: [
      {
        key: 'textureOutput',
        label: 'Texture Output',
        shortcut: 'O',
        description: 'Export target with token naming',
        icon: <Download size={13} />,
        color: '#4ade80',
      },
      {
        key: 'commentBox',
        label: 'Comment Box',
        shortcut: 'C',
        description: 'UE5-style framing & group container',
        icon: <MessageSquare size={13} />,
        color: '#38bdf8',
      },
    ],
  },
];


interface FloatingNodeLibraryProps {
  onSpawnNode?: (typeKey: string) => void;
}

export const FloatingNodeLibrary: React.FC<FloatingNodeLibraryProps> = ({ onSpawnNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const isDraggingRef = React.useRef(false);

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catName]: !prev[catName] }));
  };

  const handleDragStart = (e: React.DragEvent, nodeKey: string) => {
    isDraggingRef.current = true;
    e.dataTransfer.setData('application/reactflow', nodeKey);
    e.dataTransfer.setData('text/plain', nodeKey);
    e.dataTransfer.effectAllowed = 'all';
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const filterLower = search.toLowerCase();

  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        left: 16,
        bottom: 24,
        zIndex: 20,
        display: 'flex',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      {/* Main Drawer Panel */}
      <div
        style={{
          width: isOpen ? 250 : 0,
          height: '100%',
          backgroundColor: 'var(--panel-bg)',
          backdropFilter: 'blur(20px)',
          border: isOpen ? '1px solid var(--border-subtle)' : 'none',
          borderRadius: 10,
          boxShadow: isOpen ? '0 16px 40px rgba(0, 0, 0, 0.65)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '12px 14px 10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f8fafc', letterSpacing: 0.8 }}>
              NODE LIBRARY
            </span>
          </div>

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(12, 14, 20, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '5px 8px',
            }}
          >
            <Search size={12} color="#64748b" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: 10,
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Categories List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {CATEGORIES.map((cat) => {
            const visibleItems = cat.items.filter(
              (it) =>
                it.label.toLowerCase().includes(filterLower) ||
                it.description.toLowerCase().includes(filterLower)
            );

            if (visibleItems.length === 0) return null;
            const isCollapsed = !filterLower && !!collapsedCategories[cat.name];

            return (
              <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(cat.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 6px',
                    color: '#64748b',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  <span>{cat.name.toUpperCase()}</span>
                  {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {visibleItems.map((item) => (
                      <div
                        key={item.key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.key)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          if (isDraggingRef.current) return;
                          onSpawnNode?.(item.key);
                        }}
                        title={`${item.description} (Drag onto canvas or click to add)`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 9px',
                          backgroundColor: 'rgba(21, 24, 34, 0.7)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          cursor: 'grab',
                          transition: 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                          userSelect: 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(32, 38, 54, 0.95)';
                          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(21, 24, 34, 0.7)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <div
                          style={{
                            color: item.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {item.icon}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#f8fafc' }}>
                            {item.label}
                          </span>
                        </div>
                        {item.shortcut && (
                          <span
                            style={{
                              fontSize: 8,
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#94a3b8',
                              background: 'rgba(0, 0, 0, 0.35)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              padding: '1px 5px',
                              borderRadius: 3,
                            }}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapse / Expand Tab Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Collapse Library' : 'Expand Node Library'}
        style={{
          pointerEvents: 'auto',
          width: 20,
          height: 40,
          backgroundColor: 'var(--panel-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderLeft: isOpen ? 'none' : '1px solid var(--border-subtle)',
          borderRadius: isOpen ? '0 8px 8px 0' : '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          cursor: 'pointer',
          marginTop: 10,
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
          transition: 'color 120ms ease, background-color 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#f8fafc';
          e.currentTarget.style.backgroundColor = 'rgba(28, 33, 48, 0.95)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.backgroundColor = 'var(--panel-bg)';
        }}
      >
        {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </div>
  );
};
