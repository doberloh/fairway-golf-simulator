// Fits how a ball lands on a green -- the first hop, the check and the
// come-back -- against the targets in RESEARCH.md, *Spin-back reined in*, and
// prints how each one is met.
//
//   node tools/green-fit.mjs              score the model as it stands
//   node tools/green-fit.mjs --fit        search the green's constants, print the best
//   node tools/green-fit.mjs --fit --from cor=0.12,tilt=0.08   start somewhere else
//
// Everything is on a flat green at Stimp 10. The targets:
//   - how far a full wedge comes back across launch spin and firmness (the
//     owner's table, 13 October 2026, with 12,000 rpm on Soft at about 4 yd);
//   - a steeper wedge coming back sooner;
//   - a 7 iron at 7,000 rpm finishing about where it did (Soft 3.8, Normal 6.9,
//     Firm 9.7, Burnt 12.9 yd past its mark), allowed about 3 yd more: the
//     owner chose a forward first hop over it, and a ball landing as Haake's
//     did runs some 9-13 yd on his own numbers;
//   - the first hop going forward, 0.4 yd or more for an 8,500 rpm wedge;
//   - Haake's measured bounce on a green: 18.6 m/s at 44.4 degrees with 484
//     rad/s of backspin leaving at 5.1 m/s, 33.0 degrees (4.28 forward, 2.78 up),
//     held as a band because it is one bounce on one green;
//   - two chips and four pitches rolling about as they did.
// The search moves the green's restitution, tilt, friction, spin transfer and
// ploughing, the spin-by-firmness table and the slow-bounce speed, in one
// worker per core. It changes nothing on disk: copy the result into physics.js.
import os from 'node:os';
import {Worker, isMainThread, parentPort} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';

const FIRMS = ['Soft', 'Normal', 'Firm', 'Burnt'];
// Ball speeds solved once for the carries (the flight is not being fitted).
const WEDGE = {7000: 82.97, 8500: 84.78, 10000: 86.19, 11000: 86.9, 12000: 87.47};
// Yards back, [low, high] per firmness, Soft .. Burnt.
const BACK = {
 7000: [[0, 0.05], [0, 0.05], [0, 0.05], [0, 0.05]],
 8500: [[0, 0.3], [0, 0.1], [0, 0.05], [0, 0.05]],
 10000: [[0.7, 1.2], [0.1, 0.5], [0, 0.15], [0, 0.05]],
 11000: [[1.8, 2.5], [0.8, 1.4], [0.2, 0.7], [0, 0.2]],
 12000: [[3.6, 4.2], [2.2, 2.8], [1.0, 1.6], [0, 0.5]],
};
const STEEP = [[1.2, 1.8], [0.6, 1.0], [0.2, 0.6], [0, 0.4]];
// The owner chose the forward first hop over the 7 iron (13 October 2026): it
// may run what the keep-hop candidate showed, about 3 yd more than before.
const IRON = [[3.0, 7.5], [6.0, 10.5], [8.5, 13.5], [11.0, 16.5]];
const CASES = [];
for (const [spin, bands] of Object.entries(WEDGE).map(([s]) => [+s, BACK[s]]))
 FIRMS.forEach((f, i) => CASES.push({id: `wedge ${spin} ${f}`, kind: 'shot', mph: WEDGE[spin], vla: 31, spin, firmness: f, back: bands[i], hop: spin === 8500 ? 0.4 : null}));
