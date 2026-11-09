# The colours a Meshy model is painted in, grouped, with each group's share of
# the surface -- what tools/meshy/<pack>.json `accent` is chosen from:
#
#   blender -b -P meshy_colours.py -- full.glb [groups]
#
# Prints one line a group: its sRGB hex, its share of the area, and how high on
# the model it sits on average (0 foot, 1 top). Reads only; writes nothing.
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_parts import read_tree

args = sys.argv[sys.argv.index('--') + 1:]
k = int(args[1]) if len(args) > 1 else 6
tree = read_tree(args[0])
c, w = tree.colour, tree.area / tree.area.sum()
srgb = np.where(c <= .0031308, c * 12.92, 1.055 * np.clip(c, 0, 1) ** (1 / 2.4) - .055)
rng = np.random.default_rng(1)
mids = srgb[rng.choice(len(srgb), k, replace=False, p=w)]
for _ in range(30):
    lab = ((srgb[:, None] - mids[None]) ** 2).sum(2).argmin(1)
    mids = np.stack([np.average(srgb[lab == j], axis=0, weights=w[lab == j]) if (lab == j).any() else mids[j] for j in range(k)])
height = (tree.centre[:, 2] - tree.lo[2]) / max(tree.H, 1e-9)
for j in np.argsort([-w[lab == j].sum() for j in range(k)]):
    if not (lab == j).any():
        continue
    hexc = '#' + ''.join(f'{int(round(v * 255)):02x}' for v in np.clip(mids[j], 0, 1))
    print(f'GROUP {hexc} share {w[lab == j].sum():.2f} height {np.average(height[lab == j], weights=w[lab == j]):.2f} wood {tree.wood[lab == j].mean():.2f}')
