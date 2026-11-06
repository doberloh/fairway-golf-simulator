# THE KEYS PACK (the US landscapes goal, 2 November 2026; PLAN.md section 5,
# local): what the Keys lacked -- royal and traveler's palms, sea grape,
# mangrove, gumbo limbo, banyan, bougainvillea, hibiscus.
#
#   node tools/blender/iterate.mjs cartoon_keys <round> [--season s] [--far]
#
# The frond is cartoon_island.py's (copied: importing a pack runs its export),
# with a `rise` so a royal palm's young fronds stand up and its old ones hang.
# Silhouette first (the owner, 2 November 2026): every model is built from
# parts placed to make its own outline; the logs (tools/blender/logs/) say
# what each outline is and how it was found.
#
# REFS royalpalm=Blender_RoyalPalm_1,Blender_RoyalPalm_2
# REFS travelerspalm=Blender_TravelersPalm_1
# REFS seagrape=Blender_SeaGrape_1
# REFS mangrove=Blender_Mangrove_1
# REFS gumbolimbo=Blender_GumboLimbo_1
# REFS banyan=Blender_Banyan_1
# REFS bougainvillea=Blender_Bougainvillea_1
# REFS hibiscus=Blender_Hibiscus_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def bezier(p0, p1, p2, n):
    return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in (k / n for k in range(n + 1))]


def lobe(mesh, rng, c, size, centre, shade, role='leaf', blend=.9, subdiv=3, squash=0.0):
    """One crown lobe, its normals bent to the crown's centre so neighbours
    light as one body."""
    mesh.add_lump(c, size, role, rng, subdiv=subdiv, jitter=.08, crown=centre, blend=blend, shade=shade,
                  flex=lambda w: min(1.0, .45 + .55 * min(1.0, (w - centre).length / max(size[0] * 3, 1e-6))),
                  squash_bottom=squash)


def disc(mesh, c, n, r, role, sides=8, shade=1.0, star=0.0, normal=None, rng=None, flex=.8):
    """A flat round leaf or flower facing `n`, drawn both sides; `star` > 0
    notches every other rim point (a five-petal flower with sides=10)."""
    n = n.normalized()
    u = n.cross(Vector((0, 0, 1)))
    if u.length < 1e-4:
        u = Vector((1, 0, 0))
    u.normalize()
    v = n.cross(u)
    pts = []
    for k in range(sides):
        a = k / sides * math.tau
        rr = r * (1 - star * (k % 2)) * (1 + (rng.uniform(-.08, .08) if rng else 0))
        pts.append(c + (u * math.cos(a) + v * math.sin(a)) * rr)
    nn = (normal or n).normalized()
    for ring in (pts, list(reversed(pts))):
        f = mesh.face(ring, role, smooth=True)
        for vt in f.verts:
            mesh.normal[vt] = nn
            mesh.paint[vt] = (shade, shade, shade, flex)


def frond(mesh, rng, base, head, length, droop, width, rise=.38):
    """One arching palm frond (cartoon_island.py): a rachis curving up and out
    then down, leaflets either side overlapping into one feathery leaf."""
    out = Vector((math.cos(head), math.sin(head), 0))
    side = Vector((-out.y, out.x, 0))
    pts = []
    n = 6 if ct.FAR else 12  # a far twin's frond: half the leaflet pairs, the same arch
    for k in range(n + 1):
        t = k / n
        pts.append(base + out * length * t + Vector((0, 0, length * (rise * t - droop * t * t))))
    for k in range(1, n + 1):
        a, b = pts[k - 1], pts[k]
        t = k / n
        w = width * math.sin(math.pi * min(1, t * 1.1)) ** .7 + .03
        step = (b - a) * (1.7 if n == 12 else 1.35)
        for sgn in (-1, 1):
            tip = a + step + side * sgn * w + Vector((0, 0, -w * .6))

            mid = a.lerp(tip, .5) + (b - a) * .3
            mesh.face([a, b, tip, mid], 'leaf')
    return pts


def paint_leaves(mesh, top_z, span):
    for v in mesh.bm.verts:
        if v in mesh.paint:
            continue
        t = max(0.0, min(1.0, (v.co.z - (top_z - span)) / max(span * 1.4, 1e-6)))
        m = .6 + .55 * t
        mesh.paint[v] = (m, m, m, .55 + .45 * t)


