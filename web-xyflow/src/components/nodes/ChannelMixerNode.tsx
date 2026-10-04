import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { ChannelMixerRouting, type ChannelRouteConfig } from './ChannelMixerRouting';

export type { ChannelRouteConfig };

export interface ChannelMixerData {
  title?: string;
  isBypassed?: boolean;
  rSrc?: string; // legacy support
  gSrc?: string; // legacy support
  bSrc?: string; // legacy support
  aSrc?: string; // legacy support
  routes?: {
    r: ChannelRouteConfig;
    g: ChannelRouteConfig;
    b: ChannelRouteConfig;
    a: ChannelRouteConfig;
  };
  scalarSlots?: { id: string; name: string; value: number }[];
  exportOutputs?: string[]; // e.g. ['rgba', 'r', 'g']
}

export const ChannelMixerNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ChannelMixerData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData } = useNodeBuffers();

  const [routes, setRoutes] = useState<{
    r: ChannelRouteConfig;
    g: ChannelRouteConfig;
    b: ChannelRouteConfig;
    a: ChannelRouteConfig;
  }>(() => {
    if (d.routes) return d.routes;
    // Map from legacy rSrc/gSrc/bSrc/aSrc if present
    const parseLegacy = (token?: string, fallback = 'r'): ChannelRouteConfig => {
      if (!token) return { sources: [fallback], modifier: 'none' };
      if (token.startsWith('1-')) {
        return { sources: [token.replace('1-', '')], modifier: 'oneMinus' };
      }
      return { sources: [token], modifier: 'none' };
    };
    return {
      r: parseLegacy(d.rSrc, 'r'),
      g: parseLegacy(d.gSrc, 'g'),
      b: parseLegacy(d.bSrc, 'b'),
      a: parseLegacy(d.aSrc, 'a'),
    };
  });

  const [scalarSlots, setScalarSlots] = useState<{ id: string; name: string; value: number }[]>(
    d.scalarSlots || []
  );

  const [exportOutputs, setExportOutputs] = useState<string[]>(
    d.exportOutputs || ['rgba']
  );

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const updateRoute = (
    channel: 'r' | 'g' | 'b' | 'a',
    patch: Partial<ChannelRouteConfig>
  ) => {
    const updated = {
      ...routes,
      [channel]: { ...routes[channel], ...patch },
    };
    setRoutes(updated);
    // Maintain legacy fields for compatibility
    const legacyR = updated.r.modifier === 'oneMinus' ? `1-${updated.r.sources[0] || 'r'}` : updated.r.sources[0] || 'r';
    const legacyG = updated.g.modifier === 'oneMinus' ? `1-${updated.g.sources[0] || 'g'}` : updated.g.sources[0] || 'g';
    const legacyB = updated.b.modifier === 'oneMinus' ? `1-${updated.b.sources[0] || 'b'}` : updated.b.sources[0] || 'b';
    const legacyA = updated.a.modifier === 'oneMinus' ? `1-${updated.a.sources[0] || 'a'}` : updated.a.sources[0] || 'a';

    onUpdateNodeData(id, {
      routes: updated,
      rSrc: legacyR,
      gSrc: legacyG,
      bSrc: legacyB,
      aSrc: legacyA,
    });
  };

  const addScalarSlot = () => {
    const nextNum = scalarSlots.length + 1;
    const newSlot = { id: `s${nextNum}`, name: `Scalar ${nextNum}`, value: 1.0 };
    const updated = [...scalarSlots, newSlot];
    setScalarSlots(updated);
    onUpdateNodeData(id, { scalarSlots: updated });
  };

  const removeScalarSlot = (slotId: string) => {
    const updated = scalarSlots.filter((s) => s.id !== slotId);
    setScalarSlots(updated);
    onUpdateNodeData(id, { scalarSlots: updated });
  };

  const updateScalarValue = (slotId: string, val: number) => {
    const updated = scalarSlots.map((s) => (s.id === slotId ? { ...s, value: val } : s));
    setScalarSlots(updated);
    onUpdateNodeData(id, { scalarSlots: updated });
  };

  const toggleExportOutput = (outKey: string) => {
    const next = exportOutputs.includes(outKey)
      ? exportOutputs.filter((k) => k !== outKey)
      : [...exportOutputs, outKey];
    setExportOutputs(next);
    onUpdateNodeData(id, { exportOutputs: next });
  };

  const availableSources = [
    { id: 'r', label: 'R (Red)', color: '#ef4444' },
    { id: 'g', label: 'G (Green)', color: '#22c55e' },
    { id: 'b', label: 'B (Blue)', color: '#3b82f6' },
    { id: 'a', label: 'A (Alpha)', color: '#94a3b8' },
    ...scalarSlots.map((s) => ({ id: s.id, label: s.name, color: '#f59e0b' })),
    { id: '0', label: '0.0 (Black)', color: '#64748b' },
    { id: '1', label: '1.0 (White)', color: '#f8fafc' },
  ];

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Channel Mixer'}
      icon={<SlidersHorizontal size={11} />}
      accentColor="#818cf8"
      headerAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            className="nodrag nopan"
            onClick={() => setIsEditorOpen(!isEditorOpen)}
            style={{
              background: isEditorOpen ? 'rgba(129, 140, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isEditorOpen ? '#818cf8' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 3,
              color: isEditorOpen ? '#818cf8' : '#94a3b8',
              fontSize: 7.5,
              fontWeight: 700,
              padding: '1px 4px',
              cursor: 'pointer',
            }}
            title="Toggle Straight-Wire Routing Editor"
          >
            ROUTING
          </button>
          <NodeBadge color="#818cf8">MIXER</NodeBadge>
        </div>
      }
      isBypassed={isBypassed}
      width={220}
    >
      {/* Input Sockets: RGBA stream + individual R, G, B, A */}
      <NodeSocket
        id="rgba"
        type="target"
        label="RGBA Stream"
        color="#ffffff"
        shape="diamond"
      />

      <NodeSocketGroup>
        <NodeSocket id="r" type="target" label="R In" color="#ef4444" />
        <NodeSocket id="g" type="target" label="G In" color="#22c55e" />
        <NodeSocket id="b" type="target" label="B In" color="#3b82f6" />
        <NodeSocket id="a" type="target" label="A In" color="#94a3b8" />
      </NodeSocketGroup>

      {/* User-added Scalar Inputs */}
      {scalarSlots.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 4px' }}>
          <NodeSocket id={s.id} type="target" label={s.name} color="#f59e0b" />
          <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={s.value}
              onChange={(e) => updateScalarValue(s.id, parseFloat(e.target.value) || 0)}
              style={{
                width: 38,
                background: '#0a0d14',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: 8,
                padding: '1px 2px',
                borderRadius: 2,
              }}
            />
            <button
              type="button"
              onClick={() => removeScalarSlot(s.id)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 1 }}
              title="Remove scalar slot"
            >
              <Trash2 size={8} />
            </button>
          </div>
        </div>
      ))}

      {/* Add Scalar button */}
      <button
        type="button"
        className="nodrag nopan"
        onClick={addScalarSlot}
        style={{
          margin: '3px 4px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px dashed rgba(245, 158, 11, 0.3)',
          color: '#f59e0b',
          fontSize: 7.5,
          borderRadius: 2,
          padding: '2px 4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <Plus size={8} /> Add Scalar Slot
      </button>

      <NodeDivider />

      {/* Straight-Wire Routing Editor (Visually Distinct SVG Schematic Canvas) */}
      <ChannelMixerRouting
        routes={routes}
        exportOutputs={exportOutputs}
        availableSources={availableSources}
        updateRoute={updateRoute}
        toggleExportOutput={toggleExportOutput}
      />

      {/* Export Telemetry & Composite Export Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', fontSize: 7.5, color: '#94a3b8' }}>
        <span>Export: {exportOutputs.map((o) => o.toUpperCase()).join(', ') || 'None'}</span>
        <button
          type="button"
          onClick={() => toggleExportOutput('rgba')}
          style={{
            background: exportOutputs.includes('rgba') ? 'rgba(129, 140, 248, 0.25)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${exportOutputs.includes('rgba') ? '#818cf8' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 2,
            color: exportOutputs.includes('rgba') ? '#818cf8' : '#94a3b8',
            fontSize: 7,
            padding: '1px 4px',
            cursor: 'pointer',
          }}
        >
          {exportOutputs.includes('rgba') ? 'RGBA Active' : '+ RGBA Export'}
        </button>
      </div>

      <NodeDivider />

      {/* Output Sockets: RGBA stream, RGB, R, G, B, A */}
      <NodeSocket
        isSection
        id="rgba"
        type="source"
        label="Mixed RGBA"
        color="#ffffff"
        shape="diamond"
        sectionTag="RGBA"
      />

      <NodeSocket
        id="rgb"
        type="source"
        label="Mixed RGB"
        color="#ffffff"
        shape="diamond"
      />

      <NodeSocketGroup>
        <NodeSocket id="r" type="source" label="R Out" color="#ef4444" />
        <NodeSocket id="g" type="source" label="G Out" color="#22c55e" />
        <NodeSocket id="b" type="source" label="B Out" color="#3b82f6" />
        <NodeSocket id="a" type="source" label="A Out" color="#94a3b8" />
      </NodeSocketGroup>
    </NodeCard>
  );
};

export const ChannelSwizzleNode = ChannelMixerNode;
