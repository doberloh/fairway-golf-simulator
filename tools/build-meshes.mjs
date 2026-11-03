// Turns the models built in Blender (vendor/blender-cartoon_*/, written by
// tools/blender/cartoon_*.py) into one compact binary that the single file
// build can carry.
//
// Run: node tools/build-meshes.mjs
// Reads:  vendor/<pack>/*.glb
//
// A PICK entry is a model's file name. A bare name found in more than one
// pack is an ERROR rather than first-pack-wins, because the silent version of
// that bug swaps the model under an existing biome and nothing tells you.
// Write `blender:Blender_Pine_1` to say which pack you meant; the part before
// the colon just has to appear in the directory name.
// Writes: src/asset-meshes.js
//
// The third-party CC0 packs (Kenney, Quaternius) this once read were removed
// on 27 October 2026, once the cartoon overhaul had remade everything they
// supplied; the OBJ path and the house atlases below are kept for any model
// that needs them again.
//
// The material colours are dropped: every surface is classified into a role
// (bark, leaf, stone, dirt, accent) by its material name, and the running game
// paints those roles from the biome palette, scaled by the model's own vertex
// paint. That is what lets one model serve every biome.
//
// Positions are quantised to int16 against each model's own bounds and normals
// to int8, which is roughly a third of the float encoding and visually free at
// the sizes these are drawn.
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const VENDOR = join(ROOT, 'vendor');

import {ROLE_OF, ROLES, extract, extractObj} from './mesh-read.mjs';
export {ROLE_OF, ROLES} from './mesh-read.mjs';


