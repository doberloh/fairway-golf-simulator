# THE DESERT RESORT PACK (the owner, 5 November 2026; docs/studies/desertresort/
# PLAN.md, local): what the Las Vegas valley's watered courses have that the
# deserts pack does not. Everything else on them is reused: Aleppo pine, olive,
# mesquite, the palms, oleander, bougainvillea, creosote.
#
#   node tools/blender/iterate.mjs cartoon_resort <round> [--season s] [--far]
#
# Silhouette first: the Afghan pine is a straight dark column of a tree, a tall
# cone when young and an upright, irregular, open spire when old -- never the
# Aleppo's leaning round head beside it. The African sumac is a dense low dome on
# a short dark trunk with a fringe of drooping tips. (Since 9 November 2026 the game's
# African sumac is Meshy's, tools/meshy/desertres.json; `africansumac` below stays as the
# record and is no longer exported.) Pampas grass is a fountain of
# long arching leaves with cream plumes standing well above it.
#
# REFS afghanpine=Blender_AfghanPine_1,Blender_AfghanPine_2
# REFS pampasgrass=Blender_PampasGrass_1,Blender_PampasGrass_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
O = Vector((0, 0, 0))
X1 = Vector((1, 0, 0))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def at(pts, t):
    i = max(0, min(len(pts) - 1, int(round(t * (len(pts) - 1)))))
    return i, pts[i]


