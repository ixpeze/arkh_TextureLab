// src/features/wizard/wizardClassifier.ts
import { LexicalNormalizer, type NormalizedTextureMeta } from '../../engine/normalizer';

export type WizardPreset = 'ORM' | 'ORMH' | 'UnityMask' | 'RMA' | 'Custom';

export interface ChannelAssignment {
  sourceType: 'file' | 'constant';
  fileIndex?: number;
  constantValue: number;
  invert: boolean;
  role: string;
}

export interface PackWizardConfig {
  assetName: string;
  preset: WizardPreset;
  outputSlot: string;
  channels: {
    r: ChannelAssignment;
    g: ChannelAssignment;
    b: ChannelAssignment;
    a: ChannelAssignment;
  };
}

export interface DroppedFileItem {
  file: File;
  path: string;
  meta: NormalizedTextureMeta;
}

export function classifyDroppedFiles(files: File[]): DroppedFileItem[] {
  return files
    .filter((f) => /\.(png|tga|jpg|jpeg|webp)$/i.test(f.name))
    .map((file) => {
      const path = (file as unknown as { path?: string }).path || file.name;
      const meta = LexicalNormalizer.normalizeFilename(file.name);
      return { file, path, meta };
    });
}

export function getDefaultConfigForPreset(
  preset: WizardPreset,
  classifiedFiles: DroppedFileItem[]
): PackWizardConfig {
  let inferredAsset = 'Asset';
  for (const item of classifiedFiles) {
    if (item.meta.assetName && item.meta.assetName !== 'Asset') {
      inferredAsset = item.meta.assetName;
      break;
    }
  }

  const findFileIndexByRoles = (roles: string[]): number | undefined => {
    const idx = classifiedFiles.findIndex((item) =>
      roles.includes(item.meta.detectedRole.toLowerCase())
    );
    return idx >= 0 ? idx : undefined;
  };

  const aoIdx = findFileIndexByRoles(['ao', 'ambientocclusion', 'ambient_occlusion', 'occlusion']);
  const roughIdx = findFileIndexByRoles(['roughness', 'rough', 'gloss', 'smoothness']);
  const metalIdx = findFileIndexByRoles(['metallic', 'metal', 'metalness']);
  const heightIdx = findFileIndexByRoles(['height', 'displacement', 'disp', 'bump']);

  if (preset === 'ORM') {
    return {
      assetName: inferredAsset,
      preset: 'ORM',
      outputSlot: 'ORM',
      channels: {
        r: {
          sourceType: aoIdx !== undefined ? 'file' : 'constant',
          fileIndex: aoIdx,
          constantValue: 1.0,
          invert: false,
          role: 'ao',
        },
        g: {
          sourceType: roughIdx !== undefined ? 'file' : 'constant',
          fileIndex: roughIdx,
          constantValue: 0.5,
          invert: false,
          role: 'roughness',
        },
        b: {
          sourceType: metalIdx !== undefined ? 'file' : 'constant',
          fileIndex: metalIdx,
          constantValue: 0.0,
          invert: false,
          role: 'metallic',
        },
        a: {
          sourceType: 'constant',
          constantValue: 1.0,
          invert: false,
          role: 'none',
        },
      },
    };
  }

  if (preset === 'ORMH') {
    return {
      assetName: inferredAsset,
      preset: 'ORMH',
      outputSlot: 'ORMH',
      channels: {
        r: {
          sourceType: aoIdx !== undefined ? 'file' : 'constant',
          fileIndex: aoIdx,
          constantValue: 1.0,
          invert: false,
          role: 'ao',
        },
        g: {
          sourceType: roughIdx !== undefined ? 'file' : 'constant',
          fileIndex: roughIdx,
          constantValue: 0.5,
          invert: false,
          role: 'roughness',
        },
        b: {
          sourceType: metalIdx !== undefined ? 'file' : 'constant',
          fileIndex: metalIdx,
          constantValue: 0.0,
          invert: false,
          role: 'metallic',
        },
        a: {
          sourceType: heightIdx !== undefined ? 'file' : 'constant',
          fileIndex: heightIdx,
          constantValue: 0.0,
          invert: false,
          role: 'height',
        },
      },
    };
  }

  if (preset === 'UnityMask') {
    return {
      assetName: inferredAsset,
      preset: 'UnityMask',
      outputSlot: 'Mask',
      channels: {
        r: {
          sourceType: metalIdx !== undefined ? 'file' : 'constant',
          fileIndex: metalIdx,
          constantValue: 0.0,
          invert: false,
          role: 'metallic',
        },
        g: {
          sourceType: aoIdx !== undefined ? 'file' : 'constant',
          fileIndex: aoIdx,
          constantValue: 1.0,
          invert: false,
          role: 'ao',
        },
        b: {
          sourceType: 'constant',
          constantValue: 0.0,
          invert: false,
          role: 'detail_mask',
        },
        a: {
          sourceType: roughIdx !== undefined ? 'file' : 'constant',
          fileIndex: roughIdx,
          constantValue: 0.5,
          invert: true,
          role: 'smoothness',
        },
      },
    };
  }

  if (preset === 'RMA') {
    return {
      assetName: inferredAsset,
      preset: 'RMA',
      outputSlot: 'RMA',
      channels: {
        r: {
          sourceType: roughIdx !== undefined ? 'file' : 'constant',
          fileIndex: roughIdx,
          constantValue: 0.5,
          invert: false,
          role: 'roughness',
        },
        g: {
          sourceType: metalIdx !== undefined ? 'file' : 'constant',
          fileIndex: metalIdx,
          constantValue: 0.0,
          invert: false,
          role: 'metallic',
        },
        b: {
          sourceType: aoIdx !== undefined ? 'file' : 'constant',
          fileIndex: aoIdx,
          constantValue: 1.0,
          invert: false,
          role: 'ao',
        },
        a: {
          sourceType: 'constant',
          constantValue: 1.0,
          invert: false,
          role: 'none',
        },
      },
    };
  }

  return {
    assetName: inferredAsset,
    preset: 'Custom',
    outputSlot: 'Packed',
    channels: {
      r: { sourceType: 'constant', constantValue: 1.0, invert: false, role: 'r' },
      g: { sourceType: 'constant', constantValue: 0.5, invert: false, role: 'g' },
      b: { sourceType: 'constant', constantValue: 0.0, invert: false, role: 'b' },
      a: { sourceType: 'constant', constantValue: 1.0, invert: false, role: 'a' },
    },
  };
}
