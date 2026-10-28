# THE CARTOON DESERT (the cartoon overhaul; docs/CARTOON_OVERHAUL.md).
#
#   node tools/blender/run.mjs cartoon_desert --render
#
# The Sonoran Desert's plants, which until now were Kenney's dead hardwoods
# (for palo verde and mesquite), Kenney's cacti and two procedural shapes
# (ocotillo, agave). From the real plants (RESEARCH, *The overhaul's desert
# pack*):
#
#   palo verde  foothill palo verde: 4-8 m, low-branched and often several
#               trunks, smooth yellow-green bark that photosynthesises, an
#               open spreading crown of tiny leaves (bark is the game's green)
#   mesquite    velvet mesquite: about 8-9 m and as wide, crooked arching
#               stems, a broad rounded open crown of feathery leaves; dense
#               bosques along washes
#   saguaro     a ribbed column 3-16 m, arms turning upward, white flowers
#               on the crown (the accent)
#   cholla      teddy-bear cholla up to about 1.5 m, a short trunk of furry
#               golden joints (the accent); with it the prickly pear's pads
#               and a barrel cactus, the same height class
#   ocotillo    6-100 unbranched wand-like canes from the root crown,
#               2-6 m, small leaves along them after rain, red flower
#               clusters at the tips (the accent)
#   agave       a rosette of thick blue-grey leaves, each with a dark spine
#               at its tip (the accent), under a metre tall
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def palo(height, width, stems):
    def build(mesh, rng):
        H, W = height, width
        c = Vector((0, 0, H * .66))
        tips = []
        # Several low trunks leaning out, each forking once: the green bones
        # that show through a palo verde's thin crown.
        for i in range(stems):
            a = i / stems * math.tau + rng.uniform(-.4, .4)
            lean = Vector((math.cos(a), math.sin(a), 0)) * W * rng.uniform(.12, .2)
            pts, radii = ct.trunk(mesh, rng, drift(rng, H * .03), H * rng.uniform(.38, .5), H * .032, lean=lean,
                                  flare=1.3, sides=8, bend=H * .02, shade_low=.85, shade_high=1.1)
            top = pts[-1]
            for k in range(2):
                b = a + (k - .5) * rng.uniform(.6, 1.1)
                end = top + Vector((math.cos(b) * W * .26, math.sin(b) * W * .26, H * rng.uniform(.18, .3)))
                ct.limb(mesh, rng, top, end, H * .016, H * .006, bow=.12, sides=6, shade=.95)
                tips.append(end)
        # An open, airy crown -- sky shows through, as in the real tree. Round
        # 2: round 1's few big flat lobes on bare stalks read as lollipops;
        # now each branch tip splits into twigs, each carrying a cloud of
        # many small lobes, so the crown is a fine haze. Round 3: those lobes
        # cost 11,000 faces a tree -- too many for a bosque -- so four to a
        # twig, of 80 triangles each, not 320.
        shade = ct.crown_shade(c, (W * .5, W * .5, H * .3), low=.6, high=1.25, core=.8)
        ends = []
        for e in tips:
            for j in range(3):
                b = rng.uniform(0, math.tau)
                f = e + Vector((math.cos(b) * W * .1, math.sin(b) * W * .1, H * rng.uniform(.02, .08)))
                ct.limb(mesh, rng, e, f, H * .006, H * .003, bow=.1, sides=4, shade=.95)
                ends.append(f)
        for e in tips + ends:
            for j in range(4):
                p = e + Vector((rng.uniform(-1, 1) * W * .06, rng.uniform(-1, 1) * W * .06, rng.uniform(-.01, .04) * H))
                s = W * rng.uniform(.045, .07)
                mesh.add_lump(p, (s, s, s * .7), 'leaf', rng, subdiv=1, jitter=.2, crown=c, blend=.75, shade=shade,
                              flex=.85, squash_bottom=.3)
        # Spring: yellow flowers dusting the crown.
        for i in range(40):
            e = tips[rng.randrange(len(tips))]
            p = e + Vector((rng.uniform(-1, 1) * W * .12, rng.uniform(-1, 1) * W * .12, rng.uniform(0, .08) * H))
            s = W * rng.uniform(.018, .03)
            mesh.add_lump(p, (s, s, s), 'accent', rng, subdiv=1, jitter=.1, flex=.9)
    return build


