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

// CHALLENGES: the challenge of the week as a banner across the top; the
// categories down the left with their medals; the tab's challenges as cards in
// two columns; the chosen one's detail -- how it plays, what each medal asks,
// your record -- on the right, with the group under it (PLACED: the mockup
// draws no group; a challenge needs one).
export function buildChallenges(root, doc = globalThis.document) {
 const week = root.querySelector('.chal-week-row'), cats = root.querySelector('.chal-tabs');
 const cards = [...root.querySelectorAll('.chal-cards')].find(c => !c.classList.contains('chal-week-row'));
 if (!week || !cats || !cards || root.querySelector('.ch')) return false;
 const ch = make(doc, 'div', 'ch');
 const detail = make(doc, 'section', 'ch-detail'), group = make(doc, 'section', 'ch-group');
 const [, about, players] = sectionsOf(root);
 if (about) detail.append(...about.childNodes);
 if (players) group.append(...players.childNodes);
 // The start button is the screen's main button (bottom right, fixed).
 const go = root.querySelector('#challengeGo');
 ch.append(week, cats, cards, detail);
 detail.append(group);
 for (const s of sectionsOf(root)) s.remove();
 root.querySelector(':scope>.panel-columns')?.remove();
 // The section tabs are gone with their sections; the main button stays.
 const tabs = root.querySelector(':scope>.panel-tabs:not(.chal-tabs)');
 if (tabs) { if (go) root.append(go); tabs.remove(); }
 root.append(ch);
 root.classList.add('ch-root');
 return true;
}

// THE COURSE OF THE WEEK (round 13, frame c-cotw), on one screen: the picture
// with the week and the course's name (7 columns), eight fact tiles (5), the
// earlier weeks along the foot. A second step holds the golfers and the tees
// and rules (PLACED: the frame has only Play; a round needs a group). Play shows
// on both steps. main.js writes the frame's own blocks (`weeklyBlocks`).
export function buildWeekly(root, {step = 0, onStep, doc = globalThis.document} = {}) {
 const hero = root.querySelector('.wk-hero'), earlier = root.querySelector('.wk-earlier'), facts = root.querySelector('.wk-facts');
 if (!hero || !facts || root.querySelector('.sx')) return false;
 const p1 = make(doc, 'section', 'sx-body wk');
 p1.append(hero, facts);
 if (earlier) p1.append(earlier);
 const p2 = make(doc, 'section', 'sx-body sx-golfers wk-group');
 p2.append(make(doc, 'h3', 'sx-head', 'WHO\u2019S PLAYING \u00b7 1 TO 4'));
 const rows = root.querySelector('#playerRows'); if (rows) p2.append(rows);
 const rules = make(doc, 'div', 'wk-rules');
 for (const s of sectionsOf(root)) for (const n of [...s.childNodes]) if (n.nodeType === 1 && n.tagName !== 'H3' && n.id !== 'playerRows') rules.append(n);
 p2.append(rules);
 for (const s of sectionsOf(root)) s.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-tabs')?.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-lead')?.classList.add('sx-emptied');
 const go = root.querySelector('#weeklyGo');
 // Round 14 (frames c-cotw1, c-cotw2): Play only on the Golfers step.
 stepSheet(root, {steps: [{label: 'This week', page: p1}, {label: 'Golfers', page: p2}], index: step, finish: go, onStep,
  hints: [['Enter', 'Next'], ['Esc', 'Back']], doc});
 return true;
}

// A FRIEND'S CHALLENGE (rival.js, 20 October 2026): the course of the week's
// two steps, for a pasted code -- 1 the code and what it holds (the card, the
// course, the rules they played), 2 the golfers, their rules and Play. No
// mockup exists for it; PLACED on the course of the week's frames.
export function buildFriend(root, {step = 0, onStep, doc = globalThis.document} = {}) {
 const secs = sectionsOf(root), first = secs.find(s => s.dataset.title === 'The challenge');
 if (!first || root.querySelector('.sx')) return false;
 const p1 = make(doc, 'section', 'sx-body fr');
 for (const n of [...first.childNodes]) if (n.nodeType === 1 && n.tagName !== 'H3') p1.append(n);
 const p2 = make(doc, 'section', 'sx-body sx-golfers wk-group');
 p2.append(make(doc, 'h3', 'sx-head', 'WHO’S PLAYING · 1 TO 4'));
 const rows = root.querySelector('#playerRows'); if (rows) p2.append(rows);
 const rules = make(doc, 'div', 'wk-rules');
 for (const s of secs) if (s !== first) for (const n of [...s.childNodes]) if (n.nodeType === 1 && n.tagName !== 'H3' && n.id !== 'playerRows') rules.append(n);
 p2.append(rules);
 for (const s of secs) s.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-tabs')?.classList.add('sx-emptied');
 root.querySelector(':scope>.panel-lead')?.classList.add('sx-emptied');
 stepSheet(root, {steps: [{label: 'The challenge', page: p1}, {label: 'Golfers', page: p2}], index: step, finish: root.querySelector('#rivalGo'), onStep,
  hints: [['Enter', 'Next'], ['Esc', 'Back']], doc});
 return true;
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
 shelf.append(add);
 list.replaceWith(shelf);
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
 tabs.addEventListener('click', () => setTimeout(paint));
 paint();
 return true;
}
