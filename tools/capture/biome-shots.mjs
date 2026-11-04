#!/usr/bin/env node
// THE LANDSCAPE PICTURES ON THE CARDS (the 1.0 polish, 27 October 2026;
// docs/UI_POLISH.md, *Landscape pictures*). Play's game and landscape cards
// and the course selectors show real pictures of each landscape, one after
// another (src/picture-loop.js); this takes them from the game and makes the
// files the game carries (src/shots/<biome>-<n>.webp, read by src/landscape-shots.js).
//
//   node tools/capture/build-hooked.mjs               the capture build
//   node tools/capture/biome-shots.mjs take [biome ...] [--views a,b] [--label r1]
//       every candidate view of each landscape, at Ultra, 3840 x 2160 (a 1920 x
//       1080 page at density 2, HUD hidden), as PNG masters in
//       bench/shots/biome-shots/<label>/<biome>/<view>.png, and a contact sheet
//   node tools/capture/biome-shots.mjs encode [--from <label>] [--only biome,...]
//       the PICKS below, from the masters, as WebP at WIDTH into src/shots/,
//       and the total the page grows by
//
// THE PICKS are chosen by eye, in rounds (UI_POLISH.md has each round): a view
// earns its place by showing what that landscape is -- its ground from above,
// a dramatic shot down a hole, a green, its light at the end of the day.
// Change a pick, then `encode`; the game picks the files up at the next build.
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, hourFor, HIDE_HUD, hideBallAndAim} from './capture.mjs';
import {BIOMES} from '../../src/biomes.js';

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(n); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const mode = argv.shift();
// `--season s`: the course in that season (seasons.js; summer, the cards', by default).
const label = opt('--label', 'latest'), only = opt('--views')?.split(','), from = opt('--from', 'latest'), season = opt('--season', 'summer');
// `encode --only a,b`: re-encode those landscapes' pictures alone, leaving the
// others' files as they are (the US landscapes goal: new landscapes added
// one phase at a time, from their own set of masters).
const onlyBiomes = opt('--only')?.split(',');
const ROOT = path.join('bench', 'shots', 'biome-shots');

// What the cards are drawn at: about 380 px wide at 1280 x 720, so about 1140
// at 4K; WIDTH x 9/16 covers it with the picture cropped to the card. PLACED,
// with QUALITY, to fit the budget: 3 MB added to the page for every picture
// (the goal), checked by `encode`.
export const WIDTH = 960, QUALITY = .7, BUDGET = 3 * 1024 * 1024;

// The seed each landscape is taken on: one whose holes show it well (chosen
// in the rounds; a seed's course is the same on every copy of this version).
const SEEDS = {puget: 'CASCADE', sonoran: 'MESA', rockies: 'SUMMIT', links: 'DUNE', heartland: 'PRAIRIE', keys: 'LAGOON', redwood: 'GROVE', newengland: 'MAPLE', lakedunes: 'BEACON',
 // Phase 3 of the US landscapes goal (first seeds, not yet chosen in rounds).
 highplains: 'BIGSKY', sandhills: 'BLOWOUT', oldnortheast: 'ELMWALK', pinebarrens: 'PITCHPINE', alaska: 'FIREWEED',
 longleaf: 'PINESTRAW', piedmont: 'REDCLAY', lowcountry: 'MARSH', bayou: 'CYPRESS', flatwoods: 'PALMETTO',
 hillcountry: 'CEDARBREAK', bluebonnet: 'PAINTBRUSH', gulfcoast: 'SHELLROAD', mojave: 'JOSHUA', palms: 'OASIS', chihuahuan: 'SOTOL',
 monterey: 'SEASTACK', socal: 'BARRANCA', winecountry: 'OLDVINE', cascades: 'SNOWCONE', sierra: 'GRANITE', ponderosa: 'CINDER',
 sagebrush: 'RIMROCK', redrock: 'HOODOO', crosstimbers: 'POSTOAK',
 blueridge: 'BLUEHAZE', ozarks: 'SHORTLEAF', bluegrass: 'FOURBOARD',
 northwoods: 'LOONLAKE', oregondunes: 'SHOREPINE', hawaii: 'MONKEYPOD',
 badlands: 'SAWTOOTH'};