// Which models we actually take, and what each stands in for in the game.
const PICK = {
 // THE CARTOON OVERHAUL'S CONIFERS (tools/blender/cartoon_conifer.py),
 // replacing Kenney's stacked-cone conifer family.
 // THE CARTOON BOULDERS (tools/blender/cartoon_rocks.py), one family per
 // geology, picked by a biome's `rockStyle`; four each, the generator's
 // `shape` choosing.
 boulderround: ['blender:Blender_BoulderRound_1', 'blender:Blender_BoulderRound_2', 'blender:Blender_BoulderRound_3', 'blender:Blender_BoulderRound_4'],
 boulderangular: ['blender:Blender_BoulderAngular_1', 'blender:Blender_BoulderAngular_2', 'blender:Blender_BoulderAngular_3', 'blender:Blender_BoulderAngular_4'],
 boulderlayered: ['blender:Blender_BoulderLayered_1', 'blender:Blender_BoulderLayered_2', 'blender:Blender_BoulderLayered_3', 'blender:Blender_BoulderLayered_4'],
 sprucetree: ['blender:Blender_Spruce_1', 'blender:Blender_Spruce_2', 'blender:Blender_Spruce_3'],
 pinetree: ['blender:Blender_Pine_1', 'blender:Blender_Pine_2', 'blender:Blender_Pine_3'],
 cedartree: ['blender:Blender_Cedar_1', 'blender:Blender_Cedar_2', 'blender:Blender_Cedar_3'],
 // THE CARTOON OVERHAUL'S BROADLEAVES (tools/blender/cartoon_broadleaf.py),
 // replacing Kenney's broadleaf family -- the cube- and plateau-crowned trees
 // -- for every landscape that plants oak, maple, aspen or alder.
 oaktree: ['blender:Blender_Oak_1', 'blender:Blender_Oak_2', 'blender:Blender_Oak_3'],
 mapletree: ['blender:Blender_Maple_1', 'blender:Blender_Maple_2', 'blender:Blender_Maple_3'],
 aspentree: ['blender:Blender_Aspen_1', 'blender:Blender_Aspen_2', 'blender:Blender_Aspen_3'],
 aldertree: ['blender:Blender_Alder_1', 'blender:Blender_Alder_2'],
 // THE FAR TWINS (cartoon.py `far_twin`): each painted tree again at a
 // twelfth of its triangles, never planted -- src/mesh-assets.js `farParts`
 // hands one out where a crown is small on screen (instance-cull.js).
 fartwin: ['Spruce_1', 'Spruce_2', 'Spruce_3', 'Pine_1', 'Pine_2', 'Pine_3', 'Cedar_1', 'Cedar_2', 'Cedar_3',
  'Oak_1', 'Oak_2', 'Oak_3', 'Maple_1', 'Maple_2', 'Maple_3', 'Aspen_1', 'Aspen_2', 'Aspen_3', 'Alder_1', 'Alder_2',
  'Palo_1', 'Palo_2', 'Palo_3', 'Mesquite_1', 'Mesquite_2', 'Mesquite_3',
  'Redwood_1', 'Redwood_2', 'Redwood_3', 'Fir_1', 'Fir_2', 'Hemlock_1', 'Hemlock_2', 'RedCedar_1', 'RedCedar_2',
  'Tanoak_1', 'Tanoak_2', 'LakeCottonwood_1', 'LakeCottonwood_2', 'LakeCottonwood_3', 'LakeBlackOak_1', 'LakeBlackOak_2',
  'LakeBlackOak_3', 'LakeSugarMaple_1', 'LakeSugarMaple_2',
  'Madrone_1', 'Madrone_2', 'GarryOak_1', 'GarryOak_2', 'BigleafMaple_1', 'BigleafMaple_2', 'BayLaurel_1', 'BayLaurel_2',
  'Lodgepole_1', 'Lodgepole_2', 'BlueSpruce_1', 'BlueSpruce_2', 'AmericanElm_1', 'AmericanElm_2', 'Shagbark_1', 'Shagbark_2',
  'BurOak_1', 'BurOak_2', 'PaperBirch_1', 'PaperBirch_2', 'WhitePine_1', 'WhitePine_2', 'BalsamFir_1', 'BalsamFir_2',
  'AmericanBeech_1', 'AmericanBeech_2', 'Ironwood_1', 'Ironwood_2',
  'RoyalPalm_1', 'RoyalPalm_2', 'Mangrove_1', 'GumboLimbo_1', 'Banyan_1',
  'Shrub_1', 'Shrub_2', 'Shrub_3', 'Gorse_1', 'Gorse_2', 'Gorse_3']
  .map(n => `blender:Blender_${n}_Far`),
 // THE CARTOON ISLAND (tools/blender/cartoon_island.py), replacing Kenney's
 // palms and the procedural hala.
 palm: ['blender:Blender_Palm_1', 'blender:Blender_Palm_2', 'blender:Blender_Palm_3', 'blender:Blender_Palm_4'],
 halatree: ['blender:Blender_Hala_1', 'blender:Blender_Hala_2', 'blender:Blender_Hala_3'],
 // THE CARTOON DESERT (tools/blender/cartoon_desert.py), replacing Kenney's
 // cacti and dead hardwoods and the procedural ocotillo and agave.
 palotree: ['blender:Blender_Palo_1', 'blender:Blender_Palo_2', 'blender:Blender_Palo_3'],
 mesquitetree: ['blender:Blender_Mesquite_1', 'blender:Blender_Mesquite_2', 'blender:Blender_Mesquite_3'],
 saguaro: ['blender:Blender_Saguaro_1', 'blender:Blender_Saguaro_2', 'blender:Blender_Saguaro_3'],
 cholla: ['blender:Blender_Cholla_1', 'blender:Blender_Cholla_2', 'blender:Blender_PricklyPear_1', 'blender:Blender_Barrel_1'],
 ocotillo: ['blender:Blender_Ocotillo_1', 'blender:Blender_Ocotillo_2', 'blender:Blender_Ocotillo_3'],
 agaveplant: ['blender:Blender_Agave_1', 'blender:Blender_Agave_2'],
 // THE CARTOON LONG GRASS (tools/blender/cartoon_grass.py): decoration
 // between the holes, one family per grass (vegetation.js addLongGrass).
 // THE CARTOON BRUSH (tools/blender/cartoon_brush.py): the shrubs the
 // landscapes lacked, and the understory of the stands.
 creosotebush: ['blender:Blender_Creosote_1', 'blender:Blender_Creosote_2'],
 brittlebush: ['blender:Blender_Brittlebush_1', 'blender:Blender_Brittlebush_2'],
 sagebrush: ['blender:Blender_Sagebrush_1', 'blender:Blender_Sagebrush_2'],
 brackenfern: ['blender:Blender_Bracken_1', 'blender:Blender_Bracken_2'],
 huckleberrybush: ['blender:Blender_Huckleberry_1', 'blender:Blender_Huckleberry_2'],
 grassfescue: ['blender:Blender_Fescue_1', 'blender:Blender_Fescue_2', 'blender:Blender_Fescue_3'],
 grassmarram: ['blender:Blender_Marram_1', 'blender:Blender_Marram_2'],
 grassbluestem: ['blender:Blender_Bluestem_1', 'blender:Blender_Bluestem_2'],
 grassalpine: ['blender:Blender_Alpine_1', 'blender:Blender_Alpine_2'],
 grassbunch: ['blender:Blender_Bunch_1', 'blender:Blender_Bunch_2'],
 grasssedge: ['blender:Blender_Sedge_1', 'blender:Blender_Sedge_2'],
 grassplume: ['blender:Blender_Plume_1', 'blender:Blender_Plume_2'],
 // Kenney's `rock`, `grass` and `flower` families and the grown `litter` are
 // no longer taken (the cartoon overhaul): nothing drew them once the
 // boulders, the grass and the ground cover were remade.
 // THE CARTOON OVERHAUL'S SHRUBS (tools/blender/cartoon_shrubs.py), replacing
 // the one Kenney bush family six species shared.
 shrubbush: ['blender:Blender_Shrub_1', 'blender:Blender_Shrub_2', 'blender:Blender_Shrub_3'],
 gorsebush: ['blender:Blender_Gorse_1', 'blender:Blender_Gorse_2', 'blender:Blender_Gorse_3'],
 heatherbush: ['blender:Blender_Heather_1', 'blender:Blender_Heather_2', 'blender:Blender_Heather_3'],
 naupakabush: ['blender:Blender_Naupaka_1', 'blender:Blender_Naupaka_2', 'blender:Blender_Naupaka_3'],
 fernbush: ['blender:Blender_Fern_1', 'blender:Blender_Fern_2', 'blender:Blender_Fern_3'],
 // THE FOREST FLOOR (tools/blender/cartoon_deadfall.py): old-growth reads from
 // what has fallen as much as from what is standing -- logs, stumps and mossy
 // stones, in one hand with the rest.
 log: ['blender:Blender_Log_1', 'blender:Blender_Log_2', 'blender:Blender_Log_3'],
 stump: ['blender:Blender_Stump_1', 'blender:Blender_Stump_2', 'blender:Blender_Stump_3'],
 mossrock: ['blender:Blender_MossRock_1', 'blender:Blender_MossRock_2', 'blender:Blender_MossRock_3'],
 // THE CARTOON REDWOOD GROVE (tools/blender/cartoon_redwood.py, the cartoon
 // overhaul), which replaced a grove grown by this project's own code: one
 // hand with every other landscape, and 1,000-1,900 faces a tree where the
 // grown ones were 13,000-53,000.
 redwood: ['blender:Blender_Redwood_1', 'blender:Blender_Redwood_2', 'blender:Blender_Redwood_3'],
 dougfir: ['blender:Blender_Fir_1', 'blender:Blender_Fir_2'],
 hemlock: ['blender:Blender_Hemlock_1', 'blender:Blender_Hemlock_2'],
 redcedar: ['blender:Blender_RedCedar_1', 'blender:Blender_RedCedar_2'],
 tanoak: ['blender:Blender_Tanoak_1', 'blender:Blender_Tanoak_2'],
 swordfern: ['blender:Blender_SwordFern_1', 'blender:Blender_SwordFern_2'],
 salal: ['blender:Blender_Salal_1', 'blender:Blender_Salal_2'],
 sorrel: ['blender:Blender_Sorrel_1'],
 seedling: ['blender:Blender_Seedling_1', 'blender:Blender_Seedling_2'],
 // LAKESHORE DUNES (tools/blender/cartoon_lakeshore.py). Every name starting
 // `Blender_` comes out of a script in tools/blender/ and lives in a
 // `vendor/blender-<pack>/` folder; docs/BLENDER_ASSETS.md says how to remake
 // or extend them. Material names are already roles, so no override.
 dunegrass: ['blender:Blender_LakeDuneGrass_1', 'blender:Blender_LakeDuneGrass_2', 'blender:Blender_LakeDuneGrass_3'],
 cottonwood: ['blender:Blender_LakeCottonwood_1', 'blender:Blender_LakeCottonwood_2', 'blender:Blender_LakeCottonwood_3'],
 blackoak: ['blender:Blender_LakeBlackOak_1', 'blender:Blender_LakeBlackOak_2', 'blender:Blender_LakeBlackOak_3'],
 sugarmaple: ['blender:Blender_LakeSugarMaple_1', 'blender:Blender_LakeSugarMaple_2'],
 juniper: ['blender:Blender_LakeJuniper_1', 'blender:Blender_LakeJuniper_2'],
 juniperbush: ['blender:Blender_LakeJuniper_3'],
 driftwood: ['blender:Blender_LakeDriftwood_1', 'blender:Blender_LakeDriftwood_2', 'blender:Blender_LakeDriftwood_3'],
 // THE PACIFIC PACK (the US landscapes goal; tools/blender/cartoon_pacific.py,
 // fifteen rounds a model against the study's pictures: tools/blender/logs/).
 // One variant each of the less common trees: every variant is a draw per
 // part, full and far, in the frame and the shadow pass, and the first cut
 // put Puget Sound's Low frame up 24% (RESEARCH, *The Pacific pack*). The
 // others stay in the pack, not shipped (the madrone's two-stem `_2` ships:
 // the three-stem `_1` is 6,700 triangles).
 madrone: ['blender:Blender_Madrone_1', 'blender:Blender_Madrone_2'],
 garryoak: ['blender:Blender_GarryOak_1', 'blender:Blender_GarryOak_2'],
 bigleafmaple: ['blender:Blender_BigleafMaple_1', 'blender:Blender_BigleafMaple_2'],
 pacificdogwood: ['blender:Blender_PacificDogwood_1'],
 baylaurel: ['blender:Blender_BayLaurel_1', 'blender:Blender_BayLaurel_2'],
 vinemaple: ['blender:Blender_VineMaple_1'],
 oregongrape: ['blender:Blender_OregonGrape_1'],
 scotchbroom: ['blender:Blender_ScotchBroom_1'],
 rhododendron: ['blender:Blender_PacificRhododendron_1'],
 douglasiris: ['blender:Blender_DouglasIris_1'],
 // THE MOUNTAIN PACK (tools/blender/cartoon_mountain.py): the Rockies' own.
 // Two lodgepoles (the common tree), one of the rest.
 lodgepole: ['blender:Blender_Lodgepole_1', 'blender:Blender_Lodgepole_2'],
 bluespruce: ['blender:Blender_BlueSpruce_1', 'blender:Blender_BlueSpruce_2'],
 willowthicket: ['blender:Blender_WillowThicket_1'],
 columbine: ['blender:Blender_Columbine_1'],
 lupine: ['blender:Blender_Lupine_1'],
 // A story wall's panel (renderer.js addStory), never planted.
 storyrail: ['blender:Blender_SplitRailFence_1'],
 // THE DRY-AND-LAKE PACK (tools/blender/cartoon_drylake.py): the Sonoran's
 // jojoba, Lake Dunes' sand cherry; the pier light is a story piece (above).
 // The ironwood after the silhouette pass (one variant: the Sonoran's third tree).
 ironwood: ['blender:Blender_Ironwood_1', 'blender:Blender_Ironwood_2'],
 jojoba: ['blender:Blender_Jojoba_1'],
 sandcherry: ['blender:Blender_SandCherry_1'],
 // THE HEARTLAND PACK (tools/blender/cartoon_heartland.py): one of each tree.
 // The red barn and the corn are story pieces (above).
 americanelm: ['blender:Blender_AmericanElm_1', 'blender:Blender_AmericanElm_2'],
 shagbark: ['blender:Blender_Shagbark_1', 'blender:Blender_Shagbark_2'],
 buroak: ['blender:Blender_BurOak_1', 'blender:Blender_BurOak_2'],
 prairieforbs: ['blender:Blender_PrairieForbs_1'],
 // THE NEW ENGLAND PACK (tools/blender/cartoon_newengland.py): both white
 // pines (the region's commonest tree), one of the rest. The field wall and
 // the covered bridge are story pieces (above).
 paperbirch: ['blender:Blender_PaperBirch_1', 'blender:Blender_PaperBirch_2'],
 whitepine: ['blender:Blender_WhitePine_1', 'blender:Blender_WhitePine_2'],
 balsamfir: ['blender:Blender_BalsamFir_1', 'blender:Blender_BalsamFir_2'],
 americanbeech: ['blender:Blender_AmericanBeech_1', 'blender:Blender_AmericanBeech_2'],
 // THE KEYS PACK (tools/blender/cartoon_keys.py), silhouette first.
 royalpalm: ['blender:Blender_RoyalPalm_1', 'blender:Blender_RoyalPalm_2'],
 travelerspalm: ['blender:Blender_TravelersPalm_1'],
 seagrape: ['blender:Blender_SeaGrape_1'],
 mangrove: ['blender:Blender_Mangrove_1'],
 gumbolimbo: ['blender:Blender_GumboLimbo_1'],
 banyan: ['blender:Blender_Banyan_1'],
 bougainvillea: ['blender:Blender_Bougainvillea_1'],
 hibiscus: ['blender:Blender_Hibiscus_1'],
 // THE CARTOON HOUSES (tools/blender/cartoon_houses.py), replacing Kenney's
 // building kit: two of each form homes.js chooses, picked by name.
 house: ['blender:Blender_House_Gable_1', 'blender:Blender_House_Gable_2', 'blender:Blender_House_Hip_1',
  'blender:Blender_House_Hip_2', 'blender:Blender_House_Saltbox_1', 'blender:Blender_House_Saltbox_2',
  'blender:Blender_House_Lshape_1', 'blender:Blender_House_Lshape_2'],
 // THE CARTOON COURSE FURNITURE (tools/blender/cartoon_course.py): what
 // stands at every tee (renderer.js addHoleDetails), never planted.
 // THE CARTOON GARDENS (tools/blender/cartoon_garden.py): a fairway home's
 // picket fence and garden shrubs (homes.js), never planted.
 gardenfence: ['blender:Blender_Fence_Picket'],
 gardenshrub: ['blender:Blender_GardenShrub_Dome', 'blender:Blender_GardenShrub_Flowering', 'blender:Blender_GardenShrub_Cone'],
 // THE CARTOON WILDFLOWERS (tools/blender/cartoon_flowers.py): the rough's
 // flowers (vegetation.js addGroundCover), coloured per landscape.
 wildflower: ['blender:Blender_Flower_Daisy', 'blender:Blender_Flower_Aster', 'blender:Blender_Flower_Cup'],
 coursefurniture: ['blender:Blender_TeeMarker_1', 'blender:Blender_TeeSign_1', 'blender:Blender_Bench_1', 'blender:Blender_BallWasher_1'],
 // AN ARCHITECT COURSE'S MARKINGS (tools/blender/architect_people.py;
 // architect-courses, phase 2): stakes, yardage posts and rakes, placed by
 // markings.js and drawn instanced by renderer.js addMarkings, never planted.
 coursemarkings: ['blender:Blender_Stake_1', 'blender:Blender_ObStake_1', 'blender:Blender_YardagePost_1', 'blender:Blender_Rake_1'],
 // AN ARCHITECT COURSE'S CLUBHOUSE (tools/blender/architect_clubhouses.py), one
 // per landscape, fitted to its box by renderer.js addBuildings.
 clubhouse: ['lodge', 'adobe', 'chalet', 'stonehouse', 'farmhouse', 'pavilion', 'loglodge', 'clapboard', 'shingle'].map(k => `blender:Blender_Clubhouse_${k}`),
 // AN ARCHITECT COURSE'S BUILT WATER (tools/blender/architect_water.py;
 // architect-courses, phase 5): bridge bays (renderer.js addPaths), rip-rap,
 // tie walls and fountains (waterworks.js, renderer.js addWaterworks).
 // AN ARCHITECT COURSE'S STORY (tools/blender/architect_story.py; phase 6):
 // walls, the farmstead, ruins and landmarks (story.js, renderer.js
 // addBuildings and addStory).
 storypieces: ['StoryWall_Stone', 'StoryWall_Hedge', 'StandingStone_1', 'Barn', 'Silo', 'Windpump', 'RuinChapel', 'RuinCottage', 'MineHead', 'SugarMill', 'Lighthouse', 'Church', 'PierLight_1', 'RedBarn_1', 'CornPatch_1', 'FieldWall_1', 'CoveredBridge_1'].map(k => `blender:Blender_${k}`),
 // LIFE ON AN ARCHITECT COURSE (tools/blender/architect_life.py; phase 6):
 // animals, placed by life.js, moved by renderer.js addLife. (The walkers and
 // the mower, and tournament week's stands, board and crowd -- the pack
 // architect_occasion.py -- were removed on 2 November 2026: the owner.)
 lifeforms: ['Sheep_1', 'Goose_1', 'Deer_1', 'Elk_1', 'Heron_1', 'Roadrunner_1', 'Bird_1'].map(k => `blender:Blender_${k}`),
 waterworks: ['BridgeBay_Wood', 'BridgeBay_Stone', 'RipRap_1', 'RipRap_2', 'RipRap_3', 'Bulkhead_1'].map(k => `blender:Blender_${k}`),
};


