// THE TOUR'S SCREENS (the fairway-tour goal, 17 November 2026; SPEC sections
// 5 and 6): HTML from a tour and its event, as strings, so they are tested
// in Node; main.js puts them in the sheet and wires the buttons (each has a
// data-tour action). Nothing here changes a tour.
import {YOU, leaderboard, projectedCut, myGroup, teeTime, pairings, golferOf} from './tournament.js';
import {standings, awards, seasonOver, eventSettings, STRENGTH_NAMES, SHIPPED} from './tour.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// A score on the event's scale: to par (E, -3, +2) or points.
export const scoreText = (ev, v) => v == null ? '—' : ev.format === 'stableford' ? `${v} pts` : v === 0 ? 'E' : v > 0 ? `+${v}` : String(v);
export const money = v => '$' + Math.round(v || 0).toLocaleString('en-US');
const place = p => p == null ? '—' : String(p);
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

// THE LEADERBOARD: the leaders, the person wherever they are, the cut line.
export function leaderboardHtml(ev, {r = ev.round, thru = 0, partnerThru = {}, limit = 12} = {}) {
 const rows = leaderboard(ev, {r, thru, partnerThru}), cut = projectedCut(ev, rows.filter(x => !x.mc));
 const youAt = rows.findIndex(x => x.id === YOU), show = rows.slice(0, limit);
 if (youAt >= limit) show.push(null, rows[youAt]);
 const line = row => row ? `<tr class="${row.you ? 'you' : ''}${row.mc ? ' mc' : ''}"><td>${esc(row.pos)}</td><td>${esc(row.you ? row.name : row.short || row.name)}${row.nation ? ` <small>${esc(row.nation)}</small>` : ''}</td><td>${esc(scoreText(ev, row.total))}</td><td>${row.mc ? '' : esc(scoreText(ev, row.today))}</td><td>${row.mc ? 'MC' : row.thru >= ev.holes ? 'F' : row.thru || '—'}</td></tr>` : '<tr class="gap"><td colspan="5">…</td></tr>';
 return `<table class="tour-board"><thead><tr><th>Pos</th><th>Golfer</th><th>${ev.format === 'stableford' ? 'Points' : 'To par'}</th><th>Today</th><th>Thru</th></tr></thead><tbody>${show.map(line).join('')}</tbody></table>`
  + (cut != null && ev.rounds >= 3 && r < (ev.rounds === 4 ? 2 : 1) ? `<p class="note">Projected cut: ${esc(scoreText(ev, cut))} (the top 45% and ties after round ${ev.rounds === 4 ? 2 : 1}).</p>` : '')
  + (ev.cut ? `<p class="note">The cut fell at ${esc(scoreText(ev, ev.cut.line))}: ${ev.cut.made.length} play on.${ev.cut.made.includes(YOU) ? '' : ' You missed it.'}</p>` : '');
}
// The line on the round screen (SPEC 5): the leader, the person's place, the
// cut on day two.
export function tickerText(ev, {thru = 0, partnerThru = {}} = {}) {
 const rows = leaderboard(ev, {thru, partnerThru}).filter(x => !x.mc), me = rows.find(x => x.id === YOU), lead = rows[0];
 if (!lead || !me) return '';
 // Before anyone has a score there is no leader, only the event.
 if (ev.round === 0 && !rows.some(x => x.thru > 0)) return `${ev.name} · ROUND 1 OF ${ev.rounds} · ${rows.length} GOLFERS`;
 const cut = projectedCut(ev, rows);
 const lone = lead.id === YOU && !String(me.pos).startsWith('T');
 return `${lone ? 'YOU LEAD' : `LEADER ${lead.id === YOU ? 'YOU' : lead.short} ${scoreText(ev, lead.total)}`} · YOU ${me.pos} ${scoreText(ev, me.total)}${cut != null && ev.rounds >= 3 && ev.round < (ev.rounds === 4 ? 2 : 1) ? ` · CUT ${scoreText(ev, cut)}` : ''}`;
}

