// GROWING A REDWOOD GROVE FROM NOTHING.
//
// Run:    node tools/grow.mjs [--report] [name...]
// Writes: vendor/grown-redwood-forest/*.obj + .mtl
//
// Not one imported vertex and not one texture. Every shape here is triangles
// assembled by tools/grow-lib.mjs, and every proportion and colour comes from
// measurements of 315 reference photographs of coast redwood forest, recorded
// in RESEARCH.md.
//
// The findings that decided the shapes:
//
//   A REDWOOD IS A PLUME, NOT A CROWN. In a full-height photograph the foliage
//   is a narrow vertical band hugging the upper trunk, with sprouts and burls
//   breaking out lower down. Every earlier attempt built a cone on a pole.
//
//   A DOUGLAS FIR IS THE OPPOSITE: dense, conical, in clear whorled tiers,
//   foliage from a quarter of the way up. Measured over the photographs, green
//   INCREASES toward the bottom of a fir picture (profile 3333444455566654)
//   and DECREASES in a redwood one (3333333333322222). That one difference is
//   most of what makes two conifers read as two species.
//
//   THE FLOOR IS BRIGHTER THAN THE CANOPY. Understory foliage measures #739753
//   against the canopy's #323b23, and moss on a nurse log is brighter still.
//   A grove that is uniformly dark green is missing its best contrast.
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Build, rng, tube, bolePath, spray, sprayFan, frond, blade, blob, toObj, toMtl, norm, cross, add, mul} from './grow-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor', 'grown-redwood-forest');
const args = process.argv.slice(2);
const report = args.includes('--report');
const only = args.filter(a => !a.startsWith('--')).map(a => a.toLowerCase());

// --------------------------------------------------------------- the palette
//
// Measured, not chosen. Each is the dominant cluster of its subject across the
// reference set, nudged to the lit side because the sim shades its own models.
const PALETTE = {
 // Darker and greyer than the first pass, which rendered frankly pink. The
 // measured bark cluster is #7c624c on a SUNLIT trunk; under a canopy it is
 // #2d251c to #4c4034, and a grove is a shaded place.
 Bark: '#6a5343',          // coast redwood: warm grey-brown
 Bark_Fir: '#574e43',      // douglas fir: darker, greyer, deeply furrowed
 Bark_Cedar: '#664d3d',    // western red cedar: red-brown, stringy
 Bark_Broadleaf: '#5a554a',// tanoak and madrone, usually mossy
 Deadwood: '#8d887e',      // a standing snag bleaches almost silver
 Deadwood_Rot: '#5c5142',  // a fallen log that is going back to soil
 Leaves: '#3b4b2a',        // canopy foliage: measured #323b23 to #5f6d44
 Leaves_Fir: '#3a5138',    // fir reads bluer than redwood
 Leaves_Under: '#54703a',  // understory: measured #4a6940 to #739753
 Leaves_Sapling: '#688a42',// new growth, brighter still
 Leaves_Broad: '#4c6636',
 Moss: '#7fa843',          // the brightest thing on the floor
 Moss_Dark: '#5f8236',
 Rock: '#67695f',
 Duff_dirt: '#443628',
};

// ----------------------------------------------------------------- detail
//
// One catalogue, two levels. A grove is fourteen hundred trees and only the
// three dozen nearest the camera are worth eleven thousand vertices each --
// drawn at full detail throughout, this set costs 25 M vertices against the
// 3.7 M the whole course costs today.
//
// The far model is the SAME TREE: same seed, same proportions, same silhouette
// envelope, with the counts thinned and the tube sides dropped. That matters
// more than it sounds, because a level of detail that changes shape pops when
// it swaps, and one that only changes density does not.
const LOD = {near: 1, far: .34};
// Set by the baker just before it calls a species function. A parameter
// would be tidier and would mean rewriting twenty-six call sites; this is a
// single-threaded build script and the assignment is three lines above the
// call that reads it.
let DETAIL = 1;
const detailed = (o, d) => {
 if (d >= 1) return o;
 const few = (v, min) => Math.max(min, Math.round((v || 0) * d));
 // KEEP THE SILHOUETTE. Thinning the whorls and the fan arms also takes
 // width off the crown -- a giant measured 19% as wide as tall at full
 // detail and 9% thinned, and a level of detail that changes shape POPS
 // when it swaps. So the limb reaches further and the sprays are drawn
 // fatter, which is the oldest trick there is for making fewer of
 // something cover the same ground.
 const spread = 1 + (1 - d) * 1.35;
 return {...o,
  reach: o.reach ? o.reach * spread : undefined,
  sprayWidth: (o.sprayWidth ?? .12) * spread,
  whorls: few(o.whorls ?? 16, 5),
  sprays: few(o.sprays ?? 3, 1),
  arms: Math.max(1, Math.round((o.arms ?? 3) * d)),
  leaflets: Math.max(2, Math.round((o.leaflets ?? 4) * d)),
  sides: few(o.sides ?? 0, 5) || undefined,
  flutes: Math.max(3, Math.round((o.flutes ?? 6) * d)),
  segments: few(o.segments ?? 22, 6),
  sprouts: 0, burl: false,
  fronds: few(o.fronds ?? 0, 3) || undefined,
  pairs: few(o.pairs ?? 0, 4) || undefined,
  stems: few(o.stems ?? 0, 3) || undefined,
  leaves: few(o.leaves ?? 0, 3) || undefined,
  plants: few(o.plants ?? 0, 6) || undefined,
  caps: few(o.caps ?? 0, 3) || undefined,
  mossCaps: few(o.mossCaps ?? 0, 2) || undefined,
  stubs: few(o.stubs ?? 0, 2) || undefined,
  roots: few(o.roots ?? 0, 3) || undefined,
  detail: d,
 };
};

