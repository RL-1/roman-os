"""The photo behind the site: a beige CRT on a desk, afternoon sun through blinds.

blender -b -P scene/room.py -- <out.png> [scale=1.0] [samples=128]

Besides the image it writes <out>.json with the screen's rectangle in image fractions,
which the site uses to lay the desktop exactly over the glass.
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'room.png')
SCALE = float(argv[1]) if len(argv) > 1 else 1.0
SAMPLES = int(argv[2]) if len(argv) > 2 else 128
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ───────────── helpers ─────────────

def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def material(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0, bump=0.0, bump_scale=600.0, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Specular IOR Level'].default_value = spec
    if coat:
        p.inputs['Coat Weight'].default_value = coat
    if emit:
        p.inputs['Emission Color'].default_value = srgb(emit)
        p.inputs['Emission Strength'].default_value = emit_strength
    if bump:
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = bump_scale
        tex.inputs['Detail'].default_value = 8
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.0004
        nt.links.new(tex.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def obj_from_bm(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob


def bevel(ob, width, segs=4, angle=40):
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return m


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        ob.modifiers.new('wn', 'WEIGHTED_NORMAL').keep_sharp = True
    except Exception:
        pass


def box(name, sx, sy, sz, loc, mat=None, bev=0.0, segs=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    ob = obj_from_bm(name, bm, mat)
    ob.location = loc
    if bev:
        bevel(ob, bev, segs)
        smooth(ob)
    return ob


def rrect(w, h, r, n=8):
    """Rounded rectangle in the XZ plane, counter-clockwise, as (x, z) pairs."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def loft(name, rings, mat=None, cap=True):
    """rings: list of (y, w, h, r, dz). Builds a closed tube through rounded rectangles along +Y."""
    bm = bmesh.new()
    loops = []
    for y, w, h, r, dz in rings:
        loops.append([bm.verts.new((x, y, z + dz)) for x, z in rrect(w, h, r)])
    for a, b in zip(loops, loops[1:]):
        n = len(a)
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap:
        bm.faces.new(list(reversed(loops[0])))
        bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, mat)


def boolean(ob, cutter, op='DIFFERENCE'):
    m = ob.modifiers.new('bool', 'BOOLEAN')
    m.operation = op
    m.object = cutter
    m.solver = 'EXACT'
    cutter.hide_render = True
    cutter.hide_viewport = True
    return m


def hidden_from_camera(ob):
    ob.visible_camera = False
    ob.visible_glossy = False
    ob.visible_transmission = False


# ───────────── materials ─────────────

beige = material('beige', '#cbb994', rough=0.5, bump=0.07, bump_scale=900, spec=0.42)
beige_dark = material('beige-dark', '#a99b7c', rough=0.52, bump=0.05, spec=0.4)
ring_mat = material('mask', '#121212', rough=0.55)
glass = material('glass', '#05070a', rough=0.06, spec=0.9, emit='#0b0f14', emit_strength=0.6)
led = material('led', '#3cff6a', rough=0.3, emit='#3cff6a', emit_strength=18)
rubber = material('rubber', '#1b1a18', rough=0.7)
wall_mat = material('wall', '#b9a385', rough=0.92, bump=0.2, bump_scale=140)
key_mat = material('keys', '#d3c6a8', rough=0.5, bump=0.04, spec=0.4)
mug_mat = material('mug', '#e6dccb', rough=0.2, coat=0.5)
pot_mat = material('pot', '#b36a44', rough=0.75, bump=0.12, bump_scale=200)
leaf_mat = material('leaf', '#2f5a2c', rough=0.42, spec=0.5)
_ln = leaf_mat.node_tree
_lw = _ln.nodes.new('ShaderNodeTexWave')
_lw.wave_profile = 'SIN'
_lw.inputs['Scale'].default_value = 18
_lw.inputs['Distortion'].default_value = 6
_lr = _ln.nodes.new('ShaderNodeValToRGB')
_lr.color_ramp.elements[0].color = srgb('#1d3a1f')
_lr.color_ramp.elements[1].color = srgb('#5c7f3e')
_ln.links.new(_lw.outputs['Fac'], _lr.inputs['Fac'])
_ln.links.new(_lr.outputs['Color'], _ln.nodes['Principled BSDF'].inputs['Base Color'])
disk_mats = [material('disk-a', '#1f2124', rough=0.35), material('disk-b', '#2a3f73', rough=0.35), material('disk-c', '#8a2b26', rough=0.35)]

