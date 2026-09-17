import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld,greenRadius,fairwayWidth,BIOMES} from '../src/course.js';
import {playerCameraPose} from '../src/camera.js';
import {localReliefField,RELIEF_RADIUS} from '../src/ground.js';
const delta=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
test('whole courses generate 9 or 18 persistent, distinct holes',()=>{for(const count of [9,18]){const w=generateWorld({seed:'TEST',holes:count});assert.equal(w.holes.length,count);assert.equal(new Set(w.holes.map(h=>JSON.stringify(h.origin))).size,count);for(const h of w.holes){assert.equal(h.world,w);assert.equal(h.surface(h.pin.x,h.pin.z),'green');assert.equal(h.surface(0,0),'tee');assert(Number.isFinite(h.height(0,0)));const p={x:12,z:210},q=h.toLocal(h.toWorld(p));assert(Math.abs(p.x-q.x)<1e-9&&Math.abs(p.z-q.z)<1e-9);}}});
test('all biome surfaces and world terrain agree at local coordinates',()=>{for(const biome of Object.keys(BIOMES)){const w=generateWorld({biome,holes:9});for(const h of w.holes){for(const p of [h.pin,h.tee,{x:25,z:80}]){const q=h.toWorld(p);assert.equal(h.height(p.x,p.z),w.height(q.x,q.z));assert.equal(h.surface(p.x,p.z),w.surface(q.x,q.z));}}for(const [x,z]of [[0,0],[w.halfX+300,w.halfZ+300],[-w.halfX-300,-w.halfZ-300]])assert(Number.isFinite(w.height(x,z)));}});
test('fringe and semi-rough widths control actual playable boundaries',()=>{for(const [fringe,semiRough]of [[0,0],[2,6],[6,15]]){const w=generateWorld({fringe,semiRough,water:0,trees:0,bunkerCount:0}),h=w.holes[0],radius=greenRadius(h,0),sample=d=>h.surface(h.green.x+(radius+d)*1.17,h.green.z);assert.equal(sample(-.1),'green');if(fringe>0)assert.equal(sample(fringe*.5),'fringe');if(semiRough>0)assert.equal(sample(fringe+semiRough*.5),'semi');const z=120,x=h.center(z)+fairwayWidth(h,z,0,1);assert.equal(h.surface(x-.1,z),'fairway');if(semiRough>0)assert.equal(h.surface(x+semiRough*.5,z),'semi');}});
test('lateral camera offset translates eye and target without changing view direction',()=>{const w=generateWorld({holes:18});for(const h of [w.holes[0],w.holes[1],w.holes[17]])for(const aim of [-35,0,65]){const p={x:2,z:50},config={height:8,distance:22,offset:0},center=playerCameraPose(h,p,aim,config);for(const offset of [-20,10,20]){const side=playerCameraPose(h,p,aim,{...config,offset}),a=delta(center.target,center.eye),b=delta(side.target,side.eye);for(const k of ['x','y','z'])assert(Math.abs(a[k]-b[k])<1e-9);assert(Math.abs(Math.hypot(side.eye.x-center.eye.x,side.eye.z-center.eye.z)-Math.abs(offset))<1e-9);}}});
test('world layout and vegetation are reproducible from a seed',()=>{const a=generateWorld({seed:'REPLAY',holes:18}),b=generateWorld({seed:'REPLAY',holes:18});assert.deepEqual(a.trees,b.trees);assert.deepEqual(a.holes.map(h=>h.worldPin),b.holes.map(h=>h.worldPin));});

// Local relief: the cue that shows undulation when the sun is too high to cast
// a useful shadow. Baked once at generation, so it is testable without a GPU.
test('local relief marks crowns and hollows, and nothing on a plane',()=>{
 const flat={nx:40,nz:40,dx:3,dz:3,halfX:60,halfZ:60,values:new Float32Array(41*41)};
 const {field}=localReliefField(flat,15);
 for(const v of field)assert(Math.abs(v)<1e-6,'a plane must not be shaded at all');

 // A single smooth rise in the middle of an otherwise flat field.
 const bump={...flat,values:new Float32Array(41*41)};
 for(let j=0;j<=40;j++)for(let i=0;i<=40;i++){
  const x=(i-20)*3,z=(j-20)*3,r=Math.hypot(x,z);
  bump.values[j*41+i]=Math.max(0,4*Math.cos(Math.min(Math.PI/2,r/40*Math.PI/2)));
 }
 const out=localReliefField(bump,15).field;
 const at=(i,j)=>out[j*41+i];
 assert(at(20,20)>.3,`the crown should lift, got ${at(20,20).toFixed(3)}`);
 // Somewhere on the apron around the rise the ground sits below its own
 // neighbourhood, which is what a hollow is.
 let lowest=1;for(let k=0;k<out.length;k++)lowest=Math.min(lowest,out[k]);
 assert(lowest<-.2,`nothing read as a hollow, lowest was ${lowest.toFixed(3)}`);
});

test('local relief is normalised, so one gorge cannot flatten a course',()=>{
 // Scaled by the 90th percentile rather than the maximum: a single cliff must
 // not push every fairway roll to zero.
 const g={nx:60,nz:60,dx:3,dz:3,halfX:90,halfZ:90,values:new Float32Array(61*61)};
 for(let j=0;j<=60;j++)for(let i=0;i<=60;i++)g.values[j*61+i]=Math.sin(i/4)*0.8+Math.cos(j/5)*0.8;
 const before=localReliefField(g,15);
 const spread=v=>{let lo=9,hi=-9;for(const x of v)
  {lo=Math.min(lo,x);hi=Math.max(hi,x);}return hi-lo;};
 assert(spread(before.field)>1,'gentle rolls have to use the range');
 // Now drop a cliff into one corner and check the rolls survive it.
 for(let j=0;j<=3;j++)for(let i=0;i<=3;i++)g.values[j*61+i]=-90;
 const after=localReliefField(g,15);
 assert(spread(after.field)>1,`a cliff flattened the rest: spread ${spread(after.field).toFixed(2)}`);
 assert(after.field.every(v=>v>=-1.0001&&v<=1.0001),'the field has to stay in range');
});

test('the relief radius is the size of thing a golfer reads',()=>{
 // Not a free parameter: at a few metres it picks up surface texture, at tens of
 // metres it picks up landform. Fifteen is the roll.
 assert.equal(RELIEF_RADIUS,15);
});
