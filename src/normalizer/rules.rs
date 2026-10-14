//! Lexical Role Classification & Rule Engine (Phase 4).
//!
//! Provides `PbrRole`, `TextureMetadata`, and `LexicalNormalizer` for tokenizing,
//! stripping vendor prefixes, detecting resolutions, classifying PBR roles,
//! and identifying DirectX vs OpenGL normal map conventions.

use crate::normalizer::dicts::*;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Canonical PBR texture roles.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PbrRole {
    BaseColor,
    Normal,
    Roughness,
    Metallic,
    AmbientOcclusion,
    Height,
    Emissive,
    Glossiness,
    PackedOrm,
    PackedOrmh,
    PackedRma,
    Mask,
}

impl PbrRole {
    /// Human-readable display label.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::BaseColor => "Base Color / Albedo",
            Self::Normal => "Normal Map",
            Self::Roughness => "Roughness",
            Self::Metallic => "Metallic",
            Self::AmbientOcclusion => "Ambient Occlusion",
            Self::Height => "Height / Displacement",
            Self::Emissive => "Emissive",
            Self::Glossiness => "Glossiness (Inverted)",
            Self::PackedOrm => "Packed ORM (AO, Rough, Metal)",
            Self::PackedOrmh => "Packed ORMH (AO, Rough, Metal, Height)",
            Self::PackedRma => "Packed RMA (Rough, Metal, AO)",
            Self::Mask => "Mask / Opacity / Specular",
        }
    }

    /// Canonical suffix abbreviation (e.g. "Albedo", "N", "R", "M", "AO").
    pub fn canonical_suffix(&self) -> &'static str {
        match self {
            Self::BaseColor => "Albedo",
            Self::Normal => "N",
            Self::Roughness => "R",
            Self::Metallic => "M",
            Self::AmbientOcclusion => "AO",
            Self::Height => "H",
            Self::Emissive => "E",
            Self::Glossiness => "Gloss",
            Self::PackedOrm => "ORM",
            Self::PackedOrmh => "ORMH",
            Self::PackedRma => "RMA",
            Self::Mask => "Mask",
        }
    }

    /// Indicates if this texture represents packed multi-channel data.
    pub fn is_packed(&self) -> bool {
        matches!(self, Self::PackedOrm | Self::PackedOrmh | Self::PackedRma)
    }

    /// Default colorspace interpretation (sRGB for Color/Emissive, Linear for data maps).
    pub fn default_colorspace(&self) -> &'static str {
        match self {
            Self::BaseColor | Self::Emissive => "sRGB",
            _ => "Linear",
        }
    }
}

/// Normalized metadata extracted from texture filename or filepath.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextureMetadata {
    pub clean_stem: String,
    pub inferred_role: Option<PbrRole>,
    pub requires_inversion: bool,
    pub is_opengl_normal: bool,
    pub detected_resolution: Option<String>,
}

/// Lexical normalizer and tokenizer for texture naming conventions.
pub struct LexicalNormalizer;

impl LexicalNormalizer {
    /// Strips known vendor/type prefixes (e.g., `T_`, `M_`, `TexturesCom_`, `ambientcg_`).
    pub fn strip_vendor_prefix(stem: &str) -> String {
        let lower = stem.to_lowercase();
        for &pfx in PREFIX_PATTERNS {
            if lower.starts_with(pfx) {
                return stem[pfx.len()..].to_string();
            }
        }
        stem.to_string()
    }

    /// Splits a string into alphanumeric tokens delimited by underscores, dashes, dots, or whitespace.
    pub fn tokenize(stem: &str) -> Vec<String> {
        stem.split(|c: char| c == '_' || c == '-' || c == '.' || c.is_whitespace())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect()
    }

    /// Determines if a token corresponds to a resolution descriptor (e.g. `4k`, `2048`, `4096x4096`).
    pub fn is_resolution_token(token: &str) -> bool {
        let t = token.to_lowercase();
        if RESOLUTION_PATTERNS.iter().any(|&r| r == t) {
            return true;
        }
        // Match \d+k (e.g., "1k", "2k", "4k", "8k", "16k")
        if t.ends_with('k') && t[..t.len() - 1].chars().all(|c| c.is_ascii_digit()) && t.len() > 1 {
            return true;
        }
        // Match \d+x\d+ (e.g., "2048x2048", "4096x4096")
        if let Some((w, h)) = t.split_once('x') {
            if !w.is_empty() && !h.is_empty() && w.chars().all(|c| c.is_ascii_digit()) && h.chars().all(|c| c.is_ascii_digit()) {
                return true;
            }
        }
        false
    }

