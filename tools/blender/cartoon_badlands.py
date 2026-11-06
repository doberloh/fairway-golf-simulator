# THE BADLANDS PACK (the owner, 3 November 2026: "can we add a new biome, The
# north and south dakota Badlands?"; the study's subs/plains/plains.badlands.md,
# local): South Dakota's White River badlands and North Dakota's Little
# Missouri badlands -- the Yellow Mounds (its boulders), Rocky Mountain
# juniper, green ash, chokecherry, leadplant and the bison. The spires,
# sawtooth walls, clinker butte, horizon wall and cannonball concretion built
# here in rounds 1-16 were cut (the owner, 3 November 2026: the landscape
# should generate its formations, as the others do, and "the big round ball
# thing is not needed"): they are the ground's now (landforms.js
# `badlands`, ground.js strata). Their logs stay as the record.
#
#   node tools/blender/iterate.mjs cartoon_badlands <round> [--season s] [--far]
#
# Silhouette first (the owner, 2 November 2026). The Rocky Mountain juniper
# must not read as the game's other junipers -- the eastern red cedar (a
# dense dark green flame), the Utah juniper (a low multi-stem bush wider than
# tall), the western (a massive red trunk under a billowing lopsided crown)
# or the Ashe (shaggy spires from the ground): it is BLUE-GREY, a narrow
# pyramid when young and a scraggly leaning irregular column when old, its
# branches turning up. The green ash is an open rounded crown with gaps on a
# straight grey trunk, not a ball. The chokecherry a thicket of thin stems.
#
# The Yellow Mounds are the landscape's boulders, painted like any stone:
# stone and accent only (vegetation.js colours a boulder from the landscape's
# rock and rockMoss).
#
# REFS badlandsmound=Blender_BadlandsMound_1,Blender_BadlandsMound_2
# REFS rmjuniper=Blender_RMJuniper_1,Blender_RMJuniper_2
# REFS greenash=Blender_GreenAsh_1
# REFS chokecherry=Blender_Chokecherry_1
# REFS leadplant=Blender_Leadplant_1
# REFS bison=Blender_Bison_1
import math, os, random, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import cartoon as ct

UP = Vector((0, 0, 1))
V = lambda x, y, z: Vector((x, y, z))


def drift(rng, amount):
    return Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * amount


def heading(a):
    return Vector((math.cos(a), math.sin(a), 0))


def lowball(mesh, center, radii, role, rng, u=8, v=5, jitter=.15):
    """A cheap lump: a u-by-v sphere, jittered. Returns its vertices."""
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


def ball(mesh, rng, q, radii, c, shade, flex=.8, role='leaf', jitter=.2, u=8, v=5, bend=.6, value=None):
    """A lowball lit as part of a crown: normals bent toward the crown's
    centre `c` by `bend`, painted by `shade` (a crown_shade) or `value`."""
    for x in lowball(mesh, q, radii, role, rng, u, v, jitter):
        out = x.co - c
        out = out.normalized() if out.length > 1e-6 else UP
        n = (mesh.normal[x] * (1 - bend) + out * bend).normalized()
        mesh.normal[x] = n
        m = value if value is not None else (shade(x.co, n) if shade else 1.0)
        mm = m if isinstance(m, tuple) else (m, m, m)
        mesh.paint[x] = (mm[0], mm[1], mm[2], flex)


def mass(mesh, rng, q, s, n, c, shade, u=7, v=4, squash=.82, jitter=.24, bend=.4, spread=.55, role='leaf'):
    """A foliage mass as a cluster of `n` small balls: a fine, ragged edge."""
    for m in range(n):
        o = drift(rng, s * spread) + UP * s * rng.uniform(-.25, .3)
        k = s * rng.uniform(.5, .64)
        ball(mesh, rng, q + o, (k, k, k * squash), c, shade, jitter=jitter, u=u, v=v, bend=bend, role=role)


def bark_tube(mesh, rng, pts, r0, r1, sides, shade=(.78, 1.0), wobble=.06, role='bark'):
    n = len(pts) - 1
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    mesh.add_tube(pts, radii, sides, role, rng=rng, wobble=wobble,
                  shade=lambda co, t: shade[0] + (shade[1] - shade[0]) * t, flex=lambda co, t: .1 + .4 * t)
    return radii


# ---------------------------------------------------------------- banded clay

