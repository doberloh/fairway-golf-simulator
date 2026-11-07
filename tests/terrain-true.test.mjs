// TERRAIN TRUE TO PLACE (the owner, 3 November 2026: "make sure that the
// terrain is also lifelike to the regions where the courses are built").
// Each landscape biomes.js TERRAIN names gets its own recipe (landforms.js),
// and each recipe has to do the thing its research says: the Bluegrass is
// pocked with sinkholes, the Bayou is dead flat, the Hill Country steps, the
// Ozarks are cut by hollows, Ponderosa has cinder cones. Measured on the
// recipes themselves and on generated courses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {landformOf} from '../src/landforms.js';
import {BIOMES} from '../src/biomes.js';
import {ringRelief} from '../src/landscape-edge.js';
import {world} from './worlds.mjs';

const sample = (f, n = 120, span = 1400) => {
 const out = [];
 for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(f(-span / 2 + span * i / n, -span / 2 + span * j / n));
 return out;
};
const relief = ys => Math.max(...ys) - Math.min(...ys);

test('each landscape named for its own terrain gets the recipe its research says', () => {
 const want = {hillcountry: 'steps', monterey: 'steps', northwoods: 'glacial',
  mojave: 'knobs', palms: 'knobs', sierra: 'knobs', sagebrush: 'channels',
  socal: 'channels', blueridge: 'channels', ponderosa: 'volcanic', hawaii: 'volcanic', southpines: 'sandridges', bayou: 'lowland', lowcountry: 'lowland', highplains: 'playas', sandhills: 'dunes',
  flatwoods: 'lowland', gulfcoast: 'lowland', badlands: 'badlands'};
 for (const [k, type] of Object.entries(want)) assert.equal(BIOMES[k].landform.type, type, k);
});

test('no two landscapes have the same ground', () => {
 const land = b => JSON.stringify([{...b.landform, kinds: 0, gates: 0}, b.hills, b.baseRoll, b.baseHeight]);
 const seen = new Map();
 for (const [k, b] of Object.entries(BIOMES)) { assert.ok(!seen.has(land(b)), `${k} has ${seen.get(land(b))}'s ground`); seen.set(land(b), k); }
});

test('every recipe is finite, seeded and repeatable', () => {
 for (const k of ['hillcountry', 'blueridge', 'northwoods', 'mojave', 'sierra', 'ponderosa', 'hawaii', 'southpines', 'bayou', 'badlands']) {
  const a = landformOf(BIOMES[k], 'T1'), b = landformOf(BIOMES[k], 'T1');
  for (const [x, z] of [[0, 0], [123.4, -567.8], [-900, 300]]) {
   const y = a.lift(x, z);
   assert.ok(Number.isFinite(y), `${k} lift at ${x},${z}`);
   assert.equal(y, b.lift(x, z), `${k} repeats`);
   const [ra, rb] = a.raw(x, z, y, .5);
   assert.ok(ra >= 0 && ra <= 1 && rb >= 0 && rb <= 1, `${k} raw in 0..1`);
  }
 }
});

test('the recipes make their shapes: sinkholes, steps, cones, hollows, flats', () => {
 const lifts = k => sample(landformOf(BIOMES[k], 'SHAPE').lift);
 // Karst: shallow sinkholes -- some ground well below its roll, none deep. The Bluegrass, which
 // wore this recipe, left for Classic Parkland (6 November 2026), so the test holds it here.
 const karst = landformOf({landform: {type: 'karst', roll: 8, cell: 140, chance: .55, radius: [12, 30], size: [2, 6], reach: 60,
  kinds: {a: 'rock'}, gates: {a: {near: 12, ramp: 10}}}}, 'SHAPE');
 const ground = sample((x, z) => karst.lift(x, z));
 const sinks = ground.filter(y => y < -3).length;
 assert.ok(sinks > 50, `karst has sinkholes (${sinks} samples in one)`);
 assert.ok(Math.min(...ground) > -16, 'and none deeper than its roll and its deepest sink');
 // Stepped hills: the heights bunch at the treads.
 const steps = lifts('hillcountry'), H = BIOMES.hillcountry.landform.height, n = BIOMES.hillcountry.landform.steps;
 const onTread = steps.filter(y => { const f = (y / H) * n; return Math.abs(f - Math.round(f)) < .12; }).length / steps.length;
 assert.ok(onTread > .45, `the Hill Country stands on its treads (${(onTread * 100).toFixed(0)}%)`);
 // Volcanic: cones rise well above the flows.
 assert.ok(Math.max(...lifts('ponderosa')) > 20, 'Ponderosa has cinder cones');
 // Channels: hollows cut well below the table.
 assert.ok(Math.min(...lifts('blueridge')) < -15, 'the Blue Ridge is cut by hollows');
 // Lowland: the Bayou's recipe adds a few metres at most.
 assert.ok(relief(lifts('bayou')) < 6, `the Bayou's recipe stays within a few metres (${relief(lifts('bayou')).toFixed(1)})`);
});

