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
  longGrass: {families: [['grasssedge', 1, .5]], count: 2000, near: 25, leaf: '#3e5a32', accent: '#6c7d45'},
  farForest: {cover: .95, size: 12, colors: ['#26432a', '#2f4f2e', '#3a5a33']},
  bank: '#40412f', hills: {base: 45, severity: 0, reach: 70}, ringLift: 420,
  // Forty-six metres to 380 FEET. A coast redwood is the tallest living thing
  // there is, and at the usual 13-to-29 it is just a pine with a dark tint --
  // the height is most of what makes the grove. The floor stays low so a grove
  // is a spread of ages rather than a field of identical giants.
  canopy: {min: 46, range: 69.8}, farCanopy: {min: 42, range: 73.8},
  crownShare: .55,
  // 3.8, down from the 5.5 this started at. Measured at 5.5: 12.3 tall
  // conifers per hectare, and the median tree's crown overlapped its
  // neighbour's by 42%. A cathedral grove is open at the floor and closed
  // overhead, which means fewer and bigger rather than more.
  treeDensity: 3.8,
  waterTint: '#2c5450', waterMurk: .3,
  // Fewer blades, more of everything low and wet.
  scatter: {rocks: 300, grass: 90000, tufts: 2000, tallGrass: false,
   rockScale: 1.3, bladeLength: .8, bladeWidth: .9, bladeTint: '#46603a',
   flowers: ['#d8d2a6', '#9fb07c']},
  deadfall: 520,
  rockStyle: 'angular', rockMoss: '#4c6a3a',
  // Mossy outcrops in the grove; duff under the giants plays as pine straw.
  landform: {type: 'crags', scale: 180, height: 16, steps: 2, from: .6, to: .95, cluster: .62, reach: 80,
   kinds: {a: 'rock'}, gates: {a: {near: 14, ramp: 16}}},
  fallen: {from: ['redwood', 'fir', 'hemlock', 'redcedar'], kind: 'pinestraw'},
  // EVERY PLANT HERE IS GROWN, not imported -- see tools/grow.mjs. That let
  // the mix become a real forest rather than three species: giants, the firs
  // and hemlocks between them, a cedar and tanoak mid-storey, seedlings, and
  // a floor of sword fern, salal and sorrel. The third number is a height
  // scale, which is how the understorey stays under the canopy.
  plants: [['redwood', .25], ['fir', .13], ['hemlock', .07],
   ['redcedar', .07, .45], ['tanoak', .05, .18], ['seedling', .05, .045],
   ['swordfern', .15], ['salal', .08], ['sorrel', .06],
   // Redwood Coast's own (the US landscapes goal's Pacific pack): bay
   // laurel in the mid-storey (8-25 m of the grove's 42-116), Pacific
   // rhododendron and Douglas iris on the floor. Weights PLACED, taken from
   // the floor's fern, salal and sorrel (generator 61: the list summed to
   // 1.04 and the open pick, cumulative, never reached the iris).
   ['baylaurel', .04, .2], ['pacificrhododendron', .03], ['douglasiris', .02]]},
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
 redwood:{name:'Giant Redwood',title:'Cathedral Grove',tag:'Ancient trunks. Deep shade and wet air.',rough:'#39492c',semi:'#35602f',fairway:'#3d6f33',fringe:'#497a38',green:'#6d9445',tree:'#1b3324',sky:'#96a5a4',sand:'#cdc3a7',water:'#1c3f3c',rock:'#5f6a63',altitude:60,temperature:13,treeKind:'pine',sun:18},
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
  story: {walls: null, ruins: ['cottage']}, life: {grazers: ['roadrunner', 2]},
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
 stands: {...TRAITS.mountain.stands, plants: [['spruce', .55], ['paperbirch', .3, .6], ['aspen', .15]]},
 plants: [['spruce', .35], ['paperbirch', .2, .6], ['aspen', .15], ['willowthicket', .15], ['lupine', .1], ['columbine', .05]]};
PALETTES.alaska = {...PALETTES.mountain, name: 'Alaska', title: 'Midnight Sun', tag: 'Spruce, birch and the long low light.',
 rough: '#6a7650', tree: '#2a4a38', sky: '#b4d0e6', altitude: 100, temperature: 13, sun: 16};
