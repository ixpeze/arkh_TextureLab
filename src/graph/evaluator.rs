//! Reactive DAG Evaluation Engine with Dirty-Node Memoization (Phase 2).
//!
//! Provides memoized evaluation of `SharedTextureBuffer` instances per node pin,
//! reactive cache invalidation, and non-square working resolution propagation.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::compiler::{CompileError, GraphCompiler};
use crate::graph::model::{Graph, Node, NodeId, PinId};
use rayon::prelude::*;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Errors encountered during graph evaluation.
#[derive(Debug, Clone)]
pub enum EvaluationError {
    Compile(CompileError),
    NodeNotFound(NodeId),
    PinNotFound(PinId),
    Execution(String),
}

impl std::fmt::Display for EvaluationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EvaluationError::Compile(e) => write!(f, "Compilation failed: {}", e),
            EvaluationError::NodeNotFound(id) => write!(f, "Node {} not found during evaluation", id),
            EvaluationError::PinNotFound(pin) => write!(f, "Pin {:?} not found during evaluation", pin),
            EvaluationError::Execution(msg) => write!(f, "Node execution failed: {}", msg),
        }
    }
}

impl std::error::Error for EvaluationError {}

impl From<CompileError> for EvaluationError {
    fn from(e: CompileError) -> Self {
        EvaluationError::Compile(e)
    }
}

/// Abstract executor interface for node computation.
/// Allows Phase 3 PBR nodes to plug directly into the reactive engine.
pub trait NodeExecutor: Send + Sync {
    fn execute(
        &self,
        node: &Node,
        inputs: &HashMap<String, SharedTextureBuffer>,
        resolution: (u32, u32),
    ) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError>;

    fn set_input_texture(&mut self, _node_id: NodeId, _buffer: SharedTextureBuffer) {}
}

/// Built-in fallback executor handling baseline Phase 2 node primitives.
pub struct DefaultNodeExecutor {
    input_textures: HashMap<NodeId, SharedTextureBuffer>,
}

impl DefaultNodeExecutor {
    pub fn new() -> Self {
        Self {
            input_textures: HashMap::new(),
        }
    }

    pub fn set_input_texture(&mut self, node_id: NodeId, buffer: SharedTextureBuffer) {
        self.input_textures.insert(node_id, buffer);
    }
}

impl Default for DefaultNodeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for DefaultNodeExecutor {
    fn set_input_texture(&mut self, node_id: NodeId, buffer: SharedTextureBuffer) {
        self.input_textures.insert(node_id, buffer);
    }

    fn execute(
        &self,
        node: &Node,
        inputs: &HashMap<String, SharedTextureBuffer>,
        resolution: (u32, u32),
    ) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
        let (width, height) = resolution;
        let mut outputs = HashMap::new();

