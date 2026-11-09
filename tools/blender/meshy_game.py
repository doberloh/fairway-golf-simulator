# Turns a full Meshy tree into the game's own form, run by tools/meshy-run.mjs
# --convert, on the processor:
#
#   blender -b -P meshy_game.py -- full.glb out.glb
#
# The game drops a texture and paints each part by its role, so this splits wood
# from leaf (materials `bark` and `leaves`), bakes the texture's light and dark to
# vertex paint, sets the wind's flex, and joins the vertices glTF split at texture
# seams. Writes <out>.json with what came out.
#
# FLOWERS (the remakes, 9 November 2026): the paint keeps only light and dark, so
# a bougainvillea's magenta or a muhly's pink would come out green -- or brown,
# since the wood test takes any reddish face for bark. A model whose pack entry
# names `accent` colours gets a third part, `accent`, which the game paints from
# the species' own accent colour (src/season-tints.js): every face whose texture
# colour is nearer an accent colour than any of the entry's `plain` ones (its
# leaf and bark, read off tools/blender/meshy_colours.py). `leafOnly` makes every
# other face leaf -- a grass has no wood, and its green foot set off the green-wood
# split. Both reach here as MESHY_ACCENT, MESHY_PLAIN and MESHY_LEAFONLY.
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_parts import read_tree, game_paint, leaf_light, vertex_normals, write_glb, luminance

args = sys.argv[sys.argv.index('--') + 1:]
full_path, out = args[0], args[1]
LEVEL = float(args[2]) if len(args) > 2 else .82


def linear(hexes):
    c = np.array([[int(h.strip().lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)] for h in hexes if h.strip()])
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4) if len(c) else np.zeros((0, 3))


tree = read_tree(full_path)
accent_ref, plain_ref = linear(os.environ.get('MESHY_ACCENT', '').split(',')), linear(os.environ.get('MESHY_PLAIN', '').split(','))
accent = np.zeros(len(tree.tri), bool)
if len(accent_ref):
    if not len(plain_ref):
        raise SystemExit('accent colours need plain ones to tell them from')
    # Compared in sRGB, the way the colours were read off: linear light crowds the
    # darks together, where a shaded leaf and a shaded bract would meet.
    to_srgb = lambda c: np.where(c <= .0031308, c * 12.92, 1.055 * np.clip(c, 0, 1) ** (1 / 2.4) - .055)
    col = to_srgb(tree.colour)
    near = lambda refs: ((col[:, None] - to_srgb(refs)[None]) ** 2).sum(2).min(1)
    accent = near(accent_ref) < near(plain_ref)
wood = tree.wood & ~accent
# `leafColours` (MESHY_LEAFCOL): faces nearer these than any `plain` colour are leaf whatever the wood
# test said -- a teddy-bear cholla's pale yellow-green joints passed it (green under 1.25 times red).
leaf_ref = linear(os.environ.get('MESHY_LEAFCOL', '').split(','))
if len(leaf_ref):
    if not len(plain_ref):
        raise SystemExit('leaf colours need plain ones to tell them from')
    to_srgb = lambda c: np.where(c <= .0031308, c * 12.92, 1.055 * np.clip(c, 0, 1) ** (1 / 2.4) - .055)
    col = to_srgb(tree.colour)
    near = lambda refs: ((col[:, None] - to_srgb(refs)[None]) ** 2).sum(2).min(1)
    wood &= ~(near(leaf_ref) < near(plain_ref))
if os.environ.get('MESHY_LEAFONLY'):
    wood = np.zeros(len(tree.tri), bool)
leaf = ~wood & ~accent
if accent.any():
    tree.refs['accent'] = float(np.average(luminance(tree.colour[accent]), weights=tree.area[accent] + 1e-12))
    if leaf.any():
        tree.refs['leaf'] = float(np.average(luminance(tree.colour[leaf]), weights=tree.area[leaf] + 1e-12))
if leaf.any() and not np.array_equal(leaf, ~tree.wood):
    tree.refs['leaf'] = float(np.average(luminance(tree.colour[leaf]), weights=tree.area[leaf] + 1e-12))
if wood.any() and not np.array_equal(wood, tree.wood):
    tree.refs['bark'] = float(np.average(luminance(tree.colour[wood]), weights=tree.area[wood] + 1e-12))
_, weld = np.unique(np.round(tree.verts, 4), axis=0, return_inverse=True)
weld = weld.ravel()

