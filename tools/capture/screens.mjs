// THE 1.0 INTERFACE AT 4K (18 October 2026, for the 1.0 website): every screen
// a visitor should see, with the interface in the picture. The page is
// 1920x1080 at density 2, so the interface is laid out as on a 1080p screen
// and drawn at 3840x2160 -- text and leaning panels as sharp as the course.
//   bench/shots/media/screens/<name>.png (4K master) / .jpg (2560) / -thumb.jpg (960)
// (or under $MEDIA_OUT/screens/). Not committed; the owner picks for the site.
//
// Needs the capture build first: node tools/capture/build-hooked.mjs
//   node tools/capture/screens.mjs [name...]   (no names: all)
// Each screen opens the game afresh (about 15 s on the graphics card). Run a
// handful at a time (docs/CAPTURE.md, *GPU batches*).
import {launch, openGame, saveStill, hourFor, gpuGate} from './capture.mjs';

const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/screens`;
const wait = (p, ms) => p.waitForTimeout(ms);
const click = (p, id) => p.evaluate(i => { const e = document.getElementById(i); if (!e) throw Error('no #' + i); e.click(); }, id);
const step = (p, label) => p.evaluate(l => { const b = [...document.querySelectorAll('#drawer .sx-steps .sx-step')].find(x => x.getAttribute('aria-label') === l || x.textContent.trim().toUpperCase().endsWith(l.toUpperCase())); if (!b) throw Error('no step ' + l); b.click(); }, label);
const pressText = (p, text) => p.getByRole('button', {name: text, exact: true}).filter({visible: true}).first().click({timeout: 15000});
// A course in play, at a time of day, the opening flyover over.
async function round(p, {biome = 'desert', seed = 'MESA', hole = 2, when = 'afternoon', hour = null, group = GROUP} = {}) {
 await p.evaluate(([c, g]) => window.lab.course(c, g), [{biome, holes: 9, seed}, group]);
 await p.evaluate(h => window.lab.hole(h), hole);
 await p.evaluate(at => { const v = window.__view; v.daylight.hour = at; v.daylight.rate = 0; }, hour ?? hourFor(biome, when));
 await wait(p, 9000);
}
const SHOT = {speed: 67, vla: 11.5, hla: .5, spin: 2700, spinAxis: -2};
// The capture golfers (capture.mjs openGame), so the golfer chips name people
// rather than the lab's placeholder 'Bench'.
const GROUP = {players: [{name: 'Alex', profile: 'pfair', team: 'A', hand: 'RH'}, {name: 'Sam', profile: 'psam', team: 'A', hand: 'RH'}, {name: 'Jordan', profile: 'pjo', team: 'B', hand: 'LH'}], mode: 'stroke', tee: 'blue'};
// Range shots as a launch monitor sends them: a wedge, irons, a driver.
const RANGE = [{speed: 45, vla: 26, hla: -1, spin: 8200, spinAxis: 2}, {speed: 52, vla: 19, hla: 1.5, spin: 6400, spinAxis: -3}, {speed: 54, vla: 18, hla: -.5, spin: 6100, spinAxis: 4},
 {speed: 60, vla: 14, hla: 2, spin: 4800, spinAxis: -5}, {speed: 67, vla: 11.5, hla: .5, spin: 2700, spinAxis: -2}, {speed: 69, vla: 12, hla: -2, spin: 2500, spinAxis: 6}];

export const SCREENS = [
 {name: 'main-menu', go: async p => { await wait(p, 2500); }},
 {name: 'play-course', go: async p => { await click(p, 'menuPlay'); await wait(p, 4000); }},
 {name: 'play-golfers', go: async p => { await click(p, 'menuPlay'); await wait(p, 1000); await step(p, 'Golfers'); await wait(p, 800);
  for (let i = 0; i < 2; i++) { await p.evaluate(() => document.querySelector('#drawer [data-add]')?.click()); await wait(p, 500); }
  await wait(p, 1000); }},
 {name: 'play-format', go: async p => { await click(p, 'menuPlay'); await wait(p, 1000); await step(p, 'Format'); await wait(p, 1500); }},
 {name: 'course-of-the-week', go: async p => { await click(p, 'menuWeekly'); await wait(p, 4000); }},
 {name: 'challenges', go: async p => { await click(p, 'menuChallenges'); await wait(p, 3000); }},
 {name: 'endless', go: async p => { await click(p, 'menuEndless'); await wait(p, 5000); }},
 {name: 'saved-courses', go: async p => { await click(p, 'menuCourses'); await wait(p, 3000); }},
 {name: 'profile', go: async p => { await click(p, 'menuProfile'); await wait(p, 2500); }},
 {name: 'locker', go: async p => { await click(p, 'menuProfile'); await wait(p, 1500); await p.evaluate(() => document.querySelector('[data-hub-tab="Locker"]')?.click()); await wait(p, 1500); }},
 {name: 'launch-monitor', go: async p => { await click(p, 'menuMonitor'); await wait(p, 2500); }},
 {name: 'graphics', go: async p => { await click(p, 'menuGraphics'); await wait(p, 2000); }},
 {name: 'round', go: async p => { await round(p); }},
 {name: 'shot-card', go: async p => {
  await round(p);
  await p.evaluate(s => window.__takeShot(s), SHOT);
  await p.waitForFunction(() => document.getElementById('shotCard') && !document.getElementById('shotCard').hidden, null, {timeout: 30000});
  await wait(p, 900);
 }},
 {name: 'big-map', go: async p => { await round(p); await p.keyboard.press('KeyM'); await wait(p, 1500); }},
 {name: 'pause', go: async p => { await round(p); await p.keyboard.press('Escape'); await wait(p, 1200); }},
 {name: 'scorecard', go: async p => { await round(p); await p.keyboard.press('Escape'); await wait(p, 800); await click(p, 'scoreNav'); await wait(p, 1800); }},
 {name: 'night-round', go: async p => { await round(p, {biome: 'links', seed: 'DUNE', hole: 3, hour: 21.5}); await p.evaluate(() => window.__view.setFloodlights(true)); await wait(p, 4000); }},
 // A putt being read (added for the website's greens panel): one golfer, a
 // 7-iron onto Links' 176-yard par 3, then the slope grid and the heat map on.
 // Fails rather than saving if the ball misses the green.
 {name: 'putting', go: async p => {
  await round(p, {biome: 'links', seed: 'DUNE', hole: 3, when: 'afternoon', group: {...GROUP, players: GROUP.players.slice(0, 1)}});
  await p.evaluate(s => window.__takeShot(s), {speed: 54.5, vla: 16.5, hla: 0, spin: 6900, spinAxis: 0});
  await wait(p, 2000);
  await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 30000}); await wait(p, 4000);
  if (!await p.evaluate(() => window.lab.state().camera.onGreen)) throw Error('the tee shot missed the green');
  await p.evaluate(() => { for (const id of ['readSlope', 'readHeat']) document.getElementById(id).click(); });
  await wait(p, 2500);
 }},
 {name: 'haunted-round', go: async p => { await round(p, {biome: 'haunted', seed: 'GLOAMING', hole: 1, hour: 18.6}); }},
 {name: 'driving-range', go: async p => {
  await click(p, 'menuRange'); await wait(p, 1200);
  await pressText(p, 'Open the driving range').catch(async () => { await step(p, 'The range'); await wait(p, 600); await pressText(p, 'Open the driving range'); });
  await wait(p, 9000);
  // The range controls open by themselves on arrival; put them away for the picture.
  await p.keyboard.press('Escape'); await wait(p, 800);
  for (const s of RANGE) {
   await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 30000});
   await p.evaluate(s => window.__takeShot(s), s); await wait(p, 2500);
   await p.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: 30000}); await wait(p, 1500);
  }
  await wait(p, 1500);
 }},
 {name: 'course-studio', go: async p => { await click(p, 'menuStudio'); await wait(p, 3000); }},
 {name: 'course-studio-flight', go: async p => {
  await click(p, 'menuStudio'); await wait(p, 1500);
  await pressText(p, 'Grow this landscape').catch(() => pressText(p, 'Grow this landscapeR'));
  await p.waitForFunction(() => document.getElementById('world')?.dataset.mode === 'studio' && document.getElementById('generating')?.hidden !== false, null, {timeout: 90000});
  await wait(p, 6000);
 }},
];

const want = process.argv.slice(2);
const list = SCREENS.filter(s => !want.length || want.includes(s.name));
if (want.length && list.length !== want.length) throw Error(`unknown screen in: ${want.join(' ')} (known: ${SCREENS.map(s => s.name).join(' ')})`);
const b = await launch();
try {
 for (const s of list) {
  gpuGate(80, 3000);
  const p = await openGame(b, {width: 1920, height: 1080, density: 2});
  try {
   await s.go(p);
   console.log(await saveStill(p, `${OUT}/${s.name}`), p.errors.length ? p.errors.slice(0, 2) : '');
  } catch (e) { console.log(`${s.name}: FAILED ${e.message.split('\n')[0]}`); }
  await p.context().close();
 }
} finally { await b.close(); }
