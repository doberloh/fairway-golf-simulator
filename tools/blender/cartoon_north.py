# THE NORTH PACK (the US landscapes goal, 2 November 2026; PLAN.md section
# 5, local): what the North Woods (the Minnesota and Wisconsin lakes), the
# Pacific links (the Oregon Dunes) and Alaska lacked -- red pine, jack pine,
# tamarack, black spruce, Sitka spruce, shore pine, fireweed, devil's club,
# cottongrass, a lakeside log cabin and a wooden dock.
#
#   node tools/blender/iterate.mjs cartoon_north <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026). The game already has white
# pine (flat separated shelves), paper birch, balsam fir (a dense dark spire
# to the ground), spruce, blue spruce (a broad silver cone to the ground),
# lodgepole (a tall pole, dead stubs, a narrow uneven crown), hemlock,
# willow thicket and lupine. So: the red pine is a long clean orange pole
# under a high ROUNDED dome of pom-pom tufts on upswept limbs; the jack pine
# a crooked scraggly stem with an open, gappy, lopsided crown of sparse
# tufts and dead twigs; the tamarack an airy light-green narrow cone of fine
# wisps with sky and limbs through it; the black spruce a spindly stick
# with short drooping tufts down it, a skirt at its foot and a club-shaped
# knot at the top; the Sitka spruce a huge buttressed trunk under a broad
# ragged cone of drooping sprays swept to the lee; the shore pine a twisted
# leaning trunk under a dense, flat-topped, wind-pressed crown.
#
# REFS redpine=Blender_RedPine_1,Blender_RedPine_2
# REFS jackpine=Blender_JackPine_1
# REFS tamarack=Blender_Tamarack_1
# REFS blackspruce=Blender_BlackSpruce_1,Blender_BlackSpruce_2
# REFS sitkaspruce=Blender_SitkaSpruce_1
# REFS shorepine=Blender_ShorePine_1,Blender_ShorePine_2
# REFS fireweed=Blender_Fireweed_1
# REFS devilsclub=Blender_DevilsClub_1
# REFS cottongrass=Blender_Cottongrass_1
# REFS logcabin=Blender_LogCabin_1
# REFS dock=Blender_Dock_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
V = Vector
V0 = Vector((0, 0, 0))
WIND = Vector((1, 0, 0))   # the lee: wind-sheared trees sweep toward +X


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def bez(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(p0 * (u * u * u) + p1 * (3 * u * u * t) + p2 * (3 * u * t * t) + p3 * (t * t * t))
    return out


def turn(v, a):
    """v turned by a radians about Z."""
    c, s = math.cos(a), math.sin(a)
    return Vector((v.x * c - v.y * s, v.x * s + v.y * c, v.z))


def along(pts, z):
    """The point of a polyline (rising) at height z."""
    for a, b in zip(pts, pts[1:]):
        if b.z >= z:
            t = (z - a.z) / max(1e-6, b.z - a.z)
            return a.lerp(b, max(0.0, min(1.0, t)))
    return pts[-1].copy()


def sc(m, k):
    return tuple(x * k for x in m) if isinstance(m, tuple) else m * k


def plates(lo, hi):
    """Bark shade with patches (plates), brighter going up."""
    def f(co, t):
        n = (math.sin(co.x * 37.1 + co.y * 17.3 + co.z * 11.7) * 43758.5) % 1.0
        return (lo + (hi - lo) * t) * (.84 + .3 * n)
    return f


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06, paint=None):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=paint or (lambda co, t: shade[0] + (shade[1] - shade[0]) * t), flex=lambda co, t: .1 + .4 * t)
    return radii


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered (cartoon_texas)."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
    if ct.FAR:
        u, v = max(4, u // 2 + 1), 3
    top = mesh.bm.verts.new(center + Vector((0, 0, radii[2])))
    bot = mesh.bm.verts.new(center - Vector((0, 0, radii[2])))
    rings = []
    for i in range(1, v):
        phi = math.pi / 2 - i / v * math.pi
        ring = []
        for k in range(u):
            a = k / u * math.tau
            r = 1 + rng.uniform(-jitter, jitter)
            ring.append(mesh.bm.verts.new(center + Vector((math.cos(phi) * math.cos(a) * radii[0] * r,
                                                           math.cos(phi) * math.sin(a) * radii[1] * r,
                                                           math.sin(phi) * radii[2] * r))))
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
    out = [top, bot] + [x for ring in rings for x in ring]
    for x in out:
        n = x.co - center
        mesh.normal[x] = Vector((n.x / radii[0] ** 2, n.y / radii[1] ** 2, n.z / radii[2] ** 2)).normalized()
    return out


def ball(mesh, rng, q, radii, c, shade, flex=.8, role='leaf', jitter=.2, u=8, v=5, bend=.6, bright=1.0):
    for x in lowball(mesh, q, radii, role, rng, u, v, jitter):
        out = x.co - c
        out = out.normalized() if out.length > 1e-6 else UP
        n = (mesh.normal[x] * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = shade(x.co, n) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0] * bright, mm[1] * bright, mm[2] * bright, flex)


def facing(mesh, pts, role, out, shade=1.0, flex=0.0):
    """A one-sided polygon wound so its front faces `out` (cartoon_plains)."""
    n = Vector((0, 0, 0))
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n += a.cross(b)
    if n.dot(out) < 0:
        pts = list(reversed(pts))
    f = mesh.face(pts, role)
    s = shade if isinstance(shade, tuple) else (shade, shade, shade)
    for v in f.verts:
        mesh.paint[v] = (*s, flex)
    return f


