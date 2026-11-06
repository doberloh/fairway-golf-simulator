# What the Meshy tools share: reading a tree into wood and leaf, and writing a
# model the way the game takes one (docs/BLENDER_ASSETS.md, *What the game keeps
# from a model*). Used by meshy_far.py and meshy_game.py.
import json, math, struct
from types import SimpleNamespace
import bpy
import numpy as np

BINS = 40
PAINT_RANGE = (.35, 1.7)  # a shade, as a multiplier on the colour the game paints
# A shipped crown's normals never face the ground (mean height 0.69) and its paint
# averages 0.75. A Meshy crown's are half downward (mean 0), which the game's light
# turns near black. So they are mirrored upward and bent out from the trunk, keeping
# some of each facet, and the shade they stood for moves into the paint.
BEND = .6  # share of a leaf's normal turned out and up
LEAF_LEVEL = .82  # the paint's level unless the pack sets one (paintLevel)
UNDER_SHADE = .35  # how much darker a face turned fully to the ground is painted


def load(path):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.gltf(filepath=path)
    ob = [o for o in bpy.context.selected_objects if o.type == 'MESH'][0]
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def luminance(c):
    return c[..., 0] * .2126 + c[..., 1] * .7152 + c[..., 2] * .0722


def read_tree(path):
    full = load(path)
    mesh = full.data
    image = next(n.image for n in full.active_material.node_tree.nodes if n.type == 'TEX_IMAGE')
    W, H_ = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(H_, W, -1)[..., :3]
    pixels = np.where(pixels <= .04045, pixels / 12.92, ((pixels + .055) / 1.055) ** 2.4)  # paint is linear
    verts = np.array([v.co[:] for v in mesh.vertices])
    uv = mesh.uv_layers.active.data
    polys = mesh.polygons
    tri = np.array([[mesh.loops[i].vertex_index for i in p.loop_indices] for p in polys])
    tuv = np.array([[uv[i].uv[:] for i in p.loop_indices] for p in polys])

    def sample(u):
        x = np.clip((u[..., 0] % 1) * W, 0, W - 1).astype(int)
        y = np.clip((u[..., 1] % 1) * H_, 0, H_ - 1).astype(int)
        return pixels[y, x]

    colour = (sample(tuv).sum(1) + sample(tuv.mean(1))) / 4  # three corners and the centre
    red = colour[:, 1] < colour[:, 0] * 1.25  # wood: grey bark as well as red, never leaf
    centre = verts[tri].mean(1)
    area = np.array([p.area for p in polys])
    lo, hi = verts.min(0), verts.max(0)
    H = hi[2] - lo[2]

    # The trunk: at each height its axis and radius from the wood-coloured faces,
    # narrowing only as it rises, so a limb never counts as trunk.
    edges = np.linspace(lo[2], hi[2], BINS + 1)
    z_mid = (edges[:-1] + edges[1:]) / 2
    axis, radius = np.zeros((BINS, 2)), np.zeros(BINS)
    for i in range(BINS):
        pts = centre[red & (centre[:, 2] >= edges[i]) & (centre[:, 2] < edges[i + 1])]
        if len(pts) < 3:
            axis[i] = axis[i - 1] if i else (lo[:2] + hi[:2]) / 2
            radius[i] = radius[i - 1] * .9 if i else H * .03
            continue
        axis[i] = np.median(pts[:, :2], 0)
        radius[i] = np.percentile(np.linalg.norm(pts[:, :2] - axis[i], axis=1), 65)
    for i in range(1, BINS):
        radius[i] = min(radius[i], radius[i - 1])

    def ax_at(z):
        return np.stack([np.interp(z, z_mid, axis[:, 0]), np.interp(z, z_mid, axis[:, 1])], -1)

    def rad_at(z):
        return np.interp(z, z_mid, radius)

    dist = np.linalg.norm(centre[:, :2] - ax_at(centre[:, 2]), axis=1)

    # Below the crown nothing but trunk grows, flutes and flare included, so the
    # bare trunk is all trunk and its true width is measured there. Leaf far from
    # the axis marks the crown: green smeared on the trunk's foot does not.
    crown = ~red & (dist > rad_at(centre[:, 2]) * 2)
    crown_base = np.percentile(centre[crown, 2], .5) if crown.any() else lo[2]
    for i in range(BINS):
        pts = centre[(centre[:, 2] >= edges[i]) & (centre[:, 2] < edges[i + 1])]
        if z_mid[i] < crown_base and len(pts) >= 3:
            radius[i] = np.percentile(np.linalg.norm(pts[:, :2] - axis[i], axis=1), 80)
    radius = np.array([np.median(radius[max(0, i - 2):i + 3]) for i in range(BINS)])
    for i in range(BINS - 2, -1, -1):
        radius[i] = max(radius[i], radius[i + 1])
    trunk = (dist < rad_at(centre[:, 2]) * 1.3) | (centre[:, 2] < crown_base)

    # Wood for the game's paint. Below the crown, everything. In the crown, only a
    # wood-coloured face on the trunk's own taper that looks outward from it, or a
    # real limb. The generator paints each bough's root the trunk's colour, and the
    # radius read in the crown takes those roots in, so the taper is drawn from the
    # bare trunk's width to the tip; left as wood they showed as brown wedges.
    bare_radius = float(rad_at(np.array([crown_base]))[0])
    climb = np.clip((centre[:, 2] - crown_base) / max(hi[2] - crown_base, 1e-6), 0, 1)
    taper = bare_radius * (1 - climb) ** .8 + H * .002
    fn = np.cross(verts[tri[:, 1]] - verts[tri[:, 0]], verts[tri[:, 2]] - verts[tri[:, 0]])
    fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
    side = centre[:, :2] - ax_at(centre[:, 2])
    side /= np.linalg.norm(side, axis=1, keepdims=True) + 1e-12
    facing = (fn[:, :2] * side).sum(1)
    # The test starts below the crown's base, because the lowest boughs' roots hang
    # under it, and a trunk's side stands upright while a bough's shoulder does not.
    # Below the crown an upright face on the trunk is wood whatever its colour,
    # because the generator smears green on bark.
    on_trunk = (dist < np.maximum(taper * 1.3, rad_at(centre[:, 2]) * 1.15)) & (np.abs(fn[:, 2]) < .6)
    tall = np.ptp(verts[tri][:, :, 2], axis=1) > H * .04  # only a trunk has faces this long
    wood = (centre[:, 2] < crown_base - H * .07) | (on_trunk & (red | tall | (centre[:, 2] < crown_base)))
    # A long upright face this near the axis is trunk however thin the radius read:
    # the fuller young trees and cedars hide their trunks from that measure.
    long_face = np.ptp(verts[tri][:, :, 2], axis=1) > H * .06
    wood |= long_face & (np.abs(fn[:, 2]) < .3) & (dist < np.maximum(rad_at(centre[:, 2]) * 1.6, H * .07))
    _, weld = np.unique(np.round(verts, 4), axis=0, return_inverse=True)
    weld = weld.ravel()
    root = list(range(weld.max() + 1))

    def find(x):
        while root[x] != x:
            root[x] = root[root[x]]
            x = root[x]
        return x

    loose = np.where(red & ~wood)[0]
    for f in loose:
        a, b, c = weld[tri[f]]
        root[find(b)] = find(a)
        root[find(c)] = find(a)
    patches = {}
    for f in loose:
        patches.setdefault(find(weld[tri[f][0]]), []).append(int(f))
    for faces in patches.values():
        if len(faces) < 3:
            continue
        pts = centre[faces] - centre[faces].mean(0)
        spread = np.linalg.svd(pts, compute_uv=False)
        reach = np.ptp(pts @ np.linalg.svd(pts, full_matrices=False)[2][0])
        if spread[1] < spread[0] * .3 and reach > H * .03:
            wood[faces] = True
    weights = area + 1e-12
    refs = {'leaf': float(np.average(luminance(colour[~wood]), weights=weights[~wood])) if (~wood).any() else 1.,
            'bark': float(np.average(luminance(colour[wood]), weights=weights[wood])) if wood.any() else 1.}
    reach = float(np.percentile(dist[~wood], 98)) if (~wood).any() else H * .2
    return SimpleNamespace(ob=full, verts=verts, tri=tri, colour=colour, red=red, centre=centre, area=area, lo=lo, hi=hi, H=H,
                           dist=dist, trunk=trunk, wood=wood, crown_base=crown_base, ax_at=ax_at, rad_at=rad_at, refs=refs, reach=reach)