    /// Detects any resolution tag embedded in the text.
    pub fn detect_resolution(stem: &str) -> Option<String> {
        let tokens = Self::tokenize(stem);
        for tok in tokens {
            if Self::is_resolution_token(&tok) {
                return Some(tok.to_uppercase());
            }
        }
        None
    }

    /// Strips resolution tokens from a stem.
    pub fn strip_resolution(stem: &str) -> String {
        let parts = Self::tokenize(stem);
        let filtered: Vec<String> = parts.into_iter().filter(|t| !Self::is_resolution_token(t)).collect();
        filtered.join("_")
    }

    /// Detects if a normal map follows OpenGL (+Y) or DirectX (-Y) convention.
    /// Returns `Some(true)` for OpenGL, `Some(false)` for DirectX, or `None` if unstated.
    pub fn detect_normal_orientation(stem: &str) -> Option<bool> {
        let tokens = Self::tokenize(stem);
        let lower_stem = stem.to_lowercase();

        // 1. Check token-level exact matches
        for tok in &tokens {
            let t = tok.to_lowercase();
            if GL_NORMAL_TOKENS.iter().any(|&gl| gl == t) {
                return Some(true);
            }
            if DX_NORMAL_TOKENS.iter().any(|&dx| dx == t) {
                return Some(false);
            }
        }

        // 2. Check suffix / delimiter substrings
        if lower_stem.ends_with("_gl") || lower_stem.ends_with("-gl") || lower_stem.contains("_gl_") || lower_stem.contains("opengl") {
            return Some(true);
        }
        if lower_stem.ends_with("_dx") || lower_stem.ends_with("-dx") || lower_stem.contains("_dx_") || lower_stem.contains("directx") {
            return Some(false);
        }

        None
    }

    /// Infers the PBR role from a filename or stem using contextual priority scoring.
    pub fn infer_role(stem: &str) -> Option<PbrRole> {
        let raw_tokens = Self::tokenize(stem);
        let non_res: Vec<String> = raw_tokens
            .into_iter()
            .filter(|t| !Self::is_resolution_token(t))
            .map(|t| t.to_lowercase())
            .collect();

        if non_res.is_empty() {
            return None;
        }

        let last_token = non_res.last().unwrap();
        let second_last = if non_res.len() >= 2 {
            Some(&non_res[non_res.len() - 2])
        } else {
            None
        };

        // 1. Packed map fast checks (ORM, ORMH, RMA)
        for &alias in ORMH_ALIASES {
            if non_res.iter().any(|t| t == alias) || (alias.contains('+') && stem.to_lowercase().contains(alias)) {
                return Some(PbrRole::PackedOrmh);
            }
        }
        for &alias in ORM_ALIASES {
            if non_res.iter().any(|t| t == alias) || (alias.contains('+') && stem.to_lowercase().contains(alias)) {
                return Some(PbrRole::PackedOrm);
            }
        }
        for &alias in RMA_ALIASES {
            if non_res.iter().any(|t| t == alias) || (alias.contains('+') && stem.to_lowercase().contains(alias)) {
                return Some(PbrRole::PackedRma);
            }
        }

        // 2. Multi-token combinations like "base_color", "ambient_occlusion"
        let full_lower = non_res.join("_");
        let concatenated = non_res.join("");

        // Candidate role definitions with precedence
        let candidates: &[(PbrRole, &[&str])] = &[
            (PbrRole::Glossiness, GLOSSINESS_ALIASES),
            (PbrRole::Roughness, ROUGHNESS_ALIASES),
            (PbrRole::BaseColor, BASE_COLOR_ALIASES),
            (PbrRole::Normal, NORMAL_ALIASES),
            (PbrRole::Metallic, METALLIC_ALIASES),
            (PbrRole::AmbientOcclusion, AO_ALIASES),
            (PbrRole::Height, HEIGHT_ALIASES),
            (PbrRole::Emissive, EMISSIVE_ALIASES),
            (PbrRole::Mask, MASK_ALIASES),
        ];

        let mut best_role = None;
        let mut best_score = 0.0f32;

        for &(role, aliases) in candidates {
            let mut score = 0.0f32;

            for &raw_alias in aliases {
                let alias = raw_alias.to_lowercase();

                // High priority: exact match on last token (standard DCC suffix)
                if last_token == &alias {
                    if alias.len() <= 2 {
                        score = score.max(14.0);
                    } else {
                        score = score.max(16.0 + (alias.len() as f32) * 0.2);
                    }
                    continue;
                }

                // Match on second-to-last token (e.g. "concrete_roughness_dx")
                if let Some(sec) = second_last {
                    if sec == &alias {
                        if alias.len() <= 2 {
                            score = score.max(10.0);
                        } else {
                            score = score.max(12.0 + (alias.len() as f32) * 0.2);
                        }
                        continue;
                    }
                }

                // Match on compound combinations (e.g., "base_color", "ambient_occlusion")
                if (full_lower.contains(&alias) || concatenated.contains(&alias)) && alias.len() >= 4 {
                    score = score.max(8.0 + (alias.len() as f32) * 0.2);
                }

                // Isolated token match
                if non_res.contains(&alias) {
                    if alias.len() <= 2 {
                        score = score.max(4.0);
                    } else {
                        score = score.max(6.0 + (alias.len() as f32) * 0.2);
                    }
                }
            }

            if score > best_score {
                best_score = score;
                best_role = Some(role);
            }
        }

        if best_score > 0.0 {
            best_role
        } else {
            None
        }
    }

