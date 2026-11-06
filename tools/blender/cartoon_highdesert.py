# THE HIGH DESERT PACK (the US landscapes goal, 2 November 2026; PLAN.md
# section 5, local): what the Sagebrush Steppe and Red Rock (the Utah /
# Colorado Plateau) lacked -- the western and Utah junipers, the pinyon pine,
# rabbitbrush, blackbrush, cliffrose, Russian olive, arrowleaf balsamroot,
# globemallow, cheatgrass, basalt rimrock and banded sandstone hoodoos.
#
#   node tools/blender/iterate.mjs cartoon_highdesert <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026): no crown is one cloud_crown
# ellipsoid, and none may read as the game's other junipers -- the Ashe
# juniper (a cluster of shaggy spires from the ground, cartoon_texas) or the
# alligator juniper (a checkered trunk under broad FLAT masses with gaps,
# cartoon_deserts). The western juniper is a massive short shaggy red trunk
# under a big billowing lopsided crown of fine-textured masses, reaching
# further on its downwind side; the Utah juniper a low multi-stem bush wider
# than tall, its stems showing, half-dead silver spikes poking out; the
# pinyon a compact dark dome (or a broad cone) of upturned needle tufts down
# nearly to the ground on a short trunk; the Russian olive an untidy wide
# silver dome on leaning low-forked stems, its fringe drooping; the cliffrose
# a few gnarled grey stems under an open, tufted, ragged crown.
#
# REFS westernjuniper=Blender_WesternJuniper_1,Blender_WesternJuniper_2
# REFS utahjuniper=Blender_UtahJuniper_1
# REFS pinyonpine=Blender_PinyonPine_1,Blender_PinyonPine_2
# REFS rabbitbrush=Blender_Rabbitbrush_1
# REFS blackbrush=Blender_Blackbrush_1
# REFS cliffrose=Blender_Cliffrose_1
# REFS russianolive=Blender_RussianOlive_1
# REFS balsamroot=Blender_Balsamroot_1
# REFS globemallow=Blender_Globemallow_1
# REFS cheatgrass=Blender_Cheatgrass_1
# REFS basaltrimrock=Blender_BasaltRimrock_1,Blender_BasaltRimrock_2
# REFS sandstonehoodoo=Blender_SandstoneHoodoo_1,Blender_SandstoneHoodoo_2
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def bez(p0, p1, p2, p3, n):
    """Cubic Bezier, n + 1 points."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(p0 * (u * u * u) + p1 * (3 * u * u * t) + p2 * (3 * u * t * t) + p3 * (t * t * t))
    return out


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06, role='bark'):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered (2u(v-1) triangles: 64 at
    8 x 5). Returns its vertices."""
    rng = random.Random(rng.random())
    idx = mesh.slot(role)
    if ct.FAR:
        u, v = max(4, u // 2 + 1), 3
    top = mesh.bm.verts.new(center + Vector((0, 0, radii[2])))
    bot = mesh.bm.verts.new(center - Vector((0, 0, radii[2])))
    rings = []
    for i in range(1, v):
        phi = math.pi / 2 - i / v * math.pi
        ring = []
        for k in range(u):
            a = k / u * math.tau
            r = 1 + rng.uniform(-jitter, jitter)
            ring.append(mesh.bm.verts.new(center + Vector((math.cos(phi) * math.cos(a) * radii[0] * r,
                                                           math.cos(phi) * math.sin(a) * radii[1] * r,
                                                           math.sin(phi) * radii[2] * r))))
        rings.append(ring)
    faces = []
    for k in range(u):
        k1 = (k + 1) % u
        faces.append(mesh.bm.faces.new((top, rings[0][k], rings[0][k1])))
        for i in range(len(rings) - 1):
            a, b = rings[i], rings[i + 1]
            faces.append(mesh.bm.faces.new((a[k], b[k], b[k1], a[k1])))
        faces.append(mesh.bm.faces.new((bot, rings[-1][k1], rings[-1][k])))
    for f in faces:
        f.material_index = idx
        f.smooth = True
    out = [top, bot] + [x for ring in rings for x in ring]
    for x in out:
        n = x.co - center
        mesh.normal[x] = Vector((n.x / radii[0] ** 2, n.y / radii[1] ** 2, n.z / radii[2] ** 2)).normalized()
    return out


def ball(mesh, rng, q, radii, c, shade, flex=.8, role='leaf', jitter=.2, u=8, v=5, bend=.6, bright=1.0):
    """A lowball lit as part of a crown: normals bent toward the crown's
    centre `c` by `bend`, painted by `shade` (a crown_shade, or a number)."""
    for x in lowball(mesh, q, radii, role, rng, u, v, jitter):
        out = x.co - c
        out = out.normalized() if out.length > 1e-6 else UP
        n = (mesh.normal[x] * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = (shade(x.co, n) if callable(shade) else shade) if shade else 1.0
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0] * bright, mm[1] * bright, mm[2] * bright, flex)


def oball(mesh, rng, q, axis, side, radii, role, value, flex=.5, u=6, v=4, jitter=.1):
    """A lowball turned so its long (z) radius lies along `axis` and its x
    radius along `side`: a leaf blade, a flower disc, a fallen block."""
    axis = axis.normalized()
    side = (side - axis * side.dot(axis)).normalized()
    nrm = axis.cross(side)
    for x in lowball(mesh, Vector((0, 0, 0)), radii, role, rng, u, v, jitter):
        p, n = x.co.copy(), mesh.normal[x]
        x.co = q + side * p.x + nrm * p.y + axis * p.z
        mesh.normal[x] = (side * n.x + nrm * n.y + axis * n.z).normalized()
        mesh.paint[x] = (value, value, value, flex)