        match node.node_type.as_str() {
            "TextureInput" | "Input" => {
                // If a manual input texture was registered, provide it
                if let Some(buf) = self.input_textures.get(&node.id) {
                    outputs.insert("output".to_string(), Arc::clone(buf));
                    outputs.insert("RGBA".to_string(), Arc::clone(buf));
                } else {
                    // Otherwise generate from color parameter or default white
                    let color = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
                    let buf = TextureBuffer::solid_color(
                        width,
                        height,
                        (color[0] * 255.0).clamp(0.0, 255.0) as u8,
                        (color[1] * 255.0).clamp(0.0, 255.0) as u8,
                        (color[2] * 255.0).clamp(0.0, 255.0) as u8,
                        (color[3] * 255.0).clamp(0.0, 255.0) as u8,
                    );
                    let shared = Arc::new(buf);
                    outputs.insert("output".to_string(), Arc::clone(&shared));
                    outputs.insert("RGBA".to_string(), shared);
                }
            }
            "ConstantColor" | "Color" => {
                let color = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
                let buf = TextureBuffer::solid_color(
                    1,
                    1,
                    (color[0] * 255.0).clamp(0.0, 255.0) as u8,
                    (color[1] * 255.0).clamp(0.0, 255.0) as u8,
                    (color[2] * 255.0).clamp(0.0, 255.0) as u8,
                    (color[3] * 255.0).clamp(0.0, 255.0) as u8,
                );
                let shared = Arc::new(buf);
                outputs.insert("output".to_string(), Arc::clone(&shared));
                outputs.insert("RGBA".to_string(), shared);
            }
            "ConstantScalar" | "Scalar" => {
                let val = node.get_float("value", 1.0);
                let byte_val = (val * 255.0).clamp(0.0, 255.0) as u8;
                let buf = TextureBuffer::solid_color(1, 1, byte_val, byte_val, byte_val, byte_val);
                let shared = Arc::new(buf);
                outputs.insert("output".to_string(), Arc::clone(&shared));
                outputs.insert("value".to_string(), shared);
            }
            "Invert" => {
                // Invert RGB channels while preserving Alpha
                let input_buf = inputs
                    .get("input")
                    .or_else(|| inputs.get("in"))
                    .or_else(|| inputs.values().next());

                if let Some(src) = input_buf {
                    let mut inverted = TextureBuffer::new(src.width, src.height);
                    let src_slice = src.image.as_raw();
                    let dst_slice = inverted.image.as_mut();

                    dst_slice
                        .par_chunks_exact_mut(4)
                        .zip(src_slice.par_chunks_exact(4))
                        .for_each(|(dst_px, src_px)| {
                            dst_px[0] = 255 - src_px[0];
                            dst_px[1] = 255 - src_px[1];
                            dst_px[2] = 255 - src_px[2];
                            dst_px[3] = src_px[3];
                        });

                    let shared = Arc::new(inverted);
                    outputs.insert("output".to_string(), Arc::clone(&shared));
                    outputs.insert("out".to_string(), shared);
                } else {
                    let buf = Arc::new(TextureBuffer::new(width, height));
                    outputs.insert("output".to_string(), buf);
                }
            }
            "ChannelCombine" | "ChannelPack" => {
                let r_buf = inputs.get("R").or_else(|| inputs.get("r"));
                let g_buf = inputs.get("G").or_else(|| inputs.get("g"));
                let b_buf = inputs.get("B").or_else(|| inputs.get("b"));
                let a_buf = inputs.get("A").or_else(|| inputs.get("a"));

                let packed = TextureBuffer::pack_channels(
                    r_buf.map(|a| a.as_ref()),
                    g_buf.map(|a| a.as_ref()),
                    b_buf.map(|a| a.as_ref()),
                    a_buf.map(|a| a.as_ref()),
                    [0, 0, 0, 255],
                    width,
                    height,
                );
                let shared = Arc::new(packed);
                outputs.insert("output".to_string(), Arc::clone(&shared));
                outputs.insert("RGBA".to_string(), shared);
            }
            "ChannelSplit" | "ChannelUnpack" => {
                let src_buf = inputs
                    .get("input")
                    .or_else(|| inputs.get("RGBA"))
                    .or_else(|| inputs.values().next());

                if let Some(src) = src_buf {
                    let (r, g, b, a) = src.split_channels();
                    outputs.insert("R".to_string(), Arc::new(r));
                    outputs.insert("G".to_string(), Arc::new(g));
                    outputs.insert("B".to_string(), Arc::new(b));
                    outputs.insert("A".to_string(), Arc::new(a));
                }
            }
            "Comment" => {
                // Comment node is purely decorative; returns empty outputs
            }
            "Reroute" => {
                if let Some(buf) = inputs.get("input").or_else(|| inputs.values().next()) {
                    outputs.insert("output".to_string(), Arc::clone(buf));
                } else {
                    let buf = Arc::new(TextureBuffer::new(width, height));
                    outputs.insert("output".to_string(), buf);
                }
            }
            _ => {
                // Passthrough or generate blank fallback
                if let Some(first) = inputs.values().next() {
                    outputs.insert("output".to_string(), Arc::clone(first));
                } else {
                    let buf = Arc::new(TextureBuffer::new(width, height));
                    outputs.insert("output".to_string(), buf);
                }
            }
        }

        Ok(outputs)
    }
}

/// Evaluation run metrics.
#[derive(Clone, Debug)]
pub struct EvaluationReport {
    pub evaluated_nodes: Vec<NodeId>,
    pub duration: Duration,
    pub cache_hits: usize,
    pub cache_misses: usize,
}

/// Reactive Evaluation Engine maintaining socket memoization and dirty dependency tracking.
pub struct GraphEvaluator {
    /// Memoized socket outputs: PinId -> SharedTextureBuffer
    cache: HashMap<PinId, SharedTextureBuffer>,
    /// Nodes currently flagged as dirty
    dirty_nodes: HashSet<NodeId>,
    /// Global working canvas dimensions (e.g. 2048 x 2048)
    default_resolution: (u32, u32),
    /// Cumulative cache hits
    pub cache_hits: usize,
    /// Cumulative cache misses
    pub cache_misses: usize,
    /// Per-node execution counters for empirical test verification
    pub node_exec_counts: HashMap<NodeId, usize>,
    /// Active node computation executor
    executor: Box<dyn NodeExecutor>,
    /// Maximum cache memory budget in bytes (default 2 GB = 2_147_483_648).
    pub max_cache_bytes: usize,
    /// Current total memory usage in bytes of cached buffers.
    current_cache_bytes: usize,
    /// FIFO insertion order of cached pins for memory budget eviction.
    cache_order: VecDeque<PinId>,
}

