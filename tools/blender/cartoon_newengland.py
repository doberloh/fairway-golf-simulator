# THE NEW ENGLAND PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what New England lacked -- paper birch, white pine,
# balsam fir, American beech, a field-stone wall and a covered bridge.
#
#   node tools/blender/iterate.mjs cartoon_newengland <round> [--season s] [--far]
#
# Round 1 already answers the owner's note of 2 November ("the trees all look
# like big green fluffy balls on the trunks"): no tree's crown is one
# cloud_crown ellipsoid; each is built from parts placed to make its species'
# outline -- birch stems leaning apart with small clumps and sky between,
# white pine's separated flat shelves, balsam fir's sharp spire, beech's low
# broad dome on long level limbs.
#
# REFS paperbirch=Blender_PaperBirch_1,Blender_PaperBirch_2
# REFS whitepine=Blender_WhitePine_1,Blender_WhitePine_2
# REFS balsamfir=Blender_BalsamFir_1,Blender_BalsamFir_2
# REFS americanbeech=Blender_AmericanBeech_1,Blender_AmericanBeech_2
# REFS drystonewall=Blender_FieldWall_1
# REFS coveredbridge=Blender_CoveredBridge_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def at(pts, t):
    """The trunk point nearest fraction t of its height, and its index."""
    i = max(0, min(len(pts) - 1, int(round(t * (len(pts) - 1)))))
    return i, pts[i]


def paperbirch(height, spread, stems, limbs):
    """Paper birch: a clump of slender white stems leaning apart, marked with
    black, each carrying a few small clumps on short upswept limbs -- a light,
    narrow, open crown with sky between the clumps."""
    def build(mesh, rng):
        H = height
        c = Vector((0, 0, H * .7))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .32))
        for k in range(stems):
            a = k / stems * math.tau + rng.uniform(-.4, .4)
            out = Vector((math.cos(a), math.sin(a), 0))
            h = H * rng.uniform(.84, 1.0)
            pts, radii = ct.trunk(mesh, rng, out * .6, h, H * .016, lean=out * spread * rng.uniform(.3, .4),
                                  flare=1.25, sides=7, bend=H * .015, shade_low=.95, shade_high=1.1)
            # The black marks: short dark dashes round the white stem.
            # Own stream, so the far twin's fewer marks leave the rest of the
            # tree as the full model has it.
            mr = random.Random(rng.random())
            for j in range(3 if ct.FAR else 8):
                i, p = at(pts, mr.uniform(.05, .8))
                r = radii[i]
                b = mr.uniform(0, math.tau)
                d = Vector((math.cos(b), math.sin(b), 0))
                mesh.add_lump(p + d * r * .85, (r * .8, r * .8, r * .22), 'accent', mr, subdiv=0, jitter=.05, flex=.05)
            # Short upswept limbs from the upper half, one small near-round
            # clump at each end -- nothing part-way along, so sky shows.
            for j in range(limbs):
                f = j / max(1, limbs - 1)
                i, p = at(pts, .45 + .45 * f + rng.uniform(-.03, .03))
                b = a + rng.uniform(-1.5, 1.5)
                d = Vector((math.cos(b), math.sin(b), 0))
                L = spread * rng.uniform(.2, .3) * (1.1 - .45 * f)
                end = p + d * L + Vector((0, 0, L * rng.uniform(.5, .8)))
                ct.limb(mesh, rng, p, end, radii[i] * .55, radii[i] * .22, sides=4, bow=.15, shade=1.0)
                s = spread * rng.uniform(.11, .14)
                mesh.add_lump(end + Vector((0, 0, s * .3)), (s, s, s * .85), 'leaf', rng, subdiv=3, jitter=.16,
                              crown=c, blend=.6, shade=shade, flex=.8)
            s = spread * .1
            mesh.add_lump(pts[-1] + Vector((0, 0, s * .4)), (s * .85, s * .85, s), 'leaf', rng, subdiv=3, jitter=.16,
                          crown=c, blend=.6, shade=shade, flex=.9)
    return build


