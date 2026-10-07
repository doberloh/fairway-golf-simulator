import {rollDeceleration,rollDecelerationAt,slideFriction} from './turf.js';
import {bounceScale,tiltScale,gripScale,spinScale,firmnessApplies,firmnessValue,NORMAL_FIRMNESS} from './firmness.js';
import {CUP_RADIUS as CUP_R,CUP_DEPTH} from './cup.js';
import {bounce as compliantBounce,dampingFor} from './contact.js';
import {NO_TRUNK} from './species.js';
// Restitution -> damping, remembered. The solve is sixty runs of a full contact,
// and the same handful of (restitution, friction) pairs recur all shot long.
const DAMPING=new Map();
const dampingCache=(cor,mu)=>{
 const key=cor.toFixed(4)+':'+mu.toFixed(3);
 let d=DAMPING.get(key);
 if(d===undefined){d=dampingFor(cor,{friction:mu});DAMPING.set(key,d);}
 return d;
};
// SI units throughout. Research and approximation boundaries: ../RESEARCH.md.
export const G=9.80665, R=0.021335, MASS=0.04593, MPH=0.44704, YARD=0.9144;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CUP_RADIUS=.053975;

// What each surface does to a bounce, as one table instead of three nested
// ternaries. Written out per surface because the lumping is the interesting part
// and a ternary hides it.
//
// The ordering that matters is HOW MUCH CANOPY there is to absorb an impact.
// Rough is 50 mm of grass, a fairway 12-15, a green 3. More canopy takes more
// energy out of the ball, which is why restitution climbs as the mowing height
// falls.
//
// GREEN AND FAIRWAY USED TO SHARE A ROW, and a ball bounced off a green exactly
// as it did off a fairway -- identical to four decimal places in a sweep. They
// are four times apart in mowing height, so that was never right. The fairway
// moved DOWN rather than the green up, for three reasons: a green has almost no
// canopy and is the right end of the ladder to anchor; every published figure in
// RESEARCH.md was measured on a green and would have been invalidated; and green
// bounce was already on the high side, so raising it would have made the more
// obvious problem worse.
//
// These are engineering assumptions, not fitted data -- the same caveat the
// original three carried. What is defensible is the ORDER, not the values.
//
// ALL THREE run the same way now. `tilt` is Penner's effective contact plane --
// the ball climbing out of the depression it is making -- and `mu` is the
// Coulomb friction limit, so both RISE with canopy where restitution falls:
// deeper to climb out of, and more grass to grab. They used to give semi-rough
// the same numbers as a putting green, which meant a ball dug in and gripped
// identically on both while only its bounce differed.
//
// Rough and sand did not move. They were already distinct and already in the
// right order; the lumping was confined to everything above semi.
// ANCHORED, at one point, to measured data. Harper, Kerwin et al., "Measurements
// and linearized models for golf ball bounce" (arXiv:2302.02758) bounced a ball
// 693 times off a WELL-MAINTAINED NATURAL TEEING AREA at 1.9-38.7 m/s and 16-90
// degrees, and fitted exactly the model this file uses -- Penner's tilted
// contact plane plus a restitution. Their fixed-angle fit is r = 0.147 with
// beta = 18.4 deg (0.321 rad), and that pair is the `tee` row below verbatim.
//
// Their other fit of the same data trades the two off -- r = 0.222 with Penner's
// speed-varying beta -- and was rejected on the roll: it put a 7-iron 16.5 yd
// past its pitch mark on a fairway, where the fixed-angle pair gives 5.4.
//
// Every other row is the previous ladder SCALED onto that anchor (cor x0.525,
// tilt x1.235), which keeps the ordering while moving the whole thing onto a
// measured footing. Those rows are still assumptions; the tee row is not.
//
// Before this, a 7-iron bounced 9.2 ft off a green. It now bounces 3.5.
//
// `mu` was deliberately NOT anchored. The paper fits it at 0.85-1.0 in every
// campaign including artificial turf, which is it pegging rather than measuring:
// raising ours from 0.44 to 0.95 changed a full-shot bounce by nothing at all,
// because the contact is already gripping and the Coulomb limit never binds. It
// still matters where contact does slip, so it keeps its canopy ordering.
// `plough` NO LONGER RUNS WITH THE MOWING HEIGHT. It is ordered by how firm the
// GROUND is, firmest first: fairway and tee, then semi, rough, fringe, green,
// and sand last as the softest thing on the course.
//
// The old ladder ordered it by canopy depth, which made a fairway dig 34% harder
// than a green -- the fairway modelled as the SOFTER ground. That is backwards.
// A fairway is native soil; a green is a watered rootzone maintained to hold a
// shot. Anchored at 0.1100 for the fairway and stepped evenly up to the green,
// which is held at the value it already had because that is the surface whose
// behaviour has been checked on screen.
//
// KNOWN CONSEQUENCE, recorded rather than hidden: `plough` is still carrying two
// separate things -- how soft the ground is AND how much the grass grabs -- and
// this orders it by only the first. So rough loses most of its stopping power, a
// stock iron landing there running about 4.4 yd against a green's 0.3. Splitting
// the parameter in two is the open question in TODO.md.
//
// `spin` is how much of the tangential impulse becomes spin change, and unlike
// ploughing it DOES run with the mowing height. See SPIN_GAIN in
// contact.js for what the number does; 5/2 is the rigid-sphere ceiling.
//
// FITTED ON A FAIRWAY, ORDERED BY CANOPY EVERYWHERE ELSE. The fairway's 2.5 is
// not a guess: it is what makes a driver, a 3 wood and a 5 iron release the
// distances the published tour totals give for shots that actually finish on a
// fairway (21, 19 and 15 yd). Spin transfer is what sets the SPIN GRADIENT --
// ploughing moved all three clubs together and left the 5 iron six yards short,
// while this closed the spread. It sits at the rigid-sphere ceiling; 2.9 fitted
// marginally better and was refused, because past 5/2 the turf would be twisting
// the ball harder than a point contact can.
//
// The story the ladder now tells is that a GREEN is the one surface engineered
// to preserve spin -- tight, smooth, and mown to nothing -- while every other
// surface strips it. That is why a green checks and a fairway runs.
//
// IT IS ORDERED BY CANOPY BECAUSE YOU CANNOT SPIN A BALL OUT OF THE ROUGH. On a
// mown, firm surface the contact patch is small and its parts slip in different
// directions, so the net torque falls well short of force x radius and the ball
// keeps backspin it can later use. In deep grass the canopy wraps the ball and
// takes hold over a large area, stripping the spin -- which is the whole reason
// a flier runs out instead of checking. Setting one global value made balls spin
// backwards out of rough, which is the opposite of how rough behaves.
//
// The ordering is BEHAVIOURAL, not measured: no one has handed us per-surface
// spin-transfer figures. Green is fitted; the rest rise to the rigid ceiling.
// PLOUGH IS THE SUM OF TWO THINGS, and writing it as one number is what made
// every previous ordering of it contradict something:
//
//   GROUND -- how far the ball sinks. About the soil, not the grass. Firmest
//   first: fairway and tee, then semi, rough, fringe, and a green last, because
//   a green is a watered rootzone kept receptive while a fairway is native soil.
//
//   CANOPY -- how much the grass itself grabs. About the mowing height and
//   nothing else. A green is shaved to nothing; rough is 50 mm deep.
//
// Ordering the single number by canopy had a fairway digging harder than a green
// (the fairway modelled as softer ground, which is backwards). Ordering it by
// ground alone had a ball landing in rough running further than one landing on a
// fairway, which no golfer would recognise. Both orders are real; they are just
// not the same order, and the sum is what the ball feels.
const GROUND={fairway:0.0650,tee:0.0650,semi:0.1000,rough:0.1050,fringe:0.1150,green:0.1250,sand:0.1250};
const CANOPY={fairway:0.0150,tee:0.0150,semi:0.0800,rough:0.1700,fringe:0.0200,green:0.0000,sand:0.6062};
const ploughOf=s=>+(GROUND[s]+CANOPY[s]).toFixed(4);
// Friction runs with the canopy, and the whole ladder came down 5% with the
// green: friction is the largest single term taking forward speed off a bounce,
// and at the old values a hard-spun iron kept almost none of it, so its first
// hop went nowhere.
const CONTACT={
 green:  {cor:0.1491,tilt:0.1333,mu:0.377,plough:ploughOf('green'),spin:1.61},
 fringe:  {cor:0.1403,tilt:0.122,mu:0.399,plough:ploughOf('fringe'),spin:1.7},
 fairway:{cor:0.1305,tilt:0.1192,mu:0.418,plough:ploughOf('fairway'),spin:2.5},
 tee:  {cor:0.1305,tilt:0.1192,mu:0.418,plough:ploughOf('tee'),spin:2.5},
 semi:  {cor:0.1074,tilt:0.1105,mu:0.456,plough:ploughOf('semi'),spin:2.15},
 rough:  {cor:0.0843,tilt:0.085,mu:0.5225,plough:ploughOf('rough'),spin:2.5},
 sand:  {cor:0.0462,tilt:0.0,mu:0.665,plough:ploughOf('sand'),spin:2.5},
};
export const GROUND_ORDER=['fairway','tee','semi','rough','fringe','green'];
export const CANOPY_ORDER=['green','fairway','tee','fringe','semi','rough','sand'];
export const ploughParts=s=>({ground:GROUND[s],canopy:CANOPY[s],total:ploughOf(s)});
// Kept for the test that asserts the GROUND half is ordered by firmness.
export const PLOUGH_ORDER=GROUND_ORDER;
// Anything unlisted keeps what the old `else` branch gave it, so no surface this
// table forgot about changes behaviour by being forgotten.
export const contactOf=surface=>CONTACT[surface]||CONTACT.green;
// How much more elastic the contact is at low speed, decaying to 1x by the time
// a ball is arriving off a full shot.
//
// The gain is set by the one low-speed number that can be checked without
// equipment: a golf ball dropped from shoulder height onto a green comes back to
// about knee height. That is roughly a third of the drop, so a restitution near
// sqrt(1/3) = 0.58, and green's elasto-plastic 0.168 times 3.5 is 0.588. The same
// gain puts sand at 0.182 -- a ball that barely hops in a bunker. Both ends land
// where they should from one constant.
//
// It was tempting to go further, because more gain means more bounces and that
// is what this was fixing. 4.5 gives a 7-iron five visible bounces instead of
// three, but it also implies a ball returning 57% of its drop height, which is a
// hard floor rather than turf. The drop test is the ceiling.
export const ELASTIC_GAIN=3.5, PLASTIC_SPEED=4;
// How hard the turf digs, by firmness, and how much it gives back. Both fitted
// against the figures the old impulse model produced, so a course plays as it
// always did while the bounce underneath it becomes something that takes time.
//
// Soft ground swallows a ball -- it digs nearly twice as hard as Normal and
// returns least. Burnt barely marks and returns most. Digging is the curve the
// tilt could never supply on its own, because the tilt LIFTS as it retards, and
// soft turf has to retard without lifting. Splitting them is what finally let
// Soft hit both its bounce height and its 2.6 yd rollout at once.
// The crater's asymmetry. See contact.js: forward resistance grows with how
// buried the ball is, backward it retreats into its own hole. Fitted below.
export const WALL=0, CRATER_RELIEF=1;
// Fitted to a described ladder rather than to a single number: for a ripped 7
// iron on a green, the first hop must grow in height AND distance with firmness,
// the ball must come back further the firmer it gets, and a firm green should
// skip it forward two or three times before it turns round.
//
// A GREEN BARELY PLOUGHS AT ALL NOW, and firmness hardly changes that. Fitted
// against a full 56 degree wedge, ploughing on a green came out near 0.075 of
// the surface value at every firmness -- effectively a shallow pitch mark and
// nothing more, which is what a tight, sand-based putting surface actually gives
// you. Firmness expresses itself through SPIN SCRUBBING instead (see
// `spinScale`), because that is what decides whether the ball still has backspin
// to walk home on.
//
// Burnt is the exception and drops away hard: baked ground neither digs nor
// holds, and it is the setting a course is firmed to when it wants to reject a
// shot entirely.
// FIRMNESS NO LONGER ACTS THROUGH PLOUGHING AT ALL on a green, and the fit put
// it there rather than being told to. A putting surface is tight, sand-based and
// shallow-marking; how firm it is barely changes how far a ball sinks. What it
// does change is how much the surface SCRUBS THE SPIN OFF -- see `spinScale` --
// and that is what decides whether the ball still has backspin to walk home on.
//
// Fitted against every club that actually lands on a green (56 degree wedge,
// pitching wedge, 9 iron, 7 iron), not against one shot. An earlier fit against
// the wedge alone put ploughing near 0.075 and looked excellent on that shot
// while leaving a 7 iron running 12.3 yd on a Normal green, which is a green
// that does not hold.
export const PLOUGH_BY_FIRMNESS={Soft:0.394,Normal:0.394,Firm:0.394,Burnt:0.394};
// Restitution by firmness, replacing `bounceScale` for this bounce. The old
// curve went as sqrt(normal/depth) because it multiplied an instantaneous
// restitution; here it is fitted directly.
export const BOUNCE_BY_FIRMNESS={Soft:0.781,Normal:1.0,Firm:1.095,Burnt:1.181};
// Both curves are read on the instrument's own scale -- penetration in inches --
// so the lab's firmness slider stays continuous between the four named settings
// instead of stepping.
const onFirmnessScale=(table,depth)=>{
 const d=firmnessValue(depth);
 const pts=[[0.30,table.Burnt],[0.37,table.Firm],[0.45,table.Normal],[0.60,table.Soft]];
 if(d<=pts[0][0])return pts[0][1];
 if(d>=pts[3][0])return pts[3][1];
 for(let i=1;i<pts.length;i++)if(d<=pts[i][0]){
  const[a,va]=pts[i-1],[b,vb]=pts[i];return va+(vb-va)*(d-a)/(b-a);}
 return table.Normal;
};
export const ploughScale=depth=>onFirmnessScale(PLOUGH_BY_FIRMNESS,depth);
export const compliantBounceScale=depth=>onFirmnessScale(BOUNCE_BY_FIRMNESS,depth);
export const elasticGain=normalSpeed=>1+(ELASTIC_GAIN-1)*Math.exp(-Math.abs(normalSpeed)/PLASTIC_SPEED);
// The rim is one surface, and the ball meets it in one of two ways.
//
// ABOVE lip height the cup presents a sharp circular edge, so the ball's centre
// is held a ball radius from the rim CIRCLE -- a torus -- and alpha says where
// around that edge the contact sits: 90 degrees is a ball resting on the green
// beside the hole, 180 degrees is the top of the wall. BELOW lip height the edge
// is behind the ball and the cylinder is what stops it, so the centre stays
// inside CUP_R - R. The two agree exactly at lip height, which is what makes the
// surface continuous.
//
// Splitting this the other way -- one test for "has the centre reached CUP_R"
// and another for "is it below the green and past CUP_R - R" -- leaves a wedge
// between them that the ball flies straight through, and it took a long time to
// see. Reaching the other way, using the rim circle below lip height too, parks
// the ball five millimetres inside the wall and the hole swallows everything.
//
// What the rim is made of.
//
// The liner sits at least 25.4 mm below the putting surface, and a ball that is
// lipping has by definition fallen less than its own radius, 21.3 mm. So the
// surface a lipping ball runs on is ALWAYS cut turf, never the cup liner, and it
// should cost the ball exactly what cut turf costs it -- which is a number we
// already measure rather than one to be chosen.
//
// A Stimpmeter is that measurement. A ball rolling on a level green loses speed
// at a = 1.83^2 / (2 x stimp), so the rolling-resistance coefficient of this
// green is mu = a/g: 0.056 at Stimp 10. Resistance is mu times the load the
// contact is carrying, and on the green that load is simply the ball's weight,
// which is what makes a the number the Stimpmeter reads.
//
// Inside the cup it is emphatically not the ball's weight. A ball going round
// the wall at 0.7 m/s is pressed into it at v^2/rho = 15 m/s^2, better than one
// and a half g, and at 1.2 m/s it is four g. Rolling resistance goes up with it,
// which makes the drag on a rim ride grow as the SQUARE of how fast it is going
// round -- fast rides are scrubbed hard and slow ones are barely touched. That
// is the whole mechanism, and there is no constant in it that is not measured:
// the cup is as slow as the green it is cut into, so a fast green lips out more.
//
// What this replaced was two invented numbers, a constant 7 rad/s^2 on the wall
// and 6 on the lip, which had no source and which let a ball orbit two and a
// half times. The rim was also lossless in the direction it was travelling --
// the normal component of an arriving ball was absorbed completely, but nothing
// took anything off the ball once it was running round.
const rimResistance=turf=>rollDeceleration('green',turf)/G;
// Numerical floors: below these the ball is not being carried round, it is
// dropping, and the cup floor below catches it. The sweep caps are a guard
// against an orbit that never decays, and with real resistance in place no
// trajectory reaches them -- if one ever does, the physics has stopped working.
const WALL_MIN_RATE=3,WALL_MAX_SWEEP=Math.PI*6;
// How hard the cup wall can grip a ball rolling round it, per unit of the press
// that going round puts on it. The green's own sliding friction: the top of the
// wall is the cut turf a skidding putt meets, and no separate number for the
// liner below it has a source. See the wall regime in simulateShot.
const WALL_FRICTION=slideFriction('green');
const EDGE_MIN_RATE=2,EDGE_MAX_SWEEP=Math.PI*6;
// Penner (2002), equation 23: Holmes capture-envelope approximation.
// Full cup radius is the rolling support boundary, not cup radius minus ball radius.
export function cupCapture(old,p,velocity,pin){
 if(!pin)return false;const dx=p[0]-old[0],dz=p[2]-old[2],travel=dx*dx+dz*dz,u=clamp(((pin.x-old[0])*dx+(pin.z-old[2])*dz)/(travel||1),0,1),distance=Math.hypot(old[0]+u*dx-pin.x,old[2]+u*dz-pin.z);
 if(distance>=CUP_RADIUS)return false;const speed=Math.hypot(velocity[0],velocity[2]);
 const offset=speed>.001?Math.abs((pin.x-old[0])*velocity[2]-(pin.z-old[2])*velocity[0])/speed:distance;
 return speed<=1.63*Math.max(0,1-(offset/CUP_RADIUS)**2);
}
// The geometry behind a cup interaction: where the swept centre path comes
// closest to the middle of the hole, how far off the middle the line runs, and
// which side of the hole the ball is passing on.
export function cupApproach(old,p,velocity,pin){
 if(!pin)return null;
 const dx=p[0]-old[0],dz=p[2]-old[2],travel=dx*dx+dz*dz;
 const u=clamp(((pin.x-old[0])*dx+(pin.z-old[2])*dz)/(travel||1),0,1);
 const near=[old[0]+u*dx,old[2]+u*dz];
 const distance=Math.hypot(near[0]-pin.x,near[1]-pin.z);
 if(distance>=CUP_R)return null;
 const speed=Math.hypot(velocity[0],velocity[2]);
 // Perpendicular offset of the *line*, not of the sampled point: a long step
 // can straddle the hole and its endpoints both sit well away from the middle.
 const cross=speed>.001?((pin.x-old[0])*velocity[2]-(pin.z-old[2])*velocity[0])/speed:0;
 return {speed,offset:speed>.001?Math.abs(cross):distance,
  // Positive when the hole is to the left of travel, so the ball is passing on
  // the right and the rim turns it further right.
  side:cross>0?-1:1,near,distance};
}
// The drawn trunk uses this too, so a trunk you can see is a trunk you hit.
// The ceiling exists for a bad height rather than as a real limit, and at 3.6
// it no longer binds on anything the generator makes: a 380-foot redwood comes
// out at 3.1 m, and the old 2.4 clipped a metre off the widest of them.
// The floodlight mast, at its base where it is widest.
export const POLE_RADIUS=.34;
export function trunkRadius(tree){return NO_TRUNK.has(tree.kind)?0:tree.kind==='cactus'?.8:clamp((tree.h||16)*.027,.14,3.6);}
const hypot=Math.hypot;
export function airDensity(altitude=0,temp=18){const t=temp+273.15;return 101325*Math.exp(-G*0.0289644*altitude/(8.31446*t))/(287.058*t);}
// Lift and drag against the spin parameter S = |w|R/v, held in one place so the
// curve can be FITTED rather than asserted. Every shot goes through this, and
// nothing here knows or cares which club was swung -- S is computed from the
// ball's own speed and spin, both of which the launch monitor measures.
//
// FITTED 6 October against the three launch monitors the owner trusts most:
// Trackman's published PGA and LPGA tour averages (23 rows, driver to wedge), a
// GC3 session (111 shots, 58 deg wedge to 4 iron) and the owner's R50 session
// (115 shots, wedges to 5 wood; its driver swings were set aside as
// unrepresentative). Each source counts equally; peak height and carry in
// percent, carry at double weight, landing angle at a quarter; the two Trackman
// driver rows count four times each, since nothing else covers the club a
// player hits on every hole. `node tools/flight-fit.mjs` reruns it against the
// private data (docs/sources/private, not committed). RESEARCH.md *The flight
// refitted against three launch monitors* has every number.
//
// THE PROBLEM IT FIXED: a tilt. All three sources agreed that the old curve
// flew wedges slightly high and long irons and woods low -- the GC3 4 iron 10%
// low, the R50's long irons 11-12%, Trackman's 3 woods to 5 irons 5-21% -- while
// the averages looked fine, because the September fit had centred the average
// on a curve the wrong SHAPE. Peak height, typical miss, before -> after:
// GC3 4.7% -> 1.7%, R50 7.0% -> 2.8%, Trackman 8.3% -> 5.5%; carry stays within
// about 1% on average for all three.
//
// LIFT is a power law in S, CL = liftK * S^liftP - liftC: the form Smits and
// Smith fitted to their wind-tunnel data (0.54 * S^0.4), with a small offset that
// keeps the low-spin end (drivers) from lifting too hard. Fitted from their
// published curve as the starting point, it stays close to its shape. The
// square root it replaces was too stiff to bend the way the data wanted: fitted
// freely it drove its own floor negative and stopped producing a number at all.
// `liftCap` is a guard rail, not a shaping term (0.60 is reached past any golf
// shot) -- the cap that used to bend the curve held half a GC3 session down,
// and carry hid it, which is why apex is checked as well as carry, always.
//
// NO SPIN, NO LIFT (6 October): a ball that is not spinning has nothing to make
// it lift one way rather than another, so lift fades to zero below S = 0.04
// (`liftTaper`). Placed, not published, just under the lowest-spin real shots
// seen anywhere here (S 0.044-0.045); a tour drive is 0.08. Without it a 144 mph
// knuckleball off the R50 carried 111 yd where a ball with no lift carries 61-64.
//
// DRAG is a base, a step below the dimples' drag crisis, and a term rising with
// spin. Fitted, the step is much smaller than it was (0.032 against 0.22): the
// old step made slow, high wedges draggy in a way none of the three sources
// supported. The spin term stays near Bearman and Harvey's slope.
//
// REJECTED: making lift and drag depend on airspeed above iron speeds. It fitted
// Trackman's PGA driver exactly -- by making drag FALL with speed and cutting the
// driver's lift by half. Kensrud and Smith measured golf-ball drag RISING with
// speed past the drag crisis, and Smits and Smith found lift and drag
// independent of Reynolds number at fixed S across 100,000-250,000. Two rows of
// one source were bending the physics.
//
// SPIN DECAY (`spinTau`, seconds at 100 mph) scales with airspeed: the torque
// that slows the spin grows with speed, so a driver sheds spin faster than a
// wedge. Smits and Smith measured 23.8 s at 100 mph and Tavares, by radar, 18.9 s
// (both via Nathan 2008); 21.5 s sits between them. It was a fixed 24 s at every
// speed before. Fitted freely the decay went slower for wedges, and the tour
// wedge's spin-back on a Soft green tripled (2.4 -> 7.5 yd); held to the
// published rate it rises only to 4.6 yd -- possible, not routine.
//
// STILL OPEN, SAID PLAINLY: the PGA driver carries 262 against Trackman's 275
// and peaks about 4% high; the GC3's hang times run 0.7 s shorter than ours
// whatever the curve (weighting hang heavily moved it only to 0.66 s); and
// Trackman's long-iron landing angles are 4-6 deg steeper than ours while the
// GC3's, on near-identical shots, agree with ours to 0.2 deg -- the GC3 is
// followed there.
export const AERO={liftK:0.6781,liftP:0.2711,liftC:0.1856,liftCap:0.60,liftTaper:0.04,
 dragBase:0.2178,dragCrisis:0.03216,crisisRe:65000,crisisWidth:9000,spinDrag:0.3419,
 spinTau:21.5};
