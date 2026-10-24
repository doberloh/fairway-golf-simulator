// A SHOWCASE OF ONE LANDSCAPE, as a single self-contained page for the owner.
//
//   node tools/capture/showcase.mjs <biome> <seed> [holes 1,2,3]
//
// Built for Lakeshore Dunes (23 October 2026) and meant for any new biome: a
// few holes at noon and golden hour, the coast if it has one, a close look at
// what is new on its ground, and an overview, all from the capture build
// (run `node tools/capture/build-hooked.mjs` first). It also listens to the
// page the whole time and reports every page error and console error, so a
// look at the pictures is also a check that the landscape builds cleanly.
//
// Writes docs/reports/<biome>-showcase.html (local, never committed: AGENTS.md
// *What stays local*) with every picture inlined, plus the JPEGs under
// bench/shots/showcase/<biome>/. It adds, when they exist: the four 4K stills
// times.mjs made for the landscape (bench/shots/media/times/<name>-*.jpg), the
// Blender contact sheet (bench/shots/blender/<pack>.png), and a notes fragment
// written for this landscape (bench/shots/showcase/<biome>/notes.html).
// About a minute on the graphics card (docs/CAPTURE.md, *GPU batches*).
import fs from 'node:fs';
import path from 'node:path';
import {launch, openGame, save, HIDE_HUD, hourFor, hideBallAndAim, gpuGate} from './capture.mjs';
import {BIOMES} from '../../src/biomes.js';
import {generateWorld} from '../../src/course.js';

const [biome, seed, holesArg = '1,2,3'] = process.argv.slice(2);
if (!biome || !seed || !BIOMES[biome]) throw Error('usage: node tools/capture/showcase.mjs <biome> <seed> [holes]');
const bio = BIOMES[biome];
const SHOTS = path.join('bench', 'shots', 'showcase', biome);
fs.mkdirSync(SHOTS, {recursive: true});
for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.jpg')) fs.rmSync(path.join(SHOTS, f));

// Each view: a file name, a caption, and a camera -- a lab.camera pose, or a
// function of the world run in the page.
const holeViews = hole => [
 {name: `${hole}-noon-behind`, caption: `Hole ${hole} from behind the green, noon`, when: 'noon', cam: {hole: hole - 1, fromPin: 80, around: 170, height: 30, pitch: -17}},
 {name: `${hole}-golden-side`, caption: `Hole ${hole} from the side, golden hour`, when: 'golden', cam: {hole: hole - 1, fromPin: 95, around: 130, height: 34, pitch: -18}},
 {name: `${hole}-noon-tee`, caption: `Hole ${hole} from above the tee, noon`, when: 'noon', cam: {hole: hole - 1, along: 0, height: 22, look: 'pin', pitch: -9}},
];
// In the page: a view of something found on the ground, or null.
const FIND = {
 // Open sand well outside the corridor and above the beach: a blowout (or,
 // in a biome without them, a bunker -- the caption says which it found).
 blowout: `w => { for (let k = 0; k < 4000; k++) { const x = (Math.sin(k * 12.9898) * .5) * w.halfX * 1.8, z = (Math.sin(k * 78.233) * .5) * w.halfZ * 1.8;
  if (w.surface(x, z) === 'sand' && w.height(x, z) > 2 && w.nearest(x, z).d > 14) return {x: x - 32, z: z - 18, yaw: Math.atan2(32, 18) * 180 / Math.PI, height: 9, pitch: -12}; } return null; }`,
 // A spot on the beach of an edge coast, looking along the shore.
 beach: `w => { if (!w.bio.sea) return null; for (let k = 0; k < 6000; k++) { const x = w.halfX - 260 + ((Math.sin(k * 3.7) + 1) / 2) * 340, z = Math.sin(k * 5.1) * w.halfZ * .8;
  const y = w.height(x, z); if (y > .1 && y < .8 && w.surface(x, z) === 'sand') return {x: x - 14, z: z - 40, yaw: 12, height: 5, pitch: -5}; } return null; }`,
 lake: `w => w.bio.edgeCoast ? {x: w.halfX - 110, z: w.halfZ * .15, yaw: 70, height: 26, pitch: -9} : null`,
 overview: `w => ({x: -w.halfX * .2, z: -w.halfZ * 1.05, yaw: 15, height: 240, pitch: -26})`,
};
const extraViews = [
 {name: 'z-blowout', caption: 'Open sand on a dune, close to', when: 'noon', find: 'blowout'},
 {name: 'z-beach', caption: 'Along the beach', when: 'noon', find: 'beach'},
 {name: 'z-lake', caption: 'Out over the water', when: 'noon', find: 'lake'},
 {name: 'z-overview-noon', caption: 'The whole course, noon', when: 'noon', find: 'overview'},
 {name: 'z-overview-golden', caption: 'The whole course, golden hour', when: 'golden', find: 'overview'},
];

