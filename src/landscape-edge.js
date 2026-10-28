import * as T from 'three';
import {biomeOf} from './biomes.js';
import {fbm,saltOf} from './landforms.js';
// Join the detailed ground's exact perimeter vertices to progressively wider
// landscape rings. No overlapping rectangular backdrop or exposed tile edge.
//
// TRIANGLES THAT STAY ROUGHLY SQUARE (U7 in TODO). Every ring used to carry
// every perimeter vertex -- 3 m apart at the course's edge -- pushed outward, so
// out where the rings are kilometres apart each triangle was tens of metres
// wide and kilometres long (70 to 1 at the last ring). Heights and normals
// sampled finely around the ring and coarsely across it shaded as streaks
// radiating from the course, which is what the overview showed. Now the rings
// start close together and widen by a steady ratio, and each ring carries only
// as many vertices as keep its spacing along the ring near its step outward;
// neighbouring rings with different counts are stitched by walking both at
// once. The first ring is still exactly the ground's perimeter, vertex for
// vertex, so the join to the course is unchanged.
// THE RING'S RELIEF AT A POINT: what the landscape adds on top of the
// course's own height, `distance` metres out from the ground's edge. One
// function for the ring's vertices and for anything that stands on the ring
// (far-woods.js), so the two cannot drift apart.
export function ringRelief(w){
 const bio=biomeOf(w.settings.biome),lift=bio.ringLift;
 const shore=bio.edgeCoast?(x=>1-T.MathUtils.smoothstep(x,w.halfX-260,w.halfX+40)):(()=>1);
 const peaks=bio.ringPeaks?(()=>{const s=saltOf(w.settings.seed,'peaks'),rg=(x,z,k,o)=>{const r=1-Math.abs(2*fbm(x,z,s+k,o)-1);return r*r;};
  return (x,z)=>{const a=rg(x/1500,z/1500,0,3),b=rg(x/560+3.1,z/560-7.7,11,2),c=rg(x/240-5.3,z/240+2.9,23,2);return Math.min(1.25,Math.pow(a,1.6)*.85+Math.pow(b,2)*.3*(.4+a)+c*.09*a);};})():null;
 // MESAS AND BUTTES (the far-landscape goal; the owner: "I think we need more
 // plateaus"). A landscape with `ringMesas` raises its far land as flat-topped
 // tables: a smooth field, warped so the outlines wander, cut into up to three
 // tiers by narrow steps (the cliffs), each with a talus apron spread wider
 // below it, over a low rolling floor -- Monument Valley and the Colorado
 // Plateau's mesas, buttes where the field only just crosses a tier. Seeded
 // from the course's seed; scenery only. PLACED: every number.
 const mesas=bio.ringMesas?(()=>{const s=saltOf(w.settings.seed,'mesas'),ss=T.MathUtils.smoothstep;
  return (x,z)=>{
   // Round 2 of the far landscape: a 2.4 km field in four octaves with 6 m
   // cliffs broke into a scatter of jagged fragments, and cliffs narrower than
   // the ring's rows aliased into stair-steps. Now a 4 km field in three, two
   // tiers, the cliffs as wide as two or three rows.
   const wx=x+(fbm(x/1400,z/1400,s+5,2)-.5)*700,wz=z+(fbm(x/1400+7.3,z/1400-3.1,s+9,2)-.5)*700,n=fbm(wx/4000,wz/4000,s,3);
   const tier=(t,w,h)=>ss(n,t-w,t+w)*h,apron=(t,h)=>ss(n,t-.08,t-.02)*h;
   return tier(.55,.018,.62)+apron(.55,.12)+tier(.62,.014,.36)+apron(.62,.06)+fbm(x/900,z/900,s+3,2)*.06;
  };})():null;
 const ridgeAt=(x,z)=>peaks?peaks(x,z):mesas?mesas(x,z):Math.abs(Math.sin(x/520+Math.sin(z/430)))*.55+Math.abs(Math.sin(z/680+x/810))*.3+Math.abs(Math.sin(x/173-z/230))*.15;
 // FAR ISLANDS (the far-landscape goal, round 3): a landscape with
 // `ringIslands` (Island: sea to every horizon) raises a few islets out of its
 // far sea -- each a low hill with a beach skirt, its outline wandering, from
 // 2.5 to 6 km out (inside the sea's 7 km plane). Seeded; scenery only, the
 // far woods plant them as they plant any far land. PLACED.
 const isles=bio.ringIslands?(()=>{const s=saltOf(w.settings.seed,'islands'),r=k=>{const v=Math.sin((s+k*7919)*12.9898)*43758.5453;return v-Math.floor(v);},ss=T.MathUtils.smoothstep;
  const list=Array.from({length:bio.ringIslands},(_,i)=>{const a=r(i*3)*6.2832,d=2500+r(i*3+1)*3500,R=260+r(i*3+2)*520;return {x:Math.cos(a)*(w.halfX+d),z:Math.sin(a)*(w.halfZ+d),R,H:24+r(i*5+4)*46};});
  return (x,z)=>{let h=0;for(const q of list){const dd=Math.hypot(x-q.x,z-q.z)/q.R*(1+.25*(fbm(x/260,z/260,s+11,2)-.5));if(dd<1.3)h=Math.max(h,(1-ss(dd,.85,1.25))*3.5+(1-ss(dd,.2,.95))*q.H);}return h;};})():null;
 return {peaks,mesas,isles,at:(x,z,distance)=>(lift*ridgeAt(x,z)*shore(x)+(isles?isles(x,z):0))*T.MathUtils.smoothstep(distance,0,900)};
}
// THE RING AS PLAIN ARRAYS (the far-landscape goal, 26 October 2026). The
// drawn landscape is these triangles, not `ringRelief` sampled finely: out
// where rings are hundreds of metres apart a grove seated on the fine field
// hung over the drawn faces, or stood in the sea where the drawn coast ran
// further in. Anything that stands on the ring asks `drawnGround`, which reads
// these same triangles; the renderer builds its geometry from them. Built
// once per world.
const RINGS=new WeakMap();
export function ringMesh(w){
 let m=RINGS.get(w);if(!m){m=buildRing(w);RINGS.set(w,m);}return m;
}
function buildRing(w){
 const g=w.groundGrid,edge=[];for(let i=0;i<g.nx;i++)edge.push(i);for(let j=0;j<g.nz;j++)edge.push(j*(g.nx+1)+g.nx);for(let i=g.nx;i>0;i--)edge.push(g.nz*(g.nx+1)+i);for(let j=g.nz;j>0;j--)edge.push(j*(g.nx+1));
 const bio=biomeOf(w.settings.biome),count=edge.length;
 // A SEA ALONG ONE EDGE HAS NO FAR SHORE. The rings lift hills out of every
 // side, and on the water side that put a range of hills a kilometre out of
 // Lakeshore Dunes' lake, so it read as a wide river. Toward the coast (+x,
 // where course.js `land` sends an edgeCoast biome under water) the lift fades
 // to nothing. Links has an edge coast too but a ring lift of zero, so it is
 // unchanged.
 const relief=ringRelief(w);
 // PEAKS, NOT ROLLS (the polish goal; the owner: "our mountains are very
 // smooth"). The ring's relief was three summed sine waves: rolling ridges.
 // A landscape with `ringPeaks` gets a ridged-noise field instead -- crests
 // squared so they are knife-edged, summits where two ridge systems cross,
 // a second, smaller set of spurs running off them -- so the far range reads
 // as peaks and aretes, faceted at the rings' coarse spacing. Seeded from the
 // course's seed; scenery only, nothing a ball reaches. PLACED. Round 5: a
 // third, finer set of ridges (240 m) on the high ground, for the doubled
 // vertices to show as gullies and ribs on the faces. (In `ringRelief`.)
 const peaks=relief.peaks;
 // A point on the perimeter at a fractional position t (0..count, wrapping).
 const perimeter=t=>{
  const i=Math.floor(t)%count,f=t-Math.floor(t),a=edge[i],b=edge[(i+1)%count];
  return [g.positions[a*3]+(g.positions[b*3]-g.positions[a*3])*f,g.positions[a*3+2]+(g.positions[b*3+2]-g.positions[a*3+2])*f];
 };
 // Rings run outward from the detailed ground's own perimeter, so the nearest
 // outer edge from a camera standing inside the course is the last step away --
 // fog has to reach full density before that or the world visibly ends. The
 // outermost reach (13 km) is the one the high tiers' draw distance was set for.
 const REACH=13000,steps=[0];
 // Mesas (and far islands) need their cliffs drawn: rings 16% apart, never more than 220 m (were
 // 28% and unbounded -- 500 m rows smeared a cliff into a ramp), and 2.5 times
 // as many vertices round each ring.
 const mesaRings=!!(relief.mesas||relief.isles),grow=mesaRings?1.16:1.28,most=mesaRings?220:1e9;
 for(let step=8;steps[steps.length-1]<REACH;step=Math.min(most,step*grow))steps.push(Math.min(REACH,steps[steps.length-1]+step));
 // How long each ring is, from a coarse walk round it, to size its spacing.
 const around=d=>{let L=0,prev=null;for(let k=0;k<=256;k++){const [x0,z0]=perimeter(k/256*count),r=Math.hypot(x0,z0),p=[x0+x0/r*d,z0+z0/r*d];if(prev)L+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);prev=p;}return L;};
 const positions=[],indices=[],rings=[],along=[],out=[];
 steps.forEach((distance,ring)=>{
  const first=positions.length/3,ts=[];
  if(ring===0){for(let i=0;i<count;i++){const id=edge[i];positions.push(g.positions[id*3],g.positions[id*3+1],g.positions[id*3+2]);ts.push(i);along.push(i);out.push(0);}}
  else{
   const outward=distance-steps[ring-1];
   // A peaked range twice as dense along each ring (round 5: at one vertex
   // per ring step its nearest faces were single planes hundreds of metres
   // wide); a few thousand triangles more, out where nothing else is drawn.
   const dense=peaks?2:mesaRings?2.5:1,n=Math.max(48,Math.min(Math.round(count*dense),Math.round(around(distance)/Math.max(outward,3)*dense)));
   for(let j=0;j<n;j++){
    const t=j/n*count,[x0,z0]=perimeter(t),r=Math.hypot(x0,z0),x=x0+x0/r*distance,z=z0+z0/r*distance;
    positions.push(x,w.height(x,z)+relief.at(x,z,distance),z);ts.push(t);along.push(t);out.push(distance);
   }
  }
  rings.push({first,ts});
 });
 // Stitch each ring to the next, in the winding the old quads had: inner
 // (i, i+1, outer j) and (inner i+1, outer j+1, outer j). Each band's
 // triangles are kept in order round the ring, with the furthest position
 // along it each reaches, so `drawnGround` can find one by bisection.
 const bands=[];
 for(let r=0;r+1<rings.length;r++){
  const A=rings[r],B=rings[r+1],na=A.ts.length,nb=B.ts.length;
  const ta=k=>k<na?A.ts[k]:A.ts[k-na]+count,tb=k=>k<nb?B.ts[k]:B.ts[k-nb]+count;
  const ia=k=>A.first+k%na,ib=k=>B.first+k%nb;
  const first=indices.length/3,reach=[];
  let i=0,j=0;
  while(i<na||j<nb){
   if(j>=nb||(i<na&&ta(i+1)<=tb(j+1))){indices.push(ia(i),ia(i+1),ib(j));reach.push(Math.max(ta(i+1),tb(j)));i++;}
   else{indices.push(ia(i),ib(j+1),ib(j));reach.push(Math.max(ta(i),tb(j+1)));j++;}
  }
  bands.push({first,reach});
 }
 return {positions,indices,edge,along,out,count,steps,bands};
}
// THE HEIGHT OF THE GROUND AS DRAWN at any point: the course's grid inside its
// edge (`w.height` interpolates the same cells the ground mesh draws), the
// ring's own triangles outside it.
export function drawnGround(w){
 const g=w.groundGrid,{positions:P,indices:I,count,steps,bands}=ringMesh(w),gx=g.halfX,gz=g.halfZ,dx=2*gx/g.nx,dz=2*gz/g.nz;
 const last=steps.length-2;
 // A triangle's test writes how far inside the point is and its height to
 // these two, not to a new object: a placement asks this hundreds of
 // thousands of times (round 4 of the far landscape: allocation was most of
 // its cost).
 let tIn=0,tY=0,bestIn=-1e9,bestY=0;
 const tri=(k,x,z)=>{
  const a=I[k*3]*3,b=I[k*3+1]*3,c=I[k*3+2]*3,x1=P[a],z1=P[a+2],x2=P[b],z2=P[b+2],x3=P[c],z3=P[c+2];
  const den=(z2-z3)*(x1-x3)+(x3-x2)*(z1-z3);if(Math.abs(den)<1e-9)return false;
  const l1=((z2-z3)*(x-x3)+(x3-x2)*(z-z3))/den,l2=((z3-z1)*(x-x3)+(x1-x3)*(z-z3))/den,l3=1-l1-l2;
  tIn=Math.min(l1,l2,l3);tY=l1*P[a+1]+l2*P[b+1]+l3*P[c+1];
  if(tIn>bestIn){bestIn=tIn;bestY=tY;}
  return bestIn>=-1e-6;
 };
 return (x,z)=>{
  if(Math.abs(x)<=gx&&Math.abs(z)<=gz)return w.height(x,z);
  // Where the ray from the centre through the point crosses the grid's edge,
  // and how far out past it the point lies: the ring's own two coordinates.
  const sx=gx/Math.max(Math.abs(x),1e-9),sz=gz/Math.max(Math.abs(z),1e-9),s=Math.min(sx,sz),qx=x*s,qz=z*s;
  let t=sx<sz?(x>0?g.nx+(qz+gz)/dz:2*g.nx+g.nz+(gz-qz)/dz):(z<0?(qx+gx)/dx:g.nx+g.nz+(gx-qx)/dx);
  t=((t%count)+count)%count;
  const d=Math.hypot(x,z)*(1-s);
  let r=0,rh=last;while(r<rh){const m=(r+rh+1)>>1;if(steps[m]<=d)r=m;else rh=m-1;}
  const band=bands[r],R=band.reach;
  let lo=0,hi=R.length-1;while(lo<hi){const m=(lo+hi)>>1;if(R[m]<t)lo=m+1;else hi=m;}
  // The ring's triangles are flat in plan, its coordinates are not quite, so
  // the right one is among the neighbours of the one bisection finds.
  bestIn=-1e9;let found=false;
  for(let k=Math.max(0,lo-4);k<=Math.min(R.length-1,lo+4)&&!found;k++)found=tri(band.first+k,x,z);
  // Rings are joined by straight chords, so a point just inside a ring's
  // chord belongs to the band beside the one its distance names (1 lookup in
  // 400 on PNW): search that band and its neighbours whole.
  if(!found)for(const b of [r,r-1,r+1]){if(b<0||b>last||found)continue;const B=bands[b];for(let k=0;k<B.reach.length&&!found;k++)found=tri(B.first+k,x,z);}
  return bestIn>-1e9?bestY:w.height(x,z);
 };
}
// THE DRAWN GROUND'S OWN VERTICES within `r` of a point. The drawn ground is
// flat between its vertices, so the lowest point under a footprint is one of
// them or on the footprint's rim: a seat that looks at both cannot miss a dip
// (sampling alone left a few far groves hanging over a ring vertex in a
// gully). The ring's vertices from a hash of 64 m cells; the course's grid
// vertices from its own spacing, with the points of any refined cell.
const VERTS=new WeakMap();
export function drawnVertices(w){
 let f=VERTS.get(w);if(f)return f;
 const {positions:P}=ringMesh(w),C=64,cells=new Map(),g=w.groundGrid,gx=g.halfX,gz=g.halfZ,dx=2*gx/g.nx,dz=2*gz/g.nz;
 for(let v=0;v<P.length/3;v++){const k=Math.floor(P[v*3]/C)+','+Math.floor(P[v*3+2]/C);let c=cells.get(k);if(!c)cells.set(k,c=[]);c.push(v);}
 f=(x,z,r)=>{
  const out=[];
  for(let i=Math.floor((x-r)/C);i<=Math.floor((x+r)/C);i++)for(let j=Math.floor((z-r)/C);j<=Math.floor((z+r)/C);j++)for(const v of cells.get(i+','+j)||[]){const px=P[v*3],pz=P[v*3+2];if((px-x)**2+(pz-z)**2<=r*r)out.push([px,pz,P[v*3+1]]);}
  const near=(px,pz,y)=>{if((px-x)**2+(pz-z)**2<=r*r)out.push([px,pz,y]);};
  if(Math.abs(x)-r<gx&&Math.abs(z)-r<gz)
   for(let i=Math.max(0,Math.floor((x-r+gx)/dx));i<=Math.min(g.nx,Math.floor((x+r+gx)/dx));i++)for(let j=Math.max(0,Math.floor((z-r+gz)/dz));j<=Math.min(g.nz,Math.floor((z+r+gz)/dz));j++){
    const px=-gx+i*dx,pz=-gz+j*dz;near(px,pz,g.values[j*(g.nx+1)+i]);
    const cell=i<g.nx&&j<g.nz?g.cells?.get(j*g.nx+i):null;
    if(cell?.n){const n=cell.n;for(let a=0;a<=n;a++)for(let b=0;b<=n;b++)near(px+a/n*dx,pz+b/n*dz,cell.heights[b*(n+1)+a]);}
    else if(cell?.ring){near(px+.5*dx,pz+.5*dz,cell.y);for(const A of cell.ring)near(px+A.u*dx,pz+A.v*dz,A.y);}
   }
  return out;
 };
 VERTS.set(w,f);return f;
}
export function landscapeGeometry(w){
 const {positions,indices,edge,along,out,count}=ringMesh(w);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();geo.userData.innerCount=count;geo.userData.edge=edge;geo.userData.along=along;geo.userData.out=out;
 // Filled from the course's own relief by stitchSeam; zero until then.
 geo.setAttribute('localRelief',new T.BufferAttribute(new Float32Array(positions.length/3),1));
 return geo;
}
// ONE SURFACE ACROSS THE SEAM. The course's ground and this landscape each work
// out their normals from their own triangles only, so along the join each side
// had a one-sided normal and the two disagreed: a thin light outline round the
// course, plain from the overview. Both sides take the average of the two.
//
// AND ONE TONE. The course's ground carries a baked relief value per vertex
// (ground.js, attachRelief -- crowns lifted, hollows darkened) and this
// landscape had none, which a shader reads as zero: wherever the perimeter sat
// on a crown that was a light line round the whole course. The landscape now
// takes the ground's relief at the seam and lets it fade to nothing over the
// first 300 m out, the same distance its ridges fade in over.
export function stitchSeam(ground,landscape){
 const edge=landscape.userData.edge,gn=ground.attributes.normal,ln=landscape.attributes.normal;
 if(!edge||!gn||!ln)return;
 const gr=ground.attributes.localRelief,lr=landscape.attributes.localRelief,{along,out}=landscape.userData;
 if(gr&&lr&&along){
  const count=edge.length;
  for(let v=0;v<lr.count;v++){
   const t=along[v],i=Math.floor(t)%count,f=t-Math.floor(t);
   const seam=gr.getX(edge[i])*(1-f)+gr.getX(edge[(i+1)%count])*f;
   lr.setX(v,seam*(1-T.MathUtils.smoothstep(out[v],0,300)));
  }
  lr.needsUpdate=true;
 }
 const n=new T.Vector3();
 edge.forEach((id,k)=>{
  n.set(gn.getX(id)+ln.getX(k),gn.getY(id)+ln.getY(k),gn.getZ(id)+ln.getZ(k)).normalize();
  gn.setXYZ(id,n.x,n.y,n.z);ln.setXYZ(k,n.x,n.y,n.z);
 });
 gn.needsUpdate=ln.needsUpdate=true;
}
