# THE SOUTHERN PINES PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what the South's Longleaf Pines, Lowcountry, Florida
# Flatwoods and Gulf Coast lacked -- longleaf (and its grass stage),
# loblolly and slash pines, the cabbage palm, saw palmetto and wiregrass.
#
#   node tools/blender/iterate.mjs cartoon_southpines <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): the three pines are told
# apart by outline, from each other and from the game's pine (whorls of
# smooth flat pads) and lodgepole (a narrow crown down its upper half, dead
# stubs below). Their needles are `burst` tufts -- spiky star-balls, the
# long-needled pine brush -- never smooth lobes. The logs (tools/blender/
# logs/) say what each outline is and how it was found.
#
# REFS longleafpine=Blender_LongleafPine_1,Blender_LongleafPine_2
# REFS longleafgrassstage=Blender_LongleafGrass_1
# REFS loblollypine=Blender_LoblollyPine_1,Blender_LoblollyPine_2
# REFS slashpine=Blender_SlashPine_1,Blender_SlashPine_2
# REFS cabbagepalm=Blender_CabbagePalm_1,Blender_CabbagePalm_2
# REFS sawpalmetto=Blender_SawPalmetto_1
# REFS wiregrass=Blender_Wiregrass_1
import math, os, random, sys
import bmesh
from mathutils import Euler, Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def frame(d):
    d = d.normalized()
    u = d.cross(Vector((0, 0, 1)))
    if u.length < 1e-4:
        u = Vector((1, 0, 0))
    u.normalize()
    return u, d.cross(u).normalized(), d


def at(pts, t):
    i = max(0, min(len(pts) - 1, int(round(t * (len(pts) - 1)))))
    return i, pts[i]


PHI = (1 + 5 ** .5) / 2
ICO_V = [Vector(p).normalized() for p in ((-1, PHI, 0), (1, PHI, 0), (-1, -PHI, 0), (1, -PHI, 0), (0, -1, PHI),
                                          (0, 1, PHI), (0, -1, -PHI), (0, 1, -PHI), (PHI, 0, -1), (PHI, 0, 1),
                                          (-PHI, 0, -1), (-PHI, 0, 1))]
