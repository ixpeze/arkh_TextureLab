import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Check, Wand2 } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface NormalizeNodeData {
  title?: string;
  flipGreen?: boolean;
  cleanStem?: boolean;
  deduplicate?: boolean;
  requiresGreenFlip?: boolean;
  isBypassed?: boolean;
}

export const NormalizeNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as NormalizeNodeData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData } = useNodeBuffers();

  const [flipGreen, setFlipGreen] = useState<boolean>(d.flipGreen !== false);
  const [cleanStem, setCleanStem] = useState<boolean>(d.cleanStem !== false);
  const [deduplicate, setDeduplicate] = useState<boolean>(d.deduplicate !== false);

  const update = (patch: Partial<NormalizeNodeData>) => {
    onUpdateNodeData(id, patch);
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Normalize'}
      icon={<Wand2 size={11} />}
      accentColor="#10b981"
      headerAction={<NodeBadge color="#10b981">CANONICAL</NodeBadge>}
      isBypassed={isBypassed}
      width={180}
    >
      {/* Input Socket: Accepts Collection or Texture Stream */}
      <NodeSocket id="input" type="target" label="Input Stream" color="#ffffff" shape="diamond" />

      <NodeDivider />

      {/* Rules Config List */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '1px 2px' }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7.5, color: '#e2e8f0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={cleanStem}
            onChange={(e) => {
              setCleanStem(e.target.checked);
              update({ cleanStem: e.target.checked });
            }}
            style={{ accentColor: '#10b981', width: 10, height: 10 }}
          />
          <span>Strip Vendor & Res Tags</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7.5, color: '#e2e8f0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={flipGreen}
            onChange={(e) => {
              setFlipGreen(e.target.checked);
              update({ flipGreen: e.target.checked, requiresGreenFlip: e.target.checked });
            }}
            style={{ accentColor: '#10b981', width: 10, height: 10 }}
          />
          <span>Convert OpenGL Normals to DX</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7.5, color: '#e2e8f0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={deduplicate}
            onChange={(e) => {
              setDeduplicate(e.target.checked);
              update({ deduplicate: e.target.checked });
            }}
            style={{ accentColor: '#10b981', width: 10, height: 10 }}
          />
          <span>Deduplicate GL/DX Variants</span>
        </label>
      </div>

      {/* Policy Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          marginTop: 4,
          padding: '2px 4px',
          background: 'rgba(16, 185, 129, 0.08)',
          borderRadius: 2,
          fontSize: 7,
          color: '#34d399',
        }}
      >
        <Check size={8} />
        <span>Standard PascalCase & UE5 DX Formats</span>
      </div>

      <NodeDivider />

      {/* Output Socket */}
      <NodeSocket id="output" type="source" label="Normalized Stream" color="#10b981" shape="diamond" />
    </NodeCard>
  );
};
