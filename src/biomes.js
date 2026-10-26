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
 // SOLID props the generator places, per hole: {pumpkin, toadstool, lanterns},
 // the last being the share of pumpkins carved and lit. Empty means none, and
 // a biome with none draws nothing from their random stream. See course.js.
 props: {},
 // Ghosts drifting over the course, per hole. Drawn and moved by haunts.js;
 // they are not part of the course and nothing collides with them.
 ghosts: 0,
 // The Cartoon ground lifts every rough 23% toward this colour (renderer.js).
 // An olive suits every grass there is; it turned Haunted Hollow's violet rough
 // to mud, so a biome can say what its rough should lift toward.
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
 // Haunted Hollow's night creatures, per hole: flocks of bats round the tall
 // trees and will-o'-the-wisps over water and hollows. Both come out as the
 // light goes (solar.lamplight) and are drawn by haunts.js.
 bats: 0, wisps: 0,
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
   under: {spacing: 8, plants: [['fern', .5], ['huckleberry', .5]]}},
  plants: [['pine', .38], ['cedar', .3], ['alder', .17], ['fern', .15]]},
 desert: {light: {shade: '#a78aa6', exposure: .9},
  longGrass: {families: [['grassbunch', 1, .8]], count: 2600, near: 20, leaf: '#a9a06a', accent: '#d9c88f'},
  farForest: {cover: .35, size: 7, colors: ['#6c7146', '#7c7a4c', '#5e6640']},
  bank: '#b49a73', hills: {base: 25, severity: 75, reach: 90}, ringLift: 240,
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
   under: {spacing: 8, plants: [['creosote', .5], ['brittlebush', .3], ['agave', .2]]},
   plants: [['mesquite', .38], ['palo', .27], ['cholla', .2], ['cactus', .08], ['ocotillo', .07]]},
  plants: [['cactus', .18], ['cholla', .1], ['palo', .18], ['mesquite', .14], ['ocotillo', .1], ['agave', .08], ['creosote', .14], ['brittlebush', .08]]},
 mountain: {light: {shade: '#7c90c4'},
  longGrass: {families: [['grassalpine', 3, .4], ['grassfescue', 2, .6]], count: 3500, near: 18, leaf: '#6f8a48', accent: '#e8d36a'},
  farForest: {cover: .8, size: 9, line: 520, colors: ['#284c35', '#335c3c', '#466d3f']},
  bank: '#7b8982', hills: {base: 70, severity: 180, reach: 90}, ringLift: 950,
  scatter: {rocks: 550, grass: 110000, tufts: 1600, tallGrass: false,
   rockScale: 2, bladeLength: .65, bladeWidth: .8, bladeTint: null,
   flowers: ['#f0cf63', '#bc80b4']},
  altitudeRock: true, treeDensity: 3.8,
  // Banff: cliff bands rising off the valley floor the holes share; scree at
  // each band's foot; the forest thinning on the crags.
  landform: {type: 'crags', scale: 300, height: 70, steps: 4, from: .45, cluster: .42, scree: true, reach: 120,
   kinds: {a: 'rock', b: 'scree'}, gates: {a: {near: 14, ramp: 18}, b: {near: 10, ramp: 14}}},
  rockStyle: 'angular', rockMoss: '#9aa087',
  // A wall of spruce and pine round every fairway (the owner's photograph).
  stands: {edge: 45, wobble: 18, ramp: 18, patch: .2, scale: 240, near: 35, spacing: 8, share: .6,
   under: {spacing: 8, plants: [['huckleberry', .6], ['fern', .4]]},
   plants: [['spruce', .55], ['pine', .3], ['aspen', .15]]},
  plants: [['spruce', .4], ['pine', .28], ['aspen', .22], ['sagebrush', .1]]},
 links: {light: {shade: '#8a98b0'},
  longGrass: {families: [['grassfescue', 4, .8], ['grassmarram', 2, 1.0]], count: 7000, near: 14, leaf: '#8a9150', accent: '#d8c27a'},
  farForest: {cover: .3, size: 6, colors: ['#5b6a33', '#6d7a3a', '#8a8a3e']},
  bank: '#9c905e', hills: {base: 14, severity: 35, reach: 42}, ringLift: 0,
  sea: true, scatter: {rocks: 160, grass: 400000, tufts: 1600, tallGrass: true,
   rockScale: 1, bladeLength: 1.25, bladeWidth: 1.4, bladeTint: '#c2a05c',
   flowers: ['#ddc252', '#ae79a6']},
  dust: true, spray: '#ead9a7', arid: true, treeDensity: 1.1, edgeCoast: true,
  cover: 'prairie', waterMurk: .8,
  // Marram on rumpled dune crests, heather on the settled ground behind.
  // The Old Course and Chambers Bay: fairways 1.3 times as wide, holes routed
  // out and back side by side (routing.js), and fairways that meet where
  // they do (course.js shareFairways). PLACED, all of it.
  fairwayScale: 1.3, sharedFairways: {gap: 85, cos: .9, run: 80, ease: 60}, routeParallel: {gap: 60, weight: 600, walk: 130},
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
   plants: [['oak', .5], ['maple', .35], ['aspen', .15]]},
  plants: [['oak', .5], ['aspen', .18], ['maple', .22], ['shrub', .1]]},
 island: {light: {shade: '#6fa0bf'},
  longGrass: {families: [['grassplume', 1, 1.3]], count: 1800, near: 20, leaf: '#5d8f45', accent: '#efe4c4'},
  farForest: {cover: .8, size: 10, colors: ['#3f7a35', '#4d8a3a', '#62983f']},
  bank: '#aaad7a', ringLift: 0, hop: 155, shoreSand: true, mapWater: '#6eb8c0',
  coastal: true, sea: true, inlandWater: false, litter: false,
  // Teeth of the Dog: coral ironshore just above the beach.
  landform: {type: 'coral', low: 1.0, high: 3.4, kinds: {a: 'coral'}, gates: {a: {near: 3, ramp: 4}}},
  fallen: null,
  // Uncleared coastal jungle: palms and hala, naupaka below.
  stands: {edge: 50, wobble: 22, ramp: 20, patch: .15, scale: 220, near: 35, spacing: 8, share: .55,
   under: {spacing: 8, plants: [['naupaka', 1]]},
   plants: [['palm', .5], ['hala', .35], ['naupaka', .15]]},
  plants: [['palm', .45], ['hala', .25], ['naupaka', .3]]},
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
   ['swordfern', .19], ['salal', .11], ['sorrel', .08]]},
 autumn: {light: {shade: '#9a7fa6'},
  longGrass: {families: [['grassfescue', 2, .8], ['grassbluestem', 1, 1.2]], count: 3500, near: 22, leaf: '#a38a4c', accent: '#c96d36'},
  farForest: {cover: .9, size: 11, colors: ['#b8482c', '#d67c34', '#cfa443', '#3f5a34']},
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
   plants: [['maple', .42], ['oak', .25], ['aspen', .2], ['spruce', .13]]},
  plants: [['maple', .36], ['oak', .25], ['aspen', .24], ['spruce', .15]]},
 // HAUNTED HOLLOW: THE REDWOOD TRICK AGAIN, WITH NOTHING ALIVE IN IT.
 //
 // A Halloween course. Like the grove, the mood is numbers the engine already
 // reads: the sun at 10 degrees and orange, a dusky mauve sky that the fog
 // takes its colour from, and the heaviest mist of any biome. What is new is
 // only what grows -- every tree is dead: gnarled oaks, tall pale snags, bare
 // willows and the desert's dead hardwoods -- with dark bramble under them
 // and pumpkins and toadstools among the fallen timber.
 //
 // Trees are on the short side (9 to 22 m) and a little denser than parkland,
 // because a bare tree hides far less than a leafy one and the silhouettes are
 // the point. The gnarled oak leads the list, so it is the tree that stands in
 // a fairway when a hole gets a feature tree.
 //
 // FULL FANTASY SINCE THE OWNER'S SECOND PASS. The turf is no longer dead
 // grass: purple fairways leading to slime-green greens, violet rough, ash
 // bunkers and green-black water. Pumpkins and toadstools are three to five
 // times life size and solid (`props`), most pumpkins are carved lanterns that
 // light up at dusk, and ghosts drift over the holes (`ghosts`).
 haunted: {light: {shade: '#8a70b0'},
  longGrass: {families: [['grasstussock', 1, .55]], count: 3500, near: 18, leaf: '#4c4a3f', accent: '#8a6f6a'},
  farForest: {cover: .7, size: 9, colors: ['#3b3140', '#4a3c45', '#2e2a33']},
  bank: '#3a2f3f', hills: {base: 30, severity: 20, reach: 70}, ringLift: 160,
  canopy: {min: 9, range: 13}, farCanopy: {min: 8, range: 12}, treeDensity: 3.2,
  waterTint: '#2f6b46', waterMurk: .25, spray: '#6a5a7a', sunColor: '#ffc29a',
  leafLitter: true,
  scatter: {rocks: 260, grass: 70000, tufts: 1400, tallGrass: false,
   rockScale: 1.2, bladeLength: .75, bladeWidth: .8, bladeTint: '#5a3f7a',
   flowers: ['#e0812c', '#8fd14f']},
  deadfall: 300,
  rockStyle: 'angular',
  floor: [['stump', .5], ['log', .5]],
  props: {pumpkin: 26, toadstool: 18, lanterns: .6},
  ghosts: 2,
  roughTint: '#6b5590',
  // A HARVEST MOON: low, huge and orange as it rises opposite the setting sun,
  // paling as it climbs. About nine times the real moon's half-degree across.
  moon: {size: 2.3, low: '#ff8a2a', high: '#ffe2b0', day: .25},
  bats: 1, wisps: 3,
  mapTurf: {semi: '#8f78b3', fairway: '#7f55b8', green: '#8fcb55'},
  // A moor: dead heather in dark drifts.
  landform: {type: 'moor', tussock: 3, cover: .5, kinds: {a: 'heather'}, gates: {a: {near: 9, ramp: 14}}},
  fallen: null,
  // Bramble rather than heather under them: heather's purple and its blossom
  // read as bright pink blocks against dead grass, which is cheerful, not
  // haunted. Bramble is the bush family in a dark thorny brown.
  // A thicket of dead and gnarled wood round the moor.
  stands: {edge: 60, wobble: 25, ramp: 22, patch: .15, scale: 200, near: 40, spacing: 9, share: .5,
   under: {spacing: 8, plants: [['bramble', .7], ['bracken', .3]]}},
  plants: [['gnarled', .30], ['snag', .18], ['deadwillow', .16], ['deadoak', .12],
   ['bramble', .24]]},
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
  farForest: {cover: .75, size: 11, colors: ['#3b6a2e', '#4a7a34', '#5a873b']},
  bank: '#a39a72', hills: {base: 30, severity: 40, reach: 34}, ringLift: 90,
  sea: true, edgeCoast: true, shoreSand: true, mapWater: '#4f8aa6',
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
  plants: [['cottonwood', .17], ['dunegrass', .34], ['blackoak', .17], ['sugarmaple', .09],
   ['pine', .05], ['juniper', .12], ['commonjuniper', .06]]},
};

