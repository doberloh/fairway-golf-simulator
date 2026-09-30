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
export const SCHEMA_VERSION=9;
// 2: pond shelves that overlap now settle to one shared level. Ponds on sloping
//    ground previously sank metres below their own banks, so terrain around
//    water moved for every seed.
// 3: houses gained varied forms that draw from the same seeded stream, moving
//    their siting, and pond shelves follow the pond's own oval instead of a
//    circle, so they no longer bulldoze the ground around an elongated pond.
// 4: footbridges removed. Walking routes cross channels on the ground again, so
//    contact height and surface are read straight off the terrain everywhere.
// 8: `greenShape` and `bunkerShape` added -- how far a green or a bunker
//    departs from an oval.
// 7: `greenTrees` added -- how close planting comes around a green, with
//    the approach side kept open at every setting.
// 6: `fairwayFeature` added -- how often a hole gets a specimen tree or a
//    cluster of stones standing in its own short grass.
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
// 13-21: not written down. The repository's history begins at one squashed
//     commit, so what these were cannot be recovered. The list is the record;
//     bumping the number without adding a line here is how it stopped being one.
// 23: hole length is bounded by par instead of scaled to fit. Lengths were a
//     base per par jittered a quarter either way with no clamp, then every hole
//     multiplied by one factor to hit the course total -- so a hole that
//     jittered long raised the total, lowered the factor and shortened every
//     other hole. At a 7,400-yard target one hole in eight fell outside the
//     USGA's guideline for what may be called that par, and par 5s reached 803
//     yards. Each par has a researched band now and the course length is
//     water-filled inside them. The par MIX is weighted toward a real one
//     rather than drawn flat off the list of combinations that add up, and par
//     order is split across the nines. A hole's line, length and tees moved
//     into `holeLine` in course-plan.js, which also moved the tee draws earlier
//     in the hole's stream so a scorecard can reach them. Every hole on every
//     course changes length, par or both: all eight biome fingerprints moved.
// 24: tee shots got a launch corridor. Planting obeyed one rule -- at least
//     10 m outside a corridor -- which beside a tee is a tree in your face:
//     29 of 648 tee shots (4.5%) had a trunk on the line to the fairway, the
//     close ones 8 to 20 m out. `blocksLaunch` refuses anything standing where
//     the nominal shot would pass through it, judged on HEIGHT rather than a
//     fixed length, aimed along the played line rather than the tee pad's
//     bearing. Six biome fingerprints moved; links and desert did not, their
//     plantings being shrub and cactus.
// 25: boulders became generation output. They were placed by the renderer from
//     an rng the generator never saw, so nothing could collide with one -- a
//     ball flew through a six-metre stone. `world.rocks` now, carrying reach
//     and crown height, and the fingerprint hashes them.
// 26: `fairwayFeature` -- a specimen tree or a cluster of stones standing in a
//     hole's own short grass, sited to leave a route past it.
// 27: planting stopped stepping at the corridor edge and started ramping.
//     `nearest().d` is SIGNED, and near a tee the corridor envelope is far
//     wider than the mown turf, so the old rule banned the whole tee surround:
//     19-50% of course density in the first 20 m. Now 65-105%.
// 28: a combined tee fan replaced three separate wedges, so nothing plants in
//     the view from the back tee, and `greenTrees` opened green surrounds on
//     the back and flanks while keeping the approach clear.
// 30: green and bunker outlines move with two new sliders. Both were a circle
//     with a wobble of a few per cent -- measured, greens ran 1.15 to 1.40
//     widest-over-narrowest and bunkers 1.11 to 2.40, with no outline anywhere
//     turning back on itself. The sliders raise the amplitude AND even out the
//     harmonics. Simply scaling the drawn mix was tried first and looked
//     wrong: it preserved which harmonic dominated, the three-lobed wave leads
//     on 69 of 81 greens, and a three-lobed flower stretched by a green's
//     aspect is two lobes and a shaft.
// 29: the tee ramp scales with the hole's own width instead of being a fixed
//     -20 m. `n.d` grows with the corridor, so a flat floor collapsed at wide
//     settings -- the tee surround fell to 0.03 of course average at a 92 m
//     fairway, worse than before any of this work. Now 0.34 to 0.90 across
//     every biome and the whole width slider.
// 31: rocks are judged as bodies, not as points. A boulder was tested against
//     the launch corridor as a dimensionless point with a ceiling of y+scale,
//     which is not its height -- it is drawn up to 0.9 scale above centre and
//     sunk a quarter of it -- and it never consulted the tee fan at all. Four
//     rocks stood in a tee shot and 41 in the view from the tees across four
//     courses; now zero. Trees gained the same body test on the fan, where 154
//     trunks across 35 courses had a centre just outside it and a trunk inside.
//     A fairway FEATURE on a biome with no tree species fell through to
//     `bio.plants[0]` and grew gorse to canopy height -- a 13 to 29 m bush in
//     the middle of a links fairway. Those become rocks.
// 32: tee boxes. The pad is 7.2 m long rather than 9, its shoulder falls away
//     35% faster directly ahead than it does to the sides or behind, and the
//     siting now staggers against EVERY tee already placed rather than only the
//     one in front. Measured over 945 tees: pairs sitting in line fell from 110
//     to 10, and ground within 40 m of a tee standing above the sight line fell
//     from 8 shots to 2. It did NOT move blind tee shots -- all 25 of those are
//     caused by ground 96 to 190 m out, not by the tee.
// 33: every green has a character. The shape was one recipe for every green --
//     a tilt, three crossing ridges drawn as rounded square waves, a dish and a
//     tier -- so nearly every green had one or two steps, and at a low sun each
//     face lit up across the surface. Each green now draws rolling, tiered,
//     ridged, crowned or bowl from its seed; only tiered greens have a step.
//     The top of the difficulty slider reaches 60% further. New settings for
//     raised greens, punchbowl greens and false fronts (SCHEMA_VERSION 9).
export const GENERATOR_VERSION=33;