def mass(mesh, rng, q, s, n, c, shade, u=7, v=4, squash=.82, jitter=.24, bend=.4, spread=.55):
    """A foliage mass as a little cluster of `n` small balls -- a fine,
    ragged edge (scale foliage, needles), not one smooth lobe."""
    for m in range(n):
        o = drift(rng, s * spread) + UP * s * rng.uniform(-.25, .3)
        k = s * rng.uniform(.5, .64)
        ball(mesh, rng, q + o, (k, k, k * squash), c, shade, jitter=jitter, u=u, v=v, bend=bend)


# ---------------------------------------------------------------- western juniper

def westernjuniper(height, spread, limbs, wind, dead, low):
    """Western juniper: a massive, short, shaggy red trunk (a third of the
    height) splitting into heavy crooked limbs; a big billowing irregular
    crown of fine-textured masses, as tall as it is wide, lopsided -- its
    downwind side reaching much further -- with a dead silver spike or two."""
    def build(mesh, rng):
        H, R = height, spread * .5
        wd = heading(rng.uniform(0, math.tau))
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * max(.18, low - .05), H * .07, lean=wd * H * .03 + drift(rng, H * .02),
                              steps=5, sides=10, flare=1.6, bend=H * .03, shade_low=.68, shade_high=.95, wobble=.14)
        top = pts[-1]
        r = radii[-1]
        c = Vector((top.x, top.y, H * .64)) + wd * R * .2
        shade = ct.crown_shade(c, (R, R, H * .36), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            reach = R * rng.uniform(.5, .7) * (1 + wind * d.dot(wd))
            endz = H * rng.uniform(.52, .78)
            k1 = top + d * reach * .35 + UP * (endz - top.z) * .55 + drift(rng, reach * .15)
            end = top + d * reach
            end.z = endz
            ct.limb(mesh, rng, top, k1, r * .78, r * .5, sides=6, bow=.12)
            ct.limb(mesh, rng, k1, end, r * .5, r * .18, sides=5, bow=-.2)
        # Round 2: the crown is a lopsided billowing dome of masses from a
        # third of the height to the top, reaching further downwind, a few
        # left out for notches -- not a few lumps on limb ends.
        # Round 3: `low` (where the crown starts) sets the form -- an old
        # tree's billowing dome high on the trunk (01/06), or a young one's
        # dense rounded cone nearly to the ground (02/03). Masses of three
        # smooth 8 x 5 balls, not four faceted 6 x 4 ones.
        prof = (.8, .95, .9, .7, .35) if low > .25 else (.95, .9, .75, .52, .26)
        for li, rf in enumerate(prof):
            zf = low + (.92 - low) * li / 4
            n = max(2, int(round(rf * 7)))
            off = rng.uniform(0, 1)
            if low <= .25 and rf > .4:
                k = R * rf * .7
                ball(mesh, rng, UP * H * zf + wd * R * wind * .25, (k, k, k * .7), c, shade, jitter=.15, u=8, v=5, bend=.6)
            for i in range(n):
                if rng.random() < .08:
                    continue
                a = a0 + (i + off) / n * math.tau
                d = heading(a)
                rr = R * rf * rng.uniform(.75, 1.0) * (1 + wind * .6 * d.dot(wd))
                q = d * rr + wd * R * wind * .25 + UP * H * zf
                sz = R * rng.uniform(.3, .36)
                mass(mesh, rng, q, sz, 3, c, shade, u=7, v=5, spread=.5)
        for k in range(dead):
            a = a0 + 2.6 + k * 2.4
            d = heading(a)
            p0 = top + UP * H * .1
            p1 = p0 + d * R * .35 + UP * H * .32
            p2 = p1 + d * R * .3 + UP * H * .28 + drift(rng, .3)
            bark_tube(mesh, rng, [p0, p1, p2], r * .35, r * .05, 5, shade=(1.5, 1.75), wobble=.1)
    return build


# ---------------------------------------------------------------- Utah juniper

def utahjuniper(height, spread, stems, dead):
    """Utah juniper: several grey shaggy stems from one root splaying out, a
    low bushy irregular crown wider than tall of yellow-green masses on their
    ends with gaps, the stems showing beneath, and half-dead silver limbs
    poking out of the top and sides."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .58
        shade = ct.crown_shade(c, (R, R, H * .42), low=.42, high=1.15)
        a0 = rng.uniform(0, math.tau)
        mids = []
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            base = d * rng.uniform(.05, .2)
            end = d * R * rng.uniform(.45, .68) + UP * H * rng.uniform(.55, .8)
            mid = base.lerp(end, .45) + drift(rng, R * .1) - d * R * .05
            bark_tube(mesh, rng, [base - UP * .05, mid, end], H * .035, H * .01, 6, shade=(.75, 1.0), wobble=.16)
            # Round 2: a dense bush -- three masses up each stem, bigger.
            sz = R * .38
            mass(mesh, rng, end + UP * sz * .2, sz, 5, c, shade, u=6, v=4)
            sz2 = R * .33
            mass(mesh, rng, mid + d * R * .25 + UP * H * .14, sz2, 4, c, shade, u=6, v=4)
            mass(mesh, rng, mid.lerp(end, .5) + d * R * .3 + UP * H * .08, sz2, 4, c, shade, u=6, v=4)
            mids.append((mid, d))
        for k in range(2):
            s = R * .36
            mass(mesh, rng, heading(a0 + k * 3.1 + .7) * R * .2 + UP * (H - s * .8), s, 4, c, shade, u=6, v=4)
        for k in range(dead):
            mid, d = mids[k % len(mids)]
            d2 = (d + heading(rng.uniform(0, math.tau)) * .4).normalized()
            tip = mid + d2 * R * .7 + UP * H * rng.uniform(.75, .95)
            bark_tube(mesh, rng, [mid, mid.lerp(tip, .5) + drift(rng, .2), tip], H * .018, H * .004, 4, shade=(1.5, 1.8),
                      wobble=.12)
            tw = tip.lerp(mid, .35)
            ct.limb(mesh, rng, tw, tw + d2 * R * .2 + UP * H * .15, H * .007, H * .003, sides=4, bow=.1, shade=1.6)
    return build


# ---------------------------------------------------------------- pinyon pine

def pinyonpine(height, spread, stems, cone):
    """Pinyon pine: a short grey-brown trunk (or two) under a compact, dense
    crown down nearly to the ground, built of upturned needle tufts so its
    edge bristles; `cone` 0 a rounded dome (old), 1 a broad blunt cone
    (young). Darker and rounder than any juniper."""
    def build(mesh, rng):
        H, R = height, spread * .5
        a0 = rng.uniform(0, math.tau)
        if cone < .5:
            pinyondome(mesh, rng, H, R, a0)
            return
        lift = .2
        z0 = H * lift
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .45), low=.36, high=1.1)
        for s in range(stems):
            d = heading(a0 + s * math.pi)
            off = d * (R * .08 if stems > 1 else 0)
            bark_tube(mesh, rng, [Vector((0, 0, -.05)) + off * .3, off + UP * H * .25, off * 1.4 + UP * H * .6],
                      H * .045, H * .015, 7, shade=(.7, .9), wobble=.1)
        layers = 6
        for li in range(layers):
            t = li / (layers - 1)
            z = z0 + (H * .9 - z0) * t
            dome = math.sqrt(max(0.0, 1 - (max(0.0, t - .25) / .8) ** 2))
            rr = R * ((1 - cone) * dome * .82 + cone * (1 - t) * .9 + .06)
            n = max(3, int(round(rr / R * 9)) + 1)
            off = rng.uniform(0, 1)
            for i in range(n):
                a = a0 + (i + off) / n * math.tau
                q = heading(a) * rr * rng.uniform(.85, 1.08) + UP * z + drift(rng, R * .05)
                s = R * rng.uniform(.18, .26)
                ball(mesh, rng, q, (s, s, s * 1.3), c, shade, jitter=.28, u=7, v=5, bend=.4)
            if rr > R * .3:
                s = rr * .75
                ball(mesh, rng, UP * z, (s, s, s * .8), c, shade, jitter=.2, u=7, v=4, bend=.6)
        s = R * .18
        ball(mesh, rng, UP * (H - s), (s, s, s * 1.4), c, shade, jitter=.25, u=7, v=5, bend=.3)
    return build


def pinyondome(mesh, rng, H, R, a0):
    """The old pinyon (round 2): a short stout crooked trunk forking low into
    a few crooked limbs, each carrying a rounded mass of upturned tufts; the
    masses together a broad irregular dome, wider than tall, lifted off the
    ground so the trunk and limb bases show, notches between them."""
    c = UP * H * .62
    shade = ct.crown_shade(c, (R, R, H * .38), low=.36, high=1.1)
    pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .2, H * .06, lean=drift(rng, H * .08), steps=4, sides=8,
                          flare=1.5, bend=H * .06, shade_low=.68, shade_high=.88, wobble=.12)
    top, r = pts[-1], radii[-1]
    n = 5
    for i in range(n):
        a = a0 + i / n * math.tau + rng.uniform(-.25, .25)
        d = heading(a)
        end = d * R * rng.uniform(.55, .7) + UP * H * rng.uniform(.36, .52)
        ct.limb(mesh, rng, top, end, r * .7, r * .3, sides=5, bow=.12)
        tufts(mesh, rng, end + UP * R * .05, R * .42, 8, c, shade)
    # Round 3: three masses over the ring, so the crown is a deep dome.
    for k in range(3):
        tufts(mesh, rng, heading(a0 + k * 2.1 + .6) * R * .25 + UP * H * .7, R * .4, 7, c, shade)


def tufts(mesh, rng, q, s, n, c, shade):
    """A rounded pine mass of `n` upturned needle tufts over a core."""
    ball(mesh, rng, q, (s * .7, s * .7, s * .5), c, shade, jitter=.15, u=7, v=4, bend=.6)
    for m in range(n):
        a = m / n * math.tau + rng.uniform(-.3, .3)
        up = rng.uniform(-.1, .7)
        p = q + heading(a) * s * .66 * math.cos(up) + UP * s * .5 * math.sin(up) + UP * s * .1
        k = s * rng.uniform(.26, .32)
        ball(mesh, rng, p, (k, k, k * 1.7), c, shade, jitter=.3, u=6, v=4, bend=.4)


# ---------------------------------------------------------------- Russian olive

def russianolive(height, spread, stems):
    """Russian olive: two or three crooked stems leaning out from a low fork,
    long limbs arching out and drooping at their tips; an untidy, wide,
    silvery dome of fine clusters with sky between and a drooping fringe;
    a few silvery olives (accent) under it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .6
        shade = ct.crown_shade(c, (R, R, H * .36), low=.5, high=1.18)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        # Round 2: a clear trunk to a third of the height, then the limbs.
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .32, H * .04, lean=drift(rng, H * .06), steps=4,
                              sides=8, flare=1.4, bend=H * .04, shade_low=.7, shade_high=.9, wobble=.12)
        top = pts[-1]
        for s in range(stems):
            a = a0 + s / stems * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            fork = top + d * R * .18 + UP * H * .1 + drift(rng, .15)
            bark_tube(mesh, rng, [top, fork], radii[-1] * .8, H * .02, 6, shade=(.75, .9))
            for j in range(3):
                b = a + (j - 1) * .85 + rng.uniform(-.2, .2)
                e = heading(b)
                reach = R * rng.uniform(.6, .85)
                endz = H * rng.uniform(.55, .75)
                p3 = e * reach + UP * endz
                path = bez(fork, fork + e * reach * .15 + UP * H * .35, e * reach * .7 + UP * (endz + H * .25), p3, 5)
                bark_tube(mesh, rng, path, H * .016, H * .004, 5)
                for f, k, hang in ((.45, .85, .0), (.75, .9, .2), (1.0, .85, .45)):
                    q = path[int(round(f * 5))]
                    sz = R * .24 * k
                    for m in range(3):
                        o = drift(rng, sz * .6) + UP * sz * rng.uniform(-.2, .3)
                        kk = sz * rng.uniform(.5, .62)
                        ball(mesh, rng, q + o - UP * sz * hang, (kk, kk, kk * (1 + hang)), c, shade, jitter=.3, u=5,
                             v=4, bend=.4)
                for m in range(2):
                    q = path[4] + drift(fr, R * .12) - UP * R * .12
                    ball(mesh, fr, q, (.06, .06, .07), c, 1.0, flex=.6, role='accent', jitter=.1, u=5, v=3, bend=.2)
        lead = [top, top + UP * H * .3 + drift(rng, .3), UP * H * .9]
        bark_tube(mesh, rng, lead, radii[-1] * .6, H * .006, 5)
        for f in (.5, 1.0):
            mass(mesh, rng, lead[1].lerp(lead[2], f) if f < 1 else lead[2], R * .34, 4, c, shade, u=5, v=4, spread=.6)
        for k in range(6):
            sz = R * .3
            q = heading(a0 + k * 1.05 + .4) * R * (.12 if k < 2 else .35) + UP * (H - sz * (.7 if k < 2 else 1.4))
            mass(mesh, rng, q, sz, 4, c, shade, u=5, v=4, spread=.65)
    return build


