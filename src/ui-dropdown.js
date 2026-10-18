// THE 1.0 DROP-DOWN (round 14, frames c-locker-title and c-club; the owner:
// "profile drop-downs (title and others) don't match the style", "its
// drop-down (the bag) matches the style").
//
// One build for every list a player opens: the closed field -- its label, the
// value and a triangle -- and under it the list, leaning with its column:
// group headers, locked choices dimmed with how to earn them, the current one
// filled, the cursor outlined, a number or note right-aligned. ArrowUp/Down
// move the cursor, Enter takes it, Escape closes the list (and only the list);
// a click or a tap takes a choice; a click elsewhere closes.
//
// THE NATIVE SELECT STAYS. It keeps its id, its value and its change handler,
// lies see-through under the field, and is what a choice is written to (then
// a `change` is dispatched, as a player's pick would). So nothing that reads or
// sets a select changes, and the smoke journeys' selectOption still works.
//
// Markup on the select it reads: `data-dd-label` (the field's label; else the
// aria-label), and on an option `data-right` (right-aligned: a level, a carry)
// and, for a disabled one, `data-earn` (how to earn it). `data-dd="off"` keeps
// a select native.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Where the cursor goes next: one row that way, kept in the list. A locked
// choice can hold the cursor (it says how to earn it) but not be taken. Pure.
export function stepCursor(items, from, dir) {
 return Math.max(0, Math.min(items.length - 1, from + dir));
}

// The list's rows from a select's options and groups. Pure (reads .options).
export function listRows(select) {
 const rows = [];
 let group = null;
 for (const o of select.options) {
  const g = o.parentElement?.tagName === 'OPTGROUP' ? o.parentElement.label : null;
  if (g !== group) { group = g; if (g) rows.push({head: g}); }
  rows.push({value: o.value, text: o.textContent.trim(), right: o.dataset.right || '', earn: o.dataset.earn || '', disabled: o.disabled, index: o.index});
 }
 return rows;
}

let open = null;   // the one list open at a time

function close(keepFocus = true) {
 if (!open) return;
 const o = open; open = null;
 o.list.remove(); o.wrap.classList.remove('dd-open'); o.field.setAttribute('aria-expanded', 'false');
 if (keepFocus) o.field.focus({preventScroll: true});
}

function paintField(d) {
 const o = d.select.selectedOptions[0];
 d.value.textContent = o ? o.textContent.trim() : '';
}

function openList(d) {
 if (open?.select === d.select) return;
 close(false);
 const {select, doc} = d;
 const list = make(doc, 'div', 'dd-list' + (d.up ? ' dd-up' : ''));
 list.setAttribute('role', 'listbox');
 list.setAttribute('aria-label', d.label || select.getAttribute('aria-label') || 'Choices');
 const rows = listRows(select), items = [];
 for (const r of rows) {
  if (r.head) { list.append(make(doc, 'div', 'dd-group', esc(r.head))); continue; }
  const it = make(doc, 'div', 'dd-item' + (r.disabled ? ' dd-locked' : '') + (r.index === select.selectedIndex ? ' on' : ''),
   `<span class="dd-t">${esc(r.text)}${r.index === select.selectedIndex ? ' <i>✓</i>' : ''}</span><span class="dd-r">${r.disabled && r.earn ? '🔒 ' + esc(r.earn) : esc(r.right)}</span>`);
  it.setAttribute('role', 'option'); it.setAttribute('aria-selected', String(r.index === select.selectedIndex));
  if (r.disabled) it.setAttribute('aria-disabled', 'true');
  it.dataset.index = r.index;
  it.addEventListener('pointerdown', e => e.preventDefault());
  it.addEventListener('click', e => { e.stopPropagation(); if (!r.disabled) choose(d, r.index); });
  it.addEventListener('pointermove', () => setCursor(items.indexOf(it)));
  items.push(it); list.append(it);
 }
 const meta = items.map(it => ({disabled: it.classList.contains('dd-locked')}));
 let cur = Math.max(0, items.findIndex(it => it.classList.contains('on')));
 const setCursor = i => { if (i < 0) return; items[cur]?.classList.remove('cur'); cur = i; items[cur]?.classList.add('cur'); items[cur]?.scrollIntoView?.({block: 'nearest'}); };
 if (d.up) d.wrap.prepend(list); else d.wrap.append(list);
 d.wrap.classList.add('dd-open'); d.field.setAttribute('aria-expanded', 'true');
 open = {select, list, wrap: d.wrap, field: d.field,
  key(e) {
   if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { setCursor(stepCursor(meta, cur, e.code === 'ArrowDown' ? 1 : -1)); return true; }
   if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { if (!meta[cur]?.disabled) choose(d, Number(items[cur].dataset.index)); return true; }
   if (e.code === 'Escape') { close(); return true; }
   if (e.code === 'Tab') { close(false); return false; }
   return true;   // nothing else reaches the game while the list is open
  }};
 setCursor(cur);
}