FIRMS.forEach((f, i) => CASES.push({id: `steep 10000 ${f}`, kind: 'shot', mph: 70.08, vla: 42, spin: 10000, firmness: f, back: STEEP[i]}));
FIRMS.forEach((f, i) => CASES.push({id: `7 iron 7000 ${f}`, kind: 'shot', mph: 115.92, vla: 16.3, spin: 7000, firmness: f, release: IRON[i], hop: 0.5}));
CASES.push({id: 'chip 56 deg', kind: 'shot', mph: 22, vla: 36, spin: 1150, firmness: 'Normal', release: [8.9, 13.0]});
CASES.push({id: 'chip PW', kind: 'shot', mph: 25, vla: 21, spin: 1000, firmness: 'Normal', release: [16.0, 21.0]});
// Pitches land gently (8-15 m/s into the turf), which is where the slow-bounce
// rule acts; held near what they ran before it (30 yd 9.0, 53 yd 6.2, 70 yd
// 3.5, 80 yd 0.4), after a first fit without them ran a 50 yd pitch 12.5 yd.
for (const [mph, vla, spin, release] of [[40, 30, 4500, [7, 11]], [55, 28, 6500, [4.5, 8]], [65, 30, 7500, [2.5, 5.5]], [72, 32, 8500, [0, 2.5]]])
 CASES.push({id: `pitch ${mph} mph ${spin}`, kind: 'shot', mph, vla, spin, firmness: 'Normal', release});
CASES.push({id: 'tour PW 9300', kind: 'shot', mph: 102, vla: 24, spin: 9300, firmness: 'Normal', back: [0, 0.3]});
CASES.push({id: 'Haake green bounce', kind: 'haake', firmness: 'Normal'});

// The constants searched, with their bounds.
const PARAMS = [
 ['cor', 0.06, 0.2], ['tilt', 0.0, 0.16], ['mu', 0.3, 0.7], ['spin', 1.5, 2.5], ['plough', 0.2, 2.0],
 ['soft', 0.7, 1.1], ['firm', 1.0, 1.3], ['burnt', 1.05, 1.6], ['slow', 3, 25],
];

