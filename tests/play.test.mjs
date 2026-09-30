import test from 'node:test';
import assert from 'node:assert/strict';
import {Round} from '../src/game.js';
import {awardedPutts,puttingConfig,sumScores} from '../src/putting.js';
import {simulateShot,MPH,YARD,R,CUP_RADIUS,trunkRadius} from '../src/physics.js';
import {customizeClubs,manualLaunch} from '../src/clubs.js';
import {teePad, localSurface, teeBox, TEE_PAD, TEE_APRON, TEE_ROUND, TEE_APRON_SCALE, generateWorld,generateCourse} from '../src/course.js';
const flat={height:()=>0,surface:()=> 'green',bounds:{x:2000,minZ:-2000,maxZ:2000},trees:[]};
const shot={origin:{x:0,z:0},aim:0,hla:0,spinAxis:0,vla:0,spin:0,speed:2};
const pin={x:0,z:100},finish=(yards,onGreen=true)=>({end:{x:yards*YARD,z:100},holed:false,onGreen});
const players=[{name:'A',team:'A',hand:'RH'},{name:'B',team:'B',hand:'RH'},{name:'A2',team:'A',hand:'LH'}];
test('automatic putting obeys circles, interpolation and the green boundary',()=>{const c={one:2,two:8,three:16};for(const mode of ['dartboard','decimal'])assert.equal(awardedPutts(1,false,{...c,mode}),0);assert.equal(awardedPutts(0,true,{...c,mode:'holeout'}),0);assert.equal(awardedPutts(2*YARD,true,{...c,mode:'dartboard'}),1);assert.equal(awardedPutts(8*YARD,true,{...c,mode:'dartboard'}),2);assert.equal(awardedPutts(9*YARD,true,{...c,mode:'dartboard'}),3);for(const[d,p]of[[0,1],[2,1],[5,1.5],[8,2],[12,2.5],[16,3],[100,3]])assert.equal(awardedPutts(d*YARD,true,{...c,mode:'decimal'}),p);assert.throws(()=>puttingConfig({one:10,two:2}));});
test('hole-out ignores legacy gimmes; only captured balls finish',()=>{const r=new Round({gimme:3});r.takeShot(finish(.01),pin);assert(!r.done[0]);r.takeShot({...finish(0),holed:true},pin);assert.equal(r.cards[0][0],2);});
test('cup capture respects actual ball clearance and speed',()=>{const c={...flat,pin:{x:0,z:3}};assert(CUP_RADIUS>R);const roll=extra=>({...shot,vla:0,spin:0,...extra,roll:extra.speed});
 assert(simulateShot(roll({speed:1.9}),c).holed);assert(!simulateShot(roll({speed:5}),c).holed);
 // A line 45 mm off the middle -- 0.83 of the cup radius -- used to be asserted
 // as a miss at launch 1.9. It is not one. That ball arrives at 0.56 m/s and its
 // centre spends 0.106 s crossing a 60 mm chord of the opening, falling 55 mm in
 // the process: two and a half ball radii, well below the rim. It is in the hole,
 // and what it does next is climb out of a hole it is already inside, which it
 // has nowhere near enough speed to do. The old envelope sailed it over the top.
 assert(simulateShot(roll({origin:{x:.045,z:0},speed:1.9}),c).holed);
 // Hit the same line harder and it no longer has time to fall in: it catches the
 // rim, is turned by it, and climbs back out poorer for it. Compared against the
 // identical putt with the hole moved out of the way, which is the only way to
 // show the hole did anything -- and before this it demonstrably did not, both
 // balls finishing in the same place to the millimetre.
 const lipped=simulateShot(roll({origin:{x:.045,z:0},speed:2.3}),c);
 const untouched=simulateShot(roll({origin:{x:.045,z:0},speed:2.3}),{...flat,pin:{x:0,z:9e9}});
 assert(!lipped.holed&&lipped.lipped);
 const stopped=Math.hypot(lipped.end.x,lipped.end.z-3),past=Math.hypot(untouched.end.x,untouched.end.z-3);
 assert(stopped<past-.1,`the rim cost it only ${(past-stopped).toFixed(3)} m`);
 // The line is changed as well as the speed. Which way is no longer a tuned
 // choice: the contact normal at the far edge points back toward the middle of
 // the hole, so the impulse turns the ball inward, and the horseshoe term that
 // throws it outward only wins when the ball engaged deeply enough to ride the
 // wall. Direction is therefore not asserted, only that the rim changed the line.
 assert(Math.abs(lipped.end.x-untouched.end.x)>.005,'a lipped putt is turned, not just slowed');
 // Not an absolute distance any more: a ball that rides the rim and comes off
 // it still carrying speed genuinely runs a few feet, and pinning this to the
 // old single-contact numbers would be asserting the model it replaced.
 assert(stopped<past*.75,`the rim should cost it real distance: ${stopped.toFixed(2)} m against ${past.toFixed(2)} untouched`);
 // Ease off on the same line and it drops instead. 45 mm off centre the ball
 // arrives across the rim rather than into it, so it rides the lip: fast enough
 // and the outward press walks it back out, slow enough and it settles in.
 const softer=simulateShot(roll({origin:{x:.045,z:0},speed:1.9}),c);
 assert(softer.holed,'the same line struck softer should hole out');});
