import {LANDSCAPES, REGIONS, currentKey} from './regions.js';

// EVERY BIOME IS ONE RECORD.
//
// It was seven tables and forty-eight conditionals across eight files: the
// palette here, the stream-bank colour in streams.js, the plant mix further
// down course.js, rock and grass densities in vegetation.js, the landform shape
// inside `land`, and one-off tests for dust, leaf litter, house materials and
// the horizon ring scattered wherever they were needed.
//
// Nothing about that was wrong for seven biomes that grew one at a time. It is
// wrong for the eighth, because there is no list of what a biome has to answer
// -- you find the places you missed by looking at the result. The worst example
// was the ground shader, which took a biome as an INDEX into a four-element
// array; a new name lands on -1 and quietly takes whichever branch that is.
//
// So: one record per biome, defaults for everything, and a biome says only what
// makes it different. Adding one is now a single entry plus whatever assets it
// needs. `tools/biome-fingerprint.mjs` exists to prove that reshuffling this
// changed none of the seven that were already here.

// What a biome gets if it says nothing. Every field here is the behaviour the
// old code took when none of its conditionals matched.
const DEFAULTS = {
 // Stream banks: the earth colour where water cuts through.
 bank: '#697348',
 // Hills between the corridors. `base` is their height with elevation at zero,
 // `severity` how much the elevation setting adds, `reach` how far from a
 // corridor they take to grow.
 hills: {base: 18, severity: 0, reach: 70},
 // Coast and sea. `coastal` is a landform that falls to water on every side;
 // `sea` means there is open water at all. Inland water is ponds and channels.
 coastal: false, sea: false, inlandWater: true,
 // How far the horizon ring lifts behind the course.
 ringLift: 70,
 // Peaked far range (landscape-edge.js `peaks`): off unless a landscape asks.
 ringPeaks: false,
 // The ground type painted on the far ring's steep faces (ground.js GROUND_CODE;
 // the far-landscape goal): the landscape's own rock, so a far cliff is rock
 // rather than rough stretched up it. Null where the far land is dune or sea.
 ringFace: 'rock',
 // Far land as mesas and buttes (landscape-edge.js `mesas`): off unless asked.
 ringMesas: false,
 // Far islets out of the sea (landscape-edge.js `isles`): how many; none unless asked.
 ringIslands: 0,
 // How far the router hops between holes on its long walk.
 hop: 58,
 // Scenery counts. Grass is blades, tufts are the near-field clumps.
 // `rockScale` and the blade fields are how big the scatter reads, not how
 // much of it there is. `bladeTint` null means take the biome's rough colour.
 scatter: {rocks: 160, grass: 110000, tufts: 1600, tallGrass: false,
  rockScale: 1, bladeLength: .65, bladeWidth: .8, bladeTint: null,
  flowers: ['#f0cf63', '#bc80b4']},
 // Presentation one-offs that used to be a biome test at the call site.
 // Fallen logs, stumps and mossy boulders on the forest floor, mostly
 // clustered around trunks. A count, and zero means a clean floor.
 deadfall: 0,
 // What that floor is made of, as [family, share]. A family is a PICK entry in
 // tools/build-meshes.mjs; vegetation.js knows how to size and colour each.
 floor: [['log', .40], ['stump', .24], ['mossrock', .36]],
 // The Cartoon ground lifts every rough 23% toward this colour (renderer.js).
 // An olive suits every grass there is; it turned a violet rough (Haunted
 // Hollow's, removed 2 November 2026) to mud, so a biome can say what its
 // rough should lift toward.
 roughTint: '#b6bc65',
 // The 2D course and hole maps draw semi-rough, fairway and green in these,
 // whatever the biome, so a map reads the same everywhere -- until a biome's
 // turf stops being green at all.
 mapTurf: {semi: '#a1b481', fairway: '#608449', green: '#b3cc86'},
 // A moon drawn into the sky: angular radius in degrees, its colour on the
 // horizon and high up, and how strongly it shows by day. Null draws none, and
 // the sky is exactly what it was; the small pale disc the sun's disc becomes
 // after dark is separate and every biome keeps it.
 moon: null,
 // How much of their combined crown radius two trees may share before one of
 // them is moved elsewhere. Zero is off, which is where every biome but
 // redwood stands -- not because they would not benefit, but because their
 // layouts are signed off and this rewrites every one of them. Turning it on
 // for another biome is this one number, and the fingerprint will tell you
 // exactly what moved.
 //
 // Trunk clearance rides along with it. Two trunks in the same place is a
 // fault rather than a style, but it never happened at 13 to 29 metres, and
 // switching it on everywhere would relayout seven signed-off biomes to fix
 // a problem none of them has.
 crownShare: 0,
 leafFall: false,   // autumn's per-species leaf tinting
 leafLitter: false, // drifts of fallen leaves in the rough texture
 sandLand: false,   // rough reads as sand rather than soil
 dust: false,       // a shot kicks up dust rather than turf
 spray: '#c6ce8d',  // the colour of what a shot throws up
 sunColor: '#fff0d6', // the key light
 treeDensity: 2.8,  // multiplier on the tree-count setting
 canopy: {min: 13, range: 16},    // a tree on a hole, in metres
 // Scenery away from the holes runs a shade shorter. Two ranges rather than
 // one derived from the other, because they were two hand-written ranges and
 // deriving one lost a few centimetres -- enough to move five biomes.
 farCanopy: {min: 12, range: 15},
 edgeCoast: false,  // a sea along one edge, rather than all round
 shoreSand: false,  // pale sand at the waterline on the course map
 cover: 'grass',    // what the near-field ground cover reads as
 waterTint: '#478fbf', // the water surface colour
 waterMurk: .48,    // how far you can see into it
 mapWater: '#1e281c', // the course map's background beyond the land (dark since round 13; was paper, #e0e5d5)
 warm: false,       // house walls in warm tones
 arid: false,       // house surroundings without lawn
 // Ground shader, by name rather than by index into an array.
 speckleRock: false,   // rock mottling through the turf
 altitudeRock: false,  // bare rock high up, snow higher still
 litter: true,         // needle and leaf litter in the rough
 // Raw sand where wind has torn the grass off a dune: how much of the rough
 // well away from play (course.js `blowoutField`) is open sand. Paint and lie
 // read the same field, so a ball that lands on it plays from sand. Zero is
 // none, and a biome with none builds no field at all.
 blowouts: 0,
 // Bleached logs washed up on the beach, per hole, drawn by vegetation.js.
 // Decoration only, like the forest floor: nothing collides with them.
 driftwood: 0,
 // Trees thinned near the holes and massed farther back: {from, to, floor},
 // the chance a tree is kept rising from `floor` at `from` metres outside the
 // corridor to certainty at `to`. Null keeps every biome's own planting.
 woods: null,
 // The forest painted on the hills past the course (ground.js; rendering
 // only): {cover 0..1 of the country, colors [three leaf colours], size
 // metres between crowns, line the height it stops below}. Null: bare hills.
 farForest: null,
 // The cartoon light (the overhaul's lighting rounds; rendering only):
 // {shade, the colour the toon ramp's dark steps lean toward (textures.js
 // rampSteps); bounce, the colour light thrown up from the ground takes
 // (renderer.js; the rough's when absent); exposure, a multiplier on the
 // camera's (1 when absent)}. Null: a grey ramp.
 light: null,
 // Long grass between the holes (vegetation.js addLongGrass; decoration
 // only): {families [[family, weight, height m]], count of colonies, near
 // metres outside the corridors, leaf and accent colours}. Null: none.
 longGrass: null,
 // Uncleared forest or thicket round the property and between the holes
 // (stands.js). Null: the open scatter alone, as before the overhaul.
 stands: null,
 // THE COUNTRY BETWEEN THE HOLES (the cartoon overhaul; landforms.js): which
 // landform recipe adds its relief and ground types, and its numbers. Null
 // is the old rolling hills alone. `kinds` names the ground types (grounds.js)
 // of channels a and b and the floor; `gates` how far outside the corridor
 // envelope each starts ({near, ramp} metres); `reach` how far from a
 // corridor the relief takes to grow (the hills' own when absent). Every
 // number in the recipes below is PLACED (RESEARCH, *The overhaul's
 // landforms*).
 landform: null,
 // Fallen needles or leaves under the trees, played as their own ground: the
 // species that drop them and the ground type they make.
 fallen: {from: ['pine', 'spruce', 'cedar'], kind: 'pinestraw'},
 // The boulders' geology (tools/blender/cartoon_rocks.py): 'round' granite,
 // 'angular' talus or 'layered' sandstone; and the moss or lichen on their
 // tops, or null for bare stone. A look only.
 rockStyle: 'round', rockMoss: null,
};

// THE REGIONS AND THEIR LANDSCAPES (the US landscapes goal, 2 November 2026;
// regions.js). The tables below -- TRAITS, PALETTES, INTERFACE, WORLD -- are
// keyed by REGION (regions.js REGIONS): each holds what its region's
// landscapes share. A landscape's own differences are its entry in LAND, at
// the end, laid over its region's: {...DEFAULTS, ...PALETTES[region],
// ...TRAITS[region], ...LAND[key]}. The nine landscapes before the goal each
// became their region's record (Island's is Florida's, Autumn's the
// Northeast's), so a region with one landscape built has an empty LAND entry.