def mesquite(height, width):
    def build(mesh, rng):
        H, W = height, width
        # A crooked trunk forking low into arching stems.
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .3, H * .045, lean=drift(rng, H * .06), flare=1.6,
                              sides=10, bend=H * .05, shade_low=.7, shade_high=.95, wobble=.1)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .62))
        ends = []
        for i in range(5):
            a = i / 5 * math.tau + rng.uniform(-.5, .5)
            mid = top + Vector((math.cos(a) * W * .2, math.sin(a) * W * .2, H * .22))
            end = top + Vector((math.cos(a) * W * .38, math.sin(a) * W * .38, H * rng.uniform(.28, .38)))
            ct.limb(mesh, rng, top, mid, H * .026, H * .016, bow=.25, sides=7, shade=.8)
            ct.limb(mesh, rng, mid, end, H * .016, H * .006, bow=-.1, sides=6, shade=.85)
            ends.append(end)
        # A broad, rounded but open crown: a low dome of many feathery lobes
        # with gaps, wider than it is tall.
        # Round 2: round 1's crown was a stack of pancakes (a crown half as
        # tall as wide, lobes flattened); taller now, rounder lobes, more of
        # them, so the dome reads as feathery clumps.
        ct.cloud_crown(mesh, rng, c, (W * .5, W * .47, H * .32), lobes=36, lobe_size=(.16, .24), subdiv=2, jitter=.22,
                       flat_bottom=.35, shell=.9, low=.5, high=1.15)
        shade = ct.crown_shade(c, (W * .5, W * .47, H * .32))
        for e in ends:
            s = W * .11
            mesh.add_lump(e, (s, s, s * .75), 'leaf', rng, subdiv=2, jitter=.2, crown=c, blend=.8, shade=shade, flex=.85,
                          squash_bottom=.3)
    return build


def ribbed(mesh, rng, pts, radius, ribs, role='leaf', taper=.15, cap=True):
    """A cactus column: rings round a path, each ring pleated into `ribs` ribs,
    domed at the top. Painted darker in the grooves and at the foot; normals
    are the column's own, rounded, so the ribs read as stripes of light."""
    rings, n = [], ribs * 2
    for i, p in enumerate(pts):
        t = i / (len(pts) - 1)
        a = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        u, v = ct.fb.frame_along(a)
        r = radius * (1 - taper * t)
        if cap and t > .8:
            r *= math.sqrt(max(.05, 1 - ((t - .8) / .2) ** 2))
        ring = []
        for k in range(n):
            ang = k / n * math.tau
            rr = r * (1 if k % 2 == 0 else .86)
            ring.append(p + (u * math.cos(ang) + v * math.sin(ang)) * rr)
        rings.append(ring)
    made = mesh.ring_strip(rings, role, smooth=True, cap_end=True)
    for i, ring in enumerate(made):
        t = i / max(1, len(made) - 1)
        for k, vtx in enumerate(ring):
            groove = .78 if k % 2 else 1.0
            m = (.72 + .4 * min(1, t * 2.5)) * groove
            mesh.paint[vtx] = (m, m, m, 0.0)
    return made


def saguaro(height, arms):
    def build(mesh, rng):
        H = height
        r = H * .055
        trunk = [Vector((0, 0, H * t)) + drift(rng, H * .005) * t for t in [i / 12 for i in range(13)]]
        ribbed(mesh, rng, trunk, r, 12)
        for i in range(arms):
            a = rng.uniform(0, math.tau)
            out = Vector((math.cos(a), math.sin(a), 0))
            h0 = H * rng.uniform(.35, .6)
            reach = H * rng.uniform(.1, .15)
            rise = H * rng.uniform(.18, .3)
            # Out, then a J up: the arm's elbow sits just past the trunk.
            pts = [Vector((0, 0, h0)) + out * r * .5]
            for k in range(1, 9):
                t = k / 8
                bend = min(1, t * 1.6)
                pts.append(Vector((0, 0, h0)) + out * (r * .5 + reach * math.sin(bend * math.pi / 2)) +
                           Vector((0, 0, rise * max(0, t - .3) / .7 + reach * .3 * (1 - math.cos(bend * math.pi / 2)))))
            ribbed(mesh, rng, pts, r * .72, 10, taper=.1)
        # Creamy flowers on the crown in May.
        for i in range(rng.randint(4, 7)):
            a = rng.uniform(0, math.tau)
            p = Vector((math.cos(a) * r * .6, math.sin(a) * r * .6, H * .99))
            mesh.add_lump(p, (r * .22, r * .22, r * .16), 'accent', rng, subdiv=1, jitter=.1)
    return build


