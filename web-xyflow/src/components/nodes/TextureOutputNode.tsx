import React from 'react';
import { type NodeProps, useNodeConnections } from '@xyflow/react';
import { Download, AlertCircle, Layers } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import type { LocalOutputData } from '../../types/export';

export const TextureOutputNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = data as LocalOutputData;
  const { evaluatedBuffers } = useNodeBuffers();

  const myBuffer = evaluatedBuffers[id];
  const previewUrl = myBuffer?.dataUrl;

  const conns = useNodeConnections({ handleType: 'target', handleId: 'rgba' });
  const isConnected = conns.length > 0;

  const currentSlot = d.slot || 'ORM';
  const currentFormat =
    d.formatOverride && d.formatOverride !== 'inherit' ? d.formatOverride : 'PNG';
  const currentBitDepth =
    d.bitDepthOverride && d.bitDepthOverride !== 'inherit' ? d.bitDepthOverride : '8b';
  const currentColorSpace = d.colorSpace ? d.colorSpace.toUpperCase() : 'LINEAR';

  const headerBadges = (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      <NodeBadge color="#4ade80" variant="solid">
        {currentSlot}
      </NodeBadge>
      <NodeBadge color="#38bdf8">{currentFormat}</NodeBadge>
      <NodeBadge color="#94a3b8">{currentBitDepth}</NodeBadge>
    </div>
  );

  return (
    <NodeCard
      selected={selected}
      title="Texture Output"
      icon={<Download size={11} />}
      accentColor="#4ade80"
      headerAction={headerBadges}
      width={184}
    >
      {/* Target Input Socket with Dedicated Horizontal Section on RGBA */}
      <NodeSocket
        isSection
        id="rgba"
        type="target"
        label={isConnected ? `Input (${currentSlot})` : 'Target RGBA [Unwired]'}
        color="var(--pbr-packed)"
        shape="diamond"
        sectionTag={currentSlot}
      />

      <NodeDivider />

      {/* Live Output Preview Thumbnail / Connection Status */}
      {isConnected && previewUrl ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '6px',
            backgroundColor: 'rgba(74, 222, 128, 0.05)',
            borderRadius: 4,
            border: '1px solid rgba(74, 222, 128, 0.22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                border: '1px solid rgba(74, 222, 128, 0.4)',
                overflow: 'hidden',
                backgroundColor: '#0a0c12',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
              }}
            >
              <img
                src={previewUrl}
                alt="Target Output Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8, color: '#4ade80', fontWeight: 700, letterSpacing: '0.04em' }}>
                  READY TO EXPORT
                </span>
                <span
                  style={{
                    fontSize: 7.5,
                    fontFamily: "'Geist Mono', monospace",
                    color: '#94a3b8',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    padding: '0.5px 3px',
                    borderRadius: 2,
                  }}
                >
                  {currentColorSpace}
                </span>
              </div>
              <span
                style={{
                  fontSize: 8.5,
                  fontFamily: "'Geist Mono', monospace",
                  color: '#f8fafc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={d.outputFilename || `${currentSlot}.${currentFormat.toLowerCase()}`}
              >
                {d.outputFilename || `${currentSlot}.${currentFormat.toLowerCase()}`}
              </span>
            </div>
          </div>

          {/* Telemetry info row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 8,
              color: '#94a3b8',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: 4,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Layers size={9} color="#4ade80" />
              <span>Target: {currentSlot}</span>
            </span>
            <span style={{ fontFamily: "'Geist Mono', monospace", color: '#cbd5e1' }}>
              {myBuffer ? `${myBuffer.width}×${myBuffer.height}` : '4K'}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 8px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px dashed rgba(239, 68, 68, 0.28)',
            borderRadius: 4,
          }}
        >
          <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 8, color: '#f87171', fontWeight: 700 }}>AWAITING WIRE</span>
            <span style={{ fontSize: 7.5, color: '#94a3b8', lineHeight: 1.2 }}>
              Connect RGBA stream to activate this map
            </span>
          </div>
        </div>
      )}
    </NodeCard>
  );
};