def leaf_light(pos, normal, tree):
    """Leaf normals for the game's light, and how far each faced the ground."""
    under = np.clip(-normal[:, 2], 0, 1)
    n = normal.copy()
    n[:, 2] = np.abs(n[:, 2])
    out = pos - np.append(tree.ax_at(pos[:, 2]), np.zeros((len(pos), 1)), 1)
    out[:, 2] = 0
    out /= np.linalg.norm(out, axis=1, keepdims=True) + 1e-12
    out[:, 2] = 1
    out /= np.linalg.norm(out, axis=1, keepdims=True)
    n = n * (1 - BEND) + out * BEND
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12), under


def game_paint(colour, pos, role, tree, under=None, level=LEAF_LEVEL):
    """RGB is a grey multiplier on the colour the game paints the role, stored
    halved, so seasons and tints still work; alpha is the wind's flex."""
    shade = np.clip(luminance(np.asarray(colour)) / tree.refs['leaf' if role == 0 else 'bark'], *PAINT_RANGE)
    pos = np.asarray(pos)
    if role == 0:
        shade = shade * level * (1 - UNDER_SHADE * (0 if under is None else under))
        out = np.linalg.norm(pos[..., :2] - tree.ax_at(pos[..., 2]), axis=-1)
        flex = np.clip(out / tree.reach, .15, 1)
    else:
        flex = np.clip((pos[..., 2] - tree.lo[2]) / tree.H, 0, 1) ** 2 * .2
    return np.stack([shade * .5, shade * .5, shade * .5, flex], -1)


