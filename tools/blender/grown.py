# TREES BUILT AS THEY GROW (the owner, 5 November 2026, on the Redwood Coast's
# trees: "trees arent solid like this in the middle" and "the tree trunk is the
# same width almost the whole height ... not how real trees work"). Wood that
# narrows all the way up; limbs as wood, uneven, thinning; foliage only on limbs,
# in separate clusters, with air and sky between. No filler shape, ever. The owner
# means this approach for many other models later: a pack takes these builders
# rather than growing its own (docs/BLENDER_ASSETS.md, *Built as it grows*).
import math, random
from mathutils import Vector
import cartoon as ct


# A TREE IS BUILT AS IT GROWS (the owner, 5 November 2026, of a crown built on a
# solid core: "trees arent solid like this in the middle"). The trunk runs to the
# top; limbs leave it, unevenly, as wood; foliage is only ever on a limb, in
# separate hanging sprays, with air between them and sky through the crown. There
# is no filler. Too thin means more or better placed sprays, never a mass.
# Northwood's photographs (the study's redwood.coast 03 and 04): a mature tree is
# bare for a third to a half of its height, its crown open and wispy, the trunk
# seen running up through it.
#   base,top  where limbs leave the trunk, over height
#   step      the gap from one limb to the next, over height (it varies)
#   reach     the longest limb, over height, at `widest` along the crown
#   power     how the limbs shorten toward the top
#   down,up   a low limb's hang and a high limb's lift, over its length
#   tip       how far a limb's end lifts back up
#   limb      a limb's radius at the trunk, over height
#   sprays    sprays a limb, from `first` of the way along it to its end
#   slen      a spray's length, over its limb's
#   hang      how steeply a spray hangs, radians
#   bare      the share of limbs that are bare or dead
def along(ca, sa, start, L, t, rise, droop, tip):
    d = L * t
    lift = tip * L * max(0, t - .5) ** 2 * 4
    return start + Vector((ca * d, sa * d, rise * L * t - droop * L * t * t + lift))


def blade(mesh, idx, pts, normal, shades, flex=.7):
    """A flat thin shape, seen from both sides (vegetation.js THIN_LEAVES), one
    normal for all of it so it shades as a soft mass rather than as facets."""
    verts = [mesh.bm.verts.new(p) for p in pts]
    for k in range(1, len(verts) - 1):
        mesh.bm.faces.new((verts[0], verts[k], verts[k + 1])).material_index = idx
    for v, m in zip(verts, shades):
        mesh.normal[v] = normal
        mesh.paint[v] = (m, m, m, flex)


def needle_spray(mesh, rng, q, a, length, width, hang, trunk, light, pairs):
    """Foliage as it is on a redwood or a fir: a stem carrying pairs of thin
    pointed leaflets, swept forward, longest a third of the way along, flat in one
    plane and sagging to the tip. Everything about it is a point; nothing is a
    block (the owner: "the leafage on these trees looks too blocky"). Dark at a
    leaflet's root, light at its tip, so a crown has a grain."""
    idx = mesh.slot('leaf')
    ca, sa, cd, sd = math.cos(a), math.sin(a), math.cos(hang), math.sin(hang)
    roll = rng.uniform(-.45, .45)
    cr, sr = math.cos(roll), math.sin(roll)
    def place(x, y, z=0):
        y, z = y * cr - z * sr, y * sr + z * cr
        z -= length * .3 * (x / length) ** 2
        x, z = x * cd + z * sd, -x * sd + z * cd
        return q + Vector((x * ca - y * sa, x * sa + y * ca, z))
    out = place(length * .5, 0) - trunk
    out = out.normalized() if out.length > 1e-6 else Vector((0, 0, 1))
    normal = (out * .5 + Vector((0, 0, 1)) * .5).normalized()
    step = length / pairs
    for k in range(pairs):
        r = (k + .4) / pairs
        reach = width * .5 * (math.sin(math.pi * min(1, r * .86 + .14)) ** .6) * rng.uniform(.82, 1.14)
        x = length * r
        for side in (-1, 1):
            tip = place(x + reach * .85, side * reach * rng.uniform(.9, 1.08), -reach * .12)
            m = light * rng.uniform(.9, 1.1)
            blade(mesh, idx, [place(x - step * .34, 0), tip, place(x + step * .34, 0)], normal, [m * .78, m * 1.16, m * .78])
    # The end of the spray: one more point.
    blade(mesh, idx, [place(length * .86, -step * .3), place(length * 1.1, 0), place(length * .86, step * .3)], normal, [light * .85, light * 1.15, light * .85])


