# THE SOUTH COAST PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): the low, wet coast of the South -- Lowcountry, Bayou,
# Florida Flatwoods and Gulf Coast. Smooth cordgrass at the marsh edge,
# Everglades sawgrass, pink muhly grass, wax myrtle, a duckweed skin on still
# water, a citrus tree, the alligator on the bank, and the white plantation
# clubhouse.
#
#   node tools/blender/iterate.mjs cartoon_southcoast <round> [--season s]
#
# Silhouette first (the owner, 2 November 2026): the cordgrass is a fountain
# of long arching blades; the sawgrass a stiff upright sheaf with brown seed
# heads standing above it; the muhly a fine low mound under a wide pink haze;
# the wax myrtle a ragged multi-stemmed vase; the citrus a dense gumdrop to
# the ground studded with fruit; the alligator long, low and ridged.
#
# REFS spartina=Blender_Spartina_1
# REFS sawgrass=Blender_Sawgrass_1
# REFS muhlygrass=Blender_MuhlyGrass_1
# REFS waxmyrtle=Blender_WaxMyrtle_1
# REFS duckweed=Blender_Duckweed_1
# REFS citrustree=Blender_CitrusTree_1
# REFS alligator=Blender_Alligator_1
# REFS plantationclubhouse=Blender_PlantationClubhouse_1
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


def two_sided(mesh, pts, role, shade=1.0, flex=0.0, normal=UP):
    """A flat polygon drawn from both sides (a blade, a petal)."""
    for poly in (pts, list(reversed(pts))):
        f = mesh.face(poly, role, smooth=True)
        for v in f.verts:
            s = shade(v.co) if callable(shade) else shade
            fl = flex(v.co) if callable(flex) else flex
            s = s if isinstance(s, tuple) else (s, s, s)
            mesh.paint[v] = (*s, fl)
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