def cholla(height):
    def build(mesh, rng):
        H = height
        # A short dark trunk, then clusters of furry golden joints, densest at
        # the top: the teddy bear that glows in back light.
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .45, H * .06, flare=1.2, sides=7,
                              shade_low=.55, shade_high=.75, wobble=.12)
        c = Vector((0, 0, H * .65))
        shade = ct.crown_shade(c, (H * .35, H * .35, H * .35), low=.6, high=1.25)
        # Round 2: round 1's joints were a few big blobs (yellow flames); a
        # teddy bear cholla is many short fat joints. Round 3: still a cloud
        # of flames, so the joints are CHAINED -- short arms leave the trunk
        # top and each is three or four fat joints end to end, turning up,
        # which is the cholla's silhouette.
        top = pts[-1]
        for i in range(9):
            a = i / 9 * math.tau + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            p = top + Vector((0, 0, rng.uniform(-.1, .15) * H))
            d = (out * rng.uniform(.6, 1) + Vector((0, 0, rng.uniform(.4, 1)))).normalized()
            for k in range(rng.randint(3, 4)):
                s = H * rng.uniform(.045, .06)
                q = p + d * s * 1.7
                mesh.add_lump(q, (s, s, s * 1.8), 'accent', rng, subdiv=2, jitter=.2, crown=c, blend=.5,
                              shade=shade, flex=0.0)
                # Each joint set end on to the last, bending upward.
                p = q + d * s * 1.5
                d = (d + Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), .35))).normalized()
    return build


def prickly_pear(height):
    def build(mesh, rng):
        H = height
        # Pads on pads, each a thick flat oval set on the edge of the last.
        stack = [(Vector((0, 0, H * .2)), 0.0, 0)]
        made = 0
        while stack and made < 16:
            p, a, depth = stack.pop(0)
            # Round 2: thinner pads set further apart -- round 1's merged into
            # one blob.
            s = H * (.22 - .03 * depth)
            mesh.add_lump(p, (s * .72, s * .11, s), 'leaf', rng, subdiv=2, jitter=.04,
                          shade=lambda q, n: .75 + .4 * min(1, q.z / H), flex=0.0)
            made += 1
            if depth < 3:
                for k in range(rng.randint(1, 2)):
                    b = a + rng.uniform(-1.3, 1.3)
                    q = p + Vector((math.cos(b) * s * .8, math.sin(b) * s * .45, s * 1.25))
                    stack.append((q, b, depth + 1))
            # Red fruit along the top edge.
            if depth >= 2:
                for k in range(rng.randint(1, 3)):
                    mesh.add_lump(p + Vector((rng.uniform(-.5, .5) * s, 0, s * .95)), (s * .14, s * .12, s * .18),
                                  'accent', rng, subdiv=1, jitter=.05)
    return build


def barrel(height):
    def build(mesh, rng):
        H = height
        pts = [Vector((0, 0, H * t)) for t in [i / 8 for i in range(9)]]
        made = ribbed(mesh, rng, pts, H * .42, 16, taper=.05)
        # A crown of yellow flowers.
        for i in range(8):
            a = i / 8 * math.tau
            mesh.add_lump(Vector((math.cos(a) * H * .14, math.sin(a) * H * .14, H * .98)), (H * .06, H * .06, H * .05),
                          'accent', rng, subdiv=1, jitter=.1)
    return build


