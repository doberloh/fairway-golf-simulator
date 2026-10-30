# THE CLUBHOUSES (architect-courses, phase 2; the study, workstream G and its
# landscape table; docs/ARCHITECT_COURSES.md).
#
#   node tools/blender/run.mjs architect_clubhouses --render
#
# One clubhouse a landscape, in the overhaul's hand: chunky, painted, a clear
# silhouette from a fairway away. Built at a members' club's size -- a 26 x 16 m
# footprint (local -Y is the front, which faces the first tee) -- and fitted by
# the game to each club's box (clubhouse.js CLUBHOUSE_SIZE), so proportions
# matter and absolute size does not. Roles, coloured per landscape in the game
# (renderer.js addBuildings): `stone` walls, `bark` roof, `accent` trim, posts
# and frames, `dirt` glass and doors.
#
#   lodge       Pacific Northwest: a long low timber lodge, deep eaves, a
#               stone chimney, a porch on posts
#   adobe       Desert: flat roofs behind parapets, vigas, a tower
#   chalet      Mountain: a steep gable, a balcony across the front
#   stonehouse  Links: grey stone, two gables, chimneys at the ends
#   farmhouse   Midwest: two storeys, a gable, a porch the width of the front
#   pavilion    Island: a big hipped roof on posts, open sides
#   loglodge    Giant Redwood: log walls, one big gable, a porch
#   clapboard   Autumn: a white New England house with a cupola
#   manor       Haunted Hollow: tall and crooked, a turret
#   shingle     Lakeshore Dunes: a hipped shingle roof with dormers, a veranda
#
# Every iteration is logged in docs/ARCHITECT_COURSES.md, *Blender iteration log*.
import math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb

W, D = 13.0, 8.0     # half the footprint


def paint(face, mesh, k):
    for v in face.verts:
        mesh.paint[v] = (k, k, k, 0.0)


def box(mesh, x0, x1, y0, y1, z0, z1, role, low=.8, high=1.05, top=None, skip_bottom=True):
    span = max(z1 - z0, 1e-6)
    P = lambda x, y, z: Vector((x, y, z))
    faces = [
        [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
        [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)],
        [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)],
        [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
        [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
    ]
    if not skip_bottom:
        faces.append([P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)])
    for i, pts in enumerate(faces):
        f = mesh.face(pts, role)
        for v in f.verts:
            s = top if (i == 4 and top is not None) else low + (high - low) * max(0.0, min(1.0, (v.co.z - z0) / span))
            mesh.paint[v] = (s, s, s, 0.0)


def gable(mesh, x0, x1, y0, y1, z0, ridge, role='bark', over=.8, along='x', end_role='stone'):
    """A gable roof over the box x0..x1, y0..y1 from z0 to `ridge`, the ridge
    running along `along`, overhanging by `over`. The gable ends are walls."""
    if along == 'x':
        xa, xb, ya, yb = x0 - over, x1 + over, y0 - over, y1 + over
        ym = (y0 + y1) / 2
        for side in (0, 1):
            pts = [Vector((xa, ya, z0 - .3)), Vector((xb, ya, z0 - .3)), Vector((xb, ym, ridge)), Vector((xa, ym, ridge))] if side == 0 else \
                  [Vector((xb, yb, z0 - .3)), Vector((xa, yb, z0 - .3)), Vector((xa, ym, ridge)), Vector((xb, ym, ridge))]
            paint(mesh.face(pts, role), mesh, .95)
            under = mesh.face(pts[::-1], role)
            paint(under, mesh, .55)
            # Iteration 2: a fascia board along the eave, so the roof has an edge.
            ey = ya if side == 0 else yb
            box(mesh, xa, xb, ey - .12, ey + .12, z0 - .55, z0 - .2, 'accent', low=.9, high=1.0)
        box(mesh, xa, xb, ym - .22, ym + .22, ridge - .1, ridge + .15, 'accent', low=.9, high=1.0)  # the ridge cap
        for x, flip in ((x0, True), (x1, False)):
            tri = [Vector((x, y0, z0)), Vector((x, y1, z0)), Vector((x, ym, ridge - .2))]
            paint(mesh.face(tri if not flip else tri[::-1], end_role), mesh, 1.0)
    else:
        xa, xb, ya, yb = x0 - over, x1 + over, y0 - over, y1 + over
        xm = (x0 + x1) / 2
        for side in (0, 1):
            pts = [Vector((xa, yb, z0 - .3)), Vector((xa, ya, z0 - .3)), Vector((xm, ya, ridge)), Vector((xm, yb, ridge))] if side == 0 else \
                  [Vector((xb, ya, z0 - .3)), Vector((xb, yb, z0 - .3)), Vector((xm, yb, ridge)), Vector((xm, ya, ridge))]
            paint(mesh.face(pts, role), mesh, .95)
            paint(mesh.face(pts[::-1], role), mesh, .55)
            ex = xa if side == 0 else xb
            box(mesh, ex - .12, ex + .12, ya, yb, z0 - .55, z0 - .2, 'accent', low=.9, high=1.0)
        box(mesh, xm - .22, xm + .22, ya, yb, ridge - .1, ridge + .15, 'accent', low=.9, high=1.0)
        for y, flip in ((y0, False), (y1, True)):
            tri = [Vector((x0, y, z0)), Vector((x1, y, z0)), Vector((xm, y, ridge - .2))]
            paint(mesh.face(tri if not flip else tri[::-1], end_role), mesh, 1.0)


