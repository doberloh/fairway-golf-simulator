// MY PROFILE AS THE APPROVED HUB (the 1.0 interface, 17 October 2026;
// mockups `r10('profile')` and `r10('locker')`, PROJECT_HANDOFF *The 1.0
// lobby* -- the same approach).
//
// The golfers as chips in the header band; down the left, who this is (the
// ball in its frame, name, title), the level and its bar, the sim handicap,
// and how long they have played; on the right six tabs -- Overview (eight
// numbers, the last three rounds, the next unlock), Locker (the look: kinds
// down the side, the grid, and what is worn now), Achievements, Stats, Bag,
// History.
//
// MOVED, NOT REBUILT: renderProfile writes the old page (every id, data-
// attribute and handler the journeys use), plus the few new blocks the hub
// needs (.ph-since, .ph-overview, .ph-preview); this sorts the old page's
// sections, by their headings, into the tabs. The tab shown is kept by main.js
// (`onTab`), because every choice on the page redraws it.

const make = (doc, tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export const HUB_TABS = ['Overview', 'Locker', 'Achievements', 'Stats', 'Bag', 'History'];

// Which tab each of the old page's headings goes to (its first word).
const SECTION_TAB = {'Your look': 'Locker', Achievements: 'Achievements', Challenges: 'Achievements', Overall: 'Stats', Scoring: 'Stats', Bag: 'Bag', 'Round history': 'History', 'Back up': 'History'};
export function tabOfHeading(text) {
 const t = String(text || '').trim();
 const key = Object.keys(SECTION_TAB).find(k => t === k || t.startsWith(k + ' ') || t.startsWith(k + ' '));
 return key ? SECTION_TAB[key] : null;
}

// The overview's eight numbers, as the mockup chose them, from
// profileSummary(). `score` writes a score (decimal putting makes fractions).
export function overviewTiles(s, score = v => String(v)) {
 const n = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('en-US', {maximumFractionDigits: d, minimumFractionDigits: d}) : '—');
 const pct = r => (r && r.of ? `${Math.round(r.hit / r.of * 100)}` : '—');
 return [
  {value: s.best18 ? score(s.best18.t.score) : '—', unit: '', label: 'BEST 18'},
  {value: n(s.bests?.longestDrive), unit: s.bests?.longestDrive ? 'YD' : '', label: 'LONGEST DRIVE'},
  {value: n(s.bests?.ballSpeed, 1), unit: s.bests?.ballSpeed ? 'MPH' : '', label: 'FASTEST BALL'},
  {value: n(s.scoringAverage?.[4], 2), unit: '', label: 'PAR 4 AVERAGE'},
  {value: pct(s.greens), unit: s.greens?.of ? '%' : '', label: 'GREENS IN REG'},
  {value: pct(s.fairways), unit: s.fairways?.of ? '%' : '', label: 'FAIRWAYS HIT'},
  {value: n(s.puttsPerHole, 2), unit: '', label: 'PUTTS PER HOLE'},
  {value: n(s.types?.birdie ?? 0), unit: '', label: 'BIRDIES'},
 ];
}

// `tab` is the tab to show; `onTab(name)` hears a change.
export function buildProfileHub(page, {tab = 'Overview', onTab, doc = globalThis.document} = {}) {
 if (!page || page.querySelector('.ph')) return false;
 const hub = make(doc, 'div', 'ph');
 const side = make(doc, 'section', 'ph-side'), main = make(doc, 'section', 'ph-main');
 const tabs = make(doc, 'div', 'panel-tabs ph-tabs');
 tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Profile');
 const panes = Object.fromEntries(HUB_TABS.map(t => [t, make(doc, 'div', 'ph-pane ph-tab-' + t.toLowerCase())]));

 // The golfers' chips go to the header band.
 const chips = page.querySelector(':scope>.profile-switch');
 if (chips) { chips.classList.add('ph-chips'); hub.append(chips); }

 // The left stack: who, the level, the handicap, playing since.
 const head = page.querySelector(':scope>.profile-head');
 if (head) side.append(...head.children);
 const since = page.querySelector(':scope>.ph-since'); if (since) side.append(since);
 const note = page.querySelector(':scope>.xp-new'); if (note) side.append(note);

 // The overview and the locker's preview were written for the hub.
 const overview = page.querySelector(':scope>.ph-overview'); if (overview) panes.Overview.append(overview);
 const preview = page.querySelector(':scope>.ph-preview');

 // Every other section, heading and all, to its tab.
 let to = null;
 for (const n of [...page.children]) {
  if (n === hub || n === head) continue;
  if (n.tagName === 'H3') to = tabOfHeading(n.textContent) || to;
  if (to) panes[to].append(n);
 }
 // On the Locker tab the left stack is what is worn now (the mockup's live
 // preview) instead of the level and handicap: ui-sheets.css swaps them.
 if (preview) side.append(preview);
 // The look's own kinds (Ball, Tracer...) are the locker's category list.
 panes.Locker.querySelector('.look-tabs')?.classList.add('ph-kinds');
 head?.remove();

 const show = name => {
  hub.dataset.tab = name;
  for (const t of HUB_TABS) {
   panes[t].hidden = t !== name;
   const b = tabs.querySelector(`[data-hub-tab="${t}"]`);
   b.classList.toggle('active', t === name); b.setAttribute('aria-selected', String(t === name));
  }
 };
 for (const t of HUB_TABS) {
  const b = make(doc, 'button', 'panel-tab', t);
  b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.hubTab = t;
  b.onclick = () => { show(t); onTab?.(t); };
  tabs.append(b);
 }
 main.append(tabs, ...HUB_TABS.map(t => panes[t]));
 hub.append(side, main);
 page.append(hub);
 page.classList.add('ph-root');
 show(HUB_TABS.includes(tab) ? tab : 'Overview');
 return true;
}
