import * as T from 'three';
export const BANK_COLORS={pnw:'#526343',midwest:'#697348',autumn:'#81724e',links:'#9c905e',desert:'#b49a73',mountain:'#7b8982',island:'#aaad7a'};
// How far a channel bed may be cut below the ground beside it. This is a design
// depth for a stream valley, not a budget for crossing the map: a route that
// would need more than this is trimmed back rather than trenched through.
export const MAX_CUT=9;
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
 const grade=(path,values)=>{const levels=[...values];for(let i=1;i<levels.length;i++)levels[i]=Math.min(levels[i],levels[i-1]-.00015*Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));for(let i=levels.length-2;i>=0;i--)levels[i]=Math.min(levels[i],levels[i+1]+.025*Math.hypot(path[i].x-path[i+1].x,path[i].z-path[i+1].z));return {path,values,levels,cost:levels.reduce((n,y,i)=>n+(values[i]-y)**2,0)/levels.length};};
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
// LONGEST IS THE WRONG WORD FOR IT: ON THE COURSE COMES FIRST.
//
// A channel is drawn across a span reaching well past the map in both
// directions, so "the longest run that is on land" can easily be a stretch of
// open country a kilometre off the edge -- measured on a links seed, both
// channels came back entirely outside the course, at x -747..-314 against a
// halfX of 334. A channel nobody can see is worth less than a shorter one
// crossing the holes, so runs are scored by how much of them lands ON the
// course and only then by length.
// WHICH WAY IS DOWNHILL, AVERAGED OVER A RADIUS.
//
// Sampled at a point, a generated landscape is noisy enough that steepest
// descent jitters and traps itself in every dimple. Averaged over tens of
// metres it answers the question actually being asked -- which way does this
// hillside fall -- and a channel routed on it behaves like water rather than
// like a needle threading local minima.
function grade(height,x,z,r){
 let gx=0,gz=0;
 for(let i=0;i<4;i++){
  const a=i*Math.PI/4,cx=Math.cos(a),cz=Math.sin(a);
  const d=height(x+cx*r,z+cz*r)-height(x-cx*r,z-cz*r);
  gx-=cx*d;gz-=cz*d;
 }
 const len=Math.hypot(gx,gz);
 return len>1e-9?{x:gx/len,z:gz/len,fall:len}:{x:0,z:0,fall:0};
}

// A WATERCOURSE IS ROUTED BY DESCENDING THE LAND.
//
// It used to be a bearing and three harmonics -- a sine wave drawn across the
// map with no reference to the ground -- and the terrain entered only
// afterwards, as a budget: keep the longest run whose bed stays within MAX_CUT
// of the surface. So a channel imposed its own gradient and excavated whatever
// stood in the way. Measured before this: a median cut of 2 to 9.5 m below the
// land along the whole length, reaching 21.1 m on a mountain course, with the
// water falling 5.4 m over ground that fell 0.7. That is a trench gouged across
// a hillside, which is what "worms across the surface" describes.
//
// The harmonics are kept, but as MEANDER -- they bend the heading rather than
// being the path. Inertia stops the walk snapping to every change of slope; the
// obstacle term steers around greens, tees and bunkers instead of the old
// lateral push, which only made sense in a straight channel's frame.
function descend(start,o){
 const {height,isSea,halfX,halfZ,width,rng,avoid,step,maxSteps}=o;
 const harmonics=[{length:120+rng()*180,amp:.20+o.bend*.55},{length:300+rng()*380,amp:.12+o.bend*.30}].map(h=>({...h,phase:rng()*6.28}));
 const widthPhase=rng()*6.28,widthLength=55+rng()*70;
 const points=[];
 let x=start.x,z=start.z,travelled=0,stalled=0;
 const first=grade(height,x,z,45);
 let dir=first.fall>0?{x:first.x,z:first.z}:{x:Math.cos(rng()*6.28),z:Math.sin(rng()*6.28)};
 let last=height(x,z);
 for(let i=0;i<maxSteps;i++){
  points.push({x,z,width:width*(.82+.18*Math.sin(travelled/widthLength+widthPhase))});
  const g=grade(height,x,z,45);
  // Downhill, blended with where we were already going.
  let hx=dir.x*.58+g.x*.42,hz=dir.z*.58+g.z*.42;
  // Meander, as a rotation of the heading.
  let bendBy=0;
  for(const h of harmonics)bendBy+=Math.sin(travelled/h.length+h.phase)*h.amp;
  const ca=Math.cos(bendBy),sa=Math.sin(bendBy);
  [hx,hz]=[hx*ca-hz*sa,hx*sa+hz*ca];
  // Steer clear of anything protected, by turning rather than by translating.
  for(const q of avoid){
   const dx=x-q.x,dz=z-q.z,d=Math.hypot(dx,dz),clear=q.r+width*.65+12;
   if(d>clear*2||d<1e-6)continue;
   const push=(1-d/(clear*2))*1.6;
   hx+=dx/d*push;hz+=dz/d*push;
  }
  // THE TURN IS CAPPED, NOT RELAXED AFTERWARDS.
  //
  // `relaxCurvature` smooths a path; it cannot rescue one that doubles back
  // inside its own banks, and the walk can do exactly that when the gradient
  // swings or an obstacle pushes hard -- measured at a bend of 0.20 times the
  // half width, where the floor is 1. Limiting the turn per step to
  // step/radius bounds the curvature by construction, whatever the land does.
  const len=Math.hypot(hx,hz)||1;
  hx/=len;hz/=len;
  const maxTurn=step/Math.max(width*1.8,14);
  const turn=Math.atan2(dir.x*hz-dir.z*hx,dir.x*hx+dir.z*hz);
  const use=Math.max(-maxTurn,Math.min(maxTurn,turn));
  const cw=Math.cos(use),sw=Math.sin(use);
  dir={x:dir.x*cw-dir.z*sw,z:dir.x*sw+dir.z*cw};
  x+=dir.x*step;z+=dir.z*step;travelled+=step;
  if(Math.abs(x)>halfX+140||Math.abs(z)>halfZ+140)return {points,end:'edge'};
  if(isSea(x,z))return {points,end:'sea'};
  // A sink is ground the walk cannot get out of. Judged over a window, because
  // a single step uphill is a hummock and not a basin.
  const now=height(x,z);
  stalled=now>last-.02?stalled+1:0;
  last=now;
  if(stalled>=12)return {points,end:'sink'};
 }
 return {points,end:'spent'};
}

