//! Batch Texture Set Processor Engine (Phase 3).
//!
//! Provides automated queue-based processing of texture set directories:
//! scanning input folders, classifying PBR roles with lexical analysis,
//! binding template graphs, evaluating DAG networks, and exporting using presets.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::export::tokens::TokenContext;
use crate::export::writer::{ExportItem, ExportWriter};
use crate::export::ExportPreset;
use crate::graph::evaluator::GraphEvaluator;
use crate::graph::model::{Node, NodeId, NodeParam, PinId, ProjectFile};
use crate::normalizer::rules::{LexicalNormalizer, PbrRole, TextureMetadata};

/// Current lifecycle status of an individual batch job.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum BatchStatus {
    /// Waiting in the queue to be processed.
    Pending,
    /// Currently being processed.
    Processing,
    /// Successfully evaluated and exported.
    Completed {
        files_written: usize,
        elapsed_ms: u128,
    },
    /// Encountered a fatal error during evaluation or export.
    Failed(String),
}

impl BatchStatus {
    /// Returns true if the job is waiting in the queue.
    pub fn is_pending(&self) -> bool {
        matches!(self, Self::Pending)
    }

    /// Returns true if the job is actively processing.
    pub fn is_processing(&self) -> bool {
        matches!(self, Self::Processing)
    }

    /// Returns true if the job completed successfully.
    pub fn is_completed(&self) -> bool {
        matches!(self, Self::Completed { .. })
    }

    /// Returns true if the job failed.
    pub fn is_failed(&self) -> bool {
        matches!(self, Self::Failed(_))
    }

    /// Short human-readable display string for UI badges.
    pub fn display_text(&self) -> String {
        match self {
            Self::Pending => "Pending".to_string(),
            Self::Processing => "Processing...".to_string(),
            Self::Completed { files_written, .. } => format!("Completed ({} files)", files_written),
            Self::Failed(err) => format!("Failed: {}", err),
        }
    }
}

/// An individual texture set processing task queued in the batch processor.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct BatchJob {
    /// Path to the directory containing source texture maps.
    pub input_dir: PathBuf,
    /// Path to the destination directory where exported maps are written.
    pub output_dir: PathBuf,
    /// Graph template loaded from `.tlab` project file.
    pub template: ProjectFile,
    /// Identifier or name of the export preset (e.g. "ue5", "unity", "blender").
    pub preset_name: String,
    /// Current job status.
    pub status: BatchStatus,
}

impl BatchJob {
    /// Constructs a new batch job in `Pending` status.
    pub fn new(
        input_dir: impl Into<PathBuf>,
        output_dir: impl Into<PathBuf>,
        template: ProjectFile,
        preset_name: impl Into<String>,
    ) -> Self {
        Self {
            input_dir: input_dir.into(),
            output_dir: output_dir.into(),
            template,
            preset_name: preset_name.into(),
            status: BatchStatus::Pending,
        }
    }

    /// Returns the name of the folder containing the texture set.
    pub fn folder_name(&self) -> String {
        self.input_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("TextureSet")
            .to_string()
    }
}

/// Detailed outcome report produced after processing a single texture set.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct BatchReport {
    /// Identified asset stem or directory name.
    pub set_name: String,
    /// Scanned input directory.
    pub input_dir: PathBuf,
    /// Destination export directory.
    pub output_dir: PathBuf,
    /// Output file paths written to disk.
    pub files_written: Vec<PathBuf>,
    /// Total bytes written.
    pub bytes_written: u64,
    /// Total wall-clock duration in milliseconds.
    pub elapsed_ms: u128,
    /// Binding pairs of (Node Label, Texture Path).
    pub bound_textures: Vec<(String, PathBuf)>,
    /// Diagnostic errors or failure messages.
    pub errors: Vec<String>,
}

impl BatchReport {
    /// Returns true if all files were written with zero errors.
    pub fn is_success(&self) -> bool {
        self.errors.is_empty() && !self.files_written.is_empty()
    }
}

