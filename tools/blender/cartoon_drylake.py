# THE SONORAN AND LAKE DUNES PACK (the US landscapes goal, 2 November 2026;
# PLAN.md section 5, local): the two models each of those two landscapes
# lacked -- desert ironwood and jojoba for the Sonoran, sand cherry and a
# Great Lakes pierhead light for Lake Dunes. One small pack rather than two.
#
#   node tools/blender/iterate.mjs cartoon_drylake <round> [--season s] [--far]
#
# Each model's spec and pictures are the study's models/<id>.md and
# photos/models/<id>/ (local); each model's rounds are tools/blender/logs/<id>.md.
#
# REFS ironwood=Blender_Ironwood_1,Blender_Ironwood_2
# REFS jojoba=Blender_Jojoba_1
# REFS sandcherry=Blender_SandCherry_1
# REFS lighthouse=Blender_PierLight_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def box(mesh, lo, hi, role, shade=1.0):
    """An axis-aligned box from corner `lo` to corner `hi`, outward faces."""
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    b = [Vector((x0, y0, z0)), Vector((x1, y0, z0)), Vector((x1, y1, z0)), Vector((x0, y1, z0))]
    t = [Vector((p.x, p.y, z1)) for p in b]
    faces = [mesh.face(t, role)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append(mesh.face([b[i], b[j], t[j], t[i]], role))
    faces.append(mesh.face(list(reversed(b)), role))
    for f in faces:
        for v in f.verts:
            s = shade(v.co) if callable(shade) else shade
            mesh.paint[v] = (s, s, s, 0.0)
    return faces


def blossom(mesh, p, r, role, flex=.8):
    """A flower or berry as an octahedron, 8 triangles (an icosahedron
    lump is 20): sand cherry's many small blossoms (round 15)."""
    idx = mesh.slot(role)
    axes = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, -1, 0))]
    top = mesh.bm.verts.new(p + Vector((0, 0, r * .8)))
    bot = mesh.bm.verts.new(p - Vector((0, 0, r * .8)))
    ring = [mesh.bm.verts.new(p + a * r) for a in axes]
    for v in [top, bot, *ring]:
        mesh.paint[v] = (1.0, 1.0, 1.0, flex)
        mesh.normal[v] = (v.co - p).normalized()
    for i in range(4):
        a, b = ring[i], ring[(i + 1) % 4]
        for f in (mesh.bm.faces.new((a, b, top)), mesh.bm.faces.new((b, a, bot))):
            f.material_index = idx
            f.smooth = True


