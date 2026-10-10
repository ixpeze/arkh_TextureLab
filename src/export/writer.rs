//! Direct disk atomic exporter and preflight validation pipeline (Phase 6).
//!
//! Provides multithreaded parallel writing using Rayon, atomic file replacement,
//! Windows reserved filename sanitization, case-insensitive collision detection,
//! and comprehensive export census reporting.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use crate::core::buffer::TextureBuffer;
use crate::export::codecs::save_png;
use crate::export::tga::save_tga_file;

/// Windows reserved device names that cannot be used as file names or stems.
pub const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Checks if a file name or path component matches a Windows reserved device name.
///
/// On Windows, reserved stems (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) are forbidden
/// regardless of file extension (e.g. `aux.png`, `con.tga` are reserved).
pub fn is_windows_reserved_name(name_or_path: &str) -> bool {
    let path = Path::new(name_or_path);

    // Check the file stem (e.g. "aux" in "aux.png")
    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
        let upper = stem.trim().to_ascii_uppercase();
        if WINDOWS_RESERVED_NAMES.contains(&upper.as_str()) {
            return true;
        }
    }

    // Also check the complete filename without extension
    if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
        let upper = file_name.trim().to_ascii_uppercase();
        if WINDOWS_RESERVED_NAMES.contains(&upper.as_str()) {
            return true;
        }
    }

    false
}

/// Sanitizes a file name for safe writing on Windows and POSIX filesystems.
///
/// - Replaces illegal Windows characters `< > : " / \ | ? *` and control codes with `_`.
/// - Prefixes Windows reserved names with `_` (e.g. `aux.png` -> `_aux.png`).
/// - Trims trailing dots and spaces.
pub fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "unnamed_texture.png".to_string();
    }

    let path = Path::new(trimmed);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("texture");
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    // Check if stem is a reserved name
    let clean_stem = if is_windows_reserved_name(stem) {
        format!("_{}", stem)
    } else {
        stem.to_string()
    };

    // Filter illegal characters
    let mut sanitized_stem = String::with_capacity(clean_stem.len());
    for c in clean_stem.chars() {
        if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || (c as u32) < 32 {
            sanitized_stem.push('_');
        } else {
            sanitized_stem.push(c);
        }
    }

    let sanitized_stem = sanitized_stem.trim_end_matches(['.', ' ']).to_string();
    let final_stem = if sanitized_stem.is_empty() {
        "_sanitized".to_string()
    } else {
        sanitized_stem
    };

    if ext.is_empty() {
        final_stem
    } else {
        format!("{}.{}", final_stem, ext)
    }
}

/// Supported export image formats.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExportFormat {
    /// Truevision TGA (24-bit RGB or 32-bit RGBA with official 2.0 footer).
    Tga,
    /// Portable Network Graphics (8-bit or 16-bit).
    Png,
    /// Automatically infer format from file extension.
    Auto,
}

/// Single texture buffer export task descriptor.
#[derive(Clone, Debug)]
pub struct ExportItem {
    /// In-memory image buffer to write.
    pub buffer: TextureBuffer,
    /// Absolute or relative destination file path.
    pub target_path: PathBuf,
    /// Target image codec format.
    pub format: ExportFormat,
    /// Bit depth for TGA exports (24 or 32). Defaults to 32.
    pub tga_bits: u8,
}

impl ExportItem {
    /// Constructs a new ExportItem inferring the codec from the target path extension.
    pub fn new(buffer: TextureBuffer, target_path: impl Into<PathBuf>) -> Self {
        let target_path = target_path.into();
        let format = match target_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref()
        {
            Some("tga") => ExportFormat::Tga,
            Some("png") => ExportFormat::Png,
            _ => ExportFormat::Auto,
        };

        Self {
            buffer,
            target_path,
            format,
            tga_bits: 32,
        }
    }

    /// Sets the export format explicitly.
    pub fn with_format(mut self, format: ExportFormat) -> Self {
        self.format = format;
        self
    }