// Only what differs from the defaults above.
const TRAITS = {
 pnw: {light: {shade: '#7f93b0'},
  longGrass: {families: [['grasssedge', 1, .5]], count: 2500, near: 25, leaf: '#4f6b39', accent: '#7a8a4a'},
  farForest: {cover: .85, size: 10, colors: ['#2f5a2c', '#3c6b33', '#4d7a3a']},
  bank: '#526343', hills: {base: 45, severity: 0, reach: 70}, ringLift: 420, treeDensity: 4,
  // Mossy basalt outcrops breaking through the forest.
  landform: {type: 'crags', scale: 170, height: 22, steps: 2, from: .6, to: .95, cluster: .6, reach: 80,
   kinds: {a: 'rock'}, gates: {a: {near: 14, ramp: 16}}},
  rockStyle: 'angular', rockMoss: '#5d7a3e',
  stands: {edge: 50, wobble: 22, ramp: 20, patch: .18, scale: 260, near: 40, spacing: 9, share: .6,
   // (Vine maple and Oregon grape were tried in this understorey and taken
   // out: there they replaced sub-1,000-triangle ferns by the thousand and put
   // Low's triangles up 28% -- RESEARCH, *The Pacific pack*.)
   under: {spacing: 8, plants: [['fern', .5], ['huckleberry', .5]]}},
  // Puget Sound's own trees and shrubs (the US landscapes goal's Pacific
  // pack): bigleaf maple in the woods, madrone and Garry oak on the dry
  // ground, dogwood under them, Scotch broom in the open rough. The third
  // number scales the height (the region's 12-27 m): madrone 6-20 m, Garry
  // oak 10-20, dogwood 6-15 (the study's specs). Weights PLACED.
  plants: [['pine', .3], ['cedar', .23], ['alder', .1], ['bigleafmaple', .08], ['madrone', .06, .7],
   ['garryoak', .05, .75], ['pacificdogwood', .03, .5], ['fern', .08], ['vinemaple', .03], ['oregongrape', .02],
   ['scotchbroom', .02]]},
 desert: {light: {shade: '#a78aa6', exposure: .9},
  longGrass: {families: [['grassbunch', 1, .8]], count: 2600, near: 20, leaf: '#a9a06a', accent: '#d9c88f'},
  // Round 5 of the far landscape: scrub, not woods (low clumps thinning with
  // distance), and no painted canopy under them -- it was a dark carpet on the
  // sand (the owner: "desert probably doesn't need THICK coverage").
  farForest: {cover: .35, size: 7, scrub: true, paint: 0, colors: ['#6c7146', '#7c7a4c', '#5e6640']},
  bank: '#b49a73', hills: {base: 25, severity: 75, reach: 90}, ringLift: 240, ringFace: 'rock', ringMesas: true,
  scatter: {rocks: 500, grass: 12000, tufts: 150, tallGrass: false,
   rockScale: 2, bladeLength: .65, bladeWidth: .8, bladeTint: null,
   flowers: ['#f0cf63', '#bc80b4']},
  sandLand: true, dust: true, spray: '#ead9a7', warm: true, arid: true, speckleRock: true, litter: false,
  treeDensity: 1.25, waterMurk: .15, canopy: {min: 4, range: 5},
  // Troon North and Sedona: turf ribbons in bare desert, sandstone mesas and
  // buttes with cliffs, dry washes; past a narrow band of rough, hardpan.
  landform: {type: 'mesas', cell: 280, chance: .42, radius: [34, 80], height: [22, 48],
   wash: 260, washWidth: .018, washDepth: 1.4, reach: 85,
   kinds: {a: 'rock', b: 'waste', floor: 'hardpan'},
   gates: {a: {near: 8, ramp: 10}, b: {near: 12, ramp: 10}, floor: {near: 5, ramp: 6}}},
  fallen: null,
  rockStyle: 'layered',
  // A mesquite bosque and cholla thicket where the desert was never cleared
  // -- the Sonoran Desert's densest country lies along its washes.
  stands: {edge: 75, wobble: 30, ramp: 25, patch: .14, scale: 220, near: 45, spacing: 10, share: .55,
   // Jojoba in the understorey and ironwood among the stands' trees as
   // well as in the open (generator 61). Weights PLACED.
   under: {spacing: 8, plants: [['creosote', .42], ['brittlebush', .25], ['agave', .18], ['jojoba', .15]]},
   plants: [['mesquite', .33], ['palo', .25], ['ironwood', .08], ['cholla', .19], ['cactus', .08], ['ocotillo', .07]]},
  // Jojoba from the dry-and-lake pack (the US landscapes goal), taken from
  // creosote and brittlebush. Weight PLACED.
  plants: [['cactus', .18], ['cholla', .1], ['palo', .16], ['mesquite', .12], ['ocotillo', .1], ['agave', .08], ['creosote', .11], ['brittlebush', .06], ['jojoba', .05], ['ironwood', .04]]},
 mountain: {light: {shade: '#7c90c4'},
  longGrass: {families: [['grassalpine', 3, .4], ['grassfescue', 2, .6]], count: 3500, near: 18, leaf: '#6f8a48', accent: '#e8d36a'},
  farForest: {cover: .8, size: 9, line: 520, colors: ['#284c35', '#335c3c', '#466d3f']},
  // `ringPeaks` (the polish goal): the far range as peaks and aretes
  // (landscape-edge.js), not sine-wave rolls.
  bank: '#7b8982', hills: {base: 70, severity: 180, reach: 90}, ringLift: 950, ringPeaks: true,
  scatter: {rocks: 550, grass: 110000, tufts: 1600, tallGrass: false,
   rockScale: 2, bladeLength: .65, bladeWidth: .8, bladeTint: null,
   flowers: ['#f0cf63', '#bc80b4']},
  altitudeRock: true, treeDensity: 3.8,
  // Banff: cliff bands rising off the valley floor the holes share; scree at
  // each band's foot; the forest thinning on the crags.
  // `jag` (the polish goal): aretes, buttresses and couloirs bending the
  // cliff bands, and rock by steepness rather than by terrace step.
  landform: {type: 'crags', scale: 300, height: 70, steps: 4, from: .45, cluster: .42, scree: true, reach: 120, jag: .55,
   kinds: {a: 'rock', b: 'scree'}, gates: {a: {near: 14, ramp: 18}, b: {near: 10, ramp: 14}}},
  rockStyle: 'angular', rockMoss: '#9aa087',
  // A wall of spruce and pine round every fairway (the owner's photograph).
  stands: {edge: 45, wobble: 18, ramp: 18, patch: .2, scale: 240, near: 35, spacing: 8, share: .6,
   under: {spacing: 8, plants: [['huckleberry', .6], ['fern', .4]]},
   plants: [['spruce', .4], ['lodgepole', .3], ['pine', .15], ['aspen', .15]]},
  // The Rockies' own (the US landscapes goal's mountain pack): lodgepole
  // in the stands and the open, a few blue spruces, willow thickets, lupine
  // and columbine in the meadows. Lodgepole 15-30 m (1.1 of the region's
  // 12-27), blue spruce 15-25 (0.9). Weights PLACED.
  plants: [['spruce', .3], ['lodgepole', .18, 1.1], ['bluespruce', .05, .9], ['pine', .12], ['aspen', .18],
   ['sagebrush', .07], ['willowthicket', .04], ['lupine', .03], ['columbine', .03]]},
 links: {light: {shade: '#8a98b0'},
  longGrass: {families: [['grassfescue', 4, .8], ['grassmarram', 2, 1.0]], count: 7000, near: 14, leaf: '#8a9150', accent: '#d8c27a'},
  // Round 5: gorse and broom scrub on the dunes, the canopy painting faint.
  farForest: {cover: .3, size: 6, scrub: true, paint: .35, colors: ['#5b6a33', '#6d7a3a', '#8a8a3e']},
  bank: '#9c905e', hills: {base: 14, severity: 35, reach: 42}, ringLift: 0, ringFace: null,
  sea: true, scatter: {rocks: 160, grass: 400000, tufts: 1600, tallGrass: true,
   rockScale: 1, bladeLength: 1.25, bladeWidth: 1.4, bladeTint: '#c2a05c',
   flowers: ['#ddc252', '#ae79a6']},
  dust: true, spray: '#ead9a7', arid: true, treeDensity: 1.1, edgeCoast: true,
  cover: 'prairie', waterMurk: .8,
  // Marram on rumpled dune crests, heather on the settled ground behind.
  // The Old Course and Chambers Bay: fairways 1.3 times as wide, holes routed
  // out and back side by side (routing.js), and fairways that meet where
  // they do (course.js shareFairways): a pair joined only where their
  // fairways run alongside for two thirds of their length (the far-landscape
  // goal), so a double fairway, never a crossbar. PLACED, all of it.
  fairwayScale: 1.3, sharedFairways: {gap: 85, cos: .9, run: 100, ease: 170, close: 70, blur: 60, stretch: true, strip: 14, cover: .66, endEase: 36, seam: 2}, routeParallel: {gap: 60, weight: 600, walk: 130, shifts: [60]},
  landform: {type: 'dunes', scale: 150, hummock: 38, height: 5, marram: .55, heather: .6,
   kinds: {a: 'native', b: 'heather'}, gates: {a: {near: 9, ramp: 14}, b: {near: 8, ramp: 12}}},
  fallen: null,
  rockMoss: '#a8a06c',
  // Gorse thickets on the dunes beyond the holes (Bandon, the Old Course's
  // whins). Bushes, so they need no room of their own.
  stands: {edge: 70, wobble: 30, ramp: 25, patch: .12, scale: 200, near: 40, spacing: 8, share: 0,
   plants: [['gorse', .8], ['shrub', .2]]},
  plants: [['gorse', .5], ['heather', .42], ['shrub', .08]]},
 midwest: {light: {shade: '#8494bc'},
  longGrass: {families: [['grassbluestem', 3, 1.5], ['grassfescue', 1, .8]], count: 4500, near: 22, leaf: '#6d8443', accent: '#a65e3a'},
  farForest: {cover: .55, size: 12, colors: ['#3d6630', '#4c7536', '#5d833c']},
  bank: '#697348',
  // Restored prairie drifting through the out-of-play ground.
  landform: {type: 'prairie', swale: 4, cover: .56, kinds: {a: 'native'}, gates: {a: {near: 24, ramp: 22}}},
  rockMoss: '#8c9a58',
  // Woodlots of oak and maple left round the farmland.
  stands: {edge: 60, wobble: 25, ramp: 25, patch: .15, scale: 260, near: 45, spacing: 11, share: .6,
   under: {spacing: 8.5, plants: [['shrub', .5], ['bracken', .5]]},
   // The Heartland's own (the US landscapes goal's Heartland pack): bur oak
   // the savanna tree, elm and shagbark hickory. Heights: bur oak 0.9 of the
   // region's 12-27 m, elm and hickory 1.0. Weights PLACED.
   // Six tree species cost Low about 22% (the A/B; each species is its
   // draws near and far): accepted until the goal's performance pass (the
   // owner, 2 November 2026; TODO, *Performance pass*).
   plants: [['buroak', .26, .9], ['oak', .26], ['maple', .18], ['americanelm', .12], ['shagbark', .1], ['aspen', .08]]},
  plants: [['buroak', .2, .9], ['oak', .22], ['americanelm', .12], ['shagbark', .08], ['aspen', .1], ['maple', .14], ['shrub', .08], ['prairieforbs', .06]]},
 florida: {light: {shade: '#6fa0bf'},
  longGrass: {families: [['grassplume', 1, 1.3]], count: 1800, near: 20, leaf: '#5d8f45', accent: '#efe4c4'},
  farForest: {cover: .8, size: 10, colors: ['#3f7a35', '#4d8a3a', '#62983f']},
  bank: '#aaad7a', ringLift: 0, ringFace: null, ringIslands: 5, hop: 155, shoreSand: true, mapWater: '#6eb8c0',
  coastal: true, sea: true, inlandWater: false, litter: false,
  // Teeth of the Dog: coral ironshore just above the beach.
  landform: {type: 'coral', low: 1.0, high: 3.4, kinds: {a: 'coral'}, gates: {a: {near: 3, ramp: 4}}},
  fallen: null,
  // Uncleared coastal jungle: palms and hala, naupaka below.
  stands: {edge: 50, wobble: 22, ramp: 20, patch: .15, scale: 220, near: 35, spacing: 8, share: .55,
   // The Keys' own (the US landscapes goal's Keys pack): royal palms, gumbo
   // limbo, sea grape, a few mangroves and banyans among the palms and hala,
   // hibiscus and bougainvillea under them. Weights PLACED.
   under: {spacing: 8, plants: [['naupaka', .4], ['seagrape', .3], ['hibiscus', .15], ['bougainvillea', .15]]},
   plants: [['palm', .24], ['royalpalm', .18], ['gumbolimbo', .14], ['seagrape', .12], ['mangrove', .08], ['banyan', .05], ['travelerspalm', .06], ['hala', .13]]},
  plants: [['palm', .22], ['royalpalm', .14], ['hala', .1], ['naupaka', .18], ['seagrape', .1], ['gumbolimbo', .06], ['travelerspalm', .05],
   ['hibiscus', .06], ['bougainvillea', .05], ['mangrove', .02], ['banyan', .02]]},
 // MOODY IS A SET OF NUMBERS, NOT A MATERIAL.
 //
 // The sun sits at 18 degrees rather than the usual 28, which rakes light
 // through the trunks all day and gives the god rays something to cut through.
 // Fog takes its colour from the sky, so a desaturated grey-green sky is also
 // the haze between the trees -- that one field does most of the work.
 //
 // The landform is PNW's, deliberately: the owner asked for the same country,
 // and the difference should be what grows on it.
 redwood: {light: {shade: '#6f8f98'},
  // No long grass: the courses here are mown clean to the trunks (Northwood).
  longGrass: null,
  farForest: {cover: .95, size: 12, colors: ['#26432a', '#2f4f2e', '#3a5a33']},
  bank: '#40412f', hills: {base: 45, severity: 0, reach: 70}, ringLift: 420,
  // THE REDWOOD COAST AS IT IS (the owner, 5 November 2026, with photographs of
  // Northwood: "kind of a fantasy biome"). This was 42-116 m, every tree the
  // height of the tallest one alive. A mature redwood is normally 60-100 m and
  // Northwood's survey tops out at 74 (RESEARCH, *The Redwood Coast, grounded*),
  // so the canopy is 30-75 m (PLACED), with the young trees under it their own
  // kind, and a heavy old tree the rare top of it rather than the rule.
  canopy: {min: 32, range: 43}, farCanopy: {min: 30, range: 45},
  // Thousands of tall crowns: every tier swaps these to their far twins by the time
  // a crown fills a third of the screen height, about 270 m for a 75 m tree (the
  // renderer takes the larger of this and the tier's own line). High and Ultra's
  // own lines would keep 8,000-triangle trees to the far side of the property.
  farPaintedFrom: .34,
  crownShare: .55,
  // 3.8, down from the 5.5 this started at. Measured at 5.5: 12.3 tall
  // conifers per hectare, and the median tree's crown overlapped its
  // neighbour's by 42%. A cathedral grove is open at the floor and closed
  // overhead, which means fewer and bigger rather than more.
  treeDensity: 3.8,
  waterTint: '#2c5450', waterMurk: .3,
  // Fewer blades, more of everything low and wet.
  // `noFloor`: no eye-level ferns and sticks out in the open: a course here is mown
  // clean to the trunks (the understory stands in the woods, `stands.under`).
  scatter: {rocks: 40, grass: 90000, tufts: 0, tallGrass: false, noFloor: true,
   rockScale: 1.3, bladeLength: .8, bladeWidth: .9, bladeTint: '#46603a',
   flowers: ['#d8d2a6', '#9fb07c']},
  deadfall: 90,
  rockStyle: 'angular', rockMoss: '#4c6a3a',
  // Mossy outcrops in the grove; duff under the giants plays as pine straw.
  landform: {type: 'crags', scale: 180, height: 16, steps: 2, from: .6, to: .95, cluster: .62, reach: 80,
   kinds: {a: 'rock'}, gates: {a: {near: 14, ramp: 16}}},
  fallen: {from: ['redwood', 'youngredwood', 'fir', 'hemlock'], kind: 'pinestraw'},
  // The woods the owner's photographs are made of: redwood in dark green walls
  // down each fairway, in the rings of stems a redwood sprouts from its roots
  // (`clump`: stems round a redwood, metres out, PLACED). Spacing and shares
  // PLACED, measured on Low (TODO *Performance pass*).
  stands: {edge: 44, wobble: 18, ramp: 16, patch: .3, scale: 220, near: 30, spacing: 10, share: .72, grow: 1,
   under: {spacing: 7, plants: [['swordfern', .6], ['salal', .25], ['pacificrhododendron', .15]]},
   plants: [['redwood', .5], ['youngredwood', .3], ['fir', .1], ['tanoak', .05], ['baylaurel', .05]]},
  clump: {kinds: ['redwood', 'youngredwood'], chance: .55, stems: [2, 5], ring: [3, 6.5]},
  // EVERY PLANT HERE IS GROWN, not imported -- see tools/grow.mjs. That let
  // the mix become a real forest rather than three species: giants, the firs
  // and hemlocks between them, a cedar and tanoak mid-storey, seedlings, and
  // a floor of sword fern, salal and sorrel. The third number is a height
  // scale, which is how the understorey stays under the canopy.
  // Redwood first, Douglas fir its usual neighbour, and the hardwoods under
  // and beside them (RESEARCH). Tanoak, bay and madrone stand 8-23 m, big-leaf
  // maple 11-27, as the third numbers make them on this canopy.
  // The floor plants are the woods' (`stands.under`): out on a course the mown
  // grass runs clean to the trunks (Northwood's photographs), so they are a
  // trace here.
  plants: [['redwood', .39], ['youngredwood', .24], ['fir', .11, .8], ['hemlock', .02, .6],
   ['tanoak', .06, .28], ['madrone', .02, .26], ['bigleafmaple', .02, .36], ['seedling', .01, .067],
   ['swordfern', .01], ['salal', .01], ['sorrel', .01],
   // Redwood Coast's own (the US landscapes goal's Pacific pack): bay
   // laurel in the mid-storey (8-25 m of the grove's 42-116), Pacific
   // rhododendron and Douglas iris on the floor. Weights PLACED, taken from
   // the floor's fern, salal and sorrel (generator 61: the list summed to
   // 1.04 and the open pick, cumulative, never reached the iris).
   ['baylaurel', .08, .3], ['pacificrhododendron', .01], ['douglasiris', .01]]},
 northeast: {light: {shade: '#9a7fa6'},
  longGrass: {families: [['grassfescue', 2, .8], ['grassbluestem', 1, 1.2]], count: 3500, near: 22, leaf: '#a38a4c', accent: '#c96d36'},
  // Round 3 of the far landscape: a few of the far woods evergreen (6%; pine and
  // hemlock among the maples), and the far land rising to the low mountains
  // behind a New England valley (170 m; was the default 70).
  farForest: {cover: .9, size: 11, evergreen: .06, colors: ['#b8482c', '#d67c34', '#cfa443', '#3f5a34']}, ringLift: 170,
  bank: '#81724e', leafFall: true, leafLitter: true, spray: '#db9851',
  sunColor: '#ffcc8e', treeDensity: 3.6, waterTint: '#819eae',
  // New England: low granite ledges among the hardwoods, leaves under them.
  landform: {type: 'crags', scale: 150, height: 9, steps: 2, from: .6, to: .94, cluster: .58, summitRock: .6, reach: 70,
   kinds: {a: 'rock'}, gates: {a: {near: 12, ramp: 14}}},
  fallen: {from: ['maple', 'oak', 'aspen'], kind: 'litter'},
  rockMoss: '#7f8a48',
  // The autumn hillside of the owner's photograph: closed hardwood forest.
  stands: {edge: 50, wobble: 22, ramp: 20, patch: .2, scale: 240, near: 35, spacing: 9, share: .6,
   under: {spacing: 8, plants: [['bracken', .6], ['shrub', .4]]},
   // New England's own (the New England pack): white pine (1.2 of the
   // region's 12-27 m), beech (0.9), paper birch and balsam fir (0.7).
   // Weights PLACED.
   plants: [['maple', .3], ['whitepine', .17, 1.2], ['oak', .15], ['americanbeech', .12, .9], ['paperbirch', .1, .7], ['balsamfir', .08, .7], ['aspen', .04], ['spruce', .04]]},
  plants: [['maple', .27], ['whitepine', .14, 1.2], ['oak', .16], ['americanbeech', .1, .9], ['paperbirch', .12, .7], ['balsamfir', .07, .7], ['aspen', .08], ['spruce', .06]]},
 // LAKESHORE DUNES (23 October 2026, the owner's photograph of a Harbor
 // Shores dune hole; RESEARCH, *Lakeshore Dunes, the tenth biome*).
 //
 // Links is the nearest relative and the difference is the point: a Lake
 // Michigan dune is GREEN. Beachgrass with straw tips over the rough instead
 // of golden fescue, a summer woodland of cottonwood, oak and maple behind,
 // and a freshwater lake along one edge -- calm, light blue-grey, a beach and
 // no surf. The dunes are taller than links ground and rise faster off the
 // corridors (`hills`), and wind-torn sand shows in their faces (`blowouts`).
 //
 // Every number here is PLACED: a look matched to the photograph and to what
 // grows on the shore, not a measurement of anywhere.
 lakeshore: {light: {shade: '#8199bf'},
  longGrass: {families: [['grassmarram', 2, 1.0], ['grassfescue', 1, .7]], count: 3500, near: 18, leaf: '#7f9a4c', accent: '#cdb880'},
  // Round 9 of the far landscape: dune woods, not a carpet -- at .75 under a full
  // painted canopy its far land read wall-to-wall identical crowns; half
  // cover and a fainter painting leave open dune and meadow between the woods.
  farForest: {cover: .5, size: 11, paint: .6, colors: ['#3b6a2e', '#4a7a34', '#5a873b']},
  bank: '#a39a72', hills: {base: 30, severity: 40, reach: 34}, ringLift: 90, ringFace: null,
  // `lakeWaves` (the far-landscape goal's waves, round 11): its water is a
  // freshwater lake drawn as sea, and its swash a lake's -- shorter, quicker.
  sea: true, lakeWaves: true, edgeCoast: true, shoreSand: true, mapWater: '#4f8aa6',
  scatter: {rocks: 40, grass: 320000, tufts: 1600, tallGrass: true,
   rockScale: .8, bladeLength: 1.05, bladeWidth: 1.2, bladeTint: '#7f9c4a',
   flowers: ['#e8b93a', '#c9a0d0']},
  spray: '#d9cfa0', sunColor: '#ffe2b8', cover: 'prairie', roughTint: '#a2b46a',
  // Woods behind the dunes, so the plant count runs high; a third of it is
  // dune grass, which threads between the trunks and costs no room.
  treeDensity: 5.4, canopy: {min: 14, range: 14}, farCanopy: {min: 12, range: 14},
  waterTint: '#5d97b3', waterMurk: .65,
  blowouts: .29, driftwood: 6,
  // Open dune beside the holes, woods behind (the photograph's high ground).
  woods: {from: 12, to: 60, floor: .3},
  // Marram on the dune crests. No channel b: the blowouts own the cover
  // texture's blue channel here (ground.js).
  landform: {type: 'dunes', scale: 130, hummock: 34, height: 4, marram: .52, heather: 0,
   kinds: {a: 'native'}, gates: {a: {near: 8, ramp: 14}}},
  // Cottonwood leads the list, so it is the tree that stands in a fairway
  // when a hole gets a feature tree -- the dune's own pioneer.
  // The woods behind the dunes, closed.
  stands: {edge: 70, wobble: 25, ramp: 25, patch: .12, scale: 240, near: 50, spacing: 10, share: .6,
   under: {spacing: 8.5, plants: [['bracken', .5], ['shrub', .5]]},
   plants: [['blackoak', .4], ['cottonwood', .3], ['sugarmaple', .3]]},
  plants: [['cottonwood', .17], ['dunegrass', .29], ['blackoak', .17], ['sugarmaple', .09],
   ['pine', .05], ['juniper', .12], ['commonjuniper', .06], ['sandcherry', .05]]},
};

