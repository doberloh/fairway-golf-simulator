import * as T from 'three';
import {fairwayWidth} from './course.js';
// The middle of the fairway, which is not the centre line it is drawn around:
// the two edges vary independently, so where one side runs wider the playable
// middle sits several metres off that line. Stub holes in tests carry a centre
// line and no edges, and fall back to it.
export function fairwayMiddle(h,z){
 const c=h.center(z);
 if(!h.leftWidth||!h.rightWidth)return c;
 const left=fairwayWidth(h,z,0,-1),right=fairwayWidth(h,z,0,1);
 return left+right>0?c+(right-left)/2:c;
}
// Where a tee is squared up: the middle of the fairway where the fairway starts.
// Fixed ground rather than a landing spot, so every tee on a hole points at the
// same place and the markers never depend on who is standing between them.
export function teeAim(h){
 const start=h.mowStart??h.fairwayStart??22;
 // A corridor is capped to nothing at its very start, so read the middle a
 // little inside it, where the fairway has actually opened out.
 const z=Math.min(h.length,start+14);
 return {x:fairwayMiddle(h,z),z};
}
export function fairwayAim(h,p,range){
 if(h.surface(p.x,p.z)==='green')return {...h.pin};
 let z=Math.max(0,p.z),remaining=Math.max(20,range),last={x:fairwayMiddle(h,z),z};
 while(z<h.length&&remaining>0){const nextZ=Math.min(h.length,z+2),next={x:fairwayMiddle(h,nextZ),z:nextZ};remaining-=Math.hypot(next.x-last.x,next.z-last.z);last=next;z=nextZ;}
 return z>=h.length?{...h.pin}:last;
}
export function cameraInsideTree(camera,t){const radius=t.r*1.9+1.5;return Math.hypot(camera.x-t.x,camera.z-t.z)<radius&&camera.y>t.y-.5&&camera.y<t.y+t.h*1.18+2;}
// The hole flyover.
//
// This is the main menu's camera, put over a hole you are playing: a wide slow
// circle of the whole thing, framed off the hole's own length exactly as the
// backdrop frames its showcase hole. It replaced a run up the fairway followed
// by a tight orbit of the green -- which showed the hole a piece at a time and
// never once showed its shape in the landscape around it.
//
// Same framing as the menu, at one and a half times its speed.
export const MENU_ORBIT_RATE = .075;
export const FLYOVER_RATE = MENU_ORBIT_RATE * 1.5;
// How far above whatever it is passing over the camera stays. A tree on this
// generator reaches 29 m, so this has to clear a canopy and not just the dirt --
// a flyover that skims through treetops reads as a bug even when the ground is
// technically below it.
const CLEARANCE = 34;
const RING = 96;

export function makeHoleTour(h) {
 const mid = {x: h.center(h.length * .5), z: h.length * .5};
 const centre = h.toWorld(mid), ground = h.height(mid.x, mid.z);
 const radius = Math.max(150, h.length * .85), lift = Math.max(55, h.length * .3);
 const at = a => ({x: centre.x + Math.sin(a) * radius, z: centre.z + Math.cos(a) * radius});
 // A hole cut into a hillside puts ground higher than the camera on one side of
 // the circle, so the orbit has to be lifted over it. Taking the clamp per frame
 // works but puts a corner in the path wherever the terrain crosses it, so the
 // whole ring is measured once and then smoothed: the camera rises to meet a
 // ridge before it arrives and settles again after it, which is what a
 // helicopter would do anyway.
 const terrain = h.world?.height ? (x, z) => h.world.height(x, z) : () => ground;
 // Each sample covers an arc, not a point: at this radius the steps are about
 // ten metres apart, and on steep ground the ridge between two samples is higher
 // than either of them. Measuring across the span is what keeps the clearance
 // honest -- sampling only the points let it fall to 19 m on mountain terrain.
 // Each sample covers ground, not a point. At this radius the steps are about
 // ten metres apart, so the ridge between two of them can be higher than either;
 // and a tree whose trunk stands a few metres off the flight line still puts its
 // canopy over it. Sampling along the arc AND a little to each side of it is what
 // keeps the clearance honest -- points alone let it fall to 19 m on mountains.
 const step = Math.PI * 2 / RING;
 let ring = Array.from({length: RING}, (_, i) => {
  let high = -Infinity;
  for (const along of [-.5, -.25, 0, .25, .5])
   for (const out of [-10, 0, 10]) {
    const a = (i + along) * step;
    const p = {x: centre.x + Math.sin(a) * (radius + out), z: centre.z + Math.cos(a) * (radius + out)};
    high = Math.max(high, terrain(p.x, p.z));
   }
  return Math.max(ground + lift, high + CLEARANCE);
 });
 for (let pass = 0; pass < 6; pass++)
  ring = ring.map((v, i) => {
   const before = ring[(i - 1 + RING) % RING], after = ring[(i + 1) % RING];
   // Smooth, but never below what the ground under this point demands.
   return Math.max(v, (before + v * 2 + after) / 4);
  });
 const heightAt = a => {
  const t = (a / (Math.PI * 2) % 1 + 1) % 1 * RING;
  const i = Math.floor(t), f = t - i;
  return ring[i % RING] * (1 - f) + ring[(i + 1) % RING] * f;
 };
 const duration = Math.PI * 2 / FLYOVER_RATE;
 function pose(seconds) {
  const a = FLYOVER_RATE * Math.min(seconds, duration), p = at(a);
  return {
   eye: new T.Vector3(p.x, heightAt(a), p.z),
   target: new T.Vector3(centre.x, ground + 8, centre.z),
   done: seconds >= duration,
  };
 }
 return {pose, duration, travel: 0, radius, centre, ground};
}
