// ACHIEVEMENTS (Phase 7, 14 October 2026; the agreed spec, 8.3).
//
// Open from level 1, each earned once, each paying XP once and some bringing a
// title (rewards.js `achievementTitles`). The names and amounts are the spec's
// placeholders, kept. Pure: the game hands in what happened -- a hole's score,
// a finished round, a counter moving -- and gets back which achievements that
// earned; main.js pays them through the XP ledger and shows them in the popup.
//
// What has to be counted across rounds lives on the profile:
//   counters.sandSaves  up-and-downs from a bunker (profile.js COUNTERS: the
//                       spec's "one new stat", shown on My profile)
//   counters.onNumber   shots that came down on the number (also shown)
//   progress            {rounds, biomes, weeks, once}: rounds finished, the
//                       landscapes finished in, the course-of-the-week weeks
//                       finished (as week numbers), and keys already counted
//                       (`markOnce`), so a save that runs again counts nothing
//                       twice.
//   progress.chalWeeks  the weeks the challenge of the week was played (week
//                       numbers), for Weekly Regular. Medals are the
//                       profile's own (challenges.js).

import {CHALLENGES} from './challenges.js';

export const ACHIEVEMENTS = [
 {id: 'first-birdie', name: 'First birdie', how: 'Make a birdie.', xp: 50},
 {id: 'ace', name: 'Ace', how: 'Make a hole in one.', xp: 200, title: 'Ace'},
 {id: 'sandy', name: 'Sandy', how: 'Get up and down from a bunker 25 times.', xp: 150, title: 'Sandy', counter: 'sandSaves', goal: 25},
 {id: 'fairway-finder', name: 'Fairway Finder', how: 'Hit 10 fairways in one round.', xp: 100, title: 'Fairway Finder'},
 {id: 'par3-sweep', name: 'Par-3 Sweep', how: 'Birdie every par 3 in a round.', xp: 200},
 {id: 'beat-the-index', name: 'Beat the Index', how: 'Finish a round under your sim handicap.', xp: 150},
 {id: 'night-owl', name: 'Night Owl', how: 'Finish a round under the floodlights.', xp: 100, title: 'Night Owl'},
 {id: 'fog-walker', name: 'Fog Walker', how: 'Finish a round in Giant Redwood.', xp: 75, title: 'Fog Walker'},
 {id: 'ghost-hunter', name: 'Ghost Hunter', how: 'Finish a round in Haunted Hollow.', xp: 75, title: 'Ghost Hunter'},
 {id: 'globetrotter', name: 'Globetrotter', how: 'Finish a round in nine different landscapes.', xp: 250, title: 'Globetrotter', progress: 'biomes', goal: 9},
 {id: 'centurion', name: 'Centurion', how: 'Finish 100 rounds.', xp: 300, title: 'Centurion', progress: 'rounds', goal: 100},
 {id: 'streak', name: 'Streak', how: 'Finish the course of the week four weeks running.', xp: 150, progress: 'streak', goal: 4},
 {id: 'on-the-dot', name: 'On the Dot', how: 'Land 50 shots on the number.', xp: 100, title: 'On the Dot', counter: 'onNumber', goal: 50},
 // CHALLENGES (16 October 2026; the owner's plan, step 2). Names and amounts
 // PLACED. All-Rounder's goal is every challenge there is: it grows when
 // challenges are added, and a golfer who has it keeps it.
 {id: 'first-medal', name: 'First Medal', how: 'Win a medal in any challenge.', xp: 25, progress: 'medals', goal: 1},
 {id: 'gold-standard', name: 'Gold Standard', how: 'Win ten gold medals.', xp: 150, title: 'Gold Standard', progress: 'golds', goal: 10},
 {id: 'all-rounder', name: 'All-Rounder', how: 'Win a medal in every challenge.', xp: 250, title: 'All-Rounder', progress: 'medals', goal: CHALLENGES.filter(c => c.medals).length},
 {id: 'weekly-regular', name: 'Weekly Regular', how: 'Play the challenge of the week four weeks running.', xp: 150, progress: 'chalStreak', goal: 4},
 {id: 'head-of-the-table', name: 'Head of the Table', how: 'Win ten head-to-head challenges.', xp: 100, progress: 'versusWins', goal: 10},
];
export const achievement = id => ACHIEVEMENTS.find(a => a.id === id) || null;
export const LANDSCAPES = 9;
const ONCE_KEEP = 300;

