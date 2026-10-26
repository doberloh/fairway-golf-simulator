# THE CARTOON OVERHAUL'S MODEL LIBRARY (docs/CARTOON_OVERHAUL.md).
#
# Every model the overhaul remakes is built from the shapes in here, so the
# whole game is drawn by one hand: crowns as clouds of soft lobes, conifers as
# drooping skirts, trunks that flare and fork, rocks as chunky bevelled planes.
#
# On top of fairway_blender.Mesh (roles, export, contact sheet) this adds the
# two things that make a cartoon model look designed rather than assembled:
#
#  PAINT -- a colour per vertex, exported as COLOR_0 and carried into the game
#  (tools/mesh-read.mjs, tools/build-meshes.mjs, src/mesh-assets.js). RGB is a
#  multiplier on the colour the game paints the role with, stored halved so
#  0.5 means "as painted" and 1.0 means twice as bright: a crown's core and
#  underside go dark, its sun-side tips light, a rock's foot dark. ALPHA is
#  how freely the vertex moves in the wind (0 rooted, 1 a leaf tip), for the
#  wind shader.
#
#  NORMALS -- foliage normals bent toward the direction from the crown's
#  centre (about 80%: Inasa Fujio's stylised-tree recipe, REFERENCES), so a
#  crown lights as one soft body with a sun side and a shade side instead of
#  a hundred facets. Exported as custom normals; the game keeps them.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix, noise

sys.path.insert(0, os.path.dirname(__file__))
import fairway_blender as fb

GOLDEN = math.pi * (3 - math.sqrt(5))

# THE FAR TWIN (the cartoon overhaul's stands: thousands of trees at once).
# `export(..., far=True)` builds every model a second time as `<name>_Far`
# with FAR set: each lobe an icosahedron (20 triangles, not 320-1280), each
# tube half its sides, each conifer skirt half its rim. The same seed and the
# same draws, so the twin has the full model's silhouette and paint and only
# its facets change: every lump and tube takes ONE draw from the builder's
# stream and jitters from a stream of its own, so how many vertices it has
# never moves anything built after it. The game swaps to the twin where a
# crown is small on screen (src/instance-cull.js).
FAR = False


def own_stream(rng):
    return random.Random(rng.random()) if rng is not None else None


