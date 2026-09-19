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
 'fern', 'swordfern', 'gorse', 'heather', 'agave', 'naupaka', 'shrub',
]);

// Has no trunk worth colliding with. The ground plants, plus the ocotillo:
// tall, but a handful of canes with gaps a ball goes straight through.
export const NO_TRUNK = new Set([...GROUND_PLANTS, 'ocotillo']);