def vertex_normals(pos, faces):
    n = np.zeros_like(pos)
    f = np.asarray(faces)
    fn = np.cross(pos[f[:, 1]] - pos[f[:, 0]], pos[f[:, 2]] - pos[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def cache_order(faces, count, size=32):
    """Triangles in the order a graphics card's vertex cache likes, so a vertex
    shared by neighbours is shaded once. Tom Forsyth's linear-speed method. A
    generated model's order is close to random: it shaded 2.8 vertices a triangle
    where 0.7 can be had (RESEARCH.md, *Frame rate on Low*)."""
    faces = [tuple(int(v) for v in f) for f in faces]
    uses = [[] for _ in range(count)]
    for i, f in enumerate(faces):
        for v in f:
            uses[v].append(i)
    left = [len(u) for u in uses]
    position = [-1] * count
    cache_score = [0.] * (size + 3)
    for p in range(size + 3):
        cache_score[p] = .75 if p < 3 else max(0., 1 - (p - 3) / (size - 3)) ** 1.5 if p < size else 0.

    def score(v):
        if left[v] == 0:
            return -1.
        s = cache_score[position[v]] if position[v] >= 0 else 0.
        return s + 2. * left[v] ** -.5

    vertex = [score(v) for v in range(count)]
    tri = [sum(vertex[v] for v in f) for f in faces]
    done = [False] * len(faces)
    order, cache = [], []
    candidates = set()
    next_seed = sorted(range(len(faces)), key=lambda i: -tri[i])
    seed = 0
    while len(order) < len(faces):
        best = max(candidates, key=lambda i: tri[i], default=None)
        if best is None:
            while done[next_seed[seed]]:
                seed += 1
            best = next_seed[seed]
        done[best] = True
        candidates.discard(best)
        order.append(best)
        touched = list(faces[best])
        for v in faces[best]:
            left[v] -= 1
            uses[v].remove(best)
        cache = touched + [v for v in cache if v not in touched]
        dropped, cache = cache[size:], cache[:size]
        for p, v in enumerate(cache):
            position[v] = p
        for v in dropped:
            position[v] = -1
        for v in set(cache + dropped):
            s = score(v)
            change = s - vertex[v]
            vertex[v] = s
            for i in uses[v]:
                tri[i] += change
                candidates.add(i)
        candidates = {i for i in candidates if not done[i]}
        if len(candidates) > 64:
            candidates = set(sorted(candidates, key=lambda i: -tri[i])[:64])
    return np.array([faces[i] for i in order], np.int64)


def by_first_use(pos, normal, paint, faces):
    """Vertices in the order the triangles first reach them."""
    ids, first = np.unique(faces.ravel(), return_index=True)
    rank = ids[np.argsort(first)]
    back = np.zeros(len(pos), np.int64)
    back[rank] = np.arange(len(rank))
    return pos[rank], normal[rank], paint[rank], back[faces]


def write_glb(path, parts):
    """parts: [(material, positions, normals, paint 0-1 RGBA, faces)], Z up as
    Blender has them; written Y up, as the game reads them."""
    blob, views, accessors, primitives, materials = bytearray(), [], [], [], []

    def add(data, target, kind, component, count, extra=None, normalised=False):
        while len(blob) % 4:
            blob.append(0)
        views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data), 'target': target})
        blob.extend(data)
        a = {'bufferView': len(views) - 1, 'componentType': component, 'count': count, 'type': kind}
        if normalised:
            a['normalized'] = True
        accessors.append({**a, **(extra or {})})
        return len(accessors) - 1

    swap = lambda v: np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1).astype(np.float32)
    for i, (name, pos, normal, paint, faces) in enumerate(parts):
        if not len(faces):
            continue
        if len(pos) >= 65536:
            raise ValueError(f'{name}: {len(pos)} vertices, over the 16-bit limit')
        faces = cache_order(faces, len(pos))
        pos, normal, paint, faces = by_first_use(np.asarray(pos), np.asarray(normal), np.asarray(paint), faces)
        p, n = swap(np.asarray(pos)), swap(np.asarray(normal))
        materials.append({'name': name})
        primitives.append({'material': len(materials) - 1, 'indices': add(np.asarray(faces, np.uint16).tobytes(), 34963, 'SCALAR', 5123, len(faces) * 3),
                           'attributes': {
                               'POSITION': add(p.tobytes(), 34962, 'VEC3', 5126, len(p), {'min': p.min(0).tolist(), 'max': p.max(0).tolist()}),
                               'NORMAL': add(n.tobytes(), 34962, 'VEC3', 5126, len(n)),
                               'COLOR_0': add((np.clip(paint, 0, 1) * 255 + .5).astype(np.uint8).tobytes(), 34962, 'VEC4', 5121, len(p), normalised=True)}})
    while len(blob) % 4:
        blob.append(0)
    doc = {'asset': {'version': '2.0', 'generator': 'Fairway meshy_parts'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
           'meshes': [{'primitives': primitives}], 'materials': materials, 'accessors': accessors, 'bufferViews': views,
           'buffers': [{'byteLength': len(blob)}]}
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(blob)))
        f.write(struct.pack('<II', len(text), 0x4E4F534A) + text)
        f.write(struct.pack('<II', len(blob), 0x004E4942) + bytes(blob))
