// The bay's field of view is a measurement, not a look. These pin the geometry
// and the two ways it can be entered wrong.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectorFov, standForFov, screenHeight, fovForScreen, aspectName, ASPECTS,
 FOV_MIN, FOV_MAX, INCHES_PER_FOOT, DEFAULT_BAY} from '../src/projector.js';
import {cameraRig, validateCamera, DEFAULT_CAMERA} from '../src/camera-prefs.js';
import {framedForBall, BALL_FRAME, playerCameraPose} from '../src/camera.js';

test('a screen diagonal resolves to the height the angle is built on', () => {
 // 16:9 by Pythagoras: h = d / sqrt(1 + (16/9)^2), so a 100" screen is 49.03"
 // tall. Wrong here and every angle below is wrong by the same factor.
 assert.ok(Math.abs(screenHeight(100, '16:9') - 49.029) < 0.01);
 assert.ok(Math.abs(screenHeight(100, '4:3') - 60) < 0.01, 'a 4:3 100" screen is 60" tall');
 assert.ok(Math.abs(screenHeight(100, '1:1') - 70.711) < 0.01);
 // Every listed shape has to resolve; an unknown one must not return NaN.
 for (const a of Object.keys(ASPECTS)) assert.ok(screenHeight(100, a) > 0, a);
 assert.equal(screenHeight(100, 'nonsense'), screenHeight(100, '16:9'), 'an unknown shape falls back, it does not break');
 assert.equal(screenHeight(-5), 0);
});

test('the angle is the one the room actually subtends', () => {
 // Stand exactly as far back as the screen is tall and you see 53.13 degrees:
 // 2*atan(0.5) = 53.130. A round number worth pinning by hand.
 assert.ok(Math.abs(fovForScreen(60, 60) - 53.1) < 0.05);
 // Twice as far away, half as much angle -- near enough, since the tangent is
 // not linear: 2*atan(0.25) = 28.07.
 assert.ok(Math.abs(fovForScreen(60, 120) - 28.1) < 0.05);
 // Closer is wider.
 assert.ok(fovForScreen(60, 40) > fovForScreen(60, 60));
});

test('a standard bay comes out near a normal field of view', () => {
 // The default: a 138" 16:9 screen from 8 ft. If this ever lands somewhere
 // absurd the defaults are wrong, not the arithmetic.
 const fov = projectorFov(DEFAULT_BAY);
 assert.ok(fov > 25 && fov < 45, `the default bay gave ${fov}°`);
});

test('a bay measured wrong is clamped rather than rendering nothing', () => {
 // A zero or negative distance, or a screen entered in metres against a
 // distance in feet, would otherwise ask for a degenerate projection.
 assert.equal(projectorFov({diagonal: 100, standFeet: 0}), null);
 assert.equal(projectorFov({diagonal: 0, standFeet: 8}), null);
 assert.equal(projectorFov({}), null);
 assert.equal(projectorFov({diagonal: 100, standFeet: -3}), null);
 // Absurd but positive: standing two inches from a cinema screen.
 assert.equal(fovForScreen(300, 1), FOV_MAX);
 assert.equal(fovForScreen(1, 3000), FOV_MIN);
});

test('standing distance is the exact inverse of the angle', () => {
 // The panel offers it the other way round, so the two have to agree or the
 // note it prints contradicts the slider beside it.
 for (const standFeet of [5, 8, 12.5]) {
  const fov = projectorFov({diagonal: 138, standFeet});
  const back = standForFov({diagonal: 138, fov});
  assert.ok(Math.abs(back - standFeet) < 0.1, `${standFeet} ft round-tripped to ${back}`);
 }
 assert.equal(standForFov({diagonal: 0, fov: 40}), null);
 assert.equal(standForFov({diagonal: 138, fov: 0}), null);
});

