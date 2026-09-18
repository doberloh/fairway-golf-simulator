// Single source of truth for every generated-course setting. Defaults, bounds,
// categories, help text, validation and migration all derive from this list, so
// a new control cannot drift out of step with its validator or its save format.
//
// Two versions, deliberately separate:
//   SCHEMA_VERSION    the shape of a settings object. Renaming, adding or
//                     removing a control bumps this. Migrated silently.
//   GENERATOR_VERSION the behaviour of the generator. Any change that moves
//                     ground for a given seed bumps this. It CANNOT be
//                     migrated: the same settings simply build different
//                     terrain afterwards, so a mismatch is put to the player
//                     rather than applied behind their back.
export const SCHEMA_VERSION=5;
// 2: pond shelves that overlap now settle to one shared level. Ponds on sloping
//    ground previously sank metres below their own banks, so terrain around
//    water moved for every seed.
// 3: houses gained varied forms that draw from the same seeded stream, moving
//    their siting, and pond shelves follow the pond's own oval instead of a
//    circle, so they no longer bulldoze the ground around an elongated pond.
// 4: footbridges removed. Walking routes cross channels on the ground again, so
//    contact height and surface are read straight off the terrain everywhere.
// 5: channels are trimmed to the run they can hold within MAX_CUT and faded at
//    a trimmed end instead of being trenched across the map; tee pads terrace
//    against the shaped field on a relief-adaptive ramp; the fairway always
//    starts past the back tee; pond shelf margins scale with the pond.
// 6: tee pads gained a mown collar. Trees and houses site themselves off the
//    classified surface, so both step back from a tee that now reads as
//    maintained ground rather than rough.
// 7: par threes trade their full fairway for a short approach in front of the
//    green, no wider than the green and no longer than the last 45% of the
//    hole, and every par-three bunker is greenside. Mown turf now starts at
//    mowStart; fairwayStart still anchors hazards, so par threes keep them.
// 8: links loses its pines. True linksland is effectively treeless -- salt
//    spray and wind keep trees off it -- so the 12% pine share moved to gorse,
//    heather and low scrub, and the stunting hack that shrank links pines to
//    40% height went with it.
// 9: houses are built at a believable size. They were 10 x 9 m and 5.4 m to the
//    ridge -- a third the height of a median tree, small enough to stand on a
//    tee apron -- and are now about 20 x 16 m and 8.9 m, near half a tree. Their
//    footprint decides where trees may stand and what a ball collides with, so
//    the ground around them moves; siting spacing, corner probes and the slope
//    tolerance all scaled with them.
// 10: pins move by the day and cups are cut to match, so greens and cup sites
//     changed for unchanged seeds. (This entry was missing; recovered from the
//     TODO record of the bump rather than left as a gap in the history.)
// 11: water and the ground around it, in one pass. Ponds, lakes, rivers and
//     creeks are excavated like bunkers instead of rising to meet the land --
//     the surface sits a freeboard below its rim and the bank is cut over a
//     couple of metres, where it used to ramp over fourteen to twenty-four. The
//     ocean instead gained a shaped foreshore and a real beach, which lowers
//     coastal ground up to BEACH_TOP. Island courses carry no inland water at
//     all; channels are trimmed at the shoreline and chosen for crossing the
//     course rather than for length; a pond may now reach into or across a
//     fairway. The shoreline is refined in the ground mesh for the first time.
//     And `nearest` stopped switching its greenside allowance on an exact float
//     equality, which had been tearing the landform past every green in every
//     biome -- so ground moves on EVERY course, not only those with water.
// 12: watercourses are routed by descending the land instead of being drawn
//     across it. A channel was a bearing plus three harmonics -- a sine wave
//     with no reference to the ground -- and terrain entered only afterwards as
//     an excavation budget, so every channel was a trench: a median cut of 2 to
//     9.5 m below the surface along its whole length, reaching 21 m, with water
//     falling 5.4 m over ground that fell 0.7. Now the walk follows the slope,
//     the harmonics bend the heading rather than being the path, and the turn
//     per step is capped so curvature cannot beat the channel's own banks.
//     Median cut is 0.4 to 2.9 m and channels run two to three times longer.
//     Every course with a river or a creek is reshaped.
export const GENERATOR_VERSION=19;

