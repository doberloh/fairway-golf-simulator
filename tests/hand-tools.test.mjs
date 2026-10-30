import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {cleanHand, cleanFeature, designerHand, MAX_HAND, SIGNATURES} from '../src/hand-tools.js';
import {migrateSettings, validateSettings, DEFAULT_COURSE} from '../src/settings-schema.js';
import {exportCourse, importCourse} from '../src/course-library.js';
import {random} from '../src/course.js';

// THE ARCHITECT'S HAND TOOLS (hand-tools.js; the owner's review: hand-made
// bunkers, greens, slopes and fairways, used by the generator too, and
// Classic never touched).

const base = {seed: 'HAND-1', holes: 9, biome: 'midwest', designer: 'architect', archStyle: 'parkland'};

test('records are cleaned: clamped, unknown fields and kinds dropped, at most MAX_HAND', () => {
 assert.deepEqual(cleanFeature({kind: 'bunker', hole: 2, at: 9999, off: -500, size: 1, shape: 3, lobes: 7.6, junk: 1}),
  {kind: 'bunker', hole: 2, at: 600, off: -60, size: 2.5, shape: 1, lobes: 3});
 assert.equal(cleanFeature({kind: 'volcano'}), null);
 assert.equal(cleanFeature({kind: 'green', contour: 'spiral'}).contour, 'designed');
 assert.equal(cleanHand(Array.from({length: 200}, () => ({kind: 'slope'}))).length, MAX_HAND);
 assert.throws(() => validateSettings({...DEFAULT_COURSE, archHand: [{kind: 'volcano'}]}));
});

test('a save from before the hand tools loads, with none', () => {
 const old = {seed: 'OLD', holes: 9, biome: 'pnw', designer: 'architect', archStyle: 'links', archClub: 'members', archAge: 'old', archStory: 'some'};
 const s = validateSettings(migrateSettings(old, 12));
 assert.deepEqual(s.archHand, []);
 assert.equal(s.archStyle, 'links');
});

test('Classic ignores hand features entirely', () => {
 const c = world({seed: 'HAND-1', holes: 9, biome: 'midwest'});
 const withHand = world({seed: 'HAND-1', holes: 9, biome: 'midwest', archHand: [{kind: 'bunker', hole: 0, at: 200, off: 0, size: 12}]});
 assert.deepEqual(withHand.holes.map(h => h.bunkers.length), c.holes.map(h => h.bunkers.length));
 for (const [x, z] of [[0, 0], [40, -60], [-120, 90]]) assert.equal(withHand.height(x, z), c.height(x, z));
});

test('each tool lands where it was put on an Architect hole', () => {
 const plain = world(base);
 const h0 = plain.holes[1], at = Math.round(h0.length * .55);
 // The fairway tool on a long hole (hole 4 of this course is a par three).
 const long = plain.holes.findIndex((h, i) => i > 2 && i !== 4 && h.length > 300), mid = Math.round(plain.holes[long].length * .5);
 const hand = [
  {kind: 'bunker', hole: 1, at, off: 0, size: 9, shape: .8, lobes: 1},
  {kind: 'slope', hole: 2, at: 150, off: 40, size: 16, rise: 3},
  {kind: 'fairway', hole: long, at: mid, width: 24, length: 80},
  {kind: 'green', hole: 4, size: 1.3, shape: 1.3, contour: 'punchbowl'},
 ];
 const w = world({...base, archHand: hand});
 // The bunker: sand in the middle of the fairway where there was none.
 const h1 = w.holes[1], p = h1.toWorld({x: h1.center(at), z: at});
 assert.equal(w.surface(p.x, p.z), 'sand', 'no sand where the bunker was put');
 assert.ok(h1.bunkers.filter(b => b.hand).length >= 2, 'the bunker and its lobe');
 assert.ok(h1.design.reasons.some(r => /by hand/.test(r.why)), 'the yardage book does not say it was made by hand');
 // The slope: the ground 3 m up at its centre, against the plain course.
 const h2 = w.holes[2], q = h2.toWorld({x: h2.center(150) + 40, z: 150});
 assert.ok(w.height(q.x, q.z) - plain.height(q.x, q.z) > 2, `the mound rose ${(w.height(q.x, q.z) - plain.height(q.x, q.z)).toFixed(2)} m`);
 // The fairway: 12 m wider each side at its middle.
 assert.ok(w.holes[long].leftWidth(mid) - plain.holes[long].leftWidth(mid) > 11, `the fairway widened ${(w.holes[long].leftWidth(mid) - plain.holes[long].leftWidth(mid)).toFixed(1)} m`);
 // The green: bigger, sunk in a punchbowl.
 assert.ok(w.holes[4].greenSize > plain.holes[4].greenSize * 1.2);
 assert.equal(w.holes[4].design.green.pedestal, 'sunken');
});

test('a course code carries the hand features, and an empty list adds nothing', () => {
 const hand = [{kind: 'slope', hole: 0, at: 120, off: -20, size: 10, rise: -2}];
 const code = exportCourse({name: 'Hand', settings: {...DEFAULT_COURSE, ...base, archHand: hand}});
 assert.deepEqual(importCourse(code).settings.archHand, cleanHand(hand));
 const plainCode = exportCourse({name: 'Plain', settings: {...DEFAULT_COURSE, ...base}});
 assert.ok(!JSON.stringify(plainCode).includes('archHand'));
});

test('the generator uses the same tools: signatures by style, the same for a seed', () => {
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
