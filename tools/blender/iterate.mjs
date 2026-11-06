// ONE ITERATION OF A PACK, EVERY MODEL BESIDE ITS PICTURES (the US landscapes
// goal, 2 November 2026; the owner: "All Models need to be iterated on at
// minimum 15 times while comparing to real pictures").
//
//   node tools/blender/iterate.mjs <pack> <round>          build, render, lay out
//   node tools/blender/iterate.mjs <pack> <round> --log <notes.json>
//   ... --season autumn   the pack drawn in a season's colours (FAIRWAY_SEASON; a pack's sheet tints)
//   ... --far             each model's far twin beside it
//        ... and write each model's line for the round into tools/blender/logs/<id>.md
//
// Runs Blender on tools/blender/<pack>.py with the contact sheet on, keeping
// each model's tile (fairway_blender.py, FAIRWAY_TILES), then draws a sheet
// with one row a model: its renders (every variant, no far twins) beside its
// first three reference pictures from the study (docs/studies/us-landscapes/
// photos/models/<id>/, local: the whole plant first, then bark or flower).
// Written to bench/shots/blender/iter/<pack>/r<round>.png, and each model's
// own row to <id>-r<round>.png -- the side-by-side the goal keeps. Which
// models answer to which study id is the pack's `# REFS id=Model,Model ...`
// comment lines.
//
// The notes file is {"<id>": "what was wrong and what changed", ...}; a model
// is not done while its log has fewer than fifteen lines.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {gpuGate, logRun, readCard} from '../gpu-gate.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [pack, roundArg, ...rest] = process.argv.slice(2);
const round = Number(roundArg);
if (!pack || !Number.isInteger(round)) { console.error('usage: node tools/blender/iterate.mjs <pack> <round> [--log notes.json]'); process.exit(2); }
const script = path.join(ROOT, 'tools', 'blender', `${pack}.py`);
const PHOTOS = path.join(ROOT, 'docs', 'studies', 'us-landscapes', 'photos', 'models');
const SHOTS = path.join(ROOT, 'bench', 'shots', 'blender', 'iter', pack);
const LOGS = path.join(ROOT, 'tools', 'blender', 'logs');
const flag = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const season = flag('--season') || 'summer', far = rest.includes('--far');
const tag = `r${String(round).padStart(2, '0')}${season !== 'summer' ? '-' + season : ''}${far ? '-far' : ''}`;

// The pack's references: `# REFS madrone=Blender_Madrone_1,Blender_Madrone_2`.
const refs = {};
for (const line of fs.readFileSync(script, 'utf8').split('\n')) {
 const m = /^# REFS (.+)$/.exec(line.trim());
 if (m) for (const pair of m[1].trim().split(/\s+/)) { const [id, list] = pair.split('='); refs[id] = list.split(','); }
}
if (!Object.keys(refs).length) { console.error(`${pack}.py has no "# REFS id=Model,..." lines`); process.exit(2); }

// The log, first: a round's notes are written before the next render.
const logAt = rest.indexOf('--log');
if (logAt >= 0) {
 const notes = JSON.parse(fs.readFileSync(rest[logAt + 1], 'utf8'));
 fs.mkdirSync(LOGS, {recursive: true});
 for (const [id, text] of Object.entries(notes)) {
  if (!refs[id]) throw Error(`${id} is not in ${pack}'s REFS`);
  const f = path.join(LOGS, `${id}.md`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, `# ${id}: iterations (tools/blender/${pack}.py)\n\nOne line a round: what was wrong beside the reference pictures, and what changed. The side-by-side of each round: bench/shots/blender/iter/${pack}/${id}-r<round>.png (local).\n\n`);
  const lines = fs.readFileSync(f, 'utf8');
  if (lines.includes(`\n- r${round}:`)) throw Error(`${id} already has a line for round ${round}`);
  fs.appendFileSync(f, `- r${round}: ${text.replace(/\s+/g, ' ').trim()}\n`);
 }
 console.log(`logged round ${round} for ${Object.keys(notes).length} models`);
 process.exit(0);
}

