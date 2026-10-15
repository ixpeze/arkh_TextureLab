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

/// Returns the catalog of 3 built-in starter templates.
pub fn builtin_templates() -> Vec<TemplateEntry> {
    vec![
        TemplateEntry {
            name: "Blank Canvas",
            description: "Clean blank canvas for creating custom node networks from scratch.",
            graph_json: include_str!("../assets/templates/blank_canvas.tlab"),
        },
        TemplateEntry {
            name: "Pack Texture",
            description: "Packs separate Ambient Occlusion (R), Roughness (G), and Metallic (B) maps into a combined ORM texture.",
            graph_json: include_str!("../assets/templates/pack_texture.tlab"),
        },
        TemplateEntry {
            name: "Unpack Texture",
            description: "Unpacks a packed RGBA texture into separate Red, Green, Blue, and Alpha channels.",
            graph_json: include_str!("../assets/templates/unpack_texture.tlab"),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_count() {
        let templates = builtin_templates();
        assert_eq!(templates.len(), 3);
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

        // 1. Blank Canvas
        let blank = templates.iter().find(|t| t.name == "Blank Canvas").unwrap();
        let blank_graph = blank.load_graph().unwrap();
        assert!(blank_graph.nodes.is_empty());
        assert!(blank_graph.edges.is_empty());

        // 2. Pack Texture
        let pack = templates.iter().find(|t| t.name == "Pack Texture").unwrap();
        let pack_graph = pack.load_graph().unwrap();
        assert_eq!(pack_graph.nodes.len(), 5);
        assert_eq!(pack_graph.edges.len(), 4);
        assert!(pack_graph.nodes.values().any(|n| n.node_type == "ChannelCombine"));
        assert!(pack_graph.nodes.values().any(|n| n.node_type == "SaveImage"));

        // 3. Unpack Texture
        let unpack = templates.iter().find(|t| t.name == "Unpack Texture").unwrap();
        let unpack_graph = unpack.load_graph().unwrap();
        assert_eq!(unpack_graph.nodes.len(), 6);
        assert_eq!(unpack_graph.edges.len(), 5);
        assert!(unpack_graph.nodes.values().any(|n| n.node_type == "ChannelSplit"));
        assert_eq!(
            unpack_graph.nodes.values().filter(|n| n.node_type == "SaveImage").count(),
            4
        );
    }
}

