# LIFE ON THE COURSE (architect-courses, phase 6; the study, workstream M;
# docs/ARCHITECT_COURSES.md).
#
#   node tools/blender/run.mjs architect_life --render
#
# Animals, cartoon and calm, and people far off, in the overhaul's hand.
# Each faces -Y (its head, or its way of walking), stands on Z = 0, and is
# drawn at its real size in metres (the ingest scales to one unit tall; the
# game scales back by the height noted):
#
#   sheep        0.9 m: a woolly cloud on four short dark legs, a dark face
#   goose        0.8 m: grey-brown, a black neck, a white chin strap
#   deer         1.45 m: a doe, white tail, big ears
#   elk          2.3 m: a bull with a rack of antlers
#   heron        1.0 m: grey, long legs, a long neck, a dagger bill
#   roadrunner   0.5 m: streaked, a crest and a long tail, running
#   bird         0.2 m tall, 1.2 m across: wings spread, gliding (a gull
#                white, a raven black, by colour)
#   golfer       1.75 m: walking, cap, shirt, trousers, a bag on the back
#   mower        1.6 m: a greenkeeper on a ride-on mower
#
# Roles (the game colours each per animal): body `stone`, darker parts
# `bark`, faces and legs `dirt`, a mark or a shirt `accent`, a bag or a cap
# `leaf`. Every model's iterations are logged in docs/ARCHITECT_COURSES.md,
# *Blender iteration log*.
import math, os, sys, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb
V = lambda x, y, z: Vector((x, y, z))
soft = lambda lo, hi: (lambda p, n: lo + (hi - lo) * max(0.0, n.z))


def leg(mesh, rng, top, foot, r, role='dirt'):
    mesh.add_tube([top, foot], [r, r * .8], 5, role, rng, shade=lambda co, t: .8 - .2 * t)


def sheep():
    def build(mesh, rng):
        r = random.Random(1)
        for x in (-.16, .16):
            for y in (-.32, .32):
                leg(mesh, rng, V(x, y, .34), V(x, y, 0), .05)
        # The fleece: a cloud of lumps (iteration 2: lower, on short legs).
        ct.cloud_crown(mesh, r, V(0, .02, .52), (.34, .55, .3), lobes=10, lobe_size=(.45, .6), role='stone', subdiv=1,
                       low=.85, high=1.15, flat_bottom=.3, shell=.7)
        # The face, ears, a woolly cap.
        mesh.add_lump(V(0, -.62, .58), (.12, .16, .14), 'dirt', rng, subdiv=1, jitter=.05, shade=soft(.8, 1.0))
        for x in (-1, 1):
            mesh.add_lump(V(x * .14, -.55, .64), (.08, .03, .04), 'dirt', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, -.56, .72), (.12, .1, .08), 'stone', rng, subdiv=1, jitter=.1, shade=soft(.95, 1.15))
    return build


def goose():
    def build(mesh, rng):
        for x in (-.07, .07):
            leg(mesh, rng, V(x, .02, .2), V(x, .02, 0), .02, 'accent')
        mesh.add_lump(V(0, .06, .32), (.17, .3, .15), 'stone', rng, subdiv=1, jitter=.04, shade=soft(.8, 1.1))
        mesh.add_lump(V(0, .3, .38), (.1, .12, .06), 'bark', rng, subdiv=1, jitter=.05)
        mesh.add_tube([V(0, -.16, .38), V(0, -.24, .58), V(0, -.25, .72)], [.05, .045, .04], 6, 'bark', rng)
        mesh.add_lump(V(0, -.28, .74), (.05, .08, .05), 'bark', rng, subdiv=1, jitter=0)
        # Iteration 8: the white chin strap wider, so it shows from the bank.
        mesh.add_lump(V(0, -.26, .71), (.06, .045, .035), 'accent', rng, subdiv=1, jitter=0)
        mesh.add_tube([V(0, -.34, .74), V(0, -.42, .73)], [.022, .01], 5, 'accent', rng)
    return build


