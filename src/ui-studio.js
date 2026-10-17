// THE COURSE STUDIO, LAID OUT AS THE APPROVED MOCKUPS (the 1.0 interface, 17
// October 2026; mockups `r10('studio')` and `r10('studio-set')`;
// PROJECT_HANDOFF *The 1.0 lobby* -- the same approach).
//
// Flying over the landscape: the studio's slab top left (its name, the
// landscape and the holes), "N settings changed" top right while the
// landscape is out of date (press it to regenerate), the flying keys, and the
// studio bar as the action bar along the foot. With Settings open: the
// categories down the left with how many settings each holds, the category's
// rows (a segment bar and the value, a dot on any row changed since the last
// regenerate), and on the right what has changed, the course's facts and the
// focused row's help.
//
// MOVED, NOT REBUILT: the studio bar, its buttons, the settings panel and its
// observer-driven geometry (PROJECT_HANDOFF *COURSE STUDIO'S SETTINGS TAKE THE
// PLAY AREA*, *THE STUDIO BAR RIDES ABOVE AN OPEN PANEL*) are the old ones;
// this adds the slab, the chip, the keys and the right-hand column, and
// ui-sheets.css dresses the rest.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const KINDS = new Set(['range', 'int', 'choice', 'toggle']);

// What the controls say now against the settings the landscape was grown
// from. `read(key)` is the control's value, or undefined when it is not on
// the page. Pure.
export function settingsChanges(fields, applied, read) {
 const out = [];
 for (const f of fields) {
  if (!KINDS.has(f.kind)) continue;
  const raw = read(f.key);
  if (raw === undefined) continue;
  const to = f.kind === 'toggle' ? !!raw : f.kind === 'choice' ? String(raw) : Number(raw);
  const from = f.kind === 'toggle' ? !!applied[f.key] : f.kind === 'choice' ? String(applied[f.key]) : Number(applied[f.key]);
  if (to !== from) out.push({key: f.key, label: f.label, from, to, unit: f.kind === 'choice' || f.kind === 'toggle' ? '' : (f.unit || '').trim()});
 }
 return out;
}

// One change as the mockup writes it: "FAIRWAY WIDTH 38 → 32 M".
export function changeLine(c) {
 const v = x => (x === true ? 'ON' : x === false ? 'OFF' : String(x).toUpperCase());
 return `${String(c.label).toUpperCase()} ${v(c.from)} → ${v(c.to)}${c.unit ? ' ' + c.unit.toUpperCase() : ''}`;
}

export const changedText = n => `${n} SETTING${n === 1 ? '' : 'S'} CHANGED`;

// The flying HUD's own pieces, made once inside #world.
export function studioHud(world, doc = globalThis.document) {
 let slab = doc.getElementById('studioSlab');
 if (!slab) {
  slab = make(doc, 'div', 'sd-slab', '<b>S</b><span><strong>COURSE STUDIO</strong><small></small></span>');
  slab.id = 'studioSlab';
  const chip = make(doc, 'button', 'sd-chip', '<span class="sd-chip-n"></span><span class="sd-chip-go">REGENERATE</span>');
  chip.id = 'studioChip'; chip.type = 'button'; chip.hidden = true;
  const keys = make(doc, 'div', 'sd-keys', '<span><i>W A S D</i>FLY</span><span><i>R F</i>UP / DOWN</span><span><i>SHIFT</i>FASTER</span><span><i>DRAG</i>LOOK</span>');
  keys.id = 'studioKeys'; keys.setAttribute('aria-hidden', 'true');
  world.append(slab, chip, keys);
 }
 return {slab, chip: doc.getElementById('studioChip')};
}

// `facts`: {name, biome, holes}; `changes`: the list; `regenerate()`.
export function paintStudioHud({facts, changes, regenerate}, doc = globalThis.document) {
 const slab = doc.getElementById('studioSlab'), chip = doc.getElementById('studioChip');
 if (!slab || !chip) return;
 slab.querySelector('small').textContent = [facts.biome, facts.holes ? `${facts.holes} HOLES` : ''].filter(Boolean).join(' / ').toUpperCase();
 chip.hidden = !changes.length;
 chip.querySelector('.sd-chip-n').textContent = changedText(changes.length);
 chip.onclick = regenerate;
}

