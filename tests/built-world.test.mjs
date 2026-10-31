// A world from a hand-made built document (src/built-world.js): the field,
// the lie, the land and its patches, the holes, the trees. The frozen
// generated course is tests/freeze.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {worldFromDoc, builtSurface, builtFieldAt, landSampler, polygonDistance, speciesFor, BUILT_FIELD} from '../src/built-world.js';
import {biomeOf} from '../src/biomes.js';
import {greenDistance} from '../src/course.js';
import {GROUND_CODE} from '../src/ground.js';
import {BUILT_GROUND_CODE} from '../src/built-world.js';
import {GROUND_KINDS} from '../src/grounds.js';

test('the field\'s ground codes are the ground shader\'s, and cover every ground type', () => {
 for (const [k, c] of Object.entries(GROUND_CODE)) assert.equal(BUILT_GROUND_CODE[k], c, k);
 for (const k of GROUND_KINDS) assert.ok(BUILT_GROUND_CODE[k], `${k} has a code`);
});

const box = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]];
const disc = (cx, cz, r, n = 48) => [Array.from({length: n}, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cz + r * Math.sin(i / n * Math.PI * 2)])];
function doc(over = {}) {
 const nx = 241, nz = 241, heights = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = 300 + i * .05;
 const holes = Array.from({length: 9}, (_, i) => ({number: i + 1, par: 4, index: i + 1, tees: [{x: -10 + i, z: -100, set: 'back'}, {x: -10 + i, z: -80, set: 'front'}], green: {x: 0, z: 90}, line: [[-10 + i, -100], [0, 0], [0, 90]]}));
 return {type: 'built', name: 'Hand', landscape: 'midwest', halfX: 120, halfZ: 120,
  land: {x0: -120, z0: -120, cell: 1, nx, nz, heights},
  patches: [{x0: -20, z0: 70, cell: .25, nx: 161, nz: 161, heights: new Float32Array(161 * 161).fill(310)}],
  surfaces: {green: [disc(0, 90, 12)], fairway: [box(-15, -60, 15, 70)], tee: [box(-14, -104, 3, -96)], sand: [disc(20, 80, 4)], semi: [box(-22, -66, 22, 76)],
   heather: [box(60, -100, 110, 100)], path: [box(-30, -60, -27, 60)], hardpan: [box(-110, -100, -60, 100)]},
  water: [{rings: disc(-50, 0, 8)[0] ? disc(-50, 0, 8) : [], level: 297, kind: 'pond'}],
  holes, trees: new Float32Array([40, 40, 18, 5, .5, 2, -1, 45, 45, 1.5, 1, 0, 3, -1]), treeKinds: [], ...over};
}
const world = worldFromDoc(doc());
const at = (x, z) => world.surface(x, z);

test('the lie follows the outlines, in the generator\'s order', () => {
 assert.equal(at(0, 90), 'green');
 assert.equal(at(0, 90 - 12 - 1), 'fringe');
 assert.equal(at(0, 0), 'fairway');
 assert.equal(at(18, 0), 'semi');
 assert.equal(at(20, 80), 'sand', 'a bunker inside the semi collar is sand');
 assert.equal(at(-5, -100), 'tee');
 assert.equal(at(-50, 0), 'water');
 assert.equal(at(80, 0), 'heather');
 assert.equal(at(-80, 0), 'hardpan');
 assert.equal(at(-28.5, 0), 'path');
 assert.equal(at(40, -100), 'rough');
});

test('a field edge is where the outline is, to a few centimetres', () => {
 for (const x of [-15.1, -14.9, 14.9, 15.1]) assert.equal(at(x, 0), Math.abs(x) < 15 ? 'fairway' : 'semi', `x ${x}`);
 const d = builtFieldAt(world.builtField, 0, 90, 1);
 assert.ok(d <= -BUILT_FIELD.range + .1, 'deep inside reads the full range');
});

test('a patch takes over from the land inside it and fades in at its edge', () => {
 const s = landSampler(doc());
 assert.ok(Math.abs(s(0, 95) - 310) < 1e-3, 'inside: the patch');
 assert.ok(Math.abs(s(0, 0) - (300 + 120 * .05)) < 1e-3, 'outside: the land');
 const edge = s(-19.6, 90);
 assert.ok(edge > 305.1 && edge < 309.9, `at the edge, between (${edge})`);
});

test('the holes take their tees, green, par and frame from the records', () => {
 const h = world.holes[0];
 assert.equal(h.par, 4); assert.equal(world.holes.length, 9);
 const back = h.toWorld(h.tees.blue), front = h.toWorld(h.tees.red);
 assert.ok(Math.abs(back.z + 100) < 1e-6 && Math.abs(front.z + 80) < 1e-6, 'back tee is the blue, front the red');
 assert.ok(h.tees.blue.yards > h.tees.red.yards);
 assert.ok(greenDistance(h, h.green.x, h.green.z) < -11, 'greenDistance answers from the outline');
 assert.ok(Math.abs(polygonDistance(disc(0, 90, 12), 0, 90) + 12) < .05);
 assert.ok(h.leftWidth(80) > 10 && h.rightWidth(80) > 10, 'widths measured off the fairway');
});

test('trees keep their sizes; the landscape picks what draws them', () => {
 assert.equal(world.trees.length, 2);
 const [t, s] = world.trees;
 assert.equal(t.h, 18); assert.equal(t.radius, .5); assert.ok(['oak', 'aspen', 'maple'].includes(t.kind));
 assert.equal(s.kind, 'shrub');
 assert.equal(speciesFor(biomeOf('pnw'), 'conifer', 20, 1, 2) === 'pine' || speciesFor(biomeOf('pnw'), 'conifer', 20, 1, 2) === 'cedar', true);
 assert.ok(['palm', 'hala'].includes(speciesFor(biomeOf('island'), 'palm', 9, 3, 4)));
 assert.ok(speciesFor(biomeOf('links'), 'tree', 12, 0, 0), 'a landscape with no trees still draws one');
});

test('any landscape: the same file in Desert keeps every lie', () => {
 const d = worldFromDoc({...doc(), landscape: 'desert'});
 for (const [x, z] of [[0, 90], [0, 0], [80, 0], [-80, 0], [-50, 0], [20, 80]]) assert.equal(d.surface(x, z), at(x, z));
 assert.equal(d.trees[0].h, 18); assert.equal(d.trees[0].radius, .5);
 assert.equal(d.bio.name, biomeOf('desert').name);
});
