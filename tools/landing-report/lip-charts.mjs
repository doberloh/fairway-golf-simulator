// The charts in docs/reports/lip-grip/: the lip grip cap against the physics
// the commit before it. Runs rim-study.mjs on both (the "before" read with
// `git show <ref>:src/physics.js` into a temporary module, deleted afterwards).
//
//   node tools/landing-report/lip-charts.mjs [beforeRef=5d801bf]
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {turfConfig, rollDeceleration} from '../../src/turf.js';

const OUT = 'docs/reports/lip-grip', ref = process.argv[2] || '5d801bf';
fs.mkdirSync(OUT, {recursive: true});
const TMP = 'src/physics-before.tmp.mjs', SCRATCH = 'bench/shots';
fs.mkdirSync(SCRATCH, {recursive: true});
fs.writeFileSync(TMP, execSync(`git show ${ref}:src/physics.js`));
const study = (physics, json) => { execSync(`node tools/landing-report/rim-study.mjs ${physics} --json ${json}`); return JSON.parse(fs.readFileSync(json, 'utf8')); };
const before = study(TMP, `${SCRATCH}/lip-before.json`), after = study('src/physics.js', `${SCRATCH}/lip-after.json`);
// The friction the lip is given, across the range quoted for a ball on turf.
const sensitivity = {};
for (const mu of [.45, .6, .7]) {
 const f = `src/physics-mu.tmp.mjs`;
 fs.writeFileSync(f, fs.readFileSync('src/physics.js', 'utf8').replace('const lipGrip=WALL_FRICTION*load', `const lipGrip=${mu}*load`));
 sensitivity[mu] = study(f, `${SCRATCH}/lip-mu-${mu}.json`).summary;
 fs.rmSync(f);
}
const {simulateShot: simBefore, R, CUP_RADIUS} = await import(pathToFileURL(path.resolve(TMP)).href);
const {simulateShot: simAfter} = await import('../../src/physics.js');
fs.rmSync(TMP);

