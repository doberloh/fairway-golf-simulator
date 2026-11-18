// STABLEFORD (the fairway-tour goal, 17 November 2026; the owner pulled it in
// from IDEAS.md, Q13; RESEARCH *Allowances, Stableford*). Pure.
//
// Points against a fixed score per hole -- par, or net par once the golfer's
// handicap strokes for the hole are taken off -- so a blow-up hole costs
// nothing past zero: two over or worse 0, one over 1, level 2, one under 3,
// two under 4, three under 5 (the Rules of Golf, Rule 21.1). A hole not
// played scores no points and stays a gap. The most points wins.
export function points(score, par, strokes = 0) {
 if (!Number.isFinite(score) || !Number.isFinite(par)) return null;
 return Math.max(0, 2 + par + (strokes || 0) - score);
}
export const pointsCard = (card, pars, strokes = []) => card.map((v, h) => Number.isFinite(v) ? points(v, pars[h], strokes[h] || 0) : null);
export const pointsTotal = (card, pars, strokes = []) => pointsCard(card, pars, strokes).reduce((s, v) => s + (v || 0), 0);
// A golfer who can no longer score on a hole (already past net double
// bogey) may pick up in real Stableford; here every hole is played out and
// simply scores 0 (PLACED: the game has no pick-up).
export const noPointsLeft = (strokesSoFar, par, strokes = 0) => strokesSoFar >= par + (strokes || 0) + 2;
