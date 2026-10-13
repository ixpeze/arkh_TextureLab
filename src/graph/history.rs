//! Transactional Undo/Redo History Stack (Phase 2).
//!
//! Provides a 100-step transactional state history preserving complete graph
//! fidelity: exact node positions, parameters, sockets, and edges.

use crate::graph::model::Graph;
use std::collections::VecDeque;

/// Default maximum depth of undo operations.
pub const DEFAULT_HISTORY_CAPACITY: usize = 100;

/// A single atomic transition recorded in the history stack.
#[derive(Clone, Debug, PartialEq)]
pub struct HistoryEntry {
    pub graph: Graph,
    pub description: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl HistoryEntry {
    pub fn new(graph: Graph, description: impl Into<String>) -> Self {
        Self {
            graph,
            description: description.into(),
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Transactional undo/redo stack for atomic graph transitions.
#[derive(Clone, Debug)]
pub struct HistoryStack {
    undo_stack: VecDeque<HistoryEntry>,
    redo_stack: Vec<HistoryEntry>,
    max_depth: usize,
}

impl Default for HistoryStack {
    fn default() -> Self {
        Self::new()
    }
}

impl HistoryStack {
    /// Creates a new history stack with the default 100-step capacity.
    pub fn new() -> Self {
        Self::with_capacity(DEFAULT_HISTORY_CAPACITY)
    }

    /// Creates a new history stack with a custom maximum depth.
    pub fn with_capacity(max_depth: usize) -> Self {
        Self {
            undo_stack: VecDeque::with_capacity(max_depth),
            redo_stack: Vec::new(),
            max_depth: max_depth.max(1),
        }
    }

    /// Records the current graph state before a mutation.
    /// Clears any pending redo history.
    pub fn record(&mut self, current: &Graph, description: impl Into<String>) {
        if self.undo_stack.len() >= self.max_depth {
            self.undo_stack.pop_front();
        }
        self.undo_stack
            .push_back(HistoryEntry::new(current.clone(), description));
        self.redo_stack.clear();
    }

    /// Records the current graph state before a mutation, coalescing with the previous entry
    /// if the previous entry has the exact same description and occurred within `coalesce_window_secs`.
    ///
    /// When coalesced, the existing entry (which holds the pristine state prior to the start of the continuous drag)
    /// is preserved, its timestamp is updated to keep extending the gesture window, and the redo stack is cleared.
    pub fn record_coalesced(
        &mut self,
        current_before_change: &Graph,
        description: impl Into<String>,
        coalesce_window_secs: f64,
    ) {
        let desc = description.into();
        let now = chrono::Utc::now();

        if let Some(last) = self.undo_stack.back_mut() {
            let elapsed = (now - last.timestamp).num_milliseconds() as f64 / 1000.0;
            if last.description == desc && elapsed >= 0.0 && elapsed <= coalesce_window_secs {
                last.timestamp = now;
                self.redo_stack.clear();
                return;
            }
        }

        self.record(current_before_change, desc);
    }


    /// Reverts to the previous graph state in history.
    /// Pushes the active graph state onto the redo stack.
    pub fn undo(&mut self, current: &Graph) -> Option<Graph> {
        let entry = self.undo_stack.pop_back()?;
        self.redo_stack
            .push(HistoryEntry::new(current.clone(), entry.description.clone()));
        Some(entry.graph)
    }

    /// Re-applies the undone state.
    /// Pushes the active graph state onto the undo stack.
    pub fn redo(&mut self, current: &Graph) -> Option<Graph> {
        let entry = self.redo_stack.pop()?;
        if self.undo_stack.len() >= self.max_depth {
            self.undo_stack.pop_front();
        }
        self.undo_stack
            .push_back(HistoryEntry::new(current.clone(), entry.description.clone()));
        Some(entry.graph)
    }

    /// Returns true if an undo operation is available.
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    /// Returns true if a redo operation is available.
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Returns the description of the action that would be undone.
    pub fn undo_description(&self) -> Option<&str> {
        self.undo_stack.back().map(|e| e.description.as_str())
    }

    /// Returns the description of the action that would be redone.
    pub fn redo_description(&self) -> Option<&str> {
        self.redo_stack.last().map(|e| e.description.as_str())
    }

    /// Returns the number of available undo steps.
    pub fn undo_depth(&self) -> usize {
        self.undo_stack.len()
    }

    /// Returns the number of available redo steps.
    pub fn redo_depth(&self) -> usize {
        self.redo_stack.len()
    }

    /// Returns the maximum capacity.
    pub fn max_depth(&self) -> usize {
        self.max_depth
    }

    /// Clears both undo and redo stacks.
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::graph::model::{Node, NodeId, NodeParam};

    /// P2-T5: Undo / redo restores exact node positions, parameters, and edges.
    #[test]
    pub fn test_history_undo_redo_positions_and_params() {
        let mut history = HistoryStack::new();
        let mut graph = Graph::new();

        // State 0: Node at [100.0, 100.0] with param = 1.0
        let mut n1 = Node::new(NodeId(1), "ConstantScalar", "S", [100.0, 100.0]);
        n1.set_param("value", NodeParam::Float(1.0));
        let out_pin = n1.add_output("output");
        graph.add_node(n1);

        // Record State 0 before mutating
        history.record(&graph, "Add Node 1");

        // State 1: Move Node 1 to [250.0, 350.0] and change param to 0.5
        let n1_mut = graph.get_node_mut(NodeId(1)).unwrap();
        n1_mut.position = [250.0, 350.0];
        n1_mut.set_param("value", NodeParam::Float(0.5));

        // Record State 1 before adding edge
        history.record(&graph, "Move Node 1 and modify param");

        // State 2: Add Node 2 and connect wire
        let mut n2 = Node::new(NodeId(2), "Invert", "I", [500.0, 350.0]);
        let in_pin = n2.add_input("input");
        graph.add_node(n2);
        graph.connect(out_pin, in_pin).unwrap();

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.get_node(NodeId(1)).unwrap().position, [250.0, 350.0]);

        // --- UNDO 1: Reverts State 2 -> State 1 ---
        assert!(history.can_undo());
        assert_eq!(
            history.undo_description(),
            Some("Move Node 1 and modify param")
        );
        let restored_state1 = history.undo(&graph).expect("Undo failed");
        graph = restored_state1;

        assert_eq!(graph.nodes.len(), 1);
        assert_eq!(graph.edges.len(), 0);
        assert_eq!(graph.get_node(NodeId(1)).unwrap().position, [250.0, 350.0]);
        assert_eq!(
            graph.get_node(NodeId(1)).unwrap().get_float("value", 0.0),
            0.5
        );

        // --- UNDO 2: Reverts State 1 -> State 0 ---
        assert!(history.can_undo());
        assert_eq!(history.undo_description(), Some("Add Node 1"));
        let restored_state0 = history.undo(&graph).expect("Undo failed");
        graph = restored_state0;

        assert_eq!(graph.nodes.len(), 1);
        assert_eq!(graph.edges.len(), 0);
        // Original exact position and parameter restored!
        assert_eq!(graph.get_node(NodeId(1)).unwrap().position, [100.0, 100.0]);
        assert_eq!(
            graph.get_node(NodeId(1)).unwrap().get_float("value", 0.0),
            1.0
        );
        assert!(!history.can_undo());

        // --- REDO 1: Restores State 1 ---
        assert!(history.can_redo());
        let redone_state1 = history.redo(&graph).expect("Redo failed");
        graph = redone_state1;

        assert_eq!(graph.get_node(NodeId(1)).unwrap().position, [250.0, 350.0]);
        assert_eq!(
            graph.get_node(NodeId(1)).unwrap().get_float("value", 0.0),
            0.5
        );

        // --- REDO 2: Restores State 2 ---
        assert!(history.can_redo());
        let redone_state2 = history.redo(&graph).expect("Redo failed");
        graph = redone_state2;

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert!(!history.can_redo());
    }

    /// Verify 100-step capacity ceiling eviction.
    #[test]
    pub fn test_history_100_step_capacity_eviction() {
        let mut history = HistoryStack::with_capacity(100);
        let graph = Graph::new();

        for i in 0..150 {
            history.record(&graph, format!("Action {}", i));
        }

        assert_eq!(history.undo_depth(), 100);
        assert_eq!(history.undo_description(), Some("Action 149"));
    }

    /// Verify that recording a new action clears the redo stack.
    #[test]
    pub fn test_history_redo_invalidation_on_new_record() {
        let mut history = HistoryStack::new();
        let mut graph = Graph::new();

        history.record(&graph, "Action 1");
        graph.create_node("A", "A", [0.0, 0.0]);

        // Undo
        let g_undone = history.undo(&graph).unwrap();
        assert!(history.can_redo());

        // Record a new action
        history.record(&g_undone, "Action 2");
        assert!(!history.can_redo());
    }

    /// Verify that rapid continuous parameter tweaks coalesce into a single undo step.
    #[test]
    pub fn test_history_record_coalesced_slider_drag() {
        let mut history = HistoryStack::new();
        let mut graph = Graph::new();
        let node_id = graph.create_node("ConstantScalar", "S", [0.0, 0.0]);
        let node = graph.get_node_mut(node_id).unwrap();
        node.set_param("value", NodeParam::Float(0.0));

        // Simulate 20 rapid slider movement ticks during a drag gesture
        for i in 1..=20 {
            // Record pre-mutation state with coalescing (1.0s window)
            history.record_coalesced(&graph, "Edit value", 1.0);
            let n = graph.get_node_mut(node_id).unwrap();
            n.set_param("value", NodeParam::Float(i as f32 * 0.05));
        }

        // Despite 20 edits, coalescing should have collapsed them to 1 undo entry!
        assert_eq!(history.undo_depth(), 1);
        assert_eq!(history.undo_description(), Some("Edit value"));

        // Undoing should immediately restore the value from before the entire drag gesture began (0.0)
        let restored = history.undo(&graph).expect("Undo failed");
        assert_eq!(
            restored.get_node(node_id).unwrap().get_float("value", 99.0),
            0.0
        );
        assert_eq!(history.undo_depth(), 0);
    }
}

