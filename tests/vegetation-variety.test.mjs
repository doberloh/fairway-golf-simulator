import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {generateWorld} from '../src/course.js';
import {addVegetation,carryFade,CARRY_EDGE} from '../src/vegetation.js';
import {addHomes} from '../src/homes.js';

const build=(settings={})=>{
 const world=generateWorld({seed:'VARIETY',biome:'pnw',holes:9,trees:70,water:20,...settings});
 const view={world,style:'cartoon',group:new T.Group(),treeInstances:[],quality:{foliage:1,grass:1},resources:[]};
 addVegetation(view);
 const meshes=[];view.group.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});
 return {world,view,meshes};
};

// The cartoon overhaul's boulders are models (tools/blender/cartoon_rocks.py),
// four per geology: the stones must still be several distinct shapes, painted,
// and each drawn to the collider the generator built for it.
test('boulders are several distinct stones, not one icosahedron repeated',()=>{
 const {world,meshes}=build();
 const stones=meshes.filter(m=>/^Blender_Boulder/.test(m.userData.model||'')&&m.userData.role==='stone'&&m.count>0);
 assert(stones.length>1,`rocks collapsed back to ${stones.length} shape(s)`);
 assert.equal(new Set(stones.map(m=>m.geometry.uuid)).size,stones.length,'stone meshes share a geometry');
 assert(stones.every(m=>m.geometry.attributes.color),'the boulders carry their paint');
 // Drawn where they collide: a stone's top is its collider's top.
 const bbox=new T.Box3(),inst=new T.Matrix4(),p=new T.Vector3();
 for(const m of stones){
  m.geometry.computeBoundingBox();
  for(let i=0;i<Math.min(m.count,20);i++){
   m.getMatrixAt(i,inst);p.setFromMatrixPosition(inst);
   const top=bbox.copy(m.geometry.boundingBox).applyMatrix4(inst).max.y;
   const r=world.rocks.reduce((b,q)=>Math.hypot(q.x-p.x,q.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?q:b);
   assert(Math.abs(top-r.top)<.25*r.scale+.05,`a stone drawn to ${top.toFixed(2)} m collides to ${r.top.toFixed(2)} m`);
  }
 }
});

test('a stand of conifers draws on several models and varies each one',()=>{
 const {world,view}=build();
 const conifers=new Set(world.trees.filter(t=>['pine','spruce','cedar'].includes(t.kind)));
 assert(conifers.size>20,'this fixture needs a forest');
 // Imported geometry supplies the shape now, so variety lives in which model a
 // tree is, how it is scaled and how it is tinted -- not in a tier formula.
 const shapes=new Map(),byOwner=new Map(),tints=new Set();
 const scale=new T.Vector3(),quat=new T.Quaternion(),pos=new T.Vector3(),colour=new T.Color();
 for(const inst of view.treeInstances){
  if(!inst.owners)continue;
  const coniferIndex=inst.owners.map((o,i)=>[o,i]).filter(([o])=>conifers.has(o));
  if(!coniferIndex.length)continue;
  for(const [owner,i] of coniferIndex){
   inst.matrices[i].decompose(pos,quat,scale);
   (shapes.get(owner)||shapes.set(owner,new Set()).get(owner)).add(inst.mesh.geometry.uuid);
   byOwner.set(owner,`${inst.mesh.geometry.uuid}|${scale.x.toFixed(3)}|${scale.y.toFixed(3)}`);
   if(inst.mesh.instanceColor){inst.mesh.getColorAt(i,colour);tints.add(colour.getHexString());}
  }
 }
 assert(shapes.size>20,`only ${shapes.size} conifers were drawn from models`);
 // More than one source model, or it is one silhouette again by another route.
 const geometries=new Set();for(const set of shapes.values())for(const g of set)geometries.add(g);
 assert(geometries.size>2,`conifers drew on only ${geometries.size} geometr(ies)`);
 // Girth against height varies per tree, so no two are the same proportion.
 const profiles=[...byOwner.values()];
 assert(new Set(profiles).size/profiles.length>.9,`only ${new Set(profiles).size} distinct model+size signatures across ${profiles.length} conifers`);
 assert(tints.size>10,`only ${tints.size} distinct tints`);
});

test('every biome builds its vegetation, models and procedural alike',()=>{
 // The desert is the case that matters here: its species split across imported
 // cacti, imported arid trees, and ocotillo and agave that stay procedural.
 for(const biome of ['pnw','mountain','desert','links','midwest','island','autumn','haunted']){
  const world=generateWorld({seed:'BIOMES',biome,holes:9,trees:55,water:20});
  const view={world,style:'cartoon',group:new T.Group(),treeInstances:[],quality:{foliage:1,grass:1},resources:[]};
  assert.doesNotThrow(()=>addVegetation(view),`${biome} failed to build`);
  const kinds=new Set(world.trees.map(t=>t.kind));
  assert(kinds.size>0,`${biome} grew no trees`);
  let drawn=0;view.group.traverse(o=>{if(o.isInstancedMesh)drawn+=o.count;});
  assert(drawn>0,`${biome} produced no instances`);
  // Nothing may be silently dropped: every tree has to be owned by something.
  const owned=new Set();
  for(const inst of view.treeInstances)for(const o of inst.owners||[])owned.add(o);
  const missed=world.trees.filter(t=>!owned.has(t));
  assert.equal(missed.length,0,`${biome} left ${missed.length} trees undrawn (${[...new Set(missed.map(t=>t.kind))].join(', ')})`);
 }
});

test('houses are drawn from imported models fitted to the box physics collides with',()=>{
 const world=generateWorld({seed:'HOMES-QA',biome:'midwest',holes:9,homes:true,homeDensity:100,trees:0,water:0});
 assert(world.homes.length>0,'this fixture needs houses');
 const view={world,style:'cartoon',group:new T.Group(),treeInstances:[],quality:{foliage:1,grass:1},resources:[]};
 addHomes(view);
 const meshes=[];view.group.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});
 assert(meshes.length>0,'no instanced buildings were created');
 // The cartoon overhaul's houses (tools/blender/cartoon_houses.py) are painted
 // models of four parts each -- walls, roof, trim, glass -- one mesh per part;
 // a house is counted once, by its walls, and measured by its whole model.
 const buildings=meshes.filter(m=>String(m.userData.model).startsWith('Blender_House')&&m.userData.role==='stone');
 assert(new Set(buildings.map(m=>m.userData.model)).size>1,`houses drew from only ${buildings.length} model(s)`);
 const placed=buildings.reduce((n,m)=>n+m.count,0);
 assert.equal(placed,world.homes.length,`${placed} buildings drawn for ${world.homes.length} homes`);
 const whole=new Map();
 for(const m of meshes.filter(m=>String(m.userData.model).startsWith('Blender_House'))){
  const b=whole.get(m.userData.model)??new T.Box3();m.geometry.computeBoundingBox();
  // The collider is the WALLS' footprint and the house's full height: the
  // eaves, their trim boards and a porch roof overhang it by design (homes.js).
  const g=m.geometry.boundingBox,walls=m.userData.role==='stone';
  b.expandByPoint(new T.Vector3(walls?g.min.x:0,g.min.y,walls?g.min.z:0));
  b.expandByPoint(new T.Vector3(walls?g.max.x:0,g.max.y,walls?g.max.z:0));whole.set(m.userData.model,b);
 }
 // What is drawn has to match the oriented box simulateShot resolves against,
 // or the ball bounces off something that is not where the house looks.
 const scale=new T.Vector3(),quat=new T.Quaternion(),pos=new T.Vector3();
 let checked=0;
 for(const mesh of buildings){
  const m=new T.Matrix4();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,m);m.decompose(pos,quat,scale);
   const box=whole.get(mesh.userData.model);
   // The walls' middle, in the world, is the home's: the model's origin is
   // shifted by the walls' own offset (homes.js wallExtents).
   const mid=box.getCenter(new T.Vector3());mid.y=0;mid.applyMatrix4(m);
   const home=world.homes.find(h=>Math.hypot(h.x-mid.x,h.z-mid.z)<.05);
   assert(home,'a building stands where no home was generated');
   const width=(box.max.x-box.min.x)*scale.x,depth=(box.max.z-box.min.z)*scale.z,height=(box.max.y-box.min.y)*scale.y;
   assert(Math.abs(width-home.width)<.6,`drawn width ${width.toFixed(2)} vs collider ${home.width.toFixed(2)}`);
   assert(Math.abs(depth-home.depth)<.6,`drawn depth ${depth.toFixed(2)} vs collider ${home.depth.toFixed(2)}`);
   assert(Math.abs(height-home.height)<.6,`drawn height ${height.toFixed(2)} vs collider ${home.height.toFixed(2)}`);
   checked++;
  }
 }
 assert(checked>5,`only ${checked} buildings checked`);
});

