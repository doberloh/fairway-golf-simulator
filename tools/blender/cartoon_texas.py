# THE TEXAS PACK (the US landscapes goal, 2 November 2026; PLAN.md section
# 5, local): what the Texas Hill Country, the Blackland Prairie and the Cross
# Timbers lacked -- the Ashe juniper ("cedar"), post oak, pecan, cedar elm,
# Osage orange, Texas mountain laurel, eastern redbud, a clump of bluebonnets
# and the pale layered limestone of the Hill Country.
#
#   node tools/blender/iterate.mjs cartoon_texas <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid, and none may read as the live oak (broad low dome far wider than
# tall on sinuous limbs, cartoon_southoaks), the bur oak (wide flat ragged on
# level limbs) or the blackjack (small gnarled dark scrag). The juniper is a
# cluster of small-lobed shaggy spires on several stems; the post oak a stout
# crooked trunk under a few big cauliflower masses; the pecan a tall clear
# trunk under a broad open oval of flat feathery clumps with sky between; the
# cedar elm a vase whose fine clumps hang at the tips; the Osage orange a
# leaning multi-stem fountain, wider than tall, bare twigs poking out; the
# mountain laurel an upright dense oval shrub; the redbud a low wide
# flat-topped vase of flat clumps.
#
# REFS ashejuniper=Blender_AsheJuniper_1,Blender_AsheJuniper_2
# REFS postoak=Blender_PostOak_1,Blender_PostOak_2
# REFS pecan=Blender_Pecan_1,Blender_Pecan_2
# REFS cedarelm=Blender_CedarElm_1
# REFS osageorange=Blender_OsageOrange_1
# REFS mountainlaurel=Blender_MountainLaurel_1
# REFS redbud=Blender_Redbud_1
# REFS bluebonnet=Blender_Bluebonnet_1
# REFS limestoneboulder=Blender_LimestoneBoulder_1,Blender_LimestoneBoulder_2
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


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


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
    for x in lowball(mesh, q, radii, role, rng, u, v, jitter):
        out = x.co - c
        out = out.normalized() if out.length > 1e-6 else UP
        n = (mesh.normal[x] * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = shade(x.co, n) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0] * bright, mm[1] * bright, mm[2] * bright, flex)


# ---------------------------------------------------------------- Ashe juniper

