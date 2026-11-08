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
  'Redwood_1', 'Redwood_2', 'Redwood_3', 'YoungRedwood_1', 'YoungRedwood_2', 'YoungRedwood_3', 'Fir_1', 'Fir_2', 'Hemlock_1', 'Hemlock_2', 'RedCedar_1', 'RedCedar_2',
  'Tanoak_1', 'Tanoak_2', 'LakeCottonwood_1', 'LakeCottonwood_2', 'LakeCottonwood_3', 'LakeBlackOak_1', 'LakeBlackOak_2',
  'LakeBlackOak_3', 'LakeSugarMaple_1', 'LakeSugarMaple_2',
  'Madrone_1', 'Madrone_2', 'GarryOak_1', 'GarryOak_2', 'BigleafMaple_1', 'BigleafMaple_2', 'BayLaurel_1', 'BayLaurel_2',
  'Lodgepole_1', 'Lodgepole_2', 'BlueSpruce_1', 'BlueSpruce_2', 'AmericanElm_1', 'AmericanElm_2', 'Shagbark_1', 'Shagbark_2',
  'BurOak_1', 'BurOak_2', 'PaperBirch_1', 'PaperBirch_2', 'WhitePine_1', 'WhitePine_2', 'BalsamFir_1', 'BalsamFir_2',
  'AmericanBeech_1', 'AmericanBeech_2', 'Ironwood_1', 'Ironwood_2',
  'RoyalPalm_1', 'RoyalPalm_2', 'Mangrove_1', 'GumboLimbo_1', 'Banyan_1',
  'LongleafPine_1', 'LongleafPine_2', 'LoblollyPine_1', 'LoblollyPine_2', 'SlashPine_1', 'SlashPine_2', 'CabbagePalm_1', 'CabbagePalm_2', 'LiveOak_1', 'LiveOak_2', 'LiveOakMoss_1', 'LiveOakMoss_2', 'BaldCypress_1', 'BaldCypress_2', 'WaterTupelo_1', 'Magnolia_1', 'Magnolia_2', 'TulipPoplar_1', 'TulipPoplar_2', 'Sweetgum_1', 'Sweetgum_2',
  'Pecan_1', 'Pecan_2', 'NoRedPine_1', 'NoRedPine_2', 'NoPaperBirch_1', 'NoPaperBirch_2', 'BdGreenAsh_1', 'BdGreenAsh_2', 'BdRockyMountainJuniper_1', 'BdRockyMountainJuniper_2', 'PrPlainsCottonwood_1', 'PrPlainsCottonwood_2', 'PrHackberry_1', 'PrHackberry_2', 'PrEasternRedCedar_1', 'PrEasternRedCedar_2', 'MtPonderosaPine_1', 'MtPonderosaPine_2', 'MtLodgepolePine_1', 'MtLodgepolePine_2', 'MtEngelmannSpruce_1', 'MtEngelmannSpruce_2', 'MtQuakingAspen_1', 'MtQuakingAspen_2', 'RwRedwood_1', 'RwRedwood_2', 'RwYoungRedwood_1', 'RwYoungRedwood_2', 'RwTanoak_1', 'RwTanoak_2', 'SlShorePine_1', 'SlShorePine_2', 'CcMontereyCypress_1', 'CcMontereyCypress_2', 'CcMontereyPine_1', 'CcMontereyPine_2', 'CcTorreyPine_1', 'CcTorreyPine_2', 'CcCoastLiveOak_1', 'CcCoastLiveOak_2', 'CcEucalyptus_1', 'CcEucalyptus_2', 'NwDouglasFir_1', 'NwDouglasFir_2', 'NwRedCedar_1', 'NwRedCedar_2', 'NwHemlock_1', 'NwHemlock_2', 'NwBigleafMaple_1', 'NwBigleafMaple_2', 'NwRedAlder_1', 'NwRedAlder_2', 'DrAfghan_1', 'DrAfghan_2', 'DrAleppo_1', 'DrAleppo_2', 'DrWillow_1', 'DrWillow_2', 'DrOlive_1', 'DrOlive_2', 'DrDate_1', 'DrDate_2', 'DrFan_1', 'DrFan_2', 'DtSaguaro_1', 'DtSaguaro_2', 'DtSaguaro_3', 'DtSaguaro_4', 'DtPaloVerde_1', 'DtPaloVerde_2', 'DtMesquite_1', 'DtMesquite_2', 'HiCookPine_1', 'HiCookPine_2', 'HiIronwood_1', 'HiIronwood_2', 'HiMonkeypod_1', 'HiMonkeypod_2', 'FlCoconut_1', 'FlCoconut_2', 'FlRoyal_1', 'FlRoyal_2', 'LowLiveOak_1', 'LowLiveOak_2', 'LowCypress_1', 'LowCypress_2', 'LowSabal_1', 'LowSabal_2', 'SouthLoblolly_1', 'SouthLoblolly_2', 'SouthLongleaf_1', 'SouthLongleaf_2', 'SouthWhitePine_1', 'SouthWhitePine_2', 'SouthDogwood_1', 'SouthDogwood_2', 'WhiteOak_1', 'WhiteOak_2', 'PinOak_1', 'PinOak_2', 'SugarMaple_1', 'SugarMaple_2', 'ParkPoplar_1', 'ParkPoplar_2', 'ParkElm_1', 'NorwaySpruce_1', 'NorwaySpruce_2', 'AfghanPine_1', 'AfghanPine_2', 'AfricanSumac_1', 'AfricanSumac_2', 'FanPalm_1', 'FanPalm_2', 'DatePalm_1', 'DatePalm_2',
  'CoastLiveOak_1', 'Eucalyptus_1', 'Eucalyptus_2', 'MontereyCypress_1', 'MontereyPine_1', 'Sycamore_1', 'GrapeVine_1', 'ValleyOak_1', 'ValleyOak_2', 'IncenseCedar_1', 'NobleFir_1', 'Ponderosa_1', 'Ponderosa_2', 'RedFir_1', 'SugarPine_1', 'WesternLarch_1',
  'PinyonPine_1', 'PinyonPine_2', 'WesternJuniper_1', 'WesternJuniper_2', 'GrainElevator_1', 'Shelterbelt_1',
  'ChestnutOak_1', 'ChestnutOak_2', 'ShortleafPine_1', 'ShortleafPine_2', 'CopperBeech_1', 'CopperBeech_2', 'PitchPine_1',
  'RedPine_1', 'RedPine_2', 'SitkaSpruce_1', 'Casuarina_1', 'CookPine_1', 'Monkeypod_1', 'Monkeypod_2',
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
 // Tall fescue and the prairie grasses (tools/blender/cartoon_prairiegrass.py;
 // the owner, 3 November 2026), long-grass families like these.
 grasstallfescue: ['blender:Blender_TallFescue_1', 'blender:Blender_TallFescue_2'],
 grasslittlebluestem: ['blender:Blender_LittleBluestem_1', 'blender:Blender_LittleBluestem_2'],
 grassswitch: ['blender:Blender_Switchgrass_1', 'blender:Blender_Switchgrass_2'],
 grassindian: ['blender:Blender_Indiangrass_1', 'blender:Blender_Indiangrass_2'],
 grassgrama: ['blender:Blender_BlueGrama_1', 'blender:Blender_BlueGrama_2'],
 grasswheat: ['blender:Blender_Wheatgrass_1', 'blender:Blender_Wheatgrass_2'],
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
 // The Redwood Coast rebuilt from Meshy in the tufted wording (tools/meshy/redwood2.json; the owner,
 // 7 November 2026), in vendor/blender-meshy_redwood2. The first Meshy pack's redwoods
 // (vendor/blender-meshy_redwood) stay on disk for the other names it still serves.
 redwood: ['meshy_redwood2:Blender_RwRedwood_1', 'meshy_redwood2:Blender_RwRedwood_2'],
 youngredwood: ['meshy_redwood2:Blender_RwYoungRedwood_1', 'meshy_redwood2:Blender_RwYoungRedwood_2'],
 dougfir: ['blender:Blender_Fir_1', 'blender:Blender_Fir_2'],
 hemlock: ['blender:Blender_Hemlock_1', 'blender:Blender_Hemlock_2'],
 redcedar: ['blender:Blender_RedCedar_1', 'blender:Blender_RedCedar_2'],
 tanoak: ['meshy_redwood2:Blender_RwTanoak_1', 'meshy_redwood2:Blender_RwTanoak_2'],
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
 // THE SOUTH'S PACKS (tools/blender/cartoon_southpines.py, cartoon_southoaks.py,
 // cartoon_piedmont.py, cartoon_southcoast.py): every variant.
 longleafpine: ['blender:Blender_LongleafPine_1', 'blender:Blender_LongleafPine_2'],
 loblollypine: ['blender:Blender_LoblollyPine_1', 'blender:Blender_LoblollyPine_2'],
 slashpine: ['blender:Blender_SlashPine_1', 'blender:Blender_SlashPine_2'],
 cabbagepalm: ['blender:Blender_CabbagePalm_1', 'blender:Blender_CabbagePalm_2'],
 sawpalmetto: ['blender:Blender_SawPalmetto_1'],
 longleafgrass: ['blender:Blender_LongleafGrass_1'],
 wiregrass: ['blender:Blender_Wiregrass_1'],
 liveoak: ['blender:Blender_LiveOak_1', 'blender:Blender_LiveOak_2'],
 liveoakmoss: ['blender:Blender_LiveOakMoss_1', 'blender:Blender_LiveOakMoss_2'],
 turkeyoak: ['blender:Blender_TurkeyOak_1'],
 blackjackoak: ['blender:Blender_BlackjackOak_1'],
 baldcypress: ['blender:Blender_BaldCypress_1', 'blender:Blender_BaldCypress_2'],
 cypressknees: ['blender:Blender_CypressKnees_1'],
 watertupelo: ['blender:Blender_WaterTupelo_1'],
 floweringdogwood: ['blender:Blender_FloweringDogwood_1'],
 azalea: ['blender:Blender_Azalea_1'],
 magnolia: ['blender:Blender_Magnolia_1', 'blender:Blender_Magnolia_2'],
 tulippoplar: ['blender:Blender_TulipPoplar_1', 'blender:Blender_TulipPoplar_2'],
 crapemyrtle: ['blender:Blender_CrapeMyrtle_1'],
 kudzu: ['blender:Blender_Kudzu_1'],
 sweetgum: ['blender:Blender_Sweetgum_1', 'blender:Blender_Sweetgum_2'],
 yaupon: ['blender:Blender_Yaupon_1'],
 spartina: ['blender:Blender_Spartina_1'],
 sawgrass: ['blender:Blender_Sawgrass_1'],
 muhlygrass: ['blender:Blender_MuhlyGrass_1'],
 waxmyrtle: ['blender:Blender_WaxMyrtle_1'],
 citrustree: ['blender:Blender_CitrusTree_1'],
 // THE TEXAS AND DESERTS PACKS (tools/blender/cartoon_texas.py,
 // cartoon_deserts.py): every variant; the Hill Country's limestone as a
 // boulder family of its own (biomes.js rockStyle 'limestone').
 ashejuniper: ['blender:Blender_AsheJuniper_1', 'blender:Blender_AsheJuniper_2'],
 postoak: ['blender:Blender_PostOak_1', 'blender:Blender_PostOak_2'],
 pecan: ['blender:Blender_Pecan_1', 'blender:Blender_Pecan_2'],
 cedarelm: ['blender:Blender_CedarElm_1'],
 osageorange: ['blender:Blender_OsageOrange_1'],
 mountainlaurel: ['blender:Blender_MountainLaurel_1'],
 redbud: ['blender:Blender_Redbud_1'],
 bluebonnet: ['blender:Blender_Bluebonnet_1'],
 joshuatree: ['blender:Blender_JoshuaTree_1', 'blender:Blender_JoshuaTree_2'],
 mojaveyucca: ['blender:Blender_MojaveYucca_1'],
 fanpalm: ['blender:Blender_FanPalm_1', 'blender:Blender_FanPalm_2'],
 datepalm: ['blender:Blender_DatePalm_1', 'blender:Blender_DatePalm_2'],
 aleppopine: ['blender:Blender_AleppoPine_1'],
 oleander: ['blender:Blender_Oleander_1'],
 tamarisk: ['blender:Blender_Tamarisk_1'],
 smoketree: ['blender:Blender_SmokeTree_1'],
 soaptreeyucca: ['blender:Blender_SoaptreeYucca_1'],
 sotol: ['blender:Blender_Sotol_1'],
 lechuguilla: ['blender:Blender_Lechuguilla_1'],
 desertwillow: ['blender:Blender_DesertWillow_1'],
 emoryoak: ['blender:Blender_EmoryOak_1'],
 alligatorjuniper: ['blender:Blender_AlligatorJuniper_1', 'blender:Blender_AlligatorJuniper_2'],
 beavertail: ['blender:Blender_Beavertail_1'],
 boulderlimestone: ['blender:Blender_LimestoneBoulder_1', 'blender:Blender_LimestoneBoulder_2'],
 // THE CALIFORNIA AND WESTERN MOUNTAINS PACKS (tools/blender/
 // cartoon_calcoast.py, cartoon_calinland.py, cartoon_westmtn.py): every
 // variant; their stones as boulder families (biomes.js rockStyle), the sea
 // stacks offshore (renderer.js addSeaStacks), the volcano on the horizon
 // (renderer.js addBackdrop).
 montereycypress: ['blender:Blender_MontereyCypress_1', 'blender:Blender_MontereyCypress_2'],
 montereypine: ['blender:Blender_MontereyPine_1'],
 coastliveoak: ['blender:Blender_CoastLiveOak_1', 'blender:Blender_CoastLiveOak_2'],
 eucalyptus: ['blender:Blender_Eucalyptus_1', 'blender:Blender_Eucalyptus_2'],
 sycamore: ['blender:Blender_Sycamore_1'],
 torreypine: ['blender:Blender_TorreyPine_1'],
 iceplant: ['blender:Blender_IcePlant_1'],
 coastalsage: ['blender:Blender_CoastalSage_1'],
 chaparral: ['blender:Blender_Chaparral_1'],
 valleyoak: ['blender:Blender_ValleyOak_1', 'blender:Blender_ValleyOak_2'],
 blueoak: ['blender:Blender_BlueOak_1', 'blender:Blender_BlueOak_2'],
 buckeye: ['blender:Blender_Buckeye_1'],
 grapevine: ['blender:Blender_GrapeVine_1'],
 californiapoppy: ['blender:Blender_CaliforniaPoppy_1'],
 olivetree: ['blender:Blender_OliveTree_1'],
 jacaranda: ['blender:Blender_Jacaranda_1'],
 peppertree: ['blender:Blender_PepperTree_1'],
 ponderosa: ['blender:Blender_Ponderosa_1', 'blender:Blender_Ponderosa_2'],
 sugarpine: ['blender:Blender_SugarPine_1'],
 incensecedar: ['blender:Blender_IncenseCedar_1'],
 redfir: ['blender:Blender_RedFir_1'],
 noblefir: ['blender:Blender_NobleFir_1'],
 westernlarch: ['blender:Blender_WesternLarch_1'],
 manzanita: ['blender:Blender_Manzanita_1'],
 gambeloak: ['blender:Blender_GambelOak_1'],
 mountainmahogany: ['blender:Blender_MountainMahogany_1'],
 bitterbrush: ['blender:Blender_Bitterbrush_1'],
 mulesear: ['blender:Blender_MulesEar_1'],
 beargrass: ['blender:Blender_Beargrass_1'],
 boulderbasalt: ['blender:Blender_BasaltBoulder_1', 'blender:Blender_BasaltBoulder_2'],
 bouldergranite: ['blender:Blender_GraniteSlab_1', 'blender:Blender_GraniteSlab_2'],
 seastack: ['blender:Blender_SeaStack_1', 'blender:Blender_SeaStack_2'],
 volcano: ['blender:Blender_Volcano_1'],
 // THE HIGH DESERT AND PLAINS PACKS (tools/blender/cartoon_highdesert.py,
 // cartoon_plains.py): every variant; the rimrock and hoodoos as boulder
 // families; the ranch pieces (windmill, grain elevator, pump jack, barbed
 // wire, shelterbelt) are story pieces (story.js), picked in storypieces.
 westernjuniper: ['blender:Blender_WesternJuniper_1', 'blender:Blender_WesternJuniper_2'],
 utahjuniper: ['blender:Blender_UtahJuniper_1'],
 pinyonpine: ['blender:Blender_PinyonPine_1', 'blender:Blender_PinyonPine_2'],
 rabbitbrush: ['blender:Blender_Rabbitbrush_1'],
 blackbrush: ['blender:Blender_Blackbrush_1'],
 cliffrose: ['blender:Blender_Cliffrose_1'],
 russianolive: ['blender:Blender_RussianOlive_1'],
 balsamroot: ['blender:Blender_Balsamroot_1'],
 globemallow: ['blender:Blender_Globemallow_1'],
 cheatgrass: ['blender:Blender_Cheatgrass_1'],
 soapweedyucca: ['blender:Blender_SoapweedYucca_1'],
 easternredcedar: ['blender:Blender_EasternRedCedar_1', 'blender:Blender_EasternRedCedar_2'],
 buffalograss: ['blender:Blender_Buffalograss_1'],
 wildsunflower: ['blender:Blender_WildSunflower_1'],
 boulderrimrock: ['blender:Blender_BasaltRimrock_1', 'blender:Blender_BasaltRimrock_2'],
 boulderhoodoo: ['blender:Blender_SandstoneHoodoo_1', 'blender:Blender_SandstoneHoodoo_2'],
 // THE APPALACHIA AND NORTHEAST PARKLAND PACKS (tools/blender/
 // cartoon_appalachia.py, cartoon_neparkland.py): every variant; the cabin,
 // horse fence, tobacco barn, shingled windmill and Tudor clubhouse are
 // story pieces and a clubhouse, picked in storypieces.
 rosebay: ['blender:Blender_Rhododendron_1'],
 mountainlaurelshrub: ['blender:Blender_MountainLaurelShrub_1'],
 flameazalea: ['blender:Blender_FlameAzalea_1'],
 chestnutoak: ['blender:Blender_ChestnutOak_1', 'blender:Blender_ChestnutOak_2'],
 shortleafpine: ['blender:Blender_ShortleafPine_1', 'blender:Blender_ShortleafPine_2'],
 sassafras: ['blender:Blender_Sassafras_1'],
 copperbeech: ['blender:Blender_CopperBeech_1', 'blender:Blender_CopperBeech_2'],
 pitchpine: ['blender:Blender_PitchPine_1', 'blender:Blender_PitchPine_2'],
 scruboak: ['blender:Blender_ScrubOak_1'],
 bayberry: ['blender:Blender_Bayberry_1'],
 beachrose: ['blender:Blender_BeachRose_1'],
 hydrangea: ['blender:Blender_Hydrangea_1'],
 // THE NORTH AND HAWAII PACKS (tools/blender/cartoon_north.py,
 // cartoon_hawaii.py): every variant; Hawaii's ironwood as `casuarina`
 // (`ironwood` is the desert's); the lava as a boulder family; the log cabin
 // and the dock are story pieces, picked in storypieces.
 redpine: ['blender:Blender_RedPine_1', 'blender:Blender_RedPine_2'],
 jackpine: ['blender:Blender_JackPine_1'],
 tamarack: ['blender:Blender_Tamarack_1'],
 blackspruce: ['blender:Blender_BlackSpruce_1', 'blender:Blender_BlackSpruce_2'],
 sitkaspruce: ['blender:Blender_SitkaSpruce_1'],
 shorepine: ['blender:Blender_ShorePine_1', 'blender:Blender_ShorePine_2'],
 fireweed: ['blender:Blender_Fireweed_1'],
 devilsclub: ['blender:Blender_DevilsClub_1'],
 cottongrass: ['blender:Blender_Cottongrass_1'],
 monkeypod: ['blender:Blender_Monkeypod_1', 'blender:Blender_Monkeypod_2'],
 casuarina: ['blender:Blender_Casuarina_1'],
 cookpine: ['blender:Blender_CookPine_1'],
 ohia: ['blender:Blender_Ohia_1'],
 plumeria: ['blender:Blender_Plumeria_1'],
 tiplant: ['blender:Blender_TiPlant_1'],
 heliconia: ['blender:Blender_Heliconia_1'],
 boulderlava: ['blender:Blender_LavaRock_1', 'blender:Blender_LavaRock_2'],
 // THE HAWAIIAN RESORT PACK (tools/meshy/hawaiian.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_hawaiian, its names prefixed because hand-built models hold the plain ones.
 hicookpine: ['blender:Blender_HiCookPine_1', 'blender:Blender_HiCookPine_2'],
 hiironwood: ['blender:Blender_HiIronwood_1', 'blender:Blender_HiIronwood_2'],
 himonkeypod: ['blender:Blender_HiMonkeypod_1', 'blender:Blender_HiMonkeypod_2'],
 // THE DESERT MOUNTAIN PACK (tools/meshy/deserttarget.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_deserttarget, its names prefixed because hand-built models hold the plain ones.
 dtsaguaro: ['blender:Blender_DtSaguaro_1', 'blender:Blender_DtSaguaro_2', 'blender:Blender_DtSaguaro_3', 'blender:Blender_DtSaguaro_4'],
 dtpaloverde: ['blender:Blender_DtPaloVerde_1', 'blender:Blender_DtPaloVerde_2'],
 dtmesquite: ['blender:Blender_DtMesquite_1', 'blender:Blender_DtMesquite_2'],
 // THE DESERT RESORT PACK (tools/meshy/desertres.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_desertres, its names prefixed because hand-built models hold the plain ones.
 drafghan: ['blender:Blender_DrAfghan_1', 'blender:Blender_DrAfghan_2'],
 draleppo: ['blender:Blender_DrAleppo_1', 'blender:Blender_DrAleppo_2'],
 drwillow: ['blender:Blender_DrWillow_1', 'blender:Blender_DrWillow_2'],
 drolive: ['blender:Blender_DrOlive_1', 'blender:Blender_DrOlive_2'],
 drdate: ['blender:Blender_DrDate_1', 'blender:Blender_DrDate_2'],
 drfan: ['blender:Blender_DrFan_1', 'blender:Blender_DrFan_2'],
 // THE PACIFIC NORTHWEST PACK (tools/meshy/northwest.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_northwest, its names prefixed because hand-built models hold the plain ones.
 nwfir: ['blender:Blender_NwDouglasFir_1', 'blender:Blender_NwDouglasFir_2'],
 nwcedar: ['blender:Blender_NwRedCedar_1', 'blender:Blender_NwRedCedar_2'],
 nwhemlock: ['blender:Blender_NwHemlock_1', 'blender:Blender_NwHemlock_2'],
 nwmaple: ['blender:Blender_NwBigleafMaple_1', 'blender:Blender_NwBigleafMaple_2'],
 nwalder: ['blender:Blender_NwRedAlder_1', 'blender:Blender_NwRedAlder_2'],
 // THE CALIFORNIA COAST PACK (tools/meshy/calcoast.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_calcoast, its names prefixed because hand-built models hold the plain ones.
 cccypress: ['blender:Blender_CcMontereyCypress_1', 'blender:Blender_CcMontereyCypress_2'],
 ccmpine: ['blender:Blender_CcMontereyPine_1', 'blender:Blender_CcMontereyPine_2'],
 cctorrey: ['blender:Blender_CcTorreyPine_1', 'blender:Blender_CcTorreyPine_2'],
 ccliveoak: ['blender:Blender_CcCoastLiveOak_1', 'blender:Blender_CcCoastLiveOak_2'],
 cceuc: ['blender:Blender_CcEucalyptus_1', 'blender:Blender_CcEucalyptus_2'],
 // THE SEASIDE LINKS PACK (tools/meshy/seaside.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_seaside, its names prefixed because hand-built models hold the plain ones.
 slshore: ['blender:Blender_SlShorePine_1', 'blender:Blender_SlShorePine_2'],
 // THE MOUNTAIN PACK (tools/meshy/mountain.json, made on Meshy; the owner, 8 November 2026).
 // In vendor/blender-meshy_mountain, its names prefixed because hand-built models hold the plain ones.
 mtponderosa: ['blender:Blender_MtPonderosaPine_1', 'blender:Blender_MtPonderosaPine_2'],
 mtlodge: ['blender:Blender_MtLodgepolePine_1', 'blender:Blender_MtLodgepolePine_2'],
 mtspruce: ['blender:Blender_MtEngelmannSpruce_1', 'blender:Blender_MtEngelmannSpruce_2'],
 mtaspen: ['blender:Blender_MtQuakingAspen_1', 'blender:Blender_MtQuakingAspen_2'],
 // THE PRAIRIE AND SAND HILLS PACK (tools/meshy/prairie.json, made on Meshy; the owner, 8 November 2026).
 // In vendor/blender-meshy_prairie, its names prefixed because hand-built models hold the plain ones.
 prcotton: ['blender:Blender_PrPlainsCottonwood_1', 'blender:Blender_PrPlainsCottonwood_2'],
 prhack: ['blender:Blender_PrHackberry_1', 'blender:Blender_PrHackberry_2'],
 prcedar: ['blender:Blender_PrEasternRedCedar_1', 'blender:Blender_PrEasternRedCedar_2'],
 // THE BADLANDS PACK (tools/meshy/badlands.json, made on Meshy; the owner, 8 November 2026).
 // In vendor/blender-meshy_badlands, its names prefixed because hand-built models hold the plain ones.
 bdash: ['blender:Blender_BdGreenAsh_1', 'blender:Blender_BdGreenAsh_2'],
 bdjuniper: ['blender:Blender_BdRockyMountainJuniper_1', 'blender:Blender_BdRockyMountainJuniper_2'],
 // THE NORTHERN WOODS PACK (tools/meshy/northwoods.json, made on Meshy; the owner, 8 November 2026).
 // In vendor/blender-meshy_northwoods, its names prefixed because hand-built models hold the plain ones.
 norpine: ['blender:Blender_NoRedPine_1', 'blender:Blender_NoRedPine_2'],
 nobirch: ['blender:Blender_NoPaperBirch_1', 'blender:Blender_NoPaperBirch_2'],
 // THE FLORIDA PALMS PACK (tools/meshy/florida.json, made on Meshy; the owner, 7 November
 // 2026). In vendor/blender-meshy_florida, as FlCoconut and FlRoyal: the Keys' hand-built
 // royal palm holds the plain name.
 flcoconut: ['blender:Blender_FlCoconut_1', 'blender:Blender_FlCoconut_2'],
 flroyal: ['blender:Blender_FlRoyal_1', 'blender:Blender_FlRoyal_2'],
 // THE LOWCOUNTRY AND GULF PACK (tools/meshy/lowcountry.json, made on Meshy; the owner, 7
 // November 2026). In vendor/blender-meshy_lowcountry, its names changed on the way in
 // because the hand-built South's models hold them.
 lowliveoak: ['blender:Blender_LowLiveOak_1', 'blender:Blender_LowLiveOak_2'],
 lowcypress: ['blender:Blender_LowCypress_1', 'blender:Blender_LowCypress_2'],
 lowsabal: ['blender:Blender_LowSabal_1', 'blender:Blender_LowSabal_2'],
 // THE SOUTHERN PINES PACK (tools/meshy/southern.json, made on Meshy; the owner, 6
 // November 2026). In vendor/blender-meshy_southern, its names changed on the way in
 // because the hand-built South's models hold them.
 southloblolly: ['blender:Blender_SouthLoblolly_1', 'blender:Blender_SouthLoblolly_2'],
 southlongleaf: ['blender:Blender_SouthLongleaf_1', 'blender:Blender_SouthLongleaf_2'],
 southwhitepine: ['blender:Blender_SouthWhitePine_1', 'blender:Blender_SouthWhitePine_2'],
 southdogwood: ['blender:Blender_SouthDogwood_1', 'blender:Blender_SouthDogwood_2'],
 // THE CLASSIC PARKLAND PACK (tools/meshy/parkland.json, made on Meshy; the owner,
 // 6 November 2026): taller and narrower than the hand-built hardwoods. In
 // vendor/blender-meshy_parkland; the pack's AmericanElm and TulipPoplar ship as
 // ParkElm and ParkPoplar, because the Heartland's and Piedmont's models hold those names.
 whiteoak: ['blender:Blender_WhiteOak_1', 'blender:Blender_WhiteOak_2'],
 pinoak: ['blender:Blender_PinOak_1', 'blender:Blender_PinOak_2'],
 parkmaple: ['blender:Blender_SugarMaple_1', 'blender:Blender_SugarMaple_2'],
 parkpoplar: ['blender:Blender_ParkPoplar_1', 'blender:Blender_ParkPoplar_2'],
 parkelm: ['blender:Blender_ParkElm_1'],
 norwayspruce: ['blender:Blender_NorwaySpruce_1', 'blender:Blender_NorwaySpruce_2'],
 // THE DESERT RESORT PACK (tools/blender/cartoon_resort.py; the owner, 5 November
 // 2026): the Las Vegas valley's pine, sumac and lake-edge pampas grass.
 afghanpine: ['blender:Blender_AfghanPine_1', 'blender:Blender_AfghanPine_2'],
 africansumac: ['blender:Blender_AfricanSumac_1', 'blender:Blender_AfricanSumac_2'],
 pampasgrass: ['blender:Blender_PampasGrass_1', 'blender:Blender_PampasGrass_2'],
 // THE BADLANDS PACK (tools/blender/cartoon_badlands.py; the owner, 3
 // November 2026): its plants; the Yellow Mounds as its boulder family; the
 // bison in lifeforms. Its spires, walls and buttes are the ground's
 // (landforms.js `badlands`), not models.
 rmjuniper: ['blender:Blender_RMJuniper_1', 'blender:Blender_RMJuniper_2'],
 greenash: ['blender:Blender_GreenAsh_1'],
 chokecherry: ['blender:Blender_Chokecherry_1'],
 leadplant: ['blender:Blender_Leadplant_1'],
 boulderbadlands: ['blender:Blender_BadlandsMound_1', 'blender:Blender_BadlandsMound_2'],
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
 storypieces: ['StoryWall_Stone', 'StoryWall_Hedge', 'StandingStone_1', 'Barn', 'Silo', 'Windpump', 'RuinChapel', 'RuinCottage', 'MineHead', 'SugarMill', 'Lighthouse', 'Church', 'PierLight_1', 'RedBarn_1', 'CornPatch_1', 'FieldWall_1', 'CoveredBridge_1',
  // The streets kit (tools/blender/cartoon_streets.py; roads.js furniture).
  'StreetLight_1', 'LightPole_1', 'WheelStop_1', 'BagDrop_1', 'ParkingIsland_1', 'CartBarn_1', 'Mailbox_1',
  // The South's plantation clubhouse and its alligator (tools/blender/cartoon_southcoast.py).
  'PlantationClubhouse_1', 'Alligator_1',
  // The plains pack's ranch pieces (tools/blender/cartoon_plains.py).
  'Windmill_1', 'GrainElevator_1', 'PumpJack_1', 'BarbedWireFence_1', 'Shelterbelt_1',
  // Appalachia's and the Northeast parkland's.
  'StoneCabin_1', 'HorseFence_1', 'TobaccoBarn_1', 'ShingledWindmill_1', 'TudorClubhouse_1',
  // The north pack's.
  'LogCabin_1', 'Dock_1'].map(k => `blender:Blender_${k}`),
 // LIFE ON AN ARCHITECT COURSE (tools/blender/architect_life.py; phase 6):
 // animals, placed by life.js, moved by renderer.js addLife. (The walkers and
 // the mower, and tournament week's stands, board and crowd -- the pack
 // architect_occasion.py -- were removed on 2 November 2026: the owner.)
 lifeforms: ['Sheep_1', 'Goose_1', 'Deer_1', 'Elk_1', 'Heron_1', 'Roadrunner_1', 'Bird_1', 'Bison_1'].map(k => `blender:Blender_${k}`),
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
const PACKS = readdirSync(VENDOR).map(pack => ({pack, dir: join(VENDOR, pack), files: new Set(readdirSync(join(VENDOR, pack)))}));
// A TRIAL OF MODELS FROM ELSEWHERE: FAIRWAY_MESHY names a folder (tools/meshy-run.mjs
// --convert), and what it holds replaces the shipped model of the same name. Without
// it nothing changes. It is for looking; src/asset-meshes.js is rebuilt without it.
const TRIAL = process.env.FAIRWAY_MESHY;
if (TRIAL) {
 const files = new Set(readdirSync(TRIAL).filter(f => f.endsWith('.glb')));
 for (const p of PACKS) for (const f of files) p.files.delete(f);
 PACKS.push({pack: 'blender-meshy-trial', dir: TRIAL, files});
}

// Every pack holding this model, so an ambiguous name can say so rather than
// quietly taking whichever the filesystem listed first.
function locate(entry) {
 const colon = entry.indexOf(':');
 const hint = colon < 0 ? null : entry.slice(0, colon), name = colon < 0 ? entry : entry.slice(colon + 1);
 const found = [];
 for (const {pack, dir, files} of PACKS) {
  if (hint && !pack.includes(hint)) continue;
  for (const ext of ['.glb', '.obj'])
   if (files.has(name + ext)) { found.push({pack, file: join(dir, name + ext), glb: ext === '.glb'}); break; }
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