# ---------------------------------------------------------------- cliffrose

def cliffrose(height, spread, stems):
    """Cliffrose: a vase of many gnarled, shreddy grey stems fanning up and
    out from one root (round 9, after 02/03), each clothed along its upper
    two-thirds in small upright tufts of fine leaves, a crooked side branch
    off each; cream flowers in spring and feathery pale plumes in summer
    (accent) speckled all over the outside. An irregular upright fountain,
    sky between the stems -- never a little tree on one trunk."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .6
        shade = ct.crown_shade(c, (R, R, H * .45), low=.45, high=1.15)
        a0 = rng.uniform(0, math.tau)
        fr = random.Random(rng.random())
        for i in range(stems):
            a = a0 + i * ct.GOLDEN * 2.3 + rng.uniform(-.2, .2)
            d = heading(a)
            f = rng.uniform(.45, 1.0)
            tip = d * R * .85 * f + UP * H * (1.0 - .3 * f * f) * rng.uniform(.85, 1.0)
            k1 = d * R * .35 * f + UP * tip.z * .28 + drift(rng, R * .1)
            k2 = k1.lerp(tip, .5) + drift(rng, R * .1)
            pts = [d * R * .1 - UP * .05, k1, k2, tip]
            bark_tube(mesh, rng, pts, H * .016, H * .005, 5, shade=(.72, 1.0), wobble=.2)
            e = heading(a + rng.choice((-1, 1)) * rng.uniform(.6, 1.0))
            st = k1.lerp(k2, .4)
            sp = st + e * R * .35 + UP * H * .22
            ct.limb(mesh, rng, st, sp, H * .008, H * .003, sides=4, bow=.15)
            # Round 13: a tuft at the first kink, so leaves come nearly to
            # the ground (02/03), not a crown on a bare bundle of stems.
            for q, sz in ((k1, .17), (k1.lerp(k2, .5), .2), (k2, .22), (k2.lerp(tip, .6), .22), (tip, .18), (sp, .2),
                          (st.lerp(sp, .5), .17)):
                k = R * sz * rng.uniform(.85, 1.1)
                ball(mesh, rng, q + drift(rng, k * .3), (k, k, k * 1.3), c, shade, jitter=.25, u=5, v=4, bend=.45)
                for m in range(2 if sz > .19 else 1):
                    p = q + drift(fr, k * 1.1) + UP * k * fr.uniform(.2, 1.1)
                    ball(mesh, fr, p, (.1, .1, .08), c, 1.0, flex=.7, role='accent', jitter=.15, u=4, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- rabbitbrush

def rabbitbrush(height, spread, stems):
    """Rubber rabbitbrush: a rounded mound of many upright grey-green stems
    fanning from one root, narrow leafy along their upper parts, each topped
    by a flat cluster of flowers (accent: bright yellow in autumn)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .55
        shade = ct.crown_shade(c, (R, R, H * .5), low=.5, high=1.15)
        for i in range(stems):
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            f = math.sqrt((i + .5) / stems)
            d = heading(a)
            tip = d * R * .8 * f + UP * H * (.92 - .3 * f * f) * rng.uniform(.9, 1.0)
            base = d * R * .05
            mid = base.lerp(tip, .5) - d * R * .05 * f
            mesh.add_tube([base, mid, tip], [.014, .01, .006], 4, 'leaf', rng=rng, wobble=.05,
                          shade=lambda co, t: .7 + .3 * t, flex=lambda co, t: .2 + .6 * t)
            for k, g in enumerate((.5, .78)):
                q = base.lerp(tip, g) + d * .03
                s = R * .13
                ball(mesh, rng, q, (s, s, s * 2.2), c, shade, jitter=.2, u=5, v=4, bend=.5)
                if k == 1 and f > .5:
                    sa = R * .11
                    ball(mesh, rng, q + d * s * .9 + UP * s * .5, (sa, sa, sa * .7), c, 1.05, flex=.9, role='accent',
                         jitter=.2, u=5, v=3, bend=.3)
            s = R * .12
            for m in range(2):
                ball(mesh, rng, tip + drift(rng, s * .6) + UP * s * (.2 + .4 * m), (s, s, s * .6), c, 1.05, flex=.9,
                     role='accent', jitter=.2, u=5, v=3, bend=.3)
    return build


