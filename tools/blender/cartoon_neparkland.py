# THE NORTHEAST PARKLAND PACK (the US landscapes goal, 2 November 2026;
# PLAN.md section 5, local): what the Old Northeast and the Pine Barrens
# lacked -- the copper beech of the old estate courses, the pitch pine and
# scrub oak of the Pine Barrens, the coastal shrubs (bayberry, the rugosa
# beach rose, the clubhouse hydrangea), a Long Island shingled smock windmill
# and a Tudor-revival clubhouse.
#
#   node tools/blender/iterate.mjs cartoon_neparkland <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): none may read as the game's
# American beech (a broad LOW dome on long level limbs, trunk showing), elm
# (vase), white pine (level shelves of flat stars), pine or black oak. The
# copper beech is a tall full haystack dome sweeping down to the ground, its
# trunk only a dark slot at the foot; the pitch pine a crooked dark trunk
# under an open, irregular crown of separate round needle tufts with sky
# between, tufts sprouting from the trunk itself; the scrub oak a low,
# ragged, flat-topped thicket wider than tall; the bayberry a tidy dome of
# small leaves; the beach rose a lumpy prickly mound with canes poking out,
# pink flowers and red hips; the hydrangea a mound studded with big blue
# balls.
#
# REFS copperbeech=Blender_CopperBeech_1,Blender_CopperBeech_2
# REFS pitchpine=Blender_PitchPine_1,Blender_PitchPine_2
# REFS scruboak=Blender_ScrubOak_1
# REFS bayberry=Blender_Bayberry_1
# REFS beachrose=Blender_BeachRose_1
# REFS hydrangea=Blender_Hydrangea_1
# REFS shingledwindmill=Blender_ShingledWindmill_1
# REFS tudorclubhouse=Blender_TudorClubhouse_1
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


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered (64 triangles at 8 x 5)."""
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
    for x in lowball(mesh, q, radii, role, rng, u, v, jitter):
        out = x.co - c
        out = out.normalized() if out.length > 1e-6 else UP
        n = (mesh.normal[x] * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = shade(x.co, n) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0] * bright, mm[1] * bright, mm[2] * bright, flex)


def two_sided(mesh, pts, role, shade=1.0, flex=0.0, normal=UP):
    """A flat polygon drawn from both sides (a flower)."""
    for poly in (pts, list(reversed(pts))):
        f = mesh.face(poly, role, smooth=True)
        for v in f.verts:
            mesh.paint[v] = (shade, shade, shade, flex)
            mesh.normal[v] = normal


def facing(mesh, pts, role, out, shade=1.0):
    """A one-sided polygon wound so its front faces `out` (buildings)."""
    n = Vector((0, 0, 0))
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n += a.cross(b)
    if n.dot(out) < 0:
        pts = list(reversed(pts))
    f = mesh.face(pts, role)
    for v in f.verts:
        s = shade if isinstance(shade, tuple) else (shade, shade, shade)
        mesh.paint[v] = (*s, 0.0)
    return f


def strip(mesh, a, b, w, out, role, shade=1.0, off=.06):
    """A flat timber or trim strip from a to b, w wide, lying on a wall
    whose outside is `out`, standing `off` proud of it."""
    side = (b - a).cross(out).normalized() * (w * .5)
    o = out.normalized() * off
    facing(mesh, [a - side + o, b - side + o, b + side + o, a + side + o], role, out, shade)


def box(mesh, lo, hi, role, shade=1.0, top=True):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    sh = shade if isinstance(shade, tuple) else (shade, shade, shade)
    facing(mesh, [V((x0, y0, z0)), V((x1, y0, z0)), V((x1, y0, z1)), V((x0, y0, z1))], role, V((0, -1, 0)), sh)
    facing(mesh, [V((x0, y1, z0)), V((x1, y1, z0)), V((x1, y1, z1)), V((x0, y1, z1))], role, V((0, 1, 0)), sh)
    facing(mesh, [V((x0, y0, z0)), V((x0, y1, z0)), V((x0, y1, z1)), V((x0, y0, z1))], role, V((-1, 0, 0)), sh)
    facing(mesh, [V((x1, y0, z0)), V((x1, y1, z0)), V((x1, y1, z1)), V((x1, y0, z1))], role, V((1, 0, 0)), sh)
    if top:
        facing(mesh, [V((x0, y0, z1)), V((x1, y0, z1)), V((x1, y1, z1)), V((x0, y1, z1))], role, UP,
               tuple(min(1.3, k * 1.08) for k in sh))


def roofplane(mesh, q, up_normal, role='bark', shade=1.0):
    n = up_normal if up_normal.z >= 0 else -up_normal
    facing(mesh, q, role, n, shade)
    facing(mesh, q, role, -n, shade * .6)


# ---------------------------------------------------------------- copper beech

def copperbeech(height, spread, stems):
    """Copper beech: a short, massive, smooth grey trunk forking low into a
    few thick limbs, hidden under one tall full dome of dense purple leaf
    that sweeps down nearly to the grass all round -- a haystack, as tall as
    it is wide, its lower edge hanging in a fringe."""
    def build(mesh, rng):
        H, R = height, spread * .5
        # Round 5: a short thick bole forking at a tenth of the height into
        # stout steep stems that show under the hem (01's fork).
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .11, H * .06, lean=drift(rng, H * .005), steps=4,
                              sides=10, flare=1.7, bend=H * .005, shade_low=.95, shade_high=1.1, wobble=.04)
        top = pts[-1]
        c = UP * H * .5
        # Round 3: a brighter sun side (the dark purple went flat).
        shade = ct.crown_shade(c, (R, R, H * .5), low=.42, high=1.4)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            d = heading(a0 + s / stems * math.tau + rng.uniform(-.3, .3))
            end = top + d * R * .4 + UP * H * rng.uniform(.38, .48)
            ct.limb(mesh, rng, pts[-2], end, radii[-1] * .75, radii[-1] * .3, sides=7, bow=.04, shade=1.05)
        # The shell: rings of lobes on a dome profile widest a third of the
        # way up and staying wide to a hanging rim near the ground.
        # Round 2: an upright egg (widest at 0.42 of the height), its hem
        # lifted to a fifth of the height so the grey stems show, and many
        # smaller lobes for a finer edge.
        # Round 3: hem at about a fifth of the height, egg widest at half.
        z0 = .5

        def prof(zf):
            if zf >= z0:
                return math.sqrt(max(0.0, 1 - ((zf - z0) / (1 - z0)) ** 2))
            return math.sqrt(max(0.0, 1 - ((z0 - zf) / (z0 - .12)) ** 2 * .45))
        levels = (.33, .41, .5, .59, .68, .77, .85, .92)
        for li, zf in enumerate(levels):
            r = prof(zf)
            n = max(3, int(round(7.0 * r + .4)))
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                s = R * rng.uniform(.23, .28)
                q = heading(a) * (R * r - s * .5) + UP * H * zf
                tall = .9
                ball(mesh, rng, q, (s, s, s * tall), c, shade, jitter=.2, u=8, v=5,
                     bend=.55)
        s = R * .36
        ball(mesh, rng, UP * (H - s * .75), (s, s, s * .8), c, shade, jitter=.15, u=8, v=5, bend=.55)
        # Round 11: two big inner masses fill the holes between the shell's
        # lobes (they showed as dark pits and a notch in the top).
        for zf in (.55, .74):
            s = R * .62 * prof(zf)
            ball(mesh, rng, UP * H * zf, (s, s, H * .16), c, shade, jitter=.1, u=8, v=5, bend=.7)
        # Round 6: a fringe of small hanging lobes round the hem -- the
        # drooping branch ends that soften 01's and 02's lower edge.
        for i in range(12):
            a = a0 + (i + .3) / 12 * math.tau + rng.uniform(-.1, .1)
            s = R * rng.uniform(.11, .14)
            q = heading(a) * R * prof(.38) * rng.uniform(.86, .96) + UP * H * rng.uniform(.3, .34)
            ball(mesh, rng, q, (s, s, s * 1.5), c, shade, jitter=.2, u=8, v=5, bend=.5)
        # Round 4: an underside of flat lobes round the stems, so the
        # crown's hollow does not show from below as dark petals.
        for i in range(5):
            a = a0 + (i + .5) / 5 * math.tau
            s = R * .3
            ball(mesh, rng, heading(a) * R * .42 + UP * H * .36, (s, s, s * .55), c, shade, jitter=.15, u=8, v=5, bend=.55)
    return build


# ---------------------------------------------------------------- pitch pine

def pitchpine(height, spread, lean, limbs, open_):
    """Pitch pine: a dark crooked trunk kinking up and leaning, crooked
    limbs leaving it at odd heights and angles, each ending in a few round
    needle tufts; the crown an irregular open scatter of tufts with sky
    between, and small tufts sprouting straight from the trunk below it.
    `open_` 0..1: how far apart the tufts sit (1 the gnarled barrens tree,
    0.4 a bushier one)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        la = rng.uniform(0, math.tau)
        ld = heading(la) * H * lean
        side = heading(la + math.pi / 2)
        zs = (0, .2, .42, .62, .8, .94)
        kink = (0, .5, -.6, .45, -.2, .25)
        path = [ld * (z * z) + side * (k * H * .035) + UP * H * z for z, k in zip(zs, kink)]
        radii = bark_tube(mesh, rng, path, H * .032, H * .008, 6, shade=(.7, .95), wobble=.14)
        c = UP * H * .62 + ld * .4
        shade = ct.crown_shade(c, (R, R, H * .35), low=.42, high=1.18)

        def tuft(q, s, n=3):
            for m in range(n):
                o = drift(rng, s * .6) + UP * s * rng.uniform(-.25, .3)
                k = s * rng.uniform(.55, .7)
                p = q + o
                ball(mesh, rng, p, (k, k, k * .8), c, shade, jitter=.3, u=5, v=3, bend=.45)
                # Round 3: needle spikes radiating from each tuft, so its edge
                # bristles (a pine's pompom, not a broadleaf's soft lobe).
                b0 = rng.uniform(0, math.tau)
                # Round 5: seven thin long needles a tuft, tilted up -- a
                # brush of needles, not a holly leaf.
                nn = 2 if ct.FAR else 7
                for j in range(nn):
                    b = b0 + j / nn * math.tau
                    dd = heading(b) + UP * rng.uniform(-.1, .9)
                    dd.normalize()
                    tip = p + dd * k * rng.uniform(1.5, 1.9)
                    mesh.add_tube([p + dd * k * .4, tip], [k * .17, k * .01], 3, 'leaf', cap_end=False,
                                  shade=lambda co, t: shade(co, (co - c).normalized() if (co - c).length > 1e-6 else UP),
                                  flex=lambda co, t: .8)
        # Round 2: longer limbs reaching the full spread (longest low, the
        # crown a broad irregular head), a cluster of four rounder tufts at
        # each end and another part-way, so the crown is full but gappy.
        a0 = rng.uniform(0, math.tau)
        for i in range(limbs):
            f = .3 + .64 * i / max(1, limbs - 1)
            seg = min(len(path) - 2, int(f * (len(path) - 1)))
            t = f * (len(path) - 1) - seg
            p = path[seg].lerp(path[seg + 1], t)
            d = heading(a0 + i * 2.4 + rng.uniform(-.4, .4))
            reach = R * rng.uniform(.8, 1.0) * (1.0 - .35 * f)
            droop = H * rng.uniform(-.07, .0)
            k1 = p + d * reach * .5 + UP * droop + drift(rng, reach * .15)
            end = p + d * reach + UP * (droop + H * rng.uniform(.05, .12))
            r = radii[seg] * .5
            ct.limb(mesh, rng, p, k1, r, r * .6, sides=4, bow=-.1)
            ct.limb(mesh, rng, k1, end, r * .6, r * .25, sides=4, bow=.25)
            # Round 6: bigger tufts, two part-way -- a fuller head.
            s = R * rng.uniform(.27, .32) * (1.1 - .2 * open_)
            tuft(end + UP * s * .3, s, 3)
            tuft(k1 + UP * s * .45, s * .8, 2)
        s = R * .22
        tuft(path[-1] + UP * s * .4, s, 3)
        # Tufts sprouting from the trunk itself (the pitch pine's mark).
        for k in range(0 if ct.FAR else 5):
            z = rng.uniform(.12, .34)
            seg = 0 if z < .2 else 1
            p = path[seg].lerp(path[seg + 1], (z - zs[seg]) / (zs[seg + 1] - zs[seg]))
            dd = heading(rng.uniform(0, math.tau))
            s = R * .07
            ball(mesh, rng, p + dd * (radii[seg] + s * .6), (s, s, s * .8), c, shade, jitter=.3, u=7, v=4, bend=.3)
    return build


