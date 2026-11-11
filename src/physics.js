// THE BALL. One shot from the club face to rest: through the air (aero.js),
// off the ground (bounce.js on turf.js's surfaces), along it, round the trees
// and houses, and into the hole (cup.js).
//
// SI units throughout. docs/BALL_PHYSICS.md is the whole model in plain words,
// with every constant's source; tools/ball-bench.mjs scores it against real
// measurements.
import {G, R, MASS, MPH, YARD, AERO, airDensity, coefficients, makeAir, airAcceleration, spinDecay} from './aero.js';
import {turfOf, rollDecelerationAt, slideFriction, restitution, ROLL} from './turf.js';
import {bounce} from './bounce.js';
import {CUP_RADIUS as CUP_R, CUP_DEPTH, CUP, cupSim} from './cup.js';
import {NO_TRUNK} from './species.js';
import {pastBoundary} from './roads.js';
export {G, R, MASS, MPH, YARD, AERO, airDensity, coefficients};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CUP_RADIUS=.053975;
const hypot=Math.hypot;

// A bounce that comes back off the ground slower than this is not a bounce any
// more: the ball is on the ground, and slides or rolls from there. 0.3 m/s is a
// hop five millimetres high.
export const SETTLE_SPEED=.3;
// How close to the middle of the hole a rolling ball is handed to cup.js.
const CUP_REACH=CUP_R+.012;

// The floodlight mast, at its base where it is widest.
export const POLE_RADIUS=.34;
// A flagstick. The renderer draws these same numbers, and simulateShot
// collides with them.
//
// HEIGHT IS NOT REGULATED. The Equipment Rules govern the flagstick's DIAMETER
// and say nothing at all about how tall it is. Seven and eight feet are the
// usual heights; it is eight since 15 October 2026.
//
// THE OWNER'S PIN (15 October 2026): eight feet, 2 in (50.8 mm) across at the
// top tapering to 1 in (25.4 mm) at the bottom, so it reads on screen beside a
// green (RESEARCH *Why our pins look small*). **1 in at the green is over the
// 0.75 in (19 mm) the Rules allow from 3 in above to 3 in below the surface**
// -- the owner's call, for visibility. Drawn and hit alike: the collider is the
// base radius, so a ball beside the pin in the cup has 41.3 mm between pin and
// liner against a 42.7 mm ball.
export const FLAGSTICK_HEIGHT=8*0.3048, FLAGSTICK_TOP_R=.0254, FLAGSTICK_BASE_R=.0127;
// INSIDE THE HOLE the stick is its real size, half an inch across. Drawn at
// the owner's inch it leaves 41.3 mm beside it for a 42.7 mm ball, and nothing
// could ever be holed with the pin in; a real stick leaves 47.6 mm.
export const FLAGSTICK_HOLE_R=.00635;
// The drawn trunk uses this too, so a trunk you can see is a trunk you hit.
export function trunkRadius(tree){return NO_TRUNK.has(tree.kind)?0:tree.kind==='cactus'?.8:clamp((tree.h||16)*.027,.14,3.6);}

// The ground's slope at a point: rise per metre along x and z.
function slopeAt(course,x,z,e){
 return [(course.height(x+e,z)-course.height(x-e,z))/(2*e),(course.height(x,z+e)-course.height(x,z-e))/(2*e)];
}