function findBlender() {
 if (process.env.BLENDER && fs.existsSync(process.env.BLENDER)) return process.env.BLENDER;
 const base = 'C:/Program Files/Blender Foundation';
 const c = process.platform === 'win32' && fs.existsSync(base) ? fs.readdirSync(base).sort().reverse().map(d => path.join(base, d, 'blender.exe')) : ['/usr/bin/blender', '/Applications/Blender.app/Contents/MacOS/Blender'];
 return c.find(p => fs.existsSync(p)) || 'blender';
}
const tiles = path.join(SHOTS, 'tiles');
fs.rmSync(tiles, {recursive: true, force: true});
fs.mkdirSync(tiles, {recursive: true});
const sheet = path.join(ROOT, 'bench', 'shots', 'blender', `${pack}.png`);
// THROUGH THE GATE (3 November 2026: the PC went down at the eighteenth
// render of a two-hour run of these, back to back, some started with the
// card over 30% busy -- this tool took the lock but never looked at the card
// or logged). Now every render waits, as a capture does (gpu-gate.mjs): at
// least FAIRWAY_GPU_REST minutes (2) since the last graphics job ended, the
// card under 30% busy and 75 °C over 30 s, nobody else's job on it; it holds
// the card (gpu-lock.mjs) until it is done and is logged in
// bench/ab/gpu-runs.jsonl. The goal is FAIRWAY_GPU_GOAL (us-landscapes).
const goal = process.env.FAIRWAY_GPU_GOAL || 'us-landscapes';
const before = gpuGate({goal, cap: Infinity, restMin: +(process.env.FAIRWAY_GPU_REST || 2), utilMax: +(process.env.FAIRWAY_GPU_UTIL || 30), tempMax: 75});
const startedAt = new Date().toISOString();
const run = spawnSync(findBlender(), ['-b', '--factory-startup', '--python', script, '--', path.join(ROOT, 'vendor', `blender-${pack}`), '--render', sheet],
 {encoding: 'utf8', maxBuffer: 64 << 20, env: {...process.env, FAIRWAY_TILES: tiles, FAIRWAY_SEASON: season}});
logRun({goal, what: `blender ${pack} r${round}${season !== 'summer' ? ' ' + season : ''}${far ? ' far' : ''}`, started: startedAt, before, after: readCard()});
const out = `${run.stdout}\n${run.stderr}`.split(/\r?\n/);
for (const l of out) if (/^BUILT|Error|Traceback/.test(l)) console.log(l);
// Blender exits 0 after a Python error in the pack, so a traceback fails too.
if (run.status !== 0 || out.some(l => /^Traceback/.test(l))) { console.error(out.slice(-30).join('\n')); process.exit(run.status || 1); }

// The sheet: a row a model, its renders then its pictures.
const url = f => pathToFileURL(f).href;
const rows = Object.entries(refs).map(([id, models]) => {
 const renders = models.flatMap(m => far ? [m, `${m}_Far`] : [m]).map(m => path.join(tiles, `${m}.png`)).filter(f => fs.existsSync(f));
 const dir = path.join(PHOTOS, id);
 const pics = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort().slice(0, 3).map(f => path.join(dir, f)) : [];
 return {id, renders, pics};
});
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#20262c;color:#eee;font:15px system-ui}
.row{display:flex;gap:6px;align-items:stretch;padding:6px;border-bottom:2px solid #444}
.row h2{writing-mode:vertical-rl;transform:rotate(180deg);margin:0;font-size:15px;width:22px;text-align:center}
.row img{height:300px;width:auto;max-width:420px;object-fit:cover;background:#fff}
.row img.r{width:300px;object-fit:contain}
.sep{width:6px;background:#e0a040}
</style>${rows.map(r => `<div class="row" id="row-${r.id}"><h2>${r.id} · ${tag}</h2>${r.renders.map(f => `<img class="r" src="${url(f)}">`).join('')}<div class="sep"></div>${r.pics.map(f => `<img src="${url(f)}">`).join('')}</div>`).join('')}`;
fs.mkdirSync(SHOTS, {recursive: true});
const page = path.join(SHOTS, 'sheet.html');
fs.writeFileSync(page, html);
const browser = await chromium.launch({args: ['--disable-gpu']});
try {
 const p = await browser.newPage({viewport: {width: 2000, height: 900}});
 await p.goto(url(page));
 await p.waitForLoadState('load');
 await p.screenshot({path: path.join(SHOTS, `${tag}.png`), fullPage: true});
 for (const r of rows) await p.locator(`#row-${r.id}`).screenshot({path: path.join(SHOTS, `${r.id}-${tag}.png`)});
} finally { await browser.close(); }
console.log(`SHEET ${path.relative(ROOT, path.join(SHOTS, `${tag}.png`))} (${rows.length} models)`);
const missing = rows.filter(r => !r.renders.length || !r.pics.length).map(r => r.id);
if (missing.length) console.log(`no render or no pictures for: ${missing.join(', ')}`);
