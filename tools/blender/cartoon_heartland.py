# THE HEARTLAND PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what Heartland lacked -- the American elm's vase, the
# shagbark hickory, the open-grown bur oak, prairie flowers, a corn patch
# and a red barn with its silo.
#
#   node tools/blender/iterate.mjs cartoon_heartland <round> [--season s] [--far]
#
# REFS americanelm=Blender_AmericanElm_1,Blender_AmericanElm_2
# REFS shagbarkhickory=Blender_Shagbark_1,Blender_Shagbark_2
# REFS buroak=Blender_BurOak_1,Blender_BurOak_2
# REFS prairieforbs=Blender_PrairieForbs_1
# REFS cornfield=Blender_CornPatch_1
# REFS redbarn=Blender_RedBarn_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def two_sided(mesh, pts, role, shade=1.0, flex=0.0, normal=UP):
    """A flat polygon drawn from both sides (a leaf blade, a petal star)."""
    for poly in (pts, list(reversed(pts))):
        f = mesh.face(poly, role, smooth=True)
        for v in f.verts:
            s = shade(v.co) if callable(shade) else shade
            fl = flex(v.co) if callable(flex) else flex
            mesh.paint[v] = (s, s, s, fl)
            mesh.normal[v] = normal


def facing(mesh, pts, role, out, shade=1.0):
    """A one-sided polygon wound so its front faces `out` (buildings)."""
    n = Vector((0, 0, 0))
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n += a.cross(b)
    if n.dot(out) < 0:
        pts = list(reversed(pts))
    f = mesh.face(pts, role)
    for v in f.verts:
        s = shade if isinstance(shade, tuple) else (shade, shade, shade)
        mesh.paint[v] = (*s, 0.0)
    return f


def elm(height, spread, limbs):
    """American elm: a short trunk dividing low into several limbs that rise
    in a vase and arch outward, the crown an umbrella wider at the top whose
    edges hang down the sides."""
    def build(mesh, rng):
        H, S = height, spread
        fork = H * rng.uniform(.16, .2)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork, H * .05, lean=drift(rng, H * .01), flare=1.7,
                              sides=9)
        top = pts[-1]
        foot = Vector((top.x, top.y, 0))
        cc, cr = Vector((top.x, top.y, H * .8)), (S * .5, S * .5, H * .18)
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.2, .2)
            out = Vector((math.cos(a), math.sin(a), 0))
            # One limb sweeping up and out from the low fork ...
            split = top + out * S * .22 + Vector((0, 0, H * .44))
            ct.limb(mesh, rng, top, split, H * .025, H * .013, bow=.16, sides=6)
            # ... dividing into two that arch out to the umbrella's rim.
            for sgn in (-1, 1):
                b = a + sgn * rng.uniform(.22, .36)
                o2 = Vector((math.cos(b), math.sin(b), 0))
                tip = foot + o2 * S * rng.uniform(.4, .45) + Vector((0, 0, H * rng.uniform(.72, .77)))
                ct.limb(mesh, rng, split, tip, H * .011, H * .004, bow=.12, sides=4)
                leafy(mesh, rng, tip + Vector((0, 0, H * .03)), (S * .12, S * .12, H * .085), cc, cr)
            # The rim hangs a little between each pair, and the canopy arches over.
            leafy(mesh, rng, foot + out * S * .44 + Vector((0, 0, H * .7)), (S * .1, S * .1, H * .08), cc, cr)
            leafy(mesh, rng, foot + out * S * .25 + Vector((0, 0, H * .84)), (S * .14, S * .14, H * .08), cc, cr)
        for k in range(2):
            leafy(mesh, rng, foot + drift(rng, S * .08) + Vector((0, 0, H * .9)), (S * .15, S * .15, H * .075), cc, cr)
    return build


def leafy(mesh, rng, centre, radii, cc, cr, squash=.35):
    """One soft lobe of a crown built from parts, lit and bent as one body
    about the crown's centre `cc` (radii `cr`)."""
    mesh.add_lump(centre, radii, 'leaf', rng, subdiv=3, jitter=.12, crown=cc, blend=.7, shade=ct.crown_shade(cc, cr),
                  flex=lambda w: min(1.0, .45 + .55 * (w - cc).length / max(cr[0], cr[2])), squash_bottom=squash)


