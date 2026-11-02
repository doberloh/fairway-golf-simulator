# THE PACIFIC PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what Puget Sound and Redwood Coast lacked.
#
#   node tools/blender/iterate.mjs cartoon_pacific <round>     a round, beside the pictures
#   node tools/blender/run.mjs cartoon_pacific --render        the pack and its sheet
#
# Each model's spec and pictures are the study's models/<id>.md and
# photos/models/<id>/ (local); each model's rounds, one line a round, are
# tools/blender/logs/<id>.md. Built in the cartoon overhaul's hand (cartoon.py:
# crowns as clouds of soft lobes, trunks that flare and fork, vertex paint).
#
# REFS madrone=Blender_Madrone_1,Blender_Madrone_2
# REFS garryoak=Blender_GarryOak_1,Blender_GarryOak_2
# REFS bigleafmaple=Blender_BigleafMaple_1,Blender_BigleafMaple_2
# REFS pacificdogwood=Blender_PacificDogwood_1
# REFS baylaurel=Blender_BayLaurel_1,Blender_BayLaurel_2
# REFS vinemaple=Blender_VineMaple_1
# REFS oregongrape=Blender_OregonGrape_1
# REFS scotchbroom=Blender_ScotchBroom_1
# REFS pacificrhododendron=Blender_PacificRhododendron_1
# REFS douglasiris=Blender_DouglasIris_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def madrone(height, spread, stems):
    """Pacific madrone: two or three leaning, twisting stems of red-orange
    bark from one root, forking into crooked limbs; the crown is clumps on
    the limb ends with the red limbs showing between them (round 2: one cloud
    crown read as a lollipop)."""
    def build(mesh, rng):
        H = height
        ends = []
        for k in range(stems):
            a = k / stems * math.tau + rng.uniform(-.4, .4)
            lean = Vector((math.cos(a), math.sin(a), 0)) * H * rng.uniform(.1, .17)
            pts, radii = ct.trunk(mesh, rng, Vector((math.cos(a) * .2, math.sin(a) * .2, 0)), H * rng.uniform(.34, .42),
                                  H * .03, lean=lean, flare=1.4, sides=9, bend=H * .07)
            # Round 12, the cost pass: three limbs a stem when there are three.
            # Round 18, the second cost pass: three limbs a stem.
            for j in range(3):
                d = rng.uniform(-1.3, 1.3)
                b = a + d
                # Round 8: a limb along the stem's lean reaches highest, one
                # swung aside lower, so the crown domes.
                up = .42 - .24 * abs(d) / 1.3
                end = pts[-1] + Vector((math.cos(b) * spread * rng.uniform(.22, .38), math.sin(b) * spread * rng.uniform(.22, .38),
                                        H * up * rng.uniform(.85, 1.15)))
                ct.limb(mesh, rng, pts[-2], end, H * .016, H * .006, bow=.35, sides=6, shade=.95)
                ends.append(end)
        c = sum(ends, Vector()) / len(ends)
        shade = ct.crown_shade(c, (spread * .5, spread * .5, H * .3))
        for e in ends:
            s = spread * rng.uniform(.17, .24)
            ct.cloud_crown(mesh, rng, e + Vector((0, 0, H * .03)), (s, s, s * .95), lobes=3, lobe_size=(.52, .66),
                           flat_bottom=.45, shell=.65, core=False)
        # Round 3 joined the clumps with a broad upper layer and round 5 closed
        # the middle with a clump; round 10 dropped the upper layer -- it
        # flattened the top into a slab -- and raises the centre instead.
        ct.cloud_crown(mesh, rng, c + Vector((0, 0, H * .02)), (spread * .14, spread * .14, H * .12), lobes=3,
                       lobe_size=(.4, .55), flat_bottom=.45, shell=.72, core=False)
        for i in range(2):
            q = c + drift(rng, spread * .12) + Vector((0, 0, H * rng.uniform(.2, .28)))
            s = spread * rng.uniform(.16, .2)
            ct.cloud_crown(mesh, rng, q, (s, s, s * .85), lobes=3, lobe_size=(.5, .62), flat_bottom=.4, shell=.62, core=False)
        # Berries (autumn and winter; the accent role, drawn leaf-coloured in
        # spring and summer): small clusters over the crown's skin.
        for i in range(26):
            e = ends[rng.randrange(len(ends))]
            a2 = rng.uniform(0, math.tau)
            q = e + Vector((math.cos(a2) * spread * .2, math.sin(a2) * spread * .2, H * rng.uniform(.05, .12)))
            mesh.add_lump(q, (spread * .025, spread * .025, spread * .02), 'accent', rng, subdiv=0, jitter=.1, flex=.9,
                          shade=lambda w, n: 1.0)
    return build


