"""The photo behind the site: a beige office CRT on a desk, afternoon sun through blinds.

blender -b -P scene/room.py -- <out.png> [scale=1.0] [samples=128] [pass=main|glass]

pass=main   the room; also writes <out>.json with the screen's rectangle in image fractions
pass=glass  only the reflections on the screen glass, cropped to that rectangle;
            the site lays it over the desktop with a screen blend
"""
import bpy, bmesh, glob, json, math, os, random, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'room.png')
SCALE = float(argv[1]) if len(argv) > 1 else 1.0
SAMPLES = int(argv[2]) if len(argv) > 2 else 128
PASS = argv[3] if len(argv) > 3 else 'main'
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ───────────── helpers ─────────────


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def material(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0, bump=0.0, bump_scale=600.0, coat=0.0, spec=0.5, smudge=0.0):
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
    if smudge:
        # uneven roughness: handled, dusty, sun-faded in places
        n = nt.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = 9
        n.inputs['Detail'].default_value = 4
        r = nt.nodes.new('ShaderNodeMapRange')
        r.inputs['To Min'].default_value = rough - smudge
        r.inputs['To Max'].default_value = rough + smudge
        nt.links.new(n.outputs['Fac'], r.inputs['Value'])
        nt.links.new(r.outputs['Result'], p.inputs['Roughness'])
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
    return m


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        ob.modifiers.new('wn', 'WEIGHTED_NORMAL').keep_sharp = True
    except Exception:
        pass


def box(name, sx, sy, sz, loc, mat=None, bev=0.0, segs=3, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    ob = obj_from_bm(name, bm, mat)
    ob.location = loc
    ob.rotation_euler = rot
    if bev:
        bevel(ob, bev, segs)
        smooth(ob)
    return ob


def cyl(name, r1, r2, depth, loc, mat=None, segs=48, rot=(0, 0, 0), bev=0.0):
    ob = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(ob.data)
    bm.free()
    if mat:
        ob.data.materials.append(mat)
    ob.location = loc
    ob.rotation_euler = rot
    scene.collection.objects.link(ob)
    if bev:
        bevel(ob, bev, 2)
    smooth(ob)
    return ob


def rrect(w, h, r, n=8):
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def loft(name, rings, mat=None, cap=True):
    """rings: (y, w, h, r, z). A closed tube through rounded rectangles along +Y."""
    bm = bmesh.new()
    loops = [[bm.verts.new((x, y, z + zc)) for x, z in rrect(w, h, r)] for y, w, h, r, zc in rings]
    for a, b in zip(loops, loops[1:]):
        n = len(a)
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap:
        bm.faces.new(list(reversed(loops[0])))
        bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, mat)