def deer(elk=False):
    def build(mesh, rng):
        s = 1.5 if elk else 1.0
        # Iteration 5: in the game the legs were black sticks at the body's
        # corners and the body a slab, a pale belly plank under it -- a table.
        # Legs inset, stout and coat-coloured to a dark hoof; a full body; no
        # belly.
        for x in (-.09, .09):
            for y in (-.36, .34):
                mesh.add_tube([V(x * s, y * s, .82 * s), V(x * s, y * s, .3 * s), V(x * s, y * s, .02 * s)], [.065 * s, .045 * s, .035 * s], 6,
                              'stone', rng, shade=lambda co, t: .8 - .25 * t)
                mesh.add_lump(V(x * s, y * s, .04 * s), (.04 * s, .05 * s, .04 * s), 'dirt', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, 0, .98 * s), (.25 * s, .56 * s, .3 * s), 'stone', rng, subdiv=1, jitter=.04, shade=soft(.75, 1.05))
        mesh.add_tube([V(0, -.42 * s, 1.05 * s), V(0, -.55 * s, 1.3 * s)], [.12 * s, .08 * s], 6, 'stone', rng)
        mesh.add_lump(V(0, -.64 * s, 1.36 * s), (.08 * s, .17 * s, .09 * s), 'stone', rng, subdiv=1, jitter=.03, shade=soft(.85, 1.05))
        mesh.add_lump(V(0, -.79 * s, 1.33 * s), (.04 * s, .04 * s, .035 * s), 'dirt', rng, subdiv=1, jitter=0)
        for x in (-1, 1):
            mesh.add_lump(V(x * .1 * s, -.58 * s, 1.47 * s), (.07 * s, .025 * s, .1 * s), 'stone', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, .55 * s, 1.02 * s), (.05 * s, .06 * s, .08 * s), 'accent', rng, subdiv=1, jitter=0)
        if elk:
            for x in (-1, 1):
                base = V(x * .08 * s, -.58 * s, 1.48 * s)
                tip = base + V(x * .45, .55, .75)
                mesh.add_tube([base, base + V(x * .2, .2, .4), tip], [.04, .035, .02], 5, 'dirt', rng)
                for t, off in ((.35, V(x * .05, -.25, .25)), (.6, V(x * .1, -.2, .25)), (.85, V(x * .05, -.15, .2))):
                    p = base + (tip - base) * t
                    mesh.add_tube([p, p + off], [.025, .012], 4, 'dirt', rng)
            mesh.add_lump(V(0, -.45 * s, 1.15 * s), (.13 * s, .14 * s, .16 * s), 'bark', rng, subdiv=1, jitter=.08)
    return build


def heron():
    def build(mesh, rng):
        for x in (-.04, .04):
            leg(mesh, rng, V(x, .04, .45), V(x, .04, 0), .015, 'dirt')
        mesh.add_lump(V(0, .06, .55), (.12, .22, .12), 'stone', rng, subdiv=1, jitter=.03, shade=soft(.8, 1.1))
        mesh.add_tube([V(0, -.08, .6), V(0, -.14, .78), V(0, -.08, .9), V(0, -.12, .98)], [.04, .035, .03, .03], 6, 'stone', rng)
        mesh.add_lump(V(0, -.14, 1.0), (.04, .06, .04), 'stone', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, -.12, 1.03), (.045, .03, .015), 'bark', rng, subdiv=1, jitter=0)
        mesh.add_tube([V(0, -.19, 1.0), V(0, -.33, .98)], [.015, .004], 5, 'accent', rng)
        mesh.add_lump(V(0, .3, .5), (.06, .12, .05), 'bark', rng, subdiv=1, jitter=0)
    return build


def roadrunner():
    def build(mesh, rng):
        leg(mesh, rng, V(0, .02, .2), V(0, -.12, 0), .018, 'accent')
        leg(mesh, rng, V(0, .04, .2), V(0, .16, .02), .018, 'accent')
        mesh.add_lump(V(0, 0, .26), (.07, .16, .08), 'stone', rng, subdiv=1, jitter=.05, shade=soft(.75, 1.05))
        mesh.add_tube([V(0, .12, .28), V(0, .42, .38)], [.04, .02], 5, 'bark', rng)
        mesh.add_lump(V(0, -.16, .38), (.05, .07, .05), 'stone', rng, subdiv=1, jitter=.03)
        mesh.add_tube([V(0, -.18, .42), V(0, -.13, .5)], [.03, .006], 4, 'bark', rng)
        mesh.add_tube([V(0, -.22, .38), V(0, -.31, .37)], [.012, .004], 4, 'dirt', rng)
    return build


def bird():
    def build(mesh, rng):
        mesh.add_lump(V(0, 0, .1), (.07, .2, .07), 'stone', rng, subdiv=1, jitter=.02, shade=soft(.85, 1.1))
        mesh.add_lump(V(0, -.2, .12), (.045, .06, .045), 'stone', rng, subdiv=1, jitter=0)
        mesh.add_tube([V(0, -.25, .12), V(0, -.31, .11)], [.014, .004], 4, 'accent', rng)
        for x in (-1, 1):
            pts = [V(0, -.06, .12), V(x * .32, -.02, .17), V(x * .6, .1, .13), V(x * .3, .1, .12), V(0, .08, .11)]
            f = mesh.face(pts if x > 0 else list(reversed(pts)), 'stone')
            g = mesh.face(list(reversed(pts)) if x > 0 else pts, 'stone')
            for v in list(f.verts) + list(g.verts):
                mesh.paint[v] = (1.0, 1.0, 1.0, 0.0)
            tip = [V(x * .5, .08, .135), V(x * .6, .1, .13), V(x * .55, .14, .125)]
            h = mesh.face(tip if x > 0 else list(reversed(tip)), 'bark')
            for v in h.verts:
                mesh.paint[v] = (.8, .8, .8, 0.0)
        tail = [V(-.05, .18, .1), V(.05, .18, .1), V(.07, .3, .1), V(-.07, .3, .1)]
        for pts in (tail, list(reversed(tail))):
            f = mesh.face(pts, 'stone')
            for v in f.verts:
                mesh.paint[v] = (.95, .95, .95, 0.0)
    return build


