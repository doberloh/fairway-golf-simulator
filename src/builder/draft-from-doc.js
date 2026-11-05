// BACK TO 2D FROM ANY COURSE (the owner, 4 November 2026: "i don't think there
// is a 'back to 2d' button in the 3d editor"). The button only appeared on a
// course that had just come from door 2's steps in this sitting: a course
// opened from a file, or one generated and taken over, had no 2D to go back
// to. This makes one: the course as door 2 holds a course part way through --
// its land on one grid, each surface a layer of the trace, its holes, trees
// and houses -- so the plan view opens at the review as if it had been built
// there. There is no survey behind it, so the steps that read one (the LIDAR
// views, the auto trace, the pictures' lining up by map position) have nothing
// to read; the land stays the course's own. Pure; tests/builder-draft.test.mjs.
import {GRID_MARGIN, landSampler} from '../built-world.js';
import {SURFACE_KINDS, TREE_STRIDE} from '../course-doc.js';
import {fillRings} from './round-trip.js';
import {cellFor} from './real-course.js';

// `at` metres on a side, whole cells, centred: door 2's grids have their
// points at -half + i * cell.
const fit = (half, cell) => Math.ceil(2 * half / cell) + 1;

export function draftFromDoc(doc) {
 const sample = landSampler(doc), ex = doc.halfX + GRID_MARGIN, ez = doc.halfZ + GRID_MARGIN, cell = cellFor(2 * ex, 2 * ez);
 const nx = fit(ex, cell), nz = fit(ez, cell), N = nx * nz, halfX = (nx - 1) * cell / 2, halfZ = (nz - 1) * cell / 2;
 const ground = new Float32Array(N);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ground[j * nx + i] = sample(-halfX + i * cell, -halfZ + j * cell);
 const land = {nx, nz, cell, halfX, halfZ, center: {x: 0, y: 0}, unit: {h: 1, v: 1}, method: 'course', points: 0, rgb: null, ground, surface: ground,
  canopy: new Float32Array(N), intensity: new Float32Array(N).fill(NaN), water: new Uint8Array(N), building: new Uint8Array(N), multi: new Uint8Array(N), noReturns: new Uint8Array(N), filled: new Uint8Array(N)};
 const at = {nx, nz, cell, x0: -halfX - cell / 2, z0: -halfZ - cell / 2}, masks = new Map();
 const add = (kind, rings) => { if (!masks.has(kind)) masks.set(kind, new Uint8Array(N)); fillRings(rings, at, masks.get(kind)); };
 for (const k of SURFACE_KINDS) for (const poly of doc.surfaces?.[k] ?? []) add(k, poly);
 for (const w of doc.water ?? []) add('water', w.rings);
 const trees = [];
 for (let k = 0; k + TREE_STRIDE <= doc.trees.length; k += TREE_STRIDE) {
  const [x, z, h, crown, trunk, role, ki] = doc.trees.subarray(k, k + TREE_STRIDE), kind = doc.treeKinds?.[ki];
  trees.push({x, z, h, crown, trunk, role, kept: true, ...(kind ? {kind} : {})});
 }
 const holes = doc.holes.map(h => ({tees: h.tees.map(t => ({...t})), aims: h.line.slice(1, -1).map(([x, z]) => ({x, z})), green: {...h.green}, par: h.par, index: h.index}));
 return {step: 5, name: doc.name, landscape: doc.landscape, credits: doc.credits ?? [], holes, holesN: holes.length, hole: 0, boundary: null, traceMode: 'manual', box: null, sources: [], view: {}, picOffsets: {},
  land, trace: {masks, hidden: [], trees, homes: structuredClone(doc.homes ?? [])}, landEdits: null, creeks: structuredClone(doc.creeks ?? []), rocks: structuredClone(doc.rocks ?? [])};
}