const PALETTES = {
 pnw:{name:'Pacific Northwest',title:'Sitka Bluff',tag:'Old-growth forest. Cool coastal air.',rough:'#526238',semi:'#477335',fairway:'#538637',fringe:'#638e40',green:'#80a74c',tree:'#254c32',sky:'#a7c6d5',sand:'#e5d9b7',water:'#245959',rock:'#6f7976',altitude:120,temperature:16,treeKind:'pine',sun:28},
 desert:{name:'Desert',title:'Vermilion Basin',tag:'Emerald turf in a sandstone wilderness.',rough:'#b99967',semi:'#688440',fairway:'#39804b',fringe:'#76a055',green:'#90b66b',tree:'#617b46',sky:'#dbd4b9',sand:'#e9c996',water:'#348d8a',rock:'#b57c4e',altitude:450,temperature:31,treeKind:'cactus',sun:24},
 mountain:{name:'Mountain',title:'Alpine Reserve',tag:'Glacial peaks. Clear alpine lakes.',rough:'#65714c',semi:'#557843',fairway:'#639847',fringe:'#86a65d',green:'#a3ba78',tree:'#24473b',sky:'#adcfeb',sand:'#dfddd1',water:'#24647b',rock:'#8a9495',altitude:1800,temperature:11,treeKind:'spruce',sun:36},
 links:{name:'Links',title:'North Sea Links',tag:'Golden fescue, dunes, and Atlantic light.',rough:'#a89d65',semi:'#7e9050',fairway:'#6d9149',fringe:'#91a75b',green:'#acbd73',tree:'#89945e',sky:'#c8d7df',sand:'#e9dcb7',water:'#436e80',rock:'#8b8977',altitude:15,temperature:14,treeKind:'shrub',sun:23},
 midwest:{name:'Midwest',title:'Prairie Run',tag:'Parkland oaks beneath an endless sky.',rough:'#69783b',semi:'#50803d',fairway:'#599743',fringe:'#83a451',green:'#a0be6a',tree:'#46732f',sky:'#b8d7e9',sand:'#e8ddc3',water:'#41766a',rock:'#83846c',altitude:230,temperature:22,treeKind:'oak',sun:39},
 island:{name:'Island',title:'Leeward Cay',tag:'White coral sand and turquoise shallows.',rough:'#829549',semi:'#5a944c',fairway:'#4b9b58',fringe:'#82b76d',green:'#a4ce83',tree:'#3d803f',sky:'#b0dfec',sand:'#fff0d3',water:'#12a9b0',rock:'#70756a',altitude:8,temperature:28,treeKind:'palm',sun:47},
 redwood:{name:'Giant Redwood',title:'Cathedral Grove',tag:'Ancient trunks. Deep shade and wet air.',rough:'#39492c',semi:'#35602f',fairway:'#3d6f33',fringe:'#497a38',green:'#6d9445',tree:'#1b3324',sky:'#96a5a4',sand:'#cdc3a7',water:'#1c3f3c',rock:'#5f6a63',altitude:60,temperature:13,treeKind:'pine',sun:18},
 autumn:{name:'Autumn',title:'Copper Hollow',tag:'Copper canopies in the afternoon sun.',rough:'#a19957',semi:'#748347',fairway:'#709245',fringe:'#99aa66',green:'#b2c280',tree:'#b76427',sky:'#e1cfb5',sand:'#e8d7b4',water:'#627967',rock:'#827463',altitude:350,temperature:17,treeKind:'oak',sun:19},
 haunted:{name:'Haunted Hollow',title:'Gloaming Moor',tag:'Bare branches and low fog in the last of the light.',rough:'#3c2856',semi:'#553c7c',fairway:'#7f55b8',fringe:'#9270c6',green:'#86c24f',tree:'#2a2030',sky:'#a4949a',sand:'#b9b2a6',water:'#1f3d2e',rock:'#4f4a58',altitude:200,temperature:9,treeKind:'oak',sun:10},
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
 island:   {panel: 'rgba(6,30,46,.88)',  a1: '#22d3ee', a2: '#0891b2', hot: '#ff8fa3', soft: '#a5d8e6', onHot: '#04202e'},
 redwood:  {panel: 'rgba(36,12,14,.88)', a1: '#f87171', a2: '#9f1239', hot: '#fde68a', soft: '#e6b3b3', onHot: '#2a0a0e'},
 autumn:   {panel: 'rgba(40,24,8,.88)',  a1: '#fbbf24', a2: '#c2410c', hot: '#ffffff', soft: '#ecc9a0', onHot: '#2a1606'},
 haunted:  {panel: 'rgba(26,12,42,.9)',  a1: '#c084fc', a2: '#7c3aed', hot: '#fb923c', soft: '#cdb4f0', onHot: '#1a0a2e'},
 // Lake blue and dune sand: not from a mockup (the biome came after them),
 // so PLACED to the same pattern, and held to the contrast test like the rest.
 lakeshore:{panel: 'rgba(8,30,42,.88)',  a1: '#7dd3fc', a2: '#0e7490', hot: '#fde68a', soft: '#b4d6e2', onHot: '#05202c'},
};

// Merged once. `scatter` and `hills` are replaced wholesale rather than merged
// field by field, because a biome that sets one of them means all of it.
export const BIOMES = Object.fromEntries(Object.entries(PALETTES).map(([key, palette]) => {
 const traits = TRAITS[key] || {};
 return [key, {...DEFAULTS, ...palette, ...traits, ui: INTERFACE[key], key}];
}));

// The stream bank colour, still reachable by its old name so streams.js and the
// ground shader do not have to care where it moved to.
export const BANK_COLORS = Object.fromEntries(
 Object.entries(BIOMES).map(([key, b]) => [key, b.bank]));

// A biome by key, never undefined: an unknown name falls back rather than
// producing an object with no palette at all, which is a black course.
export const biomeOf = key => BIOMES[key] || BIOMES.pnw;
