// THE COMPUTER GOLFERS AGAINST REAL GOLFERS (the fairway-tour goal, 17
// November 2026; RESEARCH *How a golfer of each handicap misses*).
//
// Plays many 18-hole rounds for golfers at each handicap on a set of
// generated courses, through the real ball model (src/ai/golfer.js), and
// scores what they did against what Broadie (2008) and Shot Scope measured
// for real golfers of that standard (src/ai/skill.js TARGETS), each check
// within its stated tolerance. Two invariants must be zero: a better
// handicap never averages a worse score, and no golfer is ever left stuck on
// a hole. The sim handicap the game itself would give each band's golfer
// (handicap.js, from its last 20 rounds) is printed and checked too.
//
//   node tools/ai-bench.mjs                    every band, the default courses
//   node tools/ai-bench.mjs --jobs 1           one thread (the owner is gaming)
//   node tools/ai-bench.mjs --bands 0,15,30 --courses 3 --rounds 2   quicker
//   node tools/ai-bench.mjs --save             also write bench/ai-baseline.json
//
// Exits non-zero when an invariant is broken; a check outside its tolerance
// is printed, not fatal (the calibration is a judgement, RESEARCH).
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YARD = .9144, FOOT = .3048;
// Six courses over six landscapes, the starting course's figures (PLACED).
const LANDS = ['pacnw', 'prairie', 'seaside', 'parkland', 'flpalms', 'dmountain'];

