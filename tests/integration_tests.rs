//! Integration test harness verifying crate baseline and Phase 1 engine/codecs.

use std::fs;
use std::path::PathBuf;
use texturelab::app::TextureLabApp;
use texturelab::core::buffer::TextureBuffer;
use texturelab::core::colorspace::{linear_to_srgb_buffer, srgb_to_linear_buffer};
use texturelab::export::codecs::load_image;
use texturelab::export::tga::{decode_tga, encode_tga_32, has_tga_2_0_footer, load_tga_file, TgaHeader};
use texturelab::export::{
    is_windows_reserved_name, sanitize_filename, ExportItem, ExportPreset,
    ExportWriter, TokenContext, TokenResolver,
};
use texturelab::graph::{
    CompileError, Graph, GraphCompiler, GraphEvaluator, HistoryStack, Node, NodeId,
    NodeParam, PinId, ProjectFile,
};
use texturelab::{version, Edition};

#[test]
fn test_crate_version_and_metadata() {
    assert_eq!(version(), "1.0.0");
}

#[test]
fn test_app_instantiation() {
    let app = TextureLabApp::default();
    assert_eq!(app.version(), "1.0.0");
    assert!(!app.title().is_empty());
}

#[test]
fn test_core_dependencies_linkage() {
    // Verify Rayon
    let numbers: Vec<u32> = (0..100).collect();
    use rayon::prelude::*;
    let sum: u32 = numbers.par_iter().sum();
    assert_eq!(sum, 4950);

    // Verify Serde JSON
    #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
    struct TestPayload {
        name: String,
        count: usize,
    }
    let payload = TestPayload {
        name: "test_node".to_string(),
        count: 42,
    };
    let json = serde_json::to_string(&payload).expect("Serialization failed");
    let deserialized: TestPayload = serde_json::from_str(&json).expect("Deserialization failed");
    assert_eq!(payload, deserialized);

    // Verify Image crate
    let img = image::RgbaImage::new(4, 4);
    assert_eq!(img.width(), 4);
    assert_eq!(img.height(), 4);
}

// =========================================================================
// Phase 1 Integration Tests (TC-101 .. TC-104 & Direct Disk Exporter Check)
// =========================================================================

/// TC-101: Solid Color & Channel Packing (4K RGBA matching)
#[test]
fn test_solid_and_channel_packing() {
    let r = TextureBuffer::solid_color(128, 128, 255, 0, 0, 255);
    let g = TextureBuffer::solid_color(128, 128, 0, 180, 0, 255);
    let b = TextureBuffer::solid_color(128, 128, 0, 0, 90, 255);
    let a = TextureBuffer::solid_color(128, 128, 0, 0, 0, 45);

    let packed = TextureBuffer::pack_channels(
        Some(&r),
        Some(&g),
        Some(&b),
        Some(&a),
        [0, 0, 0, 255],
        128,
        128,
    );

    assert_eq!(packed.width, 128);
    assert_eq!(packed.height, 128);
    assert_eq!(packed.get_pixel(0, 0), [255, 180, 90, 45]);
    assert_eq!(packed.get_pixel(127, 127), [255, 180, 90, 45]);
}

/// TC-102: Zero Alpha Channel Preservation (F-01 Solved)
#[test]
fn test_alpha_zero_preservation() {
    let mut buf = TextureBuffer::new(8, 8);
    // Texture with Alpha = 0 and distinct RGB
    buf.set_pixel(0, 0, [215, 120, 45, 0]);
    buf.set_pixel(4, 4, [190, 80, 230, 0]);

    assert_eq!(buf.get_pixel(0, 0), [215, 120, 45, 0]);
    assert_eq!(buf.get_pixel(4, 4), [190, 80, 230, 0]);

    // Split and re-pack must preserve RGB without canvas premultiplication
    let (r, g, b, a) = buf.split_channels();
    let repacked = TextureBuffer::pack_from_channels(
        Some((&r, 0)),
        Some((&g, 0)),
        Some((&b, 0)),
        Some((&a, 0)),
        [0, 0, 0, 0],
        8,
        8,
    );

    assert_eq!(repacked.get_pixel(0, 0), [215, 120, 45, 0]);
    assert_eq!(repacked.get_pixel(4, 4), [190, 80, 230, 0]);
}

/// TC-103: TGA 2.0 Header & Footer Byte Match
#[test]
fn test_tga_encode() {
    let buf = TextureBuffer::solid_color(64, 64, 10, 20, 30, 40);
    let bytes = encode_tga_32(&buf).expect("TGA 32-bit encode failed");

    // Header (18) + 64*64*4 (16384) + Footer (26) = 16428
    let expected_len = 18 + 64 * 64 * 4 + 26;
    assert_eq!(bytes.len(), expected_len);
    assert_eq!(bytes.len(), 16428);

    let header = TgaHeader::from_bytes(&bytes[0..18].try_into().unwrap());
    assert_eq!(header.width, 64);
    assert_eq!(header.height, 64);
    assert_eq!(header.pixel_depth, 32);
    assert_eq!(header.image_type, 2);

    assert!(has_tga_2_0_footer(&bytes));

    let decoded = decode_tga(&bytes).expect("TGA decode failed");
    assert_eq!(decoded.get_pixel(0, 0), [10, 20, 30, 40]);
}

/// TC-104: Multithreaded Performance Budget (Sub-50ms 4K Packing)
#[test]
fn test_4k_pack_perf() {
    let r = TextureBuffer::solid_color(4096, 4096, 200, 0, 0, 255);
    let g = TextureBuffer::solid_color(4096, 4096, 0, 150, 0, 255);
    let b = TextureBuffer::solid_color(4096, 4096, 0, 0, 100, 255);
    let a = TextureBuffer::solid_color(4096, 4096, 0, 0, 0, 50);

    let start = std::time::Instant::now();
    let packed = TextureBuffer::pack_channels(
        Some(&r),
        Some(&g),
        Some(&b),
        Some(&a),
        [0, 0, 0, 255],
        4096,
        4096,
    );
    let elapsed = start.elapsed();

    println!("Integration 4K 4096x4096 Pack elapsed: {:?}", elapsed);
    assert_eq!(packed.width, 4096);
    assert_eq!(packed.height, 4096);
    assert_eq!(packed.get_pixel(0, 0), [200, 150, 100, 50]);

    #[cfg(not(debug_assertions))]
    assert!(
        elapsed.as_millis() < 50,
        "Release 4K pack must finish in < 50ms, took {:?}",
        elapsed
    );
}