def whitepine(height, spread, tiers, flag, base):
    """Eastern white pine: a tall trunk carrying distinct, separated, flat
    horizontal shelves of soft blue-green tufts, ragged and swept to the lee
    (`flag` 0..1: how much the windward limbs are gone, as on old trees)."""
    def build(mesh, rng):
        H = height
        wind = Vector((1, 0, 0))
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .97, H * .02, lean=wind * H * .03 * flag,
                              flare=1.5, sides=7, bend=H * .01)
        c = Vector((0, 0, H * .6))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .45))
        for i in range(tiers):
            t = i / max(1, tiers - 1)
            j, p = at(pts, (base + (.9 - base) * t) / .97)
            n = 4 if t < .45 else (3 if t < .75 else 2)
            a0 = rng.uniform(0, math.tau)
            for k in range(n):
                a = a0 + k / n * math.tau + rng.uniform(-.5, .5)
                d = Vector((math.cos(a), math.sin(a), 0))
                lee = d.dot(wind)
                reach = spread * .5 * (1 - .5 * t) * (1 + .4 * flag * lee) * rng.uniform(.75, 1)
                if lee < -.3:
                    reach *= 1 - .5 * flag
                end = p + d * reach + Vector((0, 0, reach * .1))
                # Round 14: the far twin drops the limbs (hidden under the
                # shelves at its range); own stream, so both keep one shape.
                lr = random.Random(rng.random())
                if not ct.FAR:
                    ct.limb(mesh, lr, p, end, radii[j] * .5, H * .004, bow=.04, sides=4)
                # The shelf (round 3): a flat ragged star of tufts -- ct.skirt
                # laid on the limb -- over its outer part, a second nearer the
                # trunk on the long limbs. Round lumps read as bonsai pads.
                w = max(reach * .5, H * .05)
                # Round 8 dropped the far twin's inner pads; round 15 keeps
                # them (cheap at distance) and drops its limbs instead.
                spots = (1.0, .5) if reach > spread * .22 else (1.0,)
                pr = random.Random(rng.random())
                for f in spots:
                    q = p + d * reach * f + Vector((0, 0, reach * .1 * f + w * .12))
                    ww = w * (1 if f == 1.0 else .9)
                    ct.skirt(mesh, pr, q, ww, ww * .55, points=6, droop=.3, shade=shade, twist=pr.uniform(0, 1),
                             ragged=.25, flex=.8, thick=.5)
        # The leader: a small tuft leaning to the lee.
        s = spread * .08
        ct.skirt(mesh, rng, pts[-1] + wind * s * .3 * flag, s, s * 1.1, points=5, droop=.4, shade=shade, ragged=.2,
                 flex=.9, thick=.5)
    return build


def stack(mesh, rng, H, w, tiers, base, top, points, droop, depth, thick, ragged):
    shade = ct.crown_shade(Vector((0, 0, H * .5)), (w * .5, w * .5, H * .5), low=.5, high=1.18, core=.7)
    for i in range(tiers):
        t = i / (tiers - 1)
        z = H * (base + (top - base) * t)
        r = w * .5 * (1 - .95 * t) * rng.uniform(.95, 1.05) + H * .01
        ct.skirt(mesh, rng, Vector((0, 0, z)), r, H * depth * (1 - .3 * t), points=points + rng.randint(-1, 1),
                 droop=droop, shade=shade, twist=rng.uniform(0, 1), ragged=ragged, flex=.3 + .6 * t, thick=thick)


def balsamfir(height, width, tiers):
    """Balsam fir: a dense, narrow, regular dark spire to the ground with a
    sharp leader -- nothing like a cloud."""
    def build(mesh, rng):
        H = height
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .94, H * .02, lean=drift(rng, H * .004), flare=1.4, sides=6)
        stack(mesh, rng, H, width, tiers, .04, .93, 7, .25, .12, .66, .06)
        # The leader: a thin spike above the last tier.
        mesh.add_tube([Vector((0, 0, H * .91)), Vector((0, 0, H * .975))], [H * .012, H * .003], 5, 'leaf',
                      shade=lambda co, t: 1.1, flex=lambda co, t: .9)
    return build


