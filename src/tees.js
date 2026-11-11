// THE TEE SETS (the owner, 10 November 2026: "We need to add support for
// multiple tees in the game more than just blue white red. We should have
// support for up to 6 tees. Many courses have 4 at minimum. black -> blue ->
// white -> silver -> gold -> red. This needs to feed from the open street map
// data. Generated courses should still just have 3 tees.").
//
// The six sets, longest first; which a course has; the tee a golfer plays on a
// course without the one they chose; and the sets an OpenStreetMap tag names.
// Pure: no DOM, no three.js (tests/tees.test.mjs).
export const TEE_ORDER = ['black', 'blue', 'white', 'silver', 'gold', 'red'];
// The markers' and dots' colours. Blue, white and red are the game's own since
// the first tees (course-plan.js TEE_COLORS); black, silver and gold PLACED to
// read apart from each other and from the turf.
export const TEE_COLOURS = {black: '#26282c', blue: '#4385d5', white: '#f4f2e7', silver: '#b4bac2', gold: '#d6a72c', red: '#d75c52'};
// A generated course's three, as ever.
export const GENERATED_TEES = ['blue', 'white', 'red'];
// The builder's marks before the six (31 October to 10 November 2026): back,
// middle and front, played as blue, white and red.
export const LEGACY_SETS = {back: 'blue', middle: 'white', front: 'red'};

export const isTee = t => TEE_ORDER.includes(t);
export const teeName = t => isTee(t) ? t[0].toUpperCase() + t.slice(1) : String(t);
// A builder mark's set as one of the six (a legacy name read as its colour).
export const colourOf = set => LEGACY_SETS[set] ?? (isTee(set) ? set : null);
const rank = t => TEE_ORDER.indexOf(t);
// Sets, each once, longest first; anything not a tee set left out.
export const inOrder = sets => [...new Set(sets)].filter(isTee).sort((a, b) => rank(a) - rank(b));

// THE TEE A GOLFER PLAYS where the course lacks the one they chose: the same
// set, else the nearest in the order, a tie going to the LONGER (a golfer who
// plays silver, on a course of white and gold, plays white). PLACED. `have`
// the sets there are; returns null only when there are none.
export function teeFor(want, have) {
 const sets = inOrder(have);
 if (!sets.length) return null;
 if (sets.includes(want)) return want;
 const w = rank(want);
 if (w < 0) return sets[0];
 return sets.reduce((best, t) => Math.abs(rank(t) - w) < Math.abs(rank(best) - w) ? t : best);
}
// A hole's tee for a set, from its tees (an object keyed by set, as the game
// keeps them); the nearest set it has when it lacks that one.
export const teeOn = (tees, want) => tees?.[teeFor(want, Object.keys(tees ?? {}))] ?? null;

// THE SETS A COURSE OF `n` TEE SETS USES when nothing names them (PLACED):
// three are the generated course's; four add black at the back; five gold
// between white and red; six every one. Fewer than three are played as
// three, as a built course always has been (one tee plays all of them).
export function setsForCount(n) {
 if (n >= 6) return [...TEE_ORDER];
 if (n === 5) return ['black', 'blue', 'white', 'gold', 'red'];
 if (n === 4) return ['black', 'blue', 'white', 'red'];
 return [...GENERATED_TEES];
}

// AN OPENSTREETMAP TAG AS TEE SETS. The OSM wiki (Tag:golf=tee): a tee's set
// is "often mapped as tee=<COLOUR>" (its example tee=yellow), or named
// (tee=championship) or numbered. Several on one box are separated by ";"
// (Worthington's map: tee=blue;white;gold;red). Yellow is gold and grey is
// silver; championship, champion, tips, tournament and pro are black (PLACED);
// anything else -- green, orange, numbers, "teebox" -- names no set.
const SAME = {yellow: 'gold', grey: 'silver', gray: 'silver', championship: 'black', champion: 'black', champions: 'black', tips: 'black', tournament: 'black', pro: 'black', professional: 'black'};
export function setsFromTag(value) {
 if (value == null) return [];
 return inOrder(String(value).toLowerCase().split(/[;,/]/).map(v => v.trim().replace(/\s*tees?$/, '')).map(v => SAME[v] ?? v));
}

// THE SETS A BUILT COURSE HAS: every colour its tees name, longest first.
// Null when they name none (a course from the builder before the six, whose
// back, middle and front are spread over blue, white and red as they always
// were: built-world.js builtLine).
export function courseSets(holes) {
 const named = (holes ?? []).flatMap(h => (h?.tees ?? []).map(t => t.set)).filter(isTee);
 return named.length ? inOrder(named) : null;
}

// THE BACK TEE: the hole's longest set (a legacy back first), or its first tee.
export function backTee(tees) {
 if (!tees?.length) return null;
 let best = null;
 for (const t of tees) { const c = colourOf(t.set); if (c && (!best || rank(c) < rank(colourOf(best.set)))) best = t; }
 return best ?? tees[0];
}
