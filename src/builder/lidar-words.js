// WHAT WENT WRONG READING A LIDAR FILE, IN THE PLAYER'S WORDS (the owner, 21
// November 2026: a 6.2 GB ZIP of West Virginia LIDAR gave three uncaught
// NotReadableErrors in the console and nothing on screen). Pure: door 2
// (door-real.js `readFiles`) shows these in its file list.
// tests/lidar-words.test.mjs.

// zLAS: Esri's own compressed LAS ("Esri Optimized LAS"), which West
// Virginia's LIDAR download tool hands out. Its format is Esri's; Fairway
// reads LAS and LAZ, so it is named, not tried, with the same converters as
// lidar/formats.js `CLOSED.zlas` (COURSE_BUILDER, *Real land: LIDAR*).
export const ZLAS = /\.zlas$/i;
const GB = 2 ** 30;
// The most a browser hands over in one piece (Chrome refuses a file past
// about 2 GB with NotReadableError). PLACED: the line the message changes at.
export const ONE_PIECE = 2 * GB;

// `names`: the zLAS files met. `start`: a sentence of its own (capital first).
export function zlasWords(names, {start = false} = {}) {
 const n = names.length, list = names.slice(0, 3).join(', ') + (n > 3 ? `, and ${n - 3} more` : '');
 const words = `${n === 1 ? 'this is a zLAS file' : `these ${n} files are zLAS`} (${list}): Esri's own compressed LIDAR, which Fairway cannot read. Esri's free LAS Optimizer (no ArcGIS needed) or rapidlasso's LASliberator turns zLAS into ordinary LAS without losing anything; choose those files here. Or search the map for the place: Fairway fetches USGS LIDAR for it itself.`;
 return start ? words[0].toUpperCase() + words.slice(1) : words;
}

// Why a file (or a ZIP) could not be read. `file`: what was being read, for
// its size.
export function readProblem(e, file = null) {
 const unreadable = e?.name === 'NotReadableError' || e?.name === 'NotFoundError' || e instanceof RangeError || /allocation failed|array buffer/i.test(e?.message ?? '');
 if (unreadable) {
  if (file && file.size > ONE_PIECE) return `it is ${(file.size / GB).toFixed(1)} GB, more than a browser will read in one piece. Choose a smaller tile, or search the map for the place: Fairway fetches USGS LIDAR for it itself.`;
  return 'the browser could not read it. If it is still downloading, or was moved or is open in another program, wait and choose it again.';
 }
 return e?.message || String(e);
}
