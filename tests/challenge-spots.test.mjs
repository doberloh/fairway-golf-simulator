// Where a challenge's balls go and which hole it uses (challenge-spots.js), on
// the real Challenge Course -- the one every hole challenge is played on (the
// owner, 16 October 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {CHALLENGES, challenge, challengeCourseSettings} from '../src/challenges.js';
import {chooseHole, spotsFor, spotsAcross, holeAdapter, zoneFor, callsFor, onLine, seeded} from '../src/challenge-spots.js';
import {greenDistance} from '../src/course.js';

const YARD = .9144, FOOT = .3048;
const settings = challengeCourseSettings(), w = world(settings);
const holes = w.holes.map(h => ({par: h.par, length: h.routeLength}));
const course = CHALLENGES.filter(c => c.where === 'course');
const adapters = w.holes.map(h => holeAdapter(h));
// A challenge across holes has spots on several, each with its hole.
const pick = def => def.hole === 'course' ? (s => s && {hole: s[0].hole, spots: s})(spotsAcross(def, adapters, `${settings.seed}:${def.id}`, {driver: 250}))
 : chooseHole(def, holes, i => def.spot ? spotsFor(def, adapters[i], `${settings.seed}:${i}:${def.id}`) : []);

// THE COURSE HOSTS EVERY ONE. If a generator change breaks this, the seed
// moves on (CHALLENGE-2) and RESEARCH.md says so -- never loosen the test.
test('the Challenge Course has a hole for every challenge', () => {
 for (const def of course) assert.ok(pick(def), `${def.id} has no hole on ${settings.seed}`);
});

test('every spot is on ground its challenge allows, and the same every time', () => {
 for (const def of course.filter(c => c.spot)) {
  const p = pick(def), h = w.holes[p.hole], again = pick(def);
  assert.deepEqual(p, again, `${def.id}: the same spots every time`);
  for (const s of p.spots) {
   const hh = s.hole != null ? w.holes[s.hole] : h, surf = hh.surface(s.x, s.z), edge = greenDistance(hh, s.x, s.z);
   const k = def.spot.kind;
   // Every par 3 and Bingo Bango Bongo play from the tee, and so does Greens
   // in regulation on a par 3: those are the tee in play, exactly.
   const fromTee = k === 'par3s' || k === 'firstHoles' || (k === 'gir' && hh.par === 3);
   if (fromTee) { const t = holeAdapter(hh).tee; assert.deepEqual([s.x, s.z], [t.x, t.z], `${def.id}: hole ${s.hole + 1}'s tee`); continue; }
   assert.ok(!['water', 'tee'].includes(surf), `${def.id}: a spot on ${surf}`);
   if (k === 'gir') assert.ok(['fairway', 'semi'].includes(surf), `gir: hole ${s.hole + 1} from the ${surf}`);
   if (k === 'scrambler') { assert.ok(edge >= 3 * YARD - .01 && edge <= 18 * YARD + .01, `scrambler: ${(edge / YARD).toFixed(1)} yd off`); }
   if (k === 'putttour') { assert.equal(surf, 'green', 'putttour'); assert.ok(s.feet >= 6 && s.feet <= 40, `putttour: ${s.feet} ft`); }
   if (k === 'around') { assert.ok(edge >= def.spot.lo * YARD - .01 && edge <= def.spot.hi * YARD + .01, `${def.id}: ${(edge / YARD).toFixed(1)} yd off`); if (def.spot.grass) assert.notEqual(surf, 'sand', def.id); }
   if (k === 'bunker') assert.equal(surf, 'sand', def.id);
   if (k === 'shortSide') assert.ok(['fringe', 'semi', 'rough'].includes(surf), def.id);
   if (k === 'line' || k === 'water') assert.ok(['fairway', 'semi'].includes(surf), `${def.id}: from the ${surf}`);
   if (k === 'putt') { assert.equal(surf, 'green', def.id); assert.ok(edge <= -FOOT, `${def.id}: a foot inside the edge`); assert.ok(Math.abs(Math.hypot(s.x - h.pin.x, s.z - h.pin.z) / FOOT - s.feet) < 1e-6, def.id); }
  }
  if (def.spot.kind === 'line') p.spots.forEach((s, i) => assert.ok(Math.abs(Math.hypot(s.x - h.pin.x, s.z - h.pin.z) / YARD - def.spot.yards[i]) < 8, `${def.id}: ${def.spot.yards[i]} yd`));
  if (def.spot.kind === 'water') for (const s of p.spots) {
   let wet = false;
   for (let f = .05; f <= .95; f += .01) if (h.surface(s.x + (h.pin.x - s.x) * f, s.z + (h.pin.z - s.z) * f) === 'water') wet = true;
   assert.ok(wet, 'water between the ball and the pin');
  }
 }
 // The putting ladder's line has room for all ten; lag putting all five at full length.
 assert.equal(pick(challenge('puttladder')).spots.length, 10);
 assert.deepEqual(pick(challenge('lag')).spots.map(s => s.feet), [30, 40, 50, 60, 70]);
 assert.deepEqual(pick(challenge('world')).spots.map(s => s.feet), Array(8).fill(8));
});

