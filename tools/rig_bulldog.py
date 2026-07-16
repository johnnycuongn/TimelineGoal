"""
Transfer the CC0 shiba's skeleton + animations onto the realistic bulldog mesh.

Overlay the bulldog on the shiba (same center/ground/facing), per-axis warp the
skeleton's rest pose to the bulldog's proportions, snap each leg chain onto the
bulldog's actual leg positions, auto-skin, and export ONE animated GLB.
Run: blender --background --python rig_bulldog.py
"""
import bpy
import sys
from mathutils import Vector

DIR = "/tmp/bulldog-rig"

def log(*a):
    print("[rig]", *a, flush=True)

# ---------- clean scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- import shiba (skeleton donor) ----------
bpy.ops.import_scene.gltf(filepath=f"{DIR}/shiba.glb")
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
shiba_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
log("armature:", arm.name, "| shiba meshes:", [m.name for m in shiba_meshes])

def world_bbox(objs):
    pts = []
    for o in objs:
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

s_lo, s_hi = world_bbox(shiba_meshes)
s_size = s_hi - s_lo
s_center = (s_hi + s_lo) / 2
# shiba facing: Head bone vs armature center, horizontal
bpy.context.view_layer.update()
head_w = arm.matrix_world @ arm.data.bones["Head"].head_local
s_face = Vector((head_w.x - s_center.x, head_w.y - s_center.y, 0)).normalized()
log("shiba bbox size:", tuple(round(v, 3) for v in s_size), "face:", tuple(round(v, 2) for v in s_face))

# delete shiba meshes
for m in shiba_meshes:
    bpy.data.objects.remove(m, do_unlink=True)

# ---------- import bulldog ----------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f"{DIR}/bulldog-puppy.glb")
new_objs = [o for o in bpy.data.objects if o not in before]
bd_meshes = [o for o in new_objs if o.type == "MESH"]
log("bulldog meshes:", [(m.name, m.active_material.name if m.active_material else "?") for m in bd_meshes])

# apply all transforms so mesh data is in world coords
bpy.ops.object.select_all(action="DESELECT")
for m in bd_meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = bd_meshes[0]
# clear parenting to wrapper empties, keep world transform
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# delete leftover empties from the sketchfab wrapper
for o in new_objs:
    if o.type == "EMPTY":
        bpy.data.objects.remove(o, do_unlink=True)

eyes = next((m for m in bd_meshes if any(ms.material and ms.material.name == "Eyes" for ms in m.material_slots)), None)
bodies = [m for m in bd_meshes if m is not eyes]
log("eyes mesh:", eyes.name if eyes else "NONE", "| body meshes:", [b.name for b in bodies])

# join body meshes into one
bpy.ops.object.select_all(action="DESELECT")
for b in bodies:
    b.select_set(True)
bpy.context.view_layer.objects.active = bodies[0]
if len(bodies) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = "BulldogBody"
if eyes:
    eyes.name = "BulldogEyes"

bd_all = [body] + ([eyes] if eyes else [])
b_lo, b_hi = world_bbox(bd_all)
b_size = b_hi - b_lo
b_center = (b_hi + b_lo) / 2
# bulldog facing from eyes centroid (horizontal)
if eyes:
    e_lo, e_hi = world_bbox([eyes])
    e_c = (e_lo + e_hi) / 2
    b_face = Vector((e_c.x - b_center.x, e_c.y - b_center.y, 0)).normalized()
else:
    b_face = Vector((0, -1, 0))
log("bulldog bbox size:", tuple(round(v, 3) for v in b_size), "face:", tuple(round(v, 2) for v in b_face))

# ---------- overlay bulldog onto shiba: rotate to same facing, scale to length, align ----------
import math
ang = math.atan2(s_face.y, s_face.x) - math.atan2(b_face.y, b_face.x)
for o in bd_all:
    o.rotation_euler = (0, 0, ang)
bpy.ops.object.select_all(action="DESELECT")
for o in bd_all:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(rotation=True)

b_lo, b_hi = world_bbox(bd_all)
b_size = b_hi - b_lo
b_center = (b_hi + b_lo) / 2

# scale bulldog so its body LENGTH (along shiba face axis) matches shiba's
fx = abs(s_face.x) > abs(s_face.y)
s_len = s_size.x if fx else s_size.y
b_len = b_size.x if fx else b_size.y
scale = s_len / b_len
for o in bd_all:
    o.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(scale=True)
b_lo, b_hi = world_bbox(bd_all)
b_size = b_hi - b_lo
b_center = (b_hi + b_lo) / 2
# align: same horizontal center, feet on shiba's ground
off = Vector((s_center.x - b_center.x, s_center.y - b_center.y, s_lo.z - b_lo.z))
for o in bd_all:
    o.location = o.location + off
