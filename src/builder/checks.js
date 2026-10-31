// THE CHECKS (the course builder, stage 5; docs/COURSE_BUILDER.md, *The
// editor*): what about a course being edited breaks a rule the game plays by,
// each with where it is, so the editor can take the player there. Pure; tested
// in Node (tests/builder-checks.test.mjs). The rules are the bench's
// invariants and the pin rule, asked of a built course.
import {polygonDistance} from '../built-world.js';

// A green needs room for a day's cups: Sunday's 3 m from the edge at least
// (course.js PIN_DAYS). A green whose deepest point is under this cannot
// have a legal cup at all.
export const CUP_ROOM = 3;
// A green steeper than this on average is too steep to putt on (PLACED: a
// green is 1-3%; Sunday's cap is 4.2% at the cup).
export const GREEN_STEEPEST = 6;

// [{text, at: {x, z}}] for an editor (editing.js).
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
 return out;
}
