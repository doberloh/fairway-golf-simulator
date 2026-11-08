# Rebuilds a Meshy tree as a far version, part by part, instead of simplifying
# it as one shape, which loses a thin crown first (RESEARCH.md, *AI model
# generators*). Run by tools/meshy-run.mjs --far, on the processor:
#
#   blender -b -P meshy_far.py -- full.glb out_stem budget [boughs|clumps|tufts|skirts|fronds|cactus]
#
# writes <out_stem>.glb, <out_stem>.json (triangles and the outline score) and
# <out_stem>_compare.png (the full model beside the far version).
#
# Finds the trunk by colour and position, cuts the crown into boughs, and makes
# each a ridged ribbon with its own length, droop, width and colour, the tip a
# small cone (boughs, for conifers). A broadleaf's crown has no boughs to find, so
# it is cut into clumps, each a faceted lump its own size (clumps). A crown drawn as
# soft tufts is cut from its leaves alone, each a rounded mass (tufts). A conifer drawn
# as solid tiers is found tier by tier, each a scalloped cone (skirts). A palm is cut by
# direction from the top of its trunk, each frond a curved blade (fronds). A cactus is
# a column on its axis, each arm standing out from it a bent column (cactus). Materials are
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
FROND_RINGS = [0, .02, .07, .2, .35, .5, .65, .8, .93, 1]  # a palm's, to its hub: a bowed trunk stays smooth
SIDES = 5
RIBBON = 9  # triangles a bough, closed underneath
CAP = 5  # triangles in the cone at a conifer's tip
LUMP = 8  # triangles a clump
TUFT_LIMB = 6  # triangles in the limb to a tuft
SKIRT = 5  # scallops a tier, each two sides and two faces underneath
FROND = 21  # triangles a frond: four rows of three, a tip, closed underneath
FRONDS = 14  # PLACED: about what the palm models show from one side
CACTUS_ARMS = 5  # at most: a saguaro's column and its largest arms
# An icosahedron: the fewest triangles that read as round rather than as a diamond.
PHI = (1 + 5 ** .5) / 2
TUFT_V = np.array([(-1, PHI, 0), (1, PHI, 0), (-1, -PHI, 0), (1, -PHI, 0), (0, -1, PHI), (0, 1, PHI), (0, -1, -PHI), (0, 1, -PHI), (PHI, 0, -1), (PHI, 0, 1), (-PHI, 0, -1), (-PHI, 0, 1)], float) / math.hypot(1, PHI)
TUFT_F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]


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
if STYLE in ('clumps', 'tufts', 'skirts', 'fronds', 'cactus'):
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

