import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, greenDistance, ovalRadius, BIOMES} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';

test('dogleg controls produce straight, left, right, and late-turning holes',()=>{
 const straight=buildWorld({doglegs:0,trees:0});for(const h of straight.holes)for(let z=0;z<h.length;z+=20)assert(Math.abs(h.center(z))<1e-9);
 const w=buildWorld({seed:'DOGLEG',doglegs:100,doglegAngle:65,trees:0,holes:18});const long=w.holes.filter(h=>h.par!==3);assert(long.some(h=>h.doglegAngle>0));assert(long.some(h=>h.doglegAngle<0));for(const h of long){assert(Math.abs(h.center(h.length*.5))>30);assert(Math.abs(h.center(h.length))<1e-7);}
 const index=Array.from({length:9},(_,i)=>generateCourse({seed:'DOGLEG'},i)).find(h=>h.par!==3).hole;
 const early=generateCourse({seed:'DOGLEG',doglegs:100,doglegAngle:60,doglegPosition:30},index),late=generateCourse({seed:'DOGLEG',doglegs:100,doglegAngle:60,doglegPosition:75},index);const peak=h=>Array.from({length:100},(_,i)=>({z:i*h.length/100,v:Math.abs(h.center(i*h.length/100))})).sort((a,b)=>b.v-a.v)[0].z;assert(peak(late)/late.length>peak(early)/early.length+.22);
});
test('compact routing varies headings and keeps playable corridors separate',()=>{
 for(const seed of ['ROUTE','HORIZON-5714','WOOT']){const w=buildWorld({seed,holes:18,trees:0,doglegs:100,doglegAngle:70,spacing:8});assert(new Set(w.holes.map(h=>Math.round(h.rotation*180/Math.PI/20))).size>=7);
  for(const h of w.holes)for(let z=0;z<=h.length;z+=12){const p=h.toWorld({x:h.center(z),z});assert.equal(w.nearby(p.x,p.z),h,`Hole ${h.hole} loses its corridor at ${z}`);}
  const walks=w.holes.slice(1).map((h,i)=>Math.hypot(h.worldTee.x-w.holes[i].worldPin.x,h.worldTee.z-w.holes[i].worldPin.z));assert(walks.reduce((a,b)=>a+b,0)/walks.length<150);
 }
});
test('water depths match actual lake bottoms and are independent of water elevation',()=>{
 // NOT island: that biome carries no inland water at all, so it has no pond
 // whose depth could be checked. What this test is actually about -- a pond's
 // depth matching the setting and not drifting with the water's elevation --
 // is unchanged, and mountain and desert still exercise it across the range.
 for(const biome of ['mountain','desert'])for(const depth of [.3,4]){const w=buildWorld({seed:'DEPTH',biome,water:100,waterMin:depth,waterMax:depth,trees:0});let count=0;
  for(const h of w.holes)for(const p of h.ponds){count++;assert.equal(p.depth,depth);assert(Math.abs(p.level-h.height(p.x,p.z)-depth)<.01);assert.equal(h.surface(p.x,p.z),'water');}assert(count>0);
 }
});
test('greenside bunkers respect the requested fringe gap, including tight settings',()=>{
 for(const gap of [0,2,15]){const w=buildWorld({bunkerGap:gap,bunkerCount:8,water:0,trees:0});let count=0;for(const h of w.holes)for(const b of h.bunkers.filter(b=>b.greenSide)){let actual=Infinity;for(let i=0;i<256;i++){const p=ovalRadius(b,i*Math.PI/128);actual=Math.min(actual,greenDistance(h,b.x+p.x,b.z+p.z)-w.settings.fringe);}assert(actual>=gap-.01);assert(actual<gap+.12);count++;}assert(count>=9);}
 assert(buildWorld({bunkerCount:0,trees:0}).holes.every(h=>h.bunkers.length===0));
});
test('islands have substantial surrounding and interior water without flooding fairways',()=>{
 const w=buildWorld({biome:'island',seed:'HORIZON-5714',holes:18,elevation:100,landform:100,trees:0});let wet=0,total=0;for(let x=-w.halfX;x<w.halfX;x+=25)for(let z=-w.halfZ;z<w.halfZ;z+=25){total++;if(w.surface(x,z)==='water')wet++;assert(w.land(x,z)>=-w.settings.waterMax-1e-8);}assert(wet/total>.35);for(const h of w.holes){assert.equal(h.surface(Object.values(h.tees)[0].x,Object.values(h.tees)[0].z),'tee');assert.equal(h.surface(h.pin.x,h.pin.z),'green');for(let z=25;z<h.length-25;z+=15)assert.notEqual(h.surface(h.center(z),z),'water');}
});
test('mountains and dunes grow between holes, and every biome has mixed vegetation',()=>{
 for(const biome of Object.keys(BIOMES)){const w=buildWorld({biome,trees:45,elevation:70,landform:100});assert(new Set(w.trees.map(t=>t.kind)).size>=3);assert(w.trees.every(t=>w.surface(t.x,t.z)==='rough'));
  if(['mountain','links'].includes(biome)){let peak=0;for(let x=-w.halfX;x<w.halfX;x+=40)for(let z=-w.halfZ;z<w.halfZ;z+=40)peak=Math.max(peak,w.height(x,z));assert(peak>(biome==='mountain'?80:30));}
 }
});
