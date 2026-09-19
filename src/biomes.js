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
 mapWater: '#e0e5d5', // the course map's background beyond the land
 warm: false,       // house walls in warm tones
 arid: false,       // house surroundings without lawn
 // Ground shader, by name rather than by index into an array.
 speckleRock: false,   // rock mottling through the turf
 altitudeRock: false,  // bare rock high up, snow higher still
 litter: true,         // needle and leaf litter in the rough
};

// Only what differs from the defaults above.
const TRAITS = {
 pnw: {bank: '#526343', hills: {base: 45, severity: 0, reach: 70}, ringLift: 420, treeDensity: 4,
  plants: [['pine', .38], ['cedar', .3], ['alder', .17], ['fern', .15]]},
 desert: {bank: '#b49a73', hills: {base: 25, severity: 75, reach: 90}, ringLift: 240,
  scatter: {rocks: 500, grass: 12000, tufts: 150, tallGrass: false,
   rockScale: 2, bladeLength: .65, bladeWidth: .8, bladeTint: null,
   flowers: ['#f0cf63', '#bc80b4']},
  sandLand: true, dust: true, spray: '#ead9a7', warm: true, arid: true, speckleRock: true, litter: false,
  treeDensity: 1.25, waterMurk: .15, canopy: {min: 4, range: 5},
  plants: [['cactus', .3], ['palo', .22], ['mesquite', .18], ['ocotillo', .16], ['agave', .14]]},
 mountain: {bank: '#7b8982', hills: {base: 70, severity: 180, reach: 90}, ringLift: 950,
  scatter: {rocks: 550, grass: 110000, tufts: 1600, tallGrass: false,
   rockScale: 2, bladeLength: .65, bladeWidth: .8, bladeTint: null,
   flowers: ['#f0cf63', '#bc80b4']},
  altitudeRock: true, treeDensity: 3.8,
  plants: [['spruce', .4], ['pine', .28], ['aspen', .22], ['shrub', .1]]},
 links: {bank: '#9c905e', hills: {base: 14, severity: 35, reach: 42}, ringLift: 0,
  sea: true, scatter: {rocks: 160, grass: 400000, tufts: 1600, tallGrass: true,
   rockScale: 1, bladeLength: 1.25, bladeWidth: 1.4, bladeTint: '#c2a05c',
   flowers: ['#ddc252', '#ae79a6']},
  dust: true, spray: '#ead9a7', arid: true, treeDensity: 1.1, edgeCoast: true,
  cover: 'prairie', waterMurk: .8,
  plants: [['gorse', .5], ['heather', .42], ['shrub', .08]]},
 midwest: {bank: '#697348',
  plants: [['oak', .5], ['aspen', .18], ['maple', .22], ['shrub', .1]]},
 island: {bank: '#aaad7a', ringLift: 0, hop: 155, shoreSand: true, mapWater: '#6eb8c0',
  coastal: true, sea: true, inlandWater: false, litter: false,
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
 redwood: {bank: '#40412f', hills: {base: 45, severity: 0, reach: 70}, ringLift: 420,
  // Forty-six to eighty metres. A coast redwood is the tallest living thing
  // there is, and at the usual 13-to-29 it is just a pine with a dark tint --
  // the height is most of what makes the grove.
  treeDensity: 5.5, canopy: {min: 46, range: 34}, farCanopy: {min: 42, range: 32},
  waterTint: '#2c5450', waterMurk: .3,
  // Fewer blades, more of everything low and wet.
  scatter: {rocks: 300, grass: 90000, tufts: 2000, tallGrass: false,
   rockScale: 1.3, bladeLength: .8, bladeWidth: .9, bladeTint: '#46603a',
   flowers: ['#d8d2a6', '#9fb07c']},
  // 380 feet. Coast redwoods really do run to this, and the point of the
  // biome is standing under one -- the floor of the range is unchanged, so a
  // grove is a wide spread of heights rather than a field of identical giants.
  canopy: {min: 46, range: 69.8}, farCanopy: {min: 42, range: 73.8},
  deadfall: 520,
  plants: [['redwood', .40], ['fir', .24], ['swordfern', .26], ['cedar', .10]]},
 autumn: {bank: '#81724e', leafFall: true, leafLitter: true, spray: '#db9851',
  sunColor: '#ffcc8e', treeDensity: 3.6, waterTint: '#819eae',
  plants: [['maple', .36], ['oak', .25], ['aspen', .24], ['spruce', .15]]},
};

const PALETTES = {
 pnw:{name:'Pacific Northwest',title:'Bandon Ridge',tag:'Old-growth forest. Cool coastal air.',rough:'#526238',semi:'#477335',fairway:'#538637',fringe:'#638e40',green:'#80a74c',tree:'#254c32',sky:'#a7c6d5',sand:'#e5d9b7',water:'#245959',rock:'#6f7976',altitude:120,temperature:16,treeKind:'pine',sun:28},
 desert:{name:'Desert',title:'Saguaro Dunes',tag:'Emerald turf in a sandstone wilderness.',rough:'#b99967',semi:'#688440',fairway:'#39804b',fringe:'#76a055',green:'#90b66b',tree:'#617b46',sky:'#dbd4b9',sand:'#e9c996',water:'#348d8a',rock:'#b57c4e',altitude:450,temperature:31,treeKind:'cactus',sun:24},
 mountain:{name:'Mountain',title:'Alpine Reserve',tag:'Glacial peaks. Clear alpine lakes.',rough:'#65714c',semi:'#557843',fairway:'#639847',fringe:'#86a65d',green:'#a3ba78',tree:'#24473b',sky:'#adcfeb',sand:'#dfddd1',water:'#24647b',rock:'#8a9495',altitude:1800,temperature:11,treeKind:'spruce',sun:36},
 links:{name:'Links',title:'North Sea Links',tag:'Golden fescue, dunes, and Atlantic light.',rough:'#a89d65',semi:'#7e9050',fairway:'#6d9149',fringe:'#91a75b',green:'#acbd73',tree:'#89945e',sky:'#c8d7df',sand:'#e9dcb7',water:'#436e80',rock:'#8b8977',altitude:15,temperature:14,treeKind:'shrub',sun:23},
 midwest:{name:'Midwest',title:'Prairie Run',tag:'Parkland oaks beneath an endless sky.',rough:'#69783b',semi:'#50803d',fairway:'#599743',fringe:'#83a451',green:'#a0be6a',tree:'#46732f',sky:'#b8d7e9',sand:'#e8ddc3',water:'#41766a',rock:'#83846c',altitude:230,temperature:22,treeKind:'oak',sun:39},
 island:{name:'Island',title:'Turtle Bay',tag:'White coral sand and turquoise shallows.',rough:'#829549',semi:'#5a944c',fairway:'#4b9b58',fringe:'#82b76d',green:'#a4ce83',tree:'#3d803f',sky:'#b0dfec',sand:'#fff0d3',water:'#12a9b0',rock:'#70756a',altitude:8,temperature:28,treeKind:'palm',sun:47},
 redwood:{name:'Giant Redwood',title:'Cathedral Grove',tag:'Ancient trunks. Deep shade and wet air.',rough:'#39492c',semi:'#35602f',fairway:'#3d6f33',fringe:'#497a38',green:'#6d9445',tree:'#1b3324',sky:'#96a5a4',sand:'#cdc3a7',water:'#1c3f3c',rock:'#5f6a63',altitude:60,temperature:13,treeKind:'pine',sun:18},
 autumn:{name:'Autumn',title:'Copper Hollow',tag:'Copper canopies in the afternoon sun.',rough:'#a19957',semi:'#748347',fairway:'#709245',fringe:'#99aa66',green:'#b2c280',tree:'#b76427',sky:'#e1cfb5',sand:'#e8d7b4',water:'#627967',rock:'#827463',altitude:350,temperature:17,treeKind:'oak',sun:19}
};

// Merged once. `scatter` and `hills` are replaced wholesale rather than merged
// field by field, because a biome that sets one of them means all of it.
export const BIOMES = Object.fromEntries(Object.entries(PALETTES).map(([key, palette]) => {
 const traits = TRAITS[key] || {};
 return [key, {...DEFAULTS, ...palette, ...traits, key}];
}));

// The stream bank colour, still reachable by its old name so streams.js and the
// ground shader do not have to care where it moved to.
export const BANK_COLORS = Object.fromEntries(
 Object.entries(BIOMES).map(([key, b]) => [key, b.bank]));

// A biome by key, never undefined: an unknown name falls back rather than
// producing an object with no palette at all, which is a black course.
export const biomeOf = key => BIOMES[key] || BIOMES.pnw;
