// The spin-back report's shots, measured on a flat green for each version of the
// physics being compared, and the plan the clip recorder plays.
//
//   node tools/landing-report/spin-plan.mjs                      -> docs/reports/backspin/plan.json
//   SPIN_BUILDS="today=src;proposed=<a copy of src>" node tools/landing-report/spin-plan.mjs
//
// SPIN_BUILDS names each version and the folder its physics is imported from
// (a whole copy of src/, so its relative imports resolve). `capture` in the plan
// is the capture build each label is recorded from: bench/shots/dist-spin-<label>,
// made with tools/capture/build-hooked.mjs (SWAP for a version not in src/).
//
// The shots are a grid of launch spin against green firmness for one full wedge,
// solved for the same 100 yd carry so the ball lands beside the flag every time;
// a steeper, shorter wedge at 10,000 rpm, since descent angle is the other half of
// whether a ball comes back; and a 7 iron, the club that must keep checking.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const OUT = process.env.SPIN_OUT || 'docs/reports/backspin';
const BUILDS = (process.env.SPIN_BUILDS || 'today=src').split(';').filter(Boolean).map(pair => {
 const [label, dir] = pair.split('=');
 return {label, dir: path.resolve(dir), capture: `bench/shots/dist-spin-${label}/index.html`};
});
const FIRMS = ['Soft', 'Normal', 'Firm', 'Burnt'];
// [row id, title, launch deg, carry yd, spins]
const ROWS = [
 ['wedge', 'Full wedge, 100 yd carry, 31 degree launch', 31, 100, [7000, 8500, 10000, 11000, 12000]],
 ['steep', 'High wedge, 70 yd carry, 42 degree launch', 42, 70, [10000]],
 ['iron7', '7 iron, 160 yd carry, 16 degree launch', 16.3, 160, [7000]],
];
// How far to the side of the flag the ball is played, so it never meets the cup.
const BESIDE = 1.2;

const ground = () => ({height: () => 0, surface: () => 'green', pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
const mods = {};
for (const b of BUILDS) {
 const at = f => import(pathToFileURL(path.join(b.dir, f)).href);
 mods[b.label] = {...await at('physics.js'), ...await at('turf.js')};
}
const {YARD, MPH, R} = mods[BUILDS[0].label];
// The flight is the same in every version compared here (only the ground moves),
// but the speed is solved per version anyway and the plan refuses a mismatch.
function solve(m, vla, spin, carry) {
 let lo = 10, hi = 200;
 for (let i = 0; i < 40; i++) {
  const mid = (lo + hi) / 2, r = m.simulateShot({speed: mid * MPH, vla, hla: 0, spin, spinAxis: 0, origin: {x: 0, z: 0}, aim: 0}, ground(), {turf: m.turfConfig({})});
  if (r.carry < carry * YARD) lo = mid; else hi = mid;
 }
 return (lo + hi) / 2;
}
function measure(m, shot, firmness) {
 const r = m.simulateShot({...shot, origin: {x: 0, z: 0}, aim: 0}, ground(), {turf: m.turfConfig({firmness, stimp: 10}), detailed: true});
 const after = r.points.filter(q => q.t >= r.hang);
 const before = r.points.filter(q => q.t < r.hang);
 // The first hop: the highest point between the first touchdown and the next.
 let top = 0, i = 1;
 while (i < after.length && after[i].y >= after[i - 1].y) i++;
 for (; i < after.length && after[i].y - R > 0.002; i++) top = Math.max(top, after[i].y - R);
 const hopEnd = after[i] ?? after[after.length - 1];
 const maxZ = Math.max(...after.map(q => q.z));
 return {
  carry: +(r.carry / YARD).toFixed(1), descent: +r.descentAngle.toFixed(1), apexFt: +(r.apex / 0.3048).toFixed(0),
  landingRpm: Math.round(before[before.length - 1]?.w ?? 0),
  hopFt: +(top / 0.3048).toFixed(2), hopYd: +((hopEnd.z - r.carry) / YARD).toFixed(1),
  release: +((r.end.z - r.carry) / YARD).toFixed(1), back: +((maxZ - r.end.z) / YARD).toFixed(1),
  hang: +r.hang.toFixed(2), rest: +(r.time - r.hang).toFixed(1),
 };
}
const shots = [];
for (const [row, title, vla, carry, spins] of ROWS) for (const spin of spins) {
 const speeds = BUILDS.map(b => solve(mods[b.label], vla, spin, carry));
 if (Math.max(...speeds) - Math.min(...speeds) > 0.05) throw Error(`the versions fly ${row} at ${spin} rpm differently (${speeds.join(', ')} mph); this report compares the ground only`);
 const mph = +speeds[0].toFixed(2);
 for (const firmness of FIRMS) {
  const shot = {speed: mph * MPH, vla, hla: 0, spin, spinAxis: 0};
  const by = Object.fromEntries(BUILDS.map(b => [b.label, measure(mods[b.label], shot, firmness)]));
  shots.push({id: `${row}-${spin}-${firmness.toLowerCase()}`, row, title, carryYd: carry, mph, vla, spin, firmness, by});
 }
}
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(`${OUT}/plan.json`, JSON.stringify({beside: BESIDE, stimp: 10, builds: BUILDS.map(({label, capture}) => ({label, capture})), firmness: FIRMS, rows: ROWS.map(([id, title]) => ({id, title})), shots}, null, 1));
for (const s of shots) console.log(`${s.id.padEnd(24)} ${s.mph} mph  ` + BUILDS.map(b => { const x = s.by[b.label]; return `${b.label} ${x.release >= 0 ? '+' : ''}${x.release}/${x.back} (d${x.descent}, ${x.landingRpm} rpm, hop ${x.hopFt} ft)`; }).join('   '));
console.log(`${OUT}/plan.json: ${shots.length} shots, ${BUILDS.length} version(s).`);