# ---------------------------------------------------------------- scrub oak

def scruboak(height, spread, stems):
    """Scrub oak: a dense low thicket wider than tall, many thin stems from
    the ground under a ragged, lumpy, roughly flat top of coarse oak leaf,
    a few bare twigs poking above it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.4, high=1.18)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            d = heading(a0 + s / stems * math.tau + rng.uniform(-.3, .3))
            ct.limb(mesh, rng, d * R * .15 - UP * .05, d * R * .55 + UP * H * .6, H * .022, H * .008, sides=4, bow=.1)
        # Round 2: lower and wider, smaller lobes, a flat ragged top.
        for zf, rf, n, sf in ((.35, .8, 9, .24), (.68, .58, 7, .24), (.78, .22, 3, .24)):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                s = R * sf * rng.uniform(.85, 1.15)
                q = heading(a) * R * rf * rng.uniform(.9, 1.08) + UP * H * zf * rng.uniform(.92, 1.08)
                ball(mesh, rng, q, (s, s, s * .7), c, shade, jitter=.3, u=8, v=5, bend=.5)
        for k in range(4):
            p = heading(a0 + k * 1.7) * R * .4 + UP * H * .7
            ct.limb(mesh, rng, p, p + heading(a0 + k * 1.7) * R * .2 + UP * H * .4, H * .01, H * .003, sides=4, bow=.1)
    return build


# ---------------------------------------------------------------- bayberry

def bayberry(height, spread):
    """Bayberry: a dense, tidy, rounded dome of small leathery leaves sitting
    down on the sand, clusters of small grey waxy berries (accent) along its
    outside."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .45
        shade = ct.crown_shade(c, (R, R, H * .5), low=.42, high=1.2)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        spots = []
        # Round 12: more, smaller lobes in four rings -- a finer, tidier
        # skin than the scrub oak's coarse ragged lobes.
        for zf, rf, n, sf in ((.2, .86, 11, .2), (.45, .84, 11, .2), (.68, .66, 9, .2), (.86, .34, 5, .2)):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                s = R * sf * rng.uniform(.92, 1.08)
                q = heading(a) * R * rf + UP * H * zf
                ball(mesh, rng, q, (s, s, s), c, shade, jitter=.14, u=7, v=5, bend=.65)
                spots.append((q, s, a))
        s = R * .32
        ball(mesh, rng, UP * (H - s * .9), (s, s, s * .9), c, shade, jitter=.18, u=8, v=5, bend=.6)
        # Round 13: a core mass behind the lower rings closes the gaps that
        # showed between the low lobes.
        ball(mesh, rng, UP * H * .4, (R * .78, R * .78, H * .38), c, shade, jitter=.08, u=8, v=5, bend=.75)
        # Round 2: bigger berry clusters (four of 6 cm), on most lobes.
        for q, s, a in spots[::2]:
            p = q + heading(a + fr.uniform(-.6, .6)) * s * .85 + UP * s * fr.uniform(-.2, .4)
            for m in range(3):
                b = drift(fr, .07) + UP * fr.uniform(-.05, .05)
                ball(mesh, fr, p + b, (.06, .06, .06), c, None, flex=.6, role='accent', jitter=.1, u=5, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- beach rose

def flower(mesh, p, n, r, role, shade=1.05):
    """A flat five-petalled rose, notched, facing `n`, two-sided."""
    n = n.normalized()
    t = n.cross(UP if abs(n.z) < .9 else Vector((1, 0, 0))).normalized()
    b = n.cross(t)
    pts = []
    for k in range(10):
        a = k / 10 * math.tau
        rr = r if k % 2 == 0 else r * .72
        pts.append(p + (t * math.cos(a) + b * math.sin(a)) * rr)
    two_sided(mesh, pts, role, shade=shade, flex=.7, normal=n)


def beachrose(height, spread):
    """Rugosa beach rose: a dense, lumpy, prickly mound of crinkled leaf, wider
    than tall, upright canes poking out of its top; big flat pink flowers
    (accent) dotted over it and round red hips (stone) beside them."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .45
        shade = ct.crown_shade(c, (R, R, H * .5), low=.42, high=1.2)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        spots = []
        for zf, rf, n, sf in ((.3, .8, 8, .28), (.62, .62, 6, .28), (.88, .25, 3, .26)):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                s = R * sf * rng.uniform(.85, 1.15)
                q = heading(a) * R * rf * rng.uniform(.9, 1.1) + UP * H * zf * rng.uniform(.9, 1.1)
                ball(mesh, rng, q, (s, s, s * .85), c, shade, jitter=.26, u=8, v=5, bend=.55)
                spots.append((q, s, a))
        # Round 2: the canes poke only a little above the mound, bare and
        # prickly-thin (no lollipop tips).
        for k in range(6):
            a = a0 + k * 1.05 + rng.uniform(-.2, .2)
            p = heading(a) * R * .35 + UP * H * .5
            tip = p + heading(a) * R * .25 + UP * H * rng.uniform(.6, .75)
            ct.limb(mesh, rng, p, tip, .02, .006, sides=4, bow=.1)
        for q, s, a in spots:
            d = heading(a + fr.uniform(-.7, .7)) + UP * fr.uniform(.2, .9)
            d.normalize()
            flower(mesh, q + d * s * .95, d, .12, 'accent')
            if fr.random() < .6:
                e = heading(a + fr.uniform(-1.2, 1.2)) + UP * fr.uniform(-.2, .5)
                e.normalize()
                ball(mesh, fr, q + e * s * .95, (.04, .04, .045), c, None, flex=.6, role='stone', jitter=.08, u=5, v=3,
                     bend=.2)
    return build


# ---------------------------------------------------------------- hydrangea

def hydrangea(height, spread):
    """Mophead hydrangea: a rounded mound of big coarse leaves, studded all
    over its top and sides with big round flower heads (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .45
        shade = ct.crown_shade(c, (R, R, H * .5), low=.42, high=1.2)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        spots = []
        for zf, rf, n, sf in ((.28, .78, 7, .3), (.6, .6, 6, .3), (.86, .25, 3, .3)):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                s = R * sf * rng.uniform(.9, 1.1)
                q = heading(a) * R * rf + UP * H * zf
                ball(mesh, rng, q, (s, s, s * .85), c, shade, jitter=.2, u=8, v=5, bend=.55)
                spots.append((q, s, a, zf))
        for q, s, a, zf in spots:
            if zf < .3 and fr.random() < .4:
                continue
            d = heading(a + fr.uniform(-.4, .4)) * (1 - zf * .6) + UP * (.4 + zf)
            d.normalize()
            m = .2 * fr.uniform(.9, 1.15)
            ball(mesh, fr, q + d * s * .8, (m, m, m * .92), c, None, flex=.7, role='accent', jitter=.1, u=9, v=6, bend=.3,
                 bright=fr.uniform(.92, 1.08))
    return build


# ---------------------------------------------------------------- windmill

def windmill(tower, r0, r1, sail):
    """A Long Island smock windmill: a tapered octagonal tower of silver-grey
    shingles (stone) on a low plinth, coursed lines round it, a door and a
    few small windows (dirt); a gabled cap (bark) turned to face -Y, four
    lattice sails (accent) on a shaft out of its front, and a long tail pole
    from the back of the cap down to the ground. Footprint about 2 r0 across;
    the sails stand in the plane y = -(r1 + 1.6)."""
    def build(mesh, rng):
        z0 = .5
        # The plinth.
        for k in range(8):
            a, b = (k - .5) / 8 * math.tau - math.pi / 2, (k + .5) / 8 * math.tau - math.pi / 2
            out = heading((a + b) / 2)
            rp = r0 + .2
            facing(mesh, [heading(a) * rp - UP * .2, heading(b) * rp - UP * .2, heading(b) * rp + UP * z0,
                          heading(a) * rp + UP * z0], 'stone', out, (.62, .6, .56))
            # The tower's faces, one flat side to -Y.
            facing(mesh, [heading(a) * r0 + UP * z0, heading(b) * r0 + UP * z0, heading(b) * r1 + UP * tower,
                          heading(a) * r1 + UP * tower], 'stone', out, 1.0)
            for j in range(1, 8):
                f = j / 8
                z = z0 + (tower - z0) * f
                rr = r0 + (r1 - r0) * f + .04
                strip(mesh, heading(a) * rr + UP * z, heading(b) * rr + UP * z, .12, out, 'stone', .7, off=.0)
        # Round 14: a low white gallery round the foot (the National Golf
        # Links mill, picture 03): an octagonal deck on the plinth's height
        # and a rail of posts with a top rail.
        zg, rg = 1.7, r0 + 1.1
        for k in range(8):
            a, b = (k - .5) / 8 * math.tau - math.pi / 2, (k + .5) / 8 * math.tau - math.pi / 2
            out = heading((a + b) / 2)
            ri = r0 + (r1 - r0) * ((zg - z0) / (tower - z0))
            facing(mesh, [heading(a) * ri + UP * zg, heading(b) * ri + UP * zg, heading(b) * rg + UP * zg, heading(a) * rg + UP * zg],
                   'accent', UP, .95)
            facing(mesh, [heading(a) * rg + UP * (zg - .25), heading(b) * rg + UP * (zg - .25), heading(b) * rg + UP * zg,
                          heading(a) * rg + UP * zg], 'accent', out, .85)
            mesh.add_tube([heading(a) * rg + UP * zg, heading(a) * rg + UP * (zg + 1.0)], [.05, .05], 4, 'accent',
                          shade=lambda co, t: 1.0)
            mesh.add_tube([heading(a) * rg + UP * (zg + 1.0), heading(b) * rg + UP * (zg + 1.0)], [.05, .05], 4, 'accent',
                          shade=lambda co, t: 1.0)
        # The door and small windows.
        # Round 15: the door opens onto the gallery (the deck had cut it).
        fy = -(r0 + (r1 - r0) * ((zg + 1.0 - z0) / (tower - z0))) * math.cos(math.pi / 8)
        facing(mesh, [V((-.6, fy - .06, zg)), V((.6, fy - .06, zg)), V((.6, fy - .06, zg + 2.0)), V((-.6, fy - .06, zg + 2.0))],
               'dirt', V((0, -1, 0)), 1.0)
        for k, z in ((0, 4.6), (2, 3.2), (4, 6.0), (6, 3.8), (0, 7.4)):
            a = k / 8 * math.tau - math.pi / 2
            out = heading(a)
            f = (z - z0) / (tower - z0)
            rr = (r0 + (r1 - r0) * f) * math.cos(math.pi / 8) + .05
            p = out * rr + UP * z
            sd = out.cross(UP).normalized() * .35
            facing(mesh, [p - sd - UP * .4, p + sd - UP * .4, p + sd + UP * .4, p - sd + UP * .4], 'dirt', out, 1.0)
        # The cap: a short shingled box under a gable, ridge along Y.
        cw, cd = r1 + .5, r1 + 1.0
        zt = tower + .9
        box(mesh, (-cw + .2, -cd + .3, tower - .1), (cw - .2, cd - .3, zt), 'stone', .9, top=False)
        ridge = zt + 2.0
        for sx in (-1, 1):
            q = [V((sx * (cw + .3), -cd - .2, zt - .3)), V((sx * (cw + .3), cd + .2, zt - .3)), V((0, cd + .2, ridge)),
                 V((0, -cd - .2, ridge))]
            roofplane(mesh, q, V((sx * 2.0, 0, cw)))
        for sy in (-1, 1):
            facing(mesh, [V((-cw + .2, sy * (cd - .3), zt)), V((cw - .2, sy * (cd - .3), zt)), V((0, sy * (cd - .3), ridge - .2))],
                   'stone', V((0, sy, 0)), .9)
        # The shaft and hub.
        hub = V((0, -cd - 1.0, zt + .2))
        mesh.add_tube([V((0, -cd + .5, zt - .1)), hub], [.25, .22], 6, 'accent', shade=lambda co, t: .8)
        box(mesh, (-.35, hub.y - .35, hub.z - .35), (.35, hub.y + .35, hub.z + .35), 'accent', .85)
        # Four lattice sails in the plane y = hub.y - 0.2, turned off the X.
        y = hub.y - .2
        for k in range(4):
            a = math.radians(60 + 90 * k)
            d = V((math.cos(a), 0, math.sin(a)))
            p = V((-math.sin(a), 0, math.cos(a)))
            h = V((hub.x, y, hub.z))
            mesh.add_tube([h, h + d * sail], [.22, .14], 4, 'accent', shade=lambda co, t: .85)
            s0 = 1.4
            w0, w1 = .15, 1.9
            for wv in (w0, w1):
                mesh.add_tube([h + d * s0 + p * wv - V((0, .08, 0)), h + d * sail + p * wv - V((0, .08, 0))], [.08, .08], 4,
                              'accent', shade=lambda co, t: 1.0)
            nb = int((sail - s0) / .8)
            for j in range(nb + 1):
                sj = s0 + (sail - s0) * j / nb
                mesh.add_tube([h + d * sj + p * w0 - V((0, .08, 0)), h + d * sj + p * w1 - V((0, .08, 0))], [.06, .06], 4,
                              'accent', shade=lambda co, t: 1.0)
            # One long rail down the middle of the lattice.
            mesh.add_tube([h + d * s0 + p * (w0 + w1) * .5 - V((0, .08, 0)), h + d * sail + p * (w0 + w1) * .5 - V((0, .08, 0))],
                          [.04, .04], 4, 'accent', shade=lambda co, t: 1.0)
        # The tail pole from the back of the cap to the ground.
        mesh.add_tube([V((0, cd - .2, tower + .2)), V((0, cd + tower * .62, .4))], [.18, .14], 6, 'accent',
                      shade=lambda co, t: .8)
        for sx in (-1, 1):
            mesh.add_tube([V((sx * cw * .8, cd - .4, tower + .1)), V((0, cd + tower * .3, tower * .5))], [.08, .08], 4,
                          'accent', shade=lambda co, t: .8)
    return build


# ---------------------------------------------------------------- Tudor clubhouse

def timbers(mesh, a, u, length, z0, z1, out, spacing=1.6, braces=True):
    """Half-timbering on a wall rectangle: posts every `spacing` metres
    along `u` from `a`, a sill and a plate, curved-looking braces in some
    panels -- dark strips on the stucco."""
    n = max(1, int(round(length / spacing)))
    sp = length / n
    strip(mesh, a + UP * z0, a + u * length + UP * z0, .26, out, 'accent', 1.0)
    strip(mesh, a + UP * z1, a + u * length + UP * z1, .26, out, 'accent', 1.0)
    for k in range(n + 1):
        p = a + u * (sp * k)
        strip(mesh, p + UP * z0, p + UP * z1, .22, out, 'accent', 1.0)
        if braces and k < n and k % 3 == 1:
            strip(mesh, p + UP * z0, p + u * sp + UP * z1, .18, out, 'accent', .95)
            strip(mesh, p + u * sp + UP * z0, p + UP * z1, .18, out, 'accent', .95)


def window(mesh, centre, u, w, h, out, mullions=2):
    """A leaded window: a dark pane with dark-timber mullions and a frame."""
    sd = u * (w * .5)
    o = out.normalized() * .08
    facing(mesh, [centre - sd - UP * h * .5 + o, centre + sd - UP * h * .5 + o, centre + sd + UP * h * .5 + o,
                  centre - sd + UP * h * .5 + o], 'dirt', out, 1.0)
    for k in range(1, mullions + 1):
        p = centre - sd + u * (w * k / (mullions + 1))
        strip(mesh, p - UP * h * .5, p + UP * h * .5, .09, out, 'accent', 1.0, off=.11)
    strip(mesh, centre - sd + UP * .02, centre + sd + UP * .02, .09, out, 'accent', 1.0, off=.11)


def gable_timbers(mesh, base_l, base_r, apex, out):
    """A gable triangle's timbers: barge-line strips along both rakes, a
    king post, a collar and two struts."""
    mid = base_l.lerp(base_r, .5)
    strip(mesh, base_l, base_r, .26, out, 'accent', 1.0)
    strip(mesh, mid, apex, .24, out, 'accent', 1.0)
    cl, cr = base_l.lerp(apex, .5), base_r.lerp(apex, .5)
    strip(mesh, cl, cr, .22, out, 'accent', 1.0)
    strip(mesh, mid, cl, .2, out, 'accent', .95)
    strip(mesh, mid, cr, .2, out, 'accent', .95)
    for q in (base_l.lerp(base_r, .2), base_l.lerp(base_r, .8)):
        strip(mesh, q, q + UP * ((apex.z - base_l.z) * .38), .2, out, 'accent', 1.0)


STONE = (.5, .49, .46)
BRICK = (.66, .4, .32)


def tudorclubhouse(width, depth):
    """A Tudor-revival clubhouse: a long two-storey block, the ground floor
    grey stone (stone, painted down), the upper floor cream stucco crossed by
    dark half-timbering (accent); a steep slate roof (bark) with its ridge
    along X, three cross gables on the front (-Y), the middle one biggest
    over the entrance, half-timbered gable faces, leaded windows (dirt), and
    four tall brick chimneys. Footprint `width` x `depth` plus the gables'
    projection; front -Y."""
    def build(mesh, rng):
        W, D = width * .5, depth * .5
        g, top = 4.0, 7.6
        rise = D * .95
        ridge = top + rise
        X, Y = V((1, 0, 0)), V((0, 1, 0))
        # Main block walls.
        for y, out in ((-D, -Y), (D, Y)):
            facing(mesh, [V((-W, y, 0)), V((W, y, 0)), V((W, y, g)), V((-W, y, g))], 'stone', out, STONE)
            facing(mesh, [V((-W, y, g)), V((W, y, g)), V((W, y, top)), V((-W, y, top))], 'stone', out, 1.0)
            timbers(mesh, V((-W, y, 0)), X, 2 * W, g + .1, top - .1, out)
        for x, out in ((-W, -X), (W, X)):
            facing(mesh, [V((x, -D, 0)), V((x, D, 0)), V((x, D, g)), V((x, -D, g))], 'stone', out, STONE)
            facing(mesh, [V((x, -D, g)), V((x, D, g)), V((x, D, top)), V((x, -D, top))], 'stone', out, 1.0)
            facing(mesh, [V((x, -D, top)), V((x, D, top)), V((x, 0, ridge))], 'stone', out, 1.0)
            timbers(mesh, V((x, -D, 0)), Y, 2 * D, g + .1, top - .1, out, braces=False)
            gable_timbers(mesh, V((x, -D, top)), V((x, D, top)), V((x, 0, ridge)), out)
            for yy in (-D * .5, D * .5):
                window(mesh, V((x, yy, 2.0)), Y, 1.8, 1.6, out)
                window(mesh, V((x, yy, 5.8)), Y, 1.6, 1.3, out)
        o = 1.0
        for sy in (-1, 1):
            q = [V((-W - o, sy * (D + o), top - o * 1.15)), V((W + o, sy * (D + o), top - o * 1.15)), V((W + o, 0, ridge)),
                 V((-W - o, 0, ridge))]
            roofplane(mesh, q, V((0, sy * rise, D)))
        # Back wall windows.
        for k in range(8):
            x = -W + (k + .5) * 2 * W / 8
            window(mesh, V((x, D, 2.0)), X, 1.8, 1.6, Y)
            window(mesh, V((x, D, 5.8)), X, 1.5, 1.3, Y)
        # Cross gables on the front.
        gables = ((0.0, 6.5, 4.0), (-W + 5.0, 4.5, 2.6), (W - 5.0, 4.5, 2.6))
        for gx, gw, proj in gables:
            yf = -D - proj
            grise = gw * 1.15
            gr = top + grise
            x0, x1 = gx - gw, gx + gw
            facing(mesh, [V((x0, yf, 0)), V((x1, yf, 0)), V((x1, yf, g)), V((x0, yf, g))], 'stone', -Y, STONE)
            # The upper storey jettied out over the stone.
            j = .35
            facing(mesh, [V((x0, yf - j, g)), V((x1, yf - j, g)), V((x1, yf - j, top)), V((x0, yf - j, top))], 'stone', -Y, 1.0)
            facing(mesh, [V((x0, yf - j, top)), V((x1, yf - j, top)), V((gx, yf - j, gr))], 'stone', -Y, 1.0)
            facing(mesh, [V((x0, yf - j, g)), V((x1, yf - j, g)), V((x1, yf, g)), V((x0, yf, g))], 'accent', -UP, .7)
            timbers(mesh, V((x0, yf - j, 0)), X, 2 * gw, g + .1, top - .1, -Y, spacing=1.3)
            gable_timbers(mesh, V((x0, yf - j, top)), V((x1, yf - j, top)), V((gx, yf - j, gr)), -Y)
            for x, out in ((x0, -X), (x1, X)):
                facing(mesh, [V((x, yf, 0)), V((x, -D, 0)), V((x, -D, g)), V((x, yf, g))], 'stone', out, STONE)
                facing(mesh, [V((x, yf - j, g)), V((x, -D, g)), V((x, -D, top)), V((x, yf - j, top))], 'stone', out, 1.0)
            for sx in (-1, 1):
                q = [V((gx + sx * (gw + o), yf - j - o, top - o * 1.15)), V((gx + sx * (gw + o), -D * .2, top - o * 1.15)),
                     V((gx, -D * .2, gr)), V((gx, yf - j - o, gr))]
                roofplane(mesh, q, V((sx * grise, 0, gw)))
            # Windows: a wide leaded band upstairs, stone-mullioned below.
            window(mesh, V((gx, yf - j, 5.8)), X, gw * 1.3, 1.5, -Y, mullions=4)
            if gx == 0.0:
                facing(mesh, [V((gx - 1.3, yf - .08, 0)), V((gx + 1.3, yf - .08, 0)), V((gx + 1.3, yf - .08, 2.9)),
                              V((gx, yf - .08, 3.4)), V((gx - 1.3, yf - .08, 2.9))], 'dirt', -Y, 1.0)
                strip(mesh, V((gx - 1.5, yf, 0)), V((gx - 1.5, yf, 3.0)), .3, -Y, 'stone', (.8, .8, .78), off=.12)
                strip(mesh, V((gx + 1.5, yf, 0)), V((gx + 1.5, yf, 3.0)), .3, -Y, 'stone', (.8, .8, .78), off=.12)
                for sx in (-1, 1):
                    window(mesh, V((gx + sx * 3.8, yf, 2.0)), X, 2.0, 1.7, -Y, mullions=3)
            else:
                window(mesh, V((gx, yf, 2.0)), X, gw * 1.2, 1.7, -Y, mullions=4)
        # Windows on the front between the gables.
        for x in (-W + 11.0, -W + 14.5, W - 14.5, W - 11.0):
            window(mesh, V((x, -D, 2.0)), X, 1.8, 1.6, -Y)
            window(mesh, V((x, -D, 5.8)), X, 1.5, 1.3, -Y)
        # Tall chimneys: brick stacks through the roof, pots on top.
        for cx, cy in ((-W + 9.0, D * .35), (-3.5, -D * .25), (W - 9.0, D * .35), (W - .9, 0.0)):
            hz = ridge + 2.6
            # Round 9: stouter, darker brick stacks with three pots.
            box(mesh, (cx - 1.1, cy - .65, top), (cx + 1.1, cy + .65, hz), 'stone', BRICK)
            box(mesh, (cx - 1.25, cy - .8, hz), (cx + 1.25, cy + .8, hz + .35), 'stone', (.58, .36, .3))
            for k in (-1, 0, 1):
                mesh.add_tube([V((cx + k * .7, cy, hz + .35)), V((cx + k * .7, cy, hz + 1.2))], [.22, .18], 6, 'stone',
                              shade=lambda co, t: (.62, .38, .3))
    return build


MODELS = [
    ('Blender_CopperBeech_1', copperbeech(25, 22, 4)),
    ('Blender_CopperBeech_2', copperbeech(20, 22, 3)),
    ('Blender_PitchPine_1', pitchpine(16, 12, .1, 11, 1.0)),
    ('Blender_PitchPine_2', pitchpine(11, 11, .04, 11, .4)),
    ('Blender_ScrubOak_1', scruboak(1.2, 2.8, 7)),
    ('Blender_Bayberry_1', bayberry(1.8, 2.2)),
    ('Blender_BeachRose_1', beachrose(1.3, 2.2)),
    ('Blender_Hydrangea_1', hydrangea(1.4, 1.8)),
    ('Blender_ShingledWindmill_1', windmill(9.0, 3.4, 2.1, 9.5)),
    ('Blender_TudorClubhouse_1', tudorclubhouse(48.0, 14.0)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Each species' role colours by season, from the study's models/<id>.md
# *Seasons*. Deciduous trees are drawn in leaf (their bare variants come
# later): a bare winter keeps the summer leaf, except where the spec says
# leaves are held (the scrub oak's dry ones). An accent with no flowers or
# fruit that season is drawn the leaf's colour.
def same(d):
    return {s: d for s in ('spring', 'summer', 'autumn', 'winter')}


LOOK = {
    'CopperBeech': {'spring': {'leaf': '#7a3a3e', 'bark': '#8a8a86'}, 'summer': {'leaf': '#5a3036', 'bark': '#8a8a86'},
                    'autumn': {'leaf': '#9a5a32', 'bark': '#8a8a86'}, 'winter': {'leaf': '#5a3036', 'bark': '#8a8a86'}},
    'PitchPine': {'spring': {'leaf': '#6e8a46', 'bark': '#3e3530'}, 'summer': {'leaf': '#647e40', 'bark': '#3e3530'},
                  'autumn': {'leaf': '#647e40', 'bark': '#3e3530'}, 'winter': {'leaf': '#607a3e', 'bark': '#3e3530'}},
    'ScrubOak': {'spring': {'leaf': '#9ab05a', 'bark': '#5a4e44'}, 'summer': {'leaf': '#4f7036', 'bark': '#5a4e44'},
                 'autumn': {'leaf': '#9a4a2e', 'bark': '#5a4e44'}, 'winter': {'leaf': '#8a6a4a', 'bark': '#5a4e44'}},
    'Bayberry': {'spring': {'leaf': '#6a8a4a', 'bark': '#6a5e52', 'accent': '#f0ece0'},
                 'summer': {'leaf': '#5a7a3e', 'bark': '#6a5e52', 'accent': '#a4a8a4'},
                 'autumn': {'leaf': '#7a6a3a', 'bark': '#6a5e52', 'accent': '#5a3a6a'},
                 'winter': {'leaf': '#5e6e40', 'bark': '#6a5e52', 'accent': '#a4a8a4'}},
    'BeachRose': {'spring': {'leaf': '#7a9a4a', 'bark': '#6a4a3a', 'accent': '#7a9a4a', 'stone': '#7a9a4a'},
                  'summer': {'leaf': '#4e7a36', 'bark': '#6a4a3a', 'accent': '#d2508a', 'stone': '#c8402a'},
                  'autumn': {'leaf': '#c8a640', 'bark': '#6a4a3a', 'accent': '#e0782e', 'stone': '#e0782e'},
                  'winter': {'leaf': '#4e7a36', 'bark': '#6a4a3a', 'accent': '#b83a2a', 'stone': '#b83a2a'}},
    'Hydrangea': {'spring': {'leaf': '#7a9a4a', 'bark': '#6a5a48', 'accent': '#7a9a4a'},
                  'summer': {'leaf': '#4a7a3a', 'bark': '#6a5a48', 'accent': '#6a8ad0'},
                  'autumn': {'leaf': '#6a7a3a', 'bark': '#6a5a48', 'accent': '#a08a7a'},
                  'winter': {'leaf': '#4a7a3a', 'bark': '#6a5a48', 'accent': '#8a7a6a'}},
    'ShingledWindmill': same({'stone': '#9a9488', 'bark': '#6e6a64', 'accent': '#ece8e0', 'dirt': '#34383c'}),
    'TudorClubhouse': same({'stone': '#f2ece0', 'bark': '#6a3a2a', 'accent': '#4a3a2a', 'dirt': '#2a3038'}),
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        out[name] = {role: hexrgb(h) for role, h in LOOK[sp][season].items()}
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.85, 0.72, 0.42),
                           'stone': (0.69, 0.63, 0.48), 'dirt': (0.16, 0.2, 0.24)},
          far={'Blender_CopperBeech_1', 'Blender_CopperBeech_2', 'Blender_PitchPine_1'},
          tints=tints(SEASON))
