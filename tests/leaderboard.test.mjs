import test from 'node:test';
import assert from 'node:assert/strict';
import {leaderboard, field} from '../src/leaderboard.js';

// THE LIVE SCOREBOARD (leaderboard.js; the owner's review: "actually show the
// players score"). What the board by the last green says.

const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5];

test('the golfers are on the board with their own score and holes played', () => {
 const b = leaderboard({players: [{name: 'Pat', card: [3, 4, 3]}, {name: 'Sam', card: [5, 5, 4]}], pars, seed: 'B-1'});
 const pat = b.rows.find(r => r.name === 'Pat'), sam = b.rows.find(r => r.name === 'Sam');
 assert.ok(pat && sam, 'a golfer missing from the board');
 assert.deepEqual([pat.score, pat.thru, pat.under, pat.you], ['-1', '3', true, true]);
 assert.deepEqual([sam.score, sam.thru, sam.under], ['+3', '3', false]);
 assert.ok(b.rows.length <= 8);
 assert.match(b.title, /SUNDAY/);
});

test('ranked best first, ties shared, a finished round is F', () => {
 const done = [4, 4, 3, 5, 4, 4, 3, 4, 5];
 const b = leaderboard({players: [{name: 'Pat', card: done}], pars, seed: 'B-2', day: 'Thursday'});
 const rel = s => s === 'E' ? 0 : Number(s);
 for (let i = 1; i < b.rows.length; i++) assert.ok(rel(b.rows[i].score) >= rel(b.rows[i - 1].score), 'out of order');
 assert.equal(b.rows.find(r => r.you).thru, 'F');
 for (const r of b.rows) if (b.rows.filter(o => o.score === r.score).length > 1) assert.match(r.pos, /^T/);
});

test('a golfer far down the field still shows, the board never grows', () => {
 const bad = [9, 9, 9];
 const b = leaderboard({players: [{name: 'Pat', card: bad}, {name: 'Sam', card: bad}, {name: 'Lee', card: bad}, {name: 'Kim', card: bad}], pars, seed: 'B-3', rows: 6});
 assert.equal(b.rows.length, 6);
 for (const n of ['Pat', 'Sam', 'Lee', 'Kim']) assert.ok(b.rows.some(r => r.name === n), `${n} fell off the board`);
});

test('the field is the same for a seed, moves with the golfers, and before a shot shows dashes', () => {
 assert.deepEqual(field('S', 9), field('S', 9));
 for (const s of ['S', 'T', 'U']) { const sur = field(s, 9).map(f => f.name.split(' ')[1]); assert.equal(new Set(sur).size, sur.length, 'a surname twice'); }
 assert.notDeepEqual(field('S', 9), field('T', 9));
 const start = leaderboard({players: [{name: 'Pat', card: []}], pars, seed: 'B-4'});
 assert.equal(start.rows.find(r => r.you).thru, '-');
 const later = leaderboard({players: [{name: 'Pat', card: [4, 4, 3, 5, 4]}], pars, seed: 'B-4'});
 const played = rows => rows.filter(r => !r.you).reduce((n, r) => n + (r.thru === 'F' ? 9 : r.thru === '-' ? 0 : Number(r.thru)), 0);
 assert.ok(played(later.rows) > played(start.rows), 'the field did not play on');
});
