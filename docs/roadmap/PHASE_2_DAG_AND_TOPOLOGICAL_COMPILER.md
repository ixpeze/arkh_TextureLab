# PHASE 2 — Topological DAG Engine & Reactive Compiler

**Goal:** Author the reactive directed acyclic graph compiler (`GraphCompiler`) using Kahn's topological sort algorithm, automatic cycle prevention, dirty-node memoization (`GraphEvaluator`), Serde JSON `.tlab` serialization, and a 100-step transactional undo/redo stack.  
**Prerequisites:** Phase 1. **Effort:** L. **Touches:** `src/graph/mod.rs`, `src/graph/model.rs`, `src/graph/compiler.rs`, `src/graph/evaluator.rs`, `src/graph/history.rs`, `tests/`.

---

## 1. Scope

- **IN:** Data model for nodes, pins, and edges; Kahn's topological sorting algorithm; cycle detection; reactive cache evaluation with dirty-node tracking; Serde `.tlab` project serialization/deserialization; transactional undo/redo history; resolution inheritance logic.
- **OUT:** Concrete pixel shaders/node operations (Phase 3), UI canvas rendering (Phase 5).

---

## 2. Technical Architecture & Data Contracts

### 2.1 Graph Data Model (`src/graph/model.rs`)
```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct NodeId(pub u64);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PinId {
    pub node_id: NodeId,
    pub name: String,
    pub is_input: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Edge {
    pub from: PinId,
    pub to: PinId,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Graph {
    pub nodes: HashMap<NodeId, Node>,
    pub edges: Vec<Edge>,
}
```

### 2.2 Kahn's Topological Sort (`src/graph/compiler.rs`)
```rust
pub struct GraphCompiler;

#[derive(Debug, PartialEq, Eq)]
pub enum CompileError {
    CycleDetected,
    DanglingEdge,
}

impl GraphCompiler {
    /// Orders nodes using Kahn's algorithm for deterministic evaluation
    pub fn compile(graph: &Graph) -> Result<Vec<NodeId>, CompileError> {
        let mut in_degree: HashMap<NodeId, usize> = HashMap::new();
        let mut adj: HashMap<NodeId, Vec<NodeId>> = HashMap::new();

        for &id in graph.nodes.keys() {
            in_degree.insert(id, 0);
            adj.insert(id, Vec::new());
        }

        for edge in &graph.edges {
            *in_degree.entry(edge.to.node_id).or_insert(0) += 1;
            adj.entry(edge.from.node_id).or_default().push(edge.to.node_id);
        }

        let mut queue: Vec<NodeId> = in_degree
            .iter()
            .filter(|&(_, &deg)| deg == 0)
            .map(|(&id, _)| id)
            .collect();

        let mut sorted = Vec::new();

        while let Some(u) = queue.pop() {
            sorted.push(u);
            if let Some(neighbors) = adj.get(&u) {
                for &v in neighbors {
                    let deg = in_degree.get_mut(&v).unwrap();
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(v);
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
}
```

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P2-T1** | **Graph Data Model:** Define `NodeId`, `PinId`, `Edge`, and `Graph` structs with complete `serde::{Serialize, Deserialize}` derives. | `src/graph/model.rs` | Serde roundtrip tests pass without data truncation. |
| **P2-T2** | **Kahn's Topological Sort:** Implement `GraphCompiler::compile` with in-degree analysis and cycle prevention. | `src/graph/compiler.rs` | Cycle tests return `Err(CompileError::CycleDetected)`. |
| **P2-T3** | **Reactive Evaluation Engine:** Build `GraphEvaluator` to memoize evaluated `SharedTextureBuffer` results per node socket and avoid recomputing clean nodes. | `src/graph/evaluator.rs` | Re-evaluating unchanged nodes takes < 0.1 ms (cache hit). |
| **P2-T4** | **Resolution & Aspect Propagation:** Propagate canvas working dimensions from connected inputs; preserve non-square aspect ratios (e.g. 4096x2048). | `src/graph/evaluator.rs` | Non-square texture inputs evaluate without squashing. |
| **P2-T5** | **Transactional History Stack:** 100-step transactional undo/redo stack (`HistoryStack`) recording atomic graph transitions. | `src/graph/history.rs` | Undo / redo restores exact node positions, parameters, and edges. |
| **P2-T6** | **`.tlab` Project Serialization:** Save and load complete graph project files to JSON with backward compatibility. | `src/graph/model.rs` | Project serialization round-trip integration test passes. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-201** | Topological Sort Ordering | `cargo test graph::compiler::tests::test_topological_sort` | Upstream nodes evaluated before downstream dependents |
| **TC-202** | Cycle Detection Error | `cargo test test_cycle_detection` | Adding a circular edge fails compilation gracefully |
| **TC-203** | Serde `.tlab` Serialization Roundtrip | `cargo test test_graph_serialization_roundtrip` | Identical nodes and edges restored after deserialization |
| **TC-204** | Reactive Cache Invalidation | `cargo test test_cache_invalidation` | Modifying node A re-evaluates B, but leaves independent C untouched |

---

## 5. Exit Criteria Checklist

- [ ] Kahn's algorithm produces correct execution order for complex branching DAGs.
- [ ] Circular dependencies are detected and rejected with clear error types.
- [ ] Evaluation cache memoizes intermediate results, preventing redundant computation.
- [ ] Serde JSON round-trip retains 100% of graph state and parameters.
- [ ] All graph tests pass cleanly via `cargo test`.

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P2-T1 | `cargo test test_graph_serialization` | Passed | [ ] |
| P2-T2 | `cargo test graph::compiler` | Passed | [ ] |
| P2-T3 | `cargo test graph::evaluator` | Passed | [ ] |
