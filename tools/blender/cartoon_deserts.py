# THE DESERTS PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what the Mojave, Desert Palms (Coachella) and the
# Chihuahuan lacked beside the Sonoran pack (cartoon_desert.py: saguaro,
# cholla, prickly pear, ocotillo, agave, palo verde, mesquite, ironwood,
# creosote, brittlebush) -- the Joshua tree, the Mojave and soaptree yuccas,
# the fan and date palms, the Aleppo pine, oleander, tamarisk, smoke tree,
# sotol, lechuguilla, desert willow, Emory oak, alligator juniper and the
# beavertail cactus.
#
#   node tools/blender/iterate.mjs cartoon_deserts <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid. The Joshua tree is a candelabra of shaggy forking arms each
# ending in a spiky ball; the yuccas are starbursts on shaggy stems; the fan
# palm a column with a dead-frond skirt under a round head of fans; the date
# palm a patterned post under a big stiff feather burst; the pine an open,
# leaning, crooked crown of separate puffs; oleander an upright mound of
# narrow-leaf tufts and flowers; tamarisk a weeping fountain of feathery
# plumes; smoke tree a bristly silver haze of twigs; sotol a fountain of
# ribbons; lechuguilla a colony of upcurving rosettes; desert willow an airy
# tree of hanging wisps on leaning stems; Emory oak an upright dense oak on a
# leaning stem; alligator juniper a massive checkered trunk under heavy limbs
# and broad flat blue-green masses; beavertail a low fan of flat pads.
#
# REFS joshuatree=Blender_JoshuaTree_1,Blender_JoshuaTree_2
# REFS mojaveyucca=Blender_MojaveYucca_1
# REFS fanpalm=Blender_FanPalm_1,Blender_FanPalm_2
# REFS datepalm=Blender_DatePalm_1,Blender_DatePalm_2
# REFS aleppopine=Blender_AleppoPine_1
# REFS oleander=Blender_Oleander_1
# REFS tamarisk=Blender_Tamarisk_1
# REFS smoketree=Blender_SmokeTree_1
# REFS soaptreeyucca=Blender_SoaptreeYucca_1
# REFS sotol=Blender_Sotol_1
# REFS lechuguilla=Blender_Lechuguilla_1
# REFS desertwillow=Blender_DesertWillow_1
# REFS emoryoak=Blender_EmoryOak_1
# REFS alligatorjuniper=Blender_AlligatorJuniper_1,Blender_AlligatorJuniper_2
# REFS beavertail=Blender_Beavertail_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
O = Vector((0, 0, 0))
X1 = Vector((1, 0, 0))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def at(pts, t):
    i = max(0, min(len(pts) - 1, int(round(t * (len(pts) - 1)))))
    return i, pts[i]


def tufts(mesh, rng, q, s, c, shade, squash=.75, jitter=.25):
    """A juniper mass (round 9): three small ragged lumps, not one smooth
    12-sided ball -- round 8's smooth clumps read as a broadleaf."""
    for k in range(3):
        a = k / 3 * math.tau + rng.uniform(-.4, .4)
        p = q + heading(a) * s * .45 + UP * s * squash * rng.uniform(-.2, .3)
        r = s * rng.uniform(.62, .76)
        olump(mesh, rng, p, (r, r, r * squash), X1, 'leaf', shade, c, flex=.8, u=7, v=4, jitter=.38, blend=.35)


def frame(d):
    """Unit d and two perpendiculars (u up-ish, s sideways), (u, s, d) right-handed."""
    d = d.normalized()
    s = d.cross(UP)
    if s.length < 1e-4:
        s = d.cross(Vector((1, 0, 0)))
    s.normalize()
    return d, s, s.cross(d)


def cone_dir(axis, theta, phi):
    d, s, u = frame(axis)
    return (d * math.cos(theta) + (u * math.cos(phi) + s * math.sin(phi)) * math.sin(theta)).normalized()


def clump(mesh, rng, q, s, c, shade, squash=.75, jitter=.12, flex=.8, tall=None, bottom=.3, role='leaf'):
    sz = s * squash if tall is None else s * tall
    mesh.add_lump(q, (s, s, sz), role, rng, subdiv=3, jitter=jitter, crown=c, blend=.85, shade=shade, flex=flex,
                  squash_bottom=bottom)


def spike(mesh, pts, w, role, m0=.8, m1=1.1, f0=.3, f1=.9, keel=1.0, power=.8):
    """A tapering three-sided blade along `pts` to a point: a yucca dagger, a
    sotol ribbon (keel < 1 flattens it into a channel), a dead leaf, a twig.
    (len(pts) - 2) * 6 + 3 triangles."""
    idx = mesh.slot(role)
    n = len(pts) - 1
    rings = []
    for i in range(n):
        t = i / n
        d, s, u = frame(pts[i + 1] - pts[i])
        r = w * (1 - t) ** power
        ring = [pts[i] + u * r * .3 + s * r, pts[i] - u * r * keel, pts[i] + u * r * .3 - s * r]
        vs = [mesh.bm.verts.new(p) for p in ring]
        m, f = m0 + (m1 - m0) * t, f0 + (f1 - f0) * t
        for v in vs:
            mesh.paint[v] = (m, m, m, f)
        rings.append(vs)
    tip = mesh.bm.verts.new(pts[-1])
    mesh.paint[tip] = (m1, m1, m1, f1)
    faces = []
    for a, b in zip(rings, rings[1:]):
        for k in range(3):
            k1 = (k + 1) % 3
            faces.append(mesh.bm.faces.new((a[k], a[k1], b[k1], b[k])))
    for k in range(3):
        faces.append(mesh.bm.faces.new((rings[-1][k], rings[-1][(k + 1) % 3], tip)))
    for f in faces:
        f.material_index = idx
        f.smooth = True


