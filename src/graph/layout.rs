//! Hierarchical Sugiyama DAG Auto-Layout Engine (Phase 5).
//!
//! Provides deterministic Left-to-Right hierarchical layered graph layout
//! with topological rank tiers, barycentric wire crossing reduction,
//! port-aligned pin straightening, 24px dot grid snapping, and guaranteed zero node overlap.

use crate::graph::model::{Edge, Graph, Node, NodeId, PinId};
use std::collections::{HashMap, HashSet, VecDeque};

/// Horizontal spacing between rank column tiers.
pub const HORIZONTAL_COLUMN_GAP: f32 = 72.0;

/// Vertical minimum spacing between adjacent node cards in the same column.
pub const VERTICAL_NODE_GAP: f32 = 36.0;

/// Vertical spacing between separate connected components or subgraph pipelines.
pub const COMPONENT_VERTICAL_GAP: f32 = 72.0;

/// Spacing step matching the React Flow / modern DCC dot canvas grid.
pub const GRID_STEP: f32 = 24.0;

/// Default origin coordinate for layout anchoring.
pub const ORIGIN_X: f32 = 96.0;
pub const ORIGIN_Y: f32 = 96.0;

/// Snaps a scalar value to the nearest canvas dot grid step.
#[inline]
pub fn snap_to_grid(val: f32) -> f32 {
    (val / GRID_STEP).round() * GRID_STEP
}

/// Dynamically calculates node card width based on title, custom label, and socket name metrics.
pub fn calculate_node_width(node: &Node) -> f32 {
    let title_len = node.node_type.len();
    let label_len = if !node.label.is_empty() && node.label != node.node_type {
        node.label.len()
    } else {
        0
    };
    let max_in_len = node.inputs.iter().map(|p| p.name.len()).max().unwrap_or(0);
    let max_out_len = node.outputs.iter().map(|p| p.name.len()).max().unwrap_or(0);

    let content_len = (title_len.max(label_len)).max(max_in_len + max_out_len);
    (240.0 + (content_len as f32 * 2.0)).clamp(260.0, 280.0)
}

/// Dynamically calculates node card height based on header and socket count.
pub fn calculate_node_height(node: &Node) -> f32 {
    let is_texture_input = node.node_type == "TextureInput";
    let header_height = 36.0;
    let filename_height = if is_texture_input {
        let name_len = node
            .get_param("file_path")
            .or_else(|| node.get_param("path"))
            .and_then(|v| v.as_str())
            .map(|s| s.len())
            .unwrap_or(node.label.len());
        if name_len > 60 {
            54.0
        } else if name_len > 30 {
            42.0
        } else {
            30.0
        }
    } else {
        0.0
    };
    let socket_row_height = if is_texture_input { 34.0 } else { 24.0 };
    let max_sockets = node.inputs.len().max(node.outputs.len()).max(1);
    let body_height = filename_height + (max_sockets as f32 * socket_row_height) + 16.0;
    header_height + body_height
}

/// Returns the (width, height) bounding dimensions of a node card.
pub fn calculate_node_size(node: &Node) -> (f32, f32) {
    (calculate_node_width(node), calculate_node_height(node))
}

/// Computes the vertical Y-offset of a pin socket relative to the node top edge.
pub fn pin_y_offset(node: &Node, pin_id: &PinId) -> f32 {
    let socket_start_y = 40.0; // header_height (28.0) + internal top padding (12.0)
    let socket_row_height = 22.0;

    let row_idx = if pin_id.is_input {
        node.inputs.iter().position(|p| p.name == pin_id.name).unwrap_or(0)
    } else {
        node.outputs.iter().position(|p| p.name == pin_id.name).unwrap_or(0)
    };

    socket_start_y + (row_idx as f32 * socket_row_height)
}

/// Partitioned representation of graph topology separating connected subgraphs from isolated nodes.
#[derive(Debug, Clone)]
struct GraphPartition {
    connected_components: Vec<Vec<NodeId>>,
    isolated_nodes: Vec<NodeId>,
}