def olump(mesh, rng, q, radii, xdir, role, shade=None, c=None, flex=.6, u=8, v=5, jitter=.12, zup=UP, blend=.7):
    """A cheap jittered u-by-v lump turned so its local x runs along `xdir`."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
    if ct.FAR:
        u, v = max(4, u // 2 + 1), 3
    X = xdir.normalized()
    Y = zup.cross(X)
    if Y.length < 1e-4:
        Y = Vector((0, 1, 0)).cross(X)
    Y.normalize()
    Z = X.cross(Y)
    rx, ry, rz = radii

    def put(lx, ly, lz):
        w = q + X * lx + Y * ly + Z * lz
        vt = mesh.bm.verts.new(w)
        n = (X * (lx / rx ** 2) + Y * (ly / ry ** 2) + Z * (lz / rz ** 2)).normalized()
        if c is not None:
            out = w - c
            out = out.normalized() if out.length > 1e-6 else UP
            n = (n * (1 - blend) + out * blend).normalized()
        mesh.normal[vt] = n
        m = shade(w, n) if shade else 1.0
        mesh.paint[vt] = (m, m, m, flex)
        return vt
    top = put(0, 0, rz)
    bot = put(0, 0, -rz)
    rings = []
    for i in range(1, v):
        phi = math.pi / 2 - i / v * math.pi
        ring = []
        for k in range(u):
            a = k / u * math.tau
            r = 1 + rng.uniform(-jitter, jitter)
            ring.append(put(math.cos(phi) * math.cos(a) * rx * r, math.cos(phi) * math.sin(a) * ry * r,
                            math.sin(phi) * rz * r))
        rings.append(ring)
    faces = []
    for k in range(u):
        k1 = (k + 1) % u
        faces.append(mesh.bm.faces.new((top, rings[0][k], rings[0][k1])))
        for i in range(len(rings) - 1):
            a, b = rings[i], rings[i + 1]
            faces.append(mesh.bm.faces.new((a[k], b[k], b[k1], a[k1])))
        faces.append(mesh.bm.faces.new((bot, rings[-1][k1], rings[-1][k])))
    for f in faces:
        f.material_index = idx
        f.smooth = True


def tufts(mesh, rng, q, s, c, shade, squash=.75, jitter=.25, flex=.8):
    """A needle mass: three small ragged lumps, not one smooth ball."""
    for k in range(3):
        a = k / 3 * math.tau + rng.uniform(-.4, .4)
        p = q + heading(a) * s * .45 + UP * s * squash * rng.uniform(-.2, .3)
        r = s * rng.uniform(.62, .76)
        olump(mesh, rng, p, (r, r, r * squash), X1, 'leaf', shade, c, flex=flex, u=7, v=4, jitter=.38, blend=.35)


def frame(d):
    d = d.normalized()
    s = d.cross(UP)
    if s.length < 1e-4:
        s = d.cross(Vector((1, 0, 0)))
    s.normalize()
    return d, s, s.cross(d)


def blade(mesh, pts, w, role, m0=.8, m1=1.1, f0=.3, f1=.9):
    """A tapering three-sided leaf along `pts` to a point."""
    idx = mesh.slot(role)
    n = len(pts) - 1
    rings = []
    for i in range(n):
        t = i / n
        d, s, u = frame(pts[i + 1] - pts[i])
        r = w * (1 - t) ** .8
        ring = [pts[i] + u * r * .3 + s * r, pts[i] - u * r, pts[i] + u * r * .3 - s * r]
        vs = [mesh.bm.verts.new(p) for p in ring]
        m, f = m0 + (m1 - m0) * t, f0 + (f1 - f0) * t
        for v in vs:
            mesh.paint[v] = (m, m, m, f)
        rings.append(vs)
    tip = mesh.bm.verts.new(pts[-1])
    mesh.paint[tip] = (m1, m1, m1, f1)
    faces = []
    for a, b in zip(rings, rings[1:]):
        for k in range(3):
            k1 = (k + 1) % 3
            faces.append(mesh.bm.faces.new((a[k], a[k1], b[k1], b[k])))
    for k in range(3):
        faces.append(mesh.bm.faces.new((rings[-1][k], rings[-1][(k + 1) % 3], tip)))
    for f in faces:
        f.material_index = idx
        f.smooth = True


# ---------------------------------------------------------------- Afghan pine
def afghanpine(height, spread, masses, base):
    """A straight trunk inside a full egg of layered needle masses, dense to
    `base` (a share of the height), the outline broken by masses standing proud
    of it; a dark core behind so no sky shows through the middle."""
    def build(mesh, rng):
        H, R = height, spread * .5
        lean = heading(rng.uniform(0, math.tau)) * H * .03
        pts, radii = ct.trunk(mesh, rng, O, H * .92, H * .024, lean=lean, steps=8, sides=8, flare=1.35, bend=H * .008,
                              shade_low=.7, shade_high=.92)
        c = UP * H * (base + (1 - base) * .46)
        shade = ct.crown_shade(c, (R, R, H * .5), low=.42, high=1.12)
        span = 1 - base
        # The core: a few dark lumps up the middle.
        for k in range(5):
            t = (k + .5) / 5
            z = H * (base + span * t)
            r = R * .46 * math.sin(math.pi * t ** .7) + R * .08
            olump(mesh, rng, UP * z, (r, r, H * span * .16), X1, 'leaf', lambda w, n: .5, c, flex=.3, u=8, v=4, jitter=.14,
                  blend=.5)
        a0 = rng.uniform(0, math.tau)
        for k in range(masses):
            t = ((k + .5) / masses) ** .9
            z = H * (base + span * t)
            # The egg: widest about a third of the way up, rounded at the top.
            r = R * math.sin(math.pi * min(1, t ** .55 * .96 + .04))
            a = a0 + k * 2.399 + rng.uniform(-.25, .25)
            q = UP * z + lean * (z / H) + heading(a) * r * rng.uniform(.5, .94)
            s = H * rng.uniform(.06, .085) * (1.16 - .42 * t)
            tufts(mesh, rng, q, s, c, shade, squash=.82)
            if k % 4 == 0 and t < .8:
                i, p = at(pts, base + span * t * .9)
                ct.limb(mesh, rng, p, q, radii[i] * .3, radii[i] * .1, sides=4, bow=.06)
    return build


# -------------------------------------------------------------- African sumac
def africansumac(height, spread, stems, lobes):
    """A short dark trunk forking low into leaning stems that carry a broad
    crown of two or three rounded lobes, fine and airy: many small leafy tufts
    with the limbs seen under them and sky between the lobes."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .62
        shade = ct.crown_shade(c, (R, R, H * .4), low=.46, high=1.16)
        pts, radii = ct.trunk(mesh, rng, O, H * .26, H * .05, lean=drift(rng, H * .05), steps=4, sides=7, flare=1.35,
                              shade_low=.62, shade_high=.8)
        a0 = rng.uniform(0, math.tau)
        centres = []
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            end = pts[-1] + heading(a) * R * rng.uniform(.3, .42) + UP * H * rng.uniform(.26, .38)
            ct.limb(mesh, rng, pts[-1], end, radii[-1] * .62, H * .012, sides=5, bow=.15)
            if s < lobes:
                centres.append(end + UP * H * .17)
        each = 60 // lobes
        for lobe in centres:
            r0 = R * .62
            olump(mesh, rng, lobe, (r0 * .84, r0 * .84, r0 * .74), X1, 'leaf', lambda w, n: .56, c, flex=.4, u=8, v=5, jitter=.16, blend=.5)
            for k in range(each):
                z = 1 - 2 * (k + .5) / each
                z = z * .92 + .03
                a = k * 2.399 + rng.uniform(-.2, .2)
                q = lobe + heading(a) * r0 * math.sqrt(max(0, 1 - z * z)) * rng.uniform(.74, .96) + UP * r0 * .78 * z
                s = R * rng.uniform(.1, .15)
                tufts(mesh, rng, q, s, c, shade, squash=.8, flex=.9)
    return build


