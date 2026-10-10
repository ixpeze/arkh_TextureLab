# PHASE 3 — PBR Node Catalog & Processing Math

**Goal:** Implement all 12 canonical PBR node families in pure Rust with multithreaded Rayon pixel execution: I/O, Constants, Channel Ops (Pack/Unpack/Mixer), Adjust (Levels/Invert), Normal Ops (Flip Green DirectX $\leftrightarrow$ OpenGL, Normal Blend RNM), Math (13 scalar/vector operations), and Transform (POT Resize).  
**Prerequisites:** Phases 1 & 2. **Effort:** L. **Touches:** `src/nodes/mod.rs`, `src/nodes/io.rs`, `src/nodes/constants.rs`, `src/nodes/channel.rs`, `src/nodes/adjust.rs`, `src/nodes/blend.rs`, `src/nodes/math.rs`, `src/nodes/transform.rs`, `tests/`.

---

## 1. Scope

- **IN:** All 12 node families implemented in pure Rust; Rayon-parallel pixel shaders; Reoriented Normal Mapping (RNM); DirectX $\leftrightarrow$ OpenGL green channel flip; 4-row Channel Mixer swizzle matrix; 13 Math operations; Power-of-Two (POT) resizing routines.
- **OUT:** Lexical naming inference (Phase 4), GUI rendering of nodes (Phase 5).

---

## 2. Technical Specifications & Mathematical Formulations

### 2.1 Reoriented Normal Mapping (RNM) (`src/nodes/blend.rs`)
Blends base normal map $N_1$ with detail normal map $N_2$ preserving surface curvature:
$$\vec{t} = N_1 \cdot 2.0 + (-1.0, -1.0, 0.0)$$
$$\vec{u} = N_2 \cdot (-2.0, -2.0, 2.0) + (1.0, 1.0, -1.0)$$
$$\vec{r} = \vec{t} \cdot (\vec{t} \cdot \vec{u}) - \vec{u} \cdot t_z$$
$$\vec{N}_{out} = \text{normalize}(\vec{r}) \cdot 0.5 + 0.5$$

### 2.2 Channel Mixer / Swizzle Matrix (`src/nodes/channel.rs`)
Four independent routing rows (Output R, Output G, Output B, Output A). Each row selects:
- Source Socket & Channel (`Input1.R`, `Input1.G`, `Input1.B`, `Input1.A`, `Input2...`)
- Constant Fallback (`0.0`, `1.0`, or custom scalar)
- Invert Toggle (`1.0 - x`)

### 2.3 Layer Blend (Lerp) (`src/nodes/blend.rs`)
$$\text{weight} = \text{clamp}(\text{opacity} \times \text{mask}, 0.0, 1.0)$$
$$\text{Result} = A \times (1.0 - \text{weight}) + B \times \text{weight}$$

### 2.4 Math Node Operations (`src/nodes/math.rs`)
Supports 13 operations across connected inputs: `Add`, `Subtract`, `Multiply`, `Divide`, `Power`, `Min`, `Max`, `Clamp`, `Abs`, `Step`, `Smoothstep`, `Modulo`, `Invert`.

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P3-T1** | **I/O Nodes:** Implement `TextureInputNodeData` and `TextureOutputNodeData` with format and bit-depth configuration. | `src/nodes/io.rs` | `cargo test nodes::io` passes. |
| **P3-T2** | **Channel Pack & Unpack:** Implement `ChannelCombiner` (Pack R,G,B,A) and `ChannelSplitter` (Unpack RGBA) with Rayon parallel loops. | `src/nodes/channel.rs` | `cargo test nodes::channel::tests::test_combine_and_split` passes. |
| **P3-T3** | **Channel Mixer / Swizzle:** Implement 4-row routing matrix with fallback constants and 1-x invert toggles. | `src/nodes/channel.rs` | Swizzling RGBA $\rightarrow$ BGRA unit test passes. |
| **P3-T4** | **Normal Flip Green & Normal Adjust:** DirectX $\leftrightarrow$ OpenGL green channel invert ($G = 255 - G$), Normal Normalize, and Normal Strength scaling. | `src/nodes/adjust.rs` | Green flip test correctly converts normal vectors. |
| **P3-T5** | **Levels & Invert Nodes:** Remap black/white points and gamma curve in parallel. | `src/nodes/adjust.rs` | Gamma adjustment test matches numerical ground truth. |
| **P3-T6** | **Normal Blend (RNM):** Implement Stephen Hill & Colin Barré-Brisebois Reoriented Normal Mapping algorithm. | `src/nodes/blend.rs` | Flat base + tilted detail produces expected reoriented normal vector. |
| **P3-T7** | **Layer Blend (Lerp):** Component-wise linear interpolation with mask weighting and opacity control. | `src/nodes/blend.rs` | 50% opacity blend of white and black produces `128` gray. |
| **P3-T8** | **Math Operations Engine:** Implement 13 scalar and vector mathematical operations with division-by-zero protection. | `src/nodes/math.rs` | All 13 math tests pass without floating-point panics. |
| **P3-T9** | **Transform & Resize:** Power-of-two (POT) dimension rounding and bilinear/Lanczos3 resampling. | `src/nodes/transform.rs` | Non-POT texture (e.g. 1920x1080) rounds to nearest POT (2048x1024). |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-301** | Channel Pack & Split Roundtrip | `cargo test test_combine_and_split` | Split(Pack(R,G,B,A)) == (R,G,B,A) |
| **TC-302** | Channel Mixer Swizzle | `cargo test test_mixer_swizzle` | Swizzling (10, 20, 30, 40) with R->B produces (30, 20, 10, 40) |
| **TC-303** | Normal Blend RNM Orthogonality | `cargo test test_normal_blend_rnm` | RNM blends slopes without squashing Z |
| **TC-304** | Normal Flip Green DirectX/OpenGL | `cargo test test_normal_flip_and_levels` | Normal Y flips across 128 midpoint |
| **TC-305** | Math Operations Suite | `cargo test test_math_operations` | 13 math operations match reference outputs |
| **TC-306** | POT Resizing Rounding | `cargo test test_pot_rounding` | Nearest POT dimensions calculated accurately |