# desk wood: bands of colour with a little grain, slightly glossy
wood = bpy.data.materials.new('wood')
wood.use_nodes = True
nt = wood.node_tree
p = nt.nodes['Principled BSDF']
p.inputs['Roughness'].default_value = 0.38
tc = nt.nodes.new('ShaderNodeTexCoord')
mp = nt.nodes.new('ShaderNodeMapping')
mp.inputs['Scale'].default_value = (0.25, 7.0, 1.0)
grain = nt.nodes.new('ShaderNodeTexNoise')
grain.inputs['Scale'].default_value = 5.0
grain.inputs['Detail'].default_value = 12
grain.inputs['Roughness'].default_value = 0.62
grain.inputs['Distortion'].default_value = 1.8
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.3
ramp.color_ramp.elements[0].color = srgb('#3e2414')
ramp.color_ramp.elements[1].position = 0.72
ramp.color_ramp.elements[1].color = srgb('#93613a')
nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
nt.links.new(mp.outputs['Vector'], grain.inputs['Vector'])
nt.links.new(grain.outputs['Fac'], ramp.inputs['Fac'])
wb = nt.nodes.new('ShaderNodeBump')
wb.inputs['Strength'].default_value = 0.08
nt.links.new(grain.outputs['Fac'], wb.inputs['Height'])
nt.links.new(wb.outputs['Normal'], p.inputs['Normal'])
nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])

# ───────────── the monitor ─────────────

ZB = 0.055                       # bottom of the case above the desk
SW, SH, SR = 0.340, 0.245, 0.016  # visible screen: width, height, corner radius
CHIN, TOP, SIDE = 0.078, 0.034, 0.036
FW, FH = SW + 2 * SIDE, SH + CHIN + TOP
ZC = ZB + FH / 2                 # centre of the front shell
ZS = ZB + CHIN + SH / 2          # centre of the screen
DS = ZS - ZC                     # screen offset from the shell centre

shell = loft('shell', [(0.0, FW, FH, 0.022, ZC), (0.06, FW, FH, 0.022, ZC)], beige)
cut = loft('cut', [(-0.01, SW + 0.036, SH + 0.036, 0.03, ZS), (0.026, SW + 0.012, SH + 0.014, 0.02, ZS), (0.08, SW + 0.012, SH + 0.014, 0.02, ZS)])
boolean(shell, cut)
bevel(shell, 0.006, 4, 35)
smooth(shell)

ring = loft('mask', [(0.024, SW + 0.03, SH + 0.03, 0.02, ZS), (0.034, SW + 0.03, SH + 0.03, 0.02, ZS)], ring_mat)
hole = loft('hole', [(0.01, SW, SH, SR, ZS), (0.05, SW, SH, SR, ZS)])
boolean(ring, hole)

# glass: a gently bulging sheet just behind the mask
bm = bmesh.new()
nx, nz = 48, 36
gw, gh = SW + 0.01, SH + 0.01
grid = [[bm.verts.new((gw * (i / nx - 0.5), 0.0, gh * (j / nz - 0.5))) for i in range(nx + 1)] for j in range(nz + 1)]
for j in range(nz):
    for i in range(nx):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
for v in bm.verts:
    u, w = v.co.x / (gw / 2), v.co.z / (gh / 2)
    v.co.y = 0.037 - 0.007 * (1 - u * u) * (1 - w * w)
    v.co.z += ZS
