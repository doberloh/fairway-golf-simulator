# THE CARTOON ISLAND (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_island --render
#
# The Island's two trees, which were a Kenney palm and a procedural hala.
# From the real plants (RESEARCH, *The overhaul's island pack*):
#
#   coconut palm  a ringed column 20-30 m in the wild, often leaning and
#                 curved toward the light, a terminal crown of arching fronds
#                 about 4.5-5.5 m long, coconuts clustered under the crown
#                 (the accent)
#   hala          Pandanus tectorius: 4-14 m, forking at 4-8 m into a few
#                 branches, thick prop roots at the foot, strap leaves 0.9-1.7
#                 m in spiralling tufts at the branch tips, a pineapple-like
#                 fruit (the accent)
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct
fb = ct.fb


def frond(mesh, rng, base, heading, length, droop, width, flex_root=.5):
    """One arching palm frond: a rachis curving up and out then down, with
    leaflets either side as long narrow blades -- a ladder of triangles,
    so the frond reads as feathery and not as a paddle."""
    out = Vector((math.cos(heading), math.sin(heading), 0))
    side = Vector((-out.y, out.x, 0))
    # Round 2: round 1's fronds were short sparse ladders (a pom-pom); now
    # longer, broader, with twice the leaflets, each a quad hanging from the
    # rachis, so the frond reads as one feathery leaf from afar.
    pts = []
    n = 14
    for k in range(n + 1):
        t = k / n
        pts.append(base + out * length * t + Vector((0, 0, length * (.38 * t - droop * t * t))))
    for k in range(1, n + 1):
        a, b = pts[k - 1], pts[k]
        t = k / n
        w = width * math.sin(math.pi * min(1, t * 1.1)) ** .7 + .03
        for sgn in (-1, 1):
            # Round 3: angled forward past the next leaflet, so they overlap and
            # the frond is one full leaf, not the saw-teeth of round 2.
            tip = a + (b - a) * 1.7 + side * sgn * w + Vector((0, 0, -w * .6))
            mid = a.lerp(tip, .5) + (b - a) * .3
            mesh.face([a, b, tip, mid], 'leaf')
    return pts


def palm(height, lean, fronds, nuts):
    def build(mesh, rng):
        H = height
        d = Vector((math.cos(lean[0]), math.sin(lean[0]), 0))
        # A curved column: leaning out, then turning back up toward the light.
        pts, radii = [], []
        for k in range(13):
            t = k / 12
            p = d * lean[1] * H * (math.sin(t * math.pi * .55)) + Vector((0, 0, H * t))
            pts.append(p)
            radii.append(H * .028 * (1.25 - .45 * t) * (1.25 if k == 0 else 1))
        made = mesh.add_tube(pts, radii, 9, 'bark', rng=rng, wobble=.03,
                             shade=lambda co, t: .75 + .3 * t, flex=lambda co, t: .25 * t * t)
        # The rings of old leaf scars: every other ring of the trunk darker.
        for i, ring in enumerate(made):
            if i % 2:
                for v in ring:
                    r, g, b, f = mesh.paint[v]
                    mesh.paint[v] = (r * .82, g * .82, b * .82, f)
        top = pts[-1]
        c = top + Vector((0, 0, H * .02))
        # The crown: a tuft at the top and the fronds arching out round it.
        # The crown shaft, green, small: round 3 in the game showed a big brown
        # knob on every palm.
        mesh.add_lump(c, (H * .022, H * .022, H * .035), 'leaf', rng, subdiv=1, jitter=.1, flex=.3)
        for i in range(fronds):
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            rise = rng.uniform(-.05, .25)
            frond(mesh, rng, c + Vector((0, 0, rise)), a, H * rng.uniform(.38, .46), rng.uniform(.7, 1.05), H * .075)
        for i in range(nuts):
            a = rng.uniform(0, math.tau)
            p = top + Vector((math.cos(a) * H * .035, math.sin(a) * H * .035, -H * rng.uniform(.01, .04)))
            mesh.add_lump(p, (H * .032, H * .032, H * .036), 'accent', rng, subdiv=1, jitter=.06, flex=.25)
    return build


