# THE CARTOON SHRUBS (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_shrubs --render
#
# Six bushes that were all one Kenney family (`bush`): the generic shrub, gorse,
# heather, beach naupaka, the Pacific Northwest's fern and Haunted Hollow's
# bramble. Each its own plant now (RESEARCH, *The overhaul's shrubs*):
#
#   gorse     an evergreen, much-branched spiny shrub about 2 m tall, dense
#             thickets, yellow flowers (the accent)
#   heather   a low mat, usually under 50 cm, tiny scale leaves, purple
#             flowers on the tops of its shoots (the accent)
#   naupaka   a dense spreading mound about 1 m tall and two to four across,
#             fleshy leaves crowded in rosettes at the stem tips, small white
#             half-flowers (the accent)
#   shrub     a rounded leafy bush
#   fern      arching fronds from a crown, leaflets either side
#   bramble   arching thorny canes, sparse leaves, dark berries (the accent)
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def shrub(h, w):
    def build(mesh, rng):
        for i in range(5):
            a = rng.uniform(0, math.tau)
            ct.limb(mesh, rng, Vector((0, 0, 0)), Vector((math.cos(a) * w * .2, math.sin(a) * w * .2, h * .45)), h * .04, h * .02, sides=5)
        ct.cloud_crown(mesh, rng, Vector((0, 0, h * .5)), (w * .5, w * .48, h * .48), lobes=16, lobe_size=(.32, .44),
                       flat_bottom=.55, shell=.78)
    return build


def gorse(h, w):
    def build(mesh, rng):
        c = Vector((0, 0, h * .5))
        rad = (w * .5, w * .47, h * .5)
        ct.cloud_crown(mesh, rng, c, rad, lobes=24, lobe_size=(.24, .34), subdiv=2, jitter=.22, flat_bottom=.5, shell=.82)
        # Yellow flowers: small bright blobs over the upper half.
        for i in range(70):
            y = rng.uniform(-.1, 1)
            r = math.sqrt(max(0, 1 - y * y))
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * r * rad[0] * 1.02, math.sin(a) * r * rad[1] * 1.02, y * rad[2] * 1.0))
            s = w * rng.uniform(.03, .05)
            mesh.add_lump(p, (s, s, s * .8), 'accent', rng, subdiv=1, jitter=.1, flex=.7)
    return build


# Round 2: heather was a few big blobs; it is a fine mat of many small shoots.
def heather(h, w):
    def build(mesh, rng):
        c = Vector((0, 0, h * .35))
        shade = ct.crown_shade(c, (w * .5, w * .5, h * .5), low=.5, high=1.15)
        mesh.add_lump(Vector((0, 0, h * .25)), (w * .44, w * .44, h * .32), 'leaf', rng, subdiv=2, jitter=.08, crown=c,
                      blend=.7, shade=shade, flex=.3, squash_bottom=.6)
        for i in range(70):
            a, r = rng.uniform(0, math.tau), math.sqrt(rng.random()) * w * .46
            x, y = math.cos(a) * r, math.sin(a) * r
            z = h * .55 * math.sqrt(max(0, 1 - (r / (w * .5)) ** 2)) + h * .12
            s = w * rng.uniform(.05, .08)
            mesh.add_lump(Vector((x, y, z)), (s, s, s * 1.1), 'leaf', rng, subdiv=1, jitter=.2, crown=c, blend=.7, shade=shade, flex=.5)
            if rng.random() < .6:
                mesh.add_lump(Vector((x, y, z + s * .9)), (s * .55, s * .55, s * .6), 'accent', rng, subdiv=1, jitter=.15, flex=.7)
    return build


# Round 2: naupaka read as mushroom trees on long bare stems; it is a dense
# mound branching from the base, so a filled dome carries the rosettes and
# no stem shows.
def naupaka(h, w):
    def build(mesh, rng):
        # Round 3: the core sat low and the rosettes floated over it (a flat
        # pancake); now a full dome whose skin the rosettes sit on.
        c = Vector((0, 0, h * .3))
        rad = (w * .48, w * .46, h * .7)
        shade = ct.crown_shade(c, rad, low=.5, high=1.15)
        mesh.add_lump(c, (rad[0] * .92, rad[1] * .92, rad[2] * .92), 'leaf', rng, subdiv=2,
                      jitter=.08, crown=c, blend=.7, shade=shade, flex=.3, squash_bottom=.9)
        for i in range(40):
            y = rng.uniform(-.05, .95)
            r = math.sqrt(max(0, 1 - y * y))
            a = rng.uniform(0, math.tau)
            tip = c + Vector((math.cos(a) * r * rad[0], math.sin(a) * r * rad[1], y * rad[2]))
            n = 6
            for k in range(n):
                la = k / n * math.tau + rng.uniform(-.2, .2)
                d = Vector((math.cos(la), math.sin(la), .5 + .5 * y)).normalized()
                L = w * rng.uniform(.06, .085)
                mesh.add_lump(tip + d * L * .8, (L, L * .5, L * .28), 'leaf', rng, subdiv=1, jitter=.05, crown=c, blend=.6,
                              shade=shade, flex=.6)
            if rng.random() < .3:
                mesh.add_lump(tip + Vector((0, 0, w * .03)), (w * .022, w * .022, w * .014), 'accent', rng, subdiv=1, flex=.7)
    return build