test('the simulator rig is measurements; the ordinary rig is the sliders', () => {
 const hand = cameraRig({...DEFAULT_CAMERA, sim: false, height: 9, distance: 23, offset: 4, fov: 53});
 assert.deepEqual(hand, {height: 9, offset: 4, distance: 23, fov: 53, shift: 0});

 const bay = cameraRig({...DEFAULT_CAMERA, sim: true, eyeHeight: 1.75, ballAhead: 0.9,
  screenWidth: 120, screenHeight: 67.5, standFeet: 8, offset: 4, height: 9, distance: 23});
 assert.equal(bay.height, 1.75, 'the eye is at eye height');
 assert.equal(bay.distance, 0.9, 'the ball is where the ball is');
 assert.equal(bay.offset, 0, 'a golfer stands BEHIND the ball, never beside it');
 assert.equal(bay.fov, projectorFov({screenHeight: 67.5, standFeet: 8}));
 // The picture is drawn in the screen's shape, not the window's (5 October).
 assert.ok(Math.abs(bay.aspect - 120 / 67.5) < 1e-9, 'the view takes the measured screen\'s shape');
 assert.equal(hand.aspect, undefined, 'off the bay, the window decides the shape');
});

test('the screen is entered as two sides, and the shape is worked out from them', () => {
 // Only the height sets the angle: a wider screen of the same height is the
 // same vertical view, just more of it sideways.
 assert.equal(projectorFov({screenWidth: 120, screenHeight: 67.5, standFeet: 8}),
  projectorFov({screenWidth: 160, screenHeight: 67.5, standFeet: 8}));
 assert.equal(aspectName(120, 67.5), '16:9');
 assert.equal(aspectName(96, 72), '4:3');
 assert.equal(aspectName(100, 50), '2.00:1', 'a shape off the list is shown as a ratio');
 assert.equal(aspectName(0, 50), '', 'no shape without both sides');
});

test('a bay saved as a diagonal becomes the two sides it describes', () => {
 const old = validateCamera({sim: true, diagonal: 138, aspect: '16:9', standFeet: 9});
 assert.ok(Math.abs(old.screenHeight - 67.5) <= .5 && Math.abs(old.screenWidth - 120.5) <= .5,
  `138" 16:9 read as ${old.screenWidth}" x ${old.screenHeight}"`);
 assert.equal(old.standFeet, 9, 'the rest of the bay survives');
 const four = validateCamera({diagonal: 100, aspect: '4:3'});
 assert.deepEqual([four.screenWidth, four.screenHeight], [80, 60], 'a 100" 4:3 screen is 80" x 60"');
 // New sides win over an old diagonal left lying in the same save.
 assert.equal(validateCamera({diagonal: 138, screenWidth: 100, screenHeight: 60}).screenWidth, 100);
});

test('an unusable bay keeps the chosen angle rather than collapsing the view', () => {
 const rig = cameraRig({...DEFAULT_CAMERA, sim: true, screenHeight: 0, standFeet: 0, fov: 61});
 assert.equal(rig.fov, 61);
});

test('camera preferences survive nonsense one field at a time', () => {
 // One bad number must not cost the rest of a setup.
 const out = validateCamera({mode: 'nope', height: 'x', fov: 500, aspect: '9:16',
  sim: 'yes', standFeet: 11, follow: false});
 assert.equal(out.mode, DEFAULT_CAMERA.mode);
 assert.equal(out.height, DEFAULT_CAMERA.height);
 assert.equal(out.fov, 140, 'out of range clamps, it does not reset');
 assert.equal(out.aspect, DEFAULT_CAMERA.aspect);
 assert.equal(out.sim, DEFAULT_CAMERA.sim, 'a string is not a boolean');
 assert.equal(out.standFeet, 11, 'and the good values are kept');
 assert.equal(out.follow, false);
});

test('every default is itself valid', () => {
 // A default outside its own bounds would be clamped on first load and the
 // setting would appear to change on its own.
 assert.deepEqual(validateCamera(DEFAULT_CAMERA), {...DEFAULT_CAMERA});
});

test('a foot is twelve inches, which is the only unit conversion here', () => {
 assert.equal(INCHES_PER_FOOT, 12);
 // Same room, two ways of saying it.
 assert.equal(projectorFov({diagonal: 138, standFeet: 10}), fovForScreen(screenHeight(138), 120));
});

// Aiming a putt needs the ball on screen.

// How far below the camera's own view axis the ball sits, in degrees.
function ballBelowAxis(rig) {
 const flat = {height: () => 0, toWorld: p => ({x: p.x, y: p.y ?? 0, z: p.z}), rotation: 0};
 const {eye, target} = playerCameraPose(flat, {x: 0, z: 0}, 0, rig);
 const axis = Math.atan2(target.y - eye.y, Math.hypot(target.x - eye.x, target.z - eye.z));
 const ball = Math.atan2(0 - eye.y, Math.hypot(eye.x, eye.z));
 return (axis - ball) * 180 / Math.PI;
}

