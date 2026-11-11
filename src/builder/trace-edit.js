// A TRACE THE PLAYER DRAWS (the course builder, door 2's manual trace; the
// owner's amended goal, 31 October 2026, docs/COURSE_BUILDER.md *The amended
// goal*). Every surface or ground type in its own layer over the land --
// painted with a brush, filled by an outline, smoothed, tidied -- and the trees, placed
// one at a time or scattered over a zone. The auto trace (lidar/trace.js)
// starts this same model, so its result is corrected with the same tools.
// Pure (no DOM); tests/trace-edit.test.mjs.
//
// Codes: TRACE's eight first (rough .. path, the auto trace's own), then every
// other ground type grounds.js knows. Local metres as door 2 lays them: x east
// of the land's middle, z south of it; the grid is the land's.
import {TRACE, boxMean, distanceFrom} from '../lidar/trace.js';
import {GROUND_KINDS} from '../grounds.js';
import {TREE_ROLES} from '../course-doc.js';
import {createLayers, tidyMask, LAYER_ORDER} from './layers.js';
import {scatterCover, coverAt, refusedBy, treeSized} from './cover.js';
import {smoothCells, extrapolateCells, zoneTrees, zoneHomes} from './layer-ops.js';
import {skinFromHeights, SKIN} from './skin.js';

export const PALETTE = [...TRACE, ...GROUND_KINDS.filter(k => !TRACE.includes(k))];
export const CODE = Object.fromEntries(PALETTE.map((k, i) => [k, i]));
// Patches smaller than this are specks and holes smaller than this are pocks
// (PLACED: 10 m², the smallest pot bunker; at 4 m² the imagery iterations
// still left specks and pocks the owner had asked to be rid of).
export const SPECK = 10;
// A hole of rough inside one surface under this is a pock, and filled
// (PLACED: 30 m²; the imagery iterations' fairways were moth-eaten with them).
// Only rough: a pot bunker inside a fairway is a feature, not a pock.
export const POCK = 30;

