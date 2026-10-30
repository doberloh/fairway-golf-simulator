// THE ARCHITECT (architect-courses, phase 1, 30 October 2026;
// docs/ARCHITECT_COURSES.md).
//
// A Classic hole places its bunkers and ponds by chance: a fairway bunker at a
// uniformly random distance, on a random side. An architect places each one
// against a shot -- where a good player's drive lands, where an average one's
// does, where a par five is laid up -- and draws the fairway round them. This
// module is that decision, for one hole at a time, given its skeleton (the
// same `holeLine` Classic uses, so the card before the course still holds).
//
// What it returns is the hole's plan, in the shapes the rest of the pipeline
// already reads: the two fairway half-widths as functions, bunkers and ponds as
// the ovals the shader paints, and `design` -- the concept, the template if
// any, the preferred side and a reason for every hazard (the bench refuses a
// hazard without one; phase 2 shows them as the architect's notes).
//
// RANDOM NUMBERS ARE ITS OWN: one named stream per hole (`seed|arch|hole|n`),
// never Classic's, so nothing here can move a Classic course and a change on
// one hole moves no other (PROJECT_HANDOFF *TWO DESIGNERS, ONE WORLD*).
//
// Geometry it needs from course.js comes in as `geo` (greenDistance,
// ovalRadius, insideOval, fairwayWidth) rather than by import, which would
// make a cycle. Pure: no DOM, no three.js. tests/architect.test.mjs.
import {GOLFER_TABLE} from './golfer-table.js';
import {STYLES,styleOf,archStream} from './architect-styles.js';
import {GROUND_PLANTS} from './species.js';

const YD=.9144;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const gauss=(d,w)=>Math.exp(-(d*d)/(2*w*w));
// The shader paints at most twelve hazards a hole (ground.js HOLE_ATLAS).
export const MAX_HAZARDS=12;

// The concepts a hole can be built to, and the named templates (the study,
// workstream A). `par` lists where each fits.
export const CONCEPTS={
 strategic:{name:'Strategic',par:[4,5]},
 heroic:{name:'Heroic carry',par:[4,5]},
 penal:{name:'Penal',par:[3,4]},
 risk:{name:'Risk and reward',par:[4,5]},
 short:{name:'Short',par:[3]},
 threeShot:{name:'Three-shot par five',par:[5]},
};
export const TEMPLATES={
 redan:{name:'Redan',par:[3],note:'The green falls away from you on a diagonal behind a deep front bunker: land it short and let it run.'},
 eden:{name:'Eden',par:[3],note:'Bunkers on both sides and one behind: the middle of the green is the whole target.'},
 biarritz:{name:'Biarritz',par:[3],note:'A deep swale splits the green; the pin decides which half you must find.'},
 punchbowl:{name:'Punchbowl',par:[3,4],note:'The green sits in a hollow that gathers a ball in.'},
 plateau:{name:'Double plateau',par:[3,4],note:'A green on two levels: be on the pin\'s level, or face a putt up the step.'},
 road:{name:'Road',par:[4],note:'A bunker eats the green\'s front corner; come in from the far side of the fairway to open it up.'},
 cape:{name:'Cape',par:[4],note:'Bite off as much of the corner as you dare; the more you carry, the shorter the approach.'},
 nose:{name:"Principal's Nose",par:[4,5],note:'A pair of bunkers in the middle of the fairway; choose your side of them from the tee.'},
 leven:{name:'Leven',par:[4],note:'A short hole with trouble on the direct line; the long way round is the safe one.'},
 long:{name:'Long',par:[5],note:'Cross bunkers at the lay-up: decide how far to go with the second.'},
};

