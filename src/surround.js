// THE SURROUNDINGS' TREES (the surroundings rework, 12 November 2026).
//
// The owner: "My preference would be full fledged landscape out much farther
// generated just like the playable landscape is" -- and of what stood there:
// "the 'tree domes' we added look way out of place". Past the property line
// the far woods (far-woods.js) drew lumps: clusters and spruces of a few
// triangles to 420 m, then one dome or cone a site, each as wide as its
// spacing, 20 to 300 m across beside real crowns of 8.
//
// Here the land past the line is planted by the course's own rule -- the
// landscape's stand (stands.js): its spacing, its mix of species, each tree
// sized as the course sizes it -- and what changes with distance is how it is
// DRAWN, never what it is:
//
//  NEAR (`near` metres past the line, on the course's own ground): tree
//  records like the course's, drawn by vegetation.js with the same models.
//  They are not in `world.trees`: nothing a ball meets, nothing the
//  fingerprint hashes, no saved round moved.
//
//  FAR (to `reach`): a site per tree, drawn as a picture of its own model
//  standing upright (vegetation.js addFarTrees). Sites thin with distance --
//  the spacing grows by one stand spacing every `fall` metres -- and each is
//  drawn a little larger for it, so the count stays bounded and a hillside
//  still reads as wooded.
//
// WHERE TREES STAND: the landscape's far forest record (biomes.js farForest:
// `cover` the share of the country wooded, `line` its treeline, `scrub` a
// desert's or a links' thin low growth), in patches by a broad noise; never
// on a cliff, in water or above the treeline.
//
// Pure (no three.js): hashed from the course's seed with salts of its own.
// PLACED: every number.
import {drawnGround} from './landscape-edge.js';
import {biomeOf} from './biomes.js';
import {standsOf, choose} from './stands.js';
import {GROUND_PLANTS, TREE_SIZE, tallHeight} from './species.js';
import {fbm, hash, saltOf} from './landforms.js';
import {allows} from './grounds.js';

const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const boxOut = (x, z, hx, hz) => Math.hypot(Math.max(0, Math.abs(x) - hx), Math.max(0, Math.abs(z) - hz));

// `near`: metres past the property line planted with real models. `reach`: how
// far the pictures run. `fall`: the distance over which the spacing grows by
// one stand spacing. `keep`: the share of stand sites planted at the line (a
// stand inside the property also loses sites to crowns that have no room).
// `nearMax`: how many of the near band's trees are drawn as real models, the
// ones nearest the line; the rest of the band are pictures like the far ones.
// (The first measurement, Ultra on Classic Parkland: 3,057 real trees past the
// line were 12 million triangles a frame, a tenth of the frame; the 160,000
// pictures were a third of a million.)
// `most`: the most far sites a course may hold; past it they are thinned
// evenly (a Pacific Northwest course, its stand 7 m apart and nearly all
// wooded, came to 340,000 where Classic Parkland has 160,000).
// (The second measurement: 300 real models past the line were still 1.3
// million triangles a frame on Ultra, 3%, and the whole of what the branch
// drew over 0.9.14. So none by default: pictures from the line. The band and
// the cap stay for whoever wants them back.)
export const SURROUND_TREES = {near: 110, reach: 5000, fall: 3200, keep: .9, nearMax: 0, most: 200000};
// The share of the far forest's country left open (ground.js FAR_OPEN is the same number).
export const FAR_OPEN = .36;
// A far tree is drawn this much larger where the sites are `rel` times as far
// apart as at the line: the square root, never more than double.
export const farGrowth = rel => Math.min(2, Math.sqrt(rel));
// Past this a plant under 3 m is a pixel or less: the ground's paint carries it.
const SMALL_REACH = 700;

