//! Batch Processor Dock Tab UI Panel (Phase 3).
//!
//! Provides queue management for multi-folder texture set processing,
//! template and preset assignment, sequential execution controls, live progress,
//! and activity logging.

use egui::{Color32, RichText, ScrollArea, Ui};

use crate::batch::{BatchError, BatchProcessor, BatchStatus};
use crate::export::{ExportPreset, UserPreset};
use crate::templates::builtin_templates;
use crate::ui::theme::{
    ACCENT_AMBER, BG_CARD, BG_INSET, BG_PANEL, BORDER_DARK, BORDER_SUBTLE,
    TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
};
use crate::ui::validator::{COLOR_FAIL, COLOR_PASS, COLOR_WARN};

/// Renders the Batch Processor dockable tab panel.
pub fn show_batch_panel(
    ui: &mut Ui,
    batch_processor: &mut BatchProcessor,
    user_presets: &[UserPreset],
    status_message: &mut String,
) {
    ui.add_space(6.0);

    // 1. Panel Header & Description
    ui.horizontal(|ui| {
        ui.label(
            RichText::new("BATCH TEXTURE SET PROCESSOR")
                .strong()
                .color(ACCENT_AMBER)
                .size(13.0),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            let count = batch_processor.jobs.len();
            ui.label(
                RichText::new(format!("{} queued set(s)", count))
                    .color(TEXT_MUTED)
                    .size(11.0),
            );
        });
    });
    ui.label(
        RichText::new(
            "Queue texture set folders, automatically classify PBR map roles, bind graph templates, and batch-export using presets.",
        )
        .color(TEXT_SECONDARY)
        .size(11.0),
    );

    ui.add_space(8.0);

    // 2. Main Action Toolbar & Global Batch Configuration
    render_batch_toolbar(ui, batch_processor, user_presets, status_message);

    ui.add_space(8.0);

    // 3. Overall Progress Bar (if queue has jobs or is running)
    if !batch_processor.jobs.is_empty() {
        render_batch_progress_bar(ui, batch_processor);
        ui.add_space(8.0);
    }

    // 4. Split Layout: Queue Table (top / main) + Activity Log (bottom)
    let total_height = ui.available_height();
    let queue_height = (total_height * 0.65).max(180.0);

    // Queue Table Container
    egui::Frame::NONE
        .fill(BG_PANEL)
        .stroke(egui::Stroke::new(1.0_f32, BORDER_DARK))
        .inner_margin(8.0)
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.strong(RichText::new("Texture Set Queue").color(TEXT_PRIMARY));
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .button("Clear Completed")
                        .on_hover_text("Remove completed jobs from the queue")
                        .clicked()
                    {
                        batch_processor.jobs.retain(|j| !j.status.is_completed());
                    }
                });
            });

            ui.add_space(4.0);

            if batch_processor.jobs.is_empty() {
                render_empty_queue_dropzone(ui, batch_processor);
            } else {
                ScrollArea::vertical()
                    .max_height(queue_height)
                    .show(ui, |ui| {
                        render_queue_table(ui, batch_processor);
                    });
            }
        });

    ui.add_space(8.0);

    // Activity Log Container
    egui::Frame::NONE
        .fill(BG_INSET)
        .stroke(egui::Stroke::new(1.0_f32, BORDER_DARK))
        .inner_margin(8.0)
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.strong(RichText::new("Processor Activity Log").color(TEXT_SECONDARY));
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("Clear Log").clicked() {
                        batch_processor.clear_logs();
                    }
                });
            });

            ui.add_space(4.0);

            ScrollArea::vertical()
                .auto_shrink([false, false])
                .stick_to_bottom(true)
                .show(ui, |ui| {
                    for line in &batch_processor.log_messages {
                        let color = if line.contains("Error") || line.contains("Failed") {
                            COLOR_FAIL
                        } else if line.contains("Successfully") || line.contains("Completed") {
                            COLOR_PASS
                        } else if line.contains("Processing") {
                            ACCENT_AMBER
                        } else {
                            TEXT_MUTED
                        };
                        ui.label(RichText::new(line).color(color).monospace().size(11.0));
                    }
                });
        });
}