impl Default for GraphEvaluator {
    fn default() -> Self {
        Self::new((2048, 2048))
    }
}

impl GraphEvaluator {
    /// Creates a new reactive evaluator with the specified default working resolution.
    pub fn new(default_resolution: (u32, u32)) -> Self {
        Self {
            cache: HashMap::new(),
            dirty_nodes: HashSet::new(),
            default_resolution,
            cache_hits: 0,
            cache_misses: 0,
            node_exec_counts: HashMap::new(),
            executor: Box::new(crate::nodes::PbrNodeExecutor::new()),
            max_cache_bytes: 2_147_483_648, // 2 GB default
            current_cache_bytes: 0,
            cache_order: VecDeque::new(),
        }
    }

    /// Sets a custom node executor (e.g. for Phase 3 PBR node catalog).
    pub fn set_executor(&mut self, executor: Box<dyn NodeExecutor>) {
        self.executor = executor;
        self.invalidate_all();
    }

    /// Registers a custom input texture for a node without wiping other registered textures.
    pub fn set_input_texture(&mut self, node_id: NodeId, buffer: SharedTextureBuffer) {
        self.executor.set_input_texture(node_id, Arc::clone(&buffer));
        self.dirty_nodes.insert(node_id);
    }

    /// Returns a reference to the default working resolution.
    pub fn default_resolution(&self) -> (u32, u32) {
        self.default_resolution
    }

    /// Sets default working resolution.
    pub fn set_default_resolution(&mut self, resolution: (u32, u32)) {
        self.default_resolution = resolution;
        self.invalidate_all();
    }

    /// Retrieves an evaluated output buffer from cache by PinId.
    pub fn get_output(&self, pin: &PinId) -> Option<SharedTextureBuffer> {
        self.cache.get(pin).cloned()
    }

    /// Returns an immutable reference to the memoized socket cache.
    pub fn cache(&self) -> &HashMap<PinId, SharedTextureBuffer> {
        &self.cache
    }

    /// Returns the current total cache memory usage in bytes.
    pub fn current_cache_bytes(&self) -> usize {
        self.current_cache_bytes
    }

    /// Sets the maximum cache budget in bytes and evicts oldest entries if over budget.
    pub fn set_max_cache_bytes(&mut self, max_bytes: usize) {
        self.max_cache_bytes = max_bytes;
        self.enforce_cache_budget();
    }

    /// Inserts a buffer into cache, tracking total bytes and enforcing budget eviction.
    pub fn insert_cache_entry(&mut self, pin: PinId, buf: SharedTextureBuffer) {
        let buf_len = buf.byte_len();
        if let Some(old) = self.cache.insert(pin.clone(), buf) {
            self.current_cache_bytes = self.current_cache_bytes.saturating_sub(old.byte_len());
        }
        self.current_cache_bytes += buf_len;
        self.cache_order.push_back(pin);
        self.enforce_cache_budget();
    }

    /// Evicts oldest cache entries (FIFO insertion order) until cache bytes <= max_cache_bytes.
    pub fn enforce_cache_budget(&mut self) {
        while self.current_cache_bytes > self.max_cache_bytes && !self.cache_order.is_empty() {
            if let Some(oldest_pin) = self.cache_order.pop_front() {
                if let Some(removed) = self.cache.remove(&oldest_pin) {
                    self.current_cache_bytes = self.current_cache_bytes.saturating_sub(removed.byte_len());
                }
            }
        }
    }

    /// Replaces the socket cache with an updated snapshot from background worker evaluation,
    /// and resets dirty node tracking while maintaining cache budget.
    pub fn apply_cache_update(&mut self, new_cache: HashMap<PinId, SharedTextureBuffer>) {
        self.cache = new_cache;
        self.cache_order.clear();
        self.current_cache_bytes = 0;
        for (pin, buf) in &self.cache {
            self.current_cache_bytes += buf.byte_len();
            self.cache_order.push_back(pin.clone());
        }
        self.dirty_nodes.clear();
        self.enforce_cache_budget();
    }

    /// Invalidates all cached evaluation outputs.
    pub fn invalidate_all(&mut self) {
        self.cache.clear();
        self.cache_order.clear();
        self.current_cache_bytes = 0;
        self.dirty_nodes.clear();
    }

    /// Marks a node and all of its downstream dependent nodes as dirty,
    /// removing their cached outputs.
    pub fn mark_dirty(&mut self, graph: &Graph, node_id: NodeId) {
        let downstream = GraphCompiler::downstream_nodes(graph, node_id);
        let mut affected = downstream;
        affected.insert(node_id);

        for id in affected {
            self.dirty_nodes.insert(id);
            self.cache.retain(|pin, buf| {
                if pin.node_id == id {
                    self.current_cache_bytes = self.current_cache_bytes.saturating_sub(buf.byte_len());
                    false
                } else {
                    true
                }
            });
        }
        self.cache_order.retain(|pin| self.cache.contains_key(pin));
    }

