//! Batch Texture Set Processing Engine (Phase 3).
//!
//! Provides automated queue-based processing of texture set directories:
//! scanning files, classifying PBR roles with lexical analysis, binding
//! template graphs, evaluating DAG networks, and exporting using industry presets.

pub mod processor;

pub use processor::{
    bind_texture_input_nodes, collect_export_items, determine_asset_stem,
    infer_node_target_role, resolve_export_preset, scan_texture_directory, BatchError,
    BatchJob, BatchProcessor, BatchProgress, BatchReport, BatchStatus,
};
