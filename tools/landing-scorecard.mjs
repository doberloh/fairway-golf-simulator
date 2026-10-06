// What a ball does after it lands, against every outside anchor this project
// uses -- fairway run-out, green check, chip carry-to-roll -- in one table.
//
//   node tools/landing-scorecard.mjs                 the model as it stands
//   node tools/landing-scorecard.mjs --levers        plus what each tuning lever would do
//   node tools/landing-scorecard.mjs --set k=v,...   with AERO constants changed (a
//                                                    candidate flight fit, before applying it)
//
// Anchors and their sources are in docs/BALL_BEHAVIOUR_KNOBS.md ("What each
// surface is anchored to") and RESEARCH.md. Nothing here is fitted: it reports.
import {simulateShot, YARD, MPH, contactOf, AERO} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';
import {customizeClubs, manualLaunch} from '../src/clubs.js';
import {FIRMNESS_PRESETS} from '../src/firmness.js';

// Before the clubs are built: their speeds are solved against the flight.
{
 const i = process.argv.indexOf('--set');
 if (i >= 0) for (const kv of process.argv[i + 1].split(',')) { const [k, v] = kv.split('='); AERO[k] = v === 'true' ? true : v === 'false' ? false : +v; }
}
const clubs = customizeClubs();
const ground = surface => ({height: () => 0, surface: () => surface,
 pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
// Launch-monitor inputs, mph / deg / deg / rpm / deg, as RESEARCH.md states them.
const lm = (mph, vla, spin) => ({speed: mph * MPH, vla, hla: 0, spin, spinAxis: 0, origin: {x: 0, z: 0}, aim: 0});
function run(shot, surface, options = {}) {
 const r = simulateShot(shot, ground(surface), {turf: turfConfig({firmness: options.firmness, ...(options.rollSpeedGain !== undefined ? {rollSpeedGain: options.rollSpeedGain} : {})}), ...options});
 let far = 0; for (const q of r.points) far = Math.max(far, q.z);
 return {carry: r.carry / YARD, roll: (r.end.z - r.carry) / YARD, back: (far - r.end.z) / YARD};
}
const rows = options => [
 // Fairway: published total minus carry for a tour driver, 3 wood, 5 iron.
 ['fairway', 'Driver (keyboard, full)', () => run(manualLaunch(clubs.driver, 1, 1) && {...manualLaunch(clubs.driver, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'fairway', options), r => r.roll, '21 yd run'],
 ['fairway', '3 wood (keyboard, full)', () => run({...manualLaunch(clubs.wood, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'fairway', options), r => r.roll, '19 yd run'],
 ['fairway', '5 iron (keyboard, full)', () => run({...manualLaunch(clubs.iron5, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'fairway', options), r => r.roll, '15 yd run'],
 // Green: tour backspin tops out at 15-20 feet (5-7 yd) back.
 ['green', 'Pitching wedge (full)', () => run({...manualLaunch(clubs.wedge, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'green', options), r => r.roll, 'checks, under 7 yd back'],
 ['green', '9 iron (full)', () => run({...manualLaunch(clubs.iron9, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'green', options), r => r.roll, 'small release'],
 ['green', '7 iron (full)', () => run({...manualLaunch(clubs.iron7, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'green', options), r => r.roll, 'a few yards'],
 // Chips: carry-to-roll. Inputs from RESEARCH.md's chipping table.
 ['green', 'PW chip 25/21/1000', () => run(lm(25, 21, 1000), 'green', options), r => r.roll / r.carry, '1:3'],
 ['green', '52 chip 23/28/1100', () => run(lm(23, 28, 1100), 'green', options), r => r.roll / r.carry, '1:2'],
 ['green', '56 chip 22/36/1150', () => run(lm(22, 36, 1150), 'green', options), r => r.roll / r.carry, '1:1'],
 ['green', '60 chip 20/45/1300', () => run(lm(20, 45, 1300), 'green', options), r => r.roll / r.carry, '1:1'],
];
function table(label, options) {
 console.log(`\n${label}`);
 for (const [surface, name, go, metric, want] of rows(options)) {
  const r = go(), m = metric(r);
  const shown = want.startsWith('1:') ? `1:${m.toFixed(1)}` : `${m.toFixed(1)} yd${r.back > .2 ? ` (came back ${r.back.toFixed(1)})` : ''}`;
  console.log(`  ${surface.padEnd(8)} ${name.padEnd(26)} ${shown.padEnd(24)} want ${want}`);
 }
}
table('The model as it stands (Normal firmness, Stimp 10)', {});
console.log('\nFirmness ladder, 7 iron and pitching wedge on a green (roll yd, positive forward):');
for (const [name, depth] of Object.entries(FIRMNESS_PRESETS)) {
 const a = run({...manualLaunch(clubs.iron7, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'green', {firmness: depth});
 const b = run({...manualLaunch(clubs.wedge, 1, 1), origin: {x: 0, z: 0}, aim: 0}, 'green', {firmness: depth});
 console.log(`  ${name.padEnd(7)} 7 iron ${a.roll.toFixed(1).padStart(5)}   wedge ${b.roll.toFixed(1).padStart(5)}`);
}
// THE SAME SHOTS EVERY TIME, FROM TRACKMAN'S PUBLISHED PGA TOUR AVERAGES (ball
// mph, launch, spin; RESEARCH.md *The aerodynamic curve*). The keyboard clubs
// above re-solve their speed for their carry whenever the flight changes, which
// can hide what a flight change does to the landing; these cannot move.
console.log("\nTrackman PGA tour inputs (land = the model's descent angle; Trackman says 38 / 49 / 50 / 52):");
for (const [name, mph, vla, spin, land] of [['Driver', 167, 10.9, 2686, 38], ['5 iron', 132, 12.1, 5361, 49], ['7 iron', 120, 16.3, 7097, 50], ['PW', 102, 24.2, 9304, 52]]) {
 const shot = lm(mph, vla, spin), r = simulateShot(shot, ground('fairway'), {turf: turfConfig({})});
 const out = [`fairway ${run(shot, 'fairway').roll.toFixed(1).padStart(5)}`];
 if (name !== 'Driver') for (const [f, depth] of [['Normal green', FIRMNESS_PRESETS.Normal], ['Soft green', FIRMNESS_PRESETS.Soft]]) {
  const g = run(shot, 'green', {firmness: depth});
  out.push(`${f} ${g.roll.toFixed(1).padStart(5)}${g.back > .2 ? ` (back ${g.back.toFixed(1)})` : ''}`);
 }
 console.log(`  ${name.padEnd(7)} carry ${(r.carry / YARD).toFixed(0).padStart(3)}  land ${r.descentAngle.toFixed(0)}  roll yd: ${out.join('   ')}`);
}
if (process.argv.includes('--levers')) {
 const green = contactOf('green');
 // Each lever applied to the GREEN contact only, so the fairway rows show none
 // of it -- these exist to show what a lever does to chips against full shots.
 table('Lever: green spin gain x1.5 (more backspin scrubbed at contact)', {compliant: {spinGain: green.spin * 1.5}});
 table('Lever: green friction x0.8', {compliant: {friction: green.mu * .8}});
 table('Lever: green ploughing x0.6', {ploughScale: .6});
 table('Lever: restitution x0.8 (lower hops)', {corScale: .8});
 // Rolling resistance rising with speed (turf.js): k = 1 today, and unanchored.
 table('Lever: roll resistance rises half as fast with speed (k 0.5)', {rollSpeedGain: .5});
 table('Lever: roll resistance flat at every speed (k 0)', {rollSpeedGain: 0});
}
