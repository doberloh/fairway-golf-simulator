// Runs a Blender-built model pack (docs/BLENDER_ASSETS.md).
//
//   node tools/blender/run.mjs <pack> [--render]
//
// Starts Blender headless on tools/blender/<pack>.py, which writes one .glb
// per model into vendor/blender-<pack>/. With --render it also draws a contact
// sheet of the pack beside a 1.8 m figure, to bench/shots/blender/<pack>.png
// (git-ignored), which is how a model is reviewed before it goes in the game.
// Then run `node tools/build-meshes.mjs` to ingest the pack.
//
// Blender is found from $BLENDER, then the usual install folders. It is not a
// dependency of the game or the build: only remaking these models needs it,
// and the .glb files it wrote are committed, so a clone without Blender still
// builds. One Blender at a time, closed when the pack is written (AGENTS.md,
// the Blender exception to the graphics card rule).
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [pack, ...flags] = process.argv.slice(2);
if (!pack || !existsSync(join(ROOT, 'tools', 'blender', `${pack}.py`))) {
 const packs = readdirSync(join(ROOT, 'tools', 'blender')).filter(f => f.endsWith('.py') && f !== 'fairway_blender.py');
 console.error(`usage: node tools/blender/run.mjs <pack> [--render]\npacks: ${packs.map(p => p.slice(0, -3)).join(', ')}`);
 process.exit(2);
}

function findBlender() {
 if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER;
 const candidates = [];
 if (process.platform === 'win32') {
  const base = 'C:/Program Files/Blender Foundation';
  if (existsSync(base)) for (const d of readdirSync(base).sort().reverse()) candidates.push(join(base, d, 'blender.exe'));
 } else if (process.platform === 'darwin') {
  candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
 } else {
  candidates.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender');
 }
 return candidates.find(existsSync) || 'blender';
}

const out = join(ROOT, 'vendor', `blender-${pack}`);
const args = ['-b', '--factory-startup', '--python', join(ROOT, 'tools', 'blender', `${pack}.py`), '--', out];
if (flags.includes('--render')) {
 const shots = join(ROOT, 'bench', 'shots', 'blender');
 mkdirSync(shots, {recursive: true});
 args.push('--render', join(shots, `${pack}.png`));
}
const blender = findBlender();
const run = spawnSync(blender, args, {encoding: 'utf8', maxBuffer: 64 << 20});
const lines = `${run.stdout}\n${run.stderr}`.split(/\r?\n/);
for (const line of lines) if (/^(BUILT|SHEET)|Error|Traceback/.test(line)) console.log(line);
if (run.status !== 0) {
 console.error(lines.slice(-30).join('\n'));
 process.exit(run.status ?? 1);
}
