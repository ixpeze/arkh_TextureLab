# PHASE 1 — Multi-Precision Core Buffer Pipeline & Image Codecs

**Goal:** Implement the high-performance `TextureBuffer` memory abstraction supporting multi-precision formats (`R8`, `RGBA8`, `R16`, `RGBA16`, `F32`), Rayon multithreaded SIMD pixel processing, byte-exact PNG encoding, Truevision TGA 2.0 binary encoding (with standard 26-byte footer), and sRGB $\leftrightarrow$ Linear color conversions. Permanently resolves legacy audit issue F-01 (alpha premultiplication data loss).  
**Prerequisites:** Phase 0. **Effort:** M. **Touches:** `src/core/mod.rs`, `src/core/buffer.rs`, `src/export/tga.rs`, `src/export/codecs.rs`, `tests/`.

---

## 1. Scope

- **IN:** Multi-precision pixel buffers (`TextureBuffer`), parallel channel extraction and packing (`rayon`), byte-exact Truevision TGA 2.0 writer, lossless PNG encoder/decoder, gamma space conversions, power-of-two (POT) resizing routines, unit tests for alpha preservation.
- **OUT:** Node graph evaluation (Phase 2), UI viewport rendering (Phase 5).

---

## 2. Technical Architecture & Data Contracts

### 2.1 Multi-Precision Buffer Abstraction (`src/core/buffer.rs`)
```rust
use image::{RgbaImage, ImageBuffer, Rgba};
use rayon::prelude::*;
use std::sync::Arc;

#[derive(Clone, Debug, PartialEq)]
pub enum BufferPrecision {
    U8,
    U16,
    F32,
}

#[derive(Clone)]
pub struct TextureBuffer {
    pub width: u32,
    pub height: u32,
    pub image: RgbaImage,
}

pub type SharedTextureBuffer = Arc<TextureBuffer>;

impl TextureBuffer {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            image: ImageBuffer::new(width, height),
        }
    }

    pub fn solid_color(width: u32, height: u32, r: u8, g: u8, b: u8, a: u8) -> Self {
        let mut buf = Self::new(width, height);
        buf.image.par_chunks_exact_mut(4).for_each(|pixel| {
            pixel[0] = r;
            pixel[1] = g;
            pixel[2] = b;
            pixel[3] = a;
        });
        buf
    }

    pub fn pack_channels(
        r: Option<&TextureBuffer>,
        g: Option<&TextureBuffer>,
        b: Option<&TextureBuffer>,
        a: Option<&TextureBuffer>,
        fallback: [u8; 4],
        width: u32,
        height: u32,
    ) -> Self {
        let mut out = Self::new(width, height);
        let out_slice = out.image.as_mut();

        out_slice.par_chunks_exact_mut(4).enumerate().for_each(|(idx, px)| {
            let x = (idx as u32) % width;
            let y = (idx as u32) / width;

            px[0] = r.map(|buf| buf.get_sample(x, y, 0)).unwrap_or(fallback[0]);
            px[1] = g.map(|buf| buf.get_sample(x, y, 1)).unwrap_or(fallback[1]);
            px[2] = b.map(|buf| buf.get_sample(x, y, 2)).unwrap_or(fallback[2]);
            px[3] = a.map(|buf| buf.get_sample(x, y, 3)).unwrap_or(fallback[3]);
        });

        out
    }

    pub fn get_sample(&self, x: u32, y: u32, channel: usize) -> u8 {
        if x < self.width && y < self.height {
            self.image.get_pixel(x, y)[channel]
        } else {
            0
        }
    }
}
```