def olump(mesh, rng, q, radii, xdir, role, shade=None, c=None, flex=.6, u=8, v=5, jitter=.12, zup=UP, blend=.7):
    """A cheap jittered u-by-v lump (64 triangles at 8 x 5) turned so its
    local x runs along `xdir` and its z toward `zup`: a pad, a plume, a spray."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
    if ct.FAR:
        u, v = max(4, u // 2 + 1), 3
    X = xdir.normalized()
    Y = zup.cross(X)
    if Y.length < 1e-4:
        Y = Vector((0, 1, 0)).cross(X)
    Y.normalize()
    Z = X.cross(Y)
    rx, ry, rz = radii

    def put(lx, ly, lz):
        w = q + X * lx + Y * ly + Z * lz
        vt = mesh.bm.verts.new(w)
        n = (X * (lx / rx ** 2) + Y * (ly / ry ** 2) + Z * (lz / rz ** 2)).normalized()
        if c is not None:
            out = w - c
            out = out.normalized() if out.length > 1e-6 else UP
            n = (n * (1 - blend) + out * blend).normalized()
        mesh.normal[vt] = n
        m = shade(w, n) if shade else 1.0
        mesh.paint[vt] = (m, m, m, flex)
        return vt
    top = put(0, 0, rz)
    bot = put(0, 0, -rz)
    rings = []
    for i in range(1, v):
        phi = math.pi / 2 - i / v * math.pi
        ring = []
        for k in range(u):
            a = k / u * math.tau
            r = 1 + rng.uniform(-jitter, jitter)
            ring.append(put(math.cos(phi) * math.cos(a) * rx * r, math.cos(phi) * math.sin(a) * ry * r,
                            math.sin(phi) * rz * r))
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


def checker(sides, lo, hi, base=None):
    """Shade for add_tube that alternates light and dark plates by ring and
    side (add_tube paints a ring's vertices in order): interpolated, a lattice
    of diamonds -- the date palm's leaf bases, the juniper's alligator plates."""
    n = max(4, (sides + 1) // 2) if ct.FAR else sides
    calls = [0]

    def f(co, t):
        i = calls[0]
        calls[0] += 1
        ring, k = divmod(i, n)
        b = base(t) if base else 1.0
        return b * (hi if (ring + k) % 2 else lo)
    return f


def tube(mesh, rng, pts, radii, sides, role='bark', shade=(.78, 1.0), wobble=.06, flex=(.1, .5)):
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=shade if callable(shade) else (lambda co, t: shade[0] + (shade[1] - shade[0]) * t),
                  flex=lambda co, t: flex[0] + (flex[1] - flex[0]) * t)


# ---------------------------------------------------------------- yuccas

def rosette(mesh, rng, q, axis, n, L, w, open_ang, role='leaf', skirt=0, skirt_L=0.0, curve=0.0, core=0.0):
    """A ball of stiff dagger leaves round `axis` out to `open_ang` radians,
    and a skirt of dead leaves hanging under it (bark). `core` (round 3): a
    dark lump inside, a share of L, so a ball of thin daggers reads as a ball
    and not as a see-through starburst."""
    d0, s0, u0 = frame(axis)
    if core:
        r = L * core
        olump(mesh, rng, q + d0 * r * .4, (r, r, r * .9), X1, role,
              lambda p, n: .62 + .3 * max(0.0, n.z), flex=.5, jitter=.15, u=7, v=4)
    for k in range(n):
        f = (k + .5) / n
        th = open_ang * math.sqrt(f) + rng.uniform(-.08, .08)
        ph = k * ct.GOLDEN + rng.uniform(-.2, .2)
        d = cone_dir(axis, th, ph)
        l = L * rng.uniform(.8, 1.1)
        mid = q + d * l * .5 - UP * l * curve * .15
        end = q + d * l - UP * l * curve * .5
        spike(mesh, [q, mid, end], w, role, m0=.7, m1=1.15, f0=.4, f1=.95)
    for k in range(skirt):
        ph = k / skirt * math.tau + rng.uniform(-.3, .3)
        side = u0 * math.cos(ph) + s0 * math.sin(ph)
        b = q - d0 * skirt_L * .15 + side * w * 1.5
        d = (-UP * .85 + side * .5).normalized()
        l = skirt_L * rng.uniform(.75, 1.1)
        spike(mesh, [b, b + d * l * .5 + side * l * .08, b + d * l], w * 1.4, 'bark', m0=1.15, m1=.9, f0=.4, f1=.6)


def joshuatree(height, arms, splits, flowers):
    """Joshua tree: a stout shaggy trunk forking into a few thick shaggy arms
    that bend and fork again, every end a spiky ball of daggers over a skirt
    of dead leaves -- a candelabra, the Mojave's signature."""
    def build(mesh, rng):
        H = height
        S = H / 8
        pts, radii = ct.trunk(mesh, rng, O, H * .27, H * .06, lean=drift(rng, H * .03), steps=5, sides=8, flare=1.4,
                              bend=H * .02, shade_low=.75, shade_high=.95, wobble=.2)
        top = pts[-1]
        a0 = rng.uniform(0, math.tau)
        stack = []
        for i in range(arms):
            a = a0 + i / arms * math.tau + rng.uniform(-.4, .4)
            e = rng.uniform(.5, .95)
            stack.append((top, heading(a) * math.cos(e) + UP * math.sin(e), H * .18, radii[-1] * .85, 0))
        tips = []
        while stack:
            p, d, L, r, depth = stack.pop()
            mid = p + d * L * .5 + drift(rng, L * .1)
            d2 = (d + UP * rng.uniform(.2, .7)).normalized()
            end = mid + d2 * L * .5
            tube(mesh, rng, [p, mid, end], [r, r * .95, r * .9], 5, shade=(.8, .95), wobble=.22)
            if depth < splits and rng.random() < .75:
                az = math.atan2(d2.y, d2.x)
                for k in range(2):
                    b = az + (k - .5) * rng.uniform(1.2, 1.9)
                    e = rng.uniform(.25, .85)
                    stack.append((end, heading(b) * math.cos(e) + UP * math.sin(e), L * rng.uniform(.7, .85), r * .88,
                                  depth + 1))
            else:
                tips.append((end, d2))
        for j, (q, d) in enumerate(tips):
            ax = (d + UP).normalized()
            rosette(mesh, rng, q, ax, 17, .85 * S, .055 * S, 1.8, skirt=5, skirt_L=.8 * S, core=.36)
            if j < flowers:
                olump(mesh, rng, q + ax * .35 * S, (.12 * S, .12 * S, .2 * S), X1, 'accent', zup=UP)
    return build


def shaggy_stem(mesh, rng, pts, r, rings, per, L):
    """A yucca stem: a rough tube, dead leaves hanging round it in rings."""
    tube(mesh, rng, pts, [r * 1.2] + [r] * (len(pts) - 1), 6, shade=(.75, .95), wobble=.2)
    for j in range(rings):
        _, p = at(pts, .35 + .6 * j / max(1, rings - 1))
        for k in range(per):
            ph = k / per * math.tau + rng.uniform(-.3, .3) + j
            side = heading(ph)
            b = p + side * r
            d = (-UP * .8 + side * .45).normalized()
            l = L * rng.uniform(.7, 1.1)
            spike(mesh, [b, b + d * l * .5, b + d * l], r * .45, 'bark', m0=1.1, m1=.9, f0=.3, f1=.5)


def mojaveyucca(height, heads):
    """Mojave yucca: one to a few shaggy stems from the ground, each carrying
    a big starburst of long stiff daggers."""
    def build(mesh, rng):
        H = height
        a0 = rng.uniform(0, math.tau)
        for i in range(heads):
            a = a0 + i / heads * math.tau + rng.uniform(-.3, .3)
            h = H * (.6 if i == 0 else rng.uniform(.3, .6))
            out = heading(a) * (0 if i == 0 else H * rng.uniform(.18, .3))
            pts = [out * .1, out * .5 + UP * h * .35, out * .9 + UP * h * .7, out + UP * h]
            shaggy_stem(mesh, rng, pts, .1 * H / 3, 3, 6, .45)
            rosette(mesh, rng, pts[-1], (UP * 2 + heading(a) * .5).normalized(), 34, H * .27, .035, 1.6, core=.3,
                    skirt=8, skirt_L=.55)
            if i == 0:
                olump(mesh, rng, pts[-1] + UP * H * .2, (.12, .12, .28), X1, 'accent', zup=UP)
    return build


def soaptreeyucca(height, stems):
    """Soaptree yucca: slender shaggy trunks, each topped by a round ball of
    thin leaves; a tall cream flower stalk out of the tallest."""
    def build(mesh, rng):
        H = height
        a0 = rng.uniform(0, math.tau)
        for i in range(stems):
            a = a0 + i * 2.4
            h = H * (.62 if i == 0 else rng.uniform(.38, .5))
            out = heading(a) * (H * .04 if i == 0 else H * .14)
            pts = [O, out * .4 + UP * h * .4, out * .8 + UP * h * .75, out + UP * h]
            shaggy_stem(mesh, rng, pts, .13, 5, 8, .5)
            rosette(mesh, rng, pts[-1], UP, 80, .85, .028, 2.75, skirt=12, skirt_L=1.0, core=.42)
            if i == 0:
                st = [pts[-1], pts[-1] + UP * H * .25 + drift(rng, .1), pts[-1] + UP * H * .45 + drift(rng, .2)]
                tube(mesh, rng, st, [.035, .025, .015], 5, shade=(.9, 1.05))
                for k in range(9):
                    t = .45 + .55 * k / 8
                    p = st[1].lerp(st[2], (t - .45) / .55) if t > .5 else st[1]
                    p = p + heading(k * 2.3) * .12 * (1.1 - t)
                    olump(mesh, rng, p, (.13 * (1.2 - t), .13 * (1.2 - t), .16), X1, 'accent', u=6, v=4,
                          zup=UP)
    return build


# ---------------------------------------------------------------- palms

def fan(mesh, base, d, roll, R, segs, droop, m):
    """A palm fan leaf (both faces): a 200-degree blade on the end of its
    stalk, pleated, its segment tips notched and hanging."""
    d, s, u = frame(d)
    nrm = u * math.cos(roll) + s * math.sin(roll)
    side = nrm.cross(d)
    opening = math.radians(200)
    inner, outer = [], []
    for k in range(segs + 1):
        a = -opening / 2 + opening * k / segs
        dirk = d * math.cos(a) + side * math.sin(a)
        pleat = nrm * R * (.07 if k % 2 else -.05)
        hang = abs(math.sin(a)) * .5 + .5
        # Round 4: deep splits between the segments (odd rim points pulled in
        # to 0.58) and the segment tips hanging -- a spiky fan, not a disc.
        tip = k % 2 == 0
        inner.append(base + dirk * R * .5 + pleat - UP * droop * R * .12 * hang)
        outer.append(base + dirk * R * (1 if tip else .58) + pleat * 1.4
                     - UP * R * (droop * .55 * hang + (.22 if tip else 0)))
    for flip in (False, True):
        for k in range(segs):
            for poly, shade in (((base, inner[k], inner[k + 1]), m * .9), ((inner[k], outer[k], outer[k + 1], inner[k + 1]), m)):
                f = mesh.face(list(reversed(poly)) if flip else list(poly), 'leaf', smooth=True)
                for vt in f.verts:
                    mesh.paint[vt] = (shade, shade, shade, .7)


def fanpalm(height, skirt, fans):
    """California fan palm: a thick grey column, a skirt of dead fronds
    hanging from under the head (`skirt` 0..1 of the trunk it covers), and a
    round head of big green fans on long stalks."""
    def build(mesh, rng):
        H = height
        n = 10
        lean = drift(rng, H * .015)
        pts = [UP * H * .9 * k / n + lean * (k / n) ** 2 for k in range(n + 1)]
        radii = [H * .024 * (1.35 if k == 0 else 1 - .12 * k / n) for k in range(n + 1)]
        mesh.add_tube(pts, radii, 10, 'bark', rng=rng, wobble=.03, shade=checker(10, .82, .96),
                      flex=lambda co, t: .15 * t * t)
        top = pts[-1]
        if skirt > 0:
            z0 = H * .9 * (1 - skirt)
            rings = []
            m = 6
            sides = 8 if ct.FAR else 18
            for i in range(m + 1):
                t = i / m
                z = z0 + (top.z - z0) * t
                # Round 4: wider, swelling to the head, ridged (every other
                # column pushed out) and a deep ragged hem: thatch.
                rr = H * .062 * (1.0 + .45 * t) if i < m else H * .05
                ring = []
                for k in range(sides):
                    a = k / sides * math.tau
                    jag = rng.uniform(-1.0, .3) * H * .03 if i == 0 else 0
                    flare = H * .014 if i == 0 else 0
                    ridge = (1.08 if k % 2 else .96) * (1 + rng.uniform(-.04, .04))
                    ring.append(lean * (z / (H * .9)) ** 2 + Vector((math.cos(a) * (rr * ridge + flare),
                                                                     math.sin(a) * (rr * ridge + flare), z + jag)))
                rings.append(ring)
            made = mesh.ring_strip(rings, 'accent', smooth=True)
            for i, ring in enumerate(made):
                for k, vt in enumerate(ring):
                    mm = (.78 if k % 2 else 1.0) * (.85 + .25 * i / m)
                    mesh.paint[vt] = (mm, mm, mm, .2)
        c = top + UP * H * .03
        for i in range(fans):
            f = (i + .5) / fans
            e = math.radians(60 - 105 * f) + rng.uniform(-.1, .1)
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            d = heading(a) * math.cos(e) + UP * math.sin(e)
            L = H * .075
            end = c + d * L
            spike(mesh, [c, c + d * L * .5, end], H * .006, 'leaf', m0=.7, m1=.9, f0=.4, f1=.6, power=.3)
            fan(mesh, end, d, rng.uniform(-1.2, 1.2), H * .12, 6 if ct.FAR else 12, .4 + .6 * f, .75 + .4 * (1 - f))
    return build


def frond(mesh, rng, base, d, L, bend, width):
    """A stiff feather frond: a rachis nearly straight with a little arch,
    stiff leaflets either side rising in a V."""
    d, s, u = frame(d)
    n = 4 if ct.FAR else 8
    pts = [base + d * L * (k / n) - UP * L * bend * (k / n) ** 2 for k in range(n + 1)]
    for k in range(1, n + 1):
        a, b = pts[k - 1], pts[k]
        t = k / n
        w = width * math.sin(math.pi * min(1, t * 1.05)) ** .6 + .05
        step = (b - a) * 1.5
        for sgn in (-1, 1):
            tip = a + step + s * sgn * w + UP * w * .45
            mid = a.lerp(tip, .5) + (b - a) * .3
            f = mesh.face([a, b, tip, mid], 'leaf')
            for vt in f.verts:
                m = .65 + .45 * t
                mesh.paint[vt] = (m, m, m, .4 + .5 * t)


def datepalm(height, fronds, clusters):
    """Date palm: a thick column of diamond leaf-base scars, a collar of old
    frond bases, a big burst of stiff grey-green feather fronds, and orange
    date bunches hanging under it (accent)."""
    def build(mesh, rng):
        H = height
        n = 10 if ct.FAR else 26
        lean = drift(rng, H * .03)
        pts = [UP * H * .78 * k / n + lean * (k / n) ** 2 for k in range(n + 1)]
        radii = [H * .032 * (1.3 if k == 0 else 1 - .1 * k / n) for k in range(n + 1)]
        mesh.add_tube(pts, radii, 12, 'bark', rng=rng, wobble=.04, shade=checker(12, .7, 1.05),
                      flex=lambda co, t: .15 * t * t)
        top = pts[-1]
        r = radii[-1]
        tube(mesh, rng, [top - UP * H * .05, top, top + UP * H * .04], [r * 1.1, r * 1.6, r * 1.2], 10,
             shade=(.7, .85), wobble=.2)
        c = top + UP * H * .04
        for i in range(fronds):
            f = (i + .5) / fronds
            e = math.radians(78 - 125 * f) + rng.uniform(-.08, .08)
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            d = heading(a) * math.cos(e) + UP * math.sin(e)
            frond(mesh, rng, c, d, H * rng.uniform(.3, .34), .15 + .4 * f * f, H * .05)
        for j in range(clusters):
            a = j / clusters * math.tau + rng.uniform(-.3, .3)
            p0 = c - UP * H * .02
            p1 = p0 + heading(a) * H * .05 - UP * H * .02
            p2 = p1 + heading(a) * H * .015 - UP * H * .05
            spike(mesh, [p0, p1, p2], .04, 'bark', m0=.9, m1=1.0)
            for k in range(3):
                q = p1.lerp(p2, .4 + .3 * k) + drift(rng, .15)
                olump(mesh, rng, q, (H * .014, H * .014, H * .02), X1, 'accent', u=6, v=4, zup=UP)
    return build


# ---------------------------------------------------------------- trees

def aleppopine(height, spread):
    """Aleppo pine: a leaning crooked trunk, a few long crooked limbs, an open
    irregular rounded crown of separate flattened needle puffs with sky
    between."""
    def build(mesh, rng):
        H, R = height, spread * .5
        lean = heading(rng.uniform(0, math.tau)) * H * .06
        pts, radii = ct.trunk(mesh, rng, O, H * .6, H * .03, lean=lean, steps=7, sides=8, flare=1.4, bend=H * .04,
                              shade_low=.75, shade_high=.95)
        c = Vector((lean.x * .8, lean.y * .8, H * .74))
        shade = ct.crown_shade(c, (R, R, H * .3), low=.5, high=1.18)
        a0 = rng.uniform(0, math.tau)
        for j in range(6):
            f = j / 5
            i, p = at(pts, .45 + .55 * f)
            a = a0 + j * 2.3 + rng.uniform(-.3, .3)
            d = heading(a)
            L = R * rng.uniform(.8, 1.0) * (1.05 - .3 * f)
            k1 = p + d * L * .45 + UP * L * rng.uniform(.25, .5) + drift(rng, L * .15)
            end = k1 + d * L * .5 + UP * L * rng.uniform(.3, .6)
            ct.limb(mesh, rng, p, k1, radii[i] * .55, radii[i] * .35, sides=5, bow=.05)
            ct.limb(mesh, rng, k1, end, radii[i] * .35, radii[i] * .15, sides=4, bow=-.1)
            s = R * rng.uniform(.3, .36)
            tufts(mesh, rng, end + UP * s * .3, s, c, shade, squash=.7)
            s2 = s * .75
            tufts(mesh, rng, end + d * s2 * .9 - UP * s2 * .1 + drift(rng, s2 * .4), s2, c, shade, squash=.7)
            tufts(mesh, rng, k1 + UP * s2 * .6 + drift(rng, s2 * .3), s2 * .9, c, shade, squash=.7)
        s = R * .34
        tufts(mesh, rng, pts[-1] + UP * s * .5, s, c, shade, squash=.7)
        # Round 3: puffs through the crown's upper body, so the outline is a
        # full irregular round head, not shelves.
        for k in range(10):
            a = a0 + k / 10 * math.tau + .4
            q = c + heading(a) * R * rng.uniform(.35, .55) + UP * H * rng.uniform(.05, .2)
            tufts(mesh, rng, q, R * rng.uniform(.3, .36), c, shade, squash=.7)
    return build


def emoryoak(height, spread):
    """Emory oak: a dark leaning stem, short limbs up into a dense upright
    crown of small leathery clumps, broadest near the top, lumpy and
    fine-edged, a few notches."""
    def build(mesh, rng):
        H, R = height, spread * .5
        lean = heading(rng.uniform(0, math.tau)) * H * .08
        pts, radii = ct.trunk(mesh, rng, O, H * .24, H * .045, lean=lean, steps=5, sides=8, flare=1.5, bend=H * .03,
                              shade_low=.7, shade_high=.9)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .6))
        shade = ct.crown_shade(c, (R, R, H * .36), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        for j in range(4):
            a = a0 + j / 4 * math.tau + rng.uniform(-.3, .3)
            end = top + heading(a) * R * .55 + UP * H * rng.uniform(.15, .3)
            ct.limb(mesh, rng, top - UP * H * .04, end, radii[-1] * .7, radii[-1] * .3, sides=5, bow=.08)
        # Round 3: a deep dense crown from low on the short trunk to the top,
        # wider than tall, of small clumps, with four lobes pushed out low at
        # the rim so the outline is lumpy, not an egg.
        for k in range(26):
            y = 1 - (k + .5) / 26 * 1.5
            rr = math.sqrt(max(0.0, 1 - y * y))
            a = k * ct.GOLDEN + rng.uniform(-.3, .3)
            q = c + Vector((math.cos(a) * rr * R * .8, math.sin(a) * rr * R * .8, y * H * .32))
            s = R * rng.uniform(.2, .26)
            clump(mesh, rng, q, s, c, shade, squash=.75, jitter=.22)
        for k in range(4):
            a = a0 + k / 4 * math.tau + .6
            q = c + heading(a) * R * .85 - UP * H * rng.uniform(.0, .12)
            clump(mesh, rng, q, R * .22, c, shade, squash=.7, jitter=.22)
    return build


def alligatorjuniper(height, spread, limbs, snag):
    """Alligator juniper: a massive short trunk of checkered plates, heavy
    crooked limbs out and up, broad flat dense blue-green masses on their
    ends with gaps, and a silver dead snag."""
    def build(mesh, rng):
        H, R = height, spread * .5
        n = 7
        lean = drift(rng, H * .05)
        pts = [UP * H * .2 * k / n + lean * (k / n) ** 2 for k in range(n + 1)]
        radii = [H * .05 * (1 - .3 * k / n) * (1 + .9 * math.exp(-k / n * 10)) for k in range(n + 1)]
        mesh.add_tube(pts, radii, 12, 'bark', rng=rng, wobble=.1, shade=checker(12, .72, 1.02),
                      flex=lambda co, t: .1 * t)
        top = pts[-1]
        r = radii[-1]
        c = Vector((top.x, top.y, H * .55))
        shade = ct.crown_shade(c, (R, R, H * .32), low=.45, high=1.18)
        a0 = rng.uniform(0, math.tau)
        for j in range(limbs):
            a = a0 + j / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            reach = R * rng.uniform(.5, .95)
            rise = H * rng.uniform(.3, .5)
            k1 = top + d * reach * .4 + UP * rise * .5 + drift(rng, reach * .2)
            end = top + d * reach + UP * rise
            ct.limb(mesh, rng, top - UP * H * .03, k1, r * .6, r * .4, sides=7, bow=.05)
            ct.limb(mesh, rng, k1, end, r * .4, r * .18, sides=5, bow=-.1)
            for q, s in ((end, R * .3), (k1 + d * R * .1 + UP * H * .08, R * .24)):
                tufts(mesh, rng, q + UP * s * .15, s, c, shade, squash=.75, jitter=.25)
                tufts(mesh, rng, q + d * s * .7 - UP * s * .15 + drift(rng, s * .3), s * .75, c, shade, squash=.75,
                      jitter=.25)
                tufts(mesh, rng, q - d * s * .6 + UP * s * .35 + drift(rng, s * .3), s * .7, c, shade, squash=.75,
                      jitter=.25)
            # Round 3: a mass hanging on the limb's lower half too, so the
            # crown has depth and is not plates on stilts.
            q = top.lerp(k1, .8) + d * R * .15 - UP * H * .07
            tufts(mesh, rng, q, R * .22, c, shade, squash=.8, jitter=.25)
        for k in range(3):
            q = c + heading(a0 + k * 2.1 + .9) * R * .3 + UP * H * rng.uniform(.0, .15)
            tufts(mesh, rng, q, R * .26, c, shade, squash=.8, jitter=.25)
        if snag:
            a = a0 + .5
            sn = top + heading(a) * R * .3 + UP * H * .62
            ct.limb(mesh, rng, top, sn, r * .35, r * .08, sides=5, bow=.1, shade=1.35)
            ct.limb(mesh, rng, sn - UP * H * .15, sn + heading(a + 1.2) * R * .25 + UP * H * .05, r * .12, r * .04,
                    sides=4, bow=.1, shade=1.35)
    return build


# ---------------------------------------------------------------- shrubs and small trees

def oleander(height, spread):
    """Oleander: a few stems under a dense upright mound of narrow-leaf tufts,
    pink flower heads dotted over its top and sides."""
    def build(mesh, rng):
        H, R = height, spread * .5
        for k in range(9):
            a = k / 9 * math.tau + rng.uniform(-.2, .2)
            lo = heading(a) * .08
            hi = heading(a) * R * rng.uniform(.4, .6) + UP * H * rng.uniform(.55, .7)
            tube(mesh, rng, [lo, lo.lerp(hi, .5) + drift(rng, .1), hi], [.04, .03, .02], 4)
        c = Vector((0, 0, H * .62))
        shade = ct.crown_shade(c, (R, R, H * .4), low=.45, high=1.15)
        tops = []
        for ring, (rr, zz, n, ss) in enumerate(((.6, .28, 5, .2), (.62, .62, 8, .27), (.28, .84, 4, .27))):
            off = rng.uniform(0, 1)
            for i in range(n):
                a = (i + off) / n * math.tau
                s = R * ss * rng.uniform(.9, 1.1)
                q = heading(a) * R * rr + UP * H * zz * rng.uniform(.95, 1.05)
                clump(mesh, rng, q, s, c, shade, tall=1.35, jitter=.2)
                if ring or i % 2 == 0:
                    tops.append(q + UP * s * 1.1 + heading(a) * s * .3)
        for q in tops:
            for k in range(2):
                olump(mesh, rng, q + drift(rng, .25) + UP * k * .05, (.16, .16, .11), X1, 'accent', u=6, v=4,
                      zup=UP)
    return build


def tamarisk(height, spread):
    """Tamarisk: several leaning red-brown stems arching out, every branch
    ending in long feathery grey-green plumes that weep outward and down, pink
    flower plumes at the upper tips -- a soft weeping fountain."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = Vector((0, 0, H * .55))
        shade = ct.crown_shade(c, (R, R, H * .45), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        for k in range(4):
            a = a0 + k / 4 * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            base = d * .15
            mid = d * R * .3 + UP * H * .45
            tube(mesh, rng, [base, base.lerp(mid, .5) + drift(rng, .2), mid], [.08, .06, .045], 5)
            for b in range(2):
                bd = heading(a + (b - .5) * .9)
                end = mid + bd * R * rng.uniform(.4, .55) + UP * H * rng.uniform(.2, .35)
                tube(mesh, rng, [mid, mid.lerp(end, .5) + UP * .3, end], [.04, .03, .02], 4)
        # Round 5: one dense soft mass (rounds 3-4's clumps on branch ends,
        # with gaps, read as paddle leaves): many small jittery lumps on a
        # vase-shaped shell, widest high, weeping at the rim, so the outline
        # is a feathery fountain; thin plumes hang from the rim and pink
        # plumes stand on top.
        for k in range(26):
            y = .95 - (k + .5) / 26 * 1.6
            rr = math.sqrt(max(0.0, 1 - y * y)) * (.75 + .25 * (y + 1) / 2)
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            q = c + Vector((math.cos(a) * rr * R * .8, math.sin(a) * rr * R * .8, y * H * .38))
            s = rng.uniform(.5, .65) * R / 2.75
            olump(mesh, rng, q, (s, s, s * .85), X1, 'leaf', shade, c, flex=.85, jitter=.3)
        for k in range(18):
            a = k / 18 * math.tau + rng.uniform(-.15, .15)
            q = c + heading(a) * R * .85 + UP * H * rng.uniform(-.1, .12)
            dd = (heading(a) - UP * rng.uniform(.6, 1.4)).normalized()
            L = rng.uniform(.5, .75)
            olump(mesh, rng, q + dd * L * .5, (L, .14, .12), dd, 'leaf', shade, c, flex=.9, u=6, v=4, jitter=.2)
        for k in range(18):
            y = 1 - (k + .5) / 18 * .9
            rr = math.sqrt(max(0.0, 1 - y * y))
            a = k * ct.GOLDEN + .5
            out = Vector((math.cos(a) * rr, math.sin(a) * rr, y))
            q = c + Vector((out.x * R * .85, out.y * R * .85, out.z * H * .4))
            up = (out + UP * .6).normalized()
            olump(mesh, rng, q + up * .2, (.38, .12, .12), up, 'accent', flex=.9, u=6, v=4, jitter=.2)
    return build


def smoketree(height, spread):
    """Smoke tree: a few short stems into an intricate tangle of spiny silver
    twigs, a thin silver haze over it with twigs poking out, indigo flowers
    speckled on top (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = Vector((0, 0, H * .55))
        shade = ct.crown_shade(c, (R, R, H * .45), low=.6, high=1.15)
        a0 = rng.uniform(0, math.tau)
        stack = []
        for k in range(4):
            a = a0 + k / 4 * math.tau
            p = heading(a) * R * .3 + UP * H * .3
            tube(mesh, rng, [heading(a) * .08, p], [.08, .05], 5, shade=(.9, 1.05))
            stack.append((p, (heading(a) * .6 + UP).normalized(), R * .45, 0))
        while stack:
            p, d, L, depth = stack.pop()
            end = p + d * L
            spike(mesh, [p, p.lerp(end, .5) + drift(rng, L * .1), end], .035 / (depth + 1), 'bark', m0=.95, m1=1.15,
                  f0=.3, f1=.8, power=.4)
            if depth < 3:
                for k in range(3):
                    nd = (d + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-.3, .6)))).normalized()
                    stack.append((p.lerp(end, rng.uniform(.6, 1)), nd, L * .62, depth + 1))
        # Round 3: many small overlapping puffs (cheap lumps) -- one haze,
        # not a bunch of balls.
        for k in range(24):
            y = .9 - (k + .5) / 24 * 1.55
            rr = math.sqrt(max(0.0, 1 - y * y))
            a = k * ct.GOLDEN
            q = c + Vector((math.cos(a) * rr * R * .74, math.sin(a) * rr * R * .74, y * H * .36))
            s = R * rng.uniform(.18, .23)
            olump(mesh, rng, q, (s, s, s * .8), X1, 'leaf', shade, c, flex=.8, jitter=.35)
        for k in range(26):
            y = 1 - (k + .5) / 26 * 1.1
            rr = math.sqrt(max(0.0, 1 - y * y))
            a = k * ct.GOLDEN + 1
            q = c + Vector((math.cos(a) * rr * R * .88, math.sin(a) * rr * R * .88, y * H * .44))
            olump(mesh, rng, q, (.08, .08, .07), X1, 'accent', u=6, v=4, jitter=.3, zup=UP)
    return build


