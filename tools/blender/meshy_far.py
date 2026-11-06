# Rebuilds a Meshy tree as a far version, part by part, instead of simplifying
# it as one shape, which loses a thin crown first (RESEARCH.md, *AI model
# generators*). Run by tools/meshy-run.mjs --far, on the processor:
#
#   blender -b -P meshy_far.py -- full.glb out_stem budget [boughs|clumps]
#
# writes <out_stem>.glb, <out_stem>.json (triangles and the outline score) and
# <out_stem>_compare.png (the full model beside the far version).
#
# Finds the trunk by colour and position, cuts the crown into boughs, and makes
# each a ridged ribbon with its own length, droop, width and colour, the tip a
# small cone (boughs, for conifers). A broadleaf's crown has no boughs to find, so
# it is cut into clumps, each a faceted lump its own size (clumps). Materials are
# named for the game's roles (`leaves`, `bark`) and colour is vertex paint.
# The game draws one side of a face, so every shape here is closed and faces out.
import bpy, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_parts import read_tree, game_paint, leaf_light, vertex_normals, write_glb

args = sys.argv[sys.argv.index('--') + 1:]
full_path, stem, BUDGET = args[0], args[1], int(args[2])
STYLE = args[3] if len(args) > 3 else 'boughs'
LEVEL = float(args[4]) if len(args) > 4 else .82

TRUNK_RINGS = [0, .02, .07, .3, .6, 1]  # up the trunk, as shares of its height
SIDES = 5
RIBBON = 9  # triangles a bough, closed underneath
CAP = 5  # triangles in the cone at a conifer's tip
LUMP = 8  # triangles a clump


tree = read_tree(full_path)
full, verts, tri, colour, red, centre, area = tree.ob, tree.verts, tree.tri, tree.colour, tree.red, tree.centre, tree.area
lo, hi, H, dist, trunk, ax_at, rad_at = tree.lo, tree.hi, tree.H, tree.dist, tree.trunk, tree.ax_at, tree.rad_at

# Boughs: what is left once the trunk is taken away. glTF splits vertices at
# texture seams, so pieces are joined by position.
_, weld = np.unique(np.round(verts, 4), axis=0, return_inverse=True)
weld = weld.ravel()
root = list(range(weld.max() + 1))


def find(x):
    while root[x] != x:
        root[x] = root[root[x]]
        x = root[x]
    return x


for f in np.where(~trunk)[0]:
    a, b, c = weld[tri[f]]
    root[find(b)] = find(a)
    root[find(c)] = find(a)
top = centre[:, 2] > lo[2] + H * .92 if STYLE == 'boughs' else np.zeros(len(centre), bool)
groups = {}
for f in np.where(~trunk & ~top)[0]:
    groups.setdefault(find(weld[tri[f][0]]), []).append(int(f))
islands = sorted(groups.values(), key=lambda p: -area[p].sum())


def split(part, want):
    """A piece holding several boughs, cut by height and direction round the trunk."""
    c = centre[part]
    ring = c[:, :2] - ax_at(c[:, 2])
    ang = np.arctan2(ring[:, 1], ring[:, 0])
    key = np.stack([np.cos(ang), np.sin(ang), (c[:, 2] - lo[2]) / H * 24], 1)
    pick = key[np.random.default_rng(len(part)).choice(len(key), want, replace=False)]
    for _ in range(12):
        lab = ((key[:, None] - pick[None]) ** 2).sum(2).argmin(1)
        for k in range(want):
            if (lab == k).any():
                pick[k] = key[lab == k].mean(0)
    return [[part[i] for i in np.where(lab == k)[0]] for k in range(want) if (lab == k).any()]


