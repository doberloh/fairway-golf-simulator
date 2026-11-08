// THE BUILDER SKINS THE LAND FROM ITS HEIGHTS (src/builder/skin.js; the owner,
// 3 November 2026). A butte in the survey becomes the landscape's rock on its
// steep sides and its apron below; its flat top and the flat ground stay
// grass; the holes' turf is never painted; every landscape names a face.
import test from 'node:test';
import assert from 'node:assert/strict';
import {skinFromHeights, skinKinds, applySkin} from '../src/builder/skin.js';
import {layersFor} from '../src/builder/layers.js';
import {BIOMES} from '../src/biomes.js';

// A flat plain with one butte: a 40 m flat top 25 m high, steep sides, on a
// 1 m grid 200 m square.
function butteLand() {
 const nx = 200, nz = 200, cell = 1, halfX = 100, halfZ = 100, ground = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const x = -halfX + i + .5, z = -halfZ + j + .5, d = Math.hypot(x, z);
  ground[j * nx + i] = d < 20 ? 25 : d < 40 ? 25 * (1 - (d - 20) / 20) ** 1.3 : 0;
 }
 return {nx, nz, cell, halfX, halfZ, ground};
}
const inside = (rings, x, z) => rings.filter(r => {
 let c = false;
 for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
  const [xi, zi] = r[i], [xj, zj] = r[j];
  if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
 }
 return c;
}).length % 2 === 1;

test('every landscape names what its faces and aprons are', () => {
 for (const [k, b] of Object.entries(BIOMES)) {
  const {face, apron} = skinKinds(b), own = layersFor(b);
  assert.ok(own.includes(face), `${k}: ${face} is not the landscape's own`);
  assert.ok(!apron || own.includes(apron), `${k}: ${apron} is not the landscape's own`);
 }
 // Chambers Bay's dunes, seen in the builder: no grey rock on a dune.
 assert.deepEqual(skinKinds(BIOMES.seaside), {face: 'native', apron: 'heather'});
 assert.deepEqual(skinKinds(BIOMES.badlands), {face: 'rock', apron: 'hardpan'});
 assert.equal(skinKinds(BIOMES.rockies).apron, 'scree');
});

test('a butte gets rock on its sides, its apron below, grass on its top and the plain', () => {
 const land = butteLand();
 const skin = skinFromHeights(land, BIOMES.badlands);
 const rock = skin.rings.rock, pan = skin.rings.hardpan;
 assert.ok(skin.cells.face > 500, `the butte's sides are rock (${skin.cells.face} cells)`);
 assert.ok(inside(rock, 26, 0), 'a steep side is rock');
 assert.ok(!inside(rock, 0, 0), 'the flat top is not rock');
 assert.ok(!inside(rock, 80, 80) && !inside(pan, 80, 80), 'the flat plain is left grass');
 assert.ok(skin.cells.apron >= 0);
});

test('the holes stay as they are', () => {
 const land = butteLand();
 const keepOut = (x, z) => x > 0;          // a fairway over the butte's east half
 const skin = skinFromHeights(land, BIOMES.badlands, keepOut);
 assert.ok(inside(skin.rings.rock, -26, 0), 'the west side is rock');
 assert.ok(!inside(skin.rings.rock, 26, 0), 'the east side, under the fairway, is not');
});

test('the skin goes into the course beside what was painted by hand', () => {
 const doc = {surfaces: {rock: [[[[0, 0], [1, 0], [1, 1]]]]}};
 applySkin(doc, skinFromHeights(butteLand(), BIOMES.badlands));
 assert.equal(doc.surfaces.rock.length, 2, 'the hand-painted rock kept, the skin added');
 applySkin(doc, skinFromHeights(butteLand(), BIOMES.badlands), {replace: true});
 assert.equal(doc.surfaces.rock.length, 1, 'or replaced, when asked');
});
