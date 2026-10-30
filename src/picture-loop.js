// THE LANDSCAPE PICTURES ON THE CARDS (the 1.0 polish, 27 October 2026;
// docs/UI_POLISH.md, *Landscape pictures*). They replace the tiny turning
// course models (model-cards.js, removed): each card shows real pictures of
// its landscape, taken from the game at Ultra (tools/capture/biome-shots.mjs),
// one after another with a slow cross-fade.
//
// What it costs, since the goal allows none: no WebGL and no canvas -- an
// <img> per picture, faded by opacity alone (the compositor's job, no layout
// or paint), on ONE timer for every card on the page that stops when no card
// is left. A card holds only the picture on show and the next one; the rest
// are not decoded until their turn. Reduced motion (the system setting) holds
// each card on its first picture.
//
// The schedule is pure (`nextIndex`, `startIndex`), so tests/picture-loop.test.mjs
// checks it in Node; `createPictureLoop` is the DOM side.

// PLACED: long enough to look at a picture, short enough that a card does not
// sit still; the fade is the transition in ui-sheets.css (`.pic-loop>img`).
export const HOLD_MS = 5200;
export const FADE_MS = 1400;
// The shortest time between two cards changing (PLACED): one fade at a time,
// and the decode and fade of a card's next picture rare enough not to show in
// the frame measurements (at 1.6 s apart they showed as processor spikes on
// Play's first step on Ultra).
export const TICK_MIN_MS = 3000;

export const nextIndex = (i, n) => (n > 0 ? (i + 1) % n : 0);
// Where a card starts in its landscape's pictures: from its own key, so two
// cards of one landscape side by side do not show the same picture, and the
// same card starts on the same picture every time it is drawn.
export function startIndex(key, n) {
 if (!(n > 0)) return 0;
 let h = 2166136261;
 for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
 return h % n;
}

// `pictures(item)` is the list of picture URLs for one card item (main.js:
// a saved course's own picture first, then its landscape's).
export function createPictureLoop({pictures, still = () => false, doc = globalThis.document, win = globalThis} = {}) {
 const loops = new Set();
 let timer = 0, turn = 0;
 const img = (url, alt = '') => { const e = doc.createElement('img'); e.src = url; e.alt = alt; e.decoding = 'async'; e.draggable = false; return e; };
 // ONE CARD AT A TIME (the 1.0 polish, the frame measurements): every card
 // changing together -- the studio's ten landscapes -- was ten pictures
 // decoded and ten fades in one moment, and the studio's setup measured slower
 // on Ultra's processor than main's in three runs of four. Each tick moves the
 // next card that can be seen, in turn; with few cards a tick comes every
 // HOLD_MS + FADE_MS as before, with many, often enough that a card still
 // changes every few seconds (TICK_MIN apart at the least).
 function tick() {
  const all = [...loops];
  for (const l of all) if (!l.box.isConnected) loops.delete(l);
  if (!loops.size) { win.clearInterval(timer); timer = 0; return; }
  if (still()) return;
  const list = [...loops];
  for (let k = 0; k < list.length; k++) {
   const l = list[(turn + k) % list.length];
   if (l.urls.length < 2) continue;
   // Only a card that can be seen moves on.
   const r = l.box.getBoundingClientRect();
   if (!r.width || r.bottom < 0 || r.top > (win.innerHeight || 0)) continue;
   turn = (turn + k + 1) % list.length;
   l.at = nextIndex(l.at, l.urls.length);
   const shown = l.box.querySelector('img.on');
   const next = img(l.urls[l.at]);
   l.box.append(next);
   // On the next frame, so the new picture starts at opacity 0 and fades.
   win.requestAnimationFrame(() => { next.classList.add('on'); shown?.classList.remove('on'); });
   // The one that faded out goes once its fade is over: a card holds two at most.
   if (shown) win.setTimeout(() => { if (!shown.classList.contains('on')) shown.remove(); }, FADE_MS + 200);
   return;
  }
 }
 const period = () => Math.max(TICK_MIN_MS, Math.round((HOLD_MS + FADE_MS) / Math.max(1, loops.size)));
 const restart = () => { if (timer) win.clearInterval(timer); timer = loops.size ? win.setInterval(tick, period()) : 0; };
 // `items`: [{el, key, ...}] -- the card's picture box and what pictures() needs.
 function queue(items) {
  for (const it of items) {
   const urls = pictures(it) || [];
   if (!it.el || !urls.length) continue;
   for (const l of loops) if (l.el === it.el) loops.delete(l);
   it.el.querySelector(':scope>.pic-loop')?.remove();
   const box = doc.createElement('span');
   box.className = 'pic-loop';
   box.setAttribute('aria-hidden', 'true');
   const at = startIndex(it.key ?? urls[0], urls.length);
   const first = img(urls[at]);
   first.className = 'on';
   box.append(first);
   it.el.append(box);
   loops.add({el: it.el, box, urls, at});
  }
  restart();
 }
 return {queue, tick, get size() { return loops.size; }};
}
