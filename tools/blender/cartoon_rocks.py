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
        # THE POLISH GOAL, round 1 (the owner: "some still look like there are
        # floating rocks at the top of the stacks"): each bed was a lens, pointed
        # underneath, so it touched the bed below at a narrow waist and the top
        # slab hovered. Every bed is now flat underneath as well as on top, and
        # sits a fifth of its height into the one below, so they meet on a face.
        # Round 2 (stack-r1): flattened top and bottom, a bed spans only the
        # middle of its ellipsoid -- from 0.6 to 1.4 of its half-height above
        # its base -- so beds spaced by their full height left gaps and the top
        # block hung in the air. Each piece now starts from the measured top of
        # the one below, 4 cm into it. Thicker beds to keep the stack's height.
        # Round 4 (stack-r3, in the game): a bed could come out wider than the
        # one under it, and a wide slab on a narrow one read as floating over
        # its own dark undercut. Each bed is now at most 95% as wide as the
        # bed below: the stack tapers up, as a weathered butte does.
        # Round 5 (stack-r4, in the game): a bed cut from the middle of an
        # ellipsoid bulges and curls in underneath, so every bed undercut itself
        # and threw a dark band under its own lip -- the "floating" look, even
        # where beds touch. A bed is now cut from a thin band at the ellipsoid's
        # equator (flat top and bottom at 0.75), so its sides stand nearly
        # upright, and beds sit nearly in line (offsets halved). A bed of
        # thickness t needs a half-height of t / (2 x 0.25); it spans base +
        # 0.75 rz to base + 1.25 rz.
        top, last, f = -.05, 1.05, .75
        for b in range(beds):
            t = rng.uniform(.26, .42)
            rz = t / (2 * (1 - f))
            shrink = min(last * .95, (1 - .1 * b) * rng.uniform(.78, 1.05))
            last = shrink
            off = Vector((rng.uniform(-.09, .09), rng.uniform(-.07, .07), 0))
            base = top - f * rz - .04
            ct.hull_rock(mesh, rng, Vector((off.x, off.y, base)), (w * shrink, w * rng.uniform(.6, .85) * shrink, rz),
                         points=14, bevel=.05, seat=0, flat_top=f, flat_bottom=f, shade_low=.7 + .06 * b, shade_high=1.0 + .05 * b)
            top = base + (2 - f) * rz
        if k % 2 == 1:
            rz = .22 / (2 * (1 - .6))
            ct.hull_rock(mesh, rng, Vector((rng.uniform(-.15, .15), rng.uniform(-.1, .1), top - .6 * rz - .04)), (.35, .28, rz),
                         points=10, bevel=.04, seat=0, flat_top=.6, flat_bottom=.6, shade_low=.85, shade_high=1.1)
    return build


MODELS = [(f'Blender_BoulderRound_{k + 1}', round_rock(k)) for k in range(4)] + \
         [(f'Blender_BoulderAngular_{k + 1}', angular_rock(k)) for k in range(4)] + \
         [(f'Blender_BoulderLayered_{k + 1}', layered_rock(k)) for k in range(4)]

ct.export(MODELS, colours={'stone': (0.55, 0.53, 0.5), 'accent': (0.42, 0.52, 0.28)})