def garryoak(height, spread, limbs):
    """Oregon white oak: a short heavy trunk, crooked limbs, a broad dense
    rounded crown that reaches low (round 2: separate flat clumps on thin
    legs read as an acacia)."""
    def build(mesh, rng):
        H = height
        fork = H * rng.uniform(.26, .3)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork, H * .075, lean=drift(rng, H * .03), flare=1.8,
                              sides=12, bend=H * .03)
        top = pts[-1]
        c = Vector((top.x, top.y, H * .6))
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.35, .35)
            reach = spread * .5 * rng.uniform(.5, .7)
            mid = top + Vector((math.cos(a) * reach * .5, math.sin(a) * reach * .5, H * rng.uniform(.08, .16)))
            end = top + Vector((math.cos(a) * reach, math.sin(a) * reach, H * rng.uniform(.25, .36)))
            ct.limb(mesh, rng, top, mid, H * .04, H * .025, bow=.15, sides=8)
            ct.limb(mesh, rng, mid, end, H * .025, H * .012, bow=.25, sides=6)
            s = spread * rng.uniform(.18, .3)
            # Round 12, the cost pass: five bigger lobes a clump, not eight.
            ct.cloud_crown(mesh, rng, end + Vector((0, 0, H * .02)), (s, s, s * .75), lobes=4, lobe_size=(.52, .66),
                           flat_bottom=.45, shell=.72, core=False)
        # Round 3: the central mass smaller and higher, so limbs show under it.
        ct.cloud_crown(mesh, rng, c + Vector((0, 0, H * .08)), (spread * .28, spread * .28, H * .18), lobes=6,
                       lobe_size=(.38, .52), flat_bottom=.45, shell=.8, core=False)
    return build