// ------------------------------------------------------------- coast redwood
//
// A fluted column with a buttressed foot, bare for most of its height, wearing
// a narrow plume of flat sprays near the top.
function redwood(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const H = 1;
 const from = o.from ?? .58;           // where the plume starts
 const baseR = o.baseR ?? .026;
 const bark = o.bark || 'Bark';

 const path = bolePath(H, baseR, baseR * (o.topTaper ?? .22), o.segments ?? 22, {
  flare: o.flare ?? 1.45, flareTo: .05, taperPower: .8,
  lean: o.lean ?? (r() - .5) * .02, sway: o.sway ?? .004, phase: r() * 6, rng: r,
 });
 // THREE SIDES PER FLUTE, or the corrugation has nowhere to happen: at ten
 // sides and seven flutes the ridges alias into a smooth cylinder. The ridges
 // are what says "redwood" at any distance you can see the trunk at all.
 const flutes = o.flutes ?? 7;
 tube(b, bark, path, {sides: o.sides ?? flutes * 3, flutes, fluteDepth: o.fluteDepth ?? .2, closeTop: true});

 const at = t => {
  const i = Math.min(path.length - 1, Math.max(0, Math.round(t * (path.length - 1))));
  return path[i];
 };

 // The plume. Whorls of short limbs, each carrying a few sprays, on a radius
 // that is widest a third of the way up the plume and closes at the top.
 // NOT IN TIERS. A fir's limbs come in clean whorls and a redwood's do not --
 // in the photographs the plume is ragged, with gaps where limbs have been
 // shed and clusters where they have not. Laying them out on an even ladder
 // made the first pass read as a fir with a long trunk, so both the height and
 // the reach of every limb are jittered hard, and one in six is dropped.
 const whorls = o.whorls ?? 16;
 for (let w = 0; w < whorls; w++) {
  const t = from + (1 - from) * ((w + .5) / whorls) + (r() - .5) * (1 - from) / whorls * 1.4;
  const u = Math.max(0, Math.min(1, (t - from) / (1 - from)));
  // A floor under the envelope: sin() alone takes the reach to zero at the
  // leader and leaves the top of the tree a bare spike, which no photograph
  // shows -- a redwood carries foliage right to its tip.
  const reach = (o.reach ?? .085) * (.3 + .7 * Math.sin(Math.PI * Math.pow(u, .55))) * (.45 + r() * 1.1);
  const node = at(t);
  const limbs = o.limbs ?? 4;
  for (let i = 0; i < limbs; i++) {
   if (r() < (o.shed ?? .08)) continue;
   const a = (w * 2.399 + i * (Math.PI * 2 / limbs) + (r() - .5) * .7) % (Math.PI * 2);
   const dir = norm([Math.cos(a), (o.limbRise ?? -.12) + (r() - .5) * .25, Math.sin(a)]);
   const root = [node.p[0] + Math.cos(a) * node.r * .8, node.p[1], node.p[2] + Math.sin(a) * node.r * .8];
   const limbReach = reach * (.7 + r() * .6);
   const tip = add(root, mul(dir, limbReach));
   tube(b, bark, [{p: root, r: node.r * .18}, {p: tip, r: node.r * .06}], {sides: 4, closeBottom: false});
   // Two or three sprays per limb, hanging off the outer half.
   const sprays = o.sprays ?? 3;
   for (let s = 0; s < sprays; s++) {
    const f = .12 + .88 * (s / Math.max(1, sprays - 1));
    const at2 = add(root, mul(dir, limbReach * f));
    const twist = a + (r() - .5) * 1.1;
    const sd = norm([Math.cos(twist), -.16 - r() * .22, Math.sin(twist)]);
    sprayFan(b, 'Leaves', at2, sd, [0, 1, 0], limbReach * (.5 + r() * .4), limbReach * .065,
     {leaflets: o.leaflets ?? 4, droop: .35 + r() * .25, arms: o.arms ?? 3,
      subLeaflets: Math.max(2, Math.round(3 * (o.detail ?? 1)))});
   }
  }
 }

 // Epicormic sprouts: leafy tufts straight out of the bare bole, and the
 // occasional burl. Both are all over the photographs and neither exists in
 // any pack model.
 const sprouts = o.sprouts ?? 5;
 for (let i = 0; i < sprouts; i++) {
  const t = .18 + r() * (from - .24);
  const node = at(t), a = r() * 6.283;
  const root = [node.p[0] + Math.cos(a) * node.r * .9, node.p[1], node.p[2] + Math.sin(a) * node.r * .9];
  const size = (o.reach ?? .085) * (.28 + r() * .4);
  for (let s = 0; s < 3; s++) {
   const sd = norm([Math.cos(a + (s - 1) * .5), .1 + r() * .3, Math.sin(a + (s - 1) * .5)]);
   sprayFan(b, 'Leaves', root, sd, [0, 1, 0], size, size * .13, {leaflets: 3, droop: .3, arms: 2, subLeaflets: 2});
  }
 }
 if (o.burl ?? r() < .5) {
  const t = .22 + r() * .4, node = at(t), a = r() * 6.283;
  blob(b, bark, [node.p[0] + Math.cos(a) * node.r * .5, node.p[1], node.p[2] + Math.sin(a) * node.r * .5],
   node.r * (1.5 + r()), {bands: 4, sides: 7, squash: .8, rough: .3, rng: r});
 }
 return b.normalise();
}

