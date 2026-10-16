import projectLicense from '../LICENSE?raw';
// The notices live under docs/ with the rest of the documentation; LICENSE
// stays at the root, where a licence-detecting host looks for it. Both are
// INLINED INTO THE BUILD from here, which is the whole reason a copy of
// Fairway.html carries its own licences: moving either file without fixing
// this line does not fail a test, it fails the build.
import thirdPartyNotices from '../docs/THIRD_PARTY_NOTICES.txt?raw';
import {fairwayAim,makeHoleTour} from './camera-tours.js';
import {FOOTPRINTS,footprintIcon} from './footprints.js';
import {REPLAY_HOLD_SECONDS,SHOT_HOLD_SECONDS,HOLED_HOLD_SECONDS,REVIEW_HOLD_SECONDS,HOLE_REVEAL_MS,replayFinished,shotSettled,shotDistance} from './presentation.js';
import {planShotCamera,planReview} from './tv-camera.js';
import {aimTarget,localWind} from './shot-visuals.js';
import {playsLike} from './plays-like.js';
import {mapPosition,mapPoint,zoomAbout,panBy,MAP_NAV_NONE,MAP_ZOOM_MIN} from './course-map.js';
import {planCourse,planScorecard,enabledTees,playCameraMode,aimDelta} from './course-plan.js';
import {listRounds,findRound,saveRound,deleteRound,renameRound,suggestName,MAX_ROUNDS} from './round-library.js';
import {turfConfig,rollDeceleration,launchForDistance,struckDistance} from './turf.js';
import './style.css';
import {createIcons,icons} from 'lucide';
import {GolfView,drawMap} from './renderer.js';
import {TIME_RATES,RATE_LABELS,PRESETS,formatClock,phaseName,PHASE_ICONS,solarState,saveDaylight,localHour,wrapHour,showcaseHour,roundHour} from './daylight.js';
import {generateCourse,generateWorld,generateWorldSteps,DEFAULT_COURSE,BIOMES,localSurface} from './course.js';
import {makeGridPool} from './gen-pool.js';
import {Round,playsWith,FORMATS} from './game.js';
import {XP,XP_MULT,levelOf,holeXp,holeXpParts,shotXpParts,sumParts,onTheNumber,roundXp,withMult,award,takeBack,hasOnNumber,dailyXp,rangeXp,challengePay,CHALLENGE_PAY} from './progression.js';
import {loadProfiles,storeProfiles,addProfile,renameProfile,setMainProfile,deleteProfile,removeRound,findProfile,exportProfiles,importProfiles,profileByName,mainProfile,tallyShot,tallyMulligan,syncHole,profileSummary,sameGolfer,COUNTERS,BESTS,SCORE_TYPES,roundTotals,qualifies,MAX_PLAYER_NAME,setProfileBag,adoptDistances,setProfileMeter,meterDifficulty,setProfilePlay,setProfileWorn} from './profile.js';
import {rewardsOf,reward,unlocksBetween,wornItem,TRACERS,KIND_NAMES,WEARABLE,ACHIEVEMENT_TITLES,FRAMES,badgeName,highestBadge,meterSkin,METER_SKINS,flourishFor,goldFlourishes,SECRET_FLOURISHES} from './rewards.js';
import {playFlourish} from './flourishes.js';
import {CHALLENGES,GROUPS,MEDALS,challenge as challengeDef,challengesIn,recordChallenge,recordScore,scoreText as challengeScoreText,targetText,medalTargets,medalsFromRecords,challengeCourseSettings,CHALLENGE_COURSE_NAME,MEDAL_TOTAL} from './challenges.js';
import {newPlay,turn,playBall,results,ballFacts,progressText} from './challenge-play.js';
import {chooseHole,spotsFor,holeAdapter,zoneFor,callsFor} from './challenge-spots.js';
import {skins,decidedHoles,skinsWinner,holeSkinLine,skinsStatus,skinsText} from './skins.js';
import {isoWeek,weekIndex,weekKey,weeklySettings,recordWeekly,bestEverWeekly,WEEKLY_XP,weeklyChallenge,challengeWeekKey,recordChallengeWeek,WEEKLY_CHALLENGE_XP} from './weekly.js';
import {ACHIEVEMENTS,achievement,blankProgress,markOnce,sandSave,holeAchievements,roundAchievements,countedAchievements,earn,progressOf} from './achievements.js';
import {ballPixels} from './ball-finishes.js';
import {customizeClubs,manualLaunch,CLUB_KINDS,MAX_BAG,MAX_CLUB_NAME,stockBag,bagClubs} from './clubs.js';
import {startSwing,tap as meterTap,advance as meterAdvance,markerAt,inOverswing,swingLaunch,shapedLaunch,monitorLie,strikeZone,fullCarry,carryAtSpeed,previewTrack,puttFullRoll,puttRange,targetShare,swingZoom,lieFactor,LIE_NAMES,DIFFICULTIES,difficultyOf,DEFAULT_SHAPE,CURVES,HEIGHTS,SPIN_STEPS,shortGame,heightName,curveName,spinName,OVERSWING,MISS_AT,puttAccuracy} from './swing-meter.js';
import {puttingConfig,scoreText,sumScores} from './putting.js';
import {createLayout} from './layout.js';
import {createPopups} from './popups.js';
import {suggestCourseName} from './course-names.js';
import {SHOT_FIELDS,FIELD_GROUPS,fieldById,shotGrid,loadShotData,saveShotData,standardFields,moveField,liveRecord,COLUMN_CHOICES,maxFields,DEFAULT_COLUMNS} from './shot-data.js';
import {projectorFov,standForFov,aspectName} from './projector.js';
import {loadCamera,saveCamera,cameraRig,DEFAULT_CAMERA} from './camera-prefs.js';
import {effectiveTextSize,applyTextSize,maxTextSize,uiZoom,TEXT_SIZE} from './ui-scale.js';
import {framedForBall} from './camera.js';
import {buildLabel,deviceFacts,webglFacts,frameMeter,errorLog,diagnosticReport} from './diagnostic.js';
import {relativeToPar,parText,parSide,parTint,holeScoreName,holeOutLabel} from './scoring.js';
import {endlessHole,newRunSeed,endlessSettings} from './endless.js';
import {shotProfile,drawSideView,drawPlanView} from './shot-views.js';
import {ROLL_HOP,createRollHop,seedFor} from './roll-hop.js';
import {dispersionByClub,clubColour,MIN_GROUP} from './dispersion.js';
import {playerColour,playerTracer,PLAYER_INK} from './player-colours.js';
import {shotPlan,solveLaunch,outcome,greenSlope,envelope as labEnvelope,dropPlan,dropOutcome,jitterStream,groupStats} from './lab.js';
import {greenDistance,pinDayOf,pinBandFor,random} from './course.js';
import {FIRMNESS_PRESETS,FIRMNESS_NAMES,LAB_FIRMNESS_RANGE,firmnessValue,firmnessName} from './firmness.js';
import {RANGE_SETTINGS,GREEN_RANGE,DEFAULT_GREEN_YARDS,rangeGreenYards,moveRangeGreen,offlineOf,rangeTargets,SHOT_LINE_MAX,loadShotLines,saveShotLines} from './range.js';
import {simulateShot,parseLaunchMessage,MPH,YARD,clamp,rollPreview,R as BALL_R,outOfBounds,trunkRadius} from './physics.js';
import {reliefOptions,crossingPoint,OB_RULES} from './relief.js';
import {SCHEMA_VERSION,GENERATOR_VERSION,SETTINGS,FIELD,CATEGORIES,bound,validateSettings,migrateSettings,generationKeys,playScope} from './settings-schema.js';
import {listCourses,findCourse,saveCourse,deleteCourse,renameCourse,exportCourse,importCourse,courseSettings,MAX_NAME} from './course-library.js';
import {loadGraphics,saveGraphics,needsRebuild,greenCues,QUALITY,QUALITY_LABELS,FRAME_CAPS} from './graphics.js';
import {createAutoResolution} from './auto-resolution.js';
import {createGameAudio,canopyContacts,nearestWater} from './audio.js';
import {randomSettings} from './settings-schema.js';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=()=>createIcons({icons});
let tour=null;
let lastShot=null,priorShot=null,aimRange=null,aimPoint=null,lastMapFrame=0;
// Which numbers the card shows, and in how many columns. A display
// preference, so it lives beside graphics rather than in the course settings:
// it belongs to the screen, not to the round, and travels with neither a
// saved course nor a saved round.
// The tiles in force (the hand set, or the monitor set while armed), and which
// set the Shot data panel is editing -- null follows the one in force.
let shotPrefs=loadShotData(),shotDataEditing=null;
// Whether the ball is ON the green, kept from `updateHUD` so the render loop
// does not re-derive a surface sixty times a second.
let ballOnGreen=false;
// THE MAP FRAMES THE GREEN WHENEVER THE BALL IS ON IT. Asked as a question
// rather than read from `ballOnGreen`, because `updateExplorer` runs BEFORE
// `updateHUD` when a shot finishes: a cached answer titles the map one pass
// late, so the heading and the picture disagree for a frame. A surface lookup
// is cheap; being right is not optional.
const onGreen=()=>{
 try{return appMode==='play'&&!rangeMode&&course.surface(round.position.x,round.position.z)==='green';}
 catch{return false;}
};
// Every tracer played on this hole, and whether the hole-summary orbit is up.
let holeTrails=[],holeSummary=0,summaryCamera=null;
// How many tracers the player wants left on the field behind them.
let shotLinePref=loadShotLines();
// WHICH SHOT THE 2D VIEWS ARE SHOWING. Follows the last shot on its own, so the
// panel is live if you just leave it open, and is pinned to a row when one is
// chosen from the shot list. Cleared when a session starts.
let viewShot=null;
// Per-club dispersion for the map. Recomputed when a shot lands rather than
// per frame: the map redraws many times a second and this walks every shot of
// the session.
let dispersion=[];
let showDispersion=true;
// The legend says how many shots each circle is made of, because a circle drawn
// from three balls and one drawn from forty look identical and mean very
// different things.
function drawDispersionLegend(){
 const box=$('dispersionLegend');if(!box)return;
 if(!showDispersion){box.innerHTML='';return;}
 if(!dispersion.length){
  box.innerHTML=`<p class="note">A club draws once it has ${MIN_GROUP} shots. The ellipse covers every ball that club hit and lies along the way it actually misses, so it is only as wide as the variation you produced — the simulator adds no miss of its own, and a club fed identical numbers groups on a point.</p>`;
  return;
 }
 // Both axes, long first: a group 40 yards deep and 12 wide is a very different
 // club from one that is 20 by 20, and a single number cannot say which you have.
 box.innerHTML=dispersion.map(g=>`<div class="legend-row"><i style="background:${clubColour(g.club,.95)}"></i>`
  +`<b>${escape(g.club)}</b><span>${g.n} shots · ${(g.long*2/YARD).toFixed(0)} × ${(g.wide*2/YARD).toFixed(0)} yd</span></div>`).join('');
}
function refreshDispersion(){
 dispersion=(rangeMode&&showDispersion)
  ?dispersionByClub(rangeShots,{origin:course?.tees?.white??course?.tee})
  :[];
 if($('map'))$('map').mapDispersion=dispersion;
}
// On a practice ground `holeTrails` is CAPPED, so it stops being a count of the
// session and this takes that job over. The card reads it, and getting this
// wrong would have made the shot number stick at 51 forever.
let practiceShots=0;
const resetTrails=()=>{holeTrails=[];practiceShots=0;viewShot=null;};
// A trail carries WHO HIT IT. Recorded at the moment the ball settles, which is
// before `round.takeShot` advances the turn, so `round.active` is still the
// golfer who struck it rather than whoever is up next.
function pushTrail(points,player=round.active){
 holeTrails.push({points,player,colour:playerTracer(player),style:seatLooks(player).tracer});practiceShots++;
 if(rangeMode&&holeTrails.length>SHOT_LINE_MAX)holeTrails.splice(0,holeTrails.length-SHOT_LINE_MAX);
}
// The tail the setting asks for. Zero is a real answer -- a clear field -- and
// `setShotHistory` hides every line before it draws, so passing [] clears them.
const visibleTrails=()=>shotLinePref?holeTrails.slice(-shotLinePref):[];
// THE FIVE NUMBERS A LAUNCH MONITOR SENDS, and the only five this simulator
// needs: ball speed, launch angle, launch direction, spin rate, spin axis.
// Everything else a Garmin R50 reports is about the CLUB, and the club never
// enters this model -- the ball's own numbers decide the shot.
//
// Null means "whatever the preset asks for". Firing a preset fills all five in,
// so the panel always shows the shot that is on screen, and `take shot` fires
// exactly what is displayed.
let labLaunch={speed:null,vla:null,hla:null,spin:null,axis:null};
// What is currently typed in the shot box. Held here rather than read off the
// element, because the lab bar redraws on every firmness or green-speed change
// and would otherwise wipe what you were half way through pasting.
let labShotText='';
const labShotLine=l=>l.speed===null?'':`${l.speed}, ${l.vla}, ${l.hla}, ${l.spin}, ${l.axis}`;
let advanceTimer=null,advanceCountdown=null,completionTimer=null;
let clubs=customizeClubs(),layout=null,popups=null,dropState=null,staleGenerator=false,puttPreview=null;
// menu -> the entry point; studio -> shaping a landscape, no round on show;
// play -> the golf. Generation controls exist only in studio, course selection
// only in play, so neither mode can quietly change the other's state.
// THE ERROR LOG IS INSTALLED BEFORE ANYTHING ELSE CAN THROW.
//
// It exists so a tester's report can carry what went wrong, and a tester will
// never open a console to find out. Installed at module scope rather than in
// boot(): the interesting failures are the ones during start-up, and a hook
// installed after boot misses precisely those.
//
// It wraps console.error and always calls through to it. A logger that
// swallowed what it logged would make this harder to debug, not easier.
// THE HOME-SCREEN MANIFEST, LINKED ONLY WHEN THE GAME IS SERVED FROM A WEB ADDRESS.
//
// Hosted -- on Netlify, say -- the manifest is what lets a phone add the game to
// its home screen with an icon and open it like an app. But a <link
// rel="manifest"> is FETCHED as the page loads, and the portable file opened
// from disk has no manifest beside it: that fetch fails with an error in the
// console, and the portable file promises it makes no requests at all. So it is
// linked here, at run time, and only over http or https. The path is relative,
// so it resolves wherever the game is hosted -- a site's root or a sub-folder.
if(/^https?:$/.test(location.protocol)){
 const link=document.createElement('link');
 link.rel='manifest';link.href='manifest.webmanifest';
 // WITH THE VISITOR'S LOGIN. A manifest is fetched without credentials unless
 // the link asks otherwise, so on a password-protected host -- the owner's
 // Netlify site is private -- it came back 401 even though the page itself had
 // loaded. The manifest's icons are inside it as data URLs, so this is the one
 // extra request the hosted game makes, and it now carries the login.
 link.crossOrigin='use-credentials';
 document.head.append(link);
}
const diagnosticErrors=errorLog();
diagnosticErrors.install();
// Fed from the frame loop below. A fixed ring, so it costs nothing and cannot
// grow, and it measures the frames that were actually DELIVERED -- sampled
// past the frame cap, so a capped run reports the rate it is capped to rather
// than the rate the display offered.
const diagnosticFrames=frameMeter();
let appMode='menu',studioDirty=false,studioBiome=null,graphics=loadGraphics();
// TEXT SIZE (ui-scale.js). Applied before anything is laid out, again whenever the
// setting or the bay changes, and on a resize: automatic in a bay depends on how
// many CSS pixels wide the browser is.
function currentTextSize(){return effectiveTextSize(graphics.textSize,view?.config??loadCamera(),innerWidth,innerHeight);}
// The view is resized too: two text sizes can leave the play area the same size
// in its own pixels (2560 at 200% and 1920 at 150% are both 1280 wide), so its
// resize watcher never fires, and the pixel ratio -- which carries the zoom --
// would keep the old one.
function applyUiScale(){applyTextSize(currentTextSize());view?.resize?.();textSizeNote();}
function textSizeNote(){
 const n=document.getElementById('gfxTextNote');if(!n)return;
 const cam=view?.config??loadCamera(),now=currentTextSize();
 const max=maxTextSize(innerWidth,innerHeight),capped=graphics.textSize!=='auto'&&graphics.textSize>max;
 n.textContent=(graphics.textSize!=='auto'?`Set by hand at ${now}%.`
  :cam.sim?`Automatic: sized for your bay -- ${now}%, so text looks at least as large from where you stand as it does on a laptop.`
  :'Automatic: 100% at a desk. In simulator bay mode it is sized from your screen and how far back you stand.')
  +(capped?` This screen holds up to ${max}%, so that is what is drawn.`:'');
}
// THE COURSE THE PLAYER WAS ON BEFORE THEY STEPPED INTO THE LAB OR THE RANGE.
//
// Both of those REPLACE `settings` wholesale rather than editing it, because
// both are a different world -- one hand-built hole, fixed seed, no elevation.
// That left two marks on the way out. The seed, biome, style and bag all reverted
// to defaults, and `range: true` survived the trip, so the next thing to read
// `settings` built a driving range: course studio generated one every time.
let savedCourse=null;
const rememberCourse=()=>{if(!settings.range)savedCourse={...settings};};
// The range and the lab force hole-out putting on their throwaway round, which
// used to be the ONLY copy of the setting: visiting the range silently reset a
// player's Dartboard or Decimal choice, and starting a round from inside the
// range carried hole-out into it. The player's own choice waits here instead.
let savedPutting=null;
const rememberPutting=()=>{if(!rangeMode)savedPutting=round.putting;};
const playerPutting=()=>savedPutting||round.putting;
// Hands the choice back and forgets it -- called once on the way out of practice.
const restorePutting=()=>{const p=playerPutting();savedPutting=null;return p;};
const PUTTING_MODES=`<option value="holeout">Hole out · make every putt</option><option value="dartboard">Dartboard · 1, 2 or 3 putts</option><option value="decimal">Decimal · distance-based putts</option>`;
const PUTTING_NOTES={holeout:'Make the ball in the cup. No gimme radius. The 107.95 mm cup has a recessed liner and the ball is 42.67 mm across. The camera you have set up stays as it is.',dartboard:'Inside the first circle: 1 putt. Between the first and second: 2 putts. From the second through the third circle: 3 putts. Beyond the outer circle is also capped at 3. Circles are drawn only on the green.',decimal:'Inside the first circle: 1.00 putt. Between circles, the score increases linearly: halfway from 1 to 2 is 1.50 putts, halfway from 2 to 3 is 2.50. Beyond the last circle is capped at 3.00. Scores retain two decimal places. In scramble, choose the team result before the putts are added.'};
// Distance fields for either surface. `id` prefixes them so the round panel and
// the putting panel can both be in the DOM without colliding.
const puttingFields=(id,p)=>['one','two','three'].map((key,i)=>`<label class="field">${i+1}-putt distance (yd)<input id="${id}-${key}" type="number" min=".1" max="100" step=".1" value="${p[key]}"></label>`).join('');
const readPutting=id=>puttingConfig({mode:$(id+'Mode').value,...Object.fromEntries(['one','two','three'].map(k=>[k,Number($(id+'-'+k).value)]))});
// Writes to whichever copy is live: the player's held choice while they are in
// the range or the lab, the round itself otherwise.
const applyPutting=cfg=>{if(savedPutting)savedPutting=cfg;else{round.putting=cfg;round.gimme=0;view.setPutting(cfg);}};
const puttingGuard=()=>{if(flight||round.scrambleSelection||round.candidates.length)throw Error('Finish this shot or team selection before changing putting.');};
// Strip the range marks off a settings object. Belt and braces for the stored
// copy: a save written before this fix still carries them.
// A default landscape that keeps what belongs to the PLAYER rather than to the
// world -- their style, their bag, their turf. Used when
// all we have is a range: spreading the range's own settings back over the
// defaults would carry its elevation 0 and its flat greens into a course.
const courseFallback=s=>({...DEFAULT_COURSE,
 style:s?.style??'cartoon',
 ...(s?.clubYardages?{clubYardages:s.clubYardages}:{}),
 ...(s?.turf?{turf:s.turf}:{})});
const courseOnly=s=>{
 if(!s?.range)return s;
 const{range,...rest}=s;
 // Only the RANGE'S OWN marks are undone. A seed or hole count the player chose
 // is theirs -- blanket-resetting to DEFAULT_COURSE here would have thrown away
 // the studio settings they had just entered.
 return {...rest,
  seed:(rest.seed==='RANGE'||rest.seed==='LAB')?DEFAULT_COURSE.seed:rest.seed,
  holes:rest.holes===1?DEFAULT_COURSE.holes:rest.holes};
};
const restoreCourse=()=>{
 round.putting=restorePutting();
 if(savedCourse){settings={...savedCourse};savedCourse=null;}
 else if(settings.range)settings=courseFallback(settings);
};
// While the menu is up the scene shows a one-hole showcase with the camera
// circling it, rather than a real round the player has not asked for yet. Any
// saved round waits in pendingRound until they choose to continue it.
let menuBackdrop=false,pendingRound=null,backdropRun=null,playerClock=null;
// Every generation setting, at its schema default. This used to be a hand-written
// partial copy holding eleven of the thirty-eight, which was fine until something
// read it before a course had been loaded: Course studio renders each control
// straight from here, so the twenty-seven missing keys came out as `undefined`
// captions over sliders the browser had quietly parked at the midpoint of their
// range. The defaults live in the schema; there is no second copy of them now.
// THE PLAYERS' PROFILES, read before the first Round is made so that round
// starts with the main one. Null until the welcome has asked for a name.
let profiles=loadProfiles();
// Every new group starts with the main profile as player 1.
const useMainProfile=()=>{const m=mainProfile(profiles);if(m)Round.defaultPlayer={name:m.name,team:'A',hand:'RH',profile:m.id};};
useMainProfile();
// The round's out-of-bounds rule is a player preference: chosen once in Format &
// tees, it stays for every round until changed.
const RULES_KEY='fairway-rules-v1';
try{const r=JSON.parse(localStorage.getItem(RULES_KEY)||'null');if(OB_RULES[r?.outOfBounds])Round.defaultOutOfBounds=r.outOfBounds;if(typeof r?.monitorLie==='boolean')Round.defaultMonitorLie=r.monitorLie;}catch{}
// Both round rules a group sets and the next round starts with, written together
// so changing one never forgets the other.
const saveRules=()=>{try{localStorage.setItem(RULES_KEY,JSON.stringify({outOfBounds:Round.defaultOutOfBounds,monitorLie:Round.defaultMonitorLie}));}catch{}};
let settings={...DEFAULT_COURSE,style:'cartoon'},round=new Round(),course,world,worldKey='',view,aim=0,shotShape={...DEFAULT_SHAPE},swing=null,flight=null,latest=null,ws=null,monitorConnected=false,armed=false,armSwitch=false,monitorDevice=null,panel=null,toastTimer,keys=new Set(),gamepadLast=[],lastTick=performance.now();
// A TAP THAT NO FRAME SAW. Aim and power move while an arrow is held, read once
// per frame, so a key pressed and released between two frames used to do
// nothing at all -- at 60 fps a human tap spans several frames and always
// counted, but on a machine managing 20 a quick one could vanish, and Help
// promises the arrows "fine tune". Every key-down lands here as well as in
// `keys`, and the frame loop treats it as held for exactly one frame before
// clearing it. Holding is unchanged; only the lost tap is rescued.
const tapped=new Set();
// COPYING, WITH THE OLD WAY AS THE FALLBACK. `navigator.clipboard` needs a
// secure context AND the document to be focused, and it rejects rather than
// prompting when it is not -- which is every embedded preview, and any window
// that lost focus between the click and the promise. `execCommand('copy')` is
// deprecated and has neither requirement, so it is what catches those. The
// textarea is off-screen rather than hidden, because a `display:none` element
// cannot be selected and the copy silently does nothing.
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true;}catch{}
 try{
  const box=document.createElement('textarea');
  box.value=text;box.setAttribute('readonly','');
  box.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(box);box.select();
  const ok=document.execCommand('copy');
  box.remove();
  return ok;
 }catch{return false;}
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
// THE MENU BACKDROP IS NOT A ROUND AND MUST NEVER BE WRITTEN HERE. The showcase
// hole behind the menu builds a throwaway `Round` so the camera has something to
// circle, and something on the way into the menu called `save()` with it -- so
// after every visit to the menu the one slot held a fresh nine-hole round nobody
// had played, and the next launch offered Continue on it. It is also what
// resurrected a round the player had just discarded: the slot was cleared, the
// backdrop grew, and the backdrop wrote itself straight back into it.
function save(){if(menuBackdrop||challenge||challengeStarting)return;try{localStorage.setItem('fairway-round-v1',JSON.stringify(saveRecord()));}catch{}syncProfile();}
// WHICH PROFILE A GOLFER IS. By the id the group editor gave them; a golfer
// with none -- a save from before profiles -- by name, ignoring case. Null on
// the menu's showcase hole, which is nobody's round.
function profileOf(player){
 if(!profiles||!player||menuBackdrop)return null;
 return findProfile(profiles,player.profile)||profileByName(profiles,player.name);
}
// What a golfer's history needs to know about this round, or null when it is
// not one the history keeps: the range (and the lab, which runs on it) never is.
function profileMeta(seat){
 if(rangeMode||!course)return null;
 return {id:round.uid,me:seat,mode:round.mode,players:round.players.length,tee:round.tee,holes:round.endless?null:round.holes,endless:round.endless,finished:round.finished,
  // The recipe for "Replay this course": generation settings for a course,
  // the run's seed for an endless one, whose holes are grown from it.
  course:{name:playingCourseName(),settings:round.endless?null:courseSettings(settings),seed:round.endless?round.seed:settings.seed,biome:settings.biome,generator:GENERATOR_VERSION,schema:SCHEMA_VERSION}};
}
const holeFacts=()=>({index:round.hole,par:course.par,yards:Math.round(course.tees?.[round.tee]?.yards||0)});
// THE CARD, COPIED INTO EVERY GOLFER'S HISTORY. save() runs whenever the round
// changes -- a shot, a scramble choice, a mulligan, a golfer joining -- so a
// history can never disagree with the scorecard. It also runs for things that
// change nothing here, like a green-reading toggle, so the store is only written
// when some golfer's record for this hole actually moved.
let profileSynced='';
function syncProfile(){
 if(!profiles||rangeMode||!course||menuBackdrop||challenge||challengeStarting)return;
 const rows=round.players.map((p,seat)=>({prof:profileOf(p),seat,score:round.cards[seat]?.[round.hole],putts:round.puttCards[seat]?.[round.hole]})).filter(r=>r.prof);
 const key=[round.uid,round.hole,round.holeComplete,round.finished,...rows.map(r=>`${r.prof.id}:${r.seat}:${r.score}:${r.putts}`)].join('|');
 if(key===profileSynced)return;profileSynced=key;
 for(const r of rows)syncHole(r.prof,profileMeta(r.seat),{...holeFacts(),score:r.score,putts:r.putts});
 // XP FOR THE HOLE AND THE ROUND (Phase 4). Worked out from the card on every
 // save and kept under one key per hole, so a hole is never paid twice and a
 // mulligan that un-holes a putt takes the hole's XP back with it.
 const was=new Map(rows.map(r=>[r.prof.id,levelOf(r.prof.xp).level]));
 for(const r of rows){
  const h=r.prof.rounds.find(e=>e.id===round.uid)?.card?.[round.hole]||{},before=r.prof.xp||0,items=[];
  const parts=Number.isFinite(r.score)?holeXpParts({strokes:r.score,par:course.par,fairway:!!h.fairway,gir:!!h.gir}):[],mult=xpMult(r.seat);
  const got=award(r.prof,`${round.uid}:h${round.hole}`,withMult(sumParts(parts),mult));
  // A hole paid in full is told part by part; a re-scored one (a mulligan, a
  // decimal putting change) as one line.
  if(got>0)items.push(...(got===withMult(sumParts(parts),mult)?parts:[{label:'Hole re-scored',xp:got}]));
  skinsXp(r.prof,r.seat,items);
  if(round.finished&&!round.endless&&roundXp(round.holes)){
   if(award(r.prof,`${round.uid}:round`,roundXp(round.holes))>0)items.push({label:`Finished ${round.holes} holes`,xp:roundXp(round.holes)});
   if(award(r.prof,`${round.uid}:win`,wonRound(r.seat)?XP.win:0)>0)items.push({label:{match:'Won the match',scramble:'Won the scramble',skins:'Won the skins'}[round.mode],xp:XP.win});
   if(dailyXp(r.prof)>0)items.push({label:'First round today',xp:XP.daily});
  }
  // ACHIEVEMENTS (Phase 7, achievements.js): the hole's -- a birdie, an ace, an
  // up-and-down from sand -- and, once the round is over, the round's.
  const earned=[],prog=(r.prof.progress||=blankProgress());
  if(Number.isFinite(r.score)){
   earned.push(...holeAchievements({score:r.score,par:course.par}));
   if(sandSave(h.sand,r.score)&&markOnce(prog,`${round.uid}:h${round.hole}:sand`))r.prof.counters.sandSaves=(r.prof.counters.sandSaves||0)+1;
  }
  if(round.finished&&!round.endless&&markOnce(prog,`${round.uid}:done`)){
   prog.rounds++;if(settings.biome&&!prog.biomes.includes(settings.biome))prog.biomes.push(settings.biome);
   const card=r.prof.rounds.find(e=>e.id===round.uid)?.card||[];
   earned.push(...roundAchievements({holes:card.map(c=>c&&{par:c.par,score:c.score,fairway:c.fairway}),index:profileSummary(r.prof).handicap.index,floodlit:!!view.daylight?.floodlights,biome:settings.biome}));
   weeklyRoundDone(r.prof,r.seat,items);
   skinsRoundDone(r.prof,r.seat);
  }
  earned.push(...countedAchievements(r.prof));
  payAchievements(r.prof,earned,items);
  queueXpGain(r.prof,items,before,mult);
 }
 for(const r of rows){const now=levelOf(r.prof.xp).level;if(now>was.get(r.prof.id))queueLevelUp(r.prof,now,was.get(r.prof.id));}
 storeProfiles(profiles);
}
// WHAT A GOLFER WEARS (Phase 5; rewards.js, ball-finishes.js): their ball
// finish, tracer and title, each what they chose if their level has earned it
// and the starting look if not. Someone with no profile -- the menu's showcase
// hole -- wears the starting look.
function looksOf(prof){
 const level=prof?levelOf(prof.xp).level:1,w=prof?.worn,e=prof?.achievements;
 return {level,ball:wornItem(w,'ball',level),tracer:wornItem(w,'tracer',level),title:wornItem(w,'title',level,e),frame:wornItem(w,'frame',level),skin:wornItem(w,'skin',level)};
}
const seatLooks=seat=>looksOf(profileOf(round?.players?.[seat]));
// Pay newly earned achievements through the ledger (one key each, so never
// twice) and name them in the XP popup; a toast says when one brings a title.
// THE COURSE OF THE WEEK, FINISHED (Phase 7, weekly.js): the golfer's gross
// score for the eighteen -- their team's in a scramble -- recorded for the
// week; 150 XP for the first finished round of the week, 50 for beating their
// best that week; and the week counted for the Streak achievement.
// SKINS (skins.js; a round format since 16 October 2026). 30 XP a skin, paid
// the moment the hole is decided, one ledger key a hole: every hole up to the
// one being played is worked out again from the card on each save, so a
// mulligan that undoes the winning putt takes its skins back, and a skin
// decided while a golfer without a profile holed out last is still paid.
// Not multiplied by the Swing Meter difficulty -- like the round's own XP it
// is for the result, not the swing. A round the Skins CHALLENGE already paid
// at its finish (`<round>:skins`) is not paid again hole by hole.
function skinsXp(prof,seat,items){
 if(round.mode!=='skins'||prof.xpLog?.[`${round.uid}:skins`])return;
 const k=skins(round.cards,decidedHoles(round));
 for(let h=0;h<=round.hole;h++){
  const e=k.perHole[h],xp=e&&e.winner===seat?e.value*XP.skin:0;
  if(award(prof,`${round.uid}:skin:h${h}`,xp)>0)items.push({label:`Won ${skinsText(e.value)}`,xp});
 }
}
// A SKINS ROUND, FINISHED: the skins won go on the record (My profile).
function skinsRoundDone(prof,seat){
 if(round.mode!=='skins')return;
 recordChallenge(prof,'skins',skins(round.cards,decidedHoles(round)).won[seat]||0);
}
function weeklyRoundDone(prof,seat,items){
 if(!round.weekly)return;
 const team=round.players[seat]?.team,card=round.mode==='scramble'?round.teamCards[team]:round.cards[seat];
 if(!card||card.filter(Number.isFinite).length<round.holes)return;
 const score=Math.round(sumScores(card)),got=recordWeekly(prof,round.weekly,score);
 if(got.first&&award(prof,`${round.weekly}:first`,WEEKLY_XP.first)>0)items.push({label:'Course of the week',xp:WEEKLY_XP.first});
 if(got.better&&award(prof,`${round.uid}:weekbest`,WEEKLY_XP.best)>0)items.push({label:'Best this week',xp:WEEKLY_XP.best});
 const prog=(prof.progress||=blankProgress()),w=weekIndex();if(!prog.weeks.includes(w))prog.weeks.push(w);
}
function payAchievements(prof,ids,items){
 for(const id of earn(prof,ids)){
  const a=achievement(id);
  if(award(prof,`ach:${id}`,a.xp)>0)items.push({label:`Achievement: ${a.name}`,xp:a.xp});
  if(a.title)toast(`${prof.name} earned ${a.name}, and the title “${a.title}”. Wear it from My profile.`);
 }
}
const titleName=id=>id?reward('title',id)?.name||'':'';
// THE METER SKIN (Phase 6, rewards.js METER_SKINS): colours set on the meter
// as custom properties its stylesheet reads; zones and timing untouched.
function applyMeterSkin(id){
 const el=$('swingMeter');if(!el||el.dataset.skin===id)return;
 const s=meterSkin(id);el.dataset.skin=id;
 for(const [k,v] of Object.entries({track:s.track,edge:s.edge,zone:s.zone,perfect:s.perfect,marker:s.marker,target:s.target,flash:s.flash}))el.style.setProperty('--sm-'+k,v);
 el.toggleAttribute('data-rainbow',!!s.rainbow);
}
// THE BALL AS A PICTURE: the finish drawn face on (ball-finishes.js
// ballPixels, the rule the 3D ball is painted from), as an image, kept per
// finish and size. The profile picture everywhere the golfer is shown.
const ballPics=new Map();
function ballPicture(id,size=96){
 const k=id+':'+size;
 if(!ballPics.has(k)){const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').putImageData(new ImageData(ballPixels(id,size),size,size),0,0);ballPics.set(k,c.toDataURL());}
 return ballPics.get(k);
}
// THE FRAME (Phase 6): a ring of the badge's metal round the picture -- the
// image's own padding over a background of it. Fairway Master's moves.
// A plain colour is one colour all round; an animated frame hands its three
// colours to the movement style.css names by `data-anim` (15 October 2026).
const frameAttr=id=>{const f=FRAMES[id]||FRAMES.rookie;
 if(f.solid)return ` style="--frame:${f.solid}"`;
 if(f.anim)return ` style="--f1:${f.colours[0]};--f2:${f.colours[1]};--f3:${f.colours[2]}" data-anim="${f.anim}"`;
 return ` style="--frame:conic-gradient(from 210deg,${f.from},${f.to},${f.from},${f.to},${f.from})"${f.rainbow?' data-rainbow':''}`;};
// AN ANIMATED FRAME BREAKS OUT OF ITS RING (the owner, 15 October 2026: "the
// flames look like the profile icon is actually on fire, not just a weird
// circle around it"): the picture sits in a wrapper whose two layers, drawn by
// style.css per `data-fx`, burn, sparkle, ripple or drift beyond the circle.
const framedPicture=(ball,frame,cls='')=>{
 const img=`<img class="ball-avatar framed${cls?' '+cls:''}" src="${ballPicture(ball)}" alt="" aria-hidden="true"${frameAttr(frame)}>`,fx=FRAMES[frame];
 return fx?.anim?`<span class="frame-fx" data-fx="${fx.anim}" style="--f1:${fx.colours[0]};--f2:${fx.colours[1]};--f3:${fx.colours[2]}">${img}</span>`:img;
};
const ballAvatar=(prof,cls='')=>{const l=looksOf(prof);return framedPicture(l.ball,l.frame,cls);};
// THE CHALLENGES IN PLAY (16 October 2026: challenges.js is the table,
// challenge-play.js the rules, challenge-spots.js where the balls go).
//
// START. A hole challenge grows the Challenge Course -- one fixed course for
// everybody (the owner, 16 October 2026) -- like any round, then goes to the
// hole its rule picks with `challenge` set, so nothing about it is saved or
// counted as a round. A range challenge opens the range. Either way the
// putting is hole out while it lasts, and the golfer's own setting comes back
// with the next round (`restorePutting`).
// THE CHALLENGE OF THE WEEK (`week`, weekly.js) is the date's pick, played on
// the course of the week (range ones on the range) with spots seeded from the
// week's seed; a week whose course has no hole for it plays the next of the
// cycle that fits, and says so.
async function startChallenge(id,group,{week=false}={}){
 const wk=week?weeklyChallenge():null;
 if(wk)id=wk.id;
 let def=challengeDef(id);
 const weekFor=d=>wk?{key:challengeWeekKey(d.id),index:wk.index}:null;
 // From a range challenge's results card, *Other challenges* starts the next
 // one while still on the range: leave it first, as the menu would, or a
 // course challenge would play in range mode and a range one would remember
 // the range as the course to go back to.
 if(rangeMode){rangeMode=false;closeRangeBox();restoreCourse();}
 if(def.where==='range'){
  // Entering the range saves the round slot (it keeps the course to go back
  // to), so a range challenge holds saving off until `challenge` is set: a
  // smoke run found Curve it writing the slot, 16 October 2026.
  challengeStarting=true;
  try{
   await enterRange({players:group.players,challenge:true});
   if(!rangeMode||appMode!=='play')return;
   const mat=round.position,marks=rangeTargets();
   const targets=(def.targets||[]).map(y=>{const t=marks.find(m=>m.yards===y);return t?{x:t.x,z:t.z,yards:y}:{x:mat.x,z:mat.z+y*YARD,yards:y};});
   beginChallenge(def,{seed:`range:${def.id}`,spots:[],targets,pin:course.pin,length:0,name:'the driving range',week:weekFor(def)});
  }finally{challengeStarting=false;}
  return;
 }
 const s=wk?weeklySettings():challengeCourseSettings(),name=wk?`${suggestCourseName(s)} · Week ${isoWeek().week}`:CHALLENGE_COURSE_NAME;
 await startRoundOn(s,{...group,mode:'stroke'},name,{quiet:true});
 if(appMode!=='play'||!world)return;
 const holes=world.holes.map(h=>({par:h.par,length:h.routeLength}));
 const tryPick=d=>chooseHole(d,holes,i=>d.spot?spotsFor(d,holeAdapter(world.holes[i],round.tee),`${s.seed}:${i}:${d.id}`):[]);
 let pick=tryPick(def);
 if(!pick&&wk)for(const other of wk.next.map(challengeDef).filter(d=>d.where!=='range')){const p=tryPick(other);if(p){toast(`This week's course has no hole for ${def.name}: ${other.name} instead.`);def=other;pick=p;break;}}
 if(!pick){toast(`${name} has no hole for ${def.name} in this version of Fairway.`);return;}
 // Moving to the hole saves (loadCourse), and `challenge` is only set once the
 // hole is loaded: hold saving off in between, or the Challenge Course's round
 // lands in the Continue slot (the smoke journey caught it, 16 October 2026).
 challengeStarting=true;
 try{
  rememberPutting();round.putting={...round.putting,mode:'holeout'};
  round.hole=pick.hole;round.beginHole();loadCourse();
  beginChallenge(def,{seed:`${s.seed}:${pick.hole}:${def.id}`,spots:pick.spots,targets:[],pin:course.pin,length:course.routeLength/YARD,name,hole:pick.hole,week:weekFor(def)});
 }finally{challengeStarting=false;}
}
// A golfer's driver carry, in yards, from their own bag: what the distance
// medals are measured against. No driver: the longest club.
function driverCarry(player){
 let bag;try{bag=bagFor(player);}catch{bag=stockBag();}
 const d=bag.find(c=>c.kind==='driver');return d?d.carry:Math.max(...bag.map(c=>c.carry));
}
function beginChallenge(def,{seed,spots,targets,pin,length,name,hole=null,week=null}){
 const ctx=round.players.map(p=>({driver:driverCarry(p),hand:p.hand==='LH'?'LH':'RH'}));
 if(def.ball==='zone'){const a=holeAdapter(course,round.tee);for(const c of ctx)c.zone=zoneFor(a,c.driver);
  if(ctx.some(c=>!c.zone)){toast('No fairway for the zone on this hole.');return;}}
 const calls=callsFor(def,seed,{driver:Math.min(...ctx.map(c=>c.driver))});
 challenge={id:def.id,def,name,hole,week,info:{seats:round.players.length,spots,targets,calls,ctx,pin,length},uid:'c'+Date.now().toString(36),done:false,summary:null};
 challenge.play=newPlay(def.id,challenge.info);
 round.active=0;round.strokes=round.players.map(()=>0);
 placeForTurn();setUpTurn();
 toast(`${week?'Challenge of the week: ':''}${def.name}${hole!=null?` on hole ${hole+1}`:''} of ${name}.`);
}
// THE BALL ABOUT TO BE PLAYED: on its spot, back on the tee (or the mat),
// or -- playing a spot out -- where the last one stopped. `aimAt` is where the
// turn starts aimed: the range target, the zone, or the called carry.
function placeForTurn(from=null){
 const c=challenge,t=turn(c.play),seat=t.seat,p=from||t.spot;
 if(p)round.positions[seat]={x:p.x,z:p.z};
 else if(!rangeMode){const tee=course.tees[round.tee]||Object.values(course.tees)[0];round.positions[seat]={x:tee.x,z:tee.z};}
 round.active=seat;round.teePlaced=true;round.strokes[seat]=c.def.order==='spotOut'?t.strokes:0;
 const at=round.positions[seat];
 c.aimAt=t.target?{x:t.target.x,z:t.target.z}:t.zone?{...t.zone}:typeof t.call==='number'?{x:at.x,z:at.z+t.call*YARD}:null;
}
// THE CLUB FOR A TURN: the one the challenge asks for (the nearest the bag
// holds), or the one for the distance to what it aims at.
function challengeClub(){
 const c=challenge,p=round.position;if(!c||course.surface(p.x,p.z)==='green')return;
 const list=Object.entries(clubs).filter(([id])=>id!=='putter');
 if(c.def.club){const want=CLUB_KINDS[c.def.club]?.carry??150,id=list.find(([,k])=>k.kind===c.def.club)?.[0]||list.sort((a,b)=>Math.abs(a[1].carry-want)-Math.abs(b[1].carry-want))[0]?.[0];if(id)$('club').value=id;}
 else if(c.aimAt){const d=Math.hypot(c.aimAt.x-p.x,c.aimAt.z-p.z)/YARD;$('club').value=list.sort((a,b)=>Math.abs(a[1].carry-d)-Math.abs(b[1].carry-d))[0][0];}
 $('monClub').value=$('club').value;
}
// EVERY BALL goes to the play (challenge-play.js), which says what it scored
// and who is up; this only puts the next ball down.
function challengeShot(result){
 const c=challenge;if(c.done)return;
 const origin=lastShot?.shot?.origin||round.position,rest=result.hazard?null:course.surface(result.end.x,result.end.z);
 const e=playBall(c.play,ballFacts({origin,result,rest,club:lastShot?.kind||null}));
 if(e.text)toast(e.text);
 if(e.done){finishChallenge();return;}
 placeForTurn(e.again?e.from:null);setUpTurn();
}
// THE END: each golfer's score and medal, their record, and the pay
// (progression.js `challengePay`: first medals once, a play's pay inside the
// day's allowance, a new best once a day) -- one ledger entry a golfer a play.
// The week's challenge keeps its own best for the week instead of the
// challenge's record (it is a different course), pays its own (weekly.js
// `recordChallengeWeek`), and counts the week towards Weekly Regular. Then
// the medal achievements.
function finishChallenge(){
 const c=challenge;c.done=true;
 c.summary=results(c.play).map(r=>{
  const p=round.players[r.seat],prof=profileOf(p);let best=false,capped=false,weekBest=false;
  if(prof){
   settleMedals(prof);
   const before=prof.xp||0,mult=xpMult(r.seat);
   best=c.week?false:recordChallenge(prof,c.id,r.score);
   const pay=challengePay(prof,{id:c.id,medal:r.medal,best,long:!!c.def.long,mult});capped=pay.capped;
   const items=[...pay.parts];let xp=pay.xp;
   if(c.week){
    const w=recordChallengeWeek(prof,c.week.key,r.score,r.medal,Date.now(),mult);items.push(...w.parts);xp+=w.xp;weekBest=w.first||w.better;
    const prog=(prof.progress||=blankProgress());(prog.chalWeeks||=[]);if(!prog.chalWeeks.includes(c.week.index))prog.chalWeeks.push(c.week.index);
   }
   if(xp>0)award(prof,`chal:${c.uid}:${r.seat}`,xp);
   payAchievements(prof,countedAchievements(prof),items);
   if(items.length)queueXpGain(prof,items,before,mult);
  }
  return {name:p.name,seat:r.seat,text:r.text,medal:r.medal,best,weekBest,capped};
 });
 storeProfiles(profiles);drawChallengeBar();
 setTimeout(()=>{if(challenge===c)openPanel('challenge');},1800);
}
// Old records turn into medals once, before a golfer's first medal is paid
// (challenges.js `medalsFromRecords`), measured against their own driver.
function settleMedals(prof){if(prof&&!prof.medals&&medalsFromRecords(prof,{driver:driverCarry({profile:prof.id,name:prof.name})}))return true;return false;}
// THE BAR beside the shot controls: which challenge, who is up, which ball,
// the call, the score so far.
function drawChallengeBar(){
 const el=$('challengeBar');if(!el)return;
 el.hidden=!challenge||appMode!=='play';if(el.hidden)return;
 const c=challenge;
 el.innerHTML=`<b>${c.week?'This week · ':''}${escape(c.def.name)}</b><span>${round.players.length>1&&!c.done?escape(round.player.name)+' · ':''}${escape(progressText(c.play))}</span>`;
}
const MEDAL_PIPS=m=>`<span class="medal-pips" aria-label="${m?MEDALS[m]:'No medal'}">${[1,2,3].map(k=>`<i class="m${k}${m>=k?' on':''}"></i>`).join('')}</span>`;
function renderChallengeResult(content){
 const c=challenge;
 if(!c?.summary){content.innerHTML='<p>No challenge has finished.</p>';return;}
 content.innerHTML=`<p>${c.week?'Challenge of the week: ':''}<b>${escape(c.def.name)}</b>${c.hole!=null?` on hole ${c.hole+1} of`:' on'} ${escape(c.name)}.</p><ul class="challenge-results">${c.summary.map(s=>`<li><span class="player-dot" style="background:${playerColour(s.seat)}"></span><b>${escape(s.name)}</b>${MEDAL_PIPS(s.medal)}<span>${escape(s.text)}${s.medal?` · ${MEDALS[s.medal].toLowerCase()}`:''}${s.best?' · <em>a new best</em>':''}${s.weekBest?' · <em>best this week</em>':''}</span></li>`).join('')}</ul>`
  +(c.summary.some(s=>s.capped)?`<p class="note">Today's challenge XP for playing again is used up (${CHALLENGE_PAY.dayCap} a day). Medals and records still count, and first medals still pay.</p>`:'')
  +`<div class="course-card-actions"><button class="primary" id="challengeAgain">Play it again</button><button class="secondary" id="challengeOthers">Other challenges</button><button class="secondary" id="challengeMenu">Main menu</button></div>`;
 $('challengeAgain').onclick=()=>{
  challenge={...c,uid:'c'+Date.now().toString(36),done:false,summary:null,play:newPlay(c.id,c.info)};
  closePanel();round.strokes=round.players.map(()=>0);placeForTurn();setUpTurn();
 };
 $('challengeOthers').onclick=()=>{challengeSetup=true;openPanel('round');};
 $('challengeMenu').onclick=()=>{closePanel();openMenu();};
}
// THE CHALLENGES SCREEN: a tab for each group, a card for each challenge with
// its medals and the best, and under them the chosen one -- how it plays, what
// each medal asks, the group, Start. Nothing is locked.
let challengeTab='tee',challengeWeekPick=false;
// The week's challenge, as its card and the screen say it: which, where, and
// the main golfer's best and medal this week.
function weekChallengeInfo(me){
 const wk=weeklyChallenge(),def=challengeDef(wk.id),s=weeklySettings(),rec=me?.challengeWeek?.[challengeWeekKey(wk.id)];
 const where=def.where==='range'?'on the driving range':`on the course of the week (week ${isoWeek().week}, ${BIOMES[s.biome]?.name||s.biome})`;
 return {def,where,rec,best:rec?.best!=null?challengeScoreText(def,rec.best):null};
}
function renderChallengeSetup(content){
 const me=mainProfile(profiles);if(settleMedals(me))storeProfiles(profiles);
 if(!challengeDef(challengePick))challengePick=CHALLENGES[0].id;
 if(!GROUPS.some(g=>g.id===challengeTab))challengeTab=challengeDef(challengePick).group;
 const week=weekChallengeInfo(me);
 const def=challengeWeekPick?week.def:challengeDef(challengePick),medals=me?.medals||{},have=g=>challengesIn(g).reduce((a,c)=>a+(medals[c.id]||0),0);
 const weekCard=`<button class="chal-card chal-week${challengeWeekPick?' on':''}" data-chal-week aria-pressed="${challengeWeekPick}"><small>Challenge of the week · until Sunday</small><b>${escape(week.def.name)}</b>${MEDAL_PIPS(week.rec?.medal||0)}<small>${escape(week.where)}${week.best?` · your best this week ${escape(week.best)}`:''}</small></button>`;
 const tab=g=>`<button class="panel-tab${challengeTab===g.id?' active':''}" role="tab" aria-selected="${challengeTab===g.id}" data-chal-tab="${g.id}">${escape(g.name)} <small>${have(g.id)}/${challengesIn(g.id).length*3}</small></button>`;
 const card=c=>`<button class="chal-card${!challengeWeekPick&&c.id===challengePick?' on':''}" data-challenge="${c.id}" aria-pressed="${!challengeWeekPick&&c.id===challengePick}"><b>${escape(c.name)}</b>${MEDAL_PIPS(medals[c.id]||0)}<small>${me?escape(bestText(me,c.id)):''}</small></button>`;
 const ctx={driver:me?driverCarry({profile:me.id,name:me.name}):250,length:160};
 const asks=medalTargets(def,ctx).map((v,i)=>`<li>${MEDAL_PIPS(i+1)}<b>${MEDALS[i+1]}</b><span>${escape(def.scale==='lengthFeet'?`within ${Math.round(def.medals[i]*100)}% of the hole's length`:targetText(def,v))}${medals[def.id]>i?' · yours':''}</span></li>`).join('');
 const where=challengeWeekPick?`This week everyone plays it ${week.where}, the same balls on every copy of Fairway. The first finish this week earns ${WEEKLY_CHALLENGE_XP.first} XP, beating your best this week ${WEEKLY_CHALLENGE_XP.better} (once a day), and a gold ${WEEKLY_CHALLENGE_XP.gold} (once a week), besides the challenge's own medals.`
  :def.where==='range'?'On the driving range.':`On ${CHALLENGE_COURSE_NAME}, the same holes for everyone.`;
 const mine=!me?'':challengeWeekPick?(week.best?`${me.name}'s best this week: ${week.best}.`:`${me.name} has not played it this week.`):challengeRecordText(me,def.id);
 content.innerHTML=`<div class="chal-cards chal-week-row">${weekCard}</div>`
  +`<div class="panel-tabs chal-tabs" role="tablist" aria-label="Challenges">${GROUPS.map(tab).join('')}</div>`
  +`<div class="chal-cards">${challengesIn(challengeTab).map(card).join('')}</div>`
  +`<h3>${challengeWeekPick?'This week: ':''}${escape(def.name)}</h3><p>${escape(def.how)}</p><p class="note">${escape(where)}${def.scale==='driverPlus'||def.scale==='driverShare'?` Medals are measured against your own driver (${Math.round(ctx.driver)} yd in your bag).`:''}</p>`
  +`<ul class="medal-asks">${asks}</ul>${mine?`<p class="note">${escape(mine)}</p>`:''}`
  +`<h3>Your group</h3><div class="players-list" id="playerRows"></div><p id="formatNote" class="note"></p><p class="field-error" id="roundError"></p>`
  +`<button class="primary" data-panel-action id="challengeGo">Start ${escape(def.name)} <i data-lucide="arrow-right"></i></button>`
  +`<p class="note">Skins is a round format now: choose it under <em>Format</em> when you start a round from Play.</p>`;
 content.querySelectorAll('[data-chal-tab]').forEach(b=>b.onclick=()=>{challengeTab=b.dataset.chalTab;challengePick=challengesIn(challengeTab)[0].id;challengeWeekPick=false;openPanel('round');});
 content.querySelectorAll('[data-challenge]').forEach(b=>b.onclick=()=>{challengePick=b.dataset.challenge;challengeWeekPick=false;openPanel('round');});
 content.querySelector('[data-chal-week]').onclick=()=>{challengeWeekPick=true;openPanel('round');};
 groupEditor('playerRows',round.players,()=>{});
 $('challengeGo').onclick=async()=>{
  if(flight){toast('Finish the current shot first.');return;}
  let group;
  try{const g=readDraft();group={players:g,mode:'stroke',tee:round.tee||'blue'};new Round(group);}
  catch(e){$('roundError').textContent=e.message;return;}
  challengeSetup=false;closePanel();
  try{await startChallenge(def.id,group,{week:challengeWeekPick});}catch(e){toast(e.message);}
 };
}
const bestText=(prof,id)=>{const def=challengeDef(id),s=recordScore(id,prof.challenges?.[id]);return s==null?'Not played':`Best ${challengeScoreText(def,s)}`;};
const challengeRecordText=(prof,id)=>{const r=prof.challenges?.[id];
 if(id==='skins')return `${prof.name}: ${r.won} skin${r.won===1?'':'s'} in ${r.games} game${r.games===1?'':'s'}.`;
 const def=challengeDef(id),s=recordScore(id,r);
 return s==null?`${prof.name} has no record here yet.`:`${prof.name}'s best: ${challengeScoreText(def,s)}${r.plays?` · played ${r.plays} time${r.plays===1?'':'s'}`:''}.`;};
// MY PROFILE: the medals, then the records -- every challenge played, by tab,
// and the skins won in skins rounds, which are kept with them (challenges.js).
function challengeRecords(profile){
 if(settleMedals(profile))storeProfiles(profiles);
 const r=profile.challenges||{},m=profile.medals||{},count=k=>Object.values(m).filter(v=>v===k).length;
 const rows=[...CHALLENGES,{id:'skins',name:'Skins'}].filter(c=>r[c.id]),week=weekChallengeInfo(profile);
 if(!rows.length&&!Object.keys(m).length&&!week.rec)return '';
 return `<h3>Challenges</h3><p class="note">${count(3)} gold · ${count(2)} silver · ${count(1)} bronze, from ${CHALLENGES.length} challenges.</p>`
  +`<p class="note">This week: ${escape(week.def.name)}, ${escape(week.where)}. ${week.best?`Best this week ${escape(week.best)}.`:'Not played yet this week.'}</p>`
  +(rows.length?`<ul class="achievement-list">${rows.map(c=>`<li class="achievement earned"><b>${escape(c.name)}</b>${c.id==='skins'?'':MEDAL_PIPS(m[c.id]||0)}<span>${escape(challengeRecordText(profile,c.id))}</span></li>`).join('')}</ul>`:'');
}
// THE XP MULTIPLIER for a golfer's hole: their Swing Meter difficulty (Easy
// 0.75, Normal 1, Hard 1.5), or 1 if they played it off a launch monitor.
// Read from how their last shot on this hole was struck; with none yet, from
// how they play.
const shotInputs=new Map();
function xpMult(seat){
 const p=round.players[seat],how=shotInputs.get(`${round.uid}:${round.hole}:${seat}`)??(playsWith(p)==='meter'||!armSwitch?'meter':'monitor');
 return how==='monitor'?XP_MULT.monitor:XP_MULT[meterDifficulty(profileOf(p))]??1;
}
// Won a match (best ball, by holes), a scramble (lowest team total), or the
// skins (the most skins alone, skins.js).
function wonRound(seat){
 const team=round.players[seat]?.team;
 if(round.mode==='match'){const d=(round.match?.A||0)-(round.match?.B||0);return d!==0&&team===(d>0?'A':'B');}
 if(round.mode==='scramble'){const teams=[...new Set(round.players.map(p=>p.team))];if(teams.length<2)return false;
  const tot=Object.fromEntries(teams.map(t=>[t,sumScores(round.teamCards[t])])),best=Math.min(...Object.values(tot));
  return tot[team]===best&&Object.values(tot).filter(v=>v===best).length===1;}
 if(round.mode==='skins')return skinsWinner(skins(round.cards,decidedHoles(round)).won)===seat;
 return false;
}
// THE XP POPUP (the owner, 14 October 2026): whenever a golfer gains XP, what
// earned it, the amount, and their level bar filling from where it was to where
// it is -- running over into the next level when it crosses one. Gains made at
// the same moment are one popup; popups queue. At the top of the screen, so it
// sits beside the hole-out banner rather than over it. With a sound for the gain
// and the fill once the owner has picked them (sound.js XP_SOUNDS; audio.js
// plays nothing until then).
const xpQueue=[];let xpTimer=null;
function queueXpGain(prof,items,before,mult=1){
 const gained=(prof.xp||0)-before;
 if(gained<=0||!items.length)return;
 const last=xpQueue.at(-1);
 if(last&&last.id===prof.id&&!last.shown){last.items.push(...items);last.after=prof.xp;last.gained+=gained;}
 else xpQueue.push({id:prof.id,name:prof.name,items:[...items],before,after:prof.xp,gained,mult});
 if(!xpTimer)xpTimer=setTimeout(()=>{xpTimer=null;showXpGain();},120);
}
// THE POPUP'S TIMING (the owner, 14 October 2026): its sounds one at a time,
// never on top of each other or of the hole's own. It waits for the hole's
// score sting to finish -- XP_AFTER_STING after the hole-out banner comes up,
// not the banner's whole stay, which left the screen still for nearly three
// seconds (the owner's second look, same day) -- then the gain; a beat;
// the fill; and on a level-up the bar stops at the top, the level-up sound plays
// on its own, and only after it does the bar fill on into the new level.
// PLACED: XP_FILL_AT after the gain, XP_FILL_MS a fill, XP_LEVEL_AT after a
// fill reaches the top, XP_LEVEL_HOLD for the level-up sound to finish, and
// XP_LINGER after the last fill; XP_AFTER_STING covers the longest chiptune
// sting (about 1.05 s at the owner's length) with a gap after it.
// tools/sound-lab/xp.html's demo copies them.
const XP_FILL_AT=650,XP_FILL_MS=700,XP_LEVEL_AT=300,XP_LEVEL_HOLD=1400,XP_LINGER=1700,XP_AFTER_STING=1600;
// Whether the popup, or the level-up banner after it, still has something to
// show: the scorecard waits for both (showHoleCompletion).
const xpBusy=()=>!!(xpQueue.length||levelUps.length||($('xpGain')&&!$('xpGain').hidden)||($('levelUp')&&!$('levelUp').hidden));
function showXpGain(){
 if(xpTimer||!xpQueue.length)return;
 const sting=XP_AFTER_STING-(performance.now()-holeOutAt);
 if($('holeOut')&&!$('holeOut').hidden&&sting>0){xpTimer=setTimeout(()=>{xpTimer=null;showXpGain();},sting);return;}
 const g=xpQueue.shift(),el=$('xpGain');if(!el)return;g.shown=true;
 const from=levelOf(g.before),to=levelOf(g.after),pct=l=>Math.round(l.into/l.need*100);
 const multNote=g.mult!==1?`<li class="xp-mult"><span>${g.mult>1?'Hard':'Easy'} ×${g.mult}</span></li>`:'';
 el.innerHTML=`<div class="xp-top"><b>+${g.gained} XP</b>${round.players.length>1?`<span>${escape(g.name)}</span>`:''}</div>`
  +`<ul class="xp-items">${g.items.map(i=>`<li><span>${escape(i.label)}</span><b>+${i.xp}</b></li>`).join('')}${multNote}</ul>`
  +`<div class="xp-level"><i class="level-badge">${from.level}</i><span class="xp-bar"><b style="width:${pct(from)}%"></b></span><small>${to.into.toLocaleString()} / ${to.need.toLocaleString()}</small></div>`;
 el.dataset.shown=String((Number(el.dataset.shown)||0)+1);
 el.hidden=true;void el.offsetWidth;el.hidden=false;
 gameAudio?.xpSound?.('gain');
 // The fill: to the end of the bar and over for each level crossed, then on to
 // where it now is.
 const bar=el.querySelector('.xp-bar b'),badge=el.querySelector('.level-badge');
 const steps=[];for(let l=from.level;l<to.level;l++)steps.push({w:100,next:l+1});steps.push({w:pct(to)});
 let i=0;const run=()=>{const s=steps[i++];if(!s)return;
  bar.style.transition=`width ${XP_FILL_MS}ms cubic-bezier(.3,.7,.3,1)`;bar.style.width=s.w+'%';gameAudio?.xpSound?.('fill');
  if(s.next)setTimeout(()=>{badge.textContent=s.next;el.classList.add('levelled');gameAudio?.xpSound?.('levelUp');
   setTimeout(()=>{bar.style.transition='none';bar.style.width='0%';void bar.offsetWidth;run();},XP_LEVEL_HOLD);},XP_FILL_MS+XP_LEVEL_AT);};
 el.classList.remove('levelled');
 setTimeout(run,XP_FILL_AT);
 const levels=steps.length-1;
 xpTimer=setTimeout(()=>{el.hidden=true;xpTimer=null;showXpGain();showLevelUp();},XP_FILL_AT+steps.length*XP_FILL_MS+levels*(XP_LEVEL_AT+XP_LEVEL_HOLD)+XP_LINGER);
}
// THE LEVEL-UP BANNER waits for the hole-out banner, so the score is read first.
const levelUps=[];let levelUpTimer=null;
// It names what the new level brought (rewards.js unlocksBetween) -- every
// level crossed, when one gain crosses several -- with the golfer's ball and title.
function queueLevelUp(prof,level,from=level-1){
 const got=unlocksBetween(from,level);
 const look=looksOf(prof);
 levelUps.push({name:prof.name,level,ball:look.ball,frame:look.frame,title:titleName(look.title),got});if(!levelUpTimer)levelUpTimer=setTimeout(()=>{levelUpTimer=null;showLevelUp();},450);}
function showLevelUp(){
 if(levelUpTimer||!levelUps.length)return;
 if(($('holeOut')&&!$('holeOut').hidden)||($('xpGain')&&!$('xpGain').hidden)||xpQueue.length){levelUpTimer=setTimeout(()=>{levelUpTimer=null;showLevelUp();},500);return;}
 const u=levelUps.shift(),el=$('levelUp');if(!el)return;
 const got=u.got.length?`<ul class="level-up-got">${u.got.slice(0,5).map(r=>`<li>New ${escape(KIND_NAMES[r.kind])}: <b>${escape(r.name)}</b></li>`).join('')}${u.got.length>5?`<li>and ${u.got.length-5} more</li>`:''}</ul>`:'';
 el.innerHTML=`${framedPicture(u.ball,u.frame)}<small>LEVEL UP</small><strong>Level ${u.level}</strong><span>${escape(u.name)}${u.title?` · <i>${escape(u.title)}</i>`:''}</span>${got}`;
 el.hidden=true;void el.offsetWidth;el.hidden=false;
 levelUpTimer=setTimeout(()=>{el.hidden=true;levelUpTimer=null;showLevelUp();},u.got.length?4200:2800);
}
// ONE BALL, AS ITS GOLFER'S PROFILE COUNTS IT. `before` is what was true before
// the round moved on: who hit, which stroke this was, and where it was played from.
function recordProfileShot(result,before){
 if(challenge)return;
 const prof=profileOf(round.players[before.seat]);if(!prof)return;
 const bestsBefore={...prof.bests},levelBefore=levelOf(prof.xp).level;
 const shot=latest?.shot,range=rangeMode,meta=range?null:profileMeta(before.seat);
 const pin=course?.pin,rest=result.hazard||!course?null:course.surface(result.end.x,result.end.z);
 tallyShot(prof,{range,lie:before.lie,rest,hazard:result.hazard||null,holed:!!result.holed&&!result.hazard,lipped:!!result.lipped,
  trees:result.treeHits||0,houses:result.homeHits||0,yards:(result.total||0)/YARD,airtime:result.time,mph:shot?(shot.lie?.measured?shot.lie.before:shot.speed)/MPH:NaN,
  teeShot:before.stroke===1,driver:before.driver,stroke:before.stroke,
  puttFeet:before.lie==='green'&&shot&&pin?Math.hypot(shot.origin.x-pin.x,shot.origin.z-pin.z)/.3048:NaN,
  strokes:before.stroke+(result.hazard?1:0),hole:meta?holeFacts():null},meta);
 // XP FOR THE SHOT (Phase 4), kept under its stroke so a mulligan takes it back.
 // On the number: where it came down -- the first bounce on the ground, or where
 // it stopped -- within 5% of the aim distance of the aim point; once a hole,
 // never for a putt. On the range, that alone, as a capped trickle.
 const L=lastShot,putt=before.lie==='green'||L?.kind==='putter';
 const landed=(result.contacts||[]).find(c=>Number.isFinite(c.x)&&['green','fringe','fairway','tee','semi','rough','sand'].includes(c.what))||result.end;
 const on=!result.hazard&&!putt&&onTheNumber(landed,L?.aimAt,L?.aimDist);
 const xpBefore=prof.xp||0;
 if(range){if(on){const got=rangeXp(prof);if(got)queueXpGain(prof,[{label:'On the number',xp:got}],xpBefore,1);}}
 else{
  const prefix=`${round.uid}:h${round.hole}:`,stroke=before.stroke,mult=xpMult(before.seat),items=[];
  const bests=['longestDrive','longestPutt','ballSpeed'].filter(k=>(prof.bests[k]||0)>(bestsBefore[k]||0)).length;
  if(on&&!hasOnNumber(prof,prefix,stroke)&&award(prof,`${prefix}s${stroke}:number`,withMult(XP.onNumber,mult),{stroke})>0){
   items.push({label:'On the number',xp:XP.onNumber});
   prof.counters.onNumber=(prof.counters.onNumber||0)+1;payAchievements(prof,countedAchievements(prof),items);
  }
  const holed=!!result.holed&&!result.hazard,puttFeet=before.lie==='green'&&shot&&pin?Math.hypot(shot.origin.x-pin.x,shot.origin.z-pin.z)/.3048:0;
  const parts=shotXpParts({holed,fromGreen:before.lie==='green',teeShot:stroke===1,puttFeet,bests});
  if(award(prof,`${prefix}s${stroke}:shot`,withMult(sumParts(parts),mult),{stroke})>0)items.push(...parts);
  queueXpGain(prof,items,xpBefore,mult);
 }
 const levelNow=levelOf(prof.xp).level;if(levelNow>levelBefore)queueLevelUp(prof,levelNow,levelBefore);
 storeProfiles(profiles);
}
// DISCARD HAS TO ACTUALLY DISCARD. "This round and its scores are gone" was a
// lie: the guard cleared `pendingRound` in memory and left the autosave slot
// alone, so the next reload read it back and offered Continue on the round the
// player had just been told was gone. The one slot is the only thing anything
// removes, which is why this is the only `removeItem` in the app.
function clearSave(){try{localStorage.removeItem('fairway-round-v1');}catch{}}
// A ROUND'S SAVED CAMERA IS NO LONGER THE CAMERA. Camera settings are device
// preferences now -- they describe the room you are standing in, so they have to
// be the same in play, the range and the studio, and they must not arrive inside
// a round somebody shares. What a round legitimately carries is which green
// reading overlays were switched on, because that is a property of the putt you
// were in the middle of.
const ROUND_CAMERA_KEYS=['greenGrid','greenFlow','greenHeat'];
const roundCamera=()=>Object.fromEntries(ROUND_CAMERA_KEYS.map(k=>[k,!!view.config[k]]));
function applyRoundCamera(saved){
 if(!saved||typeof saved!=='object')return;
 for(const k of ROUND_CAMERA_KEYS)if(typeof saved[k]==='boolean')view.config[k]=saved[k];
}
// PLAY-SCOPE SETTINGS: what belongs to the GOLFER rather than to the ground.
// These are not schema keys -- they ride along in the same object and are
// validated by their own modules -- so anything that rebuilds `settings` from
// `DEFAULT_COURSE` drops them silently rather than resetting them to a default
// you could see. `courseFallback` has always carried them out of the range; the
// endless path did not, and reset a player's bag every time they reloaded.
// `PLAY_KEYS` and `playScope` live in the schema module, next to the comment
// that explains why these keys are not schema fields in the first place.
// An endless run is a seed and a hole number, so its settings are grown rather
// than stored -- but the golfer's own are carried across, because they were
// never part of what the seed decides. `style` is deliberately NOT carried:
// endless forces cartoon, which is the mode's own choice and not a loss.
const endlessFor=(seed,hole,from)=>({...endlessSettings(endlessHole(seed,hole)),...playScope(from)});
// Carrying the keys is only half of it -- they have to be made live. Boot and
// import each did this by hand and `resumeRound` did not, so resuming a round
// saved under a different bag played it with the CURRENT one while the bag panel
// showed the saved yardages. One helper, called everywhere settings arrive from
// storage.
function applyPlaySettings(){
 syncClubs();
 // The ball-flight profile went with the Swing Meter (14 October 2026); a save
 // from before is migrated without it, and this catches a copy already in memory.
 delete settings.flightProfile;
 turfConfig(settings.turf);
}
// THE BAG IS THE GOLFER'S (12 October 2026). Each profile keeps its own clubs --
// names, kinds and carries the player chose -- and `clubs` is always the bag of
// whoever is up, so it is re-read every turn (`setUpTurn`) and after every edit.
// A golfer with no bag yet plays the stock one. A player with no profile on this
// device (a round from another device) plays the distances the round carried,
// the old device-wide `clubYardages`, or stock. It REPLACES the rule that a
// round resumes under the bag it was saved with: the bag now belongs to the
// golfer and travels in their profile and its backup file, not in the round.
function bagFor(player){
 const p=profileOf(player);
 if(p)return p.bag??stockBag();
 return stockBag(settings.clubYardages);
}
let clubPicker='';
function syncClubs(){
 let next;try{next=bagClubs(bagFor(round?.player));}catch{next=bagClubs(stockBag());}
 clubs=next;
 // The picker is rebuilt only when the clubs in it change, so a turn passing
 // between golfers with the same bag leaves the chosen club alone.
 const key=JSON.stringify(Object.entries(clubs).map(([id,c])=>[id,c.label]));
 if(key===clubPicker)return;
 clubPicker=key;
 const was=$('club').value,options=Object.entries(clubs).map(([id,c])=>`<option value="${id}">${escape(c.label)}</option>`).join('');
 $('club').innerHTML=options;$('monClub').innerHTML=options;
 $('club').value=clubs[was]?was:Object.keys(clubs)[0];$('monClub').value=$('club').value;
}
// ONCE: the distances that used to be one set for the whole device become the
// bag of every golfer who has none yet, then stop being a setting. They lived in
// the round slot's settings, which is what `settings` holds at boot.
function adoptDeviceBag(){
 if(!settings.clubYardages||!profiles)return;
 adoptDistances(profiles,settings.clubYardages);storeProfiles(profiles);delete settings.clubYardages;
}
// Every persisted or exported round carries both versions. The schema version
// drives silent migration; the generator version is what tells a later build
// that rebuilding this seed will not reproduce the ground it was played on.
// `save()` fires on course load and after every shot, so it fires while the lab
// and the range are open too -- and those replace `settings` wholesale. Writing
// that to disk persisted `range: true`, and after a reload EVERY world built
// from it was a driving range, the course studio included. A range is not a
// course and is never what a save should record, so the stored copy is the one
// taken on the way in.
function saveRecord(){return {version:2,schema:SCHEMA_VERSION,generator:GENERATOR_VERSION,settings:round.endless?{...DEFAULT_COURSE,seed:settings.seed||'EVERGREEN',...playScope(settings)}:courseOnly(savedCourse??settings),round:round.toJSON(),camera:flight?.replay?flight.camera:roundCamera()};}
// The generator version belongs in this key, so a build whose generator changed
// rebuilds the world even when every setting and the seed are identical. Shared
// with the menu backdrop, which needs to build its world under the key
// loadCourse will later look for -- otherwise the cache misses and the hole you
// were looking at is thrown away and grown again.
// `range` is deliberately in the key and `rangeGreen` deliberately is not: the
 // range is a different world from a course, but moving its green is four floats
 // in the cup atlas and must not throw the landscape away.
const worldKeyFor=s=>JSON.stringify([GENERATOR_VERSION,s.range?'range':'',...generationKeys().map(k=>s[k])]);
// Settling `settings` into the exact shape the world is keyed on.
//
// Pulled out of loadCourse so `prepareWorld` can key on the same thing without a
// second copy of these rules -- the world cache misses silently if the two ever
// disagree, and a different course appears than the one that was chosen.
// SAFE TO RUN TWICE: after the first pass `settings.holes` equals `round.holes`,
// so the yardage rescale on the line below stops applying. prepareWorld calls
// this and then loadCourse calls it again on the way through.
function settleSettings(){
 settings.style='cartoon';settings.turf=turfConfig(settings.turf);
 if(!settings.range&&!round.endless&&settings.holes&&settings.holes!==round.holes&&settings.courseYards)settings.courseYards*=round.holes/settings.holes;
 // No tee toggles: all three sets are always built and the playing tee is a round
 // setting. Re-adding them here would reinstate the keys migration just removed.
 // The range is one hand-built hole and is never rescaled to a round's length:
 // the whole point of it is that it is the same 500 yards every visit.
 settings=settings.range?{...RANGE_SETTINGS,...settings,range:true,holes:1}
  :round.endless?{...DEFAULT_COURSE,...settings,holes:1}
  :{...DEFAULT_COURSE,...settings,courseYards:settings.courseYards||round.holes*360,holes:round.holes===18?18:9};
 return worldKeyFor(settings);
}
// Build the world for wherever the round is about to be, yielding to the browser
// as it goes, and leave it in the cache `loadCourse` reads. loadCourse stays
// synchronous: by the time it runs the world it wants is already there, so its
// own generate branch is a no-op. Skipping this entirely -- the studio's
// regenerate, say -- just means loadCourse builds it the old blocking way.
async function prepareWorld(onProgress){
 const key=settleSettings();
 if(world&&key===worldKey)return;
 lastShot=null;priorShot=null;
 world=await generateProgressively(settings,onProgress);
 worldKey=key;
}
// WHICH HOLE OF THE BUILT WORLD a round's hole is drawn from. An endless run
// grows one hole at a time, so its world holds exactly one -- index 0 -- whatever
// hole number the player has reached. Asking the renderer for `round.hole` there
// asks for a hole that does not exist: Replay on endless hole 2 did exactly that,
// threw on every frame after and left the round unplayable (6 October).
const worldHole=n=>round.endless?0:n;
function loadCourse(){
 stopTour();cancelAdvance();endHoleSummary();resetTrails();resetMapNav();view.clearShotHistory?.();if(round.hole===0&&!round.teePlaced){lastShot=null;priorShot=null;}
 const key=settleSettings();
 if(!world||key!==worldKey){lastShot=null;priorShot=null;world=generateWorld(settings);worldKey=key;}if(view.world!==world||view.style!==settings.style)view.build(world,settings.style,worldHole(round.hole));else view.setHole(worldHole(round.hole));
 // An endless run grows one hole at a time, so the world it just built holds
 // exactly one whichever hole number the player has reached.
 const holeIndex=worldHole(round.hole);
 course=world.holes[holeIndex];
 // What the hole was worth is recorded now, because the landscape behind it is
 // thrown away the moment the next one grows and the scorecard still needs par.
 round.pars[round.hole]=course.par;
 round.placeTee(course.tees);view.setPutting(round.putting);latest=null;showStandingResult();setUpTurn();updateExplorer();requestAnimationFrame(updateExplorer);save();
}
function updateExplorer(){
 const free=view.config.mode==='free';$('holeFlyover').setAttribute('aria-label',tour?'Stop hole flyover':'Hole flyover');$('holeFlyover').title=tour?'Stop hole flyover':'Hole flyover';$('world').dataset.artDirection=settings.style;$('map').setAttribute('aria-label',free||view.config.mode==='overview'?'Whole course map; click to fly':'Hole map; click to aim');$('world').classList.toggle('exploring',free);$('exploreBar').hidden=!free;$('freeView').classList.toggle('selected',free);$('playerView').classList.toggle('selected',view.config.mode==='player');$('overview').classList.toggle('selected',view.config.mode==='overview');if($('greenView'))$('greenView').classList.toggle('selected',view.config.mode==='green');
 $('mapTitle').textContent=round.endless?`HOLE ${round.hole+1} OVERVIEW`:['free','overview'].includes(view.config.mode)?`${world.holes.length} HOLE COURSE`:`HOLE ${(flight?.replay?view.course.hole:round.hole)+1} OVERVIEW`;
 // The title says when the map is not showing the whole thing. Without it a
 // zoomed map that was left zoomed reads as a generation bug -- half a hole.
 // The same applies doubly to the green frame: twenty yards of putting surface
 // under the heading "HOLE 04 OVERVIEW" reads as the map having lost the hole.
 if(onGreen())$('mapTitle').textContent='GREEN · CONTOURS';
 {const z=$('map')?.mapNav?.zoom??1;
  if(z>1.02)$('mapTitle').textContent+=` · ${z.toFixed(1)}×`;}
 $('exploreHole').innerHTML=world.holes.map(h=>`<option value="${h.hole}">Hole ${h.hole+1} · Par ${h.par}</option>`).join('');$('exploreHole').value=round.hole;
  drawMap($('map'),flight?.replay?view.course:course,flight?.replay?lastShot.shot.origin:round.position,round.candidates,['free','overview'].includes(view.config.mode),view.camera.position,flight||dropState?null:aimPoint,view.elapsed);
}

function distance(){return Math.hypot(round.position.x-course.pin.x,round.position.z-course.pin.z);}
// MIXED GROUPS (Phase 3, 14 October 2026): the Armed switch is the golfer's
// choice for the DEVICE (`armSwitch`); `armed` -- what everything else reads --
// is whether THIS turn plays off the monitor: switched on, connected, and the
// golfer up plays with the monitor (game.js `playsWith`). A golfer set to the
// Swing Meter gets the meter on their turn, with the monitor window down to its
// strip, and a ball hit into the monitor then is refused as unarmed. With no
// golfer set to the meter, `armed` is the switch, exactly as before.
function syncArmed(){
 const was=armed;
 armed=armSwitch&&monitorConnected&&playsWith(round?.player)!=='meter';
 if(was!==armed&&armed)cancelSwing();
 return was!==armed;
}
// How near the ball comes before the pin is lifted: about a second of a
// putt's last roll, and the lift (renderer damp 14) is all but done in a
// fifth of one. PLACED.
const PIN_ATTEND_M=3;
function setUpTurn(){
 syncArmed();
 // A missed putt: the pin goes back in for the next one.
 if(!round.holeComplete)view.lowerFlag?.();
 // A TEAM SELECTION IS NOT A TURN. Nobody is up until a ball has been chosen, so
 // setting a club, a power and an aim line for `round.position` here would offer
 // a shot from a lie the team may be about to abandon. This is also the path a
 // reload takes back into a half-made selection.
 if(round.relief){beginRelief();return;}
 endRelief();
 if(round.scrambleSelection){beginPick();return;}
 endPick();
 aimRange=null;const p=round.position;shotShape={...DEFAULT_SHAPE};cancelSwing();rangePlaced=aimTurned=false;
 syncClubs();
 const d=distance()/YARD;
 // PUTTER ONLY ON THE PUTTING SURFACE. `localSurface` returns 'green'
 // exactly when `greenDistance <= 0`, so this IS the strict "touching the
 // green" test. The `d<18` that used to sit beside it handed you a putter
 // from eighteen yards out in the fringe, off a bank, out of a greenside
 // bunker -- anywhere at all, so long as it was close.
 $('club').value=course.surface(p.x,p.z)==='green'?'putter':Object.entries(clubs).filter(([id])=>id!=='putter').sort((a,b)=>Math.abs(a[1].carry-d)-Math.abs(b[1].carry-d))[0][0];
 // A challenge asks for its own club, or the one for what it aims at.
 if(challenge)challengeClub();
 defaultAim();
 // The slope grid takes this shot's frame now, from the aim it starts with, and
 // keeps it while the player aims (GolfView.setReadingHeading).
 view.setBall(p);updateAim();view.setReadingHeading(p,aim);view.setCamera(p,aim);updateHUD();sendPlayer();
 flashTurn();
}
// PLAYS LIKE, under the yards to the hole (plays-like.js): the club in hand at
// full swing, flown in today's wind, altitude and temperature to the hole's
// height, against the same strike on level ground in still air. Worked out
// again only when something it depends on changes -- two flights, a few
// milliseconds -- and not shown for a putt, where there is no flight to adjust.
let playsLikeKey='',playsLikeYards=null;
function drawPlaysLike(){
 const el=$('playsLike');if(!el||!course?.pin)return;
 const c=clubs[$('club').value],p=round.position,pin=course.pin;
 if(!c||!p||c.code==='PT'||course.surface(p.x,p.z)==='green'){el.textContent='';return;}
 const key=[p.x,p.z,pin.x,pin.z,$('club').value,c.speed,settings.wind,settings.windDirection,course.rotation].join();
 if(key!==playsLikeKey){
  playsLikeKey=key;
  const m=playsLike({distance:Math.hypot(pin.x-p.x,pin.z-p.z),rise:course.height(pin.x,pin.z)-course.height(p.x,p.z),
   bearing:Math.atan2(pin.x-p.x,pin.z-p.z),wind:localWind(settings,course.rotation),
   altitude:course.bio.altitude,temperature:course.bio.temperature,launch:manualLaunch(c,1,1)});
  playsLikeYards=m==null?null:Math.round(m/YARD);
 }
 el.textContent=playsLikeYards==null?'':`PLAYS ${playsLikeYards}`;
}
// WHERE A TURN STARTS AIMING, and where A puts the aim back to: the middle of
// the fairway at the club's stock carry, or the pin near the end of the hole.
function defaultAim(){
 // A challenge turn starts aimed at its target, zone or called carry (`aimAt`).
 const p=round.position,target=challenge?.aimAt||fairwayAim(course,p,clubs[$('club').value].carry*YARD);
 aim=Math.atan2(target.x-p.x,target.z-p.z)*180/Math.PI;aimRange=Math.hypot(target.x-p.x,target.z-p.z);
 // A putt starts aimed at the hole, the whole distance, however it is struck:
 // off a monitor the device measures it, and on the Swing Meter the circle is
 // the length the bar's target asks for (the putter's stock roll is only the
 // bar's full line).
 if($('club').value==='putter'){aim=Math.atan2(course.pin.x-p.x,course.pin.z-p.z)*180/Math.PI;aimRange=Math.max(.1,distance());}
}
// THE KEYBOARD SHORTCUTS added on 10 October 2026, after GSPro's (A resets the
// aim, I and K change club, H hides the interface, Tab lists the keys, and a
// key steps the camera to the landing area and the green -- GSPro's F3, which
// here is G: F3 is the browser's Find).
function resetAim(){
 if(!canNudgeAim())return;
 defaultAim();rangePlaced=aimTurned=false;touchAim();updateAim();view.setCamera(round.position,aim);updateHUD();
}
// G: from wherever the camera is, to the aim point, then the green, then back
// to the ball.
function stepTargetCamera(){
 const m=view.config.mode;
 cameraMode(m==='target'?'green':m==='green'?'player':'target');
}
// H hides everything drawn over the course -- for a picture, or a projector
// bay that wants nothing but the hole -- and H or Escape brings it back.
function toggleHud(on=!$('app').classList.contains('hud-hidden')){
 $('app').classList.toggle('hud-hidden',on);
 if(on)toast('Interface hidden. Press H to bring it back.');
}
// Tab lists every key, over the course; Tab or Escape puts it away.
function toggleKeysHelp(on=$('keysHelp').hidden){
 const box=$('keysHelp');if(!box)return;
 box.hidden=!on;
 if(on)$('keysUpDown').textContent='Aim point further / shorter';
}
function updateHUD(){
 syncArmed();
 const pinText=distance()<10?`${(distance()/.3048).toFixed(1)} ft`:`${Math.round(distance()/YARD)} yd`;if($('explorePin'))$('explorePin').textContent=pinText+' to hole';$('activeTee').value=round.tee;$('activeTee').disabled=!!flight||!!dropState||round.holeComplete;$('replayShot').disabled=appMode!=='play'||!lastShot||!!flight||!!dropState;for(const [id,key] of [['readSlope','greenGrid'],['readFlow','greenFlow'],['readHeat','greenHeat']]){
  const el=$(id);if(!el)continue;
  // Reading is off on a practice ground: the bench green is dead flat, so the
  // grid paints one colour and the heat map one shade. Switches that can only
  // produce a featureless wash are disabled rather than left to disappoint.
  el.disabled=rangeMode;
  if(rangeMode&&!el.dataset.readTitle)el.dataset.readTitle=el.title;
  el.title=rangeMode?'Green reading needs a hole green -- the practice bench is flat':(el.dataset.readTitle||el.title);
  el.classList.toggle('on',!rangeMode&&!!view.config[key]);
  el.setAttribute('aria-pressed',String(!rangeMode&&!!view.config[key]));
 }
 // THE CARD DESCRIBES WHATEVER IS ON SCREEN, and a practice ground is not a
 // round. The range was already handled; the LAB never was, so it sat there
 // announcing "HOLE 01 / 09 · PAR 4 · PIN THU front" over a flat bench green.
 const practice=rangeMode;
 const p=round.player;
 // THE COURSE'S NAME, not its biome and not its seed. A seed is a serial
 // number; it was printed under the title, where a player reads it once, never
 // types it, and cannot do anything with it. The code behind the copy button is
 // the thing actually worth having, and the biome moves down to the subtitle so
 // the card still says where in the world you are.
 $('courseTitle').textContent=playingCourseName();$('barCourse').textContent=playingCourseName();
 // In skins, what the hole being played is worth once skins have carried to
 // it -- the holes before it decide that (skins.js).
 const worth=round.mode==='skins'&&!rangeMode?skins(round.cards,round.hole).worth:1;
 $('courseSubtitle').textContent=(rangeMode?'500 yards · practise anything'
  :round.endless?`Endless run · ${course.bio.name}`:course.bio.name)+(worth>1?` · ${skinsText(worth)} on this hole`:'');
 // A range has no hole number, no par and no pin position for the week. It does
 // have a distance, and that one is real -- it follows the green slider.
 // No leading zero: "01" read as "O1" in the old serif, and a hole number is
 // a count, not a code. The total rides beside it, lighter, on the same line.
 $('holeNumber').innerHTML=rangeMode?'Range':`${round.hole+1}<span>/${round.endless?'&infin;':round.holes}</span>`;$('holePar').textContent=practice?'—':course.par;
 // Which day the cups are cut for, and where on the green this one is. Front,
 // middle and back come round in turn as the round goes on.
 // The day moves up into the label, so the value is one word in one case:
 // "THU front" mixed capitals, lowercase and two sizes in a single slot.
 {const band=pinBandFor(round.hole);$('holePinLabel').textContent=practice?'Pin':`Pin · ${pinDayOf(settings).slice(0,3)}`;$('holePin').textContent=practice?'—':band[0].toUpperCase()+band.slice(1);}
 // DISTANCE is the one field that stays real on a practice ground: it is where
 // the green has been put, and it follows the control that moves it. On a course
 // it is the tee yardage.
 $('holeDistance').innerHTML=practice
  ? `${Math.round(rangeGreenYards(settings))}`
  : `${Math.round(course.tees[round.tee]?.yards??course.routeLength/YARD)}`;
 // THE GOLFER'S OWN COLOUR, on the two chips that say who is up: the same dot
 // as beside their scorecard row, so the chip and the name on the card are
 // recognisably the same person. (It was their tracer's colour too until 15
 // October 2026, when tracers became each golfer's own choice everywhere.)
 drawChallengeBar();
 // Their ball finish on the ball and their tracer style on the next shot.
 {const look=seatLooks(round.active);view.setBallFinish?.(look.ball);view.setTracer?.(look.tracer,playerTracer(round.active));applyMeterSkin(look.skin);}
 const initial=p.name[0]?.toUpperCase()||'P',chip=playerColour(round.active);
 for(const el of [$('playerInitial'),document.querySelector('.header-right .avatar')]){
  if(!el)continue;
  el.textContent=initial;el.style.background=chip;el.style.color=PLAYER_INK;
 }
 void p;
 // THE CHIP SAYS WHAT IT OPENS. There is no scorecard on a practice ground, so
 // the same button becomes the way into that golfer's shot data.
 if($('scoreNavLabel'))$('scoreNavLabel').textContent=practice?'Shot data':'Scorecard';
 // THE LINE IN THE SHOT PANEL says only that the hole or the round is over.
 // Between shots the score chip says whose shot it is.
 if(!flight)$('playerTurn').textContent=round.finished?'Round complete':round.holeComplete?'Hole complete':'';
 drawScoreChips();
 const lie=course.surface(round.position.x,round.position.z);ballOnGreen=lie==='green';
 view.setPinOut?.(ballOnGreen);
 // THE MAP FOLLOWS THE BALL ONTO THE GREEN. Framed on the green it also paints
 // the contour field, which is the view the 3D overlay cannot give you: from
 // the ball the far half of the green is a few pixels tall.
 //
 // Set HERE, immediately after the lie is read, rather than earlier in this
 // function -- read before it, `ballOnGreen` is the previous pass's answer and
 // the map frames the green one update after the ball arrives on it.
 if($('map'))$('map').mapFocus=onGreen()?'green':null;
$('lieLabel').textContent=lie==='tee'?'Tee box':lie==='semi'?'Semi-rough':lie[0].toUpperCase()+lie.slice(1);
 const rise=(course.height(course.pin.x,course.pin.z)-course.height(round.position.x,round.position.z))*3.28084;$('elevationLabel').textContent=`${rise<0?'↘':'↗'} ${Math.abs(rise).toFixed(0)} ft`;
 $('pinDistance').textContent=distance()<10?(distance()/.3048).toFixed(1):Math.round(distance()/YARD);if($('pinUnit'))$('pinUnit').textContent=distance()<10?'FEET TO HOLE':'YARDS TO HOLE';drawPlaysLike();$('windSpeed').textContent=settings.wind;setWindArrow();$('weatherText').textContent=settings.wind===0?'Perfectly still':settings.wind<8?'A gentle crosswind':'Play the breeze';$('temperature').textContent=Math.round(course.bio.temperature*9/5+32)+'°';
 $('swing').disabled=!!flight||round.holeComplete||round.scrambleSelection||!!round.relief||armed||!!dropState||!$('versionNotice').hidden;for(const b of $('aimPad').querySelectorAll('button'))b.disabled=!canNudgeAim();$('swing').innerHTML=armed?'<i data-lucide="radio"></i><span>Monitor armed<small>Waiting for your shot</small></span>':'<i data-lucide="arrow-up-right"></i><span>Swing<small>or press <kbd>SPACE</kbd></small></span>';
 if($('shotControls')){
  // The light is driven by the DEVICE; which window shows is driven by `armed`,
  // which is the only state where the manual controls genuinely do nothing --
  // `takeShot` already refuses a swing while the monitor is armed. Keying it on
  // mere connection would take the shot button from someone who connected a
  // monitor but has not armed it, leaving them unable to hit.
  const state=monitorState();
  $('shotControls').dataset.monitor=state;
  $('world').classList.toggle('monitor-armed',armed);
  $('world').classList.toggle('meter-mode',meterMode());
  drawMonitorState(state);
  if($('monClub').value!==$('club').value)$('monClub').value=$('club').value;
  if($('bottomHints'))$('bottomHints').hidden=armed;
 }
 $('aimOutput').textContent=`${aim.toFixed(1)}°`;$('clubHint').textContent=$('club').value==='putter'?`${clubs.putter.carry} yd roll · Stimp 10 reference`:`${clubs[$('club').value].carry} yd carry`;drawShapeControls();drawLie();drawMeterScale();
 redrawMap();const playing=appMode==='play';if($('mulligan')){$('mulligan').disabled=!playing||!round.canMulligan()||!!flight||!!dropState;
  // Says why when it is off. "Nothing to take back yet" on a fresh tee is a
  // different answer from "finish the shot first", and a dimmed button with no
  // explanation reads as broken.
  $('mulligan').title=!playing?'':flight?'Finish the current shot first':dropState?'Finish the drop first'
   :round.canMulligan()?'Take back your last shot on this hole':'Nothing to take back on this hole yet';}if($('simDrop')){$('simDrop').disabled=!playing||rangeMode||!!flight||round.holeComplete||round.scrambleSelection||!!round.relief;
  // Sim drop places a ball somewhere on a HOLE. The range has no hole to place
  // it on, so the control was there doing nothing; now it says so.
  $('simDrop').title=rangeMode?'Sim drop places a ball on a hole -- the range has none':'';}if($('labTool'))$('labTool').hidden=!rangeMode;
 // The range controls open by themselves when the range does, and this is the
 // way back to them once closed -- there was none, so a closed window stayed
 // closed until the range was left and entered again.
 if($('rangeTool'))$('rangeTool').hidden=!rangeMode;
 // Putting mode is forced to hole-out on a practice ground, so this would edit
 // a setting for the NEXT round while appearing to change where you are. A
 // dedicated putting mode is the plan; until then it is simply not offered.
 // On the range the button says WHY it is off. A disabled control with no
 // explanation reads as broken, and "putting" on a practice ground is a
 // reasonable thing to go looking for -- there is simply no putting there yet.
 if($('puttingLabel')){$('puttingLabel').disabled=rangeMode;$('puttingLabel').title=rangeMode?'No putting on the practice ground yet':'Putting: '+{holeout:'hole out',dartboard:'dartboard',decimal:'decimal putting'}[round.putting.mode];}icon();
}
// A putt is previewed by running the shot, not by describing it. Everything else
// keeps a straight target line, which is what an aim line means for a ball that
// is about to be in the air.
function updateAim(syncRange=true){const c=clubs[$('club').value];
 // NO PUTT PREVIEW (the owner's call, 14 October 2026). A putt used to draw the
 // path the ball would roll, break and all, which read the green for you. Now a
 // putt is a straight line to where you aim, for every way of playing, and the
 // break is read from the green -- the grid, the flow and the heat map. The
 // circle is the putt's length: the Swing Meter's bar and its target are drawn
 // from it on a flat green, and a monitor measures the stroke.
 puttPreview=null;
 const putt=c.code==='PT',range=aimRange??(putt?Math.max(.1,distance()):c.carry*YARD);aimPoint=aimTarget(round.position,aim,range);view.aimRing.visible=true;
 // A curved shape is drawn curved, so a draw is seen to bend before it is hit.
 const track=armed?null:shapeTrack(c,range);
 // A putt's line lies on the green, 15 mm up, like the preview line did.
 if(track)view.setAimPath(track,range,.1);else view.setAim(aim,range,putt?.015:.1);
 $('aimOutput').textContent=aim.toFixed(1)+'°';if(syncRange!==false)$('aimRange').value=(range/YARD).toFixed(1);
 if(putt)drawLie();
 drawMeterScale();
}
// THE SHAPE ON THE COURSE. The club's full swing with this shape is flown once on
// level ground (swing-meter.js `previewTrack`), started off line by as much as it
// bends so it comes down on the aim line, and the track is scaled to the circle
// and turned onto the aim. A picture of the bend, not a forecast: wind and slope
// are not in it.
const trackCache=new Map();
function shapeTrack(c,range){
 if(shotShape.curve==='straight'||c.code==='PT')return null;
 const launch=shapedLaunch(c,shotShape,{short:isShortGame()}),key=[c.speed,launch.vla,launch.spin,launch.axis].join();
 let base=trackCache.get(key);
 if(!base){if(trackCache.size>60)trackCache.clear();base=previewTrack(c,launch,c.speed);trackCache.set(key,base);}
 const end=base.at(-1),k=range/Math.max(1,Math.hypot(end.x,end.z));
 const a=aim*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),o=round.position;
 return base.map(p=>({x:o.x+(p.x*ca+p.z*sa)*k,z:o.z+(-p.x*sa+p.z*ca)*k}));
}

// THE SWING METER, wired. swing-meter.js holds the rules and does the judging;
// this starts a swing, takes its taps, draws the bar and hands the struck numbers
// to `takeShot`. Space, a click or touch on the Swing button or the bar, and a
// pad's A are all the same tap, judged on the time the input happened
// (`event.timeStamp`, or the moment a pad was read), never on a frame.
//
// WHILE A SWING IS IN PROGRESS THE WHOLE SCREEN IS THE TAP TARGET (#swingCatcher):
// nothing else should be pressed mid-swing, and a thumb on a phone cannot miss a
// target that big. Before the first tap only the Swing button and the bar start
// one, so aiming by tapping the course still works.
const golferDifficulty=()=>meterDifficulty(profileOf(round.player));
const isShortGame=()=>shortGame(clubs[$('club').value],distance()/YARD);
// The range is played off the mat, which no lie table touches.
const currentLie=()=>rangeMode?'tee':course.surface(round.position.x,round.position.z);
let meterFlash=null,meterScaleKey='';
function swingContext(){const c=clubs[$('club').value],short=isShortGame(),putt=c?.code==='PT';
 // The bar zooms to the shot the circle asks for (swing-meter.js): a putt to a
 // share of the putter's roll, a short full shot to a half or quarter swing.
 const zoom=!c||putt?1:swingZoom(fullCarry(c,shapedLaunch(c,shotShape,{short})),aimRange??c.carry*YARD);
 return {club:c,shape:{...shotShape},short,lie:currentLie(),difficulty:golferDifficulty(),turf:settings.turf,zoom,
  ...(putt?{puttRange:puttRange(c,settings.turf,aimRange??distance())}:{})};}
function canSwing(){return appMode==='play'&&!tour&&!flight&&!dropState&&view.config.mode!=='free'&&!round.holeComplete&&!round.scrambleSelection&&!round.relief&&!round.finished&&$('versionNotice').hidden&&!armed;}
function meterPress(t=performance.now()){
 if(!swing){
  if(!canSwing())return false;
  closePanel();setAimView(false);
  const ctx=swingContext(),putt=ctx.club.code==='PT';
  swing=startSwing(t,{difficulty:ctx.difficulty,club:ctx.club,putt,accuracy:!putt,zoom:putt?ctx.puttRange/puttFullRoll(ctx.club,settings.turf):ctx.zoom});
  swing.ctx=ctx;meterFlash=null;lastSwing=null;drawMeterResult();
  $('swingCatcher').hidden=false;$('world').classList.add('swinging');
  gameAudio?.meterStart();
  drawShapeControls();drawMeterScale();drawMeter(t);
  return true;
 }
 const which=meterTap(swing,t);
 if(which==='power')gameAudio?.meterSound('power');
 if(swing.done)releaseSwing();else drawMeter(t);
 return true;
}
// THE STRUCK SWING STAYS ON THE BAR (the owner's call, 14 October 2026): where
// the distance was set and where the strike came, frozen, while the ball is
// moving; the bar is clean once it stops (the owner again, later that day).
let lastSwing=null;
// Only while that ball is moving (the owner, 14 October 2026: not for ever);
// the bar is clean again once it stops.
const shownSwing=()=>!swing&&flight&&!flight.replay&&lastSwing&&lastSwing.player===round.player?.name&&lastSwing.hole===round.hole?lastSwing:null;
// Where a finished swing's marker stopped: the strike, or for a putt (two taps)
// the distance.
const frozenAt=sw=>sw.accuracy?sw.error:sw.power;
function releaseSwing(){
 const sw=swing;swing=null;$('swingCatcher').hidden=true;$('world').classList.remove('swinging');
 lastSwing={...sw,player:round.player?.name,hole:round.hole};
 const out=swingLaunch(sw,sw.ctx);
 gameAudio?.meterStop();
 if(sw.accuracy)gameAudio?.meterSound(sw.duff?'duff':out.strike.perfect?'perfect':out.strike.miss<=1?'zone':'miss');
 meterFlash={text:strikeWords(out.strike,sw.ctx.club.code==='PT'),perfect:out.strike.perfect,until:performance.now()+1800};
 drawMeter(performance.now(),sw);
 takeShot(null,out);
}
// Escape before the distance is set, the page going out of sight, or the turn
// changing under it: no stroke, nothing struck.
function cancelSwing(say=false){
 if(!swing)return;
 swing=null;$('swingCatcher').hidden=true;$('world').classList.remove('swinging');gameAudio?.meterStop();
 if(say)toast('Swing cancelled. No stroke counted.');
 drawShapeControls();drawMeter(performance.now());
}
// What the strike did, in words, for the moment after it. Early is right and
// late is left, for everyone (the owner's rule, 14 October 2026).
function strikeWords(fx,putt){
 if(fx.perfect)return 'Perfect strike';
 if(fx.miss>=5)return putt?'Mis-hit: it ran out':'Mis-hit: the swing ran out';
 const early=fx.hla>0;
 return fx.miss<=1?(early?'Early: a touch right':'Late: a touch left'):(early?'Early: pushed right':'Late: pulled left');
}
// The bar runs from MISS_AT past the strike line to the end of overswing.
const METER_SPAN=1+OVERSWING-MISS_AT,barX=s=>(s-MISS_AT)/METER_SPAN*100;
function zonesFor(ctx,power){
 const l=shapedLaunch(ctx.club,ctx.shape,{short:ctx.short});
 const putt=ctx.club.code==='PT';
 return strikeZone({difficulty:ctx.difficulty,shape:l.zone,lie:ctx.lie,putt,power,share:putt?power:power*(ctx.zoom??1)});
}
function placeZone(z){
 for(const [id,half] of [['smZone',z.zone],['smPerfect',z.perfect]]){const el=$(id);el.style.left=barX(-half)+'%';el.style.width=(2*half/METER_SPAN*100)+'%';}
}
// The moving parts: the marker, where the distance was set, and the line of
// words above the bar. Cheap; the frame loop calls it while a swing runs.
function drawMeter(t,last=null){
 const box=$('swingMeter');if(!box||box.hidden)return;
 const sw=swing||last||shownSwing();
 $('smMarker').style.left=barX(!sw?MISS_AT:sw.done?frozenAt(sw):markerAt(sw,t))+'%';
 $('smPower').hidden=!sw||sw.power==null;
 if(sw&&sw.power!=null){$('smPower').style.left=barX(sw.power)+'%';if(sw.accuracy)placeZone(zonesFor(sw.ctx,sw.power));}
 const hint=$('smHint'),flashing=!swing&&meterFlash&&t<meterFlash.until;
 const over=!!swing&&inOverswing(swing,t);
 box.classList.toggle('over',over);
 if(over)hint.textContent='Overswing! Tap to set it';
 else if(swing)hint.innerHTML=swing.power==null?'Tap to set the distance <span class="sm-esc"><kbd>Esc</kbd> cancels</span>':'Tap on the strike line';
 else if(flashing||(flight&&meterFlash))hint.textContent=meterFlash.text;
 else if(box.classList.contains('out-of-reach'))hint.innerHTML='<span class="sm-out">Out of reach: take more club</span>';
 else hint.innerHTML=phoneScreen()||matchMedia('(pointer:coarse)').matches?'Tap <b>Swing</b> to start':'Press <kbd>SPACE</kbd> to start';
 box.classList.toggle('perfect',!!(flashing&&meterFlash.perfect));
 box.dataset.stage=swing?(swing.power==null?'power':'strike'):'ready';
}
// The still parts: whether the meter shows at all, the yard (or foot) marks for
// this club and shape, the strike zone, and the hatched end the lie takes away.
// Redrawn only when one of those changes.
function drawMeterScale(){
 const box=$('swingMeter');if(!box||!course||!clubs[$('club').value])return;
 const show=appMode==='play'&&!armed&&(!flight||meterFlight())&&!round.finished&&!round.holeComplete&&!round.scrambleSelection&&!round.relief&&!dropState;
 if(box.hidden===show)box.hidden=!show;
 if(!show)return;
 const ctx=swing?.ctx||swingContext(),c=ctx.club,putt=c.code==='PT';
 const l=shapedLaunch(c,ctx.shape,{short:ctx.short});
 const key=[c.label,c.speed,l.vla,l.spin,l.axis,l.zone,ctx.lie,ctx.difficulty,settings.turf.stimp,settings.turf.firmness,ctx.puttRange??0,ctx.zoom,shownSwing()?'held':''].join();
 if(key!==meterScaleKey){
  meterScaleKey=key;
  const full=putt?ctx.puttRange:fullCarry(c,l)*ctx.zoom;
  const [unit,per]=putt&&full<20*YARD?['ft',1/.3048]:['yd',1/YARD];
  $('smTicks').innerHTML=[.25,.5,.75,1].map(s=>`<span style="left:${barX(s)}%"${s===1?' class="full"':''}><b>${Math.round(full*s*per)}</b>${s===1?`<small>${unit}</small>`:''}</span>`).join('')
   +`<span class="strike" style="left:${barX(0)}%"></span><span class="over" style="left:${barX(1)}%;width:${barX(1+OVERSWING)-barX(1)}%"></span>`;
  // The hatched end of the bar is what the lie takes off a full swing.
  const f=lieFactor(ctx.lie),hatch=$('smHatch');
  // In a zoomed bar the lie's cut may lie past the full line: nothing to hatch.
  const reach=f<1?(putt?f*f*puttFullRoll(c,settings.turf)/full:carryAtSpeed(c,l,c.speed*f)/full):1;
  if(reach<1){hatch.hidden=false;hatch.style.left=barX(reach)+'%';hatch.style.width=(barX(1)-barX(reach))+'%';}
  else hatch.hidden=true;
  const accuracy=!putt;
  $('smZone').hidden=$('smPerfect').hidden=!accuracy;
  if(accuracy)placeZone(shownSwing()?.accuracy?zonesFor(shownSwing().ctx,shownSwing().power):zonesFor(ctx,1));
  const zoomed=putt?'':ctx.zoom===.25?' · quarter swing':ctx.zoom===.5?' · half swing':'';
  $('smTitle').textContent=`${c.label} · ${difficultyOf(ctx.difficulty).label}${zoomed}`;
 }
 drawTarget();
 drawMeterResult();
 drawMeter(performance.now());
}
// THE SWING METER CARRIES ITS OWN THREE NUMBERS (the owner's call, 14 October
// 2026): on the Swing Meter the floating number tiles are gone, and once the
// strike is made the meter stays up through the flight with carry, total and
// apex counting up as the ball goes, then keeps them until the next swing
// starts. Only for the golfer who hit it: the next golfer up, or a new hole,
// starts on a clean meter. With a launch monitor armed -- or for a typed or lab shot -- the tiles
// do the job as before (`meterMode`).
const meterFlight=()=>!!flight&&!flight.replay&&!!flight.record&&!flight.record.typed;
const meterMode=()=>!armed&&!cardRecord()?.typed;
function drawMeterResult(record=cardRecord()){
 const box=$('smResult');if(!box)return;
 const mine=!!record&&!record.typed&&!swing&&(flight?meterFlight():record.player===round.player?.name&&record.hole===round.hole);
 // THE ROW NEVER GOES (the owner, 14 October 2026: numbers vanishing on the
 // first tap made lining up the next shot jarring). With nothing of this
 // golfer's to show -- a swing under way, a new golfer, a new hole -- it shows
 // dashes in the same place.
 box.hidden=false;
 const cells=shotGrid(mine?record:null,{fields:['carry','total','apex'],columns:0}).cells;
 for(const c of cells){const el=box.querySelector(`[data-field=${c.id}]`);if(!el)continue;const html=tileInner(c);if(el.dataset.shown!==html){el.dataset.shown=html;el.innerHTML=html;}}
}
// THE TARGET MARKER (Phase 2): the stop on the bar that lands the ball in the
// aim circle (swing-meter.js `targetShare`; for a putt, the length the read line
// was solved for, on a flat green). Sweeping the aim asks for it every frame
// and a full shot's answer is two flights and a bisection, so while the aim is
// moving it is worked out at most ten times a second, and once more when it
// stops. Out of reach, it sits on the full line in red.
let targetKey='',targetAt=0,targetTimer=0;
function drawTarget(force=false){
 const el=$('smTarget'),box=$('swingMeter');if(!el||!box||box.hidden||!course)return;
 const ctx=swing?.ctx||swingContext(),c=ctx.club;if(!c)return;
 const putt=c.code==='PT',range=aimRange??(putt?distance():c.carry*YARD);
 const key=[round.position.x,round.position.z,aim.toFixed(2),range.toFixed(2),c.label,c.speed,JSON.stringify(ctx.shape),ctx.short,ctx.lie,ctx.difficulty,ctx.puttRange??0,settings.wind,settings.windDirection,settings.turf.stimp].join();
 if(key===targetKey)return;
 const now=performance.now();
 if(!force&&now-targetAt<100){clearTimeout(targetTimer);targetTimer=setTimeout(()=>drawTarget(true),110);return;}
 targetAt=now;targetKey=key;
 let t=null;
 if(putt){
  // On a flat green: the slope is the golfer's to read, so the marker does
  // not read it for them (the putt preview went the same day).
  const f=lieFactor(ctx.lie),share=range/(ctx.puttRange*f*f);t=share>1?{share:1,out:true}:{share,out:false};
 }else{
  const p=round.position,pt=aimTarget(p,aim,range);
  t=targetShare({...ctx,metres:range,rise:course.height(pt.x,pt.z)-course.height(p.x,p.z),bearing:aim*Math.PI/180,
   wind:localWind(settings,course.rotation),altitude:course.bio.altitude,temperature:course.bio.temperature});
  // On the zoomed bar: the share of the full swing over the zoom.
  if(t&&ctx.zoom<1){const s=t.share/ctx.zoom;t=t.out?t:s>1?{share:1,out:true}:{share:s,out:false};}
 }
 el.hidden=!t;if(!t)return;
 el.style.left=barX(t.share)+'%';el.classList.toggle('out',t.out);
 el.title=t.out?'Out of reach: take more club':'Stop here to land in the circle';
 box.classList.toggle('out-of-reach',t.out);
}
// THE SHOT'S SHAPE: curve and height are separate choices (the owner's, 14
// October 2026), and the spin dial adds spin a step at a time. All three reset
// at every new turn and are fixed once a swing has started.
function drawShapeControls(){
 const c=clubs[$('club').value];if(!c||!$('shapeControl'))return;
 const putt=c.code==='PT',short=isShortGame(),locked=putt||!!swing||!!flight;
 $('curveLabel').textContent=curveName(shotShape.curve);
 $('heightLabel').textContent=heightName(shotShape.height,short);
 $('spinLabel').textContent=$('spinCycleLabel').textContent=shotShape.spin>0?'+'+shotShape.spin:String(shotShape.spin);
 $('pickSpin').setAttribute('aria-label',`Spin: ${spinName(shotShape.spin)}. Tap to change`);
 $('pickCurve').setAttribute('aria-label',`Curve: ${curveName(shotShape.curve)}. Press S to change`);
 $('pickHeight').setAttribute('aria-label',`Height: ${heightName(shotShape.height,short)}. Press W to change`);
 $('pickCurve').disabled=$('pickHeight').disabled=$('pickSpin').disabled=locked;
 $('spinDown').disabled=locked||shotShape.spin<=SPIN_STEPS[0];
 $('spinUp').disabled=locked||shotShape.spin>=SPIN_STEPS.at(-1);
 $('shapeControl').classList.toggle('putt',putt);
 $('shapeControl').classList.toggle('spun',shotShape.spin>0);
 $('meterLabel').textContent=difficultyOf(golferDifficulty()).label;
}
// S and W step round their lists; X steps the dial up and round (0, +1, +2, +3,
// -1, 0), Shift+X down. The on-screen - and + stop at the ends instead.
function stepShape(which,dir,wrap=true){
 if(swing||flight||armed||appMode!=='play'||clubs[$('club').value]?.code==='PT')return;
 const list=which==='curve'?CURVES:which==='height'?HEIGHTS:SPIN_STEPS,i=list.indexOf(shotShape[which]);
 const j=wrap?(i+dir+list.length)%list.length:Math.max(0,Math.min(list.length-1,i+dir));
 shotShape={...shotShape,[which]:list[j]};
 drawShapeControls();updateAim();
}
// THE LIE, before every shot and for every way of playing (the owner's rule):
// the surface the ball sits on and what it costs. In the shot controls for the
// Swing Meter, and in the monitor window -- where it says when the round has the
// monitor penalty switched off.
function drawLie(){
 if(!course||!round)return;
 const lie=currentLie(),f=rangeMode?1:lieFactor(lie);
 const name=rangeMode?'Mat':lie==='tee'?'Tee box':lie==='semi'?'Semi-rough':lie[0].toUpperCase()+lie.slice(1);
 const cost=f<1?`${name} · −${Math.round((1-f)*100)}% ball speed`:`${name} · full ball speed`;
 const meter=$('lieReadout');
 if(meter){meter.innerHTML=`<span>LIE</span> ${escape(cost)}`;meter.classList.toggle('penalty',f<1);}
 const mon=$('monLie');
 if(mon){const off=f<1&&!round.monitorLie;mon.innerHTML=`<span>LIE</span> ${escape(off?`${name} · no penalty (switched off)`:cost)}`;mon.classList.toggle('penalty',f<1&&!off);}
}
// Pointer DOWN, not click, so a touch counts the moment the finger lands.
function bindSwingInput(){
 const press=e=>{if(e.button!==0)return;e.preventDefault();meterPress(e.timeStamp);};
 $('swing').addEventListener('pointerdown',press);
 $('smBar').addEventListener('pointerdown',press);
 $('swingCatcher').addEventListener('pointerdown',press);
 $('pickCurve').onclick=()=>stepShape('curve',1);
 $('pickHeight').onclick=()=>stepShape('height',1);
 // On a phone the dial is one button that steps round, like X: a pair of
 // small - and + buttons is under a thumb's width.
 $('pickSpin').onclick=()=>stepShape('spin',1);
 $('spinUp').onclick=()=>stepShape('spin',1,false);
 $('spinDown').onclick=()=>stepShape('spin',-1,false);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelSwing();});
 // The words under the bar say Space or Tap by the screen, which can change.
 addEventListener('resize',()=>drawMeter(performance.now()));
}
function setAimPoint(point){
 touchAim();rangePlaced=aimTurned=true;
 aimRange=Math.max(.05,Math.hypot(point.x-round.position.x,point.z-round.position.z));
 aim=Math.atan2(point.x-round.position.x,point.z-round.position.z)*180/Math.PI;
 updateAim();view.setCamera(round.position,aim);
}

// NUDGING THE AIM, for a thumb. Tapping the course aims wherever the finger
// lands, and at 200 yards a fingertip covers several yards of fairway -- so on
// a phone a tap got you close and nothing got you exact. The aim pad and the
// aim arrows finish the job in steps small enough to matter: half a degree a
// tap, under two yards sideways at 200, and a yard further or shorter. Held,
// they sweep. For a putt "further" is the putt's length: the aim circle is the
// length the Swing Meter's target asks for, as it is for a monitor putt.
const AIM_TAP_DEGREES=.5,AIM_TAP_YARDS=1;
// HELD UP OR DOWN WITH A MONITOR ARMED, the aim point walks further or shorter
// -- by hand those keys are power, which a monitor shot ignores, so with one
// armed they were doing nothing a player could see. The walk is a share of the
// distance a second (15%, never under 2 yd/s) so a putt creeps and a drive
// strides, and it quickens to four times that over a second and a half of
// holding. Placed numbers, chosen to feel right, not measured from anything.
let reachHeldFor=0;
// When the aim was last moved by the player, for the two labels to take turns.
// Only input moves it -- a new turn setting up its own aim does not -- so the
// pin's distance is what a player sees on arriving at the ball. How long the
// aim label stays after the last touch is placed, not measured.
let aimTouchedAt=-Infinity;
// WHETHER THE GOLFER HAS PLACED THE CIRCLE this turn: its distance (a click,
// ↑ ↓, the pad, the distance box) or its direction (← →). Changing club moves
// a circle nobody placed to the new club's carry down the fairway; one placed by
// hand stays, and the target marker moves instead (spec 4).
let rangePlaced=false,aimTurned=false;
const AIM_LABEL_HOLD=1000;
function touchAim(){aimTouchedAt=performance.now();}
function walkReach(dir,dt){
 reachHeldFor+=dt;rangePlaced=true;
 const c=clubs[$('club').value],yards=(aimRange??c.carry*YARD)/YARD;
 const rate=Math.max(2,yards*.15)*(1+3*Math.min(1,reachHeldFor/1.5));
 aimRange=clamp(yards+dir*rate*dt,.1,2000)*YARD;
}
function canNudgeAim(){return appMode==='play'&&!flight&&!dropState&&!round.holeComplete&&!round.scrambleSelection&&view.config.mode!=='free';}
function nudgeAim(side,taps){
 if(!canNudgeAim())return;
 aim+=aimDelta(side,taps*AIM_TAP_DEGREES);touchAim();aimTurned=true;updateAim();view.setCamera(round.position,aim);
}
function nudgeReach(dir,taps){
 if(!canNudgeAim())return;
 const c=clubs[$('club').value],current=aimRange??c.carry*YARD;
 // Inside twenty yards the step is a foot rather than a yard, and the target may
 // come right up to the ball: every putt is aimed by distance now.
 rangePlaced=true;const fine=current<20*YARD,step=fine?1/3:AIM_TAP_YARDS;
 aimRange=clamp(current/YARD+dir*taps*step,.1,2000)*YARD;touchAim();updateAim();
}
// HOLD TO SWEEP. The press itself is one tap, so a quick tap is always exactly
// one step. Held past a moment, it repeats at a rate that climbs from three
// taps a second to twenty-four, so a short hold is still a fine adjustment and
// a long one crosses the fairway. Pointer events, so a finger and a mouse
// behave alike; a keyboard press on the focused button arrives as a click with
// no pointer behind it (`detail` 0) and counts as one tap, and a pointer's own
// click is ignored because its press already stepped.
function holdToRepeat(button,step){
 let frame=0,started=0,last=0;
 const stop=()=>{cancelAnimationFrame(frame);frame=0;};
 const loop=now=>{
  const held=(now-started)/1000;
  if(held>.35)step(Math.min(24,3+14*(held-.35))*(now-last)/1000);
  last=now;frame=requestAnimationFrame(loop);
 };
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();stop();step(1);started=last=performance.now();
  try{button.setPointerCapture(e.pointerId);}catch{}
  frame=requestAnimationFrame(loop);
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,stop);
 button.addEventListener('click',e=>{if(e.detail===0)step(1);});
 // A long press on Android opens a context menu, which would end the sweep.
 button.addEventListener('contextmenu',e=>e.preventDefault());
}

// THE BIG MAP. The map is where aiming is precise -- it is drawn from above,
// to scale, and nothing stands in front of the target -- but on a phone it is
// a 104 px thumbnail. This lays the same canvas over the course, as large as
// the screen allows, where a tap aims (or places a drop, or flies, whatever
// the map does at that moment) and two fingers zoom. Everything else about the
// map is untouched: it is still the one canvas, drawn by the one function.
let aimViewOpen=false;
function setAimView(on){
 on=!!on;if(on===aimViewOpen)return;aimViewOpen=on;
 $('world').classList.toggle('aim-view',on);
 $('mapExpand').setAttribute('aria-pressed',String(on));
 // Fitted both ways. A zoom picked on the big map means nothing on a
 // thumbnail, and the big map should open on the whole hole.
 resetMapNav();
 if(on)$('aimViewHint').textContent=dropState?'Tap to place the ball · pinch to zoom'
  :['free','overview'].includes(view.config.mode)?'Tap to fly there · pinch to zoom':'Tap to aim · pinch to zoom';
 updateExplorer();
}

function takeShot(data=null,struck=null){
 if(appMode!=='play'||tour||flight||dropState||view.config.mode==='free'||round.holeComplete||round.scrambleSelection||round.relief||round.finished||!$('versionNotice').hidden)return false;
 // SPACE and the gamepad still reach this while the lab is open, and the lab's
 // controls are hidden -- so a manual shot would fire from a club, aim and power
 // the user cannot see. `data` is the launch-monitor path and stays open,
 // because that is a real ball and the lab exists to watch real balls.
 if(!data&&armed){toast('The launch monitor is armed. Disarm it to use manual controls.');return false;}
 // Called with nothing -- the Swing button, Space, a pad's A -- it is a tap on
 // the Swing Meter; the meter calls back in with the struck numbers.
 if(!data&&!struck)return meterPress();
 closePanel();const c=clubs[$('club').value],lie=course.surface(round.position.x,round.position.z);
 // THE LIE (14 October 2026, the owner's rule): rough, semi-rough and sand cost
 // ball speed, by one table, for every golfer. The Swing Meter has already taken
 // it off its swing (swing-meter.js). A MONITOR'S MEASURED BALL SPEED is
 // multiplied by the same share unless the round switches that off -- and the
 // measured number is kept beside the one played, so it is shown and recorded
 // exactly as sent, with the penalty in red (shot-data.js). Launch, direction,
 // spin and axis are never touched. The range and the lab's typed shots are
 // played off the mat. PROJECT_HANDOFF *The simulator never invents ball data*.
 const factor=rangeMode?1:lieFactor(lie);let launch,lieRecord=null;
 if(data)({launch,lie:lieRecord}=monitorLie(data,lie,{on:round.monitorLie,range:rangeMode}));
 else{launch=struck.shot;if(factor<1)lieRecord={surface:lie,factor,before:struck.before};}
 const shot={origin:{...round.position},aim,...launch,...(lieRecord?{lie:lieRecord}:{})};
 const wind=localWind(settings,course.rotation);
 const result=simulateShot(shot,course,{wind,altitude:course.bio.altitude,temperature:course.bio.temperature,turf:settings.turf,
  // Only when they are actually standing lit on the course. The whole
  // floodlight group is hidden when the lights are down, and a ball stopping
  // dead against a mast nobody can see is worse than one flying through it.
  poles:view.floodlit?view.poles:null,
  // This hole's flagstick is in unless the ball is on the green (setPinOut) or
  // the putter is in hand (liftFlag): exactly when it is drawn standing.
  flagsticks:{current:lie!=='green'&&c.code!=='PT'}});result.puttStroke=lie==='green';
 latest={shot,result,player:round.player.name,typed:!!data};priorShot=lastShot;lastShot={...latest,hole:round.hole,putting:lie==='green',aim,club:c.label,kind:c.kind,aimAt:aimPoint?{x:aimPoint.x,z:aimPoint.z}:null,aimDist:aimRange};shotInputs.set(`${round.uid}:${round.hole}:${round.active}`,data?'monitor':'meter');flight={result,elapsed:0,index:0,origin:shot.origin,record:lastShot,tv:shotCameraPlan(result,course)};view.hitEffects(shot.origin,aim,lie,shot.speed);gameAudio?.strike({kind:c.kind,ballMs:shot.speed,monitor:!!data});lastShot.pinOut=lie==='green'||c.code==='PT';showLiveResult();view.setTrail([]);view.aimLine.visible=false;view.aimRing.visible=false;updateHUD();return true;
}
function finishShot(){
 if(!flight)return;if(flight.replay){const replay=flight;flight=null;Object.assign(view.config,replay.camera);view.setHole(worldHole(round.hole),true);view.setPutting(round.putting);view.setBall(round.position);view.aimLine.visible=true;view.trackingBall=false;view.config.mode=playCameraMode(view.config.mode,course,round.position);updateAim();view.setCamera(round.position,aim,true);showStandingResult();updateExplorer();updateHUD();
  // A replay watched while a scramble team is choosing its ball goes back to the
  // choice -- the camera behind the candidate on show, no aim line -- rather than
  // the ordinary play view the lines above restore.
  if(round.scrambleSelection)showPick();
  // And a replay watched while a ball waits for relief goes back to the choice.
  if(round.relief&&reliefList.length)showRelief();
  return;}
 // Leaving the whole-shot view, the camera FLIES on to the next shot rather than
 // cutting there: the owner asked for the review to come and go smoothly.
 const fromReview=flight.reviewed?{eye:view.camera.position.clone(),look:view.look.clone()}:null;
 const result=flight.result;flight=null;drawPanelState();
 // The tracer has had the whole flight and the settle hold to be looked at. It
 // goes now rather than hanging over the next shot, and is kept for the summary.
 pushTrail(result.points);view.setTrail([]);view.setBall(result.end);
 if(challenge){view.aimLine.visible=true;view.trackingBall=false;challengeShot(result);sendPlayer();return;}
 // THE LAB RECORDS TOO. It shares the range's player card, its Shot data chip
 // and its shot list, and a chip that offers a list and then shows an empty one
 // is worse than no chip. It does NOT take the early return below: the lab
 // plays a real one-hole round on the practice green, so the round half still
 // has to run. Tracers are deliberately not drawn for it -- the lab's shots are
 // putts and short approaches onto one green, and fifty lines across it would
 // cover the thing being watched.
 // The range never touches the round. No stroke is recorded, no hole can
 // complete, and nothing advances -- the ball goes back to the mat and the
 // tracers stay on the field so a session reads as a session.
 const before={seat:round.active,stroke:round.stroke,driver:lastShot?.kind==='driver',lie:course.surface(lastShot.shot.origin.x,lastShot.shot.origin.z)};
 if(rangeMode){
  recordRangeShot(result);recordProfileShot(result,before);
  // The panel follows play unless a row has been pinned from the shot list.
  viewShot=null;drawShotViews();refreshDispersion();drawDispersionLegend();
  view.setShotHistory?.(visibleTrails());
  setUpRangeTurn();
  if(fromReview)view.flyCamera(round.position,aim,{from:fromReview});
  showRangeResult();
  view.aimLine.visible=true;view.trackingBall=false;view.aimRing.visible=armed||$('club').value!=='putter';
  save();sendPlayer();
  return;
 }
 // WHERE IT LAST CROSSED THE EDGE of the water or the boundary, found on the
 // ball's own path (relief.js). A ball stopped by a house that is out of bounds
 // never crossed the boundary line; the house is the edge, and it is where it
 // stopped.
 if(result.hazard)result.cross=crossingPoint(result.points,result.hazard==='Water'?(p=>course.surface(p.x,p.z)==='water'):(p=>outOfBounds(course,p.x,p.z)))||{x:result.end.x,z:result.end.z};
 result.onGreen=!result.hazard&&course.surface(result.end.x,result.end.z)==='green'&&greenDistance(course,result.end.x,result.end.z)<=0;const carded=cardedSeats(),event=round.takeShot(result,course.pin);announceHoleOut(carded,{chipIn:!!result.holed&&!result.hazard&&before.lie!=='green'&&before.stroke>1});recordProfileShot(result,before);save();updateHUD();view.aimLine.visible=true;view.trackingBall=false;view.aimRing.visible=armed||$('club').value!=='putter';
 if(rangeMode)try{const R0=latest.result;
  // An approach is read by its carry and its run, not by a hop: `hopMm` is a
  // putting figure and on a 155 yard shot it reports the flight apex, which
  // read as a 26 metre hop the first time one was fired.
  labState={...labState,result:{...outcome(R0,course.pin,(x,z)=>course.height(x,z),BALL_R),
   carryYd:+(R0.carry/YARD).toFixed(1),rollYd:+((R0.total-R0.carry)/YARD).toFixed(1)}};}catch(e){console.warn('lab readout failed',e);}
 viewShot=null;drawShotViews();
 renderResult(event);
 if(round.holeComplete)showHoleCompletion();
 if(!round.holeComplete&&!round.scrambleSelection){setUpTurn();if(fromReview)view.flyCamera(round.position,aim,{from:fromReview});}
 // The last teammate has hit and the team now has a choice. `setUpTurn` is
 // skipped above because nobody is up, so the picker is opened here instead.
 if(round.scrambleSelection)beginPick();
 sendPlayer();
}
// Replays a recorded shot. Defaults to the last one, which is what the tools-tray
// button has always meant; the range shot list passes a row's own record so any
// shot in the session can be watched again.
//
// The record is the SHOT ITSELF, not a request to re-simulate it. Re-simulating
// from the five launch numbers would be exact -- the model has no randomness and
// wind is a pure function of settings, both measured -- but it reads the world as
// it is NOW, and on a range the green moves and the firmness changes. A replay
// that quietly shows a different roll than the one you hit is worse than no
// replay, so the trajectory that happened is the thing kept.
function replayShot(record=lastShot,label='LAST SHOT REPLAY'){
 stopTour();if(!record||flight||dropState)return;
 cancelAdvance();closePanel();closeShotList();const camera={...view.config};
 flight={result:record.result,elapsed:0,index:0,replay:true,camera,aim:record.aim,origin:record.shot.origin,record};
 view.config.follow=true;view.setHole(worldHole(record.hole),true);flight.tv=shotCameraPlan(record.result,view.course);gameAudio?.strike({kind:record.kind,ballMs:record.shot.speed,monitor:!!record.typed});view.setPutting(round.putting);view.setBall(record.shot.origin);view.setCamera(record.shot.origin,record.aim,true);view.setTrail([]);view.hitEffects(record.shot.origin,record.aim,view.course.surface(record.shot.origin.x,record.shot.origin.z),record.shot.speed);view.aimLine.visible=false;view.aimRing.visible=false;view.lowerFlag?.();showLiveResult();$('flightLabel').textContent=label;updateExplorer();updateHUD();
}
// Strokes, what that is called, and how it moved the round -- the three things
// worth reading in the second after a ball drops.
function holeCard(event){
 const rel=Number.isFinite(event.score)?Math.round((event.score-course.par)*100)/100:0;
 const name=holeScoreName(event.score,course.par);
 const tint=parTint(rel,1);
 return `<div class="hole-summary">`
  +`<div class="hole-summary-score"><strong>${scoreText(event.score)}</strong><small>${event.score===1?'STROKE':'STROKES'}</small></div>`
  +`<div class="hole-summary-detail"><strong>${escape(name||'')}</strong><span>Par ${course.par} · ${scoreText(event.puttingTotal)} ${event.puttingTotal===1?'putt':'putts'}</span></div>`
  +`<div class="hole-summary-par" data-side="${parSide(rel,1)}"${tint?` style="background:${tint}"`:''}>${parText(rel)}</div>`
  +`</div>`;
}
// THE HOLE-OUT BANNER. The moment a golfer's score for the hole is final, its
// name lands in the middle of the screen -- "Birdie", "+5" -- and lifts away
// again before the scorecard opens (HOLE_REVEAL_MS).
//
// It watches the CARD rather than the shot, because the card is the one thing
// every format agrees on: stroke and match play write a golfer's score when
// their ball drops or putts are awarded; a scramble writes the whole team's when
// a teammate holes or the team picks a lie that gets automatic putts. So the
// caller notes which seats were carded before the action, and whoever gained a
// score since is announced. Replays never write a card; the range never has one.
const cardedSeats=()=>round.cards.map(c=>Number.isFinite(c?.[round.hole]));
// SOUND (audio.js says when, sound.js says what). A shot's contacts come from
// simulateShot, plus the canopies it flew through and the cup if it dropped,
// sorted once per result and kept off the record's enumerable fields so a
// saved shot does not carry them.
let gameAudio=null,lastSoundScene=0;
function soundsOf(r,h){
 if(r._sounds)return r._sounds;
 const list=[...(r.contacts||[]),...canopyContacts(r.points||[],view.world?.trees||[],q=>h.toWorld(q))];
 if(r.holed)list.push({t:r.time,what:'cup',speed:1,...r.end});
 list.sort((a,b)=>a.t-b.t);
 Object.defineProperty(r,'_sounds',{value:list});
 return list;
}
// Where a sound is, heard from the camera: how far, and how far across.
function heardFrom(c){
 const w=view.course.toWorld(c),cam=view.camera,e=cam.matrixWorld.elements,dx=w.x-cam.position.x,dy=(c.y??cam.position.y)-cam.position.y,dz=w.z-cam.position.z,d=Math.hypot(dx,dy,dz)||1;
 return {dist:Math.max(3,d),pan:clamp((dx*e[0]+dy*e[1]+dz*e[2])/d,-1,1)};
}
// THE FLIGHT'S SOUNDS play as the drawn ball reaches each contact. A jump of
// more than half a second -- a skip, a stalled frame -- plays nothing: every
// bounce at once is worse than silence.
function playFlightSounds(f,from){
 if(!gameAudio)return;const list=soundsOf(f.result,view.course);
 if(f.elapsed-from>.5){f.heard=list.findIndex(c=>c.t>f.elapsed);if(f.heard<0)f.heard=list.length;return;}
 f.heard??=0;
 while(f.heard<list.length&&list[f.heard].t<=f.elapsed){const c=list[f.heard++];if(c.t>=from-.05)gameAudio.contact(c,heardFrom(c));}
}
// The place: biome, wind, temperature, night, and how near the ball is to
// water -- the ball when there is one in play, the camera otherwise.
function updateSoundScene(){
 const w=view.world,h=view.course,cam=view.camera.position;
 const ball=flight?.at??(appMode==='play'&&round?.position?round.position:null);
 const at=ball&&h?h.toWorld(ball):{x:cam.x,z:cam.z};
 // The nearest water says how loud, which sound, and from which side.
 const water=nearestWater(w,at.x,at.z),e=view.camera.matrixWorld.elements,dx=water.x-cam.x,dz=water.z-cam.z,d=Math.hypot(dx,dz);
 gameAudio.setScene({biome:w.settings?.biome,wind:Number(w.settings?.wind)||0,tempC:h?.bio?.temperature??w.bio?.temperature,
  night:!!view.solar&&view.solar.elevation<-4,waterDist:water.dist,waterKind:water.kind,waterPan:d>1?clamp((dx*e[0]+dz*e[2])/d,-1,1):0});
}
// SKINS ON THE BANNER: the last golfer in decides the hole, so their banner
// says what came of it -- who won how many skins, in the winner's colour, or
// that a tie carried them on (on the last hole, that they go unclaimed).
function skinsBannerLine(){
 if(round.mode!=='skins'||!round.holeComplete)return '';
 const e=skins(round.cards,decidedHoles(round)).perHole[round.hole];if(!e)return '';
 const text=holeSkinLine(e,round.players.map(p=>p.name),round.hole,!round.endless&&round.hole+1>=round.holes);
 return `<span class="hole-out-skin">${e.winner!==null?`<i style="background:${playerColour(e.winner)}"></i>`:''}${escape(text)}</span>`;
}
let holeOutTimer=null,holeOutAt=-1e9;
function announceHoleOut(before,{chipIn=false}={}){
 const seats=round.players.map((_,i)=>i).filter(i=>!before[i]&&Number.isFinite(round.cards[i]?.[round.hole]));
 if(!seats.length)return;
 const seat=seats[0],score=round.cards[seat][round.hole],label=holeOutLabel(score,course.par);
 if(!label)return;
 gameAudio?.score(score,course.par);holeOutAt=performance.now();
 // Who, only when there is more than one golfer to tell apart. A scramble
 // score belongs to the team, so the team is named.
 const who=round.players.length<2?'':round.mode==='scramble'?`Team ${round.players[seat].team}`:round.players[seat].name;
 const tint=parTint(label.rel,1),el=$('holeOut');
 el.innerHTML='<canvas class="hole-out-ball" width="72" height="72" aria-hidden="true"></canvas>'+(who?`<span class="hole-out-who"><i style="background:${playerColour(seat)}"></i>${escape(who)}</span>`:'')
  +`<strong class="hole-out-name">${escape(label.name)}</strong>`
  +`<span class="hole-out-line">${scoreText(score)} ${score===1?'stroke':'strokes'} · Par ${course.par}<b data-side="${label.side}"${tint?` style="background:${tint}"`:''}>${parText(label.rel)}</b></span>`
  +skinsBannerLine();
 // Restart the animation even when the banner is already up: hidden, reflow, shown.
 el.hidden=true;void el.offsetWidth;el.hidden=false;
 spinHoleOutBall(el.querySelector('.hole-out-ball'),seatLooks(seat).ball);
 // THE FLOURISH (Phase 6): the rarest the golfer has earned for this score,
 // over the cup, visual only.
 {const prof=profileOf(round.players[seat]),gir=prof?.rounds.find(e=>e.id===round.uid)?.card?.[round.hole]?.gir;
  const lv=prof?levelOf(prof.xp).level:1,id=prof&&flourishFor({score,par:course.par,chipIn},lv);
  if(id){const pin=course.pin;playFlourish($('flourish'),id,()=>view.screenPoint?.(pin),{gold:goldFlourishes(lv)});}}
 clearTimeout(holeOutTimer);holeOutTimer=setTimeout(()=>{el.hidden=true;},2700);
}
// THE CLOSE-UP (spec 7.3): the golfer's ball beside the score, turning slowly
// while the banner is up -- drawn from the finish's own rule a frame at a time,
// 72 pixels square, so it costs a few thousand pixel writes a frame and no 3D
// render. Stops when the banner goes. PLACED: a turn every 4 s.
function spinHoleOutBall(canvas,finish){
 if(!canvas)return;const ctx=canvas.getContext('2d'),size=canvas.width,t0=performance.now();
 const draw=now=>{if(!canvas.isConnected||canvas.closest('[hidden]'))return;
  ctx.putImageData(new ImageData(ballPixels(finish,size,((now-t0)/4000)%1),size,size),0,0);requestAnimationFrame(draw);};
 draw(t0);
}
function renderResult(event){
 const r=latest.result,s=latest.shot;const title=round.finished?'Round complete':round.holeComplete?'Hole complete':event.holed?'In the hole!':r.lipped?'Lipped out!':event.putts?`${scoreText(event.putts)} putts awarded`:r.hazard?r.hazard:'Shot information';
 let html=`<h3>${title}</h3>${event.complete?holeCard(event):''}<p>${r.hazard?(r.hazard==='Water'?'In a penalty area. Choose your relief at the foot of the screen.':'Out of bounds.'):event.putts?`${scoreText(event.putts)} automatic putts added · ${round.putting.mode==='decimal'?'decimal':'dartboard'} putting.`:''}</p>`.replace('<p></p>','')+gridHTML();
 // The choice is made ON THE COURSE now: every ball is drawn where it lies and
 // the bar at the foot of the screen steps between them. A duplicate list here
 // would be a second way to answer the same question, and the worse one.
 if(round.scrambleSelection)html+='<p>Every ball the team hit is on the course. Step through them below and take the one you want.</p>';
 if(round.holeComplete)html+=`<button class="continue" id="continueRound">${round.finished?'View final scorecard':'Continue to hole '+(round.hole+2)} →</button>`;
 $('shotResult').innerHTML=html;sizePanel();

 if($('continueRound'))$('continueRound').onclick=()=>{if(round.finished)openPanel('score');else advanceHole();};
}
function afterSelection(){endPick();save();setUpTurn();if(round.holeComplete){showHoleCompletion();toast('Team score recorded, including automatic putts.');}else toast('Team lie selected. Everyone plays from here.');}

// CHOOSING THE TEAM'S BALL, ON THE COURSE RATHER THAN FROM A LIST.
//
// A scramble choice used to be a row of buttons reading "Alex · 148 yd". That is
// the one thing a list cannot answer: whether the shorter one is behind a
// bunker, or the longer one is on the wrong side of a ridge. Every ball the team
// hit is drawn where it lies in the colour of the golfer who hit it, the bar
// steps between them and puts the camera behind each in turn, and the check mark
// takes the one you are looking at.
let pickIndex=0;
const pickList=()=>round.candidates.map(c=>({...c,colour:playerColour(c.player),
 name:round.players[c.player]?.name||'Player'}));
function beginPick(){
 if(!round.scrambleSelection||!round.candidates.length)return;
 pickIndex=0;
 // The nearest ball first. It is not always the one to take, but it is the one
 // a group looks at first, and opening on it means the common case is one press.
 const list=pickList();
 pickIndex=list.reduce((best,c,i)=>c.distance<list[best].distance?i:best,0);
 showPick();
}
function showPick(){
 const list=pickList();
 if(!list.length)return endPick();
 pickIndex=Math.max(0,Math.min(list.length-1,pickIndex));
 const c=list[pickIndex];
 $('pickBar').hidden=false;
 $('pickCount').textContent=`${pickIndex+1} / ${list.length}`;
 $('pickSummary').innerHTML=`<span class="pick-who"><span class="player-dot" style="background:${c.colour}"></span>`
  +`${escape(c.name)}</span> · ${Math.round(c.distance/YARD)} yd to the pin`
  +(c.putts?` · ${scoreText(c.putts)} putts`:c.penalty?` · +${c.penalty} penalty`:'')
  +(c.hazard?` · ${escape(String(c.hazard))}`:'');
 view.setCandidateBalls(list,pickIndex);
 // The playing ball is HIDDEN while the team decides. There is no single ball
 // yet -- that is the question -- and leaving it on the course puts a second
 // mesh inside whichever candidate it happens to be sitting on.
 view.ball.visible=false;view.ballRing.visible=false;
 // The camera goes behind the ball looking down the line to the pin -- the view
 // the next shot would be played from, which is the whole question being asked.
 const bearing=Math.atan2(course.pin.x-c.position.x,course.pin.z-c.position.z)*180/Math.PI;
 view.setCamera(c.position,bearing,false);
 view.aimLine.visible=false;view.aimRing.visible=false;
 updateHUD();
}
function stepPick(by){
 const n=round.candidates.length;if(!n)return;
 pickIndex=(pickIndex+by+n)%n;
 showPick();
}
function endPick(){
 $('pickBar').hidden=true;
 view.clearCandidateBalls?.();
 if(view?.ball)view.ball.visible=true;
}
// The hole, seen whole. Every tracer at once from a slow high orbit, for as long
// as the scorecard is up. The camera settings are put back exactly as they were
// -- this is a look at the hole, not a change to how the player views the game.
function startHoleSummary(){
 if(!holeTrails.length)return;
 summaryCamera={...view.config};
 holeSummary=0;
 view.setTrail([]);
 view.setShotHistory(holeTrails);
 view.ball.visible=false;view.ballRing.visible=false;view.aimLine.visible=false;view.aimRing.visible=false;
 view.summaryOrbit(0);
}
function endHoleSummary(){
 if(!summaryCamera)return;
 Object.assign(view.config,summaryCamera);summaryCamera=null;
 view.clearShotHistory();
 view.ball.visible=true;view.ballRing.visible=true;
}
function cancelAdvance(){clearTimeout(completionTimer);completionTimer=null;clearTimeout(advanceTimer);clearInterval(advanceCountdown);advanceTimer=advanceCountdown=null;}
// A HOLE NOBODY HAS PLAYED YET gets the arrival: the establishing pose, the
// hold, then the descent onto the ball. Anything else -- resuming a round in
// the middle of a hole, stepping back from the overview -- gets the plain
// flight, because an establishing shot of a hole you are halfway down is a
// recap nobody asked for.
//
// The range is excluded on purpose. It is one flat rectangle with no shape to
// establish, and you go there to hit balls: a hold every visit would be in the
// way by the second one.
function freshHole(){
 return !settings.range&&!round.finished&&!round.holeComplete&&
  !round.scrambleSelection&&round.strokes?.every(n=>n===0);
}
function arriveAtHole(){
 if(freshHole())view.arriveAtHole(round.position,aim);
 else view.flyCamera(round.position,aim);
}
function advanceHole(){
 cancelAdvance();endHoleSummary();
 // Growing the next hole is real work that can fail, and this is reached from a
 // timer as often as from a button -- an unhandled rejection here would leave
 // the player on a finished hole with nothing happening and nothing said.
 if(round.endless)return void growNextEndless().catch(e=>{
  toast(e?.message||'That hole could not be grown. Try again.');
  openPanel('score');
 });
 if(round.nextHole()){closePanel();loadCourse();arriveAtHole();}
}
// Each hole is grown from the run's seed and its own number, so the same run
// always plays the same holes in the same order however many times it is put
// down and picked up again.
async function growNextEndless(){
 if(!round.nextHole())return;
 closePanel();
 await whileGenerating('Growing the next hole…',async report=>{
  // The golfer's own settings ride across each new hole. Rebuilt from the seed
  // alone, every hole quietly reset the bag in `settings`, and the next autosave
  // wrote that reset to disk.
  settings=endlessFor(round.seed,round.hole,settings);
  await prepareWorld(report);
  loadCourse();
 });
 // After the overlay, not inside it: the hold is meant to be looked at, and
 // starting it behind a full-screen scrim spends it on nothing.
 arriveAtHole();
}
// THE SCORECARD WAITS FOR THE XP (the owner, 14 October 2026). It opened
// HOLE_REVEAL_MS after the hole-out, while the popup was still filling its
// bar, and blurred it out. Now HOLE_REVEAL_MS is the least it waits: while the
// popup or a level-up banner is up or queued it looks again every
// SCORECARD_RECHECK_MS, and opens SCORECARD_AFTER_XP_MS after they clear. PLACED.
const SCORECARD_RECHECK_MS=200,SCORECARD_AFTER_XP_MS=400;
function showHoleCompletion(){
 // The lab is a bench, not a round. Holing out there is the result being
 // examined, so nothing sweeps it away: no scorecard, no countdown, no next hole.
 startHoleSummary();
 let waited=false;
 const open=()=>{completionTimer=null;if(!round.holeComplete||flight)return;
  if(xpBusy()){waited=true;completionTimer=setTimeout(open,SCORECARD_RECHECK_MS);return;}
  if(waited){waited=false;completionTimer=setTimeout(open,SCORECARD_AFTER_XP_MS);return;}
  openPanel('score');if(round.finished)return;
 let seconds=8;const label=$('autoAdvanceLabel');if(label)label.textContent=`Next hole in ${seconds} seconds`;
 advanceCountdown=setInterval(()=>{seconds--;if($('autoAdvanceLabel'))$('autoAdvanceLabel').textContent=`Next hole in ${Math.max(0,seconds)} seconds`;},1000);
 advanceTimer=setTimeout(advanceHole,8000);
 if($('pauseAdvance'))$('pauseAdvance').onclick=()=>{cancelAdvance();$('autoAdvanceLabel').textContent='Automatic advance paused';$('pauseAdvance').disabled=true;};
 };
 cancelAdvance();completionTimer=setTimeout(open,HOLE_REVEAL_MS);
}
// A range session: every shot hit since the range was opened.
//
// Kept here rather than on the round because there IS no round -- no strokes, no
// card, no hole to complete. The only thing a range owes you is what the ball
// did, so that is the only thing recorded.
let rangeShots=[];
// Offline is the shot's own miss, measured across the line it was AIMED down --
// not the distance from the green. Aiming at the 250 target and finishing beside
// it is a straight shot, and a readout that called it 30 yards offline because
// the green is elsewhere would be measuring the wrong thing.
function recordRangeShot(result){
 const shot=latest?.shot;if(!shot)return;
 rangeShots.push({
  // WHO HIT IT. A practice ground never rotates the golfer on its own -- the
  // card is clicked to change who is up -- so this is simply whoever was
  // selected when the ball was struck, and it is what the shot list filters on.
  player:round.active,
  playerName:round.player?.name??'Player',
  // A shot fired from typed data — the Lab tools box, or a real connected
  // monitor — did not come from the club selector, so it is not named after
  // whatever club happened to be showing.
  club:latest.typed?'Launch monitor':(clubs[$('club').value]?.label??$('club').value),
  // WHAT IT WAS HIT WITH, which is a different question from where the numbers
  // came from. `club` above is the SOURCE, and it says Launch monitor for a
  // shot that did not come off the club selector. Grouping dispersion by that
  // put a driver and a 7 iron in one circle with a 64 yard radius -- two clubs a
  // hundred yards apart, averaged into a number describing neither.
  //
  // The selector is the player's own statement of what they are hitting, which
  // is exactly how a real monitor session works: you pick the club in the app
  // and the device sends the ball. Nothing is inferred from the ball data.
  clubKey:clubs[$('club').value]?.label??$('club').value,
  carry:result.carry,total:result.total,apex:result.apex,
  offline:offlineOf(shot.origin,result.end,lastShot?.aim??aim),
  speed:shot.speed,vla:shot.vla,spin:shot.spin,axis:shot.spinAxis,
  landing:result.landingSpeed,
  // WHERE IT FINISHED. Two numbers, kept on every row for as long as the
  // session lasts -- the dispersion read needs them after the replay payload
  // has aged out, and reconstructing them from carry and offline would be
  // deriving a position we already had exactly.
  end:{x:result.end.x,z:result.end.z},
  // THE SHOT, kept so the row can be watched again. `lastShot` is built fresh
  // per shot and its `result.points` is the SAME array `pushTrail` holds, so
  // for a shot still on the field this costs nothing at all.
  replay:lastShot,
 });
 // Past the tracer window the row would be the only thing keeping a ~660-point
 // flight alive, and a session has no end. The payload is dropped and the row
 // goes summary-only; the numbers, which are what the list is for, all stay.
 for(let i=rangeShots.length-1-SHOT_LINE_MAX;i>=0&&rangeShots[i].replay;i--)rangeShots[i].replay=null;
}
// The launch-monitor half of this is deliberately read off the SHOT that was
// fired rather than re-derived: speed, launch angle, spin and spin axis are
// inputs to the model, so reporting them back is reporting what was asked for.
// When real monitor data arrives it lands in the same four slots.
// Every shot this session for one golfer, over most of the screen.
//
// Opened by clicking the SHOT number on the player card, so the thing you click
// names what you get: that player's shots. Reads `rangeShots`, which has carried
// the full launch-monitor set from the beginning -- this is presentation over
// data that already existed, not new recording.
function openShotList(index=round.active){
 const box=$('shotList');if(!box)return;
 const who=round.players[index]?.name??'Player';
 const mine=rangeShots.map((s,i)=>({...s,n:i+1})).filter(s=>s.player===index);
 $('shotListTitle').textContent=`${who} · ${mine.length} shot${mine.length===1?'':'s'}`;
 $('shotListSub').textContent=mine.length
  ? 'This session. Launch numbers are the shot that was fired, not a re-derivation.'
  : 'Nothing hit yet this session.';
 if(!mine.length){
  $('shotListBody').innerHTML=`<p class="empty">No shots recorded for ${escape(who)} yet.</p>`;
 }else{
  const num=(v,d=0)=>Number.isFinite(v)?v.toFixed(d):'—';
  $('shotListBody').innerHTML=`<table><thead><tr>`
   +['#','CLUB','BALL mph','LAUNCH ANGLE °','SPIN','AXIS','CARRY yd','TOTAL yd','OFFLINE yd','APEX ft','','']
     .map(h=>`<th>${h}</th>`).join('')
   +`</tr></thead><tbody>`
   +mine.map(s=>`<tr><td>${s.n}</td><td>${escape(s.club)}</td>`
     +`<td>${num(s.speed/MPH,1)}</td><td>${num(s.vla,1)}&deg;</td>`
     +`<td>${num(s.spin)}</td><td>${num(s.axis,1)}&deg;</td>`
     +`<td>${num(s.carry/YARD,1)}</td><td>${num(s.total/YARD,1)}</td>`
     // Offline keeps its side: left of the aim line reads L, right reads R.
     +`<td>${num(Math.abs(s.offline/YARD),1)} ${s.offline>=0?'R':'L'}</td>`
     +`<td>${num(s.apex*3.28084)}</td>`
     // Disabled rather than missing once the payload has aged out: a row with no
     // button at all reads as a bug, and the title says which it is.
     +`<td><button class="row-replay" data-view="${s.n-1}"${s.replay?'':' disabled'}>View</button>`
     +`<td><button class="row-replay" data-replay="${s.n-1}"${s.replay?'':' disabled title="Only the last '+SHOT_LINE_MAX+' shots of a session can be replayed."'}>Replay</button></td></tr>`).join('')
   +`</tbody></table>`;
  for(const b of $('shotListBody').querySelectorAll('[data-view]'))
   b.onclick=()=>{const i=Number(b.dataset.view),row=rangeShots[i];
    if(!row?.replay){toast('That shot is past the replay window.');return;}
    // PINNED. The views stop following play until the next shot is struck,
    // because a panel that jumped to the live ball the moment you opened an old
    // row would make the row unreadable.
    viewShot={...row.replay,label:`Shot ${i+1} · ${row.club}`};
    closeShotList();openPanel('views');};
  for(const b of $('shotListBody').querySelectorAll('[data-replay]'))
   b.onclick=()=>{const row=rangeShots[Number(b.dataset.replay)];
    if(!row?.replay){toast('That shot is past the replay window.');return;}
    const n=Number(b.dataset.replay)+1;replayShot(row.replay,`SHOT ${n} REPLAY`);};
 }
 box.hidden=false;
}
const closeShotList=()=>{const b=$('shotList');if(b)b.hidden=true;};
// Redraws the 2D views if they are open. Called after every shot and whenever a
// row is chosen, and a no-op when the panel is closed -- so every caller can
// call it without asking whether anyone is looking.
function drawShotViews(){
 const side=$('shotSide'),plan=$('shotPlan');if(!side||!plan)return;
 const record=viewShot??lastShot;
 const caption=$('viewsCaption');
 if(!record?.result?.points?.length){
  side.getContext('2d').clearRect(0,0,side.width,side.height);
  plan.getContext('2d').clearRect(0,0,plan.width,plan.height);
  if(caption)caption.textContent='Nothing hit yet.';
  return;
 }
 // Height above where the ball was struck, as if the ground were flat
 // (shot-views.js, shotProfile) -- never the turf under each sample.
 const profile=shotProfile(record.result.points,record.shot.origin,record.aim??0);
 drawSideView(side,profile);
 drawPlanView(plan,profile);
 if(caption){
  const r=record.result;
  caption.textContent=`${record.label??'Last shot'} · carry ${(r.carry/YARD).toFixed(1)} yd · total ${(r.total/YARD).toFixed(1)} yd · apex ${Math.round(r.apex*3.28084)} ft`;
 }
}
// THE SHOT PANEL, AND WHY IT IS DRAWN FROM A RECORD RATHER THAN FROM THE SCREEN.
//
// One panel carries the shot's numbers, along the bottom of the course by
// default, moved and resized like any other (layout.js). It REPLACED three
// things on 10 October 2026, at the owner's request: the flight bar (a pill
// showing ball speed, launch and spin beside Skip while the ball flew), the
// big-numbers card a monitor shot got after it landed, and the "Last shot" fold
// at the foot of the shot controls. Three readouts that each decided for
// themselves what a shot was worth showing became one, showing the tiles the
// player ticks in Shot data, in the order they dragged them into.
//
// ITS LINE LIVES IN THE PLAY WINDOW (13 October 2026, the owner's call). Once
// the numbers became tiles (*THE SHOT TILES*) the panel was a slim bar -- which
// shot this is, Skip, the end-of-flight countdown, a penalty or hole-out note,
// the fold -- in a window of its own along the foot of the course. It is now a
// section near the top of the window the player plays from: the shot controls
// by hand, the launch monitor's window when it is armed (drawMonitorState
// moves it). While a ball flies, that window shrinks to this line alone
// (style.css, *A BALL IN THE AIR CLEARS THE SCREEN*), so Skip and the live dot
// stay where the player was already looking.
//
// Every state renders the SAME function from the SAME record: the shot in the
// air, the shot just played, the shot played ten minutes ago, a replay, a range
// session. `record` is a lastShot-shaped object or null. Null is a real state
// -- nothing has been hit yet -- and renders the configured tiles with dashes in
// them, so the panel has the shape it will keep instead of appearing from
// nowhere.
//
// WHILE A BALL FLIES the record is the flight's own, read at the flight's clock
// (`liveRecord`, shot-data.js): everything the strike fixed shows at once, and
// carry and total COUNT UP with the ball -- carry freezing where it lands, total
// running on through the roll. This reverses the rule of 26 September, which
// kept carry and total off the screen until the ball stopped, because the whole
// flight is simulated at the strike and printing its result gave the ending
// away. A number that climbs with the ball is a reading, not a prediction, and
// the owner asked for exactly that. Until then the panel showed the shot BEFORE
// the one in the air, which is gone with the rule.
function cardRecord(){return flight?.record?liveRecord(flight.record,flight.elapsed):lastShot;}
// THE SHOT TILES (11 October 2026, the owner's call after trying a grid in
// sections): every number ticked in Shot data is its own small box on the
// course, dragged anywhere and left there -- the way GSPro places its data
// tiles. The shot panel shrank to a slim bar for the shot's state, Skip, the
// countdown and any penalty message, and its fold shows and hides the tiles;
// since 13 October that bar is a line in the play window.
// Rejected on the way here: one panel of tiles (too big a block over the
// course), and the same split into Ball / Club / Result sections, boxed and
// equal-sized (the owner: "I don't like it").
//
// WHERE A TILE NOBODY HAS MOVED SITS (13 October 2026, the owner's call). On
// anything bigger than a phone, in a row along the foot of the course,
// centred in the room between the window you play from -- the shot
// controls, or the launch monitor's window when it is armed -- and the map;
// what does not fit goes in a second row above. On a phone, in a row across
// the top, three at most and sized to share it. Until then they sat in rows
// centred on the shot bar along the foot of the course; the bar has since gone
// into the play window (*THE SHOT PANEL*), so the row is placed on its own.
// Tried and rejected the same day: one column down the left, beside the play
// window and level with its top. The owner: align them "to the bottom instead
// of the left side". Also rejected: a column under the window, which shrinks
// to its shot line while a ball flies -- tiles hung from its foot would jump
// up the screen with every shot -- and at 1280 x 720 has no room under it.
//
// A moved tile keeps its place as a fraction of the playing area, separately
// for each set -- by hand, an armed monitor, a phone -- (fairway-shot-tiles-v1);
// Reset layout puts every tile back.
function panelFields(){return shotPrefs.fields;}
// Whether the phone layout is in force, read off the stylesheet, which decides
// it (`--phone` in its phone query), so the tiles can never disagree with the
// rest of the screen about what a phone is.
const phoneScreen=()=>getComputedStyle($('world')).getPropertyValue('--phone').trim()==='1';
// Which set of tiles is on screen: a phone's own, or the one for the way of
// playing in force (shot-data.js).
const tileSet=()=>phoneScreen()?'phone':playMode();
let gridSet=null;
// Loads the set in force if it has changed -- arming a monitor, or a window
// crossing into or out of the phone layout -- and says whether it did.
function syncTileSet(){
 const s=tileSet();if(s===gridSet)return false;
 gridSet=s;shotDataEditing=null;shotPrefs=loadShotData(s);refreshShotGrid();return true;
}
// A tile's note is the lie's penalty, in red beside the number (shot-data.js).
const tileInner=c=>`<strong>${c.value}${c.unit?`${c.unit.startsWith('°')?'':' '}<small>${c.unit}</small>`:''}${c.note?`<em class="tile-note">${escape(c.note)}</em>`:''}</strong><span>${escape(c.label.toUpperCase())}</span>`;
const TILE_KEY='fairway-shot-tiles-v1';
let tilePlaces={};try{tilePlaces=JSON.parse(localStorage.getItem(TILE_KEY))||{};}catch{}
const keepTilePlaces=()=>{try{localStorage.setItem(TILE_KEY,JSON.stringify(tilePlaces));}catch{}};
function resetTilePlaces(){tilePlaces={};keepTilePlaces();placeTiles();}
// The grid's old entry point: it draws the tiles and leaves nothing in the
// bar, so the callers that build the bar's HTML around it keep working. The
// folded summary is redrawn with them: a shot that ended through renderResult
// left it on the last number counted in flight -- "16 carry" beside a carry
// tile reading 219 (found 13 October 2026).
function gridHTML(record=cardRecord()){drawTiles(record);drawShotSummary(record);return '';}
function drawTiles(record){
 const box=$('shotTiles');if(!box)return;
 const cells=shotGrid(record,{fields:panelFields(),columns:0}).cells;
 box.innerHTML=cells.map(c=>`<div class="shot-tile${c.blank?' blank':''}" data-field="${c.id}" title="Drag to move">${tileInner(c)}</div>`).join('');
 placeTiles();
}
function placeTiles(){
 const box=$('shotTiles'),w=$('world');if(!box||!w||!box.offsetParent)return;
 const W=w.clientWidth,H=w.clientHeight,z=uiZoom(),wr=w.getBoundingClientRect(),gap=6;
 const rel=el=>{const r=el.getBoundingClientRect();return {l:(r.left-wr.left)/z,t:(r.top-wr.top)/z,r:(r.right-wr.left)/z,b:(r.bottom-wr.top)/z};};
 const shown=el=>el&&!el.hidden&&el.offsetParent&&el.getBoundingClientRect().width>0;
 // The window the player plays from; armed, the shot controls are not shown.
 const home=[document.querySelector('#world .bottom-area'),$('monitorPanel')].find(shown);
 const phone=phoneScreen();
 for(const t of box.children){t.style.width='';t.style.minWidth='';t.classList.toggle('phone',phone);}
 const mine=tilePlaces[tileSet()]||{};
 const free=[...box.children].filter(t=>{
  const p=mine[t.dataset.field];
  if(!p)return true;
  t.style.left=Math.max(0,Math.min(W-t.offsetWidth,p.x*W))+'px';t.style.top=Math.max(0,Math.min(H-t.offsetHeight,p.y*H))+'px';
  return false;
 });
 if(!free.length)return;
 if(phone){
  // Across the top, from the left edge to what holds the top-right corner --
  // the wind, and held sideways the camera button beside it -- starting past
  // the play window if, held sideways, it runs up to the top.
  const corner=[w.querySelector('.weather'),$('camButton')].filter(shown).map(rel);
  const y=corner.length?Math.min(...corner.map(r=>r.t)):10;
  const h=home?rel(home):null;
  const x0=h?(h.t<y+60?h.r+gap:h.l):10;
  const right=Math.min(W-10,...corner.filter(r=>r.t<y+50).map(r=>r.l-gap));
  const each=Math.max(48,Math.min(132,(right-x0-gap*(free.length-1))/free.length));
  free.forEach((t,i)=>{t.style.width=each+'px';t.style.left=x0+i*(each+gap)+'px';t.style.top=y+'px';});
  return;
 }
 // A row along the foot of the course, centred in the
 // room between the play window and the map; rows that do not fit stack
 // upward from the foot.
 const box2=el=>shown(el)?rel(el):null;
 const h=box2(home),map=box2(w.querySelector('.minimap'));
 let lo=12,hi=W-12;
 for(const r of [h,map].filter(Boolean)){
  if((r.l+r.r)/2<W/2)lo=Math.max(lo,r.r+gap*2);else hi=Math.min(hi,r.l-gap*2);
 }
 if(hi-lo<200){lo=12;hi=W-12;}
 // Each tile its own width: made all as wide as the widest ("Launch
 // direction"), eight no longer fitted one row at 1440 x 900 and the eighth sat
 // alone under the other seven.
 const rows=[[]];let used=0;
 for(const t of free){const tw=t.offsetWidth;if(rows.at(-1).length&&used+tw>hi-lo){rows.push([]);used=0;}rows.at(-1).push(t);used+=tw+gap;}
 const rowH=Math.max(...free.map(t=>t.offsetHeight))+gap;
 rows.forEach((row,i)=>{
  const width=row.reduce((a,t)=>a+t.offsetWidth+gap,-gap);
  let x=Math.max(0,lo+(hi-lo-width)/2);
  const y=Math.max(0,H-16-rowH*(rows.length-i)+gap);
  for(const t of row){t.style.left=x+'px';t.style.top=y+'px';x+=t.offsetWidth+gap;}
 });
}
// DRAGGING A TILE: anywhere on it, mouse or finger, kept within the playing
// area. A press that never moves is not a drag and saves nothing.
{
 const box=$('shotTiles');
 box?.addEventListener('pointerdown',ev=>{
  const t=ev.target.closest('.shot-tile');if(!t||ev.button)return;
  ev.preventDefault();
  const w=$('world'),z=uiZoom(),sx=ev.clientX,sy=ev.clientY,ox=t.offsetLeft,oy=t.offsetTop;let moved=false;
  const move=e=>{
   if(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<4)return;
   moved=true;t.classList.add('dragging');
   t.style.left=Math.max(0,Math.min(w.clientWidth-t.offsetWidth,ox+(e.clientX-sx)/z))+'px';
   t.style.top=Math.max(0,Math.min(w.clientHeight-t.offsetHeight,oy+(e.clientY-sy)/z))+'px';
  };
  const up=()=>{
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
   t.classList.remove('dragging');if(!moved)return;
   (tilePlaces[tileSet()]??={})[t.dataset.field]={x:t.offsetLeft/w.clientWidth,y:t.offsetTop/w.clientHeight};keepTilePlaces();
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
 });
 // The unmoved tiles follow the play window and the screen; a screen that
 // turns into a phone, or stops being one, changes the set as well.
 const again=()=>requestAnimationFrame(()=>{if(!syncTileSet())placeTiles();});
 new ResizeObserver(again).observe($('world'));
 for(const el of [document.querySelector('#world .bottom-area'),$('monitorPanel')])if(el)new MutationObserver(again).observe(el,{attributes:true,attributeFilter:['style','class','hidden']});
 new MutationObserver(again).observe($('world'),{attributes:true,attributeFilter:['class']});
}
// What the shot was, in one line, above the grid. The numbers themselves are in
// the grid, so this says which shot you are looking at rather than repeating it.
function shotCaption(record=cardRecord()){
 // Short: it shares a line with the fold in the play window, and the tiles
 // already say there is nothing yet with their dashes.
 if(!record)return 'Nothing hit yet.';
 const bits=[escape(record.player??'')];
 if(record.club)bits.push(escape(record.club));
 // The device's OWN name, as the shot carried it. This used to print the
 // bridge's device STATUS -- an object of ready and ball flags -- which read
 // "Alex · Driver · [object Object]" under every monitor shot.
 if(record.typed&&record.shot?.device)bits.push(escape(record.shot.device));
 return bits.filter(Boolean).join(' · ');
}
// The range's line says where the session stands rather than whose shot it was.
// Between shots only: while a ball flies it is that shot's caption like
// anywhere else.
function rangeCaption(){
 const s=rangeShots.at(-1);
 if(!s)return 'Ready when you are. Every shot stays on the field behind you.';
 const n=rangeShots.length;
 const mean=k=>rangeShots.reduce((a,b)=>a+b[k],0)/n;
 // Dispersion as a standard deviation, not as a min-to-max spread: one shank
 // should not be allowed to describe a session.
 const spread=Math.sqrt(rangeShots.reduce((a,b)=>a+(b.offline-mean('offline'))**2,0)/n);
 return `${escape(s.club)} · shot ${n} of the session`
  +(n>1?` · average carry ${Math.round(mean('carry')/YARD)} yd · offline spread ±${(spread/YARD).toFixed(1)} yd`:'');
}
// THE WHOLE PANEL, redrawn. Every caller that used to rebuild its own version --
// standing, live, the range, a change in Shot data -- comes here.
function renderShotPanel(){
 const box=$('shotResult');if(!box)return;
 const record=cardRecord();
 const lead=rangeMode&&!flight?rangeCaption():shotCaption(record);
 // The caption -- whose shot, which club, or where the range session stands --
 // rides in the header beside the label rather than on a line of its own: the
 // panel sits over the course, and every line it spends is course hidden.
 $('shotCaption').innerHTML=lead;
 box.innerHTML=gridHTML(record);
 sizePanel();
 drawPanelState();
}
// How many tiles wide the panel is by default: all of them in one row, or the
// column count the player fixed. The stylesheet caps it to the space there is.
function sizePanel(){
 placeTiles();
}
// Only the GRID, when the choice of tiles or their order changes: the panel may
// be showing a hole-out or a penalty above it (renderResult), which a full
// redraw would replace with the plain caption.
function refreshShotGrid(){
 drawTiles(cardRecord());drawShotSummary();
}
function showStandingResult(){renderShotPanel();}
function showRangeResult(){renderShotPanel();}
function showLiveResult(){renderShotPanel();}
// The header: what the panel is showing, and Skip while there is something to
// skip. The countdown at the end of a flight -- "Final lie · playing on in 3s"
// -- is written over the label by `liveLine` and stays until the flight ends.
function drawPanelState(){
 const panel=$('shotPanel');if(!panel)return;
 const flying=!!flight;
 panel.classList.toggle('flying',flying);
 $('skipFlight').hidden=!flying;
 if(!flying){$('flightLabel').textContent='LAST SHOT';return;}
 if(flight.replay||flight.endHold)return;
 $('flightLabel').textContent=flight.result?.puttStroke?'BALL ROLLING':'BALL IN FLIGHT';
}
// The folded line: carry and total, from the same record the grid describes.
function drawShotSummary(record=cardRecord()){
 const el=$('shotSummary');if(!el)return;
 const pick=id=>shotGrid(record,{fields:[id],columns:2}).cells[0];
 const carry=pick('carry'),total=pick('total');
 el.innerHTML=carry.blank?'<small>Nothing hit yet</small>':`${carry.value}<small> carry</small> · ${total.value}<small> total</small>`;
}
// EVERY FRAME OF A FLIGHT, the tiles that change are rewritten in place -- the
// result group only, and only when what they print has changed. Rebuilding the
// whole grid sixty times a second would also tear a tile out from under a
// finger that was dragging it.
function drawLiveTiles(){
 if(!flight?.record)return;
 const box=$('shotTiles');if(!box)return;
 const record=cardRecord();
 for(const el of box.querySelectorAll('[data-field]')){
  const f=fieldById(el.dataset.field);if(f?.group!=='flight')continue;
  const c=shotGrid(record,{fields:[f.id],columns:2}).cells[0];
  const html=tileInner(c);
  if(el.dataset.shown===html)continue;
  el.dataset.shown=html;el.innerHTML=html;el.classList.toggle('blank',c.blank);
 }
 drawShotSummary(record);
 drawMeterResult(record);
}
// The end-of-flight countdown -- "Final lie · playing on in 3s" -- goes in the
// panel's header, which is on screen while the ball is up.
function liveLine(html){const el=$('flightLabel');if(el)el.innerHTML=html;}
// Back to the mat, with the club the player chose still in their hands.
//
// NOT setUpTurn: that picks a club from the distance to the pin and aims at the
// fairway. On a range both are wrong -- moving the green would silently swap
// your club, and the whole point is to hit the same club until you are happy
// with it.
function setUpRangeTurn(){
 syncArmed();
 const tee=course.tees[round.tee]||Object.values(course.tees)[0];
 round.positions[round.active]={x:tee.x,z:tee.z};round.teePlaced=true;
 const p=round.position;shotShape={...DEFAULT_SHAPE};cancelSwing();
 aim=Math.atan2(course.pin.x-p.x,course.pin.z-p.z)*180/Math.PI;
 aimRange=Math.hypot(course.pin.x-p.x,course.pin.z-p.z);
 view.setBall(p);updateAim();view.setReadingHeading(p,aim);view.setCamera(p,aim);updateHUD();
}

// THE BAG PANEL edits one golfer's bag: whoever is up in a round (any golfer in
// the group can be picked), or the profile it was opened from. Rows are edited
// in place and checked together on Save, because a bag is valid or not as a
// whole -- one putter, distinct names, at most fourteen clubs.
let bagOwner=null,bagReturn=null;
const bagClubsSafe=p=>{try{return Object.values(bagClubs(p.bag??stockBag()));}catch{return Object.values(bagClubs(stockBag()));}};
function renderBag(content){
 const group=appMode==='play'&&round&&!menuBackdrop?round.players.map(profileOf).filter(Boolean):[];
 const owner=findProfile(profiles,bagOwner)||profileOf(round?.player)||group[0]||mainProfile(profiles);
 if(!owner){content.innerHTML='<p class="note">Name a player first: a bag belongs to a golfer\'s profile.</p>';return;}
 bagOwner=owner.id;
 const bag=owner.bag??stockBag();
 const kindOptions=(sel,putter)=>Object.entries(CLUB_KINDS).filter(([k])=>putter?k==='putter':k!=='putter').map(([k,c])=>`<option value="${k}"${k===sel?' selected':''}>${c.label}</option>`).join('');
 const row=c=>`<div class="bag-row" data-id="${escape(c.id)}"><input class="bag-name" aria-label="Club name" maxlength="${MAX_CLUB_NAME}" value="${escape(c.name)}"><select class="bag-kind" aria-label="Kind of club"${c.kind==='putter'?' disabled':''}>${kindOptions(c.kind,c.kind==='putter')}</select><input class="bag-carry" type="number" aria-label="${c.kind==='putter'?'Roll':'Carry'} in yards" min="${c.kind==='putter'?1:10}" max="${c.kind==='putter'?100:400}" step="1" value="${c.carry}"><button class="small-icon bag-remove" aria-label="Take ${escape(c.name)} out of the bag" title="Take it out"${c.kind==='putter'?' disabled':''}><i data-lucide="x"></i></button></div>`;
 const sorted=[...bag].sort((x,y)=>x.kind==='putter'?1:y.kind==='putter'?-1:y.carry-x.carry);
 content.innerHTML='<div class="bag-editor">'+(group.length>1?`<label class="field">Whose bag<select id="bagOwner">${group.map(p=>`<option value="${p.id}"${p.id===owner.id?' selected':''}>${escape(p.name)}</option>`).join('')}</select></label>`:`<p class="bag-owner">${escape(owner.name)}'s bag</p>`)
  +`<p class="note">Name each club, choose what kind it is, and set its full-swing carry. The kind sets how it launches and spins; your carry sets how far. The putter's number is its full-power roll on a level Stimp 10 green. Up to ${MAX_BAG} clubs. Distances are for level ground in still air; slope, wind, lie and your flight profile still move the shot.</p>`
  +`<div class="bag-head"><span>Club</span><span>Kind</span><span>Yards</span><span></span></div><div class="bag-list" id="bagList">${sorted.map(row).join('')}</div>`
  +`<button class="secondary" id="bagAdd"><i data-lucide="plus"></i> Add a club</button>`
  +`<p class="field-error" id="playError"></p><button class="primary" id="saveBag">Save bag</button><button class="secondary" id="resetBag">Restore the stock bag</button></div>`;
 icon();
 // Opened from the profile page the sheet keeps that page's scroll; start at the top.
 for(const el of [content,content.parentElement])if(el)el.scrollTop=0;
 const list=$('bagList');
 const rows=()=>[...list.querySelectorAll('.bag-row')];
 const read=()=>rows().map(r=>({id:r.dataset.id,name:r.querySelector('.bag-name').value,kind:r.querySelector('.bag-kind').value,carry:Number(r.querySelector('.bag-carry').value)}));
 const wire=r=>{
  const kind=r.querySelector('.bag-kind'),name=r.querySelector('.bag-name'),carry=r.querySelector('.bag-carry');
  let was=kind.value;
  // A club still wearing its kind's name and distance follows a change of kind;
  // one the player has named or measured keeps what they typed.
  kind.onchange=()=>{const from=CLUB_KINDS[was],to=CLUB_KINDS[kind.value];
   if(name.value.trim()===from.label)name.value=to.label;
   if(Number(carry.value)===from.carry)carry.value=to.carry;was=kind.value;};
  r.querySelector('.bag-remove').onclick=()=>{r.remove();count();};
 };
 const count=()=>{$('bagAdd').disabled=rows().length>=MAX_BAG;};
 rows().forEach(wire);count();
 $('bagAdd').onclick=()=>{
  const have=new Set(read().map(c=>c.kind)),names=new Set(read().map(c=>c.name.trim().toLowerCase()));
  const kind=Object.keys(CLUB_KINDS).find(k=>k!=='putter'&&!have.has(k))??'iron7';
  let name=CLUB_KINDS[kind].label,n=2;while(names.has(name.toLowerCase()))name=`${CLUB_KINDS[kind].label} ${n++}`;
  const holder=document.createElement('div');holder.innerHTML=row({id:'',name,kind,carry:CLUB_KINDS[kind].carry});
  const r=holder.firstElementChild,putter=rows().find(x=>x.dataset.id==='putter');
  list.insertBefore(r,putter??null);icon();wire(r);count();r.querySelector('.bag-name').focus();r.querySelector('.bag-name').select();
 };
 if($('bagOwner'))$('bagOwner').onchange=()=>{bagOwner=$('bagOwner').value;renderBag(content);};
 $('saveBag').onclick=()=>{try{
  setProfileBag(profiles,owner.id,read());syncClubs();updateHUD();updateAim();sendPlayer();
  toast(`${owner.name}'s bag is saved.`);
  if(bagReturn==='profile'){bagReturn=null;viewingProfile=owner.id;openPanel('profile');}else renderBag(content);
 }catch(e){$('playError').textContent=e.message;}};
 $('resetBag').onclick=()=>{list.innerHTML=stockBag().map(row).join('');icon();rows().forEach(wire);count();};
}
function openPlaySettings(name,content){
 if(name==='shotdata'){
  // WHAT THE SHOT PANEL SHOWS, AND HOW MANY ACROSS. The list is built from the
  // field registry rather than typed out here, so a field added in shot-data.js
  // appears in this panel without anyone remembering to add it twice.
  //
  // THREE SETS: playing by hand, playing off an armed monitor, and a phone are
  // chosen separately (shot-data.js). The panel opens on the set in force and
  // can be switched to edit another; saving another set leaves the screen alone.
  const mode=shotDataEditing??tileSet(),most=maxFields(mode);
  const prefs=mode===tileSet()?shotPrefs:loadShotData(mode);
  const chosen=new Set(prefs.fields);
  const group=g=>{
   const fields=SHOT_FIELDS.filter(f=>f.group===g.id);
   return `<div class="control-card"><h4 class="shot-field-group">${escape(g.label)}</h4>`
    +fields.map(f=>`<label class="check"><input type="checkbox" data-field="${f.id}"${chosen.has(f.id)?' checked':''}> ${escape(f.label)}${f.unit?` <small>${escape(f.unit)}</small>`:''}</label>`).join('')
    +`</div>`;
  };
  content.innerHTML=`<p>Pick the numbers the shot panel shows: live while the ball flies, and kept until the next shot. Each number is a tile of its own: drag it anywhere on the course and it stays there. The five the game actually plays from are ball speed, launch angle, launch direction, spin and spin axis; everything else is extra your launch monitor may send, or what our flight model made of the shot.</p>
  <label class="field">Numbers for<select id="shotMode"><option value="hand"${mode==='hand'?' selected':''}>Playing by hand</option><option value="monitor"${mode==='monitor'?' selected':''}>Launch monitor (armed)</option><option value="phone"${mode==='phone'?' selected':''}>On a phone (three at most)</option></select></label>
  <p class="note">Each keeps its own tiles, and the tiles keep their own places for each. A phone shows three across the top of the screen, whichever way you play.${mode===tileSet()?'':' You are editing a set that is not on screen right now.'}</p>
  <p class="note" id="shotFieldCount"></p>
  ${FIELD_GROUPS.map(group).join('')}
  <p class="research-label">Club numbers need a monitor that sends them; a keyboard shot leaves those tiles blank rather than filling them with zeros. Face to path is worked out from face and path, because no monitor sends it.</p>
  <button class="secondary" id="shotFieldsReset">Back to the standard set</button>`;
  const count=()=>{
   const n=content.querySelectorAll('input[data-field]:checked').length;
   $('shotFieldCount').textContent=`${n} of ${most} tiles used.`+(n>=most?` That is the most ${mode==='phone'?'a phone':'the screen'} holds.`:'');
   // Ticking one past the limit would silently drop one on save, which reads as
   // the checkbox not working. Refused at the tick instead.
   for(const el of content.querySelectorAll('input[data-field]'))el.disabled=n>=most&&!el.checked;
  };
  // Saves the set being edited; only the set in force reaches the screen.
  const keep=next=>{const saved=saveShotData(next,mode);if(mode===tileSet()){shotPrefs=saved;refreshShotGrid();}return saved;};
  let current=prefs;
  const apply=()=>{
   // THE ORDER IS THE PLAYER'S: the tiles they already had keep the order they
   // dragged them into, and a newly ticked one joins the end. Ticking used to
   // put everything back in the registry's order, which once tiles could be
   // dragged would have undone the arrangement every time a box was ticked.
   const on=id=>content.querySelector(`input[data-field="${id}"]`)?.checked;
   const fields=[...current.fields.filter(on),...SHOT_FIELDS.map(f=>f.id).filter(id=>on(id)&&!current.fields.includes(id))];
   current=keep({fields,columns:current.columns});
   count();
  };
  for(const el of content.querySelectorAll('input[data-field]'))el.onchange=apply;
  $('shotMode').onchange=()=>{shotDataEditing=$('shotMode').value;renderPanel(name,content);};
  $('shotFieldsReset').onclick=()=>{
   keep({fields:standardFields(mode),columns:DEFAULT_COLUMNS});
   renderPanel(name,content);
  };
  count();
 }else if(name==='bag'){
  renderBag(content);
 }else if(name==='flight'){
  // Turf only. The ball-flight half of this panel moved to Shot shape, where the
  // per-shot shape controls already lived -- how the ball leaves the club and how
  // far it then runs are two different subjects, and they were sharing one form
  // and one save button.
  content.innerHTML=`<p>The ground everything lands on. These apply immediately to every shot source.</p><h3>Turf & roll</h3>${slider('greenStimp','Green speed · Stimp',settings.turf.stimp,6,15,' ft',.5)}${slider('fairwayRoll','Fairway roll',settings.turf.fairway,30,180,'%')}${slider('semiRoll','Semi-rough roll',settings.turf.semi,30,180,'%')}${slider('roughRoll','Rough roll',settings.turf.rough,30,180,'%')}<label class="field">Green firmness<select id="turfFirmness">${FIRMNESS_NAMES.map(n=>`<option value="${n}"${firmnessName(settings.turf.firmness)===n?' selected':''}>${n}</option>`).join('')}</select></label><p class="note">Green firmness is not green speed. It decides what a ball does the moment it lands — how high it bounces and whether it holds — while the roll settings decide what it does once it is already rolling. A green can be quick and soft, or slow and baked hard.</p><p class="note"><strong>It is named for what it touches.</strong> Green firmness is measured in inches of penetration by a greens instrument, so it moves greens and their collars and nothing else — a fairway or rough keeps one landing behaviour and is set to run with the roll sliders above.</p><p class="note">100% is standard turf. Higher roll values mean less resistance. Stimp is the distance, in feet, a standard release rolls on a level green.</p><button class="primary" id="saveFlight">Save turf settings</button>`;
  $('saveFlight').onclick=()=>{settings.turf=turfConfig({stimp:Number($('greenStimp').value),fairway:Number($('fairwayRoll').value),semi:Number($('semiRoll').value),rough:Number($('roughRoll').value),firmness:$('turfFirmness')?.value});save();updateAim();closePanel();toast('Turf conditions saved.');};
 }else{
  const p=playerPutting();content.innerHTML=`<p>Choose how to finish the hole. Automatic putting applies only to a ball resting on this hole’s green.</p><label class="field">Putting mode<select id="puttingMode">${PUTTING_MODES}</select></label><div id="putting-distances">${puttingFields('putting',p)}</div><div class="note" id="puttingExplanation"></div><p class="field-error" id="playError"></p><button class="primary" id="savePutting">Apply putting mode</button>`;$('puttingMode').value=p.mode;
  const explain=()=>{const m=$('puttingMode').value;$('putting-distances').hidden=m==='holeout';$('puttingExplanation').textContent=PUTTING_NOTES[m];};$('puttingMode').onchange=explain;explain();
  $('savePutting').onclick=()=>{try{puttingGuard();applyPutting(readPutting('putting'));save();updateHUD();closePanel();toast('Putting mode saved. Existing scores stay as recorded.');}catch(e){$('playError').textContent=e.message;}};
 }
}
function beginDrop(){
 // A ball waiting for penalty relief is the golfer's choice to make, not one a
 // free drop should make for them.
 if(round.relief){toast('Choose where to take relief first.');return;}
 if(flight||round.holeComplete||round.scrambleSelection||round.candidates.length){toast('Finish this shot or choose the team lie first.');return;}
 // A DROP PUTS THE TOOLS WINDOW AWAY, the way it already hides the camera bar
 // (`.dropping .view-tools`). The drop is where Sim drop is pressed, so the
 // Tools window was always open at this moment -- and on a phone held sideways
 // it sat squarely on the drop bar, over "Place ball", the one button needed
 // next. Found by the smoke test's phone journey, which could not reach it.
 if(popups?.isOpen('tools'))popups.close('tools');
 closePanel();dropState={origin:{...round.position},candidate:{...round.position},mode:view.config.mode};$('dropBar').hidden=false;keys.clear();
 view.config.mode='free';view.wasFree=true;const p=course.toWorld(round.position);view.targetPos.set(p.x,world.height(p.x,p.z)+50,p.z-30);view.freeYaw=0;view.freePitch=-1.03;view.updateFreeLook();updateExplorer();$('world').classList.add('dropping');previewDrop(round.position);updateHUD();
}
function previewDrop(p,fields=true){if(!dropState)return;dropState.candidate={x:p.x,z:p.z};view.setBall(p);if(fields){$('dropX').value=((p.x-dropState.origin.x)/YARD).toFixed(2);$('dropZ').value=((p.z-dropState.origin.z)/YARD).toFixed(2);}const w=course.toWorld(p),valid=Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(w.x)<=world.halfX&&Math.abs(w.z)<=world.halfZ;$('confirmDrop').disabled=!valid;$('dropSummary').textContent=valid?`${course.surface(p.x,p.z)} · ${(Math.hypot(p.x-course.pin.x,p.z-course.pin.z)/YARD).toFixed(1)} yd to hole · no penalty`:'Choose a point within the generated course.';drawMap($('map'),course,p,[],true,view.camera.position,flight||dropState?null:aimPoint,view.elapsed);}
function endDrop(){const mode=dropState.mode;dropState=null;$('dropBar').hidden=true;$('world').classList.remove('dropping');view.config.mode=mode;setUpTurn();updateExplorer();save();}
function cancelDrop(){if(!dropState)return;endDrop();toast('Drop cancelled. Your original lie is unchanged.');}
// PENALTY RELIEF, CHOSEN ON THE COURSE. A ball in water or out of bounds waits
// in the round (`round.relief`) for the golfer's choice; relief.js says what the
// Rules allow and where, and this bar shows each option where it would put the
// ball. The rules live in relief.js, the strokes in game.js: nothing here
// decides either.
let reliefChoice=0,reliefBack=0,reliefList=[];
// The course as relief.js needs it: what surface a spot is, whether it is out
// of bounds, and whether a trunk or a house stands on it. Trunks and houses are
// indexed in ten-metre cells, built once per hole.
let reliefSolids=null;
function reliefGround(){
 if(reliefSolids?.course!==course){
  const cells=new Map(),add=(x,z,r)=>{const k=Math.floor(x/10)+','+Math.floor(z/10);if(!cells.has(k))cells.set(k,[]);cells.get(k).push({x,z,r});};
  const local=s=>course.world?course.toLocal(s):s;
  for(const t of course.world?.trees||course.trees||[]){const r=trunkRadius(t);if(r>0){const p=local(t);add(p.x,p.z,r+BALL_R+.2);}}
  for(const h of course.world?.homes||course.homes||[]){const p=local(h);add(p.x,p.z,Math.max(h.width,h.depth)/2+1);}
  // The hole's own ground, for Local Rule E-5's "fairway of the hole being
  // played": its corridor runs up the z axis from the tee to beyond the green.
  const len=course.length||Math.hypot(course.pin.x,course.pin.z)+60;
  reliefSolids={course,cells,area:{minX:-180,maxX:180,minZ:-40,maxZ:len+40}};
 }
 const {cells,area}=reliefSolids;
 return {
  area,
  surface:(x,z)=>course.surface(x,z),
  // What the hole itself calls fairway or fringe, before the landscape is
  // composed: Local Rule E-5 only counts the fairway of the hole being played.
  ownFairway:(x,z)=>['fairway','fringe'].includes(localSurface(course,x,z)),
  out:(x,z)=>outOfBounds(course,x,z),
  blocked:(x,z)=>{const cx=Math.floor(x/10),cz=Math.floor(z/10);for(let i=cx-2;i<=cx+2;i++)for(let j=cz-2;j<=cz+2;j++)for(const s of cells.get(i+','+j)||[])if(Math.hypot(x-s.x,z-s.z)<s.r)return true;return false;},
 };
}
const reliefWhere=p=>{const s=course.surface(p.x,p.z),yd=Math.round(Math.hypot(course.pin.x-p.x,course.pin.z-p.z)/YARD);return `${yd} yd to the hole · ${({semi:'semi-rough',fringe:'fringe',tee:'tee',sand:'bunker'})[s]||s}`;};
function beginRelief(){
 if(!round.relief)return;
 endPick();reliefBack=0;
 reliefList=reliefOptions(reliefGround(),round.relief,course.pin,{outRule:round.outOfBounds,back:reliefBack});
 // ONE OPTION IS NOT A CHOICE. Out of bounds under the Rules of Golf is stroke
 // and distance and nothing else, and water with no dry ground in reach leaves
 // only that too: it is applied, and said, rather than offered as a menu of one.
 if(reliefList.length===1){
  const r=round.relief;
  takeReliefOption(reliefList[0],r.hazard==='Water'?'No dry ground within the rules, so stroke and distance: one penalty stroke, from where you hit.':'Out of bounds: one penalty stroke, and play again from where you hit.');
  return;
 }
 reliefChoice=0;
 // The lateral drop first when there is one: it is the option most golfers take
 // and usually the best ball. Stroke and distance is always last in reach.
 const side=reliefList.findIndex(o=>o.id==='lateral'||o.id==='e5');
 if(side>=0)reliefChoice=side;
 showRelief();
}
function showRelief(){
 const r=round.relief;if(!r||!reliefList.length)return endRelief();
 const o=reliefList[reliefChoice],who=round.players[r.player]?.name||'Player';
 $('reliefBar').hidden=false;
 $('reliefTitle').textContent=r.hazard==='Water'?`${who}'s ball is in the water`:`${who}'s ball is out of bounds`;
 $('reliefNote').textContent=r.hazard==='Water'
  ?'A penalty area: choose your relief. Every option is one penalty stroke.'
  :'Out of bounds: play again for one penalty stroke, or drop near where it went out for two (Local Rule E-5).';
 $('reliefOptions').innerHTML=reliefList.map((x,i)=>`<button class="relief-option${i===reliefChoice?' active':''}" data-relief="${i}" aria-pressed="${i===reliefChoice}">`
  +`<strong>${escape(x.label)} <em>+${x.penalty}</em></strong><small>${escape(x.detail)}</small><span>${escape(reliefWhere(x.spot))}</span></button>`).join('');
 $('reliefOptions').querySelectorAll('[data-relief]').forEach(b=>b.onclick=()=>{reliefChoice=Number(b.dataset.relief);showRelief();});
 // Back on the line has no limit on how far back, so the golfer can walk it
 // back to a yardage they like; the other options are a single best spot.
 $('reliefBackRow').hidden=o.id!=='line';
 $('reliefBackText').textContent=reliefBack?`${Math.round(reliefBack/YARD)} yd further back`:'Nearest dry ground';
 $('reliefCloser').disabled=reliefBack<=0;
 // The ball where it would be dropped, and the camera behind it looking at the
 // hole -- the view the next shot is played from.
 view.setBall(o.spot);view.aimLine.visible=false;view.aimRing.visible=false;
 view.setCamera(o.spot,Math.atan2(course.pin.x-o.spot.x,course.pin.z-o.spot.z)*180/Math.PI,false);
 redrawMap();updateHUD();
}
function moveReliefBack(by){
 const next=Math.max(0,reliefBack+by),opts=reliefOptions(reliefGround(),round.relief,course.pin,{outRule:round.outOfBounds,back:next});
 const line=opts.find(o=>o.id==='line');
 if(!line){toast('There is no playable ground further back on that line.');return;}
 reliefBack=next;reliefList=reliefList.map(o=>o.id==='line'?line:o);showRelief();
}
function endRelief(){$('reliefBar').hidden=true;reliefList=[];}
function takeReliefOption(o,message){
 try{round.takeRelief(o,course.pin);}catch(e){toast(e.message);return;}
 endRelief();save();
 toast(message||`${o.label}: ${o.penalty} penalty stroke${o.penalty===1?'':'s'}.`);
 if(round.scrambleSelection){beginPick();updateHUD();}else setUpTurn();
}
function confirmDrop(){if(!dropState||$('confirmDrop').disabled)return;try{round.simDrop(dropState.candidate);endDrop();toast('Sim drop placed. No penalty added.');}catch(e){toast(e.message);}}

// The group as the round panel currently describes it. Hole count is not here:
// a course owns that, so the two can never disagree.
function readGroup(){return {players:readDraft(),mode:$('roundMode').value,tee:$('roundTee').value,outOfBounds:$('roundOB')?.value||Round.defaultOutOfBounds,monitorLie:$('roundMonLie')?$('roundMonLie').value!=='off':Round.defaultMonitorLie};}
// Guarded at the entrance rather than at each call site: this is reachable from
// the library panel, which opens in the studio too, and it used to walk straight
// out of an unsaved landscape without a word.
// `name` is what the course is CALLED, and it rides beside the settings all the
// way in. A course out of the library brings its own; anything generated on the
// spot is named by the suggestion for its seed, so there is no such thing as an
// unnamed course in play any more -- the card, the save button and the course
// code all had to invent something when there was.
// `quiet`: a practice challenge's course -- nothing is saved while it grows,
// set only once the build really starts (a guard answered "Stay" never starts it).
function startRoundOn(courseSettings,group,name,{quiet=false}={}){
 return new Promise(resolve=>{
  const go=()=>{challengeStarting=quiet;return buildRoundOn(courseSettings,group,name).finally(()=>{challengeStarting=false;}).then(resolve);};
  if(appMode==='studio')return guardStudio(go);
  if(appMode==='play')return guardRound(go);
  go();
 });
}
// The driving range. One flat rectangle, no round, no score -- you stand on a mat
// and hit, and the only thing that comes back is what the ball did.
async function enterRange(options={}){
 rememberPutting();
 const fresh=new Round({players:options.players||round.players,mode:'stroke',putting:{mode:'holeout'}});
 await whileGenerating('Opening the range…',async report=>{
  leaveBackdrop();pendingRound=null;staleGenerator=false;rangeMode=true;
  // The centre mat. placeTee honours round.tee and the default is blue, which
  // here is the left-hand station -- the ball would set up off the middle of a
  // field whose whole point is that it is symmetrical about the centre line.
  fresh.tee='white';
  rangeShots=[];resetTrails();dispersion=[];
  challenge=null;round=fresh;
  rememberCourse();
  settings={...RANGE_SETTINGS,
   // The bench is built to order: `difficulty` above 0 gives a green with a
   // smooth tilt, which is how break is tested, and `seed` pins the shape so a
   // measurement can be repeated. Both are generation keys, so `loadCourse`
   // regrows rather than reusing the cached flat field.
   ...(options.difficulty!==undefined?{greenDifficulty:options.difficulty}:{}),
   ...(options.seed?{seed:options.seed}:{}),
   turf:turfConfig({...(RANGE_SETTINGS.turf||{}),
    ...(options.firmness?{firmness:options.firmness}:{}),
    ...(options.stimp?{stimp:options.stimp}:{})}),
   rangeGreen:options.green??rangeGreenPref};
  closePanel();loadCourse();
  // The green-reading tools OFF, whatever the player last left them on.
  // They are a putting aid and the range green is dead flat, so the slope grid
  // paints the whole surface "under 1%" and the heat map paints it all "lower
  // ground" -- both of which are a featureless blue disc that reads as a bug
  // rather than as a target. The lab wants them on; the range never does.
  Object.assign(view.config,{greenGrid:false,greenFlow:false,greenHeat:false});
  view.setGreenReading();
  await prepareWorld(report);
  setMode('play');
 });
 // The cached world keeps whatever green position it was left with, so the
 // slider is re-pointed at the hole rather than the other way round.
 showRangeResult();
 // The cached world keeps whatever green position it was left with, so the box
 // is pointed at the hole rather than the other way round.
 rangeGreenPref=rangeGreenYards(course.settings);
 // A range challenge (challenges.js) opens no range tools: it says what to do itself.
 if(options.challenge)return;
 openRangeBox();
 toast(`Range open · green at ${Math.round(rangeGreenPref)} yd`);
}
let rangeMode=false;
// THE CHALLENGE IN PLAY (Phase 7; challenges.js): closest to the pin, long
// drive or up and down -- a practice game on a real hole, null otherwise. Like
// the range it keeps no card, no history and no round XP: `save`,
// `syncProfile` and `recordProfileShot` all stand aside, and `finishShot`
// hands every ball to `challengeShot`. Skins, once a challenge, is a round
// format (`round.mode`) and never sets this.
let challenge=null,challengeStarting=false;
// Remembered for the next visit within this session. The world cache key leaves
// `rangeGreen` out on purpose -- moving the green must not throw the landscape
// away -- so a re-entry reuses the cached world and finds the green wherever it
// was left; this keeps a REBUILT world agreeing with that.
let rangeGreenPref=DEFAULT_GREEN_YARDS;
// Move the green and carry everything that reads it along: the painted surface
// through the cup atlas, the flag and cup meshes, the aim line and the HUD.
function setRangeGreen(yards){
 if(!rangeMode||!course?.range)return;
 const y=Math.min(GREEN_RANGE[1],Math.max(GREEN_RANGE[0],yards));
 // TWO PATHS, and the difference is not cosmetic. A flat green is four floats in
 // the cup atlas and slides in place. A CONTOURED one cannot be slid at all --
 // its shape is baked into the world's height field, so sliding it would paint
 // the green in a new place on top of the old green's contours, and the ball
 // would break to a slope that is no longer under it. That one rebuilds.
 //
 // `greenDifficulty` is a generation key, so clearing `worldKey` is what makes
 // `loadCourse` actually regrow rather than reuse the cached world.
 if((settings.greenDifficulty??0)>0){rangeGreenPref=settings.rangeGreen=y;worldKey='';loadCourse();}
 else{rangeGreenPref=settings.rangeGreen=moveRangeGreen(course,y);view.setRangeGreen();}
 updateAim();updateHUD();
 // `slider()` names its readout <id>Value, and the window may be closed.
 const out=$('rangeGreenValue');if(out)out.textContent=`${Math.round(rangeGreenPref)} yd`;
 save();
}
// The range box stands open for as long as the range does. It is a tool window
// like any other -- draggable, and it remembers where it was put -- but it is
// opened for the player rather than waiting to be found, because a practice
// ground with one control should not hide it behind a menu.
function openRangeBox(){if(popups&&!popups.isOpen('range'))openPanel('range');}
function closeRangeBox(){popups?.close('range');}
let labState=null;
// Fire the five launch-monitor numbers exactly as shown, and nothing else.
//
// `takeShot` refuses a manual swing while the lab is open, because club, aim and
// power decide nothing here. It does NOT refuse a shot carrying data -- that is
// a real ball described by real numbers, and watching those is what the bench is
// for. This is the same door the launch monitor will come through.
// Accepts what the launch monitor actually sends, or five bare numbers.
//
// The monitor speaks GSPro Open Connect v1 -- a JSON object with a `BallData`
// block -- and `parseLaunchMessage` has understood that all along; this just
// gives it a door in the lab. The five-number shorthand is for typing a test
// case by hand, in the order the panel lists them.
function labParse(text){
 const raw=String(text??'').trim();
 if(!raw)throw Error('Paste a shot, or type: ball speed, launch, direction, spin, axis');
 if(raw.startsWith('{')){
  let shot;
  try{shot=parseLaunchMessage(raw);}catch(e){throw Error('Open Connect: '+e.message);}
  if(!shot)throw Error('That message carries no ball data (heartbeat or empty shot).');
  return {speed:+(shot.speed/MPH).toFixed(2),vla:shot.vla,hla:shot.hla,
   spin:shot.spin,axis:shot.spinAxis};
 }
 const n=raw.split(/[\s,;]+/).filter(Boolean).map(Number);
 if(n.length!==5||n.some(v=>!Number.isFinite(v)))
  throw Error('Give five numbers — ball speed, launch, direction, spin, axis — or paste Open Connect JSON.');
 return {speed:n[0],vla:n[1],hla:n[2],spin:n[3],axis:n[4]};
}
function labStrike(over={}){
 if(!rangeMode)throw Error('Open the driving range first.');
 const typed=typeof over==='string'?labParse(over)
  :(Object.keys(over).length?over:labParse(labShotText));
 // The club numbers ride along beside the five, unvalidated and per-strike.
 // They are exactly that on a real shot -- a readout and nothing else -- and the
 // lab is how they get tested without a device on the mat. Kept OUT of `five`,
 // which is the remembered launch: a club speed typed once should not silently
 // attach itself to every later shot, and it has no place in the shot line.
 const extra=typed&&typeof typed.extra==='object'&&typed.extra?typed.extra:null;
 const five={...labLaunch,...typed};delete five.extra;
 for(const [k,lo,hi,unit] of [['speed',10,220,'mph'],['vla',0,60,'°'],['hla',-20,20,'°'],
  ['spin',0,15000,'rpm'],['axis',-45,45,'°']])
  if(!Number.isFinite(five[k])||five[k]<lo||five[k]>hi)
   throw Error(`${k} must be between ${lo} and ${hi} ${unit}.`);
 labLaunch=five;
 labShotText=labShotLine(five);
 labState={label:`manual · ${five.speed} mph, ${five.vla}° launch, ${five.hla}° direction, `
  +`${five.spin} rpm, axis ${five.axis}° · ${firmnessName(settings.turf.firmness)} `
  +`(${settings.turf.firmness.toFixed(2)} in)`,
  approach:null,manual:true,speed:five.speed*MPH,result:null};
 syncLabTool();
 if(!takeShot({speed:five.speed*MPH,vla:five.vla,hla:five.hla,spin:five.spin,spinAxis:five.axis,...(extra?{extra}:{})}))
  throw Error('The shot was refused; a ball may still be in the air.');
 return {...five};
}
// Firmness is a lab control, not a course one: the four named settings are what
// a player picks, and this is the ground between them.
function labFirmness(value){
 settings.turf=turfConfig({...settings.turf,firmness:value});
 syncLabTool();updateAim();
 return {firmness:settings.turf.firmness,reads:firmnessName(settings.turf.firmness)};
}
// Green speed belongs in the lab, and until now it was only reachable by
// closing the lab and opening the turf panel. It is the single biggest thing
// acting on a putt -- firmness decides what a ball does when it lands, Stimp
// decides what it does once it is rolling, and the lab wants both to hand.
function labStimp(value){
 settings.turf=turfConfig({...settings.turf,stimp:value});
 syncLabTool();updateAim();
 return {stimp:settings.turf.stimp};
}
// The named speeds a green is actually described by. The Stimpmeter reads in
// feet and those numbers mean little on their own; 13 is a major championship
// Sunday and 8 is a municipal course in summer.
const STIMP_PRESETS=[['Slow',8],['Medium',10],['Quick',12],['Tournament',13.5]];
// Lab tools is redrawn IN PLACE rather than re-rendered. A re-render would
// replace the shot-data textarea mid-keystroke and drop the caret -- the same
// trap the old floating lab bar had -- and the panel may simply not be open.
function syncLabTool(){
 if(!$('labFirmness'))return;
 const firm=firmnessValue(settings.turf?.firmness),stimp=settings.turf?.stimp??10;
 $('labFirmness').value=firm;$('labFirmnessRead').textContent=`${firmnessName(firm)} · ${firm.toFixed(2)} in`;
 $('labStimp').value=stimp;$('labStimpRead').textContent=`Stimp ${stimp.toFixed(1)}`;
 for(const b of document.querySelectorAll('[data-firm]'))b.classList.toggle('on',Math.abs(FIRMNESS_PRESETS[b.dataset.firm]-firm)<1e-9);
 for(const b of document.querySelectorAll('[data-stimp]'))b.classList.toggle('on',Math.abs(Number(b.dataset.stimp)-stimp)<1e-9);
}
function startEndless(group,replaySeed){
 return new Promise(resolve=>{
  const go=()=>buildEndless(group,replaySeed).then(resolve);
  if(appMode==='studio')return guardStudio(go);
  if(appMode==='play')return guardRound(go);
  go();
 });
}
// `replaySeed` starts a run that has been played before -- the profile's
// "Replay this course" -- since an endless run's holes all grow from its seed.
async function buildEndless(group,replaySeed){
 // Straight off the main menu there is nothing to grow: the hole on screen is
 // already hole one, so the run adopts its seed and its world and starts. No
 // overlay either, because an overlay over work that is not happening is a lie.
 const adopt=menuBackdrop&&backdropRun&&(!replaySeed||replaySeed===backdropRun.seed);
 const seed=replaySeed||(adopt?backdropRun.seed:newRunSeed());
 const fresh=new Round({players:round.players,mode:'stroke',tee:round.tee,...group,putting:restorePutting(),endless:true,seed});
 const begin=()=>{
  // Not leaveBackdrop(): that clears the world key to force a rebuild, which is
  // exactly what we are here to avoid. Nor restoreClock(): the player's clock is
  // the one the menu put aside, and on a device that never set one its hour is
  // null -- which, with no rebuild to replace it, played the round at midnight.
  // The adopted hole keeps the hour it was shown at instead (roundHour).
  if(adopt){const shown=view.daylight.hour;menuBackdrop=false;claimClock();lightsOffForRound();clockForRound(shown);}
  else{leaveBackdrop();lightsOffForRound();clockForRound();}
  pendingRound=null;staleGenerator=false;
  challenge=null;round=fresh;settings=adopt?{...backdropRun.settings,...playScope(settings)}:endlessFor(seed,0,settings);
  closePanel();
 };
 // Adopting the showcase hole there is nothing to grow, so it stays synchronous
 // and enters play immediately -- an overlay over work that is not happening is
 // a lie, and a progress bar over it would be a more elaborate one.
 if(adopt){begin();loadCourse();setMode('play');}
 else await whileGenerating('Growing your first hole…',async report=>{
  begin();await prepareWorld(report);loadCourse();setMode('play');
 });
}
async function buildRoundOn(courseSettings,group,name){
 const next={...settings,...courseSettings};
 // Not a generation setting: it is filtered out by `courseSettings()` before
 // anything is saved, and it is not in the world key, so naming a course can
 // never move a metre of its ground.
 next.courseName=String(name||'').trim()||suggestCourseName(next);
 // Build the Round first: an invalid group must fail before the overlay appears.
 const fresh=new Round({...group,holes:next.holes,putting:restorePutting()});
 await whileGenerating('Building your course…',async report=>{
  leaveBackdrop();pendingRound=null;staleGenerator=false;
  lightsOffForRound();clockForRound();
  challenge=null;round=fresh;settings=next;closePanel();
  await prepareWorld(report);
  loadCourse();setMode('play');
 });
}
// A single showcase hole, grown fresh each time the menu opens. It is never the
// player's course: generation settings, the saved round and the library are all
// untouched by it.
// The player's clock, kept aside while the menu shows its own, and put back the
// moment the menu is left for anything that rebuilds the world. The backdrop is a
// picture; it must not quietly rewrite a setting the player chose. ONLY BEFORE A
// REBUILD: the hour put back can be null (a device that never set the clock), and
// only building a world swaps that for the biome's default -- anywhere else it
// reads as midnight. Endless adopting the menu's hole claims the clock instead.
function restoreClock(){
 view.borrowedClock=false;
 if(playerClock){Object.assign(view.daylight,playerClock);playerClock=null;}
 lightsOffForRound();
}
// EVERY ROUND STARTS WITH THE FLOODLIGHTS OFF (the owner, 30 September). They
// are a thing to switch on when it gets dark, not a setting a course inherits;
// and since the loading screen builds everything they need (GolfView.ready),
// switching them on mid-round costs nothing. The menu's showcase hole is not a
// round and lights itself by the hour it picks -- which is always daylight now
// (MENU_HOURS), so in practice never.
function lightsOffForRound(){
 view.daylight.floodlights=false;saveDaylight(view.daylight);view.setFloodlights(false);
 const box=$('timeFloods');if(box)box.checked=false;
}
// A COURSE BUILT TO PLAY STARTS AT MIDDAY (the owner, 30 September): what was
// just shaped or chosen is seen first in clear light, not in whatever dark the
// clock happens to be in. "Start at my local time" still wins -- it is a choice
// the player made explicitly. Endless adopting the menu's hole keeps the hour
// that hole was shown at (`shown`). The rule is `roundHour` in daylight.js.
function clockForRound(shown){
 const d=view.daylight;d.hour=roundHour(d.syncToLocal,localHour(),shown);saveDaylight(d);
}
// Touch the clock and you own it. The backdrop borrows the hour for its picture,
// but the moment the player sets one themselves the loan is off -- otherwise
// leaving the menu would silently undo the time they just chose.
function claimClock(){playerClock=null;view.borrowedClock=false;}
async function loadMenuBackdrop(report){
 stopTour();cancelAdvance();
 // The hole on the menu is hole one of a real endless run rather than a private
 // showpiece, so choosing Endless can play the hole you are already looking at
 // instead of discarding it and growing another. It is built under the key
 // loadCourse will ask for, which is what lets the world survive the handover.
 const seed=newRunSeed();
 const backdrop=endlessSettings(endlessHole(seed,0));
 backdropRun={seed,settings:backdrop};
 // Its own hour, drawn from the seed so the hole and the light that falls on it
 // come out of the same shuffle. Always daylight since 30 September (MENU_HOURS).
 // Floodlights would follow the DARKNESS here rather
 // than the player's preference: a lit hole at midnight is one of the looks
 // worth showing, and a bank of poles over a midday fairway is not.
 restoreClock();
 playerClock={hour:view.daylight.hour,floodlights:view.daylight.floodlights};
 const [hour,dark]=showcaseHour(random(seed+':hour')());
 view.daylight.hour=hour;view.daylight.floodlights=dark;view.borrowedClock=true;
 menuBackdrop=true;world=await generateProgressively(backdrop,report);worldKey=worldKeyFor(backdrop);
 challenge=null;round=new Round();course=world.holes[0];round.placeTee(course.tees);
 view.build(world,'cartoon',0);view.setPutting(round.putting);
 view.config.mode='free';view.wasFree=true;
 view.ball.visible=false;view.ballRing.visible=false;view.aimLine.visible=false;view.aimRing.visible=false;
 latest=null;lastShot=null;priorShot=null;
}
function orbitBackdrop(){
 const h=view.course;if(!h)return;
 const mid={x:h.center(h.length*.5),z:h.length*.5},c=h.toWorld(mid),ground=h.height(mid.x,mid.z);
 const angle=view.elapsed*.075,radius=Math.max(150,h.length*.85);
 view.targetPos.set(c.x+Math.sin(angle)*radius,ground+Math.max(55,h.length*.3),c.z+Math.cos(angle)*radius);
 view.targetLook.set(c.x,ground+8,c.z);
 view.camera.position.copy(view.targetPos);view.look.copy(view.targetLook);
}
// Leaving the menu is the moment the real course gets built, so opening Fairway
// never grows a course nobody asked for.
function leaveBackdrop(){if(!menuBackdrop)return;menuBackdrop=false;worldKey='';restoreClock();}
// THE WORDMARK STAYS WHEN A SHEET OPENS OVER THE MENU. Opening Saved courses or
// Play from the main menu hid the menu outright, wordmark included, so a sheet
// floated over a landscape with nothing on screen saying whose app this is --
// and the topbar, which carries the brand everywhere else, is display:none in
// menu mode.
//
// The menu stays and loses only its deck: the tiles are exactly what the sheet
// replaced, so leaving them showing behind it would offer two ways to the same
// places. It has to be LOWERED as well as kept, because `.main-menu` is fixed at
// z-index 80 -- above the drawer's 21 -- and would otherwise cover the panel it
// just opened. Inert and aria-hidden in that state, since the sheet is the
// dialog now and two modals at once is no dialog at all.
const syncMenuOverlay=()=>{
 const menu=$('mainMenu'),inMenu=appMode==='menu',behind=inMenu&&!!panel;
 menu.hidden=!inMenu;
 menu.classList.toggle('menu-behind',behind);
 menu.setAttribute('aria-hidden',String(behind));
 if(behind)menu.removeAttribute('aria-modal');else menu.setAttribute('aria-modal','true');
};
// PACING THE WORK AGAINST THE FRAME CLOCK.
//
// Generation still runs on the main thread -- it hands back closures, so it
// cannot go to a worker -- but it no longer runs in one unbroken block. The
// stepped generator yields by row band; this drains it, and whenever a budget's
// worth of work has gone by it reports progress and waits for a frame. So the
// browser paints, the spinner turns and the bar moves.
//
// BUDGET is how much work runs between frames, and pacing is NOT FREE. Measured
// on an 18-hole feature-heavy course, where the blocking work itself is ~7.0 s
// however it is sliced:
//
//   budget    wall @60Hz    overhead    longest block
//     8 ms      10.83 s       +55%          8 ms
//    12 ms       9.32 s       +33%         12 ms
//    24 ms       8.65 s       +24%         24 ms
//    50 ms       8.63 s       +24%         50 ms
//
// Each pause costs most of a frame whatever it cost to earn, so halving the
// budget nearly doubles the overhead. 24 ms is the knee: past it the total stops
// improving, and below it the price climbs fast.
//
// The usual argument for a small budget is input latency, and it does not apply
// here -- a full-screen overlay is up, so there is nothing behind it to click.
// What the budget actually buys is the animation, and 24 ms still hands back a
// frame about every 33 ms, which is plenty for a spinner and a bar.
const BUDGET=24;
// A frame, or a timeout if frames are not coming: a background tab never fires
// requestAnimationFrame, and waiting on one alone leaves the app hung on boot.
const nextFrame=()=>new Promise(r=>{let settled=false;const go=()=>{if(!settled){settled=true;r();}};requestAnimationFrame(()=>setTimeout(go,0));setTimeout(go,150);});
// How many workers built the last grid's heights (0: this thread did), how long
// the main thread waited on them per round, and the whole generation, for lab.ground.
let lastGridWorkers=0,lastGridWait=[],lastGenerationMs=0;
async function generateProgressively(next,onProgress){
 // The ground grid's heights on other cores (gen-pool.js). Not for one hole --
 // the range, an endless hole -- where starting the workers costs more than
 // the grid they would share.
 const pool=next.holes>1&&!next.range?makeGridPool(next):null;
 lastGridWorkers=pool?.count??0;lastGridWait=[];const began=performance.now();
 try{
 const it=generateWorldSteps(next,{gridPool:pool});
 let step=it.next(),mark=performance.now();
 while(!step.done){
  // Waiting on the workers: the page stays live while they compute.
  if(step.value?.await){
   onProgress?.(step.value);
   const waited=performance.now();
   const got=await step.value.await.catch(()=>null);
   lastGridWait.push(Math.round(performance.now()-waited));
   if(!got)lastGridWorkers=0;
   mark=performance.now();step=it.next(got);continue;
  }
  // A HIDDEN TAB IS NOT PACED AT ALL, and that is not an optimisation.
  //
  // Pausing exists to let the browser paint and to keep the controls alive.
  // A background tab paints nothing and nobody is touching it, so both reasons
  // are gone -- and the cost of pausing anyway is severe: no frames come, so
  // every pause falls through to its timeout, and a course that takes eight
  // seconds would take minutes. Timers are clamped in background tabs too, so
  // there is no short sleep to fall back on either. Run it straight through and
  // resume pacing if the tab comes back.
  if(!document.hidden&&performance.now()-mark>=BUDGET){
   onProgress?.(step.value);
   await nextFrame();
   mark=performance.now();
  }
  step=it.next();
 }
 // The ownership atlas the workers started when the grid was done; the world
 // carries it to the ground material (ground.js), which fills it itself if not.
 const atlas=await pool?.atlas?.();
 if(atlas&&step.value)step.value.ownerAtlas=atlas;
 return step.value;
 }finally{pool?.dispose();lastGenerationMs=Math.round(performance.now()-began);}
}
// The overlay. `work` may be async and is handed a reporter; whatever it reports
// goes on screen. A caller that does no stepped generation never reports any and
// gets the message on its own, exactly as before.
async function whileGenerating(label,work,quiet=false){
 const box=$('generating');
 if(!quiet){$('generatingLabel').textContent=label;setProgress(null);box.hidden=false;}
 // Whatever is on screen is about to be replaced: it must not spend the wait
 // re-photographing its ponds for a clock that only changed because the round
 // is starting (GolfView.updateDaylight).
 if(view)view.retiring=true;
 // The frame wait still matters even when quiet: it is what lets whatever IS on
 // screen paint before the first block of work.
 await nextFrame();
 try{
  const result=await work(report=>{if(!quiet)setProgress(report&&{...report,done:report.done*GROWING_SHARE});});
  // The graphics card's share of the wait, behind the overlay rather than as a
  // frozen first frame after it (GolfView.ready).
  //
  // IT IS MOST OF THE WAIT, AND IT USED TO SIT STILL. Generation reported its
  // steps and filled the bar; then "Preparing the graphics" showed a FULL bar for
  // the rest -- measured 7 October at 6.8 s of an 11.4 s 18-hole build, compiling
  // shaders, with nothing on screen moving but the spinner. A full bar that does
  // not finish reads as stuck. Generation now fills the first part of the bar
  // and the graphics the rest; shader compilation is one wait with no steps to
  // report, so the bar creeps through its share on a curve that slows as it goes,
  // paced by how long the last compile took, and never reaches the end before
  // the work does. The page really is working throughout: the compile runs off
  // the main thread (compileAsync) and frames keep coming.
  const creep=quiet?null:creepProgress('Preparing the graphics',GROWING_SHARE);
  const g0=performance.now();
  try{await view?.ready?.();}
  finally{creep?.stop();graphicsMs=Math.max(500,performance.now()-g0);}
  if(!quiet)setProgress({label:'Preparing the graphics',done:1});
  // The first frames of what was built, still under the overlay: their one-off
  // costs land behind it rather than on the first thing the player sees (the
  // same reason the splash waits, at startup). A few frames normally; never
  // more than a second.
  if(!quiet)await smoothFrames(1000);
  return result;
 }
 finally{if(view)view.retiring=false;if(!quiet){box.hidden=true;setProgress(null);}}
}
// How much of the bar generation fills; the graphics get the rest. Measured on
// an 18-hole build, generation is about a third of the wait and the graphics
// about two thirds; half and half gives generation's steps room to be seen.
const GROWING_SHARE=.5;
// How long the last graphics stage took, which paces the next one's creep. The
// menu's own quiet build at startup sets it before any bar is shown.
let graphicsMs=5000;
// A bar that keeps moving through a wait that cannot report its own progress:
// from `from` toward 97% of the rest, two thirds of the way there after the last
// graphics stage's duration, and slowing all the time.
function creepProgress(label,from){
 const t0=performance.now(),tau=graphicsMs/1.1;
 const step=()=>setProgress({label,done:from+(.97-from)*(1-Math.exp(-(performance.now()-t0)/tau))});
 step();const id=setInterval(step,120);
 return {stop:()=>clearInterval(id)};
}
// The bar and the phase name. Null puts it back to indeterminate, for the
// stretch before the first step lands and for work that never reports.
function setProgress(report){
 const bar=$('generatingBar');
 if(!bar)return;
 bar.parentElement.hidden=!report;
 $('generatingPhase').textContent=report?report.label:'';
 if(report)bar.style.width=(report.done*100).toFixed(1)+'%';
}
// The splash goes when there is something worth looking at, and it is taken out
// of the DOM afterwards rather than left transparent over the whole app -- an
// invisible full-screen element that still takes clicks is a bug waiting.
// Called from the fatal path too: a black screen hiding the one message that
// explains the black screen is the worst version of this.
// Resolves after three frames in a row under 40 ms, or after `limit` ms.
function smoothFrames(limit=2000){
 return new Promise(done=>{
  const start=performance.now();let last=start,run=0;
  const f=t=>{run=t-last<40?run+1:0;last=t;if(run>=3||t-start>limit)done();else requestAnimationFrame(f);};
  requestAnimationFrame(f);
 });
}
function dismissSplash(){
 const el=$('splash');if(!el||el.classList.contains('ready'))return;
 el.classList.add('ready');
 setTimeout(()=>el.remove(),600);
}
// Counts are upper targets, and steep ground can leave no room at all. Say so
// rather than handing back a course quietly missing what was asked for.
function shortfall(){
 const want=world?.streams?.requested||0,got=world?.streams?.streams.length||0;
 if(got>=want)return '';
 return got?`Landscape rebuilt. Only ${got} of ${want} channels found room on this ground.`:`Landscape rebuilt. This ground was too steep for the channels you asked for.`;
}
function setMode(mode){
 const was=appMode;
 appMode=mode;$('world').dataset.mode=mode;
 // NO AIM LINE IN THE STUDIO. Nobody is about to hit, and a white line running
 // off the first tee read as part of the course being shaped. Building a world
 // makes a fresh, visible line, so the studio hides it every time it enters;
 // a round started from the studio on the same world gets it back here, because
 // nothing else in play turns it on before the first shot.
 if(mode==='studio'&&view){view.aimLine.visible=false;view.aimRing.visible=false;}
 else if(was==='studio'&&mode==='play'&&view){view.aimLine.visible=true;view.aimRing.visible=armed||$('club').value!=='putter';}
 // Stamped on the shell too, so the menu can take the whole screen. Leaving the
 // top bar showing faintly through a lighter scrim put nav items on screen that
 // the menu does not accept clicks for.
 document.getElementById('app').dataset.mode=mode;
 syncMenuOverlay();$('studioBar').hidden=mode!=='studio';
 // The studio leaves the camera flying. setUpTurn only ever swaps player and
 // putt, so without this a round entered from the studio starts in free flight
 // and every shot is refused with no visible reason.
 if(mode==='play'){
  if(view.config.mode==='free')view.config.mode=playCameraMode('player',course,round.position);
  // FLY IN RATHER THAN CUT. Every way into play leaves the camera somewhere
  // else -- orbiting the menu's showcase hole, up in the studio's free flight,
  // out at a finished green -- and all of them used to arrive as a hard cut.
  // One call here covers the lot: endless, a new round, Continue, the range,
  // an imported round and the way back from the studio. A hole nobody has
  // played yet arrives instead -- see freshHole.
  arriveAtHole();
 }
 if(mode!=='play')cancelAdvance();
 syncNav();updateStudioState();updateHUD();updateExplorer();
}
const XP_NEW_TEXT='From now on every round earns XP toward levels, badges and rewards. Your stats and history are kept; levels start at 1 for everyone.';
function openMenu(){
 if(flight||dropState)return;
 stopTour();closePanel();
 // Continue is offered whenever a real course is loaded, or a saved round is
 // still waiting behind the backdrop.
 $('menuContinue').hidden=appMode==='studio'||(menuBackdrop&&!pendingRound);
 updateMenuProfile();
 $('menuNote').textContent=listCourses().length?'':'No saved courses yet. Shape one in Course studio, or let Play surprise you.';
 // XP IS NEW (Phase 4): the main golfer is told once, here; everyone else on
 // their own My profile page.
 {const m=mainProfile(profiles);if(m?.xpNew){delete m.xpNew;storeProfiles(profiles);toast('New: XP and levels. '+XP_NEW_TEXT);}}
 setMode('menu');icon();$('menuContinue').hidden?$('menuPlay').focus():$('menuContinue').focus();
}
async function continueRound(){
 if(menuBackdrop)await whileGenerating('Rebuilding your course…',async report=>{
  leaveBackdrop();
  if(pendingRound){challenge=null;round=pendingRound;pendingRound=null;if(round.endless)settings=endlessFor(round.seed,round.hole,settings);}
  else{challenge=null;round=new Round({players:round.players,mode:round.mode,holes:settings.holes===18?18:9,tee:round.tee,putting:round.putting});}
  await prepareWorld(report);
  loadCourse();
 });
 setMode('play');closePanel();
 if(staleGenerator){staleGenerator=false;showVersionNotice();}
}
function updateStudioState(){
 if(appMode!=='studio')return;
 const el=$('studioState');el.classList.toggle('dirty',studioDirty);
 el.textContent=studioDirty?'Settings changed — regenerate to see them.':panel?'Close the settings panel to fly around with W A S D.':'Fly around with W A S D. Drag to look.';
}
// A studio landscape lives only in memory until it is saved, so anything that
// walks away from it asks first. "Saved" means some course in the library was
// generated from exactly these settings -- that covers a course loaded from the
// library and left alone, not just one saved a moment ago.
function studioSaved(){
 const current=JSON.stringify(courseSettings(settings));
 return listCourses().some(c=>JSON.stringify(courseSettings(c.settings))===current);
}
// WHAT "SAVE THIS COURSE" WOULD ACTUALLY SAVE, or why there is nothing to save.
//
// `settings` is a module-level variable that outlives the thing it described. At
// the main menu it is whatever was last loaded, so the Saved courses panel --
// now a first-class menu section -- offered to save a course nobody was playing:
// on a fresh launch that was `DEFAULT_COURSE` under a biome's name, a course the
// player had never seen, and after an endless run it was a one-hole world that
// `validateSettings` rejects, so the section's primary button failed outright
// with "Holes is not a recognised option." A button has to know whether the
// thing it names exists.
// THE NAME OF THE COURSE BEING PLAYED, answered once so the card, the save
// button and the course code cannot disagree about what this place is called.
//
// A course started from the library brings its own name and it is kept on
// `settings.courseName`; it is not a generation setting, never reaches
// `courseSettings()` and is not in the world key, so it cannot move any ground.
// Anything generated rather than chosen -- a surprise course, a landscape still
// being shaped -- falls back to the SUGGESTION for its seed, which is the same
// name the box would have offered, so a course is called the same thing before
// and after somebody saves it.
//
// An endless run is named from the RUN's seed rather than from the settings,
// because the settings are rebuilt for every hole: named from those, the course
// would rename itself on each tee.
function playingCourseName(){
 if(rangeMode)return 'Driving range';
 if(round.endless)return suggestCourseName({seed:round.seed,biome:settings.biome});
 return settings.courseName||suggestCourseName(settings);
}
// EVERYTHING A BUG REPORT NEEDS AND A PERSON CANNOT BE EXPECTED TO KNOW.
//
// The course code already carries the recipe for the ground -- schema,
// generator, name, and the settings that differ from the defaults -- so this
// adds it rather than repeating it, and adds the things it cannot carry: which
// BUILD is running, what the machine is, which GPU actually got the work, and
// whether anything threw.
//
// Every read is defensive. This is collected at the moment somebody is already
// having a problem, and a diagnostic that throws while being assembled is the
// one thing worse than no diagnostic.
function collectDiagnostic(){
 // The context, not a new one: asking the canvas for a fresh context would
 // return null anyway, since three already holds it.
 let gl=null;
 try{gl=view?.renderer?.getContext?.()??null;}catch{}
 // Only a real course has a code. An endless run is one hole at a time and the
 // range is not a course at all -- savableCourse says so in a sentence, and it
 // is the same refusal the seed button uses.
 let courseCode=null;
 if(appMode==='play'&&!savableCourse().why){
  try{courseCode=exportCourse({name:playingCourseName(),settings,generator:GENERATOR_VERSION});}catch{}
 }
 return diagnosticReport({
  build:{label:buildLabel()},
  app:{
   generator:GENERATOR_VERSION,schema:SCHEMA_VERSION,
   mode:rangeMode?'driving range':round.endless?'endless':appMode,
   course:appMode==='menu'?null:playingCourseName(),
   hole:(appMode==='play'&&!rangeMode)?`${round.hole+1} of ${round.holes}`:null,
   biome:settings.biome,
   tier:graphics.quality,
   frameCap:graphics.frameCap,
   autoResolution:graphics.autoResolution,
   resolution:Math.round((view?.resolutionScale??1)*100),
  },
  device:deviceFacts(),
  webgl:webglFacts(gl),
  frames:diagnosticFrames.read(),
  errors:diagnosticErrors.read(),
  courseCode,
  takenAt:new Date().toISOString(),
 });
}
function savableCourse(){
 if(appMode==='studio')return {label:'Save this landscape'};
 if(appMode!=='play')return {why:'Play a course, or shape one in Course studio, and you can save it from here.'};
 if(rangeMode)return {why:'A practice ground is not a course. Its green moves and it has no holes to keep.'};
 // Endless grows a fresh one-hole world for every hole, so there is no course
 // underneath it to name -- and `holes: 1` is not a value a course can hold.
 if(round.endless)return {why:'An endless run grows a new hole each time, so there is no course to keep. Its holes cannot be saved.'};
 return {label:`Save “${escape(playingCourseName())}”`};
}

// One dialog, driven by whichever guard needs it. Three options as a square
// list: save and go, go anyway, or stay.
function askBeforeLeaving({title,body,nameLabel,defaultName,saveHint,discardHint,onSave,onDiscard,next}){
 const box=$('leaveNotice'),name=$('leaveName'),error=$('leaveError');
 $('leaveNoticeTitle').textContent=title;
 $('leaveNoticeBody').textContent=body;
 $('leaveNameLabel').textContent=nameLabel;
 $('leaveSaveHint').textContent=saveHint;
 $('leaveDiscardHint').textContent=discardHint;
 error.textContent='';name.maxLength=MAX_NAME;name.value=defaultName||'';
 box.hidden=false;icon();
 const close=()=>{box.hidden=true;};
 $('leaveStay').onclick=close;
 $('leaveDiscard').onclick=()=>{close();onDiscard?.();next();};
 $('leaveSave').onclick=()=>{
  try{onSave(name.value);close();next();}
  catch(e){error.textContent=e.message;}
 };
 name.focus();name.select();
}

// A studio landscape lives only in memory until it is saved.
function guardStudio(next){
 if(appMode!=='studio'||studioSaved())return next();
 askBeforeLeaving({
  title:'Leave the studio without saving?',
  body:'This landscape only exists while you are shaping it. Save it to your library to come back to it later, or leave and let it go.',
  nameLabel:'Name this course',defaultName:playingCourseName(),
  saveHint:'Keep this landscape in your course library',
  discardHint:'This landscape is gone for good',
  onSave:value=>{const rec=saveCourse({name:value,settings});toast(`Saved “${rec.name}” to your library.`);},
  next,
 });
}

// A round worth keeping is one that has actually been played: a fresh round
// nobody has hit a shot on is not worth interrupting someone over, and the
// menu backdrop and the studio both keep throwaway rounds that must never
// prompt.
function roundWorthSaving(){
 if(appMode!=='play'||menuBackdrop||!round||round.finished||challenge)return false;
 return round.hole>0
  ||round.strokes?.some(n=>n>0)
  ||round.cards?.some(row=>row.some(Number.isFinite));
}

function guardRound(next){
 if(!roundWorthSaving())return next();
 askBeforeLeaving({
  title:'Leave this round?',
  body:'Your round is only kept while you are playing it. Save it to pick up exactly where you left off — same lie, same scores.',
  nameLabel:'Name this round',
  defaultName:suggestName(round,settings,BIOMES[settings.biome]?.title),
  saveHint:`Keep it in your saved rounds (up to ${MAX_ROUNDS})`,
  discardHint:'This round and its scores are gone',
  onSave:value=>{const rec=saveRound({name:value,...saveRecord()});toast(`Saved “${rec.name}”. Resume it from Saved rounds.`);},
  // Only the ROUND guard clears the slot. Leaving the studio without saving
  // discards a landscape, which has nothing to do with the round waiting behind
  // Continue -- clearing it there would throw away someone else's work.
  onDiscard:clearSave,
  next,
 });
}

// The one way out of play or the studio.
//
// Every mode change goes through the menu, and the menu always grows a fresh
// showcase hole. That is what keeps the two modes from sharing a world: before
// this, leaving the studio for play simply flipped a flag and the landscape you
// were shaping silently became the course you played.
async function returnToMenu(){
 const leave=()=>{
  stopTour();closePanel();cancelAdvance();popups?.closeAll();rangeMode=false;closeRangeBox();restoreCourse();timeScale=1;view.config.freeFloor=1.2;
  
  toggleClockPop(false);closeMenuDrop();endRelief();
  pendingRound=null;
 };
 if(appMode==='studio')return guardStudio(async()=>{leave();await growBackdrop();});
 if(appMode==='play')return guardRound(async()=>{leave();await growBackdrop();});
 leave();openMenu();
}

// Generation blocks the main thread, so it needs the overlay.
// The menu opens inside the wait, so its camera's first frames are drawn under
// the overlay (whileGenerating waits for them to run smoothly) rather than on
// screen.
const growBackdrop=()=>whileGenerating('Growing a hole…',async report=>{leaveBackdrop();await loadMenuBackdrop(report);openMenu();});
function markStudioDirty(){if(appMode==='studio'&&!studioDirty){studioDirty=true;updateStudioState();}}
// Studio keeps a throwaway round alive so the renderer, camera and map keep
// working; the play HUD is simply hidden.
// Opening the studio from the menu asks what to grow before growing anything.
// It used to build from whatever settings happened to be loaded, so the first
// thing most people did was open Settings and regenerate -- one wasted build of
// a course nobody asked for. The menu's showcase hole keeps turning behind the
// panel while you choose.
let studioSetup=false;
// The range gets the same courtesy the other modes get: a chance to set the
// group and the distance BEFORE the world is built, rather than walking in and
// discovering the settings are somewhere else.
let rangeSetup=false;
// Endless gets one too. It has no course to choose -- every hole is grown from
// the run's own seed -- so this panel is the round half only: format, tees,
// putting and who is playing.
let endlessSetup=false,weeklySetup=false,challengeSetup=false,challengePick='closest';
function openStudioSetup(){
 // Leave the range behind BEFORE the panel renders. The studio grows
 // landscapes and a range is not one, and the panel has to show the course's
 // own numbers -- doing this later would either display the range's settings or
 // throw away the choices just made in the panel.
 rangeMode=false;closeRangeBox();restoreCourse();
 settings=courseOnly(settings);
 studioSetup=true;
 openPanel('course');
}
async function enterStudio(){
 stopTour();closePanel();popups?.closeAll();
 // Last resort, and deliberately only a strip: by here the player's studio
 // settings are already in `settings`, so restoring the remembered course would
 // discard them. `openStudioSetup` does the real cleanup before the panel opens.
 rangeMode=false;closeRangeBox();
 settings=courseOnly(settings);
 // ALWAYS grows its own landscape, not only when arriving from the menu's
 // showcase hole. Skipping the rebuild when entering from play meant the studio
 // opened on the exact course you had been playing -- the shared-world problem
 // the mode split exists to remove, just in the other direction.
 await whileGenerating('Growing your landscape…',async report=>{
  // The studio opens at midday too, like a round built in it. Without this a
  // player whose clock had never been set -- anyone opening the studio before
  // their first round, which is most people trying the demo -- landed in it at
  // midnight, because an unset hour reads as 0:00.
  leaveBackdrop();lightsOffForRound();clockForRound();
  challenge=null;round=new Round({holes:settings.holes===18?18:9,tee:round.tee,putting:round.putting});
  await prepareWorld(report);
  loadCourse();
 });
 setMode('studio');studioDirty=false;
 // Land flying, not behind the settings panel. Keys are ignored while a panel
 // is open -- they have to be, the seed field is a text input -- so opening one
 // here meant the studio always started with its camera parked.
 closePanel();
 cameraMode('free');view.flyToHole(round.hole);updateExplorer();
}
async function regenerateStudio(){
 if(!applyStudioSettings())return;
 await whileGenerating('Growing your landscape…',async report=>{
  challenge=null;round=new Round({players:round.players,mode:'stroke',holes:settings.holes,tee:round.tee,putting:round.putting});
  await prepareWorld(report);
  loadCourse();studioDirty=false;setMode('studio');
  cameraMode('free');view.flyToHole(0);updateExplorer();
 });
 toast(shortfall()||'Landscape rebuilt.');
}
// Reads every generation control the studio rendered and validates the result
// as a whole, so a bad combination is refused before a long rebuild starts.
function applyStudioSettings(){
 const error=$('studioError')||$('libraryError');
 try{
  const next={...settings};
  for(const f of SETTINGS)if(f.kind==='range'||f.kind==='int'){const el=$(f.key);if(el)next[f.key]=Number(el.value);}
  if($('courseHoles'))next.holes=Number($('courseHoles').value);
  if($('footprint'))next.footprint=$('footprint').value;
  for(const f of SETTINGS)if(f.kind==='choice'){const el=$(f.key);if(el)next[f.key]=el.value;}
  for(const f of SETTINGS)if(f.kind==='toggle'){const el=$(f.key);if(el)next[f.key]=el.checked;}
  if($('seed'))next.seed=$('seed').value.trim()||'EVERGREEN';
  if(studioBiome)next.biome=studioBiome;
  settings={...settings,...validateSettings(next)};
  if(error)error.textContent='';
  return true;
 }catch(e){if(error)error.textContent=e.message;toast(e.message);return false;}
}
// A generator change cannot be migrated: the same seed simply grows different
// ground. Put the choice to the player instead of rebuilding underneath them.
// Resuming is the mirror of saving: the same record, rebuilt. It goes through
// the same guards as any other entry into play, so resuming from the studio
// asks about the landscape first.
function resumeRound(id){
 const rec=findRound(id);
 if(!rec){toast('That round is no longer saved.');return openPanel('round');}
 const go=async()=>{
  try{
   const next=Round.restore(rec.round);
   await whileGenerating('Rebuilding your course…',async report=>{
    leaveBackdrop();pendingRound=null;staleGenerator=false;
    challenge=null;round=next;settings=next.endless?endlessFor(next.seed,next.hole,rec.settings):{...settings,...rec.settings};
    applyPlaySettings();
    await prepareWorld(report);
    loadCourse();
    if(rec.camera&&typeof rec.camera==='object'){
     applyRoundCamera(rec.camera);
     if(view.config.mode==='putt')view.config.mode='player';
    }
   });
   closePanel();setMode('play');
   // A round saved against older ground gets the same warning a stale autosave
   // does, rather than quietly putting the ball somewhere that no longer exists.
   if(rec.generator!==GENERATOR_VERSION)showVersionNotice();
   else toast(`Resumed “${rec.name}”.`);
  }catch(e){toast('That round could not be rebuilt.');}
 };
 if(appMode==='studio')return guardStudio(go);
 if(appMode==='play')return guardRound(go);
 go();
}
function showVersionNotice(){
 const box=$('versionNotice');box.hidden=false;updateHUD();
 $('versionContinue').onclick=()=>{box.hidden=true;save();updateHUD();toast('Playing on the rebuilt landscape.');};
 $('versionFresh').onclick=()=>{box.hidden=true;challenge=null;round=new Round({players:round.players,mode:round.mode,holes:round.holes===18?18:9,tee:round.tee,putting:round.putting});loadCourse();toast('Fresh round started on this course.');};
 $('versionContinue').focus();
}
// The top nav shows where you are. A panel with its own tab (the scorecard)
// claims the highlight while it is open; otherwise the current mode does, so
// the studio tab stays lit for as long as you are in the studio.
function syncNav(){
 // PLAY AND COURSE STUDIO ARE WAYS IN, so they go once you are in. Offering
 // "Play" to somebody already playing means starting a different round from
 // what looks like a settings menu, and "Course studio" mid-round is a guarded
 // exit dressed as a nav item. Main menu is still one click away and is where
 // both of them live.
 for(const id of ['dropPlay','dropStudio'])if($(id))$(id).hidden=appMode!=='menu';
 // The top bar no longer has mode tabs, so "where am I" is said outright.
 const label=appMode==='play'&&round.endless?'Endless':({play:'Play',studio:'Course studio',menu:'Main menu'}[appMode]||'Play');
 const pill=$('modePill');
 pill.textContent=label;
 pill.dataset.mode=appMode==='play'&&round.endless?'endless':appMode;
 $('scoreNav').classList.toggle('active',panel==='score');
}
// THE GROUP EDITOR, shared by the round panel and the practice one.
//
// A "+" under the last row while there is room, and a trash on every golfer but
// the first -- the first is whoever owns the session and there has to be one.
// The draft is held here rather than scraped out of the DOM at commit time,
// because a count dropdown and a list of rows can disagree and this cannot.
let groupDraft=null;
// "PLAYS WITH" AND THE HAND are only asked once a launch monitor has ever
// connected on this device (spec Q14): until then everyone is on the Swing
// Meter and the hand is something only a monitor is told.
const bridgeSeen=()=>{if(monitorConnected)return true;try{return !!localStorage.getItem(BRIDGE_KEY);}catch{return false;}};
function groupEditor(hostId,start,onChange){
 const host=$(hostId);if(!host)return null;
 // `seat` is the id this golfer already holds in the round. It rides through the
 // editor so that removing a row removes THAT golfer's card rather than the last
 // one in the list. A row added here has none, which is what marks it as new.
 //
 // EVERY ROW IS A PROFILE. `profile` is the one picked; a row with none is a new
 // player, whose name is typed and who becomes a profile when the group is
 // applied (`readDraft`). A golfer from a save older than profiles is matched by
 // name, and becomes a new player if nobody on this device has that name.
 const draft=start.map(p=>{const prof=findProfile(profiles,p.profile)||profileByName(profiles,p.name);
  return {profile:prof?.id??null,name:prof?.name??p.name,team:p.team,hand:p.hand||prof?.hand||'RH',input:p.input||prof?.input||'monitor',seat:p.id};});
 groupDraft=draft;
 const NEW='__new';
 const paint=()=>{
  const taken=i=>new Set(draft.filter((q,j)=>j!==i&&q.profile).map(q=>q.profile));
  // Main first, then everyone else in the order they joined -- the same order
  // as the switcher on My profile.
  const everyone=profiles?[mainProfile(profiles),...profiles.profiles.filter(p=>p.id!==profiles.main)]:[];
  // The dot is shown where the group is BUILT, not only where it is scored:
  // otherwise the first time anyone sees a golfer's colour is a tracer over a
  // fairway, with nothing on screen tying it to a name.
  host.innerHTML=draft.map((p,i)=>`<div class="player-row${bridgeSeen()?' play':''}">`
   // The colour and the golfer's ball share the first column: as a cell of
   // their own, the ball pushed the name box into the team's narrow column.
   +`<span class="player-mark"><span class="player-dot" style="background:${playerColour(i)}" aria-hidden="true"></span>${p.profile&&findProfile(profiles,p.profile)?ballAvatar(findProfile(profiles,p.profile),'tiny'):''}</span>`
   +`<div class="player-who"><select id="who${i}" aria-label="Player ${i+1}">`
   +everyone.filter(q=>!taken(i).has(q.id)).map(q=>`<option value="${q.id}" ${q.id===p.profile?'selected':''}>${escape(q.name)} · Level ${levelOf(q.xp).level}</option>`).join('')
   +`<option value="${NEW}" ${p.profile?'':'selected'}>New player…</option></select>`
   +(p.profile?'':`<input aria-label="Player ${i+1}'s name" id="name${i}" maxlength="${MAX_PLAYER_NAME}" placeholder="New player's name" value="${escape(p.name||'')}">`)
   +`</div>`
   +`<select id="team${i}" aria-label="Player ${i+1} team"><option value="A" ${p.team==='A'?'selected':''}>Team A</option><option value="B" ${p.team==='B'?'selected':''}>Team B</option></select>`
   +(bridgeSeen()?`<select id="input${i}" aria-label="Player ${i+1} plays with"><option value="monitor" ${p.input!=='meter'?'selected':''}>Launch monitor</option><option value="meter" ${p.input==='meter'?'selected':''}>Swing Meter</option></select>`
    +`<select id="hand${i}" aria-label="Player ${i+1} handedness"><option ${p.hand==='RH'?'selected':''}>RH</option><option ${p.hand==='LH'?'selected':''}>LH</option></select>`:'')
   // EVERY GOLFER CAN BE REMOVED, not everyone except the first. The rule is
   // that a round needs one golfer, and this enforced a different one: row zero
   // had no remove button at all, so the only way to drop the first name was to
   // remove everyone else and retype it. The spacer keeps the last remaining
   // row aligned with the others.
   +(draft.length>1?`<button class="small-icon drop-player" data-drop="${i}" aria-label="Remove ${escape(p.name||'player '+(i+1))}"><i data-lucide="trash-2"></i></button>`
      :`<span class="drop-spacer" aria-hidden="true"></span>`)
   +`</div>`).join('')
   +(draft.length<4?`<button class="secondary add-player" data-add><i data-lucide="plus"></i> Add player</button>`:'');
  icon();
  draft.forEach((p,i)=>{
   $('who'+i).onchange=e=>{
    const v=e.target.value;
    if(v===NEW){p.profile=null;p.name='';}else{const q=findProfile(profiles,v);p.profile=v;p.name=q?.name??'';p.hand=q?.hand||'RH';p.input=q?.input||'monitor';}
    paint();onChange?.();
    if(v===NEW)$('name'+i)?.focus();
   };
   if($('name'+i))$('name'+i).oninput=e=>{p.name=e.target.value;};
   $('team'+i).onchange=e=>{p.team=e.target.value;onChange?.();};
   if($('hand'+i))$('hand'+i).onchange=e=>{p.hand=e.target.value;};
   if($('input'+i))$('input'+i).onchange=e=>{p.input=e.target.value;};
  });
  host.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{
   draft.splice(Number(b.dataset.drop),1);paint();onChange?.();});
  const add=host.querySelector('[data-add]');
  // A new row offers the next profile nobody in the group is using, and a new
  // player when everyone on the device is already playing.
  if(add)add.onclick=()=>{
   const used=new Set(draft.map(q=>q.profile)),free=everyone.find(q=>!used.has(q.id));
   draft.push({profile:free?.id??null,name:free?.name??'',team:draft.length%2?'B':'A',hand:free?.hand||'RH',input:free?.input||'monitor',seat:undefined});
   paint();onChange?.();
   if(!free)$('name'+(draft.length-1))?.focus();};
 };
 paint();
 return draft;
}
// What the editor currently holds, cleaned up for `Round` -- and the moment a
// new player becomes a profile. A typed name that is already a profile on this
// device IS that profile rather than a second one with the same name. Throws,
// before anything is created, on an empty name or the same golfer twice.
function readDraft(){
 const rows=(groupDraft||[]).map((p,i)=>{
  if(p.profile&&findProfile(profiles,p.profile))return {...p,prof:findProfile(profiles,p.profile)};
  const name=(p.name||'').trim();
  if(!name)throw Error(`Give player ${i+1} a name, or pick someone from the list.`);
  return {...p,typed:name,prof:profileByName(profiles,name)};
 });
 const seen=new Set();
 for(const r of rows){const key=r.prof?.id??r.typed.toLowerCase();if(seen.has(key))throw Error(`${r.prof?.name??r.typed} is in the group twice.`);seen.add(key);}
 return rows.map(r=>{
  let prof=r.prof;
  if(!prof){const made=addProfile(profiles,r.typed);profiles=made.store;prof=made.profile;useMainProfile();}
  // Remembered for the next group this golfer joins.
  setProfilePlay(profiles,prof.id,{hand:r.hand,input:r.input});
  return {name:prof.name,profile:prof.id,team:r.team,hand:r.hand,input:r.input==='meter'?'meter':'monitor',seat:r.seat};
 });
}
// What each format is called in Saved rounds and a golfer's history.
const FORMAT_NAMES={stroke:'Stroke play',match:'Match play',scramble:'Scramble',skins:'Skins'};
const FORMAT_NOTES={stroke:'Each golfer finishes the entire hole before the next player tees off. Lowest total wins.',scramble:'All teammates hit from the same lie. Choose one result for the next stroke; only that shot’s penalty counts. One or two teams are supported.',match:'Two sides compete hole by hole. Each side uses its lowest individual score (best ball). Singles works with one golfer per side. The match ends when the lead exceeds holes remaining.',skins:'Two to four golfers, each for themselves, playing every hole out as in stroke play. Every hole is worth a skin: the lowest score alone wins it, and a tie carries it to the next hole. Skins still carried after the last hole go unclaimed.'};
// `match` is false for endless: a match ends when the lead exceeds the holes
// remaining and an endless run has no last hole, so `Round` rejects the
// combination outright. Offering it and then throwing would be a worse answer.
// Skins stays: it needs no last hole -- each skin is paid as it is won and the
// carry simply runs on (the owner, 16 October 2026).
// `strokeOnly`: the course of the week, whose bests are strokes for the
// eighteen, so its format is fixed (the owner, 15 October 2026).
const formatFields=({match=true,strokeOnly=false}={})=>`<label class="field">Format<select id="roundMode"${strokeOnly?' disabled':''}><option value="stroke">${strokeOnly?'Stroke play only':'Stroke play'}</option>${strokeOnly?'':`<option value="scramble">Team scramble</option>${match?'<option value="match">Match play · best ball teams</option>':''}<option value="skins">Skins · two to four golfers</option>`}</select></label><label class="field">Play from<select id="roundTee">${enabledTees(settings).map(t=>`<option value="${t}" ${round.tee===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)} tees</option>`).join('')}</select></label><label class="field">Out of bounds<select id="roundOB">${Object.entries(OB_RULES).map(([k,v])=>`<option value="${k}" ${round.outOfBounds===k?'selected':''}>${v.label}</option>`).join('')}</select></label><label class="field">Lie penalty for launch-monitor shots<select id="roundMonLie"><option value="on" ${round.monitorLie?'selected':''}>On: rough and sand cost ball speed</option><option value="off" ${round.monitorLie?'':'selected'}>Off: monitor shots fly as measured</option></select></label><label class="field">Putting<select id="roundPuttingMode">${PUTTING_MODES}</select></label><div id="roundPutting-distances">${puttingFields('roundPutting',playerPutting())}</div><p class="note" id="roundPuttingNote"></p>`;
// Wires everything `formatFields` rendered. Returns the format note redraw so a
// caller that also owns the group list can refresh it when the group changes.
function wireFormatFields(){
 const modes=[...$('roundMode').options].map(o=>o.value);
 $('roundMode').value=modes.includes(round.mode)?round.mode:'stroke';
 const formatNote=()=>$('formatNote').textContent=FORMAT_NOTES[$('roundMode').value];
 $('roundPuttingMode').value=playerPutting().mode;
 // Applied as it is changed. A button here would have been a third place to
 // press Save for one setting, and both panels already have a primary action.
 const puttNote=()=>{const m=$('roundPuttingMode').value;$('roundPutting-distances').hidden=m==='holeout';$('roundPuttingNote').textContent=PUTTING_NOTES[m];};
 const puttApply=()=>{try{puttingGuard();applyPutting(readPutting('roundPutting'));save();updateHUD();$('roundError').textContent='';}catch(e){$('roundError').textContent=e.message;toast(e.message);}};
 puttNote();$('roundPuttingMode').onchange=()=>{puttNote();puttApply();};
 for(const k of ['one','two','three'])$('roundPutting-'+k).onchange=puttApply;
 // Applied as it is changed, like putting: to the round being played and to
 // every round after it.
 $('roundOB').onchange=()=>{const v=$('roundOB').value;if(!OB_RULES[v])return;Round.defaultOutOfBounds=v;round.outOfBounds=v;saveRules();save();};
 // The lie rule for monitor shots, the same way: this round and every one after.
 // Swing Meter shots keep the lie either way -- on the meter it is part of the
 // swing, not an adjustment to a measurement.
 $('roundMonLie').onchange=()=>{const v=$('roundMonLie').value!=='off';Round.defaultMonitorLie=v;round.monitorLie=v;saveRules();save();updateHUD();};
 $('roundMode').onchange=formatNote;formatNote();
 return formatNote;
}
function openRangePanel(){rangeSetup=true;openPanel('round');}
function openEndlessPanel(){endlessSetup=true;openPanel('round');}
// The map's pan and zoom, and the one place that redraws it outside the frame
// loop. Stored on the canvas so every drawMap call site inherits it -- which is
// what makes this work identically in play, free flight, the studio and the
// menu backdrop without four copies of the state.
const mapNav=()=>($('map').mapNav ??= {...MAP_NAV_NONE});
const resetMapNav=()=>{const c=$('map');if(c)c.mapNav={...MAP_NAV_NONE};};
function redrawMap(){
 if(!course||!$('map'))return;
 // During a flight the map is framed on where the shot was STRUCK, not where
 // the round says the ball is: `round.takeShot` has already moved on by then,
 // and the frame is fitted around that position, so the map would reframe
 // itself mid-flight.
 drawMap($('map'),flight?.replay?view.course:course,flight?flight.origin:round.position,
  round.candidates,['free','overview'].includes(view.config.mode),view.camera.position,
  flight||dropState?null:aimPoint,view.elapsed);
 drawFlightOnMap();
}
// THE BALL IN FLIGHT, ON THE MAP: the line it has drawn so far and where it is
// now, over whatever the map drew. The owner's ask, 26 September -- the map is
// the one panel that stays while a ball is up, so it should be following it.
function drawFlightOnMap(){
 const c=$('map'),m=c?.mapTransform;if(!m||!flight||!flight.at)return;
 const hole=flight.replay?view.course:course;
 const at=q=>mapPoint(m,m.full?hole.toWorld({x:q.x,z:q.z}):q);
 const pts=flight.result.points.slice(0,flight.index+1).concat([flight.at]);
 const ctx=c.getContext('2d'),r=Math.max(1,c.width/(c.clientWidth||c.width));
 ctx.save();
 ctx.strokeStyle='#fff1ac';ctx.lineWidth=2.5*r;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();pts.forEach((q,i)=>{const [x,y]=at(q);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
 const [bx,by]=at(flight.at);
 ctx.fillStyle='#fff';ctx.strokeStyle='#31503c';ctx.lineWidth=1.5*r;
 ctx.beginPath();ctx.arc(bx,by,4.5*r,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.restore();
}
// Pointer position in the canvas's own pixels. The canvas is drawn at twice its
// CSS size, so the two frames are NOT interchangeable and mixing them puts a
// click at half the distance from the centre that it should be.
// THE WIND ARROW READS AGAINST WHAT YOU ARE LOOKING AT. It used to be turned
// by the wind bearing alone, so it pointed the same way whichever direction
// you faced -- which is a weather report, not an aid. Straight up means the
// wind is going away from you, right means it crosses left to right. The tilt
// that makes it read as lying on the ground is CSS; this only supplies the
// bearing.
//
// CAMERA MINUS WIND, NOT WIND MINUS CAMERA, and the order is the whole bug.
// Both bearings are `atan2(x, z)`, so they agree with each other -- but that
// convention runs COUNTER-CLOCKWISE on screen, because looking along +z puts
// local +x on the left (the same fact `mapPoint` is built on). CSS `rotate` is
// clockwise. Subtracting the other way round mirrored the arrow, so turning
// the camera swung it the wrong way and it read as following the camera
// rather than holding still against the world.
//
// Check it against a case with a known answer: wind straight downrange and the
// camera looking downrange must give zero, and both orders do -- which is why
// this looked right until the camera moved.
// WHAT IS ACTUALLY CLEAR ON SCREEN, for clamping the hole marker. Measured
// rather than assumed, because the panels are draggable and resizable -- a
// table of constants would be wrong the moment anyone moved one. Re-measured
// twice a second rather than per frame: `getBoundingClientRect` forces layout,
// and a panel that has just been dragged can wait 500 ms to be noticed.
let hudInsetsAt=-1e9,hudInsetsCache={top:70,right:30,bottom:30,left:30};
function hudInsets(now){
 if(now-hudInsetsAt<500)return hudInsetsCache;
 hudInsetsAt=now;
 const scene=$('scene');if(!scene)return hudInsetsCache;
 const sr=scene.getBoundingClientRect(),ins={top:70,right:30,bottom:30,left:30},gap=14;
 const showing=el=>el&&!el.hidden&&el.offsetParent&&el.getBoundingClientRect().width>0;
 // A PANEL THAT RUNS MOST OF THE HEIGHT is kept to one SIDE of; a panel
 // along the bottom is kept ABOVE. A laptop has the first kind -- the shot
 // panel down the left, the camera strip and map down the right -- and a
 // phone the second, the panel, map and aim pad all at the foot. Treating the
 // phone's panel as a side panel pushed the markers into a sliver between it
 // and the map, and the cap below then let them sit on top of it anyway.
 for(const el of [...document.querySelectorAll('.bottom-area,.monitor-panel,.minimap,.view-tools,.aim-pad')]){
  if(!showing(el))continue;
  const r=el.getBoundingClientRect();
  if(r.height>sr.height*.6){
   if(r.left-sr.left<sr.width/2)ins.left=Math.max(ins.left,r.right-sr.left+gap);
   else ins.right=Math.max(ins.right,sr.right-r.left+gap);
  }else if(r.top-sr.top>sr.height/3)ins.bottom=Math.max(ins.bottom,sr.bottom-r.top+gap);
 }
 // A marker squeezed into nothing is worse than one overlapping a panel, so
 // never give up more than a third of the screen to a side, or half of it to
 // the foot.
 ins.bottom=Math.min(ins.bottom,sr.height/2);
 ins.right=Math.min(ins.right,sr.width/3);
 ins.left=Math.min(ins.left,sr.width/3);
 // Measured in screen pixels; the markers are placed in the app's own, which
 // the Text size zoom makes `zoom` screen pixels each (ui-scale.js).
 const z=uiZoom();if(z!==1){ins.top/=z;ins.right/=z;ins.bottom/=z;ins.left/=z;}
 hudInsetsCache=ins;
 return ins;
}
function setWindArrow(){
 const el=$('windArrow');if(!el)return;
 const wind=settings.windDirection||0;
 let bearing=-wind;
 try{bearing=view.cameraHeading()-wind;}catch{}
 el.style.transform='';
 el.style.setProperty('--wind',bearing.toFixed(1)+'deg');
}
function mapPixels(e){
 const c=$('map'),r=c.getBoundingClientRect();
 return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};
}
function closePanel(){if((rangeSetup||endlessSetup||weeklySetup||challengeSetup)&&panel==='round'){rangeSetup=false;endlessSetup=false;weeklySetup=false;challengeSetup=false;if(appMode==='menu')openMenu();}if(studioSetup&&panel==='course'){studioSetup=false;if(appMode==='menu')openMenu();}panel=null;syncMenuOverlay();$('drawer').hidden=true;$('drawerBackdrop').hidden=true;setPanelFocus(false);syncNav();updateStudioState();}
// How long the camera stays where the shot was struck before it goes after the
// ball. Long enough to see it leave and the line start to form, short enough not
// to feel like a pause. Putts are excluded: one is over before the hold would be.
// How long the camera stays with the player before it goes after the ball.
// Long enough to see the strike and the ball leave, rather than cutting away
// mid-swing. A PUTT waits not at all -- it is over in a couple of seconds and
// the roll is the whole event -- and that exemption lives at the call site.
// Flight plays at REAL TIME.
//
// It used to advance at 1.7x, with no comment and no reason recorded. That took
// a 7-iron's 6.6 s of hang time down to 3.9 s on screen, and a driver's 7.5 to
// 4.4 -- which is why shots did not look like shots. The physics was never
// wrong; it was being played back on fast-forward.
//
// Only the trajectory clock carried it. Both hold timers count real seconds and
// always did, so the camera hold and the settle pause are unaffected.
const FLIGHT_PLAYBACK=1;
// THE TRACER RUNS A MOMENT BEHIND THE BALL (the owner, 6 October), so the line
// does not sit on top of the ball and the ball itself can be seen. A TIME lag
// rather than a distance: it opens to about ten metres behind a driver at full
// speed and closes to a few centimetres behind a slow putt, the way a broadcast
// tracer trails, and it catches up once the ball stops, while the result holds.
const TRACER_LAG=.15;
// The flight's path up to time `t`, ending on the exact point the ball was at
// then; nothing before the first point. Walks back from the frame's current
// sample rather than forward from the tee: a long flight has thousands.
function trailUpTo(pts,t,from){
 if(!(t>0))return [];
 let i=Math.min(from,pts.length-1);
 while(i>0&&pts[i].t>t)i--;
 const a=pts[i],b=pts[i+1];
 if(!b||b.t<=a.t)return pts.slice(0,i+1);
 const f=clamp((t-a.t)/(b.t-a.t),0,1);
 return pts.slice(0,i+1).concat([{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f,t}]);
}
const CAMERA_HOLD=1.5;
// The television plan for a shot (tv-camera.js), made the moment it is struck:
// when to cut and where the landing camera stands. A putt has none.
function shotCameraPlan(result,hole){
 if(!result||result.puttStroke||!view?.world||!hole)return null;
 try{return planShotCamera({points:result.points,hang:result.hang,carry:result.carry,toWorld:q=>hole.toWorld(q),groundAt:(x,z)=>view.world.height(x,z),trees:view.world.trees});}
 catch(e){console.warn('shot camera plan failed',e);return null;}
}
// Slow motion. Scales how fast the recorded flight is played back, not the
// physics: the path is already computed at 240 Hz, so slowing it down samples
// the same trajectory more finely rather than coarsening it. The camera's hold
// before it chases scales with it, because that is presentation timing tied to
// the shot; the hold once the ball has STOPPED does not, because three seconds
// to look at a final lie is three seconds however slowly it got there.
let timeScale=1;
// A normal round can read par straight off the course it is being played on. An
// endless run cannot: every landscape is discarded as the next one grows, so the
// pars it recorded hole by hole are the only record left.
const roundPars=()=>round.endless?round.pars.map(p=>p??0):(world?.holes||[]).map(h=>h.par);
// Scramble scores are kept per team, so the team's card is the one that counts.
function toPar(index=round.active){
 const pars=roundPars();
 if(!pars.length)return {rel:0,played:0};
 const card=round.mode==='scramble'?round.teamCards[round.players[index]?.team]:round.cards[index];
 return relativeToPar(card,pars);
}
// THE SCORES LIVE IN THE TOP BAR, one chip per golfer: their colour and
// initial, their name, where they stand, and a note -- the shot they are on,
// or that they are in. The one who is up is lit. They replace the course
// card's single player row, which showed only whoever was up, and the
// Scorecard chip, which they also are: a tap on any of them opens the card.
// On a practice ground there is no par, so a chip counts shots instead, and
// a tap picks who is hitting -- a second tap on whoever is up opens their
// shot list, which is what the old player row did.
// A golfer's level, as a small badge beside their name (Phase 4; the badges'
// own looks come with the rewards).
const levelBadge=prof=>{if(!prof)return '';const lv=levelOf(prof.xp).level,f=FRAMES[highestBadge(lv)];
 return `<i class="level-badge" title="Level ${lv} · ${escape(badgeName(lv))}" style="background:linear-gradient(135deg,${f.from},${f.to});color:${f.ink}">${lv}</i>`;};
const chipLevel=p=>rangeMode?'':levelBadge(profileOf(p));
// THE GOLFER'S CIRCLE (the owner, 15 October 2026): their ball in their frame,
// their level on top of it, and their seat colour as a dot on its edge -- the
// colour still ties the chip to their scorecard row. A golfer
// with no profile keeps the plain coloured initial.
function golferMark(i){
 const p=round.players[i],prof=profileOf(p);
 if(!prof)return `<span class="chip-dot" style="background:${playerColour(i)};color:${PLAYER_INK}">${escape(p?.name?.[0]?.toUpperCase()||'P')}</span>`;
 const l=looksOf(prof);
 return `<span class="chip-ball" title="Level ${l.level} · ${escape(badgeName(l.level))}">${framedPicture(l.ball,l.frame,'chip')}<i class="chip-level">${l.level}</i><i class="chip-seat" style="background:${playerColour(i)}"></i></span>`;
}
// THE TURN FLASH (the owner, 15 October 2026): who is up, in the middle of the
// screen, with what their chip in the top bar says -- their circle, name,
// score against par and which shot. In a group, every time the turn passes;
// playing alone, at the start of each hole (a flash before every shot of a
// solo round would only be in the way -- PLACED). Not on the range, behind the
// menu, or while a team chooses its ball or a golfer their relief.
let lastTurn='';
function flashTurn(tries=0){
 const el=$('turnFlash');if(!el||menuBackdrop||rangeMode)return;
 // A round's first turn is set up behind the loading screen: wait for it to
 // go (up to about 15 s) rather than flash where nobody can see.
 if(appMode!=='play'||$('generating')?.hidden===false){if(tries<50)setTimeout(()=>flashTurn(tries+1),300);return;}
 if(round.holeComplete||round.scrambleSelection||round.relief)return;
 // The same golfer playing on (after a drop, a replay, or honours giving
 // them the next shot too) is not a new turn.
 const i=round.active,key=round.players.length>1?`${round.uid}:${round.hole}:${i}`:`${round.uid}:${round.hole}`;
 if(key===lastTurn)return;
 // After someone holes out, the turn passes while their hole-out banner (or a
 // level-up) is still up: wait for it, then name who is up -- the two used to
 // sit on top of each other (smoke, 15 October 2026).
 if(!$('holeOut')?.hidden||!$('levelUp')?.hidden){if(tries<50)setTimeout(()=>flashTurn(tries+1),300);return;}
 lastTurn=key;
 const p=round.player,{rel,played}=toPar(i),score=played?parText(rel):'E',tint=parTint(rel,played);
 const shot=round.mode==='scramble'?round.stroke:(round.strokes?.[i]||0)+1;
 el.innerHTML=`<small>${round.players.length>1?'UP NOW':`HOLE ${round.hole+1}`}</small><div class="turn-flash-row">${golferMark(i)}<strong>${escape(p.name)}</strong>${`<b${tint?` style="background:${tint}"`:''}>${escape(score)}</b>`}<span>Shot ${scoreText(shot)}</span></div>`;
 el.hidden=true;void el.offsetWidth;el.hidden=false;
 clearTimeout(flashTurn.timer);flashTurn.timer=setTimeout(()=>{el.hidden=true;},1900);
}
function drawScoreChips(){
 const host=$('scoreChips');if(!host)return;
 const others=round.players.length-1;
 // In skins each chip also says how many skins its golfer has won.
 const k=round.mode==='skins'&&!rangeMode?skins(round.cards,decidedHoles(round)):null;
 host.innerHTML=round.players.map((p,i)=>{
  const up=i===round.active;
  let score,note,tint='';
  if(rangeMode){
   score=up?`Shot ${practiceShots+1}`:'';
   note='';
  }else{
   const {rel,played}=toPar(i);
   score=played?parText(rel):'E';
   // Tinted as the old live score was: progressively red over par, green under.
   tint=parTint(rel,played);
   note=round.done?.[i]?'In':round.strokes?.[i]>0?`Shot ${round.strokes[i]+1}`:'';
   if(up&&round.mode==='scramble'&&!round.holeComplete)note=`Shot ${scoreText(round.stroke)}`;
   if(k)note=[skinsText(k.won[i]),note].filter(Boolean).join(' · ');
  }
  const label=rangeMode?(up?`${p.name}, hitting. Open ${p.name}'s shots`:`Hand the mat to ${p.name}`)
   :`${p.name}, ${score==='E'?'even par':score}. Open the scorecard`;
  return `<button class="score-chip${up?' up':''}" data-player="${i}" aria-label="${escape(label)}">`
   +golferMark(i)
   +`<span class="chip-name">${escape(p.name)}</span>${score?`<b${tint?` style="background:${tint}"`:''}>${escape(score)}</b>`:''}${note?`<small>${escape(note)}</small>`:''}`
   +(up&&others>0?`<span class="chip-more">+${others}</span>`:'')+`</button>`;
 }).join('');
}
// While a panel is open the surrounding chrome softens so it is obvious where
// the focus is. The course itself is left sharp on purpose.
function setPanelFocus(on){$('world').classList.toggle('panel-open',on);document.getElementById('app').classList.toggle('panel-open',on);}
function slider(id,label,value,min,max,unit='',step=1){return `<label class="field">${label}<output id="${id}Value">${value}${unit}</output><input type="range" id="${id}" aria-label="${label}" min="${min}" max="${max}" value="${value}" step="${step}" data-unit="${unit}"></label>`;}
// Every range in a panel gets its readout wired, BY CONVENTION: an output named
// <id>Value, and the unit off the input's own data-unit. `slider()` builds both,
// so use it rather than writing the markup by hand.
//
// THE READOUT IS OPTIONAL AND THE GUARD IS NOT OPTIONAL. This threw on every
// input event for any slider without a matching output, which silently describes
// `labFirmness`, `labStimp` and `timeHour` as well as a pair added by hand for
// green definition. The slider still worked and its own handler still ran, so
// the only symptom was a console filling up -- easy to write off as noise, which
// is exactly what happened before a player reported it.
function wireSliders(root){root.querySelectorAll('input[type=range]').forEach(el=>el.addEventListener('input',()=>{
 const out=$(el.id+'Value');
 if(out)out.textContent=el.value+(el.dataset.unit??'');
}));}
function openPanel(name){
 if(appMode==='play'&&TOOL_PANELS.has(name)&&popups){openTool(name);return;}
 openSheet(name);
}
// A tool window renders exactly what the sheet would have rendered, so nothing
// about a panel has to know which host it landed in.
function openTool(name){
 stopTour();
 if(dropState)cancelDrop();
 
 // The sheet blurs whatever is behind it, so a tool opened from inside one
 // would arrive smeared. Opening a tool means the sheet has finished.
 closePanel();
 keys.clear();
 // The bag tool opens on whoever is up; the profile page names its own golfer.
 if(name==='bag'){bagOwner=null;bagReturn=null;}
 popups.open(name,{title:panelTitle(name),...POPUP_SIZE[name],render:body=>renderPanel(name,body)});
}
// The tools box is the old utility bar, rehoused. Its buttons are *moved* into
// the window rather than rebuilt, so their ids, their handlers and everything
// that enables and disables them from updateHUD keep working untouched -- and
// they are handed back to the page before the window is torn down.
function openToolsBox(){
 // Open in the studio too. Most of the tray is about playing a shot and means
 // nothing there, but Arrange windows and Reset windows are exactly what you
 // want while laying a course out, and refusing to open at all made the button
 // look broken. The play-only controls are disabled instead -- see updateHUD.
 if(!popups)return;
 if(popups.isOpen('tools')){popups.close('tools');return;}
 const tray=$('toolsTray');
 popups.open('tools',{title:'Tools',width:296,height:376,
  render:body=>{tray.hidden=false;body.append(tray);},
  onClose:()=>{tray.hidden=true;document.querySelector('.bottom-area').append(tray);}});
}
function syncTools(){
 const b=$('toolsButton');
 if(b)b.classList.toggle('selected',popups?.isOpen('tools'));
}
function openSheet(name){stopTour();
 if(name!=='score')cancelAdvance();
 if(dropState)cancelDrop();panel=name;syncMenuOverlay();keys.clear();$('drawer').dataset.panel=name;$('drawer').hidden=false;$('drawerBackdrop').hidden=false;setPanelFocus(true);
 $('drawerTitle').textContent=panelTitle(name);
 syncNav();updateStudioState();
 renderPanel(name,$('drawerContent'));
 $('closeDrawer').focus();
}

// Panels you consult while deciding what to hit. These open as floating windows
// so the course stays visible behind them and several can be up at once. The
// rest -- setting up a round, the scorecard, the studio -- are once-a-round
// forms, and a wide sheet that takes the whole screen is right for those.
const TOOL_PANELS=new Set(['camera','graphics','sound','bag','flight','putting','shot','range','lab','views','shotdata']);
const POPUP_SIZE={camera:{width:344,height:382},graphics:{width:352,height:300},sound:{width:330,height:360},bag:{width:372,height:430},flight:{width:360,height:430},putting:{width:344,height:330},shot:{width:344,height:520},range:{width:300,height:260},lab:{width:352,height:470},views:{width:392,height:412},shotdata:{width:360,height:470}};
const PANEL_TITLES={challenge:'Challenge',profile:'My profile',course:'Course studio',round:'Your next round',camera:'Camera & bay',monitor:'Launch monitor',score:'The scorecard',shot:'Swing Meter',help:'Welcome to Fairway',bag:'Bag',flight:'Turf settings',lab:'Lab tools',views:'Shot views',range:'Range controls',putting:'Putting options',library:'Saved courses',graphics:'Graphics & performance',sound:'Sound',shotdata:'Shot data'};
// One panel key, three variants -- a round, a practice ground and an endless
// run -- so the heading has to follow the variant, not the key. All three used
// to read "Your next round", which is wrong on two of them.
const panelTitle=name=>name!=='round'?PANEL_TITLES[name]
 :(rangeSetup||rangeMode)?'Driving range'
 :endlessSetup?'Endless run'
 :weeklySetup?'Course of the week'
 :challengeSetup?'Challenges'
 :PANEL_TITLES.round;

// Builds one panel's controls into whichever host is showing it. Nothing in
// here knows whether that host is the sheet or a floating window, which is the
// whole point: the yardage book is the same yardage book either way.
// The saved-round list, rendered inside the round panel's own tab. It used to be
// a separate panel reached from the main menu; a player looking for their saved
// rounds now finds them beside the thing that makes them.
function roundCards(){
 const rounds=listRounds();
 const when=t=>{const d=new Date(t);return isNaN(d)?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});};
 if(!rounds.length)return '<p class="note">No saved rounds yet. When you leave a round in progress, Fairway offers to keep it here.</p>';
 return `<div class="course-list">`+rounds.map(r=>{
  const s=r.summary,stale=r.generator!==GENERATOR_VERSION;
  const where=s.finished?'Finished':s.endless?`Endless · hole ${s.hole}`:`Hole ${s.hole} of ${s.holes}`;
  if(renamingRound===r.id)
   return `<div class="course-card"><label class="field course-rename">Rename this round<input id="renameRoundInput" maxlength="${MAX_NAME}" value="${escape(r.name)}"></label>`
    +`<div class="course-card-actions"><button class="secondary" data-rround-save="${r.id}">Save name</button>`
    +`<button class="secondary" data-rround-cancel="1">Cancel</button></div></div>`;
  return `<div class="course-card"><div class="course-meta"><strong>${escape(r.name)}</strong>`
   +`<span>${where} · ${s.players} player${s.players===1?'':'s'} · ${escape(FORMAT_NAMES[s.format]||s.format)}${s.strokes?` · ${s.strokes} strokes`:''}</span>`
   +`<span class="course-when">${when(r.saved)}${stale?' · built by an earlier generator':''}</span></div>`
   // EXPORT LIVES ON THE ROW. The tab listed saved rounds and then offered an
   // export of the LIVE one underneath, which is a different round from any of
   // the ones on screen -- so the obvious reading of "export" in this tab was
   // the one thing the button did not do.
   +`<div class="course-card-actions"><button class="secondary" data-resume="${r.id}">Resume</button>`
   +`<button class="secondary" data-rround="${r.id}">Rename</button>`
   +`<button class="secondary" data-export-round="${r.id}">Export</button>`
   +`<button class="secondary" data-forget="${r.id}" aria-label="Delete ${escape(r.name)}">Delete</button></div></div>`;
 }).join('')+`</div>`;
}
// A saved round as a file, in the same shape `saveRecord` writes and the import
// reads -- a round on the shelf and the round in your hands are one format.
const roundFileName=name=>'fairway-'+(String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'round')+'.json';
function wireRoundCards(content){
 content.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>resumeRound(b.dataset.resume));
 content.querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{deleteRound(b.dataset.forget);openPanel('round');toast('Saved round deleted.');});
 content.querySelectorAll('[data-export-round]').forEach(b=>b.onclick=()=>{
  const rec=findRound(b.dataset.exportRound);
  if(!rec){toast('That round is no longer saved.');return openPanel('round');}
  download(roundFileName(rec.name),JSON.stringify({version:2,schema:rec.schema,generator:rec.generator,
   settings:rec.settings,round:rec.round,camera:rec.camera},null,2),'application/json');
  toast(`Exported “${rec.name}”.`);
 });
 content.querySelectorAll('[data-rround]').forEach(b=>b.onclick=()=>{renamingRound=b.dataset.rround;openPanel('round');});
 content.querySelectorAll('[data-rround-cancel]').forEach(b=>b.onclick=()=>{renamingRound=null;openPanel('round');});
 content.querySelectorAll('[data-rround-save]').forEach(b=>b.onclick=()=>{
  try{renameRound(b.dataset.rroundSave,$('renameRoundInput').value);renamingRound=null;openPanel('round');toast('Round renamed.');}
  catch(e){$('roundsError').textContent=e.message;}
 });
 if($('renameRoundInput')){requestAnimationFrame(()=>{const el=$('renameRoundInput');if(el){el.focus();el.select();}});
  $('renameRoundInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();content.querySelector('[data-rround-save]')?.click();}if(e.key==='Escape'){renamingRound=null;openPanel('round');}};}
}
// MY PROFILE. Everything here is worked from the store at the moment the page
// opens, so there is no second copy of any number to fall out of step. It opens
// on the main profile; the strip across the top switches to anyone else.
let renamingProfile=false,viewingProfile=null;
const profileWhen=t=>{const d=new Date(t);return isNaN(d)||!t?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
const pct=({hit,of})=>of?`${Math.round(hit/of*100)}%`:'—';
const toParText=rel=>rel===0?'E':(rel>0?'+':'')+(Math.round(rel*100)/100);
const hcpText=i=>i===null?'—':i<0?'+'+(-i).toFixed(1):i.toFixed(1);
function profileCard(r){
 const t=roundTotals(r),stale=r.course?.generator!==GENERATOR_VERSION;
 const of=r.endless?`Endless · ${t.played} hole${t.played===1?'':'s'}`:t.played>=r.holes?`${r.holes} holes`:`${t.played} of ${r.holes} holes`;
 const format=FORMAT_NAMES[r.mode]||'Stroke play';
 const tags=[qualifies(r)?'<em class="profile-tag counts">Counts toward handicap</em>':'',r.mode==='scramble'?'<em class="profile-tag">Team score</em>':'',stale?'<em class="profile-tag">Earlier generator</em>':''].join('');
 const tip=stale?' title="Fairway&#39;s generator has changed since, so the land will grow a little differently."':'';
 return `<div class="course-card profile-round"><div class="profile-round-score" data-side="${parSide(t.rel,t.played)}"><strong>${scoreText(t.score)}</strong><small>${toParText(t.rel)}</small></div>`
  +`<div class="course-meta"><strong>${escape(r.course?.name||'A course')}</strong>`
  +`<span>${of} · ${format}${r.players>1?` · ${r.players} players`:''}</span>`
  +`<span class="course-when">${profileWhen(r.started)}${tags}</span></div>`
  +`<div class="course-card-actions"><button class="secondary" data-replay-course="${escape(r.id)}"${tip}><i data-lucide="rotate-ccw"></i> Replay this course</button><button class="secondary" data-remove-round="${escape(r.id)}" aria-label="Remove ${escape(r.course?.name||'this round')} from the history">Remove</button></div></div>`;
}
// THE LOOK (Phase 5): the ball finishes, tracers and titles in the reward
// table, the ones earned to put on and the rest shown with the level that
// brings them. One kind at a time, on tabs.
let lookTab='ball';
// A TRACER, SHOWN AS IT FLIES (the owner, 15 October 2026): a small flight
// arc in its colours, with its head, core, dash, zigzag and glints, moving the
// way the real one does -- colours running, dashes marching, flicker, glints
// twinkling or falling. CSS for the movement, one SMIL transform for the
// running colours (left out when the player asks for reduced motion).
const FLIGHT='M3 27 Q48 -10 97 17',JAGGED='M3 27 L13 17 L19 20 L29 9 L37 12 L47 4 L57 8 L66 5 L76 11 L86 10 L97 17';
const onArc=t=>({x:(1-t)*(1-t)*3+2*(1-t)*t*48+t*t*97,y:(1-t)*(1-t)*27+2*(1-t)*t*-10+t*t*17});
function tracerPreview(id){
 const st=TRACERS[id]||TRACERS.classic,cols=st.colours,g='tp-'+id,d=st.jag?JAGGED:FLIGHT,w=Math.max(1.6,Math.min(5,st.width*.45));
 const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ring=st.shift?[...cols,cols[0]]:cols;
 const stops=ring.map((c,i,a)=>`<stop offset="${a.length>1?(i/(a.length-1)).toFixed(3):0}" stop-color="${c}"/>`).join('');
 const move=st.shift&&!still?`<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="1 0" dur="${(.75/st.shift).toFixed(1)}s" repeatCount="indefinite"/>`:'';
 const cls=[st.dash?'tp-dash':'',st.flicker?'tp-flicker':''].join(' ').trim();
 let svg=`<defs><linearGradient id="${g}" x1="0" x2="1" spreadMethod="repeat">${stops}${move}</linearGradient></defs>`
  +`<path d="${d}" stroke="url(#${g})" stroke-width="${w.toFixed(1)}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${st.opacity??1}"${st.dash?' stroke-dasharray="6 4"':''}${cls?` class="${cls}"`:''}/>`;
 if(st.head)svg+=`<path d="${d}" pathLength="100" stroke="url(#${g})" stroke-width="${(w*2.3).toFixed(1)}" stroke-dasharray="0 84 16 0" fill="none" stroke-linecap="round"${st.flicker?' class="tp-flicker"':''}/>`;
 if(st.core)svg+=`<path d="${d}" stroke="${st.core.colour}" stroke-width="${Math.max(.8,st.core.width*.4).toFixed(1)}" fill="none" stroke-linecap="round"${st.flicker?' class="tp-flicker"':''}/>`;
 if(st.sparkle)svg+=[.5,.6,.68,.76,.83,.9].map((t,k)=>{const p=onArc(t);return `<circle cx="${p.x.toFixed(1)}" cy="${(p.y+(k%2?2:-2)).toFixed(1)}" r="1.3" fill="${st.sparkle.colour}" class="tp-twinkle${st.sparkle.fall?' tp-fall':''}" style="animation-delay:${(k*.2).toFixed(1)}s"/>`;}).join('');
 svg+='<circle cx="97" cy="17" r="2.4" fill="#fbfaf2"/>';
 return `<svg class="tracer-preview" viewBox="0 0 100 30" aria-hidden="true">${svg}</svg>`;
}
// THE FLOURISHES, AND WHEN EACH PLAYS (the owner asked where to find them, 15
// October 2026). Visual only; once earned they play by themselves, the rarest
// that fits the hole.
const FLOURISH_WHEN={'sparkle-par':'When you make a par','confetti-birdie':'When you make a birdie','fireworks-eagle':'When you make an eagle or better','ring-chip-in':'When you chip in for par or better','fireworks-birdie':'Every birdie, in place of the confetti','lantern-ace':'When you make a hole in one','gold-flourishes':'Every flourish you have, in gold'};
// A small padlock on what is not earned yet; its colours still show.
const LOCK='<svg class="look-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/></svg>';
function lookPicker(profile){
 const look=looksOf(profile),lv=look.level,tab=k=>`<button class="panel-tab${lookTab===k?' active':''}" role="tab" aria-selected="${lookTab===k}" data-look-tab="${k}">${({ball:'Ball',tracer:'Tracer',title:'Title',frame:'Frame',skin:'Meter',flourish:'Flourishes'})[k]}</button>`;
 const item=(r,inner,kind=r.kind)=>{const has=r.level<=lv,on=look[kind]===r.id;
  return `<button class="look-item${on?' on':''}${has?'':' locked'}" ${has?`data-wear="${kind}:${r.id}"`:'disabled'} aria-pressed="${on}" title="${has?escape(r.name):`${escape(r.name)}: level ${r.level}`}">${has?'':LOCK}${inner}<span>${escape(r.name)}</span>${has?'':`<small>Level ${r.level}</small>`}</button>`;};
 let body;
 if(lookTab==='tracer')body=`<div class="look-grid">${rewardsOf('tracer').map(r=>item(r,tracerPreview(r.id))).join('')}</div><p class="research-label">Your shots fly in your tracer, and at the end of a hole your lines are drawn in it too.</p>`;
 else if(lookTab==='frame')body=`<div class="look-grid balls">${rewardsOf('frame').map(r=>item(r,framedPicture(look.ball,r.id))).join('')}</div><p class="research-label">Plain colours from the start, a frame with every badge, and moving ones further up. Until you choose one, you wear your newest badge's.</p>`;
 else if(lookTab==='flourish')body=`<canvas class="flourish-preview" id="flourishPreview" aria-hidden="true"></canvas><div class="look-grid flourishes">${rewardsOf('flourish').filter(r=>!SECRET_FLOURISHES.has(r.id)||profile.achievements?.ace).map(r=>{const has=r.level<=lv;return `<button class="look-item${has?' on':' locked'}" data-flourish-preview="${r.id}" title="Watch it">${has?'':LOCK}<b>${escape(r.name)}</b><span>${escape(FLOURISH_WHEN[r.id]||'')}</span><small>${has?'Earned · tap to watch':`Level ${r.level} · tap to watch`}</small></button>`;}).join('')}</div><p class="research-label">Flourishes play over the cup when you hole out, once earned -- the rarest that fits the hole. They make no sound.</p>`;
 else if(lookTab==='skin')body=`<div class="look-grid">${rewardsOf('skin').map(r=>{const s=METER_SKINS[r.id];return item(r,`<i class="skin-swatch" style="--sm-track:${s.track};--sm-edge:${s.edge};--sm-zone:${s.zone};--sm-perfect:${s.perfect};--sm-target:${s.target}"><b class="z"></b><b class="p"></b><b class="t"></b></i>`);}).join('')}</div><p class="research-label">The Swing Meter's look on your turns. The zones and the timing are the same in every skin.</p>`;
 else if(lookTab==='title'){const titles=rewardsOf('title'),earned=profile.achievements||{};
  const opt=(r,has,why)=>`<option value="${r.id}" ${has?'':'disabled'} ${look.title===r.id?'selected':''}>${escape(r.name)}${has?'':` (${why})`}</option>`;
  body=`<label class="field">Title, under your name<select id="wearTitle"><option value="">None</option><optgroup label="From levels">${titles.map(r=>opt(r,r.level<=lv,`level ${r.level}`)).join('')}</optgroup><optgroup label="From achievements">${ACHIEVEMENT_TITLES.map(r=>opt(r,!!earned[r.achievement],achievement(r.achievement).name)).join('')}</optgroup></select></label>`;}
 else body=`<div class="look-grid balls">${rewardsOf('ball').map(r=>item(r,`<img class="ball-avatar" src="${ballPicture(r.id)}" alt="">`)).join('')}</div>`;
 return `<h3>Your look</h3><div class="panel-tabs look-tabs" role="tablist" aria-label="Your look">${[...WEARABLE,'flourish'].map(tab).join('')}</div>${body}`;
}
// THE ACHIEVEMENTS (Phase 7): every one, earned or not, with what it takes,
// its XP, its title, and how far along a counted one is.
function achievementList(profile){
 const e=profile.achievements||{};
 const row=a=>{const at=e[a.id],p=progressOf(a,profile);
  return `<li class="achievement${at?' earned':''}"><b>${escape(a.name)}</b><span>${escape(a.how)}${a.title?` Title: <i>${escape(a.title)}</i>.`:''}</span><small>${at?`Earned ${profileWhen(at)}`:p?`${Math.min(p[0],p[1])} of ${p[1]}`:''} · ${a.xp} XP</small>${!at&&p?`<i class="level-bar"><b style="width:${Math.round(Math.min(1,p[0]/p[1])*100)}%"></b></i>`:''}</li>`;};
 return `<h3>Achievements <small>${Object.keys(e).length} of ${ACHIEVEMENTS.length}</small></h3><ul class="achievement-list">${ACHIEVEMENTS.map(row).join('')}</ul>`;
}
function renderProfile(content){
 if(!profiles){content.innerHTML='<p>Nobody has signed the card yet.</p><button class="primary" id="profileStart">Enter your name</button>';$('profileStart').onclick=()=>{closePanel();showWelcome();};return;}
 const profile=findProfile(profiles,viewingProfile)||mainProfile(profiles),isMain=profile.id===profiles.main;
 viewingProfile=profile.id;
 const s=profileSummary(profile),h=s.handicap,c=s.counters;
 const hcpNote=h.index===null?`${h.needed} more finished 9 or 18 hole round${h.needed===1?'':'s'} to get one.`
  :`From ${h.rounds} round${h.rounds===1?'':'s'}: the best ${h.counted} of the last ${Math.min(20,h.rounds)}.`;
 const num=v=>v.toLocaleString(undefined,{maximumFractionDigits:1});
 const tile=(label,value,help)=>`<div class="stat-tile"${help?` title="${escape(help)}"`:''}><strong>${value}</strong><span>${escape(label)}</span></div>`;
 const counters=COUNTERS.map(k=>tile(k.label,`${num((c[k.key]||0)*(k.scale||1))}${k.unit?` <small>${k.unit}</small>`:''}`,k.help)).join('');
 const bests=BESTS.map(k=>tile(k.label,s.bests[k.key]?`${num(s.bests[k.key])} <small>${k.unit}</small>`:'—',k.help)).join('');
 const most=Math.max(1,...Object.values(s.types));
 const types=SCORE_TYPES.map(t=>`<div class="score-type"><span>${t.label}</span><i style="--w:${(s.types[t.key]/most*100).toFixed(1)}%"></i><strong>${s.types[t.key]}</strong></div>`).join('');
 const avg=v=>v===null?'—':v.toFixed(2);
 const best=b=>b?`${scoreText(b.t.score)} <small>${toParText(b.t.rel)}</small>`:'—';
 // Main first, then everyone else in the order they joined.
 const everyone=[mainProfile(profiles),...profiles.profiles.filter(p=>p.id!==profiles.main)];
 const strip=everyone.length>1?`<div class="panel-tabs profile-switch" role="tablist" aria-label="Players">${everyone.map(p=>
  `<button class="panel-tab${p.id===profile.id?' active':''}" role="tab" aria-selected="${p.id===profile.id}" data-view-profile="${p.id}">${ballAvatar(p,'tiny')}${escape(p.name)}${p.id===profiles.main?' <small>main</small>':''}</button>`).join('')}</div>`:'';
 const head=renamingProfile
  ?`<div class="profile-rename"><label class="field">Name<input id="profileNameInput" maxlength="${MAX_PLAYER_NAME}" value="${escape(profile.name)}"></label><div class="course-card-actions"><button class="secondary" id="profileNameSave">Save name</button><button class="secondary" id="profileNameCancel">Cancel</button></div><p class="field-error" id="profileError"></p></div>`
  :`<div class="profile-id">${ballAvatar(profile,'profile-avatar')}<div><h3>${escape(profile.name)}${isMain?' <em class="profile-tag counts">Main profile</em>':''}</h3>${(t=>t?`<em class="golfer-title">${escape(t)}</em>`:'')(titleName(looksOf(profile).title))}<small>Playing since ${profileWhen(profile.created)} · ${s.roundsPlayed} round${s.roundsPlayed===1?'':'s'} · ${s.holes} hole${s.holes===1?'':'s'}</small>`
   +`<div class="profile-actions">${isMain?'':`<button class="secondary" id="profileMakeMain">Make main profile</button><button class="secondary" id="profileDelete">Remove ${escape(profile.name)}</button>`}</div><p class="field-error" id="profileError"></p></div>`
   +`<button class="small-icon" id="profileRename" aria-label="Change ${escape(profile.name)}'s name" title="Change the name"><i data-lucide="pencil"></i></button></div>`;
 const lv=levelOf(profile.xp);
 // The note is shown once per golfer (the owner's call: no XP back-fill).
 const xpNote=!!profile.xpNew;if(xpNote){delete profile.xpNew;storeProfiles(profiles);}
 content.innerHTML=`<div class="profile">${strip}`
  +(xpNote?`<p class="note xp-new"><b>New: XP and levels.</b> ${XP_NEW_TEXT}</p>`:'')
  +`<div class="profile-head">${head}<div class="profile-level"><small>LEVEL · ${escape(badgeName(lv.level).toUpperCase())}</small><strong>${lv.level}</strong><span>${lv.into.toLocaleString()} of ${lv.need.toLocaleString()} XP to level ${lv.level+1}</span><i class="level-bar"><b style="width:${Math.round(lv.into/lv.need*100)}%"></b></i></div><div class="profile-hcp"><small>SIM HANDICAP</small><strong>${hcpText(h.index)}</strong><span>${hcpNote}</span></div></div>`
  +lookPicker(profile)+achievementList(profile)+challengeRecords(profile)
  +`<h3>Overall</h3><div class="stat-grid">${counters}${bests}</div>`
  +`<h3>Scoring</h3><div class="profile-scoring"><div class="score-types">${types}</div><div class="stat-grid compact">`
  +tile('Par 3 average',avg(s.scoringAverage[3]))+tile('Par 4 average',avg(s.scoringAverage[4]))+tile('Par 5 average',avg(s.scoringAverage[5]))
  +tile('Putts per hole',avg(s.puttsPerHole),'Putts struck plus putts awarded, per hole.')+tile('Fairways hit',pct(s.fairways),'Tee shots on par 4s and 5s that finished on the fairway.')+tile('Greens in regulation',pct(s.greens),'On the green in par minus two strokes or fewer.')
  +tile('Best 9',best(s.best9),s.best9?s.best9.r.course?.name:'')+tile('Best 18',best(s.best18),s.best18?s.best18.r.course?.name:'')+`</div></div>`
  +`<h3>Bag</h3><div class="profile-bag">${bagClubsSafe(profile).map(c=>`<span>${escape(c.label)} <b>${c.carry}</b></span>`).join('')}</div><div class="profile-actions"><button class="secondary" id="profileBag"><i data-lucide="briefcase"></i> Edit ${escape(profile.name)}'s bag</button></div>`
  +`<h3>Round history</h3>${s.history.length?`<div class="course-list">${s.history.map(profileCard).join('')}</div>`:'<p class="note">No rounds yet. Finish a hole and the round shows up here, with a button to play the same course again.</p>'}`
  +`<h3>Back up &amp; move</h3><p class="note">Players live in this browser on this device, and the game opened from the download, from the server and on a phone each keep their own. A backup file holds everyone; restoring it adds to the players already here and never removes any.</p>`
  +`<div class="profile-actions profile-backup"><button class="secondary" id="profilesExport"><i data-lucide="download"></i> Save a backup file</button><button class="secondary" id="profilesImport"><i data-lucide="upload"></i> Restore from a backup</button></div><p class="field-error" id="backupError"></p>`
  +`<p class="research-label">Every golfer in a group is a profile, picked in the group setup; a new player gets one the moment they join. The sim handicap follows the World Handicap System: every finished 9 or 18 hole round becomes a score differential, holes are capped at net double bogey, and the index is the average of the best 8 of the last 20. Fairway's courses have never been rated, so each is rated from its length alone, the way the USGA's yardage formula rates a course; its hazards, slopes and greens are not counted. Scramble scores belong to the team and stay out of the totals. Profiles live in this browser on this device.</p>`
  +`</div>`;
 icon();
 const fail=e=>{const el=$('profileError');if(el)el.textContent=e.message;};
 $('profilesExport').onclick=()=>{try{download('fairway-players.json',exportProfiles(profiles),'application/json');toast(`Saved ${profiles.profiles.length} player${profiles.profiles.length===1?'':'s'} to a backup file.`);}catch(e){fail(e);}};
 $('profilesImport').onclick=()=>pickBackup(r=>{viewingProfile=profiles.main;openPanel('profile');toast(restoreSummary(r));},e=>{const el=$('backupError');if(el)el.textContent=e.message;});
 content.querySelectorAll('[data-view-profile]').forEach(b=>b.onclick=()=>{viewingProfile=b.dataset.viewProfile;renamingProfile=false;openPanel('profile');});
 // Putting on a ball, a tracer or a title: saved to the golfer, and on the
 // course at once if they are up.
 content.querySelectorAll('[data-wear]').forEach(b=>b.onclick=()=>{
  const [kind,item]=b.dataset.wear.split(':');
  try{setProfileWorn(profiles,profile.id,kind,item,levelOf(profile.xp).level);}catch(e){fail(e);return;}
  lookTab=kind;if(course&&round)updateHUD();openPanel('profile');
 });
 if($('wearTitle'))$('wearTitle').onchange=e=>{try{setProfileWorn(profiles,profile.id,'title',e.target.value,levelOf(profile.xp).level);}catch(err){fail(err);return;}if(course&&round)updateHUD();openPanel('profile');};
 content.querySelectorAll('[data-look-tab]').forEach(b=>b.onclick=()=>{lookTab=b.dataset.lookTab;openPanel('profile');});
 // "Everything in gold" previews the birdie's confetti, in gold.
 content.querySelectorAll('[data-flourish-preview]').forEach(b=>b.onclick=()=>{const c=$('flourishPreview'),id=b.dataset.flourishPreview,gold=id==='gold-flourishes';if(c){c.hidden=false;playFlourish(c,gold?'confetti-birdie':id,()=>({x:c.clientWidth/2,y:c.clientHeight-18}),{gold});}});
 content.querySelectorAll('[data-replay-course]').forEach(b=>b.onclick=()=>replayFromHistory(profile,b.dataset.replayCourse));
 // Two presses, like removing a player: a round's scores cannot be put back.
 content.querySelectorAll('[data-remove-round]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.removeRound;
  if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Remove from history? Press again';return;}
  removeRound(profile,id);storeProfiles(profiles);profileSynced='';updateMenuProfile();openPanel('profile');
  toast(`Round removed from ${profile.name}'s history. Its scores no longer count toward the sim handicap.`);
 });
 if($('profileBag'))$('profileBag').onclick=()=>{bagOwner=profile.id;bagReturn='profile';openSheet('bag');};
 if($('profileRename'))$('profileRename').onclick=()=>{renamingProfile=true;openPanel('profile');};
 if($('profileNameCancel'))$('profileNameCancel').onclick=()=>{renamingProfile=false;openPanel('profile');};
 if($('profileMakeMain'))$('profileMakeMain').onclick=()=>{setMainProfile(profiles,profile.id);useMainProfile();updateMenuProfile();openPanel('profile');toast(`${profile.name} is the main profile now.`);};
 // Two presses, the way deleting a course asks: a profile's history cannot be
 // brought back.
 if($('profileDelete'))$('profileDelete').onclick=()=>{
  const el=$('profileDelete');
  if(el.dataset.armed!==profile.id){el.dataset.armed=profile.id;el.textContent=`Remove ${profile.name} and their history? Press again`;return;}
  try{deleteProfile(profiles,profile.id);viewingProfile=profiles.main;openPanel('profile');toast(`${profile.name} has been removed from this device.`);}catch(e){fail(e);}
 };
 if($('profileNameSave')){
  const commit=()=>{try{const before=profile.name;renameProfile(profiles,profile.id,$('profileNameInput').value);followRename(profile,before);renamingProfile=false;openPanel('profile');toast(`${before} is ${profile.name} now.`);}catch(e){fail(e);}};
  $('profileNameSave').onclick=commit;
  requestAnimationFrame(()=>{const el=$('profileNameInput');if(el){el.focus();el.select();}});
  $('profileNameInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape'){renamingProfile=false;openPanel('profile');}};
 }
}
// A RENAMED PROFILE IS RENAMED EVERYWHERE IT IS PLAYING: in the round on screen,
// in a round waiting behind Continue, and in an open group editor. A golfer is
// that profile by id, or -- in a save from before ids -- by the old name.
function followRename(profile,from){
 const mine=p=>p.profile===profile.id||(!p.profile&&sameGolfer(p.name,from));
 for(const r of [round,pendingRound])if(r)for(const p of r.players)if(mine(p)){p.name=profile.name;p.profile=profile.id;}
 if(groupDraft)for(const p of groupDraft)if(p.profile===profile.id)p.name=profile.name;
 useMainProfile();profileSynced='';updateMenuProfile();
}
// The tile says which week, which landscape, and the main golfer's best on it.
// The challenges tile says how many there are and the main golfer's medals.
function updateMenuChallenges(){
 const el=$('menuChallengesNote');if(!el)return;
 const m=mainProfile(profiles)?.medals||{},have=Object.values(m).reduce((a,b)=>a+b,0);
 el.textContent=`This week: ${challengeDef(weeklyChallenge().id).name} · ${have} of ${MEDAL_TOTAL} medals`;
}
function updateMenuWeekly(){
 updateMenuChallenges();
 const el=$('menuWeeklyNote');if(!el)return;
 const w=isoWeek(),s=weeklySettings(),best=mainProfile(profiles)?.weekly?.[weekKey()];
 el.textContent=`Week ${w.week} · ${BIOMES[s.biome]?.name||s.biome} · stroke play${best?` · your best ${best}`:''}`;
}
function updateMenuProfile(){
 updateMenuWeekly();
 const note=$('menuProfileNote'),m=mainProfile(profiles);if(!note)return;
 if(!m){note.textContent='Stats, rounds, handicap';return;}
 const h=profileSummary(m).handicap,others=profiles.profiles.length-1;
 note.textContent=(h.index===null?`${m.name} · stats and rounds`:`${m.name} · sim handicap ${hcpText(h.index)}`)+(others?` · +${others} player${others===1?'':'s'}`:'');
}
// "REPLAY THIS COURSE": the same ground, a fresh card. A course comes back from
// the settings it was grown from, an endless run from its seed; the group and
// the format are whatever is set up now, the same as playing a saved course.
function replayFromHistory(profile,id){
 const e=profile?.rounds.find(r=>r.id===id);if(!e)return;
 if(flight){toast('Finish the current shot first.');return;}
 const name=e.course?.name||'that course';
 if(e.endless){
  if(!e.course?.seed){toast('That run did not keep its seed, so it cannot be grown again.');return;}
  startEndless({players:round.players,tee:e.tee||round.tee},e.course.seed).then(()=>toast(`Replaying “${name}”.`));
  return;
 }
 let grown;
 try{grown=courseSettings(validateSettings(migrateSettings(e.course?.settings||{},e.course?.schema||SCHEMA_VERSION)));}
 catch{toast('That course cannot be rebuilt by this version of Fairway.');return;}
 startRoundOn(grown,{players:round.players,mode:round.mode,tee:e.tee||round.tee},name).then(()=>toast(`Replaying “${name}”.`));
}
// RESTORING A BACKUP. One hidden file input serves the profile page and the
// welcome; `importProfiles` does the merging and says what it did.
function pickBackup(done,failed){
 const input=$('profilesFile');input.value='';
 input.onchange=async()=>{
  const file=input.files?.[0];if(!file)return;
  try{
   const placeholder=Round.defaultPlayer.name,r=importProfiles(profiles,await file.text());
   const hadMain=!!mainProfile(profiles);profiles=r.store;
   // On a first visit the placeholder golfer becomes the restored main
   // profile, exactly as a typed name would have.
   if(!hadMain){const m=mainProfile(profiles);for(const g of [round,pendingRound])if(g)for(const p of g.players)if(!p.profile&&sameGolfer(p.name,placeholder)){p.name=m.name;p.profile=m.id;}}
   useMainProfile();updateMenuProfile();profileSynced='';done(r);
  }catch(e){failed(e);}
 };
 input.click();
}
const restoreSummary=r=>{
 const parts=[];
 if(r.added.length)parts.push(`added ${r.added.join(', ')}`);
 if(r.updated.length)parts.push(`brought ${r.updated.join(', ')} up to date`);
 if(r.kept.length)parts.push(`kept the newer ${r.kept.join(', ')} already here`);
 return parts.length?`Restored: ${parts.join('; ')}.`:'Nothing new in that backup.';
};
// THE FIRST-LOAD WELCOME. Shown whenever this browser has no profiles, over the
// menu, and gone only once a name has been given. That first name is the main
// profile, and it takes over the placeholder golfer every round starts with.
function showWelcome(){
 const box=$('welcome');box.hidden=false;$('welcomeError').textContent='';
 requestAnimationFrame(()=>$('welcomeName').focus());
 $('welcomeRestore').onclick=()=>pickBackup(r=>{box.hidden=true;toast(restoreSummary(r));$('menuPlay').focus();},e=>{$('welcomeError').textContent=e.message;});
 $('welcomeForm').onsubmit=e=>{
  e.preventDefault();
  try{
   const placeholder=Round.defaultPlayer.name,made=addProfile(profiles,$('welcomeName').value);
   profiles=made.store;
   for(const r of [round,pendingRound])if(r)for(const p of r.players)if(!p.profile&&sameGolfer(p.name,placeholder)){p.name=made.profile.name;p.profile=made.profile.id;}
   useMainProfile();updateMenuProfile();
   box.hidden=true;
   toast(`Welcome, ${made.profile.name}. Your stats start with your next shot.`);
   $('menuContinue').hidden?$('menuPlay').focus():$('menuContinue').focus();
  }catch(err){$('welcomeError').textContent=err.message;}
 };
}
function renderPanel(name,content){
 if(name==='profile'){renderProfile(content);return;}
 if(name==='challenge'){renderChallengeResult(content);return;}
 if(name==='library'){
  // The box is pre-filled with the name this course is ALREADY going by on the
  // card, so saving it keeps calling it the same thing. It used to offer the
  // biome's own title -- every midwest course anybody built was "Prairie Run".
  const courses=listCourses(),suggestion=playingCourseName(),savable=savableCourse();
  // A card in its normal state, or as an edit row while it is being renamed.
  // Renaming re-renders the panel rather than mutating the card in place, which
  // is how every other list action here works; the tab you were on is kept.
  const card=c=>renamingCourse===c.id
   ?`<div class="course-card"><label class="field course-rename">Rename this course<input id="renameCourseInput" maxlength="${MAX_NAME}" value="${escape(c.name)}"></label><div class="course-actions"><button class="secondary" data-rename-save="${c.id}">Save name</button><button class="secondary" data-rename-cancel="1">Cancel</button></div></div>`
   :`<div class="course-card"><div class="course-meta"><strong>${escape(c.name)}</strong><span>${c.settings.holes} holes · ${escape(BIOMES[c.settings.biome]?.name||c.settings.biome)} · ${Math.round(c.settings.courseYards)} yd · seed ${escape(c.settings.seed)}</span>${c.generator!==GENERATOR_VERSION?'<em class="course-flag">Built by a different generator — its landscape may not match how it was designed.</em>':''}</div><div class="course-actions"><button data-play="${c.id}">Play</button><button data-rename="${c.id}">Rename</button><button data-share="${c.id}">Get code</button><button data-remove="${c.id}">Delete</button></div></div>`;
  content.innerHTML=`<p>Save a landscape you like, then play it again later or pass it to someone else. A course keeps its landscape only — players, format and tees are chosen when you play, so the same course suits any group.</p>
  <p class="field-error" id="libraryError"></p>
  <h3>Your courses</h3>
  ${courses.length?`<div class="course-list">${courses.map(card).join('')}</div>`:'<p class="note">Nothing saved yet. Shape one in Course studio, or import a code or a file.</p>'}
  <label class="field" id="shareBlock" hidden>Share this code<textarea id="shareCode" rows="3" readonly></textarea></label>
  <h3>Save a course</h3>
  ${savable.why
   ?`<p class="note">${savable.why}</p>${appMode==='play'||appMode==='menu'?'<button class="secondary" id="libraryStudio"><i data-lucide="mountain"></i> Open Course studio</button>':''}`
   :`<label class="field">Name this course<input id="courseName" maxlength="${MAX_NAME}" value="${escape(suggestion)}"></label>
  <button class="primary" id="saveCourse"><i data-lucide="bookmark"></i> ${savable.label}</button>`}
  <h3>Import &amp; export</h3>
  <div class="code-import">
   <label class="field">Course code<textarea id="courseCode" rows="3" placeholder="FW1.…"></textarea></label>
   <button class="secondary" id="importCourseCode">Import this code</button>
  </div>
  <p class="note">A code is one course as text — short enough to paste into a message. A file is your whole library at once, which is what you want for a backup or a move to another machine.</p>
  <button class="secondary" id="exportCourses"><i data-lucide="download"></i> Export every course to a file</button>
  <button class="secondary" id="importCourses"><i data-lucide="upload"></i> Import courses from a file</button>
  <input id="courseFile" type="file" accept="application/json" hidden>`;
  const fail=e=>{$('libraryError').textContent=e.message;};
  if($('saveCourse'))$('saveCourse').onclick=()=>{try{$('libraryError').textContent='';const rec=saveCourse({name:$('courseName').value,settings});openPanel('library');toast(`Saved “${rec.name}” to your library.`);}catch(e){fail(e);}};
  if($('libraryStudio'))$('libraryStudio').onclick=()=>{closePanel();openStudioSetup();};
  // Renaming. The input is focused and selected because the only reason to be
  // here is to replace what is in it.
  content.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>{renamingCourse=b.dataset.rename;openPanel('library');});
  content.querySelectorAll('[data-rename-cancel]').forEach(b=>b.onclick=()=>{renamingCourse=null;openPanel('library');});
  content.querySelectorAll('[data-rename-save]').forEach(b=>b.onclick=()=>{
   try{renameCourse(b.dataset.renameSave,$('renameCourseInput').value);renamingCourse=null;openPanel('library');toast('Course renamed.');}
   catch(e){fail(e);}
  });
  // FOCUS AFTER LAYOUT, not here. `groupPanelContent` runs once this render
  // returns and rebuilds the panel by emptying the root and re-appending its
  // sections -- which blurs whatever was focused, so focusing now does nothing.
  if($('renameCourseInput')){requestAnimationFrame(()=>{const el=$('renameCourseInput');if(el){el.focus();el.select();}});
   $('renameCourseInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();content.querySelector('[data-rename-save]')?.click();}if(e.key==='Escape'){renamingCourse=null;openPanel('library');}};}
  $('importCourseCode').onclick=()=>{try{$('libraryError').textContent='';const rec=importCourse($('courseCode').value);const saved=saveCourse(rec);openPanel('library');toast(`Imported “${saved.name}”.`);}catch(e){fail(e);}};
  content.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{deleteCourse(b.dataset.remove);openPanel('library');toast('Course deleted.');});
  content.querySelectorAll('[data-share]').forEach(b=>b.onclick=async()=>{const c=findCourse(b.dataset.share);if(!c)return;const code=exportCourse(c);$('shareBlock').hidden=false;$('shareCode').value=code;$('shareCode').focus();$('shareCode').select();if(await copyText(code))toast('Course code copied.');else toast('Course code ready — copy it from the box.');});
  content.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>{
   const c=findCourse(b.dataset.play);if(!c)return;
   if(flight){toast('Finish the current shot first.');return;}
   startRoundOn(c.settings,{players:round.players,mode:round.mode,tee:round.tee},c.name).then(()=>toast(`Now playing “${c.name}”.`));
  });
  // THE WHOLE LIBRARY, as one file. Codes move a course between people; a file
  // moves a collection between machines, which is the backup case codes are a
  // bad fit for -- one code per course, pasted one at a time.
  $('exportCourses').onclick=()=>{
   const all=listCourses();
   if(!all.length){fail(Error('There are no saved courses to export.'));return;}
   download('fairway-courses.json',JSON.stringify({kind:'fairway-courses',version:1,generator:GENERATOR_VERSION,courses:all},null,2),'application/json');
   toast(`Exported ${all.length} course${all.length===1?'':'s'}.`);
  };
  $('importCourses').onclick=()=>$('courseFile').click();
  $('courseFile').onchange=async()=>{
   try{
    $('libraryError').textContent='';
    const f=$('courseFile').files[0];
    if(!f||f.size>2000000)throw Error('Choose a Fairway course file smaller than 2 MB.');
    const d=JSON.parse(await f.text());
    const list=Array.isArray(d)?d:Array.isArray(d?.courses)?d.courses:null;
    if(!list)throw Error('That file does not hold Fairway courses.');
    // ADDED, never replacing. An import that wiped the library would be an
    // unrecoverable mistake made with one click on the wrong file.
    //
    // But additive alone meant re-importing the same backup doubled the library,
    // with no rename to sort it out afterwards. A course whose NAME and
    // GENERATION SETTINGS both already match one you have is the same course, so
    // it is counted and skipped. Settings rather than id: an exported course
    // that has been round-tripped or shared has a different id and is still the
    // same landscape. Name too, because the same landscape saved twice under two
    // names is two courses as far as the player is concerned.
    // One string per course, name and landscape together. A JSON array rather
     // than a joined string so no separator has to be chosen that a course name
     // could never contain -- names are free text.
    const key=(name,settings)=>JSON.stringify([String(name).trim(),courseSettings(validateSettings(settings))]);
    const have=new Set(listCourses().map(c=>key(c.name,c.settings)));
    let added=0,skipped=0,already=0;
    for(const c of list){
     try{
      // Checked BEFORE saving, not saved and un-saved: a duplicate must not
      // spend a slot against the 200-course cap on its way to being removed.
      // `validateSettings` throwing here is the same "cannot be read" case the
      // save itself would have raised.
      const k=key(c?.name,c?.settings||{});
      if(have.has(k)){already++;continue;}
      saveCourse({name:c?.name,settings:c?.settings,generator:c?.generator});
      have.add(k);added++;
     }
     catch{skipped++;}
    }
    if(!added&&!already)throw Error('No course in that file could be read.');
    openPanel('library');
    // "Imported 0 courses; 1 you already had" is a sentence about nothing. When
    // the file brought nothing new, say that instead of counting to zero.
    toast(added
     ?`Imported ${added} course${added===1?'':'s'}${already?`; ${already} you already had`:''}${skipped?`; ${skipped} could not be read`:''}.`
     :`Nothing new — you already have ${already===1?'that course':`all ${already} of those courses`}${skipped?`; ${skipped} could not be read`:''}.`);
   }catch(e){fail(e);}
   finally{$('courseFile').value='';}
  };
 }else if(['bag','flight','putting','shotdata'].includes(name)){openPlaySettings(name,content);
 }else if(name==='course'){
  studioBiome=settings.biome;
  // The whole studio panel is rendered from the schema: groups, order, labels,
  // bounds, units and help text. Only the handful of controls that are not a
  // plain slider are written out by hand.
  const hint=k=>`<button type="button" class="hint" data-tip="${k}" aria-expanded="false" aria-controls="tip-${k}" aria-label="What ${FIELD[k].label} changes">i</button>`;
  const tip=k=>`<p class="tip" id="tip-${k}" hidden>${escape(FIELD[k].tip)}</p>`;
  // Every kind the schema can hold renders here. Naming one toggle as a special
  // case is how `residentialOB` shipped as a 0-100 slider that nothing read.
  // `short` is the label to SHOW when the control sits in a box that already
  // names the thing -- "Frequency" under a box headed Ponds rather than "Pond
  // frequency". It is display only: `f.label` stays the accessible name on both
  // the range input and the `i` button, because "What Frequency changes" and a
  // slider announced as "Minimum" are no use to anyone reading by ear.
  //
  // Passed in rather than read off the field, so a short label can only ever
  // appear underneath a heading that supplies its missing noun. Move a field
  // out of its box and it goes back to saying what it is.
  const control=(k,short)=>{const f=FIELD[k],text=short&&f.short?f.short:f.label;
   if(f.kind==='toggle')return `<label class="toggle"><input id="${k}" type="checkbox" ${settings[k]?'checked':''}> ${text}</label>${hint(k)}`;
   // A choice is a list, not a slider. Without this branch a choice field with no
   // bespoke renderer above fell through to the range control below and came out
   // as a slider with no min, no max and a word where its value should be.
   if(f.kind==='choice')return `<label class="field">${text}${hint(k)}<select id="${k}">${f.options.map(o=>`<option value="${o}" ${String(settings[k])===String(o)?'selected':''}>${o}</option>`).join('')}</select></label>`;
   // A field with `warn` in the schema turns red past its threshold, and says
   // why in a bubble that pops out over the panel when the slider is let go
   // (wired below, after the panel is drawn). Opening the panel on a value
   // already past it shows the red alone.
   const warned=f.warn&&settings[k]>f.warn.above;
   return `<label class="field${f.warn?' warns':''}${warned?' danger':''}">${text}${hint(k)}<output id="${k}Value">${settings[k]}${f.unit||''}</output><input type="range" id="${k}" aria-label="${f.label}" min="${bound(f.min,settings)}" max="${bound(f.max,settings)}" value="${settings[k]}" step="${f.step||1}" data-unit="${f.unit||''}">${f.warn?`<span class="warn-note" id="warn-${k}" role="status" hidden>${escape(f.warn.text)}</span>`:''}</label>`;};
  const holes=settings.holes===18?18:9;
  const custom={
   holes:()=>`<label class="field">${FIELD.holes.label}${hint('holes')}<select id="courseHoles"><option value="9" ${holes===9?'selected':''}>9 holes</option><option value="18" ${holes===18?'selected':''}>18 holes</option></select></label>`,
   // ONE BOX. The slider set a number, a second field set the same number
   // again, and a third element reported what that number produced -- three
   // controls for one decision, with the answer furthest from the hand that
   // was moving. Length, exact yardage and the card it makes are one group
   // now, and the card is the whole card rather than a par count.
   courseYards:()=>`<div class="course-plan" id="coursePlan" aria-live="polite">
    <div class="plan-summary" id="planSummary"></div>
    <label class="field plan-slider">${FIELD.courseYards.label}${hint('courseYards')}<output id="courseYardsValue">${settings.courseYards} yd</output><input type="range" id="courseYards" aria-label="${FIELD.courseYards.label}" min="${holes*110}" max="${holes*470}" value="${settings.courseYards}" step="10" data-unit=" yd"></label>
    <label class="field plan-exact">Exact yardage<input type="number" id="courseYardsNumber" min="${holes*110}" max="${holes*470}" step="10" value="${settings.courseYards}"></label>
    <div class="plan-card-wrap"><table class="plan-card" id="planCard"></table></div>
   </div>`,
   seed:()=>`<label class="field">${FIELD.seed.label}${hint('seed')}<input id="seed" maxlength="50" value="${escape(settings.seed)}"></label><button class="secondary field-action" id="randomSeed"><i data-lucide="shuffle"></i> Surprise me</button>`,
   biome:()=>`<p class="control-label">${FIELD.biome.label}${hint('biome')}</p><div class="option-grid">${Object.entries(BIOMES).map(([key,b])=>`<button class="option ${studioBiome===key?'active':''}" data-biome="${key}"><span class="swatch" style="--swatch:${b.rough}"></span>${b.name}</button>`).join('')}</div>`,
   footprint:()=>`<label class="field">${FIELD.footprint.label}${hint('footprint')}<select id="footprint">${Object.entries(FOOTPRINTS).map(([v,label])=>`<option value="${v}" ${settings.footprint===v?'selected':''}>${label}</option>`).join('')}</select></label><div class="footprint-icons">${Object.entries(FOOTPRINTS).map(([key,label])=>`<button type="button" data-footprint="${key}" aria-label="${label} layout" aria-pressed="${settings.footprint===key}" title="${label}">${footprintIcon(key)}<span>${label}</span></button>`).join('')}</div>`,
  };
  // FIELDS THAT ARE ONE DECISION GO IN ONE BOX. The panel renders a card per
  // schema entry, which is right for most of them and wrong wherever a control
  // means nothing without its neighbours: a house setback is not something you
  // reason about with the houses toggle three cards away, and a wind speed
  // without its direction is half a sentence.
  //
  // Declared here rather than as a `group` key on the schema. Grouping is a
  // fact about THIS PANEL's layout; the schema is also read by validation,
  // migration, the world rebuild key and the save format, and none of those
  // care how the controls are boxed.
  // THIS PANEL HAS NO REGENERATE OF ITS OWN. It used to end with one, emitted
  // after every category -- which put it in whichever section came last, so it
  // turned up at the bottom of the Weather tab looking like a weather control.
  // It called `regenerateStudio()`, which is exactly what the studio bar's own
  // Regenerate already calls, and the bar is on screen whenever this panel can
  // be opened: both ways in here are studio-only, `enterStudio` and the bar's
  // own Settings button. So it was a duplicate in the wrong place.
  //
  // What is left is one verb each way round. "Grow this landscape" STARTS a
  // studio and only appears during setup, pinned to the panel's lead by
  // `data-panel-action` so it cannot fall into a tab. Once there is a
  // landscape, regenerating it is the bar's job.
  const FIELD_GROUPS=[
   // A label only where the box needs naming. "Houses" earns one: it holds a
   // toggle, two sliders and a second toggle whose labels do not otherwise say
   // they belong together. Wind does not -- a box headed WIND, under a heading
   // already saying Weather, containing "Wind speed" and "Wind direction", says
   // the word four times and adds nothing the fields do not.
   {category:'scenery',label:'Houses',keys:['homes','homeDensity','homeSetback','residentialOB']},
   {category:'weather',keys:['wind','windDirection']},
   // One box per water feature. Two of these boxes hold settings that serve
   // TWO features rather than one, and they are separate for that reason: the
   // depth range is read identically by ponds and by lakes, and the channel
   // depth and meander are read by rivers and creeks alike. Folding either into
   // a feature's own box would say it belonged to that feature, which is the
   // thing this layout is supposed to stop.
   {category:'water',label:'Ponds',keys:['water','pondSize']},
   {category:'water',label:'Lakes',keys:['lakes','lakeSize']},
   {category:'water',label:'Depth of ponds and lakes',keys:['waterMin','waterMax']},
   {category:'water',label:'Rivers',keys:['rivers','riverWidth']},
   {category:'water',label:'Creeks',keys:['creeks','creekWidth']},
   {category:'water',label:'Rivers and creeks shape',keys:['streamDepth','streamBends']},
  ];
  const one=(k,short)=>(custom[k]?custom[k]():control(k,short))+tip(k);
  const group=([key,label,note])=>{
   const boxes=FIELD_GROUPS.filter(g=>g.category===key),taken=new Set(boxes.flatMap(g=>g.keys));
   const body=SETTINGS.filter(f=>f.category===key).map(f=>{
    if(!taken.has(f.key))return one(f.key);
    // A group is drawn at the position of its FIRST member, so the order the
    // schema states is still the order on screen and nothing jumps about.
    const box=boxes.find(g=>g.keys[0]===f.key);
    return box?`<div class="control-group">${box.label?`<p class="group-label">${box.label}</p>`:''}${box.keys.map(k=>one(k,!!box.label)).join('')}</div>`:'';
   }).join('');
   return `<h3>${label}</h3>${note?`<p class="research-label">${note}</p>`:''}${body}`;
  };
  content.innerHTML=`<p>${studioSetup?'Choose the landscape you want, then grow it. Nothing is built until you say so.':'Shape a landscape, then press Regenerate on the bar above to see it. Nothing rebuilds on its own, because a course takes a few seconds to grow.'}</p>${studioSetup?'<button class="primary" data-panel-action id="growStudio"><i data-lucide="mountain"></i> Grow this landscape</button>':''}<div class="split"><button class="secondary" id="openLibrary"><i data-lucide="library"></i> Saved courses</button><button class="secondary" id="toggleTips">Show all descriptions</button></div><p class="field-error" id="studioError"></p>${CATEGORIES.map(group).join('')}`;
  content.querySelectorAll('.hint').forEach(b=>b.onclick=e=>{e.preventDefault();const box=$('tip-'+b.dataset.tip),show=box.hidden;box.hidden=!show;b.setAttribute('aria-expanded',String(show));});
  // Past a field's `warn.above` (the green slope slider, past 75%): red while
  // dragging, then a bubble saying why, and a toast once, when the slider is
  // LET GO. The note used to sit in the field and appear mid-drag: it grew the
  // field, the panel's balanced columns reflowed, and the slider jumped 229 px
  // out from under the cursor (the owner). Shown on release instead, it still
  // reflowed -- the field hopped to another column -- so it floats over the
  // panel now and moves nothing. The colour follows the drag; it changes no
  // size. `change` fires on release for a pointer, and per step for the keys.
  //
  // The bubble covers whatever is under it, so it does not stay: it goes at
  // the next click or tap anywhere, after eight seconds, or when the slider
  // comes back under the line. The red stays as long as the value does.
  for(const f of SETTINGS)if(f.warn&&$(f.key)){
   const el=$(f.key),note=$('warn-'+f.key),field=el.closest('.field');
   let was=Number(el.value)>f.warn.above,timer=null;
   const hide=()=>{note.hidden=true;clearTimeout(timer);document.removeEventListener('pointerdown',away,true);};
   const away=e=>{if(!note.contains(e.target))hide();};
   const show=()=>{
    note.hidden=false;note.classList.remove('above');
    // Below the slider, unless the panel would cut it off there.
    let scroller=document.documentElement;
    for(let n=field.parentElement;n;n=n.parentElement){const o=getComputedStyle(n).overflowY;if(o==='auto'||o==='scroll'){scroller=n;break;}}
    const room=scroller.getBoundingClientRect().bottom-field.getBoundingClientRect().bottom;
    if(room<note.offsetHeight+12)note.classList.add('above');
    clearTimeout(timer);timer=setTimeout(hide,8000);
    // After this pointer's own events, so the release that showed it cannot close it.
    setTimeout(()=>document.addEventListener('pointerdown',away,true),0);
   };
   el.addEventListener('input',()=>field.classList.toggle('danger',Number(el.value)>f.warn.above));
   el.addEventListener('change',()=>{
    const on=Number(el.value)>f.warn.above;
    field.classList.toggle('danger',on);
    if(on)show();else hide();
    if(on&&!was)toast(f.warn.toast);
    was=on;
   });
  }
  let tipsOpen=false;
  $('toggleTips').onclick=()=>{tipsOpen=!tipsOpen;content.querySelectorAll('.tip').forEach(t=>t.hidden=!tipsOpen);content.querySelectorAll('.hint').forEach(b=>b.setAttribute('aria-expanded',String(tipsOpen)));$('toggleTips').textContent=tipsOpen?'Hide all descriptions':'Show all descriptions';};
  $('openLibrary').onclick=()=>openPanel('library');
  // Setup only: apply what was chosen, then build once and enter the studio.
  if(studioSetup)$('growStudio').onclick=()=>{if(!applyStudioSettings())return;studioSetup=false;closePanel();enterStudio();};
  // Any change to a generation control marks the landscape stale; nothing
  // regenerates on its own, because a rebuild is seconds of frozen tab.
  content.addEventListener('input',markStudioDirty);content.addEventListener('change',markStudioDirty);
  document.querySelectorAll('[data-biome]').forEach(b=>b.onclick=()=>{studioBiome=b.dataset.biome;markStudioDirty();document.querySelectorAll('[data-biome]').forEach(x=>x.classList.toggle('active',x===b));});
  // THE CARD BEFORE THE COURSE. `planScorecard` runs the same hole skeleton
  // the builder runs, over the same seeded stream, so every yardage here is
  // the yardage that gets built -- checked to within the rounding.
  const previewPlan=(syncNumber=true)=>{
   if(syncNumber)$('courseYardsNumber').value=$('courseYards').value;
   const asked=Number($('courseYards').value);
   // THE WHOLE SETTINGS OBJECT, not just the three fields on screen. The hole
   // skeleton reads doglegs, dogleg angle and turning point, and a card built
   // with the defaults while the studio is set to something else would be
   // quietly wrong about every yardage on a bending hole.
   const p=planScorecard({...settings,holes:Number($('courseHoles').value),
    courseYards:asked,seed:$('seed').value});
   const n=p.holes.length,half=Math.min(9,n),yd=v=>v.toLocaleString('en-US');
   // Said out loud when the bands cannot reach what was asked for, rather than
   // stretching holes out of shape to make the number come out.
   const short=Math.abs(p.yards-asked)>5
    ? `<em>${asked>p.yards?'longest':'shortest'} this par can play</em>` : '';
   $('planSummary').innerHTML=`<strong>Par ${p.par}</strong><span>${yd(p.yards)} yd</span>`
    +`<span>${p.counts[3]} par 3s · ${p.counts[4]} par 4s · ${p.counts[5]} par 5s</span>`
    +(n>9?`<span>Out ${p.front} · In ${p.back}</span>`:'')+short;
   // Columns as segments, so a nine-hole card shows one total rather than
   // printing Out and Tot with the same number in both.
   const segs=n>9?[[0,9,'Out'],[9,n,'In'],[0,n,'Tot']]:[[0,n,'Tot']];
   const cell=(v,cls='')=>`<td class="${cls}">${v}</td>`;
   const line=(label,each,tot,cls='')=>{
    let out=`<th>${label}</th>`,shown=0;
    for(const [from,to,name] of segs){
     if(name!=='Tot'||segs.length===1)
      for(let i=shown;i<to;i++)out+=cell(each(p.holes[i],i),cls),shown=i+1;
     out+=cell(tot(from,to),'sum');
    }
    return `<tr>${out}</tr>`;
   };
   let html=line('Hole',(_,i)=>i+1,(f,t,)=>segs.find(x=>x[0]===f&&x[1]===t)[2]);
   html=html.replace('<tr>','<tr class="plan-head">');
   html+=line('Par',h=>h.par,(f,t)=>p.holes.slice(f,t).reduce((v,h)=>v+h.par,0));
   for(const tee of p.tees)
    html+=line(`<span class="tee-dot ${tee}"></span>${tee}`,h=>h.tees[tee],
     (f,t)=>yd(p.holes.slice(f,t).reduce((v,h)=>v+h.tees[tee],0)),'yd');
   $('planCard').innerHTML=html;
  };
  $('courseYardsNumber').oninput=()=>{$('courseYards').value=$('courseYardsNumber').value;$('courseYardsValue').textContent=$('courseYards').value+' yd';previewPlan(false);};
  $('courseYards').addEventListener('input',()=>previewPlan());
  $('courseHoles').onchange=()=>{const n=Number($('courseHoles').value),input=$('courseYards'),old=Number(input.min)/110,previous=Number(input.value);input.min=n*110;input.max=n*470;$('courseYardsNumber').min=input.min;$('courseYardsNumber').max=input.max;input.value=Math.round(previous*n/old/10)*10;$('courseYardsValue').textContent=input.value+' yd';previewPlan();};
  $('seed').addEventListener('input',()=>previewPlan());previewPlan();
  for(const id of ['waterMin','waterMax'])$(id).addEventListener('input',()=>{if(Number($('waterMin').value)>Number($('waterMax').value)){const other=id==='waterMin'?'waterMax':'waterMin';$(other).value=$(id).value;$(other+'Value').textContent=$(other).value+' m';}});
  $('randomSeed').onclick=()=>{$('seed').value=['WANDER','HORIZON','WILDFLOWER','SOLSTICE'][Math.floor(Math.random()*4)]+'-'+Math.floor(Math.random()*9999);markStudioDirty();previewPlan();};
  document.querySelectorAll('[data-footprint]').forEach(b=>b.onclick=()=>{$('footprint').value=b.dataset.footprint;$('footprint').dispatchEvent(new Event('change'));markStudioDirty();});
  $('footprint').onchange=()=>document.querySelectorAll('[data-footprint]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.footprint===$('footprint').value)));
}else if(name==='round'&&challengeSetup){
  renderChallengeSetup(content);
 }else if(name==='round'&&weeklySetup){
  // THE COURSE OF THE WEEK (Phase 7): no course picker -- the week chose it --
  // just the group and the format, and what it is.
  const s=weeklySettings(),w=isoWeek(),me=mainProfile(profiles),best=me?.weekly?.[weekKey()],ever=bestEverWeekly(me);
  content.innerHTML=`<p><b>Week ${w.week}, ${w.year}: ${escape(BIOMES[s.biome]?.name||s.biome)}.</b> Eighteen holes of stroke play at the default settings, the same on every copy of Fairway built with course generator ${GENERATOR_VERSION}. A new course every Monday, in the next landscape.</p>`
   +(me?`<p class="note">${escape(me.name)}: best this week ${best??'—'} · best on any week's course ${ever??'—'}. The first round you finish each week earns ${WEEKLY_XP.first} XP, and beating your best that week ${WEEKLY_XP.best} more.</p>`:'')
   +`<h3>Format &amp; tees</h3>${formatFields({strokeOnly:true})}`
   +`<h3>Your group</h3><div class="players-list" id="playerRows"></div><p id="formatNote" class="note"></p>`
   +`<p class="field-error" id="roundError"></p>`
   +`<button class="primary" data-panel-action id="weeklyGo">Play the course of the week <i data-lucide="arrow-right"></i></button>`;
  const formatNote=wireFormatFields();
  groupEditor('playerRows',round.players,formatNote);
  $('weeklyGo').onclick=async()=>{
   if(flight){toast('Finish the current shot first.');return;}
   let group;
   try{group={...readGroup(),mode:'stroke',weekly:weekKey()};new Round({...group,holes:18});}catch(e){$('roundError').textContent=e.message;return;}
   weeklySetup=false;closePanel();
   const name=`${suggestCourseName(s)} · Week ${w.week}`;
   await startRoundOn(s,group,name);
   toast(`The course of the week: ${name}.`);
  };
 }else if(name==='round'&&endlessSetup){
  // NO COURSE PICKER. Endless grows each hole as you finish the last one, so a
  // course to play would be a course it immediately throws away. What is left is
  // exactly the round half of the round panel, built from the same helpers.
  content.innerHTML=`<p>A run with no last hole. Each green you hole out on grows the next tee. Set your group and how you are playing, then go.</p>`
   +`<h3>Format &amp; tees</h3>${formatFields({match:false})}`
   +`<h3>Your group</h3><div class="players-list" id="playerRows"></div><p id="formatNote" class="note"></p>`
   +`<p class="field-error" id="roundError"></p>`
   +`<button class="primary" data-panel-action id="endlessGo">Start an endless run <i data-lucide="arrow-right"></i></button>`;
  const formatNote=wireFormatFields();
  groupEditor('playerRows',round.players,formatNote);
  $('endlessGo').onclick=async()=>{
   if(flight){toast('Finish the current shot first.');return;}
   // Validated HERE rather than inside `buildEndless`: the overlay must not go
   // up over a group that is about to be rejected.
   let group;
   try{group=readGroup();new Round({...group,endless:true});}catch(e){$('roundError').textContent=e.message;return;}
   endlessSetup=false;closePanel();
   await startEndless(group);
   toast('Endless: hole out and the next one grows.');
  };
 }else if(name==='round'&&(rangeSetup||rangeMode)){
  // A PRACTICE GROUP, not a round. The course picker, format, tees and putting
  // mode all belong to a round and none of them mean anything on a range, so
  // this branch keeps only the two things that do: who is hitting, and how far
  // away the green is. The ids match the round panel's so `readGroup` works
  // unchanged.
  const live=rangeMode;
  content.innerHTML=`<p>${live
   ? 'Change who is practising. This applies straight away and does not touch the shots already recorded.'
   : 'Set your group and where the green sits, then open the range. Nothing is built until you say so.'}</p>`
   +`<h3>The green</h3><label class="field">Green distance (yd)<input id="rangeSetupGreen" type="number" min="${GREEN_RANGE[0]}" max="${GREEN_RANGE[1]}" step="0.33" value="${Math.round(rangeGreenYards(settings))}"></label>`
   +`<h3>Who is hitting</h3><div class="players-list" id="playerRows"></div>`
   +`<p class="note">Each golfer's shots are recorded separately. The card shows who is up; click it to change.</p>`
   +`<p class="field-error" id="roundError"></p>`
   +`<button class="primary" data-panel-action id="rangeGo">${live?'Apply to this session':'Open the driving range'} <i data-lucide="arrow-right"></i></button>`;
  groupEditor('playerRows',round.players);
  $('rangeGo').onclick=()=>{
   let players;
   try{players=readDraft();}catch(e){$('roundError').textContent=e.message;return;}
   const green=Math.min(GREEN_RANGE[1],Math.max(GREEN_RANGE[0],Number($('rangeSetupGreen').value)||DEFAULT_GREEN_YARDS));
   if(live){
    // APPLIED IN PLACE. Shots already recorded keep the index they were hit
    // under, and the list shows the name recorded with them, so dropping a
    // player never silently swallows their session.
    try{round.setPlayers(players,course?.tees);}
    catch(e){$('roundError').textContent=e.message;return;}
    // `setRangeGreen` on the range because it also remembers the preference for
    // the next visit.
    setRangeGreen(green);
    closePanel();updateHUD();
    toast(`${players.length} ${players.length===1?'golfer':'golfers'} practising.`);
   }else{
    rangeSetup=false;closePanel();
    try{round.setPlayers(players,course?.tees);}catch{ /* a fresh Round is built below anyway */ }
    enterRange({green});
   }
  };
 }else if(name==='round'){
  const library=listCourses();
  // A round you could export: one actually being played, not the showcase hole
  // behind the menu and not a practice ground.
  const playingNow=appMode==='play'&&!rangeMode&&!menuBackdrop;
  content.innerHTML=`<p>Pick a course, invite a few friends, and make a day of it. Courses are shaped in Course studio; a course decides the landscape and its hole count, and everything below is yours to choose.</p>
  <h3>Your course</h3>
  <label class="field">Course<select id="roundCourse">${library.length?library.map(c=>`<option value="${c.id}">${escape(c.name)} · ${c.settings.holes} holes · ${escape(BIOMES[c.settings.biome]?.name||c.settings.biome)}</option>`).join(''):'<option value="">No saved courses yet</option>'}</select></label>
  ${library.length?'':'<p class="note">Shape one in Course studio, or let Fairway surprise you below.</p>'}
  <div class="split"><button class="secondary" id="roundStudio"><i data-lucide="mountain"></i> Course studio</button><button class="secondary" id="roundSurprise"><i data-lucide="shuffle"></i> Surprise me &amp; play</button></div>
  ${library.length?'<div class="split"><button class="secondary" id="roundManage"><i data-lucide="library"></i> Manage &amp; share courses</button><button class="secondary danger" id="roundDelete"><i data-lucide="trash-2"></i> Delete this course</button></div>':''}
  <p class="research-label">Surprise me builds a fresh nine-hole course from randomised settings and tees straight off. Save it afterwards from Course studio if you want to keep it.</p>
  <h3>Format &amp; tees</h3>${formatFields()}<h3>Your group</h3><div class="players-list" id="playerRows"></div><p id="formatNote" class="note"></p><p class="field-error" id="roundError"></p>${(appMode==='play'&&!rangeMode)?'<button class="secondary" id="applyGroup">Apply to this session</button>':''}${playingNow?'':'<button class="primary" data-panel-action id="startRound">Start fresh round <i data-lucide="arrow-right"></i></button>'}
  <h3>Saved rounds</h3>
  ${roundCards()}
  <p class="field-error" id="roundsError"></p>
  <p class="note">A saved round keeps everything: the course, who is playing, where every ball lies and what they have shot. Leaving play offers to save one, and each one above can be exported on its own.</p>
  ${playingNow
   ?'<button class="secondary" id="exportRound"><i data-lucide="download"></i> Export the round you are playing</button>'
   :'<button class="secondary" id="exportRound" disabled title="There is no round in progress — open one from above, or start a round first.">Export the round you are playing</button>'}
  <button class="secondary" id="importRound"><i data-lucide="upload"></i> Import a round from a file</button>
  <input id="importFile" type="file" accept="application/json" hidden>`;
  const formatNote=wireFormatFields();
  // A primed Apply button goes back to itself the moment the group changes
  // underneath it -- otherwise it still reads "Remove Alex? Press again" after
  // Alex has been added back, and the next press does something else entirely.
  const disarmApply=()=>{const el=$('applyGroup');if(!el||!el.dataset.armed)return;
   delete el.dataset.armed;el.textContent='Apply to this session';};
  groupEditor('playerRows',round.players,()=>{formatNote?.();disarmApply();});
  $('roundStudio').onclick=()=>enterStudio();
  if($('roundManage'))$('roundManage').onclick=()=>openPanel('library');
  // Two taps rather than a browser confirm: deleting a course cannot be undone.
  if($('roundDelete'))$('roundDelete').onclick=b=>{const el=$('roundDelete'),c=findCourse($('roundCourse').value);
   if(!c){$('roundError').textContent='Choose a course to delete.';return;}
   if(el.dataset.armed!==c.id){el.dataset.armed=c.id;el.innerHTML=`Delete “${escape(c.name)}” for good?`;return;}
   deleteCourse(c.id);openPanel('round');toast(`Deleted “${c.name}”.`);};
  if($('roundCourse'))$('roundCourse').onchange=()=>{const el=$('roundDelete');if(el){delete el.dataset.armed;el.innerHTML='<i data-lucide="trash-2"></i> Delete this course';icon();}};
  // NO "START FRESH ROUND" WHILE A ROUND IS BEING PLAYED. This panel is how you
  // change the group and reach your saved rounds mid-round, and the primary
  // button in the tab row offered to throw the round away every time you opened
  // it. Starting a fresh round is a main-menu decision; from here, Apply changes
  // the group you have.
  $('roundSurprise').onclick=async()=>{
   if(flight){toast('Finish the current shot first.');return;}
   try{
    const fresh=randomSettings(Math.random),name=suggestCourseName(fresh);
    await startRoundOn(fresh,readGroup(),name);
    toast(`“${name}”, built just now. Play well.`);
   }catch(e){$('roundError').textContent=e.message;}
  };
  // APPLY TO A ROUND ALREADY IN PROGRESS, without restarting it. Golfers who
  // stay keep their scorecard and their ball; one who joins starts from the tee
  // with their earlier holes blank, because `cards` is indexed by hole and the
  // scorecard guards every cell -- a missing hole reads as not played, which is
  // true. One who leaves takes their card with them, so this asks first.
  if($('applyGroup'))$('applyGroup').onclick=()=>{
   if(flight){toast('Finish the current shot first.');return;}
   let players;
   try{players=readDraft();}catch(e){$('roundError').textContent=e.message;toast(e.message);return;}
   // WHO IS ACTUALLY LEAVING: the golfers whose seat is no longer in the draft.
   // This used to be `round.players.slice(players.length)` -- the tail of the
   // list -- which named the wrong golfer whenever the one removed was not the
   // last, and asked you to confirm losing a card that was not the one going.
   const staying=new Set(players.map(p=>p.seat).filter(Number.isInteger));
   const going=round.players.filter(p=>!staying.has(p.id));
   // ASKED BEFORE ANYTHING IS LOST, and by name: removing a golfer takes their
   // scorecard with them and there is no undo.
   //
   // A SECOND PRESS, not `confirm()`. The native dialog is suppressed outright
   // in some embedded browsers, and a suppressed `confirm` returns false -- so
   // Apply did nothing at all, silently, with no way to tell that from a bug.
   // The course list already arms its delete this way.
   const el=$('applyGroup'),armed=going.map(p=>p.id).join(',');
   if(going.length&&el.dataset.armed!==armed){
    el.dataset.armed=armed;
    el.textContent=`Remove ${going.map(p=>p.name).join(' and ')} and their scorecard${going.length>1?'s':''}? Press again`;
    return;
   }
   delete el.dataset.armed;
   try{round.setPlayers(players,course?.tees);}
   catch(e){
    // Loudly. The inline error alone reads as the button doing nothing.
    $('roundError').textContent=e.message;toast(e.message);return;
   }
   // THE GOLFER WHO WAS UP MAY HAVE JUST LEFT. If everyone still in the round
   // has holed out, the hole is over -- finish it rather than waiting for a
   // player who is gone, and let the normal completion flow carry on to the
   // next tee exactly as it would have done.
   const finished=round.done.length&&round.done.every(Boolean)&&!round.holeComplete;
   if(finished)round.completeHole();
   save();closePanel();updateHUD();
   // `showHoleCompletion` is the same routine a holed putt runs: the summary,
   // the scorecard and the countdown to the next tee. Reused rather than
   // reinvented, so a hole that ends this way ends identically to any other.
   if(finished)showHoleCompletion();
   else setUpTurn();
   toast(going.length
    ? `${going.map(p=>p.name).join(' and ')} left. ${round.players.map(p=>p.name).join(', ')} playing on.`
    : `Now playing: ${round.players.map(p=>p.name).join(', ')}.`);
  };
  // The button is not rendered while a round is being played, so this is guarded
  // rather than assumed -- `roundSurprise` and the library's Play both still
  // start a round from here, and they go through `guardRound` to do it.
  if($('startRound'))$('startRound').onclick=async()=>{
   if(flight){toast('Finish the current shot first.');return;}
   const chosen=findCourse($('roundCourse').value);
   if(!chosen){$('roundError').textContent='Choose a course first, or use Surprise me. Courses are shaped in Course studio.';return;}
   try{await startRoundOn(chosen.settings,readGroup(),chosen.name);toast(`Your round on “${chosen.name}” is ready.`);}catch(e){$('roundError').textContent=e.message;}
  };
  wireRoundCards(content);
  // EXPORTING "THE ROUND YOU ARE PLAYING" NEEDS ONE. At the menu `round` is the
  // menu backdrop's throwaway, so this wrote a file describing a round nobody
  // had played and called it a save. The rows above export themselves.
  if($('exportRound'))$('exportRound').onclick=()=>{
   if(!playingNow){toast('There is no round in progress to export.');return;}
   download(roundFileName(BIOMES[settings.biome]?.title||'round'),JSON.stringify(saveRecord(),null,2),'application/json');
   toast('Round exported.');
  };
  $('importRound').onclick=()=>$('importFile').click();
  // IMPORTING A ROUND IS ENTERING PLAY, and it is entering play ON TOP of
  // whatever is already there. Every other way in -- the menu, the studio, the
  // range, endless, Resume -- asks to save a round in progress first; this one
  // assigned `round` outright and the round you were playing was simply gone. It
  // also never called `setMode('play')`, so importing from the main menu built
  // the course, said "Saved round restored" and left you looking at the menu.
  //
  // The file is read and validated BEFORE the guard, so a file that turns out to
  // be unreadable does not first make you answer a question about your round.
  $('importFile').onchange=async()=>{
   try{
    if(flight)throw Error('Finish the current shot first.');
    const f=$('importFile').files[0];
    if(!f||f.size>500000)throw Error('Choose a Fairway save smaller than 500 KB.');
    const d=JSON.parse(await f.text());
    const stale=validateSave(d);
    let next=Round.restore(d.round);
    if(next.holes===3)next=new Round({players:next.players,mode:next.mode,holes:9,gimme:next.gimme});
    const apply=()=>{
     challenge=null;round=next;
     // AN ENDLESS SAVE CARRIES NO COURSE. `saveRecord` writes a placeholder for
     // it, because an endless run is a seed and a hole number rather than a
     // landscape, and the hole is grown back from those two. `resumeRound`
     // already did this; import did not, so an exported endless round came back
     // as a default nine-hole course with the run's hole number pointing into it.
     settings=round.endless?endlessFor(round.seed,round.hole,d.settings):{...DEFAULT_COURSE,...d.settings};
     applyPlaySettings();closePanel();loadCourse();setMode('play');
     if(stale)showVersionNotice();
     else if(round.scrambleSelection){toast('Restored scramble: choose a saved shot in the scorecard panel.');openPanel('score');}
     else toast('Saved round restored.');
    };
    guardRound(apply);
   }catch(e){$('roundError').textContent=e.message;}
   // Without this the same file cannot be chosen twice running: the input still
   // holds it, so picking it again fires no change event and nothing happens.
   finally{$('importFile').value='';}
  };
 }else if(name==='sound'){
  // Kept on this device (audio.js, its own store), like the graphics: not part
  // of a course or a round, so nothing saved changes shape.
  const p=gameAudio?.prefs??{on:true,master:80,effects:100,ambience:70};
  content.innerHTML=`<p>Every sound in Fairway is made as you play, never a recording, so nothing repeats.</p>
  <label class="check"><input id="sndOn" type="checkbox" ${p.on?'checked':''}> Sound on</label>
  ${slider('sndMaster','Volume',p.master,0,100,'%',5)}
  ${slider('sndEffects','Shots, landings and scores',p.effects,0,100,'%',5)}
  ${slider('sndAmbience','The course around you',p.ambience,0,100,'%',5)}
  <p class="note">Wind, birds, insects at night, water when your ball is near it, the odd plane overhead.</p>
  <p class="note">With a launch monitor armed there is no club sound: you hear your own strike. Everything else plays.</p>`;
  $('sndOn').onchange=()=>gameAudio?.setPrefs({on:$('sndOn').checked});
  for(const [id,key] of [['sndMaster','master'],['sndEffects','effects'],['sndAmbience','ambience']])
   $(id).addEventListener('input',()=>gameAudio?.setPrefs({[key]:Number($(id).value)}));
 }else if(name==='graphics'){
  content.innerHTML=`<p>These stay on this device and never travel with a course, so the same course looks the way each machine can afford on every screen it is opened on.</p>
  <label class="field">Quality${QUALITY.map(q=>'').join('')}<select id="gfxQuality">${QUALITY.map(q=>`<option value="${q}">${QUALITY_LABELS[q]}</option>`).join('')}</select></label>
  <p class="note" id="gfxNote"></p>
  <label class="field">Frame rate cap<select id="gfxFrameCap">${FRAME_CAPS.map(f=>`<option value="${f}">${f?f+' fps':'Follow the display'}</option>`).join('')}</select></label>
  <p class="note">A cap trades refresh rate for headroom. Leave it following the display unless the fans are loud or the picture is uneven.</p>
  <label class="check"><input id="gfxAutoRes" type="checkbox" ${graphics.autoResolution?'checked':''}> Automatic resolution</label>
  <p class="note">When frames run slow, draw fewer pixels — a step at a time, down to half — and take them back once there is room. Aims for 60 frames a second, or your cap if it is lower, and never goes sharper than the quality setting above. Off, the picture stays exactly as sharp as the setting and the frame rate goes where it goes. <span id="gfxAutoResNow"></span></p>
  ${slider('gfxTextSize','Text size',currentTextSize(),TEXT_SIZE.min,TEXT_SIZE.max,'%',TEXT_SIZE.step)}
  <label class="check"><input id="gfxTextAuto" type="checkbox" ${graphics.textSize==='auto'?'checked':''}> Size text automatically</label>
  <p class="note">Everything on screen, larger or smaller: panels, numbers, menus. For a projector or a screen you stand back from. The course itself is drawn the same either way. <span id="gfxTextNote"></span></p>
  <label class="check"><input id="gfxDistantFlags" type="checkbox" ${graphics.distantFlags?'checked':''}> Larger flags far away</label>
  <p class="note">Drawn to size, a flagstick is thinner than a pixel from a long way out and simply disappears. On, the stick and its flag grow with distance so you can always find the hole; from a chip or on the green they are exactly to size. Off, they are to size from everywhere. Only the picture changes: the ball hits the real flagstick either way.</p>
  <h3>Reading the ground</h3>
  <p>Ways of showing the shape of the land beyond what the sun and its shadows give you. None of them costs a measurable frame, so they are taste rather than performance.</p>
  <label class="check"><input id="gfxRelief" type="checkbox" ${graphics.relief?'checked':''}> Ground shading</label>
  <p class="note">Slopes facing the sun lift a little and slopes facing away darken, as if the sun were always low, plus a lift on crowns and a shade in hollows worked out when the course is built. It comes from the same side as the real shadows, so the two agree. This is what makes a fairway read as a surface rather than a sheet at noon.</p>
  <label class="check"><input id="gfxSlope" type="checkbox" ${graphics.slopeTint?'checked':''}> Slope tinting</label>
  <p class="note">Slopes shed water and burn off toward straw; hollows hold it and stay lush. Works in colour rather than brightness, so it reads where the others are competing with the sun. Turf that is already dry, on a desert or links course, has little left to lose and barely changes.</p>
  <label class="check"><input id="gfxSheen" type="checkbox" ${graphics.sheen?'checked':''}> Grass sheen</label>
  <p class="note">Mown grass looked at from a low angle is lighter than grass looked down on, so turf tipping away from you reads lighter and turf tipping toward you darker. From a player's eye a gentle slope changes that angle a lot, which is how a real green shows its breaks at any hour. Strongest on fairways; on greens only a gentle hint of which way the green tips.</p>
  <label class="check"><input id="gfxContours" type="checkbox" ${graphics.contours?'checked':''}> Contour lines</label>
  <p class="note">A topographic line every metre of height, across the whole course. Frankly artificial — a map drawn on the grass — and the most legible thing here by a distance, because it turns a slope into a spacing you can count.</p>
  <label class="check"><input id="gfxStripes" type="checkbox" ${graphics.stripes?'checked':''}> Mowing stripes</label>
  <p class="note">Alternating cut bands that bend over a roll and change contrast with the slope, the way real ones do because the mower follows the ground, and the clean-up lap round the edge of each green.</p>
  ${slider('gfxGreenDef','Green definition',graphics.greenDefinition,0,100,'%',5)}
  <p class="note">A green is the flattest ground on the course, so it has the least shape to show. This lets the shading and the sheen treat it as steeper than it is, and bends its mowing bands to follow the surface. It changes nothing about the surface itself: the ball rolls on exactly the ground it always did.</p>
  ${slider('gfxGreenBands','Green mowing bands',graphics.greenBands,0,100,'%',5)}
  <p class="note">How strong the light and dark bands are on greens. Stronger is the freshly mown look; softer leaves more of the shading to read.</p>
  <h3>The look of the course</h3>
  <p>Taste, not performance: none of these costs a measurable frame, and all four apply the moment you move them.</p>
  ${slider('gfxPatches','Turf colour variation',graphics.patches,0,100,'%',5)}
  <p class="note">No real course is one colour. Drifts of lighter, darker, drier and lusher grass in the rough, worn and well-watered patches on a fairway, damp sand in a bunker, and only the faintest change of tone on a green, where anything more would get in the way of reading it.</p>
  ${slider('gfxShade','Shade under trees and rocks',graphics.shade,0,100,'%',5)}
  <p class="note">A soft darkening at the foot of every trunk and boulder, and deeper under a forest where the crowns overlap, so things look set down on the grass rather than pasted on it. Worked out once when the course is built, from where everything stands.</p>
  ${slider('gfxHaze','Distance haze',graphics.haze,0,100,'%',5)}
  <p class="note">Far land fades toward the colour of the sky, a little warmer toward the sun, the way air thickens with distance. Much weaker looking down, so the view from above stays clear. Not weather: it stays on with the weather switched off.</p>
  ${slider('gfxWind','Wind in the trees and grass',graphics.wind,0,100,'%',5)}
  <p class="note">How far trees and grass move in the course's wind. Gusts sweep across as fronts, and each tree bends as a whole, the taller ones swaying slower. It moves the picture only: a trunk bends from the top, never where a ball can reach it, and the ball feels the wind the same whatever this is set to.</p>
  <h3>Costs a frame</h3>
  <p>Unlike everything above, these are real work. If the picture is uneven or pauses, start here.</p>
  <label class="check"><input id="gfxTerrainShadows" type="checkbox" ${graphics.terrainShadows?'checked':''}> Terrain casts shadows</label>
  <p class="note">Ridges shade the hollows behind them. Only says anything when the sun is low — at midday a two metre roll casts almost nothing. One draw call per shadow cascade, over ground that is already built.</p>
  <label class="check"><input id="gfxReflections" type="checkbox" ${graphics.reflections?'checked':''}> Water reflections</label>
  <p class="note">Ponds, lakes and creeks reflect the course around them rather than only the sky. Nothing extra per frame: each body's reflection is photographed when the course is built and again whenever the sun moves about six degrees, a pause of around 40–65 ms each time. Switched off, none of that happens, and water still moves and still reflects the sky.</p>
  <label class="check"><input id="gfxFloodShadows" type="checkbox" ${graphics.floodlightShadows?'checked':''}> Floodlight shadows</label>
  <p class="note">With the course floodlit, the lamps nearest your shot throw shadows — five of them, or three on High and Ultra, whose own sun shadows take the room. Redrawn only when the lamps or the view move, so they cost nothing frame to frame. The first switch on a course takes a few seconds to prepare, longer on Ultra, while you play on; after that it is instant.</p>
`;
  const note=()=>$('gfxNote').textContent={
   low:'Trims shadows, draw distance and planting so older laptops and integrated graphics keep up.',
   medium:'Renders exactly as Fairway always has.',
   high:'Soft shadows everywhere, drifting cloud shade, light shafts, a far horizon and thicker planting. Wants a discrete GPU.',
   ultra:'Everything high does, with sharper shadows reaching further, bloom, and a forest floor of ferns and fallen sticks round you under the trees. Measured at the full frame budget of a 120 Hz display on an RTX 4090 — cap the frame rate if it struggles.',
  }[graphics.quality];
  $('gfxQuality').value=graphics.quality;$('gfxFrameCap').value=String(graphics.frameCap);note();
  $('gfxQuality').onchange=()=>{
   const next=$('gfxQuality').value,rebuild=needsRebuild(graphics.quality,next);
   graphics=saveGraphics({...graphics,quality:next});
   view.applyQuality(graphics.quality);note();
   // Grass and canopy density are baked into the scene graph, so those tiers
   // need the course redrawn. The world itself is untouched either way.
   if(rebuild&&world)view.build(world,'cartoon',round.hole);
   toast(`Graphics set to ${next}.`);
  };
  // A float write into uniforms the ground material already holds: no rebuild,
  // no recompile, so these take effect on the frame after the click.
  for(const [id,key] of [['gfxRelief','relief'],['gfxSlope','slopeTint'],['gfxSheen','sheen'],['gfxContours','contours'],['gfxStripes','stripes']])
   $(id).onchange=()=>{graphics=saveGraphics({...graphics,[key]:$(id).checked});view.setGroundCues(graphics);};
  // Live uniform writes, same as the toggles above: no rebuild, no recompile.
  // THE READOUT IS NOT THIS FUNCTION'S JOB. `wireSliders` already updates an
  // output named <id>Value from the input's own data-unit, for every range in
  // the panel. Hand-rolling the markup and the readout instead of using the
  // `slider` helper left wireSliders looking up an element that did not exist,
  // and it threw on EVERY input event while this handler quietly worked -- so
  // the slider moved, the number updated, and the console filled up.
  for(const [id,key] of [['gfxGreenDef','greenDefinition'],['gfxGreenBands','greenBands'],
   ['gfxPatches','patches'],['gfxShade','shade'],['gfxHaze','haze'],['gfxWind','wind']])
   $(id).oninput=e=>{
    graphics=saveGraphics({...graphics,[key]:Number(e.target.value)});
    view.setGroundCues(graphics);
   };
  $('gfxDistantFlags').onchange=()=>{graphics=saveGraphics({...graphics,distantFlags:$('gfxDistantFlags').checked});view.setDistantFlags(graphics.distantFlags);};
  $('gfxTerrainShadows').onchange=()=>{graphics=saveGraphics({...graphics,terrainShadows:$('gfxTerrainShadows').checked});view.setTerrainShadows(graphics.terrainShadows);};
  $('gfxReflections').onchange=()=>{graphics=saveGraphics({...graphics,reflections:$('gfxReflections').checked});view.setReflections(graphics.reflections);};
  // The first switch on a course builds every floodlit shader again with the new
  // number of shadows -- measured at 4.4 s on an Ultra nine with 57 lamps,
  // the game running smoothly throughout -- so it says so, and says when it lands.
  // Every switch after that on the same course is instant.
  $('gfxFloodShadows').onchange=()=>{
   graphics=saveGraphics({...graphics,floodlightShadows:$('gfxFloodShadows').checked});
   const on=graphics.floodlightShadows,said=on?'Floodlight shadows on.':'Floodlight shadows off.';
   let landed=false;
   const slow=setTimeout(()=>{if(!landed)toast('Preparing floodlight shadows. Play on; they change when ready.');},400);
   view.setFloodShadows(on).then(()=>{landed=true;clearTimeout(slow);if(graphics.floodlightShadows===on)toast(said);});
  };
  $('gfxFrameCap').onchange=()=>{graphics=saveGraphics({...graphics,frameCap:Number($('gfxFrameCap').value)});toast(graphics.frameCap?`Capped at ${graphics.frameCap} fps.`:'Following the display refresh rate.');};
  // Applied when the slider is LET GO, not while it moves: a new text size lays
  // this panel out again, and doing that under a dragging cursor moved the slider
  // out from under it (the same lesson as the green slope warning).
  $('gfxTextSize').onchange=()=>{graphics=saveGraphics({...graphics,textSize:Number($('gfxTextSize').value)});$('gfxTextAuto').checked=false;applyUiScale();};
  $('gfxTextAuto').onchange=()=>{graphics=saveGraphics({...graphics,textSize:$('gfxTextAuto').checked?'auto':Number($('gfxTextSize').value)});applyUiScale();const v=currentTextSize();$('gfxTextSize').value=v;$('gfxTextSizeValue').textContent=v+'%';};
  textSizeNote();
  $('gfxAutoRes').onchange=()=>{graphics=saveGraphics({...graphics,autoResolution:$('gfxAutoRes').checked});autoResolutionNote();toast(graphics.autoResolution?'Resolution now drops a step when frames run slow.':'Resolution stays where this setting puts it.');};
  autoResolutionNote();
 }else if(name==='camera'){
  const c=view.config;
  // ONE SECTION, and which controls are in it depends on the answer to one
  // question: is this a simulator bay or a screen on a desk?
  //
  // In a bay none of it is taste -- the screen is a window, you stand a measured
  // distance from it, and there is exactly one vertical angle that makes the
  // course line up with the room. On a desk it is entirely taste. Showing both
  // sets at once meant two groups of controls that contradict each other, one of
  // which was doing nothing, so only the live set is rendered.
  //
  // There is no "camera view" picker here. Player, overview, the green and free
  // flight are all one click away on the tools tray, which is on screen the
  // whole time; a second copy in a settings panel made the view you happen to be
  // looking through into a saved preference, which is how opening this from the
  // main menu once saved "free flight" and greeted the next launch with it.
  content.innerHTML=`<p>Set the view up for your screen or your simulator bay. These stay on this device, survive a reload, and follow you between play, the range and the studio — they never travel inside a course or a round you share.</p>
  <label class="check"><input id="cameraSim" type="checkbox" ${c.sim?'checked':''}> Simulator bay · measure the view instead of choosing it</label>
  <p class="note">${c.sim
   ?'The camera stands where you stand: directly behind the ball, at your eye height, with the field of view your screen and your distance from it actually subtend. Off the green the ball sits below the bottom of the frame, which is where it is in the room; on the green the camera backs off far enough to show it, because you aim a putt from the ball.'
   :'Off. The camera is placed by the numbers below instead. Switch this on if you play into a projector or a screen you stand in front of.'}</p>
  ${c.sim?`
  ${slider('eyeHeight','Your eye height',c.eyeHeight,1,2.4,' m',.01)}
  ${slider('ballAhead','Ball in front of you',c.ballAhead,.2,3,' m',.05)}
  <div class="bay-sides"><label class="field">Screen width (in)<input type="number" id="screenWidth" min="12" max="480" step="0.5" value="${c.screenWidth}"></label>
  <label class="field">Screen height (in)<input type="number" id="screenHeight" min="8" max="300" step="0.5" value="${c.screenHeight}"></label></div>
  <p class="note" id="bayShape"></p>
  ${slider('standFeet','You stand from the screen',c.standFeet,2,30,' ft',.5)}
  ${slider('standSide','Your mat, left or right of the screen centre',c.standSide??0,-10,10,' ft',.1)}
  <p class="note">Negative is left, as you face the screen. The camera still looks straight down your target line; the picture slides sideways, the way a projector's lens shift does, so the line lands where it really is in the room.</p>`
  :`
  ${slider('cameraHeight','Height above the ball',c.height,1,40,' m',.5)}
  ${slider('cameraDistance','Distance behind the ball',c.distance,5,70,' m')}
  ${slider('cameraOffset','Horizontal offset',c.offset,-20,20,' m',.5)}
  ${slider('cameraFov','Field of view',c.fov,30,90,'°')}`}
  <p class="note" id="bayNote"></p>
  <label class="check"><input id="cameraFollow" type="checkbox" ${c.follow?'checked':''}> Follow the ball in flight</label>
  <label class="check"><input id="cameraReview" type="checkbox" ${c.review!==false?'checked':''}> Show the whole shot when the ball stops</label>
  <p class="note">A putt is followed with the camera pointed at the hole, so the cup stays still on screen while the ball rolls to it.</p>
  ${slider('freeSpeed','Free-flight speed',c.freeSpeed||45,5,180,' m/s')}
  <p class="note">Free flight: drag to look; W/A/S/D to move; R/F to rise or descend; Shift to move faster. Arrow keys look around. The on-screen controls work with touch.</p>
  <button class="secondary" id="resetCamera">Reset camera</button>`;
  // What the bay works out, or -- with the sliders in charge -- where you would
  // have to stand for the angle you picked. Either way it is the same arithmetic
  // read in the two directions, so the note can never contradict the control.
  const bayNote=()=>{
   const el=$('bayNote');if(!el)return;
   if(c.sim){
    const w=Number($('screenWidth').value),h=Number($('screenHeight').value);
    const angle=projectorFov({screenHeight:h,standFeet:Number($('standFeet').value)});
    el.textContent=angle?`That bay gives a ${angle}° field of view.`:'Enter the screen width and height and a distance to work out the field of view.';
    // The shape, from the sides; and a warning when the game's window is a
    // different shape from the screen, because the projector will stretch it.
    const shape=$('bayShape');
    if(shape){const name=aspectName(w,h),host=$('world'),win=host?host.clientWidth/Math.max(1,host.clientHeight):0,r=w>0&&h>0?w/h:0;
     shape.textContent=name?`Screen shape ${name}. The view is drawn in that shape whatever size the game's window is, because the projector stretches the window onto the screen.`
      +(r&&win&&Math.abs(win/r-1)>.03?` Right now the window is ${aspectName(win,1)}, so on this display the picture looks stretched; full screen on the projector, it lines up.`:''):'';}
   }else{
    const stand=standForFov({screenHeight:c.screenHeight,fov:Number($('cameraFov').value)});
    el.textContent=stand?`For reference: on a ${c.screenWidth}" by ${c.screenHeight}" screen, ${Number($('cameraFov').value)}° is what you would see standing about ${stand} ft back.`:'';
   }
  };
  const apply=()=>{
   Object.assign(c,{freeSpeed:Number($('freeSpeed').value),follow:$('cameraFollow').checked,review:$('cameraReview').checked});
   if(c.sim)Object.assign(c,{eyeHeight:Number($('eyeHeight').value),ballAhead:Number($('ballAhead').value),
    screenWidth:Number($('screenWidth').value)||c.screenWidth,screenHeight:Number($('screenHeight').value)||c.screenHeight,standFeet:Number($('standFeet').value),standSide:Number($('standSide').value)});
   else Object.assign(c,{height:Number($('cameraHeight').value),offset:Number($('cameraOffset').value),
    distance:Number($('cameraDistance').value),fov:Number($('cameraFov').value)});
   // Saved to the CAMERA's own key, never to the round. A bay describes the room
   // you are standing in: it has to survive discarding a round, has to be the
   // same in the range and the studio, and must not travel inside one you share.
   //
   // `mode` is deliberately NOT written from here. It is where you are looking,
   // not how you look, and the menu backdrop owns it while the menu is up.
   saveCamera({...c,mode:loadCamera().mode});
   view.setCamera(round.position,aim,true);updateExplorer();bayNote();save();
  };
  bayNote();
  // Switching the bay changes which controls exist, so it redraws rather than
  // leaving a set of dead sliders on screen.
  $('cameraSim').onchange=()=>{c.sim=$('cameraSim').checked;saveCamera({...c,mode:loadCamera().mode});view.setCamera(round.position,aim,true);applyUiScale();openPanel('camera');};
  content.querySelectorAll('input,select').forEach(e=>{if(e.id!=='cameraSim')e.addEventListener('input',apply);});
  // Automatic text size follows the bay -- once a slider is let go, not while it
  // is dragged (it lays the panel out again).
  content.querySelectorAll('input,select').forEach(e=>{if(e.id!=='cameraSim')e.addEventListener('change',applyUiScale);});
  $('resetCamera').onclick=()=>{Object.assign(c,DEFAULT_CAMERA,{mode:c.mode});setTimeout(applyUiScale);saveCamera({...DEFAULT_CAMERA,mode:loadCamera().mode});view.setCamera(round.position,aim,true);updateExplorer();save();openPanel('camera');};
 }else if(name==='views'){
  // A TOOL, not a takeover. Side-on and top-down are the two shapes the 3D view
  // cannot make -- it looks down the one axis each of them measures -- but they
  // are also not what you want on screen while you are hitting, so this is a
  // popup you open rather than a panel that appears.
  content.innerHTML=`<p>The shot flat: height down the line, and the ground track across it.</p>`
   +`<p class="note" id="viewsCaption"></p>`
   +`<canvas id="shotSide" class="shot-view" width="360" height="132"></canvas>`
   +`<canvas id="shotPlan" class="shot-view" width="360" height="132"></canvas>`
   +`<p class="note">Distances along the bottom are yards from where the ball was struck. The dashed centre line on the lower plot is the line you aimed down, not the line to the green — so a shot aimed at a target and hit straight reads straight.</p>`;
  drawShotViews();
 }else if(name==='lab'){
  // WHAT THE BENCH NEEDS AND NOTHING ELSE. The lab used to be a mode with its own
  // flat green, a floating bar, twelve putt presets and four approach presets.
  // The range is already a flat bench with a green you can put on any number, so
  // the mode is gone and this is what was actually being reached for: the two
  // turf numbers that decide what a ball does when it lands and once it rolls,
  // and a way to fire an exact shot instead of swinging one.
  const firm=firmnessValue(settings.turf?.firmness),stimp=settings.turf?.stimp??10;
  content.innerHTML=`<p>Bench conditions for the range. Both apply straight away, to this shot and every one after it.</p>`
   +`<label class="field">Green firmness <output id="labFirmnessRead">${firmnessName(firm)} · ${firm.toFixed(2)} in</output>`
   +`<input type="range" id="labFirmness" min="${LAB_FIRMNESS_RANGE[0]}" max="${LAB_FIRMNESS_RANGE[1]}" step="0.01" value="${firm}" aria-label="Green firmness"></label>`
   +`<div class="lab-chips">${FIRMNESS_NAMES.map(n=>`<button data-firm="${n}"${Math.abs(FIRMNESS_PRESETS[n]-firm)<1e-9?' class="on"':''}>${n}</button>`).join('')}</div>`
   +`<p class="note">Firmness is the landing. It decides how high a ball bounces and whether it holds, and it acts on greens and their fringes only.</p>`
   +`<label class="field">Green speed <output id="labStimpRead">Stimp ${stimp.toFixed(1)}</output>`
   +`<input type="range" id="labStimp" min="6" max="15" step="0.5" value="${stimp}" aria-label="Green speed in Stimp feet"></label>`
   +`<div class="lab-chips">${STIMP_PRESETS.map(([label,ft])=>`<button data-stimp="${ft}"${Math.abs(ft-stimp)<1e-9?' class="on"':''}>${label}</button>`).join('')}</div>`
   +`<h3>Fire a shot</h3>`
   +`<label class="field" for="labShotText">Ball speed, launch, direction, spin, axis &mdash; or paste Open Connect JSON</label>`
   +`<textarea id="labShotText" rows="2" spellcheck="false" placeholder="111, 20, 0, 6500, 0">${escape(labShotText)}</textarea>`
   +`<button class="primary" id="labFire">Take shot</button>`
   +`<p class="note">Fired from the mat, through the same simulator a swing goes through. Nothing is invented: the five numbers you give are the five numbers the ball leaves with, and the shot is recorded as Launch monitor in your shot data.</p>`;
  for(const b of content.querySelectorAll('[data-firm]'))b.onclick=()=>labFirmness(b.dataset.firm);
  for(const b of content.querySelectorAll('[data-stimp]'))b.onclick=()=>labStimp(Number(b.dataset.stimp));
  $('labFirmness').oninput=e=>labFirmness(Number(e.target.value));
  $('labStimp').oninput=e=>labStimp(Number(e.target.value));
  // Typing must NOT redraw the panel. The text is mirrored into module state and
  // rendered from there, so a firmness change cannot eat a half-typed line.
  $('labShotText').oninput=e=>{labShotText=e.target.value;};
  const fire=()=>{try{labStrike();}catch(e){toast(e.message);}};
  $('labFire').onclick=fire;
  $('labShotText').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();fire();}};
 }else if(name==='range'){
  // Always open while the range is, so it needs no discovery: the one control a
  // practice ground has should not be behind a menu.
  const yards=Math.round(rangeGreenYards(settings));
  content.innerHTML=`<p>Slide the green to the number you want to practise. The field stays 500 yards deep behind it.</p>${slider('rangeGreen','Green distance',yards,GREEN_RANGE[0],GREEN_RANGE[1],' yd',5)}${slider('rangeLines','Shot lines kept',shotLinePref,0,SHOT_LINE_MAX,'',1)}<label class="check"><input type="checkbox" id="rangeDispersion"${showDispersion?' checked':''}> Dispersion on the map</label><div id="dispersionLegend"></div><p class="note">Shot lines are the tracers left behind on the field. Zero clears them; ${SHOT_LINE_MAX} is the most a session keeps, so the setting can be raised again without losing what is already there.</p><p class="note">The coloured targets are aiming marks at fixed distances; this moves the real green, the one that plays as a green.</p>`;
  $('rangeGreen').oninput=()=>setRangeGreen(Number($('rangeGreen').value));
  // Applied to the field as it is dragged, so the number is chosen by looking at
  // the field rather than by guessing what 25 lines looks like.
  $('rangeLines').oninput=()=>{shotLinePref=saveShotLines(Number($('rangeLines').value));view.setShotHistory?.(visibleTrails());};
  $('rangeDispersion').onchange=()=>{showDispersion=$('rangeDispersion').checked;refreshDispersion();drawDispersionLegend();redrawMap();};
  refreshDispersion();drawDispersionLegend();redrawMap();
 }else if(name==='shot'){
  // THE SWING METER'S WINDOW, in place of Shot shape (14 October 2026). The
  // difficulty belongs to the golfer who is up -- it is kept in their profile, so
  // a group can play on different settings -- and the rest says what the
  // shot's shape, spin and lie do, because none of it is a slider any more.
  const prof=profileOf(round.player),cur=meterDifficulty(prof);
  const notes={
   easy:'A slow marker and a wide strike zone. The blue target allows for the wind.',
   normal:'A steady marker and a medium strike zone. You judge the wind.',
   hard:'A fast marker and a narrow strike zone. You judge the wind.',
  };
  const rows=Object.entries(DIFFICULTIES).map(([k,d])=>`<label class="meter-choice${k===cur?' on':''}"><input type="radio" name="meterDifficulty" value="${k}" ${k===cur?'checked':''} ${prof?'':'disabled'}><strong>${d.label}</strong><small>${notes[k]}</small></label>`).join('');
  content.innerHTML=`<p>Three taps. The first starts the swing; the second stops the marker at the distance you want, and the bar is marked in yards of carry for the club in your hands; the third, back on the strike line, decides how straight it goes. <strong>Early pushes the ball right, late pulls it left.</strong> A putt is two taps, on every difficulty: the line is straight to where you aim, and the break is yours to read from the green. Escape cancels a swing before the distance is set.</p><h3>Difficulty${prof?` for ${escape(prof.name)}`:''}</h3><div class="meter-choices">${rows}</div>${prof?'':'<p class="note">This golfer has no profile, so the meter plays on Normal.</p>'}<h3>Shot shape and spin</h3><p class="note">Curve (<kbd>S</kbd>) and height (<kbd>W</kbd>) are chosen separately. Near the green with a wedge, Low becomes Bump &amp; run and High becomes Flop. The spin dial (<kbd>X</kbd> for more, <kbd>Shift</kbd>+<kbd>X</kbd> for less) adds spin a step at a time, and each step narrows the strike zone. With no spin added, the ball never spins back.</p><h3>The lie</h3><p class="note">Semi-rough costs 4% of ball speed, rough 10% and sand 20%. The hatched end of the bar is what the lie takes off a full swing, and the strike zone narrows in rough and sand. Launch-monitor shots lose the same ball speed, unless the round's <em>Format &amp; tees</em> switches that off.</p><button class="secondary" id="applyShot">Back to the fairway</button>`;
  content.querySelectorAll('input[name=meterDifficulty]').forEach(r=>r.onchange=()=>{try{setProfileMeter(profiles,prof.id,r.value);}catch(e){toast(e.message);return;}meterScaleKey='';updateAim();updateHUD();openPanel('shot');});
  $('applyShot').onclick=()=>closePanel();
 }else if(name==='score'){
  let status='';if(round.mode==='match'){const diff=round.match.A-round.match.B;status=diff===0?'All square':`Team ${diff>0?'A':'B'} · ${Math.abs(diff)} up`;if(round.finished&&diff)status=`Team ${diff>0?'A':'B'} wins${round.holes-round.hole-1?' '+Math.abs(diff)+' & '+(round.holes-round.hole-1):''}`;}
  if(round.finished&&round.mode!=='match'){const entries=round.mode==='scramble'?[...new Set(round.players.map(p=>p.team))].map(t=>({name:'Team '+t,total:sumScores(round.teamCards[t])})):round.players.map((p,i)=>({name:p.name,total:sumScores(round.cards[i])}));const min=Math.min(...entries.map(e=>e.total));const winners=entries.filter(e=>e.total===min);status=winners.map(e=>e.name).join(' & ')+(winners.length>1?' tie':' wins')+' · '+scoreText(min);}
  const ENDLESS_WINDOW=18;
  const allPars=roundPars();
  const from=round.endless?Math.max(0,round.pars.length-ENDLESS_WINDOW):0;
  const pars=allPars.slice(from);
  // Yardages come off the built course, which an endless run no longer has for
  // any hole but the one under the player's feet.
  const teeRows=round.endless?[]:enabledTees(settings).map(t=>({name:t,yards:world.holes.map(h=>Math.round(h.tees[t].yards))}));
  const hcol=h=>from+h+1;
  // SKINS (skins.js): the count on the top line, the result once the round is
  // over, and a Skins row under the golfers -- each decided hole's winner as
  // their colour and the skins it paid, or an arrow where a tie carried them.
  const sk=round.mode==='skins'?skins(round.cards,decidedHoles(round)):null;
  if(sk)status=skinsStatus(round.players.map(p=>p.name),sk,{finished:round.finished,holes:round.holes});
  const skinCell=g=>{const e=sk.perHole[g];return !e?'<td>—</td>':e.winner===null?'<td class="skin-carry" title="Tied: carried to the next hole">→</td>':`<td title="${escape(round.players[e.winner].name)}"><span class="player-dot" style="background:${playerColour(e.winner)}"></span>${e.value}</td>`;};
  const skinsRow=sk?`<tr class="skins-row"><td>Skins</td>${pars.map((_,h)=>skinCell(from+h)).join('')}<td>${sk.won.reduce((a,b)=>a+b,0)}</td><td>${sk.carry?`${sk.carry} carried`:''}</td></tr>`:'';
  content.innerHTML=`${status?`<div class="match-status">${escape(status)}</div>`:''}<p>${round.endless?`Endless · seed ${escape(round.seed)}`:escape(course.bio.name)} · ${{scramble:'Team scramble',match:'Best-ball match',skins:'Skins'}[round.mode]||'Stroke play'} · ${round.finished?'Final scores':'Hole '+(round.hole+1)}</p>${round.endless&&from>0?`<p class="research-label">Showing the last ${ENDLESS_WINDOW} holes. Total and +/- cover all ${round.pars.length}.</p>`:''}<div class="score-table-wrap"><table class="score-table"><thead><tr><th>Hole</th>${pars.map((_,h)=>`<th>${hcol(h)}</th>`).join('')}<th>Total</th><th>+/-</th></tr><tr><th>Par</th>${pars.map(p=>`<td>${p||'—'}</td>`).join('')}<td>${allPars.reduce((a,b)=>a+b,0)}</td><td>E</td></tr>${teeRows.map(t=>`<tr class="yardage-row"><th><span class="tee-dot ${t.name}"></span>${t.name} yd</th>${t.yards.map(y=>`<td>${y}</td>`).join('')}<td>${t.yards.reduce((a,b)=>a+b,0)}</td><td></td></tr>`).join('')}</thead><tbody>${round.players.map((p,i)=>`<tr class="${round.active===i?'current':''}"><td><span class="player-dot" style="background:${playerColour(i)}"></span>${escape(p.name)}${['match','scramble'].includes(round.mode)?' · '+p.team:''}${(t=>t?`<small class="golfer-title">${escape(t)}</small>`:'')(titleName(seatLooks(i).title))}</td>${pars.map((_,h)=>{const g=from+h;return `<td>${round.cards[i][g]!==undefined?scoreText(round.cards[i][g]):(g===round.hole&&round.strokes[i]>0?scoreText(round.strokes[i])+'*':'—')}</td>`;}).join('')}<td>${scoreText(sumScores(round.cards[i]))}</td>${(({rel,played})=>`<td class="to-par" data-side="${parSide(rel,played)}"${parTint(rel,played)?` style="background:${parTint(rel,played)}"`:''}>${played?parText(rel):'—'}</td>`)(toPar(i))}</tr><tr class="putts-row"><td>Putts</td>${pars.map((_,h)=>`<td>${round.puttCards[i][from+h]!==undefined?scoreText(round.puttCards[i][from+h]):'—'}</td>`).join('')}<td>${scoreText(sumScores(round.puttCards[i]))}</td><td></td></tr>`).join('')}${skinsRow}</tbody></table></div><p class="research-label">* Hole in progress. Totals include completed holes. ${round.mode==='scramble'?'Teammates share one score.':''}</p>${round.scrambleSelection?'<h3>Choose your team’s lie</h3><p>Close this card: every ball the team hit is on the course, and the bar at the foot of the screen steps between them.</p>':''}${round.holeComplete&&!round.finished?'<div class="hole-advance"><p id="autoAdvanceLabel">Hole complete</p><button class="secondary" id="pauseAdvance">Stay on scorecard</button><button class="primary" id="nextHoleScore">Next hole now →</button></div>':''}<button class="secondary" id="downloadScore">Download scorecard</button>`;

  if($('pauseAdvance'))$('pauseAdvance').onclick=()=>{cancelAdvance();$('autoAdvanceLabel').textContent='Automatic advance paused';$('pauseAdvance').disabled=true;};if($('nextHoleScore'))$('nextHoleScore').onclick=()=>{advanceHole();};$('downloadScore').onclick=()=>{const rows=[['Player','Team',...allPars.map((_,h)=>'Hole '+(h+1)),'Total','+/-'],['Par','',...allPars,allPars.reduce((a,b)=>a+b,0),'E'],...teeRows.map(t=>[t.name+' yards','',...t.yards,t.yards.reduce((a,b)=>a+b,0),'']),...round.players.flatMap((p,i)=>[[p.name,p.team,...allPars.map((_,h)=>round.cards[i][h]??''),sumScores(round.cards[i]),(({rel,played})=>played?parText(rel):'')(toPar(i))],[p.name+' putts',p.team,...allPars.map((_,h)=>round.puttCards[i][h]??''),sumScores(round.puttCards[i]),'']]),...(sk?[['Skins','',...allPars.map((_,h)=>{const e=sk.perHole[h];return !e?'':e.winner===null?'carried':`${round.players[e.winner].name} ${e.value}`;}),sk.won.reduce((a,b)=>a+b,0),sk.carry?`${sk.carry} carried`:'']]:[])];download('fairway-scorecard.csv',rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@-]/,"'"+'$&').replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv');};
 }else if(name==='monitor'){
  content.innerHTML=`<p>Bring real ball data into your browser with an Open Connect v1 compatible connector.</p><p class="note">The included local bridge receives TCP shots on port 1921 and relays them to this browser. Start it with <code>npm run bridge</code>, then point your device’s connector at this computer.</p>${location.protocol==='https:'?`<p class="note">This copy is loaded securely from the web, and a browser will not let a secure page reach the bridge on your network. To play with a monitor, open the game from the bridge itself: start it with <code>FAIRWAY_HTTP_HOST</code> set to the computer's network address, then open <code>http://&lt;that address&gt;:1922</code> on this device. INSTALLATION.md has the steps.</p>`:''}<label class="field">Bridge address<input id="bridgeUrl" value="${escape(lastBridgeUrl)}" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url"></label><button class="primary" id="connectBridge">${ws?'Disconnect bridge':'Connect bridge'}</button><label class="check"><input id="armMonitor" type="checkbox" ${armSwitch?'checked':''} ${!monitorConnected?'disabled':''}> Arm monitor for live shots</label><p class="research-label" id="monitorStatus">${monitorConnected?'Bridge connected. Device readiness is reported separately.':'Disconnected. Manual controls are available.'}</p><h3>Compatible connector ecosystem</h3><ul><li><a href="https://github.com/PiTracLM/PiTrac" target="_blank" rel="noopener">PiTrac</a> · Open source camera monitor</li><li><a href="https://github.com/travislang/gspro-garmin-connect-v2" target="_blank" rel="noopener">Garmin R10 community connector</a></li><li><a href="https://github.com/springbok/MLM2PRO-GSPro-Connector" target="_blank" rel="noopener">Rapsodo MLM2PRO connector</a></li><li><a href="https://github.com/OpenSkyPlus/OpenSkyPlus" target="_blank" rel="noopener">OpenSkyPlus</a> · Community integrations</li></ul><p class="research-label">Compatibility is at the protocol level; hardware has not been tested here. Vendor software, licenses, OS support, and connector configuration still apply. Browsers cannot directly accept TCP or proprietary Bluetooth protocols.</p><h3>Try a sample shot</h3><label class="field">Open Connect JSON<textarea id="shotJson">${escape(JSON.stringify({DeviceID:'Fairway test',Units:'Yards',ShotNumber:1,APIversion:'1',BallData:{Speed:147.5,VLA:14.3,HLA:2.3,TotalSpin:3250,SpinAxis:-13.2},ShotDataOptions:{ContainsBallData:true,ContainsClubData:false}},null,2))}</textarea></label><p class="field-error" id="jsonError"></p><button class="secondary" id="testJson">Validate & play sample shot</button>`;
  $('connectBridge').onclick=()=>{if(ws){ws.close();ws=null;armSwitch=false;setConnection(false);openPanel('monitor');}else connectBridge($('bridgeUrl').value.trim());};$('armMonitor').onchange=()=>{armSwitch=$('armMonitor').checked;updateHUD();sendPlayer();};$('testJson').onclick=()=>{try{const d=parseLaunchMessage($('shotJson').value);if(!d)throw Error('This message contains no shot data.');if(!takeShot(d))throw Error('Complete the current shot or hole first.');}catch(e){$('jsonError').textContent=e.message;}};
 }else{
  content.innerHTML=`<p>A world of golf, right in your browser. Every fairway is generated from a seed, so there is always somewhere new to play.</p><h3>The essentials</h3><div class="help-shortcuts"><kbd>Click</kbd><span>Aim at a point on the course or map</span><kbd>← / →</kbd><span>Fine tune your aim</span><kbd>↑ / ↓</kbd><span>Aim further or shorter</span><kbd>Space</kbd><span>Swing: start, set the distance, strike</span><kbd>S / W / X</kbd><span>Curve, height and spin</span><kbd>Q / E</kbd><span>Change club</span><kbd>C</kbd><span>Toggle overview camera</span><kbd>Enter</kbd><span>Finish the shot animation</span><kbd>Escape</kbd><span>Close a panel</span></div><h3>Explore the course</h3><p>Press V or the bird icon for free flight. Drag to look; W/A/S/D moves, R/F changes altitude, Shift boosts speed. Arrow keys turn the camera. Jump to any green with the hole selector, or click the full course map. Return to your ball without changing your round.</p><h3>Controller</h3><p>Connect a standard gamepad and press a button to enable it. Left stick aims and adjusts power. A / Cross takes a shot; shoulders change clubs; Y / Triangle changes camera; B / Circle skips flight or closes a panel.</p><h3>Made to travel</h3><p>The built <strong>index.html</strong> includes its scripts, styles, and 3D renderer. Copy it anywhere and open it offline in a modern WebGL 2 browser. Your round saves automatically on this device; export it to move between browsers.</p><h3>The physics</h3><p>Real-time flight uses gravity, aerodynamic drag, spin-axis lift, spin decay, wind, altitude, surface-dependent bounce, and sloped roll. Flight is integrated at 240 Hz, independently of display refresh rate.</p><p class="note">This is a research-informed approximation, not a calibrated commercial ball-flight model. Ball-specific coefficients, turf response, and low-speed spin remain approximations. Trees collide at their trunks; foliage is visual.</p><p><a href="https://gsprogolf.com/GSProConnectV1.html" target="_blank" rel="noopener">Open Connect protocol</a> · <a href="https://github.com/digitalhand/openfairway" target="_blank" rel="noopener">OpenFairway research</a> · <a href="https://arxiv.org/abs/2302.02758" target="_blank" rel="noopener">Golf-ball bounce research</a></p>`;
  // REPORTING A PROBLEM, FOR SOMEBODY WHO WILL NEVER OPEN A CONSOLE.
  //
  // It sits in Help because that is where a person goes when something is
  // wrong, and it is one button because anything longer than one button does
  // not get used. The build, the machine, the GPU, the frame rate and the last
  // few errors are things a tester genuinely cannot report accurately from
  // memory -- half of them say Chrome and mean Edge, and nobody knows what
  // their GPU is called.
  //
  // The report is shown in the box as well as copied, so a browser that
  // refuses the clipboard is an inconvenience rather than a dead end, and so
  // that nobody has to take on trust what they are about to paste.
  content.insertAdjacentHTML('beforeend',`<h3>Report a problem</h3><p>Something looking wrong? This copies a short summary of your build, your machine and anything that has gone wrong, ready to paste into a bug report.</p><p class="note"><strong>Nothing is sent anywhere.</strong> Fairway makes no network requests at all. The text is put on your clipboard and shown below, and what happens to it after that is up to you.</p><button class="secondary" id="copyDiagnostic"><i data-lucide="clipboard-list"></i> Copy diagnostic</button><label class="field" id="diagnosticField" hidden>Diagnostic<textarea id="diagnosticText" rows="12" readonly></textarea></label>`);
  $('copyDiagnostic').onclick=async()=>{
   let text;
   // Belt and braces: this is the button somebody presses when the app is
   // already misbehaving, so it must not be the thing that throws next.
   try{text=collectDiagnostic();}
   catch(e){text=`Fairway diagnostic could not be collected: ${e&&e.message?e.message:e}`;}
   $('diagnosticField').hidden=false;
   $('diagnosticText').value=text;
   $('diagnosticText').focus();$('diagnosticText').select();
   toast(await copyText(text)?'Diagnostic copied.':'Diagnostic ready \u2014 copy it from the box.');
  };
  content.insertAdjacentHTML('beforeend',`<h3>Open source & credits</h3><p>Fairway is MIT licensed. Optional donations support development and are not required to play. Third-party components retain their own licenses.</p><details><summary>Project license</summary><pre class="license-text">${escape(projectLicense)}</pre></details><details><summary>Third-party licenses & credits</summary><pre class="license-text">${escape(thirdPartyNotices)}</pre></details>`);
 }
 // EVERY variant of the round panel is tabbed. Endless and the range both have
 // two sections rather than three, which dropped them under the threshold and
 // turned two tall panels into one long scroll -- and a mode dialogue that
 // scrolls where its neighbours tab reads as a different, worse screen.
 groupPanelContent(content,name==='round'||name==='library',name);
 wireSliders(content);icon();
}

// Laying a panel out for a wide, short sheet.
//
// Two earlier attempts were wrong in instructive ways. A four-column grid of
// FIELDS is the arrangement Baymard measured as slower and harder to interpret,
// and it separated notes from the controls they described. Packing whole
// SECTIONS into balanced columns fixed the pairing but not the scale: course
// settings came to 2177px of content in a 503px sheet, four screens of
// scrolling however neatly it was packed.
//
// So the big panels get tabs. One category at a time, each short enough to read
// without scrolling, which is what the research recommends for exactly this --
// a moderate-to-large number of setting groups.
// `.control-group` is a control as far as the walker is concerned: it gets a
// card of its own, and because the walker only ever looks at ROOT'S OWN
// CHILDREN the fields inside it are left alone rather than each being boxed
// again.
//
// `p.control-label` is the biome picker, the one control that is not a label
// at all -- a heading and a grid of buttons -- and so was the only setting
// on the panel with no box of any kind around it. Both selectors appear
// exactly once in this file and only there.
const CONTROL='label.check,label.field,.control-group,p.control-label';
// `.footprint-icons` and `.field-action` are parts of a control that are not
// inside its label: the layout picker's grid of shapes, and the button beside
// the seed box. Both sat outside the card their control had been given, which
// showed most once descriptions moved INSIDE that card -- the card then looked
// complete with a piece of its own control stranded underneath it.
const ATTACHED='P.note,.research-label,.field-error,.course-plan,.option-grid,.footprint-icons,.field-action';
const WIDE='.score-table-wrap,.course-list,.players-list,.help-shortcuts,.match-status,textarea';
// What stays pinned above the sections: the sentence explaining the panel and
// the actions that apply to all of it.
const LEAD='.panel-intro,button,.split,.field-error';
const TAB_THRESHOLD=3;

// WHICH TAB A PANEL WAS ON, so a re-render puts you back on it. Every list
// action re-renders the whole panel -- deleting a saved round, renaming a course
// -- and without this each one threw you back to the first tab, which made
// renaming two courses in a row a chore and deleting two rounds a puzzle.
// Remembered per panel and by TITLE, not index, because the round panel's
// sections differ between play, endless and the range.
const panelTab={};
// Which card is being renamed, if any. Held here rather than in the DOM because
// renaming re-renders the whole panel, the way every other list action does.
let renamingCourse=null,renamingRound=null;
function groupPanelContent(root,tabAlways=false,panelName=null){
 // 1. A control absorbs whatever explains it, so the two can never be separated.
 for(const node of [...root.children]){
  if(!node.matches(CONTROL))continue;
  const card=document.createElement('div');
  card.className='control-card';
  node.replaceWith(card);card.append(node);
  let next=card.nextElementSibling;
  while(next&&next.matches(ATTACHED)){const take=next;next=next.nextElementSibling;card.append(take);}
 }
 // 1b. A TIP GOES INSIDE THE BOX HOLDING THE CONTROL IT EXPLAINS. Every one
 // of them opened outside its own card, under it, which is what made the
 // panel jump about when a description was shown.
 //
 // NOT done by adding `.tip` to ATTACHED above, which looks like the obvious
 // one-word fix and is a trap. Every control is emitted followed by its own
 // tip, so an absorbed tip would no longer END the absorption run -- and that
 // run ending is the only reason the course-length box stays a direct child of
 // the section, which is what its `column-span: all` depends on. Adding the
 // word would have swallowed the scorecard into the card above it.
 //
 // Paired by id instead: a tip is `tip-<key>` and its button carries
 // `data-tip="<key>"`, so this is exact and does not care about order. The
 // `contains` guard leaves alone the tips that are already inside a group,
 // where they sit under their own field rather than at the foot of the box.
 for(const t of [...root.querySelectorAll('p.tip')]){
  const owner=root.querySelector(`.hint[data-tip="${t.id.slice(4)}"]`);
  const box=owner?.closest('.control-card,.control-group,.course-plan');
  if(box&&!box.contains(t))box.append(t);
 }
 const first=root.firstElementChild;
 if(first&&first.tagName==='P'&&!first.classList.contains('note'))first.classList.add('panel-intro');

 // 2. Only a heading starts a section. The lead is the opening run of prose and
 // actions, which stays on screen whatever section is showing. It ends at the
 // first control, because a button below a field belongs to that field and
 // must not be lifted away from it.
 const lead=document.createElement('div');lead.className='panel-lead';
 const sections=[];let current=null,opening=null,leading=true;
 for(const node of [...root.children]){
  if(node.tagName==='H3'){
   current=document.createElement('div');current.className='panel-section';
   current.dataset.title=node.textContent.trim();
   current.append(node);sections.push(current);continue;
  }
  if(node.matches(WIDE))node.classList.add('panel-wide');
  if(current){current.append(node);continue;}
  if(leading&&node.matches(LEAD)){lead.append(node);continue;}
  leading=false;
  // Controls that arrive before any heading still deserve a column layout, so
  // they get an implicit section rather than piling into the lead row -- a
  // panel with no headings at all was otherwise laid out entirely by wrapping.
  if(!opening){
   opening=document.createElement('div');
   opening.className='panel-section';opening.dataset.title='Overview';
   sections.push(opening);
  }
  opening.append(node);
 }

 // An implicit section with nothing to show would be a tab that opens on an
 // empty sheet, so it is folded back into the lead instead.
 if(opening&&!opening.textContent.trim()&&!opening.querySelector('input,select,textarea,button,table')){
  lead.append(...opening.children);
  sections.splice(sections.indexOf(opening),1);opening=null;
 }

 for(const section of sections)
  if(section.querySelector('.panel-wide'))section.classList.add('panel-plain');

 root.textContent='';
 if(lead.children.length)root.append(lead);

 // 3. A panel with no headings of its own is a single unnamed section, and it
 // flows its own controls into columns. Wrapping it in another column context
 // would just trap the whole thing in one narrow strip.
 if(sections.length===1&&sections[0]===opening){root.append(opening);return;}

 // Few sections read fine side by side. Many need one at a time.
 if(sections.length<(tabAlways?2:TAB_THRESHOLD)){
  const columns=document.createElement('div');columns.className='panel-columns';
  for(const section of sections)columns.append(section);
  if(sections.length)root.append(columns);
  return;
 }
 const tabs=document.createElement('div');
 tabs.className='panel-tabs';tabs.setAttribute('role','tablist');
 const show=index=>{
  sections.forEach((section,i)=>{section.hidden=i!==index;});
  [...tabs.children].forEach((tab,i)=>{
   tab.classList.toggle('active',i===index);
   tab.setAttribute('aria-selected',String(i===index));
  });
 };
 sections.forEach((section,i)=>{
  const tab=document.createElement('button');
  tab.className='panel-tab';tab.type='button';tab.setAttribute('role','tab');
  tab.textContent=section.dataset.title;
  tab.onclick=()=>{if(panelName)panelTab[panelName]=section.dataset.title;show(i);};
  tabs.append(tab);
  root.append(section);
 });
 root.insertBefore(tabs,sections[0]);

 // THE MODE BUTTON RIDES WITH THE TABS. "Start fresh round", "Start an endless
 // run", "Open the driving range" and "Grow this landscape" are the point of
 // their panels, and each used to sit at the bottom of one section -- so which
 // tab you were on decided whether you could see the way in at all. It is marked
 // with `data-panel-action` rather than found by `.primary`, because half a dozen
 // panels have a primary Save button that must stay exactly where it is.
 const action=root.querySelector('[data-panel-action]');
 if(action){action.classList.add('panel-action');tabs.append(action);}
 // A remembered tab that no longer exists falls back to the first one rather
 // than opening on nothing.
 const remembered=panelName?sections.findIndex(x=>x.dataset.title===panelTab[panelName]):-1;
 show(remembered>=0?remembered:0);
}

// Returns whether the save was generated by a different generator than this
// build. Every bound and type check for generation settings comes from the
// schema, so adding a control cannot leave a stale validator behind.
function validateSave(d){
 if(!d||!d.settings||!d.round)throw Error('Invalid Fairway save.');
 if(d.settings.style!==undefined&&!['realistic','cartoon','lowpoly','blueprint'].includes(d.settings.style))throw Error('Invalid Fairway save.');
 d.settings=migrateSettings(d.settings,Number.isInteger(d.schema)?d.schema:1);
 // Legacy three-hole rounds stored a hole count the generator never supported.
 if(d.settings.holes!==18)d.settings.holes=9;
 if(!d.settings.courseYards)d.settings.courseYards=d.round.holes*360;
 d.settings=validateSettings(d.settings);
 turfConfig(d.settings.turf);customizeClubs(d.settings.clubYardages);
 if(![3,9,18].includes(d.round.holes)||!FORMATS.includes(d.round.mode)||!Array.isArray(d.round.players)||!d.round.players.every(p=>typeof p.name==='string'&&p.name.length<=24&&['A','B'].includes(p.team)&&['RH','LH'].includes(p.hand)))throw Error('Invalid players or format.');
 if(!d.round.positions?.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<20000&&Math.abs(p.z)<20000))throw Error('Invalid positions.');
 return d.generator!==GENERATOR_VERSION;
}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// RED, AMBER, GREEN, or nothing at all. Off when no bridge is connected, so a
// player who never uses a monitor is not shown a permanently red light. Red is
// bridge-but-no-device, amber is device-but-no-ball, green is ball on the mat.
const monitorState=()=>!monitorConnected?'off'
 :!monitorDevice?'red'
 :monitorDevice.ballDetected?'green':'amber';
// THE MONITOR'S STATE, in words as well as colour, whenever a bridge is
// connected.
//
// THE LAUNCH MONITOR WINDOW (10 October 2026, the owner's design). Armed, every
// shot comes off the device, so the shot controls -- aim arrows, aim distance,
// power, shape, the shot button, even the tee -- decide nothing, and they go.
// In their place is a window of its own (#monitorPanel, "Launch monitor" in the
// layout) holding only what a player at the mat still needs: the ball light,
// the club the monitor is told about, Reconnect, and the Armed switch. The shot
// numbers are in the shot panel; aiming is the keyboard, the mouse and the map.
// It REPLACED a stripped-down version of the shot controls that kept the aim
// arrows and the distance box and offered "Hit by hand" in red: the Armed switch
// is the way back to the controls now, so Hit by hand went.
//
// Connected but NOT armed, the shot controls keep a slim strip at their top --
// the light and the same switch -- because that is where a player who has
// put the monitor down will look to pick it up again.
const MONITOR_WORDS={
 red:['No monitor','The bridge is running, but no device is talking to it'],
 amber:['Finding ball','Tee up the next one'],
 green:['Ready','Ball on the mat — hit when you are ready'],
};
// Which way of playing is in force: it decides the shot tiles, saved
// separately for each (shot-data.js) -- except on a phone, which has one set.
const playMode=()=>armed?'monitor':'hand';
let gridArmed=false;
function drawMonitorState(state){
 const box=$('monState'),win=$('monitorPanel');if(!box||!win)return;
 // THE SHOT LINE GOES WITH THE WINDOW YOU PLAY FROM (*THE SHOT PANEL*): under
 // the light and its words in the monitor's window, under the monitor strip --
 // so at the top -- in the shot controls.
 if(armed!==gridArmed){
  gridArmed=armed;layout?.setVariant(playMode());
  const line=$('shotPanel');
  if(line)(armed?$('monText'):box).after(line);
 }
 // Arming switches to the monitor's own set of tiles, and their places.
 syncTileSet();
 box.hidden=state==='off'||armed;
 win.hidden=!armed;
 win.dataset.monitor=state;
 if(state!=='off'){
  const [title,text]=MONITOR_WORDS[state];
  // In a group, whose turn it is, so the golfer at the mat knows whether to hit
  // or to wait for someone on the Swing Meter.
  const who=round.players.length>1?`${round.player.name} is up · `:'';
  $('monTitle').textContent=title;$('monText').textContent=who+text;
  $('monStateTitle').textContent=title;
  $('monStateText').textContent=armSwitch&&playsWith(round.player)==='meter'
   ?`${round.player.name} is on the Swing Meter: the monitor waits for the next monitor golfer`
   :'Armed is off: the Swing Meter is yours';
 }
 for(const el of document.querySelectorAll('.mon-arm-input')){el.checked=armSwitch;el.disabled=!monitorConnected;}
 $('clubSource').textContent='';
}
// WHERE THE BRIDGE IS, remembered per device once a connection succeeds. With
// nothing remembered: a page the bridge served itself -- plain http, which is
// how a phone on the home network plays with a monitor -- came from the bridge,
// so the bridge is where it came from. Anything else (opened from disk, or on
// the computer) gets the bridge's own default. It used to be that default
// everywhere, which on a phone is the phone: 127.0.0.1 is always "this device".
const BRIDGE_KEY='fairway-bridge-url-v1';
function defaultBridgeUrl(){
 try{const saved=localStorage.getItem(BRIDGE_KEY);if(saved)return saved;}catch{}
 return location.protocol==='http:'&&location.host?`ws://${location.host}`:'ws://127.0.0.1:1922';
}
let lastBridgeUrl=defaultBridgeUrl();
function setConnection(connected){monitorConnected=connected;if(!connected)monitorDevice=null;$('connectionDot').classList.toggle('connected',connected);$('connectionLabel').textContent=connected?'Bridge connected':'Connect monitor';
 // THE BRIDGE DROPPED with a monitor golfer up: the switch goes off, the Swing
 // Meter comes up, and they are told so rather than left waiting for a ball the
 // game can no longer hear (spec 5).
 if(!connected){if(armed&&appMode==='play')toast('The launch monitor disconnected. Play this shot on the Swing Meter, or reconnect.');armSwitch=false;}
 updateHUD();}
function sendPlayer(){if(ws?.readyState===1)ws.send(JSON.stringify({type:'player',Player:{Handed:round.player.hand,Club:clubs[$('club').value].code},ready:armed&&!flight&&!round.holeComplete&&!round.scrambleSelection}));}
const seenShots=new Set();
function connectBridge(url){
 lastBridgeUrl=url||lastBridgeUrl;
 try{const parsed=new URL(url);if(!['ws:','wss:'].includes(parsed.protocol))throw Error('Use a ws:// or wss:// bridge address.');ws=new WebSocket(url);const socket=ws;const timer=setTimeout(()=>{if(socket.readyState===0){socket.close();toast('Bridge timed out. Start the local bridge, then reconnect.');}},6000);
 ws.onopen=()=>{clearTimeout(timer);seenShots.clear();try{localStorage.setItem(BRIDGE_KEY,url);}catch{}setConnection(true);sendPlayer();if(panel==='monitor')openPanel('monitor');toast('Bridge connected. Arm the monitor when you are ready.');};
 ws.onclose=()=>{clearTimeout(timer);if(ws===socket){ws=null;setConnection(false);if(panel==='monitor')openPanel('monitor');}};ws.onerror=()=>toast('Could not reach the bridge. Check that it is running on this computer.');
 ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data);if(msg.type==='status'){monitorDevice=msg.deviceConnected?(msg.device??{ready:false,ballDetected:false}):null;updateHUD();if(panel==='monitor')$('monitorStatus').textContent=msg.deviceConnected?'Launch-monitor connector connected.':'Bridge connected; waiting for a device connector.';return;}if(msg.type==='shot'){const d=parseLaunchMessage(msg.payload),key=d?.device+':'+d?.id;let accepted=false,reason='Monitor is not armed.';if(!d)reason='No ball data.';else if(seenShots.has(key))reason='Duplicate shot.';else if(armed){accepted=takeShot(d);reason=accepted?'Shot accepted.':'Simulator busy; retry after current shot or hole.';if(accepted){seenShots.add(key);if(seenShots.size>1000)seenShots.delete(seenShots.values().next().value);}}socket.send(JSON.stringify({type:'ack',requestId:msg.requestId,accepted,reason}));if(!accepted)toast(reason);sendPlayer();}}catch(error){if(msg?.requestId)socket.send(JSON.stringify({type:'ack',requestId:msg.requestId,accepted:false,reason:error.message}));toast('Invalid monitor message: '+error.message);}};
 }catch(e){toast(e.message);ws=null;}
}
function followClub(){
 if(rangePlaced||!course||appMode!=='play'||flight)return;
 const c=clubs[$('club').value];if(!c)return;
 if(!aimTurned){defaultAim();return;}
 // Turned but not moved: keep the line, take the new club's carry along it
 // (or the pin's distance, for the putter and anything that reaches it).
 aimRange=c.code==='PT'?Math.max(.1,distance()):Math.min(c.carry*YARD,Math.max(1,distance()));
}
function cycleClub(delta){if(swing)return;const list=Object.keys(clubs);$('club').value=list[(list.indexOf($('club').value)+delta+list.length)%list.length];followClub();updateAim();updateHUD();sendPlayer();}
function startTour(){if(flight||dropState)return;cancelAdvance();closePanel();tour={path:makeHoleTour(course),elapsed:0,camera:{...view.config},orbit:false,puttingRings:view.puttingRings?.visible};if(view.puttingRings)view.puttingRings.visible=false;Object.assign(view.config,{mode:'free',greenGrid:false,greenFlow:false,greenHeat:false});view.setGreenReading();view.aimLine.visible=view.aimRing.visible=false;view.wasFree=true;updateExplorer();toast('Hole flyover · Escape or the flyover button returns to your ball.');}
function stopTour(){if(!tour)return;const camera=tour.camera;if(view.puttingRings)view.puttingRings.visible=tour.puttingRings;tour=null;Object.assign(view.config,camera);view.config.mode=playCameraMode('player',course,round.position);view.setGreenReading();view.setBall(round.position);view.flyCamera(round.position,aim);updateAim();updateExplorer();}
function cameraMode(mode){if(flight)return;stopTour();view.config.mode=playCameraMode(mode,course,round.position);view.flyCamera(round.position,aim);updateExplorer();save();}
function bind(){
 // BACKING STORE AT THE DISPLAY'S OWN RATIO, not a hardcoded 2. On anything
 // sharper than 2x -- which is most laptops at a scaled resolution -- the map
 // was being drawn at less than native and then upscaled by the compositor,
 // so it was already soft before the green tile was magnified on top of it.
 // Capped at 3 because the gain above that is invisible and the fill cost is
 // not. `mapPixels` divides by the ratio it finds, so pointer input follows.
 new ResizeObserver(()=>{const r=Math.min(Math.max(globalThis.devicePixelRatio||1,1),3),c=$('map'),w=Math.round(c.clientWidth*r),h=Math.round(c.clientHeight*r);if(w>0&&h>0&&(c.width!==w||c.height!==h)){c.width=w;c.height=h;drawMap(c,course,round.position,round.candidates,['free','overview'].includes(view.config.mode),view.camera.position,flight||dropState?null:aimPoint,view.elapsed);}}).observe($('map'));
 // The course card's menu button is gone from every mode -- the card reports the
 // hole, and a second way into the menu sitting on top of it was clutter beside
 // the nav that already does the job.
 // `data-panel` was REMOVED from this chip rather than relying on handler order.
 // The generic `[data-panel]` wiring runs later in setup and would have silently
 // clobbered this one; an explicit handler with no attribute cannot be beaten by
 // whatever order the file happens to be in. On a course it still opens the
 // scorecard; on a practice ground there is no scorecard, so it opens the active
 // golfer's shots.
 $('scoreNav').onclick=()=>{
  if(rangeMode)openShotList(round.active);
  else guardStudio(()=>openPanel('score'));
 };
 $('shotListClose').onclick=closeShotList;
 $('shotList').onclick=e=>{if(e.target===$('shotList'))closeShotList();};
 $('menuNav').onclick=()=>guardStudio(openMenu);
 $('menuContinue').onclick=continueRound;
 $('menuPlay').onclick=()=>openPanel('round');
 $('menuStudio').onclick=()=>openStudioSetup();
 $('menuCourses').onclick=()=>openPanel('library');
 $('menuProfile').onclick=()=>{renamingProfile=false;viewingProfile=profiles?.main??null;openPanel('profile');};
 $('menuHelp').onclick=()=>openPanel('help');
 $('menuCamera').onclick=()=>openPanel('camera');
 $('menuMonitor').onclick=()=>openPanel('monitor');
 $('menuGraphics').onclick=()=>openPanel('graphics');
 $('menuSound').onclick=()=>openPanel('sound');
 $('studioSettings').onclick=()=>panel==='course'?closePanel():openPanel('course');
 $('studioRegenerate').onclick=()=>regenerateStudio();
 $('studioSave').onclick=()=>openPanel('library');
 $('studioExit').onclick=()=>returnToMenu();
 // THE STUDIO BAR RIDES ABOVE AN OPEN PANEL. Both are pinned to the bottom of
 // the course, the bar one layer up, so until 12 October 2026 any panel opened
 // in the studio -- Settings, Save course, the menu's own -- had its lowest
 // rows and buttons under the bar. Hiding the bar was rejected: Regenerate is
 // the button the Settings panel tells you to press, and it has to be in reach
 // while the sliders are. So the bar is lifted by the panel's height. Where the
 // space left above the panel cannot hold the bar (a phone on its side), the
 // bar drops its caption and button words (`compact`) rather than leaving the
 // screen. Written a frame later, not inside the observer, for the reason
 // layout.js gives (*Written a frame LATER*).
 {
  let pending=0;
  // COURSE STUDIO'S SETTINGS TAKE THE PLAY AREA (the owner, 15 October 2026),
  // all but a strip at the top for this bar: its Regenerate stays in reach, as
  // above. The strip is the bar's own FULL height (measured with `compact` off)
  // plus its 18px gap and 10px of air, so the bar lands exactly above the
  // sheet and never needs `compact` (which trips under 26px to spare). With no bar (the setup sheet over the menu) the
  // sheet goes to the top of the course, as the stylesheet has it.
  //
  // MEASURED FROM WHERE THE COURSE STARTS, not assumed. The sheet's `top` is
  // counted from its containing block, which the browser reports as the page,
  // not #world: the first version wrote the bar's height alone and slid the
  // sheet under the top bar, the studio bar shrunk to icons above the screen.
  // So the course's top is found from the sheet's own box, and `k` undoes the
  // interface zoom between drawn pixels and CSS ones.
  const lift=()=>{pending=0;const bar=$('studioBar'),d=$('drawer');
   bar.classList.remove('compact');
   let room='';
   if(!bar.hidden&&!d.hidden&&d.dataset.panel==='course'&&d.offsetHeight){
    const box=d.getBoundingClientRect(),k=box.height/d.offsetHeight||1;
    const block=box.top-(parseFloat(getComputedStyle(d).top)||0)*k;
    room=Math.round(($('world').getBoundingClientRect().top-block)/k+bar.offsetHeight+28)+'px';
   }
   if(d.style.top!==room)d.style.top=room;
   if(bar.hidden)return;
   const by=d.hidden?0:d.offsetHeight;
   bar.style.setProperty('--panel-lift',by+'px');
   bar.classList.remove('compact');
   if(by&&$('world').clientHeight-by-bar.offsetHeight<26)bar.classList.add('compact');};
  const soon=()=>{if(!pending)pending=requestAnimationFrame(lift);};
  const watch=new ResizeObserver(soon);
  for(const id of ['world','drawer','studioBar'])watch.observe($(id));
 }
 // Straight into the studio rather than dropping the user on the menu to click
 // again. The worlds stay separate because enterStudio grows its own.
 const toStudio=()=>{closeMenuDrop();if(appMode==='studio'){closePanel();return;}
  if(appMode==='play')return guardRound(()=>{closePanel();openStudioSetup();});
  openStudioSetup();};
 const toPlay=()=>{closeMenuDrop();if(appMode==='studio')return returnToMenu();if(appMode==='play'){closePanel();return;}returnToMenu();};
 $('dropStudio').onclick=toStudio;$('dropPlay').onclick=toPlay;
 $('dropMenu').onclick=()=>{closeMenuDrop();returnToMenu();};
 for(const [id,name] of [['dropLibrary','library'],['dropGraphics','graphics'],['dropSound','sound'],['dropHelp','help']])
  $(id).onclick=()=>{closeMenuDrop();openPanel(name);};
 $('menuNav').onclick=e=>{e.stopPropagation();toggleMenuDrop();};
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));$('clockButton').onclick=e=>{e.stopPropagation();toggleClockPop();};document.addEventListener('click',e=>{if(!$('clockPop').hidden&&!e.target.closest('.sim-time'))toggleClockPop(false);if(!$('menuDrop').hidden&&!e.target.closest('.menu-wrap'))closeMenuDrop();});$('closeDrawer').onclick=closePanel;$('drawerBackdrop').onclick=closePanel;document.querySelector('.brand').onclick=e=>{e.preventDefault();returnToMenu();};bindSwingInput();$('skipFlight').onclick=finishShot;
 // A MULLIGAN TAKES BACK ONE SHOT, AND ONE TRACER WITH IT.
 //
 // `holeTrails.pop()` before `loadCourse()` did nothing at all: `loadCourse`
 // calls `resetTrails()`, which empties the list -- it is the routine that grows
 // a NEW HOLE, and on a new hole no shot has been hit yet. A mulligan is not a
 // new hole. Every tracer from before the shot being taken back is still a shot
 // that was played, and the hole summary has to show them.
 //
 // Kept across the reload rather than moved out of `loadCourse`'s way: the reset
 // is right for every other caller, and this is the one place that has to put
 // something back afterwards.
 $('mulligan').onclick=()=>{
  if(flight||dropState)return;
  if(challenge){toast('No mulligans in a challenge: every ball counts.');return;}
  cancelAdvance();
  const keptTrails=holeTrails.slice(0,-1),keptShots=Math.max(0,practiceShots-1);
  if(!round.mulligan())return;
  // The ball taken back belongs to whoever is up again now.
  // ...and so does any XP it earned (progression.js `takeBack`); the hole's own
  // XP follows the card on the next save.
  {const prof=rangeMode?null:profileOf(round.player);if(prof){tallyMulligan(prof);takeBack(prof,`${round.uid}:h${round.hole}:`,round.stroke);storeProfiles(profiles);}}
  closePanel();loadCourse();save();
  holeTrails=keptTrails;practiceShots=keptShots;
  view.setShotHistory?.(visibleTrails());
  view.setTrail([]);
  if(round.scrambleSelection)openPanel('score');
  toast('Mulligan taken. Previous lie, player and scores restored.');
 };
 $('replayShot').onclick=()=>replayShot();
 for(const [id,key] of [['readSlope','greenGrid'],['readFlow','greenFlow'],['readHeat','greenHeat']])
  $(id).onclick=()=>{view.config[key]=!view.config[key];view.setGreenReading();updateHUD();save();};
$('activeTee').onchange=()=>{if(flight||dropState||round.holeComplete)return;const pristine=round.strokes.every(n=>n===0)&&Object.values(round.scrambleShots).every(n=>n===0)&&!round.candidates.length;round.tee=$('activeTee').value;if(pristine){round.teePlaced=false;round.placeTee(course.tees);setUpTurn();}else{updateHUD();toast('Tee preference saved for the next hole.');}save();};$('pickPrev').onclick=()=>stepPick(-1);$('pickNext').onclick=()=>stepPick(1);
 $('reliefTake').onclick=()=>{const o=reliefList[reliefChoice];if(o)takeReliefOption(o);};
 $('reliefCloser').onclick=()=>moveReliefBack(-10*YARD);$('reliefFurther').onclick=()=>moveReliefBack(10*YARD);
 // THE KEYBOARD CHOOSES TOO, ahead of the game's own keys: while relief is
 // waiting there is no shot to aim, so the arrows step through the options and
 // Enter takes the one shown -- the same keys a controller's d-pad sends.
 window.addEventListener('keydown',e=>{
  if($('reliefBar').hidden||!reliefList.length||e.target?.closest?.('input,select,textarea'))return;
  const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.code];
  if(step){reliefChoice=(reliefChoice+step+reliefList.length)%reliefList.length;showRelief();}
  else if(e.code==='Enter'||e.code==='NumpadEnter'){const o=reliefList[reliefChoice];if(o)takeReliefOption(o);}
  else return;
  e.preventDefault();e.stopImmediatePropagation();
 },true);
 $('pickAccept').onclick=()=>{if(!round.scrambleSelection)return endPick();try{const carded=cardedSeats();round.chooseScramble(pickIndex);announceHoleOut(carded);afterSelection();}catch(e){toast(e.message);}};
 $('simDrop').onclick=beginDrop;$('confirmDrop').onclick=confirmDrop;$('cancelDrop').onclick=cancelDrop;$('dropAtGreen').onclick=()=>previewDrop({x:course.pin.x+2*YARD,z:course.pin.z});for(const id of ['dropX','dropZ'])$(id).oninput=()=>previewDrop({x:dropState.origin.x+Number($('dropX').value)*YARD,z:dropState.origin.z+Number($('dropZ').value)*YARD},false);$('resetLayout').onclick=()=>{layout.reset();resetTilePlaces();toast('Panels put back where they started.');};$('toolsButton').onclick=openToolsBox;$('menuRange').onclick=()=>{if(flight){toast('Finish the current shot first.');return;}guardRound(()=>openRangePanel());};
 // The lab is driven from the console. Everything it does goes through the same
 // shot path the game uses, so anything watched here is the real behaviour.
 window.lab={
  // THE BENCH IS THE DRIVING RANGE. The lab used to be its own mode with its own
  // flat green; that mode is gone and the range does the job -- it is flat, its
  // green moves to a stated number, and Lab tools sets its firmness and speed.
  // So everything here runs against the loaded course, which on the range is
  // the bench. `open` is simply "go to the range".
  open:(options={})=>enterRange(options),
  // A COURSE BUILT TO ORDER, FOR MEASUREMENT.
  //
  // `tools/profile.mjs` drives this instead of clicking through the menus, so
  // the profiler keeps working when the menus are rearranged -- which they are,
  // often. It goes through `startRoundOn`, the same path Play and Saved
  // courses take, so what gets measured is what gets played. Resolves when the
  // world is built and the first frame can be drawn.
  // `group` replaces the lone golfer -- the smoke journey `skins` plays two.
  course:(overrides={},group)=>startRoundOn({...DEFAULT_COURSE,...overrides},
   // `hand` like every group the editor builds: a save without it is refused on
   // reload (validateSave), so a lab round could never be continued.
   group||{players:[{name:'Bench',team:'A',hand:'RH'}],mode:'stroke',tee:'blue'}),
  // Which view the camera is in, so a run can state what it measured rather
  // than assuming. 'player' is down at the ball; 'overview' is the whole hole
  // and is much the heavier of the two.
  view:(mode)=>{if(mode)cameraMode(mode);return view?.config?.mode;},
  // THE CAMERA, PUT EXACTLY SOMEWHERE -- so a before and an after are the same
  // picture. {x, z, height (above the ground there), yaw, pitch} in world metres
  // and degrees, or {hole, along, across, height, look: 'pin' | 'tee' | yaw} in
  // that hole's own frame (along from the tee, across to the right). Free
  // camera; returns the pose it used. `look: 'sun'` faces the sun's bearing and
  // `pitch: 'sun'` tilts to 12 degrees under it, so the sun sits in the top of
  // the frame with the land below -- the view the god rays cost the most in,
  // and the one the profiler's `sun` group measures.
  camera:(o={})=>{
   let x=o.x??0,z=o.z??0,yaw=(o.yaw??0)*Math.PI/180;
   // `fromPin`: that many metres from the pin, on the line back toward the tee
   // turned `around` degrees about the pin, looking at it -- a green seen from
   // wherever a putt is read, whatever shape the hole is.
   // `fromGreen` is the same about the green's centre, which stays put when the
   // cup moves -- for comparing two versions of a green whose cups differ.
   if(o.fromPin!==undefined||o.fromGreen!==undefined){const h=world.holes[o.hole??round.hole],pin=o.fromGreen!==undefined?h.worldGreen:h.worldPin,tee=h.worldTee,far=o.fromGreen??o.fromPin;
    const a=Math.atan2(tee.x-pin.x,tee.z-pin.z)+(o.around??0)*Math.PI/180;
    x=pin.x+Math.sin(a)*far;z=pin.z+Math.cos(a)*far;yaw=Math.atan2(pin.x-x,pin.z-z);}
   else if(o.hole!==undefined){const h=world.holes[o.hole];const p=h.toWorld({x:o.across??0,z:o.along??0});x=p.x;z=p.z;
    const aim=o.look==='tee'?h.worldTee:o.look==='pin'||o.look===undefined?h.worldPin:null;
    yaw=aim?Math.atan2(aim.x-x,aim.z-z):o.look==='sun'?yaw:(o.look??0)*Math.PI/180;}
   const sun=view.sunDir;
   if(o.look==='sun'||o.yaw==='sun')yaw=Math.atan2(sun.x,sun.z);
   const y=world.height(x,z)+(o.height??2);
   const pitchDeg=o.pitch==='sun'?Math.asin(Math.max(-1,Math.min(1,sun.y/sun.length())))*180/Math.PI-12:(o.pitch??-10);
   const pitch=pitchDeg*Math.PI/180;
   view.placeCamera({x,y,z},yaw,pitch);
   return {x:+x.toFixed(1),y:+y.toFixed(1),z:+z.toFixed(1),yaw:+(yaw*180/Math.PI).toFixed(1),pitch:+pitchDeg.toFixed(1)};
  },
  // Straight to a hole's tee (0-based), for measuring from more than the first.
  hole:(n)=>{if(flight||round.endless||!world?.holes[n])return round.hole;round.hole=n;loadCourse();return round.hole;},
  // null on any field hands it back to the previous value.
  launch:(over={})=>{labLaunch={...labLaunch,...over};syncLabTool();return {...labLaunch};},
  strike:(over={})=>labStrike(over),
  firmness:value=>labFirmness(value),
  // The cosmetic skip of a rolling ball (roll-hop.js): on, off, or ask.
  rollHop:(on)=>{if(on!==undefined)ROLL_HOP.enabled=!!on;return ROLL_HOP.enabled;},
  // A BALL INTO TROUBLE, ON PURPOSE, for testing penalty relief. The path runs
  // straight from the ball to the nearest water on this hole, or out across the
  // nearest boundary, and goes through the same `finishShot` a struck ball does --
  // so what gets tested is the relief a player is offered, not a copy of it.
  // Returns the relief waiting in the round, or null when there is no such
  // trouble here or a ball cannot be hit right now.
  trouble:(kind='water')=>{
   if(appMode!=='play'||rangeMode||flight||dropState||round.relief||round.holeComplete||round.scrambleSelection||round.finished)return null;
   const from={...round.position};let target=null;
   if(kind==='water'){let best=Infinity;for(let x=-300;x<=300;x+=3)for(let z=-150;z<=900;z+=3){if(course.surface(x,z)!=='water')continue;const d=Math.hypot(x-from.x,z-from.z);if(d<best){best=d;target={x,z};}}}
   else for(let t=1;t<4000&&!target;t++)if(outOfBounds(course,from.x+t,from.z))target={x:from.x+t,z:from.z};
   if(!target)return null;
   const length=Math.hypot(target.x-from.x,target.z-from.z),n=Math.max(2,Math.ceil(length/2)),points=[];
   for(let i=0;i<=n;i++)points.push({x:from.x+(target.x-from.x)*i/n,y:course.height(from.x+(target.x-from.x)*i/n,from.z+(target.z-from.z)*i/n),z:from.z+(target.z-from.z)*i/n});
   const result={points,end:{...points[n]},carry:length,total:length,apex:0,time:2,landingSpeed:20,descentAngle:30,skid:0,holed:false,lipped:false,
    hazard:kind==='water'?'Water':'Out of bounds',treeHits:0,homeHits:0,onGreen:false};
   const shot={origin:from,aim,speed:30,vla:12,hla:0,spin:3000,spinAxis:0};
   latest={shot,result,player:round.player.name,typed:true};priorShot=lastShot;lastShot={...latest,hole:round.hole,putting:false,aim,club:'Lab'};
   flight={result,elapsed:0,index:0,origin:from,record:lastShot};
   finishShot();
   return round.relief?{...round.relief,options:reliefList.map(o=>({id:o.id,penalty:o.penalty,spot:o.spot}))}:null;
  },
  stimp:value=>labStimp(value),
  // `green` already means "build the bench and report its slope", so the
  // distance setter gets its own name rather than overloading one that answers a
  // different question.
  greenAt:yards=>{
   if(!rangeMode)throw Error('Open the driving range first — lab.open().');
   if(!(yards>=GREEN_RANGE[0]&&yards<=GREEN_RANGE[1]))
    throw Error(`The green goes from ${GREEN_RANGE[0]} to ${GREEN_RANGE[1]} yards.`);
   setRangeGreen(yards);
   // Reports where the green ACTUALLY ended up, not what was asked for.
   return {yards:rangeGreenYards(settings)};
  },
  last:()=>labState&&{...labState,result:labState.result},
  close:()=>returnToMenu(),
  // Rebuild the bench. difficulty 0 is dead flat; anything above it is a smooth
  // tilt, so this is how break gets tested. Reports the slope it actually made
  // rather than the number that was asked for.
  green:(options={})=>enterRange(options).then(()=>window.lab.slope()),
  slope:()=>({...greenSlope(course,course.pin),stimp:settings.turf.stimp,
   difficulty:settings.greenDifficulty,seed:settings.seed}),
  // Fires without animating, against the green that is loaded. Used to measure a
  // distribution instead of watching one shot and guessing. Nothing here touches
  // the round: it is the pure simulator on the live course.
  batch:(spec={})=>{
   const {feet=10,past=1.4,offsets=[0],bearings=[0],pasts=null}=spec;
   const out=[];
   for(const bearing of bearings)for(const offset of offsets)for(const p of (pasts||[past])){
    const plan=shotPlan({feet,past:p,offset,bearing});
    const origin={x:course.pin.x+plan.back.x,z:course.pin.z+plan.back.z};
    const open={...course,pin:{x:9e9,z:9e9}};
    const speed=solveLaunch(v=>rollPreview(open,origin,plan.aimDegrees,v,{turf:settings.turf,seconds:30}).distance,plan.target);
    const shot={origin,aim:plan.aimDegrees,hla:0,vla:0,spin:0,spinAxis:0,speed};
    const r=simulateShot(shot,course,{turf:settings.turf,wind:[0,0,0]});
    out.push({bearing,offset,past:p,launch:+speed.toFixed(3),
     ...outcome(r,course.pin,(x,z)=>course.height(x,z),BALL_R)});
   }
   return out;
  },
  // Drop a ball onto the green from the air. Starts back along its own flight so
  // that it lands where asked rather than wherever the trajectory happened to put
  // it, which is two runs of the simulator and worth it for a repeatable mark.
  drop:(options={})=>{
   if(!rangeMode)throw Error('Open the driving range first.');
   if(flight)throw Error('A shot is still in the air.');
   const plan=dropPlan(options);
   const rad=plan.bearing*Math.PI/180;
   const aimed={x:course.pin.x+Math.sin(rad)*plan.landing,z:course.pin.z+Math.cos(rad)*plan.landing};
   const trial=simulateShot({...plan.shot,origin:{x:course.pin.x,z:course.pin.z}},{...course,pin:{x:9e9,z:9e9}},{turf:settings.turf,wind:[0,0,0]});
   const origin={x:aimed.x-Math.sin(rad)*(trial.carry||0),z:aimed.z-Math.cos(rad)*(trial.carry||0)};
   if(round.holeComplete||round.finished){round.beginHole();round.teePlaced=true;}
   round.positions[round.active]={...origin};round.teePlaced=true;
   aim=plan.bearing;
   view.setBall(origin);updateAim();view.setCamera(origin,aim,true);updateHUD();
   labState={feet:options.feet??0,past:0,offset:0,speed:plan.speed,
    label:`drop ${plan.height} m · ${plan.descent}° · ${plan.speed} m/s · ${plan.spin} rpm`,result:null};
   syncLabTool();
   if(!takeShot(plan.shot))throw Error('The drop was refused.');
   return {...plan.shot,origin};
  },
  // Many drops, no animation: the sweep that says how a green holds a shot.
  drops:(spec={})=>{
   const {heights=[12],descents=[45],speeds=[25],spins=[6000]}=spec;
   const out=[];
   for(const height of heights)for(const descent of descents)for(const speed of speeds)for(const spin of spins){
    const plan=dropPlan({height,descent,speed,spin});
    const r=simulateShot({...plan.shot,origin:{x:course.pin.x,z:course.pin.z}},{...course,pin:{x:9e9,z:9e9}},{turf:settings.turf,wind:[0,0,0]});
    out.push({height,descent,speed,spin,stimp:settings.turf.stimp,
     ...dropOutcome(r,(x,z)=>course.height(x,z),BALL_R)});
   }
   return out;
  },
  // A group of shots with jitter, drawn on the green as where each came to rest.
  // Points rather than a hundred animated balls: what a dispersion test is for is
  // the pattern, and the pattern is the resting places.
  scatter:(spec={})=>{
   const {shots=40,feet=10,past=1.4,offset=0,bearing=0,speedJitter=3,aimJitter=1,seed='JITTER',show=true}=spec;
   const noise=jitterStream(seed),results=[],places=[];
   const plan=shotPlan({feet,past,offset,bearing});
   const origin={x:course.pin.x+plan.back.x,z:course.pin.z+plan.back.z};
   const open={...course,pin:{x:9e9,z:9e9}};
   const base=solveLaunch(v=>rollPreview(open,origin,plan.aimDegrees,v,{turf:settings.turf,seconds:30}).distance,plan.target);
   for(let i=0;i<shots;i++){
    const speed=base*(1+noise()*speedJitter/100),aimed=plan.aimDegrees+noise()*aimJitter;
    const r=simulateShot({origin,aim:aimed,hla:0,vla:0,spin:0,spinAxis:0,speed},course,{turf:settings.turf,wind:[0,0,0]});
    results.push(r);
    if(!r.holed)places.push({x:r.end.x,z:r.end.z});
   }
   view.setScatter(show?places:null);
   return {...groupStats(results,course.pin),speedJitter,aimJitter,seed,
    lipped:results.filter(r=>r.lipped).length};
  },
  clearScatter:()=>view.setScatter(null),
  // How close free flight will let you get to the turf, in metres. The ball is
  // 43 mm across and the cup 108, so watching either properly means getting down
  // among them rather than standing over them.
  eyeHeight:(metres=.04)=>{
   if(!(metres>=.01&&metres<=3))throw Error('Pick a height between 0.01 and 3 m.');
   view.config.freeFloor=metres;return {freeFloor:metres};
  },
  // How hard the rim turns a ball, swept across lines and speeds. The exit angle
  // is measured from the path after the ball leaves the opening, not predicted.
  lipSweep:(spec={})=>{
   const {feet=10,pasts=[4,6,8,10,14,20],offsets=[0.5,1,1.5,2]}=spec;
   const rows=[];
   for(const past of pasts)for(const offset of offsets){
    const plan=shotPlan({feet,past,offset});
    const origin={x:course.pin.x+plan.back.x,z:course.pin.z+plan.back.z};
    const open={...course,pin:{x:9e9,z:9e9}};
    const speed=solveLaunch(v=>rollPreview(open,origin,plan.aimDegrees,v,{turf:settings.turf,seconds:30}).distance,plan.target);
    const r=simulateShot({origin,aim:plan.aimDegrees,hla:0,vla:0,spin:0,spinAxis:0,speed},course,{turf:settings.turf,wind:[0,0,0]});
    if(r.holed){rows.push({past,offset,holed:true});continue;}
    // Everything AFTER the closest approach. Filtering on distance alone picks up
    // the whole run in as well, and then the "exit" angle measured is just the
    // aim -- which is how a sweep of this reported six degrees where the real
    // answer was sixty-eight.
    let near=0,closest=Infinity;
    r.points.forEach((q,i)=>{const dd=Math.hypot(q.x-course.pin.x,q.z-course.pin.z);if(dd<closest){closest=dd;near=i;}});
    const after=r.points.slice(near).filter(q=>Math.hypot(q.x-course.pin.x,q.z-course.pin.z)>.06);
    const a=after[0],b=after[after.length-1];
    const out=after.length>2?Math.atan2(b.x-a.x,b.z-a.z)*180/Math.PI:plan.aimDegrees;
    rows.push({past,offset,holed:false,exitDegrees:+(out-plan.aimDegrees).toFixed(1),
     ...outcome(r,course.pin,(x,z)=>course.height(x,z),BALL_R)});
   }
   return rows;
  },
  // Slow the playback down to watch the ball meet the cup. 1 is real time.
  slowmo:(factor=1)=>{
   if(!(factor>0)||factor>4)throw Error('Pick a factor between just above 0 and 4.');
   timeScale=factor;return {timeScale};
  },
  // The capture envelope of the loaded green, swept the same way: for each
  // offset, the firmest putt that still drops.
  envelope:(options={})=>labEnvelope(
   ({offset,past})=>window.lab.batch({feet:options.feet??10,offsets:[offset],pasts:[past],bearings:[options.bearing??0]})[0].holed,
   {offsets:options.offsets,decel:rollDeceleration('green',settings.turf)}),
  // Enough internal state to check what is on screen against what should be.
  state:()=>({inFlight:!!flight,
   // THE SWING IN PROGRESS, on the input clock (`event.timeStamp`): when it
   // started and how long the marker takes per bar length, so the smoke test can
   // time a tap the way a player does -- on the clock, not on a frame, which on a
   // software renderer lasts most of a second. null between swings.
   swing:swing?{start:swing.start,rise:swing.rise,power:swing.power,accuracy:swing.accuracy}:null,
   // Whether the ball is down. Read the moment a putt stops, it says holed or
   // not without waiting to see whether a scorecard turns up.
   holeComplete:!!round.holeComplete,
   // The challenge being played (challenge-play.js), read-only, so the smoke
   // test can follow one without reading the bar's words.
   challenge:challenge?{id:challenge.id,week:challenge.week?.key||null,done:!!challenge.done,hole:challenge.hole,range:rangeMode,putting:round.putting?.mode,turn:turn(challenge.play),balls:challenge.play.results.map(r=>r.length)}:null,
   // How far the tracer's end sits from the ball, a number worth being able to
   // read rather than squint at. In flight it trails on purpose (TRACER_LAG);
   // once the ball has stopped and the line caught up, it should be ~0.
   // Line2 packs each segment as start and end triples into one interleaved
   // buffer of stride 6, so the end point's height is index*6+4. Reading it with
   // getZ returns the z of the segment instead, which is how this first reported
   // a tracer 90 m underground.
   tracer:(()=>{const g=view.trail?.geometry?.attributes?.instanceStart;
    if(!g?.data||!view.trail.visible)return null;
    const endY=g.data.array[(g.count-1)*6+4];
    return {ballY:+view.ball.position.y.toFixed(4),trailY:+endY.toFixed(4),
     gap:+Math.abs(view.ball.position.y-endY).toFixed(4)};})(),
   // WHOSE TRACERS ARE ON THE FIELD. Each visible shot line as the colour it is
   // actually drawn in, which is the only way to check from outside that a
   // golfer's line, their chip and their scorecard dot agree -- the colour lives
   // on a material, not in the DOM.
   shotLines:(view.shotLines||[]).filter(l=>l.visible).map(l=>'#'+l.material.color.getHexString()),
   // The team's balls during a scramble choice, same reason: they are meshes in
   // a scene, so there is nothing in the DOM to check them against.
   picks:(view.pickBalls||[]).filter(b=>b.group.visible).map(b=>'#'+b.ball.material.color.getHexString()),
   // How many tracers the hole is holding. Not visible mid-hole -- they are drawn
   // at the end of it -- so a shot quietly vanishing from the summary is
   // otherwise only noticeable once the hole is over.
   trails:holeTrails.length,
   // WIND, as the SHADER has it -- the HUD arrow and the grass disagreed for a
   // long time, and this is how that is checked rather than eyeballed.
   wind:view.windVec?{direction:view.world?.settings?.windDirection,
    speed:view.world?.settings?.wind,
    vec:[+view.windVec.value.x.toFixed(3),+view.windVec.value.y.toFixed(3)],
    breeze:+(view.breeze?.value??-1).toFixed(3)}:null,
   // The ball's contact darkening. `castShadow` on the ball draws nothing at any
   // tier -- the ball is a fraction of one shadow-map texel -- so this is the
   // only thing putting it on the turf.
   ballShadow:view.ballShadow?{visible:view.ballShadow.visible,
    widthCm:+(view.ballShadow.scale.x*200).toFixed(1),
    opacity:+view.ballShadow.material.opacity.toFixed(3),
    liftCm:+((view.ball.position.y-view.ballShadow.position.y)*100).toFixed(1),
    // How far the mark sits from directly under the ball, and how far a low sun
    // has stretched it. Round and centred means the sun is down.
    offsetCm:view.ballShadowAt?+(Math.hypot(view.ballShadow.position.x-view.ballShadowAt.x,
     view.ballShadow.position.z-view.ballShadowAt.z)*100).toFixed(1):null,
    stretch:+(view.ballShadow.scale.x/view.ballShadow.scale.y).toFixed(2),
    sunElevationDeg:view.sunDir?+(Math.asin(Math.max(-1,Math.min(1,view.sunDir.y)))*180/Math.PI).toFixed(1):null}:null,
   // WATER, as the scene has it. There is no planar mirror any more and so no
   // reflector to be drawing or not drawing; what is left to check is that every
   // body got a probe of its own and that every body is actually on screen.
   water:view.waterBodies?.length?{
    bodies:view.waterBodies.length,
    // The ripple clock. If this is not advancing the water is a sheet of glass
    // whatever the material says.
    clock:+(view.waterTime?.value??-1).toFixed(2),
    speed:view.waterSpeed,
    chop:view.waterChop?.value,swell:view.waterSwell?.value,
    // Whether the bodies are reflecting the course or only the sky.
    reflectsCourse:view.waterReflectsCourse!==false,
    probes:view.waterEnvironments?.length??0,
    withEnvMap:view.waterBodies.filter(b=>!!b.mesh.material.envMap).length,
    // How many DISTINCT maps are in play: one for every body up to the probe
    // cap. One shared by all of them was the bug that made every pond reflect
    // the same patch of trees.
    distinctEnvMaps:new Set(view.waterBodies.map(b=>b.mesh.material.envMap).filter(Boolean)).size,
    // NOW ALWAYS ZERO. A hidden body used to mean the planar reflector was
    // standing in for it; with no reflector, a hidden body is a pond that has
    // gone missing, and the water-coloured ground shows through where it was.
    hiddenBodies:view.waterBodies.filter(b=>!b.mesh.visible).length,
    // Streams flow along their channel and still water does not flow at all, so
    // this should be nonzero only for bodies that are streams.
    flowing:view.waterBodies.filter(b=>!!b.stream).length}:null,
   // The ground cue switches as the SHADER has them, not as the panel believes.
   // They are uniforms on a material that is rebuilt with every course, so the
   // question worth asking is whether they survived the rebuild.
   cues:(()=>{const u=view.terrain?.material?.userData?.cues;return u?
    {relief:u.cueRelief.value,slopeTint:u.cueSlope.value,contours:u.cueContours.value}:null;})(),
   // Compiled shader programs. Several comments in the renderer reason about
   // when a variant is built and what a toggle costs; this is how that is
   // checked rather than assumed.
   programs:view.renderer?.info?.programs?.length??null,
   // The rig as the camera is ACTUALLY set up, not as the panel describes it.
   // The bay's field of view is computed rather than stored, so the only honest
   // place to read it is the camera itself.
   // The EFFECTIVE rig, framing included: on the green the camera backs off until
   // the ball is on screen, so reporting the unframed rig would contradict the
   // camera it claims to describe.
   camera:{mode:view.config.mode,sim:!!view.config.sim,
    fov:+view.camera.fov.toFixed(2),
    eye:+view.camera.position.y.toFixed(2),
    onGreen:course?.surface?.(round.position.x,round.position.z)==='green',
    ...(course?.surface?.(round.position.x,round.position.z)==='green'
     ?framedForBall(cameraRig(view.config)):cameraRig(view.config))},
   reading:{grid:!!view.config.greenGrid,flow:!!view.config.greenFlow,heat:!!view.config.greenHeat,
    built:!!view.greenGrid,visible:view.greenGrid?view.greenGrid.visible:null}}),
  // WHAT SHADOW-CASTING FLOODLIGHTS WOULD COST. Every shadow-casting light is an
  // extra depth render of the whole scene, every frame -- the one number that
  // decides whether "shadows from the poles" is a setting or a fantasy. Switches
  // them on for the nearest `count` lamps so the frame time can be measured
  // against the same scene with none.
  //
  // Called with NO ARGUMENT it reports rather than sets. A measurement tool
  // whose idle call silently switches the thing off is a trap.
  floodShadows:(count)=>{
   const lamps=view.floodLamps||[];
   if(count===undefined)return {casting:lamps.filter(l=>l.castShadow).length,lamps:lamps.length,
    live:view.floodlit?lamps.filter(l=>l.castShadow).length:0};
   lamps.forEach((l,i)=>{
    const want=i<count;
    if(l.castShadow===want)return;
    l.castShadow=want;
    l.shadow.mapSize.set(1024,1024);
    // Three only allocates the map when the light first casts; disposing on the
    // way back down keeps a sweep from leaking a map per lamp.
    if(!want)l.shadow.map?.dispose?.();
    l.shadow.needsUpdate=true;
   });
   return {casting:lamps.filter(l=>l.castShadow).length,lamps:lamps.length};
  },
  // The ball's contact shadow: radius in CENTIMETRES where it is touching, and
  // how dark it is there. Both are a look, so both are judged against the turf.
  ballShadow:(widthCm,ink)=>{
   if(!view.ballShadow)return null;
   if(widthCm!==undefined)view.ballShadowRadius=Math.max(.005,widthCm/200);
   if(ink!==undefined)view.ballShadowInk=Math.min(1,Math.max(0,ink));
   const at=view.ballShadowAt;
   if(at)view.placeBallShadow(at.x,at.z,at.groundY,at.ballY);
   return {widthCm:+(view.ballShadowRadius*200).toFixed(1),ink:view.ballShadowInk};
  },
  // Wave height, live. Ripple strength is a look, and a look is judged
  // against the course rather than guessed at from a shader.
  waterRipple:(chop,swell,speed)=>{
   if(!view.waterChop)return null;
   if(chop!==undefined)view.waterChop.value=chop;
   if(swell!==undefined)view.waterSwell.value=swell;
   // Speed scales the ripple clock rather than any rate in the shader, so it
   // moves the chop and the swell together and takes effect on the next frame.
   if(speed!==undefined)view.waterSpeed=Math.max(0,speed);
   return {chop:view.waterChop.value,swell:view.waterSwell.value,speed:view.waterSpeed};
  },
  // Green definition, from the console, driving the same two graphics settings
  // the panel does -- so what is tried here is what gets saved.
  //   lab.greenRead()            what is set now
  //   lab.greenRead('off')       how greens looked before this existed
  //   lab.greenRead('recommended') / lab.greenRead('strong')   the two compared
  //   lab.greenRead(85)          a definition percentage
  //   lab.greenRead({greenDefinition:85,greenBands:40})
  greenRead:(v)=>{
   const base={greenDefinition:0,greenBands:100};
   const P={off:base,
    recommended:{...base,greenDefinition:50,greenBands:40},
    strong:{...base,greenDefinition:70,greenBands:60}};
   if(v!==undefined){
    const next=typeof v==='number'?{greenDefinition:v}
     :typeof v==='string'?(P[v]||P.strong):v;
    graphics=saveGraphics({...graphics,...next});
    view.setGroundCues(graphics);
    // Same convention as the panel: the readout is <id>Value.
    for(const [id,v] of [['gfxGreenDef',graphics.greenDefinition],['gfxGreenBands',graphics.greenBands]]){
     if($(id))$(id).value=v;
     if($(id+'Value'))$(id+'Value').textContent=v+'%';
    }
   }
   // REPORT WHAT THE MATERIAL HOLDS, not what this function just computed.
   // Reporting the computed value is how a dead slider looks alive: the numbers
   // come back correct while the uniform the GPU reads never moved.
   const live=view.terrain?.material?.userData?.cues;
   return {greenDefinition:graphics.greenDefinition,greenBands:graphics.greenBands,
    wanted:greenCues(graphics),
    onTheGpu:live?Object.fromEntries(['greenLift','greenBend','greenBandSoft','cueRelief','cueSheen']
     .map(k=>[k,live[k]?.value])):'no ground material'};
  },
  // WHAT IS BUILT, as opposed to what was drawn. `renderer.info` and the profile
  // probe count the triangles a frame DREW; this lists what there is to draw,
  // by the group each mesh sits in (named groups by name, loose meshes by kind),
  // with the heaviest meshes on their own. It is how culling is judged: a group
  // whose triangles are all drawn from every camera is one nothing culls.
  // The view cull's margins, live: {near (m), margin (deg), shadows (bool), shadowCap (m),
  // shadowMaps (bool: each shadow map only its own trees), thinShadowsFrom (map index, 99 = never, null = the tier's)}.
  cullTune:(next)=>view.cull?.tune(next)??null,
  // The floodlights, switched the way the clock panel's box does it (without
  // saving the choice). No argument reports.
  floodlights:(on)=>{if(on!==undefined){view.daylight.floodlights=!!on;view.setFloodlights(!!on);}return !!view.floodlit;},
  // A fingerprint of the ground this course was built on, and how it was
  // built. The same seed must give the same number whether the grid's heights
  // came from the workers or from here (gen-pool.js); this is how a browser
  // proves it, where the Node test cannot reach.
  ground:()=>{const g=world?.groundGrid;if(!g)return null;let h=2166136261>>>0;
   for(const a of [g.values,g.positions,g.indices]){const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619)>>>0;}}
   return {hash:h.toString(16),vertices:g.positions.length/3,triangles:g.indices.length/3,workers:lastGridWorkers,waitedMs:lastGridWait,generationMs:lastGenerationMs,atlasFromWorkers:!!world?.ownerAtlas};},
  // Where the shadow cascades split: {splits: [metres, ...]}, or {} for the tier's own. See GolfView.cascadeSplitter.
  cascades:(o={})=>view.setCascadeSplits(o.splits??null),
  scene:()=>{
   // A mesh the view cull manages holds only what is in view at the moment;
   // its built total is kept on it, and `drawn` is the part currently held.
   const groups={},meshes=[];
   view.group?.traverse(o=>{
    if(!o.isMesh)return;
    let top=o;while(top.parent&&top.parent!==view.group)top=top.parent;
    const g=o.geometry,per=(g.index?g.index.count:g.attributes.position?.count??0)/3,n=o.isInstancedMesh?(o.userData.cullTotal??o.count):1,held=o.isInstancedMesh?(o.visible?o.count:0):1;
    const key=top.name||(o.isInstancedMesh?'instanced':'mesh');
    const e=groups[key]??={meshes:0,instances:0,triangles:0,held:0,alwaysDrawn:0};
    e.meshes++;e.instances+=n;e.triangles+=per*n;e.held+=held;if(!o.frustumCulled&&o.userData.cullTotal===undefined)e.alwaysDrawn++;
    const r=o.isInstancedMesh?(o.boundingSphere?.radius??null):(g.boundingSphere?.radius??null);
    meshes.push({group:key,name:o.name||o.material?.type||'',instances:n,triangles:per*n,radius:r==null?null:Math.round(r),shadow:!!o.castShadow});
   });
   meshes.sort((a,b)=>b.triangles-a.triangles);
   return {groups,heaviest:meshes.slice(0,12),count:meshes.length,cull:view.cull?.stats()??null,ready:view.readyTimes??null};
  },
  reading:(on=true)=>{view.config.greenGrid=on;view.config.greenFlow=on;view.config.greenHeat=on;view.setGreenReading();updateHUD();return window.lab.state().reading;},
 };$('menuEndless').onclick=()=>{if(flight){toast('Finish the current shot first.');return;}openEndlessPanel();};$('menuChallenges').onclick=()=>{if(flight){toast('Finish the current shot first.');return;}challengeSetup=true;openPanel('round');};$('menuWeekly').onclick=()=>{if(flight){toast('Finish the current shot first.');return;}weeklySetup=true;openPanel('round');};$('resetPopups').onclick=()=>{popups.reset();toast('Tool windows moved back to where they start.');};
 $('aimAtPin').onclick=()=>{if(!flight)setAimPoint(course.pin);};$('aimRange').oninput=()=>{if(flight)return;touchAim();rangePlaced=true;const value=Number($('aimRange').value);if(!Number.isFinite(value)||value<=0)return;aimRange=clamp(value,.1,2000)*YARD;updateAim(false);};$('club').onchange=()=>{followClub();updateAim();updateHUD();sendPlayer();};
 holdToRepeat($('aimLeft'),n=>nudgeAim(-1,n));holdToRepeat($('aimRight'),n=>nudgeAim(1,n));
 holdToRepeat($('padLeft'),n=>nudgeAim(-1,n));holdToRepeat($('padRight'),n=>nudgeAim(1,n));
 holdToRepeat($('padFar'),n=>nudgeReach(1,n));holdToRepeat($('padNear'),n=>nudgeReach(-1,n));
 $('padPin').onclick=()=>{if(canNudgeAim())setAimPoint(course.pin);};
 $('mapExpand').onclick=()=>setAimView(!aimViewOpen);$('aimViewDone').onclick=()=>setAimView(false);
 $('holeFlyover').onclick=()=>tour?stopTour():startTour();
 // The tools button had no handler at all: openToolsBox existed and nothing
 // ever called it, so clicking Tools did nothing in any mode.
 $('toolsButton').onclick=openToolsBox;
 $('playerView').onclick=()=>cameraMode('player');$('freeView').onclick=()=>cameraMode(view.config.mode==='free'?'player':'free');$('exitExplorer').onclick=()=>cameraMode('player');$('exploreHole').onchange=()=>{const hole=Number($('exploreHole').value);stopTour();view.flyToHole(hole);updateExplorer();};$('overview').onclick=()=>cameraMode(view.config.mode==='overview'?'player':'overview');
 // The green view had no button of its own and was reachable only from a picker
 // in the camera settings -- a view you are looking THROUGH, hidden inside a
 // panel of things you set once. It joins the other three cameras, and toggles
 // back the same way they do.
 $('greenView').onclick=()=>cameraMode(view.config.mode==='green'?'player':'green');
 // NO FULLSCREEN BUTTON WHERE FULLSCREEN CANNOT HAPPEN. An iPhone's Safari has no
 // element fullscreen at all -- `requestFullscreen` does not exist there -- so
 // the button did nothing, silently. Added to the home screen the game already
 // opens without Safari's bars, which is the fullscreen an iPhone offers.
 if(!document.fullscreenEnabled)$('fullscreen').hidden=true;
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser view.');}};
 // THE WHOLE COURSE, ON THE CLIPBOARD, with no trip through the library. The
 // button used to copy the SEED, which is not enough to rebuild a course --
 // every setting that shapes it would be missing, so pasting it somewhere grew
 // different ground. This is the same code the library's "Get code" produces,
 // and it carries the name.
 //
 // It refuses for the same reasons a save refuses, in the same sentence: an
 // endless run is one hole at a time and `holes: 1` is not a value a course can
 // hold, so a code for it would be refused by the importer rather than here.
 // THE SHOT PANEL FOLDS TO ONE LINE -- carry and total -- with the chevron in
 // its header, and opens again the same way. Remembered per device. Never
 // chosen, it starts OPEN everywhere. It used to start folded on a phone, where
 // the grid would have covered the course; a phone's three tiles across the top
 // (13 October 2026) are meant to be seen. v2 since the numbers left the shot
 // controls (10 October 2026): v1 remembered the old fold, which was folded by
 // default and decided something else.
 {
  const toggle=$('shotToggle'),KEY='fairway-shot-open-v2';
  const setOpen=(open,keep=true)=>{
   $('world').classList.toggle('shot-open',open);
   toggle.setAttribute('aria-expanded',String(open));
   toggle.setAttribute('aria-label',open?'Fold the shot numbers':'Open the shot numbers');
   if(keep)try{localStorage.setItem(KEY,open?'1':'0');}catch{}
  };
  let saved=null;try{saved=localStorage.getItem(KEY);}catch{}
  setOpen(saved==null||saved==='1',false);
  toggle.onclick=()=>setOpen(!$('world').classList.contains('shot-open'));
 }
 // THE SCORE CHIPS open the scorecard, or on a practice ground pick who hits.
 $('scoreChips').onclick=e=>{
  const chip=e.target.closest('.score-chip');if(!chip)return;
  const i=Number(chip.dataset.player);
  if(rangeMode){
   if(i===round.active||round.players.length<2){openShotList(round.active);return;}
   round.active=i;updateHUD();toast(`${round.player.name} is up.`);return;
  }
  guardStudio(()=>openPanel('score'));
 };
 // Tools from the top bar, where a phone keeps it; the camera strip folds
 // behind one button on a phone and closes again once a camera is picked.
 $('barTools').onclick=openToolsBox;
 const setCams=open=>{$('world').classList.toggle('cams-open',open);$('camButton').setAttribute('aria-expanded',String(open));};
 $('camButton').onclick=e=>{e.stopPropagation();setCams(!$('world').classList.contains('cams-open'));};
 document.querySelector('.view-tools').addEventListener('click',e=>{if(e.target.closest('.tool'))setCams(false);});
 document.addEventListener('pointerdown',e=>{if($('world').classList.contains('cams-open')&&!e.target.closest('.view-tools,#camButton'))setCams(false);});
 // THE MONITOR, from the play screen: arm it or put it down -- the switch in
 // the launch monitor window and the one on the shot controls' strip are the
 // same switch as the one in Connect monitor -- and reconnect it.
 for(const el of document.querySelectorAll('.mon-arm-input'))el.onchange=()=>{armSwitch=el.checked&&monitorConnected;if($('armMonitor'))$('armMonitor').checked=armSwitch;updateHUD();sendPlayer();};
 // The window's club is the shot controls' club, shown in a second picker:
 // one value (#club) that everything reads, and this one mirrors it.
 syncClubs();
 $('monClub').onchange=()=>{$('club').value=$('monClub').value;$('club').onchange();};
 $('monReconnect').onclick=()=>{
  const url=ws?.url||lastBridgeUrl;
  if(ws){const old=ws;ws=null;old.close();setConnection(false);}
  connectBridge(url);
 };
 // ADD TO HOME SCREEN, SAID ONCE. iOS never offers it -- the option is in the
 // Share sheet, where nobody looks -- and it is the only way an iPhone plays
 // full screen. So a hosted copy opened in a browser on an iPhone or iPad says
 // so on the menu, the first time only. Never from disk, where there is no
 // address to add, and never inside the installed app. An iPad reports itself
 // as a Mac and is told apart by its touch screen.
 {
  const KEY='fairway-home-hint-v1';
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=navigator.standalone===true||!!globalThis.matchMedia?.('(display-mode: standalone)').matches;
  let seen=false;try{seen=localStorage.getItem(KEY)==='1';}catch{}
  if(ios&&!installed&&!seen&&/^https?:$/.test(location.protocol)){
   $('homeHint').hidden=false;
   try{localStorage.setItem(KEY,'1');}catch{}
  }
  $('homeHintClose').onclick=()=>{$('homeHint').hidden=true;};
 }
 $('seedButton').onclick=async()=>{
  const why=savableCourse().why;
  if(why){toast(why);return;}
  let code;
  try{code=exportCourse({name:playingCourseName(),settings,generator:GENERATOR_VERSION});}
  catch(e){toast(e.message);return;}
  if(await copyText(code))toast(`Course code for “${playingCourseName()}” copied.`);
  else toast('Could not reach the clipboard. Open Saved courses to copy the code by hand.');
 };
 $('scene').onclick=e=>{if(dropState){const p=view.pick(e.clientX,e.clientY);if(p)previewDrop(p);return;}if(flight||panel||round.holeComplete||view.config.mode==='free')return;const point=view.pick(e.clientX,e.clientY);if(point)setAimPoint(point);};
 let dragging=false,lastMouse=null;
 $('scene').addEventListener('pointerdown',e=>{if(dropState||view.config.mode!=='free')return;dragging=true;lastMouse={x:e.clientX,y:e.clientY};$('scene').setPointerCapture(e.pointerId);});
 $('scene').addEventListener('pointermove',e=>{if(!dragging||view.config.mode!=='free')return;view.rotateFree(e.clientX-lastMouse.x,e.clientY-lastMouse.y);lastMouse={x:e.clientX,y:e.clientY};});
 $('scene').addEventListener('pointerup',()=>{dragging=false;});$('scene').addEventListener('pointercancel',()=>{dragging=false;});
 $('scene').addEventListener('wheel',e=>{if(view.config.mode!=='free')return;e.preventDefault();view.moveFree(.12,-Math.sign(e.deltaY)*2,0,0);},{passive:false});
 document.querySelectorAll('[data-fly]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();keys.add(b.dataset.fly);const axis={KeyW:[1,0,0],KeyS:[-1,0,0],KeyA:[0,-1,0],KeyD:[0,1,0],KeyR:[0,0,1],KeyF:[0,0,-1]}[b.dataset.fly];view.moveFree(.12,...axis);b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.fly);});
 // A DRAG IS NOT A CLICK. The map has always been click-to-aim, and dragging it
 // would otherwise fire an aim at wherever the finger came up -- so a pointer
 // that moved more than a few pixels suppresses the click that follows it.
 //
 // TWO FINGERS ZOOM. A pinch used to reach only the first finger, which panned,
 // while the second did nothing -- on a phone the map could not be zoomed at
 // all. Every pointer on the map is tracked; with two down, the spread between
 // them zooms and the midpoint pans, so the ground under the fingers stays
 // under the fingers. Zoom about the OLD midpoint, then pan to the new one:
 // zooming about the new midpoint in the old frame and then panning as well
 // moves the map twice.
 const mapPointers=new Map();let mapMoved=false,mapPinch=null,mapPointerType='mouse';
 const pinchOf=()=>{const [a,b]=mapPointers.values();return {d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
 $('map').onpointerdown=e=>{
  if(!mapPointers.size){mapMoved=false;mapPointerType=e.pointerType;}
  const p=mapPixels(e);mapPointers.set(e.pointerId,{...p,sx:p.x,sy:p.y});
  if(mapPointers.size===2){mapPinch=pinchOf();mapMoved=true;}
  // Capture is a nicety -- it keeps the drag alive when the pointer leaves the
  // canvas -- and it must not be able to take the drag down with it if the
  // browser refuses the id. Without the guard a throw here aborts pointerdown
  // and the map simply stops responding to the mouse.
  try{$('map').setPointerCapture(e.pointerId);}catch{}
 };
 $('map').onpointermove=e=>{
  const q=mapPointers.get(e.pointerId);if(!q)return;
  const p=mapPixels(e),m=$('map').mapTransform;
  if(mapPointers.size>=2){
   mapPointers.set(e.pointerId,{...q,...p});
   if(!m||!mapPinch)return;
   const now=pinchOf();
   let nav=zoomAbout(m,mapNav(),mapPinch.x,mapPinch.y,now.d/mapPinch.d);
   nav=panBy({scale:m.scale/m.zoom*nav.zoom},nav,now.x-mapPinch.x,now.y-mapPinch.y);
   mapPinch=now;$('map').mapNav=nav;redrawMap();
   return;
  }
  if(!mapMoved&&Math.hypot(p.x-q.sx,p.y-q.sy)<5)return;
  // Re-anchored by MERGING into the stored point. An earlier version stored the
  // bare `{x,y}` that `mapPixels` returns and lost the pointer id with it, so
  // the next move failed its own guard -- the map moved once and then stopped
  // dead, which read as the drag breaking rather than as a limit.
  const dx=p.x-q.x,dy=p.y-q.y;
  mapMoved=true;mapPointers.set(e.pointerId,{...q,...p});
  if(!m)return;
  $('map').mapNav=panBy(m,mapNav(),dx,dy);
  redrawMap();
 };
 const endMapPointer=e=>{
  if(!mapPointers.delete(e.pointerId))return;
  if(mapPointers.size<2&&mapPinch){mapPinch=null;updateExplorer();}
  if($('map').hasPointerCapture?.(e.pointerId))$('map').releasePointerCapture(e.pointerId);
 };
 $('map').onpointerup=endMapPointer;
 $('map').onpointercancel=endMapPointer;
 // Zoom about the POINTER, not the centre: zooming about the centre makes the
 // map crawl away from whatever you were trying to look at.
 $('map').onwheel=e=>{
  
  const m=$('map').mapTransform;if(!m)return;
  e.preventDefault();
  const p=mapPixels(e);
  $('map').mapNav=zoomAbout(m,mapNav(),p.x,p.y,Math.exp(-e.deltaY*0.0016));
  redrawMap();updateExplorer();
 };
 // Back to the fitted frame. A zoomed map with no way home is a trap, and the
 // gesture has to be one the drag cannot swallow.
 $('map').ondblclick=()=>{resetMapNav();redrawMap();updateExplorer();toast('Map reset to fit.');};
 $('map').onclick=e=>{
  if(mapMoved){mapMoved=false;return;}
  if(flight)return;
  // A FINGER ON THE THUMBNAIL OPENS THE BIG MAP rather than aiming from it. On
  // a thumbnail a fingertip is twenty yards wide, so a tap that aimed would
  // always aim somewhere near; the big map is where it can land exactly. A
  // mouse is precise at any size and still aims straight from the thumbnail.
  if(!aimViewOpen&&mapPointerType==='touch'){setAimView(true);return;}
  const m=$('map').mapTransform,{x:mx,y:my}=mapPixels(e);
  if(dropState){const q=mapPosition(m,mx,my),p=m.full?course.toLocal(q):q;previewDrop(p);return;}
  if(m.full){setAimView(false);cameraMode('free');const {x,z}=mapPosition(m,mx,my);view.targetPos.set(x,world.height(x,z)+80,z);view.freePitch=-.7;view.updateFreeLook();return;}
  if(round.holeComplete)return;const {x,z}=mapPosition(m,mx,my);setAimPoint({x,z});
 };
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&swing&&swing.power==null){cancelSwing(true);return;}if(e.code==='Escape'&&!$('shotList').hidden){closeShotList();return;}if(e.code==='Escape'&&!$('menuDrop').hidden){closeMenuDrop();return;}if(e.code==='Escape'&&!$('clockPop').hidden){toggleClockPop(false);return;}if(e.code==='Escape'&&!$('leaveNotice').hidden){$('leaveNotice').hidden=true;return;}
 // AN OPEN PANEL IS ALWAYS ON TOP, so Escape closes it before any tool window.
 // Opening a tool closes the panel (see openTool), never the reverse, so a tool
 // window can only ever sit BEHIND a panel's blur. Escape used to take the tool
 // windows first, which meant the first press shut a window the player could
 // not see and the scorecard in front of them needed a second -- found by the
 // browser smoke test pressing Escape once and seeing nothing change. The tool
 // window is left where it was, for when the panel is gone.
 if(e.code==='Escape'&&$('world').classList.contains('cams-open')){$('world').classList.remove('cams-open');return;}
 if(e.code==='Escape'&&aimViewOpen){setAimView(false);return;}
 if(e.code==='Escape'&&panel){stopTour();if(dropState)cancelDrop();closePanel();return;}
 if(e.code==='Escape'&&!$('keysHelp').hidden){toggleKeysHelp(false);return;}if(e.code==='Escape'&&$('app').classList.contains('hud-hidden')){toggleHud(false);return;}if(e.code==='Escape'&&popups?.closeTop())return;if(e.code==='Escape'){stopTour();if(dropState)cancelDrop();closePanel();return;}if(dropState||panel||['TEXTAREA','SELECT'].includes(document.activeElement.tagName)||(document.activeElement.tagName==='INPUT'&&document.activeElement.type!=='range'))return;if(document.activeElement.type==='range'&&e.code.startsWith('Arrow'))return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.code))e.preventDefault();keys.add(e.code);tapped.add(e.code);if(view.config.mode==='free'){if(appMode!=='play')return;if(e.code==='KeyV'||e.code==='KeyC')cameraMode('player');return;}if(appMode!=='play')return;if(e.repeat)return;if(e.code==='Tab'){e.preventDefault();toggleKeysHelp();return;}if(e.code==='Space')meterPress(e.timeStamp);if(e.code==='KeyS')stepShape('curve',1);if(e.code==='KeyW')stepShape('height',1);if(e.code==='KeyX')stepShape('spin',e.shiftKey?-1:1);if(e.code==='Enter')finishShot();if(e.code==='KeyQ'||e.code==='KeyI')cycleClub(-1);if(e.code==='KeyE'||e.code==='KeyK')cycleClub(1);if(e.code==='KeyA')resetAim();if(e.code==='KeyG')stepTargetCamera();if(e.code==='KeyH')toggleHud();if(e.code==='KeyV')cameraMode('free');if(e.code==='KeyC')cameraMode(view.config.mode==='overview'?'player':'overview');});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());window.addEventListener('beforeunload',save);
 window.addEventListener('gamepadconnected',e=>toast('Controller connected: '+e.gamepad.id));
}
// The top-bar clock. Lives in the header rather than over the scene: it is a
// setting you reach for, not information you read mid-swing, and the 3D HUD is
// already carrying wind, lie and elevation.
//
// The label is rewritten only when the displayed string would actually change,
// which at real time is once a minute rather than 120 times a second.
let clockText='',clockPhase='';
function updateClock(){
 const d=view?.daylight;if(!d||d.hour===null||!view.solar)return;
 const text=formatClock(d.hour),phase=phaseName(view.solar);
 if(text!==clockText){clockText=text;$('clockLabel').textContent=text;}
 if(phase!==clockPhase){
  clockPhase=phase;
  $('clockIcon').innerHTML=`<i data-lucide="${PHASE_ICONS[phase]}"></i>`;
  icon();
 }
 $('clockButton').classList.toggle('running',d.rate>0);
 if(!$('clockPop').hidden)syncClockPop();
}

function syncClockPop(){
 const d=view.daylight,solar=view.solar;
 const read=$('clockPop').querySelector('.clock-read');
 if(read){
  read.textContent=formatClock(d.hour);
  $('clockPop').querySelector('.clock-sub').textContent=
   `${phaseName(solar)==='day'?'Daylight':phaseName(solar)==='night'?'Night':phaseName(solar)==='dawn'?'Sunrise':'Sunset'} · sun ${solar.elevation.toFixed(0)}° · ${RATE_LABELS[d.rate]}`;
 }
 const slider=$('timeHour');if(slider&&document.activeElement!==slider)slider.value=d.hour.toFixed(2);
 for(const chip of $('clockPop').querySelectorAll('.time-chip[data-rate]'))
  chip.classList.toggle('active',Number(chip.dataset.rate)===d.rate);
}

function buildClockPop(){
 const d=view.daylight;
 $('clockPop').innerHTML=`<div class="clock-read"></div><div class="clock-sub"></div>
  <input id="timeHour" type="range" min="0" max="23.99" step="0.01" value="${d.hour.toFixed(2)}" aria-label="Hour">
  <h4>Jump to</h4><div class="time-grid">${PRESETS.map(([label,hour])=>`<button class="time-chip" data-hour="${hour}">${label}</button>`).join('')}</div>
  <h4>Time passes</h4><div class="time-grid">${TIME_RATES.map(r=>`<button class="time-chip" data-rate="${r}">${RATE_LABELS[r]}</button>`).join('')}</div>
  <label class="check"><input id="timeSync" type="checkbox" ${d.syncToLocal?'checked':''}> Start at my local time</label>
  <label class="check"><input id="timeGlow" type="checkbox" ${d.glowBall!==false?'checked':''}> Glow ball after dark</label>
  <label class="check"><input id="timeFog" type="checkbox" ${d.fog!==false?'checked':''}> Morning fog &amp; haze</label>
  <label class="check"><input id="timeFloods" type="checkbox" ${d.floodlights?'checked':''}> Floodlight the course</label>
  <p class="note">Poles down alternating sides of every hole, spaced the way a sports field is lit. Off by default: nothing is built into the skyline and nothing is lit until you ask for it.</p>
  ${slider('timeFloodStrength','Floodlight strength',Math.round((d.floodStrength??1)*100),0,200,'%',5)}
  ${slider('timeGlowStrength','Glow ball strength',Math.round((d.glowStrength??1)*100),0,200,'%',5)}
  <p class="note">How bright the floodlights and the glow ball are, against how Fairway tunes them (100%). The glow ball only glows after dark.</p>`;
 const setHour=h=>{claimClock();d.hour=wrapHour(h);view.solar=solarState(d.hour,world.bio.sun);saveDaylight(d);updateClock();};
 $('timeHour').oninput=e=>setHour(Number(e.target.value));
 for(const chip of $('clockPop').querySelectorAll('.time-chip[data-hour]'))
  chip.onclick=()=>setHour(Number(chip.dataset.hour));
 for(const chip of $('clockPop').querySelectorAll('.time-chip[data-rate]'))
  chip.onclick=()=>{claimClock();d.rate=Number(chip.dataset.rate);saveDaylight(d);updateClock();};
 $('timeSync').onchange=e=>{claimClock();d.syncToLocal=e.target.checked;if(e.target.checked)setHour(localHour());else saveDaylight(d);};
 $('timeGlow').onchange=e=>{claimClock();d.glowBall=e.target.checked;saveDaylight(d);};
 $('timeFog').onchange=e=>{claimClock();d.fog=e.target.checked;saveDaylight(d);};
 $('timeFloods').onchange=e=>{claimClock();d.floodlights=e.target.checked;saveDaylight(d);view.setFloodlights(d.floodlights);};
 // Uniform writes the next frame picks up (the lamps and the ball are both set
 // every frame from these): nothing rebuilds. Not `claimClock`: a brightness is
 // not a time, and moving it should not stop the clock following the device.
 wireSliders($('clockPop'));
 $('timeFloodStrength').oninput=e=>{d.floodStrength=Number(e.target.value)/100;saveDaylight(d);};
 $('timeGlowStrength').oninput=e=>{d.glowStrength=Number(e.target.value)/100;saveDaylight(d);};
 syncClockPop();
}

// The hamburger dropdown. Same shape as the sim-time popover so there is one
// pattern for "a small menu hanging off the top bar", not two.
function toggleMenuDrop(open){
 const drop=$('menuDrop');
 const next=open===undefined?drop.hidden:open;
 drop.hidden=!next;
 $('menuNav').setAttribute('aria-expanded',String(next));
 if(next){toggleClockPop(false);icon();}
}
const closeMenuDrop=()=>toggleMenuDrop(false);

function toggleClockPop(open){
 const pop=$('clockPop');
 const next=open===undefined?pop.hidden:open;
 if(next&&(!view?.daylight||view.daylight.hour===null))return;
 pop.hidden=!next;
 $('clockButton').setAttribute('aria-expanded',String(next));
 if(next){closeMenuDrop();buildClockPop();}
}

let gamepadActive=false;
// AUTOMATIC RESOLUTION (F4). The decision is auto-resolution.js; this feeds it
// one interval per rendered frame and applies the answer. The tier (and the
// display's own pixel ratio) set the ceiling, and a change of either starts it
// again from the sharpest step. Held, not reset, while the page is hidden or the
// loading screen is up: those frames say nothing about play.
const autoRes=createAutoResolution();let autoResKey='';
function autoResolutionNote(){
 const n=$('gfxAutoResNow');if(!n)return;
 const s=view?.resolutionScale??1;
 n.textContent=!graphics.autoResolution?'':s<1?`Drawing at ${Math.round(s*100)}% of this setting's resolution right now.`:'Drawing at full resolution right now.';
}
function autoResolutionFrame(now,interval){
 if(!view)return;
 if(!graphics.autoResolution){if(view.resolutionScale!==1){autoRes.stop(now);view.setResolutionScale(1);autoResolutionNote();}autoResKey='';return;}
 const key=graphics.quality+':'+view.pixelCeiling();
 if(key!==autoResKey){autoResKey=key;autoRes.setCeiling(view.pixelCeiling(),now);if(view.resolutionScale!==1){view.setResolutionScale(1);autoResolutionNote();}}
 if(document.hidden||$('generating')?.hidden===false){autoRes.hold(now);return;}
 const scale=autoRes.sample(interval,now,graphics.frameCap);
 if(scale!==view.resolutionScale){view.setResolutionScale(scale);autoResolutionNote();}
}
function tick(now){
 requestAnimationFrame(tick);
 // A cap trades refresh for headroom: skip the frame instead of rendering one
 // the display will not show. Zero means follow the display.
 if(graphics.frameCap&&now-lastTick<1000/graphics.frameCap-.5)return;
 diagnosticFrames.sample(now-lastTick);
 if(gameAudio&&view?.world&&now-lastSoundScene>1000){lastSoundScene=now;updateSoundScene();}
 autoResolutionFrame(now,now-lastTick);
 const dt=Math.min((now-lastTick)/1000,.05);lastTick=now;
 updateClock();
 const pad=navigator.getGamepads?.()?.find?.(p=>p&&p.mapping==='standard');
 if(!!pad!==gamepadActive){gamepadActive=!!pad;$('inputStatus').innerHTML=pad?'<i data-lucide="gamepad-2"></i> Controller connected <span class="tiny-dot"></span> Ready to play':'<i data-lucide="keyboard"></i> Mouse & keyboard <span class="tiny-dot"></span> Ready to play';icon();}
 const pressed=i=>pad?.buttons[i]?.pressed&&!gamepadLast[i];
 if(pad){if(pressed(1)){if(panel)closePanel();else finishShot();}if(!panel&&!dropState){if(pressed(0))meterPress(performance.now());if(pressed(14))stepShape('curve',-1);if(pressed(15))stepShape('curve',1);if(pressed(12))stepShape('height',1);if(pressed(13))stepShape('height',-1);if(pressed(2))stepShape('spin',1);if(pressed(4))cycleClub(-1);if(pressed(5))cycleClub(1);if(pressed(3))cameraMode(view.config.mode==='overview'?'player':'overview');}gamepadLast=pad.buttons.map(b=>b.pressed);}else gamepadLast=[];
 if(appMode==='menu'&&menuBackdrop)orbitBackdrop();
 if(appMode!=='menu'&&!tour&&!panel&&!dropState&&view.config.mode==='free'){const k=c=>keys.has(c)?1:0;view.moveFree(dt,k('KeyW')-k('KeyS')-(Math.abs(pad?.axes[1]||0)>.15?pad.axes[1]:0),k('KeyD')-k('KeyA')+(Math.abs(pad?.axes[0]||0)>.15?pad.axes[0]:0),k('KeyR')-k('KeyF'),keys.has('ShiftLeft')||keys.has('ShiftRight'));view.rotateFree((k('ArrowLeft')-k('ArrowRight'))*dt*260+(Math.abs(pad?.axes[2]||0)>.15?-pad.axes[2]*dt*260:0),(k('ArrowDown')-k('ArrowUp'))*dt*220+(Math.abs(pad?.axes[3]||0)>.15?pad.axes[3]*dt*220:0));drawMap($('map'),flight?.replay?view.course:course,flight?.replay?lastShot.shot.origin:round.position,round.candidates,true,view.camera.position,flight||dropState?null:aimPoint,view.elapsed);$('flightAltitude').textContent=Math.round(view.camera.position.y-world.height(view.camera.position.x,view.camera.position.z))+' m above ground';}
 if(appMode==='play'&&!panel&&!dropState&&!flight&&!round.holeComplete&&view.config.mode!=='free'){const held=c=>keys.has(c)||tapped.has(c);let turn=(held('ArrowRight')?1:0)-(held('ArrowLeft')?1:0),power=(held('ArrowUp')?1:0)-(held('ArrowDown')?1:0);if(pad){if(Math.abs(pad.axes[0])>.15)turn+=pad.axes[0];if(Math.abs(pad.axes[1])>.15)power-=pad.axes[1];}if(!power)reachHeldFor=0;if(swing)turn=power=0;if(turn||power){if(turn)aimTurned=true;aim+=aimDelta(turn,dt*18);if(power)walkReach(power,dt);touchAim();updateAim();view.setCamera(round.position,aim);}}
 // THE SWING METER moves on the clock, not on frames (swing-meter.js); this only
 // draws where it is and lets the clock finish a swing nobody tapped.
 if(swing){meterAdvance(swing,now);if(swing.done)releaseSwing();else{drawMeter(now);gameAudio?.meterMove(markerAt(swing,now),swing.power==null?'power':'strike');if(!swing.overSounded&&inOverswing(swing,now)){swing.overSounded=true;gameAudio?.meterSound('overswing');}}}
 // Once per rendered frame, whether or not the aim block above ran: a tap is
 // owed to the next frame that can use it, not saved up behind an open panel.
 tapped.clear();
 // THE BIG MAP GIVES WAY to anything that needs the screen: a ball in the air,
 // a panel, the flyover, the menu. Checked every frame for the same reason as
 // the reading tools below -- each of those starts several ways.
 if(aimViewOpen&&(flight||panel||tour||appMode==='menu'))setAimView(false);
 // A BALL IN THE AIR CLEARS THE SCREEN: the shot panel, the cameras, the aim
 // pad and the like step aside until it settles, leaving the top bar, the
 // wind, the map and the shot panel. Every frame, for the same reason as the
 // line above -- a flight starts and ends several ways.
 if($('world').classList.contains('in-flight')!==!!flight)$('world').classList.toggle('in-flight',!!flight);
 // The panel's carry and total count up with the ball, so they are drawn every
 // frame of a flight, not once at its start the way the flight bar's fixed
 // numbers were.
 if(flight)drawLiveTiles();
 // While the scorecard is up, the hole is on screen behind it: every tracer of
 // it, from a slow orbit that keeps tee and green in the same frame.
 if(summaryCamera&&!flight){holeSummary+=dt;view.summaryOrbit(holeSummary);}
 // The flyover circles the whole hole now, so there is no moment where it
 // arrives at the green and the contour heat map becomes the thing to look at.
 if(tour){tour.elapsed+=dt;const pose=tour.path.pose(tour.elapsed);$('flightAltitude').textContent='Hole flyover · Circling the hole';drawMap($('map'),course,round.position,round.candidates,true,pose.eye,null,view.elapsed);view.targetPos.copy(pose.eye);view.targetLook.copy(pose.target);view.camera.position.copy(pose.eye);view.look.copy(pose.target);if(pose.done)stopTour();}
 if(flight){const heardFrom=flight.elapsed;flight.elapsed+=dt*FLIGHT_PLAYBACK*timeScale;playFlightSounds(flight,heardFrom);const pts=flight.result.points;while(flight.index<pts.length-1&&pts[flight.index+1].t<flight.elapsed)flight.index++;const a=pts[flight.index],b=pts[Math.min(flight.index+1,pts.length-1)],f=clamp((flight.elapsed-a.t)/(b.t-a.t||1),0,1),p={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f};
  // The drawn ball skips a little while it rolls (roll-hop.js); `p` itself, which
  // the trail and the camera use, is the simulated position, untouched.
  flight.hop??=createRollHop(seedFor(flight.result));
  // Touching at both ends of the step, each against its own ground: on a slope
  // the ground under the midpoint is not the ground under either end.
  const ground=q=>course.height(q.x,q.z)+BALL_R+.004>=q.y,rolling=ground(a)&&ground(b),hopSpeed=Math.hypot(b.x-a.x,b.z-a.z)/((b.t-a.t)||1);
  const lift=flight.hop.step(dt*FLIGHT_PLAYBACK*timeScale,hopSpeed,course.surface(p.x,p.z),rolling&&flight.elapsed<flight.result.time);
  view.rollHopLift=lift;view.setBall(lift?{...p,y:p.y+lift}:p);flight.hold=(flight.hold||0)+dt*timeScale;flight.at=p;
  // THE ATTENDED PIN: on a shot the physics play with the pin out (on the
  // green, or the putter in hand), it stands in the cup until the ball is
  // within PIN_ATTEND_M, then lifts clear before the ball arrives.
  {const r=flight.record,pin=(flight.replay?view.course:course).pin;
   if((r?.pinOut??(r?.putting||r?.shot?.vla===0))&&Math.hypot(p.x-pin.x,p.z-pin.z)<PIN_ATTEND_M)view.liftFlag();}
  if(now-lastMapFrame>60){lastMapFrame=now;redrawMap();}
  // THE CAMERA DURING A SHOT. A putt keeps its own follow camera; a full shot
  // is filmed by the television pair (tv-camera.js) -- the tee camera turning
  // with the ball, then the landing camera -- and once the ball stops, the
  // camera flies up to show the whole shot, if the player has that on.
  const tvOn=view.config.follow&&flight.tv&&!flight.result.puttStroke&&!['overview','free'].includes(view.config.mode);
  if(flight.reviewing){}
  else if(tvOn){if(!flight.tvStarted){flight.tvStarted=true;view.tvShot(flight.tv);}view.tvFollow(p,flight.elapsed);}
  else if(flight.hold>=CAMERA_HOLD||flight.result.puttStroke)view.follow(p,flight.replay?flight.aim:aim,!!flight.result.puttStroke);
  if(flight.elapsed>=flight.result.time&&!flight.reviewing){flight.reviewing=true;if(tvOn&&view.config.review!==false){const pose=planReview({points:flight.result.points,toWorld:q=>view.course.toWorld(q),groundAt:(x,z)=>view.world.height(x,z),trees:view.world.trees,fov:view.camera.fov,aspect:view.camera.aspect});if(pose){view.tvReview(pose);flight.reviewed=true;}}}view.setTrail(trailUpTo(pts,flight.elapsed-TRACER_LAG,flight.index+1));if(flight.elapsed>=flight.result.time){if(flight.replay){flight.endHold=(flight.endHold||0)+dt;liveLine(`Final lie · returning in ${Math.max(0,Math.ceil(REPLAY_HOLD_SECONDS-flight.endHold))}s`);if(replayFinished(flight.elapsed,flight.result.time,flight.endHold))finishShot();}else{flight.endHold=(flight.endHold||0)+dt;const need=flight.reviewed?REVIEW_HOLD_SECONDS:flight.result.holed?HOLED_HOLD_SECONDS:SHOT_HOLD_SECONDS;liveLine(`Final lie · playing on in ${Math.max(0,Math.ceil(need-flight.endHold))}s`);if(shotSettled(flight.elapsed,flight.result.time,flight.endHold,need)){finishShot();sendPlayer();}}}}
 if(!flight&&!dropState&&view.config.mode!=='free'&&now-lastMapFrame>80){lastMapFrame=now;drawMap($('map'),course,round.position,round.candidates,view.config.mode==='overview',view.camera.position,aimPoint,view.elapsed);}
 // The reading tools come off while the ball is moving. Driven from the state
 // every frame rather than flipped at the two ends of a shot: a shot starts and
 // finishes several ways -- struck, replayed, skipped, settled -- and a flag set
 // at each of them is one that eventually gets missed at one of them. It did,
 // when this lived in updateExplorer, which does not run per shot.
 view.setReadingHidden(!!flight);
 // Not while the graphics card is preparing a new course (GolfView.ready):
 // a frame drawn then uses programs the driver has not finished, and blocks
 // the page until it has -- the loading screen froze during a wait that is
 // meant to leave it moving. The overlay is up; the frame it would cover is
 // drawn by `ready` itself as soon as the programs are done.
 if(!view.readying)view.render(dt);
 setWindArrow();
 const worldLabels=!flight&&view.config.mode!=='free';
 // ON THE GREEN THE MARKER IS THE ONLY DISTANCE THERE IS, because the
 // flagstick has been pulled and there is nothing left out there to judge
 // against. So it stops being a thing floating over the pin that can drift off
 // the edge, and becomes a marker that clamps to the nearest edge and turns to
 // point at the cup. Everywhere else it behaves as it did -- over the flag,
 // hidden when the flag is not in view.
 const pin=course.pin,pinTop={x:pin.x,y:course.height(pin.x,pin.z)+(ballOnGreen?.2:6),z:pin.z};
 const flagEl=$('flagLabel');
 // The narrow-screen rule hides this marker, which is right everywhere except
 // on the green, where it is the only distance there is. The class is what
 // lets the stylesheet tell those two apart.
 flagEl.classList.toggle('putting',!!ballOnGreen);
 if(ballOnGreen&&worldLabels){
  const m=view.projectMarker(pinTop,hudInsets(now));
  flagEl.style.left=m.x+'px';flagEl.style.top=m.y+'px';
  flagEl.style.visibility='visible';
  flagEl.classList.toggle('edge',m.clamped);
  flagEl.style.setProperty('--point',m.angle.toFixed(1)+'deg');
 }else{
  const label=view.project(pinTop);
  flagEl.style.left=label.x+'px';flagEl.style.top=label.y+'px';
  flagEl.style.visibility=label.visible&&worldLabels?'visible':'hidden';
  flagEl.classList.remove('edge');
 }
 // THE AIM POINT, read where you are looking rather than in a bar at the bottom.
 // Lower than the pin's marker (3 m against 6) because it marks a spot on the
 // ground, not a flag, and a label floating at flag height over bare fairway
 // reads as another pin.
 if($('aimLabel')){
  const a=aimPoint;
  // Hidden when it would sit on top of the flag: within 8 m the two markers
  // overlap and you get one unreadable pile instead of two labels.
  const nearPin=a&&Math.hypot(a.x-pin.x,a.z-pin.z)<8;
  // ON THE GREEN it is shown for every golfer: since the putt preview went (14
  // October 2026) the aim point is how far you mean to hit the putt, as it
  // always was off a monitor. (By hand it used to be hidden there, because the
  // roll preview drew where the putt finished.)
  // While the player is aiming the pin's label has faded out, so there is no
  // pile for the 8 m rule to prevent; it applies only at rest. Without this the
  // aim label vanished as the aim crossed the pin (owner, 11 October 2026).
  const recent=now-aimTouchedAt<AIM_LABEL_HOLD;
  const show=!!a&&worldLabels&&(!nearPin||recent)&&!dropState;
  $('aimLabel').hidden=!show;
  // THE TWO LABELS TAKE TURNS (10 October 2026, the owner's call). They sat side
  // by side and from the tee often on top of each other -- "340 YARDS TO HOLE"
  // over "257 TO AIM POINT". Now the pin's distance is the one at rest; moving
  // the aim fades it out and the aim point's in, and a moment after the aim
  // stops the two change back. The stylesheet does the fading.
  const aiming=show&&recent;
  $('aimLabel').classList.toggle('faded',!aiming);
  flagEl.classList.toggle('faded',aiming);
  if(show){
   const q=view.project({x:a.x,y:course.height(a.x,a.z)+3,z:a.z});
   $('aimLabel').style.left=q.x+'px';$('aimLabel').style.top=q.y+'px';
   $('aimLabel').style.visibility=q.visible?'visible':'hidden';
   const d=Math.hypot(a.x-round.position.x,a.z-round.position.z);
   $('aimLabelDistance').textContent=d<10?`${(d/.3048).toFixed(1)} ft`:String(Math.round(d/YARD));
   // RISE TO THE AIM POINT, in feet, the same convention the map footer uses
   // for the pin. Shown even at zero rather than appearing past a threshold:
   // the aim point moves continuously, and a readout that blinks in and out
   // as it crosses a boundary is worse than one that sometimes says nothing
   // is happening. `course.height` is hole-local, which is what `a` already is.
   if($('aimLabelRise')){
    const rise=(course.height(a.x,a.z)-course.height(round.position.x,round.position.z))*3.28084;
    $('aimLabelRise').textContent=`${rise<-.5?'↘':rise>.5?'↗':'→'} ${Math.abs(rise).toFixed(0)} FT`;
   }
  }
 }
}
try{
 // Text size first: the view measures its canvas as it is built.
 applyUiScale();addEventListener('resize',applyUiScale);
 view=new GolfView($('scene'),graphics.quality);
 gameAudio=createGameAudio();
 // The saved cue switches, before the first course is built. `build` re-applies
 // them per course, because the ground material is rebuilt with the world.
 view.setGroundCues(graphics);view.setTerrainShadows(graphics.terrainShadows);view.setReflections(graphics.reflections);view.setFloodShadows(graphics.floodlightShadows);view.setDistantFlags(graphics.distantFlags);
 // A saved round is parsed but not loaded: it waits until the player asks to
 // continue it, so opening Fairway shows the menu rather than someone else's
 // half-finished hole.
 try{const stored=localStorage.getItem('fairway-round-v1');if(stored){const d=JSON.parse(stored);staleGenerator=validateSave(d);pendingRound=Round.restore(d.round);settings=d.settings?.range?courseFallback(d.settings):{...DEFAULT_COURSE,...d.settings};if(pendingRound.holes===3){pendingRound=new Round({players:pendingRound.players,mode:pendingRound.mode,holes:9,gimme:pendingRound.gimme});staleGenerator=false;}applyRoundCamera(d.camera);}}catch{pendingRound=null;}
 adoptDeviceBag();syncClubs();delete settings.flightProfile;
 await whileGenerating('Starting Fairway…',()=>loadMenuBackdrop(),true);
 bind();layout=createLayout($('world'));popups=createPopups($('world'),{onChange:()=>{icon();syncTools();}});icon();requestAnimationFrame(tick);
 openMenu();
 if(!profiles)showWelcome();
 // THE SPLASH WAITS FOR SMOOTH FRAMES. The menu hole's first real frames carry
 // one-off costs the loading work cannot reach -- the first render with a moving
 // camera, the cull's first sort, the grass ring -- and one of them landed in
 // the splash's fade: 133 ms on Ultra, a visible stutter on the first thing a
 // player sees (the owner). So the loop runs and the menu opens under the
 // splash, and it fades only once frames come steadily, or after two seconds
 // whatever happens, so a slow machine is never kept on a black screen.
 await smoothFrames();
 dismissSplash();
}catch(e){console.error(e);dismissSplash();$('world').innerHTML=`<div class="fatal"><div><h1>Let’s get you on the course.</h1><p>This simulator needs WebGL 2. Enable hardware acceleration or open it in a current Chrome, Edge, Firefox, or Safari browser.</p><p>${escape(e.message)}</p></div></div>`;}