/// Errors that can occur during batch processor execution.
#[derive(Debug, Clone)]
pub enum BatchError {
    /// Queue has no jobs left in `Pending` status.
    NoPendingJobs,
    /// Directory does not exist or is not a directory.
    InvalidDirectory(String),
    /// No valid image textures found in the input directory.
    NoTexturesFound(PathBuf),
    /// DAG graph evaluation failed.
    EvaluationFailed(String),
    /// Direct disk export or preflight failed.
    ExportFailed(String),
    /// Filesystem I/O error.
    Io(String),
}

impl std::fmt::Display for BatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoPendingJobs => write!(f, "No pending jobs in the batch queue"),
            Self::InvalidDirectory(msg) => write!(f, "Invalid directory: {}", msg),
            Self::NoTexturesFound(path) => {
                write!(f, "No supported texture maps found in {:?}", path)
            }
            Self::EvaluationFailed(err) => write!(f, "Graph evaluation error: {}", err),
            Self::ExportFailed(err) => write!(f, "Export failed: {}", err),
            Self::Io(err) => write!(f, "I/O error: {}", err),
        }
    }
}

impl std::error::Error for BatchError {}

/// Progress summary for UI progress bars and status indicators.
#[derive(Clone, Debug, PartialEq)]
pub struct BatchProgress {
    /// Number of completed jobs.
    pub current: usize,
    /// Total number of jobs in the queue.
    pub total: usize,
    /// Name of the texture set currently being processed or next in line.
    pub current_set_name: Option<String>,
}

/// Batch texture set processor managing queue execution and report logs.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BatchProcessor {
    /// Queue of texture set jobs.
    pub jobs: Vec<BatchJob>,
    /// Index of the current or next job to execute.
    pub current_index: usize,
    /// Whether automated sequential execution is actively running.
    pub is_running: bool,
    /// Default starter template name applied to newly added folders.
    pub selected_template_name: String,
    /// Default export preset identifier applied to newly added folders.
    pub selected_preset_id: String,
    /// Optional global default export folder override.
    pub default_output_dir: Option<PathBuf>,
    /// Completed job reports.
    pub reports: Vec<BatchReport>,
    /// Activity and execution log entries.
    pub log_messages: Vec<String>,
}

impl Default for BatchProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl BatchProcessor {
    /// Constructs a new empty batch processor with standard defaults.
    pub fn new() -> Self {
        Self {
            jobs: Vec::new(),
            current_index: 0,
            is_running: false,
            selected_template_name: "UE5 ORM Pack".to_string(),
            selected_preset_id: "ue5".to_string(),
            default_output_dir: None,
            reports: Vec::new(),
            log_messages: vec!["Batch processor ready. Add folders or drag from Explorer.".to_string()],
        }
    }

    /// Adds a preconfigured `BatchJob` to the end of the queue.
    pub fn add_job(&mut self, job: BatchJob) {
        let name = job.folder_name();
        self.jobs.push(job);
        self.log(format!("Queued texture set: {}", name));
    }

    /// Queues a directory path as a new batch job using currently selected template and preset.
    pub fn add_folder(
        &mut self,
        input_dir: impl Into<PathBuf>,
        template_override: Option<ProjectFile>,
        preset_override: Option<String>,
    ) -> Result<(), BatchError> {
        let input_dir = input_dir.into();
        if !input_dir.exists() {
            return Err(BatchError::InvalidDirectory(format!(
                "Directory does not exist: {:?}",
                input_dir
            )));
        }
        if !input_dir.is_dir() {
            return Err(BatchError::InvalidDirectory(format!(
                "Path is not a directory: {:?}",
                input_dir
            )));
        }

        // Determine destination output directory
        let folder_name = input_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Exported");

        let output_dir = if let Some(base) = &self.default_output_dir {
            base.join(folder_name)
        } else {
            input_dir.join("exports")
        };

        // Resolve template
        let template = if let Some(tpl) = template_override {
            tpl
        } else {
            self.load_selected_template()?
        };

        let preset_name = preset_override.unwrap_or_else(|| self.selected_preset_id.clone());

        let job = BatchJob::new(input_dir, output_dir, template, preset_name);
        self.add_job(job);
        Ok(())
    }

