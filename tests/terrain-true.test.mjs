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
import {world} from './worlds.mjs';

const sample = (f, n = 120, span = 1400) => {
 const out = [];
 for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(f(-span / 2 + span * i / n, -span / 2 + span * j / n));
 return out;
};
const relief = ys => Math.max(...ys) - Math.min(...ys);

test('each landscape named for its own terrain gets the recipe its research says', () => {
 const want = {hillcountry: 'steps', monterey: 'steps', bluegrass: 'karst', ozarks: 'channels', northwoods: 'glacial',
  oldnortheast: 'glacial', mojave: 'knobs', palms: 'knobs', sierra: 'knobs', sagebrush: 'channels', piedmont: 'channels',
  socal: 'channels', blueridge: 'channels', ponderosa: 'volcanic', hawaii: 'volcanic', longleaf: 'sandridges', bayou: 'lowland',
  flatwoods: 'lowland', gulfcoast: 'lowland', badlands: 'badlands'};
 for (const [k, type] of Object.entries(want)) assert.equal(BIOMES[k].landform.type, type, k);
});

test('every recipe is finite, seeded and repeatable', () => {
 for (const k of ['hillcountry', 'bluegrass', 'ozarks', 'northwoods', 'mojave', 'sierra', 'ponderosa', 'hawaii', 'longleaf', 'bayou', 'badlands']) {
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
 // Karst: shallow sinkholes -- some ground well below its roll, none deep.
 const karst = landformOf(BIOMES.bluegrass, 'SHAPE');
 const sinks = sample((x, z) => karst.lift(x, z)).filter(y => y < -3).length;
 assert.ok(sinks > 50, `the Bluegrass has sinkholes (${sinks} samples in one)`);
 assert.ok(Math.min(...lifts('bluegrass')) > -16, 'and none deeper than its roll and its deepest sink');
 // Stepped hills: the heights bunch at the treads.
 const steps = lifts('hillcountry'), H = BIOMES.hillcountry.landform.height, n = BIOMES.hillcountry.landform.steps;
 const onTread = steps.filter(y => { const f = (y / H) * n; return Math.abs(f - Math.round(f)) < .12; }).length / steps.length;
 assert.ok(onTread > .45, `the Hill Country stands on its treads (${(onTread * 100).toFixed(0)}%)`);
 // Volcanic: cones rise well above the flows.
 assert.ok(Math.max(...lifts('ponderosa')) > 20, 'Ponderosa has cinder cones');
 // Channels: hollows cut well below the table.
 assert.ok(Math.min(...lifts('ozarks')) < -15, 'the Ozarks are cut by hollows');
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
 const bayou = spread('bayou'), heartland = spread('heartland');
 assert.ok(bayou < 6, `the Bayou spreads ${bayou.toFixed(1)} m between its low and high ground`);
 assert.ok(bayou < heartland / 2, `the Bayou (${bayou.toFixed(1)} m) is far flatter than the Heartland (${heartland.toFixed(1)} m)`);
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
