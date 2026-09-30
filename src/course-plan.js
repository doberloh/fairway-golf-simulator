// Yardages are measured along the playing line; the blue tee is the reference.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// THE ONE SEEDED GENERATOR. course.js re-exports this as `random` rather than
// keeping its own copy: there were two, written differently but producing
// identical streams, and a scorecard computed here has to agree exactly with
// the course grown there. Two implementations that must never diverge is a
// promise nobody can keep.
export function rng(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const TEE_COLORS={blue:'#4385d5',white:'#f4f2e7',red:'#d75c52'};
export function enabledTees(){return Object.keys(TEE_COLORS);}
// WHAT A HOLE OF EACH PAR IS ALLOWED TO BE, in yards along the playing line off
// the back tee.
//
// The USGA's current guideline for assigning par (2020) deliberately OVERLAPS,
// because par is set on effective playing length rather than measured yardage:
// for men, par 3 under 260, par 4 240-490, par 5 450-710. Those are the outer
// limits of what may legally be called a par, not a description of golf. A
// 700-yard par 5 is a par 6 waiting to be reclassified, and a 240-yard par 4 is
// a par 3 with ambitions.
//
// So `max` is the guideline where the guideline is sane and tighter where it is
// not, and `typical` is what an ordinary hole of that par measures. At par 72
// (four 3s, ten 4s, four 5s) these maxima total 8,460 yards, which is exactly
// the top of the course-length slider, so the full range stays reachable.
//
// THE NUMBERS THESE REPLACED were a base of 165/385/545, jittered by plus or
// minus a quarter with no clamp of any kind, and then every hole multiplied by
// one factor to hit the course total. Two things went wrong with that. Nothing
// stopped a hole leaving its par's range -- at a 7,400-yard target one hole in
// eight was outside the USGA guideline and par 5s reached 803 yards. And
// because the rescale was uniform, a hole that jittered long raised the total,
// which LOWERED the factor and shortened every other hole: the monster par 5
// paid for itself out of the par 4s, which is exactly how it was reported.
export const PAR_YARDS={
 3:{min:120,typical:175,max:250},
 4:{min:300,typical:410,max:490},
 5:{min:470,typical:540,max:640},
};

// Spread the course's length across its holes without letting any of them leave
// its band.
//
// Every hole starts at a typical length for its par, jittered within the band,
// and then the shortfall against the target is handed out IN PROPORTION TO THE
// ROOM EACH HOLE HAS LEFT. A hole already near its ceiling absorbs almost none
// of an increase; one near the middle takes its share. Repeat to mop up what
// clamping refuses, and stop early once every hole is against a stop -- at that
// point the target is simply not reachable with this par mix, which is what
// `target` being clamped by the caller is for.
function fitYardages(pars,target,random){
 const holes=pars.map(par=>{
  const b=PAR_YARDS[par],t=random()*2-1;
  // Jitter is asymmetric because the bands are: a par 4's typical sits 110
  // above its floor and 80 below its ceiling, and scaling one span by the
  // other's width would push it out on the narrow side every time.
  return {par,yards:clamp(b.typical+t*(t<0?b.typical-b.min:b.max-b.typical)*.55,b.min,b.max)};
 });
 for(let pass=0;pass<8;pass++){
  const gap=target-holes.reduce((v,h)=>v+h.yards,0);
  if(Math.abs(gap)<.5)break;
  const room=holes.map(h=>gap>0?PAR_YARDS[h.par].max-h.yards:h.yards-PAR_YARDS[h.par].min);
  const pool=room.reduce((a,b)=>a+b,0);
  if(pool<1e-6)break;
  holes.forEach((h,i)=>{const b=PAR_YARDS[h.par];h.yards=clamp(h.yards+gap*room[i]/pool,b.min,b.max);});
 }
 return holes;
}

// How wrong an ordering is, so a seeded shuffle can be improved rather than
// simply accepted. Back-to-back par 3s or par 5s are the thing real routing
// avoids hardest, so they cost most; opening or closing on a par 3 is merely
// unusual.
const badness=pars=>{
 let b=0;
 for(let i=1;i<pars.length;i++)if(pars[i]===pars[i-1]&&pars[i]!==4)b+=2;
 if(pars[0]===3)b++;
 if(pars[pars.length-1]===3)b++;
 return b;
};

// PAR ORDER, SPREAD ACROSS THE NINES AND DRIVEN BY THE SEED.
//
// The seed always drove this -- it was a seeded shuffle -- but a shuffle alone
// puts both par 5s on the front and both par 3s on the back often enough to
// notice, and nobody routes a course that way. Each par's count is split as
// evenly as the count allows, with the odd hole going to a side the seed picks
// so it is not always the front nine.
//
// Then each nine is shuffled and hill-climbed against `badness`: random swaps
// from the same seeded stream, kept when they do not make things worse. Equal
// moves are accepted so it can cross a plateau, and the whole thing is bounded,
// so it stays deterministic and cannot spin.
function orderPars(counts,n,random){
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const settle=a=>{
  let best=badness(a);
  for(let t=0;t<240&&best>0;t++){
   const i=Math.floor(random()*a.length),j=Math.floor(random()*a.length);
   if(a[i]===a[j])continue;
   [a[i],a[j]]=[a[j],a[i]];
   const now=badness(a);
   if(now<=best)best=now;else[a[i],a[j]]=[a[j],a[i]];
  }
  return a;
 };
 const expand=c=>Object.entries(c).flatMap(([p,k])=>Array(k).fill(Number(p)));
 if(n<18)return settle(shuffle(expand(counts)));
 const front=[],back=[];
 for(const p of [5,3,4]){
  const c=counts[p]||0;let f=Math.floor(c/2),b=c-f;
  if(c%2&&random()<.5){const t=f;f=b;b=t;}
  for(let i=0;i<f;i++)front.push(p);
  for(let i=0;i<b;i++)back.push(p);
 }
 return [...settle(shuffle(front)),...settle(shuffle(back))];
}

export function planCourse(s={}){
 // One hole is the menu backdrop, not a playable course: it is fast to grow and
 // enough to look at. Nine and eighteen remain the only choices a player sees.
 const n=s.holes===18?18:s.holes===1?1:9,random=rng((s.seed||'EVERGREEN')+':plan');
 // A lone hole is not a course with a par budget to spread around. Its par is
 // simply what its length makes it, and it is allowed to run long enough to be
 // a real par 5 -- the nine-and-eighteen clamp of 470 a hole would cap every
 // single hole at a par 4, which is all the menu backdrop ever needed.
 if(n===1){
  const yards=clamp(Number(s.courseYards)||400,110,620);
  const par=yards<250?3:yards<=470?4:5;
  const hole={par,yards};
  if(par!==3&&random()<clamp(s.doglegs??65,0,100)/100)hole.turnSign=random()<.5?-1:1;
  return {holes:[hole],counts:{3:par===3?1:0,4:par===4?1:0,5:par===5?1:0},par,yards,tees:enabledTees(s)};
 }
 const requested=clamp(Number(s.courseYards)||n*360,n*110,n*470);
 const par=Math.round(clamp(n*4+(requested/n-370)*n/200,n*34/9,n*4));
 // Par stops changing at 68/72 (34/36 for nine). Distance continues scaling.
 const options=[];for(let fives=0;fives<=Math.ceil(n*.28);fives++){const threes=fives+n*4-par,fours=n-threes-fives;if(threes>=Math.min(1,n-1)&&threes<=Math.ceil(n*.4)&&fours>=n*.3)options.push({3:threes,4:fours,5:fives});}
 // WEIGHTED TOWARD A REAL MIX, not picked flat off the list. Every option here
 // adds up to the right par, but they are not equally like golf: for par 72 the
 // list runs from nought par 3s and nought par 5s -- eighteen par 4s -- through
 // to six of each, and a flat draw picks the eighteen-par-4 course as often as
 // the ordinary one. Real courses put about a fifth of their holes at each, so
 // the weight falls away with distance from that share.
 const ideal=n*.22,weigh=c=>1/(1+Math.abs((c[3]||0)-ideal)**1.7+Math.abs((c[5]||0)-ideal)**1.7);
 const weights=options.map(weigh),pick=random()*weights.reduce((a,b)=>a+b,0);
 let acc=0,counts=options[options.length-1];
 for(let i=0;i<options.length;i++){acc+=weights[i];if(pick<=acc){counts=options[i];break;}}
 const pars=orderPars(counts,n,random);
 // The requested length is only a request. A par-72 mix cannot be stretched
 // past what eighteen legal holes add up to, nor squeezed below it, so the
 // total the course ACTUALLY comes to is what gets reported -- the slider
 // bottoming out should be visible rather than silently producing 723-yard
 // par 5s to make the number work.
 const reach=(k)=>pars.reduce((v,p)=>v+PAR_YARDS[p][k],0);
 const target=clamp(requested,reach('min'),reach('max'));
 const holes=fitYardages(pars,target,random);
 const eligible=holes.map((h,i)=>({h,i,rank:random()})).filter(({h})=>h.par!==3).sort((a,b)=>a.rank-b.rank),count=Math.round(eligible.length*clamp(s.doglegs??65,0,100)/100),sign=random()<.5?-1:1;
 eligible.slice(0,count).forEach(({h},i)=>h.turnSign=sign*(i%2?-1:1));
 const yards=Math.round(holes.reduce((v,h)=>v+h.yards,0));
 return {holes,counts,par,yards,requested,tees:enabledTees(s),
  front:pars.slice(0,Math.min(9,n)).reduce((a,b)=>a+b,0),
  back:n>9?pars.slice(9).reduce((a,b)=>a+b,0):0};
}
// THE HOLE'S SKELETON: everything about it that needs no terrain.
//
// Green size, the playing line, the hole's length and where the tees sit --
// worked out from nothing but the seed, the hole number and the plan. That is
// the whole reason it lives here rather than in `generateCourse`: a scorecard
// wants exact tee yardages before a course exists, and the only honest way to
// get them is to run the same code the builder runs, not a second copy of it
// that agrees until someone edits one of them.
//
// IT CONSUMES A CONTIGUOUS PREFIX OF THE HOLE'S OWN STREAM, and the order of
// the draws inside it is load-bearing. `generateCourse` calls this first and
// carries on with the same generator, so a draw added, removed or reordered
// here moves every pond, bunker and contour on the hole. There is a comment
// further down this file about a green surround that went from gentle to 39
// degrees because one draw went missing; this is that same hazard, collected
// into one place where it can be seen.
//
// The tee draws were moved up into this prefix. They used to sit after the
// fairway edges, which meant a scorecard could not reach them without
// replaying the edge generation it has no use for.
// How much to multiply a drawn outline by. At 0 the slider leaves the seed's own
// wobble exactly as it was, so a course generated with the slider down looks the
// way this generator always looked.
// AMPLIFYING THE MIX WAS THE WRONG IDEA, AND IT LOOKED IT.
//
// The first version scaled all the harmonics together to "keep each green's own
// character". What that actually preserved was WHICH HARMONIC DOMINATED, and the
// three-lobed wave is drawn from `.025 + rng*.075` -- always positive, and the
// largest of the three on average. Measured: it led on 69 of 81 greens, with the
// biggest harmonic owning half the wobble. Scaling that up gives a clean
// three-lobed flower, and a three-lobed flower stretched by the green's aspect
// is two round lobes at one end and a tapering shaft. It read exactly as badly
// as that sounds.
//
// So the slider does two things now. It raises the amplitude, and it SPREADS the
// energy across the three harmonics -- pulling the mix toward equal as it rises,
// so no single wave can run away with the shape. Equal thirds of a modest total
// is an irregular outline; one harmonic with all of it is a flower.
export const GREEN_SHAPE={gain:2.4,cap:.34};
export const BUNKER_SHAPE={gain:2.4,cap:.30};
export const shapeGain=(slider,limits)=>1+(clamp(slider??0,0,100)/100)*limits.gain;
// Pull a set of harmonic amplitudes toward equal, keeping each one's sign.
export function spreadHarmonics(waves,slider){
 const t=clamp(slider??0,0,100)/100;
 const sum=waves.reduce((a,w)=>a+Math.abs(w),0);
 if(sum<=1e-6)return waves.slice();
 const even=sum/waves.length;
 return waves.map(w=>{const sign=w<0?-1:1;return sign*(Math.abs(w)+(even-Math.abs(w))*t);});
}
export function holeLine(s,planned,rng){
 const par=planned.par;
 const greenSize=14+rng()*7,greenAspect=.95+rng()*.38;
 // THE OUTLINE IS SCALED, NOT REPLACED.
 //
 // A green's radius is its size times one plus three harmonics -- a two-lobed
 // wave, a three-lobed one and a five. The draws below are what they always
 // were, so every green keeps the character its seed gave it: which harmonic
 // leads, and which way round it sits. `greenShape` multiplies all three
 // together, which turns a rounded oval into lobes and a pinched waist without
 // making every green the same shape as every other.
 //
 // SCALING AT GENERATION IS WHY THE SHADER NEEDS NO CHANGE. The route texture
 // packs whatever the hole carries, so the painted green and the lie the ball
 // gets come from one set of numbers. Scaling at read time would have meant two
 // copies of this arithmetic, which is how the apron was painted as fairway and
 // played as semi-rough once already.
 let greenWave2=(rng()-.5)*.13,greenWave3=.025+rng()*.075,greenWave5=.015+rng()*.035;
 {
  const even=spreadHarmonics([greenWave2,greenWave3,greenWave5],s.greenShape);
  const k=shapeGain(s.greenShape,GREEN_SHAPE),sum=even.reduce((a,w)=>a+Math.abs(w),0);
  // The cap keeps the radius safely positive: at this total the narrowest point
  // of a green is still comfortably over half its nominal radius, so an outline
  // can pinch without folding through itself.
  const use=sum>1e-6?Math.min(k,GREEN_SHAPE.cap/sum):1;
  greenWave2=even[0]*use;greenWave3=even[1]*use;greenWave5=even[2]*use;
 }
 const phase=rng()*6.28;
 const isDogleg=par!==3&&!!planned.turnSign;
 const angle=isDogleg?planned.turnSign*(s.doglegAngle??45)*(.72+rng()*.28):0;
 const turnFraction=clamp((s.doglegPosition??55)/100+(rng()-.5)*.44,.20,.86),soft=.025+rng()*.045;
 const corner=t=>(t+Math.sqrt(t*t+soft*soft))/2,raw=u=>u-corner(u-turnFraction)/(1-turnFraction),r0=raw(0),r1=raw(1);
 let lo=0,hi=Math.abs(angle)*Math.PI/180;
 for(let i=0;i<35;i++){const a=(lo+hi)/2,b=Math.abs(angle)*Math.PI/180-a;if(turnFraction*Math.tan(a)>(1-turnFraction)*Math.tan(b))hi=a;else lo=a;}
 const slope=Math.sign(angle)*Math.tan((lo+hi)/2);
 const wiggles=Array.from({length:3},(_,i)=>({frequency:i+2,amplitude:(rng()-.5)*.018/(i+1)}));
 const unitCenter=u=>slope*(raw(u)-r0-(r1-r0)*u)+(isDogleg?wiggles.reduce((v,w)=>v+Math.sin(u*Math.PI*w.frequency)*w.amplitude,0):0);
 let arc=0;for(let i=0;i<1000;i++)arc+=Math.hypot(unitCenter((i+1)/1000)-unitCenter(i/1000),.001);
 const length=planned.yards*.9144/arc,pivot=length*turnFraction,center=z=>length*unitCenter(clamp(z/length,0,1));
 const shortHole=par===3;
 const tees=Object.fromEntries(enabledTees(s).map((name,i)=>{
  // THE SAME DRAWS IN THE SAME ORDER WHATEVER THE PAR. The short-hole branch
  // once took one number per tee where the long one took two, and that single
  // missing draw shifted everything downstream of it on the hole.
  const a=i===0?0:rng(),b=i===0?0:rng();
  const z=shortHole?i*(19+a*6):(i===0?0:length*(i*.09+(a-.5)*.032));
  const x=center(z)+(shortHole||i===0?0:(b-.5)*6);
  // Measured ALONG THE PLAYING LINE, so a dogleg is longer than the straight
  // gap to the green -- which is how a course measures itself.
  let d=0;for(let t=z;t<length;t+=1){const next=Math.min(length,t+1);d+=Math.hypot(center(next)-center(t),next-t);}
  return[name,{x,z,yards:d/.9144}];
 }));
 return {greenSize,greenAspect,greenWave2,greenWave3,greenWave5,
  phase,angle,isDogleg,turnFraction,soft,slope,unitCenter,arc,length,pivot,center,tees};
}

// The full card, before anything is built. Same seed, same numbers as the
// course that will be grown from it.
export function planScorecard(s={}){
 const plan=planCourse(s),seed=s.seed||'EVERGREEN';
 const holes=plan.holes.map((h,i)=>{
  const line=holeLine(s,h,rng(seed+':'+i));
  return {par:h.par,yards:Math.round(h.yards),
   tees:Object.fromEntries(Object.entries(line.tees).map(([k,t])=>[k,Math.round(t.yards)]))};
 });
 const sum=(from,to,tee)=>holes.slice(from,to).reduce((v,h)=>v+h.tees[tee],0);
 const half=Math.min(9,holes.length);
 // `yards` is the BACK TEE TOTAL OFF THIS CARD, not the plan's own sum. The
 // plan adds unrounded hole lengths and the card adds rounded ones, and a
 // headline that says 6,894 over a card totalling 6,893 is the kind of
 // one-yard disagreement that makes a reader distrust both numbers.
 return {...plan,holes,yards:sum(0,holes.length,plan.tees[0]),
  teeTotals:Object.fromEntries(plan.tees.map(t=>[t,{
   front:sum(0,half,t),back:holes.length>9?sum(9,holes.length,t):0,total:sum(0,holes.length,t)}]))};
}

// The shape of a putting surface.
//
// Anchored at the CENTRE of the green rather than at the cup, because the cup
// moves and the ground does not. Every term is zeroed at that anchor so the
// green meets the terrain it is blended into without a step.
//
// EACH GREEN HAS A CHARACTER (GENERATOR_VERSION 33). Every green used to be the
// same recipe -- a tilt, three crossing ridges drawn as rounded SQUARE waves, a
// dish and a tier -- with only the seed's angles changing. The square waves are
// shelves with short steep faces between them, so nearly every green carried
// one or two visible steps, and at a low sun each face lit up as a bright band
// across the surface: the owner's "tiered elevation on many of our greens".
// Now each green draws one character from its seed and is built from it:
//
//   rolling   three or four broad mounds and hollows, each a smooth dome
//   tiered    one real tier, a step with a face a few metres wide
//   ridged    a single spine or swale running across the green
//   crowned   a turtleback that sheds balls off every side
//   bowl      a dish that gathers them to the middle
//
// plus a drainage tilt on every green, mostly falling toward the approach the
// way architects build them, and a couple of small rolls so no green is clean.
// Only tiered greens have a step. Domes and swales have flat tops and floors,
// which is what keeps somewhere level enough to cut a hole on a severe green.
//
// FALSE FRONTS live here too, because they are part of the putting surface: the
// front few metres of the green, before the collar, falling away toward the
// fairway so a ball that lands short of the shelf rolls back off. The share of
// greens that get one is a setting; how far the front drops follows the green
// slope setting, so at 0 a green is still level.
//
// The slider is deliberately not linear. Most greens sit in the gentle half and
// the severe ones are outliers, so the curve keeps the bottom and middle close
// to where they were and spends the change at the top -- and since 33 the top
// reaches 60% further than it did, at the owner's request. See RESEARCH.md.
export function greenAmp(slider){
 return slider*(.60+.40*slider*slider)*1.90*(1+6.1*Math.max(0,slider-.4)**2);
}
export function greenContour(h,x,z){
 const slider=(h.settings.greenDifficulty??35)/100;
 const amp=greenAmp(slider);
 if(amp<=0)return 0;
 const anchor=h.green??h.pin,r=greenRecipe(h);
 const dx=x-anchor.x,dz=z-anchor.z;
 // A severe green's rolls are broader as well as taller: scaling only their
 // height at the top of the range packed a metre of relief into a few paces, and
 // the slope under a putt jumped more than 5% in a metre (tests/lab.test.mjs).
 const spread=1+1.2*Math.max(0,slider-.6);
 // The drainage tilt stops growing at about 70%: a severe green is severe in
 // its contours, not in leaning the whole surface -- scaled with everything else
 // a 100% green leaned 5-7% and had almost nowhere left level enough for a cup.
 const lean=Math.min(amp,1.3+.15*Math.max(0,amp-1.3));
 // And a tier's face widens as its step grows, so a severe tier is a steep
 // bank rather than a wall: at 100 a step of about a metre and a half has a face
 // two to three times as wide as a default one.
 const widen=Math.max(1,amp/2.5);
 let y=lean*(r.tx*dx+r.tz*dz)+amp*(greenShape(r,dx,dz,spread,widen)-r.zero);
 // The false front: along the line of play (local -z is toward the tee), from
 // just in front of where front hole locations stop to the edge and beyond, so
 // the collar and the approach keep falling with it.
 if(r.falseFront<(h.settings.falseFronts??0)/100){
  const reach=h.greenSize??17,start=-reach*.74,depth=r.frontDepth;
  y-=r.frontDrop*Math.pow(slider,.6)*smoothstep01((start-dz)/depth);
 }
 return y;
}
const smoothstep01=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
// How far the green and its collar stand above (or sink below) the ground
// around them, at `d` metres outside the green's edge (negative inside). The
// terrain blend in course.js adds this to the green's height: a raised green is
// a pedestal with banks falling away beyond the collar, a sunken one a dish the
// surrounds rise out of. Constant across the putting surface, so it changes
// nothing a putt can feel -- only what a chip has to climb or run down.
export function greenPedestal(h,d){
 const r=greenRecipe(h),s=h.settings;
 const raised=(s.raisedGreens??0)/100,sunken=(s.sunkenGreens??0)/100;
 let lift=0;
 if(r.type<raised)lift=r.raise;
 else if(r.type<Math.min(1,raised+sunken))lift=-r.sink;
 if(!lift)return 0;
 const collar=(s.fringe??2)+.4;
 return lift*(1-smoothstep01((d-collar)/r.bank));
}
// The per-green draws, made once and kept. Everything a green's shape depends on
// comes from the seed and the hole, never from the order greens are asked about,
// so the generation workers and the main thread build identical greens.
const RECIPES=new WeakMap();
function greenRecipe(h){
 let r=RECIPES.get(h);
 if(r)return r;
 const g=rng(`${h.seed??h.settings?.seed??'GREEN'}:green:${h.hole??0}`);
 const reach=h.greenSize??17,a=h.phase??0;
 const between=(lo,hi)=>lo+g()*(hi-lo),sign=()=>g()<.5?-1:1;
 // Drainage: two greens in three fall toward the approach, higher at the back.
 const back=g()<.66,tiltAngle=back?Math.PI/2+between(-.8,.8):g()*Math.PI*2,tilt=between(.016,.027);
 const pick=g(),character=pick<.32?'rolling':pick<.54?'tiered':pick<.74?'ridged':pick<.88?'crowned':'bowl';
 const mound=(amp,rlo,rhi,spread=.7)=>{const ang=g()*Math.PI*2,dist=Math.sqrt(g())*reach*spread;return {x:Math.cos(ang)*dist,z:Math.sin(ang)*dist,r:between(rlo,rhi),amp};};
 const mounds=[];
 if(character==='rolling')for(let i=0,n=3+(g()<.5?1:0);i<n;i++)mounds.push(mound(sign()*between(.12,.22),6,10.5));
 else for(let i=0;i<2;i++)mounds.push(mound(sign()*between(.05,.09),4.5,8));
 r={character,mounds,
  tx:Math.cos(tiltAngle)*tilt,tz:Math.sin(tiltAngle)*tilt,
  // tiered: a step across the green at its own angle, somewhere off centre.
  tierAngle:g()*Math.PI*2,tierAt:between(-.35,.35)*reach,tierFace:between(2.6,3.6),tierDrop:sign()*between(.16,.26),
  // ridged: a spine (positive) or swale (negative) with a smooth profile.
  ridgeAngle:g()*Math.PI*2,ridgeAt:between(-.3,.3)*reach,ridgeHalf:between(4,6.5),ridgeAmp:sign()*between(.12,.22),
  // crowned or bowl: the dish, broad enough to be the green's whole shape.
  dish:character==='crowned'?between(.20,.32):character==='bowl'?-between(.20,.30):0,dishR:between(12,16),
  // The types, drawn once and compared against the settings each time, so
  // moving a slider changes which greens qualify without redrawing any shape.
  type:g(),raise:between(.9,1.6),sink:between(.6,1.1),bank:between(5,8),
  falseFront:g(),frontDrop:between(.55,.9),frontDepth:between(3.2,4.8),
  phase:a};
 r.zero=greenShape(r,0,0);
 RECIPES.set(h,r);
 return r;
}
function greenShape(r,dx,dz,spread=1,widen=1){
 let y=0;
 dx/=spread;dz/=spread;
 for(const m of r.mounds){const q=((dx-m.x)**2+(dz-m.z)**2)/(m.r*m.r);y+=m.amp*Math.exp(-q);}
 if(r.character==='tiered'){
  const c=Math.cos(r.tierAngle),s=Math.sin(r.tierAngle),across=dx*c+dz*s-r.tierAt;
  y+=r.tierDrop*Math.tanh(across/(r.tierFace*widen)*1.6)*.5;
 }else if(r.character==='ridged'){
  const c=Math.cos(r.ridgeAngle),s=Math.sin(r.ridgeAngle),across=dx*c+dz*s-r.ridgeAt;
  y+=r.ridgeAmp*Math.exp(-(across*across)/(r.ridgeHalf*r.ridgeHalf));
 }
 if(r.dish){const q=(dx*dx+dz*dz)/(r.dishR*r.dishR);y+=r.dish*Math.exp(-q);}
 return y;
}
export function greenGradient(h,x,z){const e=.35;return{x:(h.height(x+e,z)-h.height(x-e,z))/(2*e),z:(h.height(x,z+e)-h.height(x,z-e))/(2*e)};}
// THE PUTTING CAMERA IS GONE. This used to swap `player` for a dedicated `putt`
// camera the moment the ball reached a green: eye 1.1 m up, 1.8 m behind the
// ball, field of view clamped to 53. It meant the camera you had set up was
// silently replaced on every green, and the Game camera panel appeared dead
// there because height, distance and offset were all being overridden.
//
// Kept as a function rather than deleted at its eleven call sites: it is the
// one place that decided this, and leaving it as identity means the decision
// stays in one place if it ever needs making again.
export function playCameraMode(mode,h,p){return mode;}
export function aimDelta(screenDirection,degrees){return -screenDirection*degrees;}
