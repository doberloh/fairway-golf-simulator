// CHALLENGES, THE COURSE OF THE WEEK AND SAVED COURSES, LAID OUT AS THE
// APPROVED MOCKUPS (the 1.0 interface, 17 October 2026; mockups
// `r10('challenges')`, `r10('cotw')`, `r10('library')`; PROJECT_HANDOFF *The
// 1.0 lobby* -- the same approach).
//
// MOVED, NOT REBUILT: renderPanel and renderChallengeSetup write and wire each
// screen as before (every data- attribute and id the journeys click), and
// groupPanelContent groups it; these place the nodes on the mockup's grid.
// Not in the course studio, whose sheet keeps the old layout (ui-sheets.css
// does not reach it there).

import {stepSheet} from './ui-steps.js';

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const sectionsOf = root => [...root.querySelectorAll(':scope>.panel-section,:scope>.panel-columns>.panel-section')];

// CHALLENGES, IN THREE STEPS (UI/UX pass V2, 21 October 2026; the owner:
// Challenges "have their own main row back ... keep the same menu flow the
// best we can", with "a golfers tab, but rules ... set so that all users have
// the same experience"). The steps Play has, in its sheet:
//   1 Challenge  the challenge of the week as a banner across the top; the
//                categories down the left with their medals; the tab's
//                challenges as cards in two columns; the chosen one's detail --
//                how it plays, what each medal asks, your record -- on the right.
//   2 Golfers    the seats, as Play's.
//   3 Rules      the rules every challenge plays (challenges.js
//                CHALLENGE_RULE_ROWS), shown and not chosen, and what you are
//                about to play; Start on this step.
// `opts`: rules [[name, value, line]], who (the seats' heading), summary()
// -> {name, line, golfers: [html]}, step, onStep(i).
export function buildChallenges(root, {rules = [], who = 'WHO’S PLAYING · 1 TO 4', summary, step = 0, onStep, doc = globalThis.document} = {}) {
 const week = root.querySelector('.chal-week-row'), cats = root.querySelector('.chal-tabs');
 const cards = [...root.querySelectorAll('.chal-cards')].find(c => !c.classList.contains('chal-week-row'));
 if (!week || !cats || !cards || root.querySelector('.ch')) return null;
 const page = cls => make(doc, 'section', 'sx-body ' + cls);
 const ch = make(doc, 'div', 'ch');
 const detail = make(doc, 'section', 'ch-detail');
 const [, about, players] = sectionsOf(root);
 // The start button, before its section goes: it is the last step's main button.
 const go = root.querySelector('#challengeGo');
 if (about) detail.append(...about.childNodes);
 ch.append(week, cats, cards, detail);
 const p1 = page('ch-page'); p1.append(ch);
 // 2 · Golfers: Play's seats.
 const p2 = page('sx-golfers ch-golfers');
 p2.append(make(doc, 'h3', 'sx-head', esc(who)));
 const err = root.querySelector('#roundError');
 if (players) for (const n of [...players.childNodes]) if (n.nodeType === 1 && n.tagName !== 'H3' && n !== err) p2.append(n);
 // 3 · Rules: fixed, as rows with their value and no arrows.
 const p3 = page('sx-rules');
 const col = make(doc, 'div', 'sx-rules-col');
 col.append(make(doc, 'h3', 'sx-head', 'THE SAME RULES FOR EVERYONE'));
 for (const [k, v, sub] of rules) col.append(make(doc, 'div', 'lb-pick lb-fixed', `<span class="lb-k"><span class="lb-label">${esc(k)}</span><span class="lb-sub">${esc(sub)}</span></span><span class="lb-v"><span class="lb-val">${esc(v)}</span></span>`));
 col.append(make(doc, 'p', 'note sx-fixed', 'A challenge is the same test on every copy of Fairway, so its rules are not yours to change: your house rules come back in your next round.'));
 const sum = make(doc, 'div', 'sx-summary');
 const paintSummary = () => {
  const s = summary?.() || {};
  sum.textContent = '';
  sum.append(make(doc, 'h3', 'sx-head', 'YOU’RE ABOUT TO PLAY'),
   make(doc, 'div', 'sx-sum-name', `<strong>${esc(String(s.name || '').toUpperCase())}</strong><small>${esc(String(s.line || '').toUpperCase())}</small>`));
  const g = make(doc, 'div', 'sx-sum-golfers');
  for (const h of s.golfers || []) g.append(make(doc, 'span', 'sx-sum-golfer', h));
  sum.append(g);
 };
 p3.append(col, sum);
 for (const s of sectionsOf(root)) s.remove();
 root.querySelector(':scope>.panel-columns')?.remove();
 root.querySelector(':scope>.panel-tabs:not(.chal-tabs)')?.remove();
 root.querySelector(':scope>.panel-lead')?.classList.add('sx-emptied');
 return stepSheet(root, {
  steps: [{label: 'Challenge', page: p1}, {label: 'Golfers', page: p2}, {label: 'Rules', page: p3, onShow: paintSummary}],
  index: step, finish: go, onStep, alert: err,
  hints: [['↑ ↓', 'Choose'], ['Enter', 'Next'], ['Esc', 'Back']], doc,
 });
}

