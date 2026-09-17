// Firmness rides in the turf config so it reaches every physics call site the
// same way stimp does. It is a separate axis from roll and neither derives from
// the other: a green can be quick and soft, or slow and baked. See firmness.js.
import {firmnessValue} from './firmness.js';
export const DEFAULT_TURF={stimp:10,fairway:100,semi:100,rough:100,firmness:'Normal'};
export const STIMP_RELEASE_SPEED=1.83;
export function turfConfig(input={}){const p={...DEFAULT_TURF,...input};for(const [k,lo,hi]of [['stimp',6,15],['fairway',30,180],['semi',30,180],['rough',30,180]])if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Green Stimp must be 6–15 ft and turf roll 30–180%.');
 // Accepts a preset name or a number of inches; anything unrecognised reads as
 // Normal rather than throwing, because an old save has no firmness at all.
 p.firmness=firmnessValue(p.firmness);
 return p;}
// ROLLING RESISTANCE RISES WITH SPEED, and ignoring that is the single biggest
// error in an approach shot's run-out.
//
// A Stimpmeter releases its ball at 1.83 m/s. That is the ONLY speed at which
// the number on the sheet means anything, and everything below was applying it
// as a constant to balls moving far faster: a 2,000 rpm 7-iron enters its roll
// at 7.89 m/s -- 4.3x the calibration speed -- and the roll alone then bought it
// 62 of its 78 yd of release. A real ball deflects more grass the faster it
// goes, so treating the deceleration as flat lets a fast ball run forever.
//
// The gain below is written so the STIMPMETER RUN IS PRESERVED EXACTLY, for any
// gain and on every surface. Integrating v dv / a(v) from 0 to 1.83 returns the
// same distance it always did, because the ln(1+k)/k factor is precisely the
// renormalisation that makes it so. A green set to Stimp 11 still runs 11 feet.
//
// WHAT IS NOT ANCHORED is the gain itself. Nobody has handed us a measurement of
// how turf resistance grows with speed, so this is a fittable constant and it
// defaults to ZERO -- which reproduces the old flat law exactly, to the bit.
export const ROLL_SPEED_GAIN=1;
// FLAT UP TO THE STIMPMETER'S OWN SPEED, rising only above it.
//
// The first version of this scaled at every speed and renormalised to keep the
// Stimpmeter run right. That works arithmetically and is wrong in the hand: the
// renormalisation has to push the LOW-speed end down to pay for the high end, so
// a tap-in rolled 21% further than it used to. Nothing about a ball creeping to
// a stop should change because fast balls were mismodelled.
//
// So the law is flat below 1.83 m/s and only rises above. The Stimpmeter
// measures a ball decelerating from exactly 1.83 to rest -- entirely inside the
// flat region -- so its reading is preserved with no renormalisation at all, and
// every putt that never exceeds that speed is untouched to the bit.
export function rollSpeedGain(speed,k=ROLL_SPEED_GAIN){
 if(!(k>1e-9))return 1;
 const r=Math.max(0,speed)/STIMP_RELEASE_SPEED;
 return r<=1?1:1+k*(r-1)*(r-1);
}
// THE BASE deceleration -- the flat value, at the Stimpmeter's own speed.
// Every existing caller wants this one, and it is unchanged from before the
// speed law existed. Increasing roll% reduces resistance; Stimp is a level
// ground run in feet.
export function rollDeceleration(surface,input={}){
 const p={...DEFAULT_TURF,...input};
 return surface==='green'
  ? STIMP_RELEASE_SPEED**2/(2*p.stimp*.3048)
  : ({fringe:.95,fairway:1.45,tee:1.45,semi:2.35,rough:3.8,sand:6,water:8}[surface]||3.8)
    *100/(p[surface==='tee'?'fairway':surface]||100);
}
// What the ball actually feels AT A GIVEN SPEED. Only the rolling step in
// physics.js wants this; everything else works from the base.
export const rollDecelerationAt=(surface,input={},speed=STIMP_RELEASE_SPEED)=>
 rollDeceleration(surface,input)*rollSpeedGain(speed,(input||{}).rollSpeedGain??ROLL_SPEED_GAIN);
// How far the ROLL carries a ball that is already rolling at v0.
//
// This integral has a closed form, which is what kept the putting maths analytic
// when the deceleration stopped being constant: integral(v dv / a(v)) evaluates
// to vs^2 ln(1 + k v0^2/vs^2) / (2 ln(1+k) a0). At k = 0 it collapses to the
// v0^2/(2 a0) every textbook gives.
export function rollRun(v0,decel,k=ROLL_SPEED_GAIN){
 const v=Math.max(0,v0),vs=STIMP_RELEASE_SPEED;
 // Flat region: the textbook answer, exact.
 if(!(k>1e-9)||v<=vs)return v*v/(2*decel);
 // Above it, integrate the tail by Simpson. The lower half stays exact, and
 // this is only ever called from the putting preview and the putter's
 // calibration -- never per frame.
 const n=64,h=(v-vs)/n;
 let sum=0;
 for(let i=0;i<=n;i++){
  const u=vs+i*h,f=u/(1+k*(u/vs-1)*(u/vs-1));
  sum+=(i===0||i===n?1:i%2?4:2)*f;
 }
 return (vs*vs/2+sum*h/3)/decel;
}

