import {rollDeceleration,launchForDistance} from './turf.js';
import {simulateShot,MPH,YARD,clamp} from './physics.js';
export const CLUBS={driver:{label:'Driver',code:'DR',speed:155*MPH,vla:12.5,spin:2700,carry:250},wood:{label:'3 Wood',code:'3W',speed:138*MPH,vla:14,spin:3500,carry:220},iron5:{label:'5 Iron',code:'5I',speed:119*MPH,vla:17,spin:4800,carry:185},iron7:{label:'7 Iron',code:'7I',speed:105*MPH,vla:20,spin:6500,carry:155},iron9:{label:'9 Iron',code:'9I',speed:91*MPH,vla:25,spin:8000,carry:125},wedge:{label:'Pitching wedge',code:'PW',speed:76*MPH,vla:30,spin:9000,carry:100},sand:{label:'Sand wedge',code:'SW',speed:58*MPH,vla:35,spin:8500,carry:65},putter:{label:'Putter',code:'PT',speed:7,vla:0,spin:0,carry:30}};
export const DEFAULT_FLIGHT={speed:100,spin:100,launch:0,axis:0};
export function validateFlight(input={}){const p={...DEFAULT_FLIGHT,...input};for(const[k,lo,hi]of[['speed',60,140],['spin',20,180],['launch',-10,15],['axis',-45,45]])if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Invalid ball-flight profile.');return p;}
const flat={height:()=>0,surface:()=> 'fairway',bounds:{x:5000,minZ:-5000,maxZ:5000},trees:[]},cache=new Map();
// EVERY KIND OF CLUB A PLAYER CAN PUT IN A BAG. The eight stock clubs above are
// eight of these, unchanged, so the stock bag flies exactly as it always has;
// the rest were added on 12 October 2026 when the bag became the player's own.
//
// A kind decides the SHAPE of a full swing -- launch angle and spin -- and the
// code a launch monitor is told. It does not decide distance: the player types
// a carry, and `bagClubs` solves the ball speed that carries it, so a kind's
// numbers move apex, descent and roll, never the yardage. The added kinds are
// PLACED, not published: irons and wedges between two stock clubs take the
// halfway launch and spin; woods, hybrids and long irons sit between the 3 wood
// and the 5 iron, irons spinning more than woods of the same launch; the lob
// wedge carries the sand wedge's trend one step on (RESEARCH.md, *The bag
// belongs to the player*). Codes follow the pattern the stock clubs already
// sent; GSPro publishes only "DR" and "PT" matters most (putting mode).
//
// `order` sorts a bag longest first; the putter is always last.
export const CLUB_KINDS={
 driver:{...CLUBS.driver,order:0},
 wood:{...CLUBS.wood,order:1},
 wood5:{label:'5 Wood',code:'5W',speed:132*MPH,vla:15,spin:4000,carry:205,order:2},
 wood7:{label:'7 Wood',code:'7W',speed:128*MPH,vla:16,spin:4400,carry:195,order:3},
 hybrid3:{label:'3 Hybrid',code:'3H',speed:130*MPH,vla:15,spin:4300,carry:200,order:4},
 hybrid4:{label:'4 Hybrid',code:'4H',speed:126*MPH,vla:16,spin:4600,carry:190,order:5},
 hybrid5:{label:'5 Hybrid',code:'5H',speed:122*MPH,vla:17,spin:4900,carry:180,order:6},
 iron3:{label:'3 Iron',code:'3I',speed:127*MPH,vla:14.5,spin:4300,carry:200,order:7},
 iron4:{label:'4 Iron',code:'4I',speed:123*MPH,vla:15.5,spin:4550,carry:192,order:8},
 iron5:{...CLUBS.iron5,order:9},
 iron6:{label:'6 Iron',code:'6I',speed:112*MPH,vla:18.5,spin:5650,carry:170,order:10},
 iron7:{...CLUBS.iron7,order:11},
 iron8:{label:'8 Iron',code:'8I',speed:98*MPH,vla:22.5,spin:7250,carry:140,order:12},
 iron9:{...CLUBS.iron9,order:13},
 wedge:{...CLUBS.wedge,order:14},
 gap:{label:'Gap wedge',code:'GW',speed:67*MPH,vla:32.5,spin:8750,carry:85,order:15},
 sand:{...CLUBS.sand,order:16},
 lob:{label:'Lob wedge',code:'LW',speed:50*MPH,vla:38,spin:8200,carry:50,order:17},
 putter:{...CLUBS.putter,order:18},
};
// The Rules of Golf limit (Rule 4.1b). A bag needs a putter and one club to
// hit with; names are the player's and must differ, because a name is what the
// club picker, the shot list and the dispersion legend show.
export const MAX_BAG=14,MAX_CLUB_NAME=20;
export const STOCK_BAG_KINDS=Object.keys(CLUBS);
export const newClubId=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const carryLimits=kind=>kind==='putter'?[1,100]:[10,400];
// The stock bag as bag entries. Ids equal the kinds, so a bag converted from the
// old device-wide distances keeps the club values every save already used.
export function stockBag(yardages={}){
 return STOCK_BAG_KINDS.map(kind=>({id:kind,name:CLUBS[kind].label,kind,carry:Number.isFinite(yardages?.[kind])?yardages[kind]:CLUBS[kind].carry}));
}
// A bag as entered, made safe or refused with a reason a player can act on.
// The putter's id is always 'putter': the game asks "is this the putter?" by id
// in many places, and one fixed id keeps every one of them true.
export function validateBag(bag){
 if(!Array.isArray(bag))throw Error('A bag is a list of clubs.');
 if(bag.length>MAX_BAG)throw Error(`A bag holds at most ${MAX_BAG} clubs.`);
 const out=[],names=new Set(),ids=new Set();
 for(const c of bag){
  const kind=c?.kind;
  if(!CLUB_KINDS[kind])throw Error('Choose what kind of club each one is.');
  const name=String(c.name??'').trim().replace(/\s+/g,' ');
  if(!name)throw Error('Give every club a name.');
  if(name.length>MAX_CLUB_NAME)throw Error(`Keep club names to ${MAX_CLUB_NAME} characters.`);
  if(names.has(name.toLowerCase()))throw Error(`Two clubs are called ${name}; give each its own name.`);
  const carry=Number(c.carry),[lo,hi]=carryLimits(kind);
  if(!Number.isFinite(carry)||carry<lo||carry>hi)throw Error(kind==='putter'?`${name}: putter roll must be ${lo}–${hi} yd.`:`${name}: carry must be ${lo}–${hi} yd.`);
  let id=kind==='putter'?'putter':String(c.id??'');
  if(kind!=='putter'&&(!/^[a-z0-9]{1,24}$/i.test(id)||id==='putter'||ids.has(id)))id=newClubId();
  if(ids.has(id))throw Error('A bag holds one putter.');
  names.add(name.toLowerCase());ids.add(id);
  out.push({id,name,kind,carry:Math.round(carry)});
 }
 if(!ids.has('putter'))throw Error('A bag needs a putter.');
 if(out.length<2)throw Error('A bag needs at least one club besides the putter.');
 return out;
}
const solveSpeed=(kind,carry)=>{
 const key=kind+':'+carry;let speed=cache.get(key);
 if(speed===undefined){const c=CLUB_KINDS[kind];if(kind==='putter')speed=launchForDistance(carry*YARD,rollDeceleration('green'));else {let lo=1,hi=130;for(let i=0;i<19;i++){const mid=(lo+hi)/2,r=simulateShot({origin:{x:0,z:0},aim:0,hla:0,spinAxis:0,...c,speed:mid},flat);if(r.carry<carry*YARD)lo=mid;else hi=mid;}speed=(lo+hi)/2;}cache.set(key,speed);}
 return speed;
};
// A bag as the game plays it: id -> club, longest first and the putter last,
// which is the order the club picker lists and I / K step through. Ties keep
// the kind order, then the order the player entered them.
export function bagClubs(bag){
 const list=validateBag(bag).map((c,i)=>({c,i})).sort((a,b)=>a.c.kind==='putter'?1:b.c.kind==='putter'?-1:(b.c.carry-a.c.carry)||(CLUB_KINDS[a.c.kind].order-CLUB_KINDS[b.c.kind].order)||(a.i-b.i));
 const out={};
 for(const {c} of list){const k=CLUB_KINDS[c.kind];out[c.id]={label:c.name,code:k.code,vla:k.vla,spin:k.spin,carry:c.carry,speed:solveSpeed(c.kind,c.carry),kind:c.kind};}
 return out;
}
// The stock bag keyed by kind, with the old device-wide distances. Kept for the
// tools and tests that ask for clubs.iron7 by name; play goes through bagClubs.
export function customizeClubs(yardages={}){
 const result={};for(const[id,c]of Object.entries(CLUBS)){
  const carry=yardages[id]??c.carry;if(!Number.isFinite(carry)||carry<(id==='putter'?1:10)||carry>(id==='putter'?100:400))throw Error('Club distances must be 10–400 yd; putter roll 1–100 yd.');
  result[id]={...c,carry,speed:solveSpeed(id,carry)};
 }return result;
}

// `spinAdjust` is a per-shot delta in RPM, and the unit is the point. The
// profile's own spin control is a PERCENTAGE because it scales every club at
// once, and stock spin runs from 2700 rpm on a driver to 9000 on a wedge -- one
// absolute number cannot serve both. A single shot is played with one known
// club, so there the honest unit is the one a launch monitor reports, and a
// delta rather than an absolute so it survives changing club.
//
// It joins the two that were already here: launch angle and spin axis each had
// a per-shot adjustment and spin had none, which is why a shot could be flighted
// down or shaped but never deliberately spun.
// HOW SPIN FALLS WITH POWER, for keyboard, touch and controller shots.
//
// It was the square root of power, which is right for a pitch and badly wrong
// for a chip: a 10% wedge left at 337 rpm per mph of ball speed -- more than
// three times a full swing's -- and spun back behind its own pitch mark. A
// barely-moving clubhead cannot impart that.
//
// Trackman's numbers set both ends. A 54 degree wedge hit 50 yards spins about
// 6,500 rpm (6,501 clean off a lie board, 7,178 off turf), which the square
// root already gives within 10%. Chips carrying 1.25 to 24 yards average 1,500
// to 3,000 rpm and stay under 3,750 ("The Chip Shot Code"), which spin in
// PROPORTION to power gives -- the same spin per mph as the full shot. So:
// proportional for chips, the square root for pitches and full swings, and a
// smooth hand-over between 30% and 70% power. RESEARCH.md *Keyboard spin*.
const spinForPower=p=>{const t=clamp((p-.3)/.4,0,1),blend=t*t*(3-2*t);return p+(Math.sqrt(p)-p)*blend;};
export function manualLaunch(club,power,lieFactor,profile={},shape=0,launchAdjust=0,spinAdjust=0){const f=validateFlight(profile),putter=club.code==='PT';return{speed:club.speed*power*lieFactor*(putter?1:f.speed/100),vla:putter?0:clamp(club.vla+f.launch+launchAdjust,2,70),hla:0,spin:putter?0:Math.max(0,club.spin*spinForPower(power)*f.spin/100+spinAdjust),spinAxis:putter?0:f.axis+shape};}