def royalpalm(height, fronds):
    """Royal palm: a smooth pale-grey column swelling a little mid-way, a
    glossy green crownshaft on top, a full round head of arching fronds --
    the young ones standing up, the old ones hanging."""
    def build(mesh, rng):
        H = height
        n = 12
        tall = H * .72
        pts = [Vector((0, 0, tall * k / n)) for k in range(n + 1)]
        radii = []
        for k in range(n + 1):
            t = k / n
            r = H * .03 * (1 + .22 * math.exp(-((t - .45) / .22) ** 2)) * (1 - .15 * t)
            radii.append(r * (1.35 if k == 0 else 1))
        mesh.add_tube(pts, radii, 10, 'bark', rng=rng, wobble=.01, shade=lambda co, t: .85 + .2 * t,
                      flex=lambda co, t: .15 * t * t)
        top = pts[-1]
        r0 = radii[-1]
        shaft = [top + Vector((0, 0, H * .19 * k / 4)) for k in range(5)]
        mesh.add_tube(shaft, [r0 * 1.22, r0 * 1.3, r0 * 1.24, r0 * 1.05, r0 * .7]
, 10, 'accent',
                      shade=lambda co, t: .85 + .3 * t, flex=lambda co, t: .2)
        c = shaft[-1]
        for i in range(fronds):
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            u = i / (fronds - 1)
            frond(mesh, rng, c + Vector((0, 0, -H * .02 * u)), a, H * rng.uniform(.28, .32) * (1 + .15 * u),
                  .5 + .9 * u, H * .055, rise=.9 - .4 * u)
        paint_leaves(mesh, H, H * .3)
    return build


def travelerspalm(height, leaves):
    """Traveler's palm: a ringed grey trunk and a flat fan of long-stalked
    paddle leaves in one plane (X-Z, facing the sheet's camera)."""
    def build(mesh, rng):
        H = height
        tall = H * .3
        pts = [Vector((0, 0, tall * k / 12)) for k in range(13)]
        mesh.add_tube(pts, [H * .04 * (1.2 if k == 0 else 1) for k in range(13)], 9, 'bark',
                      shade=lambda co, t: .78 + .25 * (round(t * 12) % 2))
        base = pts[-1]
        for i in range(leaves):
            f = i / (leaves - 1)
            a = math.radians(-95 + 190 * f)
            d = Vector((math.sin(a), 0, math.cos(a)))
            y = H * .012 * (1 if i % 2 else -1)
            root = base + Vector((math.sin(a) * H * .03, y, 0))
            stalk_end = root + d * H * .4
            mesh.add_tube([root, stalk_end], [H * .014, H * .008], 5, 'leaf', shade=lambda co, t: 1.25 - .15 * t)
            # The blade: an oblong paddle with a raised midrib, ragged edges,
            # the outer ones bowed down by their weight.
            sag = max(0.0, abs(a) - .9) * .8
            bd = Vector((math.sin(a) * (1 + sag * .3), 0, math.cos(a) - sag)).normalized()
            L, W = H * rng.uniform(.34, .38), H * .055
            side = Vector((-bd.z, 0, bd.x))
            prev = None
            for k in range(9):
                t = k / 8
                w = W * math.sin(math.pi * (.08 + .84 * t)) ** .5 * (1 + rng.uniform(-.15, .15))
                p = stalk_end + bd * L * t + Vector((0, y, 0))
                cur = (p + side * w, p + Vector((0, -W * .25 if y < 0 else W * .25, 0)), p - side * w)
                if prev:
                    for q in ([prev[0], cur[0], cur[1], prev[1]], [prev[1], cur[1], cur[2], prev[2]]):
                        mesh.face(q, 'leaf')
                        mesh.face(list(reversed(q)), 'leaf')
                prev = cur
        paint_leaves(mesh, H, H * .6)
    return build


