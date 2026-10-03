import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { SlidersHorizontal, Plus, Trash2, Download } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';

export interface ChannelRouteConfig {
  sources: string[]; // e.g. ['r'], ['r', 'g'], ['s1']
  combineOp?: 'add' | 'multiply' | 'min' | 'max';
  modifier?: 'none' | 'oneMinus' | 'add' | 'multiply' | 'clamp' | 'saturate';
  modifierVal?: number;
}

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

const MODIFIERS = [
  { label: 'None', value: 'none' },
  { label: '1 - X', value: 'oneMinus' },
  { label: '+ Add', value: 'add' },
  { label: '× Mult', value: 'multiply' },
  { label: 'Clamp', value: 'clamp' },
  { label: 'Sat', value: 'saturate' },
];

const COMBINE_OPS = [
  { label: '+ Add', value: 'add' },
  { label: '× Mul', value: 'multiply' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
];

export const ChannelMixerNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ChannelMixerData) || {};
  const isBypassed = !!d.isBypassed;
  const { onUpdateNodeData } = useNodeBuffers();
  void COMBINE_OPS;

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
      <div
        className="nodrag nopan"
        style={{
          background: 'rgba(6, 8, 12, 0.95)',
          border: '1px solid rgba(129, 140, 248, 0.25)',
          borderRadius: 4,
          padding: '4px',
          margin: '3px 0',
        }}
      >
        {/* Schematic straight wire display */}
        <div style={{ position: 'relative', height: 42, width: '100%', marginBottom: 4 }}>
          <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* Draw straight lines representing active routing from left inputs to right outputs */}
            {(['r', 'g', 'b', 'a'] as const).map((ch, outIdx) => {
              const y2 = 6 + outIdx * 10;
              const route = routes[ch];
              const outColors = { r: '#ef4444', g: '#22c55e', b: '#3b82f6', a: '#94a3b8' };
              const inPositions: Record<string, number> = { r: 6, g: 16, b: 26, a: 36 };

              return route.sources.map((src, srcIdx) => {
                const y1 = inPositions[src] ?? 20;
                return (
                  <line
                    key={`${ch}-${src}-${srcIdx}`}
                    x1="12"
                    y1={y1}
                    x2="190"
                    y2={y2}
                    stroke={outColors[ch]}
                    strokeWidth="1.2"
                    strokeDasharray={route.modifier !== 'none' ? '3,2' : undefined}
                    opacity="0.85"
                  />
                );
              });
            })}
            {/* Straight wire connector pins */}
            {[6, 16, 26, 36].map((y, i) => (
              <circle key={`in-${i}`} cx="12" cy={y} r="2.5" fill="#818cf8" />
            ))}
            {[6, 16, 26, 36].map((y, i) => (
              <circle key={`out-${i}`} cx="190" cy={y} r="2.5" fill="#38bdf8" />
            ))}
          </svg>
          <div style={{ position: 'absolute', top: 1, left: 16, fontSize: 6.5, color: '#64748b' }}>IN</div>
          <div style={{ position: 'absolute', top: 1, right: 16, fontSize: 6.5, color: '#64748b' }}>OUT</div>
        </div>

        {/* Per-Channel Routing & Modifier Controls */}
        {(['r', 'g', 'b', 'a'] as const).map((ch) => {
          const route = routes[ch];
          const chColor = ch === 'r' ? '#ef4444' : ch === 'g' ? '#22c55e' : ch === 'b' ? '#3b82f6' : '#94a3b8';
          const isExported = exportOutputs.includes(ch);

          return (
            <div
              key={ch}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 52px 42px 1fr 18px',
                alignItems: 'center',
                gap: 3,
                marginBottom: 3,
                padding: '1px 2px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 2,
              }}
            >
              {/* Channel Label */}
              <span style={{ fontSize: 8.5, color: chColor, fontWeight: 700 }}>{ch.toUpperCase()}</span>

              {/* Source Selection (Fan-out supported) */}
              <select
                value={route.sources[0] || ch}
                onChange={(e) => updateRoute(ch, { sources: [e.target.value] })}
                style={{
                  background: '#0c0e14',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  color: '#f8fafc',
                  fontSize: 7.5,
                  padding: '1px',
                  fontFamily: 'monospace',
                }}
              >
                {availableSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Inline Modifier */}
              <select
                value={route.modifier || 'none'}
                onChange={(e) => updateRoute(ch, { modifier: e.target.value as any })}
                style={{
                  background: '#0c0e14',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  color: route.modifier && route.modifier !== 'none' ? '#38bdf8' : '#94a3b8',
                  fontSize: 7.5,
                  padding: '1px',
                }}
              >
                {MODIFIERS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Modifier Value or Combine Op */}
              {route.modifier === 'add' || route.modifier === 'multiply' ? (
                <input
                  type="number"
                  step="0.1"
                  value={route.modifierVal ?? (route.modifier === 'add' ? 0.2 : 1.5)}
                  onChange={(e) => updateRoute(ch, { modifierVal: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    background: '#0c0e14',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    color: '#fff',
                    fontSize: 7.5,
                    padding: '1px 2px',
                  }}
                />
              ) : (
                <span style={{ fontSize: 7, color: '#475569', fontStyle: 'italic' }}>direct</span>
              )}

              {/* Export Checkbox */}
              <button
                type="button"
                onClick={() => toggleExportOutput(ch)}
                title={isExported ? `Export ${ch.toUpperCase()} output` : `Exclude ${ch.toUpperCase()} from export`}
                style={{
                  background: isExported ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: `1px solid ${isExported ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: isExported ? '#38bdf8' : '#64748b',
                  borderRadius: 2,
                  width: 14,
                  height: 14,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Download size={7} />
              </button>
            </div>
          );
        })}
      </div>

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
