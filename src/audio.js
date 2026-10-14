// WHEN THE GAME MAKES A SOUND. src/sound.js says what every sound is; this
// file decides when each one plays, how loud, and from where.
//
// The owner's rules (13 October 2026):
//  - With a launch monitor, NO club sounds: the golfer hears the real strike,
//    and a game strike arriving after the monitor's delay would sound like an
//    echo. Every other sound plays in both modes.
//  - No crowd, no ball-rolling sound.
//  - Water is heard only near water.
//  - Never more than one bird at a time (sound.js keeps that).
//
// A browser only lets a page make sound after the player has clicked, tapped
// or pressed a key, so nothing is created until then (`unlock`); before it,
// every call here is a quiet no-op. The context is suspended while the page is
// hidden, so a game left in a background tab costs nothing.
import {createSoundLab,createAmbience,strike,impact,score,scoreSting,SCENES,STRIKES} from './sound.js';
import {crownRadius} from './species.js';

const KEY='fairway-sound-v1';
// Volumes are percentages. `on` is the one switch for everything.
export const DEFAULT_SOUND={on:true,master:80,effects:100,ambience:70};
export function loadSound(){
 try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');return {...DEFAULT_SOUND,...(p&&typeof p==='object'?p:{})};}
 catch{return {...DEFAULT_SOUND};}
}
export function saveSound(p){try{localStorage.setItem(KEY,JSON.stringify(p));}catch{}return p;}

// Which strike plays for a club kind (clubs.js CLUB_KINDS) and how hard it was
// swung. A wedge or short iron swung softly is a chip.
export function strikeFor(kind,headMph){
 const k=String(kind||'');
 if(k==='putter')return 'putter';
 if(k==='driver')return 'driver';
 if(k.startsWith('wood')||k.startsWith('hybrid'))return 'wood';
 return headMph<55?'chip':'iron';
}
// Head speed from ball speed: the ball leaves faster than the head by the
// smash factor. PLACED from typical figures (driver about 1.48, irons about
// 1.33, wedges about 1.2, a putter about 1.6); only loudness and brightness
// follow it.
export function headSpeedMph(kind,ballMs){
 const k=String(kind||''),smash=k==='putter'?1.6:k==='driver'?1.48:k.startsWith('wood')?1.45:k.startsWith('hybrid')?1.4:k.startsWith('iron')?1.33:1.2;
 return ballMs/0.44704/smash;
}
// What each contact sounds like. Rocks, a floodlight mast and Haunted Hollow's
// props share the hard sounds that exist; any surface name sound.js does not
// know is rough.
const CONTACT={green:'green',fringe:'fringe',fairway:'fairway',tee:'tee',semi:'semi',rough:'rough',sand:'sand',water:'water',
 trunk:'trunk',rock:'rock',pole:'rock',prop:'trunk',flagstick:'flagstick',house:'house',canopy:'canopy',cup:'cup'};
// Below this, a contact is too soft to hear and is skipped (m/s).
const QUIET=.8;

// THE CANOPY IS NOT A COLLIDER. A ball flies through leaves untouched (the
// physics collides with trunks only), but it still makes a sound there: each
// tree whose crown the flight passes through, once, at the moment it enters.
// Crowns are taken from the middle of the tree to its top (PLACED).
export function canopyContacts(points,allTrees,toWorld){
 const out=[],seen=new Set();
 // Only trees near the flight at all: a box round it, as wide as a big crown.
 let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const q of points){const w=toWorld(q);x0=Math.min(x0,w.x);x1=Math.max(x1,w.x);z0=Math.min(z0,w.z);z1=Math.max(z1,w.z);}
 const trees=allTrees.filter(t=>t.x>x0-40&&t.x<x1+40&&t.z>z0-40&&t.z<z1+40);
 for(let i=0;i<points.length;i+=2){
  const q=points[i],w=toWorld(q);
  for(let j=0;j<trees.length;j++){
   if(seen.has(j))continue;const t=trees[j],r=crownRadius(t);
   if(!r||Math.abs(w.x-t.x)>r||Math.abs(w.z-t.z)>r)continue;
   if(Math.hypot(w.x-t.x,w.z-t.z)<r&&q.y>t.y+t.h*.45&&q.y<t.y+t.h){seen.add(j);out.push({t:q.t,what:'canopy',speed:q.v||20,x:q.x,y:q.y,z:q.z});}
  }
 }
 return out;
}