    /// Loads the currently selected starter template from catalog.
    pub fn load_selected_template(&self) -> Result<ProjectFile, BatchError> {
        let templates = crate::templates::builtin_templates();
        let entry = templates
            .iter()
            .find(|t| t.name.eq_ignore_ascii_case(&self.selected_template_name))
            .or_else(|| templates.first())
            .ok_or_else(|| BatchError::InvalidDirectory("No starter templates available".to_string()))?;

        entry
            .load_project()
            .map_err(|e| BatchError::EvaluationFailed(format!("Template error: {}", e)))
    }

    /// Appends a message to the internal execution log.
    pub fn log(&mut self, msg: impl Into<String>) {
        let ts = chrono::Local::now().format("%H:%M:%S");
        self.log_messages.push(format!("[{}] {}", ts, msg.into()));
    }

    /// Clears all completed reports and logs.
    pub fn clear_logs(&mut self) {
        self.log_messages.clear();
        self.reports.clear();
    }

    /// Clears all jobs from the queue.
    pub fn clear_jobs(&mut self) {
        self.jobs.clear();
        self.current_index = 0;
        self.is_running = false;
        self.log("Batch queue cleared.");
    }

    /// Removes a job at the given index.
    pub fn remove_job(&mut self, index: usize) {
        if index < self.jobs.len() {
            let removed = self.jobs.remove(index);
            self.log(format!("Removed job: {}", removed.folder_name()));
        }
    }

    /// Resets all job statuses back to `Pending` so the batch can be re-run.
    pub fn reset_all(&mut self) {
        for job in &mut self.jobs {
            job.status = BatchStatus::Pending;
        }
        self.current_index = 0;
        self.is_running = false;
        self.log("Reset all jobs in queue to Pending.");
    }

    /// Calculates current progress metrics across the queue.
    pub fn progress(&self) -> BatchProgress {
        let total = self.jobs.len();
        let current = self.jobs.iter().filter(|j| j.status.is_completed()).count();
        let current_set_name = self
            .jobs
            .iter()
            .find(|j| j.status.is_processing())
            .or_else(|| self.jobs.iter().find(|j| j.status.is_pending()))
            .map(|j| j.folder_name());

        BatchProgress {
            current,
            total,
            current_set_name,
        }
    }

    /// Returns the progress ratio as a float between 0.0 and 1.0.
    pub fn progress_ratio(&self) -> f32 {
        if self.jobs.is_empty() {
            0.0
        } else {
            let completed = self.jobs.iter().filter(|j| j.status.is_completed()).count();
            completed as f32 / self.jobs.len() as f32
        }
    }

