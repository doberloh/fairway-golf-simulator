# LAKESHORE DUNES: the models the packs did not have (docs/BLENDER_ASSETS.md).
#
#   node tools/blender/run.mjs lakeshore            -> vendor/blender-lakeshore/*.glb
#   node tools/blender/run.mjs lakeshore --render   -> plus a contact sheet
#
# Built for the tenth biome (RESEARCH.md, *Lakeshore Dunes, the tenth biome*),
# from what grows on a Lake Michigan dune:
#
#   Blender_DuneGrass_*   American beachgrass (marram): a colony patch rather
#                         than one tuft, because the plant spreads by rhizome
#                         and covers a dune face in thousands of stems. Leaves
#                         0.3-0.9 m, green below and straw at the tips in
#                         summer. Wide and low: the game sizes it by its SPREAD.
#   Blender_Cottonwood_*  Eastern cottonwood: 21-30 m, a heavy trunk forking
#                         low into a few big limbs, the crown broad, open and
#                         ragged with sky through it.
#   Blender_BlackOak_*    Black oak, the tree of the older dunes: crooked,
#                         forking low, a wide dense dark crown.
#   Blender_SugarMaple_*  Sugar maple, the northern hardwood behind them: a
#                         straight trunk into a dense egg-shaped crown.
#   Blender_Juniper_*     Creeping juniper mats on the settled crests, and one
#                         common juniper, a low vase of dark blue-green.
#   Blender_Driftwood_*   Bleached logs on the beach, one with its root wad.
#
# Shapes are cartoon -- rounded lumps of foliage, faceted wood -- with real
# proportions, as the owner asked ("cartoon style, but still realistic").
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fairway_blender import Mesh, tube, lump, blade, sweep_points, export_pack, args, tint
from mathutils import Vector


