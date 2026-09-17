import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {generateWorld,fairwayWidth} from '../src/course.js';
import {downhillProfile,addStreams} from '../src/streams.js';
import {fairwayAim,fairwayMiddle,teeAim,cameraInsideTree,makeHoleTour,MENU_ORBIT_RATE,FLYOVER_RATE} from '../src/camera-tours.js';
let world;const getWorld=()=>world??=generateWorld({seed:'LAKE-QA',biome:'midwest',holes:9,lakes:2,lakeSize:140,water:0,trees:0,rivers:1,creeks:1,elevation:20});
test('channels descend without raised water or abrupt longitudinal grades in either direction',()=>{
 for(const sign of [-1,1]){const height=(x,z)=>30+sign*z*.02+Math.sin(z/35)*4,points=Array.from({length:101},(_,i)=>({x:0,z:i*10,nx:1,nz:0,width:8}));const {path}=downhillProfile(points,height);
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],distance=Math.hypot(b.x-a.x,b.z-a.z),slope=(a.level-b.level)/distance;assert(slope>=.00015-1e-9&&slope<=.025+1e-9);assert(b.level<=height(b.x,b.z)-.199);assert(Math.abs(b.nx-(b.z-a.z)/distance)<1e-8);}
 }
});
test('channels clear every bunker and never bend tighter than their own bank strip',()=>{
 const w=getWorld();assert(w.streams.streams.length>0);
 const bunkers=w.holes.flatMap(h=>h.bunkers.map(b=>({...h.toWorld(b),r:Math.max(b.rx,b.rz)})));
 assert(bunkers.length>0,'this fixture needs bunkers to be a meaningful test');
 let tightest=Infinity,closest=Infinity;
 for(const s of w.streams.streams){const p=s.points;
  for(let i=1;i<p.length-1;i++){
   const a=p[i-1],c=p[i],b=p[i+1],ax=c.x-a.x,az=c.z-a.z,bx=b.x-c.x,bz=b.z-c.z;
   const turn=Math.abs(Math.atan2(ax*bz-az*bx,ax*bx+az*bz));if(turn<1e-9)continue;
   // A bend tighter than the offset half-width folds the inner bank through
   // itself, which is what left the painted bed disagreeing with the water edge.
   tightest=Math.min(tightest,Math.min(Math.hypot(ax,az),Math.hypot(bx,bz))/turn/(c.width*.5*(c.miter||1)));
  }
  for(const q of p){if(Math.abs(q.x)>w.halfX||Math.abs(q.z)>w.halfZ)continue;
   for(const b of bunkers)closest=Math.min(closest,Math.hypot(q.x-b.x,q.z-b.z)-b.r-q.width*.5);}
 }
 assert(tightest>1,`tightest bend is ${tightest.toFixed(2)}x the half width`);
 assert(closest>0,`water reaches ${closest.toFixed(1)} m into a bunker`);
});
test('each channel draws its own bearing instead of an offset copy of one curve',()=>{
 let spread=0,pairs=0;
 for(const seed of ['CHAN-2','CHAN-3','EVERGREEN','WANDER-42']){
  const w=generateWorld({seed,biome:'midwest',holes:9,water:0,trees:0,rivers:1,creeks:1,streamBends:60});
  const bearings=w.streams.streams.map(s=>{const p=s.points;return (Math.atan2(p.at(-1).x-p[0].x,p.at(-1).z-p[0].z)*180/Math.PI+360)%180;});
  for(let i=0;i<bearings.length;i++)for(let j=i+1;j<bearings.length;j++){const d=Math.abs(bearings[i]-bearings[j]);spread+=Math.min(d,180-d);pairs++;}
 }
 // A tight course can drop a requested channel, so not every seed yields a pair.
 assert(pairs>=3,`only ${pairs} river/creek pairs were generated`);
 // A single shared course-wide bearing put every pair within a degree or two.
 assert(spread/pairs>8,`mean bearing difference is only ${(spread/pairs).toFixed(1)} deg`);
});
test('large lakes have lake-sized footprints, submerged beds, mapped ownership, and protected playing features',()=>{
 const w=getWorld();assert.equal(w.largeLakes.length,2);
 for(const {h,p} of w.largeLakes){assert(p.rx*2>80&&p.rz*2>80);const q=h.toWorld(p);assert.equal(w.surface(q.x,q.z),'water');assert.equal(w.lakeOwner(q.x,q.z),h);assert(w.height(q.x,q.z)<p.level-.2);assert(h.ponds.length<=4);}
 for(const h of w.holes){assert.equal(h.surface(h.pin.x,h.pin.z),'green');for(const tee of Object.values(h.tees))assert.equal(h.surface(tee.x,tee.z),'tee');}
});
test('reflective channel geometry faces upward and agrees with channel water levels',()=>{
 const w=getWorld();assert.equal(w.streams.streams.length,2);let count=0;addStreams({world:w,addWaterBody(g,level,depth,center,ocean,path){count++;assert(path.length>50);const pos=g.attributes.position,norm=g.attributes.normal,shore=g.attributes.shore;
 // Three vertices per station: left bank, centre, right bank. The bank weight
 // drives the waterline alpha feather, so it must stay 1/0/1 across the strip.
 assert.equal(pos.count,path.length*3);
 for(let i=0;i<pos.count;i++){assert(norm.getZ(i)>.5,'water must face above the terrain');assert(Math.abs(pos.getZ(i)+level-path[Math.floor(i/3)].level)<1e-5);assert.equal(shore.getX(i),[1,0,1][i%3]);}g.dispose();}});assert.equal(count,2);
});
test('tee markers square up to the fairway, not to the pin',()=>{
 const w=generateWorld({seed:'BRIDGE-SHOW',biome:'autumn',holes:9,courseYards:3660,doglegs:37,doglegAngle:35,width:50,trees:0,water:0});
 const deg=r=>r*180/Math.PI;
 let turned=0;
 for(const h of w.holes){
  const target=teeAim(h);
  // Markers are squared to real mown ground, never to a point in the rough.
  assert(['fairway','semi'].includes(h.surface(target.x,target.z)),
   `hole ${h.hole+1} squares its tees at ${h.surface(target.x,target.z)}`);
  assert(target.z>Math.max(...Object.values(h.tees).map(t=>t.z)),'the target must lie ahead of every tee');
  for(const t of Object.values(h.tees)){
   const dx=target.x-t.x,dz=target.z-t.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
   // The pair straddles the line of play, so it must be perpendicular to it.
   const pair=[-4,4].map(side=>({x:t.x+uz*side-ux,z:t.z-ux*side-uz}));
   const bx=pair[1].x-pair[0].x,bz=pair[1].z-pair[0].z,span=Math.hypot(bx,bz);
   assert(Math.abs(bx*ux+bz*uz)/span<1e-9,'markers must sit square to the line of play');
   assert(Math.abs(span-8)<1e-9,`marker span drifted to ${span}`);
  }
  const t=h.tees.blue,aim=deg(Math.atan2(target.x-t.x,target.z-t.z)),pin=deg(Math.atan2(h.pin.x-t.x,h.pin.z-t.z));
  if(Math.abs((aim-pin+540)%360-180)>5)turned++;
 }
 assert(turned>=2,'doglegs must square away from the pin');
 // The middle sits between the two edges, which vary independently.
 for(const h of w.holes)for(const z of [h.length*.4,h.length*.6]){
  const mid=fairwayMiddle(h,z),left=h.center(z)-fairwayWidth(h,z,0,-1),right=h.center(z)+fairwayWidth(h,z,0,1);
  if(right>left)assert(mid>=left-1e-9&&mid<=right+1e-9,`middle ${mid} outside [${left}, ${right}]`);
 }
 // The shot aim is a separate rule: it follows the fairway out to club range.
 for(const h of w.holes){
  const target=fairwayAim(h,h.tees.blue,250*.9144);
  assert(!['rough','water'].includes(h.surface(target.x,target.z)),
   `hole ${h.hole+1} aims at ${h.surface(target.x,target.z)}`);
 }
});
test('default aim follows the fairway through bends and targets the pin on the green',()=>{
 const h={length:420,center:z=>Math.max(0,z-100)*.8,pin:{x:256,z:420},surface:()=> 'fairway'};const target=fairwayAim(h,{x:0,z:0},220);assert.equal(target.x,h.center(target.z));assert(target.z<300);assert(Math.abs(target.x/target.z-h.pin.x/h.pin.z)>.1);
 assert.deepEqual(fairwayAim({...h,surface:()=> 'green'},h.pin,10),h.pin);assert.deepEqual(fairwayAim(h,{x:245,z:405},35),h.pin);
});
test('the flyover circles the whole hole, once, at one and a half times the menu camera',()=>{
 // It is the main menu's camera put over a hole you are playing. Same framing,
 // half again the speed -- it used to run up the fairway and then orbit the
 // green, which showed the hole a piece at a time and never its shape.
 assert.ok(Math.abs(FLYOVER_RATE-MENU_ORBIT_RATE*1.5)<1e-12,'the flyover is 1.5x the menu orbit');
 const h=getWorld().holes[0],tour=makeHoleTour(h);
 assert.ok(Math.abs(tour.duration-Math.PI*2/FLYOVER_RATE)<1e-9,'one lap, then it is done');
 // A circle about the middle of the hole, at a constant radius from it.
 const mid=h.toWorld({x:h.center(h.length*.5),z:h.length*.5});
 for(let t=0;t<=tour.duration;t+=.5){
  const p=tour.pose(t);
  assert.ok([p.eye.x,p.eye.y,p.eye.z,p.target.x,p.target.y,p.target.z].every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(p.eye.x-mid.x,p.eye.z-mid.z)-tour.radius)<.01,'the orbit keeps its radius');
  assert.ok(Math.hypot(p.target.x-mid.x,p.target.z-mid.z)<.01,'and keeps looking at the hole');
 }
 // Continuous: no step big enough to read as a jump, including where the ring
 // rises over a ridge.
 for(let t=0;t<tour.duration;t+=.1)assert.ok(tour.pose(t).eye.distanceTo(tour.pose(t+.1).eye)<12,`jumped at ${t.toFixed(1)}s`);
 // It closes, and it ends.
 assert.ok(tour.pose(0).eye.distanceTo(tour.pose(tour.duration).eye)<1e-6,'the lap closes on itself');
 assert.ok(!tour.pose(tour.duration-.5).done&&tour.pose(tour.duration).done);
});

