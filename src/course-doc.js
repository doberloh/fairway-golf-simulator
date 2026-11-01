// A BUILT COURSE AS A DOCUMENT, AND AS A FILE (the course builder, stage 0;
// docs/COURSE_BUILDER.md, *Course files*).
//
// Two kinds of course reach the game from a player. A SEEDED course is
// settings and a seed -- course-file.js's version-1 JSON, a few kilobytes --
// and the generator grows it. A BUILT course is everything the ball touches,
// stored: the land as a height grid, every surface as outlines, the holes as
// records, the water with its levels, the trees with their sizes. Nothing is
// generated when it loads, so it plays the same forever (a GENERATOR_VERSION
// bump never moves it); only BUILT_VERSION -- how the game turns a document
// into a world -- can.
//
// THE DOCUMENT (in memory), world metres, +x and +z as the generator's world:
//   {type:'built', name, landscape, designer, halfX, halfZ,
//    land: {x0, z0, cell, cellZ, nx, nz, heights: Float32Array (nx*nz, row by row in z)},
//      (cellZ: the spacing along z, when it differs from cell along x),
//    patches: [{x0, z0, cell, nx, nz, heights}]   finer grids on greens and tees,
//    surfaces: {green, fairway, tee, sand, semi, and each ground type: [polygon]},
//      polygon = [ring, ...] (the first outer, the rest holes), ring = [[x, z], ...],
//    water: [{rings, level, kind}]   flat water: ponds and lakes,
//    creeks: [{kind, points: [CREEK_FIELDS]}]   channels, whose water falls
//      along them (streams.js: the generator's own stations, carried whole),
//    holes: [{number, par, index, tees: [{x, z, set}], green: {x, z}, line: [[x, z], ...]}],
//    trees: Float32Array, TREE_STRIDE numbers a tree (TREE_FIELDS), treeKinds: [name],
//    fringe, semiRough: metres (null: the defaults), sea: {level} | null (a coast),
//    landEdits: [[x0, x1, z0, z1]] where the land was shaped by hand (built-world.js
//      refines its mesh to the land there; on land from LIDAR, everywhere),
//    credits: [string], source: {} (door 2's: {kind: 'lidar', files, epsg, origin:
//      {x, y} -- the land's middle in the survey's map units -- trace}),
//    from: {seed, settings, generator} | null,
//    picture: data URL | null}
//
// THE FILE: a ZIP (zip.js) of course.json (everything but the big arrays),
// land.bin, patches.bin and trees.bin. Heights are stored to the centimetre
// (PLACED: finer than any LIDAR's error, coarser than nothing a ball feels),
// as whole steps above the lowest point, each row differenced so the deflate
// finds the runs. Pure: tested in Node (tests/course-doc.test.mjs).
import {writeZip, readZip, isZip} from './zip.js';
import {BIOME_KEYS} from './settings-schema.js';
import {GROUND_KINDS} from './grounds.js';

export const FILE_KIND = 'fairway-course';
// The file version a built course writes. A seeded course stays version 1
// (course-file.js), so every file saved before the builder still opens.
export const BUILT_FILE_VERSION = 2;
// The turf the holes are made of, then every ground type grounds.js knows
// (rock, scree, hardpan, waste sand, pine straw, leaves, heather, native
// grass, coral, cart path) -- each its own outlines, so a frozen Desert keeps
// its hardpan and a hand-painted heather plays as heather.
export const SURFACE_KINDS = ['green', 'fairway', 'tee', 'sand', 'semi', ...GROUND_KINDS];
// `kind` is an index into the document's `treeKinds` (the species it was
// drawn as where it came from, a frozen generated course), or -1: drawn as
// that species while the landscape grows it, else picked by role.
export const TREE_FIELDS = ['x', 'z', 'h', 'crown', 'trunk', 'role', 'kind'];
export const TREE_STRIDE = TREE_FIELDS.length;
// A creek or river station, as streams.js builds one: where, how wide, the
// water's level and depth, the bank normal, the miter at a bend, and how far
// its valley reaches.
export const CREEK_FIELDS = ['x', 'z', 'width', 'level', 'depth', 'nx', 'nz', 'miter', 'bank'];
// What a stored tree is, for the landscape to pick a species to draw (the
// role's low three bits); +8 marks a tree of an uncleared stand and +16 the
// stand's understory, which the lower graphics tiers thin. Never changes how
// it plays: its trunk and crown are stored.
export const TREE_ROLES = ['tree', 'conifer', 'broadleaf', 'shrub', 'palm'];
// Heights are stored in steps of this many metres unless the land's relief
// needs coarser to fit 16 bits (more than 655 m from lowest to highest).
export const HEIGHT_STEP = .01;
// Limits a document is checked against, so a damaged or hostile file cannot
// ask for a gigabyte. PLACED: a 3 x 3 km property at 1 m is 9 million samples.
export const LIMITS = {samples: 16e6, patchSamples: 4e6, trees: 200000, points: 2e6, holes: 18};