// The speed spinTau is quoted at: 100 mph, as Smits and Smith and Tavares quote theirs.
const SPIN_TAU_SPEED=100*MPH;
export function coefficients(speed,spin,rho=1.225){
 const re=rho*speed*R*2/0.0000181, s=Math.abs(spin)*R/Math.max(speed,0.1);
 const cd=AERO.dragBase+AERO.dragCrisis/(1+Math.exp((re-AERO.crisisRe)/AERO.crisisWidth))+AERO.spinDrag*Math.min(s,0.8);
 const taper=Math.min(1,s/AERO.liftTaper),fade=taper*taper*(3-2*taper);
 const cl=clamp(AERO.liftK*Math.pow(s,AERO.liftP)-AERO.liftC,0,AERO.liftCap)*fade;
 return {cd,cl};
}
// One step of a ball on the ground: sliding while the contact point has not
// caught up with the centre, rolling once it has.
//
// Extracted so the aim preview can run the same integration as the shot it is
// predicting. Two separate models is how a preview quietly stops matching the
// ball -- the old one was a flat, all-green closed form and the ball was neither.
// Mutates p, v and w in place and returns true once the ball has come to rest.
export function groundStep(course,p,v,w,dt,turf,skid={value:0}){
   const surface=course.surface(p[0],p[2]);
   const e=.05,dx=(course.height(p[0]+e,p[2])-course.height(p[0]-e,p[2]))/(2*e),dz=(course.height(p[0],p[2]+e)-course.height(p[0],p[2]-e))/(2*e),metric=1+dx*dx+dz*dz;
   const sx=v[0]-w[0],sz=v[2]-w[1],slip=hypot(sx,sz);
   if(slip>.012){
    // Sliding. The turf drags the centre back and spins the ball up until the
    // contact point catches it, which for a ball struck with no roll happens at
    // five sevenths of the launch speed. Gravity acts in full here: the 5/7 of
    // the rolling case comes from the rolling constraint, and that does not hold
    // yet. That does not mean a skidding putt breaks more, which was the first
    // guess and is wrong -- measured over a matched run it breaks about 1.5%
    // LESS, because the skid sheds speed roughly five times faster than rolling
    // does and so lasts far less time than the distance suggests. Break is the
    // time integral, and the shorter clock wins.
    const ux=sx/slip,uz=sz/slip,drag=slideFriction(surface)*G/Math.sqrt(metric);
    const gx=-G*dx/metric,gz=-G*dz/metric,vx0=v[0],vz0=v[2],before=[p[0],p[2]];
    v[0]+=(gx-drag*ux)*dt;v[2]+=(gz-drag*uz)*dt;
    w[0]+=2.5*drag*ux*dt;w[1]+=2.5*drag*uz*dt;
    p[0]+=(vx0+v[0])*.5*dt;p[2]+=(vz0+v[2])*.5*dt;p[1]=course.height(p[0],p[2])+R;
    skid.value+=hypot(p[0]-before[0],p[2]-before[1]);
    // Once the contact point has caught up the ball is rolling; an overshoot
    // inside one step is snapped rather than allowed to reverse the slip.
    if((v[0]-w[0])*ux+(v[2]-w[1])*uz<=0){w[0]=v[0];w[1]=v[2];}
    if(hypot(v[0],v[2])<.005){v[0]=0;v[1]=0;v[2]=0;w[0]=0;w[1]=0;return true;}
   }else{
   // Resistance is read AT THE CURRENT SPEED, which is the whole point of the
   // change: a ball rolling out from an approach is moving several times faster
   // than the Stimpmeter that calibrated the green.
   // MIDPOINT, not the speed at the start of the step. While the resistance was
   // a constant a first-order step was exact in it; now that it varies with
   // speed, taking it at the leading edge leaves an O(dt) bias, and that bias
   // showed up exactly where it would do most damage -- the Stimp run drifting
   // with the integration timestep, which is a thing a green speed must never do.
   const speed=hypot(v[0],v[2]);
   const lead=rollDecelerationAt(surface,turf,speed);
   const resistance=rollDecelerationAt(surface,turf,Math.max(0,speed-lead*dt*.5));
   const ax=-(5/7)*G*dx/metric,az=-(5/7)*G*dz/metric,friction=resistance/Math.sqrt(metric);
   if(speed<.005&&hypot(ax,az)<=friction){v[0]=0;v[1]=0;v[2]=0;w[0]=0;w[1]=0;return true;}
   // Apply gravity before a bounded resistance impulse: it cannot reverse a
   // stopped ball or inject energy on a flat surface, even at a long timestep.
   const vx=v[0],vz=v[2],cx=vx+ax*dt,cz=vz+az*dt,candidate=hypot(cx,cz),factor=Math.max(0,1-friction*dt/Math.max(candidate,1e-12));
   v[0]=cx*factor;v[2]=cz*factor;
   p[0]+=(vx+v[0])*.5*dt;p[2]+=(vz+v[2])*.5*dt;p[1]=course.height(p[0],p[2])+R;
   // The contact point tracks the centre it has caught, *after* the step. Set
   // before it, one step of deceleration reads as slip, and on a surface where
   // that exceeds the threshold the ball starts skidding and never stops.
   w[0]=v[0];w[1]=v[2];
   }
 return false;
}