// Families that use only part of a model. A crown is foliage only, so the
// trunk geometry inside those models is dropped here rather than shipped and
// skipped at draw time.
const KEEP_ROLES = {conifercrown: new Set(['leaf'])};

// Families whose material names mislead ROLE_OF, named here per family so
// ROLE_OF -- which every shipped model already went through -- is untouched.
// None now: Kenney's pumpkin and toadstools had them, and went with Haunted
// Hollow (2 November 2026).
const ROLE_OVERRIDE = {};

// Families whose texture the game actually ships, and therefore the only ones
// whose texture coordinates are worth carrying. Houses have their atlas;
// nothing else does. Several packs ship leaf sheets their OBJ exports never
// reference, and finding one only attaches UVs to geometry that will never
// sample them. When the generated trees go in, their family joins this set
// and their sheets have to be carried alongside -- one or the other alone is
// either wasted bytes or an untextured quad.
const TEXTURED_FAMILIES = new Set(['house']);

const models = {}, chunks = [];
let cursor = 0;
const push = typed => {
 const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
 // Every block starts 4-byte aligned so the runtime can view it directly.
 const pad = (4 - (cursor % 4)) % 4;
 if (pad) { chunks.push(Buffer.alloc(pad)); cursor += pad; }
 const at = cursor;
 chunks.push(bytes); cursor += bytes.length;
 return at;
};

