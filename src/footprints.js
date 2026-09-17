export const FOOTPRINTS={organic:'Organic sweep',oval:'Elongated loop',crescent:'Crescent',ribbon:'Winding ribbon',square:'Original square',figure8:'Figure eight',butterfly:'Butterfly',clover:'Three-leaf clover',spiral:'Spiral',horseshoe:'Horseshoe',triangle:'Rounded triangle',diamond:'Diamond',coast:'Coastal sweep',archipelago:'Island chain'};
const TAU=Math.PI*2;
export function footprintCurve(kind,t){const a=t*TAU;
 switch(kind){
 case 'square':{const k=Math.min(3,Math.floor(t*4)),u=t*4-k;return [[u*2,0],[2,u*2],[2-u*2,2],[0,2-u*2]][k];}
 case 'figure8':return [Math.sin(a)*1.4,Math.sin(a*2)*.65];
 case 'butterfly':return [Math.sin(a)*(1+.65*Math.abs(Math.cos(a))),Math.sin(a*2)];
 case 'clover':{const r=1+.6*Math.cos(a*3);return [r*Math.cos(a)-1.6,r*Math.sin(a)];}
 case 'spiral':{const r=.25+t*1.8;return [r*Math.cos(a*1.6)-.25,r*Math.sin(a*1.6)];}
 case 'horseshoe':return [1-Math.cos(t*Math.PI*1.75),Math.sin(t*Math.PI*1.75)*1.65];
 case 'triangle':return [Math.cos(a)+.24*Math.cos(a*2)-1.24,Math.sin(a)-.24*Math.sin(a*2)];
 case 'diamond':return [Math.sin(a)*Math.abs(Math.sin(a))**.25,(1-Math.cos(a)*Math.abs(Math.cos(a))**.25)*1.7];
 case 'coast':return [t*3.3,Math.sin(t*Math.PI*.85)*1.4+Math.sin(t*Math.PI*2.5)*.18];
 case 'archipelago':return [t*3.4+.32*Math.sin(t*Math.PI*6),.48*Math.sin(t*Math.PI*6)];
 case 'ribbon':return [Math.sin(t*Math.PI*2)*.5,t*3];
 case 'crescent':return [1-Math.cos(t*Math.PI*1.3),Math.sin(t*Math.PI*1.3)];
 case 'oval':return [1-Math.cos(a),Math.sin(a)*.55];
 default:return [1-Math.cos(t*Math.PI*1.7),Math.sin(t*Math.PI*1.7)+Math.sin(a*1.5)*.2];
 }
}
export function footprintIcon(kind){const points=Array.from({length:65},(_,i)=>footprintCurve(kind,i/64)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),scale=40/Math.max(Math.max(...xs)-minX,Math.max(...ys)-minY);return `<svg viewBox="0 0 52 52" aria-hidden="true"><polyline points="${points.map(([x,y])=>`${(6+(x-minX)*scale).toFixed(1)},${(6+(y-minY)*scale).toFixed(1)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}
