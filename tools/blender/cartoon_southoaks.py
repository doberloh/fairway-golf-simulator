# THE SOUTH OAKS PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): the trees of the South, Texas and Florida -- the live
# oak (the most shared model of the goal), the live oak hung with Spanish
# moss, the sandhill turkey oak and blackjack oak, the bald cypress with its
# knees, and the water tupelo.
#
#   node tools/blender/iterate.mjs cartoon_southoaks <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid. The live oak is a broad low canopy far wider than tall, its rim
# dropping toward the ground on sinuous limbs that dip and rise again under
# it; the turkey oak a crooked thin stem with sparse small tufts; the blackjack
# a low gnarled dark scrag with dead twigs poking out; the bald cypress a
# fluted flared foot under a narrow column of flat layered sprays (round 5:
# skirts read as leafy hands) with a flat top; the water tupelo a bottle foot
# under a tall leaning bole and an open crown of separate lobes. Cost (round
# 11): sprays and knee knobs are `lowball`, an 8 x 5 sphere of 64 triangles.
#
# REFS liveoak=Blender_LiveOak_1,Blender_LiveOak_2
# REFS liveoakmoss=Blender_LiveOakMoss_1,Blender_LiveOakMoss_2
# REFS turkeyoak=Blender_TurkeyOak_1
# REFS blackjackoak=Blender_BlackjackOak_1
# REFS baldcypress=Blender_BaldCypress_1,Blender_BaldCypress_2
# REFS cypressknees=Blender_CypressKnees_1
# REFS watertupelo=Blender_WaterTupelo_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def at(pts, t):
    i = max(0, min(len(pts) - 1, int(round(t * (len(pts) - 1)))))
    return i, pts[i]


def bez(p0, p1, p2, p3, n):
    """Cubic Bezier, n + 1 points."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(p0 * (u * u * u) + p1 * (3 * u * u * t) + p2 * (3 * u * t * t) + p3 * (t * t * t))
    return out


def clump(mesh, rng, q, s, c, shade, squash=.75, jitter=.12, flex=.8, tall=None, bottom=.3):
    sz = s * squash if tall is None else s * tall
    mesh.add_lump(q, (s, s, sz), 'leaf', rng, subdiv=3, jitter=jitter, crown=c, blend=.85, shade=shade, flex=flex,
                  squash_bottom=bottom)


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


# ---------------------------------------------------------------- live oak

def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump (round 11, the cost round): a u-by-v sphere, jittered --
    64 triangles at 8 x 5 against the 144 of add_lump's finest. Returns its
    vertices for the caller to place, bend and paint."""
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


