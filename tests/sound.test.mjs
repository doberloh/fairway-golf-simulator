import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/course.js';
import {simulateShot} from '../src/physics.js';
import {scoreSting,STRIKES,IMPACTS,SCORES,FINAL,WATERS,WATER_FOR} from '../src/sound.js';
import {strikeFor,headSpeedMph,canopyContacts,nearestWater,waterKindAt,loadSound,DEFAULT_SOUND} from '../src/audio.js';
import {holeScoreName} from '../src/scoring.js';

// The sounds themselves are judged by ear (tools/sound-lab); what a test can
// hold is the wiring: every contact the physics reports has a sound, the
// signed-off takes stayed signed off, and the rules the owner set hold.

test('every signed-off sound has exactly one take',()=>{
 for(const [group,table] of [[STRIKES,FINAL.strikes],[IMPACTS,FINAL.impacts],[SCORES,FINAL.scores]])
  for(const id of Object.keys(table)){
   assert.deepEqual(Object.keys(group[id].takes),['A'],`${id} still offers more than its final take`);
   assert(group[id].final,`${id} is not marked final`);
  }
 // Everything the game can play is signed off.
 for(const id of Object.keys(STRIKES))assert(FINAL.strikes[id],`strike ${id} was never signed off`);
 for(const id of Object.keys(IMPACTS))assert(FINAL.impacts[id],`impact ${id} was never signed off`);
 for(const id of Object.keys(SCORES))assert(FINAL.scores[id],`score ${id} was never signed off`);
});

test('each score name has its sting, decimal putting included',()=>{
 const want={'Hole in one':'ace',Condor:'albatross',Albatross:'albatross',Eagle:'eagle',Birdie:'birdie',Par:'par',Bogey:'bogey','Double bogey':'double','Triple bogey':'worse','Quadruple bogey':'worse'};
 for(const par of [3,4,5])for(let strokes=1;strokes<=par+6;strokes++){
  const name=holeScoreName(strokes,par),sting=scoreSting(strokes,par);
  if(want[name])assert.equal(sting,want[name],`${strokes} on a par ${par} (${name})`);
  else assert.equal(sting,'worse',`${strokes} on a par ${par}`);
 }
 // A fractional score takes the nearest whole score's sting, not "worse".
 assert.equal(scoreSting(4.4,4),'par');assert.equal(scoreSting(3.6,4),'par');assert.equal(scoreSting(4.6,4),'bogey');
});

test('every club kind strikes with a sound, and a soft wedge is a chip',()=>{
 for(const kind of ['driver','wood','wood5','hybrid3','iron5','iron9','wedge','gap','putter'])
  assert(STRIKES[strikeFor(kind,headSpeedMph(kind,40))],kind);
 assert.equal(strikeFor('wedge',30),'chip');assert.equal(strikeFor('wedge',80),'iron');
 assert.equal(strikeFor('putter',5),'putter');assert.equal(strikeFor('hybrid4',90),'wood');
});

test('every contact the physics reports maps to a sound, in the order it happened',()=>{
 const world=generateWorld({seed:'HOMES-QA',biome:'midwest',holes:9,homes:true,homeDensity:100,trees:40,water:30});
 const kinds=new Set();
 for(const hole of world.holes.slice(0,4)){
  for(const [vla,speed,aim] of [[12,70,0],[25,45,8],[40,30,-10],[11,75,25],[30,50,-30]]){
   const shot={origin:hole.tee,aim,hla:0,vla,speed,spin:3000,spinAxis:0};
   const r=simulateShot(shot,hole,{flagsticks:{current:true}});
   for(const c of r.contacts){
    kinds.add(c.what);
    assert(Number.isFinite(c.t)&&c.t>=0&&c.t<=r.time+1e-9,'a contact outside the flight');
    assert(Number.isFinite(c.speed)&&c.speed>=0,'a contact without a speed');
   }
   // Contacts are in time order, the order the game plays them.
   for(let i=1;i<r.contacts.length;i++)assert(r.contacts[i].t>=r.contacts[i-1].t);
  }
 }
 assert(kinds.size>=2,`only ${[...kinds]} reported`);
 const known=new Set([...Object.keys(IMPACTS),'pole','prop']);
 for(const k of kinds)assert(known.has(k),`no sound for contact "${k}"`);
});

