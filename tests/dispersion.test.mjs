// Per-club dispersion. This is a READ of shots that were hit, never a model of
// shots that might be, so the tests mostly pin that it reports what it was given
// and refuses to report what it was not.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dispersionByClub, groupEllipse, clubHue, clubColour, MIN_GROUP} from '../src/dispersion.js';

const shot = (club, x, z) => ({club, end: {x, z}});

test('identical shots group on a point, because nothing invents a miss', () => {
 // The simulator has no strike-quality model by design. Ten identical inputs
 // give ten identical balls, and the honest circle for that is a dot -- if this
 // ever reports a radius, something is generating scatter that was not hit.
 const shots = Array.from({length: 10}, () => shot('7 Iron', 12, 150));
 const [g] = dispersionByClub(shots);
 assert.equal(g.n, 10);
 assert.equal(g.long, 0, 'identical shots must not acquire a long axis');
 assert.equal(g.wide, 0, 'nor a width');
 assert.equal(g.worst, 0);
});

test('a group needs enough shots to be a group', () => {
 for (let n = 0; n < MIN_GROUP; n++) {
  const shots = Array.from({length: n}, (_, i) => shot('Driver', i, 250 + i));
  assert.equal(dispersionByClub(shots).length, 0, `${n} shots should not draw a circle`);
 }
 const enough = Array.from({length: MIN_GROUP}, (_, i) => shot('Driver', i, 250 + i));
 assert.equal(dispersionByClub(enough).length, 1);
});

// Every ball is inside its own ellipse. This is the whole point of the shape: a
// standard-distance circle left a third of the group outside the mark drawn for
// it, and a ball on the diagonal can sit inside both axis bounds and still be
// outside the ellipse, which is what the containment scale exists to catch.
const inside = (g, p) => {
 const dx = p.x - g.centre.x, dz = p.z - g.centre.z;
 const u = dx * Math.cos(g.angle) + dz * Math.sin(g.angle);
 const v = -dx * Math.sin(g.angle) + dz * Math.cos(g.angle);
 return (u / g.long) ** 2 + (v / g.wide) ** 2;
};

test('the ellipse contains every ball, including the awkward diagonal one', () => {
 const groups = [
  // A long thin group with one ball out on the diagonal -- the case that is
  // inside both axis bounds and outside a naive ellipse.
  [{x: 0, z: -40}, {x: 0, z: 40}, {x: -8, z: 0}, {x: 8, z: 0}, {x: 6, z: 30}],
  // Wide and shallow.
  [{x: -30, z: 2}, {x: 30, z: -2}, {x: 0, z: 6}, {x: 12, z: -5}],
  // Diagonal, so the axes are not aligned to x/z at all.
  [{x: -20, z: -20}, {x: 20, z: 20}, {x: -4, z: 4}, {x: 5, z: -3}, {x: 14, z: 17}],
 ];
 for (const points of groups) {
  const g = groupEllipse(points);
  for (const p of points) {
   assert.ok(inside(g, p) <= 1 + 1e-9,
    `a ball sat at ${inside(g, p).toFixed(3)} of the ellipse it is meant to be inside`);
  }
 }
});

test('the ellipse lies along the way the group actually misses', () => {
 // Deep and narrow: long must run down z, not across it.
 const deep = groupEllipse([{x: 0, z: -40}, {x: 0, z: 40}, {x: -5, z: 0}, {x: 5, z: 0}]);
 assert.ok(deep.long > deep.wide * 3, `deep group came out ${deep.long.toFixed(1)} by ${deep.wide.toFixed(1)}`);
 assert.ok(Math.abs(Math.cos(deep.angle)) < 0.2, 'the major axis should run down the z axis');

 // Wide and shallow: the same group turned ninety degrees.
 const wide = groupEllipse([{x: -40, z: 0}, {x: 40, z: 0}, {x: 0, z: -5}, {x: 0, z: 5}]);
 assert.ok(wide.long > wide.wide * 3);
 assert.ok(Math.abs(Math.sin(wide.angle)) < 0.2, 'the major axis should run along the x axis');
});