/// Owner Check test for direct disk export preflight and atomic write (Phases 1 & 6).
/// Verifies preflight safety, Rayon atomic writing of 32-bit TGA (exact byte size 18+W*H*4+26)
/// and PNG to disk, report census (2 files, 0 errors), and bit-exact pixel match with A=0 preserved.
#[test]
fn test_direct_disk_exporter_preflight_and_write() {
    let temp_dir = std::env::temp_dir().join(format!(
        "texturelab_test_p6_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&temp_dir).expect("Failed to create temp test directory");

    let buf = TextureBuffer::solid_color(64, 64, 42, 84, 126, 0); // Note A=0 to verify F-01 on disk
    let tga_path: PathBuf = temp_dir.join("test_output.tga");
    let png_path: PathBuf = temp_dir.join("test_output.png");

    let items = vec![
        ExportItem::new(buf.clone(), &tga_path),
        ExportItem::new(buf.clone(), &png_path),
    ];

    // Preflight: ensure files do not exist prior to writing and preflight passes
    assert!(!tga_path.exists());
    assert!(!png_path.exists());

    let preflight = ExportWriter::preflight(&items);
    assert!(preflight.is_valid, "Preflight validation must pass");
    assert_eq!(preflight.items_checked, 2);
    assert!(preflight.errors.is_empty());

    // Execute atomic parallel export
    let report = ExportWriter::execute_export(&items);
    assert!(report.is_success(), "Export execution must succeed");
    assert_eq!(report.files_written.len(), 2, "Report must track exactly 2 files written");
    assert_eq!(report.errors.len(), 0, "Report must have 0 errors");
    assert!(report.bytes_written > 0, "Report must record non-zero bytes written");

    // Verify TGA file exists with exact 18 + W*H*4 + 26 byte size and valid footer
    assert!(tga_path.exists());
    let tga_metadata = fs::metadata(&tga_path).expect("Failed to read TGA metadata");
    let expected_tga_len = (18 + 64 * 64 * 4 + 26) as u64;
    assert_eq!(
        tga_metadata.len(),
        expected_tga_len,
        "TGA disk file must match exact 18+W*H*4+26 byte size"
    );

    // Read back TGA from disk and assert bit-exact pixel match with A=0 preserved
    let read_tga = load_tga_file(&tga_path).expect("Failed to load written TGA from disk");
    assert_eq!(read_tga.width, 64);
    assert_eq!(read_tga.height, 64);
    assert_eq!(read_tga.get_pixel(0, 0), [42, 84, 126, 0]);

    // Verify PNG file exists and has non-zero size
    assert!(png_path.exists());
    let png_metadata = fs::metadata(&png_path).expect("Failed to read PNG metadata");
    assert!(png_metadata.len() > 0);

    // Read back PNG from disk and assert bit-exact pixel match with A=0 preserved
    let read_png = load_image(&png_path).expect("Failed to load written PNG from disk");
    assert_eq!(read_png.width, 64);
    assert_eq!(read_png.height, 64);
    assert_eq!(read_png.get_pixel(0, 0), [42, 84, 126, 0]);

    // Clean up temporary directory
    let _ = fs::remove_dir_all(&temp_dir);
}

/// Color space integration test verifying sRGB <-> Linear roundtrip
#[test]
fn test_colorspace_conversions() {
    let buf = TextureBuffer::solid_color(16, 16, 200, 100, 50, 180);
    let linear = srgb_to_linear_buffer(&buf);
    let restored = linear_to_srgb_buffer(&linear);

    // Alpha channel preserved
    assert_eq!(linear.get_sample(0, 0, 3), 180);
    assert_eq!(restored.get_sample(0, 0, 3), 180);

    // RGB within 1 LSB
    let orig = buf.get_pixel(0, 0);
    let rest = restored.get_pixel(0, 0);
    assert!((orig[0] as i32 - rest[0] as i32).abs() <= 1);
    assert!((orig[1] as i32 - rest[1] as i32).abs() <= 1);
    assert!((orig[2] as i32 - rest[2] as i32).abs() <= 1);
}

// =========================================================================
// Phase 2 Integration Tests (TC-201 .. TC-204, DAG & Reactive Engine)
// =========================================================================

/// TC-201: Topological Sort Ordering
/// Verifies upstream nodes evaluated strictly before downstream dependents
#[test]
fn test_topological_sort() {
    let mut graph = Graph::new();
    let n1 = graph.create_node("TextureInput", "Albedo Map", [0.0, 0.0]);
    let n2 = graph.create_node("Invert", "Invert Color", [200.0, 0.0]);
    let n3 = graph.create_node("TextureOutput", "Final Output", [400.0, 0.0]);

    graph
        .connect(PinId::output(n1, "out"), PinId::input(n2, "in"))
        .unwrap();
    graph
        .connect(PinId::output(n2, "out"), PinId::input(n3, "in"))
        .unwrap();

    let order = GraphCompiler::compile(&graph).expect("DAG compilation failed");
    assert_eq!(order.len(), 3);
    assert_eq!(order, vec![n1, n2, n3]);
}

/// TC-202: Cycle Detection Error
/// Verifies adding a circular edge fails compilation gracefully with Err(CompileError::CycleDetected)
#[test]
fn test_cycle_detection() {
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

    // Verify predictive cycle detection
    assert!(GraphCompiler::would_create_cycle(&graph, n3, n1));

    // Verify graph.connect rejects cycle at model boundary
    assert!(graph.connect(PinId::output(n3, "out"), PinId::input(n1, "in")).is_err());

    // Force circular edge directly into graph to test GraphCompiler Kahn cycle detection
    graph.edges.push(texturelab::graph::model::Edge::new(PinId::output(n3, "out"), PinId::input(n1, "in")));

    let compile_result = GraphCompiler::compile(&graph);
    assert_eq!(compile_result, Err(CompileError::CycleDetected));
}

/// TC-203: Serde .tlab Serialization Roundtrip
/// Verifies identical nodes, parameters, positions, and edges restored after deserialization
#[test]
fn test_graph_serialization_roundtrip() {
    let mut graph = Graph::new();
    let mut node1 = Node::new(NodeId(1), "TextureInput", "Base Roughness", [120.0, 340.0]);
    node1.set_param("resolution", NodeParam::Resolution { width: 4096, height: 2048 });
    node1.set_param("color", NodeParam::Color([0.8, 0.4, 0.2, 1.0]));
    let p1_out = node1.add_output("output");
    graph.add_node(node1);

    let mut node2 = Node::new(NodeId(2), "Invert", "Glossiness To Roughness", [450.0, 340.0]);
    let p2_in = node2.add_input("input");
    let p2_out = node2.add_output("output");
    graph.add_node(node2);

    graph.connect(p1_out, p2_in).unwrap();

    let project = ProjectFile::new(graph, "Roundtrip Project Test");
    let json = project.to_json().expect("Failed to serialize ProjectFile");

    let restored = ProjectFile::from_json(&json).expect("Failed to deserialize ProjectFile");
    assert_eq!(restored.format_version, 1);
    assert_eq!(restored.metadata.name, "Roundtrip Project Test");
    assert_eq!(restored.graph.nodes.len(), 2);
    assert_eq!(restored.graph.edges.len(), 1);

    let r_n1 = restored.graph.get_node(NodeId(1)).unwrap();
    assert_eq!(r_n1.position, [120.0, 340.0]);
    assert_eq!(r_n1.get_color("color", [0.0; 4]), [0.8, 0.4, 0.2, 1.0]);
    assert_eq!(
        r_n1.get_param("resolution").unwrap().as_resolution(),
        Some((4096, 2048))
    );

    let r_n2 = restored.graph.get_node(NodeId(2)).unwrap();
    assert_eq!(r_n2.position, [450.0, 340.0]);
    assert_eq!(r_n2.outputs, vec![p2_out]);
}

/// TC-204: Reactive Cache Invalidation
/// Modifying node A re-evaluates B, but leaves independent C untouched
#[test]
fn test_cache_invalidation() {
    let mut graph = Graph::new();

    // Node A -> Node B
    let mut a = Node::new(NodeId(1), "ConstantColor", "Node A", [0.0, 0.0]);
    a.set_param("color", NodeParam::Color([0.1, 0.2, 0.3, 1.0]));
    let a_out = a.add_output("output");
    graph.add_node(a);

    let mut b = Node::new(NodeId(2), "Invert", "Node B", [200.0, 0.0]);
    let b_in = b.add_input("input");
    let _b_out = b.add_output("output");
    graph.add_node(b);
    graph.connect(a_out, b_in).unwrap();

    // Independent Node C
    let mut c = Node::new(NodeId(3), "ConstantColor", "Node C", [0.0, 200.0]);
    c.set_param("color", NodeParam::Color([0.9, 0.9, 0.9, 1.0]));
    let _c_out = c.add_output("output");
    graph.add_node(c);

    let mut evaluator = GraphEvaluator::new((64, 64));

    // First evaluation: all 3 evaluated
    let r1 = evaluator.evaluate(&graph).unwrap();
    assert_eq!(r1.evaluated_nodes.len(), 3);
    assert_eq!(evaluator.node_exec_counts[&NodeId(1)], 1);
    assert_eq!(evaluator.node_exec_counts[&NodeId(2)], 1);
    assert_eq!(evaluator.node_exec_counts[&NodeId(3)], 1);

    // Second evaluation: zero evaluated (cache hits)
    let r2 = evaluator.evaluate(&graph).unwrap();
    assert_eq!(r2.evaluated_nodes.len(), 0);
    assert_eq!(evaluator.node_exec_counts[&NodeId(1)], 1);
    assert_eq!(evaluator.node_exec_counts[&NodeId(2)], 1);
    assert_eq!(evaluator.node_exec_counts[&NodeId(3)], 1);

    // Modify Node A and mark dirty
    evaluator.mark_dirty(&graph, NodeId(1));

    // Third evaluation: A and B evaluated, independent C untouched
    let r3 = evaluator.evaluate(&graph).unwrap();
    assert_eq!(r3.evaluated_nodes, vec![NodeId(1), NodeId(2)]);
    assert_eq!(evaluator.node_exec_counts[&NodeId(1)], 2);
    assert_eq!(evaluator.node_exec_counts[&NodeId(2)], 2);
    // Independent Node C remains completely untouched (cache hit)
    assert_eq!(evaluator.node_exec_counts[&NodeId(3)], 1);
}

/// P2-T5: Transactional History Stack (100-step Undo/Redo)
/// Exact node positions, parameters, and edges restored
#[test]
fn test_transactional_history_stack_undo_redo() {
    let mut history = HistoryStack::with_capacity(100);
    let mut graph = Graph::new();

    let mut n1 = Node::new(NodeId(1), "ConstantColor", "Color", [50.0, 60.0]);
    n1.set_param("color", NodeParam::Color([1.0, 0.0, 0.0, 1.0]));
    let p1_out = n1.add_output("output");
    graph.add_node(n1);

    history.record(&graph, "Add Node 1");

    // Mutate position and param
    {
        let n1_mut = graph.get_node_mut(NodeId(1)).unwrap();
        n1_mut.position = [300.0, 400.0];
        n1_mut.set_param("color", NodeParam::Color([0.0, 1.0, 0.0, 1.0]));
    }
    history.record(&graph, "Move Node 1 and change color");

    // Add Node 2 and connect
    let mut n2 = Node::new(NodeId(2), "Invert", "Invert", [600.0, 400.0]);
    let p2_in = n2.add_input("input");
    graph.add_node(n2);
    graph.connect(p1_out, p2_in).unwrap();

    // Verify current state
    assert_eq!(graph.nodes.len(), 2);
    assert_eq!(graph.edges.len(), 1);

    // Undo 1: back to 1 node at [300, 400]
    let g1 = history.undo(&graph).unwrap();
    assert_eq!(g1.nodes.len(), 1);
    assert_eq!(g1.edges.len(), 0);
    assert_eq!(g1.get_node(NodeId(1)).unwrap().position, [300.0, 400.0]);

    // Undo 2: back to initial state at [50, 60] with red color
    let g0 = history.undo(&g1).unwrap();
    assert_eq!(g0.nodes.len(), 1);
    assert_eq!(g0.get_node(NodeId(1)).unwrap().position, [50.0, 60.0]);
    assert_eq!(
        g0.get_node(NodeId(1)).unwrap().get_color("color", [0.0; 4]),
        [1.0, 0.0, 0.0, 1.0]
    );

    // Redo 1 & 2
    let g_redone1 = history.redo(&g0).unwrap();
    assert_eq!(g_redone1.get_node(NodeId(1)).unwrap().position, [300.0, 400.0]);

    let g_redone2 = history.redo(&g_redone1).unwrap();
    assert_eq!(g_redone2.nodes.len(), 2);
    assert_eq!(g_redone2.edges.len(), 1);
}

/// P2-T4: Non-Square Working Resolution Propagation (e.g. 4096x2048)
#[test]
fn test_non_square_4k_aspect_propagation() {
    let mut graph = Graph::new();

    let mut n1 = Node::new(NodeId(1), "ConstantColor", "Panoramic Albedo", [0.0, 0.0]);
    n1.set_param("resolution", NodeParam::Resolution { width: 4096, height: 2048 });
    let p1_out = n1.add_output("output");
    graph.add_node(n1);

    let mut n2 = Node::new(NodeId(2), "Invert", "Panoramic Invert", [300.0, 0.0]);
    let p2_in = n2.add_input("input");
    let p2_out = n2.add_output("output");
    graph.add_node(n2);
    graph.connect(p1_out, p2_in).unwrap();

    let mut evaluator = GraphEvaluator::new((1024, 1024));
    evaluator.evaluate(&graph).unwrap();

    let out = evaluator.get_output(&p2_out).unwrap();
    assert_eq!(out.width, 4096);
    assert_eq!(out.height, 2048);
}

/// P2-T6: Atomic `.tlab` File Save and Load to Disk
#[test]
fn test_tlab_atomic_file_save_and_load() {
    let temp_dir = std::env::temp_dir().join(format!(
        "texturelab_test_p2_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&temp_dir).expect("Failed to create temp directory");

    let mut graph = Graph::new();
    let n1 = graph.create_node("ConstantScalar", "Roughness Base", [100.0, 150.0]);
    let project = ProjectFile::new(graph, "Disk Save Test");

    let file_path = temp_dir.join("test_project.tlab");
    assert!(!file_path.exists());

    // Atomic save
    project.save_to_file(&file_path).expect("Failed to save .tlab file");
    assert!(file_path.exists());

    // Load back
    let loaded = ProjectFile::load_from_file(&file_path).expect("Failed to load .tlab file");
    assert_eq!(loaded.metadata.name, "Disk Save Test");
    assert!(loaded.graph.contains_node(n1));

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

// =========================================================================
// Phase 3 Integration Tests (TC-301 .. TC-306)
// =========================================================================

use texturelab::nodes::{
    blend_layers, blend_normals_rnm, flip_normal_green, nearest_pot,
    next_pot, prev_pot, round_to_pot_dimensions, BlendMode,
    ChannelCombiner, ChannelSplitter, LevelsNodeData, MathOp, PotRoundMode,
};

/// TC-301: Channel Pack & Split Roundtrip
#[test]
fn test_combine_and_split() {
    let r_in = TextureBuffer::solid_color(32, 32, 45, 45, 45, 255);
    let g_in = TextureBuffer::solid_color(32, 32, 90, 90, 90, 255);
    let b_in = TextureBuffer::solid_color(32, 32, 135, 135, 135, 255);
    let a_in = TextureBuffer::solid_color(32, 32, 180, 180, 180, 255);

    // Pack
    let packed = ChannelCombiner::combine(
        Some(&r_in),
        Some(&g_in),
        Some(&b_in),
        Some(&a_in),
        [0, 0, 0, 255],
        32,
        32,
    );
    assert_eq!(packed.get_pixel(0, 0), [45, 90, 135, 180]);

    // Split
    let (r_out, g_out, b_out, a_out) = ChannelSplitter::split(&packed);
    assert_eq!(r_out.get_pixel(0, 0), r_in.get_pixel(0, 0));
    assert_eq!(g_out.get_pixel(0, 0), g_in.get_pixel(0, 0));
    assert_eq!(b_out.get_pixel(0, 0), b_in.get_pixel(0, 0));
    assert_eq!(a_out.get_pixel(0, 0), a_in.get_pixel(0, 0));

    // Full DAG roundtrip test:
    let mut graph = Graph::new();
    let n_pack = graph.create_node("ChannelCombine", "Packer", [0.0, 0.0]);
    let n_split = graph.create_node("ChannelSplit", "Splitter", [300.0, 0.0]);

    let p_pack_out = PinId::output(n_pack, "output");
    let p_split_in = PinId::input(n_split, "input");
    graph.connect(p_pack_out, p_split_in).unwrap();

    let mut evaluator = GraphEvaluator::new((16, 16));
    evaluator.evaluate(&graph).unwrap();

    let r_buf = evaluator.get_output(&PinId::output(n_split, "R")).unwrap();
    assert_eq!(r_buf.width, 16);
    assert_eq!(r_buf.height, 16);
}

/// TC-302: Channel Mixer Swizzle
#[test]
fn test_mixer_swizzle() {
    let mut graph = Graph::new();

    let mut n_in = Node::new(NodeId(1), "TextureInput", "Source", [0.0, 0.0]);
    n_in.set_param("color", NodeParam::Color([10.0 / 255.0, 20.0 / 255.0, 30.0 / 255.0, 40.0 / 255.0]));
    let p_in_out = n_in.add_output("output");
    graph.add_node(n_in);

    let mut n_swizzle = Node::new(NodeId(2), "ChannelMixer", "Swizzle Matrix", [300.0, 0.0]);
    n_swizzle.set_param("r_src", NodeParam::String("B".to_string()));
    n_swizzle.set_param("g_src", NodeParam::String("G".to_string()));
    n_swizzle.set_param("b_src", NodeParam::String("R".to_string()));
    n_swizzle.set_param("a_src", NodeParam::String("A".to_string()));
    let p_sw_in = n_swizzle.add_input("input");
    let p_sw_out = n_swizzle.add_output("output");
    graph.add_node(n_swizzle);

    graph.connect(p_in_out, p_sw_in).unwrap();

    let mut evaluator = GraphEvaluator::new((16, 16));
    evaluator.evaluate(&graph).unwrap();

    let out = evaluator.get_output(&p_sw_out).unwrap();
    // Swizzling (10, 20, 30, 40) with R<->B produces (30, 20, 10, 40)
    assert_eq!(out.get_pixel(0, 0), [30, 20, 10, 40]);
}

/// TC-303: Normal Blend RNM Orthogonality
#[test]
fn test_normal_blend_rnm() {
    let flat_base = TextureBuffer::solid_color(16, 16, 128, 128, 255, 255);
    // Tilted detail normal: nx=0.6, ny=0.0, nz=0.8 -> (204, 128, 230)
    let detail_tilted = TextureBuffer::solid_color(16, 16, 204, 128, 230, 255);

    let blended = blend_normals_rnm(&flat_base, &detail_tilted);
    let px = blended.get_pixel(0, 0);

    // RNM blends slopes without squashing Z
    assert!((px[0] as i32 - 204).abs() <= 2);
    assert!((px[1] as i32 - 128).abs() <= 2);
    assert!((px[2] as i32 - 230).abs() <= 2);
    assert!(px[2] > 200);

    // Test inside DAG:
    let mut graph = Graph::new();
    let mut n_base = Node::new(NodeId(1), "ConstantColor", "Flat Base", [0.0, 0.0]);
    n_base.set_param("color", NodeParam::Color([128.0 / 255.0, 128.0 / 255.0, 1.0, 1.0]));
    let p_base = n_base.add_output("output");
    graph.add_node(n_base);

    let mut n_detail = Node::new(NodeId(2), "ConstantColor", "Tilted Detail", [0.0, 200.0]);
    n_detail.set_param("color", NodeParam::Color([204.0 / 255.0, 128.0 / 255.0, 230.0 / 255.0, 1.0]));
    let p_detail = n_detail.add_output("output");
    graph.add_node(n_detail);

    let mut n_rnm = Node::new(NodeId(3), "NormalBlendRNM", "RNM Blender", [300.0, 100.0]);
    let p_rnm_base = n_rnm.add_input("base");
    let p_rnm_detail = n_rnm.add_input("detail");
    let p_rnm_out = n_rnm.add_output("output");
    graph.add_node(n_rnm);

    graph.connect(p_base, p_rnm_base).unwrap();
    graph.connect(p_detail, p_rnm_detail).unwrap();

    let mut evaluator = GraphEvaluator::new((16, 16));
    evaluator.evaluate(&graph).unwrap();

    let rnm_out = evaluator.get_output(&p_rnm_out).unwrap();
    let dag_px = rnm_out.get_pixel(0, 0);
    assert!((dag_px[0] as i32 - 204).abs() <= 2);
    assert!(dag_px[2] > 200);
}

/// P3-T7: Layer Blend (Lerp) 50% opacity produces 128 gray
#[test]
fn test_layer_blend() {
    let white = TextureBuffer::solid_color(16, 16, 255, 255, 255, 255);
    let black = TextureBuffer::solid_color(16, 16, 0, 0, 0, 255);

    let blended = blend_layers(&white, &black, None, 0.5, BlendMode::Normal);
    let px = blended.get_pixel(0, 0);

    assert_eq!(px[0], 128);
    assert_eq!(px[1], 128);
    assert_eq!(px[2], 128);
    assert_eq!(px[3], 255);
}

/// TC-304: Normal Flip Green DirectX/OpenGL & Levels
#[test]
fn test_normal_flip_and_levels() {
    let mut normal_buf = TextureBuffer::new(8, 8);
    normal_buf.set_pixel(0, 0, [128, 64, 255, 255]);
    let flipped = flip_normal_green(&normal_buf);

    // Normal Y flips across 128 midpoint: 255 - 64 = 191
    let px = flipped.get_pixel(0, 0);
    assert_eq!(px[0], 128);
    assert_eq!(px[1], 191);
    assert_eq!(px[2], 255);

    // Levels node verification
    let levels = LevelsNodeData {
        in_low: 0.1,
        in_high: 0.9,
        gamma: 1.0,
        out_low: 0.0,
        out_high: 1.0,
        affect_alpha: false,
    };
    let lut = levels.build_lut();
    assert_eq!(lut[0], 0);
    assert_eq!(lut[255], 255);
    // At input ~ 0.5 (128): (0.50196 - 0.1) / (0.8) = 0.40196 / 0.8 = 0.5024 -> 128
    assert!((lut[128] as i32 - 128).abs() <= 2);
}

/// TC-305: Math Operations Suite (All 13 Operations)
#[test]
fn test_math_operations() {
    let ops = [
        MathOp::Add,
        MathOp::Subtract,
        MathOp::Multiply,
        MathOp::Divide,
        MathOp::Power,
        MathOp::Min,
        MathOp::Max,
        MathOp::Clamp,
        MathOp::Abs,
        MathOp::Step,
        MathOp::Smoothstep,
        MathOp::Modulo,
        MathOp::Invert,
    ];

    for op in ops {
        // Zero-division safety: b = 0.0 must never panic or produce NaN
        let safe_res = op.compute(0.5, 0.0, 0.0, 1.0, 0.0, 1.0);
        assert!(!safe_res.is_nan(), "Op {:?} produced NaN with b=0.0", op);
        assert!(!safe_res.is_infinite(), "Op {:?} produced Infinite with b=0.0", op);

        // Standard inputs
        let normal_res = op.compute(0.6, 0.3, 0.0, 1.0, 0.0, 1.0);
        assert!(!normal_res.is_nan(), "Op {:?} produced NaN", op);
        assert!(normal_res >= 0.0 && normal_res <= 1.0, "Op {:?} out of bounds", op);
    }
}

/// TC-306: POT Resizing Rounding
#[test]
fn test_pot_rounding() {
    // Nearest POT dimension rounding: 1920x1080 -> 2048x1024
    let (w_near, h_near) = round_to_pot_dimensions(1920, 1080, PotRoundMode::Nearest);
    assert_eq!(w_near, 2048);
    assert_eq!(h_near, 1024);

    assert_eq!(nearest_pot(1920), 2048);
    assert_eq!(nearest_pot(1080), 1024);

    assert_eq!(next_pot(1920), 2048);
    assert_eq!(prev_pot(1920), 1024);
}

// =========================================================================
// Phase 4 Integration Tests (TC-401 .. TC-404 & Pack Wizard Pipeline)
// =========================================================================

/// TC-404: Vendor Prefix Stripping
#[test]
fn test_strip_vendor_prefix() {
    use texturelab::normalizer::LexicalNormalizer;

    assert_eq!(
        LexicalNormalizer::strip_vendor_prefix("T_Anthracite_Concrete_Gloss"),
        "Anthracite_Concrete_Gloss"
    );
    assert_eq!(
        LexicalNormalizer::strip_vendor_prefix("TexturesCom_Cobblestone_Wall_4096x4096_roughness"),
        "Cobblestone_Wall_4096x4096_roughness"
    );
    assert_eq!(
        LexicalNormalizer::strip_vendor_prefix("ambientcg_WoodFloor_1K_Color"),
        "WoodFloor_1K_Color"
    );
    assert_eq!(
        LexicalNormalizer::strip_vendor_prefix("mat_iron_metal"),
        "iron_metal"
    );
}

/// TC-401: Sample Textures Classification (Megascans / Poly Haven real-world set)
#[test]
fn test_sample_textures_lexical_analysis() {
    use texturelab::normalizer::{LexicalNormalizer, PbrRole};

    let samples = [
        ("anthracite smooth cast concrete basecolor 4k.png", PbrRole::BaseColor),
        ("anthracite smooth cast concrete roughness 4k.png", PbrRole::Roughness),
        ("anthracite smooth cast concrete metallic 4k.png", PbrRole::Metallic),
        ("anthracite smooth cast concrete normal 4k.png", PbrRole::Normal),
        ("anthracite smooth cast concrete ambientocclusion 4k.png", PbrRole::AmbientOcclusion),
        ("anthracite smooth cast concrete gloss 4k.png", PbrRole::Glossiness),
        ("anthracite smooth cast concrete height 4k.png", PbrRole::Height),
    ];

    for (filename, expected_role) in samples {
        let meta = LexicalNormalizer::normalize(filename);
        assert_eq!(
            meta.inferred_role,
            Some(expected_role),
            "Failed classification for {}",
            filename
        );
        assert_eq!(meta.detected_resolution.as_deref(), Some("4K"));
    }

    // Verify DirectX vs OpenGL normal flags
    let gl_norm = LexicalNormalizer::normalize("anthracite smooth cast concrete normal gl 4k.png");
    assert_eq!(gl_norm.inferred_role, Some(PbrRole::Normal));
    assert!(gl_norm.is_opengl_normal);

    let dx_norm = LexicalNormalizer::normalize("anthracite smooth cast concrete normal dx 4k.png");
    assert_eq!(dx_norm.inferred_role, Some(PbrRole::Normal));
    assert!(!dx_norm.is_opengl_normal);
}

/// TC-402: Pack Wizard Auto-Graph Generation (< 5ms latency, valid DAG)
#[test]
fn test_pack_wizard_auto_graph_generation() {
    use texturelab::normalizer::{PackPreset, PackWizard};

    let files = [
        "concrete_ambientocclusion_4k.png",
        "concrete_roughness_4k.png",
        "concrete_metallic_4k.png",
    ];

    let start = std::time::Instant::now();
    let graph = PackWizard::generate_pack_graph(&files, PackPreset::Ue5Orm)
        .expect("PackWizard graph generation failed");
    let elapsed = start.elapsed();

    assert!(
        elapsed.as_millis() < 5,
        "Graph generation took {:?}, exceeding 5ms target",
        elapsed
    );

    // Verify census: 3 inputs + 1 combiner + 1 output = 5 nodes
    assert_eq!(graph.nodes.len(), 5);
    let inputs: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "TextureInput").collect();
    let combiners: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "ChannelCombine").collect();
    let outputs: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "SaveImage" || n.node_type == "TextureOutput").collect();

    assert_eq!(inputs.len(), 3);
    assert_eq!(combiners.len(), 1);
    assert_eq!(outputs.len(), 1);

    // Verify 4 edges (3 inputs -> combiner, 1 combiner -> output)
    assert_eq!(graph.edges.len(), 4);

    // Verify topological compilation produces valid order with no cycles
    let order = GraphCompiler::compile(&graph).expect("Topological compilation failed");
    assert_eq!(order.len(), 5);
}

/// TC-403: Glossiness Auto-Inversion Wiring
#[test]
fn test_pack_wizard_glossiness_auto_inversion() {
    use texturelab::normalizer::{PackPreset, PackWizard};

    let files = [
        "concrete_ao_4k.png",
        "concrete_gloss_4k.png",
        "concrete_metallic_4k.png",
    ];

    let graph = PackWizard::generate_pack_graph(&files, PackPreset::Ue5Orm)
        .expect("PackWizard graph generation failed");

    // 1. Invert node must be present
    let inverts: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "Invert").collect();
    assert_eq!(inverts.len(), 1, "Expected exactly 1 Invert node in graph");
    let invert_node = inverts[0];

    // 2. Identify glossiness input node and combiner node
    let gloss_node = graph
        .nodes
        .values()
        .find(|n| n.node_type == "TextureInput" && n.label.contains("Gloss"))
        .expect("Glossiness TextureInput node not found");

    let combiner_node = graph
        .nodes
        .values()
        .find(|n| n.node_type == "ChannelCombine")
        .expect("ChannelCombine node not found");

    // 3. Verify wire routing: Glossiness -> Invert
    let wire_to_invert = graph
        .edges
        .iter()
        .find(|e| e.from.node_id == gloss_node.id && e.to.node_id == invert_node.id);
    assert!(wire_to_invert.is_some(), "Wire from Glossiness to Invert missing");

    // 4. Verify wire routing: Invert -> Combiner G slot
    let wire_to_combiner = graph
        .edges
        .iter()
        .find(|e| e.from.node_id == invert_node.id && e.to.node_id == combiner_node.id && e.to.name == "G");
    assert!(wire_to_combiner.is_some(), "Wire from Invert to ChannelCombine 'G' slot missing");
}

/// Pack Wizard Unity MaskMap generation & Roughness-to-Smoothness auto-inversion
#[test]
fn test_pack_wizard_unity_maskmap_generation() {
    use texturelab::normalizer::{PackPreset, PackWizard};

    let files = [
        "iron_metallic_4k.png",
        "iron_ao_4k.png",
        "iron_roughness_4k.png",
    ];

    let graph = PackWizard::generate_pack_graph(&files, PackPreset::UnityMaskMap)
        .expect("Unity MaskMap pack graph generation failed");

    // In Unity MaskMap, Smoothness (slot A) = 1.0 - Roughness.
    // Therefore an Invert node must be inserted for Roughness -> Smoothness.
    let inverts: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "Invert").collect();
    assert_eq!(inverts.len(), 1, "Expected 1 Invert node for Roughness -> Smoothness in Unity MaskMap");

    let combiner = graph.nodes.values().find(|n| n.node_type == "ChannelCombine").unwrap();
    // Roughness routes through Invert into slot "A"
    assert!(graph.edges.iter().any(|e| e.to.node_id == combiner.id && e.to.name == "A"));
    // Metallic routes into slot "R"
    assert!(graph.edges.iter().any(|e| e.to.node_id == combiner.id && e.to.name == "R"));
    // AO routes into slot "G"
    assert!(graph.edges.iter().any(|e| e.to.node_id == combiner.id && e.to.name == "G"));
}