test('a ball through a crown rustles once per tree',()=>{
 const tree={x:0,z:50,y:0,h:20,kind:'oak',r:5};
 const pts=Array.from({length:200},(_,i)=>({t:i/100,x:0,y:14,z:i/2,v:30}));
 const c=canopyContacts(pts,[tree],q=>q);
 assert.equal(c.length,1);assert.equal(c[0].what,'canopy');
 // Under the crown, or beside it, nothing.
 assert.equal(canopyContacts(pts.map(p=>({...p,y:4})),[tree],q=>q).length,0);
 assert.equal(canopyContacts(pts.map(p=>({...p,x:30})),[tree],q=>q).length,0);
});

test('water is found near water and not far from it',()=>{
 const flat={surface:(x,z)=>x>100?'water':'rough'};
 assert.equal(nearestWater(flat,150,0).dist,0);
 assert(nearestWater(flat,90,0).dist<=16);
 const mid=nearestWater(flat,40,0);assert(mid.dist<=80&&mid.dist>=50);assert(mid.x>100,'the point found is in the water');
 assert.equal(nearestWater(flat,-400,0).dist,1000);assert.equal(nearestWater(flat,-400,0).kind,null);
});

test('every kind of water has its signed-off sound, and is told apart',()=>{
 for(const kind of ['pond','river','creek'])assert(WATERS[WATER_FOR[kind]]?.final===kind,`no signed-off sound for ${kind}`);
 for(const [id,w] of Object.entries(WATERS))assert(w.final,`${id} is an option nobody signed off`);
 const world=(stream,sea)=>({streams:{at:()=>stream},bio:{sea},waterLevel:0,height:()=>-1,lakeOwner:()=>null});
 assert.equal(waterKindAt(world({kind:'river',edge:-1}),0,0),'river');
 assert.equal(waterKindAt(world({kind:'creek',edge:-1}),0,0),'creek');
 assert.equal(waterKindAt(world(null,true),0,0),'sea');
 assert.equal(waterKindAt(world(null,false),0,0),'pond');
 assert.equal(waterKindAt({...world(null,true),lakeOwner:()=>({})},0,0),'pond','a lake on a coast is still a lake');
});

test('sound settings fall back to the defaults without storage',()=>{
 assert.deepEqual(loadSound(),DEFAULT_SOUND);
});

// THE SWING METER'S SOUNDS (signed off 14 October 2026, round 1): the game plays
// them, so each must be the one take the owner chose, with their sliders in.
test('every Swing Meter sound is signed off, one take each', async () => {
 const {METER_EVENTS, METER_VOICES, METER_FINAL} = await import('../src/sound.js');
 assert.deepEqual(Object.keys(METER_VOICES), ['A'], 'the voice has one take');
 assert.ok(METER_VOICES.A.final && METER_VOICES.A.kind === 'air', 'the voice is the signed-off air take');
 for (const id of ['power', 'overswing', 'perfect', 'zone', 'miss', 'duff']) {
  assert.ok(METER_EVENTS[id]?.final, `${id} was never signed off`);
  assert.deepEqual(Object.keys(METER_EVENTS[id].takes), ['A'], `${id} has more than one take`);
  assert.deepEqual(METER_EVENTS[id].takes.A.base, METER_FINAL[id][1], `${id} lost the owner's sliders`);
 }
});

// THE XP POPUP'S SOUNDS (signed off 14 October 2026): one take each, the owner's sliders in.
test('every XP sound is signed off, one take each', async () => {
 const {XP_SOUNDS, XP_FINAL} = await import('../src/sound.js');
 for (const id of ['gain', 'fill', 'levelUp']) {
  assert.ok(XP_SOUNDS[id]?.final, `${id} was never signed off`);
  assert.deepEqual(Object.keys(XP_SOUNDS[id].takes), ['A'], `${id} has more than one take`);
  assert.deepEqual(XP_SOUNDS[id].takes.A.base, XP_FINAL[id][1], `${id} lost the owner's sliders`);
 }
});
