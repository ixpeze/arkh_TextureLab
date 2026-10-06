import type { Node, Edge } from '@xyflow/react';
import type { TlabDocument, AssetRecord } from '../types/project';
import { nodeRegistry } from '../nodes/registry';

export const CURRENT_SCHEMA_VERSION = 1;
export const CURRENT_APP_VERSION = '1.0.0';

export interface MigrationResult {
  doc: TlabDocument;
  isMigrated: boolean;
  isNewerVersion: boolean;
  warnings: string[];
}

export function isV0Project(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  if (obj.format === 'arkh-texturelab' && typeof obj.schemaVersion === 'number') {
    return false;
  }
  return Array.isArray(obj.nodes) || (typeof obj.graph === 'object' && obj.graph !== null);
}

export function sanitizeNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === 'previewUrl' || key === 'onLoadBuffer' || key === 'dataUrl') {
      continue;
    }
    clean[key] = val;
  }
  return clean;
}

export function migrateProject(raw: unknown): MigrationResult {
  const warnings: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Project data must be a valid JSON object');
  }

  const obj = raw as Record<string, unknown>;

  // Check for future schema versions
  if (obj.format === 'arkh-texturelab' && typeof obj.schemaVersion === 'number') {
    const v = obj.schemaVersion as number;
    if (v > CURRENT_SCHEMA_VERSION) {
      warnings.push(
        `Project schema version (${v}) is newer than this application supports (${CURRENT_SCHEMA_VERSION}). Opened in read-only mode.`
      );
      return {
        doc: obj as unknown as TlabDocument,
        isMigrated: false,
        isNewerVersion: true,
        warnings,
      };
    }
    if (v === CURRENT_SCHEMA_VERSION) {
      return {
        doc: obj as unknown as TlabDocument,
        isMigrated: false,
        isNewerVersion: false,
        warnings,
      };
    }
  }

  // Handle v0 / legacy shape migration to v1
  let rawNodes: unknown[] = [];
  let rawEdges: unknown[] = [];

  if (Array.isArray(obj.nodes)) {
    rawNodes = obj.nodes;
    rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  } else if (typeof obj.graph === 'object' && obj.graph !== null) {
    const g = obj.graph as Record<string, unknown>;
    rawNodes = Array.isArray(g.nodes) ? g.nodes : [];
    rawEdges = Array.isArray(g.edges) ? g.edges : [];
  }

  const assets: AssetRecord[] = Array.isArray(obj.assets) ? (obj.assets as AssetRecord[]) : [];
  const assetIdMap = new Map<string, string>();
  for (const a of assets) {
    if (a.id) assetIdMap.set(a.id, a.id);
  }

  const cleanNodes: Node[] = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const rawNode = rawNodes[i];
    if (typeof rawNode !== 'object' || rawNode === null) continue;
    const n = rawNode as Record<string, unknown>;

    const id = typeof n.id === 'string' ? n.id : `node_${i}`;
    let type = typeof n.type === 'string' ? n.type : 'default';

    // Canonicalize aliases or mark unknown
    const canonicalType = nodeRegistry.resolveCanonicalType(type);
    if (nodeRegistry.has(type) || nodeRegistry.has(canonicalType)) {
      type = canonicalType;
    } else if (type !== 'commentBox') {
      warnings.push(`Unknown node type '${type}' converted to placeholder for node '${id}'`);
      type = 'missingNode';
    }

    const pos = (typeof n.position === 'object' && n.position !== null
      ? n.position
      : typeof n.pos === 'object' && n.pos !== null
      ? Array.isArray(n.pos)
        ? { x: Number(n.pos[0]) || 0, y: Number(n.pos[1]) || 0 }
        : n.pos
      : { x: 0, y: 0 }) as { x: number; y: number };

    const data = typeof n.data === 'object' && n.data !== null
      ? sanitizeNodeData(n.data as Record<string, unknown>)
      : typeof n.params === 'object' && n.params !== null
      ? sanitizeNodeData(n.params as Record<string, unknown>)
      : {};

    cleanNodes.push({
      id,
      type,
      position: pos,
      data,
    });
  }

  const cleanEdges: Edge[] = [];
  for (let i = 0; i < rawEdges.length; i++) {
    const rawEdge = rawEdges[i];
    if (typeof rawEdge !== 'object' || rawEdge === null) continue;
    const e = rawEdge as Record<string, unknown>;

    const id = typeof e.id === 'string' ? e.id : `edge_${i}`;
    let source = typeof e.source === 'string' ? e.source : '';
    let target = typeof e.target === 'string' ? e.target : '';
    let sourceHandle = typeof e.sourceHandle === 'string' ? e.sourceHandle : undefined;
    let targetHandle = typeof e.targetHandle === 'string' ? e.targetHandle : undefined;

    // Handle target architecture tuple edge representation: from: [n, port], to: [n, port]
    if (Array.isArray(e.from) && e.from.length >= 2) {
      source = String(e.from[0]);
      sourceHandle = String(e.from[1]);
    }
    if (Array.isArray(e.to) && e.to.length >= 2) {
      target = String(e.to[0]);
      targetHandle = String(e.to[1]);
    }

    if (source && target) {
      cleanEdges.push({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: typeof e.type === 'string' ? e.type : 'default',
        style: typeof e.style === 'object' && e.style !== null ? (e.style as Record<string, unknown>) : undefined,
      });
    }
  }

  const now = new Date().toISOString();
  const meta = {
    id: typeof (obj.meta as Record<string, unknown>)?.id === 'string' ? (obj.meta as Record<string, unknown>).id as string : `proj_${Date.now()}`,
    name: typeof (obj.meta as Record<string, unknown>)?.name === 'string' ? (obj.meta as Record<string, unknown>).name as string : 'Untitled_Project',
    createdAt: typeof (obj.meta as Record<string, unknown>)?.createdAt === 'string' ? (obj.meta as Record<string, unknown>).createdAt as string : now,
    modifiedAt: now,
  };

  const exportObj = (typeof obj.export === 'object' && obj.export !== null ? obj.export : {}) as Record<string, unknown>;
  const settingsObj = (typeof exportObj.settings === 'object' && exportObj.settings !== null ? exportObj.settings : {}) as Record<string, unknown>;

  const exportSettings = {
    primaryAsset: typeof settingsObj.primaryAsset === 'string' ? settingsObj.primaryAsset : 'Anthracite_Concrete',
    exportPattern: typeof settingsObj.exportPattern === 'string' ? settingsObj.exportPattern : '{prefix}_{asset}_{slot}.{format}',
    exportDirRel: typeof settingsObj.exportDirRel === 'string' ? settingsObj.exportDirRel : '',
    selectedPresetId: typeof settingsObj.selectedPresetId === 'string' ? settingsObj.selectedPresetId : undefined,
  };

  const viewObj = (typeof obj.view === 'object' && obj.view !== null ? obj.view : {}) as Record<string, unknown>;
  const panArr = Array.isArray(viewObj.pan) && viewObj.pan.length >= 2 ? [Number(viewObj.pan[0]) || 0, Number(viewObj.pan[1]) || 0] : [0, 0];

  const doc: TlabDocument = {
    format: 'arkh-texturelab',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: CURRENT_APP_VERSION,
    meta,
    assets,
    graph: {
      nodes: cleanNodes,
      edges: cleanEdges,
    },
    export: {
      settings: exportSettings,
      presets: Array.isArray(exportObj.presets) ? exportObj.presets : [],
    },
    view: {
      zoom: typeof viewObj.zoom === 'number' ? viewObj.zoom : 1,
      pan: panArr as [number, number],
    },
  };

  return {
    doc,
    isMigrated: true,
    isNewerVersion: false,
    warnings,
  };
}