def liveoak(height, spread, limbs, droop, moss, lift=0.0):
    """Live oak: a massive short trunk splitting into long sinuous limbs that
    run out nearly level, dip toward the ground and rise again at their ends,
    under a broad low dense canopy far wider than tall whose rim comes down
    near the ground. `droop` 0..1: how low the rim and the dipping limbs come.
    `moss`: grey Spanish moss streamers (the accent role) from the limbs and
    the canopy's underside."""
    def build(mesh, rng):
        H, R = height, spread * .5
        fork = H * .22
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork, H * .085, lean=drift(rng, H * .02), steps=5,
                              sides=10, flare=1.9, bend=H * .01, shade_low=.72, shade_high=.95)
        top = pts[-1]
        c = Vector((0, 0, H * .5))
        shade = ct.crown_shade(c, (R, R, H * .5), low=.42, high=1.18)
        a0 = rng.uniform(0, math.tau)
        mr = random.Random(rng.random())   # the moss's own stream
        hangs = []
        # The great limbs (round 1): out from the fork, up a little, then
        # nearly level, dipping toward the ground and rising at the rim.
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            side = Vector((-d.y, d.x, 0))
            reach = R * rng.uniform(.78, .92)
            low = i % 2 == 0
            dip = H * ((.06 + .1 * (1 - droop)) if low else (.2 + .06 * (1 - droop)))
            endz = H * (((.18 + .08 * (1 - droop)) if low else .3) + lift)
            p0 = top - Vector((0, 0, fork * .15)) + d * radii[-1] * .4
            p1 = p0 + d * reach * .28 + UP * H * .1
            p2 = d * reach * .68
            p2.z = dip
            p3 = d * reach
            p3.z = endz
            path = bez(p0, p1, p2, p3, 8)
            ph = rng.uniform(0, math.tau)
            for k in range(1, len(path)):
                path[k] = path[k] + side * math.sin(k / 8 * math.pi * 1.6 + ph) * reach * .07
            bark_tube(mesh, rng, path, H * .058, H * .016, 6)
            hangs += [(path[k], 1.0) for k in (4, 6)]
        # Rising inner limbs to the dome.
        for i in range(4):
            a = a0 + (i + .5) / 4 * math.tau
            end = heading(a) * R * .3 + UP * H * .62
            ct.limb(mesh, rng, top - UP * fork * .1, end, H * .035, H * .013, sides=6, bow=.1, shade=.9)
        # The canopy (round 2): one dense lumpy mass -- overlapping rings of
        # flattened clumps on a low dome, the rim lowest, so the outline is
        # a broad mushroom whose edge comes down toward the ground.
        rings = ((.86, .3 - .06 * droop + lift, 2 * limbs - 2, .22, .78),
                 (.58, .52 + lift * .6, limbs + 1, .25, .76),
                 (.28, .72 + lift * .3, 4, .26, .74))
        for ri, (rr, zz, n, ss, sq) in enumerate(rings):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau + rng.uniform(-.12, .12)
                s = R * ss * rng.uniform(.85, 1.15)
                up_k = (.72 if i % 2 == 0 else 1.25) if ri == 0 else 1.0
                q = heading(a) * R * rr * rng.uniform(.95, 1.04) + UP * H * zz * up_k * rng.uniform(.94, 1.06)
                clump(mesh, rng, q, s, c, shade, squash=sq)
                if ri < 2:
                    hangs.append((q - UP * s * sq * .5 + heading(a) * s * (.65 if ri == 0 else .3), .9 if ri == 0 else .7))
        s = R * .2
        clump(mesh, rng, UP * (H - s * .72), s, c, shade, squash=.72)
        if moss:
            # Spanish moss (round 5): blunt grey strands that swell a little
            # and end blunt (round 4's tapered ones read as icicles), long --
            # a third of the tree's height, cut short only by the ground --
            # two from each canopy point, one from each limb point.
            for j, (p, f) in enumerate(hangs):
                n = 2 if .8 < f < 1 else 1
                for k in range(n):
                    L = H * mr.uniform(.2, .42)
                    o = drift(mr, 1.2) if k else Vector((0, 0, 0))
                    q = p + o
                    L = min(L, max(.8, q.z - .4))
                    sway = drift(mr, .3)
                    w = mr.uniform(.36, .5)
                    if ct.FAR and (j + k) % 2:
                        continue
                    mesh.add_tube([q, q - UP * L * .35 + sway * .4, q - UP * L * .75 + sway * .8, q - UP * L + sway],
                                  [w * .8, w, w * .75, w * .3], 4, 'accent', shade=lambda co, t: 1.05 - .2 * t,
                                  flex=lambda co, t: .4 + .5 * t)
    return build


# ---------------------------------------------------------------- sandhill oaks

