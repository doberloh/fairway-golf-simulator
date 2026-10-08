// Background clips of each landscape (the website plays them behind its pages):
// camera flights and a tee shot, recorded from
// the game's own canvas (captureStream + MediaRecorder, webm), interface
// hidden, as <name>.webm with a <name>.jpg poster: 1920x1080
// on Ultra at 5 Mbit/s.
// Needs the capture build first: node tools/capture/build-hooked.mjs
//   node tools/capture/clips.mjs [name...]
import fs from 'node:fs';
import {launch, openGame, assertUltra, save, HIDE_HUD, hourFor} from './capture.mjs';
// Saves under bench/shots/media/video/ (not committed), or under $MEDIA_OUT/video/.
// Pictures for the website are picked from there and copied into the
// website's own repository by hand, under new names.
const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/video`;
fs.mkdirSync(OUT, {recursive: true});
// `keys` are lab.camera poses at evenly spaced moments; the flight passes
// through them with its height smoothed so the ground's bumps do not shake it.
// The eight landscape clips play one after another behind the website, in this
// order; the tee shot and the night clip are for the media page. A clip's
// light is a time of day (`when`, a sun height -- capture.mjs) unless it names
// an hour outright.
export const CLIPS = [
 {name: 'links-golden', biome: 'links', seed: 'DUNE', hole: 1, when: 'golden', seconds: 9,
  keys: [{fromPin: 230, around: 8, height: 32, pitch: -12}, {fromPin: 140, around: 4, height: 26, pitch: -13},
   {fromPin: 55, around: 0, height: 16, pitch: -15}]},
 {name: 'desert-noon', biome: 'desert', seed: 'MESA', hole: 2, when: 'noon', seconds: 9,
  keys: [{fromPin: 250, around: -6, height: 24, pitch: -10}, {fromPin: 150, around: -3, height: 30, pitch: -14},
   {fromPin: 50, around: 8, height: 18, pitch: -17}]},
 // Bird's eye, at first light, with the morning mist still lying in the valleys.
 {name: 'pacific-northwest-dawn', biome: 'pnw', seed: 'CEDAR', hole: 1, when: 'dawn', seconds: 9,
  keys: [{fromPin: 340, around: 25, height: 120, pitch: -26}, {fromPin: 210, around: 12, height: 105, pitch: -32},
   {fromPin: 90, around: 0, height: 90, pitch: -40}]},
 {name: 'autumn-golden', biome: 'autumn', seed: 'MAPLE', hole: 1, when: 'golden', seconds: 9,
  keys: [{fromPin: 210, around: -8, height: 24, pitch: -10}, {fromPin: 120, around: -4, height: 20, pitch: -12},
   {fromPin: 45, around: 0, height: 14, pitch: -14}]},
 {name: 'mountain-morning', biome: 'mountain', seed: 'SUMMIT', hole: 4, when: 'morning', seconds: 9,
  keys: [{fromPin: 95, around: 175, height: 34, pitch: -13}, {fromPin: 90, around: 205, height: 32, pitch: -13},
   {fromPin: 95, around: 235, height: 34, pitch: -13}]},
 {name: 'island-afternoon', biome: 'island', seed: 'LAGOON', hole: 1, when: 'afternoon', seconds: 9,
  keys: [{fromPin: 90, around: 120, height: 26, pitch: -12}, {fromPin: 82, around: 150, height: 24, pitch: -12},
   {fromPin: 90, around: 180, height: 26, pitch: -12}]},
 {name: 'midwest-afternoon', biome: 'midwest', seed: 'MEADOW', hole: 1, when: 'afternoon', seconds: 9,
  keys: [{fromPin: 230, around: -5, height: 20, pitch: -9}, {fromPin: 140, around: 0, height: 17, pitch: -10},
   {fromPin: 60, around: 5, height: 12, pitch: -11}]},
 {name: 'giant-redwood-afternoon', biome: 'redwood', seed: 'GIANT', hole: 1, when: 'afternoon', seconds: 9,
  keys: [{fromPin: 62, around: -40, height: 16, pitch: -12}, {fromPin: 56, around: 0, height: 15, pitch: -12},
   {fromPin: 62, around: 40, height: 16, pitch: -12}]},
 {name: 'desert-tee-shot', biome: 'desert', seed: 'MESA', hole: 2, hour: 10.5, seconds: 7,
  shot: {speed: 67, vla: 11.5, hla: .5, spin: 2700, spinAxis: -2}},
 {name: 'night-floodlit', biome: 'pnw', seed: 'CEDAR', hole: 2, hour: 21.5, flood: true, seconds: 12,
  keys: [{fromPin: 110, around: 170, height: 40, pitch: -17}, {fromPin: 100, around: 190, height: 38, pitch: -17},
   {fromPin: 105, around: 210, height: 40, pitch: -17}]},
];
const want = process.argv.slice(2);
const b = await launch();
for (const s of CLIPS.filter(s => !want.length || want.includes(s.name))) {
 const p = await openGame(b, {width: 1920, height: 1080, density: 1});
 await p.evaluate(c => window.lab.course(c), {biome: s.biome, holes: 9, seed: s.seed});
 await p.evaluate(h => window.lab.hole(h), s.hole);
 await p.waitForTimeout(7000);
 await p.addStyleTag({content: HIDE_HUD});
 await p.evaluate(([s]) => {
  const v = window.__view; v.daylight.hour = s.at; v.daylight.rate = 0;
  if (s.flood) v.setFloodlights(true);
  // A flyover hides the ball as well: at dusk the glow ball is a bright dot on the tee.
  for (const o of [v.aimLine, v.aimRing, v.ballRing, ...(s.shot ? [] : [v.ball, v.ballHalo])]) if (o) o.visible = false;
 }, [{...s, at: s.hour ?? hourFor(s.biome, s.when)}]);
 // The path: sample the keyed poses through lab.camera, then smooth the height.
 if (s.keys) await p.evaluate(([s]) => {
  const N = 240, lerp = (a, b, t) => a + (b - a) * t, poses = [];
  const at = t => { const k = s.keys, f = t * (k.length - 1), i = Math.min(k.length - 2, Math.floor(f)), u = f - i, o = {};
   for (const key of new Set([...Object.keys(k[i]), ...Object.keys(k[i + 1])])) o[key] = typeof k[i][key] === 'number' ? lerp(k[i][key], k[i + 1][key], u) : k[i][key];
   return o; };
  for (let i = 0; i <= N; i++) poses.push(window.lab.camera(at(i / N)));
  const ys = poses.map(q => q.y);
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i <= N; i++) { let sum = 0, n = 0; for (let j = Math.max(0, i - 20); j <= Math.min(N, i + 20); j++) { sum += ys[j]; n++; } poses[i].y = Math.max(ys[i] - 3, sum / n); }
  for (let i = 1; i <= N; i++) { while (poses[i].yaw - poses[i - 1].yaw > 180) poses[i].yaw -= 360; while (poses[i].yaw - poses[i - 1].yaw < -180) poses[i].yaw += 360; }
  window.__path = poses;
  const q = poses[0]; window.__view.placeCamera(q, q.yaw * Math.PI / 180, q.pitch * Math.PI / 180);
 }, [s]);
 await p.waitForTimeout(s.flood ? 4000 : 2500);
 await assertUltra(p, 1);
 await save(p, [{file: `${OUT}/${s.name}.jpg`, width: 1920, quality: .85}]);
 const b64 = await p.evaluate(async ([s]) => {
  const canvas = window.__view.renderer.domElement;
  const stream = canvas.captureStream(30);
  const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, {mimeType: type, videoBitsPerSecond: 5_000_000});
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  rec.start(500);
  const t0 = performance.now(), ms = s.seconds * 1000;
  if (s.shot) setTimeout(() => window.__takeShot(s.shot), 900);
  if (window.__path) await new Promise(res => {
   const path = window.__path, N = path.length - 1;
   const step = () => {
    const t = Math.min(1, (performance.now() - t0) / ms), e = t * t * (3 - 2 * t) * .3 + t * .7, f = e * N, i = Math.min(N - 1, Math.floor(f)), u = f - i;
    const a = path[i], c = path[i + 1], L = (k) => a[k] + (c[k] - a[k]) * u;
    window.__view.placeCamera({x: L('x'), y: L('y'), z: L('z')}, L('yaw') * Math.PI / 180, L('pitch') * Math.PI / 180);
    if (t < 1) requestAnimationFrame(step); else res();
   };
   requestAnimationFrame(step);
  }); else await new Promise(r => setTimeout(r, ms));
  rec.stop(); await done;
  const blob = new Blob(chunks, {type: 'video/webm'});
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
 }, [s]);
 fs.writeFileSync(`${OUT}/${s.name}.webm`, Buffer.from(b64, 'base64'));
 console.log(s.name, (b64.length * .75 / 1024 / 1024).toFixed(2) + ' MB');
 await p.context().close();
}
await b.close();