# --------------------------------------------------------------- pampas grass
def pampasgrass(height, spread, leaves, plumes):
    """A dense low mound of very long fine arching leaves falling outward to the
    ground, and over it a fan of many thin cream plumes on straight stems."""
    def build(mesh, rng):
        H, R = height, spread * .5
        olump(mesh, rng, UP * H * .06, (R * .82, R * .82, H * .36), X1, 'leaf', lambda w, n: .42 + .22 * min(1, w.z / (H * .4)), None, flex=.2, u=10, v=6, jitter=.06)
        for k in range(leaves):
            a = k * 2.399 + rng.uniform(-.3, .3)
            d = heading(a)
            top = H * rng.uniform(.34, .5)
            reach = R * rng.uniform(.8, 1.12)
            start = rng.uniform(.0, .75)
            root = d * R * start * .7 + UP * H * (.42 - .3 * start * start)
            p4 = d * reach + UP * H * rng.uniform(.0, .12)
            mid = root + (p4 - root) * .5 + UP * H * rng.uniform(.1, .17)
            p1 = root + (mid - root) * .5 + UP * H * .05
            p3 = mid + (p4 - mid) * .55 + UP * H * .01
            blade(mesh, [root, p1, mid, p3, p4], H * .018, 'leaf', m0=.7, m1=1.14)
        for k in range(leaves // 3):
            a = k * 2.399 * 1.3 + rng.uniform(-.3, .3)
            d = heading(a)
            root = d * R * rng.uniform(.5, .74) + UP * H * rng.uniform(.14, .26)
            tip = d * R * rng.uniform(.96, 1.26)
            blade(mesh, [root, root + (tip - root) * .4 + UP * H * .05, root + (tip - root) * .78, tip], H * .016, 'leaf', m0=.66, m1=1.1)
        for k in range(plumes):
            a = k * 2.399 + rng.uniform(-.2, .2)
            d = heading(a)
            out = math.sqrt((k + .5) / plumes)
            root = d * R * .12 * out
            tall = H * (1.0 - .24 * out ** 2) * rng.uniform(.93, 1.02)
            head = root + d * R * .98 * out + UP * tall
            along = (head - root).normalized()
            L = H * rng.uniform(.13, .17)
            ct.limb(mesh, rng, root, head - along * L * 1.8, H * .005, H * .003, sides=3, bow=.02)
            olump(mesh, rng, head - along * L, (L, H * .032, H * .032), along, 'accent', None, None, flex=1.0, u=6, v=5, jitter=.2)
    return build


MODELS = [
    ('Blender_AfghanPine_1', afghanpine(16, 10.5, 54, .16)),
    ('Blender_AfghanPine_2', afghanpine(11, 8, 46, .08)),
    ('Blender_PampasGrass_1', pampasgrass(3.2, 3.2, 150, 32)),
    ('Blender_PampasGrass_2', pampasgrass(2.5, 2.4, 120, 24)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'AfghanPine': '#6a5c50', 'AfricanSumac': '#4a3c34', 'PampasGrass': '#8a8a60'}
LOOK = {
    'AfghanPine': {'spring': ('#47703f', None), 'summer': ('#3f6438', None), 'autumn': ('#3f6438', None), 'winter': ('#3c5e38', None)},
    'AfricanSumac': {'spring': ('#6a8a4a', None), 'summer': ('#5c7c44', None), 'autumn': ('#5c7c44', None), 'winter': ('#587640', None)},
    'PampasGrass': {'spring': ('#6a8a50', '#b8b088'), 'summer': ('#6a8a50', '#e8dcc0'), 'autumn': ('#7a8a58', '#e8dcc0'), 'winter': ('#7a8a58', '#dccfae')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        leaf, accent = LOOK[sp][season]
        t = {'leaf': hexrgb(leaf), 'bark': hexrgb(BARK[sp])}
        if accent:
            t['accent'] = hexrgb(accent)
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.30, 0.42, 0.24), 'bark': (0.45, 0.40, 0.33), 'accent': (0.80, 0.75, 0.60)},
          far={'Blender_AfghanPine_1', 'Blender_AfghanPine_2'},
          tints=tints(SEASON))