test('each challenge plays the hole its rule asks for', () => {
 const par = id => holes[pick(challenge(id)).hole].par;
 assert.equal(par('closest'), 3);
 assert.equal(par('ace'), 3);
 const threes = holes.filter(h => h.par === 3).map(h => h.length);
 assert.equal(holes[pick(challenge('ace')).hole].length, Math.min(...threes), 'the shortest par 3');
 assert.equal(par('long'), 5);
 assert.equal(par('fairway'), 4);
 // On a made-up course: a missing par 3 is no hole; spots that never fit are no hole.
 assert.equal(chooseHole(challenge('closest'), [{par: 4}, {par: 5}], () => []), null);
 assert.equal(chooseHole(challenge('sand'), [{par: 4}, {par: 5}], () => null), null);
 assert.deepEqual(chooseHole(challenge('long'), [{par: 4, length: 380}, {par: 4, length: 440}], () => []), {hole: 1, spots: []}, 'no par 5: the longest par 4');
});

test('the zone is on the fairway where the driver reaches, and shorter for a shorter hitter', () => {
 const h = w.holes[pick(challenge('zone')).hole], a = holeAdapter(h);
 const far = zoneFor(a, 270), near = zoneFor(a, 190);
 assert.ok(far && near);
 assert.equal(h.surface(far.x, far.z), 'fairway');
 assert.ok(near.z < far.z);
 assert.ok(onLine(a, 150), 'a fairway point 150 yd out');
});

test('calls alternate, and called carries stay in the golfer\'s reach', () => {
 const shape = callsFor(challenge('shape'), 'x');
 assert.equal(shape.length, 6);
 for (let i = 1; i < 6; i++) assert.notEqual(shape[i], shape[i - 1]);
 assert.deepEqual(callsFor(challenge('highlow'), 'x').filter(c => c === 'high').length, 3);
 const carries = callsFor(challenge('number'), 'x', {driver: 200});
 assert.equal(carries.length, 6);
 for (const c of carries) assert.ok(c >= 60 && c <= 160 && c % 5 === 0, `${c}`);
 for (let i = 1; i < 6; i++) assert.notEqual(carries[i], carries[i - 1]);
 assert.deepEqual(callsFor(challenge('number'), 'x'), callsFor(challenge('number'), 'x'), 'seeded');
 assert.deepEqual(callsFor(challenge('closest'), 'x'), []);
 assert.notEqual(seeded('a')(), seeded('b')());
});

// ACROSS HOLES: the holes they ask for, in course order.
test('challenges across holes use the holes they say', () => {
 const across = id => pick(challenge(id)).spots.map(s => s.hole);
 assert.deepEqual(across('par3s'), holes.map((h, i) => h.par === 3 ? i : -1).filter(i => i >= 0), 'every par 3');
 for (const id of ['gir', 'scrambler', 'putttour']) assert.deepEqual(across(id), [0, 1, 2, 3, 4, 5, 6, 7, 8], `${id}: the first nine`);
 assert.deepEqual(across('bbb'), [0, 1, 2]);
 assert.equal(spotsAcross(challenge('gir'), adapters.slice(0, 5), 'x'), null, 'a course without nine holes cannot host it');
});