// One listing per pack, compared EXACTLY. existsSync would do, but Windows
// matches file names case-insensitively and Linux does not, so `grass` would
// find Quaternius's `Grass.obj` on one machine and not the other -- a build
// that differs by operating system, which is the worst kind.
const PACKS = readdirSync(VENDOR).map(pack => ({pack, files: new Set(readdirSync(join(VENDOR, pack)))}));

// Every pack holding this model, so an ambiguous name can say so rather than
// quietly taking whichever the filesystem listed first.
function locate(entry) {
 const colon = entry.indexOf(':');
 const hint = colon < 0 ? null : entry.slice(0, colon), name = colon < 0 ? entry : entry.slice(colon + 1);
 const found = [];
 for (const {pack, files} of PACKS) {
  if (hint && !pack.includes(hint)) continue;
  for (const ext of ['.glb', '.obj'])
   if (files.has(name + ext)) { found.push({pack, file: join(VENDOR, pack, name + ext), glb: ext === '.glb'}); break; }
 }
 if (found.length > 1)
  throw Error(`"${entry}" matches ${found.length} packs (${found.map(f => f.pack).join(', ')}). `
   + `Say which one, e.g. "${found[0].pack}:${name}".`);
 return {name, hit: found[0] || null};
}

let taken = 0, missing = [];
for (const [family, entries] of Object.entries(PICK)) {
 for (const entry of entries) {
  const {name, hit} = locate(entry);
  if (!hit) { missing.push(entry); continue; }
  if (models[name]) throw Error(`two PICK entries both end up called "${name}".`);
  const override = ROLE_OVERRIDE[family];
  if (override && !hit.glb) throw Error(`"${entry}": ROLE_OVERRIDE only reads GLB materials.`);
  const byRole = hit.glb ? extract(hit.file, override ? m => override[m] ?? ROLE_OF(m) : ROLE_OF)
   : extractObj(hit.file, TEXTURED_FAMILIES.has(family));
  const keep = KEEP_ROLES[family];
  if (keep) for (const role of [...byRole.keys()]) if (!keep.has(role)) byRole.delete(role);
  if (!byRole.size) throw Error(`"${entry}" has no ${[...(keep || [])].join('/')} part to keep.`);
  // Normalise: centred on x/z, sitting on y=0, one unit tall. The game then
  // scales every instance itself, exactly as it does its procedural shapes.
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const g of byRole.values())
   for (let i = 0; i < g.position.length; i += 3) {
    minX = Math.min(minX, g.position[i]); maxX = Math.max(maxX, g.position[i]);
    minY = Math.min(minY, g.position[i + 1]); maxY = Math.max(maxY, g.position[i + 1]);
    minZ = Math.min(minZ, g.position[i + 2]); maxZ = Math.max(maxZ, g.position[i + 2]);
   }
  const height = Math.max(maxY - minY, 1e-6), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const radius = Math.max(maxX - minX, maxZ - minZ) / 2 / height;
  // Half-extents on each axis, relative to height. Houses are fitted to a
  // width x height x depth box so the drawn building matches the oriented box
  // physics collides against; a single radius cannot express that.
  const rx = (maxX - minX) / 2 / height, rz = (maxZ - minZ) / 2 / height;
  // A MODEL THAT DOES NOT FIT THE BOX gets its own, coarser scale (`q`,
  // architect-courses): a rake 1.6 m long and 6 cm tall is 27 units long at
  // unit height and wrapped round the int16 range. Every model that fits keeps
  // 16384 and is written byte for byte as before; only an oversize one carries
  // `q`, and mesh-assets.js reads it.
  let reach = 0;
  for (const g of byRole.values()) for (let i = 0; i < g.position.length; i += 3)
   reach = Math.max(reach, Math.abs((g.position[i] - cx) / height), Math.abs((g.position[i + 1] - minY) / height), Math.abs((g.position[i + 2] - cz) / height));
  // EVERY FAMILY, since 31 October 2026 (the owner: "back port the models to
  // classic"). At first only the Architect's families had it; eleven models
  // shipped before them (tussocks, logs, sorrel, Lakeshore's junipers, dune
  // grass and driftwood) reached past the box too and had been drawn with
  // their outermost parts folded back through the model since they were
  // ingested.
  const q = reach < 32767 / 16384 ? 16384 : Math.floor(32767 / reach);
  const parts = [];
  for (const [role, g] of byRole) {
   const count = g.position.length / 3;
   const position = new Int16Array(count * 3), normal = new Int8Array(count * 3);
   for (let i = 0; i < count; i++) {
    // Quantised against a fixed +-2 unit box in normalised space, which every
    // one of these models sits inside once scaled to unit height.
    position[i * 3] = Math.round(((g.position[i * 3] - cx) / height) * q);
    position[i * 3 + 1] = Math.round(((g.position[i * 3 + 1] - minY) / height) * q);
    position[i * 3 + 2] = Math.round(((g.position[i * 3 + 2] - cz) / height) * q);
    for (let k = 0; k < 3; k++) normal[i * 3 + k] = Math.max(-127, Math.min(127, Math.round(g.normal[i * 3 + k] * 127)));
   }
   const index = new Uint16Array(g.index);
   const part = {role, count, index: index.length, positionAt: push(position), normalAt: push(normal), indexAt: push(index)};
   // THE CARTOON PAINT (tools/blender/cartoon.py), four bytes a vertex: RGB a
   // halved multiplier on the role's colour, alpha the wind flex. Only from
   // models built in Blender -- a pack model with colours of its own would
   // otherwise start carrying them, and every other model's bytes must stay
   // as they were.
   if (hit.pack.startsWith('blender-') && g.color?.length === count * 4) {
    const paint = new Uint8Array(count * 4);
    for (let i = 0; i < paint.length; i++) paint[i] = Math.max(0, Math.min(255, Math.round(g.color[i] * 255)));
    part.paintAt = push(paint);
   }
   if (TEXTURED_FAMILIES.has(family) && g.uv && g.uv.length === count * 2) {
   // A TILING UV DOES NOT FIT IN 0..1, which is what this used to assume.
   // House UVs are atlas coordinates and never leave the unit square, so
   // `uv * 65535` was fine for them and quietly clamped everything else: bark
   // that tiles nine times around and fifty-eight times up arrived with every
   // coordinate pinned at 1.0, which draws one row of pixels smeared the whole
   // length of a trunk. That is what five attempts at "the bark is wrong" were
   // actually chasing, and none of them was in the bake.
   // So the range is recorded per part and the quantisation is against that.
    let span = 1;
    for (let i = 0; i < g.uv.length; i++) span = Math.max(span, g.uv[i]);
    const uv = new Uint16Array(count * 2);
    for (let i = 0; i < uv.length; i++)
     uv[i] = Math.max(0, Math.min(65535, Math.round(g.uv[i] / span * 65535)));
    part.uvAt = push(uv);
    if (span !== 1) part.uvSpan = +span.toFixed(4);
   }
   parts.push(part);
  }
  // (`tall`, a figure's own height in metres, went with the people on 2
  // November 2026.)
  models[name] = {family, height: 1, radius: +radius.toFixed(4), rx: +rx.toFixed(4), rz: +rz.toFixed(4), textured: parts.some(p => p.uvAt !== undefined), ...(q !== 16384 ? {q} : {}), parts};
  taken++;
 }
}

