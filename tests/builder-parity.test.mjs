// The two editors do the same things by the same rules (the owner, 4 November
// 2026). Each tool is tried in both, or in the one that gained it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../src/builder/editing.js';
import {createTrace} from '../src/builder/trace-edit.js';
import {docFromLand} from '../src/builder/real-course.js';
import {validateDoc, TREE_STRIDE} from '../src/course-doc.js';
import {treeCover, coverByKey, COVER_RANGE, TREE_REFUSED, treeChoices} from '../src/builder/cover.js';
import {TREE_NAMES} from '../src/builder/tree-names.js';
import {FAMILY_OF} from '../src/plant-families.js';
import {GROUND_PLANTS} from '../src/species.js';
import {worldFromDoc} from '../src/built-world.js';
import {cornersOf, zoneTrees, anchorHit} from '../src/builder/layer-ops.js';
import {previewOf} from '../src/builder/preview-items.js';
import {familyModels} from '../src/mesh-assets.js';
import {BIOMES} from '../src/biomes.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const holes = () => Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [0, 80]]}));
function doc(rise = () => 100) {
 const nx = 201, heights = new Float32Array(nx * nx);
 for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = rise(-100 + i, -100 + j);
 return validateDoc({type: 'built', name: 'Both', landscape: 'winecountry', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz: nx, heights}, patches: [],
  surfaces: {green: [box(-10, 70, 10, 90)], fairway: [box(-12, -60, 12, 60)], sand: [box(20, 0, 26, 6)]}, water: [], holes: holes(), trees: new Float32Array(0), treeKinds: []});
}
const land2d = (rise = () => 100) => { const nx = 201, ground = new Float32Array(nx * nx); for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) ground[j * nx + i] = rise(-100 + i, -100 + j); return {nx, nz: nx, cell: 1, halfX: 100, halfZ: 100, ground}; };
const trace = (land = land2d()) => { const m = createTrace(land); m.fill(box(-12, -60, 12, 60), 'fairway'); m.fill(box(-10, 70, 10, 90), 'green'); return m; };
const make = (land, m, extra = {}) => validateDoc(docFromLand({land, traced: {layers: m.state.layers}, holes: holes().map(({number, tees, green}) => ({number, tees, green})), trees: m.state.trees, homes: m.state.homes, rocks: m.state.rocks, bunkers: m.state.bunkers, creekLines: m.state.creekLines, name: 'Two', landscape: 'winecountry', ...extra}));
const bio = BIOMES.winecountry, trees = treeCover(bio);

test('the tree brush scatters across its width at many sizes, never in a line', () => {
 const e = createEditor(doc()), rng = seeded(5);
 for (const x of [-60, -55, -50]) e.paintCover({cover: trees, x, z: 0, radius: 15, min: 8, max: 30, density: 1, group: {}, rng});
 const t = e.state.trees;
 assert.ok(t.length > 8, `${t.length} trees`);
 const zs = t.map(q => q[1]), hs = t.map(q => q[2]);
 assert.ok(Math.max(...zs) - Math.min(...zs) > 12, 'spread across the brush, not along the pointer');
 assert.ok(Math.max(...hs) - Math.min(...hs) > 5, 'different sizes');
 assert.ok(hs.every(h => h >= 8 && h <= 30));
 assert.ok(t.every(q => trees.plants.some(p => p[0] === e.state.treeKinds[q[6]])), 'the landscape\'s own species');
 assert.ok(t.every(q => (q[5] & 7) !== 3), 'a tree, not a bush');
});

test('neither editor puts a tree on turf, sand, water, a path or a road', () => {
 const e = createEditor(doc()), m = trace(), rng = seeded(9);
 assert.equal(e.paintCover({cover: trees, x: 0, z: 0, radius: 10, min: 8, max: 20, density: 1, rng}), 0);
 assert.equal(m.paintCover({cover: trees, x: 0, z: 0, radius: 10, min: 8, max: 20, density: 1, rng}), 0);
 assert.equal(e.treeFits(0, 0), false); assert.equal(e.treeFits(23, 3), false); assert.equal(e.treeFits(80, 0), true);
 assert.ok(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'road'].every(k => TREE_REFUSED.has(k)));
 assert.equal(e.treeZone(box(-10, -10, 10, 10)[0]), 0);
 const n = e.treeZone(box(40, 40, 90, 90)[0]);
 assert.ok(n > 5); assert.equal(e.state.trees.length, n);
 e.undo(); assert.equal(e.state.trees.length, 0);
});

