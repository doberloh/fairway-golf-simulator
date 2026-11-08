import {addLargeLakes} from './lakes.js';
import {generateHomes} from './homes.js';
import {generateStreams,shoreBands,WATER_FREEBOARD,WATER_LIP,cutFor} from './streams.js';
import {planCourse,holeLine,enabledTees,greenContour,greenPedestal,rng,shapeGain,spreadHarmonics,GREEN_SHAPE,BUNKER_SHAPE} from './course-plan.js';
import {makeGroundGrid,makeGroundGridSteps,makeGroundGridPooled,groundHeight} from './terrain-grid.js';
import {routeHoles} from './routing.js';
import {buildRange,rangeContour} from './range.js';
import {clamp} from './physics.js';
import {DEFAULT_COURSE as SCHEMA_DEFAULTS} from './settings-schema.js';
import {routePaths,pathIndex,linkBuilding,pathTouches,pathClearance,findBridges} from './paths.js';
import {placeMarkings,placeWear} from './markings.js';
import {placeWaterworks} from './waterworks.js';
import {placeStory,wallBoxes,segDist} from './story.js';
import {placeLife} from './life.js';
import {markOverflow,surfaceField,isFieldSand} from './surface-field.js';
import {siteClubhouse,inBuilding,inForecourt} from './clubhouse.js';
import {softField,fieldMean} from './country.js';
import {placeRoads,placeStreets,onRoad,streetFurniture,placeCartBarn,holesBox,ROAD_MARGIN} from './roads.js';
import {GROUND_PLANTS,TREE_SIZE,tallHeight,crownFraction,crownRadius,COVER_STEEPEST} from './species.js';
import {gapAt,coverRadius,FLOAT_TOLERANCE} from './seat-core.js';
// The biome table lives in its own module now: it had grown into the answer to
// every "what does this biome do" question, and half those answers were
// conditionals in other files. Re-exported because everything imports it from
// here, and because range.js documents a cycle that this quietly removes.
export {BIOMES, biomeOf} from './biomes.js';
import {BIOMES, biomeOf} from './biomes.js';
import {blowoutField,isBlowout,BLOWOUT_WATER} from './blowouts.js';
import {landformOf,wildField,wildGround,fallenBake,fallenAt,WILD_WATER,fbm,saltOf,massifHeading} from './landforms.js';
import {standsOf,standSites,choose} from './stands.js';
import {allows,isNatural} from './grounds.js';
// FNV-1a-style string seed hash, then Mulberry32: Tommy Ettinger (CC0),
// JavaScript variant published by bryc (MIT fallback). See THIRD_PARTY_NOTICES.txt.
// Seeded generation lives in course-plan.js so the scorecard and the course
// cannot use different dice. Re-exported here because this is where callers
// have always found it.
export const random=rng;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Defaults, bounds and validation all live in the settings schema; re-exported
// here because course.js has long been the import site for them.
export {DEFAULT_COURSE} from './settings-schema.js';
export function greenRadius(hole,angle){return (hole.greenSize??17)*(1+(hole.greenWave2??0)*Math.sin(angle*2+hole.phase)+(hole.greenWave3??.075)*Math.sin(angle*3+hole.phase)+(hole.greenWave5??.045)*Math.cos(angle*5));}
// Measured from the centre of the green, which since hole locations started
// moving is not the same point as the cup. Falling back to the pin keeps any
// caller that only has a cup working.
// A hole with a LIST of greens (the driving range, range.js) is as near a green
// as its nearest one: the lie, the painted ground and the map all ask this, so
// every green in the list plays as a green. A green hidden by the centre green
// standing over it is not there.
// A GREEN TURNED TO ITS APPROACH (Architect, phase 3: `greenTurn`, radians,
// architect.js `approachTurn`): the oval is laid in its own frame, turned by
// that much about its centre. Classic has none, and takes the same arithmetic
// it always did -- the turn is skipped, not multiplied by one -- so its lie and
// its paint (ground.js, the same branch) are bit for bit what they were.
// A BUILT hole (built-world.js) answers from its stored outline, exactly.
export function greenDistance(hole,x,z){if(hole.built)return hole.greenDist(x,z);if(hole.greens){let d=Infinity;for(const g of hole.greens)if(!g.hidden)d=Math.min(d,greenDistance(g,x,z));return d;}const c=hole.green??hole.pin,t=hole.greenTurn;let ux=x-c.x,uz=z-c.z;if(t){const cs=Math.cos(t),sn=Math.sin(t),rx=ux*cs+uz*sn;uz=-ux*sn+uz*cs;ux=rx;}const dx=ux/(hole.greenAspect??1.17),dz=uz,angle=Math.atan2(dz,dx);return Math.hypot(dx,dz)-greenRadius(hole,angle);}
// The point at angle `a` round a green's own oval, `r` out in the oval's
// stretched frame (r = greenRadius(hole,a) is the edge), turned with the green.
// Everything that draws or places round a green asks this, so a turned green
// is one shape on the ground, the maps and the yardage book.
export function greenPoint(hole,a,r){const c=hole.green??hole.pin,o=greenOffset(hole,a,r);return {x:c.x+o.x,z:c.z+o.z};}
// The same, from the green's centre.
export function greenOffset(hole,a,r){const x=Math.cos(a)*r*(hole.greenAspect??1.17),z=Math.sin(a)*r,t=hole.greenTurn;if(!t)return {x,z};const cs=Math.cos(t),sn=Math.sin(t);return {x:x*cs-z*sn,z:x*sn+z*cs};}
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
// THE FLAG SAYS WHERE THE CUP IS (architect-courses, phase 2; a free extra both
// designers get, since it moves nothing generated): red at the front, white in
// the middle, blue at the back -- the commonest scheme at real clubs (RESEARCH
// *Architect courses: people*). White cloth takes dark numbers so they read.
export const PIN_FLAGS = {
 front: {cloth: '#d4443a', ink: '#fffaf0', name: 'red'},
 middle: {cloth: '#f2eee1', ink: '#23342a', name: 'white'},
 back: {cloth: '#2c5cb6', ink: '#fffaf0', name: 'blue'},
};
// The band a hole's cup was actually cut in, by the same rule `choosePin` uses.
export const pinBandOf = h => h?.settings?.pinBand === 'centre' ? 'middle'
 : BAND_WINDOW[h?.settings?.pinBand] ? h.settings.pinBand : pinBandFor(h?.hole ?? 0);
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
 // A BUILT hole's green is stored ground, which exists when its cup is cut
 // (per round, built-world.js), so the slope is read off that ground.
 if (h.built) return Math.hypot((h.height(x + e, z) - h.height(x - e, z)) / (2 * e), (h.height(x, z + e) - h.height(x, z - e)) / (2 * e)) * 100;
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
 // A GAP (an Architect barranca, phase 6): no fairway across the ravine, its
 // lips rounded over 6 m; the semi-rough's margin stays, so the shader's
 // curves and this agree. A Classic hole has none.
 let g=1;if(h.gaps)for(const [g0,g1] of h.gaps)g=Math.min(g,z<g0?smooth((g0-z)/6):z>g1?smooth((z-g1)/6):0);
 return ((width*(1-blend)+neck*blend)*g+margin)*capFactor;
}
// SHARED FAIRWAYS (the cartoon overhaul, 25 October 2026; the owner's
// addendum). On the Old Course the 1st and 18th share one fairway about 129
// yards wide, and Chambers Bay plays on wide fairways of fescue (RESEARCH,
// *Shared links fairways*). Here, on a biome that asks for it: wherever a
// hole runs roughly parallel to another and the rough between their
// fairways is narrower than `gap`, each side of each fairway widens to the
// middle of that gap, so the two meet and the strip between them is
// fairway. Measured after routing, from the holes' own geometry; no random
// draw, so nothing else on the course moves because of it except what the
// wider fairways themselves move.
//
// Never across any hole's pond (a pond crossing a fairway is an invariant:
// `ponds.pondCrossesAFairway`), never from a hole's tee end or into its green
// complex (the stretch from the mown start + 25 m to 40 m short of the
// green), only where the two centre lines run within `cos` of parallel AT
// THAT POINT (the tee-to-green lines failed every dogleg), and only along a
// run of at least `run` m so a passing corner does not grow a bulge. The
// widening fades in and out over `ease` m; at 30 m the ends looked cut square.
// PLACED: the links values (gap 85 m, cos 0.9 -- about 26 degrees -- run 80 m,
// ease 60 m). Two fairways about 33 m wide and 85 m apart make one about
// 150 m across, against the Old Course's 118 m: wider, as asked ("LARGE").
// Which way a hole's centre line runs at z, in the world: the direction there,
// not the tee-to-green line, so a dogleg's straight stretch can still lie
// alongside its neighbour.
const heading=(h,z)=>{const a=h.toWorld({x:h.center(z-6),z:z-6}),b=h.toWorld({x:h.center(z+6),z:z+6}),l=Math.hypot(b.x-a.x,b.z-a.z)||1;return {x:(b.x-a.x)/l,z:(b.z-a.z)/l};};
// THE POLISH GOAL'S ROUNDS (the owner: "make the fairways look smoothly
// conjoined ... it shouldn't look forced, it needs to look like it was thought
// through"). `close` fills a gap in a join up to that many metres, so a join
// does not stop and start (an H of square rungs); `blur` averages the shared
// edge along that many metres, so it flows; `ease` -- longer here -- lets a
// join run out as a long tongue of rough rather than a quick wedge.
// THE FAR-LANDSCAPE GOAL'S ROUNDS (the owner: "thoughtful fairway connections
// on links"): a double fairway is a DECISION ABOUT A PAIR, as an architect
// makes it -- these two holes, running alongside each other for most of
// their fairways, are one piece of ground. Each hole used to decide side by
// side alone, and later passes undid half-made joins; now each pair's join is
// measured from both holes and taken or refused whole. `cover`: the share of
// each hole's shareable stretch (its mown fairway short of the green complex)
// the join must run along -- a pair that only crosses in the middle (the
// staggered out-and-back, whose fairways each lie beside the other's tee
// ground) is refused rather than joined by a crossbar.
export function shareFairways(holes,{gap=55,step=4,cos=.75,run=40,ease=30,close=0,blur=0,stretch=false,strip=0,cover=0,endEase=null,roundTip=true,seam=0,pairs=false,debug=null}={}){
 const shareStretch=stretch;
 const extra=holes.map(()=>({[-1]:null,[1]:null})),partners=holes.map(()=>new Set()),per=holes.map(()=>({}));
 // A pond drawn nearer another hole's centre line than its own is dropped
 // later (a pond stays on its own hole's ground), so it must not stop the
 // sharing now: one sited in the neighbour's fairway blocked the very strip
 // that was to be shared.
 const along=(o,p)=>Math.abs(p.x-o.center(clamp(p.z,0,o.length)));
 const ownPonds=holes.map(h=>h.ponds.filter(p=>{const q=h.toWorld(p),own=along(h,p);return !holes.some(o=>o!==h&&along(o,o.toLocal(q))<own);}));
 for(const [i,h] of holes.entries()){
  // Round 4 of the polish goal: from 10 m past the mown start to 25 m short
  // of the green (were 25 and 40): with the ends now tapered, pairs whose
  // closeness lay near those ends no longer joined at all and stood as two
  // fairways a sliver of rough apart.
  const z0=(h.mowStart??h.fairwayStart??22)+(shareStretch?10:25),z1=h.length-(shareStretch?25:40);
  if(z1-z0<50)continue;
  const n=Math.max(2,Math.ceil((z1-z0)/step));
  for(const side of [-1,1]){
   const want=new Float32Array(n+1),own=new Float32Array(n+1),who=new Int16Array(n+1).fill(-1),par=new Float32Array(n+1),rough=new Float32Array(n+1);
   for(let k=0;k<=n;k++){
    const z=z0+(z1-z0)*k/n,cx=h.center(z),w=side<0?h.leftWidth(z):h.rightWidth(z),dirH=heading(h,z);
    own[k]=w;
    // Out from this fairway's edge across the rough, a metre at a time.
    for(let t=w+1;t<=w+gap;t+=1){
     const q=h.toWorld({x:cx+side*t,z});
     let hit=false,partner=-1;
     for(const [j,o] of holes.entries()){
      if(j===i)continue;
      const p=o.toLocal(q),oz0=(o.mowStart??o.fairwayStart??22)+(shareStretch?5:15),oz1=o.length-(shareStretch?20:30);
      if(p.z<oz0||p.z>oz1){if(debug&&p.z>-20&&p.z<o.length+20){const off=p.x-o.center(clamp(p.z,0,o.length));if(Math.abs(off)<(off<0?o.leftWidth(clamp(p.z,0,o.length)):o.rightWidth(clamp(p.z,0,o.length))))debug.push({hole:h.hole,side,k,why:'stretch',other:o.hole,pz:Math.round(p.z),oz0:Math.round(oz0),oz1:Math.round(oz1)});}continue;}
      const off=p.x-o.center(p.z),ow=off<0?o.leftWidth(p.z):o.rightWidth(p.z);
      if(Math.abs(off)>ow)continue;
      const dirO=heading(o,p.z);
      if(Math.abs(dirO.x*dirH.x+dirO.z*dirH.z)<cos){if(debug)debug.push({hole:h.hole,side,k,why:'angle',other:o.hole,dot:+Math.abs(dirO.x*dirH.x+dirO.z*dirH.z).toFixed(2)});continue;}
      hit=true;partner=j;partners[i].add(j);par[k]=Math.abs(dirO.x*dirH.x+dirO.z*dirH.z);break;
     }
     if(!hit)continue;
     // Meet at the middle of the rough between the two edges.
     const reach=w+(t-w)/2+1.5;
     // Any hole's pond in the strip the widening would cover (8 m margin): the
     // neighbour's pond lies across the shared ground as surely as our own.
     let pondInWay=false;
     for(let u=w;u<=reach+8&&!pondInWay;u+=3){const v=h.toWorld({x:cx+side*u,z});pondInWay=holes.some((o,j)=>{if(!ownPonds[j].length)return false;const l=o.toLocal(v);return ownPonds[j].some(p=>insideOval(l.x,l.z,p,8));});}
     if(!pondInWay){want[k]=reach;who[k]=partner;rough[k]=t-w;}
     else if(debug)debug.push({hole:h.hole,side,k,why:'pond'});
     break;
    }
   }
   // Close short gaps first (`close`): a gap between two joined stretches,
   // filled with the reach either side of it, so a join that only paused for
   // a pond's margin or a passing kink is one join -- one with the SAME hole.
   if(close){
    const cg=Math.round(close/step);
    for(let k=0;k<=n;){
     if(want[k]){k++;continue;}
     let e=k;while(e<=n&&!want[e])e++;
     if(k>0&&e<=n&&e-k<=cg&&who[k-1]===who[e]){const a=want[k-1],b=want[e];for(let m=k;m<e;m++){want[m]=a+(b-a)*(m-k+1)/(e-k+1);who[m]=who[e];}}
     k=e;
    }
   }
   // The runs: stretches of at least `run` m joined to one hole.
   const runs=[];
   for(let k=0;k<=n;){
    if(!want[k]){k++;continue;}
    let e=k;while(e<=n&&want[e]&&who[e]===who[k])e++;
    if((e-k)*step>=run)runs.push({j:who[k],k0:k,k1:e});else if(debug)debug.push({hole:h.hole,side,k,why:`run ${(e-k)*step} m`});
    k=e;
   }
   per[i][side]={z0,z1,n,want,own,runs,par,rough};
  }
 }
 // EACH PAIR TAKEN OR REFUSED WHOLE (above): how far each hole's joins with
 // the other run, against each hole's own shareable stretch.
 const joined=(i,j)=>{let L=0;for(const side of [-1,1])for(const r of per[i][side]?.runs||[])if(r.j===j)L+=(r.k1-r.k0)*step;return L;};
 const span=i=>per[i][-1]?per[i][-1].z1-per[i][-1].z0:0;
 // How parallel the pair runs along its join (mean |cos| of the two centre
 // lines), and how much the rough between them changes along it.
 const shape=(i,j)=>{let c=0,s=0,lo=1e9,hi=0;for(const side of [-1,1]){const p=per[i][side];for(const r of p?.runs||[])if(r.j===j)for(let m=r.k0;m<r.k1;m++){if(!p.par[m])continue;c++;s+=p.par[m];lo=Math.min(lo,p.rough[m]);hi=Math.max(hi,p.rough[m]);}}return {par:c?s/c:0,spread:c?hi-lo:0};};
 const takes=(i,j)=>{const a=joined(i,j),b=joined(j,i);if(a<run||b<run)return false;const f=shape(i,j),ok=(a/Math.max(1,span(i))+b/Math.max(1,span(j)))/2>=cover;if(debug)debug.push({hole:holes[i].hole,why:`pair with ${holes[j].hole+1} covers ${(a/span(i)*100).toFixed(0)}% / ${(b/span(j)*100).toFixed(0)}%, parallel ${f.par.toFixed(3)}, rough spread ${f.spread.toFixed(0)} m${ok?'':' REFUSED'}`});return ok;};
 // PAIRS ONLY (`pairs`, an Architect course; the owner's review, 30 October
 // 2026, Links ST-1: four fairways ran together into one field). Each hole
 // joins one neighbour at most -- the pairs that would join, longest join
 // first, each taken while neither hole has a partner yet. Classic joins
 // every pair `takes` allows, as before.
 let chosen=takes;
 if(pairs){
  const cand=[];
  for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++)if(takes(i,j))cand.push({i,j,L:joined(i,j)+joined(j,i)});
  cand.sort((a,b)=>b.L-a.L||a.i-b.i||a.j-b.j);
  const mate=new Map();
  for(const c of cand)if(!mate.has(c.i)&&!mate.has(c.j)){mate.set(c.i,c.j);mate.set(c.j,c.i);}
  chosen=(i,j)=>mate.get(i)===j;
 }
 for(const [i,h] of holes.entries())for(const side of [-1,1]){
  const s=per[i][side];if(!s)continue;
  const {z0,z1,n,want,own}=s,keep=new Float32Array(n+1);
  for(const r of s.runs)if(chosen(i,r.j))for(let m=r.k0;m<r.k1;m++)keep[m]=want[m];
  if(!keep.some(Boolean))continue;
   // Blur the joined reach along its length (`blur`), inside each run only.
   if(blur){
    const br=Math.round(blur/step/2),src=keep.slice();
    for(let k=0;k<=n;k++){if(!src[k])continue;let s=0,c=0;for(let m=Math.max(0,k-br);m<=Math.min(n,k+br);m++)if(src[m]){s+=src[m];c++;}keep[k]=s/c;}
   }
   const fade=Math.round(ease/step),out=new Float32Array(n+1);
   // Round 2 of the polish goal: the taper runs from the shared reach down to
   // the fairway's OWN width, not to nothing. Toward nothing, the edge met
   // the fairway's own edge a third of the way down the ease and the rest was
   // never seen -- a quick wedge whatever `ease` said.
   for(let k=0;k<=n;k++){
    let best=0,full=0;
    for(let m=Math.max(0,k-fade);m<=Math.min(n,k+fade);m++)if(keep[m]){const v=(keep[m]-own[m])*smooth(1-Math.abs(m-k)/fade);if(v>best){best=v;full=keep[m]-own[m];}}
    // THE FAR-LANDSCAPE GOAL'S ROUND 6: A TONGUE OF ROUGH ENDS ROUND. Where a
    // join ran out, the rough between the two fairways narrowed over the whole
    // ease (170 m) to a hairline point -- the sliver the polish goal ruled
    // out, drawn long. Now each side keeps at least half a strip of rough
    // (`strip`) until the last quarter of its taper, then closes on a circle's
    // profile, so the tongue ends in a rounded tip about a strip wide.
    if(strip&&roundTip&&full>strip/2&&best>0){const f=best/full,fc=1-strip/2/full;if(f>fc){const u=Math.min(1,(f-fc)/(1-fc)*4);best=full*(1-(1-fc)*Math.sqrt(1-u));}}
    // Round 3: and to the stretch's ends. A join that ran up to the end of
    // its allowed stretch (25 m past the mown start, 40 m short of the green)
    // stopped there at full width -- the square end of every "H" rung.
    // The far-landscape goal: over `endEase` m when given -- at ease x 0.6
    // (100 m on a links) only the middle 27 m of a 230 m stretch reached full
    // width, and an out-and-back pair stood 5-16 m apart, never touching.
    best*=smooth(Math.min(k,n-k)/Math.max(1,endEase!==null?endEase/step:fade*.6));
    out[k]=best>0?own[k]+best:0;
   }
   extra[i][side]={z0,z1,n,out};
 }
 // MUTUAL OR NOT AT ALL (the polish goal, round 13): a hole whose partners
 // all kept no widening of their own -- refused at their tee or green end --
 // bulged halfway toward a fairway that never came to meet it. Its widening
 // goes; the clear-strip pass below handles the gap.
 if(strip)for(const [i] of holes.entries()){
  if(!extra[i][-1]&&!extra[i][1])continue;
  // A partner that widened and reached back for THIS hole (S3's hole 1 had a
  // partner widening toward a third hole instead).
  if(![...partners[i]].some(j=>(extra[j][-1]||extra[j][1])&&partners[j].has(i))){if(debug)debug.push({hole:holes[i].hole,why:"no partner reached back",partners:[...partners[i]].map(j=>holes[j].hole)});extra[i][-1]=null;extra[i][1]=null;}
 }
 // The widened profile: the old width or the shared reach, whichever is wider.
 for(const [i,h] of holes.entries()){
  const at=(e,z)=>{if(!e||z<e.z0||z>e.z1)return 0;const f=(z-e.z0)/(e.z1-e.z0)*e.n,k=Math.min(e.n-1,Math.floor(f)),t=f-k;return e.out[k]*(1-t)+e.out[k+1]*t;};
  const L=h.leftWidth,R=h.rightWidth,eL=extra[i][-1],eR=extra[i][1];
  if(!eL&&!eR)continue;
  h.leftWidth=z=>Math.max(L(z),at(eL,z));
  h.rightWidth=z=>Math.max(R(z),at(eR,z));
  h.width=z=>Math.max(h.leftWidth(z),h.rightWidth(z));
  h.sharedFairway=true;
  h._unshare=()=>{h.leftWidth=L;h.rightWidth=R;h.width=z=>Math.max(L(z),R(z));h.sharedFairway=false;};
 }
 // AND CHECKED ON THE RESULT: two holes can each reach for the other on
 // different stretches and never meet (S3's 1 and 2 stayed 16.5 m apart).
 // A widened hole whose edges touch no other fairway anywhere gives its
 // widening back. Repeated until nothing changes, since a hole given back can
 // leave its partner touching nothing.
 if(strip)for(let changed=true;changed;){
  changed=false;
  for(const h of holes){
   if(!h.sharedFairway)continue;
   let touch=false;
   for(let z=h.mowStart??22;z<h.length-10&&!touch;z+=6)for(const side of [-1,1]){
    const wd=side<0?h.leftWidth(z):h.rightWidth(z),q=h.toWorld({x:h.center(z)+side*(wd+.5),z});
    if(holes.some(o=>{if(o===h)return false;const p=o.toLocal(q);if(p.z<0||p.z>o.length)return false;const off=p.x-o.center(p.z);return Math.abs(off)<=(off<0?o.leftWidth(p.z):o.rightWidth(p.z));})){touch=true;break;}
   }
   if(!touch){if(debug)debug.push({hole:h.hole,why:"touches nothing"});h._unshare();changed=true;}
  }
 }
 for(const h of holes)delete h._unshare;
 if(strip)keepStrips(holes,strip,step,ease);
 if(seam)seamBunkers(holes,seam,step);
}
// BUNKERS ON THE SEAM (round 7 of the far-landscape goal's shared fairways;
// the owner: "thoughtful fairway connections on links"). A double fairway on
// the Old Course is not a bare lawn: pot bunkers lie along the line between
// its two holes (the Coffins, the Principal's Nose), so the shared ground is
// still two holes and a player chooses a side. Each joined stretch of 60 m or
// more gets up to `count` pot bunkers, 3.6-5.2 m across, near the seam --
// 38% of the way from the lower-numbered hole's centre line to its partner's,
// so the bunker lies wholly on its own hole's ground (one that does not is
// dropped with every other such bunker, below) -- spread along the middle of
// the join at least 45 m apart. Never on a pond, a tee or another bunker, and
// never past the hole's twelve hazard slots (ponds keep theirs). Seeded from
// the hole's own shape. PLACED: every number.
function seamBunkers(holes,count,step){
 for(const [i,h] of holes.entries()){
  if(!h.sharedFairway)continue;
  const z0=(h.mowStart??22)+20,z1=h.length-45,runs=[];let run=null;
  for(let z=z0;z<=z1;z+=step){
   const c=h.center(z),q=h.toWorld({x:c,z});let hit=null;
   for(const [j,o] of holes.entries()){
    if(j<=i)continue;
    const p=o.toLocal(q);if(p.z<0||p.z>o.length)continue;
    const off=p.x-o.center(p.z),D=Math.abs(off);if(D<12||D>140)continue;
    const back=h.toLocal(o.toWorld({x:o.center(p.z),z:p.z})),side=Math.sign(back.x-c);
    const wh=side<0?h.leftWidth(z):h.rightWidth(z),wo=off<0?o.leftWidth(p.z):o.rightWidth(p.z);
    if(wh+wo>=D-1){hit={j,x:c+(back.x-c)*.38};break;}
   }
   if(hit&&run&&run.j===hit.j)run.pts.push({z,x:hit.x});
   else{run=hit?{j:hit.j,pts:[{z,x:hit.x}]}:null;if(run)runs.push(run);}
  }
  const r=rng(`seam:${h.hole}:${h.length.toFixed(2)}`);
  for(const {pts} of runs){
   if(pts[pts.length-1].z-pts[0].z<60)continue;
   const want=Math.min(count,1+Math.floor((pts[pts.length-1].z-pts[0].z)/90)),placed=[];
   for(let k=0;k<want*3&&placed.length<want;k++){
    if(h.bunkers.length+h.ponds.length>=12)break;
    const at=pts[Math.floor(pts.length*(.25+.5*r()))],rx=1.8+r()*.8,rz=1.8+r()*.8,x=at.x+(r()-.5)*4,z=at.z;
    if(placed.some(b=>Math.abs(b.z-z)<45))continue;
    if(h.ponds.some(p=>insideOval(x,z,p,rx+6))||h.bunkers.some(b=>insideOval(x,z,b,rx+4))||Object.values(h.tees).some(t=>Math.hypot(t.x-x,t.z-z)<20))continue;
    const b={x,z,rx,rz,phase:r()*6.28,wave2:(r()-.5)*.04,wave3:.02+r()*.03,greenSide:false,seam:true};
    h.bunkers.push(b);placed.push(b);
   }
  }
 }
}
// ROUND 5 OF THE POLISH GOAL: A JOIN OR A REAL STRIP, NEVER A SLIVER. Where two
// fairways come within `strip` m of each other and do not join -- a tee or a
// green end, where joining is refused, or a pair not parallel enough -- a
// sliver of rough a metre or three wide lay between them, the most forced
// thing on a links. Each edge there is pulled back by half the shortfall, so
// at least `strip` m of rough lies between, eased in and out over `ease` m and
// never by more than a third of the fairway's own width. Edges that touch
// (joined) are left. Measured over the whole fairway, mown start to green.
function keepStrips(holes,strip,step,ease){
 const cuts=holes.map(h=>{
  const z0=h.mowStart??h.fairwayStart??22,z1=h.length-8,n=Math.max(2,Math.ceil((z1-z0)/step)),res={};
  for(const side of [-1,1]){
   const need=new Float32Array(n+1),joined=new Uint8Array(n+1);let any=false;
   for(let k=0;k<=n;k++){
    const z=z0+(z1-z0)*k/n,cx=h.center(z),w=side<0?h.leftWidth(z):h.rightWidth(z);
    for(let t=w+.5;t<w+strip;t+=.5){
     const q=h.toWorld({x:cx+side*t,z});let hit=false;
     for(const o of holes){if(o===h)continue;const p=o.toLocal(q);if(p.z<0||p.z>o.length)continue;const off=p.x-o.center(p.z),ow=off<0?o.leftWidth(p.z):o.rightWidth(p.z);if(Math.abs(off)<=ow){hit=true;break;}}
     if(hit){if(t-w>1.5){need[k]=(strip-(t-w))/2;any=true;}else joined[k]=1;break;}
    }
   }
   if(!any)continue;
   // Round 6: eased over a third of `ease`, and never into a joined stretch
   // (round 5's full ease pulled joins apart again).
   const fade=Math.max(1,Math.round(ease/3/step)),out=new Float32Array(n+1);
   for(let k=0;k<=n;k++){if(joined[k])continue;let best=0;for(let m=Math.max(0,k-fade);m<=Math.min(n,k+fade);m++)if(need[m])best=Math.max(best,need[m]*smooth(1-Math.abs(m-k)/fade));out[k]=best;}
   res[side]={z0,z1,n,out};
  }
  return res;
 });
 for(const [i,h] of holes.entries()){
  const c=cuts[i];if(!c[-1]&&!c[1])continue;
  const at=(e,z)=>{if(!e||z<e.z0||z>e.z1)return 0;const f=(z-e.z0)/(e.z1-e.z0)*e.n,k=Math.min(e.n-1,Math.floor(f)),t=f-k;return e.out[k]*(1-t)+e.out[k+1]*t;};
  const L=h.leftWidth,R=h.rightWidth;
  h.leftWidth=z=>{const w=L(z);return w-Math.min(w/3,at(c[-1],z));};
  h.rightWidth=z=>{const w=R(z);return w-Math.min(w/3,at(c[1],z));};
  h.width=z=>Math.max(h.leftWidth(z),h.rightWidth(z));
 }
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
 p.level=low-WATER_FREEBOARD; p.reachX=Math.max(...p.banks.map(b=>Math.abs(b.x-p.x)+b.rx));return {h,b:p,pond:true,reach:Math.max(p.reachX,p.rz)+p.shoreWidth+4};
}