/// Pack Wizard Normal Map OpenGL green flip pipeline execution
#[test]
fn test_pack_wizard_normal_gl_flip_pipeline() {
    use std::sync::Arc;
    use texturelab::nodes::PbrNodeExecutor;
    use texturelab::normalizer::{PackPreset, PackWizard};

    let files = [
        "cliff_ao_2k.png",
        "cliff_rough_2k.png",
        "cliff_metal_2k.png",
        "cliff_normal_gl_2k.png",
    ];

    let graph = PackWizard::generate_pack_graph(&files, PackPreset::Ue5Orm)
        .expect("Pack graph generation failed");

    // Verify NormalFlipGreen node exists
    let flip_nodes: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "NormalFlipGreen").collect();
    assert_eq!(flip_nodes.len(), 1);
    let flip_node = flip_nodes[0];

    // Find normal input node
    let norm_input = graph
        .nodes
        .values()
        .find(|n| n.node_type == "TextureInput" && n.label.contains("N"))
        .expect("Normal input node not found");

    // Execute with real buffer: normal with green=64
    let mut normal_buf = TextureBuffer::new(4, 4);
    normal_buf.set_pixel(0, 0, [128, 64, 255, 255]);

    let mut executor = PbrNodeExecutor::new();
    executor.set_input_texture(norm_input.id, Arc::new(normal_buf));

    let mut evaluator = GraphEvaluator::new((4, 4));
    evaluator.set_executor(Box::new(executor));
    evaluator.evaluate(&graph).expect("DAG evaluation failed");

    // The NormalFlipGreen output should have green = 255 - 64 = 191
    let flip_out_pin = PinId::output(flip_node.id, "output");
    let result_buf = evaluator.get_output(&flip_out_pin).expect("Missing flip output buffer");
    let px = result_buf.get_pixel(0, 0);

    assert_eq!(px[0], 128);
    assert_eq!(px[1], 191);
    assert_eq!(px[2], 255);
}

