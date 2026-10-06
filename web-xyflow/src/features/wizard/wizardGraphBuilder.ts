// src/features/wizard/wizardGraphBuilder.ts
import type { Node, Edge } from '@xyflow/react';
import type { AssetRecord } from '../../types/project';
import {
  type ChannelAssignment,
  type PackWizardConfig,
  type DroppedFileItem,
} from './wizardClassifier';

export * from './wizardClassifier';

export function buildPackWizardGraph(
  config: PackWizardConfig,
  classifiedFiles: DroppedFileItem[]
): { nodes: Node[]; edges: Edge[]; assets: AssetRecord[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const assets: AssetRecord[] = [];

  const combinerId = `combiner_${Date.now()}`;
  const outputId = `output_${Date.now()}`;
  const combinerX = 500;
  const combinerY = 200;

  // 1. Channel Combiner node
  nodes.push({
    id: combinerId,
    type: 'channelCombiner',
    position: { x: combinerX, y: combinerY },
    data: {
      rSource: 'R',
      gSource: 'G',
      bSource: 'B',
      aSource: 'A',
    },
  });

  // 2. Texture Output node
  const format = 'png';
  const slot = config.outputSlot || 'ORM';
  const filename = `T_${config.assetName}_${slot}.${format}`;

  nodes.push({
    id: outputId,
    type: 'textureOutput',
    position: { x: combinerX + 320, y: combinerY },
    data: {
      slot,
      format,
      outputFilename: filename,
    },
  });

  // Wire Combiner -> Output
  edges.push({
    id: `e_${combinerId}_to_${outputId}`,
    source: combinerId,
    sourceHandle: 'output',
    target: outputId,
    targetHandle: 'input',
    type: 'pulsingChannel',
  });

  // 3. Process channels: R, G, B, A
  const channelKeys: ('r' | 'g' | 'b' | 'a')[] = ['r', 'g', 'b', 'a'];
  const channelHandles: Record<'r' | 'g' | 'b' | 'a', string> = {
    r: 'r',
    g: 'g',
    b: 'b',
    a: 'a',
  };

  const fileNodeMap = new Map<number, string>();

  channelKeys.forEach((ch, idx) => {
    const chConfig: ChannelAssignment = config.channels[ch];
    const targetHandle = channelHandles[ch];
    const startY = 40 + idx * 160;

    if (chConfig.sourceType === 'file' && chConfig.fileIndex !== undefined) {
      const fileIndex = chConfig.fileIndex;
      const fileItem = classifiedFiles[fileIndex];

      let inputNodeId = fileNodeMap.get(fileIndex);
      if (!inputNodeId && fileItem) {
        inputNodeId = `tex_${fileIndex}_${Date.now()}`;
        fileNodeMap.set(fileIndex, inputNodeId);

        const assetId = `asset_${fileIndex}_${Date.now()}`;
        assets.push({
          id: assetId,
          name: fileItem.file.name,
          rel: fileItem.path,
          abs: fileItem.path,
          bytes: fileItem.file.size,
          mtimeMs: fileItem.file.lastModified,
        });

        nodes.push({
          id: inputNodeId,
          type: 'textureInput',
          position: { x: 60, y: startY },
          data: {
            assetId,
            filename: fileItem.file.name,
            role: fileItem.meta.detectedRole || chConfig.role,
            colorSpace: chConfig.role === 'basecolor' || chConfig.role === 'albedo' ? 'sRGB' : 'Linear',
          },
        });
      }

      if (inputNodeId) {
        if (chConfig.invert) {
          const invertId = `invert_${ch}_${Date.now()}`;
          nodes.push({
            id: invertId,
            type: 'invert',
            position: { x: 300, y: startY },
            data: {},
          });

          edges.push({
            id: `e_${inputNodeId}_to_${invertId}`,
            source: inputNodeId,
            sourceHandle: 'output',
            target: invertId,
            targetHandle: 'input',
            type: 'pulsingChannel',
          });

          edges.push({
            id: `e_${invertId}_to_${combinerId}_${targetHandle}`,
            source: invertId,
            sourceHandle: 'output',
            target: combinerId,
            targetHandle,
            type: 'pulsingChannel',
          });
        } else {
          edges.push({
            id: `e_${inputNodeId}_to_${combinerId}_${targetHandle}`,
            source: inputNodeId,
            sourceHandle: 'output',
            target: combinerId,
            targetHandle,
            type: 'pulsingChannel',
          });
        }
      }
    } else {
      const scalarId = `const_${ch}_${Date.now()}`;
      nodes.push({
        id: scalarId,
        type: 'constantScalar',
        position: { x: 180, y: startY },
        data: {
          value: chConfig.constantValue,
        },
      });

      edges.push({
        id: `e_${scalarId}_to_${combinerId}_${targetHandle}`,
        source: scalarId,
        sourceHandle: 'output',
        target: combinerId,
        targetHandle,
        type: 'pulsingChannel',
      });
    }
  });

  return { nodes, edges, assets };
}

export function buildUnpackWizardGraph(
  packedFile: File,
  assetName: string
): { nodes: Node[]; edges: Edge[]; assets: AssetRecord[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const assets: AssetRecord[] = [];

  const assetId = `asset_packed_${Date.now()}`;
  const inputNodeId = `input_packed_${Date.now()}`;
  const splitterId = `splitter_${Date.now()}`;

  const path = (packedFile as unknown as { path?: string }).path || packedFile.name;
  assets.push({
    id: assetId,
    name: packedFile.name,
    rel: path,
    abs: path,
    bytes: packedFile.size,
    mtimeMs: packedFile.lastModified,
  });

  nodes.push({
    id: inputNodeId,
    type: 'textureInput',
    position: { x: 60, y: 220 },
    data: {
      assetId,
      filename: packedFile.name,
      role: 'packed',
      colorSpace: 'Linear',
    },
  });

  nodes.push({
    id: splitterId,
    type: 'channelSplitter',
    position: { x: 340, y: 220 },
    data: {},
  });

  edges.push({
    id: `e_${inputNodeId}_to_${splitterId}`,
    source: inputNodeId,
    sourceHandle: 'output',
    target: splitterId,
    targetHandle: 'input',
    type: 'pulsingChannel',
  });

  const slots = [
    { handle: 'r', slot: 'AO', label: 'Ambient Occlusion', y: 40 },
    { handle: 'g', slot: 'Roughness', label: 'Roughness', y: 160 },
    { handle: 'b', slot: 'Metallic', label: 'Metallic', y: 280 },
    { handle: 'a', slot: 'Alpha', label: 'Alpha', y: 400 },
  ];

  slots.forEach((s) => {
    const outId = `out_${s.slot}_${Date.now()}`;
    nodes.push({
      id: outId,
      type: 'textureOutput',
      position: { x: 620, y: s.y },
      data: {
        slot: s.slot,
        format: 'png',
        outputFilename: `T_${assetName}_${s.slot}.png`,
      },
    });

    edges.push({
      id: `e_${splitterId}_${s.handle}_to_${outId}`,
      source: splitterId,
      sourceHandle: s.handle,
      target: outId,
      targetHandle: 'input',
      type: 'pulsingChannel',
    });
  });

  return { nodes, edges, assets };
}
