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
export function windMaterial(material,view,strength=1,ground=false){
 material.onBeforeCompile=shader=>{
  shader.uniforms.foliageTime=view.foliageTime;shader.uniforms.breeze=view.breeze;
  shader.uniforms.windVec=view.windVec;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float foliageTime; uniform float breeze; uniform vec2 windVec;');
  // Displace in world units AFTER instancing: all canopy pieces share a passing
  // gust, with additional small flutter. This also moves low-poly crowns.
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   mvPosition=instanceMatrix*mvPosition;
   // Phased ALONG the wind, so a gust travels downwind across a field and
   // everything on the same line across the wind moves together. Phased by
   // position alone, every plant keeps its own schedule and the field shimmers
   // rather than breathing.
   float along=dot(instanceMatrix[3].xz,windVec)*.03;
   float gust=sin(foliageTime*1.5-along)*.65+sin(foliageTime*2.7-along*.4)*.25;
   // How much this vertex is free to move: a blade tip travels, its root does not.
   float lever=${strength.toFixed(3)}*${ground?'max(position.y,0.)':'(0.8+position.y*.15)'};
   // Downwind, plus a lighter crosswind flutter on its own beat so a blade wags
   // instead of sliding along a rail.
   vec2 across=vec2(-windVec.y,windVec.x);
   mvPosition.xz+=windVec*(gust*breeze*lever)
                 +across*(sin(foliageTime*3.1-along*1.7)*.3*breeze*lever);
  #endif
  mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`);
 };material.customProgramCacheKey=()=>`breeze-wind-${strength}-${ground}`;return material;
}