// Where a struck ball will actually come to rest, and the line it takes getting
// there.
//
// This runs the real integration over the real ground: the slope it crosses, the
// surfaces it runs onto, the break that puts it somewhere other than where it
// was aimed. The preview it replaces was a closed form that assumed a flat green
// with no edges -- fine for the flat straight putt and wrong for every other
// one, and wrong in the direction that matters, since a downhill putt is exactly
// when you most want to know where it finishes.
//
// It deliberately ignores trees, houses and the cup. The first two would mean
// rebuilding a spatial index on every aim change, and the third would show the
// ball stopping at the hole when the question being asked is where it would go.
export function rollPreview(course,origin,aimDegrees,speed,options={}){
 const dt=options.dt||1/240,rad=Math.PI/180,yaw=aimDegrees*rad;
 const p=[origin.x,course.height(origin.x,origin.z)+R,origin.z];
 const v=[Math.sin(yaw)*speed,0,Math.cos(yaw)*speed];
 // Struck, not released: the contact point starts still, exactly as it does for
 // a putt in simulateShot.
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

export function simulateShot(shot,course,options={}){
 // LEFT AND RIGHT ARE THE GOLFER'S, AS A LAUNCH MONITOR REPORTS THEM: positive
 // `hla` starts the ball right of the aim line, positive `spinAxis` curves it
 // right. A hole's local +x is the player's LEFT (renderer.js, *Which side is
 // right*), so both enter the flight negated. Until 5 October they went in
 // as they came, and every monitor shot, and every shape set on the slider,
 // flew the mirror image of what it said -- while the readout, which made the
 // same mistake, agreed with the monitor.
 const dt=options.dt||1/240, rad=Math.PI/180, yaw=(shot.aim-shot.hla)*rad, pitch=shot.vla*rad;
 let v=[Math.sin(yaw)*Math.cos(pitch)*shot.speed,Math.sin(pitch)*shot.speed,Math.cos(yaw)*Math.cos(pitch)*shot.speed];
 // `height` starts the ball in the air instead of on the turf, which is how a
 // ball arriving on a green is put there: a descent angle and a landing speed
 // are what a launch monitor reports for an approach, and launching one from a
 // tee and hoping it arrives that way is not a controlled test.
 let p=[shot.origin.x,course.height(shot.origin.x,shot.origin.z)+R+(shot.height||0),shot.origin.z];
 const start=[...p],rho=airDensity(options.altitude||0,options.temperature??18),wind=options.wind||[0,0,0];
 const axis=-shot.spinAxis*rad; const wdir=[-Math.cos(yaw)*Math.cos(axis),Math.sin(axis),Math.sin(yaw)*Math.cos(axis)];
 let spin=shot.spin*Math.PI/30,rolling=shot.vla<2&&!(shot.height>0),carry=null,apex=0,landingSpeed=0,descentAngle=0,bounces=0;
 // The velocity the ball's contact point would need for it to be rolling. The
 // gap between this and the centre's velocity is the slip, and while there is
 // any the ball is sliding, not rolling.
 //
 // A ball launched along the ground is one of two quite different things. A
 // Stimpmeter release is already rolling -- that is what the ramp is for, and it
 // is why the deceleration it measures is pure rolling resistance. A struck putt
 // is not: it leaves the face sliding and the turf has to spin it up. They
 // arrived here indistinguishable, both {vla:0, spin:0}, so `roll` says which.
 let w=[0,0];
 if(rolling&&shot.roll){const s0=hypot(v[0],v[2])||1;w=[v[0]/s0*shot.roll,v[2]/s0*shot.roll];}
 const skidTotal={value:0};
 const points=[{x:p[0],y:p[1],z:p[2],t:0,v:hypot(...v),w:spin*30/Math.PI}],k=.5*rho*Math.PI*R*R/MASS;
 let holed=false,hazard=null,lipped=false,overCup=false,wall=null,edge=null;
 // Counted for the player's profile, and for nothing else: a strike is a
 // reflection of a ball moving INTO a trunk or a wall, not a frame spent touching one.
 let treeHits=0,homeHits=0;
 // The rim is cut turf, so it costs the ball what this green's turf costs it.
 const rimMu=rimResistance(options.turf);
 // A small spatial index includes neighboring holes without testing every trunk
 // at every integration step (sim drops may start anywhere on the course).
 const treeCells=new Map(),cellSize=24;
 // TRUNKS ARE NOT THE ONLY SOLID THING. Boulders reach six metres across on
 // mountain and desert and a ball flew straight through one, because rocks were
 // invented by the renderer and the world never knew where they were. They are
 // generated in course.js now and carry their own reach and crown height.
 //
 // Floodlight poles are handed IN rather than read off the course, because they
 // are only on the course when they are lit -- the whole group is hidden
 // otherwise, and colliding with an invisible mast is worse than not colliding
 // with a visible one. main.js passes them when the lights are up.
 //
 // Everything joins the same swept-circle test a trunk gets: they are all
 // vertical cylinders, so there is no second collision routine to keep honest.
 const solids=[...(course.world?.trees||course.trees||[])];
 for(const r of course.world?.rocks||[])
  solids.push({x:r.x,z:r.z,y:r.y,h:Math.max(.2,r.top-r.y),radius:r.reach});
 for(const q of options.poles||[])
  solids.push({x:q.x,z:q.z,y:q.y,h:q.height,radius:POLE_RADIUS});
 for(const source of solids){if(!(source.radius??trunkRadius(source)))continue;const tree=course.world?{...source,...course.toLocal(source)}:source,key=Math.floor(tree.x/cellSize)+','+Math.floor(tree.z/cellSize);if(!treeCells.has(key))treeCells.set(key,[]);treeCells.get(key).push(tree);}
 const treesAt=(p)=>{const result=[],x=Math.floor(p[0]/cellSize),z=Math.floor(p[2]/cellSize);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)result.push(...(treeCells.get(i+','+j)||[]));return result;};
 // Houses are solid: an oriented box for the walls with the roof folded in as
 // extra height. Indexed like trunks so a long shot does not test every home on
 // the course at every step.
 const homeCells=new Map();
 for(const source of course.world?.homes||course.homes||[]){
  const home=course.world?{...source,...course.toLocal(source)}:source,reach=Math.max(home.width,home.depth);
  for(let i=Math.floor((home.x-reach)/cellSize);i<=Math.floor((home.x+reach)/cellSize);i++)for(let j=Math.floor((home.z-reach)/cellSize);j<=Math.floor((home.z+reach)/cellSize);j++){const key=i+','+j;if(!homeCells.has(key))homeCells.set(key,[]);homeCells.get(key).push(home);}
 }
 const homesAt=(p)=>{const result=[],x=Math.floor(p[0]/cellSize),z=Math.floor(p[2]/cellSize);for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)result.push(...(homeCells.get(i+','+j)||[]));return result;};
 const accel=(vel,omega)=>{
  const u=vel.map((a,i)=>a-wind[i]),s=hypot(...u);if(s<.01)return [0,-G,0];
  const {cd,cl}=coefficients(s,omega,rho);
  const cross=[wdir[1]*u[2]-wdir[2]*u[1],wdir[2]*u[0]-wdir[0]*u[2],wdir[0]*u[1]-wdir[1]*u[0]];
  const n=hypot(...cross)||1;
  return u.map((a,i)=>-k*cd*s*a+k*cl*s*s*cross[i]/n-(i===1?G:0));
 };
 let t=0;
 for(let step=0;step<Math.ceil(70/dt);step++){
  t+=dt;
  const old=[...p];
  if(!rolling){
   // Midpoint RK2 integration at 240 Hz, stable across rendering frame rates.
   const a=accel(v,spin),vm=v.map((x,i)=>x+a[i]*dt/2),am=accel(vm,spin);
   p=p.map((x,i)=>x+vm[i]*dt);v=v.map((x,i)=>x+am[i]*dt);spin*=Math.exp(-dt*Math.hypot(...v)/SPIN_TAU_SPEED/AERO.spinTau);
  }else if(groundStep(course,p,v,w,dt,options.turf,skidTotal)){
   if(cupCapture(p,p,v,course.pin))holed=true;
   break;
  }
  const ground=course.height(p[0],p[2])+R,surface=course.surface(p[0],p[2]);
  // `v[1] <= 0` alone misses a ball that is still CLIMBING into rising ground.
  // On a steep slope the terrain can come up faster than the ball does, so the
  // ball ends a step below the surface while its vertical velocity is positive,
  // and the old condition let it sail straight through the hill -- measured at
  // 59 mm of penetration on a 39-degree slope. Being below the ground is a
  // collision whichever way the ball is travelling; the descending case keeps
  // its original touch-tolerant test so a ball resting on turf is unaffected.
  if(!rolling && !overCup && (p[1]<ground-1e-6 || (p[1]<=ground && v[1]<=0))){
   // Descent angle, taken HERE and nowhere else. It is the angle of the velocity
   // at the instant of first touchdown, which is the one moment it is defined --
   // reconstructing it afterwards from the point list means differencing across
   // the impact, or finding a later and smaller hop, and this project has made
   // both of those mistakes. The bounce reads it from the same velocity.
   if(carry===null){
    carry=hypot(p[0]-start[0],p[2]-start[2]);landingSpeed=hypot(...v);
    descentAngle=Math.atan2(-v[1],hypot(v[0],v[2]))/rad;
   }
   p[1]=ground;
   if(surface==='water'){hazard='Water';break;}
   const e=.1,n=[-(course.height(p[0]+e,p[2])-course.height(p[0]-e,p[2]))/(2*e),1,-(course.height(p[0],p[2]+e)-course.height(p[0],p[2]-e))/(2*e)];
   const nl=hypot(...n);for(let i=0;i<3;i++)n[i]/=nl;
   const groundNormal=[...n],incomingNormal=v.reduce((sum,a,i)=>sum+a*n[i],0),tangent=v.map((a,i)=>a-incomingNormal*n[i]),tangentSpeed=hypot(...tangent);
   // A compliant surface deforms in front of the ball (Penner's effective
   // contact-plane construction). Tilt grows with impact and vanishes at rest.
   // These bounded angles are tuning assumptions, not published fitted data.
   // Firmness moves all three of the contact constants below, and is 1x at
   // Normal by construction, so an existing course bounces exactly as it did.
   // Sand is excluded: a bunker is not turf and the instrument is not used on it.
   const firm=firmnessApplies(surface)?options.turf?.firmness:null;
   const contact=contactOf(surface);
   // `tiltScale`/`corScale` exist so the firmness model can be re-fitted against
   // this bounce without editing the table for every trial. Default 1: no effect.
   // Tilt is a SURFACE property now, not a firmness one. It used to rise as the
   // ground softened because it was the only thing that could shorten a roll;
   // ploughing does that job, so the climb out of the crater is left to the
   // canopy alone. The impulse path keeps the old behaviour.
   // THE DEFAULT. The instantaneous bounce is still reachable with
   // `compliant:false` for comparison, but the contact that takes time is what
   // the game plays on now.
   const compliant=options.compliant!==false;
   const tilt=contact.tilt*(firm===null||compliant?1:tiltScale(firm))*clamp(-incomingNormal/12,0,1)*(options.tiltScale??1);
   for(let i=0;i<3;i++)n[i]=groundNormal[i]*Math.cos(tilt)-tangent[i]/Math.max(tangentSpeed,1e-12)*Math.sin(tilt);
   const normalLength=hypot(...n);for(let i=0;i<3;i++)n[i]/=normalLength;const vn=v.reduce((sum,a,i)=>sum+a*n[i],0);
   // Coulomb impulse with solid-sphere rotational inertia (I=2mR²/5).
   // Turf compliance is represented by bounded restitution; it is not claimed
   // to reproduce the complete experimentally fitted elastoplastic model.
   // Restitution RISES as the impact slows.
   //
   // The table's value is the ELASTO-PLASTIC one: it is fitted to a dataset
   // dominated by fast impacts, where the ball craters the turf and most of the
   // energy goes into making the hole. A slow impact does not crater; it is an
   // elastic contact and returns far more. arXiv:2302.02758 says so in its own
   // conclusions -- their constant-restitution fit implies a ball at rest would
   // spontaneously lift off, which they call evidence "that a better model is
   // nonlinear", arising from "a dynamic transition elastic behaviour for low
   // normal velocity and elasto-plastic behaviour for higher speed bounces".
   //
   // Holding it constant is what made a ball look magnetised to the ground: the
   // second bounce came back at 6% of the first and the third did not happen,
   // because every bounce after the first was a slow impact being charged the
   // fast-impact price.
   //
   // PLASTIC_SPEED is set so the FIRST bounce still lands on the measured
   // anchor -- at a 7-iron's ~19 m/s the factor is 1.02, so the fitted 0.147 is
   // preserved to within 2% and only the later, slower bounces are lifted.
   const cor=contact.cor*elasticGain(incomingNormal)
    *(firm===null?1:compliant?compliantBounceScale(firm):bounceScale(firm))*(options.corScale??1);
   const normalImpulse=Math.max(0,-(1+cor)*vn),omega=wdir.map(a=>a*spin);
   const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],rotation=cross(omega,n);
   const slip=v.map((a,i)=>a-vn*n[i]-R*rotation[i]),slipSpeed=hypot(...slip),mu=contact.mu*(firm===null?1:gripScale(firm));
   let nextOmega;
   if(compliant){
    // The same bounce, resolved over the half millisecond it really occupies.
    // Reduced to the plane that contains the travel and the surface normal,
    // which is where all of it happens -- the paper is explicit that friction in
    // full 3D is "a far greater order of complexity", so side spin rides through
    // this untouched rather than being modelled badly.
    const tS=Math.max(tangentSpeed,1e-12),that=tangent.map(a=>a/tS);
    // Backspin measured so that positive drives the contact point FORWARD.
    const spinAxis=cross(n,that),back=-omega.reduce((sum,a,i)=>sum+a*spinAxis[i],0);
    // Damping is solved from the wanted restitution by bisection, which is far
    // too costly to redo on every bounce -- it runs the whole contact sixty
    // times. Memoised on the pair that determines it.
    const tuning=(options.compliant&&options.compliant!==true)?options.compliant:{};
    const out=compliantBounce({vx:tS,vy:vn,spin:back,radius:R},{
     friction:mu,
     spinGain:contact.spin===undefined?undefined:contact.spin*(firm===null?1:spinScale(firm)),
     plough:contact.plough*(firm===null?1:ploughScale(firm))*(options.ploughScale??1),
     wall:options.wall??WALL,craterRelief:options.craterRelief??CRATER_RELIEF,
     normalDamping:tuning.normalDamping??dampingCache(cor,mu),
     ...tuning,
    });
    // Back out of the plane: the new travel and rebound, and the spin change
    // applied about the axis the contact could actually torque.
    v=v.map((a,i)=>a+(out.vx-tS)*that[i]+(out.vy-vn)*n[i]);
    // THE GROUND CAN STOP A BALL. IT CANNOT PUSH IT BACKWARDS.
    //
    // Ploughing resists the turf ahead being shoved out of the way, and the tilt
    // is the ball climbing the crater it just made. Neither has anything behind
    // the ball to push against -- the turf back there is already disturbed. Yet
    // the tilt rotates the contact normal against the direction of travel, so
    // part of the REBOUND comes out as backward horizontal travel, and that kick
    // is nearly constant (0.41 to 0.64 m/s) because it scales with the rebound
    // rather than with anything the ball is doing forwards.
    //
    // On a green that does not matter: 2.62 m/s of forward speed survives the
    // contact and easily absorbs it. In rough only 0.10 m/s survives, so the
    // kick alone sent the ball out backwards at -0.31 m/s -- with, measured, 65
    // rpm of spin left on it, which is nothing. A ball does not come back out of
    // thick grass, and it certainly does not do so with no spin.
    //
    // So the tangential component is floored at zero. A BALL NEVER LEAVES ITS
    // FIRST BOUNCE TRAVELLING BACKWARDS, on any surface, at any firmness.
    //
    // That is a statement about golf, not about this model. A struck ball
    // arriving at a playing surface goes forward off the pitch mark; it is the
    // hops and the roll AFTER that which bring a spun ball home, and that is the
    // sequence anyone watching recognises -- one forward, then steeper, then
    // back. Nothing on a golf course kicks a ball straight back on contact.
    //
    // Two earlier versions of this rule were wrong. Flooring EVERY bounce killed
    // the legitimate reversal too and a green's check fell from -2.6 yd to -0.3.
    // Flooring only when the outgoing spin was non-positive let the fringe keep
    // hopping backwards, because it retains 1,338 rpm and the test passed it.
    // The bounce INDEX is the honest discriminator: the first contact is the one
    // that cannot reverse, and every one after it may.
    const along=v.reduce((sum,a,i)=>sum+a*that[i],0);
    if(along<0&&bounces===0)v=v.map((a,i)=>a-along*that[i]);
    nextOmega=omega.map((a,i)=>a-(out.spin-back)*spinAxis[i]);
    spin=hypot(...nextOmega);for(let i=0;i<3;i++)wdir[i]=nextOmega[i]/Math.max(spin,1e-12);
   }else{
   const impulse=Math.min(slipSpeed/3.5,mu*normalImpulse),J=slip.map(a=>-a*impulse/Math.max(slipSpeed,1e-12));
   v=v.map((a,i)=>a+normalImpulse*n[i]+J[i]);const torque=cross(n,J);nextOmega=omega.map((a,i)=>a-2.5/R*torque[i]);spin=hypot(...nextOmega);for(let i=0;i<3;i++)wdir[i]=nextOmega[i]/Math.max(spin,1e-12);
   }
   // SAND TAKES THE SPIN. A ball landing in a bunker buries itself in loose
   // sand -- the canopy column's 0.61 is the deepest grab on the course -- and
   // whatever spin it brought in goes into moving sand, not into the ball. The
   // contact above kept part of it (a wedge left a third of its backspin), and
   // on the next touchdown that dragged the ball back past its own mark: a
   // quarter of a yard on flat sand, the owner's "checks back in a bunker". With
   // nothing left to turn it, a ball in sand stops where the sand stops it, and
   // a face it landed on can only roll it back by gravity.
   if(surface==='sand'){nextOmega=[0,0,0];spin=0;}
   bounces++;
   const rebound=v.reduce((sum,a,i)=>sum+a*groundNormal[i],0);
   if(rebound<.65){rolling=true;const settleCross=cross(nextOmega,groundNormal),settleSlip=v.map((a,i)=>a-rebound*groundNormal[i]-R*settleCross[i]);v=v.map((a,i)=>a-rebound*groundNormal[i]-settleSlip[i]/3.5);v[1]=0;w=[R*settleCross[0],R*settleCross[2]];}

  }
  if(rolling&&surface==='water'){hazard='Water';break;}
  const wp=course.world?course.toWorld({x:p[0],z:p[2]}):null;if(wp?(Math.abs(wp.x)>course.world.halfX||Math.abs(wp.z)>course.world.halfZ):(Math.abs(p[0])>course.bounds.x||p[2]<course.bounds.minZ||p[2]>course.bounds.maxZ)){hazard='Out of bounds';break;}
  // Resolve penetration as well as swept contact. Reflect only incoming velocity;
  // an escaping ball must never be flipped back into the same trunk each tick.
  if(treeCells.size)for(const tree of treesAt(p)){
   const radius=(tree.radius??trunkRadius(tree))+R;if(radius<=R||Math.min(old[1],p[1])>tree.y+tree.h||Math.max(old[1],p[1])<tree.y)continue;
   const dx=p[0]-old[0],dz=p[2]-old[2],ox=old[0]-tree.x,oz=old[2]-tree.z,A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-radius*radius,disc=B*B-4*A*C;
   let u=C<0?0:A>1e-12&&disc>=0?(-B-Math.sqrt(disc))/(2*A):-1;if(u<0||u>1)continue;
   let nx=old[0]+u*dx-tree.x,nz=old[2]+u*dz-tree.z,n=hypot(nx,nz);if(n<1e-8){nx=-v[0];nz=-v[2];n=hypot(nx,nz)||1;if(n===1&&nx===0&&nz===0)nx=1;}nx/=n;nz/=n;
   const incoming=v[0]*nx+v[2]*nz;if(incoming<0){v[0]-=1.3*incoming*nx;v[2]-=1.3*incoming*nz;w=[v[0],v[2]];treeHits++;}
   p[0]=tree.x+nx*(radius+.003)+v[0]*dt*(1-u);p[2]=tree.z+nz*(radius+.003)+v[2]*dt*(1-u);if(rolling)p[1]=course.height(p[0],p[2])+R;break;
  }
  // Resolve the deepest overlap with a house and push the ball back out along
  // the face it entered, reflecting only incoming motion so a ball resting
  // against a wall can still be played away from it.
  if(homeCells.size)for(const home of homesAt(p)){
   const c=Math.cos(home.rotation),s=Math.sin(home.rotation);
   const dx=p[0]-home.x,dz=p[2]-home.z,lx=dx*c-dz*s,lz=dx*s+dz*c;
   const hx=home.width/2+R,hz=home.depth/2+R,top=home.y+home.height+2.6+R;
   if(Math.abs(lx)>hx||Math.abs(lz)>hz||p[1]>top||p[1]<course.height(p[0],p[2])-1)continue;
   const px=hx-Math.abs(lx),pz=hz-Math.abs(lz),py=top-p[1];
   let nx=0,ny=0,nz=0,push=0;
   if(py<=px&&py<=pz){ny=1;push=py;}
   else if(px<=pz){nx=Math.sign(lx)||1;push=px;}
   else{nz=Math.sign(lz)||1;push=pz;}
   const wx=nx*c+nz*s,wz=-nx*s+nz*c;
   p[0]+=wx*push;p[1]+=ny*push;p[2]+=wz*push;
   const incoming=v[0]*wx+v[1]*ny+v[2]*wz;
   if(incoming<0){const bounce=1.34;v[0]-=bounce*incoming*wx;v[1]-=bounce*incoming*ny;v[2]-=bounce*incoming*wz;v[0]*=.72;v[2]*=.72;w=[v[0],v[2]];homeHits++;}
   if(ny>0&&rolling)p[1]=Math.max(p[1],top);
   if(course.residentialOB){hazard='Out of bounds';}
   break;
  }
  if(hazard)break;
  // The cup, crossed rather than calculated.
  //
  // The ball used to be teleported: the drop was worked out analytically and it
  // was set down 75 mm past the middle with an upward velocity, so the recorded
  // path ran dead flat across the whole opening and then popped up well beyond
  // it. Now it genuinely goes over the hole -- unsupported, falling -- and the
  // far rim is met wherever and however it actually arrives there.
  if(course.pin){
   const gapX=p[0]-course.pin.x,gapZ=p[2]-course.pin.z,reach=hypot(gapX,gapZ);
   // The rim is not level. A cup is cut straight down into a sloping green, so
   // the lip follows the surface and the far side of a downhill putt sits LOWER
   // than the near side. That lowering is what cancels the head start a ball
   // gets from arriving already descending, and it is the reason the speed a
   // cup can catch barely moves with slope even though the launch that produces
   // it moves a lot. Treating the rim as a flat circle at the pin's height threw
   // the cancellation away and made downhill and flat identical.
   const rimHeight=(sx,sz)=>{const m=hypot(sx,sz);
    return m<1e-9?course.height(course.pin.x,course.pin.z)
     :course.height(course.pin.x+sx/m*CUP_R,course.pin.z+sz/m*CUP_R);};
   if(rolling&&reach<=CUP_R&&!edge&&!wall&&(v[0]*gapX+v[2]*gapZ)<0){
    // Its centre has reached the rim moving inward, so it is on the rim edge.
    // Whether it stays there is decided below by the contact force.
    const ux=gapX/(reach||1),uz=gapZ/(reach||1);
    const radial=v[0]*ux+v[2]*uz,tangential=v[0]*(-uz)+v[2]*ux;
    const alphaRate=-radial/R;
    // Whether the edge can hold it is decided BEFORE anything is integrated. A
    // firm putt arrives with alphaRate over a hundred radians a second, so a
    // single step would swing it thirty degrees round the tube and hand the ball
    // a metre a second of downward velocity it never had -- which swallowed
    // putts at twice the capture speed. N/m = g sin a + rho theta'^2 cos a
    // - r a'^2, and at a = 90 that is simply g - r a'^2.
    if(G-R*alphaRate*alphaRate<0){
     rolling=false;overCup=true;
     const e=.05;
     const gx=(course.height(p[0]+e,p[2])-course.height(p[0]-e,p[2]))/(2*e);
     const gz=(course.height(p[0],p[2]+e)-course.height(p[0],p[2]-e))/(2*e);
     v[1]=v[0]*gx+v[2]*gz;
    }else{
     // theta DECREASES as the ball runs along (-u_z, u_x): position is
     // (sin, cos) so its derivative in theta points the other way. Getting this
     // backwards curls the ball away from its own direction of travel and sends
     // it out behind the hole, which is the second time it has bitten me.
     edge={angle:Math.atan2(gapX,gapZ),rate:-tangential/CUP_R,
      alpha:Math.PI/2,alphaRate,swept:0};
    }
    if(carry===null)carry=0;
   }else if(rolling&&reach<CUP_R){
    // Nothing under it any more. Hand it to the airborne integrator and let it
    // fall; the cup is the one place the ground does not hold the ball up.
    //
    // It does NOT start from rest vertically. A ball rolling down a slope is
    // already descending at v.theta as it leaves the near rim, and that head
    // start is exactly what cancels the far rim being lower on a downhill putt.
    // Zeroing it here made capture 15% easier uphill than down.
    const e=.05;
    const gx=(course.height(p[0]+e,p[2])-course.height(p[0]-e,p[2]))/(2*e);
    const gz=(course.height(p[0],p[2]+e)-course.height(p[0],p[2]-e))/(2*e);
    rolling=false;v[1]=v[0]*gx+v[2]*gz;overCup=true;
    if(carry===null)carry=0;
   }else if(overCup){
    // The cup has a bottom. Nothing used to enforce it: a ball dropped straight
    // down the middle never touches a wall, so no regime owned it and it simply
    // fell, reaching 143 mm -- 62 mm THROUGH the floor -- still accelerating,
    // and stopped only when it happened to drift out far enough to catch the
    // wall. The capture animation then hauled it 50 mm back UP to the floor,
    // which is the teleport in reverse. The floor is flat and sits a cup depth
    // below the lip, wherever on the green that lip happens to be.
    const floor=course.height(course.pin.x,course.pin.z)-CUP_DEPTH+R;
    if(p[1]<=floor){p[1]=floor;v[1]=0;holed=true;break;}
    // "Over the cup" has to stop meaning that once the ball is no longer over
    // the cup. This flag suppresses the landing test -- the hole being the one
    // place the ground does not hold the ball up -- so a ball thrown clear of
    // the rim that kept the flag sank straight through the green at 86 mm out
    // and was then grabbed back to the wall at 32.6 mm, a 53 mm teleport at the
    // exact moment the camera is closest to it.
    if(reach>CUP_R){overCup=false;}else{
    // ONE contact test, because the rim is one shape.
    //
    // The ball meets the rim when its centre comes within a ball radius of the
    // rim CIRCLE -- radius CUP_R, at lip height -- and where it lands around that
    // circle's tube is exactly the alpha the edge regime below already uses.
    //
    // This was split in two before: "reached CUP_R" caught the far lip and
    // "below the green and past CUP_R - R" caught the wall, and between them sat
    // a wedge the ball flew straight through. A putt 50 mm out and 2 mm up has
    // its centre 4.6 mm from the rim circle -- buried in the rim -- and nothing
    // engaged until 54 mm, so it was snapped onto the wall a step later, 21 mm
    // backwards. It also made the hole NARROWER at 24 mm off line than at 48 mm,
    // which is nonsense the moment you say it out loud.
    const rimY=rimHeight(gapX,gapZ),aRad=CUP_R-R;
    const dRho=reach-CUP_R,dz=p[1]-rimY,gap=hypot(dRho,dz);
    // Above lip height the ball is held off by the sharp rim EDGE, so its centre
    // must stay a ball radius from the rim circle. Below lip height the edge is
    // behind it and the CYLINDER is what stops it, so its centre must stay
    // inside CUP_R - R. The two agree exactly at lip height, where both put the
    // centre at CUP_R - R, so the surface is continuous.
    //
    // Reaching for the rim circle below the lip as well -- which reads as the
    // tidier, more unified thing to do -- parks the ball five millimetres inside
    // the cup wall and the hole swallows everything: capture went to 6 m/s.
    const touching=dz>=0?gap<=R:reach>=aRad&&reach<CUP_R;
    if(!wall&&!edge&&touching&&reach>1e-9){
     const ux=gapX/reach,uz=gapZ/reach;
     const radial=v[0]*ux+v[2]*uz;
     // Only engage while it is moving INTO the rim. Leaving the near lip the
     // ball is also within a radius of the circle, and grabbing it there would
     // stop every putt on the edge it just rolled off.
     if(dz<0?radial>0:radial*dRho+v[1]*dz<0){
      const tangential=v[0]*(-uz)+v[2]*ux;
      // Where around the edge it landed. Only the quarter from a ball sitting on
      // the green (90) round to the top of the wall (180) is reachable.
      const alpha=dz<0?Math.PI:Math.min(Math.PI,Math.max(Math.PI/2,Math.atan2(dz,dRho)));
      const rho=dz<0?aRad:CUP_R+R*Math.cos(alpha);
      // Set it down ON the rim rather than wherever the step happened to end.
      p[0]=course.pin.x+ux*rho;p[2]=course.pin.z+uz*rho;
      if(dz>=0)p[1]=rimY+R*Math.sin(alpha);
      overCup=false;
      // The hole touched it. Whatever happens next -- round the wall, over the
      // lip, or thrown clear -- this ball was lipped. Setting the flag only on
      // the way back out over the rim missed every ball that was flung off the
      // edge instead, which reported as an untouched putt that happened to stop
      // in a strange place.
      lipped=true;
      if(dz<0){
       // BOTH of these are negated against `tangential`, and for the same
       // reason the edge below is. `tangential` is measured along (-u_z, u_x),
       // which is the OPPOSITE of the direction theta increases in: position is
       // rho(sin, cos), so dP/dtheta points along (cos, -sin). A wall rate of
       // +tangential/aRad therefore sends the ball round the cup against its own
       // direction of travel, and it visibly reverses the moment it takes the
       // wall -- which is exactly what it did, because when these two handoffs
       // were unified onto the edge's convention this one was left on the old
       // one. Fourth time a rotation sign has caught me out here.
       //
       // Spin about the outward normal is then -(speed along increasing theta)/R
       // = +tangential/R. A ball rolling forward carries it negative about the
       // OUTWARD axis: put omega = +v/R n into the ground rolling constraint and
       // the contact point moves at 2v rather than standing still. That sign
       // matters on its own account, because in u' = -5g/7r - (2/7) theta' w it
       // is what pushes the ball UP the wall, the way topspin climbs a wall.
       // Flipping rate and spin together leaves that product alone, which is why
       // the ball still rimmed out correctly -- just going the wrong way round.
       wall={angle:Math.atan2(gapX,gapZ),rate:-tangential/aRad,
        spin:tangential/R,u:v[1]/R,z:Math.min(p[1],rimY),swept:0};
      }else{
       // Velocity around the tube, projected onto the tangent (-sin a, cos a).
       // theta DECREASES as the ball runs along (-u_z, u_x): position is
       // (sin, cos) so its derivative in theta points the other way. Getting
       // this backwards curls the ball away from its own direction of travel.
       edge={angle:Math.atan2(gapX,gapZ),rate:-tangential/rho,alpha,
        alphaRate:(-radial*Math.sin(alpha)+v[1]*Math.cos(alpha))/R,swept:0};
      }
     }
    }
    }
   }
   // Running round the rim edge.
   if(edge){
    const rho=CUP_R+R*Math.cos(edge.alpha);
    const rimY=rimHeight(Math.sin(edge.angle),Math.cos(edge.angle));
    // What the lip is carrying, and how fast the contact is running over it.
    // The resistance opposes the direction of travel, which on the rim edge has
    // a component round the cup and a component round the tube of the edge
    // itself, so it is shared between the two in proportion.
    const load=Math.max(0,G*Math.sin(edge.alpha)+rho*edge.rate*edge.rate*Math.cos(edge.alpha)-R*edge.alphaRate*edge.alphaRate);
    const drag=rimMu*load;
    const along=rho*edge.rate,around=R*edge.alphaRate,path=hypot(along,around)||1e-9;
    // THE LIP CAN ONLY GRIP AS HARD AS THE BALL PRESSES ON IT -- the same rule
    // as the wall below it (3 October). Rolling round the edge's tube, the ball
    // centre accelerates at 5/7 of what gravity and going round push it with,
    // and the edge has to supply the other 2/7 as friction. Nothing checked it
    // could: a ball barely resting on the lip, pressing with a fraction of a g,
    // was held to the edge by grip it did not have, and rode it round up to 382
    // degrees before lipping out. When the rolling answer needs more than the
    // edge can give, the ball SLIDES over the edge instead, and `slip` -- the
    // contact surface's own speed round the tube -- runs free of the centre's.
    const push=-(rho*edge.rate*edge.rate*Math.sin(edge.alpha)+G*Math.cos(edge.alpha));
    const lipGrip=WALL_FRICTION*load,lipNeeded=-(2/7)*push;
    if(edge.slip===undefined)edge.slip=R*edge.alphaRate;
    const lipSlip=R*edge.alphaRate-edge.slip;
    if(Math.abs(lipSlip)<1e-3&&Math.abs(lipNeeded)<=lipGrip){
     edge.alphaRate+=((5/7)*push/R-drag*(around/path)/R)*dt;
     edge.slip=R*edge.alphaRate;
    }else{
     const f=Math.abs(lipSlip)>=1e-3?-Math.sign(lipSlip)*lipGrip:Math.sign(lipNeeded)*lipGrip;
     edge.alphaRate+=((push+f)/R-drag*(around/path)/R)*dt;
     // I = 2/5 m r^2: the friction that slows the centre spins the surface up.
     edge.slip+=-2.5*f*dt;
     if(Math.sign(R*edge.alphaRate-edge.slip)!==Math.sign(lipSlip||-f))edge.slip=R*edge.alphaRate;
    }
    edge.alpha+=edge.alphaRate*dt;
    // Angular momentum about the cup axis carries the ball round, so it speeds
    // up as it falls inward and slows as it climbs back out.
    const rhoNext=CUP_R+R*Math.cos(edge.alpha);
    edge.rate*=(rho/rhoNext)**2;
    edge.rate-=drag*(along/path)/rhoNext*dt;
    edge.angle+=edge.rate*dt;
    edge.swept+=Math.abs(edge.rate)*dt;
    const rho2=CUP_R+R*Math.cos(edge.alpha);
    p[0]=course.pin.x+Math.sin(edge.angle)*rho2;
    p[2]=course.pin.z+Math.cos(edge.angle)*rho2;
    p[1]=rimY+R*Math.sin(edge.alpha);
    const tangent=edge.rate*rho2;
    v[0]=Math.cos(edge.angle)*tangent-Math.sin(edge.angle)*R*Math.sin(edge.alpha)*edge.alphaRate;
    v[2]=-Math.sin(edge.angle)*tangent-Math.cos(edge.angle)*R*Math.sin(edge.alpha)*edge.alphaRate;
    v[1]=R*Math.cos(edge.alpha)*edge.alphaRate;
    const support=G*Math.sin(edge.alpha)+rho2*edge.rate*edge.rate*Math.cos(edge.alpha)-R*edge.alphaRate*edge.alphaRate;
    if(support<0){
     // Going inward too fast to be held by the edge: it flies off and crosses
     // the opening unsupported, which is what a firm putt through the middle
     // does. The threshold is alphaRate^2 > g/r, about 0.46 m/s of inward speed.
     overCup=true;rolling=false;edge=null;
    }else if(edge.alpha<=Math.PI/2){
     // Rolled back out over the lip and onto the green. Its centre is already at
     // CUP_R or beyond and at turf height, so there is nothing to move.
     rolling=true;overCup=false;w=[v[0],v[2]];edge=null;lipped=true;
     p[1]=course.height(p[0],p[2])+R;
    }else if(edge.alpha>=Math.PI){
     // Its centre has reached green level against the wall: the contact moves
     // from the edge to the wall, and the cylinder takes over.
     const aRad=CUP_R-R;
     // Negative for the same reason as above: rolling forward round the cup is
     // spin about the inward radial axis, not the outward one.
     wall={angle:edge.angle,rate:edge.rate,spin:-edge.rate*aRad/R,u:v[1]/R,z:p[1],swept:edge.swept};
     edge=null;
    }else if(Math.abs(edge.rate)<EDGE_MIN_RATE&&edge.alphaRate>0){
     // Too slow to be carried round and still falling inward: it drops in.
     const aRad=CUP_R-R;
     wall={angle:edge.angle,rate:Math.max(Math.abs(edge.rate),EDGE_MIN_RATE)*Math.sign(edge.rate||1),
      spin:-edge.rate*aRad/R,u:v[1]/R,z:p[1],swept:0};
     edge=null;
    }else if(edge.swept>EDGE_MAX_SWEEP){holed=true;break;}
   }
   // Rolling on the wall of the cup.
   //
   // A sphere rolling without slipping inside a vertical cylinder does not fall.
   // Its centre circles at CONSTANT angular speed and its height oscillates
   // harmonically -- gravity sets the depth it settles about, not a steady
   // descent. Working the rolling constraint through gives, with z' = r u and
   // w the spin about the outward normal:
   //
   //     theta'' = 0
   //     u'      = -5g/7r - (2/7) theta' w
   //     w'      = theta' u
   //
   // so u'' + (2/7) theta'^2 u = 0: simple harmonic, at sqrt(2/7) of the rate
   // the ball is going round. One full vertical cycle therefore takes
   // 2*pi/sqrt(2/7) = 11.76 radians of azimuth, so a ball that drops in at the
   // rim comes back up to it after sweeping about 337 degrees. THAT is the
   // horseshoe, and it comes out of the mechanics rather than out of a constant.
   //
   // How deep it dives is 7g/(2 theta'^2). Deeper than the cup and it reaches the
   // bottom and stays; shallower and it climbs back out. The two are equal at
   // about 0.67 m/s of tangential speed at the wall, which is the real line
   // between a putt that drops and one that spins out.
   if(wall){
    const aRad=CUP_R-R,rimY=rimHeight(Math.sin(wall.angle),Math.cos(wall.angle));
    // Normal force comes from going round; too slow and the wall cannot hold it.
    if(Math.abs(wall.rate)<WALL_MIN_RATE){holed=true;break;}
    // The wall is vertical, so everything holding the ball on it is the press of
    // going round: N/m = rho theta'^2, which at ordinary lip-out speeds is
    // several times the ball's weight. Rolling resistance is the green's own
    // coefficient times that load, split between going round the cup and running
    // up or down the wall.
    const load=aRad*wall.rate*wall.rate;
    const drag=rimMu*load;
    const along=aRad*wall.rate,climb=R*wall.u,path=hypot(along,climb)||1e-9;
    wall.rate-=drag*(along/path)/aRad*dt;
    // THE WALL CAN ONLY GRIP AS HARD AS THE BALL PRESSES INTO IT.
    //
    // Rolling without slipping, the equations above hold the ball up by
    // friction: the vertical grip it needs is (2/7)(g - r theta' w) per unit
    // mass. Nothing checked that the wall could supply it, and at the bottom of
    // a dive a slow ball needs MORE than its own weight while the wall presses
    // on it with barely one g -- a friction coefficient of 1.3 where turf and a
    // plastic liner give a third of that. So a ball that dropped in at walking
    // pace swooped down to ten millimetres off the floor, climbed back up the
    // wall, and went round two and a half times before anything caught it: the
    // "violent spinning in the cup" the owner saw.
    //
    // The grip available is the green's own sliding friction times the press of
    // going round, the same coefficient a skidding putt has on this turf. When
    // the rolling solution needs more, the ball SLIDES: friction is capped and
    // the spin about the direction of travel (`turn`, w_theta) runs free of the
    // fall, so it stops being held up and drops. A fast ball pressing at many g
    // still has the grip to climb, which is the horseshoe lip-out and stays.
    if(wall.turn===undefined)wall.turn=wall.u;
    const grip=WALL_FRICTION*load;
    const needed=(2/7)*(G-R*wall.rate*wall.spin);
    const slip=wall.u-wall.turn;
    if(Math.abs(slip)<1e-3&&Math.abs(needed)<=grip){
     wall.u+=(-5*G/(7*R)-(2/7)*wall.rate*wall.spin-drag*(climb/path)/R)*dt;
     wall.spin+=wall.rate*wall.u*dt;
     wall.turn=wall.u;
    }else{
     // Kinetic friction opposes the contact's vertical slip; at the moment
     // slipping starts it acts the way the rolling solution wanted, capped.
     const force=Math.abs(slip)>=1e-3?-Math.sign(slip)*grip:Math.sign(needed)*grip;
     const turn0=wall.turn;
     wall.u+=(force-G)/R*dt;
     // I = 2/5 m r^2: the same force spins the ball up about its direction of
     // travel, and the gyroscopic term trades that spin with w as it goes round.
     wall.turn+=(-wall.rate*wall.spin-force/(.4*R))*dt;
     wall.spin+=wall.rate*turn0*dt;
     // Caught up within the step: it is rolling again from here.
     if(Math.sign(wall.u-wall.turn)!==Math.sign(slip||-force))wall.turn=wall.u;
    }
    wall.z+=R*wall.u*dt;
    wall.angle+=wall.rate*dt;
    wall.swept+=Math.abs(wall.rate)*dt;
    p[0]=course.pin.x+Math.sin(wall.angle)*aRad;
    p[2]=course.pin.z+Math.cos(wall.angle)*aRad;
    p[1]=wall.z;
    const tangential=wall.rate*aRad;
    v[0]=Math.cos(wall.angle)*tangential;
    v[2]=-Math.sin(wall.angle)*tangential;
    v[1]=R*wall.u;
    if(wall.z<=rimY-CUP_DEPTH+R){p[1]=rimY-CUP_DEPTH+R;v[1]=0;holed=true;break;}
    if(wall.z>=rimY&&wall.u>0){
     // Climbed back to the level of the lip. This used to set the ball straight
     // down on the green, which moved it 28 mm outward in a single frame -- the
     // cylinder is at CUP_R - R and a ball resting beside the hole is at CUP_R,
     // and something has to cover that gap. The rim edge is what covers it, and
     // the torus below is already the right shape for it: alpha = 180 is exactly
     // the top of the wall and alpha = 90 is exactly a ball sitting on the green.
     // So hand it over instead of teleporting, and let the edge decide whether it
     // really gets out. Most do not, which is the whole character of a lip out.
     //
     // z = rimY + r sin(alpha), so at alpha = 180 the rise is -r alpha': the ball
     // climbing means alpha falls back toward 90.
     edge={angle:wall.angle,rate:wall.rate,alpha:Math.PI,alphaRate:-wall.u,swept:wall.swept};
     wall=null;
    }else if(wall.swept>WALL_MAX_SWEEP){holed=true;break;}
   }
  }
  apex=Math.max(apex,p[1]-start[1]);
  const detailed=course.pin&&hypot(p[0]-course.pin.x,p[2]-course.pin.z)<.5;
  if(detailed||step%4===0)points.push({x:p[0],y:p[1],z:p[2],t,v:hypot(v[0],v[1],v[2]),w:spin*30/Math.PI});
 }
 // Falling into the cup, continued from where the ball actually is.
 //
 // This used to restart the drop from lip+R -- the height of a ball sitting ON
 // the green -- whatever height the ball had already reached. A putt that had
 // fallen 22 mm into the hole jumped back up to the turf and sank a second time,
 // which is the teleport that showed on screen for every holed putt.
 if(holed){
  const entry=[...p],lip=course.height(course.pin.x,course.pin.z),duration=.34;
  // Resting on the floor of the cup means the centre sits one ball radius above
  // it, not an invented 115 mm. And the ball only ever settles DOWNWARD from
  // where it already is -- if it is already on the floor this does nothing but
  // walk it to the middle.
  const bottom=lip-CUP_DEPTH+R,drop=Math.min(0,bottom-entry[1]);
  points.push({x:p[0],y:p[1],z:p[2],t,v:hypot(v[0],v[1],v[2]),w:spin*30/Math.PI});
  const frame=duration/24;
  for(let i=1;i<=24;i++){
   const f=i/24,e=f*(2-f),was=p;
   p=[entry[0]+(course.pin.x-entry[0])*e,entry[1]+drop*f*f,entry[2]+(course.pin.z-entry[2])*e];
   // Report the speed this rattle is actually being drawn at rather than a
   // separate fade, so the shot panel and the path agree with each other.
   const moved=hypot(p[0]-was[0],p[1]-was[1],p[2]-was[2])/frame;
   points.push({x:p[0],y:p[1],z:p[2],t:t+duration*f,v:moved,w:spin*30/Math.PI*(1-e)});
  }
  t+=duration;
 }
 points.push({x:p[0],y:p[1],z:p[2],t});
 return {points,end:{x:p[0],y:p[1],z:p[2]},carry:carry??0,total:hypot(p[0]-start[0],p[2]-start[2]),apex,time:t,landingSpeed,descentAngle,skid:skidTotal.value,holed,lipped,hazard,treeHits,homeHits,onGreen:course.surface(p[0],p[2])==='green'};
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
