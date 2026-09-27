// `npm run build` step two: the launch-monitor bridge as ONE FILE a player can run.
//
// The bridge in the source tree is `bridge/server.mjs`, and it imports `ws` from
// node_modules and the game's own physics from `src/` -- so running it meant
// `npm ci`, which fetches every dependency and all the test tooling, then a
// build. Nothing a player holding the portable archive can be asked to do. This
// bundles the bridge, `ws` and the physics it validates shots with into
// `dist/fairway-bridge.mjs`, which needs nothing but Node.js to run:
//
//   node fairway-bridge.mjs
//
// The portable archive carries it in a "Launch monitor" folder beside start
// scripts for Windows and macOS (bridge/launch/), and the bridge serves the
// `Fairway.html` one folder up (see PAGE_CANDIDATES in bridge/server.mjs).
//
// Rejected, for now: a standalone executable with no Node.js to install. Bun
// can cross-compile one for every platform from here and Node's own
// single-executable support builds per platform; both produce unsigned
// programs that Windows and macOS warn about, and signing costs money. The
// bundle below is what either would be built from, when that is worth it.
import {rolldown} from 'rolldown';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'fairway-bridge.mjs');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const wsVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'ws', 'package.json'), 'utf8')).version;

const bundle = await rolldown({
 input: path.join(ROOT, 'bridge', 'server.mjs'),
 platform: 'node',
 // ws reaches for two optional native speed-ups inside a try; they are never
 // installed here, and bundling their absence is exactly right.
 external: ['bufferutil', 'utf-8-validate'],
 logLevel: 'warn',
});
await bundle.write({
 file: OUT,
 format: 'esm',
 banner: `/*! Fairway launch-monitor bridge ${pkg.version ?? ''} -- MIT licence, see LICENSE.
 * Bundles ws ${wsVersion} (MIT); its notice is in THIRD_PARTY_NOTICES.txt.
 * Run: node fairway-bridge.mjs   (Node.js 20 or newer)  */`,
});
await bundle.close();
console.log(`dist/fairway-bridge.mjs  ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
