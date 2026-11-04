# TALL FESCUE AND THE PRAIRIE GRASSES (the owner, 3 November 2026: "do we have
# tall fescue and prairie grasses? if not, we should retroactively build them
# for all landscapes that need them"). Long-grass families like
# cartoon_grass.py's (vegetation.js `addLongGrass` plants them in colonies on
# the wild ground; the near-field tall grass uses a landscape's first family's
# first model), from the study's specs (specs-plants.json; RESEARCH.md,
# *Tall fescue and the prairie grasses*):
#
#   tallfescue     the transition zone's rough: coarse light-green tufts of
#                  flat blades, open nodding panicles
#   littlebluestem an upright narrow clump, blue-green, copper-red in autumn,
#                  thin seed stalks above it
#   switchgrass    a tall upright clump under a cloud of airy panicles
#   indiangrass    tall leafy clumps with narrow golden plumes on stems above
#   bluegrama      a low fine tuft with comb-like "eyelash" spikes held out
#                  sideways from the stem tops
#   wheatgrass     western wheatgrass: stiff upright blue-green blades in a
#                  loose sod, narrow wheat-like spikes
#
#   node tools/blender/iterate.mjs cartoon_prairiegrass <round> [--season s]
#
# The blades and the paint are cartoon_grass.py's (copied, as that script
# exports when it is imported): two-sided blades (fb.blade) green at the
# root, the accent role toward the tip and on the heads, normals straight
# up, sway rising toward the tip.
#
# REFS tallfescue=Blender_TallFescue_1,Blender_TallFescue_2
# REFS littlebluestem=Blender_LittleBluestem_1,Blender_LittleBluestem_2
# REFS switchgrass=Blender_Switchgrass_1,Blender_Switchgrass_2
# REFS indiangrass=Blender_Indiangrass_1,Blender_Indiangrass_2
# REFS bluegrama=Blender_BlueGrama_1,Blender_BlueGrama_2
# REFS wheatgrass=Blender_Wheatgrass_1,Blender_Wheatgrass_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb
V = lambda x, y, z: Vector((x, y, z))


def paint_blades(mesh, height, low=.62, high=1.12, flex=1.0):
    """Every vertex painted by its height: dark at the root, bright at the
    tip, and free in the wind toward the tip. Normals straight up."""
    for v in mesh.bm.verts:
        t = max(0.0, min(1.0, v.co.z / max(height, 1e-6)))
        m = low + (high - low) * t
        mesh.paint[v] = (m, m, m, flex * t * t)
        mesh.normal[v] = Vector((0, 0, 1))


def blades(mesh, rng, n, H, lean, width, droop, spread, tip_from, stiff=False, mound=True):
    # Round 2: r01's clumps were see-through (cartoon_grass learned the same:
    # blades too thin and too few); half as wide again and a third more.
    # Round 3: that barely changed the read; twice the blades at the old
    # width -- a fountain of fine blades, as every reference is.
    n, width = int(n * 2), width * 1.0
    # Round 4: every clump was pinched at the root where the references fan
    # out wide: a broader root and more outward lean.
    spread, lean = spread * 1.7, lean * 1.25
    if mound:
        mesh.add_lump(Vector((0, 0, H * .05)), (spread * 1.1 + H * .04, spread * 1.1 + H * .04, H * .12), 'leaf', rng,
                      subdiv=1, jitter=.06, flex=.2, squash_bottom=.8)
    for i in range(n):
        a = i * ct.GOLDEN + rng.uniform(-.3, .3)
        r = spread * math.sqrt(rng.random())
        root = Vector((math.cos(a) * r, math.sin(a) * r, 0))
        h = H * rng.uniform(.6, 1.0)
        fb.blade(mesh, root, a + rng.uniform(-.4, .4), lean * rng.uniform(.6, 1.3) * (.7 if stiff else 1), h,
                 width * rng.uniform(.8, 1.2), rng, segments=3, tip_from=tip_from, droop=droop * rng.uniform(.5, 1.2))


def stalk(mesh, rng, root, a, h, lean, width):
    """A bare stem from `root`, leaning out along `a`; returns its top."""
    fb.blade(mesh, root, a, lean, h * .95, width, rng, segments=2, tip_from=1.1, droop=0)
    return root + Vector((math.cos(a) * h * lean * .6, math.sin(a) * h * lean * .6, h))


