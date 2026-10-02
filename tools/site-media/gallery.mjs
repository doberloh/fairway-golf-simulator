// The website's gallery: each landscape at two times of day, plus floodlit
// nights, interface hidden, into site/media/gallery/ -- 2560x1440 and a 960x540
// thumbnail, rendered on Ultra at 3840x2160 (capture.mjs says why).
// Files are named for the landscape, not the course name it happens to grow.
// Needs the capture build first: node tools/site-media/build-hooked.mjs
//   node tools/site-media/gallery.mjs [name...]     (no names: all of them)
import {launch, openGame, assertUltra, save, HIDE_HUD} from './capture.mjs';

const OUT = 'site/media/gallery';
const behind = {fromPin: 70, around: 170, height: 22, pitch: -14};
const tee = h => ({hole: h, along: 0, height: 9, look: 'pin', pitch: -6});
export const SHOTS = [
 {name: 'pacific-northwest-morning', biome: 'pnw', seed: 'CEDAR', hole: 1, hour: 8.2, cam: behind},
 {name: 'pacific-northwest-golden', biome: 'pnw', seed: 'CEDAR', hole: 3, hour: 17.8, cam: tee(3)},
 {name: 'desert-golden', biome: 'desert', seed: 'MESA', hole: 1, hour: 17.8, cam: behind},
 {name: 'desert-midday', biome: 'desert', seed: 'MESA', hole: 2, hour: 12.6, cam: tee(2)},
 {name: 'mountain-morning', biome: 'mountain', seed: 'SUMMIT', hole: 1, hour: 8.2, cam: tee(1)},
 {name: 'mountain-afternoon', biome: 'mountain', seed: 'SUMMIT', hole: 4, hour: 15.1, cam: {...behind, around: 205, height: 28}},
 {name: 'links-golden', biome: 'links', seed: 'DUNE', hole: 1, hour: 17.8, cam: behind},
 {name: 'links-morning', biome: 'links', seed: 'DUNE', hole: 2, hour: 7.3, cam: tee(2)},
 {name: 'midwest-midday', biome: 'midwest', seed: 'MEADOW', hole: 1, hour: 12.6, cam: behind},
 {name: 'midwest-golden', biome: 'midwest', seed: 'MEADOW', hole: 3, hour: 17.8, cam: tee(3)},
 {name: 'island-afternoon', biome: 'island', seed: 'LAGOON', hole: 1, hour: 16.5, cam: {...behind, around: 150}},
 {name: 'island-morning', biome: 'island', seed: 'LAGOON', hole: 2, hour: 10.5, cam: {hole: 2, along: 18, height: 13, look: 'pin', pitch: -8}},
 {name: 'giant-redwood-morning', biome: 'redwood', seed: 'GIANT', hole: 1, hour: 10.5, cam: tee(1)},
 {name: 'giant-redwood-afternoon', biome: 'redwood', seed: 'GIANT', hole: 2, hour: 16.5, cam: {hole: 2, along: 30, height: 5, look: 'pin', pitch: -3}},
 {name: 'autumn-afternoon', biome: 'autumn', seed: 'MAPLE', hole: 1, hour: 15.1, cam: behind},
 {name: 'autumn-golden', biome: 'autumn', seed: 'MAPLE', hole: 2, hour: 17.8, cam: tee(2)},
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
  const v = window.__view; v.daylight.hour = s.hour; v.daylight.rate = 0;
  if (s.flood) v.setFloodlights(true);
  for (const o of [v.aimLine, v.aimRing, v.ballRing]) if (o) o.visible = false;
  window.lab.camera(s.cam);
 }, [s]);
 await p.waitForTimeout(s.flood ? 4500 : 3000);
 await assertUltra(p);
 console.log(s.name, await save(p, [{file: `${OUT}/${s.name}.jpg`, width: 2560, quality: .88}, {file: `${OUT}/${s.name}-thumb.jpg`, width: 960, quality: .84}]), p.errors.length ? p.errors.slice(0, 2) : '');
 await p.context().close();
}
await b.close();
