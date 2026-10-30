# THE LAND'S STORY (architect-courses, phase 6; the study, workstream L;
# docs/ARCHITECT_COURSES.md).
#
#   node tools/blender/run.mjs architect_story --render
#
# What the land held before the course, in the overhaul's hand. Each model is
# drawn to the footprint story.js gives it (width across the front along X,
# depth along Y with the front at -Y, height up Z, in metres), so the game
# fits it to its solid box without distortion:
#
#   wall section   2 m of dry-stone wall, 1.1 m, coursed stones and a coping
#   hedge section  2 m of hedgerow, 1.6 m
#   standing stone 2 m (the moor's circle; painted white, the Dell's aim)
#   lantern        a post lantern, 2.1 m (Haunted Hollow's paths)
#   barn           11 x 15, 10 m: a gambrel barn, its doors in the gable
#   silo           5 x 5, 15 m
#   windpump       3.2 x 3.2, 11 m: a lattice tower, a fan and a tail
#   ruined chapel  8 x 13, 8 m: roofless, gables, window gaps
#   ruined cottage 8 x 5.5, 5.5 m: roofless, a chimney gable
#   mine head      7 x 7, 13 m: a timber headframe and its wheel
#   sugar mill     7 x 7, 10 m: a round stone tower, broken at the top
#   lighthouse     6 x 6, 22 m: a banded tower, gallery and lamp
#   church         9 x 16, 24 m: a nave and a tower with a spire
#
# Roles: walls and stone `stone`, timber `bark`, roofs `dirt`, trim and
# paint `accent`, glass and lamps `leaf` (the game colours each per piece).
# Every model's iterations are logged in docs/ARCHITECT_COURSES.md, *Blender
# iteration log*.
import math, os, sys, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb
V = lambda x, y, z: Vector((x, y, z))


def block(mesh, x0, x1, y0, y1, z0, z1, role, low=.8, high=1.05, top=None):
    span = max(z1 - z0, 1e-6)
    shade = lambda co: low + (high - low) * max(0.0, min(1.0, (co.z - z0) / span))
    faces = [
        [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)],
        [V(x1, y1, z0), V(x0, y1, z0), V(x0, y1, z1), V(x1, y1, z1)],
        [V(x0, y1, z0), V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1)],
        [V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1)],
        [V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)],
        [V(x0, y1, z0), V(x1, y1, z0), V(x1, y0, z0), V(x0, y0, z0)],
    ]
    for i, pts in enumerate(faces):
        f = mesh.face(pts, role)
        for v in f.verts:
            s = top if (i == 4 and top is not None) else shade(v.co) * (.7 if i == 5 else 1)
            mesh.paint[v] = (s, s, s, 0.0)


def poly(mesh, pts, role, shade=1.0, both=False):
    """A flat face through `pts` (counter-clockwise seen from outside)."""
    f = mesh.face(pts, role)
    for v in f.verts:
        mesh.paint[v] = (shade, shade, shade, 0.0)
    if both:
        g = mesh.face(list(reversed(pts)), role)
        for v in g.verts:
            mesh.paint[v] = (shade * .8, shade * .8, shade * .8, 0.0)


def prism_x(mesh, profile, x0, x1, role, shade=1.0):
    """A profile in (y, z), closed, extruded from x0 to x1: its sides and
    both ends."""
    n = len(profile)
    for i in range(n):
        (ya, za), (yb, zb) = profile[i], profile[(i + 1) % n]
        poly(mesh, [V(x0, ya, za), V(x0, yb, zb), V(x1, yb, zb), V(x1, ya, za)], role, shade)
    poly(mesh, [V(x1, y, z) for y, z in profile], role, shade * .92)
    poly(mesh, [V(x0, y, z) for y, z in reversed(profile)], role, shade * .92)


