// The flight model against the launch monitors the owner trusts most, and a fit
// of the aerodynamic constants (`AERO`, physics.js) to them.
//
//   node tools/flight-fit.mjs                 how the model stands, per source and club
//   node tools/flight-fit.mjs --fit           search for better constants (prints them)
//   node tools/flight-fit.mjs --set k=v,...   evaluate with constants changed
//   node tools/flight-fit.mjs --json out.json write every shot's numbers
//
// THE DATA IS PRIVATE AND NOT IN THE REPOSITORY. It is read from
// docs/sources/private/ (git-ignored) when present, and a missing file just
// drops that source:
//   trackman-tour-averages.json    Trackman PGA and LPGA tour averages (23 rows)
//   wedge-session-2026-09-19.xlsx  a GC3 session, 58 deg wedge to 4 iron
//   r50-session-2026-10-03.csv     the owner's R50 session
// Every source is a launch monitor that measures launch and CALCULATES carry and
// apex with its own model; that is what is being matched.
//
// Air: the R50 states its density, matched exactly. Trackman's averages and the
// GC3 export state none, so they fly in the model's default (sea level, 18 C),
// as the earlier fits did.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {simulateShot, airDensity, AERO, MPH, YARD} from '../src/physics.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = path.join(ROOT, 'docs', 'sources', 'private');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

// ---- the sources -------------------------------------------------------------
function trackman() {
 const f = path.join(PRIVATE, 'trackman-tour-averages.json');
 if (!fs.existsSync(f)) return [];
 const d = JSON.parse(fs.readFileSync(f, 'utf8'));
 return ['pga', 'lpga'].flatMap(tour => d[tour].map(r => ({source: 'Trackman', club: `${tour.toUpperCase()} ${r.club}`, mph: r.ballMph, vla: r.launch, hla: 0,
  spin: r.spin, axis: 0, carry: r.carryYd, apexFt: r.apexYd * 3, land: r.land})));
}
function gc3() {
 const f = path.join(PRIVATE, 'wedge-session-2026-09-19.xlsx');
 if (!fs.existsSync(f)) return [];
 // An .xlsx is a zip of XML parts; the two needed are read straight out of it
 // with Node's own inflate (unzip, below), so no outside tool is involved.
 {
  const zip = fs.readFileSync(f);
  const strings = [...unzip(zip, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
  const sheet = unzip(zip, 'xl/worksheets/sheet1.xml');
  const rows = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(m => {
   const out = {};
   for (const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const v = (c[3].match(/<v>(.*?)<\/v>/) || [])[1] ?? '';
    out[c[1]] = /t="s"/.test(c[2]) && v ? strings[+v] : v;
   }
   return out;
  });
  const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
  // Columns: A club, F carry, H peak height ft, I offline, K descent, L hang,
  // M ball speed, N launch, O direction, R total spin, S spin axis.
  return rows.filter(r => num(r.M) && num(r.R) && num(r.F)).map(r => ({source: 'GC3', club: String(r.A).replace(/[^\w ]/g, ''), mph: num(r.M), vla: num(r.N), hla: num(r.O) ?? 0,
   spin: num(r.R), axis: num(r.S) ?? 0, carry: num(r.F), apexFt: num(r.H), descent: num(r.K), hang: num(r.L)}));
 }
}
// One file out of a zip, by its central directory: enough for an .xlsx.
function unzip(buf, name) {
 let eocd = buf.length - 22;
 while (eocd > 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
 let at = buf.readUInt32LE(eocd + 16);
 for (let i = 0, n = buf.readUInt16LE(eocd + 10); i < n; i++) {
  const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20), nl = buf.readUInt16LE(at + 28), el = buf.readUInt16LE(at + 30), cl = buf.readUInt16LE(at + 32);
  const local = buf.readUInt32LE(at + 42), entry = buf.toString('utf8', at + 46, at + 46 + nl);
  if (entry === name) {
   const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), data = buf.subarray(start, start + size);
   return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
  }
  at += 46 + nl + el + cl;
 }
 throw Error(`${name} is not in the workbook`);
}
function r50() {
 const f = path.join(PRIVATE, 'r50-session-2026-10-03.csv');
 if (!fs.existsSync(f)) return [];
 const lines = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
 const head = lines[0].split(',');
 return lines.slice(2).map(l => Object.fromEntries(head.map((h, i) => [h, l.split(',')[i]])))
  // The owner judged the driver swings unrepresentative (hard low hooks and four
  // 40 mph swings); Trackman's driver rows stand in for them.
  .filter(r => r['Club Type'] !== 'Driver')
  .map(r => ({source: 'R50', club: r['Club Type'] === 'Lob Wedge' ? `${r['Club Name']} wedge` : r['Club Type'], mph: +r['Ball Speed'], vla: +r['Launch Angle'],
   hla: +r['Launch Direction'], spin: +r['Spin Rate'], axis: +r['Spin Axis'], carry: +r['Carry Distance'], apexFt: +r['Apex Height'],
   air: {density: +r['Air Density'], tempC: (+r['Temperature'] - 32) * 5 / 9}}));
}

const SHOTS = [...trackman(), ...gc3(), ...r50()];
// The driver is two rows of Trackman's twenty-three and nothing anywhere else
// (the R50's were set aside), so on its own the fit barely sees the club a
// player hits on every hole. --driver N counts each of those rows N times.
for (const s of SHOTS) if (/Driver/.test(s.club)) s.weight = +(opt('--driver') || 1);
// Altitude giving a stated density at a stated temperature.
const altFor = ({density, tempC}) => { let lo = -2000, hi = 6000; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (airDensity(m, tempC) > density) lo = m; else hi = m; } return (lo + hi) / 2; };
for (const s of SHOTS) s.opts = s.air ? {altitude: altFor(s.air), temperature: s.air.tempC, wind: [0, 0, 0]} : {wind: [0, 0, 0]};

