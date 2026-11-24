// A TRACE THE PLAYER DRAWS (the course builder, door 2's manual trace; the
// owner's amended goal, 31 October 2026, docs/COURSE_BUILDER.md *The amended
// goal*). Every surface or ground type in its own layer over the land --
// painted with a brush, filled by an outline, smoothed, tidied -- and the
// trees, placed one at a time or scattered over a zone. The auto trace
// (lidar/trace.js) starts this same model, so its result is corrected with
// the same tools. Pure (no DOM); tests/trace-edit.test.mjs.
//
// EVERY LAYER IS OUTLINES (branch builder-outlines, 24 November 2026; the
// owner: "I want these pixellated views gone from the builder entirely. No
// 're processing on a 1m square' or anything like that"). A layer is a set
// of outlines (shapes.js) and each tool changes it exactly: a brush stroke
// adds or cuts the band it swept, an outline its own shape, a line its band,
// Add layer around the layer grown; Smooth eases the edge itself, Tidy drops
// whole shapes and holes by their area. Until then a layer was a mask of the
// land's cells, painted cell by cell and traced back into outlines after
// every change. What starts as cells -- the auto trace's composite, Paint
// rock on slopes -- is turned into outlines once, as it comes in
// (`codesToShapes`, shapes.js `fromMask`). A grid is kept only as a hidden
// lookup (`lookup`), for what asks by cell -- never drawn.
//
// Codes: TRACE's eight first (rough .. path, the auto trace's own), then every
// other ground type grounds.js knows. Local metres as door 2 lays them: x east
// of the land's middle, z south of it; the grid is the land's.
import {TRACE} from '../lidar/trace.js';
import {GROUND_KINDS} from '../grounds.js';
import {TREE_ROLES} from '../course-doc.js';
import {LAYER_ORDER} from './layers.js';
import {scatterCover, coverAt, refusedBy, treeSized} from './cover.js';
import {zoneTrees, zoneHomes} from './layer-ops.js';
import {skinFromHeights, SKIN} from './skin.js';
import {evenWidthSet} from './line-work.js';
import * as S from './shapes.js';

// The fringe last (24 November 2026): a draft keeps OpenStreetMap's cells as
// these codes (draft.js osm/codes.bin), so a new kind goes on the end.
export const PALETTE = [...TRACE, ...GROUND_KINDS.filter(k => !TRACE.includes(k)), 'fringe'];
export const CODE = Object.fromEntries(PALETTE.map((k, i) => [k, i]));
// Patches smaller than this are specks and holes smaller than this are pocks
// (PLACED: 10 m², the smallest pot bunker; at 4 m² the imagery iterations
// still left specks and pocks the owner had asked to be rid of).
export const SPECK = 10;
// A hole of rough inside one surface under this is a pock, and filled
// (PLACED: 30 m²; the imagery iterations' fairways were moth-eaten with them).
// Only rough: a pot bunker inside a fairway is a feature, not a pock.
export const POCK = 30;

// A composite of codes (the auto trace's, OpenStreetMap's laid, a draft's
// from before outlines) as one set of outlines a layer, turned once. Each
// kind is traced on the box of cells it covers only.
export function codesToShapes(codes, grid) {
 const {nx, nz, cell, halfX, halfZ} = grid, box = new Map();
 for (let k = 0; k < codes.length; k++) {
  const c = codes[k]; if (!c) continue;
  const i = k % nx, j = (k - i) / nx, b = box.get(c);
  if (!b) box.set(c, [i, i, j, j]); else { if (i < b[0]) b[0] = i; if (i > b[1]) b[1] = i; if (j < b[2]) b[2] = j; if (j > b[3]) b[3] = j; }
 }
 const out = new Map();
 for (const [c, [i0, i1, j0, j1]] of box) {
  const kind = PALETTE[c]; if (!kind || kind === 'rough' || !LAYER_ORDER.includes(kind)) continue;
  const a0 = Math.max(0, i0 - 1), a1 = Math.min(nx - 1, i1 + 1), b0 = Math.max(0, j0 - 1), b1 = Math.min(nz - 1, j1 + 1), w = a1 - a0 + 1, h = b1 - b0 + 1, m = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (codes[(j + b0) * nx + i + a0] === c) m[j * w + i] = 1;
  const set = S.fromMask(m, {nx: w, nz: h, cell, x0: -halfX + a0 * cell, z0: -halfZ + b0 * cell});
  if (set.length) out.set(kind, set);
 }
 return out;
}

