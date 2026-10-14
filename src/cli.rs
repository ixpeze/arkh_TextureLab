//! Headless CLI Engine & Pipeline Runner (Phase 3).
//!
//! Provides non-interactive batch graph execution for studio automation,
//! build scripts, and CI/CD pipelines.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::batch::processor::{
    bind_texture_input_nodes, collect_export_items, determine_asset_stem, scan_texture_directory,
};
use crate::core::buffer::FilterType;
use crate::export::preset_designer::{load_presets, UserPreset};
use crate::export::writer::{ExportFormat, ExportReport, ExportWriter};
use crate::export::ExportPreset;
use crate::graph::evaluator::GraphEvaluator;
use crate::graph::model::{NodeParam, ProjectFile};
use crate::templates::builtin_templates;

/// Command-line configuration parameters.
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct CliArgs {
    /// Path to project graph file (`.tlab` or `.json`) or starter template name.
    pub graph: Option<PathBuf>,
    /// Directory containing input source texture maps.
    pub input: Option<PathBuf>,
    /// Directory where exported textures are written (defaults to `<input>/exports`).
    pub output: Option<PathBuf>,
    /// Export preset identifier or name (built-in or from `presets.json`).
    pub preset: Option<String>,
    /// Working resolution override in `WIDTHxHEIGHT` format.
    pub resolution: Option<(u32, u32)>,
    /// Output file format override (`PNG`, `TGA`, `EXR`, `JPG`, `WEBP`, `BMP`).
    pub format: Option<String>,
    /// Whether help was requested.
    pub help: bool,
    /// Whether version was requested.
    pub version: bool,
    /// Whether to suppress informational progress messages.
    pub quiet: bool,
    /// Whether to print extra diagnostic details.
    pub verbose: bool,
}

impl CliArgs {
    /// Parses CLI arguments from an iterator of string arguments.
    pub fn parse<I, T>(args: I) -> Result<Self, String>
    where
        I: IntoIterator<Item = T>,
        T: AsRef<str>,
    {
        let mut cli = CliArgs::default();
        let items: Vec<String> = args.into_iter().map(|s| s.as_ref().to_string()).collect();

        // Skip binary name if present
        let mut idx = if !items.is_empty()
            && (items[0].ends_with("texturelab-cli")
                || items[0].ends_with("texturelab-cli.exe")
                || items[0].ends_with("texturelab")
                || items[0].ends_with("texturelab.exe")
                || items[0].contains("target"))
        {
            1
        } else {
            0
        };

        while idx < items.len() {
            let arg = &items[idx];

            if arg == "-h" || arg == "--help" {
                cli.help = true;
                idx += 1;
            } else if arg == "-v" || arg == "--version" {
                cli.version = true;
                idx += 1;
            } else if arg == "-q" || arg == "--quiet" {
                cli.quiet = true;
                idx += 1;
            } else if arg == "--verbose" {
                cli.verbose = true;
                idx += 1;
            } else if arg == "-g" || arg == "--graph" {
                idx += 1;
                if idx >= items.len() {
                    return Err("Missing argument value for --graph".to_string());
                }
                cli.graph = Some(PathBuf::from(&items[idx]));
                idx += 1;
            } else if let Some(val) = arg.strip_prefix("--graph=") {
                cli.graph = Some(PathBuf::from(val));
                idx += 1;
            } else if arg == "-i" || arg == "--input" {
                idx += 1;
                if idx >= items.len() {
                    return Err("Missing argument value for --input".to_string());
                }
                cli.input = Some(PathBuf::from(&items[idx]));
                idx += 1;
            } else if let Some(val) = arg.strip_prefix("--input=") {
                cli.input = Some(PathBuf::from(val));
                idx += 1;
            } else if arg == "-o" || arg == "--output" {
                idx += 1;
                if idx >= items.len() {
                    return Err("Missing argument value for --output".to_string());
                }
                cli.output = Some(PathBuf::from(&items[idx]));
                idx += 1;
            } else if let Some(val) = arg.strip_prefix("--output=") {
                cli.output = Some(PathBuf::from(val));
                idx += 1;
            } else if arg == "-p" || arg == "--preset" {
                idx += 1;
                if idx >= items.len() {
                    return Err("Missing argument value for --preset".to_string());
                }
                cli.preset = Some(items[idx].clone());
                idx += 1;
            } else if let Some(val) = arg.strip_prefix("--preset=") {
                cli.preset = Some(val.to_string());
                idx += 1;
            } else if arg == "-r" || arg == "--resolution" {
                idx += 1;
                if idx >= items.len() {
                    return Err("Missing argument value for --resolution".to_string());
                }
                cli.resolution = Some(parse_resolution(&items[idx])?);
                idx += 1;
            } else if let Some(val) = arg.strip_prefix("--resolution=") {
                cli.resolution = Some(parse_resolution(val)?);
                idx += 1;
            } else if arg == "-f" || arg == "--format" {
                idx += 1;
                if idx >= items.len() {
                    return Err("Missing argument value for --format".to_string());
                }
                cli.format = Some(parse_format(&items[idx])?);
                idx += 1;
            } else if let Some(val) = arg.strip_prefix("--format=") {
                cli.format = Some(parse_format(val)?);
                idx += 1;
            } else {
                return Err(format!(
                    "Unknown argument '{}'. Use --help for available options.",
                    arg
                ));
            }
        }

        Ok(cli)
    }
}

