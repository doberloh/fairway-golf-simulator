import test from 'node:test';
import assert from 'node:assert/strict';
import {crossingPoint, backOnLine, lateral, e5, reliefOptions, CLUB_LENGTH, WATER, OUT} from '../src/relief.js';
import {Round} from '../src/game.js';

// A drawn hole, 200 m long, played up the z axis. The pin is at z 200. A
// fairway 30 m wide runs to z 185, a pond of radius 10 sits on it at z 120, the
// green is 12 m round the pin, and everything else is rough. The boundary is a
// box: |x| < 60, -20 < z < 260.
const pin = {x: 0, z: 200};
function hole({pond = {x: 0, z: 120, r: 10}, fairway = true, creek = null} = {}) {
 const surface = (x, z) => {
  if (pond && Math.hypot(x - pond.x, z - pond.z) < pond.r) return 'water';
  if (creek && z > creek[0] && z < creek[1]) return 'water';
  if (Math.hypot(x - pin.x, z - pin.z) < 12) return 'green';
  if (Math.hypot(x - pin.x, z - pin.z) < 14) return 'fringe';
  if (fairway && Math.abs(x) < 15 && z > 0 && z < 185) return 'fairway';
  return 'rough';
 };
 return {surface, out: (x, z) => Math.abs(x) > 60 || z < -20 || z > 260, area: {minX: -60, maxX: 60, minZ: -20, maxZ: 260}};
}
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const line = (a, b, step = 5) => { const n = Math.ceil(d(a, b) / step), out = []; for (let i = 0; i <= n; i++) out.push({x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n}); return out; };

test('the edge is found where the ball last crossed it, to the centimetre, not to the nearest sample', () => {
 const g = hole();
 // Straight up the middle into the pond, sampled every 5 m: it crosses at z 110.
 const cross = crossingPoint(line({x: 0, z: 0}, {x: 0, z: 116}), p => g.surface(p.x, p.z) === 'water');
 assert.ok(Math.abs(cross.z - 110) < 0.01, `crossed at ${cross.z}`);
 // A ball that flies over the pond, lands beyond it and rolls back in crossed
 // the FAR edge last -- that is the one the Rules use.
 const back = crossingPoint([...line({x: 0, z: 0}, {x: 0, z: 135}), ...line({x: 0, z: 135}, {x: 0, z: 125})], p => g.surface(p.x, p.z) === 'water');
 assert.ok(Math.abs(back.z - 130) < 0.01, `crossed at ${back.z}`);
});

test('water offers stroke and distance, back on the line and lateral relief, one stroke each', () => {
 const g = hole(), from = {x: 0, z: 20}, cross = {x: 0, z: 110};
 const opts = reliefOptions(g, {hazard: WATER, from, cross}, pin);
 assert.deepEqual(opts.map(o => o.id), ['stroke', 'line', 'lateral']);
 assert.ok(opts.every(o => o.penalty === 1));
 // Stroke and distance is where the ball was played from.
 assert.deepEqual(opts[0].spot, from);
 // Back on the line: on the line from the hole through the crossing point, on
 // the far side of it, out of the water.
 const l = opts[1].spot;
 assert.ok(Math.abs(l.x) < 1e-6 && l.z < 110 && g.surface(l.x, l.z) !== 'water');
 // Lateral: within two club-lengths of the crossing point, no nearer the hole.
 const s = opts[2].spot;
 assert.ok(d(s, cross) <= 2 * CLUB_LENGTH + 1e-6);
 assert.ok(d(s, pin) >= d(cross, pin) - 1e-6);
 assert.notEqual(g.surface(s.x, s.z), 'water');
});

test('back on the line goes as far back as the golfer asks, and skips water on the way', () => {
 // A creek across the hole, z 100 to 110. A ball that came back into it over
 // the far bank (z 110) must be dropped with that point between it and the
 // hole -- so back across the creek, never in it.
 const g = hole({pond: null, creek: [100, 110]});
 const near = backOnLine(g, {x: 0, z: 110}, pin);
 assert.ok(near.z < 100 && near.z > 99, `dropped at ${near.z}`);
 const further = backOnLine(g, {x: 0, z: 110}, pin, 20);
 assert.ok(Math.abs(further.z - (near.z - 20)) < 0.3, `dropped at ${further.z}`);
 assert.ok(d(further, pin) > d(near, pin) + 19);
});

test('lateral relief never crosses the boundary', () => {
 // The ball crossed into water right on the out-of-bounds line.
 const g = hole({pond: {x: 59, z: 120, r: 6}});
 const s = lateral(g, {x: 53, z: 118}, pin);
 assert.ok(s && !g.out(s.x, s.z));
});

