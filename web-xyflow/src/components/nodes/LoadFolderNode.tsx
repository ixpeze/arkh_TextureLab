import React, { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { FolderOpen, UploadCloud } from 'lucide-react';
import { NodeCard } from '../node-system/NodeCard';
import { NodeSocket } from '../node-system/NodeSocket';
import { NodeBadge, NodeDivider } from '../node-system/NodeControls';
import { useNodeBuffers } from '../../context/NodeBufferContext';
import { BatchEngine } from '../../engine/batchEngine';
import type { TextureCollection } from '../../types/export';

export interface LoadFolderNodeData {
  title?: string;
  folderName?: string;
  itemCount?: number;
  setCount?: number;
  recursive?: boolean;
  collection?: TextureCollection;
}

export const LoadFolderNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const d = (data as LoadFolderNodeData) || {};
  const { onUpdateNodeData } = useNodeBuffers();

  const [folderName, setFolderName] = useState<string>(d.folderName || 'No Folder Selected');
  const [itemCount, setItemCount] = useState<number>(d.itemCount ?? 0);
  const [setCount, setSetCount] = useState<number>(d.setCount ?? 0);
  const [recursive, setRecursive] = useState<boolean>(d.recursive !== false);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    try {
      const collection = await BatchEngine.scanFiles(e.target.files, {
        recursive,
        cleanup: true,
        flipGreenOnGL: true,
      });

      const uniqueSets = new Set(collection.items.map((i) => i.setName)).size;

      setFolderName(collection.name);
      setItemCount(collection.items.length);
      setSetCount(uniqueSets);

      onUpdateNodeData(id, {
        folderName: collection.name,
        itemCount: collection.items.length,
        setCount: uniqueSets,
        collection,
      });
    } catch (err) {
      console.error('Failed to scan folder', err);
    }
  };

  return (
    <NodeCard
      selected={selected}
      title={d.title || 'Load Folder'}
      icon={<FolderOpen size={11} />}
      accentColor="#38bdf8"
      headerAction={<NodeBadge color="#38bdf8">BATCH</NodeBadge>}
      width={188}
    >
      {/* Folder Picker Drag/Drop Zone */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          border: '1px dashed rgba(56, 189, 248, 0.3)',
          borderRadius: 4,
          padding: '6px 4px',
          textAlign: 'center',
          backgroundColor: 'rgba(56, 189, 248, 0.04)',
          marginBottom: 4,
        }}
      >
        <UploadCloud size={14} color="#38bdf8" style={{ margin: '0 auto 2px auto' }} />
        <div style={{ fontSize: 7.5, color: '#f8fafc', fontWeight: 600 }}>{folderName}</div>
        <div style={{ fontSize: 6.5, color: '#94a3b8', marginTop: 1 }}>
          {itemCount > 0 ? `${itemCount} Textures • ${setCount} Sets` : 'Select folder or drop files'}
        </div>

        <label
          style={{
            display: 'inline-block',
            marginTop: 4,
            background: 'rgba(56, 189, 248, 0.2)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
            borderRadius: 3,
            fontSize: 7.5,
            padding: '2px 8px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Browse Folder
          <input
            type="file"
            /* @ts-ignore */
            webkitdirectory="true"
            directory="true"
            multiple
            style={{ display: 'none' }}
            onChange={handleFolderSelect}
          />
        </label>
      </div>

      {/* Recursive Toggle */}
      <div
        className="nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}
      >
        <span style={{ fontSize: 7, color: '#94a3b8' }}>Include Subfolders</span>
        <input
          type="checkbox"
          checked={recursive}
          onChange={(e) => {
            setRecursive(e.target.checked);
            onUpdateNodeData(id, { recursive: e.target.checked });
          }}
          style={{ accentColor: '#38bdf8', width: 10, height: 10 }}
        />
      </div>

      <NodeDivider />

      {/* Output Socket: Distinguishable Texture Collection Stream */}
      <NodeSocket
        id="collection"
        type="source"
        label="Texture Collection"
        color="#38bdf8"
        shape="diamond"
        sectionTag="ARRAY"
      />
    </NodeCard>
  );
};
