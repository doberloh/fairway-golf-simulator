# THE HAWAII PACK (the US landscapes goal, 2 November 2026; PLAN.md section
# 5, local): what the volcanic Hawaii landscape lacked beside the palms,
# hala, banyan, royal palm, gumbo limbo, bougainvillea and hibiscus the game
# already has -- the monkeypod, the ironwood (casuarina), the Cook pine, the
# ohia lehua, plumeria, ti, heliconia and black lava rock.
#
#   node tools/blender/iterate.mjs cartoon_hawaii <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid. The monkeypod is a huge umbrella far wider than tall on a short
# trunk, its long limbs fanning out under a thin flat-topped canopy whose rim
# droops low; the ironwood a tall open tree of hanging grey-green curtains on
# thin ascending limbs, sky between; the Cook pine a very tall narrow column
# of short horizontal branch-ropes in whorls with gaps between, leaning; the
# ohia a crooked open tree of small grey-green tufts with red pompoms; the
# plumeria a candelabra of thick forked bare branches with a leaf rosette at
# each tip; ti a few bare canes each topped by a fountain of strap leaves;
# heliconia a clump of upright paddle leaves with red claw bracts; the lava
# a jagged a'a clinker heap and a flat ropy pahoehoe slab.
#
# REFS monkeypod=Blender_Monkeypod_1,Blender_Monkeypod_2
# REFS ironwoodcasuarina=Blender_Casuarina_1
# REFS cookpine=Blender_CookPine_1
# REFS ohia=Blender_Ohia_1
# REFS plumeria=Blender_Plumeria_1
# REFS tiplant=Blender_TiPlant_1
# REFS heliconia=Blender_Heliconia_1
# REFS lavarock=Blender_LavaRock_1,Blender_LavaRock_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
V0 = Vector((0, 0, 0))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def aim(a, e):
    """A unit direction: heading `a`, elevation `e` above the horizontal."""
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


def bez(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(p0 * (u * u * u) + p1 * (3 * u * u * t) + p2 * (3 * u * t * t) + p3 * (t * t * t))
    return out


def clump(mesh, rng, q, s, c, shade, squash=.75, jitter=.12, flex=.8, bottom=.3, role='leaf'):
    mesh.add_lump(q, (s, s, s * squash), role, rng, subdiv=3, jitter=jitter, crown=c, blend=.85, shade=shade, flex=flex,
                  squash_bottom=bottom)


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06, role='bark'):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


