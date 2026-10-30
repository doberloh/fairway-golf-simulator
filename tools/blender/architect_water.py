# WATER MADE BY PEOPLE (architect-courses, phase 5; the study, workstream E;
# docs/ARCHITECT_COURSES.md).
#
#   node tools/blender/run.mjs architect_water --render
#
# What a builder puts at an Architect course's water, in the overhaul's hand:
#
#   bridge bay   one 2 m bay of a cart-path bridge, laid end to end across a
#                creek by renderer.js `addPaths`: a timber one (stringers,
#                planks, posts and two rails) and a stone one (a slab and
#                parapets with a coping)
#   rip-rap      three rough stones for a pond's waterline (waterworks.js)
#   bulkhead     a 2.4 m section of railway ties standing at the waterline,
#                with a waler bolted along its face
#   fountain     an aerating fountain: a jet, a crown of falling water and a
#                ring of foam
#
# Measured in metres; each model's real height is noted beside it (the ingest
# scales every model to one unit tall and the game scales back). Every model's
# iterations are logged in docs/ARCHITECT_COURSES.md, *Blender iteration log*.
import math, os, sys, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


# The painted box, as architect_people.py's.
def block(mesh, x0, x1, y0, y1, z0, z1, role, low=.8, high=1.05, top=None):
    span = max(z1 - z0, 1e-6)
    shade = lambda co: low + (high - low) * max(0.0, min(1.0, (co.z - z0) / span))
    P = lambda x, y, z: Vector((x, y, z))
    faces = [
        [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
        [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)],
        [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)],
        [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
        [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
        [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)],
    ]
    for i, pts in enumerate(faces):
        f = mesh.face(pts, role)
        for v in f.verts:
            s = top if (i == 4 and top is not None) else shade(v.co) * (.7 if i == 5 else 1)
            mesh.paint[v] = (s, s, s, 0.0)


# A TIMBER BAY: 3.0 m wide, 2.0 m long (along Y), 1.25 m tall; the deck's top
# at 0.30 m of it. The game scales its width to the path's and lays as many
# bays as the span needs.
DECK_TOP = .30
def bay_wood():
    def build(mesh, rng):
        # Two stringers under the planks.
        for x in (-1.05, 1.05):
            block(mesh, x - .09, x + .09, -1.0, 1.0, 0, .2, 'bark', low=.45, high=.6)
        # Planks across, a finger's gap between, each its own shade.
        n = 9
        for i in range(n):
            y0 = -1.0 + i * 2.0 / n + .012
            y1 = -1.0 + (i + 1) * 2.0 / n - .012
            s = .88 + rng.uniform(-.08, .08)
            block(mesh, -1.5, 1.5, y0, y1, .2, DECK_TOP, 'bark', low=s * .8, high=s, top=s * 1.08)
        # A post at each end of the bay, each side, and two rails.
        for x in (-1.42, 1.42):
            for y in (-.94, .94):
                block(mesh, x - .08, x + .08, y - .08, y + .08, .05, 1.25, 'stone', low=.7, high=1.0)
            # Iteration 2: rails a cartoon's thickness (they were threads).
            block(mesh, x - .07, x + .07, -1.0, 1.0, 1.08, 1.22, 'stone', low=.9, high=1.05)
            block(mesh, x - .05, x + .05, -1.0, 1.0, .66, .77, 'stone', low=.85, high=.95)
    return build


# A STONE BAY: 3.1 m wide, 2.0 m long, 1.08 m tall; a slab deck and two
# parapets with a coping, its stones each their own shade.
def bay_stone():
    def build(mesh, rng):
        block(mesh, -1.5, 1.5, -1.0, 1.0, 0, DECK_TOP, 'stone', low=.6, high=.8, top=.82)
        for x0, x1 in ((-1.5, -1.17), (1.17, 1.5)):
            for i in range(3):
                y0, y1 = -1.0 + i * 2 / 3, -1.0 + (i + 1) * 2 / 3
                for j, (z0, z1) in enumerate(((DECK_TOP, .62), (.62, .96))):
                    s = .86 + rng.uniform(-.1, .1)
                    off = (2 / 6) if j else 0
                    yy0, yy1 = max(-1.0, y0 + off - (2 / 6 if j and i == 0 else 0)), min(1.0, y1 + off)
                    block(mesh, x0, x1, yy0 + .01, yy1 - .01, z0 + .01, z1 - .01, 'stone', low=s * .85, high=s)
            block(mesh, x0 - .04, x1 + .04, -1.0, 1.0, .96, 1.08, 'stone', low=1.0, high=1.1)
    return build


