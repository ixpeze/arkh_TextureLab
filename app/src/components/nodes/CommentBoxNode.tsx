import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

export interface CommentBoxData {
  title?: string;
  color?: string;
  onUpdateTitle?: (title: string) => void;
  onUpdateColor?: (color: string) => void;
}

const PRESET_COLORS = [
  { label: 'Cyan', value: '#38bdf8' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Emerald', value: '#22c55e' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Slate', value: '#94a3b8' },
];

export const CommentBoxNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as CommentBoxData) || {};
  const [title, setTitle] = useState(d.title || 'Comment Group');
  const [isEditing, setIsEditing] = useState(false);
  const [currentColor, setCurrentColor] = useState(d.color || '#38bdf8');

  const handleColorChange = (c: string) => {
    setCurrentColor(c);
    d.onUpdateColor?.(c);
  };

  const handleTitleSubmit = () => {
    setIsEditing(false);
    d.onUpdateTitle?.(title);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: 220,
        minHeight: 140,
        backgroundColor: 'rgba(15, 18, 26, 0.45)',
        border: selected ? `1.5px solid ${currentColor}` : `1px solid ${currentColor}40`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: selected
          ? `0 0 0 1px ${currentColor}40, 0 8px 30px rgba(0, 0, 0, 0.5)`
          : '0 4px 20px rgba(0, 0, 0, 0.35)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        userSelect: 'none',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineStyle={{ borderColor: currentColor, opacity: 0.5 }}
        handleStyle={{
          width: 7,
          height: 7,
          borderRadius: 2,
          backgroundColor: currentColor,
          border: '1px solid #090a0f',
        }}
      />

      {/* Comment Header Bar */}
      <div
        style={{
          height: 28,
          backgroundColor: 'rgba(20, 25, 36, 0.85)',
          borderBottom: `1px solid ${currentColor}30`,
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <MessageSquare size={12} color={currentColor} />
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              style={{
                background: 'rgba(10, 12, 18, 0.9)',
                border: `1px solid ${currentColor}`,
                borderRadius: 3,
                color: '#f8fafc',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 5px',
                outline: 'none',
                width: '100%',
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditing(true)}
              title="Double-click to rename comment box"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: '#f8fafc',
                cursor: 'text',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
          )}
        </div>

        {/* Color Palette Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {PRESET_COLORS.map((pc) => (
            <div
              key={pc.value}
              onClick={() => handleColorChange(pc.value)}
              title={pc.label}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: pc.value,
                cursor: 'pointer',
                border: currentColor === pc.value ? '1.5px solid #ffffff' : '1px solid rgba(0,0,0,0.5)',
                transform: currentColor === pc.value ? 'scale(1.25)' : 'scale(1)',
                transition: 'transform 100ms ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Interior Transparent Canvas Area */}
      <div style={{ flex: 1, pointerEvents: 'none' }} />
    </div>
  );
};
