// ROUNDS WITH A GOAL (16 October 2026; challenges.js, the *Rounds* tab).
//
// Sudden death and Bogey-free nine are real rounds -- they save, resume, go in
// the history, count for the handicap and earn round XP -- with a goal worked
// out from the card on top. The goal never changes how the round is played:
// whose turn, what a stroke costs and when a hole ends are the round's own
// (game.js). It only says when each golfer's goal is decided and what it
// scored, and main.js pays its medals then.
//
//   suddendeath  an endless run; a golfer's score is the holes at par or
//                better before their first bogey or worse, which puts them
//                out. Over when every golfer is out. The run itself goes on
//                if they want it to -- an endless run is never "finished".
//   bogeyfree    nine holes of stroke play; a golfer's score is their bogeys
//                or worse. Decided, for everyone, when the round finishes.
//
// Scores are named by the nearest whole stroke, as everywhere else, so a 4.3
// with decimal putting on a par 4 is a par. A hole a golfer did not play (they
// joined later) is skipped. Pure.

export const GOALS = ['suddendeath', 'bogeyfree'];
export const BOGEY_FREE_HOLES = 9;

// Why a round cannot carry a goal, or '' when it can (the Round refuses it).
export function goalProblem(goal, {endless = false, holes = 9, mode = 'stroke'} = {}) {
 if (!goal) return '';
 if (!GOALS.includes(goal)) return 'Invalid round goal.';
 if (mode !== 'stroke') return 'A round with a goal is stroke play.';
 if (goal === 'suddendeath' && !endless) return 'Sudden death is an endless run.';
 if (goal === 'bogeyfree' && (endless || holes !== BOGEY_FREE_HOLES)) return 'Bogey-free nine is nine holes.';
 return '';
}

// Each golfer's goal so far: {score, out} -- `out` meaning decided -- and
// `over` when every golfer's is. `round` needs cards, pars and finished.
export function goalStatus(goal, {cards = [], pars = [], finished = false} = {}) {
 const seats = cards.map(card => {
  let score = 0, out = false;
  for (let h = 0; h < (card?.length || 0); h++) {
   const s = card[h], par = pars[h];
   if (!Number.isFinite(s) || !Number.isFinite(par)) continue;
   const over = Math.round(s) > par;
   if (goal === 'suddendeath') { if (over) { out = true;break; } score++; }
   else if (over) score++;
  }
  if (goal === 'bogeyfree') out = !!finished;
  return {score, out};
 });
 return {seats, over: seats.length > 0 && seats.every(s => s.out)};
}
