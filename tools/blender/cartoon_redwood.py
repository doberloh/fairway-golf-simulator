# THE CARTOON REDWOOD GROVE (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
# SINCE 5 NOVEMBER 2026 THE 14 TREES HERE ARE NOT BUILT: the game's redwoods, firs,
# hemlocks, red cedars and tanoaks come from Meshy, in vendor/blender-meshy_redwood
# (tools/meshy-run.mjs; docs/BLENDER_ASSETS.md, *Trying models from Meshy*). This
# script makes the seedling and the floor plants. The tree builders stay as the
# record, and to bring a tree back: add it to MODELS and remove its Meshy files.
#
#   node tools/blender/run.mjs cartoon_redwood --render
#
# The Giant Redwood's forest, which was grown (tools/grow.mjs) in a realistic
# hand at 13,000-53,000 triangles a tree. Remade in the overhaul's hand:
#
#   redwood    (remade 5 November 2026, the owner's photographs of Northwood) a
#              straight, dark, fluted trunk, barely flared; a long narrow cone
#              of fine drooping boughs from a quarter of the way up. The third
#              is an old tree: higher crown
#   youngredwood the same tree young: boughs nearly to the ground, the full
#              cone the owner's photographs are full of
#   fir        Douglas fir: heavier boughs, sweeping up at the top of the crown
#   hemlock    western hemlock: finer, drooping, a nodding leader
#   redcedar   western red cedar: a buttressed, fluted foot, J-shaped drooping
#              sprays, a narrow pyramid
#   tanoak     an evergreen broadleaf, a rounded crown under the giants
#   seedling   a young conifer of three tiers
#   swordfern  once-pinnate fronds standing up and arching out in a shuttlecock
#   salal      a thicket of glossy oval leaves
#   sorrel     redwood sorrel: a carpet of clover-like leaves
#
# CROWN WIDTHS ARE THE GENERATOR'S. course.js plants these at spacings from
# species.js CROWN_FRACTION (half-width over height: redwood 0.095, fir and
# hemlock 0.17, red cedar 0.19), so each crown is built that wide.
# REFS tanoak=Blender_Tanoak_1,Blender_Tanoak_2
# REFS redwood=Blender_Redwood_1,Blender_Redwood_2,Blender_Redwood_3
# REFS youngredwood=Blender_YoungRedwood_1,Blender_YoungRedwood_2,Blender_YoungRedwood_3
# REFS dougfir=Blender_Fir_1,Blender_Fir_2
# REFS hemlock=Blender_Hemlock_1,Blender_Hemlock_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
from grown import girth, fluted_trunk, limbs, broadleaf
fb = ct.fb


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def tiers(mesh, rng, H, half, n, base, top, points, droop, ragged, depth, thick, power=1.0, lean=Vector((0, 0, 0))):
    shade = ct.crown_shade(Vector((0, 0, H * (base + top) / 2)), (half, half, H * (top - base) / 2), low=.5, high=1.15, core=.7)
    for i in range(n):
        t = i / (n - 1)
        z = H * (base + (top - base) * t)
        r = half * (1 - .9 * t) ** power * rng.uniform(.9, 1.1) + H * .008
        d = H * depth * (1 - .3 * t)
        ct.skirt(mesh, rng, Vector((0, 0, z)) + lean * (z / H) ** 2, r, d, points=points + rng.randint(-1, 1), droop=droop,
                 shade=shade, twist=rng.uniform(0, 1), ragged=ragged, flex=.3 + .6 * t, thick=thick)