// ---- the model ---------------------------------------------------------------
// Flat ground of one surface: carry, apex, descent and hang are all decided
// before it is touched.
const flat = {height: () => 0, surface: () => 'fairway', bounds: {x: 9000, minZ: -9000, maxZ: 9000}, trees: []};
function fly(s) {
 const m = simulateShot({origin: {x: 0, z: 0}, aim: 0, speed: s.mph * MPH, vla: s.vla, hla: s.hla, spin: s.spin, spinAxis: s.axis}, flat, s.opts);
 const k = m.points.findIndex((q, j) => j > 2 && q.y <= 0.03 && q.t > .2);
 return {carry: m.carry / YARD, apexFt: m.apex / .3048, descent: m.descentAngle, hang: (m.points[k] ?? m.points.at(-1)).t};
}
function evaluate() {
 return SHOTS.map(s => { const m = fly(s); return {...s, m,
  carryPct: (m.carry - s.carry) / s.carry * 100, apexPct: (m.apexFt - s.apexFt) / s.apexFt * 100,
  landErr: s.land != null ? m.descent - s.land : s.descent != null ? m.descent - s.descent : null,
  hangErr: s.hang != null ? m.hang - s.hang : null}; });
}
// THE COST. Every source counts the same, however many shots it brought, so the
// GC3's 111 cannot outvote Trackman's 23 averages. Within a source: peak height
// and carry in percent, squared, carry weighted double because it is what the
// player reads off the card; landing angle in degrees where the source gives it,
// at a quarter weight, because the bounce and the roll are fed by it.
// Hang time (GC3 only) is off unless --hang gives it a weight per second squared.
const W = {apex: 1, carry: 2, land: .25, hang: +(opt('--hang') || 0)};
function cost(rows) {
 const by = {};
 for (const r of rows) (by[r.source] ??= []).push(r);
 let total = 0;
 for (const rs of Object.values(by)) {
  let c = 0;
  let n = 0;
  for (const r of rs) { const w = r.weight ?? 1; n += w; c += w * (W.apex * r.apexPct ** 2 + W.carry * r.carryPct ** 2 + (r.landErr != null ? W.land * r.landErr ** 2 : 0) + (r.hangErr != null ? W.hang * r.hangErr ** 2 : 0)); }
  total += c / n;
 }
 total /= Object.keys(by).length;
 // A curve that produces no number for some shot is not a fit, however low the
 // rest of it scores.
 return Number.isFinite(total) ? total : 1e9;
}

