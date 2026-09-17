import * as T from 'three';
import {greenDistance} from './course.js';
import {greenGradient} from './course-plan.js';
import {CUP_RADIUS} from './physics.js';
export function slopeColor(slope){return new T.Color(slope<.01?'#39afd2':slope<.02?'#5fb879':slope<.03?'#e6d150':slope<.05?'#f49542':'#e75b64');}
export function greenFlowPaths(h){
 const paths=[];
 for(let x=-36;x<=36;x+=1.5)for(let z=-36;z<=36;z+=1.5){let p={x:h.pin.x+x,z:h.pin.z+z},path=[{...p}],travel=0;if(greenDistance(h,p.x,p.z)>-.5)continue;
  for(let i=0;i<36;i++){const grad=greenGradient(h,p.x,p.z),s=Math.hypot(grad.x,grad.z);if(s<.0005)break;const speed=Math.min(1.5,s*28),next={x:p.x-grad.x/s*speed*.1,z:p.z-grad.z/s*speed*.1};if(greenDistance(h,next.x,next.z)>-.25||Math.hypot(next.x-h.pin.x,next.z-h.pin.z)<CUP_RADIUS+.1)break;if(h.height(next.x,next.z)>h.height(p.x,p.z)+.0001)break;travel+=Math.hypot(next.x-p.x,next.z-p.z);path.push(next);p=next;if(travel>2.8)break;}
  if(path.length>1)paths.push({path,delay:(paths.length%17)*.04});
 }
 return paths;
}
export function createGreenReading(h){
 const group=new T.Group(),linePoints=[],lineColors=[],heatPoints=[],heatColors=[],paths=greenFlowPaths(h),worldPoint=(x,z,lift)=>{const p=h.toWorld({x,z});return new T.Vector3(p.x,h.height(x,z)+lift,p.z);};
 let low=Infinity,high=-Infinity;for(let x=-36;x<=36;x+=1)for(let z=-36;z<=36;z+=1)if(greenDistance(h,h.pin.x+x,h.pin.z+z)<0){const y=h.height(h.pin.x+x,h.pin.z+z);low=Math.min(low,y);high=Math.max(high,y);}
 for(let a=-36;a<=36;a+=1.5)for(let b=-36;b<36;b+=.5)for(const axis of [0,1]){const x=h.pin.x+(axis?a:b),z=h.pin.z+(axis?b:a),nx=x+(axis?0:.5),nz=z+(axis?.5:0);if(greenDistance(h,x,z)>-.15||greenDistance(h,nx,nz)>-.15)continue;for(const p of [{x,z},{x:nx,z:nz}]){const g=greenGradient(h,p.x,p.z),c=slopeColor(Math.hypot(g.x,g.z));linePoints.push(worldPoint(p.x,p.z,.065));lineColors.push(c.r,c.g,c.b);}}
 const lg=new T.BufferGeometry().setFromPoints(linePoints);lg.setAttribute('color',new T.Float32BufferAttribute(lineColors,3));const grid=new T.LineSegments(lg,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthWrite:false}));grid.renderOrder=2;group.add(grid);
 const terrain=h.world.groundGrid,positions=terrain.positions,indices=terrain.indices;
 // Reuse the exact ground triangles; a separately sampled overlay can intersect
 // the terrain and create a checkerboard on a sloped green.
 for(let k=0;k<indices.length;k+=3){const ids=[indices[k],indices[k+1],indices[k+2]],first=ids[0]*3;if(Math.abs(positions[first]-h.worldGreen.x)>36||Math.abs(positions[first+2]-h.worldGreen.z)>36)continue;const local=ids.map(i=>h.toLocal({x:positions[i*3],z:positions[i*3+2]}));if(local.every(p=>greenDistance(h,p.x,p.z)>1))continue;
  for(const i of ids){const y=positions[i*3+1],t=(y-low)/Math.max(.05,high-low),c=new T.Color().setHSL((1-T.MathUtils.clamp(t,0,1))*.64,.88,.48);heatPoints.push(new T.Vector3(positions[i*3],y+.018,positions[i*3+2]));heatColors.push(c.r,c.g,c.b);}
 }

 const hg=new T.BufferGeometry().setFromPoints(heatPoints);hg.setAttribute('color',new T.Float32BufferAttribute(heatColors,3));const hm=new T.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,uniforms:{green:{value:new T.Vector2(h.worldGreen.x,h.worldGreen.z)},pin:{value:new T.Vector2(h.worldPin.x,h.worldPin.z)},pinHeight:{value:h.height(h.green.x,h.green.z)},rotation:{value:new T.Vector2(Math.cos(h.rotation),Math.sin(h.rotation))},shape:{value:new T.Vector4(h.greenSize,h.greenAspect,h.greenWave2,h.greenWave3)},wave:{value:new T.Vector2(h.phase,h.greenWave5)}},vertexShader:'varying vec3 hue;varying vec3 point;void main(){hue=color;point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 hue;varying vec3 point;uniform vec2 green,pin,rotation,wave;uniform vec4 shape;uniform float pinHeight;void main(){vec2 d=point.xz-green;vec2 q=vec2((d.x*rotation.x-d.y*rotation.y)/shape.y,d.x*rotation.y+d.y*rotation.x);float a=atan(q.y,q.x);if(length(q)>shape.x*(1.+shape.z*sin(a*2.+wave.x)+shape.w*sin(a*3.+wave.x)+wave.y*cos(a*5.)))discard;if(distance(point.xz,pin)<${CUP_RADIUS+.002})discard;float level=(point.y-.018-pinHeight)/.1;float line=1.-smoothstep(.015,max(.02,fwidth(level)*1.3),abs(fract(level+.5)-.5));gl_FragColor=vec4(mix(hue,vec3(.12,.22,.26),line*.6),.75);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});const heatmap=new T.Mesh(hg,hm);heatmap.renderOrder=1;group.add(heatmap);
 const bg=new T.BufferGeometry().setFromPoints(paths.map(({path})=>worldPoint(path[0].x,path[0].z,.09))),bm=new T.PointsMaterial({color:'#fffad8',size:.065,transparent:true,depthWrite:false});bm.onBeforeCompile=s=>s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(length(gl_PointCoord-vec2(.5))>.5)discard;');const flow=new T.Points(bg,bm);flow.renderOrder=3;group.add(flow);
 const update=time=>{const a=bg.attributes.position;paths.forEach(({path,delay},i)=>{const age=time-delay,step=age<0?0:(age%(path.length*.1+.5))/.1,index=Math.min(path.length-1,Math.floor(step)),next=path[Math.min(index+1,path.length-1)],p=path[index],f=step-index,x=p.x+(next.x-p.x)*Math.min(1,f),z=p.z+(next.z-p.z)*Math.min(1,f),w=worldPoint(x,z,age<0||step>path.length?-1:.09);a.setXYZ(i,w.x,w.y,w.z);});a.needsUpdate=true;};
 return {group,grid,flow,heatmap,update,low,high};
}