/// Partitions graph nodes into connected subgraphs (undirected components) and isolated nodes.
fn partition_graph(graph: &Graph) -> GraphPartition {
    if graph.nodes.is_empty() {
        return GraphPartition {
            connected_components: Vec::new(),
            isolated_nodes: Vec::new(),
        };
    }

    // Build undirected adjacency map
    let mut adj: HashMap<NodeId, HashSet<NodeId>> = HashMap::new();
    for &id in graph.nodes.keys() {
        adj.insert(id, HashSet::new());
    }

    for edge in &graph.edges {
        if graph.nodes.contains_key(&edge.from.node_id) && graph.nodes.contains_key(&edge.to.node_id) {
            adj.entry(edge.from.node_id).or_default().insert(edge.to.node_id);
            adj.entry(edge.to.node_id).or_default().insert(edge.from.node_id);
        }
    }

    let mut visited: HashSet<NodeId> = HashSet::new();
    let mut connected_components = Vec::new();
    let mut isolated_nodes = Vec::new();

    // Deterministic traversal by sorted NodeId
    let mut sorted_ids: Vec<NodeId> = graph.nodes.keys().copied().collect();
    sorted_ids.sort();

    for id in sorted_ids {
        if visited.contains(&id) {
            continue;
        }

        let neighbors = &adj[&id];
        if neighbors.is_empty() {
            visited.insert(id);
            isolated_nodes.push(id);
            continue;
        }

        // BFS to collect connected component
        let mut comp = Vec::new();
        let mut queue = VecDeque::new();
        queue.push_back(id);
        visited.insert(id);

        while let Some(curr) = queue.pop_front() {
            comp.push(curr);
            if let Some(nbrs) = adj.get(&curr) {
                let mut sorted_nbrs: Vec<NodeId> = nbrs.iter().copied().collect();
                sorted_nbrs.sort();
                for nbr in sorted_nbrs {
                    if visited.insert(nbr) {
                        queue.push_back(nbr);
                    }
                }
            }
        }

        comp.sort();
        connected_components.push(comp);
    }

    // Sort components by lowest NodeId for deterministic layout
    connected_components.sort_by_key(|c| c.first().copied().unwrap_or(NodeId(0)));

    GraphPartition {
        connected_components,
        isolated_nodes,
    }
}

/// Context-aware auto-layout: if a node is selected, arranges only its upstream
/// back-hierarchy (Right to Left) anchored to that node; otherwise organizes the entire graph.
pub fn auto_layout_graph_contextual(graph: &mut Graph, selected_node: Option<NodeId>) {
    if let Some(target_id) = selected_node {
        if graph.nodes.contains_key(&target_id) {
            auto_layout_back_hierarchy(graph, target_id);
            return;
        }
    }

    auto_layout_graph(graph);
}

