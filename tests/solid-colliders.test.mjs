import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {simulateShot,R} from '../src/physics.js';

// Houses and flagsticks are hit where they are drawn (13 October 2026).
// Every shot here is fired through simulateShot, the same call the game makes,
// at points defined in the HOUSE'S OWN frame as homes.js draws it -- so a
// collider turned or raised differently from the drawing fails here.
const world=generateWorld({seed:'HOMES-QA',biome:'midwest',holes:9,homes:true,homeDensity:100,trees:0,water:0});
const holeOf=home=>world.holes.find(h=>h.hole===home.hole);
// House frame -> world, as three.js turns a group by rotation.y.
const frame=home=>{const c=Math.cos(home.rotation),s=Math.sin(home.rotation);return (x,z)=>({x:home.x+x*c+z*s,z:home.z-x*s+z*c});};
// A level, spinless shot from `from` toward `to` (world), launched `height`
// above the turf. Flat and fast so it crosses a house's width still in the air.
function fire(hole,from,to,height,options={}){
 const a=hole.toLocal(from),b=hole.toLocal(to);
 return simulateShot({origin:{x:a.x,z:a.z},aim:Math.atan2(b.x-a.x,b.z-a.z)*180/Math.PI,hla:0,vla:0,speed:40,spin:0,spinAxis:0,height},hole,options);
}
// Houses on holes that do not run due north: the case the old collider got wrong.
const turned=world.homes.filter(h=>Math.abs(Math.sin(holeOf(h).rotation))>.3);

test('a house is hit at the corners where it is drawn, on a turned hole',()=>{
 assert(turned.length>=8,`only ${turned.length} houses on turned holes`);
 let hit=0,n=0;
 for(const home of turned){const at=frame(home),hole=holeOf(home);
  for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
   // Aim along the house's long axis just inside a corner, from 10 m out.
   const z=sz*(home.depth/2-.6),r=fire(hole,at(sx*(home.width/2+10),z),at(0,z),2);
   n++;if(r.homeHits>0)hit++;
  }}
 assert(hit/n>.97,`${hit} of ${n} shots into a drawn corner hit the house`);
});

test('a ball passing just outside a house\'s wall does not touch it',()=>{
 let clear=0,n=0;
 for(const home of turned){const at=frame(home),hole=holeOf(home);
  for(const sz of [1,-1]){
   // Parallel to the long wall, 0.6 m outside it, the full length and more.
   const z=sz*(home.depth/2+.6),r=fire(hole,at(-home.width/2-10,z),at(home.width/2+10,z),2);
   n++;if(r.homeHits===0)clear++;
  }}
 assert(clear/n>.97,`${n-clear} of ${n} shots past a wall struck it anyway`);
});

test('the house collider ends at the drawn roof, not above it',()=>{
 let clear=0,n=0;
 for(const home of turned){const at=frame(home),hole=holeOf(home);
  // Straight over the middle, 0.8 m above the drawn top (measured from the
  // ground under the start so the launch height is right), from the fairway
  // side outward. Not along the street: the next house down it is a real wall,
  // and a long flat shot along the row was hitting it.
  const from=at(0,home.depth/2+6),ground=world.height(from.x,from.z),over=home.y+home.height+.8-ground;
  const a=hole.toLocal(from),b=hole.toLocal(at(0,-home.depth/2-6));
  const r=simulateShot({origin:{x:a.x,z:a.z},aim:Math.atan2(b.x-a.x,b.z-a.z)*180/Math.PI,hla:0,vla:4,speed:45,spin:0,spinAxis:0,height:over},hole,{});
  n++;if(r.homeHits===0)clear++;
 }
 assert(clear/n>.95,`${n-clear} of ${n} balls clearing a roof hit air above it`);
});

test('the flagstick is solid while it is in, and only then',()=>{
 let checked=0;
 for(const hole of world.holes.slice(0,5)){
  const pin=hole.pin,from={x:pin.x,z:pin.z-8};
  // A fast, flat ball straight at the stick, still about a metre up when it
  // gets there (it falls about 0.5 m on the way).
  const shot={origin:from,aim:0,hla:0,vla:0,speed:25,spin:0,spinAxis:0,height:1.5};
  const inHole=simulateShot(shot,hole,{flagsticks:{current:true}});
  const pulled=simulateShot(shot,hole,{flagsticks:{current:false}});
  const none=simulateShot(shot,hole,{});
  assert.equal(inHole.flagHits,1,`hole ${hole.hole}: the stick in the hole was not hit`);
  assert.equal(pulled.flagHits,0,`hole ${hole.hole}: a pulled stick was hit`);
  assert.equal(none.flagHits,0,`hole ${hole.hole}: a stick was hit with flagsticks off`);
  assert.equal(inHole.treeHits,0,'a flagstick strike counted as a tree');
  // It bounced back off the stick: the ball ends short of where it would have.
  assert(inHole.end.z<pulled.end.z-1,`hole ${hole.hole}: the ball did not rebound (${inHole.end.z.toFixed(1)} vs ${pulled.end.z.toFixed(1)})`);
  checked++;
 }
 assert.equal(checked,5);
 assert(R>0);
});
