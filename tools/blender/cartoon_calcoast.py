# THE CALIFORNIA COAST PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what Monterey and the SoCal Canyons lacked -- the
# Monterey cypress and Monterey pine of the Pebble Beach shore, the coast
# live oak, the blue gum eucalyptus, the California sycamore of the
# barrancas, the Torrey pine of the bluffs, a mat of ice plant, coastal sage
# scrub, a chaparral shrub mass and the sea stacks offshore.
#
#   node tools/blender/iterate.mjs cartoon_calcoast <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid. The wind blows from -X (the sea) toward +X (inland). The
# Monterey cypress is flat shelves of dark foliage stepped on contorted
# limbs, flat-topped, streaming inland; the Monterey pine a tall leaning
# trunk under an irregular deep rounded crown of heavy coarse masses; the
# coast live oak several twisting stems in a steep V under a broad hummocky
# dome of fine dense lobes (not the Southern live oak's low dome on long
# level limbs dipping to the ground); the eucalyptus a very tall pale pole
# forking high, its crown open hanging tassels with sky between; the
# sycamore leaning crooked white stems under a few big separate lobes; the
# Torrey pine a gnarled low tree, crooked limbs ending in spiky tufts with
# sky between; the coastal sage a soft pale mound with dry stalks above; the
# chaparral a dense dark olive mass on red stems.
#
# REFS montereycypress=Blender_MontereyCypress_1,Blender_MontereyCypress_2
# REFS montereypine=Blender_MontereyPine_1
# REFS coastliveoak=Blender_CoastLiveOak_1,Blender_CoastLiveOak_2
# REFS eucalyptus=Blender_Eucalyptus_1,Blender_Eucalyptus_2
# REFS sycamore=Blender_Sycamore_1
# REFS torreypine=Blender_TorreyPine_1
# REFS iceplant=Blender_IcePlant_1
# REFS coastalsage=Blender_CoastalSage_1
# REFS chaparral=Blender_Chaparral_1
# REFS seastack=Blender_SeaStack_1,Blender_SeaStack_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
WIND = Vector((1, 0, 0))


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


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06, role='bark'):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered -- 64 triangles at 8 x 5.
    Returns its vertices."""
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


def pad(mesh, rng, q, r, t, c, shade, n=6, jitter=.22, droop=.25):
    """One flat shelf of foliage: a flattened centre lobe and a ring of `n`
    flattened lobes round it, the outer ones drooping a little -- a level
    plate, ragged at its edge."""
    ball(mesh, rng, q, (r * .62, r * .62, t), c, shade, jitter=jitter, u=9, v=5, bend=.45)
    a0 = rng.uniform(0, math.tau)
    for i in range(n):
        a = a0 + i / n * math.tau + rng.uniform(-.25, .25)
        s = r * rng.uniform(.42, .52)
        p = q + heading(a) * r * rng.uniform(.55, .7) - UP * t * droop * rng.uniform(.5, 1.2)
        ball(mesh, rng, p, (s, s, t * rng.uniform(.75, .95)), c, shade, jitter=jitter, u=8, v=4, bend=.45)


# ---------------------------------------------------------------- Monterey cypress

def montereycypress(height, spread, stems, shelves, lean):
    """Monterey cypress: two or three stout contorted stems from one root,
    leaning inland (+X), splitting into short crooked near-level limbs; each
    limb carries a broad flat shelf of dark foliage, the shelves overlapping
    into a flat-topped layered crown wider than tall.
    `shelves`: (x, y, z, r) as shares of the half-spread and the height."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = Vector((R * .15, 0, H * .7))
        shade = ct.crown_shade(c, (R, R, H * .3), low=.42, high=1.15)
        fork = WIND * H * lean * .6 + UP * H * .3
        base = Vector((0, 0, -.1))
        forks = []
        for s in range(stems):
            off = heading(s / stems * math.tau + rng.uniform(-.3, .3)) * H * .05
            side = Vector((-off.y, off.x, 0))
            mid = base + off * 2 + side * 1.5 + UP * H * .14 + WIND * H * lean * .1
            f = fork + off * 2.5 + drift(rng, H * .03)
            bark_tube(mesh, rng, bez(base + off * .5, mid, f - side * 1.5 - UP * H * .05, f, 5),
                      H * .06, H * .035, 8, shade=(.72, .95), wobble=.14)
            forks.append(f)
        for i, (x, y, z, r) in enumerate(shelves):
            q = Vector((x * R, y * R, z * H))
            rr = r * R
            t = H * .075
            st = min(forks, key=lambda p: (p - q).length)
            k = st.lerp(q, .5) + UP * H * rng.uniform(.0, .08) + drift(rng, H * .05)
            end = q - UP * t * .5
            bark_tube(mesh, rng, bez(st, k, k.lerp(end, .6) - UP * H * .03, end, 4), H * .03, H * .012, 6,
                      shade=(.75, .95), wobble=.15)
            pad(mesh, rng, q, rr, t, c, shade, n=7)
    return build


