// PLAY, STEP BY STEP (round 13, the owner, 17 October 2026: the one-screen
// lobby goes back to a sequence of menus; mockups `r13('c-play1')` to
// `('c-play4')`, PROJECT_HANDOFF *The 1.0 lobby*).
//
//   1 Course   your courses as cards with their pictures (course-picture.js),
//              the course of the week first, then Surprise me and New in
//              studio; the line along the foot names the chosen course, and
//              its saved rounds open from there.
//   2 Golfers  a seat each: the ball, name, title, level and handicap, the
//              golfer's own tee, and how they play and swing.
//   3 Format   four cards; the teams appear for match play and scramble.
//   4 Rules    the house rules with help, and what you are about to play.
//
// THE CONTROLS ARE MOVED, NOT REBUILT. renderPanel('round') still writes the
// lobby -- the course drop-down, the group editor, the format fields, the
// saved rounds -- with their ids and handlers; this sorts those nodes into the
// steps (ui-steps.js). A card, a tile or an arrow sets the real drop-down and
// fires its change, so every rule behind it still applies.

import {stepSheet} from './ui-steps.js';

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

// The format cards, in the mockup's order and words.
const FORMAT_ORDER = ['stroke', 'match', 'scramble', 'skins'];
export const FORMAT_TILE = {stroke: 'STROKE PLAY', match: 'MATCH PLAY', scramble: 'SCRAMBLE', skins: 'SKINS'};
export const FORMAT_CARD = {
 stroke: ['Every shot counts. Lowest total wins.', 'ANY GROUP'],
 match: ['Win holes, not strokes. Singles or best-ball teams.', '2 TO 4 GOLFERS'],
 scramble: ['Everyone hits, the team picks the best ball.', 'TEAMS OF 1 TO 4'],
 skins: ['Each hole is worth a skin. Ties carry.', '2 TO 4 GOLFERS'],
};
// Formats played in teams: the teams show under the cards for these.
export const TEAM_FORMATS = new Set(['match', 'scramble']);

const fire = select => select.dispatchEvent(new Event('change', {bubbles: true}));

