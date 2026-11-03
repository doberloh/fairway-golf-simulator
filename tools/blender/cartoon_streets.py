# THE STREETS PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): the man-made pieces of a golf course's roads and its
# parking lot -- a street lamp, a roadside mailbox, a parking-lot light pole,
# a concrete wheel stop, the clubhouse bag drop, the curbed island at the end
# of a parking row and the cart barn. No cars (PLAN): the stalls are ready for
# them.
#
#   node tools/blender/iterate.mjs cartoon_streets <round> [--season s]
#
# Every piece is built to real size in metres, its origin on the ground at the
# middle of its footprint, its front facing -Y (the road or the lane). The
# game places them by rule along the roads and round the lot. Metal is the
# bark role, glass and flags the accent, concrete and painted walls the stone,
# trim, racks and planting the leaf. No seasons to speak of: every season
# draws the same.
#
# REFS streetlight=Blender_StreetLight_1
# REFS mailbox=Blender_Mailbox_1
# REFS parking-lightpole=Blender_LightPole_1
# REFS parking-wheelstop=Blender_WheelStop_1
# REFS parking-bagdrop=Blender_BagDrop_1
# REFS parking-island=Blender_ParkingIsland_1
# REFS cartbarn=Blender_CartBarn_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
V = Vector


def facing(mesh, pts, role, out, shade=1.0):
    """A one-sided polygon wound so its front faces `out`."""
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


def box(mesh, lo, hi, role, shade=1.0, top=True, sides=(1, 1, 1, 1), bottom=False):
    """An axis box; `sides` (-Y, +X, +Y, -X) which walls. Walls lit a little
    by the side they face (the sun is low in the -X -Y quarter)."""
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
    if bottom:
        facing(mesh, [p + V((0, 0, z0)) for p in c], role, -UP, shade=shade * .6)


def extrude(mesh, prof, a0, a1, axis, role, shade=1.0, caps=(True, True), cap_shade=None):
    """A convex profile swept straight along an axis ('x' or 'y'): prof is
    (u, z) pairs across the other horizontal axis."""
    def at(u, z, a):
        return V((a, u, z)) if axis == 'x' else V((u, a, z))
    cu = sum(p[0] for p in prof) / len(prof)
    cz = sum(p[1] for p in prof) / len(prof)
    n = len(prof)
    for i in range(n):
        (u0, z0), (u1, z1) = prof[i], prof[(i + 1) % n]
        mu, mz = (u0 + u1) / 2 - cu, (z0 + z1) / 2 - cz
        out = at(mu, mz, 0) if axis == 'x' else at(mu, mz, 0)
        s = shade * (.75 + .3 * max(0.0, out.normalized().z) + .1 * max(0.0, -(out.x + out.y)))
        facing(mesh, [at(u0, z0, a0), at(u1, z1, a0), at(u1, z1, a1), at(u0, z0, a1)], role, out, shade=s)
    ax = V((1, 0, 0)) if axis == 'x' else V((0, 1, 0))
    for k, a in enumerate((a0, a1)):
        if caps[k]:
            facing(mesh, [at(u, z, a) for u, z in prof], role, ax * (1 if a > (a0 + a1) / 2 else -1),
                   shade=cap_shade if cap_shade is not None else shade * .9)


def rrect(hx, hy, r, n=3):
    """A rounded rectangle outline (counter-clockwise), n segments a corner."""
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cy = sx * (hx - r), sy * (hy - r)
        for i in range(n + 1):
            a = (k + i / n) * math.pi / 2
            pts.append(V((cx + math.cos(a) * r, cy + math.sin(a) * r, 0)))
    return pts


