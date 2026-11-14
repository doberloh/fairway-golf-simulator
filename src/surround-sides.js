// WHAT A COURSE MAY SAY ABOUT ITS SURROUNDINGS (the surroundings rework, 12
// November 2026): the record a built course's file may carry,
// `surround: {sides: {n, e, s, w}, height, cover}`, its kinds and its checks.
// landscape-edge.js raises the far ground by it (`sidedRelief`, where each
// kind is described); the Course Builder writes it; course-doc.js keeps it in
// the file. North is -z and east +x, as the builder's plan is drawn.
// Pure: no three.js, so the document and the world from it can read it.
export const SURROUND_KINDS=['auto','flat','hills','range','mountain','mesas','sea','islands','lake'];
export const SURROUND_SIDES=['n','e','s','w'];
export const SIDE_ANGLE={e:0,s:Math.PI/2,w:Math.PI,n:-Math.PI/2};
// Whether a kind is water, for whoever draws the sea or keeps trees off it.
export const waterSide=kind=>kind==='sea'||kind==='islands'||kind==='lake';
// A file's record made safe: unknown kinds are `auto`, the height held to its range.
export function normaliseSurround(o){
 if(!o||typeof o!=='object')return null;
 const sides={};for(const k of SURROUND_SIDES)sides[k]=SURROUND_KINDS.includes(o.sides?.[k])?o.sides[k]:'auto';
 const num=(v,lo,hi,d)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(hi,Math.max(lo,+v)):d;
 const out={sides,height:num(o.height,.3,2,1)};
 if(o.cover!==undefined&&o.cover!==null)out.cover=num(o.cover,0,1,.5);
 return SURROUND_SIDES.every(k=>sides[k]==='auto')&&out.height===1&&out.cover===undefined?null:out;
}
// WHERE THE WATER STANDS when a side is water and the file names no sea of
// its own: two and a half metres under the lowest ground of the land, so
// neither the sea nor the beach painted beside it (1.7 m up from the water:
// course.js BEACH_RISE and BEACH_FADE) reaches any part of the course,
// however it is laid out. A course on low ground gets a beach just past its
// line; one on high ground stands on a bluff over the water. PLACED.
export function seaLevelUnder(heights){
 let low=Infinity;for(let i=0;i<heights.length;i++)if(heights[i]<low)low=heights[i];
 return Number.isFinite(low)?low-2.5:0;
}
// The names a player reads, for the builder and the guide.
export const SURROUND_NAMES={auto:'As the landscape',flat:'Open country',hills:'Rolling hills',range:'A mountain range',mountain:'One big mountain',mesas:'Mesas',sea:'The sea',islands:'Sea and islands',lake:'A lake'};