def banded(mesh, rng, profile, sides, beds, at=None, xs=1.0, ys=1.0, flutes=0, flute=.0, lo=.78, hi=1.06,
           irregular=.1, base='stone'):
    """A body turned from `profile` [(z, r), ...], its rings kept to one
    irregular cross-section so it reads as one weathered body. `beds` is
    [(z0, z1, role), ...]: a face whose middle falls in a bed takes that
    role (the bands); every other face `base`. `flutes` vertical rills: the
    radius pulled in by `flute` between ridges (badlands clay is rilled from
    top to bottom), the rill bottoms painted darker."""
    k = [1 + rng.uniform(-irregular, irregular) for _ in range(sides)]
    k = [(k[i - 1] + 2 * k[i] + k[(i + 1) % sides]) / 4 for i in range(sides)]
    # Round 6: a bed shows only where a band of faces falls inside it, and
    # a sparse profile (the butte's ten rings) missed most of them -- r05's
    # butte had no beds. Every bed's two edges become rings of their own.
    zs = sorted({z for z, _ in profile} | {z for b in beds for z in b[:2] if profile[0][0] < z < profile[-1][0]})
    def r_at(z):
        for (za, ra), (zb, rb) in zip(profile, profile[1:]):
            if za <= z <= zb:
                return ra + (rb - ra) * ((z - za) / max(zb - za, 1e-9))
        return profile[-1][1]
    profile = [(z, r_at(z)) for z in zs]
    H = max(z for z, _ in profile)
    shift = at.copy() if at is not None else Vector((0, 0, 0))
    rings = []
    for z, r in profile:
        shift = shift + drift(rng, r * .05)
        ring = []
        for i in range(sides):
            a = i / sides * math.tau
            f = 1.0
            if flutes:
                f = 1 - flute * (.5 + .5 * math.cos(a * flutes))
            p = Vector((math.cos(a) * r * xs * k[i] * f, math.sin(a) * r * ys * k[i] * f, z)) + shift
            x = mesh.bm.verts.new(p)
            val = lo + (hi - lo) * max(0.0, min(1.0, z / max(H, 1e-6)))
            if flutes:
                val *= 1 - .22 * (.5 + .5 * math.cos(a * flutes))
            mesh.paint[x] = (val, val, val, 0.0)
            ring.append(x)
        rings.append(ring)
    slot = {}
    for ra, rb, (za, _), (zb, _) in zip(rings, rings[1:], profile, profile[1:]):
        zm = (za + zb) * .5
        role = next((b[2] for b in beds if b[0] <= zm <= b[1]), base)
        if role not in slot:
            slot[role] = mesh.slot(role)
        for i in range(sides):
            i1 = (i + 1) % sides
            fc = mesh.bm.faces.new((ra[i], ra[i1], rb[i1], rb[i]))
            fc.material_index = slot[role]
            fc.smooth = True
    top = rings[-1]
    if len(top) > 2 and profile[-1][1] > 1e-3:
        fc = mesh.bm.faces.new(top)
        fc.material_index = mesh.slot(next((b[2] for b in beds if b[0] <= profile[-1][0] <= b[1]), base))
        fc.smooth = True
    return rings


def brule_beds(H, rng):
    """The White River beds up a spire of height H: grey-tan body (stone),
    pink beds (bark), thin red fossil-soil bands (accent), the white ash bed
    (dirt) high up. PLACED from the reference pictures."""
    beds = []
    z = H * rng.uniform(.04, .1)
    while z < H * .92:
        t = rng.random()
        th = H * rng.uniform(.015, .03)
        if t < .2:
            beds.append((z, z + th * .7, 'accent'))
        elif t < .85:
            th = H * rng.uniform(.04, .08)
            beds.append((z, z + th, 'bark'))
        z += th + H * rng.uniform(.04, .09)
    beds.append((H * .7, H * .74, 'dirt'))
    return beds