// THE HUB, with a tour going: the next event, the person's season, the
// standings and the calendar.
export function hubHtml(tour, {personName = 'You'} = {}) {
 const ev = tour.current, st = standings(tour), me = st.find(s => s.you);
 const next = tour.events[tour.at];
 let top = '';
 if (seasonOver(tour)) top = seasonEndHtml(tour);
 else if (ev) {
  const r = Math.min(ev.round, ev.rounds - 1), done = ev.done;
  const mine = myGroup(ev, r).filter(id => id !== YOU).map(id => golferOf(ev, id).name).join(', ');
  const gi = pairings(ev, r).findIndex(g => g.includes(YOU));
  top = `<section class="tour-next"><small>${esc(ev.major ? 'MAJOR · ' : '')}EVENT ${tour.at + 1} OF ${tour.events.length}</small><h3>${esc(ev.name)}</h3>`
   + `<p>${esc(ev.course?.name || '')} · ${ev.rounds === 1 ? 'one round' : `${ev.rounds} rounds`} · ${ev.format === 'stableford' ? 'Stableford' : 'stroke play'}${ev.net ? ', net' : ''} · a field of ${ev.field.length + 1}</p>`
   + (done ? '' : ev.cut && !ev.cut.made.includes(YOU) ? '<p>You missed the cut. The weekend is played without you.</p>' : `<p>Round ${r + 1}: you tee off at ${teeTime(ev, r, gi)} with ${esc(mine || 'nobody')}.</p>`)
   + leaderboardHtml(ev, {r: Math.max(0, ev.round - (ev.done ? 1 : 0)), thru: ev.done || ev.round > r ? ev.holes : 0, partnerThru: ev.round > 0 || ev.done ? Object.fromEntries([YOU, ...ev.field].map(id => [id, ev.holes])) : {}})
   + `<div class="tour-actions">${done ? '<button class="primary" data-tour="next">On to the next event</button>' : ev.cut && !ev.cut.made.includes(YOU) ? '<button class="primary" data-tour="finish">See how it finished</button>' : `<button class="primary" data-tour="play">Play round ${r + 1}</button>`}</div></section>`;
 } else if (next) {
  const s = eventSettings(tour, next);
  top = `<section class="tour-next"><small>${esc(next.major ? 'MAJOR · ' : '')}NEXT · EVENT ${tour.at + 1} OF ${tour.events.length} · WEEK ${next.week}</small><h3>${esc(next.name)}</h3>`
   + `<p>${esc(next.course.name || 'A new course')} · ${s.rounds === 1 ? 'one round' : `${s.rounds} rounds`} · ${s.format === 'stableford' ? 'Stableford' : 'stroke play'}${s.net ? ', net' : ''} · ${esc(STRENGTH_NAMES[s.strength] || s.strength)} field of ${s.size}</p>`
   + `<div class="tour-actions"><button class="primary" data-tour="start">Start the event</button></div></section>`;
 }
 const card = me ? `<section class="tour-me"><h4>${esc(personName)}'s season</h4><p><b>${ordinal(me.place)}</b> · ${me.points} points · ${me.wins} win${me.wins === 1 ? '' : 's'} · ${me.top10} top ten${me.top10 === 1 ? '' : 's'} · ${me.cuts} of ${me.events} cuts made${me.average ? ` · ${me.average.toFixed(1)} a round` : ''} · ${money(me.money)}</p></section>` : '';
 return `<div class="tour-hub"><header class="tour-head"><h2>${esc(tour.name)}</h2><small>SEASON ${tour.season} · ${tour.year}</small></header>${top}${card}`
  + `<section class="tour-cols"><div><h4>Standings</h4>${standingsHtml(tour, st)}</div><div><h4>The calendar</h4>${calendarHtml(tour)}</div></section>`
  + `<div class="tour-actions"><button class="secondary" data-tour="edit">Change the calendar</button><button class="secondary" data-tour="share">Share this tour</button><button class="secondary" data-tour="switch">Other tours</button></div></div>`;
}
export function standingsHtml(tour, st = standings(tour), limit = 10) {
 if (!st.length) return '<p class="note">Nobody has played an event yet.</p>';
 const youAt = st.findIndex(s => s.you), show = st.slice(0, limit);
 if (youAt >= limit) show.push(null, st[youAt]);
 return `<table class="tour-board"><thead><tr><th>Pos</th><th>Golfer</th><th>Points</th><th>Wins</th><th>Money</th></tr></thead><tbody>${show.map(s => s ? `<tr class="${s.you ? 'you' : ''}"><td>${esc(s.pos)}</td><td>${esc(s.name)}</td><td>${s.points}</td><td>${s.wins}</td><td>${esc(money(s.money))}</td></tr>` : '<tr class="gap"><td colspan="5">…</td></tr>').join('')}</tbody></table>`;
}
export function calendarHtml(tour) {
 return `<ol class="tour-cal">${tour.events.map((e, i) => {
  const res = tour.results.find(r => r.id === e.id), mine = res?.rows.find(r => r.id === YOU);
  const state = res ? (mine?.pos === 'MC' ? 'MC' : mine ? `${place(mine.pos)}` : '') : i === tour.at ? 'NOW' : '';
  return `<li class="${i === tour.at ? 'now' : ''}${res ? ' done' : ''}"><span>WK ${e.week}</span><b>${esc(e.name)}${e.major ? ' <i>MAJOR</i>' : ''}</b><em>${esc(state)}</em></li>`;
 }).join('')}</ol>`;
}
export function seasonEndHtml(tour) {
 const a = awards(tour);
 if (!a) return '';
 const you = id => id === YOU;
 return `<section class="tour-next tour-awards"><small>SEASON ${tour.season} COMPLETE</small><h3>${you(a.champion.id) ? 'You are the champion!' : `${esc(a.champion.name)} wins the season`}</h3>`
  + `<ul><li><b>Champion</b> ${esc(a.champion.name)} · ${a.champion.points} points</li><li><b>Most wins</b> ${esc(a.wins.name)} · ${a.wins.wins}</li>${a.average ? `<li><b>Scoring average</b> ${esc(a.average.name)} · ${a.average.average.toFixed(2)}</li>` : ''}${a.majors ? `<li><b>Best in the majors</b> ${esc(a.majors.name)}</li>` : ''}</ul>`
  + `<div class="tour-actions"><button class="primary" data-tour="season">Start season ${tour.season + 1}</button></div></section>`;
}

