// A generated course against its frozen copy (src/freeze.js, src/built-world.js;
// docs/COURSE_BUILDER.md, *The game: a world from a file*). The tolerances are
// set from tools/freeze-compare.mjs's measurements on 31 October 2026 (all ten
// landscapes: surfaces 97.1-99.7% the same at every 2 m, the ground within
// 0.4 cm at the 95th percentile, greens within 0.12 cm at the median), with
// room for a different seed. One course, with a creek and a lake, so the
// channels and the large water come through a file too.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, DEFAULT_COURSE} from '../src/course.js';
import {freezeWorld} from '../src/freeze.js';
import {worldFromDoc, builtSurface} from '../src/built-world.js';
import {writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {BUILT_VERSION} from '../src/settings-schema.js';

const w = generateWorld({...DEFAULT_COURSE, seed: 'FREEZE-TEST', biome: 'parkland', holes: 9, creeks: 1, lakes: 1});
const doc = freezeWorld(w, {name: 'Freeze test'});
const bytes = await writeBuiltFile(doc, BUILT_VERSION);
const back = await readBuiltFile(bytes);
const b = worldFromDoc(back, {});
const pct = (a, q) => [...a].sort((x, y) => x - y)[Math.floor(q * (a.length - 1))];

test('the file holds the whole course and comes back', () => {
 assert.equal(back.holes.length, 9);
 assert.equal(back.trees.length, doc.trees.length);
 assert.ok(back.creeks.length >= 1, 'the creek travels');
 assert.ok(back.water.some(x => x.kind === 'lake'), 'the lake travels');
 assert.ok(bytes.length < 4e6, `a nine is a few MB (${(bytes.length / 1e6).toFixed(2)})`);
});

test('the surfaces a ball meets are the same almost everywhere', () => {
 let n = 0, same = 0;
 const kinds = new Set();
 for (let z = -w.halfZ; z < w.halfZ; z += 3) for (let x = -w.halfX; x < w.halfX; x += 3) {
  const a = w.surface(x, z); n++; kinds.add(a);
  if (a === b.surface(x, z)) same++;
 }
 assert.ok(same / n > .99, `${(100 * same / n).toFixed(2)}% the same`);
 for (const k of ['green', 'fringe', 'fairway', 'semi', 'tee', 'sand', 'water', 'rough']) assert.ok(kinds.has(k), `the sample meets ${k}`);
});

test('the ground is the same to the centimetre, and on greens to the millimetre', () => {
 const e = [];
 for (let z = -w.halfZ; z < w.halfZ; z += 6) for (let x = -w.halfX; x < w.halfX; x += 6) e.push(Math.abs(w.height(x, z) - b.height(x, z)));
 assert.ok(pct(e, .95) < .01, `95th percentile ${(pct(e, .95) * 100).toFixed(2)} cm`);
 assert.ok(pct(e, .99) < .05, `99th percentile ${(pct(e, .99) * 100).toFixed(2)} cm`);
 const g = [];
 for (const h of w.holes) {
  const c = h.worldGreen;
  for (let z = c.z - 15; z < c.z + 15; z += .7) for (let x = c.x - 15; x < c.x + 15; x += .7) if (w.surface(x, z) === 'green') g.push(Math.abs(w.height(x, z) - b.height(x, z)));
 }
 assert.ok(g.length > 500 && pct(g, .5) < .005 && pct(g, .99) < .02, `greens: median ${(pct(g, .5) * 100).toFixed(2)} cm, 99th ${(pct(g, .99) * 100).toFixed(2)} cm`);
});

test('every hole keeps its par, its tees and its length', () => {
 w.holes.forEach((h, i) => {
  const bh = b.holes[i];
  assert.equal(bh.par, h.par, `hole ${i + 1} par`);
  const gt = h.toWorld(h.tees.blue), bt = bh.toWorld(bh.tees.blue);
  assert.ok(Math.hypot(gt.x - bt.x, gt.z - bt.z) < .05, `hole ${i + 1} back tee`);
  assert.ok(Math.abs(bh.tees.white.yards - h.tees.white.yards) < 20, `hole ${i + 1}: ${h.tees.white.yards.toFixed(0)} vs ${bh.tees.white.yards.toFixed(0)} yd`);
  const gg = h.worldGreen, bg = bh.worldGreen;
  assert.ok(Math.hypot(gg.x - bg.x, gg.z - bg.z) < .05, `hole ${i + 1} green`);
 });
});

test('the trees stand where they stood, as tall, with the same trunks', () => {
 assert.equal(b.trees.length, w.trees.length);
 for (let i = 0; i < w.trees.length; i += 97) {
  const t = w.trees[i], u = b.trees[i];
  assert.ok(Math.abs(t.x - u.x) < .01 && Math.abs(t.z - u.z) < .01 && Math.abs(t.h - u.h) < .01, `tree ${i}`);
  assert.equal(u.kind, t.kind, `tree ${i} drawn as the same species`);
 }
});

test('the built world answers the generator\'s contract', () => {
 for (const k of ['holes', 'trees', 'groundGrid', 'height', 'surface', 'nearest', 'streams', 'bio', 'settings', 'halfX', 'halfZ', 'land', 'groundCover', 'lakeOwner']) assert.ok(b[k] != null, k);
 assert.equal(typeof b.streams.at, 'function');
 const h = b.holes[0];
 for (const k of ['toWorld', 'toLocal', 'center', 'leftWidth', 'rightWidth', 'surface', 'height', 'greenDist']) assert.equal(typeof h[k], 'function', k);
 assert.ok(h.greenDist(h.green.x, h.green.z) < 0, 'the green centre is on the green');
 assert.equal(builtSurface(b.builtField, b.halfX + 1e5, 0), 'rough', 'past the field is rough');
});