def seagrape(height, spread):
    """Sea grape: a few short stems under one broad close dome, its edge
    scalloped by big round leaf plates, grape strings hanging (accent)."""
    def build(mesh, rng):
        H = height
        for k in range(4):
            out = heading(k / 4 * math.tau + rng.uniform(-.4, .4))
            end = out * spread * rng.uniform(.12, .22) + Vector((0, 0, H * rng.uniform(.38, .5)))
            ct.limb(mesh, rng, out * .1, end, H * .035, H * .02, bow=.15, sides=6)
        c = Vector((0, 0, H * .58))
        R = (spread * .46, spread * .46, H * .4)
        ct.cloud_crown(mesh, rng, c, R, lobes=9, lobe_size=(.5, .62), flat_bottom=.3, shell=.6, blend=.9, core=False)
        shade = ct.crown_shade(c, R)
        pr = random.Random(rng.random())
        N = 60
        for i in range(N):
            y = max(-.55, min(.95, 1 - (i + .5) / N * 1.55 + pr.uniform(-.08, .08)))
            r = math.sqrt(1 - y * y)
            a = i * ct.GOLDEN + pr.uniform(-.3, .3)
            d = Vector((math.cos(a) * r, math.sin(a) * r, y))
            p = c + Vector((d.x * R[0], d.y * R[1], d.z * R[2])) * pr.uniform(.95, 1.05)
            # Turned every way, mostly out and up: circles and ellipses
            # scallop the outline (stood all edge-out they read as slivers).
            out = (p - c).normalized()
            n = (out + Vector((pr.uniform(-.9, .9), pr.uniform(-.9, .9), pr.uniform(0, .9)))).normalized()
            p = p + out * spread * .05
            disc(mesh, p, n, spread * pr.uniform(.08, .1), 'leaf', 8, shade=shade(p, out) * 1.2, normal=out, rng=pr)
        gr = random.Random(rng.random())
        for g in range(10):
            a = gr.uniform(0, math.tau)
            y = gr.uniform(-.5, -.1)
            r = math.sqrt(1 - y * y)
            p = c + Vector((math.cos(a) * r * R[0] * 1.08, math.sin(a) * r * R[1] * 1.08, y * R[2] - .3))
            mesh.add_lump(p, (.09, .09, .34), 'accent', gr, subdiv=1, jitter=.12, flex=.9, shade=lambda w, n: 1.0)
    return build


def mangrove(height, spread):
    """Red mangrove: a dense low dome held on a tangle of thin prop roots
    that arch out and down into the water."""
    def build(mesh, rng):
        H = height
        stems = []
        for k in range(3):
            out = heading(k / 3 * math.tau + rng.uniform(-.5, .5))
            lo = out * spread * .05 + Vector((0, 0, H * .2))
            hi = out * spread * .12 + Vector((0, 0, H * .58))
            mesh.add_tube([lo, lo.lerp(hi, .5) + drift(rng, .15), hi], [H * .03, H * .025, H * .018], 7, 'bark')
            stems.append((lo, hi))
        rr = random.Random(rng.random())
        for k in range(22):
            lo, hi = stems[k % 3]
            start = lo.lerp(hi, rr.uniform(0, .5))
            out = heading(rr.uniform(0, math.tau))
            foot = Vector((start.x, start.y, 0)) + out * spread * rr.uniform(.22, .42)
            ctrl = start + out * spread * rr.uniform(.12, .2) + Vector((0, 0, H * rr.uniform(.06, .14)))
            if ct.FAR and k % 2:
                continue  # the far twin: half the roots (drawn after the stream is read, so nothing moves)
            mesh.add_tube(bezier(start, ctrl, foot, 6), [H * (.013 - .0007 * j) for j in range(7)], 4, 'bark',
                          shade=lambda co, t: .8 + .25 * (1 - t))
        for k in range(5):
            p = heading(rr.uniform(0, math.tau)) * spread * rr.uniform(.18, .32) + Vector((0, 0, H * .5))
            mesh.add_tube([p, Vector((p.x, p.y, 0))], [H * .007, H * .006], 4, 'bark', rng=rr, wobble=.1)
        c = Vector((0, 0, H * .66))
        R = (spread * .52, spread * .5, H * .3)
        ct.cloud_crown(mesh, rng, c, R, lobes=15, lobe_size=(.4, .52), flat_bottom=.55, shell=.72, blend=.9,
                       core=False, jitter=.14)
    return build