def shagbark(height, spread):
    """Shagbark hickory: a tall straight trunk of long shaggy plates curling
    away, a narrow oval crown down to a third of the height, ragged sides."""
    def build(mesh, rng):
        H, S = height, spread
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .94, H * .034, lean=drift(rng, H * .008), flare=1.4,
                              sides=8)
        # The shaggy plates: long thin strips standing off the trunk.
        for k in range(14):
            t = rng.uniform(.05, .4)
            i = int(t * (len(pts) - 1))
            p, r = pts[i], radii[i]
            a = rng.uniform(0, math.tau)
            d = Vector((math.cos(a), math.sin(a), 0))
            mesh.add_lump(p + d * r * 1.0 + Vector((0, 0, H * .03)), (r * .28, r * .28, H * .06), 'bark', rng, subdiv=0,
                          jitter=.05, shade=lambda w, n: .62)
        lean = pts[-1] - pts[0]
        def axis(z):
            return Vector((lean.x * z / pts[-1].z, lean.y * z / pts[-1].z, z))
        cc, cr = axis(H * .72), (S * .5, S * .5, H * .28)
        # The crown only on the upper half: short level branches up the
        # leader, alternating sides, each holding a clump, sky between.
        levels = 8
        for k in range(levels):
            z = H * (.43 + .066 * k + rng.uniform(-.022, .022))
            a = k * 2.4 + rng.uniform(-.9, .9)
            out = Vector((math.cos(a), math.sin(a), 0))
            base = axis(z)
            reach = S * rng.uniform(.27, .38) * (1 - .3 * k / levels)
            end = base + out * reach + Vector((0, 0, H * .025))
            ct.limb(mesh, rng, base, end, H * .009, H * .004, bow=.05, sides=4)
            leafy(mesh, rng, end, (S * .22, S * .22, H * .08), cc, cr)
            leafy(mesh, rng, base + out * reach * .45 + Vector((0, 0, H * .045)), (S * .2, S * .2, H * .075), cc, cr)
        for z in (.9, .97):
            leafy(mesh, rng, axis(H * z) + drift(rng, S * .05), (S * .17, S * .17, H * .07), cc, cr)
    return build


def buroak(height, spread, limbs):
    """Bur oak, open-grown on the prairie: a massive short trunk, thick corky
    limbs reaching out and up crookedly, a broad rugged dome of masses."""
    def build(mesh, rng):
        H, S = height, spread
        fork = H * rng.uniform(.27, .31)
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), fork, H * .09, lean=drift(rng, H * .02), flare=1.8,
                              sides=9, bend=H * .02)
        top = pts[-1]
        cc, cr = Vector((top.x, top.y, H * .62)), (S * .5, S * .5, H * .3)
        for i in range(limbs):
            a = i / limbs * math.tau + rng.uniform(-.3, .3)
            out = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-out.y, out.x, 0))
            lvl = rng.uniform(0, .1)
            # Heavy limbs out nearly level, then crooked upward at the end.
            mid = top + out * S * .2 + side * S * rng.uniform(-.04, .04) + Vector((0, 0, H * (.05 + lvl)))
            end = top + out * S * .4 + side * S * rng.uniform(-.06, .06) + Vector((0, 0, H * (.06 + lvl + rng.uniform(0, .16))))
            ct.limb(mesh, rng, top, mid, H * .05, H * .034, bow=.03, sides=7)
            ct.limb(mesh, rng, mid, end, H * .034, H * .012, bow=.12, sides=5)
            rise = mid + out * S * .05 + side * S * rng.uniform(-.05, .05) + Vector((0, 0, H * .3))
            ct.limb(mesh, rng, mid, rise, H * .02, H * .006, bow=.1, sides=4)
            # Ragged clumps sitting on the limbs, the limbs showing under them.
            leafy(mesh, rng, end + Vector((0, 0, H * .07)), (S * .1, S * .1, H * .1), cc, cr)
            leafy(mesh, rng, end - out * S * .08 + side * S * .06 + Vector((0, 0, H * .13)), (S * .085, S * .085, H * .09), cc, cr)
            leafy(mesh, rng, rise + Vector((0, 0, H * .04)), (S * .095, S * .095, H * .095), cc, cr)
            leafy(mesh, rng, mid + out * S * .1 - side * S * .06 + Vector((0, 0, H * .17)), (S * .08, S * .08, H * .085), cc, cr)
        for k in range(3):
            leafy(mesh, rng, cc + drift(rng, S * .12) + Vector((0, 0, H * .2)), (S * .11, S * .11, H * .09), cc, cr)
    return build


