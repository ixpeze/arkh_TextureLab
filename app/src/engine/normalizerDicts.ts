/**
 * PBR Texture Lexical Dictionaries & Data Contracts
 */

export interface PBRChannelMapping {
  r: string;
  g: string;
  b: string;
  a: string;
}

export interface NormalizedTextureMeta {
  originalName: string;
  assetName: string;
  detectedRole: string;
  roleLabel: string;
  roleColor: string;
  colorSpace: 'sRGB' | 'Linear';
  autoInvert: boolean;
  requiresGreenFlip: boolean;
  resolution?: string;
  isPacked: boolean;
  channels: PBRChannelMapping;
}

export interface TextureBatchItem {
  id: string;
  originalName: string;
  originalPath: string;
  newName: string;
  cleanStem: string;
  mapType: string;
  suffix: string;
  orientation: 'gl' | 'dx' | null;
  variantNum: number | null;
  action: 'keep_rename' | 'flip_gl' | 'delete_gl' | 'delete_variant' | 'delete_type_dup' | 'delete_dupe';
  status: string;
  mtime: number;
  buffer?: unknown;
  dataUrl?: string;
}

export const PBR_ROLE_DEFINITIONS: Record<string, {
  label: string;
  color: string;
  colorSpace: 'sRGB' | 'Linear';
  autoInvert?: boolean;
  requiresGreenFlip?: boolean;
  aliases: string[];
}> = {
  base_color: {
    label: 'Base Color / Albedo',
    color: 'var(--pbr-albedo)',
    colorSpace: 'sRGB',
    aliases: [
      'basecolor', 'albedo', 'base', 'color', 'diffuse', 'bc', 'diff',
      '_col', '_color_', '_diffuse_', '_base_', '_albedo_', 'base_color', 'd', 'col'
    ],
  },
  normal: {
    label: 'Normal Map (Tangent)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    aliases: [
      'normal', 'nrm', 'norm', '_n', 'nor', 'normaldx', 'nor_dx',
      'nrm_dx', '_nor_dx_', '_nor_', '_nrm_', 'normals', '_normal_',
      'normalgl', 'nor_gl', 'nrm_gl', '_nor_gl_', 'normalmap', 'n'
    ],
  },
  normal_directx: {
    label: 'Normal (DirectX -Y)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    requiresGreenFlip: true,
    aliases: ['normal_dx', 'normaldx', 'dx_normal', 'n_dx', 'nor_dx', 'nrm_dx', '_nor_dx_'],
  },
  normal_opengl: {
    label: 'Normal (OpenGL +Y)',
    color: 'var(--pbr-normal)',
    colorSpace: 'Linear',
    aliases: ['normal_gl', 'normalgl', 'gl_normal', 'n_gl', 'nor_gl', 'nrm_gl', 'normal_ogl', '_nor_gl_'],
  },
  roughness: {
    label: 'Roughness',
    color: 'var(--pbr-rough)',
    colorSpace: 'Linear',
    aliases: ['roughness', 'rough', '_rough_', 'gls', 'gloss', 'glossiness', '_rgh_', 'rgh', 'microsurface', 'smoothness', 'r'],
  },
  glossiness: {
    label: 'Glossiness (Inverted)',
    color: 'var(--pbr-rough)',
    colorSpace: 'Linear',
    autoInvert: true,
    aliases: ['glossiness', 'gloss', 'smoothness', 'gls'],
  },
  metallic: {
    label: 'Metallic',
    color: 'var(--pbr-metal)',
    colorSpace: 'Linear',
    aliases: ['metallic', 'metal', '_mtl_', 'metalness', '_metal_', 'mtl', 'met', 'm'],
  },
  ambient_occlusion: {
    label: 'Ambient Occlusion',
    color: 'var(--pbr-ao)',
    colorSpace: 'Linear',
    aliases: ['ao', 'occlusion', 'ambientocclusion', 'ambient_occlusion', '_ao_', 'occ', '_occlusion_', 'ambient', 'mixed_ao'],
  },
  height: {
    label: 'Height / Displacement',
    color: 'var(--pbr-height)',
    colorSpace: 'Linear',
    aliases: ['height', 'displacement', 'disp', 'parallax', '_h_', '_height_', '_disp_', 'bump', '_bump_', 'heightmap', 'depth', 'h'],
  },
  emissive: {
    label: 'Emissive',
    color: '#f43f5e',
    colorSpace: 'sRGB',
    aliases: ['emissive', 'emissivecolor', 'emi', 'emission', 'emit', 'glow', 'illum', 'e'],
  },
  specular: {
    label: 'Specular',
    color: '#e2e8f0',
    colorSpace: 'Linear',
    aliases: ['specular', 'spec', 'spc'],
  },
  opacity: {
    label: 'Opacity / Alpha',
    color: '#cbd5e1',
    colorSpace: 'Linear',
    aliases: ['opacity', 'alpha', 'transparency', 'mask', 'cutout', 'translucency', 'trans'],
  },
  fuzz: {
    label: 'Fuzz',
    color: '#f59e0b',
    colorSpace: 'Linear',
    aliases: ['fuzz', 'fuzzy'],
  },
  preview: {
    label: 'Preview',
    color: '#64748b',
    colorSpace: 'sRGB',
    aliases: ['preview', 'thumb', 'thumbnail', 'icon', 'render'],
  },
};