    /// Strips prefixes, resolutions, and role tokens to produce a clean asset name stem.
    pub fn clean_stem(stem: &str) -> String {
        let without_pfx = Self::strip_vendor_prefix(stem);
        let tokens = Self::tokenize(&without_pfx);

        let mut clean_tokens = Vec::new();
        for tok in tokens {
            let tl = tok.to_lowercase();
            if Self::is_resolution_token(&tl) {
                continue;
            }
            if GL_NORMAL_TOKENS.contains(&tl.as_str()) || DX_NORMAL_TOKENS.contains(&tl.as_str()) {
                continue;
            }
            // Check if this token is a known role keyword
            let is_role = BASE_COLOR_ALIASES.contains(&tl.as_str())
                || NORMAL_ALIASES.contains(&tl.as_str())
                || ROUGHNESS_ALIASES.contains(&tl.as_str())
                || GLOSSINESS_ALIASES.contains(&tl.as_str())
                || METALLIC_ALIASES.contains(&tl.as_str())
                || AO_ALIASES.contains(&tl.as_str())
                || HEIGHT_ALIASES.contains(&tl.as_str())
                || EMISSIVE_ALIASES.contains(&tl.as_str())
                || ORM_ALIASES.contains(&tl.as_str())
                || ORMH_ALIASES.contains(&tl.as_str())
                || RMA_ALIASES.contains(&tl.as_str())
                || MASK_ALIASES.contains(&tl.as_str());

            if !is_role {
                clean_tokens.push(tok);
            }
        }

        if clean_tokens.is_empty() {
            without_pfx
        } else {
            clean_tokens.join("_")
        }
    }

