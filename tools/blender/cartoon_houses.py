# THE CARTOON HOUSES (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_houses --render
#
# Fairway homes in one hand, replacing Kenney's building kit. Each model is
# a unit box -- one wide, one deep, one tall -- that homes.js stretches to the
# exact box the generator collides against, so what is drawn is what a ball
# hits. One model per form the generator already chooses (homes.js FORMS:
# gable, hip, saltbox, L-shape), two of each, picked by name.
#
# Roles, each tinted per house in the game: `stone` the walls, `bark` the
# roof, `accent` the trim (eaves, corner boards, window frames), `dirt` the
# glass and the door. Painted darker toward the foot of the walls and under
# the eaves, so a house sits in its own shade.
#
# The look is PLACED, not researched: the low-slung suburban house a golf
# course is lined with, pushed toward a storybook -- deep eaves, a fat
# chimney, big windows -- so it reads at 200 m.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb

WALL = .58     # wall height as a share of the whole house
EAVE = .07     # how far the roof overhangs


def quad(mesh, pts, role, shade, both=False):
    """A face, painted. `both` adds its back, darker: a roof seen from under
    the eaves (round 2 -- single faces vanished from below). A roof slope
    (role `bark` with `both`) is cut into courses of shingles, alternately
    lighter and darker -- round 2's roofs were one flat slab."""
    if role == 'bark' and both:
        a, b = pts[0], pts[1]
        top_b = pts[2]
        top_a = pts[3] if len(pts) == 4 else pts[2]
        n = 6
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            k = .9 if i % 2 else 1.0
            q = [a.lerp(top_a, t0), b.lerp(top_b, t0), b.lerp(top_b, t1), a.lerp(top_a, t1)]
            quad(mesh, q, role, lambda co, k=k: shade(co) * k, both=False)
            g = mesh.face(q[::-1], role)
            for v in g.verts:
                mesh.paint[v] = (*([shade(v.co) * .55] * 3), 0.0)
        return None
    f = mesh.face(pts, role)
    for v in f.verts:
        mesh.paint[v] = (*([shade(v.co)] * 3), 0.0)
    if both:
        g = mesh.face(pts[::-1], role)
        for v in g.verts:
            mesh.paint[v] = (*([shade(v.co) * .55] * 3), 0.0)
    return f


def wall_shade(co):
    # Darker at the foot, a touch darker high up under the eaves.
    t = max(0.0, min(1.0, co.z / WALL))
    return .82 + .25 * t - .08 * max(0.0, t - .85) / .15


def walls(mesh, x0, x1, y0, y1, top):
    c = [Vector((x0, y0, 0)), Vector((x1, y0, 0)), Vector((x1, y1, 0)), Vector((x0, y1, 0))]
    for i in range(4):
        a, b = c[i], c[(i + 1) % 4]
        quad(mesh, [a, b, b + Vector((0, 0, top)), a + Vector((0, 0, top))], 'stone', wall_shade)
        # Round 2: a plinth along the foot and boards up the corners, in the
        # trim colour, so the box reads as built.
        out = (b - a).cross(Vector((0, 0, 1))).normalized() * .004
        quad(mesh, [a + out, b + out, b + out + Vector((0, 0, .05)), a + out + Vector((0, 0, .05))], 'accent', lambda co: .75)
        along = (b - a).normalized() * .025
        quad(mesh, [a + out, a + out + along, a + out + along + Vector((0, 0, top)), a + out + Vector((0, 0, top))],
             'accent', lambda co: .95)


def gable_roof(mesh, x0, x1, y0, y1, base, peak, along_x=True, rear=None):
    """A pitched roof over a rectangle, ridge along x (or y), with gable-end
    triangles in the wall colour. `rear` moves the ridge off centre for a
    saltbox (0.5 is centred)."""
    e = EAVE
    if along_x:
        r = y0 + (y1 - y0) * (rear if rear is not None else .5)
        A, B = Vector((x0 - e, y0 - e, base)), Vector((x1 + e, y0 - e, base))
        C, D = Vector((x1 + e, y1 + e, base)), Vector((x0 - e, y1 + e, base))
        R0, R1 = Vector((x0 - e, r, peak)), Vector((x1 + e, r, peak))
        quad(mesh, [A, B, R1, R0], 'bark', lambda co: .78 + .3 * (co.z - base) / (peak - base), both=True)
        quad(mesh, [C, D, R0, R1], 'bark', lambda co: .7 + .3 * (co.z - base) / (peak - base), both=True)
        for x, sgn in ((x0, -1), (x1, 1)):
            tri = [Vector((x, y0, base)), Vector((x, y1, base)), Vector((x, r, peak - .02))]
            quad(mesh, tri if sgn > 0 else tri[::-1], 'stone', lambda co: .95)
        # Fascia boards along the eaves: the trim that outlines the roof.
        for a, b in ((A, B), (C, D)):
            quad(mesh, [a, b, b + Vector((0, 0, -.03)), a + Vector((0, 0, -.03))], 'accent', lambda co: 1.0)
    else:
        r = x0 + (x1 - x0) * (rear if rear is not None else .5)
        A, B = Vector((x0 - e, y0 - e, base)), Vector((x1 + e, y0 - e, base))
        C, D = Vector((x1 + e, y1 + e, base)), Vector((x0 - e, y1 + e, base))
        R0, R1 = Vector((r, y0 - e, peak)), Vector((r, y1 + e, peak))
        quad(mesh, [D, A, R0, R1], 'bark', lambda co: .78 + .3 * (co.z - base) / (peak - base), both=True)
        quad(mesh, [B, C, R1, R0], 'bark', lambda co: .7 + .3 * (co.z - base) / (peak - base), both=True)
        for y, sgn in ((y0, -1), (y1, 1)):
            tri = [Vector((x0, y, base)), Vector((x1, y, base)), Vector((r, y, peak - .02))]
            quad(mesh, tri[::-1] if sgn > 0 else tri, 'stone', lambda co: .95)


