import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {LIFE_SET} from '../src/life.js';
import {BIOME_KEYS} from '../src/settings-schema.js';

// PHASE 6, SECOND HALF: LIFE AND HISTORY (architect-courses; life.js, the
// age dial in architect.js). Animals and distant people out of play, every
// landscape its own; grassed-over bunkers on old and municipal courses;
// stumps where a Restored course felled its avenue. Classic has none of it.

const PLAYED = ['fairway', 'semi', 'green', 'fringe', 'tee', 'sand', 'water'];
const arch = (biome, extra = {}) => world({seed: 'LIFE-1', holes: 9, biome, designer: 'architect', ...extra});

test('Classic has no life; every Architect landscape has its own', () => {
 assert.equal(world({seed: 'LIFE-1', holes: 9, biome: 'links'}).life.length, 0);
 for (const biome of BIOME_KEYS) {
  const w = arch(biome), kinds = new Set(w.life.map(l => l.kind)), set = LIFE_SET[biome] || {};
  if (set.grazers) assert.ok(kinds.has(set.grazers[0]), `${biome}: no ${set.grazers[0]}`);
  if (set.fliers) assert.ok(kinds.has(set.fliers[0]), `${biome}: no ${set.fliers[0]}`);
  assert.ok(kinds.has('walker'), `${biome}: nobody walking the path`);
 }
});

test('the animals and the mower stay out of play and out of the trees', () => {
 for (const biome of ['links', 'midwest', 'redwood', 'pnw']) {
  const w = arch(biome);
  for (const l of w.life) {
   if (l.r !== undefined) { assert.ok(l.up >= 25, 'a bird low over play'); continue; }
   const pts = l.line ? l.line.map(p => [p.x, p.z]) : l.ax !== undefined ? [[l.ax, l.az], [l.bx, l.bz], [(l.ax + l.bx) / 2, (l.az + l.bz) / 2]] : [[l.x, l.z]];
   for (const [x, z] of pts) {
    if (l.kind === 'walker') { assert.equal(w.surface(x, z), 'path', 'a walker off the path'); continue; }
    assert.ok(!PLAYED.includes(w.surface(x, z)), `${biome}: a ${l.kind} on ${w.surface(x, z)}`);
    if (l.kind !== 'goose' && l.kind !== 'heron') assert.ok(w.nearest(x, z).d > 20, `${biome}: a ${l.kind} ${w.nearest(x, z).d.toFixed(0)} m from play`);
    for (const t of w.trees) if (!t.under) assert.ok(Math.hypot(t.x - x, t.z - z) > .6, `${biome}: a ${l.kind} inside a ${t.kind}`);
   }
  }
 }
});

test('the age dial: grassed-over bunkers on a municipal course, a felled avenue\'s stumps on a restored one', () => {
 const muni = arch('midwest', {archClub: 'municipal', archAge: 'old'}), hollows = muni.mounds.filter(m => m.why === 'hollow');
 assert.ok(hollows.length >= 1, 'no grassed-over bunker');
 for (const m of hollows) {
  assert.ok(m.h < 0, 'a hollow, not a mound');
  assert.ok(!PLAYED.includes(muni.surface(m.x, m.z)), `a hollow on ${muni.surface(m.x, m.z)}`);
 }
 const restored = arch('autumn', {archStyle: 'parkland', archAge: 'restored'}), old = arch('autumn', {archStyle: 'parkland', archAge: 'old'});
 assert.ok(restored.storyProps.filter(p => p.kind === 'stump').length > 10, 'no stumps');
 assert.equal(old.storyProps.filter(p => p.kind === 'stump').length, 0, 'stumps on a course that kept its avenue');
 assert.equal(arch('autumn', {archStyle: 'parkland', archAge: 'new'}).mounds.filter(m => m.why === 'hollow').length, 0, 'hollows on a new members\' course');
});

// THE OWNER'S REVIEW: a felled avenue's stumps stood in a row down the
// fairway; they are scattered now -- their distances off the fairway's line
// spread over tens of metres. And trees grow with the course: a New course's
// stand well short of an Old one's.
test('stumps stand scattered, and trees grow with the course', () => {
 const w = arch('autumn', {archStyle: 'parkland', archAge: 'restored'}), offs = [];
 for (const p of w.storyProps.filter(p => p.kind === 'stump')) { const n = w.nearest(p.x, p.z); offs.push(Math.abs(n.p.x - n.h.center(Math.max(0, Math.min(n.h.length, n.p.z))))); }
 const mean = offs.reduce((a, b) => a + b, 0) / offs.length, sd = Math.sqrt(offs.reduce((a, b) => a + (b - mean) ** 2, 0) / offs.length);
 assert.ok(offs.length >= 8 && sd > 6, `${offs.length} stumps, their offsets spread ${sd.toFixed(1)} m`);
 const tall = w => { const t = w.trees.filter(t => !t.under && t.h > 4); return t.reduce((a, b) => a + b.h, 0) / t.length; };
 const young = tall(arch('midwest', {archAge: 'new'})), old = tall(arch('midwest', {archAge: 'old'}));
 assert.ok(young < old * .8, `trees ${young.toFixed(1)} m on a new course, ${old.toFixed(1)} m on an old one`);
});

// THE MOWER ON MOWN ROUGH (the owner's review, iteration 10): its whole run
// on rough -- it waded through Midwest's prairie and Links' marram -- and no
// mower where all the rough grows tall.
test('the mower runs on mown rough, and a links has none', () => {
 const mid = world({seed: 'M-1', holes: 9, biome: 'midwest', designer: 'architect'}), m = mid.life.find(l => l.kind === 'mower');
 assert.ok(m, 'no mower on Midwest');
 for (let u = 0; u <= 1.0001; u += .05) assert.equal(mid.surface(m.ax + (m.bx - m.ax) * u, m.az + (m.bz - m.az) * u), 'rough', 'the mower off the rough');
 assert.ok(!world({seed: 'M-1', holes: 9, biome: 'links', designer: 'architect'}).life.some(l => l.kind === 'mower'), 'a mower in the marram');
});
