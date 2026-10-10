//! Industry export presets for game engines and DCC workstations (Phase 6).
//!
//! Provides canonical naming patterns and map conventions for:
//! - Unreal Engine 5 (`T_{asset}_{slot}`)
//! - Unity URP / HDRP (`{asset}_{slot}`)
//! - Substance Painter (`{asset}_{slot}_{res}`)
//! - Blender Principled (`{asset}_{slot}`)
//! - CryEngine (`T_{asset}_{slot}`)

use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::export::tokens::{TokenContext, TokenResolver};

/// Export preset specification defining default naming patterns, formats, and slot configurations.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExportPreset {
    /// Unique preset identifier (e.g. "ue5", "unity", "substance", "blender", "cryengine").
    pub id: String,
    /// Human-readable preset name (e.g. "Unreal Engine 5").
    pub name: String,
    /// File naming pattern template (e.g. "T_{asset}_{slot}").
    pub pattern: String,
    /// Default file extension (e.g. "png", "tga").
    pub default_format: String,
    /// Detailed description and engine standards.
    pub description: String,
    /// Standard PBR texture map slots associated with this preset.
    pub default_slots: Vec<String>,
}

impl ExportPreset {
    /// Constructs a new ExportPreset.
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        pattern: impl Into<String>,
        default_format: impl Into<String>,
        description: impl Into<String>,
        default_slots: Vec<&str>,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            pattern: pattern.into(),
            default_format: default_format.into(),
            description: description.into(),
            default_slots: default_slots.into_iter().map(String::from).collect(),
        }
    }

    /// Returns the complete list of built-in industry export presets.
    pub fn builtin_presets() -> Vec<Self> {
        vec![
            Self::new(
                "ue5",
                "Unreal Engine 5",
                "T_{asset}_{slot}",
                "tga",
                "Epic Games standard: T_ prefix, ORM channel pack (R=AO, G=Roughness, B=Metallic)",
                vec!["BaseColor", "Normal", "ORM", "Emissive", "Displacement"],
            ),
            Self::new(
                "unity",
                "Unity URP / HDRP",
                "{asset}_{slot}",
                "png",
                "Unity MaskMap standard: R=Metallic, G=AO, B=DetailMask, A=Smoothness",
                vec!["AlbedoTransparency", "Normal", "MaskMap", "Emission"],
            ),
            Self::new(
                "substance",
                "Substance Painter",
                "{asset}_{slot}_{res}",
                "png",
                "Classic Substance 3D standard with asset, slot, and resolution suffix",
                vec!["BaseColor", "Roughness", "Metallic", "Normal", "Height"],
            ),
            Self::new(
                "blender",
                "Blender Principled",
                "{asset}_{slot}",
                "png",
                "Clean glTF 2.0 and Blender Principled BSDF naming convention",
                vec!["BaseColor", "Roughness", "Metallic", "Normal", "Alpha"],
            ),
            Self::new(
                "cryengine",
                "CryEngine",
                "T_{asset}_{slot}",
                "tga",
                "CryEngine texture standard with T_ prefix and dedicated gloss/ddna maps",
                vec!["diff", "ddna", "spec", "displ"],
            ),
        ]
    }

    /// Finds a built-in preset by its identifier.
    pub fn find_by_id(id: &str) -> Option<Self> {
        Self::builtin_presets().into_iter().find(|p| p.id.eq_ignore_ascii_case(id))
    }

    /// Expands the preset's pattern into a concrete file name using the given token context.
    pub fn resolve_filename(&self, ctx: &TokenContext) -> String {
        let mut local_ctx = ctx.clone();
        if local_ctx.format.trim().is_empty() {
            local_ctx.format = self.default_format.clone();
        }
        TokenResolver::resolve(&self.pattern, &local_ctx)
    }

    /// Resolves the full target output path inside `base_dir` using the preset template.
    pub fn resolve_path(&self, base_dir: &Path, ctx: &TokenContext) -> PathBuf {
        let filename = self.resolve_filename(ctx);
        base_dir.join(filename)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_builtin_presets_catalog() {
        let presets = ExportPreset::builtin_presets();
        assert_eq!(presets.len(), 5);

        let ids: Vec<&str> = presets.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&"ue5"));
        assert!(ids.contains(&"unity"));
        assert!(ids.contains(&"substance"));
        assert!(ids.contains(&"blender"));
        assert!(ids.contains(&"cryengine"));
    }

    #[test]
    pub fn test_preset_path_resolution() {
        let ctx = TokenContext::new("ConcreteFloor", "ORM")
            .with_resolution("4K")
            .with_format("png");

        let base_dir = Path::new("C:/Exports");

        // UE5 resolution
        let ue5 = ExportPreset::find_by_id("ue5").expect("UE5 preset must exist");
        let ue5_path = ue5.resolve_path(base_dir, &ctx);
        assert_eq!(ue5_path, PathBuf::from("C:/Exports/T_ConcreteFloor_ORM.png"));

        // Substance resolution (includes resolution token)
        let substance = ExportPreset::find_by_id("substance").expect("Substance preset must exist");
        let sub_path = substance.resolve_path(base_dir, &ctx);
        assert_eq!(sub_path, PathBuf::from("C:/Exports/ConcreteFloor_ORM_4K.png"));

        // Unity resolution
        let unity = ExportPreset::find_by_id("unity").expect("Unity preset must exist");
        let unity_path = unity.resolve_path(base_dir, &ctx);
        assert_eq!(unity_path, PathBuf::from("C:/Exports/ConcreteFloor_ORM.png"));

        // Blender resolution
        let blender = ExportPreset::find_by_id("blender").expect("Blender preset must exist");
        let blender_path = blender.resolve_path(base_dir, &ctx);
        assert_eq!(blender_path, PathBuf::from("C:/Exports/ConcreteFloor_ORM.png"));
    }

    #[test]
    pub fn test_default_format_fallback() {
        let mut ctx = TokenContext::new("Weapon", "Normal");
        ctx.format = String::new(); // Empty format -> preset default

        let ue5 = ExportPreset::find_by_id("ue5").unwrap();
        assert_eq!(ue5.resolve_filename(&ctx), "T_Weapon_Normal.tga");

        let blender = ExportPreset::find_by_id("blender").unwrap();
        assert_eq!(blender.resolve_filename(&ctx), "Weapon_Normal.png");
    }
}
