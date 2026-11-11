// The cartoon overhaul's ground types (src/grounds.js): every one is a played
// surface in every table that asks what a ball is lying on, and the orderings
// that make each one what it is survive any tuning of the placed numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUNDS, GROUND_KINDS, isGround, isNatural, allows, surfaceLabel} from '../src/grounds.js';
import {simulateShot} from '../src/physics.js';
import {rollDeceleration, slideFriction, turfOf} from '../src/turf.js';
import {LIE_SPEED, LIE_NAMES, lieFactor} from '../src/swing-meter.js';
import {lieRank} from '../src/relief.js';
import {ROLL_HOP} from '../src/roll-hop.js';
import {IMPACTS} from '../src/sound.js';
import {liePenaltyNote} from '../src/shot-data.js';

test('every ground type has a row in every table', () => {
 assert.ok(GROUND_KINDS.length >= 8);
 for (const k of GROUND_KINDS) {
  const g = GROUNDS[k];
  // Its own row in the ball's table (turf.js), not rough's by default, and
  // not moved by either firmness: firmness is a property of mown turf.
  const row = turfOf(k);
  for (const c of ['e0', 'eHi', 'tilt', 'mu', 'grab']) assert.equal(row[c], g.turf[c], `${k}: ${c}`);
  assert.equal(row.stimp, g.turf.stimp, `${k}: roll`);
  assert.equal(slideFriction(k), g.turf.slide, `${k}: skid`);
  assert.equal(row.firmer, null);
  assert.equal(row.hard, !!g.turf.hard);
  assert.equal(lieFactor(k), g.lie, `${k}: lie`);
  assert.equal(LIE_SPEED[k], g.lie);
  assert.equal(LIE_NAMES[k], g.word);
  assert.equal(lieRank(k), g.relief, `${k}: relief rank`);
  assert.equal(ROLL_HOP.height[k], g.hop, `${k}: roll hop`);
  assert.ok(IMPACTS[g.sound] || ['rock', 'tee', 'rough', 'sand'].includes(g.sound), `${k}: a sound that exists`);
  assert.ok(/^#[0-9a-f]{6}$/.test(g.map), `${k}: a map colour`);
  assert.ok(g.label && surfaceLabel(k) === g.label, `${k}: a HUD label`);
  // The cart path (architect-courses) and the road (roads.js) are grounds a
  // ball lies on, but man-made.
  assert.ok(isGround(k) && isNatural(k) === (k !== 'path' && k !== 'road'), k);
 }
 assert.ok(!isGround('rough') && isNatural('rough') && !isNatural('fairway'));
 assert.equal(surfaceLabel('semi'), 'Semi-rough');
 assert.equal(surfaceLabel('tee'), 'Tee box');
});

test('no ground is livelier than a hard surface can be', () => {
 // A golf ball dropped on concrete comes back to about 60% of its height
 // (restitution near 0.78); nothing a ball lands on out here is livelier, and
 // nothing that is not rock or paving comes close.
 for (const k of GROUND_KINDS) {
  const t = GROUNDS[k].turf;
  assert.ok(t.e0 < .78 && t.eHi <= t.e0, `${k}: restitution ${t.e0}`);
  if (!t.hard) assert.ok(t.e0 < .6 && t.eHi < .25, `${k}: soft ground cannot bounce like stone`);
 }
});

test('the orderings that make each ground what it is', () => {
 const cor = k => turfOf(k).eHi, lie = lieFactor;
 // Rock and coral are the hardest things a ball lands on; hardpan is firmer
 // than a fairway; heather and waste sand are the deadest.
 assert.ok(cor('rock') > cor('hardpan') && cor('hardpan') > cor('fairway'));
 assert.ok(cor('coral') > cor('fairway') && cor('scree') > cor('rough'));
 assert.ok(cor('heather') < cor('rough') && cor('waste') < cor('rough'));
 // A ball runs on hardpan and rock, dies in heather and native grass.
 assert.ok(rollDeceleration('rock') < rollDeceleration('fairway') + .01);
 assert.ok(rollDeceleration('hardpan') < rollDeceleration('semi'));
 assert.ok(rollDeceleration('heather') > rollDeceleration('rough'));
 assert.ok(rollDeceleration('native') > rollDeceleration('rough'));
 // The lie: hardpan is a tight lie but cleaner than rough; heather the worst
 // grass; nothing is better than a fairway or worse than a bunker.
 assert.ok(lie('hardpan') > lie('rough') && lie('heather') < lie('rough'));
 for (const k of GROUND_KINDS) assert.ok(lie(k) <= 1 && lie(k) >= lie('sand') - .03, `${k}: lie ${lie(k)}`);
 // Waste sand takes spin as a bunker does.
 assert.ok(GROUNDS.waste.killsSpin);
});

test('what may stand on each ground', () => {
 assert.ok(allows('rough', 'trees') && allows('rough', 'grass'));
 assert.ok(!allows('rock', 'trees') && allows('rock', 'boulders'));
 assert.ok(!allows('waste', 'boulders') && !allows('scree', 'grass'));
 assert.ok(allows('pinestraw', 'trees') && !allows('pinestraw', 'grass'));
 assert.ok(allows('native', 'grass'));
});

test('a ball that lands on rock runs further than one landing in heather', () => {
 // A pitch onto flat ground of each kind: the whole contact and roll path,
 // not just the table rows.
 const flat = surface => ({height: () => 0, surface: () => surface, bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: [], pin: {x: 9e9, z: 9e9}});
 const shot = {origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: 25, vla: 32, spin: 5500};
 const run = surface => { const r = simulateShot(shot, flat(surface)); return r.total - r.carry; };
 assert.ok(run('rock') > run('rough'), `rock ${run('rock').toFixed(1)} m against rough ${run('rough').toFixed(1)}`);
 assert.ok(run('heather') < run('rough'), `heather ${run('heather').toFixed(1)} m against rough ${run('rough').toFixed(1)}`);
});

test('the shot card names the ground a lie was played from', () => {
 const note = liePenaltyNote({shot: {lie: {surface: 'heather', factor: .78, before: 50}}});
 assert.match(note, /heather/);
});
