// Water depths and an island's water. Split from landscape.test.mjs (the
// testing audit, 31 October 2026), to run beside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, greenDistance, ovalRadius, BIOMES} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {allows} from '../src/grounds.js';

test('water depths match actual lake bottoms and are independent of water elevation',()=>{
 // NOT island: that biome carries no inland water at all, so it has no pond
 // whose depth could be checked. What this test is actually about -- a pond's
 // depth matching the setting and not drifting with the water's elevation --
 // is unchanged, and mountain and desert still exercise it across the range.
 for(const biome of ['mountains','dmountain'])for(const depth of [.3,4]){const w=buildWorld({seed:'DEPTH',biome,water:100,waterMin:depth,waterMax:depth,trees:0});let count=0;
  for(const h of w.holes)for(const p of h.ponds){count++;assert.equal(p.depth,depth);assert(Math.abs(p.level-h.height(p.x,p.z)-depth)<.01);assert.equal(h.surface(p.x,p.z),'water');}assert(count>0);
 }
});
// (The Keys, the only ring island, left for Florida Palms on 7 November 2026: no landscape builds an
// island now, so the island-only test that stood here went with it. TODO *The island code has no landscape*.)

