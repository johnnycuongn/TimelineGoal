# Realistic 3D Bulldog for iOS — Design (2026-07-15)

User ask: *"For the 3D dog model in just iOS, consider between expo-gl, three,
@react-three/fiber, @react-three/drei — brainstorm, design and make the french
bulldog 3D model, most realistic, high resolution"* (with a reference image of a
photoreal fawn French Bulldog).

Follow-up to `3d-research-summary.md` (2026-07-12). Two research agents re-verified the
stack for SDK 57 and hunted every license-safe realistic model source; findings below.

## 1. The library question: they're layers, not alternatives

`expo-gl` (GL surface) → `three` (engine) → `@react-three/fiber/native` (React renderer)
→ `@react-three/drei/native` (helpers). You use all four together — the repo already does
(shiba prototype). The *real* choice:

| Option | Realism ceiling | Expo Go | Notes |
|---|---|---|---|
| **three + R3F + drei on expo-gl** ✅ | High — full PBR, IBL, ACES, soft shadows | ✅ yes | Only true-3D path in Expo Go. iOS runs raw OpenGL ES 3 via EAGL (deprecated by Apple but functional); **iOS simulator cannot present frames — physical iPhone only** |
| raw three on expo-gl (no R3F) | same | ✅ | Loses R3F's native texture polyfills (the thing that makes GLB textures work on RN) — strictly worse |
| react-native-filament 1.11 | Highest (Metal, true IBL, off-JS-thread) | ❌ dev build | Margelo worklets runtime conflicts to manage; RN 0.86 compat unconfirmed. Revisit at the M5 dev-build gate |
| Pre-rendered WebP / Rive | n/a (fake 3D) | ✅ | Fallback if live 3D disappoints |

**Decision: three 0.185 + fiber 9.6.1 + drei 10.7.7 + expo-gl 57 (installed versions), realism pipeline added.**

## 2. Verified platform facts (research agent, 2026-07-15)

- **Embedded GLB textures (JPEG/PNG) work on RN** — fiber's `/native` entry auto-installs
  polyfills (BlobManager base64 parts, `createObjectURL`→data URI, patched
  `TextureLoader`/`FileLoader` → expo-file-system cache → native decode). Code-verified in
  our installed node_modules; field-verified on the Android emulator today (see proof).
- **Offline IBL**: `PMREMGenerator.fromScene(new RoomEnvironment())` — zero assets, no
  network. drei's `<Environment preset>` is **banned** (fetches HDRs from a CDN at runtime).
- **Hard bans**: Draco, KTX2/Basis, meshopt (no Workers/WASM in RN). `gltf-transform
  quantize` is the only safe compression. Textures ≤2K (4K ≈ 89 MB GPU, no compression).
- **dpr is forced to native PixelRatio** by fiber native (can't clamp); a ~300pt stage ≈
  0.9MP on a 3x iPhone — comfortably within budget at ≤80k tris, MSAA 4x on, ACES free,
  one PCFSoft shadow (≤2048 map) fine. No EffectComposer. Remote JS debugging breaks GL.

## 3. Model sourcing — the honest state of the world

No **directly-downloadable free/CC** model is a photoreal *bat-eared* French Bulldog.
Exhaustive hunt (Sketchfab API × Objaverse HF mirror × poly.pizza × GitHub × Meshy):

- **Chosen: "Bulldog Puppy" by doinspire** — CC-BY 4.0, realistic fawn/white bulldog
  puppy, 21.6k tris, embedded 1024² baseColor + normal PNGs, standing pose, no rig.
  Pulled auth-free from the Objaverse mirror. It's an *English* bulldog puppy (folded
  ears, not bat ears) — and arguably closer to chunky-wrinkly Mochi than a lean adult
  Frenchie. Vendored at `assets/models/bulldog-puppy.glb`; attribution in
  `MODEL-LICENSE.md` (an in-app credits line lands with the M5 "Us" tab).
