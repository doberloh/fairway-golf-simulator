// COMPOSING TREES OUT OF THE PACKS WE ALREADY OWN.
//
// Run: node tools/bake-assets.mjs [--report] [name...]
// Writes: vendor/baked_assets/*.obj + .mtl + the leaf sheets they name
//
// No generator and no new dependency: every triangle here comes out of a pack
// already in vendor/ under CC0. What is new is the ARRANGEMENT, and that is
// where the redwood research lives -- a bare bole to roughly two thirds of the
// height, a crown a sixth as wide as the tree is tall, a trunk about a
// thirty-eighth as thick as it is tall, and a swollen foot, none of which any
// pack model has on its own.
//
// Three operations do all the work:
//
//   STRETCH THE BOLE. A pack conifer branches a third of the way up. Scaling
//   the whole model taller just makes a taller version of the same tree, so
//   instead only the part below the first branch is stretched and everything
//   above it rides up. A normal tree becomes a redwood bole with its own
//   branch structure still on top.
//
//   FLARE THE FOOT. Every published redwood diameter is quoted "above the
//   swollen base". The bottom few percent is pushed outward.
//
//   DRESS IT. Crowns are borrowed leaf geometry, placed either as one mass
//   capping the bole or as sprays through the crown volume.
import {readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync} from 'node:fs';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractObj, extract} from './mesh-read.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor');
const OUT = join(VENDOR, 'baked_assets');
const args = process.argv.slice(2);
const report = args.includes('--report');
const only = args.filter(a => !a.startsWith('--')).map(a => a.toLowerCase());

// ------------------------------------------------------------ reading parts
const PACKS = readdirSync(VENDOR).filter(p => p !== 'baked_assets');
const cache = new Map();

// `hint:Model`, where the hint is any part of a pack's directory name.
function sourcePart(ref, role) {
 const key = ref + '/' + role;
 if (cache.has(key)) return cache.get(key);
 const colon = ref.indexOf(':');
 const hint = ref.slice(0, colon), name = ref.slice(colon + 1);
 const pack = PACKS.find(p => p.includes(hint));
 if (!pack) throw Error(`no pack matching "${hint}"`);
 const file = join(VENDOR, pack, name + '.obj');
 const byRole = existsSync(file) ? extractObj(file, true) : extract(join(VENDOR, pack, name + '.glb'));
 const part = byRole.get(role);
 if (!part) throw Error(`${ref} has no ${role}`);

 // Normalised the way the ingest normalises everything: centred on x/z,
 // sitting on y=0, one unit tall.
 let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
 for (let i = 0; i < part.position.length; i += 3) {
  minX = Math.min(minX, part.position[i]); maxX = Math.max(maxX, part.position[i]);
  minY = Math.min(minY, part.position[i + 1]); maxY = Math.max(maxY, part.position[i + 1]);
  minZ = Math.min(minZ, part.position[i + 2]); maxZ = Math.max(maxZ, part.position[i + 2]);
 }
 const height = Math.max(maxY - minY, 1e-6), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
 const position = new Float64Array(part.position.length);
 for (let i = 0; i < part.position.length; i += 3) {
  position[i] = (part.position[i] - cx) / height;
  position[i + 1] = (part.position[i + 1] - minY) / height;
  position[i + 2] = (part.position[i + 2] - cz) / height;
 }
 const out = {position, normal: Float64Array.from(part.normal), uv: Float64Array.from(part.uv),
  index: Int32Array.from(part.index), texture: part.texture, colour: part.colour,
  radius: Math.max(maxX - minX, maxZ - minZ) / 2 / height};
 cache.set(key, out);
 return out;
}

// The widest radius in each of twenty bands, and the height at which the model
// stops being a bare pole. Used both to decide where to stretch and to report.
function bands(position, n = 20) {
 const out = new Array(n).fill(0);
 for (let i = 0; i < position.length; i += 3) {
  const k = Math.min(n - 1, Math.max(0, Math.floor(position[i + 1] * n)));
  out[k] = Math.max(out[k], Math.hypot(position[i], position[i + 2]));
 }
 return out;
}
function branchesAt(position, threshold = .06) {
 const b = bands(position);
 for (let k = 0; k < b.length; k++) if (b[k] > threshold) return k / b.length;
 return 1;
}