// NO TOUR YET: what a tour is, and the ways to start one (SPEC 6).
export function startHtml({tours = [], active = null} = {}) {
 const list = tours.length ? `<h4>Your tours</h4><ul class="tour-list">${tours.map(t => `<li><b>${esc(t.name)}</b> <small>season ${t.season} · ${t.results.length} of ${t.events.length} played</small> <button class="secondary" data-tour="open" data-id="${esc(t.id)}">${t.id === active ? 'Back to it' : 'Play'}</button> <button class="small-icon" data-tour="delete" data-id="${esc(t.id)}" aria-label="Delete ${esc(t.name)}">✕</button></li>`).join('')}</ul>` : '';
 return `<div class="tour-hub"><header class="tour-head"><h2>The Fairway Tour</h2><small>A SEASON OF TOURNAMENTS AGAINST A FIELD OF COMPUTER GOLFERS</small></header>`
  + `<p>Play a season of events against 150 invented golfers, each with a handicap and a game of their own. You play every shot with your group, three of them beside you; the rest of the field is out on the course with you, on the leaderboard. Make the cut, win events, take the season on points.</p>`
  + `<div class="tour-starts">`
  + `<button class="sx-card tour-card" data-tour="shipped"><strong>${esc(SHIPPED.name)}</strong><span>Fifteen events, one on every landscape, four majors.</span></button>`
  + `<button class="sx-card tour-card" data-tour="quick"><strong>Quick season</strong><span>Eight events across the landscapes, two majors.</span></button>`
  + `<button class="sx-card tour-card" data-tour="single"><strong>A single tournament</strong><span>One event on a course you choose.</span></button>`
  + `<button class="sx-card tour-card" data-tour="blank"><strong>Build your own</strong><span>Your calendar, your courses, built or generated.</span></button>`
  + `<button class="sx-card tour-card" data-tour="import"><strong>Open a tour file</strong><span>A .fairway-tour a friend sent you.</span></button>`
  + `</div>${list}</div>`;
}