def band(mesh, outer, inner, z0, z1, zi, role, shade=1.0):
    """A curb: outer wall z0-z1 facing out, top between the rings at z1, inner
    wall down to zi facing in."""
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        a, b = outer[i], outer[j]
        d = b - a
        out = V((d.y, -d.x, 0))
        facing(mesh, [a + V((0, 0, z0)), b + V((0, 0, z0)), b + V((0, 0, z1)), a + V((0, 0, z1))], role, out,
               shade=shade * (.8 + .12 * max(0.0, -(out.normalized().x + out.normalized().y))))
        p, q = inner[i], inner[j]
        facing(mesh, [a + V((0, 0, z1)), b + V((0, 0, z1)), q + V((0, 0, z1)), p + V((0, 0, z1))], role, UP,
               shade=shade * 1.08)
        e = q - p
        facing(mesh, [p + V((0, 0, zi)), q + V((0, 0, zi)), q + V((0, 0, z1)), p + V((0, 0, z1))], role,
               V((-e.y, e.x, 0)), shade=shade * .7)


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15, shade=1.0):
    """A cheap jittered u-by-v sphere."""
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
        mesh.paint[x] = (*m, 0.0)
    return out


def metal(s):
    return lambda co, t: s


def post(mesh, zs, rs, sides, role, s=.9):
    mesh.add_tube([V((0, 0, z)) for z in zs], rs, sides, role, shade=metal(s))


# ---------------------------------------------------------------- street lamp

def streetlight(height):
    """A clubhouse-road acorn lamp: a flared cast base, a slim fluted post, a
    collar, and a tall acorn of warm glass under a crown cap and finial.
    Metal bark (black), glass accent. Origin at the foot, round."""
    def build(mesh, rng):
        H = height
        post(mesh, [0, .3, .4, .5, .95, 1.1], [.24, .22, .17, .13, .11, .13], 8, 'bark', .85)
        post(mesh, [1.1, 1.18, H - 1.1], [.13, .095, .08], 8, 'bark', .9)
        post(mesh, [1.9, 1.96, 2.08, 2.14], [.08, .11, .11, .08], 8, 'bark', .95)
        post(mesh, [H - 1.05, H - .98, H - .9], [.13, .13, .1], 8, 'bark', .95)
        g = H - .9
        mesh.add_tube([V((0, 0, g + z)) for z in (0, .08, .28, .52, .68)], [.1, .23, .29, .27, .18], 10, 'accent',
                      shade=lambda co, t: 1.15 - .2 * t, cap_end=False)
        post(mesh, [g + .66, g + .72, g + .8, g + .86, H], [.17, .17, .1, .05, .015], 8, 'bark', .95)
    return build


# ---------------------------------------------------------------- mailbox

def mailbox():
    """A rural roadside mailbox: a 0.48 m arched steel box on a wooden arm and
    a 4-inch post, its door to the road (-Y), the red flag up on its +X side.
    Box stone, post bark, flag accent. Box bottom 1.07 m (USPS 41-45 in)."""
    def build(mesh, rng):
        box(mesh, (-.06, .17, 0), (.06, .29, 1.42), 'bark', shade=.95)
        box(mesh, (-.075, .155, 1.42), (.075, .305, 1.47), 'bark', shade=1.0)
        box(mesh, (-.045, -.3, 1.02), (.045, .17, 1.07), 'bark', shade=.95)
        for sx in (-1, 1):
            facing(mesh, [V((sx * .03, .17, .72)), V((sx * .03, .17, .8)), V((sx * .03, -.22, 1.02)), V((sx * .03, -.16, 1.02))],
                   'bark', V((sx, 0, 0)), shade=.9 if sx < 0 else .8)
        mesh.add_tube([V((0, -.26, .93)), V((0, .17, .93))], [.055, .055], 8, 'bark', shade=metal(1.0))
        w, zb, zs = .085, 1.07, 1.17
        prof = [(-w, zb), (w, zb), (w, zs)] + [(math.cos(a) * w, zs + math.sin(a) * w)
                                                for a in (math.pi * k / 6 for k in range(1, 6))] + [(-w, zs)]
        extrude(mesh, prof, -.33, .15, 'y', 'stone', shade=1.0, cap_shade=.8)
        # The flag on its pivot near the back, raised.
        for s in (1, -1):
            x = w + .012 + .004 * s
            facing(mesh, [V((x, .03, zb + .04)), V((x, .06, zb + .04)), V((x, .06, zs + .21)), V((x, .03, zs + .21))],
                   'accent', V((s, 0, 0)), shade=.95)
            facing(mesh, [V((x, .03, zs + .06)), V((x, -.13, zs + .06)), V((x, -.13, zs + .21)), V((x, .03, zs + .21))],
                   'accent', V((s, 0, 0)), shade=1.0)
    return build