def cut(ob, cutter, transfer=False):
    m = ob.modifiers.new('bool', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cutter
    m.solver = 'EXACT'
    if transfer:
        m.material_mode = 'TRANSFER'
    cutter.hide_render = True
    cutter.hide_viewport = True
    return m


def only_shadows(ob):
    ob.visible_camera = False
    ob.visible_glossy = False
    ob.visible_transmission = False


def textured(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    build(m.node_tree, m.node_tree.nodes['Principled BSDF'])
    return m


# ───────────── materials ─────────────

beige = material('beige', '#cdbd9c', rough=0.42, bump=0.05, bump_scale=1100, spec=0.42, smudge=0.12)
bevel_mat = material('inner-bevel', '#bfb3a0', rough=0.5, bump=0.04, bump_scale=1100, spec=0.4)
beige_dark = material('beige-dark', '#a29373', rough=0.5, spec=0.4)
mask_mat = material('mask', '#0e0e0f', rough=0.42, spec=0.45)
glass = material('glass', '#030405', rough=0.035, spec=1.0, emit='#0a0d12', emit_strength=0.8)
led = material('led', '#1e4a28', rough=0.15, spec=0.9, emit='#2a8a40', emit_strength=0.25)
dark_btn = material('button', '#3d3a35', rough=0.45)
wall_mat = material('wall', '#b6a184', rough=0.93, bump=0.25, bump_scale=120)
key_mat = material('keys', '#d6cab0', rough=0.48, bump=0.04, spec=0.4, smudge=0.08)
mug_mat = material('mug', '#e8decd', rough=0.16, coat=0.6)
pot_mat = material('pot', '#a9603d', rough=0.78, bump=0.15, bump_scale=200)
leaf_mat = material('leaf', '#2f5a2c', rough=0.42, spec=0.5)
paper = material('paper', '#e9dfc9', rough=0.9, bump=0.05, bump_scale=300)
frame_wood = material('frame-wood', '#6b4a2e', rough=0.5)
shelf_wood = material('shelf-wood', '#5b3b22', rough=0.55, bump=0.1, bump_scale=60)
metal_dark = material('metal', '#2a2a2c', rough=0.35, metal=0.8)
book_mats = [material(f'book{i}', c, rough=0.6) for i, c in enumerate(['#7a2f22', '#2c4a63', '#c9a75a', '#3c5a3a', '#8a7a62', '#5a2f45', '#d2c4a6', '#2b2b2b'])]
pencil_mats = [material(f'pencil{i}', c, rough=0.45, coat=0.3) for i, c in enumerate(['#d23c2c', '#e3b23c', '#2f6db3', '#3a8a4c', '#222222', '#e0782f'])]
disk_mats = [material('disk-a', '#1f2124', rough=0.35), material('disk-b', '#2a3f73', rough=0.35), material('disk-c', '#8a2b26', rough=0.35)]


def wood_tree(nt, p):
    p.inputs['Roughness'].default_value = 0.36
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.25, 7.0, 1.0)
    g = nt.nodes.new('ShaderNodeTexNoise')
    g.inputs['Scale'].default_value = 5.0
    g.inputs['Detail'].default_value = 12
    g.inputs['Roughness'].default_value = 0.62
    g.inputs['Distortion'].default_value = 1.8
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = 0.3
    r.color_ramp.elements[0].color = srgb('#3a2213')
    r.color_ramp.elements[1].position = 0.72
    r.color_ramp.elements[1].color = srgb('#8c5c36')
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], g.inputs['Vector'])
    nt.links.new(g.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = 0.08
    nt.links.new(g.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])


wood = textured('wood', wood_tree)


def poster_tree(nt, p):
    p.inputs['Roughness'].default_value = 0.8
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.interpolation = 'CONSTANT'
    e = r.color_ramp.elements
    e[0].color = srgb('#1d4a52')
    e[1].position = 0.5
    e[1].color = srgb('#e9a23b')
    x = e.new(0.66)
    x.color = srgb('#d9562e')
    x = e.new(0.8)
    x.color = srgb('#efe1c2')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])


poster = textured('poster', poster_tree)


def sketch_tree(nt, p):
    # an old map / drawing: warm paper with dark scribbles
    p.inputs['Roughness'].default_value = 0.9
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 7
    n.inputs['Detail'].default_value = 14
    n.inputs['Distortion'].default_value = 3
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = 0.46
    r.color_ramp.elements[0].color = srgb('#5a4632')
    r.color_ramp.elements[1].position = 0.5
    r.color_ramp.elements[1].color = srgb('#e2d2b0')
    nt.links.new(tc.outputs['Generated'], n.inputs['Vector'])
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])


sketch = textured('sketch', sketch_tree)


