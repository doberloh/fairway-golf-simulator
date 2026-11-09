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
//   node tools/capture/times.mjs [landscape...]   (no names: all fifteen)
// One landscape (four pictures) is about a minute on the graphics card; run a
// few at a time with a pause between (docs/CAPTURE.md, *GPU batches*).
import {launch, openGame, assertUltra, saveStill, HIDE_HUD, hourFor, hideBallAndAim, gpuGate} from './capture.mjs';

const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/times`;
// THE FIFTEEN US GOLF LANDSCAPES (8 November 2026, the website's 0.9.8 rework):
// every one on seed FAIRWAY from the view its own cards in the game use first
// (biome-shots.mjs PICKS; the owner chose those): from 80 m behind hole 1's
// green and 30 m up, looking back down the hole, except where that view had a
// tree in front of the green or, for the Redwood Coast, no golf at all (OWN). The old
// nine (Pacific Northwest, Desert, Midwest, Island ...) went with 0.9.7/0.9.8.
const behind1 = {hole: 0, fromPin: 80, around: 170, height: 30, pitch: -17};
export const LANDSCAPES = [
 ['classic-parkland', 'parkland'], ['southern-pines', 'southpines'], ['lowcountry-gulf', 'lowgulf'],
 ['florida-palms', 'flpalms'], ['hawaiian-resort', 'hiresort'], ['desert-mountain', 'dmountain'],
 ['desert-resort', 'dresort'], ['seaside-links', 'seaside'], ['california-coast', 'calcoast'],
 ['pacific-northwest', 'pacnw'], ['mountain', 'mountains'], ['prairie-sand-hills', 'prairie'],
 ['badlands', 'badlands'], ['northern-woods', 'northwoods'],
].map(([name, biome]) => ({name, biome, seed: 'FAIRWAY', hole: 0, cam: behind1}))
 .concat([{name: 'redwood-coast', biome: 'redwood'}]);
// Where hole 1's view had a tree in front of the green, a view picked from
// angles.mjs's sheets instead (8 November 2026): 70 m out, 22 m up.
const near = (hole, around) => ({hole, cam: {hole, fromPin: 70, around, height: 22, pitch: -14}});
const OWN = {'redwood-coast': near(2, 210), 'pacific-northwest': near(2, 210), 'southern-pines': near(3, 170), 'mountain': near(1, 210)};
for (const l of LANDSCAPES) Object.assign(l, {seed: 'FAIRWAY'}, OWN[l.name] || {});
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
