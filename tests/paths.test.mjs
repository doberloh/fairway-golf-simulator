import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {pathIndex} from '../src/paths.js';
import {pathRelief, STANCE} from '../src/relief.js';
import {GROUNDS, allows, isNatural} from '../src/grounds.js';

// CART PATHS (architect-courses, phase 2): every generated course's paths run
// beside its holes out of play and on to each next tee (an Architect course's
// alone until the designer was removed, 2 November 2026); they are a lie of
// their own, nothing stands on them, a bridge carries them over a creek, and
// a ball that stops on one gets free relief.

const arch = world({seed: 'PATHS-T', holes: 9, biome: 'heartland'});

// The network's points, every piece.
const allPoints = w => w.paths.flatMap(p => p.points);

test('a course has a network of paths a course long', () => {
 assert.ok(arch.paths.length >= 9, `${arch.paths.length} pieces`);
 let len = 0;
 for (const path of arch.paths) for (let i = 1; i < path.points.length; i++) len += Math.hypot(path.points[i].x - path.points[i - 1].x, path.points[i].z - path.points[i - 1].z);
 assert.ok(len > 2500 && len < 9000, `nine holes of path: ${Math.round(len)} m`);
 for (const path of arch.paths) assert.ok(path.width >= 2 && path.width <= 3.2, 'about 8 ft wide');
});

test('the path is its own lie, never over a green, a tee, sand or water', () => {
 let on = 0, n = 0;
 for (const q of allPoints(arch)) {
  n++;
  const s = arch.surface(q.x, q.z);
  if (s === 'path') on++;
  else assert.ok(!['green', 'fringe', 'tee', 'sand'].includes(s), `a path point on ${s}`);
 }
 assert.ok(on / n > .95, `${on} of ${n} path points play as path`);
 assert.equal(GROUNDS.path.label, 'Cart path');
 assert.ok(!isNatural('path') && !allows('path', 'trees') && !allows('path', 'boulders'));
});

test('nothing grows or stands on a path', () => {
 const idx = pathIndex(arch.paths);
 const on = arch.trees.filter(t => !t.under && idx.onPath(t.x, t.z));
 assert.equal(on.length, 0, `${on.length} plants on the path`);
 for (const h of arch.homes) assert.ok(!idx.onPath(h.x, h.z), 'a house on the path');
});

test('the path stays out of play beside the hole it runs down', () => {
 // Off the mown fairway for nearly all its run beside the holes; it crosses
 // fairways only on the way from a green to the next tee.
 let fairway = 0;
 const pts = allPoints(arch);
 for (const q of pts) {
  const n = arch.nearest(q.x, q.z);
  if (n.h.localSurface?.(n.p.x, n.p.z) === 'fairway' || n.h.surface(n.p.x, n.p.z) === 'fairway') fairway++;
 }
 assert.ok(fairway / pts.length < .02, `${fairway} of ${pts.length} path points on fairway`);
});

// THE OWNER'S REVIEW (30 October 2026): paths through greens and tees, on
// unwalkable slopes, in sharp zigzags. The routed network keeps 10 m off every
// green's edge, climbs nothing steeper than 25% between points, and turns
// gently -- at most a few corners of more than 35 degrees a course.
test('the path keeps off the greens, climbs walkable grades and turns gently', () => {
 for (const w of [arch, world({seed: 'ST-1', holes: 9, biome: 'redwood'})]) {
  let sharp = 0;
  for (const path of w.paths) {
   const p = path.points;
   for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], d = Math.hypot(b.x - a.x, b.z - a.z);
    for (const h of w.holes) { const g = h.worldGreen; assert.ok(Math.hypot(b.x - g.x, b.z - g.z) > (h.greenSize ?? 15) * (h.greenAspect ?? 1.1) + 10, `a path point by hole ${h.hole + 1}'s green`); }
    if (d > 1) assert.ok(Math.abs(w.height(b.x, b.z) - w.height(a.x, a.z)) / d < .3, `a path step of ${(Math.abs(w.height(b.x, b.z) - w.height(a.x, a.z)) / d * 100).toFixed(0)}%`);
    if (i > 1) { const o = p[i - 2]; let dh = Math.abs(Math.atan2(b.x - a.x, b.z - a.z) - Math.atan2(a.x - o.x, a.z - o.z)); if (dh > Math.PI) dh = 2 * Math.PI - dh; if (dh > .6) sharp++; }
   }
  }
  assert.ok(sharp <= 12, `${sharp} sharp corners`);
 }
});