// --------------------------------------------------------------- douglas fir
//
// Whorled tiers, dense, conical, and branched far lower than a redwood.
function conifer(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const from = o.from ?? .22, baseR = o.baseR ?? .018;
 const bark = o.bark || 'Bark_Fir', leaf = o.leaf || 'Leaves_Fir';
 const path = bolePath(1, baseR, baseR * .12, 18, {
  flare: o.flare ?? 1.2, taperPower: .55, lean: (r() - .5) * .02, sway: .005, phase: r() * 6, rng: r,
 });
 const flutes = o.flutes ?? 5;
 tube(b, bark, path, {sides: o.sides ?? flutes * 3, flutes, fluteDepth: .16, closeTop: true});
 const at = t => path[Math.min(path.length - 1, Math.max(0, Math.round(t * (path.length - 1))))];

 // `shedTop` stops the crown short of the leader, which is what a fir with a
 // broken or dead top looks like -- common in old stands and in every one of
 // the aerial photographs.
 const whorls = o.whorls ?? 16, top = o.shedTop ? .82 : 1;
 for (let w = 0; w < whorls; w++) {
  const t = from + (top - from) * ((w + .4) / whorls);
  const u = (t - from) / (top - from);
  // A cone: widest at the bottom of the crown, closing to a spire.
  const reach = (o.reach ?? .17) * Math.pow(1 - u, o.conePower ?? .85) * (.8 + r() * .4);
  const node = at(t);
  const limbs = o.limbs ?? 5;
  for (let i = 0; i < limbs; i++) {
   const a = (w * 1.7 + i * (Math.PI * 2 / limbs)) % (Math.PI * 2);
   const dir = norm([Math.cos(a), o.droopRise ?? -.28, Math.sin(a)]);
   const root = [node.p[0] + Math.cos(a) * node.r * .8, node.p[1], node.p[2] + Math.sin(a) * node.r * .8];
   tube(b, bark, [{p: root, r: node.r * .2}, {p: add(root, mul(dir, reach)), r: node.r * .05}],
    {sides: 4, closeBottom: false});
   for (let s = 0; s < (o.sprays ?? 3); s++) {
    const f = .25 + .75 * (s / Math.max(1, (o.sprays ?? 3) - 1));
    const twist = a + (r() - .5) * .9;
    sprayFan(b, leaf, add(root, mul(dir, reach * f)), norm([Math.cos(twist), -.3 - r() * .3, Math.sin(twist)]),
     [0, 1, 0], reach * (.5 + r() * .45), reach * (o.sprayWidth ?? .12),
     {leaflets: o.leaflets ?? 4, droop: o.droop ?? .5, arms: o.arms ?? 3,
      subLeaflets: Math.max(2, Math.round(3 * (o.detail ?? 1)))});
   }
  }
 }
 return b.normalise();
}

// ------------------------------------------------- western red cedar / hemlock
//
// Cedar: a fluted, buttressed trunk carrying heavy drooping sprays almost to
// the ground. Hemlock: the same habit with a finer, nodding leader.
const cedar = (seed, o = {}) => conifer(seed, {
 from: .12, baseR: .022, bark: 'Bark_Cedar', leaf: 'Leaves', flare: 1.35, flutes: 9,
 whorls: 18, limbs: 6, reach: .105, conePower: .6, droopRise: -.45, droop: .62,
 sprayWidth: .22, sprays: 3, ...o,
});
const hemlock = (seed, o = {}) => conifer(seed, {
 from: .18, baseR: .015, bark: 'Bark_Fir', leaf: 'Leaves_Fir', flare: 1.15, flutes: 4,
 whorls: 17, limbs: 5, reach: .095, conePower: .7, droopRise: -.5, droop: .7,
 sprayWidth: .17, ...o,
});

// ------------------------------------------------------------- the broadleaf
//
// Tanoak, madrone, vine maple: the understorey trees you actually walk past.
// Forking trunk, round leaf masses, and usually mossy in this climate.
function broadleaf(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const from = o.from ?? .3, baseR = o.baseR ?? .03;
 const bark = o.bark || 'Bark_Broadleaf', leaf = o.leaf || 'Leaves_Broad';
 const trunkTo = o.trunkTo ?? .55;
 const path = bolePath(trunkTo, baseR, baseR * .5, 8,
  {flare: 1.3, taperPower: .6, lean: (r() - .5) * .08, sway: .012, phase: r() * 6, rng: r});
 tube(b, bark, path, {sides: 7, flutes: 3, fluteDepth: .08});
 const top = path[path.length - 1];

 const limbs = o.limbs ?? 4;
 for (let i = 0; i < limbs; i++) {
  const a = i * (6.283 / limbs) + r() * .6;
  const up = (1 - trunkTo) * (.55 + r() * .5);
  const out = (o.spread ?? .3) * (.6 + r() * .7);
  const mid = [top.p[0] + Math.cos(a) * out * .45, top.p[1] + up * .5, top.p[2] + Math.sin(a) * out * .45];
  const tip = [top.p[0] + Math.cos(a) * out, top.p[1] + up, top.p[2] + Math.sin(a) * out];
  tube(b, bark, [{p: top.p, r: top.r * .8}, {p: mid, r: top.r * .5}, {p: tip, r: top.r * .2}],
   {sides: 5, closeBottom: false});
  // Leaf mass: a scatter of blades around the branch end.
  for (let k = 0; k < (o.leaves ?? 14); k++) {
   const la = r() * 6.283, lp = .45 + r() * .6;
   const at2 = [top.p[0] + Math.cos(a) * out * lp + (r() - .5) * out * .35,
    top.p[1] + up * lp + (r() - .5) * up * .3,
    top.p[2] + Math.sin(a) * out * lp + (r() - .5) * out * .35];
   blade(b, leaf, at2, norm([Math.cos(la), -.2 - r() * .5, Math.sin(la)]), [0, 1, 0],
    out * (.3 + r() * .3), o.leafWidth ?? .22, {steps: 3, curl: .3});
  }
 }
 if (o.moss ?? true) for (let i = 0; i < 5; i++) {
  const t = r() * .5, a = r() * 6.283, node = path[Math.floor(t * (path.length - 1))];
  blob(b, 'Moss', [node.p[0] + Math.cos(a) * node.r * .8, node.p[1], node.p[2] + Math.sin(a) * node.r * .8],
   node.r * (.5 + r() * .5), {bands: 3, sides: 6, squash: .5, rough: .35, rng: r});
 }
 return b.normalise();
}

