// The charts in docs/reports/ball-landing/, drawn from the real physics: this
// branch's ("after") and main's ("before", read with `git show main:src/physics.js`
// into a temporary module beside the real one and deleted afterwards).
//
//   node tools/landing-report/charts.mjs
import fs from 'node:fs';
import {execSync} from 'node:child_process';
import {simulateShot as after, R, YARD, MPH, CUP_RADIUS} from '../../src/physics.js';
import {turfConfig} from '../../src/turf.js';
import {customizeClubs, manualLaunch} from '../../src/clubs.js';
import {generateWorld, DEFAULT_COURSE} from '../../src/course.js';

const OUT = 'docs/reports/ball-landing';
fs.mkdirSync(OUT, {recursive: true});
const TMP = 'src/physics-before.tmp.mjs';
fs.writeFileSync(TMP, execSync('git show main:src/physics.js'));
const {simulateShot: before} = await import('../../' + TMP);
fs.rmSync(TMP);

const turf = turfConfig({}), clubs = customizeClubs(), DEG = 180 / Math.PI;
const flat = surface => ({height: () => 0, surface: () => surface, pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
const BEFORE = '#d9822b', AFTER = '#3f9d5a', INK = '#25362c', DIM = '#7b8a7e', GRID = '#dfe5dc';

// A small, plain chart: axes, grid, series of points, labels. Everything in one
// scale so labels name values the chart actually reaches.
function chart({w = 640, h = 340, x, y, series, title, xLabel, yLabel, bands = [], notes = [], square = false}) {
 const m = {l: 58, r: 18, t: 34, b: 44}, W = w - m.l - m.r, H = h - m.t - m.b;
 let [x0, x1] = x.range, [y0, y1] = y.range;
 if (square) { const sx = W / (x1 - x0), sy = H / (y1 - y0), s = Math.min(sx, sy); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = cx - W / s / 2; x1 = cx + W / s / 2; y0 = cy - H / s / 2; y1 = cy + H / s / 2; }
 const X = v => m.l + (v - x0) / (x1 - x0) * W, Y = v => m.t + H - (v - y0) / (y1 - y0) * H;
 let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="Inter,Segoe UI,sans-serif" font-size="12">`;
 s += `<rect width="${w}" height="${h}" fill="#fbfcf9"/>`;
 s += `<text x="${m.l}" y="20" font-size="14" font-weight="600" fill="${INK}">${title}</text>`;
 for (const b of bands) s += `<rect x="${X(b.x0)}" y="${Y(b.y1)}" width="${X(b.x1) - X(b.x0)}" height="${Y(b.y0) - Y(b.y1)}" fill="${b.fill}" opacity=".35"/><text x="${X(b.x0) + 4}" y="${Y(b.y1) + 14}" fill="${DIM}" font-size="11">${b.label}</text>`;
 for (const t of x.ticks) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + H}" stroke="${GRID}"/><text x="${X(t)}" y="${m.t + H + 16}" text-anchor="middle" fill="${DIM}">${t}</text>`;
 for (const t of y.ticks) s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" fill="${DIM}">${t}</text>`;
 s += `<text x="${m.l + W / 2}" y="${h - 8}" text-anchor="middle" fill="${INK}">${xLabel}</text>`;
 s += `<text transform="translate(14 ${m.t + H / 2}) rotate(-90)" text-anchor="middle" fill="${INK}">${yLabel}</text>`;
 s += `<clipPath id="c"><rect x="${m.l}" y="${m.t}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#c)">`;
 for (const ser of series) {
  if (ser.points) s += `<polyline fill="none" stroke="${ser.color}" stroke-width="${ser.width ?? 2.2}" ${ser.dash ? `stroke-dasharray="${ser.dash}"` : ''} points="${ser.points.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(' ')}"/>`;
  for (const d of ser.dots || []) s += `<circle cx="${X(d[0])}" cy="${Y(d[1])}" r="${d[2] ?? 4}" fill="${d[3] ?? ser.color}" stroke="#fff" stroke-width="1"/>`;
  if (ser.circle) s += `<circle cx="${X(ser.circle.x)}" cy="${Y(ser.circle.y)}" r="${Math.abs(X(ser.circle.r) - X(0))}" fill="${ser.circle.fill ?? 'none'}" stroke="${ser.color}" stroke-width="1.5"/>`;
 }
 s += '</g>';
 let ly = m.t + 6;
 for (const ser of series.filter(q => q.label)) { s += `<rect x="${m.l + W - 190}" y="${ly}" width="12" height="3" fill="${ser.color}"/><text x="${m.l + W - 172}" y="${ly + 5}" fill="${INK}">${ser.label}</text>`; ly += 16; }
 for (const n of notes) s += `<text x="${X(n.x)}" y="${Y(n.y)}" fill="${n.color ?? INK}" font-size="11" text-anchor="${n.anchor ?? 'start'}">${n.text}</text>`;
 return s + '</svg>';
}
const save = (name, svg) => { fs.writeFileSync(`${OUT}/${name}.svg`, svg); console.log(`${name}.svg`); };

// 1. Keyboard wedge spin against carry, old rule and new, with Trackman's bands.
{
 const pts = rule => { const out = []; for (let p = .06; p <= 1.0001; p += .02) { const shot = {...manualLaunch(clubs.wedge, p, 1), origin: {x: 0, z: 0}, aim: 0}; if (rule === 'old') shot.spin = clubs.wedge.spin * Math.sqrt(p); out.push([after(shot, flat('green'), {turf}).carry / YARD, shot.spin]); } return out; };
 save('spin-vs-carry', chart({title: 'Keyboard pitching wedge: spin against carry', xLabel: 'carry (yards)', yLabel: 'spin (rpm)',
  x: {range: [0, 100], ticks: [0, 20, 40, 60, 80, 100]}, y: {range: [0, 9500], ticks: [0, 2000, 4000, 6000, 8000]},
  bands: [{x0: 1.25, x1: 24, y0: 1500, y1: 3000, fill: '#9fd3ad', label: 'Trackman chips, average'}, {x0: 47, x1: 53, y0: 6000, y1: 7300, fill: '#9fd3ad', label: '50 yd wedge'}],
  series: [{points: pts('old'), color: BEFORE, label: 'before (square root of power)'}, {points: pts('new'), color: AFTER, label: 'after'}]}));
}
// 2. A 17% chip on a flat green, side view.
{
 const base = {...manualLaunch(clubs.wedge, .17, 1), origin: {x: 0, z: 0}, aim: 0};
 const side = r => r.points.map(q => [q.z / YARD, (q.y - R) / YARD * 3]);
 const rb = after({...base, spin: clubs.wedge.spin * Math.sqrt(.17)}, flat('green'), {turf}), ra = after(base, flat('green'), {turf});
 save('chip-side', chart({title: 'A 17% keyboard wedge chip on a flat green (height x3)', xLabel: 'distance (yards)', yLabel: 'height (yd, x3)',
  x: {range: [0, 10], ticks: [0, 2, 4, 6, 8, 10]}, y: {range: [0, 2.4], ticks: [0, .5, 1, 1.5, 2]},
  series: [{points: side(rb), color: BEFORE, label: `before: ${Math.round(clubs.wedge.spin * Math.sqrt(.17))} rpm`, dots: [[rb.end.z / YARD, 0, 5]]},
   {points: side(ra), color: AFTER, label: `after: ${Math.round(base.spin)} rpm`, dots: [[ra.end.z / YARD, 0, 5]]}],
  notes: [{x: rb.end.z / YARD, y: .12, text: 'finishes', color: BEFORE, anchor: 'middle'}, {x: ra.end.z / YARD, y: .12, text: 'finishes', color: AFTER, anchor: 'middle'}]}));
}
// 3 and 4 use the game's own course.
const w = generateWorld({...DEFAULT_COURSE, biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0});
// 3. The bunker shot from the clip: position along the line of play over time.
{
 const h = w.holes[1], origin = {x: -126.46, z: 159.64}, aim = 95.16, rad = aim / DEG, course = Object.create(h);
 const shot = {...manualLaunch(clubs.wedge, 1, 1), origin, aim};
 const along = q => (q.x - origin.x) * Math.sin(rad) + (q.z - origin.z) * Math.cos(rad);
 const track = r => { const land = r.points.findIndex(q => q.t > .8 && q.y - h.height(q.x, q.z) - R < .01); const t0 = r.points[land].t, a0 = along(r.points[land]); return r.points.slice(land).map(q => [q.t - t0, along(q) - a0]); };
 const tb = track(before(shot, course, {turf})), ta = track(after(shot, course, {turf}));
 save('bunker-track', chart({title: 'Full wedge into the bunker on hole 2: where the ball is after it lands', xLabel: 'seconds after landing', yLabel: 'metres past the pitch mark',
  x: {range: [0, 4], ticks: [0, 1, 2, 3, 4]}, y: {range: [-3.5, 1.5], ticks: [-3, -2, -1, 0, 1]},
  series: [{points: tb, color: BEFORE, label: 'before'}, {points: ta, color: AFTER, label: 'after'}, {points: [[0, 0], [4, 0]], color: DIM, width: 1, dash: '4 4'}],
  notes: [{x: 3.9, y: .15, text: 'pitch mark', color: DIM, anchor: 'end'}]}));
}
// 4. The putt from the clip: how far round the inside of the cup it travels.
{
 const h = w.holes[6], course = Object.create(h), pin = h.pin, lip = h.height(pin.x, pin.z);
 const shot = {aim: 87.852, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed: 1.8, roll: 1.62, origin: {x: -8.02, z: 119.05}};
 const round = r => { const out = []; let swept = 0, last = null, t0 = null;
  for (const q of r.points.slice(0, r.holed ? -26 : undefined)) {
   if (Math.hypot(q.x - pin.x, q.z - pin.z) >= CUP_RADIUS || q.y >= lip + R - .002) continue;
   const a = Math.atan2(q.x - pin.x, q.z - pin.z);
   if (t0 === null) t0 = q.t; if (last !== null) { let d = a - last; d = ((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; swept += Math.abs(d); }
   last = a; out.push([q.t - t0, swept * DEG]);
  } return out; };
 const pb = round(before(shot, course, {turf})), pa = round(after(shot, course, {turf}));
 save('cup-round', chart({title: 'A putt that drops: how far it goes round the inside of the cup', xLabel: 'seconds after it drops below the lip', yLabel: 'degrees round the cup',
  x: {range: [0, 1.2], ticks: [0, .2, .4, .6, .8, 1, 1.2]}, y: {range: [0, 1500], ticks: [0, 360, 720, 1080, 1440]},
  series: [{points: pb, color: BEFORE, label: `before: ${Math.round(pb.at(-1)[1])} degrees`, dots: [pb.at(-1)]}, {points: pa, color: AFTER, label: `after: ${Math.round(pa.at(-1)[1])} degrees`, dots: [pa.at(-1)]}],
  notes: [{x: 1.18, y: 380, text: 'one lap', color: DIM, anchor: 'end'}, {x: 1.18, y: 740, text: 'two laps', color: DIM, anchor: 'end'}, {x: 1.18, y: 1100, text: 'three laps', color: DIM, anchor: 'end'}]}));
}
// 5. An iron landing on a side slope: how far the hop turns.
{
 const plane = pct => ({height: x => -x * pct / 100, surface: () => 'green', pin: {x: 9e9, z: 9e9}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}});
 const turn = pct => { const c = plane(pct), r = after({aim: 0, hla: 0, vla: -45, spin: 6000, spinAxis: 0, speed: 25, height: 12, origin: {x: 0, z: -12}}, c, {turf}); const cs = []; for (let i = 1; i < r.points.length - 1; i++) { const q = r.points[i]; if (q.y - c.height(q.x, q.z) - R < .003 && r.points[i - 1].y >= q.y && (!cs.length || Math.hypot(q.x - cs.at(-1).x, q.z - cs.at(-1).z) > .3)) cs.push(q); if (cs.length >= 2) break; } return Math.atan2(cs[1].x - cs[0].x, cs[1].z - cs[0].z) * DEG; };
 const pts = []; for (let p = 0; p <= 6; p += .5) pts.push([p, turn(p)]);
 save('slope-turn', chart({title: 'An iron landing on a side slope: how far the first hop turns downhill', xLabel: 'cross-slope (%)', yLabel: 'turn (degrees)',
  x: {range: [0, 6], ticks: [0, 1, 2, 3, 4, 5, 6]}, y: {range: [0, 20], ticks: [0, 5, 10, 15, 20]},
  series: [{points: pts, color: AFTER, dots: pts.filter(([p]) => Number.isInteger(p))}],
  notes: [{x: .2, y: 18, text: 'about 3.3 degrees per 1% -- unchanged by this pass', color: DIM}]}));
}
