// How far a spun ball comes back on a green, held to the owner's table of
// 13 October 2026 (RESEARCH.md, *Spin-back reined in*). Before it the ball came
// back about three times a tour player's best: 5.4 yd on a Normal green at
// 10,000 rpm and 18 yd on Soft at 12,000. tools/green-fit.mjs fits to the same
// targets and prints how each is met; these are the ones a player would notice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot, R, YARD, MPH} from '../src/physics.js';
import {turfConfig} from '../src/turf.js';

const ground = surface => ({height: () => 0, surface: () => surface,
 pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
const FIRMS = ['Soft', 'Normal', 'Firm', 'Burnt'];
// A full wedge launched at 31 degrees, its ball speed solved for a 100 yd carry
// at each spin, so it lands at about 52 degrees whatever the spin.
const WEDGE = {7000: 82.97, 8500: 84.78, 10000: 86.19, 11000: 86.9, 12000: 87.47};
function land(mph, vla, spin, firmness) {
 const r = simulateShot({speed: mph * MPH, vla, hla: 0, spin, spinAxis: 0, origin: {x: 0, z: 0}, aim: 0},
  ground('green'), {turf: turfConfig({firmness, stimp: 10})});
 const after = r.points.filter(q => q.t >= r.hang);
 const far = Math.max(...after.map(q => q.z));
 // The first hop: where the ball comes down again after its first bounce.
 let i = 1; while (i < after.length && after[i].y >= after[i - 1].y) i++;
 while (i < after.length && after[i].y - R > 0.002) i++;
 return {back: (far - r.end.z) / YARD, release: (r.end.z - r.carry) / YARD,
  hop: ((after[i] ?? after[after.length - 1]).z - r.carry) / YARD};
}
const wedge = (spin, f) => land(WEDGE[spin], 31, spin, f);

test('an 8,500 rpm wedge checks and does not come back on a Normal green', () => {
 const r = wedge(8500, 'Normal');
 assert.ok(r.back < 0.15, `came back ${r.back.toFixed(2)} yd`);
 assert.ok(r.release > -0.1 && r.release < 1.5, `finished ${r.release.toFixed(2)} yd from its mark`);
 // Nothing under 8,500 comes back on any green.
 for (const f of FIRMS) for (const spin of [7000, 8500].filter(s => f !== 'Soft' || s === 7000))
  assert.ok(wedge(spin, f).back < 0.15, `${spin} rpm came back on ${f}`);
});

test('come-back starts near 10,000 rpm on a Normal green', () => {
 const at10 = wedge(10000, 'Normal').back, at11 = wedge(11000, 'Normal').back;
 assert.ok(at10 < 0.8, `10,000 rpm came back ${at10.toFixed(2)} yd`);
 assert.ok(at11 > 0.4, `11,000 rpm only came back ${at11.toFixed(2)} yd`);
});

test('12,000 rpm comes back about 4 yd at most, and Soft most of all', () => {
 const backs = FIRMS.map(f => wedge(12000, f).back);
 assert.ok(backs[0] > 3 && backs[0] < 4.8, `Soft came back ${backs[0].toFixed(2)} yd`);
 for (let i = 1; i < 4; i++)
  assert.ok(backs[i] <= backs[i - 1] + 0.05, `${FIRMS[i]} came back further than ${FIRMS[i - 1]}: ${backs.map(b => b.toFixed(2)).join(', ')}`);
 // Burnt: almost impossible.
 assert.ok(backs[3] < 1, `Burnt came back ${backs[3].toFixed(2)} yd`);
});

test('the come-back ladder holds at every spin: Soft, then Normal, Firm, Burnt', () => {
 for (const spin of [10000, 11000]) {
  const backs = FIRMS.map(f => wedge(spin, f).back);
  for (let i = 1; i < 4; i++)
   assert.ok(backs[i] <= backs[i - 1] + 0.05, `${spin} rpm: ${backs.map(b => b.toFixed(2)).join(', ')}`);
 }
});

test('more spin never brings a ball back less', () => {
 for (const f of FIRMS) {
  const backs = [8500, 10000, 11000, 12000].map(s => wedge(s, f).back);
  for (let i = 1; i < backs.length; i++)
   assert.ok(backs[i] >= backs[i - 1] - 0.05, `${f}: ${backs.map(b => b.toFixed(2)).join(', ')}`);
 }
});

test('a steeper landing comes back sooner', () => {
 // 70 yd at 42 degrees launch lands at about 56 degrees; at 10,000 rpm it comes
 // back where the 52 degree wedge only just starts to.
 const steep = land(70.08, 42, 10000, 'Normal').back, full = wedge(10000, 'Normal').back;
 assert.ok(steep > 0.2, `the steep wedge came back ${steep.toFixed(2)} yd`);
 assert.ok(steep >= full - 0.05, `steep ${steep.toFixed(2)} against full ${full.toFixed(2)}`);
});

test('a 7 iron still stops, and its first hop goes forward', () => {
 const run = FIRMS.map(f => land(115.92, 16.3, 7000, f));
 assert.ok(run[1].release > 4 && run[1].release < 12, `Normal ran ${run[1].release.toFixed(1)} yd`);
 for (let i = 1; i < 4; i++) assert.ok(run[i].release > run[i - 1].release, 'a firmer green must run further');
 for (const r of run) assert.ok(r.hop > 0.3, `the first hop went ${r.hop.toFixed(2)} yd`);
});
