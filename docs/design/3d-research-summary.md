# 3D Mascot Research — Findings & Decision (2026-07-12)

Three parallel research agents investigated "real 3D jumping bulldog" for this Expo SDK 57 app.
Full context in git history; this is the durable summary.

## Verdicts

**Feasibility (true 3D in our stack):**
- ✅ Only Expo Go-compatible path: `three@0.185` + `@react-three/fiber@9.6.1(/native)` + `@react-three/drei@10.7.7(/native)` + `expo-gl@57`. Skeletal GLB clips work (`useGLTF` + `useAnimations`). Needs metro `assetExts.push('glb')`; **no Draco/KTX2 compression** (Hermes lacks WASM); **iOS simulator GL can hard-crash** (test on Android emulator / physical devices); renders on the JS thread (keep scenes tiny). pmndrs considers expo-gl a lame duck (WebGPU rewrite in pre-alpha) — treat as a 1–2 year solution.
- Dev-build options: `react-native-filament@1.11` (best: off-JS-thread, crossfade Animator, proven by the Pengu pet app; open iOS New-Arch crash report #322 unresolved) · `@reactvision/react-viro@2.57` (explicit SDK 57 support, but heavyweight AR engine).
- `expo-3d` doesn't exist; Spline has no real RN runtime; Mixamo is humanoid-only.

**Assets:**
- **Chosen: Quaternius Pug (CC0)** — poly.pizza/m/1gXKv15ik8, ~644 tris; the single-model GLB ships clips `Armature|Idle` + `Armature|Jump` (147KB). Vendored at `assets/models/pug.glb` (+ PUG-LICENSE.md).
- Bigger packs: Quaternius Ultimate Animated Animals (Shiba/Husky, 12+ clips, CC0, glTF).
- Custom *bulldog*: **Meshy AI** free tier (100 credits/mo) generates + auto-rigs quadrupeds + jump presets, exports animated GLB, CC-BY-4.0 w/ attribution. Tripo free tier is non-commercial — avoid. **Anything World** auto-rigs static GLBs (quadruped Mixamo-equivalent, 3 free/mo).

**Market evidence (what companion-app hits actually use):**
- No app-built companion uses realtime 3D. Duolingo = **Rive** 2D state machines + fake-3D joysticks; Finch = 2D (Flutter); Widgetable = pre-rendered frames. True 3D (Pokémon Sleep, Peridot) = full Unity game studios.
- Strong Expo Go-safe alternative: render 3D → **transparent animated WebP** clips via `expo-image` (~100–500KB/clip; WhatsApp-sticker-style pipeline; bandana partner-colors need an SVG overlay).
- Rive: dev build required (both runtimes), $9/mo export plan; files ~10× smaller than Lottie, ~60fps vs Lottie's ~17fps for characters. lottie-react-native 7.3.8 *is* bundled in Expo Go (fine for FX, weak for characters).

## Decision (user-approved)

**Timeboxed 3D prototype in Expo Go** — `Pug3DStage` (src/features/bulldog/pug3d/) behind a
"✨ try the 3D pup (beta)" toggle in the Den. Latte-tinted CC0 pug; Idle loop; Jump on
check-in/tap (crossfade); Reduce Motion → frozen pose. SVG Mochi stays the product mascot.

**Decision gate after living with it:** ① love it → commit to dev build + Filament (or R3F) and a
custom Meshy bulldog; ② mixed → pre-rendered WebP hero moments and/or Rive at M5; ③ meh → drop the
toggle, keep Mochi. A dev build is likely coming anyway (Rive, Google/Apple auth, Expo Go's App
Store limbo on SDK 55+).