def ironwood(height, spread, stems, limbs, fill=1.0):
    """Desert ironwood: short heavy trunks splitting low into crooked
    spreading limbs, a broad open ragged grey-green crown with sky through
    it, wider than tall, its rim drooping; lavender pea flowers in May
    (accent). Round 2: the round-0 single cloud read as a lollipop. Round 18,
    the silhouette lineup: tidy round clumps on the limb ends read as bonsai.
    Round 19: each limb forks into crooked twigs, and the crown is many small
    ragged sprays on the twig tips, spaced so sky and limbs show between."""
    def build(mesh, rng):
        H, R = height, spread * .5
        cen = Vector((0, 0, H * .62))
        shade = ct.crown_shade(cen, (R, R, H * .4), low=.5, high=1.15)
        tips, half, hang = [], [], []
        for k in range(stems):
            a = k / stems * math.tau + rng.uniform(-.4, .4)
            out = Vector((math.cos(a), math.sin(a), 0))
            pts, radii = ct.trunk(mesh, rng, out * .12, H * .2, H * .06, lean=out * H * .14, flare=1.5, sides=6,
                                  bend=H * .03, steps=5)
            top = pts[-1]
            for j in range(limbs):
                b = a + (j - (limbs - 1) / 2) * (math.tau / stems / limbs) * 1.3 + rng.uniform(-.25, .25)
                ob = Vector((math.cos(b), math.sin(b), 0))
                r = R * rng.uniform(.38, .5)
                mid = ob * r + Vector((0, 0, H * rng.uniform(.6, .72))) + drift(rng, R * .08)
                ct.limb(mesh, rng, top, mid, radii[-1] * .8, H * .016, sides=5, bow=.18)
                tips.append((mid + Vector((0, 0, H * .08)), .9, 2))
                # The fork: two crooked twigs out to the rim, which droops.
                for t in range(2):
                    c2 = b + (t - .5) * rng.uniform(.5, .8)
                    rr = R * rng.uniform(.76, 1.05)
                    z = H * (.94 - .46 * (rr / R) ** 2) + rng.uniform(-.04, .04) * H
                    end = Vector((math.cos(c2) * rr, math.sin(c2) * rr, z))
                    tw = ct.limb(mesh, rng, mid, end, H * .014, H * .005, sides=4, bow=.22)
                    tips.append((end, 1.0, 1))
                    # Round 21: the rim droops -- a flake hangs under each
                    # outer twig's spray, lower the farther out.
                    hang.append(end + Vector((math.cos(c2), math.sin(c2), 0)) * R * .08 - Vector((0, 0, R * .13 * rr / R)))
                    # Round 20: a loose flake part-way along the twig, so the
                    # crown fills between the sprays without closing.
                    half.append(tw[3] + Vector((0, 0, H * .04)))
        # Two sprays over the middle, each on a limb up from a trunk (round
        # 19's floated), so the crown rises a little there.
        for k in range(2):
            p = Vector((0, 0, H * .95)) + drift(rng, R * .3)
            ct.limb(mesh, rng, drift(rng, R * .1) + Vector((0, 0, H * .2)), p - Vector((0, 0, H * .06)), H * .018, H * .006,
                    sides=4, bow=.25)
            tips.append((p, 1.0, 2))
        flowers = []
        for p, w, sub in tips:
            s = R * .16 * fill * w
            # A ragged spray: one soft lobe and two coarse flakes off it.
            # Round 23, the far twin (it was 4,000 triangles, the flakes
            # costing as much there as near): one bigger lobe a spray, the
            # flakes and the twig flakes left out. The skipped lumps still
            # draw their number, so the twin's outline matches the tree's.
            k = 1.3 if ct.FAR else 1.0
            mesh.add_lump(p, (s * k, s * k, s * .75 * k), 'leaf', rng, subdiv=sub, jitter=.2, crown=cen, blend=.7,
                          shade=shade, flex=.9, squash_bottom=.4)
            for f in range(2):
                b = rng.uniform(0, math.tau)
                q = p + Vector((math.cos(b) * s * 1.1, math.sin(b) * s * 1.1, s * rng.uniform(-.45, .25)))
                if ct.FAR:
                    rng.random()
                    continue
                mesh.add_lump(q, (s * .55, s * .55, s * .4), 'leaf', rng, subdiv=0, jitter=.25, crown=cen, blend=.7,
                              shade=shade, flex=.9)
            b = rng.uniform(0, math.tau)
            flowers.append(p + Vector((math.cos(b) * s * .8, math.sin(b) * s * .8, s * .5)))
        for p in hang:
            s = R * .09 * fill
            mesh.add_lump(p, (s, s, s * 1.2), 'leaf', rng, subdiv=1, jitter=.25, crown=cen, blend=.7, shade=shade, flex=.9)
        for p in half:
            s = R * .1 * fill
            if ct.FAR:
                rng.random()
                continue
            mesh.add_lump(p, (s, s, s * .7), 'leaf', rng, subdiv=1, jitter=.25, crown=cen, blend=.7, shade=shade, flex=.9)
        # The far twin keeps one flake in three: they are the last thing
        # built, so skipping some moves nothing else.
        for i, p in enumerate(flowers):
            # Round 23 (cost): one flower flake in four left out near, two in
            # three far.
            if (ct.FAR and i % 3) or i % 4 == 3:
                continue
            mesh.add_lump(p, (R * .05, R * .05, R * .03), 'accent', rng, subdiv=0, jitter=.15, flex=.9,
                          shade=lambda w, n: 1.0)
    return build