# ---------------------------------------------------------------- blackbrush

def blackbrush(height, spread, branches):
    """Blackbrush: a low dense mound of intricate, rigid, spiny grey-black
    twigs zig-zagging out from the root, small dark leaf clusters sparse
    along them, the twig ends bristling past the leaves."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .45
        shade = ct.crown_shade(c, (R, R, H * .5), low=.8, high=1.35)
        fr = random.Random(rng.random())
        for i in range(branches):
            a = i * ct.GOLDEN + rng.uniform(-.3, .3)
            d = heading(a)
            f = rng.uniform(.55, 1.0)
            end = d * R * f + UP * H * (1.0 - .55 * f * f) * rng.uniform(.85, 1.0)
            k1 = d * R * f * .35 + UP * end.z * .5 + drift(rng, R * .12)
            mesh.add_tube([Vector((0, 0, -.02)), k1, end], [.02, .013, .004], 4, 'bark', rng=rng, wobble=.1,
                          shade=lambda co, t: 1.0 + .4 * t, flex=lambda co, t: .1 + .3 * t)
            for j in range(3):
                p = k1.lerp(end, .3 + .3 * j)
                sp = p + (d + heading(a + rng.choice((-1, 1)) * 1.3)) * R * .15 + UP * H * rng.uniform(.0, .15)
                mesh.add_tube([p, sp], [.007, .002], 3, 'bark', rng=rng)
                s = R * .075
                for q in (p.lerp(sp, .3), p.lerp(sp, .85)):
                    ball(mesh, rng, q + drift(rng, s * .5), (s, s, s * .75), c, shade, jitter=.3, u=5, v=3, bend=.4)
            if fr.random() < .5:
                ball(mesh, fr, end + UP * .02, (.025, .025, .02), c, 1.0, flex=.6, role='accent', jitter=.1, u=5, v=3,
                     bend=.2)
    return build


# ---------------------------------------------------------------- balsamroot

def balsamroot(height, spread, leaves, heads):
    """Arrowleaf balsamroot: a clump of big upright silver-green arrowhead
    leaves on stalks, fanning out of the root, and yellow sunflower heads
    (accent rays round a brown disc, the bark role) on bare stalks above."""
    def build(mesh, rng):
        H, R = height, spread * .5
        for k in range(leaves):
            a = k * ct.GOLDEN + rng.uniform(-.2, .2)
            d = heading(a)
            tilt = rng.uniform(.95, 1.25)
            axis = (d * math.cos(tilt) + UP * math.sin(tilt)).normalized()
            L = H * rng.uniform(.5, .66)
            base = d * R * .08 + UP * H * .06
            mesh.add_tube([Vector((0, 0, 0)), base], [.008, .007], 4, 'leaf')
            side = Vector((-d.y, d.x, 0))
            oball(mesh, rng, base + axis * L * .5, axis, side, (L * .24, L * .03, L * .5), 'leaf',
                  rng.uniform(.85, 1.1), flex=.5, u=6, v=5, jitter=.08)
        for k in range(heads):
            a = k * 2.4 + rng.uniform(-.3, .3)
            d = heading(a)
            top = d * R * rng.uniform(.25, .45) + UP * H * rng.uniform(.85, 1.0)
            mesh.add_tube([Vector((0, 0, 0)), top.lerp(Vector((0, 0, 0)), .5) + d * .02, top], [.006, .005, .004], 4,
                          'leaf', flex=lambda co, t: .3 + .5 * t)
            face = (d * .7 + UP).normalized()
            oball(mesh, rng, top, face, Vector((-d.y, d.x, 0)), (.07, .07, .012), 'accent', 1.05, flex=.8, u=8, v=3)
            oball(mesh, rng, top + face * .012, face, Vector((-d.y, d.x, 0)), (.022, .022, .012), 'bark', .9, flex=.8,
                  u=6, v=3)
    return build


# ---------------------------------------------------------------- globemallow

def globemallow(height, spread, stems):
    """Desert globemallow: a clump of upright grey-green leafy stems from one
    root, small grey leaves along them, apricot-orange cup flowers (accent)
    strung up their upper halves."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.6, high=1.12)
        for i in range(stems):
            a = i * ct.GOLDEN + rng.uniform(-.2, .2)
            d = heading(a)
            f = math.sqrt((i + .5) / stems)
            tip = d * R * 1.0 * f + UP * H * rng.uniform(.75, 1.0) * (1 - .25 * f)
            mid = tip * .5 + d * R * .08
            mesh.add_tube([Vector((0, 0, 0)), mid, tip], [.007, .005, .003], 4, 'leaf', rng=rng, wobble=.05,
                          shade=lambda co, t: .75 + .3 * t, flex=lambda co, t: .2 + .6 * t)
            for k in range(3):
                q = Vector((0, 0, 0)).lerp(tip, .2 + .2 * k) + heading(a + (k - 1) * 1.5) * .04
                s = R * .17 * (1 - .2 * k)
                ball(mesh, rng, q, (s, s, s * .6), c, shade, jitter=.2, u=5, v=3, bend=.4)
            for k in range(4):
                q = mid.lerp(tip, .1 + .3 * k) + heading(a + k * 2.1) * .03
                ball(mesh, rng, q, (.032, .032, .024), c, 1.05, flex=.8, role='accent', jitter=.1, u=5, v=3, bend=.2)
    return build


