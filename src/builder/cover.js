// GROUND COVER (the owner, 4 November 2026: "a paint brush for ground cover, so
// things like rocks, mixed bushes, etc. ... adjustments for the min and max
// size of the props"). What a landscape offers to paint, and one dab of the
// brush scattered on the ground. Pure; tests/builder-cover.test.mjs.
//
// Only the landscape's own, as with every other tool in the editor: its stone
// (the game picks the model from `rockStyle`), and the low plants it grows,
// taken from its plant list and its stands' understory with their weights.
// Rocks are their own record in the course file (course-doc.js `rocks`) and
// stop a ball, as the generator's do. Bushes and flowers are stored trees of
// the shrub role with their species named, so nothing new plays differently.
import {GROUND_PLANTS} from '../species.js';
import {CONIFERS, PALMS} from '../built-world.js';
import {TREE_ROLES} from '../course-doc.js';
import {TREE_NAMES} from './tree-names.js';

// PLACED: what counts as a flower rather than a bush on the two buttons.
export const FLOWER_PLANTS = new Set(['columbine', 'lupine', 'prairieforbs', 'douglasiris', 'californiapoppy', 'bluebonnet', 'wildsunflower', 'fireweed', 'balsamroot', 'mulesear', 'globemallow', 'sorrel', 'cottongrass']);
// Sizes offered, metres: a rock across, a plant tall or across as its model is
// sized (species.js SPREAD_SIZED). `from` is where the sliders start. PLACED.
export const COVER_RANGE = {rocks: {low: .2, high: 6, from: [.4, 1.6]}, bushes: {low: .2, high: 5, from: [.6, 1.6]}, flowers: {low: .1, high: 2, from: [.3, .8]}, trees: {low: 3, high: 45, from: [10, 22]}};
export const ROCK_SHAPES = 4;
// Cover stands on open ground only, in both editors. A tree may stand in the
// semi-rough too, as door 2 always let it (the 3D editor refused a tree nothing
// until 4 November 2026: one could be planted on a green).
export const COVER_REFUSED = new Set(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'road', 'semi']);
export const TREE_REFUSED = new Set(['fairway', 'green', 'tee', 'sand', 'water', 'path', 'road']);
export const refusedBy = key => key === 'trees' ? TREE_REFUSED : COVER_REFUSED;

function lowPlants(bio) {
 const weights = new Map();
 for (const [kind, w] of [...(bio?.plants ?? []), ...(bio?.stands?.under?.plants ?? [])]) if (GROUND_PLANTS.has(kind)) weights.set(kind, (weights.get(kind) ?? 0) + w);
 return [...weights];
}
// THE TREE BRUSH (the owner, 4 November 2026: "will it place randomly instead of
// just a line when you paint?"): the same dab as ground cover, its species the
// landscape's own trees, their sizes heights, a share of a tree's height its reach.
export function treeCover(bio) {
 const tall = (bio?.plants ?? []).filter(([k]) => !GROUND_PLANTS.has(k));
 return {key: 'trees', label: 'Trees', plants: tall.length ? tall : [['oak', 1]]};
}
// The landscape's trees to pick from, one at a time, by name: its plant list and
// its stands', [[species, name]]. Two keys can share a name (a landscape's own
// shore pine and the older `pine`): one line each way, the first kept.
export function treeChoices(bio) {
 const seen = new Map();
 for (const [k] of [...(bio?.plants ?? []), ...(bio?.stands?.plants ?? [])]) { if (GROUND_PLANTS.has(k)) continue; const name = TREE_NAMES[k] ?? k; if (!seen.has(name)) seen.set(name, k); }
 return [...seen].map(([name, k]) => [k, name]).sort((a, b) => a[1].localeCompare(b[1]));
}
export const coverByKey = (bio, key) => key === 'trees' ? treeCover(bio) : coverOptions(bio).find(c => c.key === key) ?? null;
// A stored tree from a painted one: a crown and trunk from its height, as door 2
// and physics.js size one, and a role by its kind.
export function treeSized(species, h) {
 return {h, crown: h * .28, trunk: Math.min(.8, Math.max(.14, h * .027)), role: TREE_ROLES.indexOf(CONIFERS.has(species) ? 'conifer' : PALMS.has(species) ? 'palm' : 'broadleaf')};
}
// What a landscape can paint: [{key, label, plants: [[species, weight]]}].
export function coverOptions(bio) {
 const low = lowPlants(bio), bushes = low.filter(([k]) => !FLOWER_PLANTS.has(k)), flowers = low.filter(([k]) => FLOWER_PLANTS.has(k));
 return [{key: 'rocks', label: 'Rocks', plants: []}, {key: 'bushes', label: 'Mixed bushes', plants: bushes.length ? bushes : [['shrub', 1]]}, ...(flowers.length ? [{key: 'flowers', label: 'Flowers', plants: flowers}] : [])];
}
const weighted = (list, u) => { let t = u * list.reduce((n, p) => n + p[1], 0); for (const p of list) { t -= p[1]; if (t <= 0) return p[0]; } return list.at(-1)[0]; };

// A size between `min` and `max`: mostly small with the odd large one, as
// stones and bushes lie (PLACED: the square of an even draw).
export const coverSize = (min, max, u) => min + (Math.max(min, max) - min) * u * u;

// One dab: pieces in the disc, about `density` of them for every 10 square
// metres, or every 100 for trees (at least one try), each on `open` ground and
// clear of what stands there (`taken`). `cover`: an entry of coverOptions, or
// treeCover. Returns
// [{rock: [x, z, size, shape, turn]}] or [{x, z, size, species}].
export function scatterCover({cover, x, z, radius, min, max, density = .5, rng = Math.random, open, taken = () => false}) {
 const trees = cover.key === 'trees', out = [], tries = Math.max(1, Math.round(Math.PI * radius * radius / (trees ? 100 : 10) * density)), reachOf = s => s * (trees ? .14 : .5);
 for (let n = 0; n < tries; n++) {
  const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * radius, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, size = coverSize(min, max, rng()), reach = reachOf(size);
  if (!open(px, pz) || taken(px, pz, reach) || out.some(p => Math.hypot((p.rock?.[0] ?? p.x) - px, (p.rock?.[1] ?? p.z) - pz) < reach + reachOf(p.rock?.[2] ?? p.size))) continue;
  const r2 = v => Math.round(v * 100) / 100;
  if (cover.key === 'rocks') out.push({rock: [r2(px), r2(pz), r2(size), Math.floor(rng() * ROCK_SHAPES), r2(rng() * Math.PI * 2)]});
  else out.push({x: r2(px), z: r2(pz), size: r2(size), species: weighted(cover.plants, rng())});
 }
 return out;
}
// Does a rock, or a plant's stem, stand within `reach` of a point?
export function coverAt({rocks, trees}, x, z, reach) {
 for (const q of rocks) { const d = reach + q[2] / 2, dx = q[0] - x; if (dx > d || dx < -d) continue; if (Math.hypot(dx, q[1] - z) < d) return true; }
 // The 3D editor's trees are arrays and door 2's are records.
 for (const t of trees) { const d = reach + .5, dx = (t.x ?? t[0]) - x; if (dx > d || dx < -d) continue; if (Math.hypot(dx, (t.z ?? t[1]) - z) < d) return true; }
 return false;
}
