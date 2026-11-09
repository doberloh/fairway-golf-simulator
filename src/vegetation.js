import {darkenBy} from './species.js';
import {cameraInsideTree,treeBlocksView,viewBlocker,keepsCleared} from './camera-tours.js';
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {farWoodSites,FAR_SHAPES} from './far-woods.js';
import {random} from './course.js';
import {FAMILY_OF,familyModels,modelRadius,modelExtents,instanceModels,modelParts,bareParts} from './mesh-assets.js';
import {onShoreBank} from './streams.js';
import {EVERGREEN,GROUND_PLANTS,SPREAD_SIZED} from './species.js';
import {plantPose} from './tree-seat.js';
import {allows} from './grounds.js';
import {wildAt} from './landforms.js';
import {launchCorridors,blocksLaunch,BEACH_RISE,teePad,TEE_APRON,TEE_APRON_SCALE,TEE_ROUND} from './course.js';
import {windMaterial,toonRamp,rimLit} from './textures.js';
import {biomeOf} from './biomes.js';
import {regionOf} from './regions.js';
import {SEASON_TINTS} from './season-tints.js';
import {bareInWinter,bloomIn,UNDER_SNOW,dullInWinter,curedInWinter,SNOW_GRASS_HEIGHT,RICH,roughGreen} from './seasons.js';
import {PALMS} from './built-world.js';
// The regions with wildflowers in the rough. By region: the list was of
// landscape keys until 2 November 2026, and the keys' rename (Midwest to
// Heartland, Mountain to Rockies, Desert to Sonoran) left only the Links with
// any (found 3 November, phase 6). Texas joins with its bluebonnets.
const FLOWER_REGIONS=new Set(['midwest','mountain','links','desert','texas']);
// A number from a place, the same every time and with no draw from a stream,
// so a season's flowers never move the grass round them.
const spotHash=(x,z)=>Math.abs(Math.sin(x*12.9898+z*78.233)*43758.5453)%1;
// Of the rough's blades, the share with a flower at a full spring bloom
// (seasons.js bloomIn), against .16 the year round in FLOWER_REGIONS; and of
// the long grass's colonies, the share whose heads are the bloom's. PLACED.
const BLOOM_FLOWERS=.24,BLOOM_HEADS=.7;
// A house drive keeps the rough's grass off it (homes.js; the cartoon overhaul's paths, round 5).
import {onDrive} from './homes.js';

// EVERYTHING THE VIEW CLEARS BESIDES TREES (UI/UX pass V2): a batch is one
// instanced mesh with, for each instance, the object it belongs to as
// `viewBlocker` reads it -- the same object for every part of one house, so
// a house goes whole. clearCameraTrees tests each object once. Exported for
// homes.js.
// A tree's own tint. HSL here is in linear colour, where the dark greens sit at a
// lightness of about 0.05, so a flat -0.05 took them to black (the Redwood Coast's
// lone black trees, 5 November 2026): how far down one goes is held to a share of
// its own lightness. The draws from rng are the same, in the same order.
const varyColour=(c,h,s,l)=>c.offsetHSL(h,s,darkenBy(c.getHSL({}).l,l));