def ashejuniper(height, spread, stems, peak, low):
    """Ashe juniper: several shaggy stems from the ground, each carrying its
    own column of small dense lobes tapering to a blunt point, set side by
    side across the width (round 2), so the tree is a broad cluster of
    rounded-to-conical clumps at different heights, its edge ragged and
    fine. `peak` 0..1: how pointed each column is; `low`: where the foliage
    starts, as a share of the height (0.08 a thicket to the ground, 0.25 a
    dome on short bare stems)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.4, high=1.12)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            base = d * rng.uniform(.05, .3)
            top_h = H * (1.0 if s == 0 else rng.uniform(.68, .92))
            out = R * (.1 if s == 0 else rng.uniform(.5, .66))
            sp = [base, base + d * out * .4 + UP * H * low * .6 + drift(rng, .15), base + d * out * .8 + UP * top_h * .55]
            bark_tube(mesh, rng, sp, H * .026, H * .01, 6, shade=(.75, .95), wobble=.14)
            n = 6
            z0 = H * (low + .06)
            for k in range(n):
                f = k / (n - 1)
                axis = base + d * out * (.8 + .2 * f) + UP * (z0 + (top_h - z0) * f)
                r = R * (.5 - .36 * peak * f) * (1.0 if s == 0 else .82) * (1 - (.4 * (1 - f) if low > .1 else 0))
                for j in range(2):
                    b = rng.uniform(0, math.tau)
                    q = axis + heading(b) * r * .4
                    sz = r * rng.uniform(.58, .76)
                    ball(mesh, rng, q, (sz, sz, sz * (1.05 if low < .1 else .8)), c, shade, jitter=.26, bend=.35)
            sz = R * .18 * (1.0 if s == 0 else .85)
            ball(mesh, rng, axis + UP * sz * .6, (sz * .75, sz * .75, sz * (1.0 + .5 * peak)), c, shade, jitter=.2, bend=.35)
    return build


# ---------------------------------------------------------------- post oak

def postoak(height, spread, limbs, lean):
    """Post oak: a stocky trunk, short, forking into heavy crooked limbs that
    kink as they climb; a dense rounded crown about as tall as it is wide
    above them, built of a few big cauliflower masses with notches between,
    the crooked limbs showing under it."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .24, H * .062, lean=drift(rng, H * lean), steps=5,
                              sides=9, flare=1.6, bend=H * .03, shade_low=.74, shade_high=.95)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .62))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .38), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        r = radii[-1]
        # Round 2: the crown comes down to a third of the height -- a low
        # ring of clumps on the first kinks, rounder clumps, longer reach.
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            reach = spread * rng.uniform(.33, .4)
            endz = H * rng.uniform(.62, .78)
            k1 = top + d * reach * .35 + UP * (endz - top.z) * .3 + drift(rng, reach * .2)
            k2 = top + d * reach * .72 + UP * (endz - top.z) * .55 + drift(rng, reach * .2)
            end = top + d * reach
            end.z = endz
            ct.limb(mesh, rng, top, k1, r * .72, r * .5, sides=6, bow=.1)
            ct.limb(mesh, rng, k1, k2, r * .5, r * .32, sides=6, bow=-.15)
            ct.limb(mesh, rng, k2, end, r * .32, r * .15, sides=5, bow=.15)
            s = spread * rng.uniform(.17, .2)
            clump(mesh, rng, end + UP * s * .3 + d * s * .1, s, c, shade, squash=.92, jitter=.14)
            s2 = s * .85
            clump(mesh, rng, k2 + UP * s2 * .1 + d * s2 * .45, s2, c, shade, squash=.9, jitter=.14)
            s3 = s * .72
            clump(mesh, rng, k1 + d * s3 * .9 + UP * s3 * .1, s3, c, shade, squash=.9, jitter=.14)
        for k in range(3):
            s = spread * .19
            q = top + heading(a0 + k * 2.1) * spread * .12
            q.z = H - s * .85
            clump(mesh, rng, q, s, c, shade, squash=.88, jitter=.14)
        # Round 11: two inner masses fill the dark gaps between the outer
        # ones, so the crown reads as one dense dome, not puzzle pieces.
        for k in range(2):
            s = spread * .2
            clump(mesh, rng, top + heading(a0 + k * 3.1 + 1.6) * spread * .14 + UP * (H * .56 - top.z), s, c, shade, squash=.9, jitter=.14)
    return build


# ---------------------------------------------------------------- pecan

