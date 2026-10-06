import type { ComponentType } from 'react';
import type { NodeProps, Node, Edge, NodeTypes } from '@xyflow/react';
import type { TextureBuffer } from '../types/buffer';
import { withNodeErrorBoundary } from '../app/withNodeErrorBoundary';

export type NodeCategory =
  | 'Input'
  | 'Channel'
  | 'Math'
  | 'Adjust'
  | 'Blend'
  | 'Output'
  | 'Utility'
  | 'Labs';

export type PortKind = 'color' | 'scalar' | 'any';

export interface PortDef {
  id: string;
  kind: PortKind;
  label: string;
  required?: boolean;
}

export type ParamSchemaField =
  | { type: 'number'; min?: number; max?: number; step?: number; fine?: number; label: string; default?: number }
  | { type: 'enum'; options: { value: string; label: string }[]; label: string; default?: string }
  | { type: 'color'; label: string; default?: string }
  | { type: 'bool'; label: string; default?: boolean }
  | { type: 'channel'; label: string; default?: string }
  | { type: 'custom'; label: string };

export type ParamSchema = Record<string, ParamSchemaField>;

export interface GpuPassSpec {
  shaderId: string;
  uniforms?: Record<string, string>;
}

export interface NodeEvalContext {
  nodeId: string;
  nodes: Node[];
  edges: Edge[];
  sourceBuffers: Record<string, TextureBuffer>;
  evaluateNode: (nodeId: string) => TextureBuffer | null;
  getInputBuffer: (handle?: string) => TextureBuffer | null;
  getInputConnection: (handle?: string) => { buffer: TextureBuffer; sourceHandle: string } | null;
  coerceUE5: (
    buf: TextureBuffer,
    srcHandle?: string,
    dstHandle?: 'rgba' | 'rgb' | 'scalar' | 'r' | 'g' | 'b' | 'a' | string
  ) => TextureBuffer;
}

export type NodeParams<T = Record<string, unknown>> = T;

export interface NodeDef<P = Record<string, unknown>> {
  type: string;
  label: string;
  category: NodeCategory;
  hotkey?: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamSchema;
  defaults: P;
  legacyAliases?: string[];
  description?: string;
  color?: string;
  gpu?: GpuPassSpec;
  cpuRef?: (
    ctx: NodeEvalContext,
    inputs: Record<string, TextureBuffer | undefined>,
    params: P
  ) => TextureBuffer | null;
  // oxlint-disable-next-line typescript/no-explicit-any
  body?: ComponentType<NodeProps<any>>;
}

export class NodeRegistry {
  private defs = new Map<string, NodeDef<unknown>>();
  private aliasMap = new Map<string, string>();
  private hotkeyMap = new Map<string, string>();

  public register<P = Record<string, unknown>>(def: NodeDef<P>): void {
    if (this.defs.has(def.type)) {
      throw new Error(`Node type already registered: ${def.type}`);
    }
    this.defs.set(def.type, def as unknown as NodeDef<unknown>);

    if (def.hotkey) {
      const lower = def.hotkey.toLowerCase();
      if (this.hotkeyMap.has(lower)) {
        throw new Error(
          `Duplicate hotkey registered: '${lower}' for '${def.type}' and '${this.hotkeyMap.get(lower)}'`
        );
      }
      this.hotkeyMap.set(lower, def.type);
    }

    if (def.legacyAliases) {
      for (const alias of def.legacyAliases) {
        if (this.aliasMap.has(alias) || this.defs.has(alias)) {
          throw new Error(`Alias conflict: ${alias}`);
        }
        this.aliasMap.set(alias, def.type);
      }
    }
  }

  public unregister(type: string): void {
    const def = this.defs.get(type);
    if (!def) return;
    this.defs.delete(type);
    if (def.hotkey) {
      this.hotkeyMap.delete(def.hotkey.toLowerCase());
    }
    if (def.legacyAliases) {
      for (const alias of def.legacyAliases) {
        this.aliasMap.delete(alias);
      }
    }
  }

  public get<P = Record<string, unknown>>(type: string): NodeDef<P> | undefined {
    if (this.defs.has(type)) {
      return this.defs.get(type) as unknown as NodeDef<P>;
    }
    const canonical = this.aliasMap.get(type);
    if (canonical && this.defs.has(canonical)) {
      return this.defs.get(canonical) as unknown as NodeDef<P>;
    }
    return undefined;
  }

  public has(type: string): boolean {
    return this.defs.has(type) || this.aliasMap.has(type);
  }

  public resolveCanonicalType(type: string): string {
    return this.aliasMap.get(type) || type;
  }

  public getByHotkey(hotkey: string): NodeDef<unknown> | undefined {
    const type = this.hotkeyMap.get(hotkey.toLowerCase());
    return type ? this.defs.get(type) : undefined;
  }

  public getAll(): NodeDef<unknown>[] {
    return Array.from(this.defs.values());
  }

  public createNodeData(type: string): { type: string; data: Record<string, unknown> } {
    const def = this.get(type);
    const canonicalType = this.resolveCanonicalType(type);
    const defaults = def?.defaults ? JSON.parse(JSON.stringify(def.defaults)) : {};
    return {
      type: canonicalType,
      data: defaults,
    };
  }

  public getNodeTypes(): NodeTypes {
    const types: NodeTypes = {};
    for (const [type, def] of this.defs.entries()) {
      if (def.body) {
        types[type] = withNodeErrorBoundary(
          def.body as unknown as ComponentType<NodeProps>,
          def.label
        );
      }
    }
    for (const [alias, canonical] of this.aliasMap.entries()) {
      const def = this.defs.get(canonical);
      if (def?.body) {
        types[alias] = withNodeErrorBoundary(
          def.body as unknown as ComponentType<NodeProps>,
          def.label
        );
      }
    }
    return types;
  }

  public clear(): void {
    this.defs.clear();
    this.aliasMap.clear();
    this.hotkeyMap.clear();
  }
}

export const nodeRegistry = new NodeRegistry();

export function defineNode<P = Record<string, unknown>>(def: NodeDef<P>): NodeDef<P> {
  return def;
}

export function registerAllBuiltinDefs(): void {
  const defModules = import.meta.glob<{
    default?: NodeDef<unknown>;
    [key: string]: unknown;
  }>('./defs/*.ts', { eager: true });

  for (const path in defModules) {
    const mod = defModules[path];
    if (!mod) continue;
    if (mod.default && typeof mod.default === 'object' && 'type' in mod.default) {
      if (!nodeRegistry.has(mod.default.type)) {
        nodeRegistry.register(mod.default);
      }
    }
    for (const [key, value] of Object.entries(mod)) {
      if (
        key !== 'default' &&
        value &&
        typeof value === 'object' &&
        'type' in value &&
        typeof (value as { type: unknown }).type === 'string'
      ) {
        const d = value as NodeDef<unknown>;
        if (!nodeRegistry.has(d.type)) {
          nodeRegistry.register(d);
        }
      }
    }
  }
}

// Automatically register all built-in definitions on module load
registerAllBuiltinDefs();