export function addViewBlockers(view,mesh,matrices,owners){
 if(!mesh||!owners?.length)return;
 const hidden=new Uint8Array(matrices.length);mesh.userData.cullHidden=hidden;
 (view.viewBlockers||=[]).push({mesh,matrices,owners,hidden});
}
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
// Ground cover sized by its SPREAD rather than its height: species.js
// SPREAD_SIZED, shared with the seating (tree-seat.js).

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
// SNOW ON THE TOPS (the seasons, winter where the region's winter is snow:
// view.snowTops, renderer.js): every face turned up -- a crown's top, a
// limb's upper side -- fades toward snow white, by how far it faces the sky
// (world normal y from .45 to .8, 85% at most; PLACED). Looks only. `flat`
// is where a wall's rounded stones and thin rails take it: from .15 to .5
// (PLACED; seen 4 November 2026: at the trees' numbers a fieldstone wall in
// the snow stayed bare, its stones too round to hold any).
export function snowTopped(material,flat=false){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey,range=flat?'.15,.5':'.45,.8';
 material.customProgramCacheKey=()=>key.call(material)+(flat?'-snowtop-flat':'-snowtop');
 material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_toon_fragment>','{vec3 snowN=normalize((vec4(normal,0.)*viewMatrix).xyz);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,.97),smoothstep('+range+',snowN.y)*.85);}\n#include <lights_toon_fragment>');};
 return material;
}
function groundLit(material){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.customProgramCacheKey=()=>key.call(material)+'-groundlit';
 material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(vNormal);');};
 return material;
}
// Stiffer in a wind than a broadleaf: needled boughs on a heavy leader.
const CONIFERS=new Set(['redwood','youngredwood','dougfir','hemlock','redcedar','pine','spruce','cedar']);
// Rigid: a cactus is a column of water in a skin, and an agave's leaves are
// stiff blades. Neither moves in any wind a round of golf is played in.
const STILL=new Set(['dtsaguaro','cactus','agave','cholla']);
// The trees built as they grow (tools/blender/grown.py): their foliage is thin too.
const THIN_LEAVES=new Set(['palm','halatree','brackenfern','ocotillo','redwood','youngredwood','dougfir','hemlock','tanoak','baylaurel','madrone','bigleafmaple']);
// Kept green through leaf fall; and the hue a broadleaf turns (HSL hue; the
// rest turn orange, .055).
const FALL_HUE={maple:0,aspen:.11,paperbirch:.12,americanbeech:.09};
// THE SEASONS (the US landscapes goal, step 9; seasons.js). The round's
// season is the view's (renderer.js sets it). Leaves turn in autumn
// everywhere and only then: New England wore its autumn as its summer too,
// until the owner asked for a real one (4 November 2026). Kept in leaf through winter
// beside the evergreens: the cacti and the desert's green-barked trees, and
// the Pacific's evergreen broadleaves.
const WINTER_LEAFY=new Set([...EVERGREEN,...STILL,'madrone','tanoak','baylaurel','ocotillo','ironwood','palo']);
// An aspen's "eyes" and a birch's bands are the accent role but on the trunk,
// so they stay on a bare tree (a flower or a berry does not).
const TRUNK_ACCENT=new Set(['aspen','paperbirch']);
const seasonOfView=view=>view.season||'summer';
const autumnLeaves=view=>seasonOfView(view)==='autumn';
const bare=(view,kind)=>seasonOfView(view)==='winter'&&bareInWinter(kind,{evergreen:WINTER_LEAFY,palms:PALMS,ground:GROUND_PLANTS});
function addModelSpecies(view,kind,trees){
 const {world,group}=view,rng=random(world.seed+':models:'+kind);
 const models=familyModels(FAMILY_OF[kind]);
 if(!models.length)return false;
 // Under the snow in a snowy winter (seasons.js UNDER_SNOW).
 if(view.snowTops&&UNDER_SNOW.has(kind))return true;
 const shades={norpine:'#4a6e38',nobirch:'#6e9a44',bdash:'#557e38',bdjuniper:'#5a7068',prcotton:'#6a9440',prhack:'#5e8a3e',prcedar:'#3e5a36',mtponderosa:'#4f6e3a',mtlodge:'#4e6b3a',mtspruce:'#3f5e52',mtaspen:'#7aa04a',slshore:'#5e8458',cccypress:'#2f4a36',ccmpine:'#3a5a3c',cctorrey:'#4a6248',ccliveoak:'#5e8250',cceuc:'#5a7462',nwfir:'#2f5040',nwcedar:'#46603c',nwhemlock:'#34503e',nwmaple:'#4f7238',nwalder:'#4a6a3a',drafghan:'#3f6438',draleppo:'#4c7044',drwillow:'#6a8a48',drolive:'#7a8a6a',drdate:'#5c7a50',drfan:'#4f7a44',dtsaguaro:'#6e8c60',dtpaloverde:'#7f9a50',dtmesquite:'#5a7440',hicookpine:'#3c6440',hiironwood:'#54704a',himonkeypod:'#4a7a3c',flcoconut:'#4c7a3e',flroyal:'#4f7d42',lowliveoak:'#3f5c34',lowcypress:'#5c7a44',lowsabal:'#4f7042',southloblolly:'#3f6a38',southlongleaf:'#4f7a3e',southwhitepine:'#41694a',southdogwood:'#5f8a48',whiteoak:'#487039',pinoak:'#466f3a',parkmaple:'#527a3c',parkpoplar:'#5c8240',parkelm:'#557a3a',norwayspruce:'#30573c',afghanpine:'#3f6438',africansumac:'#6e9050',pampasgrass:'#6a8a50',rmjuniper:'#56706a',greenash:'#4f7a3a',chokecherry:'#4a7038',leadplant:'#8f9c80',redpine:'#557a3a',jackpine:'#647a3e',tamarack:'#6e9a4a',blackspruce:'#3c583a',sitkaspruce:'#587656',shorepine:'#4a6a36',fireweed:'#557a3c',devilsclub:'#4f7e36',cottongrass:'#6e8a4a',monkeypod:'#5a843c',casuarina:'#5a7650',cookpine:'#3d663e',ohia:'#56764a',plumeria:'#5a853a',tiplant:'#8a2e4a',heliconia:'#4f8a3e',rosebay:'#3e6234',mountainlaurelshrub:'#3e6234',flameazalea:'#557e38',chestnutoak:'#4f7436',shortleafpine:'#5c7638',sassafras:'#5a8a3c',copperbeech:'#5a3036',pitchpine:'#647e40',scruboak:'#4f7036',bayberry:'#5a7a3e',beachrose:'#4e7a36',hydrangea:'#4a7a3a',westernjuniper:'#64805a',utahjuniper:'#6c8256',pinyonpine:'#58763f',rabbitbrush:'#8a9a6a',blackbrush:'#6a6e62',cliffrose:'#7a8a5a',russianolive:'#9fb09a',balsamroot:'#a8b498',globemallow:'#9aa88a',cheatgrass:'#c8b07a',soapweedyucca:'#7a8a5a',easternredcedar:'#436a36',buffalograss:'#8a9a6a',wildsunflower:'#5a7a3a',montereycypress:'#3a5a32',montereypine:'#3a5e34',coastliveoak:'#40613a',eucalyptus:'#7a9480',sycamore:'#5f8a3e',torreypine:'#66864f',iceplant:'#6a9a4a',coastalsage:'#a09a80',chaparral:'#5a6e4a',valleyoak:'#5c7e3c',blueoak:'#8a9e86',buckeye:'#a8925a',grapevine:'#5a7e34',californiapoppy:'#8a9a7a',olivetree:'#84967a',jacaranda:'#8a7ac8',peppertree:'#749448',ponderosa:'#5b7e38',sugarpine:'#4f744d',incensecedar:'#4d7a3a',redfir:'#557564',noblefir:'#4d7a72',westernlarch:'#6a9a48',manzanita:'#6f826a',gambeloak:'#4f7a34',mountainmahogany:'#4a5e3e',bitterbrush:'#7a8a5a',mulesear:'#8a9662',beargrass:'#6a8a4e',ashejuniper:'#4b6a40',postoak:'#4c6e34',pecan:'#4f7a36',cedarelm:'#4f7436',osageorange:'#4f7a36',mountainlaurel:'#3f6a34',redbud:'#557e38',bluebonnet:'#5a7a40',joshuatree:'#77884a',mojaveyucca:'#6a8040',fanpalm:'#5a843a',datepalm:'#738f62',aleppopine:'#6f8f4c',oleander:'#4f7436',tamarisk:'#8fa070',smoketree:'#a8acaa',soaptreeyucca:'#8a9a5a',sotol:'#8a9a7a',lechuguilla:'#8a9a5a',desertwillow:'#7a9a52',emoryoak:'#4f6a38',alligatorjuniper:'#678572',beavertail:'#8a8aa0',longleafpine:'#6a8a42',loblollypine:'#5a7e38',slashpine:'#5f823a',cabbagepalm:'#527a3a',sawpalmetto:'#66864a',longleafgrass:'#647e40',wiregrass:'#7a8a52',liveoak:'#3e6034',liveoakmoss:'#3e6034',turkeyoak:'#5c7e3a',blackjackoak:'#466a32',baldcypress:'#5e8a42',cypressknees:'#5e8a42',watertupelo:'#4f7a36',floweringdogwood:'#557e3a',azalea:'#4f7436',magnolia:'#355a30',tulippoplar:'#4f7e36',crapemyrtle:'#4f7a38',kudzu:'#4f8a36',sweetgum:'#4f7e36',yaupon:'#4c7036',spartina:'#5a8a3e',sawgrass:'#6e7e4c',muhlygrass:'#6a8a4a',waxmyrtle:'#56763c',citrustree:'#3a6430',royalpalm:'#5a873c',travelerspalm:'#58873c',seagrape:'#58873c',mangrove:'#3d6632',gumbolimbo:'#4f7a36',banyan:'#47763a',bougainvillea:'#4f7a36',hibiscus:'#3f6a34',ironwood:'#7d9070',americanelm:'#4f7a36',shagbark:'#4f7a36',buroak:'#4f7436',prairieforbs:'#6a8a42',paperbirch:'#5f8a3e',whitepine:'#58825a',balsamfir:'#3e6438',americanbeech:'#557e38',jojoba:'#768668',sandcherry:'#5a7a3e',lodgepole:'#4e7234',bluespruce:'#6f8f96',willowthicket:'#6a8a52',columbine:'#7a9a5a',lupine:'#7a9a5a',madrone:'#3a6a36',garryoak:'#4f7436',bigleafmaple:'#4f7e36',pacificdogwood:'#557e3a',baylaurel:'#4f7036',vinemaple:'#5a8a3c',oregongrape:'#3f6234',scotchbroom:'#4f7436',pacificrhododendron:'#3f6234',douglasiris:'#5a7a42',cedar:'#35694a',pine:'#4a7041',spruce:'#2c5349',aspen:'#91ac58',maple:'#658d36',alder:'#64833d',oak:'#487039',palm:'#5f8f4a',cactus:'#6f8f5e',shrub:'#5d7a43',gorse:'#7f8d3f',heather:'#8a7596',naupaka:'#428546',fern:'#4a7b4a',bramble:'#4f4636',cottonwood:'#5f8f38',blackoak:'#3e6a2f',sugarmaple:'#557f33',dunegrass:'#6f9a45',juniper:'#3d6550',commonjuniper:'#3f6a55',palo:'#9aa64e',mesquite:'#6c804b',cholla:'#6f8f5e',ocotillo:'#6f7a45',agave:'#7caa9b',creosote:'#6e8c3a',brittlebush:'#8a9c72',sagebrush:'#86987a',bracken:'#5d8a3a',huckleberry:'#6a9058',hala:'#678f3d',redwood:'#2f4f32',youngredwood:'#35583a',fir:'#355a3a',hemlock:'#4a6b3e',redcedar:'#3f6a40',tanoak:'#4f6b38',seedling:'#4a7041',swordfern:'#3f6e33',salal:'#3e5f30',sorrel:'#5f8a3e'};
 // Bark is one brown unless a species says otherwise.
 const barks={norpine:'#b0603a',nobirch:'#ece8e0',bdash:'#8a8478',bdjuniper:'#7a5040',prcotton:'#8a8070',prhack:'#8a8478',prcedar:'#7a4a34',mtponderosa:'#b0683c',mtlodge:'#8a6c4e',mtspruce:'#6e5a4e',mtaspen:'#e8e4d8',slshore:'#4e463e',cccypress:'#6a6058',ccmpine:'#4e443c',cctorrey:'#5e544a',ccliveoak:'#4a4642',cceuc:'#b0a690',nwfir:'#5e5048',nwcedar:'#6e5040',nwhemlock:'#5e4c42',nwmaple:'#6a645a',nwalder:'#8a8a80',drafghan:'#6a5c50',draleppo:'#7a6a5c',drwillow:'#6a6054',drolive:'#7a7268',drdate:'#8a7860',drfan:'#84786a',dtsaguaro:'#6e8c60',dtpaloverde:'#8aa060',dtmesquite:'#5e5046',hicookpine:'#7a6a5c',hiironwood:'#75695e',himonkeypod:'#6e6256',flcoconut:'#8a7c68',flroyal:'#9a948a',lowliveoak:'#7d7468',lowcypress:'#84766a',lowsabal:'#837a6c',southloblolly:'#8a7566',southlongleaf:'#88725f',southwhitepine:'#6f665e',southdogwood:'#6f655c',whiteoak:'#84807a',pinoak:'#7d756c',parkmaple:'#7e766d',parkpoplar:'#7f7b72',parkelm:'#756d64',norwayspruce:'#6f5a4e',afghanpine:'#6a5c50',africansumac:'#4a3c34',pampasgrass:'#8a8a60',rmjuniper:'#7a5040',greenash:'#8a8478',chokecherry:'#6a5650',leadplant:'#7a7a62',redpine:'#b0603a',jackpine:'#4e4640',tamarack:'#7a5a4e',blackspruce:'#5a5248',sitkaspruce:'#7a7468',shorepine:'#3e3a34',fireweed:'#557a3c',devilsclub:'#8a7a4a',cottongrass:'#6e8a4a',monkeypod:'#4a4038',casuarina:'#6a5a4e',cookpine:'#7a6e66',ohia:'#7a7670',plumeria:'#8a8680',tiplant:'#6e6050',heliconia:'#e8c440',rosebay:'#5a4a3e',mountainlaurelshrub:'#5e5048',flameazalea:'#6a5a4c',chestnutoak:'#4a423a',shortleafpine:'#7a4e36',sassafras:'#7a5a44',copperbeech:'#8a8a86',pitchpine:'#3e3530',scruboak:'#5a4e44',bayberry:'#6a5e52',beachrose:'#6a4a3a',hydrangea:'#6a5a48',westernjuniper:'#7a4e3a',utahjuniper:'#8a8378',pinyonpine:'#6a5e52',rabbitbrush:'#8a8a6a',blackbrush:'#6a6660',cliffrose:'#8a8072',russianolive:'#4e3e32',balsamroot:'#a07830',globemallow:'#8a8a70',cheatgrass:'#a09070',soapweedyucca:'#9a8a62',easternredcedar:'#7a4a34',wildsunflower:'#5a3a1e',montereycypress:'#8a7e70',montereypine:'#4e443c',coastliveoak:'#6a6660',eucalyptus:'#d8d2c2',sycamore:'#e2dccc',torreypine:'#7a5040',iceplant:'#b04a3a',coastalsage:'#9a8a6a',chaparral:'#7a3a2a',valleyoak:'#6e6a62',blueoak:'#a09a8e',buckeye:'#aaa69c',grapevine:'#6a5a4a',californiapoppy:'#7a9a8a',olivetree:'#7a766c',jacaranda:'#6a645c',peppertree:'#8a7058',ponderosa:'#b8683a',sugarpine:'#6e4c44',incensecedar:'#9a5636',redfir:'#6e3a2c',noblefir:'#6e6a66',westernlarch:'#8e5234',manzanita:'#8e2e22',gambeloak:'#6a6660',mountainmahogany:'#6e6862',bitterbrush:'#6a5e50',mulesear:'#9a6a1e',beargrass:'#6a8a4e',ashejuniper:'#7a5e4a',postoak:'#5e564c',pecan:'#6e665c',cedarelm:'#6a6460',osageorange:'#7a5a3a',mountainlaurel:'#5a5650',redbud:'#3e3a36',bluebonnet:'#f2f0ea',joshuatree:'#8a7a62',mojaveyucca:'#8a7a60',fanpalm:'#8a8478',datepalm:'#7a6450',aleppopine:'#7a7068',oleander:'#6a5a48',tamarisk:'#7a4a38',smoketree:'#9a9c98',soaptreeyucca:'#8a7c62',sotol:'#a89a70',lechuguilla:'#8a7a50',desertwillow:'#6a5644',emoryoak:'#2e2a28',alligatorjuniper:'#8a8580',beavertail:'#8a8aa0',longleafpine:'#8a5a3c',loblollypine:'#6e5a4a',slashpine:'#7e5038',cabbagepalm:'#8e8a80',sawpalmetto:'#7a6248',liveoak:'#4a4038',liveoakmoss:'#4a4038',turkeyoak:'#4e463e',blackjackoak:'#2e2a26',baldcypress:'#8a6248',cypressknees:'#8a6a52',watertupelo:'#7a746a',floweringdogwood:'#5a524c',azalea:'#5a4a3a',magnolia:'#7a756c',tulippoplar:'#6e6a62',crapemyrtle:'#b39a7e',kudzu:'#5a4a36',sweetgum:'#5a5048',yaupon:'#8a8780',waxmyrtle:'#8a8a80',citrustree:'#6a6a5a',royalpalm:'#b8b4aa',travelerspalm:'#8a8478',seagrape:'#7a6a58',mangrove:'#7a5a48',gumbolimbo:'#b0644a',banyan:'#8a847a',bougainvillea:'#6a5a40',hibiscus:'#6a5a40',ironwood:'#7a746a',americanelm:'#6a665e',shagbark:'#7a746a',buroak:'#5e5850',prairieforbs:'#3a2a20',paperbirch:'#ece8e0',whitepine:'#4a4440',balsamfir:'#6a6660',americanbeech:'#a8a8a0',sandcherry:'#5a4038',lodgepole:'#8a6a4a',bluespruce:'#6a625a',willowthicket:'#8a5a3a',columbine:'#f4f2ea',madrone:'#a8452a',garryoak:'#6f6a60',bigleafmaple:'#6a6656',pacificdogwood:'#8a8478',baylaurel:'#6c6a58',vinemaple:'#7a7448',scotchbroom:'#4f7436',pacificrhododendron:'#6a5040',aspen:'#d5d2b5',cottonwood:'#8b847a',blackoak:'#4e4640',sugarmaple:'#6e655b',palo:'#8fa553',mesquite:'#4d3d31',cholla:'#5a5040',ocotillo:'#7a6e5c',creosote:'#5a4a3a',bracken:'#6b5a3a',sagebrush:'#6a5d4e',huckleberry:'#5a4636',palm:'#93876a',hala:'#8a7b66',redwood:'#6d4e42',youngredwood:'#6a4b3f',fir:'#5d4636',hemlock:'#5a4a3e',redcedar:'#735040',tanoak:'#6e6256',sorrel:'#6f8a4e'};
 // The ACCENT is the leaf colour unless a species says otherwise. Dune grass
 // does: its blade tips are a second part, straw over green, which is what
 // American beachgrass looks like by midsummer.
 // The cartoon aspen's accent is the dark "eyes" on its pale trunk.
 // The cartoon shrubs' flowers and berries (tools/blender/cartoon_shrubs.py).
 // Muhly grass's plumes pink in summer too (the owner, 9 November 2026: "a big yellow puff"): the
 // grass is planted for them, and Florida Palms never leaves summer. PLACED by eye from the picture.
 // The Pacific pack (the US landscapes goal) in summer, until the seasons
 // are drawn: the broom and rhododendron still in their June flower, Oregon
 // grape's blue berries; the madrone's berries and the dogwood's and iris's
 // spring flowers in leaf colour (PLACED: the seasons step paints them by date).
 const accents={pampasgrass:'#e8dcc0',chokecherry:'#5a1a2a',leadplant:'#6a3a8a',jackpine:'#8a806a',fireweed:'#c8288a',devilsclub:'#c8281e',cottongrass:'#f2f0ea',monkeypod:'#d88aa8',ohia:'#d8302a',plumeria:'#f6f0dc',heliconia:'#d8302e',rosebay:'#c88ab8',mountainlaurelshrub:'#3e6234',flameazalea:'#e0782e',bayberry:'#a4a8a4',beachrose:'#d2508a',hydrangea:'#6a8ad0',rabbitbrush:'#9aa66a',blackbrush:'#6a6e62',cliffrose:'#d8d0c4',russianolive:'#b8bca8',balsamroot:'#e8c030',globemallow:'#e0782e',cheatgrass:'#d0b880',soapweedyucca:'#efe8c8',buffalograss:'#7a5a6a',wildsunflower:'#f0c020',eucalyptus:'#b8a07a',sycamore:'#b8a888',iceplant:'#c82a8a',chaparral:'#5a6e4a',buckeye:'#c8b88a',grapevine:'#4a3456',californiapoppy:'#f08a1e',jacaranda:'#9a8ad8',peppertree:'#d06a7a',sugarpine:'#a07e50',noblefir:'#7e7650',manzanita:'#6f826a',mountainmahogany:'#dcdad0',bitterbrush:'#7a8a5a',mulesear:'#e0b830',beargrass:'#f2efe4',osageorange:'#a8b84a',mountainlaurel:'#3f6a34',redbud:'#557e38',bluebonnet:'#3a5ac8',joshuatree:'#8a9a52',mojaveyucca:'#a89a6a',fanpalm:'#a8885a',datepalm:'#d8862e',oleander:'#e080a8',tamarisk:'#d890b0',smoketree:'#7a6aa8',soaptreeyucca:'#f2eedc',sotol:'#e8dcaa',lechuguilla:'#d89a3a',desertwillow:'#d890c8',beavertail:'#c82a7a',longleafpine:'#7a5a3a',loblollypine:'#7a5a3a',slashpine:'#7a5a3a',cabbagepalm:'#e6dcb4',sawpalmetto:'#4a5a3a',longleafgrass:'#c8c8b0',wiregrass:'#a8a070',liveoakmoss:'#78826e',floweringdogwood:'#6a8a42',azalea:'#5a8040',magnolia:'#f4f0e2',crapemyrtle:'#d0508a',kudzu:'#7a4a8a',yaupon:'#6e8a3e',spartina:'#a89a5a',sawgrass:'#8a4a2a',muhlygrass:'#d08cb0',waxmyrtle:'#56763c',citrustree:'#e8962a',royalpalm:'#7cae4c',seagrape:'#b0738a',bougainvillea:'#a03a72',hibiscus:'#d03a3a',ironwood:'#7d9070',prairieforbs:'#b05aa8',paperbirch:'#2a2a2a',sandcherry:'#3a1a2a',columbine:'#8aa8e0',lupine:'#6a5ac8',scotchbroom:'#e8c830',pacificrhododendron:'#d27aa8',oregongrape:'#4a5a8a',madrone:'#3a6a36',pacificdogwood:'#557e3a',douglasiris:'#5a7a42',dunegrass:'#c9b67c',aspen:'#3b3430',gorse:'#e8c33a',heather:'#a86aa8',naupaka:'#efece0',palo:'#ead35a',cactus:'#efe6c4',cholla:'#e3cf86',ocotillo:'#d8452c',agave:'#3a2e2a',creosote:'#e8c840',brittlebush:'#f0d040',palm:'#7a5a32',hala:'#d68a3a',snag:'#cbc2b2'};
 // Its own colours in the round's season (season-tints.js, the pack's specs);
 // summer is the tables above, exactly as before.
 const season=seasonOfView(view),own=season!=='summer'?SEASON_TINTS[kind]?.[season]:null;
 if(own?.accent)accents[kind]=own.accent;
 // A ground plant with no winter of its own in a snowy one (seasons.js).
 const dull=view.snowTops&&!own&&GROUND_PLANTS.has(kind)&&!EVERGREEN.has(kind);
 if(dull)delete accents[kind];
 const leafBase=new T.Color(dull?dullInWinter(shades[kind]||'#5b7f44'):own?.leaf||shades[kind]||'#5b7f44'),barkBase=new T.Color(own?.bark||barks[kind]||'#6b5942');
 // THE BRANCHES OF A BARE TREE (twigs.js; mesh-assets.js bareParts), one set a
 // model. A shrub's twig is thicker for its height than a tree's (PLACED: as
 // thick as an 18 m tree's up to four times). Fine wood is darker than a trunk
 // and no paler than a dark grey-brown, whatever the bark: a white birch's
 // twigs are nearly black against the sky.
 const leafless=bare(view,kind),meanHeight=trees.reduce((s,t)=>s+t.h,0)/Math.max(1,trees.length),barkLight=barkBase.getHSL({}).l;
 const twig=leafless?{width:Math.round(Math.min(4,Math.max(1,18/meanHeight))*2)/2,shade:Math.round(Math.min(.85,.3/barkLight)*20)/20,tip:Math.round(Math.min(.65,.2/barkLight)*20)/20,keep:TRUNK_ACCENT.has(kind)?['accent']:[]}:null;
 const turns=autumnLeaves(view)&&!EVERGREEN.has(kind)&&!own;
 // A species whose stone role is a flower (the prairie forbs' gold), not rock.
 const stones={prairieforbs:'#e0b030',grapevine:'#9a9a96',beachrose:'#c8402a'};
 const stone=new T.Color(stones[kind]||world.bio.rock||'#8a8577'),dirt=new T.Color(world.bio.rough||'#7e8a5a');
 const dummy=new T.Object3D();dummy.rotation.order='YXZ';
 const UP_AXIS=new T.Vector3(0,1,0),coverNormal=new T.Vector3(),coverTilt=new T.Quaternion();
 const coverFade=teeFade(world);
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
  // Ground cover shortens toward a tee's mown edge (teeFade; the polish
  // goal's tee surrounds, round 4): the planted marram and dune grass stood
  // full height at the edge after the scattered grass had faded.
  const nearTee=coverFade&&(GROUND_PLANTS.has(kind)||SPREAD_SIZED.has(FAMILY_OF[kind]))?.35+.65*coverFade(t.x,t.z):1;
  const sy=(spread||t.h*lift)*nearTee,sxz=(spread||t.h*lift*girth)*nearTee;
  // Seated: drawn down by the drop under its foot, so no trunk hangs over a
  // slope, and ground cover laid along the slope first (tree-seat.js). The
  // generator's y, and every collider, stay put.
  const pose=plantPose(t,world.height);
  dummy.position.set(t.x,t.y-pose.depth,t.z);
  dummy.rotation.set((rng()-.5)*.10,rng()*6.28,(rng()-.5)*.10);
  if(pose.gx||pose.gz){coverTilt.setFromUnitVectors(UP_AXIS,coverNormal.set(-pose.gx,1,-pose.gz).normalize());dummy.quaternion.premultiply(coverTilt);}
  dummy.scale.set(sxz,sy,sxz);
  dummy.updateMatrix();
  const leaf=leafBase.clone();
  // Leaf fall turns the broadleaves, never an evergreen (the New England pack:
  // its white pines and firs came out orange when only `spruce` was spared),
  // each in its own hue: maple red, birch and aspen yellow, beech bronze.
  if(turns)leaf.setHSL((FALL_HUE[kind]??.055)+t.shade*.035,.62+t.shade*.18,.35+t.shade*.12);
  else varyColour(leaf,(rng()-.5)*.045,(rng()-.5)*.12,(rng()-.5)*.10);
  entries.push({model,owner:t,matrix:dummy.matrix.clone(),parts:twig?bareParts(model,twig):null,
   color:{leaf,bark:varyColour(barkBase.clone(),0,(rng()-.5)*.10,(rng()-.5)*.10),stone,dirt,accent:accents[kind]?new T.Color(accents[kind]).offsetHSL(0,(rng()-.5)*.08,(rng()-.5)*.08):leaf}});
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
 // A PAINTED MODEL (the cartoon overhaul, tools/blender/cartoon.py) carries
 // its own shading -- a dark core, light tips -- as vertex colour, and its
 // foliage normals are bent toward the crown's centre, so it is lit through
 // the scene's one soft ramp like the ground it stands on. The pack models
 // keep the material they always had (no ramp: three's flat 0.7 floor) until
 // each is replaced.
 // THIN LEAVES ARE SEEN FROM BOTH SIDES (the cartoon overhaul): a palm frond,
 // a hala's strap leaves, a bracken frond and an ocotillo's leaves are single
 // faces, not closed lobes, and with back faces culled the palms' crowns read
 // thin from below and the hala's tufts all but vanished (island-r3 in the
 // game). Only these: a closed crown drawn two-sided would shade its hidden
 // inside for nothing.
 const thin=THIN_LEAVES.has(FAMILY_OF[kind]);
 const materialFor=(role,variant,painted)=>{
  const key=role+(painted?'|painted':'');
  if(!materials.has(key)){
   const base=painted?new T.MeshToonMaterial({color:'#ffffff',vertexColors:true,gradientMap:toonRamp(view),side:thin&&role==='leaf'?T.DoubleSide:T.FrontSide}):new T.MeshToonMaterial({color:'#ffffff'});
   const swayed=sway&&['leaf','bark','accent'].includes(role)?windMaterial(base,view,sway,false,true,role!=='bark',false,painted):base;
   // A painted crown catches a rim of sky at its edges (textures.js rimLit).
   const lit=painted&&role==='leaf'?rimLit(swayed):swayed;
   materials.set(key,view.snowTops?snowTopped(lit):lit);
  }
  return materials.get(key);
 };
 instanceModels(group,entries,materialFor,({mesh,matrices,owners})=>{
  // A BUSH'S SHADOW IS NEAR WORK (the frame-rate pass): knee- to head-high
  // plants by the thousand went into every shadow map, where a texel is half
  // a metre and more past the first. Only the nearest map takes them now
  // (instance-cull.js `shadowNear`).
  if(GROUND_PLANTS.has(kind))mesh.userData.shadowNear=true;
  // A PAINTED CROWN DOES NOT RECEIVE THE SHADOW MAP (the cartoon overhaul).
  // Its paint and its normals, bent toward the crown's centre, already shade
  // it as one body; sampled against the shadow map as well, those bent
  // normals put the shadow lookup on the wrong side of its own lobes and the
  // crown comes up speckled with acne (seen on the first in-game round). It
  // still casts its shadow on the ground and everything else.
  if(mesh.geometry.attributes.flex&&mesh.userData.role==='leaf')mesh.receiveShadow=false;
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
  if(autumnLeaves(view)&&kind!=='spruce')tint.setHSL((kind==='maple'?.0:kind==='aspen'?.11:.055)+t.shade*.035,.62+t.shade*.18,.35+t.shade*.12);
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
 view.treeInstances=[];view.viewBlockers=[];let lastHidden=new Set(),lastMode='',held=null,last=new T.Vector3(Infinity,Infinity,Infinity),lastLook=new T.Vector3(Infinity,Infinity,Infinity);const zero=new T.Matrix4().makeScale(0,0,0);
 // An instance is drawn unless the camera is standing inside that tree.
 view.clearCameraTrees=()=>{
  // The vegetation tests build a view with no camera -- they only ever look
  // at the geometry -- so this has to be safe to call without one.
  if(!view.camera)return;
  // The point looked at counts too: a turned aim brings other trees into the way.
  const look=view.look??view.camera.position,mode=view.config?.mode;
  const moved=last.distanceToSquared(view.camera.position)+(lastLook.distanceToSquared(look));
  if(moved<.04)return;
  // Into free flight from a play view: what was cleared stays cleared, from
  // where the camera stood, until it moves (camera-tours.js keepsCleared).
  if(mode==='free'&&lastMode&&lastMode!=='free'&&lastMode!=='overview'&&!view.orbiting)held={x:last.x,y:last.y,z:last.z,owners:lastHidden};
  if(mode!=='free')held=null;
  lastMode=mode;
  last.copy(view.camera.position);lastLook.copy(look);
  // Trees between the play camera and what it looks at go too (camera-tours.js
  // treeBlocksView) -- not in free flight or the overview, where trees are the
  // view -- and so does anything else in the way (`viewBlockers`). The main
  // menu's circling camera clears them too (`view.orbiting`, main.js): it
  // sat inside a fir that filled the frame (audit 2).
  const clearView=(mode&&mode!=='free'&&mode!=='overview')||!!view.orbiting;
  const target=view.ball?.visible?view.ball.position:look;
  const blocks=t=>cameraInsideTree(view.camera.position,t)||(clearView&&(treeBlocksView(view.camera.position,target,t)||treeBlocksView(view.camera.position,look,t)));
  const hidden=new Set(view.world.trees.filter(blocks));
  const others=new Set();for(const b of view.viewBlockers)for(const o of b.owners)others.add(o);
  for(const o of others)if(blocks(o))hidden.add(o);
  if(keepsCleared(held,view.camera.position))for(const o of held.owners)hidden.add(o);else held=null;
  lastHidden=hidden;
  for(const batch of [...view.treeInstances,...view.viewBlockers]){
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
 // A STAND'S UNDERSTORY (course.js, `under`) is shrubs and ferns a ball
 // passes through, so a tier may draw a share of it without two players
 // meeting different courses (graphics.js `understory`): picked by a hash of
 // where each stands, so the same ones every time.
 const underShare=view.quality?.understory??1,keepUnder=t=>!t.under||(Math.abs(Math.sin(t.x*12.9898+t.z*78.233)*43758.5453)%1)<underShare;
 const drawn=view.world.trees.filter(keepUnder);
 for(const kind of new Set(drawn.map(t=>t.kind)))addSpecies(view,kind,drawn.filter(t=>t.kind===kind));

 addDeadfall(view);
 addDriftwood(view);
 addLongGrass(view);
 addFarHeath(view);
 addFarWoods(view);
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
//
// What it is made of is the biome's `floor`: the grove's logs, stumps and mossy
// boulders.
function addDeadfall(view) {
 const {world} = view, {deadfall: count, floor: mix} = biomeOf(world.settings.biome);
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
  if (!allows(world.surface(x, z), 'trees') || world.nearest(x, z).d < 8) continue;
  // Deadfall is knee height, so this only ever bites close to a tee -- which
  // is the one place a log in the shot path is worth removing.
  if (blocksLaunch(launch, x, z, world.height(x, z), world.height(x, z) + 1.6)) continue;
  if (onShoreBank(world, x, z)) continue;

  let r = rng(), family = mix[mix.length - 1][0];
  for (const [k, f] of mix) { r -= f; if (r <= 0) { family = k; break; } }
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
  // `accent` is the cut face on a log and the moss on a boulder, so it follows
  // the family rather than being one colour for everything.
  const accent = family === 'mossrock' ? green : cut.clone().offsetHSL(0, 0, (rng() - .5) * .12);
  // As the view clears it: a log lies about three times as long as it is thick.
  const owner = viewBlocker(x, world.height(x, z), z, size * (family === 'log' ? 3 : 1.2), size);
  entries.push({model, owner, matrix: dummy.matrix.clone(),
   color: {bark: wood, leaf: green, stone: stone.clone().multiplyScalar(.8 + rng() * .35), dirt, accent}});
 }
 const materials = new Map();
 // Painted since the cartoon overhaul (tools/blender/cartoon_deadfall.py).
 const materialFor = (role, variant, painted) => {
  const key = role + (painted ? '|p' : '');
  if (!materials.has(key)) materials.set(key, new T.MeshToonMaterial({color: '#ffffff', vertexColors: !!painted, gradientMap: painted ? toonRamp(view) : null}));
  return materials.get(key);
 };
 instanceModels(group, entries, materialFor, ({mesh, matrices, owners}) => addViewBlockers(view, mesh, matrices, owners));
}

// DRIFTWOOD ON THE BEACH (Lakeshore Dunes): bleached logs the lake has thrown
// up, built in Blender (tools/blender/lakeshore.py, Blender_Driftwood_*).
// Decoration like the forest floor -- the course never hears of it and
// nothing collides with it -- so it is placed here, from its own random
// stream, and moves no generated ground. Only on the beach band: open sand
// between the waterline and the height where the beach stops (BEACH_RISE),
// where a lake actually leaves its wood. Sizes are PLACED: 0.25-0.5 m thick,
// three to five metres long by the models' own proportions.
// LONG GRASS BETWEEN THE HOLES (the cartoon overhaul; the owner's addendum:
// "a large library of brush, bushes, LONG grass ... for each biome", and on a
// links "the long grass ... for the areas between holes"). Clumps built in
// Blender (tools/blender/cartoon_grass.py) -- fescue and marram on a links,
// big bluestem on the prairie, alpine tussocks, desert bunchgrass, forest
// sedge, a dead moor tussock, island plume grass -- planted in colonies of a
// few clumps, in drifts, on wild ground at least `near` metres outside the
// corridors. A biome's `longGrass` record names the families (with each one's
// height), how many colonies, and its two colours. Decoration like the
// driftwood: the course never hears of it, nothing collides with it, it is
// placed from its own stream, so it moves no generated ground. The graphics
// tier's grass share scales the count. It bends from its root as a tree
// does (windMaterial `crown`), four times as freely for its size. It casts no shadow -- a hundred
// thousand blades in every shadow map is cost for nothing a player sees.
// PLACED: every number in the records.
// Shrinks an instance toward its root between 60% of `reach` and `reach`
// metres from the camera. Chained after the material's other patches.
function sinkBeyond(material,reach){
 if(!reach)return material;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.customProgramCacheKey=()=>key.call(material)+'-sink'+reach;
 material.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('mvPosition=modelViewMatrix*mvPosition;',`float sink=1.-smoothstep(${(reach*.6).toFixed(1)},${reach.toFixed(1)},distance(mvPosition.xz,cameraPosition.xz));mvPosition.y=instanceMatrix[3].y+(mvPosition.y-instanceMatrix[3].y)*sink;mvPosition=modelViewMatrix*mvPosition;`);};
 return material;
}
// THE FADE FROM A TEE INTO THE TALL GRASS (the polish goal; the owner: "a
// better fade into taller grass from the tee boxes on the links course").
// The tiled grass went from short to tall at a hard 10 m from the tee's
// point -- a wall, and not even round the mown shape -- and the long-grass
// colonies ignored tees altogether. Now both ask how far a spot is from the
// nearest mown tee's EDGE (its pad and collar, the shape ground.js paints)
// and fade: nothing tall within `TEE_FADE.clear`, then rising in height and
// in how much of it grows over `TEE_FADE.span`. Decoration only: the ground
// and its lie are as they were. PLACED.
export const TEE_FADE = {clear: 1.2, span: 5.8};
// THE CARRY (round 8 of the far-landscape goal's shared fairways, judged from
// the tee): 0 inside a hole's corridor between its tee and the start of its
// fairway, rising to 1 over `CARRY_EDGE` m outside it. Tall grass there hid
// the fairway the golfer is aiming at. Each hole's carry boxed in the world
// first, so most points cost a few comparisons. Decoration only. PLACED.
export const CARRY_EDGE = 8;
export function carryFade(world) {
 const holes = world.holes.filter(h => !h.range).map(h => {
  const z1 = h.mowStart ?? h.fairwayStart ?? 22, corners = [];
  for (const z of [-30, z1 / 2, z1]) for (const s of [-1, 1]) corners.push(h.toWorld({x: h.center(Math.max(0, z)) + s * (h.width(Math.max(0, z)) + CARRY_EDGE + 4), z}));
  const xs = corners.map(p => p.x), zs = corners.map(p => p.z);
  return {h, z1, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)};
 });
 return (x, z) => {
  let f = 1;
  for (const c of holes) {
   if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
   const p = c.h.toLocal({x, z});
   if (p.z > c.z1 || p.z < -30) continue;
   const zz = Math.max(0, p.z), out = Math.abs(p.x - c.h.center(zz)) - c.h.width(zz);
   f = Math.min(f, Math.max(0, Math.min(1, out / CARRY_EDGE)));
  }
  return f;
 };
}
export function teeFade(world) {
 const tees = [];
 for (const h of world.holes) for (const t of Object.values(h.tees || {})) {
  const p = teePad(t);
  if (!p) continue;
  tees.push({h, x: t.x, z: p.z, ux: p.ux, uz: p.uz, hz: p.rz * TEE_APRON_SCALE, w: h.toWorld({x: t.x, z: p.z})});
 }
 const hx = TEE_APRON.x, r = TEE_ROUND * TEE_APRON_SCALE, reach = TEE_FADE.clear + TEE_FADE.span;
 return (x, z) => {
  let d = Infinity;
  for (const t of tees) {
   if ((t.w.x - x) ** 2 + (t.w.z - z) ** 2 > (reach + 12) ** 2) continue;
   const l = t.h.toLocal({x, z}), dx = l.x - t.x, dz = l.z - t.z;
   const qa = Math.abs(dx * t.uz - dz * t.ux) - hx + r, qb = Math.abs(dx * t.ux + dz * t.uz) - t.hz + r;
   d = Math.min(d, Math.hypot(Math.max(qa, 0), Math.max(qb, 0)) + Math.min(Math.max(qa, qb), 0) - r);
  }
  if (d === Infinity) return 1;
  const f = Math.min(1, Math.max(0, (d - TEE_FADE.clear) / TEE_FADE.span));
  return f * f * (3 - 2 * f);
 };
}
// THE FAR WOODS (far-woods.js): real crowns from the property line out to
// the landscape's edge, by distance bands. Two instanced meshes: NEAR crowns
// (clusters of three lumps, or two-tier spruces on the conifer landscapes,
// under 250 triangles), and FAR groves (one low faceted dome each, 20
// triangles, standing for a stand of trees -- the owner: "LODs can fade but
// should not transition to just bare ground"). No shadow cast (scenery, past
// every shadow map), lit by the toon ramp, fogged as the ground is. Low draws
// every site as a grove dome (graphics.js `farWoods: 'groves'`), the cheapest.
// The far woods' shapes (far-woods.js FAR_SHAPES), each at unit radius with
// a flat base at its origin -- the seat in far-woods.js lets that base down
// onto the drawn ground, so nothing of a crown's underside hangs in the air.
// Round 2 of the polish goal: a single cone read as a plain spike beside the
// cartoon spruces, and a single lump as a ball: a spruce is two stacked tiers,
// a broadleaf three lumps clustered. Round 6 (frame rate): 20-face lumps.
export function farWoodGeometry(kind){
 // A lump's underside is cut flat (it was squashed into a shallow bowl, whose
 // rim stood off flat ground by a tenth of a grove's width).
 const lump=(x,y,z,s)=>{let g=new T.IcosahedronGeometry(1,0);const p=g.attributes.position;for(let i=0;i<p.count;i++){const yy=p.getY(i),k=1+.12*Math.sin(p.getX(i)*5.1+p.getZ(i)*3.7);p.setXYZ(i,p.getX(i)*k*s+x,(yy<-.3?-.3:yy*k)*s+y,p.getZ(i)*k*s+z);}g=mergeVertices(g);return g;};
 let geo;
 if(kind==='spruce'){const a=new T.ConeGeometry(1,.6,7,1).translate(0,-.2,0),b=new T.ConeGeometry(.7,.55,7,1).translate(0,.22,0);geo=mergeGeometries([a,b]);a.dispose();b.dispose();}
 // The three lumps cut on one floor, so each rests on the ground (their own
 // cuts sat 3 cm of a unit apart, the higher two hanging).
 else if(kind==='cluster'||kind==='scrub'){const parts=[lump(0,0,0,1),lump(.55,-.12,.2,.7),lump(-.45,-.1,-.35,.65)];geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  const p=geo.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<-.295)p.setY(i,-.295);}
 else if(kind==='cone')geo=new T.ConeGeometry(1,1,6,1);
 // A `dead` far forest's trunks (round 3 of the far landscape, for Haunted
 // Hollow, since removed; kept for bare winter woods): three bare
 // spikes leaning a little apart, each with two broken limbs, on one floor.
 else if(kind==='snags'){const parts=[];for(const [x,z,h,lean] of [[0,0,1,.04],[.42,.2,.78,-.08],[-.3,-.36,.66,.07]]){
   const t=new T.ConeGeometry(.07,h,5,1).translate(0,h/2,0).rotateZ(lean).translate(x,0,z);parts.push(t);
   for(const [y,a] of [[.55,.9],[.72,-1.1]]){const l=new T.ConeGeometry(.025,.3*h,4,1).translate(0,.15*h,0).rotateZ(a).translate(x+Math.sin(-lean)*y*h,y*h,z);parts.push(l);}}
  geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());}
 else geo=lump(0,0,0,1);
 geo.computeBoundingBox();geo.translate(0,-geo.boundingBox.min.y,0);
 const [w,h]=FAR_SHAPES[kind].scale;geo.scale(w,h,w);geo.computeVertexNormals();geo.computeBoundingBox();
 return geo;
}
function addFarWoods(view){
 const {world}=view,f=biomeOf(world.settings.biome).farForest;
 if(!f||view.quality?.farWoods===false)return;
 const groveOnly=view.quality?.farWoods==='groves',sites=farWoodSites(world,{groves:groveOnly});
 if(!sites.length)return;
 // One instanced set per shape drawn (round 3: Autumn's evergreens add spruces
 // and cones to its clusters and domes).
 const kinds=[...new Set(sites.map(s=>s.shape))];
 const mat=new T.MeshToonMaterial({color:'#ffffff',gradientMap:toonRamp(view)});
 // In the round's season (seasons.js seasonPalette, via world.bio).
 const colors=(world.bio?.farForest?.colors??f.colors).map(c=>new T.Color(c)),c=new T.Color(),dummy=new T.Object3D(),up=new T.Vector3(),Y=new T.Vector3(0,1,0),spin=new T.Quaternion();

 // Round 6 (frame rate): in TWELVE SECTORS round the course, each its own
 // mesh with its own bounds, so the card skips every sector out of view --
 // one mesh round the whole course drew all 17,000 crowns every frame
 // (measured 9-11% of a Medium frame). No shadow received either; it made no
 // difference, but none reaches out here.
 const build=(list,geo,place,name)=>{
  if(!list.length){geo.dispose();return;}
  const sectors=Array.from({length:12},()=>[]);
  for(const s of list)sectors[Math.floor(((Math.atan2(s.z,s.x)/(2*Math.PI))+1)*12)%12].push(s);
  for(const part of sectors){
   if(!part.length)continue;
   const mesh=new T.InstancedMesh(geo,mat,part.length);
   part.forEach((s,i)=>{place(s);mesh.setMatrixAt(i,dummy.matrix);
    c.copy(s.evergreen?colors[colors.length-1]:colors[Math.floor(s.pick*colors.length)%colors.length]).multiplyScalar(.88+s.size*.2);mesh.setColorAt(i,c);});
   // Drawn BEFORE the ground (renderOrder -1): the cost was filling pixels
   // over landscape already shaded by the ground's long shader; drawn first,
   // the ground behind a crown fails the depth test and is never shaded.
   mesh.castShadow=false;mesh.receiveShadow=false;mesh.name=name;mesh.userData.noCull=true;mesh.renderOrder=-1;
   mesh.computeBoundingSphere();view.group.add(mesh);
  }
 };
 // Each crown on its seat: its base point, turned to the ground's slope where
 // its shape tilts, spun about its own axis.
 const pose=(seat,r,x,z,pick)=>{up.set(seat.ux,seat.uy,seat.uz);dummy.quaternion.setFromUnitVectors(Y,up).multiply(spin.setFromAxisAngle(Y,pick*6.28));
  dummy.position.set(x,seat.y,z);dummy.scale.setScalar(r);dummy.updateMatrix();};
 // A grove: as wide as its site's spacing (a stand of trees), drawn smaller
 // where the ground under it is broken (far-woods.js).
 for(const kind of kinds)build(sites.filter(s=>s.shape===kind),farWoodGeometry(kind),s=>pose(s.seat,s.r,s.x,s.z,s.pick),kind==='dome'||kind==='cone'?'Far groves':'Far woods');
}
// A LONG GRASS'S OWN COLOURS (seen 3 November 2026): a family with a season
// table (season-tints.js, the prairie pack's LOOK) wears its own -- tall
// fescue light green the year round, little bluestem blue-green and copper in
// autumn -- which never reached the game: every family took the landscape's
// one leaf and accent, so the transition zone's fescue was autumn orange in
// July and no prairie turned. The older families have no table and keep the
// landscape's. `bloomHeads`: a field in flower, the landscape's accent stays.
// The table's colours straight read as teal clumps under candy-pink heads on
// the game's warm rough (the first picture), so each is drawn part of the way
// to the landscape's. PLACED by eye: GRASS_OWN of the family's own.
const GRASS_OWN=.55;
// `green`: how far this landscape's rough is green in this season (seasons.js
// GREEN): the long grass goes with it, at half that, or a green rough stood
// full of straw tussocks.
export const grassLook=(rec,family,season,green=0)=>{const own=SEASON_TINTS[family]?.[season],mix=(a,b)=>new T.Color(b).lerp(new T.Color(a),GRASS_OWN),rich=new T.Color(RICH);
 const leaf=own?.leaf?mix(own.leaf,rec.leaf):new T.Color(rec.leaf);
 const accent=own?.accent&&!rec.bloomHeads?mix(own.accent,rec.accent):new T.Color(rec.accent);
 return {leaf:leaf.lerp(rich,green*.5),accent:rec.bloomHeads?accent:accent.lerp(rich,green*.5)};};
