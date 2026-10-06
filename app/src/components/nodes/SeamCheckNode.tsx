import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Grid, Eye } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface SeamCheckNodeData {
  title?: string;
  repeats?: 2 | 3 | 4;
  showBorders?: boolean;
  channel?: 'all' | 'r' | 'g' | 'b' | 'a';
  isBypassed?: boolean;
}

export const SeamCheckNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as SeamCheckNodeData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData, evaluatedBuffers } = useNodeBuffers();

  const [repeats, setRepeats] = useState<2 | 3 | 4>(d.repeats ?? 2);
  const [showBorders, setShowBorders] = useState<boolean>(d.showBorders !== false);

  const update = (patch: Partial<SeamCheckNodeData>) => {
    onUpdateNodeData(id, patch);
  };

  const previewBuf = evaluatedBuffers[id];

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Seam Check'}
      icon={<Grid size={11} />}
      accentColor="#f59e0b"
      headerAction={<NodeBadge color="#f59e0b">{repeats}×{repeats}</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Input Socket */}
      <NodeSocket id="input" type="target" label="Texture In" color="#ffffff" shape="diamond" />

      <NodeDivider />

      {/* Repeat Factor & Boundary Controls */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>TILED REPEAT</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {([2, 3, 4] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRepeats(r);
                  update({ repeats: r });
                }}
                style={{
                  background: repeats === r ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${repeats === r ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                  color: repeats === r ? '#f59e0b' : '#94a3b8',
                  borderRadius: 2,
                  fontSize: 7.5,
                  padding: '1px 5px',
                  cursor: 'pointer',
                  fontWeight: repeats === r ? 700 : 500,
                }}
              >
                {r}×{r}
              </button>
            ))}
          </div>
        </div>

        {/* Boundary Lines Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7.5, color: '#cbd5e1', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBorders}
            onChange={(e) => {
              setShowBorders(e.target.checked);
              update({ showBorders: e.target.checked });
            }}
            style={{ accentColor: '#f59e0b', width: 11, height: 11 }}
          />
          <span>Show Seam Discontinuity Lines</span>
        </label>
      </div>

      {/* Tiled Seam Preview Thumbnail */}
      {previewBuf?.dataUrl && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 60,
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 4,
          }}
        >
          <img
            src={previewBuf.dataUrl}
            alt="Tiled seam preview"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {/* Non-Exporting Telemetry Tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 4px',
          background: 'rgba(245, 158, 11, 0.08)',
          borderRadius: 2,
          fontSize: 7,
          color: '#f59e0b',
        }}
      >
        <Eye size={8} />
        <span>Preview Only • Zero Export Mutation</span>
      </div>

      <NodeDivider />

      {/* Output Socket */}
      <NodeSocket id="output" type="source" label="Tiled Output" color="#ffffff" shape="diamond" />
    </NodeCard>
  );
};
