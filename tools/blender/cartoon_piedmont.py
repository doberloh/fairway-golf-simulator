# THE PIEDMONT PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): the plants of the Piedmont, the Lowcountry and the
# Ozarks -- the flowering dogwood, the azalea, the southern magnolia, the
# tulip poplar, the crape myrtle, kudzu over a dead tree, the sweetgum and the
# yaupon holly.
#
#   node tools/blender/iterate.mjs cartoon_piedmont <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid. The flowering dogwood is a low-forked broad dome of level layered
# pads with sky between the layers; the azalea a low mound wider than tall,
# smothered in flower; the magnolia a dense broad egg-pyramid of coarse lobes
# down to the ground; the tulip poplar a very tall clean pole under a narrow
# high candle-flame crown; the crape myrtle a vase of bare mottled stems under
# a flat-topped crown with upright panicles; kudzu green towers and curtains
# over a buried tree; the sweetgum a pointed cone of tufts on short level
# branches round a straight leader that shows below; the yaupon an upright
# irregular fine-lobed clump on grey stems.
#
# REFS dogwood=Blender_FloweringDogwood_1
# REFS azalea=Blender_Azalea_1
# REFS magnolia=Blender_Magnolia_1,Blender_Magnolia_2
# REFS tulippoplar=Blender_TulipPoplar_1,Blender_TulipPoplar_2
# REFS crapemyrtle=Blender_CrapeMyrtle_1
# REFS kudzu=Blender_Kudzu_1
# REFS sweetgum=Blender_Sweetgum_1,Blender_Sweetgum_2
# REFS yaupon=Blender_Yaupon_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))


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


