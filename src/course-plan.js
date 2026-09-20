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
export function holeLine(s,planned,rng){
 const par=planned.par;
 const greenSize=14+rng()*7,greenAspect=.95+rng()*.38,
  greenWave2=(rng()-.5)*.13,greenWave3=.025+rng()*.075,greenWave5=.015+rng()*.035;
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
 return {...plan,holes,
  teeTotals:Object.fromEntries(plan.tees.map(t=>[t,{
   front:sum(0,half,t),back:holes.length>9?sum(9,holes.length,t):0,total:sum(0,holes.length,t)}]))};
}

// The shape of a putting surface.
//
// Anchored at the CENTRE of the green rather than at the cup, because the cup
// moves and the ground does not. Every term is zeroed at that anchor so the
// green meets the terrain it is blended into without a step.
//
// Four things are going on, and they are the four things a green architect
// actually builds:
//
//   TILT     the whole surface leaning, which is mostly drainage. Two or three
//            per cent is ordinary; five is severe.
//   RIDGES   crossing spines and swales that break the green into sections.
//   DISH     a bowl or a crown. A punchbowl gathers balls to the middle; a
//            turtleback sheds them off every side, which is what makes the
//            Pinehurst greens what they are. The seed decides which, and how far.
//   TIER     a step across the surface. Its face is the steepest ground a green
//            has, and a foot or two of drop over three or four paces is normal.
//
// The slider is deliberately not linear. A green architect's range is not evenly
// spread: most greens sit in the gentle half and the severe ones are outliers,
// so the curve keeps the bottom and middle close to where they were and spends
// the change at the top. See RESEARCH.md for what the numbers are anchored to.
export function greenContour(h,x,z){
 const slider=(h.settings.greenDifficulty??35)/100;
 const amp=slider*(.60+.40*slider*slider)*1.90;
 if(amp<=0)return 0;
 const anchor=h.green??h.pin,a=h.phase;
 const dx=x-anchor.x,dz=z-anchor.z,c=Math.cos(a),s=Math.sin(a);
 const u=dx*c+dz*s,v=-dx*s+dz*c;
 return amp*(greenShape(u,v,a)-greenShape(0,0,a));
}
// A rounded square wave. A green is not a sine: it is shelves with faces between
// them, and a ball has to be able to stop somewhere. Flattening the tops and
// steepening the transitions is what leaves ground worth cutting a hole on even
// when the surface as a whole is severe -- and it is also just what tiered greens
// look like.
const plateau=t=>Math.tanh(2.1*Math.sin(t))/Math.tanh(2.1);
function greenShape(u,v,a){
 const r=Math.hypot(u,v);
 const tilt=.0135*u+.0115*v*Math.sin(a*2.3);
 const ridges=.120*plateau(u/12+a)+.150*plateau(v/15+a*2)+.085*plateau((u+v)/14+a*1.3);
 // Positive is a crown, negative a punchbowl. Flat out at the rim so the edge of
 // the green is not a wall.
 const dish=.290*Math.sin(a*3.1)*Math.exp(-(r*r)/(17*17));
 // One tier, set somewhere off centre, running across the green at the seed's
 // angle. tanh gives a face about four metres wide rather than a cliff.
 const tier=.175*Math.sin(a*1.9)*Math.tanh((v-5.5*Math.sin(a*2.7))/2.4);
 return tilt+ridges+dish+tier;
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
