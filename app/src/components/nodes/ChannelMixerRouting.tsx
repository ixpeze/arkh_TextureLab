import React from 'react';
import { Download } from 'lucide-react';

export type ChannelRouteModifier = 'none' | 'oneMinus' | 'add' | 'multiply' | 'clamp' | 'saturate';

export interface ChannelRouteConfig {
  sources: string[]; // e.g. ['r'], ['r', 'g'], ['s1']
  combineOp?: 'add' | 'multiply' | 'min' | 'max';
  modifier?: ChannelRouteModifier;
  modifierVal?: number;
}

export interface SourceOption {
  id: string;
  label: string;
  color?: string;
}

export const MODIFIERS: { label: string; value: ChannelRouteModifier }[] = [
  { label: 'None', value: 'none' },
  { label: '1 - X', value: 'oneMinus' },
  { label: '+ Add', value: 'add' },
  { label: '× Mult', value: 'multiply' },
  { label: 'Clamp', value: 'clamp' },
  { label: 'Sat', value: 'saturate' },
];

export interface ChannelMixerRoutingProps {
  routes: Record<'r' | 'g' | 'b' | 'a', ChannelRouteConfig>;
  exportOutputs: string[];
  availableSources: SourceOption[];
  updateRoute: (channel: 'r' | 'g' | 'b' | 'a', patch: Partial<ChannelRouteConfig>) => void;
  toggleExportOutput: (ch: string) => void;
}

export const ChannelMixerRouting: React.FC<ChannelMixerRoutingProps> = ({
  routes,
  exportOutputs,
  availableSources,
  updateRoute,
  toggleExportOutput,
}) => {
  return (
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
          {(['r', 'g', 'b', 'a'] as const).map((ch, outIdx) => {
            const y2 = 6 + outIdx * 10;
            const route = routes[ch];
            const outColors = { r: '#ef4444', g: '#22c55e', b: '#3b82f6', a: '#94a3b8' };
            const inPositions: Record<string, number> = { r: 6, g: 16, b: 26, a: 36 };

            return route.sources.map((src: string, srcIdx: number) => {
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
            <span style={{ fontSize: 8.5, color: chColor, fontWeight: 700 }}>{ch.toUpperCase()}</span>

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

            <select
              value={route.modifier || 'none'}
              onChange={(e) => updateRoute(ch, { modifier: e.target.value as ChannelRouteModifier })}
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
  );
};
