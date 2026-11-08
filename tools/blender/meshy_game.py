# Turns a full Meshy tree into the game's own form, run by tools/meshy-run.mjs
# --convert, on the processor:
#
#   blender -b -P meshy_game.py -- full.glb out.glb
#
# The game drops a texture and paints each part by its role, so this splits wood
# from leaf (materials `bark` and `leaves`), bakes the texture's light and dark to
# vertex paint, sets the wind's flex, and joins the vertices glTF split at texture
# seams. Writes <out>.json with what came out.
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_parts import read_tree, game_paint, leaf_light, vertex_normals, write_glb

args = sys.argv[sys.argv.index('--') + 1:]
full_path, out = args[0], args[1]
LEVEL = float(args[2]) if len(args) > 2 else .82

tree = read_tree(full_path)
_, weld = np.unique(np.round(tree.verts, 4), axis=0, return_inverse=True)
weld = weld.ravel()

parts, report = [], {}
for role, (name, faces) in enumerate((('leaves', np.where(~tree.wood)[0]), ('bark', np.where(tree.wood)[0]))):
    ids, new = {}, []
    source = weld[tree.tri[faces]]
    for f in source:
        for v in f:
            if v not in ids:
                ids[v] = len(ids)
    remap = np.array([[ids[v] for v in f] for f in source], np.int64).reshape(-1, 3)
    count = len(ids)
    if not count:
        continue  # a cactus is all body: no leaves part
    pos, weight, colour = np.zeros((count, 3)), np.zeros(count), np.zeros((count, 3))
    corners = tree.tri[faces].ravel()
    pos[remap.ravel()] = tree.verts[corners]
    area = np.repeat(tree.area[faces] + 1e-12, 3)
    np.add.at(weight, remap.ravel(), area)
    # A bough root painted brown keeps the leaves' own shade, not a dark patch.
    shown = tree.colour[faces].copy()
    if role == 0:
        leafy = shown[~tree.red[faces]]
        shown[tree.red[faces]] = leafy.mean(0) if len(leafy) else shown.mean(0)
    np.add.at(colour, remap.ravel(), np.repeat(shown, 3, axis=0) * area[:, None])
    colour /= weight[:, None] + 1e-12
    normal = vertex_normals(pos, remap)
    under = None
    if role == 0 and count:
        normal, under = leaf_light(pos, normal, tree)
    paint = game_paint(colour, pos, role, tree, under, LEVEL)
    parts.append((name, pos, normal, paint, remap))
    report[name] = {'vertices': int(count), 'triangles': int(len(remap))}

write_glb(out, parts[::-1])  # bark first, as the shipped models: a far version pairs up part for part
with open(out + '.json', 'w') as f:
    json.dump(report, f)
