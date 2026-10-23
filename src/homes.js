import * as T from 'three';
import {familyModels,modelExtents,meshAtlas,atlasCount,instanceModels} from './mesh-assets.js';
import {toonRamp} from './textures.js';
import {biomeOf} from './biomes.js';
import {addViewBlockers} from './vegetation.js';
import {viewBlocker} from './camera-tours.js';
// Fairway homes. Sites must be dry, gently sloping rough, clear of tee and green
// complexes and spaced from one another. Each house draws its own form, roof,
// porch, garage, fence and garden from the same seeded stream, so a street reads
// as built over time rather than stamped.
const FORMS=['gable','hip','saltbox','lshape'];
// `viewBlocked(x, z, top, pad)` is the generator's tee-view test (course.js,
// blocksView), passed in rather than imported because course.js imports this.
export function generateHomes(s,holes,height,surface,random,viewBlocked=null){if(!s.homes)return[];const rng=random(s.seed+':homes'),homes=[];
 for(const h of holes)for(let z=45;z<h.length-42;z+=45)for(const side of [-1,1]){if(rng()*100>s.homeDensity)continue;const p=h.toWorld({x:h.center(z)+side*(h.width(z)+s.semiRough+s.homeSetback+13),z:z+(rng()-.5)*12}),target=h.toWorld({x:h.center(z),z}),rotation=Math.atan2(target.x-p.x,target.z-p.z),c=Math.cos(rotation),sn=Math.sin(rotation),width=16+rng()*9,depth=13+rng()*6,corners=[[-width/2-4,-depth/2-4],[-width/2-4,depth/2+4],[width/2+4,-depth/2-4],[width/2+4,depth/2+4],[0,0]].map(([x,z])=>({x:p.x+x*c+z*sn,z:p.z-x*sn+z*c}));
  if(corners.some(q=>surface(q.x,q.z)!=='rough')||holes.some(other=>{const q=other.toLocal(p);return Math.hypot(q.x-(other.green??other.pin).x,q.z-(other.green??other.pin).z)<other.greenSize*other.greenAspect+30||Object.values(other.tees).some(t=>Math.hypot(q.x-t.x,q.z-t.z)<28);})||homes.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<42))continue;
  const levels=corners.map(q=>height(q.x,q.z));// Scaled with the footprint, not raised arbitrarily. The probe box grew from
  // about 16x15 m to 28x24 m, so holding the old 2.5 m drop would have been a
  // far STRICTER gradient than before and starved the steep biomes: mountain
  // fell to three houses a course at full density. 4.2 m over the new diagonal
  // is the same slope the old limit allowed.
  if(Math.max(...levels)-Math.min(...levels)>4.2)continue;
  // A foundation deep enough to meet the lowest corner, so nothing floats on a slope.
  const base=Math.max(...levels),footing=base-Math.min(...levels)+.45;
  // NOT IN WHAT A TEE SEES. The 28 m circle round each tee keeps a house off
  // the pad, not out of the view: a house 40-120 m out, inside the tee's
  // forward wedge, could stand between the golfer and the landing area. Judged
  // at the tallest a house is built (11 m) and half the footprint's diagonal,
  // because the house's own height is drawn only once it is accepted.
  if(viewBlocked&&viewBlocked(p.x,p.z,base+11,Math.hypot(width,depth)/2))continue;
  homes.push({...p,y:base,footing,rotation,width,depth,height:7+rng()*4,shade:rng(),hole:h.hole,
   form:FORMS[Math.floor(rng()*FORMS.length)],porch:rng()<.55,garage:rng()<.5,fence:rng()<.45,garden:rng()<.7,
   roofPitch:.8+rng()*.9,trim:rng(),wing:.42+rng()*.22});
 }return homes;
}
export function addHomes(view){
 const bio=biomeOf(view.world.settings.biome),warm=bio.warm,arid=bio.arid;
 // Houses shade the way the rest of the scene does. They were the last thing in
 // a cartoon frame still lit as PBR, which meant they answered a falling sun on
 // a different curve from the ground they stand on -- the same mismatch that
 // made the tall grass glow after sunset.
 const toon=view.style==='cartoon',ramp=toon?toonRamp(view):null;
 const surfaceMaterial=(color,opts={})=>{const{roughness,flatShading,...toonOpts}=opts;
  return toon?new T.MeshToonMaterial({color,gradientMap:ramp,...toonOpts})
             :new T.MeshStandardMaterial({color,roughness:roughness??1,...opts});};
 const models=familyModels('house');
 const dummy=new T.Object3D(),tint=new T.Color(),entries=[];
 for(const h of view.world.homes){
  const group=new T.Group();group.position.set(h.x,h.y,h.z);group.rotation.y=h.rotation;
  const timber=surfaceMaterial(warm?'#b08a63':'#7d6c55',{roughness:.95});
  const box=(w,y,d,x,cy,z,m,cast=true)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,y,d),m);mesh.position.set(x,cy,z);mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  // Foundation reaches the lowest corner so a house never floats on a slope.
  // Imported buildings sit flat, so this still does the terrain fitting.
  box(h.width+.35,h.footing+2.6,h.depth+.35,0,-(h.footing+2.6)/2+.3,0,surfaceMaterial('#aaa898'),false);
  if(models.length){
   // The building itself is an imported model, fitted to the same
   // width x height x depth box that simulateShot collides against, so what is
   // drawn and what the ball hits stay the same object. The models are boxy
   // enough that filling the box costs no visible distortion, and matching the
   // collider matters more than preserving their aspect exactly.
   const model=models[Math.floor(h.shade*models.length)%models.length];
   const {rx,rz}=modelExtents(model);
   dummy.position.set(h.x,h.y,h.z);
   dummy.rotation.set(0,h.rotation,0);
   dummy.scale.set(h.width/Math.max(2*rx,.01),h.height,h.depth/Math.max(2*rz,.01));
   dummy.updateMatrix();
   // Each atlas is a palette grid, so a house takes all of its colour from one
   // of them and every roof in that atlas matches. Spreading houses across the
   // four is what varies roof and wall colour down a street; the per-house tint
   // then only nudges, because a strong one would drag roof and walls together.
   const variant=Math.floor(h.trim*atlasCount())%Math.max(1,atlasCount());
   tint.setHSL(.09+h.shade*.06,warm?.22:.10,.86+h.trim*.10);
   entries.push({model,owner:h,variant,matrix:dummy.matrix.clone(),
    color:{bark:tint.clone(),leaf:tint.clone(),stone:tint.clone(),dirt:tint.clone(),accent:tint.clone()}});
  }
  if(h.garage){
   // A short drive out toward the road side, laid flat on the foundation.
   const gx=(h.width/2+2.4)*(h.trim>.5?1:-1);
   box(3.4,.06,9,gx,.03,-h.depth*.1+7.4,surfaceMaterial('#b3ae9e'),false);
  }
  if(h.fence){const post=surfaceMaterial(warm?'#c2a077':'#cdc6b0',{roughness:.95});
   for(const side of [-1,1])for(let i=0;i<7;i++)box(.09,1,.09,side*(h.width/2+3.2),.5,-h.depth/2-2+i*1.6,post,false);
   for(const side of [-1,1])box(.06,.1,9.6,side*(h.width/2+3.2),.82,-h.depth/2+3.6,post,false);}
  if(h.garden){const leaf=surfaceMaterial(warm?'#7d9160':'#5d7c46');
   for(let i=0;i<4;i++){const r=.5+((h.shade*7+i)%3)*.22,bush=new T.Mesh(new T.SphereGeometry(r,7,5),leaf);bush.position.set(-h.width*.4+i*(h.width*.27),r*.75,h.depth/2+.9);bush.castShadow=true;bush.receiveShadow=true;group.add(bush);}}
  view.group.add(group);
 }
 if(!entries.length)return;
 // One material for every house: the atlas carries the colour and the instance
 // tint varies it, so a street is one draw call per model rather than per home.
 const shared=new Map();
 const materialFor=(role,variant=0)=>{
  if(!shared.has(variant))shared.set(variant,new T.MeshToonMaterial({map:meshAtlas(variant),color:'#ffffff'}));
  return shared.get(variant);
 };
 // A house in the way of the camera goes whole, every part of it (UI/UX pass V2).
 const shape=new Map(),of=h=>{if(!shape.has(h))shape.set(h,viewBlocker(h.x,h.y,h.z,Math.max(h.width,h.depth),h.height*1.6));return shape.get(h);};
 instanceModels(view.group,entries,materialFor,({mesh,matrices,owners})=>addViewBlockers(view,mesh,matrices,owners.map(h=>h?of(h):viewBlocker(0,-1e4,0,0,0))));
}

