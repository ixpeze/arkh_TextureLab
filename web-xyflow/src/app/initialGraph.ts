import type { Node, Edge } from '@xyflow/react';

export const SAMPLE_BASE = import.meta.env.DEV ? '/samples/4k' : '/samples/1k';

export const BENCHMARK_MAPS = [
  {
    nodeId: 'input_ao',
    role: 'Ambient Occlusion',
    roleKey: 'ao',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete ambientocclusion 4k.png`,
    socket: 'r',
    color: 'var(--pbr-ao)',
  },
  {
    nodeId: 'input_rough',
    role: 'Roughness',
    roleKey: 'rough',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete roughness 4k.png`,
    socket: 'g',
    color: 'var(--pbr-rough)',
  },
  {
    nodeId: 'input_metal',
    role: 'Metallic',
    roleKey: 'metal',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete metallic 4k.png`,
    socket: 'b',
    color: 'var(--pbr-metal)',
  },
  {
    nodeId: 'input_height',
    role: 'Height',
    roleKey: 'height',
    url: `${SAMPLE_BASE}/anthracite smooth cast concrete height 4k.png`,
    socket: 'a',
    color: 'var(--pbr-height)',
  },
];

export const initialNodes: Node[] = [
  {
    id: 'input_ao',
    type: 'textureInput',
    position: { x: -400, y: 40 },
    data: {
      title: 'Input: Ambient Occlusion',
      role: 'Ambient Occlusion',
      roleColor: 'var(--pbr-ao)',
      res: '4K',
      previewUrl: '',
      channels: { r: 'AO', g: 'AO', b: 'AO', a: '1.0' },
    },
  },
  {
    id: 'input_rough',
    type: 'textureInput',
    position: { x: -400, y: 250 },
    data: {
      title: 'Input: Roughness',
      role: 'Roughness',
      roleColor: 'var(--pbr-rough)',
      res: '4K',
      previewUrl: '',
      channels: { r: 'Roughness', g: 'Roughness', b: 'Roughness', a: '1.0' },
    },
  },
  {
    id: 'input_metal',
    type: 'textureInput',
    position: { x: -400, y: 460 },
    data: {
      title: 'Input: Metallic',
      role: 'Metallic',
      roleColor: 'var(--pbr-metal)',
      res: '4K',
      previewUrl: '',
      channels: { r: 'Metallic', g: 'Metallic', b: 'Metallic', a: '1.0' },
    },
  },
  {
    id: 'combiner_ormh',
    type: 'channelCombiner',
    position: { x: 30, y: 230 },
    data: {
      fallbacks: { r: 255, g: 128, b: 0, a: 255 },
    },
  },
  {
    id: 'output_ormh',
    type: 'textureOutput',
    position: { x: 360, y: 230 },
    data: {
      title: 'Texture Output Target',
      slot: 'ORM',
      outputFilename: 'T_Anthracite_Concrete_ORM.png',
      format: 'PNG',
      bitDepth: '8b',
      colorSpace: 'linear',
      enabled: true,
      res: '4K',
    },
  },
];

export const initialEdges: Edge[] = [
  {
    id: 'e_ao_r',
    source: 'input_ao',
    sourceHandle: 'r',
    target: 'combiner_ormh',
    targetHandle: 'r',
    type: 'pulsingChannel',
    style: { stroke: 'var(--pbr-ao)' },
  },
  {
    id: 'e_rough_g',
    source: 'input_rough',
    sourceHandle: 'g',
    target: 'combiner_ormh',
    targetHandle: 'g',
    type: 'pulsingChannel',
    style: { stroke: 'var(--pbr-rough)' },
  },
  {
    id: 'e_metal_b',
    source: 'input_metal',
    sourceHandle: 'b',
    target: 'combiner_ormh',
    targetHandle: 'b',
    type: 'pulsingChannel',
    style: { stroke: 'var(--pbr-metal)' },
  },
  {
    id: 'e_comb_out',
    source: 'combiner_ormh',
    sourceHandle: 'rgba',
    target: 'output_ormh',
    targetHandle: 'rgba',
    type: 'dualMarching',
    style: { stroke: 'var(--pbr-packed)' },
  },
];

export function getBatchPipelineExample(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'batch_load_folder',
      type: 'loadFolder',
      position: { x: -480, y: 150 },
      data: {
        title: 'Load Source Folder',
        folderName: 'Cobblestone_4K',
        itemCount: 4,
        setCount: 1,
        recursive: true,
      },
    },
    {
      id: 'batch_for_each',
      type: 'forEach',
      position: { x: -220, y: 150 },
      data: {
        title: 'For Each Texture',
        filter: '*',
      },
    },
    {
      id: 'batch_normalize',
      type: 'normalize',
      position: { x: 40, y: 70 },
      data: {
        title: 'Normalize PBR Stems',
        cleanStem: true,
        flipGreen: true,
        deduplicate: true,
      },
    },
    {
      id: 'batch_resize',
      type: 'resize',
      position: { x: 290, y: 70 },
      data: {
        title: 'Power-of-Two Resize',
        targetWidth: 2048,
        targetHeight: 2048,
        potMode: 'nearest',
        mode: 'preserve',
      },
    },
    {
      id: 'batch_export',
      type: 'batchExport',
      position: { x: 550, y: 150 },
      data: {
        title: 'Batch Export Target',
        destinationFolder: 'Export/Normalized',
        format: 'PNG',
        bitDepth: '8b',
        namingPattern: '{set}_{map}_{res}.{format}',
        collisionPolicy: 'rename',
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'e_load_to_loop',
      source: 'batch_load_folder',
      sourceHandle: 'collection',
      target: 'batch_for_each',
      targetHandle: 'collection',
      type: 'dualMarching',
      style: { stroke: '#38bdf8' },
    },
    {
      id: 'e_loop_to_norm',
      source: 'batch_for_each',
      sourceHandle: 'item',
      target: 'batch_normalize',
      targetHandle: 'input',
      type: 'dualMarching',
      style: { stroke: '#38bdf8' },
    },
    {
      id: 'e_norm_to_resize',
      source: 'batch_normalize',
      sourceHandle: 'output',
      target: 'batch_resize',
      targetHandle: 'input',
      type: 'dualMarching',
      style: { stroke: '#38bdf8' },
    },
    {
      id: 'e_resize_to_export',
      source: 'batch_resize',
      sourceHandle: 'output',
      target: 'batch_export',
      targetHandle: 'input',
      type: 'dualMarching',
      style: { stroke: '#38bdf8' },
    },
  ];

  return { nodes, edges };
}
