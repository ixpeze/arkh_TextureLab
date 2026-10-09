//! Topological DAG compiler using Kahn's algorithm with cycle prevention (Phase 2).
//!
//! Provides deterministic evaluation order calculation, cycle detection,
//! dependency analysis, and incremental subgraph resolution.

use crate::graph::model::{Graph, NodeId};
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};

/// Compilation errors during graph validation and topological analysis.
#[derive(Debug, PartialEq, Eq, Clone)]
pub enum CompileError {
    CycleDetected,
    DanglingEdge,
    InvalidEdge(String),
    MissingNode(NodeId),
}

impl std::fmt::Display for CompileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CompileError::CycleDetected => {
                write!(f, "Cycle detected in directed acyclic graph")
            }
            CompileError::DanglingEdge => {
                write!(f, "Dangling edge connects to non-existent node")
            }
            CompileError::InvalidEdge(msg) => write!(f, "Invalid edge: {}", msg),
            CompileError::MissingNode(id) => write!(f, "Node {} is missing from graph", id),
        }
    }
}

impl std::error::Error for CompileError {}

/// Reactive DAG Compiler that analyzes dependencies and orders execution.
pub struct GraphCompiler;

impl GraphCompiler {
    /// Orders nodes using Kahn's algorithm for deterministic evaluation.
    ///
    /// Guarantees that any upstream dependency node `U` will appear strictly
    /// before any downstream node `V` that depends on `U`.
    ///
    /// Uses a min-heap tie breaker to ensure 100% deterministic compilation orders
    /// across any OS platform and execution run.
    pub fn compile(graph: &Graph) -> Result<Vec<NodeId>, CompileError> {
        let mut in_degree: HashMap<NodeId, usize> = HashMap::with_capacity(graph.nodes.len());
        let mut adj: HashMap<NodeId, Vec<NodeId>> = HashMap::with_capacity(graph.nodes.len());

        for &id in graph.nodes.keys() {
            in_degree.insert(id, 0);
            adj.insert(id, Vec::new());
        }

        for edge in &graph.edges {
            // Dangling edge preflight check
            if !graph.nodes.contains_key(&edge.from.node_id)
                || !graph.nodes.contains_key(&edge.to.node_id)
            {
                return Err(CompileError::DanglingEdge);
            }

            // Self loops are cycles
            if edge.from.node_id == edge.to.node_id {
                return Err(CompileError::CycleDetected);
            }

            *in_degree.entry(edge.to.node_id).or_insert(0) += 1;
            adj.entry(edge.from.node_id).or_default().push(edge.to.node_id);
        }

        // Min-heap for deterministic node ordering (smallest NodeId popped first)
        let mut queue: BinaryHeap<Reverse<NodeId>> = in_degree
            .iter()
            .filter(|&(_, &deg)| deg == 0)
            .map(|(&id, _)| Reverse(id))
            .collect();

        let mut sorted = Vec::with_capacity(graph.nodes.len());

        while let Some(Reverse(u)) = queue.pop() {
            sorted.push(u);
            if let Some(neighbors) = adj.get(&u) {
                for &v in neighbors {
                    let deg = in_degree
                        .get_mut(&v)
                        .ok_or(CompileError::MissingNode(v))?;
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(Reverse(v));
                    }
                }
            }
        }