# RIP-RAP: rough stones about 0.7 m across and 0.35 m tall.
def riprap(seed):
    def build(mesh, rng):
        r = random.Random(seed)
        # Iteration 2: ten points and a small bevel, so a stone is quarried
        # and angular, not a river pebble.
        ct.hull_rock(mesh, r, Vector((0, 0, 0)), (.36 + r.uniform(-.06, .06), .26 + r.uniform(-.06, .06), .18),
                     points=10, bevel=.05, flat_top=.25, flat_bottom=.4, seat=0, shade_low=.55, shade_high=1.12)
    return build


# A BULKHEAD SECTION: 2.4 m of ties (along Y), 0.9 m tall, 0.2 m thick; its
# face (+X) to the water. A waler -- a tie laid along the face -- near the top.
def bulkhead():
    def build(mesh, rng):
        n = 10
        for i in range(n):
            y0 = -1.2 + i * 2.4 / n + .01
            y1 = -1.2 + (i + 1) * 2.4 / n - .01
            top = .86 + rng.uniform(-.04, .04)
            s = .8 + rng.uniform(-.08, .08)
            block(mesh, -.1, .1, y0, y1, 0, top, 'bark', low=s * .55, high=s, top=s * 1.1)
        block(mesh, .1, .26, -1.2, 1.2, .55, .72, 'bark', low=.55, high=.7)
        for y in (-.9, 0, .9):
            block(mesh, .26, .3, y - .03, y + .03, .6, .67, 'stone', low=.9, high=1.0)
    return build


# A FOUNTAIN: a jet 3.0 m tall, a crown of eight falling arcs and a ring of
# foam 2.6 m across on the water.
def fountain():
    def build(mesh, rng):
        # Iteration 4: in the game the bell of lumps read as a grey stone
        # mushroom -- each lump shaded and inked like a pebble. Now the shape
        # an aerating fountain makes: a jet, a white crown, and two tiers of
        # falling water (the conifers' drooping skirt, scalloped like spray),
        # 4.0 m tall, painted bright; the game draws it uninked.
        bright = lambda p, n: 1.1 + .1 * max(0.0, n.z)
        mesh.add_tube([Vector((0, 0, 0)), Vector((0, 0, 2.0)), Vector((0, 0, 3.7))], [.32, .2, .1], 8, 'stone', rng,
                      shade=lambda co, t: 1.1)
        mesh.add_lump(Vector((0, 0, 3.7)), (.38, .38, .32), 'stone', rng, subdiv=1, jitter=.1)
        # Iteration 7: the bell read as a tent. A cloud of spray on the jet
        # (the cartoon trees' crown, white and lit as one body) with thick
        # streams falling from it to the pond, like a plume breaking.
        ct.cloud_crown(mesh, rng, Vector((0, 0, 3.25)), (1.1, 1.1, .75), lobes=12, lobe_size=(.36, .5), role='stone',
                       subdiv=2, low=.95, high=1.2, flat_bottom=.2, shell=.75)
        # Iteration 8: from the bank the streams vanished inside the crown.
        # Twelve, thicker, leaving the crown's rim and landing wider.
        for k in range(12):
            a = k * 2 * math.pi / 12 + rng.uniform(-.12, .12)
            pts = [Vector((math.cos(a) * (.95 + 1.3 * u), math.sin(a) * (.95 + 1.3 * u), 3.0 - 2.85 * u * u)) for u in (0, .25, .5, .75, 1)]
            # Iteration 9: one radius a point -- the helper draws one ring a
            # radius, so two radii drew only the first stretch of each stream.
            mesh.add_tube(pts, [.24, .21, .18, .15, .12], 6, 'stone', rng, shade=lambda co, t: 1.15 - .08 * t)
        for k in range(14):
            a = k * 2 * math.pi / 14
            mesh.add_lump(Vector((math.cos(a) * 2.1, math.sin(a) * 2.1, .06)), (.5, .4, .12), 'accent', rng,
                          subdiv=1, jitter=.12)
        mesh.add_lump(Vector((0, 0, .08)), (.9, .9, .18), 'accent', rng, subdiv=1, jitter=.1)
    return build


MODELS = [
    ('Blender_BridgeBay_Wood', bay_wood()),
    ('Blender_BridgeBay_Stone', bay_stone()),
    ('Blender_RipRap_1', riprap(1)),
    ('Blender_RipRap_2', riprap(2)),
    ('Blender_RipRap_3', riprap(3)),
    ('Blender_Bulkhead_1', bulkhead()),
    ('Blender_Fountain_1', fountain()),
]

ct.export(MODELS, colours={'accent': (0.95, 0.97, 1.0), 'bark': (0.36, 0.27, 0.2), 'stone': (0.72, 0.7, 0.66)}, figure=1.0)
