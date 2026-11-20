// A TOURNAMENT (src/tournament.js; the fairway-tour goal, 17 November 2026):
// the field drawn from the hole model, pairings, the leaderboard as the
// person plays, the cut, a playoff, points and prize money -- all without a
// browser or the ball model (the person's group is played by main.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {newEvent, holeModel, holeMean, drawRound, drawField, recordCard, pairings, myGroup, leaderboard, makeCut, finish, playoffFor, drawPlayoff, totals, everyone, YOU, readEvent, setNetStrokes, projectedCut} from '../src/tournament.js';

const HOLES = Array.from({length: 18}, (_, i) => ({par: [4, 4, 3, 5, 4, 4][i % 6], yards: [400, 380, 175, 530, 420, 360][i % 6]}));
const event = (extra = {}) => {
 const ev = newEvent({name: 'Test Open', seed: 'T1', course: {name: 'Test', settings: {seed: 'X'}}, rounds: 4, size: 60, strength: 'mixed', person: {name: 'Alex', index: 12}, ...extra});
 ev.pars = HOLES.map(h => h.par);
 ev.model = holeModel(HOLES, {scratch: 75, bogey: 96});
 return ev;
};
const play = (ev, r, mine = myGroup(ev, r), strokes = 4) => {
 for (const id of mine) recordCard(ev, id, HOLES.map(h => id === YOU ? h.par + (strokes - 4) : h.par + 1), r);
 drawField(ev, r, mine);
};

test('the hole model: scaled to the computer golfers\' totals, worse with the handicap', () => {
 const m = holeModel(HOLES, {scratch: 75, bogey: 96});
 assert.ok(Math.abs(m.scratch.reduce((s, v) => s + v, 0) - 75) < 1e-9);
 assert.ok(Math.abs(m.bogey.reduce((s, v) => s + v, 0) - 96) < 1e-9);
 for (let i = 0; i < 18; i++) assert.ok(holeMean(m, i, 30) > holeMean(m, i, 10) && holeMean(m, i, 10) > holeMean(m, i, 0));
 // Drawn rounds average what the model says (within a stroke over 200).
 const avg = h => Array.from({length: 200}, (_, k) => drawRound(m, h, `avg${h}|${k}`).reduce((s, v) => s + v, 0)).reduce((s, v) => s + v, 0) / 200;
 const want = h => m.pars.reduce((s, _, i) => s + holeMean(m, i, h), 0);
 for (const h of [0, 10, 20]) assert.ok(Math.abs(avg(h) - want(h)) < 1, `handicap ${h}: ${avg(h)} against ${want(h)}`);
 assert.deepEqual(drawRound(m, 8, 'same'), drawRound(m, 8, 'same'), 'seeded: a reload draws the same round');
});

test('a field of 60, the person among them; groups of four with the person in one', () => {
 const ev = event();
 assert.equal(everyone(ev).length, 60);
 assert.equal(new Set(ev.field).size, 59);
 const groups = pairings(ev, 0);
 assert.equal(groups.flat().length, 60);
 assert.ok(groups.every(g => g.length >= 3 && g.length <= 5));
 assert.equal(myGroup(ev, 0).length, 4);
 assert.deepEqual(pairings(ev, 0), pairings(ev, 0), 'the same draw every time');
});

test('the leaderboard follows the person round the course, and the field by its tee times', () => {
 const ev = event();
 play(ev, 0);
 const early = leaderboard(ev, {thru: 3}), late = leaderboard(ev, {thru: 18, partnerThru: Object.fromEntries(everyone(ev).map(id => [id, 18]))});
 assert.equal(early.find(x => x.id === YOU).thru, 3);
 // Groups out before the person's are further on, those after not as far
 // (the person's group may be first out, so only "some differ" is sure).
 const g = pairings(ev, 0), mine = g.findIndex(x => x.includes(YOU));
 assert.ok(early.some(x => x.thru !== 3));
 for (const row of early) { const gi = g.findIndex(x => x.includes(row.id)); if (gi < mine - 1) assert.ok(row.thru > 3, `${row.name}, out earlier`); if (gi > mine + 1) assert.ok(row.thru < 3, `${row.name}, out later`); }
 assert.ok(late.every(x => x.thru === 18));
 assert.equal(late[0].place, 1);
 assert.ok(late.every((x, i) => i === 0 || x.total >= late[i - 1].total), 'fewest strokes first');
 assert.ok(late.some(x => x.pos.startsWith('T')), 'ties share a place');
});

test('a four-round event: the cut after two, the weekend paired by score, a finish with points and money', () => {
 const ev = event();
 for (let r = 0; r < 4; r++) {
  if (r === 2) {
   const before = projectedCut({...ev, cut: null}, leaderboard(ev, {r: 1, thru: 18, partnerThru: Object.fromEntries(everyone(ev).map(id => [id, 18]))}));
   const cut = makeCut(ev);
   assert.equal(cut.after, 2);
   assert.ok(cut.made.length >= 27 && cut.made.length < 40, `${cut.made.length} made the cut`);
   assert.equal(cut.line, before);
   assert.ok(cut.made.includes(YOU), 'the person (playing to par) makes it');
   // The weekend's last group holds the leaders.
   const g = pairings(ev, 2), t = totals(ev, 2), last = g[g.length - 1];
   assert.equal(Math.min(...cut.made.map(id => t[id])), Math.min(...last.map(id => t[id])));
  }
  play(ev, r, myGroup(ev, r), 3); // the person a stroke under par every hole: a runaway winner
  ev.round = r + 1;
 }
 assert.equal(playoffFor(ev), null);
 const res = finish(ev);
 assert.equal(res[0].id, YOU);
 assert.equal(res[0].points, 500);
 assert.equal(res[0].money, 360000);
 assert.ok(res.filter(x => x.pos === 'MC').every(x => !x.points && !x.money));
 assert.ok(res.every((x, i) => i === 0 || x.place === null || x.points <= res[i - 1].points));
 const back = readEvent(JSON.parse(JSON.stringify(ev)));
 assert.deepEqual(back.results, ev.results);
});

test('a tie for first is played off; Stableford ranks by points; net takes the strokes off', () => {
 const ev = event({rounds: 1, size: 30});
 play(ev, 0);
 // Force a tie at the top with the person.
 const rival = leaderboard(ev, {thru: 18, partnerThru: Object.fromEntries(everyone(ev).map(id => [id, 18]))}).find(x => x.id !== YOU).id;
 recordCard(ev, YOU, ev.scores[rival][0], 0);
 ev.round = 1;
 const tied = playoffFor(ev);
 assert.ok(tied && tied.includes(YOU) && tied.includes(rival));
 const w = drawPlayoff(ev, tied, {you: [3, 3, 3, 3, 3, 3]});
 assert.ok(tied.includes(w));
 assert.equal(finish(ev)[0].id, w);

 const sf = event({format: 'stableford', rounds: 1, size: 30});
 play(sf, 0); sf.round = 1;
 const rows = leaderboard(sf, {r: 0, thru: 18, partnerThru: Object.fromEntries(everyone(sf).map(id => [id, 18]))});
 assert.ok(rows.every((x, i) => i === 0 || x.total <= rows[i - 1].total), 'most points first');
 assert.equal(rows.find(x => x.id === YOU).total, 36, 'par golf is two points a hole');

 const nt = event({net: true, rounds: 1, size: 30});
 setNetStrokes(nt, HOLES);
 play(nt, 0);
 const youNet = leaderboard(nt, {r: 0, thru: 18}).find(x => x.id === YOU).total;
 assert.ok(youNet < 0, `the person's net score, ${youNet}, is under par with strokes off`);
});