/// Renders the action buttons and default template / preset dropdowns.
fn render_batch_toolbar(
    ui: &mut Ui,
    batch_processor: &mut BatchProcessor,
    user_presets: &[UserPreset],
    status_message: &mut String,
) {
    egui::Frame::NONE
        .fill(BG_CARD)
        .stroke(egui::Stroke::new(1.0_f32, BORDER_SUBTLE))
        .inner_margin(8.0)
        .show(ui, |ui| {
            ui.horizontal_wrapped(|ui| {
                // "Add Folder" button
                if ui
                    .button(RichText::new("+ Add Folder...").strong().color(TEXT_PRIMARY))
                    .on_hover_text("Select a folder containing PBR texture maps to queue")
                    .clicked()
                {
                    if let Some(folder) = rfd::FileDialog::new().pick_folder() {
                        let _ = batch_processor.add_folder(folder, None, None);
                    }
                }

                ui.add_space(4.0);

                // Run / Stop controls
                let is_running = batch_processor.is_running;
                let has_pending = batch_processor.jobs.iter().any(|j| j.status.is_pending());

                if is_running {
                    if ui
                        .button(RichText::new("⏸ Stop Batch").color(COLOR_WARN).strong())
                        .clicked()
                    {
                        batch_processor.is_running = false;
                        batch_processor.log("Batch processing paused by user.");
                    }
                } else if ui
                    .add_enabled(
                        has_pending,
                        egui::Button::new(RichText::new("▶ Run All").color(Color32::BLACK).strong())
                            .fill(ACCENT_AMBER),
                    )
                    .on_hover_text("Execute all pending batch jobs sequentially")
                    .clicked()
                {
                    batch_processor.is_running = true;
                    batch_processor.log("Starting batch queue execution...");
                }

                if ui
                    .add_enabled(
                        has_pending && !is_running,
                        egui::Button::new("Process Next Set"),
                    )
                    .on_hover_text("Process only the next pending job in the queue")
                    .clicked()
                {
                    match batch_processor.process_next() {
                        Ok(rep) => {
                            *status_message = format!("Exported batch set: {}", rep.set_name);
                        }
                        Err(BatchError::NoPendingJobs) => {
                            *status_message = "No pending jobs in queue".to_string();
                        }
                        Err(e) => {
                            *status_message = format!("Batch error: {}", e);
                        }
                    }
                }

                ui.separator();

                // Reset queue statuses
                if ui
                    .button("Reset All")
                    .on_hover_text("Reset all jobs back to Pending state")
                    .clicked()
                {
                    batch_processor.reset_all();
                }

                if ui
                    .button("Clear Queue")
                    .on_hover_text("Remove all jobs from queue")
                    .clicked()
                {
                    batch_processor.clear_jobs();
                }
            });

            ui.add_space(6.0);

            // Defaults configuration bar
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new("Template:").color(TEXT_SECONDARY));
                let templates = builtin_templates();
                egui::ComboBox::from_id_salt("batch_default_template")
                    .selected_text(&batch_processor.selected_template_name)
                    .show_ui(ui, |ui| {
                        for t in templates {
                            let is_sel = batch_processor.selected_template_name == t.name;
                            if ui.selectable_label(is_sel, t.name).clicked() {
                                batch_processor.selected_template_name = t.name.to_string();
                            }
                        }
                    });

                ui.add_space(8.0);

                ui.label(RichText::new("Export Preset:").color(TEXT_SECONDARY));
                let presets = ExportPreset::builtin_presets();
                let current_id = &batch_processor.selected_preset_id;
                let current_label = presets
                    .iter()
                    .find(|p| &p.id == current_id)
                    .map(|p| p.name.as_str())
                    .unwrap_or(current_id.as_str());

                egui::ComboBox::from_id_salt("batch_default_preset")
                    .selected_text(current_label)
                    .show_ui(ui, |ui| {
                        for p in presets {
                            let is_sel = batch_processor.selected_preset_id == p.id;
                            if ui.selectable_label(is_sel, &p.name).clicked() {
                                batch_processor.selected_preset_id = p.id;
                            }
                        }
                        for up in user_presets {
                            let is_sel = batch_processor.selected_preset_id == up.name;
                            if ui.selectable_label(is_sel, format!("User: {}", up.name)).clicked() {
                                batch_processor.selected_preset_id = up.name.clone();
                            }
                        }
                    });

                ui.add_space(8.0);

                // Optional global export folder override
                ui.label(RichText::new("Target Export Dir:").color(TEXT_SECONDARY));
                let mut dir_str = batch_processor
                    .default_output_dir
                    .as_ref()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Default: {folder}/exports".to_string());

                let edit = ui.add(egui::TextEdit::singleline(&mut dir_str).desired_width(160.0));
                if edit.lost_focus() && dir_str != "Default: {folder}/exports" {
                    if dir_str.trim().is_empty() {
                        batch_processor.default_output_dir = None;
                    } else {
                        batch_processor.default_output_dir = Some(dir_str.into());
                    }
                }

                if ui.button("Browse...").clicked() {
                    if let Some(folder) = rfd::FileDialog::new().pick_folder() {
                        batch_processor.default_output_dir = Some(folder);
                    }
                }
            });
        });
}

/// Renders the overall progress bar and active set name.
fn render_batch_progress_bar(ui: &mut Ui, batch_processor: &BatchProcessor) {
    let progress = batch_processor.progress();
    let ratio = batch_processor.progress_ratio();

    let text = if let Some(set_name) = &progress.current_set_name {
        format!(
            "Processing [{}/{}]: {} ({:.0}%)",
            progress.current + 1,
            progress.total,
            set_name,
            ratio * 100.0
        )
    } else {
        format!(
            "Completed {} of {} sets ({:.0}%)",
            progress.current,
            progress.total,
            ratio * 100.0
        )
    };

    ui.horizontal(|ui| {
        let bar = egui::ProgressBar::new(ratio)
            .show_percentage()
            .text(text)
            .animate(batch_processor.is_running);
        ui.add(bar);
    });
}

