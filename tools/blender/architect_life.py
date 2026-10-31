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
#   walker 1-4   1.75 m: golfers walking (figures.py) -- a bag carried,
#                a push trolley, a pull trolley, a bag and a bucket hat
#   mower        2.3 m: a greenkeeper on a five-unit fairway reel mower
#
# Roles (the game colours each per animal): body `stone`, darker parts
# `bark`, faces and legs `dirt`, a mark or a shirt `accent`, a bag or a cap
# `leaf`. Every model's iterations are logged in docs/ARCHITECT_COURSES.md,
# *Blender iteration log*.
import math, os, sys, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
import figures as fig
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


# THE PEOPLE (the owner's review: more iteration and variety): one body,
# figures.py, in four walkers -- a bag carried on the back, a push trolley, a
# pull trolley, a caddie-style carry with a bucket hat -- each coloured per
# figure by the game.
def walker(kind):
    def build(mesh, rng):
        if kind == 1:
            fig.person(mesh, rng, pose='walk', hat='cap', bag='back')
        elif kind == 2:
            fig.person(mesh, rng, pose='push', hat='visor', skirt=True)
        elif kind == 3:
            fig.person(mesh, rng, pose='pull', hat='none')
        else:
            fig.person(mesh, rng, pose='walk', hat='bucket', bag='back')
    return build