# ---------------------------------------------------------------- cheatgrass

def cheatgrass(height, spread, tufts):
    """A patch of cheatgrass: many fine tufts of blades leaning out over a
    disc, their tops (accent) arching over into drooping seed heads --
    purple-red in spring, straw-gold from June."""
    def build(mesh, rng):
        H, R = height, spread * .5
        for k in range(tufts):
            a = k * ct.GOLDEN
            root = heading(a) * R * .85 * math.sqrt((k + .5) / tufts)
            ct.tuft(mesh, rng, root, blades=7, height=H * rng.uniform(.75, 1.0), width=.014, spread=.25, lean=.5,
                    low='leaf', tip='accent', tip_from=.6)
            for j in range(2):
                b = a + j * 3.0 + rng.uniform(-.5, .5)
                e = heading(b)
                top = root + e * .04 + UP * H * rng.uniform(.8, 1.0)
                hang = top + e * .08 - UP * H * .25
                pts = bez(root, root + UP * H * .5, top + e * .02 + UP * .03, hang, 3)
                mesh.add_tube(pts, [.004, .004, .003, .002], 3, 'accent', rng=rng,
                              shade=lambda co, t: .8 + .3 * t, flex=lambda co, t: .2 + .8 * t)
    return build


# ---------------------------------------------------------------- basalt rimrock