def hip(mesh, x0, x1, y0, y1, z0, ridge, role='bark', over=.9, inset=.35):
    """A hipped roof: four slopes up to a short ridge along x."""
    xa, xb, ya, yb = x0 - over, x1 + over, y0 - over, y1 + over
    ym, span = (y0 + y1) / 2, (x1 - x0)
    ra, rb = x0 + span * inset, x1 - span * inset
    e = z0 - .3
    faces = [
        [Vector((xa, ya, e)), Vector((xb, ya, e)), Vector((rb, ym, ridge)), Vector((ra, ym, ridge))],
        [Vector((xb, yb, e)), Vector((xa, yb, e)), Vector((ra, ym, ridge)), Vector((rb, ym, ridge))],
        [Vector((xa, yb, e)), Vector((xa, ya, e)), Vector((ra, ym, ridge))],
        [Vector((xb, ya, e)), Vector((xb, yb, e)), Vector((rb, ym, ridge))],
    ]
    for pts in faces:
        paint(mesh.face(pts, role), mesh, .95)
        paint(mesh.face(pts[::-1], role), mesh, .55)


def windows(mesh, y, x0, x1, z0, z1, n, front=True, w=1.1):
    """`n` windows across a wall at y, each a dark pane in a pale frame, a
    hair proud of the wall."""
    step = (x1 - x0) / n
    d = -.06 if front else .06
    for i in range(n):
        cx = x0 + step * (i + .5)
        if front:
            box(mesh, cx - w / 2 - .12, cx + w / 2 + .12, y + d - .05, y, z0 - .12, z1 + .12, 'accent', low=.95, high=1.05)
            box(mesh, cx - w / 2, cx + w / 2, y + d - .1, y + d - .05, z0, z1, 'dirt', low=.85, high=1.1)
        else:
            box(mesh, cx - w / 2 - .12, cx + w / 2 + .12, y, y + d + .05, z0 - .12, z1 + .12, 'accent', low=.95, high=1.05)
            box(mesh, cx - w / 2, cx + w / 2, y + d + .05, y + d + .1, z0, z1, 'dirt', low=.85, high=1.1)


def door(mesh, y, cx, w=1.8, h=2.6):
    box(mesh, cx - w / 2 - .2, cx + w / 2 + .2, y - .14, y, 0, h + .2, 'accent', low=.9, high=1.05)
    box(mesh, cx - w / 2, cx + w / 2, y - .2, y - .14, 0, h, 'dirt', low=.8, high=1.0)


def plinth(mesh, x0, x1, y0, y1, h=.5):
    # The plinth. On a slope the terrace's wall below it is the game's
    # (renderer.js addBuildings): a deep plinth here would raise the whole
    # model, since the ingest stands a model on its lowest point.
    box(mesh, x0 - .25, x1 + .25, y0 - .25, y1 + .25, -1.2, h, 'accent', low=.6, high=.8)


def posts(mesh, y, x0, x1, n, h, r=.18):
    step = (x1 - x0) / (n - 1)
    for i in range(n):
        x = x0 + step * i
        box(mesh, x - r, x + r, y - r, y + r, 0, h, 'accent', low=.85, high=1.0)


