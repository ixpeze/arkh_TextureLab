import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Shuffle } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface ChannelSwizzleData {
  title?: string;
  rSrc?: string;
  gSrc?: string;
  bSrc?: string;
  aSrc?: string;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (params: { rSrc: string; gSrc: string; bSrc: string; aSrc: string }) => void;
}

const CHANNEL_OPTIONS = [
  { label: 'R', value: 'r' },
  { label: 'G', value: 'g' },
  { label: 'B', value: 'b' },
  { label: 'A', value: 'a' },
  { label: '1-R', value: '1-r' },
  { label: '1-G', value: '1-g' },
  { label: '1-B', value: '1-b' },
  { label: '1-A', value: '1-a' },
  { label: '0 (Black)', value: '0' },
  { label: '1 (White)', value: '1' },
];

export const ChannelSwizzleNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as ChannelSwizzleData) || {};
  const [rSrc, setRSrc] = useState(d.rSrc || 'r');
  const [gSrc, setGSrc] = useState(d.gSrc || 'g');
  const [bSrc, setBSrc] = useState(d.bSrc || 'b');
  const [aSrc, setASrc] = useState(d.aSrc || 'a');
  const isBypassed = !!d.isBypassed;

  const updateRouting = (newR = rSrc, newG = gSrc, newB = bSrc, newA = aSrc) => {
    setRSrc(newR);
    setGSrc(newG);
    setBSrc(newB);
    setASrc(newA);
    d.onChange?.({ rSrc: newR, gSrc: newG, bSrc: newB, aSrc: newA });
  };

  const applyPreset = (preset: 'identity' | 'inv_g' | 'mono_r' | 'alpha_all') => {
    switch (preset) {
      case 'inv_g':
        updateRouting('r', '1-g', 'b', 'a');
        break;
      case 'mono_r':
        updateRouting('r', 'r', 'r', '1');
        break;
      case 'alpha_all':
        updateRouting('a', 'a', 'a', '1');
        break;
      case 'identity':
      default:
        updateRouting('r', 'g', 'b', 'a');
        break;
    }
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Channel Swizzle'}
      icon={<Shuffle size={11} />}
      accentColor="#818cf8"
      headerAction={<NodeBadge color="#818cf8">SWIZZLE</NodeBadge>}
      isBypassed={isBypassed}
      width={180}
    >
      {/* Input Socket */}
      <NodeSocket
        id="rgba"
        type="target"
        label="Input RGBA"
        color="var(--pbr-packed)"
        shape="diamond"
      />

      <NodeDivider />

      {/* 4-Channel Remapping Matrix */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8.5, color: 'var(--pbr-ao)', fontWeight: 700 }}>R →</span>
          <select
            value={rSrc}
            onChange={(e) => updateRouting(e.target.value, gSrc, bSrc, aSrc)}
            style={{
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              color: '#f8fafc',
              fontSize: 8.5,
              padding: '1px 3px',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8.5, color: 'var(--pbr-rough)', fontWeight: 700 }}>G →</span>
          <select
            value={gSrc}
            onChange={(e) => updateRouting(rSrc, e.target.value, bSrc, aSrc)}
            style={{
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              color: '#f8fafc',
              fontSize: 8.5,
              padding: '1px 3px',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8.5, color: 'var(--pbr-metal)', fontWeight: 700 }}>B →</span>
          <select
            value={bSrc}
            onChange={(e) => updateRouting(rSrc, gSrc, e.target.value, aSrc)}
            style={{
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              color: '#f8fafc',
              fontSize: 8.5,
              padding: '1px 3px',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8.5, color: 'var(--pbr-height)', fontWeight: 700 }}>A →</span>
          <select
            value={aSrc}
            onChange={(e) => updateRouting(rSrc, gSrc, bSrc, e.target.value)}
            style={{
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              color: '#f8fafc',
              fontSize: 8.5,
              padding: '1px 3px',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <NodeDivider />

      {/* Preset Buttons */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 3 }}
      >
        <button
          onClick={() => applyPreset('identity')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            color: '#94a3b8',
            fontSize: 7.5,
            padding: '2px 0',
            cursor: 'pointer',
          }}
        >
          RGBA
        </button>
        <button
          onClick={() => applyPreset('inv_g')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            color: '#94a3b8',
            fontSize: 7.5,
            padding: '2px 0',
            cursor: 'pointer',
          }}
        >
          1-G
        </button>
        <button
          onClick={() => applyPreset('mono_r')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            color: '#94a3b8',
            fontSize: 7.5,
            padding: '2px 0',
            cursor: 'pointer',
          }}
        >
          RRR
        </button>
        <button
          onClick={() => applyPreset('alpha_all')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            color: '#94a3b8',
            fontSize: 7.5,
            padding: '2px 0',
            cursor: 'pointer',
          }}
        >
          AAA
        </button>
      </div>

      <NodeDivider />

      {/* Output Sockets */}
      <NodeSocketGroup>
        <NodeSocket
          id="rgba"
          type="source"
          label="Swizzled RGBA"
          color="#818cf8"
          shape="diamond"
        />
        <NodeSocket
          id="r"
          type="source"
          label="R Out"
          color="var(--pbr-ao)"
        />
        <NodeSocket
          id="g"
          type="source"
          label="G Out"
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="b"
          type="source"
          label="B Out"
          color="var(--pbr-metal)"
        />
        <NodeSocket
          id="a"
          type="source"
          label="A Out"
          color="var(--pbr-height)"
        />
      </NodeSocketGroup>
    </NodeCard>
  );
};
