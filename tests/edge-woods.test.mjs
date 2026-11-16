import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateWorld} from '../src/course.js';
import {surroundTrees, courseEdge} from '../src/surround.js';
import {edgeShares, edgeWoods, edgeFade, edgeUniform, EDGE_WOODS} from '../src/edge-woods.js';

// THE COURSE'S WOODS CARRY ON PAST ITS LINE (15 November 2026). The owner:
// "We dont blend the trees out into the surrounding landscape. We need to make
// that fix at the root." What is held here: the course's edge is measured, the
// surroundings take it up at the line and give way to the country's own
// pattern by `band`, and the ground's paint is handed the same numbers. How it
// looks needs a graphics card and is seen in captures.

// A made-up course: 600 by 400 m, a stand 9 m apart along its +x side only.
function fakeWorld() {
 const trees = [];
 for (let z = -195; z < 200; z += 9) for (let x = 300 - 4; x > 300 - 45; x -= 9) trees.push({x, z, h: 20, r: 3, kind: 'dougfir', stand: true});
 return {halfX: 300, halfZ: 200, trees};
}

test('the edge is measured side by side: wooded where the stand is, open where it is not', () => {
 const s = edgeShares(fakeWorld(), 9);
 assert.equal(s.length, 4 * EDGE_WOODS.segs);
 for (const v of s) assert.ok(v >= 0 && v <= 1);
 for (let k = 0; k < EDGE_WOODS.segs; k++) {
  assert.ok(s[k] > .9, `+x piece ${k}: ${s[k].toFixed(2)}`);
  assert.equal(s[EDGE_WOODS.segs + k], 0, `-x piece ${k} is open`);
 }
 assert.equal(edgeUniform(s).length, 8, 'eight vec4s for the ground');
 assert.deepEqual(edgeUniform(s)[0], [s[0], s[1], s[2], s[3]]);
});

test('past the line the course\'s share holds, then the country takes over', () => {
 const w = fakeWorld(), s = edgeShares(w, 9);
 const wooded = edgeWoods(w, s, () => 1), open = edgeWoods(w, s, () => 0);
 // Off the open -x side, into wooded country: open at the line, woods by the band's end.
 assert.ok(wooded(-301, 0) < .05, `open at the line (${wooded(-301, 0).toFixed(2)})`);
 assert.ok(wooded(-300 - EDGE_WOODS.band * 1.5, 0) > .9, 'the country\'s woods past the band');
 // Off the wooded +x side, into open country: woods at the line, open past the band.
 assert.ok(open(301, 0) > .9, `woods at the line (${open(301, 0).toFixed(2)})`);
 assert.ok(open(300 + EDGE_WOODS.band * 1.5, 0) < .1, 'the country\'s meadow past the band');
 // And the edge wanders: the same distance out is not the same everywhere.
 let lo = 1, hi = 0;
 for (let z = -190; z <= 190; z += 10) { const f = edgeFade(400, z, 100); lo = Math.min(lo, f); hi = Math.max(hi, f); }
 assert.ok(hi - lo > .2, `the edge wanders (${lo.toFixed(2)} to ${hi.toFixed(2)} 100 m out)`);
});

test('a wooded course\'s woods carry on past its line at about their own density', () => {
 const w = generateWorld({seed: 'FAIRWAY', biome: 'pacnw', holes: 9}), far = surroundTrees(w).far;
 const shares = courseEdge(w), mean = shares.reduce((a, b) => a + b, 0) / shares.length;
 assert.ok(mean > .6, `the Pacific Northwest's edge is wooded (${mean.toFixed(2)})`);
 // Tall trees a hectare, in the 40 m strip inside the line and the 40 m outside it.
 const hx = w.halfX, hz = w.halfZ, perimeter = 4 * (hx + hz);
 let inside = 0, outside = 0;
 for (const t of w.trees) if ((t.h ?? 0) >= 4 && Math.min(hx - Math.abs(t.x), hz - Math.abs(t.z)) >= 0 && Math.min(hx - Math.abs(t.x), hz - Math.abs(t.z)) < 40) inside++;
 for (const t of far) if (t.h >= 4 && t.d < 40) outside++;
 const ratio = outside / inside;
 // Before: the bands start 12 m apart against the stand's 9, and the
 // country's meadows ran to the line -- 0.42 of the inside's density (1.01 after).
 assert.ok(ratio > .8 && ratio < 1.25, `outside the line ${(outside / perimeter * 250).toFixed(1)} trees a hectare to inside ${(inside / perimeter * 250).toFixed(1)} (${ratio.toFixed(2)})`);
});

test('the ground\'s paint reads the same numbers', () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.ok(src.includes('farEdge:{value:edgeUniform(courseEdge(w))'), 'ground.js is handed the course\'s edge');
 assert.ok(src.includes('woods=mix(edgeShare(wp),woods,edgeFade(wp,outside))'), 'and lays the floor by it');
 assert.ok(src.includes('coverHash(c+vec2(17.,5.))'), 'the wandering edge is edge-woods.js\'s own noise');
});