// The skid.
//
// A Stimpmeter releases a ball that is already rolling -- that is the whole
// point of the ramp -- so the deceleration it measures, and everything above,
// is pure rolling resistance. A struck putt is not rolling. It leaves the face
// sliding, with the turf spinning it up until the contact point stops moving,
// and only then does the Stimp figure describe it.
//
// Sliding at mu, a ball with no initial spin reaches true roll at 5/7 of its
// launch speed, having covered 12 v^2 / (49 mu g). The roll that follows covers
// 25 v^2 / (98 a). Both are proportional to v^2, so total distance stays exactly
// quadratic in launch speed and only the constant moves -- which is why this can
// be added without the power control changing shape.
//
// mu is set so the skid is 15% of a putt on a Stimp 10 green, the figure
// measured for real putts and reported by launch monitors as skid distance. It
// lands at 0.305, the bottom of the 0.3-0.7 range quoted for ball on turf, and
// is best read as an effective value: a real putter has loft and delivers a
// little backspin, and this reproduces the observed skid rather than the
// separate launch mechanics that cause it.
export const SLIDE_FRICTION = 0.305;
// Longer grass grabs a sliding ball harder than it grabs a rolling one, so the
// skid is shorter off the green. These are simulator presets in the same spirit
// as the rolling values above, not agronomic measurements.
const SLIDE_BASE = {green: SLIDE_FRICTION, fringe: 0.35, fairway: 0.42, tee: 0.42, semi: 0.55, rough: 0.70, sand: 0.95};
export const slideFriction = surface => SLIDE_BASE[surface] ?? 0.70;
const GRAVITY = 9.80665;

// DISTANCE IS NO LONGER EXACTLY QUADRATIC IN LAUNCH SPEED, and that is the one
// real consequence of the speed law. The skid still goes as v^2; the roll no
// longer does, because a faster ball meets more resistance. Doubling the launch
// speed now gives less than four times the distance.
//
// Nothing downstream needed quadratic behaviour -- both callers of
// `launchForDistance` (the putter's calibration and the power slider) only need
// a correct inversion, and they get one.
const skidRun = (speed, mu) => 12 * speed * speed / (49 * mu * GRAVITY);
// Kept for callers that want the old constant, and exact whenever the gain is
// off. With the gain on it is the low-speed limit rather than a constant.
export function rollFactor(decel, mu = SLIDE_FRICTION) {
 return 12 / (49 * mu * GRAVITY) + 25 / (98 * decel);
}
export const struckDistance = (speed, decel, mu = SLIDE_FRICTION) =>
 skidRun(speed, mu) + rollRun(5 * speed / 7, decel);
// Inverted by bisection because the total is a quadratic plus a logarithm, which
// has no closed inverse. Monotonic in speed, so this is exact to the bit in
// sixty passes and costs nothing anybody can measure.
export function launchForDistance(distance, decel, mu = SLIDE_FRICTION) {
 const want = Math.max(0, distance);
 if (want === 0) return 0;
 let lo = 0, hi = 1;
 while (struckDistance(hi, decel, mu) < want && hi < 1e4) hi *= 2;
 for (let i = 0; i < 60; i++) {
  const mid = (lo + hi) / 2;
  if (struckDistance(mid, decel, mu) < want) lo = mid; else hi = mid;
 }
 return (lo + hi) / 2;
}
// The speed an ALREADY-ROLLING ball needs to cover a given distance -- the
// inverse of rollRun. sqrt(2 a d) is only right while the law is flat, so
// anything comparing a struck putt against a released one has to use this or it
// is comparing two different distances and calling the difference a result.
export function releaseForDistance(distance, decel, k = ROLL_SPEED_GAIN) {
 const want = Math.max(0, distance);
 if (want === 0) return 0;
 if (!(k > 1e-9)) return Math.sqrt(2 * decel * want);
 let lo = 0, hi = 1;
 while (rollRun(hi, decel, k) < want && hi < 1e4) hi *= 2;
 for (let i = 0; i < 60; i++) {
  const mid = (lo + hi) / 2;
  if (rollRun(mid, decel, k) < want) lo = mid; else hi = mid;
 }
 return (lo + hi) / 2;
}
// What share of the run is spent sliding rather than rolling. Speed-dependent
// now, so it takes the launch speed rather than assuming it cancels.
export const skidShare = (decel, mu = SLIDE_FRICTION, speed = 2) =>
 skidRun(speed, mu) / Math.max(1e-12, struckDistance(speed, decel, mu));