// --------------------------------------------------------------------- dead
//
// A standing snag: bleached almost silver, broken off, stub branches only.
function snag(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const baseR = o.baseR ?? .028;
 const path = bolePath(1, baseR, baseR * (o.topTaper ?? .5), 14,
  {flare: o.flare ?? 1.5, taperPower: .7, lean: (r() - .5) * .04, sway: .008, phase: r() * 6, rng: r});
 // A broken top is jagged, so the cap is left open and a torn rim drawn on.
 tube(b, 'Deadwood', path, {sides: o.sides ?? 9, flutes: 6, fluteDepth: .2, closeTop: false});
 const top = path[path.length - 1];
 for (let s = 0; s < (o.sides ?? 9); s++) {
  const a1 = s / (o.sides ?? 9) * 6.283, a2 = (s + 1) / (o.sides ?? 9) * 6.283;
  const h1 = top.r * (r() * 2.6), h2 = top.r * (r() * 2.6);
  const p1 = b.vert('Deadwood', top.p[0] + Math.cos(a1) * top.r, top.p[1], top.p[2] + Math.sin(a1) * top.r, Math.cos(a1), 0, Math.sin(a1));
  const p2 = b.vert('Deadwood', top.p[0] + Math.cos(a2) * top.r, top.p[1], top.p[2] + Math.sin(a2) * top.r, Math.cos(a2), 0, Math.sin(a2));
  const q1 = b.vert('Deadwood', top.p[0] + Math.cos(a1) * top.r * .5, top.p[1] + h1, top.p[2] + Math.sin(a1) * top.r * .5, Math.cos(a1), .3, Math.sin(a1));
  const q2 = b.vert('Deadwood', top.p[0] + Math.cos(a2) * top.r * .5, top.p[1] + h2, top.p[2] + Math.sin(a2) * top.r * .5, Math.cos(a2), .3, Math.sin(a2));
  b.quad('Deadwood', p1, p2, q2, q1);
 }
 for (let i = 0; i < (o.stubs ?? 9); i++) {
  const t = .25 + r() * .7;
  const node = path[Math.floor(t * (path.length - 1))], a = r() * 6.283;
  const root = [node.p[0] + Math.cos(a) * node.r * .8, node.p[1], node.p[2] + Math.sin(a) * node.r * .8];
  const len = node.r * ((o.stubLen ?? 4) * (.5 + r() * 1.2));
  tube(b, 'Deadwood', [{p: root, r: node.r * .22}, {p: add(root, [Math.cos(a) * len, -len * (.1 + r() * .5), Math.sin(a) * len]), r: node.r * .04}],
   {sides: 4, closeBottom: false, closeTop: true});
 }
 return b.normalise();
}

// A cut or broken stump, wide and mossy, often with a springboard notch.
function stump(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const H = o.H ?? 1, baseR = o.baseR ?? .42;
 const path = bolePath(H, baseR, baseR * (o.topTaper ?? .78), 7,
  {flare: 1.5, flareTo: .22, taperPower: .8, rng: r});
 tube(b, o.wood || 'Deadwood_Rot', path, {sides: 11, flutes: 8, fluteDepth: .16, closeTop: true});
 // Root buttresses running out from the foot.
 for (let i = 0; i < (o.roots ?? 6); i++) {
  const a = i * (6.283 / (o.roots ?? 6)) + r() * .5;
  const len = baseR * (1 + r() * 1.3);
  tube(b, o.wood || 'Deadwood_Rot',
   [{p: [Math.cos(a) * baseR * .7, H * .12, Math.sin(a) * baseR * .7], r: baseR * .3},
    {p: [Math.cos(a) * len, H * .015, Math.sin(a) * len], r: baseR * .1}],
   {sides: 5, closeTop: true});
 }
 if (o.moss ?? true) {
  const caps = o.mossCaps ?? 7;
  for (let i = 0; i < caps; i++) {
   const a = r() * 6.283, rr = r() * baseR * .8;
   blob(b, 'Moss', [Math.cos(a) * rr, H * (.97 + r() * .04), Math.sin(a) * rr],
    baseR * (.2 + r() * .3), {bands: 3, sides: 7, squash: .35, rough: .3, rng: r, half: true});
  }
 }
 // A sapling or a fern on top is how half the stumps in the photographs look.
 if (o.perch) for (let i = 0; i < 7; i++) {
  const a = r() * 6.283;
  frond(b, 'Leaves_Under', [Math.cos(a) * baseR * .3, H, Math.sin(a) * baseR * .3],
   norm([Math.cos(a), 1.3, Math.sin(a)]), [0, 1, 0], baseR * (1 + r() * .7), {pairs: 8, arch: .55, width: .13});
 }
 return b.normalise();
}