const utf8 = new TextEncoder(), text = new TextDecoder();
const plainError = m => { throw Error(m); };

// A height grid as bytes: [Uint16 steps above `base`, each row differenced].
export function encodeGrid(heights, nx, nz) {
 let lo = Infinity, hi = -Infinity;
 for (const h of heights) { if (h < lo) lo = h; if (h > hi) hi = h; }
 if (!Number.isFinite(lo)) lo = hi = 0;
 const step = Math.max(HEIGHT_STEP, (hi - lo) / 65000);
 const q = new Uint16Array(nx * nz);
 for (let j = 0; j < nz; j++) {
  let prev = 0;
  for (let i = 0; i < nx; i++) {
   const k = j * nx + i, v = Math.round((heights[k] - lo) / step);
   q[k] = (v - prev) & 0xFFFF; prev = v;
  }
 }
 return {base: lo, step, bytes: new Uint8Array(q.buffer)};
}
export function decodeGrid(bytes, nx, nz, base, step) {
 if (bytes.length !== nx * nz * 2) plainError('This course file is damaged: its land is the wrong size.');
 const q = new Uint16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
 const out = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) {
  let v = 0;
  for (let i = 0; i < nx; i++) { const k = j * nx + i; v = (v + q[k]) & 0xFFFF; out[k] = base + v * step; }
 }
 return out;
}

const num = (v, what) => Number.isFinite(v) ? v : plainError(`This course file is damaged: ${what} is not a number.`);
const gridOk = (g, what, max) => {
 if (!g || typeof g !== 'object') plainError(`This course file has no ${what}.`);
 for (const k of ['x0', 'z0', 'cell']) num(g[k], `${what} ${k}`);
 if (g.cellZ != null && !(g.cellZ > 0)) plainError(`This course file is damaged: ${what} has no cell size.`);
 if (!(g.cell > 0)) plainError(`This course file is damaged: ${what} has no cell size.`);
 if (!Number.isInteger(g.nx) || !Number.isInteger(g.nz) || g.nx < 2 || g.nz < 2 || g.nx * g.nz > max) plainError(`This course file's ${what} is too large or empty.`);
};
const ringOk = r => Array.isArray(r) && r.length >= 3 && r.every(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
const polyOk = poly => Array.isArray(poly) && poly.length >= 1 && poly.every(ringOk);
const cleanRing = r => r.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]);