TANOAK = dict(stem=.92, foot=.026, first=.18, limbs=15, sweep=.75, branches=5, clusters=5, size=.13, leaves=6)
REDWOOD = dict(base=.36, top=.985, step=.0078, reach=.118, widest=.16, power=.8, down=.34, up=.5, tip=.22, limb=.0024, sprays=7, slen=.6, hang=.34, bare=.12, fan=.26, least=.04, pairs=6, wide=.62)
REDWOOD_OLD = dict(REDWOOD, base=.55, step=.0105, reach=.112, bare=.3, limb=.003)
YOUNG = dict(base=.09, top=.985, step=.0088, reach=.15, widest=.1, power=1.0, down=.46, up=.55, tip=.14, limb=.0034, sprays=7, slen=.54, hang=.42, bare=.1, fan=.26, least=.036, pairs=6, wide=.64)
FIR = dict(base=.26, top=.985, step=.0102, reach=.16, widest=.12, power=.95, down=.2, up=.95, tip=.32, limb=.0034, sprays=6, slen=.64, hang=.2, bare=.14, fan=.22, least=.04, pairs=6, wide=.66)
HEMLOCK = dict(base=.15, top=.9, step=.0094, reach=.15, widest=.08, power=.85, down=.62, up=.1, tip=.04, limb=.0028, sprays=7, slen=.58, hang=.6, bare=.1, fan=.2, least=.036, pairs=6, wide=.58)


def redwood(height, flutes, old=False):
    def build(mesh, rng):
        H = height
        c = REDWOOD_OLD if old else REDWOOD
        half = H * c['reach']
        fluted_trunk(mesh, rng, H, H * .985, H * .031, 1.3, flutes)
        limbs(mesh, rng, H, c)
        # An old tree's limbs are few and heavy.
        if old:
            for k in range(rng.randint(4, 6)):
                z = H * rng.uniform(.48, .86)
                a = rng.uniform(0, math.tau)
                p = Vector((0, 0, z))
                ct.limb(mesh, rng, p, p + Vector((math.cos(a), math.sin(a), .12)) * half * rng.uniform(.8, 1.2), H * .006, H * .002, sides=4, shade=.6)
    return build


def youngredwood(height, flutes):
    """A redwood of sixty or a hundred years, as the owner's photographs of
    Northwood show them: the same straight trunk, seen only at the foot, inside
    a full cone of drooping boughs."""
    def build(mesh, rng):
        H = height
        fluted_trunk(mesh, rng, H, H * .985, H * .03, 1.22, flutes, power=.9)
        limbs(mesh, rng, H, YOUNG)
    return build


def fir(height):
    def build(mesh, rng):
        H = height
        fluted_trunk(mesh, rng, H, H * .985, H * .024, 1.25, 5, power=.9, deep=.05)
        limbs(mesh, rng, H, FIR)
    return build


def hemlock(height):
    def build(mesh, rng):
        H = height
        lean = drift(rng, H * .02)
        fluted_trunk(mesh, rng, H, H * .9, H * .021, 1.22, 5, power=.85, deep=.05)
        limbs(mesh, rng, H, HEMLOCK)
        # The nodding leader.
        top = Vector((0, 0, H * .9)) + lean
        mesh.add_tube([top, top + Vector((.01 * H, 0, .055 * H)), top + Vector((.045 * H, 0, .08 * H)), top + Vector((.075 * H, 0, .068 * H))],
                      [H * .006, H * .004, H * .0025, H * .0008], 4, 'leaf', rng=rng, shade=lambda co, f: .85, flex=lambda co, f: .9)
    return build


def redcedar(height):
    def build(mesh, rng):
        H = height
        fluted_trunk(mesh, rng, H, H * .9, H * .035, 2.8, 7, shade_low=.65)
        # Round 2: told apart from the fir by long drooping sprays, ragged.
        tiers(mesh, rng, H, H * .19, 10, .12, .94, 12, 1.0, .38, .08, .5, power=.8)
    return build


def tanoak(height, width):
    """Tall and narrow: a stem nearly to the top, limbs sweeping up off it (the
    shared builder, grown.py). The old tree was balls on a trunk."""
    def build(mesh, rng):
        broadleaf(mesh, rng, height, width * .5, TANOAK)
    return build


