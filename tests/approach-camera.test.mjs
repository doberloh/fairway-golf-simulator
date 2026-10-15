import test from 'node:test';
import assert from 'node:assert/strict';
import {approachCloseness, trackCloseness, followBearing, flightCameraPose, followPose, puttAimPose, PUTT_RIG, PUTT_LOOK_SHARE} from '../src/camera.js';

// A flat hole with the cup at the origin; toWorld is identity so the numbers
// below are the ones the renderer would actually use.
const hole = {
 pin: {x: 0, z: 0}, rotation: 0,
 height: () => 0,
 toWorld: p => ({x: p.x, y: p.y, z: p.z}),
};
const at = (x, z, y = 0.021) => ({x, z, y});
const eyeDistance = p => {
 const pose = flightCameraPose(hole, p, 0, false);
 return Math.hypot(pose.eye.x - p.x, pose.eye.z - p.z);
};

test('the widest framing is for a ball that is nowhere near the hole', () => {
 // The close-in that drops the camera to turf level still does nothing out here.
 assert.equal(approachCloseness(hole, at(0, -40)), 0);
 assert.equal(approachCloseness(hole, at(0, -15)), 0);
 // But the broad tightening does, and it starts a long way out -- 40 m from the
 // pin is already inside it. This used to assert 24 m at 40 m, back when the
 // camera held one distance for the whole shot and only moved over the last
 // fifteen metres.
 assert.equal(trackCloseness(hole, at(0, -200)), 0, 'the tightening should not have begun at 200 m');
 assert.ok(Math.abs(eyeDistance(at(0, -200)) - 24) < 1e-9, 'the widest framing is 24 m');
 assert.ok(eyeDistance(at(0, -40)) < 24 - 1, '40 m from the pin the camera should already be closer');
});

test('the camera tightens the whole way in, not just at the end', () => {
 // The ball is in the AIR here, so `approachCloseness` contributes nothing --
 // this is purely the broad, distance-only half of it.
 let previous = Infinity;
 for (const d of [200, 150, 120, 90, 60, 40, 25, 18]) {
  const reach = eyeDistance(at(0, -d, 14));
  assert.ok(reach <= previous + 1e-9, `closing from ${d} m backed the camera off`);
  previous = reach;
 }
 assert.ok(previous < 24 * .7, `a ball near the green is still filmed from ${previous.toFixed(1)} m`);
 // And it is bounded and smooth, like the other one.
 let last = trackCloseness(hole, at(0, -200)), step = 0;
 for (let d = 200; d >= 0; d -= .5) {
  const v = trackCloseness(hole, at(0, -d));
  assert.ok(v >= 0 && v <= 1, `track closeness ${v} out of range`);
  assert.ok(v >= last - 1e-9, 'closing on the hole never backs the camera off');
  step = Math.max(step, v - last);
  last = v;
 }
 assert.ok(step < .05, `track closeness jumped by ${step.toFixed(3)} in one half metre`);
});

test('the camera closes in as the ball rolls up to the cup', () => {
 const steps = [12, 8, 5, 3, 2, 1].map(d => eyeDistance(at(0, -d)));
 for (let i = 1; i < steps.length; i++)
  assert.ok(steps[i] < steps[i - 1], `at step ${i} the camera went out, not in: ${steps}`);
 assert.ok(steps.at(-1) < 2, `over the hole the camera should be close, was ${steps.at(-1).toFixed(2)} m`);
});

test('a shot flying over the green is not dragged down to the turf', () => {
 // Directly above the cup but 20 m up: on distance alone this would be a full
 // close-up, which would put the camera underground while the ball is in flight.
 assert.equal(approachCloseness(hole, at(0, 0, 20)), 0);
 assert.equal(approachCloseness(hole, at(0, -1, 6)), 0);
 // Skimming the surface right at the hole is the case that should close in.
 assert.ok(approachCloseness(hole, at(0, -0.5, 0.021)) > 0.9);
});

test('closeness is smooth and bounded, with no corner going in or coming out', () => {
 let previous = approachCloseness(hole, at(0, -20));
 let biggestStep = 0;
 for (let d = 20; d >= 0; d -= 0.05) {
  const v = approachCloseness(hole, at(0, -d));
  assert.ok(v >= 0 && v <= 1, `closeness ${v} out of range at ${d} m`);
  assert.ok(v >= previous - 1e-9, 'closing on the hole never backs the camera off');
  biggestStep = Math.max(biggestStep, Math.abs(v - previous));
  previous = v;
 }
 assert.ok(biggestStep < 0.05, `closeness jumped by ${biggestStep.toFixed(3)} in one 5 cm step`);
});