bpy.ops.object.select_all(action="DESELECT")
for o in bd_all:
    o.select_set(True)
bpy.ops.object.transform_apply(location=True)
b_lo, b_hi = world_bbox(bd_all)
b_size = b_hi - b_lo
b_center = (b_hi + b_lo) / 2
log("bulldog overlaid: size", tuple(round(v, 3) for v in b_size))

# ---------- landmark scan of the bulldog mesh ----------
ground = b_lo.z
h = b_size.z
dm = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
mw = body.matrix_world
# quadrant leg centroids from the lower 35% of the body
legsum = {}
legn = {}
for v in dm.vertices:
    w = mw @ v.co
    zf = (w.z - ground) / h
    if zf < 0.35:
        f = (w - b_center).dot(s_face) > 0
        sd = (w - b_center).cross(Vector((0, 0, 1))).dot(s_face)  # side sign helper
        sright = ((w - b_center) - (w - b_center).project(s_face)).dot(s_face.cross(Vector((0, 0, 1)))) > 0
        key = ("F" if f else "B") + ("R" if sright else "L")
        legsum.setdefault(key, Vector((0, 0, 0)))
        legsum[key] += w
        legn[key] = legn.get(key, 0) + 1
legc = {k: legsum[k] / legn[k] for k in legsum}
body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
log("leg centroids:", {k: tuple(round(x, 3) for x in v) for k, v in legc.items()})

# ---------- warp the skeleton's rest pose to the bulldog ----------
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones

# per-axis scale about the anchor (shiba center at ground level)
anchor = Vector((s_center.x, s_center.y, s_lo.z))
sxy = Vector((b_size.x / s_size.x, b_size.y / s_size.y, b_size.z / s_size.z))
def warp(p):
    d = p - anchor
    return anchor + Vector((d.x * sxy.x, d.y * sxy.y, d.z * sxy.z))
minv = arm.matrix_world.inverted()
for b in eb:
    hw = arm.matrix_world @ b.head
    tw = arm.matrix_world @ b.tail
    b.head = minv @ warp(hw)
    b.tail = minv @ warp(tw)

# snap each leg chain horizontally onto the bulldog's leg centroid + feet to ground
CHAINS = {
    "FL": ["FrontShoulder.L", "FrontUpperLeg.L", "FrontLowerLeg.L"],
    "FR": ["FrontShoulder.R", "FrontUpperLeg.R", "FrontLowerLeg.R"],
    "BL": ["BackShoulder.L", "BackLeg.L", "BackUpperLeg.L", "BackLowerLeg.L"],
    "BR": ["BackShoulder.R", "BackLeg.R", "BackUpperLeg.R", "BackLowerLeg.R"],
}
for key, names in CHAINS.items():
    if key not in legc:
        continue
    top = eb[names[0]]
    top_w = arm.matrix_world @ top.head
    delta = Vector((legc[key].x - top_w.x, legc[key].y - top_w.y, 0))
    for n in names:
        b = eb[n]
        b.head = minv @ ((arm.matrix_world @ b.head) + delta)
        b.tail = minv @ ((arm.matrix_world @ b.tail) + delta)
    # foot: put the last bone's tail on the ground
    foot = eb[names[-1]]
    fw = arm.matrix_world @ foot.tail
    foot.tail = minv @ Vector((fw.x, fw.y, ground + 0.001))

bpy.ops.object.mode_set(mode="OBJECT")
log("skeleton warped")

# helper bones must not receive weights. The EAR chains are disabled too: the
# shiba's upright-ear bones sit wrong on the bulldog's flat folded ears and the
# clips' ear-flapping folds them — rigid-with-Head is correct for floppy ears.
for b in arm.data.bones:
    if b.name.startswith(("IK", "FF", "PoleTarget", "Ear")) or b.name.endswith("_end"):
        b.use_deform = False

# ---------- skin ----------
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
groups = [g.name for g in body.vertex_groups]
log("body vertex groups:", len(groups))
if len(groups) < 10:
    log("AUTO WEIGHTS LOOK WRONG — falling back to envelopes")
    bpy.ops.object.parent_set(type="ARMATURE_ENVELOPE")

if eyes:
    bpy.ops.object.select_all(action="DESELECT")
    eyes.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_NAME")  # empty groups
    vg = eyes.vertex_groups.get("Head") or eyes.vertex_groups.new(name="Head")
    vg.add(range(len(eyes.data.vertices)), 1.0, "REPLACE")
    log("eyes bound rigidly to Head")

