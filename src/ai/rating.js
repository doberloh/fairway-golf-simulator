// A COURSE RATED BY THE COMPUTER GOLFERS (the fairway-tour goal, 17 November
// 2026; the owner's Q11; it was IDEAS *Rate courses by more than their
// length*). Pure; slow (it plays rounds), so the game runs it off the frame
// loop and keeps the answer with the course.
//
// The sim handicap rates a course on its yardage alone (handicap.js), so a
// short course full of water rates easy and net scores there favour nobody
// fairly. Here a scratch golfer and a bogey golfer (a 20, PLACED: the USGA's
// bogey golfer is about a 20 for men) play the course from the tee, and the
// ratings come from their scores less what such golfers average over a
// course's rating on ordinary ground (`OVER`, fitted on the bench's courses
// so that, on average, the computer's rating agrees with the yardage
// formula; RESEARCH). Slope follows the USGA's sum, 5.381 x (bogey - course
// rating) on eighteen holes, between 55 and 155.
//
// Used for tour and net rounds only (Q11): a golfer's history keeps its
// yardage ratings until the owner says to switch.
import {Round} from '../game.js';
import {computerGolfer} from './golfer.js';
import {playHole} from './play.js';

// What each golfer averages over the rating on an ordinary course (strokes,
// eighteen holes). PLACED until fitted by `node tools/ai-bench.mjs
// --rating`: scratch from the first fit (+4.2 over par on 7,000-yd courses
// whose yardage rating is 72.7 against par 72: 3.5).
export const OVER = {scratch: 3.5, bogey: 4.5};
export const BOGEY_HANDICAP = 20;

// Plays `rounds` rounds each and returns {course, bogey, slope, scores}.
// `holes` are the world's holes; `tee` the set rated. `rateCourseSteps`
// is the same a hole at a time (a generator yielding the share done), so
// the game can rate a course between frames.
export function rateCourse(holes, opts = {}) {
 const steps = rateCourseSteps(holes, opts);
 let step = steps.next();
 while (!step.done) step = steps.next();
 return step.value;
}
export function* rateCourseSteps(holes, {tee = 'white', rounds = 2, settings = {}, seed = 'rating'} = {}) {
 const totals = {}, n = 2 * rounds * holes.length;
 let done = 0;
 for (const handicap of [0, BOGEY_HANDICAP]) {
  let total = 0;
  for (let k = 0; k < rounds; k++) {
   const g = computerGolfer({handicap, seed: `${seed}|${handicap}|${k}`, settings});
   // The round's own seed is short (a Round takes 40 characters); the shots
   // are keyed by the whole rating seed.
   const r = new Round({players: [{name: 'Rater', team: 'A', hand: 'RH'}], mode: 'stroke', holes: holes.length === 9 ? 9 : 18, putting: {mode: 'holeout'}, tee, seed: `rate${handicap}-${k}`});
   for (let i = 0; i < holes.length; i++) { playHole(r, holes[i], [g], {roundKey: `${seed}${k}`}); if (!r.finished) r.nextHole(); yield ++done / n; }
   total += r.cards[0].reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  }
  totals[handicap] = total / rounds;
 }
 const scale = holes.length === 9 ? .5 : 1;
 const s = totals[0], b = totals[BOGEY_HANDICAP];
 const course = Math.round((s - OVER.scratch * scale) * 10) / 10, bogey = Math.round((b - OVER.bogey * scale) * 10) / 10;
 const slope = Math.min(155, Math.max(55, Math.round(5.381 * (bogey - course) / scale)));
 return {course, bogey, slope, scores: {scratch: s, bogey: b}, rounds};
}
