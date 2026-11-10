// THE MENU BAR (the builder-ux goal, 10 November 2026: "It needs to run more
// like an MS Paint/real 3d editor"): File, Edit, View, Tools, Help along the
// top, every command findable, each with its key shown and its key working
// (shortcuts.js holds the rules). A screen hands its menus with setMenus; the
// home screen hands a short set. Help > Keyboard shortcuts (or ?) lists every
// key. Opening one menu and moving across opens the next, as on a desktop.
import {commandFor, keyLabel, shortcutRows} from './shortcuts.js';

let menus = [], extraKeys = [], openName = null;
const bar = document.createElement('nav');
bar.className = 'cb-menubar'; bar.setAttribute('aria-label', 'Menus');
const sheet = document.createElement('div');
sheet.className = 'cb-keysheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Keyboard shortcuts');

export const menuBarEl = bar, keySheetEl = sheet;
const on = it => typeof it.enabled === 'function' ? !!it.enabled() : it.enabled !== false;

// `extra`: lines for the shortcuts sheet that are not commands (the view's
// own mouse and keys), [{group, label, key}].
export function setMenus(list, extra = []) { menus = list; extraKeys = extra; openName = null; draw(); }
export function refreshMenus() { draw(); }

function draw() {
 bar.replaceChildren(...menus.map(m => {
  const head = document.createElement('button');
  head.type = 'button'; head.className = 'cb-menuhead' + (openName === m.name ? ' cb-open' : ''); head.textContent = m.name;
  head.title = `The ${m.name} menu`;
  head.setAttribute('aria-haspopup', 'true'); head.setAttribute('aria-expanded', String(openName === m.name));
  head.onclick = e => { e.stopPropagation(); openName = openName === m.name ? null : m.name; draw(); };
  head.onmouseenter = () => { if (openName && openName !== m.name) { openName = m.name; draw(); } };
  const wrap = document.createElement('div'); wrap.className = 'cb-menu';
  wrap.append(head);
  if (openName === m.name) {
   const list = document.createElement('div'); list.className = 'cb-menulist'; list.setAttribute('role', 'menu');
   for (const it of m.items) {
    if (it.sep) { const hr = document.createElement('div'); hr.className = 'cb-menusep'; list.append(hr); continue; }
    if (it.heading) { const h = document.createElement('div'); h.className = 'cb-menunote'; h.textContent = it.heading; list.append(h); continue; }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cb-menuitem'; b.setAttribute('role', 'menuitem'); b.disabled = !on(it);
    if (it.title) b.title = it.title;
    const label = document.createElement('span'); label.textContent = (typeof it.checked === 'function' ? (it.checked() ? '✓ ' : ' ') : '') + (typeof it.label === 'function' ? it.label() : it.label);
    const k = document.createElement('kbd'); k.textContent = it.key ? keyLabel(it.key) : '';
    b.append(label, k);
    b.onclick = e => { e.stopPropagation(); openName = null; draw(); it.run?.(); };
    list.append(b);
   }
   wrap.append(list);
  }
  return wrap;
 }));
}
document.addEventListener('click', () => { if (openName) { openName = null; draw(); } });

// Every command's key, from anywhere; a text box keeps its own typing.
window.addEventListener('keydown', e => {
 if (e.key === 'Escape' && openName) { openName = null; draw(); return; }
 if (e.key === 'Escape' && !sheet.hidden) { sheet.hidden = true; return; }
 const tag = document.activeElement?.tagName || '', typing = /INPUT|SELECT|TEXTAREA/.test(tag) && !/range|checkbox|radio/.test(document.activeElement?.type || '');
 const it = commandFor(menus, e, {typing});
 if (!it || !on(it)) return;
 e.preventDefault(); e.stopPropagation();
 it.run?.();
}, true);

// THE SHORTCUTS SHEET: every key on the screen, by menu.
export function showKeys() {
 const rows = shortcutRows(menus, extraKeys), groups = [...new Set(rows.map(r => r.group))];
 const close = document.createElement('button'); close.type = 'button'; close.className = 'cb-btn'; close.textContent = 'Close'; close.onclick = () => { sheet.hidden = true; };
 const h = document.createElement('h3'); h.textContent = 'Keyboard shortcuts';
 const cols = document.createElement('div'); cols.className = 'cb-keycols';
 for (const g of groups) {
  const box = document.createElement('section'), t = document.createElement('h4'); t.textContent = g; box.append(t);
  for (const r of rows.filter(q => q.group === g)) { const line = document.createElement('div'), a = document.createElement('span'), k = document.createElement('kbd'); a.textContent = r.label; k.textContent = r.key; line.append(a, k); box.append(line); }
  cols.append(box);
 }
 const inner = document.createElement('div'); inner.className = 'cb-keyinner'; inner.append(h, cols, close);
 sheet.replaceChildren(inner); sheet.hidden = false; close.focus();
}
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });
