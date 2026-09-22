// Shared contact/render mesh: coarse countryside, half-metre greens and bunkers.
//
// THIS IS 81% OF GENERATING A COURSE, measured -- see RESEARCH.md. Everything
// else put together is under a fifth of it, which is why the plan to yield
// between generateWorld's phases was abandoned: it would have handed the browser
// a frame about twice in eight seconds. So the grid itself yields, by row band,
// and the async driver in main.js decides when to actually pause.
//
// The yields are the ONLY change to the arithmetic. Every loop runs in the same
// order over the same cells producing the same floats, which is what lets the
// eight biome fingerprints stay identical across this -- and they do.
//
// Rough cost weights per loop, from the same profile: the coarse sample and the
// triangulation (which samples a sub-vertex per refined cell) are nearly all of
// it. They are here so the progress reading advances at something like an even
// rate rather than sitting at 2% and then jumping.
const LOOP_WEIGHT=[.44,.02,.08,.46];
export function makeGroundGrid(sample,halfX,halfZ,spacing=3,refine=null){
 const it=makeGroundGridSteps(sample,halfX,halfZ,spacing,refine);
 let r=it.next();while(!r.done)r=it.next();
 return r.value;
}
export function* makeGroundGridSteps(sample,halfX,halfZ,spacing=3,refine=null){
 const nx=Math.ceil(halfX*2/spacing),nz=Math.ceil(halfZ*2/spacing),dx=halfX*2/nx,dz=halfZ*2/nz,values=new Float32Array((nx+1)*(nz+1));
 let base=0;
 for(let j=0;j<=nz;j++){for(let i=0;i<=nx;i++)values[j*(nx+1)+i]=sample(-halfX+i*dx,-halfZ+j*dz);
  yield base+LOOP_WEIGHT[0]*(j/nz);}
 base+=LOOP_WEIGHT[0];
 const g={nx,nz,dx,dz,halfX,halfZ,values};if(!refine)return g;
 const mask=new Uint8Array(nx*nz),N=6,cells=new Map(),positions=[],indices=[],extra=new Map();
 for(let j=0;j<=nz;j++){for(let i=0;i<=nx;i++)positions.push(-halfX+i*dx,values[j*(nx+1)+i],-halfZ+j*dz);
  yield base+LOOP_WEIGHT[1]*(j/nz);}
 base+=LOOP_WEIGHT[1];
 // The corner heights are handed to `refine` because they are already sampled
 // and free. A predicate that wants to know whether a cell STRADDLES something
 // -- a waterline, say -- cannot answer that from the centre point alone at any
 // band width, and re-sampling the corners itself costs a full height evaluation
 // each. Existing predicates that only take (x,z) are unaffected.
 for(let j=0;j<nz;j++){for(let i=0;i<nx;i++)mask[j*nx+i]=refine(-halfX+(i+.5)*dx,-halfZ+(j+.5)*dz,
  values[j*(nx+1)+i],values[j*(nx+1)+i+1],values[(j+1)*(nx+1)+i],values[(j+1)*(nx+1)+i+1])?1:0;
  yield base+LOOP_WEIGHT[2]*(j/nz);}
 base+=LOOP_WEIGHT[2];
 const vertex=(u,v)=>{if(u%N===0&&v%N===0)return v/N*(nx+1)+u/N;const key=v*(nx*N+1)+u;if(extra.has(key))return extra.get(key);const index=positions.length/3,x=-halfX+u/N*dx,z=-halfZ+v/N*dz;positions.push(x,Math.fround(sample(x,z)),z);extra.set(key,index);return index;};
 const marked=(i,j)=>i>=0&&j>=0&&i<nx&&j<nz&&mask[j*nx+i];
 for(let j=0;j<nz;j++){
  for(let i=0;i<nx;i++){
  const key=j*nx+i,a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
  if(mask[key]){const heights=new Float32Array((N+1)**2),ids=[];for(let z=0;z<=N;z++)for(let x=0;x<=N;x++){const id=vertex(i*N+x,j*N+z);ids.push(id);heights[z*(N+1)+x]=positions[id*3+1];}for(let z=0;z<N;z++)for(let x=0;x<N;x++){const k=z*(N+1)+x;indices.push(ids[k],ids[k+N+1],ids[k+1],ids[k+1],ids[k+N+1],ids[k+N+2]);}cells.set(key,{n:N,heights});
  }else if(marked(i-1,j)||marked(i,j+1)||marked(i+1,j)||marked(i,j-1)){
   const ring=[],edges=[marked(i-1,j),marked(i,j+1),marked(i+1,j),marked(i,j-1)];
   for(let edge=0;edge<4;edge++)for(let k=0;k<N;k+=edges[edge]?1:N){const [u,v]=[[0,k],[k,N],[N,N-k],[N-k,0]][edge],id=vertex(i*N+u,j*N+v);ring.push({u:u/N,v:v/N,y:positions[id*3+1],id});}
   const mid=vertex(i*N+N/2,j*N+N/2);for(let k=0;k<ring.length;k++)indices.push(mid,ring[k].id,ring[(k+1)%ring.length].id);cells.set(key,{ring,y:positions[mid*3+1]});
  }else indices.push(a,c,b,b,c,d);
  }
  yield base+LOOP_WEIGHT[3]*(j/nz);
 }
 g.cells=cells;g.positions=new Float32Array(positions);g.indices=new Uint32Array(indices);return g;
}
const plane=(A,B,C,D,a,b)=>a+b<=1?A+(B-A)*a+(C-A)*b:D+(C-D)*(1-a)+(B-D)*(1-b);
export function groundHeight(g,x,z,fallback){
 const u=(x+g.halfX)/g.dx,v=(z+g.halfZ)/g.dz;if(u<0||v<0||u>g.nx||v>g.nz)return fallback(x,z);
 const i=Math.min(g.nx-1,Math.floor(u)),j=Math.min(g.nz-1,Math.floor(v)),a=u-i,b=v-j,k=j*(g.nx+1)+i,cell=g.cells?.get(j*g.nx+i);
 if(cell?.n){const n=cell.n,ix=Math.min(n-1,Math.floor(a*n)),iz=Math.min(n-1,Math.floor(b*n)),p=iz*(n+1)+ix,h=cell.heights;return plane(h[p],h[p+1],h[p+n+1],h[p+n+2],a*n-ix,b*n-iz);}
 if(cell?.ring){const r=cell.ring;for(let k=0;k<r.length;k++){const A=r[k],B=r[(k+1)%r.length],den=(A.v-B.v)*(.5-B.u)+(B.u-A.u)*(.5-B.v),w=((A.v-B.v)*(a-B.u)+(B.u-A.u)*(b-B.v))/den,q=((B.v-.5)*(a-B.u)+(.5-B.u)*(b-B.v))/den;if(w>=-1e-8&&q>=-1e-8&&1-w-q>=-1e-8)return w*cell.y+q*A.y+(1-w-q)*B.y;}}
 return plane(g.values[k],g.values[k+1],g.values[k+g.nx+1],g.values[k+g.nx+2],a,b);
}
