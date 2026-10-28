# THE CARTOON DEADFALL (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_deadfall --render
#
# The forest floor's fallen wood and mossy stones (vegetation.js addDeadfall,
# the Giant Redwood and Haunted Hollow), which were grown models in another
# hand. Roles as addDeadfall paints them: `bark` the wood, `accent` a log's
# cut or broken face and a stone's moss, `leaf` moss on wood, `stone` stone.
#
# A model is scaled to unit height in the game, so a LOG is built lying down
# (its height is its thickness, its length follows), a STUMP standing.
# From the real thing (RESEARCH, *The overhaul's deadfall*): a nurse log is a
# fallen trunk going soft, moss along its upper flank, a broken end and a
# sawn one; an old stump has root flares, a jagged or flat top; boulders on a
# forest floor are moss-capped.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def log(length, broken):
    def build(mesh, rng):
        r = .5
        # Round 2: round 1's logs were straight pipes; a fallen trunk sags,
        # swells and narrows, and keeps a stub or two of its limbs.
        pts = [Vector((-length / 2 + length * k / 8, rng.uniform(-.08, .08), r * .9 + rng.uniform(-.06, .06) - .08 * math.sin(math.pi * k / 8))) for k in range(9)]
        made = mesh.add_tube(pts, [r * (1.1 - .2 * k / 8) * rng.uniform(.9, 1.1) for k in range(9)], 10, 'bark', rng=rng, wobble=.1,
                             shade=lambda co, t: .8, cap_end=not broken)
        for k in range(rng.randint(1, 3)):
            p = pts[rng.randint(2, 6)]
            ang = rng.uniform(-1.2, 1.2)
            d = Vector((rng.uniform(-.3, .3), math.sin(ang), math.cos(ang))).normalized()
            ct.limb(mesh, rng, p, p + d * r * rng.uniform(1.2, 2), r * .22, r * .1, bow=.05, sides=5, shade=.75)
        # Paint: darker underneath, lighter along the top.
        for ring in made:
            for v in ring:
                up = (v.co.z - r * .9) / r
                m = .6 + .45 * max(0, up)
                mesh.paint[v] = (m, m, m, 0.0)
        # The sawn end: a pale disc with rings.
        a = pts[0]
        mesh.add_lump(a + Vector((-.01, 0, 0)), (.04, r * .98, r * .98), 'accent', rng, subdiv=2, jitter=.02,
                      shade=lambda p, n: .85 + .25 * min(1, (p - a).length / r))
        if broken:
            # Splinters at the far end.
            b = pts[-1]
            for k in range(6):
                ang = k / 6 * math.tau
                base = b + Vector((0, math.cos(ang) * r * .6, math.sin(ang) * r * .6))
                tip = base + Vector((rng.uniform(.15, .45), math.cos(ang) * .05, math.sin(ang) * .05))
                mesh.add_tube([base, tip], [r * .22, .02], 3, 'accent', rng=rng, cap_end=False)
        # Moss along the upper flank, and a few toadstool-free lumps of it.
        # Round 2: a blanket of moss along the top, many overlapping cushions,
        # not a few flat patches.
        for k in range(rng.randint(12, 16)):
            t = rng.uniform(.08, .92)
            i = min(len(pts) - 2, int(t * (len(pts) - 1)))
            p = pts[i].lerp(pts[i + 1], t * (len(pts) - 1) - i) + Vector((0, rng.uniform(-.18, .18), r * .78))
            s = rng.uniform(.2, .34)
            mesh.add_lump(p, (s * 1.5, s, s * .45), 'leaf', rng, subdiv=2, jitter=.15, flex=0.0)
    return build


def stump(height, cut):
    def build(mesh, rng):
        H = height
        r = H * .55
        pts = [Vector((0, 0, H * k / 4)) for k in range(5)]
        made = mesh.add_tube(pts, [r * 1.25, r * 1.05, r, r * .98, r * .96], 12, 'bark', rng=rng, wobble=.08,
                             shade=lambda co, t: .7 + .3 * t, cap_end=False)
        top = pts[-1]
        if cut:
            mesh.add_lump(top, (r * .97, r * .97, .03), 'accent', rng, subdiv=2, jitter=.02,
                          shade=lambda p, n: .8 + .3 * min(1, (p - top).length / r))
        else:
            # A jagged broken top: splinters rising from the rim.
            for k in range(9):
                ang = k / 9 * math.tau
                base = top + Vector((math.cos(ang) * r * .8, math.sin(ang) * r * .8, 0))
                # Round 2: smaller, uneven splinters -- round 1's were a crown of teeth.
                tip = base + Vector((rng.uniform(-.05, .05), rng.uniform(-.05, .05), H * rng.uniform(.06, .3)))
                mesh.add_tube([base, tip], [r * rng.uniform(.12, .2), .015], 3, 'accent', rng=rng, cap_end=False)
        # Root flares.
        for k in range(rng.randint(4, 6)):
            ang = k / 5 * math.tau + rng.uniform(-.3, .3)
            out = Vector((math.cos(ang), math.sin(ang), 0))
            ct.limb(mesh, rng, out * r * .8 + Vector((0, 0, H * .25)), out * r * 2.1 + Vector((0, 0, -.05)), r * .32, r * .08,
                    bow=-.05, sides=5, shade=.7)
        # Moss on one side.
        side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized()
        for k in range(5):
            # Round 3: round 2's moss sank inside the trunk; set on its skin.
            p = side * r * 1.08 + Vector((rng.uniform(-.1, .1), rng.uniform(-.1, .1), H * rng.uniform(.15, .75)))
            mesh.add_lump(p, (r * .3, r * .3, H * .17), 'leaf', rng, subdiv=2, jitter=.15)
    return build


def mossrock(size, flat):
    def build(mesh, rng):
        ct.pebble_rock(mesh, rng, Vector((0, 0, 0)), (size, size * rng.uniform(.75, .95), size * flat), role='stone',
                       moss='accent', subdiv=3, moss_at=.72)
    return build


MODELS = [
    ('Blender_Log_1', log(6, False)),
    ('Blender_Log_2', log(4.5, True)),
    ('Blender_Log_3', log(7.5, True)),
    ('Blender_Stump_1', stump(1, True)),
    ('Blender_Stump_2', stump(1.4, False)),
    ('Blender_Stump_3', stump(.8, False)),
    ('Blender_MossRock_1', mossrock(1, .7)),
    ('Blender_MossRock_2', mossrock(1, .5)),
    ('Blender_MossRock_3', mossrock(1, .85)),
]

ct.export(MODELS, colours={'bark': (0.42, 0.32, 0.24), 'accent': (0.75, 0.62, 0.42), 'leaf': (0.32, 0.45, 0.22),
                           'stone': (0.55, 0.53, 0.5)})