/// Organizes only the upstream back-hierarchy of `target_id` from Right to Left,
/// keeping `target_id` as the rightmost anchor and aligning parent pins horizontally.
///
/// All nodes outside this upstream hierarchy remain completely untouched in place.
pub fn auto_layout_back_hierarchy(graph: &mut Graph, target_id: NodeId) {
    if !graph.nodes.contains_key(&target_id) {
        return;
    }

    let mut back_set: HashSet<NodeId> = crate::graph::compiler::GraphCompiler::upstream_nodes(graph, target_id);
    back_set.insert(target_id);

    // If node has no upstream connections, snap in place
    if back_set.len() == 1 {
        if let Some(node) = graph.nodes.get_mut(&target_id) {
            node.position = [snap_to_grid(node.position[0]), snap_to_grid(node.position[1])];
        }
        return;
    }

    // Compute longest-path backward distances from target_id:
    // dist[target_id] = 0; for edge u -> v, dist[u] = max(dist[v] + 1).
    let mut dist: HashMap<NodeId, usize> = HashMap::new();
    dist.insert(target_id, 0);

    let mut queue = VecDeque::new();
    queue.push_back(target_id);

    let max_iter = back_set.len() * back_set.len() + 10;
    let mut iter = 0;

    while let Some(curr) = queue.pop_front() {
        iter += 1;
        if iter > max_iter {
            break;
        }

        let curr_d = dist[&curr];
        for edge in graph.edges_to(curr) {
            let p = edge.from.node_id;
            if back_set.contains(&p) {
                let p_d = dist.entry(p).or_insert(0);
                if curr_d + 1 > *p_d {
                    *p_d = curr_d + 1;
                    queue.push_back(p);
                }
            }
        }
    }

    let max_dist = dist.values().copied().max().unwrap_or(0);
    if max_dist == 0 {
        return;
    }

    // Ranks from Left to Right: rank[v] = max_dist - dist[v]
    // Leftmost roots have rank = 0, target_id has rank = max_dist.
    let mut layers: Vec<Vec<NodeId>> = vec![Vec::new(); max_dist + 1];
    for &id in &back_set {
        let d = dist.get(&id).copied().unwrap_or(max_dist);
        let rank = max_dist.saturating_sub(d);
        layers[rank].push(id);
    }

    // Barycentric sort within each layer from Left to Right
    for r in 1..=max_dist {
        let prev_layer = &layers[r - 1];
        let prev_indices: HashMap<NodeId, usize> = prev_layer
            .iter()
            .enumerate()
            .map(|(idx, &id)| (id, idx))
            .collect();

        layers[r].sort_by(|&a, &b| {
            let parents_a: Vec<NodeId> = graph
                .edges_to(a)
                .into_iter()
                .map(|e| e.from.node_id)
                .filter(|id| prev_indices.contains_key(id))
                .collect();
            let parents_b: Vec<NodeId> = graph
                .edges_to(b)
                .into_iter()
                .map(|e| e.from.node_id)
                .filter(|id| prev_indices.contains_key(id))
                .collect();
            let bary_a = calculate_barycenter(&parents_a, &prev_indices);
            let bary_b = calculate_barycenter(&parents_b, &prev_indices);
            bary_a.partial_cmp(&bary_b).unwrap_or(a.cmp(&b))
        });
    }

    // Anchor: Target node's current position (snapped to grid)
    let anchor_pos = graph.nodes[&target_id].position;
    let anchor_x = snap_to_grid(anchor_pos[0]);
    let anchor_y = snap_to_grid(anchor_pos[1]);

    // Horizontal column coordinates (Right to Left from anchor_x)
    let mut layer_x = vec![0.0_f32; max_dist + 1];
    layer_x[max_dist] = anchor_x;

    for r in (0..max_dist).rev() {
        let max_w = layers[r]
            .iter()
            .map(|&id| calculate_node_width(&graph.nodes[&id]))
            .fold(0.0_f32, f32::max);
        layer_x[r] = snap_to_grid(layer_x[r + 1] - max_w - HORIZONTAL_COLUMN_GAP);
    }

    // Vertical Y assignment: pin-straightening backwards from target
    let mut pos_y: HashMap<NodeId, f32> = HashMap::new();
    pos_y.insert(target_id, anchor_y);

    for r in (0..max_dist).rev() {
        let mut desired_ys: HashMap<NodeId, f32> = HashMap::new();

        for &id in &layers[r] {
            let node = &graph.nodes[&id];
            let outgoing = graph.edges_from(id);

            let mut targets = Vec::new();
            for edge in outgoing {
                if let Some(&child_y) = pos_y.get(&edge.to.node_id) {
                    if let Some(child_node) = graph.nodes.get(&edge.to.node_id) {
                        let child_pin_y = child_y + pin_y_offset(child_node, &edge.to);
                        let local_pin_y = pin_y_offset(node, &edge.from);
                        targets.push(child_pin_y - local_pin_y);
                    }
                }
            }

            let desired = if !targets.is_empty() {
                targets.iter().sum::<f32>() / targets.len() as f32
            } else {
                anchor_y
            };
            desired_ys.insert(id, desired);
        }

        // Sort nodes in column r by desired Y
        layers[r].sort_by(|&a, &b| {
            desired_ys[&a]
                .partial_cmp(&desired_ys[&b])
                .unwrap_or(a.cmp(&b))
        });

        // Center column around average desired Y
        let col_heights: Vec<f32> = layers[r]
            .iter()
            .map(|&id| calculate_node_height(&graph.nodes[&id]))
            .collect();
        let total_content_h: f32 = col_heights.iter().sum::<f32>()
            + (layers[r].len().saturating_sub(1) as f32 * VERTICAL_NODE_GAP);
        let avg_desired_y = desired_ys.values().sum::<f32>() / desired_ys.len() as f32;
        let start_column_y = snap_to_grid(avg_desired_y - (total_content_h * 0.5));

        let mut last_bottom = f32::MIN;
        for &id in &layers[r] {
            let node = &graph.nodes[&id];
            let h = calculate_node_height(node);
            let ideal_y = desired_ys[&id];

            let min_allowed = if last_bottom == f32::MIN {
                start_column_y.min(ideal_y)
            } else {
                last_bottom + VERTICAL_NODE_GAP
            };

            let mut y = snap_to_grid(ideal_y.max(min_allowed));
            if y < min_allowed {
                y = snap_to_grid(min_allowed + GRID_STEP - 0.1);
            }

            pos_y.insert(id, y);
            last_bottom = y + h;
        }

        // Strict collision separation pass
        enforce_column_separation(&layers[r], graph, &mut pos_y, start_column_y);
    }

    // Apply calculated positions back to graph ONLY for nodes in back_set
    for (r, layer) in layers.iter().enumerate() {
        let x = layer_x[r];
        for &id in layer {
            if let Some(node) = graph.nodes.get_mut(&id) {
                node.position = [x, pos_y[&id]];
            }
        }
    }
}