// Checks a document and returns it with only the fields the format knows,
// rounded as the file stores them. Throws in plain words.
export function validateDoc(doc) {
 if (!doc || doc.type !== 'built') plainError('This is not a built Fairway course.');
 const name = String(doc.name ?? '').trim();
 if (!name || name.length > 60) plainError('This course has no usable name (1-60 characters).');
 if (!BIOME_KEYS.includes(doc.landscape)) plainError(`This course's landscape (${doc.landscape}) is not one Fairway knows.`);
 num(doc.halfX, 'the width'); num(doc.halfZ, 'the depth');
 gridOk(doc.land, 'land', LIMITS.samples);
 if (!(doc.land.heights?.length === doc.land.nx * doc.land.nz)) plainError('This course file is damaged: its land is the wrong size.');
 const patches = (doc.patches || []).map((p, i) => {
  gridOk(p, `patch ${i + 1}`, LIMITS.patchSamples);
  if (!(p.heights?.length === p.nx * p.nz)) plainError('This course file is damaged: a green\'s ground is the wrong size.');
  return {x0: p.x0, z0: p.z0, cell: p.cell, nx: p.nx, nz: p.nz, heights: p.heights};
 });
 if (patches.reduce((s, p) => s + p.nx * p.nz, 0) > LIMITS.patchSamples) plainError('This course file\'s greens are too large.');
 let points = 0;
 const surfaces = {};
 for (const k of SURFACE_KINDS) {
  const list = doc.surfaces?.[k] || [];
  if (!Array.isArray(list) || !list.every(polyOk)) plainError(`This course file is damaged: its ${k} outlines are broken.`);
  surfaces[k] = list.map(poly => poly.map(cleanRing));
  points += list.reduce((s, poly) => s + poly.reduce((t, r) => t + r.length, 0), 0);
 }
 const water = (doc.water || []).map(w => {
  if (!polyOk(w.rings)) plainError('This course file is damaged: a pond\'s outline is broken.');
  points += w.rings.reduce((t, r) => t + r.length, 0);
  return {rings: w.rings.map(cleanRing), level: num(w.level, 'a water level'), kind: ['pond', 'lake', 'creek'].includes(w.kind) ? w.kind : 'pond'};
 });
 const creeks = (doc.creeks || []).map(c => {
  const pts = (c.points || []).filter(q => Array.isArray(q) && q.length === CREEK_FIELDS.length && q.every(Number.isFinite));
  if (pts.length < 2 || pts.length !== (c.points || []).length) plainError('This course file is damaged: a creek is broken.');
  points += pts.length;
  return {kind: c.kind === 'river' ? 'river' : 'creek', points: pts.map(q => q.map(v => Math.round(v * 1000) / 1000))};
 });
 if (points > LIMITS.points) plainError('This course file has too many outline points.');
 const holes = (doc.holes || []).map((h, i) => {
  const tees = (h.tees || []).map(t => ({x: num(t.x, 'a tee'), z: num(t.z, 'a tee'), set: String(t.set || 'middle')}));
  if (!tees.length) plainError(`Hole ${i + 1} has no tee.`);
  const green = {x: num(h.green?.x, 'a green'), z: num(h.green?.z, 'a green')};
  const line = (h.line || []).map(p => [num(p[0], 'a hole line'), num(p[1], 'a hole line')]);
  return {number: Number.isInteger(h.number) ? h.number : i + 1, par: [3, 4, 5, 6].includes(h.par) ? h.par : 4,
   index: Number.isInteger(h.index) ? h.index : i + 1, tees, green, line: line.length >= 2 ? line : [[tees[0].x, tees[0].z], [green.x, green.z]]};
 });
 if (holes.length !== 9 && holes.length !== 18) plainError('A course has 9 or 18 holes.');
 const trees = doc.trees instanceof Float32Array ? doc.trees : new Float32Array(doc.trees || []);
 if (trees.length % TREE_STRIDE || trees.length / TREE_STRIDE > LIMITS.trees) plainError('This course file\'s trees are damaged or too many.');
 return {type: 'built', name, landscape: doc.landscape, designer: doc.designer ?? null, halfX: doc.halfX, halfZ: doc.halfZ,
  land: {x0: doc.land.x0, z0: doc.land.z0, cell: doc.land.cell, cellZ: doc.land.cellZ ?? doc.land.cell, nx: doc.land.nx, nz: doc.land.nz, heights: doc.land.heights},
  patches, surfaces, water, creeks, holes, trees,
  fringe: Number.isFinite(doc.fringe) ? Math.max(0, Math.min(6, doc.fringe)) : null, semiRough: Number.isFinite(doc.semiRough) ? Math.max(0, Math.min(20, doc.semiRough)) : null,
  sea: Number.isFinite(doc.sea?.level) ? {level: doc.sea.level} : null,
  landEdits: (Array.isArray(doc.landEdits) ? doc.landEdits : []).filter(b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite)).slice(0, 2000).map(b => b.map(v => Math.round(v * 10) / 10)),
  treeKinds: (doc.treeKinds || []).map(String).slice(0, 200),
  credits: (doc.credits || []).map(String).slice(0, 20), source: doc.source && typeof doc.source === 'object' ? doc.source : {},
  from: doc.from ?? null, picture: typeof doc.picture === 'string' ? doc.picture : null, builtVersion: doc.builtVersion ?? null};
}

