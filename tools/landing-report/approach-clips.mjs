// Records the chipping and approach clips planned by approach-plan.mjs, on the
// current capture build, from the player's own camera: what a player sees.
//
//   node tools/capture/build-hooked.mjs
//   node tools/landing-report/approach-plan.mjs
//   node tools/landing-report/approach-clips.mjs [index...]
import fs from 'node:fs';
import {launch, openGame, HIDE_HUD} from '../capture/capture.mjs';

const DIR = 'docs/reports/chipping';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
const want = process.argv.slice(2).map(Number);
const slug = s => `${s.yards}yd-${s.style.toLowerCase().replace(/[^a-z]+/g, '-')}`;
const b = await launch();
const p = await openGame(b, {width: 1280, height: 720, density: 1});
await p.evaluate(c => window.lab.course(c), plan.course);
await p.evaluate(h => window.lab.hole(h), plan.hole);
await p.waitForTimeout(6000);
await p.addStyleTag({content: HIDE_HUD});
for (const [i, s] of plan.shots.entries()) {
 if (want.length && !want.includes(i)) continue;
 await p.evaluate(([s]) => {
  const v = window.__view; v.daylight.hour = 15; v.daylight.rate = 0;
  window.__play(s.origin, s.aim);
  // Straight to the player's camera behind the ball, not a flight to it.
  v.setCamera(s.origin, s.aim, true);
  for (const o of [v.aimLine, v.aimRing, v.ballRing]) if (o) o.visible = false;
 }, [s]);
 await p.waitForTimeout(2500);
 const b64 = await p.evaluate(async ([s]) => {
  const canvas = window.__view.renderer.domElement, stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 3_500_000});
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  rec.start(500);
  await new Promise(r => setTimeout(r, 500));
  if (!window.__takeShot({speed: s.speedMps, vla: s.vla, hla: 0, spin: s.spin, spinAxis: 0})) throw Error('the game refused the shot');
  // The flight and roll, and a moment to see where it finished.
  await new Promise(r => setTimeout(r, (s.seconds + 1.6) * 1000));
  rec.stop(); await done;
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let bin = ''; for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(bin);
 }, [s]);
 // Let the game finish the shot before the next one is placed.
 await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 30000}).catch(() => {});
 await p.waitForTimeout(800);
 const file = `${DIR}/${String(i + 1).padStart(2, '0')}-${slug(s)}.webm`;
 fs.writeFileSync(file, Buffer.from(b64, 'base64'));
 console.log(`${file}: ${(b64.length * .75 / 1048576).toFixed(1)} MB${p.errors.length ? ' errors: ' + p.errors.slice(-2).join(' | ') : ''}`);
}
await b.close();