INTERFACE.alaska = {panel: 'rgba(12,24,36,.88)', a1: '#a5f3fc', a2: '#0e7490', hot: '#fbcfe8', soft: '#b8d8e2', onHot: '#071820'};
WORLD.alaska = {...WORLD.mountain, clubhouse: 'loglodge', path: 'gravel', bridge: 'wood',
 story: {walls: null, ruins: ['minehead', 'cottage']}, life: {grazers: ['elk', 3], heron: true}};

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
 story: {walls: null, farm: true, ruins: ['chapel']}, life: {grazers: ['deer', 3], heron: true, geese: 4},
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
// The Florida region is the Keys' (islands, sea); the Flatwoods are inland:
// these of its fields come from the Heartland's record instead (defaults
// included: a field the Heartland leaves to DEFAULTS was copied undefined
// and crashed the generator, phase 5).
const INLAND = Object.fromEntries(['bank', 'coastal', 'sea', 'inlandWater', 'ringLift', 'ringFace', 'ringIslands', 'hop', 'shoreSand', 'mapWater',
 'litter', 'fallen', 'landform', 'farForest', 'longGrass', 'light', 'rockMoss'].map(k => [k, ({...DEFAULTS, ...PALETTES.midwest, ...TRAITS.midwest})[k]]));