def twosided(mesh, pts, role, nrm, shade=1.0, flex=0.0):
    facing(mesh, pts, role, nrm, shade, flex)
    facing(mesh, pts, role, -nrm, sc(shade, .8), flex)


def box(mesh, lo, hi, role, shade=1.0, top=True, sides=(1, 1, 1, 1)):
    """An axis box; `sides` (-Y, +X, +Y, -X) which walls (cartoon_plains)."""
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    c = [V((x0, y0, 0)), V((x1, y0, 0)), V((x1, y1, 0)), V((x0, y1, 0))]
    outs = [V((0, -1, 0)), V((1, 0, 0)), V((0, 1, 0)), V((-1, 0, 0))]
    lit = (1.0, .82, .78, .94)
    for i in range(4):
        if not sides[i]:
            continue
        j = (i + 1) % 4
        facing(mesh, [c[i] + V((0, 0, z0)), c[j] + V((0, 0, z0)), c[j] + V((0, 0, z1)), c[i] + V((0, 0, z1))], role,
               outs[i], shade=shade * lit[i])
    if top:
        facing(mesh, [p + V((0, 0, z1)) for p in c], role, UP, shade=shade * 1.05)


def prism(mesh, prof, a0, a1, axis, role, shade=1.0):
    """A convex profile swept straight along 'x' or 'y' (cartoon_plains)."""
    def at(u, z, a):
        return V((a, u, z)) if axis == 'x' else V((u, a, z))
    cu = sum(p[0] for p in prof) / len(prof)
    cz = sum(p[1] for p in prof) / len(prof)
    n = len(prof)
    for i in range(n):
        (u0, z0), (u1, z1) = prof[i], prof[(i + 1) % n]
        out = at((u0 + u1) / 2 - cu, (z0 + z1) / 2 - cz, 0)
        s = shade * (.8 + .25 * max(0.0, out.normalized().z))
        facing(mesh, [at(u0, z0, a0), at(u1, z1, a0), at(u1, z1, a1), at(u0, z0, a1)], role, out, shade=s)
    ax = V((1, 0, 0)) if axis == 'x' else V((0, 1, 0))
    facing(mesh, [at(u, z, a0) for u, z in prof], role, -ax, shade=shade * .92)
    facing(mesh, [at(u, z, a1) for u, z in prof], role, ax, shade=shade * .85)


# ---------------------------------------------------------------- red pine

def redpine(height, spread, whorls, crown):
    """Red pine: a long, straight, clean orange-red trunk in plates, a few
    pruned stubs, and only at the top (`crown`, a share of the height) a
    high ROUNDED dome: short upswept limbs ending in pom-pom tufts of long
    needles, the outline a lumpy oval with a round top, not a spire."""
    def build(mesh, rng):
        H, R = height, spread * .5
        lean = drift(rng, H * .008)
        pts = [lean * (i / 7) ** 2 + UP * H * .96 * i / 7 for i in range(8)]
        r0 = H * .017
        radii = [r0 * (1 - .6 * i / 7) * (1 + .4 * math.exp(-i * 3)) for i in range(8)]
        mesh.add_tube(pts, radii, 8, 'bark', rng=rng, wobble=.04, shade=plates(.72, 1.12),
                      flex=lambda co, t: .12 * t * t)
        z0 = H * (1 - crown)
        c = along(pts, z0 + (H - z0) * .5)
        shade = ct.crown_shade(c, (R, R, (H - z0) * .5), low=.45, high=1.18)
        sr = random.Random(rng.random())
        if not ct.FAR:
            for k in range(4):
                z = H * sr.uniform(.3, max(.32, (1 - crown) - .06))
                p = along(pts, z)
                ct.limb(mesh, sr, p, p + heading(sr.uniform(0, math.tau)) * H * .025 + UP * H * .006, H * .004,
                        H * .0015, sides=4, bow=0)
        a0 = rng.uniform(0, math.tau)
        for i in range(whorls):
            t = i / (whorls - 1)
            z = z0 + (H * .9 - z0) * t
            p = along(pts, z)
            env = R * math.sin(math.pi * (.2 + .7 * t)) ** .6
            n = 4 if t < .7 else 3
            # Round 2: longer limbs, each ending in a cluster of small
            # separate pom-poms, so the crown is lumpy and open, not a ball.
            for k in range(n):
                a = a0 + k / n * math.tau + i * 1.1 + rng.uniform(-.4, .4)
                d = heading(a)
                reach = env * rng.uniform(.62, 1.1)
                end = p + d * reach + UP * reach * .45
                if not ct.FAR:
                    bark_tube(mesh, rng, [p, p.lerp(end, .5) + UP * reach * .06, end], H * .006, H * .002, 4)
                sd = Vector((-d.y, d.x, 0))
                for m, (o, f) in enumerate(((0, 1.0), (1, .8), (-1, .75))):
                    s = R * .2 * f * rng.uniform(.9, 1.1)
                    q = end - d * s * .4 * abs(o) + sd * o * s * .9 + UP * (s * .25 - abs(o) * s * .35)
                    ball(mesh, rng, q, (s, s, s * .8), c, shade, jitter=.25, u=7, v=4, bend=.45)
        top = along(pts, H * .94)
        for k in range(2):
            s = R * .24
            ball(mesh, rng, top + heading(a0 + k * 3.1) * R * .15 + UP * s * .3, (s, s, s * .85), c, shade, jitter=.22,
                 bend=.45)
    return build


# ---------------------------------------------------------------- jack pine