# ---------- weight polish (fixes the v1 skinning artifacts) ----------
from mathutils.kdtree import KDTree

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body

# smooth + clean + limit — softens pinching folds at the neck/shoulders
bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=2, expand=0.0)
bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.02)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
bpy.ops.object.mode_set(mode="OBJECT")
log("weights smoothed/cleaned/limited")

me = body.data
nverts = len(me.vertices)

def read_weights(i):
    return {g.group: g.weight for g in me.vertices[i].groups}

def write_weights(i, w):
    for vg in body.vertex_groups:
        try:
            vg.remove([i])
        except RuntimeError:
            pass
    for gi, gw in w.items():
        if gw > 0.001:
            body.vertex_groups[gi].add([i], gw, "REPLACE")

# 1) WELD weights across coincident vertices (UV-seam twins). The scan splits
#    vertices along texture seams; if the twins deform with different weights
#    the surface physically cracks — average the weights per position-cluster.
kd = KDTree(nverts)
for i, v in enumerate(me.vertices):
    kd.insert(v.co, i)
kd.balance()
eps = max(b_size) * 2e-5
seen = set()
welded = 0
for i, v in enumerate(me.vertices):
    if i in seen:
        continue
    cluster = [j for (_, j, dist) in kd.find_range(v.co, eps)]
    seen.update(cluster)
    if len(cluster) < 2:
        continue
    avg = {}
    for j in cluster:
        for gi, gw in read_weights(j).items():
            avg[gi] = avg.get(gi, 0.0) + gw / len(cluster)
    for j in cluster:
        write_weights(j, avg)
    welded += len(cluster)
log(f"welded weights across {welded} seam-twin vertices")

# 2) RESCUE under-weighted vertices (the mid-jump stray scraps: near-zero total
#    weight leaves them frozen at bind pose while the body animates away).
good = []
bad = []
for i in range(nverts):
    total = sum(read_weights(i).values())
    (good if total > 0.5 else bad).append(i)
if bad:
    kdg = KDTree(len(good))
    for gi_, i in enumerate(good):
        kdg.insert(me.vertices[i].co, i)
    kdg.balance()
    for i in bad:
        _, j, _ = kdg.find(me.vertices[i].co)
        write_weights(i, read_weights(j))
log(f"rescued {len(bad)} under-weighted vertices")

# final normalize
bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
bpy.ops.object.mode_set(mode="OBJECT")

# ---------- drop duplicate actions ----------
for act in list(bpy.data.actions):
    if act.name.startswith("AnimalArmature|"):
        bpy.data.actions.remove(act)
log("actions kept:", sorted(a.name for a in bpy.data.actions))

# ---------- export ----------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=f"{DIR}/bulldog-rigged.glb",
    export_format="GLB",
    export_animations=True,
    export_skins=True,
    export_yup=True,
)
log("EXPORTED bulldog-rigged.glb")

# ---------- render verification stills: bind pose, walk mid-stride, gallop ----------
scene = bpy.context.scene
cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
d = max(s_size) * 2.0
side_v = Vector((-s_face.y, s_face.x, 0))
# three-quarter front view at chest height — shows face, ears, legs and seams
cam.location = s_center + s_face * d * 0.85 + side_v * d * 0.5 + Vector((0, 0, s_size.z * 0.35))
direction = (s_center - cam.location).normalized()
cam.rotation_euler = direction.to_track_quat("-Z", "Z").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
scene.collection.objects.link(sun)
sun.rotation_euler = (0.9, 0.3, 0.8)
fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
fill.data.energy = 1.2
scene.collection.objects.link(fill)
fill.rotation_euler = (1.1, -0.4, -2.2)
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        scene.render.engine = eng
        break
    except Exception:
        continue
scene.render.resolution_x = 700
scene.render.resolution_y = 700

def render_action(action_name, frame, out):
    if action_name:
        act = bpy.data.actions.get(action_name)
        if not act:
            log("no action", action_name)
            return
        arm.animation_data_create()
        arm.animation_data.action = act
        scene.frame_set(frame)
    scene.render.filepath = f"{DIR}/{out}"
    bpy.ops.render.render(write_still=True)
    log("rendered", out)

render_action(None, 1, "check-bind.png")
render_action("Walk", 8, "check-walk.png")
render_action("Gallop_Jump", 14, "check-jump.png")  # mid-air — stray-scrap check
render_action("Idle_2_HeadLow", 30, "check-rest.png")  # deep head-down — ear-fold check
render_action("Eating", 40, "check-eat.png")  # nose to floor — ear + seam check
log("DONE")
