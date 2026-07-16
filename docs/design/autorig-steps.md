# Auto-rig the bulldog → real dog movement (FREE path)

Durable copy of the hand-off (macOS blocked my tooling from updating the Desktop copy).

**Upload file:** `~/Desktop/frenchie-autorig/bulldog-rigready.glb` — single mesh, textures
embedded (1K baseColor + normal), centered, feet on floor, ~2 units tall, ~13k verts
(under Anything World's 20k no-decimation cap). Regenerate any time from
`assets/models/bulldog-puppy.glb` via: `join → dedup → prune → center --pivot below`
(all `npx @gltf-transform/cli`) then scale ×(2/36.1).

Goal: a **skeleton + real skeletal animations** (walk, idle, sit, lie down) so the pup
moves like an actual dog instead of procedural puppet motion. **Both services are free —
you only need one rig.**

## Option A — Anything World (recommended free pick, purpose-built for animals)
Free tier ≈ 3–4 rigs/month (need 1). Better joint control for a stubby bulldog.
App-shippable with an "Animated by Anything World" credit (I'll add it to Us/Settings).
1. **app.anything.world** → free sign-up → **Animate Anything**.
2. Drag in `bulldog-rigready.glb`. Set type **Animal → Canine/dog**.
3. Rotation step: nose forward, feet down. Choose **symmetrical**.
4. **Rig-node step (make-or-break):** drag the joints into the real hip/knee/ankle/spine/
   tail — get the four leg joints sitting *inside* the actual stubby legs.
5. Generate (8–30 min). In the preview, **read the animation list** and check walk/idle
   don't pinch at hips/jowls. Confirm which clips exist — walk/run/idle expected; **sit /
   lie-down NOT guaranteed for dogs, so verify before downloading.**
6. Download as **glTF / GLB** (textures + clips embedded). Send me the file.

## Option B — Meshy (also free, backup)
Rigging + animation are **free (0 credits, unlimited)**. Faster (~30s) but thinner dog
animations and less control. CC BY 4.0 (credit Meshy).
1. **meshy.ai** → free account → **Animate**.
2. Upload `bulldog-rigready.glb`. Character type → **Quadruped**.
3. Auto-rig → pick animations → export **GLB**. Send me the file.

## If BOTH free options fail — still free, no paying
I'll do a free local rig: transfer a skeleton + animations from the CC0 rigged dog we
already have (`assets/models/shiba.glb` — Walk/Gallop/Idle/Sit clips) onto the bulldog
mesh in Blender. More manual on my end, $0, app-shippable.

## When the animated GLB comes back
Swap the procedural `RealisticPupStage` → a rigged stage that plays the real clips (keep
PMREM lighting), map moods → clips (idle→Idle, check-in→bouncy, sleepy→lie-down, walk on
ambient wander — matched to the export's actual clip names), add the credit, verify, commit.