def prism_y(mesh, profile, y0, y1, role, shade=1.0):
    """A profile in (x, z), closed, extruded from y0 to y1."""
    n = len(profile)
    for i in range(n):
        (xa, za), (xb, zb) = profile[i], profile[(i + 1) % n]
        poly(mesh, [V(xa, y1, za), V(xb, y1, zb), V(xb, y0, zb), V(xa, y0, za)], role, shade)
    poly(mesh, [V(x, y0, z) for x, z in profile], role, shade * .92)
    poly(mesh, [V(x, y1, z) for x, z in reversed(profile)], role, shade * .92)


def stone_course(mesh, rng, y0, y1, z0, z1, half0, half1, role='stone'):
    """One course of a dry-stone wall along Y: blocks of random length, each
    its own shade, the wall's batter from half0 at the foot to half1."""
    y = y0
    while y < y1 - .05:
        l = min(y1 - y, rng.uniform(.28, .6))
        s = .82 + rng.uniform(-.12, .1)
        block(mesh, -half0, half0, y + .015, y + l - .015, z0, z1, role, low=s * .9, high=s)
        y += l


# ------------------------------------------------------------------ small

def wall_stone():
    def build(mesh, rng):
        r = random.Random(7)
        for k, (z0, z1) in enumerate(((0, .34), (.34, .66), (.66, .92))):
            half = .36 - k * .05
            stone_course(mesh, r, -1.0 + (k % 2) * .15, 1.0, z0, z1, half, half)
            if k % 2:
                block(mesh, -half, half, -1.0, -.85, z0, z1, 'stone', low=.8, high=.9)
        # The coping: upright stones on edge, leaning a little.
        y = -1.0
        while y < .95:
            t = r.uniform(.09, .14)
            s = .9 + r.uniform(-.1, .1)
            block(mesh, -.27, .27, y, y + t, .92, 1.1 + r.uniform(-.03, .03), 'stone', low=s * .85, high=s)
            y += t + .015
    return build


def hedge():
    def build(mesh, rng):
        block(mesh, -.42, .42, -1.0, 1.0, 0, 1.2, 'leaf', low=.55, high=.8)
        for k in range(4):
            y = -.75 + k * .5
            mesh.add_lump(V(0, y, 1.1 + rng.uniform(-.05, .08)), (.55, .42, .45), 'leaf', rng, subdiv=1, jitter=.12,
                          shade=lambda p, n: .8 + .3 * max(0.0, n.z))
    return build


def standing_stone():
    def build(mesh, rng):
        ct.hull_rock(mesh, random.Random(3), V(0, 0, 0), (.38, .26, 1.0), points=14, bevel=.06, flat_top=.15,
                     flat_bottom=.3, seat=0, shade_low=.6, shade_high=1.1)
    return build


def lantern():
    def build(mesh, rng):
        block(mesh, -.06, .06, -.06, .06, 0, 1.65, 'bark', low=.5, high=.7)
        block(mesh, -.14, .14, -.14, .14, 1.62, 1.68, 'bark', low=.6, high=.7)
        block(mesh, -.12, .12, -.12, .12, 1.68, 1.95, 'leaf', low=1.1, high=1.2)
        for x in (-.13, .13):
            for y in (-.13, .13):
                block(mesh, x - .018, x + .018, y - .018, y + .018, 1.68, 1.95, 'bark', low=.5, high=.6)
        for i, (a, b) in enumerate(((V(-.16, -.16, 1.95), V(.16, -.16, 1.95)), (V(.16, -.16, 1.95), V(.16, .16, 1.95)),
                                    (V(.16, .16, 1.95), V(-.16, .16, 1.95)), (V(-.16, .16, 1.95), V(-.16, -.16, 1.95)))):
            poly(mesh, [a, b, V(0, 0, 2.12)], 'bark', .7)
    return build


# ------------------------------------------------------------------ farm