glass_ob = obj_from_bm('glass', bm, glass)
smooth(glass_ob)

# the tube's housing behind the front shell, tapering back
body = loft('body', [(0.055, FW - 0.012, FH - 0.012, 0.03, ZC), (0.16, FW - 0.03, FH - 0.03, 0.04, ZC + 0.005), (0.40, 0.26, 0.22, 0.045, ZC + 0.02)], beige)
bevel(body, 0.01, 3, 30)
smooth(body)

# chin: badge, power button, led and two dials
bpy.ops.object.text_add(location=(-FW / 2 + 0.03, -0.0009, ZB + 0.032), rotation=(math.radians(90), 0, 0))
badge = bpy.context.active_object
badge.data.body = 'RL·1'
badge.data.size = 0.017
badge.data.extrude = 0.0007
badge.data.space_character = 1.15
badge.data.materials.append(beige_dark)
bpy.ops.object.text_add(location=(-FW / 2 + 0.03, -0.0004, ZB + 0.019), rotation=(math.radians(90), 0, 0))
sub = bpy.context.active_object
sub.data.body = 'COLOR DISPLAY'
sub.data.size = 0.0062
sub.data.extrude = 0.0003
sub.data.space_character = 1.4
sub.data.materials.append(beige_dark)

box('button', 0.026, 0.008, 0.014, (FW / 2 - 0.046, -0.002, ZB + 0.036), beige_dark, 0.003)
ledo = bpy.data.objects.new('led', bpy.data.meshes.new('led'))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.0028, radius2=0.0028, depth=0.004)
bm.to_mesh(ledo.data)
bm.free()
ledo.data.materials.append(led)
ledo.rotation_euler = (math.radians(90), 0, 0)
ledo.location = (FW / 2 - 0.075, -0.0015, ZB + 0.036)
scene.collection.objects.link(ledo)
for i, x in enumerate((0.03, 0.058)):
    d = bpy.data.objects.new(f'dial{i}', bpy.data.meshes.new(f'dial{i}'))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.0085, radius2=0.0078, depth=0.007)
    bm.to_mesh(d.data)
    bm.free()
    d.data.materials.append(rubber)
    d.rotation_euler = (math.radians(90), 0, 0)
    d.location = (x, -0.003, ZB + 0.036)
    scene.collection.objects.link(d)
    bevel(d, 0.0012, 2)
    smooth(d)
# grille slots on the chin
for i in range(16):
    box(f'slot{i}', 0.0018, 0.004, 0.016, (-0.055 + i * 0.0052, 0.0005, ZB + 0.036), ring_mat)

# swivel stand
box('neck', 0.13, 0.12, 0.04, (0, 0.16, 0.035), beige, 0.012)
base = bpy.data.objects.new('base', bpy.data.meshes.new('base'))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=0.15, radius2=0.135, depth=0.022)
bm.to_mesh(base.data)
bm.free()
base.data.materials.append(beige)
base.scale = (1.0, 0.82, 1.0)
base.location = (0, 0.16, 0.011)
scene.collection.objects.link(base)
bevel(base, 0.006, 3)
smooth(base)

# ───────────── the room ─────────────

desk = box('desk', 2.6, 1.3, 0.045, (0, 0.05, -0.0225), wood, 0.004, 2)
wall = box('wall', 4.0, 0.05, 3.0, (0, 0.66, 1.2), wall_mat)

# keyboard in front, slightly tilted
kb = box('keyboard', 0.45, 0.16, 0.026, (0.0, -0.26, 0.016), beige, 0.006)
kb.rotation_euler = (math.radians(-4), 0, 0)
for r in range(5):
    for c in range(15 if r < 4 else 9):
        w = 0.0165 if not (r == 4 and c == 4) else 0.1
        x = -0.205 + c * 0.0195 + (0.01 if r % 2 else 0)
        if r == 4:
            x = -0.15 + c * 0.0195 + (0.05 if c > 4 else 0)
        k = box(f'key{r}-{c}', w, 0.0165, 0.012, (x, -0.31 + r * 0.0205, 0.034 + r * 0.0014), key_mat, 0.0025, 2)

