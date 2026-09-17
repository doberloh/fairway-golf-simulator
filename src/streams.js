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
const lowPass=(values,passes)=>{const n=values.length,tmp=new Float64Array(n);for(let k=0;k<passes;k++){tmp[0]=values[0];tmp[n-1]=values[n-1];for(let i=1;i<n-1;i++)tmp[i]=(values[i-1]+2*values[i]+values[i+1])*.25;values.set(tmp);}return values;};
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
    const angle=rng()*Math.PI,dir={x:Math.sin(angle),z:Math.cos(angle)},normal={x:dir.z,z:-dir.x};
    const offset=(rng()-.5)*span*1.7,widthPhase=rng()*6.28,widthLength=55+rng()*70;
    const harmonics=[{length:140+rng()*200,amp:(12+bend*span*.24)*(.65+rng()*.7),phase:rng()*6.28},{length:340+rng()*420,amp:(9+bend*span*.18)*(.55+rng()*.9),phase:rng()*6.28},{length:60+rng()*80,amp:(2.5+bend*span*.045)*(.3+rng()*1.1),phase:rng()*6.28}];
    const N=Math.ceil(reach*2/10),station=i=>(i/N*2-1)*reach,lateral=new Float64Array(N+1);
    for(let i=0;i<=N;i++){const u=station(i);let v=offset;for(const h of harmonics)v+=Math.sin(u/h.length+h.phase)*h.amp;lateral[i]=v;}
    const near=avoid.map(o=>({side:o.x*normal.x+o.z*normal.z,along:o.x*dir.x+o.z*dir.z,clear:o.r+width*.65+10})).filter(q=>Math.abs(q.along)<reach+q.clear*3);
    // Choose which side of each obstacle the channel passes exactly once, from
    // the undisturbed line. Re-deciding per station is what produced hard V
    // bends where the corridor reversed inside a single influence zone.
    for(const q of near){q.sign=lateral[Math.max(0,Math.min(N,Math.round((q.along/reach+1)/2*N)))]>=q.side?1:-1;q.reach=q.clear*1.45;}
    const push=new Float64Array(N+1),up=new Float64Array(N+1),down=new Float64Array(N+1);
    for(let pass=0;pass<4;pass++){
     up.fill(0);down.fill(0);
     for(const q of near){
      const lo=Math.max(0,Math.ceil(((q.along-q.reach*2.2)/reach+1)/2*N)),hi=Math.min(N,Math.floor(((q.along+q.reach*2.2)/reach+1)/2*N));
      for(let i=lo;i<=hi;i++){const d=(station(i)-q.along)/q.reach,need=q.sign*(q.side+q.sign*q.reach*Math.exp(-1.2*d*d)-lateral[i]);if(need<=0)continue;if(q.sign>0)up[i]=Math.max(up[i],need);else down[i]=Math.max(down[i],need);}
     }
     // A low pass over the correction turns each detour into one long smooth
     // curve rather than a trapezoid with a corner at the influence boundary.
     for(let i=0;i<=N;i++)push[i]=up[i]-down[i];
     lowPass(push,4);let moved=0;
     for(let i=0;i<=N;i++){lateral[i]+=push[i];moved=Math.max(moved,Math.abs(push[i]));}
     if(moved<.05)break;
    }
    let points=[];
    for(let i=0;i<=N;i++){const u=station(i);points.push({x:dir.x*u+normal.x*lateral[i],z:dir.z*u+normal.z*lateral[i],width:width*(.82+.18*Math.sin(u/widthLength+widthPhase))});}
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