def pecan(height, spread, limbs):
    """Pecan: a tall straight clear trunk, then long ascending limbs that arch
    out and over at their ends; a broad, open, spreading oval crown of flat
    feathery clumps along the outer limbs, with sky between them."""
    def build(mesh, rng):
        H, R = height, spread * .5
        fork = H * .32
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork, H * .024, lean=drift(rng, H * .015), steps=6,
                              sides=10, flare=1.5, bend=H * .006, shade_low=.8, shade_high=1.0)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .7))
        shade = ct.crown_shade(c, (R, R, H * .32), low=.45, high=1.18)
        a0 = rng.uniform(0, math.tau)
        lead = [top, top + UP * H * .25 + drift(rng, .4), top + UP * H * .48]
        bark_tube(mesh, rng, lead, radii[-1] * .7, radii[-1] * .25, 7)
        # Round 2: limbs end at heights from mid-crown to the top, four
        # clumps along each and a side spray, so the clumps fill an open
        # oval from 0.4 of the height up, sky between.
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            hi = i % 2 == 0
            reach = R * (rng.uniform(.62, .74) if hi else rng.uniform(.88, 1.0))
            p0 = top - UP * fork * rng.uniform(0, .12)
            endz = H * (rng.uniform(.82, .9) if hi else rng.uniform(.52, .62))
            p1 = p0 + d * reach * .15 + UP * H * .2
            p2 = d * reach * .65 + UP * (endz + H * .06)
            p3 = d * reach + UP * endz
            path = bez(p0, p1, p2, p3, 6)
            bark_tube(mesh, rng, path, radii[-1] * .55, H * .004, 6)
            for f, k in ((.5, .85), (.8, 1.05), (1.0, 1.1)):
                q = path[int(round(f * 6))]
                s = R * rng.uniform(.26, .3) * k
                clump(mesh, rng, q + UP * s * .2 + drift(rng, s * .3), s, c, shade, squash=.8, jitter=.2)
            side = Vector((-d.y, d.x, 0)) * rng.choice((-1, 1))
            q = path[3] + side * R * .3 + d * R * .1 - UP * H * .04
            ct.limb(mesh, rng, path[2], q, H * .006, H * .003, sides=4, bow=.1)
            s = R * .26
            clump(mesh, rng, q + UP * s * .2, s, c, shade, squash=.8, jitter=.2)
        for k in range(3):
            s = R * .27
            q = lead[-1] + heading(a0 + k * 2.1) * R * .18 + UP * s * .2
            clump(mesh, rng, q, s, c, shade, squash=.8, jitter=.2)
    return build


# ---------------------------------------------------------------- cedar elm