    /// Determines the working dimensions for a node.
    ///
    /// Resolution resolution precedence:
    /// 1. Node's explicit `resolution` or `width`/`height` parameters.
    /// 2. Dimensions inherited from connected upstream inputs (preserving non-square aspect ratios like 4096x2048, skipping 1x1 broadcast buffers).
    /// 3. Graph default working resolution.
    pub fn resolve_node_dimensions(&self, graph: &Graph, node: &Node) -> (u32, u32) {
        // 1. Explicit parameter
        if let Some(param) = node.get_param("resolution") {
            if let Some(res) = param.as_resolution() {
                if res.0 > 0 && res.1 > 0 {
                    return res;
                }
            }
        }
        if let (Some(w), Some(h)) = (node.get_param("width"), node.get_param("height")) {
            if let (Some(w_val), Some(h_val)) = (w.as_int(), h.as_int()) {
                if w_val > 0 && h_val > 0 {
                    return (w_val as u32, h_val as u32);
                }
            }
        }

        // 2. Propagate from connected upstream inputs (skipping 1x1 broadcast buffers)
        for edge in graph.edges_to(node.id) {
            if let Some(buf) = self.cache.get(&edge.from) {
                if !buf.is_broadcast() {
                    return (buf.width, buf.height);
                }
            }
        }

        // 3. Fallback to default
        self.default_resolution
    }

    /// Evaluates the entire graph reactively.
    /// Unchanged nodes with valid cached outputs are skipped in < 0.1 ms.
    pub fn evaluate(&mut self, graph: &Graph) -> Result<EvaluationReport, EvaluationError> {
        let sorted_order = GraphCompiler::compile(graph)?;
        let start_time = Instant::now();
        let mut evaluated_nodes = Vec::new();

        for node_id in sorted_order {
            let node = graph
                .get_node(node_id)
                .ok_or(EvaluationError::NodeNotFound(node_id))?;

            // Determine if node must be evaluated
            let has_all_cached_outputs = !node.outputs.is_empty()
                && node
                    .outputs
                    .iter()
                    .all(|out_pin| self.cache.contains_key(out_pin));

            let is_dirty = self.dirty_nodes.contains(&node_id);

            if !is_dirty && has_all_cached_outputs {
                self.cache_hits += 1;
                continue;
            }

            self.cache_misses += 1;
            *self.node_exec_counts.entry(node_id).or_insert(0) += 1;

            // Gather inputs from upstream pins (1x1 broadcast buffers are passed as-is without resizing)
            let mut inputs = HashMap::new();
            for edge in graph.edges_to(node_id) {
                if let Some(buf) = self.cache.get(&edge.from) {
                    inputs.insert(edge.to.name.clone(), Arc::clone(buf));
                }
            }

            let resolution = self.resolve_node_dimensions(graph, node);
            let outputs = self.executor.execute(node, &inputs, resolution)?;

            // Store outputs in cache
            for (pin_name, buf) in outputs {
                let pin_id = PinId::output(node_id, pin_name);
                self.insert_cache_entry(pin_id, buf);
            }

            self.dirty_nodes.remove(&node_id);
            evaluated_nodes.push(node_id);
        }

        let duration = start_time.elapsed();
        Ok(EvaluationReport {
            evaluated_nodes,
            duration,
            cache_hits: self.cache_hits,
            cache_misses: self.cache_misses,
        })
    }
}

/// Request sent to the background evaluation worker.
#[derive(Clone, Debug)]
pub struct AsyncEvalRequest {
    /// Monotonically increasing generation number for sequencing and natural debouncing.
    pub generation: u64,
    /// Cloned snapshot of the current DAG.
    pub graph: Graph,
    /// Specific nodes that were modified.
    pub dirty_nodes: Vec<NodeId>,
    /// Whether all cached outputs should be discarded before evaluation.
    pub invalidate_all: bool,
    /// Working resolution to evaluate at.
    pub resolution: (u32, u32),
}

/// Response returned from the background evaluation worker to the UI thread.
pub struct AsyncEvalResponse {
    /// Generation number corresponding to the completed evaluation.
    pub generation: u64,
    /// Evaluation report with metrics or compilation/execution error.
    pub report: Result<EvaluationReport, EvaluationError>,
    /// Memoized socket outputs (cheap Arc clones).
    pub cache_snapshot: HashMap<PinId, SharedTextureBuffer>,
    /// Total wall-clock time spent in milliseconds.
    pub eval_time_ms: f64,
}