- **True-Frenchie upgrade paths** (pipeline is model-agnostic — swap the GLB):
  1. **Meshy AI image-to-3D** from the user's reference image (free tier, CC-BY,
     needs their account; can auto-rig + jump presets → mood clips!). Best next step.
  2. **reedcgi's CC-BY photoscans** (Sketchfab login required) — real Frenchie scans but
     asleep-on-a-rug with baked-in floor; needs Blender cleanup. High effort.
  3. **Paid rigged**: CGTrader "Dog - French Bulldog" (13k tris + mobile LOD, 54 bones,
     100+ anims, 2048² PBR, app-friendly royalty-free license) — the professional option
     if 3D graduates from beta.

## 4. The stage: `RealisticPupStage`

`src/features/bulldog/pup3d/RealisticPupStage.tsx`, alongside the stylized shiba stage.

- **Lighting rig**: RoomEnvironment PMREM as `scene.environment` + one warm key
  `directionalLight` (casts the only shadow) + soft fill. R3F defaults already give
  sRGB + ACESFilmic tone mapping.
- **Grounding**: `ShadowMaterial` floor plane (soft contact shadow, opacity ~0.25) —
  cheap and reliable on expo-gl, no drei ContactShadows (extra render targets).
- **Auto-framing**: measure `Box3`, normalize scale, feet on floor (same proven approach
  as the shiba stage — never trust scan node scales).
- **Life without a rig** (motion-spec: springy, meaningful, reduce-motion aware):
  - *breathing* — subtle sinusoidal chest scale, the "alive" signal (off under Reduce Motion)
  - *tap* → spring **bounce** with squash-and-stretch landing + tick haptic + `happy` on
    the shared bulldog store (check-ins bounce him too via the store)
  - *love* → side wiggle; *sleepy/pout* → slow breathing + gentle nose-down settle
  - *turntable* — horizontal drag orbits him (gesture-handler Pan; user-driven, so
    allowed under Reduce Motion). Inspecting the pup from all sides IS the feel-test.
- **Den integration**: the existing "✨ 3D pup (beta)" toggle now shows the realistic pup
  (one-line revert to the shiba). Dev route **`/frenchie-test`** (no auth, like
  `/pup3d-test`) for quick device checks; remove both at M5.

## 5. Emotions on a rig-less scan (added 2026-07-15, user request)

The scan has no bones and no morph targets, so emotions are procedural and
**self-calibrated from the mesh at mount** (nothing hand-tuned to this GLB): face
direction = eyes-center − body-center; tail tip = rear-most high vertex; muzzle =
front-most mid-height vertex.

- **happy** (`trigger('happy')` — taps, check-ins; `party` = bigger): double/triple
  ballistic hop with squash-and-stretch landings, body shimmy, **fast tail wag** — a
  vertex-shader bend (Rodrigues rotation with smooth radial falloff around the tail
  tip, injected via `onBeforeCompile`, per-mesh object-space uniforms) — and a pink
  **tongue blep** sliding out of the auto-detected muzzle. *Happy eyes need morph
  targets a scan doesn't have — that arrives with the rigged-model upgrade (§3).*
- **sad** (`trigger('pout')` / `sleepy`; Den fires it after 3 quiet days): tail
  **droops** (negative pitch through the same shader), nose dips, breathing slows.
- **neutral** (`setIdle()`): soft breathing + a lazy occasional tail sway.

Everything routes through the shared `useBulldogStore`, so real app events animate the
realistic pup exactly like the SVG Mochi; `/frenchie-test` has happy/sad/neutral chips
for direct feel-testing. Reduce Motion: hops/wag/shimmy off, turntable (user-driven) stays.

**Gotchas found live** (both screenshot-reproduced, both fixed):
1. `Box3.setFromObject` works in WORLD space — on remounts R3F recycles the group with
   the previous ~0.04 scale still applied, compounding into a gigantic pup. Reset the
   group to identity before measuring.
