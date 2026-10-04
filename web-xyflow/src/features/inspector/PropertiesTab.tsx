import React, { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Download } from 'lucide-react';
import type { TextureBuffer } from '../../engine/pixelEngine';
import { getNodePortTelemetry, autoDetectOutputRole } from '../../graph/introspect';
import { ExportEngine } from '../../engine/exportEngine';
import { PixelEngine } from '../../engine/pixelEngine';
import { OutputTargetControls } from './OutputTargetControls';

export interface PropertiesTabProps {
  selectedNode: Node;
  nodes?: Node[];
  edges?: Edge[];
  primaryAsset: string;
  activeBuffer?: TextureBuffer | null;
  onUpdateNodeData?: (nodeId: string, patch: Record<string, unknown>) => void;
  onExportTarget?: (filename: string) => void;
}

export const PropertiesTab: React.FC<PropertiesTabProps> = ({
  selectedNode,
  nodes,
  edges,
  primaryAsset,
  activeBuffer,
  onUpdateNodeData,
  onExportTarget,
}) => {
  const nodeType = selectedNode.type || '';
  const nodeData = (selectedNode.data as Record<string, unknown>) || {};

  const autoDetectInfo = useMemo(() => {
    if (selectedNode.type !== 'textureOutput' || !nodes || !edges) return null;
    return autoDetectOutputRole(selectedNode.id, nodes, edges);
  }, [selectedNode, nodes, edges]);

  const effectiveSlot = (nodeData.isSlotOverridden && typeof nodeData.slot === 'string' && nodeData.slot)
    ? nodeData.slot
    : (autoDetectInfo?.slot || (typeof nodeData.slot === 'string' ? nodeData.slot : 'ORM'));

  const effectiveColorSpace = (nodeData.isColorSpaceOverridden && typeof nodeData.colorSpace === 'string' && nodeData.colorSpace)
    ? nodeData.colorSpace
    : (autoDetectInfo?.colorSpace || (typeof nodeData.colorSpace === 'string' ? nodeData.colorSpace : 'linear'));

  const portTelemetry = useMemo(() => {
    if (!edges) return [];
    return getNodePortTelemetry(selectedNode, edges);
  }, [selectedNode, edges]);

  const evaluateFilename = () => {
    const asset = primaryAsset || 'AnthraciteConcrete';
    const res = activeBuffer ? `${Math.round(activeBuffer.width / 1024)}K` : '4K';

    if (selectedNode.type === 'textureOutput') {
      const format = (typeof nodeData.formatOverride === 'string' && nodeData.formatOverride !== 'inherit')
        ? nodeData.formatOverride
        : (typeof nodeData.format === 'string' ? nodeData.format : 'PNG');
      const ext = format.toLowerCase();
      if (typeof nodeData.outputFilename === 'string' && nodeData.outputFilename) {
        return nodeData.outputFilename;
      }
      return `T_${asset}_${effectiveSlot}_${res}.${ext}`;
    }

    let slot = 'ORMH';
    if (typeof nodeData.detectedRole === 'string' && nodeData.detectedRole) {
      slot = nodeData.detectedRole.toUpperCase();
    } else if (typeof nodeData.role === 'string' && nodeData.role) {
      slot = nodeData.role.replace(/\s+/g, '_').toUpperCase();
    } else if (selectedNode.id) {
      slot = selectedNode.id.toUpperCase();
    }
    return `T_${asset}_${slot}_${res}.png`;
  };

  const handleDownload = async () => {
    const filename = evaluateFilename();
    if (!activeBuffer) return;
    const format = (typeof nodeData.formatOverride === 'string' && nodeData.formatOverride !== 'inherit')
      ? nodeData.formatOverride
      : (typeof nodeData.format === 'string' ? nodeData.format : 'PNG');
    try {
      const blob = await ExportEngine.encodeImageBlob(activeBuffer, format as Parameters<typeof ExportEngine.encodeImageBlob>[1]);
      ExportEngine.triggerDownload(blob, filename);
    } catch {
      PixelEngine.downloadBuffer(activeBuffer, filename);
    }
    onExportTarget?.(filename);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        backgroundColor: 'rgba(20, 24, 34, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 6,
        padding: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.6 }}>
          BUFFER &amp; NODE TELEMETRY
        </span>
        {nodeData.isBypassed ? (
          <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 700 }}>MUTED / BYPASSED</span>
        ) : (
          <span style={{ fontSize: 8, color: '#38bdf8', fontWeight: 700 }}>ACTIVE</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Node ID</span>
          <span style={{ color: '#f8fafc', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>
            {selectedNode.id}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Type</span>
          <span style={{ color: '#cbd5e1', fontWeight: 500, textTransform: 'capitalize' }}>
            {nodeType}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Buffer Resolution</span>
          <span style={{ color: activeBuffer ? '#38bdf8' : '#64748b', fontWeight: 600, fontFamily: "'Geist Mono', monospace" }}>
            {activeBuffer ? `${activeBuffer.width} × ${activeBuffer.height} px (${Math.round(activeBuffer.width / 1024)}K)` : 'No Buffer Available'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Color Depth</span>
          <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
            {activeBuffer ? 'RGBA 32-bit (8bpc)' : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Uncompressed Size</span>
          <span style={{ color: '#94a3b8', fontFamily: "'Geist Mono', monospace" }}>
            {activeBuffer ? `${((activeBuffer.width * activeBuffer.height * 4) / (1024 * 1024)).toFixed(1)} MB` : '0 MB'}
          </span>
        </div>
      </div>

      {portTelemetry.length > 0 && nodeType !== 'textureOutput' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            backgroundColor: 'rgba(10, 13, 20, 0.65)',
            padding: '8px',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
              SOCKET CONNECTION TELEMETRY
            </span>
            <span style={{ fontSize: 7.5, color: '#64748b', fontFamily: "'Geist Mono', monospace" }}>
              {portTelemetry.filter((p) => p.isConnected).length}/{portTelemetry.length} Active
            </span>
          </div>

          {portTelemetry.map((port) => (
            <div
              key={port.handleId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 9,
                fontFamily: "'Geist Mono', monospace",
                padding: '4px 6px',
                borderRadius: 3,
                backgroundColor: port.isConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${port.isConnected ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: port.isConnected ? '#22c55e' : '#ef4444',
                    boxShadow: `0 0 4px ${port.isConnected ? '#22c55e' : '#ef4444'}`,
                  }}
                />
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{port.sourceLabel || port.handleId}</span>
              </div>
              <span style={{ color: port.isConnected ? '#4ade80' : '#f87171', fontSize: 8.5 }}>
                {port.isConnected ? `Connected (${port.sourceNodeId})` : `Disconnected [Fallback: ${port.fallbackValue ?? 'None'}]`}
              </span>
            </div>
          ))}
        </div>
      )}

      {nodeType === 'textureOutput' && (
        <OutputTargetControls
          selectedNode={selectedNode}
          effectiveSlot={effectiveSlot}
          effectiveColorSpace={effectiveColorSpace}
          autoDetectInfo={autoDetectInfo}
          onUpdateNodeData={onUpdateNodeData}
        />
      )}

      {activeBuffer && (
        <button
          type="button"
          onClick={handleDownload}
          style={{
            marginTop: 4,
            height: 28,
            backgroundColor: '#22c55e',
            border: 'none',
            borderRadius: 4,
            color: '#080d14',
            fontSize: 9.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: 'pointer',
          }}
        >
          <Download size={12} />
          <span>Export {evaluateFilename()}</span>
        </button>
      )}
    </div>
  );
};