// ---------------------------------------------------------- the operations
//
// Stretch everything below `at` so that the bare bole ends up `want` of the
// finished height, and carry everything above it upward unchanged.
function stretchBole(position, at, want) {
 if (at <= 0 || at >= 1 || want <= at) return 1;
 // want = (at * k) / (at * k + 1 - at)  =>  solve for k
 const k = (want * (1 - at)) / (at * (1 - want));
 const added = at * (k - 1);
 for (let i = 1; i < position.length; i += 3)
  position[i] = position[i] < at ? position[i] * k : position[i] + added;
 const total = 1 + added;
 for (let i = 1; i < position.length; i += 3) position[i] /= total;   // back to unit height
 return total;
}

// Slim or thicken the whole model on x/z so the bole sits at a stated radius.
function setGirth(position, want) {
 const b = bands(position);
 const have = Math.max(b[1], b[2], 1e-6);   // just above the foot, below any branching
 const k = want / have;
 for (let i = 0; i < position.length; i += 3) { position[i] *= k; position[i + 2] *= k; }
 return k;
}

const FLARE_TO = .07;
function flareFoot(position, flare) {
 if (!flare || flare <= 1) return;
 for (let i = 0; i < position.length; i += 3) {
  const up = position[i + 1] / FLARE_TO;
  if (up >= 1) continue;
  const k = 1 + (flare - 1) * (1 - up) * (1 - up);
  position[i] *= k; position[i + 2] *= k;
 }
}

// ------------------------------------------------------------- the dressing
const seeded = seed => {
 let x = (seed * 1103515245 + 12345) >>> 0;
 return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
};

// One crown sitting on the bole.
const capPlaces = r => [{x: 0, y: r.from, z: 0, width: r.wide * 2, height: 1 - r.from}];

// Sprays through the crown volume, on a golden-angle spiral so they spread
// without clumping, inside an envelope that is widest just above the crown
// base and closes at the top -- the conical crown the sources describe.
function sprayPlaces(r, rng) {
 const out = [], n = r.count;
 for (let i = 0; i < n; i++) {
  const u = (i + .5) / n;                       // 0 at the crown base, 1 at the tip
  const envelope = r.wide * Math.pow(1 - u, .55) * (u < .12 ? u / .12 : 1);
  const a = i * 2.3999632, reach = envelope * (.35 + .65 * ((i * 7 % 11) / 10));
  const size = (1 - r.from) * r.spray * (.75 + rng() * .5);
  out.push({x: Math.cos(a) * reach, y: r.from + u * (1 - r.from) - size * .35, z: Math.sin(a) * reach,
   width: size * (r.sprayWide || 1.3), height: size,
   tilt: (rng() - .5) * .5, roll: (rng() - .5) * .5});
 }
 return out;
}

// ------------------------------------------------------------- the recipes
//
// bark colours as you would pick them; MTL Kd is linear, so they convert.
const srgbToLinear = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
const linear = hex => [1, 3, 5].map(i => +srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));

const REDWOOD = '#7a4a33', YOUNG = '#8a5439', FIR = '#55483c', CEDAR = '#7d5440';
const MAPLE = '#6b6653', SNAG = '#8e8478';

// trunk, bole, girth, flare, bark, and how it is dressed.
const R = (name, trunk, o) => ({name, trunk, bole: .64, girth: .026, flare: 1.42, bark: REDWOOD,
 from: .60, wide: .085, ...o});

