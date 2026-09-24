import {BANK_COLORS} from './streams.js';
import {toonRamp} from './textures.js';
import * as T from 'three';
import {fairwayWidth,teePad,TEE_PAD,TEE_APRON,TEE_APRON_SCALE,TEE_ROUND,BEACH_RISE,BEACH_FADE,GREEN_RAMP,BAND_ROUND} from './course.js';
import {CUP_RADIUS} from './physics.js';
import {biomeOf} from './biomes.js';

// LOCAL RELIEF: how high a point stands above the ground AROUND it.
//
// The cue that lets you read undulation at midday, when a two metre roll casts
// no shadow at all and the turf goes back to looking like a painted plane.
// Positive on a crown, negative in a hollow, and unlike a raking light it does
// not care which way a slope faces -- a roll running across your line reads as
// strongly as one running down it.
//
// THE RADIUS IS THE WHOLE THING. The textbook answer is curvature, the discrete
// Laplacian, and measured on a real hole it moves 0.3% of the ground: a bunker
// lip is hundreds of times more curved than a fairway roll, so any scale that
// fits the lip erases the roll. Height minus a LOCAL AVERAGE has a radius to
// tune instead, and 15 m is the size of the thing a golfer is trying to see --
// it marks 70% of the ground where the Laplacian marked almost none.
export const RELIEF_RADIUS=15;

// Separable box blur with a running sum, so the cost is the grid size and not
// the grid size times the radius.
function blurAxis(src,dst,n1,n2,s1,s2,r){
 for(let b=0;b<n2;b++){
  const base=b*s2;let sum=0,count=0;
  for(let k=0;k<=r&&k<n1;k++){sum+=src[base+k*s1];count++;}
  for(let a=0;a<n1;a++){
   dst[base+a*s1]=sum/count;
   const add=a+r+1,drop=a-r;
   if(add<n1){sum+=src[base+add*s1];count++;}
   if(drop>=0){sum-=src[base+drop*s1];count--;}
  }
 }
}

// The field, normalised to roughly [-1,1] by its own 90th percentile so one
// gorge cannot flatten a whole course. Sampled bilinearly by the vertices,
// which on a refined grid sit between the cells this was built from.
export function localReliefField(g,metres=RELIEF_RADIUS){
 const w=g.nx+1,h=g.nz+1,n=w*h;
 const tmp=new Float32Array(n),avg=new Float32Array(n),out=new Float32Array(n);
 blurAxis(g.values,tmp,w,h,1,w,Math.max(1,Math.round(metres/g.dx)));
 blurAxis(tmp,avg,h,w,w,1,Math.max(1,Math.round(metres/g.dz)));
 for(let k=0;k<n;k++)out[k]=g.values[k]-avg[k];
 // A percentile rather than the maximum: the maximum is one cliff.
 const sample=[];for(let k=0;k<n;k+=Math.max(1,n>>14|0))sample.push(Math.abs(out[k]));
 sample.sort((a,b)=>a-b);
 const scale=sample[Math.floor(sample.length*.9)]||1;
 for(let k=0;k<n;k++)out[k]=Math.max(-1,Math.min(1,out[k]/scale));
 return {field:out,w,h,scale};
}

// Attaches it to whatever geometry is handed over, regular or refined, by
// sampling at each vertex's own x/z.
function attachRelief(geometry,g){
 const {field,w,h}=localReliefField(g);
 const pos=geometry.getAttribute('position'),relief=new Float32Array(pos.count);
 for(let v=0;v<pos.count;v++){
  const fx=(pos.getX(v)+g.halfX)/g.dx,fz=(pos.getZ(v)+g.halfZ)/g.dz;
  const i=Math.max(0,Math.min(w-2,Math.floor(fx))),j=Math.max(0,Math.min(h-2,Math.floor(fz)));
  const tx=Math.max(0,Math.min(1,fx-i)),tz=Math.max(0,Math.min(1,fz-j));
  const a=field[j*w+i],b=field[j*w+i+1],c=field[(j+1)*w+i],d=field[(j+1)*w+i+1];
  relief[v]=(a*(1-tx)+b*tx)*(1-tz)+(c*(1-tx)+d*tx)*tz;
 }
 geometry.setAttribute('localRelief',new T.BufferAttribute(relief,1));
 return geometry;
}

