# ARKH TextureLab — Developer & Maintenance Guide

This document is the authoritative engineering guide for maintaining, extending, and releasing ARKH TextureLab.

---

## 1. Architecture Overview

ARKH TextureLab is structured into two primary environments:

```
arkh_TextureLab/
├── app/                  # Frontend renderer and core workstation engine
│   ├── src/
│   │   ├── app/          # Workbench shell, Error Boundaries, Diagnostics
│   │   ├── components/   # React UI components, Modals, LOD Node cards
│   │   ├── gpu/          # WebGL2 engine, shader families, texture pool, scheduler
│   │   ├── graph/        # Topological compilation, cycle detection, migrations
│   │   ├── io/           # Byte-exact PNG and TGA decoders/encoders
│   │   ├── nodes/        # Node registry and modular definitions (defs/)
│   │   ├── platform/     # IPlatformService (Electron vs Web platform bridge)
│   │   ├── store/        # Zustand state slices (document, selection, ui, session)
│   │   └── ui/           # Design system tokens (tokens.css) and primitives
│   ├── scripts/          # Perf harnesses, icon builder, desktop dev scripts
│   └── vite.config.ts    # Vite 8 config with Rollup manual chunking
├── desktop/              # Electron main and preload processes
│   ├── main.ts           # Main process, window lifecycle, GPU crash recovery
│   ├── preload.ts        # Sandboxed contextBridge API (LabAPI)
│   ├── ipc.ts            # IPC handlers (file dialogs, atomic I/O, recent files)
│   └── logger.ts         # Rotating log system (%APPDATA%/TextureLab/logs)
├── docs/                 # Documentation, specs, and roadmaps
└── release/              # Packaged executables, blockmaps, and checksums
```

### Key Subsystems

- **PlatformService Abstraction:** The renderer communicates with desktop OS capabilities strictly through `IPlatformService` (`src/platform/`). `ElectronPlatformService` interacts with `window.lab` IPC, while `WebPlatformService` gracefully disables native-only features.
- **Demand-Driven GPU Engine:** Graph nodes are evaluated on the GPU using WebGL2 fragment shaders. Textures are allocated from a managed 1.5 GiB LRU pool (`src/gpu/pool.ts`). Topological execution is compiled on graph edit and evaluated asynchronously with PBOs (`src/gpu/scheduler.ts`).
- **Deterministic State & History:** All graph mutations dispatch to Zustand (`src/store/`). Undo/redo maintains a 100-step Immer patch history (`src/store/history.ts`) with automatic transaction coalescing for slider scrubs and drag operations.
- **Atomic Persistence:** Documents (`.tlab`) are saved via `desktop/atomicSave.ts` using staged `.tmp` files, `fsync`, and `.bak` backups with Windows `EBUSY` retry loops to ensure zero file corruption on crash or power loss.

---

## 2. How to Add a New Node (in ONE File)

Every node in TextureLab is a self-contained definition implementing `NodeDefinition`. To add a new node:

### Step 1: Create the Node Definition

Create a new file in `app/src/nodes/defs/YourNodeName.ts`:

```typescript
import { NodeDefinition, Category } from '../types';

export const yourNodeDefinition: NodeDefinition = {
  type: 'yourNode',
  label: 'Your Node',
  category: Category.ADJUSTMENT,
  description: 'Performs a custom texture transformation.',
  inputs: [
    { id: 'in_tex', label: 'Input', type: 'texture', acceptedTypes: ['rgba', 'gray'] },
  ],
  outputs: [
    { id: 'out_tex', label: 'Output', type: 'texture', outputType: 'rgba' },
  ],
  defaultData: {
    factor: 1.0,
  },
  gpuShader: {
    // Fragment shader or shader family reference in src/gpu/shaders/
    shaderFamily: 'yourShaderFamily',
  },
  // Optional React inspector / inline control schema
  controls: [
    { key: 'factor', label: 'Factor', type: 'slider', min: 0, max: 2, step: 0.01 },
  ],
};
```

### Step 2: Register in `src/nodes/registry.ts`

Import and register your definition in `app/src/nodes/registry.ts`:

```typescript
import { yourNodeDefinition } from './defs/YourNodeName';

// Add to registered definitions array
nodeRegistry.register(yourNodeDefinition);
```

Once registered, the node will automatically appear in:
1. The canvas node context menu and library palette.
2. The serialization and migration schemas.
3. The keyboard shortcuts registry (if assigned a hotkey).
4. The node card renderer with automatic zoom LOD handling.

---

## 3. Verification Commands & Testing Suite

Always verify changes from the `app/` directory:

```powershell
cd g:\AI\_ARKH_LAB\arkh_TextureLab\app

# 1. Vitest Unit & Golden Suite (208+ tests)
npm test

# 2. Strict Oxlint Linter (0 warnings, 0 errors required)
npm run lint

# 3. Production Build & TypeScript Typecheck
npm run build

# 4. GPU-vs-CPU Oracle Fixture Verification
npm run test:gpu

# 5. Playwright Electron Smoke Suite
npm run test:e2e

# 6. Performance Benchmarking (evaluates against 02 §9 budgets)
npm run perf

# 7. Memory Soak Harness (runs 200 slider drags, 50 load cycles)
npm run perf:soak
```

### File Size Ceiling
All source files in `app/src/` must remain **under 400 lines of code**. This is strictly enforced as an error by `.oxlintrc.json` (`max-lines: ["error", 400]`). If a component or module grows near 380 lines, extract helper subcomponents or utilities into adjacent files.

---

## 4. Release & Packaging Procedure

To produce a new production build:

1. **Verify All Quality Gates:**
   Ensure `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` are 100% passing.
2. **Update Version:**
   Bump the version in `app/package.json`, `desktop/preload.ts`, `app/src/platform/webPlatform.ts`, `app/src/platform/electronPlatform.ts`, and `app/src/graph/migrate.ts`.
3. **Update Changelog:**
   Document changes under the new version header in `CHANGELOG.md`.
4. **Build Distribution Binaries:**
   ```powershell
   cd g:\AI\_ARKH_LAB\arkh_TextureLab\app
   npm run dist
   ```
5. **Verify Deliverables:**
   Confirm executables in `release/`:
   - `TextureLab-Setup-1.0.0.exe` (must be <= 120 MB)
   - `TextureLab-1.0.0-portable.exe` (must be <= 130 MB)
6. **Generate Checksums:**
   Generate SHA-256 hashes for both binaries into `release/SHA256SUMS.txt`.
7. **Git Tag:**
   Create a signed or annotated Git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`.
