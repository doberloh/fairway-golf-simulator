# THE CARTOON BROADLEAVES (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/iterate.mjs cartoon_broadleaf <round>
#
# Oak, maple, aspen and alder for every landscape that plants them (Midwest,
# Autumn, Mountain, Pacific Northwest). They replace the Kenney broadleaf
# family, whose cube- and plateau-crowned members were the "cobbled together"
# trees the owner pointed at.
#
# Proportions from the real trees (RESEARCH, *The cartoon overhaul's trees*):
#   oak         a generic eastern oak (white / northern red): a stout trunk
#               forking into heavy ascending limbs, a broad irregular crown
#               about as wide as tall, several heavy masses with gaps
#   sugar maple an egg-shaped crown about 0.65 of the height across, a clear
#               central leader, the densest, finest-edged crown of the four
#   aspen       a long straight pale trunk and a narrow open crown, about a
#               third of the height across, high up, small round clumps
#   red alder   a slender grey trunk, a narrow pointed-oval open crown
#
# ROUNDS (history/CARTOON_OVERHAUL.md, *Rounds*). Round 1: crowns built of separate
# masses -- the oaks came out as flat pancakes on thin stems (acacias, not
# oaks), the aspens and alders as stacked balls (topiary). Round 2: one dome
# per oak over a trunk twice as thick with its limbs showing; one narrow open
# crown per aspen with dark knots on the trunk; one tapering dome per alder;
# more and smaller lobes on the maple. Round 3: the round-2 oaks were
# mushrooms -- a smooth lid of a crown -- so lobe sizes vary more and a few
# stand proud of the top; the aspens' lobes were upright lozenges (a cypress),
# so the shell is lower and the lobes rounder and smaller.
#
# THE SILHOUETTE PASS (2 November 2026; the owner: "big green fluffy balls on
# the trunks"). Logged per species in tools/blender/logs/<id>.md (oak, maple,
# aspen, alder), rounds numbered from 1 for this pack. Each crown is now built
# from parts placed to make its species' outline -- no default ellipsoid
# cloud_crown as a whole crown -- and kept apart from the trees made the same
# day (bur oak flat and ragged, elm vase, beech low dome, Garry oak wider
# than tall, bigleaf maple Y fork, birch splayed white stems).
#
# REFS oak=Blender_Oak_1,Blender_Oak_2,Blender_Oak_3
# REFS maple=Blender_Maple_1,Blender_Maple_2,Blender_Maple_3
# REFS aspen=Blender_Aspen_1,Blender_Aspen_2,Blender_Aspen_3
# REFS alder=Blender_Alder_1,Blender_Alder_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def lump(mesh, rng, p, size, shade, crown, subdiv=3, squash=0.0, flex=0.9):
    """One soft lobe lit with its whole crown (cartoon_pacific's; a far
    twin's lobe an eighth bigger so the far crown does not break apart)."""
    if ct.FAR:
        size = tuple(v * 1.12 for v in size)
    mesh.add_lump(p, size, 'leaf', rng, subdiv=subdiv, jitter=.08, crown=crown, blend=.8, shade=shade, flex=flex,
                  squash_bottom=squash)


def twig(mesh, rng, start, end, r0, r1, sides=4, bow=.1):
    """A thin limb of two segments (ct.limb has five): 16 triangles at four
    sides, so a crown's many short branches do not cost the far twin more
    than its lobes (round 7, the cost pass)."""
    d = end - start
    pts = ct.fb.sweep_points(start, end, Vector((0, 0, d.length * bow)), 2, rng=rng, kink=d.length * .03)
    mesh.add_tube(pts, [r0, (r0 + r1) / 2, r1], sides, 'bark', rng=rng, wobble=.05, cap_end=False,
                  shade=lambda co, t: .85 * (.9 + .15 * t), flex=lambda co, t: .2 + .35 * t)


