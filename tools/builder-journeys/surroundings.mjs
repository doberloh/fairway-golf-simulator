// The Surroundings block (the surroundings rework, 12 November 2026;
// docs/SURROUNDINGS.md): grow a nine, take it over, choose what stands on
// each side in the editor's right panel, look at it in Game view, save the
// file, read the record back out of it, and play a shot on it in the built
// game -- which draws the sea the course asked for. Registered by
// tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {playOneShot} from './door-generate.mjs';

export default function ({journey, ROOT, SHOTS}) {
 journey('builder-surroundings', 'choose a sea, a mountain, mesas and a lake round a grown nine; Game view shows them; the file keeps them; the game plays it', async t => {
  const {page} = t;
  await page.getByRole('button', {name: /Generate and modify a course/}).click();
  await page.getByRole('button', {name: 'Grow this course'}).first().click();
  await page.waitForSelector('.cb-sheet canvas', {timeout: 120000});
  await page.getByRole('button', {name: 'Take it over'}).first().click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
  await page.waitForTimeout(600);
  // The block is there, each side on the landscape's own.
  const box = page.locator('.cb-surround');
  await box.scrollIntoViewIfNeeded();
  const selects = box.locator('select');
  if (await selects.count() !== 5) throw Error(`the Surroundings block should hold four sides and Trees, found ${await selects.count()} selects`);
  for (let i = 0; i < 4; i++) if (await selects.nth(i).inputValue() !== 'auto') throw Error('a new course starts with every side as the landscape');
  // North a mountain, east the sea, south a lake, west mesas; taller; half wooded.
  for (const [i, kind] of [[0, 'mountain'], [1, 'sea'], [2, 'lake'], [3, 'mesas']]) await selects.nth(i).selectOption(kind);
  await box.locator('input[type=range]').fill('1.4');
  await selects.nth(4).selectOption('0.5');
  const held = await page.evaluate(() => window.fairwayBuilder.editor.editor.state.surround);
  const want = {sides: {n: 'mountain', e: 'sea', s: 'lake', w: 'mesas'}, height: 1.4, cover: .5};
  if (JSON.stringify(held) !== JSON.stringify(want)) throw Error(`the editor holds ${JSON.stringify(held)}, wanted ${JSON.stringify(want)}`);
  await t.shot('panel');
  // Game view builds the course with them, and comes back.
  await page.locator('[data-gameview]').click();
  await page.waitForFunction(() => document.querySelector('[data-gameview]')?.textContent === 'Back to editor', null, {timeout: 240000});
  await page.waitForTimeout(3000);
  await t.shot('game-view');
  await page.locator('[data-gameview]').click();
  await page.waitForFunction(() => document.querySelector('[data-gameview]')?.textContent === 'Game view', null, {timeout: 60000});
  // Saved, and the file says so.
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const file = path.join(SHOTS, 'builder-surroundings.fairway');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  const {readBuiltFile} = await import(pathToFileURL(path.join(ROOT, 'src', 'course-doc.js')).href);
  const doc = await readBuiltFile(new Uint8Array(bytes));
  if (JSON.stringify(doc.surround) !== JSON.stringify(want)) throw Error(`the file holds ${JSON.stringify(doc.surround)}, wanted ${JSON.stringify(want)}`);
  // Set back to the landscape's own, the record leaves the editor.
  for (let i = 0; i < 4; i++) await selects.nth(i).selectOption('auto');
  await box.locator('input[type=range]').fill('1');
  await selects.nth(4).selectOption('');
  if (await page.evaluate(() => window.fairwayBuilder.editor.editor.state.surround) !== null) throw Error('every side back to the landscape should leave no record');
  // And the game plays the saved course, sea and all, with no error.
  await playOneShot(t, bytes, 'builder-surroundings');
 });
}