export function groundGeometry(g){
 if(g.positions){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(g.positions,3));geometry.setIndex(new T.BufferAttribute(g.indices,1));geometry.computeVertexNormals();return attachRelief(geometry,g);}
 const positions=new Float32Array(g.values.length*3),indices=new Uint32Array(g.nx*g.nz*6);let k=0;
 for(let j=0;j<=g.nz;j++)for(let i=0;i<=g.nx;i++){const n=j*(g.nx+1)+i;positions.set([-g.halfX+i*g.dx,g.values[n],-g.halfZ+j*g.dz],n*3);if(i<g.nx&&j<g.nz){const a=n,b=a+1,c=a+g.nx+1,d=c+1;indices.set([a,c,b,b,c,d],k);k+=6;}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setIndex(new T.BufferAttribute(indices,1));geometry.computeVertexNormals();return attachRelief(geometry,g);
}
export function groundMaterial(view,palette){
 const w=view.world,N=w.holes.length,span=Math.max(...w.holes.map(h=>h.length))+80,extent=new T.Vector2(w.groundGrid.halfX,w.groundGrid.halfZ);
 // WHICH HOLE OWNS EACH PATCH OF GROUND, AND HOW FINELY THAT IS RECORDED.
 //
 // This was a flat 512 square, sampled NEAREST, over a course that is not square
 // -- 1475 by 2180 m on an island. So the texels were 2.88 m across and 4.26 m
 // along, and every boundary between two holes came out as a staircase with the
 // steps half again as long as they were wide. Measured against true ownership,
 // 0.35% of samples got the wrong hole: the band within one texel of a boundary.
 //
 // It is equally coarse in every biome. It is only CONSPICUOUS on an island,
 // where the ground between holes is water, so two holes' turf abuts at a
 // handful of land bridges instead of everywhere, and each one is framed
 // against the sea.
 //
 // Sized from the course now, so texels are square and OWNER_TEXEL across
 // whichever way a boundary runs. The cap is what stops an unusually large
 // course asking for a texture nobody budgeted for; past it the atlas gets
 // coarser rather than the memory unbounded.
 const OWNER_TEXEL=1.75,OWNER_MAX=1<<20;
 let Sx=Math.max(256,Math.ceil(extent.x*2/OWNER_TEXEL)),Sz=Math.max(256,Math.ceil(extent.y*2/OWNER_TEXEL));
 if(Sx*Sz>OWNER_MAX){const k=Math.sqrt(OWNER_MAX/(Sx*Sz));Sx=Math.max(256,Math.round(Sx*k));Sz=Math.max(256,Math.round(Sz*k));}
 const texture=(data,x,y,linear=false)=>{const t=new T.DataTexture(data,x,y,T.RGBAFormat,T.FloatType);t.minFilter=t.magFilter=linear?T.LinearFilter:T.NearestFilter;t.needsUpdate=true;view.resources.push(t);return t;};
 const owners=new Float32Array(Sx*Sz*4),route=new Float32Array(N*12),tees=new Float32Array(N*24),curves=new Float32Array(N*512*4),outer=new Float32Array(N*512*4);
 for(let j=0;j<Sz;j++)for(let i=0;i<Sx;i++){const x=((i+.5)/Sx*2-1)*extent.x,z=((j+.5)/Sz*2-1)*extent.y,k=(j*Sx+i)*4;const lake=w.lakeOwner(x,z,7);owners[k]=(lake||w.nearest(x,z).h).hole;owners[k+1]=w.groundCover(x,z)==='straw'?1:0;owners[k+2]=(w.streams.at(x,z)?.id??-1)+1;owners[k+3]=lake?1:0;}
 for(const h of w.holes){route.set([h.worldTee.x,h.worldTee.z,Math.cos(h.rotation),Math.sin(h.rotation),h.length,h.phase,w.settings.fringe,w.settings.semiRough,h.mowStart??h.fairwayStart,h.greenWave2,h.greenWave3,h.greenWave5],h.hole*12);// Two texels a tee: where and how big, then which way it faces. The fourth
  // slot of the first was already the pad's half-length; the direction needed
  // somewhere of its own.
  Object.values(h.tees).forEach((t,i)=>{const p=teePad(t);
   tees.set(p?[t.x,p.z,1,p.rz,p.ux,p.uz,0,0]:[0,0,0,0,0,0,0,0],h.hole*24+i*8);});for(let j=0;j<512;j++){const z=j/511*span-32;curves.set([h.center(z),fairwayWidth(h,z,0,-1),fairwayWidth(h,z,0,1),h.width(z)],(h.hole*512+j)*4);outer.set([fairwayWidth(h,z,w.settings.semiRough,-1),fairwayWidth(h,z,w.settings.semiRough,1),0,0],(h.hole*512+j)*4);}}
 const streamCount=Math.max(1,w.streams.segments.length),streamData=new Float32Array(streamCount*8);for(const q of w.streams.segments)streamData.set([q.a.x,q.a.z,q.b.x,q.b.z,q.a.width,q.b.width,q.stream+1,q.bank],q.id*8);const streamTexture=texture(streamData,2,streamCount);
 const steps=toonRamp(view);const m=new T.MeshToonMaterial({color:'#ffffff',gradientMap:steps}),colors=Object.fromEntries(Object.entries(palette).map(([k,v])=>['tint_'+k,{value:new T.Color(v)}]));
 // THE CUE SWITCHES, AS UNIFORMS. Held outside onBeforeCompile and handed to
 // the shader by reference, so flipping one is a float write rather than a new
 // program -- a define would recompile every lit material in the scene, which is
 // the same 2.5 second trap the floodlights fell into.
 // GREEN READABILITY, THREE CANDIDATE CUES, LIVE-TUNABLE.
 //
 // A green is the flattest thing on the course by design -- that is what makes
 // it puttable -- and every shading cue here is proportional to slope, so the
 // one surface a player most needs to read is the one with least to read from.
 // Measured: at the default green contour setting a green's shading spans .129
 // of brightness against the .240 ordinary terrain gets.
 //
 //   greenLift    exaggerates the shading NORMAL only, never the geometry. The
 //                ball still rolls on the real surface. This is the cartographic
 //                answer to low-relief ground, where 2x to 5x vertical
 //                exaggeration is standard practice.
 //   greenSlope   adds magnitude shading to the directional cue. The existing
 //                relief is dot(normal, a fixed bearing), so ground tilted
 //                ACROSS that bearing produces no cue at all however steep.
 //   greenGrain   makes the mow stripes view-dependent, which is what they are
 //                in life: turf mown away from you is light, toward you dark.
 //                An undulation then changes a band's tone as it turns.
 const cues={cueRelief:{value:1},cueSlope:{value:1},cueContours:{value:0},cueStripes:{value:1},
  greenLift:{value:0},greenSlope:{value:0},greenGrain:{value:0},
  greenBend:{value:1},greenBandSoft:{value:1}};
 m.userData.cues=cues;
 m.onBeforeCompile=shader=>{
 const bio=biomeOf(w.settings.biome);
  Object.assign(shader.uniforms,colors,cues,{bankTint:{value:new T.Color(bio.bank)},streamSegments:{value:streamTexture},streamCount:{value:streamCount},owners:{value:texture(owners,Sx,Sz)},cover:{value:texture(owners,Sx,Sz,true)},route:{value:texture(route,3,N)},tees:{value:texture(tees,6,N)},curveSpan:{value:span},curves:{value:texture(curves,512,N,true)},outer:{value:texture(outer,512,N,true)},banks:{value:view.bankAtlas},hazards:{value:view.hazardAtlas},cups:{value:view.cupAtlas},extent:{value:extent},rows:{value:N},rock:{value:new T.Color(w.bio.rock)},// NAMED, NOT NUMBERED. This was an index into a four-element array, so a
   // biome not in the list landed on -1 and took whichever branch that turned
   // out to be -- silently, and only visible by looking at the ground.
   speckleRock:{value:bio.speckleRock?1:0},altitudeRock:{value:bio.altitudeRock?1:0},litterAmount:{value:bio.litter?1:0},seaBeach:{value:bio.sea?1:0}});
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundPoint;varying vec3 groundNormal;\nattribute float localRelief;varying float vRelief;').replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPoint=position;groundNormal=normal;vRelief=localRelief;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying float vRelief;uniform float cueRelief,cueSlope,cueContours,cueStripes,greenLift,greenSlope,greenGrain,greenBend,greenBandSoft;
 // The same rounded box course.js uses, so paint and lie cannot disagree
// about where a tee is.
float teeBox(vec2 d,vec2 h,float r){vec2 q=abs(d)-h+r;return length(max(q,vec2(0.)))+min(max(q.x,q.y),0.)-r;}
varying vec3 groundPoint;varying vec3 groundNormal;uniform sampler2D owners,cover,route,curves,outer,hazards,cups,tees,banks;uniform vec2 extent;uniform sampler2D streamSegments;uniform float streamCount;uniform float rows,curveSpan;uniform float speckleRock,altitudeRock,litterAmount,seaBeach;
 uniform vec3 bankTint;
 uniform vec3 tint_rough,tint_semi,tint_fairway,tint_fringe,tint_green,tint_sand,rock;
 float hashGround(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 // Distance to one channel station, with its width, channel index and valley
 // shoulder. Returned as xyzw so the shore bands can size themselves from the
 // same numbers the CPU carve and contact queries use.
 vec4 channelInfo(vec2 p,float row){
  vec4 seg=texture2D(streamSegments,vec2(.25,row));
  vec4 meta=texture2D(streamSegments,vec2(.75,row));
  vec2 ab=seg.zw-seg.xy;
  float t=clamp(dot(p-seg.xy,ab)/max(dot(ab,ab),1e-4),0.,1.);
  float w=mix(meta.x,meta.y,t);
  return vec4(distance(p,seg.xy+ab*t)-w*.5,w,meta.z,meta.w);
 }
 // Polynomial smooth min/max. Hard min/max of two distance fields creases where
 // the arguments cross, which is what put a straight wedge in the bank exactly
 // where a corridor's side meets its end.
 // WHAT nearest IN course.js MEASURES: how far outside a hole's own corridor
 // this point lies, with the greenside allowance ramped in past the green.
 //
 // cv.w is h.width -- max(leftWidth,rightWidth), the RAW corridor half width.
 // NOT cv.y/cv.z, which are fairwayWidth and carry the end caps and the green
 // blend; measuring against those would answer a different question from the one
 // the atlas was built with, and the resolve would fight the data it is fixing.
 float holeDistance(float hole,vec2 wp){
  float r=(floor(hole+.5)+.5)/rows;
  vec4 tr=texture2D(route,vec2(1./6.,r)),nfo=texture2D(route,vec2(.5,r));
  vec2 d=wp-tr.xy;
  vec2 q=vec2(d.x*tr.z-d.y*tr.w,d.x*tr.w+d.y*tr.z);
  float len=nfo.x,zz=clamp(q.y,0.,len);
  vec4 cv=texture2D(curves,vec2(((zz+32.)/curveSpan*511.+.5)/512.,r));
  float corridor=cv.w+nfo.w,greenEnd=25.+nfo.z+nfo.w;
  // smooth in course.js is smoothstep with the same clamp.
  float ramp=smoothstep(len,len+${GREEN_RAMP.toFixed(1)},q.y);
  return length(vec2(q.x-cv.x,q.y-zz))-(corridor+max(0.,greenEnd-corridor)*ramp);
 }
 float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
 float smax(float a,float b,float k){return -smin(-a,-b,k);}
 // Band stops for a shoreline, in metres out from the water edge. The whole
 // profile shrinks by one factor on mown turf, so it keeps its shape instead of
 // re-proportioning as it narrows, and the taper runs over a distance
 // proportional to the body: a river starts narrowing its bank roughly 70 m
 // before it reaches a fairway rather than snapping narrow at the edge.
 vec3 shoreBands(float scale,float mownEdge,float cap){
  // A CUT EDGE, NOT A BEACH. These were metres wide -- a wet margin over three
  // metres and damp earth past nine -- which is the painted half of the saucer
  // the terrain used to be. The ground drops over WATER_LIP now, so the soil is
  // a lip at the waterline and turf runs down the bank to meet it, exactly the
  // way sand sits in a bunker with turf over its rim.
  float mown=1.-smoothstep(-(8.+scale),25.+scale*4.,mownEdge);
  float k=mix(1.,.32,mown);
  float wet=(.35+scale*.05)*k,damp=wet+(.7+scale*.09)*k;
  return vec3(wet,damp,min(damp+max(.4,(.8+scale*.1)*k),max(damp+.4,cap)));
 }
 // One shoreline for every water body, still or flowing: a saturated margin,
 // damp earth, then a fade into whatever ground surrounds it.
 vec3 shoreTint(vec3 base,float edge,float scale,vec3 b){
  if(edge>=b.z)return base;
  vec3 soil=bankTint*vec3(.82,.70,.54),wetSoil=soil*.62;
  vec3 shore=mix(soil,base,smoothstep(b.y,b.z,edge));
  shore=mix(wetSoil,shore,smoothstep(0.,b.x,edge));
  if(edge<0.){float deep=clamp(-edge/max(scale*.55,.6),0.,1.);shore=mix(wetSoil,soil*.4,deep*deep*(3.-2.*deep));}
  return shore;
 }
 `).replace('#include <color_fragment>',`#include <color_fragment>
 vec2 wp=groundPoint.xz;vec2 ownerUv=(wp/extent+1.)*.5;vec4 owner=texture2D(owners,ownerUv);
 // OWNERSHIP, RESOLVED WHERE IT MATTERS.
 //
 // The atlas is a grid of hole indices sampled NEAREST, so a boundary between
 // two holes is a staircase of whole texels -- 1.75 m now, 2.88 by 4.26 m before
 // it was sized from the course. Resolution only ever halves that; it cannot
 // remove it, because the boundary is a curve and the atlas is a grid.
 //
 // A fragment away from a boundary has nothing to resolve, and that is nearly
 // all of them, so fwidth gates the work: it is non-zero only on a quad the
 // boundary actually crosses, which is exactly where the steps can be seen.
 // Inside the gate the four neighbouring texels give the candidates, and the
 // true owner is whichever this fragment is really nearest to.
 if(fwidth(owner.r)>.0001){
  vec2 texel=1./vec2(textureSize(owners,0));
  vec4 na=texture2D(owners,ownerUv+vec2(texel.x,0.)),nb=texture2D(owners,ownerUv-vec2(texel.x,0.));
  vec4 nc=texture2D(owners,ownerUv+vec2(0.,texel.y)),nd=texture2D(owners,ownerUv-vec2(0.,texel.y));
  // A lake owns its ground outright, overriding nearest-hole. No analytic
  // resolve can know that, so if any candidate came from a lake, leave the
  // atlas alone rather than handing the ground back to the nearest hole.
  if(owner.a+na.a+nb.a+nc.a+nd.a<.5){
   float best=holeDistance(owner.r,wp),bestHole=owner.r;
   for(int i=0;i<4;i++){
    float cand=i==0?na.r:i==1?nb.r:i==2?nc.r:nd.r;
    float dd=holeDistance(cand,wp);
    if(dd<best){best=dd;bestHole=cand;}
   }
   owner.r=bestHole;
  }
 }
 float row=(floor(owner.r+.5)+.5)/rows;
 vec4 tr=texture2D(route,vec2(1./6.,row)),info=texture2D(route,vec2(.5,row));vec2 d=wp-tr.xy;vec2 p=vec2(d.x*tr.z-d.y*tr.w,d.x*tr.w+d.y*tr.z);
 vec4 curve=texture2D(curves,vec2(((p.y+32.)/curveSpan*511.+.5)/512.,row));vec4 cupInfo=texture2D(cups,vec2(.25,row));vec2 cup=cupInfo.xy;vec2 pin=texture2D(cups,vec2(.75,row)).xy;vec4 outline=texture2D(route,vec2(5./6.,row));
 vec2 gd=vec2((p.x-cup.x)/cupInfo.w,p.y-cup.y);float angle=atan(gd.y,gd.x);float greenD=length(gd)-cupInfo.z*(1.+outline.y*sin(angle*2.+info.y)+outline.z*sin(angle*3.+info.y)+outline.w*cos(angle*5.));
 float width=p.x<curve.x?curve.y:curve.z;float fw=abs(p.x-curve.x)-width;float margin=info.w;
 float mowStart=texture2D(route,vec2(5./6.,row)).x;float start=mowStart-margin,end=info.x+8.+margin;
 vec2 outerCurve=texture2D(outer,vec2(((p.y+32.)/curveSpan*511.+.5)/512.,row)).xy;float outerWidth=p.x<curve.x?outerCurve.x:outerCurve.y;
 float kind=0.;vec3 turf=tint_rough;float stripeFade=1.;
 if(altitudeRock>.5){turf=mix(turf,rock,smoothstep(50.,160.,groundPoint.y)*.65);turf=mix(turf,vec3(.84,.9,.94),smoothstep(550.,750.,groundPoint.y));}
 if(speckleRock>.5)turf=mix(turf,rock,.18+.1*sin(wp.x*.015)*sin(wp.y*.02));
 float litter=texture2D(cover,(wp/extent+1.)*.5).g;float litterEdge=smoothstep(.2,.65,litter+.10*sin(wp.x*1.7)*sin(wp.y*1.3));if(litterEdge>.01&&litterAmount>.5){turf=mix(turf,vec3(.36,.22,.105),.83*litterEdge);float needle=step(.94,fract(p.x*17.+p.y*11.+sin(p.y*4.)));turf*=1.+needle*.14;}
 // The rough colour, after biome and litter shading, before any playing surface
 // overwrites it. Channels rebuild a softened classification starting here.
 vec3 roughTint=turf;
 if((p.y>start&&p.y<end&&abs(p.x-curve.x)<outerWidth)||greenD<info.z+info.w){turf=tint_semi;kind=1.;}
 if(p.y>mowStart&&p.y<info.x+8.&&fw<0.){turf=tint_fairway;kind=2.;}
 if(greenD<info.z){turf=tint_fringe;kind=3.;}if(greenD<=0.){turf=tint_green;kind=4.;}

 // The pad and its mown collar, sized from TEE_PAD/TEE_APRON in course.js so
 // this paints exactly what localSurface classifies. The collar only claims
 // ground that is still rough, so a fairway or green beside a tee keeps it.
 float teeGround=0.;
 for(int ti=0;ti<3;ti++){vec4 tee=texture2D(tees,vec2((float(ti)*2.+.5)/6.,row));
  vec4 teeDir=texture2D(tees,vec2((float(ti)*2.+1.5)/6.,row));
  // Into the pad's own frame: across the line of play, then along it.
  vec2 td=p-tee.xy,tf=vec2(td.x*teeDir.y-td.y*teeDir.x,td.x*teeDir.x+td.y*teeDir.y);
  if(tee.z>.5&&kind<.5&&teeBox(tf,vec2(${TEE_APRON.x.toFixed(2)},tee.w*${TEE_APRON_SCALE.toFixed(4)}),${(TEE_ROUND*TEE_APRON_SCALE).toFixed(3)})<0.){turf=tint_semi;kind=1.;teeGround=1.;}
  if(tee.z>.5&&teeBox(tf,vec2(${TEE_PAD.x.toFixed(2)},tee.w),${TEE_ROUND.toFixed(2)})<0.){turf=tint_semi;kind=1.;teeGround=1.;}}
 // THE BEACH, AND IT CLAIMS ROUGH ONLY -- AFTER THE TEES, NOT BEFORE.
 //
 // Ordering is the whole of it. Run before the tee block, the beach turned low
 // rough to sand, and the apron -- which only claims ground that is STILL rough
 // -- then refused to paint, so every low-lying tee on a coastal course lost its
 // mown collar. The lie kept it, because localSurface settles the apron before
 // the beach rule is ever consulted, so the two disagreed.
 //
 // Letting it take mown turf as well seemed right -- a fairway running to the
 // sea ought to have sand between -- and in practice turned 19.4% of the island
 // corridor into beach across 24 of 27 holes, because the foreshore lowers a lot
 // of coastal ground below the sand line. A hole is mown where it is mown; the
 // beach starts where the maintained turf stops.
 //
 // Replaces an island-only sand TINT that never changed the kind, so the shore
 // looked sandy and played as rough.
 //
 // The kind flips at BEACH_RISE while the colour keeps fading for BEACH_FADE
 // above it. Flipping on the colour's midpoint instead would put the lie and
 // the paint half a fade apart, which is the split this file keeps falling into.
 if(seaBeach>.5&&kind<.5){
  turf=mix(turf,tint_sand,1.-smoothstep(${BEACH_RISE.toFixed(2)},${(BEACH_RISE+BEACH_FADE).toFixed(2)},groundPoint.y));
  if(groundPoint.y<${BEACH_RISE.toFixed(2)})kind=5.;
 }
 // Signed distances to the mown boundary and to the fairway. mownEdge is exact
 // and drives the softened classification; mownTaper rounds the corner where a
 // corridor's side meets its end and drives the bank's width taper.
 float alongCut=max(start-p.y,p.y-end),lateralCut=abs(p.x-curve.x)-outerWidth,greenRing=greenD-info.z-info.w;
 float mownEdge=min(max(lateralCut,alongCut),greenRing);
 float mownTaper=smin(smax(lateralCut,alongCut,12.),greenRing,12.);
 float fairD=max(fw,max(mowStart-p.y,p.y-(info.x+8.)));
 for(int i=0;i<12;i++){vec4 hz=texture2D(hazards,vec2((float(i)*2.+.5)/24.,row));vec4 meta=texture2D(hazards,vec2((float(i)*2.+1.5)/24.,row));if(hz.z>0.){vec2 q=(p-hz.xy)/hz.zw;if(meta.y>.5){vec2 bank=texture2D(banks,vec2((clamp(q.y*.5+.5,0.,1.)*511.+.5)/512.,(floor(owner.r+.5)*4.+meta.y-.5)/(rows*4.))).xy;q.x=(p.x-bank.x)/bank.y;}float edge=1.+meta.z*sin(atan(q.y,q.x)*2.+meta.x)+meta.w*sin(atan(q.y,q.x)*3.+meta.x);if(meta.y>.5)edge=1.;float hd=(length(q)-edge)*length(p-hz.xy)/max(length(q),.0001);
 // Ponds and lakes take the same shoreline as a channel instead of a sand bed
 // and sand collar. Their band is capped tighter than a channel's because the
 // owner atlas stops carrying this hole's hazards a short way outside them.
 // A FAIRWAY IS NOT MOWN TO A WATERLINE. The corridor is cut from the hole's
 // own geometry and knows nothing about a pond sitting in it, so the mown band
 // ran straight to the shore and, across a crossing, straight under the water
 // and out the other side. The semi-rough comes round the shore instead and the
 // fairway stops behind it. The margin uniform is the hole's own semi-rough
 // width, the same number course.js uses, so the painted edge and the lie the
 // ball gets agree -- what goes wrong every time these two are set apart.
 if(meta.y>.5){float ps=min(min(hz.z,hz.w),10.);vec3 pb=shoreBands(ps,mownTaper,16.);
  // OUTSIDE the shore band, not under it. Measured from the water edge the band
  // was mostly hidden beneath the wet and damp soil painted over it, so only
  // whatever was left of it showed -- which reads as the semi-rough butting
  // against the water itself. pb.z is where the soil finishes fading, so this
  // puts the whole of the hole's semi-rough width where it can be seen.
  if(kind==2.&&hd>0.&&smax(fairD,pb.z+margin-hd,${BAND_ROUND.toFixed(1)})>=0.){turf=tint_semi;kind=1.;}
  turf=shoreTint(turf,hd,ps,pb);if(hd<pb.y)kind=6.;}
 else if(hd<0.){turf=tint_sand;kind=5.;}
 else if(hd<.35){turf=mix(turf,tint_sand,.20);}}}
 if(owner.b>.5){
  float sid=owner.b-1.;vec4 ch=channelInfo(wp,(sid+.5)/streamCount);
  // One segment is stored per owner texel, so a fragment beside a station join
  // can land on the wrong one. Test both neighbours of the same channel and keep
  // the nearest; that removes the stepped seams the single lookup produced.
  for(int k=0;k<2;k++){
   float other=sid+(k==0?-1.:1.);
   if(other<0.||other>streamCount-1.)continue;
   vec4 q=channelInfo(wp,(other+.5)/streamCount);
   if(abs(q.z-ch.z)<.5&&q.x<ch.x)ch=q;
  }
  // The band fades out well inside the valley shoulder, so the owner atlas
  // never clips a visible edge.
  float edge=ch.x,chw=max(ch.y,.6);
  vec3 b=shoreBands(chw,mownTaper,max(ch.w,8.)*.8);
  // Same rule as a pond: the semi-rough comes round to the bank and the mown
  // corridor stops behind it, rather than the fairway running into the channel.
  if(kind==2.&&edge>0.&&smax(fairD,b.z+margin-edge,${BAND_ROUND.toFixed(1)})>=0.){turf=tint_semi;kind=1.;}
  // Creeks and rivers are the one exception to the crisp turf boundary rule: a
  // hard fairway edge running through a soft bank reads as a drawn line. Rebuild
  // the classification with blended boundaries and fade it in toward the water,
  // so the rest of the course keeps its crisp edges. This is colour only —
  // surface queries, contact and scoring still switch at the true boundary.
  // Never over a tee. The rebuild below is corridor geometry only and would
  // repaint a tee beside a creek as whatever the corridor says it is.
  float soften=(1.-smoothstep(0.,b.z,edge))*(1.-teeGround);
  if(soften>.002){
   vec3 soft=roughTint;
   soft=mix(soft,tint_semi,1.-smoothstep(-2.5,2.5,mownEdge));
   // Pushed out by the collar so the softened rebuild agrees with the hard
   // classification above; without this the blend paints fairway back over the
   // band it just made semi.
   soft=mix(soft,tint_fairway,1.-smoothstep(-2.5,2.5,smax(fairD,b.z+margin-edge,${BAND_ROUND.toFixed(1)})));
   soft=mix(soft,tint_fringe,1.-smoothstep(-2.5,2.5,greenD-info.z));
   soft=mix(soft,tint_green,1.-smoothstep(-2.5,2.5,greenD));
   turf=mix(turf,soft,soften);
   // Mowing stripes ending on a crisp line would reinstate the edge the blend
   // just removed, so they fade out over the same distance.
   stripeFade=1.-soften;
  }
  turf=shoreTint(turf,edge,chw,b);
  if(edge<b.y)kind=6.;
 }
 // LOCAL RELIEF, BAKED. Crowns lift and hollows darken at a fifteen metre radius
 // -- the size of the thing a golfer is trying to read. It replaces a
 // screen-space crease term built from the rate of change of the normal, which
 // was the same idea done badly: swamped by bunker lips and green edges, and a
 // function of how close the camera was, so one roll shaded differently from the
 // tee and from underfoot.
 //
 // On the green as well as off it. Unlike the crease term this is smooth at the
 // scale of a whole roll rather than noisy at the scale of a triangle, so it
 // adds shape to a putting surface instead of grain -- at half strength, because
 // the green already carries a much stronger raking light of its own.
 if(kind!=6.){turf*=1.+clamp(vRelief,-1.,1.)*(kind==4.?.07:.15)*cueRelief;}
 // COARSE CONTOURS: a topographic line every metre of height, across the whole
 // course. Deliberately artificial and off by default -- this is a map drawn on
 // the grass, not a lighting effect -- but it is the most legible thing here by
 // a distance, because it turns a slope into a spacing you can count.
 //
 // Drawn from the distance to the nearest band edge, measured in BANDS rather
 // than metres, so the line keeps its weight on a gentle slope and on a steep
 // one alike. fwidth() gives the band width in pixels, which is what makes the
 // lines fade out instead of aliasing into noise where the ground is steep or
 // far away -- the same anti-aliasing the mowing stripes use.
 if(cueContours>.001&&kind!=6.){
  float band=groundPoint.y/1.0;
  float w=max(fwidth(band),1e-4);
  float edge=abs(fract(band)-.5)*2.;
  // A line in the middle of the transition, softened by exactly one pixel.
  float line=1.-smoothstep(1.-w*3.,1.,edge);
  // Past the point where bands are a pixel apart there is nothing to draw but
  // moire, so it fades out rather than stacking up.
  line*=1.-smoothstep(.25,.7,w);
  turf*=1.-line*.22*cueContours;
 }
 // The CUP, not the green's centre. cupInfo.xy above is the GREEN and drives
 // the boundary; using it here punched the hole through the middle of every
 // green instead of at the pin.
 if(distance(p,pin)<${CUP_RADIUS.toFixed(6)})discard;
 // MOWING STRIPES THAT FOLLOW THE GROUND.
 //
 // These have always been here, and they were computed entirely in the PLAN --
 // a function of x and z only -- so they ran dead straight over a roll and told
 // you nothing about it. On real turf a stripe is grass bent one way or the
 // other, and the mower follows the ground, so two things happen over a rise
 // that did not happen here: the bands BEND, and their light-dark contrast
 // changes with the slope, because the angle the grass makes with your eye
 // changes with the ground it is growing on.
 //
 // Both are cheap. The bend is a height term in the stripe coordinate, which
 // costs nothing and is continuous everywhere, unlike a true arc length. The
 // contrast comes from the component of the surface normal along the mowing
 // direction -- rotated into hole-local space, because that is the space the
 // stripes are laid out in.
 if(kind==2.||kind==4.){
  float period=kind==4.?3.2:12.;
  vec2 mow=normalize(vec2(.48,.88));
  float bend=kind==4.?.9:1.6;
  // THE ANTI-ALIAS FADE IS MEASURED ON THE PLAN COORDINATE, NOT THE BENT ONE.
  //
  // That fade exists to kill moire where stripes compress on screen with
  // distance: past the point where a band is a pixel wide there is nothing to
  // draw but noise, so it mixes to neutral. Measuring it on the BENT coordinate
  // fed the height term straight into it, and the height term changes fastest
  // exactly where the ground is steep or seen at a grazing angle -- so the
  // stripes faded out on slopes and in the foreground, which is precisely where
  // they were added to be useful. Reported from a screenshot, where a near
  // sloping green had no bands on it at all.
  float plan=(p.y*mow.y+p.x*mow.x)/period;
  // BANDS THAT FOLLOW THE SURFACE READ AS CONTOUR LINES. Straight bands over a
  // rolling green say nothing about it; bands that bend with the ground trace
  // its shape the way a contour map does. Greens only -- a fairway is not
  // being read for a putt and its bands are already long enough to wander.
  float bendMul=kind==4.?greenBend:1.;
  float coord=plan+groundPoint.y*bend*bendMul/period;
  float aa=max(fwidth(plan),.001);
  float stripe=smoothstep(-aa*6.283,aa*6.283,sin(coord*6.283));
  stripe=mix(stripe,.5,smoothstep(.12,.45,aa));
  vec3 gs=normalize(groundNormal);if(gs.y<0.)gs=-gs;
  vec2 gl=vec2(gs.x*tr.z-gs.z*tr.w,gs.x*tr.w+gs.z*tr.z);
  float along=dot(gl,mow);
  // Contrast widens on ground falling away along the mow line and narrows on
  // ground rising into it, which is what makes a roll show up in the bands.
  //
  // It must never reach zero. The first version was additive and crossed zero
  // at about eleven degrees against the mow line, so a whole class of slope had
  // NO stripe contrast at all -- a second, independent way of making them
  // disappear on exactly the ground they are meant to describe. Scaling instead
  // of adding keeps the bands present and still lets the slope modulate them.
  float spread=clamp(.115*(1.+along*2.),.06,.20);
  // VIEW-DEPENDENT GRAIN. In life a band is light because the blades are laid
  // away from you and dark because they are laid toward you -- so a band's tone
  // changes as the ground under it turns relative to where you stand, which is
  // the cue that makes a photographed green read as shaped. Fixed bands cannot
  // do that: they carry the same tone whatever the surface beneath them does.
  if(kind==4.&&greenGrain>.001){
   // groundPoint is object space and cameraPosition is world space. They are
   // the same thing HERE because the course group and the terrain mesh both
   // carry an identity transform -- checked, not assumed. Put a transform on
   // either and this line silently starts lying.
   // (No backticks in this comment: it lives inside a GLSL template literal,
   // and a backtick here ends the string and breaks the whole module.)
   vec3 toEye=normalize(cameraPosition-groundPoint);
   vec2 lay=vec2(mow.x*tr.z-mow.y*tr.w,mow.x*tr.w+mow.y*tr.z);
   float facing=dot(normalize(toEye.xz),lay)*(stripe*2.-1.);
   spread=clamp(spread*(1.+greenGrain*1.6*facing),.04,.30);
  }
  // Softening the bands RAISES how well the shape reads, because a strong
  // regular pattern is what the eye locks onto first. Measured: halving the
  // band contrast lifted shape contrast from .262 to .309.
  if(kind==4.)spread*=greenBandSoft;
  float tone=clamp(.965+(stripe*2.-1.)*spread,.72,1.24);
  turf*=mix(1.,tone,stripeFade*cueStripes);
 }
 // UNDULATION, EVERYWHERE, AT EVERY HOUR.
 //
 // A cast shadow only reads when the sun is low. At midday a two metre roll
 // throws nothing, and the ground goes back to looking like a painted plane --
 // which is the whole problem with relying on shadows to show shape.
 //
 // Two cues that do not care where the sun is. Both come off the surface normal,
 // which the vertex shader already hands over, so neither costs a texture read.
 // WATER IS NOT TURF. It has its own shading, a reflection and a normal map of
 // its own, and a raking light laid over the top of that reads as dirt.
 if(kind!=6.){
  vec3 gn=normalize(groundNormal);if(gn.y<0.)gn=-gn;
  // DIRECTIONAL RELIEF. Ground tilted toward a fixed low bearing lifts, ground
  // tilted away darkens -- a raking light that is not the sun, so it still reads
  // at midday when a two metre roll casts no shadow at all.
  float relief=dot(gn.xz,normalize(vec2(-.6,-.5)));
  if(kind==4.){
   // Exaggerating the NORMAL rather than raising the gain is the difference that
   // matters. Gain multiplies the response and clips against the clamp, so the
   // steep parts of a green saturate while the gentle parts stay invisible.
   // Tilting the normal further from vertical first rescales the whole range, so
   // a two-centimetre roll and a tier both move within the band.
   vec3 gl4=normalize(vec3(gn.x*(1.+greenLift),gn.y,gn.z*(1.+greenLift)));
   float rel4=dot(gl4.xz,normalize(vec2(-.6,-.5)));
   turf*=mix(1.,clamp(1.+rel4*4.,.78,1.18),cueRelief);
   // MAGNITUDE, NOT ONLY DIRECTION. A fall running across the light bearing is
   // invisible to the dot product above no matter how steep it is; this darkens
   // by how much the ground tilts, whichever way it faces, so no slope on a
   // green can hide by pointing the wrong way.
   float tilt=length(gl4.xz);
   turf*=mix(1.,clamp(1.-tilt*1.9,.80,1.),greenSlope);
  }else{
   // Everything else: the same idea at a third of the gain. A green is being
   // read for a putt; a fairway only has to look like ground.
   turf*=mix(1.,clamp(1.+relief*2.6,.88,1.12),cueRelief);
  }
  // SLOPE DRIES OUT, AND THAT IS A COLOUR, NOT A BRIGHTNESS.
  //
  // Every other cue on this surface works in value -- the raking light, the
  // baked relief, the stripes, the sun itself -- so they all compete for the
  // same channel and a fairway ends up either washed out or muddy. Hue is free,
  // and it happens to be true: a slope sheds water and burns off first, a hollow
  // holds it and stays lush. Greenkeepers water the tops of slopes for exactly
  // this reason.
  //
  // It also reinforces the relief rather than fighting it. The hollows the baked
  // relief darkens are the ones that stay green; the crowns it lifts are the
  // ones that go dry. Two different channels saying the same thing about the
  // same ground.
  //
  // Measured as the TANGENT of the slope rather than one minus the normal's y,
  // which is nearly flat for the first fifteen degrees and says almost nothing
  // over the range a fairway actually occupies.
  if(kind!=5.){
   float slope=length(gn.xz)/max(gn.y,1e-3);
   // TUNED TO THE SLOPES A GOLF COURSE ACTUALLY HAS, which are far gentler than
   // the first guess assumed. Measured over a generated hole, as the tangent:
   //
   //   fairway  median .057 (3.3 deg)  p90 .151 (8.6)  p99 .167 (9.5)
   //   semi     median .065 (3.7)      p90 .150 (8.5)
   //   rough    median .132 (7.5)      p90 .282 (15.7) p99 .561 (29.3)
   //   green    median .011 (0.6)      -- graded flat, and stays untinted
   //
   // The first version ran from .12 to .55 and so touched 0.0% of fairway and
   // 0.1% of semi-rough: the whole effect was happening in the rough, where it
   // is least useful, and nowhere a player looks.
   //
   // MOWN GROUND AND ROUGH GET THEIR OWN RANGE. Mown ground is graded and rough
   // is not, so one curve either does nothing on a fairway or saturates the
   // rough into a single flat tone. Two curves put both in their own middle.
   float dry=smoothstep(kind==0.?.07:.015,kind==0.?.30:.10,slope);
   // Relative to whatever the biome's turf already is, so a links course goes
   // further into its own fescue and a desert course into its own sandstone
   // rather than everything converging on one straw colour.
   // STRENGTH, MEASURED RATHER THAN GUESSED. The first version moved a fairway
   // pixel by a mean of 1.8 of 255 in blue -- 0.7%, invisible, and reported as
   // such. This moves it by 15 to 20, about ten times as far, which is where a
   // hue shift starts to read against a toon ramp.
   //
   // Blue carries it. Grass drying loses blue first and gains a little red; the
   // green channel barely moves, which is why holding it at 1.0 keeps the turf
   // recognisably turf instead of turning it brown. Checked across biomes at
   // full dryness: pnw fairway 83,134,55 goes to 96,134,28 and links rough
   // 168,157,101 to 195,157,51, which is fescue rather than damage.
   const vec3 parched=vec3(1.16,1.,.50);
   // Irrigation, in effect. A green is watered to within an inch of its life and
   // a fairway most of the way; rough gets whatever falls on it.
   // Irrigation, in effect. A green is watered to within an inch of its life and
   // a fringe most of the way; fairway and rough take what falls on them. The
   // fairway used to be held at .55 as well, which halved an effect that was
   // already too small to see.
   float dryGain=kind==4.?.25:kind==3.?.5:1.;
   turf=mix(turf,turf*parched,dry*dryGain*cueSlope);
  }
 }
 float grain=hashGround(floor(wp*30.));float grainFade=1.-smoothstep(.02,.12,length(fwidth(wp)));
 turf*=1.+(grain-.5)*.075*grainFade;
 if(kind==5.){float rake=sin((p.x*.8+p.y*.4+sin(p.y*.15)) * 38.);turf*=1.+rake*.025*grainFade;}
 diffuseColor.rgb=turf;
 `);
 };m.customProgramCacheKey=()=> 'continuous-cartoon-ground-v21';return m;
}
