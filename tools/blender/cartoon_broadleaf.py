# THE CARTOON BROADLEAVES (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_broadleaf --render
#
# Oak, maple, aspen and alder for every landscape that plants them (Midwest,
# Autumn, Mountain, Pacific Northwest). They replace the Kenney broadleaf
# family, whose cube- and plateau-crowned members were the "cobbled together"
# trees the owner pointed at.
#
# Proportions from the real trees (RESEARCH, *The cartoon overhaul's trees*):
#   bur oak     open-grown crown about as wide as it is tall, a short heavy
#               trunk, big limbs leaving near-horizontal at the crown's base
#   sugar maple an egg-shaped crown about 0.65 of the height across, branches
#               from 8-10 ft up when open-grown
#   aspen       a long straight pale trunk and a narrow rounded crown, about a
#               third of the height across, high up
#   red alder   a narrow dome over a clear, slightly tapered bole in a stand
# Each is then pushed toward a cartoon: fewer, bigger masses, a chunkier
# trunk, a crown that reads as one body.
#
# ROUNDS (CARTOON_OVERHAUL.md, *Rounds*). Round 1: crowns built of separate
# masses -- the oaks came out as flat pancakes on thin stems (acacias, not
# oaks), the aspens and alders as stacked balls (topiary). Round 2: one dome
# per oak over a trunk twice as thick with its limbs showing; one narrow open
# crown per aspen with dark knots on the trunk; one tapering dome per alder;
# more and smaller lobes on the maple. Round 3: the round-2 oaks were
# mushrooms -- a smooth lid of a crown -- so lobe sizes vary more and a few
# stand proud of the top; the aspens' lobes were upright lozenges (a cypress),
# so the shell is lower and the lobes rounder and smaller.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def oak(height, spread, limbs):
    def build(mesh, rng):
        H = height
        fork = H * rng.uniform(0.24, 0.3)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork + H * 0.08, H * 0.06, lean=drift(rng, H * 0.02),
                              flare=1.8, sides=12, bend=H * 0.012)
        top = pts[-2]
        # Heavy limbs leaving low and nearly level, then rising: the bur oak's
        # signature, and what shows under a cartoon dome.
        ends = []
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-0.3, 0.3)
            reach = spread * 0.5 * rng.uniform(0.5, 0.66)
            mid = top + Vector((math.cos(a) * reach * 0.55, math.sin(a) * reach * 0.55, H * 0.06))
            end = top + Vector((math.cos(a) * reach, math.sin(a) * reach, H * rng.uniform(0.2, 0.3)))
            ct.limb(mesh, rng, top, mid, H * 0.032, H * 0.022, bow=0.05, sides=8)
            ct.limb(mesh, rng, mid, end, H * 0.022, H * 0.01, bow=0.15, sides=7)
            ends.append(end)
        # One dome: a broad low crown over the limbs, plus the limb ends as
        # lobes of their own so its edge is lumpy rather than a lid.
        c = Vector((top.x, top.y, H * 0.66))
        ct.cloud_crown(mesh, rng, c, (spread * 0.46, spread * 0.43, H * 0.3), lobes=22, lobe_size=(0.2, 0.42),
                       flat_bottom=0.5, shell=0.84)
        shade = ct.crown_shade(c, (spread * 0.5, spread * 0.47, H * 0.32))
        for e in ends:
            mesh.add_lump(e + Vector((0, 0, H * 0.04)), (spread * 0.14, spread * 0.14, H * 0.11), 'leaf', rng, subdiv=3,
                          jitter=0.08, crown=c, blend=0.8, shade=shade, flex=0.8, squash_bottom=0.4)
        # Round 3: a broken top line -- two or three lobes standing proud of
        # the dome, so the silhouette is an oak's and not a lid's.
        for i in range(rng.randint(2, 3)):
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * spread * 0.18, math.sin(a) * spread * 0.18, H * rng.uniform(0.2, 0.27)))
            s = spread * rng.uniform(0.12, 0.16)
            mesh.add_lump(p, (s, s, s * 0.8), 'leaf', rng, subdiv=3, jitter=0.08, crown=c, blend=0.8, shade=shade, flex=0.9)
    return build


