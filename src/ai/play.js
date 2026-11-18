// A COMPUTER GOLFER'S TURN IN A ROUND (the fairway-tour goal, 17 November
// 2026). Pure. The same steps main.js takes for a person -- the shot, where
// it crossed into trouble, the relief offered by relief.js -- with the
// computer golfer choosing. Used by the game for a computer seat, by
// tools/ai-bench.mjs, and by the builder's test round.
import {crossingPoint, reliefOptions} from '../relief.js';
import {outOfBounds} from '../physics.js';
import {reliefGround} from '../relief-ground.js';
import {lieAt} from './golfer.js';

// The key of a shot: the round, the hole, the seat and the stroke. A mulligan
// or a reload asks for the same key, and gets the same shot.
export const shotKey = (round, seat, roundKey = '') => `${roundKey || round.seed || 'r'}|h${round.hole}|p${seat}|s${round.strokes?.[seat] ?? 0}`;

// Penalties taken from one spot, per golfer, so a golfer who has found the
// same water twice plays away from it.
const avoidance = new WeakMap();

// ONE TURN for the golfer whose turn it is: relief if a ball waits for it,
// else a shot. Returns what happened: {kind: 'relief', option} or
// {kind: 'shot', shot, outcome}.
export function takeTurn(round, hole, golfer, {roundKey = '', pressure = 0, outRule = round.outOfBounds} = {}) {
 const seat = round.relief ? round.relief.player : round.active;
 let marks = avoidance.get(golfer);
 if (!marks) { marks = []; avoidance.set(golfer, marks); }
 if (round.relief) {
  const opts = reliefOptions(reliefGround(hole), round.relief, hole.pin, {outRule});
  const best = golfer.relief(hole, opts);
  const from = round.relief.from;
  const mark = marks.find(m => Math.hypot(m.x - from.x, m.z - from.z) < .5);
  if (mark) mark.n++; else marks.push({x: from.x, z: from.z, n: 1});
  round.takeRelief({spot: best.spot, penalty: best.penalty}, hole.pin);
  return {kind: 'relief', option: best, seat};
 }
 const from = {...round.position}, lie = lieAt(hole, from.x, from.z);
 const avoid = marks.find(m => Math.hypot(m.x - from.x, m.z - from.z) < .5)?.n ?? 0;
 const shot = golfer.shot({hole, from, key: shotKey(round, seat, roundKey), pressure, avoid});
 const result = shot.result;
 if (result.hazard) result.cross = crossingPoint(result.points, result.hazard === 'Water' ? (p => hole.surface(p.x, p.z) === 'water') : (p => outOfBounds(hole, p.x, p.z))) || {x: result.end.x, z: result.end.z};
 const outcome = round.takeShot({...result, puttStroke: lie === 'green', onGreen: result.onGreen}, hole.pin);
 return {kind: 'shot', shot, outcome, seat, from, lie};
}

// A whole hole, every seat a computer golfer (`golfers[seat]`). Stops after
// `limit` actions (PLACED 60) and says so rather than loop for ever.
export function playHole(round, hole, golfers, {roundKey = '', limit = 60, onTurn = null} = {}) {
 round.pars[round.hole] = hole.par;
 if (!round.teePlaced) round.placeTee(hole.tees);
 let n = 0;
 while (!round.holeComplete && n < limit) {
  const seat = round.relief ? round.relief.player : round.active;
  const turn = takeTurn(round, hole, golfers[seat], {roundKey});
  onTurn?.(turn);
  n++;
 }
 return {complete: round.holeComplete, actions: n};
}