def jackpine(height, spread, seed_lean):
    """Jack pine: a crooked stem kinking as it climbs, an open, scraggly,
    lopsided crown from a quarter of the height: irregular limbs, some dead
    and bare, sparse small tufts at their ends with sky between, curved grey
    cones held on the limbs (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        lean = heading(rng.uniform(0, math.tau))
        n = 7
        pts = [V0.copy()]
        for i in range(1, n + 1):
            t = i / n
            pts.append(UP * H * .95 * t + lean * H * seed_lean * math.sin(t * 2.6) + drift(rng, H * .022))
        bark_tube(mesh, rng, pts, H * .022, H * .004, 7, shade=(.72, 1.0), wobble=.1)
        c = UP * H * .6
        shade = ct.crown_shade(c, (R, R, H * .42), low=.42, high=1.15)
        cr = random.Random(rng.random())
        for i in range(2, n + 1):
            base = pts[i]
            t = i / n
            m = 4 if t < .8 else 2
            # Round 2: more limbs, smaller rounder ragged tufts (two or three
            # along each), so the crown is bushy-scraggly, not flat pads.
            for k in range(m):
                d = heading(rng.uniform(0, math.tau))
                reach = R * (1.0 - .5 * t) * rng.uniform(.5, 1.1)
                dead = rng.random() < .2 and t < .6
                end = base + d * reach + UP * reach * rng.uniform(.2, .7) + drift(rng, .3)
                mid = base.lerp(end, .5) + drift(rng, reach * .15) + UP * reach * .05
                bark_tube(mesh, rng, [base, mid, end], H * .006, H * .0015, 4, wobble=.1)
                if dead:
                    continue
                # Round 4: the needles clothe the outer half of each limb as a
                # ragged bottle-brush of overlapping small tufts -- separate
                # balls read as broad leaves.
                s = R * rng.uniform(.12, .15)
                for f in (.4, .55, .7, .85, 1.0):
                    if f < .5 and rng.random() < .5:
                        continue
                    s2 = s * (.75 + .25 * f) * rng.uniform(.9, 1.1)
                    q = (base.lerp(mid, f * 2) if f <= .5 else mid.lerp(end, (f - .5) * 2)) + UP * s2 * .25
                    ball(mesh, rng, q, (s2, s2, s2), c, shade, jitter=.26, u=7, v=4, bend=.5)
                if cr.random() < .5:
                    # Round 14: the persistent cones in pairs, a little
                    # bigger, so the grey knots show on the bare limbs.
                    for q in (base.lerp(mid, .6), base.lerp(mid, .6) + drift(cr, .12)):
                        ball(mesh, cr, q - UP * .05, (.09, .09, .12), c, None, flex=.3, role='accent', jitter=.1, u=5,
                             v=3, bend=.1)
        s = R * .18
        ball(mesh, rng, pts[-1] + UP * s * .5, (s, s, s * 1.3), c, shade, jitter=.25, u=7, v=4, bend=.4)
    return build


# ---------------------------------------------------------------- tamarack

def tamarack(height, spread, tiers):
    """Tamarack (eastern larch), from its spec alone (no pictures): a straight
    trunk to a fine tip, short level limbs whose ends droop, and on them small
    soft wisps of light-green needles -- a narrow, OPEN, airy cone, sky and
    limbs showing through; golden in autumn."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V0, H * .97, H * .015, lean=drift(rng, H * .01), steps=6, sides=7, flare=1.4,
                              shade_low=.75, shade_high=1.0)
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .45), low=.72, high=1.2, core=.85)
        a0 = rng.uniform(0, math.tau)
        for i in range(tiers):
            t = i / (tiers - 1)
            z = H * (.18 + .74 * t)
            p = along(pts, z)
            env = R * (1 - t) ** 1.1 + H * .02
            n = 3 if t < .6 else 2
            # Round 2: smaller, lighter wisps, three a limb, sky between.
            for k in range(n):
                a = a0 + i * ct.GOLDEN * 2 + k / n * math.tau + rng.uniform(-.3, .3)
                d = heading(a)
                reach = env * rng.uniform(.7, 1.05)
                end = p + d * reach - UP * reach * .12
                if not ct.FAR:
                    bark_tube(mesh, rng, [p, p.lerp(end, .5) + UP * reach * .05, end], H * .006, H * .002, 4)
                for f in (.4, .7, 1.0):
                    q = p.lerp(end, f) + UP * reach * (.04 - .1 * f * f)
                    s = max(.18, reach * .17) * rng.uniform(.85, 1.1)
                    ball(mesh, rng, q, (s * 1.1, s * 1.1, s * .75), c, shade, jitter=.35, u=6, v=4, bend=.4, bright=1.15)
        mesh.add_tube([along(pts, H * .9), pts[-1] + UP * H * .04], [H * .01, H * .002], 4, 'leaf', shade=lambda co, t: 1.1, flex=lambda co, t: .9)
    return build


# ---------------------------------------------------------------- black spruce

