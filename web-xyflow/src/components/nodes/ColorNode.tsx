import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Palette } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

const QUICK_SWATCHES = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Mid Gray', hex: '#808080' },
  { name: 'Black', hex: '#000000' },
  { name: 'Normal (Flat)', hex: '#8080ff' },
  { name: 'Rough 0.5', hex: '#7f7f7f' },
  { name: 'Gold', hex: '#ffd700' },
  { name: 'Copper', hex: '#c87d55' },
];

export const ColorNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const { onUpdateNodeData } = useNodeBuffers();
  const [color, setColor] = useState<string>(data?.color ?? '#ffffff');

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onUpdateNodeData(id, { color: newColor });
  };

  return (
    <NodeCard
      selected={selected}
      title="Color"
      icon={<Palette size={11} />}
      accentColor="var(--pbr-albedo)"
      headerAction={<NodeBadge color="var(--pbr-albedo)">RGB</NodeBadge>}
      width={184}
    >
      {/* Lightweight, responsive color control */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label
            style={{
              width: 24,
              height: 22,
              borderRadius: 3,
              backgroundColor: color,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'block',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: `0 0 8px ${color}40`,
              flexShrink: 0,
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => handleColorChange(e.target.value)}
              style={{
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
              }}
            />
          </label>

          <input
            type="text"
            value={color.toUpperCase()}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#?[0-9a-f]{0,6}$/i.test(val)) {
                handleColorChange(val.startsWith('#') ? val : `#${val}`);
              }
            }}
            placeholder="#FFFFFF"
            style={{
              flex: 1,
              background: 'rgba(12, 14, 20, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 9.5,
              fontFamily: "'Geist Mono', monospace",
              color: '#f8fafc',
              outline: 'none',
              fontWeight: 600,
            }}
          />
        </div>

        {/* Quick Swatches bar */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
          {QUICK_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              title={swatch.name}
              onClick={() => handleColorChange(swatch.hex)}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                backgroundColor: swatch.hex,
                border: color.toLowerCase() === swatch.hex.toLowerCase() ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <NodeDivider />

      {/* Output Sockets: Same outputs as Texture Input (RGBA, RGB, R, G, B, A) */}
      <NodeSocket
        isSection
        id="rgba"
        type="source"
        label="RGBA"
        color="#ffffff"
        shape="diamond"
        sectionTag="RGBA"
      />
      <NodeSocket
        isSection
        id="rgb"
        type="source"
        label="RGB"
        color="#ffffff"
        shape="diamond"
        sectionTag="RGB"
      />

      <NodeDivider />

      <NodeSocketGroup>
        <NodeSocket id="r" type="source" label="R" color="#ef4444" />
        <NodeSocket id="g" type="source" label="G" color="#22c55e" />
        <NodeSocket id="b" type="source" label="B" color="#3b82f6" />
        <NodeSocket id="a" type="source" label="A" color="#94a3b8" />
      </NodeSocketGroup>
    </NodeCard>
  );
};

export const ConstantColorNode = ColorNode;