def prism(mesh, rng, p0, p1, radius, sides=6, lo=.6, hi=1.0, broken=.12):
    """A basalt column: a flat-shaded n-sided prism from p0 to p1, its top
    cut at a slant (a broken column), painted dark at the foot."""
    axis = (p1 - p0)
    L = axis.length
    w = axis.normalized()
    u0 = Vector((1, 0, 0)) if abs(w.x) < .9 else Vector((0, 1, 0))
    u = (u0 - w * u0.dot(w)).normalized()
    v = w.cross(u)
    tilt = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1)))
    a0 = rng.uniform(0, math.tau)
    idx = mesh.slot('stone')
    bot, top = [], []
    for k in range(sides):
        a = a0 + k / sides * math.tau
        rr = radius * rng.uniform(.9, 1.05)
        off = u * math.cos(a) * rr + v * math.sin(a) * rr
        dz = (math.cos(a) * tilt.x + math.sin(a) * tilt.y) * radius * broken * 2
        bot.append(mesh.bm.verts.new(p0 + off))
        top.append(mesh.bm.verts.new(p1 + off * .96 + w * dz))
    for k in range(sides):
        k1 = (k + 1) % sides
        f = mesh.bm.faces.new((bot[k], bot[k1], top[k1], top[k]))
        f.material_index = idx
        f.smooth = False
    f = mesh.bm.faces.new(top)
    f.material_index = idx
    f.smooth = False
    f = mesh.bm.faces.new(list(reversed(bot)))
    f.material_index = idx
    f.smooth = False
    for x in bot:
        mesh.paint[x] = (lo, lo, lo, 0.0)
    for x in top:
        mesh.paint[x] = (hi, hi, hi, 0.0)


def talus(mesh, rng, x0, x1, y, n, size, light=1.9, slope=0.0):
    """An apron of broken angular blocks at the foot of a face (-Y),
    painted lighter (the spec's talus #7a6a5a against the face's #4a4440)."""
    for k in range(n):
        x = rng.uniform(x0, x1)
        yy = y - rng.uniform(0, size * 3)
        s = size * rng.uniform(.5, 1.0) * (1.2 - (y - yy) / (size * 4))
        z = slope * max(0.0, 1 - (y - yy) / (size * 3))
        ct.hull_rock(mesh, rng, Vector((x, yy, z * rng.uniform(.6, 1))), (s, s * rng.uniform(.7, 1), s * .6), points=8, bevel=.04,
                     seat=.25, shade_low=light * .75, shade_high=light)


def basaltrim(length, height, depth):
    """A straight piece of basalt rimrock: a colonnade of dark hexagonal
    columns along X, its face toward -Y, under a jointed cap (entablature)
    of broken slabs that overhangs a little, a lighter talus apron of
    angular blocks spilling down in front."""
    def build(mesh, rng):
        L, Hh = length, height
        x = -L * .5
        while x < L * .5:
            w = rng.uniform(.55, .85)
            for row in range(2):
                h = Hh * (rng.uniform(.6, .95) if rng.random() < .75 else rng.uniform(.35, .55)) - .35 * row
                y = row * w * .8 + rng.uniform(-.25, .2)
                prism(mesh, rng, Vector((x + row * w * .45, y, -.2)), Vector((x + row * w * .45, y, h)), w * .5,
                      lo=.85, hi=1.4)
            x += w * .9
        for k in range(0):
            cx = -L * .5 + L * (k + .5) / 3 + rng.uniform(-.2, .2)
            ct.hull_rock(mesh, rng, Vector((cx, depth * .3, Hh * .8)), (L / 3 * .58, depth * .5, .55), points=12,
                         bevel=.04, flat_top=.6, flat_bottom=.6, seat=.4, shade_low=1.0, shade_high=1.4)
        talus(mesh, rng, -L * .5, L * .5, -.4, 22, .5, slope=Hh * .35)
    return build


def basaltend(length, height, depth):
    """The end of a rim: columns stepping down in height toward +X, a few
    broken and lying in front, the cap stopping short over the tallest, and
    the talus apron round the end."""
    def build(mesh, rng):
        L, Hh = length, height
        x = -L * .5
        while x < L * .5:
            t = (x + L * .5) / L
            w = rng.uniform(.55, .85)
            for row in range(2):
                h = Hh * (1 - .75 * t * t) * rng.uniform(.8, 1.0) - .3 * row
                if h > .4:
                    y = row * w * .8
                    prism(mesh, rng, Vector((x + row * w * .45, y, -.2)), Vector((x + row * w * .45, y, h)), w * .5,
                          lo=.85, hi=1.4)
            x += w * .9
        for k in range(3):
            p0 = Vector((rng.uniform(-L * .2, L * .4), -rng.uniform(1.0, 2.2), .3))
            d = heading(rng.uniform(-.6, .6) + (math.pi if k % 2 else 0))
            prism(mesh, rng, p0, p0 + d * rng.uniform(1.2, 2.0), .3, lo=1.1, hi=1.4)
        talus(mesh, rng, -L * .5, L * .55, -.4, 18, .5, slope=Hh * .3)
    return build


# ---------------------------------------------------------------- sandstone

