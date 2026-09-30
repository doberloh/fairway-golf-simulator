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
export function toonRamp(view){
 const t=new T.DataTexture(new Uint8Array([90,90,90,255,145,145,145,255,205,205,205,255,245,245,245,255]),4,1);
 t.minFilter=t.magFilter=T.LinearFilter;t.needsUpdate=true;
 view?.resources?.push(t);
 return t;
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
// its instance. Its sway grows with how high the vertex sits in the model
// (squared, so the base is still and the top travels) and with the plant's own
// height -- a 60 m redwood's top moves about a third of a metre in a gust, a
// fern's tips about a tenth (U2 in TODO). The procedural shapes and the grass
// keep the older, flatter lever. `sway` scales all of it: the Graphics panel's
// "Wind in the trees and grass".
//
// `leaf`: with `crown`, whether this part flutters as well as bends. The bark
// of an imported tree takes the same bend as its leaves -- same lever, same
// gust, so trunk and crown stay joined -- and only the leaves add the flutter.
// The bend is squared in height, so at a ball's height up a trunk it is a few
// millimetres: the trunk the physics collides with and the one drawn still
// agree where a ball can reach it.
//
// GUSTS ARE PATCHES THAT TRAVEL. This was one sine wave down the wind, 200 m
// crest to crest, crossing the course at 50 m/s -- so near enough everything in
// view swung together, back and forth, and a field of grass moved as one sheet.
// Real gusts are cat's paws: patches of stronger air a few tens of metres
// across that drift downwind at about the wind's own speed, with calmer air
// between. So the gust here is a noise field (two octaves, 38 m and 14 m)
// dragged downwind at 3 + 4 x breeze m/s, and a plant LEANS downwind by how
// much gust it is standing in, and bobs on its own beat on top -- faster for
// grass, slower for a big tree -- rather than swinging to and fro through
// upright. The patches are what you see rolling across the rough.
export function windMaterial(material,view,strength=1,ground=false,crown=false,leaf=true){
 material.onBeforeCompile=shader=>{
  shader.uniforms.foliageTime=view.foliageTime;shader.uniforms.breeze=view.breeze;
  shader.uniforms.windVec=view.windVec;shader.uniforms.sway=view.sway??{value:1};
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float foliageTime; uniform float breeze; uniform vec2 windVec; uniform float sway;
float gustHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float gustNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gustHash(i),gustHash(i+vec2(1.,0.)),f.x),mix(gustHash(i+vec2(0.,1.)),gustHash(i+vec2(1.,1.)),f.x),f.y);}`);
  // Displace in world units AFTER instancing: all canopy pieces share a passing
  // gust, with additional small flutter. This also moves low-poly crowns.
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   mvPosition=instanceMatrix*mvPosition;
   // The gust this plant is standing in, from a field of patches dragged
   // downwind (see above), and its own phase so neighbours do not bob in step.
   vec2 base=instanceMatrix[3].xz;
   vec2 drift=base-windVec*foliageTime*(3.+4.*breeze);
   float gust=smoothstep(.25,.85,gustNoise(drift/38.)*.7+gustNoise(drift/14.+vec2(9.1,3.7))*.3);
   float phase=gustHash(floor(base*2.))*6.2832;
   float beat=foliageTime*${crown?'1.2':ground?'2.4':'1.8'}+phase;
   float push=.25+.95*gust+(.12+.3*gust)*sin(beat);
   // How much this vertex is free to move: a blade tip travels, its root does not.
   // Ground cover bends by its REAL height above its root. It used the model's
   // own units, which are the same for a 7 cm tuft and a metre of prairie, so
   // the short rough was pushed further sideways than it was tall and lay flat
   // as dark scratches on the ground.
   float lever=sway*${strength.toFixed(3)}*${crown?'position.y*position.y*(.006*length(instanceMatrix[1].xyz)+.12)':ground?'max(mvPosition.y-instanceMatrix[3].y,0.)':'(0.8+position.y*.15)'};
   // Downwind, plus a lighter crosswind flutter on its own beat so a blade wags
   // instead of sliding along a rail.
   vec2 across=vec2(-windVec.y,windVec.x);
   mvPosition.xz+=windVec*(push*breeze*lever)
                 +across*(sin(beat*1.7+phase)*(.1+.2*gust)*breeze*lever);
   ${crown&&leaf?`// Leaves flutter as well: a small shiver across the crown, varying
   // smoothly through it so it ripples rather than jitters, scaled to the
   // plant's height and livelier in a gust.
   float shiver=sin(foliageTime*6.3+dot(position,vec3(7.1,5.3,3.7)))*.004*length(instanceMatrix[1].xyz)*position.y;
   mvPosition.xyz+=vec3(across.x,.35,across.y)*shiver*(.3+gust)*breeze*sway*${strength.toFixed(3)};`:''}
  #endif
  mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`);
 };material.customProgramCacheKey=()=>`breeze-wind-v2-${strength}-${ground}-${crown}-${leaf}`;return material;
}