def clump(mesh, rng, q, s, c, shade, squash=.75, jitter=.12, flex=.8, tall=None, bottom=.3, role='leaf'):
    sz = s * squash if tall is None else s * tall
    mesh.add_lump(q, (s, s, sz), role, rng, subdiv=3, jitter=jitter, crown=c, blend=.85, shade=shade, flex=flex,
                  squash_bottom=bottom)


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered (cartoon_southoaks' round 11)."""
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


def lclump(mesh, rng, q, radii, c, shade, role='leaf', u=8, v=5, jitter=.15, blend=.8, flex=.8, under=None,
           bottom=0.0):
    """A lowball lobe lit as part of a crown: normals bent toward the crown
    centre `c`, painted by `shade`; `under` an rgb multiplier for the faces
    turned down (a leaf's other colour)."""
    made = lowball(mesh, q, radii, role, rng, u, v, jitter)
    for x in made:
        if bottom and x.co.z < q.z:
            x.co.z = q.z + (x.co.z - q.z) * (1 - bottom)
        own = mesh.normal[x]
        out = x.co - c if c is not None else own
        out = out.normalized() if out.length > 1e-6 else UP
        nn = (own * (1 - blend) + out * blend).normalized()
        mesh.normal[x] = nn
        m = shade(x.co, nn) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        if under and own.z < -.25:
            mm = (mm[0] * under[0], mm[1] * under[1], mm[2] * under[2])
        mesh.paint[x] = (*mm, flex)
    return made


def mottle(co):
    """Smooth patchy bark paint (the crape myrtle's flaking bark)."""
    return .82 + .32 * (.5 + .5 * math.sin(co.x * 7.1 + co.y * 5.3 + co.z * 3.7) * math.sin(co.z * 4.3 - co.x * 2.9 + co.y))


# ---------------------------------------------------------------- flowering dogwood

def dogwood(height, spread, tiers):
    """Flowering dogwood: a short trunk forking low, a thin leader, and level
    branches in layers each carrying flat pads at its end and middle -- a
    broad dome, wider than tall, made of horizontal layers with sky between.
    Accent: flat four-bract flowers on the pads' tops (white in spring, red
    berries in autumn)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .18, H * .034, lean=drift(rng, H * .03), steps=5,
                              sides=8, flare=1.4, bend=H * .02, shade_low=.75, shade_high=.95)
        top = pts[-1]
        lead = top + UP * H * .58 + drift(rng, H * .04)
        ct.limb(mesh, rng, top, lead, radii[-1] * .8, radii[-1] * .25, sides=6, bow=.02)
        c = Vector((0, 0, H * .6))
        shade = ct.crown_shade(c, (R, R, H * .4), low=.58, high=1.22, core=.8)
        a0 = rng.uniform(0, math.tau)
        lv = ((.3, 1.0, 7), (.48, .88, 7), (.66, .66, 5), (.82, .4, 3))[:tiers]
        pads = []
        for ti, (zf, rf, n) in enumerate(lv):
            z = H * zf
            for i in range(n):
                a = a0 + (i + .5 * ti) / n * math.tau + rng.uniform(-.2, .2)
                d = heading(a)
                reach = R * rf * rng.uniform(.8, .95)
                f = max(0.0, min(1.0, (z - H * .08 - top.z) / (lead.z - top.z)))
                start = top.lerp(lead, f)
                end = d * reach * .82 + UP * z
                ct.limb(mesh, rng, start, end, radii[-1] * .45, radii[-1] * .12, sides=4, bow=.04)
                s = R * .32 * (1.05 - .25 * ti / 3) * rng.uniform(.9, 1.1)
                pads.append((end + UP * s * .1, s))
                if ti == 0:
                    s2 = s * .75
                    pads.append((start.lerp(end, .5) + UP * s2 * .25, s2))
        for q, s in pads:
            lclump(mesh, rng, q, (s, s, s * .42), c, shade, u=10, v=5, jitter=.16, bottom=.3)
        # The bracts: three flat white flowers on each pad's top.
        br = random.Random(rng.random())
        for j, (q, s) in enumerate(pads):
            for k in range(2):
                if ct.FAR and k:
                    continue
                p = q + drift(br, s * .55) + UP * s * .3
                lclump(mesh, br, p, (s * .4, s * .4, s * .1), None, None, role='accent', u=5, v=3, jitter=.1,
                       flex=.6)
    return build


# ---------------------------------------------------------------- azalea

def azalea(height, width):
    """Azalea: a low dense mound wider than tall, small lobes all round its
    edge, a few stems at the foot; smothered in flower clusters (the accent)
    all over its skin in spring."""
    def build(mesh, rng):
        H, R = height, width * .5
        c = Vector((0, 0, H * .35))
        shade = ct.crown_shade(c, (R, R, H * .55), low=.55, high=1.15)
        for k in range(4):
            b = drift(rng, R * .12)
            ct.limb(mesh, rng, b, b * 2.5 + UP * H * .45, .035, .015, sides=4, bow=.05)
        a0 = rng.uniform(0, math.tau)
        lobes = []
        for rr, zf, n, sf in ((.85, .2, 11, .24), (.62, .5, 9, .26), (.32, .75, 5, .27), (0, .86, 1, .28)):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau + rng.uniform(-.15, .15)
                q = heading(a) * R * rr * rng.uniform(.92, 1.05) + UP * H * zf * rng.uniform(.92, 1.08)
                s = R * sf * rng.uniform(.88, 1.12)
                lclump(mesh, rng, q, (s, s, s * .85), c, shade, u=8, v=5, jitter=.14, bottom=.35 if zf < .3 else 0)
                lobes.append((q, s))
        fr = random.Random(rng.random())
        for q, s in lobes:
            out = (q - c)
            out.z *= .6
            out = out.normalized()
            for k in range(2):
                p = q + (out + drift(fr, .7) + UP * .25).normalized() * s * .82
                lclump(mesh, fr, p, (s * .32, s * .32, s * .22), None, None, role='accent', u=6, v=3, jitter=.12,
                       flex=.5)
    return build


# ---------------------------------------------------------------- southern magnolia

def magnolia(height, width, lift, oval):
    """Southern magnolia: a dense broad egg-pyramid of coarse glossy lobes
    from the ground (or a little above it, `lift`) to a blunt point, the
    lobes' undersides rusty brown, big white flowers (accent) on its skin."""
    def build(mesh, rng):
        H, R = height, width * .5
        z0 = H * lift
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .55, H * .022, lean=drift(rng, H * .02), steps=6,
                              sides=8, flare=1.5, bend=H * .01, shade_low=.8, shade_high=1.0)
        Hc = H - z0
        c = Vector((0, 0, z0 + Hc * .42))
        shade = ct.crown_shade(c, (R, R, Hc * .5), low=.68, high=1.3)
        under = (1.06, .9, .76)
        a0 = rng.uniform(0, math.tau)
        rings = 7
        skin = []
        for k in range(rings):
            t = (k + .35) / rings
            if oval:
                p = math.sin(math.pi * (.08 + .8 * t)) ** .8 * (1 - .25 * t)
            else:
                p = ((1 - t) ** .85) * (.82 + .18 * min(1.0, t / .2)) / .86
            p = min(1.0, p)
            s = R * (.2 + .13 * p)
            rr = R * p - s * .55
            z = z0 + Hc * t * .93
            if k == 0:
                z = max(z, z0 + s * .55)
            if rr < s * .45:
                lclump(mesh, rng, Vector((0, 0, z)), (s, s, s * 1.0), c, shade, under=under)
                skin.append((Vector((0, 0, z)), s, UP))
                continue
            n = max(3, round(math.tau * rr / (s * 1.3)))
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau + rng.uniform(-.1, .1)
                q = heading(a) * rr * rng.uniform(.86, 1.12) + UP * (z + s * (.35 if i % 2 else -.35) + s * rng.uniform(-.3, .3))
                ss = s * rng.uniform(.88, 1.12)
                lclump(mesh, rng, q, (ss, ss, ss * .85), c, shade, under=under if k else None, bottom=.3 if k == 0 else 0)
                skin.append((q, ss, heading(a)))
            if rr > s * 1.6:
                lclump(mesh, rng, Vector((0, 0, z + s * .2)), (rr * .7, rr * .7, s * .9), c, shade, u=10, v=5)
        fr = random.Random(rng.random())
        fr.shuffle(skin)
        for q, s, d in skin[:14]:
            p = q + d * s * .8 + UP * s * .35
            lclump(mesh, fr, p, (s * .3, s * .3, s * .2), None, None, role='accent', u=6, v=4, jitter=.1, flex=.5)
    return build


