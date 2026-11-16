// The pull-and-push swing (swing-stroke.js): a thumb's path into the strike the
// Swing Meter's launch takes. RESEARCH.md *The pull-and-push swing*.
import test from 'node:test';
import assert from 'node:assert/strict';
import {turfConfig} from '../src/turf.js';
import {bagClubs, stockBag} from '../src/clubs.js';
import {swingLaunch, strikeZone, OVERSWING} from '../src/swing-meter.js';
import {STROKE, startStroke, strokeMove, strokeEffect, strokeWords, leanFor, pullLength, pullShare} from '../src/swing-stroke.js';

const clubs = bagClubs(stockBag());
const turf = turfConfig({});
const FULL = 200;
const idealFor = share => STROKE.tempo * (STROKE.tempoShort + (1 - STROKE.tempoShort) * Math.min(1, share));

// A scripted thumb. It lands at (200, 300), pulls `pull` px down over 400 ms,
// may adjust to `settle` px, holds `hold` ms, then pushes up at a steady pace
// that crosses the line `cross` ms after leaving the top (the ideal pace by
// default), drifting `drift` px sideways by the line and bending `bend` px
// more over the push's second half. Sampled `hz` times a second from `phase`.
function play({pull = 120, settle = null, hold = 200, cross = null, drift = 0, bend = 0, hz = 120, phase = 0, difficulty = 'normal', putt = false, lean = 0, release = true} = {}) {
 const x0 = 200, y0 = 300, top = settle ?? pull, share = top / FULL;
 const crossMs = cross ?? idealFor(share), v = top / crossMs, over = 40;
 const tPull = 400, tAdj = settle == null ? 0 : 500, tTop = tPull + tAdj + hold, tEnd = tTop + (top + over) / v;
 const at = t => {
  if (t <= tPull) { const u = t / tPull; return {x: x0, y: y0 + pull * (1 - (1 - u) * (1 - u))}; }
  if (t <= tPull + tAdj) { const u = (t - tPull) / tAdj; return {x: x0, y: y0 + pull + (top - pull) * u}; }
  if (t <= tTop) return {x: x0, y: y0 + top};
  const d = Math.min(top + over, (t - tTop) * v), u = d / top, h = Math.max(0, u - .5) * 2;
  return {x: x0 + drift * u + bend * h * h, y: y0 + top - d};
 };
 const st = startStroke(1000, x0, y0, {fullPx: FULL, difficulty, putt, lean});
 const dt = 1000 / hz;
 for (let t = phase || dt; t <= tEnd + dt; t += dt) {
  const p = at(Math.min(t, release ? tEnd : tTop));
  if (strokeMove(st, 1000 + t, p.x, p.y) === 'struck') break;
 }
 return st;
}
const zonesOf = (st, club = 'iron7', extra = {}) => strikeZone({difficulty: st.difficulty, shape: 1, lie: 'fairway', putt: !!st.putt, power: st.result.share, ...extra});
const judge = (st, club = 'iron7') => strokeEffect(st.result, zonesOf(st, club), {difficulty: st.difficulty, putt: st.putt, lean: st.lean});

test('a straight push at the ideal pace is a perfect strike, and the pull is the distance', () => {
 for (const hz of [30, 60, 120]) {
  const st = play({pull: 120, hz});
  assert.ok(st.done, `struck at ${hz} Hz`);
  assert.ok(Math.abs(st.result.share - .6) < .01, `share ${st.result.share} at ${hz} Hz`);
  const fx = judge(st);
  assert.equal(fx.perfect, true, `perfect at ${hz} Hz: ${JSON.stringify(fx.parts)}`);
  assert.equal(strokeWords(fx), 'Perfect strike');
 }
});

test('a perfect stroke launches exactly as a perfect meter swing of the same length', () => {
 const st = play({pull: 150});
 const ctx = {club: clubs.iron7, shape: {}, short: false, lie: 'fairway', difficulty: 'normal', turf};
 const fx = judge(st);
 const stroke = swingLaunch({power: st.result.share, fx, done: true}, ctx);
 const meter = swingLaunch({power: st.result.share, error: 0, done: true}, ctx);
 assert.deepEqual(stroke.shot, meter.shot);
});

test('the pull is capped at the end of the overswing zone', () => {
 const st = play({pull: FULL * 2});
 assert.equal(st.result.share, 1 + OVERSWING);
 assert.equal(pullShare(st, 300 + FULL * 3), 1 + OVERSWING);
});

test('drift right sends the ball right, drift left sends it left', () => {
 const right = judge(play({drift: 30})), left = judge(play({drift: -30}));
 assert.ok(right.hla > 0 && right.axis > 0, JSON.stringify(right));
 assert.ok(left.hla < 0 && left.axis < 0, JSON.stringify(left));
 assert.match(strokeWords(right), /right/);
 assert.match(strokeWords(left), /left/);
});