const BEFORE = '#d9822b', AFTER = '#3f9d5a', INK = '#25362c', DIM = '#7b8a7e', GRID = '#dfe5dc';
const save = (name, svg) => { fs.writeFileSync(`${OUT}/${name}.svg`, svg); console.log(`${name}.svg`); };
const head = (w, h, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="Inter,Segoe UI,sans-serif" font-size="12"><rect width="${w}" height="${h}" fill="#fbfcf9"/><text x="16" y="22" font-size="14" font-weight="600" fill="${INK}">${title}</text>`;

// 1. How far lip-outs ride round the hole, before and after, Stimp 10 and 13.
{
 const bins = [0, 45, 90, 135, 180, 225, 270, 315, 360, 405];
 const count = (data, stimp) => bins.map((b, i) => data.grid.filter(r => r.stimp === stimp && r.result === 'lipped' && r.ride >= b && (i === bins.length - 1 || r.ride < bins[i + 1])).length);
 const w = 680, h = 330, m = {l: 50, r: 16, t: 50, b: 44}, W = w - m.l - m.r, H = h - m.t - m.b;
 let s = head(w, h, 'How far a lip-out rides round the hole (Stimp 10 and 13, every lip-out in the grid)');
 const series = [['before', BEFORE, [...count(before, 10)].map((v, i) => v + count(before, 13)[i])], ['after', AFTER, [...count(after, 10)].map((v, i) => v + count(after, 13)[i])]];
 const max = Math.max(...series.flatMap(x => x[2])), Y = v => m.t + H - Math.sqrt(v / max) * H, bw = W / bins.length;
 for (const t of [1, 10, 50, 150, 300].filter(t => t <= max)) s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" fill="${DIM}">${t}</text>`;
 series.forEach(([, color, vals], k) => vals.forEach((v, i) => { if (v) s += `<rect x="${m.l + i * bw + 6 + k * (bw - 12) / 2}" y="${Y(v)}" width="${(bw - 12) / 2 - 2}" height="${m.t + H - Y(v)}" fill="${color}"/>`; }));
 bins.forEach((b, i) => s += `<text x="${m.l + i * bw + bw / 2}" y="${m.t + H + 16}" text-anchor="middle" fill="${DIM}">${i === bins.length - 1 ? b + '+' : b + '-' + bins[i + 1]}</text>`);
 s += `<text x="${m.l + W / 2}" y="${h - 8}" text-anchor="middle" fill="${INK}">degrees round the hole before it comes back out</text><text transform="translate(14 ${m.t + H / 2}) rotate(-90)" text-anchor="middle" fill="${INK}">putts (square-root scale)</text>`;
 s += `<rect x="${w - 200}" y="34" width="12" height="10" fill="${BEFORE}"/><text x="${w - 182}" y="43" fill="${INK}">before</text><rect x="${w - 120}" y="34" width="12" height="10" fill="${AFTER}"/><text x="${w - 102}" y="43" fill="${INK}">after</text>`;
 save('ride-lengths', s + '</svg>');
}
// 2. Every putt in the Stimp 10 grid by speed and line: drops, lips out, changed.
{
 const rows = after.grid.filter(r => r.stimp === 10), B = new Map(before.grid.filter(r => r.stimp === 10).map(r => [r.offset + '/' + r.speed, r]));
 const offs = [...new Set(rows.map(r => r.offset))].sort((a, b) => a - b), spds = [...new Set(rows.map(r => r.speed))].sort((a, b) => a - b);
 const w = 680, h = 420, m = {l: 60, r: 150, t: 46, b: 46}, W = w - m.l - m.r, H = h - m.t - m.b, cw = W / offs.length, ch = H / spds.length;
 let s = head(w, h, 'Every putt at Stimp 10: which drop and which lip out, and the ones the change flipped');
 for (const r of rows) {
  const i = offs.indexOf(r.offset), j = spds.indexOf(r.speed), was = B.get(r.offset + '/' + r.speed);
  const fill = r.result === 'holed' ? '#b9dcc2' : '#f1d9bf';
  s += `<rect x="${m.l + i * cw}" y="${m.t + H - (j + 1) * ch}" width="${cw - 1}" height="${ch - 1}" fill="${fill}"/>`;
  if (was.result !== r.result) s += `<rect x="${m.l + i * cw}" y="${m.t + H - (j + 1) * ch}" width="${cw - 1}" height="${ch - 1}" fill="none" stroke="${INK}" stroke-width="2"/>`;
 }
 offs.forEach((o, i) => { if (i % 4 === 0) s += `<text x="${m.l + i * cw + cw / 2}" y="${m.t + H + 16}" text-anchor="middle" fill="${DIM}">${Math.round(o * 1000)}</text>`; });
 spds.forEach((v, j) => { if (j % 4 === 0) s += `<text x="${m.l - 6}" y="${m.t + H - j * ch - ch / 2 + 4}" text-anchor="end" fill="${DIM}">${v.toFixed(1)}</text>`; });
 s += `<text x="${m.l + W / 2}" y="${h - 8}" text-anchor="middle" fill="${INK}">mm off the middle of the hole (the edge is 54)</text><text transform="translate(16 ${m.t + H / 2}) rotate(-90)" text-anchor="middle" fill="${INK}">speed arriving at the hole (m/s)</text>`;
 const lx = m.l + W + 16;
 s += `<rect x="${lx}" y="${m.t}" width="14" height="14" fill="#b9dcc2"/><text x="${lx + 20}" y="${m.t + 11}" fill="${INK}">drops</text><rect x="${lx}" y="${m.t + 22}" width="14" height="14" fill="#f1d9bf"/><text x="${lx + 20}" y="${m.t + 33}" fill="${INK}">lips out</text><rect x="${lx}" y="${m.t + 44}" width="14" height="14" fill="none" stroke="${INK}" stroke-width="2"/><text x="${lx + 20}" y="${m.t + 55}" fill="${INK}">changed</text>`;
 const flips = rows.filter(r => B.get(r.offset + '/' + r.speed).result !== r.result).length;
 s += `<text x="${lx}" y="${m.t + 84}" fill="${DIM}">${flips} of ${rows.length} changed</text>`;
 save('outcome-map', s + '</svg>');
}
// 3. The longest ride, from above: arriving at 0.6 m/s, 45 mm off line, Stimp 13.
{
 const t = turfConfig({stimp: 13}), run = .3, speed = .6, offset = .045, release = Math.sqrt(speed * speed + 2 * rollDeceleration('green', t) * run);
 const green = {height: () => 0, surface: () => 'green', pin: {x: 0, z: 0}, trees: [], homes: [], bounds: {x: 1e6, minZ: -1e6, maxZ: 1e6}};
 const shot = {origin: {x: offset, z: -run}, aim: 0, hla: 0, vla: 0, spin: 0, spinAxis: 0, speed: release, roll: release};
 const panel = (r, color, label, x0) => {
  const S = 1.6, cx = x0 + 160, cy = 190, P = q => `${(cx + q.x * 1000 * S).toFixed(1)},${(cy - q.z * 1000 * S).toFixed(1)}`;
  const pts = r.points.filter(q => Math.hypot(q.x, q.z) < .14);
  const id = 'p' + x0;
  return `<clipPath id="${id}"><rect x="${x0 + 10}" y="40" width="300" height="290"/></clipPath><circle cx="${cx}" cy="${cy}" r="${CUP_RADIUS * 1000 * S}" fill="#e9ede6" stroke="#9aa79c"/><g clip-path="url(#${id})"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.map(P).join(' ')}"/><circle cx="${P(pts.at(-1)).split(',')[0]}" cy="${P(pts.at(-1)).split(',')[1]}" r="5" fill="${color}"/></g><text x="${cx}" y="355" text-anchor="middle" fill="${INK}">${label}</text><text x="${cx}" y="372" text-anchor="middle" fill="${DIM}" font-size="11">the ball comes in from the bottom</text>`;
 };
 let s = head(680, 390, 'The longest lip-out in the grid, seen from above (0.6 m/s, 45 mm off line, Stimp 13)');
 s += panel(simBefore(shot, green, {turf: t}), BEFORE, 'before: round the edge 382 degrees', 0) + panel(simAfter(shot, green, {turf: t}), AFTER, 'after: 231 degrees', 340);
 save('longest-ride', s + '</svg>');
}
// 4. The longest ride against the friction the lip is given.
{
 const rows = [['before (no limit)', before.summary], ['0.305 (chosen)', after.summary], ...Object.entries(sensitivity).map(([mu, s]) => [mu, s])];
 const w = 680, h = 300, m = {l: 150, r: 30, t: 50, b: 40}, W = w - m.l - m.r, rowH = (h - m.t - m.b) / rows.length, X = v => m.l + v / 470 * W;
 let s = head(w, h, 'The longest lip-out ride, against the friction the lip is given');
 for (const t of [0, 90, 180, 270, 360]) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${h - m.b}" stroke="${GRID}"/><text x="${X(t)}" y="${h - m.b + 16}" text-anchor="middle" fill="${DIM}">${t}</text>`;
 rows.forEach(([label, sum], i) => {
  const y = m.t + i * rowH;
  s += `<text x="${m.l - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" fill="${INK}">${label}</text>`;
  [[10, '#7aa98a'], [13, '#2f6e44']].forEach(([st, c], k) => { const v = sum[st].longestLipRide; s += `<rect x="${m.l}" y="${y + 4 + k * (rowH - 8) / 2}" width="${X(v) - m.l}" height="${(rowH - 8) / 2 - 2}" fill="${i === 0 ? (k ? '#b5651d' : BEFORE) : c}"/><text x="${X(v) + 4}" y="${y + 4 + k * (rowH - 8) / 2 + (rowH - 8) / 4 + 3}" fill="${DIM}" font-size="11">${v} (Stimp ${st})</text>`; });
 });
 s += `<text x="${m.l + W / 2}" y="${h - 6}" text-anchor="middle" fill="${INK}">longest ride round the hole (degrees)</text>`;
 save('friction-sensitivity', s + '</svg>');
}
console.log(JSON.stringify({before: before.summary[10], after: after.summary[10]}, (k, v) => k === 'fastestHoledByOffsetMm' ? undefined : v));
