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
// It is what tools/build-server.mjs compiles with Bun into run_fairway_server,
// the program in each platform's download, with nothing to install; the bundle
// itself ships beside it in server-source/ (the LGPL obligation for Bun's
// JavaScriptCore, and a Node.js route for anyone who prefers one). The server
// finds `Fairway.html` beside itself (PAGE_CANDIDATES in bridge/server.mjs).
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
// The web manifest travels inside the bundle (bridge/server.mjs, readManifest),
// so a phone can add the game to its home screen from the server with nothing
// beside it but the game.
const manifest = fs.readFileSync(path.join(ROOT, 'dist', 'manifest.webmanifest'), 'utf8');
await bundle.write({
 file: OUT,
 format: 'esm',
 banner: `/*! Fairway launch-monitor bridge ${pkg.version ?? ''} -- MIT licence, see LICENSE.
 * Bundles ws ${wsVersion} (MIT); its notice is in THIRD_PARTY_NOTICES.txt.
 * Run: node fairway-bridge.mjs   (Node.js 20 or newer), or run_fairway_server  */
globalThis.__FAIRWAY_MANIFEST__ = ${JSON.stringify(manifest)};`,
});
await bundle.close();
console.log(`dist/fairway-bridge.mjs  ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
