// A world from a hand-made built document (src/built-world.js): the field,
// the lie, the land and its patches, the holes, the trees. The frozen
// generated course is tests/freeze.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {worldFromDoc, builtSurface, builtFieldAt, builtGroundAt, landSampler, polygonDistance, speciesFor, drawnSpecies, CONIFERS, PALMS, BUILT_FIELD} from '../src/built-world.js';
import {GROUND_PLANTS, TREE_SIZE, tallHeight} from '../src/species.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {standIn} from '../src/builder/tree-shape.js';
import {biomeOf} from '../src/biomes.js';

// Desert Palms, which these tests were written on, left for Desert Resort on 7 November 2026.
// Its planting is kept here, on Desert Resort's record, so the species machinery is still
// tested on a palm desert with the numbers it was written for.
const desertPalms = {...biomeOf('dresort'),
 plants: [['fanpalm', .2], ['datepalm', .12], ['oleander', .12], ['bougainvillea', .06], ['creosote', .2], ['brittlebush', .08], ['desertwillow', .06], ['tamarisk', .06], ['smoketree', .05], ['aleppopine', .03], ['agave', .02]],
 stands: {...biomeOf('dresort').stands, plants: [['fanpalm', .4], ['datepalm', .3], ['tamarisk', .3]]}};
import {greenDistance, generateWorld, DEFAULT_COURSE} from '../src/course.js';
import {GROUND_CODE} from '../src/ground.js';
import {BUILT_GROUND_CODE} from '../src/built-world.js';
import {GROUND_KINDS} from '../src/grounds.js';

test('the field\'s ground codes are the ground shader\'s, and cover every ground type', () => {
 for (const [k, c] of Object.entries(GROUND_CODE)) assert.equal(BUILT_GROUND_CODE[k], c, k);
 for (const k of GROUND_KINDS) assert.ok(BUILT_GROUND_CODE[k], `${k} has a code`);
});

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
const disc = (cx, cz, r, n = 48) => [Array.from({length: n}, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cz + r * Math.sin(i / n * Math.PI * 2)])];
function doc(over = {}) {
 const nx = 241, nz = 241, heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = 300 + i * .05;
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -10 + i, z: -100, set: 'back'}, {x: -10 + i, z: -80, set: 'front'}], green: {x: 0, z: 90}, line: [[-10 + i, -100], [0, 0], [0, 90]]}));
 return {type: 'built', name: 'Hand', landscape: 'parkland', halfX: 120, halfZ: 120,
  land: {x0: -120, z0: -120, cell: 1, nx, nz, heights},
  patches: [{x0: -20, z0: 70, cell: .25, nx: 161, nz: 161, heights: new Float32Array(161 * 161).fill(310)}],
  surfaces: {green: [disc(0, 90, 12)], fairway: [box(-15, -60, 15, 70)], tee: [box(-14, -104, 3, -96)], sand: [disc(20, 80, 4)], semi: [box(-22, -66, 22, 76)],
   heather: [box(60, -100, 110, 100)], path: [box(-30, -60, -27, 60)], hardpan: [box(-110, -100, -60, 100)]},
  water: [{rings: disc(-50, 0, 8)[0] ? disc(-50, 0, 8) : [], level: 297, kind: 'pond'}],
  holes, trees: new Float32Array([40, 40, 18, 5, .5, 2, -1, 45, 45, 1.5, 1, 0, 3, -1]), treeKinds: [], ...over};
}
const world = worldFromDoc(doc());
const at = (x, z) => world.surface(x, z);

test('the lie follows the outlines, in the generator\'s order', () => {
 assert.equal(at(0, 90), 'green');
 assert.equal(at(0, 90 - 12 - 1), 'fringe');
 assert.equal(at(0, 0), 'fairway');
 assert.equal(at(18, 0), 'semi');
 assert.equal(at(20, 80), 'sand', 'a bunker inside the semi collar is sand');
 assert.equal(at(-5, -100), 'tee');
 assert.equal(at(-50, 0), 'water');
 assert.equal(at(80, 0), 'heather');
 assert.equal(at(-80, 0), 'hardpan');
 assert.equal(at(-28.5, 0), 'path');
 assert.equal(at(40, -100), 'rough');
});