def orb(mesh, rng, center, radii, role, quat=None, u=8, v=5, jitter=.15, shade=1.0, flex=.6, crown=None, bend=0.0):
    """A cheap u-by-v lump (2u(v-1) triangles), its radii in a local frame
    turned by `quat` -- so a leaf, a branch-rope or a bract can point any
    way. Normals bent toward `crown` by `bend`; `shade` a number, a tuple or
    shade(point, normal)."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
    if ct.FAR:
        u, v = max(4, u // 2 + 1), 3
    rx, ry, rz = radii

    def put(local):
        return center + (quat @ local if quat is not None else local)

    def turn(n):
        return (quat @ n if quat is not None else n).normalized()

    made = []
    top = mesh.bm.verts.new(put(Vector((0, 0, rz))))
    bot = mesh.bm.verts.new(put(Vector((0, 0, -rz))))
    made += [(top, Vector((0, 0, 1))), (bot, Vector((0, 0, -1)))]
    rings = []
    for i in range(1, v):
        phi = math.pi / 2 - i / v * math.pi
        ring = []
        for k in range(u):
            a = k / u * math.tau
            r = 1 + rng.uniform(-jitter, jitter)
            loc = Vector((math.cos(phi) * math.cos(a) * rx * r, math.cos(phi) * math.sin(a) * ry * r, math.sin(phi) * rz * r))
            x = mesh.bm.verts.new(put(loc))
            ring.append(x)
            made.append((x, Vector((loc.x / rx ** 2, loc.y / ry ** 2, loc.z / rz ** 2))))
        rings.append(ring)
    for k in range(u):
        k1 = (k + 1) % u
        fs = [mesh.bm.faces.new((top, rings[0][k], rings[0][k1]))]
        for i in range(len(rings) - 1):
            a, b = rings[i], rings[i + 1]
            fs.append(mesh.bm.faces.new((a[k], b[k], b[k1], a[k1])))
        fs.append(mesh.bm.faces.new((bot, rings[-1][k1], rings[-1][k])))
        for f in fs:
            f.material_index = idx
            f.smooth = True
    for x, n in made:
        n = turn(n)
        if crown is not None and bend:
            out = x.co - crown
            out = out.normalized() if out.length > 1e-6 else UP
            n = (n * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = shade(x.co, n) if callable(shade) else (1.0 if shade is None else shade)
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0], mm[1], mm[2], flex)
    return [x for x, _ in made]


def spindle(mesh, rng, start, d, length, width, thick, role, **kw):
    """An orb laid from `start` along `d`: a leaf, a bract, a branch-rope.
    Its width lies across, as level as it can (the thin side faces up)."""
    d = d.normalized()
    q = d.to_track_quat('X', 'Z')
    return orb(mesh, rng, start + d * length * .5, (length * .5, width * .5, thick * .5), role, quat=q, **kw)


def ball(mesh, rng, q, radii, c, shade, role='leaf', jitter=.2, u=8, v=5, bend=.6, flex=.8):
    return orb(mesh, rng, q, radii, role, u=u, v=v, jitter=jitter, shade=shade, flex=flex, crown=c, bend=bend)


def tassel(mesh, rng, top, r, length, shade, sides=7, role='leaf', flex=.85):
    """A hanging mop: a domed top, a skirt widening a little, then a ragged
    fringe of teeth of uneven length below -- weeping needles or twigs
    (about 6 triangles a side). `top` is where it hangs from."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
    if ct.FAR:
        sides = max(4, sides // 2 + 1)
    a0 = rng.uniform(0, math.tau)
    cap = mesh.bm.verts.new(top + UP * r * .35)
    ring0, ring1, teeth = [], [], []
    for k in range(sides):
        a = a0 + k / sides * math.tau
        h = heading(a)
        ring0.append(mesh.bm.verts.new(top + h * r * .75 * rng.uniform(.9, 1.1)))
        ring1.append(mesh.bm.verts.new(top + h * r * rng.uniform(.9, 1.1) - UP * length * .35))
        b = a + math.pi / sides
        teeth.append(mesh.bm.verts.new(top + heading(b) * r * .7 - UP * length * rng.uniform(.75, 1.15)))
    bot = mesh.bm.verts.new(top - UP * length * .55)
    fs = []
    for k in range(sides):
        k1 = (k + 1) % sides
        fs.append(mesh.bm.faces.new((cap, ring0[k], ring0[k1])))
        fs.append(mesh.bm.faces.new((ring0[k], ring1[k], ring1[k1], ring0[k1])))
        fs.append(mesh.bm.faces.new((ring1[k], teeth[k], ring1[k1])))
        fs.append(mesh.bm.faces.new((teeth[k], bot, ring1[k1])))
        fs.append(mesh.bm.faces.new((ring1[k1], bot, teeth[k1])))
    for f in fs:
        f.material_index = idx
        f.smooth = True
    for x in [cap, bot] + ring0 + ring1 + teeth:
        d = x.co - (top - UP * length * .3)
        n = Vector((d.x, d.y, d.z * .4))
        n = n.normalized() if n.length > 1e-6 else UP
        mesh.normal[x] = n
        m = shade(x.co, n) if shade else 1.0
        mesh.paint[x] = (m, m, m, flex)


# ---------------------------------------------------------------- monkeypod

def monkeypod(height, spread, limbs, skew):
    """Monkeypod: a short massive trunk forking into long limbs that fan out
    almost level and rise gently; a thin canopy laid over them like an
    opened umbrella -- flat on top, its rim drooping low all round, far
    wider than tall, the dark limbs showing under it. `skew` makes one side
    reach further (a field tree grown lopsided)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V0, H * .26, H * .045, lean=drift(rng, H * .02), steps=4, sides=10, flare=1.9,
                              bend=H * .01, shade_low=.55, shade_high=.8)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .5))
        shade = ct.crown_shade(c, (R, R, H * .45), low=.38, high=1.18)
        a0 = rng.uniform(0, math.tau)

        def reach(a):
            return R * (1 + skew * math.cos(a - a0))

        base = Vector((top.x, top.y, 0))
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.25, .25)
            d = heading(a)
            rr = reach(a)
            p3 = base + d * rr * .78 + UP * H * .52
            path = bez(top, top + d * rr * .2 + UP * H * .14, base + d * rr * .5 + UP * H * .44, p3, 6)
            bark_tube(mesh, rng, path, radii[-1] * .6, H * .007, 7, shade=(.55, .8))
            side = Vector((-d.y, d.x, 0)) * rng.choice((-1, 1))
            tip = base + (d * .92 + side * .25).normalized() * rr * .9 + UP * H * .48
            ct.limb(mesh, rng, path[3], tip, H * .012, H * .004, sides=4, bow=.12, shade=.7)
        # Round 2: bigger, overlapping lobes in closer rings -- one dense
        # umbrella, not lily pads.
        # Round 3: the rim lifted to half the height so the trunk and the
        # fan of limbs show under it; upper lobes rounder (a lumpy dome).
        rings = ((.86, .52, 13, .22, .66, False), (.6, .72, 11, .24, .72, False), (.34, .88, 7, .26, .6, True),
                 (.08, .92, 3, .27, .55, True))
        tops = []
        for rf, zf, n, sf, sq, fine in rings:
            off = rng.uniform(0, 1)
            for k in range(n):
                a = a0 + (k + off) / n * math.tau
                q = base + heading(a) * reach(a) * rf + UP * H * (zf + (0 if fine else rng.uniform(-.05, .03)))
                s = R * sf * rng.uniform(.9, 1.1)
                if fine:
                    clump(mesh, rng, q, s, c, shade, squash=sq, jitter=.16, bottom=.5)
                else:
                    ball(mesh, rng, q, (s, s, s * sq), c, shade, jitter=.18, u=12, v=5)
                tops.append(q + UP * s * sq * .85)
        fr = random.Random(rng.random())
        for q in fr.sample(tops, min(12, len(tops))):
            ball(mesh, fr, q + drift(fr, R * .06), (R * .025, R * .025, R * .016), c, None, role='accent', jitter=.3, u=5,
                 v=3, bend=.2)
    return build


# ---------------------------------------------------------------- ironwood

def casuarina(height, spread, limbs):
    """Ironwood (casuarina): a tall straight-ish grey trunk, thin limbs
    climbing out of it, and from them hanging curtains of fine drooping
    needles (tassels) -- an open, ragged, wispy spray high on a long
    leaning trunk, sky between the tassels."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V0, H * .84, H * .022, lean=heading(rng.uniform(0, math.tau)) * H * .12, steps=6,
                              sides=8, flare=1.6, bend=H * .04, shade_low=.7, shade_high=.95)
        c = UP * H * .62
        shade = ct.crown_shade(c, (R, R, H * .4), low=.55, high=1.2)
        a0 = rng.uniform(0, math.tau)

        def on_trunk(z):
            for p, q in zip(pts, pts[1:]):
                if q.z >= z:
                    return p.lerp(q, (z - p.z) / max(1e-6, q.z - p.z))
            return pts[-1]

        # Round 2: a drape is three small hanging balls, ragged, not one
        # paddle; no blade wisps (they read as leaves).
        # Round 3: five thin hanging strands a drape -- wisps, not paddles.
        # Round 5: strands still read as broad leaves; a drape is now two
        # tassels -- rounded on top, a ragged toothed fringe hanging below
        # (the weeping needles), so the crown is mops of fine droop.
        def drape(q, s):
            tassel(mesh, rng, q, s * rng.uniform(.42, .5), s * rng.uniform(1.3, 1.6), shade, sides=9)

        # Round 6: longer, flatter limbs from half height and three smaller
        # tassels along each -- a wide ragged spray, sky between, as photos
        # 1-3, not bunches hung round a pole.
        for i in range(limbs):
            f = i / max(1, limbs - 1)
            base = on_trunk(H * (.5 + .38 * f))
            a = a0 + i * 2.4 + rng.uniform(-.3, .3)
            d = heading(a)
            out = R * (1.0 - .3 * f) * rng.uniform(.75, 1.05)
            end = base + d * out + UP * H * rng.uniform(.04, .1)
            pp = ct.limb(mesh, rng, base, end, H * .007, H * .002, sides=4, bow=.15)
            s = R * rng.uniform(.26, .3)
            drape(end + UP * s * .2, s)
            drape(pp[3] + UP * s * .25 + drift(rng, s * .3), s * .9)
            drape(pp[2] + UP * s * .3 + drift(rng, s * .3), s * .8)
        tp = pts[-1]
        for k in range(3):
            drape(tp + heading(a0 + k * 2.1) * R * .15 + UP * H * .08, R * .26)
    return build


