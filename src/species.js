// What a plant species IS, independently of which biome grows it.
//
// These two lists were written out by hand in course.js and physics.js, and
// they are not the same list -- an ocotillo is tall enough to size like a tree
// and too spindly to stop a ball. Keeping them as two named sets says that on
// purpose, where two similar array literals in different files said nothing.
//
// The file imports nothing, so physics can read it without pulling in three.

// Grows to knee or shoulder height rather than to a canopy, and is sized as
// ground cover rather than as a tree.
// Ground cover sized by its SPREAD rather than its height (model families,
// mesh-assets.js FAMILY_OF). A sword fern is a low clump about a metre and a
// half across and its fronds reach further sideways than up, so scaling it to
// t.h the way a tree is scaled gives a ten-metre bush. The dune grass and the
// creeping juniper (built in Blender) join them: a beachgrass patch is two to
// five metres across and under a metre tall. The cartoon overhaul's low, wide
// shrubs too: a heather mat is half a metre tall and two across, so sized by
// its height it came out metres wide. vegetation.js draws by it; tree-seat.js
// seats by it.
// THE STEEPEST GROUND A GROUND COVER GROWS ON, as a gradient: 40 degrees
// (the polish goal's floating trees, round 3; PLACED). tree-seat.js lays a
// cover along a slope up to this and seats it against it; past it -- a cliff
// face -- the generator plants none (course.js, the stands and their
// understory), because no seat could hold a fern on a wall.
export const COVER_STEEPEST = Math.tan(40 * Math.PI / 180);

export const SPREAD_SIZED = new Set(['swordfern', 'salal', 'sorrel', 'fern', 'dunegrass', 'juniper', 'heatherbush', 'naupakabush', 'fernbush', 'agaveplant']);

export const GROUND_PLANTS = new Set([
 'fern', 'swordfern', 'salal', 'sorrel', 'gorse', 'heather', 'agave',
 'naupaka', 'shrub', 'dunegrass', 'juniper', 'commonjuniper', 'cholla',
 'creosote', 'brittlebush', 'sagebrush', 'bracken', 'huckleberry',
 // The US landscapes goal's Pacific pack: shrubs and a flower.
 'vinemaple', 'oregongrape', 'scotchbroom', 'pacificrhododendron', 'douglasiris',
 // ... and the mountain pack's.
 'willowthicket', 'columbine', 'lupine',
 // ... and the dry-and-lake pack's.
 'jojoba', 'sandcherry',
 // ... and the Heartland's.
 'prairieforbs',
 // ... and the Keys' shrubs.
 'seagrape', 'bougainvillea', 'hibiscus',
 // ... the north's and Hawaii's.
 'fireweed', 'devilsclub', 'cottongrass', 'tiplant', 'heliconia',
 // ... Appalachia's and the Northeast parkland's.
 'rosebay', 'mountainlaurelshrub', 'flameazalea', 'scruboak', 'bayberry', 'beachrose', 'hydrangea',
 // ... the high desert's and the plains'.
 // ... the Badlands'.
 'chokecherry', 'leadplant',
 'rabbitbrush', 'blackbrush', 'cliffrose', 'balsamroot', 'globemallow', 'cheatgrass', 'soapweedyucca', 'buffalograss', 'wildsunflower',
 // ... California's and the western mountains'.
 'iceplant', 'coastalsage', 'chaparral', 'grapevine', 'californiapoppy', 'manzanita', 'bitterbrush', 'mulesear', 'beargrass',
 // ... Texas's and the deserts'.
 'pampasgrass', 'mountainlaurel', 'bluebonnet', 'mojaveyucca', 'oleander', 'sotol', 'lechuguilla', 'beavertail',
 // ... and the South's.
 'sawpalmetto', 'longleafgrass', 'wiregrass', 'cypressknees', 'azalea', 'yaupon', 'spartina', 'sawgrass', 'muhlygrass', 'waxmyrtle',
]);

// How wide a species' crown is, as a fraction of its own height. Only the
// tall conifers state it: everything else is drawn from a whole model and
// carries its spread in `t.r`.
//
// It lives here because TWO things need the same answer -- vegetation draws the
// crown this wide, and the generator has to leave room for it when it decides
// where a tree may stand. The version where only the drawing knew put 380-foot
// redwoods a median 8.6 m apart with 20 m crowns, so the median tree's canopy
// overlapped its neighbour's by 42% and the worst trunks intersected by 5 m.
// Measured off the grown models rather than guessed: a giant redwood comes
// out 19% as wide as it is tall, a douglas fir 34%, a cedar 37%. Halve for a
// half-width. Broadleaves are absent on purpose -- they carry their spread in
// `t.r` like every other pack model.
const CROWN_FRACTION = {redwood: .13, youngredwood: .165, fir: .17, hemlock: .17, redcedar: .19};
export const crownFraction = kind => CROWN_FRACTION[kind] || 0;
export const crownRadius = tree => CROWN_FRACTION[tree.kind] ? CROWN_FRACTION[tree.kind] * tree.h : tree.r;

