// A fringe must be told from the fairway beside it (26 November 2026: the
// owner painted a whole fairway as fringe and could not see it, in the
// builder's plan or in the game). Its colour sits well toward the green on
// every landscape, and a painted fringe is mown in laps round its edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BIOMES} from '../src/biomes.js';

const rgb = h => String(h).replace('#', '').match(/../g).map(v => parseInt(v, 16));

// 45%: the Badlands, Prairie and the Northwoods sit at 49% and always read
// apart; Redwood sat at 31% and the South's four at 32%.
test('every landscape\'s fringe lies well toward its green from its fairway', () => {
 for (const [key, b] of Object.entries(BIOMES)) {
  if (b.fairway == null || b.fringe == null || b.green == null) continue;
  const f = rgb(b.fairway), r = rgb(b.fringe), g = rgb(b.green), d = g.map((v, i) => v - f[i]);
  const t = d.reduce((s, v, i) => s + v * (r[i] - f[i]), 0) / d.reduce((s, v) => s + v * v, 0);
  assert.ok(t >= .45,`${key}: its fringe is ${(t * 100).toFixed(0)}% of the way from fairway to green, and reads as more fairway`);
 }
});

// The owner, 26 November 2026: "I want fringe to act as one stripe. I dont
// want multiple." One lap, turned by its own outline.
test('a painted fringe is mown as one lap along its own edge', () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.match(src, /if\(dGround<=0\.&&gcode>11\.5&&gcode<12\.5\)fringeLap=dGround;/, 'the painted fringe\'s edge distance is kept for its mowing (code 12 alone: 13 is the approach)');
 assert.match(src, /float collarD=fringeLap<0\.\?fringeLap:greenD;/, 'its lap follows its own outline');
 assert.match(src, /if\(kind==3\.&&\(fringeLap<0\.\|\|greenD<5\.9\)\)\{/, 'the one lap is drawn on a painted fringe');
 assert.doesNotMatch(src, /sin\(lc\*6\.283\)/, 'no rings of laps');
});

// The owner, 26 November 2026: "can you make the approach diamond stripes
// instead of the single stripes like the fairway?"
// (Since the same day its style is a setting: tests/mowing-styles.test.mjs.)
test('a painted approach is cut 6 m a pass in its own style, with no dashed edge', () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.match(src, /bool appr=kind==2\.&&approachFade>\.5;/);
 assert.match(src, /float period=kind==4\.\?3\.2:appr\?6\.:12\.;/, 'half the fairway\'s 12 m');
 assert.match(src, /float mowAs=kind==4\.\?mowStyle\.y:appr\?mowStyle\.z:mowStyle\.x;/, 'its own style');
 assert.match(src, /float aa=max\(fwidth\(plan\*period\)\/period,\.001\);/, 'the fade measured where the period changes smoothly');
});