def barn():
    def build(mesh, rng):
        # Iteration 2: the gambrel gable is the barn's face, so it fronts -Y
        # with the doors in it; the ridge runs back along Y. 11 x 15, 10 m.
        W, D, H = 5.5, 7.5, 4.6  # half width, half depth, wall height
        block(mesh, -W, W, -D, D, 0, .5, 'stone', low=.6, high=.7)
        block(mesh, -W, W, -D, D, .5, H, 'bark', low=.82, high=1.0)
        prof = [(-W, H), (W, H), (W * .68, H + 3.0), (0, 9.75), (-W * .68, H + 3.0)]
        prism_y(mesh, prof, -D, -D + .01, 'bark', .95)
        prism_y(mesh, prof, D - .01, D, 'bark', .95)
        over = .45
        roof = [(-W - over, H - .25), (-W * .68 - .1, H + 3.1), (0, 10.0), (W * .68 + .1, H + 3.1), (W + over, H - .25)]
        for i in range(4):
            (xa, za), (xb, zb) = roof[i], roof[i + 1]
            poly(mesh, [V(xa, -D - over, za), V(xb, -D - over, zb), V(xb, D + over, zb), V(xa, D + over, za)], 'dirt',
                 .95 - .05 * (i % 2), both=True)
        # White trim along the gable's edge.
        for i in range(4):
            (xa, za), (xb, zb) = roof[i], roof[i + 1]
            dx, dz = xb - xa, zb - za
            l = math.hypot(dx, dz)
            nx, nz = -dz / l * .12, dx / l * .12
            poly(mesh, [V(xa - nx, -D - over - .02, za - nz), V(xb - nx, -D - over - .02, zb - nz), V(xb + nx, -D - over - .02, zb + nz), V(xa + nx, -D - over - .02, za + nz)], 'accent', 1.0)
        # The big doors, white-trimmed crosses, and the hay door above.
        for x0, x1 in ((-2.4, -.05), (.05, 2.4)):
            block(mesh, x0, x1, -D - .08, -D, .5, 3.9, 'bark', low=.7, high=.85)
            for z0, z1 in ((.5, .66), (3.74, 3.9)):
                block(mesh, x0, x1, -D - .14, -D - .08, z0, z1, 'accent', low=1, high=1)
            block(mesh, x0, x0 + .16, -D - .14, -D - .08, .5, 3.9, 'accent', low=1, high=1)
            block(mesh, x1 - .16, x1, -D - .14, -D - .08, .5, 3.9, 'accent', low=1, high=1)
            for (ax, az), (bx, bz) in (((x0, .5), (x1, 3.9)), ((x1, .5), (x0, 3.9))):
                dx, dz = bx - ax, bz - az
                l = math.hypot(dx, dz)
                nx, nz = -dz / l * .08, dx / l * .08
                poly(mesh, [V(ax - nx, -D - .15, az - nz), V(bx - nx, -D - .15, bz - nz), V(bx + nx, -D - .15, bz + nz), V(ax + nx, -D - .15, az + nz)], 'accent', 1.0)
        block(mesh, -1.0, 1.0, -D - .1, -D, 5.4, 7.0, 'bark', low=.6, high=.7)
        for z0, z1 in ((5.3, 5.4), (7.0, 7.1)):
            block(mesh, -1.12, 1.12, -D - .16, -D - .1, z0, z1, 'accent', low=1, high=1)
    return build


def silo():
    def build(mesh, rng):
        mesh.add_tube([V(0, 0, 0), V(0, 0, 13.0)], [2.4, 2.4], 14, 'stone', rng, shade=lambda co, t: .82 + .18 * t)
        # Hoops, and a dome.
        for z in (3.0, 6.0, 9.0, 12.0):
            mesh.add_tube([V(0, 0, z), V(0, 0, z + .18)], [2.47, 2.47], 14, 'accent', rng, shade=lambda co, t: .9)
        mesh.add_lump(V(0, 0, 13.0), (2.45, 2.45, 2.0), 'dirt', rng, subdiv=2, jitter=0, squash_bottom=1.0,
                      shade=lambda p, n: .8 + .3 * max(0.0, n.z))
    return build


