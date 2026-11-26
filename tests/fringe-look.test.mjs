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

test('a painted fringe is mown in laps along its own edge', () => {
 const src = fs.readFileSync(new URL('../src/ground.js', import.meta.url), 'utf8');
 assert.match(src, /if\(dGround<=0\.&&gcode>11\.5\)fringeLap=dGround;/, 'the painted fringe\'s edge distance is kept for its mowing');
 assert.match(src, /if\(kind==3\.&&fringeLap<0\.\)\{/, 'its laps are drawn');
 assert.match(src, /fringeLap\)\*stripeFade\*cueStripes\)/, 'the laps answer the mowing switch');
});
