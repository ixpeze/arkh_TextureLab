import React, { useState, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { SlidersHorizontal } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeDualSocket } from '../node-system/NodeSocket';
import { NodeSlider, NodeBadge, NodeDivider } from '../node-system/NodeControls';

import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface LevelsNodeData {
  title?: string;
  blackPoint?: number;
  gamma?: number;
  whitePoint?: number;
  outBlack?: number;
  outWhite?: number;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (params: {
    blackPoint: number;
    gamma: number;
    whitePoint: number;
    outBlack: number;
    outWhite: number;
  }) => void;
}

export const LevelsNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as LevelsNodeData) || {};
  const { onUpdateNodeData } = useNodeBuffers();
  const [black, setBlack] = useState(d.blackPoint ?? 0);
  const [gamma, setGamma] = useState(d.gamma ?? 1.0);
  const [white, setWhite] = useState(d.whitePoint ?? 255);
  const [outBlack, setOutBlack] = useState(d.outBlack ?? 0);
  const [outWhite, setOutWhite] = useState(d.outWhite ?? 255);
  const isBypassed = !!d.isBypassed;

  const triggerChange = (
    newBlack = black,
    newGamma = gamma,
    newWhite = white,
    newOutBlack = outBlack,
    newOutWhite = outWhite
  ) => {
    const patch = {
      blackPoint: newBlack,
      gamma: newGamma,
      whitePoint: newWhite,
      outBlack: newOutBlack,
      outWhite: newOutWhite,
    };
    d.onChange?.(patch);
    onUpdateNodeData(id, patch);
  };

  const handleBlack = (val: number) => {
    setBlack(val);
    triggerChange(val, gamma, white, outBlack, outWhite);
  };

  const handleGamma = (val: number) => {
    setGamma(val);
    triggerChange(black, val, white, outBlack, outWhite);
  };

  const handleWhite = (val: number) => {
    setWhite(val);
    triggerChange(black, gamma, val, outBlack, outWhite);
  };

  const handleOutBlack = (val: number) => {
    setOutBlack(val);
    triggerChange(black, gamma, white, val, outWhite);
  };

  const handleOutWhite = (val: number) => {
    setOutWhite(val);
    triggerChange(black, gamma, white, outBlack, val);
  };

  // Generate SVG points for dynamic transfer curve preview with in/out range remapping
  const curvePath = useMemo(() => {
    const w = 156;
    const h = 34;
    const points: string[] = [];
    const inRange = Math.max(1, white - black);
    const outRange = outWhite - outBlack;

    for (let x = 0; x <= w; x += 4) {
      const inVal = (x / w) * 255;
      let norm = (inVal - black) / inRange;
      norm = Math.min(1.0, Math.max(0.0, norm));
      const adjusted = Math.pow(norm, 1.0 / gamma);
      const remapped = outBlack + adjusted * outRange;
      const clamped = Math.min(255, Math.max(0, remapped));

      const normY = clamped / 255;
      const y = h - normY * (h - 6) - 3;
      points.push(`${x},${y.toFixed(1)}`);
    }

    return `M ${points.join(' L ')}`;
  }, [black, gamma, white, outBlack, outWhite]);

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Levels (Remap)'}
      icon={<SlidersHorizontal size={11} />}
      accentColor="var(--pbr-rough)"
      headerAction={<NodeBadge color="var(--pbr-rough)">REMAP</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Sockets Row with Dual Horizontal Hit-Zones */}
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-rough)' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-rough)' }}
        centerLabel="Levels"
      />

      <NodeDivider />

      {/* Dynamic Mini Transfer Curve Visualizer with Output Bounds */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: 34,
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
        <svg width="156" height="34" style={{ display: 'block' }}>
          {/* Subtle grid lines */}
          <line x1="39" y1="0" x2="39" y2="34" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="78" y1="0" x2="78" y2="34" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="117" y1="0" x2="117" y2="34" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
          <line x1="0" y1="17" x2="156" y2="17" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />

          {/* Out Black and Out White horizontal guide bounds */}
          {outBlack > 0 && (
            <line
              x1="0"
              y1={34 - (outBlack / 255) * 28 - 3}
              x2="156"
              y2={34 - (outBlack / 255) * 28 - 3}
              stroke="rgba(56, 189, 248, 0.3)"
              strokeDasharray="1 3"
            />
          )}
          {outWhite < 255 && (
            <line
              x1="0"
              y1={34 - (outWhite / 255) * 28 - 3}
              x2="156"
              y2={34 - (outWhite / 255) * 28 - 3}
              stroke="rgba(250, 204, 21, 0.3)"
              strokeDasharray="1 3"
            />
          )}

          {/* Transfer curve */}
          <path
            d={curvePath}
            fill="none"
            stroke="var(--pbr-rough)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>

        {/* Dynamic metadata overlay */}
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
          γ {gamma.toFixed(2)} | [{outBlack}..{outWhite}]
        </div>
      </div>

      <NodeDivider />

      {/* Input Clamping Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NodeSlider
          label="In Black"
          min={0}
          max={254}
          step={1}
          value={black}
          defaultValue={0}
          accentColor="#38bdf8"
          onChange={handleBlack}
        />
        <NodeSlider
          label="Gamma"
          min={0.1}
          max={3.0}
          step={0.05}
          value={gamma}
          defaultValue={1.0}
          accentColor="var(--pbr-rough)"
          onChange={handleGamma}
        />
        <NodeSlider
          label="In White"
          min={1}
          max={255}
          step={1}
          value={white}
          defaultValue={255}
          accentColor="#facc15"
          onChange={handleWhite}
        />
      </div>

      <NodeDivider />

      {/* Output Range Remapping Sliders (Essential for PBR roughness clamping) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NodeSlider
          label="Out Min (Black)"
          min={0}
          max={255}
          step={1}
          value={outBlack}
          defaultValue={0}
          accentColor="#94a3b8"
          onChange={handleOutBlack}
        />
        <NodeSlider
          label="Out Max (White)"
          min={0}
          max={255}
          step={1}
          value={outWhite}
          defaultValue={255}
          accentColor="#e2e8f0"
          onChange={handleOutWhite}
        />
      </div>
    </NodeCard>
  );
};