// Held here rather than imported so this module stays free of cycles with
// course.js. tests/settings-schema.test.mjs asserts both lists stay in step.
export const BIOME_KEYS=['pnw','desert','mountain','links','midwest','island','redwood','autumn'];
export const FOOTPRINT_KEYS=['organic','oval','crescent','ribbon','square','figure8','butterfly','clover','spiral','horseshoe','triangle','diamond','coast','archipelago'];

// Third entry is a note for the group, used where the context belongs to the
// whole category rather than to any one control.
export const CATEGORIES=[
 ['course','Course','Yardage is measured from the blue tees. All three tee sets are always built; you pick yours when you play.'],
 ['landscape','Landscape'],
 ['routing','Routing','Left and right turns are balanced across the course, and each turning point varies up to 22 points either side of your setting.'],
 ['turf','Fairways & greens'],
 ['bunkers','Bunkers'],
 ['water','Water','Depths set the deepest point; every shore still slopes to nothing at the bank. (EXPERIMENTAL) Channels may cross fairways, but route around tees, greens, ponds and bunkers. A course with no room simply gets fewer of them.'],
 ['scenery','Trees & scenery'],
 ['weather','Weather'],
];

// `short` is the label shown when a control sits inside a settings box that
// already names the feature -- "Frequency" under a box headed Ponds. `label`
// remains the full name and is what assistive technology is given, so adding
// one here never costs a screen reader the noun. Only worth setting for a
// field that lives in a LABELLED group in main.js's FIELD_GROUPS; anywhere
// else it is ignored.
export const SETTINGS=[
 {key:'holes',category:'course',kind:'choice',options:[9,18],def:9,label:'Holes',tip:'How many holes the course contains. A saved course is fixed at this length.'},
 {key:'seed',category:'course',kind:'text',max:50,def:'EVERGREEN',label:'Course seed',tip:'The same seed and settings rebuild the same course, within one generator version.'},
 {key:'courseYards',category:'course',kind:'range',min:s=>s.holes*110,max:s=>s.holes*470,step:10,unit:' yd',def:3240,label:'Course length',tip:'Target total yardage from the blue tees. Par stays within 68–72 for eighteen holes or 34–36 for nine; past those limits the holes keep changing length while par holds.'},

 {key:'biome',category:'landscape',kind:'choice',options:BIOME_KEYS,def:'pnw',label:'Surroundings',tip:'Regional planting, ground colours, light, temperature and altitude.'},
 {key:'landform',category:'landscape',kind:'range',min:0,max:100,step:1,unit:'%',def:70,label:'Landscape character',tip:'How strongly the land rises between playing corridors: inter-hole mountains, dunes or island channels.'},
 {key:'elevation',category:'landscape',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Elevation severity',tip:'Height change along the playing corridors. At the top end a hole climbs or falls tens of metres, while tees and greens keep gentle surfaces.'},
 {key:'blindTees',category:'landscape',kind:'range',min:0,max:100,step:5,unit:'%',def:0,label:'Blind tee shots',tip:'How often a tee shot is left blind. A tee complex is normally raised until the shot clears the ground in front of it; this is the share of holes allowed to keep the hidden landing area instead. Only holes the land makes blind are affected, so the true rate tops out around one in five.'},

 {key:'footprint',category:'routing',kind:'choice',options:FOOTPRINT_KEYS,def:'organic',label:'Course footprint',tip:'A guiding shape for the whole routing. It steers land use; individual holes stay procedural, so the silhouette is an intention rather than a guarantee.'},
 {key:'spacing',category:'routing',kind:'range',min:8,max:65,step:1,unit:' m',def:18,label:'Space between hole corridors',tip:'Clearance kept between neighbouring corridors when packing the routing.'},
 {key:'doglegs',category:'routing',kind:'range',min:0,max:100,step:1,unit:'%',def:65,label:'Dogleg frequency',tip:'Share of par 4s and 5s that bend. Par 3s are always straight. Left and right turns are balanced across the course.'},
 {key:'doglegAngle',category:'routing',kind:'range',min:0,max:70,step:1,unit:'°',def:45,label:'Maximum dogleg turn',tip:'The largest turn a dogleg may take.'},
 {key:'doglegPosition',category:'routing',kind:'range',min:30,max:75,step:1,unit:'% along hole',def:55,label:'Dogleg turning point',tip:'Where the bend sits along the hole. Each hole varies up to 22 points either side of this.'},

 {key:'width',category:'turf',kind:'range',min:20,max:92,step:1,unit:' m',def:38,label:'Typical fairway width',tip:'A guideline, not a constant. Each side is generated independently, so the fairway widens into landing areas and pinches at approaches. The top of the range is a hundred yards, which is links territory rather than a normal fairway.'},
 {key:'fringe',category:'turf',kind:'range',min:0,max:6,step:.25,unit:' m',def:2,label:'Green fringe width',tip:'The closely mown collar around each green.'},
 {key:'semiRough',category:'turf',kind:'range',min:0,max:15,step:.5,unit:' m',def:6,label:'Semi-rough width',tip:'The intermediate cut between fairway and rough.'},
 {key:'greenShape',category:'turf',kind:'range',min:0,max:100,step:5,unit:'%',def:30,label:'Green shape',short:'Irregularity',tip:'How far a green departs from an oval. Low is the rounded shape a green has always had here; high gives lobes, a pinched waist and an irregular edge. Raising it also EVENS OUT the waves that make the outline, so no single one takes over — letting one dominate is what turns a green into a clean three-lobed flower rather than a golf green.'},
 {key:'bunkerShape',category:'turf',kind:'range',min:0,max:100,step:5,unit:'%',def:30,label:'Bunker shape',short:'Irregularity',tip:'How ragged the outline of a bunker is. Low is a smooth oval; high gives waisted and lobed sand. Green-side bunkers are re-fitted to the green after shaping, so they keep the gap they are told to leave whatever this is set to.'},
 {key:'greenDifficulty',category:'turf',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Green slope & difficulty',tip:'Slope and contour on the putting surfaces. At 0 greens are level; higher settings add tilts, rolls, ridges, tiers and bowls, each green with a character of its own. The top of the range is severe: championship relief, with tier faces well past ten per cent.'},
 {key:'raisedGreens',category:'turf',kind:'range',min:0,max:100,step:5,unit:'%',def:25,label:'Raised greens',short:'Share of greens',tip:'The share of greens built up above the ground around them, with banks falling away beyond the collar. A shot that misses runs down the bank, and the chip back has to climb it. The putting surface itself is unchanged.'},
 {key:'sunkenGreens',category:'turf',kind:'range',min:0,max:100,step:5,unit:'%',def:10,label:'Punchbowl greens',short:'Share of greens',tip:'The share of greens set down into a hollow, with the ground rising around them. Shots that miss tend to be fed back toward the green. Raised and punchbowl greens together never exceed every green.'},
 {key:'falseFronts',category:'turf',kind:'range',min:0,max:100,step:5,unit:'%',def:20,label:'False fronts',short:'Share of greens',tip:'The share of greens whose front few metres fall away toward the fairway, so an approach that lands just short of the shelf rolls back off the green. How far the front drops follows the green slope setting; at 0 the green is still level.'},

 {key:'pinDay',category:'turf',kind:'choice',options:['Thursday','Friday','Saturday','Sunday'],def:'Thursday',label:'Pin difficulty',tip:'Which day of a tournament the cups are cut for. Thursday takes the flattest ground with the most green around it; Friday, Saturday and Sunday move to progressively more slope and tighter edges. No day will cut a cup somewhere a ball cannot come to rest. Hole locations work front, middle, back and around again as the round goes on.'},

 {key:'bunkerCount',category:'bunkers',kind:'int',min:0,max:8,step:1,def:5,label:'Bunkers per hole · up to',tip:'An upper target. Placements that would overlap a green, tee or pond are dropped, so holes often carry fewer.'},
 {key:'fairwayBunkers',category:'bunkers',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Fairway bunker occurrence',tip:'Chance that each non-greenside bunker sits inside the fairway rather than beside it, creating a choice of landing lines.'},
 {key:'bunkerGap',category:'bunkers',kind:'range',min:0,max:15,step:.5,unit:' m',def:2,label:'Greenside bunker gap from fringe',tip:'Turf left between a greenside bunker and the fringe. Zero lets them touch.'},

 {key:'water',category:'water',kind:'range',min:0,max:100,step:1,unit:'%',def:35,label:'Pond frequency',short:'Frequency',tip:'How often a pond is attempted on each hole. Large ponds crowd each other and the corridors, so high settings place fewer than requested. Island courses have no inland water: the ocean is the hazard.'},
 {key:'pondSize',category:'water',kind:'range',min:40,max:300,step:10,unit:' m',def:120,label:'Typical pond size',short:'Typical size',tip:'Scales both pond dimensions. Banks are anchored outside the fairway edge, so a larger pond grows away from play rather than into it.'},
 {key:'lakes',category:'water',kind:'int',min:0,max:3,step:1,def:0,label:'Large lakes',short:'How many',tip:'Open water placed away from the playing corridors, using the pond depth range above. Not placed on island courses, where the ocean is the hazard.'},
 {key:'lakeSize',category:'water',kind:'range',min:60,max:460,step:10,unit:' m',def:160,label:'Typical lake diameter',short:'Typical diameter',tip:'At the top of the range open ground runs out and fewer lakes are placed than requested.'},
 {key:'waterMin',category:'water',kind:'range',min:.2,max:8,step:.1,unit:' m',def:.5,label:'Minimum water hazard depth',short:'Minimum',tip:'The shallowest a pond or lake’s deepest point may be. Shores still slope to nothing at the bank.'},
 {key:'waterMax',category:'water',kind:'range',min:.2,max:12,step:.1,unit:' m',def:2.5,label:'Maximum water hazard depth',short:'Maximum',tip:'The deepest a pond or lake’s deepest point may be. Coastal channel floors respect this too.'},

 {key:'rivers',category:'water',kind:'int',min:0,max:2,step:1,def:0,label:'Rivers',short:'How many',tip:'Wide meandering channels that may cross fairways or run between holes. Tees, greens, ponds and bunkers are routed around. Not placed on island courses, where the ocean is the hazard.'},
 {key:'creeks',category:'water',kind:'int',min:0,max:3,step:1,def:0,label:'Creeks',short:'How many',tip:'Narrow meandering channels. Each channel draws its own bearing, so creeks and rivers never run parallel. Not placed on island courses, where the ocean is the hazard.'},
 {key:'riverWidth',category:'water',kind:'range',min:6,max:30,step:1,unit:' m',def:14,label:'River width',short:'Width',tip:'Width of the open water in a river channel.'},
 {key:'creekWidth',category:'water',kind:'range',min:1.5,max:6,step:.5,unit:' m',def:3,label:'Creek width',short:'Width',tip:'Width of the open water in a creek channel.'},
 {key:'streamDepth',category:'water',kind:'range',min:.3,max:3,step:.1,unit:' m',def:1.2,label:'Channel depth',short:'Depth',tip:'How far a river bed sits below its water surface. Creeks use 60% of this.'},
 {key:'streamBends',category:'water',kind:'range',min:0,max:100,step:1,unit:'%',def:55,label:'Channel meandering',short:'Meandering',tip:'How much the channels wander. Bends are limited so a bank never folds through itself.'},

 {key:'trees',category:'scenery',kind:'range',min:0,max:100,step:1,unit:'%',def:65,label:'Tree density',tip:'Planting density outside the playing corridors. Trunks collide with the ball; foliage does not.'},
 {key:'greenTrees',category:'scenery',kind:'range',min:0,max:100,step:5,unit:'%',def:40,label:'Trees close to greens',short:'Closeness',tip:'How far planting comes in around a green. The APPROACH stays open at every setting — the side your shot comes in from is kept clear so there is always somewhere to land — and this moves the trees behind and to the sides. At 0 they stand well back, as they used to; at 100 they close right in on the collar.'},
 {key:'fairwayFeature',category:'scenery',kind:'range',min:0,max:100,step:5,unit:'%',def:20,label:'Feature tree or rocks in a fairway',short:'Occurrence',tip:'How often a hole gets a specimen tree or a cluster of stones standing in its own short grass, the way a famous hole often does. Placed so it is never on your tee shot and never seals the hole off: there is always a playable route past it, on at least one side.'},
 {key:'homes',category:'scenery',kind:'toggle',def:false,label:'Line fairways with houses',short:'Line the fairways',tip:'Houses on dry, gently sloping rough away from greens and tees. They are scenery: balls pass through them.'},
 {key:'homeDensity',category:'scenery',kind:'range',min:0,max:100,step:1,unit:'%',def:45,label:'House occurrence',short:'Occurrence',tip:'How often a suitable site is built on.'},
 {key:'homeSetback',category:'scenery',kind:'range',min:20,max:70,step:1,unit:' m',def:35,label:'House setback from semi-rough',short:'Setback from semi-rough',tip:'How far back from the playing corridor the houses sit.'},
 {key:'residentialOB',category:'scenery',kind:'toggle',def:false,label:'Houses play as out of bounds',short:'Play as out of bounds',tip:'Off, a ball simply rebounds off walls and roofs and stays in play. On, reaching a house costs a penalty stroke and you replay from your previous lie, as a residential boundary would. Houses are solid either way.'},

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
 greenDifficulty:[15,70],raisedGreens:[0,50],sunkenGreens:[0,25],falseFronts:[0,40],bunkerCount:[2,7],fairwayBunkers:[10,70],bunkerGap:[0,6],
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
 // 8 -> 9: raised greens, punchbowl greens and false fronts. A save from before
 // had none of them, so it keeps none rather than taking the defaults; its
 // greens still change shape (GENERATOR_VERSION 33), which the player is told.
 8:s=>({...s,raisedGreens:0,sunkenGreens:0,falseFronts:0}),
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
