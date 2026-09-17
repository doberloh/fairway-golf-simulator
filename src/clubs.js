import {rollDeceleration,launchForDistance} from './turf.js';
import {simulateShot,MPH,YARD,clamp} from './physics.js';
export const CLUBS={driver:{label:'Driver',code:'DR',speed:155*MPH,vla:12.5,spin:2700,carry:250},wood:{label:'3 Wood',code:'3W',speed:138*MPH,vla:14,spin:3500,carry:220},iron5:{label:'5 Iron',code:'5I',speed:119*MPH,vla:17,spin:4800,carry:185},iron7:{label:'7 Iron',code:'7I',speed:105*MPH,vla:20,spin:6500,carry:155},iron9:{label:'9 Iron',code:'9I',speed:91*MPH,vla:25,spin:8000,carry:125},wedge:{label:'Pitching wedge',code:'PW',speed:76*MPH,vla:30,spin:9000,carry:100},sand:{label:'Sand wedge',code:'SW',speed:58*MPH,vla:35,spin:8500,carry:65},putter:{label:'Putter',code:'PT',speed:7,vla:0,spin:0,carry:30}};
export const DEFAULT_FLIGHT={speed:100,spin:100,launch:0,axis:0};
export function validateFlight(input={}){const p={...DEFAULT_FLIGHT,...input};for(const[k,lo,hi]of[['speed',60,140],['spin',20,180],['launch',-10,15],['axis',-45,45]])if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Invalid ball-flight profile.');return p;}
const flat={height:()=>0,surface:()=> 'fairway',bounds:{x:5000,minZ:-5000,maxZ:5000},trees:[]},cache=new Map();
export function customizeClubs(yardages={}){
 const result={};for(const[id,c]of Object.entries(CLUBS)){
  const carry=yardages[id]??c.carry;if(!Number.isFinite(carry)||carry<(id==='putter'?1:10)||carry>(id==='putter'?100:400))throw Error('Club distances must be 10–400 yd; putter roll 1–100 yd.');
  const key=id+':'+carry;let speed=cache.get(key);
  if(speed===undefined){if(id==='putter')speed=launchForDistance(carry*YARD,rollDeceleration('green'));else {let lo=1,hi=130;for(let i=0;i<19;i++){const mid=(lo+hi)/2,r=simulateShot({origin:{x:0,z:0},aim:0,hla:0,spinAxis:0,...c,speed:mid},flat);if(r.carry<carry*YARD)lo=mid;else hi=mid;}speed=(lo+hi)/2;}cache.set(key,speed);}
  result[id]={...c,carry,speed};
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
export function manualLaunch(club,power,lieFactor,profile={},shape=0,launchAdjust=0,spinAdjust=0){const f=validateFlight(profile),putter=club.code==='PT';return{speed:club.speed*power*lieFactor*(putter?1:f.speed/100),vla:putter?0:clamp(club.vla+f.launch+launchAdjust,2,70),hla:0,spin:putter?0:Math.max(0,club.spin*Math.sqrt(power)*f.spin/100+spinAdjust),spinAxis:putter?0:f.axis+shape};}
