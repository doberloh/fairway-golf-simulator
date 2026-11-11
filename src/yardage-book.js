// THE YARDAGE BOOK (architect-courses, phase 7; the study, workstream P: "a
// printable page per hole -- the map with carries, the notes, the green's
// slopes"). One page a hole of a generated course, drawn from the built
// course in the hole's own frame (tee at the foot of the page, green at the
// head, the player's left on the left):
//
//   the plan    fairway and semi-rough edges, the green and its fall, every
//               bunker and pond, the tees, the landing zones of a good and an
//               average drive
//   carries     to each hazard's near and far edge from the back tee, and
//               what is left to the green's centre from each landing zone
//   notes       where drives come down and what is left (an Architect
//               course's note and each hazard's reason went with the
//               designer, 2 November 2026)
//
// Written with pdf.js (no library, offline). No DOM and no three.js: Node
// builds it in tests/yardage-book.test.mjs. Every generated course (Architect's
// only until the designer was removed, 2 November 2026).
import {PdfDocument, PAGE, textWidth} from './pdf.js';
import {fairwayWidth, ovalRadius} from './course.js';
import {holeNames} from './hole-names.js';
import {landingZones} from './markings.js';

const YARD = .9144;
const INK = '#1d2a22', SOFT = '#5b6b60', RULE = '#c9d2c4', FAIRWAY = '#7fae5c', SEMI = '#b9cf8f', GREEN = '#3f8f4f', SAND = '#e9d8a6', WATER = '#7fb3d5';
const M = 42, WIDTH = PAGE.width - 2 * M;
const TEE_INK = {black: '#26282c', blue: '#3a6fb8', white: '#8a8a82', silver: '#9aa1aa', gold: '#c49a22', red: '#c0504d'};

// The text of a note, wrapped to `width` points.
function wrap(s, size, width) {
 const out = []; let line = '';
 for (const word of String(s).split(/ +/)) {
  const next = line ? line + ' ' + word : word;
  if (textWidth(next, size) > width && line) { out.push(line); line = word; } else line = next;
 }
 if (line) out.push(line);
 return out;
}

