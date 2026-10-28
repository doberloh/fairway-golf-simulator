# THE CARTOON LAKESHORE (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_lakeshore --render
#
# Lakeshore Dunes' plants, which were built in Blender before the overhaul
# (tools/blender/lakeshore.py) in a plainer hand -- no paint, no bent normals.
# Remade in the overhaul's, under names of their own (`Blender_Lake*`) so the
# old pack stays as main has it. The plants are the same (RESEARCH,
# *Lakeshore Dunes*):
#
#   cottonwood   eastern cottonwood: a massive furrowed grey trunk forking
#                into a few great limbs, a broad open crown
#   black oak    a rounded crown on a short trunk, dark leaves
#   sugar maple  a dense oval crown
#   juniper      creeping juniper mats, and common juniper's upright vase
#   dune grass   American beachgrass: a patch of upright tussocks, straw tips
#   driftwood    bleached logs, smooth and twisted, one with its root wad
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def cottonwood(height, limbs):
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .38, H * .055, lean=drift(rng, H * .03), flare=1.7,
                              sides=11, wobble=.1, shade_low=.7, shade_high=1.0)
        top = pts[-1]
        crown_c = Vector((top.x, top.y, H * .7))
        shade = ct.crown_shade(crown_c, (H * .32, H * .32, H * .26))
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.4, .4)
            # Round 2: round 1 was broccoli -- a small crown on a big trunk.
            end = top + Vector((math.cos(a) * H * .24, math.sin(a) * H * .24, H * rng.uniform(.25, .35)))
            ct.limb(mesh, rng, top, end, H * .03, H * .015, bow=.12, sides=8, shade=.8)
            # Each great limb carries its own cloud: the broad, open, lumpy
            # crown of a cottonwood rather than one dome.
            ct.cloud_crown(mesh, rng, end, (H * .22, H * .2, H * .15), lobes=14, lobe_size=(.3, .4), subdiv=2,
                           flat_bottom=.4, shell=.75, low=.5, high=1.15)
        mesh.add_lump(crown_c + Vector((0, 0, H * .1)), (H * .15, H * .15, H * .1), 'leaf', rng, subdiv=2, jitter=.1,
                      crown=crown_c, blend=.8, shade=shade, flex=.8)
    return build


def black_oak(height, width):
    def build(mesh, rng):
        H, W = height, width
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .38, H * .05, flare=1.6, sides=10, bend=H * .02,
                              shade_low=.65)
        top = pts[-1]
        for i in range(4):
            a = i / 4 * math.tau + rng.uniform(-.4, .4)
            ct.limb(mesh, rng, top, top + Vector((math.cos(a) * W * .3, math.sin(a) * W * .3, H * .22)), H * .025, H * .012,
                    bow=.15, sides=7, shade=.75)
        c = Vector((top.x, top.y, H * .66))
        ct.cloud_crown(mesh, rng, c, (W * .5, W * .47, H * .3), lobes=26, lobe_size=(.22, .36), subdiv=2, flat_bottom=.45,
                       shell=.84, low=.42, high=1.1)
    return build


def sugar_maple(height, width):
    def build(mesh, rng):
        H, W = height, width
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .45, H * .035, flare=1.5, sides=9)
        c = Vector((pts[-1].x, pts[-1].y, H * .62))
        ct.cloud_crown(mesh, rng, c, (W * .5, W * .5, H * .38), lobes=28, lobe_size=(.24, .32), subdiv=2, flat_bottom=.3,
                       shell=.8)
    return build


def juniper(radius, height, lumps, vase=False):
    def build(mesh, rng):
        R, H = radius, height
        c = Vector((0, 0, H * .4))
        shade = ct.crown_shade(c, (R, R, H * .6), low=.5, high=1.15)
        if vase:
            ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .3, R * .08, flare=1.3, sides=6)
            for i in range(lumps):
                t = i / lumps
                z = H * (.15 + .8 * t)
                rr = R * (1 - .6 * t) * rng.uniform(.6, 1)
                a = i * ct.GOLDEN
                p = Vector((math.cos(a) * rr * .6, math.sin(a) * rr * .6, z))
                s = R * rng.uniform(.3, .42) * (1 - .4 * t)
                mesh.add_lump(p, (s, s, s * 1.3), 'leaf', rng, subdiv=2, jitter=.15, crown=c, blend=.7, shade=shade, flex=.5)
        else:
            # A creeping mat: overlapping low cushions spreading from a centre.
            for i in range(lumps):
                a = rng.uniform(0, math.tau)
                r = math.sqrt(rng.random()) * R * .85
                p = Vector((math.cos(a) * r, math.sin(a) * r, H * .3 * (1 - r / R)))
                s = R * rng.uniform(.18, .28)
                mesh.add_lump(p, (s * 1.3, s, H * .45), 'leaf', rng, subdiv=2, jitter=.15, crown=c, blend=.6, shade=shade,
                              flex=.4, squash_bottom=.8)
    return build