export function createGameAudio(){
 let ctx=null,lab=null,amb=null,ambGain=null,prefs=loadSound(),scene=null,sceneState={};
 const ok=()=>!!ctx&&prefs.on;
 function applyVolumes(){
  if(!ctx)return;const now=ctx.currentTime,v=x=>Math.max(0,x)/100;
  lab.master.gain.setTargetAtTime(prefs.on?.9*v(prefs.master):0,now,.05);
  lab.fx.gain.setTargetAtTime(v(prefs.effects),now,.05);
  ambGain.gain.setTargetAtTime(v(prefs.ambience),now,.2);
 }
 function unlock(){
  if(!ctx){
   const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
   try{ctx=new AC({latencyHint:'interactive'});}catch{return;}
   lab=createSoundLab(ctx);
   ambGain=ctx.createGain();ambGain.connect(lab.master);
   amb=createAmbience(lab,{to:ambGain});
   applyVolumes();
   if(scene)startScene();
  }
  if(ctx.state==='suspended'&&!document.hidden)ctx.resume().catch(()=>{});
 }
 function startScene(){
  if(!amb||!scene||!SCENES[scene])return;
  amb.start(scene);amb.set(sceneState);
 }
 // Any input unlocks; captured, so it runs before a click starts a round.
 for(const type of ['pointerdown','keydown','touchend'])addEventListener(type,unlock,{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend().catch(()=>{});else ctx.resume().catch(()=>{});});

 return {
  get prefs(){return {...prefs};},
  setPrefs(next){prefs=saveSound({...prefs,...next});applyVolumes();},
  // The course's mood: biome, wind (mph), temperature (C), night, and the
  // distance from the ball to the nearest water (m). Cheap to call often:
  // only a change of biome restarts anything.
  setScene({biome,wind,tempC,night,waterDist}){
   sceneState={wind,tempC,night,waterDist};
   const next=SCENES[biome]?biome:'midwest';
   if(next!==scene){scene=next;if(amb)startScene();return;}
   if(amb)amb.set(sceneState);
  },
  stopScene(){scene=null;if(amb)amb.stop();},
  // A club strike. `monitor` true means a launch monitor shot: silent.
  strike({kind,ballMs,monitor}){
   if(!ok()||monitor)return;
   const mph=headSpeedMph(kind,ballMs),id=strikeFor(kind,mph),[lo,hi]=STRIKES[id].speed;
   // THE WHOOSH COMES FIRST. The ball is away the instant the key goes down,
   // so there is no time for the lab's 0.45 s swing. Starting it that much in
   // the past did not work: Web Audio moves a late sound to NOW whole rather
   // than skipping its start, so the whoosh played after the crack and the
   // swing sounded backwards (the owner, 13 October 2026). Now the whoosh rises
   // over the last tenth of a second and the crack lands 0.1 s after the ball
   // leaves -- about what sound takes to cross 34 m -- with the follow-through
   // after it. PLACED.
   strike(lab,id,{speed:Math.min(hi,Math.max(lo,mph)),lead:.1});
  },
  // One contact from simulateShot (or canopyContacts) heard from `dist`
  // metres, `pan` -1..1 across the screen.
  contact(c,{dist=12,pan=0}={}){
   if(!ok())return;const what=CONTACT[c.what]||'rough';
   if(what!=='cup'&&!(c.speed>=QUIET))return;
   impact(lab,what,{speed:c.speed??2,dist,pan});
  },
  // A hole finished: the sting for that score.
  score(strokes,par){if(ok())score(lab,scoreSting(strokes,par));},
 };
}

// The distance from (x, z) to the nearest water, from the world's own surface
// query: rings of points at growing radii, so the first ring that touches
// water gives the answer to within its spacing. Beyond 300 m the ambience
// hears no water at all, so the search stops there.
const RINGS=[8,16,30,50,80,120,170,230,300];
export function nearestWater(world,x,z){
 if(world.surface(x,z)==='water')return 0;
 for(const r of RINGS){const n=Math.max(12,Math.round(r/6));
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;if(world.surface(x+Math.sin(a)*r,z+Math.cos(a)*r)==='water')return r;}}
 return 1000;
}