# ---------------------------------------------------------------- Monterey pine

def montereypine(height, spread, whorls, lean):
    """Monterey pine: a short heavy trunk under a deep, dense, dark crown --
    whorls of heavy limbs, each ending in a mass of upright coarse tufts, the
    lowest whorls widest, so the outline is an irregular egg tapering to a
    blunt top, from a fifth of the height up; leaning inland."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .74, H * .032, lean=WIND * H * lean, steps=6,
                              sides=9, flare=1.6, bend=H * .015, shade_low=.7, shade_high=.92)
        c = pts[3] + UP * H * .12
        shade = ct.crown_shade(c, (R, R, H * .38), low=.36, high=1.1)
        a0 = rng.uniform(0, math.tau)
        for w in range(whorls):
            f = w / (whorls - 1)
            z = H * (.18 + .68 * f)
            reach = R * (.82 + .18 * math.sin(math.pi * f * .7)) * (1 - .78 * f ** 2.2)
            st = pts[0].lerp(pts[-1], min(1.0, (z - H * .08) / (H * .74)))
            n = 6 if f < .7 else 3
            for i in range(n):
                a = a0 + w * 1.3 + i / n * math.tau + rng.uniform(-.3, .3)
                d = heading(a)
                rr = reach * rng.uniform(.8, 1.05) * (1.1 if d.x > .3 else 1.0)
                end = st + d * rr + UP * H * .05
                ct.limb(mesh, rng, st, end, radii[2] * .45 * (1 - .5 * f), radii[2] * .15, sides=4, bow=.1)
                k = R * .23 * (1 - .3 * f)
                for j in range(3):
                    p = end - d * k * j * .7 + drift(rng, k * .35) + UP * k * rng.uniform(-.1, .35)
                    ball(mesh, rng, p, (k * .85, k * .85, k), c, shade, jitter=.18, u=7, v=4, bend=.5)
        # Round 11: a core of lobes up the trunk, so the crown reads dense
        # like picture 2 and the trunk no longer shows through the middle.
        for j in range(4):
            k = R * (.36 - .06 * j)
            ball(mesh, rng, pts[0].lerp(pts[-1], .35 + .2 * j) + drift(rng, k * .2), (k, k, k * 1.1), c, shade,
                 jitter=.2, u=7, v=4, bend=.5)
        k = R * .26
        ball(mesh, rng, pts[-1] + UP * k * .2, (k, k, k * .75), c, shade, jitter=.25, u=8, v=4, bend=.5)
    return build


# ---------------------------------------------------------------- coast live oak

def coastliveoak(height, spread, stems, lop):
    """Coast live oak: three or four stout twisting stems splaying from one
    root in a steep V, each forking into crooked limbs; a broad dense
    hummocky dome above, wider than tall, of many small dark lobes, its edge
    coming down to a third of the height; `lop` pushes it inland (+X), the
    wind-pruned one-sided dome of the coast."""
    def build(mesh, rng):
        H, R = height, spread * .5
        shift = WIND * R * lop
        c = UP * H * .6 + shift
        shade = ct.crown_shade(c, (R, R, H * .4), low=.36, high=1.1)
        a0 = rng.uniform(0, math.tau)
        tips = []
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            side = Vector((-d.y, d.x, 0)) * rng.choice((-1, 1))
            p0 = d * H * .03 - UP * .1
            fork = d * R * .25 + UP * H * .32 + shift * .4
            path = bez(p0, p0 + UP * H * .14 + side * H * .05, fork - d * R * .08 - side * H * .05, fork, 5)
            bark_tube(mesh, rng, path, H * .05, H * .032, 8, shade=(.7, .92), wobble=.1)
            for j in range(3):
                b = a + (j - 1) * .85 + rng.uniform(-.2, .2)
                e = heading(b)
                out = rng.uniform(.5, .88)
                end = e * R * out + shift + UP * H * (.78 - .38 * out + rng.uniform(-.05, .05))
                ct.limb(mesh, rng, fork, end, H * .024, H * .01, sides=5, bow=.25)
                tips.append((end, out))
        for q, out in tips:
            for j in range(5):
                k = R * rng.uniform(.13, .16)
                p = q + drift(rng, R * .14) + UP * R * rng.uniform(-.02, .1)
                ball(mesh, rng, p, (k, k, k * .85), c, shade, jitter=.2, u=8, v=4, bend=.55)
            if out > .72:
                k = R * .15
                ball(mesh, rng, q + (q - c).normalized() * k * .4 - UP * H * .1, (k, k, k), c, shade, jitter=.2, u=8,
                     v=4, bend=.55)
        # Round 4: a ring of fill lobes mid-crown, so the dome reads as one
        # dense body, not florets with dark holes.
        for j in range(6):
            k = R * .2
            p = heading(a0 + j * 1.05 + .5) * R * .45 + shift + UP * H * .66
            ball(mesh, rng, p, (k, k, k * .85), c, shade, jitter=.2, u=8, v=4, bend=.55)
        for j in range(5):
            k = R * .22
            p = heading(a0 + j * 1.26) * R * rng.uniform(.1, .32) + shift + UP * (H - k * .9 - rng.uniform(0, H * .05))
            ball(mesh, rng, p, (k, k, k * .85), c, shade, jitter=.2, u=8, v=4, bend=.55)
    return build


# ---------------------------------------------------------------- eucalyptus

def eucalyptus(height, spread, forks, lean):
    """Blue gum: a very tall smooth pale trunk, forking high into a few long
    ascending limbs, each with side limbs; the crown open and irregular, a
    tall oval from a third of the height up, of puffy, slightly drooping
    clumps of grey-green leaves on the limb ends with sky between; tan
    strips of peeling bark (accent) hanging down the trunk."""
    def build(mesh, rng):
        H, R = height, spread * .5
        fork_h = H * .45
        top = WIND * H * lean + UP * fork_h
        path = bez(Vector((0, 0, -.1)), UP * H * .2, top - WIND * H * lean * .3 - UP * H * .1, top, 6)
        r0 = H * .028
        bark_tube(mesh, rng, path, r0, r0 * .62, 9, shade=(.85, 1.08), wobble=.04)
        c = top + UP * H * .2
        shade = ct.crown_shade(c, (R, R, H * .32), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        ends = []
        for j in range(2):
            b = a0 + j * math.pi + .8
            p = path[4 - j]
            tip = p + heading(b) * R * .55 + UP * H * .06
            ct.limb(mesh, rng, p, tip, r0 * .22, r0 * .08, sides=5, bow=.2)
            ends.append(tip)
        for i in range(forks):
            a = a0 + i / forks * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            end = top + d * R * rng.uniform(.3, .5) + UP * H * rng.uniform(.42, .5)
            mid = top.lerp(end, .5) + d * R * .08
            bark_tube(mesh, rng, [top, mid, end], r0 * .5, r0 * .15, 7, shade=(.9, 1.05))
            ends.append(end)
            for j in range(4):
                b = a + rng.uniform(-1.4, 1.4)
                e = heading(b)
                p = top.lerp(end, .15 + .2 * j)
                tip = p + e * R * rng.uniform(.5, .8) + UP * H * rng.uniform(.03, .1)
                ct.limb(mesh, rng, p, tip, r0 * .18, r0 * .06, sides=4, bow=.2)
                ends.append(tip)
        for q in ends:
            for j in range(4):
                k = R * rng.uniform(.15, .19)
                p = q + drift(rng, k * 1.0) - UP * k * rng.uniform(.0, .6)
                ball(mesh, rng, p, (k, k, k * 1.05), c, shade, jitter=.25, u=7, v=4, bend=.4)
            # Round 12: a hanging tassel under each limb end -- the drooping
            # leaf clusters of the blue gum.
            k = R * .1
            ball(mesh, rng, q - UP * R * .3 + drift(rng, k), (k * .7, k * .7, k * 1.6), c, shade, jitter=.2, u=6, v=4,
                 bend=.4)
        for j in range(7):
            b = j / 7 * math.tau + fr.uniform(-.2, .2)
            z = fr.uniform(.06, .38) * H
            p = Vector((0, 0, 0)).lerp(top, z / fork_h) + heading(b) * r0 * .9
            mesh.add_lump(p - UP * 1.0, (.14, .14, 1.4), 'accent', fr, subdiv=0, jitter=.15, flex=.2,
                          shade=lambda w, n: .95)
    return build


# ---------------------------------------------------------------- sycamore

def sycamore(height, spread, stems):
    """California sycamore: two or three crooked stems leaning far apart from
    one root, white mottled with tan patches (accent); wide crooked limbs
    that zig-zag out and up; a tall broad irregular crown of big lobes in
    loose groups at several heights, sky between the groups."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .65
        shade = ct.crown_shade(c, (R, R, H * .36), low=.45, high=1.15)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            lean = rng.uniform(.14, .24) if s else .06
            pts = [Vector((0, 0, -.1)), d * H * lean * .2 + UP * H * .18, d * H * lean * .55 + UP * H * .34 + drift(rng, .5),
                   d * H * lean + UP * H * .48]
            bark_tube(mesh, rng, pts, H * .042, H * .022, 7, shade=(.85, 1.05), wobble=.12)
            for p in [pts[0].lerp(pts[1], .6), pts[1], pts[1].lerp(pts[2], .5), pts[2], pts[2].lerp(pts[3], .5)]:
                mesh.add_lump(p + drift(fr, H * .02), (H * .03, H * .03, H * .05), 'accent', fr, subdiv=0, jitter=.2,
                              flex=.2, shade=lambda w, n: .95)
            top = pts[-1]
            # Round 4: four steep zig-zag limbs a stem, each with small loose
            # lobe groups at its elbow and tip, offset to its outside, so the
            # white limbs show in the gaps and the outline is a tall ragged
            # oval, not a dense round head.
            for j in range(4):
                b = a + (j - 1.5) * .8 + rng.uniform(-.2, .2)
                e = heading(b)
                side = Vector((-e.y, e.x, 0)) * rng.choice((-1, 1))
                k1 = top + e * R * .22 + side * R * .12 + UP * H * .14
                k2 = k1 + e * R * .15 - side * R * .2 + UP * H * .13
                end = k2 + e * R * rng.uniform(.15, .3) + UP * H * rng.uniform(.1, .2)
                ct.limb(mesh, rng, top, k1, H * .016, H * .011, sides=5, bow=.05)
                ct.limb(mesh, rng, k1, k2, H * .011, H * .007, sides=4, bow=.05)
                ct.limb(mesh, rng, k2, end, H * .007, H * .004, sides=4, bow=-.1)
                for q, n in ((end, 3), (k2 + e * R * .12, 2)):
                    for m in range(n):
                        k = R * rng.uniform(.16, .2)
                        p = q + e * k * .5 + drift(rng, k * .7) + UP * k * rng.uniform(-.2, .5)
                        ball(mesh, rng, p, (k, k, k * .8), c, shade, jitter=.14, u=7, v=4, bend=.5)
    return build