test('decimal stroke scoring adds the shot, keeps golfer order, and restores fractional scores',()=>{const r=new Round({players:players.slice(0,2),putting:{mode:'decimal',one:2,two:8,three:16}});r.takeShot(finish(5,false),pin);assert.equal(r.active,0);r.takeShot(finish(5),pin);assert.equal(r.cards[0][0],3.5);assert.equal(r.active,1);r.takeShot(finish(12),pin);assert(r.holeComplete);assert.equal(r.cards[1][0],3.5);const copy=Round.restore(JSON.parse(JSON.stringify(r)));assert.equal(copy.cards[0][0],3.5);});
test('scramble waits for selection and adds only selected automatic putts',()=>{const r=new Round({players:[players[0],players[2]],mode:'scramble',putting:{mode:'decimal',one:2,two:8,three:16}});r.takeShot(finish(12),pin);assert(!r.holeComplete);r.takeShot(finish(5),pin);assert(r.scrambleSelection);r.chooseScramble(1);assert.equal(r.teamCards.A[0],2.5);assert(r.holeComplete);assert(r.mulligan());assert.equal(r.active,1);assert.equal(r.candidates.length,1);assert(!r.holeComplete);});
test('decimal match scoring and mulligan restore match outcome',()=>{const r=new Round({players:players.slice(0,2),mode:'match',holes:3,putting:{mode:'decimal',one:2,two:8,three:16}});r.takeShot(finish(5),pin);r.takeShot(finish(12),pin);assert.equal(r.match.A,1);assert(r.mulligan());assert.equal(r.match.A,0);assert.equal(r.active,1);assert(!r.holeComplete);});
test('mulligan restores hazard penalties, lies, and persists across reloads and holes',()=>{const r=new Round();r.simDrop({x:5,z:20});r.takeShot({...finish(12),hazard:'Water'},pin);assert.equal(r.strokes[0],2);const saved=Round.restore(JSON.parse(JSON.stringify(r)));assert(saved.mulligan());assert.equal(saved.strokes[0],0);assert.deepEqual(saved.position,{x:5,z:20});saved.takeShot({...finish(0),holed:true},pin);
 // HOLED BUT STILL ON THE CARD: the putt that just dropped can go back. The
 // scorecard sits up for a few seconds before the next tee and taking it back
 // there is a reasonable thing to want.
 assert(saved.canMulligan());
 saved.nextHole();
 // A FRESH TEE HAS NOTHING OF ITS OWN TO TAKE BACK. This used to reach across
 // the hole boundary and rewind the whole previous hole, unrecording its score:
 // pressing Mulligan on a tee undid nothing you had done on that hole, which is
 // the one thing the button claims to do.
 assert(!saved.canMulligan());
 const card=JSON.parse(JSON.stringify(saved.cards));
 assert(!saved.mulligan());
 assert.equal(saved.hole,1);
 assert.deepEqual(saved.cards,card);
 // And it comes back the moment there is a shot on this hole to take back.
 saved.takeShot(finish(12),pin);
 assert(saved.canMulligan());
 assert(saved.mulligan());
 assert.equal(saved.hole,1);
 assert.equal(saved.strokes[0],0);});
