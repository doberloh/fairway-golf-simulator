# TOURNAMENT WEEK (architect-courses, phase 7; the study, workstream Q;
# docs/ARCHITECT_COURSES.md).
#
#   node tools/blender/run.mjs architect_occasion --render
#
# What a Championship venue puts up for its week, in the overhaul's hand.
# Each is drawn to the footprint occasion.js gives it (width across the front
# along X, depth along Y with the front -- the side facing play -- at -Y,
# height up Z, in metres):
#
#   grandstand   20 x 9, 7.5 m (8.6 to its pennants): six stepped rows on a
#                scaffold frame, a skirt of the event's colour, a canopy
#   scoreboard   12 x 2, 7.6 m: a board of names and numbers on 3 m legs
#   tv tower     4 x 4, 12 m: scaffold, a platform, a camera under a hood
#   marquee      10 x 10, 5.5 m: a peaked white hospitality tent
#   rope         6 m of gallery rope on two stakes
#   spectator    1.7 m: a figure in a sun hat
#
# Roles: frames and stakes `stone`, the event's colour `accent`, canvas and
# boards `leaf` (white in the game), seats and the crowd's clothes `bark`,
# skin and rope `dirt`. Every model's iterations are logged in
# docs/ARCHITECT_COURSES.md, *Blender iteration log*.
import math, os, sys, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb
V = lambda x, y, z: Vector((x, y, z))


def block(mesh, x0, x1, y0, y1, z0, z1, role, low=.8, high=1.05, top=None):
    span = max(z1 - z0, 1e-6)
    shade = lambda co: low + (high - low) * max(0.0, min(1.0, (co.z - z0) / span))
    faces = [
        [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)],
        [V(x1, y1, z0), V(x0, y1, z0), V(x0, y1, z1), V(x1, y1, z1)],
        [V(x0, y1, z0), V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1)],
        [V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1)],
        [V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)],
        [V(x0, y1, z0), V(x1, y1, z0), V(x1, y0, z0), V(x0, y0, z0)],
    ]
    for i, pts in enumerate(faces):
        f = mesh.face(pts, role)
        for v in f.verts:
            s = top if (i == 4 and top is not None) else shade(v.co) * (.7 if i == 5 else 1)
            mesh.paint[v] = (s, s, s, 0.0)


def poly(mesh, pts, role, shade=1.0, both=True):
    f = mesh.face(pts, role)
    for v in f.verts:
        mesh.paint[v] = (shade, shade, shade, 0.0)
    if both:
        g = mesh.face(list(reversed(pts)), role)
        for v in g.verts:
            mesh.paint[v] = (shade * .8, shade * .8, shade * .8, 0.0)


# Six rows, the first 1.2 m up and 1.5 m deep; their tops are where the game
# seats its crowd (occasion.js STAND_ROWS).
ROWS = [(-4.5 + i * 1.5, 1.2 + i * .9) for i in range(6)]


def grandstand():
    def build(mesh, rng):
        W = 10.0
        # The scaffold: posts under the back of each row, braces along.
        for x in (-W, -W / 2, 0, W / 2, W):
            for y, z in ROWS:
                block(mesh, x - .07, x + .07, y + 1.3, y + 1.44, 0, z, 'stone', low=.65, high=.85)
        # The rows: a deck and a seat bench each.
        for y, z in ROWS:
            block(mesh, -W, W, y, y + 1.5, z - .12, z, 'stone', low=.8, high=.95, top=.95)
            block(mesh, -W, W, y + .95, y + 1.35, z, z + .42, 'bark', low=.8, high=.95)
        # The skirt along the front, in the event's colour, and side panels.
        block(mesh, -W, W, -4.6, -4.5, 0, 1.2, 'accent', low=.9, high=1.0)
        for x0, x1 in ((-W - .1, -W), (W, W + .1)):
            poly(mesh, [V(x0 if x0 < 0 else x1, -4.5, 0), V(x0 if x0 < 0 else x1, 4.5, 0), V(x0 if x0 < 0 else x1, 4.5, 6.6), V(x0 if x0 < 0 else x1, -4.5, 1.2)], 'accent', .9)
        # A canopy over the top rows.
        for x in (-W, 0, W):
            block(mesh, x - .08, x + .08, 4.35, 4.5, 5.7, 7.4, 'stone', low=.7, high=.85)
        poly(mesh, [V(-W - .3, 1.5, 7.0), V(W + .3, 1.5, 7.0), V(W + .3, 4.6, 7.5), V(-W - .3, 4.6, 7.5)], 'leaf', 1.0)
        # Iteration 2: pennants on poles along the canopy, the event's
        # colour, so a stand reads as tournament week from down the fairway.
        for x in (-W, -W / 2, 0, W / 2, W):
            mesh.add_tube([V(x, 1.6, 7.0), V(x, 1.6, 8.6)], [.04, .03], 4, 'stone', rng)
            poly(mesh, [V(x, 1.6, 8.6), V(x + .9, 1.6, 8.35), V(x, 1.6, 8.1)], 'accent', 1.0)
    return build


def scoreboard():
    def build(mesh, rng):
        # Iteration 9: on 3 m legs (on 2.4 the board sank into Links' marram).
        for x in (-5, 5):
            block(mesh, x - .15, x + .15, -.15, .15, 0, 3.0, 'stone', low=.6, high=.8)
        block(mesh, -6, 6, -.4, .4, 3.0, 7.6, 'accent', low=.85, high=1.0)
        block(mesh, -5.6, 5.6, -.45, -.4, 3.3, 6.6, 'leaf', low=1.0, high=1.0)
        # Rows of names and scores: dark bars on the white board.
        r = random.Random(3)
        for i in range(8):
            z = 6.3 - i * .38
            block(mesh, -5.3, -5.3 + r.uniform(2.5, 4.2), -.47, -.45, z - .14, z, 'bark', low=.5, high=.5)
            for k in range(4):
                x = 1.2 + k * 1.05
                block(mesh, x, x + .55, -.47, -.45, z - .14, z, 'dirt' if k < 3 else 'accent', low=.5, high=.6)
        block(mesh, -6, 6, -.4, .4, 7.0, 7.6, 'accent', low=.95, high=1.05)
    return build


