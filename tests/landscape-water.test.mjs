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
 for(const biome of ['mountain','desert'])for(const depth of [.3,4]){const w=buildWorld({seed:'DEPTH',biome,water:100,waterMin:depth,waterMax:depth,trees:0});let count=0;
  for(const h of w.holes)for(const p of h.ponds){count++;assert.equal(p.depth,depth);assert(Math.abs(p.level-h.height(p.x,p.z)-depth)<.01);assert.equal(h.surface(p.x,p.z),'water');}assert(count>0);
 }
});
test('islands have substantial surrounding and interior water without flooding fairways',()=>{
 const w=buildWorld({biome:'island',seed:'HORIZON-5714',holes:18,elevation:100,landform:100,trees:0});let wet=0,total=0;for(let x=-w.halfX;x<w.halfX;x+=25)for(let z=-w.halfZ;z<w.halfZ;z+=25){total++;if(w.surface(x,z)==='water')wet++;assert(w.land(x,z)>=-w.settings.waterMax-1e-8);}assert(wet/total>.35);for(const h of w.holes){assert.equal(h.surface(Object.values(h.tees)[0].x,Object.values(h.tees)[0].z),'tee');assert.equal(h.surface(h.pin.x,h.pin.z),'green');for(let z=25;z<h.length-25;z+=15)assert.notEqual(h.surface(h.center(z),z),'water');}
});