# ---------------------------------------------------------------- Torrey pine

def torreypine(height, spread, limbs, lean):
    """Torrey pine: a short twisted trunk leaning inland, splitting low into
    long crooked limbs that reach out nearly level and turn up at the ends;
    each carries clusters of small spiky tufts of long needles, so the crown
    is a wide, flat-topped, lopsided spray of tufts with sky between."""
    def build(mesh, rng):
        H, R = height, spread * .5
        top = WIND * H * lean + UP * H * .32
        bark_tube(mesh, rng, bez(Vector((0, 0, -.1)), UP * H * .14, top - WIND * H * lean * .6, top, 5), H * .045,
                  H * .03, 8, shade=(.72, .95), wobble=.15)
        c = top + UP * H * .4
        shade = ct.crown_shade(c, (R, R, H * .25), low=.45, high=1.15)
        a0 = rng.uniform(0, math.tau)
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            reach = R * rng.uniform(.65, .95) * (1.12 if d.x > 0 else .85)
            st = top + UP * H * rng.uniform(0, .15)
            k1 = st + d * reach * .55 + UP * H * rng.uniform(.06, .14) + drift(rng, R * .1)
            end = top + d * reach
            end.z = H * rng.uniform(.62, .82)
            ct.limb(mesh, rng, st, k1, H * .022, H * .013, sides=6, bow=-.05)
            ct.limb(mesh, rng, k1, end, H * .013, H * .005, sides=5, bow=.2)
            # Round 4: four tuft groups a limb, bigger tufts, so the crown is
            # a full flat-topped spray, spiky only at its edge.
            for q in (end, k1.lerp(end, .6), k1.lerp(end, .2)):
                for j in range(3):
                    k = R * rng.uniform(.12, .15)
                    p = q + drift(rng, k * 1.3) + UP * k * rng.uniform(.1, .6)
                    needletuft(mesh, rng, p, k, c, shade, 5)
    return build


