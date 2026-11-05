// Ground cover and holding a shape in the 3D editor (src/builder/cover.js,
// editing.js holdShape), Back to 2D from any course (draft-from-doc.js), and
// rocks through the course file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {coverOptions, coverSize, scatterCover, coverAt, FLOWER_PLANTS, COVER_RANGE} from '../src/builder/cover.js';
import {createEditor} from '../src/builder/editing.js';
import {draftFromDoc} from '../src/builder/draft-from-doc.js';
import {docFromLand} from '../src/builder/real-course.js';
import {validateDoc, writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc, rockFrom} from '../src/built-world.js';
import {BIOMES} from '../src/biomes.js';
import {BIOME_KEYS, BUILT_VERSION} from '../src/settings-schema.js';
import {GROUND_PLANTS} from '../src/species.js';

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
function doc() {
 const nx = 201, nz = 201, heights = new Float32Array(nx * nz).fill(100);
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -80, set: 'back'}], green: {x: 0, z: 80}, line: [[-5, -80], [-2, 0], [0, 80]]}));
 return validateDoc({type: 'built', name: 'Cover', landscape: 'winecountry', halfX: 100, halfZ: 100, land: {x0: -100, z0: -100, cell: 1, nx, nz, heights}, patches: [],
  surfaces: {green: [box(-10, 70, 10, 90)], fairway: [box(-12, -60, 12, 60)], sand: [box(20, 0, 26, 6)]}, water: [{rings: box(-60, -10, -40, 10), level: 99, kind: 'pond'}], holes,
  trees: new Float32Array([30, 30, 15, 4, .4, 2, -1, 70, 70, 12, 3, .3, 1, -1]), treeKinds: [], homes: [{x: 60, z: -60, rotation: 0, width: 20, depth: 15}]});
}
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('every landscape offers rocks and bushes of its own', () => {
 for (const k of BIOME_KEYS) {
  const o = coverOptions(BIOMES[k]);
  assert.equal(o[0].key, 'rocks', k); assert.equal(o[1].key, 'bushes', k);
  for (const c of o.slice(1)) for (const [p] of c.plants) assert.ok(p === 'shrub' || GROUND_PLANTS.has(p), `${k}: ${p}`);
  assert.ok(o[1].plants.every(([p]) => !FLOWER_PLANTS.has(p)), k);
 }
 assert.ok(coverOptions(BIOMES.winecountry).some(c => c.key === 'flowers'), 'poppies in wine country');
 for (const r of Object.values(COVER_RANGE)) assert.ok(r.low < r.from[0] && r.from[0] < r.from[1] && r.from[1] < r.high);
});

test('sizes stay between the sliders, and a dab keeps off what stands there', () => {
 assert.equal(coverSize(1, 3, 0), 1); assert.equal(coverSize(1, 3, 1), 3); assert.equal(coverSize(2, 1, 1), 2, 'a minimum past the maximum wins');
 const [rocks, bushes] = coverOptions(BIOMES.winecountry);
 const got = scatterCover({cover: rocks, x: 0, z: 0, radius: 20, min: .5, max: 2, density: 1, rng: seeded(), open: () => true});
 assert.ok(got.length > 10);
 for (const {rock: [x, z, size, shape]} of got) { assert.ok(Math.hypot(x, z) <= 20.01); assert.ok(size >= .5 && size <= 2); assert.ok(shape >= 0 && shape < 4); }
 for (let a = 0; a < got.length; a++) for (let b = a + 1; b < got.length; b++) { const p = got[a].rock, q = got[b].rock; assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) > (p[2] + q[2]) / 2 - .02, 'no two stones in one spot'); }
 assert.equal(scatterCover({cover: bushes, x: 0, z: 0, radius: 20, min: .5, max: 2, rng: seeded(), open: () => false}).length, 0, 'nothing on closed ground');
 const b = scatterCover({cover: bushes, x: 0, z: 0, radius: 20, min: .5, max: 2, rng: seeded(), open: () => true});
 assert.ok(b.length > 1 && b.every(p => bushes.plants.some(q => q[0] === p.species)));
 assert.ok(coverAt({rocks: [[5, 5, 2, 0, 0]], trees: []}, 5.5, 5, .1)); assert.ok(!coverAt({rocks: [[5, 5, 2, 0, 0]], trees: []}, 9, 5, .1));
});