def tallfescue(height, n, heads):
    """Coarse tufts of flat light-green blades (wide, arching) and open
    panicles nodding on stems above them."""
    def build(mesh, rng):
        H = height
        blades(mesh, rng, n, H, .95, .03, .75, .14, .9)
        for k in range(heads):
            a = rng.uniform(0, math.tau)
            top = stalk(mesh, rng, Vector((math.cos(a) * .06, math.sin(a) * .06, 0)), a, H * rng.uniform(1.5, 1.9), .12, .008)
            # The panicle: a few short branches hanging off the top.
            for j in range(4):
                b = a + rng.uniform(-.9, .9)
                tip = top + Vector((math.cos(b) * H * .08, math.sin(b) * H * .08, -H * rng.uniform(.04, .12)))
                mesh.add_tube([top - Vector((0, 0, H * .05 * j)), tip], [.008, .003], 3, 'accent', rng=rng, cap_end=False)
        paint_blades(mesh, H * 1.8 if heads else H)
    return build


def littlebluestem(height, n, stalks):
    """An upright narrow clump of fine blades, wider at the top than the
    root, with thin seed stalks standing out of it."""
    def build(mesh, rng):
        H = height
        # Round 10: no mound (it read as a dark block under the blades).
        blades(mesh, rng, n, H, .28, .02, .1, .08, .55, stiff=True, mound=False)
        for k in range(stalks):
            a = rng.uniform(0, math.tau)
            root = Vector((math.cos(a) * .04, math.sin(a) * .04, 0))
            top = stalk(mesh, rng, root, a, H * rng.uniform(1.3, 1.6), .18, .01)
            mesh.add_lump(top - Vector((0, 0, H * .04)), (.012, .012, H * .05), 'accent', rng, subdiv=0, jitter=.2, flex=1.0)
        paint_blades(mesh, H * 1.5)
    return build


def switchgrass(height, n, panicles):
    """A tall upright clump of long blades under a cloud of airy panicles:
    many thin stems, each ending in a sparse spray (accent)."""
    def build(mesh, rng):
        H = height
        blades(mesh, rng, n, H * .75, .35, .03, .2, .12, .7)
        for k in range(panicles):
            a = rng.uniform(0, math.tau)
            root = Vector((math.cos(a) * .08, math.sin(a) * .08, 0))
            top = stalk(mesh, rng, root, a, H * rng.uniform(.9, 1.1), .16, .01)
            # Round 6: an airy cloud along the stem's top third, not a star.
            for j in range(14):
                b = rng.uniform(0, math.tau)
                at = top - Vector((0, 0, H * .3 * rng.random()))
                tip = at + Vector((math.cos(b) * H * .07, math.sin(b) * H * .07, H * rng.uniform(.02, .08)))
                mesh.add_tube([at, tip], [.005, .0015], 3, 'accent', rng=rng, cap_end=False)
        paint_blades(mesh, H * 1.1)
    return build


def indiangrass(height, n, plumes):
    """Tall leafy clumps of broad blades with stems standing well above,
    each topped by a narrow, dense golden plume (accent)."""
    def build(mesh, rng):
        H = height
        blades(mesh, rng, n, H * .6, .45, .035, .3, .12, .8)
        for k in range(plumes):
            a = rng.uniform(0, math.tau)
            root = Vector((math.cos(a) * .06, math.sin(a) * .06, 0))
            top = stalk(mesh, rng, root, a, H * rng.uniform(.85, 1.0), .1, .01)
            mesh.add_lump(top - Vector((0, 0, H * .12)), (.016, .016, H * .14), 'accent', rng, subdiv=1, jitter=.12,
                          flex=1.0)
        paint_blades(mesh, H)
    return build


def bluegrama(height, n, combs):
    """A low tuft of fine curling grey-green blades with stems above it,
    each holding one or two comb spikes out sideways, curved like an
    eyelash (accent)."""
    def build(mesh, rng):
        H = height
        blades(mesh, rng, n, H * .55, .9, .012, .6, .07, .5)
        for k in range(combs):
            a = rng.uniform(0, math.tau)
            root = Vector((math.cos(a) * .03, math.sin(a) * .03, 0))
            top = stalk(mesh, rng, root, a, H * rng.uniform(.85, 1.0), .15, .006)
            for j in range(1 + (k % 2)):
                b = a + (j - .5) * 1.2
                d = Vector((math.cos(b), math.sin(b), 0))
                # Round 12: curled outward and down, an eyelash (15).
                tip = top + d * H * .16 + Vector((0, 0, -H * .07))
                mesh.add_tube([top, top + d * H * .07 + Vector((0, 0, H * .01)), tip], [.006, .006, .002], 4, 'accent',
                              rng=rng, cap_end=False)
        paint_blades(mesh, H)
    return build


