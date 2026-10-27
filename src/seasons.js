// HAUNTED HOLLOW IS SEASONAL (the owner, 26 October 2026): "should only be
// active in the month of October, through the first week of November, but add
// a toggle in the settings to activate it."
//
// A pure rule, no DOM: main.js asks it what to offer. Out of season the
// landscape is simply not offered -- the pickers, Surprise me, a fresh endless
// run, the menu's backdrop hole, the course of the week -- but never locked
// out: a saved round, a saved course, a shared course code or a friend's
// challenge still opens on it, because nothing that loads a course asks.
//
// WHEN (PLACED): 1 October to 7 November inclusive, by the player's own clock
// -- "the first week of November" read as its first seven days. The setting
// "Haunted Hollow all year" (graphics.js `hauntedAllYear`, off) offers it any
// time. The course of the week is shared by everyone, so it does not follow
// either: it asks the season of the week's own Monday (weekly.js).

export const HAUNTED = 'haunted';

export function hauntedInSeason(date = new Date()) {
 const month = date.getMonth(), day = date.getDate();
 return month === 9 || (month === 10 && day <= 7);
}

// Whether a landscape is offered now.
export const offered = (biome, {date = new Date(), allYear = false} = {}) =>
 biome !== HAUNTED || allYear || hauntedInSeason(date);

// The landscapes a picker lists now, in their own order. `keep` is the one
// already chosen: a saved course on Haunted Hollow keeps it in its own picker.
export const offeredBiomes = (keys, {keep = null, ...when} = {}) =>
 keys.filter(k => k === keep || offered(k, when));

// A FRESH ENDLESS RUN OUT OF SEASON. A run is one seed (endless.js), and its
// holes' landscapes are rolled from it -- so whether Haunted Hollow may be
// rolled has to ride in the seed too, or the same run code would grow other
// holes in October than in March. A run started out of season carries the
// mark; its rolls of Haunted Hollow become another landscape, drawn from the
// seed. A seed without the mark grows exactly the holes it always did.
export const OFF_SEASON_MARK = '!';
export const markedOffSeason = seed => String(seed || '').includes(OFF_SEASON_MARK);
export const markOffSeason = seed => markedOffSeason(seed) ? String(seed) : `${seed}${OFF_SEASON_MARK}`;

function hash(s) {
 let a = 2166136261;
 for (const c of String(s)) { a ^= c.charCodeAt(0); a = Math.imul(a, 16777619); }
 return (a >>> 0) / 4294967296;
}

// The landscape that stands in for Haunted Hollow on a marked run's hole:
// any other, chosen by the seed and the hole, the same every time.
export function standIn(keys, seed, index) {
 const others = keys.filter(k => k !== HAUNTED);
 return others[Math.floor(hash(`${seed}#${index}:season`) * others.length)];
}
