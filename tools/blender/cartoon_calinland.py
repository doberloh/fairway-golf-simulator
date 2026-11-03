# THE CALIFORNIA INLAND PACK (the US landscapes goal, 2 November 2026;
# PLAN.md section 5, local): what Wine Country (the California oak
# woodland) and the Southern California canyons lacked -- the valley oak,
# blue oak, California buckeye, a vineyard row, a clump of California
# poppies, an old olive, the jacaranda and the California pepper tree.
#
#   node tools/blender/iterate.mjs cartoon_calinland <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid, and none may read as the game's live oak (broad low dome on
# sinuous limbs), bur oak (wide flat ragged on level limbs), Garry oak
# (broad lumpy crown) or coast live oak (dense dark dome). The valley oak is
# a huge high dome on a massive trunk whose long limbs arch up and over, the
# outer branchlets hanging in a ragged fringe; the blue oak a small compact
# open crown of small clumps on a short trunk, blue-grey; the buckeye a low
# broad mound almost to the ground on several silver stems, white candles
# standing out of it; the olive a thick twisted split trunk under a rounded
# mop of fine silver clumps; the jacaranda a crooked vase opening to a flat
# layered umbrella; the pepper tree a gnarled leaning trunk under arching
# limbs that drop long curtains of fine strands, a willow's outline.
#
# REFS valleyoak=Blender_ValleyOak_1,Blender_ValleyOak_2
# REFS blueoak=Blender_BlueOak_1,Blender_BlueOak_2
# REFS buckeye=Blender_Buckeye_1
# REFS grapevine=Blender_GrapeVine_1
# REFS californiapoppy=Blender_CaliforniaPoppy_1
# REFS olivetree=Blender_OliveTree_1
# REFS jacaranda=Blender_Jacaranda_1
# REFS peppertree=Blender_PepperTree_1
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


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06, role='bark'):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered -- 64 triangles at 8 x 5,
    36 at 6 x 4. Returns its vertices."""
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


def cluster(mesh, rng, q, s, n, c, shade, hang=0.0, u=6, v=4, flat=1.0, jitter=.25, ks=1.0):
    """A mass of n small balls round q, the fine-leaved edge; `ks` scales
    the balls (below 1, finer)."""
    for m in range(n):
        o = drift(rng, s * .55) + UP * s * rng.uniform(-.3, .3) * flat
        k = s * rng.uniform(.5, .66) * ks
        ball(mesh, rng, q + o - UP * s * hang, (k, k, k * flat * (1 + hang)), c, shade, jitter=jitter, u=u, v=v, bend=.4)


# ---------------------------------------------------------------- valley oak

def valleyoak(height, spread, limbs, sweep):
    """Valley oak: a massive trunk, short, under long limbs that climb steeply,
    arch out and over, and come down at their ends; big clumps along the
    arches make a huge high dome, and the outer branchlets hang from the
    limb ends in a ragged fringe. `sweep` 0..1: how low the limb ends come."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .25, H * .06, lean=drift(rng, H * .02), steps=5,
                              sides=10, flare=1.9, bend=H * .015, shade_low=.68, shade_high=.92)
        top = pts[-1]
        r = radii[-1]
        c = Vector((top.x, top.y, H * .58))
        shade = ct.crown_shade(c, (R, R, H * .42), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        # Round 2: a short massive trunk; limbs reach lower; rounder clumps
        # fill the dome down to a third of the height; the hanging ends are
        # joined under each limb's tip, a ragged hem rather than lanterns.
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            reach = R * rng.uniform(.85, .98)
            peak = H * rng.uniform(.66, .78)
            endz = H * (rng.uniform(.42, .52) - sweep * .2)
            p0 = top - UP * H * .03
            p1 = top + d * reach * .15 + UP * H * .22
            p2 = d * reach * .55 + UP * peak
            p3 = d * reach + UP * endz
            path = bez(p0, p1, p2, p3, 7)
            bark_tube(mesh, rng, path, r * .75, H * .007, 6, wobble=.08)
            # Round 5: big single clumps read as balls on sticks; each mass
            # is now a cluster of small balls (a ragged, fine edge, limbs
            # dark between), along the arch, on a lower side branch, and
            # hanging under the end as the weeping hem.
            for f, n in ((.45, 3), (.7, 4), (.95, 4)):
                q = path[int(round(f * 7))]
                cluster(mesh, rng, q + UP * R * .05, R * .2, n, c, shade, ks=1.1)
            side = Vector((-d.y, d.x, 0)) * rng.choice((-1, 1))
            sb = path[3] + side * R * .3 + d * R * .15 - UP * H * .08
            ct.limb(mesh, rng, path[3], sb, r * .3, r * .12, sides=5, bow=.1)
            cluster(mesh, rng, sb + UP * R * .04, R * .18, 3, c, shade, ks=1.1)
            cluster(mesh, rng, path[7] - UP * H * .07 + d * R * .04, R * .13, 3, c, shade, hang=.5, ks=1.1)
        for k in range(2):
            q = top + heading(a0 + k * 3.1 + .5) * R * .15
            q.z = H * .9
            cluster(mesh, rng, q, R * .22, 5, c, shade, ks=1.1)
        # Round 11: a raised middle mass, the upper centre dense as in the
        # pictures.
        cluster(mesh, rng, top + UP * (H * .74 - top.z), R * .24, 4, c, shade, ks=1.1)
    return build


# ---------------------------------------------------------------- blue oak

def blueoak(height, spread, limbs, lean):
    """Blue oak: a short pale trunk, a few crooked limbs, a small compact
    crown about as tall as wide made of separate masses of small clumps with
    sky between and bare twigs poking out -- fine-textured and open."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .2, H * .055, lean=drift(rng, H * lean), steps=5,
                              sides=8, flare=1.6, bend=H * .03, shade_low=.78, shade_high=1.0)
        top = pts[-1]
        r = radii[-1]
        c = Vector((top.x, top.y, H * .58))
        shade = ct.crown_shade(c, (R, R, H * .42), low=.45, high=1.15)
        a0 = rng.uniform(0, math.tau)
        # Round 2: a short trunk; limbs end at alternating low and high
        # heights, a cluster at each end and one at each low limb's knee, so
        # the crown is a compact rounded mass of small clumps from a third up.
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            low = i % 2 == 0
            end = top + d * R * rng.uniform(.55, .72)
            end.z = H * (rng.uniform(.48, .58) if low else rng.uniform(.68, .82))
            k1 = top.lerp(end, .45) + drift(rng, R * .12) + UP * H * .04
            ct.limb(mesh, rng, top, k1, r * .7, r * .45, sides=6, bow=.1)
            ct.limb(mesh, rng, k1, end, r * .45, r * .15, sides=5, bow=-.1)
            cluster(mesh, rng, end + UP * R * .06, R * .34, 8, c, shade, ks=.8)
            if low:
                cluster(mesh, rng, k1 + UP * R * .25, R * .3, 6, c, shade, ks=.8)
            tw = end + d * R * .3 + UP * H * rng.uniform(.0, .12)
            ct.limb(mesh, rng, end, tw, r * .12, r * .04, sides=4, bow=.1)
        cluster(mesh, rng, top + UP * (H * .8 - top.z), R * .4, 10, c, shade, ks=.8)
    return build


# ---------------------------------------------------------------- buckeye

def buckeye(height, spread, stems):
    """California buckeye: several smooth silver stems splaying from the
    ground under a low broad mound, wider than tall, coming down near the
    grass; white flower candles (accent) stand out of its skin in spring."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .45), low=.42, high=1.18)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            fork = d * R * .32 + UP * H * .32 + drift(rng, .2)
            ct.limb(mesh, rng, d * .1 - UP * .05, fork, H * .03, H * .02, sides=6, bow=.06)
            for j in range(2):
                e = heading(a + (j - .5) * .8)
                ct.limb(mesh, rng, fork, e * R * .62 + UP * H * .55, H * .018, H * .006, sides=5, bow=.1)
        # Round 2: the crown lifted to show the silver stems under it.
        spots = []
        for zf, rf, n, sf in ((.47, .66, 7, .3), (.66, .4, 5, .34), (.84, .0, 1, .38)):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                q = heading(a) * R * rf + UP * H * zf
                s = R * sf * rng.uniform(.9, 1.1)
                clump(mesh, rng, q, s, c, shade, squash=.8, jitter=.14)
                spots.append((q, s))
        fr = random.Random(rng.random())
        for q, s in spots:
            # Round 7: candles bigger, five a clump, standing proud of the skin.
            for k in range(5):
                a = fr.uniform(0, math.tau)
                up = fr.uniform(.3, .85)
                o = heading(a) * s * math.sqrt(1 - up * up) + UP * s * .8 * up
                ball(mesh, fr, q + o * .97 + UP * .22, (.17, .17, .42), c, None, flex=.9, role='accent', jitter=.12,
                     u=4, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- vineyard row

def grapevine(length, vines):
    """A vineyard row along X, `length` metres (round 2: turned from Y so
    the sheet sees it side-on; the game lays rows along the model's X):
    posts and three wires, a vine trunk every few metres with its cordon
    along the low wire, a narrow hedge of leaves from the cordon up to
    about 1.9 m, grapes (accent) hanging under it."""
    def P(x, y, z):
        return Vector((x, y, z))

    def build(mesh, rng):
        L = length
        c = UP * 1.4
        shade = ct.crown_shade(c, (L * .5, .45, .55), low=.5, high=1.15)
        for k in range(5):
            x = -L * .5 + k * L / 4
            end = k in (0, 4)
            rad = .06 if end else .045
            lean = P((-1 if k == 0 else 1) * .12 if end else 0, 0, 0)
            mesh.add_tube([P(x, 0, -.1), P(x, 0, 1.0) + lean * .5, P(x, 0, 1.95) + lean],
                          [rad, rad, rad * .9], 5, 'bark', rng=rng, wobble=.02,
                          shade=lambda co, t: .8 + .15 * t, flex=lambda co, t: 0.0)
        for z, ys in ((.9, (0,)), (1.3, (-.16, .16)), (1.7, (-.16, .16))):
            for y in ys:
                mesh.add_tube([P(-L * .5, y, z), P(L * .5, y, z)], [.012, .012], 3, 'stone',
                              shade=lambda co, t: 1.0, flex=lambda co, t: 0.0)
        for i in range(vines):
            x = -L * .5 + (i + .5) * L / vines
            base = P(x, rng.uniform(-.03, .03), -.05)
            pts = [base, base + P(rng.uniform(-.06, .06), rng.uniform(-.06, .06), .45), P(x, 0, .9)]
            bark_tube(mesh, rng, pts, .055, .04, 5, wobble=.12)
            for s in (-1, 1):
                bark_tube(mesh, rng, [P(x, 0, .9), P(x + s * .35, 0, .93), P(x + s * .7, 0, .9)], .035, .02, 4, wobble=.1)
        n = int(L / .6)
        for i in range(n + 1):
            x = -L * .5 + i * L / n
            # Round 11 (cost: rows are tiled by the hundred): one tall ball a
            # 0.6 m section, a shoot on every third.
            ball(mesh, rng, P(x, rng.uniform(-.05, .05), rng.uniform(1.3, 1.38)), (.56, .34, rng.uniform(.56, .62)), c,
                 shade, jitter=.22, bend=.5, u=6, v=4)
            if i % 3 == 0:
                ball(mesh, rng, P(x + rng.uniform(-.2, .2), rng.uniform(-.1, .1), 1.92), (.14, .12, .2), c, shade, jitter=.3,
                     u=5, v=3, bend=.5)
        fr = random.Random(rng.random())
        for i in range(vines):
            x = -L * .5 + (i + .5) * L / vines
            for k in range(2):
                y = (.2 if k % 2 else -.2)
                ball(mesh, fr, P(x + fr.uniform(-.6, .6), y, .9), (.07, .07, .12), c, None, flex=.4, role='accent',
                     jitter=.15, u=5, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- poppy

def californiapoppy(height, spread, flowers):
    """A clump of California poppies: a low mound of feathery blue-green
    leaves and orange cups (accent) on thin stems over it."""
    def build(mesh, rng):
        H = height
        # Round 2: a dense feathery mound of many small jagged lumps, and
        # more, smaller cups just over it.
        # Round 3: fine arching fronds (a thin rib, three pairs of pinnae)
        # over a few small dark lumps -- feathery, not slabs.
        # Round 7: the fronds alone read as a spiky yucca tuft. The mound is
        # now many small spiky lumps in a dome, lighter as they rise, with
        # short fronds poking out of it -- soft and feathery.
        for k in range(18):
            a = k * ct.GOLDEN
            f = math.sqrt((k + .5) / 18)
            p = Vector((math.cos(a), math.sin(a), 0)) * spread * .44 * f + UP * H * (.07 + .24 * (1 - f))
            mesh.add_lump(p, (spread * .12, spread * .12, H * .1), 'leaf', rng, subdiv=0, jitter=.5, flex=.5,
                          shade=lambda w, n: .82 + 1.1 * w.z)
        for k in range(9):
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            d = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-d.y, d.x, 0))
            ln = spread * rng.uniform(.45, .6)
            hh = H * rng.uniform(.25, .4)
            rib = [UP * H * .03, d * ln * .45 + UP * hh, d * ln + UP * hh * .35]
            mesh.add_tube(rib, [.006, .005, .003], 3, 'leaf', flex=lambda co, t: .3 + .5 * t,
                          shade=lambda co, t: .85 + .3 * t)
            for j in range(2):
                q = rib[1] if j == 0 else rib[1].lerp(rib[2], .5)
                for sgn in (-1, 1):
                    mesh.add_tube([q, q + side * sgn * ln * .22 + d * ln * .1 + UP * hh * .1], [.004, .002], 3, 'leaf',
                                  flex=lambda co, t: .6, shade=lambda co, t: 1.0 + .1 * t)
        for k in range(flowers):
            a = k * ct.GOLDEN
            out = Vector((math.cos(a), math.sin(a), 0)) * spread * rng.uniform(.1, .45)
            h = H * rng.uniform(.62, 1.0) - .035
            pts = [Vector((0, 0, 0)), out * .4 + UP * h * .5, out + UP * h]
            mesh.add_tube(pts, [.005, .004, .0035], 3, 'leaf', flex=lambda co, t: .3 + .5 * t)
            top = pts[-1]
            mesh.add_tube([top, top + UP * .015, top + UP * .035], [.006, .02, .03], 6, 'accent', rng=rng, wobble=.1,
                          shade=lambda co, t: .85 + .3 * t, flex=lambda co, t: .8)
    return build


# ---------------------------------------------------------------- olive

def olivetree(height, spread, stems):
    """An old olive: a broad gnarled bole splitting into thick twisted stems
    that lean out, forking into crooked limbs under a rounded mop of fine
    silver-green clumps, broader than tall, with sky between the masses."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .68
        shade = ct.crown_shade(c, (R, R, H * .34), low=.48, high=1.15)
        # Round 2: a bigger bole, thick stems forking at a third of the
        # height, the mop fuller and lower.
        ball(mesh, rng, UP * .3, (H * .095, H * .08, .6), c, lambda w, n: .78, role='bark', jitter=.3, u=8, v=5,
             bend=.0, flex=.0)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            side = Vector((-d.y, d.x, 0))
            p0 = d * H * .03
            p3 = d * R * .26 + UP * H * .32
            path = bez(p0, p0 + side * H * .06 + UP * H * .12, p3 - side * H * .06 - UP * H * .08, p3, 6)
            bark_tube(mesh, rng, path, H * .06, H * .036, 8, shade=(.68, .95), wobble=.2)
            for j in range(3):
                b = a + (j - 1) * .9 + rng.uniform(-.2, .2)
                end = heading(b) * R * rng.uniform(.45, .8) + UP * H * rng.uniform(.5, .74)
                ct.limb(mesh, rng, p3, end, H * .024, H * .008, sides=5, bow=.12)
                cluster(mesh, rng, end + UP * R * .05, R * .32, 6, c, shade)
        for k in range(3):
            q = heading(a0 + k * 2.1 + .8) * R * .22 + UP * H * .86
            cluster(mesh, rng, q, R * .34, 6, c, shade)
    return build


# ---------------------------------------------------------------- jacaranda

def jacaranda(height, spread, limbs):
    """Jacaranda: a short trunk forking into crooked limbs that climb in a
    vase, then reach out level, carrying flat ferny layers -- a broad
    flat-topped umbrella with sky between the layers; in late spring the
    whole crown turns violet-blue (the leaf role then drawn so), flower
    clusters (accent) over its top."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .24, H * .045, lean=drift(rng, H * .04), steps=5,
                              sides=8, flare=1.5, bend=H * .03, shade_low=.72, shade_high=.92)
        top = pts[-1]
        r = radii[-1]
        c = Vector((top.x, top.y, H * .72))
        shade = ct.crown_shade(c, (R, R, H * .28), low=.45, high=1.18)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        # Round 2: thicker crooked limbs that show, smaller rounder layers
        # with sky between -- an open irregular umbrella, not a table.
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            elbow = top + d * R * rng.uniform(.3, .45) + drift(rng, R * .1) + UP * (H * rng.uniform(.55, .68) - top.z)
            end = d * R * rng.uniform(.78, .95) + UP * H * rng.uniform(.6, .72)
            ct.limb(mesh, rng, top, elbow, r * .8, r * .5, sides=6, bow=-.08)
            ct.limb(mesh, rng, elbow, end, r * .5, r * .15, sides=5, bow=.12)
            for q, sf in ((end, .22), (elbow.lerp(end, .5) + UP * H * .08, .2), (elbow + UP * H * .14, .19)):
                s = R * sf * rng.uniform(.9, 1.1)
                clump(mesh, rng, q + UP * s * .15, s, c, shade, squash=.75, jitter=.24)
                for k in range(1):
                    p = q + drift(fr, s * .4) + UP * s * .5
                    ball(mesh, fr, p, (s * .4, s * .4, s * .2), c, None, flex=.7, role='accent', jitter=.2, u=6, v=4,
                         bend=.2)
        for k in range(4):
            s = R * .22
            clump(mesh, rng, heading(a0 + k * 1.57 + .5) * R * .25 + UP * H * .9, s, c, shade, squash=.75, jitter=.24)
    return build