def box(mesh, lo, hi, role, shade=1.0, top=True, sides=(1, 1, 1, 1)):
    """An axis box without a bottom; `sides` (-Y, +X, +Y, -X) which walls."""
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    c = [V((x0, y0, 0)), V((x1, y0, 0)), V((x1, y1, 0)), V((x0, y1, 0))]
    outs = [V((0, -1, 0)), V((1, 0, 0)), V((0, 1, 0)), V((-1, 0, 0))]
    for i in range(4):
        if not sides[i]:
            continue
        j = (i + 1) % 4
        facing(mesh, [c[i] + V((0, 0, z0)), c[j] + V((0, 0, z0)), c[j] + V((0, 0, z1)), c[i] + V((0, 0, z1))], role,
               outs[i], shade=shade)
    if top:
        facing(mesh, [p + V((0, 0, z1)) for p in c], role, UP, shade=shade)


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15, shade=1.0, flex=0.0):
    """A cheap jittered u-by-v sphere (64 triangles at 8 x 5)."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
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
        nn = Vector((n.x / radii[0] ** 2, n.y / radii[1] ** 2, n.z / radii[2] ** 2)).normalized()
        mesh.normal[x] = nn
        m = shade(x.co, nn) if callable(shade) else shade
        m = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (*m, flex(x.co) if callable(flex) else flex)
    return out


def blade(mesh, root, out, h, lean, width, droop, role='leaf', segs=3, dark=.55, light=1.15, tip_role=None):
    """One grass blade from `root`: rising `h`, leaning out along `out` by
    `lean` x h at the tip, its tip falling by `droop` (0 stiff, 1 a full
    arch); two-sided, dark at the root, light at the tip."""
    side = Vector((-out.y, out.x, 0))
    pts = []
    for s in range(segs + 1):
        t = s / segs
        p = root + out * (lean * h * t ** 1.5) + UP * h * (t - droop * t ** 2.4)
        pts.append((p, width * (1 - t) ** .8, t))
    for (pa, wa, ta), (pb, wb, tb) in zip(pts, pts[1:]):
        r = tip_role if (tip_role and ta >= .6) else role
        quad = [pa - side * wa, pa + side * wa, pb + side * wb, pb - side * wb] if tb < 1 - 1e-6 else \
            [pa - side * wa, pa + side * wa, pb]
        two_sided(mesh, quad, r, shade=lambda co, z0=root.z: dark + (light - dark) * max(0, min(1, (co.z - z0) / h)),
                  flex=lambda co, z0=root.z: max(0, min(1, (co.z - z0) / h)))
    return pts[-1][0]


# ---------------------------------------------------------------- grasses

def spartina(height, spread, clumps, blades):
    """Smooth cordgrass: a dense stand of tall blades rising from the mud,
    arching out and over at the tips -- a fountain, widest at the top, with a
    few slender seed spikes standing above in late summer."""
    def build(mesh, rng):
        H, W = height, spread
        # Round 2: one dense stand, blades spread evenly over a disc, the
        # outer ones shorter and leaning out more -- a full, even sheaf.
        for i in range(blades):
            f = math.sqrt((i + .5) / blades)
            a = i * 2.39996 + rng.uniform(-.3, .3)
            d = heading(a)
            r0 = d * f * W * .38
            h = H * (1.0 - .3 * f * f) * rng.uniform(.8, 1.0)
            blade(mesh, r0, heading(a + rng.uniform(-.5, .5)), h, .08 + .3 * f + rng.uniform(0, .12),
                  rng.uniform(.022, .03), rng.uniform(.15, .38))
        for k in range(clumps):
            a = rng.uniform(0, math.tau)
            r0 = heading(a) * rng.uniform(0, W * .15)
            top = r0 + heading(a) * H * .12 + UP * H * rng.uniform(.95, 1.06)
            mid = r0.lerp(top, .55)
            mesh.add_tube([r0, mid, top], [.008, .006, .004], 4, 'leaf', flex=lambda co, t: .3 + .7 * t,
                          shade=lambda co, t: .7 + .4 * t, cap_end=False)
            for j in range(4):
                q = mid.lerp(top, .25 + .25 * j) + drift(rng, .02)
                lowball(mesh, q, (.018, .018, .07), 'accent', rng, 5, 3, .1, shade=1.0, flex=.9)
    return build


def sawgrass(height, spread, blades, heads):
    """Sawgrass: a stiff, upright sheaf of long keeled blades, barely bending,
    with taller stalks carrying loose brown branched seed heads above it."""
    def build(mesh, rng):
        H, W = height, spread
        # Round 2: a dense wall of stiff blades over a wide base, a few
        # bent over (the dead ones in the pictures).
        for i in range(blades):
            f = math.sqrt((i + .5) / blades)
            a = i * 2.39996 + rng.uniform(-.3, .3)
            r0 = heading(a) * f * W * .4
            h = H * (1 - .25 * f) * rng.uniform(.7, 1.0)
            bent = i % 9 == 4
            blade(mesh, r0, heading(a + rng.uniform(-.4, .4)), h, (.5 if bent else .06 + .2 * f) + rng.uniform(0, .1),
                  rng.uniform(.04, .055), .7 if bent else rng.uniform(.0, .08), dark=.6)
        # Seed heads: a stiff stalk carrying loose, branched rusty clusters
        # on short side branches down its top third.
        for k in range(heads):
            a = k / heads * math.tau + rng.uniform(-.4, .4)
            r0 = heading(a) * rng.uniform(0, W * .2)
            top = r0 + heading(a) * H * .08 + UP * H * rng.uniform(1.08, 1.2)
            mesh.add_tube([r0, r0.lerp(top, .5), top], [.014, .011, .006], 4, 'leaf', flex=lambda co, t: .3 + .6 * t,
                          shade=lambda co, t: .75 + .3 * t, cap_end=False)
            for j in range(5):
                q = r0.lerp(top, .66 + .08 * j)
                br = q + heading(a + j * 2.4) * (.16 - .02 * j) + UP * .04
                mesh.add_tube([q, br], [.008, .005], 3, 'accent', cap_end=False, flex=lambda co, t: .9)
                for m in range(2):
                    lowball(mesh, br + drift(rng, .04) + UP * (.03 * m), (.035, .035, .04), 'accent', rng, 5, 3, .3,
                            shade=1.0, flex=.9)
    return build


def muhlygrass(height, spread, blades, plumes):
    """Pink muhly: a fine low mound of hair-thin blades under a broad,
    airy cloud of flower plumes, wider than tall -- pink haze in autumn."""
    def build(mesh, rng):
        H, W = height, spread
        # Round 2: a fountain of fine blades from a narrow base, arching out
        # to the plumes' rim; the plumes smooth soft lobes on a wide dome
        # that starts at half height, so the green shows beneath.
        # Round 3: a wide dense mound of blades; the plumes separate smaller
        # lobes on a dome shell from a third of the height up, wrapping the
        # mound, sky and blades showing between them.
        for i in range(blades):
            f = math.sqrt((i + .5) / blades)
            a = i * 2.39996 + rng.uniform(-.4, .4)
            d = heading(a)
            r0 = d * f * W * .16
            blade(mesh, r0, heading(a + rng.uniform(-.4, .4)), H * rng.uniform(.5, .64), .45 + .5 * f, .014,
                  rng.uniform(.2, .4))
        # Round 4: a wide low dome -- many small flat lobes (cheap 10 x 6
        # balls, fuzzy with jitter) on a shell wider than tall, and feathery
        # wisps fanning out through it to give the haze a ragged edge.
        # Round 6: the lobes overlap into one haze, the shell coming down to
        # a tenth of the height at its rim, so it reads as a soft dome over
        # the grass and not a bouquet of puffs.
        # Round 10 (from pictures 02-03): a green fountain of blades to half
        # height, narrow at the foot and flaring out, and the haze a wide
        # soft cap ON it -- a filled core with lobes for its bumpy skin, its
        # underside squashed flat, wider than the fountain; fine wisps
        # standing up out of its top for the fuzzy edge.
        c = V((0, 0, H * .6))
        shade = ct.crown_shade(c, (W * .5, W * .5, H * .3), low=.75, high=1.15)
        lowball(mesh, c, (W * .4, W * .4, H * .28), 'accent', rng, 12, 7, .08,
                shade=lambda co, n: shade(co, n) * .95, flex=.9)
        for k in range(plumes):
            y = .97 - (k + .5) / plumes * 1.25
            r = math.sqrt(max(0, 1 - y * y))
            a = k * 2.39996 + rng.uniform(-.3, .3)
            q = c + V((math.cos(a) * r * W * .38, math.sin(a) * r * W * .38, y * H * .24))
            s = W * rng.uniform(.1, .13)
            lowball(mesh, q, (s, s, s * .7), 'accent', rng, 10, 6, .3, shade=lambda co, n: shade(co, n), flex=.95)
        for k in range(28):
            a = k * 2.39996 + rng.uniform(-.2, .2)
            f = math.sqrt((k + .5) / 28)
            root = heading(a) * W * .3 * f + UP * H * (.72 - .15 * f)
            blade(mesh, root, heading(a), H * rng.uniform(.22, .34), .3 + .4 * f, .03, .15,
                  role='accent', dark=.95, light=1.15)
    return build


# ---------------------------------------------------------------- woody

def clump(mesh, rng, q, s, c, shade, squash=.8, jitter=.14, flex=.8, bottom=.3, role='leaf'):
    mesh.add_lump(q, (s, s, s * squash), role, rng, subdiv=3, jitter=jitter, crown=c, blend=.85, shade=shade, flex=flex,
                  squash_bottom=bottom)


def waxmyrtle(height, spread, stems):
    """Wax myrtle: several leaning grey stems from one base, fanning out to an
    irregular, ragged, rounded crown of many small clumps -- a loose vase,
    bare stems showing below, the top uneven."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = V((0, 0, H * .62))
        shade = ct.crown_shade(c, (R, R, H * .38), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        # Round 2: the stems only glimpsed at the foot; the foliage an
        # upright vase leafy from 0.5 m, many small clumps up each stem,
        # widest at two-thirds height, the top ragged with tufts poking up.
        # Round 3: stems short, fanning out under the foliage; the crown a
        # dense upright oval of many small ragged clumps on an egg-shaped
        # shell from 0.1 of the height (no bare lower third), widest above
        # the middle; tufts poke out of the top.
        for i in range(stems):
            a = a0 + i / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            base = d * rng.uniform(.05, .2)
            end = d * R * rng.uniform(.35, .5) + UP * H * rng.uniform(.4, .55)
            ct.limb(mesh, rng, base, end, H * .02, H * .01, sides=5, bow=.1, shade=.9)
        # Round 5: a vase, not a ball -- the shell narrow at the foot (stems
        # showing under it) and widest near the top; the crest a row of
        # small upright tufts, the twig tips of the pictures.
        n = 16
        for i in range(n):
            y = .8 - (i + .5) / n * 1.55
            r = math.sqrt(max(0, 1 - y * y)) * (.78 + .4 * (y + 1) / 2)
            a = a0 + i * 2.39996 + rng.uniform(-.25, .25)
            q = V((math.cos(a) * r * R * .76, math.sin(a) * r * R * .76, H * (.56 + .4 * y)))
            clump(mesh, rng, q, R * rng.uniform(.26, .31), c, shade, squash=.85, jitter=.24)
        # Round 4: a cheap core so no hole shows through the middle.
        for z, s in ((.36, .36), (.6, .52), (.8, .44)):
            lowball(mesh, UP * H * z, (R * s, R * s, H * s * .45), 'leaf', rng, 8, 5, .1,
                    shade=lambda co, n: shade(co, n) * .8, flex=.4)
        for k in range(5):
            a = a0 + k / 5 * math.tau + 1.1
            q = heading(a) * R * rng.uniform(.25, .7) + UP * H * (.93 - .1 * (k % 3) * .5)
            clump(mesh, rng, q, R * .13, c, shade, squash=1.6, jitter=.22)
        # Round 6: grey-blue berry clusters on the skin (the accent; painted
        # leaf green in spring and summer, when they are unripe).
        for k in range(8):
            y = rng.uniform(-.35, .6)
            r = math.sqrt(max(0, 1 - y * y)) * (.78 + .4 * (y + 1) / 2)
            a = a0 + k * 2.39996 + .7
            q = heading(a) * (r * R * .76 + R * .2) + UP * H * (.56 + .4 * y)
            for m in range(2):
                mesh.add_lump(q + drift(rng, .07) + UP * rng.uniform(-.05, .05), (.06, .06, .06), 'accent', rng,
                              subdiv=0, jitter=.05, shade=lambda w, n: 1.0 + .2 * n.z, flex=.6)
    return build


def citrustree(height, spread, fruit):
    """Citrus: a short trunk hidden under a dense, glossy, round crown that
    comes down nearly to the ground -- a gumdrop, smooth-edged, dark green,
    dotted with fruit on its skin."""
    def build(mesh, rng):
        H, R = height, spread * .5
        # Round 2: a short trunk showing under the skirt; the lobes spread on
        # a dome shell by the golden angle (no rings, no bands), the shell
        # widest low down so the outline is a gumdrop; fruit on the skin.
        ct.trunk(mesh, rng, V((0, 0, 0)), H * .3, H * .032, steps=3, sides=7, flare=1.4)
        c = V((0, 0, H * .52))
        cr = (R * .8, R * .8, H * .36)
        shade = ct.crown_shade(c, (R, R, H * .5), low=.45, high=1.3)
        n = 26
        skin = []
        for i in range(n):
            y = .96 - (i + .5) / n * 1.62
            r = math.sqrt(max(0, 1 - y * y))
            a = i * 2.39996 + rng.uniform(-.2, .2)
            d = V((math.cos(a) * r, math.sin(a) * r, y))
            q = c + V((d.x * cr[0], d.y * cr[1], d.z * cr[2]))
            s = R * rng.uniform(.3, .36)
            clump(mesh, rng, q, s, c, shade, squash=.82, jitter=.08, bottom=.45 if y < -.3 else .15)
            skin.append((q, s, d))
        for k in range(fruit):
            q, s, d = skin[k * 7 % len(skin)]
            dd = (d + drift(rng, .5) + UP * rng.uniform(-.3, .3)).normalized()
            p = q + dd * s * .8
            if (p - c).length < R * .75:
                p = c + (p - c).normalized() * R * .8
            mesh.add_lump(p, (.17, .17, .17), 'accent', rng, subdiv=0, jitter=.05, shade=lambda w, n: 1.0 + .25 * n.z)
    return build


def duckweed(width, pads, lilies):
    """A duckweed skin on still water: a flat ragged-edged patch of bright
    green, a few loose islands round it, and lily pads with white flowers."""
    def build(mesh, rng):
        R = width * .5

        def patch(c, r, n, z):
            ctr = mesh.bm.verts.new(c + UP * z)
            inner, outer = [], []
            for k in range(n):
                a = k / n * math.tau
                rr = r * (1 + .25 * math.sin(a * 3 + c.x) + rng.uniform(-.15, .15))
                inner.append(mesh.bm.verts.new(c + heading(a) * rr * .55 + UP * z))
                outer.append(mesh.bm.verts.new(c + heading(a) * rr + UP * z))
            idx = mesh.slot('leaf')
            for k in range(n):
                k1 = (k + 1) % n
                for f in (mesh.bm.faces.new((ctr, inner[k], inner[k1])),
                          mesh.bm.faces.new((inner[k], outer[k], outer[k1], inner[k1]))):
                    f.material_index = idx
            mesh.paint[ctr] = (1.05, 1.05, 1.05, .2)
            for v in inner:
                mesh.paint[v] = (1.0, 1.0, 1.0, .2)
            for v in outer:
                mesh.paint[v] = (.85, .85, .85, .2)
            for v in [ctr] + inner + outer:
                mesh.normal[v] = UP

        patch(V((0, 0, 0)), R * .8, 18, .02)
        for k in range(5):
            a = rng.uniform(0, math.tau)
            patch(heading(a) * R * rng.uniform(.85, 1.0), R * rng.uniform(.1, .2), 8, .02)
        for k in range(pads):
            c = heading(rng.uniform(0, math.tau)) * R * rng.uniform(.1, .8) + UP * .04
            r = rng.uniform(.35, .55)
            notch = rng.uniform(0, math.tau)
            pts = [c] + [c + heading(notch + .25 + j / 9 * (math.tau - .5)) * r for j in range(10)]
            idx = mesh.slot('leaf')
            vs = [mesh.bm.verts.new(p) for p in pts]
            for j in range(1, 10):
                f = mesh.bm.faces.new((vs[0], vs[j], vs[j + 1]))
                f.material_index = idx
            for v in vs:
                mesh.paint[v] = (.55, .68, .6, .1)
                mesh.normal[v] = UP
        for k in range(lilies):
            c = heading(rng.uniform(0, math.tau)) * R * rng.uniform(.2, .7) + UP * .05
            for j in range(6):
                a = j / 6 * math.tau
                d = heading(a)
                s = V((-d.y, d.x, 0))
                two_sided(mesh, [c + s * .04, c + d * .12 + UP * .06 + s * .03, c + d * .14 + UP * .08,
                                 c + d * .12 + UP * .06 - s * .03, c - s * .04], 'accent', shade=1.1)
            mesh.add_lump(c + UP * .05, (.03, .03, .025), 'stone', rng, subdiv=0, shade=lambda w, n: 1.0)
    return build


# ---------------------------------------------------------------- wildlife

def alligator(length):
    """An American alligator basking: a long low body flat on the ground,
    a broad rounded snout, splayed bent legs, a heavy tail tapering to a
    point, two rows of armoured ridges down the back and a crest on the tail.
    Head toward +X; belly at z 0; sink it about 0.25 m for one floating."""
    def build(mesh, rng):
        L = length
        # Along X: tail tip at -L/2, snout at +L/2. (x, half-width, half-height, centre z)
        # Round 3: flat and wide in the body (half-height a third of the
        # half-width), the tail taller than wide, the head a flat wedge.
        prof = [(-.5, .006, .012, .04), (-.36, .025, .035, .1), (-.2, .05, .05, .15), (-.06, .095, .06, .19),
                (.04, .105, .062, .2), (.16, .09, .055, .18), (.23, .055, .045, .15), (.3, .065, .042, .14),
                (.4, .05, .03, .1), (.5, .035, .018, .06)]
        prof = [(x, w / 1.25, h / 1.3, h * L * .95 / (L * .3)) for x, w, h, zc in prof]
        # Round 12: the tail swings to one side, as a basking gator lies.
        swing = lambda x: L * .14 * max(0.0, (-.12 - x) / .38) ** 2
        pts = [V((x * L, swing(x), zc * L * .3 + .02)) for x, w, h, zc in prof]
        rings = mesh.add_tube(pts, [1.0] * len(pts), 8, 'bark', shade=lambda co, t: 1.0, cap_end=True)
        for (x, w, h, zc), ring, p in zip(prof, rings, pts):
            for v in ring:
                d = v.co - p
                v.co = p + V((0, d.y * w * L * 1.25, d.z * h * L * 1.3))
                lo = d.z < 0
                if lo:
                    v.co.z = max(0.0, v.co.z)
                mesh.paint[v] = ((1.7, 1.75, 1.45, 0) if lo else (1.0, 1.0, 1.0, 0))
        # Legs: splayed, the elbow up and out, a flat foot.
        for x, sgn in ((.18, 1), (.18, -1), (-.08, 1), (-.08, -1)):
            hip = V((x * L, sgn * .09 * L, .1 * L * .3 + .05))
            elbow = hip + V((.04 * L, sgn * .07 * L, .06))
            foot = elbow + V((.05 * L, sgn * .04 * L, -elbow.z + .03))
            mesh.add_tube([hip, elbow, foot], [.1 * L / 3, .075 * L / 3, .06 * L / 3], 5, 'bark',
                          shade=lambda co, t: .85, cap_end=True)
            mesh.add_lump(foot + V((.04, sgn * .02, -.01)), (.09, .07, .025), 'bark', rng, subdiv=0, shade=lambda w, n: .8)
        # Back ridges: two rows of scutes and the tail crest.
        for k in range(12):
            t = k / 11
            x = (.2 - .62 * t)
            # find body top here
            for j, (a, b) in enumerate(zip(prof, prof[1:])):
                if a[0] <= x <= b[0]:
                    f = (x - a[0]) / (b[0] - a[0])
                    w = a[1] + (b[1] - a[1]) * f
                    h = a[2] + (b[2] - a[2]) * f
                    zc = a[3] + (b[3] - a[3]) * f
                    break
            top = zc * L * .3 + .02 + h * L * 1.2
            rows = (-.4, .4) if x > -.18 else (0,)
            for o in rows:
                q = V((x * L, o * w * L + swing(x), top))
                s = .06 if len(rows) == 2 else .08 * (1 - .5 * t)
                for poly in ([q + V((-s, -s * .5, 0)), q + V((s, -s * .5, 0)), q + V((0, 0, s * 1.1))],
                             [q + V((-s, s * .5, 0)), q + V((s, s * .5, 0)), q + V((0, 0, s * 1.1))]):
                    two_sided(mesh, poly, 'bark', shade=.75)
        # Eyes on top of the head, nostrils on the snout tip.
        hx = .31 * L
        for sgn in (1, -1):
            mesh.add_lump(V((hx, sgn * .04 * L, .26)), (.06, .05, .05), 'bark', rng, subdiv=1,
                          shade=lambda w, n: .9)
            mesh.add_lump(V((hx + .03, sgn * .047 * L, .29)), (.025, .025, .02), 'accent', rng,
                          subdiv=0, shade=lambda w, n: 1.0)
        mesh.add_lump(V((.49 * L, 0, .12)), (.05, .06, .03), 'bark', rng, subdiv=0,
                      shade=lambda w, n: .8)
        # Teeth: a pale zigzag along the jaw line.
        for sgn in (1, -1):
            for k in range(6):
                x = (.33 + .025 * k) * L
                y = sgn * (.066 - .004 * k) * L
                z = .07
                two_sided(mesh, [V((x - .02, y, z + .02)), V((x + .02, y, z + .02)), V((x, y, z - .02))], 'stone',
                          shade=1.0, normal=V((0, sgn, 0)))
    return build


# ---------------------------------------------------------------- clubhouse

def plantationclubhouse():
    """A white two-storey plantation house: a 32 x 14 m body on a brick
    base, a two-storey columned gallery across the front and down both ends,
    a big hipped roof over all of it with three dormers in front and two
    brick chimneys, dark green shutters, brick front steps. Walls and trim
    stone (white), roof bark (grey), shutters leaf (dark green), brick
    accent. Its front faces -Y."""
    def build(mesh, rng):
        bx, by = 16.0, 7.0           # body half-extents
        px, py0 = 19.0, -10.0        # gallery outer edge (x), front edge (y)
        f0, f1, f2, eave = .7, 4.7, 8.7, 9.3
        # Brick base under body and gallery.
        box(mesh, (-px, py0, 0), (px, by, f0), 'accent', shade=.75)
        # Body walls (round 3): the walls inside the gallery in porch shadow,
        # so the white columns stand out against them; the back in the sun.
        box(mesh, (-bx, -by, f0), (bx, by, eave), 'stone', top=False, shade=.35, sides=(1, 1, 0, 1))
        box(mesh, (-bx, -by, f0), (bx, by, eave), 'stone', top=False, shade=1.0, sides=(0, 0, 1, 0))
        # Gallery floor (upper) as a thin white slab, and its railing.
        def slab(z, th):
            for (x0, y0, x1, y1) in ((-px, py0, px, -by), (-px, -by, -bx, by), (bx, -by, px, by)):
                box(mesh, (x0, y0, z), (x1, y1, z + th), 'stone', shade=.92)
        slab(f1, .3)
        slab(f2, .6)       # the entablature under the eave
        # Columns: ground and upper storey, front and both ends.
        cols = []
        n = 12
        for i in range(n):
            cols.append(V((-px + .4 + (2 * px - .8) * i / (n - 1), py0 + .4, 0)))
        for sx in (-1, 1):
            for j in range(1, 5):
                cols.append(V((sx * (px - .4), py0 + .4 + (by - py0 - .8) * j / 4, 0)))
        for c in cols:
            for z0, z1 in ((f0, f1), (f1 + .3, f2)):
                mesh.add_tube([c + V((0, 0, z0)), c + V((0, 0, z1))], [.32, .28], 6, 'stone',
                              shade=lambda co, t: 1.05, cap_end=False)
        # Upper railing: a top rail and a bottom rail along the gallery edge, with a few balusters.
        rail = [V((-px + .4, by - .2, 0)), V((-px + .4, py0 + .4, 0)), V((px - .4, py0 + .4, 0)), V((px - .4, by - .2, 0))]
        # Round 5: the railings are solid white balustrade panels (a white
        # band over the dark porch, as the pictures read from afar) under a
        # fat top rail, upstairs all round, downstairs with a gap at the steps.
        outs = [V((-1, 0, 0)), V((0, -1, 0)), V((1, 0, 0))]
        for z0, z1 in ((f1 + .3, f1 + 1.15), (f0, f0 + .95)):
            mesh.add_tube([r + V((0, 0, z1)) for r in rail], [.1] * 4, 4, 'stone', shade=lambda co, t: 1.08, cap_end=False)
            for (a, b), out in zip(zip(rail, rail[1:]), outs):
                spans = [(a, b)]
                if z0 < f1 and out.y < 0:
                    spans = [(a, V((-2.8, a.y, 0))), (V((2.8, a.y, 0)), b)]
                for p, q in spans:
                    facing(mesh, [p + V((0, 0, z0)), q + V((0, 0, z0)), q + V((0, 0, z1)), p + V((0, 0, z1))], 'stone',
                           out, shade=.95)
                    facing(mesh, [p + V((0, 0, z0)), q + V((0, 0, z0)), q + V((0, 0, z1)), p + V((0, 0, z1))], 'stone',
                           -out, shade=.6)
        # Windows with shutters: front wall and ends, both floors.
        def window(p, out, side, w, h):
            o = out * .04
            facing(mesh, [p - side * w + o, p + side * w + o, p + side * w + UP * h + o, p - side * w + UP * h + o],
                   'bark', out, shade=.35)
            for s in (-1, 1):
                q = p + side * s * (w + w * .55)
                o2 = out * .06
                facing(mesh, [q - side * w * .5 + o2, q + side * w * .5 + o2, q + side * w * .5 + UP * h + o2,
                              q - side * w * .5 + UP * h + o2], 'leaf', out, shade=1.0)
        for floor in (f0 + .9, f1 + .8):
            for i in range(7):
                x = -bx + 2.3 + (2 * bx - 4.6) * i / 6
                if i == 3 and floor < f1:
                    continue
                window(V((x, -by, floor)), V((0, -1, 0)), V((1, 0, 0)), .55, 2.4)
                window(V((x, by, floor)), V((0, 1, 0)), V((1, 0, 0)), .55, 2.4)
            for sx in (-1, 1):
                for yy in (-3.5, 3.5):
                    window(V((sx * bx, yy, floor)), V((sx, 0, 0)), V((0, 1, 0)), .55, 2.4)
        # Front door with a fanlight.
        d0 = V((0, -by - .04, f0))
        facing(mesh, [d0 + V((-1.0, 0, 0)), d0 + V((1.0, 0, 0)), d0 + V((1.0, 0, 3.0)), d0 + V((-1.0, 0, 3.0))], 'bark',
               V((0, -1, 0)), shade=.55)
        fan = [d0 + V((math.cos(t) * 1.0, 0, 3.0 + math.sin(t) * .7)) for t in [k / 6 * math.pi for k in range(7)]]
        facing(mesh, fan, 'bark', V((0, -1, 0)), shade=.4)
        # Brick steps up to the gallery, centre front.
        for k in range(4):
            box(mesh, (-2.6 - .1 * k, py0 - 2.0 + .5 * k, 0), (2.6 + .1 * k, py0, f0 * (k + 1) / 4), 'accent', shade=.9)
        # The hipped roof over body and gallery.
        rx, ry0, ry1 = px + .6, py0 - .6, by + .6
        half = (ry1 - ry0) / 2
        ym = (ry0 + ry1) / 2
        rise = half * .45
        ridge = eave + .6 + rise
        e = eave + .6
        A, B, C, D = V((-rx, ry0, e)), V((rx, ry0, e)), V((rx, ry1, e)), V((-rx, ry1, e))
        R0, R1 = V((-rx + half, ym, ridge)), V((rx - half, ym, ridge))
        for q, out in (([A, B, R1, R0], V((0, -1, 1.6))), ([C, D, R0, R1], V((0, 1, 1.6))),
                       ([B, C, R1], V((1, 0, 1.6))), ([D, A, R0], V((-1, 0, 1.6)))):
            facing(mesh, q, 'bark', out, shade=1.0)
        facing(mesh, [A, B, C, D], 'bark', V((0, 0, -1)), shade=.5)
        # Dormers on the front slope.
        for x in (-8.0, 0.0, 8.0):
            y = ry0 + half * .45
            z = e + rise * .45
            box(mesh, (x - 1.0, y - .2, z - .9), (x + 1.0, y + 2.0, z + 1.6), 'stone', top=False, shade=1.0)
            facing(mesh, [V((x - .55, y - .25, z - .3)), V((x + .55, y - .25, z - .3)), V((x + .55, y - .25, z + 1.2)),
                          V((x - .55, y - .25, z + 1.2))], 'bark', V((0, -1, 0)), shade=.35)
            pk = V((x, y - .4, z + 2.5))
            for s in (-1, 1):
                facing(mesh, [pk, V((x + s * 1.3, y - .4, z + 1.5)), V((x + s * 1.3, y + 2.4, z + 1.5)), V((x, y + 2.4, z + 2.5))],
                       'bark', V((s, 0, 1)))
            facing(mesh, [V((x - 1.0, y - .2, z + 1.6)), V((x + 1.0, y - .2, z + 1.6)), V((x, y - .2, z + 2.45))], 'stone',
                   V((0, -1, 0)))
        # Chimneys.
        for sx in (-1, 1):
            cx = sx * 9.0
            box(mesh, (cx - .7, ym - .5, e), (cx + .7, ym + .5, ridge + 1.6), 'accent', shade=.95)
            box(mesh, (cx - .85, ym - .65, ridge + 1.6), (cx + .85, ym + .65, ridge + 1.85), 'accent', shade=.8)
        # Round 2: a white cupola on the ridge's middle, its little hipped
        # cap grey, dark windows on each face.
        cz = ridge - .3
        box(mesh, (-1.6, ym - 1.6, cz), (1.6, ym + 1.6, cz + 2.0), 'stone', top=False, shade=1.02)
        for out, side in ((V((0, -1, 0)), V((1, 0, 0))), (V((0, 1, 0)), V((1, 0, 0))), (V((1, 0, 0)), V((0, 1, 0))),
                          (V((-1, 0, 0)), V((0, 1, 0)))):
            p = V((0, ym, cz + .7)) + out * 1.64
            facing(mesh, [p - side * .9, p + side * .9, p + side * .9 + UP * 1.0, p - side * .9 + UP * 1.0], 'bark', out,
                       shade=.35)
        top = V((0, ym, cz + 3.4))
        k = [V((-2.0, ym - 2.0, cz + 2.0)), V((2.0, ym - 2.0, cz + 2.0)), V((2.0, ym + 2.0, cz + 2.0)),
             V((-2.0, ym + 2.0, cz + 2.0))]
        for i in range(4):
            a, b = k[i], k[(i + 1) % 4]
            facing(mesh, [a, b, top], 'bark', (a + b) * .5 - V((0, ym, cz)) + UP * 3, shade=1.0)
    return build


MODELS = [
    ('Blender_Spartina_1', spartina(1.5, 1.4, 3, 100)),
    ('Blender_Sawgrass_1', sawgrass(2.2, 1.4, 70, 4)),
    ('Blender_MuhlyGrass_1', muhlygrass(.9, 1.1, 80, 22)),
    ('Blender_WaxMyrtle_1', waxmyrtle(4.0, 4.4, 5)),
    ('Blender_Duckweed_1', duckweed(4.0, 7, 3)),
    ('Blender_CitrusTree_1', citrustree(5.0, 4.8, 40)),
    ('Blender_Alligator_1', alligator(3.2)),
    ('Blender_PlantationClubhouse_1', plantationclubhouse()),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Each model's role colours by season, from the study's models/<id>.md
# *Seasons*. The grasses' seed heads and the muhly's plumes are the accent.
BARK = {'WaxMyrtle': '#8a8a80', 'CitrusTree': '#6a6a5a'}
_ALL = ('spring', 'summer', 'autumn', 'winter')
LOOK = {
    'Spartina': {'spring': {'leaf': '#7aa04a', 'accent': '#7aa04a'}, 'summer': {'leaf': '#5a8a3e', 'accent': '#a89a5a'},
                 'autumn': {'leaf': '#c0a050', 'accent': '#a08040'}, 'winter': {'leaf': '#a8905a', 'accent': '#8a7448'}},
    'Sawgrass': {'spring': {'leaf': '#7a8a52', 'accent': '#7a6a42'}, 'summer': {'leaf': '#6e7e4c', 'accent': '#8a4a2a'},
                 'autumn': {'leaf': '#8a7a4a', 'accent': '#5a4028'}, 'winter': {'leaf': '#8a7a52', 'accent': '#5e4a32'}},
    'MuhlyGrass': {'spring': {'leaf': '#6a8a4a', 'accent': '#9aa86a'}, 'summer': {'leaf': '#6a8a4a', 'accent': '#a4ad74'},
                   'autumn': {'leaf': '#7a8a52', 'accent': '#d28ab8'}, 'winter': {'leaf': '#b0a080', 'accent': '#c0b090'}},
    'WaxMyrtle': {'spring': {'leaf': '#5a7a3e', 'accent': '#5a7a3e'}, 'summer': {'leaf': '#56763c', 'accent': '#56763c'},
                  'autumn': {'leaf': '#56763c', 'accent': '#9aa6b0'}, 'winter': {'leaf': '#52723a', 'accent': '#9aa6b0'}},
    'Duckweed': {'spring': {'leaf': '#8ab04a', 'accent': '#8ab04a', 'stone': '#8ab04a'},
                 'summer': {'leaf': '#7aa83a', 'accent': '#f4f2ea', 'stone': '#e8c040'},
                 'autumn': {'leaf': '#8a9a4a', 'accent': '#8a9a4a', 'stone': '#8a9a4a'},
                 'winter': {'leaf': '#4a5a48', 'accent': '#4a5a48', 'stone': '#4a5a48'}},
    'CitrusTree': {'spring': {'leaf': '#3f6a32', 'accent': '#f4f0e0'}, 'summer': {'leaf': '#3a6430', 'accent': '#e8962a'},
                   'autumn': {'leaf': '#3a6430', 'accent': '#d8a030'}, 'winter': {'leaf': '#3a6430', 'accent': '#f08a1a'}},
    'Alligator': {s: {'bark': '#3a4a32', 'accent': '#c8b040', 'stone': '#e8e2c8'} for s in _ALL},
    'PlantationClubhouse': {s: {'stone': '#f2efe6', 'leaf': '#2a3a2a', 'accent': '#7a3a2a', 'bark': '#5a5e62'} for s in _ALL},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        t = {role: hexrgb(h) for role, h in LOOK[sp][season].items()}
        if sp in BARK:
            t['bark'] = hexrgb(BARK[sp])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.8, 0.5, 0.2),
                           'stone': (0.9, 0.88, 0.82)},
          tints=tints(SEASON))