// Where one golfer's tee shot comes to rest along the playing line, from a tee
// at local z = `from`: arc length measured down the hole's own centre line.
function alongLine(center,from,metres,length){
 let d=0,z=from;
 while(z<length&&d<metres){const next=Math.min(length,z+1);d+=Math.hypot(center(next)-center(z),next-z);z=next;}
 return z;
}
// Where the drives come down on a hole -- any hole, Classic's too, which is how
// the bench measures whether bunkers sit where shots land (tools/metrics.mjs
// `design`). A good player from the back tee, an average one from the middle.
export function landingZones({center,length,tees}){
 const T=GOLFER_TABLE;
 const good=Math.min(length-95,alongLine(center,tees.blue?.z??0,T.good.clubs.driver.total*YD,length));
 const average=Math.min(length-110,alongLine(center,tees.white?.z??0,T.average.clubs.driver.total*YD,length));
 return {good,average};
}
function pick(rnd,weights){
 const entries=Object.entries(weights).filter(([,w])=>w>0),total=entries.reduce((a,[,w])=>a+w,0);
 let t=rnd()*total;for(const [k,w] of entries){t-=w;if(t<0)return k;}
 return entries[entries.length-1][0];
}

// The plan of one hole. `line` is holeLine's output; `s` the resolved
// settings (designer.js); `bio` the landscape record; `geo` course.js's shape
// functions.
export function designHole({s,hole,par,line,bio,geo}){
 // The landscape is in the name too, so one seed is not the same plan in
 // every landscape.
 const rnd=archStream(s.seed||'EVERGREEN','arch',s.biome||'',hole);
 const styleKey=styleOf(s),style=STYLES[styleKey],A=style.arch;
 const {length,center,tees,greenSize,greenAspect,greenWave2,greenWave3,greenWave5,phase,isDogleg,angle}=line;
 const green={x:center(length),z:length};
 const lean=z=>{const a=Math.max(0,z-.5),b=Math.min(length,z+.5);return b>a?(center(b)-center(a))/(b-a):0;};
 const base=s.width/2*(bio?.fairwayScale??1);
 const maxTeeZ=Math.max(...Object.values(tees).map(t=>t.z));

 // ---------------------------------------------------------------- the plan
 // The preferred side: the inside of a dogleg (the shorter way, the better
 // angle), else the seed's. Local +x is the player's LEFT.
 const inside=isDogleg?Math.sign(angle)||1:0;
 const preferred=inside||(rnd()<.5?-1:1);
 const wrong=-preferred;
 const yards=line.tees.blue?.yards??length/YD;
 // A carry needs something to carry: without inland water a heroic hole is a
 // strategic one.
 const wet=!!geo.inlandWater&&(s.water??0)>0,concepts={...A.concepts,heroic:wet?A.concepts.heroic:0};
 let concept,template=null;
 if(par===3){
  concept=rnd()<.15?'penal':'short';
  if(rnd()<A.template)template=pick(rnd,{redan:2,eden:1.5,biarritz:1,punchbowl:1,plateau:1});
 }else if(par===4){
  const drivable=yards<345;
  concept=drivable&&rnd()<.7?'risk':pick(rnd,concepts);
  if(rnd()<A.template)template=pick(rnd,{road:1.2,cape:isDogleg&&wet?2:0,nose:1,leven:drivable?1.5:0,punchbowl:.6,plateau:.6});
 }else{
  concept=rnd()<A.cross?'threeShot':pick(rnd,{strategic:concepts.strategic,risk:concepts.risk*1.5,heroic:concepts.heroic*.5});
  if(rnd()<A.template)template=pick(rnd,{long:concept==='threeShot'?2:.5,nose:1});
 }

 // ------------------------------------------------------- where shots land
 const table=GOLFER_TABLE,{good:goodZ,average:avgZ}=landingZones({center,length,tees});
 // A par five's lay-up: where an average golfer's second (a fairway wood)
 // comes down, measured from their drive.
 const layZ=par===5?Math.min(length-75,alongLine(center,avgZ,table.average.clubs.wood.total*YD,length)):null;
 const fairwayStart=Math.min(length*.54,maxTeeZ+14+rnd()*45);
 const mowStart=par===3?Math.max(maxTeeZ+22,length*.55,length-(greenSize+38)):fairwayStart;

 // ------------------------------------------------- the fairway, swelling at
 // the landing zones and necking before the green; tucks come after the
 // bunkers, round them.
 const swell=z=>par===3?.78:.82+.34*gauss(z-goodZ,28)+.26*gauss(z-avgZ,26)+(layZ?.22*gauss(z-layZ,24):0)
  -.22*smooth((z-(length-75))/35)*(1-smooth((z-(length-25))/20));
 const side=sign=>z=>base*swell(z)*Math.sqrt(1+lean(z)**2);
 const tucks={1:[],[-1]:[]};
 const tuckAt=(sign,z)=>{let w=Infinity;for(const t of tucks[sign]){const k=smooth(1-Math.abs(z-t.z)/(t.reach));if(k>0)w=Math.min(w,t.edge+(1-k)*60);}return w;};
 const half=sign=>{const raw=side(sign);return z=>{const w=raw(z),t=tuckAt(sign,z);return Math.max(base*.38,Math.min(w,t===Infinity?w:w-(w-Math.min(w,t))*1));};};
 const leftWidth=half(1),rightWidth=half(-1),width=z=>Math.max(leftWidth(z),rightWidth(z));
 const guide={fairwayStart,length,greenSize,greenAspect,leftWidth,rightWidth,width};

 // --------------------------------------------------------------- hazards
 const bunkers=[],ponds=[],reasons=[];
 const greenGuide={green,phase,greenSize,greenAspect,greenWave2,greenWave3,greenWave5};
 const size=(lo,hi)=>(lo+rnd()*(hi-lo))*A.size;
 const waves=b=>{b.phase=rnd()*6.28;b.wave2=(rnd()-.5)*.1;b.wave3=.025+rnd()*.08;
  // Classic's bunkerShape treatment: spread the waves toward even, scaled by
  // the style's raggedness, capped so an outline never folds.
  const t=clamp((s.bunkerShape??30)/100,0,1),sum=Math.abs(b.wave2)+Math.abs(b.wave3),even=sum/2;
  const w2=Math.sign(b.wave2||1)*(Math.abs(b.wave2)+(even-Math.abs(b.wave2))*t),w3=Math.sign(b.wave3)*(Math.abs(b.wave3)+(even-Math.abs(b.wave3))*t);
  const k=1+t*2.4,cap=.30,use=Math.min(k,cap/Math.max(1e-6,Math.abs(w2)+Math.abs(w3)));b.wave2=w2*use;b.wave3=w3*use;return b;};
 const clearOfTees=(x,z,r)=>!Object.values(tees).some(t=>Math.hypot(t.x-x,t.z-z)<r+11);
 const clearOfOthers=(x,z,r)=>!ponds.some(p=>geo.insideOval(x,z,p,r+3))&&!bunkers.some(b=>geo.insideOval(x,z,b,r+2));
 const room=()=>bunkers.length+ponds.length<MAX_HAZARDS;
 const addBunker=(b,why,{tuck=0}={})=>{
  if(!room()||!clearOfTees(b.x,b.z,Math.max(b.rx,b.rz))||!clearOfOthers(b.x,b.z,Math.max(b.rx,b.rz)))return false;
  bunkers.push(waves(b));reasons.push({kind:'bunker',i:bunkers.length-1,why});
  // Fairway tucks round a bunker on its edge: the mown line steps in to
  // leave a collar of rough between the turf and the sand.
  if(tuck){const off=Math.abs(b.x-center(b.z));tucks[tuck].push({z:b.z,edge:Math.max(base*.38,off-b.rx-2.2),reach:b.rz+16});}
  return true;
 };
 // A fairway bunker on `sign`'s side at z, biting `bite` of itself into where
 // the fairway would have been.
 const sideBunker=(sign,z,why,{bite=.35,rx=size(4.5,8),rz=size(6,12)}={})=>{
  if(z<fairwayStart+10||z>length-greenSize*1.5-rz)return false;
  const edge=side(sign)(z),x=center(z)+sign*(edge-bite*rx+rx);
  return addBunker({x,z,rx,rz,greenSide:false},why,{tuck:sign});
 };
 // Greenside: at an angle round the green, fitted to the fringe plus the gap
 // (Classic's binary search, so the turf between keeps its width).
 const greenBunker=(a,why,{rx=size(4,7.5),rz=size(4,8)}={})=>{
  const b={x:0,z:0,rx,rz,greenSide:true};waves(b);
  const target=(s.fringe??2)+(s.bunkerGap??2)+.04;let lo=0,hi=90;
  for(let j=0;j<16;j++){const r=(lo+hi)/2;b.x=green.x+Math.cos(a)*r*greenAspect;b.z=green.z+Math.sin(a)*r;let gap=Infinity;
   for(let k=0;k<64;k++){const q=geo.ovalRadius(b,k*Math.PI/32);gap=Math.min(gap,geo.greenDistance(greenGuide,b.x+q.x,b.z+q.z));}
   if(gap<target)lo=r;else hi=r;}
  const r=hi;b.x=green.x+Math.cos(a)*r*greenAspect;b.z=green.z+Math.sin(a)*r;
  if(!room()||!clearOfTees(b.x,b.z,Math.max(rx,rz))||!clearOfOthers(b.x,b.z,Math.max(rx,rz)))return false;
  bunkers.push(b);reasons.push({kind:'bunker',i:bunkers.length-1,why});return true;
 };
 // Angles round the green (local frame: -z toward the tee, +x the player's
 // left). Front is -PI/2.
 const FRONT=-Math.PI/2,frontOn=sign=>FRONT+sign*.55,sideOn=sign=>sign>0?Math.PI*.95:Math.PI*.05,back=Math.PI/2;

 const total=Math.max(1,s.bunkerCount??4);
 const sideName=sign=>sign>0?'left':'right';
 // The green's guard: the front corner on the wrong side always (from the
 // preferred side the green opens), then the style's count.
 const guardGreen=n=>{
  greenBunker(frontOn(wrong),`Guards the front ${sideName(wrong)} of the green, so an approach from the ${sideName(wrong)} side has to carry sand; from the ${sideName(preferred)} the green opens up.`);
  const extra=[[sideOn(wrong),`Catches the approach that misses ${sideName(wrong)}.`],[back,'Behind the green, for the shot hit too firm.'],[frontOn(preferred)+.25,`A smaller one front ${sideName(preferred)}, so even the good angle asks for a precise shot.`],[sideOn(preferred),`Beside the green on the ${sideName(preferred)}.`]];
  for(let i=0;i<n-1&&i<extra.length;i++)greenBunker(extra[i][0],extra[i][1],i===2?{rx:size(3,5),rz:size(3,5)}:{});
 };

 // ----------------------------------------------------------------- water
 // First, so the bunkers are placed round it rather than refusing it.
 // A heroic or cape hole always has its water; any other by the style's share.
 const wantPond=wet&&(concept==='heroic'||template==='cape'||rnd()*100<(s.water??0)*1.15);
 if(wantPond){
  let zPond,sidePond,why,reach=0,rx,rz;
  if(template==='cape'||concept==='heroic'){
   zPond=Math.max(fairwayStart+20,goodZ-30);sidePond=preferred;reach=.45;rx=size(20,34);rz=Math.min(size(30,55),length*.25);
   why=`Water on the ${sideName(preferred)} from about a good drive back: the more of it you carry, the better the angle and the shorter the approach.`;
  }else if(concept==='risk'&&par===5){
   zPond=length-greenSize*1.5-40;sidePond=wrong;reach=.35;rx=size(18,30);rz=Math.min(size(26,40),length*.2);
   why='Guards the go-for-it second: the green can be reached in two, past this.';
  }else if(par===3){
   zPond=length-greenSize-24;sidePond=preferred;reach=.3;rx=size(16,26);rz=Math.min(size(18,26),length*.3);
   why=`The short side of the green is water, on the ${sideName(preferred)}.`;
  }else{
   zPond=avgZ+20;sidePond=wrong;reach=.2;rx=size(18,30);rz=Math.min(size(25,45),length*.25);
   why=`Along the ${sideName(wrong)} past the average drive: the bail-out side has its own price.`;
  }
  const p=geo.pondAt({guide,center,z:zPond,side:sidePond,rx,rz,reach,phase:rnd()*6.28,variation:[rnd(),rnd(),rnd(),rnd()],gapRand:rnd(),depthRand:rnd(),greenGuide,tees,ponds,fairwayStart,length,greenSize,s});
  if(p&&room()){ponds.push(p);reasons.push({kind:'pond',i:ponds.length-1,why});}
 }


 // A hole with water in play carries one bunker fewer.
 const sand=Math.max(1,total-(ponds.length?1:0));
 if(par===3){
  if(template==='redan'){
   greenBunker(frontOn(preferred)+.15,`The Redan's deep front bunker on the ${sideName(preferred)}: the green falls away behind it, so a shot landed short and right of it feeds on.`,{rx:size(6,9),rz:size(4,6)});
   greenBunker(back+wrong*.4,'Behind the high side, for the shot that runs through.');
  }else if(template==='eden'){
   greenBunker(sideOn(1),'Eden: the left bunker. Only the middle of the green is safe.');
   greenBunker(sideOn(-1),'Eden: the right bunker.');
   greenBunker(back,'Eden: the bunker behind, for the shot that runs long.',{rx:size(7,10),rz:size(3,5)});
  }else{
   guardGreen(clamp(Math.round(sand*.7),2,4));
  }
 }else{
  const lzShare=A.lz,lzCount=clamp(Math.round(sand*lzShare),1,3),greenCount=clamp(sand-lzCount,1,4);
  // The drive.
  if(template==='nose'){
   // Two bunkers side by side with a nose of grass between them, placed
   // through the shared-hazard check as a pair (each would refuse the other).
   const z=Math.min(goodZ-15,avgZ+25),x=center(z),rx=size(2.8,4),rz=size(4,6),gap=rx+1.6;
   if(room()&&bunkers.length+ponds.length+2<=MAX_HAZARDS&&clearOfTees(x,z,gap+rx)&&clearOfOthers(x,z,gap+rx)){
    for(const [dx,dz,why] of [[gap,0,"The Principal's Nose: one of a pair in the middle of the fairway, a grassy nose between them. Choose a side from the tee."],[-gap,2,"The Nose's twin, on the other side of the grass between them."]]){
     bunkers.push(waves({x:x+dx,z:z+dz,rx,rz,greenSide:false}));reasons.push({kind:'bunker',i:bunkers.length-1,why});}
   }
  }else if(rnd()<A.centre){
   const z=Math.min(goodZ-10,avgZ+30);
   addBunker({x:center(z)+(rnd()-.5)*4,z,rx:size(3,5),rz:size(4,7),greenSide:false},'A centreline bunker where a good drive would land: go left of it or right, and either way the approach changes.');
  }
  if(concept==='strategic'||concept==='penal'||concept==='threeShot'||concept==='heroic'){
   sideBunker(preferred,goodZ+4,`Where a good player's drive lands, on the ${sideName(preferred)} -- the side with the better angle in. The better line is guarded.`);
   if(lzCount>1)sideBunker(wrong,avgZ-6,`On the ${sideName(wrong)} at the average golfer's distance, shorter than the first, so the safe side has its own question.`);
   if(lzCount>2)sideBunker(preferred,avgZ+2,`A second on the ${sideName(preferred)} for the shorter hitter who aims the same way.`,{bite:.2});
  }else if(concept==='risk'){
   if(par===4){
    // A drivable par four: the direct line is narrowed; the lay-up is wide.
    sideBunker(preferred,length-70,`On the direct line to the green: the drive that goes for it has to clear this.`,{bite:.55});
    sideBunker(wrong,length-55,`Pinches the green's approach from the ${sideName(wrong)}.`,{bite:.45});
   }else{
    sideBunker(preferred,goodZ+4,`The drive that sets up a go at the green in two has to flirt with this.`);
   }
  }
  // The par five's lay-up.
  if(par===5&&(concept==='threeShot'||template==='long')&&layZ){
   const span=[-1,0,1].map(k=>k*9);
   let placed=0;
   for(const dx of span){if(dx*preferred>8)continue;
    if(addBunker({x:center(layZ)+dx,z:layZ+(dx*wrong)*.6,rx:size(4,6),rz:size(3,4.5),greenSide:false},
     'A cross bunker at the lay-up: lay up short of it, or carry it to set up a short third.'))placed++;}
  }
  guardGreen(greenCount);
 }
 if(template==='road'){
  greenBunker(FRONT+preferred*.3,'The Road bunker: it eats into the front of the green on the near side; come in from the far side of the fairway.',{rx:size(3.5,5),rz:size(4,5)});
 }

 // ------------------------------------------------------------ the design
 const t=template?TEMPLATES[template]:null;
 const note=t?t.note:par===3?'A short hole: the green is the target, and its bunkers decide where to miss.'
  :concept==='strategic'?`Favour the ${sideName(preferred)}: the green opens from there, and the bunkers make you pay for it.`
  :concept==='heroic'?`A carry from the tee: take on as much as you dare from the ${sideName(preferred)}.`
  :concept==='risk'?(par===4?'Short enough to drive: the green is there for the taking, the trouble too.':'Reachable in two for the long hitter, past the water; three shots for everyone else.')
  :concept==='threeShot'?'Three shots: the lay-up decides how short the third is.':'Penal: the trouble is on the line, and there is no way round it -- only over it.';
 const design={style:styleKey,concept,template,preferred:sideName(preferred),note,reasons,
  zones:{good:goodZ,average:avgZ,layup:layZ},
  // Green overrides read by course-plan.js greenRecipe (Architect holes only).
  green:greenPlan(template,rnd,preferred)};
 return {leftWidth,rightWidth,width,fairwayStart,mowStart,bunkers,ponds,design};
}