2. A `setState` from an effect inside the async-mounted R3F root trips React 19's
   "update on a component that hasn't mounted yet" — calibration results live in refs
   the frame loop applies imperatively instead.

## 5b. Ambient life — a full behavior repertoire (2026-07-15, user request)

*"Make it like a real dog I can see and take care of."* A rig-less scan can't leg-walk,
so "alive" is whole-body: the frame loop damps the mesh toward posture **targets**
(yaw/pitch/roll/x/z/sink/mouth) and layers **oscillators** (breath, step-bob, tail wag,
shake, dream-twitch) on top. WHAT those targets are is decided by
`pupBehaviors.ts` — a pure, unit-tested ethogram + weighted scheduler:

- **neutral (idle)** — the pup LIVES here, autonomously cycling with relaxed pauses
  between: `lookAround` (scan the room), `headTilt` (the curious "bork?"), `lookUp`,
  `sniffGround` (nose down + shuffle), `walk` (trot to a new spot with a waddle),
  `turnAround`, `shakeOff`, `pant` (tongue lolling), `playBow`, `sit`, `wagBurst`,
  `barkOnce` (windup + lunge, no haptic — ambient). Occasionally a full **`napCycle`**:
  yawn → lie down → sleep (deep slow breath + rare dream-twitch) → wake + stretch.
- **sad ('pout')** — `sigh`, `lookAway`, `lieGlum`; tail tucked, breathing slowed.
- **sleepy** — drops straight into `napCycle` (boop to wake).
- **happy/party/love/proud** — scripted (hop(s) + fast wag + tongue + shimmy; party
  adds a joy-spin) and INTERRUPT the ambient action — a check-in cuts a yawn short.

Why damped-targets: every transition is springy and **interruptible** for free (a real
mood eases in mid-action, never snaps) — motion-spec's first law, applied to a mesh
with no skeleton. Randomness lives only in the frame loop (`Math.random`), never in
render, so React-Compiler purity holds. Small stages (the Den ring) get a tighter
wander radius (`roam`) so he potters within the ring instead of trotting out of frame.
Reduce Motion → the scheduler is off and he holds still.

`pupBehaviors.ts` is pure (no three/RN imports) and unit-tested (10 tests): every
behavior well-formed, `run()` emits only finite numbers across its whole 0→1 timeline,
`pickBehavior` respects pool + weights, durations/gaps bounded, stage clamped.

## 6. Verification (done 2026-07-15 on the Android emulator — same GL path as iPhone)

Gates: typecheck ✓ · lint 0 errors ✓ · unit 46/46 ✓ (10 new for the behavior system)
· iOS export ✓ (GLB bundled). Live, screenshot-proofed in `docs/design/proof/frenchie3d-*.png`:
embedded 1K PBR textures render (the historically-broken RN path — field-confirmed),
RoomEnvironment PMREM + ACES + PCF contact shadow, auto-framing, turntable drag, tap-hop
with squash landing, tail wag oscillating across frames, tongue blep, sad droop + slump,
and the **ambient scheduler running** — the pup autonomously changes heading/pose across
the neutral-frame series (`ambient-neutral`), sad chip tucks + lowers him (`ambient-sad`),
happy chip caught mid-hop (`ambient-happy-hop`). Stable once the Android AVD was given
4GB (a **low-RAM AVD OOM-killed its own system_server** under sustained software-GL load —
an emulator limit, not app code; real iPhones use hardware GL). **iOS feel-test is the
user's**: `npm start` → Expo Go on a physical iPhone (same Wi-Fi). The iOS simulator stays
a no-go for GL (documented in MILESTONES).

**Known real-device follow-up**: the Den's pup renders continuously (`frameloop` default
"always") since he's always animating — smooth and correct, but worth a battery/thermal
pass at M5 (e.g. drop to `frameloop="demand"` during long nap holds). Not tuned now to
avoid guessing without a device in hand.