parts, report = [], {}
for name, faces, kind in (('leaves', np.where(leaf)[0], 'leaf'), ('bark', np.where(wood)[0], 'bark'), ('accent', np.where(accent)[0], 'accent')):
    ids, new = {}, []
    source = weld[tree.tri[faces]]
    for f in source:
        for v in f:
            if v not in ids:
                ids[v] = len(ids)
    remap = np.array([[ids[v] for v in f] for f in source], np.int64).reshape(-1, 3)
    count = len(ids)
    report[name] = {'vertices': int(count), 'triangles': int(len(remap))}
    if not count:
        continue  # a cactus is all body: no leaves part; most models have no accent
    pos, weight, colour = np.zeros((count, 3)), np.zeros(count), np.zeros((count, 3))
    corners = tree.tri[faces].ravel()
    pos[remap.ravel()] = tree.verts[corners]
    area = np.repeat(tree.area[faces] + 1e-12, 3)
    np.add.at(weight, remap.ravel(), area)
    # A bough root painted brown keeps the leaves' own shade, not a dark patch.
    shown = tree.colour[faces].copy()
    if kind == 'leaf':
        leafy = shown[~tree.red[faces]]
        shown[tree.red[faces]] = leafy.mean(0) if len(leafy) else shown.mean(0)
    np.add.at(colour, remap.ravel(), np.repeat(shown, 3, axis=0) * area[:, None])
    colour /= weight[:, None] + 1e-12
    normal = vertex_normals(pos, remap)
    under = None
    if kind != 'bark':
        normal, under = leaf_light(pos, normal, tree)
    paint = game_paint(colour, pos, 0 if kind != 'bark' else 1, tree, under, LEVEL, ref=kind)
    # `barkLevel` (MESHY_BARKLEVEL): the bark's paint is measured from its own mean, so a trunk with dark
    # dead joints on it reads lighter than one without -- cholla 1 against cholla 2 (the owner: "cholla 1
    # colors are off. Make them match cholla 2"). A pack entry darkens or lightens it here.
    if kind == 'bark' and os.environ.get('MESHY_BARKLEVEL'):
        paint[:, :3] *= float(os.environ['MESHY_BARKLEVEL'])
    parts.append((name, pos, normal, paint, remap))

# STALKS (MESHY_STALKS, a pack entry's `stalks`; the muhly's second round, 9 November 2026): Meshy
# keeps a fist-sized plume but drops the pencil-thin stalk under it, so the owner's separated plumes
# floated over the clump. Each plume -- a connected piece of the flower part -- gets a thin green
# four-sided stalk, from inside the clump to the plume's lowest point, as leaf.
if os.environ.get('MESHY_STALKS') and accent.any():
    faces = np.where(accent)[0]
    root = {}

    def find(x):
        while root.setdefault(x, x) != x:
            root[x] = root[root[x]]
            x = root[x]
        return x
    for f in faces:
        a, b, c = weld[tree.tri[f]]
        root[find(b)] = find(a)
        root[find(c)] = find(a)
    pieces = {}
    for f in faces:
        pieces.setdefault(find(weld[tree.tri[f][0]]), []).append(f)
    base_z = tree.lo[2] + tree.H * .12
    centre_xy = tree.ax_at(np.array([base_z]))[0]
    blades = (~accent).copy()
    if blades.any():
        centre_xy = np.average(tree.centre[blades][:, :2], axis=0, weights=tree.area[blades])
    R = tree.H * .007
    spos, sfaces = [], []
    for piece in pieces.values():
        if len(piece) < 4:
            continue
        corners = tree.verts[tree.tri[piece].ravel()]
        top = corners[corners[:, 2].argmin()]
        mid = corners.mean(0)
        top = np.array([mid[0], mid[1], top[2] + (mid[2] - top[2]) * .3])  # a little into the plume
        bottom = np.array([centre_xy[0] + (top[0] - centre_xy[0]) * .2, centre_xy[1] + (top[1] - centre_xy[1]) * .2, base_z])
        axis = top - bottom
        axis /= np.linalg.norm(axis) + 1e-12
        side = np.cross(axis, [0, 0, 1])
        side = side / (np.linalg.norm(side) + 1e-12) if np.linalg.norm(side) > 1e-6 else np.array([1., 0, 0])
        other = np.cross(axis, side)
        k = len(spos)
        for end, r in ((bottom, R), (top, R * .6)):
            for a in range(4):
                ang = a * np.pi / 2
                spos.append(end + (side * np.cos(ang) + other * np.sin(ang)) * r)
        for a in range(4):
            b = (a + 1) % 4
            sfaces += [[k + a, k + b, k + 4 + b], [k + a, k + 4 + b, k + 4 + a]]
    if spos:
        spos, sfaces = np.array(spos), np.array(sfaces, np.int64)
        snormal = vertex_normals(spos, sfaces)
        flex = np.clip((spos[:, 2] - tree.lo[2]) / tree.H, 0, 1)
        paint = np.stack([np.full(len(spos), .45)] * 3 + [flex], -1)  # a shade of .9, halved as game_paint stores it
        parts.append(('leaves', spos, snormal, paint, sfaces))
        report['stalks'] = {'vertices': int(len(spos)), 'triangles': int(len(sfaces))}

# Bark first, as the shipped models: a far version pairs up part for part.
order = {'bark': 0, 'leaves': 1, 'accent': 2}
write_glb(out, sorted(parts, key=lambda p: order[p[0]]))
with open(out + '.json', 'w') as f:
    json.dump(report, f)
