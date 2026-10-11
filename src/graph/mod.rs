//! Directed acyclic graph engine and reactive compiler (Phase 2).
//!
//! Provides the core graph data model, Kahn's topological sort compiler,
//! dirty-node memoized evaluation engine, and transactional undo/redo history.

pub mod compiler;
pub mod evaluator;
pub mod history;
pub mod layout;
pub mod model;

pub use compiler::{CompileError, GraphCompiler};
pub use evaluator::{
    DefaultNodeExecutor, EvaluationError, EvaluationReport, GraphEvaluator, NodeExecutor,
};
pub use history::{HistoryEntry, HistoryStack, DEFAULT_HISTORY_CAPACITY};
pub use layout::{auto_layout_back_hierarchy, auto_layout_graph, auto_layout_graph_contextual};
pub use model::{
    Edge, Graph, GraphError, Node, NodeId, NodeParam, Pin, PinId, PinType, ProjectError,
    ProjectFile, ProjectMetadata,
};