# ---------------------------------------------------------------- Cook pine

def cookpine(height, spread, lean, step):
    """Cook pine: a very tall narrow column -- a straight trunk, leaning and
    curving gently, ringed all the way up with short level branch-ropes in
    whorls, sky between the whorls; the ropes shorten only near the top."""
    def build(mesh, rng):
        H, R = height, spread * .5
        ld = heading(rng.uniform(0, math.tau))

        def pos(t):
            return ld * (H * lean) * (t ** 1.6) + UP * H * t

        n = 10
        tp = [pos(i / n) for i in range(n + 1)]
        mesh.add_tube(tp, [H * .013 * (1.5 if i == 0 else 1) * (1 - .8 * i / n) for i in range(n + 1)], 8, 'bark',
                      rng=rng, wobble=.04, shade=lambda co, t: .72 + .25 * t, flex=lambda co, t: .1 * t)
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .5), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        z, k = H * .1, 0
        while z < H * .96:
            t = z / H
            f = (t - .1) / .86
            # Round 2: four fat ropes a whorl, closer, longest low down.
            L = R * (1.0 - .35 * f) * (1 if f < .75 else 1 - .7 * (f - .75) / .25) * rng.uniform(.75, 1.15)
            for j in range(4):
                a = a0 + k * .75 + j / 4 * math.tau + rng.uniform(-.2, .2)
                d = aim(a, .08)
                spindle(mesh, rng, pos(t) + d * .15, d, L, 1.0, .8, 'leaf', u=6, v=4, jitter=.12, shade=shade, flex=.7)
            z += step * rng.uniform(.85, 1.15)
            k += 1
        spindle(mesh, rng, pos(.95), aim(0, 1.5) + ld * .1, H * .08, .4, .4, 'leaf', u=6, v=4, shade=shade)
    return build