def chimney(mesh, x, y, z0, z1, r=.6):
    box(mesh, x - r, x + r, y - r, y + r, z0, z1, 'stone', low=.75, high=.95)
    box(mesh, x - r - .12, x + r + .12, y - r - .12, y + r + .12, z1, z1 + .25, 'accent', low=.9, high=1.0)


def flagpole(mesh, x, y, h=10.0):
    # Iteration 8: a club flies a flag by its door. A white pole, a ball on
    # top, and the flag (the roof's colour) two-sided, standing out downwind.
    box(mesh, x - .08, x + .08, y - .08, y + .08, 0, h, 'accent', low=.9, high=1.05)
    box(mesh, x - .16, x + .16, y - .16, y + .16, h, h + .3, 'accent', low=1.0, high=1.05)
    pts = [Vector((x + .1, y, h - .2)), Vector((x + 2.6, y, h - .45)), Vector((x + 2.6, y, h - 1.95)), Vector((x + .1, y, h - 1.7))]
    paint(mesh.face(pts, 'bark'), mesh, 1.05)
    paint(mesh.face(pts[::-1], 'bark'), mesh, .9)


def shutters(mesh, y, x0, x1, z0, z1, n, w=1.1):
    # Iteration 8: dark shutters either side of each window (role `bark`, the
    # roof's colour), the farmhouse's and the clapboard's look.
    step = (x1 - x0) / n
    for i in range(n):
        cx = x0 + step * (i + .5)
        for s in (-1, 1):
            sx = cx + s * (w / 2 + .45)
            box(mesh, sx - .3, sx + .3, y - .1, y - .02, z0, z1, 'bark', low=.85, high=1.0)