    /// Sets TGA bit depth (24 or 32).
    pub fn with_tga_bits(mut self, bits: u8) -> Self {
        self.tga_bits = bits;
        self
    }
}

/// Preflight validation report before disk execution.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct PreflightReport {
    /// True if all items passed validation with zero fatal errors.
    pub is_valid: bool,
    /// Number of items analyzed.
    pub items_checked: usize,
    /// Conflicting file destination paths (case-insensitive collisions).
    pub collisions: Vec<String>,
    /// Windows reserved file names detected.
    pub reserved_names: Vec<String>,
    /// Invalid or unsafe target paths (e.g. traversal or empty).
    pub invalid_paths: Vec<String>,
    /// Full list of fatal error messages.
    pub errors: Vec<String>,
    /// Non-fatal diagnostic warnings.
    pub warnings: Vec<String>,
}

/// Comprehensive report produced following direct-to-disk export execution.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ExportReport {
    /// List of successfully written destination files.
    pub files_written: Vec<PathBuf>,
    /// Total bytes written across all output files.
    pub bytes_written: u64,
    /// Total wall-clock time elapsed in milliseconds.
    pub elapsed_ms: u128,
    /// Error messages encountered during preflight or writing.
    pub errors: Vec<String>,
}

impl ExportReport {
    /// Returns true if all files were written with zero errors.
    pub fn is_success(&self) -> bool {
        self.errors.is_empty() && !self.files_written.is_empty()
    }
}

/// Parallel atomic direct disk exporter.
pub struct ExportWriter;

impl ExportWriter {
    /// Performs preflight validation on export items without modifying any files on disk.
    ///
    /// Checks for:
    /// - Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
    /// - Case-insensitive destination collisions (preventing Windows NTFS write races).
    /// - Path traversals (`..` escaping target directories).
    /// - Zero-dimension or unallocated texture buffers.
    pub fn preflight(items: &[ExportItem]) -> PreflightReport {
        let mut report = PreflightReport {
            is_valid: true,
            items_checked: items.len(),
            ..Default::default()
        };

        if items.is_empty() {
            report.is_valid = false;
            report.errors.push("No export items specified.".to_string());
            return report;
        }

        // Canonical case-insensitive collision tracking
        let mut seen_normalized_paths = HashSet::new();

        for (idx, item) in items.iter().enumerate() {
            let path_str = item.target_path.to_string_lossy().to_string();

            // 1. Buffer validity check
            if item.buffer.width == 0 || item.buffer.height == 0 || item.buffer.image.as_raw().is_empty() {
                report.is_valid = false;
                let err = format!(
                    "Item #{} (destination {:?}) has empty dimensions ({}x{}).",
                    idx + 1,
                    item.target_path,
                    item.buffer.width,
                    item.buffer.height
                );
                report.errors.push(err);
            }

            // 2. Windows reserved filename check
            if let Some(file_name) = item.target_path.file_name().and_then(|f| f.to_str()) {
                if is_windows_reserved_name(file_name) {
                    report.is_valid = false;
                    let err = format!(
                        "Filename {:?} is a Windows reserved device name and cannot be written.",
                        file_name
                    );
                    report.reserved_names.push(file_name.to_string());
                    report.errors.push(err);
                }
            } else {
                report.is_valid = false;
                report
                    .invalid_paths
                    .push("Missing valid file name in target path.".to_string());
                report
                    .errors
                    .push("Missing valid file name in target path.".to_string());
            }

            // 3. Path traversal check
            if item
                .target_path
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
            {
                report.warnings.push(format!(
                    "Target path {:?} contains relative parent directory traversal ('..').",
                    path_str
                ));
            }

            // 4. Case-insensitive collision detection
            let normalized = path_str.to_ascii_lowercase().replace('\\', "/");
            if !seen_normalized_paths.insert(normalized) {
                report.is_valid = false;
                let err = format!(
                    "Case-insensitive destination collision detected for path: {:?}",
                    path_str
                );
                report.collisions.push(path_str.clone());
                report.errors.push(err);
            }
        }

        report
    }

