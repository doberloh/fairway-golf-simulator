// Clips of each landscape (the website plays them behind its pages), a tee
// shot, a floodlit night, and a shot with the 1.0 round screen on it.
//
// RECORDED FRAME BY FRAME AT 4K, 60 FPS (18 October 2026; record.mjs): the
// game's clock is stepped a sixtieth of a second at a time, so every frame is
// drawn in full on Ultra at 3840x2160 however long it takes, and encoded twice:
//   video/master/<name>.mp4  3840x2160 H.264, 80 Mbit/s -- the master, for editing
//   video/<name>.webm        1920x1080 VP9, 8 Mbit/s -- the website's copy
//   video/<name>.jpg         its poster, 1920 wide
// under bench/shots/media/ (or $MEDIA_OUT/), not committed. Each file is
// opened in a <video> afterwards and must play. (Until then: recorded live,
// 1920x1080 at 5 Mbit/s, so a slow frame was a stutter.)
// Needs the capture build first: node tools/capture/build-hooked.mjs
//   node tools/capture/clips.mjs [name...]
// A 9-second clip is about two to four minutes on the graphics card; record
// one or two at a time (docs/CAPTURE.md, *GPU batches*).
import fs from 'node:fs';
import {launch, openGame, assertUltra, save, HIDE_HUD, hourFor, gpuGate} from './capture.mjs';
import {recordCanvas, recordPage, checkVideos, MASTER, WEB} from './record.mjs';
const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/video`;
fs.mkdirSync(`${OUT}/master`, {recursive: true});
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
 // Re-routed 19 October 2026: the first route (62 m out, 16 m up, swinging from
 // 40 degrees one side of the tee line to 40 the other) flew through a fir's
 // crown half a second in. This one swings round the clean view times.mjs
 // picked for Redwood's stills (70 m out, 22 m up, 210 degrees round).
 {name: 'giant-redwood-afternoon', biome: 'redwood', seed: 'GIANT', hole: 1, when: 'afternoon', seconds: 9,
  keys: [{fromPin: 72, around: 190, height: 22, pitch: -14}, {fromPin: 68, around: 210, height: 21, pitch: -14},
   {fromPin: 72, around: 230, height: 22, pitch: -14}]},
 {name: 'desert-tee-shot', biome: 'desert', seed: 'MESA', hole: 2, hour: 10.5, seconds: 7,
  shot: {speed: 67, vla: 11.5, hla: .5, spin: 2700, spinAxis: -2}},
 {name: 'night-floodlit', biome: 'pnw', seed: 'CEDAR', hole: 2, hour: 21.5, flood: true, seconds: 12,
  keys: [{fromPin: 110, around: 170, height: 40, pitch: -17}, {fromPin: 100, around: 190, height: 38, pitch: -17},
   {fromPin: 105, around: 210, height: 40, pitch: -17}]},
 // Added for 1.0: the ninth landscape at dusk, the fog in, the lanterns lit.
 {name: 'haunted-hollow-dusk', biome: 'haunted', seed: 'GLOAMING', hole: 1, hour: 19.2, seconds: 9,
  keys: [{fromPin: 220, around: 6, height: 28, pitch: -11}, {fromPin: 140, around: 3, height: 24, pitch: -12},
   {fromPin: 60, around: 0, height: 15, pitch: -14}]},
 // Added for 1.0: a drive with the round screen on -- the meter, the golfer
 // chips, the shot flying and the shot card coming up over its apex. The whole
 // page is recorded (the interface is not on the canvas).
 {name: 'round-screen-drive', biome: 'desert', seed: 'MESA', hole: 2, when: 'afternoon', seconds: 15, ui: true,
  shot: {speed: 67, vla: 11.5, hla: .5, spin: 2700, spinAxis: -2}},
];
const GROUP = {players: [{name: 'Alex', profile: 'pfair', team: 'A', hand: 'RH'}, {name: 'Sam', profile: 'psam', team: 'A', hand: 'RH'}, {name: 'Jordan', profile: 'pjo', team: 'B', hand: 'LH'}], mode: 'stroke', tee: 'blue'};
const want = process.argv.slice(2);
const list = CLIPS.filter(s => !want.length || want.includes(s.name));
if (want.length && list.length !== want.length) throw Error(`unknown clip in: ${want.join(' ')} (known: ${CLIPS.map(c => c.name).join(' ')})`);
const b = await launch();
try {
 for (const s of list) {
  console.log(`${s.name}: card ${gpuGate()}% before`);
  const t0 = Date.now();
  const p = await openGame(b, {width: 1920, height: 1080, density: 2, virtualClock: true});
  await p.evaluate(([c, g]) => window.lab.course(c, g), [{biome: s.biome, holes: 9, seed: s.seed}, GROUP]);
  await p.evaluate(h => window.lab.hole(h), s.hole);
  await p.waitForTimeout(9000);
  if (!s.ui) await p.addStyleTag({content: HIDE_HUD});
  await p.evaluate(([s]) => {
   const v = window.__view; v.daylight.hour = s.at; v.daylight.rate = 0;
   if (s.flood) v.setFloodlights(true);
   // A flyover hides the ball as well: at dusk the glow ball is a bright dot on the tee.
   if (!s.ui) for (const o of [v.aimLine, v.aimRing, v.ballRing, ...(s.shot ? [] : [v.ball, v.ballHalo])]) if (o) o.visible = false;
  }, [{...s, at: s.hour ?? hourFor(s.biome, s.when)}]);
  // THE PATH (fixed 19 October 2026 -- every flyover until then shook). The
  // keyed poses are placed through lab.camera, but the pose is read back from
  // the camera itself, never from what lab.camera RETURNS: that is rounded to
  // 0.1 m and 0.1 degree for reading, and a path built from rounded poses turns
  // in a stop-start rhythm (four frames still, three at triple speed, about
  // eight times a second; measured on links-golden, docs/CAPTURE.md *Traps*).
  // Then every channel is smoothed, the height kept clear of the ground by
  // pushing the curve up and smoothing again rather than by a hard floor (a
  // hard `max` put the ground's bumps back as kinks), and the frames are
  // interpolated with a Catmull-Rom curve rather than straight lines between
  // samples, so speed never jumps from one sample to the next.
  if (s.keys) await p.evaluate(([s]) => {
   const N = 240, lerp = (a, b, t) => a + (b - a) * t, poses = [], v = window.__view;
   const at = t => { const k = s.keys, f = t * (k.length - 1), i = Math.min(k.length - 2, Math.floor(f)), u = f - i, o = {};
    for (const key of new Set([...Object.keys(k[i]), ...Object.keys(k[i + 1])])) o[key] = typeof k[i][key] === 'number' ? lerp(k[i][key], k[i + 1][key], u) : k[i][key];
    return o; };
   for (let i = 0; i <= N; i++) {
    window.lab.camera(at(i / N));
    poses.push({x: v.targetPos.x, y: v.targetPos.y, z: v.targetPos.z, yaw: v.freeYaw, pitch: v.freePitch});
   }
   for (let i = 1; i <= N; i++) { while (poses[i].yaw - poses[i - 1].yaw > Math.PI) poses[i].yaw -= 2 * Math.PI; while (poses[i].yaw - poses[i - 1].yaw < -Math.PI) poses[i].yaw += 2 * Math.PI; }
   const smooth = (key, r) => { const a = poses.map(q => q[key]);
    for (let i = 0; i <= N; i++) { let sum = 0, n = 0; for (let j = Math.max(0, i - r); j <= Math.min(N, i + r); j++) { sum += a[j]; n++; } poses[i][key] = sum / n; } };
   // Height: never more than about 3 m under the ground-following height.
   const floor = poses.map(q => q.y - 3);
   for (let pass = 0; pass < 3; pass++) smooth('y', 20);
   for (let pass = 0; pass < 4; pass++) { for (let i = 0; i <= N; i++) poses[i].y = Math.max(poses[i].y, floor[i]); smooth('y', 10); }
   for (const key of ['x', 'z', 'yaw', 'pitch']) for (let pass = 0; pass < 2; pass++) smooth(key, 6);
   window.__path = poses;
   // The pose at a share t of the clip, eased in and out, on a Catmull-Rom
   // curve through the samples.
   const cr = (p0, p1, p2, p3, u) => .5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
   window.__poseAt = t => {
    const e = t * t * (3 - 2 * t) * .3 + t * .7, f = e * N, i = Math.min(N - 1, Math.floor(f)), u = f - i;
    const P = j => poses[Math.max(0, Math.min(N, j))], C = k => cr(P(i - 1)[k], P(i)[k], P(i + 1)[k], P(i + 2)[k], u);
    v.placeCamera({x: C('x'), y: C('y'), z: C('z')}, C('yaw'), C('pitch'));
   };
   window.__poseAt(0);
  }, [s]);
  await p.waitForTimeout(s.flood ? 4000 : 2500);
  await assertUltra(p, 2);
  await save(p, [{file: `${OUT}/${s.name}.jpg`, width: 1920, quality: .88}]);
  const files = [`${OUT}/master/${s.name}.mp4`, `${OUT}/${s.name}.webm`];
  const frames = Math.round(s.seconds * 60), shotAt = 54;
  const step = async i => {
   if (s.keys) await p.evaluate(t => window.__poseAt(t), i / (frames - 1));
   if (s.shot && i === shotAt) await p.evaluate(shot => window.__takeShot(shot), s.shot);
  };
  const out = await (s.ui ? recordPage : recordCanvas)(p, {seconds: s.seconds, fps: 60, outputs: [MASTER, WEB], files, step});
  const checked = await checkVideos(b, files);
  console.log(`  ${out.map(o => `${o.file.split('/').slice(-2).join('/')} ${o.frames} frames ${o.mb.toFixed(1)} MB`).join('; ')}`);
  console.log(`  plays: ${checked.join('; ')} -- ${((Date.now() - t0) / 1000).toFixed(0)} s${p.errors.length ? ' errors: ' + p.errors.slice(0, 2).join(' | ') : ''}`);
  await p.context().close();
 }
} finally { await b.close(); }