# ---------------------------------------------------------------- tulip poplar

def tulippoplar(height, width, clear):
    """Tulip poplar: a very tall, straight, clean trunk and, high on it, a
    narrow upright crown of tufts on short ascending limbs -- a candle flame
    on a pole, a little sky between its tufts."""
    def build(mesh, rng):
        H, R = height, width * .5
        r0 = H * .017
        steps = 12
        tpts, tr = [], []
        lean = drift(rng, H * .012)
        for i in range(steps + 1):
            t = i / steps
            tpts.append(UP * H * .93 * t + lean * t * t)
            tr.append(r0 * (1 - .6 * t) * (1 + .6 * math.exp(-t * 16)))
        mesh.add_tube(tpts, tr, 10, 'bark', rng=rng, wobble=.04, shade=lambda co, t: .8 + .28 * min(1, t * 1.4),
                      flex=lambda co, t: .12 * t * t)
        zc0 = H * clear
        Hc = H - zc0
        c = Vector((0, 0, zc0 + Hc * .55))
        shade = ct.crown_shade(c, (R, R, Hc * .5), low=.5, high=1.2)
        a0 = rng.uniform(0, math.tau)
        n = 14
        for j in range(n):
            f = j / (n - 1)
            z = zc0 + Hc * (.04 + .8 * f)
            i = min(steps, int(round(z / (H * .93) * steps)))
            p = tpts[i]
            prof = math.sin(math.pi * (.06 + .74 * f)) ** .5
            d = heading(a0 + j * 2.4 + rng.uniform(-.2, .2))
            L = R * prof * rng.uniform(.72, .86)
            end = p + d * L + UP * L * .6
            if not ct.FAR:
                ct.limb(mesh, rng, p, end, tr[i] * .5, tr[i] * .15, sides=4, bow=.08)
            s = R * (.34 + .1 * prof) * rng.uniform(.9, 1.1)
            clump(mesh, rng, end + UP * s * .2, s, c, shade, tall=1.15, jitter=.16)
            if prof > .5:
                s2 = s * .8
                clump(mesh, rng, p.lerp(end, .4) + UP * s2 * .7, s2, c, shade, tall=1.1, jitter=.16)
        for k in range(2):
            lclump(mesh, rng, UP * (zc0 + Hc * (.35 + .3 * k)), (R * .55, R * .55, Hc * .2), c, shade, u=10, v=6, jitter=.1)
        s = R * .3
        clump(mesh, rng, tpts[-1] + UP * s * .8, s, c, shade, tall=1.3, jitter=.14)
    return build


