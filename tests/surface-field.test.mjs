import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {markOverflow, surfaceField, fieldAt, isFieldSand, bunkerDistance, HAZARD_SLOTS, FIELD_RANGE} from '../src/surface-field.js';
import {packTables, TABLE_WIDTH, HOLE_ATLAS} from '../src/ground.js';
import {greenDistance, greenPoint, greenRadius} from '../src/course.js';
import {approachTurn} from '../src/architect.js';

const flat = (n, extra = {}) => ({bunkers: Array.from({length: n}, (_, i) => ({x: i * 20, z: 0, rx: 4, rz: 3, phase: 0, wave2: 0, wave3: .05})), ponds: [], collections: [], ...extra});

test('bunkers past the slots, and only those, are marked for the field', () => {
 const h = flat(15, {ponds: [{}], collections: [{}]});
 assert.equal(markOverflow(h), 15 - (HAZARD_SLOTS - 2));
 assert.ok(h.bunkers.slice(0, HAZARD_SLOTS - 2).every(b => !b.field));
 assert.ok(h.bunkers.slice(HAZARD_SLOTS - 2).every(b => b.field));
 // A hole that fits is untouched, and a mark left from before is cleared.
 const fits = flat(4);fits.bunkers[3].field = true;
 assert.equal(markOverflow(fits), 0);
 assert.ok(fits.bunkers.every(b => !('field' in b)));
});

test('no field is baked for a course with nothing past its slots', () => {
 const h = {...flat(3), toWorld: p => p, toLocal: p => p};
 assert.equal(surfaceField([h], 200, 200), null);
});

test('the baked field reads sand inside a field bunker and grass outside it', () => {
 const h = {...flat(1), toWorld: p => ({x: p.x + 30, z: p.z - 10}), toLocal: p => ({x: p.x - 30, z: p.z + 10})};
 const b = h.bunkers[0];b.rx = 7;b.rz = 5;b.field = true;
 const f = surfaceField([h], 120, 120);
 assert.ok(f);
 assert.ok(isFieldSand(f, 30, -10), 'the centre is sand');
 assert.ok(!isFieldSand(f, 30, 0), 'well outside is not');
 // The 0.5 contour sits on the bunker's own edge within a few centimetres
 // along both axes (the bake's distances, linearly filtered).
 for (const [dx, dz, r] of [[1, 0, 7], [-1, 0, 7], [0, 1, 5], [0, -1, 5]]) {
  let lo = 0, hi = r * 2;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (fieldAt(f, 30 + dx * m, -10 + dz * m) >= .5) lo = m; else hi = m; }
  const edge = Math.abs(bunkerDistance(dx * lo, dz * lo, b));
  assert.ok(edge < .15, `edge off by ${edge.toFixed(3)} m along ${dx},${dz}`);
 }
 assert.ok(fieldAt(f, 30, -10) <= 1 && FIELD_RANGE > 0);
});

test('a world with field bunkers plays them as sand, as it paints them', () => {
 // Sandhills HZ-2 overfills holes 3 and 8 by itself (tests/hand-tools.test.mjs).
 const w = world({seed: 'HZ-2', holes: 18, biome: 'midwest', designer: 'architect', archStyle: 'sandhills'});
 const h = w.holes.find(h => h.bunkers.some(b => b.field)), over = h.bunkers.filter(b => b.field);
 assert.ok(over.length > 0, 'the hole overflows its slots');
 assert.ok(w.surfaceField, 'and the world baked a field');
 let sand = 0, checked = 0;
 for (const b of over) {
  const c = h.toWorld({x: b.x, z: b.z});
  const own = w.surface(c.x, c.z);
  checked++;if (own === 'sand') sand++;
 }
 assert.ok(sand / checked > .8, `${sand} of ${checked} field bunker centres play as sand`);
 // A Classic world bakes none.
 assert.equal(world({seed: 'FIELD-1', holes: 9, biome: 'midwest'}).surfaceField, null);
});

