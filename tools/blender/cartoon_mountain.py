# THE MOUNTAIN PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what the Rockies lacked.
#
#   node tools/blender/iterate.mjs cartoon_mountain <round> [--season s] [--far]
#   node tools/blender/run.mjs cartoon_mountain --render
#
# Each model's spec and pictures are the study's models/<id>.md and
# photos/models/<id>/ (local); each model's rounds are tools/blender/logs/<id>.md.
# The conifer tiers are cartoon_conifer.py's way of drawing them (a stack of
# drooping skirts), copied rather than imported: importing a pack runs its
# export (docs/BLENDER_ASSETS.md).
#
# REFS lodgepole=Blender_Lodgepole_1,Blender_Lodgepole_2
# REFS bluespruce=Blender_BlueSpruce_1,Blender_BlueSpruce_2
# REFS willowthicket=Blender_WillowThicket_1
# REFS splitrailfence=Blender_SplitRailFence_1
# REFS columbine=Blender_Columbine_1
# REFS lupine=Blender_Lupine_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def stack(mesh, rng, H, w, tiers, lean, base, top, points, droop, ragged, power, depth, thick, high=1.18):
    shade = ct.crown_shade(Vector((0, 0, H * 0.5)), (w * 0.5, w * 0.5, H * 0.5), low=0.5, high=high, core=0.7)
    for i in range(tiers):
        t = i / (tiers - 1)
        z = H * (base + (top - base) * t)
        r = w * 0.5 * (1 - 0.92 * t) ** power * rng.uniform(0.93, 1.07) + H * 0.018
        d = H * depth * (1 - 0.3 * t)
        ct.skirt(mesh, rng, Vector((0, 0, z)) + lean * (z / H) ** 2, r, d, points=points + rng.randint(-1, 1),
                 droop=droop, shade=shade, twist=rng.uniform(0, 1), ragged=ragged, flex=0.3 + 0.6 * t, thick=thick)


def lodgepole(height, width, tiers):
    """Lodgepole pine: a very straight, thin, tall trunk and a narrow crown
    down its upper 40-50% (round 2: a crown in the top third read as a toy
    tree on a stick)."""
    def build(mesh, rng):
        H, w = height, width
        lean = drift(rng, H * .008)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .96, H * .021, lean=lean, flare=1.3, sides=8,
                              shade_low=.85, shade_high=1.05)
        # Round 11: dead branch stubs up the bare lower trunk, as on every
        # pole in a lodgepole stand.
        for k in range(10):
            t = rng.uniform(.18, .5)
            i = int(t * (len(pts) - 1))
            p, r = pts[i], radii[i]
            a = rng.uniform(0, math.tau)
            d = Vector((math.cos(a), math.sin(a), -.15))
            mesh.add_tube([p, p + d * H * rng.uniform(.03, .06)], [r * .3, r * .08], 3, 'bark', shade=lambda co, t: .75)
        stack(mesh, rng, H, w, tiers, lean, .5, .97, 6, .3, .34, .8, .11, .6)
    return build


def bluespruce(height, width, tiers):
    """Colorado blue spruce: a stiff, dense, symmetrical cone to the ground,
    silver-blue (round 2: more, smaller, more ragged tiers)."""
    def build(mesh, rng):
        H, w = height, width
        lean = drift(rng, H * .006)
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .92, H * .024, lean=lean, flare=1.6, sides=8)
        # Round 12: the upper tiers lighter, the new growth showing from the top.
        stack(mesh, rng, H, w, tiers, lean, .05, .94, 9, .3, .2, 1.0, .13, .7, high=1.34)
    return build