def maple(height, width):
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * 0.45, H * 0.034, flare=1.6, sides=10,
                              lean=drift(rng, H * 0.015))
        top = pts[-1]
        for i in range(5):
            a = i / 5 * math.tau + rng.uniform(-0.4, 0.4)
            start = pts[4]
            end = start + Vector((math.cos(a) * width * 0.28, math.sin(a) * width * 0.28, H * 0.22))
            ct.limb(mesh, rng, start, end, H * 0.015, H * 0.006, bow=0.1)
        c = Vector((top.x, top.y, H * 0.62)) + drift(rng, width * 0.04)
        k = rng.uniform(0.9, 1.1)
        ct.cloud_crown(mesh, rng, c, (width * 0.5 * k, width * 0.5 / k, H * 0.37), lobes=30, lobe_size=(0.24, 0.34),
                       flat_bottom=0.3, shell=0.8)
    return build


def aspen(height, width):
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * 0.94, H * 0.018, lean=drift(rng, H * 0.03),
                              flare=1.3, sides=9, shade_low=0.9, shade_high=1.08, bend=H * 0.012)
        # The aspen's dark "eyes": lens-shaped scars where lower branches fell.
        for k in range(9):
            t = rng.uniform(0.15, 0.65)
            i = int(t * (len(pts) - 1))
            p, r = pts[i], radii[i]
            a = rng.uniform(0, math.tau)
            d = Vector((math.cos(a), math.sin(a), 0))
            mesh.add_lump(p + d * r * 0.92, (r * 0.45, r * 0.45, r * 0.18), 'accent', rng, subdiv=1, jitter=0.05, flex=0.05)
        # A few short limbs into the crown.
        for i in range(4):
            j = int(len(pts) * rng.uniform(0.55, 0.8))
            a = rng.uniform(0, math.tau)
            ct.limb(mesh, rng, pts[j], pts[j] + Vector((math.cos(a) * width * 0.3, math.sin(a) * width * 0.3, H * 0.12)),
                    H * 0.007, H * 0.003, bow=0.1, sides=5)
        # Round 3: rounder, smaller lobes on a less tall shell, so the crown is
        # an open ragged oval rather than a stack of upright lozenges.
        c = Vector((pts[-1].x, pts[-1].y, H * 0.73))
        rz = H * 0.24
        ct.cloud_crown(mesh, rng, c, (width * 0.5, width * 0.46, rz), lobes=26, lobe_size=(0.28, 0.36),
                       flat_bottom=0.2, shell=0.9)
    return build


def alder(height, width):
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * 0.86, H * 0.026, flare=1.5, sides=9,
                              shade_low=0.8, shade_high=1.06, lean=drift(rng, H * 0.02))
        c = Vector((pts[-1].x, pts[-1].y, H * 0.6))
        # A dome that tapers upward: widest a third of the way up the crown.
        ct.cloud_crown(mesh, rng, c, (width * 0.5, width * 0.48, H * 0.34), lobes=24, lobe_size=(0.26, 0.36),
                       flat_bottom=0.35, shell=0.8)
        shade = ct.crown_shade(c, (width * 0.5, width * 0.48, H * 0.34))
        mesh.add_lump(c + Vector((0, 0, H * 0.27)), (width * 0.26, width * 0.26, H * 0.13), 'leaf', rng, subdiv=3,
                      jitter=0.08, crown=c, blend=0.8, shade=shade, flex=0.9)
    return build


MODELS = [
    ('Blender_Oak_1', oak(18, 19, 4)),
    ('Blender_Oak_2', oak(16, 19, 5)),
    ('Blender_Oak_3', oak(20, 18, 4)),
    ('Blender_Maple_1', maple(21, 13.5)),
    ('Blender_Maple_2', maple(18, 12.5)),
    ('Blender_Maple_3', maple(23, 14)),
    ('Blender_Aspen_1', aspen(15, 5.2)),
    ('Blender_Aspen_2', aspen(13, 4.6)),
    ('Blender_Aspen_3', aspen(17, 5.6)),
    ('Blender_Alder_1', alder(20, 8.5)),
    ('Blender_Alder_2', alder(17, 7.5)),
]

ct.export(MODELS, colours={'leaf': (0.36, 0.56, 0.22), 'bark': (0.40, 0.31, 0.24), 'accent': (0.2, 0.18, 0.17)}, far=True)
