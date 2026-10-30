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
 // The land's templates (phase 6): a landform makes the hole.
 dell:{name:'Dell',par:[3],note:'Blind: the green hides in a hollow behind the dune. Aim over the white stone on the ridge.'},
 alps:{name:'Alps',par:[4],note:'The approach is blind over a great ridge, with a bunker waiting beyond it: trust the line.'},
 barranca:{name:'Barranca',par:[4],note:'A ravine crosses the hole short of the green: the approach must carry it, or lay up short.'},
 pit:{name:'Pit',par:[4],note:'A stone wall crosses the front of the green, which sits sunk behind it: carry the wall, and stop the ball quickly.'},
};

const DUNE_STYLES=new Set(['links','sandhills','heathland','golden','raynor']),CLASSIC_STYLES=new Set(['golden','raynor','links']);

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
 // THE LAND'S SIGNATURE (biomes.js ARCHITECT, `signature`): the templates a
 // landscape suggests -- a Dell between Links dunes, an Alps over a PNW crag, a
 // Barranca between Desert mesas -- at two and a half times their odds there
 // (PLACED). A template the style rules out (odds 0) stays out.
 const signature=new Set(bio?.architect?.signature||[]);
 const pickTemplate=w=>pick(rnd,Object.fromEntries(Object.entries(w).map(([k,v])=>[k,signature.has(k)?v*2.5:v])));
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
  if(rnd()<A.template)template=pickTemplate({redan:2,eden:1.5,biarritz:1,punchbowl:1,plateau:1,dell:DUNE_STYLES.has(styleKey)?1.4:.3});
 }else if(par===4){
  const drivable=yards<345;
  concept=drivable&&rnd()<.7?'risk':pick(rnd,concepts);
  if(rnd()<A.template)template=pickTemplate({road:1.2,cape:isDogleg&&wet?2:0,nose:1,leven:drivable?1.5:0,punchbowl:.6,plateau:.6,alps:CLASSIC_STYLES.has(styleKey)?1.2:.3,barranca:drivable?0:.9,pit:DUNE_STYLES.has(styleKey)?.9:0});
 }else{
  concept=rnd()<A.cross?'threeShot':pick(rnd,{strategic:concepts.strategic,risk:concepts.risk*1.5,heroic:concepts.heroic*.5});
  if(rnd()<A.template)template=pickTemplate({long:concept==='threeShot'?2:.5,nose:1});
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
 const leftWidth=half(-1),rightWidth=half(1),width=z=>Math.max(leftWidth(z),rightWidth(z));
 const guide={fairwayStart,length,greenSize,greenAspect,leftWidth,rightWidth,width};

 // --------------------------------------------------------------- hazards
 const bunkers=[],ponds=[],reasons=[],collections=[];
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
 const room=()=>bunkers.length+ponds.length+collections.length<MAX_HAZARDS;
 const addBunker=(b,why,{tuck=0}={})=>{
  if(!room()||!clearOfTees(b.x,b.z,Math.max(b.rx,b.rz))||!clearOfOthers(b.x,b.z,Math.max(b.rx,b.rz)))return false;
  bunkers.push(waves(b));reasons.push({kind:'bunker',i:bunkers.length-1,why});
  lobes(b);
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
 // A BUNKER COMPLEX (phase 3; the study, workstream C): on a style of big
 // ragged bunkers -- Heathland & Sandbelt, Sandhills, Golden Age, Modern,
 // Minimalist -- a large bunker grows one or two lobes, smaller ovals over its
 // rim, so the sand has capes and bays rather than one oval's outline. Each is
 // a hazard of its own (a slot of the shader's twelve) with its reason.
 const lobeStyles=new Set(['heathland','sandhills','golden','modern','minimalist']);
 const lobes=b=>{
  // One lobe, on about half the bigger bunkers (51 on nine holes was the
  // first count: it doubled the sand).
  if(!lobeStyles.has(styleKey)||Math.max(b.rx,b.rz)<7||rnd()>.5)return;
  const n=1;
  for(let k=0;k<n&&room();k++){
   // A fairway bunker's lobe grows away from the fairway, so the mown edge
   // tucked round the bunker still clears its sand; a greenside one's anywhere.
   const out=Math.sign(b.x-center(b.z))||1,wild=rnd();
   const a=b.greenSide||Math.abs(b.x-center(b.z))<6?wild*Math.PI*2:(out>0?0:Math.PI)+(wild-.5)*1.6;
   const e=geo.ovalRadius(b,a),r=Math.hypot(e.x,e.z)*.78,sc=.38+rnd()*.2;
   const l={x:b.x+Math.cos(a)*r,z:b.z+Math.sin(a)*r,rx:b.rx*sc,rz:b.rz*sc,greenSide:b.greenSide,lobe:true};
   if(!clearOfTees(l.x,l.z,Math.max(l.rx,l.rz))||ponds.some(p=>geo.insideOval(l.x,l.z,p,Math.max(l.rx,l.rz)+3)))continue;
   if(b.greenSide&&geo.greenDistance(greenGuide,l.x,l.z)<(s.fringe??2)+Math.max(l.rx,l.rz)+.5)continue;
   bunkers.push(waves(l));reasons.push({kind:'bunker',i:bunkers.length-1,why:'A lobe of the bunker beside it: the complex has capes and bays, not one oval.'});
  }
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
  bunkers.push(b);reasons.push({kind:'bunker',i:bunkers.length-1,why});lobes(b);return true;
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

 // THE LAND'S TEMPLATES (phase 6; the study, workstreams A and L): holes whose
 // character is a landform, recorded as earthworks in the hole's frame, which
 // course.js adds to the ground with the mounds (`earthField`).
 //   Dell      a dune across the line short of the green, the green sunk in
 //             the hollow behind it: blind, aimed over a white stone
 //   Alps      a great ridge across the fairway short of the green, a bunker
 //             waiting beyond it: the approach is blind
 //   Barranca  a ravine across the hole between the drive and the green; the
 //             fairway stops at its lips (`gaps`), the cart path bridges it
 //   Pit       a dry-stone wall across the front of a sunken green (North
 //             Berwick's 13th), solid and in play (`walls`; story.js draws
 //             and physics.js stops a ball against it)
 // All sizes PLACED.
 const earthworks=[],gaps=[],walls=[];
 const across=z=>Math.max(leftWidth(z),rightWidth(z));
 if(template==='dell'){
  const z=length-greenSize-15;
  earthworks.push({kind:'ridge',z,half:across(z)+greenSize+18,r:9,h:3.6,aim:true,why:'The Dell\'s dune: it hides the green in the hollow behind it. A white stone on its crest gives the line.'});
 }else if(template==='alps'){
  const z=length-greenSize-42;
  // A broad hill, not a bank (the owner's review, PNW: "a really weird look"
  // -- it was 13 m wide for 5.5 m high, a 66% face and a crease at the
  // crest): 24 m for 5 m, about a third. PLACED.
  earthworks.push({kind:'ridge',z,half:across(z)+30,r:24,h:5,why:'The Alps: a great ridge across the fairway short of the green, so the approach is played blind over it.'});
  greenBunker(FRONT,'Beyond the Alps, a bunker across the front of the green for the approach that does not quite carry.',{rx:size(7,10),rz:size(3,4.5)});
 }else if(template==='barranca'){
  const r=12,z=clamp(goodZ+35,fairwayStart+45,length-greenSize-45);
  earthworks.push({kind:'ravine',z,half:across(z)+45,r,depth:4.5,floor:4,why:'The barranca: a ravine across the hole between the drive and the green. Carry it with the approach, or lay up short of it.'});
  gaps.push([z-r*.8,z+r*.8]);
 }else if(template==='pit'){
  walls.push({z:length-greenSize-7,half:greenSize*greenAspect+6,why:'The Pit: a stone wall across the front of the green, which sits sunk behind it. Carry the wall.'});
 }
 for(const w of walls)reasons.push({kind:'wall',i:walls.indexOf(w),why:w.why});
 for(const e of earthworks)reasons.push({kind:'earthwork',i:earthworks.indexOf(e),why:e.why});

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
  green:greenPlan(template,rnd,preferred),earthworks,walls};
 // A COLLECTION AREA (phase 3; the study, workstream D; USGA: short grass that
 // carries a miss away from the green): on a style that plays along the
 // ground, mown fairway beyond the fringe off the front corner the green
 // drains toward. The shader paints it from a hazard slot (kind -1) and the lie
 // reads it (course.js localSurface). Bunkers already there paint over it.
 const groundGame=new Set(['links','sandhills','minimalist','golden','heathland','raynor']);
 const c=design.green.drainCorner;
 if(c&&groundGame.has(styleKey)&&room()){
  const gr=greenSize*greenAspect,rx=greenSize*(.55+rnd()*.2),rz=greenSize*(.4+rnd()*.15);
  const off=gr+(s.fringe??2)+Math.max(rx,rz)*.55,ph=rnd()*6.28,w2=(rnd()-.5)*.08,w3=.03+rnd()*.05;
  // The low front corner; the other front corner if a bunker already sits there.
  const at=k=>({x:green.x+.56*k*off,z:green.z-.83*off,rx,rz,phase:ph,wave2:w2,wave3:w3,collection:true});
  const sandy=q=>bunkers.some(b=>Math.hypot(b.x-q.x,b.z-q.z)<Math.max(b.rx,b.rz)+Math.max(rx,rz)*.6);
  const col=sandy(at(c))?at(-c):at(c);
  if(!sandy(col)&&clearOfTees(col.x,col.z,Math.max(rx,rz))&&!ponds.some(p=>geo.insideOval(col.x,col.z,p,Math.max(rx,rz)+2))){collections.push(col);reasons.push({kind:'collection',i:0,why:'A collection area on the low side: a miss there runs away from the green, down short grass.'});}
 }
 // THE WIDTHS AS TABLES (phase 4: the closures above, swell and tucks, were
 // 2.5 s of an Island course's build, asked millions of times by `nearest`).
 // Sampled every half metre from 60 m behind the tee to 60 m past the green,
 // linearly between, held at the ends: the curves are smooth at that scale.
 const STEP=.5,Z0=-60,N=Math.ceil((length+120)/STEP)+1,L=new Float32Array(N),R=new Float32Array(N);
 for(let k=0;k<N;k++){const z=Z0+k*STEP;L[k]=leftWidth(z);R[k]=rightWidth(z);}
 const lookup=T=>z=>{const u=(z-Z0)/STEP;if(u<=0)return T[0];if(u>=N-1)return T[N-1];const k=Math.floor(u),f=u-k;return T[k]+(T[k+1]-T[k])*f;};
 const fastLeft=lookup(L),fastRight=lookup(R);
 return {leftWidth:fastLeft,rightWidth:fastRight,width:z=>Math.max(fastLeft(z),fastRight(z)),fairwayStart,mowStart,bunkers,ponds,collections,design,gaps};
}

// What a template asks of its green. Undefined fields keep the green's own
// seeded recipe.
function greenPlan(template,rnd,preferred){
 if(template==='redan')return {character:'tilted',tiltAway:true,tiltSide:-preferred};
 if(template==='biarritz')return {character:'ridged',ridgeAmp:-.26,ridgeAngle:Math.PI/2,ridgeAt:0,ridgeHalf:3.2};
 if(template==='punchbowl'||template==='dell'||template==='pit')return {pedestal:'sunken'};
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
 // A Restored course felled the mid-century avenue (the study, workstream
 // O): its line is drawn as before and left as stumps.
 const avenueShare=age==='old'?.6:age==='mature'?.35:age==='restored'?.4:0,felled=age==='restored';
 for(const h of holes){
  const d=h.design;if(!d||h.par===3)continue;
  const rnd=archStream(s.seed||'EVERGREEN','arch','planting',s.biome||'',h.hole);
  const semi=s.semiRough??6;
  // A FELLED AVENUE'S STUMPS, SCATTERED (the owner's review: stumps in a line
  // down the fairway "is not right"; they stand where trees were taken out
  // to open the views -- here and there in the rough, a few in a group, not
  // an avenue's even row). Three to seven a hole, 6 to 40 m past the
  // semi-rough, either side; a third in pairs. PLACED.
  if(felled&&avenueStyles.has(d.style)&&rnd()<.75){
   const n=3+Math.floor(rnd()*5),stop=h.length-50;
   for(let i=0;i<n;i++){
    const z=h.fairwayStart+rnd()*Math.max(10,stop-h.fairwayStart),side=rnd()<.5?-1:1,w=side<0?h.leftWidth(z):h.rightWidth(z),off=w+semi+6+rnd()*34;
    const p=h.toWorld({x:h.center(z)+side*off,z});
    out.push({x:p.x,z:p.z,kind:main,h:1,r:1,shade:rnd(),hole:h.hole,why:'stump'});
    if(rnd()<.33){const q=h.toWorld({x:h.center(z)+side*(off+2+rnd()*4),z:z+(rnd()-.5)*8});out.push({x:q.x,z:q.z,kind:main,h:1,r:1,shade:rnd(),hole:h.hole,why:'stump'});}
   }
  }else if(avenueStyles.has(d.style)&&rnd()<avenueShare){
   const sides=rnd()<.6?[1,-1]:[rnd()<.5?1:-1],step=13+rnd()*5,size=treeSize(main,.55+rnd()*.2,.5),stop=h.length-70;
   for(const side of sides)for(let z=h.fairwayStart+15;z<stop;z+=step){
    const w=side<0?h.leftWidth(z):h.rightWidth(z),p=h.toWorld({x:h.center(z)+side*(w+semi+11),z});
    out.push({x:p.x,z:p.z,kind:main,h:size.h,r:size.r,shade:rnd(),hole:h.hole,why:'avenue'});
   }
  }
  const turn=h.doglegAngle||0;
  if(Math.abs(turn)>8){
   const side=Math.sign(turn),pivot=h.length*(h.turnFraction??.55),n=3+Math.floor(rnd()*3);
   const w=side<0?h.leftWidth(pivot):h.rightWidth(pivot);
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

// EARTHWORKS: MOUNDS BY STYLE (phase 5; the study, workstream E). What a
// construction crew shapes beside play, in world coordinates, as smooth bumps
// course.js adds to the ground at the end of `analyticHeight` (Architect
// only). Each style its own (PLACED, all sizes):
//   framing      Modern, Parkland, Tropical: long low mounds beyond the rough
//                along the landing zones and beside the green, 1-2.2 m
//   spectator    Stadium: big grassy banks behind and beside the greens, 2.5-4 m
//   drops        Golden Age, Raynor: "chocolate drops", small steep round
//                mounds in clusters near the greens, 1.4-2.4 m
//   none         Links, Sandhills, Minimalist, Desert, Heathland, Mountain:
//                the land as found
// Every mound is kept clear of tees, greens, the fairway and semi-rough,
// bunkers and ponds, so nothing flattened or carved is disturbed.
const MOUND_STYLE = {modern: 'framing', parkland: 'framing', tropical: 'framing', stadium: 'spectator', golden: 'drops', raynor: 'drops'};
// GRASSED-OVER BUNKERS (phase 6; the study, workstream O): a hollow where a
// bunker was, kept its shape and grassed -- a cheaper thing to mow than to
// rake, so most on a Municipal course and an Old or Restored one. A shallow
// bowl (0.8 m, PLACED) beside the fairway past the semi-rough, on their own
// stream, clear of play like a mound.
const HOLLOW_SHARE = {municipal: .5, old: .35, restored: .3};
export function designMounds(holes, s) {
 const kind = MOUND_STYLE[styleOf(s)], hollows = Math.max(HOLLOW_SHARE[s.archClub] ?? 0, HOLLOW_SHARE[s.archAge] ?? 0);
 if (!kind && !hollows) return [];
 const out = [], semi = s.semiRough ?? 6;
 for (const h of holes) {
  const rnd = archStream(s.seed || 'EVERGREEN', 'arch', 'mounds', s.biome || '', h.hole);
  const old = archStream(s.seed || 'EVERGREEN', 'arch', 'hollows', s.biome || '', h.hole);
  const gr = (h.greenSize ?? 14) * (h.greenAspect ?? 1.1) + (s.fringe ?? 2) + semi;
  // Clear of every hole, not only its own: a mound in one hole's rough can
  // stand on the next one's fairway.
  const clear = (x0, z0, r) => {
   const w = h.toWorld({x: x0, z: z0});
   for (const o of holes) {
    const {x, z} = o.toLocal(w), og = (o.greenSize ?? 14) * (o.greenAspect ?? 1.1) + (s.fringe ?? 2) + semi;
    if (Object.values(o.tees).some(t => Math.hypot(t.x - x, t.z - z) < r + 24)) return false;
    if (Math.hypot(x - o.green.x, z - o.green.z) < og + r + 5) return false;
    if (z > -r - 10 && z < o.length + r + 10) {
     const zc = Math.max(0, Math.min(o.length, z)), half = Math.max(o.leftWidth(zc), o.rightWidth(zc));
     if (Math.abs(x - o.center(zc)) < half + semi + r + 4) return false;
    }
    if (o.bunkers.some(b => Math.hypot(b.x - x, b.z - z) < Math.max(b.rx, b.rz) + r + 5)) return false;
    if (o.ponds.some(p => Math.hypot(p.x - x, p.z - z) < Math.max(p.rx, p.rz) + r + 14)) return false;
   }
   return true;
  };
  const add = (x, z, r, ht, why) => { if (clear(x, z, r)) { const p = h.toWorld({x, z}); out.push({x: p.x, z: p.z, r, h: ht, ...(why ? {why} : {})}); } };
  if (hollows && h.par > 3 && old() < hollows) {
   const z = h.length * (.4 + old() * .25), side = old() < .5 ? -1 : 1, half = side < 0 ? h.leftWidth(z) : h.rightWidth(z), r = 5 + old() * 2.5;
   add(h.center(z) + side * (half + semi + r + 5), z, r, -.8, 'hollow');
  }
  if (!kind) continue;
  if (kind === 'framing') {
   const zones = [h.length * .45, h.length * .7, h.length - 20];
   for (const z of zones) for (const side of [1, -1]) {
    if (rnd() < .3) continue;
    const half = side < 0 ? h.leftWidth(z) : h.rightWidth(z), r = 9 + rnd() * 7;
    add(h.center(z) + side * (half + semi + r + 6 + rnd() * 6), z + (rnd() - .5) * 20, r, 1 + rnd() * 1.2);
   }
  } else if (kind === 'spectator') {
   for (const a of [Math.PI * .5, Math.PI * .15, Math.PI * .85]) {
    const r = 12 + rnd() * 6, d = gr + r + 8;
    add(h.green.x + Math.cos(a) * d, h.green.z + Math.sin(a) * d, r, 2.5 + rnd() * 1.5);
   }
  } else if (kind === 'drops') {
   const n = 2 + Math.floor(rnd() * 4), a0 = rnd() * Math.PI * 2;
   for (let i = 0; i < n; i++) {
    const a = a0 + (rnd() - .5) * 1.4, d = gr + 12 + rnd() * 14, r = 5 + rnd() * 2.5;
    add(h.green.x + Math.cos(a) * d, h.green.z + Math.sin(a) * d, r, 1.4 + rnd());
   }
  }
 }
 return out;
}
// The height a hole's template earthworks are, in the world: each a segment
// across the hole at its z, from one end to the other, with its profile.
export function worldEarthworks(holes) {
 const out = [];
 for (const h of holes) for (const e of h.design?.earthworks || []) {
  const c = h.center(e.z), a = h.toWorld({x: c - e.half, z: e.z}), b = h.toWorld({x: c + e.half, z: e.z});
  out.push({kind: e.kind, ax: a.x, az: a.z, bx: b.x, bz: b.z, r: e.r, h: e.h ?? 0, depth: e.depth ?? 0, floor: e.floor ?? 0, aim: !!e.aim, hole: h.hole});
 }
 return out;
}
// The height the earthworks add at (x, z). A mound is a smooth round bump,
// its shoulder easing to nothing at its radius; a ridge the same profile
// along a segment (its ends round); a ravine a trench along one, its floor
// `floor` m wide and flat, its walls easing to the lip at `r`. `cell` is
// the grid built once.
export function earthField(mounds, works = [], cell = 24) {
 const grid = new Map(), key = (i, j) => i + ',' + j;
 const file = (o, x0, x1, z0, z1) => {
  for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)
   for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
    const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o);
   }
 };
 for (const m of mounds) file(m, m.x - m.r, m.x + m.r, m.z - m.r, m.z + m.r);
 for (const w of works) file(w, Math.min(w.ax, w.bx) - w.r, Math.max(w.ax, w.bx) + w.r, Math.min(w.az, w.bz) - w.r, Math.max(w.az, w.bz) + w.r);
 const bump = d => { const c = Math.cos(Math.min(1, d) * Math.PI / 2); return c * c; };
 return (x, z) => {
  const list = grid.get(key(Math.floor(x / cell), Math.floor(z / cell)));
  if (!list) return 0;
  let y = 0;
  for (const o of list) {
   if (o.ax === undefined) { const d = Math.hypot(x - o.x, z - o.z) / o.r; if (d < 1) y += o.h * bump(d); continue; }
   const dx = o.bx - o.ax, dz = o.bz - o.az, t = Math.max(0, Math.min(1, ((x - o.ax) * dx + (z - o.az) * dz) / (dx * dx + dz * dz)));
   const d = Math.hypot(x - o.ax - dx * t, z - o.az - dz * t);
   if (d >= o.r) continue;
   if (o.kind === 'ravine') { const f = o.floor / 2, u = d <= f ? 0 : (d - f) / (o.r - f); y -= o.depth * (1 - u * u * (3 - 2 * u)); }
   // A ridge dies into the land over the outer quarter of its length at
   // each end, as a dune does (the owner's review: the Alps stood up in
   // round caps either side of the fairway).
   else { const u = Math.min(1, Math.min(t, 1 - t) / .25), end = u * u * (3 - 2 * u); y += o.h * end * bump(d / o.r); }
  }
  return y;
 };
}
// The mounds alone (phase 5's field; kept for the tools that ask for it).
export const moundField = (mounds, cell = 24) => earthField(mounds, [], cell);
