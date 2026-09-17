// Yardages are measured along the playing line; the blue tee is the reference.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rng(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const TEE_COLORS={blue:'#4385d5',white:'#f4f2e7',red:'#d75c52'};
export function enabledTees(){return Object.keys(TEE_COLORS);}
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
 const target=clamp(Number(s.courseYards)||n*360,n*110,n*470);
 const par=Math.round(clamp(n*4+(target/n-370)*n/200,n*34/9,n*4));
 // Par stops changing at 68/72 (34/36 for nine). Distance continues scaling.
 const options=[];for(let fives=0;fives<=Math.ceil(n*.28);fives++){const threes=fives+n*4-par,fours=n-threes-fives;if(threes>=Math.min(1,n-1)&&threes<=Math.ceil(n*.4)&&fours>=n*.3)options.push({3:threes,4:fours,5:fives});}
 const counts=options[Math.floor(random()*options.length)],pars=Object.entries(counts).flatMap(([p,c])=>Array(c).fill(Number(p)));
 for(let i=pars.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pars[i],pars[j]]=[pars[j],pars[i]];}
 const holes=pars.map(par=>({par,yards:({3:165,4:385,5:545}[par])*(.75+random()*.5)})),total=holes.reduce((v,h)=>v+h.yards,0);
 for(const h of holes)h.yards*=target/total;
 const eligible=holes.map((h,i)=>({h,i,rank:random()})).filter(({h})=>h.par!==3).sort((a,b)=>a.rank-b.rank),count=Math.round(eligible.length*clamp(s.doglegs??65,0,100)/100),sign=random()<.5?-1:1;
 eligible.slice(0,count).forEach(({h},i)=>h.turnSign=sign*(i%2?-1:1));
 return {holes,counts,par,yards:target,tees:enabledTees(s)};
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
