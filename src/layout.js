// Every HUD panel moves and resizes, all the time.
//
// This used to be a MODE. You pressed "Arrange UI", dashed outlines appeared over
// seven panels, you dragged them, you pressed Done. Which meant the answer to
// "can I move this?" was no, until you remembered the mode existed and went
// looking for it -- while the tool windows beside them dragged whenever you felt
// like it. Two behaviours for the same question.
//
// So the handles are live at all times, like a tool window's. Arrange mode is
// gone entirely -- once nothing was gated behind it, a button promising a mode
// you must enter to arrange things was the misconception the change removed.
// What it hosted, Reset, moved to the tools tray beside the other reset.
//
// WHY A GRIP AND NOT THE WHOLE PANEL. These are not inert boxes. The map is
// click-to-aim and drag-to-pan, the shot controls are sliders and a swing
// button, the card is clickable. Making the panel itself draggable would take
// those gestures away from the controls that own them. A tool window solves this
// with a title bar you drag; each panel gets the same thing in miniature.
//
// Geometry is stored as fractions of the playing area, never pixels -- a panel
// parked in a corner on a 4K monitor would otherwise be off-screen the next time
// the game opened in a smaller window.

const sections = [
 ['.course-info', 'Course card'],
 ['.weather', 'Weather'],
 ['.minimap', 'Course map'],
 ['.bottom-area', 'Shot controls'],
 ['.view-tools', 'Tools tray'],
 ['#exploreBar', 'Flight controls'],
];
const KEY = 'fairway-layout-v1';
const MIN_W = 90, MIN_H = 45;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createLayout(world) {
 let saved = {};
 try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
 const entries = sections
  .map(([selector, name]) => ({el: world.querySelector(selector), name, selector}))
  .filter(e => e.el);

 const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
 const area = () => ({w: world.clientWidth, h: world.clientHeight});
 const rect = e => {
  const a = e.el.getBoundingClientRect(), b = world.getBoundingClientRect();
  return {x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height};
 };

 function apply(e, r) {
  const {w, h} = area();
  r.w = clamp(r.w, Math.min(MIN_W, w), w);
  r.h = clamp(r.h, MIN_H, h);
  // A panel cannot be pushed off the playing area entirely: there is nothing on
  // screen to tell you which way to drag it back.
  r.x = clamp(r.x, 0, Math.max(0, w - r.w));
  r.y = clamp(r.y, 0, Math.max(0, h - r.h));
  e.el.classList.add('hud-custom');
  Object.assign(e.el.style, {
   left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px',
   right: 'auto', bottom: 'auto', maxWidth: 'none',
  });
  return r;
 }
 function store(e, r) {
  const {w, h} = area();
  saved[e.selector] = {x: r.x / w, y: r.y / h, w: r.w / w, h: r.h / h};
  persist();
 }

 // Move and release are listened for on the WINDOW, not the handle. Pointer
 // capture is requested as well, but the drag must not depend on it: capture is
 // lost when an element is re-rendered or the browser decides a gesture has
 // started, and a drag that stops tracking halfway leaves a panel stuck under
 // the cursor. The previous version depended on it and did exactly that.
 function grab(e, handle, resizing) {
  let from = null;
  const move = ev => {
   if (!from) return;
   const r = {...from.r}, dx = ev.clientX - from.x, dy = ev.clientY - from.y;
   if (resizing) { r.w += dx; r.h += dy; } else { r.x += dx; r.y += dy; }
   apply(e, r);
  };
  const done = () => {
   if (!from) return;
   from = null;
   e.el.classList.remove('hud-dragging');
   world.classList.remove('hud-arranging');
   store(e, rect(e));
   window.removeEventListener('pointermove', move);
   window.removeEventListener('pointerup', done);
   window.removeEventListener('pointercancel', done);
  };
  handle.onpointerdown = ev => {
   if (ev.button) return;
   ev.preventDefault(); ev.stopPropagation();
   from = {r: rect(e), x: ev.clientX, y: ev.clientY};
   try { handle.setPointerCapture(ev.pointerId); } catch {}
   e.el.classList.add('hud-dragging');
   // While one panel is being dragged every grip shows, so you can see what you
   // are lining it up against.
   world.classList.add('hud-arranging');
   window.addEventListener('pointermove', move);
   window.addEventListener('pointerup', done);
   window.addEventListener('pointercancel', done);
  };
  // A mouse drag is not the only way anyone moves a panel.
  handle.onkeydown = ev => {
   if (!ev.key.startsWith('Arrow')) return;
   ev.preventDefault(); ev.stopPropagation();
   const r = rect(e), step = ev.shiftKey ? 1 : 10;
   const dx = ev.key === 'ArrowRight' ? step : ev.key === 'ArrowLeft' ? -step : 0;
   const dy = ev.key === 'ArrowDown' ? step : ev.key === 'ArrowUp' ? -step : 0;
   if (resizing) { r.w += dx; r.h += dy; } else { r.x += dx; r.y += dy; }
   store(e, apply(e, r));
  };
 }

 for (const e of entries) {
  // INSIDE the panel, not an overlay tracking it from the outside. An overlay
  // has to be re-synced every time the panel changes size on its own -- and
  // these do, constantly: the card grows a line, the result panel fills in --
  // so an always-visible overlay would spend half its life in the wrong place.
  const grip = document.createElement('button');
  grip.type = 'button';
  grip.className = 'hud-grip';
  grip.title = `Move ${e.name}`;
  grip.setAttribute('aria-label', `Move ${e.name}. Arrow keys to nudge.`);
  const size = document.createElement('button');
  size.type = 'button';
  size.className = 'hud-size';
  size.title = `Resize ${e.name}`;
  size.setAttribute('aria-label', `Resize ${e.name}. Arrow keys to adjust.`);
  e.el.append(grip, size);
  grab(e, grip, false);
  grab(e, size, true);

  // THE HANDLES HAVE TO SURVIVE innerHTML. `#shotResult` is rebuilt wholesale on
  // every shot and `#exploreBar` on every mode change, which silently swept the
  // handles away and left exactly those panels unmovable -- the two that are
  // rebuilt most often, so the failure looked intermittent rather than total.
  //
  // Self-healing rather than a re-append at each call site: there are several
  // places that rewrite a panel and more will be added, and the one that forgets
  // is the one nobody notices. Re-appending fires this observer once more, whose
  // check then passes, so it settles rather than looping.
  new MutationObserver(() => {
   if (e.el.contains(grip) && e.el.contains(size)) return;
   e.el.append(grip, size);
  }).observe(e.el, {childList: true});
 }

 function restore() {
  for (const e of entries) {
   const r = saved[e.selector];
   if (r && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k]))) {
    const {w, h} = area();
    apply(e, {x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h});
   }
  }
 }
 function reset() {
  saved = {}; persist();
  for (const e of entries) {
   e.el.classList.remove('hud-custom');
   e.el.removeAttribute('style');
  }
 }
 new ResizeObserver(restore).observe(world);
 restore();
 // Only `reset` is left. There is no arranging MODE to toggle and no editing
 // state to report -- every panel drags and resizes whenever you like, so the
 // answer to "are we arranging?" was permanently yes and every caller asking it
 // has been removed.
 return {reset};
}
