import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {farWoodSites, FAR_SHAPES} from '../src/far-woods.js';
import {drawnGround, ringMesh} from '../src/landscape-edge.js';
import {farWoodGeometry} from '../src/vegetation.js';
import {tierOf} from '../src/graphics.js';

// The far woods (the polish goal): scenery crowns from the property line out
// past the ground's edge, closing the bare band before the painted forest.
test('far woods stand outside the course, out of the water, the same every time', () => {
 const w = generateWorld({seed: 'FARWOODS', biome: 'autumn', holes: 9});
 const a = farWoodSites(w), b = farWoodSites(w);
 assert.ok(a.length > 2000, `${a.length} crowns`);
 assert.deepEqual(a, b, 'deterministic');
 for (const s of a) {
  assert.ok(Math.abs(s.x) > w.halfX || Math.abs(s.z) > w.halfZ, 'never inside the property, where the real stands are');
  assert.ok(s.y >= .5, 'never in water');
 }
 // The band right outside the property line is wooded, not bare.
 const band = a.filter(s => Math.abs(s.x) > w.halfX && Math.abs(s.x) < w.halfX + 60 && Math.abs(s.z) < w.halfZ * .8);
 assert.ok(band.length > 20, `${band.length} crowns in the first 60 m past the property line`);
 // And the woods run out to the landscape's edge (the owner: never bare
 // ground), coarser with distance: every kilometre band out to 12 km holds
 // crowns, each band's spacing wider than the one before.
 const out = s => Math.hypot(Math.max(0, Math.abs(s.x) - w.halfX), Math.max(0, Math.abs(s.z) - w.halfZ));
 let last = 0;
 for (let km = 0; km < 12; km++) {
  const ring = a.filter(s => out(s) >= km * 1000 && out(s) < (km + 1) * 1000);
  assert.ok(ring.length > 0, `no woods ${km}-${km + 1} km out`);
  const r = ring.reduce((m, s) => m + s.r, 0) / ring.length;
  assert.ok(r >= last, `crowns shrink with distance at ${km} km`);
  last = r;
 }
});

// The far-landscape goal: every crown sits on the ground as DRAWN (the ring's
// own triangles), not on the fine relief it was placed by. The bench's
// `farSeated` checks every course; this holds the pieces together.
test('far crowns sit on the drawn ground, their base no higher than it anywhere under them', () => {
 const w = generateWorld({seed: 'FARWOODS', biome: 'mountain', holes: 9}), at = drawnGround(w);
 for (const groves of [false, true]) {
  const sites = farWoodSites(w, {groves});
  assert.ok(sites.length > 1000);
  for (const s of sites.filter((_, i) => i % 7 === 0)) {
   const shape = FAR_SHAPES[s.shape];
   for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6 + .2, dx = Math.cos(a) * s.r * shape.foot * .8, dz = Math.sin(a) * s.r * shape.foot * .8;
    const base = s.seat.y - (s.seat.ux * dx + s.seat.uz * dz) / s.seat.uy;
    assert.ok(base - at(s.x + dx, s.z + dz) <= Math.max(.3, .02 * s.r), `${s.shape} at ${s.x.toFixed(0)},${s.z.toFixed(0)} hangs ${(base - at(s.x + dx, s.z + dz)).toFixed(2)} m`);
   }
  }
 }
});

test('the drawn ground reproduces the ring\'s own vertices', () => {
 const w = generateWorld({seed: 'FARWOODS', biome: 'lakeshore', holes: 9}), at = drawnGround(w), m = ringMesh(w);
 for (let v = m.count; v < m.positions.length / 3; v += 13) {
  const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
  assert.ok(Math.abs(at(x, z) - y) < .01, `vertex ${v}: ${at(x, z)} against ${y}`);
 }
});

test('each far shape is flat-based at its origin and no wider at its base than the seat assumes', () => {
 for (const kind of Object.keys(FAR_SHAPES)) {
  const g = farWoodGeometry(kind), p = g.attributes.position, [, h] = FAR_SHAPES[kind].scale;
  assert.ok(Math.abs(g.boundingBox.min.y) < 1e-6, `${kind} base at ${g.boundingBox.min.y}`);
  let wide = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < .02 * h) wide = Math.max(wide, Math.hypot(p.getX(i), p.getZ(i)));
  assert.ok(wide <= FAR_SHAPES[kind].foot + 1e-6, `${kind} base ${wide.toFixed(3)} wide, seat assumes ${FAR_SHAPES[kind].foot}`);
  assert.ok(Math.abs(g.boundingBox.max.y - FAR_SHAPES[kind].tall) < .15 * FAR_SHAPES[kind].tall, `${kind} ${g.boundingBox.max.y.toFixed(2)} tall, FAR_SHAPES says ${FAR_SHAPES[kind].tall}`);
 }
});

test('Island, all sea round it, grows far woods only on its far islets; Low and Medium draw them as groves, never not at all', () => {
 // Round 3 of the far landscape: Island's far sea carries islets (2.5-6 km
 // out); its far woods stand on them and nowhere nearer -- the sea round the
 // course stays open.
 const w = generateWorld({seed: 'FARWOODS', biome: 'island', holes: 9}), isle = farWoodSites(w);
 assert.ok(isle.length > 0, 'the islets are wooded');
 for (const s of isle) assert.ok(Math.hypot(Math.max(0, Math.abs(s.x) - w.halfX), Math.max(0, Math.abs(s.z) - w.halfZ)) > 1500, `a far crown ${s.x.toFixed(0)},${s.z.toFixed(0)} short of the islets`);
 assert.equal(tierOf('low').farWoods, 'groves');
 assert.equal(tierOf('medium').farWoods, 'groves');
 for (const t of ['high', 'ultra']) assert.equal(tierOf(t).farWoods ?? true, true);
});
