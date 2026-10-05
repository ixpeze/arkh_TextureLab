import { z } from 'zod';
import type { Node } from '@xyflow/react';
import type { TlabDocument } from '../types/project';
import { migrateProject, isV0Project, sanitizeNodeData } from './migrate';
import { nodeRegistry } from '../nodes/registry';

export const AssetRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  rel: z.string(),
  abs: z.string(),
  bytes: z.number().nonnegative(),
  mtimeMs: z.number().nonnegative().optional(),
  sha1: z.string().optional(),
});

export const ProjectMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});

export const ProjectExportSettingsSchema = z.object({
  primaryAsset: z.string().default('Anthracite_Concrete'),
  exportPattern: z.string().default('{prefix}_{asset}_{slot}.{format}'),
  exportDirRel: z.string().optional(),
  exportDirAbs: z.string().optional(),
  selectedPresetId: z.string().optional(),
});

export const ProjectViewSchema = z.object({
  zoom: z.number().default(1),
  pan: z.tuple([z.number(), z.number()]).default([0, 0]),
});

export const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const TlabNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: NodePositionSchema,
  data: z.record(z.string(), z.unknown()).default({}),
});

export const TlabEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

export const CommentBoxRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  color: z.string().optional(),
});

export const TlabDocumentSchema = z.object({
  format: z.literal('arkh-texturelab'),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  meta: ProjectMetaSchema,
  assets: z.array(AssetRecordSchema).default([]),
  graph: z.object({
    nodes: z.array(z.unknown()), // Individually validated for per-node resilience (TC-325)
    edges: z.array(TlabEdgeSchema).default([]),
    comments: z.array(CommentBoxRecordSchema).optional(),
  }),
  export: z.object({
    settings: ProjectExportSettingsSchema,
    presets: z.array(z.unknown()).optional().default([]),
  }),
  view: ProjectViewSchema,
});

export interface DeserializeSuccess {
  ok: true;
  doc: TlabDocument;
  warnings: string[];
  isNewerVersion: boolean;
  isMigrated: boolean;
}

export interface DeserializeFailure {
  ok: false;
  error: string;
}

export type DeserializeResult = DeserializeSuccess | DeserializeFailure;

export function serializeProject(doc: TlabDocument): string {
  // Deep clean node data to guarantee no previewUrl, onLoadBuffer, or raw pixel data leaks
  const cleanNodes = doc.graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: sanitizeNodeData((n.data as Record<string, unknown>) || {}),
  }));

  const cleanEdges = doc.graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: e.type,
    style: e.style,
  }));

  const payload: TlabDocument = {
    ...doc,
    meta: {
      ...doc.meta,
      modifiedAt: new Date().toISOString(),
    },
    graph: {
      ...doc.graph,
      nodes: cleanNodes,
      edges: cleanEdges,
    },
  };

  return JSON.stringify(payload, null, 2);
}

export function deserializeProject(jsonString: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      ok: false,
      error: 'Project file appears corrupted or truncated (invalid JSON).',
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      ok: false,
      error: 'Not a valid TextureLab project file (expected JSON object).',
    };
  }

  const rawObj = parsed as Record<string, unknown>;

  // Check format identifier or v0 compatibility
  const hasValidFormat = rawObj.format === 'arkh-texturelab';
  const isLegacy = isV0Project(rawObj);

  if (!hasValidFormat && !isLegacy) {
    return {
      ok: false,
      error: 'Not a valid TextureLab project file (unrecognized format).',
    };
  }

  try {
    const migration = migrateProject(rawObj);
    const doc = migration.doc;
    const warnings = [...migration.warnings];

    // Validate overall document structure with Zod
    const docParse = TlabDocumentSchema.safeParse(doc);
    if (!docParse.success) {
      return {
        ok: false,
        error: `Invalid project schema: ${docParse.error.issues.map((i) => i.message).join('; ')}`,
      };
    }

    // Validate nodes individually: if one node fails, preserve it as a placeholder (TC-325)
    const validNodes: Node[] = [];
    for (let i = 0; i < doc.graph.nodes.length; i++) {
      const rawNode = doc.graph.nodes[i];
      const nodeParse = TlabNodeSchema.safeParse(rawNode);
      if (nodeParse.success) {
        const n = nodeParse.data;
        const type = nodeRegistry.resolveCanonicalType(n.type);
        if (nodeRegistry.has(n.type) || nodeRegistry.has(type) || type === 'commentBox' || type === 'missingNode') {
          validNodes.push({
            id: n.id,
            type,
            position: n.position,
            data: n.data,
          });
        } else {
          warnings.push(`Unknown node type '${n.type}' retained as placeholder for node '${n.id}'`);
          validNodes.push({
            id: n.id,
            type: 'missingNode',
            position: n.position,
            data: { ...n.data, originalType: n.type, label: `Missing Node: ${n.type}` },
          });
        }
      } else {
        const fallbackId = (rawNode as Record<string, unknown>)?.id || `node_invalid_${i}`;
        warnings.push(`Node '${fallbackId}' had invalid data structure and was flagged as missing.`);
        validNodes.push({
          id: String(fallbackId),
          type: 'missingNode',
          position: { x: 0, y: 0 },
          data: { error: 'Schema validation failed', raw: rawNode },
        });
      }
    }

    const validatedDoc: TlabDocument = {
      ...doc,
      graph: {
        ...doc.graph,
        nodes: validNodes,
      },
    };

    return {
      ok: true,
      doc: validatedDoc,
      warnings,
      isNewerVersion: migration.isNewerVersion,
      isMigrated: migration.isMigrated,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to load project: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