# ---------------------------------------------------------------- crape myrtle

def crapemyrtle(height, width, stems):
    """Crape myrtle: several smooth, sinuous, mottled stems from one foot
    fanning out into a vase, a flat-topped crown of lobes on their ends, and
    upright cone-shaped flower panicles (the accent) standing on top."""
    def build(mesh, rng):
        H, R = height, width * .5
        c = Vector((0, 0, H * .74))
        shade = ct.crown_shade(c, (R, R, H * .3), low=.5, high=1.2)
        a0 = rng.uniform(0, math.tau)
        lobes = []
        for k in range(stems):
            a = a0 + k / stems * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            side = Vector((-d.y, d.x, 0))
            base = d * rng.uniform(.05, .16)
            p3 = d * R * rng.uniform(.45, .62) + UP * H * rng.uniform(.46, .54)
            path = bez(base - UP * .05, base + d * R * .08 + UP * H * .25, base + d * R * .4 + UP * H * .42, p3, 6)
            ph = rng.uniform(0, math.tau)
            for i in range(1, len(path)):
                path[i] = path[i] + side * math.sin(i / 6 * math.pi * 1.5 + ph) * R * .06
            rr = rng.uniform(.1, .12) * H / 6
            mesh.add_tube(path, [rr * (1.15 - .6 * i / 6) for i in range(7)], 7, 'bark', rng=rng, wobble=.05,
                          shade=lambda co, t: mottle(co), flex=lambda co, t: .1 + .3 * t)
            for sgn in (-1, 1):
                tw = p3 + heading(a + .55 * sgn) * R * .3 + UP * H * .18
                ct.limb(mesh, rng, p3, tw, rr * .5, rr * .2, sides=4, bow=.1)
                lobes.append((tw + UP * R * .08, R * rng.uniform(.26, .3)))
            lobes.append((p3 + d * R * .1 + UP * H * .14, R * rng.uniform(.28, .32)))
        for k in range(4):
            lobes.append((heading(a0 + k * 1.57 + .4) * R * .42 + UP * H * .82, R * .28))
        for k in range(3):
            lobes.append((heading(a0 + k * 2.1 + 1.0) * R * .3 + UP * H * .7, R * .26))
        for k in range(2):
            lobes.append((heading(a0 + k * 3.1) * R * .15 + UP * H * .93, R * .27))
        for q, s in lobes:
            clump(mesh, rng, q, s, c, shade, squash=.72, jitter=.14)
        pr = random.Random(rng.random())
        for q, s in lobes:
            for k in range(1):
                p = q + drift(pr, s * .4) + UP * s * .7
                lclump(mesh, pr, p, (s * .27, s * .27, s * .6), None, None, role='accent', u=6, v=4, jitter=.12,
                       flex=.7)
    return build


# ---------------------------------------------------------------- kudzu