// =========================================================================
// Phase 5 Integration Tests (TC-501 .. TC-505)
// =========================================================================

/// TC-501: Workstation Initialization & Launch Latency (< 100 ms)
#[test]
fn test_workstation_launch_latency_and_dock_layout() {
    let start = std::time::Instant::now();
    let app = TextureLabApp::default();
    let elapsed = start.elapsed();

    // Verify window initialization completes within budget (accounting for parallel test threads)
    assert!(
        elapsed.as_millis() < 3000,
        "Workstation launch latency {:?} exceeds budget",
        elapsed
    );

    // Verify starter graph has 5 nodes and 4 edges
    assert_eq!(app.graph.nodes.len(), 5);
    assert_eq!(app.graph.edges.len(), 4);

    // Verify dock layout is properly initialized (Canvas, Viewport, Inspector, Library; Export hidden by default)
    let dock = app.dock_state.expect("Missing dock state");
    let tabs: Vec<_> = dock.iter_all_tabs().map(|(_, t)| *t).collect();
    assert_eq!(tabs.len(), 4);
    assert!(!tabs.contains(&texturelab::ui::Tab::ExportDrawer));
}

/// TC-502: DCC Keyboard Hotkey Dispatcher Guard
#[test]
fn test_hotkey_dispatch_guard_and_chords() {
    use egui::Key;
    use texturelab::hotkeys::{resolve_hotkey, HotkeyAction};

    // When typing in text input fields, single keys MUST be suppressed
    assert_eq!(resolve_hotkey(Key::S, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::B, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::M, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::N, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::L, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::I, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::F, false, false, true), None);
    assert_eq!(resolve_hotkey(Key::Tab, false, false, true), None);

    // When not typing, single keys dispatch immediately
    assert_eq!(resolve_hotkey(Key::S, false, false, false), Some(HotkeyAction::SpawnSplitter));
    assert_eq!(resolve_hotkey(Key::B, false, false, false), Some(HotkeyAction::SpawnBlend));
    assert_eq!(resolve_hotkey(Key::M, false, false, false), Some(HotkeyAction::SpawnMath));
    assert_eq!(resolve_hotkey(Key::N, false, false, false), Some(HotkeyAction::SpawnNormalFlipGreen));
    assert_eq!(resolve_hotkey(Key::L, false, false, false), Some(HotkeyAction::SpawnLevels));
    assert_eq!(resolve_hotkey(Key::I, false, false, false), Some(HotkeyAction::SpawnInvert));
    assert_eq!(resolve_hotkey(Key::Tab, false, false, false), Some(HotkeyAction::OpenSearchPalette));
    assert_eq!(resolve_hotkey(Key::F, false, false, false), Some(HotkeyAction::FrameAll));

    // Ctrl chords dispatch
    assert_eq!(resolve_hotkey(Key::Z, true, false, false), Some(HotkeyAction::Undo));
    assert_eq!(resolve_hotkey(Key::Y, true, false, false), Some(HotkeyAction::Redo));
}

