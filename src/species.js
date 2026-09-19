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
export const GROUND_PLANTS = new Set([
 'fern', 'swordfern', 'salal', 'sorrel', 'gorse', 'heather', 'agave',
 'naupaka', 'shrub',
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