def blackspruce(height, width, club):
    """Black spruce: a spindly stick, crooked a little, with short drooping
    ragged tufts down its length (gaps between), a wider layered skirt at its
    foot, and near the top a dense club-shaped knot (`club` its size) on a
    thin neck -- the bottle-brush of the Alaska bogs."""
    def build(mesh, rng):
        H, W = height, width * .5
        pts, radii = ct.trunk(mesh, rng, V0, H * .95, H * .012, lean=drift(rng, H * .02), steps=6, sides=6, flare=1.3,
                              bend=H * .01, shade_low=.7, shade_high=.95)
        c = UP * H * .5
        shade = ct.crown_shade(c, (W, W, H * .5), low=.5, high=1.1, core=.75)
        ct.skirt(mesh, rng, UP * H * .07, W * 1.25, H * .1, points=7, droop=.5, shade=shade, ragged=.3, flex=.3, thick=.5)
        z = H * .14
        top = H * (.78 - .08 * club)
        while z < top:
            r = W * (1 - .45 * (z / H)) * rng.uniform(.6, 1.1)
            # Round 2: three-to-five ragged boughs, set off the stem a little,
            # so the tufts are irregular, not stacked stars.
            if rng.random() < .82:
                ct.skirt(mesh, rng, along(pts, z) + drift(rng, r * .25), r, H * .05, points=rng.randint(3, 5), droop=.6,
                         shade=shade, ragged=.45, flex=.3 + .5 * z / H, thick=.45, twist=rng.uniform(0, 1))
            z += H * rng.uniform(.045, .07)
        zc = H * (.84 + .02 * club)
        for k in range(5):
            q = along(pts, zc + H * (k - 2) * .02) + drift(rng, W * .15)
            s = W * (.5 + .2 * club) * (1.15 - .14 * k)
            ball(mesh, rng, q, (s, s, s * 1.2), c, shade, jitter=.25, u=8, v=5, bend=.4)
        mesh.add_tube([along(pts, H * .9), pts[-1] + UP * H * .05], [H * .01, H * .002], 4, 'leaf',
                      shade=lambda co, t: 1.05, flex=lambda co, t: .9)
    return build


# ---------------------------------------------------------------- Sitka spruce

