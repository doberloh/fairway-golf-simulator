// GAME VIEW'S RULES (the owner, 4 November 2026; docs/COURSE_BUILDER.md, *Game
// view*): when the game's picture has to be built again, and how the editor's
// camera becomes the game's. Pure; tests/builder-game-view.test.mjs. The page
// itself is game-view.js.

// What would change the picture: a new step on the undo list, a step taken back
// (the redo list), and the few edits that make no step of their own. Compared
// by identity, so an undo and a different edit, which leave the list the same
// length, still count. `touched` is a one-tree slider's drag after its first
// step (editing.js sizeTree).
export const changeMark = s => [s.undo.length, s.undo.at(-1) ?? null, s.redo.length, s.treeScale, s.treePlan, s.landscape, s.name, s.touched ?? 0];
export const sameMark = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

// The game's free camera is an eye, a turn and a tilt (renderer.js placeCamera:
// it looks along sin(turn)cos(tilt), sin(tilt), cos(turn)cos(tilt)); the
// editor's is an eye and what it looks at.
export function poseFrom(eye, look) {
 const dx = look.x - eye.x, dy = look.y - eye.y, dz = look.z - eye.z, len = Math.hypot(dx, dy, dz) || 1;
 return {eye: {x: eye.x, y: eye.y, z: eye.z}, yaw: Math.atan2(dx, dz), pitch: Math.asin(Math.max(-1, Math.min(1, dy / len)))};
}
export const samePose = (a, b) => !!a && !!b && a.yaw === b.yaw && a.pitch === b.pitch && a.eye.x === b.eye.x && a.eye.y === b.eye.y && a.eye.z === b.eye.z;

// Never under the ground (PLACED: a golfer's eye over it).
export const EYE_OVER_GROUND = 1.6;
export const clearOfGround = (y, ground) => Math.max(y, ground + EYE_OVER_GROUND);

// The keys held, as the game's moveFree wants them: forward, right, up.
export function flyAxes(held) {
 const on = k => held.has(k) ? 1 : 0;
 return {forward: on('KeyW') - on('KeyS'), right: on('KeyD') - on('KeyA'), up: on('KeyE') - on('KeyQ'), fast: held.has('ShiftLeft') || held.has('ShiftRight')};
}