// One step of a ball on the ground: sliding while the point touching the turf
// has not caught up with the centre, rolling once it has.
//
// `v` is the centre's velocity and `w` the velocity the ball's spin gives its
// contact point (so `v - w` is the slip: zero for a rolling ball, the full
// launch speed for a putt just struck, and MORE than the ball's speed for one
// that landed with backspin still on it).
//
// Extracted so the aim preview runs the same integration as the shot it is
// predicting. Mutates p, v and w in place and returns true once the ball has
// come to rest.
export function groundStep(course,p,v,w,dt,turf,skid={value:0}){
   const surface=course.surface(p[0],p[2]);
   const [dx,dz]=slopeAt(course,p[0],p[2],.05),metric=1+dx*dx+dz*dz;
   const sx=v[0]-w[0],sz=v[2]-w[1],slip=hypot(sx,sz);
   if(slip>.012){
    // Sliding. The turf drags the centre back and spins the ball until the
    // contact point catches it, which for a ball struck with no spin happens at
    // five sevenths of the launch speed. Gravity acts in full here: the 5/7 of
    // the rolling case comes from the rolling constraint, which does not hold
    // yet. A ball with backspin left is slowed the same way, and if the spin
    // outlasts the travel it is the spin that wins: the ball comes back.
    const row=turfOf(surface,turf),ux=sx/slip,uz=sz/slip,drag=row.slide*G/Math.sqrt(metric),
     // A ball sliding with BACKSPIN shears the turf ahead of it, and loses less
     // spin for its lost speed than a hard floor would take (turf.js `arm`).
     // A putt skidding up to a roll has no backspin and is not affected.
     spinUp=2.5*(w[0]*v[0]+w[1]*v[2]<-1e-9?row.arm??1:1);
    const gx=-G*dx/metric,gz=-G*dz/metric,vx0=v[0],vz0=v[2],before=[p[0],p[2]];
    v[0]+=(gx-drag*ux)*dt;v[2]+=(gz-drag*uz)*dt;
    w[0]+=spinUp*drag*ux*dt;w[1]+=spinUp*drag*uz*dt;
    p[0]+=(vx0+v[0])*.5*dt;p[2]+=(vz0+v[2])*.5*dt;p[1]=course.height(p[0],p[2])+R;
    skid.value+=hypot(p[0]-before[0],p[2]-before[1]);
    // Once the contact point has caught up the ball is rolling; an overshoot
    // inside one step is snapped rather than allowed to reverse the slip.
    if((v[0]-w[0])*ux+(v[2]-w[1])*uz<=0){w[0]=v[0];w[1]=v[2];}
    if(hypot(v[0],v[2])<.005&&hypot(w[0],w[1])<.02){v[0]=0;v[1]=0;v[2]=0;w[0]=0;w[1]=0;return true;}
   }else{
   // Rolling. Resistance is read at the speed in the middle of the step, so a
   // green's speed does not drift with the timestep.
   const speed=hypot(v[0],v[2]);
   const lead=rollDecelerationAt(surface,turf,speed);
   const resistance=rollDecelerationAt(surface,turf,Math.max(0,speed-lead*dt*.5));
   const ax=-(5/7)*G*dx/metric,az=-(5/7)*G*dz/metric,friction=resistance/Math.sqrt(metric);
   if(speed<.005&&hypot(ax,az)<=friction){v[0]=0;v[1]=0;v[2]=0;w[0]=0;w[1]=0;return true;}
   // Gravity first, then a bounded resistance: it cannot reverse a stopped
   // ball or add energy on the level, even at a long timestep.
   const vx=v[0],vz=v[2],cx=vx+ax*dt,cz=vz+az*dt,candidate=hypot(cx,cz),factor=Math.max(0,1-friction*dt/Math.max(candidate,1e-12));
   v[0]=cx*factor;v[2]=cz*factor;
   p[0]+=(vx+v[0])*.5*dt;p[2]+=(vz+v[2])*.5*dt;p[1]=course.height(p[0],p[2])+R;
   // The contact point tracks the centre it has caught, *after* the step.
   w[0]=v[0];w[1]=v[2];
   }
 return false;
}

// Where a struck ball will come to rest, and the line it takes getting there:
// the real integration over the real ground. It deliberately ignores trees,
// houses and the cup -- the question being asked is where the ball would go.
export function rollPreview(course,origin,aimDegrees,speed,options={}){
 const dt=options.dt||1/240,rad=Math.PI/180,yaw=aimDegrees*rad;
 const p=[origin.x,course.height(origin.x,origin.z)+R,origin.z];
 const v=[Math.sin(yaw)*speed,0,Math.cos(yaw)*speed];
 // Struck, not released: the contact point starts still, as a putt's does.
 const w=options.roll?[Math.sin(yaw)*options.roll,Math.cos(yaw)*options.roll]:[0,0];
 const points=[{x:p[0],z:p[2]}],start=[p[0],p[2]];
 const limit=Math.ceil((options.seconds||30)/dt);
 for(let step=0;step<limit;step++){
  if(groundStep(course,p,v,w,dt,options.turf))break;
  if(step%3===0)points.push({x:p[0],z:p[2]});
 }
 points.push({x:p[0],z:p[2]});
 return {points,end:{x:p[0],z:p[2]},
  distance:hypot(p[0]-start[0],p[2]-start[1]),
  surface:course.surface(p[0],p[2])};
}

