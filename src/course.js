import {addLargeLakes} from './lakes.js';
import {generateHomes} from './homes.js';
import {generateStreams,shoreBands,WATER_FREEBOARD,WATER_LIP} from './streams.js';
import {planCourse,enabledTees,greenContour} from './course-plan.js';
import {makeGroundGrid,groundHeight} from './terrain-grid.js';
import {routeHoles} from './routing.js';
import {buildRange} from './range.js';
import {clamp} from './physics.js';
import {DEFAULT_COURSE as SCHEMA_DEFAULTS} from './settings-schema.js';
export const BIOMES={
 pnw:{name:'Pacific Northwest',title:'Bandon Ridge',tag:'Old-growth forest. Cool coastal air.',rough:'#526238',semi:'#477335',fairway:'#538637',fringe:'#638e40',green:'#80a74c',tree:'#254c32',sky:'#a7c6d5',sand:'#e5d9b7',water:'#245959',rock:'#6f7976',altitude:120,temperature:16,treeKind:'pine',sun:28},
 desert:{name:'Desert',title:'Saguaro Dunes',tag:'Emerald turf in a sandstone wilderness.',rough:'#b99967',semi:'#688440',fairway:'#39804b',fringe:'#76a055',green:'#90b66b',tree:'#617b46',sky:'#dbd4b9',sand:'#e9c996',water:'#348d8a',rock:'#b57c4e',altitude:450,temperature:31,treeKind:'cactus',sun:24},
 mountain:{name:'Mountain',title:'Alpine Reserve',tag:'Glacial peaks. Clear alpine lakes.',rough:'#65714c',semi:'#557843',fairway:'#639847',fringe:'#86a65d',green:'#a3ba78',tree:'#24473b',sky:'#adcfeb',sand:'#dfddd1',water:'#24647b',rock:'#8a9495',altitude:1800,temperature:11,treeKind:'spruce',sun:36},
 links:{name:'Links',title:'North Sea Links',tag:'Golden fescue, dunes, and Atlantic light.',rough:'#a89d65',semi:'#7e9050',fairway:'#6d9149',fringe:'#91a75b',green:'#acbd73',tree:'#89945e',sky:'#c8d7df',sand:'#e9dcb7',water:'#436e80',rock:'#8b8977',altitude:15,temperature:14,treeKind:'shrub',sun:23},
 midwest:{name:'Midwest',title:'Prairie Run',tag:'Parkland oaks beneath an endless sky.',rough:'#69783b',semi:'#50803d',fairway:'#599743',fringe:'#83a451',green:'#a0be6a',tree:'#46732f',sky:'#b8d7e9',sand:'#e8ddc3',water:'#41766a',rock:'#83846c',altitude:230,temperature:22,treeKind:'oak',sun:39},
 island:{name:'Island',title:'Turtle Bay',tag:'White coral sand and turquoise shallows.',rough:'#829549',semi:'#5a944c',fairway:'#4b9b58',fringe:'#82b76d',green:'#a4ce83',tree:'#3d803f',sky:'#b0dfec',sand:'#fff0d3',water:'#12a9b0',rock:'#70756a',altitude:8,temperature:28,treeKind:'palm',sun:47},
 autumn:{name:'Autumn',title:'Copper Hollow',tag:'Copper canopies in the afternoon sun.',rough:'#a19957',semi:'#748347',fairway:'#709245',fringe:'#99aa66',green:'#b2c280',tree:'#b76427',sky:'#e1cfb5',sand:'#e8d7b4',water:'#627967',rock:'#827463',altitude:350,temperature:17,treeKind:'oak',sun:19}
};
// FNV-1a-style string seed hash, then Mulberry32: Tommy Ettinger (CC0),
// JavaScript variant published by bryc (MIT fallback). See THIRD_PARTY_NOTICES.txt.
export function random(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Defaults, bounds and validation all live in the settings schema; re-exported
// here because course.js has long been the import site for them.
export {DEFAULT_COURSE} from './settings-schema.js';
export function greenRadius(hole,angle){return (hole.greenSize??17)*(1+(hole.greenWave2??0)*Math.sin(angle*2+hole.phase)+(hole.greenWave3??.075)*Math.sin(angle*3+hole.phase)+(hole.greenWave5??.045)*Math.cos(angle*5));}
// Measured from the centre of the green, which since hole locations started
// moving is not the same point as the cup. Falling back to the pin keeps any
// caller that only has a cup working.
export function greenDistance(hole,x,z){const c=hole.green??hole.pin,dx=(x-c.x)/(hole.greenAspect??1.17),dz=z-c.z,angle=Math.atan2(dz,dx);return Math.hypot(dx,dz)-greenRadius(hole,angle);}
// Where the cup is cut, and why it moves.
//
// A tournament moves the hole around the green through the week, and the two
// things that decide how hard a location is are how much slope is under the ball
// and how little green there is between the cup and an edge. Both are in the
// USGA's own guidance for hole locations: the cup wants a reasonably level piece
// of ground so a ball can come to rest beside it, and several paces of green
// around it -- four or five for championship play, less as the setup gets harder.
// Fast greens tighten the slope figure rather than the distance one, which is why
// the caps below sit where they do: at Stimp 10 and above a ball will not sit
// still much past three per cent.
//
// Thursday takes the flattest ground with the most room. Sunday takes the
// steepest and the tightest that still holds a ball. Nothing here is allowed to
// be unplayable: every day has a hard cap on the slope it will accept, and the
// search relaxes distance from the edge before it ever relaxes that.
// `edge` is the LEAST green a day will leave between the cup and an edge, not a
// distance every cup is put at. Scoring it as a target -- penalising a location
// for having too MUCH room as well as too little -- pulled every pin on the
// course to within a few inches of the same number, which is not how a setup
// sheet reads: the minimum is a rule, and the rest of the green is still in play.
const PIN_DAYS = {
 Thursday: {slope: 1.0, cap: 2.0, edge: 5.0},
 Friday:   {slope: 1.8, cap: 2.8, edge: 4.3},
 Saturday: {slope: 2.5, cap: 3.5, edge: 3.6},
 Sunday:   {slope: 3.2, cap: 4.2, edge: 3.0},
};
export const PIN_DAY_KEYS = Object.keys(PIN_DAYS);
export const pinDayOf = settings => PIN_DAYS[settings?.pinDay] ? settings.pinDay : 'Thursday';
// Front, middle and back rotate hole by hole, starting at the front, so a round
// works its way around the greens instead of playing the same spot every time.
export const PIN_BANDS = ['front', 'middle', 'back'];
export const pinBandFor = index => PIN_BANDS[((index % 3) + 3) % 3];
// The lab sets pinBand to 'centre' so its cup sits in the middle of a
// flat green with the same reach in every direction. It is a bench, not a round:
// a front hole location would leave a preset with no green to roll out on.
const BAND_WINDOW = {front: [-.70, -.26], middle: [-.20, .20], back: [.26, .70]};
// No cup goes nearer than this to the edge of the green whatever the day asks
// for. Three metres is about four paces, the tightest a championship setup cuts.
const ROOM_FLOOR = 3.0;

// Slope at a point on the green, in per cent. Read off the green's own contour
// rather than the finished terrain, because the terrain does not exist yet when
// the cup is cut -- and inside the green the two are the same surface anyway.
function greenSlopeAt(h, x, z) {
 const e = .4;
 const gx = (greenContour(h, x + e, z) - greenContour(h, x - e, z)) / (2 * e);
 const gz = (greenContour(h, x, z + e) - greenContour(h, x, z - e)) / (2 * e);
 return Math.hypot(gx, gz) * 100;
}

export function choosePin(h, index = 0, rng = () => .5) {
 const day = PIN_DAYS[pinDayOf(h.settings)];
 // The bench case: dead centre, both ways. A band only says how far up the green
 // the cup is, so asking for 'centre' through one would still let it slide
 // fifteen metres sideways -- which it did.
 if (h.settings?.pinBand === 'centre') return {...h.green};
 const band = BAND_WINDOW[h.settings?.pinBand] ? h.settings.pinBand : pinBandFor(index);
 const [lo, hi] = BAND_WINDOW[band];
 const centre = h.green, reach = h.greenSize ?? 17;
 // "Plus or minus a bit": the band is where the cup belongs, not a line it sits
 // on, so each hole slides its own window a little.
 const drift = (rng() - .5) * .10;
 const zLo = centre.z + (lo + drift) * reach, zHi = centre.z + (hi + drift) * reach;
 const candidates = [];
 for (let dx = -reach * 1.3; dx <= reach * 1.3; dx += .9) {
  for (let z = zLo; z <= zHi; z += .9) {
   const x = centre.x + dx;
   const room = -greenDistance(h, x, z);
   if (room < 2.0) continue;
   const slope = greenSlopeAt(h, x, z);
   // A cup on the shoulder of a ridge is not a hole location however flat the
   // exact point is, so the ground a putt's length around it has to agree.
   let worst = slope;
   for (const [ox, oz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]])
    worst = Math.max(worst, greenSlopeAt(h, x + ox, z + oz));
   candidates.push({x, z, room, slope, worst});
  }
 }
 if (!candidates.length) return {...centre};
 // Scored in one pass rather than filtered in stages. A ladder of relaxations
 // reads as tidier but it falls off a cliff: on a severe green no location
 // satisfies a Thursday setup, every stage rejects everything, and the cup lands
 // wherever the last-resort sort happened to leave it -- which measured as three
 // and a half per cent of slope on a day that asked for under two.
 //
 // The weights say what matters in what order: never put the cup somewhere a
 // ball cannot rest, then hit the day's slope, then the day's room. Exceeding
 // the cap costs six times what missing the target slope by the same amount
 // does, so a legal location always beats a closer one that is not.
 const room = ROOM_FLOOR;
 const usable = candidates.filter(c => c.room >= room);
 const pool = usable.length ? usable : candidates;
 const score = c =>
  6 * Math.max(0, c.worst - day.cap) +
  Math.abs(c.slope - day.slope) +
  // One-sided. Short of the day's minimum is a fault; beyond it is just green.
  .8 * Math.max(0, day.edge - c.room);
 pool.sort((a, b) => score(a) - score(b));
 // A little choice among the near-equals, so two courses on the same green shape
 // do not cut the cup in identical places.
 const spread = pool.filter(c => score(c) <= score(pool[0]) + .25);
 const pick = spread[Math.floor(rng() * spread.length)] ?? pool[0];
 return {x: pick.x, z: pick.z};
}