def needletuft(mesh, rng, q, k, c, shade, n):
    """A pine's tuft of long needles: a small core with `n` spikes radiating
    up and out of it, so its edge is spiky, not round."""
    ball(mesh, rng, q, (k * .55, k * .55, k * .45), c, shade, jitter=.2, u=6, v=3, bend=.35)
    for i in range(n):
        a = i / n * math.tau + rng.uniform(-.3, .3)
        d = (heading(a) * rng.uniform(.8, 1.0) + UP * rng.uniform(.2, .9)).normalized()
        tip = q + d * k * rng.uniform(1.2, 1.6)
        v = shade(tip, d)
        mesh.add_tube([q, tip], [k * .22, k * .02], 3, 'leaf', rng=rng, shade=lambda co, t, v=v: v * (.85 + .2 * t),
                      flex=lambda co, t: .5 + .4 * t)


# ---------------------------------------------------------------- ice plant

def iceplant(width, height, fingers, flowers):
    """A mat of ice plant: low fleshy hummocks spreading over the ground,
    its top a carpet of upright finger leaves (a few red-tipped, the bark
    role), magenta daisies (accent) scattered over it."""
    def build(mesh, rng):
        R = width * .5
        c = UP * height * .2
        shade = ct.crown_shade(c, (R, R, height), low=.6, high=1.15)
        for k in range(10):
            a = k * ct.GOLDEN
            rr = R * math.sqrt((k + .5) / 10) * .7
            s = R * rng.uniform(.28, .36)
            ball(mesh, rng, heading(a) * rr, (s, s, height * rng.uniform(.6, .8)), c, shade, jitter=.25, u=10, v=4,
                 bend=.3)
        for k in range(fingers):
            a = k * ct.GOLDEN
            rr = R * math.sqrt((k + .5) / fingers) * .95
            q = heading(a) * rr + UP * height * (.75 * (1 - (rr / R) ** 2) + .15)
            ball(mesh, rng, q, (.035, .035, .07), c, shade, role='bark' if k % 8 == 0 else 'leaf', jitter=.1, u=4,
                 v=3, bend=.2)
        for k in range(flowers):
            p = 1 + k // 7
            a = p * 2.3 + (k % 7) * .35
            rr = R * (.2 + .12 * p) + rng.uniform(-.12, .12)
            q = heading(a) * rr + UP * height * (.9 * (1 - (rr / R) ** 2) + .35)
            ball(mesh, rng, q, (.11, .11, .025), c, None, role='accent', jitter=.05, u=8, v=3, bend=.1)
    return build


