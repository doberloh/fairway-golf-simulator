import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// The generator's worker is a script of its own, inlined into the single page,
// so whatever it imports is in the page twice. On 3 November 2026 one import
// from course.js reached the models and the page went from 38 MB to 63 MB, with
// no test noticing and the start of the game slower for it.

const IMPORT = /^\s*(?:import|export)\s[^;]*?from\s+'(\.[^']+)'/gm;
const reach = start => {
 const seen = new Set(), todo = [start];
 while (todo.length) {
  const file = todo.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(IMPORT)) todo.push(path.resolve(path.dirname(file), m[1]));
 }
 return seen;
};

test('the generator\'s worker carries no models', () => {
 const files = [...reach(path.resolve('src/gen-worker.js'))].map(f => path.basename(f));
 assert.ok(files.includes('course.js'), 'the walk found the generator');
 for (const heavy of ['asset-meshes.js', 'mesh-assets.js', 'tree-seat.js']) assert.ok(!files.includes(heavy), `the worker reaches ${heavy}`);
});
