# ARKH TextureLab Workspace Rules

## 1. Major Phase Desktop Executable Build Requirement
Whenever a major development phase, architectural milestone, or large UX redesign is completed:
1. All automated unit and integration tests must pass cleanly (`cargo test`).
2. A complete desktop executable / production bundle build MUST be executed (`cargo build --release` producing standalone portable binary).
3. The build exit code must be verified (0) with no broken imports or missing assets.

## 2. Interaction Standards
- Follow Unreal Engine Material Editor navigation standards (Right-click pan, Right-click tap spawn menu, Alt+Click wire cut, Hold-Key+Left-Click node quick-spawn).
- Support seamless drag-and-drop from the Node Library panel and directly from Windows Explorer.
- Preserve existing theme tokens and node type contracts (`TextureInput`).
