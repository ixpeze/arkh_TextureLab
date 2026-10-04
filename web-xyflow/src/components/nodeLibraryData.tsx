import React from 'react';
import {
  Layers,
  UnfoldHorizontal,
  FoldHorizontal,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
  Palette,
  Binary,
  MessageSquare,
  Shuffle,
  Scaling,
  Sparkles,
  Columns,
  Grid,
  FolderOpen,
  Wand2,
  Repeat,
  Calculator,
} from 'lucide-react';

export interface NodeCategory {
  name: string;
  items: {
    key: string;
    label: string;
    shortcut?: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }[];
}

export const CATEGORIES: NodeCategory[] = [
  {
    name: 'Inputs & Constants',
    items: [
      {
        key: 'textureInput',
        label: 'Texture Input',
        shortcut: 'T',
        description: 'Load files & drag-drop with filename inference',
        icon: <Layers size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'color',
        label: 'Color',
        shortcut: '3',
        description: 'Responsive color picker with RGB/A outputs',
        icon: <Palette size={13} />,
        color: 'var(--pbr-albedo)',
      },
      {
        key: 'constantScalar',
        label: 'Constant Scalar',
        shortcut: '1',
        description: 'Single float scalar value',
        icon: <Binary size={13} />,
        color: 'var(--pbr-scalar)',
      },
    ],
  },
  {
    name: 'Channel Routing',
    items: [
      {
        key: 'channelPack',
        label: 'Channel Pack',
        shortcut: 'M',
        description: 'Pack R, G, B, A (defaults 0) into RGBA',
        icon: <FoldHorizontal size={13} />,
        color: 'var(--pbr-packed)',
      },
      {
        key: 'channelUnpack',
        label: 'Channel Unpack',
        shortcut: 'S',
        description: 'Split RGBA into R, G, B, A + auto RGB stream',
        icon: <UnfoldHorizontal size={13} />,
        color: 'var(--pbr-unpacked)',
      },
      {
        key: 'channelSwizzle',
        label: 'Channel Swizzle',
        shortcut: 'Z',
        description: 'Arbitrary 4x4 matrix swizzle / routing',
        icon: <Shuffle size={13} />,
        color: '#818cf8',
      },
    ],
  },
  {
    name: 'Adjust & Levels',
    items: [
      {
        key: 'levels',
        label: 'Levels',
        shortcut: 'L',
        description: 'Interactive black/gamma/white slider controls',
        icon: <SlidersHorizontal size={13} />,
        color: '#fbbf24',
      },
      {
        key: 'invert',
        label: 'Invert',
        shortcut: 'I',
        description: 'Invert channels (1 - x)',
        icon: <ArrowUpDown size={13} />,
        color: '#ec4899',
      },
      {
        key: 'normalFlip',
        label: 'Normal Flip',
        shortcut: 'N',
        description: 'Flip Green channel (DirectX ↔ OpenGL)',
        icon: <ArrowUpDown size={13} />,
        color: 'var(--pbr-normal)',
      },
    ],
  },
  {
    name: 'Math (13 Operations)',
    items: [
      { key: 'mathAdd', label: 'Add (+)', description: 'A + B component-wise', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathSubtract', label: 'Subtract (-)', description: 'A - B component-wise', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathMultiply', label: 'Multiply (*)', description: 'A * B component-wise', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathDivide', label: 'Divide (/)', description: 'A / B with zero protection', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathPower', label: 'Power (^)', description: 'A ^ B (gamma/contrast)', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathMin', label: 'Min', description: 'Darkest component-wise', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathMax', label: 'Max', description: 'Lightest component-wise', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathClamp', label: 'Clamp', description: 'Constrain between min/max', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathSaturate', label: 'Saturate', description: 'Clamp to 0.0 - 1.0', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathAbs', label: 'Abs', description: 'Absolute values', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathOneMinus', label: 'One Minus', description: '1.0 - A (Quick invert)', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathDot', label: 'Dot Product', description: 'Vector dot product to scalar', icon: <Calculator size={13} />, color: '#60a5fa' },
      { key: 'mathCross', label: 'Cross Product', description: 'RGB vector cross product', icon: <Calculator size={13} />, color: '#60a5fa' },
    ],
  },
  {
    name: 'Transform & Resample',
    items: [
      {
        key: 'resize',
        label: 'Resize',
        description: 'Scale buffers (Bilinear/Nearest/POT)',
        icon: <Scaling size={13} />,
        color: '#f97316',
      },
      {
        key: 'upscale',
        label: 'Upscale',
        description: 'Upscale textures (2x, 4x, 8x)',
        icon: <Sparkles size={13} />,
        color: '#a855f7',
      },
    ],
  },
  {
    name: 'Blending & Normal Mix',
    items: [
      {
        key: 'blend',
        label: 'Blend',
        shortcut: 'B',
        description: '7 blend modes + opacity mask',
        icon: <Layers size={13} />,
        color: '#eab308',
      },
      {
        key: 'normalBlend',
        label: 'Normal Blend',
        description: 'Reoriented Normal Mapping (RNM)',
        icon: <ArrowUpDown size={13} />,
        color: 'var(--pbr-normal)',
      },
    ],
  },
  {
    name: 'Quality & Debug Tools',
    items: [
      {
        key: 'compare',
        label: 'Compare',
        description: 'Side-by-side / split slider',
        icon: <Columns size={13} />,
        color: '#06b6d4',
      },
      {
        key: 'seamCheck',
        label: 'Seam Check',
        description: '2x2 / 3x3 tiling preview',
        icon: <Grid size={13} />,
        color: '#14b8a6',
      },
    ],
  },
  {
    name: 'Automation & Pipeline',
    items: [
      {
        key: 'loadFolder',
        label: 'Load Folder',
        description: 'Recursive scan & texture-set detection',
        icon: <FolderOpen size={13} />,
        color: '#38bdf8',
      },
      {
        key: 'normalize',
        label: 'Normalize',
        description: 'Vendor strip, GL/DX flip & PascalCase stems',
        icon: <Wand2 size={13} />,
        color: '#10b981',
      },
      {
        key: 'forEach',
        label: 'For Each',
        description: 'Loop graph over collection with progress',
        icon: <Repeat size={13} />,
        color: '#8b5cf6',
      },
      {
        key: 'batchExport',
        label: 'Batch Export',
        description: 'Template naming & collision resolution',
        icon: <Download size={13} />,
        color: '#22c55e',
      },
    ],
  },
  {
    name: 'Outputs & Frames',
    items: [
      {
        key: 'textureOutput',
        label: 'Texture Output',
        shortcut: 'O',
        description: 'Export target with token naming',
        icon: <Download size={13} />,
        color: '#4ade80',
      },
      {
        key: 'commentBox',
        label: 'Comment Box',
        shortcut: 'C',
        description: 'UE5-style framing & group container',
        icon: <MessageSquare size={13} />,
        color: '#38bdf8',
      },
    ],
  },
];