# ---------------------------------------------------------------- ohia

def ohia(height, spread, limbs):
    """Ohia lehua: a crooked grey trunk splitting into twisting limbs, an
    open, irregular, scruffy crown of small grey-green tufts at the limb
    ends, red pompom flowers (accent) sitting on the tufts."""
    def build(mesh, rng):
        H, R = height, spread * .5
        p = [V0, drift(rng, .5) + UP * H * .12, drift(rng, .7) + UP * H * .25, drift(rng, .5) + UP * H * .36]
        tr = bez(p[0], p[1], p[2], p[3], 5)
        bark_tube(mesh, rng, tr, H * .035, H * .022, 7, shade=(.68, .92), wobble=.12)
        top = tr[-1]
        # Round 10: a second, thinner twisting stem off the base -- the
        # gnarled, many-stemmed ohia of the lava flows.
        d2 = heading(rng.uniform(0, math.tau))
        st2 = bez(V0 + d2 * .1, d2 * H * .1 + UP * H * .15, d2 * H * .05 + drift(rng, .4) + UP * H * .3,
                  d2 * H * .2 + UP * H * .45, 4)
        bark_tube(mesh, rng, st2, H * .022, H * .012, 6, shade=(.68, .9), wobble=.14)
        c = UP * H * .65
        shade = ct.crown_shade(c, (R, R, H * .35), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        r = H * .022
        tips, mids = [], []
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            end = top + d * R * rng.uniform(.6, .95) + UP * (H * rng.uniform(.5, .85) - top.z)
            mid = top.lerp(end, .45) + drift(rng, R * .2) + UP * H * .05
            ct.limb(mesh, rng, top, mid, r * .8, r * .5, sides=5, bow=-.1)
            ct.limb(mesh, rng, mid, end, r * .5, r * .18, sides=4, bow=.15)
            tip2 = mid + heading(a + rng.choice((-1, 1)) * rng.uniform(.7, 1.1)) * R * .4 + UP * H * .15
            ct.limb(mesh, rng, mid, tip2, r * .35, r * .12, sides=4, bow=.1)
            tips += [end, tip2]
            mids.append(mid.lerp(end, .45))
        tips.append(top + UP * (H * .9 - top.z))

        def cluster(q, s, n):
            for m in range(n):
                o = drift(rng, s * .55) + UP * s * rng.uniform(-.25, .35)
                k = s * rng.uniform(.5, .68)
                ball(mesh, rng, q + o, (k, k, k * .62), c, shade, jitter=.25, u=6, v=4, bend=.4)

        fr = random.Random(rng.random())
        # Round 3: a tuft part-way along each limb too, so the crown is not
        # lollipops on sticks.
        for q in mids:
            cluster(q, R * .17, 3)
        for q in tips:
            s = R * .22
            cluster(q, s, 4)
            for j in range(fr.choice((1, 2))):
                ball(mesh, fr, q + UP * s * .5 + drift(fr, s * .5), (.22, .22, .2), c, None, role='accent', jitter=.35,
                     u=6, v=4, bend=.2)
    return build


# ---------------------------------------------------------------- plumeria

def plumeria(height, spread, leaves):
    """Plumeria: a short thick trunk forking again and again into thick,
    blunt, upcurving bare branches -- a candelabra -- each tip carrying a
    rosette of long paddle leaves and a posy of flowers (accent) above it;
    sky between the rosettes, the branches showing under them."""
    def build(mesh, rng):
        H, R = height, spread * .5
        pts, radii = ct.trunk(mesh, rng, V0, H * .22, H * .04, lean=drift(rng, H * .03), steps=3, sides=8, flare=1.4,
                              shade_low=.7, shade_high=.95)
        top = pts[-1]
        c = UP * H * .75
        shade = ct.crown_shade(c, (R, R, H * .3), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        tips = []

        def branch(p, a, e, length, r, depth):
            d = aim(a, e)
            end = p + d * length
            ct.limb(mesh, rng, p, end, r, r * .85, sides=5, bow=.12, shade=.9)
            if depth == 0:
                tips.append((end, a))
                return
            for j in (-1, 1):
                branch(end, a + j * rng.uniform(.35, .55), min(1.3, e + rng.uniform(.12, .25)), length * .78, r * .8,
                       depth - 1)

        for k in range(4):
            branch(top, a0 + k * 1.57 + rng.uniform(-.2, .2), rng.uniform(.65, .8), H * .28, H * .032, 2)
        fr = random.Random(rng.random())
        for q, a in tips:
            for j in range(leaves):
                b = a + j / leaves * math.tau + rng.uniform(-.2, .2)
                spindle(mesh, rng, q, aim(b, rng.uniform(.15, .55)), H * .27, H * .075, H * .01, 'leaf', u=6, v=3,
                        jitter=.08, shade=shade, flex=.8)
            ball(mesh, rng, q + UP * H * .03, (H * .05, H * .05, H * .035), c, shade, u=6, v=4)
            for j in range(1):
                ball(mesh, fr, q + UP * H * .06 + drift(fr, H * .015), (H * .08, H * .08, H * .04), c, None,
                     role='accent', jitter=.15, u=5, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- ti

def tiplant(height, canes, leaves):
    """Ti: a few bare upright canes of different heights, each ending in a
    fountain of long strap leaves -- the upper ones climbing, the outer ones
    arching out and down."""
    def build(mesh, rng):
        H = height
        for i in range(canes):
            h = H * (1.0, .85, .7, .6, .5)[i % 5] * .8
            base = drift(rng, .14)
            tip = base + UP * h + drift(rng, .12)
            bark_tube(mesh, rng, [base, base.lerp(tip, .5) + drift(rng, .03), tip], .03, .02, 5, shade=(.7, 1.0))
            L = H * .3
            for k in range(leaves):
                b = k * ct.GOLDEN + rng.uniform(-.2, .2)
                e = rng.uniform(.2, 1.25)
                st = tip - UP * rng.uniform(0, .12)
                d1 = aim(b, e)
                l1 = L * rng.uniform(.45, .55)
                spindle(mesh, rng, st, d1, l1, .14, .02, 'leaf', u=6, v=3, jitter=.05,
                        shade=lambda co, n: .8 + .25 * n.z, flex=.7)
                spindle(mesh, rng, st + d1 * l1 * .9, aim(b, e - .75), L * .5, .13, .02, 'leaf', u=6, v=3, jitter=.05,
                        shade=lambda co, n: .85 + .25 * n.z, flex=.9)
    return build


# ---------------------------------------------------------------- heliconia

def heliconia(height, leaves, spikes):
    """Heliconia: a clump of upright paddle leaves on long stalks, like a
    small banana, and upright flower stalks of red boat-shaped claws
    (accent) set alternately up a zig-zag rachis, their lips yellow (the
    bark role)."""
    def build(mesh, rng):
        H = height
        shade = lambda co, n: .78 + .3 * max(0, n.z) + .05 * co.z
        a0 = rng.uniform(0, math.tau)
        for k in range(leaves):
            b = a0 + k * ct.GOLDEN + rng.uniform(-.2, .2)
            base = drift(rng, .12)
            h = H * rng.uniform(.3, .55)
            top = base + heading(b) * H * .08 + UP * h
            bark_tube(mesh, rng, [base, base.lerp(top, .5), top], .022, .014, 4, shade=(.7, .95), role='leaf')
            e = rng.uniform(.95, 1.3)
            spindle(mesh, rng, top, aim(b, e), H * rng.uniform(.38, .5), H * .14, .03, 'leaf', u=8, v=4, jitter=.06,
                    shade=shade, flex=.8)
        for s in range(spikes):
            b = a0 + s * 2.4 + 1
            base = heading(b) * .1
            top = base + heading(b) * .12 + UP * H * rng.uniform(.5, .62)
            bark_tube(mesh, rng, [base, base.lerp(top, .5), top], .018, .014, 4, shade=(.75, .95), role='leaf')
            side = Vector((-math.sin(b), math.cos(b), 0))
            # Round 2: the lobster claw hangs -- a red rachis down from the
            # stalk's top, big claws zig-zagging down it, pointing up-out.
            n = 7
            bark_tube(mesh, rng, [top, top - UP * H * .035 * n + side * .02, top - UP * H * .07 * n], .012, .008, 4,
                      shade=(.9, 1.0), role='accent')
            for j in range(n):
                sg = 1 if j % 2 else -1
                p = top - UP * (j + .5) * H * .07 + side * sg * .02
                d = side * sg + UP * .6
                ln = H * (.2 - .012 * j)
                spindle(mesh, rng, p, d, ln, ln * .32, ln * .4, 'accent', u=5, v=4, jitter=.05,
                        shade=lambda co, n: .85 + .25 * max(0, n.z), flex=.8)
                tipp = p + d.normalized() * ln * .92
                orb(mesh, rng, tipp, (ln * .16, ln * .16, ln * .12), 'bark', u=5, v=3, jitter=.05, shade=1.05, flex=.9)
    return build


# ---------------------------------------------------------------- lava

def tint_since(mesh, n0, rgb):
    """Multiply the paint of every vertex added after `n0` by `rgb`."""
    for v in list(mesh.bm.verts)[n0:]:
        p = mesh.paint.get(v, (1, 1, 1, 0))
        mesh.paint[v] = (p[0] * rgb[0], p[1] * rgb[1], p[2] * rgb[2], p[3])


RUST = (1.25, .9, .75)
CLINK = (.72, .72, .76)


def aa(width, chunks):
    """An a'a clinker boulder: a dark core bristling with small sharp
    chunks of clinker stuck all over it (round 3: a core studded, not a pile
    of smooth blocks), some rust-brown, some black, rubble round its foot."""
    def build(mesh, rng):
        W = width
        rx, ry, rz = W * .34, W * .28, W * .24
        n0 = len(mesh.bm.verts)
        ct.hull_rock(mesh, rng, V0, (rx, ry, rz), points=11, bevel=0, seat=.15, shade_low=.5, shade_high=1.05)
        tint_since(mesh, n0, CLINK)
        mid = Vector((0, 0, rz * .85))
        for k in range(chunks):
            d = aim(k * ct.GOLDEN * 2 + rng.uniform(-.3, .3), rng.uniform(-.15, 1.2))
            q = mid + Vector((d.x * rx * .82, d.y * ry * .82, d.z * rz * .82))
            s = W * rng.uniform(.07, .13)
            n0 = len(mesh.bm.verts)
            ct.hull_rock(mesh, rng, q - UP * s * .5, (s, s * rng.uniform(.6, 1), s * rng.uniform(.6, 1.1)),
                         points=rng.randint(6, 7), bevel=0, seat=0, shade_low=.55, shade_high=1.12)
            tint_since(mesh, n0, RUST if rng.random() < .45 else CLINK)
        for k in range(8):
            n0 = len(mesh.bm.verts)
            q = heading(k / 8 * math.tau + rng.uniform(-.3, .3)) * W * rng.uniform(.42, .58)
            s = W * rng.uniform(.05, .09)
            ct.hull_rock(mesh, rng, q, (s, s, s * .8), points=6, bevel=0, seat=.2, shade_low=.55, shade_high=1.05)
            tint_since(mesh, n0, RUST if k % 2 else CLINK)
    return build


def pahoehoe(width, depth):
    """A pahoehoe slab: a low, smooth, billowed sheet of grey-black lava, its
    top wrinkled into ropes -- arcs bowed the way the flow went, laid on its
    surface (round 3) -- with a couple of toes budding off its edge."""
    def build(mesh, rng):
        W, D = width, depth
        rx, ry, rz = W * .5, D * .5, .3
        ct.pebble_rock(mesh, rng, V0, (rx, ry, rz), lumps=.1, seat=.3, subdiv=2, shade_low=.6, shade_high=1.1)
        z0 = -rz * .3 + rz * .35
        cx = -W * .9
        for i in range(9):
            rr = W * (.6 + .075 * i)
            runs, pts = [], []
            for k in range(25):
                a = -1.1 + 2.2 * k / 24
                x, y = cx + math.cos(a) * rr, math.sin(a) * rr * 1.1
                e2 = (x / rx) ** 2 + (y / ry) ** 2
                if e2 < .6:
                    pts.append(Vector((x, y, z0 + rz * math.sqrt(1 - e2) * .95)))
                elif pts:
                    runs.append(pts)
                    pts = []
            runs.append(pts)
            for pts in runs:
                if len(pts) >= 3:
                    mesh.add_tube(pts, [.035] * len(pts), 5, 'stone', rng=rng, wobble=.12, shade=lambda co, t: 1.35,
                                  flex=lambda co, t: 0)
        for k in range(2):
            a = rng.uniform(-.8, .8) + k * math.pi
            q = Vector((math.cos(a) * rx * .95, math.sin(a) * ry * .9, 0))
            ct.pebble_rock(mesh, rng, q, (W * .2, D * .2, .17), lumps=.1, seat=.3, shade_low=.6, shade_high=1.1)
    return build


MODELS = [
    ('Blender_Monkeypod_1', monkeypod(18, 34, 7, .0)),
    ('Blender_Monkeypod_2', monkeypod(15, 27, 6, .35)),
    ('Blender_Casuarina_1', casuarina(22, 14, 13)),
    ('Blender_CookPine_1', cookpine(38, 7, .15, 1.25)),
    ('Blender_Ohia_1', ohia(9, 8, 6)),
    ('Blender_Plumeria_1', plumeria(6, 6, 5)),
    ('Blender_TiPlant_1', tiplant(2.2, 5, 12)),
    ('Blender_Heliconia_1', heliconia(2.0, 8, 3)),
    ('Blender_LavaRock_1', aa(1.8, 16)),
    ('Blender_LavaRock_2', pahoehoe(2.6, 1.8)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'Monkeypod': '#4a4038', 'Casuarina': '#6a5a4e', 'CookPine': '#7a6e66', 'Ohia': '#7a7670',
        'Plumeria': '#8a8680', 'TiPlant': '#6e6050', 'Heliconia': '#e8c440'}
STONE = {'Blender_LavaRock_1': '#4a3a34', 'Blender_LavaRock_2': '#48464a'}
# Leaf, accent per season, from each spec's Seasons table. An accent with no
# flowers that season is drawn the leaf's colour. The ohia blooms year-round
# (spec: bloom); heliconia's spec puts its winter at the leaf green.
LOOK = {
    'Monkeypod': {'spring': ('#7a9a4a', '#d88aa8'), 'summer': ('#5a843c', '#d88aa8'), 'autumn': ('#5a843c', None),
                  'winter': ('#6a8a42', None)},
    'Casuarina': {'spring': ('#5e7a52', None), 'summer': ('#5a7650', None), 'autumn': ('#5a7650', None),
                  'winter': ('#58724e', None)},
    'CookPine': {'spring': ('#3f6a40', None), 'summer': ('#3d663e', None), 'autumn': ('#3d663e', None),
                 'winter': ('#3b623c', None)},
    'Ohia': {'spring': ('#5a7a4a', '#d8302a'), 'summer': ('#56764a', '#d8302a'), 'autumn': ('#56764a', '#d8302a'),
             'winter': ('#54724a', '#d8302a')},
    'Plumeria': {'spring': ('#5f8a3e', '#f6f0dc'), 'summer': ('#5a853a', '#f6f0dc'), 'autumn': ('#6a8a3e', '#f6f0dc'),
                 'winter': ('#6a8a3e', None)},
    'TiPlant': {'spring': ('#8a2e4a', None), 'summer': ('#8a2e4a', None), 'autumn': ('#8a2e4a', None),
                'winter': ('#8a2e4a', None)},
    'Heliconia': {'spring': ('#4f8a3e', '#d8302e'), 'summer': ('#4f8a3e', '#d8302e'), 'autumn': ('#4f8a3e', '#d8302e'),
                  'winter': ('#4f8a3e', None, '#5a9a44')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        if name in STONE:
            out[name] = {'stone': hexrgb(STONE[name])}
            continue
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(look[2] if len(look) > 2 else BARK[sp]), 'accent': hexrgb(look[1] or look[0])}
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.33, 0.35, 0.30),
                           'stone': (0.69, 0.63, 0.48)},
          far={'Blender_Monkeypod_1', 'Blender_Monkeypod_2', 'Blender_Casuarina_1', 'Blender_CookPine_1'},
          tints=tints(SEASON))