/// Renders empty state drop zone when queue has no jobs.
fn render_empty_queue_dropzone(ui: &mut Ui, batch_processor: &mut BatchProcessor) {
    ui.vertical_centered(|ui| {
        ui.add_space(20.0);
        ui.label(
            RichText::new("📂 No texture sets in queue")
                .color(TEXT_MUTED)
                .size(14.0),
        );
        ui.label(
            RichText::new(
                "Click '+ Add Folder...' above or drag folders directly into TextureLab.",
            )
            .color(TEXT_SECONDARY)
            .size(11.0),
        );
        ui.add_space(8.0);
        if ui.button("Browse for Texture Folder...").clicked() {
            if let Some(folder) = rfd::FileDialog::new().pick_folder() {
                let _ = batch_processor.add_folder(folder, None, None);
            }
        }
        ui.add_space(20.0);
    });
}

/// Renders the tabular list of queued batch jobs.
fn render_queue_table(ui: &mut Ui, batch_processor: &mut BatchProcessor) {
    let mut to_remove = None;
    let mut to_rerun = None;

    egui::Grid::new("batch_queue_grid")
        .striped(true)
        .min_col_width(70.0)
        .spacing([12.0, 6.0])
        .show(ui, |ui| {
            // Header
            ui.strong(RichText::new("#").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Status").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Folder / Set").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Template").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Preset").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Export Path").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Result").color(TEXT_SECONDARY));
            ui.strong(RichText::new("Action").color(TEXT_SECONDARY));
            ui.end_row();

            for (idx, job) in batch_processor.jobs.iter().enumerate() {
                // Index
                ui.label(format!("{}", idx + 1));

                // Status Badge
                match &job.status {
                    BatchStatus::Pending => {
                        ui.colored_label(Color32::from_rgb(100, 180, 240), "[Pending]");
                    }
                    BatchStatus::Processing => {
                        ui.colored_label(ACCENT_AMBER, "[Processing...]");
                    }
                    BatchStatus::Completed { files_written, elapsed_ms } => {
                        ui.colored_label(
                            COLOR_PASS,
                            format!("[Done: {} maps in {}ms]", files_written, elapsed_ms),
                        );
                    }
                    BatchStatus::Failed(err) => {
                        ui.colored_label(COLOR_FAIL, "[Failed]").on_hover_text(err);
                    }
                }

                // Folder Name
                let folder_name = job.folder_name();
                ui.label(RichText::new(&folder_name).strong().color(TEXT_PRIMARY))
                    .on_hover_text(format!("Input path:\n{}", job.input_dir.display()));

                // Template Name
                ui.label(&job.template.metadata.name);

                // Preset Name
                ui.label(&job.preset_name);

                // Export Path
                let out_display = job
                    .output_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("exports");
                ui.label(out_display)
                    .on_hover_text(format!("Output path:\n{}", job.output_dir.display()));

                // Result Summary
                match &job.status {
                    BatchStatus::Completed { files_written, .. } => {
                        ui.label(format!("{} written", files_written));
                    }
                    BatchStatus::Failed(err) => {
                        let short = if err.len() > 24 {
                            format!("{}...", &err[..24])
                        } else {
                            err.clone()
                        };
                        ui.colored_label(COLOR_FAIL, short).on_hover_text(err);
                    }
                    _ => {
                        ui.label(RichText::new("—").color(TEXT_MUTED));
                    }
                }

                // Row Actions
                ui.horizontal(|ui| {
                    if ui.small_button("✕").on_hover_text("Remove from queue").clicked() {
                        to_remove = Some(idx);
                    }
                    if !job.status.is_pending()
                        && !job.status.is_processing()
                        && ui.small_button("↻").on_hover_text("Re-queue this job").clicked()
                    {
                        to_rerun = Some(idx);
                    }
                    if ui.small_button("📁").on_hover_text("Open folder").clicked() {
                        let target = if job.output_dir.exists() {
                            &job.output_dir
                        } else {
                            &job.input_dir
                        };
                        #[cfg(target_os = "windows")]
                        let _ = std::process::Command::new("explorer").arg(target).spawn();
                        #[cfg(target_os = "macos")]
                        let _ = std::process::Command::new("open").arg(target).spawn();
                        #[cfg(target_os = "linux")]
                        let _ = std::process::Command::new("xdg-open").arg(target).spawn();
                    }
                });

                ui.end_row();
            }
        });

    if let Some(idx) = to_remove {
        batch_processor.remove_job(idx);
    }
    if let Some(idx) = to_rerun {
        batch_processor.jobs[idx].status = BatchStatus::Pending;
    }
}
