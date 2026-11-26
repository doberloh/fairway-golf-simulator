// ONE HUE FOR THE PLAYING TURF (src/turf-ladder.js; the owner, 26 November
// 2026: "I want the playing surface grass (fairway, semi, approach, fringe,
// green) in each biome to not be different hues", and the pick, B: green 44,
// fairway 34). Every landscape, every season.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BIOMES} from '../src/biomes.js';
import {seasonPalette} from '../src/seasons.js';
import {hexToHsl} from '../src/colour-lab.js';
import {FAIRWAY_LIGHT, TURF_LADDER, turfLadder} from '../src/turf-ladder.js';

const SURF = ['semi', 'fairway', 'fringe', 'green'];
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

test('the owner\'s pick: green 44, fairway 34, the rest stepped between', () => {
 assert.equal(FAIRWAY_LIGHT, 34);
 assert.equal(FAIRWAY_LIGHT + TURF_LADDER.green.l, 44);
 assert.ok(TURF_LADDER.semi.l < 0 && TURF_LADDER.fringe.l > 0 && TURF_LADDER.green.l > TURF_LADDER.fringe.l, 'semi darker, then fairway, fringe, green');
 const L = turfLadder('#709245', {light: 34});
 assert.ok(Math.abs(hexToHsl(L.green).l - 44) <= 1 && Math.abs(hexToHsl(L.fairway).l - 34) <= 1);
});

test('every landscape\'s playing turf is one hue, the fairway\'s as written', () => {
 for (const [k, b] of Object.entries(BIOMES)) {
  const h0 = hexToHsl(b.turfAsWritten.fairway).h;
  for (const s of SURF) assert.ok(hueGap(hexToHsl(b[s]).h, h0) <= 2, `${k} ${s}: hue ${hexToHsl(b[s]).h} against the fairway's ${h0}`);
  assert.ok(hexToHsl(b.semi).l < hexToHsl(b.fairway).l && hexToHsl(b.fairway).l < hexToHsl(b.fringe).l && hexToHsl(b.fringe).l < hexToHsl(b.green).l, `${k}: semi, fairway, fringe, green in order of lightness`);
 }
});

test('every season keeps the playing turf one hue (snow on the semi-rough excepted)', () => {
 for (const [k, b] of Object.entries(BIOMES)) for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  const p = {...b, ...seasonPalette(b, season, b.region)}, h0 = hexToHsl(p.fairway).h;
  for (const s of ['fringe', 'green']) assert.ok(hueGap(hexToHsl(p[s]).h, h0) <= 2, `${k} ${season} ${s}`);
 }
});

test('the ground shader eases every turf edge in, and keeps mown slopes in their own hue', () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.match(src, /float edgeIn\(float d\)\{float a=max\(\.075,fwidth\(d\)\*\.75\);return 1\.-smoothstep\(-a,a,d\);\}/, '15 cm, or a pixel and a half');
 for (const t of ['tint_semi,edgeIn(semiD)', 'tint_fairway,edgeIn(fwD)', 'tint_fringe,edgeIn(greenD-info.z)', 'tint_green,edgeIn(greenD)', 'tint_semi,edgeIn(dSemi)', 'tint_fairway,edgeIn(dFair)', 'tint_fringe,edgeIn(dFringe)', 'tint_green,edgeIn(dGreen)', 'teeTurf,edgeIn(dTee)'])
  assert.ok(src.includes(t), `eased in: ${t}`);
 assert.match(src, /if\(kind>\.5&&kind<4\.5\)turf=inHue\(turf,dry\*dryGain\*cueSlope\*\.55\);/, 'a mown slope in its own hue');
});