export function fairwayWidth(h,z,margin=0,side=0){
 const start=(h.mowStart??h.fairwayStart??22)-margin,end=h.length+margin;if(z<start||z>end)return 0;
 const cap=12+margin,capFactor=Math.sqrt(Math.max(0,1-(1-clamp(Math.min(z-start,end-z)/cap,0,1))**2));
 const green=(h.greenSize??17)*(h.greenAspect??1.17);
 // An approach reads as an apron the green wears, so it never runs wider than
 // the green itself; a full fairway width there would just look like a fairway.
 const full=side<0?h.leftWidth(z):side>0?h.rightWidth(z):h.width(z),width=h.par===3?Math.min(full,green*.95):full;
 // A hole necks down into an approach at the green, because an approach is a
 // different shot played to a different target. A driving range does not: its
 // whole value is that the turf is the same everywhere, and necking the back of
 // the field to green width would pinch the one part long clubs land on. The
 // flag lives here rather than in the range builder because BOTH the ground
 // shader's width texture and localSurface call this function -- putting it
 // anywhere else would let the painted corridor and the classified lie drift.
 const blend=h.noNeck?0:smooth((z-(h.length-28))/28),neck=Math.min(width,green*.65);
 return (width*(1-blend)+neck*blend+margin)*capFactor;
}
export function hazardProfile(o,z){if(!o.banks)return {x:o.x,rx:o.rx};const f=clamp((z-o.z)/o.rz*.5+.5,0,1)*(o.banks.length-1),i=Math.min(o.banks.length-2,Math.floor(f)),t=f-i;return {x:o.banks[i].x+(o.banks[i+1].x-o.banks[i].x)*t,rx:o.banks[i].rx+(o.banks[i+1].rx-o.banks[i].rx)*t};}
export function hazardMetric(x,z,o,margin=0){const profile=hazardProfile(o,z),nx=(x-profile.x)/(profile.rx+margin),nz=(z-o.z)/(o.rz+margin),a=Math.atan2(nz,nx);return Math.hypot(nx,nz)/(o.banks?1:1+(o.wave2??0)*Math.sin(a*2+o.phase)+(o.wave3??.07)*Math.sin(a*3+o.phase));}
export function ovalRadius(o,a,margin=0){if(o.banks){const z=o.z+Math.sin(a)*(o.rz+margin),p=hazardProfile(o,z);return {x:p.x-o.x+Math.cos(a)*(p.rx+margin),z:z-o.z};}return {x:Math.cos(a)*(o.rx+margin)*(1+(o.wave2??0)*Math.sin(a*2+o.phase)+(o.wave3??.07)*Math.sin(a*3+o.phase)),z:Math.sin(a)*(o.rz+margin)*(1+(o.wave2??0)*Math.sin(a*2+o.phase)+(o.wave3??.07)*Math.sin(a*3+o.phase))};}

// FITTING A POND TO THE GROUND IT SITS IN.
//
// Extracted so that a pond a channel creates at a sink goes through exactly
// this, rather than through a parallel copy that has to be kept in step with
// the cut bank, the shore band, the mown collar and the rim tolerances. It
// shrinks the body up to six times to find a site it can sit level on, and
// returns null for one that cannot -- which is the caller's cue to drop it.
export function fitPondBasin(h,p,shapedLand){
 let low,high;for(let attempt=0;attempt<6;attempt++){const elevations=Array.from({length:128},(_,i)=>{const e=ovalRadius(p,i*Math.PI/64),q=h.toWorld({x:p.x+e.x,z:p.z+e.z});return shapedLand(q.x,q.z);});low=Math.min(...elevations);high=Math.max(...elevations);if(high-low<=(p.large?24:6))break;const old={...p},factor=.76;p.rz*=factor;p.banks=Array.from({length:257},(_,j)=>{const b=hazardProfile(old,p.z+(j/256*2-1)*p.rz);return{x:b.x,rx:b.rx*factor};});p.x=p.banks[128].x;p.rx*=factor;}
 if(high-low>(p.large?26:9))return null;p.shoreWidth=(p.large?24:14)+(high-low)*2;
 // Fit the flat lake below both the shoreline and its outer transition. A
 // center-only elevation can perch a lake above the downhill bank.
 for(let i=0;i<128;i++){const e=ovalRadius(p,i*Math.PI/64),r=Math.hypot(e.x,e.z);for(const f of [.5,1]){const scale=1+p.shoreWidth*f/r,q=h.toWorld({x:p.x+e.x*scale,z:p.z+e.z*scale});low=Math.min(low,shapedLand(q.x,q.z));}}
 p.level=low-WATER_FREEBOARD;p.reachX=Math.max(...p.banks.map(b=>Math.abs(b.x-p.x)+b.rx));return {h,b:p,pond:true,reach:Math.max(p.reachX,p.rz)+p.shoreWidth+4};
}