# ---------------------------------------------------------------- coastal sage

def coastalsage(height, spread, stalks):
    """Coastal sage scrub (California sagebrush): a soft, airy, pale
    grey-green shrub rising as a loose vase, many small feathery puffs with
    gaps between them; dry flower stalks (bark role) poking above it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.55, high=1.15)
        # Round 8: a soft body of puffs inside, so the feathers read as the
        # fine edge of one shrub, not loose grass.
        for k in range(14):
            a = k * ct.GOLDEN
            zf = .3 + .4 * (k / 13)
            s = R * rng.uniform(.26, .32)
            ball(mesh, rng, heading(a) * R * .38 * (.5 + zf) + UP * H * zf, (s, s, s * 1.1), c, shade, jitter=.2, u=7,
                 v=4, bend=.6)
        n = 110
        for k in range(n):
            zf = (k + .5) / n
            a = k * ct.GOLDEN
            rr = R * .9 * (.3 + .7 * math.sin(math.pi * min(zf, .85) * .6)) * rng.uniform(.4, 1.0) * (1 - max(0, zf - .85) * 3)
            q = heading(a) * rr + UP * H * zf * .75
            # Round 4: each puff a narrow upright feather, so the shrub reads
            # fine and wispy, not a heap of balls.
            s = R * rng.uniform(.1, .13)
            ball(mesh, rng, q + UP * H * .15, (s * .6, s * .6, s * 1.8), c, shade, jitter=.12, u=5, v=3, bend=.6)
        for k in range(stalks):
            a = k * ct.GOLDEN * 2
            p = heading(a) * R * rng.uniform(.1, .6) + UP * H * .6
            tip = p + heading(a) * R * .2 + UP * H * rng.uniform(.4, .6)
            bark_tube(mesh, rng, [p, p.lerp(tip, .5) + drift(rng, .03), tip], .012, .005, 4, shade=(.9, 1.05))
    return build


# ---------------------------------------------------------------- chaparral

def chaparral(height, spread, stems, berries):
    """A chaparral shrub mass (chamise, manzanita, ceanothus, toyon): dense,
    tough and dark olive, a broad lumpy mound to the ground built of two or
    three sub-mounds, its top rough; a few twisting red manzanita stems
    peeking out at its foot; small clusters of flowers or berries (accent)
    dotted over it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .45
        shade = ct.crown_shade(c, (R, R, H * .5), low=.4, high=1.1)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            d = heading(a0 + s / stems * math.tau)
            bark_tube(mesh, rng, bez(-UP * .05, d * R * .2 + UP * H * .08, d * R * .32 + UP * H * .1, d * R * .45 + UP * H * .25, 4),
                      H * .03, H * .012, 5, shade=(.75, 1.0), wobble=.2)
        mounds = [(Vector((0, 0, 0)), 1.0, 1.0), (heading(a0) * R * .4, .7, .78), (heading(a0 + 2.4) * R * .38, .65, .7)]
        spots = []
        for k in range(9):
            a = a0 + k / 9 * math.tau + rng.uniform(-.2, .2)
            s = R * rng.uniform(.2, .25)
            ball(mesh, rng, heading(a) * R * .7 + UP * H * .16, (s, s, s * .7), c, shade, jitter=.24, u=7, v=4, bend=.55)
        for m, (o, rf, hf) in enumerate(mounds):
            n = 14 if m == 0 else 9
            for k in range(n):
                y = 1 - (k + .5) / n * 1.15
                r = math.sqrt(max(0, 1 - y * y))
                a = k * ct.GOLDEN + m
                q = o + Vector((math.cos(a) * r * R * .62 * rf, math.sin(a) * r * R * .62 * rf, H * hf * (.42 + y * .4)))
                s = R * rng.uniform(.22, .28) * (1 if m == 0 else .85)
                ball(mesh, rng, q, (s, s, s * .8), c, shade, jitter=.24, u=7, v=4, bend=.55)
                spots.append((q, s))
        fr = random.Random(rng.random())
        for k in range(berries):
            q, s = spots[(k * 7) % len(spots)]
            if q.z < H * .3:
                continue
            p = q + (q - c).normalized() * s * .8 + drift(fr, s * .3)
            for m in range(3):
                ball(mesh, fr, p + drift(fr, .12) + UP * fr.uniform(-.05, .05), (.08, .08, .07), c, None, flex=.6, role='accent', jitter=.15, u=4, v=2, bend=.2)
    return build


