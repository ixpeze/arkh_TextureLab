//! Directed Acyclic Graph (DAG) Data Model & Serialization.
//!
//! Provides the primary primitives for nodes, pins, edges, graphs,
//! and `.tlab` project file serialization (Phase 2).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

/// Unique identifier for a node within a graph.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct NodeId(pub u64);

impl From<u64> for NodeId {
    fn from(id: u64) -> Self {
        NodeId(id)
    }
}

impl std::fmt::Display for NodeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Node#{}", self.0)
    }
}

/// Identifies an input or output pin on a specific node.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PinId {
    pub node_id: NodeId,
    pub name: String,
    pub is_input: bool,
}

impl PinId {
    /// Creates an input pin identifier.
    pub fn input(node_id: NodeId, name: impl Into<String>) -> Self {
        Self {
            node_id,
            name: name.into(),
            is_input: true,
        }
    }

    /// Creates an output pin identifier.
    pub fn output(node_id: NodeId, name: impl Into<String>) -> Self {
        Self {
            node_id,
            name: name.into(),
            is_input: false,
        }
    }
}

/// Data type associated with a pin socket.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PinType {
    Scalar,
    ColorRgba,
    Texture,
    Any,
}

/// Rich metadata for a node socket pin.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Pin {
    pub id: PinId,
    pub label: String,
    pub pin_type: PinType,
}

/// Directed edge connecting an upstream output pin to a downstream input pin.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Edge {
    pub from: PinId,
    pub to: PinId,
}

impl Edge {
    /// Creates a new directed edge from an output pin to an input pin.
    pub fn new(from: PinId, to: PinId) -> Self {
        Self { from, to }
    }
}

/// Supported parameter value types stored on nodes.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum NodeParam {
    Float(f32),
    Int(i64),
    Bool(bool),
    Color([f32; 4]),
    String(String),
    Vec2([f32; 2]),
    Vec3([f32; 3]),
    Resolution { width: u32, height: u32 },
}

impl NodeParam {
    pub fn as_float(&self) -> Option<f32> {
        match self {
            NodeParam::Float(v) => Some(*v),
            NodeParam::Int(v) => Some(*v as f32),
            _ => None,
        }
    }

    pub fn as_int(&self) -> Option<i64> {
        match self {
            NodeParam::Int(v) => Some(*v),
            NodeParam::Float(v) => Some(*v as i64),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            NodeParam::Bool(v) => Some(*v),
            _ => None,
        }
    }

    pub fn as_color(&self) -> Option<[f32; 4]> {
        match self {
            NodeParam::Color(c) => Some(*c),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            NodeParam::String(s) => Some(s.as_str()),
            _ => None,
        }
    }

    pub fn as_resolution(&self) -> Option<(u32, u32)> {
        match self {
            NodeParam::Resolution { width, height } => Some((*width, *height)),
            NodeParam::Vec2(v) => Some((v[0] as u32, v[1] as u32)),
            _ => None,
        }
    }
}

/// A node in the texture processing graph.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Node {
    pub id: NodeId,
    pub node_type: String,
    pub label: String,
    pub position: [f32; 2],
    #[serde(default)]
    pub inputs: Vec<PinId>,
    #[serde(default)]
    pub outputs: Vec<PinId>,
    #[serde(default)]
    pub params: HashMap<String, NodeParam>,
}

impl Node {
    /// Creates a new node with the specified ID, type, label, and canvas position.
    pub fn new(
        id: NodeId,
        node_type: impl Into<String>,
        label: impl Into<String>,
        position: [f32; 2],
    ) -> Self {
        Self {
            id,
            node_type: node_type.into(),
            label: label.into(),
            position,
            inputs: Vec::new(),
            outputs: Vec::new(),
            params: HashMap::new(),
        }
    }

    /// Adds an input pin to the node and returns its PinId.
    pub fn add_input(&mut self, name: impl Into<String>) -> PinId {
        let pin = PinId::input(self.id, name);
        if !self.inputs.contains(&pin) {
            self.inputs.push(pin.clone());
        }
        pin
    }

    /// Adds an output pin to the node and returns its PinId.
    pub fn add_output(&mut self, name: impl Into<String>) -> PinId {
        let pin = PinId::output(self.id, name);
        if !self.outputs.contains(&pin) {
            self.outputs.push(pin.clone());
        }
        pin
    }

