# ARKH TextureLab — Known Issues & Accepted Gaps (v1.0.0)

This document tracks known issues, architectural constraints, and accepted gaps for the ARKH TextureLab v1.0.0 release.

---

### 1. Windows SmartScreen "Unknown Publisher" Warning

- **Category:** Distribution / Code Signing
- **Status:** Accepted (Locked Owner Decision D-10)
- **Description:** On first launch of `TextureLab-Setup-1.0.0.exe` or `TextureLab-1.0.0-portable.exe`, Windows Defender SmartScreen may display a warning stating: *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*
- **Reason:** Code signing certificates require an ongoing annual fee ($150–$300+/year) or an active Azure subscription. Because ARKH TextureLab is distributed as free, local-first software, the project owner decided not to purchase a certificate.
- **Workaround:**
  1. Click **"More info"** on the SmartScreen dialog.
  2. Click **"Run anyway"**.
  3. (Optional) Verify the integrity of your download by comparing its SHA-256 hash with [`release/SHA256SUMS.txt`](../release/SHA256SUMS.txt).

---

### 2. EXR and TIFF Image Codec Support

- **Category:** Codecs & I/O
- **Status:** Deferred to v1.1 (Locked Owner Decision D-08)
- **Description:** Loading and exporting 16-bit/32-bit floating-point OpenEXR (`.exr`) and Tagged Image File Format (`.tiff`) textures is not supported in v1.0.0.
- **Current Support:** v1.0.0 natively supports 8-bit and 16-bit PNG (`.png`), Truevision TGA (`.tga`), JPEG (`.jpg`/`.jpeg`), and WebP (`.webp`) with byte-exact channel preservation.
- **Planned Resolution:** OpenEXR and TIFF decoders and encoders will be integrated in v1.1.

---

### 3. Native In-App Auto-Update

- **Category:** Application Lifecycle
- **Status:** Deferred to v1.1 (Locked Owner Decision D-09)
- **Description:** TextureLab v1.0.0 does not automatically check for or download software updates.
- **Workaround:** Users can download new releases directly from the GitHub Releases page or repository. Upgrading over an existing installation preserves all settings and recent files without data loss.

---

### 4. Software OpenGL / SwiftShader Fallback Performance

- **Category:** GPU Hardware Acceleration
- **Status:** By Design / Best-Effort
- **Description:** If running on a system where hardware GPU acceleration is disabled, GPU drivers are outdated, or WebGL2 is unsupported, TextureLab automatically falls back to Chromium's CPU-based SwiftShader renderer.
- **Impact:** While functional correctness is maintained, interactive graph scrubbing and 4K viewport evaluation will experience reduced frame rates. A telemetry notice will appear in the application status bar.
- **Recommended Action:** Ensure your discrete or integrated GPU drivers are up to date and hardware acceleration is enabled.

---

### 5. Right-to-Left (RTL) System Locales

- **Category:** Internationalization
- **Status:** Accepted Non-Goal
- **Description:** On Windows installations with Right-to-Left (RTL) language locales (such as Arabic or Hebrew), the workstation layout remains Left-to-Right (LTR).
- **Reason:** Node-graph dataflow and standard DCC software conventions flow left-to-right (inputs on the left, processing in the middle, outputs on the right). RTL canvas flow is a documented non-goal.