def lodge():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D)
        box(mesh, -W, W, -D, D, 0, 4.2, 'stone', low=.8, high=1.0)
        gable(mesh, -W, W, -D, D, 4.2, 8.0, over=1.6)
        windows(mesh, -D, -W + 1, W - 1, 1.2, 3.2, 7)
        door(mesh, -D, 0)
        box(mesh, -6, 6, -D - 3.2, -D, 3.6, 3.85, 'bark', low=.8, high=.95)   # the porch roof
        posts(mesh, -D - 3, -5.8, 5.8, 4, 3.6)
        chimney(mesh, W - 2, 0, 2, 9.4, .8)
        # Iteration 2: a cross gable over the entrance breaks the long roof.
        box(mesh, -3.5, 3.5, -D - 1.5, -D + 2, 0, 4.6, 'stone', low=.82, high=1.0)
        gable(mesh, -3.5, 3.5, -D - 1.5, -D + 2, 4.6, 8.4, over=.8, along='y')
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def adobe():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D, .3)
        box(mesh, -W, W, -D, D, 0, 4.6, 'stone', low=.82, high=1.02)
        box(mesh, -W - .1, W + .1, -D - .1, D + .1, 4.6, 5.3, 'stone', low=1.0, high=1.05)  # parapet
        box(mesh, -W + .4, W - .4, -D + .4, D - .4, 4.9, 5.0, 'bark', low=.8, high=.85)     # the flat roof
        box(mesh, W - 7, W - 1, -D + 1, D - 1, 4.6, 8.4, 'stone', low=.85, high=1.03)      # the tower
        box(mesh, W - 7.1, W - .9, -D + .9, D - .9, 8.4, 8.9, 'stone', low=1.0, high=1.05)
        for i in range(9):  # vigas, poking out under the parapet
            x = -W + 1.5 + i * 2.4
            box(mesh, x - .2, x + .2, -D - 1.0, -D, 3.9, 4.3, 'accent', low=.75, high=.95)
        windows(mesh, -D, -W + 1, W - 8, 1.3, 3.0, 4, w=1.2)
        door(mesh, -D, -W + 13, w=2.2)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def chalet():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D)
        box(mesh, -W, W, -D, D, 0, 2.8, 'accent', low=.7, high=.85)   # a stone ground floor
        box(mesh, -W + .2, W - .2, -D + .2, D - .2, 2.8, 5.6, 'stone', low=.85, high=1.0)
        gable(mesh, -W, W, -D, D, 5.6, 11.5, over=1.8, along='y')
        box(mesh, -W, W, -D - 2.2, -D, 3.0, 3.2, 'accent', low=.85, high=.95)  # the balcony
        box(mesh, -W, W, -D - 2.3, -D - 2.1, 3.2, 4.1, 'accent', low=.9, high=1.0)
        windows(mesh, -D, -W + 1, W - 1, 3.5, 5.0, 8, w=.9)
        windows(mesh, -D, -W + 1, W - 1, .8, 2.2, 6, w=1.0)
        door(mesh, -D, 0)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def stonehouse():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D, .3)
        box(mesh, -W, W, -D, D, 0, 4.8, 'stone', low=.75, high=.95)
        gable(mesh, -W, -1, -D, D, 4.8, 9.2, over=.5, along='y')
        gable(mesh, 1, W, -D, D, 4.8, 9.2, over=.5, along='y')
        box(mesh, -1, 1, -D, D, 4.5, 7.0, 'stone', low=.8, high=.9)
        chimney(mesh, -W + .6, 0, 4, 10.6, .9)
        chimney(mesh, W - .6, 0, 4, 10.6, .9)
        windows(mesh, -D, -W + 1, W - 1, 1.4, 3.2, 6, w=1.0)
        door(mesh, -D, 0, w=1.6)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def farmhouse():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D)
        box(mesh, -W, W, -D, D, 0, 6.4, 'stone', low=.85, high=1.02)
        gable(mesh, -W, W, -D, D, 6.4, 10.0, over=.7)
        windows(mesh, -D, -W + 1, W - 1, 1.1, 2.9, 7)
        windows(mesh, -D, -W + 1, W - 1, 4.0, 5.6, 7)
        shutters(mesh, -D, -W + 1, W - 1, 4.0, 5.6, 7)
        door(mesh, -D, 0)
        box(mesh, -W, W, -D - 3, -D, 3.3, 3.55, 'bark', low=.8, high=.95)  # the porch roof
        posts(mesh, -D - 2.8, -W + .3, W - .3, 7, 3.3, r=.14)
        chimney(mesh, -W + 3, 0, 5, 11.2, .6)
        # Iteration 2: a front gable over the middle bay.
        gable(mesh, -3, 3, -D, -D + 3, 6.4, 9.4, over=.5, along='y')
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def pavilion():
    def build(mesh, rng):
        box(mesh, -W, W, -D, D, -1.0, .45, 'accent', low=.7, high=.85, top=1.0)  # the deck
        posts(mesh, -D + .4, -W + .4, W - .4, 6, 4.8, r=.28)
        posts(mesh, D - .4, -W + .4, W - .4, 6, 4.8, r=.28)
        box(mesh, -4, 4, -3, 3, .45, 3.6, 'stone', low=.85, high=1.0)  # a small bar inside
        hip(mesh, -W, W, -D, D, 4.8, 9.8, over=1.1, inset=.3)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def loglodge():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D)
        for i in range(10):  # logs, alternately lighter
            z = i * .5
            k = .95 if i % 2 else .82
            mesh.add_tube([Vector((-W - .4, -D, z + .25)), Vector((W + .4, -D, z + .25))], [.27, .27], 8, 'stone', rng, shade=lambda co, t, k=k: k)
            mesh.add_tube([Vector((-W - .4, D, z + .25)), Vector((W + .4, D, z + .25))], [.27, .27], 8, 'stone', rng, shade=lambda co, t, k=k: k)
        box(mesh, -W + .1, W - .1, -D + .1, D - .1, 0, 5.0, 'stone', low=.75, high=.9)
        gable(mesh, -W, W, -D, D, 5.0, 10.5, over=1.8, along='y')
        windows(mesh, -D - .3, -W + 2, W - 2, 1.4, 3.4, 5, w=1.4)
        door(mesh, -D - .3, 0, w=2.2)
        posts(mesh, -D - 3, -6, 6, 3, 3.8, r=.3)
        box(mesh, -7, 7, -D - 3.3, -D, 3.8, 4.1, 'bark', low=.8, high=.95)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def clapboard():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D)
        for i in range(12):  # clapboard courses
            z = i * .5
            box(mesh, -W - .04 * (i % 2), W + .04 * (i % 2), -D - .04 * (i % 2), D + .04 * (i % 2), z, z + .5, 'stone', low=.88, high=1.02)
        gable(mesh, -W, W, -D, D, 6.0, 9.6, over=.6)
        box(mesh, -1.6, 1.6, -1.6, 1.6, 9.0, 11.2, 'stone', low=.9, high=1.0)  # the cupola
        box(mesh, -1.9, 1.9, -1.9, 1.9, 11.2, 11.5, 'bark', low=.85, high=.95)
        windows(mesh, -D - .05, -W + 1, W - 1, 1.0, 2.8, 7, w=1.0)
        windows(mesh, -D - .05, -W + 1, W - 1, 3.8, 5.4, 7, w=1.0)
        shutters(mesh, -D - .05, -W + 1, W - 1, 1.0, 2.8, 7, w=1.0)
        shutters(mesh, -D - .05, -W + 1, W - 1, 3.8, 5.4, 7, w=1.0)
        door(mesh, -D - .05, 0)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def manor():
    def build(mesh, rng):
        plinth(mesh, -W, W - 3, -D, D)
        box(mesh, -W, W - 3, -D, D, 0, 7.5, 'stone', low=.7, high=.95)
        gable(mesh, -W, W - 3, -D, D, 7.5, 13.0, over=.6)
        # The turret: a tall leaning tower with a cone roof.
        for i in range(6):
            z = i * 2.4
            lean = i * .18
            box(mesh, W - 6 + lean, W + lean, -3, 3, z, z + 2.4, 'stone', low=.72, high=.95)
        cone = [Vector((W - 6.6 + 1.1, -3.6, 14.4)), Vector((W + .6 + 1.1, -3.6, 14.4)), Vector((W + .6 + 1.1, 3.6, 14.4)), Vector((W - 6.6 + 1.1, 3.6, 14.4))]
        tip = Vector((W - 3 + 1.6, 0, 19.5))
        for i in range(4):
            paint(mesh.face([cone[i], cone[(i + 1) % 4], tip], 'bark'), mesh, .9)
        windows(mesh, -D, -W + 1, W - 4, 1.4, 3.4, 5, w=1.0)
        windows(mesh, -D, -W + 1, W - 4, 4.6, 6.6, 5, w=1.0)
        door(mesh, -D, -3)
        chimney(mesh, -W + 2, 2, 6, 14.5, .7)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


