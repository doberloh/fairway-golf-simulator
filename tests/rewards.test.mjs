import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARDS, KINDS, WEARABLE, DEFAULT_WORN, unlocksAt, isUnlocked, wornItem, rewardsOf, TRACERS, tracerStyle, summaryStyle, stopColour, MAX_UNLOCK_LEVEL} from '../src/rewards.js';
import {FINISH_IDS, finishColour, finishTexels, ballPixels, finishAverage, finishSurface} from '../src/ball-finishes.js';

// THE TABLE IS THE SPEC'S (7.1): its counts, nothing past 50, a starting look
// for each kind at level 1, and no id twice within a kind.
test('the reward table holds the spec\'s counts, all by level 50', () => {
 const count = k => rewardsOf(k).length;
 assert.equal(count('badge'), 11);
 // Phase 5's fifteen and sixteen, plus eight plain colours each from the start
 // (15 October 2026); frames a list of their own: the eleven badges', nine
 // plain colours and thirteen animated.
 assert.equal(count('tracer'), 23);
 assert.equal(count('ball'), 24);
 assert.equal(count('frame'), 33);
 assert.equal(rewardsOf('frame').filter(r => r.level === 1).length, 10);
 assert.equal(count('flourish'), 7);
 assert.equal(count('title'), 10);
 assert.equal(count('skin'), 10);
 assert.equal(count('challenge') - 2, 4, 'four challenges besides the course of the week and achievements');
 for (const r of REWARDS) {
  assert.ok(KINDS.includes(r.kind), r.kind);
  assert.ok(r.level >= 1 && r.level <= MAX_UNLOCK_LEVEL, `${r.id} at ${r.level}`);
 }
 for (const k of KINDS) {
  const ids = rewardsOf(k).map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, `${k} ids repeat`);
 }
 for (const k of ['badge', 'frame', 'tracer', 'ball', 'skin']) assert.ok(rewardsOf(k).some(r => r.level === 1), `${k} has no starting look`);
 assert.deepEqual(unlocksAt(51), []);
 assert.ok(unlocksAt(50).length >= 6, 'level 50 brings the rainbow set');
});

test('every tracer and every ball finish in the table has a look, and nothing else does', () => {
 assert.deepEqual(rewardsOf('tracer').map(r => r.id).sort(), Object.keys(TRACERS).sort());
 assert.deepEqual(rewardsOf('ball').map(r => r.id).sort(), [...FINISH_IDS].sort());
});

test('a golfer wears what they have earned, and the starting look otherwise', () => {
 assert.equal(isUnlocked('tracer', 'sky', 1), false);
 assert.equal(isUnlocked('tracer', 'sky', 2), true);
 assert.equal(wornItem({tracer: 'sky'}, 'tracer', 2), 'sky');
 // XP taken back by a mulligan: the choice is kept but not worn.
 assert.equal(wornItem({tracer: 'sky'}, 'tracer', 1), 'classic');
 assert.equal(wornItem({ball: 'nonsense'}, 'ball', 50), 'classic');
 assert.equal(wornItem({}, 'title', 50), '', 'no title unless one is chosen');
 assert.equal(wornItem({title: 'legend'}, 'title', 44), '');
 assert.equal(wornItem({title: 'legend'}, 'title', 45), 'legend');
 assert.deepEqual(WEARABLE, ['ball', 'tracer', 'title', 'frame', 'skin']);
});

test('the summary keeps a tracer\'s colours and shape', () => {
 // The summary keeps the golfer's colours too (15 October 2026).
 assert.deepEqual(summaryStyle('dashed'), {colours: TRACERS.dashed.colours, dash: TRACERS.dashed.dash});
 assert.deepEqual(summaryStyle('lightning'), {colours: TRACERS.lightning.colours, jag: TRACERS.lightning.jag});
 assert.deepEqual(summaryStyle('sunset'), {colours: TRACERS.sunset.colours});
 for (const [id, st] of Object.entries(TRACERS)) assert.ok(Array.isArray(st.colours) && st.colours.length, id + ' has no colours of its own');
 assert.equal(tracerStyle('nonsense'), TRACERS.classic);
 assert.deepEqual(stopColour(['#000000', '#ffffff'], .5).map(v => +v.toFixed(3)), [.5, .5, .5]);
 assert.deepEqual(stopColour(['#ff0000', '#0000ff'], 2), [0, 0, 1]);
});

// ONE SOURCE: the texture the ball wears and the picture are drawn from the
// same rule, so the colour at the middle of the picture is the colour of the
// texel looking the same way.
test('a finish paints the texture and the picture from the same rule', () => {
 for (const id of FINISH_IDS) {
  const tex = finishTexels(id, 64, 32);
  assert.equal(tex.length, 64 * 32 * 4);
  // The texel on the equator that faces +z (three's sphere: phi = pi/2 ->
  // column w/4) against the finish's own colour there.
  const k = (16 * 64 + 16) * 4, c = finishColour(id, [-Math.cos((16.5 / 64) * 2 * Math.PI) * Math.sin((1 - 16.5 / 32) * Math.PI), Math.cos((1 - 16.5 / 32) * Math.PI), Math.sin((16.5 / 64) * 2 * Math.PI) * Math.sin((1 - 16.5 / 32) * Math.PI)]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(tex[k + i] - Math.round(Math.min(1, Math.max(0, c[i])) * 255)) <= 1, `${id} texel and rule disagree`);
  const px = ballPixels(id, 40);
  assert.equal(px[3], 0, `${id}: the corner of the picture is not transparent`);
  assert.ok(px[(20 * 40 + 20) * 4 + 3] === 255, `${id}: the middle of the picture is not solid`);
  for (const v of finishAverage(id)) assert.ok(v >= 0 && v <= 1);
  assert.ok(finishSurface(id).rough > 0 && finishSurface(id).rough <= 1);
 }
});