def turkeyoak(height, spread):
    """Turkey oak: a slender, slightly crooked stem, short crooked branches
    from its upper half, each with a few small ragged upright tufts -- a thin,
    open, irregular crown with sky between."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .8, H * .022, lean=drift(rng, H * .06), steps=8,
                              sides=7, flare=1.3, bend=H * .03, shade_low=.8, shade_high=1.0)
        c = Vector((pts[-1].x, pts[-1].y, H * .66))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .32))
        for j in range(8):
            f = j / 7
            i, p = at(pts, .32 + .62 * f)
            a = j * 2.4 + rng.uniform(-.5, .5)
            d = heading(a)
            L = spread * rng.uniform(.26, .36) * (1.05 - .45 * f)
            mid = p + d * L * .55 + UP * L * rng.uniform(.15, .4) + drift(rng, L * .15)
            end = mid + heading(a + rng.uniform(-.8, .8)) * L * .45 + UP * L * rng.uniform(.3, .6)
            ct.limb(mesh, rng, p, mid, radii[i] * .5, radii[i] * .28, sides=5, bow=.05)
            ct.limb(mesh, rng, mid, end, radii[i] * .28, radii[i] * .12, sides=4, bow=.05)
            s = spread * rng.uniform(.075, .1)
            clump(mesh, rng, end + UP * s * .4, s, c, shade, tall=1.25, jitter=.24)
            if j % 2 == 0:
                s2 = s * .8
                clump(mesh, rng, mid + UP * s2 * .5 + d * s2 * .3, s2, c, shade, tall=1.2, jitter=.24)
        s = spread * .085
        clump(mesh, rng, pts[-1] + UP * s * .6, s, c, shade, tall=1.3, jitter=.24)
    return build


def blackjackoak(height, spread):
    """Blackjack oak: a short black trunk forking low into gnarled, kinked
    limbs, some spreading low and wide, some rising; a rough, rounded,
    scraggly crown of tufts at every kink with gaps between, dead twigs
    poking out of it (round 5)."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .22, H * .042, lean=drift(rng, H * .04), steps=4,
                              sides=8, flare=1.5, bend=H * .02, shade_low=.75, shade_high=.95)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .58))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .35))
        a0 = rng.uniform(0, math.tau)
        r = radii[-1]
        for i in range(5):
            a = a0 + i / 5 * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            high = i % 2 == 1
            reach = spread * (rng.uniform(.2, .28) if high else rng.uniform(.36, .44))
            rise = H * (rng.uniform(.58, .66) if high else rng.uniform(.25, .34))
            p = top - UP * H * rng.uniform(0, .05)
            k1 = p + d * reach * .35 + UP * rise * .45 + drift(rng, reach * .25)
            k2 = p + d * reach * .68 + UP * rise * .7 + drift(rng, reach * .25)
            end = p + d * reach + UP * rise
            ct.limb(mesh, rng, p, k1, r * .7, r * .48, sides=6, bow=.05)
            ct.limb(mesh, rng, k1, k2, r * .48, r * .3, sides=5, bow=-.15)
            ct.limb(mesh, rng, k2, end, r * .3, r * .14, sides=4, bow=.15)
            side = heading(a + rng.choice((-1, 1)) * 1.2)
            sp = k1 + side * spread * .16 + UP * H * .1
            ct.limb(mesh, rng, k1, sp, r * .28, r * .1, sides=4, bow=.1)
            for q, s in ((end, spread * rng.uniform(.1, .12)), (sp, spread * rng.uniform(.085, .1)), (k1, spread * rng.uniform(.08, .095)),
                         (k2, spread * rng.uniform(.085, .1))):
                clump(mesh, rng, q + UP * s * .35, s, c, shade, squash=.85, jitter=.26)
            # A dead twig out of the tuft.
            tw = end + d * spread * .16 + UP * H * rng.uniform(.14, .22) + drift(rng, .4)
            ct.limb(mesh, rng, end, tw, r * .18, r * .06, sides=4, bow=.1)
    return build


# ---------------------------------------------------------------- swamp

def fluted_foot(mesh, rng, r0, H, ridges, reach, rise):
    """Root ridges leaning in from the ground to the trunk: the fluted
    buttress of a swamp tree."""
    a0 = rng.uniform(0, math.tau)
    for k in range(ridges):
        a = a0 + k / ridges * math.tau + rng.uniform(-.2, .2)
        d = heading(a)
        lo = d * r0 * reach * rng.uniform(.9, 1.1) - UP * .1
        hi = d * r0 * .6 + UP * H * rise * rng.uniform(.8, 1.1)
        mid = lo.lerp(hi, .5) + d * r0 * .5
        mesh.add_tube([lo, mid, hi], [r0 * .7, r0 * .5, r0 * .2], 5, 'bark', rng=rng, wobble=.08,
                      shade=lambda co, t: .72 + .2 * t)


def spray(mesh, rng, q, size, ang, droop, c, shade, flex=.8):
    """A flat feathery spray (round 5): a lump flattened and stretched along
    its limb, turned to heading `ang` and tipped down at its outer end by
    `droop` (radians), its normals bent to the crown's centre."""
    made = lowball(mesh, Vector((0, 0, 0)), size, 'leaf', rng, 8, 5, .2)
    ca, sa, cd, sd = math.cos(ang), math.sin(ang), math.cos(droop), math.sin(droop)
    for v in made:
        x, y, z = v.co
        x, z = x * cd + z * sd, -x * sd + z * cd
        w = q + Vector((x * ca - y * sa, x * sa + y * ca, z))
        v.co = w
        out = w - c
        out = out.normalized() if out.length > 1e-6 else UP
        nn = (out * .8 + UP * .2).normalized()
        mesh.normal[v] = nn
        m = shade(w, nn)
        mesh.paint[v] = (m, m, m, flex)