// NO CLUMP A FAN (seen 3 November 2026): a model is scaled by its height, and
// Blender_TallFescue_2's arching blades barely rise (radius 3.3 times its
// height): at 0.9 m tall it lay six metres across. Squeezed in to this many
// times its height. PLACED: just past Bunch_1, the widest that read right.
const GRASS_WIDEST=1.6;
function addLongGrass(view){
 const {world}=view,rec=biomeOf(world.settings.biome).longGrass,offDrive=onDrive(world.homes);
 if(!rec)return;
 const byTee=teeFade(world),carry=carryFade(world);
 const group=new T.Group();group.name='Long grass';view.group.add(group);
 const rng=random(world.seed+':longgrass'),dummy=new T.Object3D();dummy.rotation.order='YXZ';
 const season=seasonOfView(view);
 const kinds=rec.families.map(([family,weight,height])=>{const cured=view.snowTops&&!SEASON_TINTS[family]?.winter,look=grassLook(rec,family,season,Math.min(1,roughGreen(world.settings.biome,season)+(season==='spring'?world.bio.springNative??0:0)));if(cured){look.leaf=new T.Color(curedInWinter(`#${look.leaf.getHexString(T.SRGBColorSpace)}`));look.accent=new T.Color(curedInWinter(`#${look.accent.getHexString(T.SRGBColorSpace)}`));}return {models:familyModels(family),weight,height:height*(view.snowTops?SNOW_GRASS_HEIGHT:1),look};}).filter(k=>k.models.length);
 if(!kinds.length)return;
 const total=kinds.reduce((n,k)=>n+k.weight,0),pickKind=()=>{let r=rng()*total;for(const k of kinds){r-=k.weight;if(r<=0)return k;}return kinds[kinds.length-1];};
 const entries=[];
 // The landscape's bloom in the heads, colony by colony, so it lies in drifts
 // and reads from far off (no new mesh: the same tufts, painted).
 const bloom=bloomIn(biomeOf(world.settings.biome).key,seasonOfView(view));
 const colonies=Math.round(rec.count*(view.quality?.grass??1));
 for(let tries=0,made=0;made<colonies&&tries<colonies*6;tries++){
  const cx=(rng()-.5)*world.halfX*2,cz=(rng()-.5)*world.halfZ*2;
  // Drifts: a broad wave the colonies gather in, so the long grass lies in
  // swathes with open ground between, as it does in life.
  const drift=.5+.5*Math.sin(cx/53+Math.sin(cz/71)*1.7)*Math.cos(cz/47-Math.sin(cx/89));
  if(rng()>drift*drift)continue;
  if(world.nearest(cx,cz).d<rec.near)continue;
  const kind=pickKind(),n=8+Math.floor(rng()*7);
  const head=bloom&&spotHash(cx,cz)<bloom.amount*BLOOM_HEADS?new T.Color(bloom.colours[Math.floor(spotHash(cz,cx)*bloom.colours.length)]):kind.look.accent;
  for(let k=0;k<n;k++){
   const a=rng()*6.28,r=Math.sqrt(rng())*4,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,at=world.surface(x,z);
   if(!allows(at,'grass')||offDrive(x,z)||onShoreBank(world,x,z,false))continue;
   // By a tee: thinner and shorter toward its mown edge, none at it.
   // And out of a tee's carry (carryFade).
   const fade=Math.min(byTee(x,z),carry(x,z));if(fade<1&&rng()>Math.pow(fade,.7))continue;
   const model=kind.models[Math.floor(rng()*kind.models.length)],h=kind.height*(.75+rng()*.5)*(.35+.65*fade);
   dummy.position.set(x,world.height(x,z),z);
   dummy.rotation.set((rng()-.5)*.08,rng()*6.28,(rng()-.5)*.08);
   const squeeze=Math.min(1,GRASS_WIDEST/modelRadius(model));
   dummy.scale.set(h*(.9+rng()*.3)*squeeze,h,h*(.9+rng()*.3)*squeeze);
   dummy.updateMatrix();
   const tint=kind.look.leaf.clone().offsetHSL((rng()-.5)*.03,(rng()-.5)*.1,(rng()-.5)*.08);
   entries.push({model,owner:null,matrix:dummy.matrix.clone(),color:{leaf:tint,accent:head.clone().offsetHSL(0,(rng()-.5)*.08,(rng()-.5)*.08)}});
  }
  made++;
 }
 const materials=new Map();
 const materialFor=(role,variant,painted)=>{
  const key=role+(painted?'|p':'');
  if(!materials.has(key))materials.set(key,sinkBeyond(groundLit(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,vertexColors:!!painted,gradientMap:toonRamp(view)}),view,4,false,true,true,false,!!painted)),reach));
  return materials.get(key);
 };
 // DRAWN ONLY SO FAR (the frame-rate pass): a clump is a few pixels at two
 // hundred metres, and Links drew 77,000 of them -- 15.7 M triangles -- to
 // the horizon. Past the tier's reach the cull drops whole squares
 // (instance-cull.js `cullReach`); over the last 40% before it each clump
 // sinks into the ground, so nothing pops where the squares stop.
 const reach=view.quality?.longGrassReach??0;
 instanceModels(group,entries,materialFor,({mesh})=>{mesh.castShadow=false;if(reach)mesh.userData.cullReach=reach;});
}

