// The before/after clips in docs/reports/ball-landing/: the same shot played
// on main's physics ("before") and this branch's ("after"), recorded from the
// game's own canvas. Needs both capture builds:
//
//   git show main:src/physics.js > src/physics.js && git show main:src/clubs.js > src/clubs.js
//   OUT=bench/shots/dist-before node tools/site-media/build-hooked.mjs
//   git show HEAD:src/physics.js > src/physics.js && git show HEAD:src/clubs.js > src/clubs.js
//   node tools/site-media/build-hooked.mjs
//   node tools/landing-report/clips.mjs [scene...]
//
// The scenes and their numbers came from the searches written up in
// docs/reports/BALL_LANDING_REPORT.md; each is one exact shot, not a lookalike.
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, HIDE_HUD} from '../site-media/capture.mjs';
import {customizeClubs, manualLaunch} from '../../src/clubs.js';

const OUT = process.env.CLIP_OUT || 'docs/reports/ball-landing';
fs.mkdirSync(OUT, {recursive: true});
const clubs = customizeClubs();
// CLIP_BEFORE points "before" at another build, for a change compared with the
// commit before it rather than with main (the lip report).
const BUILDS = {before: path.resolve(process.env.CLIP_BEFORE || 'bench/shots/dist-before/index.html'), after: path.resolve('bench/shots/dist-exp/index.html')};
const wedge = power => manualLaunch(clubs.wedge, power, 1);
export const SCENES = {
 // A 17% keyboard wedge chip from the fringe on hole 8. Before: the square-root
 // spin rule (3,825 rpm). After: proportional (1,530 rpm).
 chip: {course: {biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0}, hole: 7, origin: {x: -10.82, z: 440.35}, aim: -1.41, seconds: 8,
  shot: which => ({...wedge(.17), spin: which === 'before' ? clubs.wedge.spin * Math.sqrt(.17) : wedge(.17).spin})},
 // A full keyboard pitching wedge into the greenside bunker on hole 2.
 bunker: {course: {biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0}, hole: 1, origin: {x: -126.46, z: 159.64}, aim: 95.16, seconds: 9,
  shot: () => wedge(1)},
 // A putt from 1.2 m on hole 7 that circled the inside of the cup 1,021 degrees
 // on main's physics and 213 after (bench search, no wind).
 // A putt from 1 m on hole 4 that rode the lip 474 degrees before the lip
 // grip cap and 239 after (both lip out). For the lip report:
 // CLIP_BEFORE=bench/shots/dist-lip-before/index.html CLIP_OUT=docs/reports/lip-grip node tools/landing-report/clips.mjs lipout
 lipout: {course: {biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0}, hole: 3, origin: {x: -2.563, z: 336.777}, aim: 46.718, seconds: 5,
  shot: () => ({speed: 1.2, vla: 0, spin: 0, spinAxis: 0, roll: 1.08}),
  watch: {fromPin: .62, around: 200, height: 1.05, pitch: -58}},
 cup: {course: {biome: 'pnw', seed: 'REPORT1', holes: 9, wind: 0}, hole: 6, origin: {x: -8.02, z: 119.05}, aim: 87.852, seconds: 5,
  shot: () => ({speed: 1.8, vla: 0, spin: 0, spinAxis: 0, roll: 1.62}),
  // Once it is struck, a camera above the hole, looking down into it (the free
  // camera keeps about a metre off the ground).
  watch: {fromPin: .62, around: 80, height: 1.05, pitch: -58}},
};
const want = process.argv.slice(2);
const b = await launch();
for (const [name, s] of Object.entries(SCENES).filter(([n]) => !want.length || want.includes(n))) for (const which of ['before', 'after']) {
 const p = await openGame(b, {width: 1280, height: 720, density: 1, game: BUILDS[which]});
 if (s.range) await p.evaluate(() => window.lab.open()); else {
  await p.evaluate(c => window.lab.course(c), s.course);
  await p.evaluate(h => window.lab.hole(h), s.hole);
 }
 await p.waitForTimeout(6000);
 await p.addStyleTag({content: HIDE_HUD});
 // Put the ball down and aim. For the putt, place it from the pin.
 const setup = await p.evaluate(([s]) => {
  const v = window.__view; v.daylight.hour = 14; v.daylight.rate = 0;
  let origin = s.origin, aim = s.aim;
  if (s.putt) {
   const pin = v.course.pin, tee = v.course.tee, d = Math.hypot(tee.x - pin.x, tee.z - pin.z), ux = (tee.x - pin.x) / d, uz = (tee.z - pin.z) / d;
   origin = {x: pin.x + ux * s.putt.from, z: pin.z + uz * s.putt.from};
   aim = Math.atan2(pin.x - origin.x, pin.z - origin.z) * 180 / Math.PI + Math.atan2(s.putt.offset, s.putt.from) * 180 / Math.PI;
  }
  window.__play(origin, aim);
  for (const o of [v.aimLine, v.aimRing, v.ballRing]) if (o) o.visible = false;
  return {origin, aim};
 }, [{origin: s.origin, aim: s.aim, putt: s.putt}]);
 await p.waitForTimeout(2000);
 const shot = s.putt ? {speed: s.putt.speed, vla: 0, hla: 0, spin: 0, spinAxis: 0, roll: s.putt.speed * .9} : {...s.shot(which), hla: 0};
 const b64 = await p.evaluate(async ([shot, seconds, watch]) => {
  const canvas = window.__view.renderer.domElement, stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 4_000_000});
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  rec.start(500);
  await new Promise(r => setTimeout(r, 400));
  if (!window.__takeShot(shot)) throw Error('the game refused the shot');
  if (watch) window.lab.camera(watch);
  await new Promise(r => setTimeout(r, seconds * 1000));
  rec.stop(); await done;
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
 }, [shot, s.seconds, s.watch || null]);
 fs.writeFileSync(`${OUT}/${name}-${which}.webm`, Buffer.from(b64, 'base64'));
 console.log(`${name}-${which}: ${(b64.length * .75 / 1048576).toFixed(1)} MB${p.errors.length ? ' errors: ' + p.errors.slice(0, 2).join(' | ') : ''}`);
 await p.context().close();
}
await b.close();
