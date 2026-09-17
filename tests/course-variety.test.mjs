import test from 'node:test';
import assert from 'node:assert/strict';
import {planCourse,enabledTees,greenContour,greenGradient,playCameraMode,aimDelta} from '../src/course-plan.js';
import {generateCourse,generateWorld,fairwayWidth,greenDistance} from '../src/course.js';
import {Round} from '../src/game.js';
import {YARD,simulateShot} from '../src/physics.js';
test('yardage planner covers short and long 9/18-hole courses with matching par counts',()=>{
 for(const holes of [9,18])for(const average of [110,200,270,330,360,400,470]){
  const settings={holes,courseYards:holes*average,seed:'YARDAGE',trees:0},plan=planCourse(settings);
  assert.equal(plan.holes.length,holes);assert.equal(Object.values(plan.counts).reduce((a,b)=>a+b),holes);
  assert.equal(plan.par,Object.entries(plan.counts).reduce((a,[par,count])=>a+par*count,0));
  const generated=Array.from({length:holes},(_,i)=>generateCourse(settings,i));
  assert(Math.abs(generated.reduce((a,h)=>a+h.routeLength/YARD,0)-plan.yards)<2);
  assert.deepEqual(generated.map(h=>h.par),plan.holes.map(h=>h.par));
 }
});
test('a one-hole world builds for the menu backdrop without disturbing 9 and 18',()=>{
 const plan=planCourse({holes:1,courseYards:420,seed:'BACKDROP'});
 assert.equal(plan.holes.length,1);
 assert.equal(plan.par,4,'a lone showcase hole is a par 4');
 assert(Math.abs(plan.holes[0].yards-420)<.001);
 const w=generateWorld({seed:'BACKDROP',holes:1,courseYards:420,trees:20,water:55});
 assert.equal(w.holes.length,1);
 const h=w.holes[0];
 assert.equal(h.surface(h.pin.x,h.pin.z),'green');
 assert.equal(h.surface(0,0),'tee');
 for(let z=0;z<h.length;z+=25)assert(Number.isFinite(h.height(h.center(z),z)));
 // The nine- and eighteen-hole plans must be untouched by the one-hole path.
 for(const holes of [9,18]){const p=planCourse({holes,courseYards:holes*360,seed:'BACKDROP'});assert.equal(p.holes.length,holes);assert(p.counts[3]>=1,'real courses still get par 3s');}
});
test('fairway edges have independent generated control points, varied widening, and bunker stations',()=>{
 const holes=Array.from({length:18},(_,i)=>generateCourse({holes:18,courseYards:6800,seed:'VARIETY',bunkerCount:8,water:0},i));
 assert(holes.every(h=>h.family===undefined));assert(new Set(holes.map(h=>h.leftEdge.knots.length)).size>=3);assert(new Set(holes.map(h=>JSON.stringify(h.leftEdge))).size===18);assert(holes.every(h=>JSON.stringify(h.leftEdge)!==JSON.stringify(h.rightEdge)));
 const ratio=h=>h.width(h.length*.8)/h.width(h.length*.3);assert(holes.some(h=>ratio(h)>1.6));assert(holes.some(h=>ratio(h)<.7));
 const peak=h=>Array.from({length:20},(_,i)=>({u:i/19,w:h.width(h.length*i/19)})).sort((a,b)=>b.w-a.w)[0].u;
 assert(new Set(holes.map(h=>Math.round(peak(h)*5))).size>=4);
 assert(new Set(holes.map(h=>h.bunkers.length)).size>=3);
 const angles=holes.flatMap(h=>h.bunkers.filter(b=>b.greenSide).map(b=>Math.floor((Math.atan2(b.z-h.pin.z,b.x-h.pin.x)+Math.PI)/(Math.PI/2))));assert(new Set(angles).size===4);
});
test('dogleg signs balance and pivots vary on both sides of the configured point',()=>{
 const holes=Array.from({length:18},(_,i)=>generateCourse({holes:18,courseYards:6600,seed:'TURN',doglegs:100,doglegPosition:55},i)).filter(h=>h.par!==3);
 assert(Math.abs(holes.filter(h=>h.doglegAngle>0).length-holes.filter(h=>h.doglegAngle<0).length)<=1);
 assert(holes.some(h=>h.turnFraction<.43));assert(holes.some(h=>h.turnFraction>.67));
});
test('enabled tee pads have distinct playable positions and route yardages; round restore does not move a lie',()=>{
 for(const settings of [{},{teeBlue:false},{teeBlue:false,teeWhite:false}]){
  const h=generateCourse({seed:'TEES',...settings});assert.deepEqual(Object.keys(h.tees),enabledTees(settings));let previous=Infinity;
  for(const[name,t]of Object.entries(h.tees)){assert(t.yards<previous);previous=t.yards;assert.equal(h.surface(t.x,t.z),'tee');const r=new Round({tee:name});r.placeTee(h.tees);assert.deepEqual(r.position,{x:t.x,z:t.z});r.simDrop({x:5,z:60});const copy=Round.restore(JSON.parse(JSON.stringify(r)));copy.placeTee(h.tees);assert.deepEqual(copy.position,{x:5,z:60});copy.takeShot({end:h.pin,holed:true},h.pin);copy.nextHole();copy.placeTee(h.tees);assert.deepEqual(copy.position,{x:t.x,z:t.z});}
 }
});
test('green difficulty changes real contact slopes and affects putt break',()=>{
 const settings={seed:'CONTOURS',holes:9,trees:0,water:0,bunkerCount:0,elevation:0},flat=generateWorld({...settings,greenDifficulty:0}),hard=generateWorld({...settings,greenDifficulty:100});
 for(let i=0;i<9;i++){const a=flat.holes[i],h=hard.holes[i];let largest=0,spread=[];for(let x=-12;x<=12;x+=4)for(let z=-12;z<=12;z+=4){assert(Math.abs(a.height(x,a.pin.z+z)-a.height(0,a.pin.z))<.001);const g=greenGradient(h,x,h.pin.z+z);largest=Math.max(largest,Math.hypot(g.x,g.z));spread.push(h.height(x,h.pin.z+z));}assert(largest>.015);assert(Math.max(...spread)-Math.min(...spread)>.25);}
 const h=hard.holes[0],a=flat.holes[0],shot={origin:{x:0,z:h.pin.z-10},aim:0,speed:1.2,vla:0,spin:0,spinAxis:0,hla:0};const p=simulateShot(shot,h),q=simulateShot({...shot,origin:{x:0,z:a.pin.z-10}},a);assert(Math.abs(p.end.x-q.end.x)>.05);
});
// The camera the player chose is the camera they keep, on the green as much as
// anywhere. This used to swap in a dedicated `putt` camera the moment the ball
// reached a green, which silently overrode height, distance and offset and made
// the Game camera panel look broken while putting.
test('the green never changes the camera mode out from under the player',()=>{
 const green={surface:()=> 'green'},fairway={surface:()=> 'fairway'},p={x:0,z:0};
 for(const mode of ['player','overview','green','free']){
  assert.equal(playCameraMode(mode,green,p),mode,`${mode} was changed by standing on a green`);
  assert.equal(playCameraMode(mode,fairway,p),mode);
 }
});
test('screen-right aim reduces local heading',()=>{
 assert(aimDelta(1,1)<0);assert(aimDelta(-1,1)>0);
});
