// Split three ways (the testing audit, 31 October 2026): each test builds its
// own courses, so landscape-water and landscape-biomes run beside this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, greenDistance, ovalRadius, BIOMES} from '../src/course.js';
import {world as buildWorld} from './worlds.mjs';
import {allows} from '../src/grounds.js';

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
test('greenside bunkers respect the requested fringe gap, including tight settings',()=>{
 for(const gap of [0,2,15]){const w=buildWorld({bunkerGap:gap,bunkerCount:8,water:0,trees:0});let count=0;for(const h of w.holes)for(const b of h.bunkers.filter(b=>b.greenSide)){let actual=Infinity;for(let i=0;i<256;i++){const p=ovalRadius(b,i*Math.PI/128);actual=Math.min(actual,greenDistance(h,b.x+p.x,b.z+p.z)-w.settings.fringe);}assert(actual>=gap-.01);assert(actual<gap+.12);count++;}assert(count>=9);}
 assert(buildWorld({bunkerCount:0,trees:0}).holes.every(h=>h.bunkers.length===0));
});
