import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Palette } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

import { useNodeBuffers } from '../../context/NodeBufferContext';

export const ConstantColorNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const { onUpdateNodeData } = useNodeBuffers();
  const [color, setColor] = useState<string>(data?.color ?? '#f43f5e');

  const handleColorChange = (newColor: string) => {
    const safeColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(newColor) ? newColor : color;
    setColor(safeColor);
    onUpdateNodeData(id, { color: safeColor });
  };

  return (
    <NodeCard
      selected={selected}
      title="Constant Color"
      icon={<Palette size={11} />}
      accentColor="var(--pbr-albedo)"
      headerAction={<NodeBadge color="var(--pbr-albedo)">3</NodeBadge>}
      width={168}
    >
      {/* Color preview and native picker */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <label
          style={{
            width: 22,
            height: 18,
            borderRadius: 3,
            backgroundColor: color,
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            display: 'block',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: `0 0 8px ${color}50`,
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
          onChange={(e) => handleColorChange(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(12, 14, 20, 0.8)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            padding: '2px 5px',
            fontSize: 9,
            fontFamily: "'Geist Mono', monospace",
            color: '#f8fafc',
            outline: 'none',
            fontWeight: 600,
          }}
        />
      </div>

      <NodeDivider />

      {/* Output sockets with full-width horizontal sections */}
      <NodeSocketGroup>
        <NodeSocket
          id="rgba"
          type="source"
          label="RGB Vector"
          color="var(--pbr-packed)"
          shape="diamond"
        />
        <NodeSocket
          id="r"
          type="source"
          label="Red (R)"
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="source"
          label="Green (G)"
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="source"
          label="Blue (B)"
          color="var(--pbr-metal)"
        />
      </NodeSocketGroup>
    </NodeCard>
  );
};