const RECIPES = [
 // ---- mature coast redwoods: long bare bole, narrow crown high up ---------
 R('Redwood_A', 'ultimate-stylized:DeadTree_1', {crown: 'ultimate-stylized:PineTree_4', dress: 'cap'}),
 R('Redwood_B', 'ultimate-stylized:DeadTree_2', {crown: 'ultimate-stylized:PineTree_2', dress: 'cap', wide: .095}),
 R('Redwood_C', 'ultimate-stylized:DeadTree_4', {crown: 'ultimate-stylized:PineTree_4', dress: 'spray', count: 26, spray: .30}),
 R('Redwood_D', 'ultimate-stylized:DeadTree_6', {crown: 'ultimate-stylized:PineTree_2', dress: 'spray', count: 22, spray: .34}),
 R('Redwood_E', 'ultimate-stylized:DeadTree_10', {crown: 'stylized-nature-megakit:Bush_Common', dress: 'spray', count: 30, spray: .26}),
 R('Redwood_F', 'ultimate-nature:CommonTree_Dead_3', {crown: 'ultimate-stylized:PineTree_4', dress: 'spray', count: 24, spray: .28}),
 // Older still: bole to three quarters, a thinner crown, thicker in the bole.
 R('Redwood_Old_A', 'ultimate-stylized:DeadTree_9', {bole: .74, girth: .030, from: .72, wide: .075,
  crown: 'ultimate-stylized:PineTree_4', dress: 'cap'}),
 R('Redwood_Old_B', 'ultimate-stylized:DeadTree_8', {bole: .72, girth: .032, from: .70, wide: .080,
  crown: 'ultimate-stylized:PineTree_2', dress: 'spray', count: 18, spray: .36}),

 // ---- young redwoods: half the girth, branched most of the way down ------
 R('RedwoodYoung_A', 'ultimate-stylized:BirchTree_4', {bole: .30, girth: .014, flare: 1.12, bark: YOUNG,
  from: .26, wide: .13, crown: 'ultimate-stylized:PineTree_4', dress: 'spray', count: 26, spray: .26}),
 R('RedwoodYoung_B', 'ultimate-stylized:BirchTree_2', {bole: .26, girth: .013, flare: 1.10, bark: YOUNG,
  from: .22, wide: .14, crown: 'ultimate-stylized:PineTree_2', dress: 'spray', count: 30, spray: .24}),
 R('RedwoodYoung_C', 'ultimate-stylized:DeadTree_9', {bole: .34, girth: .016, flare: 1.14, bark: YOUNG,
  from: .30, wide: .12, crown: 'ultimate-stylized:PineTree_4', dress: 'cap'}),

 // ---- douglas fir: narrower, spikier, branched lower, drooping -----------
 R('DouglasFir_A', 'ultimate-stylized:DeadTree_1', {bole: .34, girth: .019, flare: 1.18, bark: FIR,
  from: .30, wide: .12, crown: 'ultimate-stylized:PineTree_2', dress: 'spray', count: 34, spray: .22}),
 R('DouglasFir_B', 'ultimate-stylized:DeadTree_4', {bole: .30, girth: .018, flare: 1.16, bark: FIR,
  from: .26, wide: .13, crown: 'ultimate-stylized:PineTree_4', dress: 'spray', count: 40, spray: .20}),
 R('DouglasFir_C', 'ultimate-nature:CommonTree_Dead_1', {bole: .36, girth: .020, flare: 1.18, bark: FIR,
  from: .32, wide: .115, crown: 'ultimate-stylized:PineTree_2', dress: 'cap'}),

 // ---- western red cedar: the mid-storey, branched nearly to the ground ---
 R('RedCedar_A', 'ultimate-stylized:DeadTree_2', {bole: .18, girth: .022, flare: 1.25, bark: CEDAR,
  from: .14, wide: .17, crown: 'ultimate-stylized:PineTree_4', dress: 'spray', count: 42, spray: .20}),
 R('RedCedar_B', 'ultimate-stylized:DeadTree_6', {bole: .16, girth: .024, flare: 1.25, bark: CEDAR,
  from: .12, wide: .19, crown: 'stylized-nature-megakit:Bush_Common', dress: 'spray', count: 38, spray: .22}),

 // ---- the understorey broadleaves, which are what you walk past ----------
 // MapleTree_Leaves is an AUTUMN sheet -- its foliage averages #452c28, a warm
 // brown. Wrong for a coast redwood grove, which is green year round, so the
 // green-leaved NormalTree sheet dresses the maple and the autumn one keeps a
 // variant of its own for whoever wants it.
 R('BigleafMaple_A', 'ultimate-stylized:DeadTree_4', {bole: .30, girth: .035, flare: 1.30, bark: MAPLE,
  from: .26, wide: .34, crown: 'ultimate-stylized:NormalTree_5', dress: 'spray', count: 14, spray: .48,
  sprayWide: 1.6}),
 R('BigleafMaple_Autumn_A', 'ultimate-stylized:DeadTree_4', {bole: .30, girth: .035, flare: 1.30, bark: MAPLE,
  from: .26, wide: .34, crown: 'ultimate-stylized:MapleTree_1', dress: 'spray', count: 14, spray: .48,
  sprayWide: 1.6}),
 R('Tanoak_A', 'ultimate-stylized:DeadTree_10', {bole: .26, girth: .030, flare: 1.28, bark: MAPLE,
  from: .22, wide: .30, crown: 'stylized-nature-megakit:CommonTree_4', dress: 'spray', count: 12, spray: .52,
  sprayWide: 1.5}),
 R('Vine_Maple_A', 'ultimate-stylized:BirchTree_2', {bole: .20, girth: .022, flare: 1.18, bark: MAPLE,
  from: .16, wide: .40, crown: 'ultimate-stylized:Bush_Large', dress: 'spray', count: 18, spray: .38,
  sprayWide: 1.7}),

 // ---- and the dead, which every old-growth grove is full of --------------
 R('RedwoodSnag_A', 'ultimate-stylized:DeadTree_8', {bole: .70, girth: .030, flare: 1.50, bark: SNAG,
  crown: null}),
 R('RedwoodSnag_B', 'ultimate-nature:CommonTree_Dead_5', {bole: .62, girth: .026, flare: 1.45, bark: SNAG,
  crown: null}),
];

