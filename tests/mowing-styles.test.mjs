// THE MOWING STYLES (the owner, 26 November 2026: "let's make it a setting
// for the courses in the generator as well as the builder ... add settings
// for the mowing style for greens, approaches, and fairways"). A generated
// course's are settings (settings-schema.js), a built course's are in its file
// (course-doc.js `mowing`); the ground shader reads them as one uniform.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_COURSE, MOW_STYLES, FIELD} from '../src/settings-schema.js';
import {normaliseMowing, validateDoc, writeBuiltFile, readBuiltFile} from '../src/course-doc.js';
import {mowStyleOf} from '../src/ground.js';
import {worldFromDoc} from '../src/built-world.js';

test('a course with no mowing is mown as every course was: fairway stripes, green and approach diamonds', () => {
 assert.deepEqual(MOW_STYLES, ['stripes', 'checker', 'diamonds']);
 assert.equal(DEFAULT_COURSE.mowFairway, 'stripes'); assert.equal(DEFAULT_COURSE.mowGreen, 'diamonds');
 const v = mowStyleOf({});
 assert.deepEqual([v.x, v.y, v.z], [0, 2, 2]);
 const w = mowStyleOf({mowFairway: 'diamonds', mowGreen: 'stripes', mowApproach: 'checker'});
 assert.deepEqual([w.x, w.y, w.z], [2, 0, 1]);
 assert.deepEqual([mowStyleOf({mowFairway: 'plaid'}).x], [0], 'an unknown style is the old one');
 // Both settings are choices a player sets in the course's turf.
 for (const k of ['mowFairway', 'mowGreen']) { assert.equal(FIELD[k].kind, 'choice'); assert.equal(FIELD[k].category, 'turf'); assert.ok(FIELD[k].names.checker); }
});

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
function doc(over = {}) {
 const nx = 121, nz = 121;
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -5, z: -50, set: 'back'}], green: {x: 0, z: 50}, line: [[-5, -50], [0, 50]]}));
 return {type: 'built', name: 'Mown', landscape: 'parkland', halfX: 60, halfZ: 60, land: {x0: -60, z0: -60, cell: 1, nx, nz, heights: new Float32Array(nx * nz).fill(100)},
  surfaces: {green: [box(-8, 42, 8, 58)], fairway: [box(-10, -40, 10, 40)]}, holes, trees: new Float32Array(0), treeKinds: [], ...over};
}

test('a built course carries its own mowing in its file, never the player\'s last course\'s', async () => {
 assert.equal(normaliseMowing(null), null);
 assert.deepEqual(normaliseMowing({fairway: 'diamonds', green: 'nonsense', approach: 'checker'}), {fairway: 'diamonds', approach: 'checker'});
 const mown = validateDoc(doc({mowing: {fairway: 'checker', green: 'stripes', approach: 'stripes'}}));
 const read = await readBuiltFile(await writeBuiltFile(mown, 3));
 assert.deepEqual(read.mowing, {fairway: 'checker', green: 'stripes', approach: 'stripes'}, 'written and read back');
 const w = worldFromDoc(read, {mowFairway: 'diamonds'});
 assert.equal(w.settings.mowFairway, 'checker', 'the file wins over the settings handed in');
 assert.equal(w.settings.mowApproach, 'stripes');
 const plain = worldFromDoc(validateDoc(doc()), {mowFairway: 'diamonds', mowGreen: 'stripes'});
 assert.equal(plain.settings.mowFairway, 'stripes', 'a file without mowing: as before');
 assert.equal(plain.settings.mowGreen, 'diamonds'); assert.equal(plain.settings.mowApproach, 'diamonds');
 assert.ok(!('mowing' in validateDoc(doc())), 'and it stays the file it was');
});

test('the shader cuts each surface in its own style, fairways in the world frame so shared ones mow as one', () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.match(src, /uniform vec3 gt_path,gt_road,mowStyle;/);
 assert.match(src, /mowStyle:\{value:mowStyleOf\(w\.settings\)\}/);
 assert.match(src, /float mowAs=kind==4\.\?mowStyle\.y:appr\?mowStyle\.z:mowStyle\.x;/);
 // Two passes: a green's in the hole's frame, a fairway's in the world's,
 // from the same folded line as the bands.
 assert.match(src, /vec2 base=inHole\?mow:wm,q=inHole\?p:wp,vq=inHole\?vh:dv;/);
 assert.match(src, /vec2 wm=vec2\(mow\.x\*tr\.z\+mow\.y\*tr\.w,-mow\.x\*tr\.w\+mow\.y\*tr\.z\);if\(wm\.x<0\.\)wm=-wm;/);
});
