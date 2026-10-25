# THE CARTOON CONIFERS (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_conifer --render
#
# Spruce, pine and cedar for Mountain, Pacific Northwest, Autumn and Lakeshore
# Dunes, replacing Kenney's stacked-cone conifer family.
#
# Shapes from the real trees (RESEARCH, *The cartoon overhaul's trees*):
#   Engelmann spruce  narrow conic when young, near-cylindrical when old;
#                     dense to the ground
#   ponderosa pine    wide, irregular, flat-topped crown on old trees, a long
#                     clear trunk; lodgepole narrow in a stand, broader alone
#   western redcedar  drooping branches, a flared foot
# In cartoon form: the spruce a stack of hanging skirts; the pine a trunk
# carrying needle pads that gather into one irregular flat-topped crown; the
# cedar broad, heavily drooping skirts.
#
# ROUNDS. Round 1: the spruces were clip-art Christmas trees -- thin papery
# skirts and an arrowhead tip -- and the pines bonsai, a few small pads on a
# long thin stem. Round 2: fewer, thicker skirts with soft tips and a tapering
# top instead of the arrow; pines with twice the pads, bigger, starting lower,
# merged into one irregular crown on a thicker trunk. Round 3: the pines were
# right; spruce and cedar skirts still ended in star points, and the spruce
# tops showed trunk between tiers like stacked plates -- so each bough ends in
# a rounded scallop and the upper tiers overlap.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def tiers_shade(H, w):
    return ct.crown_shade(Vector((0, 0, H * 0.5)), (w * 0.5, w * 0.5, H * 0.5), low=0.5, high=1.18, core=0.7)


def stack(mesh, rng, H, w, tiers, lean, base, top, points, droop, ragged, power, depth, thick):
    shade = tiers_shade(H, w)
    for i in range(tiers):
        t = i / (tiers - 1)
        z = H * (base + (top - base) * t)
        r = w * 0.5 * (1 - 0.92 * t) ** power * rng.uniform(0.93, 1.07) + H * 0.018
        # Depth falls more slowly than spacing near the top, so the upper
        # tiers overlap and no trunk shows between them (round 3).
        d = H * depth * (1 - 0.3 * t)
        ct.skirt(mesh, rng, Vector((0, 0, z)) + lean * (z / H) ** 2, r, d, points=points + rng.randint(-1, 1),
                 droop=droop, shade=shade, twist=rng.uniform(0, 1), ragged=ragged, flex=0.3 + 0.6 * t, thick=thick)


def spruce(height, width, tiers):
    def build(mesh, rng):
        H, w = height, width
        lean = drift(rng, H * 0.012)
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * 0.9, H * 0.022, lean=lean, flare=1.6, sides=8)
        stack(mesh, rng, H, w, tiers, lean, 0.1, 0.9, 7, 0.4, 0.14, 0.95, 0.2, 0.72)
    return build


def pine(height, width, whorls):
    def build(mesh, rng):
        H, w = height, width
        lean = drift(rng, H * 0.03)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * 0.84, H * 0.032, lean=lean, flare=1.6, sides=9,
                              bend=H * 0.015)
        c = Vector((pts[-1].x, pts[-1].y, H * 0.72))
        rad = (w * 0.5, w * 0.5, H * 0.26)
        shade = ct.crown_shade(c, rad, low=0.48, high=1.2)
        for i in range(whorls):
            t = i / max(1, whorls - 1)
            z = H * (0.48 + 0.4 * t)
            j = min(len(pts) - 1, int(round(z / (H * 0.84) * (len(pts) - 1))))
            base = pts[j]
            n = rng.randint(4, 5)
            for k in range(n):
                a = k / n * math.tau + rng.uniform(-0.45, 0.45) + i * 1.3
                reach = w * 0.5 * (1 - 0.45 * t) * rng.uniform(0.65, 0.95)
                end = base + Vector((math.cos(a) * reach, math.sin(a) * reach, H * rng.uniform(0.03, 0.07)))
                ct.limb(mesh, rng, base, end, H * 0.011, H * 0.005, bow=0.14, sides=5)
                s = w * rng.uniform(0.2, 0.26) * (1 - 0.25 * t)
                mesh.add_lump(end + Vector((0, 0, s * 0.2)), (s, s, s * 0.5), 'leaf', rng, subdiv=3, jitter=0.15,
                              crown=c, blend=0.75, shade=shade, flex=0.8, squash_bottom=0.5)
        # The flat, rounded top: a broad pad over the leader.
        top = pts[-1] + Vector((0, 0, H * 0.04))
        s = w * 0.3
        mesh.add_lump(top, (s, s * 0.9, s * 0.45), 'leaf', rng, subdiv=3, jitter=0.12, crown=c, blend=0.75, shade=shade,
                      flex=0.9, squash_bottom=0.4)
    return build


def cedar(height, width, tiers):
    def build(mesh, rng):
        H, w = height, width
        lean = drift(rng, H * 0.01)
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * 0.88, H * 0.03, lean=lean, flare=2.3, sides=10)
        stack(mesh, rng, H, w, tiers, lean, 0.08, 0.93, 11, 0.6, 0.22, 0.8, 0.19, 0.66)
    return build


MODELS = [
    ('Blender_Spruce_1', spruce(24, 7.6, 9)),
    ('Blender_Spruce_2', spruce(20, 6.8, 8)),
    ('Blender_Spruce_3', spruce(28, 8.2, 10)),
    ('Blender_Pine_1', pine(22, 10, 4)),
    ('Blender_Pine_2', pine(19, 9, 3)),
    ('Blender_Pine_3', pine(25, 11, 4)),
    ('Blender_Cedar_1', cedar(24, 10.5, 8)),
    ('Blender_Cedar_2', cedar(20, 9.5, 7)),
    ('Blender_Cedar_3', cedar(27, 11.5, 9)),
]

ct.export(MODELS, colours={'leaf': (0.2, 0.4, 0.3), 'bark': (0.42, 0.3, 0.22)}, far=True)
