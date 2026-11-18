// HANDICAP ROUNDS: NET SCORING (the fairway-tour goal, 17 November 2026; SPEC
// section 3; RESEARCH *How a golfer of each handicap misses*, *Allowances,
// Stableford*). Pure.
//
// A round is gross (strokes as played) or net (each golfer's handicap
// strokes taken off on the holes they fall on). The strokes come from the
// World Handicap System as handicap.js already follows it: Course Handicap
// from the index, the course's rating and slope; the format's allowance
// (Appendix C); which holes get them by the stroke index (handicap.js
// `strokesReceived`). A golfer with no index plays off scratch (Q8: a typed
// handicap stands in for one; main.js passes it as the index).
import {courseHandicap, strokesReceived, STANDARD_SLOPE} from './handicap.js';

// The WHS's recommended allowances (Appendix C, as RESEARCH quotes them).
// Skins is played as individual stroke play (PLACED: Appendix C names no
// allowance for skins). A scramble's per-golfer shares run from the lowest
// handicap up; three golfers 30/20/10 (PLACED between the two- and
// four-golfer rows); one golfer plays off their own.
export const ALLOWANCE = {
 stroke: .95, stableford: .95, skins: .95,
 match: 1, fourBallMatch: .9,
 scramble: {1: [1], 2: [.35, .15], 3: [.3, .2, .1], 4: [.25, .2, .15, .1]},
};

// A golfer's Course Handicap on these holes: the WHS sum (handicap.js), or
// with a rating the computer golfers worked out (`rating: {course, slope}`,
// src/ai/rating.js) in place of the yardage estimate.
export function courseHandicapOn(index, holes, rating = null) {
 if (!Number.isFinite(index)) return 0;
 const yards = holes.reduce((t, h) => t + (h.yards || 0), 0), par = holes.reduce((t, h) => t + h.par, 0), n = holes.length;
 if (rating && Number.isFinite(rating.course) && Number.isFinite(rating.slope)) {
  const i = n === 9 ? index / 2 : index;
  return Math.round(i * rating.slope / STANDARD_SLOPE + (rating.course - par));
 }
 return courseHandicap(index, {yards, par, holes: n === 9 ? 9 : 18});
}

// EVERY GOLFER'S STROKES, hole by hole, for a round of `mode`.
//   players  [{index, team}]  (index null: scratch)
//   holes    [{par, yards}]   the round's holes, in order
// Returns {playing: [per seat], strokes: [[per hole] per seat],
//          team: {A: [per hole], B: [...]} for a scramble}.
export function roundStrokes({mode, players, holes, rating = null}) {
 const ch = players.map(p => courseHandicapOn(p.index, holes, rating));
 let playing;
 if (mode === 'match') {
  // The lowest plays off zero; the rest get the difference. Four-ball (more
  // than one a side) takes 90% first.
  const fourBall = players.length > 2, pc = ch.map(c => Math.round(c * (fourBall ? ALLOWANCE.fourBallMatch : ALLOWANCE.match)));
  const low = Math.min(...pc);
  playing = pc.map(c => c - low);
 } else if (mode === 'scramble') {
  playing = ch.map(() => 0);
  const team = {};
  for (const t of ['A', 'B']) {
   const mine = ch.filter((_, i) => players[i].team === t).sort((a, b) => a - b);
   if (!mine.length) { team[t] = holes.map(() => 0); continue; }
   const shares = ALLOWANCE.scramble[Math.min(4, mine.length)];
   const th = Math.round(mine.reduce((s, c, i) => s + c * (shares[i] ?? 0), 0));
   team[t] = strokesReceived(holes, th);
  }
  return {playing, strokes: players.map(p => team[p.team].slice()), team, teamHandicap: Object.fromEntries(Object.entries(team).map(([k, v]) => [k, v.reduce((s, x) => s + x, 0)]))};
 } else {
  const a = ALLOWANCE[mode] ?? ALLOWANCE.stroke;
  playing = ch.map(c => Math.round(c * a));
 }
 return {playing, strokes: playing.map(p => strokesReceived(holes, p))};
}

// A card less the strokes: a hole not played stays a gap.
export const netCard = (card, strokes) => card.map((v, h) => Number.isFinite(v) ? Math.round((v - (strokes?.[h] || 0)) * 100) / 100 : v);
// The total of the holes played, gross or net.
export const total = card => card.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