test('a lowland course is flat where a parkland one rolls', () => {
 // USDA MLRA 131A: the Mississippi's alluvial plain has about 5 m of local
 // relief at the most. Ponds, bunkers and greens' own shaping add a little.
 const spread = biome => {
  const w = world({holes: 9, biome, seed: 'FLAT-' + biome}), ys = [];
  for (let x = -w.halfX; x < w.halfX; x += 12) for (let z = -w.halfZ; z < w.halfZ; z += 12) ys.push(w.height(x, z));
  ys.sort((a, b) => a - b);
  return ys[Math.floor(ys.length * .95)] - ys[Math.floor(ys.length * .05)];
 };
 const bayou = spread('bayou'), parkland = spread('parkland');
 assert.ok(bayou < 6, `the Bayou spreads ${bayou.toFixed(1)} m between its low and high ground`);
 assert.ok(bayou < parkland / 2, `the Bayou (${bayou.toFixed(1)} m) is far flatter than Classic Parkland (${parkland.toFixed(1)} m)`);
});

test('the Lowcountry\'s tidal creeks hold the sea in its marsh, and nothing in play is wet', () => {
 // Generator 80: the marsh laid at the tide line beyond play, creeks cut
 // through it below the sea (landforms.js `lowland` with `tide`).
 const w = world({holes: 9, biome: 'lowcountry', seed: 'LC-a'});
 let wet = 0, creek = 0, marsh = 0, cells = 0;
 for (let x = -w.halfX; x < w.halfX; x += 5) for (let z = -w.halfZ; z < w.halfZ; z += 5) {
  const s = w.surface(x, z), y = w.height(x, z);
  cells++;
  if (['fairway', 'green', 'tee', 'fringe', 'semi'].includes(s) && y < .3) wet++;
  if (s === 'water' && y < -.3 && !w.lakeOwner?.(x, z)) creek++;
  if (y > 1.5 && y < 2.3) marsh++;
 }
 assert.equal(wet, 0, 'tee, fairway, green or semi under the sea');
 assert.ok(creek / cells > .005, `the creeks hold water (${(creek / cells * 100).toFixed(1)}% of the ground)`);
 assert.ok(marsh / cells > .08, `a marsh lies at the tide line (${(marsh / cells * 100).toFixed(1)}%)`);
});

test('Monterey\'s holes play along the sea, and nothing in play is wet', () => {
 // The owner, 3 November 2026: "Make sure the holes can genuinely play along
 // the coast." course.js `coastAt` (generator 79): the shore follows the
 // eastern holes and never comes within 5 m of a corridor.
 const w = world({holes: 18, biome: 'monterey', seed: 'MT-b'}), wl = w.waterLevel ?? 0, along = new Set();
 let wet = 0;
 for (let x = -w.halfX; x < w.halfX; x += 5) for (let z = -w.halfZ; z < w.halfZ; z += 5) {
  const s = w.surface(x, z);
  if (['fairway', 'green', 'tee', 'fringe', 'semi'].includes(s) && w.height(x, z) < wl + .3) wet++;
  if (s !== 'fairway' && s !== 'green') continue;
  for (const [dx, dz] of [[50, 0], [35, 35], [35, -35], [0, 50], [0, -50], [25, 0]])
   if (w.height(x + dx, z + dz) < wl - .5 && w.surface(x + dx, z + dz) === 'water') { along.add(w.nearest(x, z).h.hole); break; }
 }
 assert.equal(wet, 0, 'tee, fairway, green or semi under the sea');
 assert.ok(along.size >= 3, `only ${along.size} holes of 18 have the sea within 50 m of their fairway or green`);
});

