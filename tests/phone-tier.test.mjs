import test from 'node:test';
import assert from 'node:assert/strict';
import {TIERS, QUALITY, PHONE, isPhoneDevice, saveGraphics, tierOf, needsRebuild} from '../src/graphics.js';

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
 for (const q of QUALITY) assert.ok(!TIERS[q].groundSquares, `${q} keeps its ground as it was`);
 assert.equal(p.pixelRatio, m.pixelRatio, 'Medium\'s pixels: the owner finds fewer a blurry mess');
 assert.equal(p.cascades, 0);
 // A shadow's normal offset goes with its texel (PROJECT_HANDOFF).
 const texel = (2 * p.shadowSpan.half) / p.shadow.size;
 assert.ok(p.shadowBias.normal >= texel, `offset ${p.shadowBias.normal} m against a ${texel.toFixed(2)} m texel`);
 // Nothing the tier list's other checks read is missing.
 for (const key of Object.keys(m)) assert.ok(key in p, `phone has ${key}`);
});
