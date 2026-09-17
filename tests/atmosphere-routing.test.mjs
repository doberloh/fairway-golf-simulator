import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse,DEFAULT_COURSE,random,ovalRadius,hazardMetric,hazardProfile,fairwayWidth,greenDistance} from '../src/course.js';
import {routeHoles} from '../src/routing.js';
import {aimTarget,windDrift,localWind} from '../src/shot-visuals.js';

test('par 3 centerlines stay straight at maximum dogleg settings and fairways end inside the green',()=>{
 let count=0;for(let seed=0;seed<20;seed++)for(let i=0;i<18;i++){const h=generateCourse({seed:String(seed),holes:18,doglegs:100,doglegAngle:70},i);if(h.par===3){count++;assert.equal(h.doglegAngle,0);for(let z=0;z<=h.length;z+=2)assert(Math.abs(h.center(z))<1e-8);}for(const side of [-1,1])for(let z=h.length-2;z<h.length+8;z+=.5){const width=fairwayWidth(h,z,0,side);if(width>0)assert(greenDistance(h,h.center(z)+side*width,z)<0);}}
 assert(count>40);
});
test('procedural water banks follow fairways without crossing turf and share a closed boundary',()=>{
 let count=0,curved=0;for(let i=0;i<18;i++){const h=generateCourse({seed:'SHORE',holes:18,water:100,doglegs:100,doglegAngle:70},i);for(const p of h.ponds){count++;for(let j=0;j<256;j++){const q=ovalRadius(p,j*Math.PI/128),x=p.x+q.x,z=p.z+q.z;assert(Math.abs(hazardMetric(x,z,p)-1)<1e-6);assert(Math.abs(x-h.center(z))>=fairwayWidth(h,z,h.settings.semiRough,p.side)+p.gap-.15);assert(greenDistance(h,x,z)>h.settings.fringe+3);}
  assert(hazardMetric(p.x,p.z,p)<1);const a=hazardProfile(p,p.z-p.rz*.7),b=hazardProfile(p,p.z+p.rz*.7);if(Math.abs(a.x-b.x)>5)curved++;
 }}assert(count>10);assert(curved>4);
});
test('footprint choices produce distinct reproducible non-square course arrangements',()=>{
 const results=[];for(const footprint of ['organic','oval','crescent','ribbon']){const s={...DEFAULT_COURSE,seed:'FOOTPRINT',holes:18,courseYards:6480,footprint},make=()=>{const holes=Array.from({length:18},(_,i)=>generateCourse(s,i)),bounds=routeHoles(holes,s,random);return {holes,bounds};},a=make(),b=make();assert.deepEqual(a.holes.map(h=>h.origin),b.holes.map(h=>h.origin));const points=a.holes.map(h=>h.cell),mx=points.reduce((v,p)=>v+p.x,0)/18,mz=points.reduce((v,p)=>v+p.z,0)/18,xx=points.reduce((v,p)=>v+(p.x-mx)**2,0),zz=points.reduce((v,p)=>v+(p.z-mz)**2,0),xz=points.reduce((v,p)=>v+(p.x-mx)*(p.z-mz),0),spread=Math.sqrt((xx-zz)**2+4*xz*xz);assert((xx+zz+spread)/(xx+zz-spread)>1.5);results.push(JSON.stringify(a.holes.map(h=>h.origin)));}assert.equal(new Set(results).size,4);
});
test('the aim target sits exactly the requested distance away in every playing direction',()=>{
 for(const degrees of [-180,-90,0,45,135,180]){const origin={x:24,z:-10},target=aimTarget(origin,degrees,120);assert(Math.abs(Math.hypot(target.x-origin.x,target.z-origin.z)-120)<1e-8);}
});
test('wind debris is capped, calm is clear, and physics wind matches world direction on rotated holes',()=>{
 assert.equal(windDrift({wind:0}).count,0);let prior=0;for(let wind=1;wind<=25;wind++){const d=windDrift({wind,windDirection:90});assert(d.count>=prior&&d.count<=76);assert(d.x>0&&Math.abs(d.z)<1e-7);prior=d.count;}
 for(const rotation of [0,.3,Math.PI/2,Math.PI,4.5]){const settings={wind:14,windDirection:240},world=windDrift(settings),[x,,z]=localWind(settings,rotation);assert(Math.abs(x*Math.cos(rotation)+z*Math.sin(rotation)-world.x)<1e-8);assert(Math.abs(-x*Math.sin(rotation)+z*Math.cos(rotation)-world.z)<1e-8);}
});