export function insideOval(x,z,o,margin=0){return hazardMetric(x,z,o,margin)<1;}
export function generateCourse(settings={},hole=0){
 const s={...SCHEMA_DEFAULTS,...settings,courseYards:settings.courseYards??(settings.holes===18?6480:3240)},rng=random(s.seed+':'+hole),bio=BIOMES[s.biome]||BIOMES.pnw;
 const greenSize=14+rng()*7,greenAspect=.95+rng()*.38,greenWave2=(rng()-.5)*.13,greenWave3=.025+rng()*.075,greenWave5=.015+rng()*.035;
 const planned=planCourse(s).holes[hole%s.holes],par=planned.par,phase=rng()*6.28,isDogleg=par!==3&&!!planned.turnSign,angle=isDogleg?planned.turnSign*s.doglegAngle*(.72+rng()*.28):0;
 const turnFraction=clamp(s.doglegPosition/100+(rng()-.5)*.44,.20,.86),soft=.025+rng()*.045;
 const corner=t=>(t+Math.sqrt(t*t+soft*soft))/2,raw=u=>u-corner(u-turnFraction)/(1-turnFraction),r0=raw(0),r1=raw(1);
 let lo=0,hi=Math.abs(angle)*Math.PI/180;for(let i=0;i<35;i++){const a=(lo+hi)/2,b=Math.abs(angle)*Math.PI/180-a;if(turnFraction*Math.tan(a)>(1-turnFraction)*Math.tan(b))hi=a;else lo=a;}const slope=Math.sign(angle)*Math.tan((lo+hi)/2);
 const wiggles=Array.from({length:3},(_,i)=>({frequency:i+2,amplitude:(rng()-.5)*.018/(i+1)}));
 const unitCenter=u=>slope*(raw(u)-r0-(r1-r0)*u)+(isDogleg?wiggles.reduce((v,w)=>v+Math.sin(u*Math.PI*w.frequency)*w.amplitude,0):0);
 let arc=0;for(let i=0;i<1000;i++)arc+=Math.hypot(unitCenter((i+1)/1000)-unitCenter(i/1000),.001);
 const length=planned.yards*.9144/arc,pivot=length*turnFraction,center=z=>length*unitCenter(clamp(z/length,0,1));
 // Each edge is an independent, smooth random field. No outline/profile catalogue.
 const widthTrend=(rng()-.5)*1.8;
 const makeEdge=()=>{const count=4+Math.floor(rng()*5),knots=[0,...Array.from({length:count-2},(_,i)=>(i+1+(rng()-.5)*.65)/(count-1)),1],trend=widthTrend+(rng()-.5)*.65,base=.85+rng()*.35,values=knots.map(u=>clamp(base+trend*(u-.5)+(rng()-.5)*1.05,.42,1.85));return{knots,values};};
 const leftEdge=makeEdge(),rightEdge=makeEdge();
 if(par===3)for(const edge of [leftEdge,rightEdge])edge.values=edge.values.map(v=>1+(v-1)*.35);
 const sample=(edge,u)=>{let i=0;while(i<edge.knots.length-2&&u>edge.knots[i+1])i++;return edge.values[i]+(edge.values[i+1]-edge.values[i])*smooth((u-edge.knots[i])/(edge.knots[i+1]-edge.knots[i]));};
 const sideWidth=(edge,z)=>s.width/2*sample(edge,clamp(z/length,0,1))*Math.sqrt(1+(center(z+.5)-center(z-.5))**2);
 const leftWidth=z=>sideWidth(leftEdge,z),rightWidth=z=>sideWidth(rightEdge,z),width=z=>Math.max(leftWidth(z),rightWidth(z));
 const teeNames=enabledTees(s),tees=Object.fromEntries(teeNames.map((name,i)=>{const z=i===0?0:length*(i*.09+(rng()-.5)*.032);return[name,{x:center(z)+(i===0?0:(rng()-.5)*6),z,yards:0}];}));
 const fairwayStart=Math.min(length*.54,Math.max(...Object.values(tees).map(t=>t.z))+14+rng()*45);
 // Where mown turf begins, which is not where the hole's hazard zone begins. A
 // par three is played through the air to the green, so a full corridor down it
 // is turf nobody uses and it swallows the tees; it gets a short approach in
 // front of the green instead. fairwayStart still anchors bunker and pond
 // placement, so par threes keep their hazards.
 // Never more than the last 45% of the hole, or a short par three would wear an
 // approach down most of its length and read as a narrow fairway again.
 const mowStart=par===3?Math.max(Math.max(...Object.values(tees).map(t=>t.z))+22,length*.55,length-(greenSize+38)):fairwayStart;
 const tee={x:0,z:0},green={x:center(length),z:length},bounds={x:Math.max(220,s.doglegAngle*3+100),minZ:-180,maxZ:length+150},ponds=[],bunkers=[];
 const fairwayGuide={fairwayStart,length,greenSize,greenAspect,leftWidth,rightWidth,width};
 for(let i=0;i<(NO_INLAND_WATER.has(s.biome)?0:Math.round(s.water/27));i++){
  // Banks are anchored a fixed gap outside the fairway edge, so a larger pond
  // grows away from play rather than into it.
  // pondSize is a plain multiplier on both dimensions; its default of 120 leaves
  // the ranges the generator has always used.
  const pondScale=(s.pondSize??120)/120;
  let z=length*(.27+rng()*.46);const rx=(18+rng()*34)*pondScale,rz=Math.min((32+rng()*70)*pondScale,length*.30),side=rng()<.5?-1:1;
  // HOW FAR INTO PLAY THE POND IS ALLOWED TO REACH.
  //
  // The bank is anchored outside the semi-rough, and `gap` could only ever push
  // it further out -- so a pond could never touch the corridor, let alone cross
  // it. That ruled out a shape golf actually uses: water carried off the tee.
  //
  // A POND MAY BITE INTO A FAIRWAY, BUT IT MAY NOT CROSS ONE. The first version
  // of this allowed both, and a pond that reaches the far side does not pinch a
  // hole into two landing areas -- it severs it, and the player is left walking
  // round water the routing never planned a way past. The bite is the part that
  // was actually wanted: the corridor narrows, the fairway is mown around the
  // water, and the line off the tee becomes worth thinking about.
  //
  // So the crossing branch is gone, and what is left is bounded rather than
  // capped: `reach` never exceeds 0.70 of the half width, and the shore is
  // measured inward from the SEMI-ROUGH edge, so the near bank cannot arrive at
  // the centreline for any value the random stream can produce -- whatever the
  // corridor happens to be doing at that station.
  //
  // The first setting of this was too timid to be worth having: at 0.12-0.37 it
  // reached past the fairway edge on 5% of ponds and never by more than 4.1 m,
  // which is a shore beside a fairway rather than water in play. The bite has
  // to be seen from the tee to change a decision.
  const bite=rng(),halfWay=fairwayWidth(fairwayGuide,z,0,side);
  const reach=bite<.40?halfWay*(.25+rng()*.45):0;
  const gap=-s.semiRough*.8-reach+rng()*(s.semiRough*.8+10),phase=rng()*6.28,variation=[rng(),rng(),rng(),rng()],banks=[];const minZ=fairwayStart+rz+8,maxZ=length-greenSize*1.5-rz;if(minZ>maxZ)continue;z=clamp(z,minZ,maxZ);
  for(let j=0;j<=256;j++){const u=j/256,zz=z+(u*2-1)*rz,k=Math.min(2,Math.floor(u*3)),t=smooth(u*3-k),size=rx*(.65+.65*(variation[k]*(1-t)+variation[k+1]*t)),edge=center(zz)+side*fairwayWidth(fairwayGuide,zz,s.semiRough,side);banks.push({x:edge+side*(gap+.75+size),rx:size});}
  const p={x:banks[128].x,z,rx,rz,phase,banks,side,gap,depth:s.waterMin+rng()*(s.waterMax-s.waterMin)};
  p.reachX=Math.max(...banks.map(b=>Math.abs(b.x-p.x)+b.rx))+8;
  const boundary=Array.from({length:64},(_,j)=>{const q=ovalRadius(p,j*Math.PI/32);return{x:p.x+q.x,z:p.z+q.z};});
  const greenGuide={green,phase,greenSize,greenAspect,greenWave2,greenWave3,greenWave5};
  if(boundary.some(q=>greenDistance(greenGuide,q.x,q.z)<s.fringe+5||Object.values(tees).some(t=>Math.hypot(q.x-t.x,q.z-t.z)<12)))continue;
  if(!ponds.some(q=>boundary.some(v=>insideOval(v.x,v.z,q,5))||insideOval(q.x,q.z,p,5)))ponds.push(p);
 }
 // Greenside pockets are measured from the fringe, with an explicit turf gap.
 const bunkerTotal=Math.round(s.bunkerCount*(.3+rng()*.7)),greenShare=rng(),cluster=rng()*Math.PI*2;
 for(let i=0;i<bunkerTotal;i++){
  // A par three has no fairway to bunker, so every pocket guards the green. The
  // draw is still taken so the seeded stream keeps its shape.
  const roll=rng()<greenShare,greenSide=par===3||roll,rx=4.5+rng()*5.5,rz=5+rng()*9;let x,z;
  if(greenSide){const a=cluster+(greenShare>.65?(rng()-.5)*2:rng()*Math.PI*2),gr=17*(1+.075*Math.sin(a*3+phase)+.045*Math.cos(a*5)),radius=gr+s.fringe+s.bunkerGap+Math.max(rx,rz)*1.08;x=green.x+Math.cos(a)*radius*1.17;z=length+Math.sin(a)*radius;}
  else{if(length-fairwayStart<65)continue;z=fairwayStart+18+rng()*Math.max(1,length-fairwayStart-55);const side=rng()<.5?1:-1,inFairway=rng()*100<s.fairwayBunkers;x=center(z)+(inFairway?(rng()-.5)*Math.max(0,width(z)-rx)*.9:side*((side<0?leftWidth(z):rightWidth(z))+rx+1+s.bunkerGap));}
  const b={x,z,rx,rz,phase:rng()*6.28,wave2:(rng()-.5)*.1,wave3:.025+rng()*.08,greenSide};if(greenSide){const a=Math.atan2(z-green.z,(x-green.x)/greenAspect),target=s.fringe+s.bunkerGap+.04;let lo=0,hi=90;for(let j=0;j<16;j++){const radius=(lo+hi)/2;b.x=green.x+Math.cos(a)*radius*greenAspect;b.z=green.z+Math.sin(a)*radius;let gap=Infinity;for(let k=0;k<64;k++){const q=ovalRadius(b,k*Math.PI/32);gap=Math.min(gap,greenDistance({green,phase,greenSize,greenAspect,greenWave2,greenWave3,greenWave5},b.x+q.x,b.z+q.z));}if(gap<target)lo=radius;else hi=radius;}const radius=hi;b.x=green.x+Math.cos(a)*radius*greenAspect;b.z=green.z+Math.sin(a)*radius;x=b.x;z=b.z;}if(!Object.values(tees).some(t=>Math.hypot(t.x-x,t.z-z)<Math.max(rx,rz)+11)&&!ponds.some(p=>insideOval(x,z,p,Math.max(rx,rz)+3))&&!bunkers.some(p=>insideOval(x,z,p,Math.max(rx,rz)+2)))bunkers.push(b);
 }
 let routeLength=0;for(let z=0;z<length;z+=1){const next=Math.min(length,z+1);routeLength+=Math.hypot(center(next)-center(z),next-z);}
 for(const t of Object.values(tees)){let d=0;for(let z=t.z;z<length;z+=1){const next=Math.min(length,z+1);d+=Math.hypot(center(next)-center(z),next-z);}t.yards=d/.9144;}
 const h={greenSize,greenAspect,greenWave2,greenWave3,greenWave5,leftEdge,rightEdge,fairwayStart,mowStart,tees,turnFraction,routeLength,settings:s,bio,par,length,tee,green,bounds,center,width:z=>Math.max(leftWidth(z),rightWidth(z)),leftWidth,rightWidth,ponds,bunkers,seed:s.seed,hole,phase,doglegAngle:angle};
 h.toWorld=p=>({...p});h.toLocal=p=>({...p});h.rotation=0;
 // The cup, cut from the green's own contours. It needs the shape and the phase,
 // both of which are on h by now, and nothing from the wider world.
 // Its own stream of numbers, not the course's. Drawing from the shared one
 // would shift every tree, bunker and stream generated after it, so adding hole
 // locations would have quietly rebuilt every existing seed's landscape.
 h.pin=choosePin(h,hole,random(`${s.seed}-pin-${hole}`));
 h.surface=(x,z)=>localSurface(h,x,z);
 h.height=(x,z)=>s.elevation/100*(22*Math.sin(z/130)+12*Math.sin(x/100+z/170));
 h.trees=[];const count=Math.round(s.trees*(bio.treeKind==='shrub'?.25:bio.treeKind==='cactus'?.5:2.2));
 for(let i=0;i<count*3&&h.trees.length<count;i++){const z=-25+rng()*(length+70),x=(rng()-.5)*215;if(h.surface(x,z)!=='rough'||Math.abs(x-center(z))<width(z)+s.semiRough+13||Math.hypot(x-green.x,z-green.z)<31+s.fringe+s.semiRough||Math.hypot(x,z)<22)continue;const small=bio.treeKind==='shrub';h.trees.push({x,z,y:h.height(x,z),h:small?1+rng()*2:bio.treeKind==='cactus'?4+rng()*5:13+rng()*16,r:small?1+rng():3+rng()*4,shade:rng()});}
 return h;
}
// Tee pad half-extents and the maintained collar around them. A pad on its own
// reads as an oval dropped into scrub: the collar is what makes it look like
// ground somebody mows. The ground shader in ground.js paints both from these
// same numbers, so the painted surface and the classified lie cannot drift.
export const TEE_PAD={x:6,z:8},TEE_APRON={x:10.2,z:13.6};
export const TEE_EYE=1.6;
// IS THE SHOT BLIND, AND WHAT WOULD IT COST TO SEE OVER IT?
//
// Exported, and this is the point of exporting it: the generator asks this to
// decide how far to raise a tee, and a measurement asks it to report how many
// shots are blind. Written twice, the two drifted -- one sampled a straight
// line in world space and the other the centreline, which are the same line
// only on a straight hole, and the straight one cut dogleg corners and read
// terrain off the hole entirely. A metric that calls what it measures cannot
// disagree with it.
//
// `sample` is the height field to ask: the generator passes its pre-tee shaping
// field, a measurement passes the finished terrain.
//
// Returns how far the ground rises above the sightline, and what raising the
// tee would cost to clear that. Raising the eye by L lifts the sightline at
// fraction u of the way out by L*(1-u), so an obstruction h at u costs h/(1-u).
export function sightline(h,teeZ,eyeY,sample){
 // A par three is played to the green; anything else to a good drive.
 const reach=h.par===3?h.length-teeZ:Math.min(h.length-teeZ-30,250*.9144);
 if(reach<60)return {over:0,lift:0,reach:0};
 const aimZ=teeZ+reach,aim=h.toWorld({x:h.center(aimZ),z:aimZ});
 const target=sample(aim.x,aim.z);
 let over=0,lift=0;
 // SAMPLED ALONG THE CENTRELINE, NOT ALONG A STRAIGHT LINE IN WORLD SPACE, and
 // only the first three quarters of the shot. Near the target 1-u goes to zero
 // and the required lift goes to infinity with it: a 0.35 m ripple at u = 0.9
 // asked for the full cap, which is how a DEAD FLAT course came back with a
 // 3.5 m mound on it. Ground that close to the landing area is the landing
 // area's own contour, and no amount of tee clears it anyway.
 for(let d=20;d<reach*.75;d+=6){
  const u=d/reach,zz=teeZ+d,at=h.toWorld({x:h.center(zz),z:zz});
  const o=sample(at.x,at.z)-(eyeY+(target-eyeY)*u);
  if(o>over)over=o;
  // A threshold, so the height field's own ripple cannot raise a tee.
  if(o>.15)lift=Math.max(lift,o/Math.max(.25,1-u));
 }
 return {over,lift,reach};
}
export function localSurface(h,x,z){
 const d=greenDistance(h,x,z),s=h.settings;
 if(d<=0)return 'green';if(d<=s.fringe)return 'fringe';
 if(Object.values(h.tees).some(t=>((x-t.x)/TEE_PAD.x)**2+((z-t.z)/TEE_PAD.z)**2<1))return 'tee';
 if(h.ponds.some(p=>insideOval(x,z,p)))return 'water';
 if(h.bunkers.some(p=>insideOval(x,z,p)))return 'sand';
 // The fairway is tested BEFORE the green's semi collar, and the order is the
 // whole point. The ground shader paints the mown corridor OVER that collar, so
 // an apron running up to the fringe is drawn as fairway; testing the collar
 // first here returned 'semi' for the same ground and the painted surface then
 // disagreed with the lie the ball actually got. It was about half a percent of
 // a hole -- the apron short of every green -- and invisible until the driving
 // range put a green inside a full-width corridor and made it 1.4%.
 if(Math.abs(x-h.center(z))<fairwayWidth(h,z,0,x-h.center(z)))return 'fairway';
 if(d<=s.fringe+s.semiRough||Math.abs(x-h.center(z))<fairwayWidth(h,z,s.semiRough,x-h.center(z)))return 'semi';
 // Last, so anything already maintained keeps the better surface and a bunker
 // or pond beside a tee still plays as itself.
 if(Object.values(h.tees).some(t=>((x-t.x)/TEE_APRON.x)**2+((z-t.z)/TEE_APRON.z)**2<1))return 'semi';
 return 'rough';
}
// AN ISLAND'S WATER IS THE OCEAN.
//
// Ponds, lakes, rivers and creeks are all switched off there. The land is a
// narrow strip with sea on every side, so an inland hazard is both redundant --
// the ocean is already in play on most shots -- and the hardest possible site to
// place one on: a pond needs flat ground clear of the corridor, and an island
// has very little that is not already within sight of the coast.
//
// This is the biome deciding what it is, not a settings validation: the pond and
// channel controls keep their values, so switching a course to island and back
// returns the water it had.
export const NO_INLAND_WATER = new Set(['island']);

