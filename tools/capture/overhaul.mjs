// THE OVERHAUL'S FIXED VIEWS: the same pictures of every landscape, taken from
// any build, so a before and an after line up (the cartoon overhaul, 25
// October 2026; docs/CARTOON_OVERHAUL.md).
//
//   node tools/capture/overhaul.mjs <label> [biome ...] [--build <index.html>] [--views a,b]
//
// <label> names the set: `main` for the baseline taken from main's build, `r1`,
// `r2` ... for each round. Pictures land in bench/shots/overhaul/<label>/<biome>/
// (git-ignored) with a meta.json of the page's errors and the card's readings.
// The default build is the capture build of the working tree
// (`node tools/capture/build-hooked.mjs`); `--build bench/shots/overhaul/main-build/index.html`
// is main's, kept from the start of the goal.
//
// THE SAME COURSE, NOT THE SAME GROUND. Every landscape plays seed `overhaul`,
// nine holes. Once generation changes, that seed makes different land -- which
// is the point of the overhaul -- so a pair of pictures is the same hole and
// the same camera rule (behind its green, above its tee), not the same pixels.
//
// GPU. One landscape is about 25 seconds of the card. A run takes at most
// three landscapes; run several runs with a minute between (the goal's crash
// precautions). Every run goes through tools/gpu-gate.mjs and is logged.
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, save, HIDE_HUD, hourFor, hideBallAndAim} from './capture.mjs';
import {gpuGate, logRun, readCard} from '../gpu-gate.mjs';
import {BIOMES} from '../../src/biomes.js';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const build = opt('--build', undefined), only = opt('--views', null)?.split(','), seed = opt('--seed', 'overhaul');
const utilMax = Math.min(60, Number(opt('--util', 30)));
// `--tier high`: another graphics tier than Ultra (the shadows' round 3 checked High).
const tier = opt('--tier', 'ultra');
// `--cues '{"greenDefinition":70}'`: the ground-reading settings to draw with
// (renderer.js setGroundCues; the ground-readability rounds), applied after
// the course is built.
const cues = JSON.parse(opt('--cues', 'null'));
// `--eval 'view => ...'`: run against the renderer once the course is built --
// for a diagnostic picture (the far-landscape goal: the water made a pure
// mirror, to see what its reflection probe holds). Never for a round's look.
const evalAfter = opt('--eval', null);
// `--homes`: the same course with fairway homes on (the game's default is
// off, so no fixed view shows a house), and two views of the first ones --
// the houses' rounds (tools/blender/cartoon_houses.py). Kept apart from the
// fixed views, whose course must stay comparable with main's baseline.
const homes = argv.includes('--homes');
if (homes) argv.splice(argv.indexOf('--homes'), 1);
// `--houses 1,4`: which houses (by their order in world.homes) the two views look at.
const houseList = (opt('--houses', '0,3')).split(',').map(Number);
const HOUSE_VIEWS = houseList.map((k, i) => ({name: `house-${i + 1}`, hole: 0, when: 'afternoon', caption: `Fairway home ${k + 1}`,
 cam: `w => { const h = w.homes?.[${k}] ?? w.homes?.[0]; if (!h) return {x: 0, z: 0, height: 200, pitch: -40};
  const a = h.rotation + .5, x = h.x + Math.sin(a) * 38, z = h.z + Math.cos(a) * 38;
  return {x, z, yaw: Math.atan2(h.x - x, h.z - z) * 180 / Math.PI, height: 9, pitch: -9}; }`}));
const [label, ...named] = argv;
if (!label) throw Error('usage: node tools/capture/overhaul.mjs <label> [biome ...] [--build file] [--views a,b]');
const biomes = named.length ? named : Object.keys(BIOMES);
if (biomes.length > 3) throw Error(`${biomes.length} landscapes in one run; at most three (the goal's GPU precautions). Run it in pieces.`);
for (const b of biomes) if (!BIOMES[b]) throw Error(`unknown landscape "${b}"`);