def dune_grass(patch_radius, tussocks, blades, seed_shift=0.0):
    """A colony of beachgrass tussocks spread over a patch of dune.

    Each blade is two faces each way (a quad and a tip triangle, front and
    back: the game's material is single-sided), so a patch of ~190 blades costs
    about 2,700 vertices."""
    def build(mesh, rng):
        centres = []
        for i in range(tussocks):
            # Spread out, denser toward the middle, never two on top of each other.
            for _ in range(30):
                a = rng.uniform(0, math.tau)
                r = patch_radius * math.sqrt(rng.uniform(0, 1)) * 0.92
                c = Vector((math.cos(a) * r, math.sin(a) * r, 0))
                if all((c - o).length > patch_radius * 0.22 for o in centres):
                    break
            centres.append(c)
        per = max(4, blades // tussocks)
        for c in centres:
            # Tussocks in the middle stand a little taller: a patch is a low mound.
            tall = 0.55 + 0.4 * (1 - c.length / patch_radius) + rng.uniform(-0.08, 0.08)
            for k in range(per):
                heading = rng.uniform(0, math.tau)
                root = c + Vector((math.cos(heading), math.sin(heading), 0)) * rng.uniform(0, 0.12)
                h = tall * rng.uniform(0.62, 1.0)
                # Stiff and mostly upright, arching only near the top; the
                # first cut leaned them out like lawn grass gone to seed.
                lean = rng.uniform(0.08, 0.32)
                for flip in (False, True):
                    _blade_two_sided(mesh, root, heading, lean, h,
                                     rng.uniform(0.024, 0.04), flip, rng.uniform(0.42, 0.6))
    return build


def _blade_two_sided(mesh, root, heading, lean, height, width, flip, tip_from):
    out = Vector((math.cos(heading), math.sin(heading), 0))
    side = Vector((-out.y, out.x, 0))
    at = lambda t: root + out * (lean * height * t * t) + Vector((0, 0, height * t))
    a, m, b = at(0), at(tip_from), at(1)
    wm = width * (1 - tip_from)
    low = [a - side * width, a + side * width, m + side * wm, m - side * wm]
    tip = [m - side * wm, m + side * wm, b]
    if flip:
        low, tip = low[::-1], tip[::-1]
    mesh.face(low, 'leaf')
    mesh.face(tip, 'accent')


def cottonwood(height, limbs, lean_seed):
    """Heavy trunk, a low fork into `limbs` big limbs, lumps at their ends."""
    def build(mesh, rng):
        # A cottonwood is heavy at the foot -- a metre or more across in an old
        # tree -- and forks low, a quarter to a third of the way up. The first
        # cut of this used a thin trunk and long straight limbs with the leaves
        # only at their ends, and came out an umbrella pine.
        fork = height * rng.uniform(0.24, 0.31)
        base_r = height * 0.034
        lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized() * height * 0.035
        trunk = sweep_points(Vector((0, 0, -0.3)), Vector((0, 0, fork)) + lean, lean * 0.4, 5, rng, kink=0.08)
        radii = [base_r * (1.4 if i == 0 else 1.0) * (1 - 0.16 * i / 5) for i in range(6)]
        tube(mesh, trunk, radii, 9, 'bark', rng, wobble=0.08, smooth=False, cap_end=False)
        top = trunk[-1]
        crown_w = height * rng.uniform(0.27, 0.32)  # half the crown's spread
        spin = rng.uniform(0, math.tau)
        clusters = []  # (point, size) for every foliage cluster
        for i in range(limbs):
            a = spin + i / limbs * math.tau + rng.uniform(-0.35, 0.35)
            reach = crown_w * rng.uniform(0.62, 0.9)
            rise = height * rng.uniform(0.40, 0.52)
            end = top + Vector((math.cos(a) * reach, math.sin(a) * reach, rise))
            # Ascending limbs that bow outward: the vase of an open-grown tree.
            bow = Vector((math.cos(a), math.sin(a), 0)) * reach * 0.22
            pts = sweep_points(top, end, bow, 4, rng, kink=height * 0.006)
            r0 = base_r * rng.uniform(0.6, 0.72)
            tube(mesh, pts, [r0 * (1 - 0.62 * k / 4) for k in range(5)], 7, 'bark', rng,
                 wobble=0.06, smooth=False)
            clusters.append((end, rng.uniform(0.11, 0.14)))
            # Foliage all the way along the upper half of the limb, not only
            # at its end, so the crown has depth.
            for k in (2, 3):
                clusters.append((pts[k] + Vector((0, 0, height * 0.03)), rng.uniform(0.08, 0.11)))
            # Two or three side branches off each limb, reaching outward and
            # a little down: they fill the crown's lower skirt.
            for j in range(rng.choice((2, 3))):
                s = pts[rng.choice((1, 2, 3))]
                b = a + rng.uniform(-1.2, 1.2)
                bl = crown_w * rng.uniform(0.38, 0.6)
                tip = s + Vector((math.cos(b) * bl, math.sin(b) * bl, height * rng.uniform(-0.02, 0.1)))
                tube(mesh, [s, s.lerp(tip, 0.5) + Vector((0, 0, height * 0.015)), tip],
                     [r0 * 0.42, r0 * 0.3, r0 * 0.16], 5, 'bark', rng, smooth=False)
                clusters.append((tip, rng.uniform(0.08, 0.115)))
        # The leader, so the top of the crown is not hollow.
        crest = top + lean * 0.5 + Vector((0, 0, height * 0.6))
        tube(mesh, [top, top.lerp(crest, 0.5), crest], [base_r * 0.55, base_r * 0.38, base_r * 0.2], 6,
             'bark', rng, smooth=False)
        clusters.append((crest, rng.uniform(0.11, 0.13)))
        clusters.append((top.lerp(crest, 0.7), rng.uniform(0.1, 0.12)))
        for at, frac in clusters:
            # Ragged and open: lumps of very different sizes round each point,
            # with gaps between the clusters for the limbs to show through.
            for _ in range(rng.choice((2, 2, 3))):
                sz = height * frac * rng.uniform(0.75, 1.1)
                off = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.35, 0.7))) * sz * 0.85
                lump(mesh, at + off, (sz, sz * rng.uniform(0.85, 1.15), sz * 0.78), 'leaf', rng,
                     subdiv=2, jitter=0.2)
    return build