    /// Processes the next pending job in the queue sequentially.
    ///
    /// 1. Finds the next `Pending` job.
    /// 2. Scans `input_dir` for supported texture files.
    /// 3. Normalizes filenames using `LexicalNormalizer` to classify PBR roles.
    /// 4. Clones template graph and binds matching `TextureInput` nodes.
    /// 5. Evaluates graph reactively.
    /// 6. Resolves export target filenames using `ExportPreset` and writes directly to disk.
    /// 7. Updates `status` and returns `BatchReport`.
    pub fn process_next(&mut self) -> Result<BatchReport, BatchError> {
        let job_idx = self
            .jobs
            .iter()
            .position(|j| j.status == BatchStatus::Pending)
            .ok_or(BatchError::NoPendingJobs)?;

        self.current_index = job_idx;
        self.jobs[job_idx].status = BatchStatus::Processing;

        let start_time = Instant::now();
        let job = self.jobs[job_idx].clone();
        let set_label = job.folder_name();

        self.log(format!(
            "[{}/{}] Processing texture set: '{}'",
            job_idx + 1,
            self.jobs.len(),
            set_label
        ));

        // 1. Scan input_dir for valid image texture files
        let scanned_files = scan_texture_directory(&job.input_dir)?;
        if scanned_files.is_empty() {
            let err = format!("No supported texture maps found in {:?}", job.input_dir);
            self.jobs[job_idx].status = BatchStatus::Failed(err.clone());
            self.log(format!("Error: {}", err));
            return Err(BatchError::NoTexturesFound(job.input_dir));
        }

        self.log(format!(
            "Found {} candidate texture map(s) in {:?}",
            scanned_files.len(),
            job.input_dir
        ));

        // 2. Determine Asset Name Stem from lexical analysis
        let asset_name = determine_asset_stem(&scanned_files, &set_label);

        // 3. Load template graph & bind TextureInput nodes
        let mut graph = job.template.graph.clone();
        let bound_textures = bind_texture_input_nodes(&mut graph, &scanned_files);

        self.log(format!(
            "Bound {} graph input node(s) with classified PBR maps",
            bound_textures.len()
        ));

        // 4. Evaluate graph reactively
        let working_res = job.template.metadata.working_resolution;
        let mut evaluator = GraphEvaluator::new(working_res);
        if let Err(e) = evaluator.evaluate(&graph) {
            let err_msg = format!("Graph evaluation error: {}", e);
            self.jobs[job_idx].status = BatchStatus::Failed(err_msg.clone());
            self.log(format!("Error: {}", err_msg));
            return Err(BatchError::EvaluationFailed(err_msg));
        }

        // 5. Resolve export preset
        let preset = resolve_export_preset(&job.preset_name);

        // 6. Assemble export items from SaveImage / TextureOutput nodes
        let items_to_export = collect_export_items(&graph, &evaluator, &preset, &asset_name, &job.output_dir);
        if items_to_export.is_empty() {
            let err_msg = "No export targets or evaluated output buffers found in graph".to_string();
            self.jobs[job_idx].status = BatchStatus::Failed(err_msg.clone());
            self.log(format!("Error: {}", err_msg));
            return Err(BatchError::ExportFailed(err_msg));
        }

        // Ensure output directory exists
        if let Err(e) = fs::create_dir_all(&job.output_dir) {
            let err_msg = format!("Failed to create output directory {:?}: {}", job.output_dir, e);
            self.jobs[job_idx].status = BatchStatus::Failed(err_msg.clone());
            self.log(format!("Error: {}", err_msg));
            return Err(BatchError::Io(err_msg));
        }

        // 7. Write exported textures directly to disk via Rayon parallel atomic writes
        let write_report = ExportWriter::execute_export(&items_to_export);
        let elapsed_ms = start_time.elapsed().as_millis();

        let batch_report = BatchReport {
            set_name: asset_name,
            input_dir: job.input_dir.clone(),
            output_dir: job.output_dir.clone(),
            files_written: write_report.files_written.clone(),
            bytes_written: write_report.bytes_written,
            elapsed_ms,
            bound_textures,
            errors: write_report.errors.clone(),
        };

        if write_report.is_success() {
            self.jobs[job_idx].status = BatchStatus::Completed {
                files_written: write_report.files_written.len(),
                elapsed_ms,
            };
            self.log(format!(
                "Successfully exported {} file(s) ({:.2} MB) in {}ms",
                write_report.files_written.len(),
                write_report.bytes_written as f64 / 1_048_576.0,
                elapsed_ms
            ));
            self.reports.push(batch_report.clone());
            Ok(batch_report)
        } else {
            let err_msg = write_report.errors.join("; ");
            self.jobs[job_idx].status = BatchStatus::Failed(err_msg.clone());
            self.log(format!("Export failed: {}", err_msg));
            self.reports.push(batch_report);
            Err(BatchError::ExportFailed(err_msg))
        }
    }

    /// Processes all pending jobs sequentially until completion or first error.
    pub fn process_all(&mut self) -> Vec<Result<BatchReport, BatchError>> {
        let mut results = Vec::new();
        while self.jobs.iter().any(|j| j.status.is_pending()) {
            let res = self.process_next();
            let is_err = res.is_err();
            results.push(res);
            if is_err {
                break;
            }
        }
        results
    }
}

/// Scans a directory for files matching supported image extensions.
pub fn scan_texture_directory(dir: &Path) -> Result<Vec<(PathBuf, TextureMetadata)>, BatchError> {
    if !dir.exists() {
        return Err(BatchError::InvalidDirectory(format!(
            "Directory does not exist: {:?}",
            dir
        )));
    }
    if !dir.is_dir() {
        return Err(BatchError::InvalidDirectory(format!(
            "Path is not a directory: {:?}",
            dir
        )));
    }

    let mut scanned = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| BatchError::Io(e.to_string()))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) {
                if matches!(
                    ext.as_str(),
                    "png" | "jpg" | "jpeg" | "tga" | "webp" | "bmp" | "exr" | "tif" | "tiff"
                ) {
                    let filename = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    let metadata = LexicalNormalizer::normalize(&filename);
                    scanned.push((path, metadata));
                }
            }
        }
    }

    // Sort deterministically by file path
    scanned.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(scanned)
}