export const PACKED_MAP_DEFINITIONS: Record<string, {
  label: string;
  aliases: string[];
  slots: PBRChannelMapping;
}> = {
  orm: {
    label: 'ORM (AO, Rough, Metal)',
    aliases: ['orm', 'occlusionroughnessmetallic', 'occlusion+roughness+metallic', 'ao_rough_metal', 'aorm'],
    slots: { r: 'AO', g: 'Roughness', b: 'Metallic', a: '1.0' },
  },
  ormh: {
    label: 'ORMH (AO, Rough, Metal, Height)',
    aliases: ['ormh', 'aormh'],
    slots: { r: 'AO', g: 'Roughness', b: 'Metallic', a: 'Height' },
  },
  rma: {
    label: 'RMA (Rough, Metal, AO)',
    aliases: ['rma', 'arm', 'roughnessmetallicocclusion', 'roughness+metallic+occlusion'],
    slots: { r: 'Roughness', g: 'Metallic', b: 'AO', a: '1.0' },
  },
  msra: {
    label: 'MSRA (Metal, Smooth, Reflectance, AO)',
    aliases: ['msra', 'masr'],
    slots: { r: 'Metallic', g: 'Smoothness', b: 'Reflectance', a: 'AO' },
  },
};

export const RESOLUTION_PATTERNS = ['16k', '8k', '4k', '2k', '1k', '512', '1024', '2048', '4096', '8192', '16384'];
export const PREFIX_PATTERNS = [
  'texturescom_', 'cgtextures_', 'ambientcg_', 'cc0textures_', 'poliigon_', 'megascans_', 'quixel_', 'substance_', 'freepbr_', 'polyhaven_', 'texturecan_',
  'tx_', 't_', 'tex_', 'texture_', 'map_', 'mat_', 'm_', 'img_', 'chr_', 'sm_', 't_sm_'
];

export const CANONICAL_SUFFIX_MAP: Record<string, string> = {
  base_color: 'Albedo',
  normal: 'N',
  normal_directx: 'N',
  normal_opengl: 'N',
  roughness: 'R',
  glossiness: 'Gloss',
  ambient_occlusion: 'AO',
  metallic: 'M',
  height: 'H',
  orm: 'ORM',
  ormh: 'ORMH',
  rma: 'RMA',
  msra: 'MSRA',
  alpha: 'Alpha',
  opacity: 'Opacity',
  emissive: 'E',
  subsurface: 'SSS',
  specular: 'Spec',
  glass: 'Glass',
  fuzz: 'Fuzz',
  translucency: 'Trans',
  preview: 'Preview',
};

export const ORM_VARIANT_MAP: Record<string, string> = {
  ormh: 'ORMH',
  ormd: 'ORMD',
  ormdp: 'ORMDp',
  ormfuzz: 'ORMFuzz',
  ormalpha: 'ORMAlpha',
  ormtranslucency: 'ORMTranslucency',
  orm: 'ORM',
};

export const GL_TOKENS = new Set(['gl', 'opengl', 'ogl', 'normalgl', 'nor_gl', 'nrm_gl', '_nor_gl_']);
export const DX_TOKENS = new Set(['dx', 'directx', 'dx11', 'dx12', 'normaldx', 'nor_dx', 'nrm_dx', '_nor_dx_']);
