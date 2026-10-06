import React from 'react';
import type { Node } from '@xyflow/react';
import { Layers, Check, AlertCircle } from 'lucide-react';
import type { PreflightOutputItem } from '../../types/export';

export interface PreflightTableProps {
  outputNodes: Node[];
  preflightItems: PreflightOutputItem[];
  defaultFormat: string;
  onToggleAll: (enabled: boolean) => void;
  onUpdateNodeData?: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const PreflightTable: React.FC<PreflightTableProps> = ({
  outputNodes,
  preflightItems,
  defaultFormat,
  onToggleAll,
  onUpdateNodeData,
}) => {
  const readyCount = preflightItems.filter((i) => i.enabled && i.isConnected).length;

  return (
    <div
      style={{
        backgroundColor: 'rgba(20, 24, 34, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={11} color="#38bdf8" />
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
            Graph Output Maps ({outputNodes.length} Detected)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 8.5 }}>
          <button
            type="button"
            onClick={() => onToggleAll(true)}
            style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
          >
            Select All
          </button>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
          <button
            type="button"
            onClick={() => onToggleAll(false)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            Deselect All
          </button>
        </div>
      </div>

      {preflightItems.length > 0 ? (
        <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 5, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 9 }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(12, 14, 20, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '7px 10px', width: 30, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={readyCount === preflightItems.length && preflightItems.length > 0}
                    onChange={(e) => onToggleAll(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '7px 10px' }}>Target Map Slot</th>
                <th style={{ padding: '7px 10px' }}>Connection</th>
                <th style={{ padding: '7px 10px' }}>Format</th>
                <th style={{ padding: '7px 10px' }}>Color Space</th>
                <th style={{ padding: '7px 10px' }}>Resolution</th>
                <th style={{ padding: '7px 10px' }}>Resolved Filename / Subfolder</th>
              </tr>
            </thead>
            <tbody>
              {preflightItems.map((item) => {
                const nodeData = (outputNodes.find((n) => n.id === item.nodeId)?.data as Record<string, unknown>) || {};
                const formatOverride = typeof nodeData.formatOverride === 'string' ? nodeData.formatOverride : undefined;
                const resolutionOverride = typeof nodeData.resolutionOverride === 'string' ? nodeData.resolutionOverride : undefined;

                return (
                  <tr
                    key={item.nodeId}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      backgroundColor: item.enabled ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                      opacity: item.enabled ? 1 : 0.45,
                    }}
                  >
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => onUpdateNodeData?.(item.nodeId, { enabled: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    <td style={{ padding: '7px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.slot}
                            style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.1)', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: 22, height: 22, borderRadius: 3, backgroundColor: '#0c0e14', border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="text"
                            value={item.slot}
                            onChange={(e) =>
                              onUpdateNodeData?.(item.nodeId, {
                                slot: e.target.value,
                                isSlotOverridden: true,
                              })
                            }
                            style={{
                              width: 90,
                              height: 22,
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              border: `1px solid ${item.isSlotOverridden ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                              borderRadius: 3,
                              color: item.isSlotOverridden ? '#f59e0b' : '#f8fafc',
                              fontWeight: 700,
                              fontFamily: "'Geist Mono', monospace",
                              fontSize: 9,
                              padding: '0 6px',
                            }}
                          />
                          {item.isSlotOverridden ? (
                            <span
                              style={{
                                fontSize: 7.5,
                                color: '#f59e0b',
                                fontWeight: 700,
                                fontFamily: "'Geist Mono', monospace",
                              }}
                              title="Overridden manually"
                            >
                              OVR
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 7.5,
                                color: '#4ade80',
                                fontWeight: 700,
                                fontFamily: "'Geist Mono', monospace",
                              }}
                              title="Auto-detected from input"
                            >
                              AUTO
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '7px 10px' }}>
                      {item.isConnected ? (
                        <span style={{ color: '#4ade80', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={10} strokeWidth={3} />
                          <span>READY</span>
                        </span>
                      ) : (
                        <span style={{ color: '#f87171', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={10} />
                          <span>UNWIRED</span>
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={formatOverride || 'inherit'}
                        onChange={(e) => onUpdateNodeData?.(item.nodeId, { formatOverride: e.target.value })}
                        style={{
                          backgroundColor: '#0c0e14',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 3,
                          color: '#cbd5e1',
                          fontSize: 8.5,
                          padding: '2px 4px',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="inherit">Inherit ({defaultFormat})</option>
                        <option value="PNG">PNG</option>
                        <option value="TGA">TGA</option>
                        <option value="JPG">JPG</option>
                        <option value="WEBP">WEBP</option>
                      </select>
                    </td>

                    <td style={{ padding: '7px 10px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateNodeData?.(item.nodeId, {
                            colorSpace: item.colorSpace === 'linear' ? 'sRGB' : 'linear',
                            isColorSpaceOverridden: true,
                          })
                        }
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: 8,
                          fontWeight: 700,
                          fontFamily: "'Geist Mono', monospace",
                          backgroundColor: item.colorSpace === 'sRGB' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          border: `1px solid ${item.colorSpace === 'sRGB' ? '#facc15' : '#38bdf8'}`,
                          color: item.colorSpace === 'sRGB' ? '#facc15' : '#38bdf8',
                          cursor: 'pointer',
                        }}
                      >
                        {item.colorSpace.toUpperCase()}
                      </button>
                    </td>

                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={resolutionOverride || 'inherit'}
                        onChange={(e) => onUpdateNodeData?.(item.nodeId, { resolutionOverride: e.target.value })}
                        style={{
                          backgroundColor: '#0c0e14',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 3,
                          color: resolutionOverride && resolutionOverride !== 'inherit' ? '#38bdf8' : '#cbd5e1',
                          fontSize: 8.5,
                          fontFamily: "'Geist Mono', monospace",
                          padding: '2px 4px',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="inherit">Inherit ({item.resolution})</option>
                        <option value="512">512</option>
                        <option value="1024">1K (1024)</option>
                        <option value="2048">2K (2048)</option>
                        <option value="4096">4K (4096)</option>
                        <option value="8192">8K (8192)</option>
                      </select>
                    </td>

                    <td style={{ padding: '7px 10px', fontFamily: "'Geist Mono', monospace", color: '#f8fafc', fontWeight: 600 }}>
                      {item.resolvedFilename}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            padding: '28px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            color: '#64748b',
            fontSize: 9.5,
          }}
        >
          <AlertCircle size={22} color="#f87171" />
          <span>No Texture Output nodes found in the current canvas graph.</span>
          <span style={{ fontSize: 8.5 }}>Add a &quot;Texture Output&quot; node to the canvas to connect and export maps.</span>
        </div>
      )}
    </div>
  );
};
