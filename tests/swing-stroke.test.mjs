// The pull-and-push swing (swing-stroke.js): a thumb's path into the strike the
// swing's launch takes -- the pull, the line, the tempo, the backswing, and the
// shape the finish picks (curve and height together, read from the shape
// point below the strike line to where the follow-through ends); the pad's
// size; and the spin dot (swing-meter.js SPIN_DOT). RESEARCH.md *The
// pull-and-push swing*.
import test from 'node:test';
import assert from 'node:assert/strict';
import {turfConfig} from '../src/turf.js';
import {bagClubs, stockBag} from '../src/clubs.js';
import {swingLaunch, strikeZone, shapedLaunch, OVERSWING, SPIN_DOT} from '../src/swing-meter.js';
import {STROKE, PAD, startStroke, strokeMove, strokeEffect, strokeWords, leanFor, padSize, pullShare, curveOf, cellOf,
 heightOf, followShare, throughDone, endStroke, idealPush, tempoGauge, shapeNow} from '../src/swing-stroke.js';

const clubs = bagClubs(stockBag());
const turf = turfConfig({});
const FULL = 200;
const idealFor = share => idealPush(share);

// A scripted thumb. It lands at (200, 300) -- the strike line -- pulls `pull`
// px down over 400 ms, may adjust to `settle` px, holds `hold` ms, then pushes
// up at a steady pace that crosses the line `cross` ms after leaving the top
// (the ideal pace by default) and follows through `over` px past it, where it
// stops. `drift` px of sideways per pull length runs through the whole push (a
// line off the aim, carried straight on); `bend` px more is added from the
// shape point to the finish, growing in as a curve. Sampled `hz` times a second from `phase`; the
// follow-through ends by the thumb stopping.
function play({pull = 120, settle = null, hold = 200, cross = null, drift = 0, bend = 0, over = 40, hz = 120, phase = 0, difficulty = 'normal', putt = false, lean = 0, release = true} = {}) {
 const x0 = 200, y0 = 300, top = settle ?? pull, share = top / FULL;
 const crossMs = cross ?? idealFor(share), v = top / crossMs;
 const ay = y0 + Math.min(STROKE.shapeFrom * FULL, top / 2), endY = y0 - over;
 const tPull = 400, tAdj = settle == null ? 0 : 500, tTop = tPull + tAdj + hold, tEnd = tTop + (top + over) / v;
 const at = t => {
  if (t <= tPull) { const u = t / tPull; return {x: x0, y: y0 + pull * (1 - (1 - u) * (1 - u))}; }
  if (t <= tPull + tAdj) { const u = (t - tPull) / tAdj; return {x: x0, y: y0 + pull + (top - pull) * u}; }
  if (t <= tTop) return {x: x0, y: y0 + top};
  const y = y0 + top - Math.min(top + over, (t - tTop) * v), b = Math.max(0, Math.min(1, (ay - y) / (ay - endY)));
  // The bend grows in smoothly, as a thumb's does, from the shape point.
  return {x: x0 + drift * (y0 + top - y) / top + bend * b * b, y};
 };
 const st = startStroke(1000, x0, y0, {fullPx: FULL, difficulty, putt, lean});
 const dt = 1000 / hz;
 let t = phase || dt;
 for (; t <= tEnd + dt; t += dt) {
  const p = at(Math.min(t, release ? tEnd : tTop));
  if (strokeMove(st, 1000 + t, p.x, p.y) === 'done') break;
 }
 if (release && st.result) throughDone(st, 1000 + t + STROKE.settle + 1);
 return st;
}
const zonesOf = st => strikeZone({difficulty: st.difficulty, shape: 1, lie: 'fairway', putt: !!st.putt, power: st.result.share});
const judge = st => strokeEffect(st.result, zonesOf(st), {difficulty: st.difficulty, putt: st.putt, lean: st.lean});