def paint_leaves(mesh, top_z, span):
    """Fronds: dark low in the crown, light at the tips, free in the wind."""
    for v in mesh.bm.verts:
        if v in mesh.paint:
            continue
        t = max(0.0, min(1.0, (v.co.z - (top_z - span)) / max(span * 1.4, 1e-6)))
        m = .6 + .55 * t
        mesh.paint[v] = (m, m, m, .55 + .45 * t)


def palm_built(height, lean, fronds, nuts):
    inner = palm(height, lean, fronds, nuts)

    def build(mesh, rng):
        inner(mesh, rng)
        paint_leaves(mesh, height, height * .35)
    return build


def strap_tuft(mesh, rng, top, leaves, length):
    """A hala rosette: long strap leaves spiralling out of a branch tip,
    rising then drooping."""
    for i in range(leaves):
        a = i * ct.GOLDEN + rng.uniform(-.15, .15)
        up = rng.uniform(.25, .8)
        fb.blade(mesh, top, a, 1.2 - up, length * rng.uniform(.75, 1.05), length * .06, rng, segments=3,
                 tip_from=1.1, droop=.6 - up * .4)


def hala(height, branches):
    def build(mesh, rng):
        H = height
        fork = H * rng.uniform(.35, .45)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, H * .12)), fork - H * .12, H * .035, lean=Vector((0, 0, 0)),
                              flare=1.1, sides=8, shade_low=.75, shade_high=1.0)
        # Prop roots: thick stilts from low on the trunk to the ground round it.
        for i in range(rng.randint(5, 8)):
            a = i / 7 * math.tau + rng.uniform(-.3, .3)
            start = Vector((0, 0, H * rng.uniform(.12, .22)))
            end = Vector((math.cos(a) * H * .12, math.sin(a) * H * .12, -H * .02))
            ct.limb(mesh, rng, start, end, H * .018, H * .012, bow=-.08, sides=5, shade=.7)
        top = pts[-1]
        # Round 2: round 1's branches were long and bare under small tufts;
        # a hala's crown is a dense rounded mass of tufts, so shorter
        # branches each forking again, every tip a big rosette.
        for i in range(branches):
            a = i / branches * math.tau + rng.uniform(-.4, .4)
            out = Vector((math.cos(a), math.sin(a), 0))
            mid = top + out * H * .12 + Vector((0, 0, H * .12))
            ct.limb(mesh, rng, top, mid, H * .026, H * .02, bow=.1, sides=6, shade=.85)
            for k in range(2):
                b = a + (k - .5) * rng.uniform(.6, 1.0)
                o2 = Vector((math.cos(b), math.sin(b), 0))
                end = mid + o2 * H * rng.uniform(.1, .16) + Vector((0, 0, H * rng.uniform(.14, .24)))
                ct.limb(mesh, rng, mid, end, H * .018, H * .013, bow=.1, sides=5, shade=.9)
                strap_tuft(mesh, rng, end, 22, H * .26)
                if rng.random() < .35:
                    mesh.add_lump(end + Vector((0, 0, -H * .04)), (H * .03, H * .03, H * .04), 'accent', rng, subdiv=1, jitter=.1)
        for v in mesh.bm.verts:
            if v not in mesh.paint:
                t = max(0, min(1, v.co.z / H))
                m = .65 + .5 * t
                mesh.paint[v] = (m, m, m, .5 + .5 * t)
    return build


MODELS = [
    ('Blender_Palm_1', palm_built(14, (0.4, .12), 18, 5)),
    ('Blender_Palm_2', palm_built(12, (2.1, .22), 16, 4)),
    ('Blender_Palm_3', palm_built(16, (4.0, .06), 20, 6)),
    ('Blender_Palm_4', palm_built(10, (5.2, .28), 15, 3)),
    ('Blender_Hala_1', hala(8, 4)),
    ('Blender_Hala_2', hala(7, 3)),
    ('Blender_Hala_3', hala(9, 4)),
]

# No far twins: fronds and strap leaves are flat faces, not lobes, so a twin
# would be the same model.
ct.export(MODELS, colours={'leaf': (0.35, 0.55, 0.25), 'bark': (0.5, 0.42, 0.32), 'accent': (0.55, 0.42, 0.2)})
