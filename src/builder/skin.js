// SKIN THE LAND FROM ITS HEIGHTS (the owner, 3 November 2026: "In the
// builder, we should add an option that the user can click to do a best
// effort at skinning the landscape based on height. For example if the
// LIDAR shows something that looks like a mountain or a butte. We should
// skin it that way. Allow the user to paint it or indicate as such if they
// dont want to auto paint it. for all landscapes").
//
// A best effort, as the generator's landforms paint their own country
// (landforms.js): where the built land is steep it is the landscape's bare
// face -- its rock (the Badlands' banded clay, a crag's rock, Hawaii's lava,
// the Piedmont's red clay); on the gentler ground just below a face, its
// apron -- the landform's second ground (scree, hardpan, waste, cinder);
// flat tops and everything else stay grass. Never on the holes' turf, sand
// or water, nor within `clear` metres of them. Returns outlines per ground
// kind, ready for the course's surfaces (built-world.js GROUND_KINDS), so
// the editor adds them as layers the player can still paint over or erase.
//
// Thresholds PLACED (RESEARCH, *The builder skins the land*): a face from a
// slope of 0.6 (31 degrees) -- the generator's crags turn to rock between
// about .45 and .7 -- an apron from .22 within `apron` metres downhill of a
// face. Pure: no DOM, no three.js; tests/builder-skin.test.mjs.
import {layerRings} from './real-course.js';

// What a landscape's faces and aprons are made of, from its landform's own
// ground kinds: the first rock-like kind is the face, the next the apron.
const FACE_KINDS = new Set(['rock', 'hardpan', 'scree', 'coral']);
const APRON_KINDS = new Set(['scree', 'hardpan', 'waste', 'native', 'heather']);
export function skinKinds(bio) {
 const k = bio?.landform?.kinds || {};
 const face = [k.a, k.b, k.floor].find(x => FACE_KINDS.has(x)) || 'rock';
 const apron = [k.b, k.floor, k.a].find(x => x && x !== face && APRON_KINDS.has(x)) || null;
 return {face, apron};
}

export const SKIN = {face: .6, apron: .22, reach: 12, clear: 6};

// `land`: {nx, nz, cell, halfX, halfZ, ground} (the built land's heights).
// `keepOut(x, z)`: true where the holes' turf, sand or water is (or is
// within `clear` of it). Returns {kinds: {face, apron}, rings: {kind: rings},
// cells: {face, apron}} -- the count of cells each took, for the editor's
// message.
export function skinFromHeights(land, bio, keepOut = () => false, o = {}) {
 const {nx, nz, cell, halfX, halfZ, ground} = land, N = nx * nz, opt = {...SKIN, ...o};
 const {face, apron} = skinKinds(bio);
 const at = (i, j) => ground[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
 const slope = new Float32Array(N);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++)
  slope[j * nx + i] = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * cell);
 const xOf = i => -halfX + (i + .5) * cell, zOf = j => -halfZ + (j + .5) * cell;
 const faceMask = new Uint8Array(N), apronMask = new Uint8Array(N);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const k = j * nx + i;
  if (slope[k] >= opt.face && !keepOut(xOf(i), zOf(j))) faceMask[k] = 1;
 }
 // The apron: gentler ground within `reach` metres of a face and lower than
 // the face's foot there (it is what washed down, not a plateau beside it).
 if (apron) {
  const r = Math.max(1, Math.round(opt.reach / cell));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
   const k = j * nx + i;
   if (faceMask[k] || slope[k] < opt.apron || keepOut(xOf(i), zOf(j))) continue;
   let near = false;
   for (let dj = -r; dj <= r && !near; dj += 2) for (let di = -r; di <= r; di += 2) {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
    if (faceMask[jj * nx + ii] && ground[jj * nx + ii] > ground[k]) { near = true; break; }
   }
   if (near) apronMask[k] = 1;
  }
 }
 const rings = {[face]: layerRings(faceMask, land)};
 if (apron) rings[apron] = layerRings(apronMask, land);
 return {kinds: {face, apron}, rings, masks: {[face]: faceMask, ...(apron ? {[apron]: apronMask} : {})},
  cells: {face: faceMask.reduce((s, v) => s + v, 0), apron: apronMask.reduce((s, v) => s + v, 0)}};
}

// Into a course document: the skin's outlines added to its surfaces, beside
// whatever was painted already (painting by hand still wins: a hand-painted
// kind is left as it is unless `replace`).
export function applySkin(doc, skin, {replace = false} = {}) {
 doc.surfaces = doc.surfaces || {};
 for (const [kind, rings] of Object.entries(skin.rings)) {
  if (!rings.length) continue;
  // A surface is a list of polygons, each its rings read even-odd
  // (real-course.js docFromLand: one polygon of all a layer's rings).
  const have = doc.surfaces[kind] || [];
  doc.surfaces[kind] = replace ? [rings] : [...have, rings];
 }
 return doc;
}