def star(mesh, centre, r, role, points, droop, shade, tilt=Vector((0, 0, 0))):
    """A flower head as a flat star of petals, drooping at the tips."""
    ring = []
    for k in range(points * 2):
        b = k / (points * 2) * math.tau
        rr = r if k % 2 == 0 else r * .42
        z = -droop * (rr / r) ** 2
        ring.append(centre + Vector((math.cos(b) * rr, math.sin(b) * rr, z)) + tilt * (rr / r))
    for a, b in zip(ring, ring[1:] + ring[:1]):
        two_sided(mesh, [centre, a, b], role, shade=shade, flex=.95)


def prairieforbs(height, spread):
    """Prairie flowers in a clump: purple coneflowers (drooping petals round a
    dark cone), gold black-eyed Susans, blazing-star spikes and a goldenrod
    plume, in grass. Purple is the accent, gold the stone role, the cones
    bark."""
    def build(mesh, rng):
        H, W = height, spread
        ct.tuft(mesh, rng, Vector((0, 0, 0)), blades=16, height=H * .55, width=.022, spread=W * .7, lean=.45,
                low='leaf', tip='leaf')
        def stem(top):
            mesh.add_tube([Vector((top.x * .2, top.y * .2, 0)), top], [.006, .003], 4, 'leaf',
                          flex=lambda co, t: .3 + .7 * t, cap_end=False)
        # Coneflowers (accent petals hanging down round a dark cone).
        for k in range(4):
            a = k / 4 * math.tau + rng.uniform(-.4, .4)
            top = Vector((math.cos(a) * W * .3, math.sin(a) * W * .3, H * rng.uniform(.64, .82)))
            stem(top)
            mesh.add_lump(top + Vector((0, 0, .012)), (.018, .018, .02), 'bark', rng, subdiv=0, jitter=.05, flex=.95,
                          shade=lambda w, n: .5)
            star(mesh, top, .045, 'accent', 7, .03, 1.0)
        # Black-eyed Susans (gold, flat, a dark eye).
        for k in range(5):
            a = k / 5 * math.tau + 1.0 + rng.uniform(-.4, .4)
            top = Vector((math.cos(a) * W * .4, math.sin(a) * W * .4, H * rng.uniform(.46, .62)))
            stem(top)
            mesh.add_lump(top + Vector((0, 0, .006)), (.012, .012, .01), 'bark', rng, subdiv=0, jitter=.05, flex=.95,
                          shade=lambda w, n: .45)
            star(mesh, top, .038, 'stone', 7, .008, 1.05)
        # Blazing star: two purple spikes standing above the rest.
        for k in range(2):
            a = rng.uniform(0, math.tau)
            b = Vector((math.cos(a) * W * .12, math.sin(a) * W * .12, 0))
            mid = b + Vector((0, 0, H * .52))
            stem(mid)
            mesh.add_tube([mid, mid + Vector((0, 0, H * .22)), mid + Vector((0, 0, H * .42))], [.022, .018, .006], 6,
                          'accent', flex=lambda co, t: .6 + .4 * t, shade=lambda co, t: .85 + .3 * t)
        # A goldenrod plume, arching.
        p = Vector((W * .22, -W * .2, 0))
        stem(p + Vector((0, 0, H * .7)))
        for j in range(6):
            q = p + Vector((.025 * j + rng.uniform(-.015, .015), -.008 * j, H * (.66 + .045 * j - .005 * j * j)))
            mesh.add_lump(q, (.028, .02, .024), 'stone', rng, subdiv=0, jitter=.2, flex=.95, shade=lambda w, n: 1.15)
    return build


