// THE 1.0 WINDOWS (round 13): a title, a line under it, then rows, the main
// choice filled (frames c-pause, c-dialogs1-3). Square since 28 October 2026
// (the owner: "remove our slanted box style for just regular squares
// everywhere"); the code that leaned each window's rows into one slanted
// block (leanAsOne, watchWindows) went with the slant.
//
// `makeWindow` builds a new window (the course studio's pause); old windows
// (the round's pause, Leave, Take relief...) are dressed by CSS.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

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