def blinds_light_tree(nt, p):
    # a bright window with blinds, seen only in reflections
    p.inputs['Base Color'].default_value = (0, 0, 0, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'Z'
    w.inputs['Scale'].default_value = 7
    w.inputs['Distortion'].default_value = 0
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = 0.5
    r.color_ramp.elements[0].color = (0, 0, 0, 1)
    r.color_ramp.elements[1].position = 0.56
    r.color_ramp.elements[1].color = srgb('#fff1dc')
    nt.links.new(tc.outputs['Generated'], w.inputs['Vector'])
    nt.links.new(w.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value = 7.0


blinds_light = textured('blinds-light', blinds_light_tree)

# ───────────── the monitor ─────────────

ZB = 0.075                        # bottom of the case above the desk
SW, SH, SR = 0.330, 0.247, 0.018  # visible glass: width, height, corner radius
SIDE, TOP, CHIN = 0.046, 0.048, 0.108
FW, FH = SW + 2 * SIDE, SH + TOP + CHIN
ZC = ZB + FH / 2
ZS = ZB + CHIN + SH / 2

shell = loft('shell', [(0.0, FW, FH, 0.012, ZC), (0.08, FW, FH, 0.012, ZC)], beige)
opening = loft('opening', [(-0.01, SW + 0.06, SH + 0.06, 0.016, ZS), (0.0, SW + 0.05, SH + 0.05, 0.016, ZS), (0.021, SW + 0.016, SH + 0.016, 0.02, ZS), (0.12, SW + 0.016, SH + 0.016, 0.02, ZS)], bevel_mat)
cut(shell, opening, transfer=True)
groove = box('groove', FW + 0.02, 0.006, 0.0022, (0, -0.0015, ZB + 0.042))
cut(shell, groove)
bevel(shell, 0.004, 3, 35)
smooth(shell)

mask = loft('mask', [(0.019, SW + 0.04, SH + 0.04, 0.02, ZS), (0.026, SW + 0.04, SH + 0.04, 0.02, ZS)], mask_mat)
hole = loft('hole', [(0.0, SW, SH, SR, ZS), (0.05, SW, SH, SR, ZS)])
cut(mask, hole)

# glass: a spherical cap that bulges about 12 mm at the centre
bm = bmesh.new()
nx, nz = 64, 48
gw, gh = SW + 0.012, SH + 0.012
R = 1.75
edge = math.sqrt(R * R - (gw / 2) ** 2 - (gh / 2) ** 2)
grid = [[bm.verts.new((gw * (i / nx - 0.5), 0.0, gh * (j / nz - 0.5))) for i in range(nx + 1)] for j in range(nz + 1)]
for j in range(nz):
    for i in range(nx):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
for v in bm.verts:
    v.co.y = 0.034 - (math.sqrt(R * R - v.co.x ** 2 - v.co.z ** 2) - edge)
    v.co.z += ZS
glass_ob = obj_from_bm('glass', bm, glass)
smooth(glass_ob)

body = loft('body', [(0.075, FW - 0.008, FH - 0.008, 0.014, ZC), (0.13, FW - 0.02, FH - 0.02, 0.03, ZC + 0.004), (0.43, 0.29, 0.25, 0.05, ZC + 0.03)], beige)
bevel(body, 0.008, 3, 30)
smooth(body)

# chin: logo above the seam; labelled buttons and the power led on the lower panel


ink = material('ink', '#6f634d', rough=0.6)


def printed(body, x, z, size=0.0039, align='CENTER', mat=None, extrude=0.00012, spacing=1.25):
    bpy.ops.object.text_add(location=(x, -0.0003, z), rotation=(math.radians(90), 0, 0))
    t = bpy.context.active_object
    t.data.body = body
    t.data.size = size
    t.data.extrude = extrude
    t.data.align_x = align
    t.data.space_character = spacing
    t.data.materials.append(mat or ink)
    return t


for i, c in enumerate(['#2f8f83', '#e9b23b', '#e2742f', '#c93f2f']):
    box(f'logo{i}', 0.013, 0.0012, 0.0028, (-FW / 2 + 0.03, -0.0004, ZB + 0.0805 - i * 0.0031), material(f'logo{i}', c, rough=0.35, coat=0.6))
printed('RL·1', -FW / 2 + 0.041, ZB + 0.0705, size=0.015, align='LEFT', extrude=0.0006, spacing=1.2)
printed('COLOR MONITOR', FW / 2 - 0.03, ZB + 0.0715, size=0.0058, align='RIGHT', extrude=0.0002, spacing=1.5)

BUTTONS = ['BRIGHT', 'CONTRAST', 'COLOR', 'DEGAUSS']
knobs = []
for i, name in enumerate(BUTTONS):
    x = -FW / 2 + 0.05 + i * 0.026
    k = cyl(f'knob{i}', 0.0062, 0.0058, 0.006, (x, -0.0022, ZB + 0.025), beige_dark, segs=32, rot=(math.radians(90), 0, 0), bev=0.0012)
    cyl(f'knob-ring{i}', 0.0074, 0.0074, 0.001, (x, -0.0002, ZB + 0.025), mask_mat, segs=32, rot=(math.radians(90), 0, 0))
    printed(name, x, ZB + 0.0095)
    knobs.append(k)
power = box('power', 0.032, 0.008, 0.012, (FW / 2 - 0.074, -0.0022, ZB + 0.025), dark_btn, 0.0028)
printed('POWER', FW / 2 - 0.074, ZB + 0.0095)
led_ob = cyl('led', 0.0026, 0.0026, 0.004, (FW / 2 - 0.034, -0.0014, ZB + 0.025), led, segs=24, rot=(math.radians(90), 0, 0))
cyl('led-ring', 0.0036, 0.0036, 0.001, (FW / 2 - 0.034, -0.0002, ZB + 0.025), mask_mat, segs=24, rot=(math.radians(90), 0, 0))

# tilt-swivel stand
box('neck', 0.17, 0.15, 0.06, (0, 0.2, 0.05), beige, 0.012)
base = cyl('base', 0.165, 0.15, 0.024, (0, 0.2, 0.012), beige, segs=64, bev=0.006)
base.scale = (1.0, 0.85, 1.0)

# ───────────── the room: CC0 models and textures from Poly Haven (scene/fetch_assets.py) ─────────────

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')

clear_glass = bpy.data.materials.new('clear-glass')
clear_glass.use_nodes = True
_g = clear_glass.node_tree.nodes['Principled BSDF']
_g.inputs['Base Color'].default_value = (1, 1, 1, 1)
_g.inputs['Roughness'].default_value = 0.04
_g.inputs['Transmission Weight'].default_value = 1.0
_g.inputs['IOR'].default_value = 1.45


def load(asset, only=None):
    """Imports a Poly Haven asset and returns its mesh objects, keeping only names that contain one of `only`."""
    folder = os.path.join(ASSETS, asset)
    before = set(bpy.data.objects)
    gltf = glob.glob(folder + '/*.gltf')
    if gltf:
        bpy.ops.import_scene.gltf(filepath=gltf[0])
    else:
        with bpy.data.libraries.load(glob.glob(folder + '/*.blend')[0]) as (src, dst):
            dst.objects = [n for n in src.objects if not only or any(k in n for k in only)]
        for o in dst.objects:
            if o:
                scene.collection.objects.link(o)
        for img in bpy.data.images:
            if img.filepath.startswith('//'):
                img.filepath = os.path.join(folder, img.filepath[2:])
    new = [o for o in bpy.data.objects if o not in before]
    if only:
        for o in list(new):
            if o.type == 'MESH' and not any(k in o.name for k in only):
                bpy.data.objects.remove(o, do_unlink=True)
        new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        mw = o.matrix_world.copy()
        o.parent = None
        o.rotation_mode = 'XYZ'   # glTF brings quaternions; the placement below speaks Euler
        o.matrix_world = mw
        if o.type == 'MESH':
            for i, m in enumerate(o.data.materials):
                if m and 'glass' in m.name.lower():
                    o.data.materials[i] = clear_glass
    return [o for o in new if o.type == 'MESH']


def group(objs, loc, rz=0.0, scale=1.0, rx=0.0, ry=0.0):
    root = bpy.data.objects.new('group', None)
    scene.collection.objects.link(root)
    for o in objs:
        o.parent = root
    root.location = loc
    root.rotation_euler = (rx, ry, rz)
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    return root


def pbr(asset, size=1.0, tint=None):
    folder = os.path.join(ASSETS, asset)
    m = bpy.data.materials.new(asset)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / size, 1 / size, 1 / size)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    def tex(name, color=False):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(os.path.join(folder, name))
        if not color:
            t.image.colorspace_settings.name = 'Non-Color'
        t.projection = 'BOX'
        t.projection_blend = 0.25
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
        return t

    d = tex('Diffuse.jpg', True)
    if tint:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = srgb(tint)
        nt.links.new(d.outputs['Color'], mix.inputs[6])
        nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    else:
        nt.links.new(d.outputs['Color'], p.inputs['Base Color'])
    nt.links.new(tex('Rough.jpg').outputs['Color'], p.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tex('nor_gl.jpg').outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


walnut = pbr('american_walnut_veneer', 0.9, tint='#d8ad84')
plaster = pbr('beige_wall_001', 1.2, tint='#e9d9bf')
linen = pbr('rough_linen', 0.35, tint='#5d6b5a')

box('desk', 2.8, 1.5, 0.045, (0, 0.1, -0.0225), walnut, 0.004, 2)
box('wall', 4.0, 0.05, 3.0, (0, 0.8, 1.2), plaster)
box('skirting', 4.0, 0.02, 0.09, (0, 0.77, 0.045), material('skirting', '#d8ccb5', rough=0.6))
box('desk-mat', 0.62, 0.3, 0.003, (0.0, -0.25, 0.0015), linen, 0.002)

# keyboard on the mat
kb = box('keyboard', 0.46, 0.165, 0.026, (0.0, -0.27, 0.016), beige, 0.006)
kb.rotation_euler = (math.radians(-4), 0, 0)
for r in range(5):
    cols = 15 if r < 4 else 9
    for c in range(cols):
        w = 0.0168 if not (r == 4 and c == 4) else 0.1
        x = -0.207 + c * 0.0196 + (0.009 if r % 2 else 0)
        if r == 4:
            x = -0.15 + c * 0.0196 + (0.05 if c > 4 else 0)
        box(f'key{r}-{c}', w, 0.0168, 0.012, (x, -0.322 + r * 0.0206, 0.034 + r * 0.0014), key_mat, 0.0032, 3)

# shelf with an encyclopedia and a camera, upper left
box('shelf', 0.64, 0.2, 0.024, (-0.52, 0.69, 0.84), material('shelf-wood', '#5b3b22', rough=0.55, bump=0.1, bump_scale=60), 0.003)
for x in (-0.72, -0.32):
    box('bracket', 0.018, 0.15, 0.1, (x, 0.72, 0.78), metal_dark)
group(load('book_encyclopedia_set_01'), (-0.82, 0.7, 0.852), scale=0.95)
group(load('Camera_01'), (-0.33, 0.67, 0.852), rz=math.radians(-160))

# frames on the wall
box('poster-frame', 0.27, 0.02, 0.35, (-0.41, 0.785, 0.5), frame_wood, 0.003)
box('poster', 0.23, 0.004, 0.31, (-0.41, 0.774, 0.5), poster)
group(load('hanging_picture_frame_02'), (0.41, 0.79, 0.6), scale=0.8)
group(load('wall_clock'), (0.17, 0.795, 0.66), scale=0.8)

# desk lamp, clamped at the back left, its head over the pencils
lamp_root = group(load('desk_lamp_arm_01'), (-0.41, 0.36, 0.0), rz=math.radians(-143), scale=0.92)
LAMP_HEAD = lamp_root.matrix_world @ Vector((-0.02, 0.24, 0.585))
for o in lamp_root.children:
    for m in o.data.materials:
        if m and 'light' in m.name:
            pp = m.node_tree.nodes.get('Principled BSDF')
            if pp:
                pp.inputs['Emission Color'].default_value = (1.0, 0.72, 0.42, 1)
                pp.inputs['Emission Strength'].default_value = 25

# pencil cup with pencils standing in it, front left
parts = {o.name: o for o in load('stationery_supplies')}
cup = parts.pop('stationery_supplies_pencilcup')
cup.location = (-0.285, -0.07, 0.0 - (-0.074) - 0.032 + 0.0)  # its bottom on the desk
bpy.context.view_layer.update()
cup.location.z += -min((cup.matrix_world @ Vector(c)).z for c in cup.bound_box)
eraser = parts.pop('stationery_supplies_eraser')
eraser.location = (-0.215, -0.15, 0.005)
eraser.rotation_euler = (0, 0, math.radians(25))
for i, (name, o) in enumerate(sorted(parts.items())):
    a = i / max(1, len(parts)) * math.tau
    o.rotation_euler = (random.uniform(-0.2, 0.2), math.radians(90) + random.uniform(-0.15, 0.15), a)
    o.location = (-0.285 + 0.016 * math.cos(a), -0.07 + 0.016 * math.sin(a), 0.07 + o.dimensions.x * 0.45)

# right side: alarm clock, walkman with a cassette, books with a succulent, a big plant
clock_root = group(load('alarm_clock_01'), (0.272, -0.02, 0.001), rz=math.radians(-20), scale=0.95)
walk = load('portable_cassette_player')
group(walk, (0.29, -0.24, 0.024), rx=math.radians(-90), rz=math.radians(14))
books = load('decorative_book_set_01', only=['book_softcover_01_cover14', 'book_softcover_01_cover27', 'book_softcover_01_cover33'])
zb = 0.0
for i, o in enumerate(books):
    o.rotation_euler = (0, math.radians(90), math.radians(8 - 9 * i))
    bpy.context.view_layer.update()
    th = o.dimensions.x
    o.location = (0.335 + 0.008 * i, 0.27, 0)
    bpy.context.view_layer.update()
    lo = min((o.matrix_world @ Vector(c)).z for c in o.bound_box)
    o.location.z += zb - lo
    bpy.context.view_layer.update()
    zb = max((o.matrix_world @ Vector(c)).z for c in o.bound_box)
group(load('potted_plant_04'), (0.335, 0.27, zb), scale=0.85, rz=math.radians(30))
group(load('potted_plant_02'), (0.43, 0.5, 0.0), scale=0.52, rz=math.radians(200))

# the beige tower on the right: drive bays, a floppy drive, power switch, vents
def tower(x, y, w=0.2, d=0.44, h=0.42):
    fy = y - d / 2
    box('tower', w, d, h, (x, y, h / 2), beige, 0.006)
    for i in range(2):   # 5.25" bays
        zc = h - 0.05 - i * 0.05
        box(f'bay{i}', w - 0.03, 0.006, 0.042, (x, fy - 0.001, zc), beige_dark, 0.002)
        box(f'bay-line{i}', w - 0.06, 0.003, 0.002, (x, fy - 0.004, zc + 0.004), mask_mat)
        box(f'bay-btn{i}', 0.014, 0.006, 0.007, (x + w / 2 - 0.035, fy - 0.004, zc - 0.012), dark_btn, 0.0015)
    zf = h - 0.16   # 3.5" floppy
    box('fdd', 0.11, 0.006, 0.028, (x - 0.02, fy - 0.001, zf), beige_dark, 0.002)
    box('fdd-slot', 0.09, 0.004, 0.0035, (x - 0.02, fy - 0.004, zf + 0.004), mask_mat)
    box('fdd-btn', 0.012, 0.006, 0.006, (x + 0.025, fy - 0.004, zf - 0.008), dark_btn, 0.0015)
    cyl('fdd-led', 0.0018, 0.0018, 0.003, (x - 0.065, fy - 0.004, zf - 0.008), material('fdd-led', '#ffb33d', emit='#ffb33d', emit_strength=6), segs=16, rot=(math.radians(90), 0, 0))
    box('tower-power', 0.03, 0.008, 0.03, (x + 0.05, fy - 0.003, h - 0.25), dark_btn, 0.003)
    cyl('tower-led', 0.0022, 0.0022, 0.003, (x - 0.05, fy - 0.004, h - 0.25), material('tower-led-on', '#3cff6a', emit='#3cff6a', emit_strength=8), segs=16, rot=(math.radians(90), 0, 0))
    for i in range(9):
        box(f'tower-vent{i}', w - 0.06, 0.004, 0.005, (x, fy - 0.001, 0.035 + i * 0.012), mask_mat)
    printed('RL\u00b7PC 486', x, h - 0.205, size=0.007, extrude=0.0003)


tower(0.64, 0.34)
group(load('boombox'), (-0.74, 0.42, 0.0), rz=math.radians(14), scale=0.55)
group(load('hanging_picture_frame_01'), (0.8, 0.79, 0.66), scale=0.42)

# a rubber duck on top of the monitor, a sticky note on its bezel
duck_root = group(load('rubber_duck_toy'), (0.12, 0.05, ZB + FH), rz=math.radians(-25), scale=0.26)
note = [o for o in load('office_notepads') if o.name == 'office_notepads_sticky_sheet']
for o in bpy.data.objects:
    if o.name.startswith('office_notepads') and o not in note:
        bpy.data.objects.remove(o, do_unlink=True)
note = note[0]
note.location = (FW / 2 - 0.004, -0.0012, ZS + SH / 2 - 0.02)
note.rotation_euler = (math.radians(90), math.radians(-7), 0)

# ───────────── light ─────────────

world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#8a6f55')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.1

sun_dir = Vector((-0.62, 0.62, -0.46)).normalized()
bpy.ops.object.light_add(type='SUN')
sun = bpy.context.active_object
sun.data.energy = 6.5
sun.data.color = (1.0, 0.77, 0.53)
sun.data.angle = math.radians(0.8)
sun.rotation_euler = sun_dir.to_track_quat('-Z', 'Y').to_euler()

WX = 0.98
rw = box('right-wall', 0.04, 3.0, 3.0, (WX, 0.0, 1.2))
cut(rw, box('window', 0.2, 1.35, 1.1, (WX, -0.425, 0.85)))
only_shadows(rw)
for i in range(46):
    s = box(f'slat{i}', 0.017, 1.45, 0.0018, (WX - 0.01, -0.425, 0.31 + i * 0.024), rot=(0, math.radians(30), 0))
    only_shadows(s)

# the window behind the viewer's right shoulder, only ever seen in the glass
win = box('window-reflection', 0.6, 0.004, 0.9, (0.62, -1.65, ZS + 0.12), blinds_light)
win.visible_camera = False
win.visible_diffuse = False
win.visible_transmission = False
win.visible_volume_scatter = False

bpy.ops.object.light_add(type='AREA', location=(-0.9, -1.1, 0.9))
fill = bpy.context.active_object
fill.data.energy = 14
fill.data.size = 1.6
fill.data.color = (1.0, 0.88, 0.76)
fill.rotation_euler = (Vector((0.2, 0.3, 0.25)) - fill.location).to_track_quat('-Z', 'Y').to_euler()
fill.visible_glossy = False

bpy.ops.object.light_add(type='SPOT', location=LAMP_HEAD)
lamp = bpy.context.active_object
lamp.data.energy = 55
lamp.data.spot_size = math.radians(80)
lamp.data.spot_blend = 0.7
lamp.data.shadow_soft_size = 0.02
lamp.data.color = (1.0, 0.68, 0.4)
lamp.rotation_euler = (Vector((-0.26, -0.1, 0.0)) - LAMP_HEAD).to_track_quat('-Z', 'Y').to_euler()
lamp.visible_glossy = False

# a little dust in the air, so the sun draws its stripes through it
haze = box('haze', 2.4, 2.6, 1.8, (0, -0.2, 0.9))
hm = bpy.data.materials.new('haze')
hm.use_nodes = True
hn = hm.node_tree
hn.nodes.remove(hn.nodes['Principled BSDF'])
vol = hn.nodes.new('ShaderNodeVolumePrincipled')
vol.inputs['Density'].default_value = 0.012
vol.inputs['Anisotropy'].default_value = 0.45
vol.inputs['Color'].default_value = (1.0, 0.92, 0.82, 1)
hn.links.new(vol.outputs['Volume'], hn.nodes['Material Output'].inputs['Volume'])
haze.data.materials.append(hm)
haze.visible_glossy = False

# the screen's own amber light on the bezel slope, the keyboard and the desk
bpy.ops.object.light_add(type='AREA', location=(0, 0.012, ZS))
glow = bpy.context.active_object
glow.data.shape = 'RECTANGLE'
glow.data.size = SW * 0.95
glow.data.size_y = SH * 0.95
glow.data.energy = 0.0
glow.data.color = (1.0, 0.6, 0.2)
glow.rotation_euler = (math.radians(-90), 0, 0)
glow.visible_camera = False
glow.visible_glossy = False

# ───────────── camera ─────────────

bpy.ops.object.camera_add(location=(0, -1.06, ZS), rotation=(math.radians(90), 0, 0))
cam = bpy.context.active_object
scene.camera = cam
cam.data.lens = 45
cam.data.sensor_fit = 'VERTICAL'
cam.data.sensor_height = 24
cam.data.shift_y = -0.09   # with a vertical sensor fit the shift is a share of the height: same framing as -0.06 at 3:2
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 1.08
cam.data.dof.aperture_fstop = 2.2
cam.data.dof.aperture_blades = 7

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
scene.cycles.adaptive_threshold = 0.012
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.render.resolution_x = int(4400 * SCALE)
scene.render.resolution_y = int(2200 * SCALE)
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
    try:
        scene.view_settings.look = look
        break
    except Exception:
        pass
scene.view_settings.exposure = 0.2
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.color_mode = 'RGB'
scene.render.filepath = OUT

bpy.context.view_layer.update()
corners = [Vector((sx * SW / 2, 0.026, ZS + sz * SH / 2)) for sx in (-1, 1) for sz in (-1, 1)]
uv = [world_to_camera_view(scene, cam, c) for c in corners]
xs, ys = [p.x for p in uv], [1 - p.y for p in uv]
rect = {'left': min(xs), 'top': min(ys), 'right': max(xs), 'bottom': max(ys), 'radius': SR / SW}



def project(points):
    uv = [world_to_camera_view(scene, cam, p) for p in points]
    return [round(min(p.x for p in uv), 5), round(1 - max(p.y for p in uv), 5), round(max(p.x for p in uv), 5), round(1 - min(p.y for p in uv), 5)]


def rect_of(objs):
    pts = []
    for o in objs:
        for c in (o.children if o.type == 'EMPTY' else [o]):
            if c.type in ('MESH', 'FONT'):
                pts += [c.matrix_world @ Vector(v) for v in c.bound_box]
    return project(pts)


hot = {
    'monitor': rect_of([shell, base]),
    'power': rect_of([power]),
    'led': rect_of([led_ob]),
    'buttons': [rect_of([k]) for k in knobs],
    'duck': rect_of([duck_root]),
    'note': rect_of([note]),
    'clock': rect_of([clock_root]),
    'lamp': project([LAMP_HEAD + Vector((dx, 0, dz)) for dx in (-0.08, 0.08) for dz in (-0.03, 0.09)]),
}
LAMP_SPLIT = 0.52   # the lamp-off pass covers the picture from its left edge to here

if PASS == 'lampoff':
    lamp.data.energy = 0.0
    for o in lamp_root.children:
        for m in o.data.materials:
            if m and 'light' in m.name:
                pp = m.node_tree.nodes.get('Principled BSDF')
                if pp:
                    pp.inputs['Emission Strength'].default_value = 0.0
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x, scene.render.border_max_x = 0.0, LAMP_SPLIT
    scene.render.border_min_y, scene.render.border_max_y = 0.0, 1.0
elif PASS == 'glass':
    # only the glass: everything else is cut out, but still shows up in the reflections
    for ob in scene.objects:
        if ob.name == 'haze':
            ob.hide_render = True
        elif ob.type in ('MESH', 'FONT') and ob is not glass_ob:
            ob.is_holdout = True
    p = glass.node_tree.nodes['Principled BSDF']
    p.inputs['Emission Strength'].default_value = 0.0
    p.inputs['Base Color'].default_value = (0, 0, 0, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x = rect['left']
    scene.render.border_max_x = rect['right']
    scene.render.border_min_y = 1 - rect['bottom']
    scene.render.border_max_y = 1 - rect['top']
    scene.view_settings.look = 'None'
else:
    with open(os.path.splitext(OUT)[0] + '.json', 'w') as f:
        json.dump({**rect, 'aspect': scene.render.resolution_x / scene.render.resolution_y, 'lampSplit': LAMP_SPLIT, 'hot': hot}, f, indent=2)
print('SCREEN', rect)

if PASS != 'map':   # pass=map only rewrites the json
    bpy.ops.render.render(write_still=True)
