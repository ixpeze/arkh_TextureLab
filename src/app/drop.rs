//! Drag-and-drop file ingestion handling for TextureLabApp.

use super::state::TextureLabApp;
use crate::graph::model::NodeId;
use crate::normalizer::LexicalNormalizer;

impl TextureLabApp {
    /// Intercepts OS file drag-and-drop events onto the canvas, importing images as TextureInput nodes.
    pub fn handle_dropped_files(&mut self, ctx: &egui::Context) {
        let dropped_files = ctx.input(|i| i.raw.dropped_files.clone());
        if dropped_files.is_empty() {
            return;
        }

        let start_pos = if let Some(ptr) = ctx.pointer_hover_pos() {
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
        }
        self.reevaluate();
        self.status_message = "Loaded and auto-bound texture sampler from Windows Explorer".to_string();
    }
}