test('a field edge is where the outline is, to a few centimetres', () => {
 for (const x of [-15.1, -14.9, 14.9, 15.1]) assert.equal(at(x, 0), Math.abs(x) < 15 ? 'fairway' : 'semi', `x ${x}`);
 const d = builtFieldAt(world.builtField, 0, 90, 1);
 assert.ok(d <= -BUILT_FIELD.range + .1, 'deep inside reads the full range');
});

test('a patch takes over from the land inside it and fades in at its edge', () => {
 const s = landSampler(doc());
 assert.ok(Math.abs(s(0, 95) - 310) < 1e-3, 'inside: the patch');
 assert.ok(Math.abs(s(0, 0) - (300 + 120 * .05)) < 1e-3, 'outside: the land');
 const edge = s(-19.6, 90);
 assert.ok(edge > 305.1 && edge < 309.9, `at the edge, between (${edge})`);
});

test('the holes take their tees, green, par and frame from the records', () => {
 const h = world.holes[0];
 assert.equal(h.par, 4); assert.equal(world.holes.length, 9);
 const back = h.toWorld(h.tees.blue), front = h.toWorld(h.tees.red);
 assert.ok(Math.abs(back.z + 100) < 1e-6 && Math.abs(front.z + 80) < 1e-6, 'back tee is the blue, front the red');
 assert.ok(h.tees.blue.yards > h.tees.red.yards);
 assert.ok(greenDistance(h, h.green.x, h.green.z) < -11, 'greenDistance answers from the outline');
 assert.ok(Math.abs(polygonDistance(disc(0, 90, 12), 0, 90) + 12) < .05);
 assert.ok(h.leftWidth(80) > 10 && h.rightWidth(80) > 10, 'widths measured off the fairway');
});

test('trees keep their sizes; the landscape picks what draws them', () => {
 assert.equal(world.trees.length, 2);
 const [t, s] = world.trees;
 assert.equal(t.h, 18); assert.equal(t.radius, .5); assert.ok(biomeOf('parkland').plants.some(([k]) => k === t.kind), t.kind);
 assert.equal(s.kind, 'shrub');
 assert.equal(['nwfir', 'nwcedar', 'nwhemlock'].includes(speciesFor(biomeOf('pacnw'), 'conifer', 20, 1, 2)), true);
 assert.ok(['flcoconut', 'flroyal', 'lowsabal'].includes(speciesFor(biomeOf('flpalms'), 'palm', 9, 3, 4)), 'Florida Palms (the Keys until 7 November 2026) draws a palm as one of its own');
 assert.ok(speciesFor(biomeOf('seaside'), 'tree', 12, 0, 0), 'a landscape with no trees still draws one');
});

test('any landscape: the same file in Desert keeps every lie', () => {
 const d = worldFromDoc({...doc(), landscape: 'dmountain'});
 for (const [x, z] of [[0, 90], [0, 0], [80, 0], [-80, 0], [-50, 0], [20, 80]]) assert.equal(d.surface(x, z), at(x, z));
 assert.equal(d.trees[0].h, 18); assert.equal(d.trees[0].radius, .5);
 assert.equal(d.bio.name, biomeOf('dmountain').name);
});

// THE BUILDER ON EVERY LANDSCAPE (the US landscapes goal, PLAN 2's "both
// modes"): the same file builds on each of the forty, keeps every lie, and
// draws each stored tree from that landscape's own planting -- a tree the
// landscape has none of in that role falls back to one it plants.
test('every landscape builds the same file, every lie kept, its trees its own', async () => {
 const {BIOME_KEYS} = await import('../src/settings-schema.js');
 for (const key of BIOME_KEYS) {
  const d = worldFromDoc({...doc(), landscape: key}), planted = new Set(biomeOf(key).plants.map(p => p[0]));
  for (const [x, z] of [[0, 90], [0, 0], [80, 0], [-50, 0]]) assert.equal(d.surface(x, z), at(x, z), `${key}: the lie at ${x}, ${z}`);
  assert.equal(d.bio.name, biomeOf(key).name);
  for (const t of d.trees) assert.ok(planted.has(t.kind) || t.kind === 'shrub' || t.kind === 'oak', `${key}: a stored tree draws ${t.kind}, which it does not plant`);
 }
});

