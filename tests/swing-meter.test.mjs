// The Swing Meter (swing-meter.js): three taps into the numbers the ball leaves
// with. RESEARCH.md *The Swing Meter* says which numbers are placed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, YARD, MPH} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';
import {bagClubs, CLUB_KINDS, stockBag, spinForPower} from '../src/clubs.js';
import {startSwing, tap, advance, markerAt, swingLaunch, shapedLaunch, strikeZone, strikeEffect, fullCarry,
 speedForCarry, carryShare, lieFactor, LIE_SPEED, DIFFICULTIES, OVERSWING, OVERSWING_CARRY, MISS_AT, RUN_UP,
 swingZoom, SWING_RANGES, longestReach,
 validShape, shortGame, heightName, puttFullRoll, SPIN_STEPS} from '../src/swing-meter.js';

const clubs = bagClubs(stockBag());
const turf = turfConfig({});
const ctx = (club, extra = {}) => ({club: clubs[club], shape: {}, short: false, lie: 'fairway', difficulty: 'normal', turf, ...extra});
// A swing with taps at given shares of the rise time after the start.
function swingAt(club, powerShare, strikeAfter, {difficulty = 'normal', putt = false, accuracy = !putt} = {}) {
 // Starting the swing IS the first tap.
 const sw = startSwing(0, {difficulty, club: clubs[club], putt, accuracy});
 // The marker starts at the far left: the distance is RUN_UP + share rises in.
 tap(sw, sw.rise * (RUN_UP + powerShare));
 if (strikeAfter != null) tap(sw, sw.rise * (RUN_UP + powerShare) + sw.rise * strikeAfter);
 return sw;
}
const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 5000, minZ: -5000, maxZ: 5000}, trees: [], homes: []};
const fly = shot => simulateShot({origin: {x: 0, z: 0}, aim: 0, ...shot}, flat);

test('the lie table is one rule: semi 96%, rough 90%, sand 80%, everything else full', () => {
 assert.deepEqual(LIE_SPEED, {semi: .96, rough: .9, sand: .8});
 for (const s of ['tee', 'fairway', 'fringe', 'green']) assert.equal(lieFactor(s), 1, s);
 assert.equal(lieFactor('sand'), .8, 'sand was softened from 72% to 80% on 14 October 2026');
});

test('a tap is judged on its time: the marker is a function of the clock alone', () => {
 const sw = startSwing(1000, {difficulty: 'normal', club: clubs.iron7});
 // Asking where the marker is at a frame rate of 20, 60 or 144 changes nothing.
 for (const fps of [20, 60, 144]) {
  const s2 = startSwing(1000, {difficulty: 'normal', club: clubs.iron7});
  for (let t = 1000; t < 1000 + s2.rise * (RUN_UP + .6); t += 1000 / fps) advance(s2, t);
  assert.ok(Math.abs(markerAt(s2, 1000 + sw.rise * (RUN_UP + .6)) - .6) < 1e-9);
 }
 // Same three tap times, same shot, whatever happened in between.
 const a = swingAt('iron7', .8, .8), b = startSwing(0, {difficulty: 'normal', club: clubs.iron7});
 const p = b.rise * (RUN_UP + .8);
 for (let t = 0; t < p; t += 7) advance(b, t);
 tap(b, p);for (let t = p; t < p + b.rise * .8; t += 33) advance(b, t);
 tap(b, p + b.rise * .8);
 assert.deepEqual(swingLaunch(a, ctx('iron7')).shot, swingLaunch(b, ctx('iron7')).shot);
});

test('the bar is in yards: a full clean swing carries the bag, half the bar half of it', () => {
 for (const id of ['driver', 'iron7', 'wedge']) {
  const c = clubs[id];
  const full = swingLaunch(swingAt(id, 1, 1), ctx(id));
  assert.ok(full.strike.perfect, 'tapped dead on the strike line is perfect');
  const r = fly(full.shot);
  assert.ok(Math.abs(r.carry / YARD - c.carry) < 1.5, `${id} full swing carried ${r.carry / YARD} not ${c.carry}`);
  const half = fly(swingLaunch(swingAt(id, .5, .5), ctx(id)).shot);
  assert.ok(Math.abs(half.carry / YARD - c.carry / 2) < 1.5, `${id} half the bar carried ${half.carry / YARD}`);
 }
});

