// Door 2 end to end (the course builder, stage 7): a LIDAR survey brought
// in, the land built, nine holes marked by clicking the plan, the auto trace
// run, the course taken into the editor and saved -- and the game plays the
// file. The survey is made here (a LAS 1.2 file, point format 2 with colour,
// a nine-hole parkland in made-up map coordinates), so the journey needs no
// outside data. Registered by tools/builder-smoke.mjs.
import path from 'node:path';
import fs from 'node:fs';
import {playOneShot} from './door-generate.mjs';

const E0 = 400000, N0 = 4800000, W = 420, H = 320;
// Local metres as door 2 lays them: x east of the middle, z south of it.
const HOLES = Array.from({length: 9}, (_, n) => ({x: -160 + n * 40, tee: 120, green: -110}));
export function surfaceAt(x, z) {
 if (Math.hypot(x - 175, z - 10) < 14) return 'water';
 for (const h of HOLES) {
  if (Math.hypot(x - h.x, z - h.green) < 11) return 'green';
  if (Math.hypot(x - h.x - 12, z - h.green - 6) < 4) return 'sand';
  if (Math.abs(x - h.x) < 3 && Math.abs(z - h.tee) < 5) return 'tee';
  if (Math.abs(x - h.x) < 12 && z > h.green + 15 && z < h.tee - 25) return 'fairway';
 }
 return 'rough';
}
export function surveyLas() {
 let s = 3; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
 const COL = {green: [70, 170, 70], fairway: [80, 150, 60], tee: [80, 150, 60], rough: [100, 115, 65], sand: [225, 212, 180]};
 const pts = [];
 for (let n = 0; n <= H; n++) for (let e = 0; e <= W; e++) {
  const x = e - W / 2, z = H / 2 - n, t = surfaceAt(x, z);
  if (t === 'water') continue;
  const mown = t !== 'rough' && t !== 'sand', g = 300 + Math.sin(x / 60) * 2 + Math.cos(z / 45) * 1.5 + (mown ? 0 : (rnd() - .5) * (t === 'sand' ? .2 : .14)) - (t === 'sand' ? .4 : 0);
  pts.push([e, n, g, 2, t === 'sand' ? 44000 : mown ? 52000 : 46000, ...COL[t]]);
  // Trees between the holes.
  if (t === 'rough' && Math.abs(((x + 180) % 40) - 20) < 1 && Math.abs(z % 30) < 1) for (let a = 0; a < 12; a++) pts.push([e + Math.cos(a) * 2, n + Math.sin(a) * 2, g + 11 - a % 3, 5, 20000, 30, 90, 40]);
 }
 const len = 26, head = 227, buf = new ArrayBuffer(head + len * pts.length), v = new DataView(buf), b = new Uint8Array(buf);
 b.set(new TextEncoder().encode('LASF'), 0); b[24] = 1; b[25] = 2; v.setUint16(94, head, true); v.setUint32(96, head, true); b[104] = 2; v.setUint16(105, len, true); v.setUint32(107, pts.length, true);
 for (const k of [131, 139, 147]) v.setFloat64(k, .001, true);
 v.setFloat64(155, E0, true); v.setFloat64(163, N0, true); v.setFloat64(171, 0, true);
 v.setFloat64(179, E0 + W, true); v.setFloat64(187, E0, true); v.setFloat64(195, N0 + H, true); v.setFloat64(203, N0, true); v.setFloat64(211, 320, true); v.setFloat64(219, 290, true);
 pts.forEach(([e, n, z, cls, inten, r, g, bl], i) => { const at = head + i * len;
  v.setInt32(at, Math.round(e / .001), true); v.setInt32(at + 4, Math.round(n / .001), true); v.setInt32(at + 8, Math.round(z / .001), true); v.setUint16(at + 12, inten, true);
  b[at + 14] = 1 | (1 << 3); b[at + 15] = cls; v.setUint16(at + 20, r * 257, true); v.setUint16(at + 22, g * 257, true); v.setUint16(at + 24, bl * 257, true); });
 return new Uint8Array(buf);
}

export default function ({journey, SHOTS}) {
 journey('builder-door-2', 'a LIDAR survey brought in, the land built, nine holes marked on the plan, traced, opened in the editor and saved; the game plays the file', async t => {
  const {page} = t;
  const las = path.join(SHOTS, 'door-2-survey.las');
  fs.writeFileSync(las, surveyLas());
  await page.getByRole('button', {name: /Generate a real life course/}).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: 'Choose LIDAR files'}).click()]);
  await chooser.setFiles(las);
  await page.waitForFunction(() => window.fairwayBuilder.door2?.preview, null, {timeout: 60000});
  await page.getByRole('button', {name: 'Build the land'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.land, null, {timeout: 120000});
  await page.getByRole('button', {name: 'Use the LIDAR\'s own'}).click();
  await t.shot('land');
  // Each hole: its back tee, then its green, clicked on the plan.
  const box = await page.locator('canvas.cb-plan').boundingBox();
  const click = async (x, z) => { const [cx, cy] = await page.evaluate(([x, z]) => window.fairwayBuilder.door2.toCanvas(x, z), [x, z]); await page.mouse.click(box.x + cx * box.width / 900, box.y + cy * box.height / 900); };
  for (const [n, h] of HOLES.entries()) {
   await click(h.x, h.tee); await click(h.x, h.green);
   if (n < 8) await page.getByRole('button', {name: 'Next hole'}).click();
  }
  await page.locator('select').first().selectOption('9');
  const marked = await page.evaluate(() => window.fairwayBuilder.door2.holes.filter(h => h?.green && h.tees.length).length);
  if (marked !== 9) throw Error(`nine holes should be marked, not ${marked}`);
  await page.getByRole('button', {name: 'LIDAR first'}).click();
  await page.waitForFunction(() => window.fairwayBuilder.door2.traced, null, {timeout: 60000});
  // The trace found the greens round the marks.
  const greens = await page.evaluate(() => { const st = window.fairwayBuilder.door2, c = st.traced.codes, L = st.land; let n = 0; for (const h of st.holes) { const i = Math.round((h.green.x + L.halfX) / L.cell), j = Math.round((h.green.z + L.halfZ) / L.cell); if (c[j * L.nx + i] === 4) n++; } return n; });
  if (greens < 9) throw Error(`the trace should find all nine greens at their marks, found ${greens}`);
  await t.shot('traced');
  await page.getByRole('button', {name: 'Open in the editor'}).click();
  await page.waitForFunction(() => window.fairwayBuilder?.editor?.view, null, {timeout: 120000});
  await page.waitForTimeout(800);
  await t.shot('editor');
  const [download] = await Promise.all([page.waitForEvent('download', {timeout: 120000}), page.getByRole('button', {name: 'Save as a .fairway file'}).click()]);
  const file = path.join(SHOTS, 'builder-door-2.fairway');
  await download.saveAs(file);
  const bytes = fs.readFileSync(file);
  if (bytes[0] !== 0x50) throw Error('the saved file is not a built course');
  await playOneShot(t, bytes, 'builder-door-2');
 });
}