ICO_F = ((0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
         (8, 6, 7), (9, 8, 1))


def burst(mesh, rng, c, r, d=Vector((0, 0, 1)), elong=1.0, spike=.75, shade=None, centre=None, role='leaf',
          droop=.25, flex=.8, inner=.5):
    """A pine's needle brush: a small icosahedron with a spike on each of
    its twenty faces (a stellated ball) -- a spiky star-ball, `elong` along
    `d`, the lower spikes drooping; turned its own way. 60 triangles; the
    far twin's is the bare icosahedron with every other vertex pulled out
    (20). Round 3: built by hand -- Blender's icosphere at subdivisions=1
    is the plain icosahedron, so round 2's 'spikes' were all of its
    vertices and the brushes faceted balls."""
    br = random.Random(rng.random())
    rot = Euler((br.uniform(0, 6.3), br.uniform(0, 6.3), br.uniform(0, 6.3))).to_matrix()
    u, v, w = frame(d)
    idx = mesh.slot(role)
    cc = centre if centre is not None else c

    def vert(n, k, tip):
        p = (u * n.x + v * n.y) * r * k + w * n.z * r * elong * k
        if tip and p.z < 0:
            p.z -= r * droop * k
        q = c + p
        nv = mesh.bm.verts.new(q)
        out = q - cc
        out = out.normalized() if out.length > 1e-6 else Vector((0, 0, 1))
        nn = (out * .7 + p.normalized() * .3).normalized()
        mesh.normal[nv] = nn
        m = shade(q, nn) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        dim = 1.0 if tip else .82
        mesh.paint[nv] = (mm[0] * dim, mm[1] * dim, mm[2] * dim, flex)
        return nv

    dirs = [(rot @ q).normalized() for q in ICO_V]
    if ct.FAR:
        # Round 13: the in-between vertices at the full brush's inner radius
        # (at 1.4x it the far brush was a fat faceted box, round 12).
        vs = [vert(n, (1 + spike * .9) if i % 2 == 0 else inner, i % 2 == 0) for i, n in enumerate(dirs)]
        faces = [[vs[a], vs[b], vs[e]] for a, b, e in ICO_F]
    else:
        vs = [vert(n, inner * br.uniform(.9, 1.05), False) for n in dirs]
        faces = []
        for a, b, e in ICO_F:
            n = (dirs[a] + dirs[b] + dirs[e]).normalized()
            t = vert(n, 1 + spike * br.uniform(.7, 1.2), True)
            faces += [[vs[a], vs[b], t], [vs[b], vs[e], t], [vs[e], vs[a], t]]
    for f in faces:
        nf = mesh.bm.faces.new(f)
        nf.material_index = idx
        nf.smooth = True


def clump(mesh, rng, p, s, n, shade, c, elong=1.0, spike=.5, inner=.72, rise=.3):
    """A clump of n brushes about p: one on it, the rest round it (round
    4: single starry brushes read as asterisks, a cycad's crown, not a
    pine's massed needles)."""
    cr = random.Random(rng.random())
    a0 = cr.uniform(0, math.tau)
    for k in range(n):
        off = heading(a0 + k / max(1, n - 1) * math.tau + cr.uniform(-.4, .4)) * s * cr.uniform(.8, 1.1)
        q = p if k == 0 else p + off + Vector((0, 0, s * cr.uniform(-.2, rise)))
        burst(mesh, cr, q, s * (1 if k == 0 else cr.uniform(.75, .9)), elong=elong, spike=spike, shade=shade,
              centre=c, inner=inner)


def cones(mesh, rng, spots, size):
    for p in spots:
        mesh.add_lump(p, (size * .5, size * .5, size), 'accent', rng, subdiv=1, jitter=.1, flex=.6,
                      shade=lambda w, n: 1.0)


# ---------------------------------------------------------------- pines

def longleaf(height, spread, limbs):
    """Longleaf pine: a very tall straight bare pole, a small open irregular
    crown at the very top -- a few crooked upswept limbs, big long-needled
    brushes clustered at their ends, sky between them."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .9, H * .012, lean=drift(rng, H * .015), flare=1.4,
                              sides=8, bend=H * .008)
        c = Vector((pts[-1].x, pts[-1].y, H * .86))
        R = (spread * .5, spread * .5, H * .12)
        shade = ct.crown_shade(c, R, low=.5, high=1.2)
        a0 = rng.uniform(0, math.tau)
        lr = random.Random(rng.random())
        tufts = []
        for k in range(limbs):
            t = k / max(1, limbs - 1)
            j, p = at(pts, (.62 + .3 * t) / .9)
            a = a0 + k * 2.4 + lr.uniform(-.4, .4)
            reach = spread * .5 * (1 - .4 * t) * lr.uniform(.65, 1.05)
            end = p + heading(a) * reach + Vector((0, 0, reach * lr.uniform(.3, .6)))
            lp = ct.limb(mesh, lr, p, end, radii[j] * .45, H * .003, bow=.25, sides=4)
            s = H * .036 * lr.uniform(.85, 1.1)
            # Round 7: one puff of brushes at each limb end, nothing along
            # the limb -- the open crown, sky and limbs between the puffs,
            # that tells it from the loblolly's closed oval.
            tufts.append((end + Vector((0, 0, s * .3)), s))
        tufts.append((pts[-1] + Vector((0, 0, H * .02)), H * .034))
        for p, s in tufts:
            clump(mesh, lr, p, s, 3, shade, c, elong=1.35, spike=.6, inner=.7, rise=.6)
        cones(mesh, lr, [p + Vector((0, 0, -s * 1.1)) for p, s in tufts[::3]], H * .006)
    return build


def loblolly(height, spread, flat):
    """Loblolly pine: a straight trunk bare to about 60%, a dense crown in
    the top third -- an oval (or, `flat`, flat-topped) mass of needle
    brushes on many short branches, few gaps."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .93, H * .016, lean=drift(rng, H * .01), flare=1.5,
                              sides=8, bend=H * .006)
        c = Vector((pts[-1].x, pts[-1].y, H * .8))
        R = (spread * .5, spread * .5, H * .2)
        shade = ct.crown_shade(c, R, low=.48, high=1.18)
        lr = random.Random(rng.random())
        tufts = []
        n = 15
        for k in range(n):
            t = k / (n - 1)
            j, p = at(pts, (.6 + .33 * t) / .93)
            a = k * ct.GOLDEN * 1.0 + lr.uniform(-.3, .3)
            # Oval: widest a third of the way up the crown; flat: wide to the top.
            prof = math.sin(math.pi * min(1, .25 + .85 * t)) ** .6 if not flat else (1 - .55 * t ** 3)
            reach = spread * .5 * max(.2, prof) * lr.uniform(.8, 1.0)
            end = p + heading(a) * reach + Vector((0, 0, reach * (.12 if flat and t > .5 else .35)))
            lp = ct.limb(mesh, lr, p, end, radii[j] * .4, H * .003, bow=.15, sides=4)
            s = H * .042 * lr.uniform(.9, 1.1)
            tufts.append((end, s))
            if reach > spread * .2:
                tufts.append((lp[2] + Vector((0, 0, s * .6)), s * .9))
        # Round 5: brushes up the stem through the crown close its middle.
        for k in range(3):
            tufts.append((at(pts, (.68 + .1 * k) / .93)[1] + drift(lr, H * .02), H * .04))
        tufts.append((pts[-1] + Vector((0, 0, H * .01)), H * .04))
        for p, s in tufts:
            clump(mesh, lr, p, s, 2, shade, c, elong=.9, spike=.45, inner=.75)
        cones(mesh, lr, [p + Vector((0, 0, -s * .9)) for p, s in tufts[::4]], H * .004)
    return build