test('the flyover never flies through the ground or the trees',()=>{
 // A wide circle of a hole cut into a hillside will pass straight through the
 // hill unless the ring is lifted over it, and a canopy standing a few metres
 // off the flight line still gets in the way. Both are checked on the worst
 // terrain the generator makes: full mountain, and a forest at full planting.
 for(const extra of [{biome:'mountain',elevation:100,landform:100,trees:40},{trees:100,elevation:60}]){
  const w=generateWorld({seed:'SHOULDERS',holes:9,water:0,homes:false,...extra});
  let ground=Infinity,canopy=Infinity;
  for(const h of w.holes){
   const tour=makeHoleTour(h);
   for(let t=0;t<=tour.duration;t+=.25){
    const eye=tour.pose(t).eye;
    ground=Math.min(ground,eye.y-w.height(eye.x,eye.z));
    for(const tree of w.trees)
     if(Math.hypot(eye.x-tree.x,eye.z-tree.z)<tree.r+2)canopy=Math.min(canopy,eye.y-(tree.y+tree.h));
   }
  }
  assert.ok(ground>20,`the flyover came within ${ground.toFixed(1)} m of the ground`);
  assert.ok(canopy>4,`the flyover came within ${canopy.toFixed(1)} m of a treetop`);
 }
});
test('camera/tree clearance hides an enclosing canopy but preserves distant and overhead trees',()=>{
 const tree={x:20,z:30,y:5,h:18,r:5};assert(cameraInsideTree(new T.Vector3(20,15,30),tree));assert(cameraInsideTree(new T.Vector3(28,18,30),tree));assert(!cameraInsideTree(new T.Vector3(50,15,30),tree));assert(!cameraInsideTree(new T.Vector3(20,40,30),tree));assert(!cameraInsideTree(new T.Vector3(20,0,30),tree));
});
