// THE SCOREBOARD BY THE LAST GREEN, LIVE (the owner's review, 30 October
// 2026: "Can we make the scoreboard on championship day actually show the
// players score?"). A pure module -- no DOM, no three.js -- so
// tests/leaderboard.test.mjs checks it; main.js feeds it the round and
// renderer.js paints what it returns on the board.
//
// The board shows TODAY's round: the golfers playing it, ranked among a
// small field of invented tour players. A board with one name on it would
// not read as tournament week, so the field is there, seeded from the
// course, its players a hole or two either side of the golfers -- they go
// out in the groups around yours -- and their scores made hole by hole from
// a tour pro's spread (PLACED: about 18% birdies, 64% pars, 16% bogeys, 2%
// doubles, read loosely from tour scoring averages, not taken from one
// source). Golf's convention: under par in red, the leader on top, ties
// shared ("T3"), F for a finished round.
//
// The names are made up -- initials and common surnames, chosen to belong to
// no well-known player.

const SURNAMES = ['Hartley', 'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Brennan', 'Castillo', 'Whitlock', 'Nakamura',
 'Fairbairn', 'Achterberg', 'Delgado', 'Sorensen', 'Abernethy', 'Kowalczyk', 'Ferreira', 'Duncanson', 'Ishikawa',
 'Blackwood', 'Villanueva', 'Haldane', 'Petrov', 'Calloway', 'Mbeki', 'Rosendahl', 'Quintero'];
const INITIALS = 'ABCDEGHJKLMNPRSTW';
const OUTCOME = [[-1, .18], [0, .64], [1, .16], [2, .02]];

function stream(seed) {
 let a = 0;
 for (const c of String(seed)) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
 return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The field: `n` invented players, each with a score for every hole and an
// offset in holes from the golfers' own group.
export function field(seed, holes, n = 7) {
 const r = stream('board:' + seed), used = new Set(), out = [];
 while (out.length < n) {
  // A surname once a board (E. and W. Castillo read as a misprint).
  const surname = SURNAMES[Math.floor(r() * SURNAMES.length)];
  if (used.has(surname)) continue;
  used.add(surname);
  const name = INITIALS[Math.floor(r() * INITIALS.length)] + '. ' + surname;
  const card = Array.from({length: holes}, () => { let u = r(); for (const [d, p] of OUTCOME) { if ((u -= p) < 0) return d; } return 0; });
  out.push({name, card, offset: Math.floor(r() * 5) - 2});
 }
 return out;
}

const fmt = rel => rel === 0 ? 'E' : rel > 0 ? '+' + rel : String(rel);

// The board: `players` [{name, card}] with card[h] the strokes on hole h
// (missing where not yet holed out), `pars` per hole, `seed` the course's.
// Returns {title, rows: [{pos, name, score, thru, under, you}]}, at most
// `rows` of them, the golfers always on it.
export function leaderboard({players, pars, seed, day = 'Sunday', rows = 8}) {
 const holes = pars.length;
 const mine = players.map(p => {
  let rel = 0, thru = 0;
  for (let h = 0; h < holes; h++) if (Number.isFinite(p.card?.[h])) { rel += p.card[h] - pars[h]; thru++; }
  return {name: p.name, rel: Math.round(rel), thru, you: true};
 });
 const ahead = Math.max(0, ...mine.map(m => m.thru));
 const others = field(seed, holes).map(f => {
  const thru = Math.max(0, Math.min(holes, ahead + f.offset));
  return {name: f.name, rel: f.card.slice(0, thru).reduce((a, b) => a + b, 0), thru, you: false};
 });
 const all = [...mine, ...others].sort((a, b) => a.rel - b.rel || b.thru - a.thru || (a.you === b.you ? 0 : a.you ? -1 : 1));
 // Positions, ties shared.
 all.forEach((e, i) => {
  const first = all.findIndex(o => o.rel === e.rel), tied = all.filter(o => o.rel === e.rel).length > 1;
  e.pos = (tied ? 'T' : '') + (first + 1);
 });
 // The top of the board -- and if a golfer is below it, the best of the
 // field and every golfer, still in order.
 const you = all.filter(e => e.you);
 let shown = all.slice(0, rows);
 if (you.some(e => !shown.includes(e))) {
  const keep = all.filter(e => !e.you).slice(0, Math.max(0, rows - you.length));
  shown = all.filter(e => e.you || keep.includes(e));
 }
 return {
  title: `LEADERS -- ${String(day).toUpperCase()}`,
  rows: shown.map(e => ({pos: e.pos, name: e.name, score: fmt(e.rel), thru: e.thru >= holes ? 'F' : e.thru === 0 ? '-' : String(e.thru), under: e.rel < 0, you: e.you})),
 };
}