def gumbolimbo(height, spread):
    """Gumbo limbo: a short coppery trunk forking low into thick sinuous
    limbs that spread wide and fork again, a sparse open crown of small
    clumps on their tips."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .22, H * .07, lean=drift(rng, H * .02), flare=1.5,
                              sides=10, bend=H * .02)
        top = pts[-1]
        ends = []
        for i in range(4):
            a = i / 4 * math.tau + rng.uniform(-.3, .3)
            mid = top + heading(a) * spread * .2 + Vector((0, 0, H * .24))
            ct.limb(mesh, rng, pts[-2], mid, H * .06, H * .035, bow=.15, sides=8, shade=.95)
            for j in range(2):
                b = a + (j - .5) * rng.uniform(.7, 1.1)
                end = mid + heading(b) * spread * rng.uniform(.17, .22) + Vector((0, 0, H * rng.uniform(.16, .26)))
                ct.limb(mesh, rng, mid, end, H * .034, H * .016, bow=.3, sides=6, shade=.95)
                tr = random.Random(rng.random())
                for m in range(2):
                    g = b + (m - .5) * tr.uniform(.8, 1.2)
                    twig = end + heading(g) * spread * tr.uniform(.08, .13) + Vector((0, 0, H * tr.uniform(.03, .17)))
                    seed = tr.random()
                    if not ct.FAR:  # the far twin skips the twigs; the rosettes stay where they were
                        ct.limb(mesh, random.Random(seed), end, twig, H * .015, H * .007, bow=.2, sides=4, shade=.95)

                    ends.append((end, twig))
        # The crown: round lobes (flattened ones read as cloud-pruned pads,
        # rounds 3-6) on each twig and beside it, at uneven heights, all
        # bent to one centre: a broad broken dome, the limbs bare below.
        c = Vector((0, 0, H * .8))
        R = (spread * .5, spread * .5, H * .25)
        shade = ct.crown_shade(c, R)
        lr = random.Random(rng.random())
        # Gumbo limbo leaves are pinnate, in loose rosettes at the twig
        # ends: each is a flat ragged star (ct.skirt), not a ball -- round
        # lobes made a crown of fluffy balls on copper sticks (rounds 3-9).
        def rosette(p, s):
            ct.skirt(mesh, lr, p, s, s * .55, points=7, droop=.35, blend=.75, shade=shade, ragged=.4, flex=.6,
                     twist=lr.uniform(0, 1), thick=.6)
        for k, (end, e) in enumerate(ends):
            s = spread * lr.uniform(.1, .15)
            rosette(e + Vector((0, 0, s * lr.uniform(0, .5))), s)


            if k % 2 == 0:
                rosette(end.lerp(e, .45) + Vector((0, 0, s * .5)) + drift(lr, s * .4), s * .85)
        # A broken top: rosettes between the limb groups close the crown
        # over the bare limbs.
        for k in range(4):
            q = c + heading(k / 4 * math.tau + math.pi / 4 + lr.uniform(-.3, .3)) * spread * .2 + Vector((0, 0, H * .05))
            rosette(q, spread * .13)

    return build


def banyan(height, spread, roots):
    """Banyan: a fused many-stemmed trunk, long near-level limbs, root
    columns dropped from the limbs to the ground, a vast low dome of big
    lobes over them."""
    def build(mesh, rng):
        H = height
        for k in range(4):
            off = heading(k / 4 * math.tau + rng.uniform(-.3, .3)) * H * .035
            ct.trunk(mesh, rng, off, H * .42, H * .045, flare=1.6, sides=8)
        hub = Vector((0, 0, H * .38))
        limbs = []
        for k in range(6):
            out = heading(k / 6 * math.tau + rng.uniform(-.25, .25))
            end = out * spread * rng.uniform(.38, .46) + Vector((0, 0, H * rng.uniform(.42, .5)))
            limbs.append(ct.limb(mesh, rng, hub, end, H * .04, H * .018, bow=.08, sides=7))
        cr = random.Random(rng.random())
        for k in range(roots):
            lp = limbs[k % 6]
            p = lp[cr.randint(2, 5)]
            r = H * cr.uniform(.014, .03)
            if ct.FAR and k % 3 == 2:
                cr.random()  # what add_tube's own stream would have taken
                continue
            mesh.add_tube([Vector((p.x, p.y, 0)), Vector((p.x, p.y, p.z * .5)), p], [r * 1.3, r, r * .9], 6, 'bark',
                          rng=cr, wobble=.08, shade=lambda co, t: .8 + .2 * t)
        c = Vector((0, 0, H * .7))
        R = (spread * .5, spread * .5, H * .3)
        shade = ct.crown_shade(c, R)
        lr = random.Random(rng.random())
        for lp in limbs:
            for j, k in ((4, .17), (5, .15)):
                p = lp[j] + Vector((0, 0, H * {4: .1, 5: -.02}[j]))
                s = spread * k * lr.uniform(.95, 1.1)
                lobe(mesh, lr, p, (s, s, H * .13), c, shade, squash=.5)
        for k in range(6):
            b = math.atan2(limbs[k][-1].y, limbs[k][-1].x) + math.pi / 6
            p = heading(b) * spread * .36 + Vector((0, 0, H * .56))
            s = spread * .18
            lobe(mesh, lr, p, (s, s, H * .12), c, shade, squash=.5)
        for k in range(3):
            p = c + heading(k / 3 * math.tau + .4) * spread * .12 + Vector((0, 0, H * .02))
            s = spread * .22
            lobe(mesh, lr, p, (s, s, H * .17), c, shade)
    return build


def bougainvillea(height, spread):
    """Bougainvillea: a spilling mound -- a green core, magenta bract
    masses (accent) over its upper skin and tongues of them hanging from
    its rim down the sides, a few woody stems at the root. (Round 5: a
    fountain of separate canes left magenta feet on the ground.)"""
    def build(mesh, rng):
        H = height
        c = Vector((0, 0, H * .4))
        R = (spread * .48, spread * .48, H * .44)
        shade = ct.crown_shade(c, R)
        for k in range(3):
            out = heading(k / 3 * math.tau + rng.uniform(-.3, .3))
            mesh.add_tube([out * .05, out * spread * .12 + Vector((0, 0, H * .35))], [H * .02, H * .012], 5, 'bark')
        ct.cloud_crown(mesh, rng, c, (R[0] * .8, R[1] * .8, R[2] * .8), lobes=4, lobe_size=(.6, .7), flat_bottom=.5,
                       shell=.5, blend=.9, core=False)
        br = random.Random(rng.random())
        N = 10
        for i in range(N):
            y = .95 - (i + .5) / N * .9
            r = math.sqrt(1 - y * y)
            a = i * ct.GOLDEN + br.uniform(-.3, .3)
            d = Vector((math.cos(a) * r, math.sin(a) * r, y))
            p = c + Vector((d.x * R[0], d.y * R[1], d.z * R[2])) * .8
            s = spread * br.uniform(.15, .18)
            # Every third mass is leaf: the pictures are half green.
            lobe(mesh, br, p, (s, s, s * .8), c, shade, role='leaf' if i % 3 == 2 else 'accent', blend=.85)
        # The spill: tongues hanging from the rim, joined to the body.
        for k in range(5):
            a = k / 5 * math.tau + br.uniform(-.3, .3)
            p = c + heading(a) * R[0] * .84 + Vector((0, 0, -R[2] * .45))
            s = spread * br.uniform(.1, .12)
            lobe(mesh, br, p, (s, s, s * 1.3), c, shade, role='accent', blend=.85)
        # Papery bract sprays: ragged little stars over the skin and down
        # the sides, so the outline is ragged and papery, not a heap of
        # smooth balloons (round 8).
        dr = random.Random(rng.random())
        N = 70
        for i in range(N):
            y = max(-.75, min(.95, .95 - (i + .5) / N * 1.7 + dr.uniform(-.06, .06)))
            r = math.sqrt(1 - y * y)
            a = i * ct.GOLDEN + dr.uniform(-.3, .3)
            d = Vector((math.cos(a) * r, math.sin(a) * r, y))
            p = c + Vector((d.x * R[0], d.y * R[1], d.z * R[2])) * dr.uniform(.98, 1.1)
            n = (d + Vector((dr.uniform(-.7, .7), dr.uniform(-.7, .7), dr.uniform(-.2, .7)))).normalized()
            disc(mesh, p, n, spread * dr.uniform(.05, .065), 'accent', 6, shade=shade(p, d) * 1.1, star=.35,
                 normal=(p - c).normalized(), rng=dr)
    return build


def hibiscus(height, spread):
    """Hibiscus: an upright open shrub of leafy shoots, big flat red
    five-petal flowers (accent) facing out from its skin."""
    def build(mesh, rng):
        H = height
        c = Vector((0, 0, H * .55))
        R = (spread * .5, spread * .5, H * .45)
        shade = ct.crown_shade(c, R)
        tips = []
        spots = []
        for k in range(5):
            out = heading(k / 5 * math.tau + rng.uniform(-.3, .3))
            tip = out * spread * rng.uniform(.28, .38) + Vector((0, 0, H * rng.uniform(.8, .98)))
            ct.limb(mesh, rng, out * .05, tip, H * .02, H * .008, bow=.05, sides=5)
            tips.append(tip)
        lr = random.Random(rng.random())
        for tip in tips:
            for t, s in ((.5, .2), (.74, .22), (.95, .17)):

                p = Vector((tip.x * t * 1.1, tip.y * t * 1.1, tip.z * t))
                ss = spread * s * lr.uniform(.85, 1.15)
                p = p + drift(lr, ss * .3)
                lobe(mesh, lr, p, (ss, ss, ss * 1.25), c, shade)
                spots.append((p, ss))
        fr = random.Random(rng.random())
        for k in range(20):
            p, ss = spots[(k * 7) % len(spots)]
            flat = Vector((p.x, p.y, 0))
            d = flat.normalized() if flat.length > .05 else heading(fr.uniform(0, 6.3))
            d = (d + Vector((fr.uniform(-.6, .6), fr.uniform(-.6, .6), fr.uniform(-.2, .7)))).normalized()
            q = p + Vector((d.x * ss, d.y * ss, d.z * ss * 1.25)) * 1.02
            disc(mesh, q, d + Vector((0, 0, .3)), H * .065, 'accent', 10, shade=1.0, star=.45, rng=fr)
    return build


MODELS = [
    ('Blender_RoyalPalm_1', royalpalm(20, 18)),
    ('Blender_RoyalPalm_2', royalpalm(16, 16)),
    ('Blender_TravelersPalm_1', travelerspalm(8, 15)),
    ('Blender_SeaGrape_1', seagrape(4, 5)),
    ('Blender_Mangrove_1', mangrove(6, 7)),
    ('Blender_GumboLimbo_1', gumbolimbo(11, 11)),
    ('Blender_Banyan_1', banyan(18, 30, 16)),
    ('Blender_Bougainvillea_1', bougainvillea(3, 3.5)),
    ('Blender_Hibiscus_1', hibiscus(2.2, 2.0)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# The Keys are tropical (regions.js): nearly one look the year round. The
# seasons below are the specs' (docs/studies/us-landscapes/models/<id>.md):
# small shifts of green, the sea grape's red autumn leaves, the gumbo
# limbo's pale spring flush, the bougainvillea's orange-red autumn bracts
# and fewer, duller ones in winter (PLACED: the mesh cannot lose bracts,
# so winter's are a duller magenta).
BARK = {'RoyalPalm': '#b8b4aa', 'TravelersPalm': '#8a8478', 'SeaGrape': '#7a6a58', 'Mangrove': '#7a5a48',
        'GumboLimbo': '#b0644a', 'Banyan': '#8a847a', 'Bougainvillea': '#6a5a40', 'Hibiscus': '#6a5a40'}
LOOK = {'RoyalPalm': ('#5a873c', '#7cae4c'), 'TravelersPalm': ('#58873c', None), 'SeaGrape': ('#58873c', '#b0738a'),
        'Mangrove': ('#3d6632', None), 'GumboLimbo': ('#4f7a36', None), 'Banyan': ('#47763a', None),
        'Bougainvillea': ('#4f7a36', '#c8288a'), 'Hibiscus': ('#3f6a34', '#d03a3a')}
SEASONS = {
    'spring': {'RoyalPalm': ('#5c8a3e', '#7cae4c'), 'TravelersPalm': ('#5a8a3e', None), 'SeaGrape': ('#5a8a3e', '#9aae6a'),
               'Mangrove': ('#3f6a34', None), 'GumboLimbo': ('#7a9a4a', None), 'Banyan': ('#4a7a3a', None)},
    'autumn': {'SeaGrape': ('#74703a', '#b0738a'), 'Bougainvillea': ('#4f7a36', '#d05a3a')},
    'winter': {'RoyalPalm': ('#58843c', '#7cae4c'), 'TravelersPalm': ('#56843c', None), 'SeaGrape': ('#56843c', '#b0738a'),
               'Mangrove': ('#3b6230', None), 'GumboLimbo': ('#55783a', None), 'Banyan': ('#457238', None),
               'Bougainvillea': ('#5a8a3e', '#a8487e'), 'Hibiscus': ('#4f7a36', '#d03a3a')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        leaf, accent = SEASONS.get(season, {}).get(sp, LOOK[sp])
        t = {'leaf': hexrgb(leaf)}
        if accent:
            t['accent'] = hexrgb(accent)
        if sp in BARK:
            t['bark'] = hexrgb(BARK[sp])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.8, 0.2, 0.4)},
          far={'Blender_RoyalPalm_1', 'Blender_RoyalPalm_2', 'Blender_GumboLimbo_1', 'Blender_Banyan_1',
               'Blender_Mangrove_1'},
          tints=tints(SEASON))