def sitkaspruce(height, spread, flag):
    """Sitka spruce: a huge trunk on buttressed roots, clear for its lower
    third, then long level limbs, longer to the lee, hung with stiff
    drooping sprays -- a broad, ragged cone, its top swept to the lee
    (`flag`) by the sea wind."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V0, H * .95, H * .022, lean=WIND * H * .05 * flag, steps=8, sides=8, flare=2.3,
                              bend=H * .006, shade_low=.7, shade_high=1.0)
        if not ct.FAR:
            for k in range(4):
                d = heading(k / 4 * math.tau + rng.uniform(-.3, .3))
                ct.limb(mesh, rng, UP * H * .04, d * H * .055 - UP * .15, H * .016, H * .004, sides=5, bow=.1)
        z0 = H * .3
        c = along(pts, H * .62)
        shade = ct.crown_shade(c, (R, R, H * .35), low=.42, high=1.12)
        a0 = rng.uniform(0, math.tau)
        tiers = 7
        for i in range(tiers):
            t = i / (tiers - 1)
            z = z0 + (H * .9 - z0) * t
            p = along(pts, z)
            env = R * (1 - t) ** .6 + H * .03
            n = 4 if t < .5 else 3
            # Round 2: the windward limbs cut short, the lee ones long and
            # drooping, the upper tiers wide -- a sheared, flat-topped flag.
            for k in range(n):
                a = a0 + k / n * math.tau + i * 1.3 + rng.uniform(-.3, .3)
                d = heading(a)
                lee = d.dot(WIND)
                reach = env * rng.uniform(.8, 1.0) * max(.5, 1 + .6 * flag * lee)
                end = p + d * reach + UP * reach * (.12 if lee > 0 else .25) - UP * reach * .1 * max(0, lee)
                if not ct.FAR:
                    bark_tube(mesh, rng, [p, p.lerp(end, .5) + UP * reach * .04, end], H * .007, H * .002, 4)
                for f in (1.0, .68):
                    q = p.lerp(end, f) - UP * reach * .05
                    w = min(H * .085, max(H * .045, reach * (.38 if f == 1.0 else .27)))
                    ct.skirt(mesh, rng, q, w, w * .9, points=5, droop=.75, shade=shade, ragged=.35, flex=.6, thick=.5,
                             twist=rng.uniform(0, 1))
        s = H * .03
        ct.skirt(mesh, rng, pts[-1] + WIND * s * flag, s * 1.6, s * 2.2, points=5, droop=.4, shade=shade, ragged=.2,
                 flex=.9, thick=.5)
    return build


# ---------------------------------------------------------------- shore pine

def shorepine(height, spread, lean, flat, deep=0):
    """Shore pine: a twisted trunk leaning to the lee, heavy contorted limbs
    reaching out mostly that way, and a dense, dark crown of tufts pressed
    flat on top by the wind (`flat` 0..1), its windward side cut back."""
    def build(mesh, rng):
        H, R = height, spread * .5
        side = Vector((0, 1, 0)) * rng.choice((-1, 1))
        p0 = V0.copy()
        p3 = WIND * H * lean + UP * H * .62
        p1 = UP * H * .25 - WIND * H * .1 * lean + side * H * .06
        p2 = UP * H * .45 + WIND * H * lean * .2 - side * H * .08
        path = bez(p0, p1, p2, p3, 7)
        bark_tube(mesh, rng, path, H * .04, H * .018, 8, shade=(.7, .95), wobble=.14)
        c = p3 + UP * H * .12 + WIND * R * .15
        shade = ct.crown_shade(c, (R, R, H * .25), low=.38, high=1.1)
        a0 = rng.uniform(0, math.tau)
        top_z = H - R * .25 * flat
        nl = 8 + 6 * deep
        for i in range(nl):
            a = a0 + i / nl * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            lee = d.dot(WIND)
            reach = R * rng.uniform(.65, .9) * (1 + .5 * lee * lean * 3) * (.6 if lee < -.4 else 1.0) * (.75 if i >= 8 else 1.0)
            start = path[rng.randint(4, 7) if i < 8 else rng.randint(2, 4)]
            endz = min(top_z - R * .2, start.z + H * rng.uniform(.08, .22))
            k1 = start + d * reach * .4 + UP * (endz - start.z) * .7 + drift(rng, reach * .2)
            end = start + d * reach
            end.z = endz
            ct.limb(mesh, rng, start, k1, H * .016, H * .01, sides=5, bow=.1)
            ct.limb(mesh, rng, k1, end, H * .01, H * .004, sides=5, bow=-.15)
            # Round 2: clusters of smaller dense tufts, not single pads.
            sd = Vector((-d.y, d.x, 0))
            for q, s in ((end, R * .2), (end - d * R * .2 + sd * R * .18, R * .17), (end - d * R * .15 - sd * R * .18, R * .17),
                         (k1 + d * R * .1, R * .19))[:(2 if i >= 8 else 4)]:
                s *= rng.uniform(.9, 1.1) * (1 - .15 * deep)
                zz = min(q.z + s * .3, top_z - s * (.6 - .2 * flat))
                ball(mesh, rng, V((q.x, q.y, zz)), (s * 1.1, s * 1.1, s * (.85 - .25 * flat + .35 * deep)), c, shade, jitter=.28,
                     bend=.5)
        for k in range(6):
            s = R * .24 * (1 - .2 * deep)
            q = p3 + heading(a0 + k * (1.05 - .42 * deep)) * R * (.15 + .2 * (k % 2) + .1 * deep) + UP * deep * s * (k % 3 - 1) + WIND * R * .1
            ball(mesh, rng, V((q.x, q.y, top_z - s * (.6 - .15 * flat))), (s * 1.15, s * 1.15, s * (.8 - .25 * flat)), c,
                 shade, jitter=.28, bend=.5)
    return build


# ---------------------------------------------------------------- fireweed

def fireweed(height, stems):
    """A colony of fireweed: straight stems in narrow willowy leaves, each
    topped by a tapering spike of magenta florets (accent), widest at its
    foot and tapering to buds."""
    def build(mesh, rng):
        for s in range(stems):
            a = s * ct.GOLDEN + rng.uniform(-.3, .3)
            base = heading(a) * .09 * math.sqrt(s)
            h = height * rng.uniform(.75, 1.0)
            top = base + heading(a) * h * .05 + UP * h
            mesh.add_tube([base, base.lerp(top, .5), top], [.012, .009, .005], 4, 'leaf', rng=rng, wobble=.05,
                          shade=lambda co, t: .8 + .2 * t, flex=lambda co, t: .4 * t)
            for j in range(8):
                q = base.lerp(top, .06 + .07 * j)
                d = heading(a + j * 2.4)
                L = .22 * (1 - .4 * j / 8)
                tip = q + d * L + UP * L * .45
                mid = q.lerp(tip, .45)
                sd = Vector((-d.y, d.x, 0)) * L * .13
                twosided(mesh, [q, mid + sd, tip, mid - sd], 'leaf', (UP - d * .3).normalized(), shade=.95, flex=.6)
            sp0, sp1 = base.lerp(top, .58), top
            mesh.add_tube([sp0, sp0.lerp(sp1, .5), sp1], [.028, .02, .005], 4, 'accent', rng=rng, wobble=.12,
                          shade=lambda co, t: .9 + .2 * t, flex=lambda co, t: .5 + .5 * t)
            for j in range(4):
                f = j / 4
                q = sp0.lerp(sp1, .05 + .7 * f)
                sz = .042 * (1 - .5 * f)
                mesh.add_lump(q + heading(a + j * 2.4) * sz * 1.1, (sz, sz, sz * .7), 'accent', rng, subdiv=0, jitter=.15,
                              flex=.8, shade=lambda w, n: 1.05)
    return build


# ---------------------------------------------------------------- devil's club

def palm(mesh, rng, c, L, a, droop, lobes=7):
    """A big palmate leaf held flat: a star of `lobes` pointed lobes, cupped
    down at the rim by `droop`, two-sided."""
    rim = []
    for k in range(lobes * 2):
        b = a + k / (lobes * 2) * math.tau
        r = L * (1.0 if k % 2 == 0 else .55) * rng.uniform(.9, 1.05)
        p = c + heading(b) * r - UP * droop * (r / L) ** 2
        rim.append(p)
    hub = c + UP * L * .05
    # Round 10 (cost): one fan a side sharing its vertices -- three new
    # vertices a triangle had made the leaves 1,500 vertices for 600
    # triangles.
    idx = mesh.slot('leaf')
    for sh, nrm in ((1.0, UP), (.7, -UP)):
        vh = mesh.bm.verts.new(hub)
        vr = [mesh.bm.verts.new(p) for p in rim]
        for v in [vh] + vr:
            r = (v.co - c).length / L
            m = sh * (.85 + .25 * r)
            mesh.paint[v] = (m, m, m, .5 + .5 * r)
            mesh.normal[v] = nrm
        for k in range(len(vr)):
            tri = (vh, vr[k], vr[(k + 1) % len(vr)]) if sh == 1.0 else (vh, vr[(k + 1) % len(vr)], vr[k])
            f = mesh.bm.faces.new(tri)
            f.material_index = idx
            f.smooth = True


def devilsclub(height, spread, canes):
    """Devil's club: a few thick, spiny, crooked canes leaning out, each
    crowned by a parasol of huge flat maple-like leaves; a cone of scarlet
    berries (accent) stands over the leaves on the tallest canes."""
    def build(mesh, rng):
        fr = random.Random(rng.random())
        a0 = rng.uniform(0, math.tau)
        for k in range(canes):
            a = a0 + k / canes * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            h = height * (1.0 if k == 0 else rng.uniform(.6, .85))
            base = d * .08
            top = d * spread * rng.uniform(.15, .3) + UP * h
            mid = base.lerp(top, .5) + d * .12
            bark_tube(mesh, rng, [base, mid, top], .05, .03, 5, shade=(.75, 1.0), wobble=.1)
            for j in range(4):
                b = a + j / 4 * math.tau + rng.uniform(-.3, .3)
                e = heading(b)
                L = spread * rng.uniform(.22, .27)
                pc = top + e * L * .9 - UP * L * .15
                mesh.add_tube([top, pc + UP * L * .05], [.012, .008], 4, 'leaf', shade=lambda co, t: .8,
                              flex=lambda co, t: .5)
                palm(mesh, rng, pc, L, b + rng.uniform(0, 1), L * .25)
            if k < 2:
                for m in range(12):
                    f = m / 12
                    q = top + UP * (.08 + .4 * f) + heading(m * 2.4) * .08 * (1 - f)
                    mesh.add_lump(q, (.045, .045, .045), 'accent', fr, subdiv=0, jitter=.1, flex=.6,
                                  shade=lambda w, n: 1.0)
    return build


# ---------------------------------------------------------------- cottongrass

def cottongrass(height, heads):
    """Cottongrass: a tuft of fine sedge blades, and thin stalks over it each
    topped by a white ball of cotton (accent)."""
    def build(mesh, rng):
        ct.tuft(mesh, rng, V0, blades=10, height=height * .55, width=.012, spread=.15, lean=.3, low='leaf', tip='leaf')
        for k in range(heads):
            a = k * ct.GOLDEN + rng.uniform(-.3, .3)
            base = heading(a) * rng.uniform(0, .05)
            h = height * rng.uniform(.75, 1.0)
            top = base + heading(a) * h * .22 + UP * h * .97
            mesh.add_tube([base, base.lerp(top, .5) + drift(rng, .01), top], [.005, .004, .003], 3, 'leaf',
                          shade=lambda co, t: .9, flex=lambda co, t: t)
            mesh.add_lump(top + UP * .02, (.03, .03, .036), 'accent', rng, subdiv=1, jitter=.25, flex=1.0,
                          shade=lambda w, n: 1.05)
    return build


# ---------------------------------------------------------------- log cabin

def log(mesh, rng, a, b, r):
    k = rng.uniform(.82, 1.05)
    mesh.add_tube([a, b], [r * rng.uniform(.92, 1.05)] * 2, 6, 'bark', rng=rng, wobble=.03,
                  shade=lambda co, t: k, flex=lambda co, t: 0.0)


def logcabin(width, depth, deck):
    """A North Woods lake cabin: round logs crossed at the corners on a
    fieldstone sill, a steep gable roof whose ridge runs front to back, the
    log gable facing the lake (-Y) with big windows and a door onto an open
    deck on posts with a railing, log purlin ends under the front eave, a
    fieldstone chimney up the +X wall. Footprint width x (depth + deck)."""
    def build(mesh, rng):
        W, D, P = width, depth, deck
        x0, x1 = -W / 2, W / 2
        yd = -(D + P) / 2
        y0, y1 = yd + P, (D + P) / 2
        eave, sill = 3.0, .5
        pitch = .8
        ridge = eave + W / 2 * pitch
        box(mesh, (x0 - .05, y0 - .05, 0), (x1 + .05, y1 + .05, sill), 'stone', shade=.8)
        box(mesh, (x0 + .1, y0 + .1, sill), (x1 - .1, y1 - .1, eave), 'stone', shade=1.0, top=False)
        prism(mesh, [(x0 + .1, eave), (x1 - .1, eave), (0, ridge - .1)], y0 + .1, y1 - .1, 'y', 'stone', shade=1.0)
        rl = .15
        n = 9
        step = (eave - sill - 2 * rl) / (n - 1)
        for i in range(n):
            z = sill + rl + i * step
            for y in (y0, y1):
                e = .35 if i % 2 == 0 else .15
                log(mesh, rng, V((x0 - e, y, z)), V((x1 + e, y, z)), rl)
            for x in (x0, x1):
                e = .35 if i % 2 else .15
                log(mesh, rng, V((x, y0 - e, z + step * .5)), V((x, y1 + e, z + step * .5)), rl)
        z = eave + rl
        while z < ridge - .3:
            hw = (ridge - z) / pitch
            for y in (y0, y1):
                log(mesh, rng, V((-hw, y, z)), V((hw, y, z)), rl)
            z += step
        ovf, ovb, ov = 1.4, .5, .5
        t = .14
        for sgn in (-1, 1):
            xa, za = 0.0, ridge
            xb, zb = sgn * (W / 2 + ov), eave - ov * pitch
            prof = [(xa, za), (xb, zb), (xb, zb + t), (xa, za + t)]
            prism(mesh, prof, y0 - ovf, y1 + ovb, 'y', 'leaf', shade=1.0)
        box(mesh, (-.12, y0 - ovf, ridge + .05), (.12, y1 + ovb, ridge + .22), 'leaf', shade=.9)
        for x in (0.0, -W * .3, W * .3):
            zz = ridge - abs(x) * pitch - .25
            log(mesh, rng, V((x, y0 - ovf + .1, zz)), V((x, y0 + .2, zz)), .13)
        # The deck (-Y): boards on posts, a railing, steps at the middle.
        dz = .55
        box(mesh, (x0 - .2, yd, dz - .12), (x1 + .2, y0, dz), 'bark', shade=.72)
        for x in (x0 - .1, 0.0, x1 + .1):
            box(mesh, (x - .1, yd + .05, 0), (x + .1, yd + .25, dz - .12), 'bark', shade=.6)
        rz = dz + .95
        for xa, xb, ya, yb in ((x0 - .2, -.7, yd, yd + .1), (.7, x1 + .2, yd, yd + .1), (x0 - .2, x0 - .1, yd, y0),
                               (x1 + .1, x1 + .2, yd, y0)):
            box(mesh, (xa, ya, rz - .08), (xb, yb, rz), 'bark', shade=.95)
            box(mesh, (xa, ya, dz + .4), (xb, yb, dz + .46), 'bark', shade=.9)
        for x, y in ((x0 - .15, yd + .05), (-.75, yd + .05), (.75, yd + .05), (x1 + .15, yd + .05), (x0 - .15, y0 - .9),
                     (x1 + .15, y0 - .9)):
            box(mesh, (x - .06, y - .06, dz), (x + .06, y + .06, rz), 'bark', shade=.85)
        # Round 11: balusters along the front rail, so the deck reads as a
        # railed deck from the lake, not a bare platform.
        for xa, xb in ((x0 - .15, -.75), (.75, x1 + .15)):
            k = int((xb - xa) / .42)
            for j in range(1, k):
                x = xa + (xb - xa) * j / k
                box(mesh, (x - .025, yd + .03, dz), (x + .025, yd + .08, rz - .08), 'bark', shade=1.05, top=False,
                    sides=(1, 0, 0, 0))
        for k in range(2):
            h = dz * (k + 1) / 3
            box(mesh, (-.7, yd - .32 * (2 - k), 0), (.7, yd - .32 * (1 - k), h), 'bark', shade=.8)
        # Front: a door and two tall windows, a gable window; side windows.
        yf = y0 - rl - .01
        out = V((0, -1, 0))
        for xa, xb, za, zb in ((-.5, .5, sill + .1, 2.6), (-2.9, -1.3, 1.1, 2.6), (1.3, 2.9, 1.1, 2.6)):
            facing(mesh, [V((xa - .1, yf, za - .1)), V((xb + .1, yf, za - .1)), V((xb + .1, yf, zb + .1)),
                          V((xa - .1, yf, zb + .1))], 'stone', out, shade=1.15)
            facing(mesh, [V((xa, yf - .01, za)), V((xb, yf - .01, za)), V((xb, yf - .01, zb)), V((xa, yf - .01, zb))],
                   'accent', out, shade=1.0)
        zt = ridge - 1.0
        facing(mesh, [V((-1.2, yf, eave + .3)), V((1.2, yf, eave + .3)), V((0, yf, zt))], 'accent', out)
        for x, o in ((x0 - rl - .01, V((-1, 0, 0))), (x1 + rl + .01, V((1, 0, 0)))):
            for yc in (y0 + D * .3, y0 + D * .72):
                facing(mesh, [V((x, yc - .55, 1.2)), V((x, yc + .55, 1.2)), V((x, yc + .55, 2.2)), V((x, yc - .55, 2.2))],
                       'accent', o)
        cx = x1 + rl + .55
        ym = y0 + D * .5
        zc = 0.0
        while zc < ridge + .7:
            h = rng.uniform(.38, .5)
            hw, hd = (.65, .9) if zc < 2.6 else (.45, .55)
            j = drift(rng, .03)
            box(mesh, (cx - hw + j.x, ym - hd + j.y, zc), (cx + hw + j.x, ym + hd + j.y, zc + h), 'stone',
                shade=rng.uniform(.8, 1.05))
            zc += h
    return build


# ---------------------------------------------------------------- dock

def canoe(mesh, c, length, beam, depth, role='accent', yaw=0.0):
    """An open canoe along Y: hollow hull, upswept ends, dark inside."""
    n = 10
    rings = []
    for i in range(n + 1):
        t = i / n
        y = -length / 2 + length * t
        w = beam / 2 * max(.04, math.sin(math.pi * t) ** .8)
        sheer = depth * (1 + .7 * (2 * t - 1) ** 6)
        dd = depth * max(.15, math.sin(math.pi * t) ** .5)
        ring = []
        for k in range(7):
            g = math.pi * k / 6
            ring.append(c + turn(V((-math.cos(g) * w, y, sheer - math.sin(g) * dd)), yaw))
        for k in range(6, -1, -1):
            g = math.pi * k / 6
            ring.append(c + turn(V((-math.cos(g) * w * .85, y, sheer - math.sin(g) * dd * .8 + .01)), yaw))
        rings.append(ring)
    made = mesh.ring_strip(rings, role)
    for ring in made:
        for k, v in enumerate(ring):
            m = 1.0 if k < 7 else .55
            mesh.paint[v] = (m, m, m, 0.0)


def dock(length, width, bays):
    """A straight wooden lake dock along +Y from the shore (y = 0) to its
    end (y = length): cross planks with gaps on two stringers, round pilings
    in pairs down into the water (z = 0 is the water line, the deck 0.55 m
    over it), the end pair standing proud as mooring posts, two cleats, and
    a red canoe tied alongside at the end (accent)."""
    def build(mesh, rng):
        L, W = length, width
        dz = .55
        x0, x1 = -W / 2, W / 2
        y = 0.0
        while y < L - .05:
            w = .15
            box(mesh, (x0 - rng.uniform(0, .04), y, dz - .05), (x1 + rng.uniform(0, .04), min(L, y + w), dz), 'bark',
                shade=rng.uniform(.85, 1.08))
            y += w + .035
        for x in (x0 + .2, x1 - .2):
            box(mesh, (x - .05, 0, dz - .2), (x + .05, L, dz - .05), 'bark', shade=.55, top=False)
        for i in range(bays + 1):
            yy = min(L - .12, .12 + i * (L - .24) / bays)
            end = i == bays
            for x in (x0 - .02, x1 + .02):
                ztop = dz + (.9 if end else .08)
                mesh.add_tube([V((x, yy, -1.2)), V((x, yy, ztop))], [.1, .1], 6, 'bark', rng=rng, wobble=.03,
                              shade=lambda co, t: .55 + .3 * t, flex=lambda co, t: 0.0)
            box(mesh, (x0, yy - .06, dz - .3), (x1, yy + .06, dz - .18), 'bark', shade=.5)
        for yy in (L * .55, L - .6):
            box(mesh, (x1 - .12, yy - .12, dz), (x1 - .04, yy + .12, dz + .06), 'stone', shade=.6)
        canoe(mesh, V((x1 + .9, L - 2.8, .02)), 4.8, .85, .35, yaw=.35)
    return build


MODELS = [
    ('Blender_RedPine_1', redpine(26, 7.5, 6, .36)),
    ('Blender_RedPine_2', redpine(22, 9, 7, .5)),
    ('Blender_JackPine_1', jackpine(14, 8.5, .08)),
    ('Blender_Tamarack_1', tamarack(15, 6, 10)),
    ('Blender_BlackSpruce_1', blackspruce(11, 1.8, 1.0)),
    ('Blender_BlackSpruce_2', blackspruce(7, 1.6, .5)),
    ('Blender_SitkaSpruce_1', sitkaspruce(36, 14, .7)),
    ('Blender_ShorePine_1', shorepine(9, 9, .25, 1.0)),
    ('Blender_ShorePine_2', shorepine(11, 7.5, .1, .3, 1)),
    ('Blender_Fireweed_1', fireweed(1.6, 8)),
    ('Blender_DevilsClub_1', devilsclub(2.0, 1.8, 4)),
    ('Blender_Cottongrass_1', cottongrass(.45, 9)),
    ('Blender_LogCabin_1', logcabin(8, 7.5, 2.5)),
    ('Blender_Dock_1', dock(12, 1.8, 4)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')
SEASONS = ('spring', 'summer', 'autumn', 'winter')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


def plant(bark, rows):
    """rows: season -> (leaf, accent or None); an accent of None is drawn the
    leaf's colour (no flowers or fruit that season)."""
    return {s: {'leaf': rows[s][0], 'accent': rows[s][1] or rows[s][0], 'bark': bark} for s in SEASONS}