test('sim drop is penalty-free and moves a whole scramble team from a shared lie',()=>{const r=new Round({mode:'scramble',players:[players[0],players[2]]});r.simDrop({x:300,z:800});assert.deepEqual(r.positions,[{x:300,z:800},{x:300,z:800}]);assert.equal(r.stroke,1);r.takeShot(finish(10,false),pin);assert.throws(()=>r.simDrop({x:0,z:0}));assert.throws(()=>new Round().simDrop({x:NaN,z:0}));});
test('ball escapes a trunk overlap instead of oscillating in place',()=>{const tree={x:0,z:0,y:0,h:18,kind:'oak'},radius=trunkRadius(tree)+R;for(const vla of [0,25]){const result=simulateShot({...shot,origin:{x:0,z:radius-.015},speed:9,vla},{...flat,surface:()=> 'rough',trees:[tree]});assert(result.total>3,`stuck: ${result.total}`);assert(result.time<30);assert(result.end.z>radius);assert(Number.isFinite(result.end.y));}});
test('incoming rolling balls bounce off trunks and can be struck away afterward',()=>{const tree={x:0,z:2,y:0,h:18,kind:'oak'},c={...flat,trees:[tree]},r=simulateShot({...shot,speed:2},c);assert(r.end.z<1.5);const next=simulateShot({...shot,origin:r.end,aim:180,speed:3,vla:20},c);
 // The point is that the ball is NOT STUCK against the trunk, not the exact
 // distance. 3 m encoded the old bounce, which barely slowed a slow ball; the
 // corrected one gives 1.46 m, and the arithmetic agrees -- 3 m/s at 20 deg
 // carries 0.59 m and rolling from ~1.5 m/s on a fairway adds about 0.78.
 // Worth flagging honestly: this is the low-speed regime, where the model has
 // no validation data at all, so 1.46 is defensible rather than confirmed.
 assert(next.total>1.2,`stuck at the trunk: ${next.total.toFixed(2)} m`);});
test('editable carry calibrates launch speed; flight profiles change height and curve',()=>{const clubs=customizeClubs({driver:210,iron7:140,putter:20}),c={...flat,surface:()=> 'fairway'};for(const id of ['driver','iron7']){const r=simulateShot({...shot,...manualLaunch(clubs[id],1,1)},c);assert(Math.abs(r.carry/YARD-clubs[id].carry)<.2);}const putt=simulateShot({...shot,...manualLaunch(clubs.putter,1,1)},flat);assert(Math.abs(putt.total/YARD-20)<.2);const normal=simulateShot({...shot,...manualLaunch(clubs.driver,1,1)},c),high=simulateShot({...shot,...manualLaunch(clubs.driver,1,1,{launch:6,axis:20})},c);assert(high.apex>normal.apex);assert(high.end.x>0);assert.throws(()=>customizeClubs({driver:-2}));});
test('elevation changes playing surfaces substantially and widths vary procedurally',()=>{
 // Raised and punchbowl greens lift or drop the end of the corridor on their own,
 // whatever the elevation; this is about the elevation setting, so they are off.
 const flatGreens={raisedGreens:0,sunkenGreens:0,falseFronts:0};
 const low=generateWorld({seed:'HEIGHT',greenDifficulty:0,elevation:0,trees:0,water:0,bunkerCount:0,...flatGreens}),high=generateWorld({seed:'HEIGHT',greenDifficulty:0,elevation:100,trees:0,water:0,bunkerCount:0,...flatGreens});// MEASURED OVER THE MOWN CORRIDOR, which is what 'playing surfaces' means.
 // The ground behind the tee is deliberately not flat any more -- it carries
 // its own relief so a tee has somewhere to be cut into -- and sampling from
 // the hole's origin swept that in and called it an elevation change.
 const rises=w=>w.holes.map(h=>{const from=h.mowStart??h.fairwayStart,ys=Array.from({length:30},(_,i)=>{const z=from+(h.length-from)*i/29;return h.height(h.center(z),z);});return Math.max(...ys)-Math.min(...ys);});assert(Math.max(...rises(high))>25);assert(Math.max(...rises(low))<.1);const h=generateCourse({seed:'SHELF',width:40,doglegs:0});assert.notDeepEqual(h.leftEdge,h.rightEdge);const widths=Array.from({length:20},(_,i)=>h.width(35+i*14));assert(Math.max(...widths)/Math.min(...widths)>1.2);});

