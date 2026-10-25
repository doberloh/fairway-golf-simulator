# THE CARTOON BOULDERS (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_rocks --render
#
# Every scattered boulder and every stone a fairway feature is built from,
# replacing four squashed icosahedra that read as grey gems. Three styles,
# each from the rock its landscape is made of (RESEARCH, *The overhaul's
# boulders*):
#
#   round     granite corestones ("woolsacks"): a jointed block whose corners
#             and edges weather faster than its faces, left rounded on the
#             surface once the decayed rock round it washes away
#   angular   talus: frost-split along joints, angular, slabby, lying where
#             it fell below a cliff
#   layered   sandstone: horizontal beds stacked like plates, each a little
#             offset, ledges where a softer bed wore back
#
# Four of each, `_1`..`_4`, because a boulder's `shape` (0-3, drawn by the
# generator) picks which. Built about 2 m across and 1.3 m tall; the game
# scales each to the size the generator gave it. The upward faces of the
# round and angular stones are the accent role, so a biome can moss or
# lichen them (vegetation.js `rockMoss`); the layered ones are all stone.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


# Round 2: built as a hull with a wide bevel, the round stones threw spikes
# (the bevel overran the hull's short edges); now a lumpy sphere instead.
def round_rock(k):
    def build(mesh, rng):
        w = 1.0 + .15 * k
        # Round 3: smoother (it read coarse at 42 vertices) and mossed only on
        # its flattest top, not capped.
        ct.pebble_rock(mesh, rng, Vector((0, 0, 0)), (w, w * rng.uniform(.75, .92), .7 + .08 * k), moss='accent',
                       lumps=.16 + .03 * k, subdiv=3, moss_at=.6)
    return build


def angular_rock(k):
    def build(mesh, rng):
        w = .9 + .15 * k
        ct.hull_rock(mesh, rng, Vector((0, 0, 0)), (w * 1.25, w * rng.uniform(.55, .8), .55 + .1 * k), points=11,
                     bevel=.05, seat=.15, moss='accent', shade_low=.58, shade_high=1.1)
    return build


def layered_rock(k):
    def build(mesh, rng):
        beds = 3 + (k % 2)
        z = 0.0
        w = 1.1 + .12 * k
        # Round 3: the beds were pillows of one size; now each wears back by
        # its own amount and some carry a broken block on top.
        for b in range(beds):
            h = rng.uniform(.22, .42)
            shrink = (1 - .1 * b) * rng.uniform(.78, 1.05)
            off = Vector((rng.uniform(-.22, .22), rng.uniform(-.18, .18), 0))
            ct.hull_rock(mesh, rng, Vector((off.x, off.y, z - .05)), (w * shrink, w * rng.uniform(.6, .85) * shrink, h * .5),
                         points=12, bevel=.05, seat=0, flat_top=.6, shade_low=.7 + .06 * b, shade_high=1.0 + .05 * b)
            z += h * .82
        if k % 2 == 1:
            ct.hull_rock(mesh, rng, Vector((rng.uniform(-.3, .3), rng.uniform(-.2, .2), z - .28)), (.35, .28, .22),
                         points=9, bevel=.04, seat=0, shade_low=.85, shade_high=1.1)
    return build


MODELS = [(f'Blender_BoulderRound_{k + 1}', round_rock(k)) for k in range(4)] + \
         [(f'Blender_BoulderAngular_{k + 1}', angular_rock(k)) for k in range(4)] + \
         [(f'Blender_BoulderLayered_{k + 1}', layered_rock(k)) for k in range(4)]

ct.export(MODELS, colours={'stone': (0.55, 0.53, 0.5), 'accent': (0.42, 0.52, 0.28)})