test('the High Plains are a flat table with dry playas; the Sand Hills stand taller than a links', () => {
 // Generator 81: landforms.js `playas` (the Llano Estacado's round pans,
 // bare clay floors) and the Sand Hills' dunes at about 13 m.
 const playas = landformOf(BIOMES.highplains, 'SHAPE');
 const lifts = sample(playas.lift), pans = sample((x, z) => playas.raw(x, z)[1]).filter(b => b > .5).length;
 assert.ok(relief(lifts) < 6, `the table and its pans stay within a few metres (${relief(lifts).toFixed(1)})`);
 assert.ok(pans > 100, `playas with bare floors (${pans} samples)`);
 const dunes = k => relief(sample(landformOf(BIOMES[k], 'SHAPE').lift));
 assert.ok(dunes('sandhills') > 2 * dunes('links'), `the Sand Hills (${dunes('sandhills').toFixed(1)} m) over the Links (${dunes('links').toFixed(1)} m)`);
});

test('the Badlands are carved: peaks off the prairie, sunk near a hole, the road on the floor', () => {
 // Generator 83: landforms.js `carve`, a drainage network baked once a seed.
 const o = BIOMES.badlands.landform, r = landformOf(BIOMES.badlands, 'SHAPE'), lifts = sample(r.lift);
 assert.ok(r.sinks, 'the recipe takes the fade itself');
 assert.ok(Math.max(...lifts) > 60, `formations stand tall (${Math.max(...lifts).toFixed(0)} m)`);
 const open = lifts.filter(y => y < o.swale).length / lifts.length;
 assert.ok(open > .2 && open < .75, `prairie between them (${(open * 100).toFixed(0)}%)`);
 // Separate summits, not one lump: local tops at least 25 m tall.
 const n = 120, tops = lifts.filter((y, i) => y > 25 && i > n && i < lifts.length - n && y >= lifts[i - 1] && y >= lifts[i + 1] && y >= lifts[i - n] && y >= lifts[i + n]).length;
 assert.ok(tops > 40, `many summits (${tops})`);
 // Sunk, not squashed: part way up the fade a tall point loses metres off
 // its top, more than its share, and at a corridor it is gone.
 let high = null, best = 0;
 for (let x = -700; x < 700; x += 11) for (let z = -700; z < 700; z += 11) { const y = r.lift(x, z); if (y > best) { best = y; high = [x, z]; } }
 const half = r.lift(...high, .5), none = r.lift(...high, 0);
 assert.ok(best - half > 25 && half < best / 2 + o.swale, `lowered (${best.toFixed(0)} m to ${half.toFixed(0)} m)`);
 assert.ok(Math.abs(none) < 1e-9, 'and gone at a corridor');
 // A course: the road stays on gentle ground, the far land stands up.
 const w = world({holes: 9, biome: 'badlands', seed: 'SAWTOOTH'}), road = w.roads.find(q => q.kind === 'boundary');
 assert.ok(road, 'the road is laid');
 for (let i = 1; i < road.points.length; i++) {
  const a = road.points[i - 1], b = road.points[i], s = Math.abs(w.height(a.x, a.z) - w.height(b.x, b.z)) / Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(s < .4, `the road climbs no formation (${s.toFixed(2)} at ${a.x.toFixed(0)},${a.z.toFixed(0)})`);
 }
 const ring = ringRelief(w), far = sample((x, z) => ring.at(x + 3000, z, 3000), 40, 3000);
 assert.ok(relief(far) > 60, `the far country stands up (${relief(far).toFixed(0)} m)`);
 // A built course's land is its own, so the ring has no carving to take off it.
 const built = ringRelief({built: true, settings: {biome: 'badlands', seed: 'B'}});
 assert.ok(Math.min(...sample((x, z) => built.at(x + 3000, z, 3000), 40, 3000)) >= 0, 'a built course\'s far land only rises');
});
