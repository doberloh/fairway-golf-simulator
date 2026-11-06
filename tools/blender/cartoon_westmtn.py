# THE WESTERN MOUNTAINS PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what the Cascades, the High Sierra and the Ponderosa high
# country lacked -- ponderosa, sugar pine, incense cedar, red fir, noble fir,
# western larch, manzanita, Gambel oak, mountain mahogany, bitterbrush, mule's
# ear, beargrass, basalt and glaciated granite, and a distant snow volcano.
#
#   node tools/blender/iterate.mjs cartoon_westmtn <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid, and no conifer here may read as the game's lodgepole (narrow
# uneven crown on a pole with dead stubs), blue spruce (broad cone to the
# ground), spruce, fir, hemlock, pine or Douglas fir. The ponderosa is a tall
# orange column under an open, rounded-to-flat crown of separate tufts on
# heavy upswept limbs; the sugar pine a very tall pole with a few very long
# level arms like flags at its top, cones hanging at their tips; the incense
# cedar a dense narrow flame of scalloped flat sprays on a flared red base;
# the red fir a regular narrow spire of thin level shelves above a clear red
# trunk; the noble fir separate whorls of stiff up-angled brushes, a domed top
# with upright cones; the western larch a sparse see-through spire of tiny
# soft tufts round a visible trunk.
#
# REFS ponderosa=Blender_Ponderosa_1,Blender_Ponderosa_2
# REFS sugarpine=Blender_SugarPine_1
# REFS incensecedar=Blender_IncenseCedar_1
# REFS redfir=Blender_RedFir_1
# REFS noblefir=Blender_NobleFir_1
# REFS westernlarch=Blender_WesternLarch_1
# REFS manzanita=Blender_Manzanita_1
# REFS gambeloak=Blender_GambelOak_1
# REFS mountainmahogany=Blender_MountainMahogany_1
# REFS bitterbrush=Blender_Bitterbrush_1
# REFS mulesear=Blender_MulesEar_1
# REFS beargrass=Blender_Beargrass_1
# REFS basaltboulder=Blender_BasaltBoulder_1,Blender_BasaltBoulder_2
# REFS graniteslab=Blender_GraniteSlab_1,Blender_GraniteSlab_2
# REFS volcanobackdrop=Blender_Volcano_1
import math, os, random, sys
import bmesh
from mathutils import Vector, noise
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
TAU = math.tau


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def bez(p0, p1, p2, p3, n):
    """Cubic Bezier, n + 1 points."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(p0 * (u * u * u) + p1 * (3 * u * u * t) + p2 * (3 * u * t * t) + p3 * (t * t * t))
    return out


def frame(w, roll=0.0):
    """A right-handed frame (a, b, w) with w the given direction."""
    w = w.normalized()
    a = w.cross(UP)
    if a.length < 1e-4:
        a = Vector((1, 0, 0))
    a.normalize()
    b = w.cross(a).normalized()
    if roll:
        ca, sa = math.cos(roll), math.sin(roll)
        a, b = a * ca + b * sa, b * ca - a * sa
    return (a, b, w)


def pad_axes(d, tilt=0.0):
    """Axes for a pad lying along direction d (x), tilted up by `tilt`."""
    x = (Vector((d.x, d.y, 0)).normalized() * math.cos(tilt) + UP * math.sin(tilt)).normalized()
    y = UP.cross(x).normalized()
    return (x, y, x.cross(y).normalized())


def blob(mesh, rng, q, radii, role='leaf', axes=None, c=None, shade=None, bend=.5, u=8, v=5, jitter=.15,
         flex=.8, bright=1.0, bottom=0.0):
    """A cheap jittered u-by-v lump (2u(v-1) triangles) in a frame `axes`
    (local x, y, z), lit as part of a crown: normals bent toward `c` by
    `bend`, painted by `shade(point, normal)`."""
    rng = random.Random(rng.random())
    if ct.FAR:
        u, v = max(4, u // 2 + 1), 3
    ax = axes or (Vector((1, 0, 0)), Vector((0, 1, 0)), UP)
    rx, ry, rz = radii
    idx = mesh.slot(role)

    def put(x, y, z):
        if bottom and z < 0:
            z *= (1 - bottom)
        w = q + ax[0] * x + ax[1] * y + ax[2] * z
        n = ax[0] * (x / rx ** 2) + ax[1] * (y / ry ** 2) + ax[2] * (z / rz ** 2)
        n = n.normalized() if n.length > 1e-9 else ax[2]
        vv = mesh.bm.verts.new(w)
        if c is not None:
            out = w - c
            out = out.normalized() if out.length > 1e-6 else UP
            n = (n * (1 - bend) + out * bend).normalized()
        mesh.normal[vv] = n
        m = shade(w, n) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[vv] = (mm[0] * bright, mm[1] * bright, mm[2] * bright, flex)
        return vv
    top = put(0, 0, rz)
    bot = put(0, 0, -rz)
    rings = []
    for i in range(1, v):
        phi = math.pi / 2 - i / v * math.pi
        ring = []
        for k in range(u):
            a = k / u * TAU
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


def tube(mesh, rng, pts, r0, r1, sides, role='bark', shade=None, wobble=.06, flex0=.1, flex1=.5, far_skip=False):
    """A tapering tube; `far_skip` leaves it out of a far twin (a thin
    branch is under a pixel there, and four sides of it cost as much as a
    tuft -- the cost round, round 8)."""
    if far_skip and ct.FAR:
        rng.random()
        return None
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=shade or (lambda co, t: .8 + .2 * t), flex=lambda co, t: flex0 + (flex1 - flex0) * t)
    return radii


def stem(mesh, rng, height, radius, steps=8, sides=9, flare=1.6, lean=None, bend=0.0, shade=None, wobble=.05,
         taper=.6, base=None):
    """A trunk: flared at the root, tapering by `taper`; returns its points
    and radii (ct.trunk's shape, with a shade of the pack's own)."""
    base = base or Vector((0, 0, 0))
    lean = lean or Vector((0, 0, 0))
    side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0))
    side = side.normalized() * bend if side.length > 1e-6 else side
    pts, radii = [], []
    for i in range(steps + 1):
        t = i / steps
        pts.append(base + UP * height * t + lean * (t * t) + side * math.sin(t * math.pi))
        radii.append(radius * (1 - taper * t) * (1 + (flare - 1) * math.exp(-t * 14)))
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=shade or (lambda co, t: .78 + .25 * min(1, t * 1.6)), flex=lambda co, t: .15 * t * t)
    return pts, radii


def at(pts, radii, z):
    """The point and radius of a trunk at height z."""
    for i in range(len(pts) - 1):
        if pts[i + 1].z >= z:
            f = (z - pts[i].z) / max(1e-6, pts[i + 1].z - pts[i].z)
            return pts[i].lerp(pts[i + 1], f), radii[i] + (radii[i + 1] - radii[i]) * f
    return pts[-1].copy(), radii[-1]


def plates(lo, hi, dark=.6, freq=4.0, cut=.3):
    """Bark of plates and black fissures: a coarse sine pattern darkening
    some vertices, over a root-dark, top-light ramp."""
    def f(co, t):
        base = lo + (hi - lo) * min(1, t * 1.6)
        k = math.sin(co.x * freq * 1.3 + co.z * freq * .45) * math.sin(co.y * freq * 1.2 - co.z * freq * .6)
        return base * (dark if k > cut else 1.0)
    return f


def disc(mesh, center, normal, r, petals, role, shade=1.0, flex=.7, notch=.5, cup=.0, spin=0.0):
    """A flat two-sided star of `petals` points (a daisy's rays): 4 x petals
    triangles."""
    a, b, w = frame(normal, spin)
    n = petals * 2
    idx = mesh.slot(role)
    for side in (1, -1):
        cv = mesh.bm.verts.new(center + w * .004 * side)
        rim = []
        for k in range(n):
            ang = k / n * TAU
            rr = r * (1 if k % 2 == 0 else notch)
            rim.append(mesh.bm.verts.new(center + a * math.cos(ang) * rr + b * math.sin(ang) * rr + w * (cup * rr + .004 * side)))
        for vv in [cv] + rim:
            mesh.normal[vv] = w
            mesh.paint[vv] = (shade, shade, shade, flex)
        for k in range(n):
            tri = (cv, rim[k], rim[(k + 1) % n]) if side > 0 else (cv, rim[(k + 1) % n], rim[k])
            f = mesh.bm.faces.new(tri)
            f.material_index = idx
            f.smooth = True


# ---------------------------------------------------------------- ponderosa

def ponderosa(height, spread, clear, limbs, mature):
    """Ponderosa: a tall straight column of orange plates bare to `clear` of
    its height, then heavy limbs that leave level or drooping and sweep up at
    their ends, each tipped with a few big ragged tufts of long needles -- an
    open crown, sky between the tufts, rounded (young) to flat-topped
    (mature)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = stem(mesh, rng, H * .96, H * .025, steps=10, sides=10, flare=1.45, lean=drift(rng, H * .012),
                          shade=plates(.78, 1.05, dark=.55))
        z0 = H * clear
        c = UP * (z0 + H) * .5
        shade = ct.crown_shade(c, (R, R, (H - z0) * .55), low=.45, high=1.2)
        a0 = rng.uniform(0, TAU)
        for i in range(limbs):
            f = i / (limbs - 1)
            z = z0 + (H * .88 - z0) * f + rng.uniform(-.4, .4)
            p0, r0 = at(pts, radii, z)
            a = a0 + i * 2.4 + rng.uniform(-.3, .3)
            d = heading(a)
            if mature:
                reach = R * rng.uniform(.75, 1.0) * (1 - .35 * f ** 3)
            else:
                reach = R * rng.uniform(.8, 1.0) * (1 - .62 * f)
            lift = reach * rng.uniform(.35, .6)
            path = bez(p0, p0 + d * reach * .4 - UP * reach * .1, p0 + d * reach * .85 + UP * lift * .2,
                       p0 + d * reach + UP * lift, 5)
            tube(mesh, rng, path, r0 * .55, H * .003, 6, shade=lambda co, t: .82 + .2 * t)
            s = R * rng.uniform(.24, .28)
            tip = path[-1]
            blob(mesh, rng, tip + UP * s * .25, (s, s, s * .72), c=c, shade=shade, jitter=.28, u=9, v=5, bottom=.3)
            for j in range(2):
                b = a + (j - .5) * 1.6 + rng.uniform(-.3, .3)
                q = tip + heading(b) * s * .9 - UP * s * .2
                blob(mesh, rng, q, (s * .7, s * .7, s * .55), c=c, shade=shade, jitter=.3, u=8, v=4, bottom=.3)
            q = path[3] + heading(a + rng.choice((-1, 1)) * 1.2) * s * .5
            blob(mesh, rng, q, (s * .72, s * .72, s * .55), c=c, shade=shade, jitter=.3, u=8, v=4, bottom=.3)
        for k in range(4):
            s = R * .26
            p0, r0 = at(pts, radii, z0 + (H * .85 - z0) * (k + .5) / 4)
            blob(mesh, rng, p0 + heading(a0 + k * 1.9) * R * .25, (s, s, s * .7), c=c, shade=shade, jitter=.3, u=8, v=4,
                 bottom=.3)
        s = R * .22
        for k in range(3 if mature else 2):
            q = pts[-1] + heading(a0 + k * 2.1) * s * (.9 if mature else .5) - UP * s * .3
            blob(mesh, rng, q, (s, s, s * (.6 if mature else .85)), c=c, shade=shade, jitter=.28, u=9, v=5, bottom=.3)
    return build


# ---------------------------------------------------------------- sugar pine

def sugarpine(height, spread):
    """Sugar pine: a very tall straight purple-brown pole, a few short
    drooping branches down its middle, and at its top a handful of very long
    level arms reaching out like flags, each carrying flat pads of needles
    and huge cones hanging from its tip (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = stem(mesh, rng, H * .97, H * .02, steps=10, sides=10, flare=1.4, lean=drift(rng, H * .008),
                          shade=plates(.7, .98, dark=.7, freq=3.0))
        c = UP * H * .74
        shade = ct.crown_shade(c, (R, R, H * .26), low=.45, high=1.18)
        a0 = rng.uniform(0, TAU)
        fr = random.Random(rng.random())
        for i in range(5):
            z = H * (.36 + .03 * i)
            p0, r0 = at(pts, radii, z)
            d = heading(a0 + i * 2.3)
            reach = R * rng.uniform(.18, .28)
            end = p0 + d * reach - UP * reach * .35
            tube(mesh, rng, [p0, p0.lerp(end, .5) + UP * .2, end], r0 * .3, .05, 5)
            s = R * .16
            blob(mesh, rng, end, (s * 1.3, s, s * .5), axes=pad_axes(d), c=c, shade=shade, jitter=.25)
        arms = 10
        for i in range(arms):
            f = i / (arms - 1)
            z = H * (.5 + .44 * f)
            p0, r0 = at(pts, radii, z)
            a = a0 + .6 + i * 2.5 + rng.uniform(-.25, .25)
            d = heading(a)
            reach = R * (rng.uniform(1.05, 1.2) if i in (6, 7, 8) else rng.uniform(.38, .52) * (1 - .3 * f))
            sag = reach * (.08 if i in (6, 7, 8) else .3)
            path = bez(p0, p0 + d * reach * .35 + UP * reach * .04, p0 + d * reach * .7, p0 + d * reach - UP * sag, 5)
            tube(mesh, rng, path, r0 * .38, .06, 6)
            # Round 6: many smaller ragged tufts along the arm, alternating
            # sides and hanging a little, so the arm reads as a long level
            # line of needles, not a few big leaf pads.
            side = Vector((-d.y, d.x, 0))
            for k in range(2 if i in (6, 7, 8) else 3, 6):
                q = path[k]
                for j in (-1, 1):
                    s = R * .1 * (1.15 if k > 3 else .95) * rng.uniform(.85, 1.1)
                    blob(mesh, rng, q + side * j * s * .7 - UP * s * (.3 + .1 * k), (s * 1.2, s * .9, s * .75), axes=pad_axes(d),
                         c=c, shade=shade, jitter=.32, u=7, v=4)
            if reach > R * .55:
                for k in range(3):
                    q = path[-1] + d * (.5 - k * .6) + side * fr.uniform(-.5, .5) - UP * (1.3 + .2 * k)
                    blob(mesh, fr, q, (.36, .36, .9), role='accent', jitter=.08, u=6, v=4, flex=.5)
        s = R * .12
        for k in range(3):
            blob(mesh, rng, pts[-1] + heading(a0 + k * 2.1) * s * .8 - UP * s * .2, (s * 1.2, s * 1.2, s * .6), c=c,
                 shade=shade, jitter=.25)
    return build


# ---------------------------------------------------------------- incense cedar

def incensecedar(height, spread):
    """Incense cedar: a flared, buttressed cinnamon trunk under a dense narrow
    flame of flat lacy sprays, broad at its foot and tapering to a blunt
    point, its edge scalloped by the sprays' drooping ends (no tiers)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = stem(mesh, rng, H * .88, H * .022, steps=8, sides=10, flare=2.0, lean=drift(rng, H * .01),
                          shade=lambda co, t: .75 + .3 * min(1, t * 2))
        for k in range(5):
            d = heading(k / 5 * TAU + rng.uniform(-.3, .3))
            blob(mesh, rng, d * radii[0] * .9 + UP * .3, (radii[0] * .9, radii[0] * .35, .9), role='bark',
                 axes=pad_axes(d, .5), u=6, v=4, jitter=.1, flex=0.0, shade=lambda w, n: .8)
        z0 = H * .1
        c = UP * H * .52
        shade = ct.crown_shade(c, (R, R, H * .48), low=.42, high=1.2)
        levels = 14
        for i in range(levels):
            f = i / (levels - 1)
            z = z0 + (H * .93 - z0) * f
            r = R * max(.2, (1 - f) ** .55) * (.9 + .1 * math.sin(f * 11))
            n = max(3, int(round(3 + 5 * r / R)))
            off = rng.uniform(0, TAU)
            for k in range(n):
                a = off + k / n * TAU + rng.uniform(-.25, .25)
                d = heading(a)
                s = r * rng.uniform(.5, .62)
                q = UP * z + d * (r - s * .45)
                # Round 11: each spray hangs, its foot flared out and down
                # (picture 5's drooping lacy sprays), so the edge scallops.
                t = Vector((-d.y, d.x, 0))
                zz = (UP - d * .5).normalized()
                ax = (t, zz.cross(t).normalized(), zz)
                blob(mesh, rng, q + d * s * .15 - UP * s * .2, (s * 1.0, s * .42, s * .95), axes=ax, c=c, shade=shade, jitter=.34,
                     u=7, v=4)
        s = R * .22
        blob(mesh, rng, UP * (H - s * 1.2), (s, s, s * 1.3), c=c, shade=shade, jitter=.25)
    return build