test('a tree painted in 2D keeps its species and size in the course', () => {
 const land = land2d(), m = trace(), rng = seeded(4);
 m.paintCover({cover: trees, x: 60, z: 0, radius: 15, min: 8, max: 20, density: 1, rng});
 const n = m.state.trees.length; assert.ok(n > 2);
 const d = make(land, m);
 assert.equal(d.trees.length / TREE_STRIDE, n);
 assert.ok(d.treeKinds.every(k => trees.plants.some(p => p[0] === k)));
 m.undo(); assert.equal(m.state.trees.length, 0);
});

test('Place tree: every landscape\'s trees by name, and the one picked is the one that grows', async () => {
 for (const k of BIOME_KEYS) {
  const choices = treeChoices(BIOMES[k]);
  if (!choices.length) { assert.equal(k, 'links', 'only a treeless links has none to pick'); continue; }
  for (const [species, name] of choices) { assert.ok(TREE_NAMES[species], `${k}: ${species} has no name`); assert.equal(name, TREE_NAMES[species]); assert.ok(familyModels(FAMILY_OF[species] ?? species).length, `${k}: ${species} has no model`); }
  assert.equal(new Set(choices.map(c => c[1])).size, choices.length, `${k}: a name twice`);
  const [species] = choices[0], s = previewOf({kind: 'tree', species, height: 20}, BIOMES[k]);
  assert.equal(s.pieces.length, 1); assert.equal(s.pieces[0].size, 20); assert.equal(s.title, TREE_NAMES[species]);
 }
 const e = createEditor(doc());
 e.placeTree({x: 50, z: 50, h: 18, species: 'blueoak'}); e.placeTree({x: 60, z: 60, h: 18}); e.placeTree({x: 70, z: 70, h: 12, species: 'blueoak'});
 assert.equal(e.state.treeKinds.length, 1); assert.equal(e.state.trees[1][6], -1, 'unpicked, the landscape chooses');
 const w = worldFromDoc(e.toDoc());
 assert.equal(w.trees[0].kind, 'blueoak'); assert.equal(w.trees[2].kind, 'blueoak'); assert.equal(w.trees[0].h, 18);
 e.undo(); assert.equal(e.state.trees.length, 2);
 const land = land2d(), m = trace(land);
 m.addTree({x: 50, z: 50, h: 18, species: 'valleyoak'}); m.addTree({x: 60, z: 60, h: 14, crown: 4});
 assert.deepEqual(make(land, m).treeKinds, ['valleyoak']);
 // A tree only a landscape's stands grow still draws as itself.
 const standOnly = BIOME_KEYS.flatMap(k => (BIOMES[k].stands?.plants ?? []).filter(p => !BIOMES[k].plants.some(q => q[0] === p[0]) && !GROUND_PLANTS.has(p[0])).map(p => [k, p[0]]))[0];
 if (standOnly) { const d = doc(); d.landscape = standOnly[0]; d.trees = new Float32Array([50, 50, 18, 5, .4, 2, 0]); d.treeKinds = [standOnly[1]]; assert.equal(worldFromDoc(d).trees[0].kind, standOnly[1]); }
});

test('the preview shows the tree brush\'s smallest and largest on every landscape', () => {
 for (const k of BIOME_KEYS) {
  const s = previewOf({kind: 'cover', cover: 'trees', min: 8, max: 30}, BIOMES[k]);
  assert.deepEqual(s.pieces.map(p => p.size), [8, 19, 30], k);
  for (const p of s.pieces) assert.ok(familyModels(p.family).length, `${k}: ${p.family}`);
 }
 assert.ok(COVER_RANGE.trees.high > 30); assert.equal(coverByKey(bio, 'trees').key, 'trees');
});

