import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';

// THE GROUND STOPPED DRAWING BECAUSE A REPLACE LINK WAS DELETED.
//
// ground.js builds the fragment shader as a chain of .replace() calls against
// three's own #include anchors. A scripted edit removed the `color_fragment`
// link, so the whole body -- hundreds of lines meant for inside main() -- was
// appended to the `common` block at GLOBAL scope. GLSL then rejects `vec2
// wp=groundPoint.xz;` as a non-constant global initialiser, the program fails to
// link, and every draw call raises INVALID_OPERATION. Nothing else notices:
// node --check passes, the bundler passes, the whole suite passes, and the app
// boots with no fatal card. Only the GPU knows, and only if something is
// actually drawing.

const SRC = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
const frag = THREE.ShaderLib.toon.fragmentShader;
const MAIN = frag.indexOf('void main()');

// The anchors ground.js replaces in the FRAGMENT shader, in the order it uses.
const FRAGMENT_ANCHORS = ['common', 'color_fragment', 'normal_fragment_maps'];

test('every anchor ground.js replaces still exists in three\'s shader', () => {
 // three renames and removes chunks between versions; a silent miss means the
 // replace does nothing at all and the cue quietly stops existing.
 for (const a of FRAGMENT_ANCHORS)
  assert.ok(frag.includes(`#include <${a}>`),
   `three ${THREE.REVISION} has no #include <${a}> in the toon fragment shader`);
});

test('the shader body is injected inside main(), not at global scope', () => {
 // `common` is global on purpose: it carries helper functions. Everything else
 // is statements, and statements outside main() do not compile.
 assert.ok(frag.indexOf('#include <common>') < MAIN, 'common should be global');
 for (const a of FRAGMENT_ANCHORS.filter(x => x !== 'common'))
  assert.ok(frag.indexOf(`#include <${a}>`) > MAIN,
   `#include <${a}> is no longer inside main(); injecting statements there would not compile`);
});

test('ground.js still has every link in its replace chain', () => {
 // Scoped to the FRAGMENT chain: `common` is legitimately replaced twice, once
 // for the vertex shader and once for the fragment, and a first version of this
 // test failed on that rather than on a real fault.
 const chain = SRC.slice(SRC.indexOf('shader.fragmentShader='));
 for (const a of FRAGMENT_ANCHORS) {
  const uses = chain.split(`replace('#include <${a}>'`).length - 1;
  assert.equal(uses, 1,
   `the fragment chain has ${uses} replace() calls for #include <${a}>; expected exactly one. ` +
   `A missing link sends that block into whichever chunk precedes it.`);
 }
});

test('the statement body goes to an anchor that is inside main()', () => {
 // The specific failure: the body that starts `vec2 wp=groundPoint.xz` must be
 // attached to color_fragment, which is inside main(), and not to common.
 const bodyAt = SRC.indexOf('vec2 wp=groundPoint.xz');
 const colorAt = SRC.indexOf("replace('#include <color_fragment>'");
 const commonAt = SRC.indexOf("replace('#include <common>'", SRC.indexOf('fragmentShader'));
 assert.ok(bodyAt > 0 && colorAt > 0, 'body or color_fragment link missing');
 assert.ok(colorAt < bodyAt && colorAt > commonAt,
  'the shader body is not attached to the color_fragment link -- it would land at global scope');
});

test('the program cache key changes when the shader does', () => {
 // three caches compiled programs by this key. Leave it alone across a shader
 // edit and a stale program can be handed back.
 const key = SRC.match(/customProgramCacheKey=\(\)=>\s*'([^']+)'/);
 assert.ok(key, 'no customProgramCacheKey found');
 assert.match(key[1], /-v(\d+)$/, `cache key ${key[1]} should end in a version to bump`);
});
