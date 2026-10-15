export const REPLAY_HOLD_SECONDS=3;
// The camera stays on the ball after it stops, before the game resets to the
// next address. Without it the view cut away the instant the ball settled, which
// is the one moment you actually want to look at -- where it finished.
export const SHOT_HOLD_SECONDS=3;
// Longer when the camera flies up to show the whole shot after it stops
// (tv-camera.js, *THE REVIEW*): the flight there takes up to 2.6 s, and the
// shot then wants a moment on screen. Placed, 10 October 2026.
export const REVIEW_HOLD_SECONDS=4.5;
export const HOLE_REVEAL_MS=3000;
// A HOLED BALL HAS NO LIE TO LOOK AT. The three-second hold is for seeing where
// a ball finished; once it has dropped the camera sat on an empty cup for all
// of it, and the owner took the still picture for the game freezing before the
// XP came up (14 October 2026). Long enough for the clunk in the cup and a
// beat, then the hole-out banner. PLACED.
export const HOLED_HOLD_SECONDS=1.2;
export function replayFinished(shotTime,duration,hold){return shotTime>=duration&&hold>=REPLAY_HOLD_SECONDS;}
export function shotSettled(shotTime,duration,hold,need=SHOT_HOLD_SECONDS){return shotTime>=duration&&hold>=need;}
export function shotDistance(origin,p){return Math.hypot(p.x-origin.x,p.z-origin.z);}
