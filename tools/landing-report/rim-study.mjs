// How the cup treats putts across speed and line: which drop, which lip out,
// how far round the rim the lip-outs ride, and the fastest putt that still
// drops on each line. Runs against any copy of physics.js, so a change can be
// measured against the version before it.
//
//   node tools/landing-report/rim-study.mjs [path/to/physics.js] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {turfConfig, rollDeceleration} from '../../src/turf.js';

const args = process.argv.slice(2);
const physicsPath = args.find(a => a.endsWith('.js') || a.endsWith('.mjs')) || 'src/physics.js';
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const {simulateShot, R, CUP_RADIUS} = await import(pathToFileURL(path.resolve(physicsPath)).href);

const green = (pin, stimp = 10) => ({height: () => 0, surface: () => 'green', pin, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
const WALL = CUP_RADIUS - R;
// On the rim: the cylinder below the lip, or the rim circle at and above it.
const onRim = q => q.y < 0 ? Math.abs(Math.hypot(q.x, q.z) - WALL) < .0008 : Math.abs(Math.hypot(Math.hypot(q.x, q.z) - CUP_RADIUS, q.y) - R) < .0008;
const arc = pts => { let a = 0; for (let i = 1; i < pts.length; i++) { let s = Math.atan2(pts[i].x, pts[i].z) - Math.atan2(pts[i - 1].x, pts[i - 1].z); s = ((s + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (Math.abs(s) < 1.2) a += Math.abs(s); } return a * 180 / Math.PI; };

// Released already rolling, 30 cm out, so it arrives at exactly `speed`.
function putt(speed, offset, stimp = 10) {
 const turf = turfConfig({stimp}), run = .3, release = Math.sqrt(speed * speed + 2 * rollDeceleration('green', turf) * run);
 const r = simulateShot({origin: {x: offset, z: -run}, aim: 0, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed: release, roll: release}, green({x: 0, z: 0}), {turf});
 const rim = r.points.filter(onRim);
 return {result: r.holed ? 'holed' : r.lipped ? 'lipped' : 'missed', ride: arc(rim), edgeRide: arc(rim.filter(q => q.y >= 0)), wallRide: arc(rim.filter(q => q.y < 0))};
}
const speeds = [], offsets = [];
for (let s = .2; s <= 2.4001; s += .1) speeds.push(+s.toFixed(2));
for (let o = 0; o <= .0535; o += .0025) offsets.push(+o.toFixed(4));
const out = {physics: physicsPath, grid: [], summary: {}};
for (const stimp of [8, 10, 13]) {
 const rows = [];
 for (const offset of offsets) for (const speed of speeds) rows.push({stimp, offset, speed, ...putt(speed, offset, stimp)});
 const lips = rows.filter(r => r.result === 'lipped'), holed = rows.filter(r => r.result === 'holed');
 const capture = offsets.map(o => Math.max(0, ...rows.filter(r => r.offset === o && r.result === 'holed').map(r => r.speed)));
 const sorted = lips.map(r => r.ride).sort((a, b) => a - b);
 out.summary[stimp] = {holed: holed.length, lipped: lips.length, missed: rows.length - holed.length - lips.length,
  longestLipRide: Math.round(sorted.at(-1) ?? 0), medianLipRide: Math.round(sorted[sorted.length >> 1] ?? 0),
  lipRidesOver180: lips.filter(r => r.ride > 180).length, lipRidesOver270: lips.filter(r => r.ride > 270).length,
  fastestHoledByOffsetMm: Object.fromEntries(offsets.map((o, i) => [Math.round(o * 1000 * 10) / 10, capture[i]]))};
 out.grid.push(...rows);
}
for (const [stimp, s] of Object.entries(out.summary)) {
 console.log(`Stimp ${stimp}: ${s.holed} holed, ${s.lipped} lipped out, ${s.missed} missed; lip-out rides: median ${s.medianLipRide} deg, longest ${s.longestLipRide} deg, over 180 deg ${s.lipRidesOver180}, over 270 deg ${s.lipRidesOver270}`);
 console.log('   fastest putt that drops, by mm off centre: ' + Object.entries(s.fastestHoledByOffsetMm).filter((_, i) => i % 4 === 0).map(([o, v]) => `${o}mm ${v}`).join('  '));
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out));