/// Non-blocking background evaluation pipeline decoupling heavy Rayon computation
/// from the 60/144 FPS UI thread.
pub struct AsyncEvaluator {
    req_tx: Sender<AsyncEvalRequest>,
    resp_rx: Receiver<AsyncEvalResponse>,
    _worker: Option<JoinHandle<()>>,
    current_generation: u64,
    applied_generation: u64,
    is_evaluating: bool,
}

impl Default for AsyncEvaluator {
    fn default() -> Self {
        Self::new((1024, 1024))
    }
}

impl AsyncEvaluator {
    /// Spawns a dedicated background worker thread with its own memoized `GraphEvaluator`.
    pub fn new(default_resolution: (u32, u32)) -> Self {
        let (req_tx, req_rx) = mpsc::channel::<AsyncEvalRequest>();
        let (resp_tx, resp_rx) = mpsc::channel::<AsyncEvalResponse>();

        let worker = thread::Builder::new()
            .name("texturelab-eval-worker".to_string())
            .spawn(move || {
                let mut evaluator = GraphEvaluator::new(default_resolution);
                while let Ok(mut req) = req_rx.recv() {
                    // Natural debouncing: drain any newer requests that arrived while waiting/processing
                    while let Ok(newer) = req_rx.try_recv() {
                        req = newer;
                    }

                    if evaluator.default_resolution() != req.resolution {
                        evaluator.set_default_resolution(req.resolution);
                    }

                    if req.invalidate_all {
                        evaluator.invalidate_all();
                    } else {
                        for node_id in &req.dirty_nodes {
                            evaluator.mark_dirty(&req.graph, *node_id);
                        }
                    }

                    let start = Instant::now();
                    let res = evaluator.evaluate(&req.graph);
                    let eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;
                    let cache_snapshot = evaluator.cache.clone();

                    if resp_tx
                        .send(AsyncEvalResponse {
                            generation: req.generation,
                            report: res,
                            cache_snapshot,
                            eval_time_ms,
                        })
                        .is_err()
                    {
                        // Main thread has dropped receiver; shut down worker cleanly
                        break;
                    }
                }
            })
            .ok();

        Self {
            req_tx,
            resp_rx,
            _worker: worker,
            current_generation: 0,
            applied_generation: 0,
            is_evaluating: false,
        }
    }

    /// Submits a DAG evaluation request to the background worker.
    /// Returns the monotonic generation ID assigned to this request.
    pub fn request_evaluation(
        &mut self,
        graph: &Graph,
        dirty_nodes: Vec<NodeId>,
        invalidate_all: bool,
        resolution: (u32, u32),
    ) -> u64 {
        self.current_generation += 1;
        let generation = self.current_generation;
        let req = AsyncEvalRequest {
            generation,
            graph: graph.clone(),
            dirty_nodes,
            invalidate_all,
            resolution,
        };
        let _ = self.req_tx.send(req);
        self.is_evaluating = true;
        generation
    }

