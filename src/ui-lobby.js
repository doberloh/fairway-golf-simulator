// PLAY, STEP BY STEP (round 13, the owner, 17 October 2026: the one-screen
// lobby goes back to a sequence of menus; mockups `r13('c-play1')` to
// `('c-play4')`, PROJECT_HANDOFF *The 1.0 lobby*).
//
//   1 Game     what you are playing, as six cards (UI/UX pass V2): the
//              course of the week, Endless, a saved course, a friend's
//              challenge, Surprise me, New course in studio; the saved rounds
//              open from the foot.
//   + its own  The week (the week's page: picture, facts, earlier weeks),
//              Landscape (Endless), Course (your shelf and an import box) or
//              The challenge (the friend's code); Surprise me has none.
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

// A course card: the picture, then the caption. `pic` gets the drawing. Its
// kind becomes a class `sx-<kind>`: never a name a step already uses (an
// Endless card called `sx-endless` took the Endless step's two-column grid).
function card(doc, {name, line, tag, best, kind}) {
 const b = make(doc, 'button', 'sx-card' + (kind ? ' sx-' + kind : ''));
 b.type = 'button';
 const mark = {surprise: '?', studio: '+', friend: 'VS', run: '∞', challenges: '★', saved: '↓'}[kind];
 const pic = make(doc, 'span', 'sx-pic', mark ? `<b>${mark}</b>` : '');
 const cap = make(doc, 'span', 'sx-cap', `${tag ? `<em>${esc(tag)}</em>` : ''}<strong>${esc(name)}</strong><small>${esc(line)}${best ? ` · <i>${esc(best)}</i>` : ''}</small>`);
 b.append(pic, cap);
 return {b, pic};
}