// ------------------------------------------------------------------ baking
mkdirSync(OUT, {recursive: true});

function compose(recipe) {
 const trunk = sourcePart(recipe.trunk, 'bark');
 const position = Float64Array.from(trunk.position);
 const at = branchesAt(position);
 stretchBole(position, at, recipe.bole);
 setGirth(position, recipe.girth);
 flareFoot(position, recipe.flare);

 const groups = [{role: 'bark', position, normal: trunk.normal, uv: null,
  index: trunk.index, colour: linear(recipe.bark), texture: null}];

 let crowns = 0;
 if (recipe.crown) {
  const src = sourcePart(recipe.crown, 'leaf');
  const rng = seeded(recipe.name.split('').reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7));
  const places = recipe.dress === 'cap' ? capPlaces(recipe) : sprayPlaces(recipe, rng);
  crowns = places.length;
  const verts = src.position.length / 3;
  const cp = new Float64Array(verts * 3 * places.length);
  const cn = new Float64Array(verts * 3 * places.length);
  const cu = new Float64Array(verts * 2 * places.length);
  const ci = new Int32Array(src.index.length * places.length);
  places.forEach((p, k) => {
   // Scaled to the stated width and height, then turned about y so repeated
   // copies of one crown do not read as repeated copies of one crown.
   const yaw = rng() * 6.283, cs = Math.cos(yaw), sn = Math.sin(yaw);
   const sx = p.width / Math.max(src.radius * 2, 1e-6), sy = p.height;
   for (let i = 0; i < verts; i++) {
    const x = src.position[i * 3] * sx, y = src.position[i * 3 + 1] * sy, z = src.position[i * 3 + 2] * sx;
    const at3 = (k * verts + i) * 3;
    cp[at3] = x * cs - z * sn + p.x;
    cp[at3 + 1] = y + p.y;
    cp[at3 + 2] = x * sn + z * cs + p.z;
    const nx = src.normal[i * 3], ny = src.normal[i * 3 + 1], nz = src.normal[i * 3 + 2];
    cn[at3] = nx * cs - nz * sn; cn[at3 + 1] = ny; cn[at3 + 2] = nx * sn + nz * cs;
    cu[(k * verts + i) * 2] = src.uv[i * 2];
    cu[(k * verts + i) * 2 + 1] = src.uv[i * 2 + 1];
   }
   for (let i = 0; i < src.index.length; i++) ci[k * src.index.length + i] = src.index[i] + k * verts;
  });
  groups.push({role: 'leaf', position: cp, normal: cn, uv: cu, index: ci,
   colour: null, texture: src.texture});
 }

 // Back to unit height with the crown included, so the finished model obeys
 // the same contract every other model in vendor/ does.
 let lo = Infinity, hi = -Infinity;
 for (const g of groups) for (let i = 1; i < g.position.length; i += 3) {
  lo = Math.min(lo, g.position[i]); hi = Math.max(hi, g.position[i]);
 }
 const span = Math.max(hi - lo, 1e-6);
 for (const g of groups) for (let i = 0; i < g.position.length; i += 3) {
  g.position[i] /= span;
  g.position[i + 1] = (g.position[i + 1] - lo) / span;
  g.position[i + 2] /= span;
 }
 return {groups, crowns, stretchedFrom: at};
}

