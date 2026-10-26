# THE CARTOON GARDENS (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_garden --render
#
# What stands round a fairway home besides the house (homes.js): until now a
# fence of thin boxes and a garden of seven-sided balls. From the gardens of
# the houses that line a course (RESEARCH, *The overhaul's gardens*):
#
#   fence     a picket fence section, 1.6 m long and a metre high: two square
#             posts with caps, two rails, eight pickets with pointed tops.
#             `bark` the posts and rails, `accent` the pickets, so a white
#             picket can stand on a stained frame
#   shrubs    clipped garden shrubs: a boxwood dome, a flowering bush
#             (hydrangea-like heads, `accent`), and a cone of topiary
#
# Real sizes in metres; the game scales each to its own height.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def box(mesh, c, half, role, low=.85, high=1.05):
    """An axis-aligned block of six painted faces, darker toward its foot."""
    x0, y0, z0 = c.x - half.x, c.y - half.y, c.z - half.z
    x1, y1, z1 = c.x + half.x, c.y + half.y, c.z + half.z
    P = lambda x, y, z: Vector((x, y, z))
    faces = [[P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)],
             [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
             [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]]
    for pts in faces:
        f = mesh.face(pts, role)
        for v in f.verts:
            s = low + (high - low) * max(0.0, min(1.0, v.co.z / 1.0))
            mesh.paint[v] = (s, s, s, 0.0)


def picket(mesh, x, w, h, role):
    """A picket: a flat board with a pointed top."""
    y = -.012
    pts = [Vector((x - w, y, .08)), Vector((x + w, y, .08)), Vector((x + w, y, h - w)), Vector((x, y, h)), Vector((x - w, y, h - w))]
    for side in (1, -1):
        p = [Vector((q.x, q.y * -side if side < 0 else q.y, q.z)) for q in pts]
        if side < 0:
            p = [Vector((q.x, .012, q.z)) for q in pts][::-1]
        f = mesh.face(p, role)
        for v in f.verts:
            s = .82 + .22 * v.co.z
            mesh.paint[v] = (s, s, s, 0.0)


def fence():
    def build(mesh, rng):
        L = 1.6
        for x in (-L / 2, L / 2):
            box(mesh, Vector((x, 0, .5)), Vector((.045, .045, .5)), 'bark', low=.7, high=1.0)
            box(mesh, Vector((x, 0, 1.02)), Vector((.06, .06, .02)), 'bark', low=1.0, high=1.05)
        for z in (.28, .72):
            box(mesh, Vector((0, .03, z)), Vector((L / 2, .015, .035)), 'bark', low=.85, high=.95)
        for k in range(8):
            picket(mesh, -L / 2 + .14 + k * (L - .28) / 7, .035, .92 + (k % 2) * .03, 'accent')
    return build


def dome(height, width):
    def build(mesh, rng):
        c = Vector((0, 0, height * .5))
        # Round 2: round 1 was a lumpy blob; a clipped boxwood is one smooth
        # dome, with only a few soft swellings in it.
        shade = ct.crown_shade(c, (width * .5, width * .48, height * .5), low=.55, high=1.15)
        mesh.add_lump(c, (width * .5, width * .48, height * .5), 'leaf', rng, subdiv=3, jitter=.02, crown=c, blend=.4,
                      shade=shade, flex=.2, squash_bottom=.7)
        for k in range(5):
            a = k * ct.GOLDEN
            p = c + Vector((math.cos(a) * width * .22, math.sin(a) * width * .22, height * .12))
            mesh.add_lump(p, (width * .3, width * .3, height * .3), 'leaf', rng, subdiv=3, jitter=.02, crown=c, blend=.8,
                          shade=shade, flex=.3)
    return build


def flowering(height, width):
    def build(mesh, rng):
        c = Vector((0, 0, height * .5))
        ct.cloud_crown(mesh, rng, c, (width * .5, width * .48, height * .5), lobes=14, lobe_size=(.3, .42), subdiv=2,
                       flat_bottom=.6, shell=.75)
        # Mophead flower heads over the top half.
        # Round 2: smaller heads, more of them (round 1's were white discs).
        for i in range(22):
            y = rng.uniform(-.1, .9)
            r = math.sqrt(max(0, 1 - y * y))
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * r * width * .5, math.sin(a) * r * width * .48, y * height * .5))
            s = width * rng.uniform(.05, .07)
            mesh.add_lump(p, (s, s, s * .85), 'accent', rng, subdiv=2, jitter=.12, flex=.5, shade=lambda w, n: 1.0)
    return build


def cone(height, width):
    def build(mesh, rng):
        shade = ct.crown_shade(Vector((0, 0, height * .5)), (width * .5, width * .5, height * .5), low=.55, high=1.15)
        # Round 2: round 1's seven tiers read as a stepped tree; a clipped cone
        # is smooth, so twelve close tiers that overlap into one surface.
        for k in range(12):
            t = k / 11
            z = height * (.12 + .78 * t)
            r = width * .5 * (1 - .85 * t)
            mesh.add_lump(Vector((0, 0, z)), (r, r, height * .1), 'leaf', rng, subdiv=2, jitter=.05, crown=Vector((0, 0, height * .45)),
                          blend=.6, shade=shade, flex=.3)
        ct.trunk(mesh, rng, Vector((0, 0, 0)), height * .15, width * .05, sides=6, shade_low=.6)
    return build


MODELS = [
    ('Blender_Fence_Picket', fence()),
    ('Blender_GardenShrub_Dome', dome(1.0, 1.4)),
    ('Blender_GardenShrub_Flowering', flowering(1.2, 1.5)),
    ('Blender_GardenShrub_Cone', cone(1.6, .8)),
]

ct.export(MODELS, colours={'bark': (0.45, 0.36, 0.28), 'accent': (0.95, 0.94, 0.9), 'leaf': (0.3, 0.48, 0.24)}, figure=1.0)
