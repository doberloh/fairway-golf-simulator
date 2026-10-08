// A gallery of the landscapes: each at two times of day, plus floodlit
// nights, interface hidden -- 2560x1440 and a 960x540
// thumbnail, rendered on Ultra at 3840x2160 (capture.mjs says why).
// Files are named for the landscape, not the course name it happens to grow.
// Needs the capture build first: node tools/capture/build-hooked.mjs
//   node tools/capture/gallery.mjs [name...]     (no names: all of them)
import {launch, openGame, assertUltra, save, HIDE_HUD, hourFor} from './capture.mjs';

// Saves under bench/shots/media/gallery/ (not committed), or under $MEDIA_OUT/gallery/.
// Pictures for the website are picked from there and copied into the
// website's own repository by hand, under new names.
const OUT = `${process.env.MEDIA_OUT || 'bench/shots/media'}/gallery`;
const behind = {fromPin: 70, around: 170, height: 22, pitch: -14};
const tee = h => ({hole: h, along: 0, height: 9, look: 'pin', pitch: -6});
export const SHOTS = [
 {name: 'pacific-northwest-morning', biome: 'pnw', seed: 'CEDAR', hole: 1, when: 'morning', cam: behind},
 {name: 'pacific-northwest-golden', biome: 'pnw', seed: 'CEDAR', hole: 3, when: 'golden', cam: tee(3)},
 {name: 'desert-golden', biome: 'desert', seed: 'MESA', hole: 1, when: 'golden', cam: behind},
 {name: 'desert-midday', biome: 'desert', seed: 'MESA', hole: 2, when: 'noon', cam: {...behind, around: 190, height: 26}},
 {name: 'mountain-morning', biome: 'mountain', seed: 'SUMMIT', hole: 1, when: 'morning', cam: tee(1)},
 {name: 'mountain-afternoon', biome: 'mountain', seed: 'SUMMIT', hole: 4, when: 'afternoon', cam: {...behind, around: 205, height: 28}},
 {name: 'links-golden', biome: 'links', seed: 'DUNE', hole: 1, when: 'golden', cam: behind},
 {name: 'links-morning', biome: 'links', seed: 'DUNE', hole: 2, when: 'morning', cam: {...behind, around: 160}},
 {name: 'midwest-midday', biome: 'midwest', seed: 'MEADOW', hole: 1, when: 'noon', cam: behind},
 {name: 'midwest-golden', biome: 'midwest', seed: 'MEADOW', hole: 3, when: 'golden', cam: tee(3)},
 {name: 'island-afternoon', biome: 'island', seed: 'LAGOON', hole: 1, when: 'afternoon', cam: {...behind, around: 150}},
 {name: 'island-morning', biome: 'island', seed: 'LAGOON', hole: 2, when: 'morning', cam: {hole: 2, along: 18, height: 13, look: 'pin', pitch: -8}},
 {name: 'giant-redwood-morning', biome: 'redwood', seed: 'GIANT', hole: 1, when: 'morning', cam: tee(1)},
 {name: 'giant-redwood-afternoon', biome: 'redwood', seed: 'GIANT', hole: 2, when: 'afternoon', cam: {hole: 2, along: 30, height: 5, look: 'pin', pitch: -3}},
 {name: 'autumn-afternoon', biome: 'autumn', seed: 'MAPLE', hole: 1, when: 'afternoon', cam: behind},
 {name: 'autumn-golden', biome: 'autumn', seed: 'MAPLE', hole: 2, when: 'golden', cam: tee(2)},
 {name: 'night-links', biome: 'links', seed: 'DUNE', hole: 3, hour: 22, flood: true, cam: {...behind, height: 16}},
 {name: 'night-pacific-northwest', biome: 'pnw', seed: 'CEDAR', hole: 2, hour: 21.5, flood: true, cam: tee(2)},
];
const want = process.argv.slice(2);
const b = await launch();
for (const s of SHOTS.filter(s => !want.length || want.includes(s.name))) {
 const p = await openGame(b);
 await p.evaluate(c => window.lab.course(c), {biome: s.biome, holes: 9, seed: s.seed});
 await p.evaluate(h => window.lab.hole(h), s.hole);
 await p.waitForTimeout(7000);
 await p.addStyleTag({content: HIDE_HUD});
 await p.evaluate(([s]) => {
  const v = window.__view; v.daylight.hour = s.at; v.daylight.rate = 0;
  if (s.flood) v.setFloodlights(true);
  // The ball too: at dusk the glow ball is a bright dot on the tee.
  for (const o of [v.aimLine, v.aimRing, v.ballRing, v.ball, v.ballHalo]) if (o) o.visible = false;
  window.lab.camera(s.cam);
 }, [{...s, at: s.hour ?? hourFor(s.biome, s.when)}]);
 await p.waitForTimeout(s.flood ? 4500 : 3000);
 await assertUltra(p);
 console.log(s.name, await save(p, [{file: `${OUT}/${s.name}.jpg`, width: 2560, quality: .88}, {file: `${OUT}/${s.name}-thumb.jpg`, width: 960, quality: .84}]), p.errors.length ? p.errors.slice(0, 2) : '');
 await p.context().close();
}
await b.close();