        if sorted.len() != graph.nodes.len() {
            Err(CompileError::CycleDetected)
        } else {
            Ok(sorted)
        }
    }

    /// Fast preflight check to determine if adding an edge from `from` to `to`
    /// would introduce a circular dependency cycle.
    pub fn would_create_cycle(graph: &Graph, from: NodeId, to: NodeId) -> bool {
        // Direct self-connection is always an immediate cycle
        if from == to {
            return true;
        }

        // If there already exists a path from `to` to `from`,
        // then adding `from -> to` would complete a cycle.
        let mut visited: HashSet<NodeId> = HashSet::new();
        let mut queue: VecDeque<NodeId> = VecDeque::new();
        queue.push_back(to);
        visited.insert(to);

        while let Some(curr) = queue.pop_front() {
            if curr == from {
                return true;
            }
            for edge in graph.edges_from(curr) {
                let next = edge.to.node_id;
                if visited.insert(next) {
                    queue.push_back(next);
                }
            }
        }

        false
    }

    /// Returns true if the graph contains any cycles.
    pub fn has_cycle(graph: &Graph) -> bool {
        Self::compile(graph).is_err()
    }

    /// Computes the set of all upstream nodes that feed data into `target` (transitively).
    pub fn upstream_nodes(graph: &Graph, target: NodeId) -> HashSet<NodeId> {
        let mut upstream = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(target);

        while let Some(curr) = queue.pop_front() {
            for edge in graph.edges_to(curr) {
                let parent = edge.from.node_id;
                if upstream.insert(parent) {
                    queue.push_back(parent);
                }
            }
        }

        upstream
    }

    /// Computes the set of all downstream nodes that depend on `source` (transitively).
    pub fn downstream_nodes(graph: &Graph, source: NodeId) -> HashSet<NodeId> {
        let mut downstream = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(source);

        while let Some(curr) = queue.pop_front() {
            for edge in graph.edges_from(curr) {
                let child = edge.to.node_id;
                if downstream.insert(child) {
                    queue.push_back(child);
                }
            }
        }

        downstream
    }

    /// Compiles and orders only the subgraph required to evaluate `targets`.
    pub fn compile_subgraph(
        graph: &Graph,
        targets: &[NodeId],
    ) -> Result<Vec<NodeId>, CompileError> {
        let mut needed_nodes = HashSet::new();
        for &target in targets {
            if !graph.nodes.contains_key(&target) {
                return Err(CompileError::MissingNode(target));
            }
            needed_nodes.insert(target);
            let parents = Self::upstream_nodes(graph, target);
            needed_nodes.extend(parents);
        }

        // Subgraph in-degrees
        let mut in_degree: HashMap<NodeId, usize> = HashMap::new();
        let mut adj: HashMap<NodeId, Vec<NodeId>> = HashMap::new();

        for &id in &needed_nodes {
            in_degree.insert(id, 0);
            adj.insert(id, Vec::new());
        }

        for edge in &graph.edges {
            if needed_nodes.contains(&edge.from.node_id) && needed_nodes.contains(&edge.to.node_id) {
                *in_degree.entry(edge.to.node_id).or_insert(0) += 1;
                adj.entry(edge.from.node_id).or_default().push(edge.to.node_id);
            }
        }

        let mut queue: BinaryHeap<Reverse<NodeId>> = in_degree
            .iter()
            .filter(|&(_, &deg)| deg == 0)
            .map(|(&id, _)| Reverse(id))
            .collect();

        let mut sorted = Vec::with_capacity(needed_nodes.len());

        while let Some(Reverse(u)) = queue.pop() {
            sorted.push(u);
            if let Some(neighbors) = adj.get(&u) {
                for &v in neighbors {
                    let deg = in_degree.get_mut(&v).unwrap();
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(Reverse(v));
                    }
                }
            }
        }

        if sorted.len() != needed_nodes.len() {
            Err(CompileError::CycleDetected)
        } else {
            Ok(sorted)
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::graph::model::{Edge, PinId};

    #[test]
    pub fn test_topological_sort() {
        // Construct DAG: Node 1 -> Node 2 -> Node 3
        let mut graph = Graph::new();
        let n1 = graph.create_node("TextureInput", "Albedo", [0.0, 0.0]);
        let n2 = graph.create_node("Invert", "Invert Color", [200.0, 0.0]);
        let n3 = graph.create_node("TextureOutput", "Final Output", [400.0, 0.0]);

        graph
            .connect(PinId::output(n1, "out"), PinId::input(n2, "in"))
            .unwrap();
        graph
            .connect(PinId::output(n2, "out"), PinId::input(n3, "in"))
            .unwrap();

        let order = GraphCompiler::compile(&graph).expect("Compilation must succeed");
        assert_eq!(order, vec![n1, n2, n3]);

        // Branching DAG:
        // n1 -> n2 \
        //           -> n4
        // n3 ------/
        let mut branch_graph = Graph::new();
        let b1 = branch_graph.create_node("Input1", "A", [0.0, 0.0]);
        let b2 = branch_graph.create_node("Filter", "B", [100.0, 0.0]);
        let b3 = branch_graph.create_node("Input2", "C", [0.0, 100.0]);
        let b4 = branch_graph.create_node("Combine", "D", [200.0, 50.0]);

        branch_graph
            .connect(PinId::output(b1, "out"), PinId::input(b2, "in"))
            .unwrap();
        branch_graph
            .connect(PinId::output(b2, "out"), PinId::input(b4, "in1"))
            .unwrap();
        branch_graph
            .connect(PinId::output(b3, "out"), PinId::input(b4, "in2"))
            .unwrap();

        let branch_order = GraphCompiler::compile(&branch_graph).unwrap();

        // b1 must be before b2, b2 before b4, b3 before b4
        let pos = |id: NodeId| branch_order.iter().position(|&x| x == id).unwrap();
        assert!(pos(b1) < pos(b2));
        assert!(pos(b2) < pos(b4));
        assert!(pos(b3) < pos(b4));
    }

    #[test]
    pub fn test_cycle_detection() {
        // Construct cycle: 1 -> 2 -> 3 -> 1
        let mut graph = Graph::new();
        let n1 = graph.create_node("NodeA", "A", [0.0, 0.0]);
        let n2 = graph.create_node("NodeB", "B", [100.0, 0.0]);
        let n3 = graph.create_node("NodeC", "C", [200.0, 0.0]);

        graph
            .connect(PinId::output(n1, "out"), PinId::input(n2, "in"))
            .unwrap();
        graph
            .connect(PinId::output(n2, "out"), PinId::input(n3, "in"))
            .unwrap();

        assert!(!GraphCompiler::would_create_cycle(&graph, n1, n2));
        assert!(GraphCompiler::would_create_cycle(&graph, n3, n1));

        // Add back-edge to create cycle
        let _ = graph.connect(PinId::output(n3, "out"), PinId::input(n1, "in"));
        let res = GraphCompiler::compile(&graph);
        assert_eq!(res, Err(CompileError::CycleDetected));
    }

    #[test]
    pub fn test_dangling_edge() {
        let mut graph = Graph::new();
        let n1 = graph.create_node("NodeA", "A", [0.0, 0.0]);

        // Connect to a non-existent node ID
        graph.edges.push(Edge::new(
            PinId::output(n1, "out"),
            PinId::input(NodeId(999), "in"),
        ));

        let res = GraphCompiler::compile(&graph);
        assert_eq!(res, Err(CompileError::DanglingEdge));
    }

    #[test]
    pub fn test_upstream_downstream_queries() {
        let mut graph = Graph::new();
        let n1 = graph.create_node("A", "A", [0.0, 0.0]);
        let n2 = graph.create_node("B", "B", [100.0, 0.0]);
        let n3 = graph.create_node("C", "C", [200.0, 0.0]);
        let n4 = graph.create_node("D", "D", [300.0, 0.0]);

        graph
            .connect(PinId::output(n1, "out"), PinId::input(n2, "in"))
            .unwrap();
        graph
            .connect(PinId::output(n2, "out"), PinId::input(n3, "in"))
            .unwrap();
        graph
            .connect(PinId::output(n3, "out"), PinId::input(n4, "in"))
            .unwrap();

        let up = GraphCompiler::upstream_nodes(&graph, n4);
        assert_eq!(up.len(), 3);
        assert!(up.contains(&n1) && up.contains(&n2) && up.contains(&n3));

        let down = GraphCompiler::downstream_nodes(&graph, n1);
        assert_eq!(down.len(), 3);
        assert!(down.contains(&n2) && down.contains(&n3) && down.contains(&n4));
    }
}