test('stored houses stand where the file puts them, the same street every time, and none in an old file', () => {
 assert.deepEqual(world.homes, [], 'a file without houses has none');
 const homes = [{x: 60, z: 20, rotation: 1.2, width: 20, depth: 14}, {x: -60, z: -20, rotation: -.4, width: 18, depth: 16}];
 const a = worldFromDoc(doc({homes})), b = worldFromDoc(doc({homes}));
 assert.equal(a.homes.length, 2);
 assert.deepEqual(a.homes, b.homes, 'built the same each time');
 const h = a.homes[0];
 assert.equal(h.x, 60); assert.equal(h.rotation, 1.2); assert.equal(h.width, 20);
 assert.ok(Number.isFinite(h.y) && h.footing >= .45 && ['gable', 'hip', 'saltbox', 'lshape'].includes(h.form) && h.height >= 7 && h.height <= 11);
});

test('where two ground types meet, a point is the one with the most weight round it', () => {
 // Four texels, a field 4 m square: heather (8) on three, hardpan (4) on one.
 const b = new Uint8Array(16); b[2] = 8; b[6] = 8; b[10] = 8; b[14] = 4;
 const f = {Sx: 2, Sz: 2, ex: 2, ez: 2, b};
 assert.equal(builtGroundAt(f, 0, 0), 'heather', 'the middle is the heather\'s');
 assert.equal(builtGroundAt(f, .9, .9), 'hardpan', 'near the hardpan\'s own texel, the hardpan\'s');
 assert.equal(builtGroundAt(f, .2, .2), 'heather', 'inside the hardpan\'s texel but nearer the heather: the edge no longer steps at the texel');
 assert.equal(builtGroundAt({...f, b: new Uint8Array(16)}, 0, 0), null, 'no type round it: none');
});

// The owner, 5 November 2026, of TPC Summerlin on Desert Palms: "There isn't a
// single palm tree in here." A survey's roles are only conifer and broadleaf.
test('a surveyed tree can draw as a palm, in the landscape\'s shares', () => {
 const bio = desertPalms, count = {}, n = 20000;
 for (let i = 0; i < n; i++) { const k = speciesFor(bio, 'broadleaf', 7, i * .5 - 2000, i * .25 + 300); count[k] = (count[k] ?? 0) + 1; }
 assert.ok(Object.keys(count).every(k => !GROUND_PLANTS.has(k)), 'a tree is never a shrub');
 const palms = (count.fanpalm ?? 0) + (count.datepalm ?? 0);
 assert.ok(Math.abs(palms / n - .32 / .52) < .05, `palms are their share of the trees, ${palms} of ${n}`);
 assert.ok(count.tamarisk > 0 && count.desertwillow > 0 && count.smoketree > 0, 'the rest of the landscape still shows');
 let firs = 0; for (let i = 0; i < 2000; i++) firs += CONIFERS.has(speciesFor(biomeOf('pacnw'), 'broadleaf', 20, i * .5, i * .75));
 assert.ok(firs > 800, 'a wide reading is no broadleaf: a survey of a fir forest reads mostly wide');
 let narrow = 0; for (let i = 0; i < 2000; i++) narrow += PALMS.has(speciesFor(bio, 'conifer', 12, i * .5, -i * .25));
 assert.ok(narrow > 1500, 'a narrow surveyed tree in the palm desert is mostly a palm');
 for (let i = 0; i < 500; i++) assert.ok(PALMS.has(speciesFor(bio, 'palm', 9, i, i * 2)), 'palm asks for a palm');
});

