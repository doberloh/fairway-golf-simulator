# THE CARTOON BRUSH (the cartoon overhaul; the owner's addendum: "a large
# library of brush, bushes ... for each biome", and THICK brush under the
# stands).
#
#   node tools/blender/run.mjs cartoon_brush --render
#
# The shrubs the landscapes lacked, light enough to plant in thousands under
# a stand (lobes of 80 triangles, not 320). From the real plants (RESEARCH,
# *The overhaul's brush*):
#
#   creosote     the desert's commonest shrub: 1.2-3 m, many branches rising
#                and spreading from the ground, small dark olive leaves, an
#                open vase; yellow five-petalled flowers (the accent)
#   brittlebush  a rounded silver-grey mound 0.3-1.5 m, yellow daisies on
#                long stalks above it (the accent)
#   sagebrush    big sagebrush: a silver-grey rounded shrub, field means
#                0.23-0.67 m and up to about 2 m, gnarled stems
#   bracken      fronds 1-2 m, a triangular blade on a stalk, turning russet
#                in autumn (the game paints it per landscape)
#   huckleberry  evergreen huckleberry: a stiff bushy shrub 1.2-4 m in the
#                woods, small glossy dark leaves
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def creosote(height, width, stems):
    def build(mesh, rng):
        H, W = height, width
        c = Vector((0, 0, H * .6))
        shade = ct.crown_shade(c, (W * .5, W * .5, H * .45), low=.55, high=1.2, core=.75)
        for i in range(stems):
            a = i / stems * math.tau + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            tip = out * W * rng.uniform(.3, .48) + Vector((0, 0, H * rng.uniform(.75, 1)))
            pts = fb.sweep_points(out * W * .03, tip, Vector((0, 0, 0)) + out * W * .05, 4, rng=rng, kink=H * .03)
            mesh.add_tube(pts, [H * .016 * (1 - .7 * k / 4) for k in range(5)], 4, 'bark', rng=rng, wobble=.1,
                          shade=lambda co, t: .7 + .3 * t, flex=lambda co, t: .6 * t * t)
            # Small clouds of leaf along the upper stem: the open, airy vase.
            # Round 2: round 1's few big plates on bare sticks read as a
            # houseplant; creosote's leaves are tiny, so many small clumps
            # strung up each stem.
            for k in range(7):
                t = .35 + .65 * k / 6
                p = pts[0].lerp(tip, t) + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * W * .03
                s = W * rng.uniform(.04, .065)
                mesh.add_lump(p, (s, s, s * .8), 'leaf', rng, subdiv=1, jitter=.3, crown=c, blend=.7, shade=shade, flex=.8)
            if rng.random() < .7:
                mesh.add_lump(tip + Vector((0, 0, H * .03)), (W * .025, W * .025, W * .02), 'accent', rng, subdiv=0, flex=.9)
    return build


def brittlebush(height, width):
    def build(mesh, rng):
        H, W = height, width
        c = Vector((0, 0, H * .32))
        rad = (W * .5, W * .5, H * .4)
        # Round 3: more, smaller lobes -- a dozen big ones read as hexagons.
        ct.cloud_crown(mesh, rng, c, rad, lobes=22, lobe_size=(.22, .3), subdiv=1, jitter=.12, flat_bottom=.7,
                       shell=.7, low=.7, high=1.2)
        # Daisies on long bare stalks above the mound.
        for i in range(14):
            a = rng.uniform(0, math.tau)
            r = math.sqrt(rng.random()) * W * .38
            base = Vector((math.cos(a) * r, math.sin(a) * r, H * .45))
            top = base + Vector((0, 0, H * rng.uniform(.35, .55)))
            mesh.add_tube([base, top], [.008, .005], 3, 'leaf', rng=rng, cap_end=False, flex=lambda co, t: t)
            mesh.add_lump(top, (W * .04, W * .04, W * .015), 'accent', rng, subdiv=1, jitter=.05, flex=1.0)
    return build