test('free relief from a path: off it, stance and all, no nearer the hole, no penalty', () => {
 // A straight path 2.4 m wide along z, rough either side.
 const surface = (x, z) => Math.abs(x) <= 1.2 ? 'path' : 'rough';
 const pin = {x: 30, z: 150};
 for (const ball of [{x: .4, z: 50}, {x: -1, z: 60}, {x: 1.1, z: 140}]) {
  const r = pathRelief(surface, ball, pin);
  assert.ok(r, 'relief found');
  assert.equal(r.penalty, 0);
  assert.notEqual(surface(r.spot.x, r.spot.z), 'path');
  const toPin = p => Math.hypot(p.x - pin.x, p.z - pin.z);
  assert.ok(toPin(r.spot) >= toPin(ball) - 1e-6, 'no nearer the hole');
  // The stance: half a metre either side, across the line to the hole.
  const q = r.reference, dx = pin.x - q.x, dz = pin.z - q.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
  for (const s of [-1, 1]) assert.notEqual(surface(q.x + nx * STANCE * s, q.z + nz * STANCE * s), 'path', 'the stance is off the path too');
  assert.ok(Math.hypot(r.spot.x - ball.x, r.spot.z - ball.z) < 3, 'beside the path, not across the course');
 }
 // Nowhere to go: no relief, rather than a drop in the water.
 assert.equal(pathRelief((x, z) => Math.abs(x) <= 1.2 ? 'path' : 'water', {x: 0, z: 10}, pin), null);
});

test('a creek the path crosses gets a bridge', () => {
 // PATHS-T crosses no creek; BR-2 on Midwest with three creeks crosses one.
 const bridged = world({seed: 'BR-2', holes: 9, biome: 'heartland', creeks: 3, rivers: 1});
 assert.ok(bridged.bridges.length >= 1, 'no bridge where the path crosses a creek');
 for (const b of [...arch.bridges, ...bridged.bridges]) {
  assert.ok(b.span > 3 && b.span < 60, `bridge span ${b.span}`);
  assert.ok(Number.isFinite(b.angle));
 }
});

import {CLUBHOUSE_ASPECT} from '../src/clubhouse.js';
import {MESH_MODELS} from '../src/asset-meshes.js';
test('every clubhouse keeps its model\'s own proportions (clubhouse.js CLUBHOUSE_ASPECT)', () => {
 // The table is the ingested model's height for its width; a model rebuilt
 // without re-measuring it would be drawn stretched or squashed.
 for (const [k, a] of Object.entries(CLUBHOUSE_ASPECT)) {
  const m = MESH_MODELS[`Blender_Clubhouse_${k}`];
  assert.ok(m, `no model for ${k}`);
  assert.ok(Math.abs(a - 1 / (2 * m.rx)) < .002, `${k}: the table says ${a}, the model ${(1 / (2 * m.rx)).toFixed(3)}`);
 }
});

// PHASE 5: A BRIDGE'S DECK IS SOLID (physics.js, the houses' box routine with
// a floor). A ball dropped onto it stops on the planks, not in the creek bed
// under them, and is in the penalty area there (Rule 17.1a: a penalty area's
// edge runs straight up).
import {simulateShot} from '../src/physics.js';
test('a ball dropped on a bridge stops on its deck, in the penalty area', () => {
 const w = world({seed: 'BR-2', holes: 9, biome: 'heartland', creeks: 3, rivers: 1});
 assert.ok(w.bridges.length, 'this course has a bridge');
 const b = w.bridges[0], h = w.nearest(b.x, b.z).h, at = h.toLocal({x: b.x, z: b.z});
 assert.ok(b.deck > w.height(b.x, b.z) + .3, 'the deck stands over the water');
 const r = simulateShot({origin: {...at}, height: b.deck - w.height(b.x, b.z) + 2, aim: 0, speed: 2, vla: -70, spin: 0, hla: 0, spinAxis: 0}, h, {});
 assert.equal(r.hazard, 'Water');
 assert.ok(Math.abs(r.end.y - (b.deck + .02135)) < .1, `the ball ends at ${r.end.y.toFixed(2)}, the deck at ${b.deck.toFixed(2)}`);
});