test('the finishes look different from each other', () => {
 const avg = Object.fromEntries(FINISH_IDS.map(id => [id, finishAverage(id)]));
 const far = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
 assert.ok(far(avg.classic, avg.gold) > .3);
 assert.ok(far(avg.classic, avg['black-pearl']) > .5);
 assert.ok(far(avg.pumpkin, avg.galaxy) > .4);
 // A turned close-up shows a different side.
 const a = ballPixels('two-tone', 24, 0), b = ballPixels('two-tone', 24, .25);
 assert.notDeepEqual(a, b);
});

// PHASE 6 -----------------------------------------------------------------
import {FRAMES, highestBadge, badgeName, METER_SKINS, flourishFor} from '../src/rewards.js';

test('every badge has a frame, the newest is worn unless one is chosen, and Master counts on', () => {
 assert.deepEqual(Object.keys(FRAMES).sort(), rewardsOf('frame').map(r => r.id).sort());
 for (const r of rewardsOf('badge')) assert.ok(rewardsOf('frame').some(q => q.id === r.id && q.level === r.level), r.id + ' brings no frame');
 assert.equal(highestBadge(1), 'rookie');
 assert.equal(highestBadge(14), 'club-regular');
 assert.equal(highestBadge(60), 'fairway-master');
 assert.equal(wornItem({}, 'frame', 22), 'scratch', 'unchosen: the newest');
 assert.equal(wornItem({frame: 'club-member'}, 'frame', 22), 'club-member');
 assert.equal(wornItem({frame: 'legend'}, 'frame', 22), 'scratch', 'not earned: the newest');
 assert.equal(badgeName(57), 'Master 57');
 assert.equal(badgeName(50), 'Fairway Master');
 assert.equal(badgeName(5), 'Club Member');
});

// LEGIBLE IN EVERY SKIN (spec 7.6): the zone over the track, the perfect band
// and the target marker must stand apart by LIGHTNESS -- not by hue alone --
// for normal vision and simulated red-green colour blindness, so a player who
// cannot tell yellow from green still sees the band inside the zone.
const rgb = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const [r, g, b, a = 1] = m[1].split(',').map(Number); return {c: [r, g, b].map(v => v / 255), a}; } const n = parseInt(c.slice(1), 16); return {c: [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255], a: 1}; };
const lin = v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
const over = (top, base) => top.c.map((v, i) => v * top.a + base.c[i] * (1 - top.a));
// Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear light.
const SIM = {none: null, deutan: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]], protan: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]]};
const lum = (c, m) => { let l = c.map(lin); if (m) l = m.map(r => Math.max(0, r[0] * l[0] + r[1] * l[1] + r[2] * l[2])); return .2126 * l[0] + .7152 * l[1] + .0722 * l[2]; };
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
test('every meter skin keeps the zone, the perfect band and the target apart, colour blind or not', () => {
 assert.equal(Object.keys(METER_SKINS).length, 10);
 assert.deepEqual(Object.keys(METER_SKINS).sort(), rewardsOf('skin').map(r => r.id).sort());
 for (const [id, s] of Object.entries(METER_SKINS)) for (const [vision, m] of Object.entries(SIM)) {
  const base = rgb(s.base), zone = over(rgb(s.zone), base), perfect = rgb(s.perfect).c, target = rgb(s.target).c;
  const Lt = lum(base.c, m), Lz = lum(zone, m), Lp = lum(perfect, m), Lg = lum(target, m);
  assert.ok(ratio(Lz, Lt) >= 1.5, `${id} (${vision}): the zone barely shows on the track (${ratio(Lz, Lt).toFixed(2)})`);
  assert.ok(ratio(Lp, Lz) >= 1.5, `${id} (${vision}): the perfect band is lost in the zone (${ratio(Lp, Lz).toFixed(2)})`);
  assert.ok(ratio(Lg, Lt) >= 3, `${id} (${vision}): the target marker is faint on the track (${ratio(Lg, Lt).toFixed(2)})`);
 }
});

test('a hole-out shows the rarest flourish the golfer has earned', () => {
 assert.equal(flourishFor({score: 1, par: 3}, 36), 'lantern-ace');
 assert.equal(flourishFor({score: 1, par: 3}, 35), 'fireworks-eagle', 'no lantern yet: an ace is an eagle or better');
 assert.equal(flourishFor({score: 3, par: 4, chipIn: true}, 30), 'ring-chip-in');
 assert.equal(flourishFor({score: 3, par: 4}, 5), 'confetti-birdie');
 assert.equal(flourishFor({score: 3, par: 4}, 43), 'fireworks-birdie');
 assert.equal(flourishFor({score: 3, par: 4}, 4), null);
 assert.equal(flourishFor({score: 4, par: 4, gir: false}, 22), 'streamers-par-save');
 assert.equal(flourishFor({score: 4, par: 4, gir: true}, 22), null, 'a par with the green in regulation saved nothing');
 assert.equal(flourishFor({score: 6, par: 4}, 50), 'gold-confetti');
});
