// The editor's tools through its own buttons and the mouse (the course
// builder, stage 5): an outline filled, a pond and a creek drawn, a bunker
// dug, trees planted and cleared, a green moved, the checks and a test round
// run, Undo pressed; the file saved and read back in Node, where each change
// is in it. Registered by tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';
import {fixture, openFile} from './shaping.mjs';

export default function ({journey, SHOTS}) {
 journey('builder-tools', 'every editor tool by its button and the mouse; checks and a test round report; the saved file holds each change', async t => {
  const {page} = t;
  await openFile(page, await fixture(SHOTS));
  const state = () => page.evaluate(() => { const s = window.fairwayBuilder.editor.editor.state; return {water: s.water.length, creeks: s.creeks.length, trees: s.trees.length, undo: s.undo.length, green: s.holes[0].green, edited: s.surfacesEdited}; });
  await page.getByRole('button', {name: 'From above'}).click();
  await page.waitForTimeout(600);
  const b = await page.locator('.cb-view canvas').boundingBox();
  const at = (fx, fy) => [b.x + b.width * fx, b.y + b.height * fy];
  const click = async (fx, fy, opts) => { const [x, y] = at(fx, fy); await page.mouse.click(x, y, opts); await page.waitForTimeout(120); };
  const s0 = await state();
  // An outline of semi-rough: four corners, Enter.
  await page.locator('.cb-group', {hasText: 'Outline'}).getByRole('button', {name: 'Semi', exact: true}).click();
  for (const [fx, fy] of [[.30, .30], [.36, .30], [.36, .36], [.30, .36]]) await click(fx, fy);
  await page.keyboard.press('Enter');
  // A pond: four corners and Enter.
  await page.getByRole('button', {name: 'Draw a pond'}).click();
  for (const [fx, fy] of [[.62, .62], [.68, .62], [.68, .68], [.62, .68]]) await click(fx, fy);
  await page.keyboard.press('Enter');
  // A creek: three points and Enter.
  await page.getByRole('button', {name: 'Draw a creek'}).click();
  for (const [fx, fy] of [[.42, .20], [.45, .30], [.48, .40]]) await click(fx, fy);
  await page.keyboard.press('Enter');
  // A bunker.
  await page.getByRole('button', {name: 'Dig a bunker'}).click();
  await click(.55, .45);
  // Trees: plant two, then clear around one.
  await page.getByRole('button', {name: 'Place tree'}).click();
  // Place tree refuses turf, sand, water, a path or a road (editing.js treeFits,
  // since 4 November 2026), and this course's ground under a fixed spot changes
  // with it: click round the plan until two have stood.
  const trees0 = (await state()).trees; let planted = 0;
  // Only spots over the open plan: the tool column covers the left 15% and
  // the course panel the right 19% (a click at 12% across once ticked the
  // LIDAR's tree sizes and replanted 29 trees; builder-ux, 10 November 2026).
  for (const [fx, fy] of [[.25, .70], [.27, .74], [.18, .82], [.78, .18], [.30, .15], [.70, .88], [.75, .35], [.40, .85], [.60, .12], [.22, .50], [.76, .50], [.50, .92], [.35, .60], [.65, .25], [.45, .78], [.55, .55]]) { if (planted === 2) break; await click(fx, fy); planted = (await state()).trees - trees0; }
  if (planted !== 2) throw Error(`Place tree stood ${planted} of 2 anywhere on the plan`);
  await page.getByRole('button', {name: 'Clear trees', exact: true}).click();
  await click(.25, .70);
  // Hole 1's green, moved.
  await page.getByRole('button', {name: 'Green', exact: true}).last().click();
  await click(.5, .5);
  const s1 = await state();
  console.log(`       ${JSON.stringify(s0)}\n       ${JSON.stringify(s1)}`);
  if (s1.water !== s0.water + 1) throw Error('the pond was not added');
  if (s1.creeks !== s0.creeks + 1) throw Error('the creek was not added');
  if (!s1.edited) throw Error('the outline and bunker painted nothing');
  if (s1.trees === s0.trees) throw Error('planting and clearing changed no trees');
  if (s1.green.x === s0.green.x) throw Error('the green did not move');
  if (s1.undo < s0.undo + 7) throw Error(`each tool should be an undo step (${s0.undo} -> ${s1.undo})`);
  await t.shot('tools');
  // Undo the green, then the checks and a test round.
  await page.getByRole('button', {name: 'Undo'}).click();
  if ((await state()).green.x !== s0.green.x) throw Error('Undo did not put the green back');
  // Select shape: a bunker dug in the open (no tree over it) clicked to select
  // it, then dragged aside, whole; Undo puts it back. (One under a tree's crown
  // selects the tree: the tool takes what is on top.)
  // The spot: the first on screen with no tree or house over it, not water.
  const look = (fx, fy) => page.evaluate(([cx, cy]) => { const c = window.fairwayBuilder.editor; const p = c.view.pick({clientX: cx, clientY: cy}); return p ? {kind: c.editor.surfaceAt(p.x, p.z), top: c.editor.pickAt({x: p.x, z: p.z})?.type ?? null} : null; }, at(fx, fy));
  let spot = null;
  for (const fy of [.5, .55, .6, .65, .7, .45]) for (const fx of [.5, .45, .55, .4, .6]) { if (spot) break; const l = await look(fx, fy); if (l && l.top !== 'tree' && l.top !== 'home' && l.kind !== 'water') spot = [fx, fy]; }
  if (!spot) { const seen = []; for (const fy of [.5, .6, .7]) for (const fx of [.4, .5, .6]) seen.push(JSON.stringify(await look(fx, fy))); throw Error('no open ground on screen to dig a bunker in: ' + seen.join(' ')); }
  await page.getByRole('button', {name: 'Dig a bunker'}).click();
  await click(...spot);
  const kindUnder = (fx, fy) => look(fx, fy).then(l => l?.kind);
  if (await kindUnder(...spot) !== 'sand') throw Error(`the dug bunker should be sand: ${await kindUnder(...spot)}`);
  await page.getByRole('button', {name: 'Select shape'}).click();
  await click(...spot);
  const u0 = (await state()).undo;
  await page.mouse.move(...at(...spot)); await page.mouse.down(); await page.mouse.move(...at(spot[0] + .08, spot[1]), {steps: 6}); await page.mouse.up();
  const moved = {undo: (await state()).undo - u0, under: await kindUnder(...spot), last: await page.evaluate(() => window.fairwayBuilder.editor.editor.state.undo.at(-1)?.kind)};
  if (moved.undo !== 1 || moved.under === 'sand' || moved.last !== 'paint') throw Error(`Select shape should carry the bunker off its spot in one step: ${JSON.stringify(moved)}`);
  await page.getByRole('button', {name: 'Undo'}).click();
  if (await kindUnder(...spot) !== 'sand') throw Error('Undo should put the bunker back');
  await page.getByRole('button', {name: 'Check the course'}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.cb-side li')].some(li => /Hole|Nothing breaks|tree/.test(li.textContent)), null, {timeout: 30000});
  await page.getByRole('button', {name: 'Play a test round'}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.cb-side li')].some(li => /on average against par/.test(li.textContent)), null, {timeout: 120000});
  const report = await page.evaluate(() => [...document.querySelectorAll('.cb-side li')].map(li => li.textContent).filter(t => /par/.test(t)).slice(0, 3));
  console.log(`       ${report.join(' | ')}`);
  await t.shot('reports');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const saved = path.join(SHOTS, 'builder-tools-saved.fairway');
  await download.saveAs(saved);
  const {readBuiltFile} = await import('../../src/course-doc.js');
  const doc = await readBuiltFile(new Uint8Array(fs.readFileSync(saved)));
  if (doc.creeks.length !== s1.creeks || doc.water.length < s1.water) throw Error(`the file lost water: ${doc.creeks.length} creeks, ${doc.water.length} ponds`);
  if (!doc.surfaces.sand.length || !doc.landEdits.length) throw Error('the file lost the bunker or the shaped ground');
 });
}