class PaintMesh(fb.Mesh):
    """A Mesh whose vertices carry paint (rgb multiplier, flex) and, where
    asked, a custom normal."""

    def __init__(self):
        super().__init__()
        self.paint = {}     # BMVert -> (r, g, b, flex), r/g/b as a multiplier
        self.normal = {}    # BMVert -> Vector

    # -- building, with paint ------------------------------------------------
    def add_lump(self, center, radii, role, rng, subdiv=2, jitter=0.12, crown=None, blend=0.8,
                 shade=None, flex=0.0, squash_bottom=0.0):
        """A soft lobe: a jittered icosphere scaled to `radii`.

        `crown` is the centre whose direction the normals are bent toward by
        `blend`; `shade(world_point, normal)` returns the rgb multiplier."""
        rng = own_stream(rng)
        bm = bmesh.new()
        # THE FINEST LOBE IS A TWELVE-SIDED SPHERE (the frame-rate pass): the
        # 320-face icosphere `subdiv=3` asked for made a broadleaf crown
        # 8,000-9,700 triangles, and the 80-face one below it shows hexagons
        # on every outline (rounds/broadleaf-r4.png, rejected). Twelve sides
        # round, seven rings up, 144 faces: as round from the side, where a
        # crown is seen, at under half the cost.
        if not FAR and subdiv >= 3:
            bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=7, radius=1.0)
        elif FAR and role != 'leaf' and max(radii) < 0.15:
            # A far twin's flower or berry, a few pixels across at the
            # distance the twin is drawn: four faces, not twenty. Kept rather
            # than dropped, so the twin still has every role the model has.
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=3, radius1=1.0, radius2=0.0, depth=1.5)
        else:
            bmesh.ops.create_icosphere(bm, subdivisions=0 if FAR else subdiv, radius=1.0)
        idx = self.slot(role)
        lookup = {}
        sx, sy, sz = radii
        for v in bm.verts:
            n = v.co.normalized()
            r = 1 + rng.uniform(-jitter, jitter)
            p = Vector((n.x * sx * r, n.y * sy * r, n.z * sz * r))
            if squash_bottom and p.z < 0:
                p.z *= (1 - squash_bottom)
            w = center + p
            nv = self.bm.verts.new(w)
            lookup[v] = nv
            own = Vector((n.x / max(sx, 1e-6), n.y / max(sy, 1e-6), n.z / max(sz, 1e-6))).normalized()
            if crown is not None:
                out = (w - crown)
                out = out.normalized() if out.length > 1e-6 else Vector((0, 0, 1))
                nn = (own * (1 - blend) + out * blend).normalized()
            else:
                nn = own
            self.normal[nv] = nn
            m = shade(w, nn) if shade else 1.0
            mm = m if isinstance(m, tuple) else (m, m, m)
            self.paint[nv] = (*mm, flex if not callable(flex) else flex(w))
        for f in bm.faces:
            nf = self.bm.faces.new([lookup[v] for v in f.verts])
            nf.material_index = idx
            nf.smooth = True
        bm.free()

    def add_tube(self, points, radii, sides, role, rng=None, wobble=0.0, shade=None, flex=None, cap_end=True):
        """fb.tube, with paint per ring."""
        made = fb.tube(self, points, radii, max(4, (sides + 1) // 2) if FAR else sides, role, rng=own_stream(rng),
                       wobble=wobble, cap_end=cap_end)
        for i, ring in enumerate(made):
            t = i / max(1, len(made) - 1)
            for v in ring:
                m = shade(v.co, t) if shade else 1.0
                mm = m if isinstance(m, tuple) else (m, m, m)
                self.paint[v] = (*mm, flex(v.co, t) if flex else 0.0)
        return made

    def paint_all(self, fn):
        """Repaint every vertex: fn(co, old) -> (r, g, b, flex)."""
        for v in self.bm.verts:
            self.paint[v] = fn(v.co, self.paint.get(v, (1, 1, 1, 0)))

    # -- out -----------------------------------------------------------------
    def finish(self, name):
        self.bm.verts.index_update()
        order = list(self.bm.verts)
        paint = [self.paint.get(v, (1.0, 1.0, 1.0, 0.0)) for v in order]
        bent = [self.normal.get(v) for v in order]
        obj = super().finish(name)
        me = obj.data
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for i, (r, g, b, a) in enumerate(paint):
            attr.data[i].color = (min(1, r * 0.5), min(1, g * 0.5), min(1, b * 0.5), max(0, min(1, a)))
        me.color_attributes.active_color = attr
        # Custom normals: bent where a builder asked, the mesh's own elsewhere.
        if any(n is not None for n in bent):
            me.update()
            own = [v.normal.copy() for v in me.vertices]
            me.normals_split_custom_set_from_vertices([tuple(n if n is not None else own[i]) for i, n in enumerate(bent)])
        return obj


# ---------------------------------------------------------------- shading
#
# Most models are painted by height within themselves: dark at the root,
# brighter going up, with a crown's core darker than its skin.

def crown_shade(center, radii, low=0.45, high=1.2, core=0.62, sun=Vector((-0.45, -0.35, 0.82))):
    """Paint for foliage: darker underneath and inside, lighter on top and on
    the sun side. Returns shade(point, normal)."""
    rx, ry, rz = radii

    def f(p, n):
        q = p - center
        up = max(-1.0, min(1.0, q.z / max(rz, 1e-6)))
        depth = math.sqrt((q.x / rx) ** 2 + (q.y / ry) ** 2 + (q.z / rz) ** 2)
        v = low + (high - low) * (0.5 + 0.5 * up)
        v *= core + (1 - core) * min(1.0, depth)
        v *= 0.92 + 0.12 * max(0.0, n.dot(sun.normalized()))
        return v
    return f


def flat_shade(value):
    return lambda p, n=None: value


# ---------------------------------------------------------------- trees

def trunk(mesh, rng, base, height, radius, lean=Vector((0, 0, 0)), steps=8, sides=9, flare=1.7, bend=0.0,
          shade_low=0.78, shade_high=1.08, wobble=0.06):
    """A trunk that flares at the root and tapers, leaning by `lean` (a
    horizontal vector, metres at the top) and bowing by `bend`. Returns its
    points, so limbs can leave from it."""
    pts, radii = [], []
    side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized() * bend
    for i in range(steps + 1):
        t = i / steps
        p = base + Vector((0, 0, height * t)) + lean * (t * t) + side * math.sin(t * math.pi)
        pts.append(p)
        r = radius * (1 - 0.55 * t) * (1 + (flare - 1) * math.exp(-t * 14))
        radii.append(r)
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=lambda co, t: shade_low + (shade_high - shade_low) * min(1, t * 1.6),
                  flex=lambda co, t: 0.15 * t * t)
    return pts, radii