if STYLE in ('clumps', 'tufts'):
    # A broadleaf crown: clumps of the crown's own faces, each a lump as long, wide
    # and deep as its clump, light above and dark below.
    rest = np.where(~trunk & ~red if STYLE == 'tufts' else ~trunk)[0]
    points = centre[rest]
    count = (BUDGET - trunk_tris) // (len(TUFT_F) if STYLE == 'tufts' else LUMP)
    pick = points[np.random.default_rng(len(rest)).choice(len(rest), count, replace=False)]
    limbs = False
    if STYLE == 'tufts':
        # Separate tufts in the model are counted, so each is one mass with a limb to it.
        root[:] = range(len(root))
        for f in rest:
            a_, b_, c_ = weld[tri[f]]
            root[find(b_)] = find(a_)
            root[find(c_)] = find(a_)
        parts_ = {}
        for f in rest:
            parts_.setdefault(find(weld[tri[f][0]]), []).append(int(f))
        whole = area[rest].sum()
        big = [p for p in parts_.values() if area[p].sum() > whole * .02]
        if 6 <= len(big) <= (BUDGET - trunk_tris) // (len(TUFT_F) + TUFT_LIMB):
            count = len(big)
            pick = np.array([centre[p].mean(0) for p in big])
            limbs = True
        elif np.ptp(np.percentile(points[:, 2], [5, 95])) < H * .5:
            # A crown high on a bare trunk, its tufts joined: fewer masses, or they come out small.
            count = min(count, 11)
            pick = points[np.random.default_rng(len(rest)).choice(len(rest), count, replace=False)]
            limbs = True
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
        if STYLE == 'tufts':
            tuft = reach * .95  # a little inside the clump, so the gaps between tufts stay open
            at = [add(mid + (u * tuft) @ axes, col * (.7 + .28 * (1 + (u * tuft) @ axes[:, 2] / tuft.max()))) for u in TUFT_V]
            for a_, b_, c_ in TUFT_F:
                face(at[a_], at[b_], at[c_], (np.array(out_v[at[a_]]) + np.array(out_v[at[b_]]) + np.array(out_v[at[c_]])) / 3 - mid)
            if limbs:
                wood_col = colour[trunk & red].mean(0)
                start = np.array([*ax_at(np.array([tree.crown_base]))[0], tree.crown_base])
                fat = float(np.percentile(dist[trunk & red & (centre[:, 2] < lo[2] + H * .12)], 70)) * .4
                along = (mid - start) / (np.linalg.norm(mid - start) + 1e-9)
                across = np.cross(along, up)
                across /= np.linalg.norm(across) + 1e-9
                other = np.cross(along, across)
                ring = lambda at, w: [add(at + (across * math.cos(i_ * math.tau / 3) + other * math.sin(i_ * math.tau / 3)) * w, wood_col) for i_ in range(3)]
                low_, high_ = ring(start, fat), ring(mid, fat * .5)
                for i_ in range(3):
                    j_ = (i_ + 1) % 3
                    side_ = np.array(out_v[low_[i_]]) + np.array(out_v[low_[j_]]) - start * 2
                    face(low_[i_], low_[j_], high_[j_], side_, 1)
                    face(low_[i_], high_[j_], high_[i_], side_, 1)
            kept += 1
            kept_area += area[part].sum()
            continue
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

if STYLE == 'skirts':
    # Each tier's rim is where the crown's reach peaks on the way up the tree. A tier is a
    # cone from its rim to halfway up the next one, so the stack reads solid from the side.
    leaf = np.where(~trunk & ~red)[0]
    z_leaf = centre[leaf, 2]
    cuts = np.linspace(z_leaf.min(), z_leaf.max(), 121)
    reach_at = np.zeros(120)
    for i in range(120):
        inside = (z_leaf >= cuts[i]) & (z_leaf < cuts[i + 1])
        reach_at[i] = np.percentile(dist[leaf][inside], 95) if inside.sum() >= 5 else 0
    smooth = np.convolve(reach_at, np.ones(3) / 3, 'same')
    peaks = [i for i in range(120) if smooth[i] > 0 and smooth[i] >= smooth[max(0, i - 2):i + 3].max()]
    peaks = [p for n, p in enumerate(peaks) if n == 0 or p - peaks[n - 1] > 1]
    most = (BUDGET - trunk_tris) // (SKIRT * 4)
    peaks = sorted(sorted(peaks, key=lambda p: -smooth[p])[:most])
    rims = [(cuts[p] + cuts[p + 1]) / 2 for p in peaks]
    for n, p in enumerate(peaks):
        z0 = rims[n]
        z1 = z_leaf.max() if n == len(peaks) - 1 else rims[n + 1] + (rims[n + 1] - z0) * .5
        if n == len(peaks) - 1:
            z1 = z_leaf.max()
        band = leaf[(z_leaf >= z0) & (z_leaf < z1)]
        col = np.average(colour[band], axis=0, weights=area[band] + 1e-9) if len(band) else colour[leaf].mean(0)
        c = ax_at(np.array([z0]))[0]
        rim = [add((c[0] + float(smooth[p]) * (1 if j % 2 == 0 else .84) * math.cos((j + n * .7) * math.pi / SKIRT), c[1] + float(smooth[p]) * (1 if j % 2 == 0 else .84) * math.sin((j + n * .7) * math.pi / SKIRT), z0), col * .85) for j in range(SKIRT * 2)]
        tip_ = add((c[0], c[1], z1), col * 1.2)
        under = add((c[0], c[1], z0 + (z1 - z0) * .12), col * .6)
        for j in range(SKIRT * 2):
            a_, b_ = rim[j], rim[(j + 1) % (SKIRT * 2)]
            face(a_, b_, tip_, (np.array(out_v[a_]) + np.array(out_v[b_])) / 2 - np.array([c[0], c[1], z0]))
            face(a_, b_, under, -up)
        kept += 1

