import * as T from 'three';
import {biomeOf} from './biomes.js';
// Join the detailed ground's exact perimeter vertices to progressively wider
// landscape rings. No overlapping rectangular backdrop or exposed tile edge.
export function landscapeGeometry(w){
 const g=w.groundGrid,edge=[];for(let i=0;i<g.nx;i++)edge.push(i);for(let j=0;j<g.nz;j++)edge.push(j*(g.nx+1)+g.nx);for(let i=g.nx;i>0;i--)edge.push(g.nz*(g.nx+1)+i);for(let j=g.nz;j>0;j--)edge.push(j*(g.nx+1));
 // Rings run outward from the detailed ground's own perimeter, so the nearest
 // outer edge from a camera standing inside the course is the last step away --
 // fog has to reach full density before that or the world visibly ends. The
 // last two steps exist for the high tier's longer draw distance.
 const steps=[0,12,35,75,150,300,550,950,1600,2500,4000,6000,9000,13000],positions=[],indices=[],count=edge.length;
 for(const [ring,distance] of steps.entries())for(let i=0;i<count;i++){const id=edge[i],x0=g.positions[id*3],z0=g.positions[id*3+2],length=Math.hypot(x0,z0),x=x0+x0/length*distance,z=z0+z0/length*distance,fade=T.MathUtils.smoothstep(distance,0,900),ridge=Math.abs(Math.sin(x/520+Math.sin(z/430)))*.55+Math.abs(Math.sin(z/680+x/810))*.3+Math.abs(Math.sin(x/173-z/230))*.15;
  let y=ring===0?g.positions[id*3+1]:w.height(x,z);y+=biomeOf(w.settings.biome).ringLift*ridge*fade;
  positions.push(x,y,z);if(ring<steps.length-1){const a=ring*count+i,b=ring*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,b,c,b,d,c);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();geo.userData.innerCount=count;return geo;
}