test('tees are sited on ground that suits them, and never on ground they may not use',()=>{
 // Tees used to go down the middle at a fixed fraction of the hole's length
 // and the land was forced to become a tee there. Now each pad tries a few
 // dozen nearby sites and takes the one the ground already suits, which is
 // where the variety comes from as well as the smaller earthworks.
 let tees=0,offCentre=0,staggered=0,onWrongGround=0,markerAdrift=0;
 for(const biome of ['pnw','mountain','links']) for(const seed of ['V1','V2','V3']){
  const w=generateWorld({seed,biome,holes:9,trees:0});
  for(const h of w.holes){
   const pads=Object.values(h.tees).map(t=>({t,p:teePad(t)})).filter(e=>e.p);
   assert(pads.length>0,'a hole with no tee pad at all');
   // Free to move, but not on to a green, into water, into sand, or off the
   // hole. Checked round the collar: half a pad on a green is as wrong as all
   // of it.
   for(const {t,p} of pads) for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    const c=Math.cos(a),n=Math.sin(a),hx=TEE_APRON.x,hz=p.rz*TEE_APRON_SCALE;
    const k=Math.min(Math.abs(c)>1e-6?hx/Math.abs(c):1e9,Math.abs(n)>1e-6?hz/Math.abs(n):1e9);
    const surf=localSurface(h,t.x+c*k,p.z+n*k);
    if(surf==='green'||surf==='fringe'||surf==='water'||surf==='sand')onWrongGround++;
   }
   const ys=[];
   for(const t of Object.values(h.tees)){
    tees++;
    const q=h.toWorld(t);ys.push(w.height(q.x,q.z));
    if(Math.abs(t.x-h.center(t.z))>6)offCentre++;
    // Wherever it ended up, a marker still has to stand on a pad.
    if(!pads.some(({t:o,p})=>teeBox(t.x-o.x,t.z-p.z,TEE_PAD.x,p.rz,TEE_ROUND)<0))markerAdrift++;
   }
   if(Math.max(...ys)-Math.min(...ys)>1)staggered++;
  }
 }
 assert(tees>=81,`only ${tees} tees in the fixture`);
 assert.equal(onWrongGround,0,`${onWrongGround} pad samples on ground a tee may not use`);
 assert.equal(markerAdrift,0,`${markerAdrift} markers standing off any pad`);
 // And the siting must actually be doing something. A generator that always
 // picked the original spot would pass everything above.
 assert(offCentre>tees/4,`only ${offCentre} of ${tees} tees moved off the centre line`);
 assert(staggered>0,'no hole has its tees at meaningfully different heights');
});

test('the back tee is never below the one in front, and a flat course keeps flat tees',()=>{
 // Each pad used to level itself independently to the landform at its own spot,
 // and the three sit at 0%, 9% and 18% down the hole -- so any hole that climbs
 // off the tee inverted them. Measured over 270 holes: 34% had at least one tee
 // stacked backwards, worst single step 2.9 m.
 let backwards=0,tees=0,lifted=0;
 for(const biome of ['pnw','mountain','links']) for(const seed of ['T1','T2','T3']){
  const w=generateWorld({seed,biome,holes:9,trees:0});
  for(const h of w.holes){
   // Object key order is back tee first.
   const ys=Object.values(h.tees).map(t=>{const q=h.toWorld(t);return w.height(q.x,q.z);});
   tees+=ys.length;
   for(let i=0;i<ys.length-1;i++)if(ys[i]<ys[i+1]-1e-6)backwards++;
   if(ys[0]>ys[ys.length-1]+.01)lifted++;
  }
 }
 assert(tees>=81,`only ${tees} tees in the fixture`);
 assert.equal(backwards,0,`${backwards} tees sit below the one in front of them`);
 // And the rule must not hold by flattening every complex to one level.
 assert(lifted>=tees/6,`only ${lifted} complexes have any stagger left`);

 // THE STEP CORRECTS AN INVERSION, IT DOES NOT MANUFACTURE A STAIRCASE.
 //
 // Elevation alone no longer means dead level -- the ground behind a tee keeps
 // its own relief whatever the elevation setting says, which is the owner's
 // call and the point of siting a tee on real ground. Turning BOTH terrain
 // controls off is what leaves nothing for a tee to follow, and then the tees
 // must come out level: anything else was invented here rather than found.
 // A fixed step once built 0.7 m of rise on such a course, and the sightline
 // lift, sampling a straight line in world space, cut a dogleg corner, found a
 // neighbouring green 2.3 m proud of the plain and raised a tee the full 3.5 m
 // to see over it.
 const flat=generateWorld({seed:'HEIGHT',elevation:0,landform:0,greenDifficulty:0,trees:0,water:0,bunkerCount:0});
 for(const h of flat.holes){
  const ys=Object.values(h.tees).map(t=>{const q=h.toWorld(t);return flat.height(q.x,q.z);});
  assert(Math.max(...ys)-Math.min(...ys)<.01,`tees vary by ${(Math.max(...ys)-Math.min(...ys)).toFixed(2)} m on a flat course`);
 }
});

