import {addHomes} from './homes.js';
import {mailboxAt} from './roads.js';
import {phoneLift,liftsView} from './phone-view.js';
import {addStreams} from './streams.js';
import {landscapeGeometry,stitchSeam} from './landscape-edge.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {polesFor,orderPoles,POLE_REACH,lampBudget} from './floodlights.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {aimTarget,createShotEffects} from './shot-visuals.js';
import {makeCameraFlight,holeEstablishingPose,FLIGHT_FLOOR,ARRIVE_HOLD} from './camera-tours.js';
import {mapLayout,mapPoint,mapPosition,tilePlacement} from './course-map.js';
import {GROUNDS} from './grounds.js';
import {clubColour} from './dispersion.js';
import {greenHeatTile} from './green-map.js';
import {createGreenReading} from './green-reading.js';
import {greenGradient} from './course-plan.js';
import {TEE_COLOURS} from './tees.js';
import {greenDistance} from './course.js';
import {worldOf,biomeOf} from './biomes.js';
import {clubhouseModel} from './clubhouse.js';
import {roundSeason,seasonPalette,WINTER} from './seasons.js';
import {regionOf,LANDSCAPES,currentKey} from './regions.js';
import {cameraRig,loadCamera} from './camera-prefs.js';
// The amber every tracer used to be, kept as the fallback for a trail that
// names no golfer.
const SHOT_LINE_COLOR='#ffe0a0';
import {groundGeometry,groundMaterial,HOLE_ATLAS,RANGE_GREENS} from './ground.js';
import {uiZoom} from './ui-scale.js';
import {writeRangeGreens,activeGreen} from './range.js';
import {tracerStyle,summaryStyle,stopColour,hexRgb} from './rewards.js';
import {finishTexels,finishSurface,finishAverage} from './ball-finishes.js';

// The flagstick's dimensions live in physics.js beside the collider that uses
// them (FLAGSTICK_HEIGHT and the two drawn radii). A ball meets a real, thinner stick (FLAGSTICK_HIT_R).
//
// FLAGSTICKS STAY VISIBLE FROM ANYWHERE (the owner, 13 October 2026: "work on
// the visibility of the flagsticks from a distance"). Drawn to size, a 7 ft
// stick 18 mm across is under a tenth of a pixel wide from 250 yd on a
// 1080-line screen and its flag about three pixels -- it simply vanishes, and
// it is the one thing a golfer most needs to find. So once the stick would
// stand shorter than FLAG_MIN_PX on screen, stick and flag grow together to
// hold that ANGULAR size (up to FLAG_MAX_SCALE), the cloth may grow a little
// more so it stays at least FLAG_CLOTH_PX wide, and the pole is thickened on
// top of that so it never drops below POLE_MIN_PX. Close up -- a chip, a pitch,
// anything from the green -- they are exactly to size. Drawing only: the ball
// collides with the real stick. The range's target boards make the same
// angular-size choice (addTargetFurniture). PLACED by eye. All of this happens
// only when the player turns on "Larger flags far away" (graphics.distantFlags,
// OFF by default since 14 October 2026); the range boards are not under that
// switch.
const FLAG_MIN_PX=36,FLAG_MAX_SCALE=10,FLAG_CLOTH_PX=14,POLE_MIN_PX=2;
import {toonRamp} from './textures.js';
import {modelParts} from './mesh-assets.js';
import {MESH_MODELS} from './asset-meshes.js';
// THE SUN AND THE SKY'S SHARE OF THE LIGHT (the cartoon overhaul's lighting,
// round 3). The sky's flat fill was 1.15 against a sun of 2.8: a third of
// every surface's light came from no direction, and a dune turned from a noon
// sun drew barely darker than the flat beside it. PLACED by eye: about a
// quarter now, so land reads by its shading.
const HEMI=.95,SUN=3.05;
import * as T from 'three';
import {fountainDrops,dropAt,ringAt,jetAt} from './fountain.js';

import {solarState,defaultHour,advance,loadDaylight,saveDaylight,localHour,starRotation,STAR_AXIS,mistAmount} from './daylight.js';
import {random,greenRadius,greenPoint,fairwayWidth,ovalRadius,hazardProfile,TEE_PAD,TEE_APRON,TEE_MARKER_INSET,PIN_FLAGS,pinBandOf} from './course.js';
import {addVegetation,farWoodGeometry,snowTopped} from './vegetation.js';
import {makeWaterMirror} from './water-mirror.js';
import {buildGroundLod, select as selectGround, nodeBox as groundNodeBox, GROUND_LOD} from './ground-lod.js';
import {holePath} from './low-trees.js';
import {cullInstances} from './instance-cull.js';
import {playerCameraPose,flightCameraPose,followPose,framedForBall,puttAimPose,stepOrbit,orbitEye} from './camera.js';
import {R,CUP_RADIUS,YARD,clamp,FLAGSTICK_HEIGHT,FLAGSTICK_TOP_R,FLAGSTICK_BASE_R} from './physics.js';
import {puttingRings} from './putting.js';
import {teeAim} from './camera-tours.js';
import {tierOf,greenCues} from './graphics.js';
import {CSM} from 'three/addons/csm/CSM.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeGodRays} from './godrays.js';
import {applyCloudShadows,cloudShadowUniforms,packCloudShadows,allCloudShadows} from './cloud-shadows.js';
import {makeClouds,applyCloudFade} from './clouds.js';
import {mistUniforms,applyMistTo,profileFor,mistDensities,bakeWaterField,setWaterField} from './mist.js';

