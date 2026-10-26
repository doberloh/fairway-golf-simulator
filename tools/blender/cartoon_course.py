# THE CARTOON COURSE FURNITURE (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_course --render
#
# What stands at every tee, in the overhaul's hand. Until now a tee marker was
# a plain sphere and the tee sign a box on a cylinder (renderer.js
# addHoleDetails), and the bench its comment promised was never built. From
# what real courses put on a tee box (RESEARCH, *The overhaul's course
# furniture*):
#
#   tee marker   a squat dome on a flat collar, about 17 cm across -- the
#                moulded plastic markers most clubs use, coloured per tee in
#                the game (role `accent`)
#   tee sign     a hole sign on two square timber posts under a small gable
#                cap; the game puts the hole's number, par and length on a
#                face in front of the board (the board is 1.0 x 1.25 m, its
#                centre 1.55 m up and its face 4.5 cm in front of the posts'
#                centre line, which is the model's -Y: glTF +Z)
#   bench        a slatted timber bench with a back, 1.6 m long
#   ball washer  a paddle washer on a post: a rounded box with a crank and a
#                towel hanging from its side
#
# Measured in metres; each model's real height is noted beside it, because
# the ingest scales every model to one unit tall and the game scales back.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def block(mesh, x0, x1, y0, y1, z0, z1, role, low=.8, high=1.05, top=None):
    """A box of six painted faces, darker toward its foot (`low` at z0 to
    `high` at z1). `top` paints the upper face on its own."""
    span = max(z1 - z0, 1e-6)
    shade = lambda co: low + (high - low) * max(0.0, min(1.0, (co.z - z0) / span))
    P = lambda x, y, z: Vector((x, y, z))
    faces = [
        [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],  # -Y, the front
        [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)],  # +Y
        [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)],  # -X
        [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],  # +X
        [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],  # top
        [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)],  # underside
    ]
    for i, pts in enumerate(faces):
        f = mesh.face(pts, role)
        for v in f.verts:
            s = top if (i == 4 and top is not None) else shade(v.co) * (.7 if i == 5 else 1)
            mesh.paint[v] = (s, s, s, 0.0)


def tee_marker():
    # 0.11 m tall.
    def build(mesh, rng):
        # The collar: a low flat ring the dome sits on.
        mesh.add_lump(Vector((0, 0, .012)), (.092, .092, .016), 'bark', rng, subdiv=3, jitter=0.0, squash_bottom=1.0,
                      shade=lambda w, n: .75)
        # The dome, flat underneath, lighter on top.
        mesh.add_lump(Vector((0, 0, .02)), (.08, .08, .09), 'accent', rng, subdiv=3, jitter=0.0, squash_bottom=1.0,
                      crown=Vector((0, 0, .02)), blend=.3, shade=lambda w, n: .78 + .32 * max(0.0, min(1.0, (w.z - .02) / .09)))
    return build


def tee_sign():
    # 2.35 m tall. Posts 9 cm square, 1.16 m apart, the board between them.
    def build(mesh, rng):
        for x in (-.58, .58):
            block(mesh, x - .045, x + .045, -.045, .045, 0, 2.18, 'bark', low=.6, high=1.0)
        # The board's frame: dark, a little proud of the posts.
        block(mesh, -.54, .54, -.04, .03, .9, 2.2, 'stone', low=.85, high=1.0)
        # A crossbar under it.
        block(mesh, -.62, .62, -.05, .05, .82, .9, 'bark', low=.8, high=.95)
        # The gable cap: two sloping boards and a ridge.
        w, base, peak, d = .72, 2.18, 2.35, .14
        for s in (-1, 1):
            pts = [Vector((-w, s * d, base)), Vector((w, s * d, base)), Vector((w, 0, peak)), Vector((-w, 0, peak))]
            if s > 0:
                pts = pts[::-1]
            f = mesh.face(pts, 'accent')
            for v in f.verts:
                mesh.paint[v] = (.95, .95, .95, 0.0)
            g = mesh.face(pts[::-1], 'accent')
            for v in g.verts:
                mesh.paint[v] = (.55, .55, .55, 0.0)
        for x in (-w, w):
            f = mesh.face([Vector((x, -d, base)), Vector((x, d, base)), Vector((x, 0, peak))][::(1 if x > 0 else -1)], 'accent')
            for v in f.verts:
                mesh.paint[v] = (.8, .8, .8, 0.0)
    return build


def bench():
    # 0.9 m tall (the back), 1.6 m long.
    def build(mesh, rng):
        L = .8
        # Legs: two A-frames of timber at each end.
        for x in (-L + .1, L - .1):
            block(mesh, x - .04, x + .04, -.2, -.12, 0, .44, 'bark', low=.6, high=.9)
            block(mesh, x - .04, x + .04, .12, .2, 0, .9, 'bark', low=.6, high=.9)
            block(mesh, x - .04, x + .04, -.22, .22, .38, .44, 'bark', low=.85, high=.9)
        # Seat slats, a hair apart, alternately lighter.
        for i, y in enumerate((-.19, -.09, .01, .11)):
            k = 1.0 if i % 2 else .92
            block(mesh, -L, L, y, y + .085, .44, .48, 'accent', low=.85 * k, high=1.0 * k, top=1.05 * k)
        # Back slats.
        for i, z in enumerate((.58, .72)):
            block(mesh, -L, L, .2, .24, z, z + .1, 'accent', low=.9, high=1.0)
    return build


def ball_washer():
    # 1.05 m tall.
    def build(mesh, rng):
        block(mesh, -.04, .04, -.04, .04, 0, .82, 'bark', low=.6, high=.95)
        # A small square foot plate.
        block(mesh, -.14, .14, -.14, .14, 0, .03, 'bark', low=.7, high=.8)
        # The washer: a rounded box, its lid and the crank.
        mesh.add_lump(Vector((0, 0, .9)), (.13, .07, .12), 'accent', rng, subdiv=3, jitter=0.0,
                      crown=Vector((0, 0, .9)), blend=.25, shade=lambda w, n: .8 + .3 * max(0.0, min(1.0, (w.z - .8) / .22)))
        mesh.add_tube([Vector((0, 0, 1.0)), Vector((0, 0, 1.05)), Vector((.06, 0, 1.05))], [.012, .012, .012], 6, 'bark',
                      shade=lambda co, t: .7)
        mesh.add_lump(Vector((.07, 0, 1.05)), (.022, .022, .022), 'stone', rng, subdiv=2, jitter=0.0, shade=lambda w, n: .9)
        # A towel hanging from the side: a thin rounded slab.
        mesh.add_lump(Vector((.15, 0, .78)), (.015, .06, .13), 'stone', rng, subdiv=2, jitter=.05, squash_bottom=.2,
                      shade=lambda w, n: .82 + .25 * max(0.0, min(1.0, (w.z - .65) / .26)))
    return build


MODELS = [
    ('Blender_TeeMarker_1', tee_marker()),
    ('Blender_TeeSign_1', tee_sign()),
    ('Blender_Bench_1', bench()),
    ('Blender_BallWasher_1', ball_washer()),
]

ct.export(MODELS, colours={'accent': (0.85, 0.3, 0.25), 'bark': (0.42, 0.32, 0.22), 'stone': (0.17, 0.3, 0.22)})