// THE BOUNDARY, in a course's own coordinates: the edge of the shared world
// when the hole sits in one, the hole's own box when it does not. One test, so
// the flight and a relief drop (relief.js) cannot disagree about where it is.
export function outOfBounds(course,x,z){
 const wp=course.world?course.toWorld({x,z}):null;
 // Past the public road (roads.js; the US landscapes goal, phase 4) is out too.
 return wp?(Math.abs(wp.x)>course.world.halfX||Math.abs(wp.z)>course.world.halfZ||pastBoundary(course.world.boundary,wp.x,wp.z)>0):(Math.abs(x)>course.bounds.x||z<course.bounds.minZ||z>course.bounds.maxZ);
}

// One shot, flown to rest.
//
// `shot`: {origin {x,z}, aim, speed (m/s), vla, hla, spin (rpm), spinAxis}, in
// degrees, as a launch monitor reports them: positive `hla` starts the ball
// right of the aim line, positive `spinAxis` curves it right. A hole's local +x
// is the player's LEFT, so both enter the flight negated. `height` starts the
// ball in the air; `roll` (m/s) starts a ball on the ground already rolling, as
// a Stimpmeter releases it, instead of struck and sliding.
// `options`: {turf (the three conditions, turf.js), wind [x,y,z] at 10 m,
// altitude, temperature, flagsticks {current}, poles, dt}.
export function simulateShot(shot,course,options={}){
 const dt=options.dt||1/240, rad=Math.PI/180, yaw=(shot.aim-shot.hla)*rad, pitch=shot.vla*rad;
 let v=[Math.sin(yaw)*Math.cos(pitch)*shot.speed,Math.sin(pitch)*shot.speed,Math.cos(yaw)*Math.cos(pitch)*shot.speed];
 let p=[shot.origin.x,course.height(shot.origin.x,shot.origin.z)+R+(shot.height||0),shot.origin.z];
 const start=[...p],turf=options.turf;
 const air=makeAir({altitude:options.altitude||0,temperature:options.temperature??18,wind:options.wind});
 // The spin as a vector, fixed in space while the ball flies (a gyroscope):
 // backspin about the axis across the line of flight, tilted by `spinAxis`.
 const axis=-shot.spinAxis*rad,rate=shot.spin*Math.PI/30;
 let om=[-Math.cos(yaw)*Math.cos(axis)*rate,Math.sin(axis)*rate,Math.sin(yaw)*Math.cos(axis)*rate];
 let rolling=shot.vla<2&&!(shot.height>0),carry=null,hang=null,apex=0,landingSpeed=0,descentAngle=0,landingSpin=0,bounces=0;
 // On the ground the spin that matters is carried as `w`, the velocity it
 // gives the ball's contact point (see groundStep). A struck putt starts with
 // none; a Stimpmeter release starts rolling (`roll`).
 let w=[0,0];
 if(rolling){v[1]=0;if(shot.roll){const s0=hypot(v[0],v[2])||1;w=[v[0]/s0*shot.roll,v[2]/s0*shot.roll];}}
 const skidTotal={value:0};
 const rpm=()=>(rolling?hypot(w[0],w[1])/R:hypot(om[0],om[1],om[2]))*30/Math.PI;
 const points=[{x:p[0],y:p[1],z:p[2],t:0,v:hypot(...v),w:rpm()}];
 let holed=false,hazard=null,lipped=false;
 // Counted for the player's profile, and for nothing else.
 let treeHits=0,homeHits=0,flagHits=0;
 // EVERY CONTACT, FOR THE SOUND: when it happened, what the ball met and how
 // fast it was going into it. Recorded, never read here.
 let t=0;
 const contacts=[],touch=(what,speed)=>contacts.push({t,what,speed,x:p[0],y:p[1],z:p[2]});
 // A small spatial index includes neighbouring holes without testing every
 // trunk at every step. Trunks, boulders, lit floodlight poles and standing
 // flagsticks are all vertical cylinders in the same swept-circle test.
 const treeCells=new Map(),cellSize=24;
 const solids=[...(course.world?.trees||course.trees||[])];
 for(const r of course.world?.rocks||[])
  solids.push({x:r.x,z:r.z,y:r.y,h:Math.max(.2,r.top-r.y),radius:r.reach,solid:'rock'});
 for(const q of options.poles||[])
  solids.push({x:q.x,z:q.z,y:q.y,h:q.height,radius:POLE_RADIUS,solid:'pole'});
 // THE FLAGSTICK IS SOLID WHILE IT STANDS IN THE HOLE. The caller says whether
 // THIS hole's stick is in (`flagsticks.current`): the game pulls it for a putt
 // and once the ball is on the green. Every other hole's stick is always
 // standing. Without `flagsticks` there are none at all.
 if(options.flagsticks&&course.world)for(const hole of course.world.holes){
  if(hole.hole===course.hole&&!options.flagsticks.current)continue;
  const at=hole.worldPin;if(!at)continue;
  const floor=course.world.height(at.x,at.z)-CUP_DEPTH;
  solids.push({x:at.x,z:at.z,y:floor,h:FLAGSTICK_HEIGHT+CUP_DEPTH,radius:FLAGSTICK_BASE_R,flagstick:true});
 }
 const pinIn=!!(options.flagsticks&&options.flagsticks.current);
 for(const source of solids){if(!(source.radius??trunkRadius(source)))continue;const tree=course.world?{...source,...course.toLocal(source)}:source,key=Math.floor(tree.x/cellSize)+','+Math.floor(tree.z/cellSize);if(!treeCells.has(key))treeCells.set(key,[]);treeCells.get(key).push(tree);}
 const treesAt=(p)=>{const result=[],x=Math.floor(p[0]/cellSize),z=Math.floor(p[2]/cellSize);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)result.push(...(treeCells.get(i+','+j)||[]));return result;};
 // Houses, club buildings, field walls and bridge decks are oriented boxes in
 // one shared grid. A bridge's deck is 22 cm deep with a floor: a ball can pass
 // beneath it.
 const homeCells=new Map();
 const decks=(course.world?.bridges||[]).filter(b=>b.deck!=null).map(b=>({x:b.x,z:b.z,y:b.deck-.22,height:.22,width:b.width,depth:b.span,rotation:b.angle,club:true,deck:true}));
 for(const source of [...(course.world?.homes||course.homes||[]),...(course.world?.buildings||[]),...(course.world?.wallBoxes||[]),...decks]){
  // A HOUSE'S ROTATION IS A WORLD ANGLE: in the hole's frame a house is turned
  // by its own rotation less the hole's.
  const home=course.world?{...source,...course.toLocal(source),rotation:source.rotation-(course.rotation||0)}:source,reach=Math.max(home.width,home.depth);
  for(let i=Math.floor((home.x-reach)/cellSize);i<=Math.floor((home.x+reach)/cellSize);i++)for(let j=Math.floor((home.z-reach)/cellSize);j<=Math.floor((home.z+reach)/cellSize);j++){const key=i+','+j;if(!homeCells.has(key))homeCells.set(key,[]);homeCells.get(key).push(home);}
 }
 const homesAt=(p)=>{const result=[],x=Math.floor(p[0]/cellSize),z=Math.floor(p[2]/cellSize);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)result.push(...(homeCells.get(i+','+j)||[]));return result;};
 // The unit normal of the ground under a point.
 const normalAt=(x,z)=>{const [gx,gz]=slopeAt(course,x,z,.1),l=hypot(gx,1,gz);return [-gx/l,1/l,-gz/l];};
 // Leaving the air for the ground: the spin becomes the contact point's
 // velocity, R (omega x n), and whatever the ball was doing along the normal
 // stops.
 const land=n=>{
  const on=v[0]*n[0]+v[1]*n[1]+v[2]*n[2];
  v[0]-=on*n[0];v[1]=0;v[2]-=on*n[2];
  w=[R*(om[1]*n[2]-om[2]*n[1]),R*(om[0]*n[1]-om[1]*n[0])];
  rolling=true;
 };
 // And back: a rolling ball's spin as a vector, (n x w) / R.
 const lift=n=>{const wy=-(n[0]*w[0]+n[2]*w[1])/n[1];om=[(n[1]*w[1]-n[2]*wy)/R,(n[2]*w[0]-n[0]*w[1])/R,(n[0]*wy-n[1]*w[0])/R];rolling=false;};
 const a1=[0,0,0],a2=[0,0,0],vm=[0,0,0];
 const pin=course.pin;
 let prevV=[...v];
 for(let step=0;step<Math.ceil(70/dt);step++){
  t+=dt;
  const old=[p[0],p[1],p[2]];
  prevV[0]=v[0];prevV[1]=v[1];prevV[2]=v[2];
  const wasRolling=rolling,prevW=rolling?[w[0],w[1]]:null,prevOm=rolling?null:[om[0],om[1],om[2]];
  let rested=false;
  if(!rolling){
   // Midpoint (RK2) at 240 Hz, the same whatever the frame rate.
   const above=p[1]-course.height(p[0],p[2]);
   airAcceleration(v,om,air,above,a1);
   for(let i=0;i<3;i++)vm[i]=v[i]+a1[i]*dt/2;
   airAcceleration(vm,om,air,above+vm[1]*dt/2,a2);
   for(let i=0;i<3;i++){p[i]+=vm[i]*dt;v[i]+=a2[i]*dt;}
   const f=spinDecay(hypot(v[0],v[1],v[2]),dt,air.rho);om[0]*=f;om[1]*=f;om[2]*=f;
  }else rested=groundStep(course,p,v,w,dt,turf,skidTotal);
  // THE HOLE comes before the ground, because it is the one place the ground
  // is not there. A ball whose path this step crosses the opening -- rolling,
  // or in the air and down at the level of the lip -- is handed to cup.js from
  // where it was at the start of the step, and comes back when it has left the
  // hole or stopped.
  if(pin){
   const sdx=p[0]-old[0],sdz=p[2]-old[2],travel=sdx*sdx+sdz*sdz;
   const u=travel>1e-12?clamp(((pin.x-old[0])*sdx+(pin.z-old[2])*sdz)/travel,0,1):0;
   const nearX=old[0]+u*sdx-pin.x,nearZ=old[2]+u*sdz-pin.z,near=hypot(nearX,nearZ);
   const pinY=course.height(pin.x,pin.z);
   const approaching=(pin.x-old[0])*prevV[0]+(pin.z-old[2])*prevV[2]>0||hypot(old[0]-pin.x,old[2]-pin.z)<CUP_R;
   const low=old[1]+u*(p[1]-old[1])-R<=pinY+.006;
   // A ball that has stopped with its centre over the opening is not at rest:
   // there is nothing under it.
   const hanging=rested&&hypot(p[0]-pin.x,p[2]-pin.z)<CUP_R;
   if(hanging||(!rested&&near<(wasRolling?CUP_REACH:CUP_R)&&approaching&&(wasRolling||low))){
    const [gx,gz]=slopeAt(course,pin.x,pin.z,CUP_R);
    const hole={x:pin.x,z:pin.z,y:pinY,gx,gz};
    // Back to the start of the step, as a free rigid ball.
    const n=normalAt(old[0],old[2]);
    p=[old[0],old[1],old[2]];v=[prevV[0],prevV[1],prevV[2]];
    if(wasRolling){w=prevW;v[1]=gx*v[0]+gz*v[2];lift(n);p[1]=pinY+gx*(p[0]-pin.x)+gz*(p[2]-pin.z)+R*hypot(gx,1,gz);}
    else om=prevOm;
    const row=turfOf('green',turf);
    if(carry===null&&wasRolling)carry=0;
    const out=cupSim({p,v,w:om},hole,{t:t-dt,rollAt:s=>row.c*Math.pow(Math.max(s,ROLL.floor),ROLL.power),slide:row.slide,e:restitution(row,Math.max(.2,Math.abs(v[1]))),pin:pinIn?FLAGSTICK_HOLE_R:0});
    for(const c of out.contacts)contacts.push(c);
    for(const q of out.points)points.push(q);
    flagHits+=out.pinHits;t=out.t;
    if(out.holed){holed=true;break;}
    if(out.lipped)lipped=true;
    if(out.rest){p[1]=course.height(p[0],p[2])+R;break;}
    // Out again. Rolling if it is on the turf, flying if it was thrown clear.
    const ground=course.height(p[0],p[2])+R,gn=normalAt(p[0],p[2]);
    if(p[1]-ground<.004&&v[0]*gn[0]+v[1]*gn[1]+v[2]*gn[2]<SETTLE_SPEED){p[1]=ground;land(gn);}
    else rolling=false;
    continue;
   }
  }
  if(rested)break;
  const ground=course.height(p[0],p[2])+R,surface=course.surface(p[0],p[2]);
  // Below the ground is a collision whichever way the ball is travelling: on a
  // steep slope the terrain can come up faster than a climbing ball does.
  if(!rolling&&(p[1]<ground-1e-6||(p[1]<=ground&&v[1]<=0))){
   // Carry, hang time, landing speed, spin and descent angle are all taken at
   // the instant of first touchdown, the one moment they are defined.
   if(carry===null){
    carry=hypot(p[0]-start[0],p[2]-start[2]);hang=t;landingSpeed=hypot(...v);
    descentAngle=Math.atan2(-v[1],hypot(v[0],v[2]))/rad;landingSpin=hypot(om[0],om[1],om[2])*30/Math.PI;
   }
   p[1]=ground;
   touch(surface,hypot(...v));
   if(surface==='water'){hazard='Water';break;}
   const n=normalAt(p[0],p[2]);
   const out=bounce(v,om,n,turfOf(surface,turf));
   v=out.v;om=out.w;bounces++;
   // Too little left to leave the ground: it is on it.
   if(v[0]*n[0]+v[1]*n[1]+v[2]*n[2]<SETTLE_SPEED)land(n);
  }
  if(rolling&&surface==='water'){touch('water',hypot(...v));hazard='Water';break;}
  if(outOfBounds(course,p[0],p[2])){hazard='Out of bounds';break;}
  // Trunks, rocks, poles, flagsticks: resolve penetration as well as swept
  // contact. Reflect only incoming velocity; an escaping ball must never be
  // flipped back into the same trunk each tick.
  if(treeCells.size)for(const tree of treesAt(p)){
   const radius=(tree.radius??trunkRadius(tree))+R;if(radius<=R||Math.min(old[1],p[1])>tree.y+tree.h||Math.max(old[1],p[1])<tree.y)continue;
   const dx=p[0]-old[0],dz=p[2]-old[2],ox=old[0]-tree.x,oz=old[2]-tree.z,A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-radius*radius,disc=B*B-4*A*C;
   let u=C<0?0:A>1e-12&&disc>=0?(-B-Math.sqrt(disc))/(2*A):-1;if(u<0||u>1)continue;
   let nx=old[0]+u*dx-tree.x,nz=old[2]+u*dz-tree.z,n=hypot(nx,nz);if(n<1e-8){nx=-v[0];nz=-v[2];n=hypot(nx,nz)||1;if(n===1&&nx===0&&nz===0)nx=1;}nx/=n;nz/=n;
   const incoming=v[0]*nx+v[2]*nz;if(incoming<0){touch(tree.flagstick?'flagstick':tree.solid||'trunk',-incoming);v[0]-=1.3*incoming*nx;v[2]-=1.3*incoming*nz;
    // Wood takes most of the spin with it.
    if(rolling)w=[v[0],v[2]];else{om[0]*=.4;om[1]*=.4;om[2]*=.4;}
    if(tree.flagstick)flagHits++;else treeHits++;}
   p[0]=tree.x+nx*(radius+.003)+v[0]*dt*(1-u);p[2]=tree.z+nz*(radius+.003)+v[2]*dt*(1-u);if(rolling)p[1]=course.height(p[0],p[2])+R;break;
  }
  // Houses and the other boxes: resolve the deepest overlap and push the ball
  // back out along the face it entered, reflecting only incoming motion so a
  // ball resting against a wall can still be played away from it.
  if(homeCells.size)for(const home of homesAt(p)){
   const c=Math.cos(home.rotation),s=Math.sin(home.rotation);
   const dx=p[0]-home.x,dz=p[2]-home.z,lx=dx*c-dz*s,lz=dx*s+dz*c;
   const hx=home.width/2+R,hz=home.depth/2+R,top=home.y+home.height+R;
   if(Math.abs(lx)>hx||Math.abs(lz)>hz||p[1]>top||p[1]<course.height(p[0],p[2])-1)continue;
   if(home.deck&&p[1]<home.y-R)continue;
   const px=hx-Math.abs(lx),pz=hz-Math.abs(lz),py=top-p[1];
   let nx=0,ny=0,nz=0,push=0;
   // A ball that was above the deck a step ago came down on it, however far
   // in from its edge it now is.
   if(py<=px&&py<=pz||home.deck&&old[1]>=top-.02){ny=1;push=py;}
   else if(px<=pz){nx=Math.sign(lx)||1;push=px;}
   else{nz=Math.sign(lz)||1;push=pz;}
   const wx=nx*c+nz*s,wz=-nx*s+nz*c;
   p[0]+=wx*push;p[1]+=ny*push;p[2]+=wz*push;
   const incoming=v[0]*wx+v[1]*ny+v[2]*wz;
   if(incoming<0){touch('house',-incoming);const back=1.34;v[0]-=back*incoming*wx;v[1]-=back*incoming*ny;v[2]-=back*incoming*wz;v[0]*=.72;v[2]*=.72;
    if(rolling)w=[v[0],v[2]];else{om[0]*=.4;om[1]*=.4;om[2]*=.4;}
    homeHits++;}
   if(ny>0&&rolling)p[1]=Math.max(p[1],top);
   if(course.residentialOB&&!home.club){hazard='Out of bounds';}
   // A ball come to rest on a bridge is in the penalty area under it: the
   // Rules carry a penalty area's edge straight up (Rule 17.1a).
   if(home.deck&&ny>0&&hypot(v[0],v[2])<1.2&&Math.abs(v[1])<1.2){hazard='Water';}
   break;
  }
  if(hazard)break;
  apex=Math.max(apex,p[1]-start[1]);
  const detailed=pin&&hypot(p[0]-pin.x,p[2]-pin.z)<.5;
  if(detailed||step%4===0)points.push({x:p[0],y:p[1],z:p[2],t,v:hypot(v[0],v[1],v[2]),w:rpm()});
 }
 points.push({x:p[0],y:p[1],z:p[2],t});
 return {points,end:{x:p[0],y:p[1],z:p[2]},carry:carry??0,hang:hang??0,total:hypot(p[0]-start[0],p[2]-start[2]),apex,time:t,landingSpeed,descentAngle,landingSpin,bounces,skid:skidTotal.value,holed,lipped,hazard,treeHits,homeHits,flagHits,contacts,onGreen:course.surface(p[0],p[2])==='green'};
}
// What the DEVICE says about itself, from a status frame. `parseLaunchMessage`
// returns null for these and the readiness never reached the browser, so the
// game could not tell "no monitor" from "monitor waiting for a ball" from
// "ball on the mat, ready to hit" -- which is exactly what a player standing
// over the ball needs to know.
//
// Reads the flat and nested option shapes, same as the shot parser.
export function readDeviceStatus(raw){
 // NEVER THROWS. This is a probe, not a validator -- `parseLaunchMessage` does
 // the validating. It runs in the same loop as the framing check, where a throw
 // is read as an unrecoverable stream and closes the connection, so a status
 // frame it cannot make sense of must simply be no status at all.
 let d;
 try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch{return null;}
 if(!d||typeof d!=='object'||Array.isArray(d))return null;
 const o=d.ShotDataOptions??d;
 if(!o||typeof o!=='object')return null;
 if(!('LaunchMonitorIsReady' in o)&&!('LaunchMonitorBallDetected' in o))return null;
 return {ready:o.LaunchMonitorIsReady===true,ballDetected:o.LaunchMonitorBallDetected===true};
}
export function parseLaunchMessage(raw){
 const d=typeof raw==='string'?JSON.parse(raw):raw;
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Expected a shot object.');
 // SOME CONNECTORS SEND THE OPTIONS FLAT, at the top level, instead of nested
 // under `ShotDataOptions`. GSPro accepts both, so this has to as well -- read
 // strictly, a connector whose idle frame is
 //   {"ContainsBallData":false,...,"IsHeartBeat":false}
 // has no `ShotDataOptions` and no `BallData`, so it was rejected as a malformed
 // shot. Its connector then reconnected and sent the same frame forever.
 const opts=d.ShotDataOptions??d;
 if(opts.ContainsBallData===false||opts.IsHeartBeat===true)return null;
 if(!d.BallData){
  // A status frame that sets none of the ball flags is still a status frame, not
  // a broken shot. Anything carrying none of these keys genuinely is broken.
  const STATUS=['ContainsBallData','ContainsClubData','LaunchMonitorIsReady','LaunchMonitorBallDetected','IsHeartBeat'];
  if(STATUS.some(k=>k in opts))return null;
  throw Error('BallData is missing.');
 }
 if(d.APIversion!==undefined&&String(d.APIversion)!=='1')throw Error('Only Open Connect v1 is supported.');
 const b=d.BallData,unit=d.Units??'Yards';
 if(!['Yards','Meters'].includes(unit))throw Error('Units must be Yards (mph) or Meters (km/h).');
 const number=(v,name,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Invalid ${name}.`);return v;};
 const speed=number(b.Speed,'ball speed',.05,400)*(unit==='Meters'?1/3.6:MPH);
 if(speed>110)throw Error('Ball speed exceeds supported range.');
 const vla=number(b.VLA,'vertical launch',-10,85),hla=number(b.HLA,'horizontal launch',-90,90);
 let spin,spinAxis;
 if(b.TotalSpin!==undefined){spin=number(b.TotalSpin,'spin',0,20000);spinAxis=number(b.SpinAxis,'spin axis',-180,180);}
 else{const back=number(b.BackSpin,'backspin',-20000,20000),side=number(b.SideSpin,'sidespin',-20000,20000);spin=hypot(back,side);spinAxis=Math.atan2(side,back)*180/Math.PI;}
 return {speed,vla,hla,spin,spinAxis,extra:readExtras(d,unit),id:d.ShotNumber,device:String(d.DeviceID||'Launch monitor').slice(0,80)};
}
// EVERYTHING ELSE THE DEVICE SENT, AND NOT ONE FIELD OF IT MAY REJECT A SHOT.
//
// The five above are validated hard, because a bad one means the model cannot
// run and playing the shot would be inventing it. These are the opposite case:
// club speed, attack angle, path, face, the spin split and the device's own
// distances reach the screen and nothing else. A monitor that sends a garbage
// loft, a string where a number belongs, or a ClubData block that is not an
// object must not be able to stop a real ball being played -- so there is no
// `throw` anywhere below this line, and no range check either. A number that is
// not a number is simply absent, and the grid prints a dash for it.
//
// Normalised to SI at this boundary, like the five, so nothing downstream has
// to know whether the device was talking yards or metres. Angles stay in
// degrees and spins in rpm because that is what every monitor and every golfer
// uses; face impact stays in millimetres for the same reason.
function readExtras(d,unit){
 const n=v=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
 const speed=v=>{const x=n(v);return x===undefined?undefined:x*(unit==='Meters'?1/3.6:MPH);};
 const dist=v=>{const x=n(v);return x===undefined?undefined:x*(unit==='Meters'?1:YARD);};
 const b=d.BallData&&typeof d.BallData==='object'?d.BallData:{};
 // ClubData is optional in Open Connect v1 and plenty of devices never send it.
 const c=d.ClubData&&typeof d.ClubData==='object'?d.ClubData:{};
 const out={
  backSpin:n(b.BackSpin),sideSpin:n(b.SideSpin),
  deviceCarry:dist(b.CarryDistance),deviceTotal:dist(b.TotalDistance),
  // `Speed` is the club head; `SpeedAtImpact` is a second reading some devices
  // report and most do not. Kept apart rather than merged: a fallback between
  // two quantities that are not the same quantity is how a metric starts lying.
  clubSpeed:speed(c.Speed),speedAtImpact:speed(c.SpeedAtImpact),
  attack:n(c.AngleOfAttack),path:n(c.Path),faceToTarget:n(c.FaceToTarget),
  loft:n(c.Loft),lie:n(c.Lie),closureRate:n(c.ClosureRate),
  impactVertical:n(c.VerticalFaceImpact),impactHorizontal:n(c.HorizontalFaceImpact),
 };
 // Dropping the absent ones keeps a saved round's record to what was actually
 // measured, instead of a dozen undefineds per shot forever.
 for(const k of Object.keys(out))if(out[k]===undefined)delete out[k];
 return out;
}