def jojoba(height, spread):
    """Jojoba: a dense upright mound of stiff grey-green leaves to the
    ground. Round 2: a small body of lobes under a skin of leaf flakes (big
    lobes alone read as a boulder)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        # Round 6: eight body lobes reaching the ground, so no flake floats.
        c = Vector((0, 0, H * .38))
        ct.cloud_crown(mesh, rng, c, (R * .84, R * .84, H * .38), lobes=8, lobe_size=(.52, .62), flat_bottom=.7,
                       shell=.55, core=False, low=.4, high=.95)
        shade = ct.crown_shade(c, (R, R, H * .5), low=.5, high=1.18)
        # Round 5: the flakes on a mound's profile, widest a third of the way
        # up and full to the ground (an ellipsoid's narrow foot read as a
        # ball on legs); the stems dropped, they only showed as legs.
        for k in range(105):
            u = rng.uniform(.2, 1) ** .8
            w = .74 + .26 * u / .35 if u < .35 else math.sqrt(max(0, 1 - ((u - .35) / .67) ** 2))
            r = w * rng.uniform(.86, .98)
            a = rng.uniform(0, math.tau)
            p = Vector((math.cos(a) * r * R, math.sin(a) * r * R, u * H * .95))
            mesh.add_lump(p, (R * .075, R * .075, H * .06), 'leaf', rng, subdiv=0, jitter=.3, crown=c, blend=.75,
                          shade=shade, flex=.7)
    return build


def sandcherry(height, spread):
    """Sand cherry: a low sprawl of thin wand-like stems arching out over the
    sand, narrow leaves and flowers along their upper parts; white flowers
    in May, dark cherries in summer (accent). Round 2: from a bonsai of six
    limbs and flat clouds to a dozen thin stems."""
    def build(mesh, rng):
        H, R = height, spread * .5
        shade = ct.crown_shade(Vector((0, 0, H * .4)), (R, R, H * .5), low=.6, high=1.15)
        # Round 3: sixteen stems, every third lying low; smaller, more leaves.
        for k in range(16):
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            out = Vector((math.cos(a), math.sin(a), 0))
            r = R * rng.uniform(.5, 1)
            end = out * r + Vector((0, 0, H * (rng.uniform(.25, .45) if k % 3 == 0 else rng.uniform(.55, 1))))
            pts = ct.limb(mesh, rng, out * .04, end, .018, .005, sides=4, bow=.25)
            for j in range(6):
                t = .3 + .7 * j / 5
                p = pts[0].lerp(pts[-1], t) + Vector((0, 0, H * .1 * math.sin(t * math.pi))) + drift(rng, R * .07)
                # Round 7: narrow leaves pointing up, as the pictures' willow-like
                # leaves, not round flakes.
                mesh.add_lump(p, (R * .05, R * .05, H * .15), 'leaf', rng, subdiv=0, jitter=.3, shade=shade, flex=.8)
                # Round 15: four blossoms a stem as octahedra (two icosahedra
                # left spring nearly green beside the pictures' white sprays).
                if j in (1, 2, 4, 5):
                    # Round 16: beside the leaf, not inside it.
                    side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized()
                    q = p + side * .07 + Vector((0, 0, .05))
                    blossom(mesh, q, .055, 'accent')
    return build


def pierlight(height):
    """A Great Lakes pierhead light, Grand Haven's inner light the model: a
    straight round red tower on the concrete end of a pier, a railed gallery
    of dark iron, a lantern of pale glass panes between dark mullions, a red
    roof and ball vent. Roles: accent the painted tower and roof, stone the
    concrete and the glass, bark the iron (gallery, rail, mullions, door).
    `height` is the tower's, from the pier deck to the vent's tip."""
    def build(mesh, rng):
        H = height
        deck = 1.0
        # The pier's end: a low concrete deck longer than wide (along Y);
        # round 3, from a 1.6 m plinth.
        box(mesh, (-3.0, -6.0, 0), (3.0, 6.0, deck), 'stone', shade=lambda co: .8 + .25 * co.z / deck)
        # The tower: a straight cylinder, a little wider at its foot.
        shaft = H * .74
        pts = [Vector((0, 0, deck + shaft * t / 4)) for t in range(5)]
        mesh.add_tube(pts, [1.45, 1.38, 1.34, 1.32, 1.32], 16, 'accent', shade=lambda co, t: .9 + .15 * t)
        # A door at its foot and two portholes up its side, facing -Y.
        box(mesh, (-.4, -1.52, deck), (.4, -1.25, deck + 2.0), 'bark', shade=.7)
        for z in (deck + shaft * .45, deck + shaft * .75):
            mesh.add_lump(Vector((0, -1.33, z)), (.22, .1, .22), 'bark', rng, subdiv=1, jitter=0, shade=lambda w, n: .7)
        z = deck + shaft
        # The gallery: a flared red corbel under it (round 12), a dark deck
        # out past the tower, a railing round it.
        mesh.add_tube([Vector((0, 0, z - 1.0)), Vector((0, 0, z - .5)), Vector((0, 0, z - .25))], [1.32, 1.45, 1.8], 16,
                      'accent', shade=lambda co, t: .8 + .1 * t, cap_end=False)
        mesh.add_tube([Vector((0, 0, z - .25)), Vector((0, 0, z))], [1.85, 1.85], 16, 'bark', shade=lambda co, t: .7)
        for k in range(12):
            a = k / 12 * math.tau
            p = Vector((math.cos(a) * 1.75, math.sin(a) * 1.75, z))
            mesh.add_tube([p, p + Vector((0, 0, 1.0))], [.04, .04], 4, 'bark', shade=lambda co, t: .7)
        ring = [Vector((math.cos(k / 16 * math.tau) * 1.75, math.sin(k / 16 * math.tau) * 1.75, z + 1.0)) for k in range(17)]
        mesh.add_tube(ring, [.05] * 17, 4, 'bark', shade=lambda co, t: .7)
        # The lantern: a low wall, then glass between mullions.
        mesh.add_tube([Vector((0, 0, z)), Vector((0, 0, z + .7))], [1.0, 1.0], 12, 'accent', shade=lambda co, t: .9)
        mesh.add_tube([Vector((0, 0, z + .7)), Vector((0, 0, z + 2.2))], [.95, .95], 12, 'stone', shade=lambda co, t: 1.15)
        for k in range(8):
            a = k / 8 * math.tau
            p = Vector((math.cos(a) * .97, math.sin(a) * .97, z + .7))
            mesh.add_tube([p, p + Vector((0, 0, 1.5))], [.06, .06], 4, 'bark', shade=lambda co, t: .7)
        # The red roof, and the ball vent on it.
        mesh.add_tube([Vector((0, 0, z + 2.2)), Vector((0, 0, z + 2.35)), Vector((0, 0, z + 3.2))], [1.25, 1.2, .15], 12,
                      'accent', shade=lambda co, t: .95)
        mesh.add_lump(Vector((0, 0, z + 3.4)), (.25, .25, .25), 'accent', rng, subdiv=1, jitter=0, shade=lambda w, n: 1.0)
        mesh.add_tube([Vector((0, 0, z + 3.6)), Vector((0, 0, z + 4.2))], [.04, .02], 4, 'bark')
    return build


MODELS = [
    ('Blender_Ironwood_1', ironwood(7, 10, 3, 3)),
    ('Blender_Ironwood_2', ironwood(5.5, 8, 2, 4, fill=.82)),
    ('Blender_Jojoba_1', jojoba(1.6, 1.8)),
    ('Blender_SandCherry_1', sandcherry(.7, 1.6)),
    ('Blender_PierLight_1', pierlight(16)),
]

# THE SHEET'S COLOURS BY SEASON (iterate.mjs --season; the study's models/<id>.md
# *Seasons*). An accent with no flowers that season is drawn the leaf's colour.
SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'Ironwood': '#7a746a', 'Jojoba': '#7a6e60', 'SandCherry': '#5a4038', 'PierLight': '#2a2a2a'}
LOOK = {
    'Ironwood': {'spring': ('#a49aa6', '#c8a8d8'), 'summer': ('#7d9070', '#7d9070'), 'autumn': ('#7d9070', '#7d9070'), 'winter': ('#7a8a6c', '#7a8a6c')},
    'Jojoba': {'spring': ('#7a8a6a', None), 'summer': ('#768668', None), 'autumn': ('#768668', None), 'winter': ('#728266', None)},
    'SandCherry': {'spring': ('#5a7a3e', '#f2efe4'), 'summer': ('#5a7a3e', '#3a1a2a'), 'autumn': ('#a83a2e', '#a83a2e'), 'winter': ('#5a7a3e', '#5a7a3e')},
    'PierLight': {s: ('#c8c4bc', '#a8322a') for s in ('spring', 'summer', 'autumn', 'winter')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        leaf, accent = LOOK[sp][season]
        t = {'leaf': hexrgb(leaf)}
        if accent:
            t['accent'] = hexrgb(accent)
        if sp in BARK:
            t['bark'] = hexrgb(BARK[sp])
        if sp == 'PierLight':
            t['stone'] = hexrgb('#c8c4bc')
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.4, 0.45, 0.35), 'bark': (0.42, 0.32, 0.24), 'accent': (0.8, 0.2, 0.15)},
          far={'Blender_Ironwood_1', 'Blender_Ironwood_2'}, tints=tints(SEASON))