// The settings sheet in the studio. `changes()` is the current list; `facts()`
// is {holes, yards, seed}. Returns {paint} for main.js to call on every input.
export function buildStudioSheet(root, {changes, facts, doc = globalThis.document} = {}) {
 if (root.querySelector('.sd-side')) return null;
 const sections = [...root.querySelectorAll('.panel-section')];
 // How many settings each category holds, on its tab.
 for (const tab of root.querySelectorAll(':scope>.panel-tabs>.panel-tab')) {
  const s = sections.find(x => x.dataset.title === tab.textContent.trim());
  if (!s) continue;
  const n = s.querySelectorAll('input[type=range],input[type=checkbox],select,input#seed').length;
  if (n) tab.append(make(doc, 'small', 'sd-count', String(n)));
 }
 const side = make(doc, 'aside', 'sd-side');
 const state = make(doc, 'div', 'sd-state', '<span class="sd-k"></span><strong></strong><span class="sd-list"></span>');
 const row = label => { const r = make(doc, 'div', 'sd-row', `<span>${label}</span><b></b>`); side.append(r); return r.querySelector('b'); };
 side.append(state);
 const holes = row('HOLES'), yards = row('LENGTH'), seed = row('SEED');
 const help = make(doc, 'div', 'sd-help', '<span class="sd-k"></span><span class="sd-help-v"></span>');
 side.append(help);
 root.append(side);
 root.classList.add('sd-root');

 // The focused row's help: its own tip (the schema's text).
 root.stFocus = e => {
  const card = e.target.closest?.('.control-card,.control-group,.course-plan');
  if (!card || !root.contains(card)) return;
  const tip = card.querySelector('p.tip');
  const name = card.querySelector('[aria-label]')?.getAttribute('aria-label') || card.querySelector('label')?.childNodes[0]?.textContent || '';
  if (tip?.textContent.trim()) { help.querySelector('.sd-k').textContent = name.trim().toUpperCase(); help.querySelector('.sd-help-v').textContent = tip.textContent.trim(); help.hidden = false; }
 };
 help.hidden = true;

 const paint = () => {
  const list = changes(), f = facts();
  state.classList.toggle('stale', list.length > 0);
  state.querySelector('.sd-k').textContent = list.length ? 'OUT OF DATE' : 'UP TO DATE';
  state.querySelector('strong').textContent = list.length ? `${list.length} CHANGE${list.length === 1 ? '' : 'S'}` : 'AS GROWN';
  const lines = state.querySelector('.sd-list');
  lines.textContent = '';
  for (const c of list.slice(0, 6)) { const s = make(doc, 'span'); s.textContent = changeLine(c); lines.append(s); }
  if (list.length > 6) lines.append(make(doc, 'span', 'sd-more', `AND ${list.length - 6} MORE`));
  holes.textContent = f.holes ? String(f.holes) : '—';
  yards.textContent = f.yards ? `${Math.round(f.yards).toLocaleString('en-US')} YDS` : '—';
  seed.textContent = String(f.seed || '—').toUpperCase();
  // Each slider drawn as a segment bar filled to its value (--fill); set
  // here, on every redraw, because a slider moved by its number box fires
  // nothing of its own.
  for (const r of root.querySelectorAll('input[type=range]')) r.style.setProperty('--fill', ((r.value - r.min) / ((r.max - r.min) || 1) * 100).toFixed(1) + '%');
  const changed = new Set(list.map(c => c.key));
  for (const card of root.querySelectorAll('.control-card,.control-group')) {
   const keys = [...card.querySelectorAll('input[id],select[id]')].map(e => e.id);
   card.classList.toggle('sd-changed', keys.some(k => changed.has(k)));
  }
 };
 paint();
 return {paint};
}