// A fallen log: horizontal, tapered, mossed along the top, broken at both ends.
function log(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const L = 1, R0 = o.R ?? .07;
 const bend = o.bend ?? .05, segs = 9;
 const path = [];
 for (let i = 0; i <= segs; i++) {
  const t = i / segs;
  path.push({p: [t * L - L / 2, R0 * (o.sink ?? .8) + Math.sin(t * Math.PI) * bend * .4, Math.sin(t * 3.1 + (o.phase || 0)) * bend],
   r: R0 * (1 - t * (o.taper ?? .45)) * (1 + (r() - .5) * .08)});
 }
 tube(b, o.wood || 'Deadwood_Rot', path, {sides: 9, flutes: 7, fluteDepth: .13, closeTop: true});
 // Moss only on the upper flanks, which is where it is in every photograph.
 if (o.moss ?? true) {
  const caps = o.mossCaps ?? 16;
  for (let i = 0; i < caps; i++) {
   const t = .04 + (i / caps) * .92 + (r() - .5) * .04;
   const node = path[Math.min(segs, Math.floor(t * segs))];
   const a = (r() - .5) * 1.5;   // near the top only
   blob(b, 'Moss', [node.p[0] + (r() - .5) * .02, node.p[1] + node.r * Math.cos(a) * .85, node.p[2] + node.r * Math.sin(a) * .85],
    node.r * (.45 + r() * .4), {bands: 3, sides: 6, squash: .45, rough: .35, rng: r});
  }
 }
 // Broken stubs and a torn root end.
 for (let i = 0; i < (o.stubs ?? 4); i++) {
  const t = .15 + r() * .7, node = path[Math.floor(t * segs)], a = r() * 6.283;
  const len = node.r * (1.5 + r() * 3);
  tube(b, o.wood || 'Deadwood_Rot',
   [{p: node.p, r: node.r * .22}, {p: add(node.p, [0, Math.abs(Math.cos(a)) * len * .6, Math.sin(a) * len]), r: node.r * .05}],
   {sides: 4, closeBottom: false, closeTop: true});
 }
 if (o.ferns) for (let i = 0; i < 6; i++) {
  const t = .2 + r() * .6, node = path[Math.floor(t * segs)];
  const a = r() * 6.283;
  frond(b, 'Leaves_Under', [node.p[0], node.p[1] + node.r * .8, node.p[2]],
   norm([Math.cos(a), 1.1, Math.sin(a)]), [0, 1, 0], node.r * (2.6 + r() * 1.6), {pairs: 8, arch: .6, width: .13});
 }
 return b.normalise();
}

// A root wad: what a windthrown tree leaves standing on end.
function rootwad(seed) {
 const b = new Build(), r = rng(seed);
 blob(b, 'Deadwood_Rot', [0, .42, 0], .45, {bands: 4, sides: 10, squash: .82, rough: .3, rng: r});
 for (let i = 0; i < 16; i++) {
  const a = r() * 6.283, tilt = (r() - .5) * 1.2, len = .2 + r() * .45;
  const dir = norm([Math.cos(a) * .6, Math.sin(tilt) + .35, Math.sin(a) * .6]);
  tube(b, 'Deadwood_Rot', [{p: [Math.cos(a) * .3, .4, Math.sin(a) * .3], r: .035 + r() * .03},
   {p: add([Math.cos(a) * .3, .4, Math.sin(a) * .3], mul(dir, len)), r: .008}], {sides: 4, closeTop: true});
 }
 for (let i = 0; i < 8; i++) {
  const a = r() * 6.283, rr = r() * .35;
  blob(b, 'Duff_dirt', [Math.cos(a) * rr, .2 + r() * .5, Math.sin(a) * rr], .09 + r() * .07,
   {bands: 3, sides: 6, squash: .8, rough: .4, rng: r});
 }
 return b.normalise();
}

// --------------------------------------------------------------- understorey
//
// A sword fern is a shuttlecock: eight to twenty once-pinnate fronds radiating
// from one crown and arching over. This is the plant you see most of.
function swordFern(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const n = o.fronds ?? 13;
 for (let i = 0; i < n; i++) {
  const a = i * 2.3999 + r() * .3;
  const rise = (o.rise ?? 1.5) * (.75 + r() * .5);
  frond(b, o.leaf || 'Leaves_Under', [Math.cos(a) * .02, .015, Math.sin(a) * .02],
   norm([Math.cos(a), rise, Math.sin(a)]), [0, 1, 0], (o.length ?? .8) * (.7 + r() * .55),
   {pairs: o.pairs ?? 11, arch: (o.arch ?? .55) + r() * .2, width: o.width ?? .13});
 }
 // A few dead fronds lying flat, brown, which every clump has.
 for (let i = 0; i < (o.dead ?? 2); i++) {
  const a = r() * 6.283;
  frond(b, 'Deadwood_Rot', [0, .01, 0], norm([Math.cos(a), .25, Math.sin(a)]), [0, 1, 0],
   (o.length ?? .8) * (.6 + r() * .3), {pairs: 8, arch: .3, width: .11});
 }
 return b.normalise();
}

// Salal and evergreen huckleberry: low, woody, round leathery leaves.
function shrub(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const stems = o.stems ?? 6;
 for (let i = 0; i < stems; i++) {
  const a = i * 2.3999 + r() * .4, len = (o.height ?? .75) * (.6 + r() * .6);
  const lean = (o.lean ?? .35);
  const tip = [Math.cos(a) * len * lean, len, Math.sin(a) * len * lean];
  tube(b, 'Bark_Broadleaf', [{p: [0, 0, 0], r: .012}, {p: mul(tip, .5), r: .009}, {p: tip, r: .005}],
   {sides: 4, closeTop: true});
  for (let k = 0; k < (o.leaves ?? 7); k++) {
   const f = .25 + .75 * (k / (o.leaves ?? 7));
   const la = a + (r() - .5) * 2.4;
   blade(b, o.leaf || 'Leaves_Under', mul(tip, f), norm([Math.cos(la), .35 - r() * .8, Math.sin(la)]),
    [0, 1, 0], len * (o.leafLen ?? .3), o.leafWidth ?? .34, {steps: 3, curl: .18});
  }
 }
 return b.normalise();
}