def slash(height, spread, limbs):
    """Slash pine: a tall trunk forking into long crooked limbs that sweep
    out and up, needle brushes massed at their ends into a broad, open,
    flat-ish dome, the limbs bare beneath it."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .82, H * .018, lean=drift(rng, H * .02), flare=1.5,
                              sides=8, bend=H * .015)
        c = Vector((pts[-1].x, pts[-1].y, H * .82))
        R = (spread * .5, spread * .5, H * .14)
        shade = ct.crown_shade(c, R, low=.48, high=1.2)
        lr = random.Random(rng.random())
        tufts = []
        a0 = lr.uniform(0, math.tau)
        for k in range(limbs):
            t = k / max(1, limbs - 1)
            j, p = at(pts, (.52 + .28 * t) / .82)
            a = a0 + k * 2.2 + lr.uniform(-.3, .3)
            reach = spread * .5 * (1 - .4 * t) * lr.uniform(.8, 1.05)
            z = H * .86 - p.z + lr.uniform(-.04, .03) * H
            end = p + heading(a) * reach + Vector((0, 0, max(z, reach * .2)))
            lp = ct.limb(mesh, lr, p, end, radii[j] * .55, H * .004, bow=.3, sides=5)
            s = H * .05 * lr.uniform(.85, 1.1)
            tufts.append((end, s))
            for m in range(2):
                b = a + (m - .5) * lr.uniform(1.0, 1.6)
                tw = end + heading(b) * s * lr.uniform(1.3, 1.8) + Vector((0, 0, H * lr.uniform(-.02, .015)))
                tufts.append((tw, s * .85))
        tufts.append((pts[-1] + Vector((0, 0, H * .05)), H * .055))
        for p, s in tufts:
            clump(mesh, lr, p, s, 2, shade, c, elong=.5, spike=.55, inner=.72, rise=.1)
        cones(mesh, lr, [p + Vector((0, 0, -s * .8)) for p, s in tufts[::4]], H * .005)
    return build


# ---------------------------------------------------------------- palms

def fan(mesh, rng, base, d, length, width_deg, segs, droop, fold=.25, role='leaf', shade=None, notch=.3, join=.3,
        lw=.07):
    """A palm fan: a solid palm (to `join` of the length) splitting into
    `segs` separate leaflets radiating over `width_deg` round `d`, each a
    narrow two-sided spike bent at its middle, its tip falling by `droop`;
    `fold` lifts the middle (the costapalmate arch). Round 2: leaflets
    apart, so the fan's edge is a spiky star (one sheet read as a cabbage
    leaf)."""
    fr = random.Random(rng.random())
    n = max(4, segs // 2) if ct.FAR else segs
    d = d.normalized()
    side = Vector((-d.y, d.x, 0))
    side = side.normalized() if side.length > 1e-4 else frame(d)[0]
    up = d.cross(side).normalized()
    if up.z < 0:
        up = -up
    idx = mesh.slot(role)

    def put(poly, t0):
        for pp in (poly, list(reversed(poly))):
            vs = [mesh.bm.verts.new(p) for p in pp]
            f = mesh.bm.faces.new(vs)
            f.material_index = idx
            f.smooth = True
            for vt in vs:
                t = (vt.co - base).length / max(length, 1e-6)
                m = shade(vt.co, d) if shade else 1.0
                mm = m if isinstance(m, tuple) else (m, m, m)
                mesh.paint[vt] = (*[x * (.8 + .3 * t) for x in mm], .3 + .6 * t)
                mesh.normal[vt] = (d + up * .8).normalized()

    inner = []
    for k in range(n + 1):
        f = k / n - .5
        a = math.radians(width_deg) * f
        dirn = (d * math.cos(a) + side * math.sin(a)).normalized()
        inner.append((dirn, base + dirn * length * join + up * length * fold * .2 * (1 - abs(f) * 2)))
    for k in range(n):
        put([base, inner[k][1], inner[k + 1][1]], 0)
    for k in range(n):
        f = (k + .5) / n - .5
        dirn = (inner[k][0] + inner[k + 1][0]).normalized()
        root = inner[k][1].lerp(inner[k + 1][1], .5)
        w = length * lw
        sd = dirn.cross(up).normalized()
        L = length * (1 - join) * fr.uniform(.85, 1.05) * (1 - notch * abs(f) * 2)
        mid = root + dirn * L * .5 + up * L * fold * .3 - Vector((0, 0, L * droop * .25))
        tip = root + dirn * L - Vector((0, 0, L * droop * (1 + abs(f))))
        put([root - sd * w, root + sd * w, mid + sd * w * .7, mid - sd * w * .7], 0)
        put([mid - sd * w * .7, mid + sd * w * .7, tip], 0)


def cabbagepalm(height, boots, leaves):
    """Cabbage palm (sabal palmetto): a straight column, booted with
    criss-cross leaf bases on its upper part (`boots` the share), a dense
    round head of costapalmate fans all round, the old ones hanging."""
    def build(mesh, rng):
        H = height
        tall = H * .8
        lean = drift(rng, H * .03)
        pts = [Vector((0, 0, tall * k / 10)) + lean * (k / 10) ** 2 for k in range(11)]
        r = H * .022
        mesh.add_tube(pts, [r * (1.3 if k == 0 else 1) for k in range(11)], 8, 'bark', rng=rng, wobble=.02,
                      shade=lambda co, t: .95 + .1 * t, flex=lambda co, t: .1 * t * t)
        top = pts[-1]
        br = random.Random(rng.random())
        # The boots: stubby leaf bases sticking out and up, crossing, on the
        # upper trunk.
        z0 = tall * (1 - boots)
        nb = int(44 * boots) + 8
        for k in range(nb):
            t = k / nb
            z = z0 + (tall - z0) * t
            p = Vector((lean.x * (z / tall) ** 2, lean.y * (z / tall) ** 2, z))
            a = k * ct.GOLDEN + br.uniform(-.3, .3)
            o = heading(a)
            q = p + o * r * 1.7 + Vector((0, 0, r * 2.4))
            mesh.add_tube([p + o * r * .5, q], [r * .8, r * .5], 4, 'bark', shade=lambda co, t: .7 + .1 * t)
        c = top + Vector((0, 0, H * .06))
        R = H * .24
        shade = ct.crown_shade(c, (R, R, R), low=.55, high=1.2)
        fr = random.Random(rng.random())
        for i in range(leaves):
            y = 1 - (i + .5) / leaves * 1.7
            rr = math.sqrt(max(0, 1 - y * y))
            a = i * ct.GOLDEN + fr.uniform(-.2, .2)
            d = Vector((math.cos(a) * rr, math.sin(a) * rr, y * .8)).normalized()
            stalk = c + d * R * .45
            mesh.add_tube([c + d * R * .05, stalk], [r * .3, r * .2], 4, 'leaf', shade=lambda co, t: .8)
            fan(mesh, fr, stalk, d, R * fr.uniform(.7, .8), 200, 11, .35 + .3 * max(0, -y), fold=.3, shade=shade)
        # Round 8: dead fans hanging under the head (bark: the game paints
        # them the trunk's grey-tan), as in every picture.
        for k in range(6):
            o = heading(k * 2.4 + fr.uniform(-.3, .3))
            d = (o * .3 + Vector((0, 0, -1))).normalized()
            stalk = top + o * R * .32 - Vector((0, 0, R * .1))
            fan(mesh, fr, stalk, d, R * fr.uniform(.75, .85), 110, 9, .4, fold=.1, role='bark', shade=lambda p, n: .95)
        # Cream flower sprays arching out of the head (accent).
        for k in range(3):
            d = heading(k * 2.1 + fr.uniform(-.3, .3)) + Vector((0, 0, -.3))
            p0 = c + d * R * .2
            p1 = c + d * R * .9 + Vector((0, 0, -R * .3))
            mesh.add_tube([p0, p0.lerp(p1, .5) + Vector((0, 0, R * .15)), p1], [r * .2, r * .25, r * .15], 4, 'accent')
    return build


def sawpalmetto(height, spread, fans):
    """Saw palmetto: a low clump of stiff, nearly round green fans on long
    stalks rising from stems creeping along the ground."""
    def build(mesh, rng):
        H = height
        sr = random.Random(rng.random())
        roots = []
        for k in range(3):
            a = k / 3 * math.tau + sr.uniform(-.4, .4)
            p0 = heading(a) * spread * .05 + Vector((0, 0, .05))
            p1 = heading(a) * spread * .2 + Vector((0, 0, H * .08))
            mesh.add_tube([p0, p0.lerp(p1, .5) + Vector((0, 0, .05)), p1], [H * .06, H * .055, H * .05], 6, 'bark',
                          shade=lambda co, t: .8)
            roots.append((p0, p1))
        c = Vector((0, 0, H * .5))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .5), low=.6, high=1.2)
        # Round 3: the fans packed into a mound -- the middle ones high and
        # facing up, the rim ones low and facing out (on tall stalks apart
        # they read as little palm trees).
        for i in range(fans):
            f = math.sqrt((i + .5) / fans)
            a = i * ct.GOLDEN + sr.uniform(-.3, .3)
            out = heading(a)
            hgt = H * (.78 - .5 * f * f) * sr.uniform(.9, 1.08)
            tip = out * spread * .32 * f + Vector((0, 0, hgt))
            p0, p1 = roots[min(range(3), key=lambda k: (roots[k][1] - tip).length)]
            mesh.add_tube([p1, tip], [H * .012, H * .008], 4, 'leaf', shade=lambda co, t: .85)
            d = (out * (.3 + f) + Vector((0, 0, 1.2 - .6 * f)) + drift(sr, .25)).normalized()
            fan(mesh, sr, tip, d, H * sr.uniform(.4, .5), 270, 14, .12, fold=.05, shade=shade, notch=.15, join=.25,
                lw=.05)
        # Cream flower plumes in spring, dark berries after (accent).
        for k in range(3):
            p0, p1 = roots[k]
            q = p1 + Vector((0, 0, H * .72)) + drift(sr, .2)
            mesh.add_lump(q, (H * .04, H * .04, H * .11), 'accent', sr, subdiv=1, jitter=.15, flex=.6,
                          shade=lambda w, n: 1.0)
    return build


# ---------------------------------------------------------------- ground

def needles(mesh, rng, root, n, height, reach, width, droop=.5, role='leaf', dark=.55, light=1.15, segs=4):
    """A fountain of long needles: blades rising from one root, arching out
    and their tips falling."""
    nr = random.Random(rng.random())
    idx = mesh.slot(role)
    for i in range(n):
        a = i * ct.GOLDEN + nr.uniform(-.4, .4)
        out = heading(a)
        side = Vector((-out.y, out.x, 0))
        h = height * nr.uniform(.6, 1.0)
        L = reach * nr.uniform(.4, 1.0) * (1.2 - h / height * .4)
        pts = []
        for s in range(segs + 1):
            t = s / segs
            pts.append(root + out * (L * t) + Vector((0, 0, h * (t * 1.6 - droop * t * t * 1.6))))
        for s in range(segs):
            wa, wb = width * (1 - s / segs), width * (1 - (s + 1) / segs)
            pa, pb = pts[s], pts[s + 1]
            quad = [pa - side * wa, pa + side * wa, pb + side * wb, pb - side * wb] if s < segs - 1 else \
                [pa - side * wa, pa + side * wa, pb]
            for poly in (quad, list(reversed(quad))):
                vs = [mesh.bm.verts.new(p) for p in poly]
                f = mesh.bm.faces.new(vs)
                f.material_index = idx
                f.smooth = True
                for vt in vs:
                    t = max(0.0, min(1.0, (vt.co - root).length / max(h, 1e-6)))
                    val = dark + (light - dark) * t
                    mesh.paint[vt] = (val, val, val, t)
                    mesh.normal[vt] = Vector((0, 0, 1))


def grassstage(height, width):
    """Longleaf grass stage: a fountain of long needles straight from the
    ground, no trunk, a pale bud at its heart."""
    def build(mesh, rng):
        H = height
        needles(mesh, rng, Vector((0, 0, 0)), 110, H, width * .65, .011, droop=.72, segs=3)
        mesh.add_lump(Vector((0, 0, H * .12)), (H * .06, H * .06, H * .1), 'accent', rng, subdiv=1, jitter=.1,
                      flex=.2, shade=lambda w, n: 1.0)
    return build


def wiregrass(height, width):
    """Wiregrass: a fine, dense, wiry bunchgrass tuft, upright-arching,
    straw-tipped."""
    def build(mesh, rng):
        H = height
        for k in range(3):
            root = heading(k * 2.1) * width * .08
            ct.tuft(mesh, rng, root, blades=36, height=H, width=.006, spread=width * .5, lean=1.0, tip_from=.66)
    return build


MODELS = [
    ('Blender_LongleafPine_1', longleaf(30, 10, 9)),
    ('Blender_LongleafPine_2', longleaf(25, 8, 7)),
    ('Blender_LongleafGrass_1', grassstage(.8, 1.0)),
    ('Blender_LoblollyPine_1', loblolly(28, 12.5, False)),
    ('Blender_LoblollyPine_2', loblolly(24, 11, True)),
    ('Blender_SlashPine_1', slash(24, 11, 7)),
    ('Blender_SlashPine_2', slash(20, 8.5, 6)),
    ('Blender_CabbagePalm_1', cabbagepalm(14, .35, 42)),
    ('Blender_CabbagePalm_2', cabbagepalm(11, 1.0, 38)),
    ('Blender_SawPalmetto_1', sawpalmetto(1.5, 3.0, 26)),
    ('Blender_Wiregrass_1', wiregrass(.5, .5)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Colours from the specs' *Seasons* tables (docs/studies/us-landscapes/
# models/<id>.md). Accents: the pines' cones (brown), the longleaf's silver
# candles and the loblolly's yellow pollen in spring; the cabbage palm's
# cream flower sprays (summer) and black berries (autumn, winter); the saw
# palmetto's cream plumes (spring) and dark fruit; the grass stage's pale
# bud; wiregrass's straw tips. PLACED where the spec names no hex.
BARK = {'LongleafPine': '#8a5a3c', 'LongleafGrass': '#6a5a40', 'LoblollyPine': '#6e5a4a', 'SlashPine': '#7e5038',
        'CabbagePalm': '#8e8a80', 'SawPalmetto': '#7a6248', 'Wiregrass': '#6a5a40'}
LOOK = {'LongleafPine': ('#6a8a42', '#7a5a3a'), 'LongleafGrass': ('#647e40', '#c8c8b0'),
        'LoblollyPine': ('#5a7e38', '#7a5a3a'), 'SlashPine': ('#5f823a', '#7a5a3a'),
        'CabbagePalm': ('#527a3a', '#e6dcb4'), 'SawPalmetto': ('#66864a', '#4a5a3a'),
        'Wiregrass': ('#7a8a52', '#a8a070')}
SEASONS = {
    'spring': {'LongleafPine': ('#7a9a48', '#7a5a3a'), 'LongleafGrass': ('#6a8a42', '#e0e0d0'),
               'LoblollyPine': ('#6e8f3e', '#d8c050'), 'SlashPine': ('#6a8a40', '#7a5a3a'),
               'CabbagePalm': ('#557e3c', '#7a9a50'), 'SawPalmetto': ('#6a8a4a', '#ece4c4'),
               'Wiregrass': ('#8a9a5a', '#a8a070')},
    'autumn': {'LoblollyPine': ('#5a7e38', '#a0703a'), 'CabbagePalm': ('#527a3a', '#2a2a28'),
               'SawPalmetto': ('#66864a', '#2a2a28'), 'Wiregrass': ('#a89a5a', '#c0a868')},
    'winter': {'LongleafPine': ('#668642', '#7a5a3a'), 'LongleafGrass': ('#607a3e', '#c8c8b0'),
               'LoblollyPine': ('#567a36', '#7a5a3a'), 'SlashPine': ('#5c7e3a', '#7a5a3a'),
               'CabbagePalm': ('#50763a', '#2a2a28'), 'SawPalmetto': ('#628248', '#2a2a28'),
               'Wiregrass': ('#a8986a', '#b8a878')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        leaf, accent = SEASONS.get(season, {}).get(sp, LOOK[sp])
        t = {'leaf': hexrgb(leaf), 'bark': hexrgb(BARK[sp])}
        if accent:
            t['accent'] = hexrgb(accent)
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.3, 0.45, 0.2), 'bark': (0.42, 0.3, 0.22), 'accent': (0.5, 0.36, 0.22)},
          far={'Blender_LongleafPine_1', 'Blender_LongleafPine_2', 'Blender_LoblollyPine_1', 'Blender_LoblollyPine_2',
               'Blender_SlashPine_1', 'Blender_SlashPine_2', 'Blender_CabbagePalm_1', 'Blender_CabbagePalm_2'},
          tints=tints(SEASON))
