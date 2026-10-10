# PHASE 4 — PBR Lexical Normalizer & One-Click Pack Wizard

**Goal:** Implement the lexical dictionary engine recognizing 60+ industry naming conventions (Megascans, Poly Haven, Substance, Quixel, Unreal Engine, Unity), auto-detect PBR roles and normal conventions (DirectX vs OpenGL), and build the Pack Wizard that automatically constructs an end-to-end connected DAG graph with smart auto-inversion (Glossiness $\rightarrow$ Roughness).  
**Prerequisites:** Phases 2 & 3. **Effort:** M. **Touches:** `src/normalizer/mod.rs`, `src/normalizer/dicts.rs`, `src/normalizer/rules.rs`, `src/normalizer/wizard.rs`, `tests/`.

---

## 1. Scope

- **IN:** Tokenizer; vendor prefix stripper; resolution stripper; PBR role classification; DirectX vs OpenGL normal detection; Pack Wizard automated DAG generator with auto-inversion for Glossiness and auto-flip for OpenGL normals; integration tests on real-world asset sets.
- **OUT:** GUI drag-and-drop file receiver (Phase 5), file export execution (Phase 6).

---

## 2. Technical Architecture & Rule Engine

### 2.1 Lexical Role Classification (`src/normalizer/rules.rs`)
```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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

#[derive(Clone, Debug)]
pub struct TextureMetadata {
    pub clean_stem: String,
    pub inferred_role: Option<PbrRole>,
    pub requires_inversion: bool,
    pub is_opengl_normal: bool,
    pub detected_resolution: Option<String>,
}
```

### 2.2 Pack Wizard Auto-Wiring (`src/normalizer/wizard.rs`)
When the user provides a batch of textures, the `PackWizard`:
1. Infers roles for all dropped textures.
2. Creates `TextureInput` nodes for each source texture.
3. If an input is `Glossiness`, automatically routes it through an `Invert` node before wiring into the `Roughness` slot of `ChannelCombiner`.
4. If an input is an OpenGL normal map, automatically routes it through a `NormalFlipGreen` node.
5. Wires output sockets into `TextureOutput` (e.g. `ORM` or `ORMH`).

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P4-T1** | **Lexical Dictionaries:** Author comprehensive prefix, resolution, and suffix dictionaries covering 60+ naming patterns. | `src/normalizer/dicts.rs` | Token lists compile cleanly into const slices. |
| **P4-T2** | **Tokenizer & Stripper:** Strip vendor prefixes (`t_`, `m_`, `mat_`) and resolution tags (`4k`, `2048`, `1024`). | `src/normalizer/rules.rs` | `LexicalNormalizer::tokenize` extracts clean stem. |
| **P4-T3** | **Role Inference:** Match aliases to `PbrRole` with priority order (e.g. `ambientocclusion`, `ao`, `roughness`, `gloss`). | `src/normalizer/rules.rs` | Sample textures classified with 100% accuracy. |
| **P4-T4** | **DirectX vs OpenGL Detection:** Detect `_gl` / `_opengl` vs `_dx` / `_directx` in normal map filenames. | `src/normalizer/rules.rs` | Normal map convention flagged correctly. |
| **P4-T5** | **Pack Wizard Auto-Graph Generator:** Build `PackWizard::generate_pack_graph` that creates nodes and wires for target packing presets (UE5 ORM, Unity MaskMap). | `src/normalizer/wizard.rs` | Complete DAG constructed in < 5 ms. |
| **P4-T6** | **Glossiness Auto-Inversion:** Automatically insert an `Invert` node when Glossiness is supplied for a Roughness slot. | `src/normalizer/wizard.rs` | Integration test asserts `Invert` node exists between Glossiness and Combiner. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-401** | Sample Textures Classification | `cargo test test_sample_textures_lexical_analysis` | AO, Roughness, Metallic, Normal, BaseColor, Gloss identified |
| **TC-402** | Pack Wizard Auto-Graph Generation | `cargo test test_pack_wizard_auto_graph_generation` | Valid connected graph with 3 inputs, 1 combiner, 1 output |
| **TC-403** | Glossiness Auto-Inversion Wiring | `cargo test test_pack_wizard_glossiness_auto_inversion` | `Invert` node present with correct wire routing |
| **TC-404** | Vendor Prefix Stripping | `cargo test test_strip_vendor_prefix` | `T_Anthracite_Concrete_Gloss` -> `Anthracite_Concrete_Gloss` |

---

## 5. Exit Criteria Checklist

- [x] 60+ industry naming conventions correctly parsed without false positives.
- [x] OpenGL normals correctly detected and flagged for green flip.
- [x] Glossiness textures automatically receive an Invert node in packing graphs.
- [x] Pack Wizard generates complete, compilable DAGs in < 5 ms.
- [x] All normalizer unit and integration tests pass cleanly via `cargo test`.

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P4-T2 | `cargo test normalizer::rules` | Passed: 5 unit tests (`test_strip_vendor_prefix`, `test_glossiness_requires_inversion_flag`, `test_opengl_vs_directx_detection`, `test_abbreviations_and_aliases`, `test_sample_textures_lexical_analysis`) passed in 0.00s | [x] Verified |
| P4-T3 | `cargo test test_sample_textures_lexical_analysis` | Passed: 1 unit test + 1 integration test passed (classified AO, Roughness, Metallic, Normal, BaseColor, Gloss, Height with 100% accuracy) in 0.00s | [x] Verified |
| P4-T5 | `cargo test test_pack_wizard_auto_graph_generation` | Passed: 1 unit test + 1 integration test passed (5 nodes, 4 edges, valid DAG generated in < 1ms) in 0.00s | [x] Verified |
| P4-T6 | `cargo test test_pack_wizard_glossiness_auto_inversion` | Passed: 1 unit test + 1 integration test passed (Invert node verified between Glossiness input and Combiner G slot) in 0.00s | [x] Verified |