// Each view: a name, a caption, a time of day and a camera. A camera is a
// lab.camera pose, or the source of a function of the world run in the page.
export const VIEWS = [
 {name: 'h1-tee', hole: 0, when: 'noon', caption: 'Hole 1 from the back tee, eye height', cam: {hole: 0, along: 0, height: 1.8, look: 'pin', pitch: -2.5}},
 {name: 'h1-behind', hole: 0, when: 'noon', caption: 'Hole 1 from behind its green', cam: {hole: 0, fromPin: 80, around: 170, height: 30, pitch: -17}},
 {name: 'h1-golden', hole: 0, when: 'golden', caption: 'Hole 1 from behind its green, golden hour', cam: {hole: 0, fromPin: 80, around: 170, height: 30, pitch: -17}},
 {name: 'h2-side', hole: 1, when: 'afternoon', caption: 'Hole 2 from the side, afternoon', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 {name: 'h2-green', hole: 1, when: 'noon', caption: 'Hole 2, the green close to', cam: {hole: 1, fromPin: 24, around: 25, height: 2.4, pitch: -7}},
 // The same green from 45 degrees further round: does its tone swim as the
 // camera moves (the ground-readability rounds; why the sheen was capped)?
 {name: 'h2-green-b', hole: 1, when: 'noon', caption: 'Hole 2, the green close to, 45 degrees round', cam: {hole: 1, fromPin: 24, around: 70, height: 2.4, pitch: -7}},
 // A bunker close to (the sand's rounds): the sand nearest the second pin,
 // from 9 m off at eye height.
 {name: 'h2-bunker', hole: 1, when: 'afternoon', caption: 'Hole 2, a greenside bunker close to', cam: `w => { const g = w.holes[1].worldPin; let best = null;
  for (let r = 4; r < 80 && !best; r += 2) for (let a = 0; a < 6.28; a += .15) { const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; if (w.surface(x, z) === 'sand') { best = {x, z}; break; } }
  if (!best) return {x: g.x, z: g.z - 30, yaw: 0, height: 4, pitch: -10};
  const d = Math.hypot(best.x - g.x, best.z - g.z) || 1, cx = best.x - (g.x - best.x) / d * 9, cz = best.z - (g.z - best.z) / d * 9;
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: 1.8, pitch: -14}; }`},
 // A pond from its bank at noon (the water's rounds): the water nearest the
 // first green, from 12 m back on dry ground, looking across it.
 {name: 'h1-pond', hole: 0, when: 'noon', caption: 'Hole 1, a pond from its bank', cam: `w => { const g = w.holes[0].worldPin; let best = null;
  for (let r = 10; r < 600 && !best; r += 6) for (let a = 0; a < 6.28; a += .1) { const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; if (w.surface(x, z) === 'water') { best = {x, z, a}; break; } }
  if (!best) return {x: g.x, z: g.z - 30, yaw: 0, height: 4, pitch: -10};
  const cx = best.x - Math.cos(best.a) * 12, cz = best.z - Math.sin(best.a) * 12;
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: 2.2, pitch: -8}; }`},
 // A cliff close to (the rock's rounds): the steepest ground near the first
 // green, from 40 m off and a little below its top.
 {name: 'h1-cliff', hole: 0, when: 'afternoon', caption: 'Hole 1, the nearest cliff', cam: `w => { const g = w.holes[0].worldPin; let best = null, steep = 0;
  for (let r = 30; r < 220; r += 8) for (let a = 0; a < 6.28; a += .15) { const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r;
   const s = Math.abs(w.height(x + 2, z) - w.height(x - 2, z)) + Math.abs(w.height(x, z + 2) - w.height(x, z - 2)); if (s > steep) { steep = s; best = {x, z, a}; } }
  const cx = best.x - Math.cos(best.a) * 40, cz = best.z - Math.sin(best.a) * 40, h = w.height(best.x, best.z) - w.height(cx, cz);
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: Math.max(2, h * .6), pitch: 0}; }`},
 // The flag from 4 m (the course props' rounds).
 {name: 'h2-flag', hole: 1, when: 'afternoon', caption: 'Hole 2, the flag from 4 m', cam: {hole: 1, fromPin: 4, around: 40, height: 1.8, pitch: 1}},
 // The same flag from the other side: whichever way the wind sets it, one of
 // the two sees the cloth's back (the flag's round 3, the number printed both ways).
 {name: 'h2-flag-back', hole: 1, when: 'afternoon', caption: 'Hole 2, the flag from 4 m, the other side', cam: {hole: 1, fromPin: 4, around: 220, height: 1.8, pitch: 1}},
 // A putt read from behind the ball (the ground-readability rounds).
 {name: 'h2-putt', hole: 1, when: 'noon', caption: 'Hole 2, a putt read from 9 m', cam: {hole: 1, fromPin: 9, around: 25, height: 1.6, pitch: -9}},
 {name: 'h3-edge', hole: 2, when: 'morning', caption: 'Hole 3, the edge of the rough, morning', cam: {hole: 2, along: 140, across: 34, height: 2.2, look: 'pin', pitch: -3}},
 {name: 'h3-between', hole: 2, when: 'noon', caption: 'Hole 3, the land beside it', cam: {hole: 2, fromPin: 160, around: 95, height: 55, pitch: -18}},
 // The lighting rounds' hours (phase 5): the same side view of hole 2 at first
 // light, in the dusk after sunset, and at night by the moon and under the
 // floodlights.
 {name: 'h2-dawn', hole: 1, when: 'dawn', caption: 'Hole 2 from the side, dawn', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 {name: 'h2-dusk', hole: 1, when: 'dusk', caption: 'Hole 2 from the side, dusk', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 {name: 'h2-night', hole: 1, when: 'night', caption: 'Hole 2 from the side, night', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 {name: 'h2-flood', hole: 1, when: 'night', flood: true, caption: 'Hole 2 from the side, night, floodlit', cam: {hole: 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 // The course furniture (tools/blender/cartoon_course.py): from behind the back
 // tee and off to its left, toward the sign, bench and washer on its right.
 {name: 'h1-teekit', hole: 0, when: 'afternoon', caption: 'Hole 1, the back tee\'s markers, sign and bench', cam: `w => { const h = w.holes[0], t = h.tees.blue || Object.values(h.tees)[0], p = h.pin;
  const L = Math.hypot(p.x - t.x, p.z - t.z) || 1, ux = (p.x - t.x) / L, uz = (p.z - t.z) / L;
  const c = h.toWorld({x: t.x - ux * 6 + uz * 3, z: t.z - uz * 6 - ux * 3}), s = h.toWorld({x: t.x - uz * 6 + ux * 2, z: t.z + ux * 6 + uz * 2});
  return {x: c.x, z: c.z, yaw: Math.atan2(s.x - c.x, s.z - c.z) * 180 / Math.PI, height: 1.6, pitch: -9}; }`},
 // The same furniture close to (its rounds past the first): the sign, washer
 // and bench from 3.6 m, and the back tee's markers from 5 m behind them.
 {name: 'h1-sign-near', hole: 0, when: 'afternoon', caption: 'Hole 1, the sign, washer and bench close to', cam: `w => { const h = w.holes[0], t = h.tees.blue || Object.values(h.tees)[0], p = h.pin;
  const L = Math.hypot(p.x - t.x, p.z - t.z) || 1, ux = (p.x - t.x) / L, uz = (p.z - t.z) / L;
  const c = h.toWorld({x: t.x + ux - uz * 2.5, z: t.z + uz + ux * 2.5}), s = h.toWorld({x: t.x - uz * 6 + ux * 2, z: t.z + ux * 6 + uz * 2});
  return {x: c.x, z: c.z, yaw: Math.atan2(s.x - c.x, s.z - c.z) * 180 / Math.PI, height: 1.5, pitch: -4}; }`},
 {name: 'h1-markers', hole: 0, when: 'afternoon', caption: 'Hole 1, the back tee markers close to', cam: `w => { const h = w.holes[0], t = h.tees.blue || Object.values(h.tees)[0], p = h.pin;
  const L = Math.hypot(p.x - t.x, p.z - t.z) || 1, ux = (p.x - t.x) / L, uz = (p.z - t.z) / L;
  const c = h.toWorld({x: t.x - ux * 6, z: t.z - uz * 6}), s = h.toWorld({x: t.x + ux * 2, z: t.z + uz * 2});
  return {x: c.x, z: c.z, yaw: Math.atan2(s.x - c.x, s.z - c.z) * 180 / Math.PI, height: 1.3, pitch: -12}; }`},
 // Heather close to (the overhaul's heather rounds): the heather nearest the
 // first green, from 14 m off at eye height; behind the green where there is none.
 {name: 'h1-heath', hole: 0, when: 'afternoon', caption: 'Heather close to', cam: `w => { const g = w.holes[0].worldPin; let best = null;
  for (let r = 20; r < 400 && !best; r += 12) for (let a = 0; a < 6.28; a += .2) { const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; if (w.surface(x, z) === 'heather') { best = {x, z}; break; } }
  if (!best) return {x: g.x, z: g.z - 60, yaw: 0, height: 20, pitch: -15};
  const d = Math.hypot(best.x - g.x, best.z - g.z) || 1, cx = best.x + (g.x - best.x) / d * 14, cz = best.z + (g.z - best.z) / d * 14;
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: 1.8, pitch: -12}; }`},
 // THE POLISH GOAL'S VIEWS (26 October 2026).
 // The far scenery from the course's edge: the band between the course's own
 // ground and the far woods or hills, looking out from 25 m up.
 {name: 'far-band', hole: 0, when: 'afternoon', caption: 'Looking out from the course\'s edge', cam: `w => ({x: w.halfX * .82, z: w.halfZ * .1, yaw: 90, height: 25, pitch: -3})`},
 {name: 'far-band-b', hole: 0, when: 'afternoon', caption: 'Looking out from the course\'s other edge', cam: `w => ({x: -w.halfX * .1, z: -w.halfZ * .82, yaw: 180, height: 25, pitch: -3})`},
 // The back tee from above (the tee boxes' mowing), and a links tee's
 // surround from behind and low (the fade into the tall grass).
 {name: 'tee-top', hole: 0, when: 'noon', caption: 'Hole 1, the back tee from above', cam: `w => { const h = w.holes[0], t = h.tees.blue || Object.values(h.tees)[0], p = h.pin;
  const L = Math.hypot(p.x - t.x, p.z - t.z) || 1, ux = (p.x - t.x) / L, uz = (p.z - t.z) / L, c = h.toWorld({x: t.x - ux * 9, z: t.z - uz * 9}), s = h.toWorld({x: t.x + ux * 3, z: t.z + uz * 3});
  return {x: c.x, z: c.z, yaw: Math.atan2(s.x - c.x, s.z - c.z) * 180 / Math.PI, height: 16, pitch: -52}; }`},
 {name: 'tee-surround', hole: 0, when: 'afternoon', caption: 'Hole 1, the back tee\'s surround from behind and to the side', cam: `w => { const h = w.holes[0], t = h.tees.blue || Object.values(h.tees)[0], p = h.pin;
  const L = Math.hypot(p.x - t.x, p.z - t.z) || 1, ux = (p.x - t.x) / L, uz = (p.z - t.z) / L, c = h.toWorld({x: t.x - ux * 14 + uz * 9, z: t.z - uz * 14 - ux * 9}), s = h.toWorld({x: t.x, z: t.z});
  return {x: c.x, z: c.z, yaw: Math.atan2(s.x - c.x, s.z - c.z) * 180 / Math.PI, height: 2.4, pitch: -8}; }`},
 // A pond from above (the water's depth colour): the nearest water to the
 // first green, from 45 m up.
 {name: 'pond-top', hole: 0, when: 'noon', caption: 'Hole 1, a pond from above', cam: `w => { const g = w.holes[0].worldPin; let best = null;
  for (let r = 10; r < 600 && !best; r += 6) for (let a = 0; a < 6.28; a += .1) { const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; if (w.surface(x, z) === 'water') { best = {x, z, a}; break; } }
  if (!best) return {x: g.x, z: g.z - 30, yaw: 0, height: 40, pitch: -50};
  const cx = best.x - Math.cos(best.a) * 30, cz = best.z - Math.sin(best.a) * 30;
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: 45, pitch: -48}; }`},
 // The nearest boulder to the first green, close to (Desert's stacks).
 {name: 'rock-near', hole: 0, when: 'afternoon', caption: 'The boulder nearest the first green, close to', cam: `w => { const g = w.holes[0].worldPin; let best = null, bd = 1e9;
  for (const r of w.rocks || []) { const d = Math.hypot(r.x - g.x, r.z - g.z); if (d < bd && (r.scale || 1) > 1.2) { bd = d; best = r; } }
  if (!best) return {x: g.x, z: g.z - 30, yaw: 0, height: 4, pitch: -10};
  const s = Math.max(2, best.reach || best.scale || 2), cx = best.x - s * 3.2, cz = best.z - s * 2.2;
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: Math.max(1.6, s * .9), pitch: -6}; }`},
 // The nearest big crag from 160 m off and 30 m up (the polish goal's
 // Mountain rounds): h1-cliff's 40 m can end up inside a crag's spur.
 {name: 'crag-face', hole: 0, when: 'afternoon', caption: 'Hole 1, the nearest crag from 160 m', cam: `w => { const g = w.holes[0].worldPin; let best = null, top = -1e9;
  for (let r = 60; r < 400; r += 10) for (let a = 0; a < 6.28; a += .12) { const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r, y = w.height(x, z); if (y > top) { top = y; best = {x, z, a}; } }
  const cx = best.x - Math.cos(best.a) * 160, cz = best.z - Math.sin(best.a) * 160;
  return {x: cx, z: cz, yaw: Math.atan2(best.x - cx, best.z - cz) * 180 / Math.PI, height: 30, pitch: 4}; }`},
 // THE FAR-LANDSCAPE GOAL'S VIEWS (26 October 2026). far-band and far-band-b
 // stand inside the course and mostly look into its own trees; these stand
 // just past the property line (40 m), above the canopy, looking out -- one
 // on the inland side, one on the west -- and one high over the course's
 // edge, where the land recedes to the horizon.
 {name: 'far-out', hole: 0, when: 'afternoon', caption: 'Past the property line, 45 m up, looking out (south)', cam: `w => ({x: -w.halfX * .2, z: -(w.halfZ + 40), yaw: 180, height: 45, pitch: -4})`},
 {name: 'far-side', hole: 0, when: 'afternoon', caption: 'Past the property line, 45 m up, looking out (west)', cam: `w => ({x: -(w.halfX + 40), z: w.halfZ * .2, yaw: 270, height: 45, pitch: -4})`},
 {name: 'far-high', hole: 0, when: 'afternoon', caption: 'High over the course\'s edge, the land receding', cam: `w => ({x: -w.halfX * .3, z: -w.halfZ * .6, yaw: 200, height: 160, pitch: -9})`},
 {name: 'overview', hole: 0, when: 'noon', caption: 'The whole course, noon', cam: `w => ({x: -w.halfX * .2, z: -w.halfZ * 1.05, yaw: 15, height: 240, pitch: -26})`},
 {name: 'overview-golden', hole: 0, when: 'golden', caption: 'The whole course, golden hour', cam: `w => ({x: -w.halfX * .2, z: -w.halfZ * 1.05, yaw: 15, height: 240, pitch: -26})`},
];
const views = homes ? HOUSE_VIEWS : only ? VIEWS.filter(v => only.includes(v.name)) : VIEWS;

const OUT = path.join('bench', 'shots', 'overhaul', label);
// `--util 50`: a higher load limit for the gate, when the owner says the card's
// load is theirs and harmless (26 October 2026: a remote-desktop session read
// 27-38% with nothing else running). Never past 60; the temperature limit stays.
const card = gpuGate({goal: 'cartoon-overhaul', cap: Infinity, restMin: 1, utilMax, tempMax: 80, lookSeconds: 30});
const started = new Date().toISOString(), results = {};
const b = await launch();
try {
 for (const biome of biomes) {
  const dir = path.join(OUT, biome), errors = [];
  fs.mkdirSync(dir, {recursive: true});
  const p = await openGame(b, {width: 1600, height: 900, density: 1, game: build && path.resolve(build), quality: tier});
  p.on('pageerror', e => errors.push(`page error: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`); });
  const t0 = Date.now();
  await p.evaluate(c => window.lab.course(c), {biome, holes: 9, seed, ...(homes ? {homes: true} : {})});
  if (cues) await p.evaluate(c => window.__view.setGroundCues(c), cues);
  if (evalAfter) console.log(biome, 'eval:', JSON.stringify(await p.evaluate(code => (0, eval)(code)(window.__view), evalAfter)));
  const built = Date.now() - t0;
  await p.addStyleTag({content: HIDE_HUD});
  let hole = 0;
  for (const v of views) {
   if (v.hole !== hole) { await p.evaluate(h => window.lab.hole(h), v.hole); hole = v.hole; await p.waitForTimeout(4000); await p.addStyleTag({content: HIDE_HUD}); }
   await p.evaluate(([cam, at, flood]) => { const view = window.__view; view.daylight.hour = at; view.daylight.rate = 0; view.setFloodlights?.(flood);
    window.lab.camera(typeof cam === 'string' ? (0, eval)(cam)(view.world) : cam); }, [v.cam, hourFor(biome, v.when), !!v.flood]);
   await hideBallAndAim(p);
   // Near-field grass is built one tile a frame; give it time to fill.
   await p.waitForTimeout(1600);
   await save(p, [{file: path.join(dir, `${v.name}.jpg`), width: 1600, quality: .88}]);
  }
  await p.context().close();
  results[biome] = {built, errors};
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({label, biome, seed, build: build || 'working tree', built, errors, at: new Date().toISOString(),
   views: views.map(v => ({name: v.name, caption: v.caption, when: v.when}))}, null, 1));
  console.log(`${biome}: ${views.length} views, course built in ${(built / 1000).toFixed(1)} s, ${errors.length} error(s)`);
 }
} finally {
 await b.close();
 const after = readCard();
 logRun({goal: 'cartoon-overhaul', what: `overhaul captures ${label}: ${biomes.join(', ')}`, started, before: card, after, result: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.errors.length ? `${r.errors.length} errors` : 'ok']))});
}