test('the ellipse is not needlessly bigger than the group', () => {
 // Containment is necessary, but an ellipse twice the size of the balls would
 // be honest and useless. At least one ball has to touch the edge.
 const points = [{x: -20, z: -6}, {x: 22, z: 5}, {x: 3, z: -9}, {x: -7, z: 8}, {x: 11, z: 1}];
 const g = groupEllipse(points);
 const touch = Math.max(...points.map(p => inside(g, p)));
 assert.ok(touch > 0.95, `the tightest fit only reached ${touch.toFixed(3)} of the ellipse`);
});

test('a straight line of finishes draws a sliver, not nothing', () => {
 // A perfectly collinear group leaves one axis at zero, which would divide by
 // zero and draw an invisible ellipse.
 const g = groupEllipse([{x: 0, z: -30}, {x: 0, z: 0}, {x: 0, z: 30}]);
 assert.ok(g.wide > 0, 'a zero-width group must still have a drawable width');
 assert.ok(g.wide < g.long * 0.1, 'but it must still read as a line, not a blob');
 assert.ok(Number.isFinite(g.long) && Number.isFinite(g.wide));
});

test('clubs are separated, and ordered long to short', () => {
 const shots = [
  ...Array.from({length: 4}, () => shot('Driver', 0, 250)),
  ...Array.from({length: 4}, () => shot('7 Iron', 0, 150)),
  ...Array.from({length: 4}, () => shot('Wedge', 0, 95)),
 ];
 const groups = dispersionByClub(shots, {origin: {x: 0, z: 0}});
 assert.deepEqual(groups.map(g => g.club), ['Driver', '7 Iron', 'Wedge'],
  'the legend should read the way a bag does');
 for (const g of groups) assert.equal(g.n, 4);
});

test('a shot with no finish recorded is skipped, not counted as the origin', () => {
 // Rows written before `end` existed, or any row that failed to record one,
 // must not drag a group back toward 0,0 -- that would be inventing a shot.
 const shots = [
  ...Array.from({length: 4}, () => shot('Driver', 5, 250)),
  {club: 'Driver'}, {club: 'Driver', end: {x: NaN, z: 1}}, {club: 'Driver', end: null},
 ];
 const [g] = dispersionByClub(shots);
 assert.equal(g.n, 4, 'only the shots with a real finish are in the group');
 assert.ok(Math.abs(g.centre.z - 250) < 1e-9, 'the centre must not be pulled toward the origin');
});

test('a club keeps its colour when another club joins', () => {
 // Assigned from a palette in order, a club would change colour the moment you
 // picked up a different one, and the legend would shuffle mid-session.
 const before = clubColour('7 Iron');
 const after = clubColour('7 Iron');
 assert.equal(before, after);
 assert.notEqual(clubHue('7 Iron'), clubHue('Driver'));
 for (const club of ['Driver', '3 Wood', '7 Iron', 'Wedge', 'Putter', 'Launch monitor']) {
  const h = clubHue(club);
  assert.ok(Number.isInteger(h) && h >= 0 && h < 360, `${club} gave hue ${h}`);
 }
});

test('an empty session reports nothing rather than a group of nothing', () => {
 assert.deepEqual(dispersionByClub([]), []);
 assert.equal(groupEllipse([]), null);
});

test('grouping is by the club hit, not by where the numbers came from', () => {
 // A launch-monitor shot's `club` is the SOURCE. Grouped on that, a driver and a
 // 7 iron landed in one circle with a 64 yard radius -- a number describing
 // neither club. `clubKey` is what the player said they were hitting.
 const monitor = (key, x, z) => ({club: 'Launch monitor', clubKey: key, end: {x, z}});
 const shots = [
  ...Array.from({length: 4}, (_, i) => monitor('Driver', i, 250)),
  ...Array.from({length: 4}, (_, i) => monitor('7 Iron', i, 150)),
 ];
 const groups = dispersionByClub(shots, {origin: {x: 0, z: 0}});
 assert.deepEqual(groups.map(g => g.club), ['Driver', '7 Iron']);
 for (const g of groups) {
  assert.ok(g.long < 5, `${g.club} got a ${g.long.toFixed(1)} m long axis from a tight group`);
 }
});

test('a row with no clubKey still groups, on its club', () => {
 // Rows written before clubKey existed must not all collapse into one undefined
 // group and draw a circle across the whole field.
 const shots = Array.from({length: 4}, (_, i) => ({club: '7 Iron', end: {x: i, z: 150}}));
 const [g] = dispersionByClub(shots);
 assert.equal(g.club, '7 Iron');
});
