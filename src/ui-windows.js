// THE 1.0 WINDOWS (round 13, the owner, 17 October 2026: "a window or tool
// column leans as ONE block, like the sheet. Leaning each row on its own made
// the edges jagged again.").
//
// A window is a slanted title, a line under it, then slanted rows, the main
// choice filled (frames c-pause, c-dialogs1-3). Each row draws its own
// slanted background (so rows keep their gaps), and `leanAsOne` moves every
// row across as if the whole window leaned about ONE line -- the column's
// middle: then the rows' edges fall on one straight slanted line, while the
// text in them stays upright.
//
// `makeWindow` builds a new window (the course studio's pause); old windows
// (the round's pause, Leave, Take relief...) are dressed by CSS and handed to
// `leanAsOne` the same way.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// How far each row's middle sits from the column's middle, in the rows' own
// CSS pixels (a zoomed piece reports screen pixels; offsetHeight is its own).
// Pure: rows [{top, height, scale}] -> offsets.
export function leanOffsets(rows) {
 if (!rows.length) return [];
 const top = Math.min(...rows.map(r => r.top)), bottom = Math.max(...rows.map(r => r.top + r.height));
 const mid = (top + bottom) / 2;
 return rows.map(r => (mid - (r.top + r.height / 2)) / (r.scale || 1));
}

// Sets --wy on every visible row; the CSS moves each row across by tan 12
// degrees of it (`translate`), which is where a sheet leaning about the
// column's middle line would put it.
export function leanAsOne(rows) {
 const live = rows.filter(r => r && r.offsetParent !== null && r.getBoundingClientRect().height > 0);
 const boxes = live.map(r => { const b = r.getBoundingClientRect(); return {top: b.top, height: b.height, scale: b.height / (r.offsetHeight || b.height)}; });
 leanOffsets(boxes).forEach((dy, i) => live[i].style.setProperty('--wy', dy.toFixed(1) + 'px'));
}

// A window: rows [{id, label, sub, key, hot, act}].
export function makeWindow({id, title, line, rows}, doc = globalThis.document) {
 const w = make(doc, 'section', 'w13');
 if (id) w.id = id;
 w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', title);
 w.append(make(doc, 'h2', 'w13-title', esc(title)));
 if (line) w.append(make(doc, 'p', 'w13-line', esc(line)));
 for (const r of rows) {
  const b = make(doc, 'button', 'w13-row' + (r.hot ? ' hot' : ''), `<span class="w13-label">${esc(r.label)}</span>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}${r.key ? `<kbd>${esc(r.key)}</kbd>` : ''}`);
  b.type = 'button';
  if (r.id) b.dataset.row = r.id;
  b.onclick = () => r.act?.();
  w.append(b);
 }
 return w;
}

// Old windows dressed by CSS (Leave, the version notice, the welcome, Take
// relief...): each time one opens, or its rows are redrawn, its rows are lined
// up as one block. `list` [{el, rows() -> elements}].
export function watchWindows(list) {
 const live = list.filter(w => w.el);
 const run = w => requestAnimationFrame(() => { if (!w.el.hidden) leanAsOne(w.rows()); });
 const mo = new MutationObserver(recs => {
  const seen = new Set();
  for (const r of recs) { const w = live.find(x => x.el === r.target || x.el.contains(r.target)); if (w && !seen.has(w)) { seen.add(w); run(w); } }
 });
 for (const w of live) mo.observe(w.el, {attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true});
 globalThis.addEventListener?.('resize', () => live.forEach(run));
 return mo;
}
