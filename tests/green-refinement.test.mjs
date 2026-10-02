import test from 'node:test';
import assert from 'node:assert/strict';
import {cupCapture,simulateShot,R,CUP_RADIUS,YARD} from '../src/physics.js';
import {makeGroundGrid,groundHeight} from '../src/terrain-grid.js';
import {groundGeometry} from '../src/ground.js';
import {generateCourse,generateWorld,fairwayWidth,greenDistance} from '../src/course.js';
import {planCourse, PAR_YARDS, greenGradient} from '../src/course-plan.js';
import {slopeColor,createGreenReading} from '../src/green-reading.js';
import {mapLayout,mapPoint,mapPosition} from '../src/course-map.js';
const flat={height:()=>0,surface:()=> 'green',bounds:{x:100,minZ:-100,maxZ:100},trees:[],pin:{x:0,z:0}};
const shot={origin:{x:0,z:-1},aim:0,hla:0,vla:0,spin:0,spinAxis:0,speed:.8};
test('slow balls over the cup fall from the full opening, including a stationary edge leave',()=>{
 for(const x of [.034,.044,.049,-.044]){const result=simulateShot({...shot,origin:{x,z:0},speed:.001},flat);assert(result.holed,`${x} should drop`);assert(result.end.y<-.08);assert(result.points.some(p=>p.y<0&&p.y>result.end.y));}
 assert(!simulateShot({...shot,origin:{x:CUP_RADIUS+.001,z:0},speed:0},flat).holed);
 // Released rolling: a ball struck at 0.25 m/s skids to a stop in 34 mm and
 // never reaches a cup 80 mm away, which is a fact about the launch and not
 // about the opening this test is checking.
 for(const dt of [1/120,1/240,1/480]){const r=simulateShot({...shot,origin:{x:.045,z:-.08},speed:.25,roll:.25},flat,{dt});assert(r.holed);}
});
test('capture speed decreases toward the lip and fast putts still miss',()=>{
 const pin=flat.pin;assert(cupCapture([0,R,-.1],[0,R,.1],[0,0,1.5],pin));assert(!cupCapture([0,R,-.1],[0,R,.1],[0,0,1.8],pin));assert(cupCapture([.045,R,-.1],[.045,R,.1],[0,0,.3],pin));assert(!cupCapture([.045,R,-.1],[.045,R,.1],[0,0,.8],pin));assert(!simulateShot({...shot,speed:3},flat).holed);
});
test('adaptive bunker mesh has shared seam vertices, no cracks, and matching contact heights',()=>{
 const sample=(x,z)=>3+Math.sin(x*.5)*Math.cos(z*.4),g=makeGroundGrid(sample,12,12,3,(x,z)=>Math.hypot(x,z)<5),geometry=groundGeometry(g),p=geometry.attributes.position,index=geometry.index,edges=new Map();
 for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((a,k)=>a+p.getX(k),0)/3,z=ids.reduce((a,k)=>a+p.getZ(k),0)/3,y=ids.reduce((a,k)=>a+p.getY(k),0)/3;assert(Math.abs(groundHeight(g,x,z,sample)-y)<.00001);for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}}
 for(const[key,count]of edges){assert(count<=2);if(count===1){const[a,b]=key.split(',').map(Number);assert((Math.abs(p.getX(a))===12&&p.getX(a)===p.getX(b))||(Math.abs(p.getZ(a))===12&&p.getZ(a)===p.getZ(b)));}}
 geometry.dispose();
});
test('par totals stay bounded while length and seeded par order remain variable',()=>{
 for(const n of [9,18]){let short,long;const sequences=new Set();for(let i=0;i<15;i++){for(const average of [110,300,360,470]){const p=planCourse({holes:n,courseYards:n*average,seed:'PAR'+i});assert(p.par>=n*34/9&&p.par<=n*4);if(average===110)short=p;if(average===470)long=p;if(average===360)sequences.add(p.holes.map(h=>h.par).join(','));}}assert.equal(short.par,n*34/9);assert.equal(long.par,n*4);assert(sequences.size>8);}
});
// NO HOLE MAY LEAVE ITS PAR'S RANGE. This is the guarantee the old model did
// not make: it jittered a base length by a quarter either way and then scaled
// every hole by one factor to hit the course total, so a par 5 could reach 803
// yards at an ordinary 7,400-yard target -- past the USGA's own ceiling for
// calling a hole a par 5 at all -- and the par 4s shrank to pay for it.
test('every hole lands inside its par band, at every length',()=>{
 for(const n of [9,18])for(let i=0;i<25;i++)for(const average of [110,290,360,410,470]){
  const p=planCourse({holes:n,courseYards:n*average,seed:'BAND'+i});
  for(const h of p.holes){
   const b=PAR_YARDS[h.par];
   assert(h.yards>=b.min-.001&&h.yards<=b.max+.001,
    `par ${h.par} at ${h.yards.toFixed(0)} yd is outside ${b.min}-${b.max}`);
  }
 }
});
// The requested length is honoured exactly wherever the bands can reach it, and
// clamped to the nearest reachable total where they cannot -- rather than every
// hole being stretched or squeezed out of shape to make the number come out.
test('the course is the length it was asked for, or says what it could reach',()=>{
 for(const n of [9,18])for(let i=0;i<12;i++)for(const average of [110,300,360,410,470]){
  const asked=n*average,p=planCourse({holes:n,courseYards:asked,seed:'REACH'+i});
  const lo=p.holes.reduce((v,h)=>v+PAR_YARDS[h.par].min,0);
  const hi=p.holes.reduce((v,h)=>v+PAR_YARDS[h.par].max,0);
  const want=Math.min(hi,Math.max(lo,asked));
  assert(Math.abs(p.yards-want)<2,`asked ${asked}, reachable ${want.toFixed(0)}, built ${p.yards}`);
  assert.equal(p.requested,asked);
 }
});
// An eighteen splits its par evenly and does not stack its short holes on one
// nine. Both nines are 34 to 38 on a par-68-to-72 course, which is what an
// even split allows once an odd count has to go somewhere.
test('an eighteen spreads its par across both nines',()=>{
 for(let i=0;i<40;i++){
  const p=planCourse({holes:18,courseYards:6800,seed:'NINE'+i});
  assert.equal(p.front+p.back,p.par,'the nines have to add up to the card');
  assert(Math.abs(p.front-p.back)<=2,`front ${p.front} back ${p.back}`);
  for(const par of [3,5]){
   const f=p.holes.slice(0,9).filter(h=>h.par===par).length;
   const b=p.holes.slice(9).filter(h=>h.par===par).length;
   assert(Math.abs(f-b)<=1,`${(p.counts[par]||0)} par ${par}s split ${f}/${b}`);
  }
 }
});
// Back-to-back par 3s or par 5s are what a seeded shuffle produces and a real
// routing avoids. Not forbidden outright -- a hill-climb on a fixed budget
// cannot promise that -- but they should be rare rather than ordinary.
test('short and long holes are spaced out rather than stacked',()=>{
 let adjacent=0,courses=200;
 for(let i=0;i<courses;i++){
  const p=planCourse({holes:18,courseYards:6800,seed:'SPACE'+i}).holes.map(h=>h.par);
  for(let k=1;k<p.length;k++)if(p[k]===p[k-1]&&p[k]!==4)adjacent++;
 }
 assert(adjacent/courses<.35,`${(adjacent/courses).toFixed(2)} adjacent pairs per course`);
});
// The plan is the seed's, and nothing else's.
test('a plan is reproducible from its seed',()=>{
 for(const seed of ['EVERGREEN','x','1234']){
  const a=planCourse({holes:18,courseYards:6800,seed}),b=planCourse({holes:18,courseYards:6800,seed});
  assert.deepEqual(a.holes,b.holes);
  assert.notDeepEqual(a.holes,planCourse({holes:18,courseYards:6800,seed:seed+'!'}).holes);
 }
});
test('par threes get a green approach, not a fairway, and keep their hazards',()=>{
 const holes=Array.from({length:90},(_,i)=>generateCourse({seed:'APPROACH'+i},i%9));
 const short=holes.filter(h=>h.par===3),long=holes.filter(h=>h.par!==3);
 assert(short.length>8&&long.length>8,'this fixture needs both');
 // Longer holes are untouched: mown turf still begins where the hazard zone does.
 for(const h of long)assert.equal(h.mowStart,h.fairwayStart);
 let bunkered=0;
 for(const h of short){
  const back=Math.max(...Object.values(h.tees).map(t=>t.z));
  assert(h.mowStart>back+16,'a par three approach must clear the tee complex');
  assert(h.mowStart>=h.length*.55,'an approach must not cover more than the last 45% of the hole');
  // Nothing mown between the tees and the approach.
  for(const z of [back+10,(back+h.mowStart)/2,h.mowStart-6])assert.equal(fairwayWidth(h,z,0,0),0,`turf at ${z} on a par three`);
  // The approach is an apron on the green, never wider than the green itself.
  const green=h.greenSize*h.greenAspect;
  for(let z=h.mowStart;z<=h.length;z+=4)assert(fairwayWidth(h,z,0,0)<=green*.95+1e-9,'approach wider than its green');
  assert(fairwayWidth(h,h.length-20,0,0)>4,'the approach must actually be mown');
  // fairwayStart still anchors hazards, so par threes are not stripped of them.
  if(h.bunkers.length)bunkered++;
 }
 assert(bunkered>short.length*.5,'par threes must keep their bunkers');
});
test('no tee stands in the fairway, and forward tee offsets vary on both sides of the line',()=>{
 const holes=Array.from({length:60},(_,i)=>generateCourse({seed:'TEE'+i},i%9)),short=holes.filter(h=>h.par===3);assert(short.length>0,'this fixture needs par threes');
 // Par threes used to start their fairway behind the tees, which left the pads
 // standing in mown fairway turf instead of on their own ground.
 for(const h of holes){const back=Math.max(...Object.values(h.tees).map(t=>t.z));assert(h.fairwayStart>back,`hole ${h.hole} par ${h.par} starts its fairway at ${h.fairwayStart}, behind a tee at ${back}`);for(const t of Object.values(h.tees))assert.equal(h.surface(t.x,t.z),'tee');}
 const offsets=holes.flatMap(h=>['white','red'].map(t=>h.tees[t].x-h.center(h.tees[t].z)));assert(offsets.some(v=>v>1));assert(offsets.some(v=>v< -1));
});
test('hole maps fit wide doglegs and project/unproject the exact same coordinates',()=>{
 for(let i=0;i<18;i++){const h=generateCourse({seed:'MAP',holes:18,width:70,doglegs:100,doglegAngle:70},i),m=mapLayout(h,120,300);for(let j=0;j<=100;j++){const z=h.fairwayStart+(h.length-h.fairwayStart)*j/100;for(const side of [-1,1]){const p={x:h.center(z)+side*fairwayWidth(h,z,h.settings.semiRough,side),z},q=mapPoint(m,p),r=mapPosition(m,...q);assert(q[0]>=0&&q[0]<=120&&q[1]>=0&&q[1]<=300);assert(Math.hypot(p.x-r.x,p.z-r.z)<1e-8);}}assert(mapPoint(m,{x:1,z:0})[0]<mapPoint(m,{x:-1,z:0})[0]);}
});
test('the slope grid and its flow are one surface that knows the green, and squares to a heading',()=>{
 const w=generateWorld({seed:'READING',trees:0,water:0,bunkerCount:0,greenDifficulty:85}),h=w.holes[0];
 assert.equal(new Set([.005,.015,.025,.04,.06].map(v=>slopeColor(v).getHex())).size,5);
 const reading=createGreenReading(h);assert(reading.grid&&reading.flow&&reading.heatmap&&reading.surface);
 for(const item of [reading.grid,reading.flow,reading.heatmap])assert.equal(item.parent,reading.group);
 // Every vertex on the green carries the putting surface's own slope, and its
 // fall direction really is downhill.
 const g=reading.surface.geometry,pos=g.attributes.position,slope=g.attributes.slope,fall=g.attributes.fall,inside=g.attributes.inside;
 let checked=0,steep=0;
 for(let k=0;k<pos.count;k+=37){
  if(inside.getX(k)>-.5)continue;
  const local=h.toLocal({x:pos.getX(k),z:pos.getZ(k)}),grad=greenGradient(h,local.x,local.z);
  assert(Math.abs(slope.getX(k)-Math.hypot(grad.x,grad.z))<1e-6);
  if(slope.getX(k)<.01)continue;
  const step=.2,ahead=h.toLocal({x:pos.getX(k)+fall.getX(k)*step,z:pos.getZ(k)+fall.getY(k)*step});
  assert(h.height(ahead.x,ahead.z)<h.height(local.x,local.z),'fall points uphill');
  checked++;if(slope.getX(k)>.03)steep++;
 }
 assert(checked>50&&steep>0,`checked ${checked} points, ${steep} steep`);
 // The two buttons are two switches on the one surface.
 const u=reading.surface.material.uniforms;
 reading.grid.visible=false;reading.flow.visible=false;assert.equal(reading.surface.visible,false);
 reading.flow.visible=true;assert.equal(u.showFlow.value,1);assert.equal(u.showLines.value,0);assert(reading.surface.visible);
 reading.grid.visible=true;assert.equal(u.showLines.value,1);
 // Square to a heading when given one; the hole's axes otherwise, or when the
 // camera looks straight down.
 reading.update(2,{x:3,z:4});assert(Math.abs(u.axis.value.x-.6)<1e-9&&Math.abs(u.axis.value.y-.8)<1e-9);assert.equal(u.time.value,2);
 const w0=h.toWorld({x:0,z:0}),wz=h.toWorld({x:0,z:1}),l=Math.hypot(wz.x-w0.x,wz.z-w0.z);
 reading.update(3,null);assert(Math.abs(u.axis.value.x-(wz.x-w0.x)/l)<1e-9&&Math.abs(u.axis.value.y-(wz.z-w0.z)/l)<1e-9);
 reading.update(4,{x:0,z:0});assert(Math.abs(u.axis.value.x-(wz.x-w0.x)/l)<1e-9);
});
