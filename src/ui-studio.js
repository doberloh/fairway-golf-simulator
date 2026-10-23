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

// The studio's tools: the big map, full screen and the studio's pause. The
// round's camera, green and shots have nothing to do over a landscape with no
// ball, so they are not here (PLACED; the frame copies the round's column).
const STUDIO_TOOLS = [
 ['map', 'BIG MAP', 'M', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'],
 ['full', 'FULL SCREEN', 'F11', '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'],
 ['menu', 'MENU', 'ESC', '<path d="M4 6h16M4 12h16M4 18h16"/>'],
];

// The flying HUD's own pieces, made once inside #world.
export function studioHud(world, doc = globalThis.document) {
 let slab = doc.getElementById('studioSlab');
 if (!slab) {
  // A mountain, not a letter: an italic S read as a 5 (UI/UX pass, 21 October 2026).
  slab = make(doc, 'div', 'sd-slab', '<b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20 9 8l4 6 3-4 6 10z" fill="currentColor"/></svg></b><span><strong>COURSE STUDIO</strong><small></small></span>');
  slab.id = 'studioSlab';
  const chip = make(doc, 'button', 'sd-chip', '<span class="sd-chip-n"></span><span class="sd-chip-go">REGENERATE</span>');
  chip.id = 'studioChip'; chip.type = 'button'; chip.hidden = true;
  const keys = make(doc, 'div', 'sd-keys', '<span><i>W A S D</i>FLY</span><span><i>R F</i>UP / DOWN</span><span><i>SHIFT</i>FASTER</span><span><i>DRAG</i>LOOK</span>');
  keys.id = 'studioKeys'; keys.setAttribute('aria-hidden', 'true');
  // The tool column above the map (frame c-studio), drawn like the round's
  // (`.rh-tools`); main.js says what each does.
  const tools = make(doc, 'div', 'rh-tools sd-tools', STUDIO_TOOLS.map(([id, label, key, icon]) =>
   `<button type="button" data-tool="${id}" aria-label="${label[0] + label.slice(1).toLowerCase()} (${key})"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span><kbd>${key}</kbd></button>`).join(''));
  tools.id = 'studioTools'; tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Studio tools');
  world.append(slab, chip, keys, tools);
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

// The studio's settings: ONE screen, the same from the main menu and in the
// studio (round 13: "they look exactly the same ... only the picture behind
// differs"). `changes()` is the current list; `facts()` is {holes, yards,
// seed}; `landscapes` [{key, name, settings}] and `pictures` draw Surroundings
// as a grid of pictures (frame c-studio-set). Returns {paint} for main.js to
// call on every input.
export function buildStudioSheet(root, {changes, facts, setup, landscapes = [], pictures, doc = globalThis.document} = {}) {
 if (root.querySelector('.sd-side')) return null;
 const sections = [...root.querySelectorAll('.panel-section')];
 // Surroundings as pictures: each landscape button (main.js, `data-biome`)
 // gets its drawn picture above its name.
 const queue = [];
 for (const b of root.querySelectorAll('.option-grid>[data-biome]')) {
  const l = landscapes.find(x => x.key === b.dataset.biome);
  if (!l) continue;
  const pic = make(doc, 'span', 'sd-pic');
  b.prepend(pic); queue.push({el: pic, settings: l.settings});
  b.closest('.option-grid').classList.add('sd-lands');
 }
 if (queue.length) pictures?.(queue, 160, 64);
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
 // SAVED COURSES and SHOW ALL DESCRIPTIONS were two chips over the settings,
 // tacked on (audits 1 and 2): the first is a row of this column now, the
 // second a key in the foot.
 const lib = root.querySelector('#openLibrary'), tips = root.querySelector('#toggleTips');
 lib?.closest('.split')?.classList.add('sx-emptied');
 // "Choose the landscape you want, then grow it" sat as small prose over the
 // settings (audit 3); NOT GROWN YET and Grow this landscape already say it.
 const intro = [...root.querySelectorAll('p')].find(p => /Nothing (is built|rebuilds)/.test(p.textContent));
 intro?.classList.add('sx-emptied');
 if (lib) { lib.className = 'sd-link'; lib.innerHTML = '<span>SAVED COURSES</span><b>OPEN ▸</b>'; side.append(lib); }
 const help = make(doc, 'div', 'sd-help', '<span class="sd-k"></span><span class="sd-help-v"></span>');
 side.append(help);
 root.append(side);
 root.classList.add('sd-root');
 // The keys along the foot, as on every other sheet (UI/UX pass).
 if (!root.querySelector('.sd-foot')) root.append(make(doc, 'div', 'sx-foot sd-foot', '<div class="sx-keys"><span><kbd>R</kbd>Grow this landscape</span><span><kbd>Esc</kbd>Back</span></div>'));
 if (tips) { tips.className = 'sd-tips'; tips.insertAdjacentHTML('afterbegin', '<kbd>?</kbd>'); root.querySelector('.sd-foot .sx-keys')?.append(tips); }

 // The focused row's help: its own tip (the schema's text).
 root.stFocus = e => {
  const card = e.target.closest?.('.control-card,.control-group,.course-plan');
  if (!card || !root.contains(card)) return;
  const tip = card.querySelector('p.tip');
  const name = card.querySelector('[aria-label]')?.getAttribute('aria-label') || card.querySelector('.field-name')?.childNodes[0]?.textContent || card.querySelector('label')?.childNodes[0]?.textContent || '';
  if (tip?.textContent.trim()) { help.querySelector('.sd-k').textContent = name.trim().toUpperCase(); help.querySelector('.sd-help-v').textContent = tip.textContent.trim(); help.hidden = false; }
 };
 help.hidden = true;

 const paint = () => {
  const list = changes(), f = facts();
  state.classList.toggle('stale', list.length > 0 && !setup?.());
  // Before the first grow (from the menu) nothing is out of date yet.
  const fresh = !!setup?.();
  state.querySelector('.sd-k').textContent = fresh ? 'NOT GROWN YET' : list.length ? 'OUT OF DATE' : 'UP TO DATE';
  state.querySelector('strong').textContent = fresh ? 'A NEW LANDSCAPE' : list.length ? `${list.length} CHANGE${list.length === 1 ? '' : 'S'}` : 'AS GROWN';
  const lines = state.querySelector('.sd-list');
  lines.textContent = '';
  if (!fresh) for (const c of list.slice(0, 6)) { const s = make(doc, 'span'); s.textContent = changeLine(c); lines.append(s); }
  if (!fresh && list.length > 6) lines.append(make(doc, 'span', 'sd-more', `AND ${list.length - 6} MORE`));
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
   if (card.querySelector('[data-biome]')) keys.push('biome');
   card.classList.toggle('sd-changed', keys.some(k => changed.has(k)));
  }
 };
 paint();
 return {paint};
}