// ONE NETWORK, JOINED WHERE IT MEETS (the owner, 31 October 2026: pieces of
// path lying alone beside a green, a path ending in the grass short of the
// one it met). Every end either lies on another piece or stands well clear of
// every other one, no short jog is joined at both ends, and the pieces make
// one network. Before: 211 ends of 1,046 stopped within 8 m of another path
// in 15 eighteen-hole courses, and every course was in about 15 bits.
import {pathTouches, SPUR} from '../src/paths.js';
import {inBuilding} from '../src/clubhouse.js';
const seg = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
const toOthers = (w, p, e) => { let d = Infinity; for (const o of w.paths) if (o !== p) for (let k = 1; k < o.points.length; k++) d = Math.min(d, seg(e, o.points[k - 1], o.points[k])); return d; };
const lengthOf = pts => pts.reduce((a, p, k) => a + (k ? Math.hypot(p.x - pts[k - 1].x, p.z - pts[k - 1].z) : 0), 0);
test('the paths are one network, joined where they meet', () => {
 // PA-2 Midwest came in two halves: hole 10's pull-off sat in a pocket.
 for (const w of [arch, world({seed: 'PA-2', holes: 18, biome: 'heartland'})]) {
  const P = w.paths, par = P.map((_, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i]));
  P.forEach((p, i) => {
   const ends = [p.points[0], p.points[p.points.length - 1]], d = ends.map(e => toOthers(w, p, e));
   d.forEach((v, k) => assert.ok(v < .05 || v > 8, `piece ${i}: an end stops ${v.toFixed(1)} m short of another path`));
   if (!p.door) assert.ok(!(d[0] < .05 && d[1] < .05 && lengthOf(p.points) < SPUR), `piece ${i}: a ${lengthOf(p.points).toFixed(0)} m jog between two paths`);
   ends.forEach(e => P.forEach((o, j) => { if (j !== i) for (let k = 1; k < o.points.length; k++) if (seg(e, o.points[k - 1], o.points[k]) < .05) par[f(i)] = f(j); }));
  });
  assert.equal(new Set(P.map((_, i) => f(i))).size, 1, 'the network is in more than one piece');
 }
});

// NOTHING BUILT ON A PATH (the owner, 31 October 2026: a path ran under the
// Midwest farmhouse; 8 clubhouses in 15 courses had one under them).
test('no building or house stands on a path, and the clubhouse\'s own path goes round it', () => {
 for (const biome of ['heartland', 'rockies', 'sonoran']) {
  const w = world({seed: 'PA-3', holes: 18, biome});
  for (const b of w.buildings) {
   // The clubhouse's own path runs up to its front (`door`), and no further.
   assert.ok(!pathTouches(w.paths.filter(p => !(p.door && b.kind === 'clubhouse')), b, 0), `${biome}: a path under the ${b.kind}`);
   for (const p of w.paths) for (let k = 1; k < p.points.length; k++) { const a = p.points[k - 1], c = p.points[k], n = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z)); for (let t = 0; t <= n; t++) assert.ok(!inBuilding(b, a.x + (c.x - a.x) * t / n, a.z + (c.z - a.z) * t / n), `${biome}: a path through the ${b.kind}`); }
  }
  for (const h of w.homes) for (const p of w.paths) for (let k = 1; k < p.points.length; k++) assert.ok(seg(h, p.points[k - 1], p.points[k]) > Math.max(h.width, h.depth) / 2, `${biome}: a house on a path`);
 }
 // The footprint test itself: a path through a box's middle, past its corner, clear of it.
 const box = {x: 0, z: 0, rotation: .5, width: 20, depth: 10};
 assert.ok(pathTouches([{points: [{x: -40, z: 0}, {x: 40, z: 0}], width: 2.4}], box));
 assert.ok(!pathTouches([{points: [{x: -40, z: 30}, {x: 40, z: 30}], width: 2.4}], box));
 assert.ok(pathTouches([{points: [{x: -40, z: 30}, {x: 40, z: 30}], width: 2.4}], box, 30));
});