def baldcypress(height, width, flat, limbs):
    """Bald cypress: a bell-flared, fluted foot, a straight tapering trunk,
    and a crown of short level limbs each carrying flat, layered, slightly
    drooping feathery sprays -- a narrow column with a flat spreading top
    when old (`flat` 1), a soft open cone when young (`flat` 0)."""
    def build(mesh, rng):
        H, R = height, width * .5
        r0 = H * .016
        steps = 10
        tpts, tr = [], []
        lean = drift(rng, H * .01)
        for i in range(steps + 1):
            t = i / steps
            tpts.append(UP * H * .96 * t + lean * t * t)
            tr.append(r0 * (1 - .7 * t) * (1 + 3.2 * math.exp(-t * 14)))
        mesh.add_tube(tpts, tr, 11, 'bark', rng=rng, wobble=.08, shade=lambda co, t: .78 + .3 * min(1, t * 1.6),
                      flex=lambda co, t: .15 * t * t)
        fluted_foot(mesh, rng, r0, H, 8, 4.0, .09)
        c = Vector((0, 0, H * .72))
        shade = ct.crown_shade(c, (R, R, H * .3), low=.5, high=1.2)
        base = .42 if flat else .3
        a0 = rng.uniform(0, math.tau)
        for i in range(limbs):
            t = i / (limbs - 1)
            j, p = at(tpts, base + (.9 - base) * t)
            if flat:
                w = R * (.6 + .4 * t) * rng.uniform(.8, 1.05)
            else:
                w = R * (1.15 - .85 * t) * rng.uniform(.9, 1.05) + H * .01
            a = a0 + i * 2.4
            d = heading(a)
            end = p + d * w + UP * w * .08
            lr = random.Random(rng.random())
            if not ct.FAR:
                ct.limb(mesh, lr, p, end, tr[j] * .35, H * .003, sides=4, bow=.08)
            sr = random.Random(rng.random())
            spots = (.95, .6, .3) if w > R * .55 else (.9, .45)
            for f in spots:
                q = p.lerp(end, f) + UP * w * .04
                L = w * (.5 if f > .9 else .4)
                spray(mesh, sr, q, (L, L * .7, L * .26), a + sr.uniform(-.4, .4), sr.uniform(.12, .25), c, shade)
        # The top: a flat spreading cap on the old tree, a small tip on the young.
        if flat:
            for k in range(5):
                a = a0 + k / 5 * math.tau + .3
                q = tpts[-1] + heading(a) * R * .46 + UP * H * .005
                L = R * .48
                spray(mesh, rng, q, (L, L * .62, L * .22), a, .1, c, shade, flex=.9)
        else:
            L = R * .22
            for k in range(2):
                spray(mesh, rng, tpts[-1] + UP * H * .01, (L, L * .5, L * .5), a0 + k * 1.6, 0, c, shade, flex=.9)
    return build


def cypressknees(spread, count):
    """A group of cypress knees: knobbly woody thumbs 0.2-1 m tall rising
    from the mud or water in a loose patch, each swelling to a rounded,
    bulbous top."""
    def build(mesh, rng):
        centres = [drift(rng, spread * .35) for _ in range(3)]
        for k in range(count):
            p = centres[k % 3] + drift(rng, spread * .3)
            h = rng.uniform(.2, 1.0) if k % 3 else rng.uniform(.5, 1.0)
            r = h * rng.uniform(.13, .17) + .035
            lean = drift(rng, h * .12)
            pts = [p - UP * .06, p + UP * h * .3 + lean * .3, p + UP * h * .62 + lean * .65, p + UP * h * .8 + lean * .85]
            mesh.add_tube(pts, [r * 1.8, r * 1.0, r * .95, r * .95], 6, 'bark', rng=rng, wobble=.15,
                          shade=lambda co, t: .72 + .3 * t, cap_end=False)
            for v in lowball(mesh, pts[-1] + lean * .1 + UP * r * .4, (r * 1.1, r * 1.1, r * 1.4), 'bark', rng, 8, 5, .1):
                mesh.paint[v] = (1.05, 1.05, 1.05, 0.0)
    return build