// What a template asks of its green. Undefined fields keep the green's own
// seeded recipe.
function greenPlan(template,rnd,preferred){
 if(template==='redan')return {character:'tilted',tiltAway:true,tiltSide:-preferred};
 if(template==='biarritz')return {character:'ridged',ridgeAmp:-.26,ridgeAngle:Math.PI/2,ridgeAt:0,ridgeHalf:3.2};
 if(template==='punchbowl')return {pedestal:'sunken'};
 if(template==='plateau')return {character:'tiered'};
 // Every Architect green drains off two sides at least, never all off the
 // front: the tilt falls toward a front corner (the study, *The green,
 // designed*).
 return {drainCorner:rnd()<.5?1:-1};
}

// PLANTED BY DESIGN (the study, workstream J): avenues and dogleg corners, as
// candidate trees in world coordinates -- course.js puts each through the rules
// every tree obeys (the ground, houses, the tee's shot and view, room for
// each other) before it stands. One species per avenue, all one size, as a
// row planted in one season would be.
//   - An avenue lines a par 4 or 5 on a Parkland, Golden Age or Raynor course,
//     more often the older it is (an Old course about three holes in five, a
//     Mature one about one in three; a New course's are still saplings and a
//     Restored course has felled them -- phase 6 leaves their stumps). PLACED.
//   - A dogleg's inside corner gets a cluster of three to five trees just
//     beyond the rough, on any style with trees.
export function designedPlanting({holes,s,bio,treeSize}){
 const out=[];
 const main=(bio.plants||[]).filter(([k])=>!GROUND_PLANTS.has(k)).sort((a,b)=>b[1]-a[1])[0]?.[0];
 if(!main||(s.trees??0)<=0)return out;
 const avenueStyles=new Set(['parkland','golden','raynor']),age=s.archAge||'mature';
 const avenueShare=age==='old'?.6:age==='mature'?.35:0;
 for(const h of holes){
  const d=h.design;if(!d||h.par===3)continue;
  const rnd=archStream(s.seed||'EVERGREEN','arch','planting',s.biome||'',h.hole);
  const semi=s.semiRough??6;
  if(avenueStyles.has(d.style)&&rnd()<avenueShare){
   const sides=rnd()<.6?[1,-1]:[rnd()<.5?1:-1],step=13+rnd()*5,size=treeSize(main,.55+rnd()*.2,.5),stop=h.length-70;
   for(const side of sides)for(let z=h.fairwayStart+15;z<stop;z+=step){
    const w=side>0?h.leftWidth(z):h.rightWidth(z),p=h.toWorld({x:h.center(z)+side*(w+semi+11),z});
    out.push({x:p.x,z:p.z,kind:main,h:size.h,r:size.r,shade:rnd(),hole:h.hole,why:'avenue'});
   }
  }
  const turn=h.doglegAngle||0;
  if(Math.abs(turn)>8){
   const side=Math.sign(turn),pivot=h.length*(h.turnFraction??.55),n=3+Math.floor(rnd()*3);
   const w=side>0?h.leftWidth(pivot):h.rightWidth(pivot);
   for(let i=0;i<n;i++){
    const zz=pivot+(rnd()-.5)*24,x=h.center(zz)+side*(w+semi+9+rnd()*10),p=h.toWorld({x,z:zz}),sz=treeSize(main,.6+rnd()*.3,rnd());
    out.push({x:p.x,z:p.z,kind:main,h:sz.h,r:sz.r,shade:rnd(),hole:h.hole,why:'corner'});
   }
  }
 }
 return out;
}

