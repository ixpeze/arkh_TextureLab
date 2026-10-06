/**
 * ARKH TextureLab - Graph Connection Validation & DAG Cycle Detection
 */

import type { Edge, Connection } from '@xyflow/react';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export function validateConnection(
  connection: Connection | Edge,
  edges: Edge[]
): ValidationResult {
  const { source, target, sourceHandle, targetHandle } = connection;

  // 1. Edge Case: Self-connection
  if (!source || !target || source === target) {
    return { isValid: false, reason: 'Self-connection not allowed' };
  }

  // 2. Edge Case: Exact duplicate edge
  const isDuplicate = edges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      (e.sourceHandle || null) === (sourceHandle || null) &&
      (e.targetHandle || null) === (targetHandle || null)
  );
  if (isDuplicate) {
    return { isValid: false, reason: 'Wire already exists' };
  }

  // 3. Edge Case: Directed cycle detection (DAG enforcement)
  const visited = new Set<string>();
  const queue: string[] = [target];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === source) {
      return { isValid: false, reason: 'Cycle detected: Recursive loop is not permitted in DAG' };
    }
    visited.add(curr);

    for (const e of edges) {
      if (e.source === curr && !visited.has(e.target)) {
        queue.push(e.target);
      }
    }
  }

  return { isValid: true };
}
