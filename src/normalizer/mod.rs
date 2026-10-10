//! PBR Lexical Normalizer & One-Click Pack Wizard (Phase 4).
//!
//! Provides the lexical dictionary engine recognizing 60+ industry naming conventions
//! (Megascans, Poly Haven, Substance, Quixel, Unreal Engine, Unity), automated PBR role
//! classification, normal map convention detection (DirectX vs OpenGL), and the Pack Wizard
//! for one-click DAG generation with smart auto-inversion.

pub mod dicts;
pub mod rules;
pub mod wizard;

pub use dicts::*;
pub use rules::{LexicalNormalizer, PbrRole, TextureMetadata};
pub use wizard::{PackPreset, PackWizard};