def willowthicket(height, spread):
    """A willow thicket: a dense clump of fine upright shoots, red and yellow
    at the foot, leafy above (round 4: lobes of any size read as broccoli on
    sticks; the pictures are shoots). Each shoot a thin two-sided blade."""
    def build(mesh, rng):
        H = height
        for k in range(9):
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            r = spread * rng.uniform(.05, .32)
            root = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            ct.tuft(mesh, rng, root, blades=11, height=H * rng.uniform(.5, .7), width=.034, spread=spread * .4,
                    lean=.3, low='bark', tip='leaf', tip_from=.45, dark=.7, light=1.1)
        # Round 5: the leafy mound -- many small narrow leaf pieces through a
        # dome over the shoots, which gives a thicket's fine texture.
        c = Vector((0, 0, H * .45))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .45))
        for k in range(120):
            y = rng.uniform(-.75, 1)
            r = math.sqrt(max(0, 1 - y * y)) * rng.uniform(.55, 1)
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * r * spread * .52, math.sin(a) * r * spread * .5, y * H * .5))
            mesh.add_lump(p, (spread * .05, spread * .05, H * .08), 'leaf', rng, subdiv=0, jitter=.25, crown=c, blend=.6,
                          shade=shade, flex=.8)
    return build


def splitrailfence(length, height):
    """One panel of a zig-zag split-rail fence: six heavy split rails stacked,
    each its own length and tilt, overhanging both ends where the next
    panel's rails cross them. The game lays panels 2 m apart along a run and
    turns every other one 30 degrees, which makes the zig-zag (round 11: a
    two-panel V could not follow a wall's run)."""
    def build(mesh, rng):
        # Along Y, as the story walls' sections are (renderer.js addStory
        # stretches a section along its length axis).
        d = Vector((0, 1, 0))
        p, q = -d * length / 2, d * length / 2
        for r in range(6):
            z = height * (.08 + .16 * r)
            e0, e1 = rng.uniform(.15, .45), rng.uniform(.15, .45)
            tz = rng.uniform(-.05, .05)
            pts = [p - d * e0 + Vector((0, 0, z - tz)), Vector((0, 0, z + rng.uniform(-.03, .03))),
                   q + d * e1 + Vector((0, 0, z + tz))]
            mesh.add_tube(pts, [.09, .1, .09], 4, 'bark', rng=rng, wobble=.12,
                          shade=lambda co, t: .8 + .25 * t, flex=lambda co, t: 0)
    return build


def columbine(height, spread):
    """Colorado columbine: an airy, broken clump of lobed leaves, and on short
    stems above it star flowers -- five blue sepals round a white cup
    (round 2: a solid mound under flat discs on tall stems)."""
    def build(mesh, rng):
        H = height
        # Round 12: more, smaller lobes -- the leaves are fern-like.
        for k in range(22):
            a = k / 22 * math.tau + rng.uniform(-.3, .3)
            # Round 14: wider and lower -- a leafy mound under the flowers.
            p = Vector((math.cos(a) * spread * rng.uniform(.1, .42), math.sin(a) * spread * rng.uniform(.1, .42), H * rng.uniform(.08, .32)))
            mesh.add_lump(p, (spread * .075, spread * .075, H * .04), 'leaf', rng, subdiv=0, jitter=.35, flex=.6,
                          shade=lambda w, n: .9)
        for k in range(5):
            a = rng.uniform(0, math.tau)
            top = Vector((math.cos(a) * spread * .2, math.sin(a) * spread * .2, H * rng.uniform(.5, .75)))
            mesh.add_tube([Vector((0, 0, 0)), top * .5, top], [.004, .0035, .003], 4, 'leaf',
                          flex=lambda co, t: .3 + .7 * t)
            for f in range(5):
                b = f / 5 * math.tau
                # Round 3: the star tilted out from the clump's middle.
                q = top + Vector((math.cos(b) * .028, math.sin(b) * .028, .004)) + Vector((top.x, top.y, 0)).normalized() * .01
                mesh.add_lump(q, (.028, .01, .004), 'accent', rng, subdiv=0, jitter=.1, flex=.9, shade=lambda w, n: 1.0)
            mesh.add_lump(top + Vector((0, 0, .016)), (.026, .026, .022), 'bark', rng, subdiv=0, jitter=.05, flex=.9,
                          shade=lambda w, n: 1.1)
    return build