/// Automatically arranges all nodes in the graph in a compact, non-overlapping, Left-to-Right layout.
pub fn auto_layout_graph(graph: &mut Graph) {
    if graph.nodes.is_empty() {
        return;
    }

    // Single node fast-path
    if graph.nodes.len() == 1 {
        if let Some(node) = graph.nodes.values_mut().next() {
            node.position = [ORIGIN_X, ORIGIN_Y];
        }
        return;
    }

    let partition = partition_graph(graph);
    let mut node_positions: HashMap<NodeId, [f32; 2]> = HashMap::new();

    let mut current_component_top_y = ORIGIN_Y;

    // 1. Arrange each connected component independently
    for component in partition.connected_components {
        let (comp_positions, comp_height) = layout_connected_component(
            graph,
            &component,
            ORIGIN_X,
            current_component_top_y,
        );

        for (id, pos) in comp_positions {
            node_positions.insert(id, pos);
        }

        current_component_top_y += comp_height + COMPONENT_VERTICAL_GAP;
        current_component_top_y = snap_to_grid(current_component_top_y);
    }

    // 2. Arrange isolated / unconnected nodes neatly in a bottom tray
    if !partition.isolated_nodes.is_empty() {
        let tray_start_y = if node_positions.is_empty() {
            ORIGIN_Y
        } else {
            current_component_top_y
        };

        let max_per_row = 4;
        let mut col_idx = 0;
        let mut current_row_y = tray_start_y;
        let mut max_row_height: f32 = 0.0;
        let mut current_col_x = ORIGIN_X;

        for id in partition.isolated_nodes {
            if let Some(node) = graph.nodes.get(&id) {
                let (w, h) = calculate_node_size(node);
                node_positions.insert(id, [snap_to_grid(current_col_x), snap_to_grid(current_row_y)]);

                max_row_height = max_row_height.max(h);
                current_col_x += w + HORIZONTAL_COLUMN_GAP;

                col_idx += 1;
                if col_idx >= max_per_row {
                    col_idx = 0;
                    current_row_y += max_row_height + VERTICAL_NODE_GAP;
                    current_row_y = snap_to_grid(current_row_y);
                    current_col_x = ORIGIN_X;
                    max_row_height = 0.0;
                }
            }
        }
    }

    // Apply calculated positions back to the graph
    for (id, pos) in node_positions {
        if let Some(node) = graph.nodes.get_mut(&id) {
            node.position = pos;
        }
    }
}

