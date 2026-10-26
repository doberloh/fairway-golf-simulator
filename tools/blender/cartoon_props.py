# THE CARTOON PROPS (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_props --render
#
# Haunted Hollow's pumpkins and toadstools, which were Kenney's. Roles as
# haunts.js paints them: `accent` the pumpkin's body or a toadstool's cap,
# `leaf` a pumpkin's stem, `bark` a toadstool's stalk and the white spots
# on a red cap.
#
# THE PROPORTIONS ARE KEPT. Generation collides with a prop as a cylinder
# its model's widest half-extent wide (species.js PROP_MODELS, measured off
# the ingested model), and the lantern faces (haunts.js faceGeometry) are
# laid on the old pumpkin's body: half as wide as 0.67-0.70 of its height,
# widest between 0.15 and 0.65 up. So the pumpkins keep that shape, and the
# toadstools the old ones' -- a group about 0.65 of its height in half-width,
# the tall single about 0.29 -- and PROP_MODELS is re-measured anyway.
#
# From the real things (RESEARCH, *The overhaul's props*): a field pumpkin is
# squat and deeply ribbed, its stem short, woody and twisted; the fly agaric
# is a red cap flecked with white warts on a white stalk with a ring and a
# bulbous foot, growing in troops.
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def pumpkin(ribs, squash, lean):
    def build(mesh, rng):
        # A lathe of rings, each pleated into ribs: deep grooves, round lobes.
        rings, n = [], ribs * 6
        prof = []
        for k in range(13):
            t = k / 12
            a = math.pi * t
            r = .69 * math.sin(a) ** .8
            z = .78 * (1 - math.cos(a)) / 2
            prof.append((max(r, .02), z))
        for r, z in prof:
            ring = []
            for j in range(n):
                ang = j / n * math.tau
                rib = .82 + .18 * abs(math.cos(ang * ribs / 2)) ** .6
                ring.append(Vector((math.cos(ang) * r * rib, math.sin(ang) * r * rib * squash, z)))
            rings.append(ring)
        made = mesh.ring_strip(rings, 'accent', smooth=True, cap_start=True, cap_end=True)
        for i, ring in enumerate(made):
            t = i / (len(made) - 1)
            for j, v in enumerate(ring):
                ang = j / n * math.tau
                groove = .75 + .25 * abs(math.cos(ang * ribs / 2)) ** .6
                m = (.68 + .5 * math.sin(math.pi * min(1, t * 1.1))) * groove
                mesh.paint[v] = (m, m, m, 0.0)
        # The stem: short, woody, twisted, leaning.
        base = Vector((0, 0, .72))
        tip = base + Vector((lean, lean * .4, .24))
        mesh.add_tube(fb.sweep_points(base, tip, Vector((lean * .5, 0, .02)), 4, rng=rng, kink=.02),
                      [.07, .06, .05, .045, .04], 6, 'leaf', rng=rng, shade=lambda co, t: .7 + .4 * t)
    return build


def cap(mesh, rng, top, radius, height, role='accent', spots=True):
    """A toadstool cap: a dome, curled at the rim, white warts scattered."""
    c = top
    mesh.add_lump(c, (radius, radius, height), role, rng, subdiv=2, jitter=.04, squash_bottom=.85,
                  shade=lambda p, n: .7 + .5 * max(0, (p.z - (c.z - height * .2)) / (height * 1.2)))
    if spots:
        # Round 3: more and bigger warts, so the fly agaric reads from afar.
        for k in range(rng.randint(10, 15)):
            y = rng.uniform(.25, .9)
            r = math.sqrt(max(0, 1 - y * y))
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * r * radius * .98, math.sin(a) * r * radius * .98, y * height * .98))
            s = radius * rng.uniform(.11, .17)
            mesh.add_lump(p, (s, s, s * .5), 'bark', rng, subdiv=1, jitter=.1)


def stalk(mesh, rng, base, top, r):
    mesh.add_tube([base, base.lerp(top, .5), top], [r * 1.5, r, r * .9], 7, 'bark', rng=rng, wobble=.05,
                  shade=lambda co, t: .75 + .3 * t)
    # The ring, just under the cap.
    mesh.add_lump(base.lerp(top, .82), (r * 1.6, r * 1.6, r * .35), 'bark', rng, subdiv=1, jitter=.05)


def toadstool_single(height):
    def build(mesh, rng):
        H = height
        # Round 2: round 1's were golf tees -- long thin stalks, small caps.
        top = Vector((rng.uniform(-.02, .02), 0, H * .62))
        stalk(mesh, rng, Vector((0, 0, 0)), top, H * .1)
        cap(mesh, rng, top, H * .3, H * .26)
    return build


def toadstool_group(n, spots=True):
    def build(mesh, rng):
        for i in range(n):
            a = i / n * math.tau + rng.uniform(-.4, .4)
            d = .38 * (0 if i == 0 else rng.uniform(.6, 1))
            base = Vector((math.cos(a) * d, math.sin(a) * d, 0))
            h = rng.uniform(.45, 1) if i else 1.0
            top = base + Vector((math.cos(a) * .05, math.sin(a) * .05, h * .55))
            stalk(mesh, rng, base, top, .075 * (h ** .5))
            cap(mesh, rng, top, .26 * (h ** .6), .22 * (h ** .6), spots=spots)
    return build


MODELS = [
    ('Blender_Pumpkin_1', pumpkin(10, 1.0, .05)),
    # Round, not squashed: a lantern's face (haunts.js) is laid on a round body.
    ('Blender_Pumpkin_2', pumpkin(8, 1.0, -.08)),
    ('Blender_Pumpkin_3', pumpkin(12, 1.0, .1)),
    ('Blender_Toadstool_RedGroup', toadstool_group(5)),
    ('Blender_Toadstool_RedTall', toadstool_single(1.0)),
    ('Blender_Toadstool_TanGroup', toadstool_group(6, spots=False)),
]

ct.export(MODELS, colours={'accent': (0.86, 0.52, 0.14), 'leaf': (0.3, 0.35, 0.16), 'bark': (0.87, 0.83, 0.75)})