test('in a bay the ball is far outside the frame until the camera backs off', () => {
 // The mistake this fixes: eye height with the ball a metre in front puts it
 // about sixty degrees below the axis, and a bay frame is nineteen to the edge.
 const bay = cameraRig({...DEFAULT_CAMERA, sim: true, diagonal: 100, standFeet: 6});
 assert.ok(ballBelowAxis(bay) > bay.fov / 2, 'the ball should be out of frame before framing');
 const framed = framedForBall(bay);
 assert.ok(ballBelowAxis(framed) < framed.fov / 2,
  `still ${ballBelowAxis(framed).toFixed(1)}° below a ${(framed.fov / 2).toFixed(1)}° half-frame`);
});

test('framing moves the camera back and changes nothing else', () => {
 // Not a different rig: the same eye height, the same line, the same angle.
 const bay = cameraRig({...DEFAULT_CAMERA, sim: true});
 const framed = framedForBall(bay);
 assert.equal(framed.height, bay.height, 'eye height is the room, not a setting to fiddle with');
 assert.equal(framed.fov, bay.fov);
 assert.equal(framed.offset, bay.offset);
 assert.ok(framed.distance > bay.distance);
});

test('a camera that already shows the ball is left exactly alone', () => {
 // The broadcast rig has the ball at 81% of its half-angle, inside the frame, so
 // framing it would move a camera for no reason.
 const rig = cameraRig(DEFAULT_CAMERA);
 assert.equal(framedForBall(rig), rig, 'the same object, not a copy with the same numbers');
});

test('the hole is in frame too, for putts of any length', () => {
 // Backing off far enough to see the ball must not push the cup off the top.
 const framed = framedForBall(cameraRig({...DEFAULT_CAMERA, sim: true}));
 const flat = {height: () => 0, toWorld: p => ({x: p.x, y: p.y ?? 0, z: p.z}), rotation: 0};
 const {eye, target} = playerCameraPose(flat, {x: 0, z: 0}, 0, framed);
 const axis = Math.atan2(target.y - eye.y, Math.hypot(target.x - eye.x, target.z - eye.z));
 for (const putt of [0.5, 2, 6, 20, 35]) {
  const cup = Math.atan2(-eye.y, Math.hypot(eye.x, putt - eye.z));
  const below = (axis - cup) * 180 / Math.PI;
  assert.ok(below < framed.fov / 2, `a ${putt} m putt puts the cup ${below.toFixed(1)}° below the axis`);
 }
});

test('the framing fraction leaves real margin', () => {
 // At 1.0 the ball would sit exactly on the bottom edge, which is not visible in
 // any useful sense once the axis tilts down at all.
 assert.ok(BALL_FRAME > 0.5 && BALL_FRAME < 1);
});

test('a mat off the screen centre shifts the picture, not the eye', async () => {
 const {lensShift} = await import('../src/projector.js');
 // Centred: no shift.
 assert.equal(lensShift({standFeet: 8, sideFeet: 0}), 0);
 // Mat 2 ft RIGHT of centre, 8 ft back: the screen's centre is 2 ft to your
 // left, so the picture moves left by 2/8 of a unit of depth.
 assert.equal(lensShift({standFeet: 8, sideFeet: 2}), -0.25);
 assert.equal(lensShift({standFeet: 8, sideFeet: -2}), 0.25);
 // Nonsense in, no shift out; an absurd bay is clamped rather than obeyed.
 assert.equal(lensShift({standFeet: 0, sideFeet: 2}), 0);
 assert.equal(lensShift({standFeet: 1, sideFeet: 15}), -1.5);
 // In the rig: the eye stays behind the ball (offset 0) whatever the shift.
 const rig = cameraRig({...DEFAULT_CAMERA, sim: true, standFeet: 8, standSide: 2});
 assert.equal(rig.offset, 0);
 assert.equal(rig.shift, -0.25);
 assert.equal(cameraRig({...DEFAULT_CAMERA, sim: false, standSide: 2}).shift, 0, 'only the bay shifts');
 // It survives being framed for a putt.
 assert.equal(framedForBall(rig).shift, -0.25);
 // Saved and range-checked like the other bay numbers.
 assert.equal(validateCamera({standSide: 99}).standSide, 15);
 assert.equal(validateCamera({}).standSide, 0);
});
