# Workspace Rules: ARKH TextureLab

## Major Phase Executable Build Rule
- **Mandatory Packaging Verification**: After any major feature phase, UX overhaul, or foundational refactor is completed and verified with automated test suites (`cargo test`), the agent MUST execute the production desktop executable build (`cargo build --release` -> `release/TextureLab-portable.exe`).
- **Binary Integrity**: Verify that the build completes with exit code 0, bundling standalone portable artifacts into `release/` without runtime breakages.
