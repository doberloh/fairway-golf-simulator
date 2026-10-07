import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateShot,parseLaunchMessage,MPH,airDensity} from '../src/physics.js';
import {generateCourse,BIOMES} from '../src/course.js';
import {Round} from '../src/game.js';
const flat={height:()=>0,surface:()=> 'fairway',bounds:{x:2000,minZ:-2000,maxZ:2000},trees:[]};
const shot={origin:{x:0,z:0},aim:0,speed:155*MPH,vla:12.5,hla:0,spin:2700,spinAxis:0};
test('driver flight is plausible, symmetric and time-step stable',()=>{const a=simulateShot(shot,flat),b=simulateShot(shot,flat,{dt:1/120});assert(a.carry>190&&a.carry<280,`carry ${a.carry}`);assert(a.apex>15&&a.apex<60,`apex ${a.apex}`);assert(Math.abs(a.end.x)<1e-8);assert(Math.abs(a.carry-b.carry)<1);assert(a.total>=a.carry);assert(a.time<35);});
// A negative axis draws to the golfer's LEFT, which is a hole's local +x
// (renderer.js, *Which side is right*). Until 5 October this asserted the
// mirror image, and every monitor shot flew the wrong way.
test('spin-axis changes curve direction; headwind reduces carry',()=>{const l=simulateShot({...shot,spinAxis:-20},flat),r=simulateShot({...shot,spinAxis:20},flat);assert(l.end.x>0&&r.end.x<0);assert(Math.abs(l.end.x+r.end.x)<.1);const still=simulateShot(shot,flat),wind=simulateShot(shot,flat,{wind:[0,0,-8]});assert(wind.carry<still.carry);assert(airDensity(1800)<airDensity(0));});
test('a struck putt skids before it rolls, and the cup still catches a slow ball',()=>{const green={...flat,surface:()=> 'green'};
 // Struck, so it leaves the face sliding: shorter than the 3.64 m a ball
 // released already rolling at 2 m/s would cover on a Stimp 10 green, with
 // about a seventh of the run spent skidding.
 const r=simulateShot({...shot,speed:2,vla:0,spin:0},green);
 assert(r.total>2.0&&r.total<2.2,`struck putt ran ${r.total.toFixed(3)} m`);
 assert(r.skid/r.total>.12&&r.skid/r.total<.18,`skid was ${(r.skid/r.total*100).toFixed(1)}% of the run`);
 // A ramp release covers the pure-rolling distance, which is what the
 // Stimpmeter measures and what the cup test needs to actually reach the hole.
 const rolled=simulateShot({...shot,speed:2,vla:0,spin:0,roll:2},green);
 assert(rolled.total>3.5&&rolled.total<3.8,`released rolling it ran ${rolled.total.toFixed(3)} m`);
 assert.equal(rolled.skid,0);
 const cup=simulateShot({...shot,speed:2,vla:0,spin:0,roll:2},{...green,pin:{x:0,z:3}});assert(cup.holed);});