def kudzu(height, width):
    """Kudzu: a dead tree and the shrubs round it buried under a vine
    blanket -- a lumpy green tower with smothered arms whose curtains hang to
    the ground, lower humps beside it, and a blanket over the ground."""
    def build(mesh, rng):
        H, R = height, width * .5
        c = Vector((0, 0, H * .35))
        shade = ct.crown_shade(c, (R, R, H * .5), low=.5, high=1.15)
        towers = ((Vector((-R * .15, 0, 0)), H, 1.0), (Vector((R * .5, R * .25, 0)), H * .74, .8),
                  (Vector((R * .05, -R * .55, 0)), H * .32, 1.2))
        a0 = rng.uniform(0, math.tau)
        for ti, (base, th, k) in enumerate(towers):
            nz = max(3, int(th / 2.0))
            for i in range(nz):
                f = i / nz
                z = th * (i + .55) / nz
                w = th * .13 * k * (1.3 - .6 * f)
                for m in range(2):
                    q = base + heading(a0 + i * 1.9 + m * math.pi) * w * .45 + UP * z
                    lclump(mesh, rng, q, (w, w, th / nz * .9), c, shade, u=8, v=5, jitter=.16)
            lclump(mesh, rng, base + UP * th * .98, (th * .1 * k, th * .1 * k, th * .1), c, shade, u=8, v=5)
            # Smothered arms, their curtains hanging to the ground.
            arms = 3 if ti == 0 else 2
            for j in range(arms):
                a = a0 + j / arms * math.tau + ti + rng.uniform(-.3, .3)
                d = heading(a)
                z = th * rng.uniform(.55, .75)
                tip = base + d * th * .32 + UP * z
                lclump(mesh, rng, base.lerp(tip, .55) + UP * th * .04, (th * .14, th * .1, th * .08), c, shade, u=8,
                       v=5)
                lclump(mesh, rng, tip, (th * .1, th * .1, th * .09), c, shade, u=8, v=5)
                drop = tip.z
                lclump(mesh, rng, tip - UP * drop * .5 + d * th * .02, (th * .13, th * .11, drop * .5), c, shade,
                       u=8, v=5, jitter=.18)
        # Round 2: the smothered wall joining the towers, one mass, and
        # curtains hanging all round the tall one.
        for a_i, b_i in ((0, 1), (0, 2)):
            pa, pb = towers[a_i][0], towers[b_i][0]
            hh = min(towers[a_i][1], towers[b_i][1]) * .6
            for m in range(3):
                q = pa.lerp(pb, (m + .5) / 3) + UP * hh * .5
                lclump(mesh, rng, q, (H * .12, H * .12, hh * .55), c, shade, u=8, v=5, jitter=.16)
        b0, h0 = towers[0][0], towers[0][1]
        for j in range(5):
            a = a0 + j / 5 * math.tau + .3
            q = b0 + heading(a) * h0 * .15 + UP * h0 * .38
            lclump(mesh, rng, q, (h0 * .09, h0 * .09, h0 * .38), c, shade, u=8, v=5, jitter=.18)
        # The blanket over the ground.
        for j in range(9):
            a = a0 + j * 2.4
            q = heading(a) * R * rng.uniform(.45, .85) + UP * .2
            s = R * rng.uniform(.18, .26)
            lclump(mesh, rng, q, (s, s, s * rng.uniform(.35, .6)), c, shade, u=8, v=5, bottom=.5)
        # A few purple flower spikes (the accent).
        fr = random.Random(rng.random())
        for j in range(10):
            a = fr.uniform(0, math.tau)
            q = towers[0][0] + heading(a) * H * .14 + UP * H * fr.uniform(.2, .8)
            lclump(mesh, fr, q, (.12, .12, .3), None, None, role='accent', u=6, v=3, flex=.5)
    return build


# ---------------------------------------------------------------- sweetgum