// HOW WOODED THE COUNTRY IS at a point, 0..1, before the ground has its say:
// the far forest's share in broad patches, a scrub's in clumps.
// The patches are the ground shader's own (ground.js, THE FOREST ON THE FAR
// HILLS: a value noise on 380 m cells), so the trees stand where the forest
// floor is painted and nowhere else.
// (In whole numbers, as ground.js `coverHash` is: a hash through sin() gives
// the card and the page different numbers a few cells from the middle.)
export const coverHash = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 65535) / 65536; };
const glslHash = coverHash;
function broad(x, z, cell = 380) {
 const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
 let fx = x / cell - cx, fz = z / cell - cz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
 const n00 = glslHash(cx, cz), n10 = glslHash(cx + 1, cz), n01 = glslHash(cx, cz + 1), n11 = glslHash(cx + 1, cz + 1);
 const a = n00 + (n10 - n00) * fx, b = n01 + (n11 - n01) * fx;
 return a + (b - a) * fz;
}
// `own`: the course's own choice of cover (a built course's `surround.cover`),
// over the landscape's.
// A cover of nothing is no trees at all: the patches' soft edge would leave
// a few on the highest of the noise, so it is asked as less than nothing --
// here and of the ground's paint (ground.js farForestUniforms), alike.
export const noneAt = cover => cover <= 0 ? -1 : cover;
export function coverField(bio, seed, own) {
 const f = bio.farForest;
 if (!f) return null;
 const sClump = saltOf(seed, 'surround-clump'), cover = noneAt(own ?? f.cover ?? 0), open = f.scrub ? 0 : f.open ?? FAR_OPEN;
 return (x, z) => {
  let c = smooth(1 - cover - .12, 1 - cover + .12, broad(x, z));
  // Open country among the woods (ground.js FAR_OPEN: the same 900 m noise).
  if (open > 0) c *= smooth(open - .06, open + .06, broad(x + 31.7 * 900, z + 31.7 * 900, 900));
  if (f.scrub) c *= .25 + .75 * smooth(.42, .6, fbm(x / 140, z / 140, sClump, 2));
  return c;
 };
}