// Redwood sorrel: a low mat of clover-like trefoils, the brightest green on
// the floor and the thing that covers it between the ferns.
function sorrel(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const n = o.plants ?? 22;
 for (let i = 0; i < n; i++) {
  const a = i * 2.3999, rr = Math.sqrt((i + .5) / n) * (o.spread ?? .48);
  const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
  const h = (o.height ?? .22) * (.6 + r() * .7);
  tube(b, 'Leaves_Sapling', [{p: [x, 0, z], r: .006}, {p: [x, h, z], r: .004}], {sides: 3});
  for (let k = 0; k < 3; k++) {
   const la = r() * 6.283 + k * 2.094;
   blade(b, o.leaf || 'Leaves_Sapling', [x, h, z], norm([Math.cos(la), -.35, Math.sin(la)]), [0, 1, 0],
    h * .85, .55, {steps: 2, curl: .1});
  }
 }
 return b.normalise();
}

// A conifer seedling: the bright, bushy, knee-high things scattered everywhere.
function seedling(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 const path = bolePath(1, .02, .004, 7, {flare: 1.1, taperPower: .5, rng: r});
 tube(b, 'Bark_Fir', path, {sides: 5, closeTop: true});
 for (let w = 0; w < (o.whorls ?? 7); w++) {
  const t = .1 + .9 * (w / (o.whorls ?? 7));
  const node = path[Math.floor(t * (path.length - 1))];
  const reach = (o.reach ?? .34) * Math.pow(1 - t, .7) * (.8 + r() * .5);
  for (let i = 0; i < 5; i++) {
   const a = w * 1.7 + i * 1.2566;
   spray(b, o.leaf || 'Leaves_Sapling', [node.p[0], node.p[1], node.p[2]],
    norm([Math.cos(a), -.15, Math.sin(a)]), [0, 1, 0], reach, reach * .22, {leaflets: 5, droop: .35});
  }
 }
 return b.normalise();
}

// A moss mound over a buried root or rock: the floor is never flat.
function mossMound(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 blob(b, o.core || 'Rock', [0, 0, 0], .5, {bands: 4, sides: 9, squash: o.squash ?? .45, rough: .28, rng: r, half: true});
 for (let i = 0; i < (o.caps ?? 12); i++) {
  const a = r() * 6.283, rr = Math.sqrt(r()) * .42;
  blob(b, 'Moss', [Math.cos(a) * rr, (o.squash ?? .45) * .5 * Math.cos(rr * 2.2) * .9, Math.sin(a) * rr],
   .1 + r() * .1, {bands: 3, sides: 6, squash: .5, rough: .4, rng: r, half: true});
 }
 return b.normalise();
}

// A mossy boulder. Rock is rare on a redwood floor but not absent.
function boulder(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 blob(b, 'Rock', [0, 0, 0], .5, {bands: 5, sides: 9, squash: o.squash ?? .62, rough: .3, rng: r, half: true});
 for (let i = 0; i < (o.moss ?? 8); i++) {
  const a = r() * 6.283, rr = Math.sqrt(r()) * .4;
  blob(b, 'Moss', [Math.cos(a) * rr, (o.squash ?? .62) * .48, Math.sin(a) * rr], .09 + r() * .09,
   {bands: 3, sides: 6, squash: .45, rough: .4, rng: r, half: true});
 }
 return b.normalise();
}

// Litter: fallen sprays, twigs and a cone or two. Cheap, and it is what makes
// the ground read as a forest floor rather than a lawn with things on it.
function litter(seed, o = {}) {
 o = detailed(o, DETAIL);
 const b = new Build(), r = rng(seed);
 for (let i = 0; i < (o.twigs ?? 9); i++) {
  const a = r() * 6.283, rr = r() * .45, len = .12 + r() * .3;
  const at2 = [Math.cos(a) * rr, .008 + r() * .01, Math.sin(a) * rr];
  const d = r() * 6.283;
  tube(b, 'Deadwood_Rot', [{p: at2, r: .008 + r() * .006},
   {p: add(at2, [Math.cos(d) * len, (r() - .5) * .01, Math.sin(d) * len]), r: .003}], {sides: 3, closeTop: true});
 }
 for (let i = 0; i < (o.fronds ?? 4); i++) {
  const a = r() * 6.283, rr = r() * .4;
  frond(b, 'Deadwood_Rot', [Math.cos(a) * rr, .012, Math.sin(a) * rr],
   norm([Math.cos(a + 1), .1, Math.sin(a + 1)]), [0, 1, 0], .22 + r() * .22,
   {pairs: 7, arch: .1, width: .1});
 }
 for (let i = 0; i < (o.sprays ?? 5); i++) {
  const a = r() * 6.283, rr = r() * .42;
  spray(b, 'Deadwood_Rot', [Math.cos(a) * rr, .012, Math.sin(a) * rr],
   norm([Math.cos(a * 2), .05, Math.sin(a * 2)]), [0, 1, 0], .13 + r() * .12, .022, {leaflets: 5, droop: .05});
 }
 return b.normalise();
}

