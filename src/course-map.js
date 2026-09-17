import {fairwayWidth,greenRadius,ovalRadius} from './course.js';
import {greenBounds} from './green-map.js';

// Pan and zoom sit ON TOP of the auto-fit rather than replacing it. `mapLayout`
// still works out the frame that holds the whole hole (or the whole course), and
// `nav` then scales and shifts that frame. Zoom 1 with no offset is exactly the
// map as it was, which is what lets every existing caller keep working and makes
// "reset" a single assignment rather than a recomputation.
export const MAP_ZOOM_MIN=1, MAP_ZOOM_MAX=14;
export const MAP_NAV_NONE={zoom:1,x:0,z:0};
export const clampZoom=z=>Math.min(MAP_ZOOM_MAX,Math.max(MAP_ZOOM_MIN,Number.isFinite(z)?z:1));

// The pan limit is "the content must still overlap the viewport by at least half
// a screen". An unclamped drag loses the map entirely with nothing on screen to
// say which way to drag back, so some limit is needed -- but the FIRST version
// clamped to the content's own half-extent, and that was far too tight. At the
// fitted zoom a hole is about 48 m of half-width drawn at roughly a pixel per
// metre, so the map moved about fifty pixels and stopped dead. It read as the
// drag breaking rather than as a limit being reached.
//
// Measured against the viewport as well as the content, the limit grows as you
// zoom out, which is the right way round: the further out you are, the more empty
// ground there is to swing the map across.
function withNav(fit,nav){
 const zoom=clampZoom(nav?.zoom);
 const scale=fit.scale*zoom;
 const limitX=fit.halfX+(fit.w/2)/scale/2, limitZ=fit.halfZ+(fit.h/2)/scale/2;
 const x=Math.min(limitX,Math.max(-limitX,nav?.x||0));
 const z=Math.min(limitZ,Math.max(-limitZ,nav?.z||0));
 return {...fit,cx:fit.cx+x,cz:fit.cz+z,scale,zoom,panX:x,panZ:z,limitX,limitZ};
}

export function mapLayout(course,w,h,full=false,position=course.tee,nav=null,focus=null){
 // FRAMED ON THE GREEN. Once the ball is on the putting surface the hole map is
 // showing 400 yards of fairway you have finished with, and the twenty yards
 // that matter are a smudge at one end.
 if(focus==='green'){
  const b=greenBounds(course);
  return withNav({full:false,w,h,cx:b.x,cz:b.z,
   scale:Math.min((w-18)/(b.rx*2),(h-18)/(b.rz*2)),
   halfX:b.rx,halfZ:b.rz,hole:course.hole,focus:'green'},nav);
 }
 if(full)return withNav({full,w,h,cx:0,cz:0,
  scale:Math.min((w-24)/(course.world.halfX*2),(h-24)/(course.world.halfZ*2)),
  halfX:course.world.halfX,halfZ:course.world.halfZ,hole:course.hole},nav);
 const points=[position,...Object.values(course.tees)];
 for(let i=0;i<=160;i++){const mow=course.mowStart??course.fairwayStart,z=mow+(course.length+8-mow)*i/160;for(const side of [-1,1])points.push({x:course.center(z)+side*fairwayWidth(course,z,course.settings.semiRough,side),z});}
 for(let i=0;i<64;i++){const a=i*Math.PI/32,r=greenRadius(course,a)+course.settings.fringe+course.settings.semiRough;points.push({x:(course.green??course.pin).x+Math.cos(a)*r*course.greenAspect,z:(course.green??course.pin).z+Math.sin(a)*r});}
 for(const o of [...course.bunkers,...course.ponds])for(let i=0;i<32;i++){const q=ovalRadius(o,i*Math.PI/16);points.push({x:o.x+q.x,z:o.z+q.z});}
 const minX=Math.min(...points.map(p=>p.x))-9,maxX=Math.max(...points.map(p=>p.x))+9,minZ=Math.min(...points.map(p=>p.z))-12,maxZ=Math.max(...points.map(p=>p.z))+12;
 return withNav({full,w,h,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2,
  scale:Math.min((w-24)/(maxX-minX),(h-24)/(maxZ-minZ)),
  halfX:(maxX-minX)/2,halfZ:(maxZ-minZ)/2,hole:course.hole},nav);
}
// Looking along +z, local +x is screen-left, as in the playing camera.
export const mapPoint=(m,p)=>[m.w/2-(p.x-m.cx)*m.scale,m.h/2-(p.z-m.cz)*m.scale];
export const mapPosition=(m,x,y)=>({x:m.cx-(x-m.w/2)/m.scale,z:m.cz-(y-m.h/2)/m.scale});
// WHERE A TOP-DOWN TILE OF A WORLD RECTANGLE GOES, as an affine rather than a
// rectangle. `mapPoint` negates BOTH axes -- the map is the world turned through
// 180 degrees -- so a tile whose pixel (0,0) is minimum x and minimum z belongs
// bottom-RIGHT on screen. Fitting it into a normalised destination rectangle
// gets the size and the position right and the orientation 180 degrees wrong,
// which on a green paints the high side over the low side. The negative scales
// carry the flip, and deriving them from `mapPoint` means the tile cannot
// disagree with the outline drawn over it.
export function tilePlacement(m,bounds,w,h){
 const a=mapPoint(m,{x:bounds.x-bounds.rx,z:bounds.z-bounds.rz});
 const c=mapPoint(m,{x:bounds.x+bounds.rx,z:bounds.z+bounds.rz});
 return {x:a[0],y:a[1],sx:(c[0]-a[0])/w,sy:(c[1]-a[1])/h};
}

// Zoom about a point on the canvas, keeping the world under it where it is.
// Zooming about the centre instead makes the map crawl away from whatever you
// were trying to look at, which is the difference between a usable map and one
// that fights you. Returns the nav the caller should store.
export function zoomAbout(m,nav,canvasX,canvasY,factor){
 const fitScale=m.scale/m.zoom;
 const worldX=m.cx-(canvasX-m.w/2)/m.scale, worldZ=m.cz-(canvasY-m.h/2)/m.scale;
 const zoom=clampZoom((nav?.zoom||1)*factor);
 const next=fitScale*zoom;
 // The fitted centre is whatever the current centre is minus the pan already in
 // it, so this never needs the layout to be recomputed to find its own origin.
 const fitCx=m.cx-(m.panX||0), fitCz=m.cz-(m.panZ||0);
 return {zoom,
  x:worldX+(canvasX-m.w/2)/next-fitCx,
  z:worldZ+(canvasY-m.h/2)/next-fitCz};
}

// Drag: canvas pixels to world metres.
//
// `mapPoint` is `w/2 - (p - c) * scale`, so screen position grows WITH the
// centre: raising `cx` slides the picture right. The offsets therefore ADD. The
// first version subtracted them, on the reasoning that +x is screen-left -- true
// of the world axis, irrelevant to the centre -- and the map ran away from the
// pointer at exactly twice the speed it should have followed it.
export const panBy=(m,nav,dx,dy)=>({zoom:nav?.zoom||1,
 x:(nav?.x||0)+dx/m.scale,
 z:(nav?.z||0)+dy/m.scale});