test('overswing is worth up to 5% more carry, and nothing further', () => {
 assert.equal(carryShare(1), 1);
 assert.equal(carryShare(1 + OVERSWING), 1 + OVERSWING_CARRY);
 assert.equal(carryShare(1 + OVERSWING * 4), 1 + OVERSWING_CARRY);
 const c = clubs.iron7, l = shapedLaunch(c, {});
 const over = fly({speed: speedForCarry(c, l, 1.05 * fullCarry(c, l)), vla: l.vla, hla: 0, spin: l.spin, spinAxis: 0});
 assert.ok(over.carry / YARD > c.carry * 1.03 && over.carry / YARD < c.carry * 1.07);
});

// The owner's call (14 October 2026): past the full line the marker slows to a
// quarter speed, and at the end of overswing it holds, flashing, for the tap.
test('overswing: a quarter of the speed, then it holds at the end until the second tap', async () => {
 const {OVERSWING_SLOW, inOverswing} = await import('../src/swing-meter.js');
 assert.equal(OVERSWING_SLOW, 4);
 const sw = startSwing(0, {difficulty: 'normal', club: clubs.iron7});
 assert.ok(!inOverswing(sw, sw.rise * (RUN_UP + .99)));
 assert.ok(Math.abs(markerAt(sw, sw.rise * (RUN_UP + 1.2)) - (1 + .2 / OVERSWING_SLOW)) < 1e-9, 'slow past the full line');
 assert.ok(inOverswing(sw, sw.rise * (RUN_UP + 1.2)));
 // Long after the zone would have run out at full speed, it is still holding.
 const later = sw.rise * (RUN_UP + 1 + OVERSWING * OVERSWING_SLOW) + 5000;
 advance(sw, later);
 assert.equal(sw.power, null, 'no tap, no distance: it waits');
 assert.equal(markerAt(sw, later), 1 + OVERSWING, 'held at the end of overswing');
 tap(sw, later);
 assert.equal(sw.power, 1 + OVERSWING);
 assert.equal(sw.done, false, 'still waiting for the strike');
 // And it comes back at the normal speed.
 assert.ok(Math.abs(markerAt(sw, later + sw.rise * .5) - (1 + OVERSWING - .5)) < 1e-9);
});

test('no third tap: the marker runs out and it is the worst miss there is', () => {
 const sw = swingAt('iron7', .9, null);
 advance(sw, sw.rise * (RUN_UP + .9) + sw.rise * (.9 - MISS_AT) + 1);
 assert.ok(sw.done && sw.duff);
 const out = swingLaunch(sw, ctx('iron7'));
 assert.ok(out.strike.miss >= 5 && out.shot.hla < 0, 'a smothered hook, left');
});

test('early goes right and late goes left, for everyone', () => {
 const early = swingLaunch(swingAt('iron7', 1, .9), ctx('iron7'));   // stopped short of the line
 const late = swingLaunch(swingAt('iron7', 1, 1.1), ctx('iron7'));   // past it
 assert.ok(early.shot.hla > 0 && early.shot.spinAxis > 0, 'early: starts right and fades');
 assert.ok(late.shot.hla < 0 && late.shot.spinAxis < 0, 'late: starts left and draws');
 assert.ok(fly(early.shot).end.x < 0, 'early finishes right of the line (local -x)');
 assert.ok(fly(late.shot).end.x > 0, 'late finishes left of the line');
});

test('the strike zone: harder difficulty, rough, sand, spin and overswing all narrow it', () => {
 const z = o => strikeZone({difficulty: 'normal', ...o}).zone;
 assert.ok(strikeZone({difficulty: 'hard'}).zone < z({}) && z({}) < strikeZone({difficulty: 'easy'}).zone);
 assert.ok(z({lie: 'rough'}) < z({}) && z({lie: 'sand'}) < z({lie: 'rough'}));
 assert.ok(z({power: 1 + OVERSWING}) < z({power: 1}));
 assert.ok(z({power: .3}) > z({power: 1}), 'a chip is about distance, not accuracy');
 let last = Infinity;
 for (const spin of [0, 1, 2, 3]) {
  const w = z({shape: shapedLaunch(clubs.wedge, {spin}).zone});
  assert.ok(w < last || spin === 0, `spin +${spin} did not narrow the zone`);last = w;
 }
 // Every difficulty keeps the perfect band inside the zone.
 for (const d of Object.keys(DIFFICULTIES)) { const s = strikeZone({difficulty: d}); assert.ok(s.perfect < s.zone); }
});

