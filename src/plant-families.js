// Which family of models each species is drawn from. A table of its own, with
// no models behind it: the generator asks it (seat-core.js), and the generator
// runs in a worker whose script is built apart from the page, so anything it
// imports is in the page twice. Reaching asset-meshes.js from there put all
// 24.7 MB of the models in twice (generator 81 to 85; PROJECT_HANDOFF *THE
// WORKER CARRIES NO MODELS*).
//
// Our tree kinds mapped onto the families the packs actually cover. Anything
// absent here keeps its procedural shape: the desert species in particular have
// no counterpart in these packs, and a wrong silhouette is worse than a simple
// one.
export const FAMILY_OF = {
 // The cartoon overhaul's conifers (tools/blender/cartoon_conifer.py).
 pine: 'pinetree', spruce: 'sprucetree', cedar: 'cedartree',
 // The redwood grove's species are whole grown trees -- trunk, limbs and
 // foliage in one model -- so nothing is borrowed and nothing is drawn.
 // `redcedar` rather than `cedar` because Pacific Northwest plants `cedar` and
 // must keep its Kenney conifer.
 redwood: 'redwood', youngredwood: 'youngredwood', fir: 'dougfir', hemlock: 'hemlock',
 redcedar: 'redcedar', tanoak: 'tanoak', seedling: 'seedling',
 swordfern: 'swordfern', salal: 'salal', sorrel: 'sorrel',
 // The cartoon overhaul's broadleaves (tools/blender/cartoon_broadleaf.py), one
 // family per species since each has its own shape.
 oak: 'oaktree', maple: 'mapletree', aspen: 'aspentree', alder: 'aldertree',
 palm: 'palm', hala: 'halatree',
 // The cartoon overhaul's desert (tools/blender/cartoon_desert.py): palo
 // verde and mesquite in leaf at last (they were Kenney's dead hardwoods),
 // saguaros, the low cacti (cholla, prickly pear, barrel) as a kind of their
 // own, ocotillo and agave (until now procedural).
 cactus: 'saguaro', cholla: 'cholla', palo: 'palotree', mesquite: 'mesquitetree',
 ocotillo: 'ocotillo', agave: 'agaveplant',
 // The cartoon overhaul's brush (tools/blender/cartoon_brush.py).
 creosote: 'creosotebush', brittlebush: 'brittlebush', sagebrush: 'sagebrush', bracken: 'brackenfern',
 huckleberry: 'huckleberrybush',
 // The cartoon overhaul's shrubs (tools/blender/cartoon_shrubs.py): five
 // plants that were one Kenney `bush` family, each its own now.
 shrub: 'shrubbush', gorse: 'gorsebush', heather: 'heatherbush', naupaka: 'naupakabush', fern: 'fernbush',
 // Lakeshore Dunes: built in Blender (tools/blender/lakeshore.py). The
 // creeping juniper mats and the common juniper's vase are two families
 // because one is sized by its spread and the other by its height.
 // Black oak and sugar maple are their own species here rather than `oak`
 // and `maple`, which six biomes draw from the Kenney broadleaf family.
 cottonwood: 'cottonwood', blackoak: 'blackoak', sugarmaple: 'sugarmaple',
 dunegrass: 'dunegrass', juniper: 'juniper', commonjuniper: 'juniperbush',
 // The US landscapes goal's Pacific pack (tools/blender/cartoon_pacific.py):
 // Puget Sound's and Redwood Coast's own trees and shrubs.
 madrone: 'madrone', garryoak: 'garryoak', bigleafmaple: 'bigleafmaple', pacificdogwood: 'pacificdogwood',
 baylaurel: 'baylaurel', vinemaple: 'vinemaple', oregongrape: 'oregongrape', scotchbroom: 'scotchbroom',
 pacificrhododendron: 'rhododendron', douglasiris: 'douglasiris',
 // The mountain pack (tools/blender/cartoon_mountain.py): the Rockies' own.
 lodgepole: 'lodgepole', bluespruce: 'bluespruce', willowthicket: 'willowthicket', columbine: 'columbine', lupine: 'lupine',
 // The dry-and-lake pack (tools/blender/cartoon_drylake.py).
 ironwood: 'ironwood', jojoba: 'jojoba', sandcherry: 'sandcherry',
 // The Heartland and New England packs.
 americanelm: 'americanelm', shagbark: 'shagbark', buroak: 'buroak', prairieforbs: 'prairieforbs',
 paperbirch: 'paperbirch', whitepine: 'whitepine', balsamfir: 'balsamfir', americanbeech: 'americanbeech',
 // The Keys pack.
 royalpalm: 'royalpalm', travelerspalm: 'travelerspalm', seagrape: 'seagrape', mangrove: 'mangrove',
 gumbolimbo: 'gumbolimbo', banyan: 'banyan', bougainvillea: 'bougainvillea', hibiscus: 'hibiscus',
 // The South's packs.
 // The north and Hawaii.
 redpine: 'redpine', jackpine: 'jackpine', tamarack: 'tamarack', blackspruce: 'blackspruce', sitkaspruce: 'sitkaspruce', shorepine: 'shorepine', fireweed: 'fireweed', devilsclub: 'devilsclub', cottongrass: 'cottongrass', monkeypod: 'monkeypod', casuarina: 'casuarina', cookpine: 'cookpine', ohia: 'ohia', plumeria: 'plumeria', tiplant: 'tiplant', heliconia: 'heliconia',
 // Appalachia and the Northeast parkland.
 rosebay: 'rosebay', mountainlaurelshrub: 'mountainlaurelshrub', flameazalea: 'flameazalea', chestnutoak: 'chestnutoak', shortleafpine: 'shortleafpine', sassafras: 'sassafras', copperbeech: 'copperbeech', pitchpine: 'pitchpine', scruboak: 'scruboak', bayberry: 'bayberry', beachrose: 'beachrose', hydrangea: 'hydrangea',
 // The high desert and the plains.
 // The Badlands pack (cartoon_badlands.py).
 rmjuniper: 'rmjuniper', greenash: 'greenash', chokecherry: 'chokecherry', leadplant: 'leadplant',
 westernjuniper: 'westernjuniper', utahjuniper: 'utahjuniper', pinyonpine: 'pinyonpine', rabbitbrush: 'rabbitbrush', blackbrush: 'blackbrush', cliffrose: 'cliffrose', russianolive: 'russianolive', balsamroot: 'balsamroot', globemallow: 'globemallow', cheatgrass: 'cheatgrass', soapweedyucca: 'soapweedyucca', easternredcedar: 'easternredcedar', buffalograss: 'buffalograss', wildsunflower: 'wildsunflower',
 // California and the western mountains.
 montereycypress: 'montereycypress', montereypine: 'montereypine', coastliveoak: 'coastliveoak', eucalyptus: 'eucalyptus', sycamore: 'sycamore', torreypine: 'torreypine', iceplant: 'iceplant', coastalsage: 'coastalsage', chaparral: 'chaparral', valleyoak: 'valleyoak', blueoak: 'blueoak', buckeye: 'buckeye', grapevine: 'grapevine', californiapoppy: 'californiapoppy', olivetree: 'olivetree', jacaranda: 'jacaranda', peppertree: 'peppertree', ponderosa: 'ponderosa', sugarpine: 'sugarpine', incensecedar: 'incensecedar', redfir: 'redfir', noblefir: 'noblefir', westernlarch: 'westernlarch', manzanita: 'manzanita', gambeloak: 'gambeloak', mountainmahogany: 'mountainmahogany', bitterbrush: 'bitterbrush', mulesear: 'mulesear', beargrass: 'beargrass',
 // Texas and the deserts.
 afghanpine: 'afghanpine', africansumac: 'africansumac', pampasgrass: 'pampasgrass',
 ashejuniper: 'ashejuniper', postoak: 'postoak', pecan: 'pecan', cedarelm: 'cedarelm', osageorange: 'osageorange', mountainlaurel: 'mountainlaurel', redbud: 'redbud', bluebonnet: 'bluebonnet', joshuatree: 'joshuatree', mojaveyucca: 'mojaveyucca', fanpalm: 'fanpalm', datepalm: 'datepalm', aleppopine: 'aleppopine', oleander: 'oleander', tamarisk: 'tamarisk', smoketree: 'smoketree', soaptreeyucca: 'soaptreeyucca', sotol: 'sotol', lechuguilla: 'lechuguilla', desertwillow: 'desertwillow', emoryoak: 'emoryoak', alligatorjuniper: 'alligatorjuniper', beavertail: 'beavertail',
 longleafpine: 'longleafpine', loblollypine: 'loblollypine', slashpine: 'slashpine', cabbagepalm: 'cabbagepalm', sawpalmetto: 'sawpalmetto', longleafgrass: 'longleafgrass', wiregrass: 'wiregrass', liveoak: 'liveoak', liveoakmoss: 'liveoakmoss', turkeyoak: 'turkeyoak', blackjackoak: 'blackjackoak', baldcypress: 'baldcypress', cypressknees: 'cypressknees', watertupelo: 'watertupelo', floweringdogwood: 'floweringdogwood', azalea: 'azalea', magnolia: 'magnolia', tulippoplar: 'tulippoplar', crapemyrtle: 'crapemyrtle', kudzu: 'kudzu', sweetgum: 'sweetgum', yaupon: 'yaupon', spartina: 'spartina', sawgrass: 'sawgrass', muhlygrass: 'muhlygrass', waxmyrtle: 'waxmyrtle', citrustree: 'citrustree',
};