def black_oak(height, limbs):
    """Black oak, the tree of the older dunes: shorter than a cottonwood, a
    crooked trunk forking low into wandering limbs, the crown wide, dense and
    dark. On the dunes they grow gnarled rather than tall."""
    def build(mesh, rng):
        fork = height * rng.uniform(0.3, 0.38)
        base_r = height * 0.04
        lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized() * height * 0.05
        trunk = sweep_points(Vector((0, 0, -0.3)), Vector((0, 0, fork)) + lean, lean * 0.6, 5, rng,
                             kink=height * 0.012)
        tube(mesh, trunk, [base_r * (1.35 if i == 0 else 1.0) * (1 - 0.15 * i / 5) for i in range(6)], 8,
             'bark', rng, wobble=0.1, smooth=False, cap_end=False)
        top = trunk[-1]
        crown_w = height * rng.uniform(0.34, 0.4)
        spin = rng.uniform(0, math.tau)
        clusters = []
        for i in range(limbs):
            a = spin + i / limbs * math.tau + rng.uniform(-0.4, 0.4)
            reach = crown_w * rng.uniform(0.6, 0.92)
            rise = height * rng.uniform(0.26, 0.42)
            end = top + Vector((math.cos(a) * reach, math.sin(a) * reach, rise))
            # Crooked: oaks wander where cottonwoods sweep.
            pts = sweep_points(top, end, Vector((0, 0, rise * 0.15)), 5, rng, kink=height * 0.02)
            r0 = base_r * rng.uniform(0.5, 0.62)
            tube(mesh, pts, [r0 * (1 - 0.65 * k / 5) for k in range(6)], 6, 'bark', rng, wobble=0.08,
                 smooth=False)
            clusters += [(end, 0.12), (pts[3] + Vector((0, 0, height * 0.04)), 0.11), (pts[2], 0.09)]
        crest = top + lean * 0.4 + Vector((0, 0, height * 0.55))
        tube(mesh, [top, top.lerp(crest, 0.5), crest], [base_r * 0.5, base_r * 0.33, base_r * 0.18], 6,
             'bark', rng, smooth=False)
        clusters += [(crest, 0.13), (top.lerp(crest, 0.6), 0.12)]
        for at, frac in clusters:
            # Denser than the cottonwood: three lumps a cluster, rounder, so
            # the crown reads as one dark mass with a broken edge.
            for _ in range(3):
                sz = height * frac * rng.uniform(0.8, 1.1)
                off = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 0.5))) * sz * 0.7
                lump(mesh, at + off, (sz, sz, sz * 0.85), 'leaf', rng, subdiv=2, jitter=0.16)
    return build


def sugar_maple(height):
    """Sugar maple, the northern hardwood farther back from the shore: one
    straight trunk running well up into a dense egg-shaped crown."""
    def build(mesh, rng):
        base_r = height * 0.028
        top = Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), height * 0.78))
        trunk = sweep_points(Vector((0, 0, -0.3)), top, Vector((0, 0, 0)), 6, rng, kink=height * 0.004)
        tube(mesh, trunk, [base_r * (1.3 if i == 0 else 1.0) * (1 - 0.7 * i / 6) for i in range(7)], 8, 'bark',
             rng, wobble=0.06, smooth=False)
        # A few limbs out of the trunk into the crown, mostly hidden by it.
        for i in range(5):
            s = trunk[rng.choice((2, 3, 4))]
            a = rng.uniform(0, math.tau)
            tip = s + Vector((math.cos(a) * height * 0.16, math.sin(a) * height * 0.16, height * 0.14))
            tube(mesh, [s, tip], [base_r * 0.45, base_r * 0.18], 5, 'bark', rng, smooth=False)
        # The crown: lumps over an egg, centred two-thirds of the way up.
        centre = Vector((top.x * 0.6, top.y * 0.6, height * 0.62))
        rx, rz = height * 0.24, height * 0.34
        for i in range(30):
            u, v = rng.uniform(0, math.tau), math.acos(rng.uniform(-0.8, 1.0))
            d = Vector((math.cos(u) * math.sin(v) * rx, math.sin(u) * math.sin(v) * rx, math.cos(v) * rz))
            sz = height * rng.uniform(0.09, 0.13)
            lump(mesh, centre + d * rng.uniform(0.62, 0.9), (sz, sz, sz * 0.9), 'leaf', rng, subdiv=2,
                 jitter=0.16)
    return build