def seedling(height):
    def build(mesh, rng):
        H = height
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .9, H * .03, flare=1.2, sides=6)
        # Round 2: round 1 was three discs on a pole; a young tree is full.
        tiers(mesh, rng, H, H * .26, 6, .12, .92, 7, .45, .18, .15, .72)
    return build


def swordfern(fronds):
    def build(mesh, rng):
        for i in range(fronds):
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            out = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-out.y, out.x, 0))
            L = rng.uniform(.8, 1.1)
            up = rng.uniform(.9, 1.3)
            n = 9
            prev = Vector((0, 0, .02))
            for k in range(1, n + 1):
                t = k / n
                p = out * L * .55 * t + Vector((0, 0, L * up * .6 * t - L * .45 * t * t))
                w = .07 * (1 - t) ** .5 + .01
                for sgn in (-1, 1):
                    tip = prev.lerp(p, .8) + side * sgn * w + Vector((0, 0, -w * .2))
                    mesh.face([prev, p, tip], 'leaf')
                prev = p
        for v in mesh.bm.verts:
            if v not in mesh.paint:
                m = .6 + .55 * min(1, v.co.z / .7)
                mesh.paint[v] = (m, m, m, min(1, v.co.z / .7))
    return build


def salal(width):
    def build(mesh, rng):
        W = width
        c = Vector((0, 0, W * .3))
        shade = ct.crown_shade(c, (W * .5, W * .5, W * .3), low=.5, high=1.2)
        # Round 2: round 1 was lily pads scattered on the ground; a thicket
        # has a body the leaves crowd over.
        mesh.add_lump(Vector((0, 0, W * .18)), (W * .44, W * .44, W * .3), 'leaf', rng, subdiv=2, jitter=.12, crown=c,
                      blend=.6, shade=shade, flex=.3, squash_bottom=.8)
        for i in range(40):
            a = rng.uniform(0, math.tau)
            r = math.sqrt(rng.random()) * W * .45
            z = W * .45 * math.sqrt(max(0, 1 - (r / (W * .5)) ** 2)) + W * .06
            p = Vector((math.cos(a) * r, math.sin(a) * r, z))
            s = W * rng.uniform(.06, .09)
            # A glossy oval leaf, tilted.
            mesh.add_lump(p, (s * 1.4, s, s * .45), 'leaf', rng, subdiv=1, jitter=.05, crown=c, blend=.5, shade=shade, flex=.5)
    return build


def sorrel(width):
    def build(mesh, rng):
        W = width
        for i in range(26):
            a = rng.uniform(0, math.tau)
            r = math.sqrt(rng.random()) * W * .45
            base = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            h = W * rng.uniform(.08, .16)
            top = base + Vector((0, 0, h))
            mesh.add_tube([base, top], [.006, .004], 3, 'bark', rng=rng, cap_end=False, flex=lambda co, t: t)
            # Three heart-shaped leaflets.
            for k in range(3):
                b = a + k / 3 * math.tau
                p = top + Vector((math.cos(b), math.sin(b), 0)) * W * .035
                s = W * .04
                mesh.add_lump(p, (s, s, s * .2), 'leaf', rng, subdiv=1, jitter=.05, flex=.6)
    return build


MODELS = [
    ('Blender_Seedling_1', seedling(3)),
    ('Blender_Seedling_2', seedling(2.4)),
    ('Blender_SwordFern_1', swordfern(18)),
    ('Blender_SwordFern_2', swordfern(14)),
    ('Blender_Salal_1', salal(1.6)),
    ('Blender_Salal_2', salal(1.2)),
    ('Blender_Sorrel_1', sorrel(1.2)),
]

# While a tree is worked on: only these, by a word in the name (FAIRWAY_ONLY=Young,Fir).
ONLY = [w for w in os.environ.get('FAIRWAY_ONLY', '').split(',') if w]
if ONLY:
    MODELS = [m for m in MODELS if any(w in m[0] for w in ONLY)]

ct.export(MODELS, colours={'leaf': (0.13, 0.25, 0.16), 'bark': (0.27, 0.17, 0.13)})
