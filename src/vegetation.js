import {cameraInsideTree} from './camera-tours.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from './course.js';
import {FAMILY_OF,familyModels,modelRadius,instanceModels} from './mesh-assets.js';
import {onShoreBank} from './streams.js';
import {GROUND_PLANTS} from './species.js';
import {launchCorridors,blocksLaunch} from './course.js';
import {windMaterial,toonRamp} from './textures.js';
import {biomeOf} from './biomes.js';
const UP=new T.Vector3(0,1,0);
function barkTexture(kind){const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d'),rng=random('bark-'+kind);ctx.fillStyle='#b7b3a5';ctx.fillRect(0,0,128,256);for(let i=0;i<220;i++){const v=80+rng()*95;ctx.fillStyle=`rgb(${v},${v},${v})`;const x=rng()*128,y=rng()*256;ctx.fillRect(x,y,kind==='palm'||kind==='hala'?16+rng()*60:1+rng()*3,kind==='palm'||kind==='hala'?1+rng()*2:5+rng()*40);}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,5);return t;}
function texture(kind){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),rng=random('foliage-'+kind);ctx.clearRect(0,0,256,256);
 if(kind==='pine'){
  // Layered sprays of short needles form a branch, with gaps between twigs.
  ctx.strokeStyle='#6c7066';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(128,248);ctx.lineTo(128,16);ctx.stroke();
  for(let i=0;i<34;i++){const y=24+i*6.1,span=(y/240)*102*(.78+rng()*.22);for(const side of [-1,1]){
   const ex=128+side*span,ey=y-22;ctx.strokeStyle='#858c7b';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(128,y+12);ctx.lineTo(ex,ey);ctx.stroke();
   for(let j=0;j<24;j++){const f=j/24,x=128+(ex-128)*f,yy=y+12+(ey-y-12)*f;for(const dir of [-1,1]){const v=145+rng()*70;ctx.strokeStyle=`rgb(${v},${v},${v})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+side*(5+rng()*9),yy+dir*(4+rng()*8));ctx.stroke();}}
  }}
 }else{
  for(let i=0;i<200;i++){const a=rng()*Math.PI*2,r=Math.sqrt(rng())*108,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;ctx.save();ctx.translate(x,y);ctx.rotate(rng()*6.28);const v=140+Math.floor(rng()*115);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.beginPath();ctx.ellipse(0,0,5+rng()*9,3+rng()*5,0,0,7);ctx.fill();ctx.restore();}
 }
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
// Imported CC0 geometry stands in wherever the packs cover a species. Shape now
// comes from a real model, but everything that makes a stand look like a place
// rather than a stamp -- which model, its height and girth, its lean, its tint --
// is still drawn per tree, the same way the procedural shapes do it.
// Ground cover sized by its SPREAD rather than its height. A sword fern is a
// low clump about a metre and a half across and its fronds reach further
// sideways than up, so scaling it to t.h the way a tree is scaled gives a
// ten-metre bush.
const SPREAD_SIZED=new Set(['swordfern','salal','sorrel','fern']);

// NO LEVEL OF DETAIL, BECAUSE IT WAS MEASURED UNNECESSARY.
//
// This drew each species twice and swapped by camera distance, on the
// reasoning that 25 million vertices could not be affordable against the 3.7
// million the course used to cost. That reasoning was arithmetic, not a
// benchmark.
//
// The first benchmark was not one either. It timed the render call and read
// 8.6 ms with the swap on, 9.1 ms with every tree at full detail -- which
// looked like a real if small cost, and was in fact the 120 Hz vsync interval
// (8.33 ms) in both cases. The renderer was waiting for the display, not for
// the geometry, so the measurement could only ever return the refresh rate.
// THAT IS THE SIXTH METRIC IN THIS PROJECT TO ANSWER A DIFFERENT QUESTION
// THAN THE ONE ASKED; before trusting a number here, check that it can move.
//
// Measured properly -- frame pacing over 240 frames against the scene's own
// vertex count -- a grown redwood course draws 33.6 M vertices and 98 M
// triangles per frame and still holds the 120 Hz cap. Instanced vertices are
// close to free on this path. The swap bought nothing measurable and cost the
// one thing that showed: at any moment nearly every visible tree was the
// thinned twin, so the forest looked dead, and the boundary popped.
//
// The generator still bakes `_Far` twins (tools/grow.mjs, LOD.far) and they
// are simply not ingested. If this ever needs to come back for weaker
// hardware, the models are one PICK entry away -- but measure on that
// hardware, with a metric that is allowed to say "free".
// ROUGH GRASS (the owner, after U8: "not a huge fan of the 5 2D tufts in a
// circle"). A clump of blades from one root, each tapering from a base to a
// point in two segments and curving outward as it rises, at uneven angles and
// heights so no two neighbours in the clump match and nothing reads as a ring.
// The shape is seeded per course, then rotated and sized per instance.
// Three triangles a blade; seven blades is 21 a clump against the old 5.
function grassClump(blades,seed){
 const rng=random(seed),pos=[],shade=[];
 for(let i=0;i<blades;i++){
  const a=i*2.399+(rng()-.5)*1.3,ca=Math.cos(a),sa=Math.sin(a),r0=rng()*.05,bx=ca*r0,bz=sa*r0;
  const h=.55+rng()*.45,lean=.06+rng()*.2,w=.03+rng()*.02,px=-sa,pz=ca;
  // A point up the blade at t (0 root, 1 tip): rises, and curves outward with t squared.
  const at=t=>[bx+ca*lean*h*t*t,h*t,bz+sa*lean*h*t*t];
  const b=at(0),m=at(.55),t=at(1),mw=w*.65;
  const L=[b[0]-px*w,b[1],b[2]-pz*w],R=[b[0]+px*w,b[1],b[2]+pz*w],ML=[m[0]-px*mw,m[1],m[2]-pz*mw],MR=[m[0]+px*mw,m[1],m[2]+pz*mw];
  pos.push(...L,...R,...MR,...L,...MR,...ML,...ML,...MR,...t);
  shade.push(.62,.62,.86,.62,.86,.86,.86,.86,1.12);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 groundShaded(g,shade);
 return g;
}
// Lit like the ground it grows from: every normal straight up, so a blade takes
// the same light and shade as the turf under it rather than going dark
// whenever it faces away from the sun -- a thin toon-shaded triangle facing
// the wrong way is what made the old tufts read as scratches. And darker at the
// root than the tip, through vertex colour (times the instance's own colour),
// which is most of what makes a clump read as grass.
function groundShaded(geometry,shade){
 const n=geometry.attributes.position.count,normals=new Float32Array(n*3),colors=new Float32Array(n*3);
 for(let i=0;i<n;i++){normals[i*3+1]=1;const s=shade[i]??1;colors[i*3]=colors[i*3+1]=colors[i*3+2]=s;}
 geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));
}
// DoubleSide flips the normal of a back face, which would turn half of every
// clump's blades to face the ground. These keep the normal they were given.
function groundLit(material){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.customProgramCacheKey=()=>key.call(material)+'-groundlit';
 material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(vNormal);');};
 return material;
}
// Stiffer in a wind than a broadleaf: needled boughs on a heavy leader.
const CONIFERS=new Set(['redwood','dougfir','hemlock','redcedar','pine','spruce','cedar']);
// Rigid: a cactus is a column of water in a skin, and an agave's leaves are
// stiff blades. Neither moves in any wind a round of golf is played in.
const STILL=new Set(['cactus','agave']);
function addModelSpecies(view,kind,trees){
 const {world,group}=view,rng=random(world.seed+':models:'+kind);
 const models=familyModels(FAMILY_OF[kind]);
 if(!models.length)return false;
 const shades={cedar:'#35694a',pine:'#4a7041',spruce:'#2c5349',aspen:'#91ac58',maple:'#658d36',alder:'#64833d',oak:'#487039',palm:'#5f8f4a',cactus:'#6f8f5e',shrub:'#5d7a43',gorse:'#7f8d3f',heather:'#8a7596',naupaka:'#428546',fern:'#4a7b4a'};
 const leafBase=new T.Color(shades[kind]||'#5b7f44'),barkBase=new T.Color(kind==='aspen'?'#d5d2b5':'#6b5942');
 const stone=new T.Color(world.bio.rock||'#8a8577'),dirt=new T.Color(world.bio.rough||'#7e8a5a');
 const dummy=new T.Object3D();dummy.rotation.order='YXZ';
 const entries=[];
 for(const t of trees){
  // Which model this tree is, decided once and stably per tree.
  const model=models[Math.floor(rng()*models.length)];
  // Height and girth are the tree's own; the model is unit height, and its
  // native radius is divided out so t.r still means what it always meant.
  // Scale by height and keep the model's own proportions. Forcing the width to
  // t.r made a saguaro as wide as it was tall: t.r is a foliage radius, and the
  // procedural cactus never used it either -- it drew a fixed narrow column.
  // Nothing downstream depends on the visual width, because trunkRadius() in
  // physics derives collision from height, not from t.r.
  const lift=.88+rng()*.26,girth=.86+rng()*.28;
  // GROUND COVER IS SIZED BY ITS SPREAD, NOT ITS HEIGHT. A sword fern is a low
  // clump about a metre and a half across, and `Fern_1`'s fronds reach nearly
  // twice its height sideways -- so scaling it to t.h the way a tree is scaled
  // gave a ten-metre bush. t.r is the spread these were given; use it, and let
  // the height follow the model's own proportions.
  // The bush family still sizes by height. It probably should not either, but
  // six biomes draw from it and that is a change to look at on its own.
  const spread=SPREAD_SIZED.has(FAMILY_OF[kind])?t.r/modelRadius(model)*lift:0;
  const sy=spread||t.h*lift,sxz=spread||sy*girth;
  dummy.position.set(t.x,t.y,t.z);
  dummy.rotation.set((rng()-.5)*.10,rng()*6.28,(rng()-.5)*.10);
  dummy.scale.set(sxz,sy,sxz);
  dummy.updateMatrix();
  const leaf=leafBase.clone();
  if(biomeOf(world.settings.biome).leafFall&&kind!=='spruce')leaf.setHSL((kind==='maple'?.0:kind==='aspen'?.11:.055)+t.shade*.035,.62+t.shade*.18,.35+t.shade*.12);
  else leaf.offsetHSL((rng()-.5)*.045,(rng()-.5)*.12,(rng()-.5)*.10);
  entries.push({model,owner:t,matrix:dummy.matrix.clone(),
   color:{leaf,bark:barkBase.clone().offsetHSL(0,(rng()-.5)*.10,(rng()-.5)*.10),stone,dirt,accent:leaf}});
 }
 // White materials: the instance colour carries the whole tint, so one material
 // per role serves every biome.
 const materials=new Map();
 // The whole plant bends in the wind, more at the top than the bottom (U2 in
 // TODO, and the owner's follow-up): bark and leaves take the same bend so the
 // crown stays on its trunk, the leaves flutter on top. Stones and soil at the
 // foot stay put. The bend grows with the square of height, so where a ball
 // can reach a trunk it has moved a few millimetres at most, and the trunk
 // physics collides with still agrees with the one drawn. A cactus does not
 // move at all.
 const sway=STILL.has(kind)?0:CONIFERS.has(kind)?.7:1;
 const materialFor=role=>{
  if(!materials.has(role))materials.set(role,sway&&['leaf','bark','accent'].includes(role)
   ?windMaterial(new T.MeshToonMaterial({color:'#ffffff'}),view,sway,false,true,role!=='bark')
   :new T.MeshToonMaterial({color:'#ffffff'}));
  return materials.get(role);
 };
 instanceModels(group,entries,materialFor,({mesh,matrices,owners})=>{
  const hidden=new Uint8Array(matrices.length);mesh.userData.cullHidden=hidden;
  view.treeInstances.push({mesh,matrices,owners,hidden});
 });
 return true;
}
// The drawn cylinder with a borrowed crown balanced on top is GONE. It
// existed because no pack contained a bare-boled giant; tools/grow.mjs now
// produces whole redwoods -- fluted trunk, buttressed foot, branch structure
// and plume in one model -- so there is nothing left to fake.

function addSpecies(view,kind,trees){
 // Imported geometry where the packs have a counterpart, procedural everywhere
 // else -- the desert species have none, and a wrong silhouette is worse than a
 // simple one.
 if(FAMILY_OF[kind]&&addModelSpecies(view,kind,trees))return;

 const {world,style,group}=view,rng=random(world.seed+':details:'+kind),real=style==='realistic',toon=style==='cartoon',blue=style==='blueprint',flat=style==='lowpoly';
 const dummy=new T.Object3D(),color=new T.Color();dummy.rotation.order='YXZ';
 const mat=(c,opts={})=>{const{flatShading,...toonOpts}=opts;return new (toon?T.MeshToonMaterial:T.MeshStandardMaterial)({color:c,...(toon?{}:{roughness:.92}),...(toon?toonOpts:opts)});};
 const materials={bark:mat(blue?'#9dc9c4':kind==='aspen'?'#d5d2b5':kind==='palo'?'#698149':['palm','hala'].includes(kind)?'#93876a':'#6b5942'),leaf:mat('#ffffff',{side:T.DoubleSide,flatShading:flat})};
 if(real)materials.bark.map=barkTexture(kind);
 // The whole tree bends as one, the same way the imported ones do: trunk,
 // branches and leaves all bend about the tree's own root (`treeRoot`, filled
 // in `instance` below), so a leaf piece never parts from its branch.
 if(!STILL.has(kind)){const s=['pine','spruce','cedar'].includes(kind)?.7:1;windMaterial(materials.bark,view,s,false,true,false,true);windMaterial(materials.leaf,view,s,false,true,true,true);}
 let trunkMatrices=[],branchMatrices=[],leafMatrices=[],leafColors=[],trunkOwners=[],branchOwners=[],leafOwners=[],currentTree;
 const branch=(a,b,r1,r2=r1)=>{dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());dummy.scale.set(r1,a.distanceTo(b),r2);dummy.updateMatrix();branchMatrices.push(dummy.matrix.clone());branchOwners.push(currentTree);};
 const leaf=(x,y,z,sx,sy,sz,rotation,tint)=>{dummy.position.set(x,y,z);dummy.rotation.set(...rotation);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();leafMatrices.push(dummy.matrix.clone());leafColors.push(tint.clone());leafOwners.push(currentTree);};
 for(const t of trees){currentTree=t;
  const shades={cedar:'#35694a',pine:'#4a7041',spruce:'#2c5349',aspen:'#91ac58',maple:'#658d36',alder:'#64833d',oak:'#487039',palo:'#8d9a47',mesquite:'#6c804b',ocotillo:'#7c8050',agave:'#7caa9b',naupaka:'#428546',hala:'#678f3d',gorse:'#718347',heather:'#79627c'};const tint=new T.Color(blue?'#a3d6cf':shades[kind]||world.bio.tree).multiplyScalar(.8+t.shade*.4);
  if(biomeOf(world.settings.biome).leafFall&&kind!=='spruce')tint.setHSL((kind==='maple'?.0:kind==='aspen'?.11:.055)+t.shade*.035,.62+t.shade*.18,.35+t.shade*.12);
  // Every tree used to stand perfectly upright on a trunk of identical
  // proportion, which is half of why a stand reads as one asset repeated.
  const leanX=(rng()-.5)*.085,leanZ=(rng()-.5)*.085,girth=.021+rng()*.013;
  const trunkHeight=real&&(['pine','spruce','cedar'].includes(kind))?.80:.92;dummy.position.set(t.x,t.y+t.h*trunkHeight/2,t.z);dummy.rotation.set(leanX,t.shade*6.28,leanZ);dummy.scale.set(t.h*girth,t.h*trunkHeight,t.h*girth);dummy.updateMatrix();if(!['fern','gorse','heather','agave','ocotillo','naupaka','shrub'].includes(kind)){trunkMatrices.push(dummy.matrix.clone());trunkOwners.push(t);}
  if(['pine','spruce','cedar'].includes(kind)){
   if(real){
    // Individual branch clusters give conifers a broken, needled silhouette.
    for(let layer=0;layer<9;layer++){const f=layer/9,y=t.y+t.h*(.23+f*.7),radius=t.r*(1-f)*1.05+.25;
     for(let j=0;j<6;j++){const a=j*Math.PI/3+layer*2.399+t.shade*5,len=radius*(.8+rng()*.25),bx=t.x+Math.cos(a)*len,bz=t.z+Math.sin(a)*len;
      if(layer<6)branch(new T.Vector3(t.x,y+.3,t.z),new T.Vector3(bx,y-.35,bz),.028);
      for(const tilt of kind==='cedar'?[-.45,.12]:[-1.12,-.48])leaf(t.x+Math.cos(a)*len*.55,y,bz-Math.sin(a)*len*.45,len*1.35,len*1.6,1,[tilt,-a-Math.PI/2,0],tint.clone().multiplyScalar(.98+rng()*.3));
     }
    }
   }else{
    // One formula for every conifer gave every pine the same five tiers, the
    // same taper and the same canopy: a stand of them read as one cone stamped
    // repeatedly. Tier count, taper, where the canopy starts, how far it runs
    // and how deep each tier sits are now drawn per tree, and the canopy
    // follows the trunk's lean so the two stay attached.
    const tiers=toon?4+Math.floor(rng()*4):3,taper=.62+rng()*.30,
     base=.26+rng()*.15,span=.46+rng()*.24,depth=(.36+rng()*.20)*t.h,twist=rng()*6.28;
    for(let j=0;j<tiers;j++){
     const f=tiers>1?j/tiers:0,y=t.h*(base+f*span),wobble=.90+rng()*.20,
      w=Math.max(.25,t.r*(1-f*taper)*wobble);
     leaf(t.x+leanZ*y,t.y+y,t.z-leanX*y,w,depth,w,[0,twist+j*.8,0],tint.clone().multiplyScalar(.94+rng()*.12));
    }
   }
  }else if(['palm','hala'].includes(kind)){
   if(kind==='hala')for(let j=0;j<5;j++){const a=j*6.28/5;branch(new T.Vector3(t.x+Math.cos(a)*t.r*.5,t.y,t.z+Math.sin(a)*t.r*.5),new T.Vector3(t.x,t.y+t.h*.4,t.z),.14);}
   // Arching central ribs with paired individual leaflets, not disc canopies.
   const crown=t.y+t.h*.93;
   for(let j=0;j<12;j++){const a=j*6.28/12+t.shade*4,len=t.r*(j<8?1.8:1.25),points=[];for(let k=0;k<=16;k++){const f=k/16;points.push(new T.Vector3(t.x+Math.cos(a)*len*f,crown+Math.sin(f*Math.PI)*len*.32-f*f*len*(j<8?.65:.15),t.z+Math.sin(a)*len*f));}
    for(let k=0;k<16;k++)branch(points[k],points[k+1],.045);
    for(let k=1;k<16;k++){const f=k/16,p=points[k],span=Math.sin(f*Math.PI)*len*.32+.15;for(const side of [-1,1])leaf(p.x+Math.cos(a+side*1.15)*span*.4,p.y-.1,p.z+Math.sin(a+side*1.15)*span*.4,span,.08,.42,[side*.3,-a-side*1.15,-.48],tint.clone().multiplyScalar(.8+rng()*.4));}
   }
  }else if(kind==='ocotillo'){
   for(let j=0;j<11;j++){const a=j*2.399,len=t.h*(.65+rng()*.35),p=new T.Vector3(t.x+Math.cos(a)*len*.35,t.y+len,t.z+Math.sin(a)*len*.35);branch(new T.Vector3(t.x,t.y,t.z),p,.035);leaf(p.x,p.y,p.z,.09,.22,.09,[0,0,0],new T.Color(blue?'#9cf2d4':'#d9673e'));}
  }else if(kind==='agave'||kind==='fern'){
   for(let j=0;j<16;j++){const a=j*2.399,f=j/16,r=t.r*(.45+f*.7);leaf(t.x+Math.cos(a)*r*.35,t.y+t.h*(.3+.3*(1-f)),t.z+Math.sin(a)*r*.35,kind==='agave'?r*.25:r*.8,r*1.6,1,[-1.1+f*.7,-a,0],tint);}
  }else if(kind==='cactus'){
   leaf(t.x,t.y+t.h*.48,t.z,.8,t.h*.5,.8,[0,0,0],tint);
   for(let j=0;j<2;j++){const side=j?1:-1,y=t.y+t.h*(.4+j*.15),x=t.x+side*1.4;branch(new T.Vector3(t.x,y,t.z),new T.Vector3(x,y+.2,t.z),.33);leaf(x,y+t.h*.15,t.z,.38,t.h*.17,.38,[0,0,0],tint);}
  }else{
   // The tier expands the cartoon canopy rather than switching art direction:
   // more clusters of the same shapes, never a different look.
   const detail=view.quality?.foliage??1;
   const count=Math.max(3,Math.round((real?(kind==='aspen'?26:42):toon?14:6)*detail));
   // Blob placement was already random, but every canopy shared one envelope:
   // same radius, same height, same blob size. These vary the envelope itself.
   const blobScale=.78+rng()*.44,spread=.82+rng()*.40,lift=.92+rng()*.20;
   for(let j=0;j<count;j++){const a=j*2.399,r=Math.sqrt(rng())*t.r*spread,x=t.x+Math.cos(a)*r,z=t.z+Math.sin(a)*r,y=t.y+t.h*lift*(['shrub','gorse','heather','naupaka'].includes(kind)?.32:kind==='aspen'?.5:.62)+Math.sqrt(Math.max(0,1-r*r/(t.r*t.r)))*t.h*(kind==='aspen'?.36:.22)+(rng()-.5)*t.h*.15;
    const size=t.r*(real?.8:.68)*blobScale;leaf(x,y,z,size*1.5,size,real?1:size,[real?(rng()-.5)*1.2:0,rng()*6.28,real?(rng()-.5)*.8:0],tint.clone().multiplyScalar(.75+rng()*.5));
    if(j<10&&!['shrub','gorse','heather','naupaka'].includes(kind))branch(new T.Vector3(t.x,t.y+t.h*.5,t.z),new T.Vector3(x,y,z),.14);
   }
  }
 }
 const instance=(geo,material,matrices,colors,cast=true)=>{if(!matrices.length){geo.dispose();return;}const mesh=new T.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors)mesh.setColorAt(i,colors[i]);});const owners=matrices===trunkMatrices?trunkOwners:matrices===branchMatrices?branchOwners:leafOwners;if(material===materials.bark||material===materials.leaf){const root=new Float32Array(owners.length*4);owners.forEach((t,i)=>root.set([t.x,t.y,t.z,t.h],i*4));geo.setAttribute('treeRoot',new T.InstancedBufferAttribute(root,4));}const hidden=new Uint8Array(matrices.length);mesh.userData.cullHidden=hidden;view.treeInstances.push({mesh,matrices,owners,hidden});mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;};
 const trunkGeo=new T.CylinderGeometry(.62,1,1,real?12:Math.max(5,Math.round(6*(view.quality?.foliage??1))),['palm','hala'].includes(kind)?12:1);if(['palm','hala'].includes(kind)){const p=trunkGeo.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+Math.sin((p.getY(i)+.5)*Math.PI)*1.8);trunkGeo.computeVertexNormals();}instance(trunkGeo,materials.bark,trunkMatrices);
 instance(new T.CylinderGeometry(.65,1,1,5),kind==='cactus'?mat(world.bio.tree):materials.bark,branchMatrices,null,real);
 let leafGeo;
 if(kind==='agave'){leafGeo=finishBlade();}
 else if(kind==='ocotillo'){leafGeo=new T.IcosahedronGeometry(1,1);}
 else if(['palm','hala'].includes(kind)){leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,0,.08,.8,1,0,0,0,.08,-.8],3));leafGeo.setIndex([0,1,2,0,2,3]);leafGeo.computeVertexNormals();}
 else if(kind==='cactus'){leafGeo=new T.CapsuleGeometry(1,1,6,real?48:8);if(real){const p=leafGeo.attributes.position;for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),r=1+.075*Math.cos(a*12);p.setX(i,p.getX(i)*r);p.setZ(i,p.getZ(i)*r);}leafGeo.computeVertexNormals();}}
 else if(real){leafGeo=new T.PlaneGeometry(1,1);materials.leaf.map=texture(['pine','spruce','cedar','fern'].includes(kind)?'pine':'oak');materials.leaf.alphaTest=.38;materials.leaf.alphaToCoverage=false;}
 else if(['pine','spruce','cedar'].includes(kind))leafGeo=new T.ConeGeometry(1,1,toon?16:5);
 else leafGeo=new T.IcosahedronGeometry(1,toon?2:0);
 instance(leafGeo,materials.leaf,leafMatrices,leafColors);
 }
export function addVegetation(view){
 view.treeInstances=[];let last=new T.Vector3(Infinity,Infinity,Infinity);const zero=new T.Matrix4().makeScale(0,0,0);
 // An instance is drawn unless the camera is standing inside that tree.
 view.clearCameraTrees=()=>{
  // The vegetation tests build a view with no camera -- they only ever look
  // at the geometry -- so this has to be safe to call without one.
  if(!view.camera)return;
  if(last.distanceToSquared(view.camera.position)<.04)return;
  last.copy(view.camera.position);
  const hidden=new Set(view.world.trees.filter(t=>cameraInsideTree(view.camera.position,t)));
  for(const batch of view.treeInstances){
   let changed=false;const culled=view.cull?.has(batch.mesh);
   batch.owners.forEach((t,i)=>{
    const hide=hidden.has(t)?1:0;
    if(hide!==batch.hidden[i]){
     // A culled mesh no longer holds instance i at index i -- the cull packs
     // what is in view to the front -- so there it is the flag that hides the
     // tree, and the cull that rewrites the buffer.
     if(!culled)batch.mesh.setMatrixAt(i,hide?zero:batch.matrices[i]);
     batch.hidden[i]=hide;changed=true;
    }
   });
   if(changed&&culled)view.cull.dirty();
   else if(changed)batch.mesh.instanceMatrix.needsUpdate=true;
  }
 };
 for(const kind of new Set(view.world.trees.map(t=>t.kind)))addSpecies(view,kind,view.world.trees.filter(t=>t.kind===kind));

 addDeadfall(view);
 addGroundCover(view);
 addNearbyGrass(view);
}
// THE FOREST FLOOR IS WHAT A GROVE LEAVES BEHIND.
//
// Under a redwood the interesting thing at eye level is not the trees -- their
// trunks are bare for twenty metres -- it is the deadfall: a toppled trunk
// going soft, the stump of something that came down a century ago, boulders
// furred over with moss. Without it the floor is mown rough with columns
// standing in it.
//
// Placement is mostly ANCHORED TO TREES rather than uniform, because timber
// falls where timber grows. A scatter spread evenly over the whole map reads as
// litter dropped on a lawn; the same count clustered around trunks reads as a
// wood that has been there a while.
//
// These are decoration and nothing collides with them -- a ball rolls through a
// fallen log. Worth knowing before anyone makes them bigger.
const DEADFALL = [['log', .40], ['stump', .24], ['mossrock', .36]];
function addDeadfall(view) {
 const {world} = view, count = biomeOf(world.settings.biome).deadfall;
 if (!count) return;
 // Its own group, the way the living rough has one: a named handle in the
 // scene is the difference between checking this from the console and
 // guessing at it.
 const group = new T.Group(); group.name = 'Deadfall'; view.group.add(group);
 const rng = random(world.seed + ':deadfall'), dummy = new T.Object3D();
 dummy.rotation.order = 'YXZ';
 // Real trees only. A fern is not something a log falls out of.
 const anchors = world.trees.filter(t => !GROUND_PLANTS.has(t.kind));
 const launch = launchCorridors(world.holes, world.height);

 const damp = new T.Color('#5a4433'), cut = new T.Color('#9a8156');
 const moss = new T.Color('#4f6b3c'), stone = new T.Color(world.bio.rock || '#8a8577');
 const dirt = new T.Color(world.bio.rough || '#7e8a5a');
 const entries = [];
 for (let i = 0; i < count * 4 && entries.length < count; i++) {
  let x, z;
  if (anchors.length && rng() < .72) {
   const t = anchors[Math.floor(rng() * anchors.length)], a = rng() * 6.28;
   const r = t.r * 1.1 + rng() * 7;
   x = t.x + Math.cos(a) * r; z = t.z + Math.sin(a) * r;
  } else {
   x = (rng() - .5) * world.halfX * 2; z = (rng() - .5) * world.halfZ * 2;
  }
  if (world.surface(x, z) !== 'rough' || world.nearest(x, z).d < 8) continue;
  // Deadfall is knee height, so this only ever bites close to a tee -- which
  // is the one place a log in the shot path is worth removing.
  if (blocksLaunch(launch, x, z, world.height(x, z), world.height(x, z) + 1.6)) continue;
  if (onShoreBank(world, x, z)) continue;

  let r = rng(), family = DEADFALL[DEADFALL.length - 1][0];
  for (const [k, f] of DEADFALL) { r -= f; if (r <= 0) { family = k; break; } }
  const models = familyModels(family);
  if (!models.length) continue;
  const model = models[Math.floor(rng() * models.length)];

  // Every model is normalised to unit height, so one number sizes it. For a
  // log lying down that height is its THICKNESS and the length follows from
  // the model's own proportions -- which is why a log is scaled so much
  // smaller than a stump and still ends up the longer object.
  const size = family === 'log' ? .5 + rng() * .55
             : family === 'stump' ? .7 + rng() * 1.0
             : .5 + rng() * 1.25;
  // Settled into the ground rather than resting on top of it.
  dummy.position.set(x, world.height(x, z) - size * .1, z);
  dummy.rotation.set((rng() - .5) * .16, rng() * 6.28, (rng() - .5) * .16);
  dummy.scale.set(size * (.9 + rng() * .3), size, size * (.9 + rng() * .3));
  dummy.updateMatrix();
  const green = moss.clone().offsetHSL((rng() - .5) * .04, (rng() - .5) * .12, (rng() - .5) * .12);
  const wood = damp.clone().offsetHSL((rng() - .5) * .03, (rng() - .5) * .10, (rng() - .5) * .14);
  entries.push({model, owner: null, matrix: dummy.matrix.clone(),
   // `accent` is the cut face on a log and the whole plant on some models, so
   // it follows the family rather than being one colour for everything.
   color: {bark: wood, leaf: green, stone: stone.clone().multiplyScalar(.8 + rng() * .35),
    dirt, accent: family === 'mossrock' ? green : cut.clone().offsetHSL(0, 0, (rng() - .5) * .12)}});
 }
 const materials = new Map();
 const materialFor = role => {
  if (!materials.has(role)) materials.set(role, new T.MeshToonMaterial({color: '#ffffff'}));
  return materials.get(role);
 };
 instanceModels(group, entries, materialFor);
}

function finishBlade(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,0,.5,.24,0,-.4,.12],3));g.setIndex([0,1,3,1,2,3,2,0,3]);g.computeVertexNormals();return g;}
function addGroundCover(view){
 const {world,style,group}=view,real=style==='realistic',toon=style==='cartoon',blue=style==='blueprint',rng=random(world.seed+':understory'),dummy=new T.Object3D(),color=new T.Color();
 // The understory shades the way the rest of the scene does. It used to build
 // MeshStandardMaterial unconditionally, ignoring the art style that addSpecies
 // above honours -- so in cartoon style the ground, the trees and the near-field
 // grass were all toon while the rocks, the tall grass and the flowers were the
 // only PBR left in the frame. On links that meant ~89k tall blades responding
 // to a falling sun on a completely different curve from the turf under them:
 // the ground went to dusk and the grass standing in it did not.
 const ramp=toon?toonRamp(view):null;
 const mat=(c,opts={})=>{const{flatShading,...toonOpts}=opts;
  return toon?new T.MeshToonMaterial({color:c,gradientMap:ramp,...toonOpts})
             :new T.MeshStandardMaterial({color:c,roughness:1,...opts});};
 const instance=(geo,material,matrices,colors,cast=true)=>{if(!matrices.length){geo.dispose();material.dispose();return;}const mesh=new T.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors)mesh.setColorAt(i,colors[i]);});mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);};
 // Boulders, scrub and flowering/seeded grasses are biome-specific.
 const STONES=4,rocks=Array.from({length:STONES},()=>[]),rockColors=Array.from({length:STONES},()=>[]),grass=[],grassColors=[],flowers=[],flowerColors=[];
 // READ, DO NOT INVENT. Boulders are generated in course.js and live on the
 // world, because a rock the generator does not know about is a rock physics
 // cannot collide with -- which is what they were until they moved. Placing
 // them here again would put a second set of stones in different places.
 for(const r of world.rocks||[]){
  dummy.position.set(r.x,r.y+r.scale*.25,r.z);
  dummy.rotation.set(r.rot[0],r.rot[1],r.rot[2]);
  dummy.scale.set(r.sx,r.sy,r.sz);
  dummy.updateMatrix();rocks[r.shape].push(dummy.matrix.clone());rockColors[r.shape].push(color.set(world.bio.rock).multiplyScalar(.82+rng()*.4).clone());}
 // A single icosahedron for every boulder is the other half of why scree reads
 // as one chunk repeated. Build a few distinct stones and deal rocks between
 // them; each gets its own material because instance() disposes the material it
 // is handed when a bucket comes up empty.
 for(let k=0;k<STONES;k++){
  const stone=new T.IcosahedronGeometry(1,real?2:0),p=stone.attributes.position,f1=1.7+k*2.3,f2=2.6+k*1.7;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const r=1+(real?.1:.26)*Math.sin(x*f1+z*f2+k)*Math.cos(y*f2-z*f1)+(real?.07:.17)*Math.cos(z*(f1+2.9)+x*f2-k*1.7);
   p.setXYZ(i,x*r,y*r,z*r);}
  stone.computeVertexNormals();
  instance(stone,mat('#fff',{flatShading:!real}),rocks[k],rockColors[k]);
 }
 const grassCount=Math.round(biomeOf(world.settings.biome).scatter.grass*(view.quality?.grass??1));
 for(let i=0;i<grassCount;i++){const x=(rng()-.5)*world.halfX*1.96,z=(rng()-.5)*world.halfZ*1.96;if(world.surface(x,z)!=='rough'||world.groundCover(x,z)==='straw'||onShoreBank(world,x,z))continue;const patch=.5+.3*Math.sin(x/17+Math.sin(z/24))+.2*Math.cos(z/11);if(rng()>patch)continue;const h=(biomeOf(world.settings.biome).scatter.bladeLength)*(.4+rng());dummy.position.set(x,world.height(x,z),z);dummy.rotation.set(0,rng()*6.28,0);dummy.scale.set(biomeOf(world.settings.biome).scatter.bladeWidth,h,biomeOf(world.settings.biome).scatter.bladeWidth);dummy.updateMatrix();grass.push(dummy.matrix.clone());color.set(biomeOf(world.settings.biome).scatter.bladeTint||world.bio.rough).lerp(new T.Color('#d9ce85'),rng()*.3).multiplyScalar(.9+rng()*.35);grassColors.push(color.clone());if(['midwest','mountain','links','desert'].includes(world.settings.biome)&&rng()<.16){dummy.position.y+=h*.8;dummy.scale.set(.1,.08,.1);dummy.updateMatrix();flowers.push(dummy.matrix.clone());flowerColors.push(new T.Color(blue?'#93d4de':biomeOf(world.settings.biome).scatter.flowers[rng()>.5?0:1]));}}
 for(const t of world.trees.filter(t=>['gorse','heather','palo'].includes(t.kind)))for(let j=0;j<24;j++){const a=rng()*6.28,r=Math.sqrt(rng())*t.r*.85;dummy.position.set(t.x+Math.cos(a)*r,t.y+t.h*.6+Math.sqrt(Math.max(0,1-r*r/t.r**2))*t.h*.17,t.z+Math.sin(a)*r);dummy.scale.set(.12,.1,.12);dummy.updateMatrix();flowers.push(dummy.matrix.clone());flowerColors.push(new T.Color(blue?'#92d6c7':t.kind==='heather'?'#af80aa':'#e4c855'));}
 const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute([-.16,0,0,0,1,0,.08,0,0,0,0,-.12,0,.85,0,0,0,.12,-.1,0,-.1,.3,.65,.1,.08,0,.08],3));groundShaded(blade,[.62,.95,.62,.62,.95,.62,.62,.95,.62]);instance(blade,groundLit(windMaterial(mat('#fff',{side:T.DoubleSide,vertexColors:true}),view,.22,true)),grass,grassColors,false);instance(new T.IcosahedronGeometry(1,0),windMaterial(mat('#fff'),view,.16),flowers,flowerColors,false);
}

// Fine grass follows the camera in cached 24 m tiles. The complete course keeps
// its taller meadow patches; only fine blades need this near-field detail.
function addNearbyGrass(view){
 const w=view.world,tileSize=24,tiles=new Map(),group=new T.Group();group.name='Living rough';view.group.add(group);
 const geometry=grassClump(7,w.seed+':clump');
 const material=groundLit(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,vertexColors:true,gradientMap:toonRamp(view)}),view,.2,true)),dummy=new T.Object3D(),color=new T.Color();let lastKey='';
 // Tiles are built on demand as the camera moves, so at cascade-registration
 // time this group holds no meshes and a scene walk cannot find this material.
 // Hand it over directly or the grass never samples a shadow map, and stays lit
 // at full strength inside shadows the ground beneath it is already in.
 view.lazyMaterials?.push(material);
 // Shrinks into the ground between 28 and 48 m out, so the edge of the ring of
 // tiles is never seen. `flat` shrinks every axis rather than only height --
 // a fallen stick has no height to lose.
 const fadeOut=(material,flat=false)=>{const compile=material.onBeforeCompile,key=material.customProgramCacheKey;material.customProgramCacheKey=()=>key.call(material)+'-fade-'+flat;material.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('mvPosition=modelViewMatrix*mvPosition;',`float grassFade=1.-smoothstep(28.,48.,distance(mvPosition.xz,cameraPosition.xz));${flat?'mvPosition.xyz=instanceMatrix[3].xyz+(mvPosition.xyz-instanceMatrix[3].xyz)*grassFade;':'mvPosition.y=instanceMatrix[3].y+(mvPosition.y-instanceMatrix[3].y)*grassFade;'}mvPosition=modelViewMatrix*mvPosition;`);};return material;};
 fadeOut(material);
 // THE FOREST FLOOR (U6 in TODO): Ultra only. Low fern clumps and fallen
 // sticks, in the same tiles as the grass and from the same seeded draw, so
 // they are where they were each time the camera comes back. Decoration only:
 // none of it is in the world, so nothing here can stop a ball -- which is why
 // it is small enough (ankle height at most) that a ball visibly rolling
 // through it never looks wrong. Denser where the canopy is (the occlusion
 // bake, occlusion.js), so it gathers under the trees and thins to nothing on
 // open rough.
 const floorOn=(view.quality?.forestFloor??0)>0;
 const canopy=(x,z)=>{const o=view.groundOcclusion;if(!o)return 0;const i=Math.floor((x/o.ex+1)*.5*o.Sx),j=Math.floor((z/o.ez+1)*.5*o.Sz);return i<0||j<0||i>=o.Sx||j>=o.Sz?0:o.occ[j*o.Sx+i];};
 let frondGeo=null,stickGeo=null,frondMat=null,stickMat=null;
 if(floorOn){
  // Seven fronds arching out from a centre, each a narrow leaf bent down at the tip.
  const fv=[];for(let i=0;i<7;i++){const a=i*.898+(i%2)*.3,c=Math.cos(a),s=Math.sin(a),px=-s,pz=c,r1=.3,r2=.58,wd=.075;
   const b=[c*.03,0,s*.03],m1=[c*r1+px*wd,.26,s*r1+pz*wd],m2=[c*r1-px*wd,.26,s*r1-pz*wd],tip=[c*r2,.1+(i%3)*.03,s*r2];
   fv.push(...b,...m1,...m2,...m1,...tip,...m2);}
  frondGeo=new T.BufferGeometry();frondGeo.setAttribute('position',new T.Float32BufferAttribute(fv,3));frondGeo.computeVertexNormals();
  // A stick: a thin three-sided bar a metre long, lying along x.
  const sv=[],tri=[[0,.05],[.043,-.025],[-.043,-.025]];
  for(let k=0;k<3;k++){const [y0,z0]=tri[k],[y1,z1]=tri[(k+1)%3];sv.push(-.5,y0+.03,z0,.5,y0+.03,z0,.5,y1+.03,z1,-.5,y0+.03,z0,.5,y1+.03,z1,-.5,y1+.03,z1);}
  stickGeo=new T.BufferGeometry();stickGeo.setAttribute('position',new T.Float32BufferAttribute(sv,3));stickGeo.computeVertexNormals();
  frondMat=fadeOut(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,gradientMap:toonRamp(view)}),view,.3,true));
  stickMat=fadeOut(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,gradientMap:toonRamp(view)}),view,0,true),true);
  view.lazyMaterials?.push(frondMat,stickMat);
  view.resources?.push(frondGeo,stickGeo);
 }
 // STAND-INS FOR THE SHADER WARM-UP (B7 in TODO). The warm-up builds every
 // program it can find by walking the scene, and these materials are only in
 // the scene where a tile has grown something: the fronds and sticks only under
 // canopy, which the establishing pose over open ground usually has none of. So
 // the first time the camera came down among trees their programs were built on
 // the spot -- two of them at about 75 ms each, one frame of 170 ms, 2.9 s after
 // an Ultra course appeared. One hidden instance of each, the same kind of mesh
 // as a tile (instanced, with instance colours, receiving shadow), is shown only
 // while the renderer compiles (`withStandIns`).
 const standIn=(geo,mat)=>{const m=new T.InstancedMesh(geo,mat,1);dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(0,0,0);dummy.updateMatrix();m.setMatrixAt(0,dummy.matrix);m.setColorAt(0,color.set('#ffffff'));m.receiveShadow=true;m.frustumCulled=false;m.userData={noCull:true};m.visible=false;group.add(m);view.standIns?.push(m);};
 standIn(geometry,material);
 if(floorOn){standIn(frondGeo,frondMat);standIn(stickGeo,stickMat);}
 // Building the ring in one frame is what made the camera hitch.
 //
 // Crossing a tile boundary meant five new tiles at once: eight thousand
 // candidate blades, each costing a surface, a groundCover and a height query
 // against the world, then a matrix and a colour for the ones that survive.
 // Measured at 37 ms -- better than two dropped frames -- every 24 m the camera
 // travelled, and 127 ms for the first ring of twenty-five. It fired on camera
 // movement, which is exactly when a frame can least afford it.
 //
 // So the ring is still reconciled the moment the camera changes tile, but tiles
 // are BUILT one per frame from a queue ordered nearest-first, and a tile that
 // falls out of range is parked rather than thrown away. Walking back over
 // ground you just left is the common case and it used to rebuild all of it.
 const RANGE=2,CACHE=32;
 const pending=[],parked=new Map();
 const keyOf=(tx,tz)=>tx+','+tz;
 const floorTile=(tx,tz,key)=>{
  const rng=random(w.seed+':floor:'+key),fronds=new T.InstancedMesh(frondGeo,frondMat,400),sticks=new T.InstancedMesh(stickGeo,stickMat,90);
  let nf=0,ns=0;const tint=new T.Color(w.bio.tree),bark=new T.Color('#5b4631');
  for(let i=0;i<490;i++){
   const x=(tx+rng())*tileSize,z=(tz+rng())*tileSize,roll=rng(),frond=i<400;
   if(Math.abs(x)>w.halfX||Math.abs(z)>w.halfZ||roll>canopy(x,z)*(frond?1.9:1.1))continue;
   if(w.surface(x,z)!=='rough'||onShoreBank(w,x,z,false))continue;
   const s=frond?.6+rng()*.9:.35+rng()*1.3;
   dummy.position.set(x,w.height(x,z),z);dummy.rotation.set(0,rng()*6.28,frond?0:(rng()-.5)*.12);dummy.scale.set(frond?s:s,frond?s*(.7+rng()*.6):1,frond?s:1);dummy.updateMatrix();
   if(frond){fronds.setMatrixAt(nf,dummy.matrix);color.copy(tint).lerp(new T.Color('#7fa24a'),.12+rng()*.38);fronds.setColorAt(nf++,color);}
   else{sticks.setMatrixAt(ns,dummy.matrix);color.copy(bark).lerp(new T.Color('#9a8a70'),rng()*.6);sticks.setColorAt(ns++,color);}
  }
  fronds.count=nf;sticks.count=ns;
  // Open rough grows none, and an empty mesh is still an object every frame walks.
  const kept=[fronds,sticks].filter(m=>m.count>0||(m.dispose(),false));
  for(const m of kept){m.userData={noCull:true};m.receiveShadow=true;m.computeBoundingSphere();}
  return kept;
 };
 const buildTile=(tx,tz)=>{
  const key=keyOf(tx,tz);
  // Written straight into the mesh rather than cloned into arrays and copied in
  // afterwards: that was two throwaway objects per surviving blade, about 2500 a
  // tile. The mesh is allocated for every candidate and its count pulled back to
  // what survived, which is the only way round needing the total up front.
  const rng=random(w.seed+':grass:'+key),count=biomeOf(w.settings.biome).scatter.tufts;
  const mesh=new T.InstancedMesh(geometry,material,count);
  let kept=0;
  // ROUGH ONLY. The semi-rough used to carry blades too, at 3.5 cm -- stubble
  // that cost a full instance each and read as noise on a surface whose job is
  // to be visibly BETWEEN fairway and rough. The mown-height difference is the
  // information; geometry on top of it was not adding any.
  for(let i=0;i<count;i++){const x=(tx+rng())*tileSize,z=(tz+rng())*tileSize,surface=w.surface(x,z);if(surface!=='rough'||w.groundCover(x,z)==='straw'||Math.abs(x)>w.halfX||Math.abs(z)>w.halfZ||onShoreBank(w,x,z,false))continue;
   const tall=biomeOf(w.settings.biome).scatter.tallGrass,height=tall?.6+rng()*.65:.09+rng()*.17;
   dummy.position.set(x,w.height(x,z),z);dummy.rotation.set(0,rng()*6.28,0);dummy.scale.set(tall?1:.8,height,tall?1:.8);dummy.updateMatrix();
   mesh.setMatrixAt(kept,dummy.matrix);
   color.set(tall?'#bd9e5f':w.bio.rough).lerp(new T.Color(tall?'#e8d797':'#aebd69'),rng()*.35);
   mesh.setColorAt(kept,color);
   kept++;
  }
  mesh.count=kept;
  mesh.userData={tx,tz,noCull:true};mesh.receiveShadow=true;mesh.computeBoundingSphere();
  // A tile with no rough in it (the sea, a lake, a fairway) grows nothing, and
  // never had a colour set, so its mesh carries no instance colours -- which is a
  // different shader from every other tile's. Drawn, it built that shader on the
  // spot for nothing: 96 ms, the first thing an Ultra course on Island did (B7).
  // Kept as a record of the tile, and hidden unless its forest floor grew
  // something (a hidden parent would hide that too).
  // The floor rides on the grass tile as its children, so parking, evicting
  // and disposing a tile carries it along without a second bookkeeping.
  if(floorOn){for(const m of floorTile(tx,tz,key))mesh.add(m);const dispose=mesh.dispose.bind(mesh);mesh.dispose=()=>{for(const c of mesh.children)c.dispose();dispose();};}
  mesh.visible=kept>0||mesh.children.length>0;
  return mesh;
 };
 // Out of range, but probably not for long. Held with its buffers intact and
 // evicted oldest-first, so a bounded amount of memory buys back the rebuild.
 const park=(key,mesh)=>{
  group.remove(mesh);parked.set(key,mesh);
  while(parked.size>CACHE){const oldest=parked.keys().next().value;parked.get(oldest).dispose();parked.delete(oldest);}
 };
 const reconcile=(cx,cz)=>{
  for(const [key,mesh] of tiles)
   if(Math.abs(mesh.userData.tx-cx)>RANGE||Math.abs(mesh.userData.tz-cz)>RANGE){tiles.delete(key);park(key,mesh);}
  // Rebuilt rather than appended: a queue from where the camera used to be is a
  // list of ground it is walking away from.
  pending.length=0;
  for(let tz=cz-RANGE;tz<=cz+RANGE;tz++)for(let tx=cx-RANGE;tx<=cx+RANGE;tx++){
   const key=keyOf(tx,tz);
   if(!tiles.has(key))pending.push({key,tx,tz,reach:Math.max(Math.abs(tx-cx),Math.abs(tz-cz))});
  }
  pending.sort((a,b)=>a.reach-b.reach);
 };
 // Returns whether it did any work, so warmUp can drain the queue against a time
 // budget rather than guessing at a tile count.
 view.updateGrass=()=>{
  const cx=Math.floor(view.camera.position.x/tileSize),cz=Math.floor(view.camera.position.z/tileSize),key=keyOf(cx,cz);
  if(key!==lastKey){lastKey=key;reconcile(cx,cz);}
  // One a frame, nearest first, so the ground under the camera fills in before
  // the edge of the ring does.
  const next=pending.shift();
  if(!next)return false;
  const held=parked.get(next.key);
  if(held){parked.delete(next.key);tiles.set(next.key,held);group.add(held);return true;}
  const mesh=buildTile(next.tx,next.tz);
  tiles.set(next.key,mesh);group.add(mesh);
  return true;
 };
 // Parked tiles are out of the group, so the scene walk in disposeCourse cannot
 // find them. Without this they leak a rebuild's worth of buffers per course.
 view.resources?.push({dispose:()=>{for(const mesh of parked.values())mesh.dispose();parked.clear();}});
}