    /// Polls for completed evaluation responses from the background worker without blocking.
    /// If multiple responses are queued up, drains them and returns only the newest valid generation.
    pub fn try_recv(&mut self) -> Option<AsyncEvalResponse> {
        let mut latest = None;
        loop {
            match self.resp_rx.try_recv() {
                Ok(resp) => {
                    if resp.generation >= self.applied_generation {
                        self.applied_generation = resp.generation;
                        latest = Some(resp);
                    }
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => break,
            }
        }

        if self.applied_generation >= self.current_generation {
            self.is_evaluating = false;
        }

        latest
    }

    /// Blocks until the pending evaluation pass completes, up to a timeout.
    /// Used for deterministic test verification and export preflight guarantees.
    pub fn wait_for_completion(&mut self, timeout: Duration) -> Option<AsyncEvalResponse> {
        let deadline = Instant::now() + timeout;
        while self.is_evaluating && Instant::now() < deadline {
            if let Some(resp) = self.try_recv() {
                return Some(resp);
            }
            thread::sleep(Duration::from_millis(2));
        }
        self.try_recv()
    }

    /// Returns whether an evaluation request is currently in flight on the worker thread.
    pub fn is_evaluating(&self) -> bool {
        self.is_evaluating
    }

    /// Returns the most recently submitted generation ID.
    pub fn current_generation(&self) -> u64 {
        self.current_generation
    }

    /// Returns the most recently completed and applied generation ID.
    pub fn applied_generation(&self) -> u64 {
        self.applied_generation
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::graph::model::NodeParam;

    #[test]
    pub fn test_evaluator_basic_pipeline() {
        let mut graph = Graph::new();
        let mut n1 = Node::new(NodeId(1), "TextureInput", "Color", [0.0, 0.0]);
        n1.set_param("color", NodeParam::Color([1.0, 0.0, 0.0, 1.0])); // Pure Red
        let p1 = n1.add_output("output");
        graph.add_node(n1);

        let mut n2 = Node::new(NodeId(2), "Invert", "Invert", [200.0, 0.0]);
        let p2_in = n2.add_input("input");
        let p2_out = n2.add_output("output");
        graph.add_node(n2);

        graph.connect(p1, p2_in).unwrap();

        let mut evaluator = GraphEvaluator::new((64, 64));
        let report = evaluator.evaluate(&graph).expect("Evaluation failed");
        assert_eq!(report.evaluated_nodes.len(), 2);

        let out = evaluator.get_output(&p2_out).expect("Output missing");
        assert_eq!(out.width, 64);
        assert_eq!(out.height, 64);
        // Inverted red [255, 0, 0, 255] -> [0, 255, 255, 255] (Cyan)
        assert_eq!(out.get_pixel(0, 0), [0, 255, 255, 255]);
    }

    /// TC-204: Reactive Cache Invalidation
    /// Modifying node A re-evaluates B, but leaves independent C untouched.
    #[test]
    pub fn test_cache_invalidation() {
        let mut graph = Graph::new();

        // Node A -> Node B
        let mut a = Node::new(NodeId(1), "ConstantColor", "A", [0.0, 0.0]);
        a.set_param("color", NodeParam::Color([0.2, 0.2, 0.2, 1.0]));
        let a_out = a.add_output("output");
        graph.add_node(a);

        let mut b = Node::new(NodeId(2), "Invert", "B", [200.0, 0.0]);
        let b_in = b.add_input("input");
        let _b_out = b.add_output("output");
        graph.add_node(b);
        graph.connect(a_out, b_in).unwrap();

        // Independent Node C
        let mut c = Node::new(NodeId(3), "ConstantColor", "C", [0.0, 200.0]);
        c.set_param("color", NodeParam::Color([0.5, 0.5, 0.5, 1.0]));
        let _c_out = c.add_output("output");
        graph.add_node(c);

        let mut evaluator = GraphEvaluator::new((32, 32));

        // Initial evaluation (misses: 3)
        let r1 = evaluator.evaluate(&graph).unwrap();
        assert_eq!(r1.evaluated_nodes.len(), 3);
        assert_eq!(evaluator.node_exec_counts[&NodeId(1)], 1);
        assert_eq!(evaluator.node_exec_counts[&NodeId(2)], 1);
        assert_eq!(evaluator.node_exec_counts[&NodeId(3)], 1);

        // Second evaluation without changes (100% cache hits)
        let r2 = evaluator.evaluate(&graph).unwrap();
        assert_eq!(r2.evaluated_nodes.len(), 0);
        assert_eq!(evaluator.node_exec_counts[&NodeId(1)], 1);
        assert_eq!(evaluator.node_exec_counts[&NodeId(2)], 1);
        assert_eq!(evaluator.node_exec_counts[&NodeId(3)], 1);

        // Modify Node A: mark A dirty
        evaluator.mark_dirty(&graph, NodeId(1));

        // Third evaluation: A and B must re-evaluate; C must be untouched!
        let r3 = evaluator.evaluate(&graph).unwrap();
        assert_eq!(r3.evaluated_nodes, vec![NodeId(1), NodeId(2)]);
        assert_eq!(evaluator.node_exec_counts[&NodeId(1)], 2);
        assert_eq!(evaluator.node_exec_counts[&NodeId(2)], 2);
        // Independent Node C remained untouched
        assert_eq!(evaluator.node_exec_counts[&NodeId(3)], 1);
    }

    /// P2-T4: Non-square working dimensions propagation (e.g. 4096x2048)
    #[test]
    pub fn test_resolution_aspect_propagation() {
        let mut graph = Graph::new();

        // Node 1: explicit non-square 4096x2048 resolution
        let mut n1 = Node::new(NodeId(1), "TextureInput", "NonSquare", [0.0, 0.0]);
        n1.set_param("resolution", NodeParam::Resolution { width: 4096, height: 2048 });
        let p1_out = n1.add_output("output");
        graph.add_node(n1);

        // Node 2: has no explicit resolution, connected to Node 1
        let mut n2 = Node::new(NodeId(2), "Invert", "InheritRes", [200.0, 0.0]);
        let p2_in = n2.add_input("input");
        let p2_out = n2.add_output("output");
        graph.add_node(n2);
        graph.connect(p1_out, p2_in).unwrap();

        let mut evaluator = GraphEvaluator::new((1024, 1024)); // Default is 1024x1024
        evaluator.evaluate(&graph).unwrap();

        let out2 = evaluator.get_output(&p2_out).unwrap();
        // Downstream node must inherit 4096x2048 aspect ratio without squashing!
        assert_eq!(out2.width, 4096);
        assert_eq!(out2.height, 2048);
    }

    /// Re-evaluating unchanged nodes must execute in < 0.1 ms (cache hit)
    #[test]
    pub fn test_cache_hit_performance() {
        let mut graph = Graph::new();
        let mut n = Node::new(NodeId(1), "ConstantColor", "C", [0.0, 0.0]);
        n.add_output("output");
        graph.add_node(n);

        let mut evaluator = GraphEvaluator::new((128, 128));
        evaluator.evaluate(&graph).unwrap();

        // Clean re-eval
        let start = Instant::now();
        let report = evaluator.evaluate(&graph).unwrap();
        let elapsed = start.elapsed();

        assert_eq!(report.evaluated_nodes.len(), 0);
        println!("Clean re-eval cache hit elapsed: {:?}", elapsed);
        assert!(
            elapsed.as_micros() < 500, // < 0.5ms in debug, typically < 0.05ms in release
            "Cache hit must be ultra-fast, took {:?}",
            elapsed
        );
    }

    #[test]
    pub fn test_multiple_input_textures_retained() {
        let mut graph = Graph::new();
        let mut n1 = Node::new(NodeId(1), "TextureInput", "Input A", [0.0, 0.0]);
        let p1_out = n1.add_output("output");
        graph.add_node(n1);

        let mut n2 = Node::new(NodeId(2), "TextureInput", "Input B", [200.0, 0.0]);
        let p2_out = n2.add_output("output");
        graph.add_node(n2);

        let mut evaluator = GraphEvaluator::new((8, 8));
        let buf_red = Arc::new(TextureBuffer::solid_color(8, 8, 255, 0, 0, 255));
        let buf_green = Arc::new(TextureBuffer::solid_color(8, 8, 0, 255, 0, 255));

        evaluator.set_input_texture(NodeId(1), buf_red);
        evaluator.set_input_texture(NodeId(2), buf_green);

        evaluator.evaluate(&graph).expect("Evaluation failed");

        let out_a = evaluator.get_output(&p1_out).expect("Output A missing");
        let out_b = evaluator.get_output(&p2_out).expect("Output B missing");

        assert_eq!(out_a.get_pixel(0, 0), [255, 0, 0, 255]);
        assert_eq!(out_b.get_pixel(0, 0), [0, 255, 0, 255]);
    }

    #[test]
    pub fn test_async_evaluator_execution_and_cache() {
        let mut graph = Graph::new();
        let mut n1 = Node::new(NodeId(1), "TextureInput", "Color", [0.0, 0.0]);
        n1.set_param("color", NodeParam::Color([1.0, 0.0, 0.0, 1.0])); // Pure Red
        let p1 = n1.add_output("output");
        graph.add_node(n1);

        let mut n2 = Node::new(NodeId(2), "Invert", "Invert", [200.0, 0.0]);
        let p2_in = n2.add_input("input");
        let p2_out = n2.add_output("output");
        graph.add_node(n2);

        graph.connect(p1, p2_in).unwrap();

        let mut async_eval = AsyncEvaluator::new((16, 16));
        let gen = async_eval.request_evaluation(&graph, vec![NodeId(1), NodeId(2)], false, (16, 16));
        assert_eq!(gen, 1);
        assert!(async_eval.is_evaluating());

        let resp = async_eval
            .wait_for_completion(Duration::from_secs(3))
            .expect("Async evaluation must complete within 3 seconds");

        assert_eq!(resp.generation, 1);
        assert!(!async_eval.is_evaluating());

        let out = resp.cache_snapshot.get(&p2_out).expect("Output missing in snapshot");
        assert_eq!(out.width, 16);
        assert_eq!(out.height, 16);
        assert_eq!(out.get_pixel(0, 0), [0, 255, 255, 255]); // Cyan
    }

    #[test]
    pub fn test_async_evaluator_generation_debouncing() {
        let mut graph = Graph::new();
        let mut n1 = Node::new(NodeId(1), "TextureInput", "Color", [0.0, 0.0]);
        n1.set_param("color", NodeParam::Color([0.0, 1.0, 0.0, 1.0])); // Green
        let p1 = n1.add_output("output");
        graph.add_node(n1);

        let mut async_eval = AsyncEvaluator::new((16, 16));

        // Submit generation 1
        let g1 = async_eval.request_evaluation(&graph, vec![NodeId(1)], false, (16, 16));
        assert_eq!(g1, 1);

        // Rapidly change color to Blue and submit generation 2
        if let Some(n) = graph.get_node_mut(NodeId(1)) {
            n.set_param("color", NodeParam::Color([0.0, 0.0, 1.0, 1.0]));
        }
        let g2 = async_eval.request_evaluation(&graph, vec![NodeId(1)], false, (16, 16));
        assert_eq!(g2, 2);

        // Wait for final completion
        let resp = async_eval
            .wait_for_completion(Duration::from_secs(3))
            .expect("Async evaluation must complete");

        // Debouncing / monotonic ordering ensures newest applied generation is g2
        assert_eq!(async_eval.applied_generation(), 2);
        assert!(!async_eval.is_evaluating());

        let out = resp.cache_snapshot.get(&p1).expect("Output missing in snapshot");
        assert_eq!(out.get_pixel(0, 0), [0, 0, 255, 255]); // Blue
    }

    /// Verifies 1x1 broadcast buffer sampling operates seamlessly with a 4K texture buffer in Math nodes.
    #[test]
    pub fn test_broadcast_sampling_works_at_4k() {
        let mut graph = Graph::new();

        // 4K Texture Input (all 200)
        let mut n1 = Node::new(NodeId(1), "TextureInput", "Base4K", [0.0, 0.0]);
        n1.set_param("resolution", NodeParam::Resolution { width: 4096, height: 4096 });
        n1.set_param("color", NodeParam::Color([200.0 / 255.0, 200.0 / 255.0, 200.0 / 255.0, 1.0]));
        let p1 = n1.add_output("output");
        graph.add_node(n1);

        // 1x1 Constant Scalar (0.5)
        let mut n2 = Node::new(NodeId(2), "ConstantScalar", "Factor", [0.0, 100.0]);
        n2.set_param("value", NodeParam::Float(0.5));
        let p2 = n2.add_output("output");
        graph.add_node(n2);

        // Math: Multiply 4K by 0.5 broadcast scalar
        let mut n3 = Node::new(NodeId(3), "Math", "Mult", [200.0, 50.0]);
        n3.set_param("operation", NodeParam::String("Multiply".to_string()));
        let p3_a = n3.add_input("A");
        let p3_b = n3.add_input("B");
        let p3_out = n3.add_output("output");
        graph.add_node(n3);

        graph.connect(p1, p3_a).unwrap();
        graph.connect(p2, p3_b).unwrap();

        let mut evaluator = GraphEvaluator::new((1024, 1024));
        let start = Instant::now();
        evaluator.evaluate(&graph).expect("4K broadcast evaluation failed");
        let elapsed = start.elapsed();
        println!("4K Broadcast evaluation elapsed: {:?}", elapsed);

        let out = evaluator.get_output(&p3_out).expect("Output missing");
        assert_eq!(out.width, 4096);
        assert_eq!(out.height, 4096);
        let px_corner = out.get_pixel(0, 0);
        let px_center = out.get_pixel(2048, 2048);
        assert!((px_corner[0] as i32 - 100).abs() <= 2);
        assert_eq!(px_corner, px_center);
    }

    /// Verifies cache memory budget enforcement evicts oldest entries (FIFO).
    #[test]
    pub fn test_cache_eviction_triggers_at_low_budget() {
        let mut graph = Graph::new();

        // Node 1: 64x64 buffer (64*64*4 = 16,384 bytes)
        let mut n1 = Node::new(NodeId(1), "TextureInput", "N1", [0.0, 0.0]);
        n1.set_param("resolution", NodeParam::Resolution { width: 64, height: 64 });
        let p1 = n1.add_output("output");
        graph.add_node(n1);

        // Node 2: 64x64 buffer (16,384 bytes)
        let mut n2 = Node::new(NodeId(2), "TextureInput", "N2", [0.0, 100.0]);
        n2.set_param("resolution", NodeParam::Resolution { width: 64, height: 64 });
        let _p2 = n2.add_output("output");
        graph.add_node(n2);

        // Node 3: 64x64 buffer (16,384 bytes)
        let mut n3 = Node::new(NodeId(3), "TextureInput", "N3", [0.0, 200.0]);
        n3.set_param("resolution", NodeParam::Resolution { width: 64, height: 64 });
        let p3 = n3.add_output("output");
        graph.add_node(n3);

        let mut evaluator = GraphEvaluator::new((64, 64));
        // Budget allows 1 node's outputs (~32,768 bytes), evicting earlier nodes (40,000 bytes < 65,536 bytes)
        evaluator.set_max_cache_bytes(40_000);

        evaluator.evaluate(&graph).expect("Evaluation failed");

        assert!(
            evaluator.current_cache_bytes() <= 40_000,
            "Cache bytes {} must not exceed max budget 40,000",
            evaluator.current_cache_bytes()
        );

        // Oldest inserted entry (Node 1) should have been evicted to respect the budget
        assert!(evaluator.get_output(&p1).is_none(), "Oldest entry should be evicted");
        // Newest entry (Node 3) must be present in cache
        assert!(evaluator.get_output(&p3).is_some(), "Newest entry must remain in cache");
    }
}