const PALETTES = {
 pnw:{name:'Pacific Northwest',title:'Sitka Bluff',tag:'Old-growth forest. Cool coastal air.',rough:'#526238',semi:'#477335',fairway:'#538637',fringe:'#638e40',green:'#80a74c',tree:'#254c32',sky:'#a7c6d5',sand:'#e5d9b7',water:'#245959',rock:'#6f7976',altitude:120,temperature:16,treeKind:'pine',sun:28},
 desert:{name:'Desert',title:'Vermilion Basin',tag:'Emerald turf in a sandstone wilderness.',rough:'#b99967',semi:'#688440',fairway:'#39804b',fringe:'#76a055',green:'#90b66b',tree:'#617b46',sky:'#dbd4b9',sand:'#e9c996',water:'#348d8a',rock:'#b57c4e',altitude:450,temperature:31,treeKind:'cactus',sun:24},
 mountain:{name:'Mountain',title:'Alpine Reserve',tag:'Glacial peaks. Clear alpine lakes.',rough:'#65714c',semi:'#557843',fairway:'#639847',fringe:'#86a65d',green:'#a3ba78',tree:'#24473b',sky:'#adcfeb',sand:'#dfddd1',water:'#24647b',rock:'#8a9495',altitude:1800,temperature:11,treeKind:'spruce',sun:36},
 links:{name:'Links',title:'North Sea Links',tag:'Golden fescue, dunes, and Atlantic light.',rough:'#a89d65',semi:'#7e9050',fairway:'#6d9149',fringe:'#91a75b',green:'#acbd73',tree:'#89945e',sky:'#c8d7df',sand:'#e9dcb7',water:'#436e80',rock:'#8b8977',altitude:15,temperature:14,treeKind:'shrub',sun:23},
 midwest:{name:'Midwest',title:'Prairie Run',tag:'Parkland oaks beneath an endless sky.',rough:'#69783b',semi:'#50803d',fairway:'#599743',fringe:'#83a451',green:'#a0be6a',tree:'#46732f',sky:'#b8d7e9',sand:'#e8ddc3',water:'#41766a',rock:'#83846c',altitude:230,temperature:22,treeKind:'oak',sun:39},
 florida:{name:'Island',title:'Leeward Cay',tag:'White coral sand and turquoise shallows.',rough:'#829549',semi:'#5a944c',fairway:'#4b9b58',fringe:'#82b76d',green:'#a4ce83',tree:'#3d803f',sky:'#b0dfec',sand:'#fff0d3',water:'#12a9b0',rock:'#70756a',altitude:8,temperature:28,treeKind:'palm',sun:47},
 redwood:{name:'Redwood Coast',title:'Russian River',tag:'Tall dark walls of redwood. Green valley floors and wet air.',rough:'#5a7f40',semi:'#537f3c',fairway:'#5a8c46',fringe:'#62964a',green:'#7ba452',tree:'#1b3324',sky:'#96a5a4',sand:'#cdc3a7',water:'#1c3f3c',rock:'#5f6a63',altitude:60,temperature:13,treeKind:'pine',sun:18},
 northeast:{name:'Autumn',title:'Copper Hollow',tag:'Copper canopies in the afternoon sun.',rough:'#a19957',semi:'#748347',fairway:'#709245',fringe:'#99aa66',green:'#b2c280',tree:'#b76427',sky:'#e1cfb5',sand:'#e8d7b4',water:'#627967',rock:'#827463',altitude:350,temperature:17,treeKind:'oak',sun:19},
 // Altitude is Lake Michigan's surface, about 177 m; 23 C a July evening on
 // its south-east shore. `sun` 20 is a long warm evening rather than the true
 // 71-degree midsummer noon at 42 N (RESEARCH).
 lakeshore:{name:'Lakeshore Dunes',title:'Beacon Dunes',tag:'Freshwater dunes, summer woods and an inland sea.',rough:'#6f8a44',semi:'#5e9440',fairway:'#5aa443',fringe:'#79b354',green:'#93c766',tree:'#3f6e2c',sky:'#c4d7e3',sand:'#eadcb6',water:'#4f88a3',rock:'#8a8a7a',altitude:180,temperature:23,treeKind:'oak',sun:20}
};

// THE INTERFACE WEARS THE BIOME (the 1.0 interface, approved 17 October 2026).
// One layout everywhere; these six colours are what changes. `panel` is the
// slanted box (see-through, over the course), `a1` and `a2` the two ends of a
// highlighted box's gradient, `hot` the selection outline, the level tag and
// anything that must jump out, `soft` the small capital labels, and `onHot`
// the text written on `a1`/`a2`/`hot`. Red for under par is NOT here: it is
// the same in every biome (ui-palette.js). Taken from the approved mockups.
//
// There is deliberately no default. A biome without its own palette would wear
// another's and nobody would notice; tests/ui-palette.test.mjs refuses it, and
// checks every palette's text is readable. A look, not ground: no
// GENERATOR_VERSION bump, and the fingerprint does not hash it.
const INTERFACE = {
 pnw:      {panel: 'rgba(9,30,28,.88)',  a1: '#5eead4', a2: '#0f766e', hot: '#fde68a', soft: '#a7d8cf', onHot: '#062320'},
 desert:   {panel: 'rgba(48,24,12,.88)', a1: '#fcd34d', a2: '#ea580c', hot: '#ffffff', soft: '#f1c9a5', onHot: '#2a1406'},
 mountain: {panel: 'rgba(15,23,42,.88)', a1: '#93c5fd', a2: '#2563eb', hot: '#fcd34d', soft: '#b3c6e6', onHot: '#0b1530'},
 links:    {panel: 'rgba(22,34,22,.88)', a1: '#d9f99d', a2: '#65a30d', hot: '#fef08a', soft: '#c5d8b0', onHot: '#142010'},
 midwest:  {panel: 'rgba(10,34,18,.88)', a1: '#4ade80', a2: '#15803d', hot: '#facc15', soft: '#a7d7b4', onHot: '#08240f'},
 florida:  {panel: 'rgba(6,30,46,.88)',  a1: '#22d3ee', a2: '#0891b2', hot: '#ff8fa3', soft: '#a5d8e6', onHot: '#04202e'},
 redwood:  {panel: 'rgba(36,12,14,.88)', a1: '#f87171', a2: '#9f1239', hot: '#fde68a', soft: '#e6b3b3', onHot: '#2a0a0e'},
 northeast:{panel: 'rgba(40,24,8,.88)',  a1: '#fbbf24', a2: '#c2410c', hot: '#ffffff', soft: '#ecc9a0', onHot: '#2a1606'},
 // Lake blue and dune sand: not from a mockup (the biome came after them),
 // so PLACED to the same pattern, and held to the contrast test like the rest.
 lakeshore:{panel: 'rgba(8,30,42,.88)',  a1: '#7dd3fc', a2: '#0e7490', hot: '#fde68a', soft: '#b4d6e2', onHot: '#05202c'},
};

