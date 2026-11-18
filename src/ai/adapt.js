// OPPONENTS THAT ADAPT (the fairway-tour goal, 17 November 2026; SPEC
// section 4). Pure.
//
// An Adaptive computer golfer starts at a handicap (Matched to the person,
// usually) and, between holes, drifts toward a close game: when the person
// is playing worse than their handicap says, it plays a little worse too;
// better, a little better. What moves is its handicap -- its spreads and
// its choices -- never one shot's outcome: it will not miss a two-footer
// because the person is behind (SPEC: "not a rubber band").
//
// THE PERSON'S FORM is how far their scores so far are from what their
// handicap expects on those holes: par, plus their strokes on each hole,
// plus the few an ordinary round runs over a handicap (a golfer's index is
// their best rounds; RESEARCH *What a handicap means for the score*; PLACED
// 3 strokes over eighteen holes, shared evenly). Positive is worse.
//
// THE DRIFT (all PLACED): the opponent's handicap follows the person's form
// at 80% (`FOLLOW`), moves no more than 1.5 a hole (`STEP`), and never
// more than 4 strokes from where it began over eighteen holes (`BOUND`; 2
// over nine). A tour's field never adapts (Q3).
import {strokesReceived} from '../handicap.js';
import {MIN_HANDICAP, MAX_HANDICAP} from './skill.js';

export const FOLLOW = .8, STEP = 1.5, BOUND = 4, OVER = 3;

// The person's form after the holes played: strokes over their expectation,
// scaled to eighteen holes (so a bad first hole is not a whole round's
// worth). `holes` [{par, yards}], `card` their scores (gaps not played),
// `index` their handicap (null: scratch, PLACED).
export function form({card, holes, index = null}) {
 const strokes = strokesReceived(holes, Math.round(Number.isFinite(index) ? index * holes.length / 18 : 0));
 let over = 0, played = 0;
 holes.forEach((h, i) => {
  const v = card[i];
  if (!Number.isFinite(v)) return;
  over += v - (h.par + strokes[i] + OVER / 18); played++;
 });
 return played ? {over, played, per18: over * 18 / played} : {over: 0, played: 0, per18: 0};
}

// The opponent's next handicap: from its base, by the person's form, moved
// from where it is now by at most STEP, held within BOUND of its base.
export function adaptHandicap({base, now = base, personForm, holes = 18}) {
 const bound = BOUND * Math.min(1, holes / 18);
 // How much of the round is behind us: early on, form is noisy, so it
 // counts for less (PLACED: in proportion to the holes played).
 const weight = Math.min(1, (personForm?.played || 0) / Math.max(1, holes));
 const want = base + Math.max(-bound, Math.min(bound, FOLLOW * (personForm?.per18 || 0) * weight));
 const next = now + Math.max(-STEP, Math.min(STEP, want - now));
 return Math.round(Math.min(MAX_HANDICAP, Math.max(MIN_HANDICAP, next)) * 10) / 10;
}
