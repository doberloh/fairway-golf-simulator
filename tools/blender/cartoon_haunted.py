# THE CARTOON HAUNTED HOLLOW (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_haunted --render
#
# Haunted Hollow's dead trees, which came from three different packs (a
# megakit, an "ultimate stylized" kit and Kenney) in three hands. From the
# real thing (RESEARCH, *The overhaul's haunted pack*):
#
#   gnarled    an old tree twisted by wind: a short leaning trunk, crooked
#              limbs hooking up and then down at the tips -- the witch's tree
#   snag       a standing dead conifer: few limbs, no fine branching, a
#              broken jagged top, bark peeling in patches (the accent is the
#              pale bare wood)
#   deadwillow a broad split trunk and long lifeless whips hanging in
#              twisted cascades
#   deadoak    a dead oak's skeleton: wide-spreading twisting limbs
#
# All built from one crooked branching helper, so they are one hand.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def crooked(rng, start, direction, length, steps, kink, curl=Vector((0, 0, 0))):
    """Points from `start` along `direction`, each step turned a little at
    random (`kink`) and pulled by `curl` -- a limb that wanders."""
    pts, d, p = [start], direction.normalized(), start
    for k in range(steps):
        d = (d + Vector((rng.uniform(-kink, kink), rng.uniform(-kink, kink), rng.uniform(-kink, kink) * .5)) + curl).normalized()
        p = p + d * (length / steps)
        pts.append(p)
    return pts


def branch(mesh, rng, start, direction, length, radius, depth, children, spread, kink, curl, shade=.8):
    pts = crooked(rng, start, direction, length, 5, kink, curl)
    radii = [radius * (1 - .7 * k / 5) for k in range(6)]
    mesh.add_tube(pts, radii, 6 if depth > 1 else 4, 'bark', rng=rng, wobble=.08,
                  shade=lambda co, t: shade * (.9 + .2 * t), flex=lambda co, t: .15 + .3 * t * (3 - depth) / 3)
    if depth <= 0:
        return
    for i in range(children):
        at = rng.randint(2, 5)
        d = (pts[min(at, 5)] - pts[at - 1]).normalized()
        side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0))
        nd = (d + side * spread).normalized()
        branch(mesh, rng, pts[at], nd, length * rng.uniform(.5, .7), radii[at] * .75, depth - 1, children, spread, kink, curl, shade)


def gnarled(height):
    def build(mesh, rng):
        H = height
        lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized()
        # A short, thick trunk leaning and twisting.
        # Round 2: round 1's limbs were thin and the hooks did not read; a
        # chunkier, harder-twisted tree.
        trunk = crooked(rng, Vector((0, 0, 0)), Vector((0, 0, 1)) + lean * .35, H * .45, 6, .4)
        mesh.add_tube(trunk, [H * .07 * (1.4 if k == 0 else 1) * (1 - .45 * k / 6) for k in range(7)], 8, 'bark', rng=rng,
                      wobble=.12, shade=lambda co, t: .7 + .25 * t, flex=lambda co, t: .1 * t)
        top = trunk[-1]
        for i in range(4):
            a = i / 4 * math.tau + rng.uniform(-.5, .5)
            d = Vector((math.cos(a), math.sin(a), .6))
            # Hooks: up, then curling down at the tips.
            branch(mesh, rng, top, d, H * .4, H * .048, 2, 2, .9, .45, Vector((0, 0, -.2)))
    return build


