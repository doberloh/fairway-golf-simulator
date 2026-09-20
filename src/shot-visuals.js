import * as T from 'three';
import {biomeOf} from './biomes.js';
export function aimTarget(origin,degrees,distance){const a=degrees*Math.PI/180;return{x:origin.x+Math.sin(a)*distance,z:origin.z+Math.cos(a)*distance};}
export function windDrift(settings){const speed=Math.max(0,Math.min(25,settings.wind||0)),a=(settings.windDirection||0)*Math.PI/180;return {x:Math.sin(a)*speed*.44704,z:Math.cos(a)*speed*.44704,count:speed===0?0:Math.min(76,Math.round(8+speed*2.7))};}
export function localWind(settings,rotation){const w=windDrift(settings),c=Math.cos(rotation),s=Math.sin(rotation);return [w.x*c-w.z*s,0,w.x*s+w.z*c];}
export function createShotEffects(view){
 const rng=()=>Math.random(),group=new T.Group(),wind=windDrift(view.world.settings),bio=biomeOf(view.world.settings.biome),dust=bio.dust,color=bio.spray;
 const positions=new Float32Array(76*3),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setDrawRange(0,wind.count);const mat=new T.PointsMaterial({color,size:dust?.065:.1,transparent:true,opacity:.6,depthWrite:false});
 // A TAIL, WHICH MEANS THE SPRITE HAS TO KNOW WHICH WAY IT IS TRAVELLING.
 // `gl_PointCoord` is screen space and axis-aligned, so the shape cannot work
 // it out for itself. The wind is one vector for the whole scene, though, so
 // projecting it onto the camera's right and up axes once a frame gives every
 // particle the screen direction it needs from a single uniform.
 //
 // The tail is SHAPE, not an alpha gradient. These sprites are a few pixels
 // across; a gradient over that is invisible, and a second shader injection
 // point to multiply the alpha is a hook into three's fragment chain that
 // this does not need.
 const tail={value:new T.Vector2(0,1)};
 mat.onBeforeCompile=s=>{s.uniforms.uTail=tail;s.fragmentShader='uniform vec2 uTail;\n'+s.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 vec2 q=gl_PointCoord-vec2(.5);q.y=-q.y;
 float along=dot(q,uTail),across=dot(q,vec2(-uTail.y,uTail.x));
 if(along>.19||along<-.45)discard;
 // Semicircular head ahead of centre, tapering to a point behind it.
 float halfW=along>0.?sqrt(max(0.,.0361-along*along)):.19*pow(1.+along/.45,1.2);
 if(abs(across)>halfW)discard;`);};const debris=new T.Points(g,mat);debris.frustumCulled=false;group.add(debris);
 // Each mote gets its own wobble, or the whole cloud breathes in unison and
 // reads as one object being shaken rather than a lot of light things in
 // moving air. The rates are deliberately unrelated so the pattern does not
 // visibly repeat.
 const seeds=Array.from({length:76},()=>({x:(rng()-.5)*42,y:(rng()-.5)*22,z:(rng()-.5)*42,phase:rng()*6.28,
  sway:.35+rng()*.95,swayRate:.55+rng()*1.5,swayPhase:rng()*6.28,
  bob:.18+rng()*.5,bobRate:.9+rng()*2.1,
  // A little spread in how fast each one is carried: identical speeds look
  // like one texture being scrolled past the camera.
  drag:.72+rng()*.42}));let initialized=false;
 const burstGeo=new T.BufferGeometry();burstGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(48*3),3));const burstMat=new T.PointsMaterial({color:'#b2c26d',size:.09,transparent:true,depthWrite:false}),burst=new T.Points(burstGeo,burstMat);burst.visible=false;burst.frustumCulled=false;group.add(burst);
 const ring=new T.Mesh(new T.RingGeometry(.8,1,48),new T.MeshBasicMaterial({color:'#fff2b7',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;group.add(ring);let particles=[],age=2,origin=null,putt=false;
 function hit(local,aim,lie,speed){const h=view.course,w=h.toWorld(local),a=(aim*Math.PI/180)+h.rotation;origin={x:w.x,y:h.height(local.x,local.z)+.04,z:w.z};putt=lie==='green';age=0;const count=putt?6:lie==='sand'?48:28;burstGeo.setDrawRange(0,count);burstMat.color.set(putt?'#fff4c5':lie==='sand'?view.world.bio.sand:lie==='rough'? '#839752':'#b1bc67');burstMat.size=putt?.025:lie==='sand'?.07:.09;particles=Array.from({length:count},()=>{const heading=a+(rng()-.5)*1.5,velocity=(putt?.15:1.4)+rng()*Math.min(4,speed*.08);return{vx:Math.sin(heading)*velocity,vz:Math.cos(heading)*velocity,vy:putt?.15:rng()*2.5+.8};});ring.position.set(origin.x,origin.y+.02,origin.z);ring.visible=burst.visible=true;}
 // Scratch vectors, kept out of the frame loop rather than rebuilt sixty
 // times a second for the life of a round.
 const camRight=new T.Vector3(),camUp=new T.Vector3(),camBack=new T.Vector3(),windDir=new T.Vector3();
 function update(dt,time){const camera=view.camera.position,a=g.attributes.position;
  // Where the wind points ON SCREEN: the world drift resolved onto the
  // camera's own right and up axes. Left alone when there is no wind, so the
  // last good direction stays rather than collapsing to zero and discarding
  // every fragment.
  view.camera.matrixWorld.extractBasis(camRight,camUp,camBack);
  windDir.set(wind.x,0,wind.z);
  // Square to the wind, in world space, for the sway each mote adds below.
  const wlen=Math.hypot(wind.x,wind.z)||1,perpX=-wind.z/wlen,perpZ=wind.x/wlen;
  if(windDir.lengthSq()>1e-9){
   const sx=windDir.dot(camRight),sy=windDir.dot(camUp),len=Math.hypot(sx,sy);
   if(len>1e-6)tail.value.set(sx/len,sy/len);
  }for(let i=0;i<wind.count;i++){const seed=seeds[i];let x=initialized?a.getX(i):camera.x+seed.x,y=initialized?a.getY(i):camera.y+seed.y,z=initialized?a.getZ(i):camera.z+seed.z;const swing=Math.sin(time*seed.swayRate+seed.swayPhase)*seed.sway;
   // CARRIED, NOT FIRED. The sway is a sideways VELOCITY that swings through
   // zero, so integrating it gives a bounded weave across the wind rather than
   // a mote that wanders off downwind of itself.
   x+=(wind.x*seed.drag+perpX*swing)*dt;
   z+=(wind.z*seed.drag+perpZ*swing)*dt;
   y+=(Math.sin(time*1.4+seed.phase)*.1+Math.sin(time*seed.bobRate+seed.phase*1.7)*seed.bob)*dt;for(const axis of ['x','y','z']){const half=axis==='y'?11:21;let v=axis==='x'?x:axis==='y'?y:z;v=camera[axis]+(((v-camera[axis]+half)%(half*2)+half*2)%(half*2))-half;if(axis==='x')x=v;else if(axis==='y')y=v;else z=v;}a.setXYZ(i,x,y,z);}initialized=true;a.needsUpdate=true;
  if(age<1){age+=dt;const p=burstGeo.attributes.position;particles.forEach((v,i)=>p.setXYZ(i,origin.x+v.vx*age,origin.y+Math.max(0,v.vy*age-4.9*age*age),origin.z+v.vz*age));p.needsUpdate=true;burstMat.opacity=Math.max(0,1-age/(putt?.3:.8));ring.scale.setScalar((putt?.12:.3)+age*(putt?.6:3));ring.material.opacity=Math.max(0,.5-age*1.6);if(age>.85)burst.visible=ring.visible=false;}
 }
 return {group,update,hit};
}
