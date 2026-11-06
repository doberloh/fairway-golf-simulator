// Real-time shaping (the course builder, stage 4): a frozen course opened
// from its file, the brush timed dab by dab, a hill raised where hole 1's
// fairway is, the course saved -- and the hill is in the world the game
// builds from the saved file. Registered by tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';

export async function fixture(SHOTS, name = 'shaping-fixture', settings = {}) {
 const {generateWorld, DEFAULT_COURSE} = await import('../../src/course.js');
 const {freezeWorld} = await import('../../src/freeze.js');
 const {writeBuiltFile} = await import('../../src/course-doc.js');
 const file = path.join(SHOTS, `${name}.fairway`);
 if (!fs.existsSync(file)) fs.writeFileSync(file, await writeBuiltFile(freezeWorld(generateWorld({...DEFAULT_COURSE, seed: 'SHAPING', biome: 'heartland', holes: 9, ...settings}), {name: 'Shaping test'}), 1));
 return file;
}

export async function openFile(page, file) {
 const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: /Open a course file/}).click()]);
 await chooser.setFiles(file);
 await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
}

export default function ({journey, SHOTS}) {
 journey('builder-shaping', 'a built file opened; a brush dab is timed and its ground redrawn; a hill raised, saved, and in the world the game builds from the file', async t => {
  const {page} = t;
  const file = await fixture(SHOTS);
  await openFile(page, file);
  // Where: the middle of hole 1's line, in world metres.
  const at = await page.evaluate(() => { const h = window.fairwayBuilder.editor.editor.state.holes[0], [a, b] = [h.line[0], h.line[h.line.length - 1]]; return {x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2}; });
  // Timing: forty raise dabs along a line, each the model's change plus the
  // view's redraw of the ground it reached, then the frames that follow.
  const timing = await page.evaluate(async p => {
   const {editor, view} = window.fairwayBuilder.editor, g = {}, dabs = [];
   const before = editor.height(p.x, p.z);
   for (let k = 0; k < 40; k++) {
    const t0 = performance.now();
    view.refreshLand(editor.shape({op: 'raise', x: p.x + (k % 8) - 4, z: p.z, radius: 12, strength: .5, group: g}));
    dabs.push(performance.now() - t0);
    await new Promise(r => requestAnimationFrame(r));
   }
   const frames = [];
   let last = performance.now();
   for (let k = 0; k < 30; k++) { await new Promise(r => requestAnimationFrame(r)); const now = performance.now(); frames.push(now - last); last = now; }
   dabs.sort((a, b) => a - b); frames.sort((a, b) => a - b);
   return {before, after: editor.height(p.x, p.z), dabMedian: dabs[20], dabWorst: dabs[39], frameMedian: frames[15], undo: editor.state.undo.length};
  }, at);
  console.log(`       a dab: median ${timing.dabMedian.toFixed(1)} ms, worst ${timing.dabWorst.toFixed(1)} ms; frames after: median ${timing.frameMedian.toFixed(1)} ms; the ground rose ${(timing.after - timing.before).toFixed(2)} m`);
  if (timing.after - timing.before < 3) throw Error(`the hill is ${(timing.after - timing.before).toFixed(2)} m`);
  if (timing.dabMedian > 33) throw Error(`a dab takes ${timing.dabMedian.toFixed(1)} ms: not real time`);
  if (timing.undo !== 1) throw Error(`a drag should be one undo, not ${timing.undo}`);
  await t.shot('hill');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.locator('#cbSave').click()]);
  const saved = path.join(SHOTS, 'builder-shaping-saved.fairway');
  await download.saveAs(saved);
  const {readBuiltFile} = await import('../../src/course-doc.js');
  const {worldFromDoc} = await import('../../src/built-world.js');
  const w = worldFromDoc(await readBuiltFile(new Uint8Array(fs.readFileSync(saved))));
  const played = w.height(at.x, at.z);
  console.log(`       the game's ground there: ${played.toFixed(2)} m (the builder showed ${timing.after.toFixed(2)})`);
  if (Math.abs(played - timing.after) > .15) throw Error(`the game's ground (${played.toFixed(2)}) is not the shaped ground (${timing.after.toFixed(2)})`);
 });
}