/// Determines the best canonical asset stem for token replacement.
pub fn determine_asset_stem(scanned: &[(PathBuf, TextureMetadata)], fallback: &str) -> String {
    // 1. Prefer BaseColor / Albedo clean stem
    for (_, meta) in scanned {
        if meta.inferred_role == Some(PbrRole::BaseColor) && !meta.clean_stem.trim().is_empty() {
            return meta.clean_stem.clone();
        }
    }
    // 2. Otherwise pick first non-empty clean stem
    for (_, meta) in scanned {
        if meta.inferred_role.is_some() && !meta.clean_stem.trim().is_empty() {
            return meta.clean_stem.clone();
        }
    }
    for (_, meta) in scanned {
        if !meta.clean_stem.trim().is_empty() {
            return meta.clean_stem.clone();
        }
    }
    // 3. Fallback to folder name
    fallback.to_string()
}

/// Infers the expected `PbrRole` of a graph node from its parameters or label.
pub fn infer_node_target_role(node: &Node) -> Option<PbrRole> {
    // 1. Check explicit "role" parameter
    if let Some(role_str) = node.get_param("role").and_then(|p| p.as_str()) {
        if let Some(r) = LexicalNormalizer::infer_role(role_str) {
            return Some(r);
        }
    }
    // 2. Check "slot_name" parameter
    if let Some(slot) = node.get_param("slot_name").and_then(|p| p.as_str()) {
        if let Some(r) = LexicalNormalizer::infer_role(slot) {
            return Some(r);
        }
    }
    // 3. Keyword checks on node label
    let lower = node.label.to_lowercase();
    if lower.contains("ambient") || lower.contains("ao") || lower.contains("occlusion") {
        return Some(PbrRole::AmbientOcclusion);
    }
    if lower.contains("rough") {
        return Some(PbrRole::Roughness);
    }
    if lower.contains("metal") {
        return Some(PbrRole::Metallic);
    }
    if lower.contains("normal") {
        return Some(PbrRole::Normal);
    }
    if lower.contains("albedo") || lower.contains("base color") || lower.contains("basecolor") || lower.contains("diffuse") {
        return Some(PbrRole::BaseColor);
    }
    if lower.contains("height") || lower.contains("displace") {
        return Some(PbrRole::Height);
    }
    if lower.contains("emiss") {
        return Some(PbrRole::Emissive);
    }
    if lower.contains("gloss") || lower.contains("smooth") {
        return Some(PbrRole::Glossiness);
    }
    if lower.contains("mask") || lower.contains("detail") {
        return Some(PbrRole::Mask);
    }

    // 4. Token-level inference
    for tok in LexicalNormalizer::tokenize(&node.label) {
        if let Some(r) = LexicalNormalizer::infer_role(&tok) {
            return Some(r);
        }
    }

    None
}