async function worker() {
 const P = await import('../src/physics.js');
 const {turfConfig} = await import('../src/turf.js');
 const green = P.contactOf('green');
 const ground = () => ({height: () => 0, surface: () => 'green', pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
 const apply = v => {
  green.cor = v.cor; green.tilt = v.tilt; green.mu = v.mu; green.spin = v.spin;
  for (const f of FIRMS) P.PLOUGH_BY_FIRMNESS[f] = v.plough;
  Object.assign(P.SPIN_BY_FIRMNESS, {Soft: v.soft, Normal: 1, Firm: v.firm, Burnt: v.burnt});
  P.LANDING_SPIN.slowBounce = v.slow;
 };
 const run = c => {
  const turf = turfConfig({firmness: c.firmness, stimp: 10});
  if (c.kind === 'haake') {
   const r = P.simulateShot({speed: 18.6, vla: -44.4, hla: 0, spin: 484 * 30 / Math.PI, spinAxis: 0, origin: {x: 0, z: 0}, aim: 0, height: 0.05}, ground(), {turf, detailed: true, dt: 1 / 2000});
   const i = r.points.findIndex(q => q.t > r.hang + 1e-4), a = r.points[i], b = r.points[i + 1];
   return {fwd: (b.z - a.z) / (b.t - a.t), up: (b.y - a.y) / (b.t - a.t)};
  }
  const r = P.simulateShot({speed: c.mph * P.MPH, vla: c.vla, hla: 0, spin: c.spin, spinAxis: 0, origin: {x: 0, z: 0}, aim: 0}, ground(), {turf});
  const after = r.points.filter(q => q.t >= r.hang);
  let i = 1, top = 0; while (i < after.length && after[i].y >= after[i - 1].y) i++;
  while (i < after.length && after[i].y - P.R > 0.002) { top = Math.max(top, after[i].y - P.R); i++; }
  const far = Math.max(...after.map(q => q.z));
  return {release: (r.end.z - r.carry) / P.YARD, back: (far - r.end.z) / P.YARD,
   hop: ((after[i] ?? after[after.length - 1]).z - r.carry) / P.YARD, hopFt: top / 0.3048};
 };
 parentPort.on('message', ({v, cases}) => { apply(v); parentPort.postMessage(cases.map(c => ({id: c.id, ...run(c)}))); });
}

const miss = (x, [lo, hi]) => x < lo ? lo - x : x > hi ? x - hi : 0;
function score(results) {
 let s = 0;
 for (const c of CASES) {
  const r = results[c.id];
  if (c.back) s += 4 * miss(r.back, c.back) ** 2;
  if (c.release) s += miss(r.release, c.release) ** 2;
  if (c.hop !== null && c.hop !== undefined) s += 200 * Math.max(0, c.hop - r.hop) ** 2;
  // One bounce on one green, and Haake's greens differed widely: a band, not a point.
  if (c.kind === 'haake') s += 4 * (miss(r.fwd, [3.6, 4.6]) / 0.4) ** 2 + 4 * (miss(r.up, [2.5, 3.1]) / 0.3) ** 2;
 }
 // The ladder must hold: Soft back >= Normal >= Firm >= Burnt at every spin.
 for (const spin of Object.keys(WEDGE)) for (let i = 1; i < 4; i++) {
  const a = results[`wedge ${spin} ${FIRMS[i - 1]}`].back, b = results[`wedge ${spin} ${FIRMS[i]}`].back;
  s += 10 * Math.max(0, b - a) ** 2;
 }
 return s;
}

async function main() {
 const n = Math.max(2, Math.min(CASES.length, os.cpus().length - 2));
 const pool = Array.from({length: n}, () => new Worker(fileURLToPath(import.meta.url)));
 const evaluate = async v => {
  const chunks = pool.map((_, k) => CASES.filter((__, j) => j % n === k));
  const parts = await Promise.all(pool.map((w, k) => new Promise(res => { w.once('message', res); w.postMessage({v, cases: chunks[k]}); })));
  return Object.fromEntries(parts.flat().map(r => [r.id, r]));
 };
 const P = await import('../src/physics.js');
 const g = P.contactOf('green');
 let v = {cor: g.cor, tilt: g.tilt, mu: g.mu, spin: g.spin, plough: P.PLOUGH_BY_FIRMNESS.Normal,
  soft: P.SPIN_BY_FIRMNESS.Soft, firm: P.SPIN_BY_FIRMNESS.Firm, burnt: P.SPIN_BY_FIRMNESS.Burnt, slow: P.LANDING_SPIN.slowBounce};
 const from = process.argv.indexOf('--from');
 if (from >= 0) for (const kv of process.argv[from + 1].split(',')) { const [k, x] = kv.split('='); v[k] = +x; }
 let res = await evaluate(v), best = score(res);
 if (process.argv.includes('--fit')) {
  // Pattern search: try each constant up and down by its step, keep any
  // improvement, halve the steps when a whole sweep finds none.
  const step = Object.fromEntries(PARAMS.map(([k, lo, hi]) => [k, (hi - lo) / 8]));
  for (let sweep = 0; sweep < 60; sweep++) {
   let moved = false;
   for (const [k, lo, hi] of PARAMS) for (const dir of [1, -1]) {
    const t = {...v, [k]: Math.min(hi, Math.max(lo, v[k] + dir * step[k]))};
    if (t[k] === v[k]) continue;
    const r = await evaluate(t), s = score(r);
    if (s < best - 1e-9) { v = t; best = s; res = r; moved = true; break; }
   }
   if (!moved) { for (const k in step) step[k] /= 2; if (Math.max(...PARAMS.map(([k, lo, hi]) => step[k] / (hi - lo))) < 1 / 256) break; }
   console.error(`sweep ${sweep}: score ${best.toFixed(4)}`);
  }
 }
 const f = x => x.toFixed(2).padStart(6);
 for (const c of CASES) {
  const r = res[c.id], want = c.back ? `back ${c.back.join('-')}` : c.release ? `release ${c.release.join('-')}` : 'fwd 3.6-4.6 up 2.5-3.1';
  const got = c.kind === 'haake' ? `fwd ${f(r.fwd)} up ${f(r.up)}` : `back ${f(r.back)} release ${f(r.release)} hop ${f(r.hop)} yd ${f(r.hopFt)} ft`;
  console.log(`${c.id.padEnd(22)} ${got}   want ${want}${c.hop ? `, hop >= ${c.hop}` : ''}`);
 }
 console.log(`score ${best.toFixed(4)}`);
 console.log(JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, +x.toFixed(4)]))));
 for (const w of pool) await w.terminate();
}

if (isMainThread) await main(); else await worker();