test('the brush paints open ground only, a drag is one undo, and the file keeps it all', async () => {
 const e = createEditor(doc()), [rocks, bushes] = coverOptions(BIOMES.winecountry), group = {}, rng = seeded(7), trees = e.state.trees.length;
 const undo = e.state.undo.length;
 for (const x of [-30, -25]) e.paintCover({cover: rocks, x, z: 50, radius: 12, min: .5, max: 2, density: 1, group, rng});
 assert.ok(e.state.rocks.length > 5);
 assert.equal(e.state.undo.length, undo + 1, 'one undo for the drag');
 // Over the fairway: nothing lands on it.
 e.paintCover({cover: bushes, x: 0, z: 0, radius: 11, min: .5, max: 1.5, density: 1, group: {}, rng});
 assert.ok(e.state.trees.slice(trees).every(t => Math.abs(t[0]) >= 12));
 e.paintCover({cover: bushes, x: -30, z: -60, radius: 12, min: .5, max: 1.5, density: 1, group: {}, rng});
 const painted = e.state.trees.length - trees; assert.ok(painted > 3);
 const w = worldFromDoc(await readBuiltFile(await writeBuiltFile(e.toDoc(), BUILT_VERSION)));
 assert.equal(w.rocks.length, e.state.rocks.length);
 assert.ok(w.rocks.every(r => r.top > 100 && r.reach > 0 && r.shape >= 0 && r.shape < 4), 'each a stone the ball can hit');
 const kinds = w.trees.slice(trees).map(t => t.kind);
 assert.ok(kinds.every(k => bushes.plants.some(p => p[0] === k)), 'each its painted species');
 e.undo(); e.undo();
 assert.equal(e.state.trees.length, trees); assert.equal(e.state.treeKinds.length, 0);
 e.undo();
 assert.equal(e.state.rocks.length, 0);
});

test('clearing cover takes rocks and low plants, never a tree', () => {
 const e = createEditor(doc()), [rocks, bushes] = coverOptions(BIOMES.winecountry), rng = seeded(3);
 e.paintCover({cover: rocks, x: 30, z: 45, radius: 6, min: .5, max: 1, density: 1, rng});
 e.paintCover({cover: bushes, x: 30, z: 45, radius: 12, min: .5, max: 1, density: 1, rng});
 const n = e.clearCover({x: 30, z: 40, radius: 40});
 assert.ok(n > 3);
 assert.equal(e.state.rocks.length, 0); assert.equal(e.state.trees.length, 2);
});

test('an older file has no rocks and plays as it did', () => {
 assert.deepEqual(worldFromDoc(doc()).rocks, []);
 const r = rockFrom([1, 2, 2, 3, .5], 100);
 assert.equal(r.reach, 1); assert.ok(r.top > 100.5);
});

test('held, a shape comes off the course at once and is put down in one undo', () => {
 const e = createEditor(doc()), pick = e.pickAt({x: 23, z: 3});
 assert.equal(pick.kind, 'sand');
 assert.ok(e.onPick(pick, 23, 3)); assert.ok(!e.onPick(pick, 40, 3));
 const u = e.state.undo.length, hold = e.holdShape(pick);
 assert.equal(e.surfaceAt(23, 3), 'rough', 'what lay under it shows while it is carried');
 assert.ok(hold.rings[0].length >= 3); assert.ok(Math.abs(hold.mid.x - 23) < .6);
 const got = hold.drop(30, 10);
 assert.equal(e.surfaceAt(53, 13), 'sand'); assert.equal(e.surfaceAt(23, 3), 'rough');
 assert.equal(e.state.undo.length, u + 1);
 assert.equal(got.pick.cells.length, pick.cells.length);
 assert.ok(e.onPick(got.pick, 53, 13), 'still selected where it lies');
 e.undo();
 assert.equal(e.surfaceAt(23, 3), 'sand'); assert.equal(e.surfaceAt(53, 13), 'rough');
});

