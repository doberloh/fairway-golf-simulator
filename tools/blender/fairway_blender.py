# THE SHARED HALF OF EVERY BLENDER-BUILT MODEL PACK (docs/BLENDER_ASSETS.md).
#
# Blender runs these scripts headless, started by tools/blender/run.mjs:
#   blender -b --factory-startup --python tools/blender/<pack>.py -- <out dir> [--render <png>]
# Each pack script builds its models out of the helpers here and calls
# `export_pack`, which writes one .glb per model into vendor/blender-<pack>/
# and, when asked, a contact sheet of the whole pack for review.
#
# WHAT THE GAME KEEPS FROM A MODEL is its triangles, its normals and the NAME
# of each material -- nothing else (tools/build-meshes.mjs). The name decides
# the role the game paints (tools/mesh-read.mjs ROLE_OF): `leaves` is leaf,
# `bark` is bark, `stone`, `dirt`, and anything unmatched is accent. So the
# materials here are named for their role and nothing more, and the colours
# set on them are for the contact sheet only; the game ignores them and paints
# each role from the species and the biome.
#
# Every model is built at its real size in metres with Z up; the exporter turns
# it Y up and build-meshes rescales it to unit height. Everything random is
# drawn from `random.Random(seed)`, so a pack rebuilds byte-identical.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix

# Material name for each role, as ROLE_OF reads it.
ROLE_MATERIAL = {'leaf': 'leaves', 'bark': 'bark', 'accent': 'accent', 'stone': 'stone', 'dirt': 'dirt'}


def args():
    """The arguments after `--`: the output folder, and an optional --render path."""
    rest = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = rest[0] if rest else os.getcwd()
    render = rest[rest.index('--render') + 1] if '--render' in rest else None
    return out, render


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


class Mesh:
    """Faces gathered with a role each, turned into one object at the end.

    One object per model, one material slot per role: the exporter then writes
    one primitive per role, which is exactly what build-meshes reads."""

    def __init__(self):
        self.bm = bmesh.new()
        self.roles = []

    def slot(self, role):
        if role not in self.roles:
            self.roles.append(role)
        return self.roles.index(role)

    def face(self, points, role, smooth=False):
        verts = [self.bm.verts.new(p) for p in points]
        f = self.bm.faces.new(verts)
        f.material_index = self.slot(role)
        f.smooth = smooth
        return f

    def ring_strip(self, rings, role, smooth=True, cap_start=False, cap_end=False):
        """Quads between consecutive rings of equal length (closed loops)."""
        made = [[self.bm.verts.new(p) for p in ring] for ring in rings]
        idx = self.slot(role)
        n = len(rings[0])
        for a, b in zip(made, made[1:]):
            for i in range(n):
                f = self.bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
                f.material_index = idx
                f.smooth = smooth
        for cap, ring in ((cap_start, made[0][::-1]), (cap_end, made[-1])):
            if cap:
                f = self.bm.faces.new(ring)
                f.material_index = idx
                f.smooth = False
        return made

    def add_bmesh(self, other, matrix, role, smooth=True):
        """Copy a bmesh (an icosphere lump, say) in under a transform."""
        idx = self.slot(role)
        lookup = {}
        for v in other.verts:
            lookup[v] = self.bm.verts.new(matrix @ v.co)
        for f in other.faces:
            nf = self.bm.faces.new([lookup[v] for v in f.verts])
            nf.material_index = idx
            nf.smooth = smooth

    def finish(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        for role in self.roles:
            me.materials.append(role_material(role))
        return obj


PREVIEW = {'leaf': (0.33, 0.52, 0.22), 'bark': (0.42, 0.36, 0.30), 'accent': (0.78, 0.70, 0.48),
           'stone': (0.55, 0.55, 0.52), 'dirt': (0.55, 0.47, 0.33)}


def role_material(role, preview=None):
    name = ROLE_MATERIAL[role]
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        rgb = preview or PREVIEW[role]
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (*rgb, 1)
            bsdf.inputs['Roughness'].default_value = 0.85
        m.diffuse_color = (*rgb, 1)
    return m


def tint(role, rgb):
    """Change a role's contact-sheet colour (the game never sees it)."""
    m = role_material(role)
    if m.node_tree and m.node_tree.nodes.get('Principled BSDF'):
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*rgb, 1)
    m.diffuse_color = (*rgb, 1)


