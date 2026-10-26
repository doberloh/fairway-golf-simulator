# THE CARTOON REDWOOD GROVE (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_redwood --render
#
# The Giant Redwood's forest, which was grown (tools/grow.mjs) in a realistic
# hand at 13,000-53,000 triangles a tree. Remade in the overhaul's hand:
#
#   redwood    a vast, slightly tapering, fluted red-brown column, bare for
#              most of its height, flared at the foot; a narrow crown of
#              drooping sprays in the top third or less
#   fir        Douglas fir: a long clear bole, a conical crown of drooping
#              tiers from about a third of the way up
#   hemlock    western hemlock: soft feathery tiers and a drooping leader
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
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
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


def fluted_trunk(mesh, rng, H, top_z, radius, flare, flutes, shade_low=.7, shade_high=1.0):
    """A trunk pleated into flutes: rings whose radius rises and falls round
    the circumference, deepest at the foot, painted darker in the grooves."""
    rings, n, steps = [], flutes * 2, 10
    for k in range(steps + 1):
        t = k / steps
        z = top_z * t
        r = radius * (1 - .35 * t) * (1 + (flare - 1) * math.exp(-t * 10))
        depth = .16 * (1 - t) + .04
        ring = []
        for j in range(n):
            a = j / n * math.tau
            rr = r * (1 - depth * (j % 2))
            ring.append(Vector((math.cos(a) * rr, math.sin(a) * rr, z)))
        rings.append(ring)
    made = mesh.ring_strip(rings, 'bark', smooth=True, cap_end=True)
    for k, ring in enumerate(made):
        t = k / steps
        for j, v in enumerate(ring):
            m = (shade_low + (shade_high - shade_low) * min(1, t * 1.5)) * (.8 if j % 2 else 1.0)
            mesh.paint[v] = (m, m, m, .1 * t * t)
    return made


def redwood(height, flutes):
    def build(mesh, rng):
        H = height
        half = H * .095
        fluted_trunk(mesh, rng, H, H * .96, H * .03, 1.9, flutes)
        # A few dead limb stubs on the long bare bole.
        for k in range(rng.randint(3, 6)):
            z = H * rng.uniform(.3, .62)
            a = rng.uniform(0, math.tau)
            p = Vector((0, 0, z))
            ct.limb(mesh, rng, p, p + Vector((math.cos(a), math.sin(a), -.2)) * H * .04, H * .006, H * .003, sides=4, shade=.6)
        # The crown: narrow, ragged, drooping sprays high up, a few clumps
        # breaking the outline.
        # Round 3: fuller and deeper -- rounds 1 and 2 were skimpy for a giant.
        tiers(mesh, rng, H, half * 1.1, 11, .58, .98, 8, .6, .3, .05, .62, power=.5)
        shade = ct.crown_shade(Vector((0, 0, H * .82)), (half, half, H * .16))
        for k in range(rng.randint(8, 12)):
            z = H * rng.uniform(.6, .94)
            a = rng.uniform(0, math.tau)
            p = Vector((math.cos(a) * half * .8, math.sin(a) * half * .8, z))
            s = half * rng.uniform(.4, .6)
            mesh.add_lump(p, (s, s, s * .55), 'leaf', rng, subdiv=2, jitter=.18, crown=Vector((0, 0, z)), blend=.7,
                          shade=shade, flex=.7, squash_bottom=.5)
    return build


def fir(height):
    def build(mesh, rng):
        H = height
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .95, H * .022, flare=1.6, sides=8, shade_low=.7)
        tiers(mesh, rng, H, H * .17, 12, .3, .96, 8, .5, .18, .06, .66, power=.9)
    return build


def hemlock(height):
    def build(mesh, rng):
        H = height
        lean = drift(rng, H * .02)
        ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .88, H * .02, flare=1.5, sides=8, lean=lean, shade_low=.7)
        # Round 2: feathery -- more, thinner sprays than the fir's.
        tiers(mesh, rng, H, H * .17, 13, .2, .9, 11, .7, .3, .055, .42, power=.85, lean=lean)
        # The drooping leader: the top bends over like a whip.
        top = Vector((0, 0, H * .88)) + lean
        d = Vector((1, 0, 0)) if lean.length < 1e-6 else lean.normalized()
        tip = top + d * H * .05 + Vector((0, 0, H * .05))
        ct.limb(mesh, rng, top, tip, H * .008, H * .002, bow=.4, sides=4, shade=.85)
    return build


def redcedar(height):
    def build(mesh, rng):
        H = height
        fluted_trunk(mesh, rng, H, H * .9, H * .035, 2.8, 7, shade_low=.65)
        # Round 2: told apart from the fir by long drooping sprays, ragged.
        tiers(mesh, rng, H, H * .19, 10, .12, .94, 12, 1.0, .38, .08, .5, power=.8)
    return build


def tanoak(height, width):
    def build(mesh, rng):
        H, W = height, width
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .5, H * .035, flare=1.5, sides=9, lean=drift(rng, H * .05),
                              bend=H * .03)
        c = Vector((pts[-1].x, pts[-1].y, H * .66))
        # Round 2: lobes of 320 triangles, not 1,280 (round 1 was 7,000 faces).
        ct.cloud_crown(mesh, rng, c, (W * .5, W * .46, H * .32), lobes=22, lobe_size=(.26, .36), flat_bottom=.4, shell=.82,
                       low=.45, high=1.1, subdiv=2)
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
    ('Blender_Redwood_1', redwood(100, 9)),
    ('Blender_Redwood_2', redwood(90, 8)),
    ('Blender_Redwood_3', redwood(110, 10)),
    ('Blender_Fir_1', fir(60)),
    ('Blender_Fir_2', fir(55)),
    ('Blender_Hemlock_1', hemlock(45)),
    ('Blender_Hemlock_2', hemlock(40)),
    ('Blender_RedCedar_1', redcedar(50)),
    ('Blender_RedCedar_2', redcedar(45)),
    ('Blender_Tanoak_1', tanoak(20, 14)),
    ('Blender_Tanoak_2', tanoak(17, 12)),
    ('Blender_Seedling_1', seedling(3)),
    ('Blender_Seedling_2', seedling(2.4)),
    ('Blender_SwordFern_1', swordfern(18)),
    ('Blender_SwordFern_2', swordfern(14)),
    ('Blender_Salal_1', salal(1.6)),
    ('Blender_Salal_2', salal(1.2)),
    ('Blender_Sorrel_1', sorrel(1.2)),
]

ct.export(MODELS, colours={'leaf': (0.22, 0.38, 0.22), 'bark': (0.5, 0.28, 0.2)},
          far={'Blender_Redwood_1', 'Blender_Redwood_2', 'Blender_Redwood_3', 'Blender_Fir_1', 'Blender_Fir_2',
               'Blender_Hemlock_1', 'Blender_Hemlock_2', 'Blender_RedCedar_1', 'Blender_RedCedar_2', 'Blender_Tanoak_1',
               'Blender_Tanoak_2'})
