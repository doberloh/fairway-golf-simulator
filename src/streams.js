import * as T from 'three';
export const BANK_COLORS={pnw:'#526343',midwest:'#697348',autumn:'#81724e',links:'#9c905e',desert:'#b49a73',mountain:'#7b8982',island:'#aaad7a'};
// How far a channel bed may be cut below the ground beside it. This is a design
// depth for a stream valley, not a budget for crossing the map: a route that
// would need more than this is trimmed back rather than trenched through.
export const MAX_CUT=9;
// STEEPEST GRADE A WATERCOURSE MAY DESCEND, as a fraction.
//
// This was 0.025, and it constrains the fitted water SURFACE, not the ground:
// where a valley falls faster than the surface is allowed to, the surface must
// sit below it and the difference is excavation. With channels drawn across the
// map it rarely bit, because they crossed contours anyway. Routed down real
// valleys it bites constantly -- a median cut of 6.91 m on ground the path
// descends by construction, which is absurd. A river runs at one or two per
// cent and a mountain creek at ten or more; 2.5 was never a physical figure.
export const STREAM_GRADE=.09;
// A CUT BANK, THE WAY A BUNKER HAS ONE.
//
// Water used to rise to meet its surroundings over 14 to 24 metres, which reads
// as a puddle in a saucer. A bunker reads as excavated because of two things
// together, and neither works alone: its floor sits about a metre below the
// ground around it, and the ground is held flat right to the rim before it
// drops. Water had neither -- its surface sat 0.18 m below the lowest bank
// sample, so even a razor-sharp edge would have been an invisible step.
//
// FREEBOARD is how far the surface sits below the rim; LIP is how far the drop
// is spread. Both in metres, and deliberately close to the bunker's 1.05 m over
// a comparable run, because matching that look is the whole point.
//
// The ocean is not given either of these: a coast is a beach, not a cut bank.
export const WATER_FREEBOARD=1.1, WATER_LIP=2.4;
// A THREE METRE CREEK DOES NOT GET A LAKE'S CUT BANK.
//
// The freeboard and the lip are one pair of numbers, and applied flat they gave
// a creek the same metre-plus drop as a lake -- which is not a bank, it is a
// slot, and it measured as a median slope of 0.33 at three metres out where the
// old profile was 0.01. A bank belongs to the thing it holds: scaled by width,
// a creek gets a few tens of centimetres and anything river-sized or larger
// keeps the full cut.
export const cutFor = width => {
 // Softened once seen: at the first scaling a 10 m river stood 0.95 m above its
 // own water over a 2.16 m lip -- 0.44, about 24 degrees -- which reads as a
 // trench rather than a bank on something you look along rather than across. A
 // pond is looked ACROSS and keeps the full cut; a channel gets roughly half the
 // rise over a wider lip, landing near 0.17.
 const t = Math.min(1, Math.max(0, (width - 2) / 10));
 return {freeboard: WATER_FREEBOARD * (.2 + .35 * t), lip: WATER_LIP * (.6 + .9 * t)};
};
// A trimmed end is a headwater or a sink, so it closes down over this distance
// instead of stopping at a blunt face.
export const FADE=46;
export function downhillProfile(points,height,maxCut=MAX_CUT){
 const survey=path=>path.map(p=>Math.min(...[-.7,0,.7].map(f=>height(p.x+p.nx*p.width*f,p.z+p.nz*p.width*f)))-cutFor(p.width).freeboard);
 const grade=(path,values)=>{const levels=[...values];for(let i=1;i<levels.length;i++)levels[i]=Math.min(levels[i],levels[i-1]-.00015*Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));for(let i=levels.length-2;i>=0;i--)levels[i]=Math.min(levels[i],levels[i+1]+STREAM_GRADE*Math.hypot(path[i].x-path[i+1].x,path[i].z-path[i+1].z));return {path,values,levels,cost:levels.reduce((n,y,i)=>n+(values[i]-y)**2,0)/levels.length};};
 const fit=path=>{const raw=survey(path),a=grade(path,raw),b=grade([...path].reverse(),[...raw].reverse());return a.cost<=b.cost?a:b;};
 // Levels only ever descend, so a hollow near the head pins every station after
 // it and each later ridge would have to be trenched through to hold that
 // level. Keep instead the longest run that stays within maxCut and let the
 // channel begin and end there. Re-fitting the shorter run frees its levels --
 // the running minimum restarts -- so the run usually grows back on the next
 // round; three rounds is enough to settle.
 let best=fit(points),trimmedHead=false,trimmedTail=false;
 for(let round=0;round<3;round++){
  const over=best.levels.map((y,i)=>best.values[i]-y>maxCut);
  if(!over.some(Boolean))break;
  let from=0,to=-1,start=0;
  for(let i=0;i<=over.length;i++){
   if(i<over.length&&!over[i])continue;
   if(i-start>to-from+1){from=start;to=i-1;}
   start=i+1;
  }
  if(to<from)return null;
  if(from>0)trimmedHead=true;
  if(to<best.path.length-1)trimmedTail=true;
  const kept=best.path.slice(from,to+1);
  if(kept.length<60)return null;
  best=fit(kept);
 }
 const path=best.path;
 path.forEach((p,i)=>{p.level=best.levels[i];const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],length=Math.hypot(b.x-a.x,b.z-a.z)||1;p.nx=(b.z-a.z)/length;p.nz=-(b.x-a.x)/length;});
 // A trimmed end has no mouth and no source, so close the channel down to
 // nothing across FADE rather than leaving a blunt face in the hillside.
 if(trimmedHead||trimmedTail){
  const run=[0];for(let i=1;i<path.length;i++)run.push(run[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));
  const total=run[run.length-1];
  path.forEach((p,i)=>{
   let t=1;
   if(trimmedHead)t=Math.min(t,run[i]/FADE);
   if(trimmedTail)t=Math.min(t,(total-run[i])/FADE);
   p.taper=Math.max(0,Math.min(1,t))**.7;
   p.width*=Math.max(.08,p.taper);p.depth*=p.taper;
  });
 }
 best.trimmedHead=trimmedHead;best.trimmedTail=trimmedTail;
 // Miter every station so a bend keeps its full width instead of pinching where
 // two strip quads meet. The limit holds the rendered bank within a few
 // centimetres of the analytic width used by contact, the shader and the map.
 path.forEach((p,i)=>{const q=path[Math.min(path.length-1,i+1)],dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz);p.miter=len>1e-6?Math.min(1.3,1/Math.max(.77,Math.abs(p.nx*dz/len-p.nz*dx/len))):1;});
 return best;
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Painted shore band widths, mirrored by the ground shader in ground.js. Keep
// the two in step: vegetation uses this to stay off the earth bank, grass
// standing on painted soil is what traces a channel as a green ribbon, and the
// mown band around water is placed OUTSIDE `outer`, so a wrong value here puts
// green turf under brown soil.
//
// This is now the shader's formula exactly. It had drifted -- 0.6 on the wet
// stop and 0.25 on the damp increment against the shader's single 0.32 -- and
// it carried no outer stop at all, which is the one the mown band needs. The
// caller supplies `cap` because a pond and a channel cap it differently.
export const shoreBands=(width,mown=false,cap=16)=>{
 const k=mown?.32:1;
 const wet=(.35+width*.05)*k,damp=wet+(.7+width*.09)*k;
 return {wet,damp,outer:Math.min(damp+Math.max(.4,(.8+width*.1)*k),Math.max(damp+.4,cap))};
};
// Off the cut bank itself: the painted soil is a lip now, and what grass must
// not do is stand out of a steep bank at an angle to it.
export const onShoreBank=(world,x,z,mown=false)=>{const q=world.streams?.at(x,z);return !!q&&q.edge<Math.max(WATER_LIP,shoreBands(q.width,mown).damp);};
// One Chaikin corner-cutting pass. Repeated passes round the corridor and
// densify it without moving it away from the generated centreline.
// NOTHING IS ROUTED OVER A GREEN.
//
// The drainage model raises greens and tees 60 m in its working height field,
// so water flows past them the way it flows past a hill, and the ROUTE obeys
// that. What does not obey it is everything applied afterwards: meander is up
// to 17 m of lateral displacement, and corner cutting pulls a path across the
// inside of its own bends. Measured, that put channel water on 3 greens in 216
// and as much as 16.2 m inside one.
//
// Tapering the meander near a green would only fix half of it, because corner
// cutting is the other half. So the FINISHED polyline -- the curve the player
// actually sees -- is pushed clear and re-smoothed, alternating until it
// settles, and the last act is a push rather than a smooth so the clearance is
// the thing that holds. A radial push is a translation: it cannot make a
// monotonically descending path climb, and `downhillProfile` re-surveys the
// ground underneath afterwards in any case.
function clearProtected(points,protect,width,corridor=()=>({d:Infinity,ux:0,uz:0})){
 const keepers=protect.filter(o=>o.keep),half=width*.5,lane=half+CORRIDOR_CLEAR;
 const n=points.length,rx=new Float64Array(n),rz=new Float64Array(n),dx=new Float64Array(n),dz=new Float64Array(n);
 const minRadius=Math.max(width*1.8,14);
 let run=0;for(let i=1;i<n;i++)run+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
 const span=run/Math.max(1,n-1);
 // A ROUTE THAT WILL NOT COME CLEAR IS THE WRONG ROUTE.
 //
 // The push and `relaxCurvature` can settle into a standoff rather than a
 // solution: measured on one mountain seed, the worst requirement cycled
 // 29.4 -> 24.2 -> 29.4 -> 24.2 and did that forever, because moving the curve
 // clear of the fairway made a bend the relax then took straight back out.
 // Damping does not help a two-state cycle; nothing about it is converging.
 //
 // When the two genuinely conflict, the honest answer is that water does not
 // belong on that line. Returning null rejects the route so the caller takes
 // the next-best catchment instead -- the same mechanism a bed that will not
 // fit its cut budget already uses.
 let settled=false;
 for(let round=0;round<60;round++){
  rx.fill(0);rz.fill(0);
  let worst=0;
  for(let i=0;i<n;i++){
   const p=points[i];let ax=0,az=0;
   // Radially out of anything that keeps a disc around itself.
   for(const o of keepers){
    const want=o.keep+half,ox=p.x-o.x,oz=p.z-o.z,d=Math.hypot(ox,oz);
    if(d>=want)continue;
    if(d<1e-6){ax+=want;continue;}
    ax+=ox/d*(want-d);az+=oz/d*(want-d);
   }
   // Out of a corridor, which is a strip and not a disc, so the push follows
   // the gradient of the corridor distance rather than a radius.
   const {d:c,ux,uz}=corridor(p.x,p.z);
   if(c<lane){
    const g=Math.hypot(ux,uz);
    if(g>1e-6){ax+=ux/g*(lane-c);az+=uz/g*(lane-c);}
   }
   rx[i]=ax;rz[i]=az;
   worst=Math.max(worst,Math.hypot(ax,az));
  }
  if(worst<.05){settled=true;break;}
  // THE DISPLACEMENT IS SMOOTHED ALONG THE PATH BEFORE IT IS APPLIED.
  //
  // Moving each station by what it needs and no more is what a first version
  // did, and it put a corner wherever the requirement changed from one station
  // to the next -- at the edge of a pond's keep-out, or where a corridor ends.
  // Measured, the tightest bend went to 0.00 of the half width, which folds the
  // inner bank through itself and flips the water quads face down. A smooth
  // displacement cannot do that: neighbouring stations move together, so the
  // curve is translated rather than creased. It also undershoots, which is why
  // the requirement is recomputed and reapplied until it stops changing.
  // THE BUMP NEEDS THE HEIGHT OF THE REQUIREMENT AND THE WIDTH OF THE
  // CURVATURE LIMIT, WHICH IS A DILATION AND NOT A BLUR.
  //
  // Two wrong versions of this, in opposite directions. Applying each station's
  // own requirement and nothing more put a corner wherever the requirement
  // changed, drove the tightest bend to 0.00x the half width and flipped the
  // water quads face down. Blurring the requirement instead fixed the corner
  // and broke the clearance: a blur conserves the total and crushes the PEAK,
  // so a station needing 8 m moved 1, and the violation got worse rather than
  // better -- 24 m inside a fairway where it had been 1.6.
  //
  // What is actually wanted is the same displacement spread over more stations
  // WITHOUT losing its height: each station takes the largest requirement in
  // its neighbourhood, tapered by distance. The peak survives, the detour is
  // wide, and `relaxCurvature` below leaves it alone because it is already the
  // shape relax would have made -- which is the point, since push and relax
  // undoing each other is what left three stations sitting in a fairway
  // forever with 70 m of open ground beside them.
  const w=Math.max(1,Math.min(40,Math.round(minRadius/Math.max(span,.5))));
  for(let i=0;i<n;i++){
   let bx=0,bz=0,best=0;
   for(let j=Math.max(0,i-w);j<=Math.min(n-1,i+w);j++){
    const t=1-Math.abs(i-j)/(w+1),f=t*t*(3-2*t),m=Math.hypot(rx[j],rz[j])*f;
    if(m>best){best=m;bx=rx[j]*f;bz=rz[j]*f;}
   }
   dx[i]=bx;dz[i]=bz;
  }
  // DAMPED, AND WITH A LIMIT ON HOW FAR A STATION MOVES IN ONE ROUND.
  //
  // Applied whole, a correction is a teleport: a station 25 m inside a corridor
  // asked for 32 m, jumped clean across the centreline of the hole next door,
  // had its outward normal flip, and came straight back. Measured, the worst
  // requirement went 40 -> 20 -> 34 -> 39 -> 10 -> 18 -> 27 -> 38 and never
  // settled. A channel walks out of a corridor over several rounds instead.
  //
  // But the limit has to be generous enough that the walk ARRIVES. At 5 m a
  // round the damped step was 2.75 m, so the worst case measured -- a head 87.5
  // m inside a corridor -- needed 32 rounds and had 30: the trace showed it
  // converging 87.5 -> 15.6 by round 24 and then turning round and climbing
  // again. Damping alone already lands short of the target every round, which
  // is geometric and settles; it was the flat cap that made it linear and made
  // it run out.
  for(let i=0;i<n;i++){
   const m=Math.hypot(dx[i],dz[i]);
   if(m<1e-9)continue;
   const k=CLEAR_DAMP*Math.min(1,CLEAR_STEP/m);
   points[i].x+=dx[i]*k;points[i].z+=dz[i]*k;
  }
  // RELAXED INSIDE THE LOOP, SO THE NEXT ROUND CHECKS ITS WORK. Run once after
  // the loop instead, this is the last thing to touch the curve and nothing
  // verifies it -- it pulls a station back across a boundary the loop had just
  // cleared, and the only reason that was invisible is that the displacements
  // happened to be small. A change to the tee ramps moved the terrain enough to
  // put 6 stations back inside a fairway. Here the loop either measures a clean
  // curve and exits, or corrects what the relax undid.
  relaxCurvature(points,minRadius);
 }
 return settled?points:null;
}