// THE SEQUENCE (the study, *The sequence of holes*): what an architect does with
// the card Classic's planner hands over, before anything is built -- so the card
// before the course still holds. On its own stream; the total length kept.
//   - a gentle opener: the first hole a par 4 of at most 400 yd where it is one
//   - a strong finish: the last hole a long par 4 (420 yd or more) or a par 5
//   - on eighteen, a short par 4 on the back nine (at most 350 yd), drivable
//     for the long hitter
//   - the par 3s at clearly different lengths, spread across their band
// PLACED, all of them: real routings break every one of these somewhere.
export function sequenceCourse(holes,rnd,PAR_YARDS){
 const n=holes.length,total=holes.reduce((v,h)=>v+h.yards,0),fixed=new Set();
 const set=(i,y)=>{const b=PAR_YARDS[holes[i].par];holes[i].yards=clamp(y,b.min,b.max);fixed.add(i);};
 if(holes[0].par===4&&holes[0].yards>400)set(0,360+rnd()*40);
 const last=n-1;
 if(holes[last].par===4&&holes[last].yards<420)set(last,425+rnd()*45);
 if(n>=18){
  const back=holes.map((h,i)=>({h,i})).filter(({h,i})=>i>=9&&i<last&&h.par===4);
  if(back.length&&!back.some(({h})=>h.yards<=350)){const pick=back[Math.floor(rnd()*back.length)];set(pick.i,315+rnd()*35);}
 }
 const threes=holes.map((h,i)=>({h,i})).filter(({h})=>h.par===3).sort((a,b)=>a.h.yards-b.h.yards);
 if(threes.length>1){
  const b=PAR_YARDS[3],lo=b.min+25,hi=b.max-25;
  threes.forEach(({i},k)=>set(i,lo+(hi-lo)*(k/(threes.length-1))*(.85+.15*rnd())));
 }
 // Put the total back on the holes left free, in proportion to their room.
 for(let pass=0;pass<8;pass++){
  const gap=total-holes.reduce((v,h)=>v+h.yards,0);
  if(Math.abs(gap)<.5)break;
  const free=holes.map((h,i)=>fixed.has(i)?0:gap>0?PAR_YARDS[h.par].max-h.yards:h.yards-PAR_YARDS[h.par].min);
  const pool=free.reduce((a,b)=>a+b,0);if(pool<1e-6)break;
  holes.forEach((h,i)=>{if(fixed.has(i))return;const b=PAR_YARDS[h.par];h.yards=clamp(h.yards+gap*free[i]/pool,b.min,b.max);});
 }
 return holes;
}