def limb(mesh, rng, start, end, r0, r1, sides=6, bow=0.2, shade=0.85):
    mid = (end - start)
    bend = Vector((0, 0, mid.length * bow))
    pts = fb.sweep_points(start, end, bend, 5, rng=rng, kink=mid.length * 0.03)
    radii = [r0 + (r1 - r0) * (i / 5) for i in range(6)]
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=0.05,
                  shade=lambda co, t: shade * (0.9 + 0.15 * t),
                  flex=lambda co, t: 0.2 + 0.35 * t)
    return pts


def cloud_crown(mesh, rng, center, radii, lobes=14, lobe_size=(0.34, 0.52), role='leaf', subdiv=3,
                blend=0.8, low=0.45, high=1.2, flat_bottom=0.35, jitter=0.08, shell=0.78):
    """A crown as a cloud of soft lobes on and inside an ellipsoid.

    Lobes sit on a shell at `shell` of the radii (golden-angle spread, jittered),
    sized as a share of the crown; the lowest are flattened so the crown has
    the slightly flat base cartoon trees have. Normals bend toward the crown's
    centre, so it lights as one body."""
    rx, ry, rz = radii
    shade = crown_shade(center, radii, low=low, high=high)
    for i in range(lobes):
        # Spread over the shell, upper half favoured.
        y = 1 - (i + 0.5) / lobes * 1.7
        y = max(-0.85, min(0.95, y + rng.uniform(-0.12, 0.12)))
        r = math.sqrt(max(0.0, 1 - y * y))
        a = i * GOLDEN + rng.uniform(-0.35, 0.35)
        d = Vector((math.cos(a) * r, math.sin(a) * r, y))
        s = shell * rng.uniform(0.85, 1.05)
        c = center + Vector((d.x * rx * s, d.y * ry * s, d.z * rz * s))
        k = rng.uniform(*lobe_size)
        size = (rx * k * rng.uniform(.9, 1.15), ry * k * rng.uniform(.9, 1.15), rz * k * rng.uniform(.8, 1.0))
        mesh.add_lump(c, size, role, rng, subdiv=subdiv, jitter=jitter, crown=center, blend=blend, shade=shade,
                      flex=lambda w: min(1.0, 0.45 + 0.55 * max(0.0, (w - center).length / max(rx, rz))),
                      squash_bottom=flat_bottom if d.z < -0.2 else 0.0)
    # A filled core so no sky shows through the middle.
    mesh.add_lump(center, (rx * 0.62, ry * 0.62, rz * 0.6), role, rng, subdiv=2, jitter=0.05,
                  crown=center, blend=blend, shade=shade, flex=0.35)