function chaikin(points){
 const out=[points[0]];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];for(const t of [.25,.75])out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,width:a.width+(b.width-a.width)*t});}
 out.push(points.at(-1));return out;
}
// Relax any turn tighter than the channel can render or carve. A bend sharper
// than its own half-width folds the bank strip back through itself and leaves
// the painted bed disagreeing with the analytic water edge.
export function relaxCurvature(points,minRadius,passes=60){
 for(let pass=0;pass<passes;pass++){let worst=0;
  for(let i=1;i<points.length-1;i++){
   const a=points[i-1],p=points[i],b=points[i+1],ax=p.x-a.x,az=p.z-a.z,bx=b.x-p.x,bz=b.z-p.z;
   const la=Math.hypot(ax,az)||1e-6,lb=Math.hypot(bx,bz)||1e-6,turn=Math.abs(Math.atan2(ax*bz-az*bx,ax*bx+az*bz)),limit=Math.min(la,lb)/minRadius;
   if(turn<=limit)continue;worst=Math.max(worst,turn);
   const pull=Math.min(.5,1-limit/turn);p.x+=((a.x+b.x)/2-p.x)*pull;p.z+=((a.z+b.z)/2-p.z)*pull;
  }
  if(!worst)break;
 }
 return points;
}
// A CHANNEL RUNS TO THE SEA, NOT ACROSS IT.
//
// Channels are drawn across a span that reaches well past the course, which on
// an inland map is only wasted length -- the profile trims it. On an island it
// put 87 to 95 per cent of every river's stations on the seabed, drawn as a
// creek lying on the ocean floor. Keeping the longest run that stays on land
// cuts the channel back to the shoreline, and because the profile then closes a
// trimmed end down to nothing, what is left ends by fading out where it meets
// the water -- which is what a mouth looks like.

