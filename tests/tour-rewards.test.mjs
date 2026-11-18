// WHAT THE TOUR PAYS (src/tour-rewards.js): an event's finish, a round beaten
// against the playing partners, a season won -- each XP under its own key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {eventRewards, roundRewards, seasonRewards, TOUR_XP} from '../src/tour-rewards.js';
import {achievement} from '../src/achievements.js';
import {YOU} from '../src/tournament.js';

const ev = (place, extra = {}) => ({id: 'e1', name: 'Test Open', format: 'stroke', major: false, cut: {after: 2, made: place ? [YOU] : []}, results: [{id: YOU, place, pos: place ? String(place) : 'MC'}], ...extra});

test('an event: the cut, a top ten, a win, a major, a playoff', () => {
 assert.deepEqual(eventRewards(ev(null)).achievements, []);
 assert.deepEqual(eventRewards(ev(25)).achievements, ['made-the-cut']);
 assert.deepEqual(eventRewards(ev(7)).achievements, ['made-the-cut', 'top-ten']);
 const win = eventRewards(ev(1, {major: true, playoff: {winner: YOU}}), {tourId: 't1', season: 2});
 assert.deepEqual(win.achievements, ['made-the-cut', 'top-ten', 'tour-winner', 'major-champion', 'playoff-winner']);
 assert.equal(win.xp.reduce((s, x) => s + x.xp, 0), TOUR_XP.cut + TOUR_XP.top10 + TOUR_XP.win + TOUR_XP.major + TOUR_XP.playoff);
 assert.ok(win.xp.every(x => x.key.startsWith('t1:s2:e1:')), 'keyed by tour, season and event: never paid twice');
 for (const id of win.achievements) assert.ok(achievement(id), id);
});

test('head to head: beating all three partners in a round; Stableford by points', () => {
 const cards = [{id: YOU, total: 70}, {id: 'a', total: 72}, {id: 'b', total: 71}, {id: 'c', total: 75}];
 assert.deepEqual(roundRewards(ev(1), 0, cards).achievements, ['head-to-head']);
 assert.equal(roundRewards(ev(1), 0, [...cards.slice(0, 3), {id: 'c', total: 70}]).xp.length, 0, 'a tie is not a win');
 assert.equal(roundRewards({...ev(1), format: 'stableford'}, 0, [{id: YOU, total: 38}, {id: 'a', total: 30}, {id: 'b', total: 33}]).xp.length, 1);
});

test('a season: paid only to an outright champion', () => {
 const t = {id: 't1', season: 1, name: 'Tour'};
 assert.deepEqual(seasonRewards(t, [{id: YOU, points: 900}, {id: 'a', points: 800}]).achievements, ['season-champion']);
 assert.deepEqual(seasonRewards(t, [{id: YOU, points: 900}, {id: 'a', points: 900}]).achievements, []);
 assert.deepEqual(seasonRewards(t, [{id: 'a', points: 900}, {id: YOU, points: 800}]).achievements, []);
});
