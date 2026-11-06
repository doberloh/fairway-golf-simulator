# THE CARTOON LAKESHORE (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/iterate.mjs cartoon_lakeshore <round>
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
#
# REFS cottonwood=Blender_LakeCottonwood_1,Blender_LakeCottonwood_2,Blender_LakeCottonwood_3
# REFS blackoak=Blender_LakeBlackOak_1,Blender_LakeBlackOak_2,Blender_LakeBlackOak_3
# REFS sugarmaple=Blender_LakeSugarMaple_1,Blender_LakeSugarMaple_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def lump(mesh, rng, p, size, shade, crown, subdiv=3, squash=0.0, flex=0.9):
    """One soft lobe lit with its whole crown (the silhouette pass; a far
    twin's lobe an eighth bigger so the far crown does not break apart)."""
    if ct.FAR:
        size = tuple(v * 1.12 for v in size)
    mesh.add_lump(p, size, 'leaf', rng, subdiv=subdiv, jitter=.08, crown=crown, blend=.8, shade=shade, flex=flex,
                  squash_bottom=squash)


def twig(mesh, rng, start, end, r0, r1, sides=6, bow=.1, shade=.8):
    """A limb of two segments (ct.limb has five), so crooked limbs drawn as
    several of them cost no more than one."""
    d = end - start
    pts = fb.sweep_points(start, end, Vector((0, 0, d.length * bow)), 2, rng=rng, kink=d.length * .03)
    mesh.add_tube(pts, [r0, (r0 + r1) / 2, r1], sides, 'bark', rng=rng, wobble=.06, cap_end=False,
                  shade=lambda co, t: shade * (.9 + .15 * t), flex=lambda co, t: .2 + .35 * t)


def mass(mesh, rng, at, s, shade, crown, n=4, rise=.45, squash=.4, tall=.85):
    """A heavy leaf mass: one big lobe, n-1 smaller ones round its top."""
    lump(mesh, rng, at, (s, s, s * tall), shade, crown, squash=squash)
    for k in range(n - 1):
        a = k / max(1, n - 1) * math.tau + rng.uniform(-.5, .5)
        d = Vector((math.cos(a), math.sin(a), 0))
        p = at + d * s * rng.uniform(.55, .8) + Vector((0, 0, s * rng.uniform(.15, rise)))
        k2 = s * rng.uniform(.6, .78)
        lump(mesh, rng, p, (k2, k2, k2 * .9), shade, crown)


def cottonwood(height, limbs):
    """Eastern cottonwood (the silhouette pass): a massive short trunk forking
    low into great limbs that fan out wide and up, each carrying its own big
    coarse mass well apart from the next -- a huge, broad, open crown wider
    than tall, sky and limbs between the masses. (Round 2 of the overhaul:
    a small crown on a big trunk was broccoli; lineup 2 November 2026: the
    clouds sat on a tall bare pole, leaning to one side.)"""
    def build(mesh, rng):
        H = height
        fork = H * rng.uniform(.2, .24)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork, H * .07, lean=drift(rng, H * .02), flare=1.7,
                              sides=11, wobble=.1, shade_low=.7, shade_high=1.0)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .62))
        shade = ct.crown_shade(c, (H * .45, H * .45, H * .3))
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            reach = H * rng.uniform(.3, .4)
            z = H * rng.uniform(.54, .7)  # round 7: a taller crown
            mid = top + out * reach * .45 + Vector((0, 0, (z - top.z) * .55)) + drift(rng, H * .03)
            end = top + out * reach + Vector((0, 0, z - top.z))
            twig(mesh, rng, top, mid, H * .04, H * .028, sides=8, shade=.8)
            twig(mesh, rng, mid, end, H * .028, H * .014, sides=7, shade=.8)
            # A side branch off the elbow to a second, smaller mass: the
            # crown's coarse, broken edge.
            a2 = a + rng.choice((-1, 1)) * rng.uniform(.5, .8)
            # Round 4: the side branch climbs to a second tier, so the crown
            # is a tall broad dome of masses, not one layer of pads.
            side = mid + Vector((math.cos(a2), math.sin(a2), 0)) * reach * .3 + Vector((0, 0, H * .34))
            twig(mesh, rng, mid, side, H * .016, H * .008, sides=5, shade=.8)
            # Round 3: masses a third bigger -- round 2's were clouds on sticks.
            s = H * rng.uniform(.145, .165)
            mass(mesh, rng, end + Vector((0, 0, s * .45)), s, shade, c, n=4, rise=.65)
            lump(mesh, rng, side + Vector((0, 0, s * .3)), (s * .78, s * .78, s * .7), shade, c, squash=.3)
        # The top: one mass over the middle, off-centre.
        mass(mesh, rng, c + drift(rng, H * .08) + Vector((0, 0, H * .22)), H * .15, shade, c, n=4, rise=.6)  # r6: coarser top
    return build


