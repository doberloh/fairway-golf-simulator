// The chipping and approach clips: fifteen shots on hole 4 of the test course
// (pnw REPORT1, no wind), at 10, 20, 50, 80 and 100 yards, each in three styles
// from low-and-running to high-and-soft. Launch angle and spin are set per style
// on published numbers; ball speed is SOLVED, in the hole's own terrain, for the
// carry the style aims at. Writes the plan the clip recorder plays.
//
//   node tools/landing-report/approach-plan.mjs     -> docs/reports/chipping/plan.json
//
// Anchors (RESEARCH.md, After the ball lands): Trackman's chips launch 6-35 deg
// on 1,500-3,000 rpm and never over 3,750; a 54 deg wedge to 50 yards launches
// about 28 deg on 6,500 rpm; a full tour pitching wedge about 24 deg on 9,300.
import fs from 'node:fs';
import {generateWorld, DEFAULT_COURSE} from '../../src/course.js';
import {simulateShot, YARD, MPH} from '../../src/physics.js';
import {turfConfig} from '../../src/turf.js';

const OUT = 'docs/reports/chipping';
fs.mkdirSync(OUT, {recursive: true});
const COURSE = {biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0}, HOLE = 3;
const w = generateWorld({...DEFAULT_COURSE, ...COURSE}), h = w.holes[HOLE], turf = turfConfig({}), DEG = 180 / Math.PI;
const pin = h.pin, tdx = h.tee.x - pin.x, tdz = h.tee.z - pin.z, td = Math.hypot(tdx, tdz), ux = tdx / td, uz = tdz / td;
// The front of the green on this line, for the chips.
let front = 0; while (h.surface(pin.x + ux * front, pin.z + uz * front) === 'green') front += .1;
// [yards, style, club, launch deg, spin rpm, share of the distance carried]
const STYLES = [
 [10, 'Bump and run', '7 iron', 12, 900, .25], [10, 'Chip', 'Pitching wedge', 24, 1700, .45], [10, 'Lob chip', '60 degree', 38, 2600, .7],
 [20, 'Bump and run', '7 iron', 13, 1300, .25], [20, 'Chip', 'Pitching wedge', 24, 2300, .45], [20, 'Lob chip', '60 degree', 36, 3200, .7],
 [50, 'Low pitch', '52 degree', 22, 5800, .72], [50, 'Pitch', '54 degree', 28, 6500, .9], [50, 'High soft pitch', '60 degree', 35, 6000, .95],
 [80, 'Punch', '9 iron', 18, 7000, .74], [80, 'Wedge', 'Pitching wedge', 26, 8000, .92], [80, 'High wedge', '56 degree', 32, 8500, .95],
 [100, 'Punch', '8 iron', 16, 6500, .72], [100, 'Full wedge', 'Pitching wedge', 24, 9000, .95], [100, 'High full wedge', '52 degree', 28, 9500, .97],
];
const plan = [];
for (const [yards, style, club, vla, spin, share] of STYLES) {
 // Chips start just off the front of the green; longer shots that far from the pin.
 const back = yards <= 20 ? front + 1.2 : yards * YARD;
 const origin = {x: pin.x + ux * back, z: pin.z + uz * back};
 // Aim along the line, so a chip aimed at a far pin travels the line to it.
 const aim = Math.atan2(pin.x - origin.x, pin.z - origin.z) * DEG;
 const want = yards * YARD * share, course = Object.create(h);
 const fire = speed => simulateShot({origin, aim, hla: 0, vla, spin, spinAxis: 0, speed}, course, {turf});
 let lo = 1, hi = 80;
 for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fire(mid).carry < want) lo = mid; else hi = mid; }
 const speed = (lo + hi) / 2, r = fire(speed);
 const along = q => (q.x - origin.x) * Math.sin(aim / DEG) + (q.z - origin.z) * Math.cos(aim / DEG);
 const total = along(r.end) / YARD, carry = r.carry / YARD;
 plan.push({yards, style, club, vla, spin, speedMps: +speed.toFixed(2), mph: +(speed / MPH).toFixed(1), rpmPerMph: Math.round(spin / (speed / MPH)),
  carry: +carry.toFixed(1), roll: +(total - carry).toFixed(1), total: +total.toFixed(1), apexFt: +(r.apex / .3048).toFixed(1), seconds: +r.time.toFixed(2),
  lie: h.surface(origin.x, origin.z), finishedOn: h.surface(r.end.x, r.end.z), toPin: +(Math.hypot(r.end.x - pin.x, r.end.z - pin.z) / YARD).toFixed(1),
  origin: {x: +origin.x.toFixed(3), z: +origin.z.toFixed(3)}, aim: +aim.toFixed(3)});
 const p = plan.at(-1);
 console.log(`${String(yards).padStart(3)} yd ${style.padEnd(16)} ${club.padEnd(15)} ${String(p.mph).padStart(5)} mph ${String(vla).padStart(2)} deg ${String(spin).padStart(5)} rpm (${p.rpmPerMph}/mph)  carry ${String(p.carry).padStart(5)}  roll ${String(p.roll).padStart(5)}  apex ${p.apexFt} ft  ${p.lie} -> ${p.finishedOn}`);
}
fs.writeFileSync(`${OUT}/plan.json`, JSON.stringify({course: COURSE, hole: HOLE, shots: plan}, null, 1));
