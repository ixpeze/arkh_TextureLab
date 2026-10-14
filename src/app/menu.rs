//! Menu bar rendering implementation for TextureLabApp.

use egui::Ui;
use egui_dock::DockState;

use super::state::{build_starter_graph, TextureLabApp};
use crate::graph::model::{ProjectFile, ProjectMetadata};
use crate::nodes::NODE_CATALOG;
use crate::ui::Tab;

impl TextureLabApp {
    /// Renders the top menu bar with File, Edit, View, Nodes, and Help menus.
    pub fn render_menu_bar(&mut self, ui: &mut Ui, ctx: &egui::Context) {
        egui::menu::bar(ui, |ui| {
            ui.menu_button("File", |ui| {
                if ui.button("New Project").clicked() {
                    self.graph = build_starter_graph();
                    self.evaluator.invalidate_all();
                    self.reevaluate();
                    self.history.clear();
                    self.project_metadata = ProjectMetadata::default();
                    self.project_file_path = None;
                    self.canvas_state.dismiss_splash = false;
                    ui.close_menu();
                }
                ui.menu_button("New from Template", |ui| {
                    for template in crate::templates::builtin_templates() {
                        if ui.button(template.name).on_hover_text(template.description).clicked() {
                            self.load_template(&template);
                            ui.close_menu();
                        }
                    }
                });
                if ui.button("Open Project (.tlab)...").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("TextureLab Project", &["tlab", "json"])
                        .pick_file()
                    {
                        if let Ok(project) = ProjectFile::load_from_file(&path) {
                            self.graph = project.graph;
                            self.project_metadata = project.metadata;
                            self.evaluator.invalidate_all();
                            self.reevaluate();
                            self.history.clear();
                            self.settings.add_recent_file(path.to_string_lossy().to_string());
                            let _ = self.settings.save();
                            self.project_file_path = Some(path);
                        }
                    }
                    ui.close_menu();
                }
                if !self.settings.recent_files.is_empty() {
                    ui.menu_button("Recent Projects", |ui| {
                        let mut selected_recent = None;
                        for path_str in &self.settings.recent_files {
                            let display_label = std::path::Path::new(path_str)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or(path_str.as_str());
                            if ui.button(display_label).on_hover_text(path_str).clicked() {
                                selected_recent = Some(std::path::PathBuf::from(path_str));
                                ui.close_menu();
                            }
                        }
                        if let Some(path) = selected_recent {
                            if let Ok(project) = ProjectFile::load_from_file(&path) {
                                self.graph = project.graph;
                                self.project_metadata = project.metadata;
                                self.evaluator.invalidate_all();
                                self.reevaluate();
                                self.history.clear();
                                self.settings.add_recent_file(path.to_string_lossy().to_string());
                                let _ = self.settings.save();
                                self.project_file_path = Some(path);
                            }
                        }
                    });
                }
                if ui.button("Save Project (Ctrl+S)").clicked() {
                    if let Some(path) = &self.project_file_path {
                        let project = ProjectFile::with_metadata(self.graph.clone(), self.project_metadata.clone());
                        let _ = project.save_to_file(path);
                        self.settings.add_recent_file(path.to_string_lossy().to_string());
                        let _ = self.settings.save();
                    } else if let Some(path) = rfd::FileDialog::new()
                        .add_filter("TextureLab Project", &["tlab"])
                        .save_file()
                    {
                        let project = ProjectFile::with_metadata(self.graph.clone(), self.project_metadata.clone());
                        if project.save_to_file(&path).is_ok() {
                            self.settings.add_recent_file(path.to_string_lossy().to_string());
                            let _ = self.settings.save();
                            self.project_file_path = Some(path);
                        }
                    }
                    ui.close_menu();
                }
                if ui.button("Save As...").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("TextureLab Project", &["tlab"])
                        .save_file()
                    {
                        let project = ProjectFile::with_metadata(self.graph.clone(), self.project_metadata.clone());
                        if project.save_to_file(&path).is_ok() {
                            self.settings.add_recent_file(path.to_string_lossy().to_string());
                            let _ = self.settings.save();
                            self.project_file_path = Some(path);
                        }
                    }
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Export Textures (Ctrl+E)...").clicked() {
                    self.status_message = "Opened Export Preflight Drawer (Ctrl+E)".to_string();
                    if let Some(mut dock) = self.dock_state.take() {
                        if dock.find_tab(&Tab::ExportDrawer).is_none() {
                            dock.main_surface_mut().push_to_focused_leaf(Tab::ExportDrawer);
                        }
                        if let Some(loc) = dock.find_tab(&Tab::ExportDrawer) {
                            dock.set_active_tab(loc);
                        }
                        self.dock_state = Some(dock);
                    }
                    ui.close_menu();
                }
                if ui.button("Export Preset Designer...").clicked() {
                    self.preset_designer_dialog.open(&self.user_presets);
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Exit").clicked() {
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });

            ui.menu_button("Edit", |ui| {
                if ui.button("Undo (Ctrl+Z)").clicked() {
                    let desc = self.history.undo_description().map(|s| s.to_string());
                    if let Some(prev) = self.history.undo(&self.graph) {
                        self.graph = prev;
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.status_message = format!("Undo: {}", desc.as_deref().unwrap_or(""));
                    }
                    ui.close_menu();
                }
                if ui.button("Redo (Ctrl+Y)").clicked() {
                    let desc = self.history.redo_description().map(|s| s.to_string());
                    if let Some(next) = self.history.redo(&self.graph) {
                        self.graph = next;
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.status_message = format!("Redo: {}", desc.as_deref().unwrap_or(""));
                    }
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Copy (Ctrl+C)").clicked() {
                    self.copy_selected_nodes();
                    ui.close_menu();
                }
                if ui.button("Paste (Ctrl+V)").clicked() {
                    self.paste_clipboard(None);
                    ui.close_menu();
                }
                if ui.button("Duplicate (Ctrl+D)").clicked() {
                    self.duplicate_selected_nodes();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Auto Layout Nodes (Ctrl+F)").clicked() {
                    self.execute_auto_layout();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Select All (Ctrl+A)").clicked() {
                    if let Some(&first) = self.graph.nodes.keys().next() {
                        self.canvas_state.selected_node = Some(first);
                    }
                    ui.close_menu();
                }
                if ui.button("Delete Selected (Del)").clicked() {
                    if let Some(sel) = self.canvas_state.selected_node.take() {
                        self.history.record(&self.graph, "Delete node");
                        self.graph.remove_node(sel);
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                    }
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Preferences...").clicked() {
                    self.preferences_dialog.open(&self.settings);
                    ui.close_menu();
                }
            });

            ui.menu_button("View", |ui| {
                if ui.button("Auto Layout Nodes (Ctrl+F)").clicked() {
                    self.execute_auto_layout();
                    ui.close_menu();
                }
                if ui.button("Reset Viewport").clicked() {
                    self.viewport_state.reset_view();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Save Layout...").clicked() {
                    if let Some(dock) = &self.dock_state {
                        if let Some(path) = rfd::FileDialog::new()
                            .add_filter("Layout JSON", &["json"])
                            .set_file_name("texturelab_layout.json")
                            .save_file()
                        {
                            if let Ok(json_str) = serde_json::to_string_pretty(dock) {
                                let _ = std::fs::write(&path, json_str);
                                self.status_message = format!("Saved layout to {}", path.display());
                            }
                        }
                    }
                    ui.close_menu();
                }
                if ui.button("Load Layout...").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("Layout JSON", &["json"])
                        .pick_file()
                    {
                        if let Ok(data) = std::fs::read_to_string(&path) {
                            match serde_json::from_str::<DockState<Tab>>(&data) {
                                Ok(loaded_dock) => {
                                    self.dock_state = Some(loaded_dock);
                                    self.status_message = format!("Loaded layout from {}", path.display());
                                }
                                Err(err) => {
                                    self.status_message = format!("Failed to load layout: {}", err);
                                }
                            }
                        }
                    }
                    ui.close_menu();
                }
                if ui.button("Reset to Default Layout").clicked() {
                    self.dock_state = Some(crate::ui::default_dock_layout());
                    self.viewport_state.is_undocked = false;
                    self.status_message = "Reset layout to default".to_string();
                    ui.close_menu();
                }
                ui.separator();
                if ui.button("Export Preflight (Ctrl+E)").clicked() {
                    if let Some(mut dock) = self.dock_state.take() {
                        if dock.find_tab(&Tab::ExportDrawer).is_none() {
                            dock.main_surface_mut().push_to_focused_leaf(Tab::ExportDrawer);
                        }
                        if let Some(loc) = dock.find_tab(&Tab::ExportDrawer) {
                            dock.set_active_tab(loc);
                        }
                        self.dock_state = Some(dock);
                    }
                    ui.close_menu();
                }
            });

            ui.menu_button("Nodes", |ui| {
                if ui.button("Quick Search Palette (Tab)").clicked() {
                    self.search_palette.open_at([-self.canvas_state.pan.x + 400.0, -self.canvas_state.pan.y + 250.0]);
                    ui.close_menu();
                }
                if ui.button("Auto Layout Graph (Ctrl+F)").clicked() {
                    self.execute_auto_layout();
                    ui.close_menu();
                }
                ui.separator();
                for desc in NODE_CATALOG.iter() {
                    let label = if let Some(k) = desc.hotkey {
                        format!("{} [{}]", desc.display_name, k)
                    } else {
                        desc.display_name.to_string()
                    };
                    if ui.button(label).clicked() {
                        let pos = [-self.canvas_state.pan.x + 300.0, -self.canvas_state.pan.y + 200.0];
                        self.spawn_node(desc, pos);
                        ui.close_menu();
                    }
                }
            });

            ui.menu_button("Help", |ui| {
                if ui.button("About TextureLAB").clicked() {
                    self.show_about_dialog = true;
                    ui.close_menu();
                }
            });

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(format!("v{}", self.version))
                        .color(crate::ui::theme::TEXT_MUTED),
                );
            });
        });
    }
}