test('water by the 3D paint brush has a sheet, a level and a bed, and goes when erased', () => {
 const e = createEditor(doc((x) => 100 + x * .1)), group = {};
 e.paint({kind: 'water', x: 60, z: -30, radius: 12, group});
 assert.ok(e.settleWater(), 'the stroke\'s end digs it');
 assert.equal(e.state.water.length, 1);
 const level = e.state.water[0].level;
 assert.ok(e.height(60, -30) < level, 'under its water');
 assert.equal(e.settleWater(), null, 'nothing more to do');
 e.undo();
 assert.equal(e.state.water.length, 0); assert.equal(e.surfaceAt(60, -30), 'rough'); assert.ok(Math.abs(e.height(60, -30) - 106) < .01, 'one undo fills it');
 e.redo();
 assert.equal(e.state.water.length, 1);
 e.erase({kind: 'water', x: 60, z: -30, radius: 20, group: {}}); e.settleWater();
 assert.equal(e.state.water.length, 0, 'erased water leaves no sheet');
});

test('outlined water and two strokes that join make one body at one level', () => {
 const e = createEditor(doc());
 e.fillOutline({kind: 'water', ring: box(40, 40, 60, 60)[0]}); e.settleWater();
 const level = e.state.water[0].level;
 e.paint({kind: 'water', x: 66, z: 50, radius: 10}); e.settleWater();
 assert.equal(e.state.water.length, 1); assert.equal(e.state.water[0].level, level);
});

test('edge smoothing, tidying and extrapolating are the same rule in both', () => {
 const e = createEditor(doc()), m = trace();
 e.fillOutline({kind: 'heather', ring: box(30, 30, 60, 60)[0]});
 e.paint({kind: 'heather', x: 62, z: 45, radius: 1.2});
 const u = e.state.undo.length;
 e.smoothEdges({x: 61, z: 45, radius: 2, area: 6, kind: 'heather', group: {}});
 assert.equal(e.state.undo.length, u + 1);
 assert.equal(e.surfaceAt(45, 45), 'heather', 'the middle stays');
 e.paint({kind: 'sand', x: -70, z: -70, radius: .6});
 e.tidy({kind: 'sand'});
 assert.equal(e.surfaceAt(-70, -70), 'rough', 'a speck goes');
 assert.equal(e.surfaceAt(23, 3), 'sand', 'a bunker stays');
 e.undo(); assert.equal(e.surfaceAt(-70, -70), 'sand', 'one undo');
 e.extrapolate({from: 'fairway', to: 'semi', width: 4});
 assert.equal(e.surfaceAt(14, 0), 'semi'); assert.equal(e.surfaceAt(0, 0), 'fairway');
 m.extrapolate({from: 'fairway', to: 'semi', width: 4});
 assert.equal(m.kindAt(14, 0), 'semi'); assert.equal(m.kindAt(0, 0), 'fairway');
 m.smooth({x: 0, z: 0, radius: 2, area: 8, kind: 'fairway'});
 assert.equal(m.kindAt(0, 0), 'fairway');
});

test('house and tree zones in the 3D editor, one undo each', () => {
 const e = createEditor(doc()), n = e.homeZone(box(30, -90, 95, -30)[0], {seed: 3});
 assert.ok(n >= 2); assert.equal(e.state.homes.length, n);
 e.undo(); assert.equal(e.state.homes.length, 0);
 assert.equal(e.homeZone(box(-11, -50, 11, 50)[0]), 0, 'none on a fairway');
 assert.ok(zoneTrees(box(0, 0, 100, 100)[0], {open: () => true, seed: 2}).length > 50);
});

test('a tree sized in 2D, one undo for the slider', () => {
 const m = trace(); m.addTree({x: 50, z: 50, h: 10, crown: 3});
 const base = {...m.state.trees[0]};
 m.sizeTree(0, base, 2, true); m.sizeTree(0, base, 3, false);
 assert.equal(m.state.trees[0].h, 30); assert.equal(m.state.trees[0].crown, 9); assert.ok(m.state.trees[0].kept);
 m.undo(); assert.equal(m.state.trees[0].h, 10);
});