// DRAINAGE, COMPUTED OVER THE WHOLE MAP AT ONCE.
//
// Two earlier attempts routed a channel as a PATH: a bearing plus harmonics
// drawn across the map, then a downhill walk. Both failed in the same way, for
// the same reason -- a path is a local, greedy thing with no memory of where it
// has been, so nothing in it forbids returning to ground it has already
// crossed. The walk was the worse of the two: meander applied as a heading
// ROTATION integrates, and a constant bend is a circle. Measured, channels
// turned through 12 to 19 full circles each, with 2716 self-overlapping station
// pairs on one river. The turn cap added to bound curvature did not prevent
// that; it set the radius of it.
//
// Water does not choose a path. It occupies the one the land already has. So
// the land is solved first, over a coarse grid, and a watercourse is read off
// the answer:
//
//   fill  - depressions are flooded to a spill height, so every cell has a way
//           out, EXCEPT the large ones, which are left as the lakes they are
//   flow  - each cell points at its steepest lower neighbour
//   drain - how much land arrives through each cell
//
// A channel is then a walk DOWN the flow directions, and it cannot spiral or
// cross itself however the meander is tuned, because every step is strictly
// lower than the last. That is a property of the construction rather than a
// number to tune, which is the whole reason for the rewrite.
const FLOW_CELL = 10;
// Depressions smaller than this are noise and get flooded. Larger ones survive
// as terminal water: a terminal pond should read as a destination, not as a
// puddle every creek trips into.
//
// Swept once corridors were being routed around, over 24 courses:
//
//   40 000  70 channels, median 603 m, 1 sink,  17 faded out
//   15 000  70 channels, median 470 m, 8 sinks,  9 faded out
//    6 000  65 channels, median 389 m, 14 sinks, 1 faded out
//
// 15 000 is the one that is not a trade. It keeps every channel the larger
// figure did and shortens them only a little, while turning ugly endings into
// real ones -- a channel that fades out partway down a hillside has run out of
// cut budget, and a channel that ends in a pond has arrived somewhere. At 6 000
// the fill stops doing its job: five channels are lost outright and the
// survivors are a third shorter, which is the model tripping into puddles
// again.
const SINK_FILL_AREA = 15000;

