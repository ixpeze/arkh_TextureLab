import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { PixelEngine, type TextureBuffer } from '../engine/pixelEngine';
import { LexicalNormalizer } from '../engine/normalizer';
import { getPlatform } from '../platform/PlatformService';

export interface UseTextureDropProps {
  screenToFlowPosition: (clientPos: { x: number; y: number }) => { x: number; y: number };
  spawnNode: (typeKey: string, customPos?: { x: number; y: number }) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setSourceBuffers: React.Dispatch<React.SetStateAction<Record<string, TextureBuffer>>>;
  setActiveNodeId: (id: string | null) => void;
  setStatusMessage: (msg: string) => void;
}

export function useTextureDrop({
  screenToFlowPosition,
  spawnNode,
  setNodes,
  setSourceBuffers,
  setActiveNodeId,
  setStatusMessage,
}: UseTextureDropProps) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const nodeTypeKey = e.dataTransfer.getData('application/reactflow') || e.dataTransfer.getData('text/plain');
      if (nodeTypeKey) {
        const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const alignedPos = { x: dropPos.x - 110, y: dropPos.y - 15 };
        spawnNode(nodeTypeKey, alignedPos);
        return;
      }

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/') || /\.(png|jpe?g|tga|webp|exr|tiff?)$/i.test(f.name)
      );
      if (files.length === 0) return;

      const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const absolutePath = getPlatform().getPathForFile(file);
        if (absolutePath) {
          console.log(`[Drop] Ingested file with absolute path: ${absolutePath}`);
        }
        const meta = LexicalNormalizer.normalizeFilename(file.name);
        let buf: TextureBuffer | undefined;
        try {
          buf = await PixelEngine.loadFromFile(file);
        } catch (err) {
          console.error(err);
        }

        const resLabel = buf
          ? buf.width >= 3840
            ? '4K'
            : buf.width >= 1920
            ? '2K'
            : '1K'
          : meta.resolution || '4K';

        const nodeId = `input_${Date.now()}_${i}`;
        const newNode: Node = {
          id: nodeId,
          type: 'textureInput',
          position: { x: dropPos.x - 86, y: dropPos.y - 12 + i * 210 },
          data: {
            title: meta.assetName ? `${meta.assetName} (${meta.roleLabel})` : `Input: ${meta.roleLabel}`,
            role: meta.roleLabel,
            detectedRole: meta.detectedRole,
            roleColor: meta.roleColor,
            colorSpace: meta.colorSpace,
            res: meta.resolution || resLabel,
            channels: meta.channels,
            filePath: absolutePath || '',
          },
        };

        setNodes((nds) => [...nds, newNode]);
        if (buf) {
          setSourceBuffers((prev) => ({ ...prev, [nodeId]: buf! }));
          setActiveNodeId(newNode.id);
        }
      }

      setStatusMessage(`Ingested ${files.length} texture(s) onto canvas`);
    },
    [screenToFlowPosition, setActiveNodeId, setNodes, setSourceBuffers, setStatusMessage, spawnNode]
  );

  return { handleDragOver, handleDrop };
}
