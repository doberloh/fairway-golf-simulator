// WHAT THE TOUR PAYS (the fairway-tour goal, 17 November 2026; SPEC section
// 8). Pure: from an event's finish, a round's cards or a season's end, the
// XP (each under its own ledger key, progression.js `award`, so nothing is
// paid twice) and the achievements earned (achievements.js). Amounts PLACED.
import {YOU} from './tournament.js';

export const TOUR_XP = {cut: 75, top10: 100, win: 300, major: 300, playoff: 100, round: 0, season: 1000, headToHead: 40};

// An event finished: {xp: [{key, xp, why}], achievements: [ids]}.
export function eventRewards(ev, {tourId = 't', season = 1} = {}) {
 const me = ev.results?.find(r => r.id === YOU), key = `${tourId}:s${season}:${ev.id}`;
 const xp = [], ach = [];
 if (!me) return {xp, achievements: ach};
 const made = me.pos !== 'MC' && (!ev.cut || ev.cut.made.includes(YOU));
 if (ev.cut && made) { xp.push({key: `${key}:cut`, xp: TOUR_XP.cut, why: 'Made the cut'}); ach.push('made-the-cut'); }
 if (me.place && me.place <= 10) { xp.push({key: `${key}:top10`, xp: TOUR_XP.top10, why: 'A top ten'}); ach.push('top-ten'); }
 if (me.place === 1) {
  xp.push({key: `${key}:win`, xp: TOUR_XP.win, why: `Won the ${ev.name}`}); ach.push('tour-winner');
  if (ev.major) { xp.push({key: `${key}:major`, xp: TOUR_XP.major, why: 'A major'}); ach.push('major-champion'); }
  if (ev.playoff?.winner === YOU) { xp.push({key: `${key}:playoff`, xp: TOUR_XP.playoff, why: 'Won the playoff'}); ach.push('playoff-winner'); }
 }
 return {xp, achievements: ach};
}
// A round of an event: beating every playing partner (Head to Head). `cards`
// [{id, total}] the group's totals for the round, the person among them.
export function roundRewards(ev, r, cards, {tourId = 't', season = 1} = {}) {
 const me = cards.find(c => c.id === YOU), others = cards.filter(c => c.id !== YOU);
 if (!me || others.length < 2 || !Number.isFinite(me.total)) return {xp: [], achievements: []};
 const better = ev.format === 'stableford' ? (a, b) => a > b : (a, b) => a < b;
 if (!others.every(o => better(me.total, o.total))) return {xp: [], achievements: []};
 return {xp: [{key: `${tourId}:s${season}:${ev.id}:r${r}:h2h`, xp: TOUR_XP.headToHead, why: 'Beat your playing partners'}], achievements: others.length >= 3 ? ['head-to-head'] : []};
}
// The season over, the person top of the standings.
export function seasonRewards(tour, standings) {
 if (!standings.length || standings[0].id !== YOU || standings.filter(s => s.points === standings[0].points).length > 1) return {xp: [], achievements: []};
 return {xp: [{key: `${tour.id}:s${tour.season}:champion`, xp: TOUR_XP.season, why: `Champion of ${tour.name}`}], achievements: ['season-champion']};
}