async function play({settings, handicap, rounds, seed}) {
 const {generateWorld} = await import('../src/course.js');
 const {Round} = await import('../src/game.js');
 const {computerGolfer, lieAt} = await import('../src/ai/golfer.js');
 const {playHole} = await import('../src/ai/play.js');
 const {scratchStrokes, lieClass} = await import('../src/ai/strokes.js');
 globalThis.__aiWorld ||= new Map();
 const key = JSON.stringify(settings);
 if (!globalThis.__aiWorld.has(key)) globalThis.__aiWorld.set(key, generateWorld(settings));
 const w = globalThis.__aiWorld.get(key);
 const out = {rounds: [], drives: [], approach: [], short: [], sand: [], firstPutts: [], awful: 0, penalties: 0, pickups: 0, stuck: 0, holes: 0, fairways: [0, 0], gir: [0, 0], putts: 0};
 for (let k = 0; k < rounds; k++) {
  const g = computerGolfer({handicap, seed: `${seed}-${k}`, settings});
  // The tee a golfer of this handicap plays: the set nearest 6,900 yd less
  // 35 yd a stroke (PLACED: scratch about 6,900, a 15 about 6,375, a 30
  // about 5,850 -- the lengths the statistics' golfers mostly play).
  const want = 6900 - 35 * handicap, sets = Object.keys(w.holes[0].tees);
  const total = s => w.holes.reduce((a, h) => a + (h.tees[s]?.yards || 0), 0);
  const tee = sets.sort((a, b) => Math.abs(total(a) - want) - Math.abs(total(b) - want))[0];
  const r = new Round({players: [{name: 'C', team: 'A', hand: 'RH'}], mode: 'stroke', holes: w.holes.length, putting: {mode: 'holeout'}, tee, seed: `B${k}`});
  const card = [];
  for (let i = 0; i < w.holes.length; i++) {
   const h = w.holes[i];
   let strokes = 0, firstPutt = null, puttsHere = 0, onGreenAt = null, teeShot = true;
   const res = playHole(r, h, [g], {onTurn: t => {
    if (t.kind === 'relief') { out.penalties++; return; }
    // Five over par it picks up and drops by the green (ai/play.js).
    if (t.kind === 'pickup') { out.pickups++; return; }
    const {shot, from, lie} = t, end = shot.result.end, holed = shot.result.holed, hazard = shot.result.hazard;
    strokes++;
    const d0 = Math.hypot(h.pin.x - from.x, h.pin.z - from.z), d1 = Math.hypot(h.pin.x - end.x, h.pin.z - end.z);
    const endLie = holed ? 'holed' : hazard ? 'trouble' : lieAt(h, end.x, end.z);
    // Shot value against a scratch golfer (Broadie's "awful" is -0.8 or worse).
    const before = scratchStrokes(lie, d0);
    const after = holed ? 0 : hazard === 'Water' ? 1 + scratchStrokes('rough', d1 + 10) : hazard ? 1 + before : scratchStrokes(endLie, d1);
    if (before - after - 1 < -.8 && lie !== 'green') out.awful++;
    if (lie === 'green') { puttsHere++; out.putts++; if (firstPutt == null) firstPutt = d0; }
    if ((endLie === 'green' || holed) && onGreenAt == null) onGreenAt = strokes;
    if (teeShot && h.par >= 4) {
     out.fairways[1]++; if (endLie === 'fairway') out.fairways[0]++;
     if (shot.kind === 'driver' && !hazard) {
      const ang = (Math.atan2(end.x - from.x, end.z - from.z) - Math.atan2(shot.target.x - from.x, shot.target.z - from.z)) * 180 / Math.PI;
      out.drives.push({yd: Math.hypot(end.x - from.x, end.z - from.z) / YARD, ang: ((ang + 540) % 360) - 180});
     }
    }
    teeShot = false;
    const yd = d0 / YARD, frl = d1 / d0, lc = lieClass(lie);
    if (shot.plan === 'pin' && lc === 'fairway' && yd >= 100 && yd <= 150 && !hazard) out.approach.push(frl);
    if (lc === 'fairway' && lie !== 'tee' && yd >= 20 && yd <= 60 && !hazard && shot.kind !== 'putter') out.short.push(frl);
    if (lc === 'sand' && yd < 50 && !hazard) out.sand.push(frl);
   }});
   out.holes++;
   if (!res.complete) out.stuck++;
   const score = r.cards[0][i] ?? strokes;
   if (firstPutt != null) out.firstPutts.push({ft: firstPutt / FOOT, putts: puttsHere});
   out.gir[1]++; if (onGreenAt != null && onGreenAt <= h.par - 2) out.gir[0]++;
   card.push({par: h.par, yards: Math.round(h.tees?.[tee]?.yards || h.length / YARD), score});
   if (!r.finished) r.nextHole();
  }
  out.rounds.push(card);
 }
 return out;
}

