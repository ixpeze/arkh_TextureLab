# Specification: Canonical Single Release & Silent Network Sync

## 1. Overview & Context
Previously, ARKH TextureLab maintained duplicate release binaries in two local locations:
1. `g:\AI\_ARKH_LAB\arkh_TextureLab\release\TextureLab.exe`
2. `g:\AI\_ARKH_LAB\arkh_TextureLab\target\release\texturelab.exe`

This caused ambiguity regarding which binary was current, inflated disk usage, and required manual copying. This design establishes `target\release\` as the single official local release folder on this PC, eliminates root `release\`, and introduces automated silent synchronization of `texturelab.exe` to the local network share (`\\192.168.11.11\FastShare\Arman\Apps\TextureLab\`).

---

## 2. Decision Log

- **Decision 1: Sole Local Release Location**
  - **Selected**: `target\release\texturelab.exe`.
  - **Rationale**: Cargo naturally compiles into `target\release\`. Keeping only this location prevents drift, reduces disk waste, and eliminates unnecessary file copies.
  - **Action**: Completely delete `g:\AI\_ARKH_LAB\arkh_TextureLab\release\` and update `.gitignore`, `run_desktop.bat`, `setup.bat`, `GEMINI.md`, and `docs/IMPLEMENTATION_PLAN.md`.

- **Decision 2: Network Sync Implementation**
  - **Selected**: Fast PowerShell ping check with 1-second timeout + silent copy (`-ErrorAction SilentlyContinue`).
  - **Rationale**: Standard Windows UNC file operations can hang for 30+ seconds if an IP or SMB host is offline. Testing with `Test-Connection -TimeoutSeconds 1` or fast SMB ping ensures non-blocking, zero-latency execution when disconnected.
  - **Action**: Embed silent sync command in `run_desktop.bat`, `setup.bat`, and Phase Gate workflow instructions.

---

## 3. Strict Rules Defined

### Rule 1: Single Release Folder Policy
- On this PC, all compiled production binaries live strictly in `target\release\`.
- Agents and developers must **never** create a root `release\` directory or maintain duplicate executables.
- Standard binary name is `texturelab.exe`.

### Rule 2: Silent Network Share Sync
- Destination: `\\192.168.11.11\FastShare\Arman\Apps\TextureLab\texturelab.exe`.
- Only `texturelab.exe` is copied (no intermediate files, symbols, or caches).
- If the network share is offline, slow, or inaccessible, the process fails silently without error dialogs, terminal crashes, or exit code failures.

---

## 4. Implementation Steps
1. Delete redundant folder `g:\AI\_ARKH_LAB\arkh_TextureLab\release\`.
2. Update `GEMINI.md` Rule 1.
3. Update `docs/IMPLEMENTATION_PLAN.md` Phase Gate template.
4. Update `run_desktop.bat` to launch directly from `target\release\texturelab.exe` with silent network sync.
5. Update `setup.bat` to eliminate `release\` copy and add silent network sync.
6. Clean `release/` references from `.gitignore`.
7. Empirical verification: test sync to live share, verify hash/timestamp, test unreachable host behavior.