def cornpatch(rows, plants, gap, height):
    """A patch of standing corn: rows 0.76 m apart, tall stalks, long strap
    leaves arching out and down, a pale tassel on top -- what the farmland
    beside the course is made of. Rows run along Y."""
    def build(mesh, rng):
        for r in range(rows):
            for k in range(plants):
                p = Vector(((r - (rows - 1) / 2) * .76 + rng.uniform(-.04, .04),
                            (k - (plants - 1) / 2) * gap + rng.uniform(-.06, .06), 0))
                h = height * rng.uniform(.9, 1.06)
                mesh.add_tube([p, p + Vector((0, 0, h))], [.03, .014], 4, 'leaf', flex=lambda co, t: .15 + .5 * t,
                              shade=lambda co, t: .7 + .35 * t, cap_end=False)
                for j in range(5):
                    a = j * 2.4 + rng.uniform(-.5, .5)
                    out = Vector((math.cos(a), math.sin(a), 0))
                    side = Vector((-out.y, out.x, 0))
                    z = h * (.2 + .13 * j)
                    L = 1.0 - .07 * j
                    base = p + Vector((0, 0, z))
                    mid = base + out * L * .5 + Vector((0, 0, L * .22))
                    tip = base + out * L + Vector((0, 0, -L * .12))
                    w = .065
                    sh = lambda co, b=base.z: .7 + .4 * min(1, co.z / max(h, .1))
                    two_sided(mesh, [base - side * .015, base + side * .015, mid + side * w, mid - side * w], 'leaf',
                              shade=sh, flex=lambda co: .3 + .6 * min(1, co.z / h))
                    two_sided(mesh, [mid - side * w, mid + side * w, tip], 'leaf', shade=sh, flex=.9)
                t0 = p + Vector((0, 0, h))
                for j in range(2):
                    a = j * 1.6 + rng.uniform(0, 3)
                    d = Vector((math.cos(a), math.sin(a), 0)) * .03
                    two_sided(mesh, [t0 - d, t0 + d, t0 + Vector((d.y * 3, -d.x * 3, .32))], 'accent', shade=1.0,
                              flex=.9)
    return build