# THE MOWER (the owner's review: "the mower does not look like a mower").
# A five-unit fairway reel mower, from the makers' figures (RESEARCH.md,
# *A fairway mower*): about 2.7 m long, 2.5 m wide cutting, 2.2 m to the top
# of the roll bar; three reel units in front, two between the wheels, big
# front tyres that drive, small rear ones that steer, the seat between them,
# a steering column, an engine hood behind, a roll-over bar. A greenkeeper
# drives it in a hi-vis shirt. Roles: paint `leaf`, the driver's shirt
# `accent`, reels and frames `bark` (as the driver's trousers), tyres,
# seat and bar `dirt`, skin `stone`.
def mower():
    def build(mesh, rng):
        # The chassis: a low body between the wheels, the hood behind the seat.
        mesh.add_lump(V(0, .05, .5), (.46, .92, .16), 'leaf', rng, subdiv=2, jitter=0, shade=soft(.7, 1.1))
        mesh.add_lump(V(0, .72, .86), (.5, .42, .32), 'leaf', rng, subdiv=2, jitter=0, shade=soft(.75, 1.15))
        # Iteration 2: a flat footplate where a blob hid the driver's legs.
        mesh.add_lump(V(0, -.38, .64), (.3, .26, .04), 'dirt', rng, subdiv=1, jitter=0)
        # Wheels: big tyres in front, small ones behind, each with a painted hub.
        # Iteration 8: turf tyres with chunky lugs round the tread and a grey
        # rim inside the painted hub (plain discs read as black plates).
        def tyre(x0, x1, y, z, r, lugs):
            mesh.add_tube([V(x0, y, z), V(x1, y, z)], [r * .93, r * .93], 16, 'dirt', rng)
            for k in range(lugs):
                a = k * 2 * math.pi / lugs
                mesh.add_lump(V((x0 + x1) / 2, y + math.cos(a) * r * .95, z + math.sin(a) * r * .95), (abs(x1 - x0) / 2 + .01, r * .1, r * .1),
                              'dirt', rng, subdiv=1, jitter=0)
            xo = x1 if abs(x1) > abs(x0) else x0
            mesh.add_lump(V(xo, y, z), (.03, r * .62, r * .62), 'bark', rng, subdiv=2, jitter=0)
            mesh.add_lump(V(xo + math.copysign(.02, xo), y, z), (.03, r * .38, r * .38), 'leaf', rng, subdiv=1, jitter=0)
        for x in (-1, 1):
            # Iteration 9: a painted fender over each front tyre.
            arc = [V(x * .65, -.55 + math.cos(a) * .44, .36 + math.sin(a) * .44) for a in [math.pi * (.15 + .7 * k / 6) for k in range(7)]]
            mesh.add_tube(arc, [.13] * 7, 6, 'leaf', rng)
            tyre(x * .52, x * .78, -.55, .36, .36, 14)
            tyre(x * .44, x * .62, .82, .24, .24, 10)
        # The reels: three across the front, two between the wheels behind
        # them, each a grey cylinder with a roller and a painted hood.
        def unit(x, y, w):
            mesh.add_tube([V(x - w / 2, y, .15), V(x + w / 2, y, .15)], [.13, .13], 10, 'bark', rng)
            # Iteration 9: the reel's blades, three dark spirals round it.
            for b in range(3):
                pts = [V(x - w / 2 + w * u, y + math.cos(b * 2.1 + u * 3.0) * .135, .15 + math.sin(b * 2.1 + u * 3.0) * .135) for u in (0, .25, .5, .75, 1)]
                mesh.add_tube(pts, [.018] * 5, 4, 'dirt', rng)
            mesh.add_tube([V(x - w / 2, y + .2, .07), V(x + w / 2, y + .2, .07)], [.06, .06], 8, 'bark', rng)
            mesh.add_lump(V(x, y + .08, .27), (w / 2 + .02, .18, .07), 'leaf', rng, subdiv=1, jitter=0, shade=soft(.8, 1.1))
            mesh.add_tube([V(x, y + .05, .3), V(x * .6, y * .55 - .1, .5)], [.035, .035], 5, 'bark', rng)
        for x in (-.9, 0, .9):
            unit(x, -1.32, .78)
        for x in (-.48, .48):
            unit(x, .2, .74)
        # The seat and the column with its wheel.
        mesh.add_lump(V(0, .3, 1.02), (.26, .22, .08), 'dirt', rng, subdiv=2, jitter=0)
        mesh.add_lump(V(0, .48, 1.3), (.25, .07, .26), 'dirt', rng, subdiv=2, jitter=0)
        mesh.add_tube([V(0, -.42, .7), V(0, -.25, 1.28)], [.04, .035], 6, 'dirt', rng)
        ring = [V(math.cos(a) * .2, -.25 + math.sin(a) * .07, 1.3 + math.sin(a) * .05) for a in [k * math.pi / 6 for k in range(13)]]
        mesh.add_tube(ring, [.022] * len(ring), 5, 'dirt', rng)
        # Iteration 5: a sunshade canopy on the bar, as most fairway mowers
        # carry, and two headlights in the front of the body.
        mesh.add_lump(V(0, .5, 2.32), (.62, .62, .05), 'leaf', rng, subdiv=2, jitter=0, shade=soft(.7, 1.1))
        for x in (-.2, .2):
            mesh.add_lump(V(x, -.92, .58), (.06, .03, .045), 'stone', rng, subdiv=1, jitter=0)
        # The roll-over bar: two posts and a bar over the driver's head.
        mesh.add_tube([V(-.5, .62, .7), V(-.5, .62, 2.15), V(-.38, .62, 2.27), V(.38, .62, 2.27), V(.5, .62, 2.15), V(.5, .62, .7)],
                      [.05] * 6, 8, 'dirt', rng)
        # The greenkeeper, seated, both hands on the wheel.
        fig.person(mesh, rng, pose='seated', hat='cap', at=(0, .28, 0), hip=1.08)
    return build


MODELS = [
    ('Blender_Sheep_1', sheep()),
    ('Blender_Goose_1', goose()),
    ('Blender_Deer_1', deer()),
    ('Blender_Elk_1', deer(elk=True)),
    ('Blender_Heron_1', heron()),
    ('Blender_Roadrunner_1', roadrunner()),
    ('Blender_Bird_1', bird()),
    ('Blender_Walker_1', walker(1)),
    ('Blender_Walker_2', walker(2)),
    ('Blender_Walker_3', walker(3)),
    ('Blender_Walker_4', walker(4)),
    ('Blender_Mower_1', mower()),
]

ct.export(MODELS, colours={'stone': (0.92, 0.9, 0.85), 'bark': (0.35, 0.3, 0.26), 'dirt': (0.2, 0.18, 0.17),
                           'accent': (0.85, 0.35, 0.25), 'leaf': (0.25, 0.45, 0.3)}, figure=1.8)