function runOnLand(points,isSea,inBounds){
 let best=null,from=-1;
 const consider=(a,b)=>{
  let inside=0;
  for(let i=a;i<=b;i++)if(inBounds(points[i]))inside++;
  if(!best||inside>best.inside||(inside===best.inside&&b-a>best.to-best.from))
   best={from:a,to:b,inside};
 };
 for(let i=0;i<points.length;i++){
  if(isSea(points[i].x,points[i].z)){if(from>=0)consider(from,i-1);from=-1;continue;}
  if(from<0)from=i;
 }
 if(from>=0)consider(from,points.length-1);
 return best?points.slice(best.from,best.to+1):[];
}

export function generateStreams(s,holes,halfX,halfZ,height,random,isSea=()=>false){
 const rng=random(s.seed+':streams'),specs=[...Array(s.rivers||0).fill('river'),...Array(s.creeks||0).fill('creek')],streams=[],segments=[],cells=new Map(),cellSize=40,reach=Math.hypot(halfX,halfZ)+210;
 const protect=holes.flatMap(h=>[{...(h.worldGreen??h.worldPin),r:h.greenSize*h.greenAspect+s.fringe+30},...Object.values(h.tees).map(t=>({...h.toWorld(t),r:18,flat:14})),...h.ponds.map(p=>({...h.toWorld(p),pond:true,r:Math.max(p.reachX||p.rx,p.rz)+(p.shoreWidth||14)+12}))]);
 // Bunkers are excavated dry hazards: a channel crossing one would leave water
 // standing in sand. They are avoided too, and are dropped only when a course is
 // so tight that no route exists around them.
 const sand=margin=>holes.flatMap(h=>h.bunkers.map(b=>({...h.toWorld(b),sand:true,r:Math.max(b.rx,b.rz)+margin})));
 // Prefer a generous berth, then a tight squeeze, and only then give up on sand.
 // A course that forces the last tier has its crossed bunkers washed out in
 // generateWorld, so water never actually stands in a playable bunker.
 const tiers=holes.some(h=>h.bunkers.length)?[[...protect,...sand(10)],[...protect,...sand(2)],protect]:[protect];
 for(let n=0;n<specs.length;n++){
  const kind=specs[n],width=kind==='river'?s.riverWidth:s.creekWidth,bend=(s.streamBends||0)/100,span=Math.min(halfX,halfZ);
  let path=null,bestCost=Infinity,bestLen=0,bestInside=-1;
  for(const avoid of tiers){
   for(let attempt=0;attempt<14;attempt++){
    // Every channel draws its own bearing, harmonic wavelengths and phases, so a
    // river and a creek never trace offset copies of one shared master curve.
    // Seed high. A watercourse starts where the water does, so candidates are
    // sampled and the highest that is clear of the holes wins -- picking at
    // random put half of them in the bottom of a valley with nowhere to go.
    let seed=null;
    for(let t=0;t<40;t++){
     const sx=(rng()-.5)*halfX*1.9,sz=(rng()-.5)*halfZ*1.9;
     if(isSea(sx,sz))continue;
     if(avoid.some(q=>Math.hypot(sx-q.x,sz-q.z)<q.r+30))continue;
     const y=height(sx,sz);
     if(!seed||y>seed.y)seed={x:sx,z:sz,y};
    }
    if(!seed)continue;
    const walk=descend(seed,{height,isSea,halfX,halfZ,width,bend,rng,avoid,step:10,
     maxSteps:Math.ceil(reach*2/10)});
    let points=walk.points;
    if(points.length<16)continue;
    // A WATERCOURSE MUST ACTUALLY GET DOWNHILL.
    //
    // The heading is averaged over 45 m so the walk ignores hummocks, and the
    // price of that is it can also crest a low ridge and come out the far side
    // higher than it went in -- measured at two channels of ten ending ABOVE
    // their source. There are attempts left to spend, so spend them.
    const fell=height(points[0].x,points[0].z)-height(points.at(-1).x,points.at(-1).z);
    if(fell<12)continue;
    points=relaxCurvature(chaikin(chaikin(points)),Math.max(width*1.8,14));
    points=runOnLand(points,isSea,p=>Math.abs(p.x)<=halfX&&Math.abs(p.z)<=halfZ);
    // Too short to be a watercourse once the sea is taken out of it. Better no
    // channel than a puddle-long one fading in and out within its own banks.
    if(points.length<16)continue;
    if(points.some(p=>avoid.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r+p.width*.5)||streams.some(stream=>{for(let i=0;i<stream.points.length;i+=2){const q=stream.points[i];if(Math.hypot(p.x-q.x,p.z-q.z)<(p.width+q.width)*.5+8)return true;}return false;})))continue;
    for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;p.nx=(b.z-a.z)/len;p.nz=-(b.x-a.x)/len;p.depth=s.streamDepth*(kind==='creek'?.6:1);}
    const fitted=downhillProfile(points,height);if(!fitted)continue;
    // ON THE COURSE FIRST, then length, then depth of cut.
    //
    // Length alone picked channels nobody could ever see. Once runs are trimmed
    // at the shoreline, an attempt lying entirely off the map is untrimmed and
    // therefore longest, so it won -- both channels on a measured links seed came
    // back a kilometre outside the course. How much of a channel crosses the
    // holes is the thing actually worth maximising; a trimmed run that survives
    // the cut budget then beats a shorter one that merely sits a little shallower.
    const len=fitted.path.length;
    let inside=0,run=0;
    for(const p of fitted.path)if(Math.abs(p.x)<=halfX&&Math.abs(p.z)<=halfZ){inside++;run+=10;}
    // A CHANNEL THAT STOPS IN THE MIDDLE OF THE VIEW IS NOT A CHANNEL.
    //
    // Preferring on-course coverage tripled how much of a river the player can
    // actually see -- 447 m of it to 1666 on a measured links course, where
    // ninety per cent used to be drawn off the map. What it also allowed was
    // stubs: one channel came back 191 m long, which reads as a fragment rather
    // than as water crossing a landscape. A run has to be worth drawing.
    if(run<Math.min(halfX,halfZ)*.8)continue;
    if(inside>bestInside||(inside===bestInside&&(len>bestLen||(len===bestLen&&fitted.cost<bestCost))))
     {path=fitted.path;bestCost=fitted.cost;bestLen=len;bestInside=inside;}
   }
   if(path)break;
  }
  if(!path)continue;
  // Stations are ordered upstream to downstream. Widen the excavated valley
  // where necessary, with zero-slope joins to the surrounding terrain.
  for(const p of path)p.bank=(14+width*.6+Math.min(26,Math.max(0,height(p.x,p.z)-p.level)*2.4))*Math.max(.25,p.taper??1);
  streams.push({kind,points:path});for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],bank=Math.max(a.bank,b.bank),id=segments.length;segments.push({a,b,bank,id,kind,stream:n});for(let x=Math.floor((Math.min(a.x,b.x)-bank-width)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+bank+width)/cellSize);x++)for(let z=Math.floor((Math.min(a.z,b.z)-bank-width)/cellSize);z<=Math.floor((Math.max(a.z,b.z)+bank+width)/cellSize);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);}}
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