def cedarelm(height, spread):
    """Cedar elm: a short trunk forking into a few steep limbs (a vase), whose
    branches arch out and droop at the tips; small fine clumps hang from
    them, so the crown is an irregular vase with a weeping fringe."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .3, H * .03, lean=drift(rng, H * .03), steps=5,
                              sides=8, flare=1.5, bend=H * .02, shade_low=.78, shade_high=.98)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .66))
        shade = ct.crown_shade(c, (R, R, H * .34), low=.45, high=1.15)
        a0 = rng.uniform(0, math.tau)
        # Round 2: five limbs, every one clothed along its length, and its
        # arching side branches hung with bigger fine balls -- a full upright
        # oval of fine texture with a weeping fringe.
        for i in range(5):
            a = a0 + i / 5 * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            end = top + d * R * rng.uniform(.45, .65) + UP * (H * rng.uniform(.84, .97) - top.z)
            ct.limb(mesh, rng, top, end, radii[-1] * .6, radii[-1] * .2, sides=6, bow=.08)
            # Round 8: every mass is a little cluster of small 36-triangle
            # balls, not one big lobe -- the fine, ragged edge of a small-
            # leaved elm, apart from the oaks' coarse lobes (and cheaper).
            def cluster(q, s, n, hang=0.0, u=6, v=4):
                for m in range(n):
                    o = drift(rng, s * .5) + UP * s * rng.uniform(-.3, .3)
                    k = s * rng.uniform(.6, .74)
                    ball(mesh, rng, q + o - UP * s * hang, (k, k, k * (1 + hang)), c, shade, jitter=.25, u=u, v=v, bend=.4)
            cluster(end + UP * R * .06, R * .32, 5)
            cluster(top.lerp(end, .6) + d * R * .22, R * .3, 4)
            for j in range(2):
                b = a + (j - .5) * 1.3 + rng.uniform(-.2, .2)
                e = heading(b)
                p = top.lerp(end, rng.uniform(.3, .6))
                tip = p + e * R * rng.uniform(.6, .75) - UP * H * rng.uniform(.02, .08)
                mid = p.lerp(tip, .5) + UP * H * .08
                bark_tube(mesh, rng, [p, mid, tip], radii[-1] * .22, H * .002, 4)
                for f in (.33, .66, 1.0):
                    q = p.lerp(mid, min(1, f * 2)) if f < .5 else mid.lerp(tip, (f - .5) * 2)
                    cluster(q, R * .23, 3, hang=.3, u=5, v=3)
    return build


# ---------------------------------------------------------------- Osage orange

def osageorange(height, spread, stems):
    """Osage orange: a few short crooked stems leaning out from one root, each
    splitting into arching crooked limbs -- a fountain of a tree, wider than
    tall, with a dense, tangled, lumpy crown, bare thorny twigs poking out of
    its edge and green hedge apples (accent) hanging under it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .58
        shade = ct.crown_shade(c, (R, R, H * .38), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            k1 = d * H * .05 + UP * H * .2 + drift(rng, H * .04)
            fork = d * H * .1 + UP * H * .4 + drift(rng, H * .04)
            r = H * .028
            ct.limb(mesh, rng, Vector((0, 0, -.1)), k1, r * 1.2, r, sides=6, bow=.05)
            ct.limb(mesh, rng, k1, fork, r, r * .75, sides=6, bow=-.1)
            # Round 2: limbs rise higher, clumps bigger and rounder -- a dense
            # rounded irregular crown, not an acacia's flat one.
            for j in range(3):
                b = a + (j - 1) * .9 + rng.uniform(-.2, .2)
                e = heading(b)
                reach = R * rng.uniform(.55, .82)
                mid = fork + e * reach * .4 + UP * H * rng.uniform(.25, .38)
                end = fork + e * reach + UP * H * rng.uniform(.2, .42)
                ct.limb(mesh, rng, fork, mid, r * .6, r * .35, sides=4, bow=.12)
                ct.limb(mesh, rng, mid, end, r * .35, r * .15, sides=4, bow=-.1)
                s1 = R * rng.uniform(.25, .29)
                clump(mesh, rng, end + UP * s1 * .2, s1, c, shade, squash=.9, jitter=.22)
                s2 = R * rng.uniform(.23, .27)
                clump(mesh, rng, mid + UP * s2 * .55, s2, c, shade, squash=.9, jitter=.22)
                tw = end + e * R * .38 + UP * H * fr.uniform(.06, .2) + drift(fr, .3)
                ct.limb(mesh, rng, end, tw, r * .22, r * .06, sides=4, bow=.1)
                for k in range(1 if j != 1 else 2):
                    q = end + heading(b + fr.uniform(-1.2, 1.2)) * s1 * 1.1 - UP * s1 * fr.uniform(.0, .3)
                    ball(mesh, fr, q, (.17, .17, .16), c, None, flex=.6, role='accent', jitter=.08, u=6, v=4, bend=.2)
        for k in range(3):
            s = R * .27
            clump(mesh, rng, heading(a0 + k * 2.1 + 1) * R * .25 + UP * (H - s * .9), s, c, shade, squash=.88, jitter=.22)
    return build


# ---------------------------------------------------------------- mountain laurel

def mountainlaurel(height, spread, stems):
    """Texas mountain laurel: several stems from the ground under a dense
    upright oval of glossy dark leaves, with big drooping purple flower
    clusters like wisteria (accent) over its outside in spring."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .6
        shade = ct.crown_shade(c, (R, R, H * .4), low=.38, high=1.25)
        a0 = rng.uniform(0, math.tau)
        for s in range(stems):
            a = a0 + s / stems * math.tau
            d = heading(a)
            ct.limb(mesh, rng, d * R * .14 - UP * .05, d * R * .5 + UP * H * .6, H * .02, H * .008, sides=5, bow=.05)
        # Round 2: the crown lifted off the ground to show the splayed stems,
        # and more, smaller clumps so its outline is lumpy.
        lv = ((.45, .75, 6, .3), (.65, .82, 7, .3), (.85, .5, 5, .28))
        spots = []
        for zf, rf, n, sf in lv:
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                q = heading(a) * R * rf + UP * H * zf
                s = R * sf * 1.15 * rng.uniform(.88, 1.12)
                ball(mesh, rng, q, (s, s, s), c, shade, jitter=.14, u=10, v=6, bend=.6)
                spots.append((q, s, a))
        s = R * .45
        clump(mesh, rng, UP * (H - s * .8), s, c, shade, tall=.95)
        fr = random.Random(rng.random())
        # Round 16: many small clusters (three a clump, the top too), each a
        # 20-triangle 5 x 3 ball -- big pasted discs read as stickers.
        spots.append((UP * (H - s * .8), s, 0.0))
        for q, s, a in spots * 3:
            a = a + fr.uniform(-1.0, 1.0)
            p = q + heading(a) * s * fr.uniform(.75, .95) + UP * s * fr.uniform(-.35, .5)
            ball(mesh, fr, p - UP * .1, (.12, .12, .22), c, None, flex=.9, role='accent', jitter=.15, u=5, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- redbud

def redbud(height, spread, stems):
    """Eastern redbud: a few stems forking low into a wide vase of limbs, the
    crown a broad flat-topped spread of flat clumps (heart leaves layered);
    in spring its bare limbs are smothered in magenta flowers (accent,
    clustered along the limbs, and the leaf role then drawn the same)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .68
        shade = ct.crown_shade(c, (R, R, H * .28), low=.45, high=1.18)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.2, .2)
            d = heading(a)
            fork = d * R * .2 + UP * H * .32 + drift(rng, .2)
            r = H * .022
            ct.limb(mesh, rng, Vector((0, 0, -.05)), fork, r, r * .75, sides=6, bow=.06)
            for j in range(3):
                b = a + (j - 1) * .8 + rng.uniform(-.2, .2)
                e = heading(b)
                end = e * R * rng.uniform(.7, .92) + UP * H * rng.uniform(.7, .82)
                mid = fork.lerp(end, .5) + UP * H * .04
                ct.limb(mesh, rng, fork, mid, r * .7, r * .45, sides=4, bow=.1)
                ct.limb(mesh, rng, mid, end, r * .45, r * .15, sides=4, bow=.05)
                # Round 2: bigger, rounder clumps -- a dense wide crown.
                for q, sf in ((end, .25), (mid + e * R * .08 + UP * H * .06, .22)):
                    sz = R * sf * rng.uniform(.9, 1.1)
                    clump(mesh, rng, q + UP * sz * .15, sz, c, shade, squash=.68, jitter=.16)
                for k in range(2):
                    p = fork.lerp(mid, .3 + .35 * k) if k < 1 else mid.lerp(end, .4)
                    ball(mesh, fr, p + drift(fr, .08), (.2, .2, .16), c, None, flex=.6, role='accent', jitter=.2, u=6, v=4,
                         bend=.2)
        for k in range(3):
            s = R * .26
            clump(mesh, rng, heading(a0 + k * 2.1 + .5) * R * .3 + UP * (H - s * .6), s, c, shade, squash=.62)
    return build