// --------------------------------------------------------------- the catalogue
const CATALOGUE = [];
// `far` marks the expensive models that also get a thinned twin. The cheap
// ground clutter does not need one: a 400-vertex sorrel patch is already
// cheaper than the far version of a tree.
const add2 = (name, fn, far) => CATALOGUE.push({name, fn, far});

// Giants: the trees the biome is named for. Bole 55-85%, plume, burls.
for (let i = 0; i < 8; i++) add2(`Redwood_Giant_${i + 1}`, () => redwood(1100 + i * 37, {
 // `reach` is the LIMB length; the sprays hanging off it reach about two and a
 // half times further, so a nominal .072 measured out at 36% as wide as tall.
 // The references put a 115 m redwood's crown at 15 to 20 m across -- 16% --
 // so the limb is shorter than instinct says.
 from: .52 + i * .035, baseR: .028 - i * .0008, whorls: 16 + (i % 4), limbs: 4,
 reach: .036 - i * .0009, flutes: 7 + (i % 3), sprouts: 4 + (i % 4), burl: i % 3 !== 1,
}), true);
// Mature: shorter boles, fuller plumes.
for (let i = 0; i < 8; i++) add2(`Redwood_Mature_${i + 1}`, () => redwood(2200 + i * 53, {
 from: .42 + i * .02, baseR: .024, whorls: 14, limbs: 4 + (i % 2), reach: .048,
 flutes: 6 + (i % 4), sprouts: 3, burl: i % 2 === 0,
}), true);
// Young: conical, branched low, slim.
for (let i = 0; i < 6; i++) add2(`Redwood_Young_${i + 1}`, () => redwood(3300 + i * 71, {
 from: .2 + i * .03, baseR: .013, topTaper: .3, whorls: 15, limbs: 5, reach: .07,
 limbRise: -.05, flutes: 5, sprouts: 1, burl: false, flare: 1.15,
}), true);
for (let i = 0; i < 4; i++) add2(`Redwood_Sapling_${i + 1}`, () => redwood(4400 + i * 91, {
 from: .1, baseR: .012, topTaper: .25, whorls: 12, limbs: 5, reach: .105, limbRise: 0,
 flutes: 4, sprouts: 0, burl: false, flare: 1.05, sprays: 2,
}));
for (let i = 0; i < 2; i++) add2(`Redwood_Leaner_${i + 1}`, () => redwood(5500 + i * 17, {
 from: .5, baseR: .026, lean: (i ? -1 : 1) * .1, sway: .02, whorls: 12, reach: .05, burl: true,
}));
for (let i = 0; i < 2; i++) add2(`Redwood_Burled_${i + 1}`, () => redwood(5600 + i * 23, {
 from: .62, baseR: .032, whorls: 11, reach: .042, sprouts: 8, burl: true, flare: 1.7,
}));

// Twelve identical cones is not twelve trees. Old firs self-prune their lower
// limbs, young ones do not; some are broad and some are spires; and the ones
// on an edge lean. The spread here is deliberate.
const FIR_SHAPES = [
 // Same correction as the redwoods: the sprays reach far past the limb, so a
 // nominal reach of .19 measured 63% as wide as tall against a real fir's 30%.
 {from: .16, reach: .095, conePower: .62, whorls: 18, limbs: 6},  // young, broad, to the ground
 {from: .20, reach: .085, conePower: .72, whorls: 17, limbs: 5},
 {from: .26, reach: .080, conePower: .80, whorls: 16, limbs: 5},
 {from: .34, reach: .075, conePower: .88, whorls: 15, limbs: 5},  // self-pruned
 {from: .42, reach: .065, conePower: .95, whorls: 14, limbs: 4},  // old, high crown
 {from: .30, reach: .105, conePower: .60, whorls: 19, limbs: 6},  // open grown, heavy
];
for (let i = 0; i < 12; i++) add2(`DouglasFir_${i + 1}`, () => conifer(6600 + i * 41, {
 ...FIR_SHAPES[i % FIR_SHAPES.length],
 baseR: .016 + (i % 4) * .002,
 droopRise: -.22 - (i % 5) * .05,
 sprays: 3 + (i % 2),
 shedTop: i % 4 === 3,
}), true);
for (let i = 0; i < 8; i++) add2(`Hemlock_${i + 1}`, () => hemlock(7700 + i * 59, {
 from: .14 + (i % 4) * .04, reach: .09 + (i % 3) * .008, whorls: 16 + (i % 3),
}), true);
for (let i = 0; i < 8; i++) add2(`RedCedar_${i + 1}`, () => cedar(8800 + i * 67, {
 from: .1 + (i % 4) * .03, baseR: .021 + (i % 3) * .002, reach: .10 + (i % 4) * .008,
}), true);

for (let i = 0; i < 6; i++) add2(`Tanoak_${i + 1}`, () => broadleaf(9900 + i * 31, {
 trunkTo: .45 + (i % 3) * .06, spread: .3 + (i % 4) * .04, limbs: 4 + (i % 3), leaves: 13 + i,
}), true);
for (let i = 0; i < 4; i++) add2(`VineMaple_${i + 1}`, () => broadleaf(10500 + i * 43, {
 trunkTo: .3, baseR: .02, spread: .42, limbs: 5, leaves: 16, leafWidth: .3,
 leaf: 'Leaves_Under', lean: .12,
}));