test('inside the perfect band the ball goes where it was aimed', () => {
 const zones = strikeZone({difficulty: 'normal'});
 assert.deepEqual(strikeEffect(zones.perfect * .9, zones), {hla: 0, axis: 0, speed: 1, miss: 0, perfect: true});
 const edge = strikeEffect(zones.zone, zones);
 assert.ok(Math.abs(edge.hla - 1.25) < 1e-9 && Math.abs(edge.axis - 5) < 1e-9);
});

test('the lie comes off the swing: rough keeps 90% of the ball speed', () => {
 const clean = swingLaunch(swingAt('iron7', 1, 1), ctx('iron7'));
 const rough = swingLaunch(swingAt('iron7', 1, 1), ctx('iron7', {lie: 'rough'}));
 assert.ok(Math.abs(rough.shot.speed - clean.shot.speed * .9) < 1e-9);
 assert.equal(rough.before, clean.shot.speed, 'the speed before the lie is kept for the red note');
});

test('curve and height are separate choices, and a curve still lands on the line', () => {
 const c = clubs.iron7;
 for (const height of ['low', 'normal', 'high']) for (const curve of ['draw', 'fade']) {
  const out = swingLaunch(swingAt('iron7', 1, 1), ctx('iron7', {shape: {curve, height}}));
  const r = fly(out.shot);
  assert.ok(Math.abs(r.end.x) < 6, `${height} ${curve} finished ${r.end.x.toFixed(1)} m off the line`);
  assert.ok(curve === 'fade' ? out.shot.spinAxis > 0 : out.shot.spinAxis < 0);
 }
 const low = fly(swingLaunch(swingAt('iron7', 1, 1), ctx('iron7', {shape: {height: 'low'}})).shot);
 const high = fly(swingLaunch(swingAt('iron7', 1, 1), ctx('iron7', {shape: {height: 'high'}})).shot);
 assert.ok(high.apex > low.apex + 3, 'high flies higher than low');
 // Near the green a wedge's Low and High are Bump & run and Flop.
 assert.ok(shortGame(clubs.wedge, 40) && !shortGame(clubs.iron7, 40) && !shortGame(clubs.wedge, 90));
 assert.equal(heightName('low', true), 'Bump & run');assert.equal(heightName('high', true), 'Flop');
 assert.ok(shapedLaunch(clubs.iron7, {height: 'low'}, {short: false}).vla > shapedLaunch(clubs.wedge, {height: 'low'}, {short: true}).vla * .5);
 assert.deepEqual(validShape({curve: 'banana', spin: 7}), {curve: 'straight', height: 'normal', spin: 0});
});

test('the spin dial: -1 to +3, each added step more spin than the last', () => {
 assert.deepEqual(SPIN_STEPS, [-1, 0, 1, 2, 3]);
 let last = 0;
 for (const spin of SPIN_STEPS) { const s = shapedLaunch(clubs.wedge, {spin}).spin; assert.ok(s > last);last = s; }
});

// THE OWNER'S RULE: with no spin added, a ball never spins back. Swept on level
// ground and a 2% rise into the landing (steeper than that, gravity rolls any
// ball back whatever its spin, which is the course and not the strike), at the
// softest firmness, where a ball grips hardest, for every short club and height
// at a full swing and at full overswing. The full sweep across every club,
// power and firmness is in RESEARCH.md *The Swing Meter*; this is the corner of
// it where a come-back was ever found.
test('with the club\'s own spin, nothing spins back', () => {
 const soft = turfConfig({firmness: 'Soft'});
 const bag = ['iron8', 'iron9', 'wedge', 'gap', 'sand', 'lob'];
 const all = bagClubs([...bag.map(k => ({id: 'c' + k, name: k, kind: k, carry: CLUB_KINDS[k].carry})), {id: 'putter', name: 'Putter', kind: 'putter', carry: 30}]);
 const green = g => ({height: (x, z) => z * g, surface: () => 'green', pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
 for (const club of Object.values(all)) {
  if (club.code === 'PT') continue;
  for (const [height, short] of [['low', false], ['normal', false], ['high', false], ['low', true], ['high', true]]) {
   if (short && !['wedge', 'gap', 'sand', 'lob'].includes(club.kind)) continue;
   const l = shapedLaunch(club, {height, spin: 0}, {short});
   for (const share of [1, 1 + OVERSWING_CARRY]) {
    const speed = speedForCarry(club, l, share * fullCarry(club, l));
    for (const g of [0, .02]) {
     const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, speed, vla: l.vla, hla: 0, spin: l.spin * spinForPower(Math.min(1.2, speed / club.speed)), spinAxis: 0}, green(g), {turf: soft});
     assert.ok(r.total >= r.carry - .05 * YARD, `${club.kind} ${height}${short ? ' (short)' : ''} at ${share} on a ${g * 100}% rise came back ${((r.carry - r.total) / YARD).toFixed(2)} yd`);
    }
   }
  }
 }
});

