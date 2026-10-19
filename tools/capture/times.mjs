// EVERY LANDSCAPE AT FOUR TIMES OF DAY (18 October 2026, for the 1.0 website):
// morning, noon, golden hour and night with the floodlights on, each a pure
// course picture -- no interface, no ball, no aim line -- from ONE camera per
// landscape, so the four pictures of a landscape line up and differ only in the
// light. A time of day is a sun height (capture.mjs hourFor), not a clock time.
//
// Drawn at 7680x4320 (a 3840x2160 page at density 2, Ultra) and halved to a
// 3840x2160 PNG master, with 2560 and 960 JPEGs for the website:
//   bench/shots/media/times/<landscape>-<time>.png / .jpg / -thumb.jpg
// (or under $MEDIA_OUT/times/). Not committed; the owner picks what goes on the
// website.
//
// Needs the capture build first: node tools/capture/build-hooked.mjs
//   node tools/capture/times.mjs [landscape...]   (no names: all nine)
// One landscape (four pictures) is about a minute on the graphics card; run a
// few at a time with a pause between (docs/CAPTURE.md, *GPU batches*).
import {launch, openGame, assertUltra, saveStill, HIDE_HUD, hourFor, hideBallAndAim, gpuGate} from './capture.mjs';

const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/times`;
const behind = {fromPin: 70, around: 170, height: 22, pitch: -14};
const tee = h => ({hole: h, along: 0, height: 9, look: 'pin', pitch: -6});
// One camera per landscape: the seeds and views of the gallery's best-liked
// pictures (gallery.mjs), so a landscape looks the same as it always has.
// Midwest, Island and Giant Redwood were moved after the first set (18 October
// 2026): a tree filled the Midwest frame, a palm frond and trunk crowded the
// Island one, and the Giant Redwood tee looked at a hillside. Their views were
// picked from angles.mjs's test sheets.
export const LANDSCAPES = [
 {name: 'pacific-northwest', biome: 'pnw', seed: 'CEDAR', hole: 1, cam: behind},
 {name: 'desert', biome: 'desert', seed: 'MESA', hole: 1, cam: behind},
 {name: 'mountain', biome: 'mountain', seed: 'SUMMIT', hole: 1, cam: tee(1)},
 {name: 'links', biome: 'links', seed: 'DUNE', hole: 1, cam: behind},
 {name: 'midwest', biome: 'midwest', seed: 'MEADOW', hole: 3, cam: behind},
 {name: 'island', biome: 'island', seed: 'LAGOON', hole: 1, cam: {...behind, around: 130}},
 {name: 'giant-redwood', biome: 'redwood', seed: 'GIANT', hole: 1, cam: {...behind, around: 210}},
 {name: 'autumn', biome: 'autumn', seed: 'MAPLE', hole: 1, cam: behind},
 {name: 'haunted-hollow', biome: 'haunted', seed: 'GLOAMING', hole: 1, cam: behind},
];
// Night: 10 PM, the floodlights on (they light the fairway and green; the
// glow ball is hidden with the rest).
export const TIMES = [
 {name: 'morning', when: 'morning'},
 {name: 'noon', when: 'noon'},
 {name: 'golden', when: 'golden'},
 {name: 'night', hour: 22, flood: true},
];

const want = process.argv.slice(2);
const list = LANDSCAPES.filter(l => !want.length || want.includes(l.name));
if (want.length && list.length !== want.length) throw Error(`unknown landscape in: ${want.join(' ')} (known: ${LANDSCAPES.map(l => l.name).join(' ')})`);
const b = await launch();
try {
 for (const l of list) {
  console.log(`${l.name}: card ${gpuGate()}% before`);
  const p = await openGame(b, {width: 3840, height: 2160, density: 2});
  await p.evaluate(c => window.lab.course(c), {biome: l.biome, holes: 9, seed: l.seed});
  await p.evaluate(h => window.lab.hole(h), l.hole);
  await p.waitForTimeout(8000);
  await p.addStyleTag({content: HIDE_HUD});
  for (const t of TIMES) {
   await p.evaluate(([cam, at, flood]) => {
    const v = window.__view; v.daylight.hour = at; v.daylight.rate = 0;
    v.setFloodlights(!!flood);
    window.lab.camera(cam);
   }, [l.cam, t.hour ?? hourFor(l.biome, t.when), !!t.flood]);
   await hideBallAndAim(p);
   // The light settles (the sky, the shadows, the lamps warming up).
   await p.waitForTimeout(t.flood ? 5000 : 3500);
   await assertUltra(p);
   console.log('  ' + await saveStill(p, `${OUT}/${l.name}-${t.name}`), p.errors.length ? p.errors.slice(0, 2) : '');
  }
  await p.context().close();
 }
} finally { await b.close(); }
