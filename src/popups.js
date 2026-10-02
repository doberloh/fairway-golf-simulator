import {uiZoom} from './ui-scale.js';
// Tools that stay out on the course.
//
// The bottom sheet is the right shape for setting something up: it is wide, it
// blurs everything behind it, and it expects your whole attention. That is
// exactly wrong for the tools you want *while* playing -- a yardage book, the
// green reading grid, the camera controls. Those belong beside the shot rather
// than on top of it, several can be useful at once, and they have to stay where
// they were put.
//
// So the same panel content renders into one of two hosts. The sheet keeps the
// long, once-per-round forms; anything a golfer reaches for mid-shot opens here
// instead, as a small window that drags anywhere and comes back where it was.
//
// Geometry is stored as fractions of the playing area, never pixels. A popup
// parked beside the flag on a 4K monitor would otherwise be off-screen the next
// time the game opened in a smaller window, or when it went fullscreen.

const KEY = 'fairway-popups-v1';
const MIN_W = 232, MIN_H = 118;
// Enough of the header has to stay on screen to grab the window again.
const GRIP = 74;
const CASCADE = 26;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createPopups(world, {onChange = () => {}} = {}) {
 let saved = {}, top = 30;
 try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
 const live = new Map();
 const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
 const area = () => ({w: world.clientWidth, h: world.clientHeight});

 // Clamping happens on the way in, so a position restored from a larger window
 // and one that was just dragged are held to exactly the same rule.
 function place(p, r) {
  const {w, h} = area();
  r.w = clamp(r.w, MIN_W, Math.max(MIN_W, w - 16));
  r.h = clamp(r.h, MIN_H, Math.max(MIN_H, h - 16));
  r.x = clamp(r.x, GRIP - r.w, w - GRIP);
  r.y = clamp(r.y, 0, Math.max(0, h - 44));
  Object.assign(p.el.style, {left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px'});
  p.rect = r;
  return r;
 }
 function store(p) {
  const {w, h} = area(), r = p.rect;
  saved[p.id] = {x: r.x / w, y: r.y / h, w: r.w / w, h: r.h / h};
  persist();
 }
 // A NEW WINDOW FITS THE SCREEN IT OPENS ON. It used to open 128 px down
 // whatever the height, so on a phone held sideways -- 348 px of playing area --
 // the Tools window ran 250 px off the bottom, and a button down there could
 // only be reached by the browser scrolling the whole playing area to it, which
 // slid every panel up under the top bar.
 const cascade = (size, index) => {
  const {w, h} = area(), step = index * CASCADE;
  const tall = Math.min(size.h, Math.max(MIN_H, h - 16));
  return {x: w - size.w - 92 - step, y: Math.max(8, Math.min(128 + step, h - tall - 8)), w: size.w, h: tall};
 };
 // A popup with nowhere remembered steps off the last one opened, so it never
 // lands exactly on the window it was launched from.
 function initial(id, size) {
  const {w, h} = area(), was = saved[id];
  if (was && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(was[k])))
   return {x: was.x * w, y: was.y * h, w: was.w * w, h: was.h * h};
  return cascade(size, Math.max(0, live.size - 1));
 }
 const raise = p => { p.el.style.zIndex = ++top; };

 function grab(p, handle, resizing) {
  let from = null;
  // The move and release listeners go on the window rather than the handle.
  // Pointer capture is requested too, but it is not what the drag depends on:
  // capture is lost if the element is re-rendered or the browser decides a
  // gesture has started, and a drag that stops tracking halfway leaves a window
  // stuck under the cursor.
  const move = ev => {
   if (!from) return;
   // Screen pixels over the Text size zoom (ui-scale.js): the window's rect is in
   // the app's CSS pixels, the pointer in the screen's.
   const z = uiZoom(), r = {...from.r}, dx = (ev.clientX - from.x) / z, dy = (ev.clientY - from.y) / z;
   if (resizing) { r.w += dx; r.h += dy; } else { r.x += dx; r.y += dy; }
   place(p, r);
  };
  const done = () => {
   if (!from) return;
   from = null; p.el.classList.remove('dragging'); store(p);
   window.removeEventListener('pointermove', move);
   window.removeEventListener('pointerup', done);
   window.removeEventListener('pointercancel', done);
  };
  handle.onpointerdown = ev => {
   if (ev.button) return;
   ev.preventDefault(); raise(p);
   from = {r: {...p.rect}, x: ev.clientX, y: ev.clientY};
   try { handle.setPointerCapture(ev.pointerId); } catch {}
   p.el.classList.add('dragging');
   window.addEventListener('pointermove', move);
   window.addEventListener('pointerup', done);
   window.addEventListener('pointercancel', done);
  };
  // A mouse drag is not the only way anyone moves a window.
  handle.onkeydown = ev => {
   if (!ev.key.startsWith('Arrow')) return;
   ev.preventDefault(); ev.stopPropagation();
   const step = ev.shiftKey ? 1 : 12, r = {...p.rect};
   const dx = ev.key === 'ArrowRight' ? step : ev.key === 'ArrowLeft' ? -step : 0;
   const dy = ev.key === 'ArrowDown' ? step : ev.key === 'ArrowUp' ? -step : 0;
   if (resizing) { r.w += dx; r.h += dy; } else { r.x += dx; r.y += dy; }
   place(p, r); store(p);
  };
 }

 function show(id, {title, render, onClose, width = 328, height = 300} = {}) {
  const already = live.get(id);
  if (already) { raise(already); render?.(already.body); return already; }
  const el = document.createElement('section');
  el.className = 'popup'; el.dataset.popup = id;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title || id);
  el.innerHTML = `<header class="popup-head">`
   + `<button class="popup-move" aria-label="Move ${title || id}"><i data-lucide="grip-horizontal"></i><span>${title || id}</span></button>`
   + `<button class="popup-close" aria-label="Close ${title || id}"><i data-lucide="x"></i></button></header>`
   + `<div class="popup-body"></div><button class="popup-resize" aria-label="Resize ${title || id}"></button>`;
  world.append(el);
  const p = {id, el, body: el.querySelector('.popup-body'), onClose};
  live.set(id, p);
  place(p, initial(id, {w: width, h: height}));
  raise(p);
  el.addEventListener('pointerdown', () => raise(p));
  el.querySelector('.popup-close').onclick = () => hide(id);
  grab(p, el.querySelector('.popup-move'), false);
  grab(p, el.querySelector('.popup-resize'), true);
  render?.(p.body);
  onChange();
  return p;
 }
 function hide(id) {
  const p = live.get(id);
  if (!p) return false;
  // A window may be showing elements it borrowed from the page rather than
  // built. It gets them back before the frame around them is destroyed.
  p.onClose?.(p.body);
  p.el.remove(); live.delete(id); onChange();
  return true;
 }
 function hideAll() { for (const id of [...live.keys()]) hide(id); }
 // Whatever was raised last is what Escape should close.
 function hideTop() {
  let best = null;
  for (const p of live.values()) if (!best || +p.el.style.zIndex > +best.el.style.zIndex) best = p;
  return best ? hide(best.id) : false;
 }
 // A window resize must not strand a popup outside the playing area. And a window
 // that was wholly on screen STAYS wholly on screen: held only to the drag rule
 // (a grip left showing), a window near the right edge kept its position when
 // the area shrank and hung off it with its close button out of reach -- which
 // is what a larger Text size does (ui-scale.js) as well as a smaller browser
 // window. One the player parked half off the edge keeps the drag rule.
 let before = area();
 new ResizeObserver(() => {
  const now = area();
  for (const p of live.values()) {
   const r = {...p.rect}, inside = r.x >= 0 && r.x + r.w <= before.w + .5 && r.y + r.h <= before.h + .5;
   if (inside) { r.w = Math.min(r.w, Math.max(MIN_W, now.w - 16)); r.x = Math.max(0, Math.min(r.x, now.w - r.w)); r.y = Math.max(0, Math.min(r.y, now.h - Math.min(r.h, now.h - 16))); }
   place(p, r);
  }
  before = now;
 }).observe(world);

 return {
  open: show, close: hide, closeAll: hideAll, closeTop: hideTop,
  isOpen: id => live.has(id),
  get count() { return live.size; },
  reset() {
   saved = {}; persist();
   let i = 0;
   for (const p of live.values()) place(p, cascade({w: p.rect.w, h: p.rect.h}, i++));
  },
 };
}