// A picker: the label and the chosen option's line under it, then ◀ value ▶,
// the real drop-down lying see-through over the value.
export function picker(doc, select, label, {words = optionWords} = {}) {
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

// The course's name panel, from the chosen option ("Name · 18 holes · Biome").
export function courseFacts(text) {
 const parts = String(text || '').split(' · ');
 return {name: parts[0] || '', holes: parts[1] || '', biome: parts[2] || ''};
}

// A course card: the picture, then the caption. `pic` gets the drawing.
function card(doc, {name, line, tag, best, kind}) {
 const b = make(doc, 'button', 'sx-card' + (kind ? ' sx-' + kind : ''));
 b.type = 'button';
 const pic = make(doc, 'span', 'sx-pic', kind === 'surprise' ? '<b>?</b>' : kind === 'studio' ? '<b>+</b>' : '');
 const cap = make(doc, 'span', 'sx-cap', `${tag ? `<em>${esc(tag)}</em>` : ''}<strong>${esc(name)}</strong><small>${esc(line)}${best ? ` · <i>${esc(best)}</i>` : ''}</small>`);
 b.append(pic, cap);
 return {b, pic};
}

// `opts`: courses [{id, name, settings, line, best}], weekly {name, line,
// settings} or null, onWeekly(), pictures(items, w, h), step, onStep(i),
// golferLine(seatEl) for the summary.
export function buildLobby(root, opts = {}, doc = globalThis.document) {
 const q = id => root.querySelector('#' + id);
 const course = q('roundCourse'), mode = q('roundMode');
 if (!course || !mode || root.querySelector('.sx')) return null;
 const sectionOf = title => [...root.querySelectorAll('.panel-section')].find(s => s.dataset.title === title);
 const {courses = [], weekly = null, pictures} = opts;
 const page = cls => make(doc, 'section', 'sx-body ' + cls);

 // 1 · COURSE.
 const p1 = page('sx-course');
 const grid = make(doc, 'div', 'sx-cards');
 const scroll = make(doc, 'div', 'sx-scroll');
 scroll.append(grid);
 const queue = [];
 const cardFor = new Map();
 if (weekly) {
  const {b, pic} = card(doc, {name: weekly.name, line: weekly.line, tag: 'COURSE OF THE WEEK'});
  b.setAttribute('aria-label', `Course of the week: ${weekly.name}`);
  b.onclick = () => opts.onWeekly?.();
  grid.append(b); queue.push({el: pic, settings: weekly.settings});
 }
 for (const c of courses) {
  const {b, pic} = card(doc, {name: c.name, line: c.line, best: c.best});
  b.dataset.course = c.id;
  b.onclick = () => { course.value = c.id; fire(course); };
  grid.append(b); queue.push({el: pic, settings: c.settings}); cardFor.set(c.id, b);
 }
 const surprise = q('roundSurprise'), studio = q('roundStudio');
 if (surprise) {
  const {b} = card(doc, {name: 'SURPRISE ME', line: 'A NEW NINE, RANDOM SETTINGS', kind: 'surprise'});
  b.setAttribute('aria-label', 'Surprise me & play'); b.onclick = () => surprise.click();
  surprise.hidden = true; grid.append(b, surprise);
 }
 if (studio) {
  const {b} = card(doc, {name: 'NEW IN STUDIO', line: 'SHAPE YOUR OWN', kind: 'studio'});
  b.setAttribute('aria-label', 'Course studio'); b.onclick = () => studio.click();
  studio.hidden = true; grid.append(b, studio);
 }
 const line = make(doc, 'div', 'sx-line');
 const facts = make(doc, 'span', 'sx-facts');
 const roundsBtn = make(doc, 'button', 'sx-rounds-btn');
 roundsBtn.type = 'button';
 line.append(facts, roundsBtn);
 for (const id of ['roundManage', 'roundDelete']) { const b = q(id); if (b) { b.classList.add('sx-small'); line.append(b); } }
 // The saved rounds, open from the line (they were the lobby's own tab).
 const saved = make(doc, 'div', 'sx-saved');
 const oldSaved = sectionOf('Saved rounds');
 if (oldSaved) saved.append(...[...oldSaved.childNodes].filter(n => n.tagName !== 'H3'));
 saved.hidden = !opts.savedOpen;
 scroll.hidden = !saved.hidden;
 const nRounds = saved.querySelectorAll('.course-card').length;
 const paintRounds = () => { roundsBtn.textContent = saved.hidden ? `${nRounds} SAVED ROUND${nRounds === 1 ? '' : 'S'} ▸` : 'BACK TO THE COURSES ▸'; };
 roundsBtn.onclick = () => { saved.hidden = !saved.hidden; scroll.hidden = !saved.hidden; paintRounds(); opts.onSaved?.(!saved.hidden); };
 paintRounds();
 const paintCourse = () => {
  for (const [id, b] of cardFor) { b.classList.toggle('on', id === course.value); b.setAttribute('aria-pressed', String(id === course.value)); }
  const c = courses.find(x => x.id === course.value);
  facts.innerHTML = c ? `<strong>${esc(c.name.toUpperCase())}</strong><small>${esc(c.line)}${c.best ? ` · ${esc(c.best)}` : ''}</small>` : '<strong>NO SAVED COURSES</strong><small>PLAY THE COURSE OF THE WEEK, LET FAIRWAY SURPRISE YOU, OR SHAPE ONE IN THE STUDIO</small>';
  opts.onCourse?.(course.value);
 };
 course.addEventListener('change', paintCourse);
 course.hidden = true;
 p1.append(make(doc, 'h3', 'sx-head', `YOUR COURSES · ${courses.length + (weekly ? 1 : 0)}`), scroll, saved, line, course);
 paintCourse();
 pictures?.(queue, 240, 110);

 // 2 · GOLFERS.
 const p2 = page('sx-golfers');
 p2.append(make(doc, 'h3', 'sx-head', 'WHO’S PLAYING · 1 TO 4'));
 for (const id of ['playerRows', 'applyGroup']) { const n = q(id); if (n) p2.append(n); }

 // 3 · FORMAT.
 const p3 = page('sx-format');
 const tiles = make(doc, 'div', 'sx-formats');
 const paintFormats = () => { for (const b of tiles.querySelectorAll('button')) { const on = b.dataset.mode === mode.value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
 for (const o of [...mode.options].sort((a, b) => FORMAT_ORDER.indexOf(a.value) - FORMAT_ORDER.indexOf(b.value))) {
  const [line1, who] = FORMAT_CARD[o.value] || [o.textContent, ''];
  const b = make(doc, 'button', 'sx-format-card', `<strong>${esc(FORMAT_TILE[o.value] || o.textContent)}</strong><span>${esc(line1)}</span><small>${esc(who)}</small>`);
  b.type = 'button'; b.dataset.mode = o.value; b.disabled = mode.disabled;
  b.setAttribute('aria-label', `Format: ${o.textContent}`);
  b.onclick = () => { mode.value = o.value; fire(mode); };
  tiles.append(b);
 }
 const teams = make(doc, 'div', 'sx-teams');
 const paintTeams = () => {
  const on = TEAM_FORMATS.has(mode.value);
  teams.hidden = !on;
  if (!on) return;
  const seats = [...root.querySelectorAll('#playerRows .seat')];
  const side = t => seats.filter(s => s.querySelector('select[id^=team]')?.value === t);
  const chip = s => {
   const who = s.querySelector('select[id^=who]'), typed = s.querySelector('input[id^=name]');
   const name = (typed?.value || who?.options[who.selectedIndex]?.textContent || 'Golfer').trim();
   const b = make(doc, 'button', 'sx-team-golfer', `${s.querySelector('.player-mark')?.innerHTML || ''}<span>${esc(name.toUpperCase())}</span><small>MOVE ⇄</small>`);
   b.type = 'button'; b.setAttribute('aria-label', `Move ${name} to the other team`);
   b.onclick = () => { const t = s.querySelector('select[id^=team]'); t.value = t.value === 'A' ? 'B' : 'A'; fire(t); paintTeams(); };
   return b;
  };
  teams.textContent = '';
  teams.append(make(doc, 'h3', 'sx-head', mode.value === 'match' ? 'TEAMS · BEST BALL' : 'TEAMS'));
  const cols = make(doc, 'div', 'sx-team-cols');
  for (const [t, label] of [['A', 'TEAM 1'], ['B', 'TEAM 2']]) {
   const col = make(doc, 'div', 'sx-team', `<span class="sx-team-k">${label}</span>`);
   for (const s of side(t)) col.append(chip(s));
   cols.append(col);
  }
  teams.append(cols);
 };
 mode.addEventListener('change', () => { paintFormats(); paintTeams(); });
 mode.hidden = true;
 const note = q('formatNote');
 p3.append(make(doc, 'h3', 'sx-head', 'HOW ARE YOU PLAYING'), tiles);
 if (note) p3.append(note);
 p3.append(teams, mode);
 paintFormats();

 // 4 · RULES, and what you are about to play.
 const p4 = page('sx-rules');
 const rules = make(doc, 'div', 'sx-rules-col');
 rules.append(make(doc, 'h3', 'sx-head', 'HOUSE RULES'));
 const putting = q('roundPuttingMode'), ob = q('roundOB'), lie = q('roundMonLie');
 if (putting) rules.append(picker(doc, putting, 'PUTTING'));
 const dist = q('roundPutting-distances'); if (dist) rules.append(dist);
 if (ob) rules.append(picker(doc, ob, 'OUT OF BOUNDS'));
 if (lie) rules.append(picker(doc, lie, 'LIE PENALTY'));
 const help = make(doc, 'div', 'sx-help', '<span class="sx-help-k">PUTTING</span>');
 const puttNote = q('roundPuttingNote'); if (puttNote) help.append(puttNote);
 rules.append(help);
 const tee = q('roundTee'); if (tee) { tee.hidden = true; rules.append(tee); }
 const sum = make(doc, 'div', 'sx-summary');
 const paintSummary = () => {
  const c = courses.find(x => x.id === course.value);
  sum.textContent = '';
  sum.append(make(doc, 'h3', 'sx-head', 'YOU’RE ABOUT TO PLAY'));
  const pic = make(doc, 'span', 'sx-pic sx-sum-pic');
  sum.append(pic);
  if (c) pictures?.([{el: pic, settings: c.settings}], 480, 150);
  const fmt = mode.options[mode.selectedIndex]?.textContent.split(' · ')[0] || '';
  sum.append(make(doc, 'div', 'sx-sum-name', c ? `<strong>${esc(c.name.toUpperCase())}</strong><small>${esc(c.line)} · ${esc(fmt.toUpperCase())}</small>` : '<strong>CHOOSE A COURSE</strong><small>STEP 1</small>'));
  const who = make(doc, 'div', 'sx-sum-golfers');
  for (const s of root.querySelectorAll('#playerRows .seat')) who.append(make(doc, 'span', 'sx-sum-golfer', opts.golferLine?.(s) || ''));
  sum.append(who);
 };
 const err = q('roundError');
 p4.append(rules, sum);
 if (err) p4.append(err);

 // Everything the old sections held that has not found a step is put away.
 for (const s of root.querySelectorAll('.panel-section')) s.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-tabs')?.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-lead')?.classList.add('sx-emptied');
 const start = q('startRound');
 if (start) start.innerHTML = 'Tee off <small>HOLE 1</small>';

 // Teams follow the golfers as seats are added, removed and moved.
 const rows = q('playerRows');
 if (rows && globalThis.MutationObserver) new MutationObserver(() => paintTeams()).observe(rows, {childList: true});
 const sheet = stepSheet(root, {
  steps: [{label: 'Course', page: p1}, {label: 'Golfers', page: p2}, {label: 'Format', page: p3, onShow: paintTeams}, {label: 'Rules', page: p4, onShow: paintSummary}],
  index: opts.step ?? 0, finish: start, onStep: opts.onStep,
  hints: [['← →', 'Choose'], ['Enter', 'Next'], ['Esc', 'Back']], doc,
 });
 return sheet;
}