def mass(mesh, rng, at, s, shade, crown, n=4, up=.25):
    """A heavy leaf mass: one big lobe with n-1 smaller ones round its top and
    shoulders, so it reads as a lobed cushion, not a ball."""
    lump(mesh, rng, at, (s, s, s * .95), shade, crown, squash=.3)
    for k in range(n - 1):
        a = k / (n - 1) * math.tau + rng.uniform(-.5, .5)
        d = Vector((math.cos(a), math.sin(a), 0))
        p = at + d * s * rng.uniform(.55, .75) + Vector((0, 0, s * rng.uniform(.15, up + .3)))
        k2 = s * rng.uniform(.62, .78)
        lump(mesh, rng, p, (k2, k2, k2), shade, crown)


def oak(height, spread, limbs):
    """A white / red oak: a stout trunk forking at a third of the height into
    heavy limbs that climb as they spread, each carrying its own heavy mass;
    the masses at different heights and reaches, so the crown is broad and
    irregular with notches and gaps, about as wide as tall."""
    def build(mesh, rng):
        H = height
        fork = H * rng.uniform(.28, .33)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork + H * .05, H * .062, lean=drift(rng, H * .02),
                              flare=1.8, sides=12, bend=H * .015)
        top = pts[-2]
        c = Vector((top.x, top.y, H * .64))
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .36))
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.35, .35)
            out = Vector((math.cos(a), math.sin(a), 0))
            reach = spread * .5 * rng.uniform(.56, .7)
            z = H * rng.uniform(.42, .58)
            if i == 0:
                # Round 5: one long low limb, the open-grown oak's sweep, so
                # one side of the outline steps down.
                reach, z = spread * .5 * .8, H * .41
            mid = top + out * reach * .45 + Vector((0, 0, (z - top.z) * .45)) + drift(rng, H * .03)
            end = top + out * reach + Vector((0, 0, z - top.z))
            ct.limb(mesh, rng, top, mid, H * .036, H * .024, bow=.06, sides=8)
            ct.limb(mesh, rng, mid, end, H * .024, H * .011, bow=.1, sides=6)
            s = spread * rng.uniform(.16, .19)
            # Round 7: the mass sits higher on its limb, so the limb's end
            # shows under it as in the pictures.
            mass(mesh, rng, end + Vector((0, 0, s * .55)), s, shade, c, n=4)
        # Round 3: the leader's crown -- two big masses over the middle, high
        # and off-centre, so the crown is as tall as wide and its top uneven
        # (round 2's masses on the limb ends alone were flat pads).
        for k in range(2):
            p = c + drift(rng, spread * .14) + Vector((0, 0, H * (.04 + .09 * k)))
            mass(mesh, rng, p, spread * (.17 - .03 * k), shade, c, n=3)
    return build


def maple(height, width):
    """Sugar / red maple: a clear central leader running up into a dense
    upright egg of a crown, widest below its middle, its edge many small even
    lobes -- the finest, smoothest outline of the broadleaves."""
    def build(mesh, rng):
        H, W = height, width
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .78, H * .034, flare=1.6, sides=10,
                              lean=drift(rng, H * .012))
        base, topz = H * .27, H * .98
        c = Vector((pts[-1].x, pts[-1].y, base + (topz - base) * .45))
        shade = ct.crown_shade(c, (W * .5, W * .5, (topz - base) * .5))
        # Two short low limbs showing under the crown.
        for i in range(2):
            a = rng.uniform(0, math.tau)
            st = pts[3]
            twig(mesh, rng, st, st + Vector((math.cos(a) * W * .22, math.sin(a) * W * .22, H * .12)), H * .014,
                 H * .007, sides=6)
        # Fill: three cheap lobes down the inside.
        for k in range(3):
            t = .25 + .25 * k
            z = base + (topz - base) * t
            r = W * .5 * prof(t)
            lump(mesh, rng, Vector((c.x, c.y, z)), (r * .8, r * .8, (topz - base) * .2), shade, c, subdiv=2, flex=.4)
        # The edge: rings of small even lobes on an egg.
        rings = [(.06, 5), (.22, 6), (.4, 7), (.58, 5), (.76, 4), (.92, 2)]  # round 7: 30, for cost
        s = W * .13
        for t, n in rings:
            z = base + (topz - base) * t
            r = W * .5 * prof(t) - s * .55
            off = rng.uniform(0, math.tau)
            for j in range(n):
                a = off + j / n * math.tau + rng.uniform(-.15, .15)
                p = Vector((c.x + math.cos(a) * r, c.y + math.sin(a) * r, z + rng.uniform(-.3, .3)))
                k2 = s * rng.uniform(.92, 1.08)
                lump(mesh, rng, p, (k2, k2, k2 * .95), shade, c, squash=.4 if t < .1 else 0)
        lump(mesh, rng, Vector((c.x, c.y, topz - s * .7)), (s, s, s), shade, c)
    return build


