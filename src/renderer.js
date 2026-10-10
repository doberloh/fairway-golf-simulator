import {addHomes} from './homes.js';
import {addStreams} from './streams.js';
import {landscapeGeometry,stitchSeam} from './landscape-edge.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {polesFor,orderPoles,POLE_REACH} from './floodlights.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {aimTarget,createShotEffects} from './shot-visuals.js';
import {makeCameraFlight,holeEstablishingPose,FLIGHT_FLOOR,ARRIVE_HOLD} from './camera-tours.js';
import {mapLayout,mapPoint,tilePlacement} from './course-map.js';
import {clubColour} from './dispersion.js';
import {greenHeatTile} from './green-map.js';
import {createGreenReading} from './green-reading.js';
import {TEE_COLORS,greenGradient} from './course-plan.js';
import {greenDistance} from './course.js';
import {cameraRig,loadCamera} from './camera-prefs.js';
// The amber every tracer used to be, kept as the fallback for a trail that
// names no golfer.
const SHOT_LINE_COLOR='#ffe0a0';
import {groundGeometry,groundMaterial,HOLE_ATLAS} from './ground.js';
import {uiZoom} from './ui-scale.js';
import {rangeTargets} from './range.js';

// A flagstick, to the dimensions that are actually specified.
//
// HEIGHT IS NOT REGULATED. The Equipment Rules govern the flagstick's DIAMETER
// and say nothing at all about how tall it is -- which is the opposite of what
// everyone assumes, this author included. Seven feet is near-universal
// convention rather than a rule, and this is exactly seven feet because there is
// no reason to be a rounded 2.13 m and miss it by 3.6 mm.
//
// The diameters below are the regulated ones and both pass: 14 mm at the top
// against a 50.8 mm limit, and 18 mm where it meets the green against the 19 mm
// limit that applies from 76 mm above the surface to 76 mm below. One millimetre
// of margin on that second one, so do not thicken the base without checking it.
const FLAGSTICK_HEIGHT=7*0.3048, FLAGSTICK_TOP_R=.007, FLAGSTICK_BASE_R=.009;
import {toonRamp} from './textures.js';
import * as T from 'three';
import {addHaunts} from './haunts.js';
import {solarState,defaultHour,advance,loadDaylight,saveDaylight,localHour,starRotation,STAR_AXIS,mistAmount} from './daylight.js';
import {random,greenRadius,fairwayWidth,ovalRadius,hazardProfile,TEE_PAD,TEE_APRON,TEE_MARKER_INSET} from './course.js';
import {addVegetation} from './vegetation.js';
import {cullInstances} from './instance-cull.js';
import {playerCameraPose,flightCameraPose,followPose,framedForBall} from './camera.js';
import {R,CUP_RADIUS,YARD,clamp} from './physics.js';
import {teeAim} from './camera-tours.js';
import {tierOf,greenCues} from './graphics.js';
import {CSM} from 'three/addons/csm/CSM.js';
import {makeGodRays} from './godrays.js';
import {applyCloudShadows,cloudShadowUniforms} from './cloud-shadows.js';
import {makeClouds,applyCloudFade} from './clouds.js';
import {mistUniforms,applyMistTo,profileFor,mistDensities,bakeWaterField,setWaterField} from './mist.js';

import {makeBloom} from './bloom.js';
import {hideForProbe,restoreAfterProbe} from './water-bodies.js';
// The interface font, for text painted onto a canvas: the same one the page
// uses (style.css --font-ui), so a sign on the course matches the HUD over it.
const UI_FONT='system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const TAU=Math.PI*2;
// Channel surfaces carry a per-vertex bank weight so the water feathers out at
// the waterline instead of ending on a hard alpha step. Geometries without the
// attribute (ponds, ocean) get the WebGL default of 0, meaning "no bank here".
// The shoreline fade, as GLSL rather than as a function, because still water
// needs it AND more -- and a second `onBeforeCompile` replaces the first
// rather than adding to it. Setting one on a material that already had one is
// how the shore fade silently disappeared from every pond once still water
// grew ripples of its own.
const SHORE_VERT=['#include <common>','#include <common>\nattribute float shore;varying float vShore;'];
const SHORE_VERT2=['#include <begin_vertex>','#include <begin_vertex>\nvShore=shore;'];
const SHORE_FRAG=['#include <common>','#include <common>\nvarying float vShore;'];
const SHORE_ALPHA='diffuseColor.a*=1.-.8*smoothstep(.5,1.,vShore);';
// The pond's foam strip: v is 0 at the bank and 1 a metre and a half in. A band
// that surges in and out along the shore, broken into lace by drifting noise.
const FOAM_FRAG=`
uniform float waterTime,foamPace,foamGrain;varying vec2 vFoamUv;varying vec3 vFoamWorld;
/* Hash without Sine, (c)2014 David Hoskins, MIT: THIRD_PARTY_NOTICES.txt */float fHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float fNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fHash(i),fHash(i+vec2(1.,0.)),f.x),mix(fHash(i+vec2(0.,1.)),fHash(i+vec2(1.,1.)),f.x),f.y);}
float foamAlpha(){
 // A pond at 30% of the water's own clock: at full speed the lapping read as
 // frantic (the owner, after the first build). A lake a little livelier.
 float v=vFoamUv.y,t=waterTime*foamPace;
 float surge=.42+.16*sin(t*.8+vFoamWorld.x*.23+vFoamWorld.z*.19);
 float band=smoothstep(0.,.12,v)*(1.-smoothstep(surge*.55,surge,v));
 float lace=fNoise(vFoamWorld.xz*2.3*foamGrain+vec2(t*.21,-t*.16))*.62+fNoise(vFoamWorld.xz*5.7*foamGrain-vec2(t*.33,t*.12))*.38;
 return band*smoothstep(.5,.8,lace)*.42;
}
`;
// THE EDGE OF EACH KIND OF WATER, in the water's own shader. Still water (ponds
// and lakes) has its foam as a separate strip (addShoreFoam), because a pond is
// one flat shape that knows nothing of distance from its edge. The others do:
//
//   sea    depth from the ground's heights (seaDepthMap). The swash -- the sheet
//          of broken water that runs up a beach and drains back -- as a foam
//          line whose front runs up quickly and slides back slowly (a 9 s cycle,
//          30% uprush, 70% backwash), with thinner foam left behind it, and a
//          faint line of breakers a little further out, all phased along the
//          coast so it arrives unevenly. Water fades out over its last 35 cm.
//   river  foam gathers in lines where currents meet and along the banks
//          downstream of rough water: long streaks drawn out along the flow and
//          drifting with it, strongest near the banks, and a faint seam.
//   creek  shallow, fast and broken over its bed: scattered white flecks carried
//          downstream, more of them toward the banks.
//
// The foam is lit by the same light the water's own diffuse is (the diffuse the
// lighting put on the water, divided back by the water's own diffuse colour),
// so it dims at dusk with everything else. Added to outgoingLight: at this
// include the lighting has already read diffuseColor (see the glint).
const FOAM_LIGHT=`vec3 foamLight=(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse)/max(diffuseColor.rgb*(1.-metalnessFactor),vec3(.001));`;
const WATER_EDGES={
 still:'',
 sea:`{
  vec2 su=vec2((vWaterWorld.x+seaGrid.x)/(2.*seaGrid.x),(vWaterWorld.z+seaGrid.y)/(2.*seaGrid.y));
  float inside=step(0.,su.x)*step(su.x,1.)*step(0.,su.y)*step(su.y,1.);
  vec2 suv=(su*(seaGrid.zw-1.)+.5)/seaGrid.zw;
  float depth=mix(50.,seaLevel-texture2D(seaHeights,suv).r,inside);
  diffuseColor.a*=smoothstep(0.,.35,depth);
  // At 30% of the water's clock, as the ponds are: at full speed the surf was
  // frantic (the owner). The swash cycle is 9 s of that clock, 30 s of real time.
  float t=waterTime*.3,ph=wNoise(vWaterWorld.xz*.015)*6.2832+wNoise(vWaterWorld.xz*.004+3.1)*3.;
  float cyc=fract(t/9.+ph/6.2832);
  float run=cyc<.3?smoothstep(0.,1.,cyc/.3):1.-smoothstep(0.,1.,(cyc-.3)/.7);
  float front=mix(.62,.03,run);
  float lace=wNoise(vWaterWorld.xz*1.3+vec2(t*.25,-t*.18))*.6+wNoise(vWaterWorld.xz*3.9-vec2(t*.3,t*.1))*.4;
  float lip=smoothstep(front-.05,front,depth)*(1.-smoothstep(front,front+.45,depth));
  float wake=smoothstep(front-.05,front,depth)*(1.-smoothstep(front,front+1.1,depth))*.45;
  float breakers=exp(-pow((depth-1.15)/.22,2.))*.5;
  float foam=clamp((lip*1.25+wake)*smoothstep(.22,.6,lace)+breakers*smoothstep(.45,.8,lace),0.,1.)*inside;
  ${FOAM_LIGHT}
  outgoingLight=mix(outgoingLight,vec3(.93,.96,.95)*foamLight,foam*.9);
  diffuseColor.a=max(diffuseColor.a,foam*.85);
 }`,
 river:`{
  // In the channel's own coordinates, so the foam follows every bend: metres
  // downstream minus how far the water has carried it, and metres across. It
  // drifts at exactly the water's speed (it moved at twice it before, and the
  // owner found it far too fast), and changes shape slowly on its own.
  float t=waterTime,drift=vChan.x-t*length(vFlow),across=vChan.y;
  // Lace drawn out about two to one along the flow -- the first cut stretched
  // it seven to one, and the rare survivors read as white scratches.
  float lace=wNoise(vec2(drift*.8,across*1.6+t*.02))*.6+wNoise(vec2(drift*2.1+t*.03,across*3.4))*.4;
  float bank=smoothstep(.4,.82,vShore)*(1.-smoothstep(.96,1.,vShore));
  float seam=exp(-pow((vShore-.22)/.08,2.));
  float foam=clamp(bank*smoothstep(.4,.7,lace)*.8+seam*smoothstep(.55,.8,lace)*.4,0.,1.);
  ${FOAM_LIGHT}
  outgoingLight=mix(outgoingLight,vec3(.9,.94,.92)*foamLight,foam);
  diffuseColor.a=max(diffuseColor.a,foam*.8);
 }`,
 creek:`{
  float t=waterTime,drift=vChan.x-t*length(vFlow),across=vChan.y;
  float fleck=smoothstep(.6,.84,wNoise(vec2(drift*1.1,across*1.7+t*.03))*.6+wNoise(vec2(drift*2.6+t*.04,across*3.3))*.4);
  float bank=smoothstep(.55,.9,vShore)*(1.-smoothstep(.97,1.,vShore));
  float foam=clamp(fleck*(.45+.5*vShore)+bank*.3*fleck,0.,1.)*.85;
  ${FOAM_LIGHT}
  outgoingLight=mix(outgoingLight,vec3(.92,.95,.94)*foamLight,foam);
  diffuseColor.a=max(diffuseColor.a,foam*.8);
 }`,
};
// Ripples with no tile in them, for water with no reflection to carry it.
// The water surface, generated rather than sampled. See `dressWater`.
const WATER_NOISE=`
uniform float waterTime;uniform float waterChop;uniform float waterSwell;uniform vec3 glintSun,glintColor;
// Metres per second, in world XZ, HERE -- per vertex, so it turns with the
// channel. Zero on a pond and on the sea, which have no such attribute.
varying vec2 vFlow;
// Along a channel: metres downstream, and metres across from the centre line.
varying vec2 vChan;
varying vec3 vWaterWorld;
// Value noise, hashed from the world position itself: no tile, no texture
// lookup, and a pattern that is different at every pond on the course.
/* Hash without Sine, (c)2014 David Hoskins, MIT: THIRD_PARTY_NOTICES.txt */float wHash(vec2 p){
 vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
 q+=dot(q,q.yzx+33.33);
 return fract((q.x+q.y)*q.z);
}
float wNoise(vec2 p){
 vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
 return mix(mix(wHash(i),wHash(i+vec2(1.,0.)),u.x),
            mix(wHash(i+vec2(0.,1.)),wHash(i+vec2(1.,1.)),u.x),u.y)*2.-1.;
}
// Two octaves, each drifting on its own bearing. Crossing drifts are what stop
// a wave field reading as one sheet sliding past.
float wFbm(vec2 p,float t){
 return .64*wNoise(p+vec2(.041,.029)*t)
      + .30*wNoise(p*2.13+vec2(19.7,-7.3)+vec2(-.052,.061)*t);
}
// The height of the surface: a broad swell, and a finer chop whose sampling
// position the swell warps, which is the cheapest thing that makes the small
// waves ride over the big ones instead of lying on top of them.
float wHeight(vec2 p,float t){
 vec2 sp=p*.15;
 float sh=wFbm(sp,t*.45);
 return sh*waterSwell*2.2+wFbm(p*.8+vec2(sh,-sh)*.7,t)*waterChop;
}
// FLOW, THE WAY WATER2 DOES IT (Vlachos, SIGGRAPH 2010).
//
// Pushing a wave field along a flow vector stretches it without bound: after a
// few seconds a creek is smeared into streaks. The fix is not to push it
// further but to sample it at TWO phases half a cycle apart, cross-fade
// between them, and reset each one while it is invisible. The reset never
// shows because nothing is on screen at the moment it jumps.
//
// Still water skips it: with no flow the two phases are the same field, so a
// pond -- which is most of the water on most courses, and most of the pixels --
// takes the single-sample path and pays nothing for a feature it does not use.
const float WATER_CYCLE=6.;
float wFlowHeight(vec2 p,float t){
 // One assignment and one return: two returns translate to HLSL as a temp the
 // compiler cannot prove is written on every path, and it says so every launch.
 float h=0.;
 if(dot(vFlow,vFlow)<1e-6){
  h=wHeight(p,t);
 }else{
  float hc=WATER_CYCLE*.5;
  float o0=fract(t/WATER_CYCLE)*WATER_CYCLE;
  float o1=fract(t/WATER_CYCLE+.5)*WATER_CYCLE;
  h=mix(wHeight(p-vFlow*o0,t),wHeight(p-vFlow*o1,t),abs(hc-o0)/hc);
 }
 return h;
}
// The normal, from finite differences of that height field.
vec3 wRipple(vec2 p,float t){
 const float e=.25;
 float h=wFlowHeight(p,t);
 vec2 g=vec2(wFlowHeight(p+vec2(e,0.),t)-h,wFlowHeight(p+vec2(0.,e),t)-h)*4.;
 return vec3(clamp(g,-1.,1.),1.);
}
`;
function shoreFade(material){
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace(...SHORE_VERT).replace(...SHORE_VERT2);
  shader.fragmentShader=shader.fragmentShader.replace(...SHORE_FRAG)
   .replace('#include <opaque_fragment>',SHORE_ALPHA+'\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=>'water-shore-fade-v1';
 return material;
}
// Shallow water reveals its painted bed; deep water hides it. One curve drives
// both the plain meshes and the reflective surface so they agree at a shoreline.
const waterOpacity=(depth,ocean)=>ocean?.93:clamp(.5+depth*.11,.5,.88);
// The glow ball. A real night-golf ball is a bright yellow-green, and the colour
// does more work than the brightness: it separates the ball from turf that has
// gone grey-blue under moonlight.
// Spot lights fall off as 1/d^2 here, so intensity is in the same units as that
// square. A raised mast costs brightness before it gains any: at 23 m over a
// target 20 m out the throw is 30.5 m against 26.9 m at the old 18 m, and the
// square of that ratio is 1.29 -- so about a third of this number only buys back
// what the extra height spent. The rest is the asked-for lift.
const FLOOD_INTENSITY=4200;
// Half-angle of the cone, so the full spread is twice this. Widened along with
// the mast: a taller pole aimed with the old cone lit a tighter circle from
// further away, which is the opposite of what raising it was for.
const FLOOD_CONE=1.15;
// How many poles may be live lights at once. Set above the 141 the longest
// eighteen-hole course produces, so in practice every pole is lit and the
// nearest-first fallback never runs -- it exists so a future course that grows
// past this degrades instead of stalling.
const FLOOD_LAMP_CAP=192;
// How far sunward of its slice a cascade's shadow camera starts, so trees that
// stand that far off still throw their shadows in: 1 km, the same allowance the
// view cull keeps for off-screen casters (instance-cull.js, shadowCap). Three's
// default is 200; this was 400, and at a low sun a tall tree's shadow runs
// further than that. The far plane is fitted per frame (fitCascadeDepth), and
// CASCADE_BASE_FAR is the depth the tier's shadow bias was tuned at.
// The distance haze at 100% on the panel: how far toward the horizon's colour
// the farthest land goes. 50% (the default) takes a hill 2 km off about a fifth
// of the way.
const AERIAL_MAX=.62;
const CASCADE_SUNWARD=1000,CASCADE_BASE_FAR=2000,fitScratch=new T.Vector3();
// Small maps on purpose: these light a pool of fairway a few dozen metres
// across, not a whole course, and six of them at 1024 is 24 MB for shadows
// nobody looks at closely at night.
const FLOOD_SHADOW_SIZE=512;
// Floodlight shadows are redrawn when they could have changed -- a lamp moved
// to a new pole, or the view moved far enough for the tree cull to re-sort
// what is drawn -- and no more often than this. Nothing at night moves but the
// trees in the wind, and a pool of lamplight under a swaying crown does not
// need its shadow redrawn sixty times a second to read as a shadow.
const FLOOD_SHADOW_EVERY=200;
// How many water bodies get a probe of their own. Past this they share the
// nearest one: the cost is one-off, but a dozen cubemaps is still a dozen.
const WATER_PROBE_CAP=8;
// HOW FAST THE WATER MOVES. The one number to change.
//
// Every drift in the water shaders is a fixed rate multiplied by the ripple
// clock, so this scales all of them together -- the procedural chop and swell
// and the tiled map alike -- and it does it without recompiling a shader. The
// individual rates are in WATER_NOISE and in the tiled branch of
// `dressWater`, and they are ratios to each other rather than speeds; this
// is the speed. 0 freezes the surface.
const WATER_SPEED=10;
// THE BALL'S CONTACT SHADOW.
//
// A soft disc, darkest at the middle and gone at the rim. Squared falloff rather
// than linear because a linear gradient reads as a grey coin with an edge, and
// the whole job of this is to have no edge -- it is standing in for contact
// occlusion, which has no boundary either.
//
// Generated rather than shipped: it is 64 pixels of greyscale, and a file would
// have to be inlined into the offline build to say the same thing.
function contactShadow(){
 const size=64,c=document.createElement('canvas');c.width=c.height=size;
 const ctx=c.getContext('2d'),image=ctx.createImageData(size,size),mid=(size-1)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const d=Math.hypot(x-mid,y-mid)/mid,i=(y*size+x)*4;
  const a=Math.max(0,1-d);
  image.data[i]=image.data[i+1]=image.data[i+2]=0;
  image.data[i+3]=Math.round(255*a*a);
 }
 ctx.putImageData(image,0,0);
 const t=new T.CanvasTexture(c);t.needsUpdate=true;return t;
}
// How far the ball's shadow may run from the ball before it stops being about
// the ball, and how long a low sun may stretch it. Both are looks.
const BALL_SHADOW_REACH=1.5,BALL_SHADOW_STRETCH=3;
const GLOW_BALL=new T.Color('#b4ff72');
const MOON_HIGH=new T.Color();

// Radial falloff for the halo, built numerically rather than on a canvas so this
// module never needs a DOM. Squared falloff reads as a glow; linear reads as a
// disc with a soft edge.
function haloTexture(){
 const size=64,d=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  const dx=(x+.5)/size*2-1,dy=(y+.5)/size*2-1;
  const f=Math.max(0,1-Math.hypot(dx,dy));
  const v=Math.round(255*f*f*f);
  d[i]=d[i+1]=d[i+2]=255;d[i+3]=v;
 }
 const t=new T.DataTexture(d,size,size);t.needsUpdate=true;return t;
}

// Sky colours the clock moves between. Held here rather than in daylight.js
// because they belong to this sky shader, not to the solar model.
const WHITE=new T.Color(1,1,1);
const CLOUD_DAY=new T.Color(.97,.975,.96);
const GLOW_DAY=new T.Color(1,.72,.35),GLOW_NIGHT=new T.Color(.42,.52,.78);
const DISC_DAY=new T.Color(1,.96,.83),DISC_NIGHT=new T.Color(.88,.92,1);

// A tracer stops a ball's radius short of where the ball ended, so it comes out
// of the BACK of the ball rather than from under it. Ending at the centre means
// the ball covers the last 21 mm of line, and a hop smaller than the ball --
// which most of the interesting ones are -- hides behind the thing that made it.
function trimToBall(points){
 const kept=[...points];
 let owed=R;
 while(kept.length>1&&owed>0){
  const last=kept[kept.length-1],prev=kept[kept.length-2];
  const span=Math.hypot(last.x-prev.x,last.y-prev.y,last.z-prev.z);
  if(span>owed){
   const f=owed/span;
   kept[kept.length-1]={x:last.x+(prev.x-last.x)*f,y:last.y+(prev.y-last.y)*f,z:last.z+(prev.z-last.z)*f};
   owed=0;
  }else{owed-=span;kept.pop();}
 }
 return kept;
}

