// Shot-making clips for the website: the "extreme" shots -- stinger, high draw,
// power fade, knockdown, flop, zip-back -- each played with launch-monitor
// numbers a real player produces. Plans them on the test course and checks what
// each does before anything is filmed.
//
//   node tools/landing-report/shotmaking-plan.mjs   -> docs/reports/shotmaking/plan.json
//
// The numbers and their sources are in RESEARCH.md, *Shot-making clips*.
import fs from 'node:fs';
import {generateWorld, DEFAULT_COURSE} from '../../src/course.js';
import {simulateShot, YARD, MPH} from '../../src/physics.js';
import {turfConfig} from '../../src/turf.js';
import {FIRMNESS_PRESETS} from '../../src/firmness.js';

const OUT = 'docs/reports/shotmaking';
fs.mkdirSync(OUT, {recursive: true});
const COURSE = {biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0};
const w = generateWorld({...DEFAULT_COURSE, ...COURSE}), DEG = 180 / Math.PI;
// The back tee box itself: the hole's nominal tee point can sit on the bank below it.
const fromTee = h => ({x: h.tees.blue.x, z: h.tees.blue.z});
// The middle of the mown fairway across the hole at a distance down it. The
// hole's centreline is not where the fairway was drawn, so it is found by looking.
const fairwayMid = (h, z) => { const xs = []; for (let x = -60; x <= 60; x += .5) if (h.surface(x, z) === 'fairway') xs.push(x); return xs.length ? (xs[0] + xs.at(-1)) / 2 : 0; };
const behindPin = (h, yards) => { const p = h.pin, dx = h.tee.x - p.x, dz = h.tee.z - p.z, d = Math.hypot(dx, dz); return {x: p.x + dx / d * yards * YARD, z: p.z + dz / d * yards * YARD}; };
// [name, what it is, hole index, where from, mph, launch, rpm, axis, firmness, aim at]
const SHOTS = [
 {name: 'stinger', title: 'Stinger', club: '2 iron', hole: 4, from: fromTee, mph: 152, vla: 7.5, spin: 2800, axis: 0},
 {name: 'high-draw', title: 'High draw', club: 'Driver', hole: 2, from: fromTee, mph: 167, vla: 13, spin: 2400, axis: -6},
 {name: 'power-fade', title: 'Power fade', club: 'Driver', hole: 8, from: fromTee, mph: 167, vla: 10.5, spin: 3000, axis: 5},
 {name: 'knockdown', title: 'Knockdown', club: '7 iron', hole: 0, from: h => behindPin(h, 165), mph: 0, vla: 12, spin: 5500, axis: 0, atPin: true, solve: 'total'},
 {name: 'flop', title: 'Flop shot', club: '60 degree', hole: 3, from: h => behindPin(h, 22), mph: 0, vla: 45, spin: 2800, axis: 0, atPin: true, solve: 'total'},
 {name: 'zip-back', title: 'Zip-back', club: '56 degree', hole: 3, from: h => behindPin(h, 90), mph: 0, vla: 30, spin: 9600, axis: 0, atPin: true, firmness: 'Soft', solve: 'carry', past: 5},
];
const plan = [];
for (const s of SHOTS) {
 const h = w.holes[s.hole], origin = s.from(h), course = Object.create(h);
 const turf = turfConfig(s.firmness ? {firmness: FIRMNESS_PRESETS[s.firmness]} : {});
 // Aim: at the pin for approaches; for tee shots down the centreline at 250 yd,
 // offset so the curve finishes the ball back near the middle.
 const target = s.atPin ? h.pin : {x: fairwayMid(h, 220), z: 220};
 let aim = Math.atan2(target.x - origin.x, target.z - origin.z) * DEG;
 const shot = mph => ({origin, aim, hla: 0, vla: s.vla, spin: s.spin, spinAxis: s.axis, speed: mph * MPH});
 const pinDist = Math.hypot(h.pin.x - origin.x, h.pin.z - origin.z);
 let mph = s.mph;
 const along0 = (q, a) => (q.x - origin.x) * Math.sin(a / DEG) + (q.z - origin.z) * Math.cos(a / DEG);
 const goal = s.solve === 'carry' ? pinDist + s.past * YARD : pinDist, measure = r => s.solve === 'carry' ? r.carry : along0(r.end, aim);
 if (s.solve) { let lo = 5, hi = 140; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (measure(simulateShot(shot(mid), course, {turf})) < goal) lo = mid; else hi = mid; } mph = (lo + hi) / 2; }
 let r = simulateShot(shot(mph), course, {turf});
 if (!s.atPin) {
  // Start it where the curve will bring it back to the middle of the fairway.
  // The curve, measured off the line it started on, is the same whichever way
  // it is aimed, so aim off the target by exactly that much.
  for (let k = 0; k < 3; k++) {
   const a = aim / DEG, dx = r.end.x - origin.x, dz = r.end.z - origin.z;
   const along = dx * Math.sin(a) + dz * Math.cos(a), side = dx * Math.cos(a) - dz * Math.sin(a);
   const tz = origin.z + along, tx = fairwayMid(h, tz);
   aim = (Math.atan2(tx - origin.x, tz - origin.z) - Math.atan2(side, along)) * DEG;
   r = simulateShot(shot(mph), course, {turf});
  }
 }
 // Positive side is the golfer's right, which is local -x (physics.js, simulateShot).
 const rad = aim / DEG, along = q => (q.x - origin.x) * Math.sin(rad) + (q.z - origin.z) * Math.cos(rad), side = q => (q.z - origin.z) * Math.sin(rad) - (q.x - origin.x) * Math.cos(rad);
 let peak = 0; for (const q of r.points) peak = Math.max(peak, side(q) * Math.sign(s.axis || 1));
 const total = along(r.end) / YARD;
 const row = {...s, from: undefined, mph: +mph.toFixed(1), speedMps: +(mph * MPH).toFixed(2), origin: {x: +origin.x.toFixed(3), z: +origin.z.toFixed(3)}, aim: +aim.toFixed(3),
  carry: +(r.carry / YARD).toFixed(1), total: +total.toFixed(1), apexFt: +(r.apex / .3048).toFixed(1), apexYd: +(r.apex / YARD).toFixed(1),
  curveYd: +(side(r.end) / YARD).toFixed(1), descent: +r.descentAngle.toFixed(0), landedFrom: +((Math.max(...r.points.map(along)) - along(r.end)) / YARD).toFixed(1),
  lie: h.surface(origin.x, origin.z), toPin: s.atPin ? +(Math.hypot(r.end.x - h.pin.x, r.end.z - h.pin.z) / YARD).toFixed(1) : null, finishedOn: h.surface(r.end.x, r.end.z), seconds: +r.time.toFixed(2), firmness: s.firmness ? FIRMNESS_PRESETS[s.firmness] : null};
 // Where and when it first comes down, and the cameras that film it: a fixed one
 // behind the ball down the line it starts on, then -- for all but the flop --
 // a cut just before it lands to one beside the landing that turns with the ball.
 const land = r.points.find(q => q.t > .3 && q.y <= h.height(q.x, q.z) + .05) ?? r.end;
 const dir = {x: Math.sin(rad), z: Math.cos(rad)}, right = {x: dir.z, z: -dir.x};
 const at = (q, back, side, up) => ({x: +(q.x - dir.x * back + right.x * side).toFixed(2), z: +(q.z - dir.z * back + right.z * side).toFixed(2), up});
 // Up and back from the ball, looking at where it will come down, so the fairway
 // over the crest of a raised tee is in the picture; then a longer lens close
 // beside the landing, because a ball is two pixels wide from 25 m on a normal one.
 const ground = (q, up) => ({x: +q.x.toFixed(2), z: +q.z.toFixed(2), up});
 const mid = {x: (land.x + r.end.x) / 2, z: (land.z + r.end.z) / 2};
 row.landing = {x: +land.x.toFixed(2), z: +land.z.toFixed(2), t: +land.t.toFixed(2)};
 const behind = s.atPin ? {from: -1, eye: at(origin, s.name === 'flop' ? 5 : 7, 0, s.name === 'flop' ? 2 : 3), look: ground(land, 0), fov: 40}
  : {from: -1, eye: at(origin, 10, 0, 4.5), look: ground(land, 0), fov: 40};
 const beside = {from: +(land.t - .8).toFixed(2), eye: at(mid, 0, s.atPin ? 9 : 13, 2), look: 'ball', fov: s.atPin ? 26 : 24};
 row.cameras = [behind, beside];
 plan.push(row);
 console.log(`${s.title.padEnd(11)} ${s.club.padEnd(10)} ${String(row.mph).padStart(5)} mph ${String(s.vla).padStart(4)} deg ${String(s.spin).padStart(5)} rpm axis ${String(s.axis).padStart(2)} | carry ${String(row.carry).padStart(5)} total ${String(row.total).padStart(5)} apex ${String(row.apexYd).padStart(4)} yd (${row.apexFt} ft) descent ${row.descent} deg curve ${row.curveYd} yd back ${row.landedFrom} yd ${row.lie} -> ${row.finishedOn}${row.toPin !== null ? ' ' + row.toPin + ' yd from pin' : ''}`);
}
fs.writeFileSync(`${OUT}/plan.json`, JSON.stringify({course: COURSE, shots: plan}, null, 1));