// The house atlases. These are palette grids, so a house takes all of its colour
// from one of them -- every roof in a given atlas is the same swatch. Kenney
// ships three recoloured variations alongside the default for exactly that
// reason, and carrying all four is what stops a street being one colour.
// 12 KB each.
// Only while a textured family still draws a pack model: since the cartoon
// overhaul's houses (painted, in Blender) nothing reads them.
const atlases = [];
const textured = [...TEXTURED_FAMILIES].some(f => (PICK[f] || []).some(n => !n.startsWith('blender:')));
if (textured) for (const pack of readdirSync(VENDOR))
 for (const file of ['colormap.png', 'variation-a.png', 'variation-b.png', 'variation-c.png']) {
  const candidate = join(VENDOR, pack, file);
  if (existsSync(candidate)) atlases.push(readFileSync(candidate).toString('base64'));
 }
const binary = Buffer.concat(chunks);
const out = `// GENERATED by tools/build-meshes.mjs -- do not edit by hand.
// Geometry from the Blender-built models in vendor/, stripped of all materials:
// each part carries only a role that the biome palette paints at runtime.
// Positions are int16 against a unit-height model, normals int8. See
// ATTRIBUTION.md for the sources and their licences.
export const MESH_ROLES=${JSON.stringify(ROLES)};
export const MESH_MODELS=${JSON.stringify(models)};
export const MESH_ATLASES=${JSON.stringify(atlases.map(a => 'data:image/png;base64,' + a))};
const B64="${binary.toString('base64')}";
let bytes=null;
export function meshBytes(){
 if(bytes)return bytes;
 const raw=atob(B64);bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes;
}
`;
writeFileSync(join(ROOT, 'src', 'asset-meshes.js'), out);
console.log(`models: ${taken}${missing.length ? `, missing: ${missing.join(', ')}` : ''}`);
console.log(`binary: ${(binary.length / 1024).toFixed(1)} KB -> base64 ${(binary.toString('base64').length / 1024).toFixed(1)} KB`);
console.log(`module: ${(out.length / 1024).toFixed(1)} KB`);