function toObj(name, groups) {
 const lines = [`# ${name} -- composed by tools/bake-assets.mjs from the CC0 packs in vendor/.`,
  '# Geometry is theirs; the arrangement is ours. Do not edit by hand.',
  `mtllib ${name}.mtl`, `o ${name}`];
 const body = [];
 let vBase = 1, vtBase = 1, vnBase = 1;
 for (const g of groups) {
  const verts = g.position.length / 3;
  for (let i = 0; i < verts; i++)
   lines.push(`v ${g.position[i * 3].toFixed(5)} ${g.position[i * 3 + 1].toFixed(5)} ${g.position[i * 3 + 2].toFixed(5)}`);
  if (g.uv) for (let i = 0; i < verts; i++)
   lines.push(`vt ${g.uv[i * 2].toFixed(5)} ${g.uv[i * 2 + 1].toFixed(5)}`);
  for (let i = 0; i < verts; i++)
   lines.push(`vn ${g.normal[i * 3].toFixed(4)} ${g.normal[i * 3 + 1].toFixed(4)} ${g.normal[i * 3 + 2].toFixed(4)}`);
  body.push(`usemtl ${g.role === 'leaf' ? 'Tree_Leaves' : 'Tree_Bark'}`);
  for (let i = 0; i < g.index.length; i += 3) {
   const f = [0, 1, 2].map(k => {
    const at = g.index[i + k];
    return `${vBase + at}/${g.uv ? vtBase + at : ''}/${vnBase + at}`;
   });
   body.push(`f ${f[0]} ${f[1]} ${f[2]}`);
  }
  vBase += verts;
  if (g.uv) vtBase += verts;
  vnBase += verts;
 }
 return lines.concat(body).join('\n') + '\n';
}

let total = 0, made = 0;
for (const recipe of RECIPES) {
 if (only.length && !only.some(f => recipe.name.toLowerCase().includes(f))) continue;
 const {groups, crowns, stretchedFrom} = compose(recipe);
 const leaf = groups.find(g => g.role === 'leaf');
 let sheet = null;
 if (leaf && leaf.texture) {
  sheet = basename(leaf.texture);
  if (!existsSync(join(OUT, sheet))) copyFileSync(leaf.texture, join(OUT, sheet));
 }
 writeFileSync(join(OUT, recipe.name + '.mtl'),
  `# Composed by tools/bake-assets.mjs. The game paints every surface from the\n`
  + `# biome palette by the material's NAME; these are for anything reading the\n`
  + `# model directly, the asset previewer included.\n`
  + `newmtl Tree_Bark\nKd ${linear(recipe.bark).map(v => v.toFixed(3)).join(' ')}\n`
  + (sheet ? `\nnewmtl Tree_Leaves\nKd 1.000 1.000 1.000\nmap_Kd ${sheet}\n` : ''));
 const obj = toObj(recipe.name, groups);
 writeFileSync(join(OUT, recipe.name + '.obj'), obj);

 const verts = groups.reduce((s, g) => s + g.position.length / 3, 0);
 total += verts; made++;
 const b = bands(groups.find(g => g.role === 'leaf')?.position || groups[0].position);
 const crownFrom = b.findIndex(v => v > Math.max(...b) * .15) / b.length;
 console.log(`${recipe.name.padEnd(17)} ${String(verts).padStart(6)} verts  ${(obj.length / 1024).toFixed(0).padStart(4)} KB`
  + `  bole ${String(Math.round(recipe.bole * 100)).padStart(2)}%  foliage from ${String(Math.round(crownFrom * 100)).padStart(2)}%`
  + `  ${String(Math.round(Math.max(...b) * 200)).padStart(3)}% as wide as tall`
  + (crowns ? `  ${crowns} crown${crowns > 1 ? 's' : ''}` : '  bare'));
 if (report) console.log('                  stretched from ' + Math.round(stretchedFrom * 100) + '%   '
  + bands(groups[0].position).map(v => Math.round(v / Math.max(...bands(groups[0].position)) * 15).toString(16).toUpperCase()).join(''));
}
console.log(`\n${total.toLocaleString()} vertices over ${made} models`);
console.log(OUT);
console.log('now: npm run assets   (to look at them)');