def bigleafmaple(height, spread):
    """Bigleaf maple: a heavy trunk and a tall, broad oval crown (round 2:
    the trunk was thin and the crown a squat ball)."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .4, H * .06, lean=drift(rng, H * .02), flare=1.4,
                              sides=12)
        top = pts[-1]
        for i in range(5):
            a = i / 5 * math.tau + rng.uniform(-.3, .3)
            end = top + Vector((math.cos(a) * spread * .3, math.sin(a) * spread * .3, H * .28))
            ct.limb(mesh, rng, pts[-2], end, H * .03, H * .012, bow=.15, sides=7)
        c = Vector((top.x, top.y, H * .63))
        ct.cloud_crown(mesh, rng, c, (spread * .48, spread * .46, H * .36), lobes=23, lobe_size=(.27, .39),
                       flat_bottom=.35, shell=.8)
        shade = ct.crown_shade(c, (spread * .48, spread * .46, H * .36))
        for i in range(3):
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * spread * .34, math.sin(a) * spread * .32, H * rng.uniform(.12, .3)))
            s = spread * rng.uniform(.13, .17)
            mesh.add_lump(p, (s, s, s * .85), 'leaf', rng, subdiv=3, jitter=.08, crown=c, blend=.8, shade=shade, flex=.9)
    return build


def bract(mesh, rng, at, size):
    """A dogwood's flower: four broad cream petals in a flat cross, each
    two triangles each way up (the game's materials are single-sided)."""
    turn = rng.uniform(0, math.tau)
    for k in range(4):
        a = turn + k * math.pi / 2
        out, side = Vector((math.cos(a), math.sin(a), .12)), Vector((-math.sin(a), math.cos(a), 0))
        quad = [at, at + out * size * .55 - side * size * .32, at + out * size, at + out * size * .55 + side * size * .32]
        for poly in (quad, list(reversed(quad))):
            f = mesh.face(poly, 'accent')
            for v in f.verts:
                mesh.paint[v] = (1.05, 1.05, 1.05, .9)


def dogwood(height, spread):
    """Pacific dogwood: a small tree of layered flat sprays, white with big
    bracts all over in spring (round 2: forty bracts on a ball read as a
    green tree with spots)."""
    def build(mesh, rng):
        H = height
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .62, H * .03, lean=drift(rng, H * .04), flare=1.4,
                              sides=8, shade_low=.9, shade_high=1.1)
        # Round 12, the cost pass (18,665 faces): three tiers of four sprays,
        # coarse flat lobes, each bract four flat petals rather than a sphere.
        tiers = 3
        for t in range(tiers):
            z = H * (.4 + .2 * t)
            w = spread * (.5 - .09 * t)
            j = min(len(pts) - 1, int((z / (H * .62)) * (len(pts) - 1)))
            for k in range(4):
                a = k / 4 * math.tau + t * .7 + rng.uniform(-.3, .3)
                end = Vector((pts[j].x + math.cos(a) * w * .8, pts[j].y + math.sin(a) * w * .8, z + H * .03))
                ct.limb(mesh, rng, pts[j], end, H * .01, H * .004, bow=.05, sides=5)
                s = w * .56
                c = end + Vector((0, 0, H * .01))
                # Round 13: six lobes a spray, rounder, so the crown is full.
                ct.cloud_crown(mesh, rng, c, (s, s, s * .45), lobes=6, lobe_size=(.48, .62), flat_bottom=.5, shell=.62, core=False, subdiv=1)
                # The bracts lie on the spray's top: flat white stars.
                for b in range(10):
                    e = rng.uniform(0, math.tau)
                    r = rng.uniform(.3, 1.0)
                    # Round 17: a third on the spray's rim, seen from the side.
                    if b % 3 == 0:
                        r = rng.uniform(.95, 1.1)
                        q = c + Vector((math.cos(e) * s * r, math.sin(e) * s * r, s * rng.uniform(-.05, .12)))
                    else:
                        q = c + Vector((math.cos(e) * s * r, math.sin(e) * s * r, s * .22 + s * .3 * (1.05 - r)))
                    bract(mesh, rng, q, spread * .078)  # round 16: half as big again
    return build


def baylaurel(height, spread, stems):
    """California bay laurel: several stems leaning out from one root under a
    broad dense dome that comes down nearly to the ground (round 2: a ball
    on short stems read as a lollipop)."""
    def build(mesh, rng):
        H = height
        for k in range(stems):
            a = k / stems * math.tau + rng.uniform(-.5, .5)
            ct.trunk(mesh, rng, Vector((math.cos(a) * .3, math.sin(a) * .3, 0)), H * .4, H * .03,
                     lean=Vector((math.cos(a), math.sin(a), 0)) * H * .16, flare=1.4, sides=8, bend=H * .03)
        c = Vector((0, 0, H * .46)) + drift(rng, spread * .08)
        ct.cloud_crown(mesh, rng, c, (spread * .56, spread * .5, H * .4), lobes=24, lobe_size=(.24, .36),
                       flat_bottom=.15, shell=.88)
        shade = ct.crown_shade(c, (spread * .56, spread * .5, H * .4))
        for i in range(4):
            a = rng.uniform(0, math.tau)
            p = c + Vector((math.cos(a) * spread * .45, math.sin(a) * spread * .4, H * rng.uniform(-.25, .3)))
            s = spread * rng.uniform(.1, .14)
            mesh.add_lump(p, (s, s, s * .85), 'leaf', rng, subdiv=3, jitter=.08, crown=c, blend=.8, shade=shade, flex=.9)
    return build


