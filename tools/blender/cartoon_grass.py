# THE CARTOON LONG GRASS (the cartoon overhaul; the owner's addendum: "a large
# library of brush, bushes, LONG grass ... for each biome").
#
#   node tools/blender/run.mjs cartoon_grass --render
#
# Clumps of long grass that read from a distance, one family per landscape,
# planted in drifts on the wild ground between the holes (vegetation.js
# `addLongGrass`). Decoration only: nothing a ball can hit. Each clump is a
# hundred-odd triangles of two-sided blades (fb.blade), green at the root and
# a second role toward the tip -- seed heads, straw, flowers -- that the game
# paints per landscape. From the real grasses (RESEARCH, *The overhaul's long
# grass*):
#
#   fescue     links: fine wiry blades in loose arching tufts, 0.4-0.8 m,
#              straw tips by summer -- the golden rough of a links
#   marram     links and dunes: stiff rolled blades standing upright, 0.6-1.2 m
#   bluestem   prairie: big bluestem, 1-2 m, upright, three-fingered heads
#              ("turkey foot"), rust in autumn
#   alpine     mountain meadow: a low tussock with flowers on stalks
#   bunch      desert: a rounded fountain of pale straw blades (deergrass,
#              bush muhly), 0.5-1 m
#   sedge      forest floors: dark arching sedge, 0.3-0.6 m
#   tussock    Haunted Hollow: a dead, flopped tussock
#   plume      Island: tall grass with feathery plumes
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def paint_blades(mesh, height, low=.62, high=1.12, flex=1.0):
    """Every vertex painted by its height: dark at the root, bright at the tip,
    and free in the wind toward the tip. Normals straight up (the game lights
    grass like the ground it stands on)."""
    for v in mesh.bm.verts:
        t = max(0.0, min(1.0, v.co.z / max(height, 1e-6)))
        m = low + (high - low) * t
        mesh.paint[v] = (m, m, m, flex * t * t)
        mesh.normal[v] = Vector((0, 0, 1))


def tuft(height, blades, lean, width, droop, spread, tip_from=.62, heads=0, head_role='accent', stiff=False):
    # Round 2: round 1's blades were hair (1.5-3 cm) and the clumps see-through,
    # gone at any distance. Blades 2.5 times as broad and 40% more of them, and
    # a low mound at the core, so a clump has a body that reads from afar.
    width, blades = width * 2.5, int(blades * 1.4)

    def build(mesh, rng):
        H = height
        # Round 3: round 2's mound was a faceted rock at the foot of the tall
        # clumps; smaller, flatter and smoother, it is the clump's base.
        mesh.add_lump(Vector((0, 0, H * .06)), (spread * 1.1 + H * .05, spread * 1.1 + H * .05, H * .16), 'leaf', rng,
                      subdiv=1, jitter=.06, flex=.2, squash_bottom=.8)
        for i in range(blades):
            a = i * ct.GOLDEN + rng.uniform(-.3, .3)
            r = spread * math.sqrt(rng.random())
            root = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            h = H * rng.uniform(.6, 1.0)
            fb.blade(mesh, root, a + rng.uniform(-.4, .4), lean * rng.uniform(.6, 1.3) * (0.7 if stiff else 1), h,
                     width * rng.uniform(.8, 1.2), rng, segments=3, tip_from=tip_from, droop=droop * rng.uniform(.5, 1.2))
        # Seed heads on bare stalks standing above the blades.
        for i in range(heads):
            a = rng.uniform(0, math.tau)
            root = Vector((math.cos(a) * spread * .5, math.sin(a) * spread * .5, 0))
            h = H * rng.uniform(1.1, 1.35)
            top = root + Vector((math.cos(a) * h * .12, math.sin(a) * h * .12, h))
            fb.blade(mesh, root, a, .12, h * .92, width * .35, rng, segments=2, tip_from=1.1, droop=0)
            mesh.add_lump(top, (width * 1.2, width * 1.2, H * .1), head_role, rng, subdiv=0, jitter=.15, flex=1.0)
        paint_blades(mesh, H * 1.35 if heads else H)
    return build


def bluestem(height, stems):
    def build(mesh, rng):
        H = height
        for i in range(stems):
            a = i * ct.GOLDEN
            r = .12 * math.sqrt(rng.random())
            root = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            h = H * rng.uniform(.7, 1.0)
            fb.blade(mesh, root, a, .18, h * .75, .05, rng, segments=3, tip_from=.85, droop=.15)
            # The turkey foot: a stalk splitting into three fingers.
            if i % 3 == 0:
                top = root + Vector((0, 0, h))
                fb.blade(mesh, root, a, .05, h, .012, rng, segments=2, tip_from=1.1)
                for k in range(3):
                    b = a + (k - 1) * .5
                    tip = top + Vector((math.cos(b) * H * .06, math.sin(b) * H * .06, H * .09))
                    mesh.add_tube([top, tip], [.01, .004], 3, 'accent', rng=rng, cap_end=False)
        paint_blades(mesh, H * 1.1)
    return build


MODELS = [
    ('Blender_Fescue_1', tuft(.7, 26, .55, .018, .35, .14, tip_from=.55)),
    ('Blender_Fescue_2', tuft(.55, 20, .7, .016, .45, .12, tip_from=.5)),
    ('Blender_Fescue_3', tuft(.8, 30, .45, .018, .3, .16, tip_from=.6, heads=4)),
    # Round 4: round 3's marram stood in a tight column (celery, in the game);
    # a marram tussock splays.
    ('Blender_Marram_1', tuft(.95, 18, .55, .03, .12, .18, tip_from=.75, stiff=True)),
    ('Blender_Marram_2', tuft(1.1, 22, .5, .03, .1, .2, tip_from=.8, stiff=True)),
    ('Blender_Bluestem_1', bluestem(1.5, 15)),
    ('Blender_Bluestem_2', bluestem(1.2, 12)),
    ('Blender_Alpine_1', tuft(.35, 16, .6, .025, .3, .1, tip_from=.9, heads=5)),
    ('Blender_Alpine_2', tuft(.3, 14, .7, .025, .35, .1, tip_from=.9, heads=7)),
    ('Blender_Bunch_1', tuft(.75, 34, .9, .016, .55, .1, tip_from=.45)),
    ('Blender_Bunch_2', tuft(.6, 28, 1.0, .015, .6, .08, tip_from=.4, heads=3)),
    ('Blender_Sedge_1', tuft(.45, 18, .9, .03, .55, .08, tip_from=.95)),
    ('Blender_Sedge_2', tuft(.35, 14, 1.0, .03, .6, .07, tip_from=.95)),
    ('Blender_Tussock_1', tuft(.5, 24, 1.2, .025, .8, .12, tip_from=.3)),
    ('Blender_Tussock_2', tuft(.4, 20, 1.3, .025, .9, .1, tip_from=.25)),
    ('Blender_Plume_1', tuft(1.3, 16, .4, .03, .25, .12, tip_from=.85, heads=5)),
    ('Blender_Plume_2', tuft(1.1, 14, .45, .03, .3, .1, tip_from=.85, heads=4)),
]

ct.export(MODELS, colours={'leaf': (0.42, 0.55, 0.28), 'accent': (0.85, 0.74, 0.45)})
