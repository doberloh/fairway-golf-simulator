// THE COURSE OF THE WEEK (Phase 7, 14 October 2026; the agreed spec, 8.2).
//
// The same course on every copy of Fairway, with no server: its seed is made
// from the year and the week, and its landscape rotates through all nine, one a
// week. Eighteen holes at the default settings. Pure; the menu tile and the
// round live in main.js.
//
// SAME WEEK, SAME COURSE -- ON THE SAME GENERATOR. The seed only fixes the
// recipe; when courses are made differently (GENERATOR_VERSION) the same seed
// grows different holes. So the tile names the generator version, and a
// week's bests are kept under the week AND the version (`weekKey`).
//
// Weeks are ISO weeks (Monday to Sunday, the week holding the year's first
// Thursday is week 1), counted in the player's own time zone: the week turns
// over at their midnight, Sunday to Monday. `weekIndex` counts weeks since
// Monday 1 January 2024 and drives the landscape and the streak.

import {BIOME_KEYS, DEFAULT_COURSE, GENERATOR_VERSION, validateSettings} from './settings-schema.js';
import {challenge, better, seeded} from './challenges.js';
import {dayOf} from './progression.js';

const DAY = 86400000;
// The ISO year and week of a date, in local time.
export function isoWeek(date = new Date()) {
 const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
 const dow = (d.getDay() + 6) % 7; // Monday 0
 d.setDate(d.getDate() - dow + 3); // the Thursday of this week
 const year = d.getFullYear(), jan4 = new Date(year, 0, 4);
 const week = 1 + Math.round(((d - jan4) / DAY - 3 + ((jan4.getDay() + 6) % 7)) / 7);
 return {year, week};
}
// Weeks since the Monday of 1 January 2024, by the local calendar.
export function weekIndex(date = new Date()) {
 const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
 d.setDate(d.getDate() - (d.getDay() + 6) % 7);
 return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2024, 0, 1)) / DAY / 7);
}
export const weekSeed = ({year, week}) => `WEEK-${year}-${String(week).padStart(2, '0')}`;
export const weekKey = (date = new Date(), generator = GENERATOR_VERSION) => `${weekSeed(isoWeek(date))}@g${generator}`;
export const weeklyBiome = (date = new Date()) => BIOME_KEYS[((weekIndex(date) % BIOME_KEYS.length) + BIOME_KEYS.length) % BIOME_KEYS.length];
// The week's course: the defaults, its seed and landscape, eighteen holes.
export function weeklySettings(date = new Date()) {
 return validateSettings({...DEFAULT_COURSE, seed: weekSeed(isoWeek(date)), biome: weeklyBiome(date), holes: 18});
}
export const WEEKLY_XP = {first: 150, best: 50};
const KEEP = 60;
// A golfer's weekly record: {[weekKey]: best gross score}. Cleaned on the way in.
export function normaliseWeekly(d) {
 const out = {};
 if (d && typeof d === 'object') for (const [k, v] of Object.entries(d).slice(-KEEP)) if (/^WEEK-[0-9]{4}-[0-9]{2}@g[0-9]{1,4}$/.test(k) && Number.isInteger(v) && v > 0 && v < 1000) out[k] = v;
 return out;
}
// Record a finished round on the week's course. Returns what it earned:
// `first` (the first finished round this week) and `better` (beat their best
// this week), and writes the new best.
export function recordWeekly(prof, key, score) {
 prof.weekly ||= {};
 const was = prof.weekly[key], first = was === undefined, better = !first && score < was;
 if (first || better) prof.weekly[key] = score;
 const keys = Object.keys(prof.weekly);
 if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete prof.weekly[k];
 return {first, better};
}
// The golfer's best ever on any week's course, for the tile.
export const bestEverWeekly = prof => { const v = Object.values(prof?.weekly || {}); return v.length ? Math.min(...v) : null; };