/// Parses a resolution string like "2048x2048", "4096x2048", or "2048" into (u32, u32).
pub fn parse_resolution(s: &str) -> Result<(u32, u32), String> {
    let lower = s.trim().to_lowercase();
    if let Some((w_str, h_str)) = lower.split_once('x') {
        let w: u32 = w_str
            .trim()
            .parse()
            .map_err(|_| format!("Invalid width in resolution '{}'", s))?;
        let h: u32 = h_str
            .trim()
            .parse()
            .map_err(|_| format!("Invalid height in resolution '{}'", s))?;
        if w == 0 || h == 0 {
            return Err(format!("Resolution dimensions must be greater than zero: '{}'", s));
        }
        Ok((w, h))
    } else if let Ok(val) = lower.parse::<u32>() {
        if val == 0 {
            return Err(format!("Resolution dimension must be greater than zero: '{}'", s));
        }
        Ok((val, val))
    } else {
        Err(format!(
            "Invalid resolution format '{}'. Expected WIDTHxHEIGHT (e.g. '2048x2048') or SIZE (e.g. '2048')",
            s
        ))
    }
}

/// Parses and validates an image format override string.
pub fn parse_format(s: &str) -> Result<String, String> {
    let fmt = s.trim().to_lowercase();
    match fmt.as_str() {
        "png" | "tga" | "exr" | "jpg" | "jpeg" | "webp" | "bmp" => Ok(fmt),
        _ => Err(format!(
            "Unsupported format '{}'. Supported formats: PNG, TGA, EXR, JPG, WEBP, BMP",
            s
        )),
    }
}

/// Resolves an export preset by identifier or name across built-in and user presets.
pub fn resolve_cli_preset(preset_name: &str) -> Option<ExportPreset> {
    let trimmed = preset_name.trim();

    // 1. Direct ID match from built-ins
    if let Some(p) = ExportPreset::find_by_id(trimmed) {
        return Some(p);
    }

    // 2. Canonical built-in engine aliases
    let normalized = trimmed.to_lowercase().replace('_', " ");
    if normalized == "ue5 orm" || normalized == "ue5" || normalized == "unreal" || normalized == "unreal engine 5" {
        return ExportPreset::find_by_id("ue5");
    }
    if normalized == "unity maskmap" || normalized == "unity" || normalized == "unity urp" || normalized == "unity hdrp" {
        return ExportPreset::find_by_id("unity");
    }
    if normalized == "blender rma" || normalized == "blender" || normalized == "blender principled" {
        return ExportPreset::find_by_id("blender");
    }
    if normalized == "substance" || normalized == "substance painter" {
        return ExportPreset::find_by_id("substance");
    }
    if normalized == "cryengine" {
        return ExportPreset::find_by_id("cryengine");
    }

    // 3. Built-in name or ID case-insensitive match (with underscore/space tolerance)
    for p in ExportPreset::builtin_presets() {
        if p.name.eq_ignore_ascii_case(trimmed)
            || p.id.eq_ignore_ascii_case(trimmed)
            || p.name.to_lowercase().replace('_', " ") == normalized
            || p.id.to_lowercase().replace('_', " ") == normalized
        {
            return Some(p);
        }
    }

    // 4. User presets from presets.json
    let user_presets = load_presets();
    for up in user_presets {
        if up.name.eq_ignore_ascii_case(trimmed)
            || up.name.to_lowercase().replace('_', " ") == normalized
        {
            return Some(up.to_export_preset());
        }
    }

    // 5. Default user presets catalog
    for up in UserPreset::default_presets() {
        if up.name.eq_ignore_ascii_case(trimmed)
            || up.name.to_lowercase().replace('_', " ") == normalized
        {
            return Some(up.to_export_preset());
        }
    }

    None
}