# ---------------------------------------------------------------- red fir

def redfir(height, spread, tiers):
    """Red fir: a clear deep red-brown trunk for its lower quarter, then a
    regular narrow spire of thin level shelves with sky between them,
    tapering to a sharp leader."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = stem(mesh, rng, H * .96, H * .024, steps=8, sides=9, flare=1.5, shade=plates(.72, .95, dark=.7))
        z0 = H * .22
        c = UP * (z0 + H) * .5
        shade = ct.crown_shade(c, (R, R, (H - z0) * .5), low=.45, high=1.18)
        for i in range(tiers):
            f = i / (tiers - 1)
            z = z0 + (H * .92 - z0) * f
            r = R * min(1.0, 1.25 * (1 - f)) ** .9 * rng.uniform(.94, 1.04)
            gap = (H * .92 - z0) / (tiers - 1)
            ct.skirt(mesh, rng, UP * z + drift(rng, .15), max(.4, r), gap * .5, points=7, droop=.2, shade=shade, ragged=.22,
                     twist=rng.uniform(0, 1), thick=.5)
        s = R * .14
        blob(mesh, rng, UP * (H * .95), (s * .7, s * .7, s * 2.2), c=c, shade=shade, jitter=.1)
    return build


# ---------------------------------------------------------------- noble fir

def noblefir(height, spread, whorls):
    """Noble fir: a straight grey trunk bare to a third of its height, then
    separate whorls of short stiff branches angled up, each a flat brush of
    blue-green needles curling up at its tip; the top domed, with upright
    cones standing on it (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = stem(mesh, rng, H * .95, H * .017, steps=8, sides=8, flare=1.4,
                          shade=lambda co, t: .82 + .2 * t)
        z0 = H * .32
        c = UP * (z0 + H) * .5
        shade = ct.crown_shade(c, (R, R, (H - z0) * .5), low=.45, high=1.2)
        fr = random.Random(rng.random())
        for i in range(whorls):
            f = i / (whorls - 1)
            z = z0 + (H * .9 - z0) * f
            p0, r0 = at(pts, radii, z)
            r = R * (1 - .5 * f if f < .8 else .6 - (f - .8) * 1.2) * rng.uniform(.88, 1.05)
            n = 5
            off = rng.uniform(0, TAU)
            for k in range(n):
                d = heading(off + k / n * TAU + rng.uniform(-.2, .2))
                end = p0 + d * r * .85 + UP * r * .5
                tube(mesh, rng, [p0, p0.lerp(end, .5), end], r0 * .3, .04, 4, far_skip=True)
                s = r * .5
                blob(mesh, rng, p0.lerp(end, .6) + UP * s * .1, (s, s * .55, s * .32), axes=pad_axes(d, .35), c=c,
                     shade=shade, jitter=.22, u=7, v=4)
                if f > .75 and fr.random() < .6:
                    blob(mesh, fr, end + UP * .35, (.12, .12, .3), role='accent', jitter=.06, u=6, v=4, flex=.3)
        s = R * .38
        blob(mesh, rng, UP * (H * .93), (s, s, s * .8), c=c, shade=shade, jitter=.2, bottom=.3)
    return build


# ---------------------------------------------------------------- western larch

def westernlarch(height, spread, levels):
    """Western larch: a tall straight cinnamon trunk bare to two fifths of its
    height, then short thin branches that droop and lift at their tips,
    carrying small separate soft tufts -- a sparse narrow spire you see the
    trunk and sky through, light green (gold in autumn)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = stem(mesh, rng, H * .98, H * .016, steps=9, sides=8, flare=1.4, taper=.8,
                          shade=plates(.75, 1.0, dark=.7))
        z0 = H * .38
        c = UP * (z0 + H) * .5
        shade = ct.crown_shade(c, (R, R, (H - z0) * .5), low=.5, high=1.18)
        for i in range(levels):
            f = i / (levels - 1)
            z = z0 + (H * .95 - z0) * f
            p0, r0 = at(pts, radii, z)
            r = R * (1 - f) ** .85 * rng.uniform(.75, 1.05) + .3
            off = rng.uniform(0, TAU)
            for k in range(3):
                d = heading(off + k / 3 * TAU + rng.uniform(-.4, .4))
                end = p0 + d * r - UP * r * .1
                tube(mesh, rng, [p0, p0 + d * r * .5 - UP * r * .18, end], max(.03, r0 * .25), .02, 4, far_skip=True)
                for t in (.55, 1.0):
                    s = (.45 + .35 * (1 - f)) * rng.uniform(.8, 1.1)
                    q = p0.lerp(end, t) + UP * s * .2
                    blob(mesh, rng, q, (s, s, s * .7), c=c, shade=shade, jitter=.3, u=6, v=4, bend=.4)
        blob(mesh, rng, pts[-1] - UP * .3, (.35, .35, .8), c=c, shade=shade, jitter=.2, u=6, v=4)
    return build


# ---------------------------------------------------------------- manzanita

def manzanita(height, spread, stems):
    """Manzanita: smooth maroon-red stems twisting up and out from one burl,
    forking, carrying an irregular mound of dull grey-green leaf clumps with
    the red stems showing under and through it; pink bells or red-brown
    berries (accent) under the clumps."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .6
        shade = ct.crown_shade(c, (R, R, H * .4), low=.45, high=1.18)
        fr = random.Random(rng.random())
        a0 = rng.uniform(0, TAU)
        smooth = lambda co, t: .85 + .3 * t
        for s in range(stems):
            a = a0 + s / stems * TAU + rng.uniform(-.3, .3)
            d = heading(a)
            side = Vector((-d.y, d.x, 0))
            fork = d * R * .3 + UP * H * .45 + side * rng.uniform(-.2, .2)
            path = bez(Vector((0, 0, -.05)), d * R * .05 + UP * H * .2 + side * .15, fork - side * .2 - UP * H * .1, fork, 4)
            tube(mesh, rng, path, H * .035, H * .022, 6, shade=smooth, wobble=.1)
            for j in range(2):
                b = a + (j - .5) * 1.0 + rng.uniform(-.2, .2)
                e = heading(b)
                end = fork + e * R * rng.uniform(.35, .55) + UP * H * rng.uniform(.18, .32)
                mid = fork.lerp(end, .5) + Vector((-e.y, e.x, 0)) * .15
                tube(mesh, rng, [fork, mid, end], H * .02, H * .008, 5, shade=smooth, wobble=.1)
                sz = R * rng.uniform(.3, .36)
                blob(mesh, rng, end + UP * sz * .25, (sz, sz, sz * .88), c=c, shade=shade, jitter=.2, u=9, v=5,
                     bottom=.3)
                blob(mesh, rng, end + e * sz * .7 - UP * sz * .15, (sz * .75, sz * .75, sz * .65), c=c, shade=shade,
                     jitter=.22, u=8, v=4, bottom=.3)
                for k in range(2):
                    q = end + heading(b + fr.uniform(-1.5, 1.5)) * sz * .7 - UP * sz * .35
                    blob(mesh, fr, q, (.05, .05, .07), role='accent', jitter=.1, u=5, v=3, flex=.7)
        sz = R * .38
        blob(mesh, rng, UP * (H - sz * .6), (sz, sz, sz * .7), c=c, shade=shade, jitter=.2, u=9, v=5, bottom=.3)
    return build


# ---------------------------------------------------------------- Gambel oak

def gambeloak(height, spread, stems):
    """A Gambel oak thicket: a clone of thin grey stems spread over the
    footprint, the tallest in the middle, each under a couple of rounded
    lobed oak clumps, so the whole is a lumpy rounded mound with dips, low
    suckers at its edge."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .45), low=.42, high=1.18)
        a0 = rng.uniform(0, TAU)
        for s in range(stems):
            if s == 0:
                base, top = Vector((0, 0, 0)), H * .72
            else:
                d = heading(a0 + s / (stems - 1) * TAU + rng.uniform(-.3, .3))
                base = d * R * rng.uniform(.35, .55)
                top = H * rng.uniform(.4, .66)
            lean = Vector((base.x, base.y, 0)) * .25 + drift(rng, .2)
            tip = base + lean + UP * top
            tube(mesh, rng, [base - UP * .05, base.lerp(tip, .5) + drift(rng, .1), tip], H * .026, H * .012, 5,
                 shade=lambda co, t: .75 + .25 * t, wobble=.12)
            # Round 14: five smaller lobed clumps a stem, none below 40% of
            # the height, so the grey stems show under an irregular crown
            # with notches (pictures 1 and 3), not one ball to the ground.
            sz = R * (.34 if s == 0 else rng.uniform(.28, .32))
            blob(mesh, rng, tip + UP * sz * .3, (sz, sz, sz * .8), c=c, shade=shade, jitter=.22, u=8, v=5, bottom=.25)
            for j in range(4):
                k = sz * rng.uniform(.7, .85)
                q = tip + heading(rng.uniform(0, TAU)) * sz * rng.uniform(.8, 1.1) - UP * sz * (.15 + .45 * (j % 2))
                q.z = max(q.z, H * .3 + k * .5)
                blob(mesh, rng, q, (k, k, k * .8), c=c, shade=shade, jitter=.22, u=8, v=5, bottom=.25)
        for k in range(3):
            d = heading(a0 + k * 2.1 + .4)
            sz = R * .14
            blob(mesh, rng, d * R * .8 + UP * sz * .5, (sz * 1.2, sz * 1.2, sz * .8), c=c, shade=shade, jitter=.2, u=7, v=4,
                 bottom=.3)
    return build


# ---------------------------------------------------------------- mountain mahogany

def mountainmahogany(height, spread, trunks):
    """Curl-leaf mountain mahogany: two or three gnarled grey trunks leaning
    out and kinking, under an irregular broad crown of many small dark
    clumps; in summer and autumn silvery feathery seed tails curl out of it
    (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .7
        shade = ct.crown_shade(c, (R, R, H * .3), low=.45, high=1.15)
        fr = random.Random(rng.random())
        a0 = rng.uniform(0, TAU)
        ends = []
        for t in range(trunks):
            d = heading(a0 + t / trunks * TAU + rng.uniform(-.3, .3))
            side = Vector((-d.y, d.x, 0))
            k1 = d * R * .15 + UP * H * .25 + side * .25
            fork = d * R * .3 + UP * H * .45 - side * .2
            tube(mesh, rng, [Vector((0, 0, -.05)), k1, fork], H * .04, H * .025, 6,
                 shade=lambda co, t: .7 + .3 * t, wobble=.15)
            for j in range(3):
                e = heading(a0 + t / trunks * TAU + (j - 1) * .8 + rng.uniform(-.3, .3))
                end = fork + e * R * rng.uniform(.4, .6) + UP * H * rng.uniform(.18, .32)
                mid = fork.lerp(end, .5) + drift(rng, .25) + UP * .1
                tube(mesh, rng, [fork, mid, end], H * .018, H * .006, 4, wobble=.15)
                ends.append((end, e))
        for end, e in ends:
            # Round 12: three small clumps an end, not two big ones -- the
            # fine, ragged texture of a small-leaved crown (picture 3).
            for k in range(3):
                sz = R * rng.uniform(.18, .22)
                q = end + heading(rng.uniform(0, TAU)) * sz * .9 * min(k, 1) + UP * sz * (.2 - .25 * (k == 2))
                blob(mesh, rng, q, (sz, sz, sz * .8), c=c, shade=shade, jitter=.3, u=8, v=4, bottom=.3)
        for s in range(5):
            sz = R * .3
            q = heading(a0 + s * 1.3) * R * .25 * (s % 2) + UP * (H * .62 + sz * .3 * s / 5)
            blob(mesh, rng, q, (sz, sz, sz * .85), c=c, shade=shade, jitter=.25, u=8, v=4, bottom=.3)
        for k in range(45):
            end, e = ends[k % len(ends)]
            o = heading(fr.uniform(0, TAU))
            p = end + o * R * fr.uniform(.1, .3) + UP * R * fr.uniform(.15, .3)
            tip = p + (o + UP * .8).normalized() * .55
            mid = p.lerp(tip, .5) + Vector((-o.y, o.x, 0)) * .1
            tube(mesh, fr, [p, mid, tip], .045, .015, 4, role='accent', shade=lambda co, t: 1.0, flex0=.6, flex1=.9)
    return build


# ---------------------------------------------------------------- bitterbrush

def bitterbrush(height, spread, stems):
    """Bitterbrush: a low spreading grey-green shrub, wider than tall, of
    small irregular clumps on stiff grey twigs, bare twig ends poking out
    of its ragged edge; small yellow flowers over it in spring (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.5, high=1.15)
        fr = random.Random(rng.random())
        a0 = rng.uniform(0, TAU)
        tops = []
        for s in range(stems):
            d = heading(a0 + s / stems * TAU + rng.uniform(-.3, .3))
            end = d * R * rng.uniform(.5, .8) + UP * H * rng.uniform(.5, .85)
            tube(mesh, rng, [Vector((0, 0, -.03)), d * R * .2 + UP * H * .3, end], .035, .012, 4, wobble=.15,
                 shade=lambda co, t: .75 + .25 * t)
            for j in range(2):
                tw = end + d * R * .3 + UP * H * (.12 + .15 * j) + drift(rng, .15)
                tube(mesh, rng, [end, tw], .014, .004, 4)
            tops.append(end)
        for q in tops + [UP * H * .7]:
            for k in range(3):
                sz = R * rng.uniform(.22, .3)
                p = q + drift(rng, sz * .7) - UP * sz * .35 * k
                blob(mesh, rng, p, (sz, sz, sz * .85), c=c, shade=shade, jitter=.28, u=7, v=4, bottom=.3)
        for k in range(24):
            q = tops[k % len(tops)] + drift(fr, R * .3) + UP * R * fr.uniform(.12, .22)
            blob(mesh, fr, q, (.035, .035, .03), role='accent', jitter=.1, u=4, v=3, flex=.7)
    return build


# ---------------------------------------------------------------- mule's ear

def mulesear(height, spread, leaves, heads):
    """Mule's ear: a clump of big upright grey-green leaves, elliptic and
    held nearly erect, with a few yellow sunflower heads (rays accent, disc
    bark) on stalks just above them."""
    def build(mesh, rng):
        H, R = height, spread * .5
        a0 = rng.uniform(0, TAU)
        for k in range(leaves):
            a = a0 + k * ct.GOLDEN * 2
            d = heading(a)
            L = H * rng.uniform(.32, .42)
            w = (d * rng.uniform(.45, .8) + UP).normalized()
            ax = frame(w, a)
            q = d * R * .12 + w * L
            blob(mesh, rng, q, (L * .24, L * .06, L), axes=ax, jitter=.08, u=8, v=5, flex=.6,
                 shade=lambda p, n: .75 + .45 * min(1, p.z / H))
        for k in range(heads):
            a = a0 + k / heads * TAU + .5
            d = heading(a)
            h = H * rng.uniform(.82, 1.0)
            top = d * R * .3 + UP * h
            tube(mesh, rng, [Vector((0, 0, 0)), d * R * .12 + UP * h * .5, top], .008, .006, 4, role='leaf',
                 shade=lambda co, t: .9)
            n = (d * .5 + UP).normalized()
            disc(mesh, top, n, .07, 13, 'accent', shade=1.05, notch=.55)
            blob(mesh, rng, top + n * .01, (.025, .025, .015), role='bark', axes=frame(n), jitter=.05, u=6, v=3,
                 flex=.7)
    return build


# ---------------------------------------------------------------- beargrass

def beargrass(height, spread):
    """Beargrass: a fountain tussock of fine wiry grass leaves, and from its
    middle one tall stalk carrying a dense creamy club of tiny flowers
    (accent), bulbous at the bottom and blunt at the top."""
    def build(mesh, rng):
        ct.tuft(mesh, rng, Vector((0, 0, 0)), blades=44, height=.6, width=.02, spread=spread * .6, lean=1.1,
                low='leaf', tip='leaf', tip_from=1.1, dark=.6, light=1.15)
        H = height
        top = Vector((.04, .02, H * .74))
        tube(mesh, rng, [Vector((0, 0, 0)), Vector((.02, .01, H * .4)), top], .014, .01, 5, role='leaf',
             shade=lambda co, t: .85 + .2 * t)
        for k, (z, r) in enumerate(((.0, .11), (.12, .105), (.24, .09), (.34, .06))):
            blob(rng=rng, mesh=mesh, q=top + UP * (z * H / 1.4 + .04), radii=(r, r, .12), role='accent', jitter=.12, u=8,
                 v=4, flex=.8, shade=lambda p, n: .95 + .1 * n.z)
    return build


# ---------------------------------------------------------------- basalt

def prism(mesh, rng, base, r, h, role='stone', lo=.55, hi=1.0, yaw=0.0, tilt=None):
    """One basalt column: a hexagonal prism standing on `base`, its top cut
    on a slight tilt (`tilt` a horizontal vector, metres per metre)."""
    tilt = tilt or Vector((0, 0, 0))
    idx = mesh.slot(role)
    bot, top = [], []
    for k in range(6):
        a = yaw + k / 6 * TAU
        p = base + Vector((math.cos(a) * r, math.sin(a) * r, 0))
        bv = mesh.bm.verts.new(p - UP * .15)
        tv = mesh.bm.verts.new(p + UP * (h + tilt.dot(p - base)))
        mesh.paint[bv] = (lo, lo, lo, 0.0)
        mesh.paint[tv] = (hi, hi, hi, 0.0)
        bot.append(bv)
        top.append(tv)
    faces = [mesh.bm.faces.new((bot[k], bot[(k + 1) % 6], top[(k + 1) % 6], top[k])) for k in range(6)]
    faces.append(mesh.bm.faces.new(top))
    faces.append(mesh.bm.faces.new(list(reversed(bot))))
    for f in faces:
        f.material_index = idx
        f.smooth = False
    return max(v.co.z for v in top)


def basaltcolumns(r, heights):
    """Columnar basalt: a tight hexagonal bundle of dark columns of mixed
    heights, the tallest at the back, tops cut at slight tilts, a short
    broken stump and a fallen drum in front; lichen (accent) on two tops."""
    def build(mesh, rng):
        cells = [(0, 0), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1), (2, -1), (-2, 1), (1, 1)]
        g = math.sqrt(3) * r
        for i, (qa, ra) in enumerate(cells):
            x = g * (qa + ra * .5)
            y = g * ra * math.sqrt(3) / 2
            base = Vector((x, y, 0))
            h = heights[i % len(heights)] * (1 + .25 * (y / (g * 1.2))) * rng.uniform(.9, 1.1)
            t = drift(rng, .12)
            ztop = prism(mesh, rng, base, r * .96, h, yaw=math.pi / 6, tilt=t, lo=.7, hi=1.1)
            if i in (1, 5):
                prism(mesh, rng, base + Vector((.03, -.02, ztop - .1)), r * .55, .14, role='accent', lo=1, hi=1,
                      yaw=rng.uniform(0, 1))
        # A fallen drum lying in front, along X.
        idx = mesh.slot('stone')
        b = Vector((g * .2, -g * 1.6, r * .9))
        ends = []
        for s in (-1, 1):
            ring = []
            for k in range(6):
                a = math.pi / 6 + k / 6 * TAU
                p = b + Vector((s * r * 1.1, math.cos(a) * r * .9, math.sin(a) * r * .9))
                vv = mesh.bm.verts.new(p)
                val = .55 + .4 * (math.sin(a) * .5 + .5)
                mesh.paint[vv] = (val, val, val, 0.0)
                ring.append(vv)
            ends.append(ring)
        fs = [mesh.bm.faces.new((ends[0][k], ends[1][k], ends[1][(k + 1) % 6], ends[0][(k + 1) % 6])) for k in range(6)]
        fs.append(mesh.bm.faces.new(list(reversed(ends[0]))))
        fs.append(mesh.bm.faces.new(ends[1]))
        for f in fs:
            f.material_index = idx
            f.smooth = False
    return build


def basaltblock(size):
    """A blocky basalt boulder: dark, rough and angular, a smaller block
    against it; lichen (accent) on its upward faces."""
    def build(mesh, rng):
        ct.hull_rock(mesh, rng, Vector((0, 0, 0)), (size * .55, size * .45, size * .34), points=13, bevel=.05,
                     seat=.12, flat_bottom=.3, shade_low=.62, shade_high=1.1)
        ct.hull_rock(mesh, rng, Vector((size * .55, -size * .2, 0)), (size * .3, size * .26, size * .22), points=10,
                     bevel=.05, seat=.15, flat_bottom=.3, shade_low=.5, shade_high=.95)
    return build


# ---------------------------------------------------------------- granite

def granite(mesh, rng, center, radii, lumps=.08, cut=.35, streaks=0, subdiv=3, lo=.62, hi=1.08, front=-math.pi / 2):
    """A glacier-smoothed granite body: an icosphere eased by low noise, cut
    flat underneath at `cut` of its height; `streaks` dark water streaks
    (accent) down its steep faces, centred on the side facing `front`."""
    # Round 2: a UV sphere, not an icosphere -- its faces stand in columns,
    # so a streak is a clean vertical band, not a chequer of triangles.
    bm = bmesh.new()
    useg = 12 * subdiv + 4
    bmesh.ops.create_uvsphere(bm, u_segments=useg, v_segments=4 * subdiv - 1, radius=1.0)
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    rx, ry, rz = radii
    for v in bm.verts:
        n = v.co.normalized()
        d = 1 + lumps * noise.noise(n * 1.4 + off)
        p = Vector((n.x * rx * d, n.y * ry * d, n.z * rz * d))
        if p.z < -rz * cut:
            p.z = -rz * cut + (p.z + rz * cut) * .1
        v.co = p
    bm.normal_update()
    col = TAU / useg
    bands = {}
    for _ in range(streaks):
        k = int(((front + rng.uniform(-1.2, 1.2)) % TAU) / col)
        bands[k] = rng.uniform(.7, 1.3)
    idx_s = mesh.slot('stone')
    idx_a = mesh.slot('accent') if streaks else idx_s
    lookup = {}
    base_z = center.z + rz * cut
    for v in bm.verts:
        w = Vector((center.x + v.co.x, center.y + v.co.y, base_z + v.co.z))
        nv = mesh.bm.verts.new(w)
        lookup[v] = nv
        up = (v.co.z + rz * cut) / (rz * (1 + cut))
        val = lo + (hi - lo) * max(0.0, min(1.0, up))
        mesh.paint[nv] = (val, val, val, 0.0)
    for f in bm.faces:
        nf = mesh.bm.faces.new([lookup[v] for v in f.verts])
        m = f.calc_center_median()
        k = int((math.atan2(m.y, m.x) % TAU) / col)
        streak = k in bands and f.normal.z < .6 and rz * (.7 - bands[k]) < m.z < rz * .7
        nf.material_index = idx_a if streak else idx_s
        nf.smooth = True
    bm.free()
    return base_z + rz


def graniteslab(length, width, height):
    """A glaciated granite slab: a long low pale whaleback, smooth, dark water
    streaks down its front, an erratic boulder left sitting on it."""
    def build(mesh, rng):
        top = granite(mesh, rng, Vector((0, 0, 0)), (length * .5, width * .5, height / 1.35), lumps=.22, streaks=3)
        granite(mesh, rng, Vector((-length * .3, -width * .25, 0)), (length * .3, width * .3, height * .45), lumps=.2,
                subdiv=2, lo=.6, hi=1.0)
        granite(mesh, rng, Vector((length * .12, width * .05, top - .5)), (.95, .85, .8), lumps=.18, subdiv=2,
                lo=.7, hi=1.1)
    return build


def granitedome(width, height):
    """A granite dome: a smooth rounded pale dome, an exfoliation shell
    peeling off its flank as a lower step, dark streaks down its face."""
    def build(mesh, rng):
        granite(mesh, rng, Vector((0, 0, 0)), (width * .5, width * .46, height / 1.35), lumps=.07, streaks=4)
        granite(mesh, rng, Vector((width * .32, -width * .18, 0)), (width * .3, width * .22, height * .32), lumps=.1,
                lo=.6, hi=1.0)
    return build


# ---------------------------------------------------------------- volcano

def volcano(height, radius, seg=40, rings=14, snow=.5):
    """A distant stratovolcano for the horizon: a concave-sided cone with
    radial ridges and gullies, its upper half snow (accent) whose edge runs
    down the gullies as glacier tongues; drawn far, never reached. Real size,
    metres."""
    def build(mesh, rng):
        H, R = height, radius
        ph = [rng.uniform(0, TAU) for _ in range(5)]

        def ridge(a):
            return .5 * math.sin(7 * a + ph[0]) + .3 * math.sin(13 * a + ph[1]) + .2 * math.sin(23 * a + ph[2])

        def point(rr, a):
            z = H * (1 - rr) ** 1.6 + H * .04 * ridge(a) * math.sin(math.pi * min(1, rr * 1.1))
            rad = R * rr * (1 + .06 * math.sin(3 * a + ph[3]))
            return Vector((math.cos(a) * rad, math.sin(a) * rad, max(0.0, z) if rr < 1 else -H * .02))
        idx_s, idx_a = mesh.slot('stone'), mesh.slot('accent')
        apex = mesh.bm.verts.new(Vector((0, 0, H)))
        mesh.paint[apex] = (1.05, 1.05, 1.05, 0.0)
        rows = []
        for i in range(1, rings + 1):
            rr = (i / rings) ** 1.35
            row = []
            for k in range(seg):
                a = k / seg * TAU
                vv = mesh.bm.verts.new(point(rr, a))
                val = .8 + .3 * min(1, vv.co.z / H * 1.3)
                mesh.paint[vv] = (val, val, val, 0.0)
                row.append(vv)
            rows.append(row)
        ring = []
        for k in range(seg):
            a = k / seg * TAU
            vv = mesh.bm.verts.new(point(1.08, a))
            mesh.paint[vv] = (.6, .6, .6, 0.0)
            ring.append(vv)
        rows.append(ring)

        def is_snow(vs, a):
            z = sum(v.co.z for v in vs) / len(vs)
            line = H * (snow + .06 * math.sin(3 * a + ph[4]) + .1 * ridge(a))
            return z > line
        for k in range(seg):
            k1 = (k + 1) % seg
            a = (k + .5) / seg * TAU
            f = mesh.bm.faces.new((apex, rows[0][k], rows[0][k1]))
            f.material_index = idx_a
            f.smooth = True
            for i in range(len(rows) - 1):
                vs = (rows[i][k], rows[i + 1][k], rows[i + 1][k1], rows[i][k1])
                f = mesh.bm.faces.new(vs)
                f.material_index = idx_a if is_snow(vs, a) else idx_s
                f.smooth = True
    return build


MODELS = [
    ('Blender_Ponderosa_1', ponderosa(32, 14, .46, 10, True)),
    ('Blender_Ponderosa_2', ponderosa(24, 11, .32, 14, False)),
    ('Blender_SugarPine_1', sugarpine(50, 22)),
    ('Blender_IncenseCedar_1', incensecedar(30, 9)),
    ('Blender_RedFir_1', redfir(38, 8.5, 14)),
    ('Blender_NobleFir_1', noblefir(34, 7, 12)),
    ('Blender_WesternLarch_1', westernlarch(34, 7.5, 12)),
    ('Blender_Manzanita_1', manzanita(2.6, 3.4, 5)),
    ('Blender_GambelOak_1', gambeloak(5, 7.5, 8)),
    ('Blender_MountainMahogany_1', mountainmahogany(4.5, 4.5, 3)),
    ('Blender_Bitterbrush_1', bitterbrush(1.2, 1.9, 6)),
    ('Blender_MulesEar_1', mulesear(.6, .55, 9, 4)),
    ('Blender_Beargrass_1', beargrass(1.4, .55)),
    ('Blender_BasaltBoulder_1', basaltcolumns(.3, (1.9, 2.2, 1.6, 2.0, 1.3, .8, 1.1, .6, 1.7, 2.3))),
    ('Blender_BasaltBoulder_2', basaltblock(2.2)),
    ('Blender_GraniteSlab_1', graniteslab(11, 7, 2.2)),
    ('Blender_GraniteSlab_2', granitedome(12, 8)),
    ('Blender_Volcano_1', volcano(3000, 4000, snow=.36)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'Ponderosa': '#b8683a', 'SugarPine': '#6e4c44', 'IncenseCedar': '#9a5636', 'RedFir': '#6e3a2c',
        'NobleFir': '#6e6a66', 'WesternLarch': '#8e5234', 'Manzanita': '#8e2e22', 'GambelOak': '#6a6660',
        'MountainMahogany': '#6e6862', 'Bitterbrush': '#6a5e50', 'MulesEar': '#9a6a1e', 'Beargrass': '#6a8a4e'}
# Stone and accent of the rocks and the backdrop: basalt dark grey with
# yellow-grey lichen; granite pale with dark water streaks; the volcano's rock
# blue-grey under its snow (from the specs' colours).
STONE = {'BasaltBoulder': ('#585250', '#8e8a5a'), 'GraniteSlab': ('#c8c4b8', '#9a968c'),
         'Volcano': ('#6a7a8a', '#e8eef4')}
# Leaf, accent (and for mule's ear the disc, bark) per season, from each
# spec's Seasons table. Deciduous ones are drawn in leaf (their bare variants
# come later): a bare winter keeps the summer leaf, except where the spec
# says leaves are held (Gambel oak's brown ones). An accent with no flowers,
# cones or fruit that season is drawn the leaf's colour.
LOOK = {
    'Ponderosa': {'spring': ('#6c8e3e', None), 'summer': ('#5b7e38', None), 'autumn': ('#5a7a36', None),
                  'winter': ('#557433', None)},
    'SugarPine': {'spring': ('#557a52', '#9a7a4e'), 'summer': ('#4f744d', '#a07e50'), 'autumn': ('#4f744d', '#a07e50'),
                  'winter': ('#4c704a', '#8a6a46')},
    'IncenseCedar': {'spring': ('#5d8a42', None), 'summer': ('#4d7a3a', None), 'autumn': ('#4c763a', None),
                     'winter': ('#567238', None)},
    'RedFir': {'spring': ('#5a7a6a', None), 'summer': ('#557564', None), 'autumn': ('#557564', None),
               'winter': ('#527262', None)},
    'NobleFir': {'spring': ('#6f9a8a', '#6e5a7a'), 'summer': ('#4d7a72', '#7e7650'), 'autumn': ('#4a7670', '#8a6a44'),
                 'winter': ('#45706a', '#45706a')},
    'WesternLarch': {'spring': ('#9cc25e', None), 'summer': ('#6a9a48', None), 'autumn': ('#d8a52e', None),
                     'winter': ('#6a9a48', None)},
    'Manzanita': {'spring': ('#7a8a6a', '#f0c8cc'), 'summer': ('#6f826a', '#6f826a'), 'autumn': ('#6f826a', '#8e3a2a'),
                  'winter': ('#6c7e66', '#d8a8a8')},
    'GambelOak': {'spring': ('#9db458', None), 'summer': ('#4f7a34', None), 'autumn': ('#b0562e', None),
                  'winter': ('#8a6440', None)},
    'MountainMahogany': {'spring': ('#4a5e3e', '#4a5e3e'), 'summer': ('#4a5e3e', '#dcdad0'),
                         'autumn': ('#4a5e3e', '#d0ccbc'), 'winter': ('#465a3c', '#465a3c')},
    'Bitterbrush': {'spring': ('#8a9468', '#d8c040'), 'summer': ('#7a8a5a', '#7a8a5a'), 'autumn': ('#8a8a5a', '#8a8a5a'),
                    'winter': ('#7a7e5a', '#7a7e5a')},
    'MulesEar': {'spring': ('#7a9460', '#e8c030'), 'summer': ('#8a9662', '#e0b830'), 'autumn': ('#a08a5a', '#a08a5a', '#a08a5a'),
                 'winter': ('#8a7a5a', '#8a7a5a', '#8a7a5a')},
    'Beargrass': {'spring': ('#6a8a52', '#c8d0a0'), 'summer': ('#6a8a4e', '#f2efe4'), 'autumn': ('#8a8a5a', '#a89a70'),
                  'winter': ('#6a7a52', '#6a7a52')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        if sp in STONE:
            out[name] = {'stone': hexrgb(STONE[sp][0]), 'accent': hexrgb(STONE[sp][1])}
            continue
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(look[2] if len(look) > 2 else BARK[sp])}
        t['accent'] = hexrgb(look[1] or look[0])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.85, 0.80, 0.60),
                           'stone': (0.55, 0.55, 0.55)},
          far={'Blender_Ponderosa_1', 'Blender_Ponderosa_2', 'Blender_SugarPine_1', 'Blender_IncenseCedar_1',
               'Blender_RedFir_1', 'Blender_NobleFir_1', 'Blender_WesternLarch_1'},
          tints=tints(SEASON))