def vinemaple(height, spread):
    """Vine maple: a full rounded mass of leaves on many slender stems
    (round 2: seven sticks with a tuft each read as a bonsai). Round 12, the
    cost pass (6,918 faces): eight stems, each clump three big lobes, and a
    crown of a few large lobes over them so the top stays rounded."""
    def build(mesh, rng):
        H = height
        for k in range(8):
            a = k * ct.GOLDEN + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            end = out * spread * rng.uniform(.22, .46) + Vector((0, 0, H * rng.uniform(.45, .88)))
            ct.limb(mesh, rng, out * spread * .06, end, H * .018, H * .007, bow=.35, sides=5)
            s = spread * rng.uniform(.19, .24)
            ct.cloud_crown(mesh, rng, end, (s, s, s * .8), lobes=3, lobe_size=(.55, .7), flat_bottom=.4, shell=.6,
                           core=False, subdiv=1)
        ct.cloud_crown(mesh, rng, Vector((0, 0, H * .7)), (spread * .3, spread * .3, H * .22), lobes=5,
                       lobe_size=(.45, .6), flat_bottom=.4, shell=.7, core=False, subdiv=1)
    return build


def oregongrape(height, spread):
    """Oregon grape: upright leafy clumps, yellow flower clusters on top.
    Round 12, the cost pass (4,300 faces): four clumps of four lobes, the
    flowers as twenty-face lumps."""
    def build(mesh, rng):
        H = height
        for k in range(4):
            a = k / 4 * math.tau + rng.uniform(-.4, .4)
            p = Vector((math.cos(a) * spread * .2, math.sin(a) * spread * .2, H * rng.uniform(.38, .52)))
            ct.cloud_crown(mesh, rng, p, (spread * .28, spread * .28, H * .42), lobes=4, lobe_size=(.42, .58),
                           flat_bottom=.6, shell=.75, jitter=.25, core=False)
        for k in range(15):
            a = rng.uniform(0, math.tau)
            r = rng.uniform(.1, .38)
            p = Vector((math.cos(a) * spread * r, math.sin(a) * spread * r, H * rng.uniform(.55, .98)))
            mesh.add_lump(p, (spread * .055, spread * .055, H * .08), 'accent', rng, subdiv=0, jitter=.15, flex=.9,
                          shade=lambda w, n: 1.0)
    return build


def scotchbroom(height, spread):
    """Scotch broom: a rounded mound of fine green switches solid with small
    yellow flowers (round 2: fourteen thick switches read as a torch; round
    4: the switches end on a dome). Round 12, the cost pass (6,312 faces):
    twenty-eight switches, four flower lumps each of twenty faces."""
    def build(mesh, rng):
        H = height
        for k in range(22):
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            out = Vector((math.cos(a), math.sin(a), 0))
            el = math.radians(rng.uniform(18, 85))
            end = out * spread * .55 * math.cos(el) + Vector((0, 0, H * .95 * math.sin(el)))
            ct.limb(mesh, rng, out * .04, end, H * .007, H * .003, bow=.45, sides=4, shade=.9)
            for j in range(4):
                t = .35 + j * .18
                p = (out * .04).lerp(end, t) + Vector((0, 0, H * .02))
                s = spread * .085
                mesh.add_lump(p, (s, s, s * 1.1), 'accent', rng, subdiv=0, jitter=.15, flex=.8, shade=lambda w, n: 1.0)
        ct.cloud_crown(mesh, rng, Vector((0, 0, H * .45)), (spread * .3, spread * .3, H * .3), lobes=5,
                       lobe_size=(.4, .55), flat_bottom=.5, shell=.7, core=False, subdiv=1)
    return build


