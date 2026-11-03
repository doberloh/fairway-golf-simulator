# THE PLAINS PACK (the US landscapes goal, 2 November 2026; PLAN.md section
# 5, local): what the High Plains, the Sand Hills and the Cross Timbers
# lacked -- soapweed yucca, the eastern red cedar, a farmstead shelterbelt,
# the ranch windmill and its stock tank, a barbed-wire fence section, a grain
# elevator, an oil pump jack, a patch of buffalo grass and grama, and a clump
# of wild sunflowers.
#
#   node tools/blender/iterate.mjs cartoon_plains <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): the red cedar is ONE dense
# narrow column-to-spire of small ragged lobes on a single short stem -- not
# the Ashe juniper's cluster of shaggy spires on many stems (cartoon_texas),
# not the spruce's tiered cone, not the cypress's smooth candle. The
# shelterbelt is a long wall: a front row of dark cedar cones under a back row
# of tall ragged cottonwoods and rounder elms. The soapweed yucca is a low
# spiky ball of thin stiff blades with a cream bell spike -- no trunk, unlike
# the desert's tree yuccas and Joshua tree.
#
# REFS soapweedyucca=Blender_SoapweedYucca_1
# REFS redcedarsmall=Blender_EasternRedCedar_1,Blender_EasternRedCedar_2
# REFS shelterbelt=Blender_Shelterbelt_1
# REFS windmill=Blender_Windmill_1
# REFS barbedwirefence=Blender_BarbedWireFence_1
# REFS grainelevator=Blender_GrainElevator_1
# REFS pumpjack=Blender_PumpJack_1
# REFS buffalograss=Blender_Buffalograss_1
# REFS wildsunflower=Blender_WildSunflower_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
V = Vector


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered -- 64 triangles at 8 x 5
    (cartoon_southoaks' cost round). Returns its vertices."""
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
    """A lowball lit as part of a crown: normals bent toward the crown's
    centre `c` by `bend`, painted by `shade` (a crown_shade)."""
    made = lowball(mesh, q, radii, role, rng, u, v, jitter)
    for x in made:
        out = x.co - c
        out = out.normalized() if out.length > 1e-6 else UP
        n = (mesh.normal[x] * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = shade(x.co, n) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0] * bright, mm[1] * bright, mm[2] * bright, flex)
    return made


def facing(mesh, pts, role, out, shade=1.0, flex=0.0):
    """A one-sided polygon wound so its front faces `out`."""
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
    """Both sides of a thin sheet (a blade, a vane, a leaf)."""
    facing(mesh, pts, role, nrm, shade, flex)
    facing(mesh, pts, role, -nrm, shade * .9, flex)


def box(mesh, lo, hi, role, shade=1.0, top=True, sides=(1, 1, 1, 1)):
    """An axis box; `sides` (-Y, +X, +Y, -X) which walls. Walls lit a little
    by the side they face (the sun is low in the -X -Y quarter)."""
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
    """A convex profile swept straight along 'x' or 'y': prof is (u, z) pairs
    across the other horizontal axis."""
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


def rod(mesh, pts, r, role, sides=4, s=.9, cap=False):
    """A thin straight member (lattice, wire, pipe)."""
    mesh.add_tube(pts, [r] * len(pts), sides, role, shade=lambda co, t: s, flex=lambda co, t: 0.0, cap_end=cap)


SUN2 = Vector((-.6, -.8, 0))


def cyl(mesh, c, r, z0, z1, role, sides, lo=.82, hi=1.04):
    """A drum, painted lighter on its sunny -X -Y side so touching drums
    part from each other (round 2)."""
    def sh(co, t):
        n = Vector((co.x - c.x, co.y - c.y, 0))
        k = .72 + .36 * max(0.0, n.normalized().dot(SUN2)) if n.length > 1e-6 else 1.0
        return (lo + (hi - lo) * t) * k
    mesh.add_tube([c + UP * z0, c + UP * z1], [r, r], sides, role, shade=sh, flex=lambda co, t: 0.0, cap_end=True)


# ---------------------------------------------------------------- soapweed yucca

def blade(mesh, base, d, length, half, role, sag=0.0, lo=.6, hi=1.12, flex=.25):
    """One stiff narrow leaf: a long taper to a point, both sides, its normals
    pointing out along it so the rosette lights as one spiky ball."""
    d = d.normalized()
    side = d.cross(UP)
    if side.length < 1e-3:
        side = V((1, 0, 0))
    side.normalize()
    nrm = side.cross(d).normalized()
    if nrm.z < 0:
        nrm = -nrm
    p1 = base + d * length * .5 - UP * sag * .25
    p2 = base + d * length - UP * sag
    idx = mesh.slot(role)
    for poly in ([base - side * half, base + side * half, p1 + side * half * .8, p1 - side * half * .8],
                 [p1 - side * half * .8, p1 + side * half * .8, p2]):
        for pp, n in ((poly, nrm), (list(reversed(poly)), -nrm)):
            vs = [mesh.bm.verts.new(p) for p in pp]
            f = mesh.bm.faces.new(vs)
            f.material_index = idx
            f.smooth = True
            for x in vs:
                t = min(1.0, (x.co - base).length / length)
                val = lo + (hi - lo) * t
                mesh.paint[x] = (val, val, val, flex * t)
                mesh.normal[x] = (d * .7 + n * .3 + UP * .2).normalized()