// The editor's value for an event's course: a built course by its file, a
// generated one by its landscape (the choice "a new course in ..."; the
// event keeps its own seed unless the choice is changed -- main.js).
export const eventCourseKey = e => e.course.built ? `built:${e.course.built}` : `land:${e.course.settings.biome}`;
// THE EDITOR (SPEC 6): the tour's defaults, then each event -- name, week,
// course, rounds, major -- with buttons to move, remove and add. `courses`
// [{value, label}] the courses to choose from (saved, built, landscapes).
export function editorHtml(tour, {courses = []} = {}) {
 const d = tour.defaults, played = tour.results.length + (tour.current ? 1 : 0);
 const opt = (v, cur, t) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`;
 const courseKey = eventCourseKey;
 return `<div class="tour-edit"><label class="field">Tour name<input id="tourName" maxlength="48" value="${esc(tour.name)}"></label>`
  + `<label class="field">Each event<select id="tourRounds">${opt(4, d.rounds, 'Full weekends · four rounds, a cut after two')}${opt(1, d.rounds, 'One round a weekend')}${opt(2, d.rounds, 'Two rounds')}${opt(3, d.rounds, 'Three rounds, a cut after one')}</select></label>`
  + `<label class="field">Format<select id="tourFormat">${opt('stroke', d.format, 'Stroke play')}${opt('stableford', d.format, 'Stableford')}</select></label>`
  + `<label class="field">Scoring<select id="tourNet">${opt('gross', d.net ? 'net' : 'gross', 'Gross · strokes as played')}${opt('net', d.net ? 'net' : 'gross', 'Net · handicaps')}</select></label>`
  + `<label class="field">The field<select id="tourStrength">${Object.entries(STRENGTH_NAMES).map(([k, t]) => opt(k, d.strength, t)).join('')}</select></label>`
  + `<label class="field">Field size<select id="tourSize">${[30, 45, 60, 90, 120, 144].map(n => opt(n, d.size, `${n} golfers`)).join('')}</select></label>`
  + `<label class="field">Your group<select id="tourPartners">${opt(3, d.partners, 'You and three computer golfers')}${opt(2, d.partners, 'You and two (quicker)')}</select></label>`
  + `<h4>The calendar</h4><ol class="tour-events">${tour.events.map((e, i) => {
   const locked = i < played;
   return `<li data-i="${i}"${locked ? ' class="locked"' : ''}><input aria-label="Event ${i + 1} name" class="ev-name" maxlength="48" value="${esc(e.name)}"${locked ? ' disabled' : ''}>`
    + `<label>Week <input class="ev-week" type="number" min="1" max="52" value="${e.week}"${locked ? ' disabled' : ''}></label>`
    + `<select class="ev-course" aria-label="Event ${i + 1} course"${locked ? ' disabled' : ''}>${courses.map(c => opt(c.value, courseKey(e), c.label)).join('')}${courses.some(c => c.value === courseKey(e)) ? '' : opt(courseKey(e), courseKey(e), e.course.name || 'This event\'s course')}</select>`
    + `<select class="ev-rounds" aria-label="Event ${i + 1} rounds"${locked ? ' disabled' : ''}>${opt('', e.rounds ?? '', 'Tour default')}${[1, 2, 3, 4].map(n => opt(n, e.rounds ?? '', n === 1 ? 'One round' : `${n} rounds`)).join('')}</select>`
    + `<label><input type="checkbox" class="ev-major" ${e.major ? 'checked' : ''}${locked ? ' disabled' : ''}> Major</label>`
    + (locked ? '<em>played</em>' : `<button class="small-icon" data-tour="up" aria-label="Move up">▲</button><button class="small-icon" data-tour="down" aria-label="Move down">▼</button><button class="small-icon" data-tour="remove" aria-label="Remove">✕</button>`)
    + `</li>`;
  }).join('')}</ol><div class="tour-actions"><button class="secondary" data-tour="add">Add an event</button><button class="primary" data-tour="save">Save the tour</button><button class="secondary" data-tour="cancel">Back</button></div></div>`;
}
