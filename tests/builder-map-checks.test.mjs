// Checking OpenStreetMap's holes against the course under them
// (src/builder/map-checks.js; the builder-ux goal, item 24).
import test from 'node:test';
import assert from 'node:assert/strict';
import {blobs, checkHoles, mapVerdict, mapHas, bendFor, LIMITS} from '../src/builder/map-checks.js';

const grid = {nx: 400, nz: 400, cell: 1, halfX: 200, halfZ: 200};
const mask = discs => { const m = new Uint8Array(grid.nx * grid.nz); for (const [x, z, r] of discs) for (let j = 0; j < grid.nz; j++) for (let i = 0; i < grid.nx; i++) if (Math.hypot(-200 + i - x, -200 + j - z) <= r) m[j * grid.nx + i] = 1; return m; };
// Three holes side by side, 300 m long (328 yd), greens at z -150, tees at z 150.
const G = [[-100, -150], [0, -150], [100, -150]], T = [[-100, 150], [0, 150], [100, 150]];
const greens = blobs(mask(G.map(([x, z]) => [x, z, 12])), grid), tees = blobs(mask(T.map(([x, z]) => [x, z, 4])), grid);
const hole = (n, more = {}) => ({tees: [{x: T[n][0], z: T[n][1], set: 'back'}], aims: [], green: {x: G[n][0], z: G[n][1]}, par: 4, ...more});

test('the pieces of a surface are found with their centres', () => {
 assert.equal(greens.length, 3);
 for (const [x, z] of G) assert.ok(greens.some(b => Math.hypot(b.x - x, b.z - z) < 1), `a green at ${x}, ${z}`);
});

test('a map that matches its course has nothing to check', () => {
 const doubts = checkHoles([hole(0), hole(1), hole(2)], {greens, tees});
 assert.deepEqual(doubts, []);
 assert.match(mapVerdict([1, 2, 3], doubts).words, /all check out/);
});

test('a green mark off every green is caught, with the nearest green to move it to', () => {
 const h = hole(1, {green: {x: 50, z: -150}});
 const [q] = checkHoles([hole(0), h, hole(2)], {greens, tees}).filter(q => q.kind === 'greenOff');
 assert.equal(q.hole, 1);
 assert.ok(q.fix && Math.hypot(q.fix.to.x - 0, q.fix.to.z + 150) < 1 || Math.hypot(q.fix.to.x - 100, q.fix.to.z + 150) < 1, `moved to a real green: ${JSON.stringify(q.fix)}`);
});

test('missing greens and tees, the wrong length for the par, two holes on one green', () => {
 const doubts = checkHoles([{tees: [], aims: [], green: null}, hole(1, {par: 3}), hole(2, {green: {x: 0, z: -150}})], {greens, tees});
 const kinds = doubts.map(q => `${q.hole}:${q.kind}`);
 for (const k of ['0:noGreen', '0:noTee', '1:length', '2:shared']) assert.ok(kinds.includes(k), `${k} in ${kinds}`);
});

test('a tee far from the last green says the numbers may be out of order; a line past the boundary is caught', () => {
 const far = hole(2, {tees: [{x: 190, z: 190, set: 'back'}]});
 const kinds = checkHoles([hole(0), hole(1), far], {greens, tees, boundary: [[-180, -180], [180, -180], [180, 180], [-180, 180]]}).map(q => `${q.hole}:${q.kind}`);
 assert.ok(kinds.includes('2:order') && kinds.includes('2:outside') && kinds.includes('2:teeOff'), kinds.join(' '));
});

test('the card, when typed, is a witness', () => {
 const doubts = checkHoles([hole(0)], {greens, tees, card: [{par: 4, yards: 420}]});
 assert.ok(doubts.some(q => q.kind === 'card'), 'a hole 90 yards short of its card');
});

test('a map with doubts on half its holes or more is unreliable; the checklist counts what is drawn', () => {
 const v = mapVerdict([1, 2, 3, 4], [{hole: 0}, {hole: 1}, {hole: 1}]);
 assert.equal(v.doubtful, 2); assert.ok(v.unreliable); assert.match(v.words, /unreliable/);
 const has = mapHas({green: 14, tee: 9, fairway: 12, sand: 30}, [hole(0), {tees: [], green: {x: 0, z: 0}}, null], 18);
 assert.deepEqual(has.slice(0, 5).map(r => r.have), [2, 2, 1, 14, 9]);
 assert.equal(LIMITS.onGreen, 15);
});

test('a line across the rough, and two lines crossing, are caught (the map pointing the wrong way)', () => {
 // Fairways straight down each hole, 30 m wide.
 const played = (x, z) => G.some(([gx]) => Math.abs(x - gx) < 15) && z > -140 && z < 140;
 assert.deepEqual(checkHoles([hole(0), hole(1), hole(2)], {greens, tees, played}), [], 'straight down the fairways: nothing');
 // Hole 1's green swapped to hole 3's: its line runs across the rough and crosses hole 2.
 const wrong = hole(0, {green: {x: 100, z: -150}});
 const kinds = checkHoles([wrong, hole(1), hole(2, {green: {x: -100, z: -150}})], {greens, tees, played}).map(q => `${q.hole}:${q.kind}`);
 assert.ok(kinds.includes('0:offPlay'), kinds.join(' '));
 assert.ok(kinds.some(k => k.endsWith(':crossing')), kinds.join(' '));
});

test('a line off the fairway is offered the green down the fairway from its tee', () => {
 const played = (x, z) => G.some(([gx]) => Math.abs(x - gx) < 15) && z > -140 && z < 140;
 const wrong = hole(0, {green: {x: 100, z: -150}});
 const q = checkHoles([wrong, hole(1)], {greens, tees, played}).find(q => q.kind === 'offPlay');
 assert.ok(q?.fix, 'a fix offered');
 assert.equal(q.fix.kind, 'green');
 assert.ok(Math.hypot(q.fix.to.x + 100, q.fix.to.z + 150) < 2, `hole 1's own green, down its fairway: ${JSON.stringify(q.fix.to)}`);
});

test('a dogleg is found on the fairway, and a straight hole is left alone (item 10)', () => {
 // An L-shaped fairway: up from the tee at (0, 150) to (0, 0), then left to the green at (-200, 0).
 const played = (x, z) => (Math.abs(x) < 15 && z > -10 && z < 160) || (Math.abs(z) < 15 && x > -210 && x < 10);
 const dog = {tees: [{x: 0, z: 150, set: 'back'}], aims: [], green: {x: -200, z: 0}, par: 4};
 const b = bendFor(dog, played);
 assert.ok(b, 'a bend found');
 assert.ok(Math.abs(b.x) < 20 && Math.abs(b.z) < 20, `the bend at the corner: ${JSON.stringify(b)}`);
 assert.ok(b.share > .8 && b.was < .3);
 const straightOne = {tees: [{x: 0, z: 150, set: 'back'}], aims: [], green: {x: 0, z: 0}, par: 4};
 assert.equal(bendFor(straightOne, played), null, 'a hole down its fairway keeps its straight line');
 assert.equal(bendFor({...dog, aims: [{x: 0, z: 0}]}, played), null, 'a hole with aim points is left as drawn');
});