def dune_grass(radius, tussocks, blades):
    def build(mesh, rng):
        for k in range(tussocks):
            a = rng.uniform(0, math.tau)
            r = math.sqrt(rng.random()) * radius
            c = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            n = blades // tussocks
            # Round 3: round 2's tussocks were celery -- tight bunches on lumps.
            mesh.add_lump(c + Vector((0, 0, .02)), (.12, .12, .05), 'leaf', rng, subdiv=1, jitter=.1, flex=.1, squash_bottom=.8)
            for i in range(n):
                h = rng.uniform(.6, 1.0)
                fb.blade(mesh, c + Vector((rng.uniform(-.08, .08), rng.uniform(-.08, .08), 0)), rng.uniform(0, math.tau),
                         rng.uniform(.3, .75), h, .07, rng, segments=3, tip_from=.6, droop=rng.uniform(.1, .35))
        for v in mesh.bm.verts:
            if v not in mesh.paint:
                t = max(0, min(1, v.co.z))
                m = .62 + .5 * t
                mesh.paint[v] = (m, m, m, t * t)
    return build


def driftwood(length, radius, root_wad):
    def build(mesh, rng):
        L, r = length, radius
        pts = [Vector((-L / 2 + L * k / 7, math.sin(k * .9) * r * .6, r * .8 + math.sin(k * 1.7) * r * .15)) for k in range(8)]
        made = mesh.add_tube(pts, [r * (1.05 - .5 * k / 7) for k in range(8)], 8, 'bark', rng=rng, wobble=.1,
                             shade=lambda co, t: .85 + .2 * t)
        for k in range(rng.randint(1, 2)):
            p = pts[rng.randint(2, 5)]
            d = Vector((rng.uniform(-.3, .3), rng.choice((-1, 1)), rng.uniform(.1, .6))).normalized()
            ct.limb(mesh, rng, p, p + d * r * 4, r * .35, r * .1, bow=.1, sides=5, shade=.9)
        if root_wad:
            base = pts[0]
            for k in range(8):
                ang = k / 8 * math.tau
                d = Vector((-.4, math.cos(ang), math.sin(ang))).normalized()
                ct.limb(mesh, rng, base, base + d * r * rng.uniform(2.5, 4), r * .25, r * .06, bow=.2, sides=4, shade=.85)
    return build


MODELS = [
    ('Blender_LakeCottonwood_1', cottonwood(25, 3)),
    ('Blender_LakeCottonwood_2', cottonwood(23, 4)),
    ('Blender_LakeCottonwood_3', cottonwood(27, 3)),
    ('Blender_LakeBlackOak_1', black_oak(17, 15)),
    ('Blender_LakeBlackOak_2', black_oak(15, 14)),
    ('Blender_LakeBlackOak_3', black_oak(19, 16)),
    ('Blender_LakeSugarMaple_1', sugar_maple(22, 14)),
    ('Blender_LakeSugarMaple_2', sugar_maple(20, 13)),
    ('Blender_LakeJuniper_1', juniper(1.6, .45, 22)),
    ('Blender_LakeJuniper_2', juniper(2.0, .5, 28)),
    ('Blender_LakeJuniper_3', juniper(.8, 1.3, 14, vase=True)),
    ('Blender_LakeDuneGrass_1', dune_grass(1.2, 15, 210)),
    ('Blender_LakeDuneGrass_2', dune_grass(1.0, 12, 170)),
    ('Blender_LakeDuneGrass_3', dune_grass(1.35, 18, 250)),
    ('Blender_LakeDriftwood_1', driftwood(4.2, .2, False)),
    ('Blender_LakeDriftwood_2', driftwood(3.0, .15, False)),
    ('Blender_LakeDriftwood_3', driftwood(3.6, .24, True)),
]

ct.export(MODELS, colours={'leaf': (0.36, 0.55, 0.24), 'bark': (0.5, 0.46, 0.42), 'accent': (0.8, 0.72, 0.5)},
          far={'Blender_LakeCottonwood_1', 'Blender_LakeCottonwood_2', 'Blender_LakeCottonwood_3', 'Blender_LakeBlackOak_1',
               'Blender_LakeBlackOak_2', 'Blender_LakeBlackOak_3', 'Blender_LakeSugarMaple_1', 'Blender_LakeSugarMaple_2'})