def rhododendron(height, spread):
    """Pacific rhododendron: leggy stems up to whorls of leaves, pink trusses
    (round 2: one pom-pom a stick; round 4: stems splay from the base).
    Round 12, the cost pass (9,384 faces): six stems, coarse whorl lobes,
    two trusses a stem."""
    def build(mesh, rng):
        H = height
        for k in range(6):
            a = k * ct.GOLDEN + rng.uniform(-.4, .4)
            out = Vector((math.cos(a), math.sin(a), 0))
            end = out * spread * rng.uniform(.3, .5) + Vector((0, 0, H * rng.uniform(.45, .9)))
            ct.limb(mesh, rng, out * spread * .08, end, H * .014, H * .007, bow=.3, sides=5)
            # Round 13: rounder, smaller whorls (they flattened into lily pads).
            s = spread * .22
            ct.cloud_crown(mesh, rng, end, (s, s, s * .8), lobes=6, lobe_size=(.45, .6), flat_bottom=.4, shell=.72,
                           core=False, subdiv=1)
            # Round 14: a second whorl partway up every stem, leaves down the
            # bush rather than umbrellas on bare stems.
            low = (out * spread * .08).lerp(end, rng.uniform(.45, .6))
            ct.cloud_crown(mesh, rng, low, (s * .8, s * .8, s * .6), lobes=4, lobe_size=(.5, .62), flat_bottom=.4,
                           shell=.6, core=False, subdiv=1)
            for t in range(2):
                b = rng.uniform(0, math.tau)
                q = end + Vector((math.cos(b) * s * .5, math.sin(b) * s * .5, s * .5))
                mesh.add_lump(q, (s * .28, s * .28, s * .25), 'accent', rng, subdiv=1, jitter=.12, flex=.9,
                              shade=lambda w, n: 1.0)
    return build


def douglasiris(height, spread):
    """Douglas iris: a dense clump of arching grassy leaves, lavender flowers
    among the leaf tips. Round 12, the cost pass: the flowers' petals as
    twenty-face lumps, six flowers."""
    def build(mesh, rng):
        H = height
        for k in range(3):
            a = k / 3 * math.tau
            ct.tuft(mesh, rng, Vector((math.cos(a) * spread * .12, math.sin(a) * spread * .12, 0)), blades=13,
                    height=H * .85, width=.014, spread=spread * .8, lean=.75, low='leaf', tip='leaf')
        for k in range(6):
            a = rng.uniform(0, math.tau)
            p = Vector((math.cos(a) * spread * .3, math.sin(a) * spread * .3, H * rng.uniform(.55, .72)))
            for f in range(3):
                b = f / 3 * math.tau + a
                q = p + Vector((math.cos(b) * .022, math.sin(b) * .022, -.01))
                mesh.add_lump(q, (.034, .02, .01), 'accent', rng, subdiv=0, jitter=.1, flex=.9, shade=lambda w, n: 1.0)
    return build


MODELS = [
    ('Blender_Madrone_1', madrone(14, 13.5, 3)),
    ('Blender_Madrone_2', madrone(11, 11, 2)),
    ('Blender_GarryOak_1', garryoak(15, 18.5, 5)),
    ('Blender_GarryOak_2', garryoak(12, 15, 6)),
    ('Blender_BigleafMaple_1', bigleafmaple(22, 19.5)),
    ('Blender_BigleafMaple_2', bigleafmaple(18, 15)),
    ('Blender_PacificDogwood_1', dogwood(9, 7)),
    ('Blender_BayLaurel_1', baylaurel(15, 13, 3)),
    ('Blender_BayLaurel_2', baylaurel(11, 10, 2)),
    ('Blender_VineMaple_1', vinemaple(4, 5)),
    ('Blender_OregonGrape_1', oregongrape(1.2, 1.0)),
    ('Blender_ScotchBroom_1', scotchbroom(2.0, 2.6)),
    ('Blender_PacificRhododendron_1', rhododendron(4, 3)),
    ('Blender_DouglasIris_1', douglasiris(.35, .4)),
]