---

## 5. Exit Criteria Checklist

- [x] All 12 canonical node families are fully implemented in pure Rust (`io`, `constants`, `channel`, `adjust`, `blend`, `math`, `transform`).
- [x] Multithreaded Rayon parallelization is active across all pixel algorithms (`ChannelCombiner`, `ChannelMixer`, `Levels`, `RNM`, `MathOp`, `Resize`).
- [x] Reoriented Normal Mapping (RNM) produces accurate vectors and preserves curvature without Z squashing.
- [x] All node unit tests pass cleanly via `cargo test` (76 total tests: 53 library tests + 23 integration tests, 0 failures, 0 warnings).

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| **P3-T1** | `cargo test nodes::io` | 4 passed: defaults, serialization, apply/from_node, solid input, output passthrough | [x] |
| **P3-T2** | `cargo test nodes::channel::tests::test_combine_and_split` | 1 passed: Split(Pack(R,G,B,A)) == (R,G,B,A) with exact byte preservation | [x] |
| **P3-T3** | `cargo test test_mixer_swizzle` | 2 passed (lib + integration): Swizzling (10, 20, 30, 40) with R<->B produces (30, 20, 10, 40) | [x] |
| **P3-T4** | `cargo test nodes::adjust` | 3 passed: `test_normal_normalize_and_strength`, `test_normal_flip_and_levels`, `test_invert_node` | [x] |
| **P3-T5** | `cargo test test_normal_flip_and_levels` | 2 passed: Gamma levels LUT matches ground truth (mid-gray maps to 186 at $\gamma=2.2$) | [x] |
| **P3-T6** | `cargo test test_normal_blend_rnm` | 2 passed: Hill & Barré-Brisebois RNM preserves detail curvature, non-zero Z, unit normal vector | [x] |
| **P3-T7** | `cargo test nodes::blend` | 3 passed: Lerp 50% opacity of white & black produces exact 128 gray, mask weighting verified | [x] |
| **P3-T8** | `cargo test test_math_operations` | 2 passed: All 13 operations verified with division-by-zero guard & float safety | [x] |
| **P3-T9** | `cargo test test_pot_rounding` | 2 passed: Non-POT 1920x1080 rounds to nearest POT (2048x1024), next/prev POT verified | [x] |
| **TC-301** | `cargo test test_combine_and_split` | Passed (lib & integration harness) | [x] |
| **TC-302** | `cargo test test_mixer_swizzle` | Passed (lib & integration harness) | [x] |
| **TC-303** | `cargo test test_normal_blend_rnm` | Passed (lib & integration harness) | [x] |
| **TC-304** | `cargo test test_normal_flip_and_levels` | Passed (lib & integration harness) | [x] |
| **TC-305** | `cargo test test_math_operations` | Passed (lib & integration harness) | [x] |
| **TC-306** | `cargo test test_pot_rounding` | Passed (lib & integration harness) | [x] |
| **TC-FULL** | `cargo test` | 76 passed; 0 failed; 0 warnings; finished in 1.42s | [x] |
| **BUILD** | `cargo build --release` | 0 warnings, standalone release binary built successfully in 30.32s | [x] |