test('a putt: two taps on every difficulty, the bar in roll on a flat green at today\'s Stimp', async () => {
 const p = clubs.putter;
 const full = puttFullRoll(p, turf);
 assert.ok(Math.abs(full / YARD - p.carry) < .5, 'full is the putter\'s own roll at Stimp 10');
 const sw = startSwing(0, {difficulty: 'normal', club: p, putt: true, accuracy: false});
 tap(sw, sw.rise * (RUN_UP + .5));
 assert.ok(sw.done, 'two taps');
 const out = swingLaunch(sw, ctx('putter'));
 assert.equal(out.shot.hla, 0);
 const roll = simulateShot({origin: {x: 0, z: 0}, aim: 0, vla: 0, spin: 0, spinAxis: 0, ...out.shot}, {...flat, surface: () => 'green'}, {turf});
 assert.ok(Math.abs(roll.total - full / 2) < .4, `half the bar rolled ${roll.total.toFixed(2)} m, not ${(full / 2).toFixed(2)}`);
 const {puttAccuracy} = await import('../src/swing-meter.js');
 for (const d of Object.keys(DIFFICULTIES)) assert.equal(puttAccuracy(d), false, `${d} has no accuracy tap on a putt`);
});

// THE OWNER'S RULE FOR MONITOR SHOTS (14 October 2026): the lie costs a monitor
// shot the same ball speed it costs a Swing Meter one, the measured number is
// shown and recorded as sent with the penalty beside it in red, and the round
// can switch it off.
test('a monitor shot from the rough flies at 90% of its measured ball speed, and nothing else moves', async () => {
 const {monitorLie} = await import('../src/swing-meter.js');
 const {shotGrid, liePenaltyNote, shownSpeed} = await import('../src/shot-data.js');
 const measured = {speed: 120 * MPH, vla: 18, hla: -1.5, spin: 6200, spinAxis: 4, extra: {clubSpeed: 85}};
 const {launch, lie} = monitorLie(measured, 'rough');
 assert.ok(Math.abs(launch.speed - measured.speed * .9) < 1e-9);
 for (const k of ['vla', 'hla', 'spin', 'spinAxis', 'extra']) assert.deepEqual(launch[k], measured[k], `${k} was changed`);
 assert.equal(measured.speed, 120 * MPH, 'the measured shot itself is untouched');
 assert.deepEqual(lie, {surface: 'rough', factor: .9, before: measured.speed, measured: true});
 // The tile shows what the monitor sent, with the penalty beside it.
 const record = {shot: {...launch, lie}, result: {carry: 140 * YARD, total: 150 * YARD}};
 assert.ok(Math.abs(shownSpeed(record) - measured.speed) < 1e-9, 'the tile shows the measured speed');
 assert.equal(liePenaltyNote(record), '−12.0 rough');
 const cells = Object.fromEntries(shotGrid(record, {fields: ['ballSpeed', 'carry', 'launch'], columns: 0}).cells.map(c => [c.id, c]));
 assert.equal(cells.ballSpeed.value, '120.0');assert.equal(cells.ballSpeed.note, '−12.0 rough');
 assert.equal(cells.carry.note, 'rough', 'carry already carries the penalty, and says so');
 assert.equal(cells.launch.note, undefined, 'a number the lie did not touch gets no note');
 // Fairway, tee and green: played exactly as sent.
 for (const s of ['fairway', 'tee', 'green']) { const o = monitorLie(measured, s); assert.equal(o.launch, measured);assert.equal(o.lie, null); }
 // The range is the mat; the switch turned off plays it as measured but still
 // says where it lay.
 assert.equal(monitorLie(measured, 'sand', {range: true}).launch, measured);
 const off = monitorLie(measured, 'sand', {on: false});
 assert.equal(off.launch, measured);assert.equal(off.lie.factor, 1);assert.equal(liePenaltyNote({shot: {...off.launch, lie: off.lie}}), null);
 // Sand keeps 80%.
 assert.ok(Math.abs(monitorLie(measured, 'sand').launch.speed - measured.speed * .8) < 1e-9);
});