# ---------------------------------------------------------------- bluebonnet

def bluebonnet(height, spread, spikes):
    """A clump of Texas bluebonnets: a low rosette of palmate leaves and
    upright spikes of blue pea flowers (accent) tipped white (the bark
    role)."""
    def build(mesh, rng):
        H = height
        # Round 2: a fuller, lower rosette; thinner, shorter spikes.
        for k in range(11):
            a = k / 11 * math.tau + rng.uniform(-.3, .3)
            rr = spread * (.3 if k % 2 else .16)
            p = Vector((math.cos(a) * rr, math.sin(a) * rr, H * (.08 if k % 2 else .16)))
            mesh.add_lump(p, (spread * .14, spread * .14, H * .035), 'leaf', rng, subdiv=0, jitter=.25, flex=.5,
                          shade=lambda w, n: .9)
        for k in range(spikes):
            a = k * ct.GOLDEN
            base = Vector((math.cos(a) * spread * .32, math.sin(a) * spread * .32, H * .42))
            mesh.add_tube([Vector((0, 0, 0)), base], [.006, .005], 4, 'leaf', flex=lambda co, t: .3)
            mesh.add_lump(base * .6 + Vector((0, 0, .01)), (spread * .09, spread * .09, H * .03), 'leaf', rng, subdiv=0, jitter=.25,
                          flex=.6, shade=lambda w, n: .95)
            h = H * rng.uniform(.34, .48)
            lean = Vector((base.x, base.y, 0)) * .4
            pts = [base + Vector((0, 0, h * t / 4)) + lean * (t / 4) for t in range(5)]
            mesh.add_tube(pts, [.026 * (1 - .82 * t / 4) for t in range(5)], 5, 'accent', rng=rng, wobble=.15,
                          shade=lambda co, t: .9 + .2 * t, flex=lambda co, t: .5 + .5 * t)
            for j in range(3):
                q = pts[0].lerp(pts[-1], .12 + .26 * j)
                b = j * 2.4 + rng.uniform(-.3, .3)
                rr = .02 * (1 - .6 * j / 3)
                mesh.add_lump(q + Vector((math.cos(b) * rr, math.sin(b) * rr, 0)), (rr, rr, .024), 'accent', rng,
                              subdiv=0, jitter=.1, flex=.7, shade=lambda w, n: 1.05)
            mesh.add_lump(pts[-1] + Vector((0, 0, .01)), (.02, .02, .04), 'bark', rng, subdiv=0, jitter=.05, flex=.9,
                          shade=lambda w, n: 1.1)
    return build