// ---- reporting ---------------------------------------------------------------
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const rms = xs => Math.sqrt(mean(xs.map(x => x * x)));
const sg = (x, d = 1) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
function report(rows, title) {
 console.log(`\n${title}  (cost ${cost(rows).toFixed(2)})`);
 for (const src of [...new Set(rows.map(r => r.source))]) {
  const rs = rows.filter(r => r.source === src);
  const land = rs.filter(r => r.landErr != null);
  console.log(`  ${src.padEnd(9)} n=${String(rs.length).padStart(3)}  carry ${sg(mean(rs.map(r => r.carryPct)))}% (rms ${rms(rs.map(r => r.carryPct)).toFixed(1)}%)  apex ${sg(mean(rs.map(r => r.apexPct)))}% (rms ${rms(rs.map(r => r.apexPct)).toFixed(1)}%)`
   + (land.length ? `  landing ${sg(mean(land.map(r => r.landErr)))} deg (rms ${rms(land.map(r => r.landErr)).toFixed(1)})` : ''));
  const clubs = [...new Set(rs.map(r => r.club))];
  for (const c of clubs) {
   const cs = rs.filter(r => r.club === c);
   console.log(`     ${c.padEnd(16)} n=${String(cs.length).padStart(2)}  carry ${sg(mean(cs.map(r => r.carryPct))).padStart(6)}%  apex ${sg(mean(cs.map(r => r.apexPct))).padStart(6)}%`
    + (cs[0].landErr != null ? `  land ${sg(mean(cs.map(r => r.landErr))).padStart(5)}` : ''));
  }
 }
}

const KEYS = ['liftK', 'liftP', 'liftC', 'spinDrag', 'dragBase', 'dragCrisis', 'crisisRe', 'crisisWidth', 'spinTau'];
const setAero = v => { for (const [k, x] of Object.entries(v)) AERO[k] = x; };
if (opt('--set')) setAero(Object.fromEntries(opt('--set').split(',').map(kv => { const [k, v] = kv.split('='); return [k, +v]; })));

console.log(`sources: ${[...new Set(SHOTS.map(s => s.source))].map(s => `${s} ${SHOTS.filter(x => x.source === s).length}`).join(', ')}`);
const before = evaluate();
report(before, 'AS IT STANDS ' + JSON.stringify(Object.fromEntries(KEYS.map(k => [k, AERO[k]]))));

if (argv.includes('--fit')) {
 // Nelder-Mead in a scaled space: every constant moves as a fraction of its
 // starting size, so a Reynolds number and a coefficient take comparable steps.
 // spinTau is left out by default: fitted freely it slows the decay for wedges
 // and triples their spin-back, so it is held at the published rate (physics.js).
 const keys = (opt('--keys') || 'liftK,liftP,liftC,spinDrag,dragBase,dragCrisis').split(',');
 const base = keys.map(k => AERO[k]);
 const at = x => { setAero(Object.fromEntries(keys.map((k, i) => [k, base[i] * (1 + x[i])]))); return cost(evaluate()); };
 const n = keys.length, step = +(opt('--step') || .15);
 let simplex = [Array(n).fill(0), ...keys.map((_, i) => keys.map((_, j) => i === j ? step : 0))].map(x => ({x, f: at(x)}));
 const iters = +(opt('--iters') || 400);
 for (let it = 0; it < iters; it++) {
  simplex.sort((a, b) => a.f - b.f);
  const best = simplex[0], worst = simplex[n], second = simplex[n - 1];
  const c = Array(n).fill(0).map((_, i) => mean(simplex.slice(0, n).map(p => p.x[i])));
  const pt = t => c.map((ci, i) => ci + t * (worst.x[i] - ci));
  const r = {x: pt(-1)}; r.f = at(r.x);
  if (r.f < best.f) { const e = {x: pt(-2)}; e.f = at(e.x); simplex[n] = e.f < r.f ? e : r; }
  else if (r.f < second.f) simplex[n] = r;
  else { const k = {x: pt(r.f < worst.f ? -.5 : .5)}; k.f = at(k.x);
   if (k.f < Math.min(worst.f, r.f)) simplex[n] = k;
   else simplex = simplex.map((p, i) => i === 0 ? p : (q => ({x: q, f: at(q)}))(p.x.map((xi, j) => best.x[j] + .5 * (xi - best.x[j])))); }
  if (it % 25 === 0) console.log(`  iter ${it}  cost ${simplex[0].f.toFixed(3)}`);
  if (Math.abs(simplex[n].f - simplex[0].f) < 1e-4) break;
 }
 simplex.sort((a, b) => a.f - b.f);
 at(simplex[0].x);
 const found = Object.fromEntries(keys.map(k => [k, +AERO[k].toPrecision(4)]));
 setAero(found);
 report(evaluate(), 'FITTED ' + JSON.stringify(found));
}
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(evaluate().map(({opts, ...r}) => r)));
