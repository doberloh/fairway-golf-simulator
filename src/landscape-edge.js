import * as T from 'three';
import {biomeOf} from './biomes.js';
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
export function landscapeGeometry(w){
 const g=w.groundGrid,edge=[];for(let i=0;i<g.nx;i++)edge.push(i);for(let j=0;j<g.nz;j++)edge.push(j*(g.nx+1)+g.nx);for(let i=g.nx;i>0;i--)edge.push(g.nz*(g.nx+1)+i);for(let j=g.nz;j>0;j--)edge.push(j*(g.nx+1));
 const count=edge.length,lift=biomeOf(w.settings.biome).ringLift;
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
 for(let step=8;steps[steps.length-1]<REACH;step*=1.28)steps.push(Math.min(REACH,steps[steps.length-1]+step));
 // How long each ring is, from a coarse walk round it, to size its spacing.
 const around=d=>{let L=0,prev=null;for(let k=0;k<=256;k++){const [x0,z0]=perimeter(k/256*count),r=Math.hypot(x0,z0),p=[x0+x0/r*d,z0+z0/r*d];if(prev)L+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);prev=p;}return L;};
 const positions=[],indices=[],rings=[],along=[],out=[];
 steps.forEach((distance,ring)=>{
  const first=positions.length/3,ts=[];
  if(ring===0){for(let i=0;i<count;i++){const id=edge[i];positions.push(g.positions[id*3],g.positions[id*3+1],g.positions[id*3+2]);ts.push(i);along.push(i);out.push(0);}}
  else{
   const outward=distance-steps[ring-1];
   const n=Math.max(48,Math.min(count,Math.round(around(distance)/Math.max(outward,3))));
   const fade=T.MathUtils.smoothstep(distance,0,900);
   for(let j=0;j<n;j++){
    const t=j/n*count,[x0,z0]=perimeter(t),r=Math.hypot(x0,z0),x=x0+x0/r*distance,z=z0+z0/r*distance;
    const ridge=Math.abs(Math.sin(x/520+Math.sin(z/430)))*.55+Math.abs(Math.sin(z/680+x/810))*.3+Math.abs(Math.sin(x/173-z/230))*.15;
    positions.push(x,w.height(x,z)+lift*ridge*fade,z);ts.push(t);along.push(t);out.push(distance);
   }
  }
  rings.push({first,ts});
 });
 // Stitch each ring to the next, in the winding the old quads had: inner
 // (i, i+1, outer j) and (inner i+1, outer j+1, outer j).
 for(let r=0;r+1<rings.length;r++){
  const A=rings[r],B=rings[r+1],na=A.ts.length,nb=B.ts.length;
  const ta=k=>k<na?A.ts[k]:A.ts[k-na]+count,tb=k=>k<nb?B.ts[k]:B.ts[k-nb]+count;
  const ia=k=>A.first+k%na,ib=k=>B.first+k%nb;
  let i=0,j=0;
  while(i<na||j<nb){
   if(j>=nb||(i<na&&ta(i+1)<=tb(j+1))){indices.push(ia(i),ia(i+1),ib(j));i++;}
   else{indices.push(ia(i),ib(j+1),ib(j));j++;}
  }
 }
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