def lupine(height, spread):
    """Mountain lupine: a full base of palmate leaves, and upright spikes of
    blue-purple pea flowers tapering to a point. Round 7, the cost pass
    (2,160 triangles): each spike a five-sided tapering column with three
    florets proud of it, not twelve lumps."""
    def build(mesh, rng):
        H = height
        for k in range(8):
            a = k / 8 * math.tau + rng.uniform(-.3, .3)
            p = Vector((math.cos(a) * spread * .24, math.sin(a) * spread * .24, H * .16))
            mesh.add_lump(p, (spread * .14, spread * .14, H * .05), 'leaf', rng, subdiv=0, jitter=.25, flex=.5,
                          shade=lambda w, n: .9)
        for k in range(5):
            a = k * ct.GOLDEN
            base = Vector((math.cos(a) * spread * .2, math.sin(a) * spread * .2, H * .28))
            mesh.add_tube([Vector((0, 0, 0)), base], [.006, .005], 4, 'leaf', flex=lambda co, t: .3)
            h = H * rng.uniform(.55, .72)
            pts = [base + Vector((0, 0, h * t / 5)) for t in range(6)]
            mesh.add_tube(pts, [.032 * (1 - .85 * t / 5) for t in range(6)], 5, 'accent', rng=rng, wobble=.15,
                          shade=lambda co, t: .9 + .2 * t, flex=lambda co, t: .5 + .5 * t)
            # Round 10: six florets proud of each column (three left it smooth).
            for j in range(6):
                q = base + Vector((0, 0, h * (.06 + .14 * j)))
                b = j * 2.4 + rng.uniform(-.3, .3)
                rr = .028 * (1 - .75 * j / 6)
                mesh.add_lump(q + Vector((math.cos(b) * rr, math.sin(b) * rr, 0)), (rr * .9, rr * .9, .022), 'accent', rng,
                              subdiv=0, jitter=.1, flex=.7, shade=lambda w, n: 1.05)
    return build


MODELS = [
    ('Blender_Lodgepole_1', lodgepole(24, 5.4, 9)),
    ('Blender_Lodgepole_2', lodgepole(19, 4.6, 8)),
    ('Blender_BlueSpruce_1', bluespruce(18, 10.5, 13)),
    ('Blender_BlueSpruce_2', bluespruce(14, 8.4, 11)),
    ('Blender_WillowThicket_1', willowthicket(2.8, 2.6)),
    ('Blender_SplitRailFence_1', splitrailfence(2.4, 1.3)),
    ('Blender_Columbine_1', columbine(.45, .35)),
    ('Blender_Lupine_1', lupine(.7, .4)),
]

# THE SHEET'S COLOURS BY SEASON (iterate.mjs --season; the study's models/<id>.md
# *Seasons*). An accent with no flowers that season is drawn the leaf's colour.
SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'Lodgepole': '#8a6a4a', 'BlueSpruce': '#6a625a', 'WillowThicket': '#8a5a3a', 'SplitRailFence': '#8a7a62', 'Columbine': '#f4f2ea'}
LOOK = {
    'Lodgepole': {'spring': ('#5a7a38', None), 'summer': ('#4e7234', None), 'autumn': ('#4e7234', None), 'winter': ('#4a6c32', None)},
    'BlueSpruce': {'spring': ('#8aa8ac', None), 'summer': ('#6f8f96', None), 'autumn': ('#6f8f96', None), 'winter': ('#6a8a90', None)},
    'WillowThicket': {'spring': ('#a8c06a', None), 'summer': ('#6a8a52', None), 'autumn': ('#c8b03a', None), 'winter': ('#6a8a52', None)},
    'SplitRailFence': {s: ('#8a7a62', None) for s in ('spring', 'summer', 'autumn', 'winter')},
    'Columbine': {'spring': ('#7a9a5a', '#7a9a5a'), 'summer': ('#7a9a5a', '#8aa8e0'), 'autumn': ('#9a8a5a', '#9a8a5a'), 'winter': ('#9a8a5a', '#9a8a5a')},
    'Lupine': {'spring': ('#7a9a5a', '#7a7a98'), 'summer': ('#7a9a5a', '#6a5ac8'), 'autumn': ('#9a8a5a', '#9a8a5a'), 'winter': ('#9a8a5a', '#9a8a5a')},
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
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.6, 0.6, 0.9)},
          far={'Blender_Lodgepole_1', 'Blender_Lodgepole_2', 'Blender_BlueSpruce_1', 'Blender_BlueSpruce_2'},
          tints=tints(SEASON))
