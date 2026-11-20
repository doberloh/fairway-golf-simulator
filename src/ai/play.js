// A COMPUTER GOLFER'S TURN IN A ROUND (the fairway-tour goal, 17 November
// 2026). Pure. The same steps main.js takes for a person -- the shot, where
// it crossed into trouble, the relief offered by relief.js -- with the
// computer golfer choosing. Used by the game for a computer seat, by
// tools/ai-bench.mjs, and by the builder's test round.
import {crossingPoint, reliefOptions} from '../relief.js';
import {outOfBounds} from '../physics.js';
import {reliefGround} from '../relief-ground.js';
import {lieAt} from './golfer.js';
import {strokesFor} from './strokes.js';

// The key of a shot: the round, the hole, the seat and the stroke. A mulligan
// or a reload asks for the same key, and gets the same shot.
export const shotKey = (round, seat, roundKey = '') => `${roundKey || round.seed || 'r'}|h${round.hole}|p${seat}|s${round.strokes?.[seat] ?? 0}`;

// Penalties taken from one spot, per golfer, so a golfer who has found the
// same water twice plays away from it.
const avoidance = new WeakMap();

// A COMPUTER GOLFER PICKS UP (19 November 2026). Five over par on a hole
// (PICK_UP_OVER, PLACED), with no relief waiting, it stops trying and drops
// by the green -- the game's own penalty-free sim drop, Round.simDrop -- and
// putts out, as a casual golfer picks up. It is the guarantee that a hole
// ends: an Endless coast hole held drops a ball could not be played from (a
// cliff, fixed in relief.js; a beach where every sand shot rolled back into
// the sea), and a 10 handicap took 16, or went on until the bench's limit.
// The score is what it took, plus the putts.
export const PICK_UP_OVER = 5;
// Never once the ball is on the green: from there it putts out.
export const shouldPickUp = (round, hole, seat = round.active) => {
 if (round.relief || round.holeComplete || round.mode === 'scramble' || !Number.isFinite(hole?.par)) return false;
 if ((round.strokes?.[seat] ?? 0) < hole.par + PICK_UP_OVER) return false;
 const p = round.positions?.[seat];
 return !p || hole.surface(p.x, p.z) !== 'green';
};
// Where it drops: on the green, the nearest spot to the hole at least a metre
// and a half out, searched in rings; the hole itself if the green has none.
export function pickUpSpot(hole) {
 const pin = hole.pin;
 for (let r = 1.5; r <= 12; r += .5) for (let a = 0; a < 360; a += 15) {
  const p = {x: pin.x - Math.sin(a * Math.PI / 180) * r, z: pin.z - Math.cos(a * Math.PI / 180) * r};
  if (hole.surface(p.x, p.z) === 'green') return p;
 }
 return {x: pin.x, z: pin.z - 1.5};
}

// ONE TURN for the golfer whose turn it is: relief if a ball waits for it,
// else a shot. Returns what happened: {kind: 'relief', option} or
// {kind: 'shot', shot, outcome}, or {kind: 'pickup', spot}.
export function takeTurn(round, hole, golfer, {roundKey = '', pressure = 0, outRule = round.outOfBounds} = {}) {
 if (shouldPickUp(round, hole)) { const spot = pickUpSpot(hole); round.simDrop(spot); return {kind: 'pickup', spot, seat: round.active}; }
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

// A SCRAMBLE TEAM'S PICK, for a team of computer golfers: the ball that
// leaves the fewest strokes for the team's best golfer, penalty included.
export function chooseForTeam(round, hole, golfers) {
 const team = round.players[round.candidates[0].player].team;
 const best = Math.min(...round.players.map((p, i) => p.team === team ? golfers[i]?.handicap ?? 20 : 99));
 let pick = 0, low = Infinity;
 round.candidates.forEach((c, i) => {
  const v = (c.penalty || 0) + (c.holed ? 0 : strokesFor(best, lieAt(hole, c.position.x, c.position.z), c.distance));
  if (v < low) { low = v; pick = i; }
 });
 round.chooseScramble(pick, hole.pin);
 return pick;
}

// A whole hole, every seat a computer golfer (`golfers[seat]`). Stops after
// `limit` actions (PLACED 60) and says so rather than loop for ever.
export function playHole(round, hole, golfers, {roundKey = '', limit = 60, onTurn = null} = {}) {
 round.pars[round.hole] = hole.par;
 if (!round.teePlaced) round.placeTee(hole.tees);
 let n = 0;
 while (!round.holeComplete && n < limit) {
  if (round.scrambleSelection) { chooseForTeam(round, hole, golfers); n++; continue; }
  const seat = round.relief ? round.relief.player : round.active;
  const turn = takeTurn(round, hole, golfers[seat], {roundKey});
  onTurn?.(turn);
  n++;
 }
 return {complete: round.holeComplete, actions: n};
}
