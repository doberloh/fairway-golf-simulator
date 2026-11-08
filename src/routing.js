import {FOOTPRINTS,footprintCurve} from './footprints.js';
import {biomeOf} from './biomes.js';
import {rangeShareOf,formationShareOf,massifHeading} from './landforms.js';
// Seeded corridor packing: successive tees follow greens, with a compact,
// collision-checked routing instead of rows of parallel holes.
export function placeHole(h,origin,rotation){
 const c=Math.cos(rotation),sn=Math.sin(rotation);h.rotation=rotation;h.origin={...origin};
 h.toWorld=p=>({x:origin.x+p.x*c+p.z*sn,z:origin.z-p.x*sn+p.z*c,...(p.y===undefined?{}:{y:p.y})});
 h.toLocal=p=>{const x=p.x-origin.x,z=p.z-origin.z;return{x:x*c-z*sn,z:x*sn+z*c,...(p.y===undefined?{}:{y:p.y})};};
 h.worldPin=h.toWorld(h.pin);h.worldGreen=h.toWorld(h.green??h.pin);h.worldTee=h.toWorld(h.tee);h.cell=h.toWorld({x:h.center(h.length/2),z:h.length/2});
}
// ALONG THE MOUNTAIN FRONT (`range.side`, Desert Mountain trial, 8 November 2026): the ranges stand
// only past a line through the routing's start, square to the big mountain's heading, so the
// footprint is turned to run along that line with its loop on the open side; the draw it replaces
// is still made, so the stream is unchanged. Every other landscape keeps its random turn.
const frontTurn=(s,a)=>{if(!biomeOf(s.biome).landform?.range?.side)return a;const m=massifHeading(s.seed);return Math.atan2(-Math.cos(m),-Math.sin(m));};
export function footprintGuide(holes,s,random){
 const rng=random(s.seed+':footprint'),kind=Object.hasOwn(FOOTPRINTS,s.footprint)?s.footprint:'organic',total=holes.reduce((n,h)=>n+h.routeLength,0),angle=frontTurn(s,rng()*Math.PI*2),aspect=1.45+rng()*1.25,arc=kind==='oval'?Math.PI*2:kind==='crescent'?Math.PI*(1.15+rng()*.35):Math.PI*(1.4+rng()*.6),radius=Math.sqrt(total*32)*(biomeOf(s.biome).spread||1),phase=rng()*6.28;
 const points=Array.from({length:65},(_,i)=>{const t=i/64;let x,z;if(!['organic','oval','crescent','ribbon'].includes(kind)){const p=footprintCurve(kind,t);x=p[0]*radius*.9;z=p[1]*radius;}else if(kind==='ribbon'){z=t*total*.28;x=Math.sin(t*Math.PI*1.5+phase)*radius*.65-Math.sin(phase)*radius*.65;}else{x=(1-Math.cos(t*arc))*radius*aspect;z=Math.sin(t*arc)*radius*(kind==='crescent'?1.3:1);if(kind==='organic')z+=Math.sin(t*Math.PI*3)*radius*.35;}return{x:x*Math.cos(angle)+z*Math.sin(angle),z:-x*Math.sin(angle)+z*Math.cos(angle)};});
 const distance=p=>{let d=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t));}return d;};
 return {kind,points,distance};
}
export function routeHoles(holes,s,random){
 // A BIGGER PLAY AREA (`spread`, a landscape's; the owner, 8 November 2026, a Desert Mountain trial:
 // "Would making the overall playing landscape larger ... help with the routing"): the footprint the
 // holes follow grows by `spread`, the gap kept between corridors by 50 m for each whole of it past
 // 1, and the walk allowed from a green to the next tee by `spread`. 1 everywhere else, so no other
 // landscape moves. PLACED.
 const spread=biomeOf(s.biome).spread||1,gap=s.spacing+(spread-1)*50;
 const footprint=footprintGuide(holes,s,random);let best=null;
 // HOLES ROUTED ROUND THE MOUNTAINS (Desert Mountain round 6; the owner, 8 November 2026: "The
 // holes need to move to wrap around the mountains that are generated"). A landscape whose
 // landform lays `range`s has them before any hole: a placement whose line or green touches one
 // (share above MOUNT_CLEAR) is refused like a collision, so the holes take the floor between the
 // ranges and curve round them. The course is then moved to the middle as always, and the land is
 // moved with it (`shift`, course.js). Its own draws, so every other landscape routes as before.
 // PLACED: MOUNT_CLEAR, the 400 tries, the first hole's 300 sites within 700 m.
 // (The Badlands' formations the same way, `formationShareOf`, 8 November 2026.)
 const mount=s.range?null:rangeShareOf(biomeOf(s.biome).landform,s.seed)??formationShareOf(biomeOf(s.biome).landform,s.seed),MOUNT_CLEAR=.02;
 const onRock=pts=>{if(!mount)return false;for(const p of pts)if(mount(p.x,p.z)>MOUNT_CLEAR)return true;return false;};
 // AND UP AGAINST THEM (the owner, the same day: "we really need to get those holes up against the
 // mountains, not in between them ... like 60% of them"). About 60% of holes (their own draws) want
 // a range's side: a placement scores better by HUG_WEIGHT times the share of its line with a range
 // standing within HUG_REACH metres of its rough on either side. PLACED.
 const HUG_SHARE=.85,HUG_WEIGHT=900,HUG_REACH=22,hugRng=mount?random(s.seed+':routing-hug'):null,wantsHug=mount?holes.map(()=>hugRng()<HUG_SHARE):[];
 const hugOf=pts=>{let n=0,m=0;for(let q=1;q<pts.length-1;q++){const a=pts[q-1],b=pts[q+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,nx=dz/l,nz=-dx/l,p=pts[q],o=p.r+HUG_REACH;m++;if(mount(p.x+nx*o,p.z+nz*o)>.35||mount(p.x-nx*o,p.z-nz*o)>.35)n++;}return m?n/m:0;};
 // (An Architect course was routed from its clubhouse -- each nine's holes
 // pulled home, the 10th back at the clubhouse -- until the designer was
 // removed, 2 November 2026. A generated course's clubhouse is sited round the
 // routing, clubhouse.js.)
 for(let trial=0;trial<5;trial++){
  const rng=random(s.seed+':routing:'+trial),placed=[],samples=[];let penalty=0;
  for(let i=0;i<holes.length;i++){
   const h=holes[i],local=[];for(let z=0;z<=h.length+1;z+=16)local.push({x:h.center(z),z,r:z<18?10:z>h.length-28?(h.greenSize*h.greenAspect*1.2)+s.fringe+s.semiRough:h.width(z)+s.semiRough});// The disc the green occupies, so corridors do not overlap it. Centred on the
   // GREEN: anchoring it at the cup meant recutting a hole location moved the
   // collision volume, which moved the next hole, which rerouted the course.
   local.push({...(h.green??h.pin),r:(h.greenSize*h.greenAspect*1.2)+s.fringe+s.semiRough});
   let chosen=null;
   // SIDE BY SIDE, BUILT (the cartoon overhaul; `routeParallel`). Random
   // placements seldom land beside an earlier hole close enough to share a
   // fairway, because the clearance test rejects most that try. So a links is
   // also offered, for each hole, a tee on the line running beside any earlier
   // hole -- either way along it, either side of it, as close as the clearance
   // allows (stepped out 4 m at a time from 30 m) -- where that line passes
   // within `pull.walk` of the last green and at least 80% of the shorter hole
   // runs beside the other. Par 3s neither take nor give one: their fairways
   // are too short to share. A back-nine hole running home beside its
   // front-nine partner (10 by 9, 11 by 8 ...) may walk 1.6 times as far and
   // scores twice the pull. The Old Course is this shape: out along the shore
   // and back beside itself. Built from geometry, not drawn, so it takes
   // nothing from the routing stream, and the routing trial with the most
   // such holes is favoured by the same weight each. PLACED: the walk, the
   // 80%, 250 m, 1.6, the doubled pull and the steps.
   const pull=biomeOf(s.biome).routeParallel;
   if(i&&pull&&h.length>=250){
    const partner=i>=Math.ceil(holes.length/2)?holes.length-1-i:-1,from=placed.at(-1).pin,rMax=Math.max(...local.map(p=>p.r)),homeWeight=footprint.kind==='ribbon'?0:i>holes.length-4?.45:.05,guide=footprint.points[Math.round((i+1)/holes.length*64)];
    for(const [j,o] of placed.entries()){
     const fx=Math.sin(o.rot),fz=Math.cos(o.rot),len=holes[j].length,oMax=Math.max(...o.points.map(p=>p.r)),t0=(from.x-o.origin.x)*fx+(from.z-o.origin.z)*fz;
     // THE FAR-LANDSCAPE GOAL (the owner: "thoughtful fairway connections"):
     // a hole running BACK beside another is also offered its tee `shifts` m
     // (60 on a links) further back past the level of the last green, so its fairway -- which
     // on a links starts 85-110 m out -- lies beside the other's fairway
     // rather than beside its teeing ground (the staggered pairs that met only
     // in the middle). The extra walk is scored as any walk is. PLACED.
     for(const [dir,shift] of [[1,0],[-1,0],...(pull.shifts??[]).map(d=>[-1,d])]){
      const t=t0-dir*shift;
      // Room left beside hole j, running this way from the point level with the green.
      if(len<250||(dir>0?len-t:t)<Math.min(h.length,len)*.8)continue;
      const rot=o.rot+(dir>0?0:Math.PI),c=Math.cos(rot),sn=Math.sin(rot);
      for(const side of [-1,1]){
       let L=30,origin=null,points=null;
       for(;L<=rMax+oMax+gap+2;L+=4){
        const at={x:o.origin.x+fx*t+side*L*fz,z:o.origin.z+fz*t-side*L*fx};
        if(Math.hypot(at.x-from.x,at.z-from.z)>pull.walk*(j===partner?1.6:1))continue;
        const pts=local.map(p=>({x:at.x+p.x*c+p.z*sn,z:at.z-p.x*sn+p.z*c,r:p.r}));
        let hit=false;outer:for(const p of pts)for(const q of samples){const d=p.r+q.r+gap;if((p.x-q.x)**2+(p.z-q.z)**2<d*d){hit=true;break outer;}}
        if(!hit){origin=at;points=pts;break;}
       }
       if(!origin)continue;
       const walk=Math.hypot(origin.x-from.x,origin.z-from.z),end=points.at(-1),mid=points[Math.floor(points.length/2)];
       const score=footprint.distance(mid)*2.3+footprint.distance(end)*1.7+Math.hypot(end.x-guide.x,end.z-guide.z)*.45+Math.hypot(end.x,end.z)*homeWeight+walk*.9-pull.weight*(j===partner&&dir<0?2:1);
       if(!chosen||score<chosen.score)chosen={origin,rot,points,pin:end,score,walk,beside:true};
      }
     }
    }
   }
   // LAID ALONG THE ROCK (the owner's "up against the mountains"). Random tries seldom land beside a
   // range, so a hole that wants one is also offered placements built from the rock: from the last
   // green, out along 36 bearings (to 400 m) to where a range begins, the hole laid along that face --
   // its line parallel to the rock, its rough HUG_REACH short of it -- either way along, its tee within 320 m
   // of the green. Scored as any placement is, with the hug. Geometry only: no draw.
   if(mount&&wantsHug[i]&&i){
    const from=placed.at(-1).green??placed.at(-1).pin,rMax=Math.max(...local.map(p=>p.r)),homeWeight=footprint.kind==='ribbon'?0:i>holes.length-4?.45:.05,guide=footprint.points[Math.round((i+1)/holes.length*64)];
    for(let b=0;b<36;b++){
     const ax=Math.sin(b*Math.PI/18),az=Math.cos(b*Math.PI/18);let E=null;
     for(let t=30;t<=400;t+=8){const px=from.x+ax*t,pz=from.z+az*t;if(mount(px,pz)>.35){E={x:px,z:pz};break;}}
     if(!E)continue;
     let nx=mount(E.x+6,E.z)-mount(E.x-6,E.z),nz=mount(E.x,E.z+6)-mount(E.x,E.z-6);const nl=Math.hypot(nx,nz);if(!nl)continue;nx/=nl;nz/=nl;
     for(const dir of [-1,1]){
      const tx=-nz*dir,tz=nx*dir,off=rMax+HUG_REACH-6,lx=E.x-nx*off,lz=E.z-nz*off,origin={x:lx-tx*h.length*.5,z:lz-tz*h.length*.5};
      const walk=Math.hypot(origin.x-from.x,origin.z-from.z);if(walk>320*spread)continue;
      const rot=Math.atan2(tx,tz),c=Math.cos(rot),sn=Math.sin(rot),points=local.map(p=>({x:origin.x+p.x*c+p.z*sn,z:origin.z-p.x*sn+p.z*c,r:p.r}));
      if(onRock(points))continue;
      let hit=false;outer3:for(const p of points)for(const q of samples){const d=p.r+q.r+gap;if((p.x-q.x)**2+(p.z-q.z)**2<d*d){hit=true;break outer3;}}
      if(hit)continue;
      const f=hugOf(points);if(f<.3)continue;
      const end=points.at(-1),mid=points[Math.floor(points.length/2)],hug=HUG_WEIGHT*f;
      const score=footprint.distance(mid)*2.3+footprint.distance(end)*1.7+Math.hypot(end.x-guide.x,end.z-guide.z)*.45+Math.hypot(end.x,end.z)*homeWeight+walk*.9-hug;
      if(!chosen||score<chosen.score)chosen={origin,rot,points,pin:end,score,walk,hug};
     }
    }
   }
   const tries=!i?(mount?300:1):mount?400:150,mr=mount?random(s.seed+':routing-mount:'+trial+':'+i):null;
   for(let k=0;k<tries;k++){
    // The first hole of a course among the ranges looks for floor: a site within 700 m of the middle.
    if(!i&&mount){const a0=mr()*Math.PI*2,d0=k?mr()*700:0,r0=k?mr()*Math.PI*2:0,c0=Math.cos(r0),s0=Math.sin(r0),o0={x:Math.cos(a0)*d0,z:Math.sin(a0)*d0};
     const pts0=local.map(p=>({x:o0.x+p.x*c0+p.z*s0,z:o0.z-p.x*s0+p.z*c0,r:p.r}));if(onRock(pts0))continue;
     chosen={origin:o0,rot:r0,points:pts0,pin:pts0.at(-1),score:0,walk:0};break;}
    const previous=placed.at(-1),a=i?rng()*Math.PI*2:0,walk=i?((i%3===0?biomeOf(s.biome).hop:58)+rng()*55+Math.max(0,Math.min(k,150)-115)*5)*spread:0;
    // Walked from the CENTRE of the last green, not from its cup. A hole location
    // moves through the week; where the next tee goes does not, and routing off
    // the cup would have rebuilt the whole course every time a pin was recut.
    // There is no previous hole for the first one, so this stays inside the i test.
    const from=i?(previous.green??previous.pin):null;
    const origin=i?{x:from.x+Math.sin(a)*walk,z:from.z+Math.cos(a)*walk}:{x:0,z:0};
    const rot=i?rng()*Math.PI*2:0,c=Math.cos(rot),sn=Math.sin(rot),points=local.map(p=>({x:origin.x+p.x*c+p.z*sn,z:origin.z-p.x*sn+p.z*c,r:p.r}));
    let collision=false;outer:for(const p of points)for(const q of samples){const d=p.r+q.r+gap;if((p.x-q.x)**2+(p.z-q.z)**2<d*d){collision=true;break outer;}}
    if(collision)continue;
    if(onRock(points))continue;
    const end=points.at(-1),mid=points[Math.floor(points.length/2)],homeWeight=footprint.kind==='ribbon'?0:i>holes.length-4?.45:.05;
    const hug=mount&&wantsHug[i]?HUG_WEIGHT*hugOf(points):0;
    const guide=footprint.points[Math.round((i+1)/holes.length*64)];let score=footprint.kind==='square'?Math.max(Math.abs(mid.x),Math.abs(mid.z))*.7+Math.hypot(end.x,end.z)*homeWeight+walk*.9:footprint.distance(mid)*2.3+footprint.distance(end)*1.7+Math.hypot(end.x-guide.x,end.z-guide.z)*.45+Math.hypot(end.x,end.z)*homeWeight+walk*.9+rng()*45-hug;
    // OUT AND BACK, SIDE BY SIDE (the cartoon overhaul; a links' `routeParallel`):
    // a placement running alongside an earlier hole, close enough for their
    // fairways to meet (course.js shareFairways), scores better -- the Old
    // Course's shape. No random draw, so a biome without it routes as before.
    if(pull){
     const dx=end.x-points[0].x,dz=end.z-points[0].z,dl=Math.hypot(dx,dz)||1;
     for(const prev of placed){
      const px=prev.pin.x-prev.points[0].x,pz=prev.pin.z-prev.points[0].z,pl=Math.hypot(px,pz)||1;
      if(Math.abs((dx*px+dz*pz)/(dl*pl))<.8)continue;
      let near=Infinity;for(const q of prev.points)near=Math.min(near,Math.hypot(q.x-mid.x,q.z-mid.z)-q.r-mid.r);
      if(near<pull.gap){score-=pull.weight;break;}
     }
    }
    if(!chosen||score<chosen.score)chosen={origin,rot,points,pin:end,score,walk,hug};
   }
   // Slid against the rock: of the random tries few land beside a range (3% of them, measured), so a
   // hole that wants one takes its best placement and slides it sideways, 6 m a step to 160 m either
   // way, to where most of its line has a range within HUG_REACH of its rough -- never into
   // another hole, never onto the rock. Geometry only, so it takes no draw.
   if(mount&&wantsHug[i]&&chosen&&!chosen.beside&&i){
    // Turned too, 8 degrees a step to 24 either way about its tee: the holes pack close, and a
    // straight slide most often ran into the hole before.
    const c0=chosen;let bestSlide=null,f0=hugOf(c0.points);
    for(let da=-24;da<=24;da+=8){const rot=c0.rot+da*Math.PI/180,c=Math.cos(rot),sn=Math.sin(rot),lx=c,lz=-sn;
     for(const side of [-1,1])for(let L=da?0:6;L<=160;L+=6){
      const o={x:c0.origin.x+side*L*lx,z:c0.origin.z+side*L*lz},pts=local.map(p=>({x:o.x+p.x*c+p.z*sn,z:o.z-p.x*sn+p.z*c,r:p.r}));
      if(onRock(pts))break;
      let hit=false;outer2:for(const p of pts)for(const q of samples){const d=p.r+q.r+gap;if((p.x-q.x)**2+(p.z-q.z)**2<d*d){hit=true;break outer2;}}
      if(hit)break;
      const f=hugOf(pts);if(f>Math.max(f0,bestSlide?.f??0)+.05)bestSlide={pts,f,o,rot};
     }}
    if(bestSlide)chosen={...c0,origin:bestSlide.o,rot:bestSlide.rot,points:bestSlide.pts,pin:bestSlide.pts.at(-1),hug:HUG_WEIGHT*bestSlide.f};
   }
   if(!chosen&&!i)chosen={origin:{x:0,z:0},rot:0,points:local.map(p=>({...p})),pin:{...(h.pin)},score:1e6,walk:0};
   if(!chosen){const previous=placed.at(-1),origin={x:Math.max(...samples.map(p=>p.x+p.r))+Math.max(...local.map(p=>Math.abs(p.x)+p.r))+gap+25,z:(previous.green??previous.pin).z-h.length/2},rot=0;chosen={origin,rot,points:local.map(p=>({...p,x:p.x+origin.x,z:p.z+origin.z})),pin:{x:origin.x+h.pin.x,z:origin.z+h.pin.z},score:1e6,walk:350};penalty+=1e6;}
   placed.push(chosen);samples.push(...chosen.points);penalty+=(chosen.walk||0)-(chosen.hug||0);
  }
  const xs=samples.map(p=>p.x),zs=samples.map(p=>p.z),bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  const pull=biomeOf(s.biome).routeParallel,pairs=pull?placed.filter(p=>p.beside).length*pull.weight:0;
  const score=(bounds.maxX-bounds.minX)*(bounds.maxZ-bounds.minZ)/1800+penalty-pairs+Math.hypot((placed.at(-1).green??placed.at(-1).pin).x,(placed.at(-1).green??placed.at(-1).pin).z)*2;
  if(!best||score<best.score)best={placed,bounds,score};
 }
 const dx=(best.bounds.minX+best.bounds.maxX)/2,dz=(best.bounds.minZ+best.bounds.maxZ)/2;
 holes.forEach((h,i)=>placeHole(h,{x:best.placed[i].origin.x-dx,z:best.placed[i].origin.z-dz},best.placed[i].rot));
 return {shift:{x:dx,z:dz},halfX:(best.bounds.maxX-best.bounds.minX)/2+125,halfZ:(best.bounds.maxZ-best.bounds.minZ)/2+125,footprint:{kind:footprint.kind,points:footprint.points.map(p=>({x:p.x-dx,z:p.z-dz}))}};
}