// The trace. `codes`: a composite to start from (turned into outlines once);
// `shapes`: layers as outlines already (a Map of kind to set, or an object).
export function createTrace(grid, {codes = null, shapes = null, trees = [], homes = [], rocks = [], bunkers = [], creekLines = []} = {}) {
 const {nx, nz, cell, halfX, halfZ} = grid;
 const s = {shapes: new Map(), hidden: new Set(), trees: trees.map(t => ({...t})), homes: homes.map(h => ({...h})), rocks: rocks.map(q => [...q]), bunkers: bunkers.map(b => ({...b})), creekLines: creekLines.map(c => ({...c})), undo: [], redo: [], stroke: null, version: 0};
 if (codes) for (const [k, v] of codesToShapes(codes, grid)) s.shapes.set(k, v);
 if (shapes) for (const [k, v] of shapes instanceof Map ? shapes : Object.entries(shapes)) if (v?.length && LAYER_ORDER.includes(k)) s.shapes.set(k, v);
 const LI = Object.fromEntries(LAYER_ORDER.map((k, i) => [k, i]));
 const cur = kind => s.shapes.get(kind) ?? S.EMPTY;
 // Every change goes through `put`, which remembers each layer's set as it
 // was before the step (sets are never changed in place, so this is a
 // reference, not a copy) -- a whole drag undoes at once.
 const begin = (open = false) => { if (!s.stroke) s.stroke = {shapes: new Map(), trees: null, runs: [], open}; };
 const put = (kind, set) => {
  const was = cur(kind); if (set === was) return;
  if (!s.stroke.shapes.has(kind)) s.stroke.shapes.set(kind, was);
  if (set.length) s.shapes.set(kind, set); else s.shapes.delete(kind);
  s.version++;
 };
 const keepTrees = () => { if (!s.stroke.trees) s.stroke.trees = s.trees.map(t => ({...t})); };
 const keepHomes = () => { if (!s.stroke.homes) s.stroke.homes = s.homes.map(h => ({...h})); };
 const keepRocks = () => { if (!s.stroke.rocks) s.stroke.rocks = s.rocks.map(q => [...q]); };
 const keepList = key => { if (!s.stroke[key]) s.stroke[key] = s[key].map(v => ({...v})); };
 // A BRUSH STROKE'S DABS, LAID AT ONCE. While a stroke is held its dabs are
 // kept as a line (`pending`, which door 2 draws as the stroke goes), and
 // when it ends the band they swept is added to or cut from the layer in one
 // go -- one boolean however long the drag, about 8 to 30 ms on the biggest
 // layer of a 2.2 x 3.1 km course. A dab of another size, layer or tool
 // starts a new run.
 const dab = (op, kind, radius, x, z) => {
  const runs = s.stroke.runs, last = runs[runs.length - 1];
  if (last && last.op === op && last.kind === kind && last.radius === radius) last.points.push([x, z]);
  else runs.push({op, kind, radius, points: [[x, z]]});
  s.version++;
 };
 const flush = () => {
  const runs = s.stroke?.runs; if (!runs?.length) return;
  s.stroke.runs = [];
  for (const r of runs) { const b = S.band(r.points, r.radius); if (r.op === 'paint') put(r.kind, S.union(cur(r.kind), b)); else for (const K of r.kind ? [r.kind] : every()) put(K, S.difference(cur(K), b)); }
 };
 const end = () => { flush(); if (s.stroke && (s.stroke.shapes.size || s.stroke.trees || s.stroke.homes || s.stroke.rocks || s.stroke.bunkers || s.stroke.creekLines)) { s.undo.push(s.stroke); s.redo.length = 0; } s.stroke = null; };
 const layerOf = k => { if (k == null || k === 'rough') return null; if (CODE[k] == null || !LAYER_ORDER.includes(k)) throw Error(`No such surface: ${k}`); return k; };
 const facing = (x, z) => facingFrom(api.kindAt)(x, z);
 const step = fn => { flush(); const own = !s.stroke; begin(); fn(); if (own) end(); };
 const every = () => [...s.shapes.keys()];
 const landBox = [-halfX - cell / 2, -halfZ - cell / 2, halfX + cell / 2, halfZ + cell / 2];
 // THE HIDDEN LOOKUP: each land cell's topmost layer, for what asks by cell
 // (Fill outside's trees, Paint rock on slopes' clear ground, the holes found
 // on the traced greens). Made again only after a change; never drawn.
 let look = null;
 const lookup = () => {
  flush();
  if (look?.version === s.version) return look;
  const codes = new Uint8Array(nx * nz);
  for (const k of [...LAYER_ORDER].reverse()) { const set = s.shapes.get(k); if (set) S.rasterize(set, grid, codes, CODE[k]); }
  const at = (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : codes[j * nx + i]; };
  return (look = {version: s.version, codes, at, mask: kind => S.rasterize(cur(kind), grid)});
 };

 const api = {
  grid, state: s, PALETTE,
  // The topmost layer at a point, every layer counted (what the course will
  // be), or with `shown` only the layers not hidden; 'rough' where none.
  kindAt(x, z, shown = false) {
   flush();
   if (Math.abs(x) > halfX + cell / 2 || Math.abs(z) > halfZ + cell / 2) return null;
   for (const k of LAYER_ORDER) { if (shown && s.hidden.has(k)) continue; const set = s.shapes.get(k); if (set && S.contains(set, x, z)) return k; }
   return 'rough';
  },
  // The layers that hold anything, top first.
  layersPresent: () => { flush(); return LAYER_ORDER.filter(k => s.shapes.get(k)?.length); },
  shapesOf: kind => { flush(); return cur(kind); },
  // A layer's area, square metres.
  area: kind => { flush(); return S.areaOf(cur(kind)); },
  isHidden: kind => s.hidden.has(kind),
  // Layers set whole, outside the undo record (Back to 2D brings the 3D
  // editor's work in this way): `shapes` kind -> set (an empty set takes
  // the layer away), and which are hidden.
  load({shapes = new Map(), hidden = null} = {}) {
   flush();
   for (const [k, set] of shapes) { if (!LAYER_ORDER.includes(k)) continue; if (set?.length) s.shapes.set(k, set); else s.shapes.delete(k); }
   if (hidden) s.hidden = new Set(hidden);
   s.version++;
  },
  setHidden(kind, hide) { if (hide) s.hidden.add(kind); else s.hidden.delete(kind); s.version++; },
  // Bumped by every change: the plan redraws what changed.
  version: () => s.version,
  lookup,
  // The stroke being painted, not yet laid: [{op, kind, radius, points}].
  pending: () => s.stroke?.runs ?? [],
  // A brush stroke is one undo step from `beginStroke` to `endStroke`; a
  // single call outside a stroke is its own.
  beginStroke: () => { flush(); begin(true); }, endStroke: end,
  // Paints a disc onto `kind`'s layer ('rough' takes every layer off there).
  paint({x, z, radius, kind}) {
   if (kind === 'rough') return api.erase({x, z, radius});
   const L = layerOf(kind);
   if (s.stroke?.open) return dab('paint', L, radius, x, z);
   step(() => put(L, S.union(cur(L), S.disc(x, z, radius))));
  },
  // Takes a disc off one layer, or off every layer.
  erase({x, z, radius, kind = null}) {
   const L = kind ? layerOf(kind) : null;
   if (s.stroke?.open) return dab('erase', L, radius, x, z);
   const d = S.disc(x, z, radius);
   step(() => { for (const K of L ? [L] : every()) put(K, S.difference(cur(K), d)); });
  },
  // An outline (rings, even-odd) filled onto a layer ('rough' clears every one).
  fill(rings, kind) {
   const L = kind === 'rough' ? null : layerOf(kind), set = S.fromRings(rings);
   step(() => { if (L) put(L, S.union(cur(L), set)); else for (const K of every()) put(K, S.difference(cur(K), set)); });
  },
  // SMOOTHING: a layer's edge eased (shapes.js `smoothEdges`: corners round
  // to about the radius, notches narrower fill, thin paths keep their
  // width), over the land or round a point within `area` metres; shapes
  // smaller than the circle go. With no `kind`, every layer is smoothed.
  smooth({radius = 1.5, x = null, z = null, area = null, kind = null} = {}) {
   const kinds = kind ? [layerOf(kind)] : every(), reach = area ?? radius * 4;
   step(() => { for (const L of kinds) put(L, S.smoothEdges(cur(L), {radius, x, z, reach})); });
  },
  // EXTRAPOLATE (the owner, 1 November 2026: "semi rough to fairways ...
  // Allow the user to extrapolate any layers"): `to`'s layer laid `width`
  // metres round `from`'s -- the layer grown exactly, round. A layer below
  // runs on unbroken beneath it (semi under a fairway, as a course is drawn);
  // one above takes only the band round it, so `from` still shows. A green's
  // fringe is laid this way too (Around Green, Lay Fringe): since 24 November
  // 2026 a course from the builder has only the fringe painted on it
  // (real-course.js, BUILT_FRINGE).
  extrapolate({from, to, width}) {
   flush();
   const F = cur(layerOf(from)), T = layerOf(to); if (!F.length || !T || T === from || !(width > 0)) return;
   const band = S.grow(F, width);
   step(() => put(T, S.union(cur(T), LI[T] > LI[from] ? band : S.difference(band, F))));
  },
  // THE LINE TOOL (the owner, 23 November 2026): the pen's line laid `width`
  // metres wide on `kind`'s layer, its ends 'round' or 'square' -- square
  // cut across at the first and last node, its bends mitred (shapes.js
  // `band`). 'rough' takes every layer off along it. One undo. Returns the
  // band's area, m².
  line(points, {kind, width, caps = 'round'}) {
   const L = kind === 'rough' ? null : layerOf(kind), b = S.band(points, width / 2, caps);
   step(() => { if (L) put(L, S.union(cur(L), b)); else for (const K of every()) put(K, S.difference(cur(K), b)); });
   return S.areaOf(b);
  },
  // NORMALIZE WIDTH (line-work.js evenWidthSet; the owner, 23 November 2026):
  // `kind`'s thin shapes laid again `width` metres wide along their middle
  // lines, meetings kept, areas kept. One undo. Returns 1 when it changed
  // anything, else 0.
  evenWidth({kind, width}) {
   flush();
   const L = layerOf(kind), was = L ? cur(L) : S.EMPTY; if (!was.length) return 0;
   const now = evenWidthSet(was, width); if (now === was) return 0;
   step(() => put(L, now));
   return 1;
  },
  // TIDY: on each layer (or `kind`'s), shapes under `minArea` m² go and
  // holes under POCK m² fill -- no specks, no pocks.
  tidy({minArea = SPECK, kind = null} = {}) {
   const kinds = kind ? [layerOf(kind)] : every();
   step(() => { for (const L of kinds) put(L, S.tidy(cur(L), minArea, POCK)); });
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
  digBunker({x, z, radius = 5}) { step(() => { keepList('bunkers'); s.bunkers.push({x, z, radius}); put('sand', S.union(cur('sand'), S.disc(x, z, radius))); }); },
  addCreekLine({points, width = 3}) { step(() => { keepList('creekLines'); s.creekLines.push({points: points.map(p => [...p]), width}); }); },
  // SKIN FROM THE LAND, as the 3D editor's (skin.js): `ground` the heights as
  // they stand -- the land's own grid, so what it finds is turned into
  // outlines once, as it comes in. One undo. Returns {kinds, cells}.
  skin({bio, ground}) {
   const c = SKIN.clear, PLAYED = new Set(['fairway', 'green', 'fringe', 'tee', 'sand', 'water', 'path', 'semi'].map(k => CODE[k])), L = lookup();
   const keepOut = (x, z) => [[0, 0], [c, 0], [-c, 0], [0, c], [0, -c]].some(([dx, dz]) => PLAYED.has(L.at(x + dx, z + dz)));
   const skin = skinFromHeights({nx, nz, cell, halfX: halfX + cell / 2, halfZ: halfZ + cell / 2, ground}, bio, keepOut);
   step(() => { for (const [kind, m] of Object.entries(skin.masks)) { const add = S.fromMask(m, grid); if (add.length) put(kind, S.union(cur(kind), add)); } });
   return {kinds: skin.kinds, cells: skin.cells};
  },
  // HOLDING ONE THING, as the 3D editor's (editing.js holdShape): it comes off
  // the plan at once and `drop` puts it down; one undo, none if it went nowhere.
  hold(pick) {
   flush();
   if (pick.type !== 'shape') {
    const list = pick.type === 'home' ? 'homes' : 'trees', was = s[list][pick.index], base = list === 'homes' ? keepHomes : keepTrees;
    begin(); base();
    const set = (dx, dz, angle = 0) => { s[list][pick.index] = list === 'homes' ? {...was, x: was.x + dx, z: was.z + dz, rotation: was.rotation - angle} : {...was, x: was.x + dx, z: was.z + dz, kept: true}; };
    return {set, drop(dx, dz, angle = 0) { set(dx, dz, angle); if (!dx && !dz && !angle) { s[list][pick.index] = was; s.stroke = null; } else end(); return pick; }};
   }
   begin();
   const before = cur(pick.kind);
   put(pick.kind, S.difference(before, pick.set));
   return {set() {}, drop(dx, dz, angle = 0) {
    if (!dx && !dz && !angle) { if (before.length) s.shapes.set(pick.kind, before); else s.shapes.delete(pick.kind); s.version++; s.stroke = null; return pick; }
    const placed = shapeMoved(pick, dx, dz, angle);
    put(pick.kind, S.union(cur(pick.kind), placed));
    end();
    return {...pick, set: placed};
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
  // `size(x, z, rnd)`: a planted tree's {h, crown} (wood-size.js, from the
  // survey; 22 November 2026), or null for the `height` and `crown` ranges.
  // THE TREES ON THEIR OWN (the owner, 23 November 2026: "does fill outside
  // while keeping also keep trees ... It probably should remove trees but
  // keep everything else"): `trees` 'replace' takes every tree outside off and
  // plants the wood, 'keep' leaves them and plants only in the gaps (what
  // `keep` meant for trees until then, and still its default), 'none' takes
  // them off and plants nothing. `where(x, z)`: plant only where it says (the
  // survey's canopy, so a field stays a field); `vary`: each planted tree's
  // height and crown scaled by up to that share either way (a wood sized from
  // one canopy height came out one height).
  // On outlines (24 November 2026): the ring cuts every layer exactly and the
  // floor is the land's rectangle with the ring taken out (and, keeping, with
  // every other layer taken out too).
  fillOutside(ring, {ground = null, density = 120, edge = 15, height = [10, 22], crown = [2.5, 5], seed = 1, keep = false, size = null, trees = keep ? 'keep' : 'replace', where = null, vary = 0} = {}) {
   if (!ring || ring.length < 3) return 0;
   const G = ground && ground !== 'rough' ? layerOf(ground) : null;
   let q = seed >>> 0 || 1; const rnd = () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648;
   const segDist = (x, z) => { let d = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; };
   let planted = 0;
   step(() => {
    const R = S.fromRings([ring]), outside = S.difference(S.rect(landBox), R);
    if (!keep) { for (const K of every()) if (K !== G) put(K, S.intersect(cur(K), R)); if (G) put(G, S.union(cur(G), outside)); }
    else if (G) { let taken = S.EMPTY; for (const K of every()) if (K !== G) taken = S.union(taken, cur(K)); put(G, S.union(cur(G), S.difference(outside, taken))); }
    const L = lookup(), gCode = G ? CODE[G] : -1;
    keepTrees();
    const onHome = (x, z) => s.homes.some(h => Math.hypot(h.x - x, h.z - z) < Math.max(h.width, h.depth) / 2 + 3);
    if (!keep) { keepHomes(); s.homes = s.homes.filter(h => inside(ring, h.x, h.z)); }
    if (trees !== 'keep') s.trees = s.trees.filter(t => inside(ring, t.x, t.z));
    if (trees === 'none' || !(density > 0)) return;
    const spacing = Math.sqrt(1e4 / density), stood = new Map(), at = (x, z) => `${Math.floor(x / spacing)},${Math.floor(z / spacing)}`;
    for (const t of s.trees) { const c = at(t.x, t.z); stood.set(c, (stood.get(c) || 0) + 1); }
    for (let z = -halfZ; z <= halfZ; z += spacing) for (let x = -halfX; x <= halfX; x += spacing) {
     const px = x + (rnd() - .5) * spacing * .9, pz = z + (rnd() - .5) * spacing * .9;
     if (Math.abs(px) > halfX || Math.abs(pz) > halfZ || inside(ring, px, pz) || stood.get(at(px, pz))) continue;
     if (rnd() > Math.min(1, segDist(px, pz) / edge)) continue;
     if (where && !where(px, pz)) continue;
     if (keep) { const c = L.at(px, pz); if (c > 0 && c !== gCode) continue; if (onHome(px, pz)) continue; }
     const sized = size?.(px, pz, rnd), f = vary > 0 ? 1 + (rnd() * 2 - 1) * vary : 1;
     const t = sized ? {h: sized.h, crown: sized.crown} : {h: height[0] + rnd() * (height[1] - height[0]), crown: crown[0] + rnd() * (crown[1] - crown[0])};
     s.trees.push({x: px, z: pz, h: t.h * f, crown: t.crown * f}); planted++;
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
  // A HOUSE OF ANY SIZE (the owner, 23 November 2026: "I would like the
  // ability to place houses of off size shapes as well. (obviously we can keep
  // them rectangle.)"): one house's width (across its front) and depth set,
  // where it stands and which way it faces kept. One undo.
  sizeHome(index, {width, depth}) { if (!s.homes[index]) return; step(() => { keepHomes(); s.homes[index] = {...s.homes[index], width, depth}; }); },
  homeFits(h) { const c = Math.cos(h.rotation), sn = Math.sin(h.rotation); return [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].every(([a, b]) => { const lx = a * (h.width / 2 + 2), lz = b * (h.depth / 2 + 2), here = api.kindAt(h.x + lx * c + lz * sn, h.z - lx * sn + lz * c); return here && OPEN.has(here); }) && !s.homes.some(o => Math.hypot(o.x - h.x, o.z - h.z) < (Math.max(o.width, o.depth) + Math.max(h.width, h.depth)) / 2 + 4); },
  homeZone(ring, {spacing = 42, seed = 1} = {}) {
   let n = 0;
   step(() => { keepHomes(); n = zoneHomes(ring, {spacing, seed, place: h0 => { const h = api.homeAt(h0); if (!api.homeFits(h)) return false; s.homes.push(h); return true; }}); });
   return n;
  },
  // MOVING ONE SHAPE (the owner, 1 November 2026: "the ability to move
  // individual shapes"). What is under a point (`pickAt`): a house whose
  // footprint holds it, else a tree whose crown does (at least 1.5 m), else
  // a SHAPE -- one outline of one layer there, with its own holes: `kind`'s
  // layer when it covers the point, else the topmost shown. Semi-rough drawn
  // as one sheet round three fairways moves as one.
  pickAt({x, z, kind = null}) {
   flush();
   const hi = s.homes.findIndex(h => { const c = Math.cos(h.rotation), sn = Math.sin(h.rotation), lx = (x - h.x) * c - (z - h.z) * sn, lz = (x - h.x) * sn + (z - h.z) * c; return Math.abs(lx) <= h.width / 2 && Math.abs(lz) <= h.depth / 2; });
   if (hi >= 0) return {type: 'home', index: hi};
   let ti = -1, td = Infinity; s.trees.forEach((t, q) => { const d = Math.hypot(t.x - x, t.z - z); if (d <= Math.max(1.5, t.crown) && d < td) { td = d; ti = q; } });
   if (ti >= 0) return {type: 'tree', index: ti};
   // A creek line within its half-width and 2 m (the builder-ux goal, item 9).
   const seg = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; return Math.hypot(x - ax - t * dx, z - az - t * dz); };
   const ci = (s.creekLines ?? []).findIndex(c => c.points.some((q, n) => n && seg(c.points[n - 1][0], c.points[n - 1][1], q[0], q[1]) <= c.width / 2 + 2));
   if (ci >= 0) return {type: 'creek', index: ci};
   const want = kind && kind !== 'rough' && LI[kind] != null && S.contains(cur(kind), x, z) ? kind : api.kindAt(x, z, true);
   if (!want || want === 'rough') return null;
   const part = S.partAt(cur(want), x, z); if (!part) return null;
   return {type: 'shape', kind: want, set: S.setOf(part)};
  },
  // What `pickAt` found, moved `dx`, `dz` metres (the layers under it show
  // where it stood). One undo step.
  move(pick, dx, dz) {
   if (!pick) return;
   if (pick.type === 'tree') return step(() => { keepTrees(); const t = s.trees[pick.index]; s.trees[pick.index] = {...t, x: t.x + dx, z: t.z + dz}; });
   if (pick.type === 'home') return step(() => { keepHomes(); const h = s.homes[pick.index]; s.homes[pick.index] = {...h, x: h.x + dx, z: h.z + dz}; });
   if (pick.type !== 'shape' || (!dx && !dz)) return;
   step(() => put(pick.kind, S.union(S.difference(cur(pick.kind), pick.set), S.moved(pick.set, dx, dz))));
  },
  // COPY AND DELETE (the builder-ux goal, item 18; "MS Paint/real 3d editor"):
  // what `pickAt` found, stamped again `dx`, `dz` metres away (a tree or a
  // house as it is), the original kept; or taken away (a shape off its own
  // layer only, so what lies under it shows). One undo step each.
  copy(pick, dx, dz) {
   if (!pick || pick.type === 'creek') return;
   if (pick.type === 'tree') return step(() => { keepTrees(); const t = s.trees[pick.index]; s.trees.push({...t, x: t.x + dx, z: t.z + dz}); });
   if (pick.type === 'home') return step(() => { keepHomes(); const h = s.homes[pick.index]; s.homes.push({...h, x: h.x + dx, z: h.z + dz}); });
   if (!dx && !dz) return;
   step(() => put(pick.kind, S.union(cur(pick.kind), S.moved(pick.set, dx, dz))));
  },
  remove(pick) {
   if (!pick) return;
   if (pick.type === 'creek') return step(() => { keepList('creekLines'); s.creekLines = s.creekLines.filter((_, q) => q !== pick.index); });
   if (pick.type === 'tree') return step(() => { keepTrees(); s.trees = s.trees.filter((_, q) => q !== pick.index); });
   if (pick.type === 'home') return step(() => { keepHomes(); s.homes = s.homes.filter((_, q) => q !== pick.index); });
   step(() => put(pick.kind, S.difference(cur(pick.kind), pick.set)));
  },
  // TURNING ONE SHAPE (1 November 2026, the last of amendment 12's list):
  // what `pickAt` found turned `angle` radians about its middle -- a shape's
  // outline exactly, a house's facing; a tree is round. One undo step.
  turn(pick, angle) {
   if (!pick || !angle) return;
   if (pick.type === 'home') return step(() => { keepHomes(); const h = s.homes[pick.index]; s.homes[pick.index] = {...h, rotation: h.rotation - angle}; });   // a facing is measured the other way round (homes.js)
   if (pick.type !== 'shape') return;
   step(() => put(pick.kind, S.union(S.difference(cur(pick.kind), pick.set), shapeMoved(pick, 0, 0, angle))));
  },
  undo() { flush(); return swapStep(s.undo, s.redo); },
  redo() { flush(); return swapStep(s.redo, s.undo); },
 };
 // Undo and redo are one act: a step's remembered values swapped with the present.
 function swapStep(from, to) {
  const st = from.pop(); if (!st) return false;
  const back = {shapes: new Map(), trees: st.trees ? s.trees : null, homes: st.homes ? s.homes : null, rocks: st.rocks ? s.rocks : null, bunkers: st.bunkers ? s.bunkers : null, creekLines: st.creekLines ? s.creekLines : null, runs: []};
  for (const [kind, set] of st.shapes) { back.shapes.set(kind, cur(kind)); if (set.length) s.shapes.set(kind, set); else s.shapes.delete(kind); }
  if (st.trees) s.trees = st.trees;
  if (st.homes) s.homes = st.homes;
  if (st.rocks) s.rocks = st.rocks;
  if (st.bunkers) s.bunkers = st.bunkers;
  if (st.creekLines) s.creekLines = st.creekLines;
  s.version++;
  to.push(back); return true;
 }
 return api;
}
// A picked shape moved `dx`, `dz` and turned `angle` about its middle.
function shapeMoved(pick, dx, dz, angle) {
 let set = pick.set;
 if (angle) { const [cx, cz] = S.middleOf(set); set = S.clean(S.turned(set, angle, cx, cz)); }
 return dx || dz ? S.moved(set, dx, dz) : set;
}
// A patch's cells (indices into an nx x nz grid) turned `angle` radians about
// their middle: every cell in the turned box that turns back onto one of
// them. Returns the new cells. The 3D editor's (editing.js turnShape), until
// it is on outlines too.
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
const OPEN = new Set(PALETTE.filter(k => !['fairway', 'tee', 'green', 'fringe', 'sand', 'water', 'path'].includes(k)));
const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };

// Specks merged into their surroundings and pocks filled, in place (`put(k,
// code)` writes; the default writes straight into `codes`). Exported for the
// auto trace, which tidies its composite before it becomes outlines.
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