// The trace is in LAYERS (layers.js; the owner, 1 November 2026): each
// surface its own mask, the topmost shown. A brush, an outline, smoothing and
// tidying work on one layer (`kind`), or -- Erase, Smooth all, Tidy with no
// kind -- on every layer. `state.codes` is what the course will be made of,
// `state.layers.view` what is shown (hidden layers left out).
export function createTrace(grid, {codes = null, trees = [], homes = [], rocks = [], bunkers = [], creekLines = []} = {}) {
 const {nx, nz, cell, halfX, halfZ} = grid, N = nx * nz;
 const layers = createLayers(nx, nz, PALETTE);
 if (codes) layers.fromCodes(codes);
 const s = {layers, codes: layers.codes, trees: trees.map(t => ({...t})), homes: homes.map(h => ({...h})), rocks: rocks.map(q => [...q]), bunkers: bunkers.map(b => ({...b})), creekLines: creekLines.map(c => ({...c})), undo: [], redo: [], stroke: null};
 const idx = (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
 // Every change goes through `put`, which remembers each layer cell's first
 // value in the current step (so a whole drag undoes at once) and the box the
 // composites must be redone over.
 const LI = Object.fromEntries(LAYER_ORDER.map((k, i) => [k, i]));
 const begin = () => { if (!s.stroke) s.stroke = {cells: new Map(), trees: null, box: [nx, -1, nz, -1]}; };
 const put = (kind, k, v) => {
  const m = layers.mask(kind, v === 1); if (!m || m[k] === v) return;
  const key = k * 32 + LI[kind]; if (!s.stroke.cells.has(key)) s.stroke.cells.set(key, m[k]);
  m[k] = v; const i = k % nx, j = (k - i) / nx, bx = s.stroke.box;
  if (i < bx[0]) bx[0] = i; if (i > bx[1]) bx[1] = i; if (j < bx[2]) bx[2] = j; if (j > bx[3]) bx[3] = j;
 };
 const keepTrees = () => { if (!s.stroke.trees) s.stroke.trees = s.trees.map(t => ({...t})); };
 const keepHomes = () => { if (!s.stroke.homes) s.stroke.homes = s.homes.map(h => ({...h})); };
 const keepRocks = () => { if (!s.stroke.rocks) s.stroke.rocks = s.rocks.map(q => [...q]); };
 const keepList = key => { if (!s.stroke[key]) s.stroke[key] = s[key].map(v => ({...v})); };
 const settle = () => { const bx = s.stroke?.box; if (bx && bx[1] >= 0) layers.recompose(bx[0], bx[1], bx[2], bx[3]); };
 const end = () => { settle(); if (s.stroke && (s.stroke.cells.size || s.stroke.trees || s.stroke.homes || s.stroke.rocks || s.stroke.bunkers || s.stroke.creekLines)) { s.undo.push(s.stroke); s.redo.length = 0; } s.stroke = null; };
 const box = (x, z, r) => ({i0: Math.max(0, Math.floor((x - r + halfX) / cell)), i1: Math.min(nx - 1, Math.ceil((x + r + halfX) / cell)), j0: Math.max(0, Math.floor((z - r + halfZ) / cell)), j1: Math.min(nz - 1, Math.ceil((z + r + halfZ) / cell))});
 const layerOf = k => { if (k == null || k === 'rough') return null; if (CODE[k] == null || !LAYER_ORDER.includes(k)) throw Error(`No such surface: ${k}`); return k; };
 const facing = (x, z) => facingFrom(api.kindAt)(x, z);
 const step = fn => { const own = !s.stroke; begin(); fn(); if (own) end(); else settle(); };
 const every = () => [...layers.masks.keys()];

 const api = {
  grid, state: s, PALETTE,
  kindAt: (x, z) => { const k = idx(x, z); return k < 0 ? null : PALETTE[layers.codes[k]]; },
  layersPresent: () => layers.present(),
  setHidden(kind, hide) { layers.setHidden(kind, hide); },
  // A brush stroke is one undo step from `beginStroke` to `endStroke`; a
  // single call outside a stroke is its own.
  beginStroke: begin, endStroke: end,
  // Paints a disc onto `kind`'s layer ('rough' takes every layer off there).
  paint({x, z, radius, kind}) {
   if (kind === 'rough') return api.erase({x, z, radius});
   const L = layerOf(kind), r2 = radius * radius, b = box(x, z, radius);
   step(() => { for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) { const dx = -halfX + i * cell - x, dz = -halfZ + j * cell - z; if (dx * dx + dz * dz <= r2) put(L, j * nx + i, 1); } });
  },
  // Takes a disc off one layer, or off every layer.
  erase({x, z, radius, kind = null}) {
   const kinds = kind ? [layerOf(kind)] : every(), r2 = radius * radius, b = box(x, z, radius);
   step(() => { for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) { const dx = -halfX + i * cell - x, dz = -halfZ + j * cell - z; if (dx * dx + dz * dz <= r2) for (const L of kinds) put(L, j * nx + i, 0); } });
  },
  // An outline (rings, even-odd) filled onto a layer ('rough' clears every one).
  fill(rings, kind) {
   const L = kind === 'rough' ? null : layerOf(kind);
   step(() => { const zs = rings.flat().map(p => p[1]), j0 = Math.max(0, Math.ceil((Math.min(...zs) + halfZ) / cell)), j1 = Math.min(nz - 1, Math.floor((Math.max(...zs) + halfZ) / cell));
    for (let j = j0; j <= j1; j++) { const z = -halfZ + j * cell, xs = [];
     for (const ring of rings) for (let q = 0, p = ring.length - 1; q < ring.length; p = q++) { const [ax, az] = ring[p], [bx, bz] = ring[q]; if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax)); }
     xs.sort((u, v) => u - v);
     for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] + halfX) / cell)); i <= Math.min(nx - 1, Math.floor((xs[q + 1] + halfX) / cell)); i++) { if (L) put(L, j * nx + i, 1); else for (const K of every()) put(K, j * nx + i, 0); } } });
  },
  // SMOOTHING: a layer's edge takes the majority of its neighbourhood (radius
  // in metres), over the land or a circle of it; specks and pocks under the
  // radius go. With no `kind`, every layer is smoothed.
  smooth({radius = 1.5, x = null, z = null, area = null, kind = null} = {}) {
   const r = Math.max(1, Math.round(radius / cell)), reach = area ?? radius * 4, b = x == null ? {i0: 0, i1: nx - 1, j0: 0, j1: nz - 1} : box(x, z, reach);
   const kinds = kind ? [layerOf(kind)] : every();
   step(() => { for (const L of kinds) {
    const m = layers.mask(L); if (!m) continue;
    smoothCells(m, grid, r, b, (i, j) => x == null || Math.hypot(-halfX + i * cell - x, -halfZ + j * cell - z) <= reach, (k, v) => put(L, k, v));
   } });
  },
  // EXTRAPOLATE (the owner, 1 November 2026: "semi rough to fairways ...
  // Allow the user to extrapolate any layers"): `to`'s layer laid `width`
  // metres round `from`'s. A layer below runs on unbroken beneath it (semi
  // under a fairway, as a course is drawn); one above takes only the band
  // round it, so `from` still shows. (A green's fringe needs none: the game
  // mows a collar round every green, the course's fringe width.)
  extrapolate({from, to, width}) {
   const F = layers.mask(layerOf(from)), T = layerOf(to); if (!F || !T || T === from || !(width > 0)) return;
   step(() => extrapolateCells(F, grid, width, LI[T] > LI[from], (k, v) => put(T, k, v)));
  },
  // TIDY: on each layer (or `kind`'s), patches under `minArea` m² go and
  // holes under POCK m² fill -- no specks, no pocks.
  tidy({minArea = SPECK, kind = null} = {}) {
   const kinds = kind ? [layerOf(kind)] : every();
   step(() => { for (const L of kinds) { const m = layers.mask(L); if (m) tidyMask(m, nx, nz, Math.round(minArea / (cell * cell)), Math.round(POCK / (cell * cell)), (k, v) => put(L, k, v)); } });
  },
  // TREES: one, or a zone scattered at a density (trees a hectare), each a
  // height and crown from the given ranges, never on mown ground or water.
  // `species`: one tree picked by name, kept with its size wherever it stands.
  addTree(t) { step(() => { keepTrees(); s.trees.push(t.species ? {x: t.x, z: t.z, ...treeSized(t.species, t.h ?? 14), kept: true, placed: true, kind: t.species} : {x: t.x, z: t.z, h: t.h ?? 14, crown: t.crown ?? 4, placed: true}); }); },
  removeTrees({x, z, radius}) { step(() => { keepTrees(); s.trees = s.trees.filter(t => Math.hypot(t.x - x, t.z - z) > radius); }); },
  // Every tree replaced at once (door 2's choice of whose trees: osm.js
  // mergeTrees), one step to undo.
  setTrees(list) { step(() => { keepTrees(); s.trees = list.map(t => ({...t})); }); },
  treeZone(ring, {density = 120, height = [10, 22], crown = [2.5, 5], seed = 1} = {}) {
   step(() => { keepTrees(); s.trees.push(...zoneTrees(ring, {density, height, crown, seed, open: (x, z) => { const here = api.kindAt(x, z); return !!here && OPEN.has(here); }})); });
  },
  // GROUND COVER, as in the 3D editor (cover.js, editing.js paintCover; the
  // owner, 4 November 2026: "Add the ground cover brush to the 2d editor"): one
  // dab scattered on open ground. A plant is a tree kept where it stands, of
  // the shrub role with its species; a rock is a rock. Returns how many.
  paintCover({cover, x, z, radius, min, max, density, rng = Math.random}) {
   const refused = refusedBy(cover.key), got = scatterCover({cover, x, z, radius, min, max, density, rng, open: (px, pz) => { const k = api.kindAt(px, pz); return !!k && !refused.has(k); }, taken: (px, pz, reach) => coverAt(s, px, pz, reach)});
   if (got.length) step(() => {
    keepTrees(); keepRocks();
    for (const p of got) {
     if (p.rock) s.rocks.push(p.rock);
     else if (cover.key === 'trees') s.trees.push({x: p.x, z: p.z, ...treeSized(p.species, p.size), kept: true, kind: p.species});
     else s.trees.push({x: p.x, z: p.z, h: p.size, crown: p.size * .6, trunk: .05, role: SHRUB, kept: true, kind: p.species});
    }
   });
   return got.length;
  },
  // ONE TREE'S SIZE, as the 3D editor's: `f` times the `base` record it had
  // when picked. `first` starts one undo step, so a slider's drag is one Undo.
  sizeTree(index, base, f, first = false) {
   if (!s.trees[index]) return;
   const k = Math.max(.25, Math.min(3, f)), sized = {...base, h: base.h * k, crown: base.crown * k, ...(base.trunk ? {trunk: base.trunk * k} : {}), kept: true, placed: true};
   if (first) step(() => { keepTrees(); s.trees[index] = sized; }); else s.trees[index] = sized;
  },
  // A BUNKER DUG at a click: sand painted, and the bowl recorded for the course
  // to dig into the land when it is made (real-course.js). A CREEK a line kept
  // the same way. Both undo here; the ground is only changed in the course.
  digBunker({x, z, radius = 5}) { step(() => { keepList('bunkers'); s.bunkers.push({x, z, radius}); api.paint({x, z, radius, kind: 'sand'}); }); },
  addCreekLine({points, width = 3}) { step(() => { keepList('creekLines'); s.creekLines.push({points: points.map(p => [...p]), width}); }); },
  // SKIN FROM THE LAND, as the 3D editor's (skin.js): `ground` the heights as
  // they stand. One undo. Returns {kinds, cells}.
  skin({bio, ground}) {
   const c = SKIN.clear, PLAYED = new Set(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'semi']);
   const keepOut = (x, z) => [[0, 0], [c, 0], [-c, 0], [0, c], [0, -c]].some(([dx, dz]) => PLAYED.has(api.kindAt(x + dx, z + dz)));
   const skin = skinFromHeights({nx, nz, cell, halfX: halfX + cell / 2, halfZ: halfZ + cell / 2, ground}, bio, keepOut);
   step(() => { for (const [kind, m] of Object.entries(skin.masks)) for (let k = 0; k < N; k++) if (m[k]) put(kind, k, 1); });
   return {kinds: skin.kinds, cells: skin.cells};
  },
  // HOLDING ONE THING, as the 3D editor's (editing.js holdShape): it comes off
  // the plan at once and `drop` puts it down; one undo, none if it went nowhere.
  hold(pick) {
   if (pick.type !== 'shape') {
    const list = pick.type === 'home' ? 'homes' : 'trees', was = s[list][pick.index], base = list === 'homes' ? keepHomes : keepTrees;
    begin(); base();
    const set = (dx, dz, angle = 0) => { s[list][pick.index] = list === 'homes' ? {...was, x: was.x + dx, z: was.z + dz, rotation: was.rotation - angle} : {...was, x: was.x + dx, z: was.z + dz, kept: true}; };
    return {set, drop(dx, dz, angle = 0) { set(dx, dz, angle); if (!dx && !dz && !angle) { s[list][pick.index] = was; s.stroke = null; } else end(); return pick; }};
   }
   begin();
   for (const k of pick.cells) put(pick.kind, k, 0);
   settle();
   return {set() {}, drop(dx, dz, angle = 0) {
    const di = Math.round(dx / cell), dj = Math.round(dz / cell);
    if (!di && !dj && !angle) { for (const k of pick.cells) put(pick.kind, k, 1); settle(); s.stroke = null; return pick; }
    const turned = angle ? turnedCells(pick.cells, angle, nx, nz) : pick.cells, cells = [];
    for (const k of turned) { const i = k % nx + di, j = Math.floor(k / nx) + dj; if (i >= 0 && j >= 0 && i < nx && j < nz) cells.push(j * nx + i); }
    for (const k of cells) put(pick.kind, k, 1);
    end();
    return {...pick, cells};
   }};
  },
  // Rocks, and plants sized as ground cover, off under the brush; not trees.
  clearCover({x, z, radius}) {
   const near = q => Math.hypot(q.x - x, q.z - z) <= radius;
   step(() => { keepTrees(); keepRocks(); s.rocks = s.rocks.filter(q => Math.hypot(q[0] - x, q[1] - z) > radius); s.trees = s.trees.filter(t => !((t.role & 7) === SHRUB && near(t))); });
  },
  // OUTSIDE THE COURSE (the owner, 1 November 2026: "course boundary.
  // Outside of this we will fill with forest/etc, then fade into the
  // outskirts geometry. just like the course boundaries generate today"):
  // past the boundary ring every layer comes off and `ground`'s is laid (the
  // landscape's own floor; null leaves rough), and a wood is scattered at
  // `density` trees a hectare, thinning from none at the line to full
  // `edge` metres out, where no tree already stands. (Past the land itself
  // the game's landscape rings carry on, as round every generated course.)
  // WHAT WAS THERE (the owner, 1 November 2026: "give the option to remove
  // OSM data or keep it"; then "Remove EVERYTHING outside the course boundary
  // before filling"): `keep` false takes every surface, house and tree
  // outside off -- the survey's trees too -- before the floor and the wood go
  // in; `keep` true leaves each surface, house and tree where it is, lays the
  // floor only on bare ground, and plants no tree on a surface or a house.
  fillOutside(ring, {ground = null, density = 120, edge = 15, height = [10, 22], crown = [2.5, 5], seed = 1, keep = false} = {}) {
   if (!ring || ring.length < 3) return 0;
   const G = ground && ground !== 'rough' ? layerOf(ground) : null;
   let q = seed >>> 0 || 1; const rnd = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648;
   const segDist = (x, z) => { let d = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; };
   let planted = 0;
   step(() => {
    // Row by row: where the ring crosses each row, so a ring of hundreds of
    // corners over a million cells stays quick.
    const others = every().filter(K => K !== G), within = new Uint8Array(nx);
    for (let j = 0; j < nz; j++) {
     const z = -halfZ + j * cell, xs = []; within.fill(0);
     for (let p = 0, o = ring.length - 1; p < ring.length; o = p++) { const [ax, az] = ring[o], [bx, bz] = ring[p]; if ((az > z) !== (bz > z)) xs.push(ax + (z - az) / (bz - az) * (bx - ax)); }
     xs.sort((u, v) => u - v);
     for (let c = 0; c + 1 < xs.length; c += 2) for (let i = Math.max(0, Math.ceil((xs[c] + halfX) / cell)); i <= Math.min(nx - 1, Math.floor((xs[c + 1] + halfX) / cell)); i++) within[i] = 1;
     for (let i = 0; i < nx; i++) { if (within[i]) continue; const k = j * nx + i; if (keep && layers.codes[k] && !(G && layers.mask(G)?.[k])) continue; for (const K of others) put(K, k, 0); if (G) put(G, k, 1); }
    }
    keepTrees();
    const onHome = (x, z) => s.homes.some(h => Math.hypot(h.x - x, h.z - z) < Math.max(h.width, h.depth) / 2 + 3);
    if (!keep) { keepHomes(); s.homes = s.homes.filter(h => inside(ring, h.x, h.z)); s.trees = s.trees.filter(t => inside(ring, t.x, t.z)); }
    const spacing = Math.sqrt(1e4 / density), stood = new Map(), at = (x, z) => `${Math.floor(x / spacing)},${Math.floor(z / spacing)}`;
    for (const t of s.trees) { const c = at(t.x, t.z); stood.set(c, (stood.get(c) || 0) + 1); }
    for (let z = -halfZ; z <= halfZ; z += spacing) for (let x = -halfX; x <= halfX; x += spacing) {
     const px = x + (rnd() - .5) * spacing * .9, pz = z + (rnd() - .5) * spacing * .9;
     if (Math.abs(px) > halfX || Math.abs(pz) > halfZ || inside(ring, px, pz) || stood.get(at(px, pz))) continue;
     if (rnd() > Math.min(1, segDist(px, pz) / edge)) continue;
     if (keep) { const k = idx(px, pz); if (k >= 0 && layers.codes[k] && !(G && layers.mask(G)?.[k])) continue; if (onHome(px, pz)) continue; }
     s.trees.push({x: px, z: pz, h: height[0] + rnd() * (height[1] - height[0]), crown: crown[0] + rnd() * (crown[1] - crown[0])}); planted++;
    }
   });
   return planted;
  },
  // HOUSES (the owner, 1 November 2026: "We need to add houses to the
  // tracing options also. house zone perhaps?"): each a footprint -- where it
  // stands, which way its front faces (`rotation`, as homes.js turns its own:
  // the front looks along +z turned by it), its width and depth in metres.
  // The game builds the house itself (form, roof, porch, garden) from where
  // it stands. One is stood where clicked, facing the nearest mown ground; a
  // ZONE is lined with them, 42 m apart as the game spaces its own (PLACED
  // there), each on open ground whole -- not on turf, sand, water or a path.
  addHome(h) { step(() => { keepHomes(); s.homes.push(api.homeAt(h)); }); },
  removeHomes({x, z, radius}) { step(() => { keepHomes(); s.homes = s.homes.filter(h => Math.hypot(h.x - x, h.z - z) > radius); }); },
  facing: (x, z) => facing(x, z),
  homeAt({x, z, rotation = null, width = 20, depth = 15}) { return {x, z, rotation: rotation ?? facing(x, z), width, depth}; },
  homeFits(h) { const c = Math.cos(h.rotation), sn = Math.sin(h.rotation); return [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].every(([a, b]) => { const lx = a * (h.width / 2 + 2), lz = b * (h.depth / 2 + 2), here = api.kindAt(h.x + lx * c + lz * sn, h.z - lx * sn + lz * c); return here && OPEN.has(here); }) && !s.homes.some(o => Math.hypot(o.x - h.x, o.z - h.z) < (Math.max(o.width, o.depth) + Math.max(h.width, h.depth)) / 2 + 4); },
  homeZone(ring, {spacing = 42, seed = 1} = {}) {
   let n = 0;
   step(() => { keepHomes(); n = zoneHomes(ring, {spacing, seed, place: h0 => { const h = api.homeAt(h0); if (!api.homeFits(h)) return false; s.homes.push(h); return true; }}); });
   return n;
  },
  // MOVING ONE SHAPE (the owner, 1 November 2026: "the ability to move
  // individual shapes"). What is under a point (`pickAt`): a house whose
  // footprint holds it, else a tree whose crown does (at least 1.5 m), else
  // a SHAPE -- the patch of one layer there, its cells joined edge to edge:
  // `kind`'s layer when it covers the point, else the topmost shown. A patch
  // is all of a layer that touches: semi-rough drawn as one sheet round
  // three fairways moves as one.
  pickAt({x, z, kind = null}) {
   const hi = s.homes.findIndex(h => { const c = Math.cos(h.rotation), sn = Math.sin(h.rotation), lx = (x - h.x) * c - (z - h.z) * sn, lz = (x - h.x) * sn + (z - h.z) * c; return Math.abs(lx) <= h.width / 2 && Math.abs(lz) <= h.depth / 2; });
   if (hi >= 0) return {type: 'home', index: hi};
   let ti = -1, td = Infinity; s.trees.forEach((t, q) => { const d = Math.hypot(t.x - x, t.z - z); if (d <= Math.max(1.5, t.crown) && d < td) { td = d; ti = q; } });
   if (ti >= 0) return {type: 'tree', index: ti};
   // A creek line within its half-width and 2 m (the builder-ux goal, item 9).
   const seg = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; return Math.hypot(x - ax - t * dx, z - az - t * dz); };
   const ci = (s.creekLines ?? []).findIndex(c => c.points.some((q, n) => n && seg(c.points[n - 1][0], c.points[n - 1][1], q[0], q[1]) <= c.width / 2 + 2));
   if (ci >= 0) return {type: 'creek', index: ci};
   const k0 = idx(x, z); if (k0 < 0) return null;
   const want = kind && kind !== 'rough' && LI[kind] != null && layers.mask(kind)?.[k0] ? kind : PALETTE[layers.view[k0]];
   const m = want && want !== 'rough' ? layers.mask(want) : null; if (!m?.[k0]) return null;
   const seen = new Uint8Array(N), cells = [k0]; seen[k0] = 1;
   for (let q = 0; q < cells.length; q++) { const k = cells[q], i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && !seen[n] && m[n]) { seen[n] = 1; cells.push(n); } }
   return {type: 'shape', kind: want, cells};
  },
  // What `pickAt` found, moved `dx`, `dz` metres (a shape by whole cells; the
  // layers under it show where it stood). One undo step.
  move(pick, dx, dz) {
   if (!pick) return;
   if (pick.type === 'tree') return step(() => { keepTrees(); const t = s.trees[pick.index]; s.trees[pick.index] = {...t, x: t.x + dx, z: t.z + dz}; });
   if (pick.type === 'home') return step(() => { keepHomes(); const h = s.homes[pick.index]; s.homes[pick.index] = {...h, x: h.x + dx, z: h.z + dz}; });
   const di = Math.round(dx / cell), dj = Math.round(dz / cell); if (!di && !dj) return;
   step(() => {
    for (const k of pick.cells) put(pick.kind, k, 0);
    for (const k of pick.cells) { const i = k % nx + di, j = Math.floor(k / nx) + dj; if (i >= 0 && j >= 0 && i < nx && j < nz) put(pick.kind, j * nx + i, 1); }
   });
  },
  // COPY AND DELETE (the builder-ux goal, item 18; "MS Paint/real 3d editor"):
  // what `pickAt` found, stamped again `dx`, `dz` metres away (a shape by
  // whole cells, a tree or a house as it is), the original kept; or taken
  // away (a shape's cells off its own layer only, so what lies under it shows).
  // One undo step each.
  copy(pick, dx, dz) {
   if (!pick || pick.type === 'creek') return;
   if (pick.type === 'tree') return step(() => { keepTrees(); const t = s.trees[pick.index]; s.trees.push({...t, x: t.x + dx, z: t.z + dz}); });
   if (pick.type === 'home') return step(() => { keepHomes(); const h = s.homes[pick.index]; s.homes.push({...h, x: h.x + dx, z: h.z + dz}); });
   const di = Math.round(dx / cell), dj = Math.round(dz / cell); if (!di && !dj) return;
   step(() => { for (const k of pick.cells) { const i = k % nx + di, j = Math.floor(k / nx) + dj; if (i >= 0 && j >= 0 && i < nx && j < nz) put(pick.kind, j * nx + i, 1); } });
  },
  remove(pick) {
   if (!pick) return;
   if (pick.type === 'creek') return step(() => { keepList('creekLines'); s.creekLines = s.creekLines.filter((_, q) => q !== pick.index); });
   if (pick.type === 'tree') return step(() => { keepTrees(); s.trees = s.trees.filter((_, q) => q !== pick.index); });
   if (pick.type === 'home') return step(() => { keepHomes(); s.homes = s.homes.filter((_, q) => q !== pick.index); });
   step(() => { for (const k of pick.cells) put(pick.kind, k, 0); });
  },
  // TURNING ONE SHAPE (1 November 2026, the last of amendment 12's list):
  // what `pickAt` found turned `angle` radians about its middle -- a patch
  // cell by cell (each new cell takes the old cell it turns back onto, so no
  // holes open), a house's facing; a tree is round. One undo step.
  turn(pick, angle) {
   if (!pick || !angle) return;
   if (pick.type === 'home') return step(() => { keepHomes(); const h = s.homes[pick.index]; s.homes[pick.index] = {...h, rotation: h.rotation - angle}; });   // a facing is measured the other way round (homes.js)
   if (pick.type !== 'shape') return;
   const mask = turnedCells(pick.cells, angle, nx, nz);
   step(() => { for (const k of pick.cells) put(pick.kind, k, 0); for (const k of mask) put(pick.kind, k, 1); });
  },
  undo() { return swapStep(s.undo, s.redo); },
  redo() { return swapStep(s.redo, s.undo); },
 };
 // Undo and redo are one act: a step's remembered values swapped with the present.
 function swapStep(from, to) {
  const st = from.pop(); if (!st) return false;
  const back = {cells: new Map(), trees: st.trees ? s.trees : null, homes: st.homes ? s.homes : null, rocks: st.rocks ? s.rocks : null, bunkers: st.bunkers ? s.bunkers : null, creekLines: st.creekLines ? s.creekLines : null, box: st.box};
  for (const [key, v] of st.cells) { const L = LAYER_ORDER[key % 32], k = Math.floor(key / 32), m = layers.mask(L, true); back.cells.set(key, m[k]); m[k] = v; }
  if (st.trees) s.trees = st.trees;
  if (st.homes) s.homes = st.homes;
  if (st.rocks) s.rocks = st.rocks;
  if (st.bunkers) s.bunkers = st.bunkers;
  if (st.creekLines) s.creekLines = st.creekLines;
  if (st.box[1] >= 0) layers.recompose(st.box[0], st.box[1], st.box[2], st.box[3]);
  to.push(back); return true;
 }
 return api;
}
// Which way a house at (x, z) faces: toward the nearest mown ground (fairway,
// green or tee) within 150 m, looked for along 32 bearings every 3 m; south
// when there is none. homes.js turns a house by atan2(dx, dz) toward its hole.
// A patch's cells (indices into an nx x nz grid) turned `angle` radians about
// their middle: every cell in the turned box that turns back onto one of
// them. Returns the new cells. Shared with the editor (editing.js turnShape).
export function turnedCells(cells, angle, nx, nz) {
 let ci = 0, cj = 0; for (const k of cells) { ci += k % nx; cj += Math.floor(k / nx); } ci /= cells.length; cj /= cells.length;
 const c = Math.cos(angle), s = Math.sin(angle), had = new Set(cells);
 let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
 for (const k of cells) { const di = k % nx - ci, dj = Math.floor(k / nx) - cj, ti = ci + di * c - dj * s, tj = cj + di * s + dj * c; i0 = Math.min(i0, ti); i1 = Math.max(i1, ti); j0 = Math.min(j0, tj); j1 = Math.max(j1, tj); }
 const out = [];
 for (let j = Math.max(0, Math.floor(j0) - 1); j <= Math.min(nz - 1, Math.ceil(j1) + 1); j++) for (let i = Math.max(0, Math.floor(i0) - 1); i <= Math.min(nx - 1, Math.ceil(i1) + 1); i++) {
  const di = i - ci, dj = j - cj, si = Math.round(ci + di * c + dj * s), sj = Math.round(cj - di * s + dj * c);
  if (si >= 0 && sj >= 0 && si < nx && sj < nz && had.has(sj * nx + si)) out.push(j * nx + i);
 }
 return out;
}