test('the packed tables keep each table where the shader looks for it', () => {
 const N = 3, W = HOLE_ATLAS.width, streamCount = 5;
 const curves = new Float32Array(N * 1024 * 4).map((_, i) => i + .25);
 const holes = new Float32Array(W * N * 4).map((_, i) => 1e5 + i);
 const banks = new Float32Array(512 * N * 4 * 4).map((_, i) => 2e5 + i);
 const streams = new Float32Array(streamCount * 8).map((_, i) => 3e5 + i);
 const {data, rows} = packTables({curves, holes, banks, streams, rows: N, streamCount});
 assert.equal(rows, 4 * N + 1);
 const texel = (col, row) => data.subarray((row * TABLE_WIDTH + col) * 4, (row * TABLE_WIDTH + col) * 4 + 4);
 // curveAt: column, the hole's row.
 assert.equal(texel(700, 2)[1], curves[(2 * 1024 + 700) * 4 + 1]);
 // holeTexel: row rows + hole.
 assert.equal(texel(10, N + 1)[3], holes[(1 * W + 10) * 4 + 3]);
 // The banks: pond j of hole h at row 2N + floor((4h + j) / 2), half (4h + j) % 2.
 const h = 2, j = 3, k = 300, bj = 4 * h + j;
 assert.equal(texel((bj % 2) * 512 + k, 2 * N + Math.floor(bj / 2))[0], banks[((h * 4 + j) * 512 + k) * 4]);
 // channelInfo: segment s at texels 2s and 2s + 1 of row 4N.
 assert.equal(texel(2 * 4 + 1, 4 * N)[2], streams[4 * 8 + 6]);
});

test('a turned green is one shape to the lie and to everything that draws it', () => {
 const g = {green: {x: 3, z: 200}, greenSize: 16, greenAspect: 1.3, greenWave2: .04, greenWave3: .05, greenWave5: .02, phase: .7};
 for (const t of [0, .4, -.55]) {
  const h = {...g, greenTurn: t};
  for (let i = 0; i < 24; i++) {
   const a = i / 24 * Math.PI * 2, p = greenPoint(h, a, greenRadius(h, a));
   assert.ok(Math.abs(greenDistance(h, p.x, p.z)) < 1e-9, `turn ${t}, angle ${a.toFixed(2)}`);
  }
 }
 // With no turn, exactly the arithmetic Classic always had.
 const p = {x: 9.5, z: 191.25}, dx = (p.x - 3) / 1.3, dz = p.z - 200;
 assert.equal(greenDistance(g, p.x, p.z), Math.hypot(dx, dz) - greenRadius(g, Math.atan2(dz, dx)));
});

test('a green turns to where its approach is played, and a strategic one opens to its side', () => {
 const center = z => z > 150 ? (z - 150) * .5 : 0, tees = {blue: {x: 0, z: 0}};
 const base = {par: 4, center, tees, length: 380, green: {x: center(380), z: 380}, goodZ: 250, layZ: null, template: null, preferred: 1};
 const t = approachTurn({...base, concept: 'penal'});
 // The approach from (50, 250) to (115, 380) leans toward +x; the oval's
 // depth axis (0, 1) turned by t points the same way.
 const depth = {x: -Math.sin(t), z: Math.cos(t)}, way = {x: 115 - 50, z: 130}, n = Math.hypot(way.x, way.z);
 assert.ok(depth.x * way.x / n + depth.z * way.z / n > .99);
 const straight = {...base, center: () => 0, green: {x: 0, z: 380}};
 assert.ok(Math.abs(approachTurn({...straight, concept: 'penal'})) < 1e-12, 'a straight hole leaves the green square');
 // Preferred side +x (the player's left): the diagonal turns the green by -0.35.
 assert.ok(Math.abs(approachTurn({...straight, concept: 'strategic'}) + .35) < 1e-9);
 assert.ok(Math.abs(approachTurn({...straight, concept: 'strategic', preferred: -1}) - .35) < 1e-9);
 // Never past the cap.
 assert.ok(Math.abs(approachTurn({...base, center: z => z, green: {x: 380, z: 380}, concept: 'heroic'})) <= .6);
});
