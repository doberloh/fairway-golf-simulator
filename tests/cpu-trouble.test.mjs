// A HOLE ALWAYS ENDS (19 November 2026). The cpu-group smoke journey found a
// computer golfer at 16 on an Endless coast hole; in Node the same hole left a
// 10 handicap stuck one round in four. Three causes, three fixes:
// - relief.js dropped a ball on a cliff (MAX_DROP_SLOPE);
// - the golfer hit driver off the ground, and never learned from the water
//   (driver from the tee only; trouble remembered within 30 m);
// - a ball creeping a metre at a time in a bunker was never "stuck";
// and a guarantee: five over par it picks up and drops by the green
// (ai/play.js shouldPickUp, pickUpSpot).
import test from 'node:test';
import assert from 'node:assert/strict';
import {lateral, backOnLine, reliefOptions, MAX_DROP_SLOPE, WATER} from '../src/relief.js';
import {shouldPickUp, pickUpSpot, PICK_UP_OVER} from '../src/ai/play.js';
import {Round} from '../src/game.js';

const pin = {x: 0, z: 200};
// Water for x > 20; a cliff rising from it at 2.5 m a metre between x 19 and
// 20 (inside lateral relief's two club-lengths, 2.3 m), flat beyond; rough
// everywhere dry.
function coast() {
 return {
  surface: (x, z) => x > 20 ? 'water' : Math.hypot(x - pin.x, z - pin.z) < 10 ? 'green' : 'rough',
  height: (x, z) => x > 19 ? (20 - Math.min(20, x)) * 2.5 : 2.5,
  out: (x, z) => Math.abs(x) > 80 || z < -20 || z > 260,
  area: {minX: -80, maxX: 80, minZ: -20, maxZ: 260},
 };
}

test('relief never drops a ball on ground too steep to hold it', () => {
 const g = coast(), cross = {x: 20, z: 120};
 const spot = lateral(g, cross, pin);
 assert.ok(spot, 'there is somewhere to drop');
 assert.ok(spot.x < 19, `dropped on the cliff at x ${spot.x.toFixed(2)}`);
 const opts = reliefOptions(g, {hazard: WATER, from: {x: 0, z: 0}, cross}, pin);
 for (const o of opts.filter(o => o.id !== 'stroke')) {
  const s = o.spot, h = g.height;
  const slope = Math.hypot(h(s.x + .5, s.z) - h(s.x - .5, s.z), h(s.x, s.z + .5) - h(s.x, s.z - .5));
  assert.ok(slope <= MAX_DROP_SLOPE, `${o.id} on a slope of ${slope.toFixed(2)}`);
 }
 // Ground with no height known (the old callers) is not refused for it, and
 // with the cliff its whole width, there is no lateral drop at all.
 assert.ok(lateral({...g, height: undefined}, cross, pin));
 assert.equal(lateral({...g, height: (x) => x > 12 ? (20 - Math.min(20, x)) * 2.5 : 20}, cross, pin), null);
 // (Back on the line runs out to sea here, so the Rules offer none.)
 assert.equal(backOnLine(g, cross, pin), null);
});

test('five over par a computer golfer picks up, once, and drops on the green', () => {
 const hole = {par: 4, pin, surface: (x, z) => Math.hypot(x - pin.x, z - pin.z) < 10 ? 'green' : 'rough'};
 const r = new Round({players: [{name: 'C', team: 'A'}], mode: 'stroke'});
 r.positions[0] = {x: 30, z: 100};
 r.strokes[0] = hole.par + PICK_UP_OVER - 1;
 assert.equal(shouldPickUp(r, hole), false, 'four over plays on');
 r.strokes[0] = hole.par + PICK_UP_OVER;
 assert.equal(shouldPickUp(r, hole), true);
 const spot = pickUpSpot(hole);
 assert.equal(hole.surface(spot.x, spot.z), 'green');
 assert.ok(Math.hypot(spot.x - pin.x, spot.z - pin.z) >= 1.5);
 r.simDrop(spot);
 assert.equal(shouldPickUp(r, hole), false, 'on the green it putts out');
 r.relief = {player: 0};
 r.positions[0] = {x: 30, z: 100};
 assert.equal(shouldPickUp(r, hole), false, 'never with relief waiting');
});
