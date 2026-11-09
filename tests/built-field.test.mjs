// A BUILT COURSE'S FIELD IN BANDS (src/built-field.js, src/bake-pool.js; the
// frame-rate goal, 9 November 2026): the field baked as bands of rows -- as the
// workers bake it -- is byte for byte the field baked whole, so a course plays
// the same whichever way its field was made.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld, DEFAULT_COURSE} from '../src/course.js';
import {freezeWorld} from '../src/freeze.js';
import {writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {bakeBuiltField, fieldSize} from '../src/built-field.js';
import {builtExtent, worldFromDoc} from '../src/built-world.js';
import {BUILT_VERSION} from '../src/settings-schema.js';

test('bands of rows put together are the whole field, byte for byte', async () => {
 const w = generateWorld({...DEFAULT_COURSE, seed: 'FIELD-BANDS', biome: 'dmountain', holes: 9, creeks: 1, lakes: 1});
 const doc = await readBuiltFile(await writeBuiltFile(freezeWorld(w, {name: 'Bands'}), BUILT_VERSION));
 const {ex, ez} = builtExtent(doc), whole = bakeBuiltField(doc, ex, ez), {Sx, Sz} = fieldSize(ex, ez);
 for (const n of [3, 7]) {
  const a = new Uint8Array(Sx * Sz * 4), b = new Uint8Array(Sx * Sz * 4);
  for (let k = 0; k < n; k++) {
   const r0 = Math.round(Sz * k / n), r1 = Math.round(Sz * (k + 1) / n), part = bakeBuiltField(doc, ex, ez, [r0, r1]);
   a.set(part.a, r0 * Sx * 4); b.set(part.b, r0 * Sx * 4);
  }
  assert.ok(Buffer.compare(Buffer.from(a), Buffer.from(whole.a)) === 0, `${n} bands: the turf texture differs`);
  assert.ok(Buffer.compare(Buffer.from(b), Buffer.from(whole.b)) === 0, `${n} bands: the water and ground texture differs`);
 }
 // And a world made with a field handed in is the world made without.
 const given = worldFromDoc(doc, {}, {field: whole}), own = worldFromDoc(doc, {});
 for (const [x, z] of [[0, 0], [120, -80], [-300, 210]]) assert.equal(given.surface(x, z), own.surface(x, z));
});
