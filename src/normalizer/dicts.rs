//! Lexical Dictionaries & Naming Patterns (Phase 4).
//!
//! Covers 60+ industry naming conventions across Megascans, Poly Haven, Substance,
//! Quixel, Unreal Engine, Unity, Marmoset, CC0, and CGTrader.

/// Common vendor and asset prefixes found in texture filenames.
/// Sorted longest-first to ensure greedy prefix matching.
pub static PREFIX_PATTERNS: &[&str] = &[
    "texturescom_",
    "cgtextures_",
    "ambientcg_",
    "cc0textures_",
    "poliigon_",
    "megascans_",
    "quixel_",
    "substance_",
    "freepbr_",
    "polyhaven_",
    "texturecan_",
    "t_sm_",
    "tx_",
    "t_",
    "tex_",
    "texture_",
    "map_",
    "mat_",
    "m_",
    "img_",
    "chr_",
    "sm_",
    "s_",
];

/// Known resolution tags in filenames.
pub static RESOLUTION_PATTERNS: &[&str] = &[
    "16k", "8k", "4k", "2k", "1k",
    "512", "1024", "2048", "4096", "8192", "16384",
    "512x512", "1024x1024", "2048x2048", "4096x4096", "8192x8192", "16384x16384",
];

/// OpenGL normal map indicators (+Y green channel convention).
pub static GL_NORMAL_TOKENS: &[&str] = &[
    "gl",
    "opengl",
    "ogl",
    "normalgl",
    "nor_gl",
    "nrm_gl",
    "normal_gl",
    "normal_ogl",
    "_nor_gl_",
];

/// DirectX normal map indicators (-Y green channel convention).
pub static DX_NORMAL_TOKENS: &[&str] = &[
    "dx",
    "directx",
    "dx11",
    "dx12",
    "normaldx",
    "nor_dx",
    "nrm_dx",
    "normal_dx",
    "_nor_dx_",
];

/// Base Color / Albedo / Diffuse aliases.
pub static BASE_COLOR_ALIASES: &[&str] = &[
    "basecolor",
    "base_color",
    "albedo",
    "diffuse",
    "diff",
    "color",
    "col",
    "bc",
    "base",
    "alb",
    "d",
];

/// Tangent-space Normal map aliases.
pub static NORMAL_ALIASES: &[&str] = &[
    "normal",
    "normalmap",
    "normals",
    "norm",
    "nor",
    "nrm",
    "bump",
    "n",
];

/// Roughness map aliases (0.0 = smooth/mirror, 1.0 = rough/matte).
pub static ROUGHNESS_ALIASES: &[&str] = &[
    "roughness",
    "rough",
    "rgh",
    "rou",
    "microsurface",
    "r",
];

/// Glossiness / Smoothness map aliases (inverted roughness: 1.0 = smooth, 0.0 = rough).
pub static GLOSSINESS_ALIASES: &[&str] = &[
    "glossiness",
    "gloss",
    "gls",
    "smoothness",
    "smooth",
];

/// Metallic / Metalness map aliases (0.0 = dielectric, 1.0 = metallic).
pub static METALLIC_ALIASES: &[&str] = &[
    "metallic",
    "metalness",
    "metal",
    "mtl",
    "met",
    "m",
];

/// Ambient Occlusion map aliases.
pub static AO_ALIASES: &[&str] = &[
    "ambientocclusion",
    "ambient_occlusion",
    "ao",
    "occlusion",
    "occ",
    "lightmap",
    "mixed_ao",
    "ambient",
];

/// Height / Displacement / Parallax / Depth map aliases.
pub static HEIGHT_ALIASES: &[&str] = &[
    "height",
    "displacement",
    "disp",
    "heightmap",
    "depth",
    "parallax",
    "elevation",
    "h",
];

/// Emissive / Emission map aliases.
pub static EMISSIVE_ALIASES: &[&str] = &[
    "emissive",
    "emission",
    "emit",
    "emissivecolor",
    "glow",
    "illum",
    "illumination",
    "emi",
    "e",
];

/// Packed ORM map aliases (Occlusion in R, Roughness in G, Metallic in B).
pub static ORM_ALIASES: &[&str] = &[
    "orm",
    "occlusionroughnessmetallic",
    "occlusion+roughness+metallic",
    "ao_rough_metal",
    "aorm",
];

/// Packed ORMH map aliases (Occlusion in R, Roughness in G, Metallic in B, Height in A).
pub static ORMH_ALIASES: &[&str] = &[
    "ormh",
    "aormh",
    "orm_h",
];

/// Packed RMA map aliases (Roughness in R, Metallic in G, Occlusion in B).
pub static RMA_ALIASES: &[&str] = &[
    "rma",
    "arm",
    "roughnessmetallicocclusion",
    "roughness+metallic+occlusion",
    "rough_metal_ao",
];

/// Mask / Opacity / Alpha / Specular aliases.
pub static MASK_ALIASES: &[&str] = &[
    "mask",
    "opacity",
    "alpha",
    "transparency",
    "translucent",
    "translucency",
    "cutout",
    "specular",
    "spec",
    "spc",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dictionary_census() {
        assert!(PREFIX_PATTERNS.len() >= 20);
        assert!(RESOLUTION_PATTERNS.len() >= 10);
        assert!(GL_NORMAL_TOKENS.len() >= 5);
        assert!(DX_NORMAL_TOKENS.len() >= 5);
        assert!(BASE_COLOR_ALIASES.len() >= 8);
        assert!(NORMAL_ALIASES.len() >= 6);
        assert!(ROUGHNESS_ALIASES.len() >= 5);
        assert!(GLOSSINESS_ALIASES.len() >= 4);
        assert!(METALLIC_ALIASES.len() >= 5);
        assert!(AO_ALIASES.len() >= 6);
        assert!(HEIGHT_ALIASES.len() >= 6);
        assert!(EMISSIVE_ALIASES.len() >= 6);
        assert!(ORM_ALIASES.len() >= 4);
        assert!(ORMH_ALIASES.len() >= 2);
        assert!(RMA_ALIASES.len() >= 4);
        assert!(MASK_ALIASES.len() >= 8);
    }
}