// THE HEATHER'S COLOURS: a cushion's leaf and its bloom, purple where the
// landscape's heather blooms, grey-brown on a dead moor. The near cushions
// (addNearbyGrass) and the far heath (addFarHeath) both paint with them, so
// one turns into the other without a change of colour.
const heathColours=()=>({leaf:'#5a5a3c',accent:'#a86aa8'});
// A BUILT course (built-world.js) has no landform: its heather is its own
// outlines, whatever the landscape (and so the lie the cushions stand on).
const hasHeath=w=>!!(w.holes.length&&(w.built?w.builtOutlines?.heather?.length:Object.values(biomeOf(w.settings.biome).landform?.kinds||{}).includes('heather')));
// THE HEATH PAST THE NEAR TILES (the owner, 31 October 2026, Links: "the
// purple bushes fade out completely leaving just weird looking purple
// ground"). The heather's cushions are near-field decoration, shrinking away
// between 28 and 48 m with the grass tiles, and nothing stood on heather past
// them -- the long grass grows only where grass may, and heather allows none
// -- so beyond 48 m a heath was flat purple paint, which the overhaul had
// already found cannot give it volume (CARTOON_OVERHAUL.md, *Heather*, round
// 6). Here each cushion far off is a low dome in the cushion's own colours,
// as a far wood is a dome for its trees: growing in where the near cushions
// shrink away, and sinking out at the tier's long-grass reach, where the
// squares stop (instance-cull.js `cullReach`). Decoration only, from its own
// stream: nothing collides with it and no ground moves. A dome is 40
// triangles against the cushion model's 2,400. Placed one a `spacing` square,
// jittered, wherever the ground is heather. PLACED: the spacing, sizes, bloom
// share and cross-fade.
const FAR_HEATH={spacing:2.6,most:30000,near:[28,48]};
export function addFarHeath(view){
 const {world}=view,reach=view.quality?.longGrassReach??0;
 if(!hasHeath(world)||reach<=FAR_HEATH.near[1])return;
 const rng=random(world.seed+':farheath'),dummy=new T.Object3D(),c=new T.Color();
 const {leaf,accent}=heathColours(world.settings.biome),leafC=new T.Color(leaf),accentC=new T.Color(accent);
 // Heather is only ever where its channel of the baked field reads half or
 // more (landforms.js wildGround), and that read is a few array lookups; the
 // whole surface question, about 3 microseconds, is asked only there.
 const channel=world.built?null:Object.keys(world.landform.kinds).find(k=>world.landform.kinds[k]==='heather');
 const field=world.built?()=>true:(x,z)=>Math.abs(x)<world.wild.ex&&Math.abs(z)<world.wild.ez&&wildAt(world.wild,channel,x,z)>=.5;
 // Thinner on a tier with less grass, as the long grass is; and on a course
 // with more heath than `most` domes would cover at `spacing` (Haunted
 // Hollow's moor, a fifth of the property: 67,000 domes added a third of a
 // second to Medium's wait), spaced out to that many -- the heath counted
 // every six steps. (Counted from the field alone it read two to three times
 // the heath, the field running on into the corridors' gates, and thinned
 // Links' too.)
 let step=FAR_HEATH.spacing/Math.sqrt(Math.min(1,view.quality?.grass??1)),seen=0;
 for(let x=-world.halfX;x<world.halfX;x+=step*6)for(let z=-world.halfZ;z<world.halfZ;z+=step*6)if(field(x,z)&&world.surface(x,z)==='heather')seen+=36;
 if(seen>FAR_HEATH.most)step*=Math.sqrt(seen/FAR_HEATH.most);
 const matrices=[],colors=[];
 for(let x0=-world.halfX;x0<world.halfX;x0+=step)for(let z0=-world.halfZ;z0<world.halfZ;z0+=step){
  const x=x0+rng()*step,z=z0+rng()*step,h=.3+rng()*.25,bloom=rng(),turn=rng(),shade=rng();
  if(!field(x,z)||world.surface(x,z)!=='heather')continue;
  dummy.position.set(x,world.height(x,z)-h*.12,z);dummy.rotation.set(0,turn*6.28,0);dummy.scale.set(h*1.7,h,h*1.7);dummy.updateMatrix();
  matrices.push(dummy.matrix.clone());
  colors.push(c.copy(leafC).lerp(accentC,.25+bloom*.5).offsetHSL(0,0,(shade-.5)*.08).clone());
 }
 if(!matrices.length)return;
 // A dome: the top of a sphere, eight segments round and two down.
 const geo=new T.SphereGeometry(1,8,3,0,Math.PI*2,0,Math.PI*.5);
 const mat=new T.MeshToonMaterial({color:'#ffffff',gradientMap:toonRamp(view)});
 const [r0,r1]=FAR_HEATH.near,compile=mat.onBeforeCompile,key=mat.customProgramCacheKey;
 mat.customProgramCacheKey=()=>key.call(mat)+'-farheath'+reach;
 // Its own projection, written out: no wind here (windMaterial is what writes
 // the line sinkBeyond and fadeOut patch, so patching that line on a plain
 // material would change nothing, silently).
 mat.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
   mvPosition=instanceMatrix*mvPosition;
   float heathD=distance(mvPosition.xz,cameraPosition.xz),heathStand=smoothstep(${r0.toFixed(1)},${r1.toFixed(1)},heathD)*(1.-smoothstep(${(reach*.6).toFixed(1)},${reach.toFixed(1)},heathD));
   mvPosition.y=instanceMatrix[3].y+(mvPosition.y-instanceMatrix[3].y)*heathStand;
  #endif
  mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`);};
 const mesh=new T.InstancedMesh(geo,mat,matrices.length);
 matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,colors[i]);});
 mesh.name='Far heath';mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.cullReach=reach;mesh.computeBoundingSphere();
 view.group.add(mesh);view.resources?.push(geo);
}

function addDriftwood(view){
 const {world}=view,per=biomeOf(world.settings.biome).driftwood;
 if(!per||!world.bio.sea)return;
 const models=familyModels('driftwood');
 if(!models.length)return;
 const group=new T.Group();group.name='Driftwood';view.group.add(group);
 const rng=random(world.seed+':driftwood'),dummy=new T.Object3D();dummy.rotation.order='YXZ';
 const count=per*world.holes.length,entries=[];
 const bleached=new T.Color('#b9b2a4'),dirt=new T.Color(world.bio.sand||'#e0d6b4');
 // The beach is a thin band -- about 1.4% of the ground within 320 m of the
 // coast on BEACON -- so for a sea along one edge, which is on the +x side
 // (course.js `land`), the tries stay within reach of it rather than spending
 // most of themselves inland. (A count of the drawn logs reads low: the
 // instance cull keeps only those in view.)
 // The coast's line (course.js coastAt): the window spans its nearest and farthest.
 const lo=(world.coastMin??world.halfX-90)+90,hi=(world.coastMax??world.halfX-90)+90;
 const x0=world.bio.edgeCoast?lo-320:-world.halfX,x1=world.bio.edgeCoast?hi+120:world.halfX;
 for(let i=0;i<count*400&&entries.length<count;i++){
  const x=x0+rng()*(x1-x0),z=(rng()-.5)*world.halfZ*2,y=world.height(x,z);
  if(y<.08||y>BEACH_RISE||world.surface(x,z)!=='sand')continue;
  const model=models[Math.floor(rng()*models.length)],size=.25+rng()*.25;
  dummy.position.set(x,y-size*.15,z);
  dummy.rotation.set((rng()-.5)*.08,rng()*6.28,(rng()-.5)*.08);
  dummy.scale.set(size,size,size);
  dummy.updateMatrix();
  const wood=bleached.clone().offsetHSL((rng()-.5)*.02,(rng()-.5)*.08,(rng()-.5)*.12);
  entries.push({model,owner:viewBlocker(x,y,z,size*4,size),matrix:dummy.matrix.clone(),
   color:{bark:wood,leaf:wood,stone:wood,dirt,accent:wood}});
 }
 // Painted since the cartoon overhaul (tools/blender/cartoon_lakeshore.py).
 const material=new T.MeshToonMaterial({color:'#ffffff',vertexColors:true,gradientMap:toonRamp(view)});
 instanceModels(group,entries,()=>material,({mesh,matrices,owners})=>addViewBlockers(view,mesh,matrices,owners));
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
 const instance=(geo,material,matrices,colors,cast=true)=>{if(!matrices.length){geo.dispose();material.dispose();return;}const mesh=new T.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors)mesh.setColorAt(i,colors[i]);});mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;};
 // Boulders, scrub and flowering/seeded grasses are biome-specific.
 const grass=[],grassColors=[],flowers=[],flowerColors=[];
 // THE WILDFLOWERS (the cartoon overhaul; tools/blender/cartoon_flowers.py):
 // small clusters of daisies, asters and cups standing in the rough, where a
 // 20-face gem sat on a grass tip. The same draws as before decide where one
 // grows and its colour, so the grass after it is where it was; which of the
 // three, and its size, come from where it stands. The gem is the fallback.
 const flowerModels=familyModels('wildflower'),flowerEntries=[],stemTint=new T.Color('#5f8a45'),flowerEye=new T.Color('#f2c84b');
 // WHICH FLOWERS (the seasons): none in winter, none in a spring before the
 // landscape's bloom; in its bloom its own colours, at its own strength, in
 // every landscape. The year's flowers keep their draws in every season, so
 // the grass after them stands where it did.
 const season=seasonOfView(view),bloom=bloomIn(biomeOf(world.settings.biome).key,season),yearRound=FLOWER_REGIONS.has(regionOf(world.settings.biome));
 const bloomSize=bloom?1.7:1;// Bigger in bloom: PLACED, they were specks from a tee.
 const wildflower=(x,z)=>{
  let fc=null;
  if(yearRound&&rng()<.16){const c=biomeOf(world.settings.biome).scatter.flowers[rng()>.5?0:1];if(season!=='winter'&&season!=='spring')fc=new T.Color(blue?'#93d4de':c);}
  if(bloom&&spotHash(z,x)<BLOOM_FLOWERS*bloom.amount)fc=new T.Color(bloom.colours[Math.floor(spotHash(x+z,z)*bloom.colours.length)]);
  return fc;
 };
 // READ, DO NOT INVENT. Boulders are generated in course.js and live on the
 // world, because a rock the generator does not know about is a rock physics
 // cannot collide with -- which is what they were until they moved. Placing
 // them here again would put a second set of stones in different places.
 //
 // THE CARTOON BOULDERS (the cartoon overhaul; tools/blender/cartoon_rocks.py)
 // replace four squashed icosahedra that read as grey gems. A biome's stone is
 // its own geology (`rockStyle`: round granite, angular talus, layered
 // sandstone) and the generator's `shape` (0-3) picks which of four. Each is
 // fitted to the collider the generator built: its bottom at centre - sy, its
 // top at the stone's `top` (centre + sy), its half-widths sx and sz -- so a
 // ball hits the stone it sees. A model rests on its flat base, so it turns
 // about the vertical with only a slight tilt, where a round gem could be
 // tumbled any way. The upward faces are the accent: moss or lichen where the
 // biome names one (`rockMoss`), the stone otherwise. One draw per stone from
 // `rng`, as before, so the grass after it is where it was.
 {
  const bioR=biomeOf(world.settings.biome),style=bioR.rockStyle||'round',family='boulder'+style;
  const models=familyModels(family),entries=[];
  const stoneBase=new T.Color(world.bio.rock),moss=bioR.rockMoss?new T.Color(bioR.rockMoss):null,tilt=new T.Quaternion(),seat=new T.Vector3();
  for(const r of world.rocks||[]){
   const tint=rng(),model=models[r.shape%models.length];
   if(!model)continue;
   const {rx,rz}=modelExtents(model);
   // SEATED ON THE SLOPE (the cartoon overhaul's rocks, round 4). A model
   // rests on a flat base, set level at the stone's centre; on a dune or a
   // hillside its downhill edge hung in the air -- the desert's sandstone
   // slabs most of all, flat and wide. Drawn tilted toward the ground's own
   // slope (at most 22 degrees) and sunk by the rise across its half-width,
   // so its highest point stays at the collider's top (tests/vegetation-
   // variety) and the downhill edge goes into the ground rather than above it.
   // The collider is the generator's and does not move; on a slope the drawn
   // stone now leans inside it rather than matching its level base.
   const e=1.5,gx=(world.height(r.x+e,r.z)-world.height(r.x-e,r.z))/(2*e),gz=(world.height(r.x,r.z+e)-world.height(r.x,r.z-e))/(2*e);
   const slope=Math.min(Math.hypot(gx,gz),Math.tan(22*Math.PI/180)),dir=Math.atan2(gz,gx),across=Math.max(r.sx,r.sz);
   dummy.position.set(r.x,r.y+r.scale*.25-r.sy-across*slope,r.z);
   dummy.rotation.set((r.rot[0]-.5)*.12,r.rot[1],(r.rot[2]-.5)*.12);
   tilt.setFromUnitVectors(UP,seat.set(-Math.cos(dir)*slope,1,-Math.sin(dir)*slope).normalize());
   dummy.quaternion.premultiply(tilt);
   dummy.scale.set(r.sx/rx,2*r.sy,r.sz/rz);
   dummy.updateMatrix();
   const stone=stoneBase.clone().multiplyScalar(.82+tint*.4);
   entries.push({model,owner:viewBlocker(r.x,r.y,r.z,2*Math.max(r.sx,r.sz),r.scale*.25+r.sy),matrix:dummy.matrix.clone(),
    color:{stone,accent:moss?moss.clone().lerp(stone,.25):stone,bark:stone,leaf:stone,dirt:stone}});
  }
  const materials=new Map();
  instanceModels(group,entries,(role,variant,painted)=>{const key=painted?'p':'f';if(!materials.has(key))materials.set(key,new T.MeshToonMaterial({color:'#ffffff',vertexColors:!!painted,gradientMap:ramp??toonRamp(view)}));return materials.get(key);},
   ({mesh,matrices,owners})=>addViewBlockers(view,mesh,matrices,owners));
 }
 const grassCount=Math.round(biomeOf(world.settings.biome).scatter.grass*(view.quality?.grass??1));
 const offDrive=onDrive(world.homes);
 // These blades shorten toward a tee's mown edge too (teeFade; the polish
 // goal's tee surrounds). Round 3 shortened only the native ground's extra;
 // round 5 found -- by asking the running game what stood tall at the tee --
 // that on Links every blade is long (its scatter is the tall-grass kind,
 // up to 1.7 m), and these blades were the spikes at the tee's edge, not the
 // colonies or the marram. All of them now, to 30% at the edge.
 const bladeFade=teeFade(world);
 // And short in a tee's carry where blades grow long (Links; carryFade).
 const tallBlades=!!biomeOf(world.settings.biome).scatter.tallGrass,bladeCarry=tallBlades?carryFade(world):null;
 for(let i=0;i<grassCount;i++){const x=(rng()-.5)*world.halfX*1.96,z=(rng()-.5)*world.halfZ*1.96;const at=world.surface(x,z);if(!allows(at,'grass')||offDrive(x,z)||world.groundCover(x,z)==='straw'||onShoreBank(world,x,z))continue;const patch=.5+.3*Math.sin(x/17+Math.sin(z/24))+.2*Math.cos(z/11);if(rng()>patch)continue;const bf=Math.min(bladeFade(x,z),tallBlades?bladeCarry(x,z):1),h=(biomeOf(world.settings.biome).scatter.bladeLength)*(.4+rng())*(at==='native'?1+.9*bf:1)*(.3+.7*bf);dummy.position.set(x,world.height(x,z),z);dummy.rotation.set(0,rng()*6.28,0);dummy.scale.set(biomeOf(world.settings.biome).scatter.bladeWidth,h,biomeOf(world.settings.biome).scatter.bladeWidth);dummy.updateMatrix();grass.push(dummy.matrix.clone());color.set(biomeOf(world.settings.biome).scatter.bladeTint||world.bio.rough).lerp(new T.Color('#d9ce85'),rng()*.3).multiplyScalar(.9+rng()*.35);grassColors.push(color.clone());const fc=wildflower(x,z);if(fc){if(flowerModels.length){const u=spotHash(x,z),fh=(.2+u*.14)*bloomSize;dummy.scale.set(fh,fh,fh);dummy.updateMatrix();flowerEntries.push({model:flowerModels[Math.floor(u*7)%flowerModels.length],owner:null,matrix:dummy.matrix.clone(),color:{leaf:stemTint,accent:fc,bark:flowerEye}});}else{dummy.position.y+=h*.8;dummy.scale.set(.1,.08,.1);dummy.updateMatrix();flowers.push(dummy.matrix.clone());flowerColors.push(fc);}}}
 const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute([-.16,0,0,0,1,0,.08,0,0,0,0,-.12,0,.85,0,0,0,.12,-.1,0,-.1,.3,.65,.1,.08,0,.08],3));groundShaded(blade,[.62,.95,.62,.62,.95,.62,.62,.95,.62]);instance(blade,groundLit(windMaterial(mat('#fff',{side:T.DoubleSide,vertexColors:true}),view,.22,true)),grass,grassColors,false);instance(new T.IcosahedronGeometry(1,0),windMaterial(mat('#fff'),view,.16),flowers,flowerColors,false);
 // Drawn only to two-fifths of the long grass's reach, sinking before it
 // stops (sinkBeyond): flowers by the thousand to the horizon were 8 M
 // triangles of a Midwest frame.
 if(flowerEntries.length){const fm=new Map(),reach=(view.quality?.longGrassReach??0)*.4;instanceModels(group,flowerEntries,(role,variant,painted)=>{const key=painted?'p':'f';if(!fm.has(key))fm.set(key,sinkBeyond(groundLit(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,vertexColors:!!painted,gradientMap:toonRamp(view)}),view,4,false,true,true,false,!!painted)),reach));return fm.get(key);},({mesh})=>{mesh.castShadow=false;if(reach)mesh.userData.cullReach=reach;});}
}

// Fine grass follows the camera in cached 24 m tiles. The complete course keeps
// its taller meadow patches; only fine blades need this near-field detail.
function addNearbyGrass(view){
 const w=view.world,offDrive=onDrive(w.homes),tileSize=24,tiles=new Map(),group=new T.Group();group.name='Living rough';view.group.add(group);
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
 // Not in a snowy winter: fronds lie under it (seasons.js UNDER_SNOW).
 const floorOn=(view.quality?.forestFloor??0)>0&&!view.snowTops&&!biomeOf(view.world.settings.biome).scatter.noFloor;
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
   if(!allows(w.surface(x,z),'trees')||onShoreBank(w,x,z,false))continue;
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
 // TALL GRASS NEAR THE CAMERA IS THE LANDSCAPE'S OWN LONG GRASS (the cartoon
 // overhaul). Where the near tufts were tall -- native ground, or a biome
 // that grows tall grass everywhere -- they were the short tuft stretched
 // into brown spikes. Now that ground grows clumps of the biome's first
 // long-grass family (tools/blender/cartoon_grass.py; addLongGrass above),
 // one model, a mesh per part riding on the tile like the forest floor,
 // fading out with it. Four in ten of the tall candidates become a clump,
 // since a clump is many blades. PLACED: the share and the sizes.
 const lg=biomeOf(w.settings.biome).longGrass,clumpModel=lg?familyModels(lg.families[0][0])[0]:null;
 const clumpParts=clumpModel?modelParts(clumpModel):null,clumpHeight=lg?.families[0][2]??.8;
 const clumpLook=lg?grassLook(lg,lg.families[0][0],seasonOfView(view),roughGreen(w.settings.biome,seasonOfView(view))):null;
 const clumpLeaf=clumpLook?.leaf??new T.Color('#8a9150'),clumpAccent=clumpLook?.accent??new T.Color('#d8c27a');
 let clumpMat=null;
 const nearTee=teeFade(w),inCarry=carryFade(w);
 if(clumpParts){
  clumpMat=fadeOut(groundLit(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,vertexColors:true,gradientMap:toonRamp(view)}),view,4,false,true,true,false,true)));
  view.lazyMaterials?.push(clumpMat);
  for(const p of clumpParts)standIn(p.geometry,clumpMat);
 }
 // HEATHER HAS VOLUME NEAR THE CAMERA (the cartoon overhaul's heather, round
 // 7). Painted ground alone read as a flat patch however it was coloured
 // (rounds 4-6 of its paint); the heath round the player is low cushions of
 // the heather model (tools/blender/cartoon_shrubs.py), ankle to knee high,
 // in the same tiles and fading with them -- decoration, as the forest floor.
 // Blooming where the landscape's heather is purple, grey-brown on a dead
 // moor. PLACED: the share and the sizes.
 // Past the tiles, addFarHeath's domes take over in the same colours.
 const heathParts=hasHeath(w)?modelParts(familyModels('heatherbush')[0]??''):null;
 const heathLeaf=new T.Color(heathColours(w.settings.biome).leaf),heathAccent=new T.Color(heathColours(w.settings.biome).accent);
 if(heathParts&&!clumpMat){clumpMat=fadeOut(groundLit(windMaterial(new T.MeshToonMaterial({color:'#ffffff',side:T.DoubleSide,vertexColors:true,gradientMap:toonRamp(view)}),view,4,false,true,true,false,true)));view.lazyMaterials?.push(clumpMat);}
 if(heathParts)for(const p of heathParts)standIn(p.geometry,clumpMat);
 const partsTile=(parts,matrices,leaf,accent)=>parts.map(p=>{
  const m=new T.InstancedMesh(p.geometry,clumpMat,matrices.length);
  matrices.forEach((mx,i)=>{m.setMatrixAt(i,mx);m.setColorAt(i,color.copy(p.role==='accent'?accent:leaf).offsetHSL(0,0,((i*.618)%1-.5)*.08));});
  m.userData={noCull:true};m.receiveShadow=true;m.castShadow=false;m.computeBoundingSphere();return m;
 });
 const clumpTile=matrices=>partsTile(clumpParts,matrices,clumpLeaf,clumpAccent);
 const buildTile=(tx,tz)=>{
  const key=keyOf(tx,tz),clumps=[],heaths=[];
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
  for(let i=0;i<count;i++){const x=(tx+rng())*tileSize,z=(tz+rng())*tileSize,surface=w.surface(x,z);
   if(surface==='heather'&&heathParts){
    if(Math.abs(x)<=w.halfX&&Math.abs(z)<=w.halfZ&&rng()<.3){const h=.3+rng()*.25;dummy.position.set(x,w.height(x,z),z);dummy.rotation.set(0,rng()*6.28,0);dummy.scale.set(h,h,h);dummy.updateMatrix();heaths.push(dummy.matrix.clone());}
    continue;
   }
   if(!allows(surface,'grass')||offDrive(x,z)||w.groundCover(x,z)==='straw'||Math.abs(x)>w.halfX||Math.abs(z)>w.halfZ||onShoreBank(w,x,z,false))continue;
   // Not tall round a tee (the cartoon overhaul): a metre of grass in front of
   // the pad hid the ball from the golfer's own eye (lakeshore-r3, -r4). The
   // polish goal: not a wall at 10 m from the tee's point, but a fade from the
   // mown tee's edge (teeFade) -- tall grass thinning and shortening toward it.
   const tallHere=biomeOf(w.settings.biome).scatter.tallGrass||surface==='native';
   // Not tall in the CARRY either (round 8 of the far-landscape goal's shared
   // fairways, judged from the tee): between a tee and the start of its
   // fairway, inside the hole's corridor, waist-high grass hid the whole
   // fairway beyond -- a links' broad shared fairway read from its tee as a
   // thin strip on the horizon. The rough there stays short, so the golfer
   // sees where to aim, and grows tall again over 8 m outside the corridor.
   let fade=nearTee(x,z);
   if(tallHere&&fade>0)fade=Math.min(fade,inCarry(x,z));
   // Round 2: none at all within the clear margin (round 1 let 15% through
   // there, and those stood as spikes at the tee's edge from the ground).
   const tall=tallHere&&(fade>=1||rng()<Math.pow(fade,.7)),height=tall?(.6+rng()*.65)*(.35+.65*fade):.09+rng()*.17;
   if(tall&&clumpParts){
    if(rng()<.4){const h=clumpHeight*(.75+rng()*.5)*(.35+.65*fade);dummy.position.set(x,w.height(x,z),z);dummy.rotation.set(0,rng()*6.28,0);dummy.scale.set(h,h,h);dummy.updateMatrix();clumps.push(dummy.matrix.clone());}
    continue;
   }
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
  if(clumps.length)for(const m of clumpTile(clumps))mesh.add(m);
  if(heaths.length)for(const m of partsTile(heathParts,heaths,heathLeaf,heathAccent))mesh.add(m);
  if(floorOn)for(const m of floorTile(tx,tz,key))mesh.add(m);
  if(mesh.children.length){const dispose=mesh.dispose.bind(mesh);mesh.dispose=()=>{for(const c of mesh.children)c.dispose();dispose();};}
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