def sweetgum(height, width, base, oval):
    """Sweetgum: a straight leader through the crown and short, nearly level
    branches in a spiral up it, each ending in a tuft -- a pointed cone of
    tufts (an egg when older) with the trunk showing below and sky between
    the tufts."""
    def build(mesh, rng):
        H, R = height, width * .5
        r0 = H * .018
        steps = 12
        tpts, tr = [], []
        lean = drift(rng, H * .01)
        for i in range(steps + 1):
            t = i / steps
            tpts.append(UP * H * .95 * t + lean * t * t)
            tr.append(r0 * (1 - .8 * t) * (1 + .7 * math.exp(-t * 14)))
        mesh.add_tube(tpts, tr, 9, 'bark', rng=rng, wobble=.05, shade=lambda co, t: .78 + .3 * min(1, t * 1.5),
                      flex=lambda co, t: .15 * t * t)
        zc0 = H * base
        Hc = H - zc0
        c = Vector((0, 0, zc0 + Hc * .45))
        shade = ct.crown_shade(c, (R, R, Hc * .5), low=.48, high=1.2)
        a0 = rng.uniform(0, math.tau)
        n = 18
        for j in range(n):
            f = j / (n - 1)
            z = zc0 + Hc * .88 * f
            i = min(steps, int(round(z / (H * .95) * steps)))
            p = tpts[i]
            if oval:
                prof = math.sin(math.pi * (.1 + .7 * f)) ** .75 * (1 - .3 * f)
            else:
                prof = ((1 - f) ** .6) * (.8 + .2 * min(1.0, f / .15))
            d = heading(a0 + j * 2.4 + rng.uniform(-.2, .2))
            L = R * max(.12, prof) * rng.uniform(.76, .9)
            end = p + d * L + UP * L * .2
            if not ct.FAR:
                ct.limb(mesh, rng, p, end, tr[i] * .45, tr[i] * .12, sides=5, bow=.06)
            s = R * (.23 + .1 * prof) * rng.uniform(.9, 1.1)
            lclump(mesh, rng, end + UP * s * .15, (s, s, s * .8), c, shade, u=10, v=6, jitter=.22)
            if L > R * .35:
                s2 = s * .8
                lclump(mesh, rng, p.lerp(end, .45) + UP * s2 * .4, (s2, s2, s2 * .8), c, shade, u=10, v=6, jitter=.22)
        s = R * (.16 if oval else .22)
        clump(mesh, rng, tpts[-1] + UP * s * .4, s, c, shade, tall=1.0, jitter=.14)
    return build


# ---------------------------------------------------------------- yaupon

def yaupon(height, width, stems):
    """Yaupon holly: several grey stems from one foot, upright and a little
    leaning, clothed in many small dense lobes from a third of the way up --
    an irregular upright clump taller than wide -- red berries (the accent)
    clustered along the outside."""
    def build(mesh, rng):
        H, R = height, width * .5
        c = Vector((0, 0, H * .6))
        shade = ct.crown_shade(c, (R, R, H * .45), low=.5, high=1.18)
        a0 = rng.uniform(0, math.tau)
        lobes = []
        for k in range(stems):
            a = a0 + k / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            top = d * R * rng.uniform(.6, .85) + UP * H * rng.uniform(.8, .92)
            pts = ct.limb(mesh, rng, d * .06, top, .06 * H / 4.5, .025, sides=5, bow=.08, shade=1.0)
            nl = 7
            for i in range(nl):
                f = .3 + .7 * i / (nl - 1)
                q = (d * .06).lerp(top, f) + heading(a + (1.3 if i % 2 else -1.3)) * R * .15
                s = R * .25 * (.7 + .5 * f) * rng.uniform(.85, 1.1)
                lobes.append((q, s))
        for q, s in lobes:
            lclump(mesh, rng, q, (s, s, s * 1.05), c, shade, jitter=.18)
        br = random.Random(rng.random())
        for q, s in lobes:
            out = q - c
            out.z = 0
            out = out.normalized() if out.length > 1e-6 else heading(br.uniform(0, 6.3))
            if ct.FAR and br.random() < .5:
                continue
            p = q + out * s * .85 + drift(br, s * .3)
            lclump(mesh, br, p, (.1, .1, .09), None, None, role='accent', u=6, v=3, jitter=.05, flex=.4)
    return build