def desertwillow(height, spread):
    """Desert willow: three leaning crooked stems, thin branches arching out,
    every end a loose spray of long narrow hanging leaves with sky between,
    pink trumpet flowers at the tips (accent)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = Vector((0, 0, H * .62))
        shade = ct.crown_shade(c, (R, R, H * .35), low=.5, high=1.15)
        a0 = rng.uniform(0, math.tau)
        ends = []
        for k in range(3):
            a = a0 + k / 3 * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            k1 = d * R * .2 + UP * H * .35 + drift(rng, .3)
            k2 = d * R * .35 + UP * H * .55
            tube(mesh, rng, [d * .05, k1, k2], [.1, .07, .05], 6)
            for b in range(3):
                bd = heading(a + (b - 1) * .9 + rng.uniform(-.2, .2))
                # Round 7: the middle branch climbs, the outer ones reach out
                # lower -- a rounded irregular crown, not round 6's flat
                # umbrella of clusters all at one height.
                if b == 1:
                    end = k2 + bd * R * rng.uniform(.15, .3) + UP * H * rng.uniform(.3, .38)
                else:
                    end = k2 + bd * R * rng.uniform(.5, .65) + UP * H * rng.uniform(.0, .15)
                tube(mesh, rng, [k2, k2.lerp(end, .5) + UP * .3, end], [.035, .025, .015], 4)
                ends.append((end, bd))
        for j, (end, bd) in enumerate(ends):
            # Round 2: a loose round cluster of small drooping wisps a metre
            # across, not four paddles.
            # Round 4: a soft round body on each end (round 3's flat lump read
            # as a paddle leaf), wisps hanging out of it.
            # Round 5: the body is three small lumps round the end -- an
            # irregular cluster a metre and a half across, sky between the
            # clusters; one round clump still read as a single big leaf.
            for p in range(4):
                q = end + Vector((rng.uniform(-.55, .55), rng.uniform(-.55, .55), rng.uniform(-.3, .25)))
                s = rng.uniform(.42, .56)
                olump(mesh, rng, q, (s, s, s * .8), X1, 'leaf', shade, c, flex=.85, jitter=.28, blend=.45)
            for p in range(2):
                dd = (bd * rng.uniform(.2, .8) - UP * rng.uniform(.5, 1.2) + drift(rng, .7)).normalized()
                L = rng.uniform(.3, .45)
                q = end + Vector((rng.uniform(-.5, .5), rng.uniform(-.5, .5), rng.uniform(-.25, .35)))
                olump(mesh, rng, q + dd * L * .5, (L, .12, .09), dd, 'leaf', shade, c, flex=.85, u=6, v=4, jitter=.2)
            if True:
                for k in range(2):
                    olump(mesh, rng, end + UP * .42 + drift(rng, .5), (.12, .08, .08), (bd + UP).normalized(), 'accent',
                          u=6, v=4)
    return build


def sotol(height, leaves, stalk):
    """Sotol: a dense round fountain of long thin ribbon leaves arching out
    and down at their tips; a tall thin stalk, its top a narrow cream spike."""
    def build(mesh, rng):
        H = height
        for k in range(leaves):
            f = (k + .5) / leaves
            e = math.radians(85 - 75 * f) + rng.uniform(-.08, .08)
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            d = heading(a)
            L = H * rng.uniform(1.05, 1.35)
            b = d * .06 + UP * .05
            pts = []
            for i in range(4):
                t = i / 3
                pts.append(b + d * L * t * math.cos(e) + UP * L * (t * math.sin(e) - (.25 + .35 * f) * t * t))
            spike(mesh, pts, .036, 'leaf', m0=.65, m1=1.15, f0=.3, f1=.9, keel=.35, power=.6)
        olump(mesh, rng, UP * H * .3, (H * .32, H * .32, H * .3), X1, 'leaf', lambda p, n: .6 + .3 * max(0.0, n.z),
              flex=.4, jitter=.12)
        if stalk:
            st = [O, UP * stalk * .5 + drift(rng, .05), UP * stalk + drift(rng, .12)]
            tube(mesh, rng, st, [.05, .035, .02], 5, shade=(.9, 1.05))
            for k in range(8):
                t = .55 + .45 * k / 7
                p = st[1].lerp(st[2], (t - .5) / .5)
                olump(mesh, rng, p + heading(k * 2.4) * .04, (.1, .1, .2), X1, 'accent', u=6, v=4,
                      zup=UP)
    return build


def lechuguilla(height, rosettes, stalk):
    """Lechuguilla: a colony of small rosettes of stiff leaves curving up and
    in, one tall thin flower stalk, its upper half set with yellow-red flower
    clusters (accent)."""
    def build(mesh, rng):
        H = height
        a0 = rng.uniform(0, math.tau)
        for j in range(rosettes):
            f0 = 1.0 if j == 0 else rng.uniform(.6, .85)
            base = O if j == 0 else heading(a0 + j / (rosettes - 1) * math.tau) * rng.uniform(.4, .55)
            for k in range(15):
                a = k * ct.GOLDEN + rng.uniform(-.2, .2)
                d = heading(a)
                e = math.radians(rng.uniform(52, 82))
                L = H * f0 * rng.uniform(.95, 1.25)
                pts = [base + d * .03]
                p, dd = pts[0], d * math.cos(e) + UP * math.sin(e)
                for i in range(3):
                    p = p + dd * L / 3
                    pts.append(p)
                    dd = (dd + UP * .35 - d * .1).normalized()
                spike(mesh, pts, .045 * f0, 'leaf', m0=.65, m1=1.15, f0=.2, f1=.6, keel=.6, power=.9)
        if stalk:
            st = [O, UP * stalk * .5 + drift(rng, .06), UP * stalk + drift(rng, .15)]
            tube(mesh, rng, st, [.035, .025, .012], 5, shade=(.9, 1.05))
            for k in range(10):
                t = .45 + .55 * k / 9
                p = st[0].lerp(st[1], t / .5) if t < .5 else st[1].lerp(st[2], (t - .5) / .5)
                olump(mesh, rng, p + heading(k * 2.4) * .06, (.07, .07, .1), X1, 'accent', u=6, v=4,
                      zup=UP)
    return build


def beavertail(width, pads):
    """Beavertail cactus: a low clump of broad flat blue-grey pads fanning
    from the ground, a few set on the rims of others, magenta cup flowers on
    the upper edges (accent)."""
    def build(mesh, rng):
        W = width
        a0 = rng.uniform(0, math.tau)
        rims = []
        for k in range(pads):
            a = a0 + k / pads * math.tau + rng.uniform(-.25, .25)
            out = heading(a)
            tang = heading(a + math.pi / 2)
            tilt = rng.uniform(.6, 1.0)
            zup = (UP * math.cos(tilt) + out * math.sin(tilt)).normalized()
            h = W * rng.uniform(.13, .16)
            q = out * W * .12 + zup * h * .9
            olump(mesh, rng, q, (h * .75, h * .14, h), tang, 'leaf', lambda w, n: .75 + .5 * min(1, w.z / (W * .3)),
                  flex=.0, u=10, v=6, jitter=.04, zup=zup)
            rims.append((q + zup * h * .85, zup, out, h))
        for k in range(2):
            a = a0 + k * math.pi + .8
            tang = heading(a + math.pi / 2)
            h = W * .14
            olump(mesh, rng, heading(a) * W * .04 + UP * h * .95, (h * .75, h * .14, h), tang, 'leaf',
                  lambda w, n: .75 + .5 * min(1, w.z / (W * .3)), flex=.0, u=10, v=6, jitter=.04, zup=UP)
        for j, (q, zup, out, h) in enumerate(rims):
            if j % 2 == 0:
                tang = heading(math.atan2(out.y, out.x) + math.pi / 2 + rng.uniform(-.6, .6))
                z2 = (zup + out * .3).normalized()
                h2 = h * .8
                q2 = q + z2 * h2 * .85
                olump(mesh, rng, q2, (h2 * .75, h2 * .14, h2), tang, 'leaf',
                      lambda w, n: .75 + .5 * min(1, w.z / (W * .3)), flex=.0, u=10, v=6, jitter=.04, zup=z2)
                for k in range(2):
                    olump(mesh, rng, q2 + z2 * h2 * .95 + tang * h2 * (k - .5) * .7, (.032, .032, .028), X1, 'accent',
                          u=6, v=4, zup=UP)
            else:
                olump(mesh, rng, q + zup * h * .1, (.032, .032, .028), X1, 'accent', u=6, v=4, zup=UP)
    return build


MODELS = [
    ('Blender_JoshuaTree_1', joshuatree(8, 4, 2, 3)),
    ('Blender_JoshuaTree_2', joshuatree(6, 3, 1, 1)),
    ('Blender_MojaveYucca_1', mojaveyucca(3, 5)),
    ('Blender_FanPalm_1', fanpalm(18, .55, 20)),
    ('Blender_FanPalm_2', fanpalm(15, .12, 18)),
    ('Blender_DatePalm_1', datepalm(16, 46, 5)),
    ('Blender_DatePalm_2', datepalm(11, 42, 4)),
    ('Blender_AleppoPine_1', aleppopine(13, 10)),
    ('Blender_Oleander_1', oleander(3.2, 3.4)),
    ('Blender_Tamarisk_1', tamarisk(6, 5.5)),
    ('Blender_SmokeTree_1', smoketree(5, 5.5)),
    ('Blender_SoaptreeYucca_1', soaptreeyucca(5, 2)),
    ('Blender_Sotol_1', sotol(1.2, 90, 4)),
    ('Blender_Lechuguilla_1', lechuguilla(.42, 4, 2.6)),
    ('Blender_DesertWillow_1', desertwillow(6, 6)),
    ('Blender_EmoryOak_1', emoryoak(9, 10)),
    ('Blender_AlligatorJuniper_1', alligatorjuniper(11, 11, 4, True)),
    ('Blender_AlligatorJuniper_2', alligatorjuniper(8.5, 8, 3, True)),
    ('Blender_Beavertail_1', beavertail(1.0, 7)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'JoshuaTree': '#8a7a62', 'MojaveYucca': '#8a7a60', 'FanPalm': '#8a8478', 'DatePalm': '#7a6450',
        'AleppoPine': '#7a7068', 'Oleander': '#6a5a48', 'Tamarisk': '#7a4a38', 'SmokeTree': '#9a9c98',
        'SoaptreeYucca': '#8a7c62', 'Sotol': '#a89a70', 'Lechuguilla': '#8a7a50', 'DesertWillow': '#6a5644',
        'EmoryOak': '#2e2a28', 'AlligatorJuniper': '#8a8580', 'Beavertail': '#8a8aa0'}
# Leaf and accent per season, from each spec's Seasons table. Deciduous trees
# are drawn in leaf (their bare variants come later): a winter that is bare
# keeps the summer leaf.
_all = ('spring', 'summer', 'autumn', 'winter')
LOOK = {
    'JoshuaTree': {'spring': ('#7e8f4a', '#e6e0b0'), 'summer': ('#77884a', '#8a9a52'), 'autumn': ('#77884a', '#9a8a62'),
                   'winter': ('#73844a', '#8a7c60')},
    'MojaveYucca': {'spring': ('#6a8040', '#efe8c8'), 'summer': ('#6a8040', '#a89a6a'), 'autumn': ('#6a8040', '#9a8a64'),
                    'winter': ('#667c40', '#8a7c60')},
    'FanPalm': {'spring': ('#5f8a3e', '#a8885a'), 'summer': ('#5a843a', '#a8885a'), 'autumn': ('#5a843a', '#a8885a'),
                'winter': ('#577f3a', '#a08458')},
    'DatePalm': {'spring': ('#7a9a6a', '#e8dcb0'), 'summer': ('#738f62', '#d8862e'), 'autumn': ('#738f62', '#7a4a2a'),
                 'winter': ('#708a60', '#7a5a3a')},
    'AleppoPine': {'spring': ('#7a9a52', None), 'summer': ('#6f8f4c', None), 'autumn': ('#6f8f4c', None),
                   'winter': ('#6c8a4a', None)},
    'Oleander': {'spring': ('#52783a', '#e080a8'), 'summer': ('#4f7436', '#e080a8'), 'autumn': ('#4f7436', '#d890b0'),
                 'winter': ('#4c7034', '#4c7034')},
    'Tamarisk': {'spring': ('#a7b38a', '#e0a8c0'), 'summer': ('#8fa070', '#d890b0'), 'autumn': ('#b49a52', '#b49a52'),
                 'winter': ('#8fa070', '#8a5a48')},
    'SmokeTree': {'spring': ('#a8acaa', '#a8acaa'), 'summer': ('#a8acaa', '#7a6aa8'), 'autumn': ('#a8acaa', '#a8acaa'),
                  'winter': ('#a8acaa', '#a8acaa')},
    'SoaptreeYucca': {'spring': ('#8a9a5a', '#e8e4c8'), 'summer': ('#8a9a5a', '#f2eedc'), 'autumn': ('#8a9a5a', '#a8906a'),
                      'winter': ('#86965a', '#9a8a6a')},
    'Sotol': {'spring': ('#8a9a7a', '#d8d0a0'), 'summer': ('#8a9a7a', '#e8dcaa'), 'autumn': ('#8a9a7a', '#a88a5a'),
              'winter': ('#84967a', '#9a8462')},
    'Lechuguilla': {'spring': ('#8a9a5a', '#c8b060'), 'summer': ('#8a9a5a', '#d89a3a'), 'autumn': ('#8a9a5a', '#9a7a50'),
                    'winter': ('#86965a', '#8a7450')},
    'DesertWillow': {'spring': ('#8fa660', '#8fa660'), 'summer': ('#7a9a52', '#d890c8'), 'autumn': ('#b0a050', '#8a7048'),
                     'winter': ('#7a9a52', '#8a7048')},
    'EmoryOak': {'spring': ('#7a9a4a', None), 'summer': ('#4f6a38', None), 'autumn': ('#4f6a38', None),
                 'winter': ('#4c6636', None)},
    'AlligatorJuniper': {'spring': ('#6d8a78', None), 'summer': ('#678572', None), 'autumn': ('#678572', None),
                         'winter': ('#647f6e', None)},
    'Beavertail': {'spring': ('#8a8aa0', '#c82a7a'), 'summer': ('#8a8aa0', '#c82a7a'), 'autumn': ('#8a8aa0', '#a87a6a'),
                   'winter': ('#9a7a8a', '#9a7a8a')},
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


ct.export(MODELS, colours={'leaf': (0.30, 0.42, 0.24), 'bark': (0.45, 0.40, 0.33), 'accent': (0.80, 0.55, 0.45)},
          far={'Blender_FanPalm_1', 'Blender_FanPalm_2', 'Blender_DatePalm_1', 'Blender_DatePalm_2'},
          tints=tints(SEASON))