// The format as cards in front of the real drop-down. Returns {tiles, paint}.
export function formatCards(doc, mode) {
 const tiles = make(doc, 'div', 'sx-formats');
 const paint = () => { for (const b of tiles.querySelectorAll('button')) { const on = b.dataset.mode === mode.value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
 for (const o of [...mode.options].sort((a, b) => FORMAT_ORDER.indexOf(a.value) - FORMAT_ORDER.indexOf(b.value))) {
  const [line1, who] = FORMAT_CARD[o.value] || [o.textContent, ''];
  const b = make(doc, 'button', 'sx-format-card', `<strong>${esc(FORMAT_TILE[o.value] || o.textContent)}</strong><span>${esc(line1)}</span><small>${esc(who)}</small>`);
  b.type = 'button'; b.dataset.mode = o.value; b.disabled = mode.disabled;
  b.setAttribute('aria-label', `Format: ${o.textContent}`);
  b.onclick = () => { mode.value = o.value; fire(mode); };
  tiles.append(b);
 }
 tiles.dataset.count = String(tiles.children.length);
 mode.addEventListener('change', paint);
 paint();
 return {tiles, paint};
}

// The house rules as pickers and putting's distances (what each putting choice
// means is no longer written out: the owner, 18 October 2026); the round's own tee drop-down kept, hidden (each golfer has a tee).
export function rulesColumn(doc, q) {
 const rules = make(doc, 'div', 'sx-rules-col');
 rules.append(make(doc, 'h3', 'sx-head', 'HOUSE RULES'));
 const putting = q('roundPuttingMode'), ob = q('roundOB'), lie = q('roundMonLie');
 if (putting) rules.append(picker(doc, putting, 'PUTTING'));
 const dist = q('roundPutting-distances'); if (dist) rules.append(dist);
 if (ob) rules.append(picker(doc, ob, 'OUT OF BOUNDS'));
 if (lie) rules.append(picker(doc, lie, 'LIE PENALTY'));
 const tee = q('roundTee'); if (tee) { tee.hidden = true; rules.append(tee); }
 return rules;
}

// A SEAT'S NAME, NOTHING CLIPPED (round 14, frame c-play2l): the name steps
// down 24 / 20 / 17 / 15 px (the mockup's sizes) as it gets longer, then ends in
// "..." (CSS). By letters, not measured: the seat is one width everywhere. Pure.
export function nameSize(name) {
 const n = String(name ?? '').trim().length;
 return n <= 9 ? 'nm-24' : n <= 12 ? 'nm-20' : n <= 15 ? 'nm-17' : 'nm-15';
}

// ENDLESS'S OWN STEP IN PLAY (UI/UX pass, 21 October 2026): the landscapes as
// drawn pictures or Any, and THE RUN -- the goal and your best run. `e`:
// landscapes [{key, name, settings}], landscape, onLandscape(key), best, pictures.
export function landscapePage(doc, e, q) {
 const p = make(doc, 'section', 'sx-body sx-endless');
 const grid = make(doc, 'div', 'sx-lands');
 const queue = [], cards = [];
 const paint = key => { for (const b of cards) { const on = b.dataset.land === key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
 for (const l of e.landscapes || []) {
  const b = make(doc, 'button', 'sx-land');
  b.type = 'button'; b.dataset.land = l.key;
  const pic = make(doc, 'span', 'sx-pic');
  b.append(pic, make(doc, 'span', 'sx-land-name', esc(l.name.toUpperCase())));
  b.onclick = () => { e.onLandscape?.(l.key); paint(l.key); };
  grid.append(b); cards.push(b); queue.push({el: pic, settings: l.settings});
 }
 const any = make(doc, 'button', 'sx-land sx-any', '<span class="sx-land-name">ANY · A NEW ONE EACH HOLE</span>');
 any.type = 'button'; any.dataset.land = 'any';
 any.onclick = () => { e.onLandscape?.('any'); paint('any'); };
 grid.append(any); cards.push(any);
 const side = make(doc, 'div', 'sx-endless-side');
 side.append(make(doc, 'h3', 'sx-head', 'THE RUN'));
 const goal = q('endlessGoal');
 if (goal) side.append(picker(doc, goal, 'GOAL', {words: t => ({value: t.split(' · ')[0], sub: t.split(' · ')[1] || ''})}));
 // What a run is, so the column is not a lone picker (UI/UX pass V2).
 side.append(make(doc, 'ul', 'sx-run-how', ['ONE HOLE AFTER ANOTHER, GROWN AS YOU GO', 'NO LAST HOLE: STOP WHEN YOU LIKE, PICK IT UP LATER', 'SUDDEN DEATH ENDS AT YOUR FIRST BOGEY'].map(t => `<li>${esc(t)}</li>`).join('')));
 if (e.best) side.append(make(doc, 'div', 'sx-best', `<span class="sx-help-k">YOUR BEST RUN</span><strong>${esc(e.best.line)}</strong><small>${esc(e.best.sub || '')}</small>`));
 const lands = make(doc, 'div', 'sx-lands-col');
 lands.append(make(doc, 'h3', 'sx-head', 'LANDSCAPE'), grid);
 p.append(lands, side);
 paint(e.landscape || 'any');
 e.pictures?.(queue, 200, 90);
 return p;
}

// PLAY'S GAME TYPES, in the order of their cards, and each one's own step
// (none for Surprise me). Pure: playSteps(game) is the labels Play shows.
export const GAME_TYPES = ['weekly', 'endless', 'saved', 'friend', 'surprise'];
export const GAME_STEP = {weekly: 'The week', endless: 'Landscape', saved: 'Course', friend: 'The challenge', surprise: null};
export const playSteps = game => ['Game', ...(GAME_STEP[game] ? [GAME_STEP[game]] : []), 'Golfers', 'Format', 'Rules'];

// `opts`: game (the type), onGame(type), courses [{id, name, settings, line,
// best}], weekly {name, line, tag, settings, page(section)} or null, friend
// {name, line, ready} (a friend's challenge, rival.js), endless (see
// landscapePage), surprise {name, line, settings} (the course rolled for
// Surprise me), pictures(items, w, h), step, onStep(i), golferLine(seatEl).
export function buildLobby(root, opts = {}, doc = globalThis.document) {
 const q = id => root.querySelector('#' + id);
 const course = q('roundCourse'), mode = q('roundMode');
 if (!course || !mode || root.querySelector('.sx')) return null;
 const sectionOf = title => [...root.querySelectorAll('.panel-section')].find(s => s.dataset.title === title);
 const {courses = [], weekly = null, pictures} = opts;
 const page = cls => make(doc, 'section', 'sx-body ' + cls);

 // 1 · GAME, then the game's own step (UI/UX pass V2, 21 October 2026; the
 // owner: "after clicking play ... the user should be presented with a set of
 // game type options ... then go through the same steps to start a round").
 // Six cards: the course of the week (its page of facts next), Endless (the
 // landscape next), a saved course (your shelf and an import box next), a
 // friend's challenge (the code next), Surprise me (a course rolled now, shown
 // on the last step) and New course in studio (leaves for the studio). Then
 // Golfers, Format and Rules for every one of them.
 //
 // `opts.game` is the type; the course drop-down holds `weekly`, `endless`,
 // `friend`, `surprise` or a saved course's id. A card calls onGame(type) and
 // main.js redraws Play on the type's own step.
 const game = opts.game || 'weekly';
 const p1 = page('sx-course sx-game');
 const grid = make(doc, 'div', 'sx-cards sx-games');
 const queue = [];
 const typeCard = (k, {name, line, tag, cls, label, settings}) => {
  const {b, pic} = card(doc, {name, line, tag, kind: cls});
  b.setAttribute('aria-label', label); b.dataset.game = k;
  b.classList.toggle('on', k === game); b.setAttribute('aria-pressed', String(k === game));
  b.onclick = () => opts.onGame?.(k);
  grid.append(b);
  if (settings) queue.push({el: pic, settings});
 };
 if (weekly) typeCard('weekly', {name: 'COURSE OF THE WEEK', line: weekly.name.toUpperCase(), tag: weekly.tag, label: 'Course of the week', settings: weekly.settings});
 if (opts.endless) typeCard('endless', {name: 'ENDLESS', line: 'ONE HOLE AFTER ANOTHER · NO LAST HOLE', tag: 'A RUN', cls: 'run', label: 'Endless'});
 typeCard('saved', {name: 'SAVED COURSE', line: courses.length ? `${courses.length} OF YOURS · OR IMPORT A CODE` : 'IMPORT A CODE A FRIEND SENT', tag: 'YOUR SHELF', cls: courses.length ? '' : 'saved', label: 'Saved course', settings: courses[0]?.settings});
 if (opts.friend) typeCard('friend', {name: 'FRIEND CHALLENGE', line: opts.friend.line, tag: opts.friend.name, cls: 'friend', label: 'Friend challenge'});
 typeCard('surprise', {name: 'SURPRISE ME', line: 'A NEW NINE FROM RANDOM SETTINGS', tag: 'NEW', cls: 'surprise', label: 'Surprise me', settings: opts.surprise?.settings});
 const studio = q('roundStudio'), surprise = q('roundSurprise');
 if (studio) {
  const {b} = card(doc, {name: 'NEW COURSE IN STUDIO', line: 'SHAPE YOUR OWN, THEN PLAY IT', tag: 'COURSE STUDIO', kind: 'studio'});
  b.setAttribute('aria-label', 'New course in studio'); b.dataset.game = 'studio';
  b.onclick = () => studio.click();
  studio.hidden = true; grid.append(b, studio);
 }
 if (surprise) { surprise.hidden = true; grid.append(surprise); }
 // The saved rounds open from the foot of this step: resuming one is a way to
 // play too, whatever its course.
 const gamesScroll = make(doc, 'div', 'sx-scroll');
 gamesScroll.append(grid);
 const line = make(doc, 'div', 'sx-line sx-line-end');
 const roundsBtn = make(doc, 'button', 'sx-rounds-btn');
 roundsBtn.type = 'button';
 line.append(roundsBtn);
 const saved = make(doc, 'div', 'sx-saved');
 const oldSaved = sectionOf('Saved rounds');
 if (oldSaved) saved.append(...[...oldSaved.childNodes].filter(n => n.tagName !== 'H3'));
 saved.hidden = !opts.savedOpen;
 gamesScroll.hidden = !saved.hidden;
 const nRounds = saved.querySelectorAll('.course-card').length;
 // With none saved the button still shows: the list is also where a round file is imported.
 // The step's heading says which of the two is showing (the owner, 21 October 2026).
 const gameHead = make(doc, 'h3', 'sx-head');
 const paintRounds = () => { gameHead.textContent = saved.hidden ? 'WHAT ARE YOU PLAYING' : 'SAVED ROUNDS'; roundsBtn.textContent = !saved.hidden ? 'BACK TO THE GAMES ▸' : nRounds ? `${nRounds} SAVED ROUND${nRounds === 1 ? '' : 'S'} ▸` : 'SAVED ROUNDS · IMPORT A ROUND ▸'; };
 roundsBtn.onclick = () => { saved.hidden = !saved.hidden; gamesScroll.hidden = !saved.hidden; paintRounds(); opts.onSaved?.(!saved.hidden); };
 paintRounds();
 p1.append(gameHead, gamesScroll, saved, line);

 // The saved course's step: the shelf as cards, the chosen one named along the
 // foot with Manage and Delete, and a box for a code someone sent.
 const pSaved = page('sx-course sx-shelf');
 const cardFor = new Map();
 const sgrid = make(doc, 'div', 'sx-cards');
 const shelf = make(doc, 'div', 'sx-scroll');
 shelf.append(sgrid);
 for (const c of courses) {
  const {b, pic} = card(doc, {name: c.name, line: c.line, best: c.best});
  b.dataset.course = c.id;
  b.onclick = () => { course.value = c.id; fire(course); };
  sgrid.append(b); cardFor.set(c.id, b);
  if (game === 'saved') queue.push({el: pic, settings: c.settings});
 }
 const facts = make(doc, 'span', 'sx-facts');
 const sline = make(doc, 'div', 'sx-line');
 sline.append(facts);
 for (const id of ['roundManage', 'roundDelete']) { const b = q(id); if (b) { b.classList.add('sx-small'); sline.append(b); } }
 if (courses.length) pSaved.append(make(doc, 'h3', 'sx-head', 'YOUR COURSES'), shelf, sline);
 const imp = q('lobbyImport');
 if (imp) pSaved.append(make(doc, 'h3', 'sx-head', courses.length ? 'OR IMPORT A COURSE CODE' : 'IMPORT A COURSE CODE'), imp);
 if (!courses.length) pSaved.append(make(doc, 'p', 'note sx-shelf-note', 'No saved courses yet. Paste a code a friend sent, or go back and make one with New course in studio.'));

 // What is chosen.
 const chosen = () => course.value === 'weekly' && weekly ? {id: 'weekly', name: weekly.name, line: weekly.line, settings: weekly.settings, fixed: true}
  : course.value === 'endless' && opts.endless ? {id: 'endless', name: 'ENDLESS', line: 'ONE HOLE AFTER ANOTHER · NO LAST HOLE'}
  : course.value === 'friend' && opts.friend ? {id: 'friend', name: opts.friend.name, line: opts.friend.line, fixed: true, ready: opts.friend.ready}
  : course.value === 'surprise' && opts.surprise ? {id: 'surprise', name: opts.surprise.name, line: opts.surprise.line, settings: opts.surprise.settings}
  : courses.find(x => x.id === course.value);
 const paintCourse = () => {
  for (const [id, b] of cardFor) { b.classList.toggle('on', id === course.value); b.setAttribute('aria-pressed', String(id === course.value)); }
  const c = chosen();
  facts.innerHTML = c ? `<strong>${esc(c.name.toUpperCase())}</strong><small>${esc(c.line)}${c.best ? ` · ${esc(c.best)}` : ''}</small>` : '<strong>CHOOSE A COURSE</strong><small>OR IMPORT ONE BELOW</small>';
  opts.onCourse?.(course.value);
  lockFormat?.();
 };
 let lockFormat = null;
 course.addEventListener('change', paintCourse);
 course.hidden = true;
 p1.append(course);
 paintCourse();
 pictures?.(queue, 240, 110);

 // 2 · GOLFERS.
 const p2 = page('sx-golfers');
 p2.append(make(doc, 'h3', 'sx-head', 'WHO’S PLAYING · 1 TO 4'));
 for (const id of ['playerRows', 'applyGroup']) { const n = q(id); if (n) p2.append(n); }

 // 3 · FORMAT.
 const p3 = page('sx-format');
 const {tiles, paint: paintFormats} = formatCards(doc, mode);
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
 mode.addEventListener('change', paintTeams);
 mode.hidden = true;
 const note = q('formatNote');
 // The week is stroke play for everyone: the other formats are shown, not chosen.
 const fixedNote = make(doc, 'p', 'note sx-fixed', '');
 lockFormat = () => {
  const fixed = !!chosen()?.fixed;
  if (fixed && mode.value !== 'stroke') { mode.value = 'stroke'; fire(mode); }
  for (const b of tiles.querySelectorAll('button')) b.disabled = mode.disabled || (fixed && b.dataset.mode !== 'stroke');
  fixedNote.hidden = !fixed;
  fixedNote.textContent = course.value === 'friend' ? 'A friend’s challenge is stroke play: their card is strokes.' : 'The course of the week is stroke play: everyone plays the same 18 holes, so every card compares.';
 };
 p3.append(make(doc, 'h3', 'sx-head', 'HOW ARE YOU PLAYING'), tiles, fixedNote);
 if (note) p3.append(note);
 lockFormat();
 p3.append(teams, mode);

 // 4 · RULES, and what you are about to play.
 const p4 = page('sx-rules');
 const rules = rulesColumn(doc, q);
 const sum = make(doc, 'div', 'sx-summary');
 const paintSummary = () => {
  const c = chosen();
  sum.textContent = '';
  sum.append(make(doc, 'h3', 'sx-head', 'YOU’RE ABOUT TO PLAY'));
  const pic = make(doc, 'span', 'sx-pic sx-sum-pic');
  sum.append(pic);
  if (c) pictures?.([{el: pic, settings: c.settings}], 480, 150);
  const fmt = mode.options[mode.selectedIndex]?.textContent.split(' · ')[0] || '';
  sum.append(make(doc, 'div', 'sx-sum-name', c ? `<strong>${esc(c.name.toUpperCase())}</strong><small>${esc(c.line)} · ${esc(fmt.toUpperCase())}</small>` : '<strong>CHOOSE A COURSE</strong><small>STEP 1</small>'));
  // Surprise me's course was rolled when it was chosen: another can be rolled here.
  if (c?.id === 'surprise' && opts.surprise?.onRoll) {
   const roll = make(doc, 'button', 'sx-roll', 'ROLL ANOTHER COURSE ▸');
   roll.type = 'button'; roll.onclick = opts.surprise.onRoll;
   sum.append(roll);
  }
  const who = make(doc, 'div', 'sx-sum-golfers');
  for (const s of root.querySelectorAll('#playerRows .seat')) who.append(make(doc, 'span', 'sx-sum-golfer', opts.golferLine?.(s) || ''));
  sum.append(who);
 };
 const err = q('roundError');
 p4.append(rules, sum);

 // Everything the old sections held that has not found a step is put away.
 for (const s of root.querySelectorAll('.panel-section')) s.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-tabs')?.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-lead')?.classList.add('sx-emptied');
 const start = q('startRound');
 // main.js names the main button by the kind chosen (Tee off, Start the run...).
 if (start && !start.getAttribute('aria-label')) start.innerHTML = 'Tee off <small>HOLE 1</small>';

 // Teams follow the golfers as seats are added, removed and moved.
 const rows = q('playerRows');
 if (rows && globalThis.MutationObserver) new MutationObserver(() => paintTeams()).observe(rows, {childList: true});
 // GOLFERS & RULES, MID-ROUND (UI/UX pass, 21 October 2026): mid-round the panel
 // is the seats and Apply, not the four steps of a new round with a small
 // "Apply to this session" under them. The other steps' controls stay in the
 // page, put away, because their handlers read them.
 if (opts.midRound) {
  const apply = p2.querySelector('#applyGroup');
  // The house rules come too: out of bounds, the lie penalty and putting can change mid-round.
  p2.append(rules);
  const away = make(doc, 'div', 'sx-emptied'); away.hidden = true; away.append(p1, pSaved, p3, p4); root.append(away);
  if (apply) { apply.className = 'primary'; apply.textContent = 'Apply to this round'; }
  const one = stepSheet(root, {steps: [{label: 'Golfers', page: p2}], finish: apply, alert: err, hints: [['Esc', 'Back to the round']], doc});
  root.classList.add('sx-one-step');
  return one;
 }
 // The game's own step goes second; Surprise me has none (its course is shown
 // on Rules, where it can be rolled again).
 const own = game === 'weekly' && weekly?.page ? {label: GAME_STEP.weekly, page: weekly.page(page('wk'))}
  : game === 'endless' && opts.endless ? {label: GAME_STEP.endless, page: landscapePage(doc, opts.endless, q)}
  : game === 'saved' ? {label: GAME_STEP.saved, page: pSaved, done: () => !!chosen()}
  : game === 'friend' ? (() => {
   const sec = sectionOf('The challenge'), fp = page('fr');
   if (sec) for (const n of [...sec.childNodes]) if (n.nodeType === 1 && n.tagName !== 'H3') fp.append(n);
   return {label: GAME_STEP.friend, page: fp, done: () => !!opts.friend?.ready};
  })() : null;
 const steps = [{label: 'Game', page: p1}, ...(own ? [own] : []), {label: 'Golfers', page: p2}, {label: 'Format', page: p3, onShow: paintTeams}, {label: 'Rules', page: p4, onShow: paintSummary}];
 // A step not in this game keeps its controls in the page, put away.
 if (own?.page !== pSaved) { const away = make(doc, 'div', 'sx-emptied'); away.hidden = true; away.append(pSaved); root.append(away); }
 const sheet = stepSheet(root, {
  steps,
  index: opts.step ?? 0, finish: start, onStep: opts.onStep, alert: err,
  hints: [['← →', 'Choose'], ['Enter', 'Next'], ['Esc', 'Back']], doc,
 });
 return sheet;
}

// THE DRIVING RANGE, STEP BY STEP (round 14, frame c-range2; the old two tabs
// are gone): 1 Golfers -- the same seats as everywhere; 2 The range -- where
// to hit from, the targets, and the session so far. Open the range (Apply to
// this session, once in it) is on the last step only. main.js renders the two
// sections (`.rs-golfers`, `.rs-range`) and what they do.
export function buildRangeSetup(root, {step = 0, onStep, doc = globalThis.document} = {}) {
 const golfers = root.querySelector('.rs-golfers'), range = root.querySelector('.rs-range');
 if (!golfers || !range || root.querySelector('.sx')) return null;
 golfers.className = 'sx-body sx-golfers rs-golfers';
 range.className = 'sx-body rs-range';
 for (const s of root.querySelectorAll(':scope>.panel-section,:scope>.panel-lead,:scope>.panel-tabs,:scope>p')) s.classList.add('sx-emptied');
 // The targets' sliders drawn as segment bars filled to their value (--fill).
 for (const r of range.querySelectorAll('input[type=range]')) {
  const fill = () => r.style.setProperty('--fill', ((r.value - r.min) / ((r.max - r.min) || 1) * 100).toFixed(1) + '%');
  r.addEventListener('input', fill); fill();
 }
 return stepSheet(root, {
  steps: [{label: 'Golfers', page: golfers}, {label: 'The range', page: range}],
  index: step, finish: root.querySelector('#rangeGo'), onStep,
  hints: [['← →', 'Choose'], ['Enter', 'Next'], ['Esc', 'Back']], doc,
 });
}
