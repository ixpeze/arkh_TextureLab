import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Repeat, Play, Square, AlertCircle } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket, NodeSocketGroup } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { BatchEngine } from '../../engine/batchEngine';
import type { TextureCollection, TextureItem } from '../../types/export';

export interface ForEachNodeData {
  title?: string;
  filter?: string;
  isProcessing?: boolean;
  progress?: number;
  currentFilename?: string;
  errorCount?: number;
  collection?: TextureCollection;
}

export const ForEachNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as ForEachNodeData) || {};
  const { onUpdateNodeData } = useNodeBuffers();

  const [filter, setFilter] = useState<string>(d.filter || '*');
  const [isProcessing, setIsProcessing] = useState<boolean>(!!d.isProcessing);
  const [progress, setProgress] = useState<number>(d.progress ?? 0);
  const [currentFile, setCurrentFile] = useState<string>(d.currentFilename || 'Idle');
  const [errors, setErrors] = useState<{ item: string; error: string }[]>([]);

  const handleStartLoop = async () => {
    setIsProcessing(true);
    setProgress(0);
    setErrors([]);

    // Dummy run or execute via BatchEngine
    const batchId = `loop_${id}`;
    const dummyCollection: TextureCollection = d.collection || {
      id: 'demo_col',
      name: 'Batch Textures',
      items: [
        { id: '1', filename: 'T_Stone_Albedo.png', originalPath: 'Stone/T_Stone_Albedo.png', stem: 'T_Stone', ext: '.png', setName: 'Stone', canonicalSuffix: 'Albedo', mapType: 'baseColor', isExcluded: false },
        { id: '2', filename: 'T_Stone_Normal_GL.png', originalPath: 'Stone/T_Stone_Normal_GL.png', stem: 'T_Stone', ext: '.png', setName: 'Stone', canonicalSuffix: 'Normal', mapType: 'normal', isExcluded: false },
        { id: '3', filename: 'T_Stone_Roughness.png', originalPath: 'Stone/T_Stone_Roughness.png', stem: 'T_Stone', ext: '.png', setName: 'Stone', canonicalSuffix: 'Roughness', mapType: 'roughness', isExcluded: false },
        { id: '4', filename: 'T_Stone_AO.png', originalPath: 'Stone/T_Stone_AO.png', stem: 'T_Stone', ext: '.png', setName: 'Stone', canonicalSuffix: 'AO', mapType: 'ao', isExcluded: false },
      ],
      createdAt: Date.now(),
    };

    const res = await BatchEngine.executeForEach(
      batchId,
      dummyCollection,
      async (item: TextureItem) => {
        setCurrentFile(item.filename);
        await new Promise((r) => setTimeout(r, 60)); // Simulate async processing
        return null;
      },
      (p) => {
        setProgress(p.percent);
      }
    );

    setIsProcessing(false);
    if (res.isCancelled) {
      setCurrentFile('Cancelled by user');
    } else {
      setCurrentFile(`Finished: ${res.results.length} items`);
    }
    setErrors(res.errors);

    onUpdateNodeData(id, {
      progress: 100,
      currentFilename: currentFile,
      errorCount: res.errors.length,
    });
  };

  const handleCancelLoop = () => {
    BatchEngine.cancelBatch(`loop_${id}`);
    setIsProcessing(false);
    setCurrentFile('Cancelling...');
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'For Each'}
      icon={<Repeat size={11} />}
      accentColor="#8b5cf6"
      headerAction={<NodeBadge color="#8b5cf6">LOOP</NodeBadge>}
      width={194}
    >
      {/* Target Sockets */}
      <NodeSocket
        id="collection"
        type="target"
        label="Collection In"
        color="#38bdf8"
        shape="diamond"
      />

      <NodeSocket
        id="collect"
        type="target"
        label="Collect Loop Result"
        color="#8b5cf6"
        shape="circle"
      />

      <NodeDivider />

      {/* Filter Pattern Input */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 7, color: '#94a3b8' }}>ITEM FILTER</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              onUpdateNodeData(id, { filter: e.target.value });
            }}
            style={{
              width: 70,
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

        {/* Action Buttons: Run / Cancel */}
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleStartLoop}
            style={{
              flex: 1,
              background: isProcessing ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.25)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: '#a78bfa',
              borderRadius: 2,
              fontSize: 7.5,
              fontWeight: 700,
              padding: '2px 0',
              cursor: isProcessing ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Play size={8} fill="#a78bfa" /> Run Batch
          </button>
          <button
            type="button"
            disabled={!isProcessing}
            onClick={handleCancelLoop}
            style={{
              background: isProcessing ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isProcessing ? '#ef4444' : 'rgba(255, 255, 255, 0.08)'}`,
              color: isProcessing ? '#ef4444' : '#64748b',
              borderRadius: 2,
              fontSize: 7.5,
              padding: '2px 6px',
              cursor: isProcessing ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cancel Batch Execution"
          >
            <Square size={8} />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6.5, color: '#94a3b8' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {currentFile}
            </span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 1 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#8b5cf6', transition: 'width 100ms ease' }} />
          </div>
        </div>

        {/* Error reporting if any */}
        {errors.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#f87171', fontSize: 6.5, marginTop: 1 }}>
            <AlertCircle size={8} />
            <span>{errors.length} item error(s) occurred</span>
          </div>
        )}
      </div>

      <NodeDivider />

      {/* Output Sockets: Stream Item, Index, Metadata, and Collected Output */}
      <NodeSocketGroup>
        <NodeSocket id="item" type="source" label="Item Stream" color="#ffffff" shape="diamond" />
        <NodeSocket id="index" type="source" label="Loop Index" color="#94a3b8" />
        <NodeSocket id="metadata" type="source" label="Metadata" color="#94a3b8" />
        <NodeSocket id="collection" type="source" label="Collected Outputs" color="#8b5cf6" shape="diamond" />
      </NodeSocketGroup>
    </NodeCard>
  );
};