    /// Executes multithreaded parallel export directly to disk with atomic writes.
    ///
    /// Each file is written first to a unique temporary file in the destination directory,
    /// verified for non-zero payload, and then atomically moved to the destination.
    /// This prevents partially written or corrupted files during crashes or power loss.
    pub fn execute_export(items: &[ExportItem]) -> ExportReport {
        let start = Instant::now();

        // 1. Run Preflight Safety Checks
        let preflight = Self::preflight(items);
        if !preflight.is_valid {
            return ExportReport {
                files_written: Vec::new(),
                bytes_written: 0,
                elapsed_ms: start.elapsed().as_millis(),
                errors: preflight.errors,
            };
        }

        // 2. Execute Parallel Atomic Writes via Rayon
        let results: Vec<Result<(PathBuf, u64), String>> = items
            .par_iter()
            .map(|item| Self::write_single_atomic(item))
            .collect();

        // 3. Assemble Export Execution Report
        let mut files_written = Vec::with_capacity(items.len());
        let mut bytes_written = 0u64;
        let mut errors = Vec::new();

        for res in results {
            match res {
                Ok((path, bytes)) => {
                    files_written.push(path);
                    bytes_written += bytes;
                }
                Err(err) => {
                    errors.push(err);
                }
            }
        }

        ExportReport {
            files_written,
            bytes_written,
            elapsed_ms: start.elapsed().as_millis(),
            errors,
        }
    }

    /// Writes a single item atomically to its target path.
    fn write_single_atomic(item: &ExportItem) -> Result<(PathBuf, u64), String> {
        let dest_path = &item.target_path;
        let parent = dest_path.parent().unwrap_or_else(|| Path::new("."));

        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {:?}: {}", parent, e))?;

        // Generate unique temporary file name in the target directory
        let file_name = dest_path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("texture");
        let now_nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let temp_filename = format!(".tmp_{}_{}_{}.tlab_tmp", file_name, std::process::id(), now_nanos);
        let temp_path = parent.join(temp_filename);

        // Determine effective codec format
        let effective_format = match item.format {
            ExportFormat::Tga => ExportFormat::Tga,
            ExportFormat::Png => ExportFormat::Png,
            ExportFormat::Auto => {
                if dest_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("tga"))
                    .unwrap_or(false)
                {
                    ExportFormat::Tga
                } else {
                    ExportFormat::Png
                }
            }
        };

        // Write image to temporary file
        let write_result = match effective_format {
            ExportFormat::Tga => {
                save_tga_file(&item.buffer, &temp_path, item.tga_bits)
                    .map_err(|e| format!("TGA write error for {:?}: {}", dest_path, e))
            }
            ExportFormat::Png | ExportFormat::Auto => {
                save_png(&item.buffer, &temp_path)
                    .map_err(|e| format!("PNG write error for {:?}: {}", dest_path, e))
            }
        };

        if let Err(err) = write_result {
            let _ = fs::remove_file(&temp_path);
            return Err(err);
        }

