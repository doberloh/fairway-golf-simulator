import * as T from 'three';
import {familyModels,modelExtents,modelParts,meshAtlas,instanceModels} from './mesh-assets.js';
import {toonRamp} from './textures.js';
import {allows} from './grounds.js';
import {biomeOf} from './biomes.js';
import {addViewBlockers} from './vegetation.js';
import {viewBlocker} from './camera-tours.js';
// Fairway homes. Sites must be dry, gently sloping rough, clear of tee and green
// complexes and spaced from one another. Each house draws its own form, roof,
// porch, garage, fence and garden from the same seeded stream, so a street reads
// as built over time rather than stamped.
const FORMS=['gable','hip','saltbox','lshape'];
// A street's colours (the cartoon overhaul): pale walls, roofs in a handful
// of weathered tones; warm biomes in stucco and terracotta. PLACED.
const WALLS=['#ece6d6','#dfe4e3','#e8d9bb','#d3dccb','#efe0d0','#dad3c6'];
const ROOFS=['#8a4b3c','#5d636b','#6d5240','#45605a','#7b4a46','#4f5566'];
const WALLS_WARM=['#ecd7b5','#e3c49c','#f0e1c6','#dcc0a0'];
const ROOFS_WARM=['#b5643f','#a5553a','#c2794d','#8f5a3e'];
// `viewBlocked(x, z, top, pad)` is the generator's tee-view test (course.js,
// blocksView), passed in rather than imported because course.js imports this.
export function generateHomes(s,holes,height,surface,random,viewBlocked=null){if(!s.homes)return[];const rng=random(s.seed+':homes'),homes=[];
 for(const h of holes)for(let z=45;z<h.length-42;z+=45)for(const side of [-1,1]){if(rng()*100>s.homeDensity)continue;const p=h.toWorld({x:h.center(z)+side*(h.width(z)+s.semiRough+s.homeSetback+13),z:z+(rng()-.5)*12}),target=h.toWorld({x:h.center(z),z}),rotation=Math.atan2(target.x-p.x,target.z-p.z),c=Math.cos(rotation),sn=Math.sin(rotation),width=16+rng()*9,depth=13+rng()*6,corners=[[-width/2-4,-depth/2-4],[-width/2-4,depth/2+4],[width/2+4,-depth/2-4],[width/2+4,depth/2+4],[0,0]].map(([x,z])=>({x:p.x+x*c+z*sn,z:p.z-x*sn+z*c}));
  if(corners.some(q=>!allows(surface(q.x,q.z),'trees'))||holes.some(other=>{const q=other.toLocal(p);return Math.hypot(q.x-(other.green??other.pin).x,q.z-(other.green??other.pin).z)<other.greenSize*other.greenAspect+30||Object.values(other.tees).some(t=>Math.hypot(q.x-t.x,q.z-t.z)<28);})||homes.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<42))continue;
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
// Half-width and half-depth of a cartoon house's walls (its `stone` part).
const wallExtents=model=>{const walls=modelParts(model)?.find(p=>p.role==='stone')?.geometry;if(!walls)return modelExtents(model);
 // The ingest centres a model on its WHOLE box, porch and eaves included, so
 // the walls can sit off centre: their own middle is returned too.
 walls.computeBoundingBox();const b=walls.boundingBox;return {rx:(b.max.x-b.min.x)/2,rz:(b.max.z-b.min.z)/2,cx:(b.max.x+b.min.x)/2,cz:(b.max.z+b.min.z)/2};};
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
   // THE CARTOON HOUSES (tools/blender/cartoon_houses.py): a model for the
   // form the generator chose (h.form), two of each; walls, roof, trim and
   // glass each a colour of their own, the walls and roof drawn per house
   // from a street's palette (stucco where the biome is warm). PLACED.
   const byForm=models.filter(m=>m.toLowerCase().includes('_'+h.form)),pool=byForm.length?byForm:models;
   const model=pool[Math.floor(h.shade*pool.length)%pool.length];
   // Their WALLS are fitted to the collider, measured off the walls' own part
   // (the ingest scales each model to unit height, chimney and all), and only
   // the eaves, their trim and a porch roof overhang it -- decoration a ball
   // passes under or through, as it would a gutter.
   const {rx,rz,cx=0,cz=0}=model.startsWith('Blender_House')?wallExtents(model):modelExtents(model);
   const sx=h.width/Math.max(2*rx,.01),sz=h.depth/Math.max(2*rz,.01),c=Math.cos(h.rotation),s=Math.sin(h.rotation);
   // Shift by the walls' offset, turned with the house, so the walls' middle
   // is the collider's.
   const ox=-cx*sx,oz=-cz*sz;
   dummy.position.set(h.x+ox*c+oz*s,h.y,h.z-ox*s+oz*c);
   dummy.rotation.set(0,h.rotation,0);
   dummy.scale.set(sx,h.height,sz);
   dummy.updateMatrix();
   const walls=warm?WALLS_WARM:WALLS,roofs=warm?ROOFS_WARM:ROOFS;
   const wall=new T.Color(walls[Math.floor(h.trim*walls.length)%walls.length]).offsetHSL(0,0,(h.shade-.5)*.04);
   const roof=new T.Color(roofs[Math.floor(h.shade*7.3*roofs.length)%roofs.length]);
   tint.set('#f4f1e8');
   entries.push({model,owner:h,variant:0,matrix:dummy.matrix.clone(),
    color:{stone:wall,bark:roof,accent:tint.clone(),dirt:new T.Color('#3d4c5e'),leaf:wall.clone()}});
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
 // One material for every house: the paint carries the shading and the
 // instance colour each role's colour, so a street is one draw call per model
 // and role rather than per home.
 const shared=new Map();
 const materialFor=(role,variant=0,painted=false)=>{
  const key=painted?'p':variant;
  if(!shared.has(key))shared.set(key,painted?new T.MeshToonMaterial({color:'#ffffff',vertexColors:true,gradientMap:ramp??toonRamp(view)})
   :new T.MeshToonMaterial({map:meshAtlas(variant),color:'#ffffff'}));
  return shared.get(key);
 };
 // A house in the way of the camera goes whole, every part of it (UI/UX pass V2).
 const shape=new Map(),of=h=>{if(!shape.has(h))shape.set(h,viewBlocker(h.x,h.y,h.z,Math.max(h.width,h.depth),h.height*1.6));return shape.get(h);};
 instanceModels(view.group,entries,materialFor,({mesh,matrices,owners})=>addViewBlockers(view,mesh,matrices,owners.map(h=>h?of(h):viewBlocker(0,-1e4,0,0,0))));
}

