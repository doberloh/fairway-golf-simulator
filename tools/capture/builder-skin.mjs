// SKIN FROM THE LAND, PRESSED IN THE REAL BUILDER ON A REAL COURSE (the US
// landscapes goal, 3 November 2026; docs/CAPTURE.md). Opens a .fairway in
// dist/builder.html (npm run build first), presses the editor's own button,
// and takes the picture before, after, close up on the steepest country, after
// Undo and after Redo; then erases a patch with the Layers list's Erase and
// the mouse. It says what the button painted, and fails on a page error or if
// Undo or Redo does not put the layers back exactly.
//
//   node tools/capture/builder-skin.mjs <file.fairway> [--bare] [--game] [--label name]
//
// --bare takes the file's painted ground (rock, scree, hardpan, waste, native,
// heather) off first, for a course that was built skinned (Bully Pulpit).
// --game then opens the skinned course in the capture build (node
// tools/capture/build-hooked.mjs) and looks at the same spot there.
// Pictures to bench/shots/builder-skin/<label>/ (git-ignored). Uses the
// graphics card: through tools/gpu-run.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch, openGame, HIDE_HUD, hideBallAndAim} from './capture.mjs';
import {readBuiltFile, writeBuiltFile, validateDoc} from '../../src/course-doc.js';
import {createEditor} from '../../src/builder/editing.js';
import {BIOMES} from '../../src/biomes.js';
import {BUILT_VERSION} from '../../src/settings-schema.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const source = args.find(a => a.endsWith('.fairway'));
if (!source) { console.log('usage: node tools/capture/builder-skin.mjs <file.fairway> [--bare] [--label name]'); process.exit(1); }
const label = opt('label', path.basename(source, '.fairway').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
const OUT = path.join('bench', 'shots', 'builder-skin', label);
fs.mkdirSync(OUT, {recursive: true});
let file = source;
if (args.includes('--bare')) {
 const doc = await readBuiltFile(fs.readFileSync(source));
 for (const k of ['rock', 'scree', 'hardpan', 'waste', 'native', 'heather']) delete doc.surfaces[k];
 file = path.join(OUT, 'bare.fairway');
 fs.writeFileSync(file, await writeBuiltFile(doc, BUILT_VERSION));
}

const b = await launch();
let failed = 0;
try {
 const context = await b.newContext({viewport: {width: 1600, height: 900}});
 await context.addInitScript(() => { window.showSaveFilePicker = undefined; });
 const page = await context.newPage(), errors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => m.type() === 'error' && errors.push(m.text()));
 await page.goto(pathToFileURL(path.resolve('dist/builder.html')).href);
 const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: /Open a course file/}).click()]);
 await chooser.setFiles(file);
 await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
 await page.getByRole('button', {name: 'From above'}).click();
 await page.waitForTimeout(1500);
 const shot = async name => { await page.waitForTimeout(1400); await page.screenshot({path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 85}); console.log(`  ${name}`); };
 // Each layer's cells, and how many undo steps the editor holds.
 const counts = () => page.evaluate(() => { const s = window.fairwayBuilder.editor.editor.state, o = {};
  for (const [k, m] of s.raster.layers.masks) o[k] = m.reduce((t, v) => t + v, 0);
  return {layers: o, undo: s.undo.length, cell: s.raster.cell, nx: s.raster.nx, nz: s.raster.nz}; });
 const fail = why => { failed++; console.log(`  FAIL: ${why}`); };
 // Equal cell for cell in count; a layer left empty after Undo counts as absent.
 const same = (x, y) => [...new Set([...Object.keys(x.layers), ...Object.keys(y.layers)])].every(k => (x.layers[k] ?? 0) === (y.layers[k] ?? 0));
 const c0 = await counts();
 console.log(`${label}: land ${c0.nx} by ${c0.nz} at ${c0.cell} m`);
 await shot('1-before');
 const t0 = Date.now();
 await page.getByRole('button', {name: 'Skin from the land'}).click();
 await page.waitForFunction(() => /Skinned from the land|Nothing here is steep/.test(document.querySelector('.cb-status')?.textContent || ''), null, {timeout: 120000});
 const ms = Date.now() - t0, said = await page.locator('.cb-status').textContent(), c1 = await counts();
 console.log(`  pressed: ${ms} ms; "${said}"`);
 const ha = n => (n * c0.cell ** 2 / 1e4).toFixed(1);
 for (const k of Object.keys(c1.layers)) if (c1.layers[k] !== (c0.layers[k] ?? 0)) console.log(`  ${k}: ${ha(c0.layers[k] ?? 0)} -> ${ha(c1.layers[k])} ha`);
 await shot('2-skinned');
 console.log(`  the Layers list: ${(await page.locator('.cb-layers li').allTextContents()).join(' | ')}`);
 // The steepest country: the 100 m square holding most of the added ground,
 // and a low look across it.
 const spot = await page.evaluate(([was]) => { const s = window.fairwayBuilder.editor.editor.state, r = s.raster, step = Math.max(1, Math.round(100 / r.cell));
  const grid = new Map();
  for (const [k, m] of r.layers.masks) { if (!(['rock', 'coral', 'scree', 'hardpan', 'waste', 'native', 'heather'].includes(k))) continue;
   for (let j = 0; j < r.nz; j += 2) for (let i = 0; i < r.nx; i += 2) if (m[j * r.nx + i]) { const g = Math.floor(j / step) * 1e5 + Math.floor(i / step); grid.set(g, (grid.get(g) || 0) + 1); } }
  let best = 0, at = 0; for (const [g, n] of grid) if (n > best) { best = n; at = g; }
  return {x: r.x0 + (at % 1e5 + .5) * step * r.cell, z: r.z0 + (Math.floor(at / 1e5) + .5) * step * r.cell}; }, [c0.layers]);
 await page.evaluate(({x, z}) => { const {editor, view} = window.fairwayBuilder.editor, y = editor.height(x, z);
  view.controls.target.set(x, y, z); view.camera.position.set(x + 170, y + 150, z + 260); view.controls.update(); }, spot);
 await shot('3-close');
 await page.getByRole('button', {name: 'Undo'}).click();
 const c2 = await counts();
 if (!same(c2, c0) || c2.undo !== c0.undo) fail(`Undo left ${JSON.stringify(c2.layers)} (${c2.undo} steps), before was ${JSON.stringify(c0.layers)} (${c0.undo})`); else console.log('  Undo: the layers back exactly');
 await shot('4-undone');
 await page.getByRole('button', {name: 'Redo'}).click();
 const c3 = await counts();
 if (!same(c3, c1)) fail(`Redo left ${JSON.stringify(c3.layers)}`); else console.log('  Redo: the skin back exactly');
 await shot('5-redone');
 // Painted over by hand: the first skin layer's Erase, dragged across the
 // middle of the view.
 const kind = Object.keys(c1.layers).find(k => c1.layers[k] > (c0.layers[k] ?? 0));
 if (kind) {
  await page.locator(`[data-layer="${kind}"]`).getByRole('button', {name: 'Erase'}).click();
  const box = await page.locator('.cb-view canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx - 150, cy); await page.mouse.down();
  for (let i = 1; i <= 15; i++) { await page.mouse.move(cx - 150 + 20 * i, cy + (i % 2) * 3); await page.waitForTimeout(30); }
  await page.mouse.up();
  const c4 = await counts();
  if (c4.layers[kind] >= c3.layers[kind]) fail(`Erase took nothing off ${kind}`); else console.log(`  Erase: ${kind} ${c3.layers[kind]} -> ${c4.layers[kind]} cells`);
  await shot('6-erased');
 }
 // What the saved course would hold.
 const held = await page.evaluate(async () => { const d = await window.fairwayBuilder.editor.editor.toDoc(); return Object.entries(d.surfaces).filter(([, v]) => v.length).map(([k, v]) => `${k} ${v.reduce((t, p) => t + p.length, 0)} rings`); });
 console.log(`  the course as saved: ${held.join(', ')}`);
 if (errors.length) fail(`page errors: ${errors.slice(0, 3).join(' | ')}`);
 await context.close();
 // The same skin as the game draws it (--game): the button's own code in
 // Node, the file read as Saved courses reads it, two views of the same spot.
 if (args.includes('--game')) {
  const doc = await readBuiltFile(fs.readFileSync(file)), e = createEditor(doc);
  e.skinFromLand({bio: BIOMES[doc.landscape]});
  const bytes = await writeBuiltFile(validateDoc(await e.toDoc()), BUILT_VERSION);
  fs.writeFileSync(path.join(OUT, 'skinned.fairway'), bytes);
  const p = await openGame(b, {width: 1600, height: 900, density: 1, quality: 'high'});
  const hash = await p.evaluate(a => window.lab.built(a), [...bytes]);
  await p.evaluate(h => window.lab.course({built: h}), hash);
  await p.waitForFunction(() => document.getElementById('app').dataset.mode === 'play', null, {timeout: 180000});
  await p.waitForFunction(() => window.lab.state().canSwing, null, {timeout: 60000});
  if (await p.evaluate(() => document.getElementById('welcome')?.hidden === false)) { await p.fill('#welcomeName', 'Tester'); await p.click('#welcomeGo'); }
  await p.addStyleTag({content: HIDE_HUD});
  await hideBallAndAim(p);
  for (const [name, back, height, pitch] of [['7-game-high', 300, 150, -24], ['8-game-low', 180, 40, -13]]) {
   await p.evaluate(({x, z, back, height, pitch}) => { const yaw = Math.atan2(-170, -260), cx = x - Math.sin(yaw) * back, cz = z - Math.cos(yaw) * back;
    window.__view.daylight.rate = 0; window.lab.camera({x: cx, z: cz, yaw: yaw * 180 / Math.PI, height, pitch}); }, {...spot, back, height, pitch});
   await p.waitForTimeout(2500);
   await p.screenshot({path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 85});
   console.log(`  ${name}`);
  }
  if (p.errors.length) fail(`game errors: ${p.errors.slice(0, 3).join(' | ')}`);
  await p.context().close();
 }
} finally { await b.close(); }
console.log(failed ? `${failed} failed` : 'all well');
process.exit(failed ? 1 : 0);
