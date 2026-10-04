import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  BarChart2,
  Crosshair,
} from 'lucide-react';
import type { FloatingDetailsPanelProps, ChannelKey } from './types';
import { ViewportTab } from './ViewportTab';
import { HistogramTab } from './HistogramTab';
import { PropertiesTab } from './PropertiesTab';

export const InspectorPanel: React.FC<FloatingDetailsPanelProps> = ({
  selectedNode,
  nodes,
  primaryAsset,
  onAssetChange: _onAssetChange,
  activeBuffer,
  edges,
  onUpdateNodeData,
  onExportTarget,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isolatedChannel, setIsolatedChannel] = useState<ChannelKey>('RGBA');
  const [isPixelExact, setIsPixelExact] = useState(false);
  const [activeTab, setActiveTab] = useState<'viewport' | 'histogram'>('viewport');

  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        right: 16,
        bottom: 24,
        zIndex: 20,
        display: 'flex',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      {/* Collapse / Expand Tab Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          pointerEvents: 'auto',
          width: 22,
          height: 48,
          backgroundColor: '#141822',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginTop: 12,
          boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.5)',
        }}
        title={isOpen ? 'Collapse Inspector Panel' : 'Expand Inspector Panel'}
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Main Slide-in Panel */}
      {isOpen && (
        <div
          style={{
            pointerEvents: 'auto',
            width: 330,
            maxHeight: '100%',
            backgroundColor: '#0f121a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0 8px 8px 8px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header & Tab Buttons */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(20, 24, 34, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={13} color="#38bdf8" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', letterSpacing: 0.5 }}>
                INSPECTOR
              </span>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setActiveTab('viewport')}
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 3,
                  fontSize: 8.5,
                  fontWeight: 700,
                  backgroundColor: activeTab === 'viewport' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: activeTab === 'viewport' ? '1px solid #38bdf8' : '1px solid transparent',
                  color: activeTab === 'viewport' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Crosshair size={10} />
                <span>2D View</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('histogram')}
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 3,
                  fontSize: 8.5,
                  fontWeight: 700,
                  backgroundColor: activeTab === 'histogram' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: activeTab === 'histogram' ? '1px solid #38bdf8' : '1px solid transparent',
                  color: activeTab === 'histogram' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <BarChart2 size={10} />
                <span>Histogram</span>
              </button>
            </div>
          </div>

          {/* Panel Body (Scrollable) */}
          <div
            style={{
              padding: '12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Viewport or Histogram visualizer */}
            {activeTab === 'viewport' ? (
              <ViewportTab
                activeBuffer={activeBuffer}
                isolatedChannel={isolatedChannel}
                setIsolatedChannel={setIsolatedChannel}
                isPixelExact={isPixelExact}
                setIsPixelExact={setIsPixelExact}
              />
            ) : (
              <HistogramTab
                activeBuffer={activeBuffer}
                isolatedChannel={isolatedChannel}
              />
            )}

            {/* Properties and Telemetry */}
            {selectedNode && (
              <PropertiesTab
                selectedNode={selectedNode}
                nodes={nodes}
                edges={edges}
                primaryAsset={primaryAsset}
                activeBuffer={activeBuffer}
                onUpdateNodeData={onUpdateNodeData}
                onExportTarget={onExportTarget}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
