// Door 1 end to end (the course builder, stage 3): grow a course in the
// builder, take it over, shape and paint it, save the file, and play it in
// the built game. Registered by tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

// The game: a built file handed in, the course played, one tee shot taken.
// Door 2's journey plays its course the same way.
export async function playOneShot(t, bytes, name) {
 const {ROOT, SHOTS} = t;
 const game = await t.context.newPage();
 const errors = [];
 game.on('pageerror', e => errors.push(e.message)); game.on('console', m => m.type() === 'error' && errors.push(m.text()));
 game.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) errors.push('request ' + r.url()); });
 await game.goto(pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href);
 await game.waitForFunction(() => window.lab && !document.getElementById('splash'), null, {timeout: 120000});
 // The file goes over as one base64 string, decoded in the page: as an array
 // of numbers (`[...bytes]`) a real course's file (Worthington's, tens of
 // megabytes) ran the harness's Node out of memory (builder-ux, 10 November
 // 2026).
 const hash = await game.evaluate(s => { const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return window.lab.built(b); }, Buffer.from(bytes).toString('base64'));
 await game.evaluate(h => window.lab.course({built: h}), hash);
 await game.waitForFunction(() => document.getElementById('app').dataset.mode === 'play', null, {timeout: 120000});
 // One tee shot, the way a keyboard player takes one (tools/smoke.mjs swing):
 // three taps of Space on the Swing Meter, then Enter to skip the flight.
 await game.waitForFunction(() => window.lab.state().canSwing, null, {timeout: 60000});
 const from = await game.evaluate(() => window.lab.state().ballAt);
 await game.keyboard.press('Space'); await game.waitForTimeout(800); await game.keyboard.press('Space'); await game.waitForTimeout(300); await game.keyboard.press('Space');
 await game.waitForFunction(() => window.lab.state().inFlight, null, {timeout: 10000});
 await game.keyboard.press('Enter');
 await game.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 60000});
 const to = await game.evaluate(() => window.lab.state().ballAt);
 if (Math.hypot(to.x - from.x, to.z - from.z) < 20) throw Error(`the tee shot went nowhere (${JSON.stringify(from)} -> ${JSON.stringify(to)})`);
 await game.waitForTimeout(1500);
 await game.screenshot({path: path.join(SHOTS, `${name}-game.png`)});
 if (errors.length) throw Error('the game: ' + errors.join('; '));
 await game.close();
}

export default function ({journey, ROOT, SHOTS}) {
 journey('builder-door-1', 'grow a nine, take it over, raise and paint, save it; the game opens the file and a shot is played on it', async t => {
  const {page} = t;
  await page.getByRole('button', {name: /Generate and modify a course/}).click();
  await page.getByRole('button', {name: 'Grow this course'}).first().click();
  await page.waitForSelector('.cb-sheet canvas', {timeout: 120000});
  await t.shot('preview');
  await page.getByRole('button', {name: 'Take it over'}).first().click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
  await page.waitForTimeout(800);
  await t.shot('editor');
  const box = await page.locator('.cb-view canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // Raise the ground with a drag across the middle of the view.
  await page.getByRole('button', {name: 'Raise'}).click();
  const before = await page.evaluate(() => window.fairwayBuilder.editor.editor.state.undo.length);
  await page.mouse.move(cx - 60, cy); await page.mouse.down();
  for (let k = 0; k <= 12; k++) { await page.mouse.move(cx - 60 + k * 10, cy); await page.waitForTimeout(30); }
  await page.mouse.up();
  // Paint sand where the view is centred.
  // The layer chosen, then the one Paint brush (builder-ux: no button per surface).
  await page.locator('.cb-layerpick').selectOption('sand');
  await page.getByRole('button', {name: 'Paint brush', exact: true}).click();
  await page.mouse.move(cx, cy + 40); await page.mouse.down(); await page.mouse.move(cx + 20, cy + 40); await page.mouse.up();
  const after = await page.evaluate(() => window.fairwayBuilder.editor.editor.state.undo.length);
  if (after < before + 2) throw Error(`the raise and the paint should be two undo steps (${before} -> ${after})`);
  await t.shot('edited');
  // Undo the paint, redo it.
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+y');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const file = path.join(SHOTS, 'builder-door-1.fairway');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  if (bytes.length < 100000 || bytes[0] !== 0x50) throw Error(`the saved file is not a built course (${bytes.length} bytes)`);
  await playOneShot(t, bytes, 'builder-door-1');
 });
}