def soapweed(leaves, length, stalks):
    """Soapweed yucca: no trunk -- a low hemispherical burst of stiff, very
    narrow blue-green blades from one crown, the lowest spread flat and a few
    dead ones hanging tan (the bark role) at the skirt; one to three tall
    bare stalks carrying cream nodding bells along their upper half
    (accent)."""
    def build(mesh, rng):
        L = length
        root = V((0, 0, .06))
        for i in range(leaves):
            t = (i + .5) / leaves
            z = .1 + .86 * t
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            d = heading(a) * math.sqrt(1 - z * z) + UP * z
            ll = L * rng.uniform(.8, 1.0) * (1 - .2 * t)
            blade(mesh, root + heading(a) * .03, d, ll, .015, 'leaf', sag=ll * .08 * (1 - z))
        for i in range(leaves // 6):
            a = rng.uniform(0, math.tau)
            d = heading(a) * .8 - UP * .45
            blade(mesh, root + heading(a) * .05 + UP * .05, d, L * rng.uniform(.6, .85), .011, 'bark', sag=.02,
                  lo=.7, hi=1.0)
        fr = random.Random(rng.random())
        for s in range(stalks):
            h = 1.35 if s == 0 else fr.uniform(1.0, 1.2)
            top = drift(fr, .12) + UP * h
            base = drift(fr, .04) + UP * .1
            mid = base.lerp(top, .5) + drift(fr, .03)
            mesh.add_tube([base, mid, top], [.016, .012, .006], 5, 'bark', shade=lambda co, t: .75 + .3 * t,
                          flex=lambda co, t: .4 * t, cap_end=False)
            # Round 2: a crowded panicle -- more, bigger bells, close in.
            n = 18 if s == 0 else 10
            for k in range(n):
                f = .45 + .52 * k / n
                q = base.lerp(top, f)
                a = k * 2.4 + fr.uniform(-.3, .3)
                p = q + heading(a) * .055 * (1.15 - .5 * k / n) - UP * .02
                ball(mesh, fr, p, (.042, .042, .052), q, None, flex=.6, role='accent', jitter=.12, u=6, v=4, bend=.2)
    return build


# ---------------------------------------------------------------- red cedar

def redcedar(height, spread, taper, lean, tiers):
    """Eastern red cedar: one short stem, then a dense column-to-spire of
    small ragged lobes from near the ground to a blunt point; widest a fifth
    of the way up, tapering by `taper` (0.7 a column, 1.1 a pyramid), the top
    nodding a little off true by `lean`."""
    def build(mesh, rng):
        H, R = height, spread * .5
        tilt = drift(rng, H * lean)
        ct.trunk(mesh, rng, V((0, 0, 0)), H * .25, H * .018, lean=tilt * .25, steps=3, sides=6, flare=1.5,
                 bend=H * .01, shade_low=.7, shade_high=.95)
        c = UP * H * .45 + tilt * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.44, high=1.16)
        z0 = H * .07
        for k in range(tiers):
            f = k / (tiers - 1)
            z = z0 + (H * .86 - z0) * f
            axis = V((0, 0, z)) + tilt * (z / H)
            prof = R * (1 - f * .92) ** taper * min(1.0, .6 + f * 2.5) * rng.uniform(.85, 1.12)
            s = max(R * .24, prof * .52)
            ring = max(1, int(round(math.tau * prof * .55 / (s * .95))))
            off = rng.uniform(0, math.tau)
            for j in range(ring):
                a = off + j / ring * math.tau + rng.uniform(-.25, .25)
                q = axis + heading(a) * prof * rng.uniform(.38, .55) + UP * rng.uniform(-.15, .15) * s
                ss = s * rng.uniform(.85, 1.1)
                # Round 4: tall narrow lobes, flame-like, for the upswept sprays.
                ball(mesh, rng, q, (ss * .85, ss * .85, ss * 1.55), c, shade, jitter=.22, bend=.45)
        # Round 2: ragged tufts pushed out through the outline, so the edge
        # is feathery and uneven (the photos), not a smooth candle.
        for k in range(tiers * 3):
            f = rng.uniform(.05, .85)
            z = z0 + (H * .86 - z0) * f
            prof = R * (1 - f * .92) ** taper * min(1.0, .6 + f * 2.5)
            a = rng.uniform(0, math.tau)
            ss = R * rng.uniform(.13, .19)
            q = V((0, 0, z)) + tilt * (z / H) + heading(a) * prof * rng.uniform(.9, 1.05) + UP * ss
            ball(mesh, rng, q, (ss * .8, ss * .8, ss * 1.9), c, shade, jitter=.16, bend=.5, u=6, v=4)
        s = R * .2
        ball(mesh, rng, UP * (H - s * 1.6) + tilt, (s * .75, s * .75, s * 2.0), c, shade, jitter=.2, bend=.45)
        # Round 12: a ragged leader -- a few small upswept sprays beside the
        # tip at different heights (photo 5), not one neat point.
        for k in range(3):
            z = H * rng.uniform(.78, .92)
            ss = R * rng.uniform(.11, .15)
            q = UP * z + tilt * (z / H) + heading(rng.uniform(0, math.tau)) * R * rng.uniform(.24, .34)
            ball(mesh, rng, q, (ss * .8, ss * .8, ss * 2.1), c, shade, jitter=.15, bend=.5, u=6, v=4)
    return build


