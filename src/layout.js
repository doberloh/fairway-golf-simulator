import {uiZoom} from './ui-scale.js';
// THE PLAY SCREEN'S MEASURED SPACE.
//
// Until 17 October 2026 every HUD panel moved and resized at all times: a
// title bar to drag, a corner to pull, positions saved per device under
// 'fairway-layout-v2'. The 1.0 interface fixed the layout (the owner's call,
// UI_1_0_PLAN 5.1): the round's pieces sit where the design puts them
// (round-hud.css), and a phone keeps its fixed layout until phase 5. So the
// grips, the drags and the saved places are gone, and a place saved before is
// deleted once rather than left to be read by something later. (The map and
// the Tab shot numbers became movable again on 18 October 2026, by their own
// code: hud-places.js and main.js *THE MAP AND THE SHOT NUMBERS MOVE*.)
//
// What is left is the measuring the default layout always needed: where the
// controls' top edge is, written onto #world as --controls-top for the
// stylesheet to place other things by. (The weather, course card and camera
// strip it once also measured went with the old interface, 18 October 2026.)

const OLD_KEY = 'fairway-layout-v2';

export function createLayout(world) {
 try { localStorage.removeItem(OLD_KEY); } catch {}
 const bottomBars = ['.bottom-area', '#exploreBar', '#dropBar', '#pickBar']
  .map(s => world.querySelector(s)).filter(Boolean);
 const written = {};
 const write = (name, px) => {
  const v = Math.round(px) + 'px';
  if (written[name] === v) return;
  written[name] = v;
  world.style.setProperty(name, v);
 };
 const shown = el => el && el.offsetWidth > 0 && el.offsetHeight > 0;
 let pending = 0;
 // SCREEN PIXELS OVER THE ZOOM. A box's on-screen measurements are in screen
 // pixels; the values written are in the app's CSS pixels, which Text size
 // (ui-scale.js) makes `zoom` screen pixels each. At 100% they agree.
 function measure() {
  pending = 0;
  const top = world.getBoundingClientRect().top, h = world.clientHeight, z = uiZoom();
  const bars = bottomBars.filter(shown).map(b => (b.getBoundingClientRect().top - top) / z);
  write('--controls-top', bars.length ? Math.min(...bars) : h - 16);
 }
 const soon = () => { if (!pending) pending = requestAnimationFrame(measure); };
 const watch = new ResizeObserver(soon);
 for (const el of [world, ...bottomBars]) watch.observe(el);
 measure();
 // Kept so callers need not know the drags are gone; neither has anything left to do.
 return {reset() {}, setVariant() {}};
}
