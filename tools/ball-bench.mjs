// THE BALL BENCH. The ball model scored against real measurements: what a golf
// ball has been MEASURED to do in the air, landing on a green, chipping,
// running down a fairway, rolling on a putting surface and meeting the hole.
//
//   node tools/ball-bench.mjs                    every section, with a scorecard
//   node tools/ball-bench.mjs --only greens,cup  some sections
//   node tools/ball-bench.mjs --list             the sections
//   node tools/ball-bench.mjs --json out.json    every check as data
//   node tools/ball-bench.mjs --set green.mu=.5,.3,.2 --set ROLL.power=.4
//        the same with a constant changed for this run (nothing is written):
//        <surface>.<column> in turf.js's table, ROLL.*, CUP.*, AERO.*, TILT.*, SEVERITY.*
//   node tools/ball-bench.mjs --shot 120,16.3,7097[,surface[,slope%]]
//        one shot (mph, launch deg, rpm), hop by hop, on each firmness
//   node tools/ball-bench.mjs --land 22,51,9100[,surface[,slope%]]
//        the same from landing conditions (m/s, descent deg, rpm)
//
// Every target names its source. A range is what the measurements allow, not a
// wish: where the evidence is one regression on one green, the range is wide
// and says so. docs/BALL_PHYSICS.md has the sources in full; a check marked
// PLACED is a judgement, not a measurement.
//
// Exit code 1 if any check fails, so it can gate a change.
import fs from 'node:fs';
import {simulateShot, MPH, YARD} from '../src/physics.js';
import {bounce, TILT, SEVERITY} from '../src/bounce.js';
import {turfOf, SURFACE_TABLE, ROLL, clearTurfCache, struckDistance, launchForDistance, rollDecelerationAt, FOOT} from '../src/turf.js';
import {flyBall, AERO} from '../src/aero.js';
import {NORMALISED, DRIVER_CHART, TOUR, USGA_EXAMPLE} from './flight-targets.mjs';
import {captureSpeed, rollAtCup, CUP, CUP_RADIUS} from '../src/cup.js';

const argv = process.argv.slice(2);
const opts = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const opt = k => opts(k)[0] ?? null;
const R = 0.021335, RAD = Math.PI / 180, INCH = .0254;

// ---- constants changed for this run ------------------------------------------
for (const kv of opts('--set')) {
 const [path, raw] = kv.split('='), [head, key] = path.split('.');
 const val = raw.split(',').map(Number);
 const target = {ROLL, CUP, AERO, TILT, SEVERITY}[head] ?? SURFACE_TABLE[head];
 if (!target || !(key in target)) { console.error(`--set: no such constant ${path}`); process.exit(2); }
 target[key] = val.length === 1 ? val[0] : val;
}
clearTurfCache();

// ---- ground and shots --------------------------------------------------------
// A plane of one surface: `slope` is rise per metre along the shot (+ uphill),
// `side` rise per metre toward the player's left (+x).
export const plane = (surface, slope = 0, side = 0) => ({
 height: (x, z) => slope * z + side * x, surface: () => surface,
 bounds: {x: 1e5, minZ: -1e5, maxZ: 1e5}, trees: [],
});
const FIRMS = ['soft', 'medium', 'firm'];
const cond = (firm, stimp = 10) => ({stimp, greenFirmness: firm, courseFirmness: firm});

// What happened after the ball first touched down: each hop's length and
// height, how far it finished from its pitch mark (run, metres along the shot;
// negative is back toward the player) and sideways.
function afterLanding(r, surface) {
 const touches = r.contacts.filter(c => c.what === surface);
 const first = touches[0];
 if (!first) return {run: 0, side: 0, hops: [], bounces: 0};
 const hops = [];
 for (let i = 0; i + 1 < touches.length; i++) {
  const a = touches[i], b = touches[i + 1];
  let top = 0;
  for (const q of r.points) if (q.t >= a.t && q.t <= b.t) top = Math.max(top, q.y - (first.y) );
  hops.push({length: Math.hypot(b.x - a.x, b.z - a.z) * Math.sign((b.z - a.z) || 1), height: top});
 }
 return {run: r.end.z - first.z, side: r.end.x - first.x, hops, bounces: touches.length, first};
}
// A ball arriving: speed (m/s), descent angle (deg below horizontal), backspin (rpm).
export function land({speed, angle, spin, surface = 'green', turf, slope = 0, side = 0}) {
 const course = plane(surface, slope, side);
 const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed, vla: -angle, spin, height: .01}, course, {turf});
 return {...afterLanding(r, surface), result: r};
}
// A full shot from launch conditions (mph, deg, rpm) onto one surface.
export function shot({mph, vla, spin, surface = 'green', turf, slope = 0, side = 0, axis = 0, options = {}}) {
 const course = plane(surface, slope, side);
 const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: axis, speed: mph * MPH, vla, spin}, course, {turf, ...options});
 return {...afterLanding(r, surface), result: r};
}
const hopText = h => h.slice(0, 5).map(x => `${x.length.toFixed(1)}/${x.height.toFixed(2)}`).join(' ') + (h.length > 5 ? ` +${h.length - 5}` : '');