test('a straight push at the ideal pace is a perfect strike, and the pull is the distance', () => {
 for (const hz of [30, 60, 120]) {
  const st = play({pull: 120, hz});
  assert.ok(st.result && st.done, `struck and finished at ${hz} Hz`);
  assert.ok(Math.abs(st.result.share - .6) < .01, `share ${st.result.share} at ${hz} Hz`);
  const fx = judge(st);
  assert.equal(fx.perfect, true, `perfect at ${hz} Hz: ${JSON.stringify(fx.parts)}`);
  assert.equal(fx.curve, 'straight');
  assert.match(strokeWords(fx), /^Perfect strike/);
 }
});

test('a perfect stroke launches exactly as a perfect swing of the same length', () => {
 const st = play({pull: 150});
 const ctx = {club: clubs.iron7, shape: {}, short: false, lie: 'fairway', difficulty: 'normal', turf};
 const stroke = swingLaunch({power: st.result.share, fx: judge(st), done: true}, ctx);
 const clean = swingLaunch({power: st.result.share, error: 0, done: true}, ctx);
 assert.deepEqual(stroke.shot, clean.shot);
});

test('the pull is capped at the end of the overswing zone', () => {
 const st = play({pull: FULL * 2});
 assert.equal(st.result.share, 1 + OVERSWING);
 assert.equal(pullShare(st, 300 + FULL * 3), 1 + OVERSWING);
});

test('the pull is measured from the pad\'s strike line, wherever the thumb lands below it', () => {
 // Pressed 100 px below the line and pushed straight up: half a full pull.
 const st = startStroke(0, 200, 400, {fullPx: FULL, difficulty: 'normal', x0: 200, y0: 300});
 let t = 0;
 for (let y = 400; y >= 280; y -= 5) strokeMove(st, t += 5, 200, y);
 assert.ok(st.result, 'struck');
 assert.ok(Math.abs(st.result.share - .5) < .01, `share ${st.result.share}`);
 assert.equal(st.result.back, 0, 'no backswing was taken');
});

test('the start of the push is the line: drift right starts it right, left starts it left', () => {
 const right = judge(play({drift: 30})), left = judge(play({drift: -30}));
 assert.ok(right.hla > 0, JSON.stringify(right));
 assert.ok(left.hla < 0, JSON.stringify(left));
 assert.equal(right.curve, 'straight', 'a line off the aim carried straight on is no curve');
 assert.match(strokeWords(right), /right/);
 assert.match(strokeWords(left), /left/);
});

test('the finish picks the curve: out to the RIGHT is a draw, out to the left a fade, on every difficulty', () => {
 for (const difficulty of ['easy', 'normal', 'hard']) {
  // 40 px over the 100 px from the shape point to the finish is about 22 degrees: the lane.
  const draw = judge(play({bend: 40, difficulty})), fade = judge(play({bend: -40, difficulty}));
  assert.equal(draw.curve, 'draw', difficulty);assert.equal(fade.curve, 'fade', difficulty);
  assert.equal(draw.parts.curve.miss, 0, `${difficulty}: a lane is clean`);
  assert.ok(Math.abs(draw.hla) < .01, 'the start held the line');
  assert.match(strokeWords(draw), /Draw/);
 }
});

test('the draw the thumb picked starts the ball the way the thumb went, and turns it back', () => {
 // The owner, 16 November 2026: "I think draw and fade are producing reversed
 // shots" -- the Draw lane was on the left, and a draw starts right.
 const ctx = {club: clubs.iron7, short: false, lie: 'fairway', difficulty: 'normal', turf};
 for (const [bend, shape] of [[40, 'draw'], [-40, 'fade']]) {
  const fx = judge(play({bend}));
  assert.equal(fx.curve, shape);
  const out = swingLaunch({power: .8, fx, done: true}, {...ctx, shape: {curve: fx.curve}});
  assert.equal(Math.sign(out.shot.hla), Math.sign(bend), `${shape} starts the way the thumb finished`);
  assert.equal(Math.sign(out.shot.spinAxis), -Math.sign(bend), `${shape} turns back`);
 }
});