// Has no trunk worth colliding with. The ground plants, plus the ocotillo:
// tall, but a handful of canes with gaps a ball goes straight through.
export const NO_TRUNK = new Set([...GROUND_PLANTS, 'ocotillo']);

// THE KEYS' TREES (the study's specs, PLACED within them): heights h0-h1 m
// and crown radius r0-r1 m.
export const TREE_SIZE={royalpalm:[15,21,3,4.5],travelerspalm:[6,9,2.5,3.5],mangrove:[4,7,3,4],gumbolimbo:[8,13,4,6],banyan:[14,20,10,15],
 // The north's and Hawaii's (PLACED within their specs).
 redpine:[20,28,4,6],jackpine:[10,16,3.5,5],tamarack:[12,18,3,4],blackspruce:[6,12,1,1.6],sitkaspruce:[30,45,6,8],shorepine:[8,12,3.5,5],monkeypod:[13,20,12,17],casuarina:[16,26,5,7],cookpine:[28,42,3,4.5],ohia:[7,12,3.5,5],plumeria:[4.5,7,2.5,3.5],
 // Appalachia's and the Northeast parkland's (PLACED within their specs).
 chestnutoak:[18,26,7,10],shortleafpine:[20,28,4,6],sassafras:[8,13,3,4.5],copperbeech:[18,26,9,12],pitchpine:[9,16,4,6],
 // Southern Pines' (tools/meshy/southern.json; PLACED from each tree's usual form).
 southloblolly:[24,32,4,5.5],southlongleaf:[24,32,4,5.5],southwhitepine:[22,32,4,5.5],southdogwood:[5,9,2.5,3.5],
 // Classic Parkland's (tools/meshy/parkland.json; PLACED from each tree's usual
 // forest-grown form, taller and narrower than the hand-built hardwoods).
 whiteoak:[20,28,6,8],pinoak:[17,24,5,6],parkmaple:[18,26,4.5,6],parkpoplar:[26,36,4,5.5],parkelm:[24,30,8,9],norwayspruce:[22,32,3.5,4.5],
 // The high desert's and the plains' (PLACED within their specs).
 // The Badlands' (Rocky Mountain juniper 4.6-6.1 m in open woodland; green ash
 // 12-25 m, in a draw 8-15, crowns PLACED).
 rmjuniper:[4.5,7,1.2,2.2],greenash:[8,15,4,6],
 westernjuniper:[6,10,4,5.5],utahjuniper:[3.5,6,2.5,3.5],pinyonpine:[4,8,3,4.5],russianolive:[6,9,3.5,5],easternredcedar:[5,9,2,3],
 // California's and the western mountains' (PLACED within their specs).
 montereycypress:[10,20,5,9],montereypine:[18,30,5,8],coastliveoak:[10,16,6,9],eucalyptus:[25,40,5,8],sycamore:[15,25,6,9],torreypine:[10,16,5,8],valleyoak:[18,28,9,13],blueoak:[8,14,4,6],buckeye:[5,9,4,6],olivetree:[6,10,3.5,5],jacaranda:[8,14,5,7],peppertree:[8,13,5,7],ponderosa:[25,40,5,8],sugarpine:[35,55,6,9],incensecedar:[25,40,4,6],redfir:[30,45,4,6],noblefir:[30,50,4,6],westernlarch:[25,40,4,6],gambeloak:[5,10,3,5],mountainmahogany:[3,6,2,3.5],
 // Texas's and the deserts' (PLACED within their specs).
 afghanpine:[10,18,3.5,5],africansumac:[6,10,4,6],ashejuniper:[5,8,3,4.5],postoak:[9,14,4,6],pecan:[22,32,8,12],cedarelm:[11,16,4,6],osageorange:[9,13,4.5,6],redbud:[5,8,3.5,5],joshuatree:[5,9,2,3.5],fanpalm:[14,20,2,3],datepalm:[10,17,3,4.5],aleppopine:[10,15,4.5,6],tamarisk:[4.5,7,2.5,3.5],smoketree:[4,6,2.5,3.5],soaptreeyucca:[3.5,6,1,1.5],desertwillow:[5,8,2.5,4],emoryoak:[7,11,4,5.5],alligatorjuniper:[8,12,4,6],
 // The South's (PLACED within their specs).
 // The Redwood Coast's young redwoods (the owner's Northwood; PLACED, the survey's
 // lower canopy under the 30-75 m of grown trees).
 youngredwood:[12,35,2,6],
 longleafpine:[22,32,4,6],loblollypine:[20,30,5,7],slashpine:[18,26,5,7],cabbagepalm:[9,15,2.5,3.5],liveoak:[12,17,12,16],liveoakmoss:[13,17,12,16],baldcypress:[20,32,4,6],blackjackoak:[6,10,3,4],turkeyoak:[6,10,3,4],watertupelo:[18,26,4,6],magnolia:[14,20,5,7],tulippoplar:[28,40,5,8],sweetgum:[18,28,5,7],floweringdogwood:[5,8,4,5],crapemyrtle:[4,7,2,3],citrustree:[4.5,6.5,2,2.5],kudzu:[9,13,6,8]};