def lathe(mesh, rng, profile, sides, xs=1.0, ys=1.0, bands=(), streaks=0, lo=.7, hi=1.08, irregular=.12, at=None):
    """A body turned from `profile` [(z, r), ...]: an irregular cross-section
    kept the same up the height (so it reads as one weathered body), each
    ring drifting a little. Faces whose middle falls in a band (z0, z1) take
    the accent role (the cream beds); `streaks` dark vertical desert-varnish
    stripes down the faces."""
    k = [1 + rng.uniform(-irregular, irregular) for _ in range(sides)]
    k = [(k[i - 1] + 2 * k[i] + k[(i + 1) % sides]) / 4 for i in range(sides)]
    st = set(rng.sample(range(sides), streaks)) if streaks else set()
    H = profile[-1][0]
    rings = []
    shift = at.copy() if at is not None else Vector((0, 0, 0))
    for zi, (z, r) in enumerate(profile):
        shift = shift + drift(rng, r * .04)
        ring = []
        for i in range(sides):
            a = i / sides * math.tau
            jj = 1 + rng.uniform(-.04, .04)
            p = Vector((math.cos(a) * r * xs * k[i] * jj, math.sin(a) * r * ys * k[i] * jj, z)) + shift
            x = mesh.bm.verts.new(p)
            val = lo + (hi - lo) * max(0.0, min(1.0, z / max(H, 1e-6)))
            if i in st and z > H * .25:
                val *= .62
            mesh.paint[x] = (val, val, val, 0.0)
            ring.append(x)
        rings.append(ring)
    si, ai = mesh.slot('stone'), mesh.slot('accent')
    for ra, rb, (za, _), (zb, _) in zip(rings, rings[1:], profile, profile[1:]):
        zm = (za + zb) * .5
        idx = ai if any(b0 <= zm <= b1 for b0, b1 in bands) else si
        for i in range(sides):
            i1 = (i + 1) % sides
            f = mesh.bm.faces.new((ra[i], ra[i1], rb[i1], rb[i]))
            f.material_index = idx
            f.smooth = True
    f = mesh.bm.faces.new(rings[-1])
    f.material_index = si
    f.smooth = True
    return rings[-1]


def hoodoo(height, girth):
    """A sandstone hoodoo: a pedestal of soft red rock necking and bulging up
    its height in beds (cream bands, accent), under a wide, rounded, darker
    caprock; a couple of fallen blocks at its foot."""
    def build(mesh, rng):
        H, g = height, girth
        # Round 2: the Goblin Valley stack -- a broad pedestal, a neck, a
        # bulge, a narrow neck, then a big rounded cap and a small one on it.
        prof = [(-.2, 1.7), (0, 1.6), (.08, 1.35), (.16, 1.0), (.24, .8), (.3, .78), (.36, .95), (.42, 1.0),
                (.48, .9), (.54, .65), (.6, .5), (.64, .48), (.67, .55)]
        prof = [(z * H, r * g) for z, r in prof]
        lathe(mesh, rng, prof, 14, bands=((.42 * H, .48 * H),), streaks=3, lo=.72, hi=1.05)
        top = prof[-1][0]
        ct.pebble_rock(mesh, rng, Vector((rng.uniform(-.1, .1) * g, 0, top - .1)), (g * 1.25, g * 1.05, H * .13),
                       lumps=.12, subdiv=2, seat=0, shade_low=.75, shade_high=1.05)
        ct.pebble_rock(mesh, rng, Vector((rng.uniform(-.2, .2) * g, 0, top + H * .15)), (g * .65, g * .55, H * .07),
                       lumps=.12, subdiv=2, seat=0, shade_low=.8, shade_high=1.1)
        # Round 10: a smaller one-capped hoodoo beside it -- they stand in
        # groups (01).
        at = Vector((g * 2.6, g * .8, 0))
        small = [(z * .55, r * .7) for z, r in prof]
        lathe(mesh, rng, small, 12, bands=((.42 * H * .55, .48 * H * .55),), streaks=2, lo=.72, hi=1.02, at=at)
        ct.pebble_rock(mesh, rng, at + Vector((0, 0, small[-1][0] - .08)), (g * .85, g * .75, H * .08), lumps=.12,
                       subdiv=2, seat=0, shade_low=.75, shade_high=1.05)
        for k in range(2):
            p = heading(rng.uniform(0, math.tau)) * g * 2.2
            ct.hull_rock(mesh, rng, p, (g * .5, g * .4, g * .35), points=10, bevel=.15, seat=.2, shade_low=.7,
                         shade_high=1.0)
    return build


def fin(height, length, thick):
    """A banded sandstone fin: a tall narrow wall of red rock along X,
    rounded on top, cream beds (accent) across it and desert-varnish
    streaks running down its faces; blocks broken off at its foot."""
    def build(mesh, rng):
        H = height
        # Round 2: tall pointed fins (as 02), a big one and a lower one
        # behind, thin cream beds.
        prof = [(-.2, 1.1), (0, 1.05), (.2, 1.0), (.3, .97), (.34, .97), (.4, .95), (.55, .9), (.7, .82), (.8, .72), (.88, .58), (.94, .4),
                (.98, .2), (1.0, .02)]
        # Round 4: three tall narrow spires side by side along X (02),
        # each a thin fin end-on, so the group reads from the front.
        for k, (sc, off) in enumerate(((1.0, Vector((0, 0, 0))), (.82, Vector((length * .38, thick * .4, 0))),
                                       (.66, Vector((-length * .36, thick * .5, 0))))):
            pr = [(z * H * sc, r) for z, r in prof]
            lathe(mesh, rng, pr, 16, xs=length * .26, ys=thick * .5, at=off,
                  bands=((.31 * H * sc, .33 * H * sc),), streaks=4, lo=.7, hi=1.08,
                  irregular=.08)
        for k in range(3):
            p = Vector((rng.uniform(-.4, .4) * length, -thick * rng.uniform(.8, 1.2), 0))
            s = rng.uniform(.5, .9)
            ct.hull_rock(mesh, rng, p, (s, s * .8, s * .6), points=10, bevel=.15, seat=.2, shade_low=.7, shade_high=1.0)
    return build


