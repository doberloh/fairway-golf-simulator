// THE LANDSCAPE PICTURES THE GAME CARRIES (the 1.0 polish; docs/UI_POLISH.md,
// *Landscape pictures*): src/shots/<biome>-<n>.webp, taken from the game by
// tools/capture/biome-shots.mjs and inlined into the single file by the build
// (vite.config.js `assetsInlineLimit`), so they work offline from a file
// opened straight from disk. Read only through this module: the glob is the
// bundler's, so nothing that runs in Node imports it.
const files = import.meta.glob('./shots/*.webp', {eager: true, query: '?url', import: 'default'});

// {biome: [url, ...]}, each landscape's pictures in their number order.
export const LANDSCAPE_SHOTS = {};
for (const [path, url] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en', {numeric: true}))) {
 const m = /\/([a-z]+)-(\d+)\.webp$/.exec(path);
 if (m) (LANDSCAPE_SHOTS[m[1]] ??= []).push(url);
}

// One picture of every landscape, for a card that stands for all of them
// (Endless, Surprise me, a new course in the studio): each landscape's first.
export const EVERY_LANDSCAPE = Object.values(LANDSCAPE_SHOTS).map(list => list[0]);
