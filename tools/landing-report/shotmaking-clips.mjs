// Records the shot-making clips planned by shotmaking-plan.mjs, at website
// quality (1920x1080 on Ultra, interface hidden, 5 Mbit/s), each with a poster:
// for a tee shot the frame just before the cut, when the tracer has drawn the
// whole shape; for a shot into a green, a second and a half after it lands. Each is filmed the way television films these shots: a fixed camera
// down the line behind the ball, so the tracer draws the shape, then a cut to a
// camera beside where it lands, turning with the ball to show what it does
// there. The cameras come from the plan, in the hole's own metres.
//
//   node tools/capture/build-hooked.mjs
//   node tools/landing-report/shotmaking-plan.mjs
//   node tools/landing-report/shotmaking-clips.mjs [name...]
import fs from 'node:fs';
import {launch, openGame, assertUltra, HIDE_HUD, hourFor} from '../capture/capture.mjs';

const DIR = 'docs/reports/shotmaking';
const plan = JSON.parse(fs.readFileSync(`${DIR}/plan.json`, 'utf8'));
const want = process.argv.slice(2);
const b = await launch();
const p = await openGame(b, {width: 1920, height: 1080, density: 1});
await p.evaluate(c => window.lab.course(c), plan.course);
let hole = -1;
for (const [i, s] of plan.shots.entries()) {
 if (want.length && !want.includes(s.name)) continue;
 if (s.hole !== hole) { await p.evaluate(h => window.lab.hole(h), s.hole); await p.waitForTimeout(6000); hole = s.hole; }
 await p.evaluate(f => window.lab.firmness(f), s.firmness ? 'Soft' : 'Normal');
 await p.addStyleTag({content: HIDE_HUD});
 await p.evaluate(([s, hour]) => {
  const v = window.__view; v.daylight.hour = hour; v.daylight.rate = 0;
  window.__play(s.origin, s.aim);
  for (const o of [v.aimLine, v.aimRing, v.ballRing]) if (o) o.visible = false;
  // The game shows the ball's marker ring again every time it moves the ball,
  // after anything a frame callback here could do; its material stays hidden.
  v.ballRing.material.visible = false;
  // Hole metres to world: lab.camera reports where it put itself.
  const world = q => window.lab.camera({hole: s.hole, across: q.x, along: q.z, height: q.up});
  window.__rigs = s.cameras.map(c => ({from: c.from, fov: c.fov, eye: world(c.eye), look: c.look === 'ball' ? 'ball' : world(c.look)}));
  window.__lens = fov => { v.camera.fov = fov; v.camera.updateProjectionMatrix(); };
  window.__aimAt = (eye, t) => { const dx = t.x - eye.x, dy = t.y - eye.y, dz = t.z - eye.z; return [Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
  const r = window.__rigs[0], ball = v.ball.position;
  v.placeCamera(r.eye, ...window.__aimAt(r.eye, r.look === 'ball' ? ball : r.look));
  window.__lens(r.fov);
 }, [s, hourFor('pnw', 'afternoon')]);
 await p.waitForTimeout(2500);
 await assertUltra(p, 1);
 const file = `${DIR}/${String(i + 1).padStart(2, '0')}-${s.name}`;
 const [b64, jpg] = await p.evaluate(async ([s]) => {
  const canvas = window.__view.renderer.domElement, stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5_000_000});
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  rec.start(500);
  await new Promise(r => setTimeout(r, 700));
  // The game takes no shot while the camera is free; the next frame takes it back.
  window.__view.config.mode = 'player';
  if (!window.__takeShot({speed: s.speedMps, vla: s.vla, hla: 0, spin: s.spin, spinAxis: s.axis})) throw Error('the game refused the shot');
  // Each frame: the camera whose turn it is, turned smoothly toward the ball if
  // it follows it. A new camera is a cut, so it snaps rather than swings.
  const v = window.__view, t0 = performance.now(), ms = (s.seconds + 1.5) * 1000;
  let active = null, yaw = 0, pitch = 0;
  await new Promise(res => {
   const step = () => {
    const t = (performance.now() - t0) / 1000, rig = window.__rigs.filter(r => r.from <= t).at(-1);
    const [y, p] = window.__aimAt(rig.eye, rig.look === 'ball' ? v.ball.position : rig.look);
    if (rig !== active) { active = rig; yaw = y; pitch = p; window.__lens(rig.fov); }
    else { let d = y - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * .18; pitch += (p - pitch) * .18; }
    v.placeCamera(rig.eye, yaw, pitch);
    if (t * 1000 < ms) requestAnimationFrame(step); else res();
   };
   requestAnimationFrame(step);
  });
  rec.stop(); await done;
  const blob = new Blob(chunks, {type: 'video/webm'}), b64 = async b => { const bytes = new Uint8Array(await b.arrayBuffer());
   let bin = ''; for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000)); return btoa(bin); };
  // The poster, read back out of the recording itself.
  const video = document.createElement('video'); video.muted = true; video.src = URL.createObjectURL(blob);
  await new Promise(r => video.onloadeddata = r);
  video.currentTime = .7 + (s.atPin ? s.landing.t + 1.5 : window.__rigs.at(-1).from - .1); await new Promise(r => video.onseeked = r);
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').drawImage(video, 0, 0, 1280, 720);
  const poster = await new Promise(r => c.toBlob(r, 'image/jpeg', .84));
  return [await b64(blob), await b64(poster)];
 }, [s]);
 await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 30000}).catch(() => {});
 const ended = await p.evaluate(() => window.lab.state());
 await p.waitForTimeout(800);
 fs.writeFileSync(`${file}.webm`, Buffer.from(b64, 'base64'));
 fs.writeFileSync(`${file}.jpg`, Buffer.from(jpg, 'base64'));
 console.log(`${file}.webm: ${(b64.length * .75 / 1048576).toFixed(1)} MB${p.errors.length ? ' errors: ' + p.errors.slice(-2).join(' | ') : ''}`, JSON.stringify(ended).slice(0, 200));
}
await p.evaluate(() => { window.lab.firmness('Normal'); window.__lens(window.__view.config.fov); });
await b.close();
