// THE SIM HANDICAP: a World Handicap System index, worked from rounds played
// here on courses nobody has ever rated.
//
// Everything the WHS does with a score is followed as published -- the hole
// caps, the differential, the best-8-of-20 table, the 9-hole expected score.
// The one thing a generated course cannot have is a Course Rating and Slope
// Rating from a rating team, so both are ESTIMATED FROM LENGTH ALONE with the
// USGA's yardage-rating formulas and no obstacle values. Hazards, elevation and
// green speed all move a real rating; none of them move this one. That is why
// it is called a sim handicap and not a handicap. Sources and every departure
// are in RESEARCH.md, *The sim handicap*.

export const STANDARD_SLOPE = 113;
export const MAX_INDEX = 54;

// The USGA yardage ratings for a man playing the course at its stated length:
// scratch = length / 220 + 40.9, bogey = length / 160 + 50.7 (18 holes). The
// constants are halved for nine holes, which is the same as rating a nine
// played twice. The bogey formula is placed from the Course Rating System
// manual and has not been read off a fetched page -- see RESEARCH.md.
export function courseRating(yards, holes = 18) { return yards / 220 + 40.9 * holes / 18; }
export function bogeyRating(yards, holes = 18) { return yards / 160 + 50.7 * holes / 18; }
// Slope is 5.381 x (bogey - scratch) on the 18-hole scale, so a nine's gap is
// doubled first. Published slopes run 55 to 155 and are whole numbers.
export function slopeRating(yards, holes = 18) {
 const s = 5.381 * (bogeyRating(yards, holes) - courseRating(yards, holes)) * 18 / holes;
 return Math.min(155, Math.max(55, Math.round(s)));
}

// WHICH HOLES TAKE THE STROKES. A real card has a stroke index; a generated one
// does not, so holes are ranked by yards per par stroke -- a 470-yard par 4 is
// harder than a 560-yard par 5 -- and the first gets the first stroke. Placed,
// not published. A plus handicap gives strokes BACK on the easiest holes.
export function strokesReceived(holes, courseHandicap) {
 const n = holes.length, order = holes.map((h, i) => ({i, k: h.yards / h.par})).sort((a, b) => b.k - a.k || a.i - b.i);
 const out = new Array(n).fill(0);
 if (!n) return out;
 if (courseHandicap >= 0) {
  const base = Math.floor(courseHandicap / n), extra = courseHandicap - base * n;
  order.forEach(({i}, rank) => { out[i] = base + (rank < extra ? 1 : 0); });
 } else {
  order.slice().reverse().forEach(({i}, rank) => { if (rank < -courseHandicap) out[i] = -1; });
 }
 return out;
}

// Course Handicap = index x slope / 113 + (rating - par), rounded. A nine uses
// half the index, as the WHS does.
export function courseHandicap(index, {yards, par, holes}) {
 const i = holes === 9 ? index / 2 : index;
 return Math.round(i * slopeRating(yards, holes) / STANDARD_SLOPE + (courseRating(yards, holes) - par));
}

// ADJUSTED GROSS SCORE. No index yet: every hole is capped at par + 5. With
// one: net double bogey -- par + 2 + the strokes received on that hole.
export function adjustedGross(holes, index) {
 if (index === null || index === undefined) return holes.reduce((t, h) => t + Math.min(h.score, h.par + 5), 0);
 const yards = holes.reduce((t, h) => t + h.yards, 0), par = holes.reduce((t, h) => t + h.par, 0);
 const strokes = strokesReceived(holes, courseHandicap(index, {yards, par, holes: holes.length}));
 return holes.reduce((t, h, i) => t + Math.min(h.score, h.par + 2 + strokes[i]), 0);
}

const tenth = v => Math.round(v * 10) / 10;

// SCORE DIFFERENTIAL, always on the 18-hole scale. A nine is turned into
// eighteen the 2024 way: its own differential plus the EXPECTED differential
// for the nine not played, 0.52 x index + 1.2. With no index there is nothing to
// expect from, so a first nine is doubled -- a departure from the WHS, which
// would hold it until it had a partner.
export function differential(holes, index = null) {
 const n = holes.length;
 if (n !== 9 && n !== 18) return null;
 const yards = holes.reduce((t, h) => t + h.yards, 0);
 const ags = adjustedGross(holes, index);
 const d = STANDARD_SLOPE / slopeRating(yards, n) * (ags - courseRating(yards, n));
 if (n === 18) return tenth(d);
 return tenth(index === null || index === undefined ? d * 2 : d + 0.52 * index + 1.2);
}

// HOW MANY OF THE LOWEST DIFFERENTIALS COUNT, and the adjustment, by how many
// scores there are (most recent 20). Fewer than three gives no index.
const TABLE = [null, null, null, [1, -2], [1, -1], [1, 0], [2, -1], [2, 0], [2, 0], [3, 0], [3, 0], [3, 0],
 [4, 0], [4, 0], [4, 0], [5, 0], [5, 0], [6, 0], [6, 0], [7, 0], [8, 0]];
export function handicapIndex(differentials) {
 const recent = differentials.slice(-20), row = TABLE[recent.length];
 if (!row) return null;
 const [count, adjust] = row, best = recent.slice().sort((a, b) => a - b).slice(0, count);
 const avg = best.reduce((t, v) => t + v, 0) / count;
 return Math.min(MAX_INDEX, tenth(avg + adjust));
}

// THE WHOLE HISTORY, oldest first. Each round's caps depend on the index the
// golfer held when it was played, so the index is rebuilt in order rather than
// from all the scores at once.
//
// `rounds` is [{holes: [{par, yards, score}]}]; only 9 and 18 hole rounds with
// every hole scored are passed in -- what qualifies is decided by the caller.
export function simHandicap(rounds) {
 const diffs = [];
 for (const r of rounds) {
  const d = differential(r.holes, handicapIndex(diffs));
  if (d !== null) diffs.push(d);
 }
 const recent = diffs.slice(-20), row = TABLE[recent.length];
 return {index: handicapIndex(diffs), rounds: diffs.length, counted: row ? row[0] : 0, needed: Math.max(0, 3 - diffs.length), differentials: diffs};
}