test('a full shot is framed between the ball and the hole', () => {
 // It used to look dead at the ball. With the camera off the shoulder that put
 // the hole the full offset off-axis, hard against the edge of frame; leading
 // the view toward the hole splits the difference so both are in shot.
 for (const d of [60, 20, 10, 4, 1, 0.2]) {
  const p = at(0, -d);
  const pose = flightCameraPose(hole, p, 0, false);
  assert.ok(pose.target.z > p.z, `at ${d} m the view does not lead toward the hole`);
  assert.ok(pose.target.z <= hole.pin.z + 1e-9, `at ${d} m the view leads PAST the hole`);
  assert.ok(Math.abs(pose.target.x - p.x) < 1e-9, 'the lead should be straight at the hole');
 }
});

test('both the ball and the hole stay inside the frame', () => {
 // The point of the offset and the lead together. Anything much past 30 degrees
 // off the view axis is outside a normal field of view, so if either of these
 // drifts out the shot is being filmed with its subject off screen.
 const offAxis = (pose, point) => {
  const look = Math.atan2(pose.target.x - pose.eye.x, pose.target.z - pose.eye.z);
  const to = Math.atan2(point.x - pose.eye.x, point.z - pose.eye.z);
  return Math.abs(((to - look + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 180 / Math.PI;
 };
 for (const d of [200, 120, 60, 30, 12, 4, 1]) for (const lift of [0.021, 8, 25]) {
  const p = at(0, -d, lift);
  const pose = flightCameraPose(hole, p, 0, false);
  assert.ok(offAxis(pose, p) < 30, `ball ${offAxis(pose, p).toFixed(0)} deg off axis at ${d} m`);
  assert.ok(offAxis(pose, hole.pin) < 30, `hole ${offAxis(pose, hole.pin).toFixed(0)} deg off axis at ${d} m`);
 }
});

test('the camera trails the line to the HOLE, not the line the ball was struck on', () => {
 // They differ on anything that curves, and it is the hole that has to stay in
 // frame. Aim is deliberately nothing like the direction of the pin here.
 const ball = at(30, -40);
 const straightAtPin = Math.atan2(hole.pin.x - ball.x, hole.pin.z - ball.z);
 assert.ok(Math.abs(followBearing(hole, ball, 0) - straightAtPin) < 1e-9,
  'the follow bearing ignored the hole');
 // At the cup the bearing is undefined and a step either side of it swings half
 // a turn, so it hands back to the shot's own aim instead of spinning.
 assert.equal(followBearing(hole, at(0, 0), 37), 37 * Math.PI / 180);
 // And it blends rather than snapping: no big jump on the way in.
 let last = followBearing(hole, at(0, -12), 37), step = 0;
 for (let d = 12; d >= 0; d -= .05) {
  const v = followBearing(hole, at(0, -d), 37);
  step = Math.max(step, Math.abs(v - last));
  last = v;
 }
 assert.ok(step < .08, `the follow bearing jumped ${step.toFixed(3)} rad in one step`);
});

test('a putt starts close and still tightens over the hole', () => {
 const far = flightCameraPose(hole, at(0, -18), 0, true);
 const over = flightCameraPose(hole, at(0, -0.3), 0, true);
 const farD = Math.hypot(far.eye.x, far.eye.z + 18), overD = Math.hypot(over.eye.x, over.eye.z + 0.3);
 assert.ok(Math.abs(farD - 2.4) < 1e-9, 'a long putt keeps the usual putting framing');
 assert.ok(overD < farD, 'and tightens as the ball reaches the cup');
});

test('nothing is followed from dead behind any more', () => {
 // Directly behind the ball is the worst seat in the house: the ball is a dot on
 // its own trail and every shot looks the same, because nothing moves across the
 // frame. A putt gets a quarter turn, a full shot less -- the hole has to stay in
 // view, and it sits almost straight down the flight line.
 const ball = at(0, -3);
 const turnOf = putting => {
  const pose = flightCameraPose(hole, ball, 0, putting);
  return 180 - Math.abs(Math.atan2(pose.eye.x - ball.x, pose.eye.z - ball.z) * 180 / Math.PI);
 };
 assert.ok(Math.abs(turnOf(true) - 45) < 1e-9, `a putt should be a quarter turn round, was ${turnOf(true).toFixed(1)}`);
 assert.ok(Math.abs(turnOf(false) - 25) < 1e-9, `a full shot should be 25 deg round, was ${turnOf(false).toFixed(1)}`);
 assert.ok(turnOf(false) > 8, 'a full shot is back to being filmed from dead behind');
 assert.ok(turnOf(false) < turnOf(true), 'a full shot should be less turned than a putt');
});

test('the side view holds at 45 degrees whichever way the putt runs', () => {
 // The offset is applied in the hole's own frame, so a rotated hole or a putt
 // aimed anywhere keeps the same relationship to the roll rather than drifting
 // toward a fixed compass direction.
 for (const rotation of [0, 1.1, -2.4]) {
  const turned = {...hole, rotation};
  for (const aim of [0, 37, -80, 170]) {
   const pose = flightCameraPose(turned, at(0, -3), aim, true);
   const travel = aim * Math.PI / 180 + rotation;
   const eye = Math.atan2(pose.eye.x - 0, pose.eye.z + 3);
   let turn = (eye - travel) * 180 / Math.PI;
   turn = ((turn % 360) + 540) % 360 - 180;
   assert.ok(Math.abs(Math.abs(turn) - 135) < 1e-6,
    `rotation ${rotation} aim ${aim} put the eye ${turn.toFixed(1)} from the roll`);
  }
 }
});

test('following from the side still points the camera at the ball', () => {
 for (const d of [12, 4, 0.4]) {
  const p = at(0, -d);
  const pose = flightCameraPose(hole, p, 0, true);
  assert.equal(pose.target.x, p.x);
  assert.equal(pose.target.z, p.z);
 }
});

test('a putt still closes in on the cup from its new angle', () => {
 const far = flightCameraPose(hole, at(0, -18), 0, true);
 const near = flightCameraPose(hole, at(0, -0.3), 0, true);
 const reach = pose => Math.hypot(pose.eye.x - pose.target.x, pose.eye.z - pose.target.z);
 assert.ok(reach(near) < reach(far), 'the approach close-in has to survive the side view');
});

// The putt follow: the same camera, looking between the ball and the cup (the
// owner, 15 October 2026: pinned on the cup, a putt that ran wide or long
// rolled out of the frame).
test('a putt is followed looking between the ball and the cup, so both stay in view', () => {
 const ball = at(3, -6);
 const plain = flightCameraPose(hole, ball, 0, false);
 const putt = followPose(hole, ball, 0, true);
 assert.deepEqual(putt.eye, plain.eye, 'the rig must not change for a putt');
 const cup = hole.toWorld(hole.pin);
 const mid = {x: (ball.x + cup.x) * PUTT_LOOK_SHARE, z: (ball.z + cup.z) * PUTT_LOOK_SHARE};
 assert.ok(Math.hypot(putt.target.x - mid.x, putt.target.z - mid.z) < 1e-9, 'not halfway between ball and cup');
});

test('a putt that runs past the cup is still in the frame', () => {
 // Past the hole and off to the side: the angle from the camera's look to the
 // ball stays well inside half the field of view.
 for (const p of [at(0, -9), at(0, -0.4), at(1.5, 2.5), at(-2, 4), at(3, 0)]) {
  const {eye, target} = followPose(hole, p, 0, true);
  const look = [target.x - eye.x, target.y - eye.y, target.z - eye.z], toBall = [p.x - eye.x, p.y - eye.y, p.z - eye.z];
  const dot = look.reduce((t, v, i) => t + v * toBall[i], 0) / Math.hypot(...look) / Math.hypot(...toBall);
  assert.ok(Math.acos(Math.min(1, dot)) * 180 / Math.PI < 22, `the ball at ${JSON.stringify(p)} is out of frame`);
 }
});

// THE PUTT, AIMED (15 October 2026): low and behind the ball, looking along
// the line at the green past the cup -- not the broadcast rig's 9 m tower.
test('an aimed putt stands low behind the ball and looks at the green past the cup', () => {
 const ball = at(0, -8);
 const {eye, target} = puttAimPose(hole, ball, 0);
 assert.ok(Math.abs(eye.y - PUTT_RIG.height) < 1e-9, `eye at ${eye.y} m`);
 assert.ok(Math.abs(eye.z - (ball.z - PUTT_RIG.distance)) < 1e-9, 'not behind the ball on the line');
 assert.ok(target.z > 0 && target.z <= PUTT_RIG.beyond + 1e-9, 'the look is not just past the cup');
 // The ball sits inside the bottom half of a 53 degree frame.
 const look = [target.x - eye.x, target.y - eye.y, target.z - eye.z], toBall = [0 - eye.x, ball.y - eye.y, ball.z - eye.z];
 const dot = look.reduce((t, v, i) => t + v * toBall[i], 0) / Math.hypot(...look) / Math.hypot(...toBall);
 assert.ok(Math.acos(dot) * 180 / Math.PI < 26.5, 'the ball is out of frame');
 // Never below the ground behind the ball.
 const hill = {...hole, height: (x, z) => z < -10 ? 3 : 0};
 assert.ok(puttAimPose(hill, ball, 0).eye.y >= 3 + PUTT_RIG.clear - 1e-9, 'the eye went under the bank');
});

test('without the putt flag the follow is exactly what it always was', () => {
 for (const p of [at(0, -40), at(12, -3), at(-5, -110)]) {
  assert.deepEqual(followPose(hole, p, 0, false), flightCameraPose(hole, p, 0, false));
 }
});

test('a hole with no cup falls back rather than throwing', () => {
 // The practice bench has a pin; a malformed course might not.
 const pinless = {...hole, pin: null};
 const pose = followPose(pinless, at(0, -4), 0, true);
 assert.ok(Number.isFinite(pose.target.x) && Number.isFinite(pose.target.z));
});