/// Loads a project graph from a file path or resolves a starter template.
pub fn load_graph_file(path_or_template: &Path) -> Result<ProjectFile, String> {
    // 1. Direct path check
    if path_or_template.exists() && path_or_template.is_file() {
        return ProjectFile::load_from_file(path_or_template)
            .map_err(|e| format!("Failed to load graph file {:?}: {}", path_or_template, e));
    }

    // 2. Try relative to templates directory
    let str_val = path_or_template.to_string_lossy();
    let template_path = Path::new("assets/templates").join(&*str_val);
    if template_path.exists() && template_path.is_file() {
        return ProjectFile::load_from_file(&template_path)
            .map_err(|e| format!("Failed to load graph file {:?}: {}", template_path, e));
    }

    // 3. Match against built-in starter templates gallery
    let clean_str = str_val
        .trim_end_matches(".tlab")
        .trim_end_matches(".json")
        .to_lowercase()
        .replace('_', " ");

    for entry in builtin_templates() {
        let entry_clean = entry.name.to_lowercase();
        if entry_clean == clean_str
            || entry_clean.replace(' ', "") == clean_str.replace(' ', "")
        {
            return entry
                .load_project()
                .map_err(|e| format!("Failed to load built-in template '{}': {}", entry.name, e));
        }
    }

    Err(format!(
        "Graph file or template not found: {:?}. Ensure file exists or use a recognized template name.",
        path_or_template
    ))
}

/// Result of a CLI execution run.
#[derive(Clone, Debug)]
pub enum CliRunResult {
    /// Command printed help or version info and exited cleanly.
    HandledInfo,
    /// Batch graph executed successfully.
    Success(ExportReport),
}