def sagebrush(height, width):
    def build(mesh, rng):
        H, W = height, width
        for i in range(5):
            a = rng.uniform(0, math.tau)
            end = Vector((math.cos(a) * W * .2, math.sin(a) * W * .2, H * .45))
            ct.limb(mesh, rng, Vector((0, 0, 0)), end, H * .05, H * .025, bow=.2, sides=4, shade=.7)
        c = Vector((0, 0, H * .55))
        ct.cloud_crown(mesh, rng, c, (W * .5, W * .47, H * .45), lobes=24, lobe_size=(.2, .28), subdiv=1, jitter=.2,
                       flat_bottom=.4, shell=.8, low=.6, high=1.2)
    return build


def bracken(height, fronds):
    def build(mesh, rng):
        H = height
        for i in range(fronds):
            a = i * ct.GOLDEN + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-out.y, out.x, 0))
            h = H * rng.uniform(.7, 1)
            stalk_top = out * h * .15 + Vector((0, 0, h * .55))
            mesh.add_tube([Vector((0, 0, 0)), stalk_top], [.012, .008], 3, 'bark', rng=rng, cap_end=False,
                          flex=lambda co, t: .3 * t)
            # The blade: a broad triangle tilting outward, leaflets as a
            # serrated edge either side of the rachis. Round 2: round 1's were
            # thin and sparse; broader leaflets, more of them, each a quad
            # that fills to the rachis, so the frond reads as a blade.
            n = 8
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                p0 = stalk_top + out * h * .55 * t0 + Vector((0, 0, h * .25 * t0 - h * .2 * t0 * t0))
                p1 = stalk_top + out * h * .55 * t1 + Vector((0, 0, h * .25 * t1 - h * .2 * t1 * t1))
                w = h * .42 * (1 - t0) ** .9
                for sgn in (-1, 1):
                    tip = p0.lerp(p1, .7) + side * sgn * w + Vector((0, 0, -w * .2))
                    mid = p0.lerp(tip, .55) + (p1 - p0) * .35
                    mesh.face([p0, p1, tip, mid], 'leaf')
        for v in mesh.bm.verts:
            t = max(0, min(1, v.co.z / H))
            m = .65 + .5 * t
            mesh.paint[v] = (m, m, m, t * t)
    return build


def huckleberry(height, width):
    def build(mesh, rng):
        H, W = height, width
        for i in range(7):
            a = rng.uniform(0, math.tau)
            end = Vector((math.cos(a) * W * .3, math.sin(a) * W * .3, H * rng.uniform(.6, .9)))
            ct.limb(mesh, rng, Vector((0, 0, 0)), end, H * .025, H * .01, bow=.1, sides=4, shade=.75)
        c = Vector((0, 0, H * .58))
        ct.cloud_crown(mesh, rng, c, (W * .5, W * .46, H * .42), lobes=22, lobe_size=(.2, .3), subdiv=1, jitter=.18,
                       flat_bottom=.3, shell=.85, low=.45, high=1.15)
    return build


MODELS = [
    ('Blender_Creosote_1', creosote(1.8, 2.2, 9)),
    ('Blender_Creosote_2', creosote(1.4, 1.8, 7)),
    ('Blender_Brittlebush_1', brittlebush(.8, 1.1)),
    ('Blender_Brittlebush_2', brittlebush(.6, .9)),
    ('Blender_Sagebrush_1', sagebrush(.8, 1.1)),
    ('Blender_Sagebrush_2', sagebrush(.6, .9)),
    ('Blender_Bracken_1', bracken(1.2, 9)),
    ('Blender_Bracken_2', bracken(.9, 7)),
    ('Blender_Huckleberry_1', huckleberry(1.6, 1.8)),
    ('Blender_Huckleberry_2', huckleberry(1.2, 1.4)),
]

ct.export(MODELS, colours={'leaf': (0.36, 0.48, 0.26), 'bark': (0.36, 0.28, 0.22), 'accent': (0.95, 0.8, 0.25)})