test('held in 2D as in 3D: it comes off at once, moves or turns in one undo', () => {
 const m = trace(); m.fill(box(30, 40, 50, 44), 'sand');
 const pick = m.pickAt({x: 40, z: 42}), u = m.state.undo.length, hold = m.hold(pick);
 assert.equal(m.kindAt(40, 42), 'rough', 'what lay under it shows');
 const got = hold.drop(0, 20);
 assert.equal(m.kindAt(40, 62), 'sand'); assert.equal(m.kindAt(40, 42), 'rough'); assert.equal(m.state.undo.length, u + 1);
 m.undo(); assert.equal(m.kindAt(40, 42), 'sand');
 const again = m.hold(m.pickAt({x: 40, z: 42}));
 again.drop(0, 0);
 assert.equal(m.kindAt(40, 42), 'sand'); assert.equal(m.state.undo.length, u, 'let go where it began, no undo');
 const turned = m.hold(m.pickAt({x: 40, z: 42})).drop(0, 0, Math.PI / 2);
 assert.equal(m.kindAt(40, 50), 'sand'); assert.equal(m.kindAt(32, 42), 'rough');
 assert.equal(turned.kind, 'sand'); assert.ok(got.cells.length);
 m.addTree({x: 70, z: 70, h: 12, crown: 3});
 const tree = m.pickAt({x: 70, z: 70}), t = m.hold(tree);
 t.set(5, 0); assert.equal(m.state.trees[tree.index].x, 75);
 t.drop(-5, 0); assert.equal(m.state.trees[tree.index].x, 65); assert.ok(m.state.trees[tree.index].kept);
 assert.equal(cornersOf(box(0, 0, 10, 10)[0]).length, 4);
});

test('a bunker dug and a creek drawn in 2D are in the course, and undo', () => {
 const land = land2d((x) => 100 - x * .05), m = trace(land);
 m.digBunker({x: 40, z: 0, radius: 6});
 assert.equal(m.kindAt(40, 0), 'sand');
 m.addCreekLine({points: [[50, -80], [52, 0], [60, 80]], width: 3});
 assert.equal(m.state.creekLines.length, 1);
 const d = make(land, m), h = (x, z) => d.land.heights[(z + 100) * d.land.nx + x + 100];
 assert.ok(h(40, 0) < 98 - .4, `the bowl: ${h(40, 0)}`);
 assert.equal(d.creeks.length, 1);
 const mid = d.creeks[0].points[d.creeks[0].points.length >> 1];
 assert.ok(h(Math.round(mid[0]), Math.round(mid[1])) < mid[3], 'the channel is under its water');
 m.undo(); assert.equal(m.state.creekLines.length, 0);
 m.undo(); assert.equal(m.state.bunkers.length, 0); assert.equal(m.kindAt(40, 0), 'rough');
});

test('skin from the land works in 2D as in 3D', () => {
 const steep = (x, z) => x > 60 ? 100 + (x - 60) * 1.2 : 100, land = land2d(steep), m = trace(land), b = {...BIOMES.badlands};
 const got = m.skin({bio: b, ground: land.ground});
 assert.ok(got.cells.face > 100, `${got.cells.face} cells`);
 assert.equal(m.kindAt(80, 0), got.kinds.face);
 assert.equal(m.kindAt(0, 0), 'fairway', 'the turf is left alone');
 m.undo(); assert.equal(m.kindAt(80, 0), 'rough');
});

test('a press takes an anchor only when it is nearer that than the shape\'s middle', () => {
 const small = [[100, 100], [110, 100], [110, 110], [100, 110]];
 assert.equal(anchorHit(small, 105, 105, 11), -1, 'the middle of a small shape moves it, though every anchor is in reach');
 assert.equal(anchorHit(small, 99, 99, 11), 0, 'its corner still turns it');
 assert.equal(anchorHit(small, 112, 112, 11), 2, 'the nearest corner');
 const big = [[0, 0], [200, 0], [200, 200], [0, 200]];
 assert.equal(anchorHit(big, 5, 5, 11), 0);
 assert.equal(anchorHit(big, 100, 100, 11), -1);
 assert.equal(anchorHit(big, 30, 30, 11), -1, 'out of reach');
});