def hip_roof(mesh, x0, x1, y0, y1, base, peak):
    e = EAVE
    A, B = Vector((x0 - e, y0 - e, base)), Vector((x1 + e, y0 - e, base))
    C, D = Vector((x1 + e, y1 + e, base)), Vector((x0 - e, y1 + e, base))
    inset = (y1 - y0) * .5
    R0, R1 = Vector((x0 + inset, (y0 + y1) / 2, peak)), Vector((x1 - inset, (y0 + y1) / 2, peak))
    sh = lambda k: (lambda co: k + .3 * (co.z - base) / (peak - base))
    quad(mesh, [A, B, R1, R0], 'bark', sh(.8), both=True)
    quad(mesh, [C, D, R0, R1], 'bark', sh(.68), both=True)
    quad(mesh, [B, C, R1], 'bark', sh(.74), both=True)
    quad(mesh, [D, A, R0], 'bark', sh(.74), both=True)
    for a, b in ((A, B), (B, C), (C, D), (D, A)):
        quad(mesh, [a, b, b + Vector((0, 0, -.03)), a + Vector((0, 0, -.03))], 'accent', lambda co: 1.0)


def window(mesh, cx, y, z, w, h, front=True):
    """A window on a wall facing -y (front) or +y: dark glass in a white
    frame, a cross of glazing bars, set a hair proud of the wall."""
    s = -1 if front else 1
    d = .004 * s
    fx = w * .14
    frame = [Vector((cx - w / 2 - fx, y + d, z - fx)), Vector((cx + w / 2 + fx, y + d, z - fx)),
             Vector((cx + w / 2 + fx, y + d, z + h + fx)), Vector((cx - w / 2 - fx, y + d, z + h + fx))]
    glass = [Vector((cx - w / 2, y + 2 * d, z)), Vector((cx + w / 2, y + 2 * d, z)),
             Vector((cx + w / 2, y + 2 * d, z + h)), Vector((cx - w / 2, y + 2 * d, z + h))]
    if not front:
        frame, glass = frame[::-1], glass[::-1]
    quad(mesh, frame, 'accent', lambda co: 1.0)
    quad(mesh, glass, 'dirt', lambda co: .7 + .5 * (co.z - z) / h)
    # Round 2: shutters in the roof's colour and a sill -- round 1's walls
    # read flat.
    for sgn in (-1, 1):
        sx = cx + sgn * (w / 2 + fx + w * .2)
        sh = [Vector((sx - w * .17, y + d, z - fx)), Vector((sx + w * .17, y + d, z - fx)),
              Vector((sx + w * .17, y + d, z + h + fx)), Vector((sx - w * .17, y + d, z + h + fx))]
        quad(mesh, sh if front else sh[::-1], 'bark', lambda co: .85)
    sill = [Vector((cx - w / 2 - fx * 2, y + 3 * d, z - fx * 2.2)), Vector((cx + w / 2 + fx * 2, y + 3 * d, z - fx * 2.2)),
            Vector((cx + w / 2 + fx * 2, y + 3 * d, z - fx)), Vector((cx - w / 2 - fx * 2, y + 3 * d, z - fx))]
    quad(mesh, sill if front else sill[::-1], 'accent', lambda co: .92)
    bar = w * .07
    quad(mesh, [Vector((cx - bar / 2, y + 3 * d, z)), Vector((cx + bar / 2, y + 3 * d, z)),
                Vector((cx + bar / 2, y + 3 * d, z + h)), Vector((cx - bar / 2, y + 3 * d, z + h))][::(1 if front else -1)],
         'accent', lambda co: 1.0)


