//! Direct disk exporter, token resolution, and image codecs (Phases 1 & 6).

pub mod codecs;
pub mod preset_designer;
pub mod presets;
pub mod tga;
pub mod tokens;
pub mod writer;

pub use codecs::{
    decode_image_from_memory, decode_png_rgba16_from_memory, encode_png_gray8,
    encode_png_rgba16, encode_png_rgba8, load_image, save_png, CodecError,
};
pub use preset_designer::{
    load_presets, load_presets_from_path, resolve_presets_path, save_presets, save_presets_to_path,
    ChannelSource, OutputFormat as PresetOutputFormat, PresetDesignerDialog, PresetDesignerResult,
    UserPreset, CHANNELS, STANDARD_SOURCE_MAPS,
};
pub use presets::ExportPreset;
pub use tga::{
    decode_tga, encode_tga_24, encode_tga_32, has_tga_2_0_footer, load_tga_file,
    save_tga_file, TgaError, TgaHeader, TGA_FOOTER_SIZE, TGA_HEADER_SIZE,
    TGA_ORIGIN_TOP_LEFT, TGA_SIGNATURE,
};
pub use tokens::{TokenContext, TokenResolver};
pub use writer::{
    is_windows_reserved_name, sanitize_filename, ExportFormat, ExportItem, ExportReport,
    ExportWriter, PreflightReport, WINDOWS_RESERVED_NAMES,
};

