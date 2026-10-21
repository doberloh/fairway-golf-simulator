// STEP-BY-STEP SETUP SCREENS (round 13, the owner, 17 October 2026: "multiple
// menus again" -- entering a mode is a sequence of menus clicked through).
//
// One sheet, one step showing at a time: the steps along the top (each
// clickable, to go back to one: done ones ticked, the current one filled),
// the step's content centred in the sheet, and along the foot the keys and
// Back / Next -- on the last step the screen's own main button (Tee off,
// Start...) in Next's place. Play, Endless and any other mode with a setup use
// it (ui-lobby.js, ui-menu-screens.js).
//
// The steps are buttons named by their plain label ("Golfers"), so a player
// reading by ear, and the smoke journeys, can go straight to one.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Which step a sheet should open on, kept inside its bounds. Pure.
// What each step chip shows when step `at` is open: on, done (ticked), missing
// (passed without what it needs: numbered, marked) or todo. Pure.
export const stepMarks = (steps, at) => steps.map((s, j) => j === at ? 'on' : j > at ? 'todo' : (s.done ? s.done() : true) ? 'done' : 'missing');
export const clampStep = (i, n) => Math.max(0, Math.min(n - 1, Number.isInteger(i) ? i : 0));

// `steps` [{label, page}] -- page an element holding that step's content.
// `finish` the main button for the last step (moved into the foot), or null.
// `hints` [[key, words]]. `onStep(i)` hears every change (main.js keeps it, so
// a redrawn sheet opens where it was).
// `finishAlways`: the main button shows on every step (a setup with nothing
// that must be chosen, like Endless), Next beside it until the last.
// A step's `done()` says whether it has what it needs: a step passed without
// it is not ticked (UI/UX pass, 21 October 2026: Play ticked COURSE with no
// course chosen, and Tee off then did nothing). `alert` is an element shown in
// the foot beside the buttons -- the screen's error line, where it is seen.
export function stepSheet(root, {steps, index = 0, finish = null, finishAlways = false, hints = [], onStep, alert = null, doc = globalThis.document} = {}) {
 const sx = make(doc, 'div', 'sx');
 const bar = make(doc, 'nav', 'sx-steps');
 bar.setAttribute('aria-label', 'Steps');
 const pages = make(doc, 'div', 'sx-pages');
 const foot = make(doc, 'div', 'sx-foot');
 const keys = make(doc, 'div', 'sx-keys', hints.map(([k, t]) => `<span><kbd>${esc(k)}</kbd>${esc(t)}</span>`).join(''));
 const btns = make(doc, 'div', 'sx-btns');
 const back = make(doc, 'button', 'sx-back', 'Back'), next = make(doc, 'button', 'sx-next');
 back.type = next.type = 'button';
 btns.append(back, next);
 if (finish) btns.append(finish);
 if (alert) { alert.classList.add('sx-alert'); foot.append(keys, alert, btns); } else foot.append(keys, btns);
 const chips = steps.map((s, i) => {
  const b = make(doc, 'button', 'sx-step', `<span class="sx-n">${i + 1}</span>${esc(s.label.toUpperCase())}`);
  b.type = 'button'; b.setAttribute('aria-label', s.label);
  b.onclick = () => go(i);
  bar.append(b);
  s.page.classList.add('sx-page');
  pages.append(s.page);
  return b;
 });
 let at = -1;
 function go(i) {
  i = clampStep(i, steps.length);
  at = i;
  const marks = stepMarks(steps, i);
  steps.forEach((s, j) => { const ok = marks[j] === 'done'; s.page.hidden = j !== i; chips[j].classList.toggle('on', j === i); chips[j].classList.toggle('done', ok); chips[j].classList.toggle('missing', j < i && !ok); chips[j].setAttribute('aria-current', j === i ? 'step' : 'false'); chips[j].querySelector('.sx-n').textContent = ok ? '✓' : String(j + 1); });
  back.hidden = i === 0;
  const last = i === steps.length - 1;
  next.hidden = last;
  if (!last) next.innerHTML = `Next <small>${esc(steps[i + 1].label.toUpperCase())}</small>`;
  if (finish) finish.hidden = !last && !finishAlways;
  steps[i].onShow?.();
  onStep?.(i);
 }
 back.onclick = () => go(at - 1);
 next.onclick = () => go(at + 1);
 sx.append(bar, pages, foot);
 root.append(sx);
 root.classList.add('sx-root');
 go(index);
 return {go, repaint: () => go(at), get index() { return at; }};
}