test('the putting bar zooms to the putt, and the putter is unchanged', async () => {
 const {puttRange, PUTT_RANGES} = await import('../src/swing-meter.js');
 const p = clubs.putter, full = puttFullRoll(p, turf);
 assert.deepEqual(PUTT_RANGES, [.25, .5, 1, 1.5, 2, 3, 4, 6]);
 assert.equal(puttRange(p, turf, 3 * YARD), full / 4, 'a nine-foot putt gets the shortest bar');
 assert.equal(puttRange(p, turf, full * .35), full / 2);
 assert.equal(puttRange(p, turf, full * .75), full, 'a long one gets the whole roll');
 assert.equal(puttRange(p, turf, full * .9), full * 1.5, 'and one past it reaches on beyond the putter roll');
 // ACROSS ANY GREEN: 80 yd, the widest a course grows, on the slowest Stimp.
 const slow = turfConfig({stimp: 6}), across = 80 * YARD;
 const range80 = puttRange(p, slow, across);
 assert.ok(range80 >= across * 1.25, 'an 80 yd putt at Stimp 6 fits on the bar');
 const sw80 = startSwing(0, {difficulty: 'normal', club: p, putt: true, accuracy: false});
 tap(sw80, sw80.rise * (RUN_UP + across / range80));
 const out80 = swingLaunch(sw80, {...ctx('putter'), turf: slow, puttRange: range80});
 const r80 = simulateShot({origin: {x: 0, z: 0}, aim: 0, vla: 0, spin: 0, spinAxis: 0, ...out80.shot}, {...flat, surface: () => 'green'}, {turf: slow});
 assert.ok(Math.abs(r80.total - across) < 2, `the 80 yd putt rolled ${(r80.total / YARD).toFixed(1)} yd`);
 // Half of a quarter bar rolls an eighth of the putter's full roll.
 const sw = startSwing(0, {difficulty: 'normal', club: p, putt: true, accuracy: false});
 tap(sw, sw.rise * (RUN_UP + .5));
 const out = swingLaunch(sw, ctx('putter', {puttRange: full / 4}));
 const roll = simulateShot({origin: {x: 0, z: 0}, aim: 0, vla: 0, spin: 0, spinAxis: 0, ...out.shot}, {...flat, surface: () => 'green'}, {turf});
 assert.ok(Math.abs(roll.total - full / 8) < .25, `rolled ${roll.total.toFixed(2)} m, not ${(full / 8).toFixed(2)}`);
});

// PHASE 2, THE TARGET MARKER: the stop on the bar that lands the ball in the
// circle. Slope and lie always; wind only on Easy (the owner's call).
test('the target marker: level ground and still air is the circle\'s share of the carry', async () => {
 const {targetShare} = await import('../src/swing-meter.js');
 const c = clubs.iron7;
 for (const yards of [60, 100, 140]) {
  const t = targetShare({club: c, shape: {}, lie: 'fairway', difficulty: 'normal', metres: yards * YARD});
  assert.ok(!t.out && Math.abs(t.share - yards / c.carry) < .02, `${yards} yd: ${t.share.toFixed(3)} not ${(yards / c.carry).toFixed(3)}`);
  // And stopping the meter there carries about that far.
  const sw = startSwing(0, {difficulty: 'normal', club: c});tap(sw, sw.rise * (RUN_UP + t.share));tap(sw, sw.rise * (RUN_UP + t.share * 2));
  const r = fly(swingLaunch(sw, ctx('iron7')).shot);
  assert.ok(Math.abs(r.carry / YARD - yards) < 2, `${yards} yd target carried ${(r.carry / YARD).toFixed(1)}`);
 }
});