# ---------------------------------------------------------------- limestone

def slab(mesh, rng, base, w, d, t, points=14, bevel=.05, lo=.72, hi=1.06):
    """One flat-bedded limestone bed: a hull cut to a thin band at its
    equator (flat top and bottom), standing on `base`; returns its top."""
    f = .75
    rz = t / (2 * (1 - f))
    z0 = base.z - f * rz - .03
    ct.hull_rock(mesh, rng, Vector((base.x, base.y, z0)), (w * .5, d * .5, rz), points=points, bevel=bevel, seat=0,
                 flat_top=f, flat_bottom=f, shade_low=lo, shade_high=hi)
    return z0 + (2 - f) * rz


def limestoneledge(width, depth, beds):
    """A limestone ledge: flat beds stacked, each stepped back from the one
    below toward +Y, so the front (-Y) is a stair of pale weathered shelves;
    a couple of broken blocks at its foot."""
    def build(mesh, rng):
        z = 0.0
        y = 0.0
        w, d = width, depth
        # Round 2: angular outlines (fewer hull points), thinner beds, more
        # of them, stepped further back, darker at each bed's foot.
        for b in range(beds):
            t = rng.uniform(.24, .34)
            z = slab(mesh, rng, Vector((rng.uniform(-.2, .2), y, z)), w, d, t, points=10, bevel=.03, lo=.52 + .05 * b,
                     hi=1.02 + .03 * b)
            y += d * rng.uniform(.16, .22)
            w *= rng.uniform(.84, .92)
            d *= rng.uniform(.74, .84)
        for k in range(2):
            x = (k - .5) * width * .5 + rng.uniform(-.3, .3)
            slab(mesh, rng, Vector((x, -depth * .62, 0)), rng.uniform(.6, .85), rng.uniform(.5, .65), rng.uniform(.38, .5),
                 points=8, bevel=.05)
    return build


def limestoneblock(width, depth, beds):
    """A blocky limestone boulder: a few thick beds nearly in line, so it
    reads as one block with bedding lines across it, its top flat."""
    def build(mesh, rng):
        z = 0.0
        w, d = width, depth
        for b in range(beds):
            t = rng.uniform(.32, .42)
            z = slab(mesh, rng, Vector((rng.uniform(-.12, .12), rng.uniform(-.1, .1), z)), w, d, t, points=8,
                     bevel=.04, lo=.55 + .05 * b, hi=1.02 + .03 * b)
            w *= rng.uniform(.9, .97)
            d *= rng.uniform(.9, .97)
    return build