# ---------------------------------------------------------------- shelterbelt

def shelterbelt(length, cedars, trees):
    """A farmstead windbreak, one section along X (the game lays sections end
    to end): a front row (-Y) of dense dark cedar cones (the accent role, so
    they keep the cedar's colour) and behind it a row of tall ragged
    cottonwoods and rounder elms on bare trunks (leaf, bark)."""
    def build(mesh, rng):
        half = length * .5
        step = length / cedars
        for i in range(cedars):
            x = -half + step * (i + .5) + rng.uniform(-.3, .3)
            h = rng.uniform(7.0, 9.0)
            r = rng.uniform(1.3, 1.7)
            base = V((x, -4.5 + rng.uniform(-.3, .3), 0))
            c = base + UP * h * .45
            shade = ct.crown_shade(c, (r, r, h * .5), low=.36, high=1.05)
            for k in range(4):
                f = k / 3
                rr = r * (1 - .7 * f)
                q = base + UP * (h * (.2 + .6 * f)) + drift(rng, .12)
                ball(mesh, rng, q, (rr, rr, h * .22 * (1 - .1 * f)), c, shade, role='accent', jitter=.25, u=6, v=4,
                     bend=.45)
            # Round 3: a pointed tip, so each cedar is a cone, not a pillar.
            ball(mesh, rng, base + UP * h * .93, (r * .25, r * .25, h * .12), c, shade, role='accent', jitter=.1, u=6,
                 v=4, bend=.45)
        tstep = length / trees
        for i in range(trees):
            cotton = (i % 2 == 0) != (rng.random() < .2)
            x = -half + tstep * (i + .5) + rng.uniform(-.6, .6)
            base = V((x, 1.5 + rng.uniform(-.5, .5), 0))
            h = rng.uniform(15.5, 18.5) if cotton else rng.uniform(9.5, 12.0)
            w = rng.uniform(9.0, 11.0) if cotton else rng.uniform(7.5, 9.0)
            pts, radii = ct.trunk(mesh, rng, base, h * .3, h * .02, lean=drift(rng, .4), steps=3, sides=6,
                                  flare=1.4, bend=h * .02, shade_low=.72, shade_high=.95)
            top = pts[-1]
            c = V((top.x, top.y, h * .68))
            shade = ct.crown_shade(c, (w * .5, w * .5, h * .32), low=.4, high=1.12)
            nl = 3  # round 11: three limbs each, the lobes rounder (8 x 5)
            a0 = rng.uniform(0, math.tau)
            for j in range(nl):
                a = a0 + j / nl * math.tau + rng.uniform(-.3, .3)
                d = heading(a); d = V((d.x, d.y * .55, 0))  # round 11: along the row
                end = top + d * w * rng.uniform(.26, .36)
                end.z = h * rng.uniform(.68, .86)
                # Round 9 (cost): a three-point tube, not ct.limb's many rings.
                mid = top.lerp(end, .5) + UP * h * .03 + drift(rng, .3)
                mesh.add_tube([top, mid, end], [radii[-1] * .6, radii[-1] * .4, radii[-1] * .2], 4, 'bark',
                              shade=lambda co, t: .85 + .1 * t, flex=lambda co, t: .1 + .4 * t, cap_end=False)
                s = w * rng.uniform(.2, .24)
                ball(mesh, rng, end + UP * s * .2, (s, s, s * (.85 if cotton else .8)), c, shade, jitter=.22, u=8, v=5)
                # Round 2: a second, lower clump on every limb, so the crowns
                # come down and meet into a wall.
                s2 = s * .85
                q = top.lerp(end, .5) + d * s2 * .8
                q.z = h * .58
                ball(mesh, rng, q, (s2, s2, s2 * .85), c, shade, jitter=.22, u=8, v=5)
            s = w * .24
            ball(mesh, rng, V((top.x, top.y, h - s * .8)), (s, s, s * .8), c, shade, jitter=.22, u=8, v=5)
    return build


# ---------------------------------------------------------------- windmill

