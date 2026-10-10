//! One-Click Pack Wizard & Automated DAG Generator (Phase 4).
//!
//! Analyzes batches of texture files, infers PBR roles, detects normal map conventions,
//! and automatically constructs end-to-end connected DAG graphs with smart auto-inversion
//! (Glossiness -> Roughness) and normal green-channel correction (OpenGL -> DirectX).

use crate::graph::compiler::GraphCompiler;
use crate::graph::model::{Graph, GraphError, NodeId, NodeParam, PinId};
use crate::nodes::find_descriptor;
use crate::normalizer::rules::{LexicalNormalizer, PbrRole, TextureMetadata};
use serde::{Deserialize, Serialize};

/// Target channel packing presets supported by the Pack Wizard.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PackPreset {
    /// Unreal Engine 5 standard ORM: R=AO, G=Roughness, B=Metallic, A=1.0
    Ue5Orm,
    /// Unreal Engine 5 ORMH: R=AO, G=Roughness, B=Metallic, A=Height
    Ue5Ormh,
    /// Unity HDRP MaskMap: R=Metallic, G=AO, B=DetailMask, A=Smoothness (Glossiness)
    UnityMaskMap,
    /// Standard RMA: R=Roughness, G=Metallic, B=AO, A=1.0
    Rma,
}

impl PackPreset {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Ue5Orm => "Unreal Engine 5 ORM (AO, Roughness, Metallic)",
            Self::Ue5Ormh => "Unreal Engine 5 ORMH (AO, Roughness, Metallic, Height)",
            Self::UnityMaskMap => "Unity HDRP MaskMap (Metallic, AO, Mask, Smoothness)",
            Self::Rma => "Standard RMA (Roughness, Metallic, AO)",
        }
    }

    pub fn output_suffix(&self) -> &'static str {
        match self {
            Self::Ue5Orm => "ORM",
            Self::Ue5Ormh => "ORMH",
            Self::UnityMaskMap => "MaskMap",
            Self::Rma => "RMA",
        }
    }
}

/// One-click automated graph generator.
pub struct PackWizard;