const CACHE = new WeakMap();
// {near: [tree records], far: [{x, z, y, h, r, kind, pick, grow}]}
export function surroundTrees(w, options = {}) {
 const o = {...SURROUND_TREES, ...options}, key = [o.near, o.reach, o.fall, o.keep, o.nearMax, o.most, o.detail?.grow ?? '', w.surround ? JSON.stringify(w.surround) : ''].join('|');
 let by = CACHE.get(w); if (!by) CACHE.set(w, by = new Map());
 if (by.has(key)) return by.get(key);
 const out = {near: [], far: []};
 by.set(key, out);
 const bio = biomeOf(w.settings.biome), stands = w.settings.range ? null : standsOf(bio, w.seed), cover = coverField(w.bio ?? bio, w.seed, w.surround?.cover);
 if (!cover || !w.groundGrid) return out;
 const f = bio.farForest, line = f.line ?? 1e5;
 const mix = (stands?.plants ?? bio.plants).filter(([k]) => f.scrub || !GROUND_PLANTS.has(k));
 if (!mix.length) return out;
 const scales = Object.fromEntries(bio.plants.map(([k, , s]) => [k, s ?? 1]));
 const sizeOf = w.treeSize ?? ((kind, a, b) => TREE_SIZE[kind] ? {h: TREE_SIZE[kind][0] + a * (TREE_SIZE[kind][1] - TREE_SIZE[kind][0]), r: TREE_SIZE[kind][2] + b * (TREE_SIZE[kind][3] - TREE_SIZE[kind][2])}
  : GROUND_PLANTS.has(kind) ? {h: .8 + a * 2.1, r: 1 + b * 1.3} : {h: tallHeight(bio, kind, a, scales[kind] ?? 1), r: 3 + b * 4});
 const g = w.groundGrid, gx = g.halfX, gz = g.halfZ, px = w.halfX, pz = w.halfZ, at = drawnGround(w, o.detail);
 // Never closer than 12 m, whatever the stand's own spacing: a Northern Woods
 // stand is 7 m apart, which past the line came to 354,000 sites and 0.76 s
 // of the wait, for crowns that hide one another from the course anyway.
 const s0 = Math.max(12, stands?.spacing ?? 12), grow = stands?.grow ?? 1.2, level = w.waterLevel ?? 0, sea = !!(w.bio?.sea ?? bio.sea);
 const salt = saltOf(w.seed, 'surround-site');
 // The spacing wanted `d` metres past the line, in stand spacings.
 const rel = d => 1 + Math.max(0, d - o.near) / o.fall;
 // BANDS, each with a grid of its own: twice as coarse each time the wanted
 // spacing doubles, so the walk visits about as many cells as it keeps.
 for (let band = 0, d0 = 0; d0 < o.reach; band++) {
  const cell = s0 * 2 ** band, d1 = band === 0 ? o.near + o.fall : Math.min(o.reach, o.near + o.fall * (2 ** (band + 1) - 1));
  const ex = px + d1, ez = pz + d1, nx = Math.ceil(2 * ex / cell), nz = Math.ceil(2 * ez / cell), bsalt = salt + band * 104729;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
   const u = k => hash(i, j, bsalt + k * 7919);
   const x = -ex + (i + .1 + .8 * u(0)) * cell, z = -ez + (j + .1 + .8 * u(1)) * cell, d = boxOut(x, z, px, pz);
   if (d <= 1 || d < d0 || d >= d1) continue;
   // Thinned to the spacing wanted here (this band's cells are `2 ** band` spacings).
   const want = rel(d), share = o.keep * (2 ** band / want) ** 2;
   if (u(6) >= share) continue;
   if (u(7) >= cover(x, z)) continue;
   const inside = Math.abs(x) < gx && Math.abs(z) < gz, y = inside ? w.height(x, z) : at(x, z);
   if (y < level + (sea ? .8 : .5)) continue;
   if (y > line - 60 && u(8) > (line + 20 - y) / 80) continue;                 // thinning up to the treeline
   if (inside) { const lie = w.surface(x, z); if (lie === 'water' || !allows(lie, 'trees')) continue; }
   const e = Math.max(3, cell * .3), hAt = inside ? w.height : at;
   // (From the site's own height and two more: asking four cost a third of
   // the placing, and a cliff reads as steep either way.)
   const slope = Math.hypot(hAt(x + e, z) - y, hAt(x, z + e) - y) / e;
   // A cliff. Far off the drawn faces are steeper than the land they stand
   // for, and a picture stands upright whatever is under it: woods hold on to
   // 52 degrees there, as the painted forest did.
   if (slope > (d < o.near ? .85 : 1.3)) continue;
   const kind = choose(mix, u(2)), small = GROUND_PLANTS.has(kind), size = sizeOf(kind, u(3), u(4)), k = small ? 1 : grow, h = size.h * k, r = size.r * k;
   if (d < o.near && inside) { out.near.push({x, z, y, h, r, shade: u(5), kind, surround: true, d}); continue; }
   if (h < 3 && d > SMALL_REACH) continue;
   out.far.push({x, z, y, h, r, kind, pick: u(5), grow: farGrowth(want), d});
  }
  d0 = d1;
 }
 // Only the nearest `nearMax` of the band as real models; the others as pictures.
 if (out.near.length > o.nearMax) {
  out.near.sort((a, b) => a.d - b.d);
  for (const t of out.near.splice(o.nearMax)) out.far.push({x: t.x, z: t.z, y: t.y, h: t.h, r: t.r, kind: t.kind, pick: t.shade, grow: 1, d: t.d});
 }
 // Never more than `most`: thinned evenly, by each site's own number.
 if (out.far.length > o.most) { const share = o.most / out.far.length; out.far = out.far.filter(s => (s.pick * 977 % 1) < share); }
 return out;
}
