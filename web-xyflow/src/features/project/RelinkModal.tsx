import React, { useState } from 'react';
import { AlertTriangle, FolderOpen, Search, X } from 'lucide-react';
import type { AssetRecord } from '../../types/project';
import { getPlatform } from '../../platform/PlatformService';
import { relinkAsset } from '../../engine/assetManager';
import { autoRelinkFromFolder } from '../../engine/assetRelink';
import { useAppStore } from '../../store/useAppStore';

export interface RelinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingAssets: AssetRecord[];
}

export const RelinkModal: React.FC<RelinkModalProps> = ({ isOpen, onClose, missingAssets }) => {
  const [missingList, setMissingList] = useState<AssetRecord[]>(missingAssets);
  const doc = useAppStore((state) => state.doc);
  const projectPath = useAppStore((state) => state.projectPath);
  const setDocument = useAppStore((state) => state.setDocument);
  const setStatusMessage = useAppStore((state) => state.setStatusMessage);

  if (!isOpen || missingList.length === 0) return null;

  const projectDir = projectPath ? projectPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/') : undefined;
  const platform = getPlatform();

  const handleLocateSingleFile = async (asset: AssetRecord) => {
    const picked = await platform.showOpenDialog({
      title: `Locate ${asset.name}`,
      filters: [
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'tga'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (picked && picked.length > 0) {
      const newPath = picked[0];
      const updatedAssets = relinkAsset(doc.assets, asset.id, newPath, projectDir);
      setDocument({ ...doc, assets: updatedAssets }, true);
      setMissingList((prev) => prev.filter((a) => a.id !== asset.id));
      setStatusMessage(`Relinked ${asset.name} to ${newPath}`);
    }
  };

  const handleSearchFolder = async () => {
    const dirTarget = await platform.pickDirectory();
    if (!dirTarget || !dirTarget.path) return;

    setStatusMessage(`Searching ${dirTarget.name} for missing assets...`);

    // In desktop, read folder files
    try {
      const files: string[] = [];
      const entries = await platform.showOpenDialog({
        title: `Search Folder for Missing Textures`,
        properties: ['openFile', 'multiSelections'],
      });
      if (entries) files.push(...entries);

      const { relinked, stillMissing } = autoRelinkFromFolder(missingList, files, projectDir);
      if (relinked.length > 0) {
        let updatedAssets = doc.assets;
        for (const r of relinked) {
          updatedAssets = relinkAsset(updatedAssets, r.id, r.abs, projectDir);
        }
        setDocument({ ...doc, assets: updatedAssets }, true);
        setMissingList(stillMissing);
        setStatusMessage(`Auto-relinked ${relinked.length} assets from selected files`);
      }
    } catch (err) {
      console.warn('Folder relink search failed:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '560px',
          maxWidth: '90vw',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #27272a',
            backgroundColor: '#27272a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
              Missing Project Assets ({missingList.length})
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <div style={{ padding: '14px 18px', fontSize: '12px', color: '#a1a1aa', lineHeight: '1.5' }}>
          Some texture files referenced by this project could not be found at their original locations.
          You can locate each file individually, search a folder, or skip.
        </div>

        {/* Missing files list */}
        <div
          style={{
            padding: '0 18px',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {missingList.map((asset) => (
            <div
              key={asset.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
              }}
            >
              <div style={{ overflow: 'hidden', marginRight: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#fafafa' }}>
                  {asset.name}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#71717a',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {asset.abs || asset.rel}
                </div>
              </div>
              <button
                onClick={() => handleLocateSingleFile(asset)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  backgroundColor: '#3f3f46',
                  color: '#f4f4f5',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Search size={12} />
                Locate
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderTop: '1px solid #27272a',
            marginTop: '14px',
          }}
        >
          <button
            onClick={handleSearchFolder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#27272a',
              color: '#f4f4f5',
              border: '1px solid #3f3f46',
              borderRadius: '5px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <FolderOpen size={14} />
            Search Folder...
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#3f3f46',
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
};
