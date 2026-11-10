// LOW DRAWS FEWER TREES -- NEVER ONE OF THE HOLE BEING PLAYED (the owner,
// 9 November 2026: "Medium should still show all trees. Low can draw less
// trees but only if we can ensure that we draw all of the trees for the hole
// we are on at a minimum", and of free flight, "we need to have a solution for
// that as well", and "i would like to see things fade in not pop in").
//
// A RULE ABOUT DRAWING, NOT ABOUT THE COURSE. Every trunk still stands in
// `world.trees` and every tier still collides with it (PROJECT_HANDOFF,
// *GRAPHICS TIERS MAY NOT TOUCH*). This decides only which trees Low's
// renderer draws, so it has no DOM and no three.js, and tests/low-trees.test.mjs
// proves the hole's trees are always kept.
//
// THE HOLE'S TREES (PLACED, for the owner to overrule; RESEARCH, *Frame rate
// on every tier*): every tree within HOLE_REACH of the hole's line, sampled
// from behind its back tee to past its green, and every tree within
// BALL_REACH of the ball wherever it lies -- a shot into the next hole's trees
// still sees them. In free flight, where the camera has left the hole, every
// tree within FLY_REACH of the camera as well. Outside all of that, a tree is
// kept by a share that falls with its distance from the camera: all of them
// to NEAR_ALL, down to MIN_KEEP by THIN_TO. Which trees go first is fixed per
// tree (`treeHash`), so a tree never flickers in and out as the camera moves:
// it is in while the share is above its hash, and fades across FADE of the
// share as it crosses (instance-cull.js draws the kept prefix; the trees'
// shader dithers the fade).
export const LOW_TREES = Object.freeze({
 holeReach: 80, ballReach: 150, flyReach: 250,
 nearAll: 120, thinTo: 600, minKeep: .2, fade: .15,
 // The hole's line, sampled: metres behind the tee and past the green, and
 // the spacing of the samples.
 behind: 40, past: 30, step: 10,
});

// A tree's fixed place in the order trees leave: [0, 1), the same on every
// machine for the same spot (no Math.random: a save, a replay and two players
// see the same thinning).
export function treeHash(x, z) {
 let h = Math.imul(Math.round(x * 4) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 4) | 0, 0x165667b1);
 h = Math.imul(h ^ h >>> 15, 0x85ebca6b); h = Math.imul(h ^ h >>> 13, 0xc2b2ae35); h ^= h >>> 16;
 return (h >>> 0) / 4294967296;
}

// The hole's line as world points [x, z, x, z, ...]: along its own frame from
// `behind` metres behind the tee to `past` metres past the green. Works on a
// generated hole and a built one alike (both have `toWorld` and `length`).
export function holePath(hole, rules = LOW_TREES) {
 if (!hole?.toWorld) return new Float32Array(0);
 const from = -rules.behind, to = (hole.length ?? 0) + rules.past, n = Math.max(1, Math.ceil((to - from) / rules.step));
 const out = new Float32Array((n + 1) * 2);
 for (let i = 0; i <= n; i++) { const p = hole.toWorld({x: 0, z: from + (to - from) * i / n}); out[i * 2] = p.x; out[i * 2 + 1] = p.z; }
 return out;
}

// Squared distance from (x, z) to a polyline [x, z, ...].
export function pathDistance2(path, x, z) {
 if (path.length < 2) return Infinity;
 if (path.length < 4) return (x - path[0]) ** 2 + (z - path[1]) ** 2;
 let best = Infinity;
 for (let i = 0; i + 3 < path.length; i += 2) {
  const ax = path[i], az = path[i + 1], bx = path[i + 2], bz = path[i + 3], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
  const d = (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2;
  if (d < best) best = d;
 }
 return best;
}

// Is (x, z) one of the trees Low must draw? `region`: {path, ball, camera,
// flying} -- the hole's line (holePath), the ball {x, z} or null, the camera
// {x, z}, and whether the camera is in free flight.
export function protectedAt(region, x, z, rules = LOW_TREES) {
 if (pathDistance2(region.path, x, z) <= rules.holeReach ** 2) return true;
 const b = region.ball;
 if (b && (x - b.x) ** 2 + (z - b.z) ** 2 <= rules.ballReach ** 2) return true;
 const c = region.camera;
 return !!(region.flying && c && (x - c.x) ** 2 + (z - c.z) ** 2 <= rules.flyReach ** 2);
}

// The share of trees kept at a spot's distance from the camera, outside the
// hole's trees: 1 to NEAR_ALL, falling evenly to MIN_KEEP at THIN_TO.
export function shareAt(distance, rules = LOW_TREES) {
 if (distance <= rules.nearAll) return 1;
 if (distance >= rules.thinTo) return rules.minKeep;
 return 1 - (1 - rules.minKeep) * (distance - rules.nearAll) / (rules.thinTo - rules.nearAll);
}

// The share kept at (x, z): 1 for the hole's trees, else by distance.
export function keepAt(region, x, z, rules = LOW_TREES) {
 if (protectedAt(region, x, z, rules)) return 1;
 const c = region.camera;
 return c ? shareAt(Math.hypot(x - c.x, z - c.z), rules) : 1;
}

// Is a tree at (x, z) drawn? Its hash under the share, with the fade band
// counted in (a tree in the band is drawn, dithered by the shader).
export const drawnAt = (region, x, z, rules = LOW_TREES) => treeHash(x, z) < keepAt(region, x, z, rules) + rules.fade;

// The most any tree in a square {x0, x1, z0, z1} can need: 1 if any point of
// it is within a protected reach (tested against the square's nearest point,
// so it never under-keeps), else the share at its nearest point to the
// camera, plus the fade band. instance-cull.js draws each square's trees
// sorted by hash, up to this share -- a prefix, so no tree it needs is left out.
export function squareKeep(region, box, rules = LOW_TREES) {
 const near = (px, pz) => [Math.max(box.x0, Math.min(box.x1, px)), Math.max(box.z0, Math.min(box.z1, pz))];
 // The hole's line: the square's distance to each segment, conservatively the
 // distance from the segment's nearest point to the square.
 const p = region.path;
 for (let i = 0; i + 1 < p.length; i += 2) {
  const [nx, nz] = near(p[i], p[i + 1]);
  if ((nx - p[i]) ** 2 + (nz - p[i + 1]) ** 2 <= (rules.holeReach + rules.step) ** 2) return 1;
 }
 if (region.ball) { const [nx, nz] = near(region.ball.x, region.ball.z); if ((nx - region.ball.x) ** 2 + (nz - region.ball.z) ** 2 <= rules.ballReach ** 2) return 1; }
 const c = region.camera;
 if (!c) return 1;
 const [nx, nz] = near(c.x, c.z), d = Math.hypot(nx - c.x, nz - c.z);
 if (region.flying && d <= rules.flyReach) return 1;
 return Math.min(1, shareAt(d, rules) + rules.fade);
}