// The candidate views: a lab.camera pose, or the source of a function of the
// world run in the page (tools/capture/overhaul.mjs, the same form).
const VIEWS = [
 {name: 'overview', hole: 0, when: 'afternoon', cam: `w => ({x: -w.halfX * .2, z: -w.halfZ * 1.05, yaw: 15, height: 240, pitch: -26})`},
 {name: 'overview-golden', hole: 0, when: 'golden', cam: `w => ({x: -w.halfX * .2, z: -w.halfZ * 1.05, yaw: 15, height: 240, pitch: -26})`},
 {name: 'h1-tee', hole: 0, when: 'morning', cam: {hole: 0, along: 0, height: 1.8, look: 'pin', pitch: -2.5}},
 {name: 'h1-behind', hole: 0, when: 'afternoon', cam: {hole: 0, fromPin: 80, around: 170, height: 30, pitch: -17}},
 {name: 'h2-side', hole: 1, when: 'afternoon', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 {name: 'h2-green', hole: 1, when: 'noon', cam: {hole: 1, fromPin: 24, around: 25, height: 2.4, pitch: -7}},
 {name: 'h3-high', hole: 2, when: 'afternoon', cam: {hole: 2, fromPin: 160, around: 95, height: 55, pitch: -18}},
 {name: 'h4-tee-golden', hole: 3, when: 'golden', cam: {hole: 3, along: -6, height: 3, look: 'pin', pitch: -4}},
 {name: 'h5-approach', hole: 4, when: 'afternoon', cam: {hole: 4, fromPin: 120, around: 8, height: 12, pitch: -6}},
 // Under the canopy (round 2, for Giant Redwood, whose crowns are over 100 m
 // up: the views from 30-55 m stood inside them).
 {name: 'h1-low', hole: 0, when: 'afternoon', cam: {hole: 0, fromPin: 70, around: 175, height: 4, pitch: -3}},
 {name: 'h2-low', hole: 1, when: 'afternoon', cam: {hole: 1, fromPin: 90, around: 150, height: 3, pitch: -1}},
 {name: 'h3-low', hole: 2, when: 'morning', cam: {hole: 2, fromPin: 110, around: 10, height: 2.5, pitch: -1}},
 {name: 'far-high', hole: 0, when: 'afternoon', cam: `w => ({x: -w.halfX * .3, z: -w.halfZ * .6, yaw: 200, height: 160, pitch: -9})`},
 // The streets kit (3 November 2026): above the parking lot, looking along
 // the drive to the clubhouse -- the road surfaces, the lot and the barn.
 {name: 'lot', hole: 0, when: 'afternoon', cam: `w => { const L = w.lot || {x: 0, z: 0}; return {x: L.x - 55, z: L.z - 55, yaw: 45, height: 40, pitch: -30}; }`},
 // The sea where it comes in among the holes (generator 80, the
 // Lowcountry's tidal creeks; Monterey's shore): the 10 m cell with the most
 // open sea round it inside the map, seen from 70 m off and 40 m up.
 {name: 'sea-in', hole: 0, when: 'afternoon', cam: `w => { const wet = (x, z) => w.surface(x, z) === 'water' && w.height(x, z) < -.3 && !(w.lakeOwner && w.lakeOwner(x, z)); let best = {n: -1, x: 0, z: 0}; for (let x = -w.halfX * .9; x < w.halfX * .9; x += 30) for (let z = -w.halfZ * .9; z < w.halfZ * .9; z += 30) { if (!wet(x, z)) continue; let n = 0; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (wet(x + i * 10, z + j * 10)) n++; if (n > best.n) best = {n, x, z}; } return {x: best.x - 50, z: best.z - 50, yaw: 45, height: 40, pitch: -24}; }`},
];

// THE PICKS: the views each landscape's cards show, in order (at least four).
// Filled in the rounds (UI_POLISH.md, *Landscape pictures*).
export const PICKS = {
 // Round 1 (27 October 2026): views that show the landscape and read as a
 // card -- the afternoon from above, behind the first green, a hole from the
 // side or high, an approach. Rejected everywhere: the tee at eye height (a
 // tree or long grass in front), the green close to (a flat colour on a card),
 // golden hour at a tee (too dark); golden hour from above only where it is
 // clear (Desert, Autumn; elsewhere a brown haze).
 puget: ['overview', 'h1-behind', 'h5-approach', 'h2-side', 'h3-high'],
 sonoran: ['overview', 'h1-behind', 'h2-side', 'overview-golden', 'h3-high'],
 rockies: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 links: ['overview', 'h1-behind', 'h3-high', 'h2-side'],
 heartland: ['overview', 'h1-behind', 'h2-side', 'h5-approach'],
 keys: ['overview', 'h1-behind', 'h3-high', 'h2-side', 'h5-approach'],
 // Round 2: low views under the giants (the high ones stood in the crowns).
 redwood: ['overview', 'h2-low', 'h5-approach', 'h3-low', 'h1-tee'],
 newengland: ['overview', 'h1-behind', 'h2-side', 'overview-golden', 'h3-high'],
 lakedunes: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 highplains: ['overview', 'h1-behind', 'h2-side', 'h3-high'],
 sandhills: ['overview', 'h1-behind', 'h2-side', 'h3-high'],
 oldnortheast: ['overview', 'h1-behind', 'h2-side', 'h5-approach'],
 pinebarrens: ['overview', 'h1-behind', 'h2-side', 'h3-high'],
 alaska: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 longleaf: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 piedmont: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 lowcountry: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 bayou: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 flatwoods: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 hillcountry: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 bluebonnet: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 gulfcoast: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 mojave: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 palms: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 chihuahuan: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 monterey: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 socal: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 winecountry: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 cascades: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 sierra: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 ponderosa: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 sagebrush: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 redrock: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 crosstimbers: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 blueridge: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 ozarks: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 bluegrass: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 northwoods: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 oregondunes: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
 hawaii: ['h1-behind', 'overview', 'h2-side', 'h5-approach'],
 badlands: ['h1-behind', 'overview', 'h2-side', 'h3-high'],
};


async function take(biomes) {
 const b = await launch();
 try {
  for (const biome of biomes) {
   const dir = path.join(ROOT, label, biome);
   fs.mkdirSync(dir, {recursive: true});
   const p = await openGame(b, {width: 1920, height: 1080, density: 2, quality: 'ultra'});
   await p.evaluate(c => window.lab.course(c), {biome, holes: 9, seed: SEEDS[biome], season});
   await p.addStyleTag({content: HIDE_HUD});
   let hole = 0;
   for (const v of VIEWS.filter(v => !only || only.includes(v.name))) {
    if (v.hole !== hole) { await p.evaluate(h => window.lab.hole(h), v.hole); hole = v.hole; await p.waitForTimeout(4000); await p.addStyleTag({content: HIDE_HUD}); }
    await p.evaluate(([cam, at]) => { const view = window.__view; view.daylight.hour = at; view.daylight.rate = 0;
     window.lab.camera(typeof cam === 'string' ? (0, eval)(cam)(view.world) : cam); }, [v.cam, hourFor(biome, v.when)]);
    await hideBallAndAim(p);
    // Near grass is built a tile a frame, and the far cascades redraw every
    // fourth frame; give both time.
    await p.waitForTimeout(2200);
    await p.screenshot({path: path.join(dir, `${v.name}.png`)});
   }
   if (p.errors.length) console.log(`${biome}: page errors: ${p.errors.slice(0, 3).join(' | ')}`);
   await p.context().close();
   console.log(`${biome}: ${dir}`);
  }
 } finally { await b.close(); }
}

// Encode in a browser (no image library in this toolchain; Chromium writes
// WebP): each master scaled down in halving steps, then to WIDTH.
async function encode() {
 const out = path.join('src', 'shots');
 fs.mkdirSync(out, {recursive: true});
 for (const f of fs.readdirSync(out)) if (f.endsWith('.webp') && (!onlyBiomes || onlyBiomes.includes(f.replace(/-[0-9]+[.]webp$/, '')))) fs.rmSync(path.join(out, f));
 const b = await launch();
 let total = 0;
 try {
  const p = await (await b.newContext()).newPage();
  for (const [biome, views] of Object.entries(PICKS)) {
   if (onlyBiomes && !onlyBiomes.includes(biome)) continue;
   let n = 0;
   for (const v of views) {
    const src = path.join(ROOT, from, biome, `${v}.png`);
    if (!fs.existsSync(src)) throw Error(`no master ${src}: take it first`);
    const b64 = await p.evaluate(async ([data, width, q]) => {
     const img = new Image(); img.src = data; await img.decode();
     let c = document.createElement('canvas'), w = img.width, h = img.height;
     c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0);
     while (w / 2 >= width) { const n = document.createElement('canvas'); n.width = w / 2; n.height = h / 2; const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height); c = n; w = n.width; h = n.height; }
     const o = document.createElement('canvas'); o.width = width; o.height = Math.round(width * h / w);
     const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height);
     return o.toDataURL('image/webp', q).split(',')[1];
    }, ['data:image/png;base64,' + fs.readFileSync(src).toString('base64'), WIDTH, QUALITY]);
    const file = path.join(out, `${biome}-${++n}.webp`), bytes = Buffer.from(b64, 'base64');
    fs.writeFileSync(file, bytes);
    total += bytes.length;
    console.log(`${file} ${(bytes.length / 1024).toFixed(0)} KB (${v})`);
   }
  }
 } finally { await b.close(); }
 // Inlined as base64, a file costs the page a third more than its bytes.
 const page = total * 4 / 3;
 console.log(`\n${(total / 1024).toFixed(0)} KB of pictures; about ${(page / 1024 / 1024).toFixed(2)} MB added to the page (budget ${(BUDGET / 1024 / 1024).toFixed(1)} MB)`);
 if (page > BUDGET) { console.log('OVER BUDGET: lower QUALITY or WIDTH, or pick fewer'); process.exitCode = 1; }
}

if (mode === 'take') {
 const biomes = argv.length ? argv : Object.keys(BIOMES);
 for (const k of biomes) if (!BIOMES[k] || !SEEDS[k]) throw Error(`unknown landscape ${k}`);
 await take(biomes);
} else if (mode === 'encode') await encode();
else console.log('usage: biome-shots.mjs take [biome ...] [--views a,b] [--label r1] | encode [--from label] [--only a,b]');