test('water and boundaries terminate shots with a penalty',()=>{assert.equal(simulateShot(shot,{...flat,surface:()=> 'water'}).hazard,'Water');assert.equal(simulateShot(shot,{...flat,bounds:{x:10,minZ:-10,maxZ:30}}).hazard,'Out of bounds');});
test('seeded courses deterministic and playable across all biomes',()=>{for(const biome of Object.keys(BIOMES)){const a=generateCourse({seed:'TEST',biome}),b=generateCourse({seed:'TEST',biome});assert.deepEqual(a.trees,b.trees);assert.equal(a.surface(a.pin.x,a.pin.z),'green');assert.equal(a.surface(0,0),'tee');for(let z=0;z<a.length;z+=20)assert(Number.isFinite(a.height(a.center(z),z)));}assert.notDeepEqual(generateCourse({seed:'A'}).bunkers,generateCourse({seed:'B'}).bunkers);assert.equal(generateCourse({trees:0,water:0}).trees.length,0);assert.equal(generateCourse({trees:0,water:0}).ponds.length,0);});
test('Open Connect units, spin alternatives, statuses and invalid values',()=>{const d={Units:'Yards',BallData:{Speed:100,VLA:15,HLA:0,TotalSpin:3000,SpinAxis:0}};assert.equal(parseLaunchMessage(d).speed,100*MPH);assert.equal(parseLaunchMessage({...d,Units:'Meters',BallData:{...d.BallData,Speed:36}}).speed,10);assert.equal(parseLaunchMessage({ShotDataOptions:{ContainsBallData:false}}),null);assert.throws(()=>parseLaunchMessage({...d,BallData:{...d.BallData,Speed:'100'}}));assert.throws(()=>parseLaunchMessage({...d,Units:'Feet'}));assert.equal(parseLaunchMessage({BallData:{Speed:100,VLA:15,HLA:0,BackSpin:0,SideSpin:3000}}).spinAxis,90);});
const players=[{name:'A1',team:'A',hand:'RH'},{name:'B1',team:'B',hand:'RH'},{name:'A2',team:'A',hand:'LH'},{name:'B2',team:'B',hand:'RH'}];
const pin={x:0,z:100},hit={end:{x:0,z:50},holed:false},hole={end:pin,holed:true};
test('stroke play lets each player finish and advances only completed holes',()=>{const r=new Round({players:players.slice(0,2),gimme:0,holes:3});r.takeShot(hit,pin);assert.equal(r.active,0);r.takeShot(hole,pin);assert.equal(r.active,1);r.takeShot({...hit,hazard:'Water'},pin);assert.equal(r.strokes[1],1);r.takeRelief({spot:r.relief.from,penalty:1},pin);assert.equal(r.strokes[1],2);assert.deepEqual(r.position,{x:0,z:0});r.takeShot(hole,pin);assert(r.holeComplete);assert.deepEqual(r.cards,[[2],[3]]);assert(r.nextHole());assert.equal(r.hole,1);assert.equal(r.active,0);});
test('scramble rotates teammates and applies only selected penalties',()=>{const r=new Round({players,mode:'scramble',gimme:0});r.takeShot({...hit,hazard:'Water'},pin);r.takeRelief({spot:r.relief.from,penalty:1},pin);assert.equal(r.active,2);r.takeShot(hit,pin);assert(r.scrambleSelection);r.chooseScramble(1);assert.equal(r.scrambleShots.A,1);assert.deepEqual(r.positions[0],hit.end);assert.deepEqual(r.positions[2],hit.end);r.takeShot(hole,pin);assert.equal(r.cards[0][0],2);assert.equal(r.cards[2][0],2);assert.equal(r.active,1);r.takeShot(hole,pin);assert(r.holeComplete);assert.equal(r.cards[1][0],1);});
test('best-ball match scores ties and can finish early',()=>{const r=new Round({players:players.slice(0,2),mode:'match',holes:3,gimme:0});for(let h=0;h<2;h++){r.takeShot(hole,pin);r.takeShot(hit,pin);r.takeShot(hole,pin);if(h===0)r.nextHole();}assert.equal(r.match.A,2);assert(r.finished);assert(!r.nextHole());assert.throws(()=>new Round({mode:'match',players:[players[0]]}));});
test('serialized scramble restores candidates and player state',()=>{const r=new Round({players:[players[0],players[2]],mode:'scramble'});r.takeShot(hit,pin);r.takeShot(hit,pin);const b=Round.restore(JSON.parse(JSON.stringify(r)));assert(b.scrambleSelection);b.chooseScramble(0);assert.equal(b.stroke,2);});
test('complete four-player rounds terminate correctly in every format',()=>{for(const mode of ['stroke','scramble','match']){const r=new Round({players,mode,holes:3,gimme:0});for(let h=0;h<3;h++){let guard=0;while(!r.holeComplete&&guard++<8)r.takeShot(hole,pin);assert(r.holeComplete);if(h<2)assert(r.nextHole());}assert(r.finished);assert(!r.nextHole());assert.throws(()=>r.takeShot(hole,pin));for(const row of r.cards)assert.deepEqual(row,[1,1,1]);if(mode==='match')assert.deepEqual(r.match,{A:0,B:0});}});
test('corrupt saves are rejected without replacing the state prototype',()=>{const d=JSON.parse(JSON.stringify(new Round()));d.active=8;assert.throws(()=>Round.restore(d));d.active=0;d.strokes=[-1];assert.throws(()=>Round.restore(d));});
