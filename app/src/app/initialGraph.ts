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

export async function fetchBenchmarkBuffers<T>(
  loadFromUrl: (url: string) => Promise<T>
): Promise<Record<string, T>> {
  const loaded: Record<string, T> = {};
  for (const m of BENCHMARK_MAPS) {
    try {
      loaded[m.nodeId] = await loadFromUrl(m.url);
    } catch (e) {
      console.warn(`Could not fetch ${m.url}`, e);
    }
  }
  return loaded;
}

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

export function getSampleBenchmarkGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: JSON.parse(JSON.stringify(initialNodes)),
    edges: JSON.parse(JSON.stringify(initialEdges)),
  };
}

export function getTemplateGraph(preset: 'orm' | 'ormh' | 'ue5' | 'unity' | 'unpack'): { nodes: Node[]; edges: Edge[] } {
  if (preset === 'unpack') {
    const nodes: Node[] = [
      {
        id: 'tex_input_packed',
        type: 'textureInput',
        position: { x: -300, y: 200 },
        data: { title: 'Packed Texture Input', role: 'Packed' },
      },
      {
        id: 'split_packed',
        type: 'channelSplitter',
        position: { x: 50, y: 200 },
        data: { title: 'Channel Splitter' },
      },
      {
        id: 'out_r',
        type: 'textureOutput',
        position: { x: 400, y: 50 },
        data: { title: 'Output: Red Channel', slot: 'R', outputFilename: 'T_{asset}_R.png' },
      },
      {
        id: 'out_g',
        type: 'textureOutput',
        position: { x: 400, y: 200 },
        data: { title: 'Output: Green Channel', slot: 'G', outputFilename: 'T_{asset}_G.png' },
      },
      {
        id: 'out_b',
        type: 'textureOutput',
        position: { x: 400, y: 350 },
        data: { title: 'Output: Blue Channel', slot: 'B', outputFilename: 'T_{asset}_B.png' },
      },
    ];
    const edges: Edge[] = [
      { id: 'e_in_split', source: 'tex_input_packed', sourceHandle: 'rgba', target: 'split_packed', targetHandle: 'rgba', type: 'dualMarching' },
      { id: 'e_split_r', source: 'split_packed', sourceHandle: 'r', target: 'out_r', targetHandle: 'rgba', type: 'pulsingChannel' },
      { id: 'e_split_g', source: 'split_packed', sourceHandle: 'g', target: 'out_g', targetHandle: 'rgba', type: 'pulsingChannel' },
      { id: 'e_split_b', source: 'split_packed', sourceHandle: 'b', target: 'out_b', targetHandle: 'rgba', type: 'pulsingChannel' },
    ];
    return { nodes, edges };
  }

  const nodes: Node[] = [
    {
      id: 'in_ao',
      type: 'textureInput',
      position: { x: -400, y: 60 },
      data: { title: 'Input: Ambient Occlusion', role: 'ao', roleColor: 'var(--pbr-ao)' },
    },
    {
      id: 'in_rough',
      type: 'textureInput',
      position: { x: -400, y: 240 },
      data: { title: 'Input: Roughness', role: 'rough', roleColor: 'var(--pbr-rough)' },
    },
    {
      id: 'in_metal',
      type: 'textureInput',
      position: { x: -400, y: 420 },
      data: { title: 'Input: Metallic', role: 'metal', roleColor: 'var(--pbr-metal)' },
    },
    {
      id: 'comb_pbr',
      type: 'channelCombiner',
      position: { x: 50, y: 240 },
      data: { fallbacks: { r: 255, g: 128, b: 0, a: 255 } },
    },
    {
      id: 'out_packed',
      type: 'textureOutput',
      position: { x: 420, y: 240 },
      data: {
        title: 'Texture Output',
        slot: preset === 'ormh' ? 'ORMH' : 'ORM',
        outputFilename: preset === 'ormh' ? 'T_{asset}_ORMH.png' : 'T_{asset}_ORM.png',
        format: 'PNG',
        bitDepth: '8b',
        colorSpace: 'linear',
      },
    },
  ];

  const edges: Edge[] = [
    { id: 'e_ao', source: 'in_ao', sourceHandle: 'r', target: 'comb_pbr', targetHandle: 'r', type: 'pulsingChannel', style: { stroke: 'var(--pbr-ao)' } },
    { id: 'e_rough', source: 'in_rough', sourceHandle: 'g', target: 'comb_pbr', targetHandle: 'g', type: 'pulsingChannel', style: { stroke: 'var(--pbr-rough)' } },
    { id: 'e_metal', source: 'in_metal', sourceHandle: 'b', target: 'comb_pbr', targetHandle: 'b', type: 'pulsingChannel', style: { stroke: 'var(--pbr-metal)' } },
    { id: 'e_out', source: 'comb_pbr', sourceHandle: 'rgba', target: 'out_packed', targetHandle: 'rgba', type: 'dualMarching', style: { stroke: 'var(--pbr-packed)' } },
  ];

  if (preset === 'ormh') {
    nodes.push({
      id: 'in_height',
      type: 'textureInput',
      position: { x: -400, y: 600 },
      data: { title: 'Input: Height / Disp', role: 'height', roleColor: 'var(--pbr-height)' },
    });
    edges.push({
      id: 'e_height',
      source: 'in_height',
      sourceHandle: 'a',
      target: 'comb_pbr',
      targetHandle: 'a',
      type: 'pulsingChannel',
      style: { stroke: 'var(--pbr-height)' },
    });
  }

  return { nodes, edges };
}