def leaf_cluster(mesh, rng, q, size, trunk, light, leaves):
    """A broadleaf's foliage: a twig's end of real leaves, each a long pointed
    shape, fanned out and drooping. Never a square (the owner, of the tanoak:
    "literally squares for leaves")."""
    idx = mesh.slot('leaf')
    out = q - trunk
    out = out.normalized() if out.length > 1e-6 else Vector((0, 0, 1))
    normal = (out * .5 + Vector((0, 0, 1)) * .5).normalized()
    a0 = rng.uniform(0, math.tau)
    for k in range(leaves):
        a = a0 + k / leaves * math.tau + rng.uniform(-.3, .3)
        length = size * rng.uniform(.8, 1.2)
        tilt = rng.uniform(.15, .75)
        along_leaf = Vector((math.cos(a) * math.cos(tilt), math.sin(a) * math.cos(tilt), -math.sin(tilt)))
        across = Vector((-math.sin(a), math.cos(a), 0)) * length * .17
        start = q + along_leaf * length * rng.uniform(0, .25)
        m = light * rng.uniform(.86, 1.14)
        blade(mesh, idx, [start, start + along_leaf * length * .42 + across, start + along_leaf * length, start + along_leaf * length * .42 - across],
              normal, [m * .8, m, m * 1.12, m])


def limbs(mesh, rng, H, c):
    base, top, w, step = c['base'], c['top'], c['widest'], c['step']
    sprays, slen = c['sprays'], c['slen']
    if ct.FAR:
        # A FAR TREE PAYS FOR THE FOREST: thousands of them stand in a frame, so
        # about 400 triangles, wide sprays of few leaflets on a third of the
        # limbs and no limb wood (2,270 cost 117 million triangles a frame on
        # High, four times Puget Sound; round 18).
        step, sprays, slen = step * 3.1, 3, slen * 2.3
    z, a = base, rng.uniform(0, math.tau)
    while z < top:
        t = (z - base) / (top - base)
        reach = ((1 - t) / (1 - w) if t >= w else 1) ** c['power'] * (1 if t >= w else .62 + .38 * t / w)
        L = H * c['reach'] * reach * rng.uniform(.68, 1.14) + H * .012
        a += 2.4 + rng.uniform(-.55, .55)
        ca, sa = math.cos(a), math.sin(a)
        rise, droop, tip = c['up'] * t, c['down'] * (1 - t) ** 1.2, c['tip'] * (1 - t * .5)
        start = Vector((0, 0, H * z))
        pts = [along(ca, sa, start, L, f, rise, droop, tip) for f in (0, .5, 1)]
        r0 = H * c['limb'] * (reach * .75 + .25) * (1 - .55 * t)
        if not ct.FAR:
            mesh.add_tube(pts, [r0, r0 * .55, r0 * .14], 3, 'bark', rng=rng, wobble=.05, shade=lambda co, f: .55 + .2 * f, flex=lambda co, f: .1 + .4 * f)
        if rng.random() >= c['bare'] * (1 - t):
            first = c.get('first', .32)
            for k in range(sprays):
                f = first + (1 - first) * (k + rng.uniform(.25, .85)) / sprays
                side = (1 if k % 2 else -1) * rng.uniform(.04, c.get('fan', .2)) * L
                q = along(ca, sa, start, L, f, rise, droop, tip) + Vector((-sa * side, ca * side, rng.uniform(-.06, .03) * L))
                n = max(L * slen, H * c.get('least', .028)) * rng.uniform(.8, 1.2) * (1.15 - .3 * f)
                # Lighter out at the tips and high up, darker in toward the trunk.
                light = .42 + .42 * f + .24 * t
                needle_spray(mesh, rng, q, a + rng.uniform(-.75, .75), n, n * c.get('wide', .5), c['hang'] * rng.uniform(.6, 1.3), Vector((0, 0, H * z)), light, 2 if ct.FAR else c.get('pairs', 7))
        z += step * rng.uniform(.5, 1.55) * (1 - .35 * t)


