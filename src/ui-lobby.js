// THE LOBBY, LAID OUT AS THE APPROVED MOCKUP (the 1.0 interface, 17 October
// 2026; mockup `r10('lobby')`, PROJECT_HANDOFF *The 1.0 lobby*).
//
// One screen in three sheet columns: the course on the left (its picture, its
// name, Change course, Surprise me), the golfers in the middle (one row each,
// + Add golfer, the tees, the lie-penalty note), the format and the rules on
// the right (four format tiles, then pickers for putting, out of bounds and
// the lie penalty), and saved rounds along the foot.
//
// THE CONTROLS ARE MOVED, NOT REBUILT. renderPanel('round') still writes the
// lobby as before -- the course drop-down, the group editor, the format
// fields, the saved-round cards -- with their ids and handlers, and
// groupPanelContent still makes its tabs; this takes those nodes and places
// them. What the mockup draws differently (tiles for a drop-down, ◀ ▶
// pickers) is put in front of the real control and works it: a tile or an
// arrow sets the drop-down's value and fires its change, so every rule the old
// controls applied still applies. A picker's drop-down lies over its value,
// see-through, so a click on the value still opens the list and the smoke
// journeys that pick an option still can. The tabs stay as chips (the journeys
// press them); each scrolls its column into view.
//
// Built on every screen size; a phone stacks the columns (ui-sheets.css).

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// An option's words as the mockup sets them: a short value and a line under
// it. "Stroke and distance (Rules of Golf)" -> RULES OF GOLF / Stroke and
// distance; "Hole out · make every putt" -> HOLE OUT / make every putt;
// "On: rough and sand cost ball speed" -> ON / rough and sand cost ball speed.
export function optionWords(text) {
 const t = String(text || '').trim();
 let m = t.match(/^(.*?)\s*\(([^)]+)\)$/);
 if (m) return {value: m[2], sub: m[1]};
 m = t.match(/^(.*?)\s*(?:·|:)\s*(.*)$/);
 if (m) return {value: m[1], sub: m[2]};
 return {value: t, sub: ''};
}

// The format tiles' names and order (the mockup's: Stroke, Match, Scramble, Skins).
const FORMAT_ORDER = ['stroke', 'match', 'scramble', 'skins'];
export const FORMAT_TILE = {stroke: 'STROKE', match: 'MATCH', scramble: 'SCRAMBLE', skins: 'SKINS'};

const fire = select => select.dispatchEvent(new Event('change', {bubbles: true}));

// A picker: the label and the chosen option's line under it, then ◀ value ▶,
// the real drop-down lying over the value.
function picker(doc, select, label, {words = optionWords} = {}) {
 const row = make(doc, 'div', 'lb-pick');
 const k = make(doc, 'span', 'lb-k'), sub = make(doc, 'span', 'lb-sub');
 k.append(make(doc, 'span', 'lb-label', esc(label)), sub);
 const v = make(doc, 'span', 'lb-v'), val = make(doc, 'span', 'lb-val');
 const box = make(doc, 'span', 'lb-sel');
 const paint = () => {
  const w = words(select.options[select.selectedIndex]?.textContent);
  val.textContent = w.value.toUpperCase(); sub.textContent = w.sub ? w.sub[0].toUpperCase() + w.sub.slice(1) : '';
 };
 const step = d => () => {
  const n = select.options.length; if (n < 2 || select.disabled) return;
  select.selectedIndex = (select.selectedIndex + d + n) % n;
  fire(select);
 };
 const left = make(doc, 'button', 'lb-arrow', '&#9664;'), right = make(doc, 'button', 'lb-arrow', '&#9654;');
 left.type = right.type = 'button';
 left.setAttribute('aria-label', `Previous ${label.toLowerCase()}`);
 right.setAttribute('aria-label', `Next ${label.toLowerCase()}`);
 left.onclick = step(-1); right.onclick = step(1);
 left.disabled = right.disabled = select.disabled || select.options.length < 2;
 select.setAttribute('aria-label', label[0] + label.slice(1).toLowerCase());
 box.append(val, select);
 v.append(left, box, right);
 row.append(k, v);
 select.addEventListener('change', paint);
 paint();
 return row;
}

// The format as four tiles in front of the real drop-down (kept, hidden).
function formatTiles(doc, select) {
 const box = make(doc, 'div', 'lb-tiles');
 const paint = () => { for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === select.value)); };
 const options = [...select.options].sort((a, b) => FORMAT_ORDER.indexOf(a.value) - FORMAT_ORDER.indexOf(b.value));
 for (const o of options) {
  const b = make(doc, 'button', 'lb-tile', FORMAT_TILE[o.value] || esc(o.textContent));
  b.type = 'button'; b.dataset.mode = o.value; b.disabled = select.disabled;
  b.setAttribute('aria-label', `Format: ${o.textContent}`);
  b.onclick = () => { select.value = o.value; fire(select); };
  box.append(b);
 }
 select.addEventListener('change', paint);
 paint();
 return box;
}

// The tees as chips in front of the real drop-down. One choice for the whole
// group: the game plays everyone from the same tee (PLACED -- the mockup
// draws a set of chips on every golfer's row, which needs tees per golfer in
// the round rules; until then the chips sit once, under the golfers).
const TEE_DOT = {blue: '#2b5fb4', white: '#f4f1e8', red: '#b8322b', black: '#1b1b1b', gold: '#d4a02c', green: '#2fb36b'};
function teeChips(doc, select) {
 const box = make(doc, 'div', 'lb-tees');
 box.append(make(doc, 'span', 'lb-label', 'PLAYING FROM'));
 const chips = make(doc, 'span', 'lb-tee-row');
 const paint = () => { for (const b of chips.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tee === select.value)); };
 for (const o of select.options) {
  const b = make(doc, 'button', 'lb-tee', `<i style="background:${TEE_DOT[o.value] || '#999'}"></i>${esc(o.value[0].toUpperCase())}`);
  b.type = 'button'; b.dataset.tee = o.value;
  b.setAttribute('aria-label', o.textContent);
  b.onclick = () => { select.value = o.value; fire(select); };
  chips.append(b);
 }
 select.hidden = true;
 select.addEventListener('change', paint);
 box.append(chips, select);
 paint();
 return box;
}