def prof(t):
    """The maple's egg: radius (share of the half width) at height share t of
    the crown, widest at 0.38, rounder at the foot than the top."""
    if t < .38:
        u = (.38 - t) / .38
        return math.sqrt(max(0.0, 1 - (u * .92) ** 2))
    u = (t - .38) / .62
    return math.sqrt(max(0.0, 1 - u ** 2))


def aspen(height, width):
    """Quaking aspen: a long slim white stem, straight; a narrow open crown in
    the top third or so, small round clumps set close along the stem on short
    branches, alternate, sky between them, a small clump on the tip."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .96, H * .017, lean=drift(rng, H * .025),
                              flare=1.3, sides=9, shade_low=.9, shade_high=1.08, bend=H * .01)
        # The aspen's dark "eyes": lens-shaped scars where lower branches fell.
        for k in range(9):
            t = rng.uniform(.15, .6)
            i = int(t * (len(pts) - 1))
            p, r = pts[i], radii[i]
            a = rng.uniform(0, math.tau)
            d = Vector((math.cos(a), math.sin(a), 0))
            mesh.add_lump(p + d * r * .92, (r * .45, r * .45, r * .18), 'accent', rng, subdiv=1, jitter=.05, flex=.05)

        def stem(z):
            t = z / (H * .96)
            i = min(len(pts) - 2, int(t * (len(pts) - 1)))
            f = t * (len(pts) - 1) - i
            return pts[i].lerp(pts[i + 1], f)
        z0, z1 = H * .52, H * .93
        c = stem(H * .77)
        shade = ct.crown_shade(c, (width * .5, width * .5, (z1 - z0) * .5))
        # Round 3: round 2's seven small clumps were peas on a stick; ten,
        # bigger, so the crown is a narrow open column, not a few dots.
        n = 10
        a = rng.uniform(0, math.tau)
        for k in range(n):
            t = k / (n - 1)
            z = z0 + (z1 - z0) * t + rng.uniform(-.2, .2)
            a += math.pi * rng.uniform(.6, .9)
            out = Vector((math.cos(a), math.sin(a), 0))
            r = width * .5 * (.55 + .35 * math.sin(math.pi * min(1, t * 1.3))) * rng.uniform(.8, 1)
            if k % 3 == 1:
                r *= 1.35  # round 4: a clump on a longer branch, so the column is ragged
            s = width * rng.uniform(.2, .24) * (1 - .25 * t)
            st = stem(z - H * .05)
            end = st + out * (r - s * .6) + Vector((0, 0, H * .05))
            twig(mesh, rng, st, end, H * .006, H * .003)
            lump(mesh, rng, end + out * s * .3, (s, s, s * .9), shade, c)
            lump(mesh, rng, end - out * s * .2 + Vector((0, 0, s * .6)), (s * .75, s * .75, s * .7), shade, c)
        tip = stem(H * .96)
        lump(mesh, rng, tip, (width * .13, width * .13, width * .16), shade, c)
    return build


def alder(height, width):
    """Red alder: a slender grey stem through the crown; a narrow pointed
    oval of loose clumps on short ascending limbs, widest a third of the way
    up the crown, gaps between, a narrow pointed top."""
    def build(mesh, rng):
        H, W = height, width
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .93, H * .024, flare=1.5, sides=8,
                              shade_low=.8, shade_high=1.06, lean=drift(rng, H * .02))

        def stem(z):
            t = z / (H * .93)
            i = min(len(pts) - 2, int(t * (len(pts) - 1)))
            f = t * (len(pts) - 1) - i
            return pts[i].lerp(pts[i + 1], f)
        z0, z1 = H * .32, H * .9
        c = stem(H * .6)
        shade = ct.crown_shade(c, (W * .5, W * .5, (z1 - z0) * .5))
        # Round 3: round 2's nine clumps were pads stacked up a pole (a
        # pagoda); eleven, bigger, overlapping into one pointed oval.
        n = 11
        a = rng.uniform(0, math.tau)
        for k in range(n):
            t = k / (n - 1)
            z = z0 + (z1 - z0) * t
            a += ct.GOLDEN + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            # Pointed oval: widest at t 0.4, to a blunt point at the top
            # (round 6: widest at 0.3 made a pear, a conifer's skirt).
            w = .6 + .4 * t / .4 if t < .4 else (1 - t) / .6
            r = W * .5 * max(.3, w) * rng.uniform(.8, 1.05)
            s = W * rng.uniform(.22, .26) * (1 - .4 * t)
            st = stem(z - H * .06)
            end = st + out * (r - s * .45) + Vector((0, 0, H * .06))
            if k % 3 == 0:  # round 7, cost: a branch on every third clump
                twig(mesh, rng, st, end, H * .008, H * .004)
            lump(mesh, rng, end, (s, s, s * .85), shade, c, squash=.3)
            lump(mesh, rng, end - out * s * .5 + Vector((0, 0, s * .5)), (s * .8, s * .8, s * .75), shade, c)
        # The pointed top: two upright lobes.
        tip = stem(z1)
        # Round 4: one blunt top lobe -- two upright ones made a spire (a conifer).
        lump(mesh, rng, tip + Vector((0, 0, H * .02)), (W * .15, W * .15, W * .16), shade, c)
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
    ('Blender_Alder_1', alder(20, 10.5)),
    ('Blender_Alder_2', alder(17, 9)),
]

# THE SHEET'S COLOURS BY SEASON (iterate.mjs --season; the silhouette pass,
# 2 November 2026). These species have no study spec; the colours are
# placed from the reference pictures (photos/models/<id>/, local). Sheet
# only: the game paints the roles from its species tables.
SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'Oak': '#5e554a', 'Maple': '#6a6256', 'Aspen': '#d8d4c2', 'Alder': '#8c8a82'}
# species: {season: leaf}
LOOK = {
    'Oak': {'spring': '#8aaa50', 'summer': '#4a7232', 'autumn': '#8a4426', 'winter': '#4a7232'},
    'Maple': {'spring': '#8cb454', 'summer': '#4f8236', 'autumn': '#c8382a', 'winter': '#4f8236'},
    'Aspen': {'spring': '#a6c860', 'summer': '#6a9a42', 'autumn': '#e2b22e', 'winter': '#6a9a42'},
    'Alder': {'spring': '#8ab456', 'summer': '#4e7a38', 'autumn': '#7a7a3a', 'winter': '#4e7a38'},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        out[name] = {'leaf': hexrgb(LOOK[sp][season]), 'bark': hexrgb(BARK[sp])}
    return out


ct.export(MODELS, colours={'leaf': (0.36, 0.56, 0.22), 'bark': (0.40, 0.31, 0.24), 'accent': (0.2, 0.18, 0.17)}, far=True,
          tints=tints(SEASON))