// THE WORLD'S SIDE OF A LANDSCAPE: the pieces round a generated course's holes
// -- its clubhouse, cart paths and bridges, dressed water, walls, buildings
// and landmarks, and its animals -- in one block per landscape, so a new
// landscape is one entry here (or its region's; tests/landscapes-complete.test.mjs
// fails without one). Architect's side of a landscape until the designer was removed (the
// owner, 2 November 2026); its `styles` and `signature` went with it, and the
// two things the pieces read from the leading style became fields of their own:
//
//   edge       a pond's dressed edge on the side play comes from (waterworks.js):
//              'riprap' stones, 'bulkhead' railway ties, or null, soft grass
//   fountain   whether a large open pond may have an aerating fountain
//   clubhouse  the clubhouse model (tools/blender/architect_clubhouses.py)
//   path       the cart path's surface (paths.js)
//   bridge     'wood' or 'stone' bridge bays (renderer.js addPaths)
//   story      the land's story (story.js): walls, farm, ruins, landmark
//   life       its animals (life.js): grazers, geese, a heron, fliers
//   colours    the clubhouse's walls, roof, trim and glass; rip-rap, field
//              wall, ruin and stone-bridge stone
//
// A landscape without an entry falls back to WORLD_GENERIC -- rip-rap and a
// fountain, a farmhouse, asphalt, wood, no story and no animals -- which
// builds, but reads as nowhere in particular. The edges and fountains are
// PLACED from each landscape's leading Architect style (rip-rap for Desert,
// Mountain, Island and Redwood; a fountain for Island and Redwood).
export const WORLD_GENERIC = {
 edge: 'riprap', fountain: true, clubhouse: 'farmhouse', path: 'asphalt', bridge: 'wood', story: {}, life: {},
 colours: {clubhouse: {stone: '#f2efe6', bark: '#7a3d32', accent: '#ffffff', dirt: '#2e3a44'}, riprap: '#a8a298', wall: '#c2b8a4', ruin: '#b5ab98', bridgeStone: '#bdb6a6'},
};
export const WORLD = {
 pnw: {edge: null, fountain: false, clubhouse: 'lodge', path: 'bark', bridge: 'wood',
  story: {walls: 'hedge', ruins: ['cottage']}, life: {grazers: ['deer', 3], heron: true},
  colours: {clubhouse: {stone: '#8b6a4a', bark: '#4f5b46', accent: '#ddd2bb', dirt: '#2c3438'}, riprap: '#7d7972', wall: '#c2b8a4', ruin: '#8f8c7e', bridgeStone: '#bdb6a6'}},
 desert: {edge: 'riprap', fountain: false, clubhouse: 'adobe', path: 'granite', bridge: 'wood',
  // No ruin (the owner, Models to check, 9 November 2026: the desert cottage stood as one flat wall).
  story: {walls: null, ruins: []}, life: {grazers: ['roadrunner', 2]},
  colours: {clubhouse: {stone: '#d7a77a', bark: '#7d5a3c', accent: '#8a5a36', dirt: '#3a2c26'}, riprap: '#b5865c', wall: '#c2b8a4', ruin: '#cfa27a', bridgeStone: '#bdb6a6'}},
 mountain: {edge: 'riprap', fountain: false, clubhouse: 'chalet', path: 'gravel', bridge: 'wood',
  // Split-rail fences, not field walls (the US landscapes goal's mountain pack).
  story: {walls: 'rail', ruins: ['minehead', 'cottage']}, life: {grazers: ['elk', 2], heron: true},
  colours: {clubhouse: {stone: '#b88d5e', bark: '#5a4436', accent: '#efe6d2', dirt: '#2b3036'}, riprap: '#87817a', wall: '#b4ac9f', ruin: '#a49c90', bridgeStone: '#bdb6a6', rail: '#8a7a62'}},
 links: {edge: null, fountain: false, clubhouse: 'stonehouse', path: 'gravel', bridge: 'stone',
  story: {walls: 'stone', ruins: ['chapel', 'cottage'], landmark: 'lighthouse'}, life: {grazers: ['sheep', 9], fliers: ['gull', 3]},
  colours: {clubhouse: {stone: '#c3bfb2', bark: '#5b6168', accent: '#ece8de', dirt: '#2a3036'}, riprap: '#99948a', wall: '#cfc8b6', ruin: '#bdb7a8', bridgeStone: '#bdb6a6'}},
 midwest: {edge: null, fountain: false, clubhouse: 'farmhouse', path: 'asphalt', bridge: 'wood',
  // The red barn (with its silo and lean-to) and corn beside it (the
  // Heartland pack).
  story: {walls: 'hedge', farm: 'redbarn'}, life: {grazers: ['deer', 3], geese: 6},
  colours: {clubhouse: {stone: '#f2efe6', bark: '#7a3d32', accent: '#ffffff', dirt: '#2e3a44'}, riprap: '#8f897e', wall: '#c2b8a4', ruin: '#b5ab98', bridgeStone: '#bdb6a6'}},
 florida: {edge: 'riprap', fountain: true, clubhouse: 'pavilion', path: 'shell', bridge: 'wood',
  story: {walls: null, ruins: ['sugarmill']}, life: {fliers: ['gull', 3], heron: true},
  colours: {clubhouse: {stone: '#e8d7b5', bark: '#c7a35f', accent: '#9b7048', dirt: '#2b3a3a'}, riprap: '#4d4744', wall: '#c2b8a4', ruin: '#b3a48c', bridgeStone: '#bdb6a6'}},
 redwood: {edge: 'riprap', fountain: true, clubhouse: 'loglodge', path: 'bark', bridge: 'wood',
  story: {walls: null, ruins: ['cottage']}, life: {grazers: ['elk', 3]},
  colours: {clubhouse: {stone: '#9a6342', bark: '#3f4a3a', accent: '#d8c7a8', dirt: '#2a2e2c'}, riprap: '#837767', wall: '#c2b8a4', ruin: '#948a7a', bridgeStone: '#bdb6a6'}},
 // Fieldstone walls and covered bridges (the New England pack).
 northeast: {edge: null, fountain: false, clubhouse: 'clapboard', path: 'asphalt', bridge: 'covered',
  story: {walls: 'field', farm: true, ruins: ['cottage'], landmark: 'church'}, life: {grazers: ['deer', 4], geese: 4},
  colours: {clubhouse: {stone: '#f1ede2', bark: '#3d4044', accent: '#ffffff', dirt: '#2d3640'}, riprap: '#928b80', wall: '#c2b8a4', ruin: '#b5ab98', bridgeStone: '#c4b9a6'}},
 lakeshore: {edge: null, fountain: false, clubhouse: 'shingle', path: 'boardwalk', bridge: 'wood',
  // A Great Lakes pier light for its landmark (the dry-and-lake pack).
  story: {walls: null, ruins: ['cottage'], landmark: 'pierlight'}, life: {fliers: ['gull', 4], geese: 6},
  colours: {clubhouse: {stone: '#c4ab84', bark: '#6d6a63', accent: '#f4f1ea', dirt: '#2c3a46'}, riprap: '#9c937f', wall: '#c9bfa8', ruin: '#c4b9a2', bridgeStone: '#bdb6a6'}},
};
// EACH BUILT LANDSCAPE: what it changes from its region's record -- palette
// and traits flat, `ui` the interface colours, `world` its world block. Its
// player name, region and place are regions.js LANDSCAPES. A key here is a
// landscape a player can pick (settings-schema.js BIOME_KEYS, held to this
// list by tests/landscapes-complete.test.mjs); the goal adds the rest region by
// region.
// THE NEW REGIONS ON EXISTING MODELS (the US landscapes goal, phase 3: the
// pipeline proved end to end before a region gets its own models). Each is
// the nearest region's record with what differs laid over it; every value
// here is PLACED from the study's page for the landscape.
// The Great Plains: shortgrass and bluestem, cottonwoods along the creeks,
// cedar and elm shelterbelts, a windmill for a landmark.
TRAITS.plains = {...TRAITS.midwest, light: {shade: '#8a9ac0'},
 longGrass: {families: [['grassbluestem', 2, 1.1], ['grassfescue', 3, .7]], count: 5200, near: 20, leaf: '#8c8a4c', accent: '#b8743c'},
 farForest: {cover: .14, size: 10, colors: ['#4f6a34', '#5d7638', '#6e7f3e']},
 // Round 2 of its pictures: at density 1.1 it stood in parkland; open
 // grass now, trees a few and mostly in the stands.
 bank: '#7d7648', treeDensity: .5, rockMoss: '#9c9a62',
 stands: {...TRAITS.midwest.stands, patch: .03, spacing: 12, share: .3,
  under: {spacing: 9, plants: [['shrub', .7], ['prairieforbs', .3]]},
  // The band along the corridors is mostly brush (round 3: trees there
  // walled every hole in).
  plants: [['shrub', .45], ['easternredcedar', .25], ['cottonwood', .2], ['americanelm', .1]]},
 // Phase 8: the plains pack's own -- eastern red cedar for the stand-in
 // juniper, soapweed yucca, buffalo grass and wild sunflowers (PLACED).
 plants: [['cottonwood', .1], ['easternredcedar', .08], ['americanelm', .04], ['shrub', .12], ['soapweedyucca', .06], ['buffalograss', .1], ['wildsunflower', .05], ['prairieforbs', .45]]};
PALETTES.plains = {...PALETTES.midwest, name: 'Plains', title: 'Big Sky Links', tag: 'Grass to the horizon and wind in it.',
 rough: '#8a8a4a', semi: '#6e8a44', tree: '#4f6a34', sky: '#b9d4ec', altitude: 700, temperature: 21, treeKind: 'shrub', sun: 41};
INTERFACE.plains = {panel: 'rgba(36,30,10,.88)', a1: '#fde68a', a2: '#ca8a04', hot: '#ffffff', soft: '#e8d9a8', onHot: '#231c06'};
WORLD.plains = {...WORLD.midwest, clubhouse: 'farmhouse', path: 'gravel', bridge: 'wood',
 story: {walls: 'wire', farm: true, shelterbelt: true, landmark: 'windmill'}, life: {grazers: ['deer', 3]}};
// The High Desert (phase 8; from the Sonoran's record): pinyon and Utah
// juniper over blackbrush and cliffrose on red sandstone, hoodoos and fins
// for its stone -- Red Rock as it is. Every value PLACED from the study's
// pages (subs/highdesert/).
TRAITS.highdesert = {...TRAITS.desert, light: {shade: '#9a8ab0', exposure: .9},
 longGrass: {families: [['grassbunch', 2, .7]], count: 3000, near: 20, leaf: '#a8a070', accent: '#d0c08a'},
 farForest: {cover: .4, size: 6, scrub: true, paint: .2, colors: ['#56684a', '#62704e', '#6e7a52']},
 rockStyle: 'hoodoo', rockMoss: '#e0b080', treeDensity: 1.4,
 stands: {...TRAITS.desert.stands, under: {spacing: 8, plants: [['blackbrush', .4], ['cliffrose', .3], ['sagebrush', .3]]},
  plants: [['pinyonpine', .45], ['utahjuniper', .45], ['cliffrose', .1]]},
 plants: [['pinyonpine', .15], ['utahjuniper', .18], ['blackbrush', .15], ['cliffrose', .1], ['globemallow', .08], ['sagebrush', .14], ['rabbitbrush', .08], ['cheatgrass', .07], ['russianolive', .05]]};
PALETTES.highdesert = {...PALETTES.desert, name: 'High Desert', title: 'Slickrock Rim', tag: 'Pinyon, juniper and red rock.',
 rough: '#a8946a', rock: '#c06a3a', sky: '#c8d8ea', altitude: 1500, temperature: 26, treeKind: 'pine', sun: 38};
INTERFACE.highdesert = {panel: 'rgba(40,20,14,.88)', a1: '#fdba74', a2: '#c2410c', hot: '#fff7ed', soft: '#e8ccb8', onHot: '#2a1006'};
WORLD.highdesert = {...WORLD.desert, clubhouse: 'adobe', story: {walls: null, ruins: ['cottage']}, life: {grazers: ['deer', 2]}};
// Appalachia (phase 8b; from New England's record, in summer): hardwood
// ridges fading blue into the haze -- chestnut oak, tulip poplar, hemlock,
// shortleaf pine over rhododendron, mountain laurel and flame azalea; a log
// cabin with its stone chimney. Every value PLACED from the study's pages
// (subs/appalachia/).
// No fallen-leaf ground under the trees: New England's is its autumn, and in
// a summer landscape it read as orange paint (the first pictures).
TRAITS.appalachia = {...TRAITS.northeast, leafFall: false, leafLitter: false, fallen: null, light: {shade: '#8a96bc'},
 hills: {base: 50, severity: 120, reach: 85},
 farForest: {cover: .9, size: 11, colors: ['#3e6232', '#4a6e38', '#567a3e']},
 stands: {...TRAITS.northeast.stands, under: {spacing: 8, plants: [['rosebay', .4], ['mountainlaurelshrub', .35], ['flameazalea', .25]]},
  plants: [['chestnutoak', .3], ['tulippoplar', .2], ['oak', .15], ['hemlock', .15], ['maple', .1], ['shortleafpine', .1]]},
 plants: [['chestnutoak', .15], ['tulippoplar', .1], ['oak', .1], ['hemlock', .08], ['maple', .08], ['shortleafpine', .07], ['sassafras', .07], ['floweringdogwood', .05], ['rosebay', .12], ['mountainlaurelshrub', .1], ['flameazalea', .08]]};
PALETTES.appalachia = {...PALETTES.midwest, name: 'Appalachia', title: 'Blue Haze Hollow', tag: 'Hardwood ridges fading blue into the haze.',
 rough: '#6a7a3e', semi: '#4f8a3e', fairway: '#549a44', tree: '#3e6430', sky: '#bcd2e4', altitude: 900, temperature: 24, treeKind: 'oak', sun: 42};
INTERFACE.appalachia = {panel: 'rgba(18,26,36,.88)', a1: '#c7e0f4', a2: '#1e5a8a', hot: '#fef3c7', soft: '#bccad8', onHot: '#081828'};
WORLD.appalachia = {...WORLD.northeast, clubhouse: 'loglodge', path: 'asphalt', bridge: 'wood',
 story: {walls: 'rail', ruins: ['stonecabin']}, life: {grazers: ['deer', 4]}, colours: {...WORLD.northeast.colours, rail: '#7a6a52'}};
// Alaska: the Rockies' crags close behind, spruce and birch, a long low sun.
TRAITS.alaska = {...TRAITS.mountain, light: {shade: '#7c8cb8'}, treeDensity: 3,
 // Phase 8c: the north pack's black spruce, fireweed (for the stand-in
 // lupine), devil's club and cottongrass.
 stands: {...TRAITS.mountain.stands, plants: [['spruce', .3], ['blackspruce', .25], ['paperbirch', .3, .6], ['aspen', .15]]},
 plants: [['spruce', .15], ['blackspruce', .2], ['paperbirch', .18, .6], ['aspen', .12], ['willowthicket', .12], ['fireweed', .1], ['devilsclub', .05], ['cottongrass', .05], ['columbine', .03]]};