// WHERE THE SEA MEETS THE LAND.
//
// The ocean is the one body of water that does NOT get a cut bank: a coast is a
// beach, not an excavation. Ponds, lakes and channels are dug into the ground
// and hold a level; the sea is the level, and the land runs down into it.
//
// Keyed to HEIGHT ABOVE SEA LEVEL rather than to distance from the water, which
// is both simpler and more nearly right -- a flat shore gets a broad beach and a
// steep one a narrow strip, for the same reason real beaches do. `land` already
// carries the number, so no new distance field is needed.
//
// BEACH_RISE is where sand stops, and where it stops PLAYING as sand. BEACH_FADE
// is how far above that the colour keeps blending, so the beach does not end on
// a contour line. The lie switches on the first of those two only, so the ball
// and the paint change surface at the same height.
export const BEACH_RISE = .9, BEACH_FADE = .8;
// AND THE SHORE HAS TO BE FLAT ENOUGH TO HOLD ONE.
//
// Measured before this existed, the island coast rose a metre for every metre
// inland -- forty-five degrees, a cliff -- and the 4 m contour was eight metres
// from the water. No classification rule can make a beach out of that; the sand
// would have been a two-metre ribbon. A beach is a landform, so it is made in
// the landform.
//
// Ground between sea level and BEACH_TOP is pulled down toward the water by a
// power curve, which flattens the foreshore while leaving the waterline itself
// exactly where it was -- the curve is anchored at 0, so nothing about which
// ground is sea changes. Above BEACH_TOP the island is untouched.
// The curve has to REJOIN the land, not just meet it. A plain power curve
// anchored at zero and BEACH_TOP hits the top of the beach with several times
// the natural gradient -- a 4.2 power puts a seventy-degree wall exactly where
// the sand should be running out into the dunes. Easing the height toward zero
// instead leaves both the value and the slope continuous at BEACH_TOP, so the
// foreshore flattens without building a cliff behind itself.
export const BEACH_TOP = 16;
// Over how many metres the greenside allowance in `nearest` comes in. Long
// enough that the change of distance stays gentler than the ground it is
// shaping; see the note on `nearest` itself.
export const GREEN_RAMP = 30;
// HOW FAR THE MOWN OUTLINE IS ROUNDED WHERE TWO EDGES MEET.
//
// The fairway near water is the intersection of two regions -- inside the
// corridor, and clear of the water's reach -- and an intersection has a sharp
// corner where its two boundaries cross. A mower cannot cut a sharp corner; it
// arrives on an arc. Rounding that corner is the whole of this change, and it
// is deliberately small: it moves about 0.2% of a hole, all of it within a
// couple of metres of one point.
//
// The band's WIDTH is untouched. Measured, the visible band was already exactly
// the hole's semi-rough whatever the size of the water body -- what varied was
// only the shape where a pond's band ran into the corridor's own.
export const BAND_ROUND = 2;
// Polynomial smooth-max, the same one ground.js uses, so the painted outline and
// the lie round by the same arc. At k <= 0 it is a plain max.
export const smoothMax = (a, b, k) => {
 if (!(k > 0)) return Math.max(a, b);
 const h = Math.max(0, 1 - Math.abs(a - b) / k) * .5;
 return Math.max(a, b) + h * h * k;
};
// AND ONLY NEAR THE COAST. The first version keyed on elevation alone, so every
// piece of ground under BEACH_TOP was eased toward sea level -- measured, a tee
// 510 m inland dropped from 11.34 m to 9.01 m. Worse than the drop was the
// gradient: d/dy of y*smooth(y/T) reaches about 1.67 in the middle of the range,
// so the curve AMPLIFIED every slope it touched by two thirds. That is where the
// steep edges came from, and why tee pads stopped sitting flat -- the worst pad
// spread grew by exactly that ratio, 0.455 m to 0.760 m.
//
// `near` is the coastal blend, so the shaping lives where the coast is and
// nowhere else. Sharpened with a smoothstep because the raw blend is only about
// 0.6 at the waterline, which would otherwise cost most of the beach.
export const foreshore = (y, near = 1) => {
 if (!(y > 0) || y >= BEACH_TOP) return y;
 const w = smooth((near - .06) / .24);
 return y + (y * smooth(y / BEACH_TOP) - y) * w;
};