// How far a channel is kept out of a playing corridor, past the semi-rough the
// corridor distance already includes. The water and a little margin; the BANK
// is still allowed to taper into the rough, which is what the mown band around
// water is there to handle.
const CORRIDOR_CLEAR = 4;
// The ridge raised along a corridor in the working height field. Lower than the
// 60 m over a green because a corridor is a long wall rather than a dome, and a
// course is mostly corridors -- too high and the gaps between holes stop being
// a route and start being a maze with no way through.
const CORRIDOR_RIDGE = 22, CORRIDOR_REACH = 45;
// Over what distance a channel comes down to the level of the pond it ends in.
const SINK_RAMP = 60;
// How hard the keep-out pushes per round, and the furthest one station travels
// in a round. Both exist to stop the correction overshooting into the hole on
// the other side; neither changes where the curve ends up, only how it gets
// there.
const CLEAR_DAMP = .55, CLEAR_STEP = 20;

function drainage(height, halfX, halfZ, protect, isSea, corridor) {
 const cell = FLOW_CELL;
 const nx = Math.ceil(halfX * 2 / cell) + 1, nz = Math.ceil(halfZ * 2 / cell) + 1;
 const n = nx * nz;
 const H = new Float32Array(n), sea = new Uint8Array(n);
 // WHICH CELLS ARE ON A PLAYING CORRIDOR.
 //
 // Raising a corridor into a hill is what stops water crossing it -- and a hill
 // is also where water STARTS. The upstream trace that finds a channel's head
 // climbs the steepest parent, so it climbs the new hill and puts a headwater
 // in the middle of a fairway. Measured right after the ridge fix: two courses
 // in thirty had a creek whose first 29 stations ran down hole 3, 26.8 m inside
 // it. The keep-out pass downstream cannot repair that, because a source is not
 // a detour -- there is no direction to push it that makes it belong. So the
 // head is excluded here, where it is chosen.
 const clear = new Float32Array(n);
 const X = i => -halfX + (i % nx) * cell, Z = i => -halfZ + Math.floor(i / nx) * cell;
 for (let k = 0; k < n; k++) {
  const x = X(k), z = Z(k);
  let y = height(x, z);
  // Greens, tees and bunkers are RAISED rather than steered around. Water then
  // flows past them for the same reason it flows past a hill, and the path stays
  // a pure descent -- steering a path is what reintroduces the ability to loop.
  for (const o of protect) {
   const d = Math.hypot(x - o.x, z - o.z), reach = o.r + 25;
   if (d < reach) y += 8 * (1 - d / reach) ** 2;
  }
  // A FAIRWAY IS A HILL TOO. Water crossing a corridor was a feature until the
  // owner asked for it gone, and the way to remove it is the way greens are
  // handled: raise the ground rather than steer the path, so the route is a
  // pure descent that happens to run between the holes.
  // A RIDGE THAT KEEPS RISING INWARD, NOT A PLATEAU.
  //
  // This clamped the corridor distance at zero, so everywhere INSIDE a corridor
  // got the same 22 m. A constant offset preserves the gradient underneath it
  // exactly: the corridor became a raised plateau that water ran through the
  // way it always had, and the ridge only ever steered at the edges. Routes
  // came out 40 m inside a fairway, and the keep-out pass downstream was left
  // trying to repair that station by station -- which is a repair pass being
  // asked to do a router's job, and it oscillated rather than converging.
  //
  // Letting the term grow past 1 makes the corridor an actual hill. Capped,
  // because the fill has to stay numerically sane.
  // Asked ONCE. `corridor` walks every hole to find the nearest centreline and
  // is 15% of a course's whole generation time; calling it twice per cell for
  // the ridge and again for the clearance simply doubled that.
  const gap = corridor(x, z).d, t = (CORRIDOR_REACH - gap) / CORRIDOR_REACH;
  if (t > 0) y += CORRIDOR_RIDGE * Math.min(9, t * t);
  clear[k] = gap;
  H[k] = y;
  sea[k] = isSea(x, z) ? 1 : 0;
 }

 // PRIORITY FLOOD. Growing inward from the edges and from the sea, always
 // taking the lowest frontier cell, floods every depression to exactly the
 // height of its spill point. The epsilon leaves a faint gradient across a
 // filled flat so it still has a direction to drain.
 const F = new Float32Array(n).fill(Infinity);
 const seen = new Uint8Array(n);
 const heap = [];
 const push = k => { heap.push(k); let i = heap.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (F[heap[p]] <= F[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
 const pop = () => { const top = heap[0], last = heap.pop();
  if (heap.length) { heap[0] = last; let i = 0;
   for (;;) { const l = i * 2 + 1, r = l + 1; let m = i;
    if (l < heap.length && F[heap[l]] < F[heap[m]]) m = l;
    if (r < heap.length && F[heap[r]] < F[heap[m]]) m = r;
    if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
  return top; };
 for (let k = 0; k < n; k++) {
  const i = k % nx, j = (k / nx) | 0;
  if (i && j && i < nx - 1 && j < nz - 1 && !sea[k]) continue;
  F[k] = H[k]; seen[k] = 1; push(k);
 }
 const EPS = 1e-3;
 const around = k => { const i = k % nx, j = (k / nx) | 0, out = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
   if (!di && !dj) continue;
   const a = i + di, b = j + dj;
   if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
   out.push(b * nx + a);
  } return out; };
 while (heap.length) {
  const k = pop();
  for (const m of around(k)) {
   if (seen[m]) continue;
   F[m] = Math.max(H[m], F[k] + EPS); seen[m] = 1; push(m);
  }
 }

 // Which filled cells were actually under water, and how big was each pool.
 // A large one is kept as a SINK -- a depression the fill deliberately left
 // alone, because it is a real low point in the landscape rather than noise.
 // Its cells drain nowhere, so a channel arriving at one ends there, and the
 // course builder puts a pond in it. Note this is a hollow in the ground and
 // not a body of water: nothing has been dug or filled here yet.
 const pooled = new Uint8Array(n);
 for (let k = 0; k < n; k++) if (F[k] > H[k] + EPS * 2) pooled[k] = 1;
 const sink = new Uint8Array(n);
 const label = new Int32Array(n).fill(-1);
 const pools = [], bottom = [];
 for (let k = 0; k < n; k++) {
  if (!pooled[k] || label[k] >= 0) continue;
  const id = pools.length, stack = [k], members = [];
  label[k] = id;
  while (stack.length) { const c = stack.pop(); members.push(c);
   for (const m of around(c)) if (pooled[m] && label[m] < 0) { label[m] = id; stack.push(m); } }
  pools.push(members);
  // The bottom of the bowl, which is where water arriving in it actually ends
  // up -- not the centroid, which on a depression spanning 800 m is a point
  // several hundred metres from anything.
  let low = members[0];
  for (const c of members) if (H[c] < H[low]) low = c;
  bottom.push(low);
  if (members.length * cell * cell > SINK_FILL_AREA) for (const c of members) sink[c] = 1;
 }

 // FLOW DIRECTION on the filled surface. A sink cell drains nowhere.
 const down = new Int32Array(n).fill(-1);
 for (let k = 0; k < n; k++) {
  if (sink[k] || sea[k]) continue;
  let best = -1, bestSlope = 0;
  for (const m of around(k)) {
   const dist = (m % nx !== k % nx && ((m / nx) | 0) !== ((k / nx) | 0)) ? Math.SQRT2 : 1;
   const slope = (F[k] - F[m]) / dist;
   if (slope > bestSlope) { bestSlope = slope; best = m; }
  }
  down[k] = best;
 }

 // ACCUMULATION: how much land arrives through each cell. Processing from the
 // top down means a cell's own total is complete before it is passed on.
 const order = Array.from({length: n}, (_, k) => k).sort((a, b) => F[b] - F[a]);
 const acc = new Float32Array(n).fill(1);
 for (const k of order) if (down[k] >= 0) acc[down[k]] += acc[k];

 return {nx, nz, cell, n, H, F, down, acc, sink, label, sea, clear, pools, bottom, X, Z, neighbours: around};
}

// The channels themselves, strongest first. A river is not labelled a river --
// it is the path that drains the most land, which is what makes one.
function channels(model, count, used) {
 const {n, nx, nz, down, acc, sink, label, sea, clear, bottom, X, Z} = model;
 // HOW FAR CLEAR A HEADWATER HAS TO START.
 //
 // Excluding only cells actually on a corridor moved the count from 29 to 18,
 // not to zero: the trace then stopped at the first cell off the fairway, which
 // is the fairway EDGE, and meander walked the source straight back on. A
 // source has to begin somewhere a few metres of wander cannot undo.
 const HEAD_CLEAR = 20;
 // A CHANNEL DOES NOT STOP AT THE RIM OF A HOLLOW.
 //
 // Every cell of a surviving depression has down = -1, by construction -- that
 // is what "the fill left this one alone" means -- so the descent broke the
 // instant it arrived. Measured, the channel was ending between 3.5 and 21.0 m
 // ABOVE the floor of the bowl it had just reached, which is water stopping
 // partway down a hillside. It crosses to the bottom instead, stepping one cell
 // at a time and taking, of the three neighbours that make progress toward the
 // low point, whichever sits lowest -- so it follows the shape of the bowl
 // rather than cutting a chord across it.
 const cross = (from, target, push) => {
  let k = from;
  for (let guard = 0; guard < 400 && k !== target; guard++) {
   const tx = X(target) - X(k), tz = Z(target) - Z(k), len = Math.hypot(tx, tz) || 1;
   let best = -1, bestH = Infinity;
   for (const m of model.neighbours(k)) {
    const dx = X(m) - X(k), dz = Z(m) - Z(k);
    if ((dx * tx + dz * tz) / (Math.hypot(dx, dz) * len) < .5) continue;
    if (model.H[m] < bestH) { bestH = model.H[m]; best = m; }
   }
   if (best < 0) break;
   k = best; push(k);
  }
  return k;
 };
 // A CELL ON THE GRID BORDER IS NOT A SINK. The priority flood seeds the
 // border and leaves it with no lower neighbour, so `down` is -1 there for
 // exactly the same reason it is -1 in a genuine depression -- and reading
 // that as a sink classified all 44 of them as one, every single one of them
 // sitting hard against the edge of the map. The two cases have to be told
 // apart before anything is built at the end of a channel.
 const border = k => { const i = k % nx, j = (k / nx) | 0; return !i || !j || i === nx - 1 || j === nz - 1; };
 const order = Array.from({length: n}, (_, k) => k).sort((a, b) => acc[b] - acc[a]);
 const out = [];
 for (const seed of order) {
  if (out.length >= count) break;
  if (used[seed] || sink[seed] || sea[seed] || clear[seed] < HEAD_CLEAR) continue;
  // Far enough from water already claimed to be a catchment of its own.
  if (out.some(c => c.points.some(p => Math.hypot(p.x - X(seed), p.z - Z(seed)) < 60))) continue;
  // Upstream along the strongest parent, to find where this water starts.
  let head = seed;
  for (let guard = 0; guard < 4000; guard++) {
   let bestParent = -1, bestAcc = 0;
   for (const m of model.neighbours(head)) if (down[m] === head && acc[m] > bestAcc && !used[m] && clear[m] >= HEAD_CLEAR) { bestAcc = acc[m]; bestParent = m; }
   if (bestParent < 0) break;
   head = bestParent;
  }
  // Downstream to the outlet: the sea, a sink, another channel, or off the map.
  const path = [];
  let k = head, end = 'edge', pool = -1;
  for (let guard = 0; guard < 8000; guard++) {
   path.push(k); used[k] = 1;
   const d = down[k];
   if (d < 0) { if (sink[k]) { end = 'sink'; pool = label[k]; cross(k, bottom[pool], c => { path.push(c); used[c] = 1; }); } else end = border(k) ? 'edge' : 'stall'; break; }
   if (sea[d]) { end = 'sea'; break; }
   if (sink[d]) { path.push(d); used[d] = 1; end = 'sink'; pool = label[d]; cross(d, bottom[pool], c => { path.push(c); used[c] = 1; }); break; }
   // A tributary stops where it meets water already claimed. That is a
   // confluence, and it is also what stops a second channel retracing the
   // first one's whole length down to the same outlet.
   if (used[d]) { path.push(d); end = 'confluence'; break; }
   k = d;
  }
  if (path.length < 12) continue;
  out.push({points: path.map(c => ({x: X(c), z: Z(c)})), end, pool, drained: acc[seed]});
 }
 return out;
}

export function generateStreams(s,holes,halfX,halfZ,height,random,isSea=()=>false,corridor=()=>({d:Infinity,ux:0,uz:0}),onSink=null){
 const rng=random(s.seed+':streams'),specs=[...Array(s.rivers||0).fill('river'),...Array(s.creeks||0).fill('creek')],streams=[],segments=[],cells=new Map(),cellSize=40,reach=Math.hypot(halfX,halfZ)+210;
 const protect=holes.flatMap(h=>[{...(h.worldGreen??h.worldPin),r:h.greenSize*h.greenAspect+s.fringe+30,keep:h.greenSize*h.greenAspect+s.fringe+8},...Object.values(h.tees).map(t=>({...h.toWorld(t),r:18,flat:14,keep:16})),...h.ponds.map(p=>({...h.toWorld(p),pond:true,r:Math.max(p.reachX||p.rx,p.rz)+(p.shoreWidth||14)+12,keep:Math.max(p.reachX||p.rx,p.rz)+(p.shoreWidth||14)+12}))]);
 // Bunkers are excavated dry hazards: a channel crossing one would leave water
 // standing in sand. They are avoided too, and are dropped only when a course is
 // so tight that no route exists around them.
 // Prefer a generous berth, then a tight squeeze, and only then give up on sand.
 // A course that forces the last tier has its crossed bunkers washed out in
 // generateWorld, so water never actually stands in a playable bunker.
 // The land is solved once, and every channel is read off that one answer --
 // which is also what makes a creek a tributary of a river rather than an
 // independent squiggle that happens to be narrower.
 const model = specs.length ? drainage(height, halfX, halfZ, protect, isSea, corridor) : null;
 const claimed = model ? new Uint8Array(model.n) : null;
 // More candidates than channels asked for, because a route can be found and
 // then turn out to be unusable -- the bed will not fit within MAX_CUT, or the
 // smoothed line is too short. That used to lose the channel outright: one
 // links seed had both of its routes fail the profile and came back with no
 // water at all. Falling through to the next-best catchment is strictly better
 // than giving up, and costs nothing when the first one works.
 const routes = model ? channels(model, specs.length * 4, claimed) : [];
 // Strongest first, so rivers take the largest catchments and creeks the rest.
 specs.sort((a, b) => (a === 'river' ? 0 : 1) - (b === 'river' ? 0 : 1));

 for(let n=0,r=0;n<specs.length&&r<routes.length;r++){
  const kind=specs[n],width=kind==='river'?s.riverWidth:s.creekWidth,bend=(s.streamBends||0)/100;
  const route=routes[r];
  if(!route)continue;
  // MEANDER IS A LATERAL OFFSET, NEVER A ROTATION.
  //
  // This is the whole lesson of the previous attempt. An offset is bounded by
  // its own amplitude however large it grows; a rotation integrates, and a
  // constant bend is a circle. The flow path underneath is monotonically
  // downhill, so displacing it sideways by a few metres cannot make it climb,
  // and cannot make it close a loop.
  const amp=(3+bend*14)*(.6+rng()*.8),wave=70+rng()*110,phase=rng()*6.28;
  const widthPhase=rng()*6.28,widthLength=55+rng()*70;
  let run=0;
  let points=route.points.map((p,i,all)=>{
   if(i)run+=Math.hypot(p.x-all[i-1].x,p.z-all[i-1].z);
   const a=all[Math.max(0,i-1)],b=all[Math.min(all.length-1,i+1)];
   const len=Math.hypot(b.x-a.x,b.z-a.z)||1;
   // Perpendicular to the flow direction, tapered to nothing at both ends so
   // the mouth still meets the sea and the head still starts where the water does.
   const t=Math.min(1,Math.min(i,all.length-1-i)/8);
   const off=Math.sin(run/wave+phase)*amp*t;
   return {x:p.x-(b.z-a.z)/len*off, z:p.z+(b.x-a.x)/len*off,
    width:width*(.82+.18*Math.sin(run/widthLength+widthPhase))};
  });
  points=clearProtected(relaxCurvature(chaikin(chaikin(points)),Math.max(width*1.8,14)),protect,width,corridor);
  if(!points||points.length<16)continue;
  for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;p.nx=(b.z-a.z)/len;p.nz=-(b.x-a.x)/len;p.depth=s.streamDepth*(kind==='creek'?.6:1);}
  const fitted=downhillProfile(points,height);
  if(!fitted)continue;
  const path=fitted.path;
  // WHERE THE CHANNEL ACTUALLY ENDS, which is not always where the route did.
  // A trimmed tail means the profile ran out of cut budget and closed the
  // channel down to nothing partway along, so it fades into a hillside rather
  // than reaching the sink, lake or sea the route was classified by.
  const end=fitted.trimmedTail?'trimmed':route.end;
  // WHERE THE HOLLOW BOTTOMS OUT, handed to the course builder so it can put a
  // pond at the point the channel now runs to. The span is reported as well,
  // but only as a CAP: a surviving depression is a valley floor and measures
  // 40 000 to 430 000 square metres, so sizing a pond to fill one would drown
  // the hole rather than give the channel somewhere to end.
  let sink=null;
  if(end==='sink'&&route.pool>=0&&model){
   const cells=model.pools[route.pool],c=model.cell,low=model.bottom[route.pool];
   let spanX=0,spanZ=0;
   for(const k of cells){spanX=Math.max(spanX,Math.abs(model.X(k)-model.X(low)));spanZ=Math.max(spanZ,Math.abs(model.Z(k)-model.Z(low)));}
   sink={x:model.X(low),z:model.Z(low),floor:model.H[low],area:cells.length*c*c,
    spanX:Math.max(c,spanX),spanZ:Math.max(c,spanZ)};
  }
  // Stations are ordered upstream to downstream. Widen the excavated valley
  // where necessary, with zero-slope joins to the surrounding terrain.
  // THE CHANNEL MEETS ITS POND AT THE SHORE, NOT THROUGH THE MIDDLE OF IT.
  //
  // The pond has to be built here rather than after the loop, because both
  // halves of the join need the path while it is still editable and the
  // segment index has not been built from it yet. Done afterwards, the channel
  // ran straight across its own pond and `carve` -- which is the last thing
  // `analyticHeight` applies -- overrode the basin with the channel's bed:
  // measured, the water plane sat up to 3.1 m ABOVE the pond it was draining
  // into, over ground 2.5 m higher than the pond's own surface.
  //
  // So the stations inside the water are dropped, and the last stretch before
  // them is brought down to the pond's level. The ramp only ever LOWERS a
  // station, and both the existing levels and the ramp fraction fall toward the
  // mouth, so the profile stays monotone -- which is the one property the whole
  // routing rewrite rests on.
  let basin=null;
  if(end==='sink'&&sink&&onSink&&(basin=onSink({sink,kind,width,points:path}))){
   if(basin.protect)protect.push(basin.protect);
   let cut=path.length;
   while(cut>1&&basin.inside(path[cut-1].x,path[cut-1].z))cut--;
   if(cut>=12){
    path.length=cut;
    const back=[];back[path.length-1]=0;
    for(let i=path.length-2;i>=0;i--)back[i]=back[i+1]+Math.hypot(path[i+1].x-path[i].x,path[i+1].z-path[i].z);
    for(let i=0;i<path.length;i++){
     const t=Math.min(1,back[i]/SINK_RAMP);
     path[i].level=Math.min(path[i].level,basin.level+(path[i].level-basin.level)*t);
    }
    // The bank width reads the drop to the water, so it is recomputed below
    // against these levels rather than the ones the profile fitted.
   }
  }
  // Widen the excavated valley where necessary, with zero-slope joins to the
  // surrounding terrain. AFTER the pond ramp, because the bank is sized from
  // the drop to the water and the ramp is what sets that near a mouth.
  for(const p of path)p.bank=(14+width*.6+Math.min(26,Math.max(0,height(p.x,p.z)-p.level)*2.4))*Math.max(.25,p.taper??1);
  n++;
  streams.push({kind,points:path,end,sink});for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],bank=Math.max(a.bank,b.bank),id=segments.length;segments.push({a,b,bank,id,kind,stream:n});for(let x=Math.floor((Math.min(a.x,b.x)-bank-width)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+bank+width)/cellSize);x++)for(let z=Math.floor((Math.min(a.z,b.z)-bank-width)/cellSize);z<=Math.floor((Math.max(a.z,b.z)+bank+width)/cellSize);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);}}
 }
 function at(x,z){let best=null;for(const id of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]){const seg=segments[id],{a,b}=seg,dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz))),distance=Math.hypot(x-a.x-dx*t,z-a.z-dz*t),width=a.width+(b.width-a.width)*t,edge=distance-width*.5;if(edge>seg.bank)continue;if(!best||edge<best.edge)best={...seg,edge,distance,width,level:a.level+(b.level-a.level)*t,depth:a.depth+(b.depth-a.depth)*t};}return best;}
 function carve(x,z,y){const q=at(x,z);if(!q)return y;if(q.edge<=0)return q.level-q.depth*(1-smooth(q.distance/(q.width*.5)));// Two stages, as for a pond: the valley is graded to a rim one freeboard above
 // the water across the bank, and only the last WATER_LIP metres are the cut.
 // The bank is still what the owner atlas is sized from.
 const cut=cutFor(q.width),rim=q.level+cut.freeboard,bank=Math.max(q.bank,cut.lip+1);
 const carved=q.edge<cut.lip
  ?q.level+(rim-q.level)*smooth(q.edge/cut.lip)
  :rim+(y-rim)*smooth((q.edge-cut.lip)/(bank-cut.lip));let blend=1;for(const o of protect)blend=Math.min(blend,smooth((Math.hypot(x-o.x,z-o.z)-(o.flat??(o.pond?o.r:o.r-22)))/18));return y+(carved-y)*blend;}
 // Requested vs placed, so the studio can say when ground left no room rather
 // than quietly handing back a course with no water in it.
 return {streams,segments,at,carve,requested:specs.length};
}
export function addStreams(view){for(const stream of view.world.streams.streams){
 const path=stream.points,level=path[Math.floor(path.length/2)].level,pos=[],shore=[],indices=[];
 // Three vertices across each station: both banks plus a centre line. The centre
 // vertex is what lets the surface fade out at the waterline instead of ending
 // on a hard alpha step against the painted bed.
 for(let i=0;i<path.length;i++){const p=path[i],half=p.width*.5*(p.miter||1);
  for(const side of [-1,0,1]){pos.push(p.x+p.nx*half*side,-p.z-p.nz*half*side,p.level-level);shore.push(Math.abs(side));}
  if(i){const a=(i-1)*3;indices.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('shore',new T.Float32BufferAttribute(shore,1));g.setIndex(indices);g.computeVertexNormals();const center=path[Math.floor(path.length/2)];view.addWaterBody(g,level,center.depth,center,false,path);
}}