def redbarn():
    """A red gambrel barn, 12 m wide and 20 m long, with white trim, a hay
    door and a cupola, and a concrete stave silo with a grey dome beside it.
    Walls the accent (red), trim stone (white), roof bark (grey); the silo is
    stone painted down to concrete tan. Its front (the big doors) faces -Y."""
    def build(mesh, rng):
        W, D, H = 12.0, 20.0, 4.8
        x0, x1, y0, y1 = -W / 2, W / 2, -D / 2, D / 2
        V = Vector
        corners = [V((x0, y0, 0)), V((x1, y0, 0)), V((x1, y1, 0)), V((x0, y1, 0))]
        outs = [V((0, -1, 0)), V((1, 0, 0)), V((0, 1, 0)), V((-1, 0, 0))]
        for i in range(4):
            j = (i + 1) % 4
            facing(mesh, [corners[i], corners[j], corners[j] + V((0, 0, H)), corners[i] + V((0, 0, H))], 'accent',
                   outs[i])
        # The gambrel: a steep lower pitch and a shallow upper one each side.
        knee, ridge = 3.9, 5.9
        prof = [(x0 - .35, H - .25), (x0 + 1.1, H + knee), (0, H + ridge), (x1 - 1.1, H + knee), (x1 + .35, H - .25)]
        for (ax, az), (bx, bz) in zip(prof, prof[1:]):
            q = [V((ax, y0 - .5, az)), V((bx, y0 - .5, bz)), V((bx, y1 + .5, bz)), V((ax, y1 + .5, az))]
            n = V((bz - az, 0, -(bx - ax))) if ax < bx else V((-(bz - az), 0, bx - ax))
            if n.z < 0:
                n = -n
            facing(mesh, q, 'bark', n)
            facing(mesh, q, 'bark', -n, shade=.6)
        for y, out in ((y0, V((0, -1, 0))), (y1, V((0, 1, 0)))):
            gable = [V((x0, y, H)), V((x1, y, H)), V((x1 - 1.1, y, H + knee)), V((0, y, H + ridge)),
                     V((x0 + 1.1, y, H + knee))]
            facing(mesh, gable, 'accent', out)
            o = out * .08
            # White trim under the roof's edge, down the corners.
            edge = [V((x0 - .3, y, H - .2)), V((x0 + 1.1, y, H + knee - .05)), V((0, y, H + ridge - .1)),
                    V((x1 - 1.1, y, H + knee - .05)), V((x1 + .3, y, H - .2))]
            mesh.add_tube([e + out * .45 for e in edge], [.16] * 5, 4, 'stone', shade=lambda co, t: 1.1)
            for x in (x0, x1):
                mesh.add_tube([V((x, y, 0)) + o, V((x, y, H)) + o], [.14, .14], 4, 'stone', shade=lambda co, t: 1.1)
            # The big doors: a white frame and a white X.
            dw, dh = 2.6, 4.0
            fr = [V((-dw, y, 0)), V((-dw, y, dh)), V((dw, y, dh)), V((dw, y, 0))]
            mesh.add_tube([f + o for f in fr], [.12] * 4, 4, 'stone', shade=lambda co, t: 1.1)
            for a, b in ((V((-dw, y, 0)), V((dw, y, dh))), (V((-dw, y, dh)), V((dw, y, 0)))):
                mesh.add_tube([a + o, b + o], [.1, .1], 4, 'stone', shade=lambda co, t: 1.1)
            mesh.add_tube([V((0, y, 0)) + o, V((0, y, dh)) + o], [.08, .08], 4, 'stone', shade=lambda co, t: 1.1)
            # The hay door up in the gable, framed white.
            hz = H + 1.6
            hd = [V((-1.0, y, hz)), V((-1.0, y, hz + 2.0)), V((1.0, y, hz + 2.0)), V((1.0, y, hz))]
            mesh.add_tube([h + o for h in hd] + [hd[0] + o], [.1] * 5, 4, 'stone', shade=lambda co, t: 1.1)
            # The hay hood: a little peaked roof standing out over the hay door.
            pk, ex = V((0, y, hz + 3.0)), out * 1.0
            for sx in (-1, 1):
                q = [pk, pk + ex, V((1.35 * sx, y, hz + 2.25)) + ex, V((1.35 * sx, y, hz + 2.25))]
                facing(mesh, q, 'bark', V((sx * .6, 0, 1)))
                facing(mesh, q, 'bark', V((-sx * .6, 0, -1)), shade=.6)
        # Windows down the long sides: white squares, dark panes.
        for x, out in ((x0, V((-1, 0, 0))), (x1, V((1, 0, 0)))):
            for yy in (-6.5, -2.2, 2.2, 6.5):
                fx = x + out.x * .05
                facing(mesh, [V((fx, yy - .55, 2.0)), V((fx, yy + .55, 2.0)), V((fx, yy + .55, 3.1)), V((fx, yy - .55, 3.1))],
                       'stone', out, shade=1.1)
                gx = x + out.x * .08
                facing(mesh, [V((gx, yy - .38, 2.17)), V((gx, yy + .38, 2.17)), V((gx, yy + .38, 2.93)), V((gx, yy - .38, 2.93))],
                       'bark', out, shade=.45)
        # A cupola on the ridge.
        cz = H + ridge - .25
        for i, (a, b, out) in enumerate(((V((-.8, -.8, 0)), V((.8, -.8, 0)), V((0, -1, 0))), (V((.8, -.8, 0)), V((.8, .8, 0)), V((1, 0, 0))),
                                         (V((.8, .8, 0)), V((-.8, .8, 0)), V((0, 1, 0))), (V((-.8, .8, 0)), V((-.8, -.8, 0)), V((-1, 0, 0))))):
            facing(mesh, [a + V((0, 0, cz)), b + V((0, 0, cz)), b + V((0, 0, cz + 1.4)), a + V((0, 0, cz + 1.4))], 'stone', out,
                   shade=1.05)
            apex = V((0, 0, cz + 2.4))
            facing(mesh, [a * 1.3 + V((0, 0, cz + 1.3)), b * 1.3 + V((0, 0, cz + 1.3)), apex], 'bark', out + V((0, 0, 1)))
        # The silo: concrete staves (stone, painted tan), a grey dome.
        s = V((x1 + 3.6, y0 + 5.0, 0))
        ring = [s + V((0, 0, z)) for z in (0, 4, 8, 12, 16)]
        mesh.add_tube(ring, [2.6] * 5, 14, 'stone', shade=lambda co, t: (.74 + .06 * t, .65 + .06 * t, .5 + .05 * t))
        for z in (2.5, 5.5, 8.5, 11.5, 14.5):
            mesh.add_tube([s + V((0, 0, z)), s + V((0, 0, z + .25))], [2.66, 2.66], 14, 'stone',
                          shade=lambda co, t: (.52, .46, .38), cap_end=False)
        mesh.add_tube([s + V((0, 0, 16)), s + V((0, 0, 17.1)), s + V((0, 0, 18.0)), s + V((0, 0, 18.4))],
                      [2.7, 2.2, 1.1, .25], 14, 'stone', shade=lambda co, t: (.66, .67, .7))
        # A lean-to shed along the -X side, its roof running down from the eaves.
        lx, ly0, ly1, lo, hi = x0 - 5.0, -6.0, 6.0, 3.0, H - .5
        facing(mesh, [V((lx, ly0, 0)), V((lx, ly1, 0)), V((lx, ly1, lo)), V((lx, ly0, lo))], 'accent', V((-1, 0, 0)))
        for y, out in ((ly0, V((0, -1, 0))), (ly1, V((0, 1, 0)))):
            facing(mesh, [V((lx, y, 0)), V((x0, y, 0)), V((x0, y, hi)), V((lx, y, lo))], 'accent', out)
            mesh.add_tube([V((lx - .3, y, lo - .1)) + out * .35, V((x0, y, hi + .05)) + out * .35], [.12, .12], 4, 'stone',
                          shade=lambda co, t: 1.1)
        rq = [V((lx - .4, ly0 - .35, lo - .1)), V((x0, ly0 - .35, hi + .1)), V((x0, ly1 + .35, hi + .1)), V((lx - .4, ly1 + .35, lo - .1))]
        facing(mesh, rq, 'bark', V((-.4, 0, 1)))
        facing(mesh, rq, 'bark', V((.4, 0, -1)), shade=.6)
    return build


