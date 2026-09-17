export const REPLAY_HOLD_SECONDS=3;
// The camera stays on the ball after it stops, before the game resets to the
// next address. Without it the view cut away the instant the ball settled, which
// is the one moment you actually want to look at -- where it finished.
export const SHOT_HOLD_SECONDS=3;
export const HOLE_REVEAL_MS=3000;
export function replayFinished(shotTime,duration,hold){return shotTime>=duration&&hold>=REPLAY_HOLD_SECONDS;}
export function shotSettled(shotTime,duration,hold){return shotTime>=duration&&hold>=SHOT_HOLD_SECONDS;}
export function shotDistance(origin,p){return Math.hypot(p.x-origin.x,p.z-origin.z);}