# ---------------------------------------------------------------- shapes

def frame_along(direction):
    """Two unit vectors perpendicular to `direction` and to each other."""
    d = direction.normalized()
    helper = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(helper).normalized()
    return u, d.cross(u).normalized()


def tube(mesh, points, radii, sides, role, rng=None, wobble=0.0, smooth=True, cap_end=True):
    """A limb or trunk: rings round a polyline, each ring its own radius.

    `wobble` roughens each ring a little so a trunk is not a turned post."""
    rings = []
    prev_u = None
    for i, (p, r) in enumerate(zip(points, radii)):
        a = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
        u, v = frame_along(a)
        # Keep the ring's seam from twisting between neighbours.
        if prev_u is not None and u.dot(prev_u) < 0:
            u, v = -u, -v
        prev_u = u
        ring = []
        for k in range(sides):
            t = k / sides * math.tau
            rr = r * (1 + (rng.uniform(-wobble, wobble) if rng and wobble else 0))
            ring.append(p + (u * math.cos(t) + v * math.sin(t)) * rr)
        rings.append(ring)
    return mesh.ring_strip(rings, role, smooth=smooth, cap_end=cap_end)


def lump(mesh, center, size, role, rng, subdiv=1, jitter=0.18, squash=1.0, smooth=True):
    """A foliage clump: a jittered icosphere, `size` = (x, y, z) radii."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        n = v.co.normalized()
        v.co = n * (1 + rng.uniform(-jitter, jitter))
    sx, sy, sz = size
    mat = Matrix.Translation(center) @ Matrix.Diagonal((sx, sy, sz * squash, 1))
    mesh.add_bmesh(bm, mat, role, smooth=smooth)
    bm.free()


def blade(mesh, root, heading, lean, height, width, rng, segments=3, tip_from=0.7,
          low='leaf', tip='accent', droop=0.0):
    """One grass blade: a tapering strip that rises and bows outward.

    The part above `tip_from` of its length is a second role, so a blade can be
    green below and straw at the tip -- American beachgrass's look in summer."""
    out = Vector((math.cos(heading), math.sin(heading), 0))
    side = Vector((-out.y, out.x, 0))
    pts = []
    for s in range(segments + 1):
        t = s / segments
        # Rises, curves outward with t squared, and droops at the end.
        pos = root + out * (lean * height * t * t) + Vector((0, 0, height * (t - droop * t ** 3)))
        w = width * (1 - t) ** 0.9
        pts.append((pos, w, t))
    for (a, wa, ta), (b, wb, tb) in zip(pts, pts[1:]):
        role = tip if tb > tip_from + 1e-6 and ta >= tip_from - 1e-6 else low
        if tb >= 1 - 1e-6:
            mesh.face([a - side * wa, a + side * wa, b], role)
        else:
            mesh.face([a - side * wa, a + side * wa, b + side * wb, b - side * wb], role)