// Which way a house's front faces: toward the nearest fairway, green or tee
// (32 bearings, out to 150 m). Shared with the editor (editing.js addHome).
export function facingFrom(kindAt) {
 return (x, z) => {
  for (let r = 3; r <= 150; r += 3) for (let a = 0; a < 32; a++) {
   const t = a / 32 * 2 * Math.PI, k = kindAt(x + Math.sin(t) * r, z + Math.cos(t) * r);
   if (k === 'fairway' || k === 'green' || k === 'tee') return t;
  }
  return 0;
 };
}
// Where a tree may stand: rough and the wild ground types, not mown turf,
// sand, water or path.
const SHRUB = TREE_ROLES.indexOf('shrub');
const OPEN = new Set(PALETTE.filter(k => !['fairway', 'tee', 'green', 'sand', 'water', 'path'].includes(k)));
const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };

// Specks merged into their surroundings and pocks filled, in place (`put(k,
// code)` writes; the default writes straight into `codes`). Exported for the
// auto trace and for making a course, which tidy the same way.
export function tidyCodes(codes, nx, nz, cell, minArea = SPECK, put = (k, c) => { codes[k] = c; }, pockArea = POCK) {
 const N = nx * nz, seen = new Uint8Array(N), minCells = Math.max(1, Math.round(minArea / (cell * cell))), pockCells = Math.round(pockArea / (cell * cell)), list = [];
 for (let pass = 0; pass < 2; pass++) {
  seen.fill(0);
  for (let s0 = 0; s0 < N; s0++) {
   if (seen[s0]) continue;
   const c = codes[s0]; list.length = 0; list.push(s0); seen[s0] = 1;
   const border = new Map();
   for (let q = 0; q < list.length; q++) {
    const k = list[q], i = k % nx;
    for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k + nx < N ? k + nx : -1]) {
     if (n < 0) continue;
     if (codes[n] !== c) { border.set(codes[n], (border.get(codes[n]) || 0) + 1); continue; }
     if (!seen[n]) { seen[n] = 1; list.push(n); }
    }
   }
   const pock = c === 0 && border.size === 1 && list.length < pockCells && !list.some(k => { const i = k % nx; return i === 0 || i === nx - 1 || k < nx || k >= N - nx; });
   if ((list.length >= minCells && !pock) || !border.size) continue;
   let best = c, n = -1; for (const [b, v] of border) if (v > n) { n = v; best = b; }
   for (const k of list) put(k, best);
  }
 }
}