// The owner, 5 November 2026: "does height make more sense". A survey measures
// height and nothing else about the species.
test('a surveyed tree draws as a species of its height', () => {
 const bio = desertPalms, seen = h => { const set = new Set(); for (let i = 0; i < 4000; i++) set.add(speciesFor(bio, 'broadleaf', h, i * .5 - 900, i * .75 + 40)); return set; };
 const giant = seen(20);
 assert.ok(!giant.has('smoketree') && !giant.has('tamarisk') && !giant.has('desertwillow'), 'no bush the size of a house');
 assert.ok(giant.has('fanpalm') && giant.has('datepalm'), 'the tall trees are the tall species');
 assert.deepEqual([...seen(60)], ['fanpalm'], 'too tall for all of them: the tallest');
 const young = seen(1.5);
 assert.ok(young.size === 6, 'too short for all of them: any, not whichever has the lowest floor');
 assert.ok(seen(8).has('fanpalm'), 'a young palm is a palm');
 // (The Rockies' mix until 8 November 2026; the Mountain's one broadleaf is its aspen, so Northern
 // Woods', every one taller than 7 m, holds the test.)
 const short = new Map(); for (let i = 0; i < 2000; i++) { const s = speciesFor(biomeOf('northwoods'), 'broadleaf', 7, i * .5, i * .75); short.set(s, (short.get(s) ?? 0) + 1); }
 assert.ok(short.size >= 2 && Math.max(...short.values()) < 1600, `short trees keep the mix: no one species takes the wood (${JSON.stringify([...short])})`);
});

test('the height a surveyed tree is matched against is the one the generator plants', () => {
 for (const key of BIOME_KEYS) {
  const bio = biomeOf(key);
  for (const [k,, scale] of bio.plants.filter(p => !GROUND_PLANTS.has(p[0]))) {
   const low = tallHeight(bio, k, 0, scale ?? 1), top = tallHeight(bio, k, 1, scale ?? 1);
   assert.ok(low > 0 && top > low, `${key} ${k}: ${low}-${top} m`);
  }
  assert.ok(speciesFor(bio, 'tree', 12, 1, 2), key);
 }
 const {trees} = generateWorld({...DEFAULT_COURSE, biome: 'dresort', holes: 9, seed: 'SURVEY'});
 const bio = biomeOf('dresort'), grown = trees.filter(t => TREE_SIZE[t.kind]);
 assert.ok(grown.length > 50, `a generated course plants its trees, ${grown.length}`);
 // A stand grows its trees a fifth taller (course.js `stands.grow`), which the
 // quarter's give allows for; and the generator plants saplings, so no low end.
 for (const t of grown) assert.ok(t.h <= tallHeight(bio, t.kind, 1) * 1.25, `${t.kind} ${t.h}`);
});

test('a survey\'s narrow reading does not steer the species; a named tree\'s role does', () => {
 const bio = desertPalms;
 let palms = 0, oldReading = 0;
 for (let i = 0; i < 2000; i++) {
  palms += PALMS.has(drawnSpecies(bio, undefined, false, 'conifer', 7, i * .5, -i * .25));
  oldReading += PALMS.has(speciesFor(bio, 'conifer', 7, i * .5, -i * .25));
 }
 assert.ok(palms < 1500, `a narrow survey tree is any tree, ${palms}`);
 assert.ok(oldReading > 1500, `a real conifer's role still holds, ${oldReading}`);
 for (let i = 0; i < 300; i++) assert.ok(!['tamarisk', 'smoketree', 'desertwillow'].includes(drawnSpecies(bio, 'redwood', false, 'conifer', 12, i, i * 2)), 'a named conifer moved here stays a conifer or a palm');
});

test('the 3D editor draws the species the game draws', () => {
 const bio = desertPalms;
 assert.equal(standIn(bio, 'fanpalm'), 'palm');
 assert.equal(standIn(bio, 'aleppopine'), 'pine');
 assert.equal(standIn(bio, 'tamarisk'), 'cactus');
 assert.equal(standIn(biomeOf('pacnw'), 'alder'), 'oak');
 assert.equal(drawnSpecies(bio, 'tamarisk', false, 'broadleaf', 9, 1, 2), 'tamarisk', 'a tree picked by name stays');
 assert.notEqual(drawnSpecies(bio, 'redwood', false, 'conifer', 9, 1, 2), 'redwood', 'a species this landscape does not grow does not');
 assert.equal(drawnSpecies(bio, 'redwood', true, 'conifer', 9, 1, 2), 'redwood', 'the landscape it was grown in keeps it');
});
