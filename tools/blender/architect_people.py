# THE ARCHITECT'S COURSE MARKINGS (architect-courses, phase 2; the study,
# workstream I; docs/ARCHITECT_COURSES.md).
#
#   node tools/blender/run.mjs architect_people --render
#
# What a club puts out on a course it looks after, in the overhaul's hand:
#
#   stake        a penalty-area stake: a square timber stake with a pointed
#                foot and a bevelled top, the top two thirds painted (role
#                `accent`, red in the game, as every water hazard here is red)
#   ob stake     the boundary's white stake, a touch taller and slimmer
#   yardage post a short square post in the rough beside the fairway with a
#                coloured cap band (red 100, white 150, blue 200 yd from the
#                green's centre, the commonest scheme) and a darker foot
#   rake         a bunker rake lying on the grass beside the sand: a long
#                handle and a toothed head
#
# Measured in metres; each model's real height is noted beside it (the ingest
# scales every model to one unit tall and the game scales back). Every model's
# iterations are logged in docs/ARCHITECT_COURSES.md, *Blender iteration log*.
import math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb

# The painted box, as cartoon_course.py's (copied, not imported: importing
# that script runs its own export into this pack's folder).
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


def stake(height, half, role_top='accent'):
    # A square stake: a pointed foot in the ground, a painted body, a bevelled
    # cap. `height` above ground; the point is below 0 and is cut off by the
    # ingest's standing on y = 0, so it is drawn just above.
    def build(mesh, rng):
        h = height
        # Iteration 2: painted almost to the ground, a dark collar of earth only.
        block(mesh, -half, half, -half, half, 0, h * .12, 'bark', low=.5, high=.75)
        block(mesh, -half, half, -half, half, h * .12, h * .9, role_top, low=.85, high=1.05)
        # The cap: a short pyramid, so the top catches light.
        top = [Vector((-half, -half, h * .9)), Vector((half, -half, h * .9)), Vector((half, half, h * .9)), Vector((-half, half, h * .9))]
        # Iteration 4: a steeper cap, so its lit face catches the eye.
        apex = Vector((0, 0, h * 1.04))
        for i in range(4):
            f = mesh.face([top[i], top[(i + 1) % 4], apex], role_top)
            for v in f.verts:
                mesh.paint[v] = (1.08, 1.08, 1.08, 0.0)
    return build


def yardage_post():
    # 0.62 m tall: a 10 cm square post, a coloured band at the top.
    def build(mesh, rng):
        # Iteration 2: a darker plinth, the post, the band, a chamfered cap.
        block(mesh, -.075, .075, -.075, .075, 0, .06, 'bark', low=.55, high=.7)
        block(mesh, -.055, .055, -.055, .055, .06, .5, 'stone', low=.75, high=.97)
        # Iteration 4: the band deeper (10 -> 14 cm) and proud of the post.
        block(mesh, -.064, .064, -.064, .064, .46, .6, 'accent', low=.95, high=1.06)
        cap = [Vector((-.06, -.06, .6)), Vector((.06, -.06, .6)), Vector((.06, .06, .6)), Vector((-.06, .06, .6))]
        for i in range(4):
            f = mesh.face([cap[i], cap[(i + 1) % 4], Vector((0, 0, .64))], 'stone')
            for v in f.verts:
                mesh.paint[v] = (1.05, 1.05, 1.05, 0.0)
    return build


def rake():
    # 0.12 m tall, 1.7 m long, lying along +Y: a handle and a toothed head.
    def build(mesh, rng):
        mesh.add_tube([Vector((0, -.8, .03)), Vector((0, .75, .03))], [.026, .026], 6, 'bark', rng,
                      shade=lambda co, t: .55 if t < .12 else .8 + .2 * t)  # iteration 6: a dark grip at the end
        block(mesh, -.24, .24, .74, .8, 0, .06, 'accent', low=.85, high=1.0)
        # Iteration 4: twelve stouter teeth, as a bunker rake has.
        for i in range(12):
            x = -.22 + i * .04
            block(mesh, x - .009, x + .009, .8, .855, 0, .04, 'accent', low=.8, high=.9)
    return build


MODELS = [
    # Iteration 2: a cartoon stake is chunkier than a real one (4 cm -> 7 cm)
    # so it reads from 50 m, as the overhaul's furniture is.
    ('Blender_Stake_1', stake(.92, .035)),
    ('Blender_ObStake_1', stake(1.05, .03, role_top='stone')),
    ('Blender_YardagePost_1', yardage_post()),
    ('Blender_Rake_1', rake()),
]

ct.export(MODELS, colours={'accent': (0.85, 0.2, 0.18), 'bark': (0.42, 0.32, 0.22), 'stone': (0.93, 0.92, 0.88)}, figure=0.4)