def person(on_mower=False):
    def build(mesh, rng):
        z0 = .45 if on_mower else 0
        if on_mower:
            # The mower: a deck, a body with a seat, four wheels.
            for x in (-.42, .42):
                for y in (-.5, .5):
                    mesh.add_tube([V(x - .06, y, .18), V(x + .06, y, .18)], [.18, .18], 8, 'dirt', rng)
            mesh.add_lump(V(0, 0, .42), (.42, .7, .2), 'leaf', rng, subdiv=1, jitter=0, shade=soft(.75, 1.1))
            mesh.add_lump(V(0, .22, .65), (.2, .16, .12), 'dirt', rng, subdiv=1, jitter=0)
            mesh.add_tube([V(0, -.4, .55), V(0, -.25, .95)], [.025, .025], 4, 'dirt', rng)
            mesh.add_tube([V(-.18, -.25, .95), V(.18, -.25, .95)], [.025, .025], 4, 'dirt', rng)
            # Seated: thighs forward, shins down.
            for x in (-.09, .09):
                mesh.add_tube([V(x, .15, z0 + .3), V(x, -.12, z0 + .32), V(x, -.18, .3)], [.06, .055, .05], 6, 'bark', rng)
            hip = z0 + .3
        else:
            # Walking: one leg forward, one back.
            for x, swing in ((-.09, .18), (.09, -.18)):
                mesh.add_tube([V(x, 0, .9), V(x, swing * .5, .45), V(x, swing, .05)], [.07, .06, .05], 6, 'bark', rng)
                mesh.add_lump(V(x, swing - .04, .04), (.05, .11, .04), 'dirt', rng, subdiv=1, jitter=0)
            hip = .9
        mesh.add_lump(V(0, 0, hip + .32), (.2, .13, .34), 'accent', rng, subdiv=1, jitter=.02, shade=soft(.8, 1.08))
        for x, swing in ((-1, -.16), (1, .16)):
            mesh.add_tube([V(x * .22, 0, hip + .55), V(x * .25, swing * .6, hip + .3), V(x * .24, swing, hip + .08)],
                          [.05, .045, .04], 5, 'accent', rng)
            mesh.add_lump(V(x * .24, swing, hip + .06), (.04, .04, .04), 'stone', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, 0, hip + .78), (.11, .12, .13), 'stone', rng, subdiv=1, jitter=.02, shade=soft(.85, 1.05))
        mesh.add_lump(V(0, .01, hip + .86), (.12, .13, .07), 'leaf', rng, subdiv=1, jitter=0)
        mesh.add_lump(V(0, -.1, hip + .84), (.08, .07, .015), 'leaf', rng, subdiv=1, jitter=0)
        if not on_mower:
            # The bag on the back, its clubs' heads showing.
            mesh.add_tube([V(.1, .2, hip - .2), V(-.08, .24, hip + .55)], [.1, .1], 7, 'leaf', rng, shade=lambda co, t: .85 + .15 * t)
            for k in range(3):
                mesh.add_tube([V(-.08 + k * .03, .24, hip + .55), V(-.1 + k * .04, .26, hip + .72)], [.015, .015], 4, 'dirt', rng)
    return build


MODELS = [
    ('Blender_Sheep_1', sheep()),
    ('Blender_Goose_1', goose()),
    ('Blender_Deer_1', deer()),
    ('Blender_Elk_1', deer(elk=True)),
    ('Blender_Heron_1', heron()),
    ('Blender_Roadrunner_1', roadrunner()),
    ('Blender_Bird_1', bird()),
    ('Blender_Walker_1', person()),
    ('Blender_Mower_1', person(on_mower=True)),
]

ct.export(MODELS, colours={'stone': (0.92, 0.9, 0.85), 'bark': (0.35, 0.3, 0.26), 'dirt': (0.2, 0.18, 0.17),
                           'accent': (0.85, 0.35, 0.25), 'leaf': (0.25, 0.45, 0.3)}, figure=1.8)