test('on Hard the start sets the line and a hook at the finish curves the ball left', () => {
 const hard = judge(play({bend: -25, difficulty: 'hard'}));
 assert.ok(Math.abs(hard.hla) < .01, `line held: ${hard.hla}`);
 assert.ok(hard.axis < 0, `hooked: ${hard.axis}`);
 assert.match(strokeWords(hard), /hook/i);
 const slice = judge(play({bend: 25, difficulty: 'hard'}));
 assert.ok(slice.axis > 0);
 // Normal reads the same bend as part of one line, and has no curve layer.
 const normal = judge(play({bend: -25}));
 assert.equal(normal.parts.curve, null);
});

test('tempo: rushed goes left and low, lazy comes up short; Easy does not judge it', () => {
 const ideal = idealFor(.6);
 const rushed = judge(play({cross: ideal / 2.2})), lazy = judge(play({cross: ideal * 2.2}));
 assert.ok(rushed.hla < 0 && rushed.vla < 0 && rushed.speed > 1, JSON.stringify(rushed));
 assert.ok(lazy.speed < 1 && lazy.hla > 0, JSON.stringify(lazy));
 assert.match(strokeWords(rushed), /rushed/i);
 assert.match(strokeWords(lazy), /lazy/i);
 assert.equal(judge(play({cross: ideal / 2.2, difficulty: 'easy'})).perfect, true);
 // Hard's window is narrower than Normal's.
 const quick = ideal / 1.3;
 assert.equal(judge(play({cross: quick})).parts.tempo.miss > 0, true);
 assert.ok(judge(play({cross: quick, difficulty: 'hard'})).parts.tempo.miss > judge(play({cross: quick})).parts.tempo.miss);
});

test('holding at the top, however long, is not part of the push', () => {
 const a = play({hold: 50}).result, b = play({hold: 3000}).result;
 assert.ok(Math.abs(a.tempo - b.tempo) < .02, `${a.tempo} vs ${b.tempo}`);
});

test('adjusting the pull before pushing: the push starts from where the thumb settled', () => {
 const st = play({pull: 180, settle: 110});
 assert.ok(Math.abs(st.result.share - 110 / FULL) < .01, `share ${st.result.share}`);
 assert.equal(judge(st).perfect, true);
});

test('letting go before the push is no stroke, and a wobble on the line is not a swing', () => {
 const held = play({release: false});
 assert.equal(held.done, false);
 const st = startStroke(0, 100, 100, {fullPx: FULL, difficulty: 'normal'});
 for (const [t, y] of [[10, 102], [20, 99], [30, 103], [40, 98]]) assert.equal(strokeMove(st, t, 100, y), 'pull');
 assert.equal(st.done, false);
});

test('the frame rate does not decide: the same stroke at 30 and 120 samples a second', () => {
 const base = play({pull: 140, drift: 12, cross: idealFor(.7) * 1.1, hz: 120}).result;
 for (const phase of [1, 7, 13, 19, 29]) {
  const r = play({pull: 140, drift: 12, cross: idealFor(.7) * 1.1, hz: 30, phase}).result;
  assert.ok(Math.abs(r.share - base.share) < .01, `share ${r.share} vs ${base.share}`);
  assert.ok(Math.abs(r.line - base.line) < .5, `line ${r.line} vs ${base.line}`);
  assert.ok(Math.abs(r.tempo / base.tempo - 1) < .04, `tempo ${r.tempo} vs ${base.tempo}`);
 }
});

test('the aim line leans uphill on a side slope, and following it is straight', () => {
 assert.ok(leanFor(4, 'hard') < 0, 'ground falling right leans the line left');
 assert.ok(leanFor(-4, 'hard') > 0);
 assert.equal(leanFor(4, 'hard', {putt: true}), 0);
 assert.equal(leanFor(40, 'hard'), -STROKE.leanMax);
 assert.ok(Math.abs(leanFor(4, 'easy')) < Math.abs(leanFor(4, 'hard')));
 const lean = leanFor(4, 'normal'), pull = 120;
 const along = play({pull, lean, drift: Math.tan(lean * Math.PI / 180) * pull});
 assert.equal(judge(along).perfect, true, JSON.stringify(judge(along).parts));
 // Pushing straight up on that slope sends the ball right, down the slope.
 assert.ok(judge(play({pull, lean})).hla > 0);
});

test('putts judge the line only, on the putting zone', () => {
 const st = play({pull: 80, putt: true, cross: idealFor(.4) / 3});
 const fx = strokeEffect(st.result, strikeZone({difficulty: 'hard', shape: 1, putt: true, power: st.result.share}), {difficulty: 'hard', putt: true});
 assert.equal(fx.parts.tempo, null);
 assert.equal(fx.parts.curve, null);
 assert.equal(fx.axis, 0);
});

test('the full pull is about a third of the screen, within bounds', () => {
 assert.equal(pullLength(750), 225);
 assert.equal(pullLength(200), 100);
 assert.equal(pullLength(2000), 260);
});
