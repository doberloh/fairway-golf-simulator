// THE RANGE CONTROLS, LAID OUT AS THE APPROVED MOCKUP (the 1.0 interface, 17
// October 2026; mockup `r10('range-ctl')`; PROJECT_HANDOFF *The 1.0 lobby* --
// the same approach).
//
// Two columns: on the left where you hit from (Mats, Chip, Putt as tiles) and
// the station's own controls, then the greens -- the centre green's distance
// and slope, the short-game green's slope, New green and New cup; on the right
// this session by club (balls, average carry, spread), the shot lines and the
// dispersion, Save CSV and Save PDF report, and the lab tools.
//
// MOVED, NOT REBUILT: renderRangePanel writes and wires the controls as before
// (every id and data-station the range journeys use); this sorts them by the
// panel's own headings into the two columns and adds the session table and
// the lab row. Still a window over the range, not a full sheet (PLACED): a
// green is set while looking at it, and the journeys hit balls with it open.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// The session table's rows from range-report.js clubTable(): club, balls,
// average carry and its spread, in yards. Pure.
export function sessionRows(table) {
 const yd = v => (Number.isFinite(v) ? `${Math.round(v)} YD` : '—');
 return table.map(r => ({club: String(r.club ?? '').toUpperCase(), golfer: r.golfer, n: r.n, carry: yd(r.carry), spread: Number.isFinite(r.carrySd) ? `±${Math.round(r.carrySd)}` : '—'}));
}

function fillTable(t, rows, golfers, doc) {
 t.textContent = '';
 t.append(make(doc, 'div', 'rg-tr rg-th', '<span>CLUB</span><span>BALLS</span><span>AVG CARRY</span><span>SPREAD</span>'));
 if (!rows.length) t.append(make(doc, 'div', 'rg-tr rg-empty', '<span>No full shots yet: hit from the mats.</span>'));
 for (const r of rows) t.append(make(doc, 'div', 'rg-tr', `<span>${esc(r.club)}${golfers > 1 ? ` <small>${esc(r.golfer)}</small>` : ''}</span><span>${r.n}</span><span>${esc(r.carry)}</span><span>${esc(r.spread)}</span>`));
}

// After each ball, while the window is open: the table, the count and the
// exports, without redrawing the window (a slider being dragged keeps its place).
export function updateRangeSession(doc, {rows = [], balls = 0, golfers = 1} = {}) {
 const t = doc.querySelector('.rg-table');
 if (!t) return;
 fillTable(t, rows, golfers, doc);
 const head = t.previousElementSibling;
 if (head?.tagName === 'H4') head.textContent = `This session · ${balls} ball${balls === 1 ? '' : 's'}`;
 for (const id of ['rangeCsv', 'rangePdf']) { const b = doc.getElementById(id); if (b) b.disabled = !balls; }
}

// `rows` from sessionRows, `balls` every ball this session, `openLab()`.
export function buildRangeControls(root, {rows = [], balls = 0, golfers = 1, openLab, doc = globalThis.document} = {}) {
 const box = root.querySelector('.range-box');
 if (!box || root.querySelector('.rg')) return false;
 const rg = make(doc, 'div', 'rg');
 const left = make(doc, 'section', 'rg-col rg-left'), right = make(doc, 'section', 'rg-col rg-right');
 // The panel's own headings say where each run of controls belongs.
 const part = {'Hit from': left, 'Centre green': left, 'Short-game green': left, 'This session': right};
 let to = left;
 for (const n of [...box.childNodes]) {
  if (n.nodeType === 1 && n.tagName === 'H4') {
   const t = n.textContent.trim();
   to = part[t] || to;
   if (t === 'Centre green') to.append(make(doc, 'h4', 'range-head rg-greens', 'The greens'));
   if (t === 'This session') { n.textContent = `This session · ${balls} ball${balls === 1 ? '' : 's'}`; to.append(n); to.append(table()); continue; }
  }
  to.append(n);
 }
 function table() {
  const t = make(doc, 'div', 'rg-table');
  fillTable(t, rows, golfers, doc);
  return t;
 }
 right.append(make(doc, 'h4', 'range-head', 'Lab tools'));
 const lab = make(doc, 'button', 'secondary rg-lab', '<span>Fire a shot from typed numbers</span><b>OPEN ▸</b>');
 lab.type = 'button'; lab.onclick = () => openLab?.();
 right.append(lab);
 rg.append(left, right);
 box.append(rg);
 // Sliders drawn as segment bars filled to their value (--fill).
 for (const r of rg.querySelectorAll('input[type=range]')) {
  const fill = () => r.style.setProperty('--fill', ((r.value - r.min) / ((r.max - r.min) || 1) * 100).toFixed(1) + '%');
  r.addEventListener('input', fill); fill();
 }
 box.classList.add('rg-box');
 return true;
}