export function generateWorld(settings={}){
 const s={...SCHEMA_DEFAULTS,...settings,courseYards:settings.courseYards??(settings.holes===18?6480:3240)};s.holes=s.holes===18?18:s.holes===1?1:9;s.waterMin=clamp(s.waterMin,.2,8);s.waterMax=clamp(s.waterMax,s.waterMin,12);
 // The driving range is one hand-built hole rather than a generated one, but it
 // is still a hole, so everything past this line -- routing, terrain, ground
 // textures, vegetation -- treats it exactly like any other and needs no branch.
 const bio=BIOMES[s.biome],holes=s.range?[buildRange(s,0)]:Array.from({length:s.holes},(_,i)=>generateCourse(s,i)),{halfX,halfZ,footprint}=routeHoles(holes,s,random),waterLevel=0,severity=s.elevation/100;
 const phase=random(s.seed+':land')()*100,coastal=s.biome==='island';
 // THE GREEN-END ALLOWANCE IS RAMPED, NOT SWITCHED.
 //
 // This read `zz===h.length ? 25+fringe+semiRough : 0` -- an exact float
 // equality on a clamped coordinate, so the instant a point passed the end of a
 // hole the allowance appeared whole. The distance stepped by 25+fringe-width in
 // nothing at all: measured at 57.04 m to 39.94 m across a QUARTER METRE, with
 // the same owning hole either side.
 //
 // `land` reads this distance, so every course has been torn along a line at the
 // end of every hole -- worst single step 10.87 m on mountain, 7.18 m on island,
 // 4.65 m on pnw. It shows on an island because a waterline draws it: the
 // coastline jumped up to 222 m sideways where the tear crossed it. Ramping the
 // allowance in over GREEN_RAMP removes the step at its source, for every biome.
 //
 // The ramp runs BEYOND the green, not up to it. Starting it before the green
 // reshaped the ground the green sits in -- the surround-slope test went from
 // passing to 0.624 against a 0.6 limit -- because the allowance was already
 // growing across exactly the ground that test measures. One-sided, the
 // allowance is still exactly the corridor everywhere up to the green, so the
 // green surround is untouched, and it grows only out past the end where the
 // step used to be. Continuous at the join either way.
 //
 // Note this reshapes EVERY seed beyond its greens. There was no version of
 // fixing it that did not.
 function nearest(x,z){let best=holes[0],distance=Infinity,local=null;const groups=new Array(Math.ceil(holes.length/3)).fill(Infinity);for(const h of holes){const p=h.toLocal({x,z}),zz=clamp(p.z,0,h.length),corridor=h.width(zz)+s.semiRough,greenEnd=25+s.fringe+s.semiRough,d=Math.hypot(p.x-h.center(zz),p.z-zz)-(corridor+Math.max(0,greenEnd-corridor)*smooth((p.z-h.length)/GREEN_RAMP));groups[Math.floor(h.hole/3)]=Math.min(groups[Math.floor(h.hole/3)],d);if(d<distance){best=h;distance=d;local=p;}}return{h:best,p:local,d:distance,other:Math.min(...groups.filter((_,i)=>i!==Math.floor(best.hole/3)))};}
 const nearby=(x,z)=>nearest(x,z).h;
 const base=(x,z)=>Math.max(coastal?1.8:-100,(coastal?3.5:12)+severity*((coastal?15:22)+(coastal?12:22)*Math.sin(x/145+phase)*Math.cos(z/190)+(coastal?6:12)*Math.sin(z/94+x/180)));
 // Hazards follow their local ground elevation instead of draining every lake
 // down to a single sea level. Depth is the selected maximum basin depth.
 for(const h of holes){h.ponds=h.ponds.filter(p=>{const q=h.toWorld(p);return nearby(q.x,q.z)===h&&Array.from({length:24},(_,i)=>{const edge=ovalRadius(p,i*Math.PI/12,1);const v=h.toWorld({x:p.x+edge.x,z:p.z+edge.z});return nearby(v.x,v.z)===h;}).every(Boolean)&&!holes.some(other=>other!==h&&['tee','green','fringe','fairway'].includes(localSurface(other,other.toLocal(q).x,other.toLocal(q).z)));});for(const p of h.ponds){const q=h.toWorld(p);p.level=base(q.x,q.z)-.45;}}
 function land(x,z,n=nearest(x,z)){
  const rolling=.45+.28*Math.sin(x/96+phase)*Math.cos(z/113)+.2*Math.sin(x/49-z/71),relief=s.landform/100;
  if(coastal){const reach=28+(1-relief)*50+12*Math.sin(x/66+Math.sin(z/91)),coast=Math.max(smooth((n.d-reach)/30),(1-smooth((n.other-n.d)/(18+relief*20)))*smooth(n.d/6));const depth=s.waterMin+(s.waterMax-s.waterMin)*(.5+.25*Math.sin(x/130+phase)+.25*Math.cos(z/170));return foreshore(base(x,z)*(1-coast)-depth*coast,coast);}
  let hills=0;
  if(s.biome==='mountain')hills=relief*(70+severity*180)*rolling*smooth(n.d/90);
  else if(s.biome==='links')hills=relief*(14+severity*35)*rolling*smooth(n.d/42);
  else if(s.biome==='desert')hills=relief*(25+severity*75)*rolling*smooth(n.d/90);
  else hills=relief*(s.biome==='pnw'?45:18)*rolling*smooth(n.d/70);
  let y=base(x,z)+hills;
  if(s.biome==='links'){const coast=smooth((x-(halfX-90+Math.sin(z/150)*30))/90);y=foreshore(y*(1-coast)-s.waterMax*coast,coast);}
  return y;
 }
 // OPEN WATER, AS OPPOSED TO GROUND THAT MERELY SITS LOW.
 //
 // Only the two biomes that have a coast can answer yes: elsewhere `land` may
 // go negative in a deep valley without any sea being there, and treating that
 // as ocean would refuse ponds and trim channels on perfectly dry ground.
 //
 // This is the raw landform, deliberately -- not `shapedLand`. Shaping is what
 // ponds and channels do TO the land, and no water body may decide it is on dry
 // ground because another one already dug a hole there.
 const isSea=(coastal||s.biome==='links')?((x,z)=>land(x,z)<0):(()=>false);
 // Every local modifier has compact, continuous support. Never switch height
 // functions at the nearest-hole boundary (that used to cut cracks into ridges).
 const modifiers=holes.map(h=>({h,minX:Math.min(h.worldTee.x,h.worldGreen.x)-180,maxX:Math.max(h.worldTee.x,h.worldGreen.x)+180,minZ:Math.min(h.worldTee.z,h.worldGreen.z)-180,maxZ:Math.max(h.worldTee.z,h.worldGreen.z)+180}));
 // Settle the ground to a level shelf under each pond rather than hunting for a
 // site that happens to be flat. Targets are read off the base landform, and the
 // green/tee modifiers below still override this where they overlap, so a pond
 // can never flatten a green complex.
 const pondSites=[],tooSteep=new Set();
 // Shrink a pond toward ground it can actually sit on before giving up on it.
 // Levelling a shelf for a pond on a hillside means a deep cut, and cutting one
 // per pond flattened half the course; a smaller pond needs a smaller shelf.
 const shrinkPond=(p,factor)=>{const old={...p};p.rz*=factor;p.banks=Array.from({length:257},(_,j)=>{const b=hazardProfile(old,p.z+(j/256*2-1)*p.rz);return{x:b.x,rx:b.rx*factor};});p.x=p.banks[128].x;p.rx*=factor;p.reachX=Math.max(...p.banks.map(b=>Math.abs(b.x-p.x)+b.rx));};
 for(const h of holes)for(const p of h.ponds){
  let site=null;
  for(let attempt=0;attempt<5&&!site;attempt++){
   const reach=Math.max(p.reachX||p.rx,p.rz),c=h.toWorld(p),ring=[];
   // THE SEABED IS NOT STEEP GROUND, IT IS NOT A SITE.
   //
   // These samples judge whether the terrain around a pond is flat enough to
   // hold one. On a coast the ground falls to minus the water depth within tens
   // of metres of anywhere, so an unclamped sample read the sea as a cliff and
   // every island pond was rejected as too steep -- measured at zero ponds and
   // zero lakes per island course, against two of each everywhere else. Clamped
   // at the waterline the test judges the land; `drowned` below is what keeps a
   // pond out of the water, and it does it by refusing the site outright.
   for(let i=0;i<24;i++){const e=ovalRadius(p,i*Math.PI/12,2),q=h.toWorld({x:p.x+e.x,z:p.z+e.z});ring.push(Math.max(0,land(q.x,q.z)));}
   if(isSea(c.x,c.z)||Array.from({length:12},(_,i)=>{const e=ovalRadius(p,i*Math.PI/6,2);const q=h.toWorld({x:p.x+e.x,z:p.z+e.z});return isSea(q.x,q.z);}).some(Boolean)){tooSteep.add(p);break;}
   ring.sort((a,b)=>a-b);
   // The margin scales with the pond. Holding it at a fixed 34 m meant a pond
   // could shrink to a third of its size and still be judged over nearly the
   // same footprint, so the rise never fell and steep biomes lost every pond.
   const target=ring[Math.floor(ring.length*.3)],innerM=Math.max(11,Math.min(34,reach*.6));
   // How far the ground stands above the shelf, across the rim and outward.
   // Margins run out from the pond's own outline, never from a circle around its
   // longest axis: circling a long thin pond levelled a disc many times its size.
   // Measured over the shelf that actually gets cut — the outline plus its
   // margin — and nothing further out. Sampling at fixed distances instead meant
   // the figure never fell as a pond shrank, so shrinking could never help and
   // hilly courses lost every pond.
   let rise=ring[ring.length-1]-target;
   for(let i=0;i<24;i++){const a=i*Math.PI/12,e=ovalRadius(p,a),len=Math.hypot(e.x,e.z)||1,ux=e.x/len,uz=e.z/len;
    for(const d of [innerM*.5,innerM]){const q=h.toWorld({x:p.x+e.x+ux*d,z:p.z+e.z+uz*d});rise=Math.max(rise,Math.max(0,land(q.x,q.z))-target);}}
   if(rise>15){shrinkPond(p,.78);continue;}
   const outerM=innerM+Math.max(45,Math.min(150,rise*6)),span=reach+outerM;
   site={h,p,x:c.x,z:c.z,reach,target,innerM,outerM,minX:c.x-span,maxX:c.x+span,minZ:c.z-span,maxZ:c.z+span};
  }
  if(site)pondSites.push(site);else tooSteep.add(p);
 }
 if(tooSteep.size)for(const h of holes)h.ponds=h.ponds.filter(p=>!tooSteep.has(p));
 // Ponds whose shelves overlap settle to one shared level, the lowest of them.
 // Two shelves at different heights meeting under a pond is what left its water
 // metres below its own bank: the rim sat on this pond's shelf while the outer
 // bank sampling reached into the neighbour's, and the level followed the lower.
 for(let pass=0;pass<pondSites.length;pass++){
  let merged=false;
  for(let i=0;i<pondSites.length;i++)for(let j=i+1;j<pondSites.length;j++){
   const a=pondSites[i],b=pondSites[j];
   if(a.target===b.target||Math.hypot(a.x-b.x,a.z-b.z)>a.reach+b.reach+70)continue;
   a.target=b.target=Math.min(a.target,b.target);merged=true;
  }
  if(!merged)break;
 }
 function shapedNoTees(x,z){let y=land(x,z);
 // Overlapping pond shelves are averaged with a weight that runs away as a site
 // reaches full strength, so the pond you are standing beside decides the level
 // while the field stays continuous. Applying each site in turn let a pond in a
 // valley drag the shelf under a pond on a hill down to its own level; picking
 // only the nearest instead put a cliff wherever the winner changed.
 let pondBlend=0,weightSum=0,targetSum=0;
 for(const s of pondSites){
  if(x<s.minX||x>s.maxX||z<s.minZ||z>s.maxZ)continue;
  const q=s.h.toLocal({x,z}),metric=hazardMetric(q.x,q.z,s.p);
  const shore=metric<=1?0:(metric-1)*Math.hypot(q.x-s.p.x,q.z-s.p.z)/metric;
  const b=1-smooth((shore-s.innerM)/(s.outerM-s.innerM));
  if(b<=0)continue;
  const weight=b/(1.001-b);
  pondBlend=Math.max(pondBlend,b);weightSum+=weight;targetSum+=weight*s.target;
 }
 if(pondBlend>0)y=y*(1-pondBlend)+targetSum/weightSum*pondBlend;for(const {h,minX,maxX,minZ,maxZ} of modifiers){if(x<minX||x>maxX||z<minZ||z>maxZ)continue;const p=h.toLocal({x,z}),d=greenDistance(h,p.x,p.z),greenY=base(h.worldGreen.x,h.worldGreen.z)+greenContour(h,p.x,p.z),shoulder=40+Math.min(60,Math.abs(y-greenY)*4),blend=1-smooth((d-s.fringe-1)/shoulder);if(blend>0)y=y*(1-blend)+greenY*blend;}
 return y;}
 // A tee is a terrace cut into whatever the rest of the shaping already
 // decided, so its height is sampled from shapedNoTees rather than from the
 // raw landform: levelling to land() put a step wherever a tee sat inside a
 // green shoulder or a pond shelf. The ramp off the pad widens with the drop
 // it has to absorb, the way a green shoulder does. A fixed five-metre ramp
 // left a wall around every pad once the ground got steep.
 const teePads=[];
 for(const h of holes)for(const t of Object.values(h.tees)){const q=h.toWorld(t);teePads.push({h,t,x:q.x,z:q.z});}
 // Must cover the apron plus the WIDEST ramp, or the falloff is cut off part
 // way down and the cut is a crease. At the old 78 a full-lift pad wanted 98
 // and got 64, which is where the one 13.5 degree outlier came from.
 const PAD_REACH=115;
 // A TEE COMPLEX IS LEVELLED AS ONE THING, NOT AS THREE INDEPENDENT PADS.
 //
 // Each pad used to read its own height straight off the shaped landform, and
 // the three sit at 0%, 9% and 18% down the hole -- so on any hole that climbs
 // off the tee the order simply inverted, with the back tee lowest. That is not
 // a bug in the shaping; there was never a rule saying the back tee should be
 // the high one. Measured over 270 holes, 34% had at least one tee stacked
 // backwards, worst single step 2.9 m.
 //
 // Two things happen here, and they are the same lever: deciding the complex's
 // level deliberately instead of reading it off the ground.
 const TEE_COMPRESS=.45,TEE_STEP=.35,TEE_LIFT_CAP=3.5;
 // A BLIND TEE SHOT IS A CHOICE, NOT AN ACCIDENT. Real courses keep a few, and
 // the raising above would otherwise remove every one the land offers. This is
 // the share of holes allowed to keep theirs, drawn per hole from its own
 // stream so changing the dial does not reshuffle anything else. Only holes the
 // land actually makes blind can be chosen, so the true rate tops out at
 // whatever the terrain supplies -- measured, about one hole in five.
 const blindRng=random(s.seed+':blind-tees'),blindShare=(s.blindTees??0)/100;
 for(const h of holes){
  const keepBlind=blindRng()<blindShare;
  const names=Object.keys(h.tees);                       // back to front
  const pads=names.map(n=>teePads.find(p=>p.h===h&&p.t===h.tees[n]));
  // ONE: compress the natural spread, then enforce the order. Clamping alone
  // would guarantee the order too, but it does it by raising the back tee to
  // wherever the front one ended up -- a pimple with a 55 m ramp around it on
  // steep ground. Pulling all three toward their mean first means the order
  // costs a fraction of the natural difference rather than all of it, and each
  // pad stays close to the ground it sits on.
  const natural=pads.map(p=>shapedNoTees(p.x,p.z));
  const mean=natural.reduce((a,b)=>a+b,0)/natural.length;
  const level=natural.map(y=>mean+(y-mean)*TEE_COMPRESS);
  // THE STEP CORRECTS AN INVERSION; IT DOES NOT MANUFACTURE A STAIRCASE. Scaled
  // by the spread the ground already has, so on flat land it is zero and the
  // three pads come out level -- which is both what a flat course should look
  // like and what the elevation slider promises at 0. A fixed step built a 0.7 m
  // mound on dead-flat ground, and tilted the driving range, whose three mats
  // sit side by side at the same distance and must stay identical.
  const step=Math.min(TEE_STEP,(Math.max(...natural)-Math.min(...natural))*.5);
  for(let i=level.length-2;i>=0;i--)level[i]=Math.max(level[i],level[i+1]+step);
  // TWO: lift the whole complex until the shot clears the ground in front of
  // it. This is what an architect does, and it is the cheap half of the blind
  // shot problem -- the tee moves rather than the hillside, so the terrain the
  // hole was generated around is untouched. Measured, 24% of tee shots had the
  // sightline blocked by more than a metre.
  //
  // Raising the eye by L lifts the sightline at fraction u of the way to the
  // target by L*(1-u), so clearing an obstruction of `over` at u costs
  // over/(1-u) -- a crest halfway out needs twice its own height in tee.
  let lift=0;
  for(let i=0;i<pads.length;i++)
   lift=Math.max(lift,sightline(h,h.tees[names[i]].z,level[i]+TEE_EYE,shapedNoTees).lift);
  // Capped, because past a few metres this stops being a raised tee and starts
  // being a plinth. What it cannot clear stays a blind shot.
  lift=keepBlind?0:Math.min(lift,TEE_LIFT_CAP);
  pads.forEach((p,i)=>{p.y=level[i]+lift;});
 }
 function shapedLand(x,z){
  let y=shapedNoTees(x,z),blend=0,weightSum=0,targetSum=0;
  for(const pad of teePads){
   if(Math.abs(x-pad.x)>PAD_REACH||Math.abs(z-pad.z)>PAD_REACH)continue;
   // AN OVAL, BECAUSE THE PAINT IS AN OVAL.
   //
   // This was a BOX -- the larger of the two axis overhangs -- while the tee
   // surface and its mown collar are both ellipses. At each of the four corners
   // the flat ground therefore jutted about 3 m past the painted tee, so the
   // shading broke along a rectangle that nothing on screen agreed with. The
   // plateau reaches the APRON rather than the pad as well, so the whole mown
   // collar is flat ground: it was sitting on the ramp, carrying 0.33 m of
   // relief at the median and 0.82 m at worst, which is a mown surface visibly
   // tilting away from the dead-flat pad inside it.
   //
   // Same idiom the pond shelves use: normalise into the ellipse, then convert
   // back to metres along the ray so the ramp width means the same thing in
   // every direction.
   const q=pad.h.toLocal({x,z}),ex=(q.x-pad.t.x)/TEE_APRON.x,ez=(q.z-pad.t.z)/TEE_APRON.z,e=Math.hypot(ex,ez);
   const out=e<=1?0:(e-1)*Math.hypot(q.x-pad.t.x,q.z-pad.t.z)/e;
   // Wider and gentler than the first version, which reached full slope in 26 m
   // for a 3.5 m lift and read as a mound sitting on the ground rather than
   // ground that rises to a tee.
   const level=pad.y,ramp=14+Math.min(70,Math.abs(y-level)*7);
   const b=1-smooth(out/ramp);
   if(b<=0)continue;
   // Same weighting the pond shelves use: the pad you are standing on decides
   // the height while neighbouring pads stay continuous with it, instead of
   // whichever one the loop happened to reach last.
   const weight=b/(1.001-b);
   blend=Math.max(blend,b);weightSum+=weight;targetSum+=weight*level;
  }
  return blend>0?y*(1-blend)+targetSum/weightSum*blend:y;
 }
 if(!NO_INLAND_WATER.has(s.biome))addLargeLakes(s,holes,halfX,halfZ,nearest,shapedLand,random);
 let basins=[];
 for(const h of holes){h.ponds=h.ponds.filter(p=>{const basin=fitPondBasin(h,p,shapedLand);if(basin)basins.push(basin);return !!basin;});
 for(const b of h.bunkers){const q=h.toWorld(b);let low=Infinity;for(let i=0;i<24;i++){const e=ovalRadius(b,i*Math.PI/12),v=h.toWorld({x:b.x+e.x,z:b.z+e.z});low=Math.min(low,shapedLand(v.x,v.z));}b.floor=low-1.05;b.depth=1.05;basins.push({h,b,pond:false,reach:Math.max(b.rx,b.rz)*1.3});}}
 // An island's water is the ocean: it is handed no channels rather than
 // streams.js being taught about biomes, which would make the two files
 // import each other.
 // A CHANNEL THAT ENDS IN A HOLLOW ENDS IN A POND.
 //
 // The drainage model leaves a channel at one of four places: off the edge of
 // the map, at the sea, at another channel it has joined, or at a SINK -- a
 // depression too large for the fill to have flattened away, which is to say a
 // real low point in the landscape. Until now the channel simply stopped in
 // one, which reads as water running into a hillside.
 //
 // It gets a real pond, built and fitted by the SAME `fitPondBasin` every other
 // body goes through, so it inherits the cut bank, the shore band, the mown
 // collar, the map outline, the reflection probe and the rim tolerances rather
 // than becoming a second kind of water with its own rules to keep in step.
 //
 // This is a callback rather than a pass afterwards because the join needs the
 // channel's path while it is still editable: streams.js trims the stations
 // that fall in the water and ramps the last stretch down to the level returned
 // here. It is also before the ground grid, which matters for a different
 // reason -- `analyticHeight` closes over `basins` and the mesh is sampled
 // from it.
 // HOW FAR THE NEAREST PLAYING CORRIDOR IS, AND WHICH WAY IS OUT.
 //
 // The direction matters as much as the distance. streams.js first estimated it
 // by finite-differencing the distance, which is exact in open ground and
 // degenerate on the ridge halfway between two holes -- precisely where a
 // channel squeezing through a gap needs it, and where one station stayed stuck
 // inside a fairway however many rounds it was given. `nearest` already knows
 // which hole won and where on its centreline, so the outward normal is a
 // subtraction rather than a guess.
 function corridorClearance(x,z){
  const q=nearest(x,z),h=q.h,zz=clamp(q.p.z,0,h.length),cx=h.center(zz);
  let ux=q.p.x-cx,uz=q.p.z-zz,len=Math.hypot(ux,uz);
  // Dead on the centreline there is no outward direction; straight across is
  // the shortest way off it, and which side is arbitrary from there anyway.
  if(len<1e-6){ux=1;uz=0;len=1;}
  const a=h.toWorld({x:q.p.x,z:q.p.z}),b=h.toWorld({x:q.p.x+ux/len,z:q.p.z+uz/len});
  return {d:q.d,ux:b.x-a.x,uz:b.z-a.z};
 }
 const sinkRng=random(s.seed+':sink-ponds');
 function sinkPond({sink,points}){
  // AT THE BOTTOM OF THE HOLLOW, SIZED BY THE CHANNEL THAT FILLS IT.
  //
  // A first version sized the pond to the depression and centred it on the
  // centroid, which was wrong twice over: a surviving depression is a valley
  // floor of 40 000 to 430 000 square metres, and its centroid sat 267 to 773 m
  // from where the channel actually arrived. The hollow says WHERE the water
  // collects; the channel says HOW MUCH. The span survives only as a cap, so a
  // pond never climbs out of the ground that holds it.
  const t=points[points.length-1];
  const want=(15+t.width*2.4)*(.85+sinkRng()*.5);
  const rx=Math.max(11,Math.min(want,sink.spanX*.85)),rz=Math.max(11,Math.min(want*(.7+sinkRng()*.55),sink.spanZ*.85));
  const reach=Math.max(rx,rz)*1.12,cx=sink.x,cz=sink.z;
  if(isSea(cx,cz)||Math.abs(cx)+reach>halfX-8||Math.abs(cz)+reach>halfZ-8)return null;
  const q=nearest(cx,cz);
  // Four bodies per hole is the GPU atlas limit, not a design choice.
  if(q.h.ponds.length>=4)return null;
  // The same separation a lake obeys. Where a terminal pond would land on water
  // that is already there, the channel has found its way to it, and draining
  // into an existing body is a better answer than stacking a second surface
  // over the first -- which is the exact fault the lake check was added for, at
  // 14.19 m of daylight between the two planes.
  if(holes.some(hh=>hh.ponds.some(p=>{const c=hh.toWorld(p);return Math.hypot(cx-c.x,cz-c.z)<reach+Math.max(p.reachX||p.rx,p.rz)+35;})))return null;
  const h=q.h,c=h.toLocal({x:cx,z:cz}),phase=sinkRng()*6.28;
  const p={x:c.x,z:c.z,rx,rz,phase,sink:true,depth:s.waterMin+sinkRng()*(s.waterMax-s.waterMin),
   banks:Array.from({length:257},(_,i)=>{const u=i/256*Math.PI*2;
    return {x:c.x+rx*.1*Math.sin(u+phase),rx:rx*(.8+.14*Math.sin(u+phase)+.08*Math.sin(u*3+phase*1.7))};})};
  const basin=fitPondBasin(h,p,shapedLand);
  if(!basin)return null;
  h.ponds.push(p);basins.push(basin);
  const world=h.toWorld(p);
  return {level:p.level,
   inside:(x,z)=>{const l=h.toLocal({x,z});return hazardMetric(l.x,l.z,p)<1;},
   // Handed back so a LATER channel on the same course avoids this pond; the
   // protect list was built before it existed.
   protect:{...world,pond:true,r:Math.max(p.reachX,p.rz)+p.shoreWidth+12,keep:Math.max(p.reachX,p.rz)+p.shoreWidth+12}};
 }
 const streams=generateStreams(NO_INLAND_WATER.has(s.biome)?{...s,rivers:0,creeks:0}:s,holes,halfX,halfZ,shapedLand,random,isSea,corridorClearance,sinkPond);
 // Channel routing avoids bunkers, but a tightly packed course can force a
 // crossing. Water standing in sand is neither a playable bunker nor a readable
 // hazard, so the channel washes that bunker out. Bunker count is already an
 // upper target; the basin must go with it or the terrain keeps its bowl.
 const drowned=new Set();
 for(const h of holes)for(const b of h.bunkers){const ring=[{x:b.x,z:b.z},...Array.from({length:16},(_,i)=>{const e=ovalRadius(b,i*Math.PI/8);return{x:b.x+e.x,z:b.z+e.z};})];
  if(ring.some(p=>{const q=h.toWorld(p);return (streams.at(q.x,q.z)?.edge??Infinity)<=1;}))drowned.add(b);}
 if(drowned.size){for(const h of holes)h.bunkers=h.bunkers.filter(b=>!drowned.has(b));basins=basins.filter(x=>x.pond||!drowned.has(x.b));}
 // A CHANNEL THAT ENDS IN A SINK ENDS IN A POND.
 //
 // The drainage model leaves a channel at one of four places: the sea, a
 // surviving lake, another channel it has joined, or a sink -- a depression too
 // large to have been flooded away. A sink is much the commonest, 40 of 59
 // endings across twenty courses, and until now the channel simply stopped in
 // one, which reads as water running into a hillside.
 //
 // It gets a real pond, built and fitted by the SAME `fitPondBasin` every other
 // body goes through, so it inherits the cut bank, the shore band, the mown
 // collar, the map outline, the reflection probe and the rim tolerances rather
 // than becoming a second kind of water with its own rules to keep in step.
 //
 // The position in the pipeline is forced from both sides: after
 // `generateStreams`, because that is what says where the sinks are, and before
 // the ground grid, because `analyticHeight` closes over `basins` and the mesh
 // is sampled from it.
 function analyticHeight(x,z){let y=shapedLand(x,z);for(const {h,b,pond,reach} of basins){const q=h.toLocal({x,z});if(Math.abs(q.x-b.x)>reach||Math.abs(q.z-b.z)>reach)continue;const d=hazardMetric(q.x,q.z,b);
 // A cut bank rather than a ramp: natural ground is held right out to the rim
 // and then drops over WATER_LIP, which is what a bunker does and what makes one
 // read as excavated rather than as a dip.
 if(pond){if(d<=1)y=b.level-b.depth*(1-smooth((d-.35)/.65));else{
  const shore=(d-1)*Math.hypot(q.x-b.x,q.z-b.z)/d;
  // TWO STAGES, and the outer one is what stops a cut bank becoming a cliff.
  // Cutting straight from natural ground to the water over the lip gave a drop
  // of whatever the ground happened to be doing -- measured at 7.8 m on an
  // uneven rim, where the old 14 m ramp had simply spread it out of sight. So
  // the ground is eased to a RIM height one freeboard above the water first,
  // over the shelf the pond already owns, and only the last WATER_LIP metres
  // are the cut. The bank is then the freeboard everywhere, by construction.
  const rim=b.level+WATER_FREEBOARD,shelf=Math.max(b.shoreWidth,WATER_LIP+1);
  if(shore<WATER_LIP)y=b.level+(rim-b.level)*smooth(shore/WATER_LIP);
  else if(shore<shelf)y=rim+(y-rim)*smooth((shore-WATER_LIP)/(shelf-WATER_LIP));
 }}
 else if(d<1.15){const blend=1-smooth((d-.62)/.53);y=y*(1-blend)+(b.floor+.08*(d*d))*blend;}}
 return streams.carve(x,z,y);}
 // THE SHORELINE IS REFINED LIKE ANY OTHER FEATURE.
 //
 // The mesh is 3 m of countryside subdivided six ways to half a metre near
 // things worth looking at -- channels, greens, ponds, bunkers. The coast was
 // not on that list, so an island's edge was tessellated at the full 3 m and
 // came out as a staircase: the second difference along the traced waterline had
 // a 90th percentile of exactly 3.00 m, which is the grid admitting it.
 //
 // Only the two biomes with a sea pay for this, and only within a couple of
 // metres of sea level either side -- the strip that is actually the edge.
 // ASKED OF THE SAME FIELD THE MESH IS BUILT FROM.
 //
 // This asked `land`, the raw landform, while the mesh is `analyticHeight` --
 // the landform plus hole shaping, pond basins and stream carving. Wherever
 // those diverge the real waterline falls outside the band and keeps the full
 // 3 m tessellation: measured at 23.3% of true waterline cells missed, which
 // is why halving the owner atlas changed nothing about the jagged edges.
 // DOES THIS CELL STRADDLE THE WATERLINE? Not "is its centre near sea level",
 // which is a proxy and a bad one: tested at the centre, a height band misses
 // any shore steeper than the band is wide, and widening it until it catches
 // them sweeps in the whole seabed -- the ocean is only waterMax deep, so going
 // a metre under cost 4.6 million triangles and ten seconds of generation to
 // refine water nobody can see through.
 //
 // The corner heights come from the grid, which sampled them anyway, so this is
 // exact and free. It refines the cells the waterline actually crosses and
 // nothing else.
 const nearShore=(coastal||s.biome==='links')
  ?((x,z,a,b,c,d)=>a===undefined?false:Math.min(a,b,c,d)<waterLevel&&Math.max(a,b,c,d)>=waterLevel)
  :(()=>false);
 const groundGrid=makeGroundGrid(analyticHeight,halfX+150,halfZ+150,3,(x,z,a,b,c,d)=>(streams.at(x,z)?.edge<3)||nearShore(x,z,a,b,c,d)||holes.some(h=>{const p=h.toLocal({x,z});return Math.hypot(p.x-(h.green??h.pin).x,p.z-(h.green??h.pin).z)<38||Object.values(h.tees).some(t=>Math.abs(p.x-t.x)<TEE_PAD.x+6&&Math.abs(p.z-t.z)<TEE_PAD.z+6)||h.ponds.some(b=>{const d=hazardMetric(p.x,p.z,b);return d<1.35;})||h.bunkers.some(b=>Math.abs(p.x-b.x)<b.rx*1.4+4&&Math.abs(p.z-b.z)<b.rz*1.4+4);}));
 const height=(x,z)=>groundHeight(groundGrid,x,z,analyticHeight);
 const largeLakes=holes.flatMap(h=>h.ponds.filter(p=>p.large).map(p=>({h,p})));
 const lakeOwner=(x,z,margin=0)=>largeLakes.find(({h,p})=>{const q=h.toLocal({x,z});return hazardMetric(q.x,q.z,p)<1+margin/Math.min(p.rx,p.rz);})?.h;
 // THE LIE HALF OF THE MOWN BAND AROUND WATER. The painted half is in
 // ground.js and both use `semiRough`, because a first attempt at this changed
 // only this file -- the ground shader classifies from corridor geometry and
 // never consults `surface()`, so nothing on screen moved at all while the lie
 // quietly stopped matching what was drawn.
 //
 // The sea is deliberately not included. A coastline is not mown around; the
 // rough runs to the dunes and the beach takes over.
 // The band sits OUTSIDE the painted shore, so its reach is the shore's outer
 // stop plus the hole's semi-rough. `mown` is true because the ground being
 // reclassified is fairway, which is mown by definition -- the same branch the
 // shader takes for it.
 const collar=s.semiRough;
 const pondReach=p=>shoreBands(Math.min(Math.min(p.rx,p.rz),10),true,16).outer+collar;
 // How far this point is OUTSIDE the mown corridor. Negative inside, which is
 // always the case here -- the caller only asks about ground already classified
 // fairway -- but the magnitude is what rounds the corner.
 const fairwayDepth=n=>{
  const h=n.h,z=n.p.z,side=Math.sign(n.p.x-h.center(z))||1,mow=h.mowStart??h.fairwayStart;
  return Math.max(Math.abs(n.p.x-h.center(z))-fairwayWidth(h,z,0,side),mow-z,z-(h.length+8));
 };
 // Distance in metres from a pond's outline, by the same construction the ground
 // shader uses, so the two round the same corner in the same place.
 const ovalDistance=(x,z,p)=>{
  const m=hazardMetric(x,z,p),r=Math.hypot(x-p.x,z-p.z);
  return (m-1)*r/Math.max(m,1e-4);
 };
 // Demoted to semi when the point fails to be BOTH inside the corridor and clear
 // of the water -- an intersection, so smoothMax rounds its corner.
 //
 // Lakes keep the plain margin test: `lakeOwner` answers inside-or-out rather
 // than a distance, and a lake's own outline is gentle enough that the corner
 // it makes with a corridor is not the shape this is here to fix.
 const besideWater=(x,z,n,st)=>{
  if(!(collar>0))return false;
  const fd=fairwayDepth(n);
  const cut=(reach,d)=>smoothMax(fd,reach-d,BAND_ROUND)>=0;
  if(st&&st.edge>0&&cut(shoreBands(Math.max(st.width,.6),true,Math.max(st.bank,8)*.8).outer+collar,st.edge))return true;
  if(lakeOwner(x,z,collar))return true;
  return n.h.ponds.some(p=>cut(pondReach(p),ovalDistance(n.p.x,n.p.z,p)));
 };
 function surface(x,z){
  if(lakeOwner(x,z))return 'water';
  const st=streams.at(x,z);
  if(st?.edge<=0)return 'water';
  const n=nearest(x,z);
  // THE SEA IS WHERE THE GROUND ACTUALLY GOES UNDER IT.
  //
  // This asked `land`, the raw landform, while the ocean plane sits at
  // `waterLevel` and the ground drawn beneath it is `height` -- the landform
  // plus every bit of hole shaping. On one island course they disagreed over
  // 1512 sampled cells, and the disagreement is not small: ground scored as a
  // water hazard stood a median 0.88 m above sea level and as much as 6.13 m.
  // A ball could come to rest on a visible hillock and be penalised as the sea.
  //
  // Generation still uses `land` for this, in `isSea`, and has to -- ponds and
  // channels are placed before there is a ground mesh to ask.
  const y=height(x,z);
  if((coastal||s.biome==='links')&&y<waterLevel)return 'water';
  const found=localSurface(n.h,n.p.x,n.p.z);
  // The beach, on the two biomes that have a coast. `height` rather than `land`
  // because that is the field the ground mesh is actually built from, and the
  // shader keys its own copy off exactly the same number.
  //
  // ROUGH ONLY, matching ground.js. Maintained turf of any kind keeps its
  // surface whatever its elevation -- letting the beach take the corridor turned
  // a fifth of every island hole into sand, and a green shaped down near the sea
  // would have become a bunker.
  if((coastal||s.biome==='links')&&found==='rough'&&y<waterLevel+BEACH_RISE)return 'sand';
  return found==='fairway'&&besideWater(x,z,n,st)?'semi':found;
 }
 const homes=generateHomes(s,holes,height,surface,random);
 const trees=[];
 const ecology={pnw:[['pine',.38],['cedar',.3],['alder',.17],['fern',.15]],mountain:[['spruce',.4],['pine',.28],['aspen',.22],['shrub',.1]],desert:[['cactus',.3],['palo',.22],['mesquite',.18],['ocotillo',.16],['agave',.14]],links:[['gorse',.5],['heather',.42],['shrub',.08]],midwest:[['oak',.5],['aspen',.18],['maple',.22],['shrub',.1]],island:[['palm',.45],['hala',.25],['naupaka',.3]],autumn:[['maple',.36],['oak',.25],['aspen',.24],['spruce',.15]]};
 const rng=random(s.seed+':ecology'),pick=()=>{let r=rng();for(const[k,f]of ecology[s.biome]){r-=f;if(r<=0)return k;}return ecology[s.biome][0][0];};
 const count=Math.round(s.trees*s.holes*(s.biome==='links'?1.1:s.biome==='desert'?1.25:s.biome==='pnw'?4:s.biome==='mountain'?3.8:s.biome==='autumn'?3.6:2.8));
 for(let i=0;i<count*6&&trees.length<count;i++){const x=(rng()-.5)*halfX*2,z=(rng()-.5)*halfZ*2,n=nearest(x,z),kind=pick();if(homes.some(home=>Math.hypot(home.x-x,home.z-z)<Math.max(home.width,home.depth)+5)||surface(x,z)!=='rough'||n.d<10||n.d>135+30*Math.sin(x/95+phase)*Math.cos(z/140)||height(x,z)<.8)continue;if(rng()>(.64+.3*Math.sin(x/55+phase)*Math.cos(z/67)))continue;
  const small=['fern','gorse','heather','agave','naupaka','shrub'].includes(kind),h=small?.8+rng()*2.1:kind==='cactus'?4+rng()*5:kind==='ocotillo'?2+rng()*3:kind==='hala'?5+rng()*5:kind==='palo'||kind==='mesquite'?5+rng()*6:12+rng()*15,r=small?1+rng()*1.3:kind==='aspen'?2+rng()*2:kind==='palo'||kind==='mesquite'?4+rng()*3:3+rng()*4;
  trees.push({x,z,y:height(x,z),h,r,shade:rng(),kind,hole:n.h.hole});
 }
 const straw=trees.filter(t=>['pine','spruce','cedar'].includes(t.kind)&&t.shade<.72).map(t=>({x:t.x,z:t.z,rx:t.r*(1.1+t.shade),rz:t.r*(.85+t.shade),phase:t.shade*6.28}));
 const coverCells=new Map();for(const patch of straw){for(let x=Math.floor((patch.x-patch.rx*1.1)/24);x<=Math.floor((patch.x+patch.rx*1.1)/24);x++)for(let z=Math.floor((patch.z-patch.rz*1.1)/24);z<=Math.floor((patch.z+patch.rz*1.1)/24);z++){const key=x+','+z;if(!coverCells.has(key))coverCells.set(key,[]);coverCells.get(key).push(patch);}}
 const groundCover=(x,z)=>(coverCells.get(Math.floor(x/24)+','+Math.floor(z/24))||[]).some(p=>insideOval(x,z,p))?'straw':s.biome==='links'?'prairie':'grass';
 const world={lakeOwner,largeLakes,homes,streams,footprint,groundGrid,groundCover,straw,settings:s,bio,holes,halfX,halfZ,waterLevel,height,surface,trees,nearby,nearest,land,seed:s.seed,ecology:Object.keys(Object.fromEntries(ecology[s.biome]))};
 for(const h of holes){h.world=world;h.residentialOB=!!s.residentialOB;h.height=(x,z)=>{const p=h.toWorld({x,z});return height(p.x,p.z);};h.surface=(x,z)=>{const p=h.toWorld({x,z});return surface(p.x,p.z);};h.trees=trees.filter(t=>t.hole===h.hole).map(t=>({...t,...h.toLocal(t)}));}
 return world;
}