    /// Sets a parameter on the node.
    pub fn set_param(&mut self, name: impl Into<String>, value: NodeParam) {
        self.params.insert(name.into(), value);
    }

    /// Retrieves a parameter by name.
    pub fn get_param(&self, name: &str) -> Option<&NodeParam> {
        self.params.get(name)
    }

    /// Retrieves a float parameter or returns the provided default.
    pub fn get_float(&self, name: &str, default: f32) -> f32 {
        self.params
            .get(name)
            .and_then(|p| p.as_float())
            .unwrap_or(default)
    }

    /// Retrieves a color parameter or returns the provided default.
    pub fn get_color(&self, name: &str, default: [f32; 4]) -> [f32; 4] {
        self.params
            .get(name)
            .and_then(|p| p.as_color())
            .unwrap_or(default)
    }

    /// Retrieves a string parameter or returns the provided default.
    pub fn get_string(&self, name: &str, default: &str) -> String {
        self.params
            .get(name)
            .and_then(|p| p.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| default.to_string())
    }

    /// Retrieves a bool parameter or returns the provided default.
    pub fn get_bool(&self, name: &str, default: bool) -> bool {
        self.params
            .get(name)
            .and_then(|p| p.as_bool())
            .unwrap_or(default)
    }
}

/// Graph manipulation errors.
#[derive(Debug)]
pub enum GraphError {
    NodeNotFound(NodeId),
    PinNotFound(PinId),
    InvalidPinDirection { is_input: bool },
    SelfConnection(NodeId),
    CycleDetected,
    Serialization(serde_json::Error),
    Io(std::io::Error),
}

impl std::fmt::Display for GraphError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GraphError::NodeNotFound(id) => write!(f, "Node {} not found in graph", id),
            GraphError::PinNotFound(pin) => write!(f, "Pin {:?} not found on node", pin),
            GraphError::InvalidPinDirection { is_input } => {
                write!(f, "Invalid pin direction (is_input: {})", is_input)
            }
            GraphError::SelfConnection(id) => {
                write!(f, "Cannot connect node {} to itself", id)
            }
            GraphError::CycleDetected => write!(f, "Cycle detected in directed graph"),
            GraphError::Serialization(e) => write!(f, "Serialization error: {}", e),
            GraphError::Io(e) => write!(f, "I/O error: {}", e),
        }
    }
}

impl std::error::Error for GraphError {}

impl From<serde_json::Error> for GraphError {
    fn from(err: serde_json::Error) -> Self {
        GraphError::Serialization(err)
    }
}

impl From<std::io::Error> for GraphError {
    fn from(err: std::io::Error) -> Self {
        GraphError::Io(err)
    }
}

/// The complete directed graph consisting of nodes and connecting edges.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Graph {
    pub nodes: HashMap<NodeId, Node>,
    pub edges: Vec<Edge>,
    #[serde(default = "default_next_node_id")]
    pub next_node_id: u64,
}

fn default_next_node_id() -> u64 {
    1
}