/// Executes the full headless CLI pipeline given pre-parsed arguments.
pub fn execute_cli(args: &CliArgs) -> Result<CliRunResult, String> {
    if args.help {
        print_help();
        return Ok(CliRunResult::HandledInfo);
    }

    if args.version {
        print_version();
        return Ok(CliRunResult::HandledInfo);
    }

    let graph_path = args
        .graph
        .as_ref()
        .ok_or_else(|| "Missing required argument: --graph <path.tlab> (use --help for usage)".to_string())?;

    let input_dir = args
        .input
        .as_ref()
        .ok_or_else(|| "Missing required argument: --input <dir/> (use --help for usage)".to_string())?;

    if !input_dir.exists() {
        return Err(format!(
            "Input directory does not exist: {:?}",
            input_dir
        ));
    }
    if !input_dir.is_dir() {
        return Err(format!(
            "Input path is not a directory: {:?}",
            input_dir
        ));
    }

    let output_dir = args
        .output
        .clone()
        .unwrap_or_else(|| input_dir.join("exports"));

    let log_info = !args.quiet;

    if log_info {
        println!("TextureLab CLI v{} — Headless PBR Authoring Engine", crate::version());
        println!("--------------------------------------------------");
    }

    // 1. Load Graph
    let load_start = Instant::now();
    let mut project = load_graph_file(graph_path)?;
    if log_info {
        println!(
            "[1/5] Loaded graph: '{}' ({} nodes, {} edges) [{:.1}ms]",
            project.metadata.name,
            project.graph.nodes.len(),
            project.graph.edges.len(),
            load_start.elapsed().as_secs_f64() * 1000.0
        );
    }

    // 2. Scan Input Directory
    let scan_start = Instant::now();
    let scanned_files = scan_texture_directory(input_dir)
        .map_err(|e| format!("Failed to scan input directory: {}", e))?;

    if scanned_files.is_empty() {
        return Err(format!(
            "No supported texture maps found in input directory: {:?}",
            input_dir
        ));
    }

    let folder_name = input_dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("TextureSet");
    let asset_name = determine_asset_stem(&scanned_files, folder_name);

    if log_info {
        println!(
            "[2/5] Scanned input directory: found {} texture map(s) (Asset Stem: '{}') [{:.1}ms]",
            scanned_files.len(),
            asset_name,
            scan_start.elapsed().as_secs_f64() * 1000.0
        );
        if args.verbose {
            for (path, meta) in &scanned_files {
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let role_str = meta
                    .inferred_role
                    .map(|r| r.display_name())
                    .unwrap_or("Unclassified");
                println!("      - {} -> PBR Role: {}", fname, role_str);
            }
        }
    }

    // 3. Bind Scanned Textures to Graph Input Nodes
    let bind_start = Instant::now();
    let bound_nodes = bind_texture_input_nodes(&mut project.graph, &scanned_files);

    if log_info {
        println!(
            "[3/5] Classified and bound {} graph input node(s) [{:.1}ms]:",
            bound_nodes.len(),
            bind_start.elapsed().as_secs_f64() * 1000.0
        );
        for (label, path) in &bound_nodes {
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            println!("      -> [{}] <- '{}'", label, fname);
        }
    }

    // 4. Resolve Export Preset & Overrides
    let preset_name_arg = args.preset.as_deref().unwrap_or("UE5_ORM");
    let mut preset = resolve_cli_preset(preset_name_arg)
        .ok_or_else(|| format!("Unrecognized export preset: '{}'", preset_name_arg))?;

    if let Some((w, h)) = args.resolution {
        project.metadata.working_resolution = (w, h);
        for node in project.graph.nodes.values_mut() {
            if node.node_type == "SaveImage" || node.node_type == "TextureOutput" {
                node.set_param("resolution", NodeParam::Resolution { width: w, height: h });
            }
        }
        if log_info {
            println!("      Resolution override applied: {}x{}", w, h);
        }
    }

    if let Some(ref fmt) = args.format {
        preset.default_format = fmt.to_lowercase();
        for node in project.graph.nodes.values_mut() {
            if node.node_type == "SaveImage" || node.node_type == "TextureOutput" {
                node.set_param("format", NodeParam::String(fmt.to_uppercase()));
            }
        }
        if log_info {
            println!("      Output format override applied: {}", fmt.to_uppercase());
        }
    }

    // 5. Evaluate DAG Graph
    let eval_start = Instant::now();
    let working_res = project.metadata.working_resolution;
    let mut evaluator = GraphEvaluator::new(working_res);
    evaluator
        .evaluate(&project.graph)
        .map_err(|e| format!("DAG evaluation failed: {}", e))?;

    if log_info {
        println!(
            "[4/5] Evaluated DAG network at {}x{} [{:.1}ms]",
            working_res.0,
            working_res.1,
            eval_start.elapsed().as_secs_f64() * 1000.0
        );
    }

    // 6. Collect Export Items
    let mut items_to_export =
        collect_export_items(&project.graph, &evaluator, &preset, &asset_name, &output_dir);

    if items_to_export.is_empty() {
        return Err("No export targets or evaluated output buffers found in graph".to_string());
    }

    // Apply resolution override to export items if needed
    if let Some((w, h)) = args.resolution {
        for item in &mut items_to_export {
            if item.buffer.width != w || item.buffer.height != h {
                item.buffer = item.buffer.resize(w, h, FilterType::Lanczos3);
            }
        }
    }

    // Apply format override to export items if needed
    if let Some(ref fmt) = args.format {
        let clean_fmt = fmt.to_lowercase();
        for item in &mut items_to_export {
            item.target_path.set_extension(&clean_fmt);
            item.format = match clean_fmt.as_str() {
                "tga" => ExportFormat::Tga,
                "exr" => ExportFormat::Exr,
                "jpg" | "jpeg" => ExportFormat::Jpg,
                "webp" => ExportFormat::Webp,
                "bmp" => ExportFormat::Bmp,
                _ => ExportFormat::Png,
            };
        }
    }

    // Ensure output directory exists
    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create export directory {:?}: {}", output_dir, e))?;

    // 7. Write Export Items to Disk
    if log_info {
        println!(
            "[5/5] Exporting {} map(s) to {:?} using preset '{}'...",
            items_to_export.len(),
            output_dir,
            preset.name
        );
    }

    let report = ExportWriter::execute_export(&items_to_export);

    if !report.is_success() {
        let err_msg = report.errors.join("; ");
        return Err(format!("Export write failed: {}", err_msg));
    }

    if log_info {
        println!("--------------------------------------------------");
        println!(
            "SUCCESS: {} file(s) written ({:.2} MB) in {}ms",
            report.files_written.len(),
            report.bytes_written as f64 / 1_048_576.0,
            report.elapsed_ms
        );
        for file in &report.files_written {
            println!("  -> {:?}", file);
        }
    }

    Ok(CliRunResult::Success(report))
}

