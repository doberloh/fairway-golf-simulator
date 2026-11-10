// THE CHECKS (the course builder, stage 5; docs/COURSE_BUILDER.md, *The
// editor*): what about a course being edited breaks a rule the game plays by,
// each with where it is, so the editor can take the player there. Pure; tested
// in Node (tests/builder-checks.test.mjs). The rules are the bench's
// invariants and the pin rule, asked of a built course.
import {polygonDistance} from '../built-world.js';
import {TREE_STRIDE} from '../course-doc.js';

// A green needs room for a day's cups: Sunday's 3 m from the edge at least
// (course.js PIN_DAYS). A green whose deepest point is under this cannot
// have a legal cup at all.
export const CUP_ROOM = 3;
// A green steeper than this on average is too steep to putt on (PLACED: a
// green is 1-3%; Sunday's cap is 4.2% at the cup).
export const GREEN_STEEPEST = 6;

// [{text, at: {x, z}}] for an editor (editing.js).
// A COURSE'S WEIGHT (the owner, 9 November 2026: "We might need to add some
// optimization options into the builder"; the frame-rate goal). Not a rule the
// game plays by but what a weak laptop or a phone will feel: past these, a
// note names the trees and houses and points at the biggest stand of trees
// that no hole plays near -- trees an author may choose to thin, since they
// stand in the round and a ball can hit them. PLACED, from Dinosaur Mountain
// (45,223 trees, 600 houses) and Troon North (47,697 trees), the heaviest of
// the bench's built courses, which drew 113-173 M triangles a frame on Low.
export const HEAVY = {trees: 25000, homes: 400, farFromPlay: 250, cell: 100};
// The note, or null: {text, at} where the far trees stand thickest.
export function courseWeight(doc) {
 const trees = doc.trees || [], stride = trees.length && trees[0]?.length === undefined ? TREE_STRIDE : 0;
 const count = stride ? Math.floor(trees.length / stride) : trees.length, homes = (doc.homes || []).length;
 if (count < HEAVY.trees && homes < HEAVY.homes) return null;
 const xz = i => stride ? [trees[i * stride], trees[i * stride + 1]] : [trees[i][0], trees[i][1]];
 const lines = (doc.holes || []).map(h => h.line || [[h.tees?.[0]?.x ?? 0, h.tees?.[0]?.z ?? 0], [h.green.x, h.green.z]]);
 const near = (x, z) => lines.some(l => { for (let k = 0; k + 1 < l.length; k++) {
  const [ax, az] = l[k], [bx, bz] = l[k + 1], dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len));
  if ((x - ax - dx * u) ** 2 + (z - az - dz * u) ** 2 <= HEAVY.farFromPlay ** 2) return true; } return false; });
 let far = 0; const cells = new Map();
 for (let i = 0; i < count; i++) {
  const [x, z] = xz(i);
  if (near(x, z)) continue;
  far++;
  const key = Math.floor(x / HEAVY.cell) + ',' + Math.floor(z / HEAVY.cell), c = cells.get(key) || {n: 0, x: 0, z: 0};
  c.n++; c.x += x; c.z += z; cells.set(key, c);
 }
 let best = null; for (const c of cells.values()) if (!best || c.n > best.n) best = c;
 const at = best ? {x: best.x / best.n, z: best.z / best.n} : {x: 0, z: 0};
 return {text: `A heavy course for a weak laptop or a phone: ${count.toLocaleString('en')} trees and ${homes} houses. ${far.toLocaleString('en')} of the trees stand more than ${HEAVY.farFromPlay} m from every hole's line; here is where they stand thickest.`, at, heavy: true};
}

export function checkCourse(editor) {
 const s = editor.state, out = [], doc = editor.toDoc();
 const greens = doc.surfaces.green || [];
 s.holes.forEach((h, i) => {
  const n = `Hole ${h.number}`;
  const g = h.green, gp = greens.find(p => polygonDistance(p, g.x, g.z) <= 0);
  if (!gp) out.push({text: `${n}: its green mark is not on a green.`, at: g});
  else {
   // The deepest point of the green: its centre, or near it.
   let deep = 0;
   for (let dx = -15; dx <= 15; dx += 1.5) for (let dz = -15; dz <= 15; dz += 1.5) deep = Math.max(deep, -polygonDistance(gp, g.x + dx, g.z + dz));
   if (deep < CUP_ROOM) out.push({text: `${n}: its green is too small for a cup ${CUP_ROOM} m from the edge.`, at: g});
   let slope = 0, k = 0;
   for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
    const x = g.x + dx, z = g.z + dz;
    if (polygonDistance(gp, x, z) > 0) continue;
    const e = .5; slope += Math.hypot(editor.height(x + e, z) - editor.height(x - e, z), editor.height(x, z + e) - editor.height(x, z - e)) / (2 * e) * 100; k++;
   }
   if (k && slope / k > GREEN_STEEPEST) out.push({text: `${n}: its green slopes ${(slope / k).toFixed(1)}% on average; putts will not stay.`, at: g});
  }
  for (const t of h.tees) {
   const lie = editor.surfaceAt(t.x, t.z);
   if (lie === 'water') out.push({text: `${n}: the ${t.set} tee is in water.`, at: t});
   else if (lie !== 'tee') out.push({text: `${n}: the ${t.set} tee is on ${lie}, not a tee.`, at: t});
  }
  if (editor.surfaceAt(g.x, g.z) === 'water') out.push({text: `${n}: its green is under water.`, at: g});
  for (const w of s.water) if (polygonDistance(w.rings, g.x, g.z) < 0 && editor.height(g.x, g.z) < w.level) out.push({text: `${n}: its green is below a pond's level.`, at: g});
 });
 for (const t of s.trees) if (editor.surfaceAt(t[0], t[1]) === 'green') out.push({text: 'A tree stands on a green.', at: {x: t[0], z: t[1]}});
 const weight = courseWeight(doc);
 if (weight) out.push(weight);
 return out;
}