def windpump():
    def build(mesh, rng):
        top = 9.2
        # Four legs leaning in, three rings of braces.
        legs = []
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            a, b = V(sx * 1.5, sy * 1.5, 0), V(sx * .35, sy * .35, top)
            legs.append((a, b))
            mesh.add_tube([a, b], [.08, .06], 5, 'stone', rng, shade=lambda co, t: .75 + .2 * t)
        for t in (.3, .6, .88):
            pts = [la + (lb - la) * t for la, lb in legs]
            for i in range(4):
                mesh.add_tube([pts[i], pts[(i + 1) % 4]], [.045, .045], 4, 'stone', rng, shade=lambda co, u: .8)
        block(mesh, -.55, .55, -.55, .55, top, top + .2, 'bark', low=.6, high=.7)
        # The fan facing -Y: a hub and eighteen blades.
        hub = V(0, -.6, top + .9)
        mesh.add_tube([hub + V(0, .7, 0), hub], [.18, .14], 6, 'dirt', rng)
        for k in range(18):
            a = k * 2 * math.pi / 18
            c, s = math.cos(a), math.sin(a)
            r0, r1, w = .35, 1.55, .17
            px, pz = -s, c
            poly(mesh, [hub + V(c * r0 - px * w * .5, 0, s * r0 - pz * w * .5), hub + V(c * r1 - px * w, -.08, s * r1 - pz * w),
                        hub + V(c * r1 + px * w, .08, s * r1 + pz * w), hub + V(c * r0 + px * w * .5, 0, s * r0 + pz * w * .5)], 'accent', 1.0, both=True)
        # The tail vane behind.
        mesh.add_tube([hub + V(0, .7, 0), hub + V(0, 2.2, 0)], [.05, .05], 4, 'dirt', rng)
        poly(mesh, [V(0, 1.6, top + .5), V(0, 2.6, top + .4), V(0, 2.6, top + 1.5), V(0, 1.6, top + 1.2)], 'accent', .95, both=True)
    return build


# ----------------------------------------------------------------- ruins

def ruin_chapel():
    def build(mesh, rng):
        r = random.Random(11)
        W, D, T = 4.0, 6.5, .75  # half width, half depth, wall thickness
        # Side walls in bays, broken to different heights, a window gap in
        # each bay but the ends.
        for x0, x1 in ((-W, -W + T), (W - T, W)):
            for k in range(5):
                y0, y1 = -D + k * 2.6, -D + (k + 1) * 2.6
                h = 4.4 - r.uniform(0, 1.6) * (k % 2)
                s = .85 + r.uniform(-.08, .08)
                if 0 < k < 4:
                    block(mesh, x0, x1, y0, y0 + .7, 0, h, 'stone', low=s * .8, high=s)
                    block(mesh, x0, x1, y1 - .7, y1, 0, h, 'stone', low=s * .8, high=s)
                    block(mesh, x0, x1, y0 + .7, y1 - .7, 0, 1.6, 'stone', low=s * .8, high=s * .95)
                    block(mesh, x0, x1, y0 + .7, y1 - .7, min(h, 3.6), h, 'stone', low=s * .9, high=s)
                else:
                    block(mesh, x0, x1, y0, y1, 0, 4.4, 'stone', low=s * .8, high=s)
        # The gables: the back whole, the front with its doorway, both with a
        # lancet gap.
        # Iteration 4: the back gable broken too (whole, it read through the
        # front as a house end): its apex fallen to a ragged line.
        gable = [(-W, 0), (W, 0), (W, 4.4), (1.8, 6.0), (.6, 5.3), (-.9, 6.4), (-W, 4.4)]
        prism_y(mesh, gable, D - T, D, 'stone', .9)
        for x0, x1 in ((-W, -.8), (.8, W)):
            prism_y(mesh, [(x0, 0), (x1, 0), (x1, 4.4 + (W - abs((x0 + x1) / 2)) * 0), (x0, 4.4)], -D, -D + T, 'stone', .9)
        # Iteration 2: the front gable broken -- its apex fallen, a ragged
        # step on each side, the lancet window over the door open to the sky.
        prism_y(mesh, [(-.8, 2.6), (.8, 2.6), (.8, 3.2), (-.8, 3.2)], -D, -D + T, 'stone', .88)
        prism_y(mesh, [(-W, 4.4), (-.8, 4.4), (-.8, 5.9), (-1.6, 6.2), (-2.6, 5.4)], -D, -D + T, 'stone', .9)
        prism_y(mesh, [(.8, 4.4), (W, 4.4), (2.2, 5.6), (1.4, 5.2), (.8, 5.5)], -D, -D + T, 'stone', .9)
        # Rubble at the foot of the broken bays.
        for k in range(6):
            ct.hull_rock(mesh, r, V(r.choice((-W - .6, W + .6)), r.uniform(-D, D), 0), (.4, .3, .22), points=10,
                         bevel=.05, seat=0, shade_low=.6, shade_high=1.0)
    return build