/// Binds scanned texture files to matching `TextureInput` nodes in the template graph.
pub fn bind_texture_input_nodes(
    graph: &mut crate::graph::model::Graph,
    scanned_files: &[(PathBuf, TextureMetadata)],
) -> Vec<(String, PathBuf)> {
    let mut bound = Vec::new();
    let mut used_paths = HashSet::new();

    // Identify all input nodes
    let input_node_ids: Vec<NodeId> = graph
        .nodes
        .values()
        .filter(|n| n.node_type == "TextureInput" || n.node_type == "Input")
        .map(|n| n.id)
        .collect();

    for node_id in input_node_ids {
        let node = match graph.get_node_mut(node_id) {
            Some(n) => n,
            None => continue,
        };

        let target_role = infer_node_target_role(node);

        // Try to find a matching unused texture file
        let match_found = if let Some(role) = target_role {
            // First pass: exact role match
            scanned_files
                .iter()
                .find(|(path, meta)| !used_paths.contains(path) && meta.inferred_role == Some(role))
                .or_else(|| {
                    // Fallback cross-match: Roughness <-> Glossiness
                    if role == PbrRole::Roughness {
                        scanned_files.iter().find(|(path, meta)| {
                            !used_paths.contains(path) && meta.inferred_role == Some(PbrRole::Glossiness)
                        })
                    } else if role == PbrRole::Glossiness {
                        scanned_files.iter().find(|(path, meta)| {
                            !used_paths.contains(path) && meta.inferred_role == Some(PbrRole::Roughness)
                        })
                    } else {
                        None
                    }
                })
        } else {
            // Label substring match
            let lower_label = node.label.to_lowercase();
            scanned_files.iter().find(|(path, _)| {
                if used_paths.contains(path) {
                    return false;
                }
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                lower_label
                    .split_whitespace()
                    .any(|tok| tok.len() >= 3 && file_name.contains(tok))
            })
        };

        if let Some((path, meta)) = match_found {
            used_paths.insert(path.clone());
            let path_str = path.to_string_lossy().to_string();

            node.set_param("file_path", NodeParam::String(path_str.clone()));
            node.set_param("path", NodeParam::String(path_str));
            let colorspace = meta
                .inferred_role
                .map(|r| r.default_colorspace())
                .unwrap_or("sRGB");
            node.set_param(
                "colorspace",
                NodeParam::String(colorspace.to_string()),
            );

            bound.push((node.label.clone(), path.clone()));
        }
    }

    bound
}

/// Resolves an export preset by ID or name with graceful fallback to Unreal Engine 5.
pub fn resolve_export_preset(preset_name: &str) -> ExportPreset {
    ExportPreset::find_by_id(preset_name)
        .or_else(|| {
            ExportPreset::builtin_presets()
                .into_iter()
                .find(|p| p.name.eq_ignore_ascii_case(preset_name) || p.id.eq_ignore_ascii_case(preset_name))
        })
        .unwrap_or_else(|| ExportPreset::builtin_presets().remove(0))
}