MODELS = [
    ('Blender_AsheJuniper_1', ashejuniper(7, 8, 5, .75, .04)),
    ('Blender_AsheJuniper_2', ashejuniper(5.5, 9, 5, .25, .22)),
    ('Blender_PostOak_1', postoak(13, 11, 5, .02)),
    ('Blender_PostOak_2', postoak(10, 10, 4, .08)),
    ('Blender_Pecan_1', pecan(30, 24, 6)),
    ('Blender_Pecan_2', pecan(24, 19, 5)),
    ('Blender_CedarElm_1', cedarelm(14, 10)),
    ('Blender_OsageOrange_1', osageorange(12, 11, 3)),
    ('Blender_MountainLaurel_1', mountainlaurel(4.5, 3, 4)),
    ('Blender_Redbud_1', redbud(7, 9, 3)),
    ('Blender_Bluebonnet_1', bluebonnet(.42, .34, 7)),
    ('Blender_LimestoneBoulder_1', limestoneledge(5, 3, 4)),
    ('Blender_LimestoneBoulder_2', limestoneblock(1.8, 1.3, 3)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'AsheJuniper': '#7a5e4a', 'PostOak': '#5e564c', 'Pecan': '#6e665c', 'CedarElm': '#6a6460',
        'OsageOrange': '#7a5a3a', 'MountainLaurel': '#5a5650', 'Redbud': '#3e3a36', 'Bluebonnet': '#f2f0ea'}
STONE = {'LimestoneBoulder': '#d8d0b8'}
# Leaf, accent (and for the bluebonnet the white tip, bark) per season, from
# each spec's Seasons table. Deciduous trees are drawn in leaf (their bare
# variants come later): a bare winter keeps the summer leaf, except where the
# spec says leaves are held (the post oak's brown ones). An accent with no
# flowers or fruit that season is drawn the leaf's colour.
LOOK = {
    'AsheJuniper': {'spring': ('#4f6e44', None), 'summer': ('#4b6a40', None), 'autumn': ('#4b6a40', None), 'winter': ('#6e6a40', None)},
    'PostOak': {'spring': ('#9ab558', None), 'summer': ('#4c6e34', None), 'autumn': ('#8a6a34', None), 'winter': ('#7a5e3a', None)},
    'Pecan': {'spring': ('#a9c06a', None), 'summer': ('#4f7a36', None), 'autumn': ('#bfa23e', None), 'winter': ('#4f7a36', None)},
    'CedarElm': {'spring': ('#9ab45c', None), 'summer': ('#4f7436', None), 'autumn': ('#c2a63a', None), 'winter': ('#4f7436', None)},
    'OsageOrange': {'spring': ('#9ab55a', '#9ab55a'), 'summer': ('#4f7a36', '#a8b84a'), 'autumn': ('#c8b03a', '#9aae3e'), 'winter': ('#4f7a36', '#4f7a36')},
    'MountainLaurel': {'spring': ('#3f6a34', '#7a5aa8'), 'summer': ('#3f6a34', '#3f6a34'), 'autumn': ('#3f6a34', '#3f6a34'), 'winter': ('#3d6632', '#3d6632')},
    'Redbud': {'spring': ('#c4508a', '#c4508a'), 'summer': ('#557e38', '#557e38'), 'autumn': ('#c2a640', '#c2a640'), 'winter': ('#557e38', '#557e38')},
    'Bluebonnet': {'spring': ('#5a7a40', '#3a5ac8', '#f2f0ea'), 'summer': ('#8a8a50', '#9a8a5a', '#9a8a5a'),
                   'autumn': ('#5a7a40', '#5a7a40', '#5a7a40'), 'winter': ('#5a7a40', '#5a7a40', '#5a7a40')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        if sp in STONE:
            out[name] = {'stone': hexrgb(STONE[sp])}
            continue
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(look[2] if len(look) > 2 else BARK[sp])}
        if look[1]:
            t['accent'] = hexrgb(look[1])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.33, 0.35, 0.30),
                           'stone': (0.69, 0.63, 0.48)},
          far={'Blender_Pecan_1', 'Blender_Pecan_2'},
          tints=tints(SEASON))
