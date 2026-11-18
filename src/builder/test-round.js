// A TEST ROUND (the course builder, stage 5; docs/COURSE_BUILDER.md, *The
// editor*): two computer golfers play the course being edited -- a scratch
// golfer and a bogey golfer (a 20), the two a course rating is made from --
// and the builder reports strokes against par hole by hole and any hole one
// could not finish.
//
// Since 18 November 2026 (the fairway-tour goal, SPEC section 8) they are the
// game's computer golfers (src/ai/golfer.js: plans by expected strokes, takes
// its relief, lays up, reads putts) in place of the tests' virtual golfer,
// whose lay-up and wrong-green rules they carry: a ball on a green 45 m or
// more from the hole's cup is on another hole's green (golfer.js OWN_GREEN),
// and a golfer who keeps finding the same water plays away from it
// (play.js). One extra rule here: a hole not finished in STUCK actions is
// reported stuck, where it was.
import {worldFromDoc} from '../built-world.js';
import {Round} from '../game.js';
import {computerGolfer} from '../ai/golfer.js';
import {playHole} from '../ai/play.js';

export const GOLFERS = [{name: 'Scratch', handicap: 0, seed: 'steady'}, {name: 'Bogey golfer', handicap: 20, seed: 'loose'}];
export const STUCK = 40;

// Plays `doc`, a hole at a time; `onHole(result)` after each (the page
// redraws between them). Resolves to {holes: [{number, par, strokes, stuck}], total, par}.
export async function testRound(doc, {golfers = GOLFERS, onHole = () => {}, pause = () => Promise.resolve()} = {}) {
 const w = worldFromDoc(doc, {builtPins: 'test-round'});
 const rounds = golfers.map(g => ({round: new Round({players: [{name: 'T', team: 'A', hand: 'RH'}], mode: 'stroke', holes: w.holes.length === 9 ? 9 : 18, putting: {mode: 'holeout'}, tee: 'white', seed: `test-${g.seed}`}),
  golfer: computerGolfer({handicap: g.handicap, seed: g.seed, settings: w.settings, name: g.name})}));
 const holes = [];
 for (let i = 0; i < w.holes.length; i++) {
  const h = w.holes[i], strokes = [];
  let stuck = null;
  for (const {round: r, golfer} of rounds) {
   const res = playHole(r, h, [golfer], {roundKey: `test-${golfer.name}`, limit: STUCK});
   if (!res.complete) { const p = h.toWorld(r.position); stuck = {x: p.x, z: p.z, on: h.surface(r.position.x, r.position.z)}; }
   strokes.push(r.cards[0][r.hole] ?? r.strokes[0]);
   if (!r.finished && r.holeComplete) r.nextHole();
   // Stuck: its strokes so far stand as its score, and on to the next hole.
   else if (!r.holeComplete && !r.finished) { r.relief = null; r.cards[0][r.hole] = r.strokes[0]; r.done[0] = true; r.completeHole(); if (!r.finished) r.nextHole(); }
  }
  const result = {number: i + 1, par: h.par, strokes, stuck};
  holes.push(result); onHole(result);
  await pause();
 }
 const total = holes.reduce((a, h) => a + h.strokes.reduce((x, y) => x + y, 0) / h.strokes.length, 0), par = holes.reduce((a, h) => a + h.par, 0);
 return {holes, total, par, golfers: golfers.map(g => g.name)};
}