MODELS = [
    ('Blender_AmericanElm_1', elm(26, 22, 6)),
    ('Blender_AmericanElm_2', elm(23, 19, 5)),
    ('Blender_Shagbark_1', shagbark(24, 10)),
    ('Blender_Shagbark_2', shagbark(21, 9)),
    ('Blender_BurOak_1', buroak(20, 28, 6)),
    ('Blender_BurOak_2', buroak(18, 25, 5)),
    ('Blender_PrairieForbs_1', prairieforbs(.9, .5)),
    ('Blender_CornPatch_1', cornpatch(5, 13, .37, 2.4)),
    ('Blender_RedBarn_1', redbarn()),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# Each species' role colours by season, from the study's models/<id>.md
# *Seasons* (the deciduous trees are drawn in leaf in winter for now; their
# bare variants come with the seasons step).
BARK = {'AmericanElm': '#6a665e', 'Shagbark': '#7a746a', 'BurOak': '#5e5850', 'PrairieForbs': '#3a2a20'}
LOOK = {
    'AmericanElm': {'spring': {'leaf': '#9fbb5e'}, 'summer': {'leaf': '#4f7a36'}, 'autumn': {'leaf': '#c9a83a'},
                    'winter': {'leaf': '#4f7a36'}},
    'Shagbark': {'spring': {'leaf': '#a3bd60'}, 'summer': {'leaf': '#4f7a36'}, 'autumn': {'leaf': '#c99a32'},
                 'winter': {'leaf': '#4f7a36'}},
    'BurOak': {'spring': {'leaf': '#9ab55a'}, 'summer': {'leaf': '#4f7436'}, 'autumn': {'leaf': '#9a7a3a'},
               'winter': {'leaf': '#4f7436'}},
    'PrairieForbs': {
        'spring': {'leaf': '#7a9a4a', 'accent': '#7a9a4a', 'stone': '#7a9a4a'},
        'summer': {'leaf': '#6a8a42', 'accent': '#b05aa8', 'stone': '#e0b030'},
        'autumn': {'leaf': '#9a8a4a', 'accent': '#6a4a40', 'stone': '#e0c030'},
        'winter': {'leaf': '#a8946a', 'accent': '#3a2a20', 'stone': '#4a3a28'}},
    'CornPatch': {
        'spring': {'leaf': '#7aa04a', 'accent': '#7aa04a'},
        'summer': {'leaf': '#4f8a34', 'accent': '#d8c070'},
        'autumn': {'leaf': '#c8b070', 'accent': '#b89a60'},
        'winter': {'leaf': '#a89470', 'accent': '#a89470'}},
    'RedBarn': {s: {'accent': '#a8322a', 'stone': '#f2efe6', 'bark': '#6a6a6a'} for s in ('spring', 'summer', 'autumn', 'winter')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        t = {role: hexrgb(h) for role, h in LOOK[sp][season].items()}
        if sp in BARK:
            t['bark'] = hexrgb(BARK[sp])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.8, 0.5, 0.7)},
          far={'Blender_AmericanElm_1', 'Blender_AmericanElm_2', 'Blender_Shagbark_1', 'Blender_Shagbark_2',
               'Blender_BurOak_1', 'Blender_BurOak_2'},
          tints=tints(SEASON))
