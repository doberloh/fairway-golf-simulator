// A HOLE'S MARKS ON THE 2D PLAN, picked up and moved (the owner, 5 November 2026:
// "make it so i can drag pieces around when placing the holes and markers"):
// which mark is under the pointer, and putting it down somewhere else. Door 2
// holds a hole as {tees: [{x, z, set}], aims: [{x, z}], green: {x, z}}. Pure;
// tests/builder-marks.test.mjs.

// Every mark of a hole: [{kind, set?, index?, x, z}].
export function marksOf(h) {
 if (!h) return [];
 return [...(h.tees ?? []).map(t => ({kind: 'tee', set: t.set, x: t.x, z: t.z})), ...(h.aims ?? []).map((a, index) => ({kind: 'aim', index, x: a.x, z: a.z})), ...(h.green ? [{kind: 'green', x: h.green.x, z: h.green.z}] : [])];
}
// The nearest mark within `reach` metres of `p`, on the hole in hand if it has
// one there (several holes' tees and greens lie close together), else on any
// other. {hole, kind, set?, index?}, or null.
export function markNear(holes, current, p, reach) {
 const best = n => { let got = null, d0 = reach; for (const m of marksOf(holes[n])) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d <= d0) { d0 = d; got = {...m, hole: n}; } } return got; };
 const here = best(current); if (here) return here;
 let got = null, d0 = Infinity;
 for (let n = 0; n < holes.length; n++) { if (n === current) continue; const m = best(n); if (m) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < d0) { d0 = d; got = m; } } }
 return got;
}
// What a press on the plan does (the builder-ux goal, 10 November 2026): on a
// mark of the hole in hand, `take` it at once; on another hole's mark, `wait`
// -- a drag of a few pixels takes that mark, a click places the mark in hand
// here (placing the 10th tee beside the 9th green used to take the green);
// on open ground, `place`. {act, mark?}.
export function pressOn(holes, current, p, reach) {
 const g = markNear(holes, current, p, reach);
 if (!g) return {act: 'place'};
 return {act: g.hole === current ? 'take' : 'wait', mark: g};
}
// The mark put at `p`. Its set and place in the list stay.
export function moveMark(h, m, p) {
 if (m.kind === 'green') h.green = {...h.green, x: p.x, z: p.z};
 else if (m.kind === 'aim') h.aims[m.index] = {...h.aims[m.index], x: p.x, z: p.z};
 else { const t = h.tees.find(q => q.set === m.set); if (t) { t.x = p.x; t.z = p.z; } }
}
