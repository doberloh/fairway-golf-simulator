// Feature screenshots of the game, interface showing, as
// <name>.jpg (2560x1440) and <name>-thumb.jpg (960x540),
// rendered on Ultra at 3840x2160 (capture.mjs says why).
// Needs the capture build first: node tools/capture/build-hooked.mjs
//   node tools/capture/features.mjs [name...]
import {launch, openGame, assertUltra, save} from './capture.mjs';
// Saves under bench/shots/media/features/ (not committed), or under $MEDIA_OUT/features/.
// Pictures for the website are picked from there and copied into the
// website's own repository by hand, under new names.
const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/features`;
const course = (p, c, hole = 0) => p.evaluate(async ([c, hole]) => { await window.lab.course(c); window.lab.hole(hole); }, [c, hole]).then(() => p.waitForTimeout(7000));
const hour = (p, h, flood) => p.evaluate(([h, flood]) => { const v = window.__view; v.daylight.hour = h; v.daylight.rate = 0; if (flood) v.setFloodlights(true); }, [h, flood]);
const SCENES = {
 // A tilted green read with the grid and its flow, from the putting camera.
 'putting-grid': async p => {
  await course(p, {biome: 'pnw', holes: 9, seed: 'REPORT1', greenDifficulty: 70}, 1);
  await hour(p, 14);
  await p.evaluate(() => { const v = window.__view, pin = v.course.pin; v.config.greenGrid = true; v.config.greenFlow = true; v.config.greenHeat = false; v.setGreenReading(); window.__play({x: pin.x + 7, z: pin.z - 5}); });
  await p.waitForTimeout(2500);
 },
 // Dartboard putting: the rings around the cup, with the putting options open.
 'putting-modes': async p => {
  await course(p, {biome: 'autumn', holes: 9, seed: 'MAPLE'}, 0);
  await hour(p, 15);
  await p.evaluate(() => { const v = window.__view, pin = v.course.pin, tee = v.course.tee || v.course.worldTee; const dx = (tee?.x ?? pin.x) - pin.x, dz = (tee?.z ?? pin.z - 40) - pin.z, d = Math.hypot(dx, dz) || 1; window.__play({x: pin.x + dx / d * 38, z: pin.z + dz / d * 38}); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.getElementById('puttingLabel').click()); await p.waitForTimeout(600);
  await p.selectOption('#puttingMode', 'dartboard'); await p.evaluate(() => document.getElementById('savePutting').click()); await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('puttingLabel').click()); await p.waitForTimeout(1200);
 },
 // A launch-monitor shot landed, its numbers on the shot card.
 'shot-data': async p => {
  await course(p, {biome: 'mountain', holes: 9, seed: 'SUMMIT'}, 0);
  await hour(p, 10.5);
  await p.evaluate(() => window.__takeShot({speed: 52, vla: 16, hla: -.8, spin: 5200, spinAxis: 3}));
  await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 60000});
  await p.waitForTimeout(3000);
 },
 'night-golf': async p => {
  await course(p, {biome: 'links', holes: 9, seed: 'DUNE'}, 2);
  await hour(p, 21.8, true);
  await p.waitForTimeout(4000);
 },
 'course-studio': async p => {
  await p.click('#menuStudio'); await p.waitForTimeout(2500);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Grow this landscape/i.test(b.textContent))?.click());
  await p.waitForFunction(() => !document.querySelector('.loading:not([hidden]), #loading:not([hidden])'), null, {timeout: 60000}).catch(() => {});
  await p.waitForTimeout(25000);
  await hour(p, 11.5);
  await p.evaluate(() => { try { window.lab.camera({hole: 0, along: -30, height: 55, look: 'pin', pitch: -24}); } catch (e) { console.log(e.message); } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Landscape')?.click());
  await p.waitForTimeout(1200);
 },
 'round-setup': async p => {
  await p.click('#menuPlay'); await p.waitForTimeout(1000);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Format & tees/i.test(b.textContent))?.click());
  await p.waitForTimeout(800);
  await p.selectOption('#roundMode', 'scramble').catch(() => {});
  await p.waitForTimeout(800);
 },
 'driving-range': async p => {
  await p.evaluate(() => window.lab.open()); await p.waitForTimeout(7000);
  await hour(p, 16.5);
  const shots = [[120, 16.5, -1, 7000, -3], [123, 16, 1.5, 6800, 4], [118, 17, 0, 7200, 0], [121, 16.5, -2.5, 7100, -6], [119, 15.5, 2.5, 6600, 6]];
  for (const [speed, vla, hla, spin, axis] of shots) {
   await p.evaluate(s => window.lab.strike(s), {speed, vla, hla, spin, axis});
   await p.waitForTimeout(500);
   await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 60000});
   await p.waitForTimeout(1500);
  }
 },
};
const want = process.argv.slice(2);
const b = await launch();
for (const [name, scene] of Object.entries(SCENES).filter(([n]) => !want.length || want.includes(n))) {
 const p = await openGame(b);
 try { await scene(p); } catch (e) { console.log(name, 'FAILED', e.message.split('\n')[0]); }
 await p.addStyleTag({content: '#toast{display:none!important}'});
 await p.waitForTimeout(600);
 await assertUltra(p);
 console.log(name, await save(p, [{file: `${OUT}/${name}.jpg`, width: 2560, quality: .9}, {file: `${OUT}/${name}-thumb.jpg`, width: 960, quality: .85}]), p.errors.length ? p.errors.slice(0, 2) : '');
 await p.context().close();
}
await b.close();