/// Collects export tasks from evaluated output nodes in the graph.
pub fn collect_export_items(
    graph: &crate::graph::model::Graph,
    evaluator: &GraphEvaluator,
    preset: &ExportPreset,
    asset_name: &str,
    output_dir: &Path,
) -> Vec<ExportItem> {
    let mut items = Vec::new();

    // 1. Check for dedicated SaveImage / TextureOutput nodes
    let output_nodes: Vec<&Node> = graph
        .nodes
        .values()
        .filter(|n| n.node_type == "SaveImage" || n.node_type == "TextureOutput")
        .collect();

    for node in output_nodes {
        let slot = node.get_string("slot_name", "BaseColor");
        let fmt = node.get_string("format", &preset.default_format);
        let (w, h) = evaluator.resolve_node_dimensions(graph, node);

        let ctx = TokenContext::new(asset_name, &slot)
            .with_format(&fmt)
            .with_resolution(format!("{}x{}", w, h));
        let filename = preset.resolve_filename(&ctx);
        let target_path = output_dir.join(filename);

        let out_pin = PinId::output(node.id, "output");
        if let Some(buf) = evaluator.get_output(&out_pin) {
            items.push(ExportItem::new(buf.as_ref().clone(), target_path));
        }
    }

    // 2. If no output nodes were present, export evaluated leaf nodes
    if items.is_empty() {
        let nodes_with_outgoing: HashSet<NodeId> = graph.edges.iter().map(|e| e.from.node_id).collect();
        for node in graph.nodes.values() {
            if !nodes_with_outgoing.contains(&node.id)
                && node.node_type != "TextureInput"
                && node.node_type != "Comment"
            {
                let out_pin = PinId::output(node.id, "output");
                if let Some(buf) = evaluator.get_output(&out_pin) {
                    let slot = node.label.replace(' ', "_");
                    let ctx = TokenContext::new(asset_name, &slot).with_format(&preset.default_format);
                    let target_path = output_dir.join(preset.resolve_filename(&ctx));
                    items.push(ExportItem::new(buf.as_ref().clone(), target_path));
                }
            }
        }
    }

    items
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_job_creation() {
        let template = crate::templates::builtin_templates()[1]
            .load_project()
            .unwrap();

        let job = BatchJob::new("C:/Textures/Concrete", "C:/Exports/Concrete", template, "ue5");
        assert_eq!(job.status, BatchStatus::Pending);
        assert_eq!(job.folder_name(), "Concrete");
        assert_eq!(job.preset_name, "ue5");
    }

    #[test]
    fn test_batch_processor_queue_management() {
        let mut proc = BatchProcessor::new();
        assert_eq!(proc.jobs.len(), 0);
        assert_eq!(proc.progress_ratio(), 0.0);

        let template = crate::templates::builtin_templates()[1]
            .load_project()
            .unwrap();

        let job1 = BatchJob::new("C:/Set1", "C:/Out1", template.clone(), "ue5");
        let job2 = BatchJob::new("C:/Set2", "C:/Out2", template, "unity");

        proc.add_job(job1);
        proc.add_job(job2);
        assert_eq!(proc.jobs.len(), 2);
        assert_eq!(proc.progress().total, 2);
        assert_eq!(proc.progress().current, 0);

        proc.remove_job(0);
        assert_eq!(proc.jobs.len(), 1);
        assert_eq!(proc.jobs[0].folder_name(), "Set2");

        proc.clear_jobs();
        assert_eq!(proc.jobs.len(), 0);
    }

    #[test]
    fn test_batch_error_on_missing_dir() {
        let mut proc = BatchProcessor::new();
        let res = proc.add_folder("non_existent_folder_xyz_12345", None, None);
        assert!(res.is_err());
    }

    #[test]
    fn test_batch_process_two_sets_samples_1k() {
        let samples_dir = Path::new("samples/1k");
        assert!(
            samples_dir.exists(),
            "samples/1k must exist in repository root"
        );

        // Create temporary test environment with two distinct texture sets
        let test_base = std::env::temp_dir().join(format!("tlab_batch_test_{}", std::process::id()));
        let set_a_dir = test_base.join("concrete_smooth");
        let set_b_dir = test_base.join("anthracite_rough");
        let out_a_dir = test_base.join("out_a");
        let out_b_dir = test_base.join("out_b");

        fs::create_dir_all(&set_a_dir).unwrap();
        fs::create_dir_all(&set_b_dir).unwrap();

        // Copy sample maps into both directories
        for entry in fs::read_dir(samples_dir).unwrap().flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = path.file_name().unwrap();
                let _ = fs::copy(&path, set_a_dir.join(name));
                let _ = fs::copy(&path, set_b_dir.join(name));
            }
        }

        // Load Pack Texture template
        let template = crate::templates::builtin_templates()
            .into_iter()
            .find(|t| t.name == "Pack Texture")
            .expect("Pack Texture template must exist")
            .load_project()
            .expect("Template must load cleanly");

        let mut processor = BatchProcessor::new();
        let job_a = BatchJob::new(&set_a_dir, &out_a_dir, template.clone(), "ue5");
        let job_b = BatchJob::new(&set_b_dir, &out_b_dir, template, "ue5");

        processor.add_job(job_a);
        processor.add_job(job_b);

        assert_eq!(processor.jobs.len(), 2);
        assert_eq!(processor.progress().current, 0);

        // Process Set A
        let report_a = processor.process_next().expect("Set A must process successfully");
        assert!(report_a.is_success());
        assert!(!report_a.files_written.is_empty());
        for written in &report_a.files_written {
            assert!(written.exists(), "Written file {:?} must exist on disk", written);
            assert!(fs::metadata(written).unwrap().len() > 0, "Written file must not be empty");
        }
        assert!(processor.jobs[0].status.is_completed());
        assert_eq!(processor.progress().current, 1);

        // Process Set B
        let report_b = processor.process_next().expect("Set B must process successfully");
        assert!(report_b.is_success());
        assert!(!report_b.files_written.is_empty());
        for written in &report_b.files_written {
            assert!(written.exists(), "Written file {:?} must exist on disk", written);
            assert!(fs::metadata(written).unwrap().len() > 0, "Written file must not be empty");
        }
        assert!(processor.jobs[1].status.is_completed());
        assert_eq!(processor.progress().current, 2);

        // No more pending jobs
        let next_res = processor.process_next();
        assert!(matches!(next_res, Err(BatchError::NoPendingJobs)));

        // Clean up test directories
        let _ = fs::remove_dir_all(&test_base);
    }
}