def girth(t, power=.82, flare=1.28):
    """A trunk's radius up its height, its foot 1 (the owner: "the tree trunk is
    the same width almost the whole height ... not how real trees work"). Wood
    narrows all the way, because each height only carries what grows above it:
    about 0.57 at mid-height and nothing at the tip, measured off Northwood's
    photographs by eye (PLACED); a root flare in the bottom few metres on top."""
    return (1 - t) ** power * (1 + (flare - 1) * math.exp(-t * 18)) + .004


def fluted_trunk(mesh, rng, H, top_z, radius, flare, flutes, shade_low=.7, shade_high=1.0, power=.82, deep=.16):
    """A trunk pleated into flutes: rings whose radius rises and falls round
    the circumference, deepest at the foot, painted darker in the grooves."""
    rings, n, steps = [], 6 if ct.FAR else flutes * 2, 5 if ct.FAR else 14
    for k in range(steps + 1):
        t = k / steps
        z = top_z * t
        r = radius * (girth(t, power, flare) if flare < 2 else (1 - .35 * t) * (1 + (flare - 1) * math.exp(-t * 10)))
        depth = deep * (1 - t) + .04
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


def broadleaf(mesh, rng, H, R, c):
    """A broadleaf: a tapering stem, limbs off it that fork into branches, and
    leaves in small separate clusters strung along the branches, not at their
    ends and never one mass.
      stem,foot  the stem's height and its foot's radius, over the tree's height
      first      where limbs start, over height
      limbs      how many; `sweep` how steeply they climb (rise over reach)
      branches   forks a limb; clusters: leaf clusters a branch
      size       a cluster's half-width over the crown's radius
      leaves     leaves a cluster"""
    fluted_trunk(mesh, rng, H, H * c['stem'], H * c['foot'], 1.22, 5, power=.8, deep=.05)
    n, branches, clusters = c['limbs'], c['branches'], c['clusters']
    if ct.FAR:
        n, branches, clusters = n * 2 // 3, 3, 1
    a = rng.uniform(0, math.tau)
    centre = Vector((0, 0, H * .58))
    for i in range(n):
        f = c['first'] + (c['stem'] - c['first']) * i / (n - 1) + rng.uniform(-.03, .03)
        a += 2.4 + rng.uniform(-.4, .4)
        t = (f - c['first']) / (1 - c['first'])
        reach = R * (.62 + .9 * t) * (1 - t) ** .75 * rng.uniform(.85, 1.2) + R * .16
        base = Vector((0, 0, H * f))
        out = Vector((math.cos(a), math.sin(a), 0))
        end = base + out * reach + Vector((0, 0, reach * c['sweep']))
        r0 = H * .0085 * (1 - .6 * t)
        mesh.add_tube([base, base.lerp(end, .5) + Vector((0, 0, -reach * .06)), end], [r0, r0 * .6, r0 * .2], 3, 'bark', rng=rng, wobble=.08,
                      shade=lambda co, q: .7 + .2 * q, flex=lambda co, q: .1 + .3 * q)
        for k in range(branches):
            p0 = base.lerp(end, rng.uniform(.3, 1))
            side = Vector((-out.y, out.x, 0)) * (rng.uniform(.3, .9) * (1 if k % 2 else -1)) + out * rng.uniform(.1, .7)
            p1 = p0 + side * reach * .6 + Vector((0, 0, reach * rng.uniform(-.1, .34)))
            if not ct.FAR:
                mesh.add_tube([p0, p1], [r0 * .32, r0 * .08], 3, 'bark', rng=rng, shade=lambda co, q: .75, flex=lambda co, q: .4)
            for j in range(clusters):
                q = p0.lerp(p1, rng.uniform(.25, 1.15)) + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-.7, .5))) * R * .08
                w = R * c['size'] * rng.uniform(.75, 1.25) * (1.8 if ct.FAR else 1)
                light = .5 + .55 * max(0, min(1, (q.z / H - .3) / .7)) * rng.uniform(.8, 1.1)
                leaf_cluster(mesh, rng, q, w * 1.7, centre, light, 3 if ct.FAR else c.get('leaves', 6))