/// Entry point helper returning an exit code: 0 on success, 1 on error.
pub fn run<I, T>(args: I) -> Result<i32, String>
where
    I: IntoIterator<Item = T>,
    T: AsRef<str>,
{
    let cli_args = CliArgs::parse(args)?;
    match execute_cli(&cli_args) {
        Ok(_) => Ok(0),
        Err(err) => {
            eprintln!("Error: {}", err);
            Ok(1)
        }
    }
}

/// Prints formatted CLI help information.
pub fn print_help() {
    println!(
        r#"TextureLab CLI v{} — PBR Texture Authoring and Channel Packing Engine

USAGE:
    texturelab-cli --graph <PATH> --input <DIR> [OPTIONS]

REQUIRED ARGUMENTS:
    -g, --graph <PATH>        Project graph file (.tlab) or template to execute
    -i, --input <DIR>         Directory containing source PBR texture maps

OPTIONS:
    -o, --output <DIR>        Export directory (defaults to <INPUT>/exports)
    -p, --preset <NAME>       Export naming preset (e.g. 'ue5', 'UE5_ORM', 'unity', 'blender')
    -r, --resolution <WxH>    Override default resolution (e.g. '2048x2048' or '1024')
    -f, --format <FORMAT>     Override output image format (PNG, TGA, EXR, JPG, WEBP, BMP)
    -q, --quiet               Suppress progress output (silent mode)
        --verbose             Print detailed PBR classification and socket binding diagnostics
    -h, --help                Print help information
    -v, --version             Print version information

EXAMPLES:
    texturelab-cli --graph assets/templates/ue5_orm_pack.tlab --input samples/1k/ --output target/cli-test/
    texturelab-cli -g ue5_orm_pack.tlab -i textures/brick/ -o exports/ -p UE5_ORM -r 2048x2048 -f PNG
"#,
        crate::version()
    );
}