// THE CHALLENGE OF THE WEEK (16 October 2026; the owner's plan, step 2).
//
// Picked from the date, the same on every copy, with no server. The weeks run
// in cycles as long as the pool; each cycle shuffles the pool with a seed made
// from the cycle's number, and week n of the cycle plays the n-th of that
// shuffle -- so every challenge comes round once a cycle, in a different order
// each time, and nothing is random at play time.
//
// THE POOL IS VERSIONED. Adding a challenge to it would move every week's pick
// on copies that know it and not on copies that do not, so a new pool starts
// at a stated future week (`from`, a weekIndex) and every week before it keeps
// the pool it had. Append a row; never edit one already shipped.
//
// What can be the week's challenge: every challenge but the ones that need a
// particular feature on the course (water to carry, greenside sand, a short
// side -- hole rule 'spots'), because the course of the week grows in every
// landscape and Island has no inland water. Played on the course of the week
// (range ones on the range), with spots seeded from the week's seed, so
// everyone on the same course generator plays the same balls.
export const WEEKLY_POOLS = [
 {from: 0, ids: ['long', 'fairway', 'straight', 'streak', 'shape', 'zone', 'closest', 'ace', 'ladder', 'hold',
  'dartboard', 'clock', 'number', 'oneclub', 'highlow', 'curve', 'updown', 'chipclose', 'chipin', 'pitch',
  'fourft', 'puttladder', 'lag', 'world']},
];
// The pool and the position in it for a week.
function poolFor(index) {
 let pool = WEEKLY_POOLS[0];
 for (const p of WEEKLY_POOLS) if (index >= p.from) pool = p;
 return pool;
}
// The shuffled order of a pool's cycle.
export function cycleOrder(pool, cycle) {
 const rnd = seeded(`CHALLENGE-WEEK-${pool.from}-${cycle}`), ids = [...pool.ids];
 for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
 return ids;
}
// The week's challenge: its id, and `next` -- the rest of the cycle after it,
// in order, for the rare course that cannot host it (the game plays the first
// of those it can).
export function weeklyChallenge(date = new Date()) {
 const index = weekIndex(date), pool = poolFor(index), n = pool.ids.length, k = index - pool.from;
 const cycle = Math.floor(k / n), at = ((k % n) + n) % n, order = cycleOrder(pool, cycle);
 return {id: order[at], next: [...order.slice(at + 1), ...order.slice(0, at)], index};
}
// Its record's key: the week, the challenge, and the generator for one played
// on the course of the week (a generator change grows a different course, so
// its bests start again, as the course of the week's do). Range ones leave the
// generator out: the range is the same on every version.
export function challengeWeekKey(id, date = new Date(), generator = GENERATOR_VERSION) {
 const base = `CHAL-${weekSeed(isoWeek(date)).slice(5)}:${id}`;
 return challenge(id)?.where === 'range' ? base : `${base}@g${generator}`;
}
const CHAL_KEY = /^CHAL-[0-9]{4}-[0-9]{2}:[a-z]{2,20}(@g[0-9]{1,4})?$/;
const idOfKey = key => key.split(':')[1].split('@')[0];
// A golfer's weeks: {[key]: {best, medal, gold (its gold was paid), day (the
// day a better score was last paid)}}, the last 60. Cleaned on the way in.
export function normaliseChallengeWeeks(d) {
 const out = {};
 if (!d || typeof d !== 'object') return out;
 for (const [k, v] of Object.entries(d).slice(-KEEP)) {
  if (!CHAL_KEY.test(k) || !challenge(idOfKey(k)) || !v || typeof v !== 'object') continue;
  const def = challenge(idOfKey(k)), b = v.best;
  const best = def.play === 'updown' ? (Number.isFinite(b?.made) && Number.isFinite(b?.strokes) ? {made: b.made, strokes: b.strokes} : null) : Number.isFinite(b) ? b : null;
  out[k] = {best, medal: [0, 1, 2, 3].includes(v.medal) ? v.medal : 0, ...(v.gold === true ? {gold: true} : {}), ...(typeof v.day === 'string' && v.day.length <= 10 ? {day: v.day} : {})};
 }
 return out;
}
export const WEEKLY_CHALLENGE_XP = {first: 100, better: 25, gold: 100};
// A finished play of the week's challenge. Writes the week's best and medal
// and returns what it pays: the first finish of the week (100, never
// multiplied -- like the daily bonus), beating the week's best (25, once a
// day), and a gold on it (100, once a week). The challenge's own medal and its
// first-medal pay come from progression.js `challengePay`, as for any play.
export function recordChallengeWeek(prof, key, score, medal, now = Date.now(), mult = 1) {
 const def = challenge(idOfKey(key)), weeks = (prof.challengeWeek ||= {}), was = weeks[key], parts = [];
 const m = Number.isFinite(mult) ? mult : 1, day = dayOf(now);
 if (!was) parts.push({label: 'Challenge of the week', xp: WEEKLY_CHALLENGE_XP.first});
 const rec = weeks[key] = was || {best: null, medal: 0};
 const improved = score != null && better(def, score, rec.best);
 if (improved) {
  if (was && rec.best != null && rec.day !== day) { rec.day = day;parts.push({label: 'Best this week', xp: Math.round(WEEKLY_CHALLENGE_XP.better * m)}); }
  rec.best = def.play === 'updown' ? {...score} : Math.round(score * 10) / 10;
 }
 if (medal > rec.medal) rec.medal = medal;
 if (medal === 3 && !rec.gold) { rec.gold = true;parts.push({label: 'Gold this week', xp: Math.round(WEEKLY_CHALLENGE_XP.gold * m)}); }
 const keys = Object.keys(weeks);
 if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete weeks[k];
 return {parts, xp: parts.reduce((a, p) => a + p.xp, 0), first: !was, better: improved && !!was};
}