def door(mesh, cx, y, w, h):
    d = -.005
    quad(mesh, [Vector((cx - w / 2 - .02, y + d, 0)), Vector((cx + w / 2 + .02, y + d, 0)),
                Vector((cx + w / 2 + .02, y + d, h + .02)), Vector((cx - w / 2 - .02, y + d, h + .02))], 'accent', lambda co: 1.0)
    quad(mesh, [Vector((cx - w / 2, y + 2 * d, 0)), Vector((cx + w / 2, y + 2 * d, 0)),
                Vector((cx + w / 2, y + 2 * d, h)), Vector((cx - w / 2, y + 2 * d, h))], 'dirt', lambda co: .55)


def chimney(mesh, x, y, base, top, w):
    for (a, b) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
        p = Vector((x + a[0] * w, y + a[1] * w, base)); q = Vector((x + b[0] * w, y + b[1] * w, base))
        quad(mesh, [p, q, q + Vector((0, 0, top - base)), p + Vector((0, 0, top - base))], 'bark', lambda co: .7)
    quad(mesh, [Vector((x - w * 1.2, y - w * 1.2, top)), Vector((x + w * 1.2, y - w * 1.2, top)),
                Vector((x + w * 1.2, y + w * 1.2, top)), Vector((x - w * 1.2, y + w * 1.2, top))], 'accent', lambda co: .9)


def front_windows(mesh, rng, x0, x1, y, n, skip=None):
    for k in range(n):
        cx = x0 + (x1 - x0) * (k + .5) / n
        if skip is not None and abs(cx - skip) < .12:
            continue
        window(mesh, cx, y, WALL * .3, .1, WALL * .38)


def house(form, chimney_at, porch):
    def build(mesh, rng):
        x0, x1, y0, y1 = -.5, .5, -.5, .5
        if form == 'lshape':
            # A main block and a wing forward on one side.
            walls(mesh, x0, x1, 0, y1, WALL)
            walls(mesh, x0, -.05, y0, 0, WALL)
            gable_roof(mesh, x0, x1, 0, y1, WALL, .92)
            gable_roof(mesh, x0, -.05, y0, .05, WALL, .86, along_x=False)
            front_windows(mesh, rng, .0, x1, 0, 3, skip=.25)
            door(mesh, .25, 0, .1, WALL * .7)
            window(mesh, -.275, y0, WALL * .3, .14, WALL * .38)
        else:
            walls(mesh, x0, x1, y0, y1, WALL)
            if form == 'hip':
                hip_roof(mesh, x0, x1, y0, y1, WALL, .95)
            else:
                gable_roof(mesh, x0, x1, y0, y1, WALL, 1.0 if form == 'gable' else .98,
                           rear=.5 if form == 'gable' else .3)
            front_windows(mesh, rng, x0, x1, y0, 4, skip=0.0)
            door(mesh, 0.0, y0, .1, WALL * .7)
            for k in range(3):
                window(mesh, -.3 + .3 * k, y1, WALL * .3, .1, WALL * .38, front=False)
        chimney(mesh, chimney_at, .2, WALL * .8, 1.06, .045)
        if porch:
            # A porch roof on posts over the door.
            px0, px1, py = -.18, .18, (0 if form == 'lshape' else y0)
            cx = .25 if form == 'lshape' else 0
            for x in (cx + px0, cx + px1):
                fb.tube(mesh, [Vector((x, py - .12, 0)), Vector((x, py - .12, WALL * .78))], [.012, .012], 4, 'accent')
            quad(mesh, [Vector((cx + px0 - .03, py - .16, WALL * .78)), Vector((cx + px1 + .03, py - .16, WALL * .78)),
                        Vector((cx + px1 + .03, py, WALL * .9)), Vector((cx + px0 - .03, py, WALL * .9))], 'bark', lambda co: .85)
        for v in mesh.bm.verts:
            if v not in mesh.paint:
                mesh.paint[v] = (1.0, 1.0, 1.0, 0.0)
    return build


MODELS = [
    ('Blender_House_Gable_1', house('gable', .28, True)),
    ('Blender_House_Gable_2', house('gable', -.3, False)),
    ('Blender_House_Hip_1', house('hip', .22, True)),
    ('Blender_House_Hip_2', house('hip', -.25, False)),
    ('Blender_House_Saltbox_1', house('saltbox', .3, False)),
    ('Blender_House_Saltbox_2', house('saltbox', -.28, True)),
    ('Blender_House_Lshape_1', house('lshape', .3, True)),
    ('Blender_House_Lshape_2', house('lshape', .35, False)),
]

ct.export(MODELS, colours={'stone': (0.9, 0.86, 0.76), 'bark': (0.62, 0.32, 0.26), 'accent': (0.97, 0.96, 0.92),
                           'dirt': (0.25, 0.32, 0.42)})