/// Prints current crate version.
pub fn print_version() {
    println!("texturelab-cli v{}", crate::version());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_resolution_square_and_non_square() {
        assert_eq!(parse_resolution("2048x2048").unwrap(), (2048, 2048));
        assert_eq!(parse_resolution("4096x2048").unwrap(), (4096, 2048));
        assert_eq!(parse_resolution("1024X512").unwrap(), (1024, 512));
        assert_eq!(parse_resolution("1024").unwrap(), (1024, 1024));
        assert!(parse_resolution("0x2048").is_err());
        assert!(parse_resolution("invalid").is_err());
    }

    #[test]
    fn test_parse_format_valid_and_invalid() {
        assert_eq!(parse_format("PNG").unwrap(), "png");
        assert_eq!(parse_format("tga").unwrap(), "tga");
        assert_eq!(parse_format("EXR").unwrap(), "exr");
        assert_eq!(parse_format("jpg").unwrap(), "jpg");
        assert!(parse_format("xyz").is_err());
    }

    #[test]
    fn test_cli_args_parsing() {
        let args = vec![
            "texturelab-cli",
            "--graph",
            "assets/templates/ue5_orm_pack.tlab",
            "--input",
            "samples/1k/",
            "--output",
            "target/test-out/",
            "--preset",
            "UE5_ORM",
            "--resolution",
            "2048x2048",
            "--format",
            "PNG",
            "--verbose",
        ];

        let parsed = CliArgs::parse(args).expect("Should parse valid CLI arguments");
        assert_eq!(
            parsed.graph,
            Some(PathBuf::from("assets/templates/ue5_orm_pack.tlab"))
        );
        assert_eq!(parsed.input, Some(PathBuf::from("samples/1k/")));
        assert_eq!(parsed.output, Some(PathBuf::from("target/test-out/")));
        assert_eq!(parsed.preset.as_deref(), Some("UE5_ORM"));
        assert_eq!(parsed.resolution, Some((2048, 2048)));
        assert_eq!(parsed.format.as_deref(), Some("png"));
        assert!(parsed.verbose);
        assert!(!parsed.quiet);
    }

    #[test]
    fn test_cli_args_equals_syntax() {
        let args = vec![
            "texturelab-cli",
            "--graph=assets/templates/ue5_orm_pack.tlab",
            "--input=samples/1k/",
            "--output=target/test-out/",
            "--preset=unity",
            "--resolution=1024x1024",
            "--format=tga",
            "-q",
        ];

        let parsed = CliArgs::parse(args).expect("Should parse equals syntax");
        assert_eq!(
            parsed.graph,
            Some(PathBuf::from("assets/templates/ue5_orm_pack.tlab"))
        );
        assert_eq!(parsed.input, Some(PathBuf::from("samples/1k/")));
        assert_eq!(parsed.output, Some(PathBuf::from("target/test-out/")));
        assert_eq!(parsed.preset.as_deref(), Some("unity"));
        assert_eq!(parsed.resolution, Some((1024, 1024)));
        assert_eq!(parsed.format.as_deref(), Some("tga"));
        assert!(parsed.quiet);
    }

    #[test]
    fn test_cli_help_and_version_flags() {
        let args_help = vec!["texturelab-cli", "--help"];
        let parsed = CliArgs::parse(args_help).unwrap();
        assert!(parsed.help);

        let args_ver = vec!["texturelab-cli", "-v"];
        let parsed = CliArgs::parse(args_ver).unwrap();
        assert!(parsed.version);
    }

    #[test]
    fn test_resolve_cli_preset() {
        let ue5 = resolve_cli_preset("UE5_ORM").expect("UE5_ORM must resolve");
        assert_eq!(ue5.id, "ue5");

        let unity = resolve_cli_preset("unity").expect("unity must resolve");
        assert_eq!(unity.id, "unity");

        let blender = resolve_cli_preset("blender").expect("blender must resolve");
        assert_eq!(blender.id, "blender");
    }

    #[test]
    fn test_load_graph_template_fallback() {
        let project = load_graph_file(Path::new("ue5_orm_pack.tlab"))
            .expect("Should load built-in template by name");
        assert!(!project.graph.nodes.is_empty());
    }

    #[test]
    fn test_cli_pipeline_smoke_run() {
        let out_dir = std::env::temp_dir().join(format!("tlab_cli_smoke_{}", std::process::id()));
        let args = CliArgs {
            graph: Some(PathBuf::from("assets/templates/ue5_orm_pack.tlab")),
            input: Some(PathBuf::from("samples/1k")),
            output: Some(out_dir.clone()),
            preset: Some("UE5_ORM".to_string()),
            resolution: Some((1024, 1024)),
            format: Some("png".to_string()),
            quiet: true,
            ..Default::default()
        };

        let result = execute_cli(&args).expect("Smoke run must succeed");
        match result {
            CliRunResult::Success(report) => {
                assert!(report.is_success());
                assert!(!report.files_written.is_empty());
                for path in &report.files_written {
                    assert!(path.exists());
                    assert_eq!(path.extension().unwrap(), "png");
                }
            }
            _ => panic!("Expected CliRunResult::Success"),
        }

        let _ = fs::remove_dir_all(&out_dir);
    }
}