def watertupelo(height, width):
    """Water tupelo: a swollen bottle foot in the water, a tall straight
    stem, and a narrow upright oval crown of ascending limbs and clumps in its
    upper half, a little sky between."""
    def build(mesh, rng):
        H, R = height, width * .5
        r0 = H * .015
        steps = 12
        tpts, tr = [], []
        lean = drift(rng, H * .05)
        for i in range(steps + 1):
            t = i / steps
            tpts.append(UP * H * .9 * t + lean * t * t)
            tr.append(r0 * (1 - .55 * t) + r0 * 3.4 * max(0.0, 1 - t / .22) ** 2)
        mesh.add_tube(tpts, tr, 10, 'bark', rng=rng, wobble=.06, shade=lambda co, t: .8 + .3 * min(1, t * 1.6),
                      flex=lambda co, t: .15 * t * t)
        c = Vector((0, 0, H * .76))
        shade = ct.crown_shade(c, (R, R, H * .26))
        # Round 5: five ascending limbs, each ending in its own lobe of two
        # clumps, with sky between the lobes -- an open, lumpy oval, not a
        # ball on a pole.
        a0 = rng.uniform(0, math.tau)
        for j in range(5):
            f = j / 4
            i, p = at(tpts, .56 + .3 * f)
            a = a0 + j * 2.5 + rng.uniform(-.3, .3)
            d = heading(a)
            L = R * rng.uniform(.95, 1.15) * (1.1 - .4 * f)
            end = p + d * L + UP * L * rng.uniform(.8, 1.1)
            ct.limb(mesh, rng, p, end, tr[i] * .55, tr[i] * .18, sides=5, bow=.1)
            s = R * rng.uniform(.25, .29) * (1.05 - .2 * f)
            clump(mesh, rng, end + UP * s * .2, s, c, shade, tall=1.1, jitter=.16)
            s2 = s * .8
            clump(mesh, rng, end + d * s2 * .7 + UP * s2 * .9 + drift(rng, s2 * .3), s2, c, shade, tall=1.1, jitter=.16)
            side = Vector((-d.y, d.x, 0)) * rng.choice((-1, 1))
            clump(mesh, rng, end + side * s2 * 1.1 + UP * s2 * .4, s2 * .9, c, shade, tall=1.1, jitter=.16)
            if j < 3:
                clump(mesh, rng, p.lerp(end, .45) + UP * s2 * .3, s2 * .8, c, shade, tall=1.05, jitter=.16)
        s = R * .3
        clump(mesh, rng, tpts[-1] + UP * s * .7, s, c, shade, tall=1.2, jitter=.14)
    return build


MODELS = [
    ('Blender_LiveOak_1', liveoak(15, 30, 7, .8, False)),
    ('Blender_LiveOak_2', liveoak(13, 24, 6, .5, False, .07)),
    ('Blender_LiveOakMoss_1', liveoak(16, 30, 7, .35, True, .14)),
    ('Blender_LiveOakMoss_2', liveoak(14, 25, 6, .2, True, .12)),
    ('Blender_TurkeyOak_1', turkeyoak(9, 6)),
    ('Blender_BlackjackOak_1', blackjackoak(8, 7.5)),
    ('Blender_BaldCypress_1', baldcypress(30, 11, 1, 16)),
    ('Blender_BaldCypress_2', baldcypress(24, 8.5, 0, 16)),
    ('Blender_CypressKnees_1', cypressknees(2.4, 12)),
    ('Blender_WaterTupelo_1', watertupelo(24, 11)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'LiveOak': '#4a4038', 'LiveOakMoss': '#4a4038', 'TurkeyOak': '#4e463e', 'BlackjackOak': '#2e2a26',
        'BaldCypress': '#8a6248', 'CypressKnees': '#8a6a52', 'WaterTupelo': '#7a746a'}
# Leaf and accent per season, from each spec's Seasons table. Deciduous trees
# are drawn in leaf (their bare variants come later): a winter that is bare
# keeps the summer leaf, except where the spec says leaves are held.
LOOK = {
    'LiveOak': {'spring': ('#7a9a4a', None), 'summer': ('#3e6034', None), 'autumn': ('#3e6034', None), 'winter': ('#40603a', None)},
    'LiveOakMoss': {'spring': ('#7a9a4a', '#a8ab9c'), 'summer': ('#3e6034', '#9aa092'), 'autumn': ('#3e6034', '#9aa092'), 'winter': ('#40603a', '#9aa092')},
    'TurkeyOak': {'spring': ('#a0b45c', None), 'summer': ('#5c7e3a', None), 'autumn': ('#b8452e', None), 'winter': ('#8a5a3a', None)},
    'BlackjackOak': {'spring': ('#94b058', None), 'summer': ('#466a32', None), 'autumn': ('#8a4a2e', None), 'winter': ('#6e5440', None)},
    'BaldCypress': {'spring': ('#9cc06a', None), 'summer': ('#5e8a42', None), 'autumn': ('#b4592e', None), 'winter': ('#5e8a42', None)},
    'CypressKnees': {s: ('#5e8a42', None) for s in ('spring', 'summer', 'autumn', 'winter')},
    'WaterTupelo': {'spring': ('#9ab55a', None), 'summer': ('#4f7a36', None), 'autumn': ('#a83a32', None), 'winter': ('#4f7a36', None)},
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


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.33, 0.35, 0.30)},
          far={'Blender_LiveOak_1', 'Blender_LiveOak_2', 'Blender_LiveOakMoss_1', 'Blender_LiveOakMoss_2',
               'Blender_BaldCypress_1', 'Blender_BaldCypress_2', 'Blender_WaterTupelo_1'},
          tints=tints(SEASON))