impl Graph {
    /// Creates a new empty graph.
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: Vec::new(),
            next_node_id: 1,
        }
    }

    /// Adds an existing node to the graph and updates `next_node_id`.
    pub fn add_node(&mut self, node: Node) -> NodeId {
        let id = node.id;
        if id.0 >= self.next_node_id {
            self.next_node_id = id.0 + 1;
        }
        self.nodes.insert(id, node);
        id
    }

    /// Spawns and registers a new node with an auto-incremented ID.
    pub fn create_node(
        &mut self,
        node_type: impl Into<String>,
        label: impl Into<String>,
        position: [f32; 2],
    ) -> NodeId {
        let id = NodeId(self.next_node_id);
        self.next_node_id += 1;
        let node = Node::new(id, node_type, label, position);
        self.nodes.insert(id, node);
        id
    }

    /// Removes a node from the graph and removes all associated edges.
    pub fn remove_node(&mut self, id: NodeId) -> Option<Node> {
        let removed = self.nodes.remove(&id);
        if removed.is_some() {
            self.edges
                .retain(|edge| edge.from.node_id != id && edge.to.node_id != id);
        }
        removed
    }

    /// Retrieves an immutable reference to a node.
    pub fn get_node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    /// Retrieves a mutable reference to a node.
    pub fn get_node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(&id)
    }

    /// Returns true if the graph contains a node with the given ID.
    pub fn contains_node(&self, id: NodeId) -> bool {
        self.nodes.contains_key(&id)
    }

    /// Connects an output pin to an input pin, replacing any existing incoming edge on that input pin.
    pub fn connect(&mut self, from: PinId, to: PinId) -> Result<(), GraphError> {
        if from.node_id == to.node_id {
            return Err(GraphError::SelfConnection(from.node_id));
        }
        if !self.nodes.contains_key(&from.node_id) {
            return Err(GraphError::NodeNotFound(from.node_id));
        }
        if !self.nodes.contains_key(&to.node_id) {
            return Err(GraphError::NodeNotFound(to.node_id));
        }
        if from.is_input {
            return Err(GraphError::InvalidPinDirection { is_input: true });
        }
        if !to.is_input {
            return Err(GraphError::InvalidPinDirection { is_input: false });
        }

        // In DCC graph workflows, input sockets accept only a single incoming connection.
        // Temporarily extract existing incoming edge on `to` to test cycle safety.
        let prev_edge_idx = self.edges.iter().position(|e| e.to == to);
        let prev_edge = prev_edge_idx.map(|idx| self.edges.remove(idx));

        if crate::graph::compiler::GraphCompiler::would_create_cycle(self, from.node_id, to.node_id) {
            // Restore previous edge if cycle was detected
            if let Some(edge) = prev_edge {
                self.edges.push(edge);
            }
            return Err(GraphError::CycleDetected);
        }

        self.edges.push(Edge::new(from, to));
        Ok(())
    }

    /// Disconnects a specific edge between two pins.
    pub fn disconnect(&mut self, from: &PinId, to: &PinId) -> bool {
        let initial_len = self.edges.len();
        self.edges.retain(|e| !(e.from == *from && e.to == *to));
        self.edges.len() < initial_len
    }

    /// Disconnects all edges touching a specific pin.
    pub fn disconnect_pin(&mut self, pin: &PinId) -> usize {
        let initial_len = self.edges.len();
        self.edges.retain(|e| e.from != *pin && e.to != *pin);
        initial_len - self.edges.len()
    }

    /// Returns all edges originating from a node.
    pub fn edges_from(&self, node_id: NodeId) -> Vec<&Edge> {
        self.edges
            .iter()
            .filter(|e| e.from.node_id == node_id)
            .collect()
    }

    /// Returns all edges terminating at a node.
    pub fn edges_to(&self, node_id: NodeId) -> Vec<&Edge> {
        self.edges
            .iter()
            .filter(|e| e.to.node_id == node_id)
            .collect()
    }

    /// Returns the incoming edge terminating at the given input pin.
    pub fn incoming_edge(&self, pin: &PinId) -> Option<&Edge> {
        self.edges.iter().find(|e| e.to == *pin)
    }

    /// Returns all outgoing edges originating from the given output pin.
    pub fn outgoing_edges(&self, pin: &PinId) -> Vec<&Edge> {
        self.edges.iter().filter(|e| e.from == *pin).collect()
    }

    /// Deep-clones the specified nodes and collects all edges where both endpoints are in the set.
    pub fn clone_subgraph(&self, node_ids: &[NodeId]) -> (Vec<Node>, Vec<Edge>) {
        let mut id_set = std::collections::HashSet::new();
        let mut cloned_nodes = Vec::new();

        for &id in node_ids {
            if id_set.insert(id) {
                if let Some(node) = self.get_node(id) {
                    cloned_nodes.push(node.clone());
                }
            }
        }

        let cloned_edges = self
            .edges
            .iter()
            .filter(|e| id_set.contains(&e.from.node_id) && id_set.contains(&e.to.node_id))
            .cloned()
            .collect();

        (cloned_nodes, cloned_edges)
    }

    /// Inserts a cloned subgraph with fresh Node IDs, remapped pins, and an applied position offset.
    pub fn paste_subgraph(
        &mut self,
        nodes: Vec<Node>,
        edges: Vec<Edge>,
        offset: [f32; 2],
    ) -> Vec<NodeId> {
        let mut id_map = HashMap::new();
        let mut new_node_ids = Vec::with_capacity(nodes.len());

        for node in &nodes {
            if !id_map.contains_key(&node.id) {
                let old_id = node.id;
                let new_id = NodeId(self.next_node_id);
                self.next_node_id += 1;
                id_map.insert(old_id, new_id);
                new_node_ids.push(new_id);
            }
        }

        for mut node in nodes {
            if let Some(&new_id) = id_map.get(&node.id) {
                node.id = new_id;
                node.position[0] += offset[0];
                node.position[1] += offset[1];
                for pin in &mut node.inputs {
                    pin.node_id = new_id;
                }
                for pin in &mut node.outputs {
                    pin.node_id = new_id;
                }
                self.nodes.insert(new_id, node);
            }
        }

        for mut edge in edges {
            if let (Some(&new_from), Some(&new_to)) = (
                id_map.get(&edge.from.node_id),
                id_map.get(&edge.to.node_id),
            ) {
                edge.from.node_id = new_from;
                edge.to.node_id = new_to;
                self.edges.push(edge);
            }
        }

        new_node_ids
    }

    /// Serializes the graph to a JSON string.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Deserializes a graph from a JSON string.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// Project-level metadata stored in `.tlab` files.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub name: String,
    #[serde(default)]
    pub author: String,
    #[serde(default = "default_timestamp")]
    pub created_at: String,
    #[serde(default = "default_timestamp")]
    pub modified_at: String,
    #[serde(default = "default_working_resolution")]
    pub working_resolution: (u32, u32),
}

