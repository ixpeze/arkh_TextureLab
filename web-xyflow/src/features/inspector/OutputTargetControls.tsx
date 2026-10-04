import React from 'react';
import type { Node } from '@xyflow/react';
import { Layers, RotateCcw } from 'lucide-react';
import { NodeSelect, NodeBadge } from '../../components/node-system/NodeControls';

export interface OutputTargetControlsProps {
  selectedNode: Node;
  effectiveSlot: string;
  effectiveColorSpace: string;
  autoDetectInfo: { slot: string; colorSpace: string; sourceLabel?: string } | null;
  onUpdateNodeData?: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const OutputTargetControls: React.FC<OutputTargetControlsProps> = ({
  selectedNode,
  effectiveSlot,
  effectiveColorSpace,
  autoDetectInfo,
  onUpdateNodeData,
}) => {
  const nodeData = (selectedNode.data as Record<string, unknown>) || {};

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        backgroundColor: 'rgba(74, 222, 128, 0.04)',
        border: '1px solid rgba(74, 222, 128, 0.2)',
        borderRadius: 6,
        padding: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Layers size={11} color="#4ade80" />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: 0.6 }}>
            OUTPUT TARGET CONFIGURATION
          </span>
        </div>
        {nodeData.isSlotOverridden ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NodeBadge color="#f59e0b">MANUAL OVERRIDE</NodeBadge>
            <button
              type="button"
              onClick={() =>
                onUpdateNodeData?.(selectedNode.id, {
                  isSlotOverridden: false,
                  slot: autoDetectInfo?.slot || 'ORM',
                  colorSpace: autoDetectInfo?.colorSpace || 'linear',
                  isColorSpaceOverridden: false,
                })
              }
              title={`Reset to auto-detected target: ${autoDetectInfo?.slot || 'ORM'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                height: 18,
                padding: '0 5px',
                borderRadius: 3,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#f59e0b',
                fontSize: 7.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={8} />
              <span>Reset</span>
            </button>
          </div>
        ) : (
          <NodeBadge color="#4ade80">
            {autoDetectInfo?.sourceLabel ? `AUTO (${autoDetectInfo.sourceLabel})` : 'AUTO-DETECTED'}
          </NodeBadge>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 500 }}>
            Target Slot Preset
          </span>
          <span style={{ fontSize: 7.5, color: nodeData.isSlotOverridden ? '#f59e0b' : '#4ade80', fontFamily: "'Geist Mono', monospace" }}>
            Effective: {effectiveSlot}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {['BaseColor', 'ORM', 'Normal', 'Roughness', 'Metallic', 'Height', 'AO', 'Emissive'].map((slotPreset) => {
            const isCurrent = effectiveSlot === slotPreset;
            const isOverridden = nodeData.isSlotOverridden && nodeData.slot === slotPreset;
            const activeColor = isOverridden ? '#f59e0b' : '#4ade80';
            return (
              <button
                key={slotPreset}
                type="button"
                onClick={() => onUpdateNodeData?.(selectedNode.id, { slot: slotPreset, isSlotOverridden: true })}
                style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 8.5,
                  fontWeight: isCurrent ? 700 : 500,
                  fontFamily: "'Geist Mono', monospace",
                  backgroundColor: isCurrent ? `${activeColor}26` : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isCurrent ? activeColor : 'rgba(255, 255, 255, 0.08)'}`,
                  color: isCurrent ? activeColor : '#cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                {slotPreset}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 500 }}>Custom Slot Identifier</span>
        <input
          type="text"
          value={nodeData.isSlotOverridden ? (typeof nodeData.slot === 'string' ? nodeData.slot : '') : effectiveSlot}
          onChange={(e) => onUpdateNodeData?.(selectedNode.id, { slot: e.target.value, isSlotOverridden: true })}
          placeholder={autoDetectInfo?.slot || 'e.g. ORM, Normal, BaseColor'}
          style={{
            height: 24,
            backgroundColor: '#0c0e14',
            border: `1px solid ${nodeData.isSlotOverridden ? 'rgba(245, 158, 11, 0.4)' : 'rgba(74, 222, 128, 0.3)'}`,
            borderRadius: 4,
            padding: '0 8px',
            color: nodeData.isSlotOverridden ? '#f59e0b' : '#4ade80',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 9.5,
            fontWeight: 600,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <NodeSelect
          label="Format Override"
          value={(typeof nodeData.formatOverride === 'string' && nodeData.formatOverride) || 'inherit'}
          options={[
            { label: 'Inherit Global', value: 'inherit' },
            { label: 'PNG (Lossless)', value: 'PNG' },
            { label: 'TGA (Uncompressed)', value: 'TGA' },
            { label: 'JPG (Compressed)', value: 'JPG' },
            { label: 'WebP (Modern)', value: 'WEBP' },
          ]}
          onChange={(val) => onUpdateNodeData?.(selectedNode.id, { formatOverride: val })}
        />
        <NodeSelect
          label="Bit Depth"
          value={(typeof nodeData.bitDepthOverride === 'string' && nodeData.bitDepthOverride) || 'inherit'}
          options={[
            { label: 'Inherit Global (8-bit)', value: 'inherit' },
            { label: '8-bit Standard', value: '8b' },
            { label: '16-bit Precision (Coming in v1.0 final)', value: '16b', disabled: true, title: 'Coming in v1.0 final' },
          ]}
          onChange={(val) => onUpdateNodeData?.(selectedNode.id, { bitDepthOverride: val })}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 500 }}>Color Space / Gamma</span>
          <span style={{ fontSize: 7.5, color: nodeData.isColorSpaceOverridden ? '#f59e0b' : '#38bdf8', fontFamily: "'Geist Mono', monospace" }}>
            {nodeData.isColorSpaceOverridden ? 'Manual' : `Auto: ${effectiveColorSpace.toUpperCase()}`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <button
            type="button"
            onClick={() => onUpdateNodeData?.(selectedNode.id, { colorSpace: 'linear', isColorSpaceOverridden: true })}
            style={{
              height: 22,
              borderRadius: 3,
              fontSize: 8.5,
              fontWeight: effectiveColorSpace === 'linear' ? 700 : 500,
              backgroundColor: effectiveColorSpace === 'linear' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${effectiveColorSpace === 'linear' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              color: effectiveColorSpace === 'linear' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Linear / Raw
          </button>
          <button
            type="button"
            onClick={() => onUpdateNodeData?.(selectedNode.id, { colorSpace: 'sRGB', isColorSpaceOverridden: true })}
            style={{
              height: 22,
              borderRadius: 3,
              fontSize: 8.5,
              fontWeight: effectiveColorSpace === 'sRGB' ? 700 : 500,
              backgroundColor: effectiveColorSpace === 'sRGB' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${effectiveColorSpace === 'sRGB' ? '#facc15' : 'rgba(255, 255, 255, 0.08)'}`,
              color: effectiveColorSpace === 'sRGB' ? '#facc15' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            sRGB (Gamma)
          </button>
        </div>
      </div>
    </div>
  );
};