def black_oak(height, width):
    """Black oak on the dunes (the silhouette pass): a crooked trunk that
    leans, three crooked limbs elbowing out, an open irregular crown of a few
    dark masses, lopsided, sky between. (Lineup: a mushroom cap on a straight
    stick.)"""
    def build(mesh, rng):
        H, W = height, width
        lean = drift(rng, 1).normalized() * H * rng.uniform(.08, .12)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .38, H * .05, flare=1.6, sides=10, bend=H * .04,
                              lean=lean, shade_low=.65)
        top = pts[-1]
        lean_dir = Vector((lean.x, lean.y, 0)).normalized()
        c = Vector((top.x, top.y, H * .68)) + lean_dir * W * .08
        shade = ct.crown_shade(c, (W * .5, W * .5, H * .3), low=.42, high=1.1)
        n = 3
        for i in range(n):
            a = math.atan2(lean_dir.y, lean_dir.x) + (i - 1) * rng.uniform(1.6, 2.2) + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            reach = W * .5 * rng.uniform(.55, .8)
            z = H * (.52 + .12 * i) + rng.uniform(-.03, .03) * H  # round 4: stepped, not one table
            elbow = top + out * reach * .35 + Vector((0, 0, (z - top.z) * .7)) + drift(rng, H * .05)
            end = top + out * reach + Vector((0, 0, z - top.z))
            twig(mesh, rng, top, elbow, H * .028, H * .018, sides=7, shade=.75)
            twig(mesh, rng, elbow, end, H * .018, H * .008, sides=5, bow=-.05, shade=.75)
            # Round 3: bigger, rounder masses -- round 2's flat pads were an
            # acacia's.
            s = W * rng.uniform(.19, .23)
            # Round 5: round, not flat-bottomed (stacked pads read as bonsai).
            # Round 6: a fourth lobe on two of the three, so the edge is
            # ragged rather than three balls.
            mass(mesh, rng, end + Vector((0, 0, s * .45)), s, shade, c, n=4 if i < 2 else 3, rise=.6, squash=.1, tall=1.0)
        # A smaller crown top over the lean, and one low side tuft.
        mass(mesh, rng, c + lean_dir * W * .06 + Vector((0, 0, H * .22)), W * .19, shade, c, n=3, rise=.6, squash=.1,
             tall=1.0)
        p = top + Vector((-lean_dir.x, -lean_dir.y, 0)) * W * .3 + Vector((0, 0, H * .2))
        twig(mesh, rng, top - Vector((0, 0, H * .05)), p, H * .012, H * .006, sides=5, shade=.75)
        s = W * .12
        lump(mesh, rng, p + Vector((0, 0, s * .4)), (s, s, s * .75), shade, c, squash=.3)
    return build


def sugar_maple(height, width):
    """Sugar maple on the dunes' edge (the silhouette pass): a short clear
    trunk under a dense broad oval, round-topped, widest at its middle and
    reaching low -- fuller and rounder than the inland maple's upright egg,
    dense where the oak and cottonwood beside it are open."""
    def build(mesh, rng):
        H, W = height, width
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .6, H * .035, flare=1.5, sides=9)
        base, topz = H * .22, H * .98
        c = Vector((pts[-1].x, pts[-1].y, (base + topz) / 2))
        rz = (topz - base) / 2
        shade = ct.crown_shade(c, (W * .5, W * .5, rz))
        lump(mesh, rng, c, (W * .36, W * .36, rz * .7), shade, c, subdiv=2, flex=.4)
        s = W * .17
        rings = [(-.62, 5), (-.05, 5), (.5, 4)]
        for y, n in rings:
            r = math.sqrt(max(0, 1 - y * y))
            off = rng.uniform(0, math.tau)
            for j in range(n):
                a = off + j / n * math.tau + rng.uniform(-.2, .2)
                p = c + Vector((math.cos(a) * (W * .5 * r - s * .55), math.sin(a) * (W * .5 * r - s * .55),
                                y * (rz - s * .5)))
                k2 = s * rng.uniform(.92, 1.08)
                lump(mesh, rng, p, (k2, k2, k2 * .95), shade, c, squash=.4 if y < -.3 else 0)
        lump(mesh, rng, c + Vector((0, 0, rz - s * .7)), (s * 1.1, s * 1.1, s), shade, c)
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
    ('Blender_LakeCottonwood_1', cottonwood(25, 4)),
    ('Blender_LakeCottonwood_2', cottonwood(23, 5)),
    ('Blender_LakeCottonwood_3', cottonwood(27, 4)),
    ('Blender_LakeBlackOak_1', black_oak(17, 15)),
    ('Blender_LakeBlackOak_2', black_oak(15, 14)),
    ('Blender_LakeBlackOak_3', black_oak(19, 16)),
    ('Blender_LakeSugarMaple_1', sugar_maple(22, 16)),
    ('Blender_LakeSugarMaple_2', sugar_maple(20, 15)),
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

# THE SHEET'S COLOURS BY SEASON (iterate.mjs --season; the silhouette pass,
# 2 November 2026), placed from the reference pictures (no study spec for
# these). Sheet only; juniper, dune grass and driftwood keep the pack colours.
SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'LakeCottonwood': '#77706a', 'LakeBlackOak': '#3f3934', 'LakeSugarMaple': '#6a6052'}
LOOK = {
    'LakeCottonwood': {'spring': '#9cbc5a', 'summer': '#5a8a3e', 'autumn': '#d8b43a', 'winter': '#5a8a3e'},
    'LakeBlackOak': {'spring': '#86a250', 'summer': '#3e6230', 'autumn': '#8a4428', 'winter': '#3e6230'},
    'LakeSugarMaple': {'spring': '#90b85a', 'summer': '#4c7e34', 'autumn': '#e2742a', 'winter': '#4c7e34'},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        if sp in LOOK:
            out[name] = {'leaf': hexrgb(LOOK[sp][season]), 'bark': hexrgb(BARK[sp])}
    return out


ct.export(MODELS, colours={'leaf': (0.36, 0.55, 0.24), 'bark': (0.5, 0.46, 0.42), 'accent': (0.8, 0.72, 0.5)},
          tints=tints(SEASON),
          far={'Blender_LakeCottonwood_1', 'Blender_LakeCottonwood_2', 'Blender_LakeCottonwood_3', 'Blender_LakeBlackOak_1',
               'Blender_LakeBlackOak_2', 'Blender_LakeBlackOak_3', 'Blender_LakeSugarMaple_1', 'Blender_LakeSugarMaple_2'})