// NO STUB PAST A JUNCTION (the owner's second review, seen in a capture: a
// pointed spur a few metres long stuck out where two paths met). A loose end
// runs at least 12 m along its own piece before any other piece joins it.
test('no end stops just past a junction or a crossing', () => {
 // `overhaul` Midwest is the capture's course, where the wedge was seen.
 for (const w of [arch, world({seed: 'PA-2', holes: 18, biome: 'heartland'}), world({seed: 'overhaul', holes: 18, biome: 'heartland'})]) for (const p of w.paths) for (const end of [0, 1]) {
  const pts = end ? [...p.points].reverse() : p.points;
  const loose = toOthers(w, p, pts[0]) >= .05;
  let run = 0;
  for (let k = 1; k < pts.length && run < 12; k++) {
   const a = pts[k - 1], b = pts[k], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
   for (const o of w.paths) if (o !== p) for (const e of [o.points[0], o.points[o.points.length - 1]]) {
    const t = Math.max(0, Math.min(1, ((e.x - a.x) * (b.x - a.x) + (e.z - a.z) * (b.z - a.z)) / (l * l)));
    if (loose && seg(e, a, b) < .05) assert.ok(run + t * l >= 12, `a ${(run + t * l).toFixed(1)} m stub past a junction`);
   }
   // Nor runs on a few metres across a path it crosses (the clubhouse capture: a wedge).
   // (The clubhouse's path starts at its front, where a path may pass close.)
   if (!(p.door && !end)) for (const o of w.paths) if (o !== p) for (let j = 1; j < o.points.length; j++) {
    const u = o.points[j - 1], v = o.points[j], dx = b.x - a.x, dz = b.z - a.z, ex = v.x - u.x, ez = v.z - u.z, den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((u.x - a.x) * ez - (u.z - a.z) * ex) / den, w2 = ((u.x - a.x) * dz - (u.z - a.z) * dx) / den;
    if (t * l > .1 && t <= 1 && w2 >= 0 && w2 <= 1) assert.ok(run + t * l >= 8, `an end runs ${(run + t * l).toFixed(1)} m on past a path it crosses`);
   }
   run += l;
  }
 }
});

// NO FOLD AT AN END (the same capture): an end moved onto the network could
// land behind the point before it and the strip doubled back into a spike
// (17 of 228 ends on four eighteens; 3 now, where the line straight past
// would cross closed ground).
test('a path end does not fold back on itself', () => {
 let folds = 0, ends = 0;
 for (const w of [arch, world({seed: 'PA-2', holes: 18, biome: 'heartland'})]) for (const p of w.paths) for (const end of [0, 1]) {
  const q = end ? [...p.points].reverse() : p.points;
  if (q.length < 3) continue;
  ends++;
  const [a, b, c] = q, ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z;
  if ((ux * vx + uz * vz) / ((Math.hypot(ux, uz) * Math.hypot(vx, vz)) || 1) < -.17) folds++;
 }
 assert.ok(folds <= Math.ceil(ends * .02), `${folds} of ${ends} ends fold back`);
});

// EVERY PATH OVER WATER IS A BRIDGE (the owner, 2 November 2026; paths.js
// `findBridges`, the bench's `pathOverWater`): no point of a path, every 2 m,
// stands on water off a bridge -- the clubhouse's link included, which a creek
// once crossed dry-shod (Mountain W-3).
import {unbridgedWater} from '../src/paths.js';
test('every path over water is a bridge', () => {
 for (const [biome, seed] of [['rockies', 'W-3'], ['heartland', 'W-1'], ['redwood', 'W-2'], ['puget', 'W-4']]) {
  const w = world({seed, holes: 9, biome, water: 80, lakes: 1, creeks: 2});
  const bad = unbridgedWater(w.paths, w.bridges, (x, z) => w.surface(x, z) === 'water');
  assert.equal(bad.length, 0, `${biome} ${seed}: ${bad.length} path points on water off a bridge`);
 }
});