impl Default for ProjectMetadata {
    fn default() -> Self {
        Self {
            name: "TextureLab Project".to_string(),
            author: "User".to_string(),
            created_at: default_timestamp(),
            modified_at: default_timestamp(),
            working_resolution: default_working_resolution(),
        }
    }
}

pub fn default_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}


fn default_working_resolution() -> (u32, u32) {
    (2048, 2048)
}

fn default_format_version() -> u32 {
    1
}

fn default_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Complete `.tlab` project file container.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProjectFile {
    #[serde(default = "default_format_version")]
    pub format_version: u32,
    #[serde(default = "default_app_version")]
    pub app_version: String,
    pub metadata: ProjectMetadata,
    pub graph: Graph,
}

#[derive(Debug)]
pub enum ProjectError {
    Serialization(serde_json::Error),
    Io(std::io::Error),
}

impl std::fmt::Display for ProjectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProjectError::Serialization(e) => write!(f, "Project JSON error: {}", e),
            ProjectError::Io(e) => write!(f, "Project I/O error: {}", e),
        }
    }
}

impl std::error::Error for ProjectError {}

impl From<serde_json::Error> for ProjectError {
    fn from(e: serde_json::Error) -> Self {
        ProjectError::Serialization(e)
    }
}

impl From<std::io::Error> for ProjectError {
    fn from(e: std::io::Error) -> Self {
        ProjectError::Io(e)
    }
}

impl ProjectFile {
    /// Creates a new ProjectFile from a graph and a project name.
    pub fn new(graph: Graph, name: impl Into<String>) -> Self {
        Self {
            format_version: default_format_version(),
            app_version: default_app_version(),
            metadata: ProjectMetadata {
                name: name.into(),
                author: "User".to_string(),
                created_at: default_timestamp(),
                modified_at: default_timestamp(),
                working_resolution: default_working_resolution(),
            },
            graph,
        }
    }

    /// Creates a ProjectFile preserving existing project metadata and refreshing modified_at.
    pub fn with_metadata(graph: Graph, mut metadata: ProjectMetadata) -> Self {
        metadata.modified_at = default_timestamp();
        Self {
            format_version: default_format_version(),
            app_version: default_app_version(),
            metadata,
            graph,
        }
    }