// The file's bytes for a document. `builtVersion` is the game's, stamped on.
export async function writeBuiltFile(doc, builtVersion) {
 const d = validateDoc(doc);
 const land = encodeGrid(d.land.heights, d.land.nx, d.land.nz);
 const patchParts = d.patches.map(p => ({p, g: encodeGrid(p.heights, p.nx, p.nz)}));
 const patchBytes = new Uint8Array(patchParts.reduce((s, x) => s + x.g.bytes.length, 0));
 let at = 0;
 const patches = patchParts.map(({p, g}) => { patchBytes.set(g.bytes, at); const r = {x0: p.x0, z0: p.z0, cell: p.cell, nx: p.nx, nz: p.nz, base: g.base, step: g.step, offset: at}; at += g.bytes.length; return r; });
 const json = {kind: FILE_KIND, version: BUILT_FILE_VERSION, type: 'built', builtVersion, name: d.name, landscape: d.landscape, designer: d.designer,
  halfX: d.halfX, halfZ: d.halfZ, fringe: d.fringe, semiRough: d.semiRough, sea: d.sea, landEdits: d.landEdits, land: {x0: d.land.x0, z0: d.land.z0, cell: d.land.cell, cellZ: d.land.cellZ, nx: d.land.nx, nz: d.land.nz, base: land.base, step: land.step},
  patches, surfaces: d.surfaces, water: d.water, creeks: d.creeks, holes: d.holes, trees: d.trees.length / TREE_STRIDE, treeKinds: d.treeKinds,
  credits: d.credits, source: d.source, from: d.from, picture: d.picture};
 return writeZip([
  {name: 'course.json', data: JSON.stringify(json)},
  {name: 'land.bin', data: land.bytes},
  {name: 'patches.bin', data: patchBytes},
  {name: 'trees.bin', data: new Uint8Array(d.trees.buffer, d.trees.byteOffset, d.trees.byteLength)},
 ]);
}

// A document from a built file's bytes. Refused in plain words when it is not
// one, or comes from a newer Fairway.
export async function readBuiltFile(bytes) {
 if (!isZip(bytes)) plainError('This is not a Fairway course file.');
 const parts = await readZip(bytes);
 const raw = parts.get('course.json');
 if (!raw) plainError('This is not a Fairway course file.');
 let j;
 try { j = JSON.parse(text.decode(raw)); } catch { plainError('This course file is damaged: its description cannot be read.'); }
 if (j.kind !== FILE_KIND || j.type !== 'built') plainError('This is not a Fairway course file.');
 if (!Number.isInteger(j.version) || j.version > BUILT_FILE_VERSION) plainError('This course file was made by a newer version of Fairway. Update Fairway, then open it again.');
 gridOk(j.land, 'land', LIMITS.samples);
 const heights = decodeGrid(parts.get('land.bin') || new Uint8Array(0), j.land.nx, j.land.nz, num(j.land.base, 'the land'), num(j.land.step, 'the land'));
 const pb = parts.get('patches.bin') || new Uint8Array(0);
 const patches = (j.patches || []).map((p, i) => {
  gridOk(p, `patch ${i + 1}`, LIMITS.patchSamples);
  const n = p.nx * p.nz * 2;
  if (!(p.offset >= 0 && p.offset + n <= pb.length)) plainError('This course file is damaged: a green\'s ground is missing.');
  return {x0: p.x0, z0: p.z0, cell: p.cell, nx: p.nx, nz: p.nz, heights: decodeGrid(pb.subarray(p.offset, p.offset + n), p.nx, p.nz, p.base, p.step)};
 });
 const tb = parts.get('trees.bin') || new Uint8Array(0);
 if (tb.length !== (j.trees || 0) * TREE_STRIDE * 4) plainError('This course file is damaged: its trees are the wrong size.');
 const trees = new Float32Array(tb.buffer.slice(tb.byteOffset, tb.byteOffset + tb.length));
 return validateDoc({...j, type: 'built', land: {...j.land, heights}, patches, trees});
}

// Any course file's bytes: a built course's ZIP, or a seeded course's JSON
// text (course-file.js, version 1), told apart by their first bytes.
export const isBuiltFile = bytes => isZip(bytes);
export const textOf = bytes => text.decode(bytes);
export const bytesOf = s => utf8.encode(s);