def wheatgrass(height, n, spikes):
    """Western wheatgrass: stiff, upright, blue-green blades in a loose
    patch (a sod, not a tuft), narrow wheat-like spikes on stems."""
    def build(mesh, rng):
        H = height
        blades(mesh, rng, n, H * .85, .4, .011, .3, .18, .7, mound=False)
        for k in range(spikes):
            a = rng.uniform(0, math.tau)
            root = Vector((math.cos(a) * .15 * rng.random(), math.sin(a) * .15 * rng.random(), 0))
            top = stalk(mesh, rng, root, a, H * rng.uniform(.95, 1.1), .08, .007)
            mesh.add_lump(top - Vector((0, 0, H * .06)), (.01, .01, H * .07), 'accent', rng, subdiv=0, jitter=.1,
                          flex=1.0)
        paint_blades(mesh, H * 1.05)
    return build


MODELS = [
    ('Blender_TallFescue_1', tallfescue(.55, 34, 8)),
    ('Blender_TallFescue_2', tallfescue(.45, 28, 0)),
    ('Blender_LittleBluestem_1', littlebluestem(.75, 40, 12)),
    ('Blender_LittleBluestem_2', littlebluestem(.6, 32, 8)),
    ('Blender_Switchgrass_1', switchgrass(1.5, 30, 16)),
    ('Blender_Switchgrass_2', switchgrass(1.2, 24, 11)),
    ('Blender_Indiangrass_1', indiangrass(1.7, 44, 9)),
    ('Blender_Indiangrass_2', indiangrass(1.4, 34, 6)),
    ('Blender_BlueGrama_1', bluegrama(.35, 64, 16)),
    ('Blender_BlueGrama_2', bluegrama(.3, 52, 10)),
    ('Blender_Wheatgrass_1', wheatgrass(.75, 72, 8)),
    ('Blender_Wheatgrass_2', wheatgrass(.6, 56, 5)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Leaf (blades) and accent (heads) a season, from specs-plants.json; heads
# PLACED from the pictures where the spec gives the leaf only.
LOOK = {
    'TallFescue': {'spring': ('#6aa048', '#8aa868'), 'summer': ('#5e9040', '#c0b078'), 'autumn': ('#7a9a48', '#b8a070'),
                   'winter': ('#6a8a50', '#a8986a')},
    'LittleBluestem': {'spring': ('#7a9a88', '#7a9a88'), 'summer': ('#7a9890', '#9a7a8a'), 'autumn': ('#b8602e', '#ece8e0'),
                       'winter': ('#a86a40', '#e0dcd0')},
    'Switchgrass': {'spring': ('#6a9a58', '#6a9a58'), 'summer': ('#5e8a58', '#a87a8a'), 'autumn': ('#c8a050', '#c8a888'),
                    'winter': ('#b89a70', '#c0a888')},
    'Indiangrass': {'spring': ('#6a9a58', '#6a9a58'), 'summer': ('#6a8e58', '#c09040'), 'autumn': ('#c08840', '#b07830'),
                    'winter': ('#b8986a', '#a88a60')},
    'BlueGrama': {'spring': ('#8a9a78', '#8a9a78'), 'summer': ('#8a9a72', '#c8b890'), 'autumn': ('#b8a478', '#c0aa80'),
                  'winter': ('#b0a080', '#b8a888')},
    'Wheatgrass': {'spring': ('#6f9a8a', '#7aa090'), 'summer': ('#7a9a88', '#a8b090'), 'autumn': ('#c0a870', '#c8b080'),
                   'winter': ('#b8a880', '#c0b088')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        leaf, acc = LOOK[sp][season]
        out[name] = {'leaf': hexrgb(leaf), 'accent': hexrgb(acc)}
    return out


ct.export(MODELS, colours={'leaf': (0.42, 0.55, 0.28), 'accent': (0.85, 0.74, 0.45)}, figure=1.0, tints=tints(SEASON))