console.log(`card ${gpuGate(80, 1000)}% before`);
const errors = [], shots = [];
const b = await launch();
try {
 const p = await openGame(b, {width: 1600, height: 900, density: 1});
 p.on('pageerror', e => errors.push(`page error: ${e.message}`));
 p.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
 await p.evaluate(c => window.lab.course(c), {biome, holes: 9, seed});
 for (const hole of holesArg.split(',').map(Number)) {
  await p.evaluate(h => window.lab.hole(h), hole - 1);
  await p.waitForTimeout(5000);
  await p.addStyleTag({content: HIDE_HUD});
  for (const v of holeViews(hole)) {
   const cam = typeof v.cam === 'function' ? null : v.cam;
   await p.evaluate(([cam, at, src]) => { const view = window.__view; view.daylight.hour = at; view.daylight.rate = 0;
    window.lab.camera(src ? (0, eval)(src)(view.world) : cam); }, [cam, hourFor(biome, v.when), typeof v.cam === 'function' ? v.cam.toString() : null]);
   await hideBallAndAim(p);
   await p.waitForTimeout(1000);
   const file = path.join(SHOTS, `${v.name}.jpg`);
   await save(p, [{file, width: 1600, quality: .86}]);
   shots.push({file, caption: v.caption});
  }
 }
 for (const v of extraViews) {
  const ok = await p.evaluate(([at, src]) => { const view = window.__view; view.daylight.hour = at; view.daylight.rate = 0;
   const c = (0, eval)(src)(view.world); if (!c) return false; window.lab.camera(c); return true; }, [hourFor(biome, v.when), FIND[v.find]]);
  if (!ok) continue;
  await hideBallAndAim(p);
  await p.waitForTimeout(1500);
  const file = path.join(SHOTS, `${v.name}.jpg`);
  await save(p, [{file, width: 1600, quality: .86}]);
  shots.push({file, caption: v.caption});
 }
} finally { await b.close(); }

// Facts from the generator itself, in Node: what the course is made of.
const w = generateWorld({seed, biome, holes: 9, trees: 60, homes: true});
const shares = {};
let n = 0;
for (let x = -w.halfX; x < w.halfX; x += 6) for (let z = -w.halfZ; z < w.halfZ; z += 6) { const s = w.surface(x, z); shares[s] = (shares[s] || 0) + 1; n++; }
const plants = {};
for (const t of w.trees) plants[t.kind] = (plants[t.kind] || 0) + 1;

