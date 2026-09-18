# 3D pup models — provenance

- **bulldog-rigged.glb** — the CURRENT Den pup: doinspire's bulldog-puppy mesh (below)
  rigged locally in Blender (`tools/rig_bulldog.py`, 2026-07-16) by transferring the
  skeleton + all 12 animation clips from the CC0 Quaternius shiba (below). Combined
  licensing: mesh/textures **CC-BY 4.0 (credit doinspire)** · skeleton/animations
  **CC0 (Quaternius)** → ship with the doinspire credit line (M5 Us tab).
  Clips: Idle, Idle_2, Idle_2_HeadLow, Walk, Gallop, Gallop_Jump, Jump_ToIdle,
  Eating, Attack, Death, Idle_HitReact_Left/Right.

- **bulldog-puppy.glb** — "Bulldog Puppy" by **doinspire** (static original; also the
  procedural RealisticPupStage fallback)
  - https://sketchfab.com/3d-models/bulldog-puppy-7081c9c27df244bf84774361888f58a2
  - **License: CC Attribution 4.0 (CC-BY 4.0)** — attribution REQUIRED. Credit line:
    “Bulldog Puppy” by doinspire, licensed under CC BY 4.0
    (https://creativecommons.org/licenses/by/4.0/). Ship an in-app credit (M5 Us tab).
  - ~21.6k tris, 3 meshes; materials `Body` (baseColor + normal, 1024² PNG) and `Eyes`
    (baseColor 1024² PNG), embedded; STATIC (no rig/animations); glTF 2.0, no extensions
  - Downloaded 2026-07-15 from the Objaverse mirror (allenai/objaverse on Hugging Face,
    uid 7081c9c27df244bf84774361888f58a2) — CC-licensed Sketchfab models, auth-free

- **shiba.glb** — Quaternius "Ultimate Animated Animal Pack" via Poly Pizza (stylized stage)
  - https://poly.pizza/m/y4wdQpg767 · Author: Quaternius (https://quaternius.com)
  - **License: CC0 1.0** (public domain) — no attribution required (given anyway with thanks!)
  - ~1,950 tris, no textures, real eye meshes (Eyes_White/Pupil/Black materials)
  - Clips: Idle, Idle_2, Idle_2_HeadLow, Walk, Gallop, Gallop_Jump, Jump_ToIdle, Eating,
    Attack, Death, Idle_HitReact_Left/Right (+ AnimalArmature|* duplicates)
  - Downloaded 2026-07-12 from https://static.poly.pizza/ba6d0ee3-bcc0-4ef0-9d3c-a3e245b41c77.glb
- Previous model (removed): Quaternius Farm Pack Pug (CC0) — too simple, no eye geometry.

## pup.glb (this app)

Derived from `bulldog-rigged.glb` above with gltf-transform (meshopt geometry
compression, WebP textures at 1024px). Mesh and textures: "Bulldog Puppy" by
doinspire, CC BY 4.0. Skeleton and animation clips: Quaternius, CC0.

Animation clips: Attack, Death, Eating, Gallop, Gallop_Jump, Idle, Idle_2,
Idle_2_HeadLow, Idle_HitReact_Left, Idle_HitReact_Right, Jump_ToIdle, Walk.
