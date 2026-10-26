import * as T from 'three';
import {random} from './course.js';
import {biomeOf} from './biomes.js';
// Locally generated, tileable albedo + relief. Different turf cuts have their
// own blade scale and coverage; exposed land changes with the biome.
// The scene's one toon ramp.
//
// A MeshToonMaterial with no gradientMap does NOT shade from dark to light. Look
// at three's gradientmap_pars_fragment: the fallback is
// mix(vec3(0.7), vec3(1.0), ...) -- a hard floor of 0.7, so a surface facing
// directly away from the sun still takes seventy percent of its light. The
// ground has always supplied this ramp, whose darkest step is 90/255, and so
// bottomed out at 0.35. Anything without the ramp therefore could not get darker
// than roughly twice the ground beneath it.
//
// That went unnoticed while the sun was fixed high and bright. A low sun is what
// exposed it: the ground went to dusk and the grass stayed at noon.
//
// THE RAMP IS COLOURED (the cartoon overhaul's lighting, round 1). Painted
// films shade toward a cool colour, not toward grey: the side of a crown
// turned from the sun goes blue-violet, the way skylight fills it. three reads
// only the ramp's red channel, so the chunk is taught to read all three, and
// each landscape's `light.shade` (biomes.js) leans the two dark steps toward
// its own hue at unchanged brightness. A grey ramp draws exactly as before.
T.ShaderChunk.gradientmap_pars_fragment=T.ShaderChunk.gradientmap_pars_fragment.replace('vec3( texture2D( gradientMap, coord ).r )','texture2D( gradientMap, coord ).rgb');
// THE GRADE (the cartoon overhaul's lighting, round 1). ACES, the filmic curve
// the game has always used, greys strong colour as it compresses it -- the
// copper of an autumn crown came out tan. The renderer now asks for three's
// custom tone mapping, which is ACES and then the colour given back a little
// (`GRADE`, PLACED by eye). In the one chunk every material and the bloom's
// composite include, so it costs no pass of its own.
export const GRADE=1.12;
T.ShaderChunk.tonemapping_pars_fragment=T.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
 `vec3 CustomToneMapping( vec3 color ) { color = ACESFilmicToneMapping( color ); float grey = dot( color, vec3( .2126, .7152, .0722 ) ); return max( mix( vec3( grey ), color, ${GRADE.toFixed(3)} ), 0. ); }`);
// Round 2: eight steps where there were four, falling faster through the lit
// half. With four, a slope turned 30 degrees from a noon sun drew 8% darker
// than the flat beside it and the desert's dunes had no shape at all; now it
// is about 15%. The darkest step keeps a floor (a course you cannot read is a
// bug, not a mood).
const RAMP=[70,84,100,122,150,184,218,250],LEAN=[.9,.85,.7,.5,.3,.15,.05,0];
export function rampSteps(shade){
 const c=shade?new T.Color(shade):null,l=c?.2126*c.r+.7152*c.g+.0722*c.b:1,data=new Uint8Array(RAMP.length*4);
 RAMP.forEach((g,i)=>{for(let k=0;k<3;k++){const hue=c?[c.r,c.g,c.b][k]/l:1;data[i*4+k]=Math.round(Math.min(255,g*(1+(hue-1)*LEAN[i])));}data[i*4+3]=255;});
 return data;
}
export function toonRamp(view){
 const t=new T.DataTexture(rampSteps(view?.world?.bio?.light?.shade),RAMP.length,1);
 t.minFilter=t.magFilter=T.LinearFilter;t.needsUpdate=true;
 view?.resources?.push(t);
 return t;
}

