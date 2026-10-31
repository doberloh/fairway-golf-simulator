import {FOOTPRINTS,footprintCurve} from './footprints.js';
import {biomeOf} from './biomes.js';
import {designSettings} from './designer.js';
import {isArchitect} from './settings-schema.js';
// Seeded corridor packing: successive tees follow greens, with a compact,
// collision-checked routing instead of rows of parallel holes.
export function placeHole(h,origin,rotation){
 const c=Math.cos(rotation),sn=Math.sin(rotation);h.rotation=rotation;h.origin={...origin};
 h.toWorld=p=>({x:origin.x+p.x*c+p.z*sn,z:origin.z-p.x*sn+p.z*c,...(p.y===undefined?{}:{y:p.y})});
 h.toLocal=p=>{const x=p.x-origin.x,z=p.z-origin.z;return{x:x*c-z*sn,z:x*sn+z*c,...(p.y===undefined?{}:{y:p.y})};};
 h.worldPin=h.toWorld(h.pin);h.worldGreen=h.toWorld(h.green??h.pin);h.worldTee=h.toWorld(h.tee);h.cell=h.toWorld({x:h.center(h.length/2),z:h.length/2});
}
export function footprintGuide(holes,s,random){
 const rng=random(s.seed+':footprint'),kind=Object.hasOwn(FOOTPRINTS,s.footprint)?s.footprint:'organic',total=holes.reduce((n,h)=>n+h.routeLength,0),angle=rng()*Math.PI*2,aspect=1.45+rng()*1.25,arc=kind==='oval'?Math.PI*2:kind==='crescent'?Math.PI*(1.15+rng()*.35):Math.PI*(1.4+rng()*.6),radius=Math.sqrt(total*32),phase=rng()*6.28;
 const points=Array.from({length:65},(_,i)=>{const t=i/64;let x,z;if(!['organic','oval','crescent','ribbon'].includes(kind)){const p=footprintCurve(kind,t);x=p[0]*radius*.9;z=p[1]*radius;}else if(kind==='ribbon'){z=t*total*.28;x=Math.sin(t*Math.PI*1.5+phase)*radius*.65-Math.sin(phase)*radius*.65;}else{x=(1-Math.cos(t*arc))*radius*aspect;z=Math.sin(t*arc)*radius*(kind==='crescent'?1.3:1);if(kind==='organic')z+=Math.sin(t*Math.PI*3)*radius*.35;}return{x:x*Math.cos(angle)+z*Math.sin(angle),z:-x*Math.sin(angle)+z*Math.cos(angle)};});
 const distance=p=>{let d=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));d=Math.min(d,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t));}return d;};
 return {kind,points,distance};
}
export function routeHoles(holes,s,random){
 s=designSettings(s);
 const footprint=footprintGuide(holes,s,random);let best=null;
 // ROUTED FROM THE CLUBHOUSE (architect-courses, phase 4; the study,
 // workstream F; ASGCA: the clubhouse first, the 1st and 10th tees and the 9th
 // and 18th greens round it). The first tee stands at the origin, where the
 // clubhouse is sited (clubhouse.js). An Architect course pulls each nine's
 // holes home harder the nearer the turn they are, starts the 10th back at
 // the clubhouse, and weighs the front nine's last green in choosing the
 // routing; it tries more routings to find one. Classic is untouched: `arch`
 // is false and every number below is what it was.
 const arch=isArchitect(s),nine=holes.length>=18?9:holes.length;
 const PULL=[0,0,0,.05,.15,.35,.75,1.4,2.6];
 const homeArch=(i,end,origin)=>{if(!arch)return 0;const j=i%nine,p=PULL[Math.round(j*8/Math.max(1,nine-1))]||0;
  // A nine's last green past 150 m from home pays steeply: a links's pull to
  // run out and back beside itself otherwise carried it 200-550 m away.
  // And from the first hole, never further out than the holes left in the
  // nine could walk back: about 300 m a hole, the turn coming by itself.
  const d=Math.hypot(end.x,end.z),reach=(nine-1-j)*300+140,last=Math.max(0,d-reach)*(j===nine-1?16:8);
  // The green before the last about one last hole's length from home, so the
  // last hole can play in (a links's 8th finished 66 m out, and its 9th had
  // to head away again).
  const penult=j===nine-2?Math.abs(d-holes[i+1].length*.92)*2.5:0;
  return d*p+last+penult+(holes.length>=18&&i===nine?Math.hypot(origin.x,origin.z)*1.2:0);};
 for(let trial=0;trial<(arch?12:5);trial++){
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
       for(;L<=rMax+oMax+s.spacing+2;L+=4){
        const at={x:o.origin.x+fx*t+side*L*fz,z:o.origin.z+fz*t-side*L*fx};
        if(Math.hypot(at.x-from.x,at.z-from.z)>pull.walk*(j===partner?1.6:1))continue;
        const pts=local.map(p=>({x:at.x+p.x*c+p.z*sn,z:at.z-p.x*sn+p.z*c,r:p.r}));
        let hit=false;outer:for(const p of pts)for(const q of samples){const d=p.r+q.r+s.spacing;if((p.x-q.x)**2+(p.z-q.z)**2<d*d){hit=true;break outer;}}
        if(!hit){origin=at;points=pts;break;}
       }
       if(!origin)continue;
       const walk=Math.hypot(origin.x-from.x,origin.z-from.z),end=points.at(-1),mid=points[Math.floor(points.length/2)];
       const score=footprint.distance(mid)*2.3+footprint.distance(end)*1.7+Math.hypot(end.x-guide.x,end.z-guide.z)*.45+Math.hypot(end.x,end.z)*homeWeight+walk*.9-pull.weight*(j===partner&&dir<0?2:1)+homeArch(i,end,origin);
       if(!chosen||score<chosen.score)chosen={origin,rot,points,pin:end,score,walk,beside:true};
      }
     }
    }
   }
   // An Architect nine's last three holes look three times as hard for a way
   // home: round the clubhouse the land is already the front nine's.
   const tries=!i?1:arch&&i%nine>=nine-3?450:150;
   for(let k=0;k<tries;k++){
    const previous=placed.at(-1),a=i?rng()*Math.PI*2:0,walk=i?(i%3===0?biomeOf(s.biome).hop:58)+rng()*55+Math.max(0,Math.min(k,150)-115)*5:0;
    // Walked from the CENTRE of the last green, not from its cup. A hole location
    // moves through the week; where the next tee goes does not, and routing off
    // the cup would have rebuilt the whole course every time a pin was recut.
    // There is no previous hole for the first one, so this stays inside the i test.
    const from=i?(previous.green??previous.pin):null;
    const origin=i?{x:from.x+Math.sin(a)*walk,z:from.z+Math.cos(a)*walk}:{x:0,z:0};
    const rot=i?rng()*Math.PI*2:0,c=Math.cos(rot),sn=Math.sin(rot),points=local.map(p=>({x:origin.x+p.x*c+p.z*sn,z:origin.z-p.x*sn+p.z*c,r:p.r}));
    let collision=false;outer:for(const p of points)for(const q of samples){const d=p.r+q.r+s.spacing;if((p.x-q.x)**2+(p.z-q.z)**2<d*d){collision=true;break outer;}}
    if(collision)continue;
    const end=points.at(-1),mid=points[Math.floor(points.length/2)],homeWeight=footprint.kind==='ribbon'?0:i>holes.length-4?.45:.05;
    const guide=footprint.points[Math.round((i+1)/holes.length*64)];let score=footprint.kind==='square'?Math.max(Math.abs(mid.x),Math.abs(mid.z))*.7+Math.hypot(end.x,end.z)*homeWeight+walk*.9:footprint.distance(mid)*2.3+footprint.distance(end)*1.7+Math.hypot(end.x-guide.x,end.z-guide.z)*.45+Math.hypot(end.x,end.z)*homeWeight+walk*.9+rng()*45;
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
    // An Architect course pays for the walk to the tee three times over (the end of
    // the goal: routing home had lengthened the longest walks, p95 191 ->
    // 283 m, the late holes' extra tries all made at the longest walk).
    score+=homeArch(i,end,origin)+(arch?walk*1.8:0);
    if(!chosen||score<chosen.score)chosen={origin,rot,points,pin:end,score,walk};
   }
   if(!chosen){const previous=placed.at(-1),origin={x:Math.max(...samples.map(p=>p.x+p.r))+Math.max(...local.map(p=>Math.abs(p.x)+p.r))+s.spacing+25,z:(previous.green??previous.pin).z-h.length/2},rot=0;chosen={origin,rot,points:local.map(p=>({...p,x:p.x+origin.x,z:p.z+origin.z})),pin:{x:origin.x+h.pin.x,z:origin.z+h.pin.z},score:1e6,walk:350};penalty+=1e6;}
   placed.push(chosen);samples.push(...chosen.points);penalty+=chosen.walk||0;
  }
  const xs=samples.map(p=>p.x),zs=samples.map(p=>p.z),bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  const pull=biomeOf(s.biome).routeParallel,pairs=pull?placed.filter(p=>p.beside).length*pull.weight:0;
  const score=(bounds.maxX-bounds.minX)*(bounds.maxZ-bounds.minZ)/1800+penalty-pairs+Math.hypot((placed.at(-1).green??placed.at(-1).pin).x,(placed.at(-1).green??placed.at(-1).pin).z)*2
   +(arch&&holes.length>=18?Math.hypot((placed[nine-1].green??placed[nine-1].pin).x,(placed[nine-1].green??placed[nine-1].pin).z)*2:0);
  if(!best||score<best.score)best={placed,bounds,score};
 }
 const dx=(best.bounds.minX+best.bounds.maxX)/2,dz=(best.bounds.minZ+best.bounds.maxZ)/2;
 holes.forEach((h,i)=>placeHole(h,{x:best.placed[i].origin.x-dx,z:best.placed[i].origin.z-dz},best.placed[i].rot));
 return {halfX:(best.bounds.maxX-best.bounds.minX)/2+125,halfZ:(best.bounds.maxZ-best.bounds.minZ)/2+125,footprint:{kind:footprint.kind,points:footprint.points.map(p=>({x:p.x-dx,z:p.z-dz}))}};
}
