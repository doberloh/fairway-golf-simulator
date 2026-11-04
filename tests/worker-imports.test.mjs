import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The generator's worker is a script of its own, inlined into the single page,
// so whatever it keeps after the build's tree-shaking is in the page twice. On
// 3 November 2026 one import from course.js kept the models and the page went
// from 38 MB to 63 MB, with no test noticing and the start of the game slower
// for it. (Walking the source's imports cannot tell: homes.js imports the
// models too, for what it draws, and the build drops that from the worker.)

test('course.js asks the seat\'s arithmetic, not the module that reads the models', () => {
 const text = fs.readFileSync('src/course.js', 'utf8');
 assert.ok(!/from '\.\/(tree-seat|mesh-assets|asset-meshes)\.js'/.test(text));
});

test('the built page has its models once', {skip: !fs.existsSync('dist/index.html')}, () => {
 const page = fs.readFileSync('dist/index.html', 'utf8');
 assert.equal(page.split('Blender_TallFescue_2').length - 1, 1, 'a model\'s name twice: the worker has kept the models');
});
