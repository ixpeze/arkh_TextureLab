// src/features/inspector/InspectorPanel.tsx
import React, { useState } from 'react';
import { Eye, BarChart2, Sliders } from 'lucide-react';
import type { FloatingDetailsPanelProps, ChannelKey } from './types';
import { ViewportTab } from './ViewportTab';
import { HistogramTab } from './HistogramTab';
import { PropertiesTab } from './PropertiesTab';
import { Segmented } from '../../ui/Segmented';
import { useAppStore } from '../../store/useAppStore';

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
  const inspectorTab = useAppStore((s) => s.inspectorTab);
  const setInspectorTab = useAppStore((s) => s.setInspectorTab);

  const [isolatedChannel, setIsolatedChannel] = useState<ChannelKey>('RGBA');
  const [isPixelExact, setIsPixelExact] = useState(false);

  return (
    <div className="tl-inspector-panel" role="region" aria-label="Inspector Panel">
      {/* Tab Switcher: Preview | Histogram | Properties */}
      <div className="tl-inspector-header">
        <Segmented<'preview' | 'histogram' | 'properties'>
          items={[
            {
              value: 'preview',
              label: (
                <span className="tl-inspector-tab-label">
                  <Eye size={12} />
                  <span>Preview</span>
                </span>
              ),
              title: '2D Viewport & Visual Tools',
            },
            {
              value: 'histogram',
              label: (
                <span className="tl-inspector-tab-label">
                  <BarChart2 size={12} />
                  <span>Histogram</span>
                </span>
              ),
              title: 'Pixel Distribution & Stats',
            },
            {
              value: 'properties',
              label: (
                <span className="tl-inspector-tab-label">
                  <Sliders size={12} />
                  <span>Properties</span>
                </span>
              ),
              title: 'Node Settings & Ports',
            },
          ]}
          value={inspectorTab}
          onChange={setInspectorTab}
        />
      </div>

      {/* Panel Scrollable Body */}
      <div className="tl-inspector-body">
        {inspectorTab === 'preview' && (
          <ViewportTab
            activeBuffer={activeBuffer}
            isolatedChannel={isolatedChannel}
            setIsolatedChannel={setIsolatedChannel}
            isPixelExact={isPixelExact}
            setIsPixelExact={setIsPixelExact}
          />
        )}

        {inspectorTab === 'histogram' && (
          <HistogramTab
            activeBuffer={activeBuffer}
            isolatedChannel={isolatedChannel}
          />
        )}

        {inspectorTab === 'properties' && (
          <div className="tl-inspector-props">
            {selectedNode ? (
              <PropertiesTab
                selectedNode={selectedNode}
                nodes={nodes}
                edges={edges}
                primaryAsset={primaryAsset}
                activeBuffer={activeBuffer}
                onUpdateNodeData={onUpdateNodeData}
                onExportTarget={onExportTarget}
              />
            ) : (
              <div className="tl-inspector-empty">
                <span>Select a node to inspect its parameters and connections.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
