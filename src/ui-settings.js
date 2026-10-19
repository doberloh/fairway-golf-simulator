// THE SETTINGS SCREENS, LAID OUT AS THE APPROVED MOCKUP (the 1.0 interface,
// 17 October 2026; mockup `r10('settings')`, PROJECT_HANDOFF *The 1.0
// lobby* -- the same approach).
//
// Camera & bay, Graphics and Sound, opened from the main menu as sheets, are
// one settings screen: the categories down the left (each opens its own
// sheet), every group of the open one shown at once in grouped rows -- a
// switch, a ◀ ▶ picker or a segment bar on the right of each -- and one line
// of help for the row that has the focus. (In a round the same panels open as
// small tool windows, which keep their own layout.)
//
// MOVED, NOT REBUILT: renderPanel writes and wires each panel as before and
// groupPanelContent groups it; this adds the category list and the help line,
// and ui-sheets.css turns each control into a row. Every control is still the
// real checkbox, drop-down or slider, so the smoke journeys and the panels'
// own handlers see nothing new. No tabs (round 13): every group shows at once.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// The categories, in the mockup's order, as the sheets that hold them. The
// mockup's Display, Controls, Data & backup and About are Camera & bay, Help &
// controls, My profile's History and Help's credits here (PLACED).
export const SETTINGS_CATEGORIES = [
 ['camera', 'CAMERA & BAY'],
 ['graphics', 'GRAPHICS'],
 ['sound', 'SOUND'],
 ['monitor', 'LAUNCH MONITOR'],
 ['help', 'HELP & CONTROLS'],
];
export const SETTINGS_SCREENS = new Set(['camera', 'graphics', 'sound']);

// The help line for a row: its own note or tip, else what its label says.
export function helpFor(card) {
 const bits = [...card.querySelectorAll(':scope>.note,:scope>p.tip,:scope>.research-label,:scope .tip')].map(n => n.textContent.trim()).filter(Boolean);
 return bits[0] || '';
}

export function buildSettings(root, {current, open, doc = globalThis.document} = {}) {
 // #drawerContent outlives every sheet: one focus listener, whose handler
 // each settings screen replaces and every other sheet clears.
 root.stFocus = null;
 if (!root.stWired) { root.stWired = true; root.addEventListener('focusin', e => root.stFocus?.(e)); }
 // Keys & help has its own layout since round 14 (ui-menu-screens.js buildHelp,
 // frame c-help); the settings list still links to it.
 if (!SETTINGS_SCREENS.has(current) || current === 'help' || root.querySelector('.st-cats')) return false;
 const cats = make(doc, 'nav', 'st-cats');
 cats.setAttribute('aria-label', 'Settings');
 for (const [name, label] of SETTINGS_CATEGORIES) {
  const b = make(doc, 'button', 'st-cat', label);
  b.type = 'button';
  if (name === current) { b.classList.add('on'); b.setAttribute('aria-current', 'page'); }
  else b.onclick = () => open?.(name);
  cats.append(b);
 }
 const groups = make(doc, 'div', 'st-groups');
 for (const s of root.querySelectorAll(':scope>.panel-section,:scope>.panel-columns>.panel-section')) groups.append(s);
 root.querySelector(':scope>.panel-columns')?.remove();
 // The help line: the focused row's note; before any row has the focus, the
 // screen's own opening line.
 const intro = root.querySelector('.panel-intro');
 const help = make(doc, 'div', 'st-help', '<span class="st-help-k"></span><span class="st-help-v"></span>');
 const say = (k, v) => { help.querySelector('.st-help-k').textContent = k; help.querySelector('.st-help-v').textContent = v; };
 say(SETTINGS_CATEGORIES.find(c => c[0] === current)[1], intro?.textContent.trim() || '');
 root.stFocus = e => {
  const card = e.target.closest?.('.control-card,.control-group');
  if (!card || !root.contains(card)) return;
  const label = (card.querySelector('label')?.childNodes[0]?.textContent || card.querySelector('label')?.textContent || '').trim();
  const text = helpFor(card);
  if (text) say(label.toUpperCase(), text);
 };
 // A slider is drawn as a segment bar filled to its value (--fill).
 for (const r of groups.querySelectorAll('input[type=range]')) {
  const fill = () => r.style.setProperty('--fill', ((r.value - r.min) / ((r.max - r.min) || 1) * 100).toFixed(1) + '%');
  r.addEventListener('input', fill); fill();
 }
 root.prepend(cats);
 root.append(groups, help);
 root.classList.add('st-root');
 return true;
}