export function yardageBook(world) {
 const s = world.settings || {}, holes = world.holes || [];
 const names = holeNames(holes, s);
 const doc = new PdfDocument({title: `Fairway yardage book${s.seed ? ' -- ' + s.seed : ''}`});
 holes.forEach((h, i) => {
  const page = doc.addPage(), d = h.design || {};
  // Head: number, name, par, yards from each tee.
  page.text(M, 64, `Hole ${i + 1}`, {size: 24, bold: true, color: INK});
  page.text(M + 98, 64, names[i] || '', {size: 16, color: SOFT});
  page.text(PAGE.width - M, 52, `Par ${h.par}`, {size: 14, bold: true, color: INK, align: 'right'});
  const tees = Object.entries(h.tees || {}).sort((a, b) => a[1].z - b[1].z);
  page.text(PAGE.width - M, 70, tees.map(([k, t]) => `${k[0].toUpperCase() + k.slice(1)} ${Math.round(t.yards ?? (h.length - t.z) / YARD)}`).join('   '), {size: 9, color: SOFT, align: 'right'});
  page.line(M, 80, PAGE.width - M, 80, {color: RULE});

  // The plan: the hole's frame scaled into a box, tee low, green high.
  const box = {x: M, y: 92, w: WIDTH * .62, h: 560};
  const back = Math.min(0, ...tees.map(([, t]) => t.z)) - 8, far = h.length + (h.greenSize ?? 15) + 14;
  let lo = Infinity, hi = -Infinity;
  for (let z = back; z <= far; z += 4) { const c = h.center(Math.max(0, Math.min(h.length, z))), w = Math.max(h.width?.(z) ?? 20, 20) + 12; lo = Math.min(lo, c - w); hi = Math.max(hi, c + w); }
  const k = Math.min(box.h / (far - back), box.w / (hi - lo)), mid = (lo + hi) / 2;
  // The player's left (local +x) on the page's left.
  const P = (x, z) => [box.x + box.w / 2 - (x - mid) * k, box.y + box.h - (z - back) * k];
  const edge = (margin, color, w) => {
   for (const side of [-1, 1]) {
    let prev = null;
    for (let z = (h.mowStart ?? h.fairwayStart ?? 0) - margin; z <= h.length + margin; z += 2) {
     const half = fairwayWidth(h, z, margin, side);
     const p = half > .1 ? P(h.center(Math.max(0, Math.min(h.length, z))) + side * half, z) : null;
     if (p && prev) page.line(prev[0], prev[1], p[0], p[1], {color, width: w});
     prev = p;
    }
   }
  };
  edge(s.semiRough ?? 6, SEMI, .8);
  edge(0, FAIRWAY, 1.4);
  // The green, its fall, its fringe.
  const [gx, gy] = P(h.green.x, h.green.z), gr = (h.greenSize ?? 15) * k;
  // An Architect green turned to its approach (course.js greenOffset): the
  // page mirrors the hole across, so the local turn is clockwise on it.
  page.ellipse(gx, gy, gr * (h.greenAspect ?? 1.1), gr, h.greenTurn || 0, {fill: GREEN, stroke: INK, width: .5});
  const fall = d.green?.drainCorner ?? d.green?.tiltSide;
  if (fall) {
   // An arrow from the back to the front corner it drains to.
   const [ax, ay] = [gx + fall * gr * .3, gy - gr * .5], [bx, by] = [gx - fall * gr * .45, gy + gr * .55];
   page.line(ax, ay, bx, by, {color: '#ffffff', width: 1.2});
   page.line(bx, by, bx + fall * 4, by - 2, {color: '#ffffff', width: 1.2});
   page.line(bx, by, bx + 1, by - 5, {color: '#ffffff', width: 1.2});
  }
  // Ponds and bunkers as their ovals.
  const oval = (o, fill) => {
   const pts = [];
   for (let a = 0; a < Math.PI * 2 + .01; a += Math.PI / 12) { const e = ovalRadius(o, a); pts.push(P(o.x + e.x, o.z + e.z)); }
   const [cx, cy] = P(o.x, o.z);
   const rx = Math.max(...pts.map(p => Math.abs(p[0] - cx))), ry = Math.max(...pts.map(p => Math.abs(p[1] - cy)));
   page.ellipse(cx, cy, Math.max(rx, 1.5), Math.max(ry, 1.5), 0, {fill, stroke: INK, width: .4});
  };
  for (const p of h.ponds || []) oval(p, WATER);
  for (const b of h.bunkers || []) oval(b, SAND);
  // The tees.
  for (const [key, t] of tees) { const [x, y] = P(t.x ?? h.center(t.z), t.z); page.rect(x - 4, y - 2.5, 8, 5, {fill: TEE_INK[key] || INK}); }
  // The landing zones and what is left from them.
  const blue = (h.tees?.blue ?? tees[tees.length - 1]?.[1]) || {z: 0};
  const toGreen = z => Math.round(Math.hypot(h.green.x - h.center(z), h.green.z - z) / YARD);
  const notes = [];
  if (h.par > 3) for (const [label, z, color] of (zones => [['good drive', zones.good, '#3a6fb8'], ['average drive', zones.average, '#8a6d1f']])(d.zones ?? landingZones(h))) {
   if (!z) continue;
   const [x0, y] = P(h.center(z) + 18, z), [x1] = P(h.center(z) - 18, z);
   page.line(x0, y, x1, y, {color, width: .8, dash: [3, 2]});
   page.text(Math.max(x0, x1) + 4, y + 3, `${toGreen(z)} to go`, {size: 7, color});
   notes.push(`A ${label} from the back tee comes down about ${Math.round((z - blue.z) / YARD)} yd out, leaving ${toGreen(z)} yd.`);
  }
  // Carries to each hazard from the back tee, labelled beside it.
  const carries = [];
  for (const [list, what] of [[h.bunkers || [], 'Bunker'], [h.ponds || [], 'Water']]) for (const o of list) {
   if (o.lobe) continue;
   const near = Math.round((o.z - o.rz - blue.z) / YARD), past = Math.round((o.z + o.rz - blue.z) / YARD);
   if (past <= 0) continue;
   const [x, y] = P(o.x, o.z), right = x > box.x + box.w / 2;
   page.text(right ? x + 8 : x - 8, y + 3, `${Math.max(0, near)}-${past}`, {size: 7, color: INK, align: right ? 'left' : 'right'});
   carries.push(`${what}: ${Math.max(0, near)} yd to reach, ${past} to carry.`);
  }
  // The side column: the architect's note, the reasons, the carries.
  const col = {x: box.x + box.w + 18, w: WIDTH - box.w - 18};
  let y = 104;
  const para = (title, lines, size = 8.5) => {
   page.text(col.x, y, title, {size: 9, bold: true, color: INK}); y += 13;
   for (const l of lines) for (const w of wrap(l, size, col.w)) { if (y > PAGE.height - 50) return; page.text(col.x, y, w, {size, color: SOFT}); y += size + 3; }
   y += 8;
  };
  if (d.note) para('The architect', [d.note]);
  const reasons = (d.reasons || []).map(r => r.why).filter(Boolean);
  if (reasons.length) para('Why it is there', reasons.slice(0, 6));
  if (notes.length) para('Off the tee', notes);
  if (carries.length) para('Carries from the back tee', carries.slice(0, 8));
  page.text(M, PAGE.height - 30, `${s.seed || ''}  ·  page ${i + 1} of ${holes.length}`, {size: 8, color: SOFT});
 });
 return doc;
}