export class GolfView{
 constructor(canvas,quality='medium'){
  this.canvas=canvas;this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.quality=tierOf(quality);this.renderer.shadowMap.enabled=true;this.applyQuality(quality);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  // The clock is session state, not course state. `hour` is null until a course
  // is built, where the biome's own default supplies the opening light.
  this.daylight={...loadDaylight(),elapsedSinceSave:0};this.solar=null;this.envElevation=null;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(53,1,.15,20000);this.look=new T.Vector3();this.targetPos=new T.Vector3();this.targetLook=new T.Vector3();this.config={...loadCamera()};this.freeYaw=0;this.freePitch=-.32;this.raycaster=new T.Raycaster();this.targets=[];this.elapsed=0;this.foliageTime={value:0};this.breeze={value:1};this.sway={value:1};
  // The bearing the wind blows TOWARD, as a unit vector in world XZ -- the same
  // convention `shot-visuals.js` and `clouds.js` already use.
  this.windVec={value:new T.Vector2(0,1)};this.resources=[];this.resize();new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);
 }
 // Applies everything a tier can change live. Grass density and foliage detail
 // are baked into the scene graph, so those need a course rebuild instead --
 // graphics.needsRebuild says which changes require one.
 // Shadow frustum and bias both follow the tier: a denser map can afford a
 // smaller bias, which is what tightens a shadow where it meets its caster.
 // CSM owns its own directional lights, so the single sun stops lighting and
 // stops casting once cascades take over -- leaving both on would double the
 // sunlight and shadow the scene twice.
 makeCascades(sunDir,color,intensity){
  this.csm=new CSM({camera:this.camera,parent:this.group,cascades:this.quality.cascades,
   maxFar:this.quality.shadowFar,mode:'custom',customSplitsCallback:this.cascadeSplitter(),shadowMapSize:this.quality.shadow.size,
   shadowBias:this.quality.shadowBias.constant,lightIntensity:intensity,
   lightDirection:sunDir.clone().negate().normalize(),lightMargin:CASCADE_SUNWARD});
  for(const light of this.csm.lights){light.color.copy(color);light.shadow.normalBias=this.quality.shadowBias.normal;light.shadow.radius=this.quality.shadow.radius;}
  this.sun.castShadow=false;this.sun.intensity=0;
 }
 // EACH CASCADE'S SHADOW BOX REACHES AS DEEP AS ITS SLICE OF THE VIEW.
 //
 // CSM gives every cascade's shadow camera a fixed depth -- `lightFar`, 2 km by
 // default -- measured from a point `lightMargin` sunward of the slice. The far
 // cascade's slice is several kilometres across, and how deep it runs along
 // the sun's direction depends on which way the camera faces: measured on
 // Redwood (High, 16:30), it overran the 2 km by 1.0 to 3.4 km as the camera
 // turned. Everything in the overrun is outside the shadow map and reads as
 // lit, so distant shadows came and went with the camera's heading, and worst
 // looking down from the free camera -- the owner's report, 29 September.
 //
 // So each frame, after CSM has placed the cascades, each shadow camera's far
 // plane is set to the deepest corner of its own slice plus a margin. The
 // constant bias is in the map's normalised depth, so it grows with the depth
 // it spans; it is scaled back to the same distance in metres it always was at
 // 2 km, or shadows would lift off the ground in the deep cascades.
 fitCascadeDepth(){
  const csm=this.csm;if(!csm)return;
  const cam=this.camera,v=fitScratch;
  csm.frustums.forEach((f,i)=>{
   const light=csm.lights[i];if(!light)return;
   const sc=light.shadow.camera;light.updateMatrixWorld();light.target.updateMatrixWorld();light.shadow.updateMatrices(light);
   let deepest=0;
   for(const set of [f.vertices.near,f.vertices.far])for(const corner of set){
    v.copy(corner).applyMatrix4(cam.matrixWorld).applyMatrix4(sc.matrixWorldInverse);
    deepest=Math.max(deepest,-v.z);
   }
   // The ground under the slice can sit below its corners' plane on a steep
   // course; 200 m covers the relief and a tree standing on it.
   const far=Math.max(CASCADE_BASE_FAR,Math.ceil(deepest+200));
   if(sc.far!==far){sc.far=far;sc.updateProjectionMatrix();}
   light.shadow.bias=this.quality.shadowBias.constant*CASCADE_BASE_FAR/far;
  });
 }
 // WHERE THE CASCADES SPLIT. three's own 'practical' split, on a 2.5 km reach,
 // puts the first edge near 420 m (590 m on Ultra's 3.5 km) -- and each cascade
 // is a square as wide as its slice's diagonal, so the NEAREST shadow map was a
 // kilometre across: its texels spread over ground nobody stands on, and it
 // held nearly every tree in view. The tier's `cascadeSplits` ends the first two
 // cascades at fixed depths instead (100 m and 500 m), so the nearest map's
 // resolution is spent around the player and F3's per-map tree lists can
 // actually shorten. Measured: High 1-1.5 ms faster mid-morning, Ultra 0.6-1;
 // the owner judged Ultra's picture indistinguishable (RESEARCH.md *Shadow
 // cascades split where the player stands*).
 //
 // NOT IN THE OVERVIEW. The camera is hundreds of metres up there, so nothing
 // is within 100 m of it and fixed edges would put the whole course in the last
 // cascade; the overview keeps three's split, recomputed whenever the reach
 // changes (render() calls updateFrustums on the way in and out).
 //
 // No `fade`: blending neighbouring cascades recompiles every lit material with
 // CSM_FADE, and the ground's own shader patch does not survive it -- the turf
 // went white. The seam at 100 m was judged acceptable without it.
 cascadeSplitter(){
  return (count,near,far,breaks)=>{
   const splits=this.cascadeSplits??this.quality.cascadeSplits;
   if(!splits?.length||this.config.mode==='overview'){
    // three's 'practical' split, which the custom mode replaces.
    for(let i=1;i<count;i++){
     const uniform=(near+(far-near)*i/count)/far,log=(near*(far/near)**(i/count))/far;
     breaks.push(T.MathUtils.lerp(uniform,log,.5));
    }
   }else for(let i=0;i<count-1;i++)breaks.push(Math.min(splits[i]??far,far)/far);
   breaks.push(1);
  };
 }
 // For the lab: splits in metres, or null for the tier's own. Returns the edges.
 setCascadeSplits(splits){
  if(!this.csm)return null;
  this.cascadeSplits=splits??null;
  this.csm.updateFrustums();
  // The shadow maps moved: the cull's per-map lists are out of date.
  this.cull?.dirty();
  const far=Math.min(this.camera.far,this.csm.maxFar);
  return {edges:this.csm.breaks.map(b=>Math.round(b*far))};
 }
 // Both patches run on the same shader. Their chunk targets are disjoint --
 // ours touches <common>, <color_fragment> and <begin_vertex>, CSM touches the
 // two lights chunks -- but CSM assigns onBeforeCompile rather than wrapping it,
 // so ours has to be put back or every turf shader in the game goes blank.
 setupCascadeMaterial(material){
  if(!this.csm||!material||material.userData.csm)return;
  const ours=material.onBeforeCompile;
  this.csm.setupMaterial(material);
  const theirs=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){ours?.call(this,shader,renderer);theirs.call(this,shader,renderer);};
  material.userData.csm=true;material.needsUpdate=true;
 }
 // Every material that takes part in lighting has to be registered. A lit
 // material without CSM's define falls through to three's stock loop, which
 // sums all three cascade lights at full intensity, and since each cascade's
 // shadow map covers only its own depth band a fragment shadowed in one is
 // still lit by the other two. That triples the light and thins the shadows to
 // roughly a third -- and it does it silently. Missing MeshToonMaterial here
 // once already washed out the turf and every tree, which is the whole scene.
 // Only MeshBasicMaterial is genuinely unlit.
 registerCascadeMaterials(){
  if(!this.csm&&!this.cloudUniforms&&!this.mistUniforms)return;
  const mats=o=>o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
  const register=m=>{
   // Mist first, and without the isLit test: unlit materials still take fog,
   // and the landscape ring on the horizon is MeshBasicMaterial. Leaving it out
   // would hang a crisp edge of world behind a hazy course.
   if(this.mistUniforms)applyMistTo(m,this.mistUniforms);
   if(!GolfView.isLit(m))return;
   this.setupCascadeMaterial(m);
   // Clouds after cascades: CSM assigns onBeforeCompile rather than wrapping
   // it, so anything installed before it is lost.
   if(this.cloudUniforms)applyCloudShadows(m,this.cloudUniforms);
   // And the clouds' own opacity, which has to come after CSM for the same
   // reason: it assigns onBeforeCompile rather than wrapping it.
   applyCloudFade(m);
  };
  this.group.traverse(o=>{for(const m of mats(o))register(m);});
  for(const m of this.lazyMaterials||[])register(m);
  // A material added later and never registered has no symptom except a washed
  // out picture, so say so loudly rather than let it be found in a screenshot.
  //
  // The guard has to check the same two places the registration does. It used to
  // walk only the scene graph, which is why it stayed silent about the grass:
  // a traverse cannot miss what a traverse cannot see.
  let missed=0;const kinds=new Set();
  const audit=m=>{if(GolfView.isLit(m)&&!m.userData.csm){missed++;kinds.add(m.type);}};
  if(this.csm){
   this.group.traverse(o=>{for(const m of mats(o))audit(m);});
   for(const m of this.lazyMaterials||[])audit(m);
  }
  if(missed)console.warn(`Fairway: ${missed} lit material(s) escaped cascade registration (${[...kinds].join(', ')}). They will be lit by every cascade at once and wash out.`);
 }
 // Props shade the way the rest of the scene does. Flagsticks, cups, tee
 // markers, signs and the ball were the last PBR left in a
 // cartoon frame, answering a falling sun on a different curve from the ground
 // they stand on. One ramp per course, shared.
 //
 // Water is deliberately NOT routed through here: it needs metalness and a
 // reflection, and toon has neither.
 surfaceMaterial(color,opts={}){
  const {roughness,flatShading,...toonOpts}=opts;
  if(this.style!=='cartoon')return new T.MeshStandardMaterial({color,roughness:roughness??1,...opts});
  this.propRamp=this.propRamp||toonRamp(this);
  return new T.MeshToonMaterial({color,gradientMap:this.propRamp,...toonOpts});
 }
 static isLit(m){return !!m&&!!(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.isMeshToonMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial);}
 applyShadowSpan(){
  if(!this.sun||this.csm)return;
  const span=this.quality.shadowSpan,bias=this.quality.shadowBias;
  Object.assign(this.sun.shadow.camera,{left:-span.half,right:span.half,top:span.top,bottom:span.bottom,near:1,far:span.far});
  this.sun.shadow.camera.updateProjectionMatrix();
  this.sun.shadow.normalBias=bias.normal;this.sun.shadow.bias=bias.constant;this.sun.shadow.radius=this.quality.shadow.radius;
 }
 // WHICH GROUND CUES ARE ON. A float write into uniforms the material already
 // holds -- never a define and never a rebuild, because changing a define
 // recompiles every lit material in the scene, which is the trap the floodlight
 // toggle fell into for two and a half seconds.
 //
 // Re-applied on every course build as well as on every change, because the
 // material is rebuilt with the world and comes back at its own defaults.
 setGroundCues(cues){
  this.groundCues={...(this.groundCues||{relief:true,slopeTint:true,contours:false,stripes:true,sheen:true}),...(cues||{})};
  const u=this.terrain?.material?.userData?.cues;
  if(!u)return this.groundCues;
  u.cueRelief.value=this.groundCues.relief?1:0;
  u.cueSlope.value=this.groundCues.slopeTint?1:0;
  u.cueContours.value=this.groundCues.contours?1:0;
  u.cueStripes.value=this.groundCues.stripes===false?0:1;
  if(u.cueSheen)u.cueSheen.value=this.groundCues.sheen===false?0:1;
  if(u.cuePatches)u.cuePatches.value=(this.groundCues.patches??60)/100;
  if(u.cueShade)u.cueShade.value=(this.groundCues.shade??60)/100;
  // Wind in the trees and grass (U2): one uniform every swaying material shares.
  this.sway.value=(this.groundCues.wind??100)/100;
  // Derived from the two sliders through ONE mapping in graphics.js, so the
  // panel and the shader cannot drift apart.
  if(u.sunDir&&this.sunDir)u.sunDir.value.copy(this.sunDir);
  const g=greenCues(this.groundCues);
  for(const k of ['greenLift','greenBend','greenBandSoft'])
   if(u[k])u[k].value=g[k];
  return this.groundCues;
 }
 // THE GROUND'S OWN SHADOW. A mesh flag, not a material one, so it changes the
 // shadow pass and not the shader program -- nothing recompiles.
 setTerrainShadows(on){
  this.terrainShadows=on!==false;
  if(this.terrain)this.terrain.castShadow=this.terrainShadows;
 }
 // THE WATER REFLECTION, on or off. Off leaves the render target holding
 // whatever it last drew, which nothing samples once the pass stops -- the
 // surface falls back to its environment map like every other body.
 // OFF MEANS OFF, not frozen. Skipping the reflection render alone left the
 // water sampling whatever was last drawn into the target -- a stale image that
 // looks like a working reflection until you move, which is why the switch
 // appeared to do nothing. The reflector is hidden and the body's own plain mesh
 // comes back, which is exactly what every other body on the course already is.
 // WHAT THE WATER REFLECTS -- not whether it reflects at all.
 //
 // This used to switch a planar mirror on and off, because a mirror was the
 // only reflection there was. Now every body carries a cubemap probe of its own
 // surroundings and the switch chooses what goes in it: the course, or the sky
 // alone. Neither costs anything per frame; the difference is the probe pass at
 // course build, and a look.
 setReflections(on){
  const was=this.waterReflectsCourse!==false;
  this.waterReflectsCourse=on!==false;
  // Probes skipped while reflections were off are taken now.
  if(this.waterReflectsCourse&&!was&&this.waterBodies?.some(b=>!b.probe))this.refreshWaterEnvironment();
  for(const b of this.waterBodies||[]){
   const m=b.mesh.material;
   const want=this.waterReflectsCourse?b.probe??null:null;
   if(m.envMap!==want){m.envMap=want;m.needsUpdate=true;}
  }
 }
 // THE PIXELS, as the tier allows them (the ceiling) times what automatic
 // resolution (auto-resolution.js, F4) currently asks for. The scale is only
 // ever at or below 1: a step can draw fewer pixels than the tier, never more.
 // Times the Text size zoom (ui-scale.js): the canvas sits inside the zoomed app,
 // so one of its CSS pixels is `zoom` screen pixels, and without this a larger
 // text size would draw the course at a lower resolution.
 pixelCeiling(){return Math.min(devicePixelRatio,this.quality.pixelRatio)*uiZoom();}
 setResolutionScale(scale){
  this.resolutionScale=Math.min(1,Math.max(.1,scale||1));
  const ratio=this.pixelCeiling()*this.resolutionScale;
  // Bloom and the god-ray mask size their targets from the canvas every frame,
  // so they follow on the next frame without being told.
  if(Math.abs(this.renderer.getPixelRatio()-ratio)>1e-6)this.renderer.setPixelRatio(ratio);
 }
 applyQuality(name){
  this.quality=tierOf(name);
  this.setResolutionScale(this.resolutionScale??1);
  // A tier carries its own count of shadow-casting lamps.
  if(this.floodLamps)this.setFloodShadows(this.floodShadowsOn!==false);
  this.renderer.shadowMap.type=T.PCFShadowMap;
  if(this.sun){
   this.sun.shadow.mapSize.set(this.quality.shadow.size,this.quality.shadow.size);
   this.sun.shadow.radius=this.quality.shadow.radius;
   // A shadow map already allocated at the old size has to go before three will
   // build one at the new size.
   this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
   this.sun.shadow.needsUpdate=true;
  }
  if(this.scene?.fog){const f=this.quality.fog;this.scene.fog.near=f.near;this.scene.fog.far=f.far;}
  for(const light of this.csm?.lights||[]){light.shadow.radius=this.quality.shadow.radius;light.shadow.normalBias=this.quality.shadowBias.normal;}
  this.applyShadowSpan();
  this.renderer.shadowMap.needsUpdate=true;
  // The constructor calls this before the camera exists, and resize() reaches
  // straight for camera.aspect.
  if(this.camera)this.resize();
 }
 // The container's own size, in its CSS pixels: under the Text size zoom its
 // on-screen box (getBoundingClientRect) is `zoom` times that, and sizing the
 // canvas from it drew the course 1.5 screens tall at 150%. The pixel ratio is
 // refreshed too, because it carries the zoom (pixelCeiling).
 resize(){const e=this.canvas.parentElement,w=e.clientWidth,h=e.clientHeight;if(this.quality)this.setResolutionScale(this.resolutionScale??1);this.renderer.setSize(w,h,false);this.fitAspect();this.applyLensShift();this.camera.updateProjectionMatrix();}
 // The picture's shape: the window's, except in a simulator bay, where it is the
 // measured screen's (cameraRig in camera-prefs.js) -- a projector stretches the
 // window onto the screen, so drawing in the window's shape would stretch the
 // course whenever the two differ, and resizing the window would change it.
 fitAspect(){const e=this.canvas.parentElement;this.camera.aspect=this.screenAspect||(e.clientWidth/Math.max(1,e.clientHeight));}
 // THE BAY'S LENS SHIFT (lensShift in projector.js): the picture moved sideways
 // without turning the camera, for a mat that is not in front of the screen's
 // centre. Three shifts a frustum by `filmOffset` in units of its film width, so
 // the fraction is converted here -- and again on a resize, because the film
 // width follows the canvas's shape. Zero everywhere but the bay's player view.
 applyLensShift(){if(this.camera)this.camera.filmOffset=(this.lensShift||0)*this.camera.getFilmWidth();}
 disposeCourse(){if(!this.group)return;const geometries=new Set(),materials=new Set(),textures=new Set();this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.shadow?.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{}))if(u?.value?.isTexture)textures.add(u.value);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const r of this.resources)r.dispose();this.resources=[];this.csm?.dispose();this.csm=null;this.cloudUniforms=null;this.clouds?.dispose();this.clouds=null;this.mistUniforms=null;this.godRays?.dispose();this.godRays=null;this.bloom?.dispose();this.bloom=null;this.sky=null;this.skyMaterial=null;this.propRamp=null;this.envScene=null;this.environment?.dispose();this.environment=null;this.scene.environment=null;this.cull=null;this.scene.remove(this.group);}
 build(world,style='cartoon',holeIndex=0){
  style='cartoon';
  this.disposeCourse();this.updateGrass=null;this.haunts=null;this.waterTime=null;this.seaDepth=null;this.probeDue=null;this.floodWarming=null;this.world=world;this.style=style;this.course=world.holes[holeIndex];this.group=new T.Group();this.scene.add(this.group);this.targets=[];this.puttingRings=null;this.greenGrid=null;this.reading=null;this.readingHeading=null;this.gridBeads=[];this.flags=[];this.flagsticks=[];this.greenProps=[];this.makeHazardAtlas();this.waterBodies=[];
  // Shared materials belonging to systems that build their meshes later. A
  // scene-graph traverse cannot find those: the near-field grass owns one
  // material for every tile but has no tiles until the camera moves, so at
  // registration time its group is empty and its material is invisible to a
  // walk of the scene.
  this.lazyMaterials=[];
  // One hidden mesh per such material, shown only while shaders are built
  // (withStandIns), so the warm-up compiles what the camera will meet later.
  this.standIns=[];
  const bio=world.bio,blue=style==='blueprint',toon=style==='cartoon',flat=style==='lowpoly',add=o=>{this.group.add(o);return o;};
  this.scene.background=new T.Color(blue?'#152e46':bio.sky);this.scene.fog=new T.Fog(blue?'#263e57':bio.sky,this.quality.fog.near,this.quality.fog.far);
  this.renderer.toneMappingExposure=blue?1:toon?1.0:.94;
  this.hemi=add(new T.HemisphereLight(blue?'#a4dcea':'#cce5ff',blue?'#2d4054':'#777855',1.15));
  // The clock only ever tints these; they stay the base it returns to.
  this.hemiSkyBase=this.hemi.color.clone();this.hemiGroundBase=this.hemi.groundColor.clone();
  this.skyBgBase=this.scene.background.clone();this.fogBase=this.scene.fog.color.clone();
  this.hemiBaseIntensity=1.15;
  // Blueprint is a diagram, not a place: it keeps its flat even light and
  // ignores the clock entirely.
  this.timed=!blue;this.baseExposure=blue?1:toon?1.0:.94;
  // Each biome opens at the hour that reproduces the light it always had, so
  // an existing course looks unchanged until the slider moves.
  if(this.daylight.hour===null)this.daylight.hour=this.daylight.syncToLocal?localHour():defaultHour(bio.sun);
  const solar=solarState(this.daylight.hour,bio.sun);this.solar=solar;
  const sunDir=this.timed?solar.direction.clone():new T.Vector3(-.6,Math.sin(bio.sun*Math.PI/180),-.5).normalize();
  this.sun=add(new T.DirectionalLight(blue?'#c4e5ff':bio.sunColor,blue?1.5:2.8));
  this.sunBase=this.sun.color.clone();this.sunBaseIntensity=blue?1.5:2.8;this.sun.castShadow=!blue;this.sun.shadow.mapSize.set(this.quality.shadow.size,this.quality.shadow.size);
  // Cascaded shadows: one frustum that follows the camera can only cover the
  // ground around it, so anything further away is lit as though nothing stands
  // between it and the sun. Cascades give each distance band its own map.
  if(this.quality.cascades&&!blue)this.makeCascades(sunDir,this.sun.color,this.sun.intensity);this.applyShadowSpan();add(this.sun.target);this.sunDir=sunDir;
  this.addSky(sunDir);
  this.addLandscape();
  const palette=blue?{rough:'#193c50',semi:'#285d6a',fairway:'#397e85',fringe:'#5caba6',green:'#9ad2bc',sand:'#bdc2a0'}:toon?{rough:new T.Color(bio.rough).lerp(new T.Color(bio.roughTint??'#b6bc65'),.23),semi:new T.Color(bio.semi).multiplyScalar(1.13),fairway:new T.Color(bio.fairway).offsetHSL(.015,.1,.04),fringe:new T.Color(bio.fringe).offsetHSL(0,.1,.07),green:new T.Color(bio.green).offsetHSL(.01,.05,.08),sand:'#ffebbd'}:{rough:bio.rough,semi:bio.semi,fairway:bio.fairway,fringe:bio.fringe,green:bio.green,sand:bio.sand};
  const terrain=groundGeometry(world.groundGrid);stitchSeam(terrain,this.landscape.geometry);this.terrain=add(new T.Mesh(terrain,groundMaterial(this,palette)));this.landscape.material.dispose();this.landscape.material=this.terrain.material;this.landscape.receiveShadow=true;this.terrain.name='Continuous ground';this.terrain.receiveShadow=true;
  this.setGroundCues();this.setTerrainShadows(this.terrainShadows);
  // THE GROUND CASTS ITS OWN SHADOW. It only ever received one, so trees and
  // buildings shaded the turf but the turf shaded nothing -- a ridge did not
  // darken the hollow behind it, and undulation was readable only from the
  // green-reading overlays or by watching a ball roll. Self-shadowing is what
  // gives a landscape its shape at a low sun.
  //
  // It is one draw call per cascade, and the geometry is already built, so the
  // cost is the vertex work times the cascade count. The normal bias in every
  // quality tier is what keeps a surface shadowing itself from turning into
  // acne; if that ever needs raising, raise it there rather than here, because
  // the cascades share it.
  // Set through `setTerrainShadows` just below, so the stored choice wins.
  this.terrain.castShadow=true;this.targets.push(this.terrain);
  for(const h of world.holes){for(const p of h.ponds){const points=[];for(let j=0;j<512;j++){const q=ovalRadius(p,j/512*TAU),w=h.toWorld({x:p.x+q.x,z:p.z+q.z});points.push(new T.Vector2(w.x,-w.z));}this.addWaterBody(new T.ShapeGeometry(new T.Shape(points)),p.level,p.depth,h.toWorld(p));this.addShoreFoam(points,p.level,!!p.large);}this.addHoleDetails(h);}
  if(bio.sea)this.addWaterBody(new T.PlaneGeometry(14000,14000),0,4,{x:0,z:0},true);
  addStreams(this);
  // EVERY BODY OF WATER IS THE SAME THING NOW.
  //
  // There used to be two kinds: a planar mirror on whichever body scored
  // highest, and a plain tinted sheet on the other twelve. That split is where
  // the popping came from -- a planar reflection is one plane and one extra
  // render of the whole scene, so a course with thirteen ponds can afford
  // exactly one, and the mirror had to be handed around as the camera moved.
  // Every handoff was one pond turning from water into varnish and another
  // turning back. Nothing is handed around any more.
  if(this.waterBodies.length){
   // Kept if the shore foam already made it this build (addShoreFoam).
   this.waterTime??={value:0};
   this.waterSpeed=WATER_SPEED;
   this.waterChop={value:.55};this.waterSwell={value:.45};
   for(const b of this.waterBodies)this.dressWater(b.mesh.material,b);
   // THE PROBE IS TAKEN HERE, not in `refreshEnvironment`. The sky is built
   // before the water is, so the refresh that runs from `addSky` finds no bodies
   // to probe for and returns -- and the next one is an elevation threshold
   // away, which on a still afternoon never comes.
   // TAKEN IN `ready`, NOT HERE, once the shaders are built: a probe renders
   // the scene, and rendering it now made the graphics card finish every
   // program on the spot -- a 0.8 s freeze of the page in the middle of the
   // build. What the probe sees is kept exactly: everything added to the
   // group after this point (the planting, homes, the ball) is hidden for the
   // capture, as it simply did not exist yet when the probe was taken here.
   this.probeDue=this.group.children.length;
   this.setReflections(this.waterReflectsCourse!==false);}
  addVegetation(this);addHomes(this);
  // Haunted Hollow's pumpkins, lanterns and ghosts; null on every other biome.
  this.haunts=addHaunts(this);
  this.addFloodlights();
  if(world.holes[0]?.range)this.addRangeTargets();
  // Every mesh instanced across the course -- trees, deadfall, rocks, ground
  // cover, homes, floodlights -- now draws only what is in view (instance-cull.js).
  // Taken here, after the last of them is built; the near-field grass tiles come
  // later, move with the camera, and opt out.
  // The floodlit programs are built behind the loading screen, in `ready`.
  this.nightWarmDue=true;
  this.cull=cullInstances(this.group,{thinShadowsFrom:this.quality.thinShadowsFrom??Infinity,farTrees:this.quality.farTrees??0});
  // The saved preference applies to every course built after it, not only to
  // the one that was on screen when the box was ticked.
  this.setFloodlights(this.daylight?.floodlights);
  if(blue){const grids=new T.GridHelper(Math.max(world.halfX,world.halfZ)*2,50,'#93bdb8','#335e71');grids.position.y=4;add(grids);}
  this.ball=add(new T.Mesh(new T.SphereGeometry(R,24,16),this.surfaceMaterial('#fffdf3',{roughness:.35,emissive:GLOW_BALL,emissiveIntensity:0})));
  // NOT castShadow. A golf ball is 4.3 cm across and the sun's shadow map covers
  // 280-370 m: measured, the ball is 0.16 of a texel on low and 0.47 on ultra, so
  // it has never once drawn a shadow at any tier. The flag was costing a draw
  // call in the shadow pass to render nothing. `ballShadow` below is the
  // contact darkening that actually puts the ball on the ground.
  this.ball.castShadow=false;
  this.ballShadow=add(new T.Mesh(new T.CircleGeometry(1,24),new T.MeshBasicMaterial(
   {color:'#000',transparent:true,opacity:.42,depthWrite:false,map:contactShadow()})));
  this.ballShadow.rotation.x=-Math.PI/2;this.resources.push(this.ballShadow.material.map);
  // Radius where the ball is touching, and how dark it gets there. Both are a
  // look rather than a measurement -- there is no correct size for a cue that
  // stands in for contact occlusion -- so `lab.ballShadow()` moves them live.
  this.ballShadowRadius??=R*3;this.ballShadowInk??=.42;
  // Built now, at zero, rather than switched on when night falls. Adding a light
  // to a scene changes the lighting uniforms and forces three to recompile every
  // material in it -- a stall of hundreds of milliseconds, and it would land on
  // exactly the frame the sun went down.
  this.ballLight=new T.PointLight(GLOW_BALL,0,18,2);this.ball.add(this.ballLight);
  // A sprite halo so the glow is not ultra-only. On ultra the bloom pass adds a
  // real flare over the top of it; below that, this is the whole effect.
  const halo=haloTexture();this.resources.push(halo);
  this.ballHalo=new T.Sprite(new T.SpriteMaterial({map:halo,color:GLOW_BALL,blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));
  this.ballHalo.scale.setScalar(R*9);this.ballHalo.visible=false;this.ball.add(this.ballHalo);
  this.ballRing=add(new T.Mesh(new T.RingGeometry(.45,.51,64),new T.MeshBasicMaterial({color:'#fff8d9',side:T.DoubleSide})));this.ringBase=this.ballRing.material.color.clone();this.ballRing.rotation.x=-Math.PI/2;
  this.aimLine=add(new Line2(new LineGeometry(),new LineMaterial({color:'#fff5d2',linewidth:3.5,transparent:true,opacity:.82,depthWrite:false})));
  this.effects=createShotEffects(this);add(this.effects.group);
  this.trail=add(new Line2(new LineGeometry(),new LineMaterial({color:'#ffe9a2',linewidth:4.5,transparent:true,opacity:.95,depthWrite:false})));this.trailBase=this.trail.material.color.clone();
  // Every tracer of the hole so far, drawn only when the hole is over. One Line2
  // cannot hold several separate strokes -- it would join the end of one shot to
  // the start of the next with a line across the fairway -- so they get a line
  // each, pooled and reused rather than rebuilt per hole.
  this.shotLines=[];this.shotGroup=new T.Group();add(this.shotGroup);
  // The team's balls during a scramble selection. Built empty; `build` runs on
  // every course, so the pool has to be reset with the scene it lives in.
  this.pickBalls=[];this.pickGroup=new T.Group();add(this.pickGroup);
  this.aimRing=add(new T.Mesh(new T.RingGeometry(2.5,2.7,64),new T.MeshBasicMaterial({color:'#fff4cd',side:T.DoubleSide})));this.aimRing.rotation.x=-Math.PI/2;
  if(this.config.mode==='free'){const pose=playerCameraPose(this.course,this.course.tee,0,this.config);this.camera.position.set(pose.eye.x,pose.eye.y,pose.eye.z);this.look.set(pose.target.x,pose.target.y,pose.target.z);this.wasFree=false;}this.setHole(holeIndex,true);this.renderer.shadowMap.needsUpdate=true;
  // Real clouds in the sky, and the discs they shade the ground with. Built
  // before material registration, because every lit material reads the discs.
  // Every tier carries the patch now, because the distance haze (U4) lives in
  // it and belongs to every tier; the MIST stays where the tier has it (its
  // densities are zero otherwise), and so does the water field it needs.
  if(!blue){
   this.mistUniforms=mistUniforms();
   // Baked once here rather than sampled per frame: where the water is cannot
   // change while a course is loaded.
   if(this.quality.mist){
    const field=bakeWaterField(world);
    const texture=setWaterField(this.mistUniforms,field);
    if(texture)this.resources.push(texture);
   }
  }
  if(this.quality.clouds&&!blue){
   this.cloudUniforms=cloudShadowUniforms();
   this.cloudUniforms.cloudDepth.value=this.quality.clouds;
   this.cloudUniforms.cloudSun.value.copy(sunDir).normalize();
   this.clouds=makeClouds(this,world.seed);
   // Share the vectors rather than copying them each frame: moving a cloud then
   // updates the shadow it casts, with nothing to keep in step.
   this.cloudUniforms.cloudDiscs.value=this.clouds.discs;
   this.cloudUniforms.cloudFade.value=this.clouds.fades;
   this.group.add(this.clouds.group);
  }else{this.cloudUniforms=null;this.clouds=null;}
  this.registerCascadeMaterials();
  this.godRays=this.quality.godRays?makeGodRays(this):null;
  this.bloom=this.quality.bloom?makeBloom(this):null;
  this.warmUp();
 }
 // Compile every shader now, while the loading overlay is still up.
 //
 // Nothing did this, so each material variant was compiled the first time an
 // object using it entered view -- which is during play, as the ball flies or the
 // camera turns. Measured over 900 frames of a sweeping aim, the first pass
 // produced a burst of six frames between 21 and 71 ms; a second pass over the
 // same ground produced none at all and compiled zero shaders, which is what a
 // first-appearance cost looks like. Moving it here puts it on the screen that
 // already says the course is being built.
 warmUp(grassBudget=70){
  // The near-field grass builds lazily. Its materials reach the compile through
  // the stand-ins (withStandIns); the ring is still started here so the ground
  // round the camera is not bare on the first frame -- but only behind the
  // loading screen. On a plain hole change (grassBudget 0) there is no overlay,
  // and those 70 ms were one frozen frame every time: 83-100 ms on Ultra. The
  // ring fills a tile a frame instead (updateGrass), about 0.4 s for all of it,
  // while the arrival camera is still holding high over the new tee.
  const until=performance.now()+grassBudget;
  while(this.updateGrass?.()&&performance.now()<until);
  try{this.withStandIns(()=>this.renderer.compile(this.scene,this.camera));}
  catch(e){console.warn('Fairway: shader pre-compile skipped',e);}
  // The lit programs wait until the course is on screen (`render` sends for
  // them) -- building them here put them in the wait behind the loading screen.
  if(!this.nightWarmDue)this.warmFloodlights();
 }
 // THE FIRST FRAME, PAID FOR BEHIND THE LOADING SCREEN (B1 in TODO).
 //
 // `warmUp` above calls `compile`, which CREATES every program but does not
 // wait for them: the driver links them on its own threads, and the first
 // frame that draws with one blocks until it is done. So the loading screen
 // went away and the picture froze -- measured, cold, 1.9 s on a nine-hole
 // course and 3.5 s on eighteen, on an RTX 4090; a phone is slower. And
 // `compile` never sees the programs made only when something is drawn: the
 // shadow maps' depth programs, the god-ray mask, bloom.
 //
 // So before the screen goes: `compileAsync` waits for the driver's links
 // without blocking the page (the spinner keeps turning), then one real frame
 // is drawn under the overlay to make the rest. Called from `whileGenerating`,
 // which every course build goes through.
 // THE STAND-INS. Materials that only reach the scene later (the near-field
 // grass and the forest floor, which grow tiles as the camera moves) each leave
 // one hidden mesh of a single zero-sized instance here (see vegetation.js).
 //
 // Compiling them is not enough. On Windows the browser draws through Direct3D
 // (ANGLE), which finishes a program's shaders only on the FIRST DRAW that uses
 // it -- so a program built behind the loading screen still cost its full ~75
 // ms the first time the forest floor came into view (B7 in TODO). That is what
 // the first frame under the overlay is for, and the stand-ins have to be in
 // it: shown through the compile AND that frame, hidden again after. Being
 // zero-sized they draw nothing a player could see.
 //
 // `withStandIns` is the compile-only form, for the warm-ups that do not draw.
 // `compile` creates every program before it returns (only the driver's link
 // waits), so hiding them once the call returns is safe.
 showStandIns(on){for(const m of this.standIns||[])m.visible=on;}
 // PROGRAMS BUILT FOR A STATE THE SCENE IS NOT IN YET. `compileAsync` cannot
 // wait for these: it waits on each material's CURRENT program, and once the
 // state is put back the next frame makes the old, finished programs current
 // again -- so it resolves at once, and the switch that followed froze on
 // programs still linking (measured: floodlight shadows switched off, 2.3 s).
 // So the scene is compiled synchronously while the state is held, every
 // program each material now owns is noted, and those are what is waited on.
 // Programs that already existed are finished and drop out at once.
 compilePrograms(){
  const out=[];
  for(const m of this.withStandIns(()=>this.renderer.compile(this.scene,this.camera)))
   for(const p of this.renderer.properties.get(m).programs?.values()??[])out.push(p);
  return out;
 }
 whenLinked(programs,limit=15000){
  const until=performance.now()+limit;
  return new Promise(done=>{
   const check=()=>{
    // A program released while waiting has no `program` left to ask about.
    programs=programs.filter(p=>p.program&&!p.isReady());
    if(!programs.length||performance.now()>until)done();else setTimeout(check,10);
   };
   check();
  });
 }
 withStandIns(compile){
  this.showStandIns(true);
  try{return this.asDrawn(compile);}
  finally{this.showStandIns(false);}
 }
 // COMPILED FOR WHERE THE FRAME IS REALLY DRAWN. Three picks a program's
 // version partly from the render target bound when it is built: tone mapping
 // and colour space differ between the screen and an off-screen target. Ultra
 // draws the scene into bloom's target (bloom.js), so every warm-up that
 // compiled with the screen bound built versions no frame ever used -- and the
 // first time the floodlights came on, every lit program was built for real in
 // one frame: 12-16 s frozen on Ultra, nothing on High, which has no bloom.
 asDrawn(fn){
  if(!this.bloom)return fn();
  const was=this.renderer.getRenderTarget();
  this.bloom.begin(this.renderer);
  try{return fn();}
  finally{this.renderer.setRenderTarget(was);}
 }
 async ready(){
  if(!this.group)return 0;
  this.readying=true;
  const t0=performance.now();
  this.showStandIns(true);
  try{if(this.renderer.compileAsync)await this.asDrawn(()=>this.renderer.compileAsync(this.scene,this.camera));}
  catch(e){console.warn('Fairway: shader warm-up skipped',e);}
  // The water's probes, now that the programs they render with are built. A
  // probe hands its water an environment map, which changes that material's
  // program -- so the water is compiled once more before the first frame.
  if(this.probeDue!=null){
   this.takeDueProbes();
   try{if(this.renderer.compileAsync)await this.asDrawn(()=>this.renderer.compileAsync(this.scene,this.camera));}
   catch(e){console.warn('Fairway: water warm-up skipped',e);}
  }
  // THE FLOODLIT PROGRAMS TOO (the owner, 30 September): everything switching
  // the lights on will need, built and linked before the screen goes, so the
  // switch costs nothing in play. They were sent for on the first frame after
  // instead, to keep the wait short -- but the wait is where the owner wants
  // the work. Measured at the time: nothing over 50 ms at either switch.
  if(this.nightWarmDue){
   this.nightWarmDue=false;this.warmFloodlights();
   try{if(this.floodWarming)await this.floodWarming;}catch{}
  }
  const t1=performance.now();
  // dt 0: nothing moves, nothing ages; the frame only exists to be drawn.
  // `readying` also makes this frame run the god rays whatever the sun is doing
  // (godrays.js, `warm`): their programs are not the scene's, so the compile
  // above never sees them.
  try{this.render(0);}catch(e){console.warn('Fairway: first frame skipped',e);}
  finally{this.showStandIns(false);}
  // For the lab: how long each half took. The first is time the page stays
  // live; the second blocks it, so it is the one to keep small.
  this.readyTimes={shaders:Math.round(t1-t0),firstFrame:Math.round(performance.now()-t1)};
  this.readying=false;
  return this.readyTimes;
 }
 // The probes `build` left for later (see the note where it sets `probeDue`).
 takeDueProbes(){
  if(this.probeDue==null||!this.group)return;
  const later=this.group.children.slice(this.probeDue).filter(o=>o.visible);
  this.probeDue=null;
  for(const o of later)o.visible=false;
  try{this.refreshWaterEnvironment();}
  finally{for(const o of later)o.visible=true;}
  this.setReflections(this.waterReflectsCourse!==false);
 }
 // THE FLOODLIT SHADERS, COMPILED BEFORE ANYBODY ASKS FOR THEM.
 //
 // The lamps are invisible until the player switches them on, so `compile` above
 // walks a scene with no spot lights in it and builds the daylight programs
 // only. Switching the floodlights on then changes the number of lights in the
 // render state, and three recompiles EVERY lit material in the scene --
 // measured at 2541 ms on a nine-hole course with 57 lamps. Two and a half
 // seconds of frozen picture, on a checkbox. Every toggle after it costs 12 ms,
 // which is what a one-off compile looks like.
 //
 // Only the LAMPS are made visible, never the masts and heads: a light at zero
 // intensity shows nothing, so a frame landing in this window looks the same,
 // while un-hiding the rig would pop a row of poles onto a daylit course.
 //
 // `compileAsync` where the browser has it, so the driver can build the programs
 // off the main thread instead of adding the whole cost to course generation.
 warmFloodlights(){
  // RUN ON EVERY WARM, not once per course. `setHole` warms again per hole
  // because the flag, the cup, the rings and the ball are per-hole objects built
  // after the course was -- and a one-shot guard here meant exactly those three
  // materials still compiled on the first toggle, which is 270 ms on an
  // eighteen-hole studio world where the light count is high enough to make each
  // program slow to build. Compiling an already-compiled scene is a cache
  // lookup, so the repeat costs nothing.
  const lamps=this.floodLamps;
  if(!lamps?.length)return;
  const rig=this.floodlights,rigWas=rig?.visible;
  // THE STATE THAT IS NOT SHOWING. The lamps are hidden while off, so the lit
  // programs are the ones with every lamp in the count; a course that starts
  // floodlit needs the unlit ones instead, or switching off would stall the
  // same way. Either way it is one scene walk with the lamps flipped.
  const other=!this.floodlit;
  for(const lamp of lamps)lamp.visible=other;
  if(rig)rig.visible=true;
  // The lamps are already in the walk -- they are never hidden. What is hidden
  // is the RIG: masts and heads, and the mast has a lit material of its own that
  // would otherwise compile on the first toggle. Put back SYNCHRONOUSLY once the
  // call returns: `compileAsync` walks the scene and creates the programs before
  // it resolves, only the driver's link is deferred, so no frame can land with a
  // row of poles standing on a daylit course.
  if(rig)rig.visible=true;
  try{
   // The programs of the state NOT showing, waited on by name (compilePrograms
   // says why `compileAsync` cannot do this).
   const done=this.whenLinked(this.compilePrograms());
   // Held while it runs, so a switch that lands before it is done can wait for
   // it (setFloodlights) rather than stall the frame on unfinished programs.
   const pending=done.finally(()=>{if(this.floodWarming===pending)this.floodWarming=null;});
   this.floodWarming=pending;
  }catch(e){console.warn('Fairway: floodlight pre-compile skipped',e);}
  finally{if(rig)rig.visible=rigWas;for(const lamp of lamps)lamp.visible=this.floodlit;}
 }
 makeHazardAtlas(){
  // The centre and shape of each GREEN, which is what the ground shader needs to
  // know where to paint one. It is not the cup: feeding the pin here painted the
  // green around wherever the hole happened to be cut, so the grass you saw was
  // offset from the green you actually played -- surface() measures from the
  // green's own centre -- and the pin looked dead centre on every hole because
  // the green was being drawn around it.
  // THE PER-HOLE TABLE (HOLE_ATLAS in ground.js): one row a hole, the cups and
  // the hazards written here and the route and the tees by the ground. It was
  // four textures, and each texture is a sampler in every fragment of the
  // ground: packed, it frees three of the sixteen WebGL guarantees, which is
  // what lets the floodlights cast shadows at all.
  const rows=this.world.holes.length,W=HOLE_ATLAS.width,holeData=new Float32Array(W*rows*4);
  const put=(hole,col,v)=>holeData.set(v,(hole*W+col)*4);
  for(const h of this.world.holes){
   const g=h.green??h.pin;put(h.hole,HOLE_ATLAS.cups,[g.x,g.z,h.greenSize,h.greenAspect]);put(h.hole,HOLE_ATLAS.cups+1,[h.pin.x,h.pin.z,0,0]);
   [...h.bunkers,...h.ponds].slice(0,12).forEach((b,j)=>{put(h.hole,HOLE_ATLAS.hazards+j*2,[b.x,b.z,b.rx,b.rz]);put(h.hole,HOLE_ATLAS.hazards+j*2+1,[b.phase,h.ponds.includes(b)?h.ponds.indexOf(b)+1:0,b.wave2??0,b.wave3??.07]);});
  }
  this.holeAtlas=new T.DataTexture(holeData,W,rows,T.RGBAFormat,T.FloatType);this.holeAtlas.minFilter=this.holeAtlas.magFilter=T.NearestFilter;this.holeAtlas.needsUpdate=true;this.resources.push(this.holeAtlas);
  const bankData=new Float32Array(512*rows*4*4);for(const h of this.world.holes)h.ponds.forEach((p,j)=>{for(let k=0;k<512;k++){const b=hazardProfile(p,p.z+(k/511*2-1)*p.rz);bankData.set([b.x,b.rx,0,0],((h.hole*4+j)*512+k)*4);}});this.bankAtlas=new T.DataTexture(bankData,512,rows*4,T.RGBAFormat,T.FloatType);this.bankAtlas.minFilter=this.bankAtlas.magFilter=T.LinearFilter;this.bankAtlas.needsUpdate=true;this.resources.push(this.bankAtlas);
 }
 addWaterBody(geometry,level,depth,center,ocean=false,stream=false){
  const blue=this.style==='blueprint',toon=this.style==='cartoon',real=this.style==='realistic',tint=new T.Color(blue?'#398ca2':toon?new T.Color(this.world.bio.water).lerp(new T.Color('#8eb8b2'),.27):this.world.bio.water);if(real&&depth<2)tint.lerp(new T.Color('#9fba98'),.35*(1-depth/2));
  const mesh=new T.Mesh(geometry,shoreFade(new T.MeshStandardMaterial({color:tint,metalness:real?.2:.45,roughness:real?.16:.12,transparent:true,opacity:waterOpacity(depth,ocean),depthWrite:false,envMapIntensity:1.2})));mesh.rotation.x=-Math.PI/2;mesh.position.y=level+.015;this.group.add(mesh);mesh.material.userData.waterBase=mesh.material.color.clone();this.waterBodies.push({mesh,level,depth,center,ocean,stream});
 }
 // A body with no reflector of its own, made to look like WATER anyway.
 //
 // It cannot mirror the course; that is a whole extra render of the scene and
 // only one body gets it. But a mirror was never what makes water read as
 // water. What does is that you can SEE INTO IT -- clear over the shallows
 // where the bed shows through, colouring as it deepens, and turning to sky at
 // a grazing angle. A pond opaque at every angle reads as poured concrete
 // however it is tinted, which is exactly what was reported.
 //
 // FRESNEL IS THE WHOLE TRICK. Looking down into water you see the bottom;
 // looking across it you see the sky. One term, from the angle between the eye
 // and the surface, drives both -- and because it needs no reflection texture
 // it costs nothing and works on every body at once.
 //
 // The normal map stays, but quietly: enough to break the specular into moving
 // glints so the surface is not one mirror blob, not enough to read as a
 // texture laid over the top.
 // ONE TREATMENT FOR EVERY BODY OF WATER ON THE COURSE.
 //
 // Clear where you look into it, sky where you look across it, and its own
 // surroundings reflected out of a cubemap probe taken when the course was
 // built. Nothing here is decided per frame and nothing is shared between
 // bodies, so there is no state that can change under the camera and nothing
 // that can pop.
 // FOAM WHERE A POND MEETS ITS BANK (U5 in TODO). A pond is one flat shape
 // whose every vertex is on its outline, so nothing on its surface knows how
 // far it is from the edge -- the stream shader's `shore` fade has nothing to
 // read here. So the foam is its own strip: the outline, and a copy of it moved
 // 1.4 m inward, drawn just above the water with a lacy, gently lapping alpha
 // (FOAM_FRAG). Lit, so it dims with the evening like everything else.
 // A LAKE IS NOT A BIG POND. More open water means more fetch for the wind, so
 // bigger wavelets breaking a little further out and more often: the same lace,
 // in a strip half again as wide (2.2 m against 1.4), coarser, and on a faster
 // clock (42% of the water's own against 30%).
 addShoreFoam(points,level,lake=false){
  if(this.style==='blueprint'||points.length<3)return;
  const n=points.length,W=lake?2.2:1.4,pos=[],uv=[],idx=[];
  let area=0;for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n];area+=a.x*b.y-b.x*a.y;}
  const inward=area>0?1:-1;
  for(let i=0;i<n;i++){
   const a=points[(i-1+n)%n],b=points[(i+1)%n],p=points[i];
   let tx=b.x-a.x,ty=b.y-a.y;const L=Math.hypot(tx,ty)||1;tx/=L;ty/=L;
   pos.push(p.x,p.y,0,p.x-ty*inward*W,p.y+tx*inward*W,0);uv.push(i/n,0,i/n,1);
   const k=i*2,m=((i+1)%n)*2;idx.push(k,m,k+1,k+1,m,m+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  // ONE PASS (`forceSinglePass`). Three draws a transparent double-sided
  // material twice, back faces then front, flipping its side and marking it
  // changed for each -- two draws and two program checks per strip per frame.
  // That exists for closed see-through shapes; a flat strip has nothing behind
  // itself to sort, so once is the same picture.
  const mat=new T.MeshToonMaterial({color:'#dde8e2',transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,gradientMap:this.propRamp??=toonRamp(this)});
  const time=this.waterTime??=({value:0});
  const pace={value:lake?.42:.3},grain={value:lake?.75:1};
  mat.onBeforeCompile=shader=>{
   shader.uniforms.waterTime=time;shader.uniforms.foamPace=pace;shader.uniforms.foamGrain=grain;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vFoamUv;varying vec3 vFoamWorld;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvFoamUv=uv;vFoamWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>'+FOAM_FRAG)
    .replace('#include <opaque_fragment>','diffuseColor.a*=foamAlpha();\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey=()=>'fairway-shore-foam-v2';
  const mesh=new T.Mesh(g,mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=level+.03;mesh.renderOrder=1;mesh.name='shore foam';
  this.group.add(mesh);
 }
 // THE SEA'S DEPTH, FROM THE GROUND ITSELF. The ocean is one flat 14 km sheet
 // and knows nothing about the coast, so where it met a gently sloping beach
 // the waterline was simply where the sheet cut the terrain's 3 m triangles:
 // a sawtooth, and one the depth buffer could not settle between two nearly
 // parallel surfaces, so it flickered as the camera moved (the owner, on Island
 // and Links). The coarse height grid the terrain is built from is handed to
 // the sea's shader as a texture, so every point of water knows how deep it is
 // -- the edge fades out over the last 35 cm (no hard line left to flicker, and
 // smooth where the triangles were jagged) and the surf is placed by depth.
 // Half floats, because linear filtering of full floats is not guaranteed on
 // WebGL2 (phones); near sea level that is millimetres. Past the grid the sea
 // is treated as deep.
 seaDepthMap(){
  if(this.seaDepth)return this.seaDepth;
  const g=this.world.groundGrid,w=g.nx+1,h=g.nz+1,data=new Uint16Array(w*h);
  for(let k=0;k<w*h;k++)data[k]=T.DataUtils.toHalfFloat(g.values[k]);
  const texture=new T.DataTexture(data,w,h,T.RedFormat,T.HalfFloatType);
  texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;this.resources.push(texture);
  return this.seaDepth={texture,grid:new T.Vector4(g.halfX,g.halfZ,w,h)};
 }
 dressWater(material,body){
  if(!material)return;
  // Smooth and metallic enough for the probe to read as a REFLECTION rather
  // than an ambient tint. PMREM blurs by roughness, so at 0.14 the course came
  // back as a wash of green; water is a near-mirror and should be treated as one.
  material.roughness=.05;material.metalness=.62;material.envMapIntensity=2.1;
  const time=this.waterTime,chop=this.waterChop,swell=this.waterSwell;
  // WHAT KIND OF WATER, for its edge (see WATER_EDGES): the sea, a river, a
  // creek, or still water, whose foam is the separate strip in addShoreFoam.
  const path=Array.isArray(body?.stream)?body.stream:null;
  const width=path?path.reduce((a,p)=>a+(p.width||0),0)/path.length:0;
  const kind=body?.ocean?'sea':path?(width<6?'creek':'river'):'still';
  const sea=kind==='sea'?this.seaDepthMap():null;
  // This course's sun, by reference: both change through the day.
  const sun={value:this.sunDir},sunColor={value:this.sun.color};
  material.onBeforeCompile=shader=>{
   shader.uniforms.waterTime=time;
   shader.uniforms.waterChop=chop;shader.uniforms.waterSwell=swell;
   shader.uniforms.glintSun=sun;shader.uniforms.glintColor=sunColor;
   if(sea){shader.uniforms.seaHeights={value:sea.texture};shader.uniforms.seaGrid={value:sea.grid};shader.uniforms.seaLevel={value:body.level};}
   shader.vertexShader=shader.vertexShader.replace(...SHORE_VERT).replace(...SHORE_VERT2)
    .replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;attribute vec2 flow;attribute vec2 chan;varying vec2 vFlow;varying vec2 vChan;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;vFlow=flow;vChan=chan;');
   shader.fragmentShader=shader.fragmentShader
    .replace(...SHORE_FRAG)
    .replace('#include <common>','#include <common>'+WATER_NOISE+(sea?'uniform sampler2D seaHeights;uniform vec4 seaGrid;uniform float seaLevel;':''))
    .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>'+`
     {
      vec3 r=wRipple(vWaterWorld.xz,waterTime);
      normal=normalize(normal+vec3(r.xy*.5,0.));
     }`)
    .replace('#include <opaque_fragment>',`
     {
      // 1 looking straight down into it, 0 edge on.
      float facing=abs(dot(normalize(vViewPosition),normal));
      // Schlick, near enough. Water runs from about 2% reflectance face on to
      // 100% at grazing, which is why a lake is a mirror from the tee and a
      // window from a bridge over it.
      float fres=.02+.98*pow(1.-facing,5.);
      // Clear where you look into it, the material's own depth-based opacity
      // where you look across it.
      diffuseColor.a*=mix(.22,1.,clamp(fres*1.6,0.,1.));
      // GLINT (U5): the sun caught by wavelets tilted just right. The mirror
      // direction of the view off the rippled normal, raised to a very high
      // power, and broken into sparks by fine noise that drifts with the
      // ripples -- a scatter of points on the sun's path, not one smooth blob.
      // Gone when the sun is down. Added to outgoingLight: by this include the
      // lighting has already read diffuseColor, so a change to its colour here
      // is never seen (only its alpha still counts).
      vec3 wn=normalize((vec4(normal,0.)*viewMatrix).xyz);
      vec3 rd=reflect(normalize(vWaterWorld-cameraPosition),wn);
      float spark=smoothstep(.55,.95,wNoise(vWaterWorld.xz*3.1+vec2(waterTime*.9,-waterTime*.7))*.5+.5);
      float glint=pow(max(dot(rd,glintSun),0.),700.)*spark*smoothstep(0.,.08,glintSun.y);
      outgoingLight+=glintColor*glint*3.;
      diffuseColor.a=max(diffuseColor.a,min(1.,glint*2.));
     }
     ${SHORE_ALPHA}
     ${WATER_EDGES[kind]}
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>'fairway-water-v4-'+kind;
  material.needsUpdate=true;
 }

 addSky(sunDir){
  const bio=this.world.bio,blue=this.style==='blueprint',toon=this.style==='cartoon',material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(blue?'#0c2035':toon?'#64bcdf':bio.waterTint)},horizon:{value:new T.Color(blue?'#3c6176':bio.sky)},sun:{value:sunDir},skyTime:this.foliageTime,cloud:{value:bio.waterMurk},cloudAmount:{value:this.quality.clouds?0:1},cloudLight:{value:new T.Color(.97,.975,.96)},glowColor:{value:new T.Color(1,.72,.35)},discColor:{value:new T.Color(1,.96,.83)},starness:{value:0},starAngle:{value:0},starAxis:{value:new T.Vector3(...STAR_AXIS)},moonDir:{value:new T.Vector3(0,-1,0)},moonColor:{value:new T.Color()},moonRadius:{value:.04},moonAmount:{value:0}},vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vSky;uniform vec3 top,horizon,sun,cloudLight,glowColor,discColor;uniform vec3 starAxis;uniform float cloud,cloudAmount,skyTime,starness,starAngle;uniform vec3 moonDir,moonColor;uniform float moonRadius,moonAmount;
 /* Hash without Sine, (c)2014 David Hoskins, MIT: THIRD_PARTY_NOTICES.txt */float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.03+3.1;a*=.5;}return f;}
 float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 // Stars are cells on the sky dome, nearly all of them empty. Quantising the
 // view direction rather than screen space is what makes them hold still
 // against the sky while the camera turns.
 // Rodrigues. Rotating the sampling direction turns the entire star field as
 // one rigid sphere, so the constellations hold their shapes while they wheel.
 vec3 spin(vec3 v,vec3 axis,float a){
  float c=cos(a),s=sin(a);
  return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.-c);
 }
 float starLayer(vec3 d,float scale,float density,float t){
  vec3 p=d*scale,i=floor(p),f=p-i;
  float h=hash3(i);
  vec3 c=vec3(hash3(i+1.3),hash3(i+2.7),hash3(i+5.1));
  float core=smoothstep(.42,0.,length(f-c));core*=core*core;
  return step(1.-density,h)*core*(.55+.45*sin(t*1.7+h*63.));
 }
 void main(){vec3 d=normalize(vSky);float h=max(d.y,0.);vec3 col=mix(horizon,top,pow(h,.55));float glow=pow(max(dot(d,sun),0.),64.);col+=glowColor*glow*.35;col=mix(col,discColor,smoothstep(.99955,.9998,dot(d,sun)));
  // Stars go in before the clouds, so a cloud drifting over puts them out.
  if(starness>.001){vec3 sd=spin(d,starAxis,starAngle);float sf=starLayer(sd,150.,.05,skyTime)+starLayer(sd,70.,.02,skyTime*.6)*1.7;col+=vec3(.82,.88,1.)*sf*starness*smoothstep(0.,.16,d.y);}
  // A DRAWN MOON (a biome's moon field; amount 0 everywhere else): a disc on the
  // moon's own arc, mottled with darker seas, a soft halo round it, hidden below
  // the horizon. After the stars and before the clouds, so cloud crosses it.
  if(moonAmount>.001){
   float r=acos(clamp(dot(d,moonDir),-1.,1.))/moonRadius;
   if(r<4.){
    vec3 mu=normalize(cross(moonDir,vec3(0.,1.,0.))),mv=cross(mu,moonDir);
    vec2 mp=vec2(dot(d,mu),dot(d,mv))/sin(moonRadius);
    float seas=noise(mp*2.2+3.1)*.6+noise(mp*5.3+7.7)*.4;
    vec3 face=moonColor*(1.-.3*smoothstep(.45,.72,seas))*(1.-.16*r*r);
    float disc=1.-smoothstep(.94,1.,r),halo=exp(-max(r-1.,0.)*1.8)*(1.-disc);
    float up=smoothstep(-.01,.025,d.y)*moonAmount;
    col=mix(col,face,disc*up);col+=moonColor*halo*up*.28;
   }
  }
  vec2 q=d.xz/max(d.y+.14,.09)*2.8;float n=fbm(q+vec2(skyTime*.008,skyTime*.003));float clouds=smoothstep(.55-cloud*.18,.76-cloud*.16,n)*smoothstep(.02,.15,h);col=mix(col,cloudLight,clouds*.83*cloudAmount);gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
    const sky=new T.Mesh(new T.SphereGeometry(7500,32,16),material);this.sky=sky;this.skyMaterial=material;this.group.add(sky);this.skyTopBase=material.uniforms.top.value.clone();this.skyHorizonBase=material.uniforms.horizon.value.clone();
  // Capture the sky for physically based material reflections. Kept as its own
  // pass because a moving sun has to be able to run it again.
  this.envScene=new T.Scene();this.envScene.add(sky.clone());this.refreshEnvironment();
 }
 // The one part of a moving sun that is not a uniform write: PMREM convolves a
 // cubemap, so it runs on an elevation threshold rather than per frame. Cheap
 // to be lazy about, because the turf and the trees are MeshToonMaterial and
 // toon materials never sample scene.environment -- the map only reaches props,
 // so staleness costs almost nothing on screen.
 //
 // THE GENERATORS ARE KEPT (pmremFor). A generator made and disposed per refresh
 // took its blur and GGX programs with it, so every 6 degrees of sun recompiled
 // both: 93 ms each time on an RTX 4090 (D3D11), against 0.3 ms with a kept
 // generator, and the time slider hitched at every threshold it crossed.
 //
 // `spread`: the moving sun's call (updateDaylight). The ponds are then retaken
 // one a frame (queueWaterProbes) rather than all in this one -- see THE PONDS
 // ARE RETAKEN ONE A FRAME below.
 refreshEnvironment(spread=false){
  if(!this.envScene)return;
  const env=this.pmremFor('sky').fromScene(this.envScene,.04,.1,10000);
  this.environment?.dispose();this.environment=env;this.scene.environment=env.texture;
  this.envElevation=this.solar?this.solar.elevation:null;
  if(spread&&this.waterBodies?.some(b=>b.probeEnv))this.queueWaterProbes();
  else this.refreshWaterEnvironment();
 }
 // One generator per job, for the life of the renderer (which is never torn
 // down). Not one shared: a generator sizes its working target and its blur
 // and GGX programs to the cube it was last given, so the sky (256) and the
 // water probes (the tier's size) alternating through one would rebuild both
 // programs on every switch -- the same recompile this exists to avoid.
 pmremFor(job){
  this.pmrems??={};
  return this.pmrems[job]??=new T.PMREMGenerator(this.renderer);
 }
 // REFLECTIONS ON EVERY BODY, WITHOUT A REFLECTOR ON EVERY BODY.
 //
 // A planar reflector is exact and costs a whole extra render of the scene per
 // body PER FRAME, which is why only one body gets one. A probe answers the same
 // question once: render the course into a small cubemap, convolve it, and let a
 // water material sample it as its environment. No per-frame cost at all.
 //
 // ONE PROBE PER BODY, not one for the course. The first version took a single
 // probe at the first body's centre and gave it to all thirteen -- so every pond
 // reflected the same patch of trees, which at distance is a soft tint rather
 // than a reflection and reads as nothing at all. A pond reflects what is around
 // THAT pond or it is not reflecting.
 //
 // The cost is a one-off: six faces at 128 pixels square per body, during course
 // generation, behind the screen that already says the landscape is being built.
 // Capped, because a links course can carry a dozen bodies and the cap is what
 // stops an unusual course paying for all of them; past it, a body borrows the
 // nearest probe, which is the closest thing to right that is free.
 refreshWaterEnvironment(){
  if(!this.waterBodies?.length||!this.group)return;
  // WITH REFLECTIONS OFF THERE IS NOTHING TO PHOTOGRAPH (F5b in TODO). Each probe
  // is a render of the whole course from the pond, taken at build and again
  // every time the sun moves six degrees -- and it used to be taken whether or
  // not the water was going to show it, so switching reflections off saved
  // nothing. Off, the water shows the sky environment alone, and the probes are
  // taken the moment reflections come back on (setReflections).
  if(this.waterReflectsCourse===false){for(const b of this.waterBodies)if(b.mesh.material.envMap){b.mesh.material.envMap=null;b.mesh.material.needsUpdate=true;}return;}
  // Everything at once supersedes a retake still working through the ponds.
  this.probeQueue=null;this.probeAgain=false;
  // Fresh shadow maps for the first face: at build no frame has drawn them yet.
  this.probeCapture(true,(cam,pmrem)=>{
   for(const env of this.waterEnvironments||[])env.dispose();
   this.waterEnvironments=[];
   // Biggest first, so the cap spends its probes on the bodies a player looks at.
   const order=this.waterBodies.map((b,i)=>({b,i,
    size:b.mesh.geometry.boundingSphere?.radius??(b.mesh.geometry.computeBoundingSphere(),b.mesh.geometry.boundingSphere?.radius??1)}))
    .sort((x,y)=>y.size-x.size);
   const probed=[];
   for(const {b} of order.slice(0,WATER_PROBE_CAP)){
    const env=this.takeProbe(cam,pmrem,b);
    this.waterEnvironments.push(env);
    b.probeEnv=env;b.probe=env.texture;b.mesh.material.envMap=this.waterReflectsCourse===false?null:env.texture;
    b.mesh.material.needsUpdate=true;
    probed.push({b,env});
   }
   // Everything past the cap borrows the nearest probe rather than falling back
   // to the sky, which would put one pond in a different world from its neighbour.
   for(const {b} of order.slice(WATER_PROBE_CAP)){
    b.probeEnv=null;
    let best=probed[0];
    for(const p of probed){
     const d=(q)=>Math.hypot((q.b.center?.x??0)-(b.center?.x??0),(q.b.center?.z??0)-(b.center?.z??0));
     if(d(p)<d(best))best=p;
    }
    if(best){b.probe=best.env.texture;
     b.mesh.material.envMap=this.waterReflectsCourse===false?null:best.env.texture;
     b.mesh.material.needsUpdate=true;}
   }
  });
 }
 // ONE ROUND OF PROBE PHOTOGRAPHS, SET UP AND PUT BACK. Shared by the whole-
 // course pass above and the one-pond-a-frame retake below.
 //
 // The water must not photograph itself: a probe that can see other water
 // surfaces bakes them in, and one that can see its own is a feedback loop.
 // A probe looks every way at once, so it gets the whole course, not the
 // camera's share of it; the cull's next update puts it back.
 //
 // THE SHADOW MAPS ARE NOT REDRAWN FOR EVERY FACE. Every `render` redraws all
 // of them while `autoUpdate` is on, so six faces a pond and eight ponds made
 // 48 redraws of every cascade per refresh, all identical: the sun's shadow
 // cameras do not move between faces. `fresh` lets the first face draw them
 // once, for a build that has not drawn a frame yet; the retake uses the
 // frame's own.
 probeCapture(fresh,fn){
  this.cull?.showAll();
  const shown=hideForProbe(this.waterBodies);
  // The sky follows the camera, shrunk to fit its far plane (see the frame
  // loop); a probe taken from a pond far from the camera would be outside it.
  // Full size and centred for the probes, put back after.
  const skyAt=this.sky?.position.clone(),skySize=this.sky?.scale.x;
  if(this.sky){this.sky.position.set(0,0,0);this.sky.scale.setScalar(1);}
  const shadows=this.renderer.shadowMap,autoUpdate=shadows.autoUpdate,needsUpdate=shadows.needsUpdate;
  shadows.autoUpdate=false;shadows.needsUpdate=fresh;
  try{
   if(!this.waterCubeTarget){
    // The tier's old planar-reflection size, repurposed: it is the one number
    // in the tier that was ever about reflection resolution.
    const px=Math.max(64,Math.min(256,Math.round((this.quality.reflection||512)/4)));
    this.waterCubeTarget=new T.WebGLCubeRenderTarget(px,{type:T.HalfFloatType});
    this.resources.push(this.waterCubeTarget);
   }
   fn(new T.CubeCamera(1,20000,this.waterCubeTarget),this.pmremFor('water'));
  }catch(e){console.warn('Fairway: water environment probe skipped',e);}
  finally{
   shadows.autoUpdate=autoUpdate;shadows.needsUpdate=needsUpdate;
   restoreAfterProbe(shown);
   if(this.sky){this.sky.position.copy(skyAt);this.sky.scale.setScalar(skySize);}
  }
 }
 // One pond's photograph, convolved -- into `into` when it has one, so the
 // water keeps the same texture and its material is not touched.
 takeProbe(cam,pmrem,b,into=null){
  cam.position.set(b.center?.x??0,b.level+4,b.center?.z??0);
  cam.update(this.renderer,this.scene);
  return pmrem.fromCubemap(this.waterCubeTarget.texture,into);
 }
 // THE PONDS ARE RETAKEN ONE A FRAME WHEN THE SUN MOVES. All of them in one
 // frame -- six renders of the whole course per pond, up to eight ponds -- was
 // a 0.4-1.2 s freeze every 6 degrees of sun on a pond-heavy Ultra course
 // (measured with the graphics card shared, 9 October). Now the sun's threshold
 // queues the probed ponds and each frame retakes one, biggest first, into the
 // pond's own texture: no new texture, no material change, and the ponds that
 // borrow it follow by themselves. A threshold crossed while a round is still
 // going (dragging the clock) runs one more round after it rather than
 // restarting, so every pond is reached. Build, a new tier and switching
 // reflections on still take everything at once, behind the loading screen or
 // on the player's own click.
 queueWaterProbes(){
  if(this.waterReflectsCourse===false||!this.waterBodies?.some(b=>b.probeEnv))return;
  if(this.probeQueue){this.probeAgain=true;return;}
  const envs=this.waterEnvironments||[];
  this.probeQueue={bodies:this.waterBodies,
   list:this.waterBodies.filter(b=>b.probeEnv).sort((x,y)=>envs.indexOf(x.probeEnv)-envs.indexOf(y.probeEnv))};
 }
 stepWaterProbes(){
  const q=this.probeQueue;if(!q)return;
  if(q.bodies!==this.waterBodies||this.retiring||this.waterReflectsCourse===false){this.probeQueue=null;this.probeAgain=false;return;}
  const b=q.list.shift();
  if(b?.probeEnv)this.probeCapture(false,(cam,pmrem)=>this.takeProbe(cam,pmrem,b,b.probeEnv));
  if(!q.list.length){this.probeQueue=null;if(this.probeAgain){this.probeAgain=false;this.queueWaterProbes();}}
 }
 addLandscape(){this.landscape=new T.Mesh(landscapeGeometry(this.world),new T.MeshBasicMaterial());this.group.add(this.landscape);}
 addHoleDetails(h){
  const group=this.group,blue=this.style==='blueprint',p=h.worldPin,y=h.height(h.pin.x,h.pin.z),white=this.surfaceMaterial('#f8f4df',{roughness:.55});
  const pole=new T.Mesh(new T.CylinderGeometry(FLAGSTICK_TOP_R,FLAGSTICK_BASE_R,FLAGSTICK_HEIGHT,10),white);pole.position.set(p.x,y+FLAGSTICK_HEIGHT/2,p.z);pole.castShadow=true;group.add(pole);
  const geo=new T.PlaneGeometry(.48,.33,12,4);for(let i=0;i<geo.attributes.position.count;i++){const x=geo.attributes.position.getX(i);geo.attributes.position.setZ(i,Math.sin(x*5)*.1);}geo.computeVertexNormals();const flag=new T.Mesh(geo,this.surfaceMaterial(blue?'#8df1dd':'#dc7845',{side:T.DoubleSide,roughness:.6}));flag.position.set(p.x+.24,y+1.95,p.z);group.add(flag);this.flags.push(flag);const assembly=new T.Group();assembly.add(pole,flag);group.add(assembly);assembly.userData.lift=false;this.flagsticks[h.hole]=assembly;
  const cup=new T.Mesh(new T.CylinderGeometry(CUP_RADIUS,CUP_RADIUS,.115,48,1,true),this.surfaceMaterial('#56614f',{side:T.BackSide}));cup.position.set(p.x,y-.0575,p.z);group.add(cup);const liner=new T.Mesh(new T.CylinderGeometry(CUP_RADIUS-.001,CUP_RADIUS-.001,.0896,48,1,true),this.surfaceMaterial('#c5c9b8',{roughness:.7,side:T.BackSide}));liner.position.set(p.x,y-.0254-.0448,p.z);group.add(liner);const floor=new T.Mesh(new T.CircleGeometry(CUP_RADIUS,48),new T.MeshBasicMaterial({color:'#101b12'}));floor.rotation.x=-Math.PI/2;floor.position.set(p.x,y-.115,p.z);group.add(floor);
  // Kept so the range's green can be moved without rebuilding the world. Every
  // one of these was positioned in WORLD coordinates above, and the flagstick's
  // two parts live in an assembly whose own y is driven by the hole-out lift
  // animation -- so they are moved individually rather than by shifting a parent.
  this.greenProps[h.hole]={pole,flag,cup,liner,floor};
  // Markers straddle the line of play, which runs to the middle of the fairway
  // where the fairway begins -- not to the pin. On a dogleg the two differ by
  // more than ten degrees, so markers squared to the green aim at trees.
  for(const [name,t] of Object.entries(h.tees)){
   const target=teeAim(h,t);
   const dx=target.x-t.x,dz=target.z-t.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
   // ON THE TEE, SIX INCHES IN FROM ITS EDGE.
   //
   // They stood at 4 m either side of a pad whose half-width is 3, so both
   // markers of every tee on the course were a METRE off the mown surface they
   // mark, sitting in the collar. The pair now straddles the pad the way a real
   // set does: in from each edge by `TEE_MARKER_INSET`, which is six inches.
   const inset=TEE_PAD.x-TEE_MARKER_INSET;
   for(const side of [-inset,inset]){
    // Perpendicular to the line of play, set a metre back from the tee centre.
    const x=t.x+uz*side-ux,z=t.z-ux*side-uz,q=h.toWorld({x,z});
    const marker=new T.Mesh(new T.SphereGeometry(.085,12,8),this.surfaceMaterial(TEE_COLORS[name]));
    marker.position.set(q.x,h.height(x,z)+.085,q.z);group.add(marker);
   }
  }
  // Numbered tee sign, timber posts, and a timber bench beside every tee.
  const c=document.createElement('canvas');c.width=128;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#203f30';ctx.fillRect(0,0,128,160);ctx.strokeStyle='#b9c4a0';ctx.strokeRect(6,6,116,148);ctx.textAlign='center';ctx.fillStyle='#f5efd9';ctx.font='52px '+UI_FONT;ctx.fillText(String(h.hole+1).padStart(2,'0'),64,73);ctx.font='15px '+UI_FONT;ctx.fillText('PAR '+h.par,64,107);ctx.fillText(Math.round(h.routeLength/YARD)+' YD',64,134);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  // THE SIGN STANDS BESIDE THE BLUE TEE, ON THE PLAYER'S RIGHT.
  //
  // It used to sit at a fixed local (-9, 2) -- nine metres off the hole's own
  // origin, which stopped meaning anything once tees were sited on ground that
  // suits them and now sit a median 14 m off the centre line and anywhere from
  // 18 m behind that origin to 60 m past it. The sign could end up in a wood
  // with no tee in sight.
  //
  // WHICH SIDE IS RIGHT: local +x is the player's LEFT. Walking the frame out
  // by hand, a hole plays along local +z, and three.js builds a camera's screen
  // right as cross(up, eye-target), which is -x when you face +z. Checked
  // across nine holes at nine rotations: the sign of the cross product between
  // the play direction and local +x is the same on every one, so `toWorld` is a
  // rotation with no mirror in it and this holds everywhere. Note the codebase
  // ALSO calls +1 "right" in `fairwayWidth` -- that is a naming convention for
  // which edge is which, and it does not agree with the player's view.
  const backTee=h.tees?.blue||Object.values(h.tees||{})[0];
  if(backTee){
   const bt=teeAim(h,backTee),bdx=bt.x-backTee.x,bdz=bt.z-backTee.z,blen=Math.hypot(bdx,bdz)||1;
   const bux=bdx/blen,buz=bdz/blen;
   // Clear of the mown collar by a stride, and level with the markers.
   const side=-(TEE_APRON.x+1.4);
   const lx=backTee.x+buz*side,lz=backTee.z-bux*side;
   const q=h.toWorld({x:lx,z:lz}),ground=h.height(lx,lz);
   const sign=new T.Mesh(new T.BoxGeometry(1.0,1.25,.12),this.surfaceMaterial('#ffffff',{map:tex,roughness:.8}));
   sign.position.set(q.x,ground+1.55,q.z);
   // Facing the tee it belongs to, so it is read from where you stand rather
   // than from behind. The box is thin in Z, so its face points along the
   // rotated +Z and the bearing is measured in world space -- the pad is
   // squared to the shot, which is not the hole's own rotation.
   const bw=h.toWorld(backTee);
   sign.rotation.y=Math.atan2(bw.x-q.x,bw.z-q.z);
   group.add(sign);
   const post=new T.Mesh(new T.CylinderGeometry(.08,.09,1.1,8),this.surfaceMaterial('#645340'));
   post.position.set(q.x,ground+.5,q.z);group.add(post);
  }
 }
 // Move the range's green, without rebuilding anything.
 //
 // This is cheap for one specific reason: the ground shader reads the green's
 // position, size and shape from a row of the CUP ATLAS, not from the hole's
 // length or from the terrain. So the painted green follows four floats. The
 // props are ordinary meshes and get carried across by hand.
 //
 // It only holds because the range is FLAT and its green has no contour. On a
 // real hole the terrain itself is cut to the green at build time, and moving
 // one would need the ground grid rebuilt.
 setRangeGreen(){
  const h=this.world.holes[0];
  if(!h?.range)return;
  const data=this.holeAtlas?.image?.data,at=(h.hole*HOLE_ATLAS.width+HOLE_ATLAS.cups)*4;
  if(data){data.set([h.green.x,h.green.z,h.greenSize,h.greenAspect],at);data.set([h.pin.x,h.pin.z,0,0],at+4);this.holeAtlas.needsUpdate=true;}
  const props=this.greenProps?.[h.hole];
  if(props){
   const p=h.toWorld(h.pin),y=h.height(h.pin.x,h.pin.z);
   props.pole.position.set(p.x,y+1.065,p.z);
   props.flag.position.set(p.x+.24,y+1.95,p.z);
   props.cup.position.set(p.x,y-.0575,p.z);
   props.liner.position.set(p.x,y-.0254-.0448,p.z);
   props.floor.position.set(p.x,y-.115,p.z);
  }
  // Built against the old green position, so it has to go. The range forces the
  // reading tools off anyway; this covers anyone turning them back on.
  if(this.greenGrid){this.group.remove(this.greenGrid);this.greenGrid=null;this.reading=null;}
 }
 // The driving range's aiming targets: a coloured circle, an oversized flag and
 // a sign carrying the number.
 //
 // All three are SCENERY. The circle is a disc laid on the turf, not a putting
 // surface -- the ground shader and localSurface both know exactly one green per
 // hole, so a ball landing here bounces as range turf. Colour is the quick cue
 // and the sign is the authoritative one; see range.js for why the ramp avoids
 // blue.
 addRangeTargets(){
  const h=this.world.holes[0],group=this.group;
  for(const t of rangeTargets()){
   const c=h.toWorld({x:t.x,z:t.z}),y=h.height(t.x,t.z);
   // Laid 2 cm proud of the turf and told to lose depth ties, because the field
   // is dead flat: a disc exactly coplanar with the ground z-fights across its
   // whole face rather than at an edge, and flat ground is the worst case for it.
   const offset={polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
   const disc=new T.Mesh(new T.CircleGeometry(t.radius,64),this.surfaceMaterial(t.color,{roughness:.95,...offset}));
   disc.rotation.x=-Math.PI/2;disc.position.set(c.x,y+.02,c.z);disc.receiveShadow=true;group.add(disc);
   // A painted rim. Without it a disc is just a coloured patch of ground and
   // reads as a hazard or a scorch mark; the hard white edge is what makes it
   // read as a marking somebody put there. It also survives haze better than the
   // fill does, which is what keeps the far targets legible.
   const rim=new T.Mesh(new T.RingGeometry(t.radius,t.radius+.9,64),
    this.surfaceMaterial('#f4f7ef',{roughness:.9,...offset}));
   rim.rotation.x=-Math.PI/2;rim.position.set(c.x,y+.025,c.z);group.add(rim);

   // A taller stick and a bigger flag than a hole's. A 2 m flagstick at 300 yd
   // is a few pixels; these have to be picked out from the mats, which is the
   // one place anyone ever looks at them from.
   const pole=new T.Mesh(new T.CylinderGeometry(.03,.04,3.6,10),this.surfaceMaterial('#f8f4df',{roughness:.55}));
   pole.position.set(c.x,y+1.8,c.z);pole.castShadow=true;group.add(pole);
   const geo=new T.PlaneGeometry(1.05,.7,12,4);
   for(let i=0;i<geo.attributes.position.count;i++){const x=geo.attributes.position.getX(i);geo.attributes.position.setZ(i,Math.sin(x*5)*.1);}
   geo.computeVertexNormals();
   const flag=new T.Mesh(geo,this.surfaceMaterial(t.color,{side:T.DoubleSide,roughness:.6}));
   flag.position.set(c.x+.52,y+3.15,c.z);group.add(flag);
   // Into the same list the hole flags use, so it catches the same breeze.
   this.flags.push(flag);

   // The sign stands BEHIND its target, square to the mats. Beside it would put
   // it off the mown field on the outer targets; behind keeps every sign on the
   // one sight line a player actually uses.
   //
   // It grows with distance. A fixed-size board legible at 50 yd is unreadable
   // at 300, and every one of these is read from the same spot, so holding the
   // ANGULAR size roughly even is the honest choice rather than a perspective
   // trick -- real ranges make their far boards bigger for the same reason.
   const height=Math.min(7,Math.max(3,2.2+t.yards*.014)),width=height*1.55;
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=330;
   const ctx=canvas.getContext('2d');
   ctx.fillStyle='#16241b';ctx.fillRect(0,0,512,330);
   ctx.strokeStyle=t.color;ctx.lineWidth=14;ctx.strokeRect(18,18,476,294);
   ctx.textAlign='center';
   ctx.fillStyle=t.color;ctx.font='bold 210px '+UI_FONT;ctx.fillText(String(t.yards),256,228);
   ctx.fillStyle='#dfe7d6';ctx.font='54px '+UI_FONT;ctx.fillText('YARDS',256,292);
   const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;this.resources.push(tex);
   const board=new T.Mesh(new T.BoxGeometry(width,height,.28),this.surfaceMaterial('#ffffff',{map:tex,roughness:.85}));
   const sz=t.z+t.radius+5,sw=h.toWorld({x:t.x,z:sz}),sy=h.height(t.x,sz);
   board.position.set(sw.x,sy+1.5+height/2,sw.z);
   // Half a turn so the mapped face looks back down the field at the mats: the
   // box carries one material, so the far side shows the number mirrored.
   board.rotation.y=h.rotation+Math.PI;
   board.castShadow=true;group.add(board);
   for(const side of [-1,1]){
    const post=new T.Mesh(new T.CylinderGeometry(.11,.13,1.5+height/2,8),this.surfaceMaterial('#645340'));
    const pw=h.toWorld({x:t.x+side*width*.32,z:sz});
    post.position.set(pw.x,sy+(1.5+height/2)/2,pw.z);post.castShadow=true;group.add(post);
   }
  }
 }
 // Course floodlighting for night play.
 //
 // Placement comes from floodlights.js and is anchored to published sports
 // lighting practice; see RESEARCH.md. This is the rendering half, and it makes
 // one decision worth stating: EVERY pole is geometry, but only a few are
 // lights. A scene with sixty live spot lights is unplayable, and a player can
 // only see the pools thrown by the ones near them, so four follow the ball.
 //
 // The poles are built once and hidden. Building them on demand would put their
 // material in exactly the position the grass was in -- created after the scene
 // walk that registers cascade materials, and therefore lit by all three
 // cascades at once. Built here, the ordinary registration finds them.
 addFloodlights(){
  const w=this.world,poles=[];
  for(const h of w.holes)for(const p of polesFor(h)){
   // Which hole a pole belongs to. Shadows are spent on the hole being played,
   // so the pole has to know which one that is.
   // A fairway pole aims at the middle of its own corridor; a green pole aims at
   // the green. Aiming a green pole at h.center(z) points it at a corridor
   // centre extrapolated past the end of the hole, which is nowhere.
   const target=p.green?(h.green??h.pin):{x:h.center(p.z),z:p.z};
   const base=h.toWorld({x:p.x,z:p.z}),aim=h.toWorld(target);
   poles.push({hole:h.hole,x:base.x,z:base.z,y:w.height(base.x,base.z),height:p.height,
    aimX:aim.x,aimZ:aim.z,aimY:w.height(aim.x,aim.z)});
  }
  this.poles=poles;
  if(!poles.length)return;
  const group=new T.Group();group.name='Floodlights';group.visible=false;
  this.group.add(group);this.floodlights=group;
  // A mast and a head, instanced across the whole course: two draw calls for
  // every pole on eighteen holes.
  const mast=new T.InstancedMesh(new T.CylinderGeometry(.16,.34,1,8),
   this.surfaceMaterial('#71787d',{roughness:.75}),poles.length);
  // The heads are their own light source and read as lit whatever the hour, so
  // they are genuinely unlit -- MeshBasicMaterial, and no cascade registration.
  const head=new T.InstancedMesh(new T.BoxGeometry(3.1,.85,1.15),
   new T.MeshBasicMaterial({color:'#fff6d8'}),poles.length);
  const dummy=new T.Object3D();
  poles.forEach((p,i)=>{
   dummy.position.set(p.x,p.y+p.height/2,p.z);dummy.rotation.set(0,0,0);
   dummy.scale.set(1,p.height,1);dummy.updateMatrix();mast.setMatrixAt(i,dummy.matrix);
   dummy.scale.set(1,1,1);dummy.position.set(p.x,p.y+p.height+.5,p.z);
   // Turned to face the middle of the corridor, so the bank of lamps reads as
   // aimed at the hole rather than bolted on square.
   dummy.rotation.set(0,Math.atan2(p.aimX-p.x,p.aimZ-p.z),0);
   dummy.updateMatrix();head.setMatrixAt(i,dummy.matrix);
  });
  mast.castShadow=true;mast.receiveShadow=true;
  mast.computeBoundingSphere();head.computeBoundingSphere();
  group.add(mast,head);
  // Made once, moved, and NEVER HIDDEN. Shadows are off on purpose: a shadow map
  // per lamp per frame is the whole budget many times over, and the sun is below
  // the horizon when these are on, so CSM has nothing to draw anyway.
  //
  // HIDDEN UNTIL THEY ARE ON, WITH THEIR SHADERS BUILT IN ADVANCE. Three counts
  // the VISIBLE lights in a scene and writes the count into every lit program,
  // so the lamp count decides which programs a course needs. Showing a lamp
  // for the first time recompiles every lit material -- measured at 2541 ms of
  // frozen picture on a nine-hole course with 57 lamps, on a checkbox -- which
  // is why these used to be visible from birth at zero intensity.
  //
  // That made every course wait for programs carrying ALL its lamps, in
  // daylight too: 57 on nine holes and 141 on the longest eighteen, a different
  // set per course (so the menu's could never be reused), and the bulk of the
  // 2-3.5 s the loading screen spends on the graphics card (B1, B6 in TODO).
  // Now they start hidden when the floodlights are off, and `warmFloodlights`
  // builds the lit programs in the background once the course is on screen,
  // so the first switch finds them ready and costs what every later one did.
  // Switched on, they are shown; off, hidden. Each state has its programs.
  //
  // The ball light next to `this.ball` is still built visible at zero, for the
  // old reason: it is one light, the same on every course.
  //
  // A FIXED FEW OF THEM CAST, decided here and never changed. The number of
  // shadow-casting lights is part of the shader program key exactly as the light
  // count is, so switching `castShadow` at runtime recompiles the scene the same
  // way hiding a lamp did. The casters are the first lamps in the pool and
  // `updateFloodlights` hands those lamps to the hole being played, so the
  // shadows follow the player without the flag ever moving.
  //
  // `shadow.autoUpdate` is what stops them costing anything in daylight: with it
  // off three skips the depth pass entirely, and a stale map behind a lamp at
  // zero intensity contributes nothing.
  const casters=this.floodCasters();
  this.floodLamps=Array.from({length:Math.min(poles.length,FLOOD_LAMP_CAP)},(_,i)=>{
   const lamp=new T.SpotLight('#fff4d2',0,POLE_REACH*2,FLOOD_CONE,.55,2);
   lamp.visible=false;lamp.intensity=0;
   lamp.castShadow=i<casters;
   // Set up on every lamp, casting or not, so the switch can hand shadows to a
   // lamp later without the rig being rebuilt. A map is only allocated by
   // three once the lamp casts. Never redrawn on their own (autoUpdate): see
   // FLOOD_SHADOW_EVERY and the frame loop.
   lamp.shadow.mapSize.set(FLOOD_SHADOW_SIZE,FLOOD_SHADOW_SIZE);
   lamp.shadow.bias=this.quality.shadowBias.constant;
   lamp.shadow.normalBias=this.quality.shadowBias.normal;
   lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=false;
   this.group.add(lamp,lamp.target);
   return lamp;
  });
 }
 // Shown or hidden as a whole. Nothing is built here, so a player toggling this
 // twice a hole costs nothing but a visibility flag and four light intensities.
 setFloodlights(on){
  const want=!!on&&!!this.floodlights;
  this.floodWanted=want;
  // NOT BEFORE THEIR SHADERS ARE READY. Since 30 September `ready` builds and
  // links the other state's programs behind the loading screen, so in play
  // this wait never happens. It stays for a hole change (warmUp warms again
  // for the per-hole objects, with no overlay) and for any path that reaches
  // the screen without `ready`: switched while the build is still going, the
  // next frame would use programs the driver had not finished and freeze until
  // it had (once measured at 2.1 s). A switch in that window waits instead,
  // with the game running. The latest request wins.
  if(this.floodWarming&&want!==this.floodlit){
   // Only for the course it was asked on: a rebuild in between has its own
   // lamps, set by its own build.
   const course=this.group;
   this.floodWarming.then(()=>{if(this.group===course&&this.floodWanted===want&&want!==this.floodlit)this.applyFloodlights(want);});
   return;
  }
  this.applyFloodlights(want);
 }
 applyFloodlights(lit){
  if(this.floodlights)this.floodlights.visible=lit;
  // Shown or hidden, and lit. Changing what is visible changes the programs
  // three uses, which is free once `warmFloodlights` has built both sets; the
  // shadow maps are switched with `autoUpdate` rather than `castShadow`, which
  // is part of the same key and is never changed.
  for(const lamp of this.floodLamps||[]){
   lamp.visible=lit;
   lamp.intensity=lit?FLOOD_INTENSITY*this.floodStrength():0;
  }
  this.floodlit=lit;
  this.floodShadowDirty=lit;
 }
 // THE STRENGTH SLIDER (Weather & time), as a multiple of FLOOD_INTENSITY. A
 // light's intensity is a uniform, so moving it recompiles nothing.
 floodStrength(){return Math.max(0,this.daylight?.floodStrength??1);}
 // HOW MANY LAMPS CAST SHADOWS: the tier's count, or none with the switch off.
 floodCasters(){return this.floodShadowsOn===false?0:(this.quality.floodShadows??0);}
 // THE FLOODLIGHT SHADOWS SWITCH (Graphics). Which lamps cast is part of every
 // lit program's key, so flipping it rebuilds every lit material in the scene
 // -- two and a half seconds of frozen picture on a nine-hole course, done
 // directly. So the new programs are built first, for both the lit and the
 // unlit state, with the flags set only for the length of the call; the flags
 // change for real once the driver has linked them, and the picture never
 // waits. The latest request wins.
 setFloodShadows(on){
  this.floodShadowsOn=on!==false;
  const lamps=this.floodLamps;
  if(!lamps?.length)return Promise.resolve();
  const n=Math.min(this.floodCasters(),lamps.length),want=lamps.map((_,i)=>i<n),was=lamps.map(l=>l.castShadow);
  if(want.every((w,i)=>w===was[i]))return Promise.resolve();
  const flags=f=>lamps.forEach((l,i)=>{l.castShadow=f[i];});
  const course=this.group,asked=this.floodShadowsOn,rig=this.floodlights,rigWas=rig?.visible,lit=this.floodlit;
  let done=Promise.resolve();
  flags(want);
  try{
   const programs=this.compilePrograms();
   for(const lamp of lamps)lamp.visible=!lit;
   if(rig)rig.visible=true;
   programs.push(...this.compilePrograms());
   done=this.whenLinked(programs);
  }catch(e){console.warn('Fairway: floodlight shadow pre-compile skipped',e);}
  finally{
   if(rig)rig.visible=rigWas;
   for(const lamp of lamps)lamp.visible=lit;
   flags(was);
  }
  return done.then(()=>{
   if(this.group!==course||this.floodShadowsOn!==asked)return;
   flags(want);
   for(const [i,l] of lamps.entries())if(!want[i]&&l.shadow.map){l.shadow.map.dispose();l.shadow.map=null;}
   this.floodShadowDirty=this.floodlit;
  });
 }
 // Follows the point being played rather than the camera: a camera chasing a
 // ball down a fairway is behind the action, and lighting from it would light
 // the ground the ball has already left.
 updateFloodlights(focus){
  if(!this.floodlit||!this.floodLamps)return;
  // Every pole is lit while there are few enough of them to afford, which on any
  // course this generator builds is all of them: a nine takes 57 and the longest
  // eighteen 141, and measured on a night course the difference between four
  // live lights and all of them is nothing -- 8.5 ms median either way, because
  // none of them casts a shadow. Past the cap the nearest follow the ball, which
  // is what the whole scene used to do.
  // The hole being played gets the first lamps, and the first lamps are the ones
  // that cast shadows. Everything else lights the course without casting.
  const near=orderPoles(this.poles,this.course?.hole,focus,this.floodLamps.length);
  const strength=FLOOD_INTENSITY*this.floodStrength();
  this.floodLamps.forEach((lamp,i)=>{
   const p=near[i];
   // A lamp with no pole to stand on is dimmed, not hidden -- same reason.
   lamp.intensity=p?strength:0;
   if(!p)return;
   // A caster moved to another pole has a stale shadow.
   if(lamp.castShadow&&(lamp.position.x!==p.x||lamp.position.z!==p.z||lamp.position.y!==p.y+p.height))this.floodShadowDirty=true;
   lamp.position.set(p.x,p.y+p.height,p.z);
   lamp.target.position.set(p.aimX,p.aimY,p.aimZ);
   lamp.target.updateMatrixWorld();
  });
 }
 setHole(index,instant=false){this.registerCascadeMaterials();
  // Warmed again per hole, not only per course: the flag, the cup, the rings
  // and the ball's own materials are per-hole objects, and a first compile of
  // any of them lands mid-shot. Compiling an already-compiled scene is a cache
  // lookup, so the repeat costs nothing.
  if(this.warmedHole!==index){this.warmedHole=index;queueMicrotask(()=>this.warmUp(0));}
for(const flag of this.flagsticks||[]){flag.userData.lift=false;flag.position.y=0;flag.visible=true;}this.course=this.world.holes[index];this.readingHeading=null;this.setBall(this.course.tee);this.setAim(0,180);this.setTrail([]);this.setCamera(this.course.tee,0,instant);this.setGreenGrid(this.config.greenGrid);}
 setGreenGrid(enabled){this.config.greenGrid=!!enabled;this.setGreenReading();}
 setGreenReading(){
  if(this.greenGrid){this.group.remove(this.greenGrid);this.greenGrid.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}this.greenGrid=null;this.reading=null;
  if(!this.config.greenGrid&&!this.config.greenFlow&&!this.config.greenHeat)return;
  this.reading=createGreenReading(this.course);this.greenGrid=this.reading.group;this.reading.grid.visible=!!this.config.greenGrid;this.reading.flow.visible=!!this.config.greenFlow;this.reading.heatmap.visible=!!this.config.greenHeat;this.readingEpoch=this.elapsed;this.greenGrid.visible=!this.readingHidden;this.group.add(this.greenGrid);
 }
 // Hiding the reading tools while the ball is moving, without tearing them down:
 // rebuilding walks every triangle of the green, which is far too much work to do
 // twice a shot, and the overlay has to come straight back for the next putt.
 setReadingHidden(hidden){
  this.readingHidden=!!hidden;
  if(this.greenGrid)this.greenGrid.visible=!this.readingHidden;
 }
 // A scatter of resting positions, for looking at a group of shots rather than
 // one. Points rather than balls: a hundred spheres with trails is a different
 // and much larger job, and what a dispersion test wants to show is the pattern.
 setScatter(points){
  if(this.scatter){this.group.remove(this.scatter);this.scatter.geometry.dispose();this.scatter.material.dispose();this.scatter=null;}
  if(!points||!points.length)return;
  const places=points.map(q=>{const w=this.course.toWorld(q);return new T.Vector3(w.x,this.course.height(q.x,q.z)+.035,w.z);});
  const geometry=new T.BufferGeometry().setFromPoints(places);
  const material=new T.PointsMaterial({color:'#fff3c4',size:.11,transparent:true,opacity:.95,depthWrite:false});
  material.onBeforeCompile=sh=>sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',
   '#include <clipping_planes_fragment>'+String.fromCharCode(10)+'if(length(gl_PointCoord-vec2(.5))>.5)discard;');
  this.scatter=new T.Points(geometry,material);this.scatter.renderOrder=4;this.group.add(this.scatter);
 }
 liftFlag(){if(this.flagsticks[this.course.hole])this.flagsticks[this.course.hole].userData.lift=true;}
 // THE PIN IS PULLED ONCE YOU ARE PUTTING, which is what happens on a real
 // green and takes the one object standing between the ball and the cup out
 // of the read. The cup, its liner and the floor are separate objects and
 // stay: it is the flagstick that goes, not the hole.
 setPinOut(out){const a=this.flagsticks?.[this.course.hole];if(a)a.visible=!out;}
 // THE GRID IS SQUARE TO THE SHOT, set once when it starts (the owner, 1
 // October). It first followed the play camera every frame, so every nudge of
 // the aim turned the whole grid with it -- hugely disorienting. Now `main`
 // hands over the starting aim when a shot is set up (setReadingHeading) and the
 // grid keeps that frame while the player aims. Every other camera has it on
 // the hole's axes, where squaring it would only make it swim as the view
 // orbits.
 setReadingHeading(p,aim){
  const h=this.course;if(!h||!p)return;
  const a=aim*Math.PI/180,w0=h.toWorld({x:p.x,z:p.z}),w1=h.toWorld({x:p.x+Math.sin(a),z:p.z+Math.cos(a)});
  this.readingHeading={x:w1.x-w0.x,z:w1.z-w0.z};
 }
 updateGreenGrid(){
  if(!this.reading)return;
  let heading=null;
  if(this.config.mode==='player'){
   // A shot set up before this existed, or a reading built some other way: the
   // camera's heading now, taken once and then held like any other.
   if(!this.readingHeading){this.camera.getWorldDirection(this.headingScratch??=new T.Vector3());this.readingHeading={x:this.headingScratch.x,z:this.headingScratch.z};}
   heading=this.readingHeading;
  }
  this.reading.update(this.elapsed-this.readingEpoch,heading);
 }
 setBall(p){this.localBall={...p};const v=this.course.toWorld(p),h=this.course.height(p.x,p.z),surface=this.course.surface(p.x,p.z),lift=0;this.ball.position.set(v.x,(p.y!==undefined?p.y:h+R)+lift,v.z);this.ballRing.position.set(v.x,h+lift+.01,v.z);const near=Math.hypot(p.x-this.course.pin.x,p.z-this.course.pin.z)<5;this.ballRing.scale.setScalar(near?.22:1);this.ballRing.visible=!near&&!(p.y!==undefined&&p.y<h);this.placeBallShadow(v.x,v.z,h,this.ball.position.y);}
 // WHAT PUTS THE BALL ON THE GROUND.
 //
 // A shadow does two things as the thing casting it rises: it spreads, and it
 // fades. Doing only the first gives a ball towing a dinner plate; doing only
 // the second gives a hard dot that blinks out. Both, and the eye reads height
 // off it without being told.
 //
 // Squared fade, so the darkening holds while the ball is near the turf -- which
 // is the whole point of it, and where a linear fade has already half gone.
 // AT REST, A CAST SHADOW AND A CONTACT SHADOW ARE VERY NEARLY THE SAME MARK.
 // A resting ball's centre is 2.1 cm up, so with the sun at 30 degrees its cast
 // shadow is offset 3.7 cm -- less than one ball. That is why this is not a
 // second mesh: the contact disc simply leans and stretches away from the sun,
 // which is what the real thing does at this scale.
 //
 // The offset is capped. A true shadow runs away from a ball in flight until the
 // two are unrelated, and a mark that far from the ball has stopped being a cue
 // about the ball.
 placeBallShadow(x,z,groundY,ballY){
  if(!this.ballShadow)return;
  this.ballShadowAt={x,z,groundY,ballY};
  const lift=Math.max(0,ballY-groundY);
  // Beyond eight metres the ball is read against the sky, and a mark on the
  // ground a long way from it is a distraction rather than a cue.
  const t=Math.min(1,lift/8);
  // Never under a ball that is below the ground: in a cup, or in the water.
  this.ballShadow.visible=t<1&&ballY>=groundY-.01;
  if(!this.ballShadow.visible)return;
  const radius=this.ballShadowRadius*(1+t*4.5);
  // Sun elevation drives both: a low sun throws a long shadow a long way, a high
  // one throws a short shadow straight down. Below the horizon there is no cast
  // shadow at all and the disc stays round -- what is left is contact occlusion,
  // which does not care where the sun is.
  const dir=this.sunDir,sinE=dir?Math.max(0,dir.y):1;
  const flat=Math.hypot(dir?.x??0,dir?.z??0);
  if(sinE>.05&&flat>1e-4){
   // Away from the sun, along the ground.
   const dx=-dir.x/flat,dz=-dir.z/flat;
   const offset=Math.min(BALL_SHADOW_REACH,lift*(flat/sinE));
   this.ballShadow.position.set(x+dx*offset,groundY+.012,z+dz*offset);
   // Stretched along that line by 1/sin(elevation), which is the projection of a
   // sphere onto the ground, capped so a sunrise does not draw a runway.
   const stretch=Math.min(BALL_SHADOW_STRETCH,1/sinE);
   this.ballShadow.scale.set(radius*stretch,radius,1);
   this.ballShadow.rotation.set(-Math.PI/2,0,Math.atan2(-dz,dx));
  }else{
   this.ballShadow.position.set(x,groundY+.012,z);
   this.ballShadow.scale.set(radius,radius,1);
   this.ballShadow.rotation.set(-Math.PI/2,0,0);
  }
  this.ballShadow.material.opacity=this.ballShadowInk*(1-t)*(1-t);
 }
 setPutting(config){
  this.putting=config;if(this.puttingRings){this.group.remove(this.puttingRings);this.puttingRings.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}this.puttingRings=new T.Group();this.group.add(this.puttingRings);if(!config||config.mode==='holeout')return;
  const h=this.course;[config.one,config.two,config.three].forEach((yards,i)=>{const points=[],radius=yards*YARD;for(let j=0;j<256;j++){const a=j/256*TAU,b=(j+1)/256*TAU,pts=[a,b].map(t=>({x:h.pin.x+Math.cos(t)*radius,z:h.pin.z+Math.sin(t)*radius}));if(pts.some(p=>h.surface(p.x,p.z)!=='green'))continue;for(const p of pts){const w=h.toWorld(p);points.push(new T.Vector3(w.x,h.height(p.x,p.z)+.025,w.z));}}const line=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:['#f7f6ae','#edb351','#e68670'][i],transparent:true,opacity:.85,depthWrite:false}));this.puttingRings.add(line);});
 }

 // Scratch space for a line's points, grown when a longer one is asked for and
 // reused for every write after that.
 aimScratch(points){
  if(!this._aimScratch||this._aimScratch.length<points*3)this._aimScratch=new Float32Array(points*3);
  return this._aimScratch;
 }
 // Write a line's geometry in place instead of replacing it.
 //
 // setAim runs on every frame an arrow key is held, and it used to build a
 // Vector3 per point, flatten them into a fresh array and swap in a whole new
 // LineGeometry: about 44 KB and several hundred throwaway objects a frame,
 // 2.6 MB/s at 60 Hz. The cost is not CPU -- that measured 0.06 ms -- it is
 // garbage, and it surfaced as an occasional 90 ms frame with no shader
 // compiling and no terrain tile building to blame.
 //
 // The buffer is allocated once at the length needed and rewritten after that,
 // with instanceCount deciding how much of it draws and only the written part
 // uploaded. Callers still own `visible`.
 writeLine(line,flat,count){
  const segments=Math.max(0,count-1);
  let attr=line.geometry.attributes.instanceStart;
  if(!attr||attr.data.array.length<segments*6){
   line.geometry.setPositions(new Float32Array(Math.max(segments,64)*6));
   attr=line.geometry.attributes.instanceStart;
   // Whatever sits past instanceCount is stale, and computeBoundingSphere reads
   // the whole attribute -- so the sphere would be wrong and the line could be
   // culled from a view it is plainly inside.
   line.frustumCulled=false;
  }
  const buffer=attr.data,a=buffer.array;
  for(let i=0;i<segments;i++){
   const from=i*3,to=from+3,at=i*6;
   a[at]=flat[from];a[at+1]=flat[from+1];a[at+2]=flat[from+2];
   a[at+3]=flat[to];a[at+4]=flat[to+1];a[at+5]=flat[to+2];
  }
  buffer.clearUpdateRanges?.();
  buffer.addUpdateRange?.(0,segments*6);
  buffer.needsUpdate=true;
  line.geometry.instanceCount=segments;
  return segments;
 }
 setAim(degrees,distance){
  const start=this.localBall||this.course.tee,steps=Math.max(60,Math.ceil(distance/.75));
  const flat=this.aimScratch(steps+1);
  for(let i=0;i<=steps;i++){
   const p=aimTarget(start,degrees,distance*i/steps),v=this.course.toWorld(p),at=i*3;
   flat[at]=v.x;flat[at+1]=this.course.height(p.x,p.z)+.10;flat[at+2]=v.z;
  }
  this.writeLine(this.aimLine,flat,steps+1);
  this.aimRing.position.set(flat[steps*3],flat[steps*3+1],flat[steps*3+2]);
  this.aimRing.scale.setScalar(Math.min(1,Math.max(.015,distance/60)));
 }
 // Draws a path the ball will actually take rather than a straight bearing, so a
 // breaking putt shows its curve. Points arrive in hole-local coordinates.
 //
 // FIFTEEN MILLIMETRES, NOT A HUNDRED. A full shot's aim line is lifted 100 mm
 // so it clears the ground it crosses -- it describes a ball that is about to
 // be in the air, and the ground between here and there is not the subject. A
 // putt is the opposite: the line IS the green, and at 100 mm it floated two
 // ball-heights up and appeared to leave from the top of the ball rather than
 // from under it.
 //
 // 15 mm sits below the ball's equator (the ball's centre is one radius up, so
 // 21 mm), which is what puts the ball ON the line instead of hanging off it,
 // and still stands clear of the surface. For reference the putting rings sit
 // at 25 mm and the lie scatter at 35 mm, so nothing here z-fights.
 setAimPath(points,distance){
  if(points.length<2)return;
  // Same line, so it writes the same way: two writers replacing and rewriting the
  // one geometry would undo each other's buffer every time the club changed.
  const flat=this.aimScratch(points.length);
  points.forEach((q,i)=>{
   const v=this.course.toWorld(q),at=i*3;
   flat[at]=v.x;flat[at+1]=this.course.height(q.x,q.z)+.015;flat[at+2]=v.z;
  });
  this.writeLine(this.aimLine,flat,points.length);
  const last=(points.length-1)*3;
  this.aimRing.position.set(flat[last],flat[last+1],flat[last+2]);
  this.aimRing.scale.setScalar(Math.min(1,Math.max(.015,distance/60)));
 }
 // The tracer runs through the centre of the ball. It used to be lifted 40 mm,
 // which is nearly two ball radii on a 21 mm ball, so the line floated clear
 // above the thing it was tracing. The recorded y IS the centre.
 // The tracer stops a ball's radius short of the ball, so it comes out of the
 // back of it rather than from under it. Ending at the centre means the ball
 // covers the last 21 mm of line, and a hop smaller than the ball -- which most
 // of the interesting ones are -- is hidden behind the thing that made it.
 setTrail(points){
  this.trail.visible=points.length>1;if(points.length<2)return;
  const kept=trimToBall(points);
  if(kept.length<2){this.trail.visible=false;return;}
  this.trail.geometry.dispose();
  this.trail.geometry=new LineGeometry().setPositions(kept.flatMap(p=>{const v=this.course.toWorld(p);return [v.x,p.y,v.z];}));
 }
 // The tracers of a finished hole, all at once. Dimmer and thinner than the live
 // one, because this is the record of what happened rather than the thing that is
 // happening.
 // A trail is `{points, colour}`. Four golfers' tracers over one fairway in one
 // amber answered nothing -- the summary orbit exists to show who went where,
 // and every line being the same colour is exactly the information it withheld.
 //
 // The bare-array and missing-colour branches are defensive, not a supported
 // second shape: every caller goes through `pushTrail`, which records the golfer
 // and their colour. They exist so a trail from anywhere else draws in the old
 // amber rather than black, which is what an unset `Color` gives you.
 setShotHistory(shots){
  for(const line of this.shotLines)line.visible=false;
  shots.forEach((trail,i)=>{
   const points=Array.isArray(trail)?trail:trail?.points;
   const kept=trimToBall(points||[]);
   if(kept.length<2)return;
   let line=this.shotLines[i];
   if(!line){
    line=new Line2(new LineGeometry(),new LineMaterial({color:SHOT_LINE_COLOR,linewidth:3,transparent:true,opacity:.72,depthWrite:false}));
    this.shotLines[i]=line;this.shotGroup.add(line);
   }
   // Lines are POOLED and reused across holes and players, so the colour is set
   // every time rather than only when one is created -- otherwise trail 2 keeps
   // whoever hit trail 2 on the previous hole.
   line.material.color.set(trail?.colour||SHOT_LINE_COLOR);
   line.geometry.dispose();
   line.geometry=new LineGeometry().setPositions(kept.flatMap(p=>{const v=this.course.toWorld(p);return [v.x,p.y,v.z];}));
   line.visible=true;
  });
 }
 clearShotHistory(){for(const line of this.shotLines)line.visible=false;}
 // EVERY BALL THE TEAM HIT, ON THE COURSE, WHILE ONE IS BEING CHOSEN.
 //
 // A scramble choice used to be a list of buttons naming a golfer and a yardage.
 // That is the one thing a list cannot tell you: whether the shorter one is
 // behind a bunker, or the longer one is on the wrong tier. The balls are drawn
 // where they lie, in the colour of the golfer who hit them, and each carries a
 // beam so it can be found from the far side of a fairway.
 //
 // Pooled like the tracers: at most four, rebuilt on every step through them.
 setCandidateBalls(list=[],active=-1){
  if(!this.pickGroup)return;
  for(const b of this.pickBalls)b.group.visible=false;
  list.forEach((c,i)=>{
   let b=this.pickBalls[i];
   if(!b){
    const group=new T.Group();
    const ball=new T.Mesh(new T.SphereGeometry(R*1.6,20,14),new T.MeshBasicMaterial({color:'#ffffff'}));
    const ring=new T.Mesh(new T.RingGeometry(.52,.66,48),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,forceSinglePass:true,transparent:true,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;
    // Depth-written beams would be occluded by a rise between you and the ball,
    // which is exactly when you most need to know where it is.
    const beam=new T.Mesh(new T.CylinderGeometry(.11,.11,9,10),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,depthWrite:false,depthTest:false}));
    beam.position.y=4.5;beam.renderOrder=3;
    group.add(ball,ring,beam);
    this.pickGroup.add(group);
    b=this.pickBalls[i]={group,ball,ring,beam};
   }
   const v=this.course.toWorld(c.position),h=this.course.height(c.position.x,c.position.z);
   b.group.position.set(v.x,h,v.z);
   b.ball.position.y=R*1.6;b.ring.position.y=.02;
   const colour=c.colour||'#ffe0a0';
   for(const part of [b.ball,b.ring,b.beam])part.material.color.set(colour);
   // The one being looked at stands up; the others stay legible but quiet, so
   // the choice reads at a glance from anywhere on the hole.
   const on=i===active;
   b.ring.scale.setScalar(on?1.7:1);
   b.ring.material.opacity=on?1:.4;
   b.beam.material.opacity=on?.62:.2;
   b.beam.scale.y=on?1:.55;
   b.group.visible=true;
  });
 }
 clearCandidateBalls(){for(const b of this.pickBalls||[])b.group.visible=false;}
 // A high, slow orbit of the whole hole, so every tracer is in one frame while
 // the scorecard is up. Radius and height come off the hole's own length: a
 // 130 yard par three should not be framed from where a 600 yard par five is.
 summaryOrbit(seconds){
  const h=this.course;if(!h)return;
  const mid={x:h.center(h.length*.5),z:h.length*.5};
  const c=h.toWorld(mid),ground=h.height(mid.x,mid.z);
  const angle=Math.PI+seconds*.055,radius=Math.max(115,h.length*.62);
  this.targetPos.set(c.x+Math.sin(angle)*radius,ground+Math.max(62,h.length*.34),c.z+Math.cos(angle)*radius);
  this.targetLook.set(c.x,ground+4,c.z);
  this.trackingBall=false;
 }
 hitEffects(p,aim,lie,speed){this.effects.hit(p,aim,lie,speed);}
 setCamera(p,aim,instant=false){
  this.camFlight=null;this.trackingBall=false;const c=this.config,h=this.course;
  if(c.mode==='free'){if(!this.wasFree){this.targetPos.copy(this.camera.position);this.freeYaw=Math.atan2(this.look.x-this.camera.position.x,this.look.z-this.camera.position.z);this.freePitch=Math.asin(T.MathUtils.clamp((this.look.y-this.camera.position.y)/Math.max(.001,this.look.distanceTo(this.camera.position)),-1,1));this.wasFree=true;}this.updateFreeLook();return;}
  this.wasFree=false;
  if(c.mode==='overview'){this.targetPos.set(-this.world.halfX*.4,Math.max(this.world.halfX/Math.min(1,this.camera.aspect),this.world.halfZ)*2.8,-this.world.halfZ*1.1);this.targetLook.set(0,0,40);}
  else if(c.mode==='green'){const q=h.worldPin;this.targetPos.set(q.x+28,h.height(h.pin.x,h.pin.z)+21,q.z+34);this.targetLook.set(q.x,h.height(h.pin.x,h.pin.z),q.z);}
  // THE RIG, not the raw config. In simulator mode the height, the setback and
  // the field of view come from the bay's measurements instead of the sliders,
  // and the lateral offset is forced to zero -- a golfer stands behind the ball,
  // not beside it, and "always the same view from behind" is the whole point.
  // ON THE GREEN THE CAMERA BACKS OFF UNTIL THE BALL IS IN FRAME. A putt is aimed
  // from the ball, so the ball has to be on screen; everywhere else it may sit
  // below the bottom edge, which is where it is in the room.
  else{const rig=(h?.surface?.(p.x,p.z)==='green')?framedForBall(cameraRig(c)):cameraRig(c);const pose=playerCameraPose(h,p,aim,rig);this.targetPos.set(pose.eye.x,pose.eye.y,pose.eye.z);this.targetLook.set(pose.target.x,pose.target.y,pose.target.z);this.camera.fov=rig.fov;this.lensShift=rig.shift||0;this.screenAspect=rig.aspect||null;}
  // Overview and the green view keep the chosen angle: neither is a view from
  // where anybody is standing, so a bay's measurements say nothing about them.
  if(c.mode!=='player'){this.camera.fov=c.fov;this.lensShift=0;this.screenAspect=null;}this.fitAspect();this.applyLensShift();this.camera.updateProjectionMatrix();if(instant||this.camera.position.distanceTo(this.targetPos)>60){this.camera.position.copy(this.targetPos);this.look.copy(this.targetLook);this.camera.lookAt(this.trackingBall?this.targetLook:this.look);}
 }
 // FLY to where setCamera would have put us, instead of cutting there.
 //
 // The destination is resolved by setCamera itself rather than worked out again
 // here: there is one definition of where the play camera stands, and a second
 // copy of it would drift from the first. So it is asked for the pose instantly,
 // the pose is taken, and the camera is put back where it was to fly there.
 //
 // Short moves are not flown. Under FLIGHT_FLOOR the move is an aim nudge or a
 // step behind the ball, and the ordinary damping already reads as movement.
 flyCamera(p,aim,opts={}){
  const eye=opts.from?opts.from.eye.clone():this.camera.position.clone();
  const look=opts.from?opts.from.look.clone():this.look.clone();
  this.setCamera(p,aim,true);
  if(this.config.mode==='free')return;
  const to={eye:this.targetPos.clone(),look:this.targetLook.clone()};
  // An arrival is worth taking however short the move, because the point of it
  // is the hold rather than the distance; a plain transition under the floor is
  // left to the damping.
  if(!opts.hold&&eye.distanceTo(to.eye)<FLIGHT_FLOOR)return;
  this.camera.position.copy(eye);this.look.copy(look);this.camera.lookAt(look);
  this.camFlight={path:makeCameraFlight({eye,look},to,this.world,{hold:opts.hold||0}),elapsed:0};
 }
 // THE ARRIVAL. Cut to a pose above and behind the tee, hold there long enough
 // to read the hole, then fly down onto the ball.
 //
 // The cut is deliberate and is the one place one is right: it lands on a hole
 // that did not exist a moment ago, straight out of the generating overlay, so
 // there is no continuous space to fly through. Flying from the old hole's green
 // would be crossing a landscape that has already been replaced.
 arriveAtHole(p,aim,hold=ARRIVE_HOLD){
  if(!this.course||this.config.mode==='free')return this.flyCamera(p,aim);
  this.flyCamera(p,aim,{from:holeEstablishingPose(this.course),hold});
 }
 cancelFlight(){this.camFlight=null;}
 updateFreeLook(){this.targetLook.copy(this.targetPos).add(new T.Vector3(Math.sin(this.freeYaw)*Math.cos(this.freePitch),Math.sin(this.freePitch),Math.cos(this.freeYaw)*Math.cos(this.freePitch)).multiplyScalar(100));}
 rotateFree(dx,dy){this.freeYaw-=dx*.004;this.freePitch=T.MathUtils.clamp(this.freePitch-dy*.003,-1.48,1.48);this.updateFreeLook();}
 moveFree(dt,forward,right,up,fast=false){const speed=this.config.freeSpeed*(fast?3:1)*dt,dir=new T.Vector3(Math.sin(this.freeYaw)*Math.cos(this.freePitch),Math.sin(this.freePitch),Math.cos(this.freeYaw)*Math.cos(this.freePitch));this.targetPos.addScaledVector(dir,forward*speed);this.targetPos.x-=Math.cos(this.freeYaw)*right*speed;this.targetPos.z+=Math.sin(this.freeYaw)*right*speed;this.targetPos.y+=up*speed;this.targetPos.x=T.MathUtils.clamp(this.targetPos.x,-this.world.halfX-400,this.world.halfX+400);this.targetPos.z=T.MathUtils.clamp(this.targetPos.z,-this.world.halfZ-400,this.world.halfZ+400);this.targetPos.y=T.MathUtils.clamp(this.targetPos.y,Math.max(this.world.waterLevel+1,this.world.height(this.targetPos.x,this.targetPos.z)+(this.config.freeFloor??1.2)),1800);this.updateFreeLook();}
 // The free camera put exactly somewhere, for measurements and screenshots that
 // must be taken from the same place every time (lab.camera). Angles in radians.
 placeCamera(eye,yaw,pitch){this.config.mode='free';this.wasFree=true;this.camFlight=null;this.trackingBall=false;this.targetPos.set(eye.x,eye.y,eye.z);this.freeYaw=yaw;this.freePitch=pitch;this.updateFreeLook();this.camera.position.copy(this.targetPos);this.look.copy(this.targetLook);this.camera.lookAt(this.look);}
 flyToHole(index){const h=this.world.holes[index],p=h.toWorld({x:36,z:h.length-45});this.config.mode='free';this.wasFree=true;this.targetPos.set(p.x,h.height(36,h.length-45)+38,p.z);this.freeYaw=Math.atan2(h.worldPin.x-p.x,h.worldPin.z-p.z);this.freePitch=-.48;this.updateFreeLook();this.camera.position.copy(this.targetPos);this.look.copy(this.targetLook);this.camera.lookAt(this.trackingBall?this.targetLook:this.look);}
 // The glow ball, and the two things around it that would otherwise stay lit for
 // a daytime that is no longer happening: the aim ring and the shot trail.
 //
 // Emissive intensity is set so the ball clears the bloom threshold on ultra --
 // the flare is the bloom pass finding it, not a second effect. The sprite halo
 // carries the tiers that have no bloom.
 // THE STRENGTH SLIDER (Weather & time) scales the ball's own glow, the light it
 // throws and the halo; the ring and the trail keep following the dark, since
 // they are dimmed for a reason that has nothing to do with how bright the
 // ball is.
 updateGlowBall(solar,daylight){
  if(!this.ball)return;
  const glow=daylight.glowBall===false?0:solar.lamplight,strength=Math.max(0,daylight.glowStrength??1);
  this.ball.material.emissiveIntensity=glow*1.76*strength;
  this.ballLight.intensity=glow*2.08*strength;
  this.ballHalo.visible=glow*strength>.01;
  this.ballHalo.material.opacity=Math.min(1,glow*.4*strength);
  // The ring and the trail are unlit materials, so nothing else would ever dim
  // them; left alone they stay daylight-bright against a dark course.
  this.ballRing.material.color.copy(this.ringBase).lerp(GLOW_BALL,glow);
  this.trail.material.color.copy(this.trailBase).lerp(GLOW_BALL,glow);
 }
 // Advance the clock and apply the light that follows from it. Everything here
 // is a uniform write and costs nothing per frame; CSM re-reads lightDirection
 // inside its own update(), so a moving sun never needs updateFrustums().
 updateDaylight(dt){
  if(!this.timed||!this.world)return;
  const d=this.daylight;
  if(d.rate)d.hour=advance(d.hour,d.rate,dt);
  const solar=solarState(d.hour,this.world.bio.sun);this.solar=solar;
  this.sunDir.copy(solar.direction);
  // The green shading follows the real sun rather than a fixed bearing, so it
  // needs the direction every time the clock moves.
  {const u=this.terrain?.material?.userData?.cues;if(u?.sunDir)u.sunDir.value.copy(this.sunDir);}
  // One directional light by day, or the cascades' own set; both take the same
  // colour and direction so the swap at dusk is invisible.
  const key=this.sunBase.clone().lerp(solar.keyTint,solar.keyTintAmount);
  const keyIntensity=solar.keyScale*this.sunBaseIntensity+solar.moonIntensity;
  if(!this.csm){this.sun.color.copy(key);this.sun.intensity=keyIntensity;}
  for(const light of this.csm?.lights||[]){light.color.copy(key);light.intensity=keyIntensity;}
  if(this.csm)this.csm.lightDirection.copy(solar.direction).negate().normalize();
  const t=solar.tintAmount;
  this.hemi.color.copy(this.hemiSkyBase).lerp(solar.tint,t);
  this.hemi.groundColor.copy(this.hemiGroundBase).lerp(solar.groundTint,t);
  this.hemi.intensity=this.hemiBaseIntensity*solar.hemiScale;
  this.renderer.toneMappingExposure=this.baseExposure*solar.exposureScale;
  if(this.skyMaterial){
   const u=this.skyMaterial.uniforms;u.sun.value.copy(solar.direction);
   // The dome's crown holds its colour a little longer than its horizon, which
   // is the order the real sky loses the light.
   u.top.value.copy(this.skyTopBase).lerp(solar.tint,t*.88);
   u.horizon.value.copy(this.skyHorizonBase).lerp(solar.tint,t);
   // The painted clouds take the same tint as the air. They were mixing toward
   // a hardcoded near-white, which is why they stayed daylight-bright against a
   // midnight sky -- the one thing in the scene the clock could not reach.
   u.cloudLight.value.copy(CLOUD_DAY).lerp(solar.tint,t*.92);
   // The sun's halo and its disc cool off as the moon takes over.
   u.glowColor.value.copy(GLOW_DAY).lerp(GLOW_NIGHT,1-solar.dayness);
   u.discColor.value.copy(DISC_DAY).lerp(DISC_NIGHT,1-solar.dayness);
   u.starness.value=solar.starness;u.starAngle.value=starRotation(d.hour);
   // The drawn moon: orange on the horizon, paling as it climbs, faint by day.
   const moon=this.world.bio.moon;
   if(moon){
    u.moonDir.value.copy(solar.moonDiscDirection);u.moonRadius.value=moon.size*Math.PI/180;
    u.moonColor.value.set(moon.low).lerp(MOON_HIGH.set(moon.high),T.MathUtils.smoothstep(solar.moonDiscElevation,3,30));
    // Faint by day, full as the light goes -- the same lamplight the lanterns
    // follow, so the moon is at its strongest by Dusk, not hours after it.
    u.moonAmount.value=moon.day+(1-moon.day)*Math.min(1,solar.lamplight*1.5);
   }else u.moonAmount.value=0;
  }
  this.updateGlowBall(solar,d);
  // Fog and background track the horizon, or the sky detaches from the land.
  this.scene.background?.copy?.(this.skyBgBase).lerp(solar.tint,t);
  this.scene.fog?.color.copy(this.fogBase).lerp(solar.tint,t);
  this.cloudUniforms?.cloudSun.value.copy(solar.direction).normalize();
  if(this.mistUniforms){
   const u=this.mistUniforms,p=profileFor(this.world.settings.biome),damp=mistAmount(d.hour);
   // Mist is lit by the sky, so it takes the air's own colour and sits a little
   // brighter than it. Tying it to the fog colour means it warms at dawn and
   // goes blue after dark without a second set of constants to keep in step.
   u.mistColor.value.copy(this.scene.fog.color).lerp(WHITE,.22);
   // Both derived from a stated visibility in metres rather than tuned by eye.
   // The haze never fully clears -- it is what gives distance its depth -- while
   // the sheet arrives and leaves with the morning.
   // Switched off, the sheet and the haze both go. The scene fog stays: that is
   // the distance cue the whole landscape is drawn against, and removing it
   // shows the edge of the world rather than a clear day.
   const weather=d.fog===false?0:1;
   const density=mistDensities(p,damp*weather,this.quality.mist*weather);
   u.mistDensity.value=density.haze;
   u.sheetDensity.value=density.sheet;
   u.waterDensity.value=density.water;
   // Anchored to the water level, which is where fog actually pools: terrain is
   // generated around this height whatever the biome's nominal altitude says,
   // so a hollow fills and a ridge stands clear of it.
   u.mistBase.value=this.world.waterLevel;
   u.mistTime.value=this.elapsed;
   // The air (U4): the horizon's colour, the sun's colour toward the sun, and
   // how strongly, from the Graphics panel's "Distance haze". Weather off
   // leaves it on: this is the air itself, not fog.
   u.aerialColor.value.copy(this.scene.fog.color).lerp(WHITE,.08);
   u.aerialWarm.value.copy(this.sun.color).lerp(this.scene.fog.color,.35);
   u.aerialSun.value.copy(this.sunDir);
   u.aerialStrength.value=(this.groundCues?.haze??50)/100*AERIAL_MAX;
  }
  // Water is tinted by the clock like the fog and the sky. Without it a pond
  // glowed biome teal under a night sky while the course around it went dark.
  for(const body of this.waterBodies||[]){
   const base=body.mesh?.material?.userData?.waterBase;
   if(base)body.mesh.material.color.copy(base).lerp(solar.tint,solar.tintAmount);
  }
  // Not while a new course is on its way (`retiring`, set by whileGenerating):
  // starting a round moves the clock from the menu's hour to the player's, and
  // this used to re-photograph every pond of the scene being thrown away --
  // measured at 1.6 s of the wait, on a nine-hole start. The new course takes
  // its own when it is built.
  if(!this.retiring&&(this.envElevation===null||Math.abs(solar.elevation-this.envElevation)>(this.style==='cartoon'?6:3)))this.refreshEnvironment(true);
  d.elapsedSinceSave+=dt;
  // localStorage is synchronous; writing the hour every frame would be a stall
  // for a value nobody reads until the next launch.
  // Not while the menu has borrowed the clock: the backdrop shows its own hour,
  // and a periodic save would write that over the one the player chose.
  if(d.elapsedSinceSave>30){d.elapsedSinceSave=0;if(!this.borrowedClock)saveDaylight(d);}
 }
 // `putting` does not change the RIG -- one camera means one pose for every
 // shot, a putt included -- it only pins the look on the cup while the ball is
 // rolling, so the hole stays still on screen instead of drifting around it.
 // A ball in the air outranks a camera move. Without this, taking a shot during
 // an arrival flight leaves the flight still driving the camera and the ball
 // tracking silently ignored for the rest of the path.
 follow(p,aim,putting=false){if(!this.config.follow||['overview','free'].includes(this.config.mode))return;
  this.camFlight=null;
  const pose=followPose(this.course,p,aim,putting);this.targetPos.set(pose.eye.x,pose.eye.y,pose.eye.z);this.targetLook.set(pose.target.x,pose.target.y,pose.target.z);this.trackingBall=true;}

 render(dt){
  // A course built without the loading screen's `ready` (none today, but the
  // studio could) still gets its water's probes, on its first frame.
  if(this.probeDue!=null&&!this.readying)this.takeDueProbes();
  // The floodlit programs, for a course that reached the screen without
  // `ready` (none today): sent for on its first frame. Every course built
  // through the loading screen has them already.
  if(this.nightWarmDue&&!this.readying){this.nightWarmDue=false;this.warmFloodlights();}
  // The still bodies' own clock. Their ripples are the only thing that tells a
  // pond with no reflector from a sheet of glass, so it runs whatever else is
  // happening -- including while the ball is in the air.
  if(this.waterTime)this.waterTime.value+=dt*(this.waterSpeed??1);
  this.clouds?.update(dt);
  this.updateDaylight(dt);
  // One queued pond photograph a frame (stepWaterProbes), here so the cull's
  // update further down puts back what the photograph had to show.
  this.stepWaterProbes();
  // Haunted Hollow: ghosts on their rounds, lanterns lit by the same dusk.
  this.haunts?.update(dt,this.elapsed,this.solar,this.camera);
  const fog=this.quality.fog,over=this.config.mode==='overview';this.scene.fog.near=over?fog.overviewNear:fog.near;this.scene.fog.far=over?fog.overviewFar:fog.far;
  // THE FOG IS THE DRAW DISTANCE (F5a in TODO). The far plane was a fixed 20 km
  // while fog only faded what was drawn, so Low's short fog hid the distance and
  // still paid for it: every tree and every ring of land out to the horizon,
  // drawn and then painted over. The far plane now ends 5% past where the fog
  // goes solid, and the frustum and the instance cull do the rest. The sky dome
  // is 7.5 km across and would be cut by a nearer far plane, so it follows the
  // camera and shrinks to fit inside it; its colour is a function of direction
  // only, so neither move changes what it looks like.
  {const far=Math.max(1500,this.scene.fog.far*1.05);
   if(Math.abs(this.camera.far-far)>1){this.camera.far=far;this.camera.updateProjectionMatrix();}
   if(this.sky){this.sky.position.copy(this.camera.position);this.sky.scale.setScalar(Math.min(1,far*.9/7500));}}this.updateGrass?.();this.elapsed+=dt;this.effects?.update(dt,this.elapsed);for(const flag of this.flagsticks||[])flag.position.y=T.MathUtils.damp(flag.position.y,flag.userData.lift?3:0,14,dt);this.updateGreenGrid();this.updateFloodlights(this.ball?.position);this.foliageTime.value=this.elapsed;this.breeze.value=.55+(this.world.settings.wind||0)*.07;{const wa=(this.world.settings.windDirection||0)*Math.PI/180;this.windVec.value.set(Math.sin(wa),Math.cos(wa));}for(const flag of this.flags||[]){const p=flag.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(this.elapsed*3.2+p.getX(i)*5)*.15*(p.getX(i)+.7));p.needsUpdate=true;}if(this.camFlight){
  // A flight drives the camera outright. The damping below is a spring toward
  // a target; running both would fight the path and round off its ends.
  this.camFlight.elapsed+=dt;
  const q=this.camFlight.path.pose(this.camFlight.elapsed);
  this.targetPos.copy(q.eye);this.targetLook.copy(q.look);
  this.camera.position.copy(q.eye);this.look.copy(q.look);
  if(q.done)this.camFlight=null;
 }
 const t=this.camFlight?0:1-Math.exp(-dt*(this.config.mode==='free'?10:4));this.camera.position.lerp(this.targetPos,t);if(!['free','overview'].includes(this.config.mode))this.camera.position.y=Math.max(this.camera.position.y,this.world.height(this.camera.position.x,this.camera.position.z)+.35);this.look.lerp(this.targetLook,t);this.camera.lookAt(this.trackingBall?this.targetLook:this.look);const near=T.MathUtils.clamp((this.camera.position.y-this.world.height(this.camera.position.x,this.camera.position.z))*.015,.5,25);if(Math.abs(this.camera.near-near)>.1){this.camera.near=near;this.camera.updateProjectionMatrix();}this.sun.target.position.set(this.camera.position.x,this.world.height(this.camera.position.x,this.camera.position.z),this.camera.position.z+80);this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir,420);this.clearCameraTrees?.();if(this.csm){
   // Zoomed all the way out, stretch the cascades over the whole course so every
   // tree keeps its shadow. Ultra only: the cost is resolution up close, and in
   // overview there is nothing up close to spend it on.
   const reach=this.config.mode==='overview'&&this.quality.overviewShadowFar?this.quality.overviewShadowFar:this.quality.shadowFar;
   // The splits also depend on the view (cascadeSplitter): the overview gets
   // three's own, so crossing into or out of it re-splits even when the
   // reach does not change, which on High it does not.
   const over=this.config.mode==='overview';
   if(this.csm.maxFar!==reach||this.csmOverview!==over){this.csm.maxFar=reach;this.csmOverview=over;this.csm.updateFrustums();this.cull?.dirty();}
   this.camera.updateMatrixWorld();this.csm.update();this.fitCascadeDepth();
  }
  // After the cascades have moved, so each shadow map gets the trees it can
  // reach this frame (instance-cull.js). Their shadow cameras are placed here
  // exactly as three places them when it draws the map.
  if(this.cull){
   const lights=this.csm?this.csm.lights:this.sun?.castShadow?[this.sun]:[];
   for(const l of lights){l.updateMatrixWorld();l.target.updateMatrixWorld();l.shadow.updateMatrices(l);}
   // A re-sort changes which trees each map draws, the floodlights' included
   // (they draw what the view does): their shadows are redrawn to match.
   if(this.cull.update(this.camera,this.timed?this.sunDir:null,lights)&&this.floodlit)this.floodShadowDirty=true;
  }
  if(this.floodShadowDirty&&this.floodlit){
   const now=performance.now();
   if(now-(this.floodShadowAt??-1e9)>=FLOOD_SHADOW_EVERY){
    this.floodShadowAt=now;this.floodShadowDirty=false;
    for(const lamp of this.floodLamps||[])if(lamp.castShadow)lamp.shadow.needsUpdate=true;
   }
  }
  this.bloom?.begin(this.renderer);
  this.renderer.render(this.scene,this.camera);
  this.godRays?.render(this.renderer,this.scene,this.camera,this.sunDir,this.sun.color,this.readying);
  if(this.bloom)this.bloom.finish(this.renderer);else this.renderer.setRenderTarget(null);}
 project(p){const w=this.course.toWorld(p),v=new T.Vector3(w.x,p.y,w.z).project(this.camera);return{x:(v.x*.5+.5)*this.canvas.clientWidth,y:(-.5*v.y+.5)*this.canvas.clientHeight,visible:v.z<1&&v.z>-1};}
 // A MARKER THAT CANNOT LEAVE THE SCREEN. `project` answers where a point
 // lands and whether it is in the depth range; it says nothing about the sides,
 // and behind the camera it is worse than useless -- the perspective divide is
 // by a negative w, so both axes flip and the marker appears on the OPPOSITE
 // side to the thing it marks. This clamps to the viewport with a margin and
 // reports the screen direction, so a caller can point the marker at whatever
 // it has been pushed away from.
 // WHICH WAY THE CAMERA IS FACING, as a compass bearing in degrees with 0
 // along +z -- the same convention `windDirection` uses, so the two can be
 // subtracted. Read from the camera's own world matrix rather than from
 // `look`, which lags it by a frame of damping.
 cameraHeading(){const f=new T.Vector3();this.camera.getWorldDirection(f);return Math.atan2(f.x,f.z)*180/Math.PI;}
 // CLAMPED TO A RECTANGLE, NOT AN EVEN MARGIN. A single inset assumes the
 // edges are equally free and they are not: the bottom of the screen is the
 // shot controls and the right is the hole map, so a marker pushed to either
 // lands behind a panel. The caller passes what is actually clear -- it can
 // measure the panels, which move -- and the default is a plain inset for a
 // caller that has nothing to say.
 projectMarker(p,insets=30){
  const i=typeof insets==='number'?{top:insets,right:insets,bottom:insets,left:insets}:insets;
  const w=this.course.toWorld(p),v=new T.Vector3(w.x,p.y,w.z);
  // Camera space rather than the projected z: three looks down its own -z, so
  // a positive z here is behind the lens, which is the case the flip comes from.
  const behind=v.clone().applyMatrix4(this.camera.matrixWorldInverse).z>0;
  const ndc=v.project(this.camera),W=this.canvas.clientWidth,H=this.canvas.clientHeight;
  let x=(ndc.x*.5+.5)*W,y=(-.5*ndc.y+.5)*H;
  if(behind){x=W-x;y=H-y;}              // undo the flip, so the direction is true
  // The free rectangle, and its own centre -- pushing out from the SCREEN
  // centre through an off-centre rectangle lands short on one side and over
  // the edge on the other.
  //
  // WORDS, NOT LETTERS, FOR ITS EDGES. These were L, R, T and B, and `T` is
  // three.js in this file: a `const T` here shadows the library for the whole
  // function, so the `new T.Vector3` at the top reached an uninitialised
  // variable and threw on EVERY call. That was every frame the ball sat on a
  // green, from 19 September until the browser smoke test found it -- silent,
  // because the frame loop schedules the next frame first, and fatal to this
  // marker, which never once positioned itself. tests/three-namespace.test.mjs
  // now refuses any binding named T in a module that imports three as T.
  const left=i.left,right=Math.max(left+1,W-i.right),top=i.top,bottom=Math.max(top+1,H-i.bottom);
  const cx=(left+right)/2,cy=(top+bottom)/2;
  let dx=x-cx,dy=y-cy;
  if(!dx&&!dy)dy=1;                     // dead centre and behind: send it downward
  const reach=(d,half)=>d?half/Math.abs(d):Infinity;
  const s=Math.min(reach(dx,(right-left)/2),reach(dy,(bottom-top)/2));
  const outside=behind||s<1;
  if(outside){x=cx+dx*s;y=cy+dy*s;}
  // Screen bearing, 0 pointing up, for rotating the marker toward its subject.
  return {x,y,clamped:outside,angle:Math.atan2(dx,-dy)*180/Math.PI};
 }
 pick(clientX,clientY){const r=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);const hit=this.raycaster.intersectObjects(this.targets)[0]?.point;return hit?this.course.toLocal(hit):null;}
}
export function drawMap(canvas,course,position,candidates=[],full=false,camera=null,aimPoint=null,time=0){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,world=course.world;
 // THE BASE COAT IS WHAT YOU SEE AROUND THE HOLE, so it has to be ground.
 // `mapWater` is the colour BEYOND the generated land -- sea on the island,
 // a pale #e0e5d5 everywhere else -- and on the full-course map the terrain
 // tile paints over all of it, so the pale default only ever showed outside
 // the world rectangle. Hole view draws no such tile, so the same base coat
 // was the entire surround: a hole sitting on paper, ringed in near-white.
 //
 // In hole view the surround is the biome's own rough, which is what is
 // actually out there. `mapGround` lets a biome override it without
 // disturbing what its sea looks like.
 ctx.fillStyle=full?world.bio.mapWater:(world.bio.mapGround??world.bio.rough);
 ctx.fillRect(0,0,w,h);
 // The nav rides on the CANVAS beside its transform. Five call sites draw this
 // map from four different places, and threading a pan/zoom argument through
 // all of them is how one of them ends up not having it -- which would read as
 // the map resetting itself in that one mode.
 const transform=mapLayout(course,w,h,full,position,canvas.mapNav,canvas.mapFocus),scale=transform.scale,to=(x,z,hole=course)=>mapPoint(transform,full?hole.toWorld({x,z}):{x,z});canvas.mapTransform=transform;canvas.dataset.courseSeed=world.seed;canvas.dataset.holeNumber=String(course.hole+1);canvas.setAttribute('aria-label',full?`${world.holes.length}-hole course map · ${world.seed}`:`Hole ${course.hole+1} map · ${world.seed} · playing direction up`);

 if(full){if(!world.mapBackground){const tile=document.createElement('canvas');tile.width=tile.height=150;const c=tile.getContext('2d'),img=c.createImageData(150,150);for(let j=0;j<150;j++)for(let i=0;i<150;i++){const x=(i/149*2-1)*world.halfX,z=(j/149*2-1)*world.halfZ,y=world.land(x,z),color=new T.Color(y<0?'#6eb8c0':world.bio.shoreSand&&y<2?'#e9dec0':world.bio.rough).multiplyScalar(.9+Math.min(Math.max(y,0),80)/500).convertLinearToSRGB(),k=(j*150+i)*4;img.data.set([color.r*255,color.g*255,color.b*255,255],k);}c.putImageData(img,0,0);world.mapBackground=tile;}
  // PLACED THROUGH `tilePlacement`, LIKE EVERY OTHER TILE ON THIS MAP.
  //
  // This used to be drawn at `w/2 - halfX*scale`, which silently assumes the
  // map is centred on the world origin. `mapPoint` is `w/2 - (p - c)*scale`,
  // and `withNav` moves that centre for pan AND for zoom -- so the background
  // scaled about the middle of the canvas while every fairway, pond and bunker
  // translated about the map centre, and the two slid apart as you zoomed. The
  // terrain appeared to move independently of the course drawn on it.
  //
  // Deriving the placement from `mapPoint` is what makes that impossible, which
  // is the whole reason `tilePlacement` exists; this was the one tile that was
  // not using it.
  const bg=tilePlacement(transform,{x:0,z:0,rx:world.halfX,rz:world.halfZ},world.mapBackground.width,world.mapBackground.height);
  ctx.save();ctx.translate(bg.x,bg.y);ctx.scale(bg.sx,bg.sy);ctx.drawImage(world.mapBackground,0,0);ctx.restore();}

 for(const hole of full?world.holes:[course]){
  ctx.lineJoin='round';ctx.lineCap='round';for(const[margin,col]of[[hole.settings.semiRough,world.bio.mapTurf?.semi??'#a1b481'],[0,world.bio.mapTurf?.fairway??'#608449']]){ctx.beginPath();for(const side of [1,-1])for(let i=0;i<=100;i++){const mow=hole.mowStart??hole.fairwayStart,z=mow-margin+(hole.length+8-mow+2*margin)*(side===1?i/100:1-i/100),p=to(hole.center(z)+side*fairwayWidth(hole,z,margin,side),z,hole);side===1&&i===0?ctx.moveTo(...p):ctx.lineTo(...p);}ctx.closePath();ctx.fillStyle=col;ctx.fill();}
  for(const p of hole.ponds){ctx.fillStyle='#70a6aa';ctx.beginPath();for(let i=0;i<64;i++){const v=ovalRadius(p,i/64*TAU),q=to(p.x+v.x,p.z+v.z,hole);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();}
  for(const p of hole.bunkers){ctx.fillStyle='#efe0b9';ctx.beginPath();for(let i=0;i<64;i++){const v=ovalRadius(p,i/64*TAU),q=to(p.x+v.x,p.z+v.z,hole);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();}
  for(const[name,t]of Object.entries(hole.tees)){const q=to(t.x,t.z,hole);ctx.fillStyle=TEE_COLORS[name];ctx.beginPath();ctx.arc(...q,full?1.8:3,0,TAU);ctx.fill();}
  // The disc is the green, so it is drawn around the green's centre; the number
  // that labels the hole goes with it.
  const centre=hole.green??hole.pin;
  const[gx,gy]=to(centre.x,centre.z,hole);ctx.fillStyle=world.bio.mapTurf?.green??'#b3cc86';ctx.beginPath();for(let i=0;i<64;i++){const a=i/64*TAU,r=greenRadius(hole,a),q=to(centre.x+Math.cos(a)*r*hole.greenAspect,centre.z+Math.sin(a)*r,hole);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();ctx.fillStyle=hole.hole===course.hole?'#c76a3d':'#365540';ctx.font='bold '+(full?8:10)+'px '+UI_FONT;ctx.textAlign='center';ctx.fillText(String(hole.hole+1),gx,gy-5);
 }
 if(aimPoint){const from=to(position.x,position.z),target=to(aimPoint.x,aimPoint.z);ctx.save();ctx.strokeStyle='#fff1ac';ctx.lineWidth=3.5;ctx.setLineDash([8,6]);ctx.lineDashOffset=-time*22;ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...target);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#294c39';ctx.lineWidth=2;ctx.fillStyle='#ffed9e';ctx.beginPath();ctx.arc(...target,5,0,TAU);ctx.fill();ctx.stroke();ctx.restore();}
 ctx.save();if(full){ctx.beginPath();ctx.rect(w/2-world.halfX*scale,h/2-world.halfZ*scale,world.halfX*2*scale,world.halfZ*2*scale);ctx.clip();}
 // THE GREEN, READ FROM ABOVE. Only while framed on it: at hole scale the tile
 // would be a few coloured pixels, and every other view already shows the green
 // as a flat disc.
 if(transform.focus==='green'&&canvas.mapHeat!==false){
  try{
   // 256 RATHER THAN THE DEFAULT 96, because this is the one view that
   // magnifies the tile. At hole scale the green is a smudge and 96 is more
   // than enough; framed on the green the same 96 texels are stretched over
   // the whole canvas, which is about four screen pixels each and reads as
   // pixellation however good the smoothing is. The field is built once per
   // green and cached, so the cost is one-off.
   const tile=greenHeatTile(course,256);
   if(!tile.flat){
    // THE TILE IS PROJECTED, NOT FITTED INTO A BOX. `mapPoint` is
    // `w/2 - (p - c) * scale` on BOTH axes, so the map is the world turned
    // through 180 degrees; the tile's pixel (0,0) is minimum x and minimum z,
    // which lands bottom-RIGHT on screen. Normalising the destination
    // rectangle -- which is what this did first -- puts the image the right
    // size in the right place and 180 degrees out, so the high side of the
    // green was painted over the low side. Deriving the transform from the
    // same `to()` the outline uses cannot disagree with it; the negative
    // scales carry the flip.
    const place=tilePlacement(transform,tile.bounds,tile.canvas.width,tile.canvas.height);
    ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.translate(place.x,place.y);ctx.scale(place.sx,place.sy);
    ctx.drawImage(tile.canvas,0,0);
    ctx.restore();
   }
  }catch{ /* a green that cannot be sampled simply is not painted */ }
 }
 for(const stream of world.streams?.streams||[]){ctx.strokeStyle='#79aeb4';ctx.lineJoin='round';ctx.lineCap='round';for(let i=1;i<stream.points.length;i++){const a=stream.points[i-1],b=stream.points[i],p=mapPoint(transform,full?a:course.toLocal(a)),q=mapPoint(transform,full?b:course.toLocal(b));ctx.lineWidth=Math.max(1,(a.width+b.width)*.5*scale);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}}
 // Houses only read on the full-course map; on a hole map they are clutter
 // around the corridor the player is actually aiming down.
 if(full){
  ctx.fillStyle='#c8bda4';ctx.strokeStyle='#8d8471';ctx.lineWidth=.6;
  for(const home of world.homes||[]){const q=mapPoint(transform,home);const w=Math.max(2,home.width*scale),d=Math.max(2,home.depth*scale);ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(-home.rotation);ctx.fillRect(-w/2,-d/2,w,d);ctx.strokeRect(-w/2,-d/2,w,d);ctx.restore();}
 }
 ctx.restore();
 // PER-CLUB DISPERSION, under the ball so the ball is never hidden by it. Each
 // group is the shots that club actually hit: a dot per finish, and a circle at
 // one standard distance from their centre -- about two thirds of the group, not
 // the outlier that would let one thinned wedge define the club.
 for(const g of canvas.mapDispersion||[]){
  const centre=to(g.centre.x,g.centre.z);
  // The world-to-canvas map negates BOTH axes and scales them equally, which is a
  // 180 degree rotation -- and an ellipse is symmetric under that -- so the world
  // angle is the canvas angle with no correction.
  const long=Math.max(3,g.long*scale),wide=Math.max(3,g.wide*scale);
  // A DARK UNDER-STROKE FIRST. These land on the green and the fairway, which are
  // mid-tone greens themselves, and a single coloured hairline on top of them
  // disappeared -- visible in a screenshot, invisible at a glance.
  ctx.beginPath();ctx.ellipse(centre[0],centre[1],long,wide,g.angle,0,TAU);
  ctx.fillStyle=clubColour(g.club,.13);ctx.fill();
  ctx.strokeStyle='rgba(12,24,16,.55)';ctx.lineWidth=3.4;ctx.setLineDash([5,4]);ctx.stroke();
  ctx.strokeStyle=clubColour(g.club,1);ctx.lineWidth=2;ctx.stroke();
  ctx.setLineDash([]);
  for(const p of g.points){
   const q=to(p.x,p.z);
   ctx.beginPath();ctx.arc(...q,2.4,0,TAU);
   ctx.fillStyle=clubColour(g.club,1);ctx.fill();
   ctx.strokeStyle='rgba(12,24,16,.6)';ctx.lineWidth=1;ctx.stroke();
  }
  // The centre is a cross rather than a dot: a dot in the middle of a ring of
  // dots reads as another shot, and this is the one mark that is not one.
  ctx.beginPath();ctx.moveTo(centre[0]-5,centre[1]);ctx.lineTo(centre[0]+5,centre[1]);
  ctx.moveTo(centre[0],centre[1]-5);ctx.lineTo(centre[0],centre[1]+5);
  ctx.strokeStyle='rgba(12,24,16,.6)';ctx.lineWidth=3.4;ctx.stroke();
  ctx.strokeStyle=clubColour(g.club,1);ctx.lineWidth=1.6;ctx.stroke();
 }
 const[bx,by]=to(position.x,position.z);ctx.fillStyle='#fff';ctx.strokeStyle='#31503c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(bx,by,full?3:4,0,TAU);ctx.fill();ctx.stroke();
 for(const c of candidates){const q=to(c.position.x,c.position.z);ctx.fillStyle='#cd8c46';ctx.beginPath();ctx.arc(...q,3,0,TAU);ctx.fill();}
 if(full&&camera){ctx.fillStyle='#c35e3e';ctx.beginPath();ctx.arc(...mapPoint(transform,camera),4,0,TAU);ctx.fill();}
}