impl PackWizard {
    /// Analyzes a batch of filenames or paths and constructs a fully wired, cycle-free DAG.
    pub fn generate_pack_graph(files: &[&str], preset: PackPreset) -> Result<Graph, GraphError> {
        let mut graph = Graph::new();

        // 1. Lexical classification of all input files
        let mut parsed_entries = Vec::new();
        for &file in files {
            let meta = LexicalNormalizer::normalize(file);
            parsed_entries.push((file, meta));
        }

        // Layout cursor coordinates
        let mut input_y = 80.0f32;
        let x_input = 80.0f32;
        let x_mid = 380.0f32;
        let x_combiner = 680.0f32;
        let x_output = 980.0f32;

        // Registered input nodes by role
        let mut input_nodes: Vec<(PbrRole, NodeId, TextureMetadata, f32)> = Vec::new();

        let desc_input = find_descriptor("TextureInput").expect("TextureInput descriptor missing");
        let desc_combine = find_descriptor("ChannelCombine").expect("ChannelCombine descriptor missing");
        let desc_invert = find_descriptor("Invert").expect("Invert descriptor missing");
        let desc_flip_green = find_descriptor("NormalFlipGreen").expect("NormalFlipGreen descriptor missing");
        let desc_output = find_descriptor("TextureOutput").expect("TextureOutput descriptor missing");

        // 2. Instantiate TextureInput nodes for each recognized texture
        for (file_str, meta) in &parsed_entries {
            let role = match meta.inferred_role {
                Some(r) => r,
                None => continue,
            };

            let node_id = NodeId(graph.next_node_id);
            graph.next_node_id += 1;

            let mut node = desc_input.create_node(node_id, [x_input, input_y]);
            let label = format!("Input: {}", role.canonical_suffix());
            node.label = label;
            node.set_param("file_path", NodeParam::String(file_str.to_string()));
            node.set_param("colorspace", NodeParam::String(role.default_colorspace().to_string()));

            let current_y = input_y;
            input_y += 160.0;

            input_nodes.push((role, node_id, meta.clone(), current_y));
            graph.add_node(node);
        }

        // 3. Channel Packing Generation based on Preset
        let has_packing_inputs = input_nodes.iter().any(|(r, _, _, _)| {
            matches!(
                r,
                PbrRole::AmbientOcclusion
                    | PbrRole::Roughness
                    | PbrRole::Glossiness
                    | PbrRole::Metallic
                    | PbrRole::Height
                    | PbrRole::Mask
            )
        });

        if has_packing_inputs {
            let combiner_id = NodeId(graph.next_node_id);
            graph.next_node_id += 1;
            let mut combiner = desc_combine.create_node(combiner_id, [x_combiner, 160.0]);
            combiner.label = format!("Packer ({})", preset.output_suffix());
            graph.add_node(combiner);

            let output_id = NodeId(graph.next_node_id);
            graph.next_node_id += 1;
            let mut output_node = desc_output.create_node(output_id, [x_output, 160.0]);
            output_node.label = format!("Output: {}", preset.output_suffix());
            output_node.set_param("slot", NodeParam::String(preset.output_suffix().to_string()));
            graph.add_node(output_node);

            // Connect combiner output to TextureOutput
            graph.connect(
                PinId::output(combiner_id, "output"),
                PinId::input(output_id, "input"),
            )?;

            // Helper to find input node for role
            let find_role = |target: PbrRole| -> Option<(NodeId, TextureMetadata, f32)> {
                input_nodes
                    .iter()
                    .find(|(r, _, _, _)| *r == target)
                    .map(|(_, id, meta, y)| (*id, meta.clone(), *y))
            };

            // Wire according to preset
            match preset {
                PackPreset::Ue5Orm | PackPreset::Ue5Ormh => {
                    // R: Ambient Occlusion
                    if let Some((ao_id, _, _)) = find_role(PbrRole::AmbientOcclusion) {
                        graph.connect(PinId::output(ao_id, "output"), PinId::input(combiner_id, "R"))?;
                    }

                    // G: Roughness (with auto-inversion for Glossiness)
                    if let Some((rough_id, _, _)) = find_role(PbrRole::Roughness) {
                        graph.connect(PinId::output(rough_id, "output"), PinId::input(combiner_id, "G"))?;
                    } else if let Some((gloss_id, _, gloss_y)) = find_role(PbrRole::Glossiness) {
                        // Glossiness -> Invert -> Combiner G
                        let invert_id = NodeId(graph.next_node_id);
                        graph.next_node_id += 1;
                        let mut invert_node = desc_invert.create_node(invert_id, [x_mid, gloss_y]);
                        invert_node.label = "Invert (Gloss->Rough)".to_string();
                        graph.add_node(invert_node);

                        graph.connect(PinId::output(gloss_id, "output"), PinId::input(invert_id, "input"))?;
                        graph.connect(PinId::output(invert_id, "output"), PinId::input(combiner_id, "G"))?;
                    }

                    // B: Metallic
                    if let Some((metal_id, _, _)) = find_role(PbrRole::Metallic) {
                        graph.connect(PinId::output(metal_id, "output"), PinId::input(combiner_id, "B"))?;
                    }

                    // A: Height (for ORMH)
                    if preset == PackPreset::Ue5Ormh {
                        if let Some((height_id, _, _)) = find_role(PbrRole::Height) {
                            graph.connect(PinId::output(height_id, "output"), PinId::input(combiner_id, "A"))?;
                        }
                    }
                }

                PackPreset::UnityMaskMap => {
                    // R: Metallic
                    if let Some((metal_id, _, _)) = find_role(PbrRole::Metallic) {
                        graph.connect(PinId::output(metal_id, "output"), PinId::input(combiner_id, "R"))?;
                    }

                    // G: Ambient Occlusion
                    if let Some((ao_id, _, _)) = find_role(PbrRole::AmbientOcclusion) {
                        graph.connect(PinId::output(ao_id, "output"), PinId::input(combiner_id, "G"))?;
                    }

                    // B: Detail Mask / Height
                    if let Some((mask_id, _, _)) = find_role(PbrRole::Mask) {
                        graph.connect(PinId::output(mask_id, "output"), PinId::input(combiner_id, "B"))?;
                    } else if let Some((height_id, _, _)) = find_role(PbrRole::Height) {
                        graph.connect(PinId::output(height_id, "output"), PinId::input(combiner_id, "B"))?;
                    }

                    // A: Smoothness (Glossiness)
                    if let Some((gloss_id, _, _)) = find_role(PbrRole::Glossiness) {
                        graph.connect(PinId::output(gloss_id, "output"), PinId::input(combiner_id, "A"))?;
                    } else if let Some((rough_id, _, rough_y)) = find_role(PbrRole::Roughness) {
                        // Roughness -> Invert -> Combiner A (Smoothness)
                        let invert_id = NodeId(graph.next_node_id);
                        graph.next_node_id += 1;
                        let mut invert_node = desc_invert.create_node(invert_id, [x_mid, rough_y]);
                        invert_node.label = "Invert (Rough->Smooth)".to_string();
                        graph.add_node(invert_node);

                        graph.connect(PinId::output(rough_id, "output"), PinId::input(invert_id, "input"))?;
                        graph.connect(PinId::output(invert_id, "output"), PinId::input(combiner_id, "A"))?;
                    }
                }

                PackPreset::Rma => {
                    // R: Roughness
                    if let Some((rough_id, _, _)) = find_role(PbrRole::Roughness) {
                        graph.connect(PinId::output(rough_id, "output"), PinId::input(combiner_id, "R"))?;
                    } else if let Some((gloss_id, _, gloss_y)) = find_role(PbrRole::Glossiness) {
                        let invert_id = NodeId(graph.next_node_id);
                        graph.next_node_id += 1;
                        let mut invert_node = desc_invert.create_node(invert_id, [x_mid, gloss_y]);
                        invert_node.label = "Invert (Gloss->Rough)".to_string();
                        graph.add_node(invert_node);

                        graph.connect(PinId::output(gloss_id, "output"), PinId::input(invert_id, "input"))?;
                        graph.connect(PinId::output(invert_id, "output"), PinId::input(combiner_id, "R"))?;
                    }

                    // G: Metallic
                    if let Some((metal_id, _, _)) = find_role(PbrRole::Metallic) {
                        graph.connect(PinId::output(metal_id, "output"), PinId::input(combiner_id, "G"))?;
                    }

                    // B: Ambient Occlusion
                    if let Some((ao_id, _, _)) = find_role(PbrRole::AmbientOcclusion) {
                        graph.connect(PinId::output(ao_id, "output"), PinId::input(combiner_id, "B"))?;
                    }
                }
            }
        }

        // 4. Normal Map Auto-Wiring (with OpenGL -> DirectX Green Flip)
        for (role, node_id, meta, y) in &input_nodes {
            if *role == PbrRole::Normal {
                let out_y = *y;
                let norm_out_id = NodeId(graph.next_node_id);
                graph.next_node_id += 1;
                let mut norm_out = desc_output.create_node(norm_out_id, [x_output, out_y]);
                norm_out.label = "Output: Normal (DX)".to_string();
                norm_out.set_param("slot", NodeParam::String("Normal".to_string()));
                graph.add_node(norm_out);

                if meta.is_opengl_normal {
                    // Route through NormalFlipGreen
                    let flip_id = NodeId(graph.next_node_id);
                    graph.next_node_id += 1;
                    let mut flip_node = desc_flip_green.create_node(flip_id, [x_mid, out_y]);
                    flip_node.label = "Flip Green (GL->DX)".to_string();
                    graph.add_node(flip_node);

                    graph.connect(PinId::output(*node_id, "output"), PinId::input(flip_id, "input"))?;
                    graph.connect(PinId::output(flip_id, "output"), PinId::input(norm_out_id, "input"))?;
                } else {
                    graph.connect(PinId::output(*node_id, "output"), PinId::input(norm_out_id, "input"))?;
                }
            }
        }

        // 5. Verify the compiled graph is cycle-free
        GraphCompiler::detect_cycles(&graph).map_err(|_| GraphError::CycleDetected)?;

        Ok(graph)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// TC-402: Pack Wizard Auto-Graph Generation
    #[test]
    pub fn test_pack_wizard_auto_graph_generation() {
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
            "Graph construction took {:?}, exceeding 5ms budget",
            elapsed
        );

        // Verify node census: 3 inputs + 1 combiner + 1 output = 5 nodes
        assert_eq!(graph.nodes.len(), 5);

        let inputs: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "TextureInput").collect();
        let combiners: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "ChannelCombine").collect();
        let outputs: Vec<_> = graph.nodes.values().filter(|n| n.node_type == "TextureOutput").collect();

        assert_eq!(inputs.len(), 3, "Expected 3 TextureInput nodes");
        assert_eq!(combiners.len(), 1, "Expected 1 ChannelCombine node");
        assert_eq!(outputs.len(), 1, "Expected 1 TextureOutput node");

        // Verify connectivity: 3 input wires to combiner + 1 wire to output = 4 edges
        assert_eq!(graph.edges.len(), 4);

        // Verify DAG is cycle-free
        assert!(GraphCompiler::detect_cycles(&graph).is_ok());
    }

    /// TC-403: Glossiness Auto-Inversion Wiring
    #[test]
    pub fn test_pack_wizard_glossiness_auto_inversion() {
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

    /// Normal map with OpenGL green flip wiring test
    #[test]
    pub fn test_pack_wizard_normal_opengl_flip_wiring() {
        let files = [
            "concrete_ao_4k.png",
            "concrete_rough_4k.png",
            "concrete_metal_4k.png",
            "concrete_normal_gl_4k.png",
        ];

        let graph = PackWizard::generate_pack_graph(&files, PackPreset::Ue5Orm)
            .expect("Graph generation failed");

        // Flip green node must be present
        let flip_nodes: Vec<_> = graph
            .nodes
            .values()
            .filter(|n| n.node_type == "NormalFlipGreen")
            .collect();
        assert_eq!(flip_nodes.len(), 1, "Expected NormalFlipGreen node for OpenGL normal");

        let flip_node = flip_nodes[0];
        let norm_input = graph
            .nodes
            .values()
            .find(|n| n.node_type == "TextureInput" && n.label.contains("N"))
            .expect("Normal input node missing");

        let norm_output = graph
            .nodes
            .values()
            .find(|n| n.node_type == "TextureOutput" && n.label.contains("Normal"))
            .expect("Normal output node missing");

        // Verify wiring: norm_input -> flip_node -> norm_output
        assert!(graph.edges.iter().any(|e| e.from.node_id == norm_input.id && e.to.node_id == flip_node.id));
        assert!(graph.edges.iter().any(|e| e.from.node_id == flip_node.id && e.to.node_id == norm_output.id));
    }
}