/// Lays out a single connected DAG component using the Sugiyama framework.
/// Returns map of node positions and total bounding height of the component.
fn layout_connected_component(
    graph: &Graph,
    component_nodes: &[NodeId],
    start_x: f32,
    start_y: f32,
) -> (HashMap<NodeId, [f32; 2]>, f32) {
    let node_set: HashSet<NodeId> = component_nodes.iter().copied().collect();

    // Step 1: Assign Topological Ranks (Longest-Path Layering)
    let mut in_degrees: HashMap<NodeId, usize> = HashMap::new();
    let mut forward_adj: HashMap<NodeId, Vec<NodeId>> = HashMap::new();
    let mut backward_adj: HashMap<NodeId, Vec<NodeId>> = HashMap::new();

    for &id in component_nodes {
        in_degrees.insert(id, 0);
        forward_adj.insert(id, Vec::new());
        backward_adj.insert(id, Vec::new());
    }

    for edge in &graph.edges {
        if node_set.contains(&edge.from.node_id) && node_set.contains(&edge.to.node_id) {
            *in_degrees.entry(edge.to.node_id).or_insert(0) += 1;
            forward_adj.entry(edge.from.node_id).or_default().push(edge.to.node_id);
            backward_adj.entry(edge.to.node_id).or_default().push(edge.from.node_id);
        }
    }

    let mut ranks: HashMap<NodeId, usize> = HashMap::new();
    for &id in component_nodes {
        ranks.insert(id, 0);
    }

    // Sources: nodes with 0 incoming edges within component
    let mut roots: Vec<NodeId> = in_degrees
        .iter()
        .filter(|&(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();
    roots.sort();

    // Fallback if component contains a cycle
    if roots.is_empty() {
        if let Some(&first) = component_nodes.first() {
            roots.push(first);
        }
    }

    // Compute longest path ranks via BFS/Kahn's traversal
    let mut queue = VecDeque::new();
    for &root in &roots {
        queue.push_back(root);
    }

    let max_iterations = component_nodes.len() * component_nodes.len() + 10;
    let mut iterations = 0;

    while let Some(u) = queue.pop_front() {
        iterations += 1;
        if iterations > max_iterations {
            break; // Cycle safeguard
        }

        let curr_rank = ranks[&u];
        if let Some(children) = forward_adj.get(&u) {
            for &v in children {
                let v_rank = ranks.get_mut(&v).unwrap();
                if curr_rank + 1 > *v_rank {
                    *v_rank = curr_rank + 1;
                    queue.push_back(v);
                }
            }
        }
    }

    // Group nodes into column layers by rank
    let max_rank = ranks.values().copied().max().unwrap_or(0);
    let mut layers: Vec<Vec<NodeId>> = vec![Vec::new(); max_rank + 1];

    for &id in component_nodes {
        let r = ranks[&id];
        layers[r].push(id);
    }

    // Step 2: Crossing Minimization (Barycentric Ordering)
    for r in 1..=max_rank {
        let prev_layer = &layers[r - 1];
        let prev_indices: HashMap<NodeId, usize> = prev_layer
            .iter()
            .enumerate()
            .map(|(idx, &id)| (id, idx))
            .collect();

        layers[r].sort_by(|&a, &b| {
            let bary_a = calculate_barycenter(&backward_adj[&a], &prev_indices);
            let bary_b = calculate_barycenter(&backward_adj[&b], &prev_indices);
            bary_a.partial_cmp(&bary_b).unwrap_or(a.cmp(&b))
        });
    }

    // Step 3: Horizontal X Coordinate Assignment per Column
    let mut layer_x = Vec::with_capacity(layers.len());
    let mut cur_x = start_x;
    for layer in &layers {
        let max_w = layer
            .iter()
            .map(|&id| calculate_node_width(&graph.nodes[&id]))
            .fold(0.0_f32, f32::max);

        layer_x.push(snap_to_grid(cur_x));
        cur_x += max_w + HORIZONTAL_COLUMN_GAP;
        cur_x = snap_to_grid(cur_x);
    }

    // Step 4: Vertical Y Coordinate Assignment & Pin Straightening
    let mut pos_y: HashMap<NodeId, f32> = HashMap::new();

    // Initialize Layer 0 Y positions compactly stacked
    let mut cur_l0_y = start_y;
    for &id in &layers[0] {
        let node = &graph.nodes[&id];
        let h = calculate_node_height(node);
        pos_y.insert(id, snap_to_grid(cur_l0_y));
        cur_l0_y += h + VERTICAL_NODE_GAP;
        cur_l0_y = snap_to_grid(cur_l0_y);
    }

    // Forward pass: align downstream nodes with upstream source pin sockets
    for r in 1..=max_rank {
        let mut desired_ys: HashMap<NodeId, f32> = HashMap::new();

        for &id in &layers[r] {
            let node = &graph.nodes[&id];
            let incoming_edges: Vec<&Edge> = graph.edges_to(id);

            let mut aligned_targets = Vec::new();
            for edge in incoming_edges {
                if let Some(&parent_y) = pos_y.get(&edge.from.node_id) {
                    if let Some(parent_node) = graph.nodes.get(&edge.from.node_id) {
                        let parent_pin_y = parent_y + pin_y_offset(parent_node, &edge.from);
                        let local_pin_y = pin_y_offset(node, &edge.to);
                        aligned_targets.push(parent_pin_y - local_pin_y);
                    }
                }
            }

            let desired = if !aligned_targets.is_empty() {
                aligned_targets.iter().sum::<f32>() / aligned_targets.len() as f32
            } else {
                start_y
            };
            desired_ys.insert(id, desired);
        }

        // Sort nodes in column by desired Y (maintaining topological order)
        layers[r].sort_by(|&a, &b| {
            desired_ys[&a]
                .partial_cmp(&desired_ys[&b])
                .unwrap_or(a.cmp(&b))
        });

        // Compact downward placement preventing overlaps
        let mut last_bottom = f32::MIN;
        for &id in &layers[r] {
            let node = &graph.nodes[&id];
            let h = calculate_node_height(node);
            let ideal_y = desired_ys[&id];

            let min_allowed_y = if last_bottom == f32::MIN {
                start_y
            } else {
                last_bottom + VERTICAL_NODE_GAP
            };

            let mut y = snap_to_grid(ideal_y.max(min_allowed_y));
            if y < min_allowed_y {
                y = snap_to_grid(min_allowed_y + GRID_STEP - 0.1);
            }

            pos_y.insert(id, y);
            last_bottom = y + h;
        }
    }

    // Backward centering pass: center parent nodes relative to their children where possible
    for r in (0..max_rank).rev() {
        for &id in &layers[r] {
            let node = &graph.nodes[&id];
            let outgoing_edges: Vec<&Edge> = graph.edges_from(id);

            let mut child_targets = Vec::new();
            for edge in outgoing_edges {
                if let Some(&child_y) = pos_y.get(&edge.to.node_id) {
                    if let Some(child_node) = graph.nodes.get(&edge.to.node_id) {
                        let child_pin_y = child_y + pin_y_offset(child_node, &edge.to);
                        let local_pin_y = pin_y_offset(node, &edge.from);
                        child_targets.push(child_pin_y - local_pin_y);
                    }
                }
            }

            if !child_targets.is_empty() {
                let target_y = child_targets.iter().sum::<f32>() / child_targets.len() as f32;
                // Move parent halfway towards child center
                let curr_y = pos_y[&id];
                let smoothed_y = snap_to_grid((curr_y + target_y) * 0.5);
                pos_y.insert(id, smoothed_y);
            }
        }

        // Final downward compaction pass for this column to guarantee ZERO overlap
        enforce_column_separation(&layers[r], graph, &mut pos_y, start_y);
    }

    // Also enforce final separation across all downstream columns
    for r in 1..=max_rank {
        enforce_column_separation(&layers[r], graph, &mut pos_y, start_y);
    }

    // Build final positions map and calculate bounding height
    let mut positions = HashMap::new();
    let mut min_y = f32::MAX;
    let mut max_y = f32::MIN;

    for (r, layer) in layers.iter().enumerate() {
        let x = layer_x[r];
        for &id in layer {
            let y = pos_y[&id];
            let h = calculate_node_height(&graph.nodes[&id]);
            positions.insert(id, [x, y]);
            min_y = min_y.min(y);
            max_y = max_y.max(y + h);
        }
    }

    let comp_height = (max_y - min_y).max(100.0);
    (positions, comp_height)
}

/// Enforces strict minimum vertical gap between all adjacent nodes in a column.
/// Guarantees that no two cards ever overlap.
fn enforce_column_separation(
    column_nodes: &[NodeId],
    graph: &Graph,
    pos_y: &mut HashMap<NodeId, f32>,
    min_floor_y: f32,
) {
    let mut last_bottom = f32::MIN;
    for &id in column_nodes {
        let node = &graph.nodes[&id];
        let h = calculate_node_height(node);
        let curr_y = pos_y[&id];

        let min_allowed = if last_bottom == f32::MIN {
            min_floor_y
        } else {
            last_bottom + VERTICAL_NODE_GAP
        };

        let mut y = curr_y.max(min_allowed);
        y = snap_to_grid(y);
        if y < min_allowed {
            y = ((min_allowed + GRID_STEP - 0.01) / GRID_STEP).ceil() * GRID_STEP;
        }

        pos_y.insert(id, y);
        last_bottom = y + h;
    }
}

/// Helper calculating barycentric coordinate average of parent node indices.
fn calculate_barycenter(parents: &[NodeId], parent_indices: &HashMap<NodeId, usize>) -> f32 {
    let matched: Vec<usize> = parents
        .iter()
        .filter_map(|p| parent_indices.get(p).copied())
        .collect();

    if matched.is_empty() {
        0.0
    } else {
        matched.iter().sum::<usize>() as f32 / matched.len() as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::model::PinId;

    /// Validates that no two node cards intersect in canvas coordinate space.
    fn assert_zero_node_overlaps(graph: &Graph) {
        let nodes: Vec<&Node> = graph.nodes.values().collect();
        for i in 0..nodes.len() {
            for j in (i + 1)..nodes.len() {
                let n1 = nodes[i];
                let n2 = nodes[j];
                let (w1, h1) = calculate_node_size(n1);
                let (w2, h2) = calculate_node_size(n2);

                let r1_min_x = n1.position[0];
                let r1_max_x = n1.position[0] + w1;
                let r1_min_y = n1.position[1];
                let r1_max_y = n1.position[1] + h1;

                let r2_min_x = n2.position[0];
                let r2_max_x = n2.position[0] + w2;
                let r2_min_y = n2.position[1];
                let r2_max_y = n2.position[1] + h2;

                let overlap_x = r1_min_x < r2_max_x && r1_max_x > r2_min_x;
                let overlap_y = r1_min_y < r2_max_y && r1_max_y > r2_min_y;

                assert!(
                    !(overlap_x && overlap_y),
                    "Collision detected between Node#{} ({:?}, size: {:?}) and Node#{} ({:?}, size: {:?})",
                    n1.id, n1.position, (w1, h1),
                    n2.id, n2.position, (w2, h2),
                );
            }
        }
    }

    #[test]
    fn test_empty_graph_layout() {
        let mut graph = Graph::new();
        auto_layout_graph(&mut graph);
        assert!(graph.nodes.is_empty());
    }

    #[test]
    fn test_single_node_layout() {
        let mut graph = Graph::new();
        let id = graph.create_node("ConstantScalar", "Float", [500.0, 500.0]);
        auto_layout_graph(&mut graph);
        let node = graph.get_node(id).unwrap();
        assert_eq!(node.position, [ORIGIN_X, ORIGIN_Y]);
    }

    #[test]
    fn test_linear_chain_layout_and_zero_overlap() {
        let mut graph = Graph::new();
        let n1 = graph.create_node("ConstantColor", "Color", [0.0, 0.0]);
        let n2 = graph.create_node("Invert", "Invert", [0.0, 0.0]);
        let n3 = graph.create_node("TextureOutput", "Output", [0.0, 0.0]);

        graph.get_node_mut(n1).unwrap().add_output("output");
        graph.get_node_mut(n2).unwrap().add_input("input");
        graph.get_node_mut(n2).unwrap().add_output("output");
        graph.get_node_mut(n3).unwrap().add_input("input");

        graph.connect(PinId::output(n1, "output"), PinId::input(n2, "input")).unwrap();
        graph.connect(PinId::output(n2, "output"), PinId::input(n3, "input")).unwrap();

        auto_layout_graph(&mut graph);

        let p1 = graph.get_node(n1).unwrap().position;
        let p2 = graph.get_node(n2).unwrap().position;
        let p3 = graph.get_node(n3).unwrap().position;

        // Strictly Left-to-Right progression
        assert!(p1[0] < p2[0], "p1.x < p2.x");
        assert!(p2[0] < p3[0], "p2.x < p3.x");

        // Verify all coordinates are snapped to 24px grid
        assert_eq!(p1[0] % GRID_STEP, 0.0);
        assert_eq!(p1[1] % GRID_STEP, 0.0);
        assert_eq!(p2[0] % GRID_STEP, 0.0);
        assert_eq!(p2[1] % GRID_STEP, 0.0);
        assert_eq!(p3[0] % GRID_STEP, 0.0);
        assert_eq!(p3[1] % GRID_STEP, 0.0);

        assert_zero_node_overlaps(&graph);
    }

    #[test]
    fn test_branching_diamond_graph_zero_overlap() {
        let mut graph = Graph::new();
        let n_src = graph.create_node("TextureInput", "Input", [0.0, 0.0]);
        let n_b1 = graph.create_node("Levels", "Branch 1", [0.0, 0.0]);
        let n_b2 = graph.create_node("NormalFlipGreen", "Branch 2", [0.0, 0.0]);
        let n_sink = graph.create_node("LayerBlend", "Blend", [0.0, 0.0]);

        graph.get_node_mut(n_src).unwrap().add_output("output");
        graph.get_node_mut(n_b1).unwrap().add_input("input");
        graph.get_node_mut(n_b1).unwrap().add_output("output");
        graph.get_node_mut(n_b2).unwrap().add_input("input");
        graph.get_node_mut(n_b2).unwrap().add_output("output");
        graph.get_node_mut(n_sink).unwrap().add_input("base");
        graph.get_node_mut(n_sink).unwrap().add_input("blend");

        graph.connect(PinId::output(n_src, "output"), PinId::input(n_b1, "input")).unwrap();
        graph.connect(PinId::output(n_src, "output"), PinId::input(n_b2, "input")).unwrap();
        graph.connect(PinId::output(n_b1, "output"), PinId::input(n_sink, "base")).unwrap();
        graph.connect(PinId::output(n_b2, "output"), PinId::input(n_sink, "blend")).unwrap();

        auto_layout_graph(&mut graph);

        let p_src = graph.get_node(n_src).unwrap().position;
        let p_b1 = graph.get_node(n_b1).unwrap().position;
        let p_b2 = graph.get_node(n_b2).unwrap().position;
        let p_sink = graph.get_node(n_sink).unwrap().position;

        assert!(p_src[0] < p_b1[0]);
        assert_eq!(p_b1[0], p_b2[0]); // Both branches in same column tier
        assert!(p_b1[0] < p_sink[0]);

        // Branch 1 and Branch 2 must not overlap vertically
        assert!((p_b1[1] - p_b2[1]).abs() >= VERTICAL_NODE_GAP);

        assert_zero_node_overlaps(&graph);
    }

    #[test]
    fn test_starter_graph_auto_layout_zero_overlap() {
        let mut graph = crate::app::build_starter_graph();
        // Scatter all nodes to random overlapping coordinates first
        for node in graph.nodes.values_mut() {
            node.position = [150.0, 150.0];
        }

        auto_layout_graph(&mut graph);

        // Verify zero overlap across all 5 nodes
        assert_zero_node_overlaps(&graph);

        // Verify layout determinism: running layout a second time produces identical coordinates
        let positions_run1: Vec<[f32; 2]> = graph.nodes.values().map(|n| n.position).collect();
        auto_layout_graph(&mut graph);
        let positions_run2: Vec<[f32; 2]> = graph.nodes.values().map(|n| n.position).collect();
        assert_eq!(positions_run1, positions_run2);
    }

    #[test]
    fn test_isolated_nodes_tray_placement() {
        let mut graph = Graph::new();
        let n_conn1 = graph.create_node("ConstantScalar", "C1", [0.0, 0.0]);
        let n_conn2 = graph.create_node("TextureOutput", "Out", [0.0, 0.0]);
        graph.get_node_mut(n_conn1).unwrap().add_output("output");
        graph.get_node_mut(n_conn2).unwrap().add_input("input");
        graph.connect(PinId::output(n_conn1, "output"), PinId::input(n_conn2, "input")).unwrap();

        let n_iso1 = graph.create_node("Invert", "Isolated 1", [0.0, 0.0]);
        let n_iso2 = graph.create_node("Levels", "Isolated 2", [0.0, 0.0]);

        auto_layout_graph(&mut graph);

        assert_zero_node_overlaps(&graph);

        let p_conn1 = graph.get_node(n_conn1).unwrap().position;
        let p_iso1 = graph.get_node(n_iso1).unwrap().position;
        let p_iso2 = graph.get_node(n_iso2).unwrap().position;

        // Isolated nodes must be placed below connected pipeline
        assert!(p_iso1[1] > p_conn1[1]);
        assert!(p_iso2[1] > p_conn1[1]);
    }

    #[test]
    fn test_back_hierarchy_layout_right_to_left() {
        let mut graph = Graph::new();
        // Pipeline: N1 (Src) -> N2 (Split) -> N3 (Levels) -> N4 (Output)
        // Auxiliary unrelated: N5 (Color) placed at [1500.0, 1500.0]
        let n1 = graph.create_node("TextureInput", "Src", [100.0, 100.0]);
        let n2 = graph.create_node("ChannelSplit", "Split", [200.0, 200.0]);
        let n3 = graph.create_node("Levels", "Target Selected", [800.0, 400.0]);
        let n4 = graph.create_node("TextureOutput", "Downstream", [1200.0, 400.0]);
        let n5 = graph.create_node("ConstantColor", "Unrelated", [1500.0, 1500.0]);

        graph.get_node_mut(n1).unwrap().add_output("output");
        graph.get_node_mut(n2).unwrap().add_input("input");
        graph.get_node_mut(n2).unwrap().add_output("R");
        graph.get_node_mut(n3).unwrap().add_input("input");
        graph.get_node_mut(n3).unwrap().add_output("output");
        graph.get_node_mut(n4).unwrap().add_input("input");

        graph.connect(PinId::output(n1, "output"), PinId::input(n2, "input")).unwrap();
        graph.connect(PinId::output(n2, "R"), PinId::input(n3, "input")).unwrap();
        graph.connect(PinId::output(n3, "output"), PinId::input(n4, "input")).unwrap();

        let initial_n4_pos = graph.get_node(n4).unwrap().position;
        let initial_n5_pos = graph.get_node(n5).unwrap().position;

        // Auto layout ONLY the back hierarchy of N3 (selected node)
        auto_layout_back_hierarchy(&mut graph, n3);

        let p1 = graph.get_node(n1).unwrap().position;
        let p2 = graph.get_node(n2).unwrap().position;
        let p3 = graph.get_node(n3).unwrap().position;
        let p4 = graph.get_node(n4).unwrap().position;
        let p5 = graph.get_node(n5).unwrap().position;

        // 1. Target node N3 remained anchored at its position (snapped to 24px grid)
        assert_eq!(p3[0], snap_to_grid(800.0));
        assert_eq!(p3[1], snap_to_grid(400.0));

        // 2. Upstream nodes flow Right-to-Left into N3
        assert!(p1[0] < p2[0], "N1.x < N2.x");
        assert!(p2[0] < p3[0], "N2.x < N3.x (upstream nodes placed to the left)");

        // 3. Downstream node N4 and unrelated node N5 remained COMPLETELY UNTOUCHED
        assert_eq!(p4, initial_n4_pos, "Downstream node N4 must not be moved");
        assert_eq!(p5, initial_n5_pos, "Unrelated node N5 must not be moved");

        // 4. Zero overlap among back hierarchy nodes
        assert_zero_node_overlaps(&graph);
    }

    #[test]
    fn test_contextual_auto_layout_with_selection() {
        let mut graph = crate::app::build_starter_graph();
        let target_node = NodeId(3); // NormalFlipGreen
        let unrelated_node = NodeId(5); // TextureOutput
        let initial_n5_pos = graph.get_node(unrelated_node).unwrap().position;

        // Run contextual layout with NodeId(3) selected
        auto_layout_graph_contextual(&mut graph, Some(target_node));

        // Node 5 is not upstream of Node 3, so Node 5 must remain in place
        assert_eq!(graph.get_node(unrelated_node).unwrap().position, initial_n5_pos);
    }
}