def tank(mesh, c, r, h, n=20):
    """A round galvanised stock tank (stone) holding water (leaf)."""
    mesh.add_tube([c, c + UP * h], [r, r], n, 'stone', shade=lambda co, t: .78 + .25 * t,
                  flex=lambda co, t: 0.0, cap_end=False)
    ri, zw = r - .07, h - .1
    for i in range(n):
        a0, a1 = i / n * math.tau, (i + 1) / n * math.tau
        o0, o1 = c + heading(a0) * r + UP * h, c + heading(a1) * r + UP * h
        i0, i1 = c + heading(a0) * ri + UP * h, c + heading(a1) * ri + UP * h
        facing(mesh, [o0, o1, i1, i0], 'stone', UP, shade=1.08)
        facing(mesh, [i0, i1, i1 - UP * .1, i0 - UP * .1], 'stone', -heading((a0 + a1) / 2), shade=.6)
    facing(mesh, [c + heading(i / n * math.tau) * ri + UP * zw for i in range(n)], 'leaf', UP, shade=1.0)


def windmill(height, wheel_r, blades):
    """The ranch windmill (Aermotor type): a four-legged galvanised lattice
    tower tapering to a small square top, braced in X panels, a board
    platform under the head; on top the gearbox, a multi-blade wheel facing
    -Y and a long tail boom to +Y with its flat vane (accent); the pump rod
    down the middle and a round stock tank at the foot (+X -Y)."""
    def build(mesh, rng):
        Ht = height
        b0, bt = Ht * .12, .32

        def hw(z):
            return b0 + (bt - b0) * z / Ht
        corners = ((1, 1), (-1, 1), (-1, -1), (1, -1))
        for sx, sy in corners:
            rod(mesh, [V((sx * b0 * 1.02, sy * b0 * 1.02, -.2)), V((sx * bt, sy * bt, Ht))], .055, 'bark', s=.92)
        levels = [.4, Ht * .26, Ht * .5, Ht * .72, Ht * .9]
        for z in levels:
            w = hw(z)
            for i in range(4):
                a, b = corners[i], corners[(i + 1) % 4]
                rod(mesh, [V((a[0] * w, a[1] * w, z)), V((b[0] * w, b[1] * w, z))], .03, 'bark', s=.85)
        for k in range(len(levels) - 1):
            za, zb = levels[k], levels[k + 1]
            wa, wb = hw(za), hw(zb)
            for i in range(4):
                a, b = corners[i], corners[(i + 1) % 4]
                rod(mesh, [V((a[0] * wa, a[1] * wa, za)), V((b[0] * wb, b[1] * wb, zb))], .02, 'bark', s=.8)
                rod(mesh, [V((b[0] * wa, b[1] * wa, za)), V((a[0] * wb, a[1] * wb, zb))], .02, 'bark', s=.8)
        zp = Ht - .9
        o, i_ = .95, hw(zp)
        for lo, hi in (((-o, -o), (o, -i_)), ((-o, i_), (o, o)), ((-o, -i_), (-i_, i_)), ((i_, -i_), (o, i_))):
            box(mesh, (lo[0], lo[1], zp - .06), (hi[0], hi[1], zp), 'bark', shade=.72)
        rod(mesh, [V((0, 0, .2)), V((0, 0, Ht - .4))], .025, 'bark', s=.8)
        rod(mesh, [V((0, 0, Ht - .5)), V((0, 0, Ht + .3))], .07, 'bark', s=.9, sides=6)
        hub = V((0, -.62, Ht + .4))
        for x in lowball(mesh, V((0, -.05, Ht + .4)), (.26, .5, .28), 'bark', rng, u=8, v=5, jitter=.05):
            mesh.paint[x] = (.95, .95, .95, 0.0)
        for x in lowball(mesh, hub, (.14, .12, .14), 'bark', rng, u=6, v=4, jitter=.05):
            mesh.paint[x] = (.85, .85, .85, 0.0)
        r_in, r_out = wheel_r * .42, wheel_r
        for rr in (r_in, r_out):
            pts = [hub + V((math.cos(k / 24 * math.tau) * rr, 0, math.sin(k / 24 * math.tau) * rr)) for k in range(25)]
            rod(mesh, pts, .03, 'bark', s=.85)
        for k in range(6):
            a = k / 6 * math.tau + .2
            rod(mesh, [hub, hub + V((math.cos(a) * r_out, 0, math.sin(a) * r_out))], .022, 'bark', s=.8)
        pitch = math.radians(30)
        w0, w1 = math.pi * r_in / blades * .85, math.pi * r_out / blades * .85
        for k in range(blades):
            a = k / blades * math.tau
            u = V((math.cos(a), 0, math.sin(a)))
            t = V((-math.sin(a), 0, math.cos(a)))
            tt = t * math.cos(pitch) + V((0, 1, 0)) * math.sin(pitch)
            pts = [hub + u * r_in - tt * w0, hub + u * r_in + tt * w0, hub + u * r_out * .98 + tt * w1,
                   hub + u * r_out * .98 - tt * w1]
            twosided(mesh, pts, 'bark', tt.cross(u).normalized(), shade=1.0)
        rod(mesh, [V((0, -.1, Ht + .55)), V((0, 2.9, Ht + .6))], .035, 'bark', s=.85)
        rod(mesh, [V((0, .2, Ht + .25)), V((0, 2.9, Ht + .25))], .035, 'bark', s=.85)
        vane = [V((0, 1.7, Ht + .1)), V((0, 3.1, Ht - .15)), V((0, 3.1, Ht + 1.15)), V((0, 1.7, Ht + .8))]
        twosided(mesh, vane, 'accent', V((-1, 0, 0)), shade=1.0)
        tc = V((3.9, -1.6, 0))
        tank(mesh, tc, 2.4, .55, n=24)
        rod(mesh, [V((0, 0, .45)), V((1.2, -.55, .45)), V((2.1, -1.0, .75))], .04, 'bark', s=.75)
    return build