# Round 2: the fronds were sparse pale triangles; now more fronds, more and
# broader leaflets that overlap, darker at the crown.
def fern(h, w):
    def build(mesh, rng):
        n = 18
        for i in range(n):
            a = i / n * math.tau + rng.uniform(-.2, .2)
            L = w * .5 * rng.uniform(.8, 1.05)
            rise = h * rng.uniform(.8, 1.0)
            out = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-out.y, out.x, 0))
            pts = []
            S = 14
            for s in range(S + 1):
                t = s / S
                pts.append(out * L * t + Vector((0, 0, rise * math.sin(t * math.pi * .62) - rise * .35 * t * t)))
            for s in range(1, S):
                t = s / S
                lw = w * .13 * math.sin(t * math.pi) ** .7 + w * .015
                for sgn in (-1, 1):
                    p0, p1 = pts[s], pts[s + 1]
                    tipp = p0 + side * sgn * lw + (p1 - p0) * 1.2 - Vector((0, 0, lw * .3))
                    for poly in ([p0, p1, tipp], [p0, tipp, p1]):
                        vs = [mesh.bm.verts.new(q) for q in poly]
                        f = mesh.bm.faces.new(vs)
                        f.material_index = mesh.slot('leaf')
                        f.smooth = True
                        for v in vs:
                            tt = max(0.0, min(1.0, v.co.length / L))
                            val = .45 + .6 * tt
                            mesh.paint[v] = (val, val, val, tt)
                            mesh.normal[v] = Vector((0, 0, 1))
    return build


# Round 2: the canes stood up like little trees; a bramble is a tangled
# mound, its canes arching over and down to the ground, with a dark mass of
# leaves inside.
def bramble(h, w):
    def build(mesh, rng):
        # Round 3: the arches stood like poles under umbrella clumps; now lower,
        # leafed along their length, rising out of a bigger dark core.
        c = Vector((0, 0, h * .4))
        mesh.add_lump(c, (w * .44, w * .42, h * .5), 'leaf', rng, subdiv=2, jitter=.2, crown=c, blend=.6,
                      shade=ct.crown_shade(c, (w * .45, w * .45, h * .5), low=.4, high=.9), flex=.3, squash_bottom=.7)
        for i in range(16):
            a = rng.uniform(0, math.tau)
            start = Vector((math.cos(a) * w * .15, math.sin(a) * w * .15, h * .3))
            end = Vector((math.cos(a) * w * rng.uniform(.45, .6), math.sin(a) * w * rng.uniform(.45, .6), 0))
            pts = ct.fb.sweep_points(start, end, Vector((0, 0, h * rng.uniform(.55, .8))), 8, rng=rng, kink=w * .03)
            mesh.add_tube(pts, [h * .018] * len(pts), 5, 'bark', shade=lambda co, t: .7 + .3 * t, flex=lambda co, t: .3 + .5 * t)
            for k in range(1, 8):
                s = w * rng.uniform(.06, .09)
                mesh.add_lump(pts[k] + Vector((0, 0, s * .4)), (s, s, s * .5), 'leaf', rng, subdiv=1, jitter=.2, flex=.6)
                if rng.random() < .5:
                    mesh.add_lump(pts[k] + Vector((rng.uniform(-.1, .1), rng.uniform(-.1, .1), -s * .2)), (w * .02,) * 3,
                                  'accent', rng, subdiv=1, flex=.6)
    return build


MODELS = [
    ('Blender_Shrub_1', shrub(1.6, 2.2)), ('Blender_Shrub_2', shrub(1.3, 1.9)), ('Blender_Shrub_3', shrub(2.0, 2.6)),
    ('Blender_Gorse_1', gorse(1.9, 2.4)), ('Blender_Gorse_2', gorse(1.5, 2.1)), ('Blender_Gorse_3', gorse(2.2, 2.9)),
    ('Blender_Heather_1', heather(.45, 1.8)), ('Blender_Heather_2', heather(.35, 1.4)), ('Blender_Heather_3', heather(.5, 2.2)),
    ('Blender_Naupaka_1', naupaka(1.0, 2.8)), ('Blender_Naupaka_2', naupaka(.8, 2.2)), ('Blender_Naupaka_3', naupaka(1.2, 3.4)),
    ('Blender_Fern_1', fern(.9, 1.6)), ('Blender_Fern_2', fern(.7, 1.3)), ('Blender_Fern_3', fern(1.1, 1.9)),
    ('Blender_Bramble_1', bramble(1.2, 2.4)), ('Blender_Bramble_2', bramble(1.0, 2.0)), ('Blender_Bramble_3', bramble(1.4, 2.8)),
]

ct.export(MODELS, colours={'leaf': (0.3, 0.5, 0.24), 'bark': (0.36, 0.27, 0.22), 'accent': (0.92, 0.78, 0.25)})