MODELS = [
    ('Blender_FloweringDogwood_1', dogwood(7, 9, 4)),
    ('Blender_Azalea_1', azalea(1.2, 2.0)),
    ('Blender_Magnolia_1', magnolia(19, 12, 0.0, False)),
    ('Blender_Magnolia_2', magnolia(16, 13, 0.12, True)),
    ('Blender_TulipPoplar_1', tulippoplar(36, 15, .3)),
    ('Blender_TulipPoplar_2', tulippoplar(40, 11, .5)),
    ('Blender_CrapeMyrtle_1', crapemyrtle(6, 5, 5)),
    ('Blender_Kudzu_1', kudzu(12, 16)),
    ('Blender_Sweetgum_1', sweetgum(22, 12, .22, False)),
    ('Blender_Sweetgum_2', sweetgum(27, 15, .3, True)),
    ('Blender_Yaupon_1', yaupon(4.5, 3, 5)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'FloweringDogwood': '#5a524c', 'Azalea': '#5a4a3a', 'Magnolia': '#7a756c', 'TulipPoplar': '#6e6a62',
        'CrapeMyrtle': '#b39a7e', 'Kudzu': '#5a4a36', 'Sweetgum': '#5a5048', 'Yaupon': '#8a8780'}
# Leaf and accent per season, from each spec's Seasons table. Deciduous trees
# are drawn in leaf (their bare variants come later): a winter that is bare
# keeps the summer leaf.
LOOK = {
    'FloweringDogwood': {'spring': ('#e8e9d6', '#f6f3ea'), 'summer': ('#557e3a', '#6a8a42'),
                         'autumn': ('#a83a3a', '#c8282a'), 'winter': ('#557e3a', '#5e7e3e')},
    'Azalea': {'spring': ('#c24a7a', '#e05a8a'), 'summer': ('#4f7436', '#5a8040'), 'autumn': ('#5a6a38', '#9a3a2a'),
               'winter': ('#4a6a34', '#52703a')},
    'Magnolia': {'spring': ('#355a30', '#ece8d6'), 'summer': ('#355a30', '#f4f0e2'), 'autumn': ('#355a30', '#b8323a'),
                 'winter': ('#355a30', '#4a5a34')},
    'TulipPoplar': {'spring': ('#9fc060', None), 'summer': ('#4f7e36', None), 'autumn': ('#d6b03a', None),
                    'winter': ('#4f7e36', None)},
    'CrapeMyrtle': {'spring': ('#8aa85a', '#7a9a4e'), 'summer': ('#4f7a38', '#d0508a'), 'autumn': ('#c8642e', '#8a6a4a'),
                    'winter': ('#4f7a38', '#8a6a4a')},
    'Kudzu': {'spring': ('#7aa84a', '#7aa84a'), 'summer': ('#4f8a36', '#7a4a8a'), 'autumn': ('#8a7a4a', '#8a7a4a'),
              'winter': ('#6e624a', '#6e624a')},
    'Sweetgum': {'spring': ('#9ab85c', None), 'summer': ('#4f7e36', None), 'autumn': ('#a8323a', None),
                 'winter': ('#4f7e36', None)},
    'Yaupon': {'spring': ('#4f7438', '#b02a2a'), 'summer': ('#4c7036', '#6e8a3e'), 'autumn': ('#4c7036', '#c42a26'),
               'winter': ('#4a6c34', '#c42a26')},
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


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.9, 0.9, 0.86)},
          far={'Blender_Magnolia_1', 'Blender_Magnolia_2', 'Blender_TulipPoplar_1', 'Blender_TulipPoplar_2',
               'Blender_Sweetgum_1', 'Blender_Sweetgum_2'},
          tints=tints(SEASON))
