import React, { useState, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { SlidersHorizontal } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeSlider, NodeBadge, NodeDivider } from '../node-system/NodeControls';

export interface LevelsNodeData {
  title?: string;
  blackPoint?: number;
  gamma?: number;
  whitePoint?: number;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (params: { blackPoint: number; gamma: number; whitePoint: number }) => void;
}

export const LevelsNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as LevelsNodeData) || {};
  const [black, setBlack] = useState(d.blackPoint ?? 0);
  const [gamma, setGamma] = useState(d.gamma ?? 1.0);
  const [white, setWhite] = useState(d.whitePoint ?? 255);
  const isBypassed = !!d.isBypassed;

  const handleBlack = (val: number) => {
    setBlack(val);
    d.onChange?.({ blackPoint: val, gamma, whitePoint: white });
  };

  const handleGamma = (val: number) => {
    setGamma(val);
    d.onChange?.({ blackPoint: black, gamma: val, whitePoint: white });
  };

  const handleWhite = (val: number) => {
    setWhite(val);
    d.onChange?.({ blackPoint: black, gamma: val, whitePoint: val });
  };

  // Generate SVG points for dynamic transfer curve preview (width 156 x height 32)
  const curvePath = useMemo(() => {
    const w = 156;
    const h = 32;
    const points: string[] = [];
    const range = Math.max(1, white - black);

    for (let x = 0; x <= w; x += 4) {
      const inVal = (x / w) * 255;
      let norm = (inVal - black) / range;
      norm = Math.min(1.0, Math.max(0.0, norm));
      const outVal = Math.pow(norm, 1.0 / gamma);
      const y = h - outVal * (h - 4) - 2; // inverted for SVG coordinates
      points.push(`${x},${y.toFixed(1)}`);
    }

    return `M ${points.join(' L ')}`;
  }, [black, gamma, white]);

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Levels (Remap)'}
      icon={<SlidersHorizontal size={11} />}
      accentColor="var(--pbr-rough)"
      headerAction={<NodeBadge color="var(--pbr-rough)">REMAP</NodeBadge>}
      isBypassed={isBypassed}
      width={172}
    >
      {/* Sockets Row with Dual Horizontal Hit-Zones */}
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-rough)' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-rough)' }}
        centerLabel="Remap"
      />

      <NodeDivider />

      {/* Dynamic Mini Transfer Curve Visualizer */}
      <div
        style={{
          width: '100%',
          height: 32,
          backgroundColor: '#0c0e14',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="156" height="32" style={{ display: 'block' }}>
          {/* Subtle grid lines */}
          <line x1="39" y1="0" x2="39" y2="32" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="78" y1="0" x2="78" y2="32" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="117" y1="0" x2="117" y2="32" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="0" y1="16" x2="156" y2="16" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />

          {/* Transfer curve */}
          <path
            d={curvePath}
            fill="none"
            stroke="var(--pbr-rough)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>

        {/* Dynamic Black/White markers */}
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 4,
            fontSize: 7.5,
            fontFamily: 'monospace',
            color: '#64748b',
          }}
        >
          γ {gamma.toFixed(2)}
        </div>
      </div>

      <NodeDivider />

      {/* Compact Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NodeSlider
          label="Black Point"
          min={0}
          max={254}
          step={1}
          value={black}
          accentColor="#38bdf8"
          onChange={handleBlack}
        />
        <NodeSlider
          label="Gamma"
          min={0.1}
          max={3.0}
          step={0.05}
          value={gamma}
          accentColor="var(--pbr-rough)"
          onChange={handleGamma}
        />
        <NodeSlider
          label="White Point"
          min={1}
          max={255}
          step={1}
          value={white}
          accentColor="#facc15"
          onChange={handleWhite}
        />
      </div>
    </NodeCard>
  );
};
