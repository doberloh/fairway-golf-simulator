import {ownerAtlasSize,ownerRows,strawChannel} from './owner-atlas.js';
import {BANK_COLORS} from './streams.js';
import {toonRamp} from './textures.js';
import * as T from 'three';
import {fairwayWidth,teePad,TEE_PAD,TEE_APRON,TEE_APRON_SCALE,TEE_ROUND,BEACH_RISE,BEACH_FADE,GREEN_RAMP,BAND_ROUND} from './course.js';
import {CUP_RADIUS} from './physics.js';
import {biomeOf} from './biomes.js';
import {occlusionAtlas} from './occlusion.js';
import {BLOWOUT_NEAR,BLOWOUT_RAMP,BLOWOUT_WATER} from './blowouts.js';
import {WILD_WATER} from './landforms.js';
import {TURF_DETAIL} from './turf-detail.js';

// The turf detail atlas (tools/turf-detail.mjs) as a texture: tiling, mip-
// mapped and sharp at a glancing angle. Data, not colour, so no sRGB step.
// Image is a browser API; under Node (the tests build scenes too) a flat grey
// texel stands in, which multiplies everything by exactly 1.
function turfDetailTexture(view) {
 let t;
 if (typeof Image === 'undefined') {
  t = new T.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1);
 } else {
  const image = new Image();
  t = new T.Texture(image);
  image.onload = () => { t.needsUpdate = true; };
  image.src = TURF_DETAIL;
  t.anisotropy = 8;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
 }
 t.wrapS = t.wrapT = T.RepeatWrapping;
 t.colorSpace = T.NoColorSpace;
 t.needsUpdate = typeof Image === 'undefined';
 view.resources.push(t);
 return t;
}