// Held here rather than imported so this module stays free of cycles with
// course.js. tests/settings-schema.test.mjs asserts both lists stay in step.
export const BIOME_KEYS=['pnw','desert','mountain','links','midwest','island','autumn'];
export const FOOTPRINT_KEYS=['organic','oval','crescent','ribbon','square','figure8','butterfly','clover','spiral','horseshoe','triangle','diamond','coast','archipelago'];

// Third entry is a note for the group, used where the context belongs to the
// whole category rather than to any one control.
export const CATEGORIES=[
 ['course','Course','Yardage is measured from the blue tees. All three tee sets are always built; you pick yours when you play.'],
 ['landscape','Landscape'],
 ['routing','Routing','Left and right turns are balanced across the course, and each turning point varies up to 22 points either side of your setting.'],
 ['turf','Fairways & greens'],
 ['bunkers','Bunkers'],
 ['ponds','Ponds & lakes','Depths set the deepest point; every shore still slopes to nothing at the bank.'],
 ['streams','Rivers & creeks','Channels may cross fairways, but route around tees, greens, ponds and bunkers. A course with no room simply gets fewer of them.'],
 ['scenery','Trees & scenery'],
 ['weather','Weather'],
];

export const SETTINGS=[
 {key:'holes',category:'course',kind:'choice',options:[9,18],def:9,label:'Holes',tip:'How many holes the course contains. A saved course is fixed at this length.'},
 {key:'courseYards',category:'course',kind:'range',min:s=>s.holes*110,max:s=>s.holes*470,step:10,unit:' yd',def:3240,label:'Course length',tip:'Target total yardage from the blue tees. Par stays within 68–72 for eighteen holes or 34–36 for nine; past those limits the holes keep changing length while par holds.'},
 {key:'seed',category:'course',kind:'text',max:50,def:'EVERGREEN',label:'Course seed',tip:'The same seed and settings rebuild the same course, within one generator version.'},

 {key:'biome',category:'landscape',kind:'choice',options:BIOME_KEYS,def:'pnw',label:'Surroundings',tip:'Regional planting, ground colours, light, temperature and altitude.'},
 {key:'landform',category:'landscape',kind:'range',min:0,max:100,step:1,unit:'%',def:70,label:'Landscape character',tip:'How strongly the land rises between playing corridors: inter-hole mountains, dunes or island channels.'},
 {key:'elevation',category:'landscape',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Elevation severity',tip:'Height change along the playing corridors. At the top end a hole climbs or falls tens of metres, while tees and greens keep gentle surfaces.'},
 {key:'blindTees',category:'landscape',kind:'range',min:0,max:100,step:5,unit:'%',def:0,label:'Blind tee shots',tip:'How often a tee shot is left blind. A tee complex is normally raised until the shot clears the ground in front of it; this is the share of holes allowed to keep the hidden landing area instead. Only holes the land makes blind are affected, so the true rate tops out around one in five.'},

 {key:'footprint',category:'routing',kind:'choice',options:FOOTPRINT_KEYS,def:'organic',label:'Course footprint',tip:'A guiding shape for the whole routing. It steers land use; individual holes stay procedural, so the silhouette is an intention rather than a guarantee.'},
 {key:'spacing',category:'routing',kind:'range',min:8,max:65,step:1,unit:' m',def:18,label:'Space between hole corridors',tip:'Clearance kept between neighbouring corridors when packing the routing.'},
 {key:'doglegs',category:'routing',kind:'range',min:0,max:100,step:1,unit:'%',def:65,label:'Dogleg frequency',tip:'Share of par 4s and 5s that bend. Par 3s are always straight. Left and right turns are balanced across the course.'},
 {key:'doglegAngle',category:'routing',kind:'range',min:0,max:70,step:1,unit:'°',def:45,label:'Maximum dogleg turn',tip:'The largest turn a dogleg may take.'},
 {key:'doglegPosition',category:'routing',kind:'range',min:30,max:75,step:1,unit:'% along hole',def:55,label:'Dogleg turning point',tip:'Where the bend sits along the hole. Each hole varies up to 22 points either side of this.'},

 {key:'width',category:'turf',kind:'range',min:20,max:70,step:1,unit:' m',def:38,label:'Typical fairway width',tip:'A guideline, not a constant. Each side is generated independently, so the fairway widens into landing areas and pinches at approaches.'},
 {key:'fringe',category:'turf',kind:'range',min:0,max:6,step:.25,unit:' m',def:2,label:'Green fringe width',tip:'The closely mown collar around each green.'},
 {key:'semiRough',category:'turf',kind:'range',min:0,max:15,step:.5,unit:' m',def:6,label:'Semi-rough width',tip:'The intermediate cut between fairway and rough.'},
 {key:'greenDifficulty',category:'turf',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Green slope & difficulty',tip:'Slope and contour on the putting surfaces. At 0 greens are level; higher settings add broad tilts, crossing ridges and hollows.'},

 {key:'pinDay',category:'turf',kind:'choice',options:['Thursday','Friday','Saturday','Sunday'],def:'Thursday',label:'Pin difficulty',tip:'Which day of a tournament the cups are cut for. Thursday takes the flattest ground with the most green around it; Friday, Saturday and Sunday move to progressively more slope and tighter edges. No day will cut a cup somewhere a ball cannot come to rest. Hole locations work front, middle, back and around again as the round goes on.'},

 {key:'bunkerCount',category:'bunkers',kind:'int',min:0,max:8,step:1,def:5,label:'Bunkers per hole · up to',tip:'An upper target. Placements that would overlap a green, tee or pond are dropped, so holes often carry fewer.'},
 {key:'fairwayBunkers',category:'bunkers',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Fairway bunker occurrence',tip:'Chance that each non-greenside bunker sits inside the fairway rather than beside it, creating a choice of landing lines.'},
 {key:'bunkerGap',category:'bunkers',kind:'range',min:0,max:15,step:.5,unit:' m',def:2,label:'Greenside bunker gap from fringe',tip:'Turf left between a greenside bunker and the fringe. Zero lets them touch.'},

 {key:'water',category:'ponds',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Pond frequency',tip:'How often a pond is attempted on each hole. Large ponds crowd each other and the corridors, so high settings place fewer than requested. Island courses have no inland water: the ocean is the hazard.'},
 {key:'pondSize',category:'ponds',kind:'range',min:40,max:300,step:10,unit:' m',def:120,label:'Typical pond size',tip:'Scales both pond dimensions. Banks are anchored outside the fairway edge, so a larger pond grows away from play rather than into it.'},
 {key:'waterMin',category:'ponds',kind:'range',min:.2,max:8,step:.1,unit:' m',def:.5,label:'Minimum water hazard depth',tip:'The shallowest a pond’s deepest point may be. Shores still slope to nothing at the bank.'},
 {key:'waterMax',category:'ponds',kind:'range',min:.2,max:12,step:.1,unit:' m',def:2.5,label:'Maximum water hazard depth',tip:'The deepest a pond’s deepest point may be. Coastal channel floors respect this too.'},
 {key:'lakes',category:'ponds',kind:'int',min:0,max:3,step:1,def:0,label:'Large lakes',tip:'Open water placed away from the playing corridors, using the pond depth range above. Not placed on island courses, where the ocean is the hazard.'},
 {key:'lakeSize',category:'ponds',kind:'range',min:60,max:460,step:10,unit:' m',def:160,label:'Typical lake diameter',tip:'At the top of the range open ground runs out and fewer lakes are placed than requested.'},

 {key:'rivers',category:'streams',kind:'int',min:0,max:2,step:1,def:0,label:'Rivers',tip:'Wide meandering channels that may cross fairways or run between holes. Tees, greens, ponds and bunkers are routed around. Not placed on island courses, where the ocean is the hazard.'},
 {key:'creeks',category:'streams',kind:'int',min:0,max:3,step:1,def:0,label:'Creeks',tip:'Narrow meandering channels. Each channel draws its own bearing, so creeks and rivers never run parallel. Not placed on island courses, where the ocean is the hazard.'},
 {key:'riverWidth',category:'streams',kind:'range',min:6,max:30,step:1,unit:' m',def:14,label:'River width',tip:'Width of the open water in a river channel.'},
 {key:'creekWidth',category:'streams',kind:'range',min:1.5,max:6,step:.5,unit:' m',def:3,label:'Creek width',tip:'Width of the open water in a creek channel.'},
 {key:'streamDepth',category:'streams',kind:'range',min:.3,max:3,step:.1,unit:' m',def:1.2,label:'Channel depth',tip:'How far a river bed sits below its water surface. Creeks use 60% of this.'},
 {key:'streamBends',category:'streams',kind:'range',min:0,max:100,step:1,unit:'%',def:55,label:'Channel meandering',tip:'How much the channels wander. Bends are limited so a bank never folds through itself.'},

 {key:'trees',category:'scenery',kind:'range',min:0,max:100,step:1,unit:'%',def:65,label:'Tree density',tip:'Planting density outside the playing corridors. Trunks collide with the ball; foliage does not.'},
 {key:'homes',category:'scenery',kind:'toggle',def:false,label:'Line fairways with houses',tip:'Houses on dry, gently sloping rough away from greens and tees. They are scenery: balls pass through them.'},
 {key:'homeDensity',category:'scenery',kind:'range',min:0,max:100,step:1,unit:'%',def:45,label:'House occurrence',tip:'How often a suitable site is built on.'},
 {key:'homeSetback',category:'scenery',kind:'range',min:20,max:70,step:1,unit:' m',def:35,label:'House setback from semi-rough',tip:'How far back from the playing corridor the houses sit.'},
 {key:'residentialOB',category:'scenery',kind:'toggle',def:false,label:'Houses play as out of bounds',tip:'Off, a ball simply rebounds off walls and roofs and stays in play. On, reaching a house costs a penalty stroke and you replay from your previous lie, as a residential boundary would. Houses are solid either way.'},

 {key:'wind',category:'weather',kind:'range',min:0,max:25,step:1,unit:' mph',def:4,label:'Wind speed',tip:'Course-wide wind. It is rotated into each hole’s own frame, so it stays a real direction rather than turning with the hole.'},
 {key:'windDirection',category:'weather',kind:'range',min:0,max:359,step:1,unit:'°',def:65,label:'Wind direction',tip:'The compass bearing the wind blows toward.'},
];

export const FIELD=Object.fromEntries(SETTINGS.map(f=>[f.key,f]));
export const DEFAULT_COURSE=Object.fromEntries(SETTINGS.map(f=>[f.key,f.def]));
export const generationKeys=()=>SETTINGS.map(f=>f.key);
export const bound=(v,s)=>typeof v==='function'?v(s):v;

// Relationships a single field cannot express on its own.
const CONSTRAINTS=[
 {test:s=>s.waterMin<=s.waterMax,message:'Minimum water depth cannot exceed the maximum.'},
];

// A surprise course. Fields carry their own `vary` band because the extremes of
// several sliders make courses nobody wants to play; `holes` deliberately has
// none, so a surprise round is always a nine and never a ten-second wait.
const VARY={biome:true,footprint:true,homes:true,
 courseYards:s=>[s.holes*300,s.holes*400],landform:[25,95],elevation:[10,75],spacing:[12,40],
 doglegs:[30,90],doglegAngle:[25,60],doglegPosition:[40,70],width:[28,50],fringe:[1,4],semiRough:[3,10],
 greenDifficulty:[15,70],bunkerCount:[2,7],fairwayBunkers:[10,70],bunkerGap:[0,6],
 water:[10,70],pondSize:[80,190],waterMin:[.4,1.5],waterMax:[2,5],lakes:[0,2],lakeSize:[110,260],
 rivers:[0,1],creeks:[0,2],riverWidth:[8,20],creekWidth:[2,5],streamDepth:[.6,2],streamBends:[25,85],
 trees:[25,85],homeDensity:[25,70],homeSetback:[25,55],wind:[0,14],windDirection:[0,359]};
const SEED_WORDS=['WANDER','HORIZON','WILDFLOWER','SOLSTICE','EMBER','THICKET','MERIDIAN','HOLLOW','QUARRY','TIDELINE'];
export function randomSettings(rng=Math.random,overrides={}){
 const s={...DEFAULT_COURSE};
 s.seed=SEED_WORDS[Math.floor(rng()*SEED_WORDS.length)]+'-'+Math.floor(1000+rng()*9000);
 for(const f of SETTINGS){
  const vary=VARY[f.key];
  if(!vary)continue;
  if(f.kind==='choice'){s[f.key]=f.options[Math.floor(rng()*f.options.length)];continue;}
  if(f.kind==='toggle'){s[f.key]=rng()<.5;continue;}
  const [lo,hi]=typeof vary==='function'?vary(s):vary,step=f.step||1;
  const snapped=Math.round((lo+rng()*(hi-lo))/step)*step;
  // Snapping to the step can land a hair outside the field's own bounds.
  s[f.key]=Math.min(bound(f.max,s),Math.max(bound(f.min,s),Number(snapped.toFixed(3))));
 }
 return validateSettings({...s,...overrides});
}

export function validateSettings(input={}){
 const s={...DEFAULT_COURSE,...input};
 for(const f of SETTINGS){
  const v=s[f.key];
  if(f.kind==='text'){if(typeof v!=='string'||!v.trim().length||v.length>f.max)throw Error(`${f.label} must be 1–${f.max} characters.`);continue;}
  if(f.kind==='toggle'){if(typeof v!=='boolean')throw Error(`${f.label} must be on or off.`);continue;}
  if(f.kind==='choice'){if(!f.options.includes(v))throw Error(`${f.label} is not a recognised option.`);continue;}
  const lo=bound(f.min,s),hi=bound(f.max,s);
  if(!Number.isFinite(v)||v<lo||v>hi)throw Error(`${f.label} must be between ${lo} and ${hi}${f.unit||''}.`);
  if(f.kind==='int'&&!Number.isInteger(v))throw Error(`${f.label} must be a whole number.`);
 }
 for(const c of CONSTRAINTS)if(!c.test(s))throw Error(c.message);
 return s;
}

// Each entry upgrades a settings object from that version to the next one.
const MIGRATIONS={
 // 1 -> 2: the per-tee toggles never did anything, since all three tee sets are
 // always built and the playing tee is a round setting. Ponds gained a size
 // control; 120 reproduces the dimensions those saves were generated with.
 1:s=>{const {teeBlue,teeWhite,teeRed,...rest}=s;return {...rest,pondSize:120};},
 // 2 -> 3: houses became solid. Existing courses keep the forgiving default, so
 // nobody's saved course silently starts costing penalty strokes.
 2:s=>({...s,residentialOB:false}),
 // 3 -> 4: hole locations move through the week. A save made before that has no
 // pinDay, and the cup it was played with sat in the middle of the green, so
 // Thursday -- the gentlest setup, nearest the middle -- is the honest default
 // for it rather than whatever a later day would cut.
 3:s=>({...s,pinDay:'Thursday'}),
 // 4 -> 5: tee complexes are now raised until the shot clears the ground in
 // front of them, and `blindTees` is the share of holes allowed to keep the
 // blind shot instead. A save from before this predates the raising entirely,
 // so there is no value that reproduces it -- and it does not need one, since
 // the generator version already puts that change to the player rather than
 // applying it silently. It takes the default.
 4:s=>({...s,blindTees:0}),
};

// Play-scope keys (turf, flight profile, club yardages, art style) ride along in
// the same object and are validated by their own modules, so they are preserved
// rather than dropped.

// WHAT BELONGS TO THE GOLFER RATHER THAN TO THE GROUND.
//
// These are not schema fields, so they are not in `DEFAULT_COURSE` and anything
// that rebuilds settings from it drops them SILENTLY -- not back to a default
// you could see, but gone. That is how an endless run reset a player's bag: the
// hole is grown from a seed, the settings object is rebuilt around it, and the
// club distances were never part of what the seed decides.
//
// `style` is deliberately NOT here. Endless forces cartoon and the range has its
// own look; an art direction the mode chose is not something to carry across, so
// the two callers that do preserve it say so themselves.
export const PLAY_KEYS=['clubYardages','flightProfile','turf'];
export const playScope=s=>Object.fromEntries(PLAY_KEYS.filter(k=>s?.[k]!==undefined).map(k=>[k,s[k]]));
export function migrateSettings(settings={},from=1){
 let s={...settings};
 for(let v=Math.max(1,from|0);v<SCHEMA_VERSION;v++)if(MIGRATIONS[v])s=MIGRATIONS[v](s);
 return {...DEFAULT_COURSE,...s};
}
