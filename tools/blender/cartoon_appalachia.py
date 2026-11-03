# THE APPALACHIA PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what the Blue Ridge, the Ozarks and the Bluegrass lacked
# -- the rosebay rhododendron thicket, mountain laurel, flame azalea, chestnut
# oak, shortleaf pine, sassafras, a fieldstone-chimney log cabin, a Kentucky
# four-board horse fence and a tall black tobacco barn.
#
#   node tools/blender/iterate.mjs cartoon_appalachia <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid, and none may read as the game's tulip poplar, sycamore, dogwood,
# redbud, sweetgum, shagbark, white pine or its other oaks. The rhododendron
# is a wide low mound of crooked stems ending in starbursts of long drooping
# leaves; the mountain laurel a smaller gnarled shrub of fine rounded tufts;
# the flame azalea an open upright vase of thin stems with flat leaf tufts in
# tiers and sky between; the chestnut oak a tall ridged dark trunk forking
# into a few ascending leaders under separate irregular masses, a dead snag
# out of the top; the shortleaf pine a long clear straight trunk under a small
# narrow crown of short whorled branches ending in needle tufts; the sassafras
# a narrow tree of flat horizontal shelves, sky between the tiers.
#
# REFS rhododendron=Blender_Rhododendron_1
# REFS mountainlaurelshrub=Blender_MountainLaurelShrub_1
# REFS flameazalea=Blender_FlameAzalea_1
# REFS chestnutoak=Blender_ChestnutOak_1,Blender_ChestnutOak_2
# REFS shortleafpine=Blender_ShortleafPine_1,Blender_ShortleafPine_2
# REFS sassafras=Blender_Sassafras_1
# REFS stonecabin=Blender_StoneCabin_1
# REFS horsefence=Blender_HorseFence_1
# REFS tobaccobarn=Blender_TobaccoBarn_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
V = Vector
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


def sc(m, k):
    return tuple(x * k for x in m) if isinstance(m, tuple) else m * k


def clump(mesh, rng, q, s, c, shade, squash=.75, jitter=.12, flex=.8, tall=None, bottom=.3, role='leaf'):
    sz = s * squash if tall is None else s * tall
    mesh.add_lump(q, (s, s, sz), role, rng, subdiv=3, jitter=jitter, crown=c, blend=.85, shade=shade, flex=flex,
                  squash_bottom=bottom)