def snag(height):
    def build(mesh, rng):
        H = height
        pts = crooked(rng, Vector((0, 0, 0)), Vector((0, 0, 1)), H, 8, .04)
        # Round 2: thicker -- round 1's snag was a pole.
        radii = [H * .055 * (1.3 if k == 0 else 1) * (1 - .5 * k / 8) for k in range(9)]
        made = mesh.add_tube(pts, radii, 8, 'bark', rng=rng, wobble=.06, shade=lambda co, t: .7 + .3 * t,
                             flex=lambda co, t: .1 * t, cap_end=False)
        # Bark peeling in patches: the pale wood beneath (the accent).
        for i, ring in enumerate(made):
            for j, v in enumerate(ring):
                if (i * 3 + j * 5) % 7 == 0 and i > 1:
                    r = radii[i]
                    mesh.add_lump(v.co.copy(), (r * .45, r * .45, r * 1.2), 'accent', rng, subdiv=1, jitter=.1, flex=.1)
        # The broken top: jagged splinters standing up from the last ring.
        top, r = pts[-1], radii[-1]
        for k in range(5):
            a = k / 5 * math.tau + rng.uniform(-.3, .3)
            base = top + Vector((math.cos(a) * r * .6, math.sin(a) * r * .6, 0))
            tip = base + Vector((math.cos(a) * r * .2, math.sin(a) * r * .2, H * rng.uniform(.03, .09)))
            mesh.add_tube([base, tip], [r * .35, r * .05], 3, 'accent', rng=rng, cap_end=False)
        # A few stubs of limbs, no fine branching.
        for i in range(rng.randint(4, 7)):
            k = rng.randint(3, 7)
            a = rng.uniform(0, math.tau)
            d = Vector((math.cos(a), math.sin(a), rng.uniform(-.3, .2)))
            ct.limb(mesh, rng, pts[k], pts[k] + d * H * rng.uniform(.06, .14), radii[k] * .4, radii[k] * .15, bow=.05, sides=4, shade=.75)
    return build


def deadwillow(height):
    def build(mesh, rng):
        H = height
        # A broad trunk split into two leaders.
        trunk = crooked(rng, Vector((0, 0, 0)), Vector((0, 0, 1)), H * .35, 4, .1)
        mesh.add_tube(trunk, [H * .08 * (1.3 if k == 0 else 1) * (1 - .3 * k / 4) for k in range(5)], 9, 'bark', rng=rng,
                      wobble=.15, shade=lambda co, t: .65 + .25 * t, flex=lambda co, t: .1 * t)
        top = trunk[-1]
        for i in range(2):
            a = i * math.pi + rng.uniform(-.4, .4)
            d = Vector((math.cos(a) * .6, math.sin(a) * .6, 1))
            leader = crooked(rng, top, d, H * .35, 4, .15)
            mesh.add_tube(leader, [H * .05 * (1 - .5 * k / 4) for k in range(5)], 7, 'bark', rng=rng, wobble=.1,
                          shade=lambda co, t: .75 + .2 * t, flex=lambda co, t: .15 + .2 * t)
            # The whips: long thin branches rising a little, then hanging.
            for k in range(9):
                p = leader[rng.randint(2, 4)]
                b = rng.uniform(0, math.tau)
                out = Vector((math.cos(b), math.sin(b), .5)).normalized()
                pts = crooked(rng, p, out, H * rng.uniform(.4, .6), 7, .12, Vector((0, 0, -.35)))
                mesh.add_tube(pts, [H * .012 * (1 - .8 * j / 7) for j in range(8)], 3, 'bark', rng=rng,
                              shade=lambda co, t: .8 + .15 * t, flex=lambda co, t: .3 + .7 * t, cap_end=False)
    return build


def deadoak(height):
    def build(mesh, rng):
        H = height
        trunk = crooked(rng, Vector((0, 0, 0)), Vector((0, 0, 1)), H * .32, 4, .08)
        mesh.add_tube(trunk, [H * .065 * (1.5 if k == 0 else 1) * (1 - .3 * k / 4) for k in range(5)], 9, 'bark', rng=rng,
                      wobble=.1, shade=lambda co, t: .7 + .25 * t, flex=lambda co, t: .1 * t)
        top = trunk[-1]
        for i in range(5):
            a = i / 5 * math.tau + rng.uniform(-.3, .3)
            d = Vector((math.cos(a), math.sin(a), .45))
            # Round 3: thicker and more twisted -- round 2's skeleton was a
            # tidy textbook tree.
            branch(mesh, rng, top, d, H * .44, H * .058, 2, 2, .8, .32, Vector((0, 0, .01)))
    return build


MODELS = [
    ('Blender_Gnarled_1', gnarled(9)),
    ('Blender_Gnarled_2', gnarled(7)),
    ('Blender_Gnarled_3', gnarled(10)),
    ('Blender_Snag_1', snag(14)),
    ('Blender_Snag_2', snag(11)),
    ('Blender_Snag_3', snag(17)),
    ('Blender_DeadWillow_1', deadwillow(10)),
    ('Blender_DeadWillow_2', deadwillow(8)),
    ('Blender_DeadOak_1', deadoak(13)),
    ('Blender_DeadOak_2', deadoak(11)),
]

ct.export(MODELS, colours={'bark': (0.32, 0.28, 0.27), 'accent': (0.7, 0.66, 0.6)})
