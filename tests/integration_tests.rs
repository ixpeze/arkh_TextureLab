//! Integration test harness verifying crate baseline and Phase 1 engine/codecs.

use std::fs;
use std::path::PathBuf;
use texturelab::app::TextureLabApp;
use texturelab::core::buffer::TextureBuffer;
use texturelab::core::colorspace::{linear_to_srgb_buffer, srgb_to_linear_buffer};
use texturelab::export::codecs::{load_image, save_png};
use texturelab::export::tga::{decode_tga, encode_tga_32, has_tga_2_0_footer, load_tga_file, save_tga_file, TgaHeader};
use texturelab::graph::{
    CompileError, Graph, GraphCompiler, GraphEvaluator, HistoryStack, Node, NodeId,
    NodeParam, PinId, ProjectFile,
};
use texturelab::version;

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

/// Owner Check test for Phase 1 direct disk export preflight and atomic write.
/// Verifies writing 32-bit TGA (exact byte size 18+W*H*4+26) and PNG to disk.
#[test]
fn test_direct_disk_exporter_preflight_and_write() {
    let temp_dir = std::env::temp_dir().join(format!(
        "texturelab_test_p1_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&temp_dir).expect("Failed to create temp test directory");

    let buf = TextureBuffer::solid_color(64, 64, 42, 84, 126, 0); // Note A=0 to verify F-01 on disk
    let tga_path: PathBuf = temp_dir.join("test_output.tga");
    let png_path: PathBuf = temp_dir.join("test_output.png");

    // Preflight: ensure files do not exist prior to writing
    assert!(!tga_path.exists());
    assert!(!png_path.exists());

    // Write TGA 32-bit
    save_tga_file(&buf, &tga_path, 32).expect("Writing TGA to disk failed");
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

    // Write PNG
    save_png(&buf, &png_path).expect("Writing PNG to disk failed");
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

    // Force circular edge: 3 -> 1
    let _ = graph.connect(PinId::output(n3, "out"), PinId::input(n1, "in"));

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
    let outputs: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "TextureOutput").collect();

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