trunk_tris = (len(TRUNK_RINGS) - 2) * SIDES * 2 + SIDES
want = (BUDGET - trunk_tris - CAP) // RIBBON
total = area[[f for p in islands for f in p]].sum()
pieces = []
for p in islands:
    n = max(1, round(area[p].sum() / total * want), round(np.ptp(centre[p, 2]) / (H * .03)))
    n = min(n, len(p) // 3 or 1)
    pieces += split(p, n) if n > 1 else [p]
pieces.sort(key=lambda p: -area[p].sum())
if STYLE == 'clumps':
    pieces = []

out_v, out_c, out_f, out_m = [], [], [], []


def add(v, c):
    out_v.append(tuple(v))
    out_c.append(tuple(np.clip(c, 0, 1)))
    return len(out_v) - 1


def face(i, j, k, facing, role=0):
    """A triangle turned to face the way given: the game culls the back."""
    a_, b_, c_ = (np.array(out_v[n]) for n in (i, j, k))
    out_f.append((i, j, k) if np.cross(b_ - a_, c_ - a_) @ facing >= 0 else (i, k, j))
    out_m.append(role)


kept_area = 0
kept = 0
up = np.array([0, 0, 1.])
for part in pieces:
    if kept >= want:
        break
    # Bare wood left over from the trunk is not a bough.
    if area[part][red[part]].sum() > area[part].sum() * .6:
        continue
    p = verts[np.unique(tri[part].ravel())]
    c0 = p.mean(0)
    base = np.append(ax_at(np.array([c0[2]]))[0], 0)
    out = c0 - base
    out[2] = 0
    if np.linalg.norm(out) < 1e-6:
        continue
    out /= np.linalg.norm(out)
    side = np.array([-out[1], out[0], 0])
    t, w = (p - base) @ out, (p - base) @ side
    t0, t1 = max(np.percentile(t, 1), 0), np.percentile(t, 99)
    length = t1 - t0
    # Scraps by the trunk are what read as stray slivers.
    if length < H * .012 or t1 < float(rad_at(np.array([c0[2]]))[0]) * 1.6:
        continue
    col = np.average(colour[part], axis=0, weights=area[part] + 1e-9)
    # Two rows of three across, the middle a ridge, so a bough has depth from the
    # side and not only from above.
    rows = []
    for st in (0, .5):
        at = t0 + length * st
        d = np.abs(t - at)
        win = d <= max(length * .25, np.sort(d)[min(2, len(d) - 1)])
        mid = base + out * at + side * np.median(w[win])
        mid[2] = np.median(p[win][:, 2])
        half = min(max(np.percentile(np.abs(w[win] - np.median(w[win])), 90), length * .1), length * .55)
        rise = np.clip(np.percentile(np.abs(p[win][:, 2] - mid[2]), 85), length * .05, half * .9)
        shade = .78 + .4 * st
        rows.append((add(mid - side * half - up * rise * .5, col * shade * .8), add(mid + up * rise * .5, col * shade * 1.15), add(mid + side * half - up * rise * .5, col * shade * .8)))
    tip = base + out * t1 + side * np.median(w)
    outer = t > t0 + length * .85
    tip[2] = np.median(p[outer][:, 2]) if outer.any() else tip[2]
    end = add(tip, col * 1.3)
    (l0, c0_, r0), (l1, c1, r1) = rows
    for f in ((l0, c0_, c1), (l0, c1, l1), (c0_, r0, r1), (c0_, r1, c1), (l1, c1, end), (c1, r1, end)):
        face(*f, up)
    for f in ((l0, l1, r1), (l0, r1, r0), (l1, r1, end)):
        face(*f, -up)
    kept += 1
    kept_area += area[part].sum()

if STYLE == 'boughs' and top.any():
    # The tip: too small and crowded for boughs, which came out as flat squares.
    leaf = top & ~red
    band = ~red & ~trunk & (centre[:, 2] > lo[2] + H * .86) & (centre[:, 2] < lo[2] + H * .92)
    z0 = lo[2] + H * .9
    r = np.percentile(dist[band], 85) if band.any() else H * .02
    c = ax_at(np.array([z0]))[0]
    col = colour[leaf].mean(0) if leaf.any() else colour[~red].mean(0)
    ring = [add((c[0] + r * math.cos(i * math.tau / CAP), c[1] + r * math.sin(i * math.tau / CAP), z0), col * .9) for i in range(CAP)]
    apex = add((c[0], c[1], hi[2]), col * 1.25)
    for i in range(CAP):
        out_f.append((ring[i], ring[(i + 1) % CAP], apex))
        out_m.append(0)

if STYLE == 'clumps':
    # A broadleaf crown: clumps of the crown's own faces, each a lump as long, wide
    # and deep as its clump, light above and dark below.
    rest = np.where(~trunk)[0]
    points = centre[rest]
    count = (BUDGET - trunk_tris) // LUMP
    pick = points[np.random.default_rng(len(rest)).choice(len(rest), count, replace=False)]
    for _ in range(14):
        lab = np.concatenate([((chunk[:, None] - pick[None]) ** 2).sum(2).argmin(1) for chunk in np.array_split(points, 40)])
        for k in range(count):
            if (lab == k).any():
                pick[k] = points[lab == k].mean(0)
    for k in range(count):
        part = rest[lab == k]
        if len(part) < 3:
            continue
        pts = centre[part]
        mid = pts.mean(0)
        u_, sd, axes = np.linalg.svd(pts - mid, full_matrices=False)
        reach = sd / math.sqrt(len(pts)) * 1.9
        reach = np.maximum(reach, reach.max() * .4)
        col = np.average(colour[part], axis=0, weights=area[part] + 1e-9)
        corner = []
        for i in range(3):
            for s_ in (1, -1):
                v = mid + axes[i] * reach[i] * s_
                corner.append(add(v, col * (1.25 if v[2] > mid[2] else .7)))
        for a_ in (0, 1):
            for b_ in (2, 3):
                for c_ in (4, 5):
                    face(corner[a_], corner[b_], corner[c_], (np.array(out_v[corner[a_]]) + np.array(out_v[corner[b_]]) + np.array(out_v[corner[c_]])) / 3 - mid)
        kept += 1
        kept_area += area[part].sum()

# The trunk: a tube of the measured radius, each ring its own colour.
wood = trunk & red
rings = []
for s in TRUNK_RINGS:
    z = lo[2] + H * .985 * s
    near = wood & (np.abs(centre[:, 2] - z) < H * .06)
    bark = colour[near].mean(0) if near.any() else (colour[wood].mean(0) if wood.any() else np.array([.3, .15, .1]))
    c = ax_at(np.array([z]))[0]
    if s == 1:
        rings.append([add((c[0], c[1], hi[2]), bark)])
        continue
    r = float(rad_at(np.array([z]))[0]) * (1.12 if s == 0 else 1.05)
    rings.append([add((c[0] + r * math.cos(i * math.tau / SIDES), c[1] + r * math.sin(i * math.tau / SIDES), z), bark) for i in range(SIDES)])
for low, high in zip(rings, rings[1:]):
    for i in range(SIDES):
        a, b = low[i], low[(i + 1) % SIDES]
        if len(high) == 1:
            out_f.append((a, b, high[0]))
            out_m.append(1)
        else:
            out_f += [(a, b, high[(i + 1) % SIDES]), (a, high[(i + 1) % SIDES], high[i])]
            out_m += [1, 1]

made = bpy.data.meshes.new('far')
made.from_pydata(out_v, [], out_f)
made.update()
for name in ('leaves', 'bark'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = False
    nt = m.node_tree
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'paint'
    nt.links.new(vc.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9
    made.materials.append(m)
for p, m in zip(made.polygons, out_m):
    p.material_index = m
paint = made.color_attributes.new('paint', 'FLOAT_COLOR', 'POINT')
for i, c in enumerate(out_c):
    paint.data[i].color = (*c, 1)
far = bpy.data.objects.new('far', made)
bpy.context.scene.collection.objects.link(far)


def triangles(ob):
    d = ob.data
    d.calc_loop_triangles()
    v = np.array([x.co[:] for x in d.vertices])
    return v[np.array([t.vertices[:] for t in d.loop_triangles])]


def outline(t, yaw, res=(160, 560)):
    x = t[..., 0] * math.cos(yaw) + t[..., 1] * math.sin(yaw)
    span = H * 1.02
    gx = (x + span * .3) / (span * .6) * res[0]
    gy = (t[..., 2] - lo[2]) / span * res[1]
    m = np.zeros((res[1], res[0]), bool)
    for (x0, x1, x2), (y0, y1, y2) in zip(gx, gy):
        l, r = int(max(0, min(x0, x1, x2))), int(min(res[0] - 1, max(x0, x1, x2))) + 1
        b, e = int(max(0, min(y0, y1, y2))), int(min(res[1] - 1, max(y0, y1, y2))) + 1
        d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if r <= l or e <= b or abs(d) < 1e-9:
            continue
        px, py = np.meshgrid(np.arange(l, r) + .5, np.arange(b, e) + .5)
        p = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d
        q = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d
        m[b:e, l:r] |= (p >= 0) & (q >= 0) & (p + q <= 1)
    return m


whole, rebuilt = triangles(full), triangles(far)
scores = []
for k in range(8):
    y = k * math.tau / 8
    a, b = outline(whole, y), outline(rebuilt, y)
    scores.append(float((a & b).sum() / (a | b).sum()))
report = {'triangles': len(rebuilt), 'full': len(whole), 'boughs': kept, 'area': round(float(kept_area / total), 3),
          'outline': round(float(np.mean(scores)), 3), 'worst': round(float(np.min(scores)), 3)}
with open(stem + '.json', 'w') as f:
    json.dump(report, f)

# The game's form, one part per role, each with its own vertices.
pos, col = np.array(out_v), np.array(out_c)
parts = []
for role, name in enumerate(('leaves', 'bark')):
    chosen = np.array([f for f, m in zip(out_f, out_m) if m == role], np.int64)
    ids, remap = np.unique(chosen, return_inverse=True)
    remap = remap.reshape(-1, 3)
    normal = vertex_normals(pos[ids], remap)
    under = None
    if role == 0:
        normal, under = leaf_light(pos[ids], normal, tree)
    parts.append((name, pos[ids], normal, game_paint(col[ids], pos[ids], role, tree, under, LEVEL * (1.1 if STYLE == 'boughs' else 1)), remap))
write_glb(stem + '.glb', parts[::-1])  # bark first, as the shipped models

s = bpy.context.scene
cx = (lo[:2] + hi[:2]) / 2
full.location = (-H * .3 - cx[0], -cx[1], 0)
far.location = (H * .3 - cx[0], -cx[1], 0)
s.render.engine = 'CYCLES'
s.cycles.device = 'CPU'
s.cycles.samples = 32
s.render.resolution_x, s.render.resolution_y = 1000, 1000
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.72, .78, .82, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.3
s.world = world
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
s.collection.objects.link(sun)
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
s.collection.objects.link(cam)
s.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = H * 1.12
cam.location = (0, -H * 4, lo[2] + H * .5)
cam.rotation_euler = (math.pi / 2, 0, 0)
s.render.filepath = stem + '_compare.png'
bpy.ops.render.render(write_still=True)
