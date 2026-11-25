// WHAT BOTH EDITORS DO (the owner, 4 November 2026: "we need to bring parity
// between the 2d and 3d editor"): a selected shape's anchors, tree and house
// zones -- the rule lives once, here, so the two cannot drift apart. (Since 24
// November 2026 both editors hold their layers in one model, trace-edit.js on
// shapes.js, so the smoothing and growing that lived here for two grids are
// gone.) Pure; tests/builder-parity.test.mjs.

// Where a selected shape's anchors stand: the corners of its box, a little
// outside it (PLACED: 2.5 m, or a tenth of its size), in either editor.
// WHICH ANCHOR A PRESS TAKES, in both editors: `corners` on the screen, the
// press at (x, y), `reach` in the same units. The nearest within reach, but never
// one the press is farther from than from the shape's middle: seen from afar a
// bunker is ten pixels across, all four anchors lie within reach of its centre,
// and a press there only ever turned it (the smoke's builder-tools, 5 November
// 2026). -1: not an anchor, so a press inside the outline moves it.
export function anchorHit(corners, x, y, reach) {
 const mx = corners.reduce((s, c) => s + c[0], 0) / corners.length, my = corners.reduce((s, c) => s + c[1], 0) / corners.length, toMiddle = Math.hypot(x - mx, y - my);
 let best = -1, near = reach;
 corners.forEach(([cx, cy], k) => { const d = Math.hypot(x - cx, y - cy); if (d <= near && d < toMiddle) { near = d; best = k; } });
 return best;
}
export function cornersOf(ring) {
 let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
 for (const [x, z] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
 const pad = Math.max(2.5, Math.max(x1 - x0, z1 - z0) * .1);
 return [[x0 - pad, z0 - pad], [x1 + pad, z0 - pad], [x1 + pad, z1 + pad], [x0 - pad, z1 + pad]];
}

const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };

// A seeded draw, so a zone is the same if it is drawn again.
export const seededDraw = seed => { let q = seed >>> 0 || 1; return () => (q = (q * 1103515245 + 12345) % 2147483648) / 2147483648; };

// A TREE ZONE: trees in a ring at `density` a hectare, jittered off a grid, each
// on ground `open` says it may stand on. [{x, z, h, crown}].
export function zoneTrees(ring, {density = 120, height = [10, 22], crown = [2.5, 5], seed = 1, open}) {
 const rnd = seededDraw(seed), xs = ring.map(p => p[0]), zs = ring.map(p => p[1]), spacing = Math.sqrt(1e4 / density), out = [];
 for (let z = Math.min(...zs); z <= Math.max(...zs); z += spacing) for (let x = Math.min(...xs); x <= Math.max(...xs); x += spacing) {
  const px = x + (rnd() - .5) * spacing * .9, pz = z + (rnd() - .5) * spacing * .9;
  if (!inside(ring, px, pz) || !open(px, pz)) continue;
  out.push({x: px, z: pz, h: height[0] + rnd() * (height[1] - height[0]), crown: crown[0] + rnd() * (crown[1] - crown[0])});
 }
 return out;
}

// A HOUSE ZONE: a ring lined with houses `spacing` metres apart. `place(h)`
// says whether one stood there, and stands it.
export function zoneHomes(ring, {spacing = 42, seed = 1, place}) {
 const rnd = seededDraw(seed), xs = ring.map(p => p[0]), zs = ring.map(p => p[1]); let n = 0;
 for (let z = Math.min(...zs) + spacing / 2; z <= Math.max(...zs); z += spacing) for (let x = Math.min(...xs) + spacing / 2; x <= Math.max(...xs); x += spacing) {
  const h = {x: x + (rnd() - .5) * spacing * .3, z: z + (rnd() - .5) * spacing * .3, width: 16 + rnd() * 9, depth: 13 + rnd() * 6};
  if (inside(ring, h.x, h.z) && place(h)) n++;
 }
 return n;
}