def americanbeech(height, spread):
    """American beech: a short smooth grey trunk forking into long, nearly
    level lower limbs and rising upper ones -- a broad low dome, wider than
    tall, the trunk and the limbs' undersides showing."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .21, H * .05, lean=drift(rng, H * .01), flare=1.6,
                              sides=10, shade_low=.95, shade_high=1.1)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .5))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .38))

        def clump(q, s, squat=.8):
            mesh.add_lump(q, (s, s, s * squat), 'leaf', rng, subdiv=3, jitter=.12, crown=c, blend=.9, shade=shade,
                          flex=.8, squash_bottom=.3)
        # Round 3: a lower ring of seven long level limbs, overlapping clumps
        # part-way and at the end -- one broad continuous low edge.
        a0 = rng.uniform(0, math.tau)
        for i in range(7):
            a = a0 + i / 7 * math.tau + rng.uniform(-.2, .2)
            d = Vector((math.cos(a), math.sin(a), 0))
            end = top + d * spread * rng.uniform(.38, .44) + Vector((0, 0, H * rng.uniform(.06, .12)))
            ct.limb(mesh, rng, pts[-2], end, H * .022, H * .008, bow=.18, sides=6, shade=1.0)
            s = spread * .115
            for f in (.6, 1.0):
                clump(top + (end - top) * f + Vector((0, 0, s * .6 + H * .06 * (1 - f))), s * (1.1 if f < 1 else 1))
        # The upper dome: overlapping clumps on a half-shell, closer together
        # than their size, so the outline is one lumpy mass, not balls.
        dome = Vector((top.x, top.y, top.z + H * .22))
        for i in range(4):
            a = a0 + (i + .5) / 4 * math.tau
            end = dome + Vector((math.cos(a), math.sin(a), 0)) * spread * .2 + Vector((0, 0, H * .12))
            ct.limb(mesh, rng, pts[-2], end, H * .02, H * .008, bow=.12, sides=6, shade=1.0)
        n = 11
        for i in range(n):
            y = 1 - (i + .5) / n
            r = math.sqrt(max(0.0, 1 - y * y))
            a = i * ct.GOLDEN + rng.uniform(-.3, .3)
            q = dome + Vector((math.cos(a) * r * spread * .33, math.sin(a) * r * spread * .33, y * H * .38))
            clump(q, spread * rng.uniform(.135, .155))
    return build


def fieldwall(length, height):
    """One 2 m straight section of a New England field-stone wall along Y:
    tumbled rounded fieldstones in four rough courses, big at the foot,
    smaller and more broken along the top, a few lichened."""
    def build(mesh, rng):
        # Round 3: five uneven courses of flatter, more varied stones, the
        # foot wider than the top, and a dark core so no sky shows through.
        box(mesh, -.13, .13, -length / 2 + .05, length / 2 - .05, 0, height * .7, 'stone', .4)
        courses = ((0.0, .16, .34), (.2, .15, .31), (.39, .14, .28), (.57, .13, .25), (.75, .13, .22))
        for n, (z, rz, wx) in enumerate(courses):
            y = -length / 2 + rng.uniform(0, .12)
            while y < length / 2:
                sy = rng.uniform(.15, .32)
                if n == 4 and rng.random() < .25:
                    y += sy * 1.4
                    continue
                sx = wx * rng.uniform(.8, 1.05)
                p = Vector((rng.uniform(-.05, .05), min(y + sy * .8, length / 2 - sy * .4),
                            z * height + rng.uniform(-.03, .03) + (rng.uniform(-.06, .06) if n == 4 else 0)))
                ct.pebble_rock(mesh, rng, p, (sx, sy, rz * height * rng.uniform(.8, 1.2)), lumps=.3, subdiv=0, seat=0,
                               moss='accent' if rng.random() < .3 else None, moss_at=.55)
                y += sy * 1.55
        if WALL_REVIEW_X:
            turn(mesh)
    return build


# Rounds 2-5 turned the wall along X so the sheet's camera saw its run;
# from round 6 it is along Y, as the game lays it.
WALL_REVIEW_X = False


def turn(mesh):
    """Turn everything built so far a quarter round about Z (Y to X)."""
    for v in mesh.bm.verts:
        v.co = Vector((v.co.y, -v.co.x, v.co.z))
    for v, n in list(mesh.normal.items()):
        mesh.normal[v] = Vector((n.y, -n.x, n.z))


def hexa(mesh, p, role, shade=1.0):
    """A closed six-sided block from eight corners: p[0:4] the bottom ring
    counter-clockwise from above, p[4:8] the top ring in the same order."""
    faces = [list(reversed(p[0:4])), p[4:8]] + [[p[i], p[(i + 1) % 4], p[4 + (i + 1) % 4], p[4 + i]] for i in range(4)]
    for q in faces:
        f = mesh.face(q, role)
        for v in f.verts:
            mesh.paint[v] = (shade, shade, shade, 0.0)


def box(mesh, x0, x1, y0, y1, z0, z1, role, shade=1.0):
    ring = [Vector((x0, y0, 0)), Vector((x1, y0, 0)), Vector((x1, y1, 0)), Vector((x0, y1, 0))]
    hexa(mesh, [v + Vector((0, 0, z0)) for v in ring] + [v + Vector((0, 0, z1)) for v in ring], role, shade)


def coveredbridge(span, width, wall):
    """A New England covered bridge spanning X: a red board box on a timber
    deck, a gabled roof overhanging, an open portal with pale trim at each
    end, small dark windows down each side, stone abutments under the ends.
    The deck's top is at z = 0."""
    def build(mesh, rng):
        L, W = span / 2, width / 2
        # Deck and abutments.
        box(mesh, -W - .3, W + .3, -L - .3, L + .3, -.6, 0, 'bark', .7)
        for s in (-1, 1):
            box(mesh, -W - .7, W + .7, s * L - 1.6 if s > 0 else -L - .6, s * L + .6 if s > 0 else -L + 1.6, -2.6, -.6,
                'stone', .85)
        # Side walls (thin boxes, darker inside) and their windows.
        for s in (-1, 1):
            x0, x1 = (W - .2, W) if s > 0 else (-W, -W + .2)
            box(mesh, x0, x1, -L, L, 0, wall, 'accent', 1.0)
            # Round 3: the shadow band under the eaves.
            ex = (W, W + .04) if s > 0 else (-W - .04, -W)
            box(mesh, ex[0], ex[1], -L, L, wall - .4, wall, 'bark', .35)
            # Round 4: board battens down the wall and a pale sill at its foot.
            box(mesh, ex[0], ex[1], -L, L, 0, .22, 'stone', 1.0)
            xo = s * (W + .02)
            for k in range(int(span / 1.2)):
                y = -L + .6 + k * 1.2
                q = [Vector((xo, y - .05, .22)), Vector((xo, y + .05, .22)), Vector((xo, y + .05, wall - .4)),
                     Vector((xo, y - .05, wall - .4))]
                f = mesh.face(q if s > 0 else list(reversed(q)), 'accent')
                for v in f.verts:
                    mesh.paint[v] = (.72, .72, .72, 0.0)
            for k in range(5):
                y = -L + span * (k + .5) / 5
                xo = s * (W + .02)
                q = [Vector((xo, y - .45, wall * .5)), Vector((xo, y + .45, wall * .5)),
                     Vector((xo, y + .45, wall * .72)), Vector((xo, y - .45, wall * .72))]
                f = mesh.face(q if s > 0 else list(reversed(q)), 'bark')
                for v in f.verts:
                    mesh.paint[v] = (.35, .35, .35, 0.0)
        # Portals: the header over the opening, the gable, the trim.
        opening = wall * .82
        rise = W + .6
        for s in (-1, 1):
            y0, y1 = (L - .2, L) if s > 0 else (-L, -L + .2)
            box(mesh, -W, W, y0, y1, opening, wall, 'accent', 1.0)
            for yy, flip in ((s * L, s > 0), (s * (L - .2), s < 0)):
                g = [Vector((-W, yy, wall)), Vector((W, yy, wall)), Vector((0, yy, wall + W))]
                mesh.face(list(reversed(g)) if flip else g, 'accent')
            for x in (-W + .05, W - .35):
                box(mesh, x, x + .3, s * L - .08, s * L + .08, 0, opening, 'stone', 1.05)
            box(mesh, -W, W, s * L - .08, s * L + .08, opening - .25, opening, 'stone', 1.05)
        # Roof: two slabs, overhanging the walls and the portals.
        ze, zr, xe, Ly = wall - .6, wall + rise - .6, W + .6, L + .7
        th = Vector((0, 0, .25))
        left = [Vector((-xe, -Ly, ze)), Vector((0, -Ly, zr)), Vector((0, Ly, zr)), Vector((-xe, Ly, ze))]
        right = [Vector((0, -Ly, zr)), Vector((xe, -Ly, ze)), Vector((xe, Ly, ze)), Vector((0, Ly, zr))]
        for ring in (left, right):
            hexa(mesh, ring + [v + th for v in ring], 'bark', 1.0)
        # Built along Y, turned to span X (round 2: the sheet sees it end-on
        # along Y).
        turn(mesh)
    return build


