// The cartoon overhaul's ground types (src/grounds.js): every one is a played
// surface in every table that asks what a ball is lying on, and the orderings
// that make each one what it is survive any tuning of the placed numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUNDS, GROUND_KINDS, isGround, isNatural, allows, surfaceLabel} from '../src/grounds.js';
import {contactOf, ploughParts, simulateShot} from '../src/physics.js';
import {rollDeceleration, slideFriction} from '../src/turf.js';
import {LIE_SPEED, LIE_NAMES, lieFactor} from '../src/swing-meter.js';
import {lieRank} from '../src/relief.js';
import {ROLL_HOP} from '../src/roll-hop.js';
import {IMPACTS} from '../src/sound.js';
import {liePenaltyNote} from '../src/shot-data.js';

test('every ground type has a row in every table', () => {
 assert.ok(GROUND_KINDS.length >= 8);
 for (const k of GROUND_KINDS) {
  const g = GROUNDS[k];
  assert.notEqual(contactOf(k), contactOf('green'), `${k}: physics falls back to the green`);
  assert.equal(contactOf(k).cor, g.contact.cor);
  assert.ok(Math.abs(ploughParts(k).total - (g.contact.ground + g.contact.canopy)) < 1e-4, `${k}: plough`);
  assert.equal(rollDeceleration(k), g.roll, `${k}: roll`);
  assert.equal(slideFriction(k), g.slide, `${k}: skid`);
  assert.equal(lieFactor(k), g.lie, `${k}: lie`);
  assert.equal(LIE_SPEED[k], g.lie);
  assert.equal(LIE_NAMES[k], g.word);
  assert.equal(lieRank(k), g.relief, `${k}: relief rank`);
  assert.equal(ROLL_HOP.height[k], g.hop, `${k}: roll hop`);
  assert.ok(IMPACTS[g.sound] || ['rock', 'tee', 'rough', 'sand'].includes(g.sound), `${k}: a sound that exists`);
  assert.ok(/^#[0-9a-f]{6}$/.test(g.map), `${k}: a map colour`);
  assert.ok(g.label && surfaceLabel(k) === g.label, `${k}: a HUD label`);
  assert.ok(isGround(k) && isNatural(k));
 }
 assert.ok(!isGround('rough') && isNatural('rough') && !isNatural('fairway'));
 assert.equal(surfaceLabel('semi'), 'Semi-rough');
 assert.equal(surfaceLabel('tee'), 'Tee box');
});

test('no ground is livelier than a hard surface can be', () => {
 // physics multiplies the elasto-plastic value by up to 3.5 for a slow
 // contact; past about 0.24 a dropped ball would come back higher than it fell.
 for (const k of GROUND_KINDS) assert.ok(GROUNDS[k].contact.cor < .24, `${k}: restitution ${GROUNDS[k].contact.cor}`);
});

test('the orderings that make each ground what it is', () => {
 const cor = k => contactOf(k).cor, lie = lieFactor;
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