// A SNAG IS A DEAD GIANT, not a pole. These were drawn at a redwood's live
// proportions and read as ship's masts; a broken-off redwood is short for its
// girth, which is most of why it looks like a monument.
for (let i = 0; i < 7; i++) add2(`Snag_${i + 1}`, () => snag(11100 + i * 29, {
 baseR: .055 + (i % 4) * .012, topTaper: .55 + (i % 3) * .12,
 stubs: 7 + (i % 6), stubLen: 5 + (i % 4), flare: 1.5 + (i % 3) * .14, sides: 13,
}));
for (let i = 0; i < 6; i++) add2(`Stump_${i + 1}`, () => stump(12200 + i * 47, {
 baseR: .36 + (i % 4) * .05, topTaper: .7 + (i % 3) * .08, roots: 5 + (i % 4),
 mossCaps: 5 + (i % 5), perch: i % 3 === 0,
}));
for (let i = 0; i < 3; i++) add2(`Stump_Bare_${i + 1}`, () => stump(12800 + i * 13, {
 baseR: .4, moss: false, roots: 6, topTaper: .85,
}));
for (let i = 0; i < 8; i++) add2(`NurseLog_${i + 1}`, () => log(13300 + i * 37, {
 R: .06 + (i % 4) * .012, taper: .35 + (i % 3) * .1, bend: .04 + (i % 4) * .02,
 phase: i, mossCaps: 14 + (i % 6) * 2, stubs: 3 + (i % 4), ferns: i % 2 === 0,
}));
for (let i = 0; i < 4; i++) add2(`FallenLog_${i + 1}`, () => log(14400 + i * 53, {
 R: .07 + (i % 3) * .015, moss: false, stubs: 5, bend: .03, phase: i * 2, taper: .5,
}));
for (let i = 0; i < 2; i++) add2(`RootWad_${i + 1}`, () => rootwad(15500 + i * 61));

// A sword fern stands UP and then arches over; the first pass splayed flat
// like a starfish, because a rise of 1.2 against a horizontal component of 1
// leaves the frond at fifty degrees before the arch pulls it down further.
// The photographs show them leaving the crown near-vertical.
for (let i = 0; i < 12; i++) add2(`SwordFern_${i + 1}`, () => swordFern(16600 + i * 23, {
 fronds: 10 + (i % 8), length: .78 + (i % 5) * .05, arch: .34 + (i % 4) * .06,
 pairs: 15 + (i % 5), dead: i % 3, rise: 2.1 + (i % 4) * .4, width: .105,
}));
for (let i = 0; i < 4; i++) add2(`SwordFern_Young_${i + 1}`, () => swordFern(17200 + i * 19, {
 fronds: 6 + i, length: .62, arch: .26, pairs: 13, dead: 0, rise: 3.2, width: .095,
}));
// Salal is a THICKET, not a few sprigs: in the photographs it is a continuous
// mass of overlapping leathery leaves with the stems barely visible. Six
// leaves on five stems read as a houseplant.
for (let i = 0; i < 6; i++) add2(`Salal_${i + 1}`, () => shrub(17700 + i * 29, {
 stems: 9 + (i % 5), height: .7 + (i % 3) * .1, leaves: 14 + (i % 5), leafWidth: .42,
 leafLen: .34, lean: .3 + (i % 3) * .07,
}));
for (let i = 0; i < 4; i++) add2(`Huckleberry_${i + 1}`, () => shrub(18300 + i * 31, {
 stems: 12 + i * 2, height: .8, leaves: 16, leafLen: .2, leafWidth: .3,
 leaf: 'Leaves_Broad', lean: .5,
}));
for (let i = 0; i < 6; i++) add2(`Sorrel_${i + 1}`, () => sorrel(18900 + i * 37, {
 plants: 16 + i * 4, spread: .42 + (i % 3) * .06, height: .2 + (i % 4) * .03,
}));
for (let i = 0; i < 6; i++) add2(`Seedling_${i + 1}`, () => seedling(19500 + i * 41, {
 whorls: 6 + (i % 4), reach: .3 + (i % 4) * .04,
}));
for (let i = 0; i < 6; i++) add2(`MossMound_${i + 1}`, () => mossMound(20100 + i * 43, {
 squash: .35 + (i % 4) * .08, caps: 9 + (i % 6) * 2,
}));
for (let i = 0; i < 5; i++) add2(`Boulder_${i + 1}`, () => boulder(20700 + i * 47, {
 squash: .5 + (i % 4) * .1, moss: 4 + (i % 6) * 2,
}));
for (let i = 0; i < 6; i++) add2(`Litter_${i + 1}`, () => litter(21300 + i * 53, {
 twigs: 7 + (i % 5) * 2, fronds: 2 + (i % 4), sprays: 3 + (i % 5),
}));

// -------------------------------------------------------------------- baking
mkdirSync(OUT, {recursive: true});
let total = 0, made = 0;
for (const {name, fn, far} of CATALOGUE) {
 if (only.length && !only.some(f => name.toLowerCase().includes(f))) continue;
 for (const [suffix, d] of far ? [['', LOD.near], ['_Far', LOD.far]] : [['', LOD.near]]) {
  DETAIL = d;
  const build = fn();
  const full = name + suffix;
  writeFileSync(join(OUT, full + '.obj'), toObj(full, build, PALETTE));
  writeFileSync(join(OUT, full + '.mtl'), toMtl(build, PALETTE));
  const {r} = build.bounds();
  total += build.verts(); made++;
  console.log(`${full.padEnd(22)} ${String(build.verts()).padStart(6)} verts  ${String(Math.round(r * 200)).padStart(3)}% as wide as tall`
   + `  ${[...build.parts.keys()].filter(k => build.parts.get(k).index.length).join(' ')}`);
 }
}
console.log(`\n${total.toLocaleString()} vertices over ${made} models  (mean ${Math.round(total / made)})`);
console.log(OUT);
console.log('now: node tools/asset-preview.mjs && npx vite build --config vite.assets.config.js');
void report; void cross;