# ---------------------------------------------------------------- pepper tree

def peppertree(height, spread, limbs):
    """California pepper tree: a gnarled leaning trunk forking into limbs that
    arch up and over; from the arches hang long curtains of fine strands,
    almost to the grass at the outside -- a willow's weeping outline --
    with pink peppercorn clusters (accent) among them."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .24, H * .04, lean=drift(rng, H * .06), steps=5,
                              sides=8, flare=1.7, bend=H * .04, shade_low=.7, shade_high=.95, wobble=.12)
        top = pts[-1]
        r = radii[-1]
        c = Vector((top.x, top.y, H * .6))
        shade = ct.crown_shade(c, (R, R, H * .4), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            reach = R * rng.uniform(.75, .9)
            p0 = top
            p1 = top + d * reach * .2 + UP * H * .35
            p2 = d * reach * .55 + UP * H * rng.uniform(.95, 1.05)
            p3 = d * reach + UP * H * rng.uniform(.6, .7)
            path = bez(p0, p1, p2, p3, 7)
            bark_tube(mesh, rng, path, r * .6, H * .004, 6, wobble=.1)
            # Round 2: a fuller top, and three thinner strands at each point.
            for f in (.4, .7):
                q = path[int(round(f * 7))]
                s = R * .28
                clump(mesh, rng, q + UP * s * .1, s, c, shade, squash=.72, jitter=.2)
            for idx in (4, 5, 6, 7):
                p = path[idx]
                for j in range(4):
                    side = Vector((-d.y, d.x, 0)) * (j - 1.5) * R * .11
                    q = p + side + d * R * fr.uniform(-.05, .08) + UP * R * .08
                    Lr = (q.z - H * .1) * (.3 + .12 * idx) * fr.uniform(.6, 1.0)
                    ball(mesh, rng, q - UP * Lr * .5 + d * R * .04, (R * .042, R * .038, Lr * .5), c, shade, jitter=.25, u=5,
                         v=4, bend=.4)
                    if fr.random() < .38:
                        ball(mesh, fr, q - UP * Lr * fr.uniform(.3, .75) + d * R * .07, (.2, .2, .3), c, None, flex=.6,
                             role='accent', jitter=.2, u=5, v=3, bend=.2)
    return build


MODELS = [
    ('Blender_ValleyOak_1', valleyoak(22, 32, 6, .2)),
    ('Blender_ValleyOak_2', valleyoak(20, 34, 6, .4)),
    ('Blender_BlueOak_1', blueoak(9, 10, 5, .02)),
    ('Blender_BlueOak_2', blueoak(7, 11, 4, .1)),
    ('Blender_Buckeye_1', buckeye(6, 10, 5)),
    ('Blender_GrapeVine_1', grapevine(10, 7)),
    ('Blender_CaliforniaPoppy_1', californiapoppy(.32, .3, 11)),
    ('Blender_OliveTree_1', olivetree(7, 9.5, 3)),
    ('Blender_Jacaranda_1', jacaranda(12, 14, 6)),
    ('Blender_PepperTree_1', peppertree(11, 13, 5)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'ValleyOak': '#6e6a62', 'BlueOak': '#a09a8e', 'Buckeye': '#aaa69c', 'GrapeVine': '#6a5a4a',
        'CaliforniaPoppy': '#7a9a8a', 'OliveTree': '#7a766c', 'Jacaranda': '#6a645c', 'PepperTree': '#8a7058'}
STONE = {'GrapeVine': '#9a9a96'}
# Leaf and accent per season, from each spec's Seasons table. Deciduous trees
# are drawn in leaf (their bare variants come later): a bare season keeps the
# summer leaf. An accent with no flowers or fruit that season is drawn the
# leaf's colour. The vineyard's spec leaves its seasons undefined: PLACED
# from the pictures (green spring/summer, gold autumn, dark red-purple
# grapes).
LOOK = {
    'ValleyOak': {'spring': ('#9ab75a', None), 'summer': ('#5c7e3c', None), 'autumn': ('#b0904a', None), 'winter': ('#5c7e3c', None)},
    'BlueOak': {'spring': ('#97ad6a', None), 'summer': ('#8a9e86', None), 'autumn': ('#a8925a', None), 'winter': ('#8a9e86', None)},
    'Buckeye': {'spring': ('#8fb45a', '#f2eee0'), 'summer': ('#a8925a', '#c8b88a'), 'autumn': ('#a8925a', '#a8925a'), 'winter': ('#8fb45a', '#8fb45a')},
    'GrapeVine': {'spring': ('#9ab85a', '#9ab85a'), 'summer': ('#5a7e34', '#4a3456'), 'autumn': ('#c49a3a', '#3e2a48'), 'winter': ('#5a7e34', '#5a7e34')},
    'CaliforniaPoppy': {'spring': ('#7a9a8a', '#f08a1e'), 'summer': ('#8a9a7a', '#f08a1e'), 'autumn': ('#a89a6a', '#a89a6a'), 'winter': ('#7a9a8a', '#7a9a8a')},
    'OliveTree': {'spring': ('#8a9a7a', None), 'summer': ('#84967a', None), 'autumn': ('#84967a', None), 'winter': ('#829478', None)},
    'Jacaranda': {'spring': ('#8a7ac8', '#9a8ad8'), 'summer': ('#5f8a3e', '#5f8a3e'), 'autumn': ('#6a8a42', '#6a8a42'), 'winter': ('#8a9a52', '#8a9a52')},
    'PepperTree': {'spring': ('#7a9a4a', '#7a9a4a'), 'summer': ('#749448', '#d06a7a'), 'autumn': ('#749448', '#d0607a'), 'winter': ('#729246', '#d0607a')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(look[2] if len(look) > 2 else BARK[sp])}
        if look[1]:
            t['accent'] = hexrgb(look[1])
        if sp in STONE:
            t['stone'] = hexrgb(STONE[sp])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.33, 0.35, 0.30),
                           'stone': (0.69, 0.63, 0.48)},
          far={'Blender_ValleyOak_1', 'Blender_ValleyOak_2', 'Blender_GrapeVine_1'},
          tints=tints(SEASON))