# mug and floppies on the right
mug = bpy.data.objects.new('mug', bpy.data.meshes.new('mug'))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.035, radius2=0.037, depth=0.088)
bm.to_mesh(mug.data)
bm.free()
mug.data.materials.append(mug_mat)
mug.location = (0.3, -0.09, 0.044)
scene.collection.objects.link(mug)
solid = mug.modifiers.new('solid', 'SOLIDIFY')
solid.thickness = 0.004
bevel(mug, 0.002, 2)
smooth(mug)
bpy.ops.mesh.primitive_torus_add(major_radius=0.021, minor_radius=0.0055, location=(0.34, -0.09, 0.046), rotation=(math.radians(90), 0, 0))
handle = bpy.context.active_object
handle.data.materials.append(mug_mat)
smooth(handle)
for i, m in enumerate(disk_mats):
    d = box(f'floppy{i}', 0.09, 0.093, 0.0033, (0.29 + 0.006 * i, -0.2 - 0.004 * i, 0.0017 + i * 0.0034), m, 0.0008)
    d.rotation_euler = (0, 0, math.radians(-14 + i * 9))

# snake plant on the left
pot = bpy.data.objects.new('pot', bpy.data.meshes.new('pot'))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.05, radius2=0.064, depth=0.11)
bm.to_mesh(pot.data)
bm.free()
pot.data.materials.append(pot_mat)
pot.location = (-0.36, 0.42, 0.055)
scene.collection.objects.link(pot)
bevel(pot, 0.004, 2)
smooth(pot)
for i in range(9):
    bm = bmesh.new()
    H = random.uniform(0.26, 0.46)
    W = random.uniform(0.018, 0.026)
    n = 12
    left, right = [], []
    for s in range(n + 1):
        t = s / n
        width = W * (math.sin(math.pi * min(t * 1.15, 1.0)) ** 0.6) * (1 - t) ** 0.35
        bend = 0.03 * t * t
        left.append(bm.verts.new((-width, bend, t * H)))
        right.append(bm.verts.new((width, bend, t * H)))
    for s in range(n):
        bm.faces.new((left[s], right[s], right[s + 1], left[s + 1]))
    leaf = obj_from_bm(f'leaf{i}', bm, leaf_mat)
    sol = leaf.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.0025
    smooth(leaf)
    a = i / 9 * math.tau + random.uniform(-0.3, 0.3)
    leaf.location = (-0.36 + 0.022 * math.cos(a), 0.42 + 0.022 * math.sin(a), 0.1)
    leaf.rotation_euler = (random.uniform(-0.18, 0.18), random.uniform(-0.18, 0.18), a + math.pi / 2)

# a framed print on the wall, upper left, soft in the background
frame = box('frame', 0.24, 0.02, 0.3, (-0.47, 0.625, 0.43), material('frame', '#1c1a18', rough=0.4), 0.003)
art = bpy.data.materials.new('print')
art.use_nodes = True
an = art.node_tree
ap = an.nodes['Principled BSDF']
ap.inputs['Roughness'].default_value = 0.8
atc = an.nodes.new('ShaderNodeTexCoord')
asep = an.nodes.new('ShaderNodeSeparateXYZ')
aramp = an.nodes.new('ShaderNodeValToRGB')
aramp.color_ramp.interpolation = 'CONSTANT'
els = aramp.color_ramp.elements
els[0].color = srgb('#1d4a52')
els[1].position = 0.5
els[1].color = srgb('#e9a23b')
e = els.new(0.68)
e.color = srgb('#d9562e')
e = els.new(0.82)
e.color = srgb('#f2e3c4')
an.links.new(atc.outputs['Generated'], asep.inputs['Vector'])
an.links.new(asep.outputs['Z'], aramp.inputs['Fac'])
an.links.new(aramp.outputs['Color'], ap.inputs['Base Color'])
box('print', 0.2, 0.004, 0.26, (-0.47, 0.613, 0.43), art)

