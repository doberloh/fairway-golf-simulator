// Every landscape's country between the holes and its planting. Split from
// landscape.test.mjs (the testing audit, 31 October 2026), to run beside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, greenDistance, ovalRadius, BIOMES} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {allows} from '../src/grounds.js';

test('mountains and dunes grow between holes, and every biome has mixed vegetation',()=>{
 for(const biome of Object.keys(BIOMES)){const w=buildWorld({biome,trees:45,elevation:70,landform:100});assert(new Set(w.trees.map(t=>t.kind)).size>=3);// SCATTER planting only. A SPECIMEN tree is deliberately in the short grass --
  // the lone cypress, the oak in the middle of the fairway -- and is marked
  // `feature` for exactly this reason. Dropping the assertion rather than
  // narrowing it would stop it catching the thing it was written for, which is
  // scatter planting wandering onto a corridor.
  // Natural ground a tree may stand on (grounds.js `allows`): rough, or since
  // the cartoon overhaul hardpan, native grass, heather or its own straw.
  assert(w.trees.filter(t=>!t.feature).every(t=>allows(w.surface(t.x,t.z),'trees')));
  assert(w.trees.some(t=>!t.feature),'no scatter trees at all -- the assertion above is vacuous');
  if(['mountain','links'].includes(biome)){let peak=0;for(let x=-w.halfX;x<w.halfX;x+=40)for(let z=-w.halfZ;z<w.halfZ;z+=40)peak=Math.max(peak,w.height(x,z));assert(peak>(biome==='mountain'?80:30));}
 }
});
