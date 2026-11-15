import test from 'node:test';
import assert from 'node:assert/strict';
import {TIERS, QUALITY, PHONE, PHONE_FRAME_CAP, FRAME_CAPS, isPhoneDevice, saveGraphics, tierOf, needsRebuild} from '../src/graphics.js';

// A phone opens at 30 frames a second, a cap the settings offer (the owner,
// 15 November 2026: the iPhone holds its full speed only for a burst).
test('a phone\'s frame cap is 30, one the settings offer, and a save keeps it', () => {
 assert.equal(PHONE_FRAME_CAP, 30);
 assert.ok(FRAME_CAPS.includes(PHONE_FRAME_CAP));
 assert.equal(saveGraphics({quality: PHONE, frameCap: PHONE_FRAME_CAP}).frameCap, 30);
});

// THE PHONE TIER (branch phone-performance, 14 November 2026): a phone starts
// on it every time the game opens; no other machine is offered it.
test('a phone is an iPhone, an iPod or an Android phone; an iPad and an Android tablet are not', () => {
 const ua = s => ({userAgent: s});
 assert.ok(isPhoneDevice(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1')), 'Safari on the owner\'s iPhone');
 assert.ok(isPhoneDevice(ua('Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/157.0.8103.37 Mobile/15E148 Safari/604.1')), 'Chrome on the same iPhone');
 assert.ok(isPhoneDevice(ua('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')));
 assert.ok(!isPhoneDevice(ua('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')), 'an Android tablet');
 assert.ok(!isPhoneDevice(ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')), 'an iPad says it is a Mac');
 assert.ok(!isPhoneDevice(ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')));
 assert.ok(!isPhoneDevice(null) && !isPhoneDevice({}));
});

test('the Phone tier is kept through a save, is not one of the four, and is its own table', () => {
 assert.ok(!QUALITY.includes(PHONE), 'the desktop picker never offers it');
 assert.equal(saveGraphics({quality: PHONE}).quality, PHONE, 'a save on a phone keeps it');
 assert.equal(saveGraphics({quality: 'nonsense'}).quality, 'medium');
 assert.equal(tierOf(PHONE), TIERS.phone);
 assert.ok(needsRebuild('medium', PHONE) && needsRebuild(PHONE, 'low'), 'switching to or from it rebuilds the scene');
});

test('the Phone tier spends on geometry: the hole\'s trees, shadows from the twins, redrawn less often, coarser ground', () => {
 const p = TIERS.phone, m = TIERS.medium;
 assert.equal(p.thinTrees, true, 'Low\'s rule: every tree of the hole, fewer further off');
 assert.equal(p.thinShadowsFrom, 0, 'its one shadow map is cast by the far twins');
 assert.ok(p.shadowEvery > 1, 'and redrawn less often');
 assert.ok(p.groundTolerance > m.groundTolerance, 'the ground coarser than Medium\'s');
 // In squares on every course: a generated course's ground (2.4 M triangles)
 // is under the size the squares were kept for, so it was drawn whole and the
 // tolerance above did nothing (the second iPhone run). No other tier moves.
 assert.equal(p.groundSquares, true);
 // Trees kept whatever the view only close by (instance-cull.js `near`).
 assert.ok(p.cullNear > 0 && p.cullNear < 60, `phone keeps a ${p.cullNear} m ring`);
 for (const q of QUALITY) assert.equal(TIERS[q].cullNear, undefined, `${q} keeps the 60 m ring`);
 // The fifth run's two levers: half the grass round the camera, the far
 // versions from twice Medium's lines.
 assert.ok(p.nearGrass > 0 && p.nearGrass < 1);
 for (const q of QUALITY) assert.equal(TIERS[q].nearGrass, undefined, `${q} keeps all its grass`);
 assert.ok(p.farPainted > m.farPainted && p.farTrees > m.farTrees);
 // Its ground's own program (ground.js `phoneGround`), on no other tier.
 assert.equal(p.phoneGround, true);
 for (const q of QUALITY) assert.ok(!TIERS[q].phoneGround, `${q} keeps the ground's program as it was`);
 // The ground painted into pictures (ground-bake.js): Phone only, on unless
 // the player turns it off.
 assert.equal(p.groundBake, true);
 for (const q of QUALITY) assert.ok(!TIERS[q].groundBake, `${q} draws its ground as it was`);
 assert.equal(saveGraphics({}).groundBake, true);
 assert.equal(saveGraphics({groundBake: false}).groundBake, false);
 for (const q of QUALITY) assert.ok(!TIERS[q].groundSquares, `${q} keeps its ground as it was`);
 assert.equal(p.pixelRatio, m.pixelRatio, 'Medium\'s pixels: the owner finds fewer a blurry mess');
 assert.equal(p.cascades, 0);
 // A shadow's normal offset goes with its texel (PROJECT_HANDOFF).
 const texel = (2 * p.shadowSpan.half) / p.shadow.size;
 assert.ok(p.shadowBias.normal >= texel, `offset ${p.shadowBias.normal} m against a ${texel.toFixed(2)} m texel`);
 // Nothing the tier list's other checks read is missing.
 for (const key of Object.keys(m)) assert.ok(key in p, `phone has ${key}`);
});

// LOW'S RULE, HARDER (graphics.js `lowTrees`; the owner, 15 November 2026):
// the hole's trees and the ball's are kept exactly as Low keeps them; only
// the share outside them falls, and faster.
test('the Phone tier thins the trees outside the hole harder, never one of the hole\'s or the ball\'s', async () => {
 const {LOW_TREES, protectedAt, shareAt} = await import('../src/low-trees.js');
 const rules = {...LOW_TREES, ...TIERS.phone.lowTrees};
 for (const k of ['holeReach', 'ballReach', 'flyReach', 'behind', 'past', 'step']) assert.equal(rules[k], LOW_TREES[k], `${k} as Low's`);
 const region = {path: new Float32Array([0, 0, 0, 400]), ball: {x: 200, z: 100}, camera: {x: 0, z: -50}, flying: false};
 for (const [x, z] of [[70, 200], [-79, 10], [260, 100]]) assert.equal(protectedAt(region, x, z, rules), protectedAt(region, x, z, LOW_TREES), `(${x}, ${z})`);
 for (const d of [100, 200, 300, 600]) assert.ok(shareAt(d, rules) < shareAt(d, LOW_TREES), `fewer kept ${d} m off`);
 assert.ok(shareAt(400, rules) + rules.fade <= .1, 'about one in ten at most past 300 m, the fade band included');
 for (const q of QUALITY) assert.equal(TIERS[q].lowTrees, undefined, `${q} keeps Low's own figures`);
});

// THE BUNKER SKIP IS EXACT (ground.js GROUND_HAZARD_REACH): the shader's own
// arithmetic for a bunker's signed distance, over random bunkers and pixels.
// Wherever the skip fires, the bunker could not have painted the pixel: its
// sand only to 0.35 m outside its edge, a collection area only inside.
test('a bunker the Phone ground skips could not have touched the pixel', () => {
 let seed = 7;
 const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
 let fired = 0;
 for (let k = 0; k < 200000; k++) {
  const c = [rnd() * 200 - 100, rnd() * 200 - 100], z = 2 + rnd() * 30, w = 2 + rnd() * 30;
  const meta = [rnd() * 6.3, 0, rnd() * .8 - .4, rnd() * .8 - .4];
  const p = [c[0] + (rnd() * 2 - 1) * 120, c[1] + (rnd() * 2 - 1) * 120];
  const D = Math.hypot(p[0] - c[0], p[1] - c[1]);
  if (!(D > Math.max(z, w) * (1 + Math.abs(meta[2]) + Math.abs(meta[3])) + 1)) continue;
  fired++;
  const q = [(p[0] - c[0]) / z, (p[1] - c[1]) / w], a = Math.atan2(q[1], q[0]);
  const edge = 1 + meta[2] * Math.sin(a * 2 + meta[0]) + meta[3] * Math.sin(a * 3 + meta[0]);
  const hd = (Math.hypot(...q) - edge) * D / Math.max(Math.hypot(...q), 1e-4);
  assert.ok(hd >= .35, `skipped a bunker ${hd.toFixed(3)} m from the pixel`);
 }
 assert.ok(fired > 50000, `the skip fired ${fired} times`);
});