const LAND = {
 puget: {}, sonoran: {}, rockies: {}, links: {}, heartland: {}, keys: {}, redwood: {},
 newengland: {}, lakedunes: {},
 // Phase 3, on existing models (see above).
 // High Plains: wheat country -- a grain elevator for the landmark (phase 8).
 highplains: {world: {story: {walls: 'wire', farm: true, shelterbelt: true, landmark: 'grainelevator'}}},
 // The Sand Hills: the plains grassed over dunes, sand blowing out of them,
 // almost no trees.
 // (Round 2 of its pictures: at half density with the plains' stands it
 // stood in a wood; now a few cedars and cottonwoods in the valleys.)
 sandhills: {treeDensity: .2, blowouts: .25, farForest: {cover: .04, size: 8, scrub: true, paint: .3, colors: ['#5d6a38', '#6e7a3e', '#7f8a44']},
  // Channel b is the blowouts' (landforms.js), so the dunes paint only a.
  landform: {type: 'dunes', scale: 170, hummock: 42, height: 6, marram: .5, heather: 0,
   kinds: {a: 'native'}, gates: {a: {near: 9, ramp: 14}}},
  // Brush, not trees, along the corridors, as the Links' gorse (round 3).
  stands: {...TRAITS.plains.stands, patch: .01, share: 0, plants: [['shrub', .4], ['easternredcedar', .3], ['sandcherry', .3]]},
  // Phase 8: soapweed yucca, the Sand Hills' own plant, and buffalo grass.
  plants: [['dunegrass', .35], ['shrub', .1], ['easternredcedar', .08], ['prairieforbs', .25], ['cottonwood', .02], ['sandcherry', .05], ['soapweedyucca', .1], ['buffalograss', .05]],
  ui: {panel: 'rgba(40,32,14,.88)', a1: '#fcd9a8', a2: '#b45309', hot: '#fff7ed', soft: '#ead5b4', onHot: '#2a1c08'},
  world: {story: {walls: 'wire', landmark: 'windmill'}}},
 // The Old Northeast: New England's region in high summer -- stately oaks,
 // maples, elms and beeches, stone clubhouses (the Golden Age courses).
 // No autumn leaf ground either (phase 8b; it read as orange paint).
 oldnortheast: {leafFall: false, leafLitter: false, fallen: null, rough: '#73803f', semi: '#5a8a42', tree: '#3f6a30', sky: '#b9d3e8',
  farForest: {cover: .85, size: 11, colors: ['#3f6a30', '#4a7436', '#56803a']},
  longGrass: {families: [['grassfescue', 2, .8], ['grassbluestem', 1, 1.1]], count: 3500, near: 22, leaf: '#7a8a46', accent: '#a07a3e'},
  // Phase 8b: the old estates' copper beech, hydrangeas by the clubhouse.
  stands: {...TRAITS.northeast.stands, plants: [['oak', .35], ['maple', .25], ['americanbeech', .12, .9], ['copperbeech', .08], ['americanelm', .1], ['whitepine', .1, 1.2]]},
  plants: [['oak', .26], ['maple', .22], ['americanelm', .13], ['americanbeech', .13, .9], ['copperbeech', .06], ['whitepine', .1, 1.2], ['hydrangea', .05], ['shrub', .05]],
  ui: {panel: 'rgba(14,32,20,.88)', a1: '#bbf7d0', a2: '#166534', hot: '#fde68a', soft: '#b6d4bc', onHot: '#0a1f10'},
  // A Tudor clubhouse (phase 8b), cream and dark timber.
  world: {clubhouse: 'tudor', bridge: 'stone', story: {walls: 'field', ruins: ['cottage'], landmark: 'church'},
   colours: {...WORLD.northeast.colours, clubhouse: {stone: '#f2ece0', bark: '#6a3a2a', accent: '#4a3a2a', dirt: '#2a3038'}}}},
 // The Pine Barrens: pitch pine and scrub oak on sand, heath and fescue,
 // salt wind (Shinnecock, Pine Valley).
 pinebarrens: {leafFall: false, rough: '#9a9460', semi: '#6e8a4a', tree: '#3c5a34', sand: '#ece0bc', treeDensity: 2,
  landform: {type: 'dunes', scale: 160, hummock: 30, height: 4, marram: .35, heather: .55,
   kinds: {a: 'native', b: 'heather'}, gates: {a: {near: 9, ramp: 14}, b: {near: 8, ramp: 12}}},
  longGrass: {families: [['grassfescue', 4, .8], ['grassmarram', 1, 1.0]], count: 6000, near: 14, leaf: '#93945a', accent: '#c9b06a'},
  farForest: {cover: .7, size: 9, colors: ['#3c5a34', '#4a6638', '#5e6f3c']},
  // Phase 8b: pitch pine for the stand-in pine, scrub oak, bayberry and the
  // beach rose under it.
  stands: {...TRAITS.northeast.stands, plants: [['pitchpine', .6], ['blackoak', .4]], under: {spacing: 8, plants: [['scruboak', .5], ['heather', .3], ['bayberry', .2]]}},
  plants: [['pitchpine', .35], ['blackoak', .12], ['scruboak', .15], ['heather', .12], ['bayberry', .08], ['beachrose', .06], ['commonjuniper', .07], ['dunegrass', .05]],
  ui: {panel: 'rgba(30,30,16,.88)', a1: '#d9f99d', a2: '#4d7c0f', hot: '#fef3c7', soft: '#cfd4ae', onHot: '#181a08'},
  // A Long Island shingled windmill for the landmark (phase 8b).
  world: {clubhouse: 'shingle', bridge: 'wood', path: 'gravel', story: {walls: null, ruins: ['cottage'], landmark: 'shingledwindmill'}}},
 alaska: {},
 // Phase 5: the South (the US landscapes goal's South packs).
 piedmont: {},
 // Longleaf Pines: tall bare longleafs over wiregrass, turkey oaks, pine
 // straw and sandy waste (Pinehurst).
 longleaf: {treeDensity: 2.4, rough: '#8a8a52',
  stands: {...TRAITS.south.stands, share: .5, under: {spacing: 9, plants: [['wiregrass', .5], ['longleafgrass', .3], ['yaupon', .2]]},
   plants: [['longleafpine', .6, 1.1], ['loblollypine', .15], ['turkeyoak', .15], ['blackjackoak', .1]]},
  plants: [['longleafpine', .3, 1.1], ['loblollypine', .05], ['wiregrass', .25], ['longleafgrass', .15], ['turkeyoak', .12], ['yaupon', .08], ['blackjackoak', .05]],
  // Pine straw's amber.
  ui: {panel: 'rgba(36,28,14,.88)', a1: '#fde68a', a2: '#a16207', hot: '#fef9c3', soft: '#e0d2ae', onHot: '#221a06'}},
 // Lowcountry: live oaks in Spanish moss, salt marsh, palmettos, slash pine.
 lowcountry: {rough: '#7a8a46', sky: '#c8d8de', temperature: 28,
  stands: {...TRAITS.south.stands, under: {spacing: 8, plants: [['sawpalmetto', .5], ['waxmyrtle', .3], ['yaupon', .2]]},
   plants: [['liveoakmoss', .45], ['slashpine', .2], ['cabbagepalm', .2], ['magnolia', .1], ['waxmyrtle', .05]]},
  plants: [['liveoakmoss', .18], ['cabbagepalm', .15], ['slashpine', .1], ['magnolia', .04], ['spartina', .21], ['muhlygrass', .1], ['sawpalmetto', .12], ['waxmyrtle', .1]],
  ui: {panel: 'rgba(18,32,28,.88)', a1: '#ccfbf1', a2: '#0f766e', hot: '#fde68a', soft: '#b8d4cc', onHot: '#06201c'}},
 // Bayou: bald cypress and its knees, tupelo, live oaks in moss, slow water.
 bayou: {rough: '#6a7a3e', water: '#5a5a3e', sky: '#c8d0c4', temperature: 28,
  stands: {...TRAITS.south.stands, under: {spacing: 8, plants: [['cypressknees', .4], ['shrub', .3], ['waxmyrtle', .3]]},
   plants: [['baldcypress', .45], ['watertupelo', .2], ['liveoakmoss', .25], ['sweetgum', .1]]},
  plants: [['baldcypress', .2], ['liveoakmoss', .15], ['watertupelo', .1], ['cypressknees', .15], ['spartina', .15], ['shrub', .1], ['waxmyrtle', .1], ['sweetgum', .05]],
  ui: {panel: 'rgba(28,30,16,.88)', a1: '#d9f99d', a2: '#4d7c0f', hot: '#fef3c7', soft: '#c8ccae', onHot: '#141808'}},
 // Florida Flatwoods: slash pine over saw palmetto, cabbage palms, cypress
 // domes, sawgrass, lakes -- inland (INLAND above), in the Keys' region.
 flatwoods: {...INLAND, tropical: false, rough: '#8a8a50', sand: '#f2ead4', treeDensity: 2.2,
  stands: {...TRAITS.south.stands, under: {spacing: 8, plants: [['sawpalmetto', .7], ['waxmyrtle', .3]]},
   plants: [['slashpine', .55, 1.1], ['cabbagepalm', .2], ['liveoakmoss', .15], ['baldcypress', .1]]},
  plants: [['slashpine', .25, 1.1], ['sawpalmetto', .25], ['cabbagepalm', .15], ['sawgrass', .15], ['liveoakmoss', .08], ['baldcypress', .03], ['muhlygrass', .04], ['citrustree', .05]],
  ui: {panel: 'rgba(14,30,34,.88)', a1: '#bae6fd', a2: '#0369a1', hot: '#fde68a', soft: '#b4d0dc', onHot: '#061a24'},
  world: {clubhouse: 'plantation', bridge: 'wood', story: {walls: null, ruins: ['cottage']}, life: {grazers: ['deer', 2], heron: true}}},
 // Phase 6: Texas and the deserts (the Texas and deserts packs).
 hillcountry: {},
 // Bluebonnet Prairie: the Blackland Prairie, flat and open, pecan and cedar
 // elm along the creeks, Osage orange hedgerows, bluebonnets everywhere.
 bluebonnet: {treeDensity: 1.4, rough: '#7e8a4a', hills: {base: 14, severity: 20, reach: 70},
  // The field in bloom from a distance: the long grass's heads bluebonnet
  // blue, half as many tufts again (rendering only; PLACED -- the pack's
  // clumps are under half a metre and read only close to).
  longGrass: {...TRAITS.texas.longGrass, count: 6000, accent: '#4a62c8'},
  scatter: {...TRAITS.texas.scatter, rocks: 60}, rockStyle: 'round',
  stands: {...TRAITS.texas.stands, under: {spacing: 9, plants: [['shrub', 1]]},
   plants: [['pecan', .3], ['cedarelm', .3], ['osageorange', .2], ['postoak', .2]]},
  plants: [['bluebonnet', .3], ['pecan', .12], ['cedarelm', .12], ['osageorange', .1], ['postoak', .06], ['prairieforbs', .15], ['shrub', .1], ['redbud', .05]],
  ui: {panel: 'rgba(16,22,40,.88)', a1: '#bfdbfe', a2: '#1d4ed8', hot: '#fef3c7', soft: '#c0c8dc', onHot: '#0a1230'},
  world: {clubhouse: 'farmhouse', bridge: 'wood', story: {walls: 'rail', farm: 'redbarn', ruins: ['cottage'], landmark: 'windpump'}}},
 // Gulf Coast: flat and wet coastal prairie by Houston, live oaks and
 // loblolly pines, yaupon and wax myrtle, cordgrass at the water.
 gulfcoast: {treeDensity: 2.4, rough: '#6e7e40', sky: '#c8d6dc', temperature: 31, hills: {base: 6, severity: 12, reach: 70},
  scatter: {...TRAITS.texas.scatter, rocks: 30}, rockStyle: 'round',
  stands: {...TRAITS.texas.stands, under: {spacing: 8, plants: [['yaupon', .5], ['waxmyrtle', .5]]},
   plants: [['liveoak', .4], ['loblollypine', .4], ['pecan', .2]]},
  plants: [['liveoak', .25], ['loblollypine', .15], ['pecan', .08], ['waxmyrtle', .12], ['yaupon', .1], ['spartina', .12], ['crapemyrtle', .05], ['sawpalmetto', .05], ['shrub', .08]],
  ui: {panel: 'rgba(14,30,30,.88)', a1: '#99f6e4', a2: '#0f766e', hot: '#fef3c7', soft: '#b4d2cc', onHot: '#061e1c'},
  world: {clubhouse: 'clapboard', bridge: 'wood', story: {walls: null, ruins: ['cottage']}, life: {grazers: ['deer', 2], heron: true, geese: 4}}},
 // Mojave: Joshua trees and creosote on a basin floor, rounded granite,
 // Mojave yucca and beavertail, smoke trees in the washes.
 mojave: {rough: '#c2ae84', sky: '#d4dce2', altitude: 900, temperature: 33, rock: '#c8ac88', rockStyle: 'round',
  stands: {...TRAITS.desert.stands, under: {spacing: 8, plants: [['creosote', .6], ['beavertail', .2], ['brittlebush', .2]]},
   plants: [['joshuatree', .55], ['smoketree', .1], ['cholla', .2], ['mojaveyucca', .15]]},
  plants: [['joshuatree', .22], ['creosote', .25], ['mojaveyucca', .12], ['cholla', .1], ['beavertail', .08], ['brittlebush', .08], ['smoketree', .05], ['tamarisk', .02], ['agave', .03], ['jojoba', .05]],
  ui: {panel: 'rgba(38,30,22,.88)', a1: '#fde4c0', a2: '#9a5b24', hot: '#fff7ed', soft: '#e6d4bc', onHot: '#2a1a0c'}},
 // Desert Palms: the Coachella Valley's resorts -- fan and date palms,
 // oleander and tamarisk windbreaks, bougainvillea, mountains behind.
 palms: {rough: '#b8a878', semi: '#5e8a40', sky: '#d0dce6', temperature: 34, altitude: 100,
  landform: {...TRAITS.desert.landform, chance: .2},
  stands: {...TRAITS.desert.stands, under: {spacing: 8, plants: [['oleander', .5], ['creosote', .5]]},
   plants: [['fanpalm', .4], ['datepalm', .3], ['tamarisk', .3]]},
  plants: [['fanpalm', .2], ['datepalm', .12], ['oleander', .12], ['bougainvillea', .06], ['creosote', .2], ['brittlebush', .08], ['desertwillow', .06], ['tamarisk', .06], ['smoketree', .05], ['aleppopine', .03], ['agave', .02]],
  ui: {panel: 'rgba(36,18,28,.88)', a1: '#fbcfe8', a2: '#be185d', hot: '#fef9c3', soft: '#e4c8d4', onHot: '#2a0a18'},
  world: {clubhouse: 'pavilion'}},
 // Chihuahuan: lechuguilla, sotol and soaptree yucca on limestone, ocotillo,
 // mesquite, Emory oak and alligator juniper up the slopes (Big Bend).
 chihuahuan: {rough: '#b0a07a', sky: '#d8dade', altitude: 1200, temperature: 30, rock: '#c0aa8a', rockStyle: 'angular',
  stands: {...TRAITS.desert.stands, under: {spacing: 8, plants: [['lechuguilla', .4], ['sotol', .3], ['creosote', .3]]},
   plants: [['mesquite', .35], ['alligatorjuniper', .25], ['emoryoak', .25], ['soaptreeyucca', .15]]},
  plants: [['creosote', .22], ['lechuguilla', .14], ['sotol', .12], ['soaptreeyucca', .1], ['ocotillo', .08], ['mesquite', .1], ['cholla', .06], ['beavertail', .04], ['emoryoak', .05], ['alligatorjuniper', .05], ['agave', .04]],
  ui: {panel: 'rgba(32,26,24,.88)', a1: '#fecaca', a2: '#9f1239', hot: '#fef3c7', soft: '#dccac4', onHot: '#260a10'}},
 // Phase 7: California and the western mountains.
 // Monterey: the Pebble Beach shore -- Monterey cypress and pine on the
 // headlands, ice plant, coastal sage, the sea along one side with stacks
 // standing in it (renderer.js addSeaStacks), cool fog.
 monterey: {sea: true, edgeCoast: true, shoreSand: false, hills: {base: 16, severity: 45, reach: 50}, treeDensity: 1.6,
  rough: '#7a8a4e', sky: '#c8d6de', temperature: 18, rockStyle: 'angular', seaStacks: 6,
  longGrass: {...TRAITS.california.longGrass, leaf: '#8a9056', accent: '#b8a870'},
  stands: {...TRAITS.california.stands, under: {spacing: 8, plants: [['coastalsage', .5], ['shrub', .5]]},
   plants: [['montereypine', .5], ['montereycypress', .3], ['coastliveoak', .2]]},
  plants: [['montereycypress', .2], ['montereypine', .15], ['coastliveoak', .1], ['iceplant', .18], ['coastalsage', .15], ['chaparral', .07], ['californiapoppy', .05], ['shrub', .1]],
  ui: {panel: 'rgba(14,26,34,.88)', a1: '#a5f3fc', a2: '#0e7490', hot: '#fef3c7', soft: '#b8d4da', onHot: '#06202a'}},
 // SoCal Canyons: chaparral hills and barrancas -- sycamores and coast live
 // oaks in the canyons, eucalyptus windbreaks, Torrey pines, jacarandas in
 // bloom and pepper trees round the clubhouse, ice plant on the banks.
 socal: {hills: {base: 40, severity: 110, reach: 80}, rough: '#b8a468',
  stands: {...TRAITS.california.stands, under: {spacing: 8, plants: [['chaparral', .6], ['coastalsage', .4]]},
   plants: [['coastliveoak', .4], ['sycamore', .25], ['eucalyptus', .25], ['torreypine', .1]]},
  plants: [['coastliveoak', .15], ['sycamore', .1], ['eucalyptus', .12], ['chaparral', .18], ['coastalsage', .15], ['torreypine', .05], ['jacaranda', .06], ['peppertree', .06], ['olivetree', .05], ['iceplant', .08]],
  ui: {panel: 'rgba(40,24,30,.88)', a1: '#e9d5ff', a2: '#7e22ce', hot: '#fef3c7', soft: '#dccce4', onHot: '#200a28'},
  world: {clubhouse: 'pavilion'}},
 // Wine Country: rolling vineyards between valley oaks and blue oaks,
 // poppies, olives, a stone winery clubhouse.
 winecountry: {hills: {base: 30, severity: 50, reach: 80}, rough: '#b4a464',
  stands: {...TRAITS.california.stands, under: {spacing: 8, plants: [['chaparral', .5], ['shrub', .5]]},
   plants: [['valleyoak', .4], ['blueoak', .3], ['coastliveoak', .2], ['buckeye', .1]]},
  plants: [['grapevine', .3], ['valleyoak', .15], ['blueoak', .1], ['californiapoppy', .12], ['olivetree', .08], ['buckeye', .05], ['coastliveoak', .08], ['chaparral', .06], ['shrub', .06]],
  ui: {panel: 'rgba(34,14,24,.88)', a1: '#f5d0fe', a2: '#86198f', hot: '#fef3c7', soft: '#e0c8dc', onHot: '#22061e'},
  world: {clubhouse: 'stonehouse'}},
 // Cascades (the Rockies' region): Douglas and noble fir, hemlock, western
 // larch, beargrass and huckleberry, basalt, a snow volcano on the horizon
 // (renderer.js addBackdrop) over a lower range.
 cascades: {ringLift: 600, rockStyle: 'basalt', backdrop: 'Volcano', sky: '#bccfe0',
  stands: {...TRAITS.mountain.stands, under: {spacing: 8, plants: [['huckleberry', .5], ['beargrass', .3], ['fern', .2]]},
   plants: [['fir', .35], ['noblefir', .25], ['hemlock', .25], ['westernlarch', .15]]},
  plants: [['fir', .25], ['hemlock', .15], ['noblefir', .15], ['westernlarch', .08], ['redcedar', .07], ['beargrass', .1], ['huckleberry', .1], ['fern', .05], ['vinemaple', .05]],
  ui: {panel: 'rgba(14,28,26,.88)', a1: '#a7f3d0', a2: '#047857', hot: '#fef3c7', soft: '#b4d4c8', onHot: '#06201a'},
  world: {clubhouse: 'lodge'}},
 // High Sierra: sugar pine, incense cedar, red fir and ponderosa over
 // manzanita and mule's ear, glaciated granite slabs.
 sierra: {rockStyle: 'granite', sky: '#b8d2ec',
  stands: {...TRAITS.mountain.stands, under: {spacing: 8, plants: [['manzanita', .6], ['mulesear', .4]]},
   plants: [['redfir', .3], ['sugarpine', .25], ['incensecedar', .25], ['ponderosa', .2]]},
  plants: [['sugarpine', .15], ['incensecedar', .15], ['redfir', .12], ['ponderosa', .1], ['lodgepole', .08], ['manzanita', .15], ['mulesear', .08], ['lupine', .05], ['willowthicket', .05], ['aspen', .07]],
  ui: {panel: 'rgba(20,24,34,.88)', a1: '#c7d2fe', a2: '#4338ca', hot: '#fef3c7', soft: '#c4c8dc', onHot: '#0c0a2a'},
  // No split-rail fences on the granite (phase 7: too steep for one to
  // stand on the test course, and none in the high country; PLACED).
  world: {story: {walls: null, ruins: ['minehead', 'cottage']}}},
 // Ponderosa: the open ponderosa park of the Mogollon Rim -- tall
 // orange-barked pines far apart, Gambel oak, mountain mahogany,
 // bitterbrush and sage, black basalt.
 ponderosa: {rockStyle: 'basalt', treeDensity: 2.4, rough: '#8a8a5a', altitude: 2100, temperature: 24, hills: {base: 40, severity: 90, reach: 90},
  stands: {...TRAITS.mountain.stands, under: {spacing: 9, plants: [['bitterbrush', .5], ['sagebrush', .5]]},
   plants: [['ponderosa', .75], ['gambeloak', .25]]},
  plants: [['ponderosa', .4], ['gambeloak', .15], ['mountainmahogany', .08], ['bitterbrush', .12], ['aspen', .05], ['lupine', .05], ['sagebrush', .1], ['mulesear', .05]],
  ui: {panel: 'rgba(36,22,16,.88)', a1: '#ffedd5', a2: '#9a3412', hot: '#fef3c7', soft: '#e4cfc0', onHot: '#2a1006'},
  world: {clubhouse: 'loglodge'}},
 // Phase 8: the high desert and the Cross Timbers.
 redrock: {},
 // Sagebrush: the Columbia Plateau's steppe -- sage and bunchgrass on rolling
 // basalt, rimrock for its stone, western juniper, balsamroot in flower.
 sagebrush: {sandLand: false, rough: '#9a9a6a', rock: '#4a4440', rockStyle: 'rimrock', rockMoss: '#8e8a5a', altitude: 600, temperature: 24,
  landform: TRAITS.midwest.landform,
  stands: {...TRAITS.highdesert.stands, under: {spacing: 8, plants: [['sagebrush', .5], ['bitterbrush', .5]]},
   plants: [['westernjuniper', .6], ['russianolive', .4]]},
  plants: [['sagebrush', .3], ['westernjuniper', .1], ['rabbitbrush', .12], ['bitterbrush', .1], ['balsamroot', .1], ['cheatgrass', .13], ['russianolive', .05], ['globemallow', .05], ['shrub', .05]],
  ui: {panel: 'rgba(26,30,24,.88)', a1: '#ecfccb', a2: '#65a30d', hot: '#fef3c7', soft: '#d0d8c0', onHot: '#141c08'}},
 // Cross Timbers (the plains' region): the post oak and blackjack belt of
 // Oklahoma between the prairies, red cedar coming in, an oil pump jack.
 crosstimbers: {treeDensity: 1.6, rough: '#8a8448',
  stands: {...TRAITS.plains.stands, share: .5, under: {spacing: 9, plants: [['shrub', 1]]},
   plants: [['postoak', .5], ['blackjackoak', .35], ['easternredcedar', .15]]},
  plants: [['postoak', .2], ['blackjackoak', .15], ['easternredcedar', .1], ['shrub', .1], ['prairieforbs', .2], ['buffalograss', .05], ['wildsunflower', .05], ['soapweedyucca', .05], ['cedarelm', .05], ['redbud', .05]],
  ui: {panel: 'rgba(34,22,14,.88)', a1: '#fda4af', a2: '#be123c', hot: '#fff1f2', soft: '#e4c4c8', onHot: '#2a0810'},
  world: {story: {walls: 'wire', farm: true, landmark: 'pumpjack'}}},
 // Phase 8b: Appalachia.
 blueridge: {},
 // The Ozarks: oak-hickory and shortleaf pine on limestone hills, red cedar
 // glades, dogwood and redbud.
 ozarks: {rockStyle: 'limestone', rock: '#c8c0a8', hills: {base: 40, severity: 90, reach: 85},
  stands: {...TRAITS.appalachia.stands, under: {spacing: 8, plants: [['shrub', .6], ['mountainlaurelshrub', .4]]},
   plants: [['oak', .35], ['shortleafpine', .3], ['shagbark', .2], ['easternredcedar', .15]]},
  plants: [['oak', .16], ['shagbark', .1], ['shortleafpine', .14], ['easternredcedar', .08], ['sassafras', .08], ['floweringdogwood', .08], ['redbud', .08], ['chestnutoak', .08], ['shrub', .1], ['prairieforbs', .1]],
  ui: {panel: 'rgba(30,22,16,.88)', a1: '#e9c9a0', a2: '#8a4a1a', hot: '#fef3c7', soft: '#dccbb8', onHot: '#241406'}},
 // The Bluegrass: Kentucky horse country -- rolling pasture, bur oaks and
 // hickories, black four-board fences, a black tobacco barn.
 bluegrass: {treeDensity: .5, rough: '#6e8a44', semi: '#4e8e40', hills: {base: 20, severity: 35, reach: 80},
  // Pasture, not woods: open stands as the plains' (the first pictures were
  // closed forest).
  farForest: {cover: .45, size: 11, colors: ['#3e6232', '#4a6e38', '#567a3e']},
  stands: {...TRAITS.plains.stands, under: {spacing: 9, plants: [['shrub', 1]]},
   plants: [['buroak', .35], ['oak', .3], ['shagbark', .2], ['americanelm', .15]]},
  plants: [['buroak', .15], ['oak', .12], ['americanelm', .1], ['maple', .1], ['sassafras', .06], ['shagbark', .08], ['tulippoplar', .08], ['shrub', .12], ['prairieforbs', .09], ['floweringdogwood', .05], ['redbud', .05]],
  ui: {panel: 'rgba(14,24,30,.88)', a1: '#d4e8f8', a2: '#2a5f8a', hot: '#fef3c7', soft: '#c0d0dc', onHot: '#06141e'},
  world: {clubhouse: 'clapboard', story: {walls: 'board', farm: 'tobaccobarn', ruins: ['stonecabin']}}},
};

// A landscape's world block: the generic one, its region's, its own.
export const worldOf = key => {
 const k = currentKey(key), region = LANDSCAPES[k]?.region;
 return {...WORLD_GENERIC, ...(WORLD[region] || {}), ...(LAND[k]?.world || {})};
};

// Merged once. `scatter` and `hills` are replaced wholesale rather than merged
// field by field, because a biome that sets one of them means all of it.
export const BIOMES = Object.fromEntries(Object.entries(LAND).map(([key, own]) => {
 const place = LANDSCAPES[key], region = place.region;
 const {ui, world, ...rest} = own;
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