def mounds(height, girth, count, band):
    """The Yellow Mounds: rounded rilled haystacks of clay in a little
    group; one bed (accent) round each. For the boulder pipeline: stone and
    accent only."""
    def build(mesh, rng):
        for k in range(count):
            h = height * (1.0 if k == 0 else rng.uniform(.45, .8))
            r = girth * (h / height) ** .7
            at = heading(rng.uniform(0, math.tau)) * (0 if k == 0 else girth * rng.uniform(1.3, 1.7))
            # Round 2: r01's domes were hay bales; the mounds in 01-03 are
            # peaked cones with rilled flanks and a broad foot.
            # Round 3: the (1-t)^4 flare made a tent skirt; a plain cone,
            # rounded at the top, a gentle foot.
            prof = [(-.2, r * 1.1)] + [(h * t, r * (1 - t) ** 1.1 * (1 + .08 * (1 - t)) + r * .12 * math.sin(t * math.pi) * (t > .8))
                                       for t in (0, .12, .25, .38, .5, .62, .74, .85, .93, .98)]
            beds = [(h * band * .6, h * (band * .6 + .1), 'accent')]
            banded(mesh, rng, prof, 18, beds, at=at, flutes=12, flute=.06, irregular=.08)
    return build


# ---------------------------------------------------------------- Rocky Mountain juniper