// THE OVERHAUL'S GROUND TYPES, as the shader knows them (grounds.js,
// landforms.js). A number per type, because a uniform cannot hold a name;
// `groundPaint` in the shader below draws each.
export const GROUND_CODE = {rock: 1, coral: 2, scree: 3, hardpan: 4, waste: 5, pinestraw: 6, litter: 7, heather: 8, native: 9};
// The colours each type paints with, before its pattern: from the biome's own
// palette where it has one (its rock, its sand, its rough), otherwise these.
// A biome can override any of them (`groundTints` in biomes.js). PLACED.
const GROUND_TINT = {coral: '#e6dcc2', pinestraw: '#8b5e34', litter: '#b4692f', heather: '#7a5b78', native: '#b3a35a'};
function groundTints(bio) {
 const c = v => new T.Color(v), t = {...GROUND_TINT, ...(bio.groundTints || {})};
 return {
  rock: c(t.rock ?? bio.rock), coral: c(t.coral), scree: c(t.scree ?? bio.rock).lerp(c('#ffffff'), t.scree ? 0 : .14),
  hardpan: c(t.hardpan ?? bio.rough).lerp(c('#efd9a8'), t.hardpan ? 0 : .22), waste: c(t.waste ?? bio.sand),
  pinestraw: c(t.pinestraw), litter: c(t.litter), heather: c(t.heather), native: c(t.native),
 };
}
// The uniforms for one course: which type each channel holds, where its gate
// starts and how far it ramps (landforms.js wildGate), and the colours.
function wildUniforms(w, hasWild, hasFallen) {
 const r = w.landform || {kinds: {}, gates: {}}, kinds = r.kinds || {}, gates = r.gates || {};
 const code = k => GROUND_CODE[k] || 0, gate = g => new T.Vector2(g?.near ?? 0, g?.ramp ?? 1);
 const tints = groundTints(biomeOf(w.settings.biome));
 return {
  wildOn: {value: hasWild ? 1 : 0}, fallenOn: {value: hasFallen ? 1 : 0},
  wildKinds: {value: new T.Vector4(code(kinds.a), code(kinds.b), code(kinds.floor), code(w.bio.fallen?.kind))},
  wildGateA: {value: gate(gates.a)}, wildGateB: {value: gate(gates.b)}, wildGateF: {value: gate(gates.floor)},
  ...Object.fromEntries(Object.entries(tints).map(([k, v]) => ['gt_' + k, {value: v}])),
 };
}

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
// THE PER-HOLE TABLE. One row a hole, one RGBA float texel a column, read with
// nearest filtering -- four tables that used to be four textures: the route
// (where the hole is and how it is mown, 3 texels), the tees (two texels each
// for three tees), the cup (the green's centre and shape, then the pin) and up
// to twelve hazards (two texels each). Packed because a texture is a sampler
// in every fragment the ground draws, and WebGL guarantees sixteen: the ground
// used fifteen on High, so a floodlight could not cast a shadow without the
// program failing to link and the ground vanishing. Built by the renderer
// (makeHazardAtlas, which writes the cups and hazards) before the ground,
// which writes the route and the tees.
// THE RANGE'S OTHER GREENS (16 October 2026) ride after the hazards: three
// texels each -- centre and size, outline, cup -- for up to RANGE_GREENS of
// them, counted in the third channel of the pin texel (cups + 1). Every course
// hole writes zero there and the shader's loop ends before its first read. See
// range.js greenTexels.
export const RANGE_GREENS = 8;
export const HOLE_ATLAS = {route: 0, tees: 3, cups: 9, hazards: 11, greens: 35, width: 35 + 3 * RANGE_GREENS};
// The painted forest on the far hills (biomes.js `farForest`; the shader says
// how it is drawn). Off where a biome has none.
export function farForestUniforms(bio){
 const f=bio.farForest,c=f?.colors??['#000000','#000000','#000000'];
 return {farOn:{value:f?1:0},farCover:{value:f?.cover??0},farLine:{value:f?.line??1e5},farSize:{value:f?.size??11},
  farC0:{value:new T.Color(c[0])},farC1:{value:new T.Color(c[1])},farC2:{value:new T.Color(c[2])},
  // A fourth colour where the record names one (Autumn's evergreens); else
  // the first, in shade.
  farC3:{value:c[3]?new T.Color(c[3]):new T.Color(c[0]).multiplyScalar(.75)}};
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
 // (Size and questions are in owner-atlas.js, shared with the workers.)
 const {Sx,Sz}=ownerAtlasSize(extent.x,extent.y);
 const texture=(data,x,y,linear=false)=>{const t=new T.DataTexture(data,x,y,T.RGBAFormat,T.FloatType);t.minFilter=t.magFilter=linear?T.LinearFilter:T.NearestFilter;t.needsUpdate=true;view.resources.push(t);return t;};
 const owners=new Float32Array(Sx*Sz*4),holeData=view.holeAtlas.image.data,HW=HOLE_ATLAS.width,curves=new Float32Array(N*1024*4);
 // The expensive channels arrive precomputed when the generation workers
 // built them (gen-pool.js); otherwise they are asked here, the same way.
 const pre=w.ownerAtlas;
 if(pre&&pre.Sx===Sx&&pre.Sz===Sz)owners.set(pre.data);
 else owners.set(ownerRows({lakeOwner:w.lakeOwner,nearest:w.nearest,streamAt:(x,z)=>w.streams.at(x,z)},extent.x,extent.y,Sx,Sz,0,Sz));
 strawChannel(owners,w.groundCover,extent.x,extent.y,Sx,Sz);
 for(const h of w.holes){holeData.set([h.worldTee.x,h.worldTee.z,Math.cos(h.rotation),Math.sin(h.rotation),h.length,h.phase,w.settings.fringe,w.settings.semiRough,h.mowStart??h.fairwayStart,h.greenWave2,h.greenWave3,h.greenWave5],(h.hole*HW+HOLE_ATLAS.route)*4);// Two texels a tee: where and how big, then which way it faces. The fourth
  // slot of the first was already the pad's half-length; the direction needed
  // somewhere of its own.
  Object.values(h.tees).forEach((t,i)=>{const p=teePad(t);
   holeData.set(p?[t.x,p.z,1,p.rz,p.ux,p.uz,0,0]:[0,0,0,0,0,0,0,0],(h.hole*HW+HOLE_ATLAS.tees)*4+i*8);});for(let j=0;j<512;j++){const z=j/511*span-32;curves.set([h.center(z),fairwayWidth(h,z,0,-1),fairwayWidth(h,z,0,1),h.width(z)],(h.hole*1024+j)*4);curves.set([fairwayWidth(h,z,w.settings.semiRough,-1),fairwayWidth(h,z,w.settings.semiRough,1),0,0],(h.hole*1024+512+j)*4);}}
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
 //   greenBend    how far the mow bands bend to follow the surface, so they
 //                trace its shape the way contour lines do.
 //   greenBandSoft band contrast. Softening them RAISES how well the shape
 //                reads, because a strong regular pattern is the first thing
 //                the eye locks onto -- measured, .262 to .309.
 //
 // TWO OTHER CUES WERE BUILT HERE AND REMOVED; do not rebuild them without
 // reading why. Slope-magnitude shading, to catch ground tilted across the
 // light bearing where the dot product is blind, was rejected by its own
 // measurement: that case occurs on 0% of real greens. View-dependent bands,
 // which is what a mow stripe genuinely is in life, measured no better than
 // bending the bands and cost a per-fragment view vector. Both are written up
 // with their numbers in RESEARCH.md.
 const cues={cueRelief:{value:1},cueSlope:{value:1},cueContours:{value:0},cueStripes:{value:1},cuePatches:{value:.6},cueShade:{value:.6},cueSheen:{value:1},
  greenLift:{value:0},greenBend:{value:1},greenBandSoft:{value:1},
  sunDir:{value:new T.Vector3(-.6,.7,-.5).normalize()}};
 m.userData.cues=cues;
 // THE COVER TEXTURE: soft occlusion under trees and round boulders in red
 // (U1; occlusion.js, which says why it is not a texture of its own) and the
 // straw in green, linearly filtered. Bytes, not floats: a quarter of the
 // memory the float copy of the ownership atlas it replaced took.
 const occ=occlusionAtlas(w,extent.x,extent.y,Sx,Sz),coverBytes=new Uint8Array(Sx*Sz*4);
 // Kept for the forest floor (U6, vegetation.js), which grows where the canopy is.
 view.groundOcclusion={occ,Sx,Sz,ex:extent.x,ez:extent.y};
 for(let k=0;k<Sx*Sz;k++){coverBytes[k*4]=Math.round(occ[k]*255);coverBytes[k*4+1]=Math.round(owners[k*4+1]*255);}
 // Green: fallen needles or leaves (course.js `fallenField`), the bytes the
 // lie reads -- strawChannel above computes the same 0/1 at the same centres,
 // and the baked field is copied over it so the two cannot drift.
 const fallen=w.fallenField&&w.fallenField.Sx===Sx&&w.fallenField.Sz===Sz?w.fallenField.g:null;
 if(fallen)for(let k=0;k<Sx*Sz;k++)coverBytes[k*4+1]=fallen[k];
 // Blue: Lakeshore Dunes' blowout field, the very bytes course.js plays
 // (blowouts.js), on the same grid -- it was baked from this atlas's size.
 const blow=w.blowouts&&w.blowouts.Sx===Sx&&w.blowouts.Sz===Sz?w.blowouts.data:null;
 if(blow)for(let k=0;k<Sx*Sz;k++)coverBytes[k*4+2]=blow[k];
 // THE OVERHAUL'S GROUND TYPES (landforms.js): channel a in alpha, b in blue
 // where the blowouts do not hold it (a biome with blowouts states no b).
 const wild=w.wild&&w.wild.Sx===Sx&&w.wild.Sz===Sz?w.wild:null;
 if(wild)for(let k=0;k<Sx*Sz;k++){coverBytes[k*4+3]=wild.a[k];if(!blow)coverBytes[k*4+2]=wild.b[k];}
 const coverTex=new T.DataTexture(coverBytes,Sx,Sz,T.RGBAFormat,T.UnsignedByteType);
 coverTex.minFilter=coverTex.magFilter=T.LinearFilter;coverTex.needsUpdate=true;view.resources.push(coverTex);
 const detailTex=turfDetailTexture(view);
 m.onBeforeCompile=shader=>{
 const bio=biomeOf(w.settings.biome);
  Object.assign(shader.uniforms,colors,cues,{bankTint:{value:new T.Color(bio.bank)},streamSegments:{value:streamTexture},streamCount:{value:streamCount},owners:{value:texture(owners,Sx,Sz)},cover:{value:coverTex},detail:{value:detailTex},holes:{value:view.holeAtlas},curveSpan:{value:span},curves:{value:texture(curves,1024,N,true)},banks:{value:view.bankAtlas},extent:{value:extent},rows:{value:N},rock:{value:new T.Color(w.bio.rock)},// NAMED, NOT NUMBERED. This was an index into a four-element array, so a
   // biome not in the list landed on -1 and took whichever branch that turned
   // out to be -- silently, and only visible by looking at the ground.
   speckleRock:{value:bio.speckleRock?1:0},altitudeRock:{value:bio.altitudeRock?1:0},litterAmount:{value:bio.litter?1:0},seaBeach:{value:bio.sea?1:0},blowoutOn:{value:blow?1:0},
   // The overhaul's ground types: which type each channel holds (GROUND_CODE),
   // the gate each starts at, and the colours they paint with.
   ...wildUniforms(w,!!wild,!!fallen),...farForestUniforms(bio)});
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundPoint;varying vec3 groundNormal;\nattribute float localRelief;varying float vRelief;').replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPoint=position;groundNormal=normal;vRelief=localRelief;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying float vRelief;uniform float cueRelief,cueSlope,cueContours,cueStripes,cuePatches,cueShade,cueSheen,greenLift,greenBend,greenBandSoft;
 uniform vec3 sunDir;
 uniform float farOn,farCover,farLine,farSize;uniform vec3 farC0,farC1,farC2,farC3;
 // The same rounded box course.js uses, so paint and lie cannot disagree
// about where a tee is.
float teeBox(vec2 d,vec2 h,float r){vec2 q=abs(d)-h+r;return length(max(q,vec2(0.)))+min(max(q.x,q.y),0.)-r;}
varying vec3 groundPoint;varying vec3 groundNormal;uniform sampler2D owners,cover,holes,curves,banks,detail;
// THE ROUTE CURVES AND THE SEMI-ROUGH EDGES SHARE ONE TEXTURE (the cartoon
// overhaul): curves in texels 0-511 of a hole's row, the semi-rough's two
// widths in 512-1023. They were two textures of the same grid, and the
// second used two channels; packed, they free the texture unit the turf
// detail atlas takes, so the ground still fits in 16 with one spare
// (tests/flood-shadows.test.mjs). The index is clamped to its own half, or
// the linear filter would blend the last curve texel into the first edge.
// (curveAt and outerAt follow the curveSpan uniform below.)
// A texel of the per-hole table (HOLE_ATLAS): column, then the hole's row.
vec4 holeTexel(float col,float row){return texture2D(holes,vec2((col+.5)/${HOLE_ATLAS.width}.,row));}uniform vec2 extent;uniform sampler2D streamSegments;uniform float streamCount;uniform float rows,curveSpan;uniform float speckleRock,altitudeRock,litterAmount,seaBeach,blowoutOn;
vec4 curveAt(float z,float row){return texture2D(curves,vec2((clamp((z+32.)/curveSpan*511.,0.,511.)+.5)/1024.,row));}
vec2 outerAt(float z,float row){return texture2D(curves,vec2((clamp((z+32.)/curveSpan*511.,0.,511.)+512.5)/1024.,row)).xy;}
 uniform vec3 bankTint;
 uniform vec3 tint_rough,tint_semi,tint_fairway,tint_fringe,tint_green,tint_sand,rock;
 // The overhaul's ground types (GROUND_CODE above; landforms.js).
 uniform float wildOn,fallenOn;uniform vec4 wildKinds;uniform vec2 wildGateA,wildGateB,wildGateF;
 uniform vec3 gt_rock,gt_coral,gt_scree,gt_hardpan,gt_waste,gt_pinestraw,gt_litter,gt_heather,gt_native;
 /* Hash without Sine, (c)2014 David Hoskins, MIT: THIRD_PARTY_NOTICES.txt */float hashGround(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
 float patchNoise(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hashGround(i),hashGround(i+vec2(1.,0.)),f.x),mix(hashGround(i+vec2(0.,1.)),hashGround(i+vec2(1.,1.)),f.x),f.y);}
 // THE OVERHAUL'S GROUND TYPES, PAINTED (GROUND_CODE in this file): a colour
 // and a flat cartoon pattern in world metres for each. q is the world
 // position, y the height, n the surface normal, rough the colour beneath.
 vec3 groundPaint(float code,vec2 q,float y,vec3 n,vec3 rough){
  float steep=1.-smoothstep(.55,.9,n.y);
  if(code<1.5){
   // Rock: broad irregular planes and a few wandering strata across the
   // faces, the tops greening toward the rough round them. Round 2: the
   // first had 3.4 m square facets and a stratum every 2.2 m, which tiled
   // like brickwork; these are warped, three times larger, half as often.
   vec2 w=q/9.+vec2(patchNoise(q/23.),patchNoise(q/19.+7.))*1.4;
   float facet=hashGround(floor(w)),soft=patchNoise(q/5.);
   vec3 c=gt_rock*(.84+.18*facet+.08*soft);
   // Strata as broad alternating bands of tone, not lines (round 3: thin
   // lines every few metres read as contour lines drawn on the cliff).
   float ys=y/6.5+.7*patchNoise(q/17.),strata=smoothstep(.35,.65,abs(fract(ys)-.5)*2.);
   c*=mix(1.,.88+.12*strata,steep);
   c=mix(c,rough,(1.-steep)*.3);
   return c*(1.-.12*steep);
  }
  if(code<2.5){float pit=step(.8,hashGround(floor(q/.55)));return gt_coral*(.9+.12*hashGround(floor(q/2.1)))*(1.-.28*pit);}
  if(code<3.5){
   // Scree: a litter of stones, darker and browner than the rock it fell
   // from (round 2: lightened, it read as white gravel ribbons).
   float s=hashGround(floor(q/.42));
   return mix(gt_scree,rough,.22)*(.8+.28*s)*(.94+.1*patchNoise(q/6.));
  }
  if(code<4.5){
   // Hardpan: baked earth, cracked into plates that show only faintly
   // (round 2: a strong regular crack net read as a wireframe).
   vec2 g=q/2.4+vec2(patchNoise(q/9.),patchNoise(q/11.+3.))*1.2;vec2 f=abs(fract(g)-.5);
   float crack=smoothstep(.46,.5,max(f.x,f.y));
   return gt_hardpan*(.93+.1*patchNoise(q/7.))*(1.-.06*crack);
  }
  if(code<5.5){float r=sin((q.x*.8+q.y*.35)*2.4+patchNoise(q/5.)*4.);return gt_waste*(.95+.05*r);}
  if(code<6.5){
   // Pine straw, half the rough's own colour so it reads as the floor under
   // the trees rather than a dirt ring round each (round 2).
   float needle=step(.9,fract(q.x*5.3+q.y*3.1+sin(q.y*1.7)));
   return mix(gt_pinestraw,rough,.4)*(.88+.14*patchNoise(q/2.3))*(1.+needle*.12);
  }
  if(code<7.5){
   // Leaves: copper, red and gold, in drifts.
   float h=hashGround(floor(q/.38));
   vec3 c=h<.33?gt_litter:h<.66?gt_litter*vec3(1.12,.78,.62):gt_litter*vec3(1.18,1.08,.6);
   return c*(.84+.2*patchNoise(q/3.1));
  }
  if(code<8.5){
   // Heather: muted, a third the rough's own colour, in soft clumps (round 3:
   // saturated purple in 1.6 m blocks read as a pixelated decal).
   // Round 4: round 3's flat mauve read as mud from above. A heath is a mat
   // of dark woody cushions, olive-brown with the light on their tops, and
   // flecked with bloom -- purple where the heather is (its tint's blue over
   // its green), none on a dead moor.
   // Round 5: round 4's olive-brown still averaged to dirt from afar, the
   // flecks too fine to count; the mat now carries the heather's own hue at
   // two-thirds, the cushions' light and shade make the texture, and the
   // bloom is denser.
   float clump=patchNoise(q/2.6)*.65+patchNoise(q/.8)*.35,cushion=smoothstep(.25,.85,clump);
   float blooms=clamp((gt_heather.b-gt_heather.g)*6.,0.,1.);
   // Round 6: still a burnt patch at .55; a heath in bloom is its colour, so
   // the hue at three-quarters where it blooms, and a dead moor stays dark.
   vec3 mat=mix(vec3(.1,.11,.05),mix(gt_heather,rough,.15),.5+.28*blooms)*(.66+.56*cushion);
   float bloom=step(.7,hashGround(floor(q/.3)))*cushion*blooms;
   return mix(mat,gt_heather*1.35,bloom*.8);
  }
  // Native grass: streaky tussocks.
  float streak=hashGround(floor(vec2(q.x/.28,q.y/1.1)));
  return gt_native*(.82+.3*streak)*(.9+.15*patchNoise(q/4.));
 }
 // The colour's soft edge either side of the 0.5 the lie switches at (round
 // 2: .42-.58 left hard-edged blobs of heather on the links).
 float wildSoft(float f){return smoothstep(.34,.66,f);}
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
  vec4 tr=holeTexel(0.,r),nfo=holeTexel(1.,r);
  vec2 d=wp-tr.xy;
  vec2 q=vec2(d.x*tr.z-d.y*tr.w,d.x*tr.w+d.y*tr.z);
  float len=nfo.x,zz=clamp(q.y,0.,len);
  vec4 cv=curveAt(zz,r);
  float corridor=cv.w+nfo.w,greenEnd=25.+nfo.z+nfo.w;
  // smooth in course.js is smoothstep with the same clamp.
  float ramp=smoothstep(len,len+${GREEN_RAMP.toFixed(1)},q.y);
  return length(vec2(q.x-cv.x,q.y-zz))-(corridor+max(0.,greenEnd-corridor)*ramp);
 }
 /* Polynomial smooth minimum: Inigo Quilez (iquilezles.org/articles/smin), as published in glsl-smooth-min, (c)2014 stackgl contributors, MIT: THIRD_PARTY_NOTICES.txt */float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
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
 vec4 tr=holeTexel(0.,row),info=holeTexel(1.,row);vec2 d=wp-tr.xy;vec2 p=vec2(d.x*tr.z-d.y*tr.w,d.x*tr.w+d.y*tr.z);
 vec4 curve=curveAt(p.y,row);vec4 cupInfo=holeTexel(9.,row);vec2 cup=cupInfo.xy;vec2 pin=holeTexel(10.,row).xy;vec4 outline=holeTexel(2.,row);
 vec2 gd=vec2((p.x-cup.x)/cupInfo.w,p.y-cup.y);float angle=atan(gd.y,gd.x);float greenD=length(gd)-cupInfo.z*(1.+outline.y*sin(angle*2.+info.y)+outline.z*sin(angle*3.+info.y)+outline.w*cos(angle*5.));
 // The range's other greens (HOLE_ATLAS.greens): nearest edge wins, the same
 // rule as greenDistance on the CPU, and the nearest cup is the one cut.
 vec2 cupAt=pin;float extraGreens=holeTexel(10.,row).z;
 for(int gi=0;gi<${RANGE_GREENS};gi++){if(float(gi)>=extraGreens)break;float c0=${HOLE_ATLAS.greens}.+float(gi)*3.;vec4 ga=holeTexel(c0,row),gb=holeTexel(c0+1.,row);vec2 gc=holeTexel(c0+2.,row).xy;vec2 gq=vec2((p.x-ga.x)/ga.w,p.y-ga.y);float gang=atan(gq.y,gq.x);greenD=min(greenD,length(gq)-ga.z*(1.+gb.x*sin(gang*2.+gb.w)+gb.y*sin(gang*3.+gb.w)+gb.z*cos(gang*5.)));if(distance(p,gc)<distance(p,cupAt))cupAt=gc;}
 float width=p.x<curve.x?curve.y:curve.z;float fw=abs(p.x-curve.x)-width;float margin=info.w;
 float mowStart=holeTexel(2.,row).x;float start=mowStart-margin,end=info.x+8.+margin;
 vec2 outerCurve=outerAt(p.y,row);float outerWidth=p.x<curve.x?outerCurve.x:outerCurve.y;
 float kind=0.;vec3 turf=tint_rough;float stripeFade=1.;float wildTop=0.;
 if(altitudeRock>.5){turf=mix(turf,rock,smoothstep(50.,160.,groundPoint.y)*.65);turf=mix(turf,vec3(.84,.9,.94),smoothstep(550.,750.,groundPoint.y));}
 if(speckleRock>.5)turf=mix(turf,rock,.18+.1*sin(wp.x*.015)*sin(wp.y*.02));
 // Pine straw used to be painted here, over the rough, as a look only. Since
 // the cartoon overhaul it is a played ground (pinestraw or leaves), painted
 // with the other ground types below from the same bytes the lie reads.
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
 for(int ti=0;ti<3;ti++){vec4 tee=holeTexel(3.+float(ti)*2.,row);
  vec4 teeDir=holeTexel(4.+float(ti)*2.,row);
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
 // How near water this fragment is, for the blowouts below: the hole's ponds
 // and lakes (the hazard loop) and its creek (the channel block).
 float waterNear=1e4,streamNear=1e4;
 // Signed distances to the mown boundary and to the fairway. mownEdge is exact
 // and drives the softened classification; mownTaper rounds the corner where a
 // corridor's side meets its end and drives the bank's width taper.
 float alongCut=max(start-p.y,p.y-end),lateralCut=abs(p.x-curve.x)-outerWidth,greenRing=greenD-info.z-info.w;
 float mownEdge=min(max(lateralCut,alongCut),greenRing);
 float mownTaper=smin(smax(lateralCut,alongCut,12.),greenRing,12.);
 float fairD=max(fw,max(mowStart-p.y,p.y-(info.x+8.)));
 for(int i=0;i<12;i++){vec4 hz=holeTexel(11.+float(i)*2.,row);vec4 meta=holeTexel(12.+float(i)*2.,row);if(hz.z>0.){vec2 q=(p-hz.xy)/hz.zw;if(meta.y>.5){vec2 bank=texture2D(banks,vec2((clamp(q.y*.5+.5,0.,1.)*511.+.5)/512.,(floor(owner.r+.5)*4.+meta.y-.5)/(rows*4.))).xy;q.x=(p.x-bank.x)/bank.y;}float edge=1.+meta.z*sin(atan(q.y,q.x)*2.+meta.x)+meta.w*sin(atan(q.y,q.x)*3.+meta.x);if(meta.y>.5)edge=1.;float hd=(length(q)-edge)*length(p-hz.xy)/max(length(q),.0001);
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
 if(meta.y>.5){waterNear=min(waterNear,hd);float ps=min(min(hz.z,hz.w),10.);vec3 pb=shoreBands(ps,mownTaper,16.);
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
  // As far as the channel's own valley reaches, which is how far course.js's
  // streams.at sees it: a creek counts within BLOWOUT_WATER or its valley,
  // whichever is shorter, in both places.
  if(edge<min(${BLOWOUT_WATER.toFixed(1)},ch.w))streamNear=edge;
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
 // BLOWOUTS (Lakeshore Dunes): open sand torn into the dune rough. LAST of the
 // classification, so only ground still rough here can take it -- the beach,
 // bunkers, ponds and every shore and creek band have already claimed theirs.
 // course.js asks the same questions: rough, clear of water by BLOWOUT_WATER,
 // then the field. The field is the cover texture's blue channel, the very
 // bytes the lie reads, gated by the distance outside the corridor exactly as
 // blowoutGate does it, sand at 0.5. The colour fades over a short band; the
 // kind flips at 0.5 only. Inside the atlas only: the distant landscape rings
 // wear this material too, and past the atlas's edge a clamped texture
 // stretches its last texels outward into long white streaks.
 if(blowoutOn>.5&&kind<.5&&waterNear>=${BLOWOUT_WATER.toFixed(1)}&&streamNear>=${BLOWOUT_WATER.toFixed(1)}&&abs(wp.x)<extent.x&&abs(wp.y)<extent.y){
  float blowField=texture2D(cover,(wp/extent+1.)*.5).b*smoothstep(${BLOWOUT_NEAR.toFixed(1)},${(BLOWOUT_NEAR+BLOWOUT_RAMP).toFixed(1)},holeDistance(owner.r,wp));
  turf=mix(turf,tint_sand,smoothstep(.44,.56,blowField));
  if(blowField>=.5)kind=5.;
 }
 // THE OVERHAUL'S GROUND TYPES (landforms.js): last of the classification, as
 // the blowouts are and for the same reasons. course.js surface() asks the
 // same questions in the same order -- rough, clear of water by WILD_WATER,
 // then channel a, channel b, the floor, and fallen needles or leaves, each at
 // 0.5 of its gated field -- so they are painted bottom-up here, the highest
 // priority last. The colour fades across 0.42-0.58; the lie switches at 0.5.
 // kind stays the rough's for everything after this.
 if((wildOn>.5||fallenOn>.5)&&kind<.5&&waterNear>=${WILD_WATER.toFixed(1)}&&streamNear>=${WILD_WATER.toFixed(1)}&&abs(wp.x)<extent.x&&abs(wp.y)<extent.y){
  vec4 cv=texture2D(cover,(wp/extent+1.)*.5);
  float hd=holeDistance(owner.r,wp);
  vec3 gn=normalize(groundNormal),c=turf;
  float ff=fallenOn>.5&&wildKinds.w>.5?cv.g:0.;
  float fz=wildOn>.5&&wildKinds.z>.5?smoothstep(wildGateF.x,wildGateF.x+wildGateF.y,hd):0.;
  float fy=wildOn>.5&&wildKinds.y>.5?cv.b*smoothstep(wildGateB.x,wildGateB.x+wildGateB.y,hd):0.;
  float fx=wildOn>.5&&wildKinds.x>.5?cv.a*smoothstep(wildGateA.x,wildGateA.x+wildGateA.y,hd):0.;
  if(ff>0.)c=mix(c,groundPaint(wildKinds.w,wp,groundPoint.y,gn,turf),wildSoft(ff));
  if(fz>0.)c=mix(c,groundPaint(wildKinds.z,wp,groundPoint.y,gn,turf),wildSoft(fz));
  if(fy>0.)c=mix(c,groundPaint(wildKinds.y,wp,groundPoint.y,gn,turf),wildSoft(fy));
  if(fx>0.)c=mix(c,groundPaint(wildKinds.x,wp,groundPoint.y,gn,turf),wildSoft(fx));
  turf=c;
  // Which ground the lie says this is, for the detail atlas below.
  wildTop=fx>=.5?wildKinds.x:fy>=.5?wildKinds.y:fz>=.5?wildKinds.z:ff>=.5?wildKinds.w:0.;
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
  // A line every metre -- and every 5 cm on a green and its fringe (the
  // ground-readability rounds, 26 October 2026): a green falls less than a
  // metre end to end, so at a metre it showed one line or none (10 cm, the
  // first try, gave lines 3 m apart on a 3% green; 5 cm gives 1.7 m).
  float band=groundPoint.y/(kind>=3.&&kind<=4.?.05:1.);
  float w=max(fwidth(band),1e-4);
  float edge=abs(fract(band)-.5)*2.;
  // A line in the middle of the transition, softened by exactly one pixel.
  float line=1.-smoothstep(1.-w*3.,1.,edge);
  // Past the point where bands are a pixel apart there is nothing to draw but
  // moire, so it fades out rather than stacking up.
  line*=1.-smoothstep(.25,.7,w);
  turf*=1.-line*(kind>=3.&&kind<=4.?.3:.22)*cueContours;
 }
 // The CUP, not the green's centre. cupInfo.xy above is the GREEN and drives
 // the boundary; using it here punched the hole through the middle of every
 // green instead of at the pin.
 if(distance(p,cupAt)<${CUP_RADIUS.toFixed(6)})discard;
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
  // SOFTENING THE BANDS RAISES HOW WELL THE SHAPE READS -- measured, .262 to
  // .309 -- because a strong regular pattern is the first thing the eye locks
  // onto and it competes with the shading underneath. This line was deleted by
  // accident once, when removing a neighbouring block took the span between two
  // anchors with it, and the slider went on reporting a value nothing read.
  if(kind==4.)spread*=greenBandSoft;
  float tone=clamp(.965+(stripe*2.-1.)*spread,.72,1.24);
  turf*=mix(1.,tone,stripeFade*cueStripes);
  // THE CLEAN-UP LAP. A green is cut in straight passes and then once round
  // its edge, one mower's width (a greens mower cuts about 0.55-0.65 m), laid
  // the other way from the passes it crosses -- so a band of different tone
  // runs round every green, right out to the collar. It traces the outline, and
  // because it follows the ground it shows the green's edge rising and falling.
  // Part of the mowing pattern, so it goes with the stripes switch.
  //
  // It runs from 0.65 m inside the edge TO the edge. The first cut drew it from
  // 0.95 to 0.4 m in, which left a strip of plain green between the lap and
  // the fringe that no mower would leave (the owner).
  if(kind==4.){
   float lapW=max(fwidth(greenD),1e-4);
   float lap=smoothstep(-.65-lapW,-.65+lapW,greenD);
   turf*=mix(1.,1.-.06*(stripe*2.-1.)-.03,lap*stripeFade*cueStripes*(1.-smoothstep(.25,.6,lapW)));
  }
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
  // DIRECTIONAL RELIEF, FROM THE SUN'S SIDE. Ground tilted toward the sun's
  // compass bearing lifts and ground tilted away darkens -- a raking light at a
  // fixed low angle, so it still reads at midday when a two metre roll casts no
  // shadow, but from the SAME SIDE the real shadows fall from. It used a fixed
  // bearing, (-.6, -.5), whatever the hour, so for much of the day it lit every
  // slope from a direction the sun was not in: a second light source arguing
  // with the cast shadows, plainest on bare dunes where no mowing pattern hides
  // it. With the sun near overhead the bearing is barely defined, so it eases
  // back to the old fixed one rather than swinging.
  vec2 fromSun=sunDir.xz,oldBearing=normalize(vec2(-.6,-.5));
  vec2 bearing=normalize(mix(oldBearing,normalize(fromSun+vec2(1e-5)),smoothstep(.05,.25,length(fromSun))));
  float relief=dot(gn.xz,bearing);
  // A green's shading normal, tilted further from vertical than the real one.
  // Shading only: the ball rolls on the true surface. A green is graded to
  // about half a degree, so without this nothing about its shape reaches the
  // picture; tilting the normal rescales the whole range rather than clipping
  // the steep parts, which is why it beats simply raising a gain.
  vec3 gs4=kind==4.?normalize(vec3(gn.x*(1.+greenLift),gn.y,gn.z*(1.+greenLift))):gn;
  if(kind==4.){
   // The tone greens had while "slope darkening" was on: at the owner's 70 it
   // dimmed a typical green by about 8%, fairly evenly, and removing it left
   // greens visibly paler than the fringe around them had been set against. The
   // tone is kept; the blotches that came with it are not.
   turf*=.93;
   // EASED OFF AS THE SUN GOES DOWN. This raking light exists for midday, when
   // the real sun shows a green nothing. With the sun low the real light and the
   // terrain's own shadows already show every roll -- and this, on top of them,
   // with a normal tilted to 3x, lit each face of a green as a bright band and
   // left the shelves either side dark: the owner's "tiered" greens at a sharp
   // sun angle. Full strength above about 33 degrees of sun, a third of it
   // below about 9, and a narrower range than before (0.86-1.12, was 0.78-1.18).
   float rake=mix(.35,1.,smoothstep(.15,.55,sunDir.y));
   turf*=mix(1.,clamp(1.+dot(gs4.xz,bearing)*3.*rake,.86,1.12),cueRelief);
  }else{
   // Everything else: the same idea at a lower gain. A green is being read for
   // a putt; a fairway only has to look like ground.
   turf*=mix(1.,clamp(1.+relief*2.6,.88,1.12),cueRelief);
  }
  // GRASS SHEEN: HOW A REAL GREEN SHOWS ITS SHAPE. Mown grass looked at from a
  // low angle is lighter than grass looked down on -- you see the length of the
  // blades rather than the soil between them -- and from a player's eye a
  // green is seen at a low angle: about 10 degrees above the surface from 10 m
  // away. At that angle a tilt of one or two degrees changes how steeply you
  // look at the turf by a large FRACTION, so ground tipped away from you reads
  // lighter and ground tipped toward you darker, at any hour, with the sun
  // anywhere. It is the reason a real green shows its slopes at noon.
  //
  // Only the difference from flat ground is applied, so level turf is exactly
  // the colour it was and nothing brightens toward the horizon; what shows is
  // the SHAPE.
  //
  // STRONG ON FAIRWAYS, GENTLE ON GREENS -- both the owner's calls, from the
  // first build. On tees and fairways (gain 1, up to 28% either way) the owner
  // liked it and asked to keep it. On the green it ran at 4.5x with the
  // exaggerated shading normal and looked like a graphical bug: because it
  // depends on where you stand, whole regions of the green changed tone as the
  // camera moved. The green now takes about a quarter of that and the fringe
  // less, clamped to 10% either way: a hint of which way the green tips, not a
  // light show.
  if(cueSheen>.001&&kind>=1.&&kind<=4.){
   vec3 toEye=normalize(cameraPosition-groundPoint);
   float onTurf=1.-clamp(dot(gs4,toEye),0.,1.),onFlat=1.-clamp(toEye.y,0.,1.);
   float sheen=pow(onTurf,4.)-pow(onFlat,4.);
   bool putting=kind>=3.;
   // The putting surface's cap opens with the green definition above its
   // default (the ground-readability rounds): 10% either way at 50, about 18%
   // at 85, where a player has asked to see the green's shape plainly.
   float span=.1+.08*smoothstep(2.3,3.9,greenLift);
   turf*=clamp(1.+sheen*(kind==4.?1.2:putting?.5:1.)*cueSheen,putting?1.-span:.72,putting?1.+span:1.3);
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
   // DRYING TAKES OUT BLUE: (1.16, 1.00, 0.50), which on green grass reads as
   // turf burning off. But ONLY AS FAR AS THE TURF IS GREEN. Applied to turf
   // that is already straw -- desert scrub, links fescue, a sandy bank -- the
   // same step pushed it toward orange (desert rough at full dryness went to
   // 215, 153, 52), and the banks and dunes of those courses came out banded in
   // saturated gold, which is what looked wrong there. Grass that is already
   // dry has nowhere left to go. How green a colour is -- its green channel over
   // its red and blue, relative to its brightness -- is how much it has to lose:
   // a fairway all of it, a Pacific Northwest rough about half, links and
   // desert rough none.
   //
   // Rejected on the way: mixing toward a straw colour at the turf's own
   // brightness instead. It fixed the desert and washed a sloping fairway out
   // to a pale grey smear, and turned hillside rough khaki. Irrigated turf on a
   // bank should yellow a little, not bleach.
   float lum=dot(turf,vec3(.3,.59,.11));
   float green=clamp((turf.g-max(turf.r,turf.b))/max(lum,1e-3)*2.5,0.,1.);
   const vec3 parched=vec3(1.16,1.,.50);
   // Irrigation, in effect. A green is watered to within an inch of its life and
   // a fringe most of the way; fairway and rough take what falls on them.
   float dryGain=kind==4.?.25:kind==3.?.5:1.;
   turf=mix(turf,turf*parched,dry*dryGain*green*cueSlope);
  }
 }
 // PATCHES (U3 in TODO). A real course is never one colour: the rough runs in
 // drifts of lighter, darker, drier and lusher grass, a fairway shows worn and
 // well-watered patches, a bunker has damp and dry sand. From world position,
 // so the patches stay put as the camera moves, sized and scaled per surface --
 // broad and plain in the rough, small and faint on a green, where anything
 // stronger would compete with the shading a player reads the break from.
 // cuePatches is the Graphics panel's "Turf colour variation", 0..1; the
 // figures below are its full strength.
 if(cuePatches>0.&&kind!=6.){
  bool mownTee=teeGround>.5&&kind==1.;
  float s=kind==4.?5.:kind==3.?8.:(kind==2.||mownTee)?13.:kind==1.?18.:kind==5.?9.:30.;
  float n1=patchNoise(wp/s+vec2(17.3,-4.1)),n2=patchNoise(wp/s*2.7+vec2(-8.2,21.7)),n3=patchNoise(wp/(s*3.1)+vec2(3.3,9.9));
  float tone=(n1*.62+n2*.38)-.5;
  float amp=kind==4.?.045:kind==3.?.08:(kind==2.||mownTee)?.13:kind==1.?.14:kind==5.?.11:.18;
  // Held back where a patch is under ~25 pixels across: smaller than that it
  // stops reading as ground and starts reading as camouflage (the overview,
  // from a kilometre up), and smaller still it shimmers.
  float keep=1.-smoothstep(.04,.14,length(fwidth(wp))/s);
  turf*=1.+tone*2.*amp*cuePatches*keep;
  if(kind<3.5){
   // Drier drifts shed blue and gain a little red, the way the slope tint's
   // parched turf does; lusher ones go a touch deeper green. Greens are left
   // their colour: tone only.
   float dryAmt=kind==0.?.5:kind==1.?.38:kind==2.?.32:kind==3.?.18:0.;
   turf=mix(turf,turf*vec3(1.1,1.02,.76),smoothstep(.55,.85,n3)*dryAmt*cuePatches);
   turf=mix(turf,turf*vec3(.9,1.04,.94),smoothstep(.58,.88,1.-n3)*dryAmt*.8*cuePatches);
  }
  if(kind==5.)turf=mix(turf,turf*vec3(.86,.84,.8),smoothstep(.55,.85,n3)*.8*cuePatches);
 }
 // SOFT OCCLUSION (U1 in TODO): darker at the foot of every trunk and boulder
 // and under overlapping crowns, baked in occlusion.js. Only inside the course's
 // own ground -- the landscape past the edge shares this material and has no
 // texels. A little less blue taken out than red and green, so it reads as
 // shade under leaves rather than as dirt. cueShade is the Graphics panel's
 // "Shade under trees and rocks", 0..1.
 if(cueShade>0.){
  vec2 ou=(wp/extent+1.)*.5;
  if(ou.x>0.&&ou.x<1.&&ou.y>0.&&ou.y<1.){
   float occ=texture2D(cover,ou).r*cueShade*(kind==4.?.5:1.);
   turf*=1.-occ*vec3(.95,.9,.78);
  }
 }
 // THE TURF DETAIL ATLAS (the cartoon overhaul; tools/turf-detail.mjs): the
 // hand-made texture of each surface, one channel each -- R grass strokes for
 // rough and the grassy grounds, G a mown nap for fairway, fringe, tee and
 // green, B grain for sand and hardpan, A plates and cracks for rock -- read
 // at a size of its own in world metres and multiplied in around 1, so the
 // palette is untouched. The rough reads it twice at two sizes and turned, so
 // the tile does not show. Replaces a per-pixel hash ("grain") that read as
 // noise. grainFade still holds it back where a texel is too small to see.
 float grainFade=1.-smoothstep(.02,.12,length(fwidth(wp)));
 {
  bool stone=wildTop>.5&&(wildTop<3.5);
  bool gritty=kind==5.||wildTop==4.||wildTop==5.;
  bool mown=kind>1.5&&kind<4.5||(teeGround>.5&&kind==1.);
  float scale=stone?6.5:gritty?1.6:mown?(kind==4.?1.3:1.8):kind==1.?2.2:2.8;
  float amp=stone?.34:gritty?.24:mown?(kind==4.?.1:.16):kind==1.?.2:.3;
  vec4 d1=texture2D(detail,wp/scale);
  float v=stone?d1.a:gritty?d1.b:mown?d1.g:d1.r;
  if(!stone&&!gritty&&!mown){vec2 q=mat2(.8,-.6,.6,.8)*wp/(scale*2.7);v=mix(v,texture2D(detail,q).r,.4);}
  float far=1.-smoothstep(.05,.5,length(fwidth(wp))/scale);
  turf*=1.+(v-.5)*2.*amp*(.35+.65*far)*(kind==6.?0.:1.);
 }
 if(kind==5.){float rake=sin((p.x*.8+p.y*.4+sin(p.y*.15)) * 38.);turf*=1.+rake*.025*grainFade;}
 // THE FOREST ON THE FAR HILLS (the cartoon overhaul; biomes.js farForest).
 // Past the course's own ground the landscape rings were bare hills; the
 // stands (stands.js) end at the property line. Here, painted, not planted: a
 // canopy of crown-sized lumps, each lit from the sun's side and darker in the
 // gaps, in the landscape's own leaf colours, fading in over the first 70 m
 // past the edge where the last real stand trees hide the seam. Patchy by a
 // broad noise (cover), and on Mountain held below a treeline. Far off,
 // where a lump is under a pixel, it settles to its average colour rather
 // than shimmering. PLACED: every number (RESEARCH, *The overhaul's far forest*).
 if(farOn>.5){
  vec2 qd=abs(wp)-extent;float outside=length(max(qd,0.));
  if(outside>0.){
   float patchN=fract(sin(dot(floor(wp/380.),vec2(12.9898,78.233)))*43758.5453);
   vec2 pf=fract(wp/380.);pf=pf*pf*(3.-2.*pf);
   float n00=patchN,n10=fract(sin(dot(floor(wp/380.)+vec2(1.,0.),vec2(12.9898,78.233)))*43758.5453);
   float n01=fract(sin(dot(floor(wp/380.)+vec2(0.,1.),vec2(12.9898,78.233)))*43758.5453),n11=fract(sin(dot(floor(wp/380.)+vec2(1.,1.),vec2(12.9898,78.233)))*43758.5453);
   float broad=mix(mix(n00,n10,pf.x),mix(n01,n11,pf.x),pf.y);
   float mask=smoothstep(0.,70.,outside)*smoothstep(1.-farCover-.12,1.-farCover+.12,broad)*(1.-smoothstep(farLine-60.,farLine+40.,groundPoint.y));
   // No forest on a cliff: the pattern is laid from above and stretches into
   // scales on steep ground, and real woods stop at the rock anyway.
   mask*=smoothstep(.5,.74,normalize(groundNormal).y);
   // Lumps: the nearest of a jittered grid of crowns, farSize metres apart.
   vec2 g=wp/farSize,gi=floor(g);float best=9.;vec2 toC=vec2(0.);float pick=0.;
   for(int a=-1;a<=1;a++)for(int b=-1;b<=1;b++){vec2 c=gi+vec2(float(a),float(b));vec2 h=fract(sin(vec2(dot(c,vec2(127.1,311.7)),dot(c,vec2(269.5,183.3))))*43758.5453);vec2 v=c+.15+.7*h-g;float dd=dot(v,v);if(dd<best){best=dd;toC=v;pick=h.x;}}
   float r=sqrt(best)/.62;float lump=clamp(1.-r*r,0.,1.);
   vec3 nrm=normalize(vec3(-toC.x*1.6,lump+.25,-toC.y*1.6));
   float lit=.62+.5*max(0.,dot(nrm,normalize(vec3(sunDir.x,max(sunDir.y,.2),sunDir.z))));
   // GROVES: trees of a kind stand together, so colour drifts in patches about
   // 70 m across -- which, unlike the single crowns, still reads from far off.
   vec2 gq=wp/70.,gc=floor(gq),gf=fract(gq);gf=gf*gf*(3.-2.*gf);
   float g00=fract(sin(dot(gc,vec2(41.3,289.1)))*43758.5453),g10=fract(sin(dot(gc+vec2(1.,0.),vec2(41.3,289.1)))*43758.5453);
   float g01=fract(sin(dot(gc+vec2(0.,1.),vec2(41.3,289.1)))*43758.5453),g11=fract(sin(dot(gc+vec2(1.,1.),vec2(41.3,289.1)))*43758.5453);
   float grove=mix(mix(g00,g10,gf.x),mix(g01,g11,gf.x),gf.y);
   vec3 groveLeaf=grove<.3?mix(farC0,farC1,smoothstep(.2,.3,grove)):grove<.6?mix(farC1,farC2,smoothstep(.5,.6,grove)):mix(farC2,farC3,smoothstep(.7,.85,grove));
   vec3 leaf=mix(pick<.3?farC0:pick<.55?farC1:pick<.8?farC2:farC3,groveLeaf,.55);
   vec3 near=leaf*mix(.4,lit,smoothstep(0.,.35,lump));
   float sharp=1.-smoothstep(.12,.55,length(fwidth(wp))/farSize);
   // Round 6: past the single crowns the forest was its groves alone -- 70 m
   // blobs of one colour, camouflage from above (Autumn's overview). A middle
   // scale between them: clusters of crowns about 26 m across, the nearest
   // of a jittered grid so their edges are organic, each one of the leaf
   // colours -- the mosaic a far wooded hillside shows -- fading to their
   // average where a cluster is under a pixel; and the groves blended half
   // toward the forest's average colour.
   vec2 m2=wp/26.,mi=floor(m2);float mBest=9.,mPick=0.;
   for(int a=-1;a<=1;a++)for(int b=-1;b<=1;b++){vec2 c=mi+vec2(float(a),float(b));vec2 h=fract(sin(vec2(dot(c,vec2(91.7,47.3)),dot(c,vec2(53.1,17.9))))*43758.5453);vec2 v=c+.15+.7*h-m2;float dd=dot(v,v);if(dd<mBest){mBest=dd;mPick=h.y;}}
   vec3 avgLeaf=(farC0+farC1+farC2+farC3)*.25,mosaic=mPick<.3?farC0:mPick<.55?farC1:mPick<.8?farC2:farC3;
   float mSharp=1.-smoothstep(.15,.6,length(fwidth(wp))/26.);
   vec3 farLeaf=mix(mix(avgLeaf,groveLeaf,.5),mix(mosaic,groveLeaf,.35),mSharp*.75)*(.84+.24*patchNoise(wp/19.));
   vec3 canopy=mix(farLeaf*.72,near,sharp);
   turf=mix(turf,canopy,mask);
  }
 }
 diffuseColor.rgb=turf;
 `);
 };m.customProgramCacheKey=()=> 'continuous-cartoon-ground-v37';return m;
}