// A RIM OF SKY ROUND A CROWN (the cartoon overhaul's lighting, round 1).
// Where a surface turns away from the eye it catches the sky behind it -- the
// bright edge that separates a painted tree from the trees behind it (Barla's
// cell shading; the stylised-foliage tutorials, RESEARCH *The overhaul's
// lighting*). The sky's own colour, so it follows the clock to dusk and night
// with no constants of its own, and the sun's colour on top where the sun
// stands behind the crown. Times the surface's colour, so a red maple's rim is
// red. Chained after any other `onBeforeCompile` (windMaterial).
export function rimLit(material,strength=.35){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.customProgramCacheKey=()=>key.call(material)+'-rim'+strength;
 material.onBeforeCompile=shader=>{compile?.(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
 #if NUM_HEMI_LIGHTS>0
 {vec3 toEye=normalize(vViewPosition);float edge=1.-clamp(dot(normal,toEye),0.,1.);edge*=edge;edge*=edge;
  vec3 rim=hemisphereLights[0].skyColor;
  #if NUM_DIR_LIGHTS>0
  float behind=clamp(dot(-toEye,directionalLights[0].direction),0.,1.);rim+=directionalLights[0].color*behind*behind*.9;
  #endif
  reflectedLight.indirectDiffuse+=diffuseColor.rgb*rim*edge*${strength.toFixed(3)};}
 #endif`);};
 return material;
}

export function surfaceTextures(biome,kind){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),rng=random(biome+':'+kind);
 const sand=['sand','shore','lip'].includes(kind)||kind==='land'&&biomeOf(biome).sandLand,rough=['land','rough'].includes(kind),short=['green','fringe','tee'].includes(kind);
 const density={pnw:1.4,island:1.2,links:.8,mountain:.95,desert:.85,autumn:1,midwest:1.15}[biome]||1;const bladeScale={pnw:1.15,island:1.45,links:1.8,mountain:.8,desert:.8,autumn:1,midwest:1.1}[biome]||1;
 const base=sand?194:rough?156:182;ctx.fillStyle=`rgb(${base},${base},${base})`;ctx.fillRect(0,0,512,512);
 const dots=sand?25000:10000*density;for(let i=0;i<dots;i++){
  const x=rng()*512,y=rng()*512,v=base-50+rng()*100;ctx.strokeStyle=`rgba(${v},${v},${v},.7)`;ctx.fillStyle=ctx.strokeStyle;
  if(sand){const r=.3+rng()*1.3;ctx.fillRect(x,y,r,r);}else{const len=(short?1.5:rough?5:3)+rng()*(short?3:rough?15:7);ctx.lineWidth=short?.65:rough?1.4*bladeScale:1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+len*.35,y-len*(rough?bladeScale:1));ctx.stroke();}
 }
 if(rough&&biomeOf(biome).leafLitter)for(let i=0;i<180;i++){ctx.fillStyle=['#a07841','#b59152','#977343'][i%3];ctx.beginPath();ctx.ellipse(rng()*512,rng()*512,2+rng()*2,1+rng()*2,rng()*6,0,7);ctx.fill();}
 if(sand)for(let j=0;j<55;j++){ctx.strokeStyle='rgba(100,89,65,.07)';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=512;x+=8){const y=(j*10+Math.sin(x/512*Math.PI*2)*3)%512;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;const repeat=short?1:rough?.17:.35;map.repeat.set(repeat,repeat);map.anisotropy=16;
 const bump=map.clone();bump.colorSpace=T.NoColorSpace;bump.needsUpdate=true;return {map,bump};
}
// PLANTS LEAN THE WAY THE WIND IS ACTUALLY BLOWING.
//
// This used to displace along a hard-coded diagonal -- x plus z times 0.45 --
// while the course carried a real `windDirection`, the HUD drew an arrow for it,
// and both the ball's drift and the clouds already agreed on which way that was.
// So the ball faded right, the clouds crossed right, and the grass leaned
// somewhere else. `windVec` is that same bearing, and it is the only direction
// in here now.
// `crown`: an imported tree or plant, modelled at unit height and scaled up by
// its instance, which bends as one body (below). The top of a 60 m redwood
// moves about a tenth of a metre on a still day and up to about 1.3 m at the peak of a gust
// in 15 mph; a fern's tips a centimetre or two. The procedural shapes and the
// grass keep a simpler lean-and-bob lever. `sway` scales all of it: the
// Graphics panel's "Wind in the trees and grass".
//
// `leaf`: with `crown`, whether this part rustles as well as bends.
//
// `rooted`: with `crown`, a procedural tree built from many instances -- a
// trunk, branches and leaf pieces each placed on their own -- whose tree it
// belongs to comes from a per-instance `treeRoot` (root x, y, z and the tree's
// height) rather than from the instance itself. Without it every leaf piece
// would bend about its own middle and part company with its branch.
//
// A TREE MOVES AS ONE BODY. Measured trees behave as damped oscillators in
// their first mode: the whole stem bends one way, curving more toward the top,
// at a natural frequency set by its girth over its height squared -- about 0.4
// swings a second for a 15 m tree, 0.2-0.5 for conifers, slower as they get
// taller (Moore and Maguire 2004; RESEARCH.md, *How a tree moves in the wind*).
// Leaves only add a small, fast rustle on top. So for an imported tree (`crown`)
// every part -- bark, limbs, foliage -- takes ONE displacement, a function of
// its height up the tree alone: the cantilever shape h^2 (3 - h) / 2, applied
// along the wind with a little crosswind, then pulled back to its original
// distance from the base so the stem CURVES rather than shears (the "main
// bending" of Crysis, GPU Gems 3 ch. 16). The first build moved the leaves
// separately from the trunk and shivered them fast, which the owner saw
// straight away as a crown sliding about on its trunk.
//
// The bend grows with the square of height, so at a ball's height up a trunk
// it is millimetres: the trunk the physics collides with and the one drawn
// still agree wherever a ball can be.
//
// GUSTS ARRIVE AS FRONTS. Gusts are carried downwind at about the mean wind
// speed (Taylor's frozen turbulence; the "honami" waves that roll across a
// wheat field), so a crosswind gust reaches the trees on the upwind side of a
// fairway first and the far side seconds later. The gust field here is noise
// stretched ACROSS the wind (about 160 m) and short ALONG it (about 45 m), so
// it reads as bands, dragged downwind at the course's own wind speed. Every
// swaying thing samples it at its root, grass and trees alike, so a front bends
// the rough and then the trees as it passes. Earlier versions were one sine
// wave at 50 m/s (everything in step) and then round patches (no front).
// `flexed`: a painted model (tools/blender/cartoon.py) whose vertices say how
// freely each moves (`flex`, 0 rooted to 1 a leaf tip). The rustle on top of
// the bend follows it, so a crown's outer lobes flutter and its core holds
// still, instead of every leaf vertex shivering alike.
export function windMaterial(material,view,strength=1,ground=false,crown=false,leaf=true,rooted=false,flexed=false){
 material.onBeforeCompile=shader=>{
  shader.uniforms.foliageTime=view.foliageTime;shader.uniforms.breeze=view.breeze;
  shader.uniforms.windVec=view.windVec;shader.uniforms.sway=view.sway??{value:1};
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float foliageTime; uniform float breeze; uniform vec2 windVec; uniform float sway;${rooted?'\nattribute vec4 treeRoot;':''}${flexed?'\nattribute float flex;':''}
/* Hash without Sine, (c)2014 David Hoskins, MIT: THIRD_PARTY_NOTICES.txt */float gustHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float gustNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gustHash(i),gustHash(i+vec2(1.,0.)),f.x),mix(gustHash(i+vec2(0.,1.)),gustHash(i+vec2(1.,1.)),f.x),f.y);}`);
  // Displaced in world units AFTER instancing.
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   mvPosition=instanceMatrix*mvPosition;
   // The gust at this plant's root: a front stretched across the wind, carried
   // downwind at the wind's own speed (breeze is .55 + 0.07 per mph; at least
   // 1.5 m/s so a still day still breathes).
   vec2 base=${rooted?'treeRoot.xz':'instanceMatrix[3].xz'},across=vec2(-windVec.y,windVec.x);
   float carry=max(1.5,(breeze-.55)/.07*.447);
   float downwind=dot(base,windVec)-carry*foliageTime,crossing=dot(base,across);
   float gust=smoothstep(.35,.8,gustNoise(vec2(downwind/45.,crossing/160.))*.75+gustNoise(vec2(downwind/17.,crossing/60.)+vec2(5.3,1.7))*.25);
   float phase=gustHash(floor(base*2.))*6.2832;
   ${crown?`// One bend for the whole tree (see above). H is the tree's height: the
   // models are unit height, scaled up by the instance.
   vec3 root=${rooted?'treeRoot.xyz':'instanceMatrix[3].xyz'};float H=${rooted?'treeRoot.w':'length(instanceMatrix[1].xyz)'};
   vec3 rel=mvPosition.xyz-root;float len=length(rel);
   float up=clamp(rel.y/H,0.,1.2),shape=up*up*(3.-up)*.5;
   // Its own natural sway, 3 H^-0.75 swings a second: 0.4 at 15 m, 0.23 at
   // 30 m, 0.14 at 60 m, 1 at 5 m.
   float swing=clamp(3.*pow(H,-.75),.12,1.2)*6.2832;
   float k=H*breeze*sway*${strength.toFixed(3)};
   // Leans downwind with the gust and sways about that lean; a smaller
   // crosswind sway a quarter-turn behind, so the top traces an ellipse.
   float bend=k*(.004+.010*gust+(.002+.004*gust)*sin(foliageTime*swing+phase));
   float side=k*(.001+.002*gust)*sin(foliageTime*swing*.93+phase+1.57);
   rel.xz+=(windVec*bend+across*side)*shape;
   // Back to its old distance from the root: the stem curves, it does not shear.
   if(len>1e-4)rel=normalize(rel)*len;
   mvPosition.xyz=root+rel;
   ${leaf?`// Leaves rustle on top: centimetres, fast, varying smoothly through the
   // crown so it shimmers without coming loose from the branches.
   float rustle=sin(foliageTime*7.3+dot(mvPosition.xyz,vec3(1.9,1.3,2.3)))*.04*(.4+gust)*breeze*sway*${flexed?'(.25+1.5*flex)':'up'};
   mvPosition.xyz+=vec3(across.x,.4,across.y)*rustle;`:''}`
   :`float beat=foliageTime*${ground?'2.4':'1.8'}+phase;
   float push=.25+.95*gust+(.12+.3*gust)*sin(beat);
   // How much this vertex is free to move. Ground cover bends by its REAL
   // height above its root: in the model's own units a 7 cm tuft and a metre of
   // prairie were the same, and the short rough was pushed flat.
   float lever=sway*${strength.toFixed(3)}*${ground?'max(mvPosition.y-instanceMatrix[3].y,0.)':'(0.8+position.y*.15)'};
   // Downwind, plus a lighter crosswind wag on its own beat.
   mvPosition.xz+=windVec*(push*breeze*lever)
                 +across*(sin(beat*1.7+phase)*(.1+.2*gust)*breeze*lever);`}
  #endif
  mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`);
 };material.customProgramCacheKey=()=>`breeze-wind-v3-${strength}-${ground}-${crown}-${leaf}-${rooted}-${flexed}`;return material;
}