def sweep_points(start, end, bend, steps, rng=None, kink=0.0):
    """Points from start to end, bowed by `bend` (a vector at mid-span)."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        p = start.lerp(end, t) + bend * (4 * t * (1 - t))
        if rng and kink and 0 < i < steps:
            p += Vector((rng.uniform(-kink, kink), rng.uniform(-kink, kink), rng.uniform(-kink, kink) * 0.5))
        pts.append(p)
    return pts


# ---------------------------------------------------------------- output

def export_pack(models, out_dir, render=None, figure=1.8):
    """Write each (name, builder) as <out_dir>/<name>.glb; optionally a sheet.

    `builder(mesh, rng)` fills a Mesh; the seed is derived from the name, so
    adding a model never changes another one."""
    os.makedirs(out_dir, exist_ok=True)
    built = []
    for name, builder in models:
        reset()
        mesh = Mesh()
        builder(mesh, random.Random(name))
        obj = mesh.finish(name)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        path = os.path.join(out_dir, name + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                                  export_yup=True, export_apply=True, export_texcoords=False,
                                  export_normals=True, export_materials='EXPORT')
        stats = (len(obj.data.vertices), len(obj.data.polygons))
        print(f'BUILT {name}: {stats[0]} vertices, {stats[1]} faces, roles {mesh.roles}')
        built.append((name, builder))
    if render:
        contact_sheet(built, render, figure)


TILE, COLUMNS = 560, 4


def contact_sheet(models, path, figure):
    """One tile per model, each framed to its own size, beside a figure as
    tall as a person -- a grass patch and a 25 m tree on one shared row made
    the small things invisible. Tiles in pack order, names written in."""
    import numpy as np
    tiles = []
    for name, builder in models:
        tiles.append(render_tile(name, builder, figure, path + '.tile.png'))
    rows = math.ceil(len(tiles) / COLUMNS)
    sheet = np.ones((rows * TILE, COLUMNS * TILE, 4), dtype=np.float32)
    for n, px in enumerate(tiles):
        r, c = divmod(n, COLUMNS)
        # Image rows run bottom-up in Blender, so row 0 of the sheet is its foot.
        y0 = (rows - 1 - r) * TILE
        sheet[y0:y0 + TILE, c * TILE:(c + 1) * TILE] = px
    img = bpy.data.images.new('sheet', COLUMNS * TILE, rows * TILE, alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    os.remove(path + '.tile.png')
    print(f'SHEET {path}')


def render_tile(name, builder, figure, scratch):
    import numpy as np
    reset()
    mesh = Mesh()
    builder(mesh, random.Random(name))
    obj = mesh.finish(name)
    vs = [v.co for v in obj.data.vertices]
    x0, x1 = min(v.x for v in vs), max(v.x for v in vs)
    y0, y1 = min(v.y for v in vs), max(v.y for v in vs)
    top = max(v.z for v in vs)
    size = max(x1 - x0, y1 - y0, top, figure) * 1.3
    # The figure: a post as tall as a person, for scale.
    bpy.ops.mesh.primitive_cylinder_add(radius=figure * 0.12, depth=figure,
                                        location=(x1 + size * 0.06, (y0 + y1) / 2, figure / 2))
    bpy.context.object.data.materials.append(role_material('stone', (0.85, 0.3, 0.25)))
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=((x0 + x1) / 2, (y0 + y1) / 2, 0))
    gmat = bpy.data.materials.new('ground')
    gmat.use_nodes = True
    gmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.86, 0.80, 0.64, 1)
    bpy.context.object.data.materials.append(gmat)
    scene = bpy.context.scene
    elev = math.radians(18)
    look = Vector((0, math.cos(elev), -math.sin(elev)))
    up = Vector((0, math.sin(elev), math.cos(elev)))
    centre = Vector(((x0 + x1) / 2 + size * 0.03, (y0 + y1) / 2, max(top, figure) / 2))
    bpy.ops.object.camera_add(location=centre - look * size * 3, rotation=(math.pi / 2 - elev, 0, 0))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = size
    cam.data.clip_end = size * 10
    scene.camera = cam
    bpy.ops.object.text_add(location=centre - Vector((size * 0.46, 0, 0)) - up * size * 0.43 - look * size,
                            rotation=(math.pi / 2 - elev, 0, 0))
    label = bpy.context.object
    label.data.body = name.replace('Blender_', '')
    label.data.size = size * 0.05
    label.data.materials.append(role_material('stone', (0.1, 0.1, 0.1)))
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(30)))
    bpy.context.object.data.energy = 3.2
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.72, 0.82, 0.92, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world
    scene.view_settings.view_transform = 'Standard'
    # EEVEE draws on the graphics card, which Blender may use (AGENTS.md).
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = TILE
    scene.render.filepath = scratch
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(scratch)
    px = np.empty(TILE * TILE * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(TILE, TILE, 4)
