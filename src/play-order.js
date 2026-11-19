// WHO PLAYS NEXT (the owner, 19 November 2026, after a round with three
// computer golfers: "finishing the hole and then watching the AI play the hole
// by itself for 3 players is not enjoyable"). Pure: no DOM, no three.js; the
// round (game.js) asks it, and tests/play-order.test.mjs checks it.
//
// Two orders a group can choose (RESEARCH, *The order of play*):
//   'holeOut'  -- each golfer plays their ball until it is holed, then the next
//                 in honour order: how a simulator round with one launch monitor
//                 has always been played here, and still the default (PLACED:
//                 an old habit kept, not a rule).
//   'farthest' -- the Rules of Golf, Rule 6.4: on the tee the honour plays
//                 first and the rest follow in honour order; once everyone has
//                 started the hole, the ball farthest from the hole is played
//                 first. A golfer who must play again from the tee plays after
//                 all the others have made their first stroke (Rule 6.4c).
// Match play has always been played farthest-out, whichever is chosen.
export const PLAY_ORDERS=['holeOut','farthest'];
export const defaultPlayOrder='holeOut';
export const validPlayOrder=v=>PLAY_ORDERS.includes(v);

// THE HONOUR (Rule 6.4a, 6.4b). `base` is the order at the previous tee;
// `scoreOf(id)` the score that ranks a golfer there (gross even in a handicap
// round: Rule 6.4b, "The honour is based on gross scores, even in a handicap
// competition"). Lowest first; a tie keeps the previous tee's order ("they
// should play in the same order as at the previous teeing area"), which a
// stable sort does; a golfer with no score goes to the back.
//
// In match play the SIDE that won the hole has the honour, and keeps it on a
// halved hole (6.4a): `sideOf(id)` and `leadSide` put that side's golfers
// first; partners keep their score order between them (Rule 23.6 lets a side
// play in the order it considers best).
export function honours(base,scoreOf,{sideOf=null,leadSide=null}={}){
 const byScore=base.slice().sort((a,b)=>{
  const sa=scoreOf(a),sb=scoreOf(b),fa=Number.isFinite(sa),fb=Number.isFinite(sb);
  if(fa&&fb)return sa-sb;
  if(fa!==fb)return fa?-1:1;
  return 0;
 });
 if(!sideOf||!leadSide)return byScore;
 return byScore.sort((a,b)=>(sideOf(a)===leadSide?0:1)-(sideOf(b)===leadSide?0:1));
}

// WHO PLAYS NEXT, farthest-out. `units` in honour order (golfers, or scramble
// teams); `done(u)` holed out; `started(u)` has made a stroke on this hole;
// `away(u)` the ball's distance from the hole. Anyone yet to start goes first,
// in honour order; then the farthest ball, a tie going to the honour order
// (Rule 6.4b leaves an equal distance to agreement or lot). null when every
// unit is in.
export function nextToPlay(units,{done,started,away}){
 const left=units.filter(u=>!done(u));
 const fresh=left.find(u=>!started(u));
 if(fresh!==undefined)return fresh;
 let best=null,far=-Infinity;
 for(const u of left){const d=away(u);if(d>far+1e-9){far=d;best=u;}}
 return best;
}