# ---------------------------------------------------------------- parking-lot light pole

def lightpole(height, heads):
    """A parking-lot light: a round concrete pier, a square bronze steel pole
    and flat shoebox heads on short arms (two, back to back along X). Pole
    bark, pier stone, lenses accent (on the heads' undersides)."""
    def build(mesh, rng):
        H = height
        mesh.add_tube([V((0, 0, z)) for z in (0, .85, .92)], [.3, .3, .25], 8, 'stone', shade=metal(.95))
        box(mesh, (-.17, -.17, .92), (.17, .17, .98), 'bark', shade=.8)
        box(mesh, (-.08, -.08, .98), (.08, .08, H), 'bark', shade=.95)
        hz = H - .3
        for k in range(heads):
            a = k / heads * math.tau
            d = V((math.cos(a), math.sin(a), 0))
            side = V((-d.y, d.x, 0))
            box_like(mesh, d, side, .075, .45, .04, hz + .06, hz + .12, 'bark', .9)
            box_like(mesh, d, side, .45, 1.2, .3, hz, hz + .2, 'bark', 1.0, lens=True)
    return build


def box_like(mesh, d, side, r0, r1, half, z0, z1, role, shade, lens=False):
    """A box laid along direction d from r0 to r1 out, half-width `half`."""
    c = [d * r0 - side * half, d * r1 - side * half, d * r1 + side * half, d * r0 + side * half]
    for i in range(4):
        a, b = c[i], c[(i + 1) % 4]
        mid = (a + b) * .5 - d * (r0 + r1) * .5
        facing(mesh, [a + V((0, 0, z0)), b + V((0, 0, z0)), b + V((0, 0, z1)), a + V((0, 0, z1))], role, mid,
               shade=shade * (.85 + .15 * max(0.0, -(mid.normalized().x + mid.normalized().y))))
    facing(mesh, [p + V((0, 0, z1)) for p in c], role, UP, shade=shade * 1.05)
    if lens:
        inset = [d * (r0 + .06) - side * (half - .05), d * (r1 - .05) - side * (half - .05),
                 d * (r1 - .05) + side * (half - .05), d * (r0 + .06) + side * (half - .05)]
        facing(mesh, [p + V((0, 0, z0)) for p in c], role, -UP, shade=shade * .5)
        facing(mesh, [p + V((0, 0, z0 - .01)) for p in inset], 'accent', -UP, shade=1.2)


# ---------------------------------------------------------------- wheel stop

def wheelstop(length):
    """A precast concrete wheel stop: 1.83 m long across the stall (along X),
    0.23 m wide, 0.15 m tall, chamfered top. Stone. The car comes from -Y."""
    def build(mesh, rng):
        prof = [(-.115, 0), (.115, 0), (.115, .07), (.07, .15), (-.07, .15), (-.115, .07)]
        extrude(mesh, prof, -length / 2, length / 2, 'x', 'stone', shade=1.0)
        # Two painted yellow bands over the top and the car's face.
        for x in (-.45, .45):
            for (u0, z0), (u1, z1), out in (((-.115, .07), (-.07, .15), V((0, -1, 1))), ((-.07, .15), (.07, .15), UP)):
                facing(mesh, [V((x - .2, u0 - .003 * (out.y < 0), z0 + .003)), V((x + .2, u0 - .003 * (out.y < 0), z0 + .003)),
                              V((x + .2, u1, z1 + .003)), V((x - .2, u1, z1 + .003))], 'accent', out, shade=1.0)
    return build