    /// Serializes the project to formatted JSON string.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Deserializes a project from JSON string with backwards compatibility.
    /// Supports parsing full ProjectFile or raw Graph JSON.
    pub fn from_json(json: &str) -> Result<Self, ProjectError> {
        if let Ok(project) = serde_json::from_str::<ProjectFile>(json) {
            return Ok(project);
        }
        // Fallback backward compatibility: raw Graph
        if let Ok(graph) = serde_json::from_str::<Graph>(json) {
            return Ok(ProjectFile::new(graph, "Imported Graph"));
        }
        let err = serde_json::from_str::<ProjectFile>(json).unwrap_err();
        Err(ProjectError::Serialization(err))
    }

    /// Saves project atomically to disk (.tlab or .json).
    pub fn save_to_file(&self, path: impl AsRef<Path>) -> Result<(), ProjectError> {
        let path = path.as_ref();
        let json = self.to_json()?;
        
        // Write to temporary file first for atomic durability
        let temp_path = path.with_extension("tmp");
        {
            let mut file = File::create(&temp_path)?;
            file.write_all(json.as_bytes())?;
            file.sync_all()?;
        }
        std::fs::rename(&temp_path, path)?;
        Ok(())
    }

    /// Loads project from disk.
    pub fn load_from_file(path: impl AsRef<Path>) -> Result<Self, ProjectError> {
        let mut file = File::open(path.as_ref())?;
        let mut content = String::new();
        file.read_to_string(&mut content)?;
        Self::from_json(&content)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_graph_serialization() {
        let mut graph = Graph::new();
        let n1 = graph.create_node("TextureInput", "Albedo Map", [100.0, 200.0]);
        let n2 = graph.create_node("Invert", "Invert Color", [350.0, 200.0]);

        let p1 = PinId::output(n1, "output");
        let p2 = PinId::input(n2, "input");
        graph.connect(p1, p2).expect("Failed to connect pins");

        let json = graph.to_json().expect("Serialization failed");
        let deserialized = Graph::from_json(&json).expect("Deserialization failed");

        assert_eq!(graph.nodes.len(), deserialized.nodes.len());
        assert_eq!(graph.edges.len(), deserialized.edges.len());
        assert_eq!(graph.edges[0], deserialized.edges[0]);
    }

    #[test]
    pub fn test_graph_serialization_roundtrip() {
        let mut graph = Graph::new();
        let mut node = Node::new(NodeId(1), "ConstantColor", "Color Source", [50.0, 75.0]);
        node.set_param("color", NodeParam::Color([1.0, 0.5, 0.25, 1.0]));
        node.set_param("resolution", NodeParam::Resolution { width: 4096, height: 2048 });
        let pin_out = node.add_output("RGBA");
        graph.add_node(node);

        let mut node2 = Node::new(NodeId(2), "TextureOutput", "Output Target", [400.0, 75.0]);
        let pin_in = node2.add_input("RGBA");
        graph.add_node(node2);

        graph.connect(pin_out, pin_in).expect("Connect failed");

        let project = ProjectFile::new(graph, "Test PBR Project");
        let json = project.to_json().expect("Serialize project failed");

        let restored = ProjectFile::from_json(&json).expect("Deserialize project failed");
        assert_eq!(restored.format_version, 1);
        assert_eq!(restored.metadata.name, "Test PBR Project");
        assert_eq!(restored.graph.nodes.len(), 2);
        assert_eq!(restored.graph.edges.len(), 1);

        let n1_restored = restored.graph.get_node(NodeId(1)).unwrap();
        assert_eq!(n1_restored.position, [50.0, 75.0]);
        assert_eq!(
            n1_restored.get_color("color", [0.0; 4]),
            [1.0, 0.5, 0.25, 1.0]
        );
        let res = n1_restored.get_param("resolution").unwrap().as_resolution();
        assert_eq!(res, Some((4096, 2048)));
    }

    #[test]
    pub fn test_graph_connect_cycle_prevention() {
        let mut graph = Graph::new();
        let n1 = graph.create_node("ConstantColor", "N1", [0.0, 0.0]);
        let n2 = graph.create_node("Invert", "N2", [200.0, 0.0]);
        let n3 = graph.create_node("Invert", "N3", [400.0, 0.0]);

        let p1_out = PinId::output(n1, "output");
        let p2_in = PinId::input(n2, "input");
        let p2_out = PinId::output(n2, "output");
        let p3_in = PinId::input(n3, "input");
        let p3_out = PinId::output(n3, "output");

        // Valid chain: N1 -> N2 -> N3
        assert!(graph.connect(p1_out, p2_in.clone()).is_ok());
        assert!(graph.connect(p2_out, p3_in).is_ok());
        assert_eq!(graph.edges.len(), 2);

        // Attempting to connect N3 -> N2 forms a cycle and must be rejected
        let cycle_res = graph.connect(p3_out, p2_in.clone());
        assert!(matches!(cycle_res, Err(GraphError::CycleDetected)));

        // Previous incoming edge N1 -> N2 must be preserved untouched!
        assert_eq!(graph.edges.len(), 2);
        assert_eq!(graph.incoming_edge(&p2_in).unwrap().from.node_id, n1);
    }

    #[test]
    pub fn test_graph_clone_and_paste_subgraph_3_connected_nodes() {
        let mut graph = Graph::new();
        let n1 = graph.create_node("ConstantColor", "N1", [10.0, 20.0]);
        let n2 = graph.create_node("Invert", "N2", [110.0, 120.0]);
        let n3 = graph.create_node("TextureOutput", "N3", [210.0, 220.0]);

        let p1_out = PinId::output(n1, "RGBA");
        let p2_in = PinId::input(n2, "RGBA");
        let p2_out = PinId::output(n2, "RGBA");
        let p3_in = PinId::input(n3, "RGBA");

        if let Some(node) = graph.get_node_mut(n1) {
            node.add_output("RGBA");
        }
        if let Some(node) = graph.get_node_mut(n2) {
            node.add_input("RGBA");
            node.add_output("RGBA");
        }
        if let Some(node) = graph.get_node_mut(n3) {
            node.add_input("RGBA");
        }

        graph.connect(p1_out, p2_in).expect("Connect 1->2 failed");
        graph.connect(p2_out, p3_in).expect("Connect 2->3 failed");
        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.edges.len(), 2);

        // Clone subgraph with 3 connected nodes
        let (cloned_nodes, cloned_edges) = graph.clone_subgraph(&[n1, n2, n3]);
        assert_eq!(cloned_nodes.len(), 3);
        assert_eq!(cloned_edges.len(), 2);

        // Paste subgraph with [50.0, 50.0] offset
        let new_ids = graph.paste_subgraph(cloned_nodes, cloned_edges, [50.0, 50.0]);
        assert_eq!(new_ids.len(), 3);

        // 1. Verify fresh, unique IDs distinct from original IDs
        for &id in &new_ids {
            assert!(id != n1 && id != n2 && id != n3);
            assert!(graph.contains_node(id));
        }

        // 2. Verify total graph size doubled
        assert_eq!(graph.nodes.len(), 6);
        assert_eq!(graph.edges.len(), 4);

        // 3. Verify positions offset by [50.0, 50.0]
        let pn1 = graph.get_node(new_ids[0]).unwrap();
        let pn2 = graph.get_node(new_ids[1]).unwrap();
        let pn3 = graph.get_node(new_ids[2]).unwrap();
        assert_eq!(pn1.position, [60.0, 70.0]);
        assert_eq!(pn2.position, [160.0, 170.0]);
        assert_eq!(pn3.position, [260.0, 270.0]);

        // 4. Verify pin IDs inside pasted nodes remapped to new NodeIds
        assert_eq!(pn1.outputs[0].node_id, new_ids[0]);
        assert_eq!(pn2.inputs[0].node_id, new_ids[1]);
        assert_eq!(pn2.outputs[0].node_id, new_ids[1]);
        assert_eq!(pn3.inputs[0].node_id, new_ids[2]);

        // 5. Verify edges between newly pasted nodes remapped
        let pasted_edges = graph.edges_from(new_ids[0]);
        assert_eq!(pasted_edges.len(), 1);
        assert_eq!(pasted_edges[0].from.node_id, new_ids[0]);
        assert_eq!(pasted_edges[0].to.node_id, new_ids[1]);

        let pasted_edges_2 = graph.edges_from(new_ids[1]);
        assert_eq!(pasted_edges_2.len(), 1);
        assert_eq!(pasted_edges_2[0].from.node_id, new_ids[1]);
        assert_eq!(pasted_edges_2[0].to.node_id, new_ids[2]);
    }
}
