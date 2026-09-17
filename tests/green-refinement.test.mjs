import test from 'node:test';
import assert from 'node:assert/strict';
import {cupCapture,simulateShot,R,CUP_RADIUS,YARD} from '../src/physics.js';
import {makeGroundGrid,groundHeight} from '../src/terrain-grid.js';
import {groundGeometry} from '../src/ground.js';
import {generateCourse,generateWorld,fairwayWidth,greenDistance} from '../src/course.js';
import {planCourse} from '../src/course-plan.js';
import {greenFlowPaths,slopeColor,createGreenReading} from '../src/green-reading.js';
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
 for(const n of [9,18]){let short,long;const sequences=new Set();for(let i=0;i<15;i++){for(const average of [110,300,360,470]){const p=planCourse({holes:n,courseYards:n*average,seed:'PAR'+i});assert(p.par>=n*34/9&&p.par<=n*4);assert(Math.abs(p.holes.reduce((a,h)=>a+h.yards,0)-n*average)<.001);if(average===110)short=p;if(average===470)long=p;if(average===360)sequences.add(p.holes.map(h=>h.par).join(','));}}assert.equal(short.par,n*34/9);assert.equal(long.par,n*4);assert(sequences.size>8);}
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
test('green markers originate at grid vertices, follow descending terrain, and tools coexist',()=>{
 const w=generateWorld({seed:'READING',trees:0,water:0,bunkerCount:0,greenDifficulty:85}),h=w.holes[0],paths=greenFlowPaths(h);assert(paths.length>100);
 for(const{path}of paths){const p=path[0];assert(Math.abs((p.x-h.pin.x)/1.5-Math.round((p.x-h.pin.x)/1.5))<1e-8);assert(Math.abs((p.z-h.pin.z)/1.5-Math.round((p.z-h.pin.z)/1.5))<1e-8);for(let i=1;i<path.length;i++)assert(h.height(path[i].x,path[i].z)<=h.height(path[i-1].x,path[i-1].z)+.0001);}
 assert.equal(new Set([.005,.015,.025,.04,.06].map(v=>slopeColor(v).getHex())).size,5);
 const reading=createGreenReading(h);assert(reading.grid&&reading.flow&&reading.heatmap);for(const item of [reading.grid,reading.flow,reading.heatmap]){item.visible=true;assert.equal(item.parent,reading.group);}reading.update(0);const p=reading.flow.geometry.attributes.position;const first=h.toWorld(paths[0].path[0]);assert(Math.abs(p.getX(0)-first.x)<.0001);assert(Math.abs(p.getZ(0)-first.z)<.0001);reading.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
