//! Built-in Starter Template Gallery for rapid PBR workflow bootstrap.
//!
//! Provides pre-built canonical node graphs for common game engine and DCC pipelines
//! (Unreal Engine 5 ORM, Unity MaskMap, Blender Principled BSDF, Normal Flip Green, and Empty Graph).

use crate::graph::model::{Graph, ProjectError, ProjectFile};

/// Represents a pre-configured starter project template.
#[derive(Clone, Debug, PartialEq)]
pub struct TemplateEntry {
    pub name: &'static str,
    pub description: &'static str,
    pub graph_json: &'static str,
}

impl TemplateEntry {
    /// Deserializes the template JSON into a `ProjectFile`.
    pub fn load_project(&self) -> Result<ProjectFile, ProjectError> {
        ProjectFile::from_json(self.graph_json)
    }

    /// Deserializes the template JSON directly into a `Graph`.
    pub fn load_graph(&self) -> Result<Graph, ProjectError> {
        self.load_project().map(|p| p.graph)
    }
}

/// Returns the catalog of 5 built-in starter templates.
pub fn builtin_templates() -> Vec<TemplateEntry> {
    vec![
        TemplateEntry {
            name: "Empty Graph",
            description: "Clean blank canvas for creating custom node networks from scratch.",
            graph_json: include_str!("../assets/templates/empty.tlab"),
        },
        TemplateEntry {
            name: "UE5 ORM Pack",
            description: "Packs AO (R), Roughness (G), and Metallic (B) maps into a single Unreal Engine 5 ORM texture.",
            graph_json: include_str!("../assets/templates/ue5_orm_pack.tlab"),
        },
        TemplateEntry {
            name: "Unity MaskMap",
            description: "Packs Metallic (R), AO (G), Detail Mask (B), and Smoothness (A) for Unity HDRP/URP.",
            graph_json: include_str!("../assets/templates/unity_maskmap.tlab"),
        },
        TemplateEntry {
            name: "Blender Principled BSDF",
            description: "Standard multi-map setup routing Base Color, Roughness, Metallic, Normal, and AO to individual exports.",
            graph_json: include_str!("../assets/templates/blender_principled.tlab"),
        },
        TemplateEntry {
            name: "Normal Map Convert",
            description: "Inverts normal map green channel between DirectX (Y-) and OpenGL (Y+) standards.",
            graph_json: include_str!("../assets/templates/normal_convert.tlab"),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_count() {
        let templates = builtin_templates();
        assert_eq!(templates.len(), 5);
    }

    #[test]
    fn test_builtin_templates_load_without_error() {
        for template in builtin_templates() {
            let project = template
                .load_project()
                .unwrap_or_else(|e| panic!("Failed to load template '{}': {}", template.name, e));
            assert!(!project.metadata.name.is_empty());
            assert_eq!(project.format_version, 1);

            let graph = template
                .load_graph()
                .unwrap_or_else(|e| panic!("Failed to load graph for '{}': {}", template.name, e));
            assert_eq!(project.graph, graph);

            // Verify all edge connections reference valid nodes and pins
            for edge in &graph.edges {
                let from_node = graph.get_node(edge.from.node_id);
                assert!(
                    from_node.is_some(),
                    "Template '{}' has edge from non-existent node {}",
                    template.name,
                    edge.from.node_id
                );
                let to_node = graph.get_node(edge.to.node_id);
                assert!(
                    to_node.is_some(),
                    "Template '{}' has edge to non-existent node {}",
                    template.name,
                    edge.to.node_id
                );
            }
        }
    }

    #[test]
    fn test_specific_template_topologies() {
        let templates = builtin_templates();

        // 1. Empty Graph
        let empty = templates.iter().find(|t| t.name == "Empty Graph").unwrap();
        let empty_graph = empty.load_graph().unwrap();
        assert!(empty_graph.nodes.is_empty());
        assert!(empty_graph.edges.is_empty());

        // 2. UE5 ORM Pack
        let ue5 = templates.iter().find(|t| t.name == "UE5 ORM Pack").unwrap();
        let ue5_graph = ue5.load_graph().unwrap();
        assert_eq!(ue5_graph.nodes.len(), 5);
        assert_eq!(ue5_graph.edges.len(), 4);
        assert!(ue5_graph.nodes.values().any(|n| n.node_type == "ChannelCombine"));
        assert!(ue5_graph.nodes.values().any(|n| n.node_type == "SaveImage"));

        // 3. Unity MaskMap
        let unity = templates.iter().find(|t| t.name == "Unity MaskMap").unwrap();
        let unity_graph = unity.load_graph().unwrap();
        assert_eq!(unity_graph.nodes.len(), 6);
        assert_eq!(unity_graph.edges.len(), 5);

        // 4. Blender Principled BSDF
        let blender = templates.iter().find(|t| t.name == "Blender Principled BSDF").unwrap();
        let blender_graph = blender.load_graph().unwrap();
        assert_eq!(blender_graph.nodes.len(), 10);
        assert_eq!(blender_graph.edges.len(), 5);

        // 5. Normal Map Convert
        let normal = templates.iter().find(|t| t.name == "Normal Map Convert").unwrap();
        let normal_graph = normal.load_graph().unwrap();
        assert_eq!(normal_graph.nodes.len(), 3);
        assert_eq!(normal_graph.edges.len(), 2);
        assert!(normal_graph.nodes.values().any(|n| n.node_type == "NormalFlipGreen"));
    }
}