# ---------------------------------------------------------------- sea stacks

def slab(mesh, rng, base, w, d, t, points=12, bevel=.05, lo=.6, hi=1.06, moss=None):
    """One bed of rock: a hull cut to a thick band (flat top and bottom),
    standing on `base`; returns its top."""
    f = .7
    rz = t / (2 * (1 - f))
    z0 = base.z - f * rz - .03
    ct.hull_rock(mesh, rng, Vector((base.x, base.y, z0)), (w * .5, d * .5, rz), points=points, bevel=bevel, seat=0,
                 flat_top=f, flat_bottom=f, shade_low=lo, shade_high=hi, moss=moss)
    return z0 + (2 - f) * rz


def tuftcap(mesh, rng, q, r, n):
    """A little green on a stack's top: a few low clumps."""
    for k in range(n):
        p = q + drift(rng, r)
        s = rng.uniform(.5, .9)
        mesh.add_lump(p, (s, s, s * .5), 'leaf', rng, subdiv=0, jitter=.2, flex=.3, shade=lambda w, n: .9)


def seaspire(height, width, beds, taper):
    """A sea stack: a massive pillar of a few thick rock beds, each a little
    offset, tapering hard from a broad foot; its top flat-ish, bird-white
    (accent) with a cap of green; broken blocks round its foot."""
    def build(mesh, rng):
        z = 0.0
        w, d = width, width * .82
        x = y = 0.0
        # Round 3: overlapping tall rocks shrinking upward, each sunk into
        # the one below -- a broad foot tapering to a narrow top.
        for b in range(beds):
            t = height / beds * 1.5
            last = b == beds - 1
            ct.hull_rock(mesh, rng, Vector((x, y, z)), (w * .5, d * .5, t * .5), points=22, bevel=.03,
                         flat_top=.3 if last else 0, seat=.3 if b == 0 else .2, strata=2, shade_low=.5 + .08 * b,
                         shade_high=.95, moss='accent' if last else None)
            z += t * (.7 if b == 0 else .8) - t * .35
            x += rng.uniform(-.06, .06) * width
            y += rng.uniform(-.06, .06) * width
            w *= taper * rng.uniform(.95, 1.03)
            d *= taper * rng.uniform(.95, 1.03)
        tuftcap(mesh, rng, Vector((x, y, z + height / beds * .45)), w * .2, 3)
        for k in range(3):
            a = k * 2.2 + rng.uniform(-.3, .3)
            p = heading(a) * width * .65
            slab(mesh, rng, Vector((p.x, p.y, 0)), rng.uniform(1.5, 2.8), rng.uniform(1.2, 2.2), rng.uniform(1.0, 2.0),
                 points=8, bevel=.05)
    return build