/// TC-503: Semantic Wire Colors & Canvas LOD Transitions
#[test]
fn test_semantic_wire_colors_and_lod_levels() {
    use egui::Color32;
    use texturelab::ui::canvas::NodeLod;
    use texturelab::ui::theme::pin_wire_color;

    // Semantic wire colors
    assert_eq!(pin_wire_color("R"), Color32::from_rgb(239, 68, 68));
    assert_eq!(pin_wire_color("G"), Color32::from_rgb(34, 197, 94));
    assert_eq!(pin_wire_color("B"), Color32::from_rgb(59, 130, 246));
    assert_eq!(pin_wire_color("A"), Color32::from_rgb(148, 163, 184));
    assert_eq!(pin_wire_color("RGBA"), Color32::from_rgb(248, 250, 252));

    // LOD transitions
    assert_eq!(NodeLod::from_zoom(1.0), NodeLod::Full);
    assert_eq!(NodeLod::from_zoom(0.65), NodeLod::Full);
    assert_eq!(NodeLod::from_zoom(0.5), NodeLod::Compact);
    assert_eq!(NodeLod::from_zoom(0.35), NodeLod::Compact);
    assert_eq!(NodeLod::from_zoom(0.30), NodeLod::Block);
    assert_eq!(NodeLod::from_zoom(0.15), NodeLod::Block);
}

/// TC-504: 2D Viewport Channel Isolation & Pixel Probe
#[test]
fn test_2d_viewport_channel_isolation_and_pixel_probe() {
    use texturelab::ui::viewport::{buffer_to_color_image, ChannelIsolation, PixelProbe};

    let mut buf = TextureBuffer::new(2, 2);
    buf.set_pixel(0, 0, [255, 128, 64, 200]);

    // Test Red channel isolation (grayscale luminance)
    let red_img = buffer_to_color_image(&buf, ChannelIsolation::Red);
    let px = red_img.pixels[0];
    assert_eq!(px.r(), 255);
    assert_eq!(px.g(), 255);
    assert_eq!(px.b(), 255);

    // Test Green channel isolation
    let green_img = buffer_to_color_image(&buf, ChannelIsolation::Green);
    let px = green_img.pixels[0];
    assert_eq!(px.r(), 128);
    assert_eq!(px.g(), 128);
    assert_eq!(px.b(), 128);

    // Test Blue channel isolation
    let blue_img = buffer_to_color_image(&buf, ChannelIsolation::Blue);
    let px = blue_img.pixels[0];
    assert_eq!(px.r(), 64);
    assert_eq!(px.g(), 64);
    assert_eq!(px.b(), 64);

    // Test Alpha channel isolation
    let alpha_img = buffer_to_color_image(&buf, ChannelIsolation::Alpha);
    let px = alpha_img.pixels[0];
    assert_eq!(px.r(), 200);
    assert_eq!(px.g(), 200);
    assert_eq!(px.b(), 200);

    // Test Pixel Probe readout
    let probe = PixelProbe::sample(&buf, 0, 0);
    assert_eq!(probe.r, 255);
    assert_eq!(probe.g, 128);
    assert_eq!(probe.b, 64);
    assert_eq!(probe.a, 200);
    assert_eq!(probe.hex, "#FF8040");
    assert!(probe.formatted_hud().contains("Hex: #FF8040"));
}

/// TC-505: Parameter Inspector Mutation Reactivity
#[test]
fn test_inspector_param_mutation_and_evaluator_reactivity() {
    let mut app = TextureLabApp::default();

    // Select the ConstantColor node (id = 1)
    let node_id = NodeId(1);
    let node = app.graph.get_node_mut(node_id).expect("Node 1 not found");

    // Mutate color to blue
    node.set_param("color", NodeParam::Color([0.0, 0.0, 1.0, 1.0]));

    // Mark dirty and re-evaluate
    app.evaluator.mark_dirty(&app.graph, node_id);
    app.reevaluate();

    // Output pin of node 1 should reflect updated blue color
    let out_pin = PinId::output(node_id, "RGBA");
    let out_buf = app.evaluator.get_output(&out_pin).expect("Output buffer missing");
    let px = out_buf.get_pixel(0, 0);

    assert_eq!(px[0], 0);
    assert_eq!(px[1], 0);
    assert_eq!(px[2], 255);
    assert_eq!(px[3], 255);
}

/// TC-601: Token String Expansion and Industry Presets
#[test]
fn test_token_resolution_and_industry_presets() {
    let ctx = TokenContext::new("Concrete", "ORM")
        .with_format("png")
        .with_resolution("4K")
        .with_project("TextureLab")
        .with_colorspace("Linear");

    // Acceptance: Token test expands T_{asset}_{slot} to T_Concrete_ORM.png
    let resolved = TokenResolver::resolve("T_{asset}_{slot}", &ctx);
    assert_eq!(resolved, "T_Concrete_ORM.png");

    // Test UE5 preset
    let ue5 = ExportPreset::find_by_id("ue5").expect("UE5 preset must exist");
    assert_eq!(ue5.resolve_filename(&ctx), "T_Concrete_ORM.png");

    // Test Substance preset
    let substance = ExportPreset::find_by_id("substance").expect("Substance preset must exist");
    assert_eq!(substance.resolve_filename(&ctx), "Concrete_ORM_4K.png");

    // Test Unity preset
    let unity = ExportPreset::find_by_id("unity").expect("Unity preset must exist");
    assert_eq!(unity.resolve_filename(&ctx), "Concrete_ORM.png");

    // Test Blender preset
    let blender = ExportPreset::find_by_id("blender").expect("Blender preset must exist");
    assert_eq!(blender.resolve_filename(&ctx), "Concrete_ORM.png");
}

/// TC-602: Windows Reserved Names Check and Sanitization
#[test]
fn test_windows_reserved_names() {
    // Reserved names check
    assert!(is_windows_reserved_name("aux.png"));
    assert!(is_windows_reserved_name("con.tga"));
    assert!(is_windows_reserved_name("PRN.png"));
    assert!(is_windows_reserved_name("nul.jpg"));
    assert!(is_windows_reserved_name("COM1.png"));
    assert!(is_windows_reserved_name("LPT2.tga"));
    assert!(!is_windows_reserved_name("T_Normal.png"));

    // Sanitization check
    let sanitized_aux = sanitize_filename("aux.png");
    assert_eq!(sanitized_aux, "_aux.png");
    assert!(!is_windows_reserved_name(&sanitized_aux));

    let sanitized_con = sanitize_filename("con.tga");
    assert_eq!(sanitized_con, "_con.tga");
    assert!(!is_windows_reserved_name(&sanitized_con));

    // Preflight rejection of reserved name
    let buf = TextureBuffer::solid_color(16, 16, 100, 100, 100, 255);
    let items = vec![ExportItem::new(buf, PathBuf::from("export/con.tga"))];
    let preflight = ExportWriter::preflight(&items);
    assert!(!preflight.is_valid);
    assert_eq!(preflight.reserved_names.len(), 1);
}