# ---------------------------------------------------------------- barbed wire

def tpost(mesh, x, h):
    box(mesh, (x - .012, -.03, -.1), (x + .012, .03, h), 'stone', shade=.95)
    box(mesh, (x - .032, -.036, -.1), (x + .032, -.024, h), 'stone', shade=.9)


def fence(length, tposts, strands):
    """One straight ranch-fence section along X, x = -L/2..+L/2: a cedar post
    at its -X end (the next section's post closes it), steel T-posts between,
    and the strands of wire (accent) on the -Y face, sagging a little."""
    def build(mesh, rng):
        x0 = -length * .5
        top = V((x0 + rng.uniform(-.02, .02), rng.uniform(-.02, .02), 1.32))
        mesh.add_tube([V((x0, 0, -.15)), V((x0, 0, .6)), top], [.105, .1, .09], 7, 'bark', rng=rng, wobble=.1,
                      shade=lambda co, t: .72 + .32 * t, flex=lambda co, t: 0.0)
        xs = [x0 + length * (i + 1) / (tposts + 1) for i in range(tposts)]
        for x in xs:
            tpost(mesh, x, 1.22)
        posts = [x0] + xs + [x0 + length]
        for z in (.42, .66, .9, 1.14)[:strands]:
            pts = []
            for a, b in zip(posts, posts[1:]):
                for k in range(3):
                    f = k / 3
                    pts.append(V((a + (b - a) * f, -.075, z - .03 * math.sin(math.pi * f))))
            pts.append(V((posts[-1], -.075, z)))
            rod(mesh, pts, .014, 'accent', sides=4, s=1.0)
    return build


# ---------------------------------------------------------------- grain elevator

def window(mesh, x0, x1, y, z0, z1, out):
    facing(mesh, [V((x0, y, z0)), V((x1, y, z0)), V((x1, y, z1)), V((x0, y, z1))], 'bark', out, shade=.9)


def elevator(silo_h, silo_r, cols):
    """A concrete grain elevator: two rows of tall silos (stone) side by side
    along X, a gallery along their tops, the taller headhouse at the -X end
    with its cupola, a low workhouse and driveway at its foot, one corrugated
    steel bin (leaf) at the +X end and the rust load-out spout (accent) on
    the -Y front."""
    def build(mesh, rng):
        Hs, r = silo_h, silo_r
        x_first = -(cols - 1) * r
        for i in range(cols):
            for j in (-1, 1):
                cyl(mesh, V((x_first + 2 * r * i, j * r * .98, 0)), r, 0, Hs, 'stone', 18)
        gx = r * cols + .2
        box(mesh, (-gx, -1.7, Hs - .1), (gx, 1.7, Hs + 3.2), 'stone', shade=.97)
        for k in range(cols * 2):
            x = -gx + 1.5 + k * (2 * gx - 3) / (cols * 2 - 1)
            window(mesh, x - .5, x + .5, -1.75, Hs + 1.2, Hs + 2.4, V((0, -1, 0)))
        hx0, hx1 = -gx - 6.6, -gx
        box(mesh, (hx0, -5, 0), (hx1, 5, 40), 'stone', shade=1.0)
        box(mesh, (hx0 + .9, -3, 40), (hx1 - .9, 3, 45), 'stone', shade=.98)
        box(mesh, (hx0 + .7, -3.2, 45), (hx1 - .7, 3.2, 45.4), 'bark', shade=.9)
        box(mesh, (hx0 - .2, -5.2, 40), (hx1 + .2, 5.2, 40.4), 'bark', shade=.9)
        for z in (9, 17, 25, 33):
            window(mesh, hx0 + 1.6, hx0 + 2.8, -5.05, z, z + 1.6, V((0, -1, 0)))
            window(mesh, hx1 - 2.8, hx1 - 1.6, -5.05, z, z + 1.6, V((0, -1, 0)))
        window(mesh, hx0 + 2.4, hx1 - 2.4, -3.05, 42, 43.5, V((0, -1, 0)))
        wx0 = hx0 - 6.5
        box(mesh, (wx0, -6.5, 0), (hx0, 4, 7), 'stone', shade=.92)
        prism(mesh, [(-6.9, 7), (4.4, 7), (-1.25, 9.6)], wx0 - .3, hx0, 'x', 'bark', shade=.9)
        window(mesh, wx0 + 1.5, hx0 - 1.5, -6.55, 0, 5, V((0, -1, 0)))
        bc = V((gx + 5.2, 0, 0))
        cyl(mesh, bc, 4.2, 0, 11, 'leaf', 18, lo=.85, hi=1.05)
        mesh.add_tube([bc + UP * 11, bc + UP * 14.2], [4.35, .3], 18, 'leaf', shade=lambda co, t: 1.05 + .1 * t,
                      flex=lambda co, t: 0.0)
        mesh.add_tube([V((hx1, -5, 36)), V((hx1 + 4, -8.5, 16)), V((hx1 + 6.5, -10, 5))], [.35, .32, .3], 6,
                      'accent', shade=lambda co, t: .9, flex=lambda co, t: 0.0)
    return build


