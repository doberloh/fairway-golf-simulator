// `npm run server`: run_fairway_server, the launch-monitor bridge as ONE PROGRAM
// per platform with nothing to install (the owner, 1 October 2026).
//
// The bridge used to ship as `fairway-bridge.mjs` plus a start script, and both
// needed Node.js installed first -- a step that loses people, and everybody who
// downloads Fairway is setting up a launch monitor. Bun compiles the same bundle
// (tools/build-bridge.mjs, dist/fairway-bridge.mjs) into a self-contained
// executable, and cross-compiles every platform from any one of them. What it
// does once running is in bridge/server.mjs (COMPILED): it finds Fairway.html
// beside itself, listens on the home network, and prints where to point a
// browser, a phone and the launch-monitor connector.
//
// THE PROGRAMS ARE UNSIGNED. Windows SmartScreen and macOS Gatekeeper warn the
// first time; the portable README says how to get past each. Signing costs
// money and is a decision for when there are users.
//
// LICENCES. Bun is MIT, and it statically links JavaScriptCore, which is LGPL-2.
// What this project does about that is written up in DISTRIBUTION_REVIEW.md
// (*run_fairway_server*): the notices ship in THIRD_PARTY_NOTICES.txt, and the
// plain bundle the executable was built from ships beside it, so anyone can
// rebuild the program with a Bun of their own.
//
// The targets are Bun's own names. Output: release/server/<platform>/. The macOS
// programs come out ad-hoc signed (checked: both carry LC_CODE_SIGNATURE), which
// Apple Silicon needs before it will run anything at all.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(ROOT, 'dist', 'fairway-bridge.mjs');
const BUN = path.join(ROOT, 'node_modules', 'bun', 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
export const TARGETS = [
 {platform: 'windows', target: 'bun-windows-x64', file: 'run_fairway_server.exe'},
 {platform: 'macos-apple', target: 'bun-darwin-arm64', file: 'run_fairway_server'},
 {platform: 'macos-intel', target: 'bun-darwin-x64', file: 'run_fairway_server'},
 {platform: 'linux', target: 'bun-linux-x64', file: 'run_fairway_server'},
];

if (!fs.existsSync(BUNDLE)) { console.error('No dist/fairway-bridge.mjs. Run npm run build first.'); process.exit(1); }
const only = process.argv.slice(2);
for (const t of TARGETS.filter(t => !only.length || only.includes(t.platform))) {
 const out = path.join(ROOT, 'release', 'server', t.platform, t.file);
 fs.mkdirSync(path.dirname(out), {recursive: true});
 const run = spawnSync(BUN, ['build', '--compile', `--target=${t.target}`, BUNDLE, '--outfile', out], {cwd: ROOT, stdio: 'inherit'});
 if (run.status !== 0) { console.error(`Building ${t.platform} failed.`); process.exit(run.status || 1); }
 console.log(`${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
}