PALETTES.alaska = {...PALETTES.mountain, name: 'Alaska', title: 'Midnight Sun', tag: 'Spruce, birch and the long low light.',
 rough: '#6a7650', tree: '#2a4a38', sky: '#b4d0e6', altitude: 100, temperature: 13, sun: 16};
INTERFACE.alaska = {panel: 'rgba(12,24,36,.88)', a1: '#a5f3fc', a2: '#0e7490', hot: '#fbcfe8', soft: '#b8d8e2', onHot: '#071820'};
WORLD.alaska = {...WORLD.mountain, clubhouse: 'loglodge', path: 'gravel', bridge: 'wood',
 story: {walls: null, ruins: ['minehead', 'cottage']}, life: {grazers: ['elk', 3], heron: true}};

// The North Woods (phase 8c; from New England's record, in summer): red and
// jack pine, white pine, birch, aspen and tamarack round blue lakes, a log
// cabin and a dock. Every value PLACED from the study's pages
// (subs/northwoods/).
TRAITS.northwoods = {...TRAITS.northeast, leafFall: false, leafLitter: false, fallen: {from: ['redpine', 'jackpine', 'whitepine'], kind: 'pinestraw'},
 light: {shade: '#8494c0'}, hills: {base: 25, severity: 45, reach: 80},
 farForest: {cover: .9, size: 10, colors: ['#2f5a32', '#3a6436', '#4a6e3a']},
 stands: {...TRAITS.northeast.stands, under: {spacing: 8, plants: [['shrub', .5], ['bracken', .5]]},
  plants: [['redpine', .35], ['whitepine', .2, 1.2], ['paperbirch', .2, .7], ['balsamfir', .15, .7], ['jackpine', .1]]},
 plants: [['redpine', .2], ['jackpine', .1], ['whitepine', .1, 1.2], ['paperbirch', .15, .7], ['aspen', .1], ['tamarack', .07], ['balsamfir', .08, .7], ['shrub', .1], ['fern', .05], ['fireweed', .05]]};
PALETTES.northwoods = {...PALETTES.midwest, name: 'North Woods', title: 'Loon Lake', tag: 'Red pine and birch round blue lakes.',
 rough: '#6e7a44', semi: '#4f8a3e', tree: '#2f5a32', sky: '#b8d4ec', water: '#3a6a86', altitude: 400, temperature: 22, treeKind: 'pine', sun: 44};
INTERFACE.northwoods = {panel: 'rgba(12,22,30,.88)', a1: '#bfe3f0', a2: '#155e75', hot: '#fef3c7', soft: '#b4ccd4', onHot: '#06161e'};
WORLD.northwoods = {...WORLD.northeast, clubhouse: 'loglodge', path: 'gravel', bridge: 'wood',
 story: {walls: null, ruins: ['logcabin'], dock: true}, life: {grazers: ['deer', 3], heron: true, geese: 4}};
// Hawaii (phase 8c; from the Heartland's record, with the Keys' warmth): a
// sea along one side, green volcanic slopes and peaks behind, black lava,
// monkeypods, ironwoods, Cook pines, palms and ohia; ti and heliconia.
TRAITS.hawaii = {...TRAITS.midwest, light: {shade: '#7ea0c4'}, sea: true, edgeCoast: true, shoreSand: true, warm: true,
 hills: {base: 30, severity: 80, reach: 80}, ringLift: 700, ringPeaks: true, ringFace: 'rock', rockStyle: 'lava', rockMoss: '#4a7a3a',
 longGrass: {families: [['grassbunch', 2, 1], ['grassfescue', 1, .8]], count: 3500, near: 20, leaf: '#6a9a44', accent: '#a8b060'},
 farForest: {cover: .85, size: 11, colors: ['#2e6a34', '#3a7638', '#4a823e']},
 scatter: {...DEFAULTS.scatter, rocks: 260},
 stands: {...TRAITS.midwest.stands, under: {spacing: 8, plants: [['tiplant', .5], ['heliconia', .5]]},
  plants: [['monkeypod', .3], ['casuarina', .25], ['ohia', .2], ['palm', .15], ['cookpine', .1]]},
 plants: [['monkeypod', .1], ['casuarina', .1], ['cookpine', .06], ['ohia', .1], ['palm', .14], ['plumeria', .08], ['tiplant', .14], ['heliconia', .1], ['hibiscus', .08], ['bougainvillea', .05], ['hala', .05]]};
PALETTES.hawaii = {...PALETTES.florida, name: 'Hawaii', title: 'Lava Point', tag: 'Green volcanic slopes, black lava and the Pacific.',
 rough: '#5e8a40', semi: '#4f944a', fairway: '#4b9b58', tree: '#2e6a34', sky: '#b4dcee', sand: '#e8dcc0', water: '#1a8aa8', rock: '#3a3230',
 altitude: 60, temperature: 27, treeKind: 'palm', sun: 52};
INTERFACE.hawaii = {panel: 'rgba(10,28,22,.88)', a1: '#a7f3d0', a2: '#0f766e', hot: '#fecaca', soft: '#b0d4c8', onHot: '#04201a'};
WORLD.hawaii = {...WORLD.midwest, clubhouse: 'pavilion', path: 'asphalt', bridge: 'wood',
 story: {walls: null, ruins: ['sugarmill']}, life: {heron: true},
 colours: {...WORLD.midwest.colours, clubhouse: {stone: '#efe6d4', bark: '#5a4636', accent: '#2e6a4a', dirt: '#2a3028', leaf: '#2a3028'}}};
// The South (phase 5): the Heartland's rolling ground, humid haze, pines and
// live oaks, a white plantation clubhouse. Every value PLACED from the
// study's pages (subs/south/).
TRAITS.south = {...TRAITS.midwest, light: {shade: '#8a98b4'},
 longGrass: {families: [['grassbluestem', 2, 1.2], ['grassfescue', 2, .8]], count: 4200, near: 22, leaf: '#7a8a46', accent: '#b07a3e'},
 farForest: {cover: .8, size: 12, colors: ['#3e6232', '#4a6e36', '#567a3a']},
 bank: '#6e6a44', rockMoss: '#8a9a58', treeDensity: 3,
 stands: {...TRAITS.midwest.stands, under: {spacing: 8, plants: [['azalea', .4], ['yaupon', .3], ['shrub', .3]]},
  plants: [['loblollypine', .35], ['tulippoplar', .2], ['sweetgum', .15], ['oak', .15], ['magnolia', .1], ['floweringdogwood', .05]]},
 plants: [['loblollypine', .15], ['oak', .05], ['tulippoplar', .1], ['sweetgum', .1], ['magnolia', .1], ['floweringdogwood', .12], ['crapemyrtle', .08], ['azalea', .15], ['shrub', .1], ['kudzu', .05]]};
PALETTES.south = {...PALETTES.midwest, name: 'The South', title: 'Magnolia Run', tag: 'Pines, live oaks and a warm humid haze.',
 rough: '#6e7a3c', semi: '#4f8a3e', fairway: '#549a44', tree: '#3e6a30', sky: '#c4d6e2', sand: '#ece2c8', water: '#4a6e5e', altitude: 150, temperature: 27, treeKind: 'pine', sun: 44};
INTERFACE.south = {panel: 'rgba(20,34,22,.88)', a1: '#fecdd3', a2: '#be185d', hot: '#fef3c7', soft: '#d8c8c4', onHot: '#2a0f18'};
WORLD.south = {...WORLD.midwest, clubhouse: 'plantation', path: 'asphalt', bridge: 'wood',
 // No barn and silo (the owner, Models to check, 9 November 2026: a Midwest barn read oddly at
 // Pinehurst and in the Lowcountry).
 story: {walls: null, ruins: ['chapel']}, life: {grazers: ['deer', 3], heron: true, geese: 4},
 colours: {...WORLD.midwest.colours, clubhouse: {stone: '#f2efe6', bark: '#5a5e62', accent: '#7a3a2a', dirt: '#2a3a2a', leaf: '#2a3a2a'}}};
// Texas (phase 6): the Hill Country's rolling limestone, Ashe juniper and live
// oak, post oak and pecan; bluebonnets in the rough; a limestone ranch house.
// Every value PLACED from the study's pages (subs/texas/).
TRAITS.texas = {...TRAITS.midwest, light: {shade: '#9890b0', exposure: .95},
 longGrass: {families: [['grassbluestem', 3, 1.2], ['grassbunch', 1, .8]], count: 4000, near: 22, leaf: '#8a8a4e', accent: '#b0804a'},
 farForest: {cover: .6, size: 9, colors: ['#3e5a36', '#4a6638', '#5a703e']},
 bank: '#9a8a62', rockMoss: null, rockStyle: 'limestone', treeDensity: 2.2,
 hills: {base: 30, severity: 60, reach: 80},
 // Bluebonnet blue and Indian paintbrush red in the rough (vegetation.js
 // FLOWER_REGIONS; PLACED).
 scatter: {...DEFAULTS.scatter, rocks: 320, flowers: ['#3a5ac8', '#d8502e']},
 stands: {...TRAITS.midwest.stands, under: {spacing: 8, plants: [['mountainlaurel', .4], ['shrub', .6]]},
  plants: [['ashejuniper', .35], ['liveoak', .25], ['postoak', .2], ['cedarelm', .1], ['mesquite', .1]]},
 plants: [['liveoak', .15], ['ashejuniper', .15], ['postoak', .1], ['mesquite', .08], ['pecan', .05], ['cedarelm', .05], ['redbud', .05], ['mountainlaurel', .07], ['bluebonnet', .2], ['shrub', .1]]};
PALETTES.texas = {...PALETTES.midwest, name: 'Texas', title: 'Cedar Break', tag: 'Live oaks, limestone and bluebonnets.',
 rough: '#8a8a4c', semi: '#5e8a40', fairway: '#5a9a44', tree: '#44602e', sky: '#c4d8e8', sand: '#ece0c4', water: '#4a7a72', rock: '#d8d0b8',
 altitude: 300, temperature: 30, treeKind: 'oak', sun: 40};
INTERFACE.texas = {panel: 'rgba(34,26,18,.88)', a1: '#fed7aa', a2: '#c2410c', hot: '#fef3c7', soft: '#e2cdb8', onHot: '#2a1408'};
WORLD.texas = {...WORLD.midwest, clubhouse: 'stonehouse', path: 'asphalt', bridge: 'stone',
 story: {walls: 'rail', farm: true, ruins: ['cottage'], landmark: 'windpump'}, life: {grazers: ['deer', 4], heron: true},
 colours: {...WORLD.midwest.colours, clubhouse: {stone: '#e0d6bc', bark: '#6a5a48', accent: '#8a4a2a', dirt: '#3a3024', leaf: '#3a3024'}}};
// California (phase 7): oak woodland on hills gone gold in the dry summer,
// chaparral and coastal sage, a mission-style clubhouse. Every value PLACED
// from the study's pages (subs/california/).
TRAITS.california = {...TRAITS.midwest, light: {shade: '#9a94b4', exposure: .95},
 longGrass: {families: [['grassbunch', 2, .9], ['grassfescue', 2, .7]], count: 4500, near: 22, leaf: '#b0a060', accent: '#d8c080'},
 farForest: {cover: .5, size: 10, colors: ['#4a6238', '#56703e', '#6a7a44']},
 bank: '#a08a5a', rockMoss: null, rockStyle: 'round', treeDensity: 1.8,
 hills: {base: 35, severity: 70, reach: 80},
 scatter: {...DEFAULTS.scatter, rocks: 120},
 stands: {...TRAITS.midwest.stands, under: {spacing: 8, plants: [['chaparral', .5], ['coastalsage', .3], ['shrub', .2]]},
  plants: [['coastliveoak', .45], ['valleyoak', .2], ['blueoak', .15], ['sycamore', .1], ['buckeye', .1]]},
 plants: [['coastliveoak', .18], ['valleyoak', .1], ['blueoak', .1], ['sycamore', .05], ['buckeye', .05], ['chaparral', .14], ['coastalsage', .12], ['californiapoppy', .12], ['eucalyptus', .06], ['olivetree', .04], ['peppertree', .04]]};
PALETTES.california = {...PALETTES.midwest, name: 'California', title: 'Golden Hills', tag: 'Oak woodland on golden summer hills.',
 rough: '#b0a060', semi: '#6e8a40', fairway: '#5a9a44', tree: '#4a6a34', sky: '#c8dcec', sand: '#ece2c4', water: '#3e7a86', rock: '#a8a090',
 altitude: 200, temperature: 26, treeKind: 'oak', sun: 42};
INTERFACE.california = {panel: 'rgba(36,30,14,.88)', a1: '#fef08a', a2: '#ca8a04', hot: '#fffbeb', soft: '#e8d8a8', onHot: '#2a1f06'};
WORLD.california = {...WORLD.midwest, clubhouse: 'adobe', path: 'asphalt', bridge: 'wood',
 story: {walls: null, ruins: ['chapel']}, life: {grazers: ['deer', 3], heron: true},
 colours: {...WORLD.midwest.colours, clubhouse: {stone: '#efe6d4', bark: '#6a5040', accent: '#b4553a', dirt: '#3a2c24', leaf: '#3a2c24'}}};
