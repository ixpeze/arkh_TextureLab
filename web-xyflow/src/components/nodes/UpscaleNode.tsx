import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Sparkles, Loader2 } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { PixelEngine } from '../../engine/pixelEngine';

export interface UpscaleNodeData {
  title?: string;
  scale?: 2 | 4;
  tileSize?: number;
  model?: string;
  isBypassed?: boolean;
}

export const UpscaleNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as UpscaleNodeData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData, evaluatedBuffers, setSourceBuffer } = useNodeBuffers();

  const [scale, setScale] = useState<2 | 4>(d.scale === 4 ? 4 : 2);
  const [tileSize, setTileSize] = useState<number>(d.tileSize ?? 512);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('Ready');

  const update = (patch: Partial<UpscaleNodeData>) => {
    onUpdateNodeData(id, patch);
  };

  const handleRunUpscale = async () => {
    const inBuf = evaluatedBuffers[id];
    if (!inBuf) {
      setProgressMsg('No input buffer');
      return;
    }

    try {
      setIsProcessing(true);
      setProgressMsg(`Upscaling ${scale}x (${inBuf.width * scale}×${inBuf.height * scale})...`);
      const upscaled = await PixelEngine.upscaleBufferAsync(inBuf, scale, tileSize);
      setSourceBuffer(id, upscaled);
      setProgressMsg(`Done: ${upscaled.width}×${upscaled.height}`);
    } catch (err: any) {
      console.error(err);
      setProgressMsg(`Error: ${err?.message || 'Worker failure'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Upscale'}
      icon={<Sparkles size={11} />}
      accentColor="#a855f7"
      headerAction={<NodeBadge color="#a855f7">{scale}X</NodeBadge>}
      isBypassed={isBypassed}
      width={176}
    >
      {/* Input Socket */}
      <NodeSocket
        id="input"
        type="target"
        label="Input"
        color="#ffffff"
        shape="diamond"
      />

      <NodeDivider />

      {/* Scale & Tile Settings */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <div>
            <span style={{ fontSize: 7, color: '#94a3b8' }}>SCALE FACTOR</span>
            <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
              {([2, 4] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScale(s);
                    update({ scale: s });
                  }}
                  style={{
                    flex: 1,
                    background: scale === s ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${scale === s ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
                    color: scale === s ? '#a855f7' : '#94a3b8',
                    borderRadius: 2,
                    fontSize: 8,
                    fontWeight: scale === s ? 700 : 500,
                    padding: '2px 0',
                    cursor: 'pointer',
                  }}
                >
                  {s}X
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 7, color: '#94a3b8' }}>TILE SIZE</span>
            <select
              value={tileSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTileSize(val);
                update({ tileSize: val });
              }}
              style={{
                width: '100%',
                background: '#0c0e14',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2,
                color: '#fff',
                fontSize: 8,
                padding: '2px 1px',
                marginTop: 2,
              }}
            >
              <option value="512">512 px (Fast)</option>
              <option value="256">256 px (Safe)</option>
              <option value="128">128 px (Low VRAM)</option>
            </select>
          </div>
        </div>

        {/* Async Worker Action Button */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleRunUpscale}
          style={{
            background: isProcessing ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.2)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: 3,
            color: '#c084fc',
            fontSize: 8,
            fontWeight: 700,
            padding: '3px 0',
            cursor: isProcessing ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: 2,
          }}
        >
          {isProcessing ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
          <span>{isProcessing ? 'Processing Worker...' : 'Run Neural Upscale'}</span>
        </button>

        <span style={{ fontSize: 7, color: '#64748b', textAlign: 'center' }}>
          {progressMsg}
        </span>
      </div>

      <NodeDivider />

      {/* Output Socket */}
      <NodeSocket
        id="output"
        type="source"
        label="Upscaled"
        color="#ffffff"
        shape="diamond"
      />
    </NodeCard>
  );
};
