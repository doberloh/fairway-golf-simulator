// `T` IS THREE.JS, AND NOTHING ELSE MAY BE CALLED `T`.
//
// Seventeen modules import the library as `import * as T from 'three'`. In any
// of them, a local binding named `T` -- a `const T=...` for the top edge of a
// rectangle, say -- shadows the library for the WHOLE function it sits in,
// because `const` and `let` are scoped to the block, not to the line. Every
// earlier `new T.Vector3()` in that function then reaches for a variable that
// has not been initialised yet, and throws a ReferenceError on every call.
//
// This is not hypothetical. `GolfView.projectMarker` declared
// `const L=...,R=...,T=i.top,B=...` four lines below `new T.Vector3(...)`, and
// from 19 September it threw on every frame the ball was on a green -- sixty a
// second, while putting, in every round. It was silent: the frame loop
// schedules the next frame before it does anything else, so the game kept
// running and simply skipped the rest of each frame. The putting distance
// marker the function exists for never worked at all, and the aim label that
// is meant to hide on the green never did.
//
// NOTHING ELSE COULD HAVE CAUGHT IT. `node --check` parses it happily; the
// bundler emits it; no test called that function. It was found by the browser
// smoke test (`tools/smoke.mjs`), dropping a ball beside the pin.
//
// Two checks, because they fail for different reasons. The scan catches the
// whole CLASS in any of the seventeen files, including functions no test will
// ever call. The direct call proves this particular function works, rather
// than merely that it no longer contains the pattern.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GolfView} from '../src/renderer.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

// Comments are removed first, so that prose explaining a bug -- "it declared
// T=i.top" -- cannot trip the check it motivated. Line comments are only
// stripped where `//` is not inside a string or a URL, which is good enough
// for this codebase and is checked below by the file that contains the most
// URLs and shader source passing clean.
function codeOnly(src) {
 return src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

// A binding named exactly `T`: a declaration, an assignment, or a default
// parameter. `T.x = ...` is excluded (a property), `T==` and `T=>` are
// excluded (a comparison, an arrow). Assigning to an import is itself a
// TypeError, so there is no legitimate `T =` anywhere in these files.
const BINDS_T = /(?<![.\w$])T\s*=(?![=>])/g;

const threeModules = fs.readdirSync(SRC)
 .filter(f => f.endsWith('.js'))
 .filter(f => /import \* as T from 'three'/.test(fs.readFileSync(path.join(SRC, f), 'utf8')));

test('the modules that import three as T are the ones this guards', () => {
 // Not a fixed list -- any new module importing three as T is covered the
 // moment it exists. This only stops the scan silently covering nothing.
 assert.ok(threeModules.length >= 17, `expected at least 17 modules importing three as T, found ${threeModules.length}`);
 assert.ok(threeModules.includes('renderer.js'));
});

test('no module that imports three as T declares anything else called T', () => {
 const found = [];
 for (const file of threeModules) {
  const code = codeOnly(fs.readFileSync(path.join(SRC, file), 'utf8'));
  for (const hit of code.matchAll(BINDS_T)) {
   const line = code.slice(0, hit.index).split('\n').length;
   found.push(`src/${file}:${line}  ${code.split('\n')[line - 1].trim().slice(0, 100)}`);
  }
 }
 assert.deepEqual(found, [], `a local T shadows three.js for its whole function:\n  ${found.join('\n  ')}`);
});

test('the scan would have caught the bug that motivated it', () => {
 // The check is only worth something if it goes red on the real thing.
 const original = 'const w=this.course.toWorld(p),v=new T.Vector3(w.x,p.y,w.z);\n'
  + 'const L=i.left,R=Math.max(L+1,W-i.right),T=i.top,B=Math.max(T+1,H-i.bottom);';
 assert.equal([...codeOnly(original).matchAll(BINDS_T)].length, 1);
 // ...and stays quiet on the legitimate shapes that look similar.
 const fine = 'x.T=1; if(T===y){} const f=T=>T; const q={T:1}; new T.Vector3(); // T=i.top in a comment';
 assert.equal([...codeOnly(fine).matchAll(BINDS_T)].length, 0);
});

// ------------------------------------------------------------ the function
//
// A stand-in for the renderer's `this`: a real three camera looking down the
// hole, a course whose local frame IS the world frame, and a 1000x600 canvas.
function markerRig() {
 const camera = new T.PerspectiveCamera(50, 1000 / 600, 0.1, 5000);
 camera.position.set(0, 20, -60);
 camera.lookAt(0, 0, 100);
 camera.updateMatrixWorld();
 return {
  camera,
  canvas: {clientWidth: 1000, clientHeight: 600},
  course: {toWorld: p => ({x: p.x, z: p.z})},
 };
}
const project = (point, insets) => GolfView.prototype.projectMarker.call(markerRig(), point, insets);

test('projectMarker runs at all', () => {
 assert.doesNotThrow(() => project({x: 0, y: 0, z: 100}, 30));
});

test('a point in view lands inside the free rectangle, unclamped', () => {
 const m = project({x: 0, y: 0, z: 100}, 30);
 assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y));
 assert.equal(m.clamped, false);
 assert.ok(m.x > 30 && m.x < 970, `x ${m.x}`);
 assert.ok(m.y > 30 && m.y < 570, `y ${m.y}`);
});

test('a point behind the camera clamps to the edge of the rectangle', () => {
 // The case the function exists for: the cup is behind you, and the marker
 // has to sit on the edge pointing at it rather than vanish.
 const m = project({x: 0, y: 0, z: -200}, 30);
 assert.equal(m.clamped, true);
 const onEdge = Math.abs(m.x - 30) < 1 || Math.abs(m.x - 970) < 1 || Math.abs(m.y - 30) < 1 || Math.abs(m.y - 570) < 1;
 assert.ok(onEdge, `clamped to (${m.x.toFixed(1)}, ${m.y.toFixed(1)}), which is not on the rectangle's edge`);
 assert.ok(Number.isFinite(m.angle));
});

test('uneven insets move the rectangle, and a clamped marker respects them', () => {
 // The HUD is not symmetric -- the course card and the shot controls eat
 // different edges -- which is why insets take four sides. The top inset is
 // the one that shared a name with three.js.
 const m = project({x: 0, y: 0, z: -200}, {top: 200, right: 30, bottom: 30, left: 30});
 assert.ok(m.y >= 200 - 1, `clamped above the top inset: y ${m.y.toFixed(1)}`);
});