# ---------------------------------------------------------------- pump jack

def pumpjack(bearing_h, head_r):
    """An oil pump jack (the nodding donkey), at rest: a steel skid on a
    gravel pad (stone), the A-frame samson post, the walking beam along X
    with the curved horse head (accent) at +X over the wellhead, the
    pitman arms down to the cranks and their big counterweights (accent) on
    the gear reducer at -X, the motor behind."""
    def build(mesh, rng):
        Hs = bearing_h
        bz = Hs + .25
        box(mesh, (-4.8, -1.8, 0), (5.0, 1.8, .08), 'stone', shade=1.0)
        for y in (-.7, .7):
            box(mesh, (-4.3, y - .12, .08), (2.0, y + .12, .45), 'bark', shade=.9)
        for x in (-4.0, -1.0, 1.7):
            box(mesh, (x - .12, -.82, .08), (x + .12, .82, .4), 'bark', shade=.85)
        for sx in (-1, 1):
            for y in (-.7, .7):
                rod(mesh, [V((sx * 1.15, y, .45)), V((sx * .12, y * .26, Hs))], .12, 'bark', s=.88)
            rod(mesh, [V((sx * .62, -.48, Hs * .5)), V((sx * .62, .48, Hs * .5))], .05, 'bark', s=.85)
        box(mesh, (-.3, -.3, Hs - .1), (.3, .3, Hs + .08), 'bark', shade=.8)
        box(mesh, (-2.1, -.18, bz - .3), (head_r * .88, .18, bz + .3), 'bark', shade=.95)
        # Round 2: a narrow curved arc a quarter of the beam, not a block.
        prof = [(head_r * .86 * math.cos(math.radians(-12)), bz + head_r * .86 * math.sin(math.radians(-12)))]
        for k in range(6):
            th = math.radians(-18 + 32 * k / 5)
            prof.append((head_r * math.cos(th), bz + head_r * math.sin(th)))
        prof.append((head_r * .86 * math.cos(math.radians(8)), bz + head_r * .86 * math.sin(math.radians(8))))
        prism(mesh, prof, -.22, .22, 'y', 'accent', shade=1.0)
        wx = head_r
        for y in (-.12, .12):
            rod(mesh, [V((wx, y, bz)), V((wx, y, 1.55))], .02, 'bark', s=.6)
        box(mesh, (wx - .1, -.25, 1.45), (wx + .1, .25, 1.55), 'bark', shade=.8)
        rod(mesh, [V((wx, 0, 1.55)), V((wx, 0, .95))], .035, 'leaf', s=1.1)
        mesh.add_tube([V((wx, 0, .05)), V((wx, 0, .7)), V((wx, 0, .95))], [.16, .12, .08], 8, 'leaf',
                      shade=lambda co, t: .8 + .25 * t, flex=lambda co, t: 0.0)
        rod(mesh, [V((wx - .6, 0, .45)), V((wx + .6, 0, .45))], .06, 'leaf', s=.85, cap=True)
        box(mesh, (-2.2, -.85, bz - .15), (-1.9, .85, bz + .15), 'bark', shade=.9)
        shaft = (-2.45, 1.55)
        pin = (-1.95, 1.95)
        for y in (-.62, .62):
            rod(mesh, [V((pin[0], y * 1.2, pin[1])), V((-2.05, y * 1.2, bz - .1))], .06, 'bark', s=.85)
        box(mesh, (-3.0, -.45, .45), (-1.9, .45, 1.95), 'bark', shade=.92)
        dx, dz = shaft[0] - pin[0], shaft[1] - pin[1]
        wc = (shaft[0] + dx * 1.6, shaft[1] + dz * 1.6)
        wprof = [(wc[0] + .85 * math.cos(k / 10 * math.tau), wc[1] + .72 * math.sin(k / 10 * math.tau)) for k in range(10)]
        armp = [(pin[0] - .1, pin[1] + .1), (pin[0] + .1, pin[1] - .1), (wc[0] + .2, wc[1] - .3), (wc[0] - .2, wc[1] + .3)]
        for y0, y1 in ((.5, .7), (-.7, -.5)):
            prism(mesh, wprof, y0, y1, 'y', 'accent', shade=.95)
            prism(mesh, armp, y0, y1, 'y', 'bark', shade=.85)
        box(mesh, (-4.2, -.32, .45), (-3.5, .32, 1.1), 'bark', shade=.8)
    return build