if (!isMainThread) {
 parentPort.on('message', async job => {
  try { parentPort.postMessage({result: await play(job)}); } catch (e) { parentPort.postMessage({error: e.stack || String(e)}); }
 });
} else {
 const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
 const bands = String(opt('--bands', '0,5,10,15,20,25,30')).split(',').map(Number);
 const nCourses = Number(opt('--courses', 6)), rounds = Number(opt('--rounds', 4));
 const jobs = Math.max(1, Number(opt('--jobs', Math.max(1, availableParallelism() - 1))));
 const {STARTING_COURSE} = await import('../src/settings-schema.js');
 const {TARGETS, ANCHORS} = await import('../src/ai/skill.js');
 const {simHandicap} = await import('../src/handicap.js');
 // A full-length eighteen (7,000 yd from the back: blue about 7,050, white
 // 6,400, red 5,700 on the first course).
 const courses = Array.from({length: nCourses}, (_, i) => ({...STARTING_COURSE, holes: 18, courseYards: 7000, biome: LANDS[i % LANDS.length], seed: `AIBENCH-${i + 1}`}));
 // One job per course and band, so a worker builds each course once
 // (courses go to workers in order, a worker keeps what it built).
 const list = [];
 for (const settings of courses) for (const handicap of bands) list.push({settings, handicap, rounds, seed: `b${handicap}-${settings.seed}`});
 const t0 = Date.now(), results = new Array(list.length);
 let next = 0;
 await Promise.all(Array.from({length: Math.min(jobs, list.length)}, () => new Promise((resolve, reject) => {
  const worker = new Worker(fileURLToPath(import.meta.url));
  const take = () => {
   if (next >= list.length) { worker.terminate().then(resolve); return; }
   const i = next++;
   worker.once('message', m => { if (m.error) { worker.terminate(); reject(new Error(m.error)); } else { results[i] = m.result; process.stderr.write('.'); take(); } });
   worker.postMessage(list[i]);
  };
  worker.once('error', reject); take();
 })));
 process.stderr.write('\n');
 const lerp = (row, h) => { if (h <= ANCHORS[0]) return row[0]; for (let i = 1; i < ANCHORS.length; i++) if (h <= ANCHORS[i]) { const t = (h - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1]); return row[i - 1] + t * (row[i] - row[i - 1]); } return row[row.length - 1]; };
 // Shot Scope 2026 greens in regulation (RESEARCH), by handicap.
 const GIR = [[0, .59], [5, .41], [10, .32], [15, .21], [20, .14], [25, .09], [40, .05]];
 const girTarget = h => { for (let i = 1; i < GIR.length; i++) if (h <= GIR[i][0]) { const [a, va] = GIR[i - 1], [b, vb] = GIR[i]; return va + (vb - va) * (h - a) / (b - a); } return GIR[0][1]; };
 const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
 const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
 const sd = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
 // Where two putts are the average: putts against the log of the first
 // putt's length, a straight line fitted over 3-60 ft, solved for 2. Where
 // half are one-putted: the one-putt share's log-odds against the log of the
 // length, fitted the same way over bins of 3 ft, solved for even odds. A
 // fit, not the first bin that happens to cross, which sampling noise made
 // far too short (17 November 2026).
 const line = pts => { const n = pts.length, sx = pts.reduce((s, [x]) => s + x, 0), sy = pts.reduce((s, [, y]) => s + y, 0), sxx = pts.reduce((s, [x]) => s + x * x, 0), sxy = pts.reduce((s, [x, y]) => s + x * y, 0); const b = (n * sxy - sx * sy) / (n * sxx - sx * sx); return {a: (sy - b * sx) / n, b}; };
 const twoPuttAt = fp => { const pts = fp.filter(p => p.ft >= 3 && p.ft <= 60).map(p => [Math.log(p.ft), p.putts]); if (pts.length < 20) return NaN; const {a, b} = line(pts); return Math.exp((2 - a) / b); };
 const onePuttAt = fp => {
  const pts = [];
  for (let f = 2; f < 40; f += 3) { const bin = fp.filter(p => p.ft >= f && p.ft < f + 3); if (bin.length < 5) continue; const q = Math.min(.97, Math.max(.03, bin.filter(p => p.putts === 1).length / bin.length)); pts.push([Math.log(f + 1.5), Math.log(q / (1 - q))]); }
  if (pts.length < 3) return NaN; const {a, b} = line(pts); return Math.exp(-a / b);
 };
 const rows = [], report = {date: new Date().toISOString(), courses: courses.map(c => c.seed + ':' + c.biome), rounds, bands: {}};
 let broken = 0;
 const check = (name, got, want, tol, rel = false) => { const ok = Number.isFinite(got) && Math.abs(got - want) <= (rel ? Math.abs(want) * tol : tol); return {name, got, want, ok}; };
 const prevScores = [];
 for (const hcp of bands) {
  const mine = results.filter((_, i) => list[i].handicap === hcp);
  const all = k => mine.flatMap(r => r[k]);
  const sum = k => mine.reduce((s, r) => s + r[k], 0);
  const cards = mine.flatMap(r => r.rounds);
  const nRounds = cards.length;
  const overPar = cards.map(c => c.reduce((s, h) => s + h.score - h.par, 0));
  const avg = overPar.reduce((s, x) => s + x, 0) / nRounds;
  const sim = simHandicap(cards.slice(-20).map(holes => ({holes}))).index;
  const drives = all('drives'), fp = all('firstPutts');
  const fw = mine.reduce((s, r) => [s[0] + r.fairways[0], s[1] + r.fairways[1]], [0, 0]), gir = mine.reduce((s, r) => [s[0] + r.gir[0], s[1] + r.gir[1]], [0, 0]);
  const checks = [
   check('sim handicap of the last 20 rounds', sim, hcp, 1),
   check('greens in regulation', gir[0] / gir[1], girTarget(hcp), .06),
   check('drive direction spread (deg)', sd(drives.map(d => d.ang)), lerp(TARGETS.driveDir, hcp), 1),
   check('drive, 75th percentile (yd)', pct(drives.map(d => d.yd), .75), lerp(TARGETS.drive75, hcp), .08, true),
   check('approach 100-150 yd, median left', median(all('approach')), lerp(TARGETS.approachFRL, hcp), .25, true),
   check('short game 20-60 yd, median left', median(all('short')), lerp(TARGETS.shortFRL, hcp), .25, true),
   check('sand under 50 yd, median left', median(all('sand')), lerp(TARGETS.sandFRL, hcp), .3, true),
   check('half one-putted from (ft)', onePuttAt(fp), lerp(TARGETS.onePutt50, hcp), .2, true),
   check('two putts on average from (ft)', twoPuttAt(fp), lerp(TARGETS.twoPutt, hcp), .2, true),
   check('awful shots a round', sum('awful') / nRounds, lerp(TARGETS.awful, hcp), 1),
  ];
  const info = {avgOverPar: avg, fairways: fw[0] / fw[1], putts: sum('putts') / nRounds, penalties: sum('penalties') / nRounds, pickups: sum('pickups') / nRounds, stuck: sum('stuck'), n: {rounds: nRounds, drives: drives.length, approach: all('approach').length, short: all('short').length, sand: all('sand').length, putts: fp.length}};
  if (info.stuck) { broken++; console.log(`INVARIANT: ${info.stuck} holes left unfinished at handicap ${hcp}`); }
  if (prevScores.length && avg < prevScores[prevScores.length - 1].avg - .5) { broken++; console.log(`INVARIANT: handicap ${hcp} averages ${avg.toFixed(1)} over par, better than handicap ${prevScores[prevScores.length - 1].h} (${prevScores[prevScores.length - 1].avg.toFixed(1)})`); }
  prevScores.push({h: hcp, avg});
  report.bands[hcp] = {info, checks};
  rows.push([hcp, info, checks]);
 }
 const f = v => !Number.isFinite(v) ? '  --  ' : Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(1);
 for (const [hcp, info, checks] of rows) {
  console.log(`\nHandicap ${hcp}: ${info.n.rounds} rounds, ${f(info.avgOverPar)} over par on average, ${f(info.putts)} putts, ${(info.fairways * 100).toFixed(0)}% fairways, ${f(info.penalties)} penalties a round, ${f(info.pickups)} holes picked up`);
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'MISS'} ${c.name.padEnd(36)} ${f(c.got).padStart(7)}  want ${f(c.want)}`);
 }
 const misses = rows.reduce((s, [, , c]) => s + c.filter(x => !x.ok).length, 0), total = rows.reduce((s, [, , c]) => s + c.length, 0);
 console.log(`\n${total - misses} of ${total} checks within tolerance; ${broken} invariant(s) broken; ${((Date.now() - t0) / 1000).toFixed(0)} s on ${jobs} thread(s)`);
 if (args.includes('--save')) { fs.writeFileSync(path.join(ROOT, 'bench', 'ai-baseline.json'), JSON.stringify(report, null, 1)); console.log('saved bench/ai-baseline.json'); }
 process.exit(broken ? 1 : 0);
}
