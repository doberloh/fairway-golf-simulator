import test from 'node:test';
import assert from 'node:assert/strict';
import {shotDisplay, cardPhase, cardTab, cleanChoice, loadChoice, saveChoice, CARD_HOLD_MS, CARD_FADE_MS, RANGE_TILES} from '../src/shot-display.js';
import {celebrationFor, paperMark, BAND, QUIET, MAX_BANNER_MS, turnAfter, bannerLength} from '../src/celebration.js';
import {fieldById} from '../src/shot-data.js';

test('on a course the numbers pop up on a card; on the range tiles stay', () => {
 assert.equal(shotDisplay({}).kind, 'card');
 assert.equal(shotDisplay({range: true}).kind, 'tiles');
 assert.equal(shotDisplay({range: true}).stays, true);
 assert.equal(shotDisplay({range: true}).lit, 'carry');
 assert.deepEqual(shotDisplay({}).row, ['ballSpeed', 'backSpin', 'apex']);
});

test('the player\'s choice wins, and Tab shows every number', () => {
 assert.equal(shotDisplay({choice: 'tiles'}).kind, 'tiles');
 assert.equal(shotDisplay({range: true, choice: 'card'}).kind, 'card');
 assert.equal(shotDisplay({choice: 'card', all: true}).kind, 'tiles');
 assert.equal(shotDisplay({choice: 'nonsense'}).kind, 'card');
 assert.equal(cleanChoice('tiles'), 'tiles');
 assert.equal(cleanChoice(7), 'auto');
});

test('a putt pops no card', () => {
 assert.equal(shotDisplay({putt: true}).kind, 'none');
 assert.equal(shotDisplay({putt: true, choice: 'tiles'}).kind, 'tiles');
});

test('the card holds, fades and goes', () => {
 assert.equal(cardPhase(1000, 1000).phase, 'shown');
 assert.equal(cardPhase(1000, 1000 + CARD_HOLD_MS - 1).phase, 'shown');
 const mid = cardPhase(0, CARD_HOLD_MS + CARD_FADE_MS / 2);
 assert.equal(mid.phase, 'fading');
 assert.ok(Math.abs(mid.fade - .5) < 1e-9);
 assert.equal(cardPhase(0, CARD_HOLD_MS + CARD_FADE_MS).phase, 'gone');
 assert.ok(CARD_HOLD_MS + CARD_FADE_MS <= 8000, 'gone before the next golfer is likely to swing');
 assert.equal(cardTab('Ben', 'Driver'), 'BEN · DRIVER');
 assert.equal(cardTab('Ben', ''), 'BEN');
});

test('every range tile is a real shot field', () => {
 for (const id of RANGE_TILES) assert.ok(fieldById(id), id);
 assert.equal(RANGE_TILES.length, 8);
});

test('the choice is kept on the device, and anything odd reads as automatic', () => {
 const m = new Map(), store = {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v)};
 assert.equal(loadChoice(store), 'auto');
 assert.equal(saveChoice('tiles', store), 'tiles');
 assert.equal(loadChoice(store), 'tiles');
 m.set('fairway-shot-display-v1', '{nope');
 assert.equal(loadChoice(store), 'auto');
 assert.equal(loadChoice(null), 'auto');
});

test('birdie or better earns the band; par and worse a quiet strip', () => {
 assert.equal(celebrationFor(3, 4).big, true);
 assert.equal(celebrationFor(3, 4).name, 'BIRDIE!');
 assert.equal(celebrationFor(2, 4).name, 'EAGLE!');
 assert.equal(celebrationFor(1, 3).name, 'HOLE IN ONE!');
 assert.equal(celebrationFor(1, 3).big, true);
 assert.equal(celebrationFor(4, 4).big, false);
 assert.equal(celebrationFor(4, 4).name, 'PAR');
 assert.equal(celebrationFor(9, 4).name, '+5');
 assert.equal(celebrationFor(NaN, 4), null);
 assert.equal(celebrationFor(3, 4, {chipIn: true}).chipIn, true);
});

test('a banner never lasts two seconds and never holds the next turn', () => {
 for (const t of [BAND, QUIET]) {
  assert.ok(bannerLength(t) <= MAX_BANNER_MS, `${bannerLength(t)} ms`);
  assert.ok(turnAfter(t) < bannerLength(t), 'the next turn starts while it leaves');
 }
 for (const [s, p] of [[1, 3], [2, 4], [3, 4], [4, 4], [6, 4], [12, 5]])
  assert.ok(bannerLength(celebrationFor(s, p).timing) <= MAX_BANNER_MS);
});

test('the paper card\'s marks: circles under par, squares over', () => {
 assert.equal(paperMark(3, 4), 'b');
 assert.equal(paperMark(2, 4), 'e');
 assert.equal(paperMark(1, 4), 'e');
 assert.equal(paperMark(4, 4), '');
 assert.equal(paperMark(5, 4), 'g');
 assert.equal(paperMark(6, 4), 'd');
 assert.equal(paperMark(9, 4), 'd');
 assert.equal(paperMark(4.5, 4), '');
 assert.equal(paperMark(undefined, 4), '');
});
