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
 'mountainlaurel', 'bluebonnet', 'mojaveyucca', 'oleander', 'sotol', 'lechuguilla', 'beavertail',
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
const CROWN_FRACTION = {redwood: .095, fir: .17, hemlock: .17, redcedar: .19};
export const crownFraction = kind => CROWN_FRACTION[kind] || 0;
export const crownRadius = tree => CROWN_FRACTION[tree.kind] ? CROWN_FRACTION[tree.kind] * tree.h : tree.r;

// Has no trunk worth colliding with. The ground plants, plus the ocotillo:
// tall, but a handful of canes with gaps a ball goes straight through.
export const NO_TRUNK = new Set([...GROUND_PLANTS, 'ocotillo']);
