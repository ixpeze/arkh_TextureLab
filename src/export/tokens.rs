//! Tokenized path resolution for texture exports (Phase 6).
//!
//! Supports standard industry tokens:
//! - `{project}`: Current project name (default: "TextureLab")
//! - `{asset}`: Clean asset name (e.g. "AnthraciteConcrete")
//! - `{slot}`: Target map slot (e.g. "ORM", "Normal", "Albedo")
//! - `{res}` / `{resolution}`: Output resolution (e.g. "4K", "2048")
//! - `{colorspace}`: Target color space ("sRGB" or "Linear")
//! - `{format}`: File format extension ("png", "tga", "jpg", "exr")
//! - `{udim}`: UDIM tile identifier (e.g. "1001")

use serde::{Deserialize, Serialize};

/// Context parameters used to expand tokenized export path templates.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenContext {
    /// Project name (e.g. "TextureLab", "SciFiCorridor").
    pub project: String,
    /// Asset name (e.g. "ConcreteWall", "Weapon_Rifle").
    pub asset: String,
    /// Target map slot name (e.g. "Albedo", "Normal", "ORM", "Roughness").
    pub slot: String,
    /// Resolution label or dimension (e.g. "2048", "4096", "2K", "4K").
    pub resolution: String,
    /// Target color space (e.g. "sRGB", "Linear").
    pub colorspace: String,
    /// Target file format extension (e.g. "png", "tga", "jpg", "exr").
    pub format: String,
    /// Optional UDIM tile identifier (e.g. "1001").
    pub udim: Option<String>,
}

impl TokenContext {
    /// Constructs a new TokenContext with the given asset and slot names, using default values for other fields.
    pub fn new(asset: impl Into<String>, slot: impl Into<String>) -> Self {
        Self {
            project: "TextureLab".to_string(),
            asset: asset.into(),
            slot: slot.into(),
            resolution: "2048".to_string(),
            colorspace: "sRGB".to_string(),
            format: "png".to_string(),
            udim: None,
        }
    }

    /// Sets the project name.
    pub fn with_project(mut self, project: impl Into<String>) -> Self {
        self.project = project.into();
        self
    }

    /// Sets the resolution string.
    pub fn with_resolution(mut self, res: impl Into<String>) -> Self {
        self.resolution = res.into();
        self
    }

    /// Sets the color space string.
    pub fn with_colorspace(mut self, colorspace: impl Into<String>) -> Self {
        self.colorspace = colorspace.into();
        self
    }

    /// Sets the format extension.
    pub fn with_format(mut self, format: impl Into<String>) -> Self {
        self.format = format.into().trim_start_matches('.').to_string();
        self
    }

    /// Sets the UDIM tile identifier.
    pub fn with_udim(mut self, udim: impl Into<String>) -> Self {
        self.udim = Some(udim.into());
        self
    }
}

impl Default for TokenContext {
    fn default() -> Self {
        Self {
            project: "TextureLab".to_string(),
            asset: "Asset".to_string(),
            slot: "Albedo".to_string(),
            resolution: "2048".to_string(),
            colorspace: "sRGB".to_string(),
            format: "png".to_string(),
            udim: None,
        }
    }
}

/// Token expansion engine.
pub struct TokenResolver;

impl TokenResolver {
    /// Expands all tokens in `pattern`.
    ///
    /// If the pattern does not already contain an extension or `{format}`,
    /// and `ctx.format` is non-empty, the format extension is automatically appended.
    pub fn resolve(pattern: &str, ctx: &TokenContext) -> String {
        let raw = Self::resolve_raw(pattern, ctx);

        // Check if an extension is already present (e.g. .png, .tga)
        let has_extension = raw.rsplit_once('.').map_or(false, |(_, ext)| {
            !ext.is_empty()
                && ext.len() <= 5
                && ext.chars().all(|c| c.is_ascii_alphanumeric())
        });

        if !has_extension && !ctx.format.trim().is_empty() {
            let clean_ext = ctx.format.trim().trim_start_matches('.');
            format!("{}.{}", raw, clean_ext)
        } else {
            raw
        }
    }

    /// Expands tokens in `pattern` without appending an automatic file extension.
    pub fn resolve_raw(pattern: &str, ctx: &TokenContext) -> String {
        let clean_asset = Self::sanitize_asset_name(&ctx.asset);
        let udim_str = ctx.udim.as_deref().unwrap_or("");
        let clean_format = ctx.format.trim_start_matches('.');

        let mut out = pattern.to_string();

        // Exact replacements (case-insensitive for convenience)
        let token_pairs = [
            ("{project}", ctx.project.as_str()),
            ("{PROJECT}", ctx.project.as_str()),
            ("{asset}", clean_asset.as_str()),
            ("{ASSET}", clean_asset.as_str()),
            ("{slot}", ctx.slot.as_str()),
            ("{SLOT}", ctx.slot.as_str()),
            ("{res}", ctx.resolution.as_str()),
            ("{RES}", ctx.resolution.as_str()),
            ("{resolution}", ctx.resolution.as_str()),
            ("{RESOLUTION}", ctx.resolution.as_str()),
            ("{colorspace}", ctx.colorspace.as_str()),
            ("{COLORSPACE}", ctx.colorspace.as_str()),
            ("{format}", clean_format),
            ("{FORMAT}", clean_format),
            ("{udim}", udim_str),
            ("{UDIM}", udim_str),
        ];

        for (tok, val) in token_pairs {
            out = out.replace(tok, val);
        }

        out
    }

    /// Sanitizes an asset name for clean, safe path generation.
    /// Replaces whitespace and illegal characters with underscores.
    pub fn sanitize_asset_name(name: &str) -> String {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return "Asset".to_string();
        }

        let mut result = String::with_capacity(trimmed.len());
        for c in trimmed.chars() {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                result.push(c);
            } else if c.is_whitespace() || c == '.' {
                result.push('_');
            }
        }

        if result.is_empty() {
            "Asset".to_string()
        } else {
            result
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_token_resolution() {
        let ctx = TokenContext::new("Concrete", "ORM")
            .with_format("png")
            .with_resolution("4K")
            .with_project("DemoProject")
            .with_colorspace("Linear");

        // P6-T1 Acceptance: Token test expands T_{asset}_{slot} to T_Concrete_ORM.png
        let resolved = TokenResolver::resolve("T_{asset}_{slot}", &ctx);
        assert_eq!(resolved, "T_Concrete_ORM.png");

        // Explicit format in pattern
        let resolved_full = TokenResolver::resolve(
            "{project}_{asset}_{slot}_{res}_{colorspace}.{format}",
            &ctx,
        );
        assert_eq!(resolved_full, "DemoProject_Concrete_ORM_4K_Linear.png");

        // UDIM token expansion
        let udim_ctx = ctx.clone().with_udim("1001");
        let resolved_udim = TokenResolver::resolve("{asset}_{slot}_{udim}.{format}", &udim_ctx);
        assert_eq!(resolved_udim, "Concrete_ORM_1001.png");

        // Resolution aliases ({res} and {resolution})
        let resolved_res = TokenResolver::resolve("{asset}_{resolution}", &ctx);
        assert_eq!(resolved_res, "Concrete_4K.png");
    }

    #[test]
    fn test_token_sanitization() {
        assert_eq!(TokenResolver::sanitize_asset_name("My Cool Asset!"), "My_Cool_Asset");
        assert_eq!(TokenResolver::sanitize_asset_name("   "), "Asset");
        assert_eq!(TokenResolver::sanitize_asset_name("Sci-Fi_Floor_01"), "Sci-Fi_Floor_01");
    }
}
