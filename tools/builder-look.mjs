// A look at the builder's 3D editor on a course file, close up: a picture
// from above a hole's green at a few heights, for judging how sharp the
// surfaces' edges are (docs/COURSE_BUILDER.md, amendment 17). Uses the
// graphics card (run it through tools/gpu-run.mjs on the course-builder
// branch). Pictures to bench/shots/builder-look/ (ignored).
//   node tools/builder-look.mjs <file.fairway> [--hole 1] [--heights 15,40,120]
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const file = args.find(a => a.endsWith('.fairway'));
if (!file) { console.log('usage: node tools/builder-look.mjs <file.fairway> [--hole 1] [--heights 15,40,120]'); process.exit(1); }
const hole = +opt('hole', 1) - 1, heights = opt('heights', '15,40,120').split(',').map(Number);
const OUT = path.join(ROOT, 'bench', 'shots', 'builder-look'); fs.mkdirSync(OUT, {recursive: true});
const browser = await chromium.launch({args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist']});
try {
 const page = await browser.newPage({viewport: {width: 1600, height: 900}});
 page.on('pageerror', e => console.log('pageerror:', e.message));
 await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'builder.html')).href);
 const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: /Open a course file/}).click()]);
 await chooser.setFiles(file);
 await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
 const info = await page.evaluate(() => window.fairwayBuilder.editor.view.texels());
 console.log('surfaces texture:', JSON.stringify(info));
 for (const h of heights) {
  await page.evaluate(([i, h]) => {
   const {editor, view} = window.fairwayBuilder.editor, g = editor.state.holes[i].green, y = editor.height(g.x, g.z);
   view.controls.target.set(g.x, y, g.z); view.camera.position.set(g.x, y + h, g.z + h * .6); view.controls.update();
  }, [hole, h]);
  await page.waitForTimeout(1200);
  const name = `${path.basename(file, '.fairway')}-hole${hole + 1}-${h}m.png`;
  await page.screenshot({path: path.join(OUT, name)});
  console.log('saved', name, JSON.stringify(await page.evaluate(() => window.fairwayBuilder.editor.view.texels().close)));
 }
} finally { await browser.close(); }
