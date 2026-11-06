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
# REFS paloverde=Blender_Palo_1,Blender_Palo_2,Blender_Palo_3
# REFS mesquite=Blender_Mesquite_1,Blender_Mesquite_2,Blender_Mesquite_3
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def twig(mesh, a, b, r0, r1, sides=3, shade=1.0, sag=0.0):
    """A fine stick of two segments: a third of a limb's cost, for the many
    last twigs an open crown shows against the sky."""
    mid = (a + b) * .5 + Vector((0, 0, sag))
    mesh.add_tube([a, mid, b], [r0, (r0 + r1) * .5, r1], sides, 'bark', shade=lambda co, t: shade,
                  flex=lambda co, t: .3 + .5 * t)


def palo(height, width, stems, twigs=3):
    def build(mesh, rng):
        # SILHOUETTE (the US landscapes back-port, 2 November 2026): a wide,
        # flat umbrella of green haze held up by a fan of green bones. Several
        # trunks from the ground, each forking twice into limbs reaching up and
        # out, every branch ending in fine twigs whose tips sit on one flat
        # dome; the leaves are small flat specks along that dome, so sky shows
        # through and between them -- nearly see-through, unlike the ironwood's
        # ragged grey dome or the mesquite's dark shelves.
        H, W = height, width
        R = W * .5

        def dome(r):
            return H * (.97 - .34 * (r / R) ** 2)
        c = Vector((0, 0, H * .68))
        shade = ct.crown_shade(c, (R, R, H * .32), low=.8, high=1.25, core=.9)
        per = max(2, math.ceil(8 / stems))
        ends, mids = [], []
        for i in range(stems):
            a = i / stems * math.tau + rng.uniform(-.4, .4)
            out = Vector((math.cos(a), math.sin(a), 0))
            th = H * rng.uniform(.18, .26)
            pts, radii = ct.trunk(mesh, rng, out * H * .025, th, H * .03, lean=out * th * .55, flare=1.25, sides=6,
                                  steps=5, bend=H * .015, shade_low=.85, shade_high=1.05)
            top = pts[-1]
            for k in range(per):
                b = a + (k - (per - 1) / 2) * rng.uniform(.45, .7)
                rr = R * rng.uniform(.26, .38)
                le = Vector((math.cos(b) * rr, math.sin(b) * rr, H * rng.uniform(.46, .56)))
                ct.limb(mesh, rng, top, le, H * .016, H * .009, bow=.08, sides=4, shade=.95)
                for m in range(2):
                    c2 = b + (m - .5) * rng.uniform(.35, .7)
                    r2 = min(R * .95, rr + R * rng.uniform(.38, .6))
                    be = Vector((math.cos(c2) * r2, math.sin(c2) * r2, dome(r2) - H * rng.uniform(.1, .15)))
                    twig(mesh, le, be, H * .008, H * .005, sides=4, shade=1.0, sag=H * .03)
                    mids.append((le + be) * .5 + Vector((0, 0, H * .03)))
                    for n in range(twigs):
                        d = c2 + rng.uniform(-.9, .9)
                        te = be + Vector((math.cos(d) * W * .08, math.sin(d) * W * .08, 0))
                        te.z = dome(min(R, te.xy.length)) - H * rng.uniform(.0, .1)
                        if not ct.FAR:   # the far twin: no last twigs, a bigger speck
                            twig(mesh, be, te, H * .004, H * .002, shade=1.05)
                        ends.append(te)
        # The haze: small flat specks on the twig ends and between them.
        # Each end draws from its own stream, so the far twin (fewer specks)
        # stays the same tree as the full model.
        for e in ends + mids:
            er = random.Random(rng.random())
            for j in range(2 if e in ends and not ct.FAR else 1):
                p = e + Vector((er.uniform(-1, 1) * W * .06, er.uniform(-1, 1) * W * .06, er.uniform(-.04, .01) * H))
                s = W * er.uniform(.035, .055) * (1.3 if ct.FAR else 1)
                mesh.add_lump(p, (s, s, s * .75), 'leaf', er, subdiv=1, jitter=.42, crown=c, blend=.7, shade=shade,
                              flex=.85)
        # Spring: yellow flowers dusting the crown.
        for i in range(7):
            e = ends[rng.randrange(len(ends))]
            p = e + Vector((rng.uniform(-1, 1) * W * .05, rng.uniform(-1, 1) * W * .05, H * .02))
            s = W * rng.uniform(.02, .03)
            mesh.add_lump(p, (s, s, s), 'accent', rng, subdiv=1, jitter=.1, flex=.9)
    return build