// THE CARRY (round 8 of the far-landscape goal's shared fairways): the ground
// a tee shot carries, between the tee and its fairway inside the corridor,
// keeps its grass short so the golfer sees the fairway; it grows back over
// CARRY_EDGE m outside, and the fairway itself is no carry.
test("a tee shot's carry is kept clear of tall grass, and only the carry",()=>{
 const w=generateWorld({seed:'overhaul',biome:'links',holes:9});
 const inCarry=carryFade(w);
 for(const h of w.holes){
  const z=(h.mowStart??h.fairwayStart??22)*.6,c=h.toWorld({x:h.center(z),z});
  assert.equal(inCarry(c.x,c.z),0,`hole ${h.hole+1}: the middle of the carry is not clear`);
  // Beside the carry, and on the fairway, wherever no other hole's carry
  // reaches (one hole's tee shot may cross another's fairway).
  const free=q=>w.holes.filter(o=>o!==h).every(o=>{const p=o.toLocal(q);return p.z>(o.mowStart??o.fairwayStart??22)||p.z<-30||Math.abs(p.x-o.center(Math.max(0,p.z)))>o.width(Math.max(0,p.z))+CARRY_EDGE;});
  const out=h.toWorld({x:h.center(z)+h.width(z)+CARRY_EDGE+2,z});
  if(free(out))assert.equal(inCarry(out.x,out.z),1,`hole ${h.hole+1}: past the carry's edge is still held short`);
  // Past the mown start (a par 3's carry runs most of the way to its green).
  const zf=((h.mowStart??h.fairwayStart??22)+h.length)/2,fw=h.toWorld({x:h.center(zf),z:zf});
  if(free(fw))assert.equal(inCarry(fw.x,fw.z),1,`hole ${h.hole+1}: its fairway counts as carry`);
 }
});
