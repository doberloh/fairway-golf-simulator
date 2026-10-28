# THE CARTOON WILDFLOWERS (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_flowers --render
#
# The flowers in the rough, which were a 20-face gem perched on a grass blade
# (vegetation.js, the rough's scatter). Small clusters in the overhaul's hand,
# coloured per landscape by the game (`scatter.flowers`): `leaf` the stems and
# leaves, `accent` the petals, `bark` the flower's eye. From the meadow
# flowers the landscapes name (RESEARCH, *The overhaul's wildflowers*):
#
#   daisy      ox-eye daisy: a few stems, each a flat ring of petals round a
#              domed eye
#   aster      a tuft of narrow leaves under several small rayed heads
#   cup        a buttercup or poppy: cupped petals on taller bare stems
#
# About a quarter of a metre tall; the game scales them.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def stem(mesh, rng, base, top, r=.006):
    mesh.add_tube([base, base.lerp(top, .5) + Vector((rng.uniform(-.01, .01), rng.uniform(-.01, .01), 0)), top], [r, r * .9, r * .8], 4,
                  'leaf', shade=lambda co, t: .7 + .3 * t, flex=lambda co, t: .2 + .8 * t)


def head(mesh, rng, at, petals, size, cupped=0.0):
    """A ring of petals round an eye, facing up and a little out.

    Round 3: each petal a flat blade of two triangles (the game draws them
    two-sided), where round 1's were 20-face lumps -- a daisy was 900
    triangles, and the rough grows thousands (Midwest drew 8 M of flowers)."""
    for k in range(petals):
        a = k / petals * math.tau + rng.uniform(-.1, .1)
        out, side = Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0))
        lift = Vector((0, 0, cupped))
        base, tip = at + out * size * .12, at + (out + lift) * size
        mid = at + (out + lift * .5) * size * .55
        f = mesh.face([base, mid - side * size * .22, tip, mid + side * size * .22], 'accent')
        for v in f.verts:
            mesh.paint[v] = (.95, .95, .95, .9)
    mesh.add_lump(at + Vector((0, 0, size * .06)), (size * .28, size * .28, size * .18), 'bark', rng, subdiv=1, jitter=.05,
                  flex=.9, shade=lambda w, n: 1.0)


def leaf(mesh, rng, at, a, length):
    d = Vector((math.cos(a), math.sin(a), .25)).normalized()
    mesh.add_lump(at + d * length * .5, (length * .5, length * .14, length * .05), 'leaf', rng, subdiv=1, jitter=.05,
                  flex=.4, shade=lambda w, n: .8)


def daisy(stems):
    def build(mesh, rng):
        for i in range(stems):
            a = i / stems * math.tau + rng.uniform(-.4, .4)
            base = Vector((math.cos(a) * .03, math.sin(a) * .03, 0))
            top = base + Vector((math.cos(a) * .05, math.sin(a) * .05, rng.uniform(.18, .26)))
            stem(mesh, rng, base, top)
            head(mesh, rng, top, 9, .035)
        for k in range(4):
            leaf(mesh, rng, Vector((0, 0, .01)), k * 1.6 + rng.uniform(0, .5), .06)
    return build


def aster(heads):
    def build(mesh, rng):
        for k in range(7):
            leaf(mesh, rng, Vector((0, 0, .01)), k * .9 + rng.uniform(0, .4), .09)
        for i in range(heads):
            a = rng.uniform(0, math.tau)
            top = Vector((math.cos(a) * .05, math.sin(a) * .05, rng.uniform(.13, .2)))
            stem(mesh, rng, Vector((0, 0, 0)), top, .005)
            head(mesh, rng, top, 7, .022)
    return build


def cup(stems):
    def build(mesh, rng):
        for i in range(stems):
            a = i / stems * math.tau + rng.uniform(-.5, .5)
            base = Vector((math.cos(a) * .02, math.sin(a) * .02, 0))
            top = base + Vector((math.cos(a) * .06, math.sin(a) * .06, rng.uniform(.22, .3)))
            stem(mesh, rng, base, top, .005)
            # Round 2: at .5 the petals lay flat, a white blob; a cup stands up.
            head(mesh, rng, top, 5, .034, cupped=1.4)
        for k in range(3):
            leaf(mesh, rng, Vector((0, 0, .01)), k * 2.1, .07)
    return build


MODELS = [
    ('Blender_Flower_Daisy', daisy(3)),
    ('Blender_Flower_Aster', aster(5)),
    ('Blender_Flower_Cup', cup(3)),
]

ct.export(MODELS, colours={'leaf': (0.35, 0.52, 0.24), 'accent': (0.92, 0.9, 0.85), 'bark': (0.95, 0.75, 0.2)}, figure=.3)
