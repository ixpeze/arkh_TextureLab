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
