import type { Node, Edge } from '@xyflow/react';
import type { AssetRecord } from '../../types/project';
import { sanitizeNodeData } from '../../graph/migrate';

export const CLIPBOARD_MIME = 'application/x-texturelab-nodes';

export interface TextureLabClipboardPayload {
  format: 'application/x-texturelab-nodes';
  version: 1;
  nodes: Node[];
  edges: Edge[];
  assets: AssetRecord[];
}

export function createClipboardPayload(
  selectedNodes: Node[],
  allEdges: Edge[],
  allAssets: AssetRecord[]
): TextureLabClipboardPayload | null {
  if (selectedNodes.length === 0) return null;

  const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

  // Find internal edges (both source and target are in selected nodes)
  const internalEdges = allEdges.filter(
    (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
  );

  // Find referenced assets
  const referencedAssetIds = new Set<string>();
  for (const n of selectedNodes) {
    const d = (n.data as Record<string, unknown>) || {};
    if (typeof d.assetId === 'string') {
      referencedAssetIds.add(d.assetId);
    }
  }

  const neededAssets = allAssets.filter((a) => referencedAssetIds.has(a.id));

  // Sanitize node data to guarantee no previewUrl / buffer leakage
  const cleanNodes: Node[] = selectedNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { ...n.position },
    data: sanitizeNodeData((n.data as Record<string, unknown>) || {}),
  }));

  const cleanEdges: Edge[] = internalEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: e.type,
    style: e.style,
  }));

  return {
    format: CLIPBOARD_MIME,
    version: 1,
    nodes: cleanNodes,
    edges: cleanEdges,
    assets: neededAssets,
  };
}

export function parseClipboardText(text: string): TextureLabClipboardPayload | null {
  if (!text || typeof text !== 'string') return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.format !== CLIPBOARD_MIME || !Array.isArray(parsed.nodes)) {
      return null; // TC-351: Non-TextureLab JSON ignored
    }
    return parsed as unknown as TextureLabClipboardPayload;
  } catch {
    return null; // Non-JSON text ignored
  }
}

export interface PreparedPasteResult {
  nodes: Node[];
  edges: Edge[];
  assetsToAdd: AssetRecord[];
}

export function preparePasteNodes(
  payload: TextureLabClipboardPayload,
  targetPosition?: { x: number; y: number },
  existingAssets: AssetRecord[] = []
): PreparedPasteResult {
  const idMap = new Map<string, string>();
  const timestamp = Date.now();

  // Calculate bounding box or anchor of copied nodes
  let minX = Infinity;
  let minY = Infinity;
  for (const n of payload.nodes) {
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
  }

  const offsetX = targetPosition ? targetPosition.x - minX : 40;
  const offsetY = targetPosition ? targetPosition.y - minY : 40;

  const newNodes: Node[] = payload.nodes.map((n, idx) => {
    const newId = `node_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
    idMap.set(n.id, newId);

    const pos = targetPosition
      ? { x: n.position.x + offsetX, y: n.position.y + offsetY }
      : { x: n.position.x + 40, y: n.position.y + 40 };

    return {
      ...n,
      id: newId,
      position: pos,
      selected: true,
      data: { ...n.data },
    };
  });

  // Rewire internal edges using the new node IDs (TC-350)
  const newEdges: Edge[] = payload.edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e, idx) => {
      const newEdgeId = `edge_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        ...e,
        id: newEdgeId,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      };
    });

  // Check for assets that need to be registered in the destination project (TC-352)
  const existingAssetIds = new Set(existingAssets.map((a) => a.id));
  const assetsToAdd = payload.assets.filter((a) => !existingAssetIds.has(a.id));

  return {
    nodes: newNodes,
    edges: newEdges,
    assetsToAdd,
  };
}

export function duplicateWithWires(
  selectedNodes: Node[],
  allEdges: Edge[],
  offset = { x: 40, y: 40 }
): { newNodes: Node[]; newEdges: Edge[] } {
  const payload = createClipboardPayload(selectedNodes, allEdges, []);
  if (!payload) return { newNodes: [], newEdges: [] };

  const idMap = new Map<string, string>();
  const timestamp = Date.now();

  const newNodes: Node[] = payload.nodes.map((n, idx) => {
    const newId = `dup_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
    idMap.set(n.id, newId);
    return {
      ...n,
      id: newId,
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
      selected: true,
      data: { ...n.data },
    };
  });

  const newEdges: Edge[] = payload.edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e, idx) => {
      const newEdgeId = `e_dup_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      return {
        ...e,
        id: newEdgeId,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      };
    });

  return { newNodes, newEdges };
}
