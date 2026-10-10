import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {generateWorld} from '../src/course.js';
import {addVegetation} from '../src/vegetation.js';
import {addHomes} from '../src/homes.js';

const build=(settings={})=>{
 const world=generateWorld({seed:'VARIETY',biome:'pnw',holes:9,trees:70,water:20,...settings});
 const view={world,style:'cartoon',group:new T.Group(),treeInstances:[],quality:{foliage:1,grass:1},resources:[]};
 addVegetation(view);
 const meshes=[];view.group.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});
 return {world,view,meshes};
};

test('boulders are several distinct stones, not one icosahedron repeated',()=>{
 const {meshes}=build();
 // The stones are non-indexed icosahedra: twenty faces, sixty vertices.
 const stones=meshes.filter(m=>!m.geometry.index&&m.geometry.attributes.position.count===60&&m.count>0);
 assert(stones.length>1,`rocks collapsed back to ${stones.length} shape(s)`);
 // Equal vertex counts are not equal shapes, so compare the actual vertex rings.
 const signature=m=>{const p=m.geometry.attributes.position;let sum=0;
  for(let i=0;i<p.count;i++)sum+=Math.hypot(p.getX(i),p.getY(i),p.getZ(i));return (sum/p.count).toFixed(5);};
 assert.equal(new Set(stones.map(signature)).size,stones.length,'stone meshes share a geometry');
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
 // Buildings are the textured ones; the nature models keep no UVs.
 const buildings=meshes.filter(m=>m.geometry.attributes.uv);
 assert(buildings.length>1,`houses drew from only ${buildings.length} model(s)`);
 const placed=buildings.reduce((n,m)=>n+m.count,0);
 assert.equal(placed,world.homes.length,`${placed} buildings drawn for ${world.homes.length} homes`);
 // What is drawn has to match the oriented box simulateShot resolves against,
 // or the ball bounces off something that is not where the house looks.
 const scale=new T.Vector3(),quat=new T.Quaternion(),pos=new T.Vector3(),box=new T.Box3();
 let checked=0;
 for(const mesh of buildings){
  const m=new T.Matrix4();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,m);m.decompose(pos,quat,scale);
   box.setFromBufferAttribute(mesh.geometry.attributes.position);
   const home=world.homes.find(h=>Math.hypot(h.x-pos.x,h.z-pos.z)<.01);
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