// The tall kinds the table above does not list: [lowest, span] in metres, before
// the landscape's own scale. Anything else stands as the landscape's far canopy.
const OTHER_TALL = {cactus: [4, 5], ocotillo: [2, 3], hala: [5, 5], palo: [5, 6], mesquite: [5, 6], ironwood: [5, 6]};
// How tall a tall kind stands at `a` (0 its shortest, 1 its tallest): the
// generator's height for it, and through both ends the range a surveyed tree is
// matched against (built-world.js `speciesFor`). `scale` is the third number of
// the kind's entry in the landscape's plant list, and does not touch the table.
export function tallHeight(bio, kind, a, scale = 1) {
 const size = TREE_SIZE[kind];
 if (size) return size[0] + a * (size[1] - size[0]);
 const [low, span] = OTHER_TALL[kind] ?? [bio.farCanopy.min, bio.farCanopy.range];
 return (low + a * span) * scale;
}

// KEPT GREEN THROUGH LEAF FALL AND WINTER (vegetation.js). A species that is not
// here and has no season tints of its own turns orange in autumn, so an evergreen
// left off is the bug the owner found on Puget Sound (5 November 2026): its cedars
// turned with the maples. tests/seasons.test.mjs holds every conifer and palm to it.
export const EVERGREEN = new Set(['southloblolly','southlongleaf','southwhitepine','norwayspruce','afghanpine','africansumac','spruce','pine','fir','hemlock','redcedar','redwood','youngredwood','whitepine','balsamfir','lodgepole','bluespruce','juniper','commonjuniper',
 'longleafpine','loblollypine','slashpine','liveoak','liveoakmoss','magnolia','waxmyrtle','yaupon','cabbagepalm','sawpalmetto','citrustree',
 'afghanpine','africansumac','pampasgrass','ashejuniper','mountainlaurel','joshuatree','mojaveyucca','fanpalm','datepalm','aleppopine','oleander','soaptreeyucca','sotol','lechuguilla','emoryoak','alligatorjuniper','beavertail',
 'montereycypress','montereypine','coastliveoak','eucalyptus','torreypine','iceplant','coastalsage','chaparral','olivetree','peppertree',
 'ponderosa','sugarpine','incensecedar','redfir','noblefir','manzanita','mountainmahogany','bitterbrush','beargrass',
 'westernjuniper','utahjuniper','pinyonpine','blackbrush','cliffrose','soapweedyucca','easternredcedar','rmjuniper',
 'rosebay','mountainlaurelshrub','shortleafpine','pitchpine','bayberry',
 'redpine','jackpine','blackspruce','sitkaspruce','shorepine','casuarina','cookpine','ohia','tiplant',
 // Added 5 November 2026: the cedar and the palms that had no tints of their own,
 // the evergreen broadleaves and shrubs that have none, and young conifers.
 'cedar', 'palm', 'hala', 'seedling', 'tanoak', 'swordfern', 'salal', 'naupaka', 'gorse', 'heather', 'sagebrush', 'creosote', 'cactus', 'cholla', 'agave']);

// How much a tree's random lightness may take away: never more than this share
// of the colour's own lightness, so the darkest species cannot reach black.
export const DARKEN_LIMIT = .4;
export const darkenBy = (lightness, offset) => Math.max(offset, -lightness * DARKEN_LIMIT);
