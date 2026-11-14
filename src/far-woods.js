// WHAT IS LEFT OF THE FAR WOODS. This file held the far woods' sites: crowns
// and groves of a few triangles from the property line to the landscape's
// edge (the polish goal, 26 October 2026), each seated on the ground as drawn
// (the far-landscape goal). The surroundings rework (12 November 2026)
// replaced them with the course's own trees -- surround.js, which plants them,
// and far-trees.js, which draws the far ones (the owner: "the 'tree domes' we
// added look way out of place").
//
// What remains is the shapes the water mirror's twins are built from
// (vegetation.js farWoodGeometry, water-mirror.js).

// THE SHAPES, as vegetation.js builds them: each flat-based at its origin, its
// base a disc `foot` wide (in units of the crown's radius) and `tall` high.
// vegetation.js scales its geometry by these; tests hold the two together.
// `scale` is the instance's width and height in units of the radius; `foot`
// and `tall` are measured from the built shapes (tests/surround.test.mjs).
// `tilt` was whether the far woods leaned a shape with the ground under it.
export const FAR_SHAPES = {
 cluster: {foot: 1.01, tall: 1.01, scale: [1, .85], tilt: false}, // three lumps, a broadleaf crown
 spruce: {foot: .8, tall: 3.38, scale: [.8, 3.4], tilt: false},   // two stacked tiers
 dome: {foot: .86, tall: .5, scale: [1, .42], tilt: true},         // a grove of broadleaves
 cone: {foot: .55, tall: 2, scale: [.55, 2], tilt: false},         // a grove of conifers
 snags: {foot: .75, tall: 1.6, scale: [1, 1.6], tilt: false},      // dead trunks
 scrub: {foot: 1.01, tall: .54, scale: [1, .45], tilt: false},     // low clumps
};