def ruin_cottage():
    def build(mesh, rng):
        r = random.Random(5)
        W, D, T = 4.0, 2.75, .6
        # The long walls broken low, the end gables standing, one chimney.
        for y0, y1, door in ((-D, -D + T, True), (D - T, D, False)):
            x = -W
            for k in range(4):
                x1 = x + 2.0
                h = 2.6 - r.uniform(0, 1.2) * (k in (1, 2))
                s = .85 + r.uniform(-.08, .08)
                if door and k == 1:
                    block(mesh, x, x + .5, y0, y1, 0, h, 'stone', low=s * .8, high=s)
                    block(mesh, x + 1.5, x1, y0, y1, 0, h, 'stone', low=s * .8, high=s)
                elif k == 2:
                    block(mesh, x, x1, y0, y1, 0, .9, 'stone', low=s * .8, high=s)
                    block(mesh, x, x + .45, y0, y1, .9, h, 'stone', low=s * .8, high=s)
                    block(mesh, x1 - .45, x1, y0, y1, .9, h, 'stone', low=s * .8, high=s)
                else:
                    block(mesh, x, x1, y0, y1, 0, h, 'stone', low=s * .8, high=s)
                x = x1
        gable = [(-D, 0), (D, 0), (D, 2.6), (0, 4.6), (-D, 2.6)]
        prism_x(mesh, gable, W - T, W, 'stone', .9)
        prism_x(mesh, [(-D, 0), (D, 0), (D, 2.6), (0, 3.6), (-D, 2.6)], -W, -W + T, 'stone', .88)
        block(mesh, W - .9, W + .1, -.5, .5, 3.6, 5.5, 'stone', low=.8, high=.95)
        block(mesh, W - 1.0, W + .2, -.6, .6, 5.3, 5.5, 'stone', low=.95, high=1.0)
        for k in range(4):
            ct.hull_rock(mesh, r, V(r.uniform(-W, W), r.choice((-D - .5, D + .5)), 0), (.35, .3, .2), points=10,
                         bevel=.05, seat=0, shade_low=.6, shade_high=1.0)
    return build


def mine_head():
    def build(mesh, rng):
        # The headframe: two legs each side leaning to the sheave, a back
        # brace, cross ties; a winding shed at its foot.
        top = 11.2
        for x in (-1.1, 1.1):
            mesh.add_tube([V(x * 2.2, -2.6, 0), V(x, 0, top)], [.22, .18], 4, 'bark', rng, shade=lambda co, t: .65 + .25 * t)
            mesh.add_tube([V(x * 2.2, 2.6, 0), V(x, 0, top)], [.22, .18], 4, 'bark', rng, shade=lambda co, t: .65 + .25 * t)
            mesh.add_tube([V(x * 1.2, 3.4, 0), V(x, .2, top - 1.0)], [.18, .15], 4, 'bark', rng, shade=lambda co, t: .6 + .2 * t)
        for z, w in ((3.0, 1.9), (6.0, 1.6), (9.0, 1.3)):
            block(mesh, -w, w, -.12 - (top - z) / top * 2.2, .12 - (top - z) / top * 2.2, z, z + .25, 'bark', low=.7, high=.8)
            block(mesh, -w, w, -.12 + (top - z) / top * 2.2, .12 + (top - z) / top * 2.2, z, z + .25, 'bark', low=.7, high=.8)
        block(mesh, -1.5, 1.5, -.5, .5, top, top + .3, 'bark', low=.7, high=.8)
        # The sheave wheel: a ring of short tubes.
        n = 14
        ring = [V(0, math.cos(k * 2 * math.pi / n) * 1.3, top + 1.4 + math.sin(k * 2 * math.pi / n) * 1.3) for k in range(n)]
        for k in range(n):
            mesh.add_tube([ring[k], ring[(k + 1) % n]], [.1, .1], 4, 'dirt', rng, shade=lambda co, t: .8)
        for k in range(0, n, 2):
            mesh.add_tube([V(0, 0, top + 1.4), ring[k]], [.05, .05], 4, 'dirt', rng, shade=lambda co, t: .7)
        block(mesh, -2.0, 2.0, 2.0, 3.5, 0, 2.6, 'bark', low=.6, high=.8)
        prism_x(mesh, [(1.8, 2.6), (3.7, 2.6), (2.75, 3.6)], -2.2, 2.2, 'dirt', .9)
    return build