def shingle():
    def build(mesh, rng):
        plinth(mesh, -W, W, -D, D)
        box(mesh, -W, W, -D, D, 0, 5.4, 'stone', low=.8, high=1.0)
        hip(mesh, -W, W, -D, D, 5.4, 10.4, over=1.0)
        for x in (-6, 0, 6):  # dormers
            box(mesh, x - 1.2, x + 1.2, -D + .4, -D + 2.6, 6.0, 7.8, 'stone', low=.9, high=1.0)
            gable(mesh, x - 1.2, x + 1.2, -D + .4, -D + 2.6, 7.8, 8.9, over=.3, along='y')
        windows(mesh, -D, -W + 1, W - 1, 1.3, 3.3, 7)
        door(mesh, -D, 0)
        box(mesh, -W, W, -D - 3, -D, 3.2, 3.45, 'bark', low=.8, high=.95)
        posts(mesh, -D - 2.8, -W + .3, W - .3, 8, 3.2, r=.15)
        flagpole(mesh, W - 4.0, -D - 4.5)
    return build


MODELS = [
    ('Blender_Clubhouse_lodge', lodge()),
    ('Blender_Clubhouse_adobe', adobe()),
    ('Blender_Clubhouse_chalet', chalet()),
    ('Blender_Clubhouse_stonehouse', stonehouse()),
    ('Blender_Clubhouse_farmhouse', farmhouse()),
    ('Blender_Clubhouse_pavilion', pavilion()),
    ('Blender_Clubhouse_loglodge', loglodge()),
    ('Blender_Clubhouse_clapboard', clapboard()),
    ('Blender_Clubhouse_manor', manor()),
    ('Blender_Clubhouse_shingle', shingle()),
]

ct.export(MODELS, colours={'stone': (0.86, 0.82, 0.72), 'bark': (0.45, 0.3, 0.24), 'accent': (0.95, 0.93, 0.88), 'dirt': (0.16, 0.2, 0.24)}, figure=1.8)