function choose(d, index) {
 const changed = d.select.selectedIndex !== index;
 d.select.selectedIndex = index;
 paintField(d);
 close();
 if (changed) { d.select.dispatchEvent(new Event('input', {bubbles: true})); d.select.dispatchEvent(new Event('change', {bubbles: true})); }
}

// Gives `select` the 1.0 drop-down. `opts.field` uses an element already on
// the page as the closed field (the club box); `opts.up` opens the list above
// it. Returns {open, close}. Safe to call twice.
export function dropdown(select, {field = null, up = false, label = null, doc = globalThis.document} = {}) {
 if (!select || select.dataset.dd === 'off') return null;
 if (select.__dd) return select.__dd;
 const wrap = field ? field.parentElement : make(doc, 'span', 'dd');
 const d = {select, doc, up, wrap, label: label ?? select.dataset.ddLabel ?? null};
 if (!field) {
  select.before(wrap);
  field = make(doc, 'button', 'dd-field', `${d.label ? `<span class="dd-k">${esc(d.label)}</span>` : ''}<span class="dd-v"></span><span class="dd-tri" aria-hidden="true">▾</span>`);
  field.type = 'button';
  wrap.append(field, select);
  d.value = field.querySelector('.dd-v');
 } else {
  wrap.classList.add('dd');
  d.value = field.querySelector('.dd-v') || make(doc, 'span', 'dd-v');
 }
 d.field = field;
 field.setAttribute('aria-haspopup', 'listbox'); field.setAttribute('aria-expanded', 'false');
 if (!field.getAttribute('aria-label')) field.setAttribute('aria-label', select.getAttribute('aria-label') || d.label || 'Choose');
 select.classList.add('dd-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
 field.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (open?.select === select) close(); else openList(d); });
 select.addEventListener('change', () => paintField(d));
 paintField(d);
 return (select.__dd = {open: () => openList(d), close, field, refresh: () => paintField(d)});
}

// Every select a player can see inside `roots` (and any added later) gets the
// drop-down, except those that are not drawn (display:none: hidden pickers),
// those `skip` names, and `data-dd="off"`.
export function dropdownEverywhere(roots, {skip = '', doc = globalThis.document} = {}) {
 const take = root => {
  for (const s of root.querySelectorAll?.('select') || []) {
   if (s.__dd || s.dataset.dd === 'off' || (skip && s.matches(skip))) continue;
   if (getComputedStyle(s).display === 'none' || s.hidden) continue;
   dropdown(s, {doc});
  }
 };
 // At most once a frame: the round screen changes some text every frame.
 let due = 0;
 const mo = new MutationObserver(() => { if (!due) due = requestAnimationFrame(() => { due = 0; for (const r of roots) if (r) take(r); }); });
 for (const r of roots) if (r) { take(r); mo.observe(r, {childList: true, subtree: true}); }
 return mo;
}

// The list has the keys while it is open: first in line (a capture listener
// made when this module loads, before the game's), so the game's arrows,
// Enter and Escape never see them.
globalThis.addEventListener?.('keydown', e => {
 if (!open) return;
 if (!open.list.isConnected) { open = null; return; }
 if (open.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
globalThis.document?.addEventListener('pointerdown', e => {
 if (open && !open.wrap.contains(e.target)) close(false);
}, true);