def seaarch(height, width, beds):
    """A sea arch: two massive legs across X, each a couple of thick beds,
    joined by a heavy lintel at the top, flat-topped, bird-white with a cap
    of green."""
    def build(mesh, rng):
        tops = []
        for side in (-1, 1):
            z = 0.0
            w, d = width * .36, width * .42
            x = side * width * .3
            for b in range(beds):
                t = height * .75 / beds * 1.3
                ct.hull_rock(mesh, rng, Vector((x, 0, z)), (w * .5, d * .5, t * .5), points=18, bevel=.03,
                             seat=.25 if b == 0 else .1, strata=2, shade_low=.5 + .08 * b, shade_high=.95)
                z += t * .85 - t * .25
                x -= side * width * .03
                w *= .88
            tops.append(z + height * .1)
        z = min(tops) - .4
        z = slab(mesh, rng, Vector((0, 0, z)), width * 1.0, width * .42, height * .38, points=12, bevel=.03, lo=.6,
                 hi=1.05, moss='accent')
        tuftcap(mesh, rng, Vector((width * .15, 0, z - .4)), width * .15, 3)
    return build


MODELS = [
    ('Blender_MontereyCypress_1', montereycypress(15, 22, 3, [
        (0, 0, .86, .45), (.5, .2, .82, .4), (-.4, -.1, .8, .38), (.25, -.5, .84, .36), (-.1, .5, .82, .36),
        (.95, -.1, .6, .3), (-.9, .15, .55, .28), (.6, .8, .55, .28), (.1, -.95, .58, .28)], .15)),
    ('Blender_MontereyCypress_2', montereycypress(11, 16, 2, [
        (.05, 0, .9, .4), (.5, .1, .84, .4), (.85, -.1, .72, .32), (-.35, .1, .8, .26), (.6, .5, .62, .28),
        (.3, -.45, .66, .3)], .35)),
    ('Blender_MontereyPine_1', montereypine(24, 20, 5, .04)),
    ('Blender_CoastLiveOak_1', coastliveoak(13, 20, 4, 0)),
    ('Blender_CoastLiveOak_2', coastliveoak(10, 16, 3, .3)),
    ('Blender_Eucalyptus_1', eucalyptus(36, 20, 3, .015)),
    ('Blender_Eucalyptus_2', eucalyptus(28, 15, 2, .08)),
    ('Blender_Sycamore_1', sycamore(18, 15, 3)),
    ('Blender_TorreyPine_1', torreypine(11, 15, 6, .15)),
    ('Blender_IcePlant_1', iceplant(2.4, .15, 70, 28)),
    ('Blender_CoastalSage_1', coastalsage(1.0, 1.6, 8)),
    ('Blender_Chaparral_1', chaparral(2.2, 3.6, 4, 44)),
    ('Blender_SeaStack_1', seaspire(16, 10, 4, .78)),
    ('Blender_SeaStack_2', seaarch(10, 12, 2)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'MontereyCypress': '#8a7e70', 'MontereyPine': '#4e443c', 'CoastLiveOak': '#6a6660', 'Eucalyptus': '#d8d2c2',
        'Sycamore': '#e2dccc', 'TorreyPine': '#7a5040', 'CoastalSage': '#9a8a6a', 'Chaparral': '#7a3a2a'}
# A sea stack: its rock, bird-white top (accent) and the green on top (leaf).
STONE = {'SeaStack': ('#5a5650', '#e8e4dc', '#5a6e40')}
# Leaf, accent (and for the ice plant the red tips, bark) per season, from
# each spec's Seasons table. The sycamore is deciduous and drawn in leaf (its
# bare variant comes later): winter keeps the summer leaf. An accent with no
# flowers or fruit that season is drawn the leaf's colour.
LOOK = {
    'MontereyCypress': {'spring': ('#3d5e34', None), 'summer': ('#3a5a32', None), 'autumn': ('#3a5a32', None), 'winter': ('#38582f', None)},
    'MontereyPine': {'spring': ('#3e6236', None), 'summer': ('#3a5e34', None), 'autumn': ('#3a5e34', None), 'winter': ('#385a32', None)},
    'CoastLiveOak': {'spring': ('#6a8a3e', None), 'summer': ('#40613a', None), 'autumn': ('#40613a', None), 'winter': ('#3e5e38', None)},
    'Eucalyptus': {'spring': ('#7f9a84', '#b8a07a'), 'summer': ('#7a9480', '#b8a07a'), 'autumn': ('#7a9480', '#a88a62'), 'winter': ('#77917c', '#b8a07a')},
    'Sycamore': {'spring': ('#9ab95c', '#b8a888'), 'summer': ('#5f8a3e', '#b8a888'), 'autumn': ('#b08a3e', '#b8a888'), 'winter': ('#5f8a3e', '#b8a888')},
    'TorreyPine': {'spring': ('#6a8a52', None), 'summer': ('#66864f', None), 'autumn': ('#66864f', None), 'winter': ('#63824c', None)},
    'IcePlant': {'spring': ('#6a9a4a', '#c82a8a', '#b04a3a'), 'summer': ('#6a9a4a', '#c82a8a', '#b04a3a'),
                 'autumn': ('#b4583a', '#7a8a4a', '#c04a32'), 'winter': ('#8a5a4a', '#6a7a48', '#9a3a32')},
    'CoastalSage': {'spring': ('#9aa898', None), 'summer': ('#a09a80', None), 'autumn': ('#a09a80', None), 'winter': ('#8a9a8a', None)},
    'Chaparral': {'spring': ('#6f84a0', '#8aa0e0'), 'summer': ('#5a6e4a', '#5a6e4a'), 'autumn': ('#5a6e4a', '#5a6e4a'), 'winter': ('#56724a', '#b8302a')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        if sp in STONE:
            s, a, l = STONE[sp]
            out[name] = {'stone': hexrgb(s), 'accent': hexrgb(a), 'leaf': hexrgb(l)}
            continue
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(look[2] if len(look) > 2 else BARK[sp])}
        if look[1]:
            t['accent'] = hexrgb(look[1])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.2, 0.32, 0.17), 'bark': (0.45, 0.4, 0.34), 'accent': (0.6, 0.5, 0.4),
                           'stone': (0.35, 0.33, 0.3)},
          far={'Blender_MontereyCypress_1', 'Blender_MontereyPine_1', 'Blender_CoastLiveOak_1',
               'Blender_Eucalyptus_1', 'Blender_Eucalyptus_2', 'Blender_Sycamore_1'},
          tints=tints(SEASON))
