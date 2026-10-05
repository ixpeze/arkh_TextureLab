import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { createDefaultDocument } from '../../store/documentSlice';
import type { Node } from '@xyflow/react';

describe('Patch History & Coalescing (P3-T2: TC-301..305)', () => {
  beforeEach(() => {
    useAppStore.setState({
      doc: createDefaultDocument(),
      isDirty: false,
      activeNodeId: 'input_ao',
      selectedNodeIds: [],
    });
    useAppStore.getState().historyManager.clear();
    useAppStore.getState().historyManager.setSavedRevision(0);
    useAppStore.getState().historyManager.setRevision(0);
  });

  it('TC-301: Drag a node 50 px then undo returns to start in a single step', () => {
    const store = useAppStore.getState();
    const targetNode = store.doc.graph.nodes[0];
    const initialPos = { ...targetNode.position };

    // Drag start
    store.onNodeDragStart(null, targetNode, [targetNode]);

    // Intermediate moves during dragging (controlled React Flow)
    store.onNodesChange([
      { id: targetNode.id, type: 'position', position: { x: initialPos.x + 10, y: initialPos.y + 10 }, dragging: true },
      { id: targetNode.id, type: 'position', position: { x: initialPos.x + 25, y: initialPos.y + 25 }, dragging: true },
      { id: targetNode.id, type: 'position', position: { x: initialPos.x + 50, y: initialPos.y + 50 }, dragging: true },
    ]);

    // During drag, no history steps are created
    expect(useAppStore.getState().canUndo()).toBe(false);

    // Drag stop commits the move
    const finalNode: Node = {
      ...targetNode,
      position: { x: initialPos.x + 50, y: initialPos.y + 50 },
    };
    useAppStore.getState().onNodeDragStop(null, finalNode, [finalNode]);

    expect(useAppStore.getState().canUndo()).toBe(true);
    expect(useAppStore.getState().doc.graph.nodes[0].position).toEqual({
      x: initialPos.x + 50,
      y: initialPos.y + 50,
    });

    // Single undo returns to initial position
    const undoRes = useAppStore.getState().undo();
    expect(undoRes).toBe(true);
    expect(useAppStore.getState().doc.graph.nodes[0].position).toEqual(initialPos);
    expect(useAppStore.getState().canUndo()).toBe(false);
  });

  it('TC-302: Scrub Levels slider 30 steps then undo returns in a single step', () => {
    const store = useAppStore.getState();
    const targetNodeId = store.doc.graph.nodes[0].id;

    // Begin scrub transaction on pointerdown
    useAppStore.getState().beginTransaction('Scrub Levels InBlack');

    // User scrubs slider 30 times
    for (let i = 1; i <= 30; i++) {
      useAppStore.getState().updateNodeData(targetNodeId, { inBlack: i * 0.02 });
      // Live document state must update so canvas reacts immediately
      expect((useAppStore.getState().doc.graph.nodes[0].data as Record<string, unknown>).inBlack).toBeCloseTo(i * 0.02);
    }

    // Pointer up commits transaction
    const committed = useAppStore.getState().commitTransaction();
    expect(committed).toBe(true);

    // Only ONE history step exists
    expect(useAppStore.getState().historyManager.getUndoStackSize()).toBe(1);

    // Single undo restores to before scrub
    const undoRes = useAppStore.getState().undo();
    expect(undoRes).toBe(true);
    expect((useAppStore.getState().doc.graph.nodes[0].data as Record<string, unknown>).inBlack).toBeUndefined();
    expect(useAppStore.getState().canUndo()).toBe(false);
  });

  it('TC-303: Undo past empty is a safe no-op with no error', () => {
    expect(useAppStore.getState().canUndo()).toBe(false);
    const undoRes = useAppStore.getState().undo();
    expect(undoRes).toBe(false);
    expect(useAppStore.getState().canUndo()).toBe(false);
  });

  it('TC-304: Redo after new edit clears the redo stack', () => {
    const store = useAppStore.getState();
    const targetNodeId = store.doc.graph.nodes[0].id;

    // Make an edit
    useAppStore.getState().updateNodeData(targetNodeId, { val: 10 });
    expect(useAppStore.getState().canUndo()).toBe(true);

    // Undo it -> redo is available
    useAppStore.getState().undo();
    expect(useAppStore.getState().canRedo()).toBe(true);

    // Make a new edit -> redo stack must be cleared
    useAppStore.getState().updateNodeData(targetNodeId, { val: 20 });
    expect(useAppStore.getState().canRedo()).toBe(false);
    expect(useAppStore.getState().historyManager.getRedoStackSize()).toBe(0);
  });

  it('TC-305: 100+ edits keep memory stable and drop oldest entries', () => {
    const store = useAppStore.getState();
    const targetNodeId = store.doc.graph.nodes[0].id;

    for (let i = 1; i <= 120; i++) {
      useAppStore.getState().updateNodeData(targetNodeId, { iteration: i });
    }

    // History stack is strictly capped at MAX_HISTORY_STEPS (100)
    expect(useAppStore.getState().historyManager.getUndoStackSize()).toBe(100);
  });

  it('Undo across save correctly calculates isDirty status based on saved revision', () => {
    const store = useAppStore.getState();
    const targetNodeId = store.doc.graph.nodes[0].id;

    expect(useAppStore.getState().isDirty).toBe(false);

    // Make edit 1
    useAppStore.getState().updateNodeData(targetNodeId, { a: 1 });
    expect(useAppStore.getState().isDirty).toBe(true);

    // Simulate saving file at revision 1
    useAppStore.getState().historyManager.markSaved();
    useAppStore.setState({ isDirty: false });

    // Make edit 2
    useAppStore.getState().updateNodeData(targetNodeId, { a: 2 });
    expect(useAppStore.getState().isDirty).toBe(true);

    // Undo edit 2 -> back at saved state!
    useAppStore.getState().undo();
    expect(useAppStore.getState().isDirty).toBe(false);

    // Undo edit 1 -> now dirty again because we moved before the saved point!
    useAppStore.getState().undo();
    expect(useAppStore.getState().isDirty).toBe(true);

    // Redo edit 1 -> back at saved point!
    useAppStore.getState().redo();
    expect(useAppStore.getState().isDirty).toBe(false);
  });
});