def juniper(radius, height, lumps, vase=False):
    def build(mesh, rng):
        for i in range(lumps):
            a = rng.uniform(0, math.tau)
            if vase:
                # Common juniper: stems splay up from one root, foliage in
                # tiers toward the rim, a hollow-ish middle.
                t = rng.uniform(0.25, 1.0)
                r = radius * t * rng.uniform(0.6, 0.95)
                z = height * (0.25 + 0.6 * t)
                sz = radius * rng.uniform(0.22, 0.32)
                lump(mesh, Vector((math.cos(a) * r, math.sin(a) * r, z)), (sz, sz, sz * 0.9), 'leaf', rng,
                     subdiv=1, jitter=0.22)
            else:
                # Creeping juniper: a mat, thickest in the middle, spreading
                # out in low arms.
                # Many small rounded lumps rather than a few flat plates:
                # the plates read as lily pads.
                r = radius * math.sqrt(rng.uniform(0, 1)) * 0.85
                sz = radius * rng.uniform(0.13, 0.22)
                z = height * 0.55 * (1 - r / radius) + sz * 0.3
                lump(mesh, Vector((math.cos(a) * r, math.sin(a) * r, z)), (sz * 1.15, sz, sz * 0.7), 'leaf',
                     rng, subdiv=1, jitter=0.25)
        if vase:
            for i in range(5):
                a = i / 5 * math.tau + rng.uniform(-0.3, 0.3)
                tip = Vector((math.cos(a) * radius * 0.55, math.sin(a) * radius * 0.55, height * 0.6))
                tube(mesh, [Vector((0, 0, -0.05)), tip * 0.5, tip], [0.05, 0.035, 0.02], 4, 'bark', rng,
                     smooth=False)
    return build


def driftwood(length, radius, root_wad, bend_seed):
    def build(mesh, rng):
        half = length / 2
        bend = Vector((0, rng.uniform(-0.12, 0.12) * length, 0))
        pts = sweep_points(Vector((-half, 0, radius)), Vector((half, 0, radius * 0.75)), bend, 6, rng,
                           kink=radius * 0.15)
        radii = [radius * (1.0 - 0.45 * k / 6) for k in range(7)]
        tube(mesh, pts, radii, 7, 'bark', rng, wobble=0.12, smooth=False)
        # A snapped-off branch stub partway along.
        k = rng.choice((2, 3, 4))
        s = pts[k]
        a = rng.uniform(0, math.tau)
        tip = s + Vector((math.cos(a) * radius * 2.5, math.sin(a) * radius * 2.5, radius * 1.6))
        tube(mesh, [s, tip], [radii[k] * 0.45, radii[k] * 0.25], 5, 'bark', rng, smooth=False)
        if root_wad:
            # Roots splay out of the thick end, worn to stubs.
            base = pts[0]
            for i in range(7):
                a = i / 7 * math.tau + rng.uniform(-0.25, 0.25)
                d = Vector((-0.45, math.cos(a), math.sin(a))).normalized()
                end = base + d * radius * rng.uniform(2.2, 3.4)
                end.z = max(end.z, 0.04)
                tube(mesh, [base, base.lerp(end, 0.5), end], [radius * 0.35, radius * 0.22, radius * 0.08], 4,
                     'bark', rng, smooth=False)
    return build


MODELS = [
    ('Blender_DuneGrass_1', dune_grass(2.4, 12, 190)),
    ('Blender_DuneGrass_2', dune_grass(2.0, 10, 160)),
    ('Blender_DuneGrass_3', dune_grass(2.7, 14, 220)),
    ('Blender_Cottonwood_1', cottonwood(25.0, 3, 1)),
    ('Blender_Cottonwood_2', cottonwood(23.0, 4, 2)),
    ('Blender_Cottonwood_3', cottonwood(27.0, 3, 3)),
    ('Blender_BlackOak_1', black_oak(17.0, 5)),
    ('Blender_BlackOak_2', black_oak(15.0, 4)),
    ('Blender_BlackOak_3', black_oak(19.0, 6)),
    ('Blender_SugarMaple_1', sugar_maple(22.0)),
    ('Blender_SugarMaple_2', sugar_maple(20.0)),
    ('Blender_Juniper_1', juniper(1.6, 0.45, 26)),
    ('Blender_Juniper_2', juniper(2.0, 0.5, 34)),
    ('Blender_Juniper_3', juniper(0.8, 1.3, 14, vase=True)),
    ('Blender_Driftwood_1', driftwood(4.2, 0.2, False, 1)),
    ('Blender_Driftwood_2', driftwood(3.0, 0.15, False, 2)),
    ('Blender_Driftwood_3', driftwood(3.6, 0.24, True, 3)),
]

if __name__ == '__main__':
    out, render = args()
    tint('leaf', (0.34, 0.50, 0.20))
    tint('accent', (0.80, 0.71, 0.47))
    tint('bark', (0.55, 0.52, 0.47))
    export_pack(MODELS, out, render)