const LAND = {
 redwood: {},
 // The Badlands (the owner, 3 November 2026; the study's plains.badlands):
 // South Dakota's White River badlands and North Dakota's Little Missouri --
 // mixed-grass prairie tables broken into banded clay. Western wheatgrass and
 // blue grama over leadplant, yucca and sage; Rocky Mountain juniper dark on
 // the slopes, green ash, cottonwood and chokecherry in the draws (NPS and
 // Wikipedia, RESEARCH.md *The Badlands*). The badlands themselves are the
 // ground's, not models (the owner, 3 November 2026): the `badlands`
 // landform carves ridges, pyramids, spires and flat-topped buttes out of a
 // drainage network between the holes, bare clay faces (rock) with a wash at
 // their feet (hardpan); the far land is the same carving, coarser, its tables
 // on the horizon; every rock face is painted in level beds (`strata`,
 // ground.js). Bison on the tables. Every figure not in RESEARCH is PLACED
 // from the study's pictures.
 // The last batch's trees (8 November 2026): Meshy green ash and Rocky Mountain juniper, and the
 // Prairie's plains cottonwood, in place of the hand-built ones; crowns kept apart (`crownShare`).
 badlands: {crownShare: .9, fallen: {from: ['bdjuniper'], kind: 'pinestraw'}, title: 'Badlands Wall', tag: 'Banded spires over the mixed-grass prairie.',
  rough: '#9a9868', rock: '#c8b8a4', sky: '#bed6ec', altitude: 750, temperature: 22, sun: 45, treeKind: 'pine',
  rockStyle: 'badlands', rockMoss: '#c8a050', treeDensity: .5, hills: {base: 30, severity: 60, reach: 80},
  ringLift: 34, ringFace: 'rock',
  // The far country is the same carving ten times coarser (landscape-edge.js
  // `ringRelief`), for the ring's rows to draw: tables with fluted scarps,
  // the White River's Wall, standing out of the prairie. PLACED.
  ringCarve: {tile: 7000, grid: 350, scale: 1300, from: .44, to: .5, spine: 900, slope: 1.2, concavity: .5, wander: 14, blur: 1,
   peakFrom: 90, peak: 1.3, cap: 110, capAt: .52, capScale: 1200, near: 140, far: 700},
  landform: {type: 'badlands', tile: 1500, grid: 750, scale: 300, from: .46, to: .54, spine: 260, slope: 1.9, concavity: .5, wander: 14, blur: 1,
   peakFrom: 44, peak: 1.7, cap: 50, capAt: .42, capScale: 320, sink: 12, routed: true, ledges: 2.2, ledge: .22, swale: 3, reach: 30,
   kinds: {a: 'rock', b: 'hardpan'}, gates: {a: {near: 14, ramp: 18}, b: {near: 10, ramp: 16}}},
  groundTints: {hardpan: '#c8b8a0', rock: '#c4b4a0'},
  // The beds (ground.js strataUniforms): tan rock most often, then pink,
  // grey, the red fossil soils and the white ash, 1.8 m a bed. PLACED.
  strata: {spacing: 1.8, colors: ['#d4b0a0', '#a8a49c', '#b06a50', '#ece6dc'], shares: [.3, .2, .08, .035]},
  longGrass: {...TRAITS.plains.longGrass, families: [['grasswheat', 3, .8], ['grassgrama', 2, .35]], leaf: '#8a9a7a', accent: '#c0b080'},
  farForest: {cover: .05, size: 7, scrub: true, paint: .3, colors: ['#4e6458', '#5a6c58', '#6a7a5a']},
  // Round 2 (the first capture): the plains' stands at .3 walled the holes
  // in green woods; the badlands are open grass, junipers dotted in the
  // draws, ash and chokecherry along a creek.
  stands: {...TRAITS.plains.stands, edge: 260, wobble: 40, share: .06, patch: .03, spacing: 14, under: {spacing: 12, plants: [['chokecherry', .5], ['shrub', .5]]},
   plants: [['bdjuniper', .7], ['bdash', .15], ['chokecherry', .15]]},
  // Round 2: the open grass is prairie -- yucca, sage, leadplant and forbs
  // -- with only the odd tree; the trees are the stands' (in the draws).
  // Green ash first: the specimen tree in a fairway is the first species
  // (course.js featureTree), and a full-size lone juniper stood oversized.
  plants: [['bdash', .01], ['bdjuniper', .06], ['prcotton', .01], ['chokecherry', .02], ['soapweedyucca', .14], ['leadplant', .2], ['sagebrush', .14], ['prairieforbs', .26], ['buffalograss', .06], ['shrub', .1]],
  ui: {panel: 'rgba(40,26,22,.88)', a1: '#fecdd3', a2: '#b4533a', hot: '#fff7ed', soft: '#e8d0c4', onHot: '#2a100a'},
  world: {clubhouse: 'loglodge', story: {walls: 'wire', ruins: ['logcabin'], landmark: 'windmill'}, life: {grazers: ['bison', 5]}}},
 // Classic Parkland: tall hardwoods in groups and lines along mown holes, grass right
 // to the trunks. Two or three signature trees and a few accents on the course,
 // the same woods beyond the rough (docs/studies/us-golf-courses, local). The
 // first landscape planted only with trees from Meshy. Density and colours PLACED. The
 // region's autumn sun and purple shade turned bark black and the rough olive on the
 // first look, so this has summer light of its own, and its woods stand well back. The default lets
 // crowns run through each other, which the owner saw at once on tall open trees
 // (6 November 2026), so `crownShare` and the stands' `share` keep them apart.
 parkland: {crownShare: .9, light: {shade: '#8494bc'}, sunColor: '#fff0d6', leafFall: false, leafLitter: false, fallen: null, rough: '#5f8a44', semi: '#538e42', tree: '#3f6a30', sky: '#b9d3e8', treeDensity: 2.2,
  title: 'Golden Age', tag: 'Tall oaks and maples along mown fairways.',
  farForest: {cover: .85, size: 11, colors: ['#3f6a30', '#4a7436', '#56803a']},
  longGrass: {families: [['grassfescue', 2, .8], ['grassbluestem', 1, 1.1]], count: 900, near: 22, leaf: '#7a8a46', accent: '#a07a3e'},
  stands: {...TRAITS.northeast.stands, edge: 95, wobble: 30, patch: .05, near: 70, spacing: 13, share: .8,
   plants: [['whiteoak', .4], ['pinoak', .24], ['parkmaple', .24], ['parkpoplar', .05], ['norwayspruce', .03], ['parkelm', .04]]},
  plants: [['whiteoak', .3], ['pinoak', .2], ['parkmaple', .24], ['parkpoplar', .09], ['parkelm', .07], ['norwayspruce', .06], ['shrub', .04]],
  ui: {panel: 'rgba(14,32,20,.88)', a1: '#bbf7d0', a2: '#166534', hot: '#fde68a', soft: '#b6d4bc', onHot: '#0a1f10'},
  world: {clubhouse: 'tudor', bridge: 'stone', story: {walls: 'field', ruins: ['cottage'], landmark: 'church'},
   colours: {...WORLD.northeast.colours, clubhouse: {stone: '#f2ece0', bark: '#6a3a2a', accent: '#4a3a2a', dirt: '#2a3038'}}}},
 // Phase 5: the South (the US landscapes goal's South packs).
 // Southern Pines: very tall pines on long bare trunks over wide corridors, pine straw
 // under them, sandy waste and wiregrass (Pinehurst), dogwood and azalea colour
 // (Augusta), darker white pines (Pine Valley). The second landscape planted only from
 // Meshy, with Classic Parkland's lessons: crowns kept apart, woods set back, a
 // mown green rough. The default rough tint is a pale yellow that blotched it, and the
 // South's fairway read neon close up, so both are set here. Density and colours PLACED.
 southpines: {groundTints: {pinestraw: '#73683e'}, crownShare: .9, treeDensity: 2.4, rough: '#6d8a46', semi: '#5a8c48', fairway: '#689a58', fringe: '#7aa462', roughTint: '#8aa45a', sand: '#ece2c8', temperature: 24,
  title: 'Long Shadows', tag: 'Tall pines, pine straw and white sand.',
  fallen: {from: ['southloblolly', 'southlongleaf', 'southwhitepine'], kind: 'pinestraw'},
  longGrass: {...TRAITS.south.longGrass, count: 1200},
  stands: {...TRAITS.south.stands, edge: 80, wobble: 28, patch: .1, near: 55, spacing: 12, share: .8, under: {spacing: 9, plants: [['wiregrass', .5], ['longleafgrass', .3], ['yaupon', .2]]},
   plants: [['southloblolly', .48], ['southlongleaf', .36], ['southwhitepine', .16]]},
  plants: [['southloblolly', .34], ['southlongleaf', .3], ['southwhitepine', .1], ['southdogwood', .1], ['azalea', .06], ['wiregrass', .06], ['longleafgrass', .04]],
  ui: {panel: 'rgba(30,26,16,.88)', a1: '#fcd9a8', a2: '#9a5a12', hot: '#fff3c4', soft: '#e4d4b0', onHot: '#231806'}},
 // Lowcountry and Gulf: the Lowcountry's salt marsh and tidal creeks, planted only from
 // Meshy. Tall live oaks in a mix with loblollies, pine straw under them (the Harbour
 // Town photos), sabal palms, and bald cypress in the shallows of ponds and lakes, as on
 // the Bayou. No hanging moss, the owner's call (7 November 2026). Southern Pines' mown
 // greens, for the same reasons. Density and colours PLACED.
 lowgulf: {landform: {...TRAITS.south.landform, cover: .68, kinds: {a: 'native'}}, groundTints: {native: '#c4b468', pinestraw: '#73683e'}, water: '#4e6a5e', inWater: ['lowcypress'],
  crownShare: .9, treeDensity: 2.2, rough: '#6d8a46', semi: '#5a8c48', fairway: '#689a58', fringe: '#7aa462', roughTint: '#8aa45a', sky: '#c8d8de', temperature: 28,
  title: 'Tidewater', tag: 'Live oaks, salt marsh and tidal creeks.',
  fallen: {from: ['southloblolly', 'lowliveoak'], kind: 'pinestraw'},
  stands: {...TRAITS.south.stands, edge: 80, wobble: 28, patch: .1, near: 55, spacing: 13, share: .7, under: {spacing: 9, plants: [['sawpalmetto', .5], ['waxmyrtle', .3], ['yaupon', .2]]},
   plants: [['lowliveoak', .5], ['southloblolly', .3], ['lowsabal', .12], ['lowcypress', .08]]},
  plants: [['lowliveoak', .28], ['southloblolly', .16], ['lowsabal', .12], ['lowcypress', .08], ['spartina', .16], ['muhlygrass', .08], ['sawpalmetto', .06], ['waxmyrtle', .06]],
  ui: {panel: 'rgba(20,34,26,.88)', a1: '#d1fae5', a2: '#0f7a5e', hot: '#fde68a', soft: '#bcd8c8', onHot: '#06201c'}},
// Hawaiian Resort: Kapalua's green slopes above the Pacific, Cook pines standing in lines
 // and belts (the owner's photographs), ironwood windbreaks, monkeypods as specimens and
 // coconut palms by the sea. No lava: the old Hawaii's black flows read as the Big Island,
 // not a resort. Planted only from Meshy. Density and colours PLACED.
 hiresort: {crownShare: .9, treeDensity: 1.2, rough: '#6d8a46', semi: '#5a8c48', fairway: '#689a58', fringe: '#7aa462', roughTint: '#8aa45a',
  title: 'Plantation Point', tag: 'Cook pines in lines, green slopes and the Pacific.',
  stands: {...TRAITS.hawaii.stands, edge: 80, near: 55, patch: .25, spacing: 14, share: .5, under: {spacing: 12, plants: [['naupaka', .5], ['tiplant', .3], ['hibiscus', .2]]},
   plants: [['hicookpine', .42], ['hiironwood', .3], ['himonkeypod', .14], ['flcoconut', .14]]},
  plants: [['hicookpine', .24], ['flcoconut', .18], ['himonkeypod', .1], ['hiironwood', .12], ['naupaka', .12], ['tiplant', .08], ['hibiscus', .06], ['plumeria', .05], ['bougainvillea', .05]],
  ui: {panel: 'rgba(10,36,30,.88)', a1: '#a7f3d0', a2: '#047857', hot: '#fcd34d', soft: '#b2d8c8', onHot: '#062018'}},
 // Desert Mountain: Troon North and We-Ko-Pa, target golf -- green ribbons of turf winding
 // through and round rocky granite hills in the high Sonoran desert, saguaros, palo verde and
 // mesquite (the owner's Troon North photographs). Desert Target until the owner's note of
 // 7 November 2026: mountainous, rocky and craggy, between the desert and the Rockies, with
 // Desert Resort the flatter desert. Planted from Meshy; cholla, ocotillo, agave and the desert shrubs
 // are still hand-built. Density PLACED.
 dmountain: {treeDensity: 1.2, title: 'Granite Crags', tag: 'Holes winding through rocky granite hills and saguaros.',
  stands: {...TRAITS.desert.stands, share: .55, spacing: 11, under: {spacing: 8, plants: [['creosote', .4], ['brittlebush', .25], ['agave', .15], ['jojoba', .2]]},
   plants: [['dtmesquite', .3], ['dtpaloverde', .3], ['dtsaguaro', .25], ['cholla', .15]]},
  plants: [['dtsaguaro', .2], ['dtpaloverde', .15], ['dtmesquite', .12], ['cholla', .1], ['ocotillo', .08], ['agave', .08], ['creosote', .12], ['brittlebush', .08], ['jojoba', .07]],
  ui: {panel: 'rgba(40,24,14,.88)', a1: '#fed7aa', a2: '#c2410c', hot: '#fde68a', soft: '#e6c8a8', onHot: '#2a1606'}},
 // Desert Resort, the US golf courses' own: Shadow Creek, TPC Summerlin and PGA West -- a
 // watered parkland set down on the desert floor, tall dark Afghan and Aleppo pines along the
 // holes (the owner's Shadow Creek photographs), willows by the ponds, olives, date and very tall
 // thin fan palms (Palm Desert), velvet mesquite, past the edge the open desert. No cypress, the
 // owner's rule (5 November). Planted from Meshy. Density and colours PLACED.
 dresort: {rough: '#6a9448', semi: '#659546', fairway: '#629b50', sand: '#efe6d6', rock: '#a9a59c', sky: '#bcd4ea', water: '#3e7fa0',
  altitude: 700, temperature: 33, rockStyle: 'angular', treeDensity: 2, crownShare: .9, arid: false, sandLand: false, dust: false, speckleRock: false,
  title: 'Desert Oasis', tag: 'Tall pines, willows and palms on watered green.',
  longGrass: {...TRAITS.desert.longGrass, count: 300},
  stands: {...TRAITS.desert.stands, edge: 60, patch: .22, near: 40, spacing: 13, under: {spacing: 9, plants: [['creosote', .7], ['brittlebush', .3]]},
   plants: [['creosote', .5], ['brittlebush', .14], ['dtmesquite', .16], ['drafghan', .1], ['africansumac', .1]]},
  plants: [['drafghan', .22], ['draleppo', .16], ['drolive', .1], ['dtmesquite', .07], ['drfan', .08], ['drdate', .06], ['drwillow', .06], ['oleander', .06], ['africansumac', .05], ['pampasgrass', .03], ['creosote', .04], ['bougainvillea', .03], ['brittlebush', .04]],
  ui: {panel: 'rgba(12,34,30,.88)', a1: '#99f6e4', a2: '#0d9488', hot: '#fde68a', soft: '#b8dcd2', onHot: '#05201c'},
  world: {clubhouse: 'pavilion', path: 'asphalt', bridge: 'stone', fountain: true, life: {geese: 4},
   colours: {clubhouse: {stone: '#ece0cc', bark: '#7d5a3c', accent: '#b4553a', dirt: '#3a2c26'}, riprap: '#a89c88', wall: '#d8ccb8', ruin: '#cfc2ac', bridgeStone: '#c8bca8'}}},
 // Pacific Northwest: Sahalee and Pumpkin Ridge -- holes cut through tall dark Douglas fir, western
 // red cedar and hemlock lining every hole, bigleaf maple and red alder at the edges, ferns and
 // huckleberry under them (the owner's Sahalee photographs). Puget Sound's ground and air. Planted
 // only from Meshy, the understorey hand-built. Density and colours PLACED.
 pacnw: {crownShare: .9, treeDensity: 4.4, title: 'Cedar Hollow', tag: 'Holes cut through tall fir, cedar and hemlock.',
  stands: {edge: 46, wobble: 20, ramp: 18, patch: .2, scale: 260, near: 34, spacing: 9, share: .7,
   under: {spacing: 8, plants: [['fern', .55], ['huckleberry', .45]]},
   plants: [['nwfir', .34], ['nwcedar', .24], ['nwhemlock', .22], ['nwmaple', .1], ['nwalder', .1]]},
  // Needles under its own conifers (the trait's pine/spruce/cedar are not its trees; 8 November 2026).
  fallen: {from: ['nwfir', 'nwcedar', 'nwhemlock'], kind: 'pinestraw'},
  plants: [['nwfir', .3], ['nwcedar', .22], ['nwhemlock', .18], ['nwmaple', .1], ['nwalder', .1], ['fern', .06], ['huckleberry', .04]],
  ui: {panel: 'rgba(14,32,28,.88)', a1: '#a9d6bc', a2: '#2e6a50', hot: '#f2d38a', soft: '#b6cfc0', onHot: '#0b1f18'}},
 // California Coast: Pebble Beach, Riviera and Torrey Pines -- holes along the Pacific on the
 // marine terraces, Monterey cypress and Monterey pine on the headlands as single specimens and
 // small groups, Torrey pines and eucalyptus, coast live oaks inland, ice plant and coastal sage
 // (the owner's photographs). Monterey's ground, sea and stacks. Planted from Meshy, the low
 // plants hand-built. Density and colours PLACED.
 calcoast: {sea: true, edgeCoast: true, coastSeek: true, shoreSand: false, hills: {base: 16, severity: 45, reach: 50}, treeDensity: 1.6,
  // Sandstone cliffs at the sea, the coast line just outside the eastern holes (course.js `cliffCoast`).
  cliffCoast: {offset: 46, width: 11, cove: 24, flute: 3.5, ribs: 0},
  groundTints: {rock: '#c09a6a'},
  rough: '#7a8a4e', sky: '#c8d6de', temperature: 18, rockStyle: 'angular', seaStacks: 6, crownShare: .9,
  title: 'Cypress Bluff', tag: 'Cypress on the headlands above the Pacific.',
  longGrass: {...TRAITS.california.longGrass, leaf: '#8a9056', accent: '#b8a870'},
  stands: {...TRAITS.california.stands, under: {spacing: 8, plants: [['coastalsage', .5], ['shrub', .5]]},
   plants: [['ccmpine', .4], ['cccypress', .3], ['ccliveoak', .15], ['cceuc', .15]]},
  fallen: {from: ['ccmpine', 'cctorrey', 'cccypress'], kind: 'pinestraw'},
  plants: [['cccypress', .18], ['ccmpine', .14], ['cctorrey', .06], ['ccliveoak', .08], ['cceuc', .06], ['iceplant', .16], ['coastalsage', .14], ['chaparral', .06], ['californiapoppy', .04], ['shrub', .08]],
  ui: {panel: 'rgba(12,28,36,.88)', a1: '#9fe6f5', a2: '#13708a', hot: '#fde9b4', soft: '#b6d2d8', onHot: '#05202a'}},
 // Seaside Links: St Andrews, Bandon Dunes, Chambers Bay and Whistling Straits -- the links
 // ground, fescue and marram, gorse and heather, upright shore pines in small clumps and the odd lone Douglas fir (Bandon), very light; trees at 0 in Course studio
 // gives Scotland, as the owner ruled ("Scottish Links ... would look a lot like Bandon dunes
 // without trees"). The links region's ground, grasses and coast. Density and colours PLACED.
 seaside: {treeDensity: .6, title: 'Gorse Bluff', tag: 'Fescue, gorse and dunes above the sea.',
  // The rough thick with fescue and marram (the owner: "rough coastlines that are thick with fescue
  // and tall grasses"): more than twice the links' tall grass. PLACED.
  longGrass: {...TRAITS.links.longGrass, count: 16000},
  stands: {edge: 70, wobble: 30, ramp: 25, patch: .12, scale: 200, near: 40, spacing: 8, share: .15,
   plants: [['gorse', .6], ['slshore', .3], ['shrub', .1]]},
  plants: [['gorse', .42], ['heather', .36], ['slshore', .12], ['nwfir', .02], ['shrub', .08]],
  ui: {panel: 'rgba(30,32,22,.88)', a1: '#e8dc9a', a2: '#7a6a2a', hot: '#f6e3a0', soft: '#d4ccaa', onHot: '#201c08'}},
 // Mountain: Castle Pines, Banff and Edgewood Tahoe -- holes through ponderosa and lodgepole pine,
 // Engelmann spruce and stands of quaking aspen, a Douglas fir or two (the Pacific Northwest's), under
 // the high peaks (the owner's photographs; docs/studies/us-golf-courses). The Rockies' region and air.
 // Planted only from Meshy, the understorey and meadow flowers hand-built. Density PLACED.
 mountains: {crownShare: .9, treeDensity: 3.4, title: 'Timberline', tag: 'Pines, spruce and aspen under the high peaks.',
  fallen: {from: ['mtponderosa', 'mtlodge', 'mtspruce', 'nwfir'], kind: 'pinestraw'},
  stands: {edge: 45, wobble: 18, ramp: 18, patch: .2, scale: 240, near: 35, spacing: 9, share: .6,
   under: {spacing: 8, plants: [['huckleberry', .6], ['fern', .4]]},
   plants: [['mtlodge', .3], ['mtspruce', .28], ['mtponderosa', .2], ['mtaspen', .16], ['nwfir', .06]]},
  plants: [['mtponderosa', .2], ['mtlodge', .18], ['mtspruce', .18], ['mtaspen', .16], ['nwfir', .05], ['sagebrush', .08], ['willowthicket', .05], ['lupine', .05], ['columbine', .05]],
  ui: {panel: 'rgba(16,28,30,.88)', a1: '#b6dccb', a2: '#3c7a62', hot: '#f6d58c', soft: '#c2d4cc', onHot: '#0b1c16'}},
 // Prairie and Sand Hills: Sand Hills, Prairie Dunes and Ballyneal -- grassed-over dunes with sand
 // blowing out of them, nearly treeless: a few clumps of eastern red cedar and hackberry, and plains
 // cottonwoods in the low ground (the owner's photographs). The Sand Hills' region and air. Planted
 // only from Meshy, the grasses and forbs hand-built. Density PLACED.
 // Its wild ground and tall grass green up in spring (`springNative`, seasons.js; the owner, 8 November 2026).
 prairie: {crownShare: .9, treeDensity: .3, blowouts: .25, springNative: .55, title: 'Blowout Ridge', tag: 'Grassed dunes under a big sky, a few cedars.',
  fallen: {from: ['prcedar'], kind: 'pinestraw'},
  farForest: {cover: .04, size: 8, scrub: true, paint: .3, colors: ['#5d6a38', '#6e7a3e', '#7f8a44']},
  stands: {edge: 60, wobble: 25, ramp: 25, patch: .01, scale: 260, near: 45, spacing: 12, share: 0,
   under: {spacing: 9, plants: [['shrub', .7], ['prairieforbs', .3]]},
   // The Sand Hills' low stands (shrub, sand cherry, cedar), a few hackberries; no cottonwood: a
   // stand of 900 big cottonwoods and 1,900 hackberries stood as a forest on the first capture.
   plants: [['shrub', .45], ['sandcherry', .25], ['prcedar', .25], ['prhack', .05]]},
  plants: [['dunegrass', .35], ['prairieforbs', .25], ['soapweedyucca', .1], ['shrub', .08], ['prcedar', .07], ['sandcherry', .05], ['buffalograss', .05], ['prhack', .03], ['prcotton', .02]],
  ui: {panel: 'rgba(34,30,18,.88)', a1: '#ead9a0', a2: '#8a7a2e', hot: '#f8e7b4', soft: '#dcd2b0', onHot: '#221c08'}},
  // Florida Palms: the Keys' coast, white sand and blue water, planted only from Meshy: tall
 // thin coconut palms in loose groups (the owner's Seminole photograph), sabal and royal
 // palms, live oaks and a few loblollies (TPC Sawgrass), sea grape and saw palmetto under
 // them. Southern Pines' mown greens, for the same reasons. Density and colours PLACED.
 // Mainland, not an island: the Atlantic along one side with its beach (Seminole), flat
 // ground and lakes inland (TPC Sawgrass). The first capture took the Keys' ring island,
 // which read as the Keys.
 flpalms: {sea: true, coastal: false, edgeCoast: true, inlandWater: true, shoreSand: true, ringIslands: 0, crownShare: .9, treeDensity: .7, rough: '#6d8a46', semi: '#5a8c48', fairway: '#689a58', fringe: '#7aa462', roughTint: '#8aa45a',
  title: 'Palm Coast', tag: 'Tall palms, live oaks, white sand and blue water.',
  stands: {...TRAITS.florida.stands, edge: 90, near: 60, patch: .3, spacing: 16, share: .3, under: {spacing: 14, plants: [['sawpalmetto', .5], ['seagrape', .3], ['hibiscus', .2]]},
   plants: [['lowsabal', .32], ['lowliveoak', .26], ['flcoconut', .2], ['flroyal', .1], ['southloblolly', .12]]},
  plants: [['flcoconut', .2], ['lowsabal', .16], ['flroyal', .08], ['lowliveoak', .12], ['southloblolly', .06], ['seagrape', .1], ['sawpalmetto', .1], ['hibiscus', .05], ['bougainvillea', .04], ['sawgrass', .05], ['muhlygrass', .04]],
  ui: {panel: 'rgba(8,32,44,.88)', a1: '#a5f3fc', a2: '#0e7490', hot: '#fda4af', soft: '#acd6e2', onHot: '#04202e'}},
 // (The Rockies, Cascades, High Sierra, Ponderosa, Sagebrush, Blue Ridge and Alaska left for Mountain,
 // and the Sand Hills, High Plains, Bluebonnet Prairie and Hill Country for Prairie & Sand Hills, on
 // 8 November 2026.)
 // Northern Woods: Forest Dunes and Crystal Downs -- red pine and eastern white pine (Southern Pines'),
 // paper birch, sugar maple and white oak (Classic Parkland's) and a few aspen (the Mountain's), round
 // blue lakes (the owner's plan, 8 November 2026). Planted only from Meshy, the understorey hand-built;
 // jack pine, tamarack and balsam fir left with the hand-built trees. Density PLACED.
 northwoods: {crownShare: .9, fallen: {from: ['norpine', 'southwhitepine'], kind: 'pinestraw'},
  stands: {edge: 50, wobble: 22, ramp: 20, patch: .2, scale: 240, near: 35, spacing: 9, share: .6,
   under: {spacing: 8, plants: [['shrub', .5], ['bracken', .5]]},
   plants: [['norpine', .35], ['southwhitepine', .2], ['nobirch', .2], ['parkmaple', .15], ['whiteoak', .1]]},
  plants: [['norpine', .26], ['southwhitepine', .12], ['nobirch', .17], ['parkmaple', .12], ['whiteoak', .07], ['mtaspen', .07], ['shrub', .1], ['fern', .05], ['fireweed', .04]]},
};