test('a finish between the lanes or past one is a miss toward the nearest shape', () => {
 // Hard: straight to 4 degrees, lanes 16 to 28. `extra` is the way the ball curves.
 assert.deepEqual(curveOf(2, 'hard'), {shape: 'straight', miss: 0, extra: 0});
 assert.deepEqual(curveOf(22, 'hard'), {shape: 'draw', miss: 0, extra: 0});
 assert.deepEqual(curveOf(-22, 'hard'), {shape: 'fade', miss: 0, extra: 0});
 const hooked = curveOf(7, 'hard');
 assert.equal(hooked.shape, 'straight');assert.ok(hooked.miss > 0);assert.equal(hooked.extra, -1, 'toward the draw side hooks a touch');
 const under = curveOf(14, 'hard');
 assert.equal(under.shape, 'draw');assert.ok(under.miss > 0);assert.equal(under.extra, 1, 'short of the lane turns back less');
 const over = curveOf(40, 'hard');
 assert.equal(over.shape, 'draw');assert.ok(over.miss > 0);assert.equal(over.extra, -1, 'past the lane turns further');
 // Easier difficulties have wider lanes.
 assert.equal(curveOf(14, 'normal').miss, 0);
 assert.ok(curveOf(14, 'hard').miss > 0);
 // Too far out to the right: a draw that turns too much.
 const fx = judge(play({bend: 80, difficulty: 'hard'}));
 assert.equal(fx.curve, 'draw');assert.ok(fx.axis < 0);assert.match(strokeWords(fx), /too much/);
});

test('the cell a finish is in: the column by the way it went, the row by how far', () => {
 assert.deepEqual(cellOf(0, .1, 'normal'), {column: 'straight', row: 'low'});
 assert.deepEqual(cellOf(22, .3, 'normal'), {column: 'draw', row: 'normal'});
 assert.deepEqual(cellOf(-22, .6, 'normal'), {column: 'fade', row: 'high'});
 assert.equal(cellOf(10, .3, 'normal').column, null, 'between the columns');
});

test('the finish is where the thumb stopped at the top, not where it slid back to', () => {
 const st = play({bend: 40, release: false});
 // Push by hand: up through the line to 60 px past it, bent right, then slide back down.
 let t = 5000;
 for (let y = 420; y >= 240; y -= 6) strokeMove(st, t += 6, 200 + Math.max(0, 360 - y) * .4, y);
 const top = shapeNow(st).end;
 for (let y = 246; y <= 280; y += 6) strokeMove(st, t += 6, top.x, y);
 const s = shapeNow(st);
 assert.ok(s.end.y <= 246, `the finish stayed at the top (${s.end.y})`);
 assert.ok(s.curve > 15, `and kept its bend (${s.curve})`);
});

test('tempo: rushed goes left and low, lazy comes up short; Easy does not judge it', () => {
 const ideal = idealFor(.6);
 const rushed = judge(play({cross: ideal / 2.2})), lazy = judge(play({cross: ideal * 2.2}));
 assert.ok(rushed.hla < 0 && rushed.vla < 0 && rushed.speed > 1, JSON.stringify(rushed));
 assert.ok(lazy.speed < 1 && lazy.hla > 0, JSON.stringify(lazy));
 assert.match(strokeWords(rushed), /rushed/i);
 assert.match(strokeWords(lazy), /lazy/i);
 const easy = judge(play({cross: ideal / 2.2, difficulty: 'easy'}));
 assert.equal(easy.perfect, true);
 assert.equal(easy.parts.tempo.judged, false, 'Easy reports the tempo but does not judge it');
 // Hard's window is narrower than Normal's.
 const quick = ideal / 1.3;
 assert.ok(judge(play({cross: quick})).parts.tempo.miss > 0);
 assert.ok(judge(play({cross: quick, difficulty: 'hard'})).parts.tempo.miss > judge(play({cross: quick})).parts.tempo.miss);
});

test('the backswing is timed, from the first pull to the top, and not judged', () => {
 const r = play({pull: 120}).result;
 assert.ok(r.back > 250 && r.back < 450, `the 400 ms pull read as ${r.back} ms`);
 assert.equal(r.idealBack, r.idealFull * STROKE.backRatio);
 const slow = play({pull: 120}), fast = judge(slow);
 assert.equal(fast.perfect, true, 'a backswing far off 3:1 costs nothing');
});