// SAVED COURSES: the courses as a shelf of cards, each the picture and its
// caption as one leaning shape with the course's own buttons -- Play, Rename,
// Copy code, Delete -- as small icons along its foot, and a card to start a
// new one in the studio. Until 20 October 2026 a card was chosen and its
// buttons moved to a column on the right with the name and the code; the owner
// asked for them on the card, so the column went (the code shows under the
// shelf when Copy code is pressed). The tabs stay: Save a course and Import &
// export are theirs. `onNew()` opens the studio.
export function buildLibrary(root, {onNew, doc = globalThis.document} = {}) {
 const list = root.querySelector('.panel-section[data-title="Your courses"] .course-list');
 if (!list || root.querySelector('.lib-shelf')) return false;
 const section = list.closest('.panel-section');
 const shelf = make(doc, 'div', 'lib-shelf');
 // Every card, the ones being renamed (edit rows) as they are.
 for (const c of list.querySelectorAll(':scope>.course-card')) shelf.append(c);
 const add = make(doc, 'button', 'lib-new', '<b>+</b><span>NEW IN STUDIO</span>');
 add.type = 'button'; add.onclick = () => onNew?.();
 // IMPORT, AS A CARD (UI/UX pass, 21 October 2026): an empty library was a line
 // of small text and a squashed card; a code to paste is the other way in.
 const imp = make(doc, 'button', 'lib-new lib-import', '<b>⇩</b><span>IMPORT A CODE</span>');
 imp.type = 'button'; imp.onclick = () => [...root.querySelectorAll('.panel-tab')].find(t => /import/i.test(t.textContent))?.click();
 shelf.append(add, imp);
 list.replaceWith(shelf);
 const empty = section.querySelector('.lib-empty'); if (empty) shelf.before(empty);
 section.classList.add('lib-courses');
 root.classList.add('lib-root');
 return true;
}

// KEYS & HELP (round 14, frame c-help): the topics down the left -- the panel's
// own tab buttons, so they keep their names -- the page in the middle as short
// paragraphs under "N OF M" and its title, and that page's keys on the right.
// The words are today's help text, one topic a page. `keys` is {topic title:
// [[key, what]]}; the essentials' own key list (`.help-shortcuts`) is read from
// its page and shown on the right instead of in the text.
export function buildHelp(root, {keys = {}, doc = globalThis.document} = {}) {
 const tabs = root.querySelector(':scope>.panel-tabs'), sections = [...root.querySelectorAll(':scope>.panel-section')];
 if (!tabs || !sections.length || root.querySelector('.hp')) return false;
 const hp = make(doc, 'div', 'hp');
 const page = make(doc, 'section', 'hp-page'), head = make(doc, 'div', 'hp-head', '<small></small><strong></strong>');
 const side = make(doc, 'aside', 'hp-keys');
 tabs.classList.add('hp-topics');
 tabs.setAttribute('aria-orientation', 'vertical');
 page.append(head, ...sections);
 hp.append(tabs, page, side);
 root.querySelector(':scope>.panel-lead')?.classList.add('hp-lead');
 root.append(hp);
 root.classList.add('hp-root');
 // The essentials' grid of keys becomes their keys column.
 const grid = root.querySelector('.help-shortcuts');
 const own = grid ? [...grid.querySelectorAll('kbd')].map(k => [k.textContent.replace(/\s*\/\s*/g, ' '), k.nextElementSibling?.textContent || '']) : [];
 if (grid) grid.hidden = true;
 const paint = () => {
  const i = Math.max(0, sections.findIndex(s => !s.hidden)), s = sections[i], title = s.dataset.title || '';
  head.querySelector('small').textContent = `${i + 1} OF ${sections.length}`;
  head.querySelector('strong').textContent = title.toUpperCase();
  const list = keys[title] || (s.contains(grid) ? own : []);
  side.innerHTML = `<h4>${list.length ? 'KEYS ON THIS PAGE' : 'NO KEYS ON THIS PAGE'}</h4>` + list.map(([k, w]) => `<div class="hp-key"><kbd>${esc(k)}</kbd><span>${esc(String(w).toUpperCase())}</span></div>`).join('');
  page.scrollTop = 0;
 };
 tabs.addEventListener('click', () => setTimeout(() => { paint(); bringIntoView(page, doc); }));
 paint();
 return true;
}

// A PICKED PAGE COMES INTO VIEW (audit 5, 22 October 2026). On a phone held
// sideways the screens stack: Help's seven topics fill the first screen and
// the topic's text starts just under its foot, so a tap lit a row and nothing
// else moved. When what was picked starts in the bottom 80 px or lower, it is
// scrolled up to the top. Help's topics and My profile's tabs use it.
export function bringIntoView(el, doc = globalThis.document) {
 const win = doc?.defaultView, top = el?.getBoundingClientRect?.().top;
 if (!win || !Number.isFinite(top) || top < win.innerHeight - 80) return false;
 const still = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 el.scrollIntoView?.({block: 'start', behavior: still ? 'auto' : 'smooth'});
 return true;
}