def skirt(mesh, rng, center, radius, depth, points=9, droop=0.35, role='leaf', blend=0.6, shade=None,
          ragged=0.18, flex=0.5, twist=0.0, thick=0.55):
    """One conifer tier: a drooping skirt, a star of `points` boughs hanging
    from the leader, its lower edge ragged. A closed shape (top cap, outer
    wall, underside), so it is solid from every side."""
    top = center + Vector((0, 0, depth * 0.55))
    ring_out, ring_in = [], []
    # Each bough is four points round the rim -- a notch, a shoulder, the tip,
    # a shoulder -- so its end is a rounded scallop rather than a star point
    # (round 3 of the conifers: two points a bough read as clip art).
    STEPS = ((0.74, 0.5), (0.93, 0.85), (1.0, 1.0), (0.93, 0.85))
    if FAR:
        STEPS = ((0.74, 0.5), (1.0, 1.0))
    per = len(STEPS)
    n = points * per
    sway = [rng.uniform(-ragged, ragged) for _ in range(points)]
    for k in range(n):
        a = k / n * math.tau + twist
        rf, df = STEPS[k % per]
        b = sway[k // per]
        rr = radius * rf * (1 + b * (1 if rf > 0.8 else 0.4))
        drop = depth * (0.45 + droop * df) * (1 + b * 0.8)
        ring_out.append(center + Vector((math.cos(a) * rr, math.sin(a) * rr, -drop + depth * 0.45)))
        ring_in.append(center + Vector((math.cos(a) * rr * thick, math.sin(a) * rr * thick, -drop * (1.1 - thick) + depth * 0.2)))
    idx = mesh.slot(role)
    vt = mesh.bm.verts.new(top)
    vo = [mesh.bm.verts.new(p) for p in ring_out]
    vi = [mesh.bm.verts.new(p) for p in ring_in]
    vb = mesh.bm.verts.new(center + Vector((0, 0, -depth * 0.15)))
    faces = []
    for k in range(n):
        a, b = k, (k + 1) % n
        faces.append(mesh.bm.faces.new((vt, vo[a], vo[b])))
        faces.append(mesh.bm.faces.new((vo[b], vo[a], vi[a], vi[b])))
        faces.append(mesh.bm.faces.new((vi[b], vi[a], vb)))
    for f in faces:
        f.material_index = idx
        f.smooth = True
    sh = shade or (lambda p, nn: 1.0)
    axis_c = center + Vector((0, 0, -depth * 0.2))
    for v in [vt, vb, *vo, *vi]:
        out = v.co - axis_c
        out.z *= 0.6
        out = out.normalized() if out.length > 1e-6 else Vector((0, 0, 1))
        up = Vector((0, 0, 1))
        nn = (out * blend + up * (1 - blend) * 0.6).normalized()
        mesh.normal[v] = nn
        m = sh(v.co, nn)
        mm = m if isinstance(m, tuple) else (m, m, m)
        under = 0.72 if v in vi or v is vb else 1.0
        mesh.paint[v] = (mm[0] * under, mm[1] * under, mm[2] * under, flex * (1.0 if v in vo else 0.5))


# ---------------------------------------------------------------- rocks

def hull_rock(mesh, rng, center, radii, points=26, role='stone', bevel=0.12, flat_top=0.0, seat=0.18,
              strata=0, shade_low=0.62, shade_high=1.12, moss=None):
    """A chunky rock: the convex hull of jittered points in an ellipsoid,
    bevelled so its planes read, sunk `seat` of its height into the ground.

    `flat_top` shaves the crown flat (a slab, a ledge); `strata` cuts that
    many horizontal steps into it (sandstone). `moss` (a role) paints the
    upward-facing faces in that role instead -- moss, lichen or snow."""
    rx, ry, rz = radii
    bm = bmesh.new()
    for i in range(points):
        y = 1 - (i + 0.5) / points * 2
        r = math.sqrt(max(0.0, 1 - y * y))
        a = i * GOLDEN + rng.uniform(-0.4, 0.4)
        k = rng.uniform(0.78, 1.0)
        z = y * rz * k
        if flat_top and z > rz * (1 - flat_top):
            z = rz * (1 - flat_top) + (z - rz * (1 - flat_top)) * 0.15
        bm.verts.new((math.cos(a) * r * rx * k, math.sin(a) * r * ry * k, z))
    bmesh.ops.convex_hull(bm, input=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel * min(rx, ry, rz), segments=1, affect='EDGES',
                        profile=0.5)
    if strata:
        lo, hi = -rz, rz
        for s in range(1, strata + 1):
            h = lo + (hi - lo) * s / (strata + 1)
            for v in bm.verts:
                if abs(v.co.z - h) < (hi - lo) * 0.06:
                    v.co.x *= 0.93
                    v.co.y *= 0.93
    bm.normal_update()
    idx_stone = mesh.slot(role)
    idx_moss = mesh.slot(moss) if moss else idx_stone
    lookup = {}
    base_z = center.z - rz * seat
    for v in bm.verts:
        w = Vector((center.x + v.co.x, center.y + v.co.y, base_z + v.co.z + rz))
        nv = mesh.bm.verts.new(w)
        lookup[v] = nv
        up = (v.co.z + rz) / (2 * rz)
        val = shade_low + (shade_high - shade_low) * max(0.0, min(1.0, up))
        mesh.paint[nv] = (val, val, val, 0.0)
    for f in bm.faces:
        nf = mesh.bm.faces.new([lookup[v] for v in f.verts])
        nf.material_index = idx_moss if moss and f.normal.z > 0.62 else idx_stone
        nf.smooth = False
    bm.free()


def pebble_rock(mesh, rng, center, radii, role='stone', moss=None, seat=.15, lumps=.18, subdiv=2,
                shade_low=.6, shade_high=1.12, moss_at=.55):
    """A rounded boulder: an icosphere pushed about by low-frequency noise and
    flattened underneath, so it sits. Smooth-shaded; `moss` paints the faces
    looking up past `moss_at` in that role (moss, lichen, snow)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    rx, ry, rz = radii
    for v in bm.verts:
        n = v.co.normalized()
        d = 1 + lumps * (noise.noise(n * 1.6 + off) + .5 * noise.noise(n * 3.4 + off * 1.7))
        p = Vector((n.x * rx * d, n.y * ry * d, n.z * rz * d))
        if p.z < -rz * .35:
            p.z = -rz * .35 + (p.z + rz * .35) * .15
        v.co = p
    bm.normal_update()
    idx_stone = mesh.slot(role)
    idx_moss = mesh.slot(moss) if moss else idx_stone
    lookup = {}
    base_z = center.z - rz * seat + rz * .35
    for v in bm.verts:
        w = Vector((center.x + v.co.x, center.y + v.co.y, base_z + v.co.z))
        nv = mesh.bm.verts.new(w)
        lookup[v] = nv
        up = (v.co.z + rz * .35) / (rz * 1.35)
        val = shade_low + (shade_high - shade_low) * max(0.0, min(1.0, up))
        mesh.paint[nv] = (val, val, val, 0.0)
    for f in bm.faces:
        nf = mesh.bm.faces.new([lookup[v] for v in f.verts])
        # Moss on the crown only -- facing up AND high on the stone -- so it is
        # one patch, not green flecks on every upturned facet (round 3).
        top = f.calc_center_median().z > rz * .35
        nf.material_index = idx_moss if moss and f.normal.z > moss_at and top else idx_stone
        nf.smooth = True
    bm.free()


# ---------------------------------------------------------------- grass

def tuft(mesh, rng, root, blades=9, height=0.5, width=0.05, spread=0.3, lean=0.35, low='leaf', tip='accent',
         tip_from=0.65, dark=0.55, light=1.12):
    """A clump of blades from one root, leaning out together, dark at the
    root and light at the tips, flexing more toward the top. Two-sided."""
    for i in range(blades):
        a = i * GOLDEN + rng.uniform(-0.5, 0.5)
        h = height * rng.uniform(0.65, 1.0)
        r0 = Vector((math.cos(a), math.sin(a), 0)) * rng.uniform(0, spread * 0.3)
        out = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-out.y, out.x, 0))
        segs = 3
        pts = []
        l = lean * rng.uniform(0.6, 1.3)
        for s in range(segs + 1):
            t = s / segs
            p = root + r0 + out * (l * h * t * t) + Vector((0, 0, h * (t - 0.18 * t ** 3)))
            pts.append((p, width * (1 - t) ** 0.85, t))
        for (pa, wa, ta), (pb, wb, tb) in zip(pts, pts[1:]):
            role = tip if ta >= tip_from - 1e-6 else low
            idx = mesh.slot(role)
            quad = [pa - side * wa, pa + side * wa, pb + side * wb, pb - side * wb] if tb < 1 - 1e-6 else [pa - side * wa, pa + side * wa, pb]
            for poly in (quad, list(reversed(quad))):
                vs = [mesh.bm.verts.new(p) for p in poly]
                f = mesh.bm.faces.new(vs)
                f.material_index = idx
                f.smooth = True
                for v in vs:
                    t = max(0.0, min(1.0, (v.co.z - root.z) / max(h, 1e-6)))
                    val = dark + (light - dark) * t
                    mesh.paint[v] = (val, val, val, t)
                    mesh.normal[v] = Vector((0, 0, 1))


# ---------------------------------------------------------------- the sheet

def toon_material(name, rgb):
    """A contact-sheet material that looks like the game: a soft three-step
    light ramp, times the vertex paint (doubled back from its halving), times
    the role's colour. The game ignores this material; only its name ships."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE'
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.36, 0.36, 0.40, 1)
    els[1].position, els[1].color = 0.55, (1.0, 1.0, 1.0, 1)
    e = els.new(0.18)
    e.color = (0.58, 0.58, 0.62, 1)
    e = els.new(0.32)
    e.color = (0.82, 0.82, 0.84, 1)
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    dbl = nt.nodes.new('ShaderNodeMix')
    dbl.data_type = 'RGBA'
    dbl.blend_type = 'MULTIPLY'
    dbl.inputs['Factor'].default_value = 1.0
    two = nt.nodes.new('ShaderNodeMix')
    two.data_type = 'RGBA'
    two.blend_type = 'MULTIPLY'
    two.inputs['Factor'].default_value = 1.0
    two.inputs['B'].default_value = (2.0, 2.0, 2.0, 1)
    base = nt.nodes.new('ShaderNodeMix')
    base.data_type = 'RGBA'
    base.blend_type = 'MULTIPLY'
    base.inputs['Factor'].default_value = 1.0
    base.inputs['B'].default_value = (*rgb, 1)
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(diff.outputs['BSDF'], s2r.inputs['Shader'])
    nt.links.new(s2r.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(col.outputs['Color'], two.inputs['A'])
    nt.links.new(two.outputs['Result'], dbl.inputs['A'])
    nt.links.new(ramp.outputs['Color'], dbl.inputs['B'])
    nt.links.new(dbl.outputs['Result'], base.inputs['A'])
    nt.links.new(base.outputs['Result'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    m.diffuse_color = (*rgb, 1)
    return m


SHEET_COLOURS = {'leaf': (0.30, 0.55, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.85, 0.72, 0.42),
                 'stone': (0.62, 0.61, 0.58), 'dirt': (0.55, 0.45, 0.32)}


def use_toon_sheet(colours=None):
    """Swap fb's preview materials for toon ones, so the contact sheet looks
    the way the game will draw the pack."""
    colours = {**SHEET_COLOURS, **(colours or {})}
    original = fb.role_material

    def role_material(role, preview=None):
        if preview is not None:
            # The sheet's scale post and label: a plain material of their own,
            # or they take the toon one and draw black (no vertex paint).
            name = 'figure-%d-%d-%d' % tuple(int(c * 100) for c in preview)
            m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
            m.use_nodes = True
            m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*preview, 1)
            return m
        return toon_material(fb.ROLE_MATERIAL[role], colours[role])
    fb.role_material = role_material


def far_twin(name, build):
    """`build` again with FAR set, seeded as the full model is (fb seeds from
    the name, and the twin's name has `_Far` on it)."""
    def b(mesh, rng):
        global FAR
        FAR = True
        try:
            build(mesh, random.Random(name))
        finally:
            FAR = False
    return b


def export(models, render=None, colours=None, far=False):
    """fb.export_pack with PaintMesh and the paint exported as COLOR_0; with
    `far`, every model's far twin too (`<name>_Far`) -- or, given a set of
    names, those models' only (a small plant's twin saves next to nothing)."""
    out, render_path = fb.args()
    use_toon_sheet(colours)
    fb.Mesh = PaintMesh
    if far:
        models = list(models) + [(name + '_Far', far_twin(name, build)) for name, build in models
                                 if far is True or name in far]
    fb.export_pack(models, out, render_path or render,
                   gltf_options={'export_vertex_color': 'ACTIVE', 'export_all_vertex_colors': False})
