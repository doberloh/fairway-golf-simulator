import {uiZoom} from './ui-scale.js';
// THE PLAY SCREEN'S MEASURED SPACE.
//
// Until 17 October 2026 every HUD panel moved and resized at all times: a
// title bar to drag, a corner to pull, positions saved per device under
// 'fairway-layout-v2'. The 1.0 interface fixed the layout (the owner's call,
// UI_1_0_PLAN 5.1): the round's pieces sit where the design puts them
// (round-hud.css), and a phone keeps its fixed layout until phase 5. So the
// grips, the drags and the saved places are gone, and a place saved before is
// deleted once rather than left to be read by something later.
//
// What is left is the measuring the default layout always needed: where the
// controls' top edge is, and how far down the weather, the course card and
// the camera strip reach, written onto #world as custom properties the
// stylesheet places other things by (--controls-top, --weather-bottom,
// --weather-w, --card-bottom, --tools-bottom).

const OLD_KEY = 'fairway-layout-v2';

export function createLayout(world) {
 try { localStorage.removeItem(OLD_KEY); } catch {}
 const bottomBars = ['.bottom-area', '#exploreBar', '#dropBar', '#pickBar']
  .map(s => world.querySelector(s)).filter(Boolean);
 const weather = world.querySelector('.weather'), card = world.querySelector('.course-info');
 const tools = world.querySelector('.view-tools');
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
  if (shown(weather)) {
   write('--weather-bottom', (weather.getBoundingClientRect().bottom - top) / z);
   write('--weather-w', weather.offsetWidth);
  }
  if (shown(card)) write('--card-bottom', (card.getBoundingClientRect().bottom - top) / z);
  if (shown(tools)) write('--tools-bottom', (tools.getBoundingClientRect().bottom - top) / z);
 }
 const soon = () => { if (!pending) pending = requestAnimationFrame(measure); };
 const watch = new ResizeObserver(soon);
 for (const el of [world, weather, card, tools, ...bottomBars]) if (el) watch.observe(el);
 measure();
 // Kept so callers need not know the drags are gone; neither has anything left to do.
 return {reset() {}, setVariant() {}};
}