# ---------------------------------------------------------------- buffalo grass

def buffalograss(width, tufts, heads):
    """A patch of shortgrass sod: a low mat (leaf, dark) under many tiny
    curly tufts, and a few taller blue grama stems each carrying its sickle
    'eyebrow' seed head (accent) off to one side."""
    def build(mesh, rng):
        R = width * .5
        for x in lowball(mesh, V((0, 0, -.012)), (R * .42, R * .42, .022), 'leaf', rng, u=10, v=4, jitter=.25):
            mesh.paint[x] = (.5, .5, .5, 0.0)
        # Round 10: an upright tuft in the middle, the rest packed inward, so
        # the sod has no bare centre.
        ct.tuft(mesh, rng, V((0, 0, .01)), blades=9, height=.13, width=.01, spread=.1, lean=.35,
                low='leaf', tip='leaf', dark=.6, light=1.15)
        for k in range(tufts):
            a = k * ct.GOLDEN
            r = R * .66 * math.sqrt((k + .5) / tufts)
            root = V((math.cos(a) * r, math.sin(a) * r, .01))
            ct.tuft(mesh, rng, root, blades=7, height=rng.uniform(.08, .14), width=.01, spread=.12, lean=.9,
                    low='leaf', tip='leaf', dark=.6, light=1.15)
        for k in range(heads):
            root = drift(rng, R * .5)
            h = rng.uniform(.18, .26)
            top = root + UP * h + drift(rng, .04)
            mesh.add_tube([root, root.lerp(top, .6) + drift(rng, .01), top], [.004, .0035, .003], 4, 'leaf',
                          shade=lambda co, t: .8 + .3 * t, flex=lambda co, t: .3 + .6 * t, cap_end=False)
            e = heading(rng.uniform(0, math.tau))
            p1, p2 = top + e * .016 + UP * .01, top + e * .034 + UP * .003
            rod(mesh, [top, p1, p2], .004, 'accent', s=1.0)
            twosided(mesh, [top, p1, p2, p2 - UP * .009 - e * .003, top + e * .015 - UP * .005], 'accent',
                     V((-e.y, e.x, 0)), shade=.9, flex=.9)
    return build


# ---------------------------------------------------------------- wild sunflower

def flake(mesh, base, d, length, half, role, droop, lo=.7, hi=1.05, flex=.6):
    """A broad pointed leaf: a diamond from the stem, drooping at its tip."""
    d = d.normalized()
    side = V((-d.y, d.x, 0))
    m = base + d * length * .45 + UP * length * .06
    tip = base + d * length - UP * droop
    for pp, s in (([base, m - side * half, tip, m + side * half], 1), ([base, m + side * half, tip, m - side * half], -1)):
        vs = [mesh.bm.verts.new(p) for p in pp]
        f = mesh.bm.faces.new(vs)
        f.material_index = mesh.slot(role)
        f.smooth = True
        for x in vs:
            t = (x.co - base).length / length
            val = lo + (hi - lo) * t
            mesh.paint[x] = (val, val, val, flex)
            mesh.normal[x] = (UP * .7 * s + d * .3).normalized()


def sunflower(height, stalks, heads):
    """A clump of wild sunflowers: a few tall rough stalks from one root,
    coarse broad leaves alternating up them, branching in their upper half
    into many small heads -- yellow rays (accent) round a dark disc (bark),
    every head facing -Y."""
    def build(mesh, rng):
        fr = random.Random(rng.random())
        for s in range(stalks):
            a = s / stalks * math.tau + rng.uniform(-.4, .4)
            d = heading(a)
            h = height * rng.uniform(.72, 1.0)
            base = d * rng.uniform(.03, .1)
            top = base + d * h * .1 + UP * h + drift(rng, .05)
            pts = [base, base.lerp(top, .35) + drift(rng, .03), base.lerp(top, .7) + drift(rng, .03), top]
            mesh.add_tube(pts, [.018, .014, .01, .007], 5, 'leaf', rng=rng, wobble=.1,
                          shade=lambda co, t: .7 + .35 * t, flex=lambda co, t: .2 + .6 * t, cap_end=False)
            for k in range(6):
                f = .12 + .1 * k
                p = base.lerp(top, f)
                L = .22 * (1 - .5 * f) + .05
                flake(mesh, p, heading(a + k * 2.4), L, L * .36, 'leaf', L * .35)
            for k in range(heads):
                if k == 0:
                    hp, R = top, .07
                else:
                    st = base.lerp(top, .42 + .1 * k + fr.uniform(-.04, .04))
                    e = heading(a + (k - 1) * 2.3 + fr.uniform(-.4, .4))
                    hp = st + e * fr.uniform(.18, .3) + UP * fr.uniform(.12, .26)
                    R = .055
                    mesh.add_tube([st, st.lerp(hp, .5) + UP * .04, hp], [.009, .007, .005], 4, 'leaf',
                                  shade=lambda co, t: .8 + .3 * t, flex=lambda co, t: .5 + .4 * t, cap_end=False)
                for x in lowball(mesh, hp + V((0, -.012, 0)), (R, R * .28, R), 'accent', fr, u=7, v=3, jitter=.3):
                    mesh.paint[x] = (1.0, 1.0, 1.0, .8)
                # Round 9 (cost): the dark disc is a flat pentagon on the
                # rays' face, 3 triangles, not a 24-triangle lump.
                dy = hp.y - .014 - R * .3
                facing(mesh, [V((hp.x + math.cos(k / 5 * math.tau + .3) * R * .42, dy,
                                 hp.z + math.sin(k / 5 * math.tau + .3) * R * .42)) for k in range(5)],
                       'bark', V((0, -1, 0)), shade=.9, flex=.8)
    return build