def ever(bark, leaf, accent=None):
    """An evergreen from its spec's four leaf colours (spring, summer,
    autumn, winter)."""
    return plant(bark, {s: (leaf[i], accent) for i, s in enumerate(SEASONS)})


# Role colours per season, from each spec's Seasons table (buildings from
# their Spec colours). Deciduous plants are drawn in leaf (their bare
# variants come later), so a bare winter keeps the summer leaf.
LOOK = {
    'RedPine': ever('#b0603a', ('#5a7e3e', '#557a3a', '#557a3a', '#52763a')),
    'JackPine': ever('#4e4640', ('#6a8040', '#647a3e', '#647a3e', '#60763c'), '#8a806a'),
    'Tamarack': plant('#7a5a4e', {'spring': ('#a2c66a', None), 'summer': ('#6e9a4a', None),
                                  'autumn': ('#d8a52e', None), 'winter': ('#6e9a4a', None)}),
    'BlackSpruce': ever('#5a5248', ('#3e5a3c', '#3c583a', '#3c583a', '#3a5438')),
    'SitkaSpruce': ever('#7a7468', ('#5c7a5a', '#587656', '#587656', '#557254')),
    'ShorePine': ever('#3e3a34', ('#4f6e3a', '#4a6a36', '#4a6a36', '#486634')),
    'Fireweed': plant('#557a3c', {'spring': ('#7a9a4a', None), 'summer': ('#557a3c', '#c8288a'),
                                  'autumn': ('#c03a2e', '#efece4'), 'winter': ('#557a3c', None)}),
    'DevilsClub': plant('#8a7a4a', {'spring': ('#7aa84a', None), 'summer': ('#4f7e36', '#c8281e'),
                                    'autumn': ('#c8b03a', '#c8281e'), 'winter': ('#4f7e36', None)}),
    'Cottongrass': plant('#6e8a4a', {'spring': ('#7a9a5a', '#d8d4b8'), 'summer': ('#6e8a4a', '#f2f0ea'),
                                     'autumn': ('#a07a4a', '#e8e2d4'), 'winter': ('#6e8a4a', '#f2f0ea')}),
    'LogCabin': {s: {'bark': '#7a5a3a', 'leaf': '#5e4e42', 'stone': '#9a948a', 'accent': '#2a2e30'} for s in SEASONS},
    'Dock': {s: {'bark': '#8a7a62', 'stone': '#3a3a3a', 'accent': '#b04a2e'} for s in SEASONS},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        out[name] = {role: hexrgb(h) for role, h in LOOK[sp][season].items()}
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.33, 0.35, 0.30),
                           'stone': (0.69, 0.63, 0.48)},
          far={'Blender_RedPine_1', 'Blender_RedPine_2', 'Blender_SitkaSpruce_1'},
          tints=tints(SEASON))