test('the target marker allows for slope and lie always, and wind only on Easy', async () => {
 const {targetShare} = await import('../src/swing-meter.js');
 const base = {club: clubs.iron7, shape: {}, lie: 'fairway', difficulty: 'normal', metres: 130 * YARD};
 const flat = targetShare(base).share;
 assert.ok(targetShare({...base, rise: 10}).share > flat + .02, 'uphill asks for more');
 assert.ok(targetShare({...base, rise: -10}).share < flat - .02, 'downhill asks for less');
 assert.ok(targetShare({...base, lie: 'rough'}).share > flat + .05, 'rough asks for more');
 const into = [0, 0, -8];   // 8 m/s straight into the golfer, aim down +z
 assert.equal(targetShare({...base, wind: into}).share, flat, 'Normal leaves the wind to the golfer');
 assert.equal(targetShare({...base, difficulty: 'hard', wind: into}).share, flat, 'so does Hard');
 assert.ok(targetShare({...base, difficulty: 'easy', wind: into}).share > flat + .05, 'Easy allows for it');
 // Out of reach: the full line, flagged, never the overswing zone.
 const far = targetShare({...base, metres: 200 * YARD});
 assert.deepEqual(far, {share: 1, out: true});
 assert.equal(targetShare({...base, club: clubs.putter}), null, 'a putt is worked out from its read line instead');
});

// SHORT SHOTS (the owner's call, 14 October 2026): the sweep starts from the far
// left, the bar zooms to a half or quarter swing, and a zoomed bar runs slower.
test('the sweep starts from the far left, and a tap in the run-up is ignored', () => {
 assert.equal(RUN_UP, -MISS_AT);
 const sw = startSwing(0, {difficulty: 'normal', club: clubs.iron7});
 assert.equal(markerAt(sw, 0), MISS_AT, 'it starts at the left edge of the bar');
 assert.ok(Math.abs(markerAt(sw, sw.rise * RUN_UP)) < 1e-9, 'and reaches the strike line after the run-up');
 assert.equal(tap(sw, sw.rise * RUN_UP * .5), null, 'a tap before the strike line is not a swing');
 assert.equal(sw.power, null);
 assert.equal(tap(sw, sw.rise * (RUN_UP + .4)), 'power');
 assert.ok(Math.abs(sw.power - .4) < 1e-9);
});

test('a short full shot zooms the bar to a half or quarter swing, and carries what the bar says', () => {
 assert.deepEqual(SWING_RANGES, [.25, .5, 1]);
 const c = clubs.wedge, full = fullCarry(c, shapedLaunch(c, {}));
 assert.equal(swingZoom(full, full * .9), 1);
 assert.equal(swingZoom(full, full * .35), .5);
 assert.equal(swingZoom(full, full * .15), .25);
 // An 18 yd chip with a 100 yd wedge: a quarter-swing bar, stopped at its share.
 const yards = 18, zoom = swingZoom(full, yards * YARD), share = yards * YARD / (full * zoom);
 assert.equal(zoom, .25);
 assert.ok(share > .6 && share < .8, 'an 18 yd chip is most of a quarter-swing bar, not a sliver of a full one');
 const sw = startSwing(0, {difficulty: 'normal', club: c, zoom});
 tap(sw, sw.rise * (RUN_UP + share));tap(sw, sw.rise * (RUN_UP + share * 2));
 const r = fly(swingLaunch(sw, {...ctx('wedge'), zoom}).shot);
 assert.ok(Math.abs(r.carry / YARD - yards) < 1.5, `carried ${(r.carry / YARD).toFixed(1)} yd, not ${yards}`);
 // Slower on a zoomed bar.
 const fullBar = startSwing(0, {difficulty: 'normal', club: c}), half = startSwing(0, {difficulty: 'normal', club: c, zoom: .5}), quarter = startSwing(0, {difficulty: 'normal', club: c, zoom: .25});
 assert.ok(quarter.rise > half.rise && half.rise > fullBar.rise);
 // The chip's wider strike zone follows the share of the club, not of the bar.
 assert.ok(strikeZone({difficulty: 'normal', power: .9, share: .9 * .25}).zone > strikeZone({difficulty: 'normal', power: .9}).zone);
});

test('a turn never starts aimed beyond the club: the longest aim that fits (UI/UX pass V2)', () => {
 // A club that carries 200 m: an aim at a pin 260 m away comes back near 200.
 const fits = m => m <= 200;
 const r = longestReach(fits, 260);
 assert.ok(r <= 200 && r > 199.5, String(r));
 // An aim it reaches is left as it is.
 assert.equal(longestReach(fits, 150), 150);
 // Nothing fits, not even the floor: no answer, and the turn keeps its aim
 // (audit 4 found it 5 m in front of the tee).
 assert.equal(longestReach(() => false, 260, {floor: 5}), null);
 // Only the shortest aims fit: the longest of them.
 const near = longestReach(m => m <= 20, 260);
 assert.ok(near > 19.5 && near <= 20, String(near));
});