const inline = file => `data:image/${file.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(file).toString('base64')}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// times.mjs's name for this landscape, read from its table as text: importing
// it would run its own capture.
const row = fs.readFileSync(path.join('tools', 'capture', 'times.mjs'), 'utf8').split(/\r?\n/).find(l => l.includes(`biome: '${biome}'`));
const name = row && (row.match(/name: '([a-z-]+)'/) || [])[1];
const hero = name ? ['morning', 'noon', 'golden', 'night'].map(t => path.join('bench', 'shots', 'media', 'times', `${name}-${t}.jpg`)).filter(f => fs.existsSync(f)) : [];
const sheets = fs.existsSync(path.join('bench', 'shots', 'blender')) ? fs.readdirSync(path.join('bench', 'shots', 'blender')).filter(f => f.endsWith('.png')).map(f => path.join('bench', 'shots', 'blender', f)) : [];
const notesFile = path.join(SHOTS, 'notes.html');
const notes = fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8') : '';
const swatch = (label, c) => `<span class="sw"><i style="background:${c}"></i>${label} <code>${c}</code></span>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(bio.name)} showcase</title>
<style>
:root{--bg:#f6f4ee;--ink:#1d2219;--soft:#5d6656;--card:#fff;--line:#dcd8cc;--accent:#0e7490}
@media (prefers-color-scheme:dark){:root{--bg:#141712;--ink:#e8ebe2;--soft:#a7b09e;--card:#1d211a;--line:#333a2d;--accent:#7dd3fc}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:2.2rem;margin:.2em 0 0}h2{margin-top:2.2em;border-bottom:1px solid var(--line);padding-bottom:.3em}
.tag{color:var(--soft);font-size:1.15rem;margin:.2em 0 1.2em}
figure{margin:0 0 18px;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
figure img{display:block;width:100%;height:auto}figcaption{padding:8px 12px;color:var(--soft);font-size:.92rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.facts div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.sw{display:inline-flex;align-items:center;gap:6px;margin:0 14px 6px 0}.sw i{width:18px;height:18px;border-radius:4px;border:1px solid var(--line);display:inline-block}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line)}
code{font-size:.88em}.ok{color:#2f8a3a}.bad{color:#c0392b}
</style></head><body><main>
<p class="tag" style="margin:0">Fairway landscape showcase · seed <code>${esc(seed)}</code> · ${new Date().toISOString().slice(0, 10)}</p>
<h1>${esc(bio.name)}: ${esc(bio.title)}</h1>
<p class="tag">${esc(bio.tag)}</p>
${hero.length ? `<h2>Four times of day (4K, times.mjs)</h2><div class="grid">${hero.map(f => `<figure><img src="${inline(f)}" alt=""><figcaption>${esc(path.basename(f, '.jpg'))}</figcaption></figure>`).join('')}</div>` : ''}
${notes ? `<h2>What it is</h2>${notes}` : ''}
<h2>The course</h2>
<div class="grid">${shots.map(s => `<figure><img src="${inline(s.file)}" alt="${esc(s.caption)}"><figcaption>${esc(s.caption)}</figcaption></figure>`).join('')}</div>
${sheets.length ? `<h2>Models built in Blender</h2>${sheets.map(f => `<figure><img src="${inline(f)}" alt=""><figcaption>${esc(path.basename(f))}: each model beside a 1.8 m post</figcaption></figure>`).join('')}` : ''}
<h2>From the generator (seed ${esc(seed)}, nine holes)</h2>
<div class="facts">
<div><b>Ground</b><table>${Object.entries(shares).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${k}</td><td>${(100 * v / n).toFixed(1)}%</td></tr>`).join('')}</table></div>
<div><b>Plants (${w.trees.length})</b><table>${Object.entries(plants).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table></div>
<div><b>Palette</b><br>${['rough', 'semi', 'fairway', 'fringe', 'green', 'sand', 'water', 'sky', 'tree'].map(k => swatch(k, bio[k])).join('')}
<p>Altitude ${bio.altitude} m · ${bio.temperature} °C · sun ${bio.sun}</p></div>
</div>
<h2>Page health while capturing</h2>
${errors.length ? `<p class="bad">${errors.length} error(s):</p><ul>${errors.map(e => `<li><code>${esc(e)}</code></li>`).join('')}</ul>` : '<p class="ok">No page error and no console error while the course built and every view was taken.</p>'}
</main></body></html>`;
const out = path.join('docs', 'reports', `${biome}-showcase.html`);
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, html);
console.log(`${out}: ${shots.length} views, ${hero.length} 4K stills, ${sheets.length} sheet(s), ${errors.length} error(s), ${(html.length / 1048576).toFixed(1)} MB`);