import {makeBloom} from './bloom.js';
import {hideForProbe,restoreAfterProbe} from './water-bodies.js';
import {reliefShade,reliefOverlay} from './map-relief.js';
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
uniform float waterTime,foamPace,foamGrain,shoreLength;varying vec2 vFoamUv;varying vec3 vFoamWorld;varying float vFoamWind;
/* Hash without Sine, (c)2014 David Hoskins, MIT: THIRD_PARTY_NOTICES.txt */float fHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float fNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fHash(i),fHash(i+vec2(1.,0.)),f.x),mix(fHash(i+vec2(0.,1.)),fHash(i+vec2(1.,1.)),f.x),f.y);}
float foamAlpha(){
 // A pond at 30% of the water's own clock: at full speed the lapping read as
 // frantic (the owner, after the first build). A lake a little livelier.
 float v=vFoamUv.y,t=waterTime*foamPace;
 // THE FAR-LANDSCAPE GOAL'S WAVES (the owner: "not just reading as a sine
 // wave on the edge"), round 1. The surge was one sine of the world position:
 // a band breathing in and out the same way all round. Now wavelets ARRIVE:
 // two trains running along the shore at their own speeds and lengths (metres
 // along the outline, so they follow every bend), each wavelet's reach set by
 // a slow noise -- some run up further, some die short -- and the foam is a
 // lip at each wavelet's front with a thinner wash left behind it as it falls
 // back. PLACED.
 float s=vFoamUv.x*shoreLength;
 // Each train a whole number of wavelets round the shore, so they meet where
 // the outline closes.
 // Round 16: wavelets as long as the water lets them grow -- a small pond's
 // fetch is short, so its wavelets come shorter and closer (0.6 of the length
 // on a pond 180 m round, 1.2 on one 360 m and more).
 float sc=clamp(shoreLength/300.,.6,1.2);
 float l1=shoreLength/max(1.,floor(shoreLength/(7.3*sc)+.5)),l2=shoreLength/max(1.,floor(shoreLength/(11.9*sc)+.5));
 float w1=fract(s/l1-t*.11),w2=fract(s/l2+t*.07+.37);
 float reach1=.25+.5*fNoise(vec2(mod(floor(s/l1-t*.11),997.)*1.7,3.1)),reach2=.2+.45*fNoise(vec2(mod(floor(s/l2+t*.07+.37),997.)*2.3,7.9));
 float crest1=smoothstep(0.,.5,w1)*(1.-smoothstep(.5,1.,w1)),crest2=smoothstep(0.,.5,w2)*(1.-smoothstep(.5,1.,w2));
 // Round 8: further up the bank the wind blows onto, short on the sheltered one.
 float front=max(crest1*reach1,crest2*reach2)*mix(.45,1.25,vFoamWind)+.08*fNoise(vec2(s*.21,t*.3));
 float lip=smoothstep(front-.07,front,v)*(1.-smoothstep(front,front+.1,v))*mix(.5,1.,vFoamWind);
 float wash=smoothstep(.0,.1,v)*(1.-smoothstep(front*.5,front,v))*.45;
 float band=max(lip,wash)*smoothstep(0.,.06,v);
 // Round 4: the wet line where water meets bank, always there (a pond's
 // wavelets are small; at a distance only this line showed it had an edge),
 // its width breathing slowly along the shore.
 float wet=smoothstep(0.,.015,v)*(1.-smoothstep(.03,.07+.05*fNoise(vec2(s*.43,t*.17)),v));
 float lace=fNoise(vFoamWorld.xz*2.3*foamGrain+vec2(t*.21,-t*.16))*.62+fNoise(vFoamWorld.xz*5.7*foamGrain-vec2(t*.33,t*.12))*.38;
 return max(band*smoothstep(.42,.75,lace)*.55,wet*(.32+.18*lace));
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
 // THE SHALLOWS (the cartoon overhaul's water, round 1): a pond lightens and
 // clears toward its bank, where the bed shows through -- the sea always knew
 // its depth (seaHeights, from the ground grid) and a pond now reads the same
 // map. Over the last 0.9 m of depth the colour lifts toward a sunlit sandy
 // green and the water thins, so a pond has a lit rim and a dark heart
 // instead of one flat colour bank to bank.
 still:`{
  vec2 su=vec2((vWaterWorld.x+seaGrid.x)/(2.*seaGrid.x),(vWaterWorld.z+seaGrid.y)/(2.*seaGrid.y));
  float inside=step(0.,su.x)*step(su.x,1.)*step(0.,su.y)*step(su.y,1.);
  vec2 suv=(su*(seaGrid.zw-1.)+.5)/seaGrid.zw;
  float depth=mix(50.,seaLevel-texture2D(seaHeights,suv).r,inside);
  // Round 2: at .9 m the band was a hairline -- a pond has a cut bank, so it
  // is that deep within a metre or so of its edge. Over 1.8 m now, stronger.
  float shallow=(1.-smoothstep(.05,1.8,depth))*inside;
  outgoingLight=mix(outgoingLight,outgoingLight*vec3(1.12,1.2,1.05)+vec3(.06,.09,.05),shallow*.85);
  diffuseColor.a*=mix(1.,.72,shallow);
  // Round 3: looking down from the bank the water went nearly clear, and the
  // ripples made that patchy, so the bed's dark floor came through as brown
  // smears. Deep water keeps most of its body; the shallows stay clear.
  diffuseColor.a=max(diffuseColor.a,.82*(1.-shallow));
  // THE POLISH GOAL'S WATER, round 1 (the owner: "are the water depth colors
  // reversed? It looks lighter colored in the middle where it's deeper").
  // They were: the shallows above let the bed through (alpha down to .72 of
  // a near-clear .22 looking down), and the bed under a pond is the dark bank
  // colour, so the rim went brown; the deep middle was opaque and showed the
  // water's own bright colour and the sky. The body of still water is now its
  // depth's own colour, lit by the light it receives: the biome's water darker
  // and richer toward the deep, lifted toward a sunlit sandy teal toward the
  // bank, nearly opaque, so the bed no longer decides. Reflections and glints
  // keep a share on top.
  ${FOAM_LIGHT}
  float deep=smoothstep(.15,3.2,depth);
  // Round 2: round 1's colours went milky under the sun's full light; both
  // darker, the deep much darker and bluer.
  vec3 shallowBody=mix(diffuseColor.rgb,vec3(.5,.66,.52),.35)*.62,deepBody=diffuseColor.rgb*vec3(.2,.32,.4);
  vec3 body=mix(shallowBody,deepBody,deep)*foamLight;
  // Round 3: from the bank the body covered the reflection too, and a pond
  // seen across went a flat milky sheet. Water looked into shows its body;
  // water looked across is a mirror -- so the body's share falls with the
  // view's grazing angle (Schlick, as the opacity above).
  float lookIn=abs(dot(normalize(vViewPosition),normal)),mirror=.02+.98*pow(1.-lookIn,5.);
  outgoingLight=mix(outgoingLight,body,.78*(1.-clamp(mirror*1.4,0.,.85)));
  diffuseColor.a=max(diffuseColor.a,mix(.86,.97,deep));
  // WAVELETS COMING IN (the far-landscape goal's waves, round 2): before the
  // foam at the bank, small crests running in along the depth lines toward
  // the shore -- so they follow its shape -- broken along their length by a
  // drifting noise, catching the light; only in the last 0.7 m of depth.
  // Round 3: on a pond shallow far out they streaked its middle -- the last
  // 0.4 m only, dimmer, and only where a broad noise lets a set come in.
  {
   float wt=waterTime*.3,crestPh=depth*9.-wt*1.1+wNoise(vWaterWorld.xz*.35)*1.6;
   float crest=smoothstep(.72,.98,sin(crestPh*6.2832)*.5+.5)*(1.-smoothstep(.08,.4,depth))*smoothstep(.3,.6,wNoise(vWaterWorld.xz*.18+3.7))*inside;
   crest*=smoothstep(.35,.7,wNoise(vWaterWorld.xz*.9+vec2(wt*.2,-wt*.13)));
   outgoingLight+=vec3(.1,.12,.11)*foamLight*crest;
  }
  // TREES IN THE WATER (water-mirror.js; the far-landscape goal, round 1): the
  // bank's trees, turned over about this pond's level and drawn into a
  // half-size picture with the ordinary camera, read at this pixel and nudged
  // by the ripples; lit by the light the water gets, a little darker than the
  // trees themselves, as far as the surface is a mirror here.
  // Round 2: round 1's trees came back pale and washed out -- a reflection
  // of foliage in still water is dark and rich -- so darker (.55 of the lit
  // twin) and stronger wherever the surface mirrors at all. Round 3: four
  // taps 1.5 of the picture's pixels apart, averaged -- the surface softens a
  // reflection, and the twins' facets read as separate patches.
  // Round 10: by the wind (mirrorWind, 0 calm to 1 at 15 mph) -- the ripples
  // nudge it 0.006-0.024 and it softens over 3-9 pixels: a calm pond near
  // a true mirror, a windy one broken up. At the default 4 mph about as before.
  if(mirrorOn>.5){
   vec2 muv=gl_FragCoord.xy/mirrorScreen+normal.xy*(.006+.018*mirrorWind),px=(3.+6.*mirrorWind)/mirrorScreen;
   vec4 mr=(texture2D(mirrorMap,muv+vec2(px.x,0.))+texture2D(mirrorMap,muv-vec2(px.x,0.))+texture2D(mirrorMap,muv+vec2(0.,px.y))+texture2D(mirrorMap,muv-vec2(0.,px.y)))*.25;
   // Round 4: by the mirror term alone (it had a floor of .35, so looking
   // steeply into a pond close by showed crowns as flat patches).
   outgoingLight=mix(outgoingLight,mr.rgb*foamLight*.55,mr.a*clamp(mirror*2.8,0.,.92)*(1.-.6*paw));
  }
 }`,
 sea:`{
  vec2 su=vec2((vWaterWorld.x+seaGrid.x)/(2.*seaGrid.x),(vWaterWorld.z+seaGrid.y)/(2.*seaGrid.y));
  // THE FAR-LANDSCAPE GOAL: no line where the ground map ends. Past it the
  // depth was taken as 50 m at once, so the pale shelf stopped in a straight
  // line across the sea (Island's far views). The map's edge depth carries on
  // and deepens over the next 400 m instead.
  float past=length(max(abs(vWaterWorld.xz)-seaGrid.xy,0.)),inside=1.;
  vec2 suv=(clamp(su,0.,1.)*(seaGrid.zw-1.)+.5)/seaGrid.zw;
  float depth=mix(seaLevel-texture2D(seaHeights,suv).r,50.,smoothstep(0.,400.,past));
  diffuseColor.a*=smoothstep(0.,.35,depth);
  // THE POLISH GOAL'S WATER, round 5: the sea and the big lakes (Lakeshore's
  // is drawn as sea) were one flat colour from the shelf to the horizon. The
  // same depth body as still water, over a sea's depths: a pale sandy shelf
  // over the first metres, darkening to deep blue by eight. The foam below
  // goes on top of it. Past the course's ground map the depth is not known
  // and is taken as deep (50 m): Lakeshore's lake, most of it out there, kept
  // its flat colour while this was gated to the map.
  {
   ${FOAM_LIGHT}
   float deepSea=smoothstep(.4,8.,depth);
   // The shelf's colour and how far toward it (biomes.js seaShelf): a
   // beach's pale sand by default, the Lowcountry's creeks their own dark
   // marsh water (generator 80).
   vec3 shelf=mix(diffuseColor.rgb,seaShelf.rgb,seaShelf.a)*.7,open=diffuseColor.rgb*vec3(.22,.34,.46);
   float lookIn=abs(dot(normalize(vViewPosition),normal)),mirror=.02+.98*pow(1.-lookIn,5.);
   outgoingLight=mix(outgoingLight,mix(shelf,open,deepSea)*foamLight,.7*(1.-clamp(mirror*1.4,0.,.85))*smoothstep(.05,.35,depth));
  }
  // At 30% of the water's clock, as the ponds are: at full speed the surf was
  // frantic (the owner). The swash cycle is 9 s of that clock, 30 s of real time.
  float t=waterTime*.3,ph=wNoise(vWaterWorld.xz*.015)*6.2832+wNoise(vWaterWorld.xz*.004+3.1)*3.;
  // Round 11: a lake's swash its own (seaSwash: the cycle in seconds of this
  // clock, and how far up it runs) -- Lakeshore's freshwater lake 5 s and 0.6,
  // the ocean 9 s and all of it.
  float cyc=fract(t/seaSwash.x+ph/6.2832);
  float run=cyc<.3?smoothstep(0.,1.,cyc/.3):1.-smoothstep(0.,1.,(cyc-.3)/.7);
  // THE FAR-LANDSCAPE GOAL'S WAVES, round 7: waves come in sets. Every swash
  // ran up to the same line, a metronome; now each cycle's own reach, from a
  // hash of its number, between 45% and all of the run-up.
  float cycN=floor(t/seaSwash.x+ph/6.2832),reachK=(.45+.55*fract(sin(cycN*12.9898+3.1)*43758.5453))*seaSwash.y;
  float front=mix(.62,.03,run*reachK);
  float lace=wNoise(vWaterWorld.xz*1.3+vec2(t*.25,-t*.18))*.6+wNoise(vWaterWorld.xz*3.9-vec2(t*.3,t*.1))*.4;
  float lip=smoothstep(front-.05,front,depth)*(1.-smoothstep(front,front+.45,depth));
  float wake=smoothstep(front-.05,front,depth)*(1.-smoothstep(front,front+1.1,depth))*.45;
  // Round 12: the breakers come and go in stretches along the coast (a broad,
  // slowly drifting noise), not one unbroken line of white all the way round.
  float breakers=exp(-pow((depth-1.15)/.22,2.))*.5*smoothstep(.35,.65,wNoise(vWaterWorld.xz*.012+vec2(t*.04,-t*.03)));
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
  // THE FAR-LANDSCAPE GOAL'S WAVES, round 5: the ripples that STAND. Water
  // running over a bar or a stone throws a V of small waves that stay where
  // they are while the water and its foam pass through them -- the surest
  // sign of running water. Chevrons pointing downstream, fixed to the bed (no
  // drift), in patches where the bed is rough, faint along the banks.
  // Round 6: crests 2 m apart (were 1.1 m: thinner than a pixel from the bank).
  // REMOVED (the owner, 30 October 2026: "Remove the creek arrow texture. We
  // don't need them."): the chevrons read as arrows painted on the water. The
  // flecks and lace still drift downstream, so the water still runs.
  // Round 9: the wet line where the water meets the bank, as a pond's (round 4).
  float wetEdge=smoothstep(.93,.985,vShore)*(1.-smoothstep(.985,1.,vShore));
  // Round 15: faint and broken (at .35 and unbroken it ran down both banks as
  // a painted white line, and a creek read as a road).
  foam=max(foam,wetEdge*.14*smoothstep(.3,.7,lace));
  ${FOAM_LIGHT}
  outgoingLight=mix(outgoingLight,vec3(.9,.94,.92)*foamLight,foam);
  diffuseColor.a=max(diffuseColor.a,foam*.8);
  // Round 10: in over the channel's first 3 m and out over its last, not a
  // hard square edge across it (vChanEnd: metres to the end, streams.js).
  diffuseColor.a*=smoothstep(0.,3.,vChan.x)*smoothstep(0.,3.,vChanEnd);
 }`,
 creek:`{
  float t=waterTime,drift=vChan.x-t*length(vFlow),across=vChan.y;
  float fleck=smoothstep(.6,.84,wNoise(vec2(drift*1.1,across*1.7+t*.03))*.6+wNoise(vec2(drift*2.6+t*.04,across*3.3))*.4);
  float bank=smoothstep(.55,.9,vShore)*(1.-smoothstep(.97,1.,vShore));
  float foam=clamp(fleck*(.45+.5*vShore)+bank*.3*fleck,0.,1.)*.85;
  // Round 5: a creek's riffles, as the river's but tighter and brighter (it is
  // shallow and quick): standing chevrons over the rough stretches of its bed.
  // Round 6: crests 1.25 m apart (were 0.6 m, lost from the bank), in more
  // and stronger patches.
  // Round 13: broader crests (they read as white dashes) and an opener V, in
  // more of the bed, stronger.
  // Round 15: softer (.7 read as lane markings down the middle).
  // REMOVED (the owner, 30 October 2026: "Remove the creek arrow texture"):
  // the chevrons read as arrows on the water; the drifting flecks stay.
  // Round 9: the wet line at the bank.
  // Round 15: faint and broken, as a river's.
  foam=max(foam,smoothstep(.93,.985,vShore)*(1.-smoothstep(.985,1.,vShore))*.14*smoothstep(.35,.75,wNoise(vec2(drift*.6,across*2.))));
  ${FOAM_LIGHT}
  outgoingLight=mix(outgoingLight,vec3(.92,.95,.94)*foamLight,foam);
  diffuseColor.a=max(diffuseColor.a,foam*.8);
  // Round 10: faded in and out at the channel's ends, as a river's.
  diffuseColor.a*=smoothstep(0.,3.,vChan.x)*smoothstep(0.,3.,vChanEnd);
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
// And metres to the channel's end (streams.js chanEnd; the waves' round 10).
// Declared here as well as in the vertex patch: missing on this side, every
// river and creek failed to compile for one build (caught by the captures).
varying float vChanEnd;
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
// How many poles may be live lights at once: floodlights.js lampBudget, from
// what this graphics card's shaders can hold (at most 96; 8 November 2026). It
// was 192, above every course, until built courses of 121 lamps and more lost
// their lit ground at night.
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
// A sun moved further than this since a far map was drawn redraws it now
// (scheduleCascades); a quarter of a degree is a minute of the clock.
const CASCADE_SUN_TURN=Math.cos(.25*Math.PI/180);
const cloudFrustum=new T.Frustum(),cloudScratch=new T.Matrix4();
const snapScratch={m:new T.Matrix4(),i:new T.Matrix4(),o:new T.Vector3(),up:new T.Vector3(0,1,0),p:new T.Vector3()};
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

// EVERY TRACER LINE IS ONE PROGRAM (Phase 5). The live line, its comet head,
// its bright core and the end-of-hole lines all carry per-vertex colour and the
// dash switch, whatever style is worn: a style is then only uniforms and
// buffers, and putting a new one on never builds a shader mid-round (a program
// built on first draw is a frozen frame -- B7 in TODO). Solid is a dash longer
// than any shot.
const NO_DASH=[1e6,0];
// Vertex colours are read as LINEAR light; the style's colours are written as
// sRGB hex, the way a material's `color.set` takes them. Unconverted, every
// tracer drew washed out -- a sunset as pale pink, the seat gold as cream.
const linear=c=>c.map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
const tracerMaterial=(width,opacity)=>new LineMaterial({color:'#ffffff',vertexColors:true,dashed:true,dashSize:NO_DASH[0],gapSize:NO_DASH[1],linewidth:width,transparent:true,opacity,depthWrite:false});
// Fill a Line2 from world points [[x,y,z]...] and a colour per point.
function writeStyled(line,world,colours,dash){
 line.geometry.dispose();
 const g=new LineGeometry();g.setPositions(world.flat());g.setColors(colours);
 line.geometry=g;line.computeLineDistances();
 line.material.dashSize=(dash||NO_DASH)[0];line.material.gapSize=(dash||NO_DASH)[1];
 line.visible=true;
}
// THE LIGHTNING STYLE'S ZIGZAG: the path resampled into strokes a few metres
// long, each corner pushed sideways and up by up to `amp` metres, the same way
// for the same `seed` (the live line changes seed many times a second, which
// is the flicker; the summary keeps one). Longer shots zig wider so it reads
// from behind the tee.
function jagged(world,amp,seed){
 if(world.length<3)return world;
 let total=0;for(let i=1;i<world.length;i++)total+=Math.hypot(world[i][0]-world[i-1][0],world[i][1]-world[i-1][1],world[i][2]-world[i-1][2]);
 const step=Math.max(2,total/60),a=amp*Math.max(1,total/120),out=[world[0]];
 let run=0,k=0;
 const h=(i,j)=>{const x=Math.sin(i*127.1+j*311.7+seed*74.7)*43758.5453;return (x-Math.floor(x))*2-1;};
 for(let i=1;i<world.length-1;i++){
  const p=world[i],q=world[i-1];run+=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
  if(run<step)continue;run=0;k++;
  const n=world[i+1],dx=n[0]-q[0],dz=n[2]-q[2],l=Math.hypot(dx,dz)||1;
  out.push([p[0]-dz/l*a*h(k,1),p[1]+a*.6*h(k,2),p[2]+dx/l*a*h(k,1)]);
 }
 out.push(world[world.length-1]);
 return out;
}
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

// A FLAG PRINTED ON BOTH SIDES (the cartoon overhaul's flag, round 3). One
// double-sided plane shows its number mirrored from behind; this is two
// one-sided faces back to back, the back one's picture flipped, in a single
// geometry so the frame loop's ripple (which sets z from x) moves both alike.
function twoSidedCloth(){
 const front=new T.PlaneGeometry(.48,.33,12,4),n=front.attributes.position.count;
 const pos=front.attributes.position.array,uv=front.attributes.uv.array,idx=front.index.array;
 const P=new Float32Array(n*6),N=new Float32Array(n*6),U=new Float32Array(n*4),I=new Uint16Array(idx.length*2);
 P.set(pos);P.set(pos,n*3);U.set(uv);
 for(let i=0;i<n;i++){N[i*3+2]=1;N[(n+i)*3+2]=-1;U[(n+i)*2]=1-uv[i*2];U[(n+i)*2+1]=uv[i*2+1];}
 I.set(idx);for(let t=0;t<idx.length;t+=3){I[idx.length+t]=idx[t]+n;I[idx.length+t+1]=idx[t+2]+n;I[idx.length+t+2]=idx[t+1]+n;}
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('normal',new T.BufferAttribute(N,3));g.setAttribute('uv',new T.BufferAttribute(U,2));g.setIndex(new T.BufferAttribute(I,1));
 front.dispose();return g;
}

export class GolfView{
 constructor(canvas,quality='medium'){
  this.canvas=canvas;this.watchCanvasSize();this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.quality=tierOf(quality);this.renderer.shadowMap.enabled=true;this.applyQuality(quality);this.renderer.toneMapping=T.CustomToneMapping;this.renderer.toneMappingExposure=1.05;
  // The clock is session state, not course state. `hour` is null until a course
  // is built, where the biome's own default supplies the opening light.
  this.daylight={...loadDaylight(),elapsedSinceSave:0};this.solar=null;this.envElevation=null;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(53,1,.15,20000);this.look=new T.Vector3();this.targetPos=new T.Vector3();this.targetLook=new T.Vector3();this.config={...loadCamera()};this.freeYaw=0;this.freePitch=-.32;this.orbit={yaw:0,pitch:0,zoom:1};this.orbitAt=null;this.raycaster=new T.Raycaster();this.targets=[];this.elapsed=0;this.foliageTime={value:0};this.breeze={value:1};this.sway={value:1};
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
  for(const light of this.csm.lights){light.color.copy(color);light.shadow.normalBias=this.quality.shadowBias.normal;light.shadow.radius=this.shadowRadius(this.quality.shadow.radius);}this.applyNearShadow();
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
   // A map not redrawn this frame keeps the box it was drawn with
   // (scheduleCascades): its matrices are what its pixels mean.
   if(light.shadow.autoUpdate===false)return;
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
 // THE CLOUD SHADOWS THIS FRAME CAN SHOW (cloud-shadows.js packCloudShadows).
 // Receivers stand between the lowest and highest ground -- the course and the
 // distant landscape -- and the tallest tree above it (redwoods reach 186 m;
 // 250 m covers them, the ball and the floodlight poles), measured once a course.
 packClouds(){
  if(!this.receiverSpan){
   let low=Infinity,high=-Infinity;
   for(const m of [this.terrain,this.landscape]){const g=m?.geometry;if(!g)continue;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox.clone().applyMatrix4(m.matrixWorld);low=Math.min(low,b.min.y);high=Math.max(high,b.max.y);}
   this.receiverSpan=isFinite(low)?{low:low-10,high:high+250}:{low:-1e4,high:1e4};
  }
  const cam=this.camera;cam.updateMatrixWorld();
  cloudFrustum.setFromProjectionMatrix(cloudScratch.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
  packCloudShadows(this.cloudUniforms,this.clouds.discs,this.clouds.fades,this.cloudUniforms.cloudSun.value,cloudFrustum,this.receiverSpan.low,this.receiverSpan.high);
 }
 // THE NEAREST CASCADE'S OWN SIZE (graphics.js `nearShadow`, Ultra): CSM gives
 // every cascade one size, so the nearest map is reallocated at its own.
 applyNearShadow(){
  const near=this.quality.nearShadow,light=this.csm?.lights[0];if(!near||!light)return;
  light.shadow.radius=this.shadowRadius(near.radius);
  if(light.shadow.mapSize.x!==near.size){light.shadow.mapSize.set(near.size,near.size);light.shadow.map?.dispose();light.shadow.map=null;this.cascadeForce=true;}
 }
 // ...AND ITS OWN TEXEL GRID. CSM snaps each cascade's centre to whole texels
 // of ITS one size, which is what stops shadows crawling as the camera moves;
 // a map of another size snapped to that grid moves by part-texels and its
 // edges shimmer. So the nearest map's centre is snapped again, in the light's
 // frame, to its own texels: it still only ever moves a whole texel at a time.
 snapNearCascade(){
  const near=this.quality.nearShadow,csm=this.csm,light=csm?.lights[0];if(!near||!light||near.size===csm.shadowMapSize)return;
  const sc=light.shadow.camera,tw=(sc.right-sc.left)/near.size,th=(sc.top-sc.bottom)/near.size;
  const m=snapScratch.m.lookAt(snapScratch.o,csm.lightDirection,snapScratch.up),inv=snapScratch.i.copy(m).invert();
  const p=snapScratch.p.copy(light.position).applyMatrix4(inv);
  p.x=Math.floor(p.x/tw)*tw;p.y=Math.floor(p.y/th)*th;p.applyMatrix4(m);
  light.position.copy(p);light.target.position.copy(p).add(csm.lightDirection);
 }
 // THE FAR SHADOW MAPS ARE REDRAWN LESS OFTEN (the frame-rate goal, 22
 // October 2026). Every cascade used to be redrawn every frame, the far two at
 // 6144 on Ultra holding most of the course's trees, for shadows that 100 m and
 // more away cannot change between two frames that anyone could see. Now the
 // nearest map -- the player's own surroundings, swaying trees and the ball --
 // is drawn every frame, and the middle one (100-500 m) and the far one (past
 // 500 m) every fourth frame each, on different frames: at most two maps a
 // frame, neither more than three frames old (50 ms at 60 fps), for shadows
 // where a tree's sway moves them less than a pixel. Measured, every fourth
 // instead of every other gave back 2-7% of an Ultra frame for the far map and
 // about as much again for the middle one (RESEARCH.md, *Frame time on Ultra*).
 //
 // A MAP NOT REDRAWN KEEPS ITS OWN MATRICES. Its pixels mean what they meant
 // from where it was drawn, so its shadow camera is not moved (fitCascadeDepth
 // and the cull skip it) and the ground reads it through the matrix it was
 // drawn with: an old map lags, it never slides.
 //
 // AND IT IS REDRAWN AT ONCE WHEN IT NO LONGER COVERS ITS SLICE of the view --
 // a camera cut, a fast turn, a flight -- tested exactly: the slice's eight
 // corners, from this frame's camera, must sit inside the box the map was drawn
 // in. So a waiting map never leaves ground unshadowed. A sun moved more than a
 // quarter of a degree (the clock dragged) or a re-split cascade
 // (`cascadeForce`) redraws everything. `cascadeStagger = false` turns it off,
 // for measuring.
 scheduleCascades(){
  const csm=this.csm,cam=this.camera,v=fitScratch,dir=csm.lightDirection,n=csm.lights.length;
  const f=this.cascadeFrame=(this.cascadeFrame??0)+1,force=this.cascadeForce||this.cascadeStagger===false;
  this.cascadeForce=false;
  csm.lights.forEach((light,i)=>{
   const s=light.shadow,sc=s.camera,last=light.userData.cascadeDir;
   let draw=force||i===0||n<3||!s.map||!last||last.dot(dir)<CASCADE_SUN_TURN||f%4===(i===n-1?1:3);
   if(!draw){
    const fr=csm.frustums[i];
    outer:for(const set of [fr.vertices.near,fr.vertices.far])for(const corner of set){
     v.copy(corner).applyMatrix4(cam.matrixWorld).applyMatrix4(sc.matrixWorldInverse);
     if(v.x<sc.left||v.x>sc.right||v.y<sc.bottom||v.y>sc.top||-v.z<sc.near||-v.z>sc.far-100){draw=true;break outer;}
    }
   }
   s.autoUpdate=draw;s.needsUpdate=false;
   if(draw)(light.userData.cascadeDir??=new T.Vector3()).copy(dir);
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
 // THE CARTOON COURSE FURNITURE (tools/blender/cartoon_course.py): a painted
 // model at its real height in metres (the ingest makes every model one unit
 // tall), each role in its colour. Null where the build has none, so the
 // plain shapes stay as the fallback.
 // BATCHED FURNITURE (the goal's frame time on Low, measured on Autumn): the
 // tee markers, signs, benches and ball washers were a group of meshes each,
 // every part drawn again for its ink and in the shadow pass -- some 200 draws
 // on a nine. With `batch`, furniture() hands back an empty placeholder for
 // the caller to place as before, and flushFurniture() draws every placed
 // piece as one InstancedMesh per model, colours and part (and one for its
 // ink). The same pieces, in the same places and colours: only how they are
 // drawn changes, Classic's as well as Architect's. A placeholder that takes
 // a child (the sign's card) stays in the scene to carry it.
 furniture(name,height,colours,{batch=false}={}){
  const parts=this.style==='cartoon'&&modelParts(name);if(!parts)return null;
  if(batch){const o=new T.Object3D();o.scale.setScalar(height);(this.pendingFurniture=this.pendingFurniture||[]).push({name,height,colours,obj:o});return o;}
  const g=new T.Group();
  for(const p of parts){const m=new T.Mesh(p.geometry,this.surfaceMaterial(colours[p.role]??'#ffffff',{vertexColors:p.painted}));m.castShadow=m.receiveShadow=true;g.add(m);
   // INKED OUTLINES (the cartoon overhaul's edges, round 2): the model again,
   // inside out, pushed out along its normals and drawn dark, so only its rim
   // shows past the model -- the inverted hull. Furniture only: a handful of
   // pieces a hole, where it costs nothing (round 3: 1.2 cm read as a second
   // hand beside the uninked trees; 0.8 cm is definition, not a new style).
   const ink=new T.Mesh(p.geometry,this.inkMaterial(height));ink.castShadow=false;ink.receiveShadow=false;g.add(ink);}
  g.scale.setScalar(height);return g;
 }
 flushFurniture(){
  const list=this.pendingFurniture||[];this.pendingFurniture=[];if(!list.length)return;
  const buckets=new Map();
  for(const it of list){it.obj.updateMatrix();const key=it.name+'|'+JSON.stringify(it.colours);if(!buckets.has(key))buckets.set(key,{name:it.name,height:it.height,colours:it.colours,matrices:[]});buckets.get(key).matrices.push(it.obj.matrix.clone());}
  for(const b of buckets.values()){
   for(const p of modelParts(b.name)||[]){
    const m=new T.InstancedMesh(p.geometry,this.surfaceMaterial(b.colours[p.role]??'#ffffff',{vertexColors:p.painted}),b.matrices.length);
    const ink=new T.InstancedMesh(p.geometry,this.inkMaterial(b.height),b.matrices.length);
    b.matrices.forEach((x,i)=>{m.setMatrixAt(i,x);ink.setMatrixAt(i,x);});
    m.castShadow=m.receiveShadow=true;ink.castShadow=ink.receiveShadow=false;
    for(const x of [m,ink]){x.instanceMatrix.needsUpdate=true;x.computeBoundingSphere();this.group.add(x);}
   }
  }
  for(const it of list)if(!it.obj.children.length)it.obj.parent?.remove(it.obj);
 }
 inkMaterial(height){
  this.inks=this.inks||new Map();
  const w=(.008/height).toFixed(5);
  if(!this.inks.has(w)){
   const m=new T.MeshBasicMaterial({color:'#2b2622',side:T.BackSide});
   m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normalize(normal)*'+w+';');};
   m.customProgramCacheKey=()=>'fairway-ink-'+w;
   this.inks.set(w,m);
  }
  return this.inks.get(w);
 }
 surfaceMaterial(color,opts={}){
  const {roughness,flatShading,...toonOpts}=opts;
  if(this.style!=='cartoon')return new T.MeshStandardMaterial({color,roughness:roughness??1,...opts});
  this.propRamp=this.propRamp||toonRamp(this);
  return new T.MeshToonMaterial({color,gradientMap:this.propRamp,...toonOpts});
 }
 static isLit(m){return !!m&&!!(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.isMeshToonMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial);}
 // CRISP SHADOWS (the cartoon overhaul's shadows, round 2). The tiers soften a
 // shadow's edge by spreading the PCF disk (graphics.js `shadow.radius`, 3.5
 // on High, 4 on Ultra): in the cartoon style that read as a photograph's
 // blur under drawn trees. Four tenths of it, never under three's own 1, so
 // Low and Medium are as they were. The disk's sample count is fixed: no cost.
 shadowRadius(r){return this.style==='blueprint'?r:Math.max(1,r*.4);}
 applyShadowSpan(){
  if(!this.sun||this.csm)return;
  const span=this.quality.shadowSpan,bias=this.quality.shadowBias;
  Object.assign(this.sun.shadow.camera,{left:-span.half,right:span.half,top:span.top,bottom:span.bottom,near:1,far:span.far});
  this.sun.shadow.camera.updateProjectionMatrix();
  this.sun.shadow.normalBias=bias.normal;this.sun.shadow.bias=bias.constant;this.sun.shadow.radius=this.shadowRadius(this.quality.shadow.radius);
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
   this.sun.shadow.radius=this.shadowRadius(this.quality.shadow.radius);
   // A shadow map already allocated at the old size has to go before three will
   // build one at the new size.
   this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
   this.sun.shadow.needsUpdate=true;
  }
  if(this.scene?.fog){const f=this.quality.fog;this.scene.fog.near=f.near;this.scene.fog.far=f.far;}
  for(const light of this.csm?.lights||[]){light.shadow.radius=this.shadowRadius(this.quality.shadow.radius);light.shadow.normalBias=this.quality.shadowBias.normal;}this.applyNearShadow();
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
 // THE CANVAS'S SIZE ON THE PAGE, READ ONCE PER CHANGE (the frame-rate goal,
 // 22 October 2026). The flagsticks, the pin's label and the shot card asked
 // for it every frame, and asking the page for a size after the interface has
 // changed makes the browser work its styles out there and then: about 1.4 ms
 // of every Ultra frame on this machine. A ResizeObserver forgets the stored
 // size whenever the canvas changes size, so the next read is the page's own
 // number, exactly as before.
 watchCanvasSize(){this.canvasCss=null;try{new ResizeObserver(()=>{this.canvasCss=null;}).observe(this.canvas);this.sizeWatched=true;}catch{}}
 cssSize(){if(this.canvasCss)return this.canvasCss;const c={w:this.canvas.clientWidth,h:this.canvas.clientHeight};if(this.sizeWatched)this.canvasCss=c;return c;}
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
 applyLensShift(){if(!this.camera)return;this.camera.filmOffset=(this.lensShift||0)*this.camera.getFilmWidth();
  // ON A PHONE THE PICTURE IS LIFTED (phone-view.js) so the ball stands above
  // the swing meter: the image slides up, the camera does not turn. main.js
  // sets liftForPhone in play; a bay's own screen shape (screenAspect) is never lifted.
  const c=this.canvas,w=c?.clientWidth||0,h=c?.clientHeight||0,lift=this.liftForPhone&&!this.screenAspect&&liftsView(this.config?.mode)?phoneLift(w,h):0;
  this.liftMode=this.config?.mode;
  if(lift)this.camera.setViewOffset(w,h,0,lift,w,h);else if(this.camera.view?.enabled)this.camera.clearViewOffset();}
 disposeCourse(){this.pendingFurniture=[];if(!this.group)return;this.mirror?.dispose();this.mirror=null;if(this.mirrorUniforms){this.mirrorUniforms.mirrorMap.value=null;this.mirrorUniforms.mirrorOn.value=0;}const geometries=new Set(),materials=new Set(),textures=new Set();this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.shadow?.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{}))if(u?.value?.isTexture)textures.add(u.value);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const r of this.resources)r.dispose();this.resources=[];this.csm?.dispose();this.csm=null;this.cloudUniforms=null;this.clouds?.dispose();this.clouds=null;this.mistUniforms=null;this.godRays?.dispose();this.godRays=null;this.bloom?.dispose();this.bloom=null;this.sky=null;this.skyMaterial=null;this.propRamp=null;this.envScene=null;this.environment?.dispose();this.environment=null;this.scene.environment=null;this.cull=null;this.groundLod=null;this.scene.remove(this.group);}
 build(world,style='cartoon',holeIndex=0){
  style='cartoon';
  this.disposeCourse();this.updateGrass=null;this.life=null;this.pathTextures=null;this.waterTime=null;this.seaDepth=null;this.probeDue=null;this.floodWarming=null;this.world=world;this.style=style;this.course=world.holes[holeIndex];this.group=new T.Group();this.scene.add(this.group);this.targets=[];this.puttingRings=null;this.greenGrid=null;this.reading=null;this.readingHeading=null;this.gridBeads=[];this.flags=[];this.inks=null;this.flagsticks=[];this.greenProps=[];this.rangeProps=null;this.makeHazardAtlas();this.waterBodies=[];
  // Shared materials belonging to systems that build their meshes later. A
  // scene-graph traverse cannot find those: the near-field grass owns one
  // material for every tile but has no tiles until the camera moves, so at
  // registration time its group is empty and its material is invisible to a
  // walk of the scene.
  this.lazyMaterials=[];
  // One hidden mesh per such material, shown only while shaders are built
  // (withStandIns), so the warm-up compiles what the camera will meet later.
  this.standIns=[];
  // THE ROUND'S SEASON (the US landscapes goal, step 9; seasons.js): today's
  // or the one the round was started in (main.js writes it into the round's
  // settings), a tropical landscape always summer. Its palette is laid over a
  // copy of the landscape's record -- the turf, snow, the far woods -- and the
  // summer record kept, so a rebuild never lays it twice. Looks only.
  this.season=roundSeason(world.settings.season??'today',{tropical:!!LANDSCAPES[currentKey(world.settings.biome)]?.tropical});
  world.summerBio??=world.bio;
  // Snow on the trees' tops where the winter is snow (vegetation.js snowTopped).
  this.snowTops=this.season==='winter'&&WINTER[regionOf(world.settings.biome)]==='snow';
  world.bio={...world.summerBio,...seasonPalette(world.summerBio,this.season,regionOf(world.settings.biome))};
  const bio=world.bio,blue=style==='blueprint',toon=style==='cartoon',flat=style==='lowpoly',add=o=>{this.group.add(o);return o;};
  this.scene.background=new T.Color(blue?'#152e46':bio.sky);this.scene.fog=new T.Fog(blue?'#263e57':bio.sky,this.quality.fog.near,this.quality.fog.far);
  this.renderer.toneMappingExposure=blue?1:toon?bio.light?.exposure??1:.94;
  // THE BOUNCE IS THE GROUND'S OWN COLOUR (the cartoon overhaul's lighting,
  // round 1): light thrown up from sand is warm, from a violet moor violet.
  // One olive for every landscape lit a desert crown's underside as if it
  // stood on a lawn.
  this.hemi=add(new T.HemisphereLight(blue?'#a4dcea':'#cce5ff',blue?'#2d4054':toon?new T.Color('#777855').lerp(new T.Color(bio.light?.bounce??bio.rough),.5):'#777855',HEMI));
  // The clock only ever tints these; they stay the base it returns to.
  this.hemiSkyBase=this.hemi.color.clone();this.hemiGroundBase=this.hemi.groundColor.clone();
  this.skyBgBase=this.scene.background.clone();this.fogBase=this.scene.fog.color.clone();
  this.hemiBaseIntensity=HEMI;
  // Blueprint is a diagram, not a place: it keeps its flat even light and
  // ignores the clock entirely.
  this.timed=!blue;this.baseExposure=blue?1:toon?bio.light?.exposure??1:.94;
  // Each biome opens at the hour that reproduces the light it always had, so
  // an existing course looks unchanged until the slider moves.
  if(this.daylight.hour===null)this.daylight.hour=this.daylight.syncToLocal?localHour():defaultHour(bio.sun);
  const solar=solarState(this.daylight.hour,bio.sun);this.solar=solar;
  const sunDir=this.timed?solar.direction.clone():new T.Vector3(-.6,Math.sin(bio.sun*Math.PI/180),-.5).normalize();
  this.sun=add(new T.DirectionalLight(blue?'#c4e5ff':bio.sunColor,blue?1.5:SUN));
  this.sunBase=this.sun.color.clone();this.sunBaseIntensity=blue?1.5:SUN;this.sun.castShadow=!blue;this.sun.shadow.mapSize.set(this.quality.shadow.size,this.quality.shadow.size);
  // Cascaded shadows: one frustum that follows the camera can only cover the
  // ground around it, so anything further away is lit as though nothing stands
  // between it and the sun. Cascades give each distance band its own map.
  if(this.quality.cascades&&!blue)this.makeCascades(sunDir,this.sun.color,this.sun.intensity);this.applyShadowSpan();add(this.sun.target);this.sunDir=sunDir;
  this.addSky(sunDir);
  this.addLandscape();
  const palette=blue?{rough:'#193c50',semi:'#285d6a',fairway:'#397e85',fringe:'#5caba6',green:'#9ad2bc',sand:'#bdc2a0'}:toon?{rough:new T.Color(bio.rough).lerp(new T.Color(bio.roughTint??'#b6bc65'),.23),semi:new T.Color(bio.semi).multiplyScalar(1.13),fairway:new T.Color(bio.fairway).offsetHSL(.015,.1,.04),fringe:new T.Color(bio.fringe).offsetHSL(0,.1,.07),green:new T.Color(bio.green).offsetHSL(.01,.05,.08),sand:'#ffebbd'}:{rough:bio.rough,semi:bio.semi,fairway:bio.fairway,fringe:bio.fringe,green:bio.green,sand:bio.sand};
  const terrain=groundGeometry(world.groundGrid);stitchSeam(terrain,this.landscape.geometry);this.terrain=add(new T.Mesh(terrain,groundMaterial(this,palette)));this.landscape.material.dispose();this.landscape.material=this.terrain.material;this.landscape.receiveShadow=true;this.terrain.name='Continuous ground';this.terrain.receiveShadow=true;
  // THE GROUND IS DRAWN AFTER EVERYTHING ELSE SOLID (the frame-rate goal, 22
  // October 2026). three sorts solid things by material before distance, and
  // the ground's material is made first, so the ground -- the hungriest shader
  // in the game -- was shaded across the whole screen and then painted over by
  // every trunk and crown in front of it. Drawn last, the depth test skips it
  // wherever something already stands: 1-4% of an Ultra frame in a forest,
  // and the same picture, because solid things are depth-tested either way.
  this.terrain.renderOrder=1;this.landscape.renderOrder=1;
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
  // THE GROUND DRAWN COARSER WITH DISTANCE (ground-lod.js; the frame-rate goal,
  // 9 November 2026). The mesh above is kept, undrawn, for its material, its
  // shadow switch and its box; what is drawn is the quadtree's squares, each
  // its own mesh over the same vertices, chosen every frame (updateGroundLod).
  if((terrain.index?terrain.index.count:terrain.attributes.position.count)/3>=GROUND_LOD.minTriangles)this.buildGroundLodMeshes(world.groundGrid,terrain);
  for(const h of world.holes){for(const p of h.ponds){const points=[];for(let j=0;j<512;j++){const q=ovalRadius(p,j/512*TAU),w=h.toWorld({x:p.x+q.x,z:p.z+q.z});points.push(new T.Vector2(w.x,-w.z));}this.addWaterBody(new T.ShapeGeometry(new T.Shape(points)),p.level,p.depth,h.toWorld(p));this.addShoreFoam(points,p.level,!!p.large);}this.addHoleDetails(h);}
  // A BUILT course's ponds and lakes (built-world.js): any outline, holes for
  // its islands, at its stored level -- the same water body a pond is.
  for(const b of world.builtWater||[]){const [outer,...islands]=b.rings,points=outer.map(([x,z])=>new T.Vector2(x,-z)),shape=new T.Shape(points);for(const ring of islands)shape.holes.push(new T.Path(ring.map(([x,z])=>new T.Vector2(x,-z))));let cx=0,cz=0;for(const [x,z] of outer){cx+=x;cz+=z;}this.addWaterBody(new T.ShapeGeometry(shape),b.level,2,{x:cx/outer.length,z:cz/outer.length});this.addShoreFoam(points,b.level,b.kind==='lake');}
  this.flushFurniture();
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
   // The trees-in-still-water picture (water-mirror.js), shared by every pond;
   // filled once the planting exists, below.
   this.mirrorUniforms??={mirrorMap:{value:null},mirrorScreen:{value:new T.Vector2(1,1)},mirrorOn:{value:0},mirrorWind:{value:0}};
   for(const b of this.waterBodies)this.dressWater(b.mesh.material,b);
   // THE PROBE IS TAKEN HERE, not in `refreshEnvironment`. The sky is built
   // before the water is, so the refresh that runs from `addSky` finds no bodies
   // to probe for and returns -- and the next one is an elevation threshold
   // away, which on a still afternoon never comes.
   // TAKEN IN `ready`, NOT HERE, once the shaders are built: a probe renders
   // the scene, and rendering it now made the graphics card finish every
   // program on the spot -- a 0.8 s freeze of the page in the middle of the
   // build. Taken there, it sees the planting and homes built after this
   // point too (it used to hide them; see `takeDueProbes`).
   this.probeDue=this.group.children.length;
   this.setReflections(this.waterReflectsCourse!==false);}
  addVegetation(this);addHomes(this);this.addPaths(this.world);this.addMarkings(this.world);this.addWaterworks(this.world);this.addStory(this.world);this.life=this.addLife(this.world);this.addBuildings(this.world);this.addSeaStacks(this.world);this.addBackdrop(this.world);this.addWear(this.world);
  // TREES IN STILL WATER (water-mirror.js; the far-landscape goal): on the
  // tiers that draw it (graphics.js `mirrorTwins`), Cartoon only.
  if(this.waterBodies.length&&this.quality.mirrorTwins&&this.style==='cartoon'){
   const bio=this.world.bio;
   this.mirror=makeWaterMirror(this,{farWoodGeometry,colors:(bio.farForest?.colors??[bio.tree??'#3c6b33']).map(c=>new T.Color(c))});
   if(this.mirror){this.mirrorUniforms.mirrorMap.value=this.mirror.target.texture;this.mirrorUniforms.mirrorOn.value=1;this.mirrorUniforms.mirrorWind.value=Math.min(1,(this.world.settings.wind||0)/15);}
  }
  this.addFloodlights();
  // Every mesh instanced across the course -- trees, deadfall, rocks, ground
  // cover, homes, floodlights -- now draws only what is in view (instance-cull.js).
  // Taken here, after the last of them is built; the near-field grass tiles come
  // later, move with the camera, and opt out.
  // The floodlit programs are built behind the loading screen, in `ready`.
  this.nightWarmDue=true;
  this.cull=cullInstances(this.group,{thinShadowsFrom:this.quality.thinShadowsFrom??Infinity,farTrees:this.quality.farTrees??0,farPainted:Math.max(this.quality.farPainted??0,biomeOf(this.world?.settings?.biome)?.farPaintedFrom??0),thinTrees:!!this.quality.thinTrees});
  // The saved preference applies to every course built after it, not only to
  // the one that was on screen when the box was ticked.
  this.setFloodlights(this.daylight?.floodlights);
  if(blue){const grids=new T.GridHelper(Math.max(world.halfX,world.halfZ)*2,50,'#93bdb8','#335e71');grids.position.y=4;add(grids);}
  // THE BALL WEARS ITS GOLFER'S FINISH (Phase 5, ball-finishes.js): always a
  // texture, Classic white included, so changing finish rewrites the texels
  // and never builds a new program. Rebuilt with the course, so the finish
  // worn is put back on (setBallFinish).
  this.ballTexture=new T.DataTexture(finishTexels('classic'),256,128);
  this.ballTexture.colorSpace=T.SRGBColorSpace;this.ballTexture.wrapS=T.RepeatWrapping;
  this.ballTexture.magFilter=T.LinearFilter;this.ballTexture.minFilter=T.LinearMipmapLinearFilter;this.ballTexture.generateMipmaps=true;
  this.ballTexture.needsUpdate=true;this.resources.push(this.ballTexture);
  this.ball=add(new T.Mesh(new T.SphereGeometry(R,24,16),this.surfaceMaterial('#ffffff',{roughness:.35,emissive:GLOW_BALL,emissiveIntensity:0,map:this.ballTexture})));
  const finish=this.ballFinish||'classic';this.ballFinish=null;this.setBallFinish(finish);
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
  //
  // NOT A CHILD OF THE BALL. Three counts only VISIBLE lights, and the ball is
  // hidden often: the menu's showcase hole, the end-of-hole flyover, a team
  // choosing its ball. As a child the light went with it, so every lit program
  // was built for "no point light" behind the menu, and pressing Endless (or
  // the flyover ending) rebuilt all of them on screen -- 1.8 s frozen on a
  // first visit, measured 15 October 2026. It stays in the scene, follows the
  // ball in `render`, and goes dark while the ball is hidden.
  this.ballLight=add(new T.PointLight(GLOW_BALL,0,18,2));this.ballLightPower=0;
  // A sprite halo so the glow is not ultra-only. On ultra the bloom pass adds a
  // real flare over the top of it; below that, this is the whole effect.
  const halo=haloTexture();this.resources.push(halo);
  this.ballHalo=new T.Sprite(new T.SpriteMaterial({map:halo,color:GLOW_BALL,blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));
  this.ballHalo.scale.setScalar(R*9);this.ballHalo.visible=false;this.ball.add(this.ballHalo);
  this.ballRing=add(new T.Mesh(new T.RingGeometry(.45,.51,64),new T.MeshBasicMaterial({color:'#fff8d9',side:T.DoubleSide})));this.ringBase=this.ballRing.material.color.clone();this.ballRing.rotation.x=-Math.PI/2;
  this.aimLine=add(new Line2(new LineGeometry(),new LineMaterial({color:'#fff5d2',linewidth:3.5,transparent:true,opacity:.82,depthWrite:false})));
  this.effects=createShotEffects(this);add(this.effects.group);
  // The live tracer, its comet head and its bright core (tracer styles,
  // Phase 5; setTracer). White materials: the colour is in the vertices, and
  // the material colour is what the night tints.
  this.trail=add(new Line2(new LineGeometry(),tracerMaterial(4.5,.95)));this.trailBase=new T.Color('#ffffff');
  this.trailHead=add(new Line2(new LineGeometry(),tracerMaterial(10,.95)));this.trailHead.visible=false;
  this.trailCore=add(new Line2(new LineGeometry(),tracerMaterial(2.5,1)));this.trailCore.visible=false;
  // THE GLINTS behind a sparkling tracer: a pool of points, born at the ball
  // and fading over SPARKLE_LIFE. A stand-in (see showStandIns), so its program
  // is built and drawn behind the loading screen: one black point far below the
  // ground until a sparkling shot flies.
  {const n=64,g=new T.BufferGeometry();
   g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
   g.setAttribute('color',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
   g.attributes.position.array[1]=-1e4;g.setDrawRange(0,1);
   const glint=haloTexture();this.resources.push(glint);
   this.sparkles=add(new T.Points(g,new T.PointsMaterial({size:10,sizeAttenuation:false,map:glint,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending})));
   this.sparkles.frustumCulled=false;this.sparkles.visible=false;this.sparkleList=[];this.standIns.push(this.sparkles);}
  // Every tracer of the hole so far, drawn only when the hole is over. One Line2
  // cannot hold several separate strokes -- it would join the end of one shot to
  // the start of the next with a line across the fairway -- so they get a line
  // each, pooled and reused rather than rebuilt per hole.
  this.shotLines=[];this.shotGroup=new T.Group();add(this.shotGroup);
  // The team's balls during a scramble selection. Built empty; `build` runs on
  // every course, so the pool has to be reset with the scene it lives in.
  this.pickBalls=[];this.pickGroup=new T.Group();add(this.pickGroup);
  // Drawn over the ground (UI/UX pass, 21 October 2026): flat on uneven ground the
  // terrain cut it into a broken arc, worst from the aim point view above it.
  this.aimRing=add(new T.Mesh(new T.RingGeometry(2.5,2.7,64),new T.MeshBasicMaterial({color:'#fff4cd',side:T.DoubleSide,depthTest:false,transparent:true,opacity:.95})));this.aimRing.rotation.x=-Math.PI/2;this.aimRing.renderOrder=5;
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
   // Copied each frame, and only the clouds whose shadow can be seen
   // (packCloudShadows, in render); every cloud until the first frame.
   allCloudShadows(this.cloudUniforms,this.clouds.discs,this.clouds.fades);this.receiverSpan=null;
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
 // Every compile runs with every culled mesh visible (instance-cull.js
 // `forCompile`): a hidden mesh is skipped, and was built mid-play when it
 // first came into view (the hole-out flyover).
 asDrawn(fn){
  const run=()=>this.cull?this.cull.forCompile(fn):fn();
  if(!this.bloom)return run();
  const was=this.renderer.getRenderTarget();
  this.bloom.begin(this.renderer);
  try{return run();}
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
   // THE PROBES DRAW INTO A RENDER TARGET, and a program built for the screen
   // is not the one a render target needs (no tone mapping, linear colour).
   // Ultra's bloom target made them the same; on every other tier the first
   // probe retake after a load built twenty-odd programs on the spot, one after
   // another -- 1.3 s frozen the first time the sun moved, Medium, 10 October
   // (RESEARCH, *Wasted drawing*). So they are built here, in parallel, first.
   try{if(this.renderer.compileAsync)await this.asProbe(()=>this.renderer.compileAsync(this.scene,this.camera));}
   catch(e){console.warn('Fairway: probe warm-up skipped',e);}
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
  this.drawEverythingOnce();
  // For the lab: how long each half took. The first is time the page stays
  // live; the second blocks it, so it is the one to keep small.
  this.readyTimes={shaders:Math.round(t1-t0),firstFrame:Math.round(performance.now()-t1)};
  this.readying=false;
  return this.readyTimes;
 }
 // EVERY PROGRAM DRAWN ONCE, BEHIND THE LOADING SCREEN. A program is built by
 // the compile but on Windows only finished at its first real draw, and the
 // first frame draws only what the tee's view and the cull let through: on a
 // course whose ponds (or a planting) are out of view from the first tee,
 // their programs were first drawn in play -- at the hole-out flyover, a
 // frozen frame (the smoke journey ball-light-hole-out, 3 runs in 8 failing on
 // main; a water body, then a tree, named by it). So, once: everything, the
 // frustum cull off and every culled mesh shown, drawn into a single pixel --
 // a vertex pass of the course with no shading cost, at the end of `ready`.
 drawEverythingOnce(){
  if(!this.group)return;
  const r=this.renderer,off=[];
  this.scene.traverse(o=>{if(o.frustumCulled&&(o.isMesh||o.isLine||o.isPoints||o.isSprite)){o.frustumCulled=false;off.push(o);}});
  const scissorOn=r.getScissorTest(),box=r.getScissor(new T.Vector4());
  this.showStandIns(true);
  try{this.asDrawn(()=>{r.setScissorTest(true);r.setScissor(0,0,1,1);r.render(this.scene,this.camera);});}
  catch(e){console.warn('Fairway: drawing everything once skipped',e);}
  finally{r.setScissor(box);r.setScissorTest(scissorOn);for(const o of off)o.frustumCulled=true;this.showStandIns(false);}
 }
 // The probes `build` left for later (see the note where it sets `probeDue`).
 //
 // WITH THE PLANTING IN THEM. They used to hide everything built after the
 // water (planting, homes, the ball), to match what they saw when they were
 // taken mid-build -- so a course loaded with ponds that reflected no trees,
 // until the sun's first 6-degree move retook them with the trees in. The
 // reflections the water was signed off with show trees; now they do from the
 // start, and the planting's probe programs are drawn here, behind the loading
 // screen, rather than on that first retake.
 takeDueProbes(){
  if(this.probeDue==null||!this.group)return;
  this.probeDue=null;
  this.refreshWaterEnvironment();
  this.setReflections(this.waterReflectsCourse!==false);
 }
 // Run `fn` with the probes' render target bound, so a compile builds the
 // programs a probe will draw with (see `ready`).
 asProbe(fn){
  const was=this.renderer.getRenderTarget();
  this.renderer.setRenderTarget(this.probeTarget());
  try{return this.cull?this.cull.forCompile(fn):fn();}
  finally{this.renderer.setRenderTarget(was);}
 }
 // The cube every probe is photographed into, one for the course.
 probeTarget(){
  if(!this.waterCubeTarget){
   // The tier's old planar-reflection size, repurposed: it is the one number
   // in the tier that was ever about reflection resolution.
   const px=Math.max(64,Math.min(256,Math.round((this.quality.reflection||512)/4)));
   this.waterCubeTarget=new T.WebGLCubeRenderTarget(px,{type:T.HalfFloatType});
   this.resources.push(this.waterCubeTarget);
  }
  return this.waterCubeTarget;
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
   if(h.greens)writeRangeGreens(h,(col,v)=>put(h.hole,col,v),{cups:HOLE_ATLAS.cups,greens:HOLE_ATLAS.greens,max:RANGE_GREENS});
   else{const g=h.green??h.pin;put(h.hole,HOLE_ATLAS.cups,[g.x,g.z,h.greenSize,h.greenAspect]);put(h.hole,HOLE_ATLAS.cups+1,[h.pin.x,h.pin.z,0,h.greenTurn||0]);}
   // An Architect hole's collection areas first (marked -1; architect.js), so a
   // bunker over one is painted after it and stays sand.
   // A bunker past the slots (`field`, surface-field.js) is painted from the
   // surface field instead.
   [...(h.collections||[]),...h.bunkers.filter(b=>!b.field),...h.ponds].slice(0,12).forEach((b,j)=>{put(h.hole,HOLE_ATLAS.hazards+j*2,[b.x,b.z,b.rx,b.rz]);put(h.hole,HOLE_ATLAS.hazards+j*2+1,[b.phase,b.collection?-1:h.ponds.includes(b)?h.ponds.indexOf(b)+1:0,b.wave2??0,b.wave3??.07]);});
  }
  // Plain arrays: the ground packs them, with its curves and streams, into one
  // texture (ground.js packTables) -- a sampler each was three too many.
  this.holeAtlas={image:{data:holeData}};
  const bankData=new Float32Array(512*rows*4*4);for(const h of this.world.holes)h.ponds.forEach((p,j)=>{for(let k=0;k<512;k++){const b=hazardProfile(p,p.z+(k/511*2-1)*p.rz);bankData.set([b.x,b.rx,0,0],((h.hole*4+j)*512+k)*4);}});this.bankAtlas={image:{data:bankData}};
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
  // Closed with a copy of the first point (the far-landscape goal's waves):
  // the along-shore coordinate then runs 0 to 1 without wrapping inside a quad.
  let shore=0;for(let i=0;i<n;i++)shore+=Math.hypot(points[(i+1)%n].x-points[i].x,points[(i+1)%n].y-points[i].y);
  // THE WIND'S SHORE (the far-landscape goal's waves, round 8): wavelets build
  // across open water and land on the bank the wind blows onto; the bank it
  // blows off lies in calm. Per point, how squarely the bank faces downwind
  // (0 to 1; the outward normal against the wind's heading), scaled by how
  // hard it blows. Points are (x, -z), so the normal's second part is -z.
  const wa=(this.world?.settings.windDirection||0)*Math.PI/180,wx=Math.sin(wa),wz=Math.cos(wa),wk=Math.min(1,(this.world?.settings.wind||0)/12),lee=[];
  for(let i=0;i<=n;i++){
   const a=points[(i-1+n)%n],b=points[(i+1)%n],p=points[i%n];
   let tx=b.x-a.x,ty=b.y-a.y;const L=Math.hypot(tx,ty)||1;tx/=L;ty/=L;
   const face=(ty*inward)*wx+(tx*inward)*wz,windward=.5+.5*face*wk;lee.push(windward,windward);
   pos.push(p.x,p.y,0,p.x-ty*inward*W,p.y+tx*inward*W,0);uv.push(i/n,0,i/n,1);
   if(i<n){const k=i*2,m=(i+1)*2;idx.push(k,m,k+1,k+1,m,m+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('foamWind',new T.Float32BufferAttribute(lee,1));g.setIndex(idx);g.computeVertexNormals();
  // ONE PASS (`forceSinglePass`). Three draws a transparent double-sided
  // material twice, back faces then front, flipping its side and marking it
  // changed for each -- two draws and two program checks per strip per frame.
  // That exists for closed see-through shapes; a flat strip has nothing behind
  // itself to sort, so once is the same picture.
  // Round 19 of the waves: a quarter of the water's own colour in its foam --
  // one blue-white on every pond stood out on a green-black water (Haunted Hollow's, since removed).
  const foamTint=new T.Color('#dde8e2').lerp(new T.Color(this.world?.bio?.water??'#4f88a3'),.25);
  const mat=new T.MeshToonMaterial({color:foamTint,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,gradientMap:this.propRamp??=toonRamp(this)});
  const time=this.waterTime??=({value:0});
  const pace={value:lake?.42:.3},grain={value:lake?.75:1};
  mat.onBeforeCompile=shader=>{
   shader.uniforms.waterTime=time;shader.uniforms.foamPace=pace;shader.uniforms.foamGrain=grain;shader.uniforms.shoreLength={value:shore};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float foamWind;varying vec2 vFoamUv;varying vec3 vFoamWorld;varying float vFoamWind;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvFoamUv=uv;vFoamWind=foamWind;vFoamWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>'+FOAM_FRAG)
    .replace('#include <opaque_fragment>','diffuseColor.a*=foamAlpha();\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey=()=>'fairway-shore-foam-v7';
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
  // A CLEAN POND (the cartoon overhaul's water, round 3). As a near-mirror the
  // ripples broke the reflected woods and their dark floor into brown smears
  // across every pond, so the water read as muddy. In the cartoon style still
  // water shows more of its own colour and less of the mirror.
  // Round 4: that alone barely helped, nor did a more opaque body (the bed was
  // not it): the smears are the reflection scattered by the ripples. A pond
  // is calm, so its ripples bend the mirror a third as far (`calm`), and the
  // woods come back as broad bands of the far shore instead of grit.
  const calm=kind==='still'&&this.style==='cartoon';
  // The polish goal's water, round 4: with the ripples calmed and the body
  // drawn from depth, a pond seen from its bank was a flat sheet with no
  // trees in it; the mirror back up part of the way (.38 -> .5, 1.3 -> 1.8).
  if(calm){material.metalness=.5;material.envMapIntensity=1.8;}
  // The sea and still water read their depth from the ground grid (WATER_EDGES).
  const sea=kind==='sea'||kind==='still'&&!body?.ocean?this.seaDepthMap():null;
  // This course's sun, by reference: both change through the day.
  const sun={value:this.sunDir},sunColor={value:this.sun.color};
  material.onBeforeCompile=shader=>{
   shader.uniforms.waterTime=time;
   shader.uniforms.waterChop=chop;shader.uniforms.waterSwell=swell;
   shader.uniforms.glintSun=sun;shader.uniforms.glintColor=sunColor;
   if(sea){shader.uniforms.seaHeights={value:sea.texture};shader.uniforms.seaGrid={value:sea.grid};shader.uniforms.seaLevel={value:body.level};const lake=!!biomeOf(this.world.settings.biome).lakeWaves;shader.uniforms.seaSwash={value:new T.Vector2(lake?5:9,lake?.6:1)};const shelf=biomeOf(this.world.settings.biome).seaShelf||[.55,.72,.6,.4];shader.uniforms.seaShelf={value:new T.Vector4(...shelf)};}
   if(kind==='still'&&this.mirrorUniforms)Object.assign(shader.uniforms,this.mirrorUniforms);
   if(kind==='still'){shader.uniforms.waterWind=this.windVec;shader.uniforms.pawK={value:.35+.65*Math.min(1,(this.world.settings.wind||0)/12)};
    // The paws travel at the wind's own speed, as gusts do: metres per
    // water-clock second, the clock running WATER_SPEED times real time.
    // (Until 28 October 2026 they moved 16 m a clock second -- 160 m/s in
    // any wind -- and flashed across a pond in under half a second.)
    shader.uniforms.pawDrift={value:Math.max(1,(this.world.settings.wind||0)*.447)/(this.waterSpeed||WATER_SPEED)};}
   shader.vertexShader=shader.vertexShader.replace(...SHORE_VERT).replace(...SHORE_VERT2)
    .replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;attribute vec2 flow;attribute vec2 chan;attribute float chanEnd;varying vec2 vFlow;varying vec2 vChan;varying float vChanEnd;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;vFlow=flow;vChan=chan;vChanEnd=chanEnd;');
   shader.fragmentShader=shader.fragmentShader
    .replace(...SHORE_FRAG)
    .replace('#include <common>','#include <common>'+WATER_NOISE+(sea?'uniform sampler2D seaHeights;uniform vec4 seaGrid;uniform float seaLevel;uniform vec2 seaSwash;uniform vec4 seaShelf;':'')+(kind==='still'?'uniform sampler2D mirrorMap;uniform vec2 mirrorScreen;uniform float mirrorOn,mirrorWind;uniform vec2 waterWind;uniform float pawK,pawDrift;':''))
    .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>'+`
     // CAT'S PAWS (the far-landscape goal's waves, round 18): gusts ruffle
     // patches of a pond that drift downwind; in them the ripples bite and the
     // reflection breaks, between them the water lies glassy. Still water only;
     // stronger with the wind (pawK, 0.35 calm to 1 at 12 mph). PLACED.
     float paw=0.;
     ${kind==='still'?'paw=smoothstep(.55,.85,wNoise((vWaterWorld.xz-waterWind*waterTime*pawDrift)*.05))*pawK;':''}
     {
      vec3 r=wRipple(vWaterWorld.xz,waterTime);
      normal=normalize(normal+vec3(r.xy*(${calm?'.17':'.5'}+paw*.45),0.));
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
  material.customProgramCacheKey=()=>'fairway-water-v29-'+kind+(calm?'-calm':'');
  material.needsUpdate=true;
 }

 addSky(sunDir){
  const bio=this.world.bio,blue=this.style==='blueprint',toon=this.style==='cartoon',material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(blue?'#0c2035':toon?'#64bcdf':bio.waterTint)},horizon:{value:new T.Color(blue?'#3c6176':bio.sky)},sun:{value:sunDir},skyTime:this.foliageTime,cloud:{value:bio.waterMurk},cloudAmount:{value:this.quality.clouds?0:1},cloudLight:{value:new T.Color(.97,.975,.96)},glowColor:{value:new T.Color(1,.72,.35)},afterglow:{value:0},discColor:{value:new T.Color(1,.96,.83)},starness:{value:0},starAngle:{value:0},starAxis:{value:new T.Vector3(...STAR_AXIS)},moonDir:{value:new T.Vector3(0,-1,0)},moonColor:{value:new T.Color()},moonRadius:{value:.04},moonAmount:{value:0}},vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vSky;uniform vec3 top,horizon,sun,cloudLight,glowColor,discColor;uniform vec3 starAxis;uniform float cloud,cloudAmount,skyTime,starness,starAngle,afterglow;uniform vec3 moonDir,moonColor;uniform float moonRadius,moonAmount;
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
  // THE AFTERGLOW (the cartoon overhaul's lighting, round 2): while the sun is
  // low and for a while after it sets, the horizon under it burns orange and
  // the horizon opposite takes a pink band (the Belt of Venus) -- the colour a
  // dusk is remembered by. The tint the clock lays over the whole dome made a
  // dusk one muddy grey-blue. Banked to the horizon and by bearing from the
  // sun, so the zenith keeps its own blue.
  if(afterglow>.001){
   vec2 ds=d.xz,ss=sun.xz;float toward=dot(normalize(ds+1e-5),normalize(ss+1e-5));
   float low=exp(-h*7.)*smoothstep(-.06,.02,d.y);
   vec3 burn=mix(vec3(.95,.42,.42),vec3(1.,.6,.28),smoothstep(.2,1.,toward));
   col+=afterglow*low*(burn*smoothstep(-.3,1.,toward)*.8+vec3(.62,.45,.66)*smoothstep(.1,-1.,toward)*.32);
  }
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
   fn(new T.CubeCamera(1,20000,this.probeTarget()),this.pmremFor('water'));
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
  // Seen from the pond, not the camera: every cloud's shadow (the next frame
  // packs them again).
  if(this.cloudUniforms)allCloudShadows(this.cloudUniforms,this.clouds.discs,this.clouds.fades);
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
 // One flagstick and cup at a world point. The range builds one per green (its
 // targets' sticks taller and in their colour: `tall` and `cloth` scale them,
 // and holdFlagsticks keeps the scale), every course hole one.
 // THE FLAG CARRIES ITS HOLE'S NUMBER (the cartoon overhaul's course props):
 // white figures on the flag's colour, as most clubs print them, where the
 // cloth was a plain rectangle. `number` absent (the range): plain, as before.
 // The stick and cup are untouched -- the ball plays against them.
 flagCloth(color,number,ink='#fffaf0'){
  const c=document.createElement('canvas');c.width=128;c.height=88;const ctx=c.getContext('2d');
  ctx.fillStyle=color;ctx.fillRect(0,0,128,88);
  ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(0,0,128,6);ctx.fillStyle='rgba(0,0,0,.14)';ctx.fillRect(0,82,128,6);
  ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 58px '+UI_FONT;ctx.fillText(String(number),64,47);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;this.resources.push(tex);return tex;
 }
 addCupAndFlag(p,y,{color=null,tall=1,cloth=1,number=null,ink=undefined}={}){
  const group=this.group,blue=this.style==='blueprint',white=this.surfaceMaterial('#f8f4df',{roughness:.55});
  const pole=new T.Mesh(new T.CylinderGeometry(FLAGSTICK_TOP_R,FLAGSTICK_BASE_R,FLAGSTICK_HEIGHT,10),white);pole.position.set(p.x,y+FLAGSTICK_HEIGHT/2,p.z);pole.castShadow=true;group.add(pole);
  const printed=number!=null&&this.style==='cartoon',geo=printed?twoSidedCloth():new T.PlaneGeometry(.48,.33,12,4);for(let i=0;i<geo.attributes.position.count;i++){const x=geo.attributes.position.getX(i);geo.attributes.position.setZ(i,Math.sin(x*5)*.1);}geo.computeVertexNormals();const flagColor=blue?'#8df1dd':color||'#dc7845',flag=new T.Mesh(geo,printed?this.surfaceMaterial('#ffffff',{map:this.flagCloth(flagColor,number,ink)}):this.surfaceMaterial(flagColor,{side:T.DoubleSide,roughness:.6}));flag.position.set(p.x+.24,y+1.95,p.z);group.add(flag);this.flags.push(flag);const assembly=new T.Group();assembly.add(pole,flag);group.add(assembly);assembly.userData.lift=false;assembly.userData.base={x:p.x,y,z:p.z};assembly.userData.pole=pole;assembly.userData.cloth=flag;assembly.userData.tall=tall;assembly.userData.clothScale=cloth;
  const cup=new T.Mesh(new T.CylinderGeometry(CUP_RADIUS,CUP_RADIUS,.115,48,1,true),this.surfaceMaterial('#56614f',{side:T.BackSide}));cup.position.set(p.x,y-.0575,p.z);group.add(cup);const liner=new T.Mesh(new T.CylinderGeometry(CUP_RADIUS-.001,CUP_RADIUS-.001,.0896,48,1,true),this.surfaceMaterial('#c5c9b8',{roughness:.7,side:T.BackSide}));liner.position.set(p.x,y-.0254-.0448,p.z);group.add(liner);const floor=new T.Mesh(new T.CircleGeometry(CUP_RADIUS,48),new T.MeshBasicMaterial({color:'#101b12'}));floor.rotation.x=-Math.PI/2;floor.position.set(p.x,y-.115,p.z);group.add(floor);
  return {assembly,pole,flag,cup,liner,floor};
 }
 // CART PATHS AND THEIR BRIDGES (architect-courses, phase 2; paths.js): a strip
 // laid on the ground along each path, a hair above it, in the landscape's
 // material, and a plank bridge where one crosses a creek. Only an Architect
 // course has any. The strip follows the ground AS DRAWN -- the lie reads the
 // same polyline (course.js `surface`), so paint and play agree.
 // A CART PATH'S SURFACE, painted on a canvas once per kind: the pattern a
 // player reads at a glance -- asphalt's chips and its two edge lines,
 // concrete's joints, gravel, shell and bark scattered, granite's fines, a
 // boardwalk's planks. Light on mid-grey, so the material's colour sets the
 // tone and the tile only modulates it. Across the path is u (0-1), along it
 // v (a tile per 4 m). PLACED.
 pathTexture(kind){
  this.pathTextures=this.pathTextures||{};
  if(this.pathTextures[kind])return this.pathTextures[kind];
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=64;c.height=128;const g=c.getContext('2d');
  let seed=[...kind].reduce((a,ch)=>a*31+ch.charCodeAt(0),7)>>>0;const r=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
  g.fillStyle='#e6e6e6';g.fillRect(0,0,64,128);
  const dots=(n,size,light,dark)=>{for(let i=0;i<n;i++){g.fillStyle=r()<.5?light:dark;const s=size*(.5+r());g.fillRect(r()*64,r()*128,s,s);}};
  if(kind==='boardwalk'){for(let y=0;y<128;y+=8){g.fillStyle=r()<.5?'#f2f2f2':'#dcdcdc';g.fillRect(0,y,64,7);g.fillStyle='#9a9a9a';g.fillRect(0,y+7,64,1);}g.fillStyle='#b0b0b0';g.fillRect(6,0,2,128);g.fillRect(56,0,2,128);}
  else if(kind==='concrete'){dots(160,1.2,'#f4f4f4','#d2d2d2');g.fillStyle='#b8b8b8';g.fillRect(0,0,64,1.5);g.fillRect(0,64,64,1.5);}
  else if(kind==='asphalt'){dots(420,1.4,'#f6f6f6','#c4c4c4');g.fillStyle='#fbfbfb';g.fillRect(3,0,2,128);g.fillRect(59,0,2,128);}
  // A road (roads.js): asphalt, its edge lines, a dashed centre line.
  else if(kind==='road'){dots(420,1.4,'#f2f2f2','#c4c4c4');g.fillStyle='#ffffff';g.fillRect(2,0,2,128);g.fillRect(60,0,2,128);g.fillRect(31,0,2,64);}
  // A residential street (roads.js placeStreets): asphalt and a pale curb and
  // gutter each side, no lines. The tone is in the tile, the curb being paler
  // than the material's colour could make it.
  else if(kind==='street'){g.fillStyle='#6d6f74';g.fillRect(0,0,64,128);dots(420,1.4,'#797b80','#62646a');g.fillStyle='#f4f2ea';g.fillRect(0,0,3,128);g.fillRect(61,0,3,128);}
  // Brick and cobble (the streets kit): laid courses of setts.
  else if(kind==='brick'||kind==='cobble'){const bw=kind==='brick'?16:11,bh=kind==='brick'?8:11;g.fillStyle='#bcbcbc';for(let y=0;y<128;y+=bh)for(let x=-(y/bh%2)*bw/2;x<64;x+=bw)g.fillRect(x+1,y+1,bw-2,bh-2);}
  else if(kind==='bark'){for(let i=0;i<220;i++){g.save();g.translate(r()*64,r()*128);g.rotate(r()*Math.PI);g.fillStyle=r()<.5?'#f0f0f0':'#c8c8c8';g.fillRect(-3,-1,6,2);g.restore();}}
  else dots(kind==='shell'?520:460,kind==='granite'?1:1.8,'#fafafa',kind==='shell'?'#d9d9d9':'#bdbdbd');
  // Darker at the edges, so the path's sides read against the grass.
  const e=g.createLinearGradient(0,0,64,0);e.addColorStop(0,'rgba(0,0,0,.18)');e.addColorStop(.12,'rgba(0,0,0,0)');e.addColorStop(.88,'rgba(0,0,0,0)');e.addColorStop(1,'rgba(0,0,0,.18)');g.fillStyle=e;g.fillRect(0,0,64,128);
  const tex=new T.CanvasTexture(c);tex.wrapS=T.ClampToEdgeWrapping;tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  this.pathTextures[kind]=tex;this.resources.push(tex);return tex;
 }
 addPaths(w){
  if(!w?.paths?.length&&!w?.roads?.length)return;
  const COLORS={asphalt:'#6b6863',concrete:'#cfc9ba',gravel:'#bfb197',shell:'#f0e9d8',bark:'#7c5b3d',granite:'#c49d70',boardwalk:'#a9814f',road:'#55595e',
   dirt:'#9c8466',redclay:'#a5583a',brick:'#9a4e3c',cobble:'#8a8478'};
  // EACH LANDSCAPE'S ROAD SURFACE (the streets kit, PLAN 4; the study's
  // catalogue `streets`): the public road asphalt -- concrete where the
  // place builds in concrete, gravel in the Sand Hills -- and the club's
  // drive the place's own country surface. Drawing only. PLACED from the
  // catalogue's lists (RESEARCH, *Each landscape's road surface*).
  const roadKey=w.bio?.key||w.settings?.biome;
  const PUBLIC={bluebonnet:'concrete',gulfcoast:'concrete',flatwoods:'concrete',sandhills:'gravel'};
  const DRIVE={puget:'gravel',pacnw:'gravel',redwood:'gravel',cascades:'gravel',sierra:'gravel',rockies:'gravel',mountains:'gravel',ponderosa:'dirt',sagebrush:'dirt',redrock:'dirt',chihuahuan:'dirt',
   winecountry:'gravel',heartland:'gravel',sandhills:'gravel',prairie:'gravel',highplains:'gravel',crosstimbers:'dirt',badlands:'gravel',hillcountry:'dirt',longleaf:'redclay',lowcountry:'shell',lowgulf:'shell',
   bayou:'gravel',blueridge:'gravel',ozarks:'gravel',newengland:'gravel',oldnortheast:'brick',parkland:'brick',southpines:'gravel',pinebarrens:'shell',northwoods:'gravel',lakedunes:'gravel',oregondunes:'gravel',seaside:'gravel',
   alaska:'gravel',palms:'cobble',desertresort:'concrete',dresort:'concrete',bluebonnet:'concrete',gulfcoast:'concrete',flatwoods:'concrete'};
  // ONE MESH A SURFACE (the owner's review, measured: a mesh a piece was
  // twenty-odd draws on a course whose paths are many short pieces).
  const byKind=new Map();
  // The roads (roads.js; the US landscapes goal, phase 4) are laid as the
  // paths are, darker asphalt.
  // A street is the public road's surface where that is not asphalt, else a
  // street's own; a house's lane is the drive it runs on from. A road lies a
  // finger above the paths and lanes, so a crossing does not shimmer.
  const roadKind=r=>r.kind==='drive'?DRIVE[roadKey]||'road':r.kind==='lane'?'concrete':PUBLIC[roadKey]||(r.kind==='street'?'street':'road');
  for(const path of [...(w.paths||[]),...(w.roads||[]).map(r=>({points:r.points,width:r.width,kind:roadKind(r),lift:r.kind==='lane'?.035:.05}))]){
   // ON THE GROUND ALL THE WAY (the owner, 31 October 2026, Links: a path
   // "clipping through hills"): a straightened run's corners can be a hundred
   // metres apart, and a strip with points only there ran straight through
   // the dune between them. A point every 2 m, each set on the ground.
   const p=[];path.points.forEach((q,k)=>{if(!k){p.push(q);return;}const o=path.points[k-1],n=Math.max(1,Math.ceil(Math.hypot(q.x-o.x,q.z-o.z)/2));for(let t=1;t<=n;t++)p.push({x:o.x+(q.x-o.x)*t/n,z:o.z+(q.z-o.z)*t/n});});
   if(p.length<2)continue;
   const kind=path.kind||'concrete';if(!byKind.has(kind))byKind.set(kind,{pos:[],uv:[],idx:[]});
   const {pos,uv,idx}=byKind.get(kind),base=pos.length/3,half=path.width/2;let run=0;
   for(let i=0;i<p.length;i++){
    const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
    if(i)run+=Math.hypot(p[i].x-p[i-1].x,p[i].z-p[i-1].z);
    for(const s of [-1,1]){const x=p[i].x+nx*half*s,z=p[i].z+nz*half*s;pos.push(x,w.height(x,z)+(path.lift??.035),z);uv.push(s<0?0:1,run/4);}
    if(i){const k=base+(i-1)*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
  }
  for(const [kind,{pos,uv,idx}] of byKind){
   const path={kind};
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
   // Painted, not flat (the owner's review: "a better texture"): the surface's
   // own pattern, a tile per 4 m (`pathTexture`), white in the tile so the
   // material's colour still sets the tone.
   const mat=this.surfaceMaterial(COLORS[path.kind]||COLORS.concrete,{polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,map:this.pathTexture(path.kind)});
   const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;mesh.userData.path=true;this.group.add(mesh);this.resources.push(g,mat);
  }
  // THE PARKING LOT (roads.js): an asphalt slab laid on the ground on a 4 m
  // grid, and its stall lines -- four rows of stalls, two aisles.
  if(w.lot){
   const L=w.lot,rc=Math.cos(L.rotation),rs=Math.sin(L.rotation),at=(u,v)=>({x:L.x+u*rc+v*rs,z:L.z-u*rs+v*rc});
   const nu=Math.max(1,Math.ceil(L.width/4)),nv=Math.max(1,Math.ceil(L.depth/4)),pos=[],uv=[],idx=[];
   for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=at(-L.width/2+L.width*i/nu,-L.depth/2+L.depth*j/nv);pos.push(p.x,w.height(p.x,p.z)+.04,p.z);uv.push(i/nu*L.width/16,j/nv*L.depth/16);}
   for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i;idx.push(k,k+nu+1,k+1,k+1,k+nu+1,k+nu+2);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
   const mat=this.surfaceMaterial(COLORS.road,{polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,map:this.pathTexture('lot')});
   const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;this.group.add(mesh);this.resources.push(g,mat);
   // The lines: a 12 cm stripe at each stall's side, 5.5 m long, in the four
   // stall rows (roads.js STALL; the rows at the lot's two edges and either
   // side of its middle).
   const lp=[],li=[],D=5.5,A=7.3,rows=[-L.depth/2,-L.depth/2+D+A,L.depth/2-2*D-A,L.depth/2-D];
   for(const v0 of rows)for(let u=-L.width/2;u<=L.width/2+1e-6;u+=2.7){const b=lp.length/3;for(const [du,dv] of [[-.06,0],[.06,0],[-.06,D],[.06,D]]){const p=at(u+du,v0+dv);lp.push(p.x,w.height(p.x,p.z)+.06,p.z);}li.push(b,b+2,b+1,b+1,b+2,b+3);}
   const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lp,3));lg.setIndex(li);lg.computeVertexNormals();
   const lm=this.surfaceMaterial('#f2f0ea',{polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
   const lines=new T.Mesh(lg,lm);this.group.add(lines);this.resources.push(lg,lm);
  }
  // THE BRIDGES (phase 5; tools/blender/architect_water.py): 2 m bays laid
  // end to end across the span, timber or stone by landscape, each fitted to
  // the deck physics stands the ball on (course.js `b.deck`, its top) and to
  // the path's width, inked like the furniture.
  // Timber or stone, and the stone's colour, by the landscape's architect block.
  // INSTANCED (the owner's review, measured: each bay was its own group of
  // meshes, every part twice for its ink, so a 30 m bridge -- a Barranca's,
  // spanned wall to wall -- was some 60 meshes and Autumn's Architect course
  // drew 163 more calls than Classic on Low). Now one InstancedMesh per part,
  // and one for its ink, for every bay of every bridge.
  const bridgeOf=k=>worldOf(k),key=w.bio?.key||w.settings?.biome,stone=bridgeOf(key).bridge==='stone',name=stone?'Blender_BridgeBay_Stone':'Blender_BridgeBay_Wood';
  // A COVERED BRIDGE (New England; tools/blender/cartoon_newengland.py): one
  // model a bridge, not bays -- its roof and portals cannot repeat. Drawn at
  // its own size across (6.4 m) and height (9.1 m, abutments to ridge, the
  // deck 2.6 m up), stretched along the span; the model spans its x.
  if(bridgeOf(key).bridge==='covered'&&w.bridges?.length){
   const cb='Blender_CoveredBridge_1',cparts=modelParts(cb),cinfo=MESH_MODELS[cb];
   if(cparts&&cinfo){
    const H=9.1,DECK=2.6,look={accent:'#a8322a',bark:'#7a7670',stone:'#b8b0a0'},m4=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),pos=new T.Vector3(),sc=new T.Vector3(),ink=this.inkMaterial(H);
    const list=w.bridges.map(b=>({x:b.x,z:b.z,y:(b.deck??Math.max(w.height(b.x,b.z),0)+.45)-DECK,angle:b.angle+Math.PI/2,sx:(b.span+1)/(2*cinfo.rx),sz:H}));
    cparts.forEach(p=>{
     const mat=this.surfaceMaterial(look[p.role]??'#ffffff',{vertexColors:p.painted}),m=new T.InstancedMesh(p.geometry,mat,list.length),k=new T.InstancedMesh(p.geometry,ink,list.length);
     list.forEach((b,i)=>{q.setFromAxisAngle(up,b.angle);pos.set(b.x,b.y,b.z);sc.set(b.sx,H,b.sz);m4.compose(pos,q,sc);m.setMatrixAt(i,m4);k.setMatrixAt(i,m4);});
     m.castShadow=m.receiveShadow=true;k.castShadow=k.receiveShadow=false;
     for(const x of [m,k]){x.instanceMatrix.needsUpdate=true;x.computeBoundingSphere();this.group.add(x);}
     this.resources.push(mat);
    });
    return;
   }
  }
  const parts=modelParts(name),info=MESH_MODELS[name];
  if(parts&&info&&w.bridges?.length){
   const H=stone?1.08:1.25,DECK_TOP=.3,look=stone?{stone:bridgeOf(key).colours.bridgeStone}:{bark:'#8f6a45',stone:'#6b4a2f'};
   const bays=[];
   for(const b of w.bridges){
    const y=b.deck??Math.max(w.height(b.x,b.z),0)+.45,n=Math.max(1,Math.ceil(b.span/2)),bay=b.span/n,ca=Math.sin(b.angle),cb=Math.cos(b.angle);
    for(let i=0;i<n;i++){const t=(i+.5)/n-.5;bays.push({x:b.x+ca*b.span*t,y:y-DECK_TOP,z:b.z+cb*b.span*t,angle:b.angle,sx:b.width/(2*info.rx),sz:bay/(2*info.rz)});}
   }
   const m4=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),pos=new T.Vector3(),sc=new T.Vector3(),ink=this.inkMaterial(H);
   parts.forEach(p=>{
    const mat=this.surfaceMaterial(look[p.role]??'#ffffff',{vertexColors:p.painted});
    const m=new T.InstancedMesh(p.geometry,mat,bays.length),k=new T.InstancedMesh(p.geometry,ink,bays.length);
    bays.forEach((b,i)=>{q.setFromAxisAngle(up,b.angle);pos.set(b.x,b.y,b.z);sc.set(b.sx,H,b.sz);m4.compose(pos,q,sc);m.setMatrixAt(i,m4);k.setMatrixAt(i,m4);});
    m.castShadow=m.receiveShadow=true;k.castShadow=k.receiveShadow=false;
    for(const x of [m,k]){x.instanceMatrix.needsUpdate=true;x.computeBoundingSphere();this.group.add(x);}
    this.resources.push(mat);
   });
  }
 }
 // WATER MADE BY PEOPLE (phase 5; waterworks.js, tools/blender/architect_water.py):
 // rip-rap stones and railway-tie walls along a pond's faced edge, a fountain
 // in a big pond; instanced, the ties and the fountain inked. Decoration.
 addWaterworks(w){
  this.fountains=null;
  if(!w?.waterworks?.length||this.style!=='cartoon')return;
  const key=w.bio?.key||w.settings?.biome;
  // Iteration 4: a shade darker than the sheet's -- pale stone went pink-white in the afternoon sun.
  const ROCK={[key]:worldOf(key).colours.riprap};
  const KINDS=[
   ...[1,2,3].map(v=>({kind:'riprap',variant:v-1,model:'Blender_RipRap_'+v,height:.34,colours:{stone:ROCK[key]||'#a8a298'}})),
   {kind:'bulkhead',model:'Blender_Bulkhead_1',height:.9,inked:true,colours:{bark:'#5e4733',stone:'#8b8a85'}},
  ];
  // The fountain is drawn here and moves (addFountains, fountain.js): the
  // Blender plume was frozen (the owner's review: "fountains need to be
  // animated").
  this.fountains=this.addFountains(w.waterworks.filter(m=>m.kind==='fountain'));
  const m4=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),pos=new T.Vector3(),sc=new T.Vector3();
  for(const spec of KINDS){
   const list=w.waterworks.filter(m=>m.kind===spec.kind&&(spec.variant==null||m.variant===spec.variant));if(!list.length)continue;
   const parts=modelParts(spec.model);if(!parts)continue;
   for(const p of parts){
    const mat=this.surfaceMaterial(spec.colours[p.role]??'#ffffff',{vertexColors:p.painted});
    const mesh=new T.InstancedMesh(p.geometry,mat,list.length);
    list.forEach((m,i)=>{q.setFromAxisAngle(up,m.rot||0);pos.set(m.x,m.y,m.z);sc.setScalar(spec.height*(m.size||1));mesh.setMatrixAt(i,m4.compose(pos,q,sc));});
    mesh.castShadow=spec.kind!=='riprap';mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    this.group.add(mesh);this.resources.push(mat);
    if(spec.inked){const ink=new T.InstancedMesh(p.geometry,this.inkMaterial(spec.height),list.length);ink.instanceMatrix.copy(mesh.instanceMatrix);ink.castShadow=ink.receiveShadow=false;ink.computeBoundingSphere();this.group.add(ink);}
   }
  }
 }
 // A FOUNTAIN IN MOTION (the owner's review; fountain.js says where the
 // water is). Per fountain: a foam boil on the water, a jet core that
 // breathes, a few hundred drops flying up and falling back, and rings
 // spreading where they land. All the fountains' drops are one InstancedMesh
 // that moves, so noCull. Two fountains a course at most, so a few hundred
 // matrices a frame: on every tier, at 30 a second on Low.
 addFountains(list){
  if(!list.length)return null;
  // Iteration 2: smaller drops, each a rounder body stretched along its
  // flight (were 240 faceted ones, which read as popcorn); iteration 4: 480.
  const N=480,group=new T.Group(),white='#f4fbff';
  const dropMat=this.surfaceMaterial(white),drops=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),dropMat,N*list.length);
  drops.castShadow=false;drops.receiveShadow=false;drops.frustumCulled=false;drops.userData.noCull=true;group.add(drops);this.resources.push(dropMat);
  const ringGeo=new T.RingGeometry(.86,1,40).rotateX(-Math.PI/2),boilGeo=new T.CircleGeometry(1.25,24).rotateX(-Math.PI/2),skirtGeo=new T.RingGeometry(1.5,3.3,40).rotateX(-Math.PI/2);
  const jetGeo=new T.CylinderGeometry(.09,.22,1,10,1,true).translate(0,.5,0);
  const each=list.map((f,i)=>{
   const at=new T.Group();at.position.set(f.x,f.y,f.z);group.add(at);
   const boilMat=new T.MeshBasicMaterial({color:white,transparent:true,opacity:.8,depthWrite:false});
   const boil=new T.Mesh(boilGeo,boilMat);boil.position.y=.03;boil.renderOrder=2;at.add(boil);
   // Iteration 5: a faint skirt of foam where the crown lands, flickering,
   // so from across the pond the plume stands on white water.
   const skirtMat=new T.MeshBasicMaterial({color:white,transparent:true,opacity:.22,depthWrite:false}),skirt=new T.Mesh(skirtGeo,skirtMat);skirt.position.y=.035;skirt.renderOrder=2;at.add(skirt);this.resources.push(skirtMat);
   const jetMat=this.surfaceMaterial(white);jetMat.transparent=true;jetMat.opacity=.88;
   const jet=new T.Mesh(jetGeo,jetMat);at.add(jet);
   const rings=[0,1,2].map(()=>{const m=new T.MeshBasicMaterial({color:white,transparent:true,opacity:0,depthWrite:false}),r=new T.Mesh(ringGeo,m);r.position.y=.04;r.renderOrder=2;at.add(r);this.resources.push(m);return r;});
   this.resources.push(boilMat,jetMat);
   return {f,at,boil,skirt,jet,rings,list:fountainDrops(N,i*7919+Math.round(f.x*13+f.z*7)),phase:i*1.9};
  });
  const m4=new T.Matrix4(),q=new T.Quaternion(),pos=new T.Vector3(),sc=new T.Vector3(),up=new T.Vector3(0,1,0),v=new T.Vector3();
  const place=t=>{
   each.forEach((e,i)=>{
    e.list.forEach((d,k)=>{const p=dropAt(d,t);pos.set(e.f.x+p.x,e.f.y+p.y,e.f.z+p.z);v.set(p.vx,p.vy,p.vz);const speed=v.length()||1;q.setFromUnitVectors(up,v.multiplyScalar(1/speed));const s=Math.max(1e-4,p.s);sc.set(s,s*(1+speed*.45),s);drops.setMatrixAt(i*N+k,m4.compose(pos,q,sc));});
    e.jet.scale.set(1,jetAt(t,e.phase),1);
    e.boil.scale.setScalar(1+.08*Math.sin(t*5.1+e.phase));
    e.skirt.material.opacity=.2+.06*Math.sin(t*7.3+e.phase)+.03*Math.sin(t*13.1);
    e.rings.forEach((r,k)=>{const g=ringAt(k,e.rings.length,t);r.scale.setScalar(g.r);r.material.opacity=g.o;});
   });
   drops.instanceMatrix.needsUpdate=true;
  };
  place(0);
  this.group.add(group);
  let since=0;
  return {group,update:(dt,t)=>{since+=dt;if(this.quality===tierOf('low')&&since<1/30)return;since=0;place(t);}};
 }
 // AN ARCHITECT COURSE'S MARKINGS (architect-courses, phase 2; markings.js,
 // tools/blender/architect_people.py): stakes, yardage posts and rakes, a few
 // hundred a course, so drawn instanced -- one InstancedMesh per model part per
 // colour -- and uninked (the furniture's ink is a handful of pieces a hole).
 // Decoration: nothing a ball hits.
 addMarkings(w){
  this.markings=null;
  if(!w?.markers?.length||this.style!=='cartoon')return;
  // Grouped, and not drawn on Low (the owner's review, measured: some forty
  // draws of stakes, posts and rakes were most of what an Architect course
  // cost over Classic on Low -- Low already leaves out the animals and the
  // crowd). The frame loop sets the group's visibility by tier.
  const marks=new T.Group();marks.name='Markings';this.group.add(marks);this.markings=marks;
  const KINDS={
   stake:{model:'Blender_Stake_1',height:.92,colours:{accent:'#e64a34',bark:'#4b3a2a'}},
   obstake:{model:'Blender_ObStake_1',height:1.05,colours:{stone:'#f6f3ea',bark:'#4b3a2a'}},
   post100:{model:'Blender_YardagePost_1',height:.64,colours:{accent:'#d63c30',stone:'#2f4a35',bark:'#3a2e22'}},
   post150:{model:'Blender_YardagePost_1',height:.64,colours:{accent:'#f8f6ef',stone:'#2f4a35',bark:'#3a2e22'}},
   post200:{model:'Blender_YardagePost_1',height:.64,colours:{accent:'#2f62c4',stone:'#2f4a35',bark:'#3a2e22'}},
   rake:{model:'Blender_Rake_1',height:.12,length:2.3,colours:{accent:'#e8b84a',bark:'#a9845a'}},
  };
  const m4=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),pos=new T.Vector3(),sc=new T.Vector3();
  for(const [kind,spec] of Object.entries(KINDS)){
   const list=w.markers.filter(m=>m.kind===kind);if(!list.length)continue;
   const parts=modelParts(spec.model);if(!parts)continue;
   const info=MESH_MODELS[spec.model];
   for(const p of parts){
    const mat=this.surfaceMaterial(spec.colours[p.role]??'#ffffff',{vertexColors:p.painted});
    const mesh=new T.InstancedMesh(p.geometry,mat,list.length);
    list.forEach((m,i)=>{
     // The ingest makes a model one unit tall; a rake is scaled back by its
     // length instead, since it lies flat.
     const k=spec.length?spec.length/Math.max(info?.rz??1,info?.rx??1)/2:spec.height;
     q.setFromAxisAngle(up,m.rot||0);pos.set(m.x,w.height(m.x,m.z),m.z);sc.setScalar(k);
     mesh.setMatrixAt(i,m4.compose(pos,q,sc));
    });
    mesh.castShadow=kind!=='rake';mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    marks.add(mesh);this.resources.push(mat);
    // Iteration 6: the furniture's ink, instanced, on what stands up (not a
    // rake lying in the grass), so a stake keeps its outline at a distance.
    if(kind!=='rake'){const ink=new T.InstancedMesh(p.geometry,this.inkMaterial(spec.height),list.length);ink.instanceMatrix.copy(mesh.instanceMatrix);ink.castShadow=ink.receiveShadow=false;ink.computeBoundingSphere();marks.add(ink);}
   }
  }
 }
 // One model's parts merged into one vertex-coloured geometry, each part's
 // role colour times its paint (as addBuildings bakes a building); `haze`
 // lerps every colour toward `sky` (a far backdrop, pre-hazed).
 bakedModel(name,tone,haze=0,sky=null){
  const parts=modelParts(name);if(!parts)return null;
  const geos=parts.map(p=>{
   const src=p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone(),n=src.attributes.position.count,c=new T.Color(tone[p.role]??'#ffffff'),col=new Float32Array(n*3),paint=p.painted?src.attributes.color:null;
   if(haze&&sky)c.lerp(sky,haze);
   for(let i=0;i<n;i++){col[i*3]=c.r*(paint?paint.getX(i):1);col[i*3+1]=c.g*(paint?paint.getY(i):1);col[i*3+2]=c.b*(paint?paint.getZ(i):1);}
   const out=new T.BufferGeometry();out.setAttribute('position',src.attributes.position);out.setAttribute('normal',src.attributes.normal);out.setAttribute('color',new T.BufferAttribute(col,3));return out;});
  const merged=mergeGeometries(geos);for(const x of geos)x.dispose();return merged;
 }
 // SEA STACKS OFFSHORE (the US landscapes goal, phase 7; tools/blender/
 // cartoon_calcoast.py): a landscape with `seaStacks` stands that many spires
 // and arches in its sea, 60-450 m off the nearest hole, where the water is at
 // least 2 m deep (the sea as audio.js tells it: the landscape has a sea, the
 // ground is under its level, no lake owns the spot). Scenery: nothing
 // collides with them -- a ball that reaches one is in the sea already.
 // Heights 12-22 m and positions PLACED.
 addSeaStacks(w){
  const bio=biomeOf(w.settings.biome),want=bio.seaStacks|0;
  if(!want||!w.bio?.sea||!Number.isFinite(w.waterLevel)||this.style!=='cartoon')return;
  const names=['Blender_SeaStack_1','Blender_SeaStack_2'].filter(n=>MESH_MODELS[n]&&modelParts(n));if(!names.length)return;
  const tone={stone:'#5a5650',accent:'#e8e4dc',leaf:'#5a6e40',dirt:'#5a5650',bark:'#5a5650'};
  const rng=random(w.seed+':seastacks'),g=new T.Group();g.name='Sea stacks';
  const geos=new Map(names.map(n=>[n,this.bakedModel(n,tone)]));
  for(let t=0,placed=0;t<600&&placed<want;t++){
   const x=(rng()-.5)*w.halfX*1.9,z=(rng()-.5)*w.halfZ*1.9,d=w.nearest(x,z).d;
   if(d<60||d>450||!(w.height(x,z)<w.waterLevel-2)||w.lakeOwner?.(x,z))continue;
   const name=names[placed%names.length],geo=geos.get(name),h=12+rng()*10;
   const m=new T.Mesh(geo,this.surfaceMaterial('#ffffff',{vertexColors:true}));m.castShadow=m.receiveShadow=true;
   const ink=new T.Mesh(geo,this.inkMaterial(h));ink.castShadow=ink.receiveShadow=false;
   const s=new T.Group();s.add(m,ink);s.scale.setScalar(h);s.rotation.y=rng()*Math.PI*2;s.position.set(x,w.height(x,z)-1,z);g.add(s);placed++;
  }
  this.group.add(g);
 }
 // A SNOW VOLCANO ON THE HORIZON (the US landscapes goal, phase 7; tools/
 // blender/cartoon_westmtn.py): a landscape with `backdrop` names its model,
 // drawn 5.2 km out on a bearing from the course's seed, 900 m tall -- about
 // ten degrees of sky from the course, as Rainier or Hood stands over a
 // Cascades course on a clear day. Past every tier's fog (Low's closes at 3.5
 // km), so it is drawn unfogged and pre-hazed instead: every colour 40% of
 // the way to the landscape's sky. No shadow, no ink. Figures PLACED.
 addBackdrop(w){
  const bio=biomeOf(w.settings.biome);if(!bio.backdrop||this.style!=='cartoon')return;
  const name='Blender_'+bio.backdrop;if(!MESH_MODELS[name])return;
  const geo=this.bakedModel(name,{stone:'#6a7a8a',accent:'#e8eef4'},.4,new T.Color(w.bio.sky||bio.sky||'#c4d6e2'));if(!geo)return;
  const rng=random(w.seed+':backdrop'),a=rng()*Math.PI*2,mat=new T.MeshLambertMaterial({vertexColors:true,fog:false});
  const m=new T.Mesh(geo,mat);m.castShadow=m.receiveShadow=false;m.scale.setScalar(900);m.position.set(Math.cos(a)*5200,-60,Math.sin(a)*5200);m.name='Backdrop';
  this.group.add(m);this.resources.push(mat);
 }
 // AN ARCHITECT COURSE'S BUILDINGS (architect-courses, phase 2; clubhouse.js):
 // the landscape's clubhouse (tools/blender/architect_clubhouses.py), its
 // model fitted to the box physics stops the ball against -- width, depth and
 // height -- and inked like the furniture. Colours by landscape: walls, roof,
 // trim and glass.
 addBuildings(w){
  if(!w?.buildings?.length||this.style!=='cartoon')return;
  // The clubhouse's colours are its landscape's architect block's (biomes.js).
  const look=worldOf(w.bio?.key||w.settings?.biome).colours.clubhouse;
  // THE LAND'S STORY'S BUILDINGS (phase 6; story.js, tools/blender/architect_story.py):
  // fitted to their boxes the same way, coloured by piece and landscape.
  const key=w.bio?.key||w.settings?.biome,ruinStone=worldOf(key).colours.ruin;
  const STORY={
   barn:{bark:'#b8463a',stone:'#7a7470',dirt:'#4d4a50',accent:'#f4f1ea'},
   silo:{stone:'#d9d4c8',accent:'#9aa0a6',dirt:'#7d8a96'},
   windpump:{stone:'#a7aaad',bark:'#6b5a48',dirt:'#4a4a4a',accent:'#e8e4da'},
   chapel:{stone:ruinStone},cottage:{stone:ruinStone},
   minehead:{bark:'#6b4f36',dirt:'#3a3a3e'},
   sugarmill:{stone:'#b3a48c',dirt:'#3b3530'},
   lighthouse:{stone:'#f4f1ea',accent:'#c8372d',dirt:'#2f3437',leaf:'#ffe08a'},
   redbarn:{accent:'#a8322a',stone:'#f2efe6',bark:'#6a6a6a'},
   pierlight:{stone:'#c8c4bc',accent:'#a8322a',bark:'#2a2a2a'},
   // The plains pack's (tools/blender/cartoon_plains.py LOOK).
   windmill:{bark:'#9a9a94',accent:'#b04a32',stone:'#8a8c86',leaf:'#4a5e58'},
   grainelevator:{stone:'#d8d4c8',bark:'#4a4846',accent:'#9a5a3a',leaf:'#b0b2ae'},
   pumpjack:{bark:'#3a3a3a',accent:'#b04a32',stone:'#6a6a6a',leaf:'#a8a8a4'},
   // Appalachia's and the Northeast parkland's.
   stonecabin:{bark:'#7a5a3a',stone:'#8a8a80',leaf:'#6e665c',accent:'#2a2622'},
   tobaccobarn:{bark:'#1e1e1e',leaf:'#7a7672',accent:'#9a7040'},
   shingledwindmill:{stone:'#9a9488',bark:'#6e6a64',accent:'#ece8e0',dirt:'#34383c'},
   logcabin:{bark:'#7a5a3a',leaf:'#5e4e42',stone:'#9a948a',accent:'#2a2e30'},
   // The streets kit's cart barn (tools/blender/cartoon_streets.py).
   cartbarn:{stone:'#e4ded0',bark:'#5c666c',accent:'#a9aeb2',leaf:'#f4f2ea'},
   church:{stone:'#e9e4d8',dirt:'#5b5f66',leaf:'#9fc3d8',accent:'#d9b24a',bark:'#7a4a32'},
  };
  for(const b of w.buildings){
   const club=b.kind==='clubhouse',name=club?clubhouseModel(b.model):'Blender_'+b.model,parts=modelParts(name),info=MESH_MODELS[name];if(!parts||!info)continue;
   const tone=club?look:(STORY[b.kind]||{});
   // ONE MESH A BUILDING (the owner's review, measured: a part a mesh, each
   // inked and in the shadow pass, made Autumn's Architect course on Low draw
   // a third more than Classic). Each part's role colour is baked into its
   // vertices -- times the paint where it has one (mesh-assets.js: 1.0 is
   // "as painted") -- and the parts merged: one mesh and one ink a building.
   const g=new T.Group();
   {const geos=parts.map(p=>{
     const src=p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone(),n=src.attributes.position.count,c=new T.Color(tone[p.role]??'#ffffff'),col=new Float32Array(n*3),paint=p.painted?src.attributes.color:null;
     for(let i=0;i<n;i++){col[i*3]=c.r*(paint?paint.getX(i):1);col[i*3+1]=c.g*(paint?paint.getY(i):1);col[i*3+2]=c.b*(paint?paint.getZ(i):1);}
     const out=new T.BufferGeometry();out.setAttribute('position',src.attributes.position);out.setAttribute('normal',src.attributes.normal);out.setAttribute('color',new T.BufferAttribute(col,3));return out;});
    const merged=mergeGeometries(geos);for(const x of geos)x.dispose();
    // Snow on its roof in a snowy winter (vegetation.js snowTopped).
    const bm=this.surfaceMaterial('#ffffff',{vertexColors:true}),m=new T.Mesh(merged,this.snowTops?snowTopped(bm):bm);m.castShadow=m.receiveShadow=true;g.add(m);
    const ink=new T.Mesh(merged,this.inkMaterial(b.height));ink.castShadow=ink.receiveShadow=false;g.add(ink);}
   // The model's front is glTF +z (its Blender -y); the building's front is
   // its local -z, toward the first tee -- hence the half turn.
   g.scale.set(b.width/(2*info.rx),b.height,b.depth/(2*info.rz));
   g.rotation.y=b.rotation+Math.PI;g.position.set(b.x,b.y,b.z);
   this.group.add(g);
   // THE TERRACE: on sloping ground the floor is level with the high side
   // (clubhouse.js), so a stone wall runs down to the lowest ground under it.
   const drop=b.y-(b.base??b.y)+.6;
   if(club&&drop>.8){
    const wall=new T.Mesh(new T.BoxGeometry(b.width+1.2,drop,b.depth+1.2),this.surfaceMaterial('#c9bea9'));
    wall.position.set(b.x,b.y-drop/2+.2,b.z);wall.rotation.y=b.rotation;wall.castShadow=wall.receiveShadow=true;
    this.group.add(wall);this.resources.push(wall.geometry,wall.material);
   }
  }
 }
 // THE LAND'S STORY'S WALLS AND PROPS (phase 6; story.js): a wall is 2 m
 // sections laid end to end along each run, stone or hedge, a moor wall's
 // sections leaning; the props -- a stone circle, the Dell's white aiming
 // stone, lanterns -- one by one. Instanced; the stone inked like the
 // furniture. The walls are solid (physics.js reads `wallBoxes`), the props
 // decoration.
 addStory(w){
  if(this.style!=='cartoon'||(!w?.walls?.length&&!w?.storyProps?.length&&!w?.streetProps?.length&&!w?.homes?.length))return;
  const key=w.bio?.key||w.settings?.biome;
  const STONE=worldOf(key).colours.wall;
  const m4=new T.Matrix4(),q=new T.Quaternion(),q2=new T.Quaternion(),up=new T.Vector3(0,1,0),fwd=new T.Vector3(0,0,1),pos=new T.Vector3(),sc=new T.Vector3();
  const draw=(model,list,colours,inked,place)=>{
   if(!list.length)return;
   const parts=modelParts(model),info=MESH_MODELS[model];if(!parts||!info)return;
   for(const p of parts){
    // Snow along the walls' tops and on everything else out here, in a snowy
    // winter, as on the roofs and the trees (vegetation.js snowTopped).
    const lit=this.surfaceMaterial(colours[p.role]??'#ffffff',{vertexColors:p.painted}),mat=this.snowTops?snowTopped(lit,true):lit,mesh=new T.InstancedMesh(p.geometry,mat,list.length);
    list.forEach((it,i)=>{place(it,info);mesh.setMatrixAt(i,m4.compose(pos,q,sc));});
    mesh.castShadow=mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();this.group.add(mesh);this.resources.push(mat);
    if(inked){const ink=new T.InstancedMesh(p.geometry,this.inkMaterial(1.2),list.length);ink.instanceMatrix.copy(mesh.instanceMatrix);ink.castShadow=ink.receiveShadow=false;ink.computeBoundingSphere();this.group.add(ink);}
   }
  };
  // Each run cut into sections of about 2 m; a section sits at the lower of
  // the ground under its ends, sunk a little so a slope shows no gap.
  const sections=(kind,step=2)=>{const out=[];for(const wl of (w.walls||[]).filter(x=>(x.kind==='leaning'?'stone':x.kind||'stone')===kind)){const len=Math.hypot(wl.bx-wl.ax,wl.bz-wl.az),n=Math.max(1,Math.round(len/step)),rot=Math.atan2(wl.bx-wl.ax,wl.bz-wl.az);for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,x0=wl.ax+(wl.bx-wl.ax)*t0,z0=wl.az+(wl.bz-wl.az)*t0,x1=wl.ax+(wl.bx-wl.ax)*t1,z1=wl.az+(wl.bz-wl.az)*t1;out.push({x:(x0+x1)/2,z:(z0+z1)/2,y:Math.min(w.height(x0,z0),w.height(x1,z1))-.12,rot:rot+(wl.kind==='rail'?(i%2?.52:-.52):0),len:len/n,lean:wl.kind==='leaning'?((i*7919%13)/13-.5)*.28:0});}}return out;};
  const wallPlace=h=>(s,info)=>{q.setFromAxisAngle(up,s.rot);if(s.lean){q2.setFromAxisAngle(fwd,s.lean);q.multiply(q2);}pos.set(s.x,s.y,s.z);sc.set(h,h,s.len/(2*info.rz));};
  // Iteration 4: uninked -- inked, a wall's small stones went black.
  draw('Blender_StoryWall_Stone',sections('stone'),{stone:STONE},false,wallPlace(1.1));
  draw('Blender_StoryWall_Hedge',sections('hedge'),{leaf:'#4f7a3a'},false,wallPlace(1.6));
  // New England's fieldstone wall (the New England pack): grey stones, some lichened.
  draw('Blender_FieldWall_1',sections('field'),{stone:'#8a8a80',accent:'#8a9a6a'},false,wallPlace(1.05));
  // A split-rail fence (the US landscapes goal's mountain pack): every other
  // 2 m panel turned 30 degrees each way, which makes the zig-zag.
  draw('Blender_SplitRailFence_1',sections('rail'),{bark:worldOf(key).colours.rail??'#8a7a62'},true,wallPlace(1.1));
  // Barbed wire on cedar posts (the plains pack): its model runs along x, in
  // sections of about 8 m (its own length at 1.2 m tall).
  // The Bluegrass's black four-board fence: along x as the wire, 9 m sections.
  draw('Blender_HorseFence_1',sections('board',9),{bark:'#1a1a1a'},true,(s,info)=>{q.setFromAxisAngle(up,s.rot+Math.PI/2);pos.set(s.x,s.y,s.z);sc.set(s.len/(2*info.rx),1.4,1.4);});
  draw('Blender_BarbedWireFence_1',sections('wire',8),{bark:'#6a5a4a',stone:'#4e5848',accent:'#8a8a8a'},true,(s,info)=>{q.setFromAxisAngle(up,s.rot+Math.PI/2);pos.set(s.x,s.y,s.z);sc.set(s.len/(2*info.rx),1.2,1.2);});
  const props=w.storyProps||[],at=(h)=>(s)=>{q.setFromAxisAngle(up,s.rot||0);pos.set(s.x,w.height(s.x,s.z)-.05,s.z);sc.setScalar(h*(s.size||1));};
  // Iteration 7: 1.3 m was a speck from the tee; a Dell's stone is there to be seen.
  draw('Blender_StandingStone_1',props.filter(p=>p.kind==='aimstone'),{stone:'#f7f5ee'},true,at(2.4));
  // The plains' shelterbelt behind the farmstead, 12 m tall (story.js).
  draw('Blender_Shelterbelt_1',props.filter(p=>p.kind==='shelterbelt'),{accent:'#436a36',bark:'#5e564c',leaf:'#4f7a36'},true,at(12));
  // The North Woods' dock, 12 m long on its posts (story.js), at the water's level.
  draw('Blender_Dock_1',props.filter(p=>p.kind==='dock'),{bark:'#8a7a62',stone:'#3a3a3a',accent:'#b04a2e'},true,(s)=>{q.setFromAxisAngle(up,s.rot||0);pos.set(s.x,w.height(s.x-Math.sin(s.rot)*6,s.z-Math.cos(s.rot)*6)-.3,s.z);sc.setScalar(2.65);});
  // THE STREETS KIT (roads.js streetFurniture; tools/blender/cartoon_streets.py),
  // each at its real height: decoration on the lot and along the drive.
  const sp=w.streetProps||[],kit=(kind,model,h,colours,inked)=>draw(model,sp.filter(p=>p.kind===kind),colours,inked,at(h));
  kit('lightpole','Blender_LightPole_1',9.2,{bark:'#3a342e',stone:'#c8c4b8',accent:'#f4f0dc'},true);
  kit('wheelstop','Blender_WheelStop_1',.15,{stone:'#c8c4b8',accent:'#e8c030'},false);
  kit('island','Blender_ParkingIsland_1',.2,{stone:'#c8c4b8',bark:'#5a3e2a',leaf:'#4f7436'},false);
  kit('bagdrop','Blender_BagDrop_1',5.3,{stone:'#ece6d8',bark:'#5e6266',leaf:'#4a3426',accent:'#b8302a'},true);
  kit('streetlight','Blender_StreetLight_1',5,{bark:'#2a2a2a',accent:'#f2e6bc'},true);
  // A MAILBOX AT EACH HOUSE'S DRIVE (the streets kit, PLAN 4; roads.js
  // mailboxAt): on the street's verge beside the house's lane. Drawing only;
  // nothing a ball meets. 1.2 m on its post.
  const boxes=(w.homes||[]).filter(h=>h.garage).map(mailboxAt);
  draw('Blender_Mailbox_1',boxes,{bark:'#4a3a2e',stone:'#2e3438',accent:'#c8302a',leaf:'#2e3438'},true,at(1.2));
  // The Heartland's corn behind its red barn (story.js), 2.4 m standing.
  draw('Blender_CornPatch_1',props.filter(p=>p.kind==='corn'),{leaf:'#4f8a34',accent:'#d8c070'},false,at(2.4));
  // A Restored course's felled avenue (phase 6's history): the shipped stumps.
  draw('Blender_Stump_1',props.filter(p=>p.kind==='stump'),{bark:'#6b5440',leaf:'#8a6e52',stone:'#8a6e52',dirt:'#4a3a2e',accent:'#c9a77c'},true,at(.7));
 }
 // LIFE ON AN ARCHITECT COURSE (phase 6; life.js, tools/blender/architect_life.py):
 // grazers turning slowly where they stand and birds circling (the walkers
 // and the mower went on 2 November 2026: the owner). One instanced mesh per model
 // part, their matrices rewritten thirty times a second; the group is hidden
 // on Low (the frame loop). Decoration: nothing here is solid.
 addLife(w){
  if(!w?.life?.length||this.style!=='cartoon')return null;
  // Iteration 4: drawn a quarter to a half larger than life, a cartoon's
  // exaggeration (at true size a sheep was a dot in the marram at 22 m).
  const SPEC={
   sheep:{model:'Blender_Sheep_1',h:1.15,colours:{stone:'#f4f1e8',dirt:'#2e2a2a'}},
   // Iteration 8: a lighter body (it read as a dark lump on the bank).
   goose:{model:'Blender_Goose_1',h:1.0,colours:{stone:'#b9ad9a',bark:'#2b2a28',accent:'#f7f3ea'}},
   deer:{model:'Blender_Deer_1',h:1.8,colours:{stone:'#a2724a',dirt:'#2e2622',accent:'#efe6d6'}},
   elk:{model:'Blender_Elk_1',h:3.0,colours:{stone:'#9a7350',dirt:'#4a3a2e',accent:'#d9c9a8',bark:'#4f3a2a'}},
   // The Badlands' bison (cartoon_badlands.py): to 1.86 m at the shoulder, the hump above it.
   bison:{model:'Blender_Bison_1',h:2.0,colours:{stone:'#5a3e28',bark:'#3a2a1e',dirt:'#1e1a16',accent:'#3a2a1e'}},
   heron:{model:'Blender_Heron_1',h:1.35,colours:{stone:'#a9b0b6',bark:'#3b3f45',dirt:'#5b5248',accent:'#e5b54a'}},
   roadrunner:{model:'Blender_Roadrunner_1',h:.7,colours:{stone:'#8a7a62',bark:'#3a332c',dirt:'#2a2522',accent:'#5a6a8a'}},
   gull:{model:'Blender_Bird_1',h:.42,colours:{stone:'#f6f6f2',bark:'#3a3d42',accent:'#e5b54a'}},
   raven:{model:'Blender_Bird_1',h:.45,colours:{stone:'#24242c',bark:'#141418',accent:'#2a2a30'}},
  };
  const group=new T.Group();group.name='Life';this.group.add(group);
  const sets=[];
  const jobs=[];
  for(const [kind,spec] of Object.entries(SPEC)){const list=w.life.filter(l=>l.kind===kind);if(list.length)jobs.push({kind,spec,list});}
  for(const {kind,spec,list} of jobs){
   if(!list.length)continue;
   const parts=modelParts(spec.model);if(!parts)continue;
   const meshes=parts.map(p=>{const mat=this.surfaceMaterial(spec.colours[p.role]??'#ffffff',{vertexColors:p.painted}),m=new T.InstancedMesh(p.geometry,mat,list.length);m.castShadow=kind!=='gull'&&kind!=='raven';m.receiveShadow=true;m.frustumCulled=false;// They move, so the instance cull must leave them alone (PROJECT_HANDOFF
    // *ANYTHING INSTANCED THAT MOVES MUST SET userData.noCull*).
    m.userData.noCull=true;group.add(m);this.resources.push(mat);return m;});
   sets.push({spec,list,meshes});
  }
  const m4=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),pos=new T.Vector3(),sc=new T.Vector3();
  const place=t=>{for(const set of sets){set.list.forEach((l,i)=>{
   if(l.r!==undefined){
    // Circling, banked into the turn.
    const g=Math.sign(l.speed)||1,a=l.phase+t*l.speed,x=l.x+Math.cos(a)*l.r,z=l.z+Math.sin(a)*l.r;
    pos.set(x,w.height(x,z)+l.up,z);e.set(0,Math.atan2(-Math.sin(a)*g,Math.cos(a)*g),-.35*g);
   }else{
    // Grazing: a slow turn where it stands.
    pos.set(l.x,w.height(l.x,l.z),l.z);e.set(0,l.rot+Math.sin(t*.3+l.phase)*.35,0);
   }
   q.setFromEuler(e);sc.setScalar(set.spec.h);m4.compose(pos,q,sc);for(const m of set.meshes)m.setMatrixAt(i,m4);
  });for(const m of set.meshes)m.instanceMatrix.needsUpdate=true;}};
  place(0);
  let since=0;
  return {group,update(dt,t){since+=dt;if(since<1/30)return;since=0;place(t);}};
 }
 // WEAR (architect-courses, phase 3; markings.js placeWear): divots on the
 // tees and in the landing zones, one instanced mesh of small flat patches a
 // hair above the ground, the soil showing through. Decoration.
 addWear(w){
  if(!w?.wear?.length)return;
  const g=new T.CircleGeometry(1,7);g.rotateX(-Math.PI/2);
  const mat=this.surfaceMaterial('#6a5638',{polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const mesh=new T.InstancedMesh(g,mat,w.wear.length),m4=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0),pos=new T.Vector3(),sc=new T.Vector3();
  w.wear.forEach((d,i)=>{q.setFromAxisAngle(up,d.rot);pos.set(d.x,w.height(d.x,d.z)+.025,d.z);sc.set(d.r*1.7,1,d.r);mesh.setMatrixAt(i,m4.compose(pos,q,sc));});
  mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  this.group.add(mesh);this.resources.push(g,mat);
 }
 addHoleDetails(h){
  const group=this.group;
  // Kept so the range's green can be moved without rebuilding the world. Every
  // one of these was positioned in WORLD coordinates, and the flagstick's
  // two parts live in an assembly whose own y is driven by the hole-out lift
  // animation -- so they are moved individually rather than by shifting a parent.
  if(h.greens)this.addRangeGreens(h);
  else{const flag=PIN_FLAGS[pinBandOf(h)],props=this.addCupAndFlag(h.worldPin,h.height(h.pin.x,h.pin.z),{number:h.hole+1,color:flag.cloth,ink:flag.ink});this.flagsticks[h.hole]=props.assembly;this.greenProps[h.hole]=props;}
  // Markers straddle the line of play, which runs to the middle of the fairway
  // where the fairway begins -- not to the pin. On a dogleg the two differ by
  // more than ten degrees, so markers squared to the green aim at trees.
  const teeList=Object.entries(h.tees);
  teeList.forEach(([name,t],k)=>{
   const target=teeAim(h,t);
   const dx=target.x-t.x,dz=target.z-t.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
   // ON THE TEE, SIX INCHES IN FROM ITS EDGE.
   //
   // They stood at 4 m either side of a pad whose half-width is 3, so both
   // markers of every tee on the course were a METRE off the mown surface they
   // mark, sitting in the collar. The pair now straddles the pad the way a real
   // set does: in from each edge by `TEE_MARKER_INSET`, which is six inches.
   //
   // SETS SHARING A TEE (a built course: one box for blue and white, or a
   // hole with fewer boxes than the course has sets) stand side by side, each
   // pair 40 cm inside the one before, not all on one spot (PLACED).
   const shared=teeList.slice(0,k).filter(([,u])=>Math.abs(u.x-t.x)<.01&&Math.abs(u.z-t.z)<.01).length;
   const inset=Math.max(.3,TEE_PAD.x-TEE_MARKER_INSET-shared*.4);
   for(const sideSign of [-1,1]){
    // Perpendicular to the line of play, set a metre back from the tee centre.
    // ON A BUILT TEE, INSIDE ITS BOX (the owner, 10 November 2026: "Our tee
    // markers need to stay inside the teebox on built courses"): a traced box
    // can be narrower or shorter than the generated pad, so the marker comes
    // in, 10 cm at a time, until it stands six inches inside the box's edge
    // -- and forward to the tee mark itself if a metre back is off the box.
    let side=sideSign*inset,back=1;
    const at=()=>({x:t.x+uz*side-ux*back,z:t.z-ux*side-uz*back});
    if(h.onTee){
     const ok=()=>{const p=at();return h.onTee(p.x,p.z,TEE_MARKER_INSET);};
     if(!h.onTee(t.x-ux,t.z-uz,TEE_MARKER_INSET))back=0;
     while(!ok()&&Math.abs(side)>.3)side-=sideSign*.1;
    }
    const {x,z}=at(),q=h.toWorld({x,z});
    // A moulded marker, a squat dome on a collar 11 cm tall (the furniture);
    // a ball on the turf where the build has none.
    const made=this.furniture('Blender_TeeMarker_1',.11,{accent:TEE_COLOURS[name],bark:'#4f4a44'},{batch:true});
    const marker=made??new T.Mesh(new T.SphereGeometry(.085,12,8),this.surfaceMaterial(TEE_COLOURS[name]));
    marker.position.set(q.x,h.height(x,z)+(made?0:.085),q.z);group.add(marker);
   }
  });
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
   // The furniture's sign: two timber posts and a gable cap round the board,
   // the hole's card on a face 5 cm in front of it (cartoon_course.py says
   // where the board is). The old box-on-a-post where the build has none.
   const frame=this.furniture('Blender_TeeSign_1',2.52,{bark:'#7a5f45',stone:'#203f30',accent:'#8a4b3a'},{batch:true});
   const sign=frame??new T.Mesh(new T.BoxGeometry(1.0,1.25,.12),this.surfaceMaterial('#ffffff',{map:tex,roughness:.8}));
   if(frame){const face=new T.Mesh(new T.PlaneGeometry(1.0/2.52,1.25/2.52),this.surfaceMaterial('#ffffff',{map:tex}));face.position.set(0,1.55/2.52,.05/2.52);frame.add(face);}
   sign.position.set(q.x,ground+(frame?0:1.55),q.z);
   // Facing the tee it belongs to, so it is read from where you stand rather
   // than from behind. The box is thin in Z, so its face points along the
   // rotated +Z and the bearing is measured in world space -- the pad is
   // squared to the shot, which is not the hole's own rotation.
   const bw=h.toWorld(backTee);
   sign.rotation.y=Math.atan2(bw.x-q.x,bw.z-q.z);
   group.add(sign);
   if(!frame){const post=new T.Mesh(new T.CylinderGeometry(.08,.09,1.1,8),this.surfaceMaterial('#645340'));
    post.position.set(q.x,ground+.5,q.z);group.add(post);}
   // A bench a little further out, facing the tee, and a ball washer just
   // ahead of the sign -- decoration, nothing a ball hits (the sign never was).
   const put=(m,along,out)=>{if(!m)return;const ax=lx+bux*along+buz*out,az=lz+buz*along-bux*out,w=h.toWorld({x:ax,z:az});
    m.position.set(w.x,h.height(ax,az),w.z);m.rotation.y=Math.atan2(bw.x-w.x,bw.z-w.z);group.add(m);};
   put(this.furniture('Blender_Bench_1',.9,{bark:'#6b5440',accent:'#a5825b'},{batch:true}),-2.2,-1.6);
   put(this.furniture('Blender_BallWasher_1',1.27,{bark:'#4a4640',accent:'#2f6a4a',stone:'#efe9d8'},{batch:true}),1.6,-.2);
  }
 }
 // Move the range's green, without rebuilding anything.
 //
 // THE RANGE'S GREENS: a flag and a cup on each, and the targets' signs.
 //
 // Every green is a real green (range.js): the ground shader paints it from the
 // cup atlas and the ball reads it from the same list. What is drawn here is
 // the furniture -- a flagstick in each cup, taller and in its own colour on a
 // target so it can be picked out from the mats; a painted ring in that colour
 // just outside the target's fringe, so the colour still says the number at a
 // glance; and the sign behind it. A target the centre green is standing on is
 // hidden, furniture and all (refreshRangeGreens).
 addRangeGreens(h){
  this.rangeProps={};
  for(const g of h.greens){
   const w=h.toWorld(g.pin),y=h.height(g.pin.x,g.pin.z);
   const target=g.kind==='target';
   const props=this.addCupAndFlag(w,y,target?{color:g.color,tall:1.7,cloth:2.2}:{});
   props.extra=target?this.addTargetFurniture(h,g):[];
   this.rangeProps[g.id]=props;
  }
  this.refreshRangeGreens();
 }
 addTargetFurniture(h,g){
  const group=this.group,parts=[],c=h.toWorld(g.green),y=h.height(g.green.x,g.green.z);
  // The ring sits a stride outside the fringe, on mown turf, laid 2 cm proud and
  // told to lose depth ties, because the field is dead flat: a ring exactly
  // coplanar with the ground z-fights across its whole face.
  const offset={polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
  const inner=g.greenSize*(1+g.greenWave3+g.greenWave5)+(h.settings.fringe??2)+.8;
  const ring=new T.Mesh(new T.RingGeometry(inner,inner+.9,72),this.surfaceMaterial(g.color,{roughness:.9,...offset}));
  ring.rotation.x=-Math.PI/2;ring.position.set(c.x,y+.025,c.z);group.add(ring);parts.push(ring);
  // The sign stands BEHIND its target, square to the mats. Beside it would put
  // it off the mown field on the outer targets; behind keeps every sign on the
  // one sight line a player actually uses.
  //
  // It grows with distance. A fixed-size board legible at 50 yd is unreadable
  // at 300, and every one of these is read from the same spot, so holding the
  // ANGULAR size roughly even is the honest choice rather than a perspective
  // trick -- real ranges make their far boards bigger for the same reason.
  const height=Math.min(7,Math.max(3,2.2+g.yards*.014)),width=height*1.55;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=330;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#16241b';ctx.fillRect(0,0,512,330);
  ctx.strokeStyle=g.color;ctx.lineWidth=14;ctx.strokeRect(18,18,476,294);
  ctx.textAlign='center';
  ctx.fillStyle=g.color;ctx.font='bold 210px '+UI_FONT;ctx.fillText(String(g.yards),256,228);
  ctx.fillStyle='#dfe7d6';ctx.font='54px '+UI_FONT;ctx.fillText('YARDS',256,292);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;this.resources.push(tex);
  const board=new T.Mesh(new T.BoxGeometry(width,height,.28),this.surfaceMaterial('#ffffff',{map:tex,roughness:.85}));
  // Behind the green along the line FROM THE MAT, now that the targets are
  // turned off the centre line rather than pushed sideways.
  const d=Math.hypot(g.green.x,g.green.z)||1,back=inner+4,sx=g.green.x+g.green.x/d*back,sz=g.green.z+g.green.z/d*back;
  const sw=h.toWorld({x:sx,z:sz}),sy=h.height(sx,sz);
  board.position.set(sw.x,sy+1.5+height/2,sw.z);
  // Facing the mats: the box carries one material, so the far side shows the
  // number mirrored, and the mapped face looks back down the line to the mat.
  const mat=h.toWorld({x:0,z:0});
  board.rotation.y=Math.atan2(mat.x-sw.x,mat.z-sw.z);
  board.castShadow=true;group.add(board);parts.push(board);
  for(const side of [-1,1]){
   const post=new T.Mesh(new T.CylinderGeometry(.11,.13,1.5+height/2,8),this.surfaceMaterial('#645340'));
   const ux=g.green.z/d,uz=-g.green.x/d,px=sx+ux*side*width*.32,pz=sz+uz*side*width*.32,pw=h.toWorld({x:px,z:pz});
   post.position.set(pw.x,sy+(1.5+height/2)/2,pw.z);post.castShadow=true;group.add(post);parts.push(post);
  }
  return parts;
 }
 // After anything on the range moves -- the centre green slid, a cup recut, the
 // green being played to changed -- the atlas, every green's flag and cup, which
 // targets are showing, and which flagstick is the live one. Cheap because the
 // ground itself does not change: a green with slope set up is regrown by
 // main.js instead (a contoured green cannot be slid).
 refreshRangeGreens(){
  const h=this.world.holes[0];
  if(!h?.greens||!this.rangeProps)return;
  const data=this.holeAtlas?.image?.data;
  if(data){
   const W=HOLE_ATLAS.width;
   writeRangeGreens(h,(col,v)=>data.set(v,(h.hole*W+col)*4),{cups:HOLE_ATLAS.cups,greens:HOLE_ATLAS.greens,max:RANGE_GREENS});
   this.syncHoleTable?.(h.hole);
  }
  const live=activeGreen(h),others=[];
  for(const g of h.greens){
   const props=this.rangeProps[g.id];if(!props)continue;
   const p=h.toWorld(g.pin),y=h.height(g.pin.x,g.pin.z),show=!g.hidden;
   props.assembly.userData.base={x:p.x,y,z:p.z};
   props.cup.position.set(p.x,y-.0575,p.z);
   props.liner.position.set(p.x,y-.0254-.0448,p.z);
   props.floor.position.set(p.x,y-.115,p.z);
   for(const o of [props.assembly,props.cup,props.liner,props.floor,...props.extra])o.visible=show;
   // Only the stick in the live cup is ever lifted (liftFlag reads this.flagsticks[0]).
   if(g!==live){props.assembly.userData.lift=false;others.push(props.assembly);}
  }
  const mine=this.rangeProps[live?.id];
  // The live stick is the hole's own (index 0, which liftFlag and the frame loop
  // read); the rest ride after it so they sway and hold their scale too.
  this.flagsticks=[mine?.assembly,...others].filter(Boolean);
  this.greenProps[h.hole]=mine;
  // Built against the old green, so it has to go; the next read builds anew.
  if(this.greenGrid){this.group.remove(this.greenGrid);this.greenGrid.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.greenGrid=null;this.reading=null;}
 }
 // Kept under its old name for the callers that move the centre green.
 setRangeGreen(){this.refreshRangeGreens();}
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
  this.floodLamps=Array.from({length:Math.min(poles.length,lampBudget(this.renderer?.capabilities?.maxFragmentUniforms))},(_,i)=>{
   const lamp=new T.SpotLight('#fff4d2',0,POLE_REACH*2,FLOOD_CONE,.55,2);
   lamp.visible=false;lamp.intensity=0;
   lamp.castShadow=i<casters;
   // Set up on every lamp, casting or not, so the switch can hand shadows to a
   // lamp later without the rig being rebuilt. A map is only allocated by
   // three once the lamp casts. Never redrawn on their own (autoUpdate): see
   // FLOOD_SHADOW_EVERY and the frame loop.
   lamp.shadow.mapSize.set(FLOOD_SHADOW_SIZE,FLOOD_SHADOW_SIZE);
   lamp.shadow.bias=this.quality.shadowBias.constant;
   lamp.shadow.normalBias=this.quality.shadowBias.flood??this.quality.shadowBias.normal;
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
  // Every pole is lit while the card's shaders can hold them (lampBudget, at
  // most 96): a nine takes 57, so all of it; an eighteen takes 98 to 141, so the
  // nearest 96 follow the ball. Measured on a night course, four live lights
  // and all of them cost the same, 8.5 ms median, because none casts a shadow;
  // the limit is room in the shader, not time.
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
 setHole(index,instant=false){this.flownHole=undefined;this.registerCascadeMaterials();
  // Warmed again per hole, not only per course: the flag, the cup, the rings
  // and the ball's own materials are per-hole objects, and a first compile of
  // any of them lands mid-shot. Compiling an already-compiled scene is a cache
  // lookup, so the repeat costs nothing.
  if(this.warmedHole!==index){this.warmedHole=index;queueMicrotask(()=>this.warmUp(0));}
for(const flag of this.flagsticks||[]){flag.userData.lift=false;flag.position.y=0;flag.visible=true;}this.course=this.world.holes[index];if(this.rangeProps)this.refreshRangeGreens();this.readingHeading=null;this.setBall(this.course.tee);this.setAim(0,180);this.setTrail([]);this.setCamera(this.course.tee,0,instant);this.setGreenGrid(this.config.greenGrid);}
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
 // The player's switch (graphics.distantFlags, OFF by default). Off, every
 // flagstick is drawn exactly to size from anywhere -- the stick is then lost
 // at long range, which is the player's choice to make. Read every frame, so
 // it takes effect on the next one.
 setDistantFlags(on){this.distantFlags=!!on;}
 // See FLAG_MIN_PX. A few multiplies per hole per frame; nothing is rebuilt.
 holdFlagsticks(){
  const cam=this.camera,px=Math.max(1,this.cssSize().h)/(2*Math.tan(cam.fov*Math.PI/360)),grow=this.distantFlags===true;
  // The cloth flies downwind (the cartoon overhaul's flag, round 3): it used to
  // stand out along +x whatever the wind, so a player reading the flag read
  // nothing. `windDirection` is the bearing the wind blows toward.
  const wa=(this.world?.settings.windDirection||0)*Math.PI/180,wx=Math.sin(wa),wz=Math.cos(wa),turn=wa-Math.PI/2;
  for(const a of this.flagsticks||[]){
   const b=a?.userData.base;if(!b||!a.visible)continue;
   const d=Math.max(1,Math.hypot(cam.position.x-b.x,cam.position.y-b.y-1,cam.position.z-b.z)),perMetre=px/d;
   const s=grow?clamp(FLAG_MIN_PX/(FLAGSTICK_HEIGHT*perMetre),1,FLAG_MAX_SCALE):1;
   const cloth=grow?Math.max(s,Math.min(FLAG_CLOTH_PX/(.48*perMetre),s*1.8)):1;
   const thick=grow?Math.max(s,POLE_MIN_PX/(2*FLAGSTICK_BASE_R*perMetre)):1;
   const {pole,cloth:f}=a.userData,k=a.userData.tall??1,cs=cloth*(a.userData.clothScale??1);
   pole.scale.set(thick*k,s*k,thick*k);pole.position.set(b.x,b.y+FLAGSTICK_HEIGHT*s*k/2,b.z);
   // The cloth's top stays at the top of the stick, its edge against the pole.
   const off=.24*cs+FLAGSTICK_TOP_R*(thick*k-1);
   f.scale.setScalar(cs);f.rotation.y=turn;f.position.set(b.x+off*wx,b.y+FLAGSTICK_HEIGHT*s*k-.165*cs,b.z+off*wz);
  }
 }
 liftFlag(){if(this.flagsticks[this.course.hole])this.flagsticks[this.course.hole].userData.lift=true;}
 // Back into the hole for the next putt (the attended pin: main.js).
 lowerFlag(){if(this.flagsticks?.[this.course?.hole])this.flagsticks[this.course.hole].userData.lift=false;}
 // THE PIN IS PULLED ONCE YOU ARE PUTTING, which is what happens on a real
 // green and takes the one object standing between the ball and the cup out
 // of the read. The cup, its liner and the floor are separate objects and
 // stay: it is the flagstick that goes, not the hole.
 // THE PIN STAYS IN WHILE YOU PUTT (the owner, 15 October 2026): it stood out
 // of sight the moment the ball was on the green. Now it stands in the cup and
 // is lifted as the ball comes near (main.js PIN_ATTEND_M). The physics have
 // always played a putt with the pin out, so nothing about the roll changes.
 setPinOut(){const a=this.flagsticks?.[this.course.hole];if(a)a.visible=true;}
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
  this.putting=config;if(this.puttingRings){this.group.remove(this.puttingRings);this.puttingRings.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}this.puttingRings=new T.Group();this.group.add(this.puttingRings);if(!config)return;
  // The rings come from putting.js: three for dartboard and decimal, one for the
  // gimme circle, none for hole out.
  const h=this.course;puttingRings(config).forEach(({radius,colour})=>{const points=[];for(let j=0;j<256;j++){const a=j/256*TAU,b=(j+1)/256*TAU,pts=[a,b].map(t=>({x:h.pin.x+Math.cos(t)*radius,z:h.pin.z+Math.sin(t)*radius}));if(pts.some(p=>h.surface(p.x,p.z)!=='green'))continue;for(const p of pts){const w=h.toWorld(p);points.push(new T.Vector3(w.x,h.height(p.x,p.z)+.025,w.z));}}const line=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:colour,transparent:true,opacity:.85,depthWrite:false}));this.puttingRings.add(line);});
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
 // `lift` is 15 mm for a putt (main.js), which lies on the green like the
 // putt preview line it replaced; a full shot's line clears the ground at 100.
 setAim(degrees,distance,lift=.10){
  const start=this.localBall||this.course.tee,steps=Math.max(60,Math.ceil(distance/.75));
  const flat=this.aimScratch(steps+1);
  for(let i=0;i<=steps;i++){
   const p=aimTarget(start,degrees,distance*i/steps),v=this.course.toWorld(p),at=i*3;
   flat[at]=v.x;flat[at+1]=this.course.height(p.x,p.z)+lift;flat[at+2]=v.z;
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
 //
 // `lift` is 100 mm for a full shot drawn curved (the Swing Meter's draw and
 // fade, main.js `shapeTrack`), for the same reason the straight aim line is.
 setAimPath(points,distance,lift=.015){
  if(points.length<2)return;
  // Same line, so it writes the same way: two writers replacing and rewriting the
  // one geometry would undo each other's buffer every time the club changed.
  const flat=this.aimScratch(points.length);
  points.forEach((q,i)=>{
   const v=this.course.toWorld(q),at=i*3;
   flat[at]=v.x;flat[at+1]=this.course.height(q.x,q.z)+lift;flat[at+2]=v.z;
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
 //
 // THE STYLE (Phase 5, rewards.js TRACERS) is the active golfer's, put on by
 // setTracer before the shot: its colours along the line, a head, a core, a
 // dash, a zigzag, a flicker and glints. Drawn every frame of a flight anyway,
 // so a moving colour or a flicker costs nothing extra.
 // `seat` is kept for a style that asks for it; none does since 15 October 2026.
 setTracer(id,seat){this.tracer={id,style:tracerStyle(id),seat:linear(hexRgb(seat||'#ffe9a2'))};}
 setTrail(points){
  const kept=points.length>1?trimToBall(points):[];
  this.trailHead.visible=this.trailCore.visible=false;
  if(kept.length<2){this.trail.visible=false;this.sparkles.visible=false;this.sparkleList.length=0;this.sparkleAt=null;return;}
  const tr=this.tracer||{style:tracerStyle('classic'),seat:linear(hexRgb('#ffe9a2'))},st=tr.style,now=performance.now()/1000;
  let world=kept.map(p=>{const v=this.course.toWorld(p);return [v.x,p.y,v.z];});
  if(st.jag)world=jagged(world,st.jag,Math.floor(now*14));
  const n=world.length,cols=new Float32Array(n*3),ring=Array.isArray(st.colours)?[...st.colours,st.colours[0]]:null;
  for(let i=0;i<n;i++){
   const t=i/(n-1),c=!ring?tr.seat:linear(st.shift?stopColour(ring,(t+now*st.shift)%1):stopColour(st.colours,t));
   cols[i*3]=c[0];cols[i*3+1]=c[1];cols[i*3+2]=c[2];
  }
  const wave=st.flicker?(Math.sin(now*23)+Math.sin(now*37.3))*.25+.5:0,fade=1-(st.flicker||0)*wave;
  this.trail.material.linewidth=st.width;this.trail.material.opacity=(st.opacity??.95)*fade;
  writeStyled(this.trail,world,cols,st.dash);
  if(st.head){const from=Math.max(0,Math.floor(n*(1-st.head.share))-1);
   if(n-from>1){this.trailHead.material.linewidth=st.head.width;this.trailHead.material.opacity=.95*fade;writeStyled(this.trailHead,world.slice(from),cols.slice(from*3),null);}}
  if(st.core){const c=linear(hexRgb(st.core.colour)),cc=new Float32Array(n*3);for(let i=0;i<n;i++)cc.set(c,i*3);
   this.trailCore.material.linewidth=st.core.width;this.trailCore.material.opacity=fade;writeStyled(this.trailCore,world,cc,st.dash);}
  this.updateSparkles(st.sparkle,world[n-1],now);
 }
 // The glints: born where the ball is while it moves, about `count` alive at
 // once, each twinkling and fading over SPARKLE_LIFE seconds and, for
 // Starfall, drifting down `fall` metres a second. PLACED.
 updateSparkles(sp,head,now){
  const list=this.sparkleList,LIFE=1.1;
  if(!sp){this.sparkles.visible=false;list.length=0;this.sparkleAt=null;return;}
  const dt=Math.min(.1,Math.max(0,now-(this.sparkleAt??now)));this.sparkleAt=now;
  const moved=this.sparkleHead?Math.hypot(head[0]-this.sparkleHead[0],head[1]-this.sparkleHead[1],head[2]-this.sparkleHead[2]):0;
  this.sparkleHead=head;
  if(moved>.02){this.sparkleOwed=(this.sparkleOwed||0)+dt*sp.count/LIFE;
   while(this.sparkleOwed>=1){this.sparkleOwed--;const r=()=>Math.random()-.5;list.push({x:head[0]+r()*.8,y:head[1]+r()*.8,z:head[2]+r()*.8,born:now,tw:Math.random()*6.3});}}
  while(list.length&&(now-list[0].born>LIFE||list.length>Math.min(64,sp.count)))list.shift();
  const g=this.sparkles.geometry,pos=g.attributes.position.array,col=g.attributes.color.array,c=linear(hexRgb(sp.colour));
  list.forEach((p,i)=>{const age=now-p.born,k=(1-age/LIFE)*(.55+.45*Math.sin(now*18+p.tw));
   pos[i*3]=p.x;pos[i*3+1]=p.y-(sp.fall||0)*age;pos[i*3+2]=p.z;col[i*3]=c[0]*k;col[i*3+1]=c[1]*k;col[i*3+2]=c[2]*k;});
  g.setDrawRange(0,list.length);g.attributes.position.needsUpdate=g.attributes.color.needsUpdate=true;
  this.sparkles.visible=list.length>0;
 }
 // THE BALL'S FINISH (ball-finishes.js): a texture rewrite. `glow` is a little
 // light of the finish's own colour by day, on top of the night's glow.
 setBallFinish(id){
  if(!this.ballTexture||this.ballFinish===id)return;
  this.ballFinish=id;
  this.ballTexture.image.data.set(finishTexels(id,256,128));this.ballTexture.needsUpdate=true;
  this.ballFinishGlow=finishSurface(id).glow;this.ballFinishColour=new T.Color(...finishAverage(id));
  this.applyBallGlow();
 }
 applyBallGlow(){
  if(!this.ball)return;
  const night=this.ballNightGlow||0,own=this.ballFinishGlow||0;
  this.ball.material.emissive.copy(GLOW_BALL);
  if(own>0)this.ball.material.emissive.lerp(this.ballFinishColour,own/(own+night+1e-6));
  this.ball.material.emissiveIntensity=night+own*.6;
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
    line=new Line2(new LineGeometry(),tracerMaterial(3,.72));
    this.shotLines[i]=line;this.shotGroup.add(line);
   }
   // Lines are POOLED and reused across holes and players, so the colour is set
   // every time rather than only when one is created -- otherwise trail 2 keeps
   // whoever hit trail 2 on the previous hole. In the golfer's own tracer --
   // its colours and its shape, held still: a dash stays a dash and a zigzag a
   // zigzag. (It was the seat colour, per spec 7.4, until the owner asked for
   // the golfer's choice everywhere, 15 October 2026.)
   // `shape` overrides the golfer's style: a friend's challenge draws its
   // shots in one look of its own (main.js `rivalTrails`).
   const shape=trail?.shape||summaryStyle(trail?.style),stops=shape.colours||[SHOT_LINE_COLOR];
   let world=kept.map(p=>{const v=this.course.toWorld(p);return [v.x,p.y,v.z];});
   if(shape.jag)world=jagged(world,shape.jag,i+1);
   const cols=new Float32Array(world.length*3);for(let k=0;k<world.length;k++)cols.set(linear(stopColour(stops,k/Math.max(1,world.length-1))),k*3);
   writeStyled(line,world,cols,shape.dash);
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
 // WHERE A POINT ON THE HOLE IS ON SCREEN, in the canvas's CSS pixels, or null
 // when it is behind the camera: for the 2D flourishes over the cup
 // (flourishes.js). A projection, nothing drawn.
 screenPoint(p){
  const h=this.course;if(!h||!p)return null;
  const w=h.toWorld(p),v=new T.Vector3(w.x,h.height(p.x,p.z),w.z).project(this.camera);
  if(v.z>1||v.z<-1)return null;
  const c=this.cssSize();return {x:(v.x+1)/2*c.w,y:(1-v.y)/2*c.h};
 }
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
  this.camFlight=null;this.tv=null;this.trackingBall=false;this.orbitAt=null;const c=this.config,h=this.course;
  if(c.mode==='free'){if(!this.wasFree){this.targetPos.copy(this.camera.position);this.freeYaw=Math.atan2(this.look.x-this.camera.position.x,this.look.z-this.camera.position.z);this.freePitch=Math.asin(T.MathUtils.clamp((this.look.y-this.camera.position.y)/Math.max(.001,this.look.distanceTo(this.camera.position)),-1,1));this.wasFree=true;}this.updateFreeLook();return;}
  this.wasFree=false;
  if(c.mode==='overview'){this.targetPos.set(-this.world.halfX*.4,Math.max(this.world.halfX/Math.min(1,this.camera.aspect),this.world.halfZ)*2.8,-this.world.halfZ*1.1);this.targetLook.set(0,0,40);}
  else if(c.mode==='green'){const q=h.worldPin;this.aimOrbit({x:q.x,y:h.height(h.pin.x,h.pin.z),z:q.z},{x:28,y:21,z:34});}
  // THE AIM POINT VIEW (G, 10 October 2026): the landing area, looked down on
  // from short of it along the line from the ball, the way GSPro's F3 shows
  // where a shot is going. Placed numbers: 34 m back, 22 m up. With no aim ring
  // drawn (a putt by hand, a hole just finished) there is no point to look at,
  // and it falls back to the view from the ball below.
  else if(c.mode==='target'&&this.aimRing.visible){const a=this.aimRing.position,b=this.ball.position,dx=a.x-b.x,dz=a.z-b.z,l=Math.hypot(dx,dz)||1;this.aimOrbit({x:a.x,y:a.y,z:a.z},{x:-dx/l*34,y:22,z:-dz/l*34});}
  // THE RIG, not the raw config. In simulator mode the height, the setback and
  // the field of view come from the bay's measurements instead of the sliders,
  // and the lateral offset is forced to zero -- a golfer stands behind the ball,
  // not beside it, and "always the same view from behind" is the whole point.
  // ON THE GREEN THE CAMERA BACKS OFF UNTIL THE BALL IS IN FRAME. A putt is aimed
  // from the ball, so the ball has to be on screen; everywhere else it may sit
  // below the bottom edge, which is where it is in the room.
  // An aimed putt off the bay has its own pose (camera.js puttAimPose).
  else{const onGreen=h?.surface?.(p.x,p.z)==='green',rig=onGreen?framedForBall(cameraRig(c)):cameraRig(c);const pose=onGreen&&!c.sim&&h?.pin?puttAimPose(h,p,aim):playerCameraPose(h,p,aim,rig);this.targetPos.set(pose.eye.x,pose.eye.y,pose.eye.z);this.targetLook.set(pose.target.x,pose.target.y,pose.target.z);this.camera.fov=rig.fov;this.lensShift=rig.shift||0;this.screenAspect=rig.aspect||null;}
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
  // Back from the shot review (`from`), straight through the trees.
  this.camFlight={path:makeCameraFlight({eye,look},to,this.world,{hold:opts.hold||0,arrival:!!opts.arrival,throughTrees:!!opts.from}),elapsed:0};
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
  this.flyCamera(p,aim,{from:holeEstablishingPose(this.course),hold,arrival:true});
 }
 cancelFlight(){this.camFlight=null;}
 updateFreeLook(){this.targetLook.copy(this.targetPos).add(new T.Vector3(Math.sin(this.freeYaw)*Math.cos(this.freePitch),Math.sin(this.freePitch),Math.cos(this.freeYaw)*Math.cos(this.freePitch)).multiplyScalar(100));}
 // The green and aim point views stand at an offset from the point they look
 // at, turned by the player's drag (camera.js stepOrbit). `orbitAt` is set only
 // while one of them is the view, so a drag elsewhere finds nothing to turn.
 aimOrbit(look,offset){this.orbitAt={look,offset};const e=orbitEye(look,offset,this.orbit);this.targetPos.set(e.x,e.y,e.z);this.targetLook.set(look.x,look.y,look.z);}
 orbitBy(dx,dy,zoom=1){if(!this.orbitAt)return false;this.orbit=stepOrbit(this.orbit,this.orbitAt.offset,{yaw:-dx*.006,pitch:dy*.004,zoom});const e=orbitEye(this.orbitAt.look,this.orbitAt.offset,this.orbit);this.targetPos.set(e.x,e.y,e.z);return true;}
 resetOrbit(){this.orbit={yaw:0,pitch:0,zoom:1};}
 canOrbit(){return !!this.orbitAt&&['green','target'].includes(this.config.mode)&&!this.camFlight&&!this.tv;}
 rotateFree(dx,dy){this.freeYaw-=dx*.004;this.freePitch=T.MathUtils.clamp(this.freePitch-dy*.003,-1.48,1.48);this.updateFreeLook();}
 moveFree(dt,forward,right,up,fast=false){const speed=this.config.freeSpeed*(fast?3:1)*dt,dir=new T.Vector3(Math.sin(this.freeYaw)*Math.cos(this.freePitch),Math.sin(this.freePitch),Math.cos(this.freeYaw)*Math.cos(this.freePitch));this.targetPos.addScaledVector(dir,forward*speed);this.targetPos.x-=Math.cos(this.freeYaw)*right*speed;this.targetPos.z+=Math.sin(this.freeYaw)*right*speed;this.targetPos.y+=up*speed;this.targetPos.x=T.MathUtils.clamp(this.targetPos.x,-this.world.halfX-400,this.world.halfX+400);this.targetPos.z=T.MathUtils.clamp(this.targetPos.z,-this.world.halfZ-400,this.world.halfZ+400);this.targetPos.y=T.MathUtils.clamp(this.targetPos.y,Math.max(this.world.waterLevel+1,this.world.height(this.targetPos.x,this.targetPos.z)+(this.config.freeFloor??1.2)),1800);this.updateFreeLook();}
 // The free camera put exactly somewhere, for measurements and screenshots that
 // must be taken from the same place every time (lab.camera). Angles in radians.
 placeCamera(eye,yaw,pitch){this.config.mode='free';this.wasFree=true;this.camFlight=null;this.trackingBall=false;this.targetPos.set(eye.x,eye.y,eye.z);this.freeYaw=yaw;this.freePitch=pitch;this.updateFreeLook();this.camera.position.copy(this.targetPos);this.look.copy(this.targetLook);this.camera.lookAt(this.look);}
 // THE GROUND'S SQUARES (ground-lod.js). The ground's vertices once, with the
 // skirts' lowered copies after them; each square's mesh shares them and has
 // its own triangles, made the first time it is drawn.
 buildGroundLodMeshes(grid,terrain){
  const lod=buildGroundLod(grid),pos=terrain.attributes.position.array,nor=terrain.attributes.normal.array,rel=terrain.attributes.localRelief?.array,n=pos.length/3,m=lod.extra.from.length;
  const P=new Float32Array((n+m)*3),N=new Float32Array((n+m)*3),R=rel?new Float32Array(n+m):null;
  P.set(pos);N.set(nor);if(R)R.set(rel);
  for(let k=0;k<m;k++){const v=lod.extra.from[k],o=(n+k)*3;P[o]=pos[v*3];P[o+1]=pos[v*3+1]-lod.extra.drop[k];P[o+2]=pos[v*3+2];N[o]=nor[v*3];N[o+1]=nor[v*3+1];N[o+2]=nor[v*3+2];if(R)R[n+k]=rel[v];}
  const attrs={position:new T.BufferAttribute(P,3),normal:new T.BufferAttribute(N,3)};if(R)attrs.localRelief=new T.BufferAttribute(R,1);
  const group=new T.Group();group.name='Continuous ground';this.group.add(group);
  this.groundLod={lod,grid,attrs,group,meshes:new Map(),shown:new Set(),key:''};
  // Kept for its material, shadow switch and box; its triangles are the
  // squares' now, so its own index goes.
  this.terrain.name='Ground (undrawn)';this.terrain.visible=false;terrain.computeBoundingBox();terrain.setIndex(null);
 }
 groundLodMesh(node,which){
  const G=this.groundLod;let pair=G.meshes.get(node);if(!pair){pair={};G.meshes.set(node,pair);}
  if(pair[which])return pair[which];
  const geometry=new T.BufferGeometry();for(const [name,a] of Object.entries(G.attrs))geometry.setAttribute(name,a);
  geometry.setIndex(new T.BufferAttribute(node[which],1));
  const b=groundNodeBox(G.grid,node),skirt=Math.max(2,node.error*2+2);
  geometry.boundingBox=new T.Box3(new T.Vector3(b.x0,b.y0-skirt,b.z0),new T.Vector3(b.x1,b.y1,b.z1));
  geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new T.Sphere());
  const mesh=new T.Mesh(geometry,this.terrain.material);mesh.receiveShadow=true;mesh.renderOrder=1;mesh.visible=false;mesh.matrixAutoUpdate=false;mesh.name='ground, '+which;
  G.group.add(mesh);pair[which]=mesh;return mesh;
 }
 // Every frame: the squares for this camera, each drawn no coarser than
 // the tier's tolerance in pixels allows (graphics.js `groundTolerance`).
 updateGroundLod(){
  const G=this.groundLod;if(!G)return;
  const c=this.camera.position,h=this.renderer.domElement.height||1,tol=this.quality.groundTolerance??1;
  const key=`${Math.round(c.x*2)},${Math.round(c.y*2)},${Math.round(c.z*2)},${this.camera.fov},${h},${tol}`;
  if(key!==G.key){
   G.key=key;
   const focal=h/(2*Math.tan(T.MathUtils.degToRad(this.camera.fov)/2)),want=new Set();
   for(const {node,fine,mid} of selectGround(G.lod,G.grid,c,focal,tol))want.add(this.groundLodMesh(node,fine?'fine':mid?'mid':'coarse'));
   for(const m of G.shown)if(!want.has(m))m.visible=false;
   for(const m of want)m.visible=true;
   G.shown=want;
  }
  const cast=this.terrain.castShadow;for(const m of G.shown)m.castShadow=cast;
 }
 // LOW'S TREES (low-trees.js; the owner, 9 November 2026): the hole being
 // played -- in free flight the hole last flown to, if any -- the ball, and
 // whether the camera is flying. The hole's line is sampled once per hole.
 lowTreeRegion(){const flying=this.config.mode==='free',hole=flying&&this.flownHole!==undefined?this.world?.holes[this.flownHole]:this.course;
  if(this.lowPathOf!==hole){this.lowPathOf=hole;this.lowPath=holePath(hole);}
  return {path:this.lowPath,ball:this.ball?.visible!==false&&this.ball?{x:this.ball.position.x,z:this.ball.position.z}:null,flying};}
 flyToHole(index){this.flownHole=index;const h=this.world.holes[index],p=h.toWorld({x:36,z:h.length-45});this.config.mode='free';this.wasFree=true;this.targetPos.set(p.x,h.height(36,h.length-45)+38,p.z);this.freeYaw=Math.atan2(h.worldPin.x-p.x,h.worldPin.z-p.z);this.freePitch=-.48;this.updateFreeLook();this.camera.position.copy(this.targetPos);this.look.copy(this.targetLook);this.camera.lookAt(this.trackingBall?this.targetLook:this.look);}
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
  this.ballNightGlow=glow*1.76*strength;this.applyBallGlow();
  this.ballLightPower=glow*2.08*strength;this.ballLight.intensity=this.ball.visible?this.ballLightPower:0;
  this.ballHalo.visible=glow*strength>.01;
  this.ballHalo.material.opacity=Math.min(1,glow*.4*strength);
  // The ring and the trail are unlit materials, so nothing else would ever dim
  // them; left alone they stay daylight-bright against a dark course.
  this.ballRing.material.color.copy(this.ringBase).lerp(GLOW_BALL,glow);
  this.trail.material.color.copy(this.trailBase).lerp(GLOW_BALL,glow);
  this.trailHead.material.color.copy(this.trail.material.color);this.trailCore.material.color.copy(this.trail.material.color);
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
  // A landscape's own exposure (biomes.js light) is a daylight setting: the
  // night keeps the one exposure every landscape is read by.
  this.renderer.toneMappingExposure=(1+(this.baseExposure-1)*solar.dayness)*solar.exposureScale;
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
   // From a sun twelve degrees up to six under the horizon, strongest at it.
   u.afterglow.value=T.MathUtils.smoothstep(solar.elevation,-6,-.5)*(1-T.MathUtils.smoothstep(solar.elevation,1,12));
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
   // Round 4 of the overhaul's lighting: by day only. At night the lift made
   // the mist on the far hills brighter than the sky above them -- a pale band
   // round the horizon that read as snow.
   u.mistColor.value.copy(this.scene.fog.color).lerp(WHITE,.05+.17*solar.dayness);
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
   // A built course on high ground with no sea has none of that near its
   // ground: its haze and hollows start from the land (built-world.js skyBaseOf).
   u.mistBase.value=this.world.bio.sea?this.world.waterLevel:this.world.skyBase??this.world.waterLevel;
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
  this.camFlight=null;this.tv=null;
  const pose=followPose(this.course,p,aim,putting);this.targetPos.set(pose.eye.x,pose.eye.y,pose.eye.z);this.targetLook.set(pose.target.x,pose.target.y,pose.target.z);this.trackingBall=true;}

 // THE TELEVISION CAMERA (tv-camera.js). tvShot starts a shot from wherever
 // the camera stands -- the player's view, which is the tee camera -- with the
 // plan worked out at the strike; tvFollow runs every frame of the flight,
 // turning the tee camera to keep the ball in frame and, at the plan's moment,
 // CUTTING to the landing camera, which then follows the ball the same way.
 // A cut is a cut: no flight between the two, as on television.
 tvShot(plan){this.camFlight=null;this.tv={plan,cut:false,tee:this.camera.position.clone()};}
 tvFollow(p,t){
  const tv=this.tv;if(!tv)return;
  const b=this.course.toWorld(p),ball=new T.Vector3(b.x,p.y,b.z);
  if(!tv.cut&&tv.plan?.landEye&&t>=tv.plan.cutAt){tv.cut=true;const e=tv.plan.landEye;this.camera.position.set(e.x,e.y,e.z);this.look.copy(ball);}
  // SWINGING IN BEHIND THE BALL (owner, 11 October 2026). A chip has no landing
  // camera, and a camera that only turned left it sitting at the tee: it now
  // eases in behind the ball over the first 0.8 s and follows it. A long shot's
  // landing camera does the same over 2.2 s once the ball is down, so the
  // roll-out is watched from behind, toward where it will finish. 12-14 m back
  // and 4-5 m up; all placed.
  const d=tv.plan?.dir,smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  const behind=(back,up)=>({x:ball.x-d.x*back,y:ball.y+up,z:ball.z-d.z*back});
  const mix=(a,b,f)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f});
  const eye=!d?(tv.cut?tv.plan.landEye:tv.tee)
   :!tv.plan.landEye?mix(tv.tee,behind(12,4),smooth(t/.8))
   :tv.cut?mix(tv.plan.landEye,behind(14,5),smooth((t-tv.plan.hang)/2.2)):tv.tee;
  this.targetPos.set(eye.x,eye.y,eye.z);this.targetLook.copy(ball);this.trackingBall=true;
 }
 // The whole shot, once the ball has stopped: flown to, not cut to, and held.
 tvReview(pose){
  this.tv=null;this.trackingBall=false;
  const to={eye:new T.Vector3(pose.eye.x,pose.eye.y,pose.eye.z),look:new T.Vector3(pose.look.x,pose.look.y,pose.look.z)};
  this.camFlight={path:makeCameraFlight({eye:this.camera.position.clone(),look:this.look.clone()},to,this.world,{throughTrees:true}),elapsed:0};
 }

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
  // No clouds in the overview: it stands above them, and they hid the course.
  if(this.clouds){this.clouds.group.visible=this.config.mode!=='overview';this.clouds.update(dt);}
  this.updateDaylight(dt);
  // The ball's light is the ball's neighbour, not its child (see its note in
  // `build`): it follows, and is dark while the ball is hidden.
  if(this.ballLight){this.ballLight.position.copy(this.ball.position);this.ballLight.intensity=this.ball.visible?this.ballLightPower:0;}
  // One queued pond photograph a frame (stepWaterProbes), here so the cull's
  // update further down puts back what the photograph had to show.
  this.stepWaterProbes();
  // Life on an Architect course (phase 6): never on Low.
  if(this.life){const on=this.quality!==tierOf('low');this.life.group.visible=on;if(on)this.life.update(dt,this.elapsed);}
  this.fountains?.update(dt,this.elapsed);
  if(this.markings)this.markings.visible=this.quality!==tierOf('low');
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
   if(this.sky){this.sky.position.copy(this.camera.position);this.sky.scale.setScalar(Math.min(1,far*.9/7500));}}this.updateGrass?.();this.elapsed+=dt;this.effects?.update(dt,this.elapsed);for(const flag of this.flagsticks||[])flag.position.y=T.MathUtils.damp(flag.position.y,flag.userData.lift?3:0,14,dt);this.holdFlagsticks();this.updateGreenGrid();this.updateFloodlights(this.ball?.position);this.foliageTime.value=this.elapsed;this.breeze.value=.55+(this.world.settings.wind||0)*.07;{const wa=(this.world.settings.windDirection||0)*Math.PI/180;this.windVec.value.set(Math.sin(wa),Math.cos(wa));}{const w=this.world.settings.wind||0,speed=1.6+.13*w,amp=.12+.016*w;for(const flag of this.flags||[]){const p=flag.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(this.elapsed*speed+p.getX(i)*5)*amp*(p.getX(i)+.24));p.needsUpdate=true;}}if(this.camFlight){
  // A flight drives the camera outright. The damping below is a spring toward
  // a target; running both would fight the path and round off its ends.
  this.camFlight.elapsed+=dt;
  const q=this.camFlight.path.pose(this.camFlight.elapsed);
  this.targetPos.copy(q.eye);this.targetLook.copy(q.look);
  this.camera.position.copy(q.eye);this.look.copy(q.look);
  if(q.done)this.camFlight=null;
 }
 const t=this.camFlight?0:1-Math.exp(-dt*(this.config.mode==='free'?10:4));this.camera.position.lerp(this.targetPos,t);if(!['free','overview'].includes(this.config.mode))this.camera.position.y=Math.max(this.camera.position.y,this.world.height(this.camera.position.x,this.camera.position.z)+.35);this.look.lerp(this.targetLook,t);this.camera.lookAt(this.trackingBall?this.targetLook:this.look);const near=T.MathUtils.clamp((this.camera.position.y-this.world.height(this.camera.position.x,this.camera.position.z))*.015,.5,25);if(Math.abs(this.camera.near-near)>.1){this.camera.near=near;this.camera.updateProjectionMatrix();}this.sun.target.position.set(this.camera.position.x,this.world.height(this.camera.position.x,this.camera.position.z),this.camera.position.z+80);this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir,420);this.clearCameraTrees?.();if(this.liftForPhone!==this.liftWas||this.liftMode!==this.config.mode){this.liftWas=this.liftForPhone;this.applyLensShift();}if(this.csm){
   // Zoomed all the way out, stretch the cascades over the whole course so every
   // tree keeps its shadow. Ultra only: the cost is resolution up close, and in
   // overview there is nothing up close to spend it on.
   const reach=this.config.mode==='overview'&&this.quality.overviewShadowFar?this.quality.overviewShadowFar:this.quality.shadowFar;
   // The splits also depend on the view (cascadeSplitter): the overview gets
   // three's own, so crossing into or out of it re-splits even when the
   // reach does not change, which on High it does not.
   const over=this.config.mode==='overview';
   if(this.csm.maxFar!==reach||this.csmOverview!==over){this.csm.maxFar=reach;this.csmOverview=over;this.csm.updateFrustums();this.cull?.dirty();this.cascadeForce=true;}
   this.camera.updateMatrixWorld();this.csm.update();this.snapNearCascade();this.scheduleCascades();this.fitCascadeDepth();
  }
  // After the cascades have moved, so each shadow map gets the trees it can
  // reach this frame (instance-cull.js). Their shadow cameras are placed here
  // exactly as three places them when it draws the map.
  this.updateGroundLod();
  if(this.cull){
   const lights=this.csm?this.csm.lights:this.sun?.castShadow?[this.sun]:[];
   for(const l of lights){if(l.shadow.autoUpdate===false)continue;l.updateMatrixWorld();l.target.updateMatrixWorld();l.shadow.updateMatrices(l);}
   // A re-sort changes which trees each map draws, the floodlights' included
   // (they draw what the view does): their shadows are redrawn to match.
   if(this.cull.update(this.camera,this.timed?this.sunDir:null,lights,this.quality.thinTrees?this.lowTreeRegion():null)&&this.floodlit)this.floodShadowDirty=true;
  }
  if(this.floodShadowDirty&&this.floodlit){
   const now=performance.now();
   if(now-(this.floodShadowAt??-1e9)>=FLOOD_SHADOW_EVERY){
    this.floodShadowAt=now;this.floodShadowDirty=false;
    for(const lamp of this.floodLamps||[])if(lamp.castShadow)lamp.shadow.needsUpdate=true;
   }
  }
  if(this.cloudUniforms)this.packClouds();
  if(this.mirror){const s=this.renderer.getDrawingBufferSize(this.mirrorUniforms.mirrorScreen.value);this.mirror.render(this.renderer,this.camera,s);}
  this.bloom?.begin(this.renderer);
  this.renderer.render(this.scene,this.camera);
  this.godRays?.render(this.renderer,this.scene,this.camera,this.sunDir,this.sun.color,this.readying);
  if(this.bloom)this.bloom.finish(this.renderer);else this.renderer.setRenderTarget(null);}
 project(p){const w=this.course.toWorld(p),v=new T.Vector3(w.x,p.y,w.z).project(this.camera);const c=this.cssSize();return{x:(v.x*.5+.5)*c.w,y:(-.5*v.y+.5)*c.h,visible:v.z<1&&v.z>-1};}
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
  const ndc=v.project(this.camera),{w:W,h:H}=this.cssSize();
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
 // A click on the ground: where the ray first goes under the ground the ball
 // meets (world.height), stepped by how far above it the ray is, then halved
 // in on the crossing. Since 9 November 2026: the drawn ground is squares of
 // varying detail (ground-lod.js), and a raycast through a 20-million-triangle
 // mesh took seconds on a large built course.
 pick(clientX,clientY){const r=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);
  const o=this.raycaster.ray.origin,d=this.raycaster.ray.direction,above=s=>o.y+d.y*s-this.world.height(o.x+d.x*s,o.z+d.z*s);
  let s=0,a=above(0);if(!(a>0))return null;
  for(let i=0;i<5000&&s<20000;i++){const next=s+Math.max(.25,Math.min(25,a*.5)),b=above(next);
   if(b<=0){let lo=s,hi=next;for(let k=0;k<32;k++){const mid=(lo+hi)/2;if(above(mid)>0)lo=mid;else hi=mid;}return this.course.toLocal(new T.Vector3(o.x+d.x*hi,o.y+d.y*hi,o.z+d.z*hi));}
   s=next;a=b;}
  return null;}
}
// THE MAP'S STILL LAYERS (the frame-rate goal, 22 October 2026). The hole map
// is redrawn every 60-80 ms, and every frame in the free camera, and each draw
// traced every fairway, green, bunker and pond again -- measured at about 0.9
// ms of every frame on average on this machine, in bursts every fifth frame.
// What does not move is drawn into two canvases the size of the map's and
// copied: `base` under the aim line, `over` above it, so the order of every
// mark is exactly what it was. `key` holds everything they depend on.
const mapCaches=new WeakMap(),worldKeys=new WeakMap();let worldCount=0;
const worldKey=world=>{let k=worldKeys.get(world);if(k===undefined){k=++worldCount;worldKeys.set(world,k);}return k;};
function mapLayers(canvas,key,w,h){
 let c=mapCaches.get(canvas);
 if(!c){c={key:null,base:document.createElement('canvas'),over:document.createElement('canvas')};mapCaches.set(canvas,c);}
 c.fresh=c.key!==key;
 // Setting the size clears a canvas and resets its drawing state, so each
 // redraw starts as a new canvas would.
 if(c.fresh){c.key=key;for(const l of [c.base,c.over]){l.width=w;l.height=h;}}
 return c;
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
 // The nav rides on the CANVAS beside its transform. Five call sites draw this
 // map from four different places, and threading a pan/zoom argument through
 // all of them is how one of them ends up not having it -- which would read as
 // the map resetting itself in that one mode.
 const transform=mapLayout(course,w,h,full,position,canvas.mapNav,canvas.mapFocus),scale=transform.scale,to=(x,z,hole=course)=>mapPoint(transform,full?hole.toWorld({x,z}):{x,z});canvas.mapTransform=transform;
 // Written only when they change: a write to the page, even of the same
 // value, can make the browser lay the page out again on the next frame.
 const label=full?`${world.holes.length}-hole course map · ${world.seed}`:`Hole ${course.hole+1} map · ${world.seed} · playing direction up`;
 if(canvas.dataset.courseSeed!==String(world.seed))canvas.dataset.courseSeed=world.seed;
 if(canvas.dataset.holeNumber!==String(course.hole+1))canvas.dataset.holeNumber=String(course.hole+1);
 if(canvas.getAttribute('aria-label')!==label)canvas.setAttribute('aria-label',label);
 // THE STILL PARTS ARE DRAWN ONCE (mapLayers): the ground, the holes, and over
 // the aim line the green's heat tile, streams and houses. Redrawn only when
 // what they show changes; a draw is then two copies, the moving marks and
 // nothing else.
 const g=course.green??course.pin;
 const layers=mapLayers(canvas,`${worldKey(world)}|${course.hole}|${full?1:0}|${canvas.mapHeat!==false?1:0}|${w}x${h}|${transform.cx},${transform.cz},${transform.scale},${transform.focus??''}|${course.active??''}|${g.x},${g.z}|${course.pin?.x},${course.pin?.z}`,w,h);
 if(layers.fresh){const ctx=layers.base.getContext('2d');
 ctx.fillStyle=full?world.bio.mapWater:(world.bio.mapGround??world.bio.rough);
 ctx.fillRect(0,0,w,h);
 // THE OVERHAUL'S GROUND TYPES ON THE HOLE MAP: rock, hardpan, heather and
 // the rest in their map colours (grounds.js `map`), from the lie itself --
 // `surface` asked over a grid across the canvas -- so the map shows where a
 // ball would play from rock. Only the still layer, so only when it changes.
 if(!full&&(world.wild||world.fallenField||world.built)){
  const N=96,tile=document.createElement('canvas');tile.width=tile.height=N;const tc=tile.getContext('2d'),img=tc.createImageData(N,N),col=new T.Color();
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const q=mapPosition(transform,(i+.5)/N*w,(j+.5)/N*h),p=course.toWorld(q),g=GROUNDS[world.surface(p.x,p.z)];if(!g)continue;col.set(g.map);img.data.set([col.r*255,col.g*255,col.b*255,255],(j*N+i)*4);}
  tc.putImageData(img,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(tile,0,0,w,h);
 }
 // RELIEF ON THE HOLE MAP (map-relief.js; the owner, 8 November 2026): the same light from the top
 // left of the screen, as a dark and light film over the ground (the holes are drawn over it). The
 // hole map turns its hole to point up, so the heights are read through the map itself, once each on
 // a grid of screen points (N+1 by N+1, about 5,300 lookups: the still layer redraws on every pan and
 // zoom, and a lookup per neighbour cost 13-40 ms a redraw), each pixel lit from the corner below it
 // and the ones to its right and below.
 if(!full){
  const N=72,tile=document.createElement('canvas');tile.width=tile.height=N;const tc=tile.getContext('2d'),img=tc.createImageData(N,N),px=w/N,py=h/N,H=new Float32Array((N+1)*(N+1));
  const at=(sx,sy)=>course.toWorld(mapPosition(transform,sx,sy));
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const p=at(i*px,j*py);H[j*(N+1)+i]=world.land(p.x,p.z);}
  const o0=at(0,0),oR=at(px,0),oD=at(0,py),sR=Math.hypot(oR.x-o0.x,oR.z-o0.z),sD=Math.hypot(oD.x-o0.x,oD.z-o0.z)||sR;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const y=H[j*(N+1)+i];if(!(y>=0))continue;const r=H[j*(N+1)+i+1],d=y+(H[(j+1)*(N+1)+i]-y)*sR/sD,o=reliefOverlay(reliefShade(y,r,d,sR));img.data.set([o[0],o[1],o[2],Math.round(o[3]*255)],(j*N+i)*4);}
  tc.putImageData(img,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(tile,0,0,w,h);
 }

 // RELIEF (map-relief.js; the owner, 8 November 2026): lit from the top left of the SCREEN, and
 // the map turns the world through 180 degrees (`mapPoint` negates both axes), so the pixel to the
 // right on screen is the ground at -x and the one below it the ground at -z.
 if(full){if(!world.mapBackground){const tile=document.createElement('canvas');tile.width=tile.height=150;const c=tile.getContext('2d'),img=c.createImageData(150,150),s=Math.max(world.halfX,world.halfZ)/75;for(let j=0;j<150;j++)for(let i=0;i<150;i++){const x=(i/149*2-1)*world.halfX,z=(j/149*2-1)*world.halfZ,y=world.land(x,z),relief=y<0?1:reliefShade(y,world.land(x-s,z),world.land(x,z-s),s),color=new T.Color(y<0?'#6eb8c0':world.bio.shoreSand&&y<2?'#e9dec0':GROUNDS[world.surface(x,z)]?.map??world.bio.rough).multiplyScalar((.9+Math.min(Math.max(y,0),80)/500)*relief).convertLinearToSRGB(),k=(j*150+i)*4;img.data.set([color.r*255,color.g*255,color.b*255,255],k);}c.putImageData(img,0,0);world.mapBackground=tile;}
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

 // AN ARCHITECT COURSE'S CART PATHS on the map (the owner's review, 30
 // October 2026), under the holes, at their width (never thinner than a line).
 if(world.paths?.length){
  const wp=p=>full?mapPoint(transform,p):mapPoint(transform,course.toLocal(p));
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=world.bio.mapTurf?.path??'#a69a86';
  for(const path of world.paths){if(path.points.length<2)continue;ctx.lineWidth=Math.max(1.2,path.width*scale);ctx.beginPath();path.points.forEach((p,i)=>{const q=wp(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();}
  ctx.restore();
 }
 // A BUILT course's surfaces are outlines, not a hole's shapes: drawn from
 // them, each polygon on its own (its rings even-odd, its islands left out),
 // in the order the ground paints them.
 if(world.built){
  const wp=([x,z])=>full?mapPoint(transform,{x,z}):mapPoint(transform,course.toLocal({x,z})),o=world.builtOutlines||{},mt=world.bio.mapTurf||{};
  const fill=(polys,col)=>{for(const poly of polys||[]){ctx.fillStyle=col;ctx.beginPath();for(const ring of poly){ring.forEach((q,i)=>{const m=wp(q);i?ctx.lineTo(...m):ctx.moveTo(...m);});ctx.closePath();}ctx.fill('evenodd');}};
  fill(o.semi,mt.semi??'#a1b481');fill(o.fairway,mt.fairway??'#608449');fill(o.path,mt.path??'#a69a86');fill(o.tee,mt.fairway??'#608449');
  fill((world.builtWater||[]).map(b=>b.rings),'#70a6aa');fill(o.sand,'#efe0b9');fill(o.green,mt.green??'#b3cc86');
 }
 for(const hole of full?world.holes:[course]){
  if(hole.built){for(const[name,t]of Object.entries(hole.tees)){const q=to(t.x,t.z,hole);ctx.fillStyle=TEE_COLOURS[name];ctx.beginPath();ctx.arc(...q,full?1.8:3,0,TAU);ctx.fill();}
   const[gx,gy]=to(hole.green.x,hole.green.z,hole);ctx.fillStyle=hole.hole===course.hole?'#c76a3d':'#365540';ctx.font='bold '+(full?8:10)+'px '+UI_FONT;ctx.textAlign='center';ctx.fillText(String(hole.hole+1),gx,gy-5);continue;}
  ctx.lineJoin='round';ctx.lineCap='round';for(const[margin,col]of[[hole.settings.semiRough,world.bio.mapTurf?.semi??'#a1b481'],[0,world.bio.mapTurf?.fairway??'#608449']]){ctx.beginPath();for(const side of [1,-1])for(let i=0;i<=100;i++){const mow=hole.mowStart??hole.fairwayStart,z=mow-margin+(hole.length+8-mow+2*margin)*(side===1?i/100:1-i/100),p=to(hole.center(z)+side*fairwayWidth(hole,z,margin,side),z,hole);side===1&&i===0?ctx.moveTo(...p):ctx.lineTo(...p);}ctx.closePath();ctx.fillStyle=col;ctx.fill();}
  for(const p of hole.ponds){ctx.fillStyle='#70a6aa';ctx.beginPath();for(let i=0;i<64;i++){const v=ovalRadius(p,i/64*TAU),q=to(p.x+v.x,p.z+v.z,hole);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();}
  for(const p of hole.bunkers){ctx.fillStyle='#efe0b9';ctx.beginPath();for(let i=0;i<64;i++){const v=ovalRadius(p,i/64*TAU),q=to(p.x+v.x,p.z+v.z,hole);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();}
  for(const[name,t]of Object.entries(hole.tees)){const q=to(t.x,t.z,hole);ctx.fillStyle=TEE_COLOURS[name];ctx.beginPath();ctx.arc(...q,full?1.8:3,0,TAU);ctx.fill();}
  // The disc is the green, so it is drawn around the green's centre; the number
  // that labels the hole goes with it.
  const centre=hole.green??hole.pin;
  const[gx,gy]=to(centre.x,centre.z,hole);ctx.fillStyle=world.bio.mapTurf?.green??'#b3cc86';ctx.beginPath();for(let i=0;i<64;i++){const a=i/64*TAU,g=greenPoint(hole,a,greenRadius(hole,a)),q=to(g.x,g.z,hole);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();ctx.fillStyle=hole.hole===course.hole?'#c76a3d':'#365540';ctx.font='bold '+(full?8:10)+'px '+UI_FONT;ctx.textAlign='center';ctx.fillText(String(hole.hole+1),gx,gy-5);
 }
 }
 ctx.drawImage(layers.base,0,0);
 // What drawing the holes used to leave set, which the strokes below inherit:
 // the aim line's dashes and the dispersion rings have round ends.
 ctx.lineJoin='round';ctx.lineCap='round';
 if(aimPoint){const from=to(position.x,position.z),target=to(aimPoint.x,aimPoint.z);ctx.save();ctx.strokeStyle='#fff1ac';ctx.lineWidth=3.5;ctx.setLineDash([8,6]);ctx.lineDashOffset=-time*22;ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...target);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#294c39';ctx.lineWidth=2;ctx.fillStyle='#ffed9e';ctx.beginPath();ctx.arc(...target,5,0,TAU);ctx.fill();ctx.stroke();ctx.restore();}
 if(layers.fresh){const ctx=layers.over.getContext('2d');ctx.lineJoin='round';ctx.lineCap='round';
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
 ctx.restore();}
 ctx.drawImage(layers.over,0,0);
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