test('decimal score totals remain exact for ties and exports',()=>{assert.equal(sumScores([2.11,2.22,3.1]),7.43);assert.equal(sumScores([1.11,1.11,1.11]),3.33);});

test('spin has a per-shot adjustment, in rpm, and it is a delta', () => {
 // Launch angle and spin axis each had a per-shot adjustment and spin had none,
 // so a shot could be flighted down or shaped but never deliberately spun.
 //
 // The UNIT is the point. The flight profile's spin control is a percentage
 // because it scales every club at once and stock spin runs 2700 rpm on a driver
 // to 9000 on a wedge -- one absolute number cannot serve both. A single shot is
 // one known club, so there the honest unit is the one a launch monitor reports.
 const clubs = customizeClubs();
 const stock = manualLaunch(clubs.iron7, 1, 1).spin;
 assert.equal(manualLaunch(clubs.iron7, 1, 1, {}, 0, 0, 0).spin, stock,
  'a zero adjustment must not change the shot');
 // A delta, not a multiplier or an absolute: +1000 rpm means +1000 rpm.
 for (const d of [-2000, -500, 750, 2500])
  assert.ok(Math.abs(manualLaunch(clubs.iron7, 1, 1, {}, 0, 0, d).spin - (stock + d)) < 1e-9,
   `${d} rpm did not move the shot by ${d} rpm`);
 // Being a delta is what lets it survive a change of club, which an absolute
 // could not: the same adjustment means the same thing on every club.
 for (const id of ['driver', 'wood', 'iron5', 'iron9', 'wedge']) {
  const base = manualLaunch(clubs[id], 1, 1).spin;
  assert.ok(Math.abs(manualLaunch(clubs[id], 1, 1, {}, 0, 0, 500).spin - (base + 500)) < 1e-9,
   `${id} did not take the adjustment`);
 }
 // Spin cannot go negative. A driver spins 2700, so the bottom of the slider
 // would otherwise drive it through zero and reverse the ball's rotation.
 assert.ok(manualLaunch(clubs.driver, 1, 1, {}, 0, 0, -2500).spin >= 0, 'spin went negative');
 assert.ok(manualLaunch(clubs.driver, 1, 1, {}, 0, 0, -9999).spin === 0, 'spin went negative');
 // And a putter still has none of it.
 assert.equal(manualLaunch(clubs.putter, 1, 1, {}, 0, 0, 2500).spin, 0);
});

test('the profile scales spin and the per-shot adjustment is added after', () => {
 // Two different jobs: the profile says what kind of player you are across the
 // bag, the adjustment says what you are doing with this one ball.
 const clubs = customizeClubs();
 const half = manualLaunch(clubs.iron7, 1, 1, {spin: 50}).spin;
 assert.ok(Math.abs(half - clubs.iron7.spin * .5) < 1e-9, 'the profile is not a percentage any more');
 assert.ok(Math.abs(manualLaunch(clubs.iron7, 1, 1, {spin: 50}, 0, 0, 400).spin - (half + 400)) < 1e-9,
  'the per-shot delta should be added to the scaled spin, not scaled by it');
});