def rmjuniper(height, spread, young):
    """Rocky Mountain juniper: blue-grey scale foliage in small upturned
    tufts. Young (`young`): a narrow pyramid nearly to the ground on a short
    red-brown trunk. Old: a leaning scraggly column, the trunk showing
    between irregular tiers of masses, a dead silver limb."""
    def build(mesh, rng):
        H, R = height, spread * .5
        lean = drift(rng, H * (.02 if young else .08))
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * (.92 if young else .85), H * (.035 if young else .05),
                              lean=lean, steps=6, sides=8, flare=1.5, bend=H * (.01 if young else .05),
                              shade_low=.7, shade_high=.95, wobble=.12)
        c = UP * H * .55 + lean * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.45, high=1.15)
        # Round 2: r01 was a column of separate balls up a pole (young) and
        # a lollipop (old). 01 is a DENSE broad pyramid of dark foliage to
        # the ground; 02 an old tree's dense, rounded, uneven crown. Masses
        # now overlap: a core ball each tier and a ring round it.
        tiers = 9 if young else 8
        # Round 3: r02's old tree read as a broadleaf oak; 02's old juniper
        # splits into two or three leaning leaders, each with its own
        # ragged clump of foliage.
        a0l = rng.uniform(0, math.tau)
        leaders = [heading(a0l + k * 2.1 + rng.uniform(-.3, .3)) * R * rng.uniform(.5, .7) for k in range(3)]
        if not young:
            base = pts[len(pts) // 3]
            for d in leaders:
                bark_tube(mesh, rng, [base, base + d * .5 + UP * H * .25, base + d + UP * H * .5], H * .03, H * .012, 6)
        for i in range(tiers):
            t = i / (tiers - 1)
            z = H * ((.1 if young else .3) + t * (.82 if young else .6))
            q0 = pts[0].lerp(pts[-1], z / H) if len(pts) > 1 else UP * z
            q0 = Vector((q0.x, q0.y, z))
            if not young:
                q0 = q0 + leaders[i % 3] * min(1.0, t * 1.6)
            rr = R * ((1 - t) ** 1.0 * .92 + .12) if young else R * (.75 + .3 * math.sin(t * math.pi)) * rng.uniform(.8, 1.0)
            if young:
                ball(mesh, rng, q0, (rr * .7, rr * .7, H * .09), c, shade, jitter=.25, u=7, v=4, bend=.5)
            n = max(4, int(round(rr / R * 9)))
            a0 = rng.uniform(0, math.tau)
            for k in range(n):
                if not young and rng.random() < .2:
                    continue
                a = a0 + k / n * math.tau + rng.uniform(-.3, .3)
                q = q0 + heading(a) * rr * rng.uniform(.5, .75) + UP * rng.uniform(-.1, .2) * H * .1
                # Round 12: upright tufts, smaller and more of them -- a fine,
                # ragged, upturned texture, not round lumps (r11).
                s = max(.3, rr * (rng.uniform(.36, .44) if young else rng.uniform(.28, .34)))
                mass(mesh, rng, q, s, 4, c, shade, u=5, v=3, squash=1.35, spread=.6, jitter=.3)
        top = pts[-1]
        mass(mesh, rng, top + UP * H * .02, R * (.22 if young else .3), 3, c, shade, u=6, v=4, squash=1.3, spread=.3)
        if not young:
            d = heading(rng.uniform(0, math.tau))
            p0 = pts[len(pts) // 2]
            bark_tube(mesh, rng, [p0, p0 + d * R * .6 + UP * H * .12, p0 + d * R * 1.0 + UP * H * .28], H * .015,
                      H * .004, 4, shade=(1.5, 1.8))
    return build


# ---------------------------------------------------------------- green ash

def greenash(height, spread, limbs):
    """Green ash in a draw: a straight grey trunk to half its height,
    forking into a few upright limbs under an open, rounded, uneven crown of
    leaf masses with sky through it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        # Round 2: r01 was a flat plate of leaves on a bare pole. 01 and 02
        # fork low (a third of the height) into an OVAL crown from there to
        # the top, uneven, sky through its edges.
        pts, radii = ct.trunk(mesh, rng, Vector((0, 0, 0)), H * .32, H * .04, lean=drift(rng, H * .02), steps=5,
                              sides=9, flare=1.5, bend=H * .015, shade_low=.75, shade_high=1.0, wobble=.06)
        top, r = pts[-1], radii[-1]
        c = UP * H * .62
        shade = ct.crown_shade(c, (R, R, H * .36), low=.45, high=1.15)
        a0 = rng.uniform(0, math.tau)
        for i in range(limbs):
            a = a0 + i / limbs * math.tau + rng.uniform(-.3, .3)
            d = heading(a)
            end = top + d * R * rng.uniform(.45, .65) + UP * H * rng.uniform(.4, .55)
            mid = top.lerp(end, .45) + UP * H * .04
            ct.limb(mesh, rng, top, mid, r * .7, r * .45, sides=6, bow=.1)
            ct.limb(mesh, rng, mid, end, r * .45, r * .15, sides=5, bow=-.1)
        # The oval: masses on rings up the crown, widest at its middle.
        for li in range(5):
            t = li / 4
            z = H * (.42 + .5 * t)
            rr = R * (.55 + .45 * math.sin((.15 + .85 * t) * math.pi)) * .95
            n = max(3, int(round(6 * rr / R)))
            off = rng.uniform(0, math.tau)
            for k in range(n):
                if rng.random() < .15:
                    continue
                a = off + k / n * math.tau
                q = heading(a) * rr * rng.uniform(.7, 1.0) + UP * z
                mass(mesh, rng, q, R * rng.uniform(.3, .38), 4, c, shade, u=7, v=4)
            ball(mesh, rng, UP * z, (rr * .6, rr * .6, H * .09), c, shade, jitter=.25, u=7, v=4, bend=.5)
    return build


# ---------------------------------------------------------------- chokecherry

def chokecherry(height, spread, stems):
    """A chokecherry thicket: many thin grey-brown stems leaning out from
    one patch, oval leaf masses along their upper halves, and flower spikes
    (accent: white in spring, dark cherries in summer)."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .5
        shade = ct.crown_shade(c, (R, R, H * .5), low=.45, high=1.15)
        # Round 2: r01 was a stand of separate stems with leaf lumps on top.
        # 01 and 03 are one DENSE rounded thicket, leaves to the ground, the
        # stems hidden; flower spikes all over its surface.
        for s in range(stems):
            a = rng.uniform(0, math.tau)
            d = heading(a)
            base = d * R * rng.uniform(0, .4)
            tip = base + d * R * rng.uniform(.2, .4) + UP * H * rng.uniform(.6, .9)
            bark_tube(mesh, rng, [base - UP * .05, base.lerp(tip, .5) + drift(rng, R * .08), tip], H * .02, H * .007, 5,
                      shade=(.7, .95), wobble=.1)
        for li in range(4):
            t = li / 3
            z = H * (.2 + .65 * t)
            rr = R * (.95 - .55 * t * t)
            n = max(3, int(round(8 * rr / R)))
            off = rng.uniform(0, math.tau)
            for k in range(n):
                a = off + k / n * math.tau
                q = heading(a) * rr * rng.uniform(.65, .95) + UP * z
                mass(mesh, rng, q, R * rng.uniform(.28, .34), 3, c, shade, u=6, v=4)
            ball(mesh, rng, UP * z, (rr * .7, rr * .7, H * .14), c, shade, jitter=.2, u=7, v=4, bend=.5)
        for j in range(stems * 2):
            a = rng.uniform(0, math.tau)
            t = rng.uniform(.25, 1.0)
            rr = R * (.95 - .55 * t * t)
            q = heading(a) * rr * 1.02 + UP * H * (.2 + .7 * t)
            ball(mesh, rng, q, (H * .03, H * .03, H * .06), c, None, role='accent', jitter=.1, u=5, v=3, value=1.0)
    return build


# ---------------------------------------------------------------- leadplant

def leadplant(height, spread, spikes):
    """Leadplant: a knee-high rounded mound of fine grey-green leaves (many
    small balls, a soft edge) with purple flower spikes (accent) standing
    up out of it."""
    def build(mesh, rng):
        H, R = height, spread * .5
        c = UP * H * .4
        shade = ct.crown_shade(c, (R, R, H * .4), low=.55, high=1.1)
        # Round 2: r01's leaf lumps were boulders and the spikes a fence of
        # upright cigars. 01-03: a loose fine-textured mound of many small
        # feathery tufts, the spikes splaying out from it at every angle.
        for k in range(60):
            a = k * ct.GOLDEN
            r = R * math.sqrt(rng.random()) * .85
            q = heading(a) * r + UP * H * rng.uniform(.15, .5) * (1 - .4 * r / R)
            ball(mesh, rng, q, (R * .11, R * .11, H * .1), c, shade, jitter=.15, u=6, v=4)
        for k in range(spikes):
            a = rng.uniform(0, math.tau)
            out = rng.uniform(.25, .7)
            base = heading(a) * R * rng.uniform(.1, .5) + UP * H * .45
            tip = base + heading(a) * H * out * .5 + UP * H * (.55 - out * .3)
            # Round 3: one tapered spike, not three beads; its stem green.
            mesh.add_tube([base, base.lerp(tip, .4)], [H * .012, H * .01], 4, 'leaf', rng=rng, cap_end=False)
            mesh.add_tube([base.lerp(tip, .4), base.lerp(tip, .75), tip], [H * .04, H * .03, H * .008], 5, 'accent', rng=rng)
    return build


# ---------------------------------------------------------------- bison

def bison():
    """An American bison bull, side on along Y (head toward -Y): the huge
    shoulder hump and deep chest under a shaggy dark cape (bark) that runs
    down the forelegs, a big low head with a beard and short curved horns
    (dirt), smaller lighter hindquarters (stone), a thin tufted tail. 1.86 m
    at the shoulder, 3.2 m long (Wikipedia: to 1.86 m and 3.5 m)."""
    def build(mesh, rng):
        soft = lambda lo, hi: (lambda p, n: lo + (hi - lo) * max(0.0, n.z))
        for x in (-.2, .2):
            for y, role, top in ((-.75, 'bark', 1.0), (.75, 'stone', .95)):
                mesh.add_tube([V(x, y, top), V(x, y, .4), V(x, y, .05)], [.17, .12, .09], 6, role, rng,
                              shade=lambda co, t: .85 - .25 * t)
                mesh.add_lump(V(x, y, .05), (.08, .09, .06), 'dirt', rng, subdiv=1, jitter=0)
        # Hindquarters and barrel (stone), the hump and cape (bark).
        mesh.add_lump(V(0, .45, 1.08), (.42, .6, .42), 'stone', rng, subdiv=2, jitter=.04, shade=soft(.75, 1.05))
        mesh.add_lump(V(0, -.45, 1.15), (.55, .75, .66), 'bark', rng, subdiv=2, jitter=.08, shade=soft(.7, 1.05))
        mesh.add_lump(V(0, -.55, 1.5), (.42, .5, .38), 'bark', rng, subdiv=2, jitter=.1, shade=soft(.75, 1.1))
        # Head low and forward, beard under it, horns.
        mesh.add_lump(V(0, -1.25, .95), (.3, .35, .36), 'bark', rng, subdiv=2, jitter=.1, shade=soft(.7, 1.0))
        mesh.add_lump(V(0, -1.45, .72), (.2, .18, .2), 'bark', rng, subdiv=1, jitter=.06)
        # Round 14: a fuller beard and a forelock (01, 03).
        mesh.add_lump(V(0, -1.3, .5), (.18, .17, .28), 'bark', rng, subdiv=1, jitter=.18, shade=soft(.55, .75))
        mesh.add_lump(V(0, -1.32, 1.12), (.2, .16, .12), 'bark', rng, subdiv=1, jitter=.2, shade=soft(.7, .9))
        for x in (-1, 1):
            base = V(x * .26, -1.25, 1.12)
            mesh.add_tube([base, base + V(x * .14, 0, .02), base + V(x * .16, .02, .16)], [.05, .04, .015], 5, 'dirt', rng)
        # Tail.
        mesh.add_tube([V(0, 1.02, 1.25), V(0, 1.12, .95), V(0, 1.1, .7)], [.03, .025, .02], 4, 'stone', rng)
        mesh.add_lump(V(0, 1.1, .64), (.05, .05, .09), 'bark', rng, subdiv=1, jitter=.1)
        # Round 2: the sheet looks along Y, so r01's bison was seen head-on, a
        # dark post. Turned a quarter so its length lies along X (the
        # references are all side-on); the game turns it freely.
        for v in mesh.bm.verts:
            x, y = v.co.x, v.co.y
            v.co.x, v.co.y = -y, x
            n = mesh.normal.get(v)
            if n is not None:
                mesh.normal[v] = Vector((-n.y, n.x, n.z))
    return build


MODELS = [
    ('Blender_BadlandsMound_1', mounds(5, 3.2, 3, .35)),
    ('Blender_BadlandsMound_2', mounds(3.5, 2.4, 2, .55)),
    ('Blender_RMJuniper_1', rmjuniper(6, 4.2, True)),
    ('Blender_RMJuniper_2', rmjuniper(6.5, 5.2, False)),
    ('Blender_GreenAsh_1', greenash(12, 9, 5)),
    ('Blender_Chokecherry_1', chokecherry(3.5, 4, 11)),
    ('Blender_Leadplant_1', leadplant(.8, 1.0, 12)),
    ('Blender_Bison_1', bison()),
]

SEASON = os.environ.get('FAIRWAY_SEASON', 'summer')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


# The rocks' colours (stone, bark, accent, dirt), from the study's specs
# (specs-built.json, PLACED from the pictures). A snow winter's white is the
# game's (snowTopped), not the model's.
ROCK = {'BadlandsMound': {'stone': '#d8b050', 'accent': '#a86a3a'},
        'Bison': {'stone': '#5a3e28', 'bark': '#3a2a1e', 'dirt': '#1e1a16', 'accent': '#3a2a1e'}}
BARK = {'RMJuniper': '#7a5040', 'GreenAsh': '#8a8478', 'Chokecherry': '#6a5650', 'Leadplant': '#7a7a62'}
# Leaf and accent a season, from specs-plants.json's seasons. A bare winter
# is the game's (bareInWinter); the leaf colour stands for it here.
LOOK = {
    'RMJuniper': {'spring': ('#557258', None), 'summer': ('#4e6a54', None), 'autumn': ('#4e6a54', None),
                  'winter': ('#52645a', None)},
    'GreenAsh': {'spring': ('#8aab5a', None), 'summer': ('#4f7a3a', None), 'autumn': ('#d8b030', None),
                 'winter': ('#4f7a3a', None)},
    'Chokecherry': {'spring': ('#7aa050', '#f2f0e6'), 'summer': ('#4a7038', '#5a1a2a'), 'autumn': ('#c0502a', '#3a1420'),
                    'winter': ('#4a7038', '#4a7038')},
    'Leadplant': {'spring': ('#a4b094', '#a4b094'), 'summer': ('#a0ac90', '#6a3a8a'), 'autumn': ('#a89a6a', '#7a6a5a'),
                  'winter': ('#9a9a8a', '#8a8a7a')},
}


def tints(season):
    out = {}
    for name, _ in MODELS:
        sp = name.replace('Blender_', '').rsplit('_', 1)[0]
        if sp in ROCK:
            out[name] = {r: hexrgb(c) for r, c in ROCK[sp].items()}
            continue
        look = LOOK[sp][season]
        t = {'leaf': hexrgb(look[0]), 'bark': hexrgb(BARK[sp])}
        if look[1]:
            t['accent'] = hexrgb(look[1])
        out[name] = t
    return out


ct.export(MODELS, colours={'leaf': (0.27, 0.45, 0.22), 'bark': (0.42, 0.32, 0.24), 'accent': (0.85, 0.72, 0.42),
                           'stone': (0.45, 0.40, 0.35), 'dirt': (0.85, 0.82, 0.78)},
          far={'Blender_RMJuniper_1', 'Blender_RMJuniper_2', 'Blender_GreenAsh_1'},
          tints=tints(SEASON))