test('out of bounds is stroke and distance under the Rules, with nothing else offered', () => {
 const opts = reliefOptions(hole(), {hazard: OUT, from: {x: 0, z: 20}, cross: {x: 60, z: 100}}, pin);
 assert.deepEqual(opts.map(o => [o.id, o.penalty]), [['stroke', 1]]);
});

test('Local Rule E-5 drops on the nearest fairway no nearer the hole, for two strokes', () => {
 const g = hole(), ref = {x: 59.9, z: 100};
 const opts = reliefOptions(g, {hazard: OUT, from: {x: 0, z: 20}, cross: ref}, pin, {outRule: 'e5'});
 assert.deepEqual(opts.map(o => [o.id, o.penalty]), [['stroke', 1], ['e5', 2]]);
 const s = opts[1].spot;
 assert.equal(g.surface(s.x, s.z), 'fairway');
 assert.ok(d(s, pin) >= d(ref, pin) - 1e-6, 'not nearer the hole than where it went out');
 // The nearest such fairway is the edge on the ball's side, back down the hole.
 assert.ok(s.x > 13 && s.z < 90, `dropped at ${s.x.toFixed(1)}, ${s.z.toFixed(1)}`);
 // E-5 is never an option for water, whatever the round's rule.
 assert.ok(!reliefOptions(g, {hazard: WATER, from: {x: 0, z: 20}, cross: {x: 0, z: 110}}, pin, {outRule: 'e5'}).some(o => o.id === 'e5'));
 // With no fairway on the hole there is no fairway reference point. The fringe
 // is cut lower than fairway height and counts -- but only where it is no
 // nearer the hole than the ball: from out wide at z 100 it is all nearer.
 const bare = hole({fairway: false});
 assert.equal(e5(bare, ref, pin), null);
 // A ball that went out 13.5 m from the hole -- inside the fringe's outer
 // edge, which runs 12 to 14 m out -- has fringe no nearer the hole than it,
 // and the fringe is the fairway reference.
 const behindGreen = e5(bare, {x: 0, z: 213.5}, pin);
 assert.ok(behindGreen && bare.surface(behindGreen.x, behindGreen.z) === 'fringe', 'the fringe counts as fairway');
 // Only THIS hole's fairway counts. A neighbouring hole's fairway beside the
 // boundary is nearer the ball, and is passed over for this hole's own.
 const shared = {...g, surface: (x, z) => x > 40 && x < 58 ? 'fairway' : g.surface(x, z), ownFairway: (x, z) => Math.abs(x) < 15};
 const own = e5(shared, ref, pin);
 assert.ok(own && Math.abs(own.x) < 15, `dropped at x ${own?.x}`);
 // However far the boundary is from the fairway, the fairway is still found.
 // A long fairway from z -600: the ball crossed the boundary at (270, -100), so
 // the qualifying fairway starts about 275 m away -- beyond the 250 m the first
 // version searched before giving up.
 const long = {surface: (x, z) => Math.hypot(x, z - 200) < 12 ? 'green' : Math.abs(x) < 15 && z > -600 && z < 185 ? 'fairway' : 'rough',
  out: (x, z) => Math.abs(x) > 270 || z < -620 || z > 260, area: {minX: -270, maxX: 270, minZ: -620, maxZ: 260}};
 const far = e5(long, {x: 269.9, z: -100}, pin);
 assert.ok(far && d(far, {x: 269.9, z: -100}) > 250, 'found a fairway more than 250 m away');
 assert.ok(d(far, pin) >= d({x: 269.9, z: -100}, pin) - 1e-6);
 // And when every fairway is nearer the hole than where the ball went out,
 // there is no fairway reference point at all: E-5 is not available and only
 // stroke and distance is offered.
 const behind = reliefOptions(g, {hazard: OUT, from: {x: 0, z: 20}, cross: {x: 59.9, z: -19}}, pin, {outRule: 'e5'});
 assert.deepEqual(behind.map(o => o.id), ['stroke']);
});

// ---- the round ------------------------------------------------------------
const P = [{name: 'A', team: 'A'}, {name: 'B', team: 'B'}];
const water = {end: {x: 0, z: 115}, hazard: WATER, cross: {x: 0, z: 110}};
const out = {end: {x: 61, z: 100}, hazard: OUT, cross: {x: 60, z: 100}};
const fairwayShot = z => ({end: {x: 0, z}, hazard: null, holed: false});

