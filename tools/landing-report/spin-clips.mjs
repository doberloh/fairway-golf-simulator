// Records the spin-back report's clips: every shot in plan.json, on every version
// it names, landing on the driving range's flat green and filmed side-on from
// beside the pitch mark, so forward and back read straight across the frame and
// the flag marks where the ball came down.
//
//   node tools/landing-report/spin-plan.mjs        (with SPIN_BUILDS, see there)
//   OUT=bench/shots/dist-spin-<label> node tools/capture/build-hooked.mjs   (per version)
//   node tools/landing-report/spin-clips.mjs [id-or-row ...] [--only=<label>]
//
// On the High tier at 1280x720: these study a ball, not the scenery, and the
// machine is shared (AGENTS.md: ask before graphics-heavy runs).
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, HIDE_HUD} from '../capture/capture.mjs';

const DIR = process.env.SPIN_OUT || 'docs/reports/backspin';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
const args = process.argv.slice(2), only = args.find(a => a.startsWith('--only='))?.slice(7);
const want = args.filter(a => !a.startsWith('--'));
const picked = plan.shots.filter(s => !want.length || want.includes(s.id) || want.includes(s.row));
// Where the camera stands, per row: metres to the side of the ball's line, and
// how far along from the pitch mark the middle of the frame sits (negative is
// back toward the golfer, where a ball that comes back goes).
const FRAME = {wedge: {side: 9, centre: -1.2, fov: 36}, steep: {side: 9, centre: -1.2, fov: 36}, iron7: {side: 16, centre: 5, fov: 36}};
const YARD = 0.9144, MPH = 0.44704;
const b = await launch();
for (const build of plan.builds.filter(x => !only || x.label === only)) {
 const p = await openGame(b, {width: 1280, height: 720, density: 1, game: path.resolve(build.capture), quality: 'high'});
 await p.evaluate(() => window.lab.open());
 await p.waitForTimeout(4000);
 await p.addStyleTag({content: HIDE_HUD});
 let green = null;
 for (const s of picked) {
  if (green !== s.carryYd) { await p.evaluate(y => window.lab.greenAt(y), s.carryYd); green = s.carryYd; await p.waitForTimeout(800); }
  const m = s.by[build.label];
  // Put the ball down beside the flag's line and aim straight down the range.
  const setup = await p.evaluate(([s, beside, stimp]) => {
   const v = window.__view, h = v.course;
   v.daylight.hour = 14; v.daylight.rate = 0;
   window.lab.firmness(s.firmness); window.lab.stimp(stimp);
   const origin = {x: (h.tee?.x ?? 0) + beside, z: h.tee?.z ?? 0};
   // The game refuses a shot while the camera is free, which the last clip's
   // camera left it.
   window.lab.view('player');
   window.__play(origin, 0);
   for (const o of [v.aimLine, v.aimRing]) if (o) o.visible = false;
   return {origin, pin: h.pin};
  }, [s, plan.beside, plan.stimp]);
  await p.waitForTimeout(1200);
  const frame = FRAME[s.row];
  const land = {x: setup.origin.x, z: setup.origin.z + s.carryYd * YARD};
  const b64 = await p.evaluate(async ([shot, land, frame, lead, length]) => {
   const v = window.__view, h = v.course, toW = q => h.toWorld ? h.toWorld(q) : q;
   const eye = toW({x: land.x + frame.side, z: land.z + frame.centre}), at = toW({x: land.x, z: land.z + frame.centre});
   // The range keeps the last shots' tracers up; only this shot's should show.
   const earlier = (v.shotLines || []).filter(line => line.visible);
   const watch = () => {
    window.lab.camera({x: eye.x, z: eye.z, height: 1.1, yaw: Math.atan2(at.x - eye.x, at.z - eye.z) * 180 / Math.PI, pitch: -3});
    // The lens, set on the camera itself: the free camera does not read config.fov.
    v.camera.fov = frame.fov; v.camera.updateProjectionMatrix();
    for (const line of earlier) line.visible = false;
    // And the next shot's aim, which comes back once this ball stops.
    for (const o of [v.aimLine, v.aimRing]) if (o) o.visible = false;
   };
   if (!window.__takeShot(shot)) throw Error('the game refused the shot');
   watch();
   // Start filming shortly before the ball comes down, and hold the camera
   // there: the game would otherwise follow the ball.
   const hold = setInterval(watch, 250);
   await new Promise(r => setTimeout(r, Math.max(0, lead) * 1000));
   const stream = v.renderer.domElement.captureStream(30);
   const rec = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 3_000_000});
   const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
   const done = new Promise(r => rec.onstop = r);
   rec.start(500);
   await new Promise(r => setTimeout(r, length * 1000));
   rec.stop(); await done; clearInterval(hold);
   const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
   let bin = ''; for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
   return btoa(bin);
  }, [{speed: s.mph * MPH, vla: s.vla, hla: 0, spin: s.spin, spinAxis: 0}, land, frame, m.hang - 1.4,
   // Every version of a shot is filmed for the same time -- the longest any of
   // them takes to stop -- so the clips can be played side by side.
   1.4 + Math.min(14, Math.max(...Object.values(s.by).map(x => x.rest))) + 1.5]);
  await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 30000}).catch(() => {});
  await p.waitForTimeout(500);
  const file = `${DIR}/${s.id}-${build.label}.webm`;
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`${file}: ${(b64.length * .75 / 1048576).toFixed(1)} MB, lands ${(land.z - setup.pin.z).toFixed(1)} m from the flag's line${p.errors.length ? ' errors: ' + p.errors.slice(-2).join(' | ') : ''}`);
 }
 await p.context().close();
}
await b.close();