# THE SHEET'S COLOURS BY SEASON (iterate.mjs --season; the study's models/<id>.md
# *Seasons*, hex as written there). The game paints the roles from the
# species tables; these make the sheet show what each season will look like
# so a model is judged in autumn as well as summer. An accent with no
# flowers that season is drawn the leaf's colour.
SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'Madrone': '#a8452a', 'GarryOak': '#6f6a60', 'BigleafMaple': '#6a6656', 'PacificDogwood': '#8a8478',
        'BayLaurel': '#6c6a58', 'VineMaple': '#7a7448', 'ScotchBroom': '#4f7436', 'PacificRhododendron': '#6a5040'}
# species: {season: (leaf, accent)}; None keeps the role's summer colour.
LOOK = {
    'Madrone': {'spring': ('#3f6e3a', '#f2eedc'), 'summer': ('#3a6a36', '#3a6a36'), 'autumn': ('#3a6436', '#d8502a'), 'winter': ('#355f33', '#c8402a')},
    'GarryOak': {'spring': ('#8fae55', None), 'summer': ('#4f7436', None), 'autumn': ('#8a6a32', None), 'winter': ('#4f7436', None)},
    'BigleafMaple': {'spring': ('#a6c45e', None), 'summer': ('#4f7e36', None), 'autumn': ('#d6b03a', None), 'winter': ('#4f7e36', None)},
    'PacificDogwood': {'spring': ('#557e3a', '#f1ede0'), 'summer': ('#557e3a', '#557e3a'), 'autumn': ('#b2443a', '#b2443a'), 'winter': ('#557e3a', '#557e3a')},
    'BayLaurel': {'spring': ('#5b7a3e', None), 'summer': ('#4f7036', None), 'autumn': ('#4f7036', None), 'winter': ('#56743a', None)},
    'VineMaple': {'spring': ('#a6c46a', None), 'summer': ('#5a8a3c', None), 'autumn': ('#c8402e', None), 'winter': ('#5a8a3c', None)},
    'OregonGrape': {'spring': ('#3f6234', '#e0c03a'), 'summer': ('#3f6234', '#4a5a8a'), 'autumn': ('#6a4a3a', '#4a5a8a'), 'winter': ('#6a3e3a', '#6a3e3a')},
    'ScotchBroom': {'spring': ('#4f7436', '#e8c830'), 'summer': ('#4f7436', '#4f7436'), 'autumn': ('#4f7436', '#4f7436'), 'winter': ('#4a6e34', '#4a6e34')},
    'PacificRhododendron': {'spring': ('#3f6234', '#d27aa8'), 'summer': ('#3f6234', '#3f6234'), 'autumn': ('#3f6234', '#3f6234'), 'winter': ('#3c5e32', '#3c5e32')},
    'DouglasIris': {'spring': ('#5a7a42', '#8a6ac8'), 'summer': ('#5a7a42', '#5a7a42'), 'autumn': ('#6a7a4a', '#6a7a4a'), 'winter': ('#5a7a42', '#5a7a42')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        leaf, accent = LOOK[sp][season]
        t = {'leaf': hexrgb(leaf)}
        if accent:
            t['accent'] = hexrgb(accent)
        if sp in BARK:
            t['bark'] = hexrgb(BARK[sp])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.55, 0.28, 0.18), 'accent': (0.95, 0.88, 0.6)},
          far={'Blender_Madrone_1', 'Blender_Madrone_2', 'Blender_GarryOak_1', 'Blender_GarryOak_2',
               'Blender_BigleafMaple_1', 'Blender_BigleafMaple_2', 'Blender_BayLaurel_1', 'Blender_BayLaurel_2'},
          tints=tints(SEASON))