MODELS = [
    ('Blender_SoapweedYucca_1', soapweed(120, .62, 2)),
    ('Blender_EasternRedCedar_1', redcedar(8.5, 4.0, .9, .03, 9)),
    ('Blender_EasternRedCedar_2', redcedar(5.5, 4.6, 1.15, .03, 7)),
    ('Blender_Shelterbelt_1', shelterbelt(30, 10, 8)),
    ('Blender_Windmill_1', windmill(10, 1.5, 18)),
    ('Blender_BarbedWireFence_1', fence(10, 3, 4)),
    ('Blender_GrainElevator_1', elevator(30, 3.2, 4)),
    ('Blender_PumpJack_1', pumpjack(4.4, 3.8)),
    ('Blender_Buffalograss_1', buffalograss(.8, 11, 9)),
    ('Blender_WildSunflower_1', sunflower(2.0, 5, 4)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Role colours per season, from each spec's Seasons table (props from their
# Spec colours; they do not change). Deciduous trees are drawn in leaf (bare
# variants come later), so a winter keeps the summer leaf. An accent with no
# flowers that season is drawn as the plant's own part would be.
_SUN = {'spring': {'leaf': '#7a9a4a', 'accent': '#7a9a4a', 'bark': '#7a9a4a'},
        'summer': {'leaf': '#5a7a3a', 'accent': '#f0c020', 'bark': '#5a3a1e'},
        'autumn': {'leaf': '#8a8a4a', 'accent': '#c09a2a', 'bark': '#4a3420'},
        'winter': {'leaf': '#7a6a4a', 'accent': '#7a6a4a', 'bark': '#5a4a36'}}
LOOK = {
    'SoapweedYucca': {s: {'leaf': '#768656' if s == 'winter' else '#7a8a5a', 'bark': '#9a8a62',
                          'accent': {'spring': '#efe8c8', 'summer': '#efe8c8', 'autumn': '#8a7a52',
                                     'winter': '#6e604a'}[s]} for s in ('spring', 'summer', 'autumn', 'winter')},
    'EasternRedCedar': {s: {'leaf': h, 'bark': '#7a4a34'} for s, h in
                 (('spring', '#476e3a'), ('summer', '#436a36'), ('autumn', '#466a3a'), ('winter', '#6a6a3e'))},
    'Shelterbelt': {s: {'leaf': lf, 'accent': ac, 'bark': '#5e564c'} for s, lf, ac in
                    (('spring', '#8fae5a', '#476e3a'), ('summer', '#4f7a36', '#436a36'),
                     ('autumn', '#c8a83a', '#466a3a'), ('winter', '#4f7a36', '#6a6a3e'))},
    'Windmill': {s: {'bark': '#9a9a94', 'accent': '#b04a32', 'stone': '#8a8c86', 'leaf': '#4a5e58'}
                 for s in ('spring', 'summer', 'autumn', 'winter')},
    'BarbedWireFence': {s: {'bark': '#6a5a4a', 'stone': '#4e5848', 'accent': '#8a8a8a'}
                        for s in ('spring', 'summer', 'autumn', 'winter')},
    'GrainElevator': {s: {'stone': '#d8d4c8', 'bark': '#4a4846', 'accent': '#9a5a3a', 'leaf': '#b0b2ae'}
                      for s in ('spring', 'summer', 'autumn', 'winter')},
    'PumpJack': {s: {'bark': '#3a3a3a', 'accent': '#b04a32', 'stone': '#6a6a6a', 'leaf': '#a8a8a4'}
                 for s in ('spring', 'summer', 'autumn', 'winter')},
    'Buffalograss': {s: {'leaf': lf, 'accent': ac} for s, lf, ac in
                     (('spring', '#9aa86a', '#9aa86a'), ('summer', '#8a9a6a', '#7a5a6a'),
                      ('autumn', '#c0a070', '#c8b07a'), ('winter', '#b0986a', '#b8a070'))},
    'WildSunflower': _SUN,
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        out[name] = {role: hexrgb(h) for role, h in LOOK[sp][season].items()}
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.85, 0.75, 0.3),
                           'stone': (0.69, 0.68, 0.64)},
          far={'Blender_Shelterbelt_1', 'Blender_GrainElevator_1'},
          tints=tints(SEASON))