    /// Fully normalizes a filename or path into `TextureMetadata`.
    pub fn normalize(filename_or_path: &str) -> TextureMetadata {
        let p = Path::new(filename_or_path);
        let file_stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or(filename_or_path);

        let detected_resolution = Self::detect_resolution(file_stem);
        let inferred_role = Self::infer_role(file_stem);
        let clean_stem = Self::clean_stem(file_stem);

        let requires_inversion = inferred_role == Some(PbrRole::Glossiness);
        let is_opengl_normal = if inferred_role == Some(PbrRole::Normal) {
            Self::detect_normal_orientation(file_stem).unwrap_or(false)
        } else {
            false
        };

        TextureMetadata {
            clean_stem,
            inferred_role,
            requires_inversion,
            is_opengl_normal,
            detected_resolution,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// TC-404: Vendor Prefix Stripping
    #[test]
    pub fn test_strip_vendor_prefix() {
        assert_eq!(
            LexicalNormalizer::strip_vendor_prefix("T_Anthracite_Concrete_Gloss"),
            "Anthracite_Concrete_Gloss"
        );
        assert_eq!(
            LexicalNormalizer::strip_vendor_prefix("TexturesCom_Cobblestone_Wall_4096x4096_roughness"),
            "Cobblestone_Wall_4096x4096_roughness"
        );
        assert_eq!(
            LexicalNormalizer::strip_vendor_prefix("ambientcg_WoodFloor_1K_Color"),
            "WoodFloor_1K_Color"
        );
        assert_eq!(
            LexicalNormalizer::strip_vendor_prefix("mat_iron_metal"),
            "iron_metal"
        );
    }

    /// TC-401: Sample Textures Classification
    #[test]
    pub fn test_sample_textures_lexical_analysis() {
        let samples = [
            ("anthracite smooth cast concrete basecolor 4k.png", PbrRole::BaseColor),
            ("anthracite smooth cast concrete roughness 4k.png", PbrRole::Roughness),
            ("anthracite smooth cast concrete metallic 4k.png", PbrRole::Metallic),
            ("anthracite smooth cast concrete normal 4k.png", PbrRole::Normal),
            ("anthracite smooth cast concrete ambientocclusion 4k.png", PbrRole::AmbientOcclusion),
            ("anthracite smooth cast concrete gloss 4k.png", PbrRole::Glossiness),
            ("anthracite smooth cast concrete height 4k.png", PbrRole::Height),
        ];

        for (filename, expected_role) in samples {
            let meta = LexicalNormalizer::normalize(filename);
            assert_eq!(
                meta.inferred_role,
                Some(expected_role),
                "Classification failed for filename: {}",
                filename
            );
            assert_eq!(meta.detected_resolution, Some("4K".to_string()));
        }
    }

    /// P4-T4: DirectX vs OpenGL Normal Map Detection
    #[test]
    pub fn test_opengl_vs_directx_detection() {
        let gl_meta = LexicalNormalizer::normalize("T_Rock_normal_gl.png");
        assert_eq!(gl_meta.inferred_role, Some(PbrRole::Normal));
        assert!(gl_meta.is_opengl_normal);

        let gl_short = LexicalNormalizer::normalize("T_Rock_nor_gl.png");
        assert_eq!(gl_short.inferred_role, Some(PbrRole::Normal));
        assert!(gl_short.is_opengl_normal);

        let dx_meta = LexicalNormalizer::normalize("T_Rock_normal_dx.png");
        assert_eq!(dx_meta.inferred_role, Some(PbrRole::Normal));
        assert!(!dx_meta.is_opengl_normal);

        let dx_short = LexicalNormalizer::normalize("T_Rock_nor_dx.png");
        assert_eq!(dx_short.inferred_role, Some(PbrRole::Normal));
        assert!(!dx_short.is_opengl_normal);
    }

    /// P4-T3: Short abbreviation token tests
    #[test]
    pub fn test_abbreviations_and_aliases() {
        assert_eq!(LexicalNormalizer::normalize("T_Rock_BC.png").inferred_role, Some(PbrRole::BaseColor));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Albedo.png").inferred_role, Some(PbrRole::BaseColor));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Diffuse.png").inferred_role, Some(PbrRole::BaseColor));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_N.png").inferred_role, Some(PbrRole::Normal));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_NRM.png").inferred_role, Some(PbrRole::Normal));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_R.png").inferred_role, Some(PbrRole::Roughness));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Rough.png").inferred_role, Some(PbrRole::Roughness));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_M.png").inferred_role, Some(PbrRole::Metallic));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Metal.png").inferred_role, Some(PbrRole::Metallic));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_AO.png").inferred_role, Some(PbrRole::AmbientOcclusion));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Occ.png").inferred_role, Some(PbrRole::AmbientOcclusion));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_H.png").inferred_role, Some(PbrRole::Height));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Disp.png").inferred_role, Some(PbrRole::Height));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_ORM.png").inferred_role, Some(PbrRole::PackedOrm));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_RMA.png").inferred_role, Some(PbrRole::PackedRma));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_Alpha.png").inferred_role, Some(PbrRole::Mask));
        assert_eq!(LexicalNormalizer::normalize("T_Rock_E.png").inferred_role, Some(PbrRole::Emissive));
    }

    /// P4-T6: Glossiness auto-inversion flag check
    #[test]
    pub fn test_glossiness_requires_inversion_flag() {
        let gloss_meta = LexicalNormalizer::normalize("T_Anthracite_Concrete_Gloss.png");
        assert_eq!(gloss_meta.inferred_role, Some(PbrRole::Glossiness));
        assert!(gloss_meta.requires_inversion);

        let rough_meta = LexicalNormalizer::normalize("T_Anthracite_Concrete_Roughness.png");
        assert_eq!(rough_meta.inferred_role, Some(PbrRole::Roughness));
        assert!(!rough_meta.requires_inversion);
    }
}