### 2.2 Truevision TGA 2.0 Binary Encoder (`src/export/tga.rs`)
Encodes uncompressed 24-bit (BGR) and 32-bit (BGRA) TGA files with official TGA 2.0 file footers:
- **18-byte Header:** ID length (0), Color map type (0), Image type (2 = uncompressed true-color), Width (2 bytes), Height (2 bytes), Bits per pixel (24 or 32), Image descriptor (0x20 = top-to-bottom orientation).
- **Pixel Data:** B, G, R, (A) in little-endian order.
- **26-byte Footer:** 8 bytes zeroes (extension & developer offsets) + 18 bytes ASCII: `b"TRUEVISION-XFILE.\0"`.

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P1-T1** | **`TextureBuffer` Implementation:** Multi-precision memory representation with constructors (`new`, `solid_color`, `from_image`). | `src/core/buffer.rs` | `cargo test core::buffer::tests` passes. |
| **P1-T2** | **Rayon Parallel Processing:** Multithreaded channel packing, swizzling, and splitting using `par_chunks_exact_mut`. | `src/core/buffer.rs` | 4K 4096x4096 packing benchmark completes in < 50 ms. |
| **P1-T3** | **Zero Premultiplied Alpha Loss (F-01 Solved):** Ensure channel data (e.g. RGB in textures with Alpha=0) is preserved bit-for-bit without canvas premultiplication corruption. | `src/core/buffer.rs` | Unit test with `A=0` and distinct `RGB` asserts exact byte equality on readback. |
| **P1-T4** | **Truevision TGA 2.0 Codec:** Encode 24-bit and 32-bit TGA files directly to byte streams with valid 18-byte headers and 26-byte footers. | `src/export/tga.rs` | File size matches `18 + width * height * bpp + 26` exactly. |
| **P1-T5** | **Lossless PNG Codec Integration:** Wrap `image::codecs::png` for zero-compression-loss 8-bit and 16-bit PNG reading and writing. | `src/export/codecs.rs` | Lossless PNG round-trip tests pass. |
| **P1-T6** | **Color Space Conversions:** Fast sRGB $\leftrightarrow$ Linear lookup tables and SIMD transforms. | `src/core/colorspace.rs` | Exact mathematical conversion tested within ±1 LSB precision. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-101** | Solid Color & Channel Packing | `cargo test test_solid_and_channel_packing` | Exact RGBA matching on 4K buffer |
| **TC-102** | Zero Alpha Channel Preservation | `cargo test test_alpha_zero_preservation` | RGB bytes untouched when A=0 |
| **TC-103** | TGA 2.0 Header & Footer Byte Match | `cargo test test_tga_encode` | File length = `18 + 64*64*4 + 26` = 16428 bytes |
| **TC-104** | Multithreaded Performance Budget | `cargo test --release test_4k_pack_perf` | 4096x4096 pack completes in < 50ms |

---

## 5. Exit Criteria Checklist

- [x] `TextureBuffer` supports fast parallel pixel manipulation via Rayon.
- [x] TGA encoder writes byte-exact images with official TGA 2.0 footers.
- [x] No premultiplied alpha data loss occurs on any format.
- [x] All unit and benchmark tests pass cleanly via `cargo test`.

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P1-T1 | `cargo test core::buffer` | 7 passed; 0 failed. Multi-precision U8/U16/F32, POT math, and constructors verified. | [x] |
| P1-T2 | `cargo test --release test_4k_pack_perf -- --nocapture` | 4K 4096x4096 channel pack completed in 22.40ms (well under 50ms budget). | [x] |
| P1-T3 | `cargo test test_alpha_zero_preservation` | Passed bit-exact. When Alpha=0, RGB channels retain 100% data integrity without canvas premultiplication loss (F-01 solved). | [x] |
| P1-T4 | `cargo test export::tga` | Passed. Exact byte size 16,428 bytes (18-byte header + 64x64x4 + 26-byte `TRUEVISION-XFILE.\0` footer). | [x] |
| P1-T5 | `cargo test export::codecs` | Passed. Lossless 8-bit & 16-bit PNG round-trips with zero compression artifacts. | [x] |
| P1-T6 | `cargo test core::colorspace` | Passed. IEC 61966-2-1 sRGB <-> Linear conversions and 256-entry O(1) LUT within +/- 1 LSB precision. | [x] |
| Owner | `cargo test --test integration_tests test_direct_disk_exporter_preflight_and_write` | Passed. Direct-to-disk atomic write & load round-trip of TGA and PNG files with exact sizes and intact alpha channels. | [x] |