def sugar_mill():
    def build(mesh, rng):
        mesh.add_tube([V(0, 0, 0), V(0, 0, 4.5), V(0, 0, 9.0)], [3.4, 3.0, 2.6], 14, 'stone', rng,
                      shade=lambda co, t: .78 + .22 * t, cap_end=False)
        mesh.add_tube([V(0, 0, 0), V(0, 0, 9.0)], [2.6, 2.1], 14, 'stone', rng, shade=lambda co, t: .55, cap_end=False)
        r = random.Random(9)
        # A broken crown: merlons of different heights round the top.
        for k in range(10):
            a = k * 2 * math.pi / 10
            if k in (3, 4):
                continue
            c, s = math.cos(a), math.sin(a)
            h = 9.0 + r.uniform(.2, 1.0)
            ct.hull_rock(mesh, r, V(c * 2.4, s * 2.4, 8.7), (.55, .55, (h - 8.7) / 2 + .2), points=10, bevel=.05,
                         seat=0, shade_low=.75, shade_high=1.05)
        # The arched door and two windows, dark.
        block(mesh, -.8, .8, -3.45, -3.2, 0, 2.4, 'dirt', low=.4, high=.45)
        for a, z in ((math.pi * .25, 5.0), (math.pi * .8, 6.2)):
            c, s = math.cos(a), math.sin(a)
            block(mesh, c * 2.95 - .4, c * 2.95 + .4, s * 2.95 - .4, s * 2.95 + .4, z, z + 1.1, 'dirt', low=.4, high=.45)
    return build


# ------------------------------------------------------------- landmarks

def lighthouse():
    def build(mesh, rng):
        bands = [(0, 3.2), (3.2, 6.4), (6.4, 9.6), (9.6, 12.8), (12.8, 16.0)]
        r0, r1 = 2.7, 1.8
        rad = lambda z: r0 + (r1 - r0) * z / 16.0
        block(mesh, -3.0, 3.0, -3.0, 3.0, 0, .6, 'stone', low=.7, high=.8)
        for i, (z0, z1) in enumerate(bands):
            mesh.add_tube([V(0, 0, z0 + .6), V(0, 0, z1 + .6)], [rad(z0), rad(z1)], 14, 'accent' if i % 2 else 'stone', rng,
                          shade=lambda co, t: .85 + .15 * t, cap_end=False)
        top = 16.6
        mesh.add_tube([V(0, 0, top), V(0, 0, top + .3)], [2.4, 2.4], 14, 'dirt', rng)
        mesh.add_tube([V(0, 0, top + .3), V(0, 0, top + 2.6)], [1.3, 1.3], 10, 'leaf', rng, shade=lambda co, t: 1.15)
        for k in range(8):
            a = k * 2 * math.pi / 8
            mesh.add_tube([V(math.cos(a) * 1.32, math.sin(a) * 1.32, top + .3), V(math.cos(a) * 1.32, math.sin(a) * 1.32, top + 2.6)],
                          [.06, .06], 4, 'dirt', rng)
        mesh.add_lump(V(0, 0, top + 2.6), (1.55, 1.55, 1.3), 'dirt', rng, subdiv=1, jitter=0, squash_bottom=1.0)
        mesh.add_tube([V(0, 0, top + 3.8), V(0, 0, top + 5.0)], [.12, .03], 4, 'dirt', rng)
        # The door at the foot.
        block(mesh, -.55, .55, -rad(0) - .05, -rad(0) + .3, .6, 2.6, 'dirt', low=.5, high=.55)
    return build


