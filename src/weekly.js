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