def ocotillo(height, canes):
    def build(mesh, rng):
        H = height
        for i in range(canes):
            a = rng.uniform(0, math.tau)
            out = Vector((math.cos(a), math.sin(a), 0))
            tilt = rng.uniform(.12, .4)
            L = H * rng.uniform(.7, 1.0)
            pts = [out * H * .02 + out * (L * tilt * (t ** 1.4)) + Vector((0, 0, L * t)) for t in [k / 6 for k in range(7)]]
            mesh.add_tube(pts, [H * .012 * (1 - .6 * k / 6) for k in range(7)], 5, 'bark', rng=rng, wobble=.08,
                          shade=lambda co, t: .75 + .35 * t, flex=lambda co, t: .9 * t * t)
            # Small leaves along the upper canes, then the red flower tip.
            for k in range(10):
                t = rng.uniform(.25, .92)
                p = out * (L * tilt * (t ** 1.4)) + Vector((0, 0, L * t))
                s = H * .022
                mesh.add_lump(p + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * s * .6, (s, s, s * 1.3), 'leaf',
                              rng, subdiv=1, jitter=.15, flex=.8)
            tip = pts[-1]
            mesh.add_lump(tip + Vector((0, 0, H * .03)), (H * .02, H * .02, H * .05), 'accent', rng, subdiv=1, jitter=.1, flex=1.0)
    return build


def agave(height, width, leaves):
    def build(mesh, rng):
        H, W = height, width
        for i in range(leaves):
            a = i * ct.GOLDEN + rng.uniform(-.1, .1)
            layer = i / leaves
            out = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-out.y, out.x, 0))
            # Outer leaves (the first laid down) lie lower and longer, inner
            # ones stand up and are shorter.
            up = .35 + .9 * layer
            L = W * (.55 - .25 * layer)
            pts = []
            for k in range(6):
                t = k / 5
                pts.append(out * L * t * math.cos(up * .9) + Vector((0, 0, H * .05 + L * t * math.sin(up) - L * .25 * t * t * (1 - up))))
            # A thick keeled leaf: a tapering tube flattened sideways.
            rings = []
            for k, p in enumerate(pts):
                t = k / 5
                # Round 2: twice as broad and thick -- round 1's leaves were
                # grass blades; an agave's are fleshy wedges.
                w = W * .13 * (1 - t) ** .75 + .003
                th = w * .55
                ring = [p + side * w, p + Vector((0, 0, th)), p - side * w, p - Vector((0, 0, th))]
                rings.append(ring)
            made = mesh.ring_strip(rings, 'leaf', smooth=True, cap_end=True)
            for k, ring in enumerate(made):
                t = k / max(1, len(made) - 1)
                for vtx in ring:
                    m = .7 + .45 * t
                    mesh.paint[vtx] = (m, m, m, 0.0)
            tip = pts[-1]
            d = (pts[-1] - pts[-2]).normalized()
            mesh.add_lump(tip + d * W * .03, (W * .012, W * .012, W * .012), 'accent', rng, subdiv=1, jitter=.05)
    return build


MODELS = [
    ('Blender_Palo_1', palo(6.5, 7.5, 3)),
    ('Blender_Palo_2', palo(5.5, 6.5, 4)),
    ('Blender_Palo_3', palo(7, 8, 2)),
    ('Blender_Mesquite_1', mesquite(8, 9)),
    ('Blender_Mesquite_2', mesquite(7, 8.5)),
    ('Blender_Mesquite_3', mesquite(9, 9.5)),
    ('Blender_Saguaro_1', saguaro(10, 2)),
    ('Blender_Saguaro_2', saguaro(12, 4)),
    ('Blender_Saguaro_3', saguaro(8, 0)),
    ('Blender_Cholla_1', cholla(1.4)),
    ('Blender_Cholla_2', cholla(1.1)),
    ('Blender_PricklyPear_1', prickly_pear(1.2)),
    ('Blender_Barrel_1', barrel(.9)),
    ('Blender_Ocotillo_1', ocotillo(4.5, 18)),
    ('Blender_Ocotillo_2', ocotillo(3.5, 12)),
    ('Blender_Ocotillo_3', ocotillo(5.5, 24)),
    ('Blender_Agave_1', agave(.8, 1.4, 16)),
    ('Blender_Agave_2', agave(.6, 1.1, 13)),
]

ct.export(MODELS, colours={'leaf': (0.45, 0.55, 0.32), 'bark': (0.45, 0.55, 0.3), 'accent': (0.95, 0.8, 0.3)},
          far={n for n, _ in MODELS if 'Palo' in n or 'Mesquite' in n})