def church():
    def build(mesh, rng):
        W = 4.5
        # The nave from y -4 to 8, its roof along Y; the tower at the front.
        block(mesh, -W, W, -4, 8, 0, .5, 'stone', low=.6, high=.7)
        block(mesh, -W, W, -4, 8, .5, 6.0, 'stone', low=.82, high=1.0)
        prism_y(mesh, [(-W, 6.0), (W, 6.0), (0, 9.5)], -4, 8, 'stone', .95)
        over = .4
        for sgn in (-1, 1):
            poly(mesh, [V(sgn * (W + over), -4.3, 5.75), V(0, -4.3, 9.7), V(0, 8.3, 9.7), V(sgn * (W + over), 8.3, 5.75)][::(1 if sgn > 0 else -1)],
                 'dirt', .95, both=True)
        # Tall windows down the sides.
        for y in (-1.0, 2.0, 5.0):
            for x in (-W - .05, W - .1):
                block(mesh, x, x + .15, y - .45, y + .45, 2.0, 4.6, 'leaf', low=.9, high=1.0)
        # The tower and spire.
        T = 2.1
        block(mesh, -T, T, -8, -3.8, 0, 12.0, 'stone', low=.8, high=1.0)
        block(mesh, -T - .15, T + .15, -8.15, -3.65, 11.6, 12.0, 'stone', low=1.0, high=1.05)
        for x, y in ((0, -8.05), (0, -3.75), (-T - .05, -5.9), (T + .05, -5.9)):
            block(mesh, x - .4 if abs(x) < 1 else x - .05, x + .4 if abs(x) < 1 else x + .05,
                  y - .05 if abs(x) < 1 else y - .4, y + .05 if abs(x) < 1 else y + .4, 9.2, 10.8, 'dirt', low=.4, high=.45)
        base = [V(-T, -8, 12.0), V(T, -8, 12.0), V(T, -3.8, 12.0), V(-T, -3.8, 12.0)]
        apex = V(0, -5.9, 23.4)
        for i in range(4):
            poly(mesh, [base[i], base[(i + 1) % 4], apex], 'dirt', .9 + .08 * (i % 2))
        mesh.add_tube([apex, apex + V(0, 0, .6)], [.05, .05], 4, 'accent', rng)
        # The door under the tower.
        block(mesh, -.8, .8, -8.1, -7.9, .5, 3.0, 'bark', low=.55, high=.65)
    return build


MODELS = [
    ('Blender_StoryWall_Stone', wall_stone()),
    ('Blender_StoryWall_Hedge', hedge()),
    ('Blender_StandingStone_1', standing_stone()),
    ('Blender_Lantern_1', lantern()),
    ('Blender_Barn', barn()),
    ('Blender_Silo', silo()),
    ('Blender_Windpump', windpump()),
    ('Blender_RuinChapel', ruin_chapel()),
    ('Blender_RuinCottage', ruin_cottage()),
    ('Blender_MineHead', mine_head()),
    ('Blender_SugarMill', sugar_mill()),
    ('Blender_Lighthouse', lighthouse()),
    ('Blender_Church', church()),
]

ct.export(MODELS, colours={'stone': (0.75, 0.72, 0.66), 'bark': (0.62, 0.22, 0.18), 'dirt': (0.3, 0.28, 0.3),
                           'accent': (0.95, 0.94, 0.9), 'leaf': (0.98, 0.85, 0.45)}, figure=1.8)