# ───────────── light ─────────────

world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#8a6f55')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.12

sun_dir = Vector((-0.62, 0.62, -0.46)).normalized()
bpy.ops.object.light_add(type='SUN')
sun = bpy.context.active_object
sun.data.energy = 6.0
sun.data.color = (1.0, 0.78, 0.55)
sun.data.angle = math.radians(0.8)
sun.rotation_euler = sun_dir.to_track_quat('-Z', 'Y').to_euler()

# the right-hand wall with a window, and blinds in it (both unseen by the camera, only their shadows)
WX = 0.95
rw = box('right-wall', 0.04, 3.0, 3.0, (WX, 0.0, 1.2))
win = box('window', 0.2, 1.35, 1.1, (WX, -0.425, 0.85))
boolean(rw, win)
hidden_from_camera(rw)
for i in range(46):
    s = box(f'slat{i}', 0.017, 1.45, 0.0018, (WX - 0.01, -0.425, 0.31 + i * 0.024))
    s.rotation_euler = (0, math.radians(30), 0)
    hidden_from_camera(s)

# soft fill from the room, and the screen's own glow
bpy.ops.object.light_add(type='AREA', location=(-0.9, -1.1, 0.9))
fill = bpy.context.active_object
fill.data.energy = 18
fill.data.size = 1.6
fill.data.color = (1.0, 0.9, 0.8)
fill.rotation_euler = (Vector((0.2, 0.3, 0.25)) - fill.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.light_add(type='AREA', location=(0, -0.004, ZS))
glow = bpy.context.active_object
glow.data.shape = 'RECTANGLE'
glow.data.size = SW * 0.9
glow.data.size_y = SH * 0.9
glow.data.energy = 2.2
glow.data.color = (1.0, 0.62, 0.2)
glow.rotation_euler = (math.radians(-90), 0, 0)
glow.visible_camera = False

# ───────────── camera ─────────────

bpy.ops.object.camera_add(location=(0, -0.98, ZS), rotation=(math.radians(90), 0, 0))
cam = bpy.context.active_object
scene.camera = cam
cam.data.lens = 50
cam.data.sensor_width = 36
cam.data.shift_y = -0.075
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 0.98
cam.data.dof.aperture_fstop = 3.2

# ───────────── render ─────────────

scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU not available:', e)
scene.cycles.samples = SAMPLES
scene.cycles.adaptive_threshold = 0.015
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.render.resolution_x = int(3000 * SCALE)
scene.render.resolution_y = int(2000 * SCALE)
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
    try:
        scene.view_settings.look = look
        break
    except Exception:
        pass
scene.view_settings.exposure = 0.15
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_depth = '8'
scene.render.filepath = OUT

# where the screen lands in the picture
bpy.context.view_layer.update()
corners = [Vector((sx * SW / 2, 0.024, ZS + sz * SH / 2)) for sx in (-1, 1) for sz in (-1, 1)]
uv = [world_to_camera_view(scene, cam, c) for c in corners]
xs, ys = [p.x for p in uv], [1 - p.y for p in uv]
rect = {'left': min(xs), 'top': min(ys), 'right': max(xs), 'bottom': max(ys), 'radius': SR / SW, 'width': scene.render.resolution_x, 'height': scene.render.resolution_y}
with open(os.path.splitext(OUT)[0] + '.json', 'w') as f:
    json.dump(rect, f, indent=2)
print('SCREEN', rect)

bpy.ops.render.render(write_still=True)
