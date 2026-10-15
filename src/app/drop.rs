//! Drag-and-drop file ingestion handling for TextureLabApp.

use super::state::TextureLabApp;
use crate::graph::model::NodeId;
use crate::normalizer::LexicalNormalizer;

impl TextureLabApp {
    /// Loads a texture file directly into an existing TextureInput node.
    pub fn load_texture_into_node(&mut self, node_id: NodeId, path: impl AsRef<std::path::Path>) -> bool {
        let path = path.as_ref();
        if !self.graph.get_node(node_id).is_some_and(|n| n.node_type == "TextureInput") {
            return false;
        }

        let path_str = path.to_string_lossy().to_string();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&path_str)
            .to_string();
        let metadata = LexicalNormalizer::normalize(&path_str);
        let colorspace = metadata
            .inferred_role
            .map(|r| r.default_colorspace())
            .unwrap_or("sRGB");

        if let Some(node) = self.graph.get_node_mut(node_id) {
            node.label = file_name.clone();
            node.set_param("file_path", crate::graph::model::NodeParam::String(path_str.clone()));
            node.set_param("path", crate::graph::model::NodeParam::String(path_str.clone()));
            node.set_param("colorspace", crate::graph::model::NodeParam::String(colorspace.to_string()));
        }

        self.evaluator.mark_dirty(&self.graph, node_id);
        self.canvas_state.selected_node = Some(node_id);
        self.canvas_state.selected_nodes.clear();
        self.canvas_state.selected_nodes.insert(node_id);
        self.history.record(&self.graph, format!("Load texture into '{}'", file_name));
        self.reevaluate();
        self.status_message = format!("Loaded texture '{}' into TextureInput node", file_name);
        true
    }

    /// Intercepts OS file drag-and-drop events onto the canvas, importing images as TextureInput nodes
    /// or loading them directly into hovered TextureInput nodes (Corona Bitmap loader standard).
    pub fn handle_dropped_files(&mut self, ctx: &egui::Context) {
        let dropped_files = ctx.input(|i| i.raw.dropped_files.clone());
        if dropped_files.is_empty() {
            return;
        }

        let drop_screen_ptr = ctx.pointer_hover_pos().or_else(|| ctx.input(|i| i.pointer.latest_pos()));

        let start_pos = if let Some(ptr) = drop_screen_ptr {
            let pt = self.canvas_state.screen_to_canvas(ptr, self.canvas_state.last_canvas_rect);
            [pt.x, pt.y]
        } else {
            [-self.canvas_state.pan.x + 250.0, -self.canvas_state.pan.y + 150.0]
        };

        let (folder_paths, file_paths): (Vec<_>, Vec<_>) = dropped_files
            .into_iter()
            .filter_map(|f| f.path)
            .partition(|p| p.is_dir());

        if !folder_paths.is_empty() {
            let mut added = 0;
            for folder in folder_paths {
                if self.batch_processor.add_folder(folder, None, None).is_ok() {
                    added += 1;
                }
            }
            if added > 0 {
                self.status_message = format!("Added {} texture set folder(s) to Batch Processor queue", added);
                self.open_batch_tab();
            }
        }

        let image_files: Vec<_> = file_paths
            .into_iter()
            .filter(|p| {
                let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                matches!(
                    ext.as_str(),
                    "png" | "jpg" | "jpeg" | "tga" | "webp" | "bmp" | "exr" | "tif" | "tiff"
                )
            })
            .collect();

        if image_files.is_empty() {
            return;
        }

        // Check if dropped directly onto an existing TextureInput node (Corona Bitmap loader interaction)
        let target_texture_input_id = drop_screen_ptr.and_then(|ptr| {
            if self.canvas_state.last_canvas_rect.contains(ptr) {
                let hit_id = self.canvas_state.find_node_at(ptr, &self.graph);
                hit_id.filter(|&id| {
                    self.graph.get_node(id).is_some_and(|n| n.node_type == "TextureInput")
                })
            } else {
                None
            }
        });

        if let Some(target_id) = target_texture_input_id {
            let mut iter = image_files.into_iter();
            if let Some(first_path) = iter.next() {
                let path_str = first_path.to_string_lossy().to_string();
                let file_name = first_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&path_str)
                    .to_string();

                self.load_texture_into_node(target_id, &first_path);

                let target_pos = self.graph.get_node(target_id).map(|n| n.position).unwrap_or([0.0, 0.0]);
                let desc = crate::nodes::find_descriptor("TextureInput");
                let mut y_offset = 160.0;
                let mut spawned_additional = 0;

                for path in iter {
                    let p_str = path.to_string_lossy().to_string();
                    let f_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&p_str)
                        .to_string();
                    let meta = LexicalNormalizer::normalize(&p_str);
                    let cs = meta
                        .inferred_role
                        .map(|r| r.default_colorspace())
                        .unwrap_or("sRGB");

                    let new_id = NodeId(self.graph.next_node_id);
                    if let Some(desc) = desc {
                        let mut node = desc.create_node(new_id, [target_pos[0], target_pos[1] + y_offset]);
                        node.label = f_name;
                        node.set_param("file_path", crate::graph::model::NodeParam::String(p_str.clone()));
                        node.set_param("path", crate::graph::model::NodeParam::String(p_str.clone()));
                        node.set_param("colorspace", crate::graph::model::NodeParam::String(cs.to_string()));

                        self.graph.add_node(node);
                        self.evaluator.mark_dirty(&self.graph, new_id);
                        y_offset += 160.0;
                        spawned_additional += 1;
                    }
                }

                if spawned_additional > 0 {
                    self.reevaluate();
                    self.status_message = format!(
                        "Loaded '{}' into TextureInput and spawned {} additional node(s)",
                        file_name, spawned_additional
                    );
                }
            }
            return;
        }

        self.history.record(&self.graph, "Drop textures from Explorer");
        let desc = crate::nodes::find_descriptor("TextureInput");
        let mut y_offset = 0.0;
        let mut last_spawned_id = None;

        for path in image_files {
            let path_str = path.to_string_lossy().to_string();
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&path_str)
                .to_string();
            let metadata = LexicalNormalizer::normalize(&path_str);

            let node_id = NodeId(self.graph.next_node_id);
            if let Some(desc) = desc {
                let mut node = desc.create_node(node_id, [start_pos[0], start_pos[1] + y_offset]);
                node.label = file_name;
                node.set_param("file_path", crate::graph::model::NodeParam::String(path_str.clone()));
                node.set_param("path", crate::graph::model::NodeParam::String(path_str.clone()));
                let colorspace = metadata
                    .inferred_role
                    .map(|r| r.default_colorspace())
                    .unwrap_or("sRGB");
                node.set_param("colorspace", crate::graph::model::NodeParam::String(colorspace.to_string()));

                self.graph.add_node(node);
                self.evaluator.mark_dirty(&self.graph, node_id);
                last_spawned_id = Some(node_id);
                y_offset += 150.0;
            }
        }

        if let Some(sel_id) = last_spawned_id {
            self.canvas_state.selected_node = Some(sel_id);
            self.canvas_state.selected_nodes.clear();
            self.canvas_state.selected_nodes.insert(sel_id);
        }
        self.reevaluate();
        self.status_message = "Loaded and auto-bound texture sampler from Windows Explorer".to_string();
    }
}
