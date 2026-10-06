/**
 * ARKH TextureLab - Graph Compilation, Topological Sort, and Liveness Analysis (P4-D1)
 */

import type { Node, Edge } from '@xyflow/react';

export interface PassInputRef {
  sourceNodeId: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface RenderPass {
  nodeId: string;
  nodeType: string;
  contentHash: string;
  inputs: PassInputRef[];
  resolution: { width: number; height: number };
  highPrecision: boolean;
  isDemandTarget: boolean;
}

export interface CompilationPlan {
  passes: RenderPass[];
  dirtyPasses: RenderPass[];
  livenessLastConsumer: Map<string, string>; // nodeId -> lastConsumerPassNodeId
  allHashes: Map<string, string>;
}

export interface CompileGraphOptions {
  nodes: Node[];
  edges: Edge[];
  demandNodeIds: Set<string>; // viewed node, export nodes, visible thumbnails
  workingRes?: number; // Cap resolution during interactive editing
  sourceResolutions?: Record<string, { width: number; height: number }>;
  cachedHashes?: Map<string, string>;
  highPrecision?: boolean;
}

function canonicalizeParams(params: Record<string, unknown> | undefined): string {
  if (!params) return '{}';
  const keys = Object.keys(params)
    .filter((k) => !k.startsWith('_') && k !== 'preview' && k !== 'previewUrl')
    .sort();
  const obj: Record<string, unknown> = {};
  for (const k of keys) {
    obj[k] = params[k];
  }
  return JSON.stringify(obj);
}

function simpleHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export function compileGraph(options: CompileGraphOptions): CompilationPlan {
  const {
    nodes,
    edges,
    demandNodeIds,
    workingRes = 1024,
    sourceResolutions = {},
    cachedHashes = new Map(),
    highPrecision = false,
  } = options;

  const nodeMap = new Map<string, Node>();
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const incomingEdges = new Map<string, Edge[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
    incomingEdges.set(node.id, []);
  }

  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      incomingEdges.get(edge.target)!.push(edge);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  // Kahn's algorithm for topological order
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const sortedNodeIds: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sortedNodeIds.push(curr);

    for (const neighbor of adj.get(curr) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Find upstream subgraph needed for demand nodes
  const neededNodeIds = new Set<string>();
  const visitUpstream = (id: string) => {
    if (neededNodeIds.has(id)) return;
    neededNodeIds.add(id);
    const inEdges = incomingEdges.get(id) || [];
    for (const edge of inEdges) {
      visitUpstream(edge.source);
    }
  };

  for (const demandId of demandNodeIds) {
    if (nodeMap.has(demandId)) {
      visitUpstream(demandId);
    }
  }

  // Compute resolutions and content hashes
  const nodeHashes = new Map<string, string>();
  const nodeResolutions = new Map<string, { width: number; height: number }>();
  const passes: RenderPass[] = [];

  for (const nodeId of sortedNodeIds) {
    if (!neededNodeIds.has(nodeId)) continue;
    const node = nodeMap.get(nodeId)!;
    const inEdges = incomingEdges.get(nodeId) || [];

    // Resolution policy
    let maxW = 512;
    let maxH = 512;

    if (node.type === 'textureInput') {
      const srcRes = sourceResolutions[node.id] || { width: 1024, height: 1024 };
      maxW = srcRes.width;
      maxH = srcRes.height;
    } else {
      for (const e of inEdges) {
        const upRes = nodeResolutions.get(e.source);
        if (upRes) {
          if (upRes.width > maxW) maxW = upRes.width;
          if (upRes.height > maxH) maxH = upRes.height;
        }
      }
    }

    // Apply working resolution cap if set
    const effectiveW = workingRes > 0 ? Math.min(maxW, workingRes) : maxW;
    const effectiveH = workingRes > 0 ? Math.min(maxH, workingRes) : maxH;
    const resolution = { width: effectiveW, height: effectiveH };
    nodeResolutions.set(nodeId, resolution);

    // Compute input refs and input hash strings
    const inputs: PassInputRef[] = [];
    const inputHashParts: string[] = [];
    for (const e of inEdges) {
      inputs.push({
        sourceNodeId: e.source,
        sourceHandle: e.sourceHandle || 'output',
        targetHandle: e.targetHandle || 'input',
      });
      const upHash = nodeHashes.get(e.source) || 'none';
      inputHashParts.push(`${e.sourceHandle}->${e.targetHandle}:${upHash}`);
    }
    inputHashParts.sort();

    const paramStr = canonicalizeParams(node.data as Record<string, unknown>);
    const hashPayload = [
      node.type || 'unknown',
      paramStr,
      inputHashParts.join(','),
      `${resolution.width}x${resolution.height}`,
      highPrecision ? 'hp16' : 'std8',
    ].join('|');

    const contentHash = simpleHash(hashPayload);
    nodeHashes.set(nodeId, contentHash);

    passes.push({
      nodeId,
      nodeType: node.type || 'unknown',
      contentHash,
      inputs,
      resolution,
      highPrecision,
      isDemandTarget: demandNodeIds.has(nodeId),
    });
  }

  // Liveness analysis: identify last consumer for each node output
  const livenessLastConsumer = new Map<string, string>();
  for (let i = passes.length - 1; i >= 0; i--) {
    const consumerPass = passes[i];
    for (const inp of consumerPass.inputs) {
      if (!livenessLastConsumer.has(inp.sourceNodeId)) {
        livenessLastConsumer.set(inp.sourceNodeId, consumerPass.nodeId);
      }
    }
  }

  // Filter dirty passes
  const dirtyPasses = passes.filter((p) => cachedHashes.get(p.nodeId) !== p.contentHash);

  return {
    passes,
    dirtyPasses,
    livenessLastConsumer,
    allHashes: nodeHashes,
  };
}