# ---------------------------------------------------------------- bag drop

def bagdrop():
    """The clubhouse bag drop: a 10 x 6 m hipped canopy on four square
    columns over the drop lane (along X), a raised walk on its +Y side where
    a bronze bag rack stands with a few bags in it. Columns, beams and walk
    stone; roof bark; rack leaf; bags accent. Front (-Y) is the lane's far
    side; the clubhouse is to +Y."""
    def build(mesh, rng):
        cx, cy = 4.6, 2.6
        box(mesh, (-5.6, 1.6, 0), (5.6, 3.8, .15), 'stone', shade=.82)
        for sx in (-1, 1):
            for sy in (-1, 1):
                z0 = .15 if sy > 0 else 0
                box(mesh, (sx * cx - .32, sy * cy - .32, z0), (sx * cx + .32, sy * cy + .32, z0 + .6), 'stone', shade=.9)
                box(mesh, (sx * cx - .22, sy * cy - .22, z0 + .6), (sx * cx + .22, sy * cy + .22, 3.3), 'stone', top=False)
                box(mesh, (sx * cx - .3, sy * cy - .3, 3.3), (sx * cx + .3, sy * cy + .3, 3.5), 'stone', top=False,
                    bottom=True, shade=1.0)
        box(mesh, (-cx - .3, -cy - .3, 3.5), (cx + .3, cy + .3, 3.95), 'stone', top=False, bottom=True, shade=1.0)
        e, rx, ry, ridge = 3.95, 5.4, 3.4, 5.3
        A, B, C, D = V((-rx, -ry, e)), V((rx, -ry, e)), V((rx, ry, e)), V((-rx, ry, e))
        R0, R1 = V((-rx + ry, 0, ridge)), V((rx - ry, 0, ridge))
        for q, out in (([A, B, R1, R0], V((0, -1, 2))), ([C, D, R0, R1], V((0, 1, 2))),
                       ([B, C, R1], V((1, 0, 2))), ([D, A, R0], V((-1, 0, 2)))):
            facing(mesh, q, 'bark', out, shade=1.0)
        facing(mesh, [A, B, C, D], 'stone', -UP, shade=.62)
        # Round 7: a white fascia board round the roof edge.
        for P, Q, out in ((A, B, V((0, -1, 0))), (B, C, V((1, 0, 0))), (C, D, V((0, 1, 0))), (D, A, V((-1, 0, 0)))):
            facing(mesh, [P - UP * .2, Q - UP * .2, Q, P], 'stone', out,
                   shade=1.0 if out.x + out.y < 0 else .82)
        # The sign hung under the front beam (round 3).
        box(mesh, (-1.1, -2.98, 2.95), (1.1, -2.86, 3.5), 'leaf', shade=1.0, bottom=True)
        facing(mesh, [V((-.8, -2.99, 3.12)), V((.8, -2.99, 3.12)), V((.8, -2.99, 3.3)), V((-.8, -2.99, 3.3))], 'stone',
               V((0, -1, 0)), shade=1.05)
        # The rack: two rails front and back, posts, dividers across.
        y0, y1, x0, x1 = 2.3, 2.8, -2.6, 2.6
        for x in (x0, 0, x1):
            for y in (y0, y1):
                box(mesh, (x - .03, y - .03, .15), (x + .03, y + .03, 1.0), 'leaf', shade=.9)
        for y in (y0, y1):
            for z in (.55, .95):
                box(mesh, (x0, y - .025, z), (x1, y + .025, z + .05), 'leaf', shade=1.0)
        for i in range(9):
            x = x0 + (x1 - x0) * (i + .5) / 9
            box(mesh, (x - .025, y0, .95), (x + .025, y1, 1.0), 'leaf', shade=1.0)
        for i, x in enumerate((-1.75, -.6, 1.2)):
            b = V((x, 2.55, .15))
            t = b + V((.05 * (i - 1), -.12, .85))
            mesh.add_tube([b, t], [.15, .14], 6, 'accent', shade=lambda co, tt: .9 + .2 * tt)
            lowball(mesh, t + V((0, 0, .1)), (.13, .13, .12), 'bark', rng, u=6, v=3, jitter=.3, shade=1.1)
    return build


