// How a round stands against par.
//
// Kept apart from the game and the page because it is the same small
// calculation in three places -- the live score on the course card, the
// scorecard column, and the exported CSV -- and because a number that decides
// what colour a thing turns is worth being able to test.
//
// Only completed holes count. A player three shots into a par four has not gone
// over par yet: they can still hole out in one. Counting a hole in progress
// would make the number lurch up and then back down again, which is not how any
// scoreboard in golf behaves.

// Deeper colour the further from par, flattening out at nine either way. Past
// that the exact number matters more than the shade, and the chip is already as
// saturated as it can get without the text on it becoming unreadable.
export const PAR_LIMIT = 9;
const FLOOR = .2, CEILING = .82;

export function relativeToPar(card, pars) {
 let rel = 0, played = 0;
 for (let h = 0; h < pars.length; h++) {
  const s = card?.[h];
  if (!Number.isFinite(s)) continue;
  rel += s - pars[h]; played++;
 }
 // Decimal putting makes fractional scores real, so the sum is rounded the way
 // every other score in the game is rounded rather than left as float noise.
 return {rel: Math.round(rel * 100) / 100, played};
}

export const parText = rel => rel === 0 ? 'E' : (rel > 0 ? '+' : '') + (Math.round(rel * 100) / 100);

export const parSide = (rel, played) => !played || rel === 0 ? 'even' : rel > 0 ? 'over' : 'under';

// An even score gets no tint at all: the chip keeps the neutral field behind
// every other readout, so colour only ever means something has happened.
export function parTint(rel, played) {
 if (!played || rel === 0) return '';
 const depth = Math.min(1, Math.abs(rel) / PAR_LIMIT);
 const a = (FLOOR + depth * (CEILING - FLOOR)).toFixed(3);
 return rel > 0 ? `rgba(193,57,42,${a})` : `rgba(64,146,80,${a})`;
}

// What a single hole's score is called. The hole-out card says "Birdie" rather
// than making you subtract par from strokes while you are still looking at the
// flag, and an ace outranks whatever the arithmetic would otherwise call it.
//
// Decimal putting can leave a fractional score, which has no name -- there is no
// such thing as three-and-a-half under. Those fall back to the number.
const NAMES = {
 '-4': 'Condor', '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par',
 '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey', '4': 'Quadruple bogey',
};
export function holeScoreName(score, par) {
 if (!Number.isFinite(score) || !Number.isFinite(par)) return '';
 if (score === 1) return 'Hole in one';
 if (!Number.isInteger(score) || !Number.isInteger(par)) return '';
 return NAMES[String(score - par)] || parText(score - par);
}

// The hole-out banner: what lands in the middle of the screen the moment a
// golfer's score for the hole is final. The name when the score has one, and
// past quadruple bogey just the number over par ("+5"), because nobody wants
// "Quintuple bogey" written across the screen in large letters. A fractional
// decimal-putting score has no name either, so it gets the number too.
export function holeOutLabel(score, par) {
 if (!Number.isFinite(score) || !Number.isFinite(par)) return null;
 const rel = Math.round((score - par) * 100) / 100;
 return {name: holeScoreName(score, par) || parText(rel), rel, side: parSide(rel, 1)};
}