MODELS = [
    ('Blender_PaperBirch_1', paperbirch(18, 8, 4, 4)),
    ('Blender_PaperBirch_2', paperbirch(15, 6.5, 2, 6)),
    ('Blender_WhitePine_1', whitepine(30, 15, 7, 1.0, .35)),
    ('Blender_WhitePine_2', whitepine(25, 12, 7, .4, .22)),
    ('Blender_BalsamFir_1', balsamfir(16, 5.3, 14)),
    ('Blender_BalsamFir_2', balsamfir(13, 4.4, 12)),
    ('Blender_AmericanBeech_1', americanbeech(18, 22)),
    ('Blender_AmericanBeech_2', americanbeech(15, 18)),
    ('Blender_FieldWall_1', fieldwall(2, 1.0)),
    ('Blender_CoveredBridge_1', coveredbridge(24, 5, 3.8)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'PaperBirch': '#ece8e0', 'WhitePine': '#4a4440', 'BalsamFir': '#6a6660', 'AmericanBeech': '#a8a8a0',
        'CoveredBridge': '#7a7670'}
LOOK = {
    'PaperBirch': {'spring': ('#a6c46a', '#2a2a2a'), 'summer': ('#5f8a3e', '#2a2a2a'), 'autumn': ('#e0c03a', '#2a2a2a'), 'winter': ('#5f8a3e', '#2a2a2a')},
    'WhitePine': {'spring': ('#5f8a5a', None), 'summer': ('#58825a', None), 'autumn': ('#58825a', None), 'winter': ('#557e58', None)},
    'BalsamFir': {'spring': ('#4f7442', None), 'summer': ('#3e6438', None), 'autumn': ('#3e6438', None), 'winter': ('#3a5e36', None)},
    'AmericanBeech': {'spring': ('#a8c46a', None), 'summer': ('#557e38', None), 'autumn': ('#d0a032', None), 'winter': ('#c8b48a', None)},
    'FieldWall': {s: ('#5a7a3e', '#8a9a6a') for s in ('spring', 'summer', 'autumn', 'winter')},
    'CoveredBridge': {s: ('#5a7a3e', '#a8322a') for s in ('spring', 'summer', 'autumn', 'winter')},
}
STONE = {'FieldWall': '#8a8a80', 'CoveredBridge': '#b8b0a0'}


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
        if sp in STONE:
            t['stone'] = hexrgb(STONE[sp])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.2, 0.2, 0.2)},
          far={'Blender_PaperBirch_1', 'Blender_PaperBirch_2', 'Blender_WhitePine_1', 'Blender_WhitePine_2',
               'Blender_BalsamFir_1', 'Blender_BalsamFir_2', 'Blender_AmericanBeech_1', 'Blender_AmericanBeech_2'},
          tints=tints(SEASON))
