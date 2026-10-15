# ARKH TextureLab Workspace Rules

## 1. Major Phase Desktop Executable Build Requirement
Whenever a major development phase, architectural milestone, or large UX redesign is completed:
1. All automated unit and integration tests must pass cleanly (`cargo test`).
2. `cargo clippy -- -D warnings` must report zero warnings.
3. A complete desktop executable / production bundle build MUST be executed (`cargo build --release` producing standalone portable binary).
4. The build exit code must be verified (0) with no broken imports or missing assets.
5. **Strict Single Local Release Directory Rule**: `target\release\` is the SOLE release folder on this PC (`target\release\texturelab.exe`). NEVER create, commit, or maintain a duplicate `release/` directory in the repository root or elsewhere.
6. **Network Share Sync**: Attempt to copy `target\release\texturelab.exe` to `\\192.168.11.11\FastShare\Arman\Apps\TextureLab\texturelab.exe`. Silent error handling must be enabled so that if the network location is offline, unavailable, or times out, the build succeeds cleanly without failing or interrupting.

## 2. Interaction Standards
- Follow Unreal Engine Material Editor navigation standards (Right-click pan, Right-click tap spawn menu, Alt+Click wire cut, Hold-Key+Left-Click node quick-spawn).
- Support seamless drag-and-drop from the Node Library panel and directly from Windows Explorer.
- Preserve existing theme tokens and node type contracts (`TextureInput`).

## 3. Implementation Plan
- All feature work follows the phased plan in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).
- Each task ends with `cargo test` + `cargo clippy` + a descriptive git commit.
- Release builds happen at phase gates only.

## 4. Documentation
- Hotkey table in README is generated from `src/hotkeys/mod.rs`. Keep them in sync.
- Design guides live in `docs/design/`. Completed specs go to `docs/archive/`.