test('overswing narrows the tempo window too', () => {
 const ideal = idealFor(1.1);
 const normal = judge(play({pull: FULL * .9, cross: idealFor(.9) / 1.35}));
 const over = judge(play({pull: FULL * (1 + OVERSWING), cross: ideal / 1.35}));
 assert.ok(over.parts.tempo.miss > normal.parts.tempo.miss, `${over.parts.tempo.miss} vs ${normal.parts.tempo.miss}`);
});

test('the tempo gauge: ideal in the middle, quick left, slow right', () => {
 assert.equal(tempoGauge(1, 'normal').at, 0);
 assert.ok(tempoGauge(.7, 'normal').at < 0);
 assert.ok(tempoGauge(1.4, 'normal').at > 0);
 assert.equal(tempoGauge(1.6, 'normal').at, 1, 'the edge of the zone is the end of the band');
 assert.equal(tempoGauge(9, 'normal').at, 1.4, 'and it never runs off the gauge');
 assert.ok(tempoGauge(1, 'hard').perfect > 0);
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
 assert.equal(held.result, null);
 assert.equal(endStroke(held), false, 'a lift before the strike is no stroke');
 const st = startStroke(0, 100, 100, {fullPx: FULL, difficulty: 'normal'});
 for (const [t, y] of [[10, 102], [20, 99], [30, 103], [40, 98]]) assert.equal(strokeMove(st, t, 100, y), 'pull');
 assert.equal(st.result, null);
});

test('the frame rate does not decide: the same stroke at 30 and 120 samples a second', () => {
 const base = play({pull: 140, drift: 12, bend: 20, cross: idealFor(.7) * 1.1, hz: 120}).result;
 for (const phase of [1, 7, 13, 19, 29]) {
  const r = play({pull: 140, drift: 12, bend: 20, cross: idealFor(.7) * 1.1, hz: 30, phase}).result;
  assert.ok(Math.abs(r.share - base.share) < .01, `share ${r.share} vs ${base.share}`);
  assert.ok(Math.abs(r.start - base.start) < .6, `start ${r.start} vs ${base.start}`);
  assert.ok(Math.abs(r.curve - base.curve) < 2, `curve ${r.curve} vs ${base.curve}`);
  assert.ok(Math.abs(r.tempo / base.tempo - 1) < .04, `tempo ${r.tempo} vs ${base.tempo}`);
 }
});

// THE FOLLOW-THROUGH: after the strike the thumb carries on; how far picks the
// height, and the stroke is over once it stops, lifts, or has gone far enough.
function through(follow, {stopFor = 120, lift = false} = {}) {
 const st = startStroke(0, 100, 300, {fullPx: FULL, difficulty: 'normal'});
 let t = 0;
 for (let y = 300; y <= 400; y += 10) strokeMove(st, t += 30, 100, y);
 t += 200;strokeMove(st, t, 100, 400);
 let status = 'pull';
 for (let y = 390; y >= 300 - follow; y -= 10) { status = strokeMove(st, t += 8, 100, y); if (status === 'done') break; }
 return {st, t, status, done: lift ? endStroke(st) : throughDone(st, t + stopFor)};
}
test('the follow-through picks the height: short is Low, on is Normal, far is High', () => {
 assert.equal(heightOf(through(FULL * .1).st), 'low');
 assert.equal(heightOf(through(FULL * .35).st), 'normal');
 assert.equal(heightOf(through(FULL * .6).st), 'high');
 assert.ok(Math.abs(followShare(through(FULL * .35).st) - .35) < .06);
});

