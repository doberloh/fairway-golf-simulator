// What a ball does after it lands, drawn: side-on paths from the pitch mark to
// rest, as SVG, for a report or a status page. Compares this checkout's ball
// with another's (`--against path/to/src/physics.js`, e.g. main's) when given.
//
//   node tools/ball-paths.mjs > paths.html
//   node tools/ball-paths.mjs --against ../../../src/physics.js > paths.html
//
// Each chart is metres along the shot from the pitch mark (negative is back
// toward the player) against height in metres. Colours are CSS variables
// (--turf for this ball, --muted for the other, --line for the ground), so the
// fragment takes the page's theme. Processor only: no browser, no graphics card.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {simulateShot} from '../src/physics.js';

const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const other = opt('--against') ? await import(pathToFileURL(path.resolve(opt('--against'))).href) : null;
const R = 0.021335;
const plane = s => ({height: () => 0, surface: () => s, bounds: {x: 1e5, minZ: -1e5, maxZ: 1e5}, trees: []});

// [title, landing speed m/s, descent deg, backspin rpm, surface, this ball's conditions, the other's]
const CASES = [
 ['Drive onto a medium fairway', 29.5, 36, 1950, 'fairway', {stimp: 10}, {stimp: 10}],
 ['Tour 7 iron onto a medium green', 24.7, 46, 5100, 'green', {stimp: 10}, {stimp: 10}],
 ['9,100 rpm sand wedge onto a firm green', 21.9, 51, 9100, 'green', {stimp: 10.5, greenFirmness: 'firm'}, {stimp: 10.5, firmness: 'Firm'}],
 ['Sand wedge chip, 3,000 rpm, medium green', 9.4, 33, 3000, 'green', {stimp: 10}, {stimp: 10}],
];
function path0(sim, [, speed, angle, spin, surface], turf) {
 const r = sim({origin: {x: 0, z: 0}, aim: 0, hla: 0, spinAxis: 0, speed, vla: -angle, spin, height: .01}, plane(surface), {turf});
 const z0 = r.points.find(q => q.y <= R + .002)?.z ?? 0;
 return {pts: r.points.filter(q => Number.isFinite(q.y)).map(q => [q.z - z0, Math.max(0, q.y - R)]), end: r.end.z - z0};
}
const out = [];
for (const c of CASES) {
 const mine = path0(simulateShot, c, c[5]), theirs = other ? path0(other.simulateShot, c, c[6]) : null;
 const all = [...mine.pts, ...(theirs ? theirs.pts : [])];
 const x0 = Math.min(-1, ...all.map(p => p[0])) - .5, x1 = Math.max(4, ...all.map(p => p[0])) + 1, top = Math.max(.6, ...all.map(p => p[1])) * 1.15;
 const W = 640, H = 150, L = 34, B = 24, sx = x => L + (x - x0) / (x1 - x0) * (W - L - 8), sy = y => H - B - y / top * (H - B - 10);
 const line = (p, stroke, width, dash = '') => `<polyline fill="none" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round" points="${p.pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')}"/><circle cx="${sx(p.end).toFixed(1)}" cy="${sy(0).toFixed(1)}" r="4" fill="${stroke}"/>`;
 const step = x1 - x0 > 30 ? 10 : x1 - x0 > 12 ? 5 : 1;
 let ticks = '';
 for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) ticks += `<line x1="${sx(x)}" y1="${sy(0)}" x2="${sx(x)}" y2="${sy(0) + 4}" stroke="var(--line)"/><text x="${sx(x)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${x} m</text>`;
 const yd = m => (m / .9144).toFixed(1);
 out.push(`<figure class="path"><figcaption><strong>${c[0]}</strong> <span>now runs ${yd(mine.end)} yd${theirs ? `, was ${yd(theirs.end)} yd` : ''}</span></figcaption>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${c[0]}: side view of the ball from its pitch mark to rest">
<line x1="${L}" y1="${sy(0)}" x2="${W - 8}" y2="${sy(0)}" stroke="var(--line)" stroke-width="2"/>
<line x1="${sx(0)}" y1="${sy(0) - 6}" x2="${sx(0)}" y2="${sy(0) + 6}" stroke="var(--flag)" stroke-width="2"/>
<text x="${L - 4}" y="${sy(top / 1.15) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${(top / 1.15).toFixed(1)} m</text>
${ticks}${theirs ? line(theirs, 'var(--muted)', 1.5, '4 3') : ''}${line(mine, 'var(--turf)', 2.2)}
</svg></figure>`);
}
console.log(out.join('\n'));
