import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {cleanHand, cleanFeature, designerHand, MAX_HAND, SIGNATURES} from '../src/hand-tools.js';
import {migrateSettings, validateSettings, SETTINGS, DEFAULT_COURSE} from '../src/settings-schema.js';
import {exportCourse, importCourse} from '../src/course-library.js';
import {random} from '../src/course.js';

// THE ARCHITECT'S HAND (hand-tools.js): hand-made bunkers, greens, slopes and
// fairways, laid by the generator on some holes. The studio's own Hand tools
// were withdrawn on 31 October 2026 (the owner: "leave those tools for the
// architect to use"), and with them the `archHand` setting (SCHEMA_VERSION 14).

const base = {seed: 'HAND-1', holes: 9, biome: 'midwest', designer: 'architect', archStyle: 'parkland'};
// Courses whose architect overfills a hole's twelve slots by itself (found
// by scanning, 31 October 2026: Sandhills HZ-2 holes 3 and 8).
const overflowing = {seed: 'HZ-2', holes: 18, biome: 'midwest', designer: 'architect', archStyle: 'sandhills'};

test('records are cleaned: clamped, unknown fields and kinds dropped, at most MAX_HAND', () => {
 assert.deepEqual(cleanFeature({kind: 'bunker', hole: 2, at: 9999, off: -500, size: 1, shape: 3, lobes: 7.6, junk: 1}),
  {kind: 'bunker', hole: 2, at: 600, off: -60, size: 2.5, shape: 1, lobes: 3});
 assert.equal(cleanFeature({kind: 'volcano'}), null);
 assert.equal(cleanFeature({kind: 'green', contour: 'spiral'}).contour, 'designed');
 assert.equal(cleanHand(Array.from({length: 200}, () => ({kind: 'slope'}))).length, MAX_HAND);
});

test('the player has no hand tools: no setting carries them', () => {
 assert.ok(!SETTINGS.some(f => f.key === 'archHand' || f.kind === 'hand'));
 assert.ok(!('archHand' in DEFAULT_COURSE));
});

test('a save that carried hand features loads without them', () => {
 const old = {seed: 'OLD', holes: 9, biome: 'pnw', designer: 'architect', archStyle: 'links', archClub: 'members', archAge: 'old', archStory: 'some', archHand: [{kind: 'bunker', hole: 0, at: 200, off: 0, size: 12}]};
 const s = validateSettings(migrateSettings(old, 13));
 assert.ok(!('archHand' in s));
 assert.equal(s.archStyle, 'links');
 // And one from before the hand tools existed.
 assert.equal(validateSettings(migrateSettings({...old, archHand: undefined}, 12)).archStyle, 'links');
});

test('hand features smuggled into the settings change nothing, and no code carries them', () => {
 const hand = [{kind: 'bunker', hole: 1, at: 200, off: 0, size: 12, lobes: 3}, {kind: 'slope', hole: 2, at: 150, off: 40, size: 16, rise: 3}];
 const plain = world(base), smuggled = world({...base, archHand: hand});
 assert.deepEqual(smuggled.holes.map(h => h.bunkers.length), plain.holes.map(h => h.bunkers.length));
 const h = plain.holes[2], q = h.toWorld({x: h.center(150) + 40, z: 150});
 assert.equal(smuggled.height(q.x, q.z), plain.height(q.x, q.z));
 const code = exportCourse({name: 'Hand', settings: {...DEFAULT_COURSE, ...base, archHand: hand}});
 assert.ok(!JSON.stringify(code).includes('archHand'));
 assert.ok(!('archHand' in importCourse(code).settings));
});

test('the generator lays signatures by style, the same for a seed', () => {
 const rnd = () => random('sig');
 assert.deepEqual(designerHand(rnd(), 'golden', 3, {par: 4, length: 380}), designerHand(rnd(), 'golden', 3, {par: 4, length: 380}));
 for (const style of new Set(Object.values(SIGNATURES).flat())) {
  let n = 0;
  for (let k = 0; k < 40; k++) n += designerHand(random(`sig:${style}:${k}`), style, 0, {par: 4, length: 400}).length ? 1 : 0;
  assert.ok(n >= 6 && n <= 24, `${style}: ${n} of 40 holes with a signature`);
 }
 // On a built course, some holes carry the architect's own hand.
 const w = world({...base, holes: 18, seed: 'HAND-2', archStyle: 'golden'});
 assert.ok(w.holes.some(h => h.design.reasons.some(r => /architect's own shape/.test(r.why)) || h.handMounds?.length || h.design.hand), 'no hand-made signature on eighteen holes');
});

// Every hazard has its reason (the bench's invariant `hazardWithoutReason`):
// the hand's lobes had none once.
test('every bunker, lobes included, has its reason', () => {
 const w = world(overflowing);
 for (const h of w.holes) h.bunkers.forEach((b, i) => assert.ok(h.design.reasons.some(r => r.kind === 'bunker' && r.i === i), `hole ${h.hole + 1}: bunker ${i} without a reason`));
});

// THE CAP AND THE FIELD (hand-tools.js HAZARD_CAP, surface-field.js): a hole
// holds at most HAZARD_CAP hazards; the shader's twelve slots take the
// collection areas, the ponds and the first bunkers, and every bunker past
// them is marked for the surface field -- so nothing plays as sand without
// being drawn (9 holes in 432 did, 30 October 2026, before the field).
test('no hole holds more than the cap, and no slot is over-filled', async () => {
 const {HAZARD_CAP} = await import('../src/hand-tools.js');
 const {MAX_HAZARDS} = await import('../src/architect.js');
 const {HAZARD_SLOTS} = await import('../src/surface-field.js');
 assert.equal(MAX_HAZARDS, HAZARD_SLOTS);
 assert.ok(HAZARD_CAP > HAZARD_SLOTS);
 let fielded = 0;
 for (const [style, seed] of [['golden', 'HZ-2'], ['sandhills', 'HZ-2'], ['heathland', 'HZ-1'], ['parkland', 'HAND-1']]) {
  const w = world({seed, holes: 18, biome: 'midwest', designer: 'architect', archStyle: style});
  for (const h of w.holes) {
   assert.ok((h.collections || []).length + h.bunkers.length + h.ponds.length <= HAZARD_CAP, `${style} ${seed} hole ${h.hole + 1}: ${(h.collections || []).length + h.bunkers.length + h.ponds.length} hazards`);
   const slotted = (h.collections || []).length + h.bunkers.filter(b => !b.field).length + h.ponds.length;
   assert.ok(slotted <= HAZARD_SLOTS, `${style} ${seed} hole ${h.hole + 1}: ${slotted} in the slots`);
   fielded += h.bunkers.filter(b => b.field).length;
  }
  if (h0(w)) assert.ok(w.surfaceField, `${style} ${seed}: bunkers marked for the field, and no field baked`);
 }
 assert.ok(fielded > 0, 'Sandhills HZ-2 and Heathland HZ-1 overflow their slots on their own');
});
const h0 = w => w.holes.some(h => h.bunkers.some(b => b.field));
