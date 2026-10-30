// Play again (src/last-play.js): what is kept, what is offered, what it says.
import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberPlay, lastPlay, againLine, AGAIN_KINDS} from '../src/last-play.js';

const store = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m}; };
const group = (n = 1, mode = 'stroke') => ({players: ['Alex', 'Sam', 'Jordan', 'Riley'].slice(0, n).map(name => ({name, team: 'A'})), mode, tee: 'white'});

test('the last setup comes back as it was started', () => {
 const s = store();
 assert.equal(rememberPlay(s, {kind: 'weekly', group: group(2, 'match')}), true);
 const l = lastPlay(s);
 assert.equal(l.kind, 'weekly');
 assert.deepEqual(l.group.players.map(p => p.name), ['Alex', 'Sam']);
 assert.equal(l.group.mode, 'match');
});

test('a friend\'s challenge and anything unknown are not kept', () => {
 const s = store();
 assert.equal(rememberPlay(s, {kind: 'friend', group: group()}), false);
 assert.equal(rememberPlay(s, {kind: 'nonsense', group: group()}), false);
 assert.equal(lastPlay(s), null);
 assert.ok(!AGAIN_KINDS.includes('friend'));
});

test('a saved course needs its id, and is not offered once deleted', () => {
 const s = store();
 assert.equal(rememberPlay(s, {kind: 'saved', group: group()}), false, 'no id');
 rememberPlay(s, {kind: 'saved', courseId: 'c1', group: group()});
 assert.equal(lastPlay(s, {hasCourse: id => id === 'c1'}).courseId, 'c1');
 assert.equal(lastPlay(s, {hasCourse: () => false}), null);
});

test('no golfers, a damaged entry or a refusing store offer nothing and throw nothing', () => {
 const s = store();
 assert.equal(rememberPlay(s, {kind: 'weekly', group: {players: []}}), false);
 s.setItem('fairway-last-play-v1', '{broken');
 assert.equal(lastPlay(s), null);
 const refusing = {getItem: () => { throw Error('no'); }, setItem: () => { throw Error('no'); }};
 assert.equal(rememberPlay(refusing, {kind: 'weekly', group: group()}), false);
 assert.equal(lastPlay(refusing), null);
});

test('at most four golfers are kept', () => {
 const s = store();
 rememberPlay(s, {kind: 'endless', group: {players: Array.from({length: 6}, (_, i) => ({name: 'P' + i}))}});
 assert.equal(lastPlay(s).group.players.length, 4);
});

test('the line says what will start, in plain words', () => {
 assert.equal(againLine({kind: 'weekly', group: group(1)}, {name: 'Kelpie Bend'}), 'Kelpie Bend, the course of the week · Alex · stroke play');
 assert.equal(againLine({kind: 'endless', group: group(2)}), 'An endless run · 2 golfers');
 assert.equal(againLine({kind: 'saved', group: group(3, 'scramble')}, {name: 'Cliffs'}), 'Cliffs · 3 golfers · scramble');
 assert.equal(againLine({kind: 'surprise', group: group(1, 'skins')}), 'A new surprise nine · Alex · skins');
 assert.equal(againLine(null), '');
});