test('let go where it began, nothing happened', () => {
 const e = createEditor(doc()), u = e.state.undo.length, was = e.state.surfacesEdited;
 const hold = e.holdShape(e.pickAt({x: 23, z: 3}));
 hold.drop(0, 0);
 assert.equal(e.surfaceAt(23, 3), 'sand'); assert.equal(e.state.undo.length, u); assert.equal(e.state.surfacesEdited, was);
});

test('held and turned: a long shape a quarter round', () => {
 const e = createEditor(doc());
 e.fillOutline({kind: 'sand', ring: [[20, 40], [40, 40], [40, 44], [20, 44]]});
 const hold = e.holdShape(e.pickAt({x: 30, z: 42}));
 hold.drop(0, 0, Math.PI / 2);
 assert.equal(e.surfaceAt(30, 50), 'sand'); assert.equal(e.surfaceAt(22, 42), 'rough');
});

test('a tree and a house carried live, one undo each', () => {
 const e = createEditor(doc()), tree = e.pickAt({x: 70, z: 70}), hold = e.holdShape(tree), u = e.state.undo.length;
 hold.set(5, 0); assert.equal(e.state.trees[tree.index][0], 75, 'it moves as it is carried');
 hold.drop(-5, 0); assert.equal(e.state.trees[tree.index][0], 65); assert.equal(e.state.undo.length, u);
 e.undo(); assert.equal(e.state.trees[tree.index][0], 70);
 const home = e.pickAt({x: 60, z: -60}), h = e.holdShape(home);
 assert.equal(h.rings[0].length, 4);
 h.drop(0, 0, .4); assert.ok(Math.abs(e.state.homes[home.index].rotation + .4) < 1e-9);
});

test('a pond carried takes its water and its bed with it', () => {
 const e = createEditor(doc()), pick = e.pickAt({x: -50, z: 0}), u = e.state.undo.length;
 assert.equal(pick.kind, 'water');
 const got = e.holdShape(pick).drop(0, 50);
 assert.ok(got.water);
 assert.equal(e.surfaceAt(-50, 50), 'water');
 assert.ok(Math.abs(e.state.water[0].rings[0][0][1] - e.state.water[0].rings[0][1][1]) < 1e-6, 'the outline moved whole');
 assert.ok(e.height(-50, 50) < e.state.water[0].level, 'dug where it landed');
 assert.equal(e.state.undo.length, u + 1);
 e.undo();
 assert.equal(e.surfaceAt(-50, 0), 'water'); assert.equal(e.height(-50, 50), 100);
});

test('any course goes to 2D: a course file becomes door 2\'s draft, and back', () => {
 const source = doc(); source.trees = new Float32Array([30, 30, 15, 4, .4, 2, -1, 40, 40, 1, .6, .05, 3, 0]); source.treeKinds = ['chaparral']; source.rocks = [[5, 5, 2, 1, .5]];
 const d = draftFromDoc(source), {land, trace} = d;
 assert.equal(d.step, 5); assert.equal(d.holes.length, 9); assert.equal(d.holes[0].aims.length, 1);
 assert.equal(land.ground.length, land.nx * land.nz);
 const i = Math.round((0 + land.halfX) / land.cell), j = Math.round((80 + land.halfZ) / land.cell);
 assert.equal(trace.masks.get('green')[j * land.nx + i], 1);
 assert.ok(trace.masks.get('water').some(v => v), 'the water is a layer');
 const back = validateDoc(docFromLand({land, traced: {layers: {masks: trace.masks}, codes: null}, holes: d.holes, trees: trace.trees, homes: trace.homes, name: d.name, landscape: d.landscape, rocks: d.rocks, creeks: d.creeks}));
 assert.equal(back.holes.length, 9); assert.equal(back.water.length, 1);
 assert.deepEqual(back.rocks, [[5, 5, 2, 1, .5]]);
 assert.deepEqual(back.treeKinds, ['chaparral'], 'the painted plant keeps its species');
});
