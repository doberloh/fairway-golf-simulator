// A TEST ROUND (the course builder, stage 5; docs/COURSE_BUILDER.md, *The
// editor*): the virtual golfer (tests/virtual-golfer.mjs -- a Swing Meter
// golfer through the game's own ball and rules, the one the challenges
// play) plays the course being edited, and the
// builder reports strokes against par hole by hole and any hole it could not
// finish. The golfer lives with the tests because the tests made it; the
// builder borrows it unchanged.
import {worldFromDoc} from '../built-world.js';
import {Round} from '../game.js';
import {virtualGolfer} from '../../tests/virtual-golfer.mjs';

export const GOLFERS = [{seed: 'steady', skill: .010}, {seed: 'loose', skill: .018}];
// A hole not finished in this many strokes is reported stuck (the difficulty
// tool's rule).
export const STUCK = 40;

// ANOTHER GREEN IS NOT THIS HOLE'S (1 November 2026): Worthington's practice
// putting green, traced as green and marked by no hole, lies by holes 3 and
// 4. (Its holes of 40 and 47 strokes were the cup cut ON it -- every green
// was one outline then; built-world.js greenParts.) A golfer landing on a
// green 45 m or more from the hole's cup (PLACED: a green's far edge is
// rarely 40 m from its pin) plays it as fairway, not with the putter.
const OWN_GREEN = 45;
const lieOf = (h, x, z) => { const s = h.surface(x, z); return s === 'green' && Math.hypot(x - h.pin.x, z - h.pin.z) >= OWN_GREEN ? 'fairway' : s; };
const played = h => { const p = Object.create(h); p.surface = (x, z) => lieOf(h, x, z); return p; };

// Plays `doc`, a hole at a time; `onHole(result)` after each (the page
// redraws between them). Resolves to {holes: [{number, par, strokes, stuck}], total, par}.
export async function testRound(doc, {golfers = GOLFERS, onHole = () => {}, pause = () => Promise.resolve()} = {}) {
 const w = worldFromDoc(doc, {builtPins: 'test-round'});
 const rounds = golfers.map(g => ({round: new Round({players: [{name: 'V', team: 'A', hand: 'RH'}], mode: 'stroke', holes: w.holes.length, putting: {mode: 'holeout'}, tee: 'white'}), golfer: virtualGolfer({seed: g.seed, skill: g.skill, settings: w.settings})}));
 const holes = [];
 for (let i = 0; i < w.holes.length; i++) {
  const h = w.holes[i], strokes = [];
  let stuck = null;
  for (const {round: r, golfer} of rounds) {
   r.pars[r.hole] = h.par; if (!r.teePlaced) r.placeTee(h.tees);
   // LAYING UP (1 November 2026): a virtual golfer is the same golfer every
   // time, so a drive into a pond from the tee went into it again after the
   // drop at the tee -- Battle Creek's 13th and 14th were 40 strokes "stuck on
   // the tee", the pond 240 m out on the line the game aims down. After a
   // second penalty from one spot it changes the shot, as a player would: a
   // ball that went for the green -- 80% or more of the way -- and fell short
   // (Key West's 5th, a pond in front of the green) takes more club, aimed
   // 12% past the flag; one that went long or wide lays up, aimed at 70% of the way to where it went in; each penalty
   // after from the same spot one step more (24%, 49%...; PLACED -- Key
   // West's golfer pulls left into the pond until 25% past).
   let n = 0, again = 0, lastFrom = null, lastEnd = null;
   for (; !r.holeComplete && n < STUCK; n++) {
    if (r.relief) {
     const from = r.relief.from;
     again = lastFrom && Math.hypot(from.x - lastFrom.x, from.z - lastFrom.z) < .5 ? again + 1 : 1; lastFrom = {...from};
     r.takeRelief({spot: {...from}, penalty: 1}, h.pin); continue;
    }
    const lie = lieOf(h, r.position.x, r.position.z), here = {...r.position};
    const retry = again >= 2 && lastEnd && lastFrom && Math.hypot(here.x - lastFrom.x, here.z - lastFrom.z) < .5, toPin = Math.hypot(h.pin.x - here.x, h.pin.z - here.z);
    const went = retry ? Math.hypot(lastEnd.x - here.x, lastEnd.z - here.z) : 0;
    const up = 1 + .12 * (again - 1), down = .7 ** (again - 1);
    const layUp = !retry ? null : went < toPin && went > .8 * toPin ? {x: here.x + (h.pin.x - here.x) * up, z: here.z + (h.pin.z - here.z) * up} : {x: here.x + (lastEnd.x - here.x) * down, z: here.z + (lastEnd.z - here.z) * down};
    const s = golfer.shot({hole: played(h), from: here, aimAt: layUp});
    lastEnd = s.result.end ? {x: s.result.end.x, z: s.result.end.z} : null;
    r.takeShot({...s.result, puttStroke: lie === 'green', onGreen: s.result.onGreen}, h.pin);
   }
   if (!r.holeComplete) { const p = h.toWorld(r.position); stuck = {x: p.x, z: p.z, on: h.surface(r.position.x, r.position.z)}; }
   strokes.push(r.cards[0][r.hole] ?? n);
   if (!r.finished) r.nextHole();
  }
  const result = {number: i + 1, par: h.par, strokes, stuck};
  holes.push(result); onHole(result);
  await pause();
 }
 const total = holes.reduce((a, h) => a + h.strokes.reduce((x, y) => x + y, 0) / h.strokes.length, 0), par = holes.reduce((a, h) => a + h.par, 0);
 return {holes, total, par};
}