# ---------------------------------------------------------------- parking island

def island(width, length):
    """The curbed island at the end of a parking row: a 15 cm concrete curb
    round a rounded rectangle (width across X, length along the stall, Y),
    filled with a mulch bed and a few low groundcover clumps at the ends; its
    middle is left clear for the landscape's own tree. Curb stone, mulch
    bark, planting leaf."""
    def build(mesh, rng):
        hx, hy = width / 2, length / 2
        outer = rrect(hx, hy, 1.0, 3)
        inner = rrect(hx - .15, hy - .15, .85, 3)
        band(mesh, outer, inner, 0, .15, .1, 'stone', shade=1.0)
        c = V((0, 0, .14))
        for i in range(len(inner)):
            a, b = inner[i], inner[(i + 1) % len(inner)]
            facing(mesh, [c, a + V((0, 0, .1)), b + V((0, 0, .1))], 'bark', UP, shade=.9)
        for sy in (-1, 1):
            for x in (-.45, .45):
                p = V((x + rng.uniform(-.1, .1), sy * (hy - .75), .12))
                lowball(mesh, p, (.32, .32, .2), 'leaf', rng, u=6, v=3, jitter=.25, shade=1.0)
        # Round 4: pale river rocks along one long side (pic 04).
        for i in range(5):
            p = V((hx - .38 + rng.uniform(-.05, .05), -1.2 + .6 * i + rng.uniform(-.1, .1), .12))
            r = rng.uniform(.09, .14)
            lowball(mesh, p, (r * 1.3, r, r * .7), 'stone', rng, u=5, v=3, jitter=.2, shade=.95)
    return build


# ---------------------------------------------------------------- cart barn

def cart(mesh, cx, cy):
    """A plain golf cart nose to -Y (2.4 x 1.2 x 1.9 m): white body and
    cowl (leaf), grey seat (accent), canopy and tyres (bark)."""
    for x in (cx - .55, cx + .55):
        for y in (cy - .8, cy + .8):
            box(mesh, (x - .08, y - .22, 0), (x + .08, y + .22, .44), 'bark', shade=.3)
    box(mesh, (cx - .6, cy - 1.2, .25), (cx + .6, cy + 1.2, .55), 'leaf', bottom=True)
    box(mesh, (cx - .6, cy - 1.2, .55), (cx + .6, cy - .6, .85), 'leaf')
    box(mesh, (cx - .55, cy - .1, .55), (cx + .55, cy + .45, .75), 'accent', shade=.8)
    box(mesh, (cx - .55, cy + .35, .75), (cx + .55, cy + .5, 1.15), 'accent', shade=.8)
    box(mesh, (cx - .4, cy + .6, .55), (cx + .4, cy + 1.1, 1.0), 'bark', shade=.5)
    for x in (cx - .55, cx + .55):
        for y, z in ((cy - .55, .85), (cy + .5, .75)):
            box(mesh, (x - .03, y - .03, z), (x + .03, y + .03, 1.8), 'bark', shade=.6, top=False)
    box(mesh, (cx - .65, cy - .85, 1.8), (cx + .65, cy + .75, 1.88), 'bark', bottom=True)


