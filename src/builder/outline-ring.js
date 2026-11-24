// THE COURSE'S ROUGH OUTLINE ON THE PLAN (the owner, 22 November 2026: "During
// the LIDAR phase, lets make the user roughly trace the course manually"):
// what a press does while it is drawn, and after. Points in the plan's local
// metres; `reach` metres. Pure; tests/builder-outline.test.mjs.

// While drawing (`drawing`): near the first corner, with three or more, the
// outline closes; anywhere else a corner is added. After: a press near a
// corner takes it up to drag, the nearest first; elsewhere, nothing.
export function ringPress(ring, drawing, p, reach) {
 if (drawing) return ring.length >= 3 && Math.hypot(ring[0].x - p.x, ring[0].z - p.z) <= reach ? {act: 'close'} : {act: 'add'};
 let best = null, d0 = reach;
 ring.forEach((q, index) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d <= d0) { d0 = d; best = {act: 'take', index}; } });
 return best;
}
// A ring of [lon, lat] corners' area in hectares (flat at its middle's latitude).
export function ringHectares(ring) {
 if (!ring?.length) return 0;
 const lat = ring.reduce((s, q) => s + q[1], 0) / ring.length, kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 111320;
 let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * kx * ring[i][1] * ky - ring[i][0] * kx * ring[j][1] * ky;
 return Math.abs(a) / 2 / 1e4;
}