// The course's name panel, from the chosen option ("Name · 18 holes · Biome").
export function courseFacts(text) {
 const parts = String(text || '').split(' · ');
 return {name: parts[0] || '', holes: parts[1] || '', biome: parts[2] || ''};
}

// `onCourse(value)` hears the chosen course (the lobby wears its colours).
export function buildLobby(root, {onCourse, doc = globalThis.document} = {}) {
 const q = id => root.querySelector('#' + id);
 const course = q('roundCourse'), mode = q('roundMode');
 if (!course || !mode || root.querySelector('.lb')) return false;
 const lb = make(doc, 'div', 'lb');
 const colC = make(doc, 'section', 'lb-col lb-course'), colG = make(doc, 'section', 'lb-col lb-group'), colF = make(doc, 'section', 'lb-col lb-format');
 const saved = make(doc, 'section', 'lb-saved');
 const sectionOf = title => [...root.querySelectorAll('.panel-section')].find(s => s.dataset.title === title);

 // THE COURSE. The picture is a panel in the landscape's colours naming it:
 // no picture of a saved course exists to show (PLACED -- the mockup's tee
 // photograph would need the course built and drawn first).
 const pic = make(doc, 'div', 'lb-pic'), facts = make(doc, 'div', 'lb-facts');
 const library = course.options.length && course.value;
 const paintCourse = () => {
  const f = courseFacts(course.options[course.selectedIndex]?.textContent);
  pic.innerHTML = `<span>${esc((f.biome || 'Surprise me').toUpperCase())}</span>`;
  facts.innerHTML = library ? `<strong>${esc(f.name.toUpperCase())}</strong><small>${esc([f.biome, f.holes].filter(Boolean).join(' · ').toUpperCase())}</small>`
   : '<strong>NO SAVED COURSES</strong><small>SHAPE ONE IN COURSE STUDIO, OR LET FAIRWAY SURPRISE YOU</small>';
  onCourse?.(course.value);
 };
 course.addEventListener('change', paintCourse);
 colC.append(pic, facts);
 if (library) colC.append(picker(doc, course, 'CHANGE COURSE', {words: t => ({value: courseFacts(t).name, sub: ''})}));
 else { course.hidden = true; colC.append(course); }
 paintCourse();
 for (const id of ['roundSurprise', 'roundStudio', 'roundManage', 'roundDelete']) { const b = q(id); if (b) colC.append(b); }
 const why = sectionOf('Your course')?.querySelector('.research-label'); if (why) colC.append(why);

 // THE GOLFERS.
 colG.append(make(doc, 'h3', 'lb-head', 'GOLFERS'));
 for (const id of ['playerRows', 'roundError', 'applyGroup']) { const n = q(id); if (n) colG.append(n); }
 const tee = q('roundTee');
 if (tee) colG.append(teeChips(doc, tee));
 colG.append(make(doc, 'div', 'lb-note', '<span class="lb-label">LIE PENALTY</span><span>On: a launch-monitor shot from the rough or a bunker loses ball speed, as it would outdoors. Off: every monitor shot flies exactly as measured.</span>'));

 // THE FORMAT AND THE RULES. The format note (what the format means) stays
 // under the tiles: the mockup has none, but a newcomer needs it (PLACED).
 colF.append(make(doc, 'h3', 'lb-head', 'FORMAT'), formatTiles(doc, mode));
 const note = q('formatNote'); if (note) colF.append(note);
 mode.hidden = true; colF.append(mode);
 colF.append(make(doc, 'h3', 'lb-head', 'RULES'));
 const putting = q('roundPuttingMode'), ob = q('roundOB'), lie = q('roundMonLie');
 if (putting) colF.append(picker(doc, putting, 'PUTTING'));
 for (const id of ['roundPutting-distances', 'roundPuttingNote']) { const n = q(id); if (n) colF.append(n); }
 if (ob) colF.append(picker(doc, ob, 'OUT OF BOUNDS'));
 if (lie) colF.append(picker(doc, lie, 'LIE PENALTY'));

 // SAVED ROUNDS: everything the old section held, along the foot.
 const old = sectionOf('Saved rounds');
 if (old) {
  saved.append(make(doc, 'h3', 'lb-head', 'OR PICK UP WHERE YOU LEFT OFF'));
  saved.append(...[...old.childNodes].filter(n => n.tagName !== 'H3'));
 }

 lb.append(colC, colG, colF);
 if (old) lb.append(saved);
 // The old sections are empty shells now; their tabs jump to the columns.
 const target = {'Your course': colC, 'Your group': colG, 'Format & tees': colF, 'Saved rounds': saved};
 for (const s of root.querySelectorAll('.panel-section')) s.classList.add('lb-emptied');
 for (const tab of root.querySelectorAll('.panel-tab')) {
  const to = target[tab.textContent.trim()];
  if (to) tab.addEventListener('click', () => to.scrollIntoView?.({block: 'nearest', behavior: 'smooth'}));
 }
 root.classList.add('lb-root');
 root.append(lb);
 return true;
}