hub_z = None
if STYLE == 'fronds':
    # Tufts made round lollipops of a palm and boughs a stacked pagoda, because both ignore
    # where a frond starts. Every frond here starts at the hub, and follows its own faces
    # outward from there, so it keeps its droop.
    leaf = np.where(~trunk & ~red)[0]
    near = leaf[dist[leaf] < np.percentile(dist[leaf], 12)]
    wood_top = float(np.percentile(centre[trunk & red, 2], 99))
    hub_z = max(wood_top, float(np.median(centre[near, 2])))
    hub = np.array([*ax_at(np.array([hub_z]))[0], hub_z])
    ray = centre[leaf] - hub
    span = np.linalg.norm(ray, axis=1) + 1e-9
    aim = ray / span[:, None]
    count = min(FRONDS, (BUDGET - trunk_tris) // FROND)
    pick = aim[np.random.default_rng(len(leaf)).choice(len(leaf), count, replace=False)]
    for _ in range(16):
        lab = (aim @ pick.T).argmax(1)
        for k in range(count):
            if (lab == k).any():
                pick[k] = aim[lab == k].mean(0)
                pick[k] /= np.linalg.norm(pick[k]) + 1e-9
    for k in range(count):
        part = leaf[lab == k]
        if len(part) < 6:
            continue
        pts, reach = centre[part], span[lab == k]
        col = np.average(colour[part], axis=0, weights=area[part] + 1e-9)
        s0, s1 = np.percentile(reach, 2), np.percentile(reach, 99)
        length = s1 - s0
        rows = []
        for st in (.02, .32, .6, .84):
            at = s0 + length * st
            d = np.abs(reach - at)
            win = d <= max(length * .14, np.sort(d)[min(5, len(d) - 1)])
            rows.append((np.median(pts[win], 0), win))
        tip = np.median(pts[reach >= np.percentile(reach, 96)], 0)
        spine = [r[0] for r in rows] + [tip]
        out = tip[:2] - hub[:2]
        out = np.array([*out, 0.]) / (np.linalg.norm(out) + 1e-9)
        side = np.cross(out, up)
        side /= np.linalg.norm(side) + 1e-9
        made_rows = []
        for n_, (mid, win) in enumerate(rows):
            along = spine[n_ + 1] - mid
            along /= np.linalg.norm(along) + 1e-9
            lift = np.cross(side, along)
            lift = lift if lift @ (up + out) >= 0 else -lift
            half = max(np.percentile(np.abs((pts[win] - mid) @ side), 90), length * .04)
            rise = np.clip(np.percentile(np.abs((pts[win] - mid) @ lift), 85), length * .02, half * .7)
            shade = .74 + .16 * n_
            made_rows.append((add(mid - side * half - lift * rise * .5, col * shade * .8), add(mid + lift * rise * .5, col * shade * 1.15), add(mid + side * half - lift * rise * .5, col * shade * .8)))
        end = add(tip, col * 1.3)
        for (l0, c0_, r0), (l1, c1, r1) in zip(made_rows, made_rows[1:]):
            top_way = np.cross(np.array(out_v[r1]) - np.array(out_v[l0]), np.array(out_v[l1]) - np.array(out_v[l0]))
            top_way = top_way if top_way @ (up + out) >= 0 else -top_way
            for f in ((l0, c0_, c1), (l0, c1, l1), (c0_, r0, r1), (c0_, r1, c1)):
                face(*f, top_way)
            for f in ((l0, l1, r1), (l0, r1, r0)):
                face(*f, -top_way)
        l1, c1, r1 = made_rows[-1]
        top_way = np.cross(np.array(out_v[r1]) - np.array(out_v[l1]), np.array(out_v[end]) - np.array(out_v[l1]))
        top_way = top_way if top_way @ (up + out) >= 0 else -top_way
        for f in ((l1, c1, end), (c1, r1, end)):
            face(*f, top_way)
        face(l1, r1, end, -top_way)
        kept += 1
        kept_area += area[part].sum()

if STYLE == 'cactus':
    # A saguaro has no leaves to find and no trunk apart from its body. Cutting the body
    # into pieces by position, the first try, tilted each piece its own way: a zig-zag.
    # So the main column stands straight up from the body's foot -- the measured axis bent
    # toward the arms -- and each arm is found as the body standing out from it, joined
    # faces big enough to see: a bend out, then a column up.
    zs = centre[:, 2]
    foot_ = zs < lo[2] + H * .2
    xy0 = np.median(centre[foot_, :2], 0) if foot_.any() else (lo[:2] + hi[:2]) / 2
    dist = np.linalg.norm(centre[:, :2] - xy0, axis=1)
    ax_at = lambda z: np.tile(xy0, (len(z), 1))
    r0 = float(np.percentile(dist[foot_ & (zs > lo[2] + H * .04)], 60)) if foot_.any() else H * .06
    body_col = np.average(colour, axis=0, weights=area + 1e-9)

    def tube(path, w, sides, side=None):
        # `side` holds one sideways direction through a bend: a frame turned by the bend's
        # own direction pinched the arm at its elbow.
        rows = []
        for n_, p_ in enumerate(path):
            a_ = path[min(n_ + 1, len(path) - 1)] - path[max(n_ - 1, 0)]
            a_ = a_ / (np.linalg.norm(a_) + 1e-9)
            x_ = side if side is not None else np.cross(a_, up if abs(a_[2]) < .9 else np.array([1., 0, 0]))
            x_ = x_ / (np.linalg.norm(x_) + 1e-9)
            y_ = np.cross(a_, x_)
            shade = .8 + .28 * n_ / max(1, len(path) - 1)
            rows.append([add(p_ + (x_ * math.cos(i * math.tau / sides) + y_ * math.sin(i * math.tau / sides)) * w, body_col * shade) for i in range(sides)])
        for n_ in range(len(rows) - 1):
            for i in range(sides):
                j = (i + 1) % sides
                way = (np.array(out_v[rows[n_][i]]) + np.array(out_v[rows[n_][j]])) / 2 - path[n_]
                face(rows[n_][i], rows[n_][j], rows[n_ + 1][j], way, 1)
                face(rows[n_][i], rows[n_ + 1][j], rows[n_ + 1][i], way, 1)
        for ends, row, sign in ((path[-1] - path[-2], rows[-1], .7), (path[0] - path[1], rows[0], .15)):
            ends = ends / (np.linalg.norm(ends) + 1e-9)
            cap = add(np.array(out_v[row[0]]) * 0 + (path[-1] if row is rows[-1] else path[0]) + ends * w * sign, body_col * (1.15 if sign > .5 else .75))
            for i in range(sides):
                face(row[i], row[(i + 1) % sides], cap, ends, 1)

    near_axis = dist < r0 * 1.3
    top_z = float(np.percentile(zs[near_axis], 99.5)) if near_axis.any() else hi[2]
    tube([np.array([*ax_at(np.array([z]))[0], z]) for z in np.linspace(lo[2], top_z - r0 * .7, 5)], r0 * 1.02, 8)
    kept += 1
    stand_out = np.where(dist > r0 * 1.5)[0]
    root[:] = range(len(root))
    for f in stand_out:
        a_, b_, c_ = weld[tri[f]]
        root[find(b_)] = find(a_)
        root[find(c_)] = find(a_)
    arms = {}
    for f in stand_out:
        arms.setdefault(find(weld[tri[f][0]]), []).append(int(f))
    for arm in sorted(arms.values(), key=lambda p: -area[p].sum())[:CACTUS_ARMS]:
        if area[arm].sum() < area.sum() * .02:
            continue
        pts = centre[arm]
        low_ = pts[pts[:, 2] <= np.percentile(pts[:, 2], 8)].mean(0)
        top_ = pts[pts[:, 2] >= np.percentile(pts[:, 2], 97)].mean(0)
        upper = pts[pts[:, 2] > low_[2] + (top_[2] - low_[2]) * .4]
        xy = np.median(upper[:, :2], 0) if len(upper) > 3 else top_[:2]
        # Only the arm's outer faces stand out, so their spread reads thin: PLACED floor.
        rr = max(float(np.percentile(np.linalg.norm(upper[:, :2] - xy, axis=1), 70)) if len(upper) > 3 else 0, r0 * .6)
        base = np.array([*ax_at(np.array([low_[2]]))[0], low_[2]])
        elbow = np.array([xy[0], xy[1], low_[2] + rr * .6])
        reach = np.array([xy[0] - base[0], xy[1] - base[1], 0.])
        tube([base, (base + elbow) / 2 + np.array([0, 0, rr * .2]), elbow, np.array([xy[0], xy[1], (elbow[2] + top_[2]) / 2]), np.array([xy[0], xy[1], top_[2] - rr * .7])], rr, 6, np.cross(reach, up))
        kept += 1
        kept_area += area[arm].sum()

# The trunk: a tube of the measured radius, each ring its own colour.
wood = trunk & red
low = wood & (centre[:, 2] < lo[2] + H * .12)
foot = float(np.percentile(dist[low], 70)) if low.any() else H * .02
rings = []
for s in (FROND_RINGS if STYLE == 'fronds' else [] if STYLE == 'cactus' else TRUNK_RINGS):
    z = lo[2] + H * .985 * s
    if STYLE == 'fronds':
        # A palm's trunk keeps its width right up to the hub, and its rings are close
        # enough to follow a coconut palm's bow without a kink.
        z = lo[2] + (hub_z - lo[2]) * s
    near = wood & (np.abs(centre[:, 2] - z) < H * .06)
    bark = colour[near].mean(0) if near.any() else (colour[wood].mean(0) if wood.any() else np.array([.3, .15, .1]))
    # Straight between the foot and the crown: limbs and flare pulled the measured line about.
    c = ax_at(np.array([np.clip(z, lo[2] + H * .985 * .07, max(hub_z or tree.crown_base, lo[2] + H * .985 * .07)) if STYLE in ('tufts', 'skirts', 'fronds') else z]))[0]
    if s == 1 and STYLE == 'fronds':
        rings.append([add((c[0], c[1], hub_z), bark)])
        continue
    if s == 1:
        # Under tufts the tube ends inside the crown: its tip showed as a spike above them.
        rings.append([add((c[0], c[1], lo[2] + H * .88 if STYLE in ('tufts', 'skirts') else hi[2]), bark)])
        continue
    r = float(rad_at(np.array([z]))[0]) * (1.12 if s == 0 else 1.05)
    if STYLE in ('tufts', 'skirts'):
        # A tree that forks low measures its whole fork as trunk, and read_tree carries that
        # width down to the ground, so the tube tapers from the wood at the foot instead.
        r = min(r, foot * (1.12 if s == 0 else 1) * (1 - s) ** .6 + H * .002)
    if STYLE == 'fronds':
        r = min(r, foot * (1.12 if s == 0 else 1) * (1 - .3 * s))
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
    if not len(chosen):
        continue  # a cactus is all body: no leaves part
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
# Side by side with room for a wide tree: a broad oak or cypress, framed by height
# alone, ran off the picture and overlapped its far version (batch two, 7 November 2026).
W = hi[0] - lo[0]
gap = max(H * .3, W * .58)
full.location = (-gap - cx[0], -cx[1], 0)
far.location = (gap - cx[0], -cx[1], 0)
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
cam.data.ortho_scale = max(H * 1.12, (2 * gap + W) * 1.06)
cam.location = (0, -H * 4, lo[2] + H * .5)
cam.rotation_euler = (math.pi / 2, 0, 0)
s.render.filepath = stem + '_compare.png'
bpy.ops.render.render(write_still=True)