// A landscape's world block: the generic one, its region's, its own.
export const worldOf = key => {
 const k = currentKey(key), region = LANDSCAPES[k]?.region;
 return {...WORLD_GENERIC, ...(WORLD[region] || {}), ...(LAND[k]?.world || {})};
};

// Merged once. `scatter` and `hills` are replaced wholesale rather than merged
// field by field, because a biome that sets one of them means all of it.
// TALL FESCUE AND THE PRAIRIE GRASSES (the owner, 3 November 2026: "do we have
// tall fescue and prairie grasses? if not, we should retroactively build them
// for all landscapes that need them"; tools/blender/cartoon_prairiegrass.py).
// A landscape listed here grows these long-grass families in place of its
// region's: [family, share, height in metres]. Who grows what follows each
// grass's range (RESEARCH.md *Tall fescue and the prairie grasses*): tall
// fescue the transition zone's rough, little bluestem, Indiangrass and
// switchgrass the tall- and mixed-grass prairie, blue grama the shortgrass
// and the south-west's uplands. Shares and heights PLACED within the specs.
// Drawing only (vegetation.js addLongGrass): no ground moves. A family of the
// prairie pack wears its own colours (season-tints.js); `GRASS_TINT` is for
// the older families beside it where the region's are New England's autumn:
// orange long grass in a Kentucky July (seen 3 November 2026). PLACED, the
// Old Northeast's.
const GRASS_TINT = Object.fromEntries(['bluegrass', 'ozarks', 'blueridge'].map(k => [k, {leaf: '#7a8a46', accent: '#a07a3e'}]));
const GRASSES = {
 blueridge: [['grasstallfescue', 2, .9], ['grassfescue', 2, .8]],
 parkland: [['grasstallfescue', 2, .9], ['grassfescue', 2, .8], ['grassbluestem', 1, 1.1]],
 sandhills: [['grasslittlebluestem', 3, 1.0], ['grassswitch', 1, 1.4], ['grassbluestem', 1, 1.1], ['grassfescue', 1, .7]],
 hillcountry: [['grasslittlebluestem', 3, 1.0], ['grassindian', 2, 1.6], ['grassbunch', 1, .8]],
 bluebonnet: [['grasslittlebluestem', 2, 1.0], ['grassindian', 2, 1.7], ['grassswitch', 1, 1.5], ['grassbluestem', 1, 1.2]],
 lakedunes: [['grassmarram', 2, 1], ['grasslittlebluestem', 1, .9], ['grassfescue', 1, .7]],
 highplains: [['grassgrama', 3, .35], ['grasswheat', 2, .7], ['grasslittlebluestem', 1, .9]],
 southpines: [['grassbluestem', 1, 1.2], ['grassfescue', 2, .8]],
 ponderosa: [['grassgrama', 2, .35], ['grassalpine', 2, .4], ['grassfescue', 1, .6]],
 chihuahuan: [['grassgrama', 2, .35], ['grassbunch', 1, .8]],
 redrock: [['grassbunch', 2, .7], ['grassgrama', 1, .35]],
};
// TERRAIN TRUE TO PLACE (the owner, 3 November 2026: "make sure that the
// terrain is also lifelike to the regions where the courses are built").
// A landscape listed here gets its own ground in place of its region's
// recipe (landforms.js; RESEARCH *Terrain true to place* for each one's
// sources): `landform` replaces the recipe, `hills` and `groundTints` are
// laid over the record's. Every number PLACED from the sources and the
// study's pictures. A change here moves generated ground: GENERATOR_VERSION.
const gate = (near, ramp) => ({near, ramp});
const TERRAIN = {
 // (The Sonoran, Mojave, Chihuahuan and Red Rock left for Desert Mountain on 8 November 2026.)
 // The Redwood Coast: a river's terraces, low and soft, where the courses lie
 // and the redwoods grow tallest. The young, steep ridges of the Coast Ranges
 // stand behind them as the ring; the gorges and rock this had before put a
 // canyon under every hole.
 redwood: {landform: {type: 'steps', scale: 420, height: 7, steps: 2, riser: .16, from: .3, to: .85, ledge: 0, reach: 70,
  kinds: {a: 'rock'}, gates: {a: gate(12, 12)}}, hills: {base: 22, severity: 26, reach: 75}},
 // Hummocky moraine, kettles holding bog, an esker, granite breaking through.
 northwoods: {landform: {type: 'glacial', hummock: 7, cell: 160, chance: .5, radius: [25, 55], size: [4, 9], esker: 220, eskerHeight: 6, reach: 70,
  kinds: {a: 'rock', b: 'native'}, gates: {a: gate(10, 10), b: gate(10, 12)}}, groundTints: {native: '#8a8a50'}},
 parkland: {landform: {type: 'glacial', hummock: 4, cell: 200, chance: .3, radius: [25, 50], size: [3, 6], esker: 260, eskerHeight: 3, reach: 70,
  kinds: {a: 'rock', b: 'native'}, gates: {a: gate(12, 10), b: gate(12, 12)}}},
 southpines: {landform: {type: 'sandridges', scale: 240, height: 9, bare: .84, reach: 60, kinds: {a: 'waste'}, gates: {a: gate(12, 12)}}},
 // Desert Mountain: long, wide, joined granite ranges (`range`) with boulder-piled upper slopes,
 // the holes in the draws between them, rising close beside the play (reach 26 m); one big
 // mountain shaped on Superstition Mountain past the course (`ringMassif`); a rocky outcrop
 // under the back tee on about 1.5 holes in 18 (`rockTees`). The owner, 7 November 2026, over five
 // rounds: "in between" the desert and the mountain courses; "football shaped", "more rocky" (the
 // fins of ridged noise turned down); one big mountain and flat desert; then the football knobs
 // ("a bit jarring. The bigger mountains look much more natural") and ridges laid along each hole
 // ("placed after the holes") turned down for ranges with "the holes ... playing into the natural
 // draws between mountains". The knob scatter is kept at chance 0. Since 8 November 2026 the
 // ranges stand only on the big mountain's side (`side`, a mountain front the holes curve along;
 // the owner picked it over a bigger play area and both together). Every number PLACED.
 dmountain: {landform: {type: 'knobs', cell: 200, chance: 0, radius: [30, 60], stretch: 2.4, tip: 1.4, size: [24, 54], profile: 2, round: .55, floor: 2,
  range: {scale: 380, stretch: 2.4, from: .55, to: .66, height: 70, shape: 1.1, crest: 220, side: 150},
  boulders: 24, rock: .6, wash: 260, washWidth: .022, washDepth: 1.4, bare: .08, reach: 22,
  // Rock and hardpan start 2 m off the turf (round 4: the ridges stand right at the rough).
  kinds: {a: 'rock', b: 'waste', floor: 'hardpan'}, gates: {a: gate(2, 5), b: gate(8, 8), floor: gate(2, 4)}},
  // The rock the colour of the rock props standing on it (`rock`, #b57c4e; the owner, round 4:
  // "ours are far too grey. Work on color matching the landscapes to the rock props"). Was #8e7d6a.
  groundTints: {rock: '#b07a50'},
  hills: {base: 8, severity: 22, reach: 80}, ringLift: 900, ringMesas: false,
  // The land rising toward the big mountain, and no bench round the holes (course.js `tilt`,
  // `wideFade`; the owner, round 6). PLACED.
  tilt: {height: 38, over: 1400}, wideFade: 130, pondShare: .37,
  ringMassif: {at: 2200, length: 9000, face: 1400, back: 3500},
  // About 1.5 holes in 18 tee off a rock outcrop (course.js, *Tees up on the rock*).
  rockTees: .083},
 // Desert Resort: nearly flat, built ground -- a rare low knob, no washes, and the desert's pale
 // cobble starting short and hard where the watering stops. Grey limestone ranges behind (Earth
 // Magazine; RESEARCH). The first Desert Resort's recipe, a little broader (PLACED); it left at
 // the sign-off, 7 November 2026.
 dresort: {landform: {type: 'knobs', cell: 280, chance: .1, radius: [20, 40], size: [4, 10], profile: 1.3, round: .6, floor: 1, wash: 0, bare: .2, reach: 80,
  kinds: {a: 'rock', b: 'waste', floor: 'hardpan'}, gates: {a: gate(16, 8), b: gate(18, 6), floor: gate(14, 3)}}, groundTints: {hardpan: '#c6b69a', waste: '#b5a68c', rock: '#a09a8e'},
  hills: {base: 8, severity: 20, reach: 80}, ringLift: 620, ringPeaks: true, ringMesas: false},
 // Florida Palms: low and flat behind the beach, wet hollows for its lakes. The Florida
 // Flatwoods' lowland recipe, a little broader (PLACED); the Flatwoods left at the sign-off.
 // Pacific Northwest: Puget Sound's glacial ground, its hummocks a metre taller (PLACED, so the two
 // differ while both stand: no two landscapes may share their ground).
 pacnw: {landform: {type: 'glacial', hummock: 14, hummockX: 170, hummockZ: 800, cell: 260, chance: .3, radius: [30, 70], size: [4, 9], esker: 300, eskerHeight: 0, reach: 70,
  kinds: {a: 'rock', b: 'native'}, gates: {a: gate(12, 12), b: gate(8, 10)}}, hills: {base: 26, severity: 40, reach: 70}},
 // California Coast: Monterey's marine terraces, a metre taller (PLACED, so the two differ while
 // both stand).
 // Seaside Links: the links region's dunes, a little broader (PLACED, so it differs from Scottish
 // Links while both stand).
 // Round 2 (the owner: "too smooth"; Bandon's and Chambers Bay's rough between holes, the owner's
 // photographs): taller dunes, smaller hummocks, a sharp rumple over all of it, more marram.
 seaside: {landform: {...TRAITS.links.landform, scale: 160, hummock: 22, height: 8, rugged: 1.6, marram: .38}},
 calcoast: {landform: {type: 'steps', scale: 380, height: 13, steps: 3, riser: .18, from: .3, to: .85, ledge: .3, reach: 60,
  kinds: {a: 'rock'}, gates: {a: gate(10, 10)}}},
 // Mountain: the Rockies' crags, a little lower and gentler round the holes (PLACED, and apart from the
 // Rockies' own while both stand).
 mountains: {landform: {type: 'crags', scale: 320, height: 62, steps: 4, from: .45, cluster: .42, scree: true, reach: 120, jag: .55,
  kinds: {a: 'rock', b: 'scree'}, gates: {a: gate(14, 18), b: gate(10, 14)}}, hills: {base: 60, severity: 150, reach: 90}},
 // Prairie and Sand Hills: the Sand Hills' dunes, a touch broader and lower (PLACED, and apart from
 // the Sand Hills' own while both stand).
 prairie: {landform: {type: 'dunes', scale: 260, hummock: 50, height: 13, marram: .5, heather: 0,
  kinds: {a: 'native'}, gates: {a: gate(9, 14)}}, hills: {base: 24, severity: 18, reach: 70}},
 flpalms: {landform: {type: 'lowland', scale: 380, levee: 1, hollow: 1.2, swamp: .5, reach: 50, kinds: {a: 'native'}, gates: {a: gate(12, 12)}},
  hills: {base: 5, severity: 6, reach: 60}, baseRoll: .25},
 // Napa's valley floor between the Mayacamas and the Vaca ranges: alluvial
 // and gentle, the ranges standing 600-800 m over it at the horizon (the
 // Napa Valley Vintners' guide: 30 mi by up to 5 mi, Atlas Peak 2,663 ft).
 // In place of rolling hills everywhere (generator 81). PLACED.
 // Salt marsh at the tide line, tidal creeks winding through it to the sea,
 // hammocks of live oak standing a few metres above (generator 80). The sea
 // is the creeks' water: `sea` draws it, and the ground sits 4 m above it
 // (`baseHeight`) rather than 12, so the marsh lies a step below the holes,
 // not a bluff. The marsh platform stands 1.9 m up -- above the beach band
 // (course.js BEACH_RISE and its fade), or every marsh would read as sand --
 // where the real one floods at every high tide. PLACED.
 lowgulf: {landform: {type: 'lowland', scale: 300, levee: 1, hollow: 1, swamp: .46, reach: 50, kinds: {a: 'native'}, gates: {a: gate(12, 12)},
  tide: {marsh: 1.9, bed: -2, scale: 260, width: .028}},
  // The bed 2 m down, about the coast's tidal range. The sea shader paints
  // shallow sea as a pale sandy shelf (renderer.js WATER_EDGES), and in the
  // first pictures the creeks read as sand: `seaShelf` turns it toward dark
  // marsh water instead (its colour and how far). A lake's swash, not surf.
  // PLACED.
  // Its banks and creek beds are pluff mud, not beach sand (`beachTint`, the
  // ground shader's beach band). PLACED.
  hills: {base: 3, severity: 4, reach: 60}, baseRoll: .2, baseHeight: 4, sea: true, lakeWaves: true, seaShelf: [.2, .26, .2, .55], beachTint: '#4f4838'},
};
export const BIOMES = Object.fromEntries(Object.entries(LAND).map(([key, own]) => {
 const place = LANDSCAPES[key], region = place.region;
 const {ui, world, ...rest} = own;
 const merged = {...DEFAULTS, ...PALETTES[region], ...(TRAITS[region] || {}), ...rest};
 if (GRASSES[key]) rest.longGrass = {...merged.longGrass, families: GRASSES[key], ...GRASS_TINT[key]};
 if (TERRAIN[key]) {
  const {groundTints, ...t} = TERRAIN[key];
  Object.assign(rest, t);
  if (groundTints) rest.groundTints = {...(merged.groundTints || {}), ...groundTints};
 }
 return [key, {...DEFAULTS, ...PALETTES[region], ...(TRAITS[region] || {}), ...rest,
  name: place.name, region, regionName: REGIONS[region], where: place.where, tropical: place.tropical,
  ui: {...INTERFACE[region], ...(ui || {})}, key, world: worldOf(key)}];
}));

// The stream bank colour, still reachable by its old name so streams.js and the
// ground shader do not have to care where it moved to.
export const BANK_COLORS = Object.fromEntries(
 Object.entries(BIOMES).map(([key, b]) => [key, b.bank]));

// A biome by key, never undefined: an unknown name falls back rather than
// producing an object with no palette at all, which is a black course.
// An old key (pnw, desert, ...) finds the landscape it became.
export const biomeOf = key => BIOMES[currentKey(key)] || BIOMES.puget;