def tv_tower():
    def build(mesh, rng):
        H = 10.5
        for x in (-1.8, 1.8):
            for y in (-1.8, 1.8):
                block(mesh, x - .08, x + .08, y - .08, y + .08, 0, H, 'stone', low=.6, high=.85)
        for z in (2.5, 5.0, 7.5):
            for (x0, x1, y0, y1) in ((-1.8, 1.8, -1.85, -1.75), (-1.8, 1.8, 1.75, 1.85), (-1.85, -1.75, -1.8, 1.8), (1.75, 1.85, -1.8, 1.8)):
                block(mesh, x0, x1, y0, y1, z, z + .1, 'stone', low=.75, high=.85)
        block(mesh, -2.1, 2.1, -2.1, 2.1, H, H + .25, 'stone', low=.8, high=.9)
        # A hood and the camera under it, looking out at -Y.
        block(mesh, -1.6, 1.6, -.4, 1.6, H + .25, H + 1.4, 'leaf', low=.9, high=1.0)
        block(mesh, -1.9, 1.9, -2.0, 2.0, H + 1.4, H + 1.55, 'accent', low=.95, high=1.0)
        block(mesh, -.35, .35, -1.6, -.4, H + .45, H + 1.0, 'dirt', low=.5, high=.6)
        mesh.add_tube([V(0, -1.6, H + .72), V(0, -2.0, H + .72)], [.18, .2], 8, 'dirt', rng)
    return build


def marquee():
    def build(mesh, rng):
        W, D, E, P = 5.0, 5.0, 2.6, 5.5
        # Canvas walls, scalloped valance, a peaked roof.
        for (a, b) in ((V(-W, -D, 0), V(W, -D, 0)), (V(W, -D, 0), V(W, D, 0)), (V(W, D, 0), V(-W, D, 0)), (V(-W, D, 0), V(-W, -D, 0))):
            poly(mesh, [a, b, b + V(0, 0, E), a + V(0, 0, E)], 'leaf', .95, both=False)
        apex = V(0, 0, P)
        corners = [V(-W - .2, -D - .2, E), V(W + .2, -D - .2, E), V(W + .2, D + .2, E), V(-W - .2, D + .2, E)]
        for i in range(4):
            poly(mesh, [corners[i], corners[(i + 1) % 4], apex], 'leaf', 1.05 - .08 * (i % 2), both=False)
        # The event's colour round the valance, and an open front.
        for i in range(4):
            a, b = corners[i], corners[(i + 1) % 4]
            poly(mesh, [a, b, b - V(0, 0, .35), a - V(0, 0, .35)], 'accent', 1.0)
        block(mesh, -1.6, 1.6, -D - .02, -D, 0, 2.2, 'bark', low=.35, high=.4)
        mesh.add_tube([apex, apex + V(0, 0, .8)], [.04, .03], 5, 'stone', rng)
    return build


def rope():
    def build(mesh, rng):
        for y in (-3.0, 3.0):
            block(mesh, -.04, .04, y - .04, y + .04, 0, .95, 'stone', low=.75, high=.95)
            block(mesh, -.05, .05, y - .05, y + .05, .95, 1.0, 'accent', low=1, high=1)
        pts = [V(0, -3.0 + 6.0 * t, .9 - .22 * math.sin(math.pi * t)) for t in (0, .2, .4, .6, .8, 1.0)]
        mesh.add_tube(pts, [.025] * len(pts), 4, 'dirt', rng)
    return build


def spectator():
    def build(mesh, rng):
        for x in (-.1, .1):
            mesh.add_tube([V(x, 0, .85), V(x, 0, .05)], [.075, .065], 5, 'bark', rng)
        mesh.add_lump(V(0, 0, 1.18), (.2, .13, .34), 'accent', rng, subdiv=1, jitter=.02,
                      shade=lambda p, n: .8 + .25 * max(0.0, n.z))
        for x in (-1, 1):
            mesh.add_tube([V(x * .22, 0, 1.4), V(x * .25, -.04, 1.0)], [.05, .045], 5, 'accent', rng)
        mesh.add_lump(V(0, 0, 1.56), (.11, .12, .13), 'dirt', rng, subdiv=1, jitter=.02)
        mesh.add_lump(V(0, 0, 1.66), (.2, .2, .04), 'leaf', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, 0, 1.7), (.1, .1, .07), 'leaf', rng, subdiv=1, jitter=0)
    return build


MODELS = [
    ('Blender_Grandstand_1', grandstand()),
    ('Blender_Scoreboard_1', scoreboard()),
    ('Blender_TVTower_1', tv_tower()),
    ('Blender_Marquee_1', marquee()),
    ('Blender_GalleryRope_1', rope()),
    ('Blender_Spectator_1', spectator()),
]

ct.export(MODELS, colours={'stone': (0.7, 0.72, 0.74), 'accent': (0.15, 0.35, 0.25), 'leaf': (0.97, 0.97, 0.95),
                           'bark': (0.3, 0.32, 0.4), 'dirt': (0.85, 0.65, 0.5)}, figure=1.8)