test('a ball in trouble waits for relief: one stroke now, the penalty when the choice is made', () => {
 const r = new Round({players: [P[0]]});
 r.takeShot(water, pin);
 assert.equal(r.strokes[0], 1);
 assert.ok(r.relief && r.relief.hazard === WATER);
 // Nothing else can happen until relief is taken.
 assert.throws(() => r.takeShot(fairwayShot(50), pin), /relief/);
 assert.throws(() => r.simDrop({x: 0, z: 50}), /relief/);
 // Two strokes is only for out of bounds.
 assert.throws(() => r.takeRelief({spot: {x: 2, z: 108}, penalty: 2}, pin), /out of bounds/);
 r.takeRelief({spot: {x: 2, z: 108}, penalty: 1}, pin);
 assert.equal(r.strokes[0], 2);
 assert.deepEqual(r.position, {x: 2, z: 108});
 assert.equal(r.relief, null);
 assert.equal(r.active, 0);
});

test('out of bounds under Local Rule E-5 costs two, so the next shot is the fourth', () => {
 const r = new Round({players: [P[0]], outOfBounds: 'e5'});
 r.takeShot(out, pin);
 r.takeRelief({spot: {x: 14, z: 85}, penalty: 2}, pin);
 assert.equal(r.strokes[0], 3);
 assert.equal(r.stroke, 4);
 assert.throws(() => new Round({outOfBounds: 'anything'}), /out-of-bounds/);
});

test('relief survives a reload, and a mulligan takes back the shot and the relief together', () => {
 const r = new Round({players: [P[0]], outOfBounds: 'e5'});
 r.takeShot(fairwayShot(30), pin);
 r.takeShot(water, pin);
 const back = Round.restore(JSON.parse(JSON.stringify(r)));
 assert.equal(back.outOfBounds, 'e5');
 assert.deepEqual(back.relief.cross, water.cross);
 assert.deepEqual(back.relief.from, {x: 0, z: 30});
 back.takeRelief({spot: {x: 0, z: 30}, penalty: 1}, pin);
 assert.ok(back.mulligan());
 assert.equal(back.relief, null);
 assert.equal(back.strokes[0], 1);
 assert.deepEqual(back.position, {x: 0, z: 30});
 // A damaged relief record is refused rather than guessed at.
 const bad = JSON.parse(JSON.stringify(r)); bad.relief.from = null;
 assert.throws(() => Round.restore(bad), /relief/);
});

test('in match play the farthest ball goes next once the relief is taken', () => {
 const r = new Round({players: P, mode: 'match'});
 r.takeShot(fairwayShot(150), pin);          // A, 50 m out
 r.takeShot(water, pin);                     // B into the pond
 r.takeRelief({spot: {x: 0, z: 100}, penalty: 1}, pin); // B drops 100 m out
 assert.equal(r.active, 1, 'B is farther, so B plays');
 r.takeShot(fairwayShot(190), pin);          // B to 10 m
 assert.equal(r.active, 0);
});

test('in a scramble the relief ball is one of the team\'s choices and carries its penalty', () => {
 const team = [{name: 'A', team: 'A'}, {name: 'B', team: 'A'}];
 const r = new Round({players: team, mode: 'scramble'});
 r.takeShot(water, pin);
 assert.equal(r.candidates.length, 0, 'not a candidate until relief is taken');
 r.takeRelief({spot: {x: 2, z: 108}, penalty: 1}, pin);
 assert.equal(r.candidates[0].penalty, 1);
 assert.equal(r.active, 1);
 r.takeShot(fairwayShot(60), pin);
 assert.ok(r.scrambleSelection);
 r.chooseScramble(0);                        // the dropped ball: the shot plus its penalty
 assert.equal(r.scrambleShots.A, 2);
 assert.deepEqual(r.positions[1], {x: 2, z: 108});
});

test('a golfer waiting for relief keeps the choice through a change of group, and takes it with them if they leave', () => {
 const r = new Round({players: [{name: 'A', team: 'A'}, {name: 'B', team: 'A'}]});
 r.takeShot(fairwayShot(30), pin);
 r.takeShot(fairwayShot(60), pin);
 // A is still up in stroke play; A goes in the water.
 r.takeShot(water, pin);
 r.setPlayers([{name: 'C', team: 'A'}, {name: 'A', team: 'A', seat: 0}], {blue: {x: 0, z: 0}});
 assert.equal(r.relief.player, 1);
 r.setPlayers([{name: 'C', team: 'A', seat: 0}], {blue: {x: 0, z: 0}});
 assert.equal(r.relief, null);
});

test('relief scores the same under every putting mode, and in an endless run', () => {
 for (const mode of ['holeout', 'dartboard', 'decimal']) {
  for (const endless of [false, true]) {
   const r = new Round({players: [P[0]], putting: {mode}, endless, seed: endless ? 'RUN-1' : ''});
   r.takeShot(water, pin);
   r.takeRelief({spot: {x: 0, z: 100}, penalty: 1}, pin);
   assert.equal(r.strokes[0], 2, `${mode}${endless ? ', endless' : ''}`);
   assert.equal(r.puttStrokes[0], 0);
   assert.equal(r.holeComplete, false);
  }
 }
});
