// ENTWINE POINT TILES (EPT): a survey cut into an octree of small LAZ files,
// as USGS publishes all of 3DEP on Amazon's open data (usgs-lidar-public,
// readable by any page). The builder's LIDAR search downloads only the pieces
// over the course (the owner, 1 November 2026: "add the ability to download
// in the builder"). Pure; tests/lidar-ept.test.mjs.
//
//   <root>/ept.json                   the cube, the point count, the map grid
//   <root>/ept-hierarchy/<key>.json   {key: points} for a part of the tree; -1
//                                     where the tree goes on in <key>.json
//   <root>/ept-data/<key>.laz         that node's points
//
// A key is depth-x-y-z; a node's cube is the root's halved `depth` times.
// Every depth holds points (a coarse sample at the top, the rest further
// down), so the full survey over a box is every node meeting it.

const R = 6378137;
// Web Mercator (EPSG 3857, USGS's EPT grid) to degrees and back. Its metres
// are not ground metres -- 1 / cos(latitude) of them a metre -- so points are
// carried to UTM before the land is built (lidar-search.js).
export const mercToLonLat = (x, y) => ({lon: x / R * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI});
export const lonLatToMerc = (lon, lat) => ({x: lon * Math.PI / 180 * R, y: R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))});

// A node's box in the grid's units: [x0, y0, x1, y1].
export function nodeBox(key, cube) {
 const [d, X, Y] = key.split('-').map(Number), size = (cube[3] - cube[0]) / 2 ** d;
 return [cube[0] + X * size, cube[1] + Y * size, cube[0] + (X + 1) * size, cube[1] + (Y + 1) * size];
}
const meets = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// Every node with points meeting `box` ([x0, y0, x1, y1] in the grid's
// units). `hierarchy(key)` gives a part of the tree ({key: count}); it is
// asked for the root's (0-0-0-0) and for each -1 met. Returns
// [{key, points}], and the parts read.
export async function nodesFor(cube, box, hierarchy) {
 const out = [], parts = [];
 const read = async key => {
  const h = await hierarchy(key); parts.push(key);
  for (const [k, n] of Object.entries(h)) {
   if (!meets(nodeBox(k, cube), box)) continue;
   if (n === -1) { if (k !== key) await read(k); }
   else if (n > 0) out.push({key: k, points: n});
  }
 };
 await read('0-0-0-0');
 return {nodes: out.sort((a, b) => a.key.localeCompare(b.key)), parts};
}