test('the follow-through ends when the thumb stops, lifts, runs long, or goes as far as it can', () => {
 const stopped = through(FULL * .3);
 assert.equal(stopped.done, true, 'stopped for longer than the settle');
 assert.ok(Number.isFinite(stopped.st.result.curve), 'and the curve is read at the finish');
 const moving = through(FULL * .3, {stopFor: STROKE.settle / 2});
 assert.equal(moving.done, false, 'not yet: it might carry on');
 assert.equal(through(FULL * .3, {lift: true, stopFor: 0}).done, true, 'a lift ends it');
 const far = through(FULL * 1.2);
 assert.equal(far.status, 'done', 'at the cap there is nothing more to learn');
 const st = through(FULL * .3, {stopFor: 0}).st;st.movedAt = st.crossT + STROKE.throughMax;
 assert.equal(throughDone(st, st.crossT + STROKE.throughMax + 1), true, 'and never waits past throughMax');
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
 assert.equal(judge(along).curve, 'straight');
 // Pushing straight up on that slope sends the ball right, down the slope.
 assert.ok(judge(play({pull, lean})).hla > 0);
});

test('putts judge the line only, on the putting zone', () => {
 const st = play({pull: 80, putt: true, bend: -25, cross: idealFor(.4) / 3});
 const fx = strokeEffect(st.result, strikeZone({difficulty: 'hard', shape: 1, putt: true, power: st.result.share}), {difficulty: 'hard', putt: true});
 assert.equal(fx.parts.tempo, null);
 assert.equal(fx.parts.curve, null);
 assert.equal(fx.curve, 'straight');
 assert.equal(fx.axis, 0);
});

test('the pad fits every screen: the follow-through above the line, overswing below, the width inside the screen', () => {
 for (const [w, h] of [[390, 844], [844, 390], [667, 375], [1280, 720], [1920, 1080], [2560, 1440]]) {
  const g = padSize(w, h);
  assert.ok(g.y0 - STROKE.throughCap * g.fullPx >= PAD.top - 1, `${w}x${h}: room above`);
  assert.ok(g.y0 + (1 + OVERSWING) * g.fullPx <= g.height - PAD.bottom + 1, `${w}x${h}: room below`);
  assert.ok(g.width <= w - PAD.gutter, `${w}x${h}: ${g.width} wide`);
  assert.ok(g.height <= Math.max(PAD.min, h * PAD.share) + 1, `${w}x${h}: ${g.height} tall`);
  assert.ok(g.fullPx >= 100, `${w}x${h}: a full pull of ${g.fullPx} px is long enough to play`);
 }
});

// THE SPIN DOT (swing-meter.js): low on the ball more backspin, high less, the
// sides tilt the axis -- not started the other way to land on the aim.
test('the spin dot: low adds backspin, high takes it off, the sides tilt the axis', () => {
 const c = clubs.wedge, base = shapedLaunch(c, {}), mid = shapedLaunch(c, {dot: {x: 0, y: 0}});
 assert.equal(mid.spin, base.spin);assert.equal(mid.zone, base.zone);assert.equal(mid.side, 0);
 const low = shapedLaunch(c, {dot: {x: 0, y: 1}}), high = shapedLaunch(c, {dot: {x: 0, y: -1}});
 assert.ok(Math.abs(low.spin / base.spin - (1 + SPIN_DOT.more)) < 1e-9);
 assert.ok(Math.abs(high.spin / base.spin - (1 - SPIN_DOT.less)) < 1e-9);
 assert.ok(low.zone < base.zone, 'more spin narrows the allowance');
 const right = shapedLaunch(c, {dot: {x: 1, y: 0}});
 assert.equal(right.side, SPIN_DOT.axis);assert.ok(right.zone < base.zone);
 // A dot outside the ball is brought to its edge.
 assert.ok(Math.abs(Math.hypot(shapedLaunch(c, {dot: {x: 3, y: 4}}).side / SPIN_DOT.axis, 0) - .6) < 1e-9);
 // In the launch: the side spin goes on the axis, and the start line is untouched.
 const ctx = {club: c, short: false, lie: 'fairway', difficulty: 'normal', turf};
 const plain = swingLaunch({power: 1, error: 0}, {...ctx, shape: {}}), side = swingLaunch({power: 1, error: 0}, {...ctx, shape: {dot: {x: 1, y: 0}}});
 assert.equal(side.shot.hla, plain.shot.hla);
 assert.equal(side.shot.spinAxis, plain.shot.spinAxis + SPIN_DOT.axis);
});
