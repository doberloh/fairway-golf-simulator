import test from 'node:test';import assert from 'node:assert/strict';
import {generateWorld,generateCourse,DEFAULT_COURSE,random,ovalRadius} from '../src/course.js';
import {FOOTPRINTS,footprintCurve,footprintIcon} from '../src/footprints.js';
import {routeHoles} from '../src/routing.js';
import {replayFinished,shotSettled,SHOT_HOLD_SECONDS,HOLE_REVEAL_MS,shotDistance} from '../src/presentation.js';
let world;const getWorld=()=>world??=generateWorld({seed:'TFLCsss',biome:'links',holes:9,homes:true,homeDensity:100,rivers:1,creeks:1,trees:20,elevation:75});
test('fourteen footprint options have distinct valid previews and seeded routings',()=>{assert.equal(Object.keys(FOOTPRINTS).length,14);const signatures=new Set();for(const footprint of Object.keys(FOOTPRINTS)){const values=Array.from({length:65},(_,i)=>footprintCurve(footprint,i/64));assert(values.flat().every(Number.isFinite));signatures.add(JSON.stringify(values));assert(footprintIcon(footprint).includes('<polyline'));const s={...DEFAULT_COURSE,seed:'LAYOUT-QA',footprint},holes=Array.from({length:9},(_,i)=>generateCourse(s,i));const bounds=routeHoles(holes,s,random);assert(Number.isFinite(bounds.halfX)&&Number.isFinite(bounds.halfZ));assert(holes.every(h=>Number.isFinite(h.worldPin.x)));}assert.equal(signatures.size,14);});
test('lake levels sit below outer banks and shoreline meshes share their contact profile',()=>{const w=getWorld();let count=0;for(const h of w.holes)for(const p of h.ponds){count++;assert(p.shoreWidth>=14);for(let i=0;i<64;i++){const q=ovalRadius(p,i*Math.PI/32),scale=1+p.shoreWidth/Math.hypot(q.x,q.z),x=p.x+q.x*scale,z=p.z+q.z*scale;assert(h.height(x,z)>=p.level-.45,'water must not be perched above its surrounding bank');}}assert(count>0);});
test('rivers and creeks have real water lies and submerged beds, and protect greens and tees',()=>{const w=getWorld();assert(w.streams.streams.length>=1);let wet=0;
 for(const stream of w.streams.streams)for(const p of stream.points){if(Math.abs(p.x)>w.halfX||Math.abs(p.z)>w.halfZ)continue;
  wet++;assert.equal(w.surface(p.x,p.z),'water');assert(w.height(p.x,p.z)<p.level+.06);}
 assert(wet>30);for(const h of w.holes){assert.equal(h.surface(h.pin.x,h.pin.z),'green');for(const t of Object.values(h.tees))assert.equal(h.surface(t.x,t.z),'tee');}});
test('homes occupy dry gentle rough and keep trees out of their footprints',()=>{const w=getWorld();assert(w.homes.length>0);for(const h of w.homes){assert.equal(w.surface(h.x,h.z),'rough');assert(w.trees.every(t=>Math.hypot(t.x-h.x,t.z-h.z)>=Math.max(h.width,h.depth)+5));}assert.equal(generateWorld({homes:false,trees:0,water:0}).homes.length,0);});
// A CHARACTERISATION TEST, AND IT SAYS SO. This asserted one seed's worst
// green surround was under 0.6, and it passed because SHOULDERS measured 0.582.
// Across eight seeds on these same settings the figures were 0.582, 0.706,
// 0.597, 0.872, 0.676, 0.620, 0.588, 0.647 -- most of them already over the
// line. The 0.6 was never a property of the generator, only of the seed that
// was picked, so the test was giving assurance it had not earned.
//
// Kept multi-seed and pinned to what the generator actually does today, so it
// catches a regression instead of a reshuffle. The intent -- a broad shoulder
// rather than a ridge, on the steepest settings the game offers -- is real and
// NOT currently met; see TODO.md.
test('green surroundings stay within their measured envelope',()=>{
 const seeds=['SHOULDERS','S1','S2','S3','S4','S5','S6','S7'];
 const worst=seeds.map(seed=>{
  const w=generateWorld({seed,biome:'mountain',elevation:100,landform:100,greenDifficulty:0,trees:0,water:0});
  let max=0;
  for(const h of w.holes)for(let a=0;a<Math.PI*2;a+=Math.PI/12){
   const r=h.greenSize*h.greenAspect+7,x=h.green.x+Math.cos(a)*r,z=h.green.z+Math.sin(a)*r;
   max=Math.max(max,Math.hypot(h.height(x+.5,z)-h.height(x-.5,z),h.height(x,z+.5)-h.height(x,z-.5)));}
  return max;});
 const sorted=[...worst].sort((a,b)=>a-b),median=sorted[sorted.length>>1];
 assert(median<.95,`median worst surround slope ${median.toFixed(3)}`);
 assert(Math.max(...worst)<1.35,`steepest surround ${Math.max(...worst).toFixed(3)}`);
});
test('replay end hold and hole reveal both last three seconds, and live distance is horizontal displacement',()=>{assert.equal(HOLE_REVEAL_MS,3000);assert.equal(replayFinished(5,5,2.999),false);assert.equal(replayFinished(4,5,4),false);assert.equal(replayFinished(5,5,3),true);assert.equal(shotDistance({x:0,z:0},{x:3,y:100,z:4}),5);});

test('the camera holds on the ball for three seconds after it stops, and not before',()=>{
 assert.equal(SHOT_HOLD_SECONDS,3);
 // Still flying: the hold has not started, however long it claims to have run.
 assert.equal(shotSettled(2.9,5,9),false);
 // Stopped, but the hold is not up.
 assert.equal(shotSettled(5,5,0),false);
 assert.equal(shotSettled(5,5,2.99),false);
 // Stopped and held.
 assert.equal(shotSettled(5,5,3),true);
 assert.equal(shotSettled(6,5,4),true);
});