export const blankProgress = () => ({rounds: 0, biomes: [], weeks: [], chalWeeks: [], once: []});
// What survives from a stored record; anything unreadable is dropped.
export function normaliseProgress(d) {
 const p = blankProgress();
 if (!d || typeof d !== 'object') return p;
 if (Number.isInteger(d.rounds) && d.rounds >= 0) p.rounds = d.rounds;
 if (Array.isArray(d.biomes)) p.biomes = [...new Set(d.biomes.filter(b => typeof b === 'string' && b.length <= 20))].slice(0, 30);
 if (Array.isArray(d.weeks)) p.weeks = [...new Set(d.weeks.filter(w => Number.isInteger(w) && w >= 0 && w < 1e5))].sort((a, b) => a - b).slice(-200);
 if (Array.isArray(d.chalWeeks)) p.chalWeeks = [...new Set(d.chalWeeks.filter(w => Number.isInteger(w) && w >= 0 && w < 1e5))].sort((a, b) => a - b).slice(-200);
 if (Array.isArray(d.once)) p.once = d.once.filter(k => typeof k === 'string' && k.length <= 120).slice(-ONCE_KEEP);
 return p;
}
export function normaliseEarned(d) {
 const out = {};
 if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) if (achievement(k) && Number.isFinite(v)) out[k] = v;
 return out;
}
// True the first time a key is seen: a hole's sand save, a round's finish.
export function markOnce(prog, key) {
 if (prog.once.includes(key)) return false;
 prog.once.push(key); if (prog.once.length > ONCE_KEEP) prog.once.splice(0, prog.once.length - ONCE_KEEP);
 return true;
}

// AN UP-AND-DOWN FROM SAND: the hole was finished within one stroke of the
// last shot played from a bunker -- holed from the sand, or one putt after it.
// `sandStrokes` are the stroke numbers played from sand on the hole.
export function sandSave(sandStrokes, score) {
 if (!sandStrokes?.length || !Number.isFinite(score)) return false;
 return score - Math.max(...sandStrokes) <= 1;
}
// The longest run of consecutive week numbers.
export function longestStreak(weeks) {
 const w = [...new Set(weeks)].sort((a, b) => a - b);
 let best = 0, run = 0;
 w.forEach((x, i) => { run = i && x === w[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
 return best;
}
// How far along an achievement is, for My profile: [have, goal] or null.
export function progressOf(a, prof) {
 if (a.counter) return [prof?.counters?.[a.counter] || 0, a.goal];
 const p = prof?.progress || blankProgress();
 if (a.progress === 'biomes') return [p.biomes.length, a.goal];
 if (a.progress === 'rounds') return [p.rounds, a.goal];
 if (a.progress === 'streak') return [longestStreak(p.weeks), a.goal];
 if (a.progress === 'chalStreak') return [longestStreak(p.chalWeeks || []), a.goal];
 if (a.progress === 'medals') return [Object.values(prof?.medals || {}).filter(m => m >= 1).length, a.goal];
 if (a.progress === 'versusWins') return [CHALLENGES.filter(c => c.group === 'versus').reduce((n, c) => n + (prof?.challenges?.[c.id]?.won || 0), 0), a.goal];
 if (a.progress === 'golds') return [Object.values(prof?.medals || {}).filter(m => m === 3).length, a.goal];
 return null;
}

// What a finished HOLE earns.
export function holeAchievements({score, par}) {
 const out = [];
 if (!Number.isFinite(score) || !Number.isFinite(par)) return out;
 if (score <= par - 1) out.push('first-birdie');
 if (score === 1) out.push('ace');
 return out;
}
// What a finished ROUND earns. `holes` is the card: [{par, score, fairway}];
// `index` the golfer's sim handicap (null without one); `floodlit` whether the
// lights were on as it finished; `biome` its landscape.
export function roundAchievements({holes = [], index = null, floodlit = false, biome = ''}) {
 const out = [], played = holes.filter(h => Number.isFinite(h?.score) && Number.isFinite(h?.par));
 if (!played.length) return out;
 if (played.filter(h => h.fairway).length >= 10) out.push('fairway-finder');
 const threes = played.filter(h => h.par === 3);
 if (threes.length && threes.every(h => h.score <= 2)) out.push('par3-sweep');
 // Under the index: a 9-hole round is held to half of it.
 const over = played.reduce((a, h) => a + h.score - h.par, 0);
 if (Number.isFinite(index) && over < index * played.length / 18) out.push('beat-the-index');
 if (floodlit) out.push('night-owl');
 if (biome === 'redwood') out.push('fog-walker');
 if (biome === 'haunted') out.push('ghost-hunter');
 return out;
}
// What the counters and the progress have reached.
export function countedAchievements(prof) {
 return ACHIEVEMENTS.filter(a => a.goal && (progressOf(a, prof)?.[0] || 0) >= a.goal).map(a => a.id);
}
// Of `ids`, the ones this golfer has not earned yet -- now marked earned.
export function earn(prof, ids, now = Date.now()) {
 prof.achievements ||= {};
 const fresh = [...new Set(ids)].filter(id => achievement(id) && !prof.achievements[id]);
 for (const id of fresh) prof.achievements[id] = now;
 return fresh;
}
