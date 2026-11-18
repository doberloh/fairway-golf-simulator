// SAVES FROM BEFORE THE FAIRWAY TOUR STILL OPEN (the fairway-tour branch,
// 17 November 2026; docs/studies/fairway-tour/GOAL.md, step 0).
//
// tests/fixtures/before-tour/ was written by main (8ca52bdd, Fairway 0.9.18)
// before the branch changed anything: three part-played rounds (stroke play
// with a mulligan history and a Swing Meter golfer, match play two against
// two, skins for three), a profile store with a played nine, a saved course
// as stored and as a code, and a friend's challenge code. Computer golfers,
// net scoring, Stableford and the tour all add to what these records can
// hold; none of that may stop an old one opening or change what it says.
// Never regenerate the fixtures: they are the old version.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Round} from '../src/game.js';
import {normalise as normaliseProfiles, roundTotals} from '../src/profile.js';
import {importCourse} from '../src/course-library.js';
import {readRivalCode} from '../src/rival.js';

const dir = new URL('./fixtures/before-tour/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, dir), 'utf8');
const PIN = {x: 0, z: 150};

test('old rounds restore with their cards, golfers and turn, and play on', () => {
 const saved = JSON.parse(read('rounds.json'));
 for (const [name, data] of Object.entries(saved)) {
  const r = Round.restore(data);
  assert.equal(r.mode, data.mode, name);
  assert.deepEqual(r.cards, data.cards, `${name}: the card`);
  assert.deepEqual(r.players, data.players, `${name}: the golfers`);
  assert.equal(r.hole, data.hole, name);
  assert.equal(r.active, data.active, name);
  assert.equal(r.history.length, data.history?.length ?? 0, `${name}: the mulligan history`);
  // And the round goes on: a tee, a shot, the same golfer's ball moves.
  r.pars[r.hole] = 4; r.placeTee({white: {x: 0, z: 0}, blue: {x: 0, z: -10}, red: {x: 0, z: 10}});
  const who = r.active;
  r.takeShot({end: {x: 2, z: 60}, holed: false, onGreen: false}, PIN);
  assert.equal(r.positions[who].z, 60, `${name}: a shot after restoring`);
 }
});

test('an old profile store reads with its golfers, history and handicap', () => {
 const raw = JSON.parse(read('profiles.json'));
 const store = normaliseProfiles(raw);
 assert.ok(store);
 assert.deepEqual(store.profiles.map(p => p.name), ['Alex', 'Sam']);
 assert.equal(store.main, raw.main);
 const alex = store.profiles[0];
 assert.equal(alex.rounds.length, 1);
 assert.deepEqual(roundTotals(alex.rounds[0]), roundTotals(raw.profiles[0].rounds[0]));
 assert.deepEqual(alex.counters, raw.profiles[0].counters);
 assert.deepEqual(alex.rounds[0].card, raw.profiles[0].rounds[0].card);
});

test('an old saved course and its code read back the same course', () => {
 const {store, code} = JSON.parse(read('courses.json'));
 const stored = store.courses[0], back = importCourse(code);
 assert.equal(back.name, stored.name);
 for (const [k, v] of Object.entries(stored.settings)) assert.deepEqual(back.settings[k], v, `setting ${k}`);
});

test('an old friend\'s challenge code reads with its card and shots', () => {
 const r = readRivalCode(read('rival.txt').trim());
 assert.equal(r.name, 'Alex');
 assert.equal(r.holes, 9);
 assert.equal(r.card.length, 9);
 assert.equal(r.shots.flat().length, 36);
});
