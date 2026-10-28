import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {simulateShot} from '../src/physics.js';
import {allows} from '../src/grounds.js';

let estate;
const built=()=>estate??=generateWorld({seed:'HOMES-QA',biome:'midwest',holes:9,homes:true,homeDensity:100,trees:0,water:0});
const shotInto=(w,home,extra={})=>{
 const h=w.nearest(home.x,home.z).h,local=h.toLocal({x:home.x,z:home.z});
 // Fire flat at the house from 40 m out along the hole's own x axis.
 const origin={x:local.x-40,z:local.z};
 return simulateShot({origin,aim:90,hla:0,vla:4,spin:500,spinAxis:0,speed:34},{...h,...extra});
};

test('houses are solid: a ball cannot finish inside one',()=>{
 const w=built();
 assert(w.homes.length>0,'this fixture needs houses');
 let tested=0;
 for(const home of w.homes.slice(0,12)){
  const h=w.nearest(home.x,home.z).h,r=shotInto(w,home);
  const local=h.toLocal({x:home.x,z:home.z});
  // In the hole's frame a house is turned by its own rotation less the
  // hole's. This check once used the world angle, as simulateShot did, and
  // the two agreed with each other while both disagreed with the drawing
  // (13 October 2026; tests/solid-colliders.test.mjs).
  const c=Math.cos(home.rotation-h.rotation),s=Math.sin(home.rotation-h.rotation);
  const dx=r.end.x-local.x,dz=r.end.z-local.z;
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  const inside=Math.abs(lx)<home.width/2-.05&&Math.abs(lz)<home.depth/2-.05&&r.end.y<home.y+home.height;
  assert(!inside,'a ball came to rest inside a house');
  assert(Number.isFinite(r.end.x)&&Number.isFinite(r.end.y),'house contact must stay numerically stable');
  assert(r.time<40,'a ball must not get trapped bouncing against a wall');
  tested++;
 }
 assert(tested>0);
});

test('houses cost nothing by default, and only cost a stroke when the rule is on',()=>{
 const w=built();
 const forgiving=w.homes.slice(0,10).map(home=>shotInto(w,home).hazard);
 assert(forgiving.every(x=>x===null),'houses must not penalise until the course says so');
 const strict=generateWorld({seed:'HOMES-QA',biome:'midwest',holes:9,homes:true,homeDensity:100,trees:0,water:0,residentialOB:true});
 assert.equal(strict.homes.length,w.homes.length,'the rule must not move a single house');
 let penalised=0;
 for(const home of strict.homes.slice(0,10))if(shotInto(strict,home).hazard==='Out of bounds')penalised++;
 assert(penalised>0,'with the rule on, reaching a house should cost a stroke');
});

test('houses keep their siting rules, and sit on a foundation that reaches the ground',()=>{
 const w=built();
 for(const home of w.homes){
  // Natural ground a tree could stand on: rough, or since the cartoon
  // overhaul hardpan, native grass, heather or fallen needles.
  assert(allows(w.surface(home.x,home.z),'trees'),`a house on ${w.surface(home.x,home.z)}`);
  assert(home.footing>=.45,'every house needs a foundation deep enough to meet its lowest corner');
  assert(['gable','hip','saltbox','lshape'].includes(home.form));
  assert(w.trees.every(t=>Math.hypot(t.x-home.x,t.z-home.z)>=Math.max(home.width,home.depth)+5));
 }
 // Varied forms, not one stamped shape.
 assert(new Set(w.homes.map(h=>h.form)).size>=3,'houses should not all share one roof form');
});

test('the grass keeps off a house drive, turned with its house, and nowhere else', async () => {
 const {onDrive,driveFrame}=await import('../src/homes.js');
 const h={x:10,z:-20,width:12,depth:9,rotation:.7,trim:.8,garage:true};
 const {gx,gz}=driveFrame(h),c=Math.cos(h.rotation),s=Math.sin(h.rotation);
 // A point in the house's own frame, out to the world as homes.js turns it.
 const world=(lx,lz)=>[h.x+lx*c+lz*s,h.z-lx*s+lz*c];
 const test=onDrive([h,{...h,x:500,garage:false}]);
 assert.ok(test(...world(gx,gz)),'the drive\'s middle');
 assert.ok(test(...world(gx+1.5,gz-4.3)),'near a corner');
 assert.ok(!test(...world(gx+3,gz)),'beside it');
 assert.ok(!test(...world(0,0)),'the house itself');
 assert.ok(!test(500+gx,gz),'a house with no garage has no drive');
 assert.ok(!onDrive([])(0,0)&&!onDrive(undefined)(0,0));
});