        // Verify temporary file exists and is non-empty
        let temp_meta = fs::metadata(&temp_path).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            format!("Failed to stat temp file {:?}: {}", temp_path, e)
        })?;

        if temp_meta.len() == 0 {
            let _ = fs::remove_file(&temp_path);
            return Err(format!(
                "Temporary write produced 0 bytes for {:?}",
                dest_path
            ));
        }

        // On Windows, if destination file exists, delete it first to ensure atomic rename
        if dest_path.exists() {
            let _ = fs::remove_file(dest_path);
        }

        // Atomic Rename into final destination
        fs::rename(&temp_path, dest_path).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            format!("Failed to rename temp file to {:?}: {}", dest_path, e)
        })?;

        // Read destination metadata to verify written payload
        let dest_meta = fs::metadata(dest_path)
            .map_err(|e| format!("Failed to stat destination {:?}: {}", dest_path, e))?;

        Ok((dest_path.clone(), dest_meta.len()))
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_windows_reserved_names() {
        // Direct reserved stems
        assert!(is_windows_reserved_name("aux.png"));
        assert!(is_windows_reserved_name("con.tga"));
        assert!(is_windows_reserved_name("PRN.PNG"));
        assert!(is_windows_reserved_name("nul.exr"));
        assert!(is_windows_reserved_name("COM1.jpg"));
        assert!(is_windows_reserved_name("LPT3.tga"));

        // Normal files must not be flagged
        assert!(!is_windows_reserved_name("normal_map.png"));
        assert!(!is_windows_reserved_name("T_Concrete_ORM.tga"));
        assert!(!is_windows_reserved_name("auxiliary_mask.png"));

        // Sanitization must eliminate reserved stems
        let sanitized_aux = sanitize_filename("aux.png");
        assert_eq!(sanitized_aux, "_aux.png");
        assert!(!is_windows_reserved_name(&sanitized_aux));

        let sanitized_con = sanitize_filename("con.tga");
        assert_eq!(sanitized_con, "_con.tga");
        assert!(!is_windows_reserved_name(&sanitized_con));

        // Sanitization of illegal characters
        let sanitized_chars = sanitize_filename("invalid:name*file?.png");
        assert_eq!(sanitized_chars, "invalid_name_file_.png");
    }

    #[test]
    pub fn test_case_insensitive_collision_detection() {
        let buf = TextureBuffer::solid_color(32, 32, 128, 128, 128, 255);
        let items = vec![
            ExportItem::new(buf.clone(), PathBuf::from("exports/concrete_normal.png")),
            ExportItem::new(buf, PathBuf::from("exports/Concrete_Normal.png")),
        ];

        let preflight = ExportWriter::preflight(&items);
        assert!(!preflight.is_valid);
        assert_eq!(preflight.collisions.len(), 1);
        assert!(preflight.errors[0].contains("collision detected"));
    }

    #[test]
    pub fn test_reserved_name_preflight_rejection() {
        let buf = TextureBuffer::solid_color(16, 16, 255, 0, 0, 255);
        let items = vec![ExportItem::new(buf, PathBuf::from("exports/con.png"))];

        let preflight = ExportWriter::preflight(&items);
        assert!(!preflight.is_valid);
        assert_eq!(preflight.reserved_names.len(), 1);
        assert_eq!(preflight.reserved_names[0], "con.png");
    }

    #[test]
    pub fn test_atomic_export_tga_and_png() {
        let temp_dir = std::env::temp_dir().join(format!(
            "texturelab_test_p6_writer_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::create_dir_all(&temp_dir);

        let buf1 = TextureBuffer::solid_color(64, 64, 255, 128, 0, 0); // TGA with A=0
        let buf2 = TextureBuffer::solid_color(64, 64, 0, 255, 128, 255); // PNG

        let tga_path = temp_dir.join("T_Wall_Normal.tga");
        let png_path = temp_dir.join("T_Wall_Albedo.png");

        let items = vec![
            ExportItem::new(buf1, &tga_path),
            ExportItem::new(buf2, &png_path),
        ];

        let report = ExportWriter::execute_export(&items);
        assert!(report.is_success());
        assert_eq!(report.files_written.len(), 2);
        assert_eq!(report.errors.len(), 0);
        assert!(report.bytes_written > 0);

        // Verify TGA file on disk has exact 18 + W*H*4 + 26 byte size
        assert!(tga_path.exists());
        let tga_meta = fs::metadata(&tga_path).unwrap();
        let expected_tga_size = (18 + 64 * 64 * 4 + 26) as u64;
        assert_eq!(tga_meta.len(), expected_tga_size);

        // Verify PNG exists and is non-empty
        assert!(png_path.exists());
        let png_meta = fs::metadata(&png_path).unwrap();
        assert!(png_meta.len() > 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