def cartbarn(length, depth):
    """The cart barn: a long low shed (40 x 12 m, eaves 3.4 m, ridge 5 m),
    a row of roll-up doors along its front (-Y), some open dark, a big door
    in each gable end, white trim, a low cupola on the ridge. Walls stone,
    roof bark, doors accent, trim leaf."""
    def build(mesh, rng):
        hx, hy, eave, ridge = length / 2, depth / 2, 3.4, 5.0
        box(mesh, (-hx, -hy, 0), (hx, hy, 1.0), 'stone', top=False, shade=.8)
        box(mesh, (-hx, -hy, 1.0), (hx, hy, eave), 'stone', top=False, shade=1.0)
        for sx in (-1, 1):
            facing(mesh, [V((sx * hx, -hy, eave)), V((sx * hx, hy, eave)), V((sx * hx, 0, ridge - .05))], 'stone',
                   V((sx, 0, 0)), shade=.82 if sx > 0 else .94)
        ox, oy = hx + .45, hy + .6
        ez = eave - (ridge - eave) * (oy - hy) / hy
        for sy in (-1, 1):
            q = [V((-ox, sy * oy, ez)), V((ox, sy * oy, ez)), V((ox, 0, ridge)), V((-ox, 0, ridge))]
            facing(mesh, q, 'bark', V((0, sy * (ridge - eave), hy)), shade=1.0)
            facing(mesh, [c - V((0, 0, .18)) for c in q], 'bark', V((0, -sy * (ridge - eave), -hy)), shade=.45)
            facing(mesh, [V((-ox, sy * oy, ez - .2)), V((ox, sy * oy, ez - .2)), V((ox, sy * oy, ez)), V((-ox, sy * oy, ez))],
                   'leaf', V((0, sy, 0)), shade=1.0 if sy < 0 else .8)
        # Roll-up doors along the front.
        n, dw, dh = 8, 3.0, 2.8
        pitch = (length - 4.0) / n
        for i in range(n):
            x = -hx + 2.0 + pitch * (i + .5)
            open_ = i in (2, 5)
            y = -hy - .02
            facing(mesh, [V((x - dw / 2, y, 0)), V((x + dw / 2, y, 0)), V((x + dw / 2, y, dh)), V((x - dw / 2, y, dh))],
                   'bark' if open_ else 'accent', V((0, -1, 0)), shade=.22 if open_ else 1.0)
            if not open_:
                for zr in (.9, 1.8):
                    facing(mesh, [V((x - dw / 2, y - .01, zr)), V((x + dw / 2, y - .01, zr)), V((x + dw / 2, y - .01, zr + .07)),
                                  V((x - dw / 2, y - .01, zr + .07))], 'accent', V((0, -1, 0)), shade=.7)
            box(mesh, (x - dw / 2 - .15, -hy - .08, 0), (x - dw / 2, -hy, dh + .2), 'leaf', top=False)
            box(mesh, (x + dw / 2, -hy - .08, 0), (x + dw / 2 + .15, -hy, dh + .2), 'leaf', top=False)
            box(mesh, (x - dw / 2, -hy - .08, dh), (x + dw / 2, -hy, dh + .2), 'leaf')
        for sx in (-1, 1):
            x = sx * (hx - 1.3)
            y = -hy - .03
            facing(mesh, [V((x - .45, y, 0)), V((x + .45, y, 0)), V((x + .45, y, 2.1)), V((x - .45, y, 2.1))], 'leaf',
                   V((0, -1, 0)), shade=.95)
            facing(mesh, [V((x - .75, -hy, 2.7)), V((x + .75, -hy, 2.7)), V((x + .75, -hy - .7, 2.35)),
                          V((x - .75, -hy - .7, 2.35))], 'bark', V((0, -.5, 1)), shade=.9)
            facing(mesh, [V((x - .75, -hy, 2.64)), V((x + .75, -hy, 2.64)), V((x + .75, -hy - .7, 2.29)),
                          V((x - .75, -hy - .7, 2.29))], 'bark', V((0, .5, -1)), shade=.4)
        # Round 12: small dark windows with white sills along the back.
        for i in range(8):
            x = -hx + 2.5 + (length - 5.0) * i / 7
            y = hy + .02
            facing(mesh, [V((x - .6, y, 1.6)), V((x + .6, y, 1.6)), V((x + .6, y, 2.5)), V((x - .6, y, 2.5))], 'bark',
                   V((0, 1, 0)), shade=.3)
            box(mesh, (x - .7, hy, 1.5), (x + .7, hy + .08, 1.6), 'leaf', shade=.9)
        for sx in (-1, 1):
            x = sx * (hx + .02)
            facing(mesh, [V((x, -1.8, 0)), V((x, 1.8, 0)), V((x, 1.8, 3.0)), V((x, -1.8, 3.0))], 'bark', V((sx, 0, 0)),
                   shade=.22)
            facing(mesh, [V((x, -.6, 3.7)), V((x, .6, 3.7)), V((x, .6, 4.4)), V((x, -.6, 4.4))], 'leaf', V((sx, 0, 0)),
                   shade=.9)
        # Round 5: the cart line, five carts nose-out beside the right open door.
        for i in range(5):
            cart(mesh, 9.0 + 1.5 * i, -hy - 1.7)
        # Cupola.
        box(mesh, (-1.0, -1.0, ridge - .5), (1.0, 1.0, ridge + 1.0), 'stone', top=False)
        for out, side in ((V((0, -1, 0)), V((1, 0, 0))), (V((1, 0, 0)), V((0, 1, 0)))):
            p = V((0, 0, ridge + .2)) + out * 1.02
            facing(mesh, [p - side * .6, p + side * .6, p + side * .6 + UP * .6, p - side * .6 + UP * .6], 'bark', out,
                       shade=.3)
        top = V((0, 0, ridge + 2.0))
        k = [V((-1.3, -1.3, ridge + 1.0)), V((1.3, -1.3, ridge + 1.0)), V((1.3, 1.3, ridge + 1.0)), V((-1.3, 1.3, ridge + 1.0))]
        for i in range(4):
            a, b = k[i], k[(i + 1) % 4]
            facing(mesh, [a, b, top], 'bark', (a + b) * .5 - V((0, 0, ridge)) + UP * 3, shade=1.0)
    return build