MODELS = [
    ('Blender_WesternJuniper_1', westernjuniper(9, 9, 5, .45, 1, .36)),
    ('Blender_WesternJuniper_2', westernjuniper(7, 6, 4, .2, 1, .14)),
    ('Blender_UtahJuniper_1', utahjuniper(4.5, 5.5, 5, 2)),
    ('Blender_PinyonPine_1', pinyonpine(5, 7.5, 1, 0)),
    ('Blender_PinyonPine_2', pinyonpine(5, 5, 2, .8)),
    ('Blender_Rabbitbrush_1', rabbitbrush(1.2, 1.4, 28)),
    ('Blender_Blackbrush_1', blackbrush(.8, 1.2, 20)),
    ('Blender_Cliffrose_1', cliffrose(2.6, 2.6, 7)),
    ('Blender_RussianOlive_1', russianolive(7, 8, 3)),
    ('Blender_Balsamroot_1', balsamroot(.5, .65, 14, 6)),
    ('Blender_Globemallow_1', globemallow(.7, .5, 9)),
    ('Blender_Cheatgrass_1', cheatgrass(.35, .8, 13)),
    ('Blender_BasaltRimrock_1', basaltrim(7, 4, 2.5)),
    ('Blender_BasaltRimrock_2', basaltend(5, 3.6, 2.5)),
    ('Blender_SandstoneHoodoo_1', hoodoo(6, 1.0)),
    ('Blender_SandstoneHoodoo_2', fin(11, 5.5, 1.6)),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


BARK = {'WesternJuniper': '#7a4e3a', 'UtahJuniper': '#8a8378', 'PinyonPine': '#6a5e52', 'Rabbitbrush': '#8a8a6a',
        'Blackbrush': '#6a6660', 'Cliffrose': '#8a8072', 'RussianOlive': '#4e3e32', 'Balsamroot': '#a07830',
        'Globemallow': '#8a8a70', 'Cheatgrass': '#a09070'}
# Stone and, for the banded sandstone, its cream beds (accent).
STONE = {'BasaltRimrock': ('#4a4440', None), 'SandstoneHoodoo': ('#c06a3a', '#e0b080')}
# Leaf, accent (and for the balsamroot its disc, bark) per season, from each
# spec's Seasons table. Deciduous ones are drawn in leaf (bare variants come
# later): a bare winter keeps the summer leaf. An accent with no flowers or
# fruit that season is drawn the leaf's colour. PLACED where the spec gives
# one colour for a season: the flower when the spec's colour is the flower
# (cliffrose, balsamroot, globemallow spring), the leaf then from its summer.
LOOK = {
    'WesternJuniper': {'spring': ('#6b8460', None), 'summer': ('#64805a', None), 'autumn': ('#62805a', None),
                       'winter': ('#5e7856', None)},
    'UtahJuniper': {'spring': ('#73865a', None), 'summer': ('#6c8256', None), 'autumn': ('#6c8256', None),
                    'winter': ('#677c52', None)},
    'PinyonPine': {'spring': ('#5d7a45', None), 'summer': ('#58763f', None), 'autumn': ('#58763f', None),
                   'winter': ('#55733e', None)},
    'Rabbitbrush': {'spring': ('#8a9a6a', '#8a9a6a'), 'summer': ('#8a9a6a', '#9aa66a'), 'autumn': ('#8a9a6a', '#e0c030'),
                    'winter': ('#8a8e72', '#9a9a7a')},
    'Blackbrush': {'spring': ('#747862', '#c8a840'), 'summer': ('#6a6e62', '#6a6e62'), 'autumn': ('#6a6e62', '#6a6e62'),
                   'winter': ('#64685e', '#64685e')},
    'Cliffrose': {'spring': ('#6e7e50', '#efe8c8'), 'summer': ('#7a8a5a', '#d8d0c4'), 'autumn': ('#7a8a5a', '#c0b8a8'),
                  'winter': ('#74845a', '#74845a')},
    'RussianOlive': {'spring': ('#a9b8a0', '#e0d070'), 'summer': ('#9fb09a', '#b8bca8'), 'autumn': ('#a8a88a', '#c8bc90'),
                     'winter': ('#9fb09a', '#9fb09a')},
    'Balsamroot': {'spring': ('#a8b498', '#e8c030', '#a07830'), 'summer': ('#a09a70', '#a09a70', '#6a5a40'),
                   'autumn': ('#a09070', '#a09070', '#6a5a40'), 'winter': ('#9a8a6c', '#9a8a6c', '#6a5a40')},
    'Globemallow': {'spring': ('#9aa88a', '#e0782e'), 'summer': ('#8a9a7a', '#8a9a7a'), 'autumn': ('#8a9a7a', '#8a9a7a'),
                    'winter': ('#8a9080', '#8a9080')},
    'Cheatgrass': {'spring': ('#7e8a58', '#8a6a7a'), 'summer': ('#c8b07a', '#d0b880'), 'autumn': ('#c0a878', '#c8b080'),
                   'winter': ('#b0987a', '#b8a078')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        if sp in STONE:
            st, ac = STONE[sp]
            out[name] = {'stone': hexrgb(st)}
            if ac:
                out[name]['accent'] = hexrgb(ac)
            continue
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(look[2] if len(look) > 2 else BARK[sp])}
        if look[1]:
            t['accent'] = hexrgb(look[1])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.85, 0.72, 0.42),
                           'stone': (0.45, 0.30, 0.22)},
          far={'Blender_WesternJuniper_1', 'Blender_WesternJuniper_2', 'Blender_PinyonPine_1', 'Blender_PinyonPine_2'},
          tints=tints(SEASON))