export function insideOval(x,z,o,margin=0){return hazardMetric(x,z,o,margin)<1;}
export function generateCourse(settings={},hole=0){
 const s={...SCHEMA_DEFAULTS,...settings,courseYards:settings.courseYards??(settings.holes===18?6480:3240)},rng=random(s.seed+':'+hole),bio=biomeOf(s.biome)||BIOMES.pnw;
 const planned=planCourse(s).holes[hole%s.holes],par=planned.par;
 // THE SKELETON COMES FROM course-plan.js, so the scorecard shown before a
 // course is built and the course that gets built cannot disagree: they run
 // the same function over the same seeded stream. It consumes a contiguous
 // prefix of `rng`, and everything below carries on from where it left off.
 const line=holeLine(s,planned,rng);
 const {greenSize,greenAspect,greenWave2,greenWave3,greenWave5,phase,angle,isDogleg,
  turnFraction,soft,slope,unitCenter,arc,length,pivot,center,tees}=line;
 // Each edge is an independent, smooth random field. No outline/profile catalogue.
 const widthTrend=(rng()-.5)*1.8;
 const makeEdge=()=>{const count=4+Math.floor(rng()*5),knots=[0,...Array.from({length:count-2},(_,i)=>(i+1+(rng()-.5)*.65)/(count-1)),1],trend=widthTrend+(rng()-.5)*.65,base=.85+rng()*.35,values=knots.map(u=>clamp(base+trend*(u-.5)+(rng()-.5)*1.05,.42,1.85));return{knots,values};};
 const leftEdge=makeEdge(),rightEdge=makeEdge();
 if(par===3)for(const edge of [leftEdge,rightEdge])edge.values=edge.values.map(v=>1+(v-1)*.35);
 const sample=(edge,u)=>{let i=0;while(i<edge.knots.length-2&&u>edge.knots[i+1])i++;return edge.values[i]+(edge.values[i+1]-edge.values[i])*smooth((u-edge.knots[i])/(edge.knots[i+1]-edge.knots[i]));};
 // A biome's `fairwayScale` (the cartoon overhaul): links play on fairways
 // wider than parkland's -- Chambers Bay's run 26-96 m (28-105 yd), against
 // about 22-29 m at Oakmont or Winged Foot -- so the same
 // setting cuts a broader one there. Never on the range (its own targets).
 // Widened by the centre line's slope, read from points kept inside the hole
 // (the straight tone step, round 5): in the last half metre the point ahead
 // fell past the green, where the centre line stops, so the slope halved and
 // the width dropped 1.3 m in half a metre -- a step every distance from the
 // hole carried, and the ground creased along it.
 const lean=z=>{const a=Math.max(0,z-.5),b=Math.min(length,z+.5);return b>a?(center(b)-center(a))/(b-a):0;};
 const sideWidth=(edge,z)=>s.width/2*(s.range?1:bio.fairwayScale??1)*sample(edge,clamp(z/length,0,1))*Math.sqrt(1+lean(z)**2);
 const leftWidth=z=>sideWidth(leftEdge,z),rightWidth=z=>sideWidth(rightEdge,z),width=z=>Math.max(leftWidth(z),rightWidth(z));
 // ONE LONG TEE ON A SHORT HOLE. The markers are spread down it rather than
 // sitting on three pads of their own, which on a par three is both what a
 // real course does and the only way they fit.
 // A SHORT HOLE NO LONGER NEEDS A TEE OF ITS OWN KIND. Three pads used to
 // overlap on every par three, because spacing is a fraction of the hole's
 // length -- so they were replaced by one long shared pad with the markers set
 // down it. Now that a pad is 9 by 12 m rather than 12 by 16, three of them fit
 // on a short hole at honest spacing, and three separate pads give the stepped
 // form a real short hole has for nothing. It also removes the 8 m of dead pad
 // that used to sit in front of the forward marker, which existed only because
 // one oval had to span every marker.

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
 // A LANDSCAPE'S SHARE OF HOLES WITH A POND (`pondShare`; Desert Mountain, the owner, 8 November
 // 2026: "1.5 ponds per 18 holes"): at the default Pond frequency only that share of holes try for
 // one, scaled with the setting; drawn from its own stream, so the hole's own draws do not move.
 const pondTries=NO_INLAND_WATER.has(s.biome)?0:bio.pondShare==null?Math.round(s.water/27):random(s.seed+':pond:'+hole)()<bio.pondShare*s.water/35?Math.max(1,Math.round(s.water/27)):0;
 for(let i=0;i<pondTries;i++){
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
  const b={x,z,rx,rz,phase:rng()*6.28,wave2:(rng()-.5)*.1,wave3:.025+rng()*.08,greenSide};
  // Same treatment as a green's outline, and for the same reason: the hazard
  // texture packs whatever the bunker carries, so scaling here keeps the sand a
  // player sees and the sand the ball lands in as one shape. The binary search
  // BELOW re-fits a green-side bunker after this, so a lumpier outline still
  // ends up the intended distance off the fringe rather than eating into it.
  {const even=spreadHarmonics([b.wave2,b.wave3],s.bunkerShape);
   const k=shapeGain(s.bunkerShape,BUNKER_SHAPE),sum=even.reduce((a,w)=>a+Math.abs(w),0);
   const use=sum>1e-6?Math.min(k,BUNKER_SHAPE.cap/sum):1;b.wave2=even[0]*use;b.wave3=even[1]*use;}if(greenSide){const a=Math.atan2(z-green.z,(x-green.x)/greenAspect),target=s.fringe+s.bunkerGap+.04;let lo=0,hi=90;for(let j=0;j<16;j++){const radius=(lo+hi)/2;b.x=green.x+Math.cos(a)*radius*greenAspect;b.z=green.z+Math.sin(a)*radius;let gap=Infinity;for(let k=0;k<64;k++){const q=ovalRadius(b,k*Math.PI/32);gap=Math.min(gap,greenDistance({green,phase,greenSize,greenAspect,greenWave2,greenWave3,greenWave5},b.x+q.x,b.z+q.z));}if(gap<target)lo=radius;else hi=radius;}const radius=hi;b.x=green.x+Math.cos(a)*radius*greenAspect;b.z=green.z+Math.sin(a)*radius;x=b.x;z=b.z;}if(!Object.values(tees).some(t=>Math.hypot(t.x-x,t.z-z)<Math.max(rx,rz)+11)&&!ponds.some(p=>insideOval(x,z,p,Math.max(rx,rz)+3))&&!bunkers.some(p=>insideOval(x,z,p,Math.max(rx,rz)+2)))bunkers.push(b);
 }
 let routeLength=0;for(let z=0;z<length;z+=1){const next=Math.min(length,z+1);routeLength+=Math.hypot(center(next)-center(z),next-z);}

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
 for(let i=0;i<count*3&&h.trees.length<count;i++){const z=-25+rng()*(length+70),x=(rng()-.5)*215;if(h.surface(x,z)!=='rough'||Math.abs(x-center(z))<width(z)+s.semiRough+13||Math.hypot(x-green.x,z-green.z)<31+s.fringe+s.semiRough||Math.hypot(x,z)<22)continue;const small=bio.treeKind==='shrub';h.trees.push({x,z,y:h.height(x,z),h:small?1+rng()*2:bio.canopy.min+rng()*bio.canopy.range,r:small?1+rng():3+rng()*4,shade:rng()});}
 return h;
}
// A pond built the way Classic builds one -- banks anchored a gap outside the
// fairway edge, sampled down its length -- but at a place and side the
// architect chose, with the bite it asked for. Null when it would touch the
// green, a tee or another pond (the same refusals as Classic's).
function pondAt({guide,center,z,side,rx,rz,reach,phase,variation,gapRand,depthRand,greenGuide,tees,ponds,fairwayStart,length,greenSize,s}){
 const minZ=fairwayStart+rz+8,maxZ=length-greenSize*1.5-rz;if(minZ>maxZ)return null;z=clamp(z,minZ,maxZ);
 const halfWay=fairwayWidth(guide,z,0,side),bite=halfWay*clamp(reach,0,.7);
 const gap=-s.semiRough*.8-bite+gapRand*4,banks=[];
 for(let j=0;j<=256;j++){const u=j/256,zz=z+(u*2-1)*rz,k=Math.min(2,Math.floor(u*3)),t=smooth(u*3-k),size=rx*(.65+.65*(variation[k]*(1-t)+variation[k+1]*t)),edge=center(zz)+side*fairwayWidth(guide,zz,s.semiRough,side);banks.push({x:edge+side*(gap+.75+size),rx:size});}
 const p={x:banks[128].x,z,rx,rz,phase,banks,side,gap,depth:s.waterMin+depthRand*(s.waterMax-s.waterMin)};
 p.reachX=Math.max(...banks.map(b=>Math.abs(b.x-p.x)+b.rx))+8;
 const boundary=Array.from({length:64},(_,j)=>{const q=ovalRadius(p,j*Math.PI/32);return{x:p.x+q.x,z:p.z+q.z};});
 if(boundary.some(q=>greenDistance(greenGuide,q.x,q.z)<s.fringe+5||Object.values(tees).some(t=>Math.hypot(q.x-t.x,q.z-t.z)<12)))return null;
 if(ponds.some(q=>boundary.some(v=>insideOval(v.x,v.z,q,5))||insideOval(q.x,q.z,p,5)))return null;
 return p;
}
// Tee pad half-extents and the maintained collar around them. A pad on its own
// reads as an oval dropped into scrub: the collar is what makes it look like
// ground somebody mows. The ground shader in ground.js paints both from these
// same numbers, so the painted surface and the classified lie cannot drift.
// A TEE IS A RECTANGLE WITH ROUNDED CORNERS, NOT AN OVAL.
//
// An oval is what the code happened to have -- ponds and bunkers are ovals --
// and it never looked like a tee, which is mown in straight lines by a machine
// that turns at the corners. Owner's call, and it costs nothing: the rounded
// box below is a proper signed distance in METRES, so the shoulder that falls
// away from a pad gets simpler rather than harder. The oval version had to
// normalise into the ellipse and convert back along the ray to recover a
// distance at all.
//
// Sizes uniformly smaller with it. The mown collar was 20 by 27 metres, which
// is most of why three tees on one hole read as a single green blob and why a
// quarter of consecutive pairs sat within 1.5 m of each other sideways.
// SHORTER DOWN THE LINE OF PLAY THAN IT WAS. 9 m long became 7.2, on the
// owner's call. Measured, it is not what makes a tee shot blind -- see
// RESEARCH -- but it is half of what took the ground within 40 m of a tee out
// of the sight line on 6 of the 8 shots where it was in it, and a 9 m pad on a
// 6 m width reads long.
export const TEE_PAD={x:3,z:3.6},TEE_ROUND=1.1,TEE_APRON_SCALE=1.45;
// Six inches, which is where a marker stands relative to the mown edge. They
// were set at 4 m either side of a pad 3 m wide, so both markers stood a metre
// OFF the tee they mark.
export const TEE_MARKER_INSET=.1524;
export const TEE_APRON={x:TEE_PAD.x*TEE_APRON_SCALE,z:TEE_PAD.z*TEE_APRON_SCALE};
// The middle of the fairway, which is not the centre line it is drawn around:
// the two edges vary independently, so where one side runs wider the playable
// middle sits several metres off that line. Stub holes in tests carry a centre
// line and no edges, and fall back to it.
export function fairwayMiddle(h,z){
 const c=h.center(z);
 if(!h.leftWidth||!h.rightWidth)return c;
 const left=fairwayWidth(h,z,0,-1),right=fairwayWidth(h,z,0,1);
 return left+right>0?c+(right-left)/2:c;
}
// WHERE A TEE IS SQUARED UP: as far down the hole as you can see in a
// straight line.
//
// Walk out along the middle of the fairway and stop where the straight line
// from this tee would start leaving the mown corridor. That is the dogleg
// corner where there is one and the landing area where there is not, which is
// where a player aims in both cases.
//
// Four simpler rules were measured first, over 810 tees on ordinary courses
// and 324 on deliberately dogleg-heavy ones. Each fails at one end or the
// other, and the two ends pull against each other:
//
//   20 yards ahead   median turn 44 degrees, two thirds of tees over 30. With
//                    tees sited a median 18 m off the centre line, aiming 18 m
//                    ahead is a 45 degree turn by arithmetic, not by taste.
//   the green        tidiest angles of all, and 40 of 324 tees on a dogleg
//                    course squared to a line leaving the fairway by over 25 m.
//                    Pointing at the pin points you into the trees.
//   fairway midpoint good lines on doglegs, but a bad tail elsewhere -- one tee
//                    turned 78 degrees, because on a short hole the midpoint
//                    can be nearly beside the tee.
//   landing area     good angles, 11 of 324 still straying past the corner.
//
// This one: median turn 7 degrees, 6 tees of 810 past 30, and ZERO lines
// straying badly on a dogleg course. It is the only candidate that is not
// trading one against the other.
export const TEE_AIM_MIN=55,TEE_AIM_FAR=250*.9144,TEE_AIM_SLACK=18;
// Where a shot from here is headed: the middle of the corridor, walked `range`
// metres along it so the answer follows a dogleg instead of cutting the corner.
// Runs past the end of the hole, or already on the green, and it is the pin.
export function fairwayAim(h,p,range){
 if(h.surface(p.x,p.z)==='green')return {...h.pin};
 let z=Math.max(0,p.z),remaining=Math.max(20,range),last={x:fairwayMiddle(h,z),z};
 while(z<h.length&&remaining>0){const nextZ=Math.min(h.length,z+2),next={x:fairwayMiddle(h,nextZ),z:nextZ};remaining-=Math.hypot(next.x-last.x,next.z-last.z);last=next;z=nextZ;}
 return z>=h.length?{...h.pin}:last;
}
// THE LAUNCH CORRIDOR: the one piece of ground a tee shot is entitled to.
//
// Measured before this existed: 29 of 648 tee shots (4.5%) had a trunk on the
// straight line to the fairway, the close ones 8 to 20 m off the tee. The only
// rule world trees obeyed was "at least 10 m outside a corridor", and beside a
// tee that is a tree in your face. (There was a 22 m no-tree bubble, but it sat
// in the per-hole tree list -- which nothing reads -- centred on hole-local
// origin while the tees stand 11 to 85 m away from it.)
//
// IT IS A WEDGE, NOT A BUBBLE, AND IT ONLY LOOKS FORWARD. Trees beside and
// behind a tee are wanted: they give the tee box something to sit in and they
// break up the basin the terracing leaves around a pad. So the keep-out starts
// at the tee, points where the tee points, and everything off to the side or
// behind it is left alone.
//
// It widens with distance the way a miss does, off a floor that keeps the first
// few metres clear regardless. LENGTH stops where the ball is well up and a
// trunk stops mattering; past that the corridor rules already apply.
// `apex` is the nominal shot's peak as a share of its carry, so a 210 m drive
// tops out near 30 m and a 150 m par-three shot proportionally lower.
// The siting rules for a specimen, exported so the tests assert against the
// numbers the generator actually uses.
//   gap       open short grass left on one side, so there is always a route
//   greenKeep how far back from the putting surface it stays
//   minHalf   the narrowest corridor that gets one at all
//   standoff  how far from a tee it must stand: inside this there is nothing a
//             player can do about it, which is the original complaint
// THE GREEN SURROUND: open where the shot comes in, closed behind and beside.
//
// Greens had the same moat as tees and worse -- 0% of course tree density inside
// 20 m, 10% out to 35 m, then a ring of 160-179% beyond it. But a green is not a
// tee: the clearance there is doing real work, because an approach has to have
// somewhere to land. Closing one in on every side changes how the hole plays,
// not just how it looks.
//
// So the keep-out is ASYMMETRIC. The approach -- the arc facing back down the
// fairway, where the shot comes from -- keeps its full clearance at every
// setting of the slider. Everything else, the back and the flanks, is what
// `greenTrees` moves: at 0 the trees stand off as far as they ever did, at 100
// they come in close to the collar.
export const GREEN={
 // Half-angle of the protected approach arc, measured off the line back down
 // the hole. Wide enough to cover a shot coming in from either side of the
 // fairway rather than only from dead centre.
 arc:62*Math.PI/180,
 open:46,          // clearance on the approach side, whatever the slider says
 far:40, near:24,  // back and flanks, at slider 0 and slider 100
 zone:90,          // how far out this rule replaces the ordinary corridor gate
 ramp:20,          // metres over which acceptance climbs once past the keep-out
};
// Every green with the direction its approach comes FROM, in world space.
// NOT `greenGuards` -- that name is already taken inside generateWorld by the
// tee-shoulder guard, and using it here silently shadowed this one.
export function greenApproaches(holes){
 const out=[];
 for(const h of holes||[]){
  const g=h.worldGreen;
  // A point back down the middle of the hole: that is where a shot comes from,
  // and on a dogleg it is not the same as the straight line from the tee.
  const backZ=Math.max(0,h.length-70);
  const back=h.toWorld({x:h.center(backZ),z:backZ});
  const dx=back.x-g.x,dz=back.z-g.z,len=Math.hypot(dx,dz)||1;
  out.push({x:g.x,z:g.z,dx:dx/len,dz:dz/len});
 }
 return out;
}
// How far a tree must stand off this green here, or 0 if it is out of range.
export function greenKeepOut(guards,x,z,closeness){
 let worst=0;
 for(const g of guards){
  const lx=x-g.x,lz=z-g.z,d=Math.hypot(lx,lz);
  if(d>GREEN.zone||d<1e-6)continue;
  // Angle off the approach direction: 0 means straight back down the fairway.
  const cos=(lx*g.dx+lz*g.dz)/d;
  const open=cos>=Math.cos(GREEN.arc);
  const keep=open?GREEN.open:GREEN.far+(GREEN.near-GREEN.far)*clamp(closeness,0,1);
  if(keep>worst)worst=keep;
 }
 return worst;
}
// THE TEE FAN: one combined cone for the whole tee complex.
//
// The shot test is per tee and stays that way -- each tee plays its own line.
// But a tree can sit outside the back tee's own wedge and still stand squarely
// in what you SEE from it, because the three tees are staggered and can be
// ninety metres apart across the hole. Judging each tee alone leaves the ground
// between them plantable, and that ground is directly down the view from the
// back of the complex.
//
// So planting is refused anywhere inside the convex hull of all three tees'
// wedges: trees go BEHIND the complex or outside the widest tee on each side,
// and nowhere in front of it. Unlike the shot test this ignores height, because
// a tree the ball flies over still blocks the view of where it is going.
const FAN_NEAR=10, FAN_ANGLE=9*Math.PI/180, FAN_LENGTH=200;
// Monotone chain. Tiny input -- twelve points per hole -- so clarity wins.
function hull(pts){
 const p=[...pts].sort((a,b)=>a.x-b.x||a.z-b.z);
 if(p.length<3)return p;
 const cross=(o,a,b)=>(a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x);
 const half=src=>{const out=[];for(const q of src){while(out.length>1&&cross(out[out.length-2],out[out.length-1],q)<=0)out.pop();out.push(q);}out.pop();return out;};
 return [...half(p),...half([...p].reverse())];
}
export function teeFans(holes){
 const fans=[];
 for(const h of holes||[]){
  const pts=[];
  for(const tee of Object.values(h.tees||{})){
   const aim=fairwayAim(h,tee,LAUNCH.reach);
   const from=h.toWorld(tee),to=h.toWorld(aim);
   const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz)||1;
   const ux=dx/len,uz=dz/len,px=-uz,pz=ux;
   const endW=FAN_NEAR+FAN_LENGTH*Math.tan(FAN_ANGLE);
   pts.push({x:from.x+px*FAN_NEAR,z:from.z+pz*FAN_NEAR},{x:from.x-px*FAN_NEAR,z:from.z-pz*FAN_NEAR});
   pts.push({x:from.x+ux*FAN_LENGTH+px*endW,z:from.z+uz*FAN_LENGTH+pz*endW},
            {x:from.x+ux*FAN_LENGTH-px*endW,z:from.z+uz*FAN_LENGTH-pz*endW});
  }
  if(pts.length>=3)fans.push(hull(pts));
 }
 return fans;
}
// `pad` is how far OUTSIDE the fan still counts as in it, in metres, so a thing
// with a body can be tested by its edge rather than by its centre. The cross
// product is divided by the edge length to turn it into a distance -- left as a
// raw cross it is an area, and a pad added to that would mean a different number
// of metres on every edge of the hull.
export function inTeeFan(fans,x,z,pad=0){
 for(const poly of fans){
  let inside=true;
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length];
   const ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez)||1;
   if((ex*(z-a.z)-ez*(x-a.x))/len<-pad){inside=false;break;}
  }
  if(inside)return true;
 }
 return false;
}
// A TREE LINE THINS OUT; IT DOES NOT STOP DEAD.
//
// Planting obeyed one hard rule -- at least 10 m outside any corridor -- and a
// cliff produces two artefacts at once. Measured around tee boxes: density in
// the first 25 m ran at 18-50% of the course average, and around greens 0% at
// 20 m with a RING of 160-179% further out, because every candidate the rule
// refused was pushed outward and bunched at the boundary. Together that reads
// as a clear-cut with a wall of trees round it, which is what it is.
//
// So the edge is a ramp: nothing at all below `floor`, then acceptance climbing
// to certainty by `soft`. Candidates near the edge are sometimes KEPT rather
// than all shoved out, which is what removes the bare moat and the pile-up in
// the same move.
//
// AROUND A TEE THE RAMP IS MUCH TIGHTER, and that is only safe because of the
// launch corridor. The blanket 10 m used to be what kept a tee shot clear; now
// `blocksLaunch` does that exactly, pointing where the shot actually goes, so
// the blanket is free to stop being a moat. Trees come right up to the mown
// apron behind and beside a pad, where they frame the box instead of standing
// back from it in a ring.
//
// Ground cover has no trunk and cannot block anything, so it runs closest of all.
// NEAR A TEE THE CORRIDOR-DISTANCE GATE GOES ENTIRELY, and it has to: measured,
// 71.5% of the ground in a 3-20 m ring around a tee sits within 2 m of a
// corridor by that rule while the SURFACE classifier calls it rough. The two
// disagree there, because the corridor envelope is wider than the mown turf at
// a hole's start. Any floor at all on `n.d` therefore bans most of the tee
// surround, which is precisely the clear-cut being complained about.
//
// What keeps it safe is that two other rules already do the real work: nothing
// may stand on mown turf, and nothing may stand in the launch corridor. Trees
// grow right up to the apron behind and beside the pad, and not in front of it.
// THE TEE RAMP IS A SHARE OF THE HOLE'S OWN WIDTH, NOT A NUMBER OF METRES.
//
// `teeFloor` was -20 m flat, and the quantity it is compared against scales with
// the fairway: `n.d` is the distance outside the corridor ENVELOPE, so a wider
// hole pushes the ground near its tee further negative. Measured across the
// width slider, the tee surround held at the 38 m default and collapsed at the
// top of the range -- 40% of course density on midwest and 26% on pnw at 92 m,
// worse than the clear-cut this work started from. A fixed floor cannot track a
// corridor that doubles in width.
//
// So the floor is `teeSpan` times the corridor's half-width at the tee, which
// holds the same shape of surround whatever the hole is doing. `teeFloorMin`
// keeps a sensible floor on the narrowest holes, where half of very little is
// not enough room for anything.
export const EDGE={floor:5,soft:18,teeSpan:-3,teeFloorMin:-20,teeSoft:5,teeZone:45};
export const FEATURE={gap:13,greenKeep:75,minHalf:15,standoff:130};
export const LAUNCH={near:8,angle:9*Math.PI/180,reach:210,apexShare:30/210};
// Every tee of every hole, as a world-space ray. Built once and reused: the
// alternative is asking each of ~18,000 candidate trees to work out which hole
// it might be in front of.
export function launchCorridors(holes,groundAt){
 const out=[];
 for(const h of holes||[]){
  for(const tee of Object.values(h.tees||{})){
   // NOT teeAim. That is the bearing the tee PAD is squared to and it looks
   // only ~60 m ahead; measured on one hole it pointed 35 degrees away from
   // where the ball goes, and the wedge missed an oak 20 m off the tee sitting
   // 0.7 m off the played line. The corridor follows the shot.
   const aim=fairwayAim(h,tee,LAUNCH.reach);
   const from=h.toWorld(tee),to=h.toWorld(aim);
   const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz)||1;
   // The carry is the distance to that target, not a constant: a par three is
   // played to the green, and a shot that stops at the green must not be
   // credited with clearing ground beyond it.
   // `aimY` is the ground at the target, which the view test sights to.
   out.push({x:from.x,z:from.z,dx:dx/len,dz:dz/len,carry:len,
    groundY:groundAt?groundAt(from.x,from.z):0,aimY:groundAt?groundAt(to.x,to.z):0});
  }
 }
 return out;
}
// Would a tee shot pass THROUGH something standing here, between baseY and topY?
//
// A fixed-length wedge was the first attempt and it is the wrong shape. At 90 m
// it let a fir through at 118 m on a redwood hole, where the ball is still only
// thirty metres up and the tree is eighty; lengthening it instead would have
// thrown away short trees far down the hole that nothing could ever hit. Asking
// about the actual height handles both ends, and it is the same question the
// acceptance test asks, which is the point.
// `within` limits how far down the shot the question is asked. Scatter planting
// gets the whole carry: a trunk anywhere on the line is an accident. A SPECIMEN
// gets only the near stretch, because a feature tree standing in the middle of
// the fairway at 180 m is not an accident -- it is the hole, and you play to the
// side of it. What makes that fair is the gap beside it, not an empty centre.
export function blocksLaunch(corridors,x,z,baseY,topY,pad=0,within=Infinity){
 for(const c of corridors){
  const lx=x-c.x,lz=z-c.z;
  const along=lx*c.dx+lz*c.dz;
  if(along<0||along>Math.min(c.carry,within))continue;
  const off=Math.abs(lx*c.dz-lz*c.dx);
  if(off>Math.max(LAUNCH.near,along*Math.tan(LAUNCH.angle))+pad)continue;
  const s=along/c.carry;
  const y=c.groundY+4*(c.carry*LAUNCH.apexShare)*s*(1-s);
  if(y>=baseY&&y<=topY)return true;
 }
 return false;
}
// WOULD SOMETHING STANDING HERE HIDE THE LANDING AREA FROM A TEE?
//
// `blocksLaunch` asks whether the BALL meets a thing, and near a tee the ball
// is already ten metres up, so a bush or a house fifteen metres out passes it
// while standing squarely in what the golfer sees. The tee fan answers the view
// question for trees by refusing them outright, whatever their height. That is
// too blunt for things often lower than the eye -- ankle-high cover in front
// of a tee is wanted -- so this asks the real question: inside a tee's forward
// view (the fan's own wedge, per tee), does the top rise above the line from
// the golfer's eye to the ground at the target? `pad` is the body's
// half-width, so a thing is judged by its edge rather than its centre.
// Added 12 October 2026 for bushes and houses (the owner: "bushes and houses
// sit in front of tees and block the view").
export function blocksView(corridors,x,z,topY,pad=0){
 for(const c of corridors){
  const lx=x-c.x,lz=z-c.z,along=lx*c.dx+lz*c.dz;
  if(along<0||along>c.carry)continue;
  const off=Math.abs(lx*c.dz-lz*c.dx);
  if(off>FAN_NEAR+along*Math.tan(FAN_ANGLE)+pad)continue;
  const eye=c.groundY+TEE_EYE,s=along/c.carry;
  if(topY>eye+((c.aimY??c.groundY)-eye)*s)return true;
 }
 return false;
}
export function teeAim(h,tee){
 if(!tee){
  // No tee given: the hole's own answer, a little inside where mown turf
  // starts, since a corridor is capped to nothing at its very edge.
  const start=h.mowStart??h.fairwayStart??22,z=Math.min(h.length,start+14);
  return {x:fairwayMiddle(h,z),z};
 }
 const far=h.par===3?h.length:Math.min(h.length-30,tee.z+TEE_AIM_FAR);
 const near=Math.min(far,tee.z+TEE_AIM_MIN);
 let best={x:fairwayMiddle(h,near),z:near};
 for(let z=near+8;z<=far;z+=8){
  const a={x:fairwayMiddle(h,z),z},dx=a.x-tee.x,dz=a.z-tee.z,len=Math.hypot(dx,dz)||1;
  let clear=true;
  for(let d=20;d<len&&clear;d+=6){
   const u=d/len,x=tee.x+dx*u,zz=tee.z+dz*u,c=h.center(zz);
   const half=fairwayWidth(h,zz,0,Math.sign(x-c)||1);
   if(half&&Math.abs(x-c)-half>TEE_AIM_SLACK)clear=false;
  }
  if(!clear)break;
  best=a;
 }
 return best;
}
// Distance from the centre of a rounded box, negative inside. One definition,
// used by the lie, the paint, the shaping, the siting and the measurements --
// five places that have to agree about where a tee is.
export function teeBox(dx,dz,hx,hz,r){
 const qx=Math.abs(dx)-(hx-r),qz=Math.abs(dz)-(hz-r);
 return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-r;
}
// How much a clear shot is worth against flat ground when picking a tee site.
// How much a clear shot is worth against flat ground when picking a tee site.
// Swept: at 1.6 a fifth more pads had to be RAISED to see over what was in
// front of them, and there were half again as many blind shots. Past 10 it
// stops buying anything and only picks rougher ground.
const TEE_SEE=10;
// The biggest height difference two neighbouring pads may have and still be
// levelled into one platform.
const TEE_MERGE=1.2;
// How far apart across the hole two consecutive tees would like to sit.
const TEE_STAGGER=10;
// How hard the siting pushes a tee out of line with the ones already placed.
// Swept against the measurement rather than chosen: see RESEARCH.
const TEE_STAGGER_W=5;
// HOW MUCH OF THE SHOULDER IS TAKEN OFF DIRECTLY IN FRONT OF A TEE.
//
// The shoulder was isotropic: the same reach in every direction, so the bank
// that makes a tee read as built when you see it from the side is also a long
// gentle slope sitting between you and the fairway when you stand on it. Those
// two want opposite things, and only one of them is in shot while you play.
//
// 0 is the old behaviour. 0.5 halves the reach straight ahead and therefore
// doubles the steepness there, tapering to nothing at the sides so the bank
// behind and beside the pad -- the part you actually look at -- is untouched.
const TEE_FRONT_FALL=0.35;
// The country (land; country.js). PLACED, round by round: how far the long shape
// is softened, in metres to a side of each of three passes; how far the
// distance from a corridor is; how much of that distance counts as the
// corridor still, so that a tee at its tip stays clear; how far past the
// course the fields reach; and
// how much of the long shape a hole keeps per unit of elevation, and the most
// it may vary per unit, as one standard deviation in metres: on the whole of
// the long shape a Rockies fairway was 12% at the median. No elevation, no
// height change along a hole at all (tests/play.test.mjs).
const COUNTRY_SOFT=50,CLEAR_SOFT=14,CLEAR_EDGE=12,COUNTRY_MARGIN=340,COUNTRY_KEEP=1.85,COUNTRY_SPREAD=18.5;
// THE PAD IS THE GROUND; THE TEE IS WHERE YOU STAND ON IT.
//
// They used to be the same thing -- one fixed oval centred on every marker --
// which is why every par three had overlapping tees. Spacing between markers
// is a fraction of the hole's length, so on a short hole they land 9 to 12 m
// apart while each pad is 16 m long. Measured over thirty courses: all 66 par
// threes overlapped, and 21% of all tee pairs overlapped somewhere.
//
// A real short hole answers this with ONE long tee and the markers set at
// different points down it, which is what `pad` allows: a marker can carry a
// pad of its own size and position, or carry none at all and simply stand on
// a neighbour's. A tee that says nothing gets exactly the old behaviour, so
// the driving range and everything else is untouched.
// A rectangle in a hole's own frame, as a box in the world that contains it. The
// frame is a rotation and a shift, so the four corners are enough; a metre of
// slack keeps a point that sits on an edge from being lost to rounding.
export function worldBoxOf(h,x0,x1,z0,z1,pad=1){
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const [x,z] of [[x0,z0],[x0,z1],[x1,z0],[x1,z1]]){const w=h.toWorld({x,z});minX=Math.min(minX,w.x);maxX=Math.max(maxX,w.x);minZ=Math.min(minZ,w.z);maxZ=Math.max(maxZ,w.z);}
 return {minX:minX-pad,maxX:maxX+pad,minZ:minZ-pad,maxZ:maxZ+pad};
}
export function teePad(t){
 if(t.pad===null)return null;
 return t.pad??{z:t.z,rz:TEE_PAD.z,ux:t.ux??0,uz:t.uz??1};
}
// A TEE IS SQUARED TO THE SHOT, AND SO IS THE GROUND UNDER IT.
//
// The pad was axis-aligned in the hole's own frame while the markers were
// squared to `teeAim`. That was invisible while a pad was an oval and every
// tee sat on the centre line; it is obvious once a pad is a rectangle and tees
// sit a median 15 m off to one side, because the box and the markers on it
// point different ways.
//
// Rotates an offset into the pad's own frame: along the line of play, and
// across it.
export function teeFrame(dx,dz,ux,uz){
 return {across:dx*uz-dz*ux,along:dx*ux+dz*uz};
}
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
export function sightline(h,tee,eyeY,sample){
 // A par three is played to the green; anything else to a good drive.
 const reach=h.par===3?h.length-tee.z:Math.min(h.length-tee.z-30,250*.9144);
 if(reach<60)return {over:0,lift:0,reach:0};
 const aimZ=tee.z+reach,aim={x:h.center(aimZ),z:aimZ};
 const aw=h.toWorld(aim);
 const target=sample(aw.x,aw.z);
 const span=Math.hypot(aim.x-tee.x,aim.z-tee.z)||1;
 const wide=(h.settings?.semiRough??6)+45;
 let over=0,lift=0;
 // FROM WHERE THE PLAYER ACTUALLY STANDS, ALONG THE LINE THEY ACTUALLY HIT.
 //
 // This used to start at the centre line at the tee's distance down the hole,
 // which was true when every tee sat on the centre line and stopped being true
 // the moment tees were sited on ground that suits them -- they now sit a
 // median 19 m off it. It was measuring a shot nobody plays.
 //
 // The centre line was used for a reason: a straight line to a point 250 yards
 // along a curving hole leaves the corridor on a dogleg and reads whatever
 // happens to be out there. That is still handled, but by ignoring ground well
 // outside the corridor rather than by pretending the tee is somewhere else.
 for(let d=12;d<span*.8;d+=5){
  const u=d/span,lx=tee.x+(aim.x-tee.x)*u,lz=tee.z+(aim.z-tee.z)*u;
  const centre=h.center(lz),half=fairwayWidth(h,lz,0,Math.sign(lx-centre)||1);
  if(half&&Math.abs(lx-centre)>half+wide)continue;
  const q=h.toWorld({x:lx,z:lz});
  const o=sample(q.x,q.z)-(eyeY+(target-eyeY)*u);
  if(o>over)over=o;
  // Raising the eye by L lifts the sightline at fraction u by L*(1-u), so an
  // obstruction of o at u costs o/(1-u) to see over. Only the first three
  // quarters, and the divisor is floored: near the target 1-u goes to zero and
  // the required lift goes to infinity with it, which once had a 0.35 m ripple
  // demanding a 3.5 m tee on dead flat ground. A threshold, too, so the height
  // field's own noise cannot raise anything.
  if(o>.15)lift=Math.max(lift,o/Math.max(.25,1-u));
 }
 return {over,lift,reach};
}
export function localSurface(h,x,z){
 const d=greenDistance(h,x,z),s=h.settings;
 if(d<=0)return 'green';if(d<=s.fringe)return 'fringe';
 if(Object.values(h.tees).some(t=>{const p=teePad(t);if(!p)return false;const f=teeFrame(x-t.x,z-p.z,p.ux,p.uz);return teeBox(f.across,f.along,TEE_PAD.x,p.rz,TEE_ROUND)<0;}))return 'tee';
 if(h.ponds.some(p=>insideOval(x,z,p)))return 'water';
 // A bunker past the hole table's slots (`field`) is the surface field's, and
 // the world's surface reads it there (surface-field.js).
 if(h.bunkers.some(p=>!p.field&&insideOval(x,z,p)))return 'sand';
 // The fairway is tested BEFORE the green's semi collar, and the order is the
 // whole point. The ground shader paints the mown corridor OVER that collar, so
 // an apron running up to the fringe is drawn as fairway; testing the collar
 // first here returned 'semi' for the same ground and the painted surface then
 // disagreed with the lie the ball actually got. It was about half a percent of
 // a hole -- the apron short of every green -- and invisible until the driving
 // range put a green inside a full-width corridor and made it 1.4%.
 if(Math.abs(x-h.center(z))<fairwayWidth(h,z,0,x-h.center(z)))return 'fairway';
 // A COLLECTION AREA (architect-courses, phase 3; architect.js): short grass
 // on a green's low side, mown at fairway height, over the semi-rough and the
 // rough only -- the rule the ground shader paints by (its hazard slots, kind
 // -1). Only an Architect hole has any.
 if(h.collections?.some(c=>insideOval(x,z,c)))return 'fairway';
 if(d<=s.fringe+s.semiRough||Math.abs(x-h.center(z))<fairwayWidth(h,z,s.semiRough,x-h.center(z)))return 'semi';
 // Last, so anything already maintained keeps the better surface and a bunker
 // or pond beside a tee still plays as itself.
 if(Object.values(h.tees).some(t=>{const p=teePad(t);if(!p)return false;const f=teeFrame(x-t.x,z-p.z,p.ux,p.uz);return teeBox(f.across,f.along,TEE_APRON.x,p.rz*TEE_APRON_SCALE,TEE_ROUND*TEE_APRON_SCALE)<0;}))return 'semi';
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
// Kept as a name because tests and other modules ask the question this way,
// but the answer lives on the biome now rather than in a list here.
export const NO_INLAND_WATER = {has: key => !biomeOf(key).inlandWater};

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

// GENERATION IN STEPS, with a synchronous drain in front of it.
//
// The tests, the bench and the fingerprint tool all call `generateWorld` and get
// exactly what they always got: the generator runs to completion with nothing
// between the steps. The app calls `generateWorldSteps` through a driver that
// pauses on a time budget, so the browser gets frames and the overlay can show
// real progress instead of a message that cannot move.
//
// Every step yields {label, done} where `done` is 0..1 across the whole build,
// weighted by PHASE so the reading advances at something like an even rate --
// the ground grid alone is 81% of the work and would otherwise sit at 3% for
// seven seconds and then finish.
//
// A WEB WORKER CANNOT DO THIS. The world handed back holds closures --
// `toWorld`, `height`, `surface`, `nearest` -- and a closure cannot cross a
// worker boundary. Moving generation off-thread means making the world pure
// data and rebuilding every closure on the main thread afterwards.
// The grid reports its own 0..1; this lifts it onto the whole-build scale and
// hands back the finished grid, so the call site reads like a function call.
function* stepGrid(it){
 let r=it.next(),last=0;
 while(!r.done){
  // A wait on the workers is passed up to the driver with the progress so far,
  // and whatever it resolves to is passed back down.
  if(r.value&&r.value.await){const got=yield {...phaseAt(3,last),await:r.value.await};r=it.next(got);continue;}
  last=r.value;yield phaseAt(3,r.value);r=it.next();
 }
 return r.value;
}
const PHASE=[
 ['Routing the holes',.03],
 ['Shaping the land',.09],
 ['Cutting the water',.04],
 // The cartoon overhaul's stands made planting a fifth of a wooded course's
 // wait in one Node process (the grid runs on workers in the browser, so its
 // share there is smaller still): .03 -> .10, taken from the grid. Measured on
 // Autumn, PNW, Links and Desert, 18 holes; PLACED between them.
 ['Building the ground',.74],
 ['Planting',.10],
];
const phaseAt=(i,local=0)=>{
 let base=0;for(let k=0;k<i;k++)base+=PHASE[k][1];
 return {label:PHASE[i][0],done:base+PHASE[i][1]*Math.min(1,Math.max(0,local))};
};
// THE RANGE'S GREENS IN THE GROUND (16 October 2026). Each green with a slope
// set up (range.js rangeContour) is its contour inside the green and collar,
// faded back to the level field over RANGE_BANK beyond the fringe, then blended
// in the way a course green is. Faded rather than left to the blend alone,
// because a tilted plane keeps rising past the edge: blended over a course
// green's 40 m shoulder it leaned the ground under the next target. A flat
// green changes nothing and is skipped. PLACED: an 8 m bank, a 12 m shoulder.
const RANGE_BANK=8,RANGE_SHOULDER=12;
function rangeGreensShape(h,p,y,base,fringe){
 for(const g of h.greens){
  if(g.hidden||!g.setup||g.setup.slope==='flat')continue;
  const d=greenDistance(g,p.x,p.z);
  if(d-fringe-1>=RANGE_SHOULDER)continue;
  const w=h.toWorld(g.green),fade=1-smooth((d-fringe)/RANGE_BANK);
  const greenY=base(w.x,w.z)+rangeContour(g,p.x,p.z)*fade,blend=1-smooth((d-fringe-1)/RANGE_SHOULDER);
  if(blend>0)y=y*(1-blend)+greenY*blend;
 }
 return y;
}
export function generateWorld(settings={}){
 const it=generateWorldSteps(settings);
 let r=it.next();while(!r.done)r=it.next();
 return r.value;
}
// `options.gridPool`: heights for the ground grid computed on other cores (see
// makeGroundGridPooled); the grid is the same either way. `options.capture`: a
// worker's run, which stops at the grid and yields `{capture: {sample, refine}}`.
export function* generateWorldSteps(settings={},options={}){
 const s={...SCHEMA_DEFAULTS,...settings,courseYards:settings.courseYards??(settings.holes===18?6480:3240)};s.holes=s.holes===18?18:s.holes===1?1:9;s.waterMin=clamp(s.waterMin,.2,8);s.waterMax=clamp(s.waterMax,s.waterMin,12);
 // The driving range is one hand-built hole rather than a generated one, but it
 // is still a hole, so everything past this line -- routing, terrain, ground
 // textures, vegetation -- treats it exactly like any other and needs no branch.
 const bio=biomeOf(s.biome),holes=s.range?[buildRange(s,0)]:Array.from({length:s.holes},(_,i)=>generateCourse(s,i)),{halfX,halfZ,footprint,shift:routeShift}=routeHoles(holes,s,random),waterLevel=0,severity=s.elevation/100;
 yield phaseAt(1);
 // WHERE AN EDGE COAST RUNS (`coastAt(z)`: the middle of the shore's ramp at
 // each z; the water itself starts about 40 m further out). 90 m in from the
 // course's edge -- except a landscape that `coastSeek`s (Monterey: the
 // owner, 3 November 2026, "Make sure the holes can genuinely play along the
 // coast"), where the shore follows the holes: at each z its line runs 130 m
 // inside the eastern edge of the nearest hole's corridor (its tees-to-green
 // line plus 30 m) -- the ramp needs some 80 m to take high ground under the
 // sea -- and the land never ramps down within 25 m of any corridor (land,
 // below), so the eastern holes play along the sea, a cliff at their edge. The profile is a running maximum over 60 m and then an
 // average, so the shore never comes in nearer a hole than its own band says
 // and its coves are rounded. Generator 79; every number PLACED.
 // landscape-edge.js and vegetation.js read it from the world.
 const coastFar=halfX-90;let coastAt=()=>coastFar,coastMin=coastFar,coastMax=coastFar;
 if(bio.edgeCoast&&bio.coastSeek){
  const step=10,z0=-halfZ-200,n=Math.ceil((2*halfZ+400)/step)+1,east=new Float32Array(n).fill(-Infinity);
  for(const h of holes){
   const line=[...Object.values(h.tees||{}).slice(0,1),...(h.aims||[]),h.green].filter(Boolean).map(p=>h.toWorld(p));
   for(let q=1;q<line.length;q++){const a=line[q-1],b=line[q],k=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/8));
    for(let i=0;i<=k;i++){const x=a.x+(b.x-a.x)*i/k,z=a.z+(b.z-a.z)*i/k,j0=Math.max(0,Math.floor((z-40-z0)/step)),j1=Math.min(n-1,Math.ceil((z+40-z0)/step));for(let j=j0;j<=j1;j++)east[j]=Math.max(east[j],x+30);}}
  }
  // A cliff coast (`cliffCoast`, below) needs no 80 m ramp: its line runs `offset` metres OUTSIDE
  // the eastern holes' line, so the sea never comes in among them.
  const raw=Array.from(east,e=>Number.isFinite(e)?Math.min(coastFar,bio.cliffCoast?e+bio.cliffCoast.offset:e-130):coastFar),W=6;
  const at=(arr,j)=>arr[Math.min(n-1,Math.max(0,j))];
  const dil=raw.map((_,j)=>{let m=-Infinity;for(let d=-W;d<=W;d++)m=Math.max(m,at(raw,j+d));return m;});
  const sm=dil.map((_,j)=>{let t=0;for(let d=-W;d<=W;d++)t+=at(dil,j+d);return t/(2*W+1);});
  coastAt=z=>{const f=(z-z0)/step,j=Math.max(0,Math.min(n-2,Math.floor(f))),t=Math.min(1,Math.max(0,f-j));return sm[j]*(1-t)+sm[j+1]*t;};
  coastMin=Math.min(...sm);coastMax=Math.max(...sm);
 }
 const phase=random(s.seed+':land')()*100,coastal=bio.coastal;
 // THE COUNTRY BETWEEN THE HOLES (the cartoon overhaul; landforms.js): the
 // biome's recipe of crags, mesas, dunes or washes. Its relief rides on the
 // landform setting the way the hills do, at 70% (the default) exactly as the
 // recipe states it.
 // Not on the driving range: it is a hand-built hole whose flatness is the
 // instrument (PROJECT_HANDOFF *The range is a hole*), and a crag or a wash
 // across it is a variable nobody set.
 let landform=landformOf(s.range?{}:bio,s.seed);
 // A course routed round its ranges (routing.js) was moved to the middle after routing; the ranges
 // move with it, or the holes would land back on them.
 if((landform.longLift||landform.routed)&&routeShift&&(routeShift.x||routeShift.z)){const o=routeShift,F=f=>f&&((x,z,...r)=>f(x+o.x,z+o.z,...r));
  landform={...landform,lift:F(landform.lift),longLift:F(landform.longLift),raw:F(landform.raw),treeKeep:F(landform.treeKeep),rocky:F(landform.rocky)};}const liftScale=(s.landform??70)/70;
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
 // A ROUGH BOX AROUND EACH HOLE, so the search below can rule one out cheaply.
 //
 // `nearest` answers "which hole is this patch of ground nearest, and how far
 // outside its corridor does it sit". Every grid the generator builds asks it
 // for every cell, which made it 15% of the time taken to build a course, and
 // the hole-centre-line work it drives about 40%. It used to measure against
 // all nine holes every time, including ones on the far side of the property.
 //
 // The box holds the hole's whole centre line. The distance from a point to
 // that box, less the widest its corridor ever gets, can never be more than
 // the real answer -- so once that lower figure is already worse than the best
 // hole found so far, this hole cannot win and the real work is skipped.
 // SHARED FAIRWAYS on a links (the cartoon overhaul; `sharedFairways`).
 // Before anything measures a corridor, so ownership, the ground and every
 // surface question see the widened holes.
 if(bio.sharedFairways&&!s.range)shareFairways(holes,bio.sharedFairways);
 const holeBoxes = holes.map(h => {
  const greenEnd = 25 + s.fringe + s.semiRough;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, reach = greenEnd;
  for (let i = 0; i <= 32; i++) {
   const zz = h.length * i / 32, w = h.toWorld({x: h.center(zz), z: zz});
   minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x);
   minZ = Math.min(minZ, w.z); maxZ = Math.max(maxZ, w.z);
   reach = Math.max(reach, h.width(zz) + s.semiRough);
  }
  // Slack, because the box comes from samples of a curve rather than the curve.
  // Too generous only costs a few skips it could have taken; too tight is wrong.
  return {minX: minX - 12, maxX: maxX + 12, minZ: minZ - 12, maxZ: maxZ + 12,
   reach, group: Math.floor(h.hole / 3)};
 });
 // Ground is asked about in scans, so whichever hole won last time usually wins
 // again. Measuring it first makes the rejection above bite straight away.
 let lastBest = 0;
 // Each centre line's ends and the way it runs there, a metre in (`measure`).
 const ends = holes.map(h => ({c0: h.center(0), t0: h.center(1) - h.center(0), cL: h.center(h.length), tL: h.center(h.length) - h.center(h.length - 1)}));
 function nearest(x, z) {
  let best = -1, distance = Infinity, local = null;
  // ONLY AN ISLAND READS `other`. Keeping a minimum per group of three holes
  // means measuring at least one hole in every group no matter where the point
  // is, which is most of the work the box would otherwise save. Everywhere
  // else it is simply not computed.
  const groups = coastal ? new Array(Math.ceil(holes.length / 3)).fill(Infinity) : null;
  const measure = i => {
   const {d, p} = corridorDistance(i, x, z);
   if (groups) {const g = holeBoxes[i].group; if (d < groups[g]) groups[g] = d;}
   if (d < distance) {best = i; distance = d; local = p;}
  };
  measure(lastBest);
  for (let i = 0; i < holes.length; i++) {
   if (i === lastBest) continue;
   const b = holeBoxes[i];
   const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
   const floor = Math.hypot(dx, dz) - b.reach;
   // Skipping is only safe when this hole can beat neither the best so far nor
   // its own group's minimum. A group still holding Infinity has had no hole
   // measured yet, so the first of every group is always measured.
   if (floor >= distance && (!groups || floor >= groups[b.group])) continue;
   measure(i);
  }
  lastBest = best;
  return {h: holes[best], p: local, d: distance,
   other: groups ? Math.min(...groups.filter((_, i) => i !== holeBoxes[best].group)) : Infinity};
 }
 // How far (x, z) is outside hole i's corridor (negative inside it), and the
 // point in the hole's frame.
 function corridorDistance(i, x, z) {
   const h = holes[i], p = h.toLocal({x, z}), zz = clamp(p.z, 0, h.length);
   const corridor = h.width(zz) + s.semiRough, greenEnd = 25 + s.fringe + s.semiRough;
   // THE STRAIGHT TONE STEP, round 5 (the far-landscape goal). Past either end
   // the centre line carries straight on along its end direction. It stopped
   // dead there, so beside a green the distance turned at once from "across
   // the bending centre line" to "from its end point", a kink along a straight
   // line through the green's end, out across the rough on both sides; the
   // hills fade in by this distance, so the ground creased there and the slope
   // tint drew it (Midwest hole 2, seen from the approach). Carried on, the
   // distance turns smoothly; behind the green it still rounds the end.
   const e = ends[i], cx = p.z > h.length ? e.cL + e.tL * (p.z - h.length) : p.z < 0 ? e.c0 + e.t0 * p.z : h.center(zz);
   const d = Math.hypot(p.x - cx, p.z - zz) -
    (corridor + Math.max(0, greenEnd - corridor) * smooth((p.z - h.length) / GREEN_RAMP));
   return {d, p};
 }
 const nearby=(x,z)=>nearest(x,z).h;
 // THE BASE ROLL'S SHARE (`baseRoll`, terrain true to place, 3 November
 // 2026): the corridor's broad roll answers the elevation setting the same
 // way on every landscape, so the Bayou rolled 14 m like the Heartland where
 // the Mississippi's alluvial plain has about 5 m at the most (USDA MLRA
 // 131A). A landscape may scale it down; 1 everywhere else. PLACED.
 const baseRoll=bio.baseRoll??1;
 // `baseHeight`: where the ground sits above the sea before it rolls, for a
 // landscape whose sea comes in among the holes (the Lowcountry's creeks,
 // generator 80). 12 m everywhere else. PLACED.
 // THE LAND TILTED UP TOWARD THE BIG MOUNTAIN (`tilt`, Desert Mountain; the owner, 7 November 2026:
 // "a landscape overall high point and a landscape overall low point. The entire landscape would be
 // gradually rising towards wherever the big mountain is placed"). Everything rides on it -- the
 // ground, the holes, the ponds' levels, the far ring past the edge -- through `base`: a rise of
 // `tilt.height` either side of the middle, eased over `tilt.over` metres (tanh), so the slope is
 // at most height/over at the middle and the far country levels off. Scaled by the elevation
 // setting as the hills are, so a flat course stays gentle. PLACED.
 const cliffSalt=saltOf(s.seed,'cliff');
 const tiltAt=bio.tilt&&!s.range&&!coastal?(()=>{const a=massifHeading(s.seed),ux=Math.cos(a),uz=Math.sin(a),T=bio.tilt.height*Math.min(1,.4+severity);return (x,z)=>T*Math.tanh((x*ux+z*uz)/bio.tilt.over);})():()=>0;
 const base=(x,z)=>tiltAt(x,z)+Math.max(coastal?1.8:-100,(coastal?3.5:bio.baseHeight??12)+severity*baseRoll*((coastal?15:22)+(coastal?12:22)*Math.sin(x/145+phase)*Math.cos(z/190)+(coastal?6:12)*Math.sin(z/94+x/180)));
 // Hazards follow their local ground elevation instead of draining every lake
 // down to a single sea level. Depth is the selected maximum basin depth.
 for(const h of holes){h.ponds=h.ponds.filter(p=>{const q=h.toWorld(p);return nearby(q.x,q.z)===h&&Array.from({length:24},(_,i)=>{const edge=ovalRadius(p,i*Math.PI/12,1);const v=h.toWorld({x:p.x+edge.x,z:p.z+edge.z});return nearby(v.x,v.z)===h;}).every(Boolean)&&!holes.some(other=>other!==h&&['tee','green','fringe','fairway'].includes(localSurface(other,other.toLocal(q).x,other.toLocal(q).z)));});for(const p of h.ponds){const q=h.toWorld(p);p.level=base(q.x,q.z)-.45;}}
 // A BUNKER STAYS ON ITS OWN HOLE'S GROUND, as a pond already must. The ground
 // shader paints only the owning hole's hazards, and the owner is `nearest`, so
 // a bunker reaching onto a neighbour's ground was dug out there -- every
 // hole's excavation applies everywhere -- but painted, and played, as that
 // hole's rough: a buried bowl with a white sliver along a staircase edge
 // (2 October, seen behind a green on the website's desert clip; about one
 // bunker in twenty, `bench bunkers`). The ring is the excavation's own reach,
 // 1.15 of the outline. Dropped rather than moved: nudging it inward would
 // re-fit green-side pockets the binary search above already placed off the
 // fringe, and handing the ground to the bunker's hole instead would cut the
 // neighbour's corridor. No draw is taken, so nothing generated after shifts.
 for(const h of holes)h.bunkers=h.bunkers.filter(b=>Array.from({length:48},(_,i)=>{const e=ovalRadius(b,i*Math.PI/24),v=h.toWorld({x:b.x+e.x*1.15,z:b.z+e.z*1.15});return nearby(v.x,v.z)===h;}).every(Boolean));
 // THE ROAD'S VALLEY (a recipe that `sinks`, the Badlands). The public road is
 // laid long after the ground (roads.js), straight, ROAD_MARGIN outside the box
 // round the holes on whichever side the clubhouse ends up, and it drapes over
 // what it meets: over a 60 m formation, a black ribbon up a wall. So the
 // formations leave the four lines it can take, a valley 2 * ROAD_VALLEY wide
 // running the length of each, the ground rising out of it over the recipe's
 // own reach. PLACED.
 const ROAD_VALLEY=26,roadLines=landform.sinks&&!s.range&&holes.length?(b=>[[b.x0-ROAD_MARGIN,b.z0-120,b.z1+120,0],[b.x1+ROAD_MARGIN,b.z0-120,b.z1+120,0],[b.z0-ROAD_MARGIN,b.x0-120,b.x1+120,1],[b.z1+ROAD_MARGIN,b.x0-120,b.x1+120,1]])(holesBox(holes)):null;
 const roadValley=(x,z)=>{
  let d=Infinity;
  for(const [at,lo,hi,across] of roadLines){const u=across?x:z,v=across?z:x;d=Math.min(d,Math.hypot(v-at,Math.max(lo-u,0,u-hi)));}
  return smooth((d-ROAD_VALLEY)/(landform.reach??bio.hills.reach));
 };
 // THE COUNTRY IS ONE SURFACE (country.js; the owner, 4 November 2026). Hills
 // and landforms stand everywhere, and a hole lies on the long shape of them,
 // softened over COUNTRY_SOFT metres and eased toward the course's mean by how
 // much elevation was asked for: the ground beside it rises one way and falls
 // the other. `fade` runs from that long shape on a corridor to the full
 // country past the recipe's reach, read from a softened distance so that no
 // line stands where two corridors are equally near. The driving range and
 // the islands keep `base` under them: any tilt on a range is a variable the
 // player did not set. A recipe that `sinks` stands its formations on the
 // floor and takes the fade itself, and its lift is not part of the long shape.
 const relief=s.landform/100;
 const rollingAt=(x,z)=>.45+.28*Math.sin(x/96+phase)*Math.cos(z/113)+.2*Math.sin(x/49-z/71);
 const hillsAt=(x,z)=>relief*(bio.hills.base+severity*bio.hills.severity)*rollingAt(x,z);
 const countryAt=(x,z)=>base(x,z)+hillsAt(x,z)+(landform.sinks?0:liftScale*landform.lift(x,z));
 // A recipe may keep part of its lift out of the long shape (`longLift`, Desert Mountain's ranges):
 // a hole crossing a range then keeps the valley floor -- a draw -- instead of climbing onto it,
 // which hid a landing area 13 m deep (round 5).
 const longAt=landform.longLift&&!landform.sinks?(x,z)=>base(x,z)+hillsAt(x,z)+liftScale*landform.longLift(x,z):countryAt;
 const fieldBox=[-halfX-COUNTRY_MARGIN,-halfZ-COUNTRY_MARGIN,halfX+COUNTRY_MARGIN,halfZ+COUNTRY_MARGIN];
 const longShape=s.range||coastal?null:softField(...fieldBox,24,longAt,COUNTRY_SOFT);
 const longMean=longShape?fieldMean(...fieldBox,60,longShape):0,longSpread=longShape?Math.sqrt(fieldMean(...fieldBox,60,(x,z)=>(longShape(x,z)-longMean)**2)):0;
 const longKeep=Math.min(1,severity*COUNTRY_KEEP,severity*COUNTRY_SPREAD/(longSpread||1));
 const floorAt=longShape?(x,z)=>longMean+longKeep*(longShape(x,z)-longMean):base;
 const clearOf=s.range||coastal?(x,z)=>nearest(x,z).d:softField(...fieldBox,12,(x,z)=>nearest(x,z).d,CLEAR_SOFT);
 // TEES UP ON THE ROCK (`rockTees`, Desert Mountain; the owner, 7 November
 // 2026: "is there any way we can have some of our tee shots hit off of these
 // mountain structures? Maybe like 1.5 holes per 18"). On that share of holes
 // a long rock outcrop -- the landform's own football shape, its long axis down
 // the hole -- rises under the back tee, and the middle tee too where the room
 // allows, rocky all over and flat only where each pad is cut (round 3, the
 // owner: "Instead of flattening the entire top. Let's just try flattening only
 // the tee box ... Make sure we don't introduce blind shots"), wholly on
 // its own hole's ground, and gone 10 m short of the fairway, so the drive is played down off it. Added after
 // the corridor fade (`land`), since the fade would flatten it like any other
 // landform. Its own draws (':rock-tees'), so no other hole moves. Every
 // number PLACED: height 10 to 16 m, 26 m half-width, its body full to 0.6 of
 // it, the tees within 0.55; 9 m clear round each pad, and in front of each, a
 // lane 8 m either side (widening 15% of the way out) where no rock stands above
 // the body, so nothing on the outcrop blocks the drive.
 const perches=[];
 if(bio.rockTees&&!s.range){
  const pr=random(s.seed+':rock-tees'),want=Math.floor(holes.length*bio.rockTees+pr()),order=holes.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(pr()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(const i of order){
   if(perches.length>=want)break;
   const h=holes[i],t=Object.values(h.tees),mow=h.mowStart??h.fairwayStart;
   if(!t.length||mow==null)continue;
   // The tees on it sit on the flat top (d under .55); its foot stops 10 m short of
   // the mown fairway, and every part of it is this hole's own ground. The middle tee too
   // where that fits, else the back tee alone, else no outcrop on this hole.
   const zs=t.map(q=>q.z).sort((a,b)=>a-b),back=zs[0],r=26;
   // Never shorter than 46 m end to end each way (a short one stood round, a crater): the
   // extra length goes behind the tees, so its foot stays where it was.
   const fit=front=>{const z0=back-14,L=Math.max(46,(front-z0)/2/.4),zc=Math.min((z0+front)/2,mow-10-L);
    return Math.abs(back-zc)/L<=.4&&Math.abs(front-8-zc)/L<=.4?{zc,L,front}:null;};
   const f=(zs.length>1&&fit(zs[1]+8))||fit(back+8);
   if(!f)continue;
   const {zc,L,front}=f;
   const a=h.toWorld({x:h.center(zc),z:zc}),b=h.toWorld({x:h.center(zc+10),z:zc+10}),len=Math.hypot(b.x-a.x,b.z-a.z)||1;
   const p={h,cx:a.x,cz:a.z,ux:(b.x-a.x)/len,uz:(b.z-a.z)/len,L,r,top:front,height:10+6*pr(),
    pads:t.filter(q=>q.z<=front-8+1e-6).map(q=>h.toWorld(q))};
   let own=true;
   for(let u=-1;u<=1&&own;u+=.1)for(let v=-1;v<=1&&own;v+=.1){if(u*u+v*v>1)continue;const x=p.cx+u*L*p.ux-v*r*p.uz,z=p.cz+u*L*p.uz+v*r*p.ux;if(nearby(x,z)!==h)own=false;}
   if(own)perches.push(p);
  }
 }
 // Where (x, z) sits on a perch: its normalised distance d (0 on the crest line's middle, 1 at
 // the foot), the perch, and the lift there -- its body full inside d .6, falling to nothing at 1,
 // and the landform's boulders over all of it at 0.6 of their size, fading out at the foot.
 const perchAt=(x,z)=>{let best=null,bd=1;for(const p of perches){const dx=x-p.cx,dz=z-p.cz,u=Math.abs(dx*p.ux+dz*p.uz)/p.L,v=(dz*p.ux-dx*p.uz)/p.r,d=Math.sqrt(Math.pow(u,1.4)+v*v);if(d<bd){bd=d;best=p;}}
  if(!best)return null;const t=Math.min(1,Math.max(0,(1-bd)/.4));
  // (Round 2 kept the top flat and the boulders on the flanks, never above the top: at full size
  // there they stood round the rim and read as a crater.)
  let rock=landform.rocky?.6*landform.rocky(x,z)*Math.min(1,Math.max(0,(1-bd)/.2)):0;
  // The lane in front of each pad falls away from it at 0.25 (about 14 degrees), steeper than
  // any line from the eye to the fairway, so neither the outcrop's top nor the tee cut in front
  // blocks the drive (a test caught the flat top doing so, round 3; at 0.15 a middle tee 20 m
  // ahead still stood half a metre into the back tee's line).
  let cap=Infinity;
  for(const q of best.pads){const ax=x-q.x,az=z-q.z,c=Math.min(1,Math.max(0,(Math.hypot(ax,az)-9)/5)),al=ax*best.ux+az*best.uz,ac=Math.abs(az*best.ux-ax*best.uz);
   rock*=c*c*(3-2*c);if(al>-4&&ac<8+Math.max(al,0)*.15){rock=Math.min(rock,0);cap=Math.min(cap,best.height+.3-Math.max(al,0)*.25);}}
  return {d:bd,p:best,lift:Math.max(0,Math.min(cap,best.height*t*t*(3-2*t)+rock))};};
 // How far an outcrop opens the wild ground's gates: all of it, to just past its foot (round 2
 // opened its flanks only, from d .5), as ground.js reads it from the same numbers (`perchUniforms`).
 const perchOpen=(x,z)=>{let o=0;for(const p of perches){const dx=x-p.cx,dz=z-p.cz,u=Math.abs(dx*p.ux+dz*p.uz)/p.L,v=(dz*p.ux-dx*p.uz)/p.r,d=Math.sqrt(Math.pow(u,1.4)+v*v),b=Math.min(1,Math.max(0,(d-.9)/.15));o=Math.max(o,1-b*b*(3-2*b));}return o;};
 for(const p of perches)p.h.rockTee=true;
 if(perches.length){
  // Rock on it wherever it stands steep, and no trees on it at all.
  const raw0=landform.raw,keep0=landform.treeKeep;
  landform={...landform,
   raw:(x,z,y,slope=0)=>{const r=raw0(x,z,y,slope),q=perchAt(x,z);if(q)r[0]=Math.max(r[0],Math.min(1,(slope-.15)/.2));return r;},
   treeKeep:(x,z)=>{const q=perchAt(x,z);return q?0:keep0(x,z);}};
 }
 // A cliff coast's face is rock wherever it stands steep (the sandstone the owner's photographs show).
 if(bio.cliffCoast){const raw3=landform.raw;landform={...landform,needsSlope:true,raw:(x,z,y,slope=0)=>{const r=raw3(x,z,y,slope);if(Math.abs(x-coastAt(z))<60)r[0]=Math.max(r[0],Math.min(1,(slope-.35)/.3));return r;}};}
 // (Round 6's first try raised rock in every space the holes left, `wrapMountains`, and boxed the
 // whole course in; the owner: "The holes need to move to wrap around the mountains that are
 // generated". The holes are routed round the ranges instead: routing.js.)
 // (Round 4 of Desert Mountain laid ridges along both sides of every hole here, `hugRidges`; the
 // owner turned them down the same day as "placed after the holes". The landform's ranges, with the
 // holes in the draws between them, replaced them: landforms.js `knobs`, `range`.)
 function land(x,z,n){
  if(coastal){n??=nearest(x,z);const reach=28+(1-relief)*50+12*Math.sin(x/66+Math.sin(z/91)),coast=Math.max(smooth((n.d-reach)/30),(1-smooth((n.other-n.d)/(18+relief*20)))*smooth(n.d/6));const depth=s.waterMin+(s.waterMax-s.waterMin)*(.5+.25*Math.sin(x/130+phase)+.25*Math.cos(z/170));return foreshore(base(x,z)*(1-coast)-depth*coast,coast);}
  const near=smooth((clearOf(x,z)-CLEAR_EDGE)/(landform.reach??bio.hills.reach));
  const fade=roadLines?Math.min(near,roadValley(x,z)):near,floor=floorAt(x,z);
  let y=floor+(countryAt(x,z)-floor)*fade;
  // NO BENCH ROUND THE HOLES (`wideFade`, Desert Mountain; the owner: "I can still see 'platforms'
  // outlining every hole"). A hole lies on the softened long shape; the country rejoined it over
  // `reach`, so wherever the two differ a few metres the join stood as a bench tracing the hole.
  // With `longLift` the ranges keep `reach`, and the rest of the country rejoins over
  // `wideFade` metres instead. Only a recipe that asks; every other landscape is unchanged.
  if(landform.longLift&&bio.wideFade&&!landform.sinks){
   const wide=smooth((clearOf(x,z)-CLEAR_EDGE)/bio.wideFade),fw=roadLines?Math.min(wide,roadValley(x,z)):wide;
   const ranges=liftScale*(landform.lift(x,z)-landform.longLift(x,z)),rest=countryAt(x,z)-ranges;
   // (A shorter approach for the ranges alone, `rangeFade` [5, 11], was tried in round 6 and taken
   // out: with it the finished ground stood a range across a fairway -- seed FAIRWAY's hole 2, 45 m up
   // across 50 m -- where `land` itself read flat. Not understood; written down in RESEARCH.)
   y=floor+(rest-floor)*fw+ranges*fade;
  }
  if(landform.sinks)y+=liftScale*landform.lift(x,z,fade);
  // A recipe that sets ground to a height, not by a height (the Lowcountry's
  // marsh at the tide line and its creeks below it), does so last, faded in
  // from play as the lift is.
  if(landform.level)y=landform.level(x,z,y,fade);
  if(perches.length){const q=perchAt(x,z);if(q)y+=q.lift;}
  // A coast that seeks play never ramps down within 5 m of a corridor's
  // envelope, and is sea from 25 m
  // (`nearest().d`, the real corridor, doglegs and all): the sea comes in
  // close and the holes' own ground stays a cliff above it.
  // SANDSTONE CLIFFS (`cliffCoast`, the California Coast; the owner, 8 November 2026: "actual craggy
  // cliffs on the ocean side that are part of the landscape ... like a sandstone cliff, with vertical
  // lines that trail into the water"; Torrey Pines' and Pebble Beach's in the owner's photographs).
  // The land drops to the sea over `width` metres at the coast line, its foot wandering in coves
  // and headlands (`cove` metres over 140 m) and fluted every few metres (`flute` metres of
  // vertical grooves); below it, rock ribs run out from the foot (`ribs` metres high, dying away
  // over 40 m), some breaking the surface. No inlets between holes: the sea is kept east of the line
  // alone (Monterey's ramp let it in wherever the ground stood 25 m from a hole -- the "pits").
  // PLACED, every number.
  // Round 2 (the owner: "very straight lines on the actual cliff part. And really sharp angles"):
  // the coast line is the holes' line in straight 10 m pieces, so it is averaged over 160 m first;
  // coves at two scales; the grooves soft (plain noise, not ridged).
  if(bio.edgeCoast&&bio.cliffCoast){const o=bio.cliffCoast;let base0=0;for(let k=-4;k<=4;k++)base0+=coastAt(z+k*20);base0/=9;
   const line=base0+o.cove*(fbm(z/150,3.3,cliffSalt,3)-.5)*2+o.cove*.4*(fbm(z/55,5.9,cliffSalt+3,2)-.5)*2+o.flute*(fbm(z/13,7.1,cliffSalt+1,2)-.5)*2,u=(x-line)/o.width;
   if(u>-1){const c=Math.min(1,Math.max(0,(u+1)/2)),k=c*c*(3-2*c),out=Math.max(0,x-line-o.width);
    const rib=o.ribs*Math.pow(fbm(z/22,x/50,cliffSalt+2,2),2.5)*Math.exp(-out/40);
    // Deep water at a cliff's foot (the sea's own depth setting is a beach's, a few metres, and
    // read as a pale sand flat against the rock).
    y=y*(1-k)+(-Math.max(9,s.waterMax*2)+rib)*k;}
   return y;}
  if(bio.edgeCoast){n??=nearest(x,z);const coast=smooth((x-(coastAt(z)+Math.sin(z/150)*30*(bio.coastSeek?.3:1)))/90)*(bio.coastSeek?smooth((n.d-5)/20):1);y=foreshore(y*(1-coast)-s.waterMax*coast,coast);}
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
 const isSea=bio.sea?((x,z)=>land(x,z)<0):(()=>false);
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
 if(pondBlend>0)y=y*(1-pondBlend)+targetSum/weightSum*pondBlend;
 // Greens shaped one after another (PROJECT_HANDOFF *greens shaped in turn drag
 // each other*: Architect blended them together, since its routing put greens
 // close; the generator keeps its order exactly, and went on doing so when
 // Architect was removed, 2 November 2026).
 for(const {h,minX,maxX,minZ,maxZ} of modifiers){if(x<minX||x>maxX||z<minZ||z>maxZ)continue;const p=h.toLocal({x,z});if(h.greens){y=rangeGreensShape(h,p,y,base,s.fringe);continue;}const d=greenDistance(h,p.x,p.z);
 // The shoulder is never wider than 100 m, so past it the blend below is
 // exactly nothing (smooth clamps at 1) whatever the green's height. Asking for
 // the green's contour first, as this did, was a third of what shaping an
 // eighteen cost -- for points a hundred metres and more from any green.
 if(d-s.fringe-1>=100)continue;
 // Raised and sunken greens (greenPedestal in course-plan.js): the green and its
 // collar lifted or dropped as one, with banks beyond the collar. Inside the
 // blend, so the shoulder still carries the terrain back to the land around it.
 const greenY=floorAt(h.worldGreen.x,h.worldGreen.z)+greenContour(h,p.x,p.z)+greenPedestal(h,d),shoulder=40+Math.min(60,Math.abs(y-greenY)*4),blend=1-smooth((d-s.fringe-1)/shoulder);
 if(blend>0)y=y*(1-blend)+greenY*blend;}
 return y;}
 // A tee is a terrace cut into whatever the rest of the shaping already
 // decided, so its height is sampled from shapedNoTees rather than from the
 // raw landform: levelling to land() put a step wherever a tee sat inside a
 // green shoulder or a pond shelf. The ramp off the pad widens with the drop
 // it has to absorb, the way a green shoulder does. A fixed five-metre ramp
 // left a wall around every pad once the ground got steep.
 // Squared to the same aim the markers use, so the box and the markers on it
 // point the same way.
 for(const h of holes){
  // A PROVISIONAL FACING: siting has not run yet, so every tee is still where
  // the hole first put it. It is recomputed the moment a pad lands on its real
  // site -- squaring a tee to the shot from somewhere it no longer is was why
  // they still pointed the wrong way after the shape work.
  //
  // EVERY MAT ON A RANGE FACES STRAIGHT DOWN THE FIELD. They sit side by side
  // at the same distance, so squaring each to the middle of the fairway turns
  // the outer two by a few degrees and they stop being the same mat -- which
  // is the one thing a range may not do.
  for(const t of Object.values(h.tees)){
   if(h.range){t.ux=0;t.uz=1;continue;}
   const target=teeAim(h,t);
   const dx=target.x-t.x,dz=target.z-t.z,len=Math.hypot(dx,dz)||1;
   t.ux=dx/len;t.uz=dz/len;
  }
 }
 const teePads=[];
 for(const h of holes){
  const all=Object.values(h.tees);
  for(const t of all){
   const p=teePad(t);
   if(!p)continue;
   const q=h.toWorld({x:t.x,z:p.z});
   // A pad carries every marker standing on it -- itself, plus any marker that
   // has no pad of its own, which on a par three is the other two. They move
   // together or the markers end up off the ground they tee from.
   teePads.push({h,t,rz:p.rz,localZ:p.z,x:q.x,z:q.z,ux:p.ux,uz:p.uz,
    markers:[t,...all.filter(m=>m!==t&&teePad(m)===null)]});
  }
 }
 // Must cover the apron plus the WIDEST ramp, or the falloff is cut off part
 // way down and the cut is a crease. At the old 78 a full-lift pad wanted 98
 // and got 64, which is where the one 13.5 degree outlier came from.
 const PAD_REACH=115;
 // THE SURROUND COUNTS, NOT JUST THE GREEN. The guard used to stop at the
 // fringe plus four metres, which leaves the mown surround outside it -- so a
 // tee's shoulder could still fall across maintained turf beside a green. On a
 // gentle ramp that went unnoticed; on the short steep shoulder it reads as a
 // brown scar, because mown grass is tinted dry past about six degrees and a
 // tee bank is far steeper than that.
 const greenGuards=holes.map(h=>{
  const c=h.worldGreen??h.worldPin,keep=h.greenSize*h.greenAspect+s.fringe+s.semiRough+4;
  return {x:c.x,z:c.z,keep,fade:keep+16};
 });
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
 const TEE_STEP=.35,TEE_LIFT_CAP=3.5,TEE_TRIES=44,TEE_SLIDE=20;
 // A TEE IS SITED ON GROUND THAT SUITS IT, RATHER THAN CUT INTO GROUND THAT
 // DOES NOT.
 //
 // Every tee used to go straight down the middle at a fixed fraction of the
 // hole's length, and the land was then forced to become a tee there. Every
 // complaint about how they looked came from that one decision: the wide
 // excavated footprint, the ramps reaching into greens, the sense of a pad
 // dropped onto a hillside rather than built into it.
 //
 // Turned round, each pad now tries a few dozen nearby sites and takes the one
 // the ground already suits. Flat ground scores best, so most tees barely need
 // moving earth at all -- which is the actual cure, since the footprint only
 // ever existed to absorb a drop we were creating ourselves.
 //
 // It also gives the variety for free. Nothing says "put the back tee on a
 // rise" or "tuck the forward tee beside the fairway"; those simply win on
 // ground where they are the flattest, clearest option.
 //
 // WHY THE SITES ARE BOUNDED. Tees are chosen long before any terrain exists,
 // and the rest of the hole is built from them -- where the fairway starts,
 // where ponds and bunkers sit. Re-siting freely here would pull the hole out
 // from under its own features. So a pad may slide across the hole as far as
 // the corridor allows and up to TEE_SLIDE along it, which is enough for every
 // shape the owner asked for and little enough that nothing downstream moves.
 // Yardage is recomputed from where the tee actually ends up.
 const blindRng=random(s.seed+':blind-tees'),blindShare=(s.blindTees??0)/100;
 const siteRng=random(s.seed+':tee-sites');
 for(const h of holes){
  const keepBlind=blindRng()<blindShare;
  const pads=teePads.filter(p=>p.h===h);
  if(!pads.length)continue;
  // Forward-most first, so a tee behind it knows what height it has to beat.
  const order=[...pads].sort((a,b)=>b.localZ-a.localZ);
  let aheadZ=Infinity,aheadLevel=-Infinity;
  const placed=[];
  for(const pad of order){
   const rx=TEE_PAD.x*TEE_APRON_SCALE,rz=pad.rz*TEE_APRON_SCALE;
   // How the ground reads over the whole collar, not just at a point: a site
   // is only as good as its worst corner.
   const survey=(cx,cz)=>{
    const ys=[];
    for(let i=0;i<12;i++){
     const a=i*Math.PI/6;
     const q=pad.h.toWorld({x:cx+Math.cos(a)*rx*.9,z:cz+Math.sin(a)*rz*.9});
     ys.push(shapedNoTees(q.x,q.z));
    }
    const c=pad.h.toWorld({x:cx,z:cz});
    ys.push(shapedNoTees(c.x,c.z));
    ys.sort((m,n)=>m-n);
    return {lo:ys[0],hi:ys[ys.length-1],mid:ys[ys.length>>1],spread:ys[ys.length-1]-ys[0]};
   };
   // The room this pad has. Never past the start of mown turf, never past the
   // pad ahead of it, and never so far across that it leaves the hole.
   const home={x:pad.t.x,z:pad.localZ};
   const backLimit=home.z-TEE_SLIDE;
   const homeW=h.rockTee?h.toWorld(home):null,homeQ=homeW?perchAt(homeW.x,homeW.z):null,onPerch=!!homeQ&&homeQ.d<.55;
   const frontLimit=Math.min(home.z+TEE_SLIDE,(h.mowStart??h.fairwayStart)-pad.rz-10,aheadZ-pad.rz-14);
 // GROUND AS IT WILL BE ONCE THE TEES ALREADY BUILT ON THIS HOLE ARE THERE.
   //
   // The blindness check read the shaped land WITHOUT any tee pads in it, so
   // it could not see the one thing the owner reported being unable to see
   // over -- the tee box in front of you. Measured from the real tee over the
   // real ground, 13% of shots were blocked by more than a metre where this
   // check believed 3%, and a fifth of those were blocked by another tee.
   //
   // Pads are sited forward-most first, so by the time a back tee is judged
   // the tees in front of it are already placed and their levels are known.
   const built=(x,z)=>{
    const q=pad.h.toLocal({x,z});
    for(const p of placed){
     const f=teeFrame(q.x-p.x,q.z-p.z,p.ux,p.uz);
     if(teeBox(f.across,f.along,TEE_APRON.x,p.rz*TEE_APRON_SCALE,TEE_ROUND*TEE_APRON_SCALE)<0)return p.y;
    }
    return shapedNoTees(x,z);
   };
   let best=null;
   for(let attempt=0;attempt<TEE_TRIES;attempt++){
    // The first attempt is where the hole put it, so a good original site is
    // never thrown away for a worse one.
    const cz=attempt===0?home.z:backLimit+siteRng()*(frontLimit-backLimit);
    if(cz>frontLimit)continue;
    const side=siteRng()<.5?-1:1,corridor=fairwayWidth(h,cz,0,side);
    const reach=corridor+s.semiRough+34;
    const cx=attempt===0?home.x:h.center(cz)+side*(corridor*.15+siteRng()*(reach-corridor*.15));
    // A tee on a rock outcrop stays on the flat cut for it, its home (`rockTees`). After the
    // draws, so a course without one takes the same numbers as before.
    if(onPerch&&attempt>0)continue;
    // Nothing a tee may not stand on. Sampled round the collar, because a pad
    // half on a green is as wrong as a pad wholly on one.
    // Round the collar's outline. A box has corners, and a corner on a green
    // is as wrong as a whole pad on one.
    const rim=i=>{const a=i*Math.PI/6,c=Math.cos(a),n=Math.sin(a);
     const k=Math.min(Math.abs(c)>1e-6?rx/Math.abs(c):1e9,Math.abs(n)>1e-6?rz/Math.abs(n):1e9);
     // c is across the line of play and n is along it, so the outline turns
     // with the pad instead of with the hole.
     return {x:cx+c*k*pad.uz+n*k*pad.ux,z:cz-c*k*pad.ux+n*k*pad.uz};};
    let blocked=false;
    for(let i=0;i<12&&!blocked;i++){
     const {x:lx,z:lz}=rim(i);
     const surf=localSurface(h,lx,lz);
     if(surf==='green'||surf==='fringe'||surf==='water'||surf==='sand')blocked=true;
     // And clear of the green's mown surround, not merely of the green.
     if(!blocked&&greenDistance(h,lx,lz)<s.fringe+s.semiRough+4)blocked=true;
     const q=h.toWorld({x:lx,z:lz});
     if(!blocked&&(isSea(q.x,q.z)||nearby(q.x,q.z)!==h))blocked=true;
    }
    if(blocked)continue;
    // NO TWO COLLARS SHOULD TOUCH. Siting can move a tee sideways, and nothing
    // said it had to keep out of its neighbour's way -- measured, the mown
    // collars overlapped on 12% of tee pairs, which is the merged blob of
    // green the owner reported. The pads themselves almost never clashed, so
    // checking those alone would have missed it.
    //
    // A PENALTY RATHER THAN A BAN, because a ban leaves nowhere to go on a
    // tight hole and the tee falls back to where it started -- which is often
    // the overlapping spot it was trying to escape. Scored, the worst site
    // still beats no site.
    let clash=0;
    for(let i=0;i<12;i++){
     const {x:lx,z:lz}=rim(i);
     for(const p of placed){
      const f=teeFrame(lx-p.x,lz-p.z,p.ux,p.uz);
      const d=teeBox(f.across,f.along,TEE_APRON.x,p.rz*TEE_APRON_SCALE,TEE_ROUND*TEE_APRON_SCALE);
      if(d<0)clash=Math.max(clash,-d);
     }
    }
    const g=survey(cx,cz);
    // Sat at the middle of what the ground is doing, so the cut and the fill
    // are the same size and neither is large.
    const level=g.mid;
    const c=h.toWorld({x:cx,z:cz});
    const blind=Math.max(...pad.markers.map(m=>
     sightline(h,{x:m.x+(cx-home.x),z:m.z+(cz-home.z)},level+TEE_EYE,built).over));
    // Lower is better. Flatness dominates: it is both how little digging the
    // site needs and how much it already looks like a tee.
    const score=g.spread*3
     +Math.max(0,aheadLevel+TEE_STEP-level)*2.5
     +blind*TEE_SEE
     +clash*4
     +Math.abs(cx-h.center(cz))*.02
     // STAGGERED, BECAUSE A TEE DIRECTLY IN FRONT IS A TEE YOU LOOK OVER.
     // A quarter of consecutive pairs used to sit within 1.5 m of each other
     // sideways, which is in line. A preference and not a rule: on a tight
     // hole there may be nowhere to go, and a tee in line beats no tee.
     //
     // AGAINST EVERY TEE ALREADY PLACED, not only the one immediately in front.
     // Blue can sit in line with red while white is in line with neither, and
     // the pair that matters is whichever two share a sightline -- measured,
     // 110 of 945 pairs had collars overlapping sideways while this looked only
     // at consecutive ones. The worst offender decides the penalty, so moving
     // clear of one tee cannot be paid for by sliding into another.
     +placed.reduce((worst,p)=>Math.max(worst,Math.max(0,TEE_STAGGER-Math.abs(cx-p.x))),0)*TEE_STAGGER_W;
    if(!best||score<best.score)best={score,cx,cz,level,g};
   }
   if(!best){
    // No candidate cleared the hard rules, so leave the tee where the hole put
    // it and settle it to the ground there.
    const g=survey(home.x,home.z);
    best={cx:home.x,cz:home.z,level:g.mid,g};
   }
   // Move the pad and everything standing on it.
   const dx=best.cx-home.x,dz=best.cz-home.z;
   for(const m of pad.markers){m.x+=dx;m.z+=dz;}
   if(pad.t.pad)pad.t.pad.z+=dz;
   pad.localZ+=dz;
   const w=h.toWorld({x:pad.t.x,z:pad.localZ});
   pad.x=w.x;pad.z=w.z;
   // Squared to the shot from where it ACTUALLY ended up. A tee sited 37 m off
   // the centre line has to turn most of a right angle to face the fairway,
   // and computing that before it moved gave it eight degrees.
   if(!h.range)for(const m of pad.markers){
    const target=teeAim(h,m),ax=target.x-m.x,az=target.z-m.z,alen=Math.hypot(ax,az)||1;
    m.ux=ax/alen;m.uz=az/alen;
   }
   pad.ux=pad.t.ux;pad.uz=pad.t.uz;
   // The order still has to hold, but now it costs centimetres rather than
   // metres, because a site that breaks it was penalised before it was picked.
   //
   // AND THE STEP IS SCALED BY WHAT THE GROUND IS DOING, as it was before this
   // was rewritten. A fixed step manufactures a staircase on flat land -- it
   // put 0.70 m of rise on a dead-flat course and tilted the driving range,
   // whose three mats sit side by side and must stay identical. Where the site
   // is level there is no inversion to correct, so there is nothing to add.
   const step=Math.min(TEE_STEP,best.g.spread*.5);
   let level=Math.max(best.level,aheadLevel>-Infinity?aheadLevel+step:-Infinity);
   // And only now, if the best site available is still blind, is the tee
   // raised to see over what is in front of it.
   let lift=0;
   for(const m of pad.markers)lift=Math.max(lift,sightline(h,m,level+TEE_EYE,built).lift);
   lift=keepBlind?0:Math.min(lift,TEE_LIFT_CAP);
   pad.y=level+lift;
   // What the site was like before anything was done to it, and how far it
   // had to move to be found. Reported by the measurement harness.
   pad.spread=best.g.spread;pad.slid=Math.hypot(dx,dz);pad.lift=lift;
   placed.push({x:pad.t.x,z:pad.localZ,rz:pad.rz,y:pad.y,ux:pad.ux,uz:pad.uz});
   aheadZ=pad.localZ;aheadLevel=pad.y;
  }
  // ONE PIECE OF EARTHWORK, NOT ONE PER TEE.
  //
  // Three pads near each other, each settled to its own level, build three
  // separate humps with saddles between them -- which is what a tee complex
  // must not look like. Where their shoulders would run into each other they
  // share a level instead, so the shaping blends them into a single platform.
  // The highest wins, because dropping a tee to meet a lower neighbour would
  // undo the sightline it was raised for.
  const near=(a,b)=>{
   const dx=(a.t.x-b.t.x)/(TEE_PAD.x*TEE_APRON_SCALE*1.7);
   const dz=(a.localZ-b.localZ)/((a.rz+b.rz)*TEE_APRON_SCALE*.85);
   return dx*dx+dz*dz<1;
  };
  //
  // ONLY WHERE THE STEP BETWEEN THEM WAS NOT DELIBERATE. A back tee raised to
  // see over the tee in front of it must not then drag that tee up to meet it
  // -- that is precisely the view it was raised for. Merging is for pads that
  // already sit at much the same height and would otherwise read as two humps.
  for(let again=true;again;){
   again=false;
   for(const a of pads)for(const b of pads)
    if(a!==b&&near(a,b)&&b.y>a.y+1e-6&&b.y-a.y<TEE_MERGE){a.y=b.y;again=true;}
  }
  // Yardage follows the tee, or the card lies about the hole.
  for(const t of Object.values(h.tees)){
   let d=0;
   for(let z=t.z;z<h.length;z+=1){const next=Math.min(h.length,z+1);d+=Math.hypot(h.center(next)-h.center(z),next-z);}
   t.yards=d/.9144;
  }
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
   const q=pad.h.toLocal({x,z});
   const f=teeFrame(q.x-pad.t.x,q.z-pad.localZ,pad.ux,pad.uz);
   const out=Math.max(0,teeBox(f.across,f.along,TEE_APRON.x,pad.rz*TEE_APRON_SCALE,TEE_ROUND*TEE_APRON_SCALE));
   // A ROUNDED SHOULDER, THE WAY A BUNKER HAS ONE -- NOT A LONG RAMP.
   //
   // The reach used to grow with the drop, 14 m plus seven times it, so a tee
   // needing a lift disturbed ground 40 m past its collar. That was only ever
   // there to keep the slope gentle, and the owner's call is that the slope
   // does not matter as long as the edge is round: a tee sitting above its
   // surroundings on a short curved bank reads as built, where the same tee at
   // the centre of a 50 m saucer reads as excavated.
   //
   // So the shoulder is close to a fixed width and the steepness is whatever
   // the drop makes it. `smooth` flattens at both ends, so it meets the collar
   // and the natural ground without a crease at either. It barely matters in
   // practice any more, because siting picks ground that hardly needs a drop.
   // AND IT FALLS AWAY FASTER IN FRONT THAN IT DOES ANYWHERE ELSE.
   //
   // `f.along` is positive down the line of play, so this is the share of the
   // way out that is FORWARD: 1 straight ahead, 0 to the side, 0 behind. The
   // reach is cut by that share, which steepens the ground between the pad and
   // the fairway without touching the bank you see when you look at the tee.
   const ahead=f.along>0?f.along/Math.max(1e-6,Math.hypot(f.across,f.along)):0;
   const level=pad.y,ramp=(9+Math.min(24,Math.abs(y-level)*4))*(1-TEE_FRONT_FALL*ahead);
   const b=ramp>1e-6?1-smooth(out/ramp):0;
   if(b<=0)continue;
   // Same weighting the pond shelves use: the pad you are standing on decides
   // the height while neighbouring pads stay continuous with it, instead of
   // whichever one the loop happened to reach last.
   const weight=b/(1.001-b);
   blend=Math.max(blend,b);weightSum+=weight;targetSum+=weight*level;
  }
  if(blend<=0)return y;
  // A GREEN ALWAYS WINS.
  // Whether this sample is on a pad or its collar rather than out on a
  // shoulder. The guard below must not unlevel the tee itself.
  const onPad=blend>=1-1e-9;
  //
  // Greens are shaped first and tees last, so a tee's ramp simply overwrote
  // whatever the green had decided -- measured, 78 tees had earthworks reaching
  // into a green's ground and the worst pushed 15 m inside one, which is the
  // terrain seen clipping through a green and its fringe. Tee shaping now fades
  // out before it arrives. Only ground already near a tee pays for this test,
  // which is why it sits behind the blend check.
  for(const g of greenGuards){
   const d=Math.hypot(x-g.x,z-g.z);
   if(d>=g.fade)continue;
   blend*=smooth((d-g.keep)/(g.fade-g.keep));
   if(blend<=0&&!onPad)return y;
  }
  // A TEE BESIDE A GREEN IS STILL A TEE. The guard exists to stop a tee's
  // SHOULDER spilling across maintained ground, and applied to the whole
  // blend it also stopped levelling the pad -- so the tee came out following
  // the natural slope, which on one hole left a marker sitting below the one
  // in front of it. The shoulder still fades; the pad does not.
  if(onPad)blend=1;
  return y*(1-blend)+targetSum/weightSum*blend;
 }
 yield phaseAt(2);
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
  // AND THE BASIN HAS TO REACH THE WATER IT WAS GIVEN.
  //
  // `fitPondBasin` pulls the level down to the lowest ground around the pond's
  // outer transition, deliberately, so a lake is never perched over its own
  // downhill bank. On sloping ground that can set a water plane deeper than
  // this pond digs, and then its middle stands proud of its own surface --
  // measured on desert S4, a 24 m pond on 5.5 m of fall digging 1.6 m left
  // four metres of dry hump that still reported as water.
  //
  // The spread guard inside the fit cannot catch it: it weighs the fall
  // against a fixed 9 m without knowing how deep this pond is. Asked here
  // rather than in the fit because the fit is shared with lakes and ordinary
  // ponds, which reach their water by other means and were not asking.
  //
  // A channel that would have filled this one fades out instead, which is
  // already one of the two endings a sink is allowed.
  if(shapedLand(cx,cz)-p.depth>=p.level-.2)return null;
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
 // EVERY GRID POINT ASKED EVERY BASIN on the course whether it was near, by
 // turning itself into that basin's hole frame first -- the hole's rotation,
 // for every pond and bunker, for every one of the ~1.6 M points an eighteen
 // takes. `basinBox` is the same square as the test below, turned into the
 // world and boxed there, so a point outside it is outside the square and the
 // answer is exactly the one the full test would give; only the work goes.
 // The boxes are rebuilt whenever the list is not the one they were made for
 // (it is replaced when drowned bunkers are dropped, and grows by sink ponds),
 // and are flat numbers because this runs for every point on the course.
 let boxedFor=null,boxedCount=-1,boxes=null;
 const basinBoxes=()=>{
  if(boxedFor===basins&&boxedCount===basins.length)return boxes;
  boxes=new Float64Array(basins.length*4);
  basins.forEach(({h,b,reach},i)=>{const w=worldBoxOf(h,b.x-reach,b.x+reach,b.z-reach,b.z+reach);boxes.set([w.minX,w.maxX,w.minZ,w.maxZ],i*4);});
  boxedFor=basins;boxedCount=basins.length;return boxes;
 };
 function analyticHeight(x,z){let y=shapedLand(x,z);const w=basinBoxes();for(let i=0;i<basins.length;i++){if(x<w[i*4]||x>w[i*4+1]||z<w[i*4+2]||z>w[i*4+3])continue;const {h,b,pond,reach}=basins[i];const q=h.toLocal({x,z});if(Math.abs(q.x-b.x)>reach||Math.abs(q.z-b.z)>reach)continue;const d=hazardMetric(q.x,q.z,b);
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
 // A TEE KEEPS ITS LEVEL UNDER A POND'S SHELF. On rolling ground a pond's shelf
 // can run 60 m to meet the land, past a tee on the way, and the shelf is laid
 // after the tee was: a pad with no level to it, on six tees of 5,265 (the bench's
 // `teeCollarTilted`). The pad and its collar are set back to their level here,
 // over a 3 m edge.
 for(const pad of teePads){
  if(Math.abs(x-pad.x)>14||Math.abs(z-pad.z)>14)continue;
  const q=pad.h.toLocal({x,z}),f=teeFrame(q.x-pad.t.x,q.z-pad.localZ,pad.ux,pad.uz);
  const out=Math.max(0,teeBox(f.across,f.along,TEE_APRON.x,pad.rz*TEE_APRON_SCALE,TEE_ROUND*TEE_APRON_SCALE));
  if(out<3){const b=1-smooth(out/3);y=y*(1-b)+pad.y*b;}
 }
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
 const nearShore=bio.sea
  ?((x,z,a,b,c,d)=>a===undefined?false:Math.min(a,b,c,d)<waterLevel&&Math.max(a,b,c,d)>=waterLevel)
  :(()=>false);
 yield phaseAt(3);
 // WHICH CELLS ARE REFINED asked every hole about every cell -- green, tees,
 // ponds, bunkers -- in that hole's own frame: the single most expensive thing
 // in building an eighteen (1.4 s of its own, plus the frame changes, of 7.5 s
 // measured). Each hole's box holds every one of those questions' reach, in
 // the hole's frame, turned into the world; a cell outside it gets `false`
 // from every question, which is what the full test would have said.
 const refineBoxes=holes.map(h=>{
  const g=h.green??h.pin;let x0=g.x-38,x1=g.x+38,z0=g.z-38,z1=g.z+38;
  const grow=(a,b,c,d)=>{x0=Math.min(x0,a);x1=Math.max(x1,b);z0=Math.min(z0,c);z1=Math.max(z1,d);};
  for(const t of Object.values(h.tees)){const q=teePad(t);if(q)grow(t.x-TEE_PAD.x-6,t.x+TEE_PAD.x+6,q.z-q.rz-6,q.z+q.rz+6);}
  for(const b of h.ponds){
   // hazardMetric < 1.35: the distance it divides is at least either axis on
   // its own, and its divisor is at most 1 + |wave2| + |wave3| (1 with banks),
   // so either axis stays inside 1.35 times that of the widest bank.
   const f=1.35*(b.banks?1:1+Math.abs(b.wave2??0)+Math.abs(b.wave3??.07));
   const banks=b.banks??[{x:b.x,rx:b.rx}];
   for(const k of banks)grow(k.x-k.rx*f,k.x+k.rx*f,b.z-b.rz*f,b.z+b.rz*f);
  }
  for(const b of h.bunkers)grow(b.x-b.rx*1.4-4,b.x+b.rx*1.4+4,b.z-b.rz*1.4-4,b.z+b.rz*1.4+4);
  return worldBoxOf(h,x0,x1,z0,z1);
 });
 // Which large lake owns a point, if any. Defined before the grid (nothing in
 // it depends on the grid) so a generation worker holds it too: the ground's
 // ownership atlas asks it for every texel (owner-atlas.js).
 const largeLakes=holes.flatMap(h=>h.ponds.filter(p=>p.large).map(p=>({h,p})));
 const lakeOwner=(x,z,margin=0)=>largeLakes.find(({h,p})=>{const q=h.toLocal({x,z});return hazardMetric(q.x,q.z,p)<1+margin/Math.min(p.rx,p.rz);})?.h;
 // Which cells are cut to half a metre. Named, because a worker that computes
 // heights for the grid (B2) has to ask exactly this.
 const refineCell=(x,z,a,b,c,d)=>(streams.at(x,z)?.edge<3)||nearShore(x,z,a,b,c,d)||holes.some((h,i)=>{const w=refineBoxes[i];if(x<w.minX||x>w.maxX||z<w.minZ||z>w.maxZ)return false;const p=h.toLocal({x,z});return Math.hypot(p.x-(h.green??h.pin).x,p.z-(h.green??h.pin).z)<38||Object.values(h.tees).some(t=>{const q=teePad(t);return q&&Math.abs(p.x-t.x)<TEE_PAD.x+6&&Math.abs(p.z-q.z)<q.rz+6;})||h.ponds.some(b=>{const d=hazardMetric(p.x,p.z,b);return d<1.35;})||h.bunkers.some(b=>Math.abs(p.x-b.x)<b.rx*1.4+4&&Math.abs(p.z-b.z)<b.rz*1.4+4);});
 // A worker stops here: it needed the land and the question, not the grid.
 if(options.capture){yield {capture:{sample:analyticHeight,refine:refineCell,nearest,lakeOwner,streamAt:(x,z)=>streams.at(x,z)}};return null;}
 const groundGrid=yield* stepGrid(options.gridPool
  ?makeGroundGridPooled(analyticHeight,halfX+150,halfZ+150,3,refineCell,options.gridPool)
  :makeGroundGridSteps(analyticHeight,halfX+150,halfZ+150,3,refineCell));
 const height=(x,z)=>groundHeight(groundGrid,x,z,analyticHeight);
 // Lakeshore Dunes' wind-torn sand (blowouts.js), baked on the ground atlas's
 // own grid so the shader paints exactly what `surface` plays. Null for every
 // biome without blowouts, which therefore builds nothing and moves nothing.
 const blowouts=bio.blowouts>0?blowoutField(s.seed,groundGrid.halfX,groundGrid.halfZ,bio.blowouts):null;
 // The recipe's ground types (rock, scree, waste sand...), baked on the same
 // grid for the same reason (landforms.js). Null where the biome has none.
 const wild=wildField(landform,groundGrid.halfX,groundGrid.halfZ,height);
 // THE SURFACE FIELD (surface-field.js): a hole's bunkers past the table's
 // slots, baked on the same grid. Architect's hand made them; since it went
 // (2 November 2026) no generated hole has more than twelve, so this is null
 // until one does.
 const sandField=surfaceField(holes,groundGrid.halfX,groundGrid.halfZ);
 // Fallen needles and leaves (biomes.js `fallen`) are planted with the trees,
 // so their field is baked after planting below; until then nothing is litter.
 let fallenField=null;
 // The sited pads, so a measurement can report what the generator decided
 // rather than trying to infer it back out of the terrain.
 const teeSites=teePads.map(p=>({hole:p.h.hole,x:p.x,z:p.z,rz:p.rz,level:p.y,
  spread:p.spread??0,slid:p.slid??0,lift:p.lift??0}));
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
 // The course's cart paths (paths.js), set once the holes are built and before
 // anything is planted; none on the range.
 let pathIdx=null,paths=[],bridges=[],pathConnect=null,pathBlock=null,pathShapeOf=null;
 // The roads and the lot (roads.js), known once the clubhouse is sited.
 let roadIdx=null,roadLot=null;
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
  if(bio.sea&&y<waterLevel)return 'water';
  const found=localSurface(n.h,n.p.x,n.p.z);
  // The surface field's sand: where a slot bunker would be sand -- over the
  // rough, semi-rough and fairway, before a path -- read from the bytes the
  // shader paints (ground.js, after the hazard slots).
  if(sandField&&(found==='rough'||found==='semi'||found==='fairway')&&isFieldSand(sandField,x,z))return 'sand';
  // A CART PATH (architect-courses, phase 2): over rough, semi-rough, fairway
  // or any ground type, never a green, its fringe, a tee, sand or water.
  // A ROAD OR THE LOT (roads.js): only ever on unplayed ground, and over a
  // cart path where the two cross.
  if(roadIdx&&(found==='rough'||isNatural(found))&&onRoad(roadIdx,roadLot,x,z))return 'road';
  if(pathIdx&&(found==='rough'||found==='semi'||found==='fairway'||isNatural(found))&&pathIdx.onPath(x,z))return 'path';
  // The beach, on the two biomes that have a coast. `height` rather than `land`
  // because that is the field the ground mesh is actually built from, and the
  // shader keys its own copy off exactly the same number.
  //
  // ROUGH ONLY, matching ground.js. Maintained turf of any kind keeps its
  // surface whatever its elevation -- letting the beach take the corridor turned
  // a fifth of every island hole into sand, and a green shaped down near the sea
  // would have become a bunker.
  if(bio.sea&&found==='rough'&&y<waterLevel+BEACH_RISE)return 'sand';
  // A blowout: rough only, clear of the hole's ponds and lakes and of a creek
  // within its own valley, then the field -- the questions ground.js asks.
  if(blowouts&&found==='rough'&&!(st&&st.edge<Math.min(BLOWOUT_WATER,st.bank))
   &&!n.h.ponds.some(p=>ovalDistance(n.p.x,n.p.z,p)<BLOWOUT_WATER)&&isBlowout(blowouts,x,z,n.d))return 'sand';
  // THE OVERHAUL'S GROUND TYPES: the recipe's channels, then fallen needles
  // or leaves -- rough only, clear of water by WILD_WATER, the questions
  // ground.js asks in the same order.
  if(found==='rough'&&(wild||fallenField)&&!(st&&st.edge<Math.min(WILD_WATER,st.bank))
   &&!n.h.ponds.some(p=>ovalDistance(n.p.x,n.p.z,p)<WILD_WATER)){
   const g=wildGround(wild,landform,x,z,n.d,perches.length?perchOpen(x,z):0);
   if(g)return g;
   if(fallenField&&fallenAt(fallenField,x,z))return bio.fallen.kind;
  }
  return found==='fairway'&&besideWater(x,z,n,st)?'semi':found;
 }
 yield phaseAt(4);
 // NO FACILITIES FOR NOW (the owner, 8 November 2026: "Just get rid of the road. Clubhouse area. Parking
 // lot. And cart paths from generated courses ... We can maybe add them back later"): the cart paths,
 // the clubhouse and with it the public road, the lot, the drive and the cart barn are made only when a
 // caller asks (`facilities`, not a player setting: the tests of those parts turn it on). A built
 // course keeps its own (built-world.js).
 const facilities=!s.range&&!!s.facilities;
 // CART PATHS FIRST (architect-courses, phase 2): the houses and the trees
 // that follow ask `surface`, which now knows where the paths run.
 const setDecks=bs=>{for(const b of bs){const ca=Math.sin(b.angle),cb=Math.cos(b.angle);b.deck=Math.max(height(b.x+ca*b.span/2,b.z+cb*b.span/2),height(b.x-ca*b.span/2,b.z-cb*b.span/2),height(b.x,b.z))+.45;}};
 if(facilities){({paths,bridges,connect:pathConnect,block:pathBlock,shape:pathShapeOf}=routePaths({holes,s,surface,streams,height,ravines:[]}));pathIdx=pathIndex(paths);
  // A BRIDGE'S DECK (phase 5): its top 0.45 m over the higher of its two ends
  // and its middle, decided here once so the drawn deck and the solid one
  // (physics.js) are the same plank.
  setDecks(bridges);}
 // The tees are sited by now, so their corridors are final; built before the
 // houses because a house may not stand in what a tee sees either.
 const launch=launchCorridors(holes,height);
 // THE CLUBHOUSE (clubhouse.js; architect-courses, phase 2; every generated
 // course since Architect was removed, 2 November 2026): sited once the tee
 // shots are known, before the houses and the trees, which keep off it; the
 // path runs from its door to the first tee and back from the last green.
 // None on the range.
 const buildings=[];
 if(facilities){
  const fans0=teeFans(holes);
  // NOTHING BUILT ON A PATH (the owner, 31 October 2026: a path ran under
  // the Midwest farmhouse): the whole footprint clear of the paths, and its
  // own link routed round it (paths.js `pathTouches`, `block`).
  const club=siteClubhouse({holes,s,surface,nearest,height,blocked:(x,z,pad)=>blocksView(launch,x,z,height(x,z)+12,pad)||inTeeFan(fans0,x,z,pad),clear:b=>!pathTouches(paths,b,10)});
  // Its link to the network gets its bridges too (paths.js findBridges): the
  // ground is still unpathed here, so the surface says water where there is.
  if(club){buildings.push(club);if(paths.length){pathBlock(club);linkBuilding(paths,club,pathConnect,height);bridges=findBridges(paths,{surface,streams,width:paths[0].width});setDecks(bridges);pathIdx=pathIndex(paths);}}
 }
 // NO RIGHT ANGLES, NO DEAD ENDS (paths.js `shape`; the owner, 2 November
 // 2026): the whole network, the clubhouse's link included, rounded and its
 // dead ends looped; its bridges found again after.
 if(pathShapeOf&&paths.length){pathShapeOf(paths,buildings);bridges=findBridges(paths,{surface,streams,width:paths[0].width});setDecks(bridges);pathIdx=pathIndex(paths);}
 // THE ROADS (roads.js; the US landscapes goal, phase 4): the public road
 // along the clubhouse's side of the property, the lot beside the clubhouse
 // and the drive between them, never across play; before the story, the
 // houses and the trees, which keep off them.
 let roads=[],boundary=null;
 if(!s.range&&buildings[0]?.kind==='clubhouse'){({roads,lot:roadLot,boundary}=placeRoads({holes,s,surface,nearest,height,halfX,halfZ,club:buildings[0],paths,streams,pathTouches}));roadIdx=pathIndex(roads);}
 const nearRoad=(x,z,pad)=>!!roadIdx&&((roadIdx.at(x,z)?.d??Infinity)<pad+4.5||(roadLot&&inBuilding(roadLot,x,z,pad)));
 // The cart barn beside the lot (roads.js placeCartBarn), a building: the
 // trees, houses and story keep off it as off the clubhouse.
 {const barn=placeCartBarn({lot:roadLot,club:buildings[0]?.kind==='clubhouse'?buildings[0]:null,surface,nearest,height,paths,pathTouches});if(barn)buildings.push(barn);}
 // THE LAND'S STORY (story.js; architect-courses, phase 6; every generated
 // course since 2 November 2026): field walls, a farmstead, ruins and a
 // landmark -- placed before the houses and the trees, which keep off them.
 // Its buildings join `buildings` (solid, never out of bounds); its walls are
 // solid too (`wallBoxes`, physics.js).
 let walls=[],storyProps=[],clearings=[];
 if(!s.range){
  const fans1=teeFans(holes);
  const story=placeStory({holes,s,surface,nearest,height,halfX,halfZ,buildings,paths,onRoad:nearRoad,blocked:(x,z,pad)=>blocksView(launch,x,z,height(x,z)+12,pad)||inTeeFan(fans1,x,z,pad)||pathClearance(paths,x,z)<pad+3||nearRoad(x,z,pad+2)});
  buildings.push(...story.buildings);walls=story.walls;storyProps=story.props;clearings=story.clearings;
 }
 // A house keeps off the paths too (the range has none, and `pathClearance` of
 // no paths is Infinity).
 const homes=generateHomes(s,holes,height,surface,random,(x,z,top,pad)=>blocksView(launch,x,z,top,pad)||buildings.some(b=>inBuilding(b,x,z,(pad||0)+14))||walls.some(w=>segDist(w,x,z)<(pad||0)+8)||paths.length>0&&pathClearance(paths,x,z)<(pad||0)+4||nearRoad(x,z,(pad||0)+4));
 // THE STREETS (roads.js placeStreets; generator 84): the houses are known now,
 // so their streets are laid, joined to the road, before the trees keep off them.
 if(homes.length){const {streets,lanes}=placeStreets({homes,roads,lot:roadLot,holes,s,surface,height,halfX,halfZ,buildings,walls});roads.push(...streets,...lanes);roadIdx=pathIndex(roads);}
 // A ROAD OVER WATER IS A BRIDGE (the rule the cart paths keep): a creek thin
 // enough to slip between the public road's samples, or one the club's drive
 // routed across, gets its deck, as wide as the road. The streets are closed
 // to water and need none.
 for(const r of roads)if(r.kind==='boundary'||r.kind==='drive'){const decks=findBridges([r],{surface,streams,width:r.width});setDecks(decks);bridges.push(...decks);}
 // Built on already: a house or a building, with a margin.
 // A building keeps a clear forecourt: 15 m round it for trees (iteration 4: a
 // chalet stood hidden in its own wood).
 // Only the clubhouse keeps a lawn; a wall keeps a stride clear either side.
 const builtOn=(x,z,m=5)=>homes.some(home=>Math.hypot(home.x-x,home.z-z)<Math.max(home.width,home.depth)+m)||buildings.some(b=>inBuilding(b,x,z,m+(b.story?20:10))||(b.kind==='clubhouse'&&inForecourt(b,x,z)))||walls.some(w=>segDist(w,x,z)<m*.3+1.2)||clearings.some(c=>Math.hypot(c.x-x,c.z-z)<c.r+m)||nearRoad(x,z,m*.3);
 const trees=[];
 // The plant mix is the biome's own; `pick` only turns weights into a draw.
 const fans=teeFans(holes);
 const guards=greenApproaches(holes),closeness=(s.greenTrees??0)/100;
 // How far this point is from the nearest tee. The launch corridors already
 // carry every tee in world coordinates, so there is no second list to keep in
 // step with where the tees ended up.
 const teeNear=(x,z)=>{
  let best=Infinity;
  for(const c of launch){const d=Math.hypot(c.x-x,c.z-z);if(d<best)best=d;}
  return best;
 };
 const rng=random(s.seed+':ecology'),pick=()=>{let r=rng();for(const[k,f]of bio.plants){r-=f;if(r<=0)return k;}return bio.plants[0][0];};
 // A species may be understorey: a third number scales its height, so a biome
 // can have a mid-storey under its giants instead of everything reaching the
 // same canopy. Without it the redwood grove's cedars were also 380 feet tall,
 // which is the christmas-tree-through-a-redwood look.
 const heightScale=Object.fromEntries(bio.plants.map(([k,,scale])=>[k,scale??1]));
 const count=Math.round(s.trees*s.holes*(bio.treeDensity));
 // TREES MUST LEAVE ROOM FOR EACH OTHER. There was no spacing rule at all --
 // invisible while a tree was 20 m with a 3 m crown, and mangled at 116 m with
 // a 10 m one. Crowns in a closed canopy do interlock, so the rule is not "no
 // overlap": it is that two crowns may not be mostly the same crown, and two
 // trunks may never intersect. A grid keeps it from being quadratic.
 const CROWN_SHARE=bio.crownShare,TRUNK_CLEAR=1.5,SPACE_CELL=32;
 const placed=new Map();
 const cellKey=(x,z)=>Math.floor(x/SPACE_CELL)+','+Math.floor(z/SPACE_CELL);
 const roomFor=(t,share=CROWN_SHARE)=>{
  const x=Math.floor(t.x/SPACE_CELL),z=Math.floor(t.z/SPACE_CELL);
  for(let i=x-2;i<=x+2;i++)for(let j=z-2;j<=z+2;j++){
   for(const o of placed.get(i+','+j)||[]){
    const d=Math.hypot(o.x-t.x,o.z-t.z);
    if(d<share*(crownRadius(t)+crownRadius(o)))return false;
    if(d<trunkGirth(t)+trunkGirth(o)+TRUNK_CLEAR)return false;
   }
  }
  return true;
 };
 // A REDWOOD'S RING OF STEMS (the owner's photographs of Northwood; biomes.js
 // `clump`): the stems a redwood sprouts from its roots, a few metres out and a
 // little shorter, their crowns sharing the air but never their trunks. Hashed
 // from where the tree stands, so no stream moves and no other landscape does.
 // A ring's stems are not the open scatter's, which counts to its own target.
 let ringStems=0;
 const clumpRound=(t,n)=>{
  const c=bio.clump;if(!c||!c.kinds.includes(t.kind))return;
  const u=k=>{const v=Math.sin(t.x*12.9898+t.z*78.233+k*37.719)*43758.5453;return v-Math.floor(v);};
  if(u(0)>c.chance)return;
  const stems=c.stems[0]+Math.floor(u(1)*(c.stems[1]-c.stems[0]+1)),a0=u(2)*Math.PI*2;
  for(let k=0;k<stems;k++){
   const a=a0+k/stems*Math.PI*2+(u(3+k)-.5)*.7,d=c.ring[0]+u(10+k)*(c.ring[1]-c.ring[0]),x=t.x+Math.cos(a)*d,z=t.z+Math.sin(a)*d;
   if(Math.abs(x)>halfX||Math.abs(z)>halfZ||height(x,z)<.8||!allows(surface(x,z),'trees')||builtOn(x,z))continue;
   // A green's approach stays open, whatever stands beside it.
   const keep=greenKeepOut(guards,x,z,closeness);
   if(keep>0&&Math.min(...guards.map(g=>Math.hypot(x-g.x,z-g.z)))<keep+GREEN.ramp)continue;
   const h=t.h*(.72+.26*u(17+k)),stem={x,z,y:height(x,z),h,r:t.r*.8,shade:u(24+k),kind:t.kind,hole:t.hole??n?.h?.hole,stand:true};
   if(blocksLaunch(launch,x,z,stem.y,stem.y+h,trunkGirth(stem)+1.2)||inTeeFan(fans,x,z,trunkGirth(stem))||onLip(stem))continue;
   // The crowns close over a ring; only the trunks keep apart.
   if(!roomFor(stem,0))continue;
   const key=cellKey(x,z);if(!placed.has(key))placed.set(key,[]);placed.get(key).push(stem);
   trees.push(stem);ringStems++;
  }
 };
 // The drawn trunk radius, which physics also uses. Kept local rather than
 // imported so the generator does not depend on the flight model.
 const trunkGirth=t=>GROUND_PLANTS.has(t.kind)?0:Math.min(t.h*.027,3.6);
 // NO TRUNK ON A CLIFF'S LIP (the polish goal's floating trees, round 3): a
 // tree whose trunk spans ground falling away by more than 15% of its height
 // (PLACED) would be drawn that far into the ground to seat it (tree-seat.js)
 // and read as stunted on the edge -- so none is planted there. Measured on a
 // ring a tenth of the tree's height out (1-2.5 m): the widest trunk foot of
 // any family, which is what the seat measures (one and a half girths, the
 // first try, was a metre and let half the lipped pines and spruces through).
 // NO GROUND COVER ON A WALL (species.js COVER_STEEPEST): the ground's slope
 // over a plant's spread, the way tree-seat.js measures it. Past 40 degrees
 // no seat holds a fern, so none is planted there -- in the open scatter and
 // the stands alike.
 // At two spans -- the cover's tilt span, and half of it -- the steeper of the
 // two: a shrub at 39 degrees over its span stood on a 45-degree step.
 const slopeOver=(x,z,d)=>Math.hypot(height(x+d,z)-height(x-d,z),height(x,z+d)-height(x,z-d))/(2*d);
 // And on a creek's cut bank, none that would float: a shrub 0.4 m from a
 // Wine Country creek's water stood on the cut's drop, which the centred
 // slopes above average away, and its capped seat left it 6 cm proud
 // (generator 81). Asked only on a cut bank -- refusing every cover there
 // moved every landscape's planting for one shrub.
 const floatsOnCut=(x,z,r,kind,h)=>{const st=streams.at(x,z);return !!st&&st.edge<cutFor(st.width).lip+r&&gapAt({x,z,y:height(x,z),h,r,kind},height,coverRadius({r})).worst>FLOAT_TOLERANCE;};
 const coverTooSteep=(x,z,r,kind,h)=>{const d=Math.max(.5,r*.6);return Math.max(slopeOver(x,z,d),slopeOver(x,z,Math.max(.3,d/2)))>COVER_STEEPEST||(kind!==undefined&&floatsOnCut(x,z,r,kind,h));};
 // A drop under the foot of more than 15% of the tree's height, or 2 m at
 // most (generator 76: a magnolia stood over a 2.5 m creek bank).
 const onLip=t=>{if(GROUND_PLANTS.has(t.kind))return false;const R=Math.min(2.5,Math.max(1,t.h*.1));let low=Infinity;for(let k=0;k<8;k++){const a=k*Math.PI/4;low=Math.min(low,height(t.x+Math.cos(a)*R,t.z+Math.sin(a)*R));}return t.y-low>Math.min(t.h*.15,2);};
 // The overhaul's brush (tools/blender/cartoon_brush.py), sized to the real
 // plants, metres (RESEARCH, *The overhaul's brush*): creosote 1.2-3, brittle-
 // bush 0.3-1.5, big sagebrush up to about 2 (field means 0.2-0.7), bracken
 // 1-2, evergreen huckleberry 1.2-4 in the woods. PLACED within those.
 // The Pacific pack's shrubs (the US landscapes goal; the study's specs):
 // vine maple 2-6 m, Oregon grape 0.5-2, Scotch broom 1-3, Pacific
 // rhododendron 2-6, Douglas iris 0.3. PLACED within those.
 const BRUSH_SIZE={creosote:[1.2,2.6],brittlebush:[.5,1.2],sagebrush:[.5,1.4],bracken:[.8,1.7],huckleberry:[1.2,2.8],
  vinemaple:[2,4.8],oregongrape:[.6,1.8],scotchbroom:[1,2.6],pacificrhododendron:[2,4.6],douglasiris:[.25,.4],
  // The mountain pack's: willow thickets 1-4 m, columbine 0.3-0.6, lupine 0.4-1.
  willowthicket:[1.4,3.6],columbine:[.3,.6],lupine:[.4,.9],
  // The dry-and-lake pack's: jojoba 1.2-1.8 m, sand cherry 0.4-0.9.
  jojoba:[1.2,1.8],sandcherry:[.4,.9],
  // The Heartland's prairie flowers 0.6-1.2 m.
  prairieforbs:[.6,1.2],
  // The Keys' shrubs: sea grape 2.5-5 m, bougainvillea 2-4, hibiscus 1.5-2.6.
  seagrape:[2.5,5],bougainvillea:[2,4],hibiscus:[1.5,2.6],
  // The north's and Hawaii's (PLACED within their specs).
  fireweed:[1,1.8],devilsclub:[1.2,2.2],cottongrass:[0.3,0.5],tiplant:[1.5,2.5],heliconia:[1.4,2.2],
  // Appalachia's and the Northeast parkland's (PLACED within their specs).
  rosebay:[2.5,4.5],mountainlaurelshrub:[1.8,3],flameazalea:[1.8,2.6],scruboak:[1,2.5],bayberry:[1.4,2.2],beachrose:[1,1.6],hydrangea:[1.1,1.6],
  // The high desert's and the plains' (PLACED within their specs).
  // The Badlands' (its specs: chokecherry 1-6 m, here a draw's thicket; leadplant 0.3-1).
  chokecherry:[2,4],leadplant:[0.4,0.9],
  rabbitbrush:[0.8,1.6],blackbrush:[0.6,1.2],cliffrose:[1.8,3],balsamroot:[0.4,0.7],globemallow:[0.4,0.8],cheatgrass:[0.25,0.5],soapweedyucca:[0.6,1.2],buffalograss:[0.12,0.25],wildsunflower:[1.2,2.4],
  // California's and the western mountains' (PLACED within their specs).
  iceplant:[0.15,0.3],coastalsage:[0.8,1.5],chaparral:[1.5,3.5],grapevine:[1.4,1.8],californiapoppy:[0.25,0.4],manzanita:[1.5,3],bitterbrush:[0.8,1.8],mulesear:[0.4,0.8],beargrass:[0.6,1.5],
  // Texas's and the deserts' (PLACED within their specs).
  pampasgrass:[2.2,3.4],mountainlaurel:[3,5],bluebonnet:[0.3,0.45],mojaveyucca:[1.8,3.5],oleander:[2.5,4],sotol:[1,1.6],lechuguilla:[0.3,0.5],beavertail:[0.4,1],
  // The South's (the packs' reports, within their specs).
  sawpalmetto:[1,1.8],longleafgrass:[0.5,0.9],wiregrass:[0.3,0.6],cypressknees:[0.5,1],azalea:[1,1.6],yaupon:[3.5,5.5],spartina:[1.2,1.7],sawgrass:[1.6,2.6],muhlygrass:[0.75,1],waxmyrtle:[3,5]};
 // A plant's height and spread from two uniform numbers -- drawn from the
 // ecology stream for the open scatter, hashed for a stand (stands.js). The
 // low cacti (`cholla`: teddy-bear cholla, prickly pear, barrel) stand
 // 0.7-1.6 m, the teddy bear's real height (RESEARCH, *The overhaul's desert pack*).
 // (An Architect course's trees grew with its age dial until the designer was
 // removed, 2 November 2026.)
 const treeSize=(kind,a,b)=>baseTreeSize(kind,a,b);
 const baseTreeSize=(kind,a,b)=>{const small=GROUND_PLANTS.has(kind);if(kind==='cholla')return {h:.7+a*.9,r:.5+b*.6};if(TREE_SIZE[kind]){const [h0,h1,r0,r1]=TREE_SIZE[kind];return {h:h0+a*(h1-h0),r:r0+b*(r1-r0)};}if(BRUSH_SIZE[kind]){const [h0,h1]=BRUSH_SIZE[kind],h=h0+a*(h1-h0);return {h,r:h*(.5+b*.3)};}return {h:small?.8+a*2.1:tallHeight(bio,kind,a,heightScale[kind]??1),r:small?1+b*1.3:kind==='aspen'?2+b*2:kind==='palo'||kind==='mesquite'||kind==='ironwood'?4+b*3:3+b*4};};
 // TREES IN THE SHALLOWS (biomes.js `inWater`; the Bayou's bald cypress and
 // its knees, the US landscapes goal): a kind the landscape names may stand in
 // a pond's or lake's water -- never the sea -- within 8 m of its shore
 // (PLACED). Only a landscape that names one tests it, so no other moves.
 const inShallows=(kind,x,z)=>!!bio.inWater?.includes(kind)&&surface(x,z)==='water'&&!isSea(x,z)&&[[8,0],[-8,0],[0,8],[0,-8]].some(([dx,dz])=>surface(x+dx,z+dz)!=='water');
 for(let i=0;i<count*6&&trees.length-ringStems<count;i++){const x=(rng()-.5)*halfX*2,z=(rng()-.5)*halfZ*2,n=nearest(x,z),kind=pick();if(builtOn(x,z)||!(allows(surface(x,z),'trees')||inShallows(kind,x,z))||n.d>135+30*Math.sin(x/95+phase)*Math.cos(z/140)||height(x,z)<.8)continue;if(rng()>(.64+.3*Math.sin(x/55+phase)*Math.cos(z/67)))continue;if(bio.landform&&rng()>landform.treeKeep(x,z))continue;
  // WOODS BEHIND THE DUNES (biomes.js `woods`): a tree near the holes is
  // mostly turned away, so the ground beside play stays open dune and the
  // trees mass up farther back. Ground plants are exempt. The draw is taken
  // only when a biome sets `woods`, so no other biome's planting moves.
  if(bio.woods&&!GROUND_PLANTS.has(kind)&&rng()>bio.woods.floor+(1-bio.woods.floor)*smooth((n.d-bio.woods.from)/(bio.woods.to-bio.woods.from)))continue;
  const small=GROUND_PLANTS.has(kind),{h,r}=treeSize(kind,rng(),rng());
  // The soft edge. Drawn before anything else is decided about this candidate,
  // so a rejection here costs one number and not a whole tree's worth of them.
  {
   // `n.d` IS SIGNED, and that is the whole story. It is the distance outside a
   // hole's corridor ENVELOPE, which near a tee is far wider than the mown turf
   // -- measured, 99% of the rough around a tee sits at a negative d, as deep as
   // -34 m. So "at least 10 m outside" banned the entire tee surround while the
   // surface classifier was calling that same ground rough.
   //
   // Near a tee, and for ground cover anywhere, the gate simply does not apply:
   // nothing may stand on mown turf and nothing may stand in the launch
   // corridor, and those two are the rules that actually matter.
   // Near a tee the ramp runs over NEGATIVE distances, because that is where the
   // ground is. Without one the tee zone ends up denser than the rest of the
   // course -- measured at 129-160% of average, a thicket rather than a frame.
   const cover=GROUND_PLANTS.has(kind);
   if(!cover){
    // Near a green the green's own rule replaces the corridor gate, for the
    // same reason it does near a tee: the corridor envelope there is far wider
    // than the mown surround, so the ordinary gate bans everything.
    const keep=greenKeepOut(guards,x,z,closeness);
    if(keep>0){
     const dg=Math.min(...guards.map(g=>Math.hypot(x-g.x,z-g.z)));
     if(dg<keep)continue;
     if(dg<keep+GREEN.ramp&&rng()>smooth((dg-keep)/GREEN.ramp))continue;
    }else{
     const tee=teeNear(x,z)<EDGE.teeZone;
     // The hole's own half-width where this ground sits, so the ramp tracks a
     // corridor that widens instead of being a fixed number of metres beside it.
     const floor=tee?Math.min(EDGE.teeFloorMin,EDGE.teeSpan*(n.h?.width?.(Math.max(0,n.p?.z??0))??EDGE.soft)):EDGE.floor;
     const soft=tee?EDGE.teeSoft:EDGE.soft;
     if(n.d<floor)continue;
     if(n.d<soft&&rng()>smooth((n.d-floor)/(soft-floor)))continue;
    }
   }
  }
  const tree={x,z,y:height(x,z),h,r,shade:rng(),kind,hole:n.h.hole};
  // Ground cover threads between the trunks and needs no room of its own.
  // A ground plant is ankle height with no trunk, so nothing can hit it and it
  // is exactly what should still grow in front of a tee.
  // BOTH TESTS ARE ABOUT THE BODY, not about the point it grew from. The
  // corridor test has always padded by the trunk; the fan test did not, so a
  // trunk up to 3.6 m across could stand half inside the view from the back
  // tees with its centre just outside it. Measured across 35 planted courses,
  // 154 trunks were over that line.
  if(!small&&(blocksLaunch(launch,x,z,tree.y,tree.y+h,trunkGirth(tree)+1.2)||inTeeFan(fans,x,z,trunkGirth(tree))))continue;
  // A bush is under the ball but can still stand in the golfer's eye line. It
  // was exempt from both tests above, and 232 of them stood in a tee's view on
  // 12 planted courses (12 October 2026). Low cover still grows in front of a
  // tee; only cover whose top rises above the sightline is refused.
  if(small&&(blocksView(launch,x,z,tree.y+h,r)||coverTooSteep(x,z,r,kind,h)))continue;
  if(!small&&CROWN_SHARE&&!roomFor(tree))continue;
  if(onLip(tree))continue;
  if(!small){const key=cellKey(x,z);if(!placed.has(key))placed.set(key,[]);placed.get(key).push(tree);}
  trees.push(tree);
  clumpRound(tree,n);
 }
 // UNCLEARED STANDS (stands.js; the cartoon overhaul): the woods round the
 // property and between the holes that were never cut, planted densely from
 // a jittered grid after the open scatter, by the same rules every tree
 // obeys -- ground that allows it, clear of houses, the tee shots, the view
 // from the tee and each other's trunks -- with crowns allowed to close.
 // Hashed, not drawn: the ecology stream above is untouched. The range has
 // none.
 const stands=s.range?null:standsOf(bio,s.seed);
 if(stands){
  const mix=stands.plants??bio.plants.filter(([k])=>!GROUND_PLANTS.has(k));
  // PROGRESS THROUGH THE STANDS (the cartoon overhaul): they made planting a
  // fifth of a wooded course's wait, and as one step the bar stood still and
  // the page got no frames for a second. Reporting is all a yield does here --
  // generateWorld runs straight through -- so nothing generated moves.
  const sites=standSites(stands,halfX,halfZ,s.seed);let visited=0;
  yield phaseAt(4,.25);
  for(const p of sites){
   if(++visited%300===0)yield phaseAt(4,.25+.5*visited/sites.length);
   const {x,z}=p,n=nearest(x,z);
   if(stands.at(x,z,n.d)<.5||height(x,z)<.8||!allows(surface(x,z),'trees'))continue;
   if(builtOn(x,z))continue;
   if(bio.landform&&p.shade>landform.treeKeep(x,z))continue;
   // Trees in a closed wood grow taller than in the open, reaching for light
   // (`grow`, 1.2 unless the stand says: PLACED); ground plants do not.
   const kind=choose(mix,p.pick),small=GROUND_PLANTS.has(kind),size=treeSize(kind,p.a,p.b),grow=small?1:stands.grow??1.2,h=size.h*grow,r=size.r*grow;
   if(greenKeepOut(guards,x,z,closeness)>0&&Math.min(...guards.map(g=>Math.hypot(x-g.x,z-g.z)))<greenKeepOut(guards,x,z,closeness)+GREEN.ramp)continue;
   const tree={x,z,y:height(x,z),h,r,shade:p.shade,kind,hole:n.h.hole,stand:true};
   if(!small&&(blocksLaunch(launch,x,z,tree.y,tree.y+h,trunkGirth(tree)+1.2)||inTeeFan(fans,x,z,trunkGirth(tree))))continue;
   if(small&&(blocksView(launch,x,z,tree.y+h,r)||coverTooSteep(x,z,r,kind,h)))continue;
   if(!small&&(onLip(tree)||!roomFor(tree,stands.share)))continue;
   if(!small){const key=cellKey(x,z);if(!placed.has(key))placed.set(key,[]);placed.get(key).push(tree);}
   trees.push(tree);
   clumpRound(tree,n);
  }
  // THE UNDERSTORY (the owner: THICK brush): shrubs and ferns under a stand,
  // from a grid of their own (`under.spacing`, its own salt), about one in
  // two sites kept, by the ground-plant rules -- ground that allows shrubs,
  // clear of houses and of the view from the tee. No trunk, so nothing a
  // ball stops on. Marked `under`, so a graphics tier may draw fewer.
  const underSites=stands.under?standSites({spacing:stands.under.spacing},halfX,halfZ,s.seed,'under'):[];visited=0;
  yield phaseAt(4,.75);
  for(const p of underSites){
   if(++visited%600===0)yield phaseAt(4,.75+.2*visited/underSites.length);
   const {x,z}=p;
   if(p.shade>.55)continue;
   const n=nearest(x,z);
   if(stands.at(x,z,n.d)<.5||height(x,z)<.8||!allows(surface(x,z),'shrubs'))continue;
   if(builtOn(x,z))continue;
   const kind=choose(stands.under.plants,p.pick),{h,r}=treeSize(kind,p.a,p.b),tree={x,z,y:height(x,z),h,r,shade:p.shade,kind,hole:n.h.hole,stand:true,under:true};
   if(blocksView(launch,x,z,tree.y+h,r)||coverTooSteep(x,z,r,kind,h))continue;
   trees.push(tree);
  }
 }
 // THE LOT'S ISLAND TREES (the streets kit, PLAN 4): one in each planted
 // island at the ends of the lot's rows, the landscape's most-planted tree,
 // kept to an island's size (5.5 m tall, 2.2 m of crown at most; PLACED: drawn
 // 10 m tall, a Heartland oak keeps its own wide crown and eight of them roofed
 // the lot over). A
 // tree like any other: solid, and drawn as its species.
 if(roadLot){
  const tall=bio.plants.filter(([k])=>!GROUND_PLANTS.has(k)).sort((a,b)=>b[1]-a[1]),kind=tall[0]?.[0];
  if(kind)for(const p of streetFurniture({lot:roadLot,roads,club:buildings[0]}).filter(p=>p.kind==='island')){
   const {h,r}=treeSize(kind,.5,.5),n=nearest(p.x,p.z),y=height(p.x,p.z);
   // Never in a tee shot or its view, as every other tree (the full bench:
   // a lot below a Lake Dunes tee).
   // Only where a tree may stand, and off the clubhouse and its lawn (the tests:
   // a Sonoran island on the drive's ground, a Keys palm on the lawn).
   const club=buildings[0]?.kind==='clubhouse'?buildings[0]:null;
   if(!allows(surface(p.x,p.z),'trees')||(club&&(inBuilding(club,p.x,p.z,2)||inForecourt(club,p.x,p.z))))continue;
   if(blocksView(launch,p.x,p.z,y+Math.min(h,5.5),Math.min(r,2.2))||inTeeFan(teeFans(holes),p.x,p.z,Math.min(h*.027,3.6)))continue;
   trees.push({x:p.x,z:p.z,y:height(p.x,p.z),h:Math.min(h,5.5),r:Math.min(r,2.2),shade:.3,kind,hole:n.h.hole,island:true});
  }
 }
 // A VINEYARD IN ROWS (biomes.js `vineyard`; Wine Country, the US landscapes
 // goal): up to `blocks` blocks of 60 by 36 m on open, near-level ground well
 // off play (30 m from any corridor), each turned to its own bearing, a vine
 // every 2 m along rows 3 m apart; the scattered trees inside a block are
 // cleared. Its own stream, so nothing before it moves. Sizes PLACED.
 if(bio.vineyard){
  const vr=random(s.seed+':vineyard'),W=60,D=36,blocks=[];
  for(let t=0;t<400&&blocks.length<(bio.vineyard.blocks||1);t++){
   const cx=(vr()-.5)*halfX*1.6,cz=(vr()-.5)*halfZ*1.6,a=vr()*Math.PI,ca=Math.cos(a),sa=Math.sin(a);
   const at=(u,v)=>({x:cx+u*ca+v*sa,z:cz-u*sa+v*ca});
   let ok=true,lo=Infinity,hi=-Infinity;
   for(let u=-W/2;u<=W/2&&ok;u+=10)for(let v=-D/2;v<=D/2;v+=9){const p=at(u,v),n=nearest(p.x,p.z);if(!allows(surface(p.x,p.z),'trees')||n.d<30||builtOn(p.x,p.z)||nearRoad(p.x,p.z,4)||blocks.some(b=>Math.hypot(b.cx-p.x,b.cz-p.z)<80)){ok=false;break;}const y=height(p.x,p.z);lo=Math.min(lo,y);hi=Math.max(hi,y);}
   if(!ok||hi-lo>4)continue;
   blocks.push({cx,cz,a,at});
  }
  for(const b of blocks){
   const inside=(x,z)=>{const dx=x-b.cx,dz=z-b.cz,u=dx*Math.cos(b.a)-dz*Math.sin(b.a),v=dx*Math.sin(b.a)+dz*Math.cos(b.a);return Math.abs(u)<=W/2+2&&Math.abs(v)<=D/2+2;};
   for(let i=trees.length-1;i>=0;i--)if(!trees[i].island&&inside(trees[i].x,trees[i].z))trees.splice(i,1);
   for(let v=-D/2;v<=D/2;v+=3)for(let u=-W/2;u<=W/2;u+=2){const p=b.at(u,v),{h,r}=treeSize('grapevine',.5,.5);trees.push({x:p.x,z:p.z,y:height(p.x,p.z),h,r,shade:.4,kind:'grapevine',hole:nearest(p.x,p.z).h.hole,vineyard:true});}
  }
 }
 // BOULDERS ARE WORLD DATA NOW, NOT DECORATION.
 //
 // They were placed in vegetation.js at draw time, from an rng the generator
 // never saw, which meant the world did not know where they were and physics
 // could not possibly collide with one -- a ball flew through a six-metre
 // boulder. Moving them here is what lets them be solid; the renderer reads
 // this list instead of inventing its own.
 //
 // The draw order is preserved exactly as the renderer had it, so a rock is the
 // same shape and sits the same way it used to; only the stream it draws from
 // is new, which is why the fingerprints move.
 const rocks=[];
 {
  const rockRng=random(s.seed+':rocks'),scatter=bio.scatter||{};
  const n=scatter.rocks||0,base=scatter.rockScale||1,STONES=4;
  for(let i=0;i<n;i++){
   const x=(rockRng()-.5)*halfX*2,z=(rockRng()-.5)*halfZ*2;
   if(!allows(surface(x,z),'boulders')||nearest(x,z).d<5)continue;
   const scale=base*(.6+rockRng()*3),shape=Math.floor(rockRng()*STONES);
   const y=height(x,z);
   const rot=[rockRng(),rockRng()*6.28,rockRng()];
   const sx=scale*(1.15+rockRng()*.5),sy=scale*(.48+rockRng()*.42),sz=scale*(.82+rockRng()*.42);
   // `top` and `reach` are what physics reads: the stone is drawn as a squashed
   // icosahedron sunk a quarter of its scale into the ground, so its crown sits
   // at centre + sy and the widest it gets across is the larger half-extent.
   const top=y+scale*.25+sy,reach=Math.max(sx,sz);
   // BUILD IT, THEN JUDGE WHAT WAS BUILT -- the same order the specimen
   // obstacles use, and for the same reason. A boulder used to be tested as a
   // POINT with no width, against a ceiling of y+scale that is not its height:
   // a stone is drawn up to 0.9 of its scale above centre and sunk a quarter
   // of it, so its crown reaches y + 1.15 scale. Both errors let the same kind
   // of rock through -- one whose centre sits just outside the launch cone and
   // whose body, up to 1.65 scale across, stands in it. Desert and mountain
   // carry the most rocks at twice the size of anywhere else, which is exactly
   // where blocked tee shots were reported.
   //
   // The tee FAN is checked too. Trees have obeyed it since it was built -- it
   // is the combined cone from all three tees, which is what stops something
   // standing in the view from the back box without being in the shot line from
   // the front one. Rocks never consulted it at all.
   if(blocksLaunch(launch,x,z,y,top,reach)||inTeeFan(fans,x,z,reach))continue;
   rocks.push({x,z,y,scale,shape,rot,sx,sy,sz,top,reach});
  }
 }
 // SPECIMEN OBSTACLES: the lone cypress, the oak in the middle of the fairway.
 //
 // The difference between a feature and a nuisance is entirely in the siting, so
 // the rules are explicit and each one is tested:
 //
 //   Never on a tee shot        -- blocksLaunch, the same rule everything else
 //                                 obeys. A feature you cannot get past off the
 //                                 tee is not a feature.
 //   Never seals the hole       -- at least FEATURE_GAP of open short grass is
 //                                 left on one side, so there is always a route.
 //   Never in the green's lap   -- kept back from the putting surface, where a
 //                                 blind pitch is a different and meaner thing.
 //   Only where there is room   -- a narrow corridor gets nothing rather than a
 //                                 tree that makes it unplayable.
 //
 // They go straight into `trees` and `rocks`, which means they draw and collide
 // through the paths everything else already uses; there is no separate kind of
 // object to keep working.
 const {gap:FEATURE_GAP,greenKeep:FEATURE_GREEN_KEEP,minHalf:FEATURE_MIN_HALF,standoff:FEATURE_STANDOFF}=FEATURE;
 {
  const fRng=random(s.seed+':features'),share=(s.fairwayFeature??0)/100;
  // Decided once for the biome rather than per attempt: it is a property of
  // what grows here, not of where this particular feature landed.
  const featureTree=bio.plants.find(([k])=>!GROUND_PLANTS.has(k))?.[0]||null;
  for(const h of holes){
   if(h.range||fRng()>=share)continue;
   const from=Math.max((h.mowStart??h.fairwayStart??22)+70,95);
   const to=h.length-FEATURE_GREEN_KEEP;
   if(to-from<40)continue;
   // A few attempts, because most of what it tries will be refused.
   for(let a=0;a<14;a++){
    const z=from+fRng()*(to-from);
    const half=fairwayWidth(h,z);
    if(half<FEATURE_MIN_HALF)continue;
    const centre=h.center(z);
    // A cheap early-out on the widest a feature ever gets. The real check is
    // below, against the geometry that actually gets built.
    const room=half-6-FEATURE_GAP;
    if(room<0)continue;
    const x=centre+(fRng()*2-1)*room;
    const w0=h.toWorld({x,z});
    const lie=surface(w0.x,w0.z);
    if(lie==='green'||lie==='sand')continue;
    if(lakeOwner(w0.x,w0.z,6))continue;
    const ground=height(w0.x,w0.z);
    // ONLY A TREE, A CACTUS OR A ROCK MAY STAND IN A FAIRWAY.
    //
    // `featureTree` is the biome's first species that is not ground cover, and
    // on LINKS there is no such species: gorse, heather and shrub are all
    // ground plants, so the picker fell through to `bio.plants[0]` and chose
    // GORSE -- then sized it by the biome canopy, 13 to 29 m. A gorse bush
    // three times the height of a house, in the middle of the fairway. The
    // fallback was silent, which is why it survived: every other biome leads
    // with a real tree and nobody looked at links.
    //
    // A biome with no tree gets a rock instead of a stretched shrub. The roll
    // happens either way so the choice does not shift the rest of the stream.
    const rock=fRng()<.3||!featureTree;
    const spread=rock?2.2+fRng()*1.6:3.4+fRng()*2.2;
    const tall=rock?spread*1.1:bio.canopy.min+bio.canopy.range*(.75+fRng()*.35);
    // BUILD IT, THEN JUDGE WHAT WAS BUILT. The first version validated the
    // cluster's CENTRE and then scattered stones up to a full radius away --
    // including sideways, straight into the gap it had just guaranteed. The
    // test caught it 0.1 m under. Everything is laid out first now and every
    // piece of it has to pass, because the piece that sticks out is the one a
    // ball hits.
    const pieces=[];
    if(rock){
     const n=2+Math.floor(fRng()*3);
     for(let k=0;k<n;k++){
      const ang=fRng()*6.283,rad=fRng()*spread*.6;
      const rx=w0.x+Math.cos(ang)*rad,rz=w0.z+Math.sin(ang)*rad;
      const scale=(bio.scatter?.rockScale||1)*(1.1+fRng()*1.5);
      const ry=height(rx,rz);
      const sx=scale*(1.15+fRng()*.5),sy=scale*(.48+fRng()*.42),sz=scale*(.82+fRng()*.42);
      pieces.push({rock:true,x:rx,z:rz,y:ry,scale,shape:Math.floor(fRng()*4),
       rot:[fRng(),fRng()*6.28,fRng()],sx,sy,sz,
       top:ry+scale*.25+sy,reach:Math.max(sx,sz)});
     }
    }else{
     pieces.push({rock:false,x:w0.x,z:w0.z,y:ground,h:tall,r:spread,reach:spread,
      shade:fRng(),kind:featureTree,hole:h.hole});
    }
    // Every piece: clear of the near stretch of every tee shot, and leaving a
    // route past it in the corridor it actually stands in.
    let fair=true;
    for(const q of pieces){
     const qTop=q.rock?q.top:q.y+q.h;
     if(blocksLaunch(launch,q.x,q.z,q.y,qTop,q.reach,FEATURE_STANDOFF)){fair=false;break;}
     const local=h.toLocal(q),qHalf=fairwayWidth(h,local.z);
     if(qHalf<=0){fair=false;break;}
     const mid=h.center(local.z);
     const leftRoom=(mid+qHalf)-(local.x+q.reach);
     const rightRoom=(local.x-q.reach)-(mid-qHalf);
     if(Math.max(leftRoom,rightRoom)<FEATURE_GAP){fair=false;break;}
    }
    if(!fair)continue;
    for(const q of pieces){
     if(q.rock){const{rock:_,...r}=q;rocks.push({...r,feature:true});}
     else{const{rock:_,reach:__,...t}=q;trees.push({...t,feature:true});}
    }
    break;
   }
  }
 }
 // FALLEN NEEDLES AND LEAVES under the species the biome names (`fallen`):
 // pine straw under the conifers, leaves under Autumn's hardwoods. Patches as
 // they always were (an oval per tree, most trees), then baked onto the ground
 // atlas's grid so the lie (surface, above) and the paint (ground.js, the
 // cover texture's green channel) read the same bytes. `groundCover` answers
 // from those bytes too, so grass is kept off exactly the ground that plays
 // as straw. Before the overhaul the patches were only paint, and only under
 // pine, spruce and cedar.
 const fallenFrom=new Set(bio.fallen?.from||[]);
 const straw=trees.filter(t=>fallenFrom.has(t.kind)&&t.shade<.72).map(t=>({x:t.x,z:t.z,rx:t.r*(1.1+t.shade),rz:t.r*(.85+t.shade),phase:t.shade*6.28}));
 const coverCells=new Map();for(const patch of straw){for(let x=Math.floor((patch.x-patch.rx*1.1)/24);x<=Math.floor((patch.x+patch.rx*1.1)/24);x++)for(let z=Math.floor((patch.z-patch.rz*1.1)/24);z<=Math.floor((patch.z+patch.rz*1.1)/24);z++){const key=x+','+z;if(!coverCells.has(key))coverCells.set(key,[]);coverCells.get(key).push(patch);}}
 if(straw.length)fallenField=fallenBake((x,z)=>(coverCells.get(Math.floor(x/24)+','+Math.floor(z/24))||[]).some(p=>insideOval(x,z,p)),groundGrid.halfX,groundGrid.halfZ);
 const groundCover=(x,z)=>fallenField&&fallenAt(fallenField,x,z)?'straw':bio.cover;
 // THE COURSE'S MARKINGS (markings.js): stakes, yardage posts and rakes,
 // decoration placed on the finished ground. None on the range.
 const markers=!s.range?placeMarkings({holes,surface,nearest,halfX,halfZ,streams}):[];
 const wear=!s.range?placeWear({holes,s,surface}):[];
 // Animals (life.js; phase 6): rendering only.
 const life=!s.range?placeLife({holes,s,surface,nearest,halfX,halfZ,paths,trees}):[];
 // Rip-rap, tie walls and fountains (waterworks.js; phase 5).
 const waterworks=!s.range?placeWaterworks({holes,s,surface}):[];
 const world={perches:perches.map(({cx,cz,ux,uz,L,r})=>({cx,cz,ux,uz,L,r})),coastAt,coastMin,coastMax,teeSites,lakeOwner,largeLakes,homes,buildings,life,walls,wallBoxes:wallBoxes(walls,height),storyProps,roads,lot:roadLot,boundary,streetProps:streetFurniture({lot:roadLot,roads,club:buildings.find(b=>b.kind==='clubhouse')}),waterworks,rocks,paths,bridges,markers,wear,streams,footprint,groundGrid,groundCover,straw,blowouts,wild,fallenField,surfaceField:sandField,landform,settings:s,bio,holes,halfX,halfZ,waterLevel,height,surface,trees,nearby,nearest,land,seed:s.seed,ecology:bio.plants.map(([kind])=>kind)};
 for(const h of holes){h.world=world;h.residentialOB=!!s.residentialOB;h.height=(x,z)=>{const p=h.toWorld({x,z});return height(p.x,p.z);};h.surface=(x,z)=>{const p=h.toWorld({x,z});return surface(p.x,p.z);};h.trees=trees.filter(t=>t.hole===h.hole).map(t=>({...t,...h.toLocal(t)}));}
 return world;
}
