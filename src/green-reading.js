import * as T from 'three';
import {greenDistance} from './course.js';
import {greenGradient} from './course-plan.js';
import {CUP_RADIUS} from './physics.js';
export function slopeColor(slope){return new T.Color(slope<.01?'#39afd2':slope<.02?'#5fb879':slope<.03?'#e6d150':slope<.05?'#f49542':'#e75b64');}
// THE GRID AND THE FLOW ARE ONE SURFACE (1 October).
//
// The grid used to be line segments laid on the hole's own axes, and the flow a
// few hundred balls stepped along precomputed downhill paths. In play the camera
// looks from the ball, which is rarely straight down the hole, so the grid sat
// at an angle on screen; and the balls were a second set of objects to read
// against it (the owner).
//
// Now one mesh covers the green at half-metre resolution, lifted the same 6.5 cm
// the lines were, and its shader draws both:
//
//   the grid   lines every 1.5 m through the cup, in a frame the renderer
//              sets: in play, the direction you face at the START of the shot
//              (not while you aim -- a grid turning with every nudge of the aim
//              was disorienting, the owner), or the hole's axes for every
//              other camera.
//   the flow   light running along those same lines, downhill: on each line, a
//              dash travels the way the slope falls along it, brighter the more
//              of the slope runs along that line, quicker on the steeper
//              bands. Everywhere the green slopes at all, the gentlest band
//              included: it first skipped everything under 1%, and a green
//              tilted 0.9% -- enough to break a putt -- showed flow only in
//              its middle (the owner).
//
// Slope and fall direction are the putting surface's own (greenGradient), per
// vertex. The band colours are slopeColor's. Pulses move at one speed per
// band rather than one per point: a speed that varied point to point would let
// neighbouring points drift apart in phase as time went on and the dashes would
// turn to noise within a minute.
const GRID_SPACING = 1.5, GRID_STEP = .5, GRID_LIFT = .065, GRID_REACH = 36;
const BAND_HEX = ['#39afd2', '#5fb879', '#e6d150', '#f49542', '#e75b64'];
function readingSurface(h) {
 const n = Math.round(2 * GRID_REACH / GRID_STEP) + 1, count = n * n;
 const pos = new Float32Array(count * 3), slope = new Float32Array(count), fall = new Float32Array(count * 2), inside = new Float32Array(count);
 const w0 = h.toWorld({x: 0, z: 0}), wx = h.toWorld({x: 1, z: 0}), wz = h.toWorld({x: 0, z: 1});
 const ax = {x: wx.x - w0.x, z: wx.z - w0.z}, az = {x: wz.x - w0.x, z: wz.z - w0.z};
 for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const k = j * n + i, x = h.pin.x - GRID_REACH + i * GRID_STEP, z = h.pin.z - GRID_REACH + j * GRID_STEP;
  const d = greenDistance(h, x, z);
  inside[k] = d;
  const w = h.toWorld({x, z});
  pos[k * 3] = w.x; pos[k * 3 + 1] = h.height(x, z) + GRID_LIFT; pos[k * 3 + 2] = w.z;
  if (d > 1) continue;
  const g = greenGradient(h, x, z), m = Math.hypot(g.x, g.z);
  slope[k] = m;
  // Downhill, in world axes.
  if (m > 1e-6) { fall[k * 2] = -(g.x * ax.x + g.z * az.x) / m; fall[k * 2 + 1] = -(g.x * ax.z + g.z * az.z) / m; }
 }
 const index = [];
 for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
  const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
  if (Math.min(inside[a], inside[b], inside[c], inside[d]) > .3) continue;
  index.push(a, c, b, b, c, d);
 }
 const geo = new T.BufferGeometry();
 geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
 geo.setAttribute('slope', new T.Float32BufferAttribute(slope, 1));
 geo.setAttribute('fall', new T.Float32BufferAttribute(fall, 2));
 geo.setAttribute('inside', new T.Float32BufferAttribute(inside, 1));
 geo.setIndex(index);
 return geo;
}
const READING_VERTEX = `attribute float slope;attribute vec2 fall;attribute float inside;
varying vec2 vXZ;varying float vSlope;varying vec2 vFall;varying float vInside;
void main(){vXZ=position.xz;vSlope=slope;vFall=fall;vInside=inside;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const READING_FRAGMENT = `varying vec2 vXZ;varying float vSlope;varying vec2 vFall;varying float vInside;
uniform vec2 axis,origin;uniform float time,showLines,showFlow;uniform vec3 band0,band1,band2,band3,band4;
const float SP=${GRID_SPACING.toFixed(2)};
vec3 band(float s){return s<.01?band0:s<.02?band1:s<.03?band2:s<.05?band3:band4;}
float speed(float s){return s<.01?.3:s<.02?.45:s<.03?.7:s<.05?1.:1.4;}
// A dash with a bright head and a fading tail, the head leading.
float dash(float p){return smoothstep(.5,.93,p)*(1.-smoothstep(.93,1.,p));}
void main(){
 if(vInside>-.15)discard;
 vec2 d=vXZ-origin,across=vec2(-axis.y,axis.x);
 float u=dot(d,axis),v=dot(d,across);
 // How near each family of lines, against its width on screen: about 1.4 px
 // whatever the distance, as the line segments were.
 float wu=fwidth(u),wv=fwidth(v);
 float nearU=1.-smoothstep(.55*wu,1.35*wu,abs(fract(u/SP+.5)-.5)*SP);
 float nearV=1.-smoothstep(.55*wv,1.35*wv,abs(fract(v/SP+.5)-.5)*SP);
 vec2 f=vFall/max(length(vFall),1e-5);
 float ka=dot(f,axis),kb=dot(f,across),sp=speed(vSlope);
 // Lines of constant v run along the axis, so their dashes travel in u, the way
 // the fall runs along them; and the other family in v.
 float alongA=nearV*dash(fract(u*sign(ka)/SP-time*sp/SP))*abs(ka);
 float alongB=nearU*dash(fract(v*sign(kb)/SP-time*sp/SP))*abs(kb);
 // FADED WITH DISTANCE. A square 1.5 m across is a few pixels wide from the
 // tee; drawn anyway, its lines fill it solid and the dashes turn to speckle.
 // Full strength while a square is over 10 px on screen, gone under 4.
 float cell=SP/max(max(wu,wv),1e-5),near=smoothstep(4.,10.,cell);
 // Still only where the ground is dead level (round the cup, under 0.1%).
 float flow=max(alongA,alongB)*showFlow*smoothstep(.001,.003,vSlope)*near;
 float lines=max(nearU,nearV)*showLines*.9*near;
 float a=max(lines,flow);
 if(a<.01)discard;
 gl_FragColor=vec4(mix(band(vSlope),vec3(1.,.98,.86),clamp(flow*1.4,0.,1.)*.75),max(lines,clamp(flow*1.6,0.,1.)*.95));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createGreenReading(h){
 const group=new T.Group(),heatPoints=[],heatColors=[];
 let low=Infinity,high=-Infinity;for(let x=-36;x<=36;x+=1)for(let z=-36;z<=36;z+=1)if(greenDistance(h,h.pin.x+x,h.pin.z+z)<0){const y=h.height(h.pin.x+x,h.pin.z+z);low=Math.min(low,y);high=Math.max(high,y);}
 const terrain=h.world.groundGrid,positions=terrain.positions,indices=terrain.indices;
 // Reuse the exact ground triangles; a separately sampled overlay can intersect
 // the terrain and create a checkerboard on a sloped green.
 for(let k=0;k<indices.length;k+=3){const ids=[indices[k],indices[k+1],indices[k+2]],first=ids[0]*3;if(Math.abs(positions[first]-h.worldGreen.x)>36||Math.abs(positions[first+2]-h.worldGreen.z)>36)continue;const local=ids.map(i=>h.toLocal({x:positions[i*3],z:positions[i*3+2]}));if(local.every(p=>greenDistance(h,p.x,p.z)>1))continue;
  for(const i of ids){const y=positions[i*3+1],t=(y-low)/Math.max(.05,high-low),c=new T.Color().setHSL((1-T.MathUtils.clamp(t,0,1))*.64,.88,.48);heatPoints.push(new T.Vector3(positions[i*3],y+.018,positions[i*3+2]));heatColors.push(c.r,c.g,c.b);}
 }

 const hg=new T.BufferGeometry().setFromPoints(heatPoints);hg.setAttribute('color',new T.Float32BufferAttribute(heatColors,3));const hm=new T.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,uniforms:{green:{value:new T.Vector2(h.worldGreen.x,h.worldGreen.z)},pin:{value:new T.Vector2(h.worldPin.x,h.worldPin.z)},pinHeight:{value:h.height(h.green.x,h.green.z)},rotation:{value:new T.Vector2(Math.cos(h.rotation),Math.sin(h.rotation))},shape:{value:new T.Vector4(h.greenSize,h.greenAspect,h.greenWave2,h.greenWave3)},wave:{value:new T.Vector2(h.phase,h.greenWave5)}},vertexShader:'varying vec3 hue;varying vec3 point;void main(){hue=color;point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 hue;varying vec3 point;uniform vec2 green,pin,rotation,wave;uniform vec4 shape;uniform float pinHeight;void main(){vec2 d=point.xz-green;vec2 q=vec2((d.x*rotation.x-d.y*rotation.y)/shape.y,d.x*rotation.y+d.y*rotation.x);float a=atan(q.y,q.x);if(length(q)>shape.x*(1.+shape.z*sin(a*2.+wave.x)+shape.w*sin(a*3.+wave.x)+wave.y*cos(a*5.)))discard;if(distance(point.xz,pin)<${CUP_RADIUS+.002})discard;float level=(point.y-.018-pinHeight)/.1;float line=1.-smoothstep(.015,max(.02,fwidth(level)*1.3),abs(fract(level+.5)-.5));gl_FragColor=vec4(mix(hue,vec3(.12,.22,.26),line*.6),.75);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});const heatmap=new T.Mesh(hg,hm);heatmap.renderOrder=1;group.add(heatmap);
 // The grid and the flow (see readingSurface). One mesh; the two buttons are
 // two switches in its shader, so either can show without the other.
 const w0=h.toWorld({x:0,z:0}),wz=h.toWorld({x:0,z:1}),holeAxis=new T.Vector2(wz.x-w0.x,wz.z-w0.z).normalize();
 const uniforms={axis:{value:holeAxis.clone()},origin:{value:new T.Vector2(h.worldPin.x,h.worldPin.z)},time:{value:0},showLines:{value:0},showFlow:{value:0},
  ...Object.fromEntries(BAND_HEX.map((hex,i)=>['band'+i,{value:new T.Color(hex)}]))};
 const surface=new T.Mesh(readingSurface(h),new T.ShaderMaterial({uniforms,vertexShader:READING_VERTEX,fragmentShader:READING_FRAGMENT,transparent:true,depthWrite:false}));
 surface.renderOrder=2;surface.frustumCulled=false;group.add(surface);
 // `grid` and `flow` stay as objects with a `visible` flag, which is how the
 // renderer and the tests switch them; both drive the one surface.
 const sync=()=>{uniforms.showLines.value=grid.visible?1:0;uniforms.showFlow.value=flow.visible?1:0;surface.visible=grid.visible||flow.visible;};
 const toggle=()=>{let on=false;return {get visible(){return on;},set visible(v){on=!!v;sync();},parent:group};};
 const grid=toggle(),flow=toggle();
 sync();
 // Every frame: the time, and the frame the lines are drawn in -- a heading on
 // the ground (`heading`, world x and z; the renderer passes the shot's), or
 // the hole's axes when there is none.
 const update=(time,heading)=>{
  uniforms.time.value=time;
  const l=heading?Math.hypot(heading.x,heading.z):0;
  if(l>.05)uniforms.axis.value.set(heading.x/l,heading.z/l);else uniforms.axis.value.copy(holeAxis);
 };
 return {group,grid,flow,heatmap,surface,update,low,high};
}