def mesquite(height, width, limbs, stems=1):
    def build(mesh, rng):
        # SILHOUETTE (the back-port): low, wide and dark. A short crooked
        # trunk forks almost at once into heavy arching limbs that spread
        # sideways; the crown is a broad, flat-topped, ragged shelf of dark
        # clumps, wider than tall, with feathery tassels hanging from its
        # outer edge and dark limbs showing through the gaps beneath --
        # not a ball, not the palo verde's thin bright umbrella.
        H, W = height, width
        R = W * .5
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .2, H * .05, lean=drift(rng, H * .05), flare=1.6,
                              sides=9, steps=6, bend=H * .05, shade_low=.55, shade_high=.75, wobble=.12)
        top = pts[-1]
        # A second, thinner stem from the foot, leaning out under the crown:
        # mesquite is often several-stemmed (round 6).
        sr_ = random.Random(rng.random())   # its own stream: the far twin skips it
        for k in range(0 if ct.FAR else stems - 1):
            a = sr_.uniform(0, math.tau)
            o = Vector((math.cos(a), math.sin(a), 0))
            sp, sr = ct.trunk(mesh, sr_, o * H * .04, H * .3, H * .028, lean=o * R * .35, flare=1.3, sides=6, steps=5,
                              bend=H * .04, shade_low=.55, shade_high=.75, wobble=.12)
            ct.limb(mesh, sr_, sp[-1], sp[-1] + o * R * .3 + Vector((0, 0, H * .2)), H * .015, H * .007, bow=.15,
                    sides=4, shade=.65)
        c = Vector((top.x, top.y, H * .68))
        shade = ct.crown_shade(c, (R, R, H * .28), low=.5, high=1.12, core=.75)
        tips = []
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.45, .45)
            out = Vector((math.cos(a), math.sin(a), 0))
            mid = top + out * R * rng.uniform(.25, .35)
            mid.z = H * rng.uniform(.4, .5)
            end = Vector((0, 0, 0)) + out * R * rng.uniform(.72, .85)
            end.z = H * rng.uniform(.62, .68)
            ct.limb(mesh, rng, top, mid, H * .03, H * .02, bow=.22, sides=7, shade=.6)
            ct.limb(mesh, rng, mid, end, H * .02, H * .009, bow=-.12, sides=5, shade=.65)
            tips.append((end, out))
            # A side branch running out nearly level from the arch.
            b = a + rng.choice((-1, 1)) * rng.uniform(.5, .8)
            o2 = Vector((math.cos(b), math.sin(b), 0))
            side = o2 * R * rng.uniform(.92, 1.02)
            side.z = H * rng.uniform(.52, .6)
            ct.limb(mesh, rng, mid, side, H * .014, H * .006, bow=.05, sides=4, shade=.65)
            tips.append((side, o2))
        for e, out in tips:
            # A shelf clump, wide and flat, over the tip ...
            s = R * rng.uniform(.28, .34)
            mesh.add_lump(e + Vector((0, 0, H * .05)), (s, s * .9, H * .09), 'leaf', rng, subdiv=3, jitter=.28,
                          crown=c, blend=.75, shade=shade, flex=.8, squash_bottom=.3)
            # ... a smaller one inboard and higher, so the top is ragged ...
            p = e - out * R * .18 + drift(rng, R * .08)
            p.z += H * rng.uniform(.08, .11)
            s = R * rng.uniform(.17, .22)
            mesh.add_lump(p, (s, s, H * .08), 'leaf', rng, subdiv=2, jitter=.2, crown=c, blend=.75, shade=shade,
                          flex=.75)
            # ... and feathery tassels hanging past the outer edge.
            tr = random.Random(rng.random())
            for k in range(1 if ct.FAR else 3):
                q = e + out * R * tr.uniform(.16, .28) + drift(tr, R * .12)
                q.z -= H * tr.uniform(.06, .14)
                s = R * tr.uniform(.06, .08)
                mesh.add_lump(q, (s, s, H * tr.uniform(.06, .09)), 'leaf', tr, subdiv=1, jitter=.25, crown=c,
                              blend=.6, shade=shade, flex=1.0)
        # The middle of the shelf, so the top reads as one broad flat lid.
        for k in range(3):
            p = c + drift(rng, R * .38)
            p.z = H * rng.uniform(.76, .8)
            s = R * rng.uniform(.24, .3)
            mesh.add_lump(p, (s, s, H * .08), 'leaf', rng, subdiv=2, jitter=.2, crown=c, blend=.75, shade=shade,
                          flex=.7, squash_bottom=.4)
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
    ('Blender_Palo_3', palo(7, 8, 2, 2)),
    ('Blender_Mesquite_1', mesquite(8, 9, 5, 2)),
    ('Blender_Mesquite_2', mesquite(7, 8.5, 5)),
    ('Blender_Mesquite_3', mesquite(9, 9.5, 5, 2)),
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
          far={n for n, _ in MODELS if 'Palo' in n or 'Mesquite' in n},
          # The sheet's colours for the two trees (the game paints the roles
          # itself): palo verde's bright yellow-green bones and haze; mesquite's
          # dark grey-brown bark under a darker, duller green.
          tints={**{f'Blender_Palo_{i}': {'leaf': (0.5, 0.66, 0.2), 'bark': (0.45, 0.62, 0.24)} for i in (1, 2, 3)},
                 **{f'Blender_Mesquite_{i}': {'leaf': (0.33, 0.46, 0.24), 'bark': (0.3, 0.26, 0.22)} for i in (1, 2, 3)}})
