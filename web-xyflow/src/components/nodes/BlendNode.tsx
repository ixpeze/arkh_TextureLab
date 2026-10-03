import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Blend } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeSlider, NodeSelect, NodeBadge, NodeDivider } from '../node-system/NodeControls';

import { useNodeBuffers } from '../../context/NodeBufferContext';

export type BlendMode = 'lerp' | 'multiply' | 'screen' | 'overlay' | 'add' | 'min' | 'max';

export interface BlendNodeData {
  title?: string;
  mode?: BlendMode;
  opacity?: number;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  onChange?: (params: { mode: BlendMode; opacity: number }) => void;
}

export const BlendNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as BlendNodeData) || {};
  const { onUpdateNodeData } = useNodeBuffers();
  const [mode, setMode] = useState<BlendMode>(d.mode || 'lerp');
  const [opacity, setOpacity] = useState<number>(d.opacity ?? 1.0);
  const isBypassed = !!d.isBypassed;

  const handleModeChange = (val: string) => {
    const newMode = val as BlendMode;
    setMode(newMode);
    d.onChange?.({ mode: newMode, opacity });
    onUpdateNodeData(id, { mode: newMode, opacity });
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    d.onChange?.({ mode, opacity: val });
    onUpdateNodeData(id, { mode, opacity: val });
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'PBR Texture Blend'}
      icon={<Blend size={11} />}
      accentColor="#f59e0b"
      headerAction={<NodeBadge color="#f59e0b">BLEND</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Inputs Group: Base A, Blend B, Optional Mask */}
      <NodeSocketGroup>
        <NodeSocket
          id="a"
          type="target"
          label="Base (A)"
          color="var(--pbr-albedo)"
        />
        <NodeSocket
          id="b"
          type="target"
          label="Blend (B)"
          color="var(--pbr-rough)"
        />
        <NodeSocket
          id="mask"
          type="target"
          label="Mask (Alpha)"
          color="var(--pbr-scalar)"
        />
      </NodeSocketGroup>

      <NodeDivider />

      {/* Mode Selector */}
      <NodeSelect
        label="Blend Algorithm"
        value={mode}
        options={[
          { label: 'Normal (Lerp)', value: 'lerp' },
          { label: 'Multiply', value: 'multiply' },
          { label: 'Screen', value: 'screen' },
          { label: 'Overlay', value: 'overlay' },
          { label: 'Add (Linear Dodge)', value: 'add' },
          { label: 'Darken (Min)', value: 'min' },
          { label: 'Lighten (Max)', value: 'max' },
        ]}
        onChange={handleModeChange}
      />

      <NodeDivider />

      {/* Opacity Slider */}
      <NodeSlider
        label="Opacity"
        min={0.0}
        max={1.0}
        step={0.01}
        value={opacity}
        defaultValue={1.0}
        accentColor="#f59e0b"
        onChange={handleOpacityChange}
      />

      <NodeDivider />

      {/* Output Result Socket with Dedicated Horizontal Section */}
      <NodeSocket
        isSection
        id="output"
        type="source"
        label="Blended RGBA"
        color="var(--pbr-packed)"
        shape="diamond"
        sectionTag="RESULT"
      />
    </NodeCard>
  );
};