def twig(mesh, rng, a, b, r0, r1, sides=4, bow=.2):
    """A cheap limb: two segments, bowed at the middle (ct.limb has five) --
    the cost round's saving on shrub stems and small limbs."""
    m = a.lerp(b, .5) + UP * (b - a).length * bow * .5 + drift(rng, (b - a).length * .04)
    mesh.add_tube([a, m, b], [r0, (r0 + r1) * .5, r1], sides, 'bark', rng=rng, wobble=.05,
                  shade=lambda co, t: .85 * (.9 + .15 * t), flex=lambda co, t: .2 + .35 * t)


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, 'bark', rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered (cartoon_texas). Returns its
    vertices."""
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
    """A lowball lit as part of a crown (normals bent toward `c`)."""
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
    """An axis box; `sides` (-Y, +X, +Y, -X) which walls, lit a little by the
    side they face (cartoon_plains)."""
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


def ridged_tube(mesh, rng, pts, radii, ridges, depth=.24, lo=.6, hi=1.0, groove=.45, flex=.1):
    """A trunk whose cross-section is a star of `ridges` blunt ridges with deep
    dark furrows between (the chestnut oak's bark), the ridges wandering a
    little as they climb."""
    idx = mesh.slot('bark')
    n = ridges * 2
    tw = rng.uniform(0, TAU)
    rings = []
    last = len(pts) - 1
    for i, (p, r) in enumerate(zip(pts, radii)):
        t = i / last
        tan = (pts[min(i + 1, last)] - pts[max(i - 1, 0)]).normalized()
        a = tan.cross(V((1, 0, 0)) if abs(tan.x) < .9 else V((0, 1, 0))).normalized()
        b = tan.cross(a)
        ring = []
        for k in range(n):
            ang = tw + k / n * TAU + .12 * math.sin(i * 1.7 + k)
            rr = r * (1.0 if k % 2 == 0 else 1 - depth) * (1 + rng.uniform(-.06, .06))
            off = a * math.cos(ang) * rr + b * math.sin(ang) * rr
            vx = mesh.bm.verts.new(p + off)
            mesh.normal[vx] = off.normalized()
            m = (lo + (hi - lo) * t) * (1.0 if k % 2 == 0 else groove)
            mesh.paint[vx] = (m, m, m, flex * t)
            ring.append(vx)
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(n):
            k1 = (k + 1) % n
            f = mesh.bm.faces.new((rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]))
            f.material_index = idx
            f.smooth = True


# ---------------------------------------------------------------- rhododendron

def rosette(mesh, rng, q, size, c, shade, n=6, droop=.4):
    """A whorl of long leathery leaves radiating from a stem tip and drooping,
    around a small dense centre."""
    a0 = rng.uniform(0, TAU)
    for k in range(n):
        a = a0 + k / n * TAU + rng.uniform(-.2, .2)
        d = heading(a)
        side = V((-d.y, d.x, 0))
        L = size * rng.uniform(.85, 1.1)
        w = L * .24
        mid = q + d * L * .5 - UP * L * droop * .25
        tip = q + d * L - UP * L * droop
        nrm = (UP + d * .35).normalized()
        twosided(mesh, [q + d * L * .05, mid + side * w, tip, mid - side * w], 'leaf', nrm, shade(mid, nrm), flex=.6)
    s = size * .42
    ball(mesh, rng, q + UP * s * .1, (s, s, s * .7), c, shade, u=6, v=4, jitter=.2, bend=.5)


def rhododendron(height, spread, stems):
    """Rosebay rhododendron: a wide low thicket of crooked leaning stems from
    the ground, each forking into tips that end in starbursts of long drooping
    leaves, over a dark dense mass; pale pink trusses (accent) on the tips."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.38, high=1.15)
        a0 = rng.uniform(0, TAU)
        tips = []
        for s in range(stems):
            a = a0 + s / stems * TAU + rng.uniform(-.3, .3)
            d = heading(a)
            out = R * rng.uniform(.45, .8)
            top = H * rng.uniform(.5, .88)
            base = d * R * .08
            k1 = base + d * out * .35 + UP * top * .3 + drift(rng, .25)
            k2 = base + d * out * .7 + UP * top * .65 + drift(rng, .25)
            end = base + d * out + UP * top
            r = H * .022
            twig(mesh, rng, base - UP * .05, k1, r, r * .8, sides=5, bow=.25)
            twig(mesh, rng, k1, k2, r * .8, r * .6, sides=4, bow=-.25)
            twig(mesh, rng, k2, end, r * .6, r * .4, sides=4, bow=.2)
            tips.append(end)
            for j in range(2):
                e = heading(a + (j - .5) * 1.4 + rng.uniform(-.2, .2))
                p = k2 if j else k1
                t2 = p + e * R * rng.uniform(.3, .45) + UP * H * rng.uniform(.1, .25)
                twig(mesh, rng, p, t2, r * .5, r * .3, sides=4, bow=.2)
                tips.append(t2)
        # Round 2: a skirt of low rosettes round the edge and the dark mass
        # lowered, so the thicket is dense to the ground and wider.
        for k in range(9):
            a = a0 + (k + .5) / 9 * TAU + rng.uniform(-.2, .2)
            tips.append(heading(a) * R * rng.uniform(.78, .95) + UP * H * rng.uniform(.18, .32))
        for k in range(6):
            q = heading(a0 + k * 1.05) * R * .45 + UP * H * rng.uniform(.3, .5)
            s = R * .45
            ball(mesh, rng, q, (s, s, s * .8), c, shade, u=8, v=5, jitter=.2, bright=.85)
        fr = random.Random(rng.random())
        size = min(.6, R * .26)
        for q in tips:
            rosette(mesh, rng, q, size, c, shade)
            if q.z > H * .4 and fr.random() < .8:
                ball(mesh, fr, q + UP * size * .35, (.22, .22, .17), c, None, flex=.7, role='accent', jitter=.2, u=5,
                     v=3, bend=.2)
    return build


# ---------------------------------------------------------------- mountain laurel

def laurel(height, spread, stems):
    """Mountain laurel: a few gnarled zigzag stems from the ground splaying
    out, ending in rounded tufts of small glossy leaves -- an irregular,
    rather open shrub wider than tall -- with many small domed clusters of
    pink-white cup flowers (accent) on the tufts in late spring."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .45), low=.4, high=1.3)
        a0 = rng.uniform(0, TAU)
        ends = []
        for s in range(stems):
            a = a0 + s / stems * TAU + rng.uniform(-.3, .3)
            d = heading(a)
            p = d * R * .05 - UP * .05
            r = H * .03
            reach = R * rng.uniform(.45, .85)
            top = H * rng.uniform(.5, .8)
            for k in range(3):
                f = (k + 1) / 3
                q = d * reach * f + UP * top * f + drift(rng, R * .15)
                twig(mesh, rng, p, q, r * (1 - .25 * k), r * (.75 - .25 * k), sides=5 if k == 0 else 4, bow=(.3 if k % 2 else -.3))
                if k >= 1:
                    e = heading(a + rng.choice((-1, 1)) * rng.uniform(.6, 1.1))
                    t2 = q + e * R * .3 + UP * H * rng.uniform(.08, .2)
                    twig(mesh, rng, q, t2, r * .45, r * .25, sides=3, bow=.25)
                    ends.append(t2)
                p = q
            ends.append(p)
        # Round 2: more, smaller tufts at every end plus a filled core -- a
        # dense billowy mound, flowers spread over all of it.
        # Round 3: no tuft above the mound, and a skirt of tufts low round
        # the edge, so it is a rounded billowy mass from near the ground.
        ends = [V((q.x, q.y, min(q.z, H * .88))) for q in ends]
        ends.append(UP * H * .8)
        for k in range(8):
            a = a0 + (k + .5) / 8 * TAU + rng.uniform(-.2, .2)
            ends.append(heading(a) * R * rng.uniform(.72, .88) + UP * H * rng.uniform(.22, .36))
        core = []
        for k in range(5):
            q = heading(a0 + k * 1.26) * R * .3 + UP * H * rng.uniform(.55, .75)
            s = R * .4
            ball(mesh, rng, q, (s, s, s * .8), c, shade, jitter=.2, u=8, v=5, bend=.5, bright=.9)
            core.append((q, s))
        fr = random.Random(rng.random())
        # Round 14: flowers on the core tufts too, so the top is covered.
        for q, s in core:
            for m in range(2):
                o = heading(fr.uniform(0, TAU)) * s * fr.uniform(.2, .5) + UP * s * fr.uniform(.6, .75)
                ball(mesh, fr, q + o, (.19, .19, .1), c, None, flex=.8, role='accent', jitter=.15, u=4, v=3, bend=.2)
        # Round 16 (cost): one bigger tuft on each skirt end, seven-sided
        # tufts, 16-triangle flower domes.
        for i, q in enumerate(ends):
            s = R * .3
            one = i >= len(ends) - 8
            for m in range(1 if one else 2):
                o = drift(rng, s * .45) + UP * s * rng.uniform(-.1, .3)
                k = s * (rng.uniform(.7, .8) if one else rng.uniform(.55, .7))
                ball(mesh, rng, q + o, (k, k, k * .85), c, shade, jitter=.18, u=7, v=4, bend=.45, bright=1.08)
            for m in range(2):
                o = heading(fr.uniform(0, TAU)) * s * fr.uniform(.2, .6) + UP * s * fr.uniform(.4, .65)
                ball(mesh, fr, q + o, (.19, .19, .1), c, None, flex=.8, role='accent', jitter=.15, u=4, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- flame azalea

def flameazalea(height, spread, stems):
    """Flame azalea: a few thin stems rising from the ground in a loose vase,
    branching in whorls into short level side shoots; flat tufts of leaves at
    every tip, set in open tiers with sky between; big clusters of orange
    flame flowers (accent) on the tips in spring."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .6
        shade = ct.crown_shade(c, (R, R, H * .4), low=.45, high=1.2)
        a0 = rng.uniform(0, TAU)
        fr = random.Random(rng.random())
        tips = []
        for s in range(stems):
            a = a0 + s / stems * TAU + rng.uniform(-.3, .3)
            d = heading(a)
            top = d * R * rng.uniform(.5, .8) + UP * H * rng.uniform(.7, .96)
            base = d * R * .06 - UP * .05
            r = H * .011
            ct.limb(mesh, rng, base, top, r, r * .45, sides=4, bow=.12)
            tips.append(top)
            # Round 2: small flat tufts on short level shoots, open and
            # see-through; round 3: one tier, stems leaning out in a vase.
            for zf in ((.6,) if s % 2 else (.5, .75)):
                p = base.lerp(top, zf)
                for j in range(2):
                    e = heading(a + (j - .5) * 2.2 + rng.uniform(-.3, .3))
                    t2 = p + e * R * rng.uniform(.35, .5) * (1.25 - zf * .5) + UP * H * .05
                    twig(mesh, rng, p, t2, r * .5, r * .25, sides=3, bow=.15)
                    tips.append(t2)
        for q in tips:
            s = R * .17
            ball(mesh, rng, q + UP * s * .1, (s, s, s * .45), c, shade, jitter=.25, u=6, v=3, bend=.5)
            for m in range(3):
                o = heading(fr.uniform(0, TAU)) * s * .45 + UP * s * fr.uniform(.35, .55)
                ball(mesh, fr, q + o, (.11, .11, .09), c, None, flex=.8, role='accent', jitter=.2, u=4, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- chestnut oak

def chestnutoak(height, spread, leaders, lean):
    """Chestnut oak: a dark trunk of deep blunt ridges, forking at a third of
    the height into a few ascending leaders, each with crooked side limbs;
    the crown an irregular, open, upright-spreading group of separate
    rough masses, sky between, and a dead snag out of the top (ridge oaks)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        fork = H * .32
        a0 = rng.uniform(0, TAU)
        lv = heading(a0) * H * lean
        tpts = [lv * (t / 5) ** 1.5 + UP * fork * t / 5 + (drift(rng, .08) if t else V((0, 0, -.1))) for t in range(6)]
        r0 = H * .028
        radii = [r0 * (1.7 if t == 0 else 1.15 if t == 1 else 1.0 - .12 * t / 5) for t in range(6)]
        ridged_tube(mesh, rng, tpts, radii, 7)
        top = tpts[-1]
        c = V((top.x, top.y, H * .66))
        shade = ct.crown_shade(c, (R, R, H * .36), low=.4, high=1.15)
        best = None

        # Round 2: every mass is a knot of three or four rough balls, not one
        # flat lobe, and the side limbs start low on the leaders, so the
        # crown comes down to 0.4 of the height in separate masses.
        def mass(q, s, n):
            for m in range(n):
                o = drift(rng, s * .8) + UP * s * rng.uniform(-.3, .4)
                k = s * rng.uniform(.62, .78)
                ball(mesh, rng, q + o, (k, k, k * .85), c, shade, jitter=.24, u=8, v=5, bend=.5)
        for i in range(leaders):
            a = a0 + math.pi + i / leaders * TAU + rng.uniform(-.4, .4)
            d = heading(a)
            hi = H * (rng.uniform(.84, .9) if i == 0 else rng.uniform(.66, .8))
            out = R * rng.uniform(.2, .38)
            path = bez(top, top + UP * H * .15 + d * out * .1, top + d * out * .6 + UP * (hi - top.z) * .7,
                       top + d * out + UP * (hi - top.z), 5)
            bark_tube(mesh, rng, path, radii[-1] * .72, radii[-1] * .25, 6, shade=(.55, .8))
            if best is None or path[-1].z > best.z:
                best = path[-1]
            mass(path[-1] + UP * R * .05, R * .26, 4)
            for j in range(3):
                p = path[(1, 2, 4)[j]]
                e = heading(a + (j - 1) * 1.2 + rng.uniform(-.3, .3))
                # Round 3: side masses alternate low and high, gaps between.
                reach = R * rng.uniform(.45, .6) * (1.35 if j == 0 else .85)
                end = p + e * reach + UP * H * ((-.03, .06, .12)[j] + rng.uniform(-.02, .02))
                mid = p.lerp(end, .5) + UP * H * .04 + drift(rng, .3)
                ct.limb(mesh, rng, p, mid, radii[-1] * .4, radii[-1] * .25, sides=5, bow=.2)
                twig(mesh, rng, mid, end, radii[-1] * .25, radii[-1] * .1, sides=4, bow=-.2)
                mass(end + UP * R * .04, R * rng.uniform(.17, .21), 3)
        # Round 4: one more mass high in the middle, so the crown is upright, not lopsided.
        if leaders < 4:
            mass(V((top.x, top.y, H * .8)) + drift(rng, R * .15), R * .24, 3)
        snag = best + UP * H * .17 + drift(rng, 1.0)
        ct.limb(mesh, rng, best - UP * H * .05, snag, radii[-1] * .22, radii[-1] * .06, sides=5, bow=.3)
        ct.limb(mesh, rng, best.lerp(snag, .5), best.lerp(snag, .5) + drift(rng, 1.2) + UP * .8, radii[-1] * .06,
                radii[-1] * .02, sides=3, bow=.2)
    return build


# ---------------------------------------------------------------- shortleaf pine

def shortleafpine(height, spread, whorls, form, low):
    """Shortleaf pine: a long straight clear trunk (a few dead stubs), then a
    narrow crown of short whorled branches ending in tufts of needles, sky
    between -- `spire` the open-grown pyramid to a pointed leader, `oval` the
    forest form, a small rounded crown high on a long clear trunk. `low`:
    where the crown starts, as a share of the height."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V((0, 0, 0)), H * .96, H * .016, lean=drift(rng, H * .01), steps=7,
                              sides=8, flare=1.4, bend=H * .004, shade_low=.7, shade_high=.95)
        top = pts[-1]
        z0 = H * low
        c = UP * H * .75
        shade = ct.crown_shade(c, (R, R, H * .27), low=.42, high=1.15)

        def axis(z):
            return V((top.x * z / H, top.y * z / H, z))
        a0 = rng.uniform(0, TAU)
        for w in range(whorls):
            f = w / (whorls - 1)
            z = z0 + (H * .9 - z0) * f
            if form == 'spire':
                prof = .3 + .7 * (1 - f ** 1.3) ** .8
            else:
                prof = .2 + .8 * math.sin(math.pi * (.22 + .78 * f)) ** .7
            L = R * prof
            nb = 3 if f > .6 else 4
            off = a0 + w * ct.GOLDEN
            # Round 2: two or three small ragged needle tufts along each
            # branch instead of one big plate.
            for b in range(nb):
                a = off + b / nb * TAU + rng.uniform(-.3, .3)
                d = heading(a)
                p = axis(z)
                end = p + d * L - UP * L * .06
                twig(mesh, rng, p, end, H * .006, H * .002, sides=4, bow=-.1)
                s = max(R * .2, L * .3)
                for g in ((1.0, .6) if L < R * .65 else (1.0, .66, .36)):
                    k = s * (1 - .25 * (1 - g))
                    ball(mesh, rng, p.lerp(end, g) + UP * k * .25, (k, k, k * .6), c, shade, u=8, v=4, jitter=.35,
                         bend=.5)
        s = R * .26
        ball(mesh, rng, top + UP * s * .3, (s * .55, s * .55, s * .75), c, shade, u=8, v=4, jitter=.25, bend=.5)
        for k in range(4):
            z = H * rng.uniform(.25, z0 / H - .04)
            d = heading(rng.uniform(0, TAU))
            ct.limb(mesh, rng, axis(z), axis(z) + d * rng.uniform(.5, .9) + UP * .1, H * .003, H * .001, sides=3,
                    bow=0)
    return build


# ---------------------------------------------------------------- sassafras

def sassafras(height, spread, tiers):
    """Sassafras: a straight, slightly sinuous trunk nearly to the top, with
    short level branches in tiers; each carries flat shelves of mitten leaves
    along its outer half, so the crown is narrow and layered with sky
    between the shelves. Some shelves are the accent role, so autumn shows
    its red among the orange."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V((0, 0, 0)), H * .85, H * .02, lean=drift(rng, H * .02), steps=7,
                              sides=8, flare=1.4, bend=H * .02, shade_low=.72, shade_high=.95)
        top = pts[-1]
        bark_tube(mesh, rng, [top, top + UP * H * .12 + drift(rng, .2)], radii[-1], radii[-1] * .3, 5)
        c = UP * H * .62
        shade = ct.crown_shade(c, (R, R, H * .38), low=.42, high=1.18)
        a0 = rng.uniform(0, TAU)

        def axis(z):
            return V((top.x * z / top.z, top.y * z / top.z, z))
        for t in range(tiers):
            f = t / (tiers - 1)
            z = H * (.36 + .56 * f)
            L = R * math.sin(math.pi * (.3 + .55 * f))
            nb = 4
            # Round 2: four branches a tier and three shelves on the long
            # ones -- a fuller upright oval that keeps its layered edge.
            for b in range(nb):
                a = a0 + t * ct.GOLDEN + b / nb * TAU + rng.uniform(-.3, .3)
                d = heading(a)
                p = axis(min(z, top.z))
                end = p + d * L + UP * L * .15
                twig(mesh, rng, p, end, H * .007, H * .002, sides=4, bow=.12)
                for g, sf in (((1.0, .2), (.6, .18)) if L > R * .7 else ((1.0, .2),)):
                    q = p.lerp(end, g)
                    s = R * sf * rng.uniform(.9, 1.1)
                    role = 'accent' if rng.random() < .35 else 'leaf'
                    ball(mesh, rng, q + UP * s * .15, (s * 1.2, s * 1.2, s * .34), c, shade, role=role, u=8, v=5,
                         jitter=.22, bend=.5)
        s = R * .26
        ball(mesh, rng, UP * (H - s * .4), (s, s, s * .6), c, shade, u=8, v=5, jitter=.2)
    return build


# ---------------------------------------------------------------- stone cabin

def log(mesh, rng, a, b, r):
    k = rng.uniform(.82, 1.05)
    mesh.add_tube([a, b], [r * rng.uniform(.92, 1.05)] * 2, 6, 'bark', rng=rng, wobble=.03,
                  shade=lambda co, t: k, flex=lambda co, t: 0.0)


def roofslab(mesh, ya, za, yb, zb, x0, x1, t, role, shade=1.0):
    prism(mesh, [(ya, za), (yb, zb), (yb, zb + t), (ya, za + t)], x0, x1, 'x', role, shade=shade)


def stonecabin(width, depth, porch):
    """A one-room log cabin: round logs with pale chinking between, crossed at
    the corners, on a fieldstone sill; a steep tin gable roof (ridge along X)
    running on down over a full-width front porch on posts (-Y); a fieldstone
    chimney outside the +X gable end, above the ridge; a door and two windows
    on the front."""
    def build(mesh, rng):
        W, D, P = width, depth, porch
        x0, x1 = -W / 2, W / 2
        yp = -(D + P) / 2
        y0, y1 = yp + P, (D + P) / 2
        ym = (y0 + y1) / 2
        eave, sill = 3.4, .45
        ridge = eave + D / 2 * .8
        box(mesh, (x0 - .05, y0 - .05, 0), (x1 + .05, y1 + .05, sill), 'stone', shade=.8)
        box(mesh, (x0 + .08, y0 + .08, sill), (x1 - .08, y1 - .08, eave), 'stone', shade=1.05, top=False)
        rl = .12
        n = 10
        step = (eave - sill - 2 * rl) / (n - 1)
        for i in range(n):
            z = sill + rl + i * step
            for y in (y0, y1):
                e = .35 if i % 2 == 0 else .15
                log(mesh, rng, V((x0 - e, y, z)), V((x1 + e, y, z)), rl)
            for x in (x0, x1):
                e = .35 if i % 2 else .15
                log(mesh, rng, V((x, y0 - e, z + step * .5)), V((x, y1 + e, z + step * .5)), rl)
        prism(mesh, [(y0, eave), (y1, eave), (ym, ridge)], x0, x1, 'x', 'bark', shade=.75)
        ov = .4
        slope = (ridge - eave) / (D / 2)
        roofslab(mesh, ym, ridge, y1 + ov, eave - ov * slope, x0 - ov, x1 + ov, .12, 'leaf')
        roofslab(mesh, ym, ridge, y0, eave, x0 - ov, x1 + ov, .12, 'leaf')
        pe = eave - 1.3
        roofslab(mesh, y0 - .05, eave - .45, yp - .3, pe, x0 - .2, x1 + .2, .1, 'leaf', shade=.95)
        box(mesh, (x0 - ov, ym - .1, ridge + .05), (x1 + ov, ym + .1, ridge + .2), 'leaf', shade=.9)
        box(mesh, (x0, yp, 0), (x1, y0, .4), 'bark', shade=.7)
        for x in (x0 + .2, -W / 6, W / 6, x1 - .2):
            yy = yp + .2
            zt = pe + (eave - .45 - pe) * (yy - (yp - .3)) / (y0 - (yp - .3))
            box(mesh, (x - .08, yy - .08, .4), (x + .08, yy + .08, zt), 'bark', shade=.9)
        yf = y0 - rl - .01
        out = V((0, -1, 0))
        for xa, xb, za, zb in ((-.5, .5, sill, 2.2), (-2.7, -1.7, 1.1, 2.0), (1.7, 2.7, 1.1, 2.0)):
            facing(mesh, [V((xa - .1, yf, za - .1)), V((xb + .1, yf, za - .1)), V((xb + .1, yf, zb + .1)),
                          V((xa - .1, yf, zb + .1))], 'stone', out, shade=1.1)
            facing(mesh, [V((xa, yf - .01, za)), V((xb, yf - .01, za)), V((xb, yf - .01, zb)), V((xa, yf - .01, zb))],
                   'accent', out, shade=1.0)
        xs = x0 - rl - .01
        facing(mesh, [V((xs, ym - .5, 1.1)), V((xs, ym + .5, 1.1)), V((xs, ym + .5, 2.0)), V((xs, ym - .5, 2.0))],
               'accent', V((-1, 0, 0)))
        cx = x1 + rl + .72
        z = 0.0
        while z < ridge + 1.6:
            h = rng.uniform(.38, .5)
            if z < 2.8:
                hw, hd = .8, 1.2
            elif z < 3.4:
                hw, hd = .55, .72
            else:
                hw, hd = .42, .58
            j = drift(rng, .035)
            box(mesh, (cx - hw + j.x, ym - hd + j.y, z), (cx + hw + j.x, ym + hd + j.y, z + h), 'stone',
                shade=rng.uniform(.82, 1.05))
            z += h
        box(mesh, (cx - .45, ym - .5, z), (cx + .45, ym + .5, z + .12), 'stone', shade=.9)
    return build


# ---------------------------------------------------------------- horse fence

def horsefence(length, bays):
    """One straight 10 m section of Kentucky four-board fence along X, x =
    -L/2..+L/2: square posts every L/bays from the -X end (the next section's
    first post closes the +X end), four flat boards on their -Y face, each
    bay's boards butting at the post centres."""
    def build(mesh, rng):
        x0 = -length / 2
        step = length / bays
        for i in range(bays):
            x = x0 + i * step
            box(mesh, (x - .075, -.075, -.1), (x + .075, .075, 1.5), 'bark', shade=1.0)
        for i in range(bays):
            xa = x0 + i * step
            xb = xa + step
            for z in (.3, .65, 1.0, 1.35):
                box(mesh, (xa - .01, -.115, z - .075), (xb + .01, -.075, z + .075), 'bark',
                    shade=rng.uniform(.95, 1.1))
    return build


# ---------------------------------------------------------------- tobacco barn

def tobaccobarn(length, width, eave, ridge):
    """A tall black Kentucky tobacco barn, 20 m long on Y: a plank box under a
    steep tin gable roof, its gable end with big open doors facing -Y (the
    curing tobacco inside showing, accent), the long walls ribbed with
    vertical boards, every other one a vent board hinged open on a gap of
    tobacco; a lean-to shed on posts along the +X side breaks the roofline.
    Built along X, then turned a quarter (round 2)."""
    def build(mesh, rng):
        L, Wd = length, width
        x0, x1, y0, y1 = -L / 2, L / 2, -Wd / 2, Wd / 2
        box(mesh, (x0, y0, 0), (x1, y1, eave), 'bark', shade=.95, top=False)
        prism(mesh, [(y0, eave), (y1, eave), (0, ridge)], x0, x1, 'x', 'bark', shade=.9)
        ov = .6
        slope = (ridge - eave) / (Wd / 2)
        roofslab(mesh, 0, ridge, y1 + ov, eave - ov * slope, x0 - ov, x1 + ov, .15, 'leaf')
        roofslab(mesh, 0, ridge, y0 - ov, eave - ov * slope, x0 - ov, x1 + ov, .15, 'leaf')
        box(mesh, (x0 - ov, -.15, ridge + .08), (x1 + ov, .15, ridge + .25), 'leaf', shade=.9)
        nb = int(L / 1.0)
        for side, y in ((-1, y0), (1, y1)):
            out = V((0, side, 0))
            for k in range(nb + 1):
                x = x0 + k * L / nb
                lo, hi = (y + side * .07, y) if side < 0 else (y, y + side * .07)
                box(mesh, (x - .07, min(lo, hi), 0), (x + .07, max(lo, hi), eave), 'bark', shade=1.15)
                if k % 2 == 1 and k < nb:
                    xa, xb = x + .1, x + .62
                    yy = y + side * .01
                    facing(mesh, [V((xa, yy, .4)), V((xb, yy, .4)), V((xb, yy, eave - .3)), V((xa, yy, eave - .3))],
                           'accent', out, shade=1.0)
                    ang = .75
                    tip = V((xb + .5 * math.cos(ang), y + side * .5 * math.sin(ang), 0))
                    twosided(mesh, [V((xb, y + side * .02, .4)), V((tip.x, tip.y, .4)), V((tip.x, tip.y, eave - .3)),
                                    V((xb, y + side * .02, eave - .3))], 'bark',
                             V((math.sin(ang), -side * math.cos(ang), 0)), shade=1.25)
        for x, sgn in ((x0, -1), (x1, 1)):
            for k in range(13):
                y = y0 + k * Wd / 12
                zt = eave + (ridge - eave) * (1 - abs(y) / (Wd / 2))
                xa, xb = (x, x + .07) if sgn > 0 else (x - .07, x)
                box(mesh, (xa, y - .07, 0), (xb, y + .07, zt), 'bark', shade=1.1)
        dw, dh = 2.2, 5.0
        # Round 3: vent gaps on the front gable end too, beside the door.
        for y in (-5.0, -3.6, 3.0, 4.4):
            facing(mesh, [V((x0 - .075, y, .4)), V((x0 - .075, y + .5, .4)), V((x0 - .075, y + .5, eave - .3)),
                          V((x0 - .075, y, eave - .3))], 'accent', V((-1, 0, 0)), shade=.9)
        facing(mesh, [V((x0 - .08, -dw, 0)), V((x0 - .08, dw, 0)), V((x0 - .08, dw, dh)), V((x0 - .08, -dw, dh))],
               'accent', V((-1, 0, 0)), shade=.75)
        for sgn in (-1, 1):
            th = 2.4
            hinge = V((x0 - .1, sgn * dw, 0))
            tip = hinge + V((-math.sin(th), -sgn * math.cos(th), 0)) * dw
            twosided(mesh, [hinge, tip, tip + UP * dh, hinge + UP * dh], 'bark',
                     (tip - hinge).cross(UP).normalized(), shade=1.9)
        sy = 4.0
        roofslab(mesh, y0, eave - .9, y0 - sy - .3, 3.1, x0 + 1, x1 - 1, .12, 'leaf', shade=.95)
        for k in range(5):
            x = x0 + 1.2 + k * (L - 2.4) / 4
            box(mesh, (x - .09, y0 - sy - .09, 0), (x + .09, y0 - sy + .09, 3.15), 'bark', shade=1.1)
        for vx in mesh.bm.verts:
            vx.co.x, vx.co.y = -vx.co.y, vx.co.x
        for vx, n in list(mesh.normal.items()):
            mesh.normal[vx] = V((-n.y, n.x, n.z))
    return build


MODELS = [
    ('Blender_Rhododendron_1', rhododendron(3.4, 5.0, 8)),
    ('Blender_MountainLaurelShrub_1', laurel(2.2, 2.8, 5)),
    ('Blender_FlameAzalea_1', flameazalea(2.3, 2.6, 6)),
    ('Blender_ChestnutOak_1', chestnutoak(22, 17, 4, .02)),
    ('Blender_ChestnutOak_2', chestnutoak(18, 15, 3, .07)),
    ('Blender_ShortleafPine_1', shortleafpine(24, 12, 7, 'spire', .33)),
    ('Blender_ShortleafPine_2', shortleafpine(26, 8, 6, 'oval', .6)),
    ('Blender_Sassafras_1', sassafras(11, 7, 5)),
    ('Blender_StoneCabin_1', stonecabin(8.5, 6, 2)),
    ('Blender_HorseFence_1', horsefence(10, 4)),
    ('Blender_TobaccoBarn_1', tobaccobarn(20, 12, 7, 11.5)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


SEASONS = ('spring', 'summer', 'autumn', 'winter')


def plant(bark, rows):
    """rows: season -> (leaf, accent or None); an accent of None is drawn the
    leaf's colour (no flowers that season)."""
    return {s: {'leaf': rows[s][0], 'accent': rows[s][1] or rows[s][0], 'bark': bark} for s in SEASONS}


# Role colours per season, from each spec's Seasons table (buildings from
# their Spec colours; they do not change). Deciduous trees are drawn in leaf
# (their bare variants come later), so a bare winter keeps the summer leaf.
LOOK = {
    'Rhododendron': plant('#5a4a3e', {'spring': ('#3e6234', None), 'summer': ('#3e6234', '#c88ab8'),
                                      'autumn': ('#3e6234', None), 'winter': ('#3a5c32', None)}),
    'MountainLaurelShrub': plant('#5e5048', {'spring': ('#3e6234', '#efc8d8'), 'summer': ('#3e6234', None),
                                             'autumn': ('#3e6234', None), 'winter': ('#3a5c32', None)}),
    'FlameAzalea': plant('#6a5a4c', {'spring': ('#8aaa50', '#e0782e'), 'summer': ('#557e38', None),
                                     'autumn': ('#a8502e', None), 'winter': ('#557e38', None)}),
    'ChestnutOak': plant('#4a423a', {'spring': ('#9ab55a', None), 'summer': ('#4f7436', None),
                                     'autumn': ('#9a6a2e', None), 'winter': ('#4f7436', None)}),
    'ShortleafPine': plant('#7a4e36', {'spring': ('#647e3c', None), 'summer': ('#5c7638', None),
                                       'autumn': ('#5c7638', None), 'winter': ('#5a7236', None)}),
    'Sassafras': plant('#7a5a44', {'spring': ('#b0c060', None), 'summer': ('#5a8a3c', None),
                                   'autumn': ('#e0782e', '#c0402a'), 'winter': ('#5a8a3c', None)}),
    'StoneCabin': {s: {'bark': '#7a5a3a', 'stone': '#8a8a80', 'leaf': '#6e665c', 'accent': '#2a2622'} for s in SEASONS},
    'HorseFence': {s: {'bark': '#1a1a1a'} for s in SEASONS},
    'TobaccoBarn': {s: {'bark': '#1e1e1e', 'leaf': '#7a7672', 'accent': '#9a7040'} for s in SEASONS},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        out[name] = {role: hexrgb(h) for role, h in LOOK[sp][season].items()}
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.33, 0.35, 0.30),
                           'stone': (0.69, 0.63, 0.48)},
          far={'Blender_ChestnutOak_1', 'Blender_ChestnutOak_2', 'Blender_ShortleafPine_1', 'Blender_ShortleafPine_2'},
          tints=tints(SEASON))