// ---- the scorecard -----------------------------------------------------------
const checks = [];
let section = '';
const f1 = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : String(x);
function check(name, value, lo, hi, unit = '', note = '') {
 const pass = value >= lo && value <= hi;
 checks.push({section, name, value, lo, hi, unit, note, pass});
 if (!opt('--quiet')) console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} ${f1(value, 2).padStart(8)} ${unit.padEnd(5)} want ${f1(lo, 2)} to ${f1(hi, 2)}${note ? '   ' + note : ''}`);
 return pass;
}
const info = text => { if (!opt('--quiet')) console.log('       ' + text); };

// ---- sections ----------------------------------------------------------------
const SECTIONS = {
 // The USGA and R&A fired 57 balls at a green built to USGA spec and dried,
 // cut and rolled to championship firmness, Stimp 10-11 (Second Report on the
 // Study of Spin Generation, 2007, section 6.8): 66, 75 and 85 ft/s, 30-55
 // degrees, about 2,000-12,000 rpm. Their regressions are the best measurement
 // of a ball landing on a green there is, and the model's FIRM green is held
 // to them. Angle in degrees below horizontal, spin in rpm.
 firmgreen() {
  const turf = cond('firm', 10.5), row = turfOf('green', turf);
  const grid = [];
  for (const v of [20.1, 22.9, 25.9]) for (const a of [30, 35, 40, 45, 50, 55])
   for (const w of a <= 35 ? [2000, 3500, 5000] : a <= 45 ? [4000, 6000, 8000] : [6000, 9000, 12000]) grid.push({v, a, w});
  const err = {speed: [], angle: [], spin: [], first: [], total: []};
  for (const g of grid) {
   const rate = g.w * Math.PI / 30;
   const b = bounce([0, -g.v * Math.sin(g.a * RAD), g.v * Math.cos(g.a * RAD)], [-rate, 0, 0], [0, 1, 0], row);
   const outSpeed = Math.hypot(...b.v), outAngle = Math.atan2(b.v[1], b.v[2]) / RAD, outSpin = -b.w[0] * 30 / Math.PI;
   const l = land({speed: g.v, angle: g.a, spin: g.w, turf});
   err.speed.push(outSpeed / FOOT - (70.65 - 1.02 * g.a));
   err.angle.push(outAngle - (1.48 * g.a - 27.08));
   err.spin.push(outSpin - (g.w - 4690));
   err.first.push((l.hops[0]?.length ?? 0) / FOOT - (72.3 - 1.2 * g.a));
   err.total.push(l.run / FOOT - (246 - 3.54 * g.a - .0065 * g.w));
  }
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length, mae = xs => mean(xs.map(Math.abs));
  info(`${grid.length} landings against the USGA/R&A 2006 regressions (mean error, then mean absolute error)`);
  check('rebound speed, bias', mean(err.speed), -3, 3, 'ft/s', 'regression R2 0.92');
  check('rebound speed, typical miss', mae(err.speed), 0, 4.5, 'ft/s');
  check('rebound angle, bias', mean(err.angle), -4, 4, 'deg', 'R2 0.84');
  check('rebound angle, typical miss', mae(err.angle), 0, 7, 'deg');
  check('spin taken off, bias', mean(err.spin), -700, 700, 'rpm', 'measured: 4,690 rpm off whatever came in');
  check('first bounce length, bias', mean(err.first), -4, 4, 'ft', 'R2 0.91');
  check('first bounce length, typical miss', mae(err.first), 0, 5, 'ft');
  check('total bounce and roll, bias', mean(err.total), -8, 8, 'ft', 'R2 0.90');
  check('total bounce and roll, typical miss', mae(err.total), 0, 14, 'ft');
  // The three landings the USGA computed for tour players, spelled out.
  for (const [name, v, a, w] of [['5 iron 82 ft/s 44 deg 4,400', 25.0, 44, 4400], ['9 iron 78 ft/s 48 deg 6,200', 23.8, 48, 6200], ['sand wedge 72 ft/s 51 deg 9,100', 21.9, 51, 9100]]) {
   const l = land({speed: v, angle: a, spin: w, turf}), want = 246 - 3.54 * a - .0065 * w;
   info(`${name.padEnd(32)} runs ${f1(l.run / FOOT)} ft (measured ${f1(want)}), first bounce ${f1((l.hops[0]?.length ?? 0) / FOOT)} ft (${f1(72.3 - 1.2 * a)}), hops ${hopText(l.hops)}`);
  }
 },

 // How far each club runs after landing on a green, by firmness. FIRM is the
 // USGA regression above. MEDIUM and SOFT are PLACED from the R&A's 2008
 // launcher tests on six UK greens (a 5 iron ran 0-14 yd, a sand wedge -1 to
 // +3 yd, where the firm regression gives 20 and 2), Haake's soft-green runs
 // (1.3-2.5 m for a 5 iron whatever its spin) and Titleist's rule that an
 // iron landing at 45-50 degrees "takes one bounce forward and comes to rest
 // very close to where the second bounce lands".
 greens() {
  // Landing conditions: the USGA's computed tour landings, and flatter,
  // lower-spin club-golfer ones.
  const LANDS = [
   ['tour 5 iron', 25.0, 44, 4400, {soft: [1, 6.5], medium: [5, 12.5], firm: [14, 24]}],
   ['tour 7 iron', 24.7, 46, 5100, {soft: [0.5, 5], medium: [3, 9.5], firm: [11, 20]}],
   ['tour 9 iron', 23.8, 48, 6200, {soft: [0, 3], medium: [1.5, 6], firm: [7, 15]}],
   ['tour sand wedge', 21.9, 51, 9100, {soft: [-3, 1], medium: [-2, 2], firm: [-2, 4]}],
   ['club 5 iron', 24, 40, 4000, {soft: [2, 9], medium: [8, 16.5], firm: [19, 30]}],
   ['club 7 iron', 23, 43, 4800, {soft: [1.5, 6], medium: [6, 12], firm: [15, 25]}],
   ['club 9 iron', 22, 46, 6000, {soft: [0.5, 4], medium: [3, 9], firm: [10, 18]}],
   ['club wedge', 21, 48, 7000, {soft: [0, 3], medium: [1.5, 6], firm: [6, 13]}],
  ];
  for (const [name, v, a, w, want] of LANDS) {
   const runs = FIRMS.map(f => land({speed: v, angle: a, spin: w, turf: cond(f)}));
   for (let i = 0; i < 3; i++) check(`${name}, ${FIRMS[i]} green: run`, runs[i].run / YARD, want[FIRMS[i]][0], want[FIRMS[i]][1], 'yd', i === 2 ? 'USGA regression' : 'PLACED');
   info(`${name.padEnd(18)} hops soft ${hopText(runs[0].hops)} | medium ${hopText(runs[1].hops)} | firm ${hopText(runs[2].hops)}`);
  }
  // A firm green always runs further than a medium one, and that further than soft.
  let ordered = 0;
  for (const [, v, a, w] of LANDS) { const r = FIRMS.map(f => land({speed: v, angle: a, spin: w, turf: cond(f)}).run); if (r[0] <= r[1] + .3 && r[1] <= r[2] + .3) ordered++; }
  check('firmer never runs shorter (clubs of 8)', ordered, 7, 8, '', 'a wedge may come back further on a firm green');
 },

 // SPIN. The checks a player judges a simulator by.
 spin() {
  // The zero-run line on the firm championship green (USGA, derived from the
  // regression): a ball finishes level with its pitch mark at 52 deg with
  // 9,500 rpm, and behind it with more.
  const firm = cond('firm', 10.5);
  check('firm, 52 deg, 9,500 rpm: finishes near its mark', land({speed: 21.5, angle: 52, spin: 9500, turf: firm}).run / FOOT, -9, 9, 'ft', 'USGA: 0');
  check('firm, 54 deg, 11,000 rpm: comes back', land({speed: 21.5, angle: 54, spin: 11000, turf: firm}).run / FOOT, -30, -1, 'ft', 'USGA regression: -17');
  // "At 51 deg / 9,100 rpm, first bounce 11 ft, finish 6 ft: five feet of
  // draw-back." The ball goes forward first, then checks.
  const sw = land({speed: 21.9, angle: 51, spin: 9100, turf: firm});
  check('firm, sand wedge: first bounce goes FORWARD', (sw.hops[0]?.length ?? 0) / FOOT, 5, 16, 'ft', 'USGA: 11');
  check('firm, sand wedge: then checks (run past first bounce)', (sw.run - (sw.hops[0]?.length ?? 0)) / FOOT, -12, 2.5, 'ft', 'USGA: about -5, within its scatter');
  // Soft greens kill the spin in one bite (Haake): final position hardly
  // depends on spin. Firm greens are very sensitive to it.
  const softSpread = land({speed: 22, angle: 50, spin: 6000, turf: cond('soft')}).run - land({speed: 22, angle: 50, spin: 10000, turf: cond('soft')}).run;
  const firmSpread = land({speed: 22, angle: 50, spin: 6000, turf: cond('firm')}).run - land({speed: 22, angle: 50, spin: 10000, turf: cond('firm')}).run;
  check('spin matters more on firm than soft', firmSpread - softSpread, .5, 30, 'm', 'Haake: soft greens make final position insensitive to spin');
  // A 10,000 rpm wedge on a medium green: comes back a little. Not ten yards.
  const med = land({speed: 21, angle: 52, spin: 10000, turf: cond('medium')});
  check('medium, 10,000 rpm wedge: run', med.run / YARD, -4, 1.5, 'yd', 'PLACED: stops or backs up a little');
  // No amount of ordinary spin rips a ball back ten yards on the flat.
  let worst = 0;
  for (const f of FIRMS) for (const st of [9, 11, 13]) for (const w of [9000, 10500, 12000]) for (const a of [48, 52, 56]) worst = Math.min(worst, land({speed: 21, angle: a, spin: w, turf: cond(f, st)}).run);
  check('longest come-back on the flat, any green', -worst / YARD, 0, 13, 'yd', 'USGA regression at 56 deg, 12,000 rpm, Stimp 10-11: 10 yd');
  check('firm, Stimp 11, 52 deg, 10,500 rpm: comes back', -land({speed: 21.5, angle: 52, spin: 10500, turf: cond('firm', 11)}).run / YARD, -1.5, 5, 'yd', 'USGA regression: 2 yd, +/- 3');
  // Without the spin there is no come-back at all.
  let back = 0;
  for (const f of FIRMS) for (const w of [1500, 3000, 4500]) for (const a of [35, 45, 55]) back = Math.min(back, land({speed: 20, angle: a, spin: w, turf: cond(f)}).run);
  check('below 4,500 rpm nothing comes back', -back / FOOT, 0, 1.5, 'ft', 'USGA: under 4,700 rpm leaves with topspin');
  // The flyer: the same swing from light rough lands flatter with half the
  // spin and runs about 60% further (USGA).
  const clean = land({speed: 23.8, angle: 48, spin: 6200, turf: firm}).run, flyer = land({speed: 25.6, angle: 41, spin: 2800, turf: firm}).run;
  check('a flyer runs well past a clean strike', flyer / clean, 1.3, 3.2, 'x', 'USGA: about 1.6x');
 },

 // CHIPS. TrackMan's "Chip Shot Code" (Zanardelli 2021, about 6,000 chips):
 // launch and spin by loft are measured; the roll multiples are the author's
 // estimates on a "medium-fast" and a "tour-fast" green, read here as a
 // medium green at Stimp 10 and a firm one at 12.5 (a tour green is both). The rule of 12 and its one-club-shifted twin bracket the same
 // bands, so each range spans them.
 chips() {
  const BANDS = [
   ['low (7 iron), 10 deg, 1,500 rpm', 10, 1500, [3.0, 6.0], [4.2, 8.0]],
   ['medium-low (PW), 17 deg, 2,000 rpm', 17, 2000, [1.9, 3.6], [2.6, 5.0]],
   ['medium-high (gap), 24 deg, 2,500 rpm', 24, 2500, [1.1, 2.3], [1.7, 3.4]],
   ['high (sand wedge), 31 deg, 3,000 rpm', 31, 3000, [.55, 1.5], [.9, 2.2]],
  ];
  const speedFor = (vla, spin, carry) => { let lo = 1, hi = 40; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (flyBall({speed: m, vla, spin}).carry < carry) lo = m; else hi = m; } return (lo + hi) / 2; };
  for (const [name, vla, spin, medium, fast] of BANDS) {
   const speed = speedFor(vla, spin, 10 * YARD);
   for (const [label, stimp, want, firmness] of [['medium, Stimp 10', 10, medium, 'medium'], ['firm, Stimp 12.5', 12.5, fast, 'firm']]) {
    const r = shot({mph: speed / MPH, vla, spin, turf: cond(firmness, stimp)});
    check(`${name}, ${label}: roll / carry`, r.run / r.result.carry, want[0], want[1], 'x', 'TrackMan (estimated roll)');
    if (stimp === 10) info(`  ${f1(speed / MPH)} mph, carries ${f1(r.result.carry / YARD)} yd, lands ${f1(r.result.descentAngle, 0)} deg, hops ${hopText(r.hops)}`);
   }
  }
  // Less loft always rolls further.
  const rolls = BANDS.map(([, vla, spin]) => shot({mph: speedFor(vla, spin, 10 * YARD) / MPH, vla, spin, turf: cond('medium')}).run);
  check('each less-lofted chip rolls further', rolls.every((r, i) => i === 0 || r < rolls[i - 1]) ? 1 : 0, 1, 1);
  // More spin on the same chip checks sooner (Rice: 58 deg, 15 yd, 2,230 rpm
  // low against 1,250 rpm high).
  const sp = speedFor(30, 2000, 15 * YARD);
  check('same chip, 3,750 rpm against 1,500: rolls less', shot({mph: sp / MPH, vla: 30, spin: 3750, turf: cond('medium')}).run / shot({mph: sp / MPH, vla: 30, spin: 1500, turf: cond('medium')}).run, .3, .92, 'x');
  // A 50 yd pitch with a tour player's spin (Rice: 54 deg wedge, 25.4 deg,
  // 6,603 rpm) hops and stops; firmness decides by how much.
  const pitch = FIRMS.map(f => shot({mph: speedFor(25.4, 6603, 50 * YARD) / MPH, vla: 25.4, spin: 6603, turf: cond(f)}));
  check('50 yd pitch, 6,600 rpm, medium green: run', pitch[1].run / YARD, .5, 8.5, 'yd', 'PLACED');
  info(`50 yd pitch runs ${pitch.map((p, i) => `${FIRMS[i]} ${f1(p.run / YARD)} yd`).join(', ')}; medium hops ${hopText(pitch[1].hops)}`);
 },

 // THE FAIRWAY. Tour drives that found the fairway ran 30.1 +/- 3.5 yd in 2007
 // (USGA, ShotLink and TrackMan, 19 venues, tournament-firm); the USGA's 2018
 // launcher tests on four good everyday fairways averaged 17.8 +/- 13.3 yd and
 // one irrigation cycle cost 7.7 yd; the R&A's 2008 launcher saw 0-35 yd rising
 // with stiffness, first bounces about a metre high and 3-9 yd long, and every
 // drive leaving its first bounce with topspin.
 fairway() {
  // The R&A's tour drive at landing: 66 mph, 36 deg, 1,950 rpm.
  const d = FIRMS.map(f => land({speed: 29.5, angle: 36, spin: 1950, surface: 'fairway', turf: cond(f)}));
  check('tour drive, firm fairway: run', d[2].run / YARD, 26, 38, 'yd', 'tour 2007, fairway hits: 30.1 +/- 3.5');
  check('tour drive, medium fairway: run', d[1].run / YARD, 14, 24, 'yd', 'USGA 2018 launcher: 17.8');
  check('tour drive, soft fairway: run', d[0].run / YARD, 4, 12, 'yd', 'irrigated: 7.7 yd less, more when shallow');
  check('medium: first bounce height', d[1].hops[0]?.height ?? 0, .5, 1.8, 'm', 'R&A: about a metre');
  check('medium: first bounce length', (d[1].hops[0]?.length ?? 0) / YARD, 3, 10, 'yd', 'R&A: 3-9 yd');
  check('medium: bounces you can see (over 3 cm)', d[1].hops.filter(h => h.height > .03).length, 3, 8, '', 'a drive bounces several times');
  check('firm: bounces you can see', d[2].hops.filter(h => h.height > .03).length, 4, 10);
  check('soft: bounces you can see', d[0].hops.filter(h => h.height > .03).length, 1, 5);
  for (let i = 0; i < 3; i++) info(`${FIRMS[i].padEnd(7)} runs ${f1(d[i].run / YARD)} yd, hops ${hopText(d[i].hops)}`);
  // Steeper drives run less: about 2 yd a degree (TrackMan's rule of thumb),
  // and shallow ones lose far more to soft ground than steep ones (USGA 2018).
  const at = (a, f) => land({speed: 28.5, angle: a, spin: 2000, surface: 'fairway', turf: cond(f)}).run / YARD;
  check('medium: 32 deg runs further than 44 deg by', at(32, 'medium') - at(44, 'medium'), 8, 30, 'yd', 'about 2 yd a degree');
  check('soft costs a shallow drive more than a steep one', (at(32, 'firm') - at(32, 'soft')) - (at(50, 'firm') - at(50, 'soft')), 3, 40, 'yd');
  // Spin between 1,000 and 3,000 rpm makes "little observable difference".
  check('drive run, 3,000 rpm against 1,000', at2(3000) / at2(1000), .8, 1.05, 'x', 'USGA 2014: little observable difference');
  function at2(w) { return land({speed: 28.5, angle: 38, spin: w, surface: 'fairway', turf: cond('medium')}).run; }
  // Rough stops it. PLACED: no measured run data exists for a ball landing in rough.
  check('the same drive landing in rough: run', land({speed: 29.5, angle: 36, spin: 1950, surface: 'rough', turf: cond('medium')}).run / YARD, 1.5, 8, 'yd', 'PLACED');
  check('landing in sand: run', land({speed: 24, angle: 46, spin: 5000, surface: 'sand', turf: cond('medium')}).run / YARD, 0, 1.5, 'yd', 'PLACED: stays in or just past its crater');
 },

 // THE STIMPMETER. A ball released rolling at 1.83 m/s runs the Stimp reading:
 // that is what the reading is.
 stimp() {
  for (const s of [7, 8.5, 10, 11.5, 13, 14]) {
   const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: 1.83, vla: 0, spin: 0, roll: 1.83}, plane('green'), {turf: cond('medium', s)});
   check(`Stimp ${s}: a release rolls`, r.total / FOOT, s * .99, s * 1.01, 'ft');
  }
  // Brede's correction: the harmonic mean of the up and down rolls on a slope
  // gives back the flat reading (within a few percent on slopes up to 3%).
  for (const slope of [.02, .03]) {
   const run = s => simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: 1.83, vla: 0, spin: 0, roll: 1.83}, plane('green', s), {turf: cond('medium', 10)}).total / FOOT;
   const up = run(slope), down = run(-slope);
   check(`Brede on a ${slope * 100}% slope gives back Stimp 10`, 2 * up * down / (up + down), 9.3, 10.4, 'ft', `up ${f1(up)} down ${f1(down)}`);
  }
  // The steepest slope a ball will stop on (Lemons' chart in the USGA Green
  // Section Record, 2008: 7.0% at Stimp 8, 5.8% at 10, 4.9% at 12).
  for (const [s, want] of [[8, 7.0], [10, 5.8], [12, 4.9]]) {
   let lo = 0, hi = .2;
   for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; const r = simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: .6, vla: 0, spin: 0, roll: .6}, plane('green', -m), {turf: cond('medium', s)}); if (r.time < 60 && r.total < 30) lo = m; else hi = m; }
   check(`Stimp ${s}: steepest slope a ball stops on`, lo * 100, want - .9, want + .9, '%', `Lemons: ${want}`);
  }
 },

 // PUTTS. A putt leaves the face sliding and reaches true roll at 5/7 of its
 // launch speed (Perry, Brouillette, Pope, Cochran and Stobbs; Quintic: "up to
 // 30%"), having skidded 10-20% of its length. Launch monitors report the
 // launch speed. The one real long putt on record (TrackMan, via GolfWRX): 12.1
 // mph, skidded 70 in, ran 38 ft 10 in.
 putts() {
  const turf = cond('medium', 10);
  const putt = (mph, t = turf) => simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: mph * MPH, vla: 0, spin: 0}, plane('green'), {turf: t});
  const long = putt(12.1);
  check('12.1 mph on Stimp 10: runs', long.total / FOOT, 35, 43, 'ft', 'TrackMan measured 38 ft 10 in (green speed not given)');
  check('12.1 mph on Stimp 10: skids', long.skid / INCH, 55, 85, 'in', 'measured 70 in');
  const ten = putt(5.38);
  check('5.4 mph on Stimp 10: runs', ten.total / FOOT, 9, 11.5, 'ft', 'the skid model: 10 ft');
  check('skid share of a 10 ft putt', ten.skid / ten.total * 100, 8, 22, '%', 'Quintic: 10-25%');
  // The same arithmetic the swing meter uses must agree with the integration.
  for (const mph of [3, 6, 10, 15]) check(`closed form matches the integration at ${mph} mph`, struckDistance(mph * MPH, turf) / putt(mph).total, .975, 1.025, 'x');
  check('launch for 20 ft runs 20 ft', putt(launchForDistance(20 * FOOT, turf) / MPH).total / FOOT, 19.7, 20.3, 'ft');
  // Distance scales with Stimp a little less than in proportion (the skid does not).
  check('Stimp 12 against Stimp 8, same putt', putt(6, cond('medium', 12)).total / putt(6, cond('medium', 8)).total, 1.3, 1.5, 'x', 'pure roll would be 1.5');
  if (!opt('--quiet')) {
   console.log('       launch speed (mph) for a level putt, by Stimp:  ft      8      10      12');
   for (const ft of [3, 5, 10, 15, 20, 30, 40, 50, 60]) console.log('       ' + ' '.repeat(46) + String(ft).padStart(3) + [8, 10, 12].map(s => f1(launchForDistance(ft * FOOT, cond('medium', s)) / MPH, 2).padStart(8)).join(''));
  }
  // Uphill and downhill (Hurrion measured a 10 ft putt finishing 12 in past on
  // a 3% slope entering the hole about 2.5x faster uphill than down).
  const run = (mph, slope) => simulateShot({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed: mph * MPH, vla: 0, spin: 0}, plane('green', slope), {turf}).total;
  check('2% downhill runs further than level by', run(6, -.02) / run(6, 0), 1.15, 1.5, 'x', 'constant-resistance model: 1.34');
  check('2% uphill runs shorter than level by', run(6, .02) / run(6, 0), .72, .88, 'x', 'constant-resistance model: 0.80');
 },

 // BREAK. AimPoint's published charts (via E. Barzeski and Golf Digest) and
 // Mangum's field measurements: how far outside the hole's centre a putt
 // straight across a planar slope must be aimed, at a pace that would finish
 // 12 in past.
 break() {
  const CASES = [[8, 2, 9, 7.1], [10, 2, 9, 10.1], [12, 2, 9, 13.1], [10, 2, 24, 29.1], [12, 1, 10, 7], [12, 1.5, 10, 10], [10, 3, 10, 17]];
  for (const [stimp, pct, feet, want] of CASES) {
   const turf = cond('medium', stimp), L = feet * FOOT, course = plane('green', 0, pct / 100);
   const go = (aimDeg, speed) => simulateShot({origin: {x: 0, z: 0}, aim: aimDeg, hla: 0, spinAxis: 0, speed, vla: 0, spin: 0}, course, {turf});
   // +x is uphill, so the putt is aimed toward +x and breaks back toward -x.
   let aim = 2, speed = launchForDistance(L + .3, turf);
   for (let it = 0; it < 14; it++) {
    // Pace: finish 12 in beyond the hole's distance.
    let lo = speed * .6, hi = speed * 1.6;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (go(aim, m).end.z < L + 12 * INCH) lo = m; else hi = m; }
    speed = (lo + hi) / 2;
    // Line: where it crosses the hole's distance.
    const pts = go(aim, speed).points; let x = pts.at(-1).x;
    for (let i = 1; i < pts.length; i++) if (pts[i].z >= L) { const a = pts[i - 1], b = pts[i], u = (L - a.z) / ((b.z - a.z) || 1); x = a.x + (b.x - a.x) * u; break; }
    aim -= Math.atan2(x, L) / RAD * .9;
    if (Math.abs(x) < .002) break;
   }
   check(`Stimp ${stimp}, ${pct}% slope, ${feet} ft: aim outside centre`, L * Math.tan(aim * RAD) / INCH, want * .72, want * 1.3, 'in', `published ${want}`);
  }
 },

 // THE HOLE. Holmes (1991) worked out and then tested by experiment which
 // putts a hole catches; Penner's fit of his map is v = 1.63 (1 - (d/R)^2) m/s.
 // Mase's Cal Poly tests holed every dead-centre putt "even at 8 ft past" and
 // almost none at 9-12 ft past (the limit is 7.9 ft past at Stimp 10).
 cup() {
  const centre = captureSpeed(0);
  check('fastest centred putt the hole catches', centre, 1.5, 1.85, 'm/s', 'Holmes 1.63; with rim bounce up to 1.97; Mase 1.6-1.75');
  for (const [frac, want] of [[.25, 1.53], [.5, 1.22], [.75, .71]]) check(`same, ${frac * 100}% of the way to the edge`, captureSpeed(frac * CUP_RADIUS), want - .22, want + .25, 'm/s', `Holmes/Penner ${want}`);
  check('walking pace drops from anywhere inside', captureSpeed(.9 * CUP_RADIUS), .2, .75, 'm/s', 'Holmes/Penner 0.31');
  check('a ball whose centre misses the hole stays out', rollAtCup(.4, CUP_RADIUS + .004).holed ? 1 : 0, 0, 0);
  // Slope barely moves it (Penner: 1.71 up and 1.56 down on a 5 degree slope).
  check('5 deg uphill against downhill', captureSpeed(0, {slope: .0875}) / captureSpeed(0, {slope: -.0875}), 1.0, 1.25, 'x', 'Penner 1.10');
  // Lip-outs exist: some putt between dropping and missing touches the rim and stays out.
  let lips = 0, horseshoes = 0;
  for (let off = .02; off < .054; off += .002) for (let v = .6; v < 2.2; v += .05) { const r = rollAtCup(v, off); if (r.lipped) { lips++; const e = r.points.at(-1); if (e.z < .02) horseshoes++; } }
  check('lip-outs happen (of 544 edge putts)', lips, 40, 500);
  check('some of them come back toward the player', horseshoes, 1, 200, '', 'the horseshoe');
  // A holed ball ends on the bottom of the cup, having got there by falling.
  const made = rollAtCup(.9, .01), last = made.points.at(-1);
  check('a holed ball rests on the cup floor', (0 - last.y) / INCH, 2.9, 3.3, 'in', 'cup 4 in deep, ball centre 0.84 in above its floor');
  check('and takes a moment to settle', made.t, .25, 3, 's');
  // The flagstick (Mase 2019; Molinari 2019): no difference at dying pace; at
  // high speed a centred putt is saved by the stick.
  const pin = {pin: .00635};
  check('stick in, dying pace, centre: holed', rollAtCup(.5, 0, pin).holed ? 1 : 0, 1, 1);
  check('stick in, centred putt caught up to', captureSpeed(0, pin), centre + .15, 6, 'm/s', 'Molinari: fast centred putts 100% in against 81% out');
 },

 // SLOPES. Greens are not flat, and a model tuned on flat ground must still
 // behave on tilted ground: into an upslope a ball stops sooner, on a
 // downslope it runs further, on a sideslope it kicks and curls downhill, and
 // nothing runs forever unless the slope is too steep for the green speed.
 slopes() {
  const SHOTS = [['tour 7 iron', 24.7, 46, 5100], ['tour sand wedge', 21.9, 51, 9100], ['club wedge', 21, 48, 7000], ['chip', 9, 30, 2500]];
  let ok = 0, n = 0;
  for (const f of FIRMS) for (const [name, v, a, w] of SHOTS) {
   const turf = cond(f), runAt = s => land({speed: v, angle: a, spin: w, turf, slope: s});
   const up = runAt(.04), flat = runAt(0), down = runAt(-.04);
   n++; if (up.run <= flat.run + .05 && flat.run <= down.run + .05) ok++;
   info(`${f.padEnd(7)}${name.padEnd(16)} 4% up ${f1(up.run / YARD).padStart(6)}  flat ${f1(flat.run / YARD).padStart(6)}  4% down ${f1(down.run / YARD).padStart(6)} yd`);
  }
  check('uphill <= flat <= downhill (shots x firmness)', ok, n, n);
  // A sideslope takes the ball downhill, never up.
  let sideOk = 0, sn = 0;
  for (const f of FIRMS) for (const [, v, a, w] of SHOTS) { const l = land({speed: v, angle: a, spin: w, turf: cond(f), side: .04}); sn++; if (l.side < -.02) sideOk++; }
  check('a 4% sideslope takes every shot downhill', sideOk, sn, sn);
  // A wedge landing into a 6% upslope with tour spin comes back; it does not run away.
  const back = land({speed: 21.9, angle: 51, spin: 9500, turf: cond('medium', 11), slope: .03});
  check('medium, Stimp 11, wedge into a 3% upslope: run', back.run / YARD, -12, .5, 'yd', 'E6 users report 10-19 yd of spin-back as a known fault');
  // Everything stops, on any slope a ball can stop on.
  let never = 0;
  for (const f of FIRMS) for (const st of [8, 10, 13]) for (const s of [-.03, .03]) for (const [, v, a, w] of SHOTS) { const l = land({speed: v, angle: a, spin: w, turf: cond(f, st), slope: s}); if (l.result.time > 60) never++; }
  check('shots still moving after a minute on a 3% slope', never, 0, 0);
 },

 // FLIGHT. Published flights (tools/flight-targets.mjs): TrackMan's normalised
 // 6 iron in calm and wind, its driver chart, the 2023 tour averages (raw:
 // weather and altitude not removed, so 2-3% either way), and the USGA's worked
 // example, the only published flight TIME.
 flight() {
  const pct = (m, want) => (m - want) / want * 100, mae = xs => xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length;
  for (const c of NORMALISED) {
   const fly = w => flyBall({speed: c.mph * MPH, vla: c.vla, spin: c.spin}, {temperature: 25, wind: [0, 0, w * MPH], uniformWind: true});
   const calm = fly(0), row = c.rows[0];
   check(`${c.club}, calm: carry`, calm.carry / YARD, row.carry * .985, row.carry * 1.015, 'yd', `TrackMan ${row.carry}`);
   check(`${c.club}, calm: peak height`, calm.apex / YARD, row.apex * .96, row.apex * 1.04, 'yd', `TrackMan ${row.apex}`);
   check(`${c.club}, calm: landing angle`, calm.descent, row.land - 1.5, row.land + 1.5, 'deg', `TrackMan ${row.land}`);
   for (const r of c.rows.slice(1)) check(`${c.club}, ${Math.abs(r.wind)} mph ${r.wind < 0 ? 'head' : 'tail'}wind: carry change`, (fly(r.wind).carry - calm.carry) / YARD, (r.carry - row.carry) - 3.5, (r.carry - row.carry) + 3.5, 'yd', `TrackMan ${r.carry - row.carry}`);
  }
  const chart = DRIVER_CHART.map(([mph, vla, spin, carry]) => pct(flyBall({speed: mph * MPH, vla, spin}, {temperature: 25}).carry / YARD, carry));
  check('driver chart, 60 rows: carry, average miss', chart.reduce((a, b) => a + b, 0) / chart.length, -1.5, 1.5, '%');
  check('driver chart, 60 rows: carry, typical miss', mae(chart), 0, 2.2, '%');
  check('driver chart: worst row', Math.max(...chart.map(Math.abs)), 0, 6.5, '%');
  const errs = {carry: [], apex: [], land: []};
  for (const [tour, rows] of Object.entries(TOUR)) for (const [club, mph, vla, spin, apex, landing, carry] of rows) {
   const m = flyBall({speed: mph * MPH, vla, spin}, {temperature: 25});
   errs.carry.push(pct(m.carry / YARD, carry)); errs.apex.push(pct(m.apex / YARD, apex)); errs.land.push(m.descent - landing);
   if (['Driver', '7 iron', 'PW'].includes(club)) info(`${tour} ${club}: carry ${f1(m.carry / YARD)} yd (${carry}), peak ${f1(m.apex / YARD)} yd (${apex}), lands ${f1(m.descent)} deg (${landing}) at ${f1(m.landingSpeed)} m/s with ${f1(m.spin, 0)} rpm after ${f1(m.hang)} s`);
  }
  check('tour averages, 23 clubs: carry, typical miss', mae(errs.carry), 0, 3.2, '%', 'raw table');
  check('tour averages: peak height, typical miss', mae(errs.apex), 0, 7, '%');
  check('tour averages: landing angle, typical miss', mae(errs.land), 0, 3.6, 'deg');
  const u = flyBall({speed: USGA_EXAMPLE.mph * MPH, vla: USGA_EXAMPLE.vla, spin: USGA_EXAMPLE.spin}, {temperature: USGA_EXAMPLE.tempC});
  check('USGA example: carry', u.carry / YARD, USGA_EXAMPLE.carry * .965, USGA_EXAMPLE.carry * 1.035, 'yd', `USGA ${USGA_EXAMPLE.carry}`);
  check('USGA example: time in the air', u.hang, USGA_EXAMPLE.hang - .45, USGA_EXAMPLE.hang + .45, 's', `USGA ${USGA_EXAMPLE.hang}`);
  // No spin, no lift: a knuckleball falls short.
  check('a ball with no spin carries far less', flyBall({speed: 144 * MPH, vla: 12, spin: 0}).carry / flyBall({speed: 144 * MPH, vla: 12, spin: 2600}).carry, .25, .7, 'x');
  // Spin dies in the air at about 4% a second (TrackMan), faster for a drive.
  const d = flyBall({speed: 171 * MPH, vla: 10.4, spin: 2545}, {temperature: 25});
  check('a drive lands with this share of its spin', d.spin / 2545, .7, .86, 'x', 'R&A: 2,520 rpm lands at about 1,950 (0.77)');
  // Air: about 0.4% of carry for 1% of density (Titleist: 1.16% per 1,000 ft).
  const sea = flyBall({speed: 160 * MPH, vla: 11, spin: 2600}, {temperature: 25}).carry, high = flyBall({speed: 160 * MPH, vla: 11, spin: 2600}, {temperature: 25, altitude: 1524}).carry;
  check('5,000 ft adds to a drive', pct(high, sea), 3.5, 8, '%', 'Titleist: 5.8%');
  // Curve: 10 degrees of spin axis is about 11 yd offline at 150 yd (TrackMan).
  const curve = flyBall({speed: 113 * MPH, vla: 18, spin: 7000, spinAxis: 10}, {temperature: 25});
  check('10 deg of spin axis at about 150 yd: offline', Math.abs(curve.side) / YARD * 150 / (curve.carry / YARD), 7.5, 14.5, 'yd', 'TrackMan: 11');
 },
};

// ---- run ---------------------------------------------------------------------
if (argv.includes('--list')) { console.log(Object.keys(SECTIONS).join('\n')); process.exit(0); }
const single = opt('--shot') || opt('--land');
if (single) {
 const [a, b, c, surface = 'green', slopePct = 0] = single.split(',').map((x, i) => i < 3 || i === 4 ? Number(x) : x);
 for (const f of FIRMS) {
  const turf = cond(f, Number(opt('--stimp') || 10));
  const r = opt('--shot') ? shot({mph: a, vla: b, spin: c, surface, turf, slope: slopePct / 100}) : land({speed: a, angle: b, spin: c, surface, turf, slope: slopePct / 100});
  const m = r.result;
  console.log(`${f.padEnd(7)} carry ${f1(m.carry / YARD)} yd  lands ${f1(m.landingSpeed)} m/s ${f1(m.descentAngle)} deg ${f1(m.landingSpin, 0)} rpm  run ${f1(r.run / YARD, 2)} yd  hops (m long/high) ${hopText(r.hops)}  ${f1(m.time)} s`);
 }
 process.exit(0);
}
const only = opt('--only')?.split(',');
for (const [name, run] of Object.entries(SECTIONS)) {
 if (only && !only.includes(name)) continue;
 section = name;
 if (!opt('--quiet')) console.log(`\n${name.toUpperCase()}`);
 run();
}
const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length} of ${checks.length} checks pass` + (failed.length ? `; failing: ${[...new Set(failed.map(c => c.section))].join(', ')}` : ''));
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify({checks}, null, 1));
process.exit(failed.length ? 1 : 0);
