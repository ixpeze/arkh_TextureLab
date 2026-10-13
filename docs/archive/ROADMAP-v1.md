# ARKH TextureLab Roadmap

Strategic roadmap for upcoming features, engine expansions, and release milestones.

---

## Current Status: v1.0 Foundation
- [x] Pure Rust Native Workstation: Built with eframe/egui, egui_dock, and Rayon parallel DAG engine.
- [x] Node-based DAG evaluator with topological sort and dirty propagation.
- [x] Channel packing engine with industry presets (Unreal Engine ORM, Unity MaskMap, Blender).
- [x] DirectX and OpenGL normal map conversion and tangent-space normalizer.
- [x] Dockable native workstation UI via `egui_dock` with Unreal Engine navigation standards.

---

## Upcoming Milestones

### Milestone 1: Core Node Catalog & Math Precision
* **Advanced Mathematical Nodes**: Voronoi noise, Perlin noise, Curvature extraction from height, Ambient Occlusion baking approximation.
* **16-bit / 32-bit Float Pipeline**: Extended precision for displacement and height maps with zero banding artifacts.
* **OpenEXR & HDR Support**: Lossless high-dynamic-range texture import and export capabilities.

### Milestone 2: Interactive 3D PBR Viewport
* **Hardware-Accelerated 3D Preview**: Integrated wgpu/WebGL 3D viewport with standard preview geometry (Sphere, Cube, Cylinder, Cloth Plane, Shader Ball).
* **Environment IBL Lighting**: Equirectangular HDR environment maps with roughness-based specular reflection convolution.
* **Real-time Material Shading**: Accurate Metallic-Roughness PBR pipeline with microfacet GGX specular distribution.

### Milestone 3: Batch Pipeline & Headless CLI
* **TextureLab CLI Tooling**: Headless execution mode (`texturelab-cli --graph graph.json --export ./output/`) for build automation and automated game asset pipelines.
* **Folder Watcher & Auto-Pack**: Hot-reload directories that automatically channel-pack maps as source files are saved from Photoshop or Substance.
* **Preset Template Designer**: User-definable export presets with custom channel routing and custom token naming syntax.

### Milestone 4: Extensibility & Shading Graphs
* **Custom Node Scripts**: Custom compute nodes written in WGSL or OSL for advanced algorithmic patterns.
* **Subgraphs & Macro Nodes**: Group complex node arrangements into reusable custom modules with exposed parameter sockets.
