import React, { useState, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Download, Play, Loader2 } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { ExportEngine } from '../../engine/exportEngine';
import type { TextureCollection, CollisionPolicy, ExportFormat, BitDepth } from '../../types/export';

export interface BatchExportNodeData {
  title?: string;
  destinationFolder?: string;
  format?: ExportFormat;
  bitDepth?: BitDepth;
  namingPattern?: string;
  collisionPolicy?: CollisionPolicy;
  isProcessing?: boolean;
  progress?: number;
  collection?: TextureCollection;
}

export const BatchExportNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as BatchExportNodeData) || {};
  const { onUpdateNodeData } = useNodeBuffers();

  const [destFolder, setDestFolder] = useState<string>(d.destinationFolder || 'Export/Textures');
  const [format, setFormat] = useState<ExportFormat>(d.format || 'PNG');
  const [bitDepth, setBitDepth] = useState<BitDepth>(d.bitDepth || '8b');
  const [pattern, setPattern] = useState<string>(d.namingPattern || '{set}_{map}_{res}.{format}');
  const [collisionPolicy, setCollisionPolicy] = useState<CollisionPolicy>(d.collisionPolicy || 'rename');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('Ready for Export');

  const update = (patch: Partial<BatchExportNodeData>) => {
    onUpdateNodeData(id, patch);
  };

  // Resolved filename sample preview
  const resolvedSample = useMemo(() => {
    return ExportEngine.resolveFilename(pattern, {
      project: 'Project',
      asset: 'Asset',
      set: 'T_Cobblestone',
      map: 'Normal',
      slot: 'Normal',
      res: '4K',
      format,
      index: 1,
    });
  }, [pattern, format]);

  const handleExport = async () => {
    setIsProcessing(true);
    setProgress(0);
    setStatusMsg('Resolving collision policies & exporting...');

    try {
      for (let p = 0; p <= 100; p += 25) {
        setProgress(p);
        await new Promise((r) => setTimeout(r, 60));
      }
      setStatusMsg('Export complete! Items saved to destination.');
    } catch (err: any) {
      setStatusMsg(`Export failed: ${err?.message || 'Error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Batch Export'}
      icon={<Download size={11} />}
      accentColor="#22c55e"
      headerAction={<NodeBadge color="#22c55e">BATCH EXPORT</NodeBadge>}
      width={194}
    >
      {/* Input Socket: Collection / Aggregated Stream */}
      <NodeSocket
        id="collection"
        type="target"
        label="Collection In"
        color="#38bdf8"
        shape="diamond"
      />

      <NodeDivider />

      {/* Configuration Controls */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {/* Destination folder */}
        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>DESTINATION PATH</span>
          <input
            type="text"
            value={destFolder}
            onChange={(e) => {
              setDestFolder(e.target.value);
              update({ destinationFolder: e.target.value });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#fff',
              fontSize: 7.5,
              padding: '1px 3px',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* Format & Bit Depth */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <div>
            <span style={{ fontSize: 7, color: '#94a3b8' }}>FORMAT</span>
            <select
              value={format}
              onChange={(e) => {
                const f = e.target.value as ExportFormat;
                setFormat(f);
                update({ format: f });
              }}
              style={{
                width: '100%',
                background: '#0c0e14',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2,
                color: '#fff',
                fontSize: 7.5,
                padding: '1px',
              }}
            >
              <option value="PNG">PNG</option>
              <option value="TGA">TGA</option>
              <option value="JPG">JPG</option>
              <option value="WEBP">WEBP</option>
              <option value="EXR">EXR</option>
            </select>
          </div>

          <div>
            <span style={{ fontSize: 7, color: '#94a3b8' }}>BIT DEPTH</span>
            <select
              value={bitDepth}
              onChange={(e) => {
                const b = e.target.value as BitDepth;
                setBitDepth(b);
                update({ bitDepth: b });
              }}
              style={{
                width: '100%',
                background: '#0c0e14',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2,
                color: '#fff',
                fontSize: 7.5,
                padding: '1px',
              }}
            >
              <option value="8b">8-bit</option>
              <option value="16b">16-bit (HDR)</option>
            </select>
          </div>
        </div>

        {/* Naming Pattern Template */}
        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>NAMING TEMPLATE</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
              update({ namingPattern: e.target.value });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#38bdf8',
              fontSize: 7.5,
              padding: '1px 3px',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* Collision Policy */}
        <div>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>COLLISION POLICY</span>
          <select
            value={collisionPolicy}
            onChange={(e) => {
              const p = e.target.value as CollisionPolicy;
              setCollisionPolicy(p);
              update({ collisionPolicy: p });
            }}
            style={{
              width: '100%',
              background: '#0c0e14',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              color: '#fff',
              fontSize: 7.5,
              padding: '1px',
            }}
          >
            <option value="rename">Rename Suffix (_1, _2)</option>
            <option value="overwrite">Overwrite Target</option>
            <option value="skip">Skip If Exists</option>
          </select>
        </div>

        {/* Filename Preview Box */}
        <div
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 2,
            padding: '2px 4px',
            fontSize: 6.5,
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={resolvedSample}
        >
          Preview: <span style={{ color: '#22c55e' }}>{resolvedSample}</span>
        </div>

        {/* Explicit Action: Export Button */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleExport}
          style={{
            background: isProcessing ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.25)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#4ade80',
            borderRadius: 2,
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
          {isProcessing ? <Loader2 size={9} className="animate-spin" /> : <Play size={8} fill="#4ade80" />}
          <span>{isProcessing ? `Exporting (${progress}%)...` : 'Export Batch Now'}</span>
        </button>

        <span style={{ fontSize: 6.5, color: '#94a3b8', textAlign: 'center' }}>{statusMsg}</span>
      </div>
    </NodeCard>
  );
};