MODELS = [
    ('Blender_StreetLight_1', streetlight(5.0)),
    ('Blender_Mailbox_1', mailbox()),
    ('Blender_LightPole_1', lightpole(9.2, 2)),
    ('Blender_WheelStop_1', wheelstop(1.83)),
    ('Blender_BagDrop_1', bagdrop()),
    ('Blender_ParkingIsland_1', island(2.5, 5.5)),
    ('Blender_CartBarn_1', cartbarn(40.0, 12.0)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Role colours from each spec's *Spec* colours (none change with the season).
LOOK = {
    'StreetLight': {'bark': '#2a2a2a', 'accent': '#f2e6bc', 'stone': '#6a6a6a', 'leaf': '#2a2a2a'},
    'Mailbox': {'stone': '#2a2a2a', 'bark': '#ece8de', 'accent': '#c8302a', 'leaf': '#2a2a2a'},
    'LightPole': {'bark': '#3a342e', 'stone': '#c8c4b8', 'accent': '#f4f0dc', 'leaf': '#3a342e'},
    'WheelStop': {'stone': '#c8c4b8', 'accent': '#e8c030', 'bark': '#6a6a6a', 'leaf': '#6a6a6a'},
    'BagDrop': {'stone': '#ece6d8', 'bark': '#5e6266', 'leaf': '#4a3426', 'accent': '#b8302a'},
    'ParkingIsland': {'stone': '#c8c4b8', 'bark': '#5a3e2a', 'leaf': '#4f7436', 'accent': '#4f7436'},
    'CartBarn': {'stone': '#e4ded0', 'bark': '#5c666c', 'accent': '#a9aeb2', 'leaf': '#f4f2ea'},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        out[name] = {role: hexrgb(h) for role, h in LOOK[sp].items()}
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.8, 0.5, 0.2),
                           'stone': (0.9, 0.88, 0.82)},
          tints=tints(SEASON))
