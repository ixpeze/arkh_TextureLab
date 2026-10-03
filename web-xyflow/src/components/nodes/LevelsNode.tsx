import React, { useState } from 'react';
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
  onChange?: (params: { blackPoint: number; gamma: number; whitePoint: number }) => void;
}

export const LevelsNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const d = (data as LevelsNodeData) || {};
  const [black, setBlack] = useState(d.blackPoint ?? 0);
  const [gamma, setGamma] = useState(d.gamma ?? 1.0);
  const [white, setWhite] = useState(d.whitePoint ?? 255);

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
    d.onChange?.({ blackPoint: black, gamma, whitePoint: val });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Levels (Remap)'}
      icon={<SlidersHorizontal size={11} />}
      accentColor="var(--pbr-rough)"
      headerAction={<NodeBadge color="var(--pbr-rough)">REMAP</NodeBadge>}
      width={172}
    >
      {/* Sockets Row with Dual Horizontal Hit-Zones */}
      <NodeDualSocket
        input={{ id: 'input', label: 'In', color: 'var(--pbr-rough)' }}
        output={{ id: 'output', label: 'Out', color: 'var(--pbr-rough)' }}
        centerLabel="Remap"
      />

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
