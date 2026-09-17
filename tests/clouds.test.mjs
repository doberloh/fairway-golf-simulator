import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {generateWorld} from '../src/course.js';
import {makeClouds, MAX_CLOUDS} from '../src/clouds.js';

const build = () => {
 const world = generateWorld({seed:'CLOUDS', biome:'midwest', holes:9, trees:0, water:0, wind:8, windDirection:90});
 return {world, clouds: makeClouds({world}, world.seed)};
};

test('clouds exist as real objects with matching shadow discs',()=>{
 const {clouds}=build();
 assert.equal(clouds.clouds.length,MAX_CLOUDS);
 assert.equal(clouds.discs.length,MAX_CLOUDS);
 // Every cloud is a cluster, not one lump.
 let meshes=0;clouds.group.traverse(o=>{if(o.isInstancedMesh)meshes++;});
 assert(meshes>0,'no cloud mesh was built');
 // A disc has to sit on its cloud and share its radius, or the shadow belongs
 // to nothing you can see.
 clouds.clouds.forEach((cloud,i)=>{
  const disc=clouds.discs[i];
  assert(Math.abs(disc.x-cloud.x)<1e-6&&Math.abs(disc.z-cloud.z)<1e-6,'disc is not on its cloud');
  assert.equal(disc.w,cloud.radius);
  assert(cloud.radius>100,'a cloud that small would cast nothing');
  assert(disc.y>200,'clouds belong in the sky');
 });
});

test('clouds actually move, and keep moving in the wind direction',()=>{
 const {clouds}=build();
 const before=clouds.clouds.map(c=>({x:c.x+(c.driftX||0),z:c.z+(c.driftZ||0)}));
 // Ten seconds. The rejected noise field took about three minutes to shift one
 // cloud width, which is why it read as static.
 for(let i=0;i<600;i++)clouds.update(1/60);
 const after=clouds.clouds.map(c=>({x:c.x+c.driftX,z:c.z+c.driftZ}));
 const moved=before.map((b,i)=>Math.hypot(after[i].x-b.x,after[i].z-b.z));
 // Wind of 8 puts drift around 22 m/s, so ten seconds is a couple of hundred
 // metres -- a visible fraction of a cloud, not a creep.
 assert(moved.every(d=>d>80),`a cloud moved only ${Math.min(...moved).toFixed(0)} m in ten seconds`);
 // The discs follow, since they are the same vectors the shader reads.
 clouds.clouds.forEach((cloud,i)=>{
  assert(Math.abs(clouds.discs[i].x-(cloud.x+cloud.driftX))<1e-6,'a disc fell behind its cloud');
 });
});

test('clouds wrap instead of drifting away for ever',()=>{
 const {world,clouds}=build();
 // Half an hour of wind: without wrapping they would be tens of kilometres off.
 for(let i=0;i<108000;i++)clouds.update(1/60);
 const span=world.halfX+2600+1;
 for(const cloud of clouds.clouds){
  const x=cloud.x+cloud.driftX,z=cloud.z+cloud.driftZ;
  assert(Math.abs(x)<=span*1.02&&Math.abs(z)<=(world.halfZ+2600)*1.02,
   `a cloud escaped to ${x.toFixed(0)}, ${z.toFixed(0)}`);
 }
});

test('a shadow lands where the sun throws it, not under the cloud',()=>{
 // Mirrors cloudShadowAt in cloud-shadows.js: the ground point whose sun ray
 // reaches the cloud's altitude is the one in shade.
 const sun=new T.Vector3(-.6,.7,-.5).normalize();
 const cloud={x:400,y:640,z:-200,radius:300};
 const shadeAt=(x,z)=>{
  const world=new T.Vector3(x,0,z);
  const t=(cloud.y-world.y)/Math.max(sun.y,.08);
  const hx=world.x+sun.x*t, hz=world.z+sun.z*t;
  return Math.hypot(hx-cloud.x,hz-cloud.z)/cloud.radius;
 };
 // Directly beneath the cloud is NOT the darkest point when the sun is low.
 const beneath=shadeAt(cloud.x,cloud.z);
 const t=cloud.y/sun.y;
 const offset=shadeAt(cloud.x-sun.x*t,cloud.z-sun.z*t);
 assert(offset<beneath,'the shadow should be offset along the sun direction');
 assert(offset<.001,'the offset point should be dead centre of the shadow');
 assert(beneath>1,'directly beneath should fall outside this shadow entirely');
});