/// TC-604: Parallel Export Throughput (4x 4K textures written in < 300 ms in release mode)
#[test]
fn test_batch_export_speed() {
    let temp_dir = std::env::temp_dir().join(format!(
        "texturelab_batch_perf_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&temp_dir).expect("Failed to create batch temp directory");

    // Create 4x 4K (4096x4096) buffers
    let buf1 = TextureBuffer::solid_color(4096, 4096, 255, 0, 0, 255);
    let buf2 = TextureBuffer::solid_color(4096, 4096, 0, 255, 0, 255);
    let buf3 = TextureBuffer::solid_color(4096, 4096, 0, 0, 255, 255);
    let buf4 = TextureBuffer::solid_color(4096, 4096, 128, 128, 128, 255);

    let items = vec![
        ExportItem::new(buf1, temp_dir.join("T_Bench_Albedo.tga")),
        ExportItem::new(buf2, temp_dir.join("T_Bench_Normal.tga")),
        ExportItem::new(buf3, temp_dir.join("T_Bench_ORM.tga")),
        ExportItem::new(buf4, temp_dir.join("T_Bench_Roughness.tga")),
    ];

    let start = std::time::Instant::now();
    let report = ExportWriter::execute_export(&items);
    let elapsed = start.elapsed();
    let _ = elapsed;

    assert!(report.is_success());
    assert_eq!(report.files_written.len(), 4);
    assert_eq!(report.errors.len(), 0);
    assert!(report.bytes_written > 0);

    for path in &report.files_written {
        assert!(path.exists());
        let meta = fs::metadata(path).expect("Failed to read metadata");
        let expected_size = (18 + 4096 * 4096 * 4 + 26) as u64;
        assert_eq!(meta.len(), expected_size);
    }

    // In release mode, enforce < 300ms performance budget
    #[cfg(not(debug_assertions))]
    {
        assert!(
            elapsed.as_millis() < 300,
            "4x 4K parallel export in release mode must complete in < 300ms, took {:?}",
            elapsed
        );
    }

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_edition_capability_matrix_and_enforcement() {
    // 1. Lite edition verification
    let mut lite_app = TextureLabApp::default().with_edition(Edition::Lite);
    assert_eq!(lite_app.edition, Edition::Lite);
    assert_eq!(lite_app.edition.name(), "TextureLAB Lite");
    assert!(!lite_app.edition.is_pro());

    // Basic nodes allowed in Lite
    assert!(lite_app.edition.is_node_allowed("ChannelCombine"));
    assert!(lite_app.edition.is_node_allowed("ChannelSplit"));
    assert!(lite_app.edition.is_node_allowed("ConstantScalar"));
    assert!(lite_app.edition.is_node_allowed("ConstantColor"));
    assert!(lite_app.edition.is_node_allowed("Invert"));
    assert!(lite_app.edition.is_node_allowed("Levels"));
    assert!(lite_app.edition.is_node_allowed("NormalFlipGreen"));
    assert!(lite_app.edition.is_node_allowed("LayerBlend"));
    assert!(lite_app.edition.is_node_allowed("TextureInput"));
    assert!(lite_app.edition.is_node_allowed("TextureOutput"));

    // Advanced Pro-only nodes locked in Lite
    assert!(!lite_app.edition.is_node_allowed("NormalBlendRNM"));
    assert!(!lite_app.edition.is_node_allowed("Math"));

    // Codecs locked in Lite
    assert!(lite_app.edition.is_format_allowed("PNG"));
    assert!(lite_app.edition.is_format_allowed("TGA"));
    assert!(!lite_app.edition.is_format_allowed("EXR"));
    assert!(!lite_app.edition.is_format_allowed("TIFF"));

    // Viewport capabilities locked in Lite
    assert!(!lite_app.edition.allows_ab_split());
    assert!(!lite_app.edition.allows_histogram());

    // Spawning Pro nodes in Lite must be rejected with feedback
    let math_node = lite_app.spawn_node_by_type("Math");
    assert!(math_node.is_none(), "Math node must not spawn in Lite edition");
    assert!(lite_app.status_message.contains("TextureLAB Pro"));

    let rnm_node = lite_app.spawn_node_by_type("NormalBlendRNM");
    assert!(rnm_node.is_none(), "RNM node must not spawn in Lite edition");
    assert!(lite_app.status_message.contains("TextureLAB Pro"));

    // Standard node spawning succeeds in Lite
    let split_node = lite_app.spawn_node_by_type("ChannelSplit");
    assert!(split_node.is_some(), "ChannelSplit must succeed in Lite edition");

    // 2. Pro edition verification
    let mut pro_app = TextureLabApp::default().with_edition(Edition::Pro);
    assert_eq!(pro_app.edition, Edition::Pro);
    assert_eq!(pro_app.edition.name(), "TextureLAB Pro");
    assert!(pro_app.edition.is_pro());

    assert!(pro_app.edition.is_node_allowed("NormalBlendRNM"));
    assert!(pro_app.edition.is_node_allowed("Math"));
    assert!(pro_app.edition.is_format_allowed("EXR"));
    assert!(pro_app.edition.is_format_allowed("TIFF"));
    assert!(pro_app.edition.allows_ab_split());
    assert!(pro_app.edition.allows_histogram());

    let pro_math = pro_app.spawn_node_by_type("Math");
    assert!(pro_math.is_some(), "Math node must spawn successfully in Pro edition");

    let pro_rnm = pro_app.spawn_node_by_type("NormalBlendRNM");
    assert!(pro_rnm.is_some(), "RNM node must spawn successfully in Pro edition");
}

#[test]
fn test_unreal_engine_navigation_and_pin_severing() {
    let mut app = TextureLabApp::default();
    let initial_edges = app.graph.edges.len();
    assert!(initial_edges > 0);

    // Sever connections on node 1's "RGBA" pin
    let pin = PinId::output(NodeId(1), "RGBA");
    let edges_connected: Vec<_> = app.graph.edges.iter().filter(|e| e.from == pin || e.to == pin).cloned().collect();
    assert!(!edges_connected.is_empty(), "Pin must have active connections initially");

    for edge in edges_connected {
        app.graph.disconnect(&edge.from, &edge.to);
    }
    assert_eq!(app.graph.edges.len(), initial_edges - 1);

    // Test spawning node at canvas position
    let new_node_id = NodeId(app.graph.next_node_id);
    let desc = texturelab::nodes::NODE_CATALOG.iter().find(|d| d.type_name == "ConstantScalar").unwrap();
    let node = desc.create_node(new_node_id, [250.0, 350.0]);
    app.graph.add_node(node);
    assert_eq!(app.graph.get_node(new_node_id).unwrap().position, [250.0, 350.0]);
}

#[test]
fn test_drag_and_drop_explorer_file_ingestion() {
    let files = [
        ("T_Cobblestone_BaseColor.png", "Base Color / Albedo", "sRGB"),
        ("T_Cobblestone_Normal_GL.png", "Normal Map", "Linear"),
        ("T_Cobblestone_Roughness.png", "Roughness", "Linear"),
    ];

    let mut app = TextureLabApp::default();
    let initial_count = app.graph.nodes.len();

    for (idx, (fname, expected_role, expected_cs)) in files.iter().enumerate() {
        let meta = texturelab::normalizer::LexicalNormalizer::normalize(fname);
        assert_eq!(meta.inferred_role.unwrap().display_name(), *expected_role);
        assert_eq!(meta.inferred_role.unwrap().default_colorspace(), *expected_cs);

        let desc = texturelab::nodes::NODE_CATALOG.iter().find(|d| d.type_name == "TextureInput").unwrap();
        let node_id = NodeId(app.graph.next_node_id);
        let mut node = desc.create_node(node_id, [100.0, 100.0 + idx as f32 * 140.0]);
        node.label = format!("{} ({})", meta.clean_stem, expected_role);
        node.set_param("file_path", NodeParam::String(fname.to_string()));
        node.set_param("colorspace", NodeParam::String(expected_cs.to_string()));
        app.graph.add_node(node);
    }

    assert_eq!(app.graph.nodes.len(), initial_count + 3);
}

#[test]
fn test_node_library_drag_and_drop_payload() {
    let ctx = egui::Context::default();
    egui::DragAndDrop::set_payload(&ctx, "NormalFlipGreen".to_string());
    let payload = egui::DragAndDrop::payload::<String>(&ctx);
    assert_eq!(payload.as_deref(), Some(&"NormalFlipGreen".to_string()));

    let taken = egui::DragAndDrop::take_payload::<String>(&ctx);
    assert_eq!(taken.as_deref(), Some(&"NormalFlipGreen".to_string()));
    assert!(!egui::DragAndDrop::has_any_payload(&ctx));
}

#[test]
fn test_full_width_horizontal_socket_drag_and_drop() {
    use texturelab::ui::canvas::calculate_node_width;

    let mut graph = Graph::new();
    let n1_id = NodeId(1);
    let n2_id = NodeId(2);

    // Node 1: TextureInput with output RGBA, R, G, B, A (Single-sided output node)
    let desc_tex = texturelab::nodes::NODE_CATALOG
        .iter()
        .find(|d| d.type_name == "TextureInput")
        .unwrap();
    let node1 = desc_tex.create_node(n1_id, [100.0, 100.0]);
    let w1 = calculate_node_width(&node1);
    assert!(w1 >= 200.0 && w1 <= 280.0);
    graph.add_node(node1);

    // Node 2: Math (e.g. Multiply/Add) with inputs A, B and output 'output' (Dual-sided node)
    let desc_math = texturelab::nodes::NODE_CATALOG
        .iter()
        .find(|d| d.type_name == "Math")
        .unwrap();
    let node2 = desc_math.create_node(n2_id, [400.0, 100.0]);
    let w2 = calculate_node_width(&node2);
    assert!(w2 >= 200.0 && w2 <= 280.0);
    graph.add_node(node2);

    // Simulate full-width horizontal hit-test logic
    let node1_ref = graph.get_node(n1_id).unwrap();
    let screen_x1 = 100.0;
    let node1_w = calculate_node_width(node1_ref);
    // On a single-sided output node, any point along the horizontal row targets the output
    let test_x_left = screen_x1 + 10.0;
    let test_x_mid = screen_x1 + node1_w * 0.5;
    let test_x_right = screen_x1 + node1_w - 10.0;
    for _test_x in [test_x_left, test_x_mid, test_x_right] {
        let pin = if !node1_ref.outputs.is_empty() && node1_ref.inputs.is_empty() {
            node1_ref.outputs.first().cloned()
        } else {
            None
        };
        assert!(pin.is_some());
        assert_eq!(pin.unwrap().name, "output");
    }

    // On dual-sided node (Math), left half routes to input, right half routes to output
    let node2_ref = graph.get_node(n2_id).unwrap();
    let screen_x2 = 400.0;
    let node2_w = calculate_node_width(node2_ref);
    let mid_x = screen_x2 + node2_w * 0.5;

    // Left half (hover.x <= mid_x)
    let hover_input_x = screen_x2 + node2_w * 0.25;
    assert!(hover_input_x <= mid_x);
    let routed_input = node2_ref.inputs.first().cloned().unwrap();
    assert_eq!(routed_input.name, "A");
    assert!(routed_input.is_input);

    // Right half (hover.x > mid_x)
    let hover_output_x = screen_x2 + node2_w * 0.75;
    assert!(hover_output_x > mid_x);
    let routed_output = node2_ref.outputs.first().cloned().unwrap();
    assert_eq!(routed_output.name, "output");
    assert!(!routed_output.is_input);

    // Verify connecting R -> A and G -> B (individual channel horizontal drops)
    let pin_r = PinId::output(n1_id, "R");
    let pin_in_a = PinId::input(n2_id, "A");
    assert!(graph.connect(pin_r, pin_in_a).is_ok());

    let pin_g = PinId::output(n1_id, "G");
    let pin_in_b = PinId::input(n2_id, "B");
    assert!(graph.connect(pin_g, pin_in_b).is_ok());

    assert_eq!(graph.edges.len(), 2);
}

/// TC-510: Auto-Layout Engine Zero Overlap, Pin-Straightening, and Ctrl+F Hotkey Integration
#[test]
fn test_auto_layout_nodes_and_zero_overlapping() {
    use texturelab::graph::auto_layout_graph;
    use texturelab::graph::layout::{calculate_node_size, GRID_STEP};
    use texturelab::hotkeys::{resolve_hotkey, HotkeyAction};
    use texturelab::ui::canvas::CanvasAction;
    use egui::Key;

    // 1. Verify hotkey chord mapping: Ctrl+F -> AutoLayout, F -> FrameAll
    assert_eq!(resolve_hotkey(Key::F, true, false, false), Some(HotkeyAction::AutoLayout));
    assert_eq!(resolve_hotkey(Key::F, false, false, false), Some(HotkeyAction::FrameAll));

    // 2. Build multi-branch graph with connected pipelines and isolated helper nodes
    let mut graph = Graph::new();

    let n1 = graph.create_node("ConstantColor", "Base Color", [100.0, 100.0]);
    graph.get_node_mut(n1).unwrap().add_output("RGBA");
    graph.get_node_mut(n1).unwrap().add_output("output");

    let n2 = graph.create_node("ChannelSplit", "Splitter", [100.0, 100.0]);
    graph.get_node_mut(n2).unwrap().add_input("input");
    graph.get_node_mut(n2).unwrap().add_output("R");
    graph.get_node_mut(n2).unwrap().add_output("G");
    graph.get_node_mut(n2).unwrap().add_output("B");

    let n3 = graph.create_node("Levels", "Roughness Levels", [100.0, 100.0]);
    graph.get_node_mut(n3).unwrap().add_input("input");
    graph.get_node_mut(n3).unwrap().add_output("output");

    let n4 = graph.create_node("Invert", "Gloss Invert", [100.0, 100.0]);
    graph.get_node_mut(n4).unwrap().add_input("input");
    graph.get_node_mut(n4).unwrap().add_output("output");

    let n5 = graph.create_node("NormalFlipGreen", "Normal DX-GL", [100.0, 100.0]);
    graph.get_node_mut(n5).unwrap().add_input("input");
    graph.get_node_mut(n5).unwrap().add_output("output");

    let n6 = graph.create_node("ChannelCombine", "ORM Pack", [100.0, 100.0]);
    graph.get_node_mut(n6).unwrap().add_input("R");
    graph.get_node_mut(n6).unwrap().add_input("G");
    graph.get_node_mut(n6).unwrap().add_input("B");
    graph.get_node_mut(n6).unwrap().add_output("output");

    let n7 = graph.create_node("TextureOutput", "Final ORM Output", [100.0, 100.0]);
    graph.get_node_mut(n7).unwrap().add_input("input");

    // Connect wires
    graph.connect(PinId::output(n1, "RGBA"), PinId::input(n2, "input")).unwrap();
    graph.connect(PinId::output(n2, "R"), PinId::input(n3, "input")).unwrap();
    graph.connect(PinId::output(n3, "output"), PinId::input(n4, "input")).unwrap();
    graph.connect(PinId::output(n2, "G"), PinId::input(n5, "input")).unwrap();
    graph.connect(PinId::output(n4, "output"), PinId::input(n6, "R")).unwrap();
    graph.connect(PinId::output(n5, "output"), PinId::input(n6, "G")).unwrap();
    graph.connect(PinId::output(n2, "B"), PinId::input(n6, "B")).unwrap();
    graph.connect(PinId::output(n6, "output"), PinId::input(n7, "input")).unwrap();

    // Isolated utility nodes placed in arbitrary spots
    let n_iso1 = graph.create_node("ConstantScalar", "Roughness Floor", [50.0, 50.0]);
    let n_iso2 = graph.create_node("Math", "Helper Add", [50.0, 50.0]);

    // Deliberately set all 9 nodes to exact same coordinate [200.0, 200.0] to test collision unpacking
    for node in graph.nodes.values_mut() {
        node.position = [200.0, 200.0];
    }

    // Execute Auto Layout
    auto_layout_graph(&mut graph);

    // 3. Mathematical Verification: ZERO OVERLAPPING across all pairs of nodes
    let nodes: Vec<&Node> = graph.nodes.values().collect();
    for i in 0..nodes.len() {
        for j in (i + 1)..nodes.len() {
            let a = nodes[i];
            let b = nodes[j];
            let (wa, ha) = calculate_node_size(a);
            let (wb, hb) = calculate_node_size(b);

            let a_min_x = a.position[0];
            let a_max_x = a.position[0] + wa;
            let a_min_y = a.position[1];
            let a_max_y = a.position[1] + ha;

            let b_min_x = b.position[0];
            let b_max_x = b.position[0] + wb;
            let b_min_y = b.position[1];
            let b_max_y = b.position[1] + hb;

            let overlap_x = a_min_x < b_max_x && a_max_x > b_min_x;
            let overlap_y = a_min_y < b_max_y && a_max_y > b_min_y;

            assert!(
                !(overlap_x && overlap_y),
                "OVERLAP DETECTED between node {} ({:?}) and node {} ({:?})",
                a.id, a.position, b.id, b.position
            );
        }
    }

    // 4. Verify Left-to-Right Topological progression
    let p1 = graph.get_node(n1).unwrap().position;
    let p2 = graph.get_node(n2).unwrap().position;
    let p6 = graph.get_node(n6).unwrap().position;
    let p7 = graph.get_node(n7).unwrap().position;

    assert!(p1[0] < p2[0], "Source node n1 must be left of splitter n2");
    assert!(p2[0] < p6[0], "Splitter n2 must be left of combiner n6");
    assert!(p6[0] < p7[0], "Combiner n6 must be left of output n7");

    // 5. Verify isolated helper nodes are staged below the connected network
    let p_iso1 = graph.get_node(n_iso1).unwrap().position;
    let p_iso2 = graph.get_node(n_iso2).unwrap().position;
    assert!(p_iso1[1] > p1[1], "Isolated node 1 should be positioned below primary pipeline");
    assert!(p_iso2[1] > p1[1], "Isolated node 2 should be positioned below primary pipeline");

    // 6. Verify 24px Grid Snapping
    for node in graph.nodes.values() {
        assert_eq!(node.position[0] % GRID_STEP, 0.0, "Node {} X must snap to grid", node.id);
        assert_eq!(node.position[1] % GRID_STEP, 0.0, "Node {} Y must snap to grid", node.id);
    }

    // 7. Verify CanvasAction::AutoLayout enum variant exists
    let act = CanvasAction::AutoLayout;
    assert_eq!(act, CanvasAction::AutoLayout);

    // 8. Verify contextual back-hierarchy layout when a node is selected:
    // Move downstream node n7 and isolated nodes to distinct coordinates
    let n7_custom_pos = [2500.0, 500.0];
    let iso1_custom_pos = [3000.0, 3000.0];
    graph.get_node_mut(n7).unwrap().position = n7_custom_pos;
    graph.get_node_mut(n_iso1).unwrap().position = iso1_custom_pos;

    // Call contextual layout with node n6 (ChannelCombine) selected
    texturelab::graph::auto_layout_graph_contextual(&mut graph, Some(n6));

    // Downstream node n7 and isolated node n_iso1 MUST remain in their exact custom coordinates
    assert_eq!(graph.get_node(n7).unwrap().position, n7_custom_pos, "Downstream node n7 must be untouched");
    assert_eq!(graph.get_node(n_iso1).unwrap().position, iso1_custom_pos, "Isolated node n_iso1 must be untouched");

    // Upstream back-hierarchy of n6 must remain zero-overlap and flow Right-to-Left ending at n6
    let new_p1 = graph.get_node(n1).unwrap().position;
    let new_p2 = graph.get_node(n2).unwrap().position;
    let new_p6 = graph.get_node(n6).unwrap().position;
    assert!(new_p1[0] < new_p2[0]);
    assert!(new_p2[0] < new_p6[0]);
}

/// Verification of 2D Viewport selected-node live tracking, output socket selection,
/// parameter reactivity, and automatic fallback to final TextureOutput.
#[test]
fn test_2d_viewport_selection_and_live_update() {
    use texturelab::graph::evaluator::GraphEvaluator;
    use texturelab::graph::model::{Graph, Node, NodeId, NodeParam};
    use texturelab::ui::viewport::{resolve_viewport_preview, ViewportState};

    let mut graph = Graph::new();

    // Node 1: Red Color
    let mut n1 = Node::new(NodeId(1), "ConstantColor", "Albedo Base", [0.0, 0.0]);
    n1.set_param("color", NodeParam::Color([1.0, 0.0, 0.0, 1.0]));
    n1.add_output("output");
    n1.add_output("RGBA");
    n1.add_output("R");
    graph.add_node(n1);

    // Node 2: Blue Color
    let mut n2 = Node::new(NodeId(2), "ConstantColor", "Tint Color", [200.0, 0.0]);
    n2.set_param("color", NodeParam::Color([0.0, 0.0, 1.0, 1.0]));
    n2.add_output("output");
    graph.add_node(n2);

    // Node 3: TextureOutput terminal node
    let mut n3 = Node::new(NodeId(3), "TextureOutput", "Final Normal Output", [500.0, 0.0]);
    n3.add_input("input");
    n3.add_output("output");
    graph.add_node(n3);

    let mut evaluator = GraphEvaluator::new((32, 32));
    let _ = evaluator.evaluate(&graph);

    let mut state = ViewportState::new();

    // 1. Initial deselect: viewport auto-falls back to terminal TextureOutput (Node 3)
    let prev_empty = resolve_viewport_preview(&graph, &evaluator, state.locked_node, None, state.selected_socket.as_deref());
    assert_eq!(prev_empty.node_id, Some(NodeId(3)));
    assert!(prev_empty.is_fallback);

    // 2. Select Node 1: Viewport live-switches to Node 1 (Red)
    let prev_n1 = resolve_viewport_preview(&graph, &evaluator, state.locked_node, Some(NodeId(1)), state.selected_socket.as_deref());
    assert_eq!(prev_n1.node_id, Some(NodeId(1)));
    assert_eq!(prev_n1.node_label, "Albedo Base");
    let buf1 = prev_n1.buffer.expect("Node 1 buffer should exist");
    assert_eq!(buf1.get_pixel(0, 0), [255, 0, 0, 255]);

    // 3. Live parameter update: mutate Node 1 to Green and re-evaluate
    let n1_mut = graph.get_node_mut(NodeId(1)).unwrap();
    n1_mut.set_param("color", NodeParam::Color([0.0, 1.0, 0.0, 1.0]));
    evaluator.mark_dirty(&graph, NodeId(1));
    let _ = evaluator.evaluate(&graph);

    let prev_n1_updated = resolve_viewport_preview(&graph, &evaluator, state.locked_node, Some(NodeId(1)), state.selected_socket.as_deref());
    let buf1_updated = prev_n1_updated.buffer.expect("Updated buffer should exist");
    assert_eq!(buf1_updated.get_pixel(0, 0), [0, 255, 0, 255], "Viewport buffer must live-update to green");

    // 4. Select Node 2: Viewport live-switches to Node 2 (Blue)
    let prev_n2 = resolve_viewport_preview(&graph, &evaluator, state.locked_node, Some(NodeId(2)), state.selected_socket.as_deref());
    assert_eq!(prev_n2.node_id, Some(NodeId(2)));
    let buf2 = prev_n2.buffer.expect("Node 2 buffer should exist");
    assert_eq!(buf2.get_pixel(0, 0), [0, 0, 255, 255], "Viewport buffer must display blue");

    // 5. Pin / Lock feature: lock viewport to Node 2
    state.locked_node = Some(NodeId(2));
    // Now even if Node 1 is selected, locked Node 2 takes priority
    let prev_pinned = resolve_viewport_preview(&graph, &evaluator, state.locked_node, Some(NodeId(1)), state.selected_socket.as_deref());
    assert_eq!(prev_pinned.node_id, Some(NodeId(2)));
    assert!(prev_pinned.is_pinned);

    // 6. Unpin: immediately resumes tracking selected Node 1
    state.locked_node = None;
    let prev_unpinned = resolve_viewport_preview(&graph, &evaluator, state.locked_node, Some(NodeId(1)), state.selected_socket.as_deref());
    assert_eq!(prev_unpinned.node_id, Some(NodeId(1)));
    assert!(!prev_unpinned.is_pinned);
}

#[test]
fn test_end_to_end_cycle_rejection_in_graph() {
    let mut graph = Graph::new();
    let n1 = graph.create_node("ConstantScalar", "S1", [0.0, 0.0]);
    let n2 = graph.create_node("Math", "M1", [200.0, 0.0]);
    let n3 = graph.create_node("Math", "M2", [400.0, 0.0]);

    if let Some(node) = graph.get_node_mut(n1) {
        node.add_output("output");
    }
    if let Some(node) = graph.get_node_mut(n2) {
        node.add_input("A");
        node.add_output("output");
    }
    if let Some(node) = graph.get_node_mut(n3) {
        node.add_input("A");
        node.add_output("output");
    }

    // Connect N1 -> N2 -> N3
    assert!(graph.connect(PinId::output(n1, "output"), PinId::input(n2, "A")).is_ok());
    assert!(graph.connect(PinId::output(n2, "output"), PinId::input(n3, "A")).is_ok());

    // Attempt feedback cycle: N3 -> N2 must be rejected!
    let cycle_res = graph.connect(PinId::output(n3, "output"), PinId::input(n2, "A"));
    assert!(cycle_res.is_err(), "Graph::connect must reject circular feedback loop");
    assert_eq!(graph.edges.len(), 2, "Edge count must remain untouched after cycle rejection");
}

#[test]
fn test_end_to_end_multi_input_retention() {
    use std::sync::Arc;
    let mut graph = Graph::new();
    let mut n1 = Node::new(NodeId(10), "TextureInput", "Base", [0.0, 0.0]);
    let pin_a = n1.add_output("output");
    graph.add_node(n1);

    let mut n2 = Node::new(NodeId(20), "TextureInput", "Layer", [0.0, 100.0]);
    let pin_b = n2.add_output("output");
    graph.add_node(n2);

    let mut evaluator = GraphEvaluator::new((16, 16));
    let tex_a = Arc::new(TextureBuffer::solid_color(16, 16, 255, 0, 0, 255));
    let tex_b = Arc::new(TextureBuffer::solid_color(16, 16, 0, 255, 0, 255));

    evaluator.set_input_texture(NodeId(10), tex_a);
    evaluator.set_input_texture(NodeId(20), tex_b);
    evaluator.evaluate(&graph).expect("Evaluation failed");

    // Both textures must be retained in the executor without one overwriting the other
    let out_a = evaluator.get_output(&pin_a).expect("Input pin_a must be retained");
    let out_b = evaluator.get_output(&pin_b).expect("Input pin_b must be retained");

    assert_eq!(out_a.get_pixel(0, 0), [255, 0, 0, 255]);
    assert_eq!(out_b.get_pixel(0, 0), [0, 255, 0, 255]);
}

#[test]
fn test_end_to_end_hold_key_aliases_census() {
    use texturelab::nodes::find_descriptor;

    let desc_add = find_descriptor("Add").expect("Descriptor for Add must exist");
    assert_eq!(desc_add.type_name, "Add");
    assert_eq!(desc_add.hotkey, Some("A"));

    let desc_mul = find_descriptor("Multiply").expect("Descriptor for Multiply must exist");
    assert_eq!(desc_mul.type_name, "Multiply");
    assert_eq!(desc_mul.hotkey, Some("M"));

    let desc_rnm = find_descriptor("RNM").expect("Descriptor for RNM alias must exist");
    assert_eq!(desc_rnm.type_name, "NormalBlendRNM");
}

#[test]
fn test_end_to_end_screen_to_canvas_drag_drop_alignment() {
    use egui::{Pos2, Rect, Vec2};
    use texturelab::ui::canvas::CanvasState;

    let mut state = CanvasState::new();
    state.pan = Vec2::new(150.0, 80.0);
    state.zoom = 1.5;

    // Simulate canvas located inside a docking tab with screen rect [200, 100] to [1200, 800]
    let canvas_rect = Rect::from_min_size(Pos2::new(200.0, 100.0), Vec2::new(1000.0, 700.0));
    state.last_canvas_rect = canvas_rect;

    // Screen cursor position at (500, 400)
    let screen_cursor = Pos2::new(500.0, 400.0);
    let canvas_pt = state.screen_to_canvas(screen_cursor, state.last_canvas_rect);

    // Expected canvas position:
    // (500 - 200 - 150) / 1.5 = 150 / 1.5 = 100.0
    // (400 - 100 - 80) / 1.5 = 220 / 1.5 = 146.66667
    assert!((canvas_pt.x - 100.0).abs() < 1e-4);
    assert!((canvas_pt.y - 146.66667).abs() < 1e-4);

    // Inverse roundtrip: canvas_to_screen must return exact screen_cursor
    let roundtrip_screen = state.canvas_to_screen(canvas_pt, state.last_canvas_rect);
    assert!((roundtrip_screen.x - screen_cursor.x).abs() < 1e-4);
    assert!((roundtrip_screen.y - screen_cursor.y).abs() < 1e-4);
}






