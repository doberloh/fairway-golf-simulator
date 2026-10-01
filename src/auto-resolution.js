// AUTOMATIC RESOLUTION (F4 in TODO): draw fewer pixels when frames run slow,
// and take them back when there is room.
//
// The pixel ratio is the one lever that trades picture for frame time smoothly
// on any machine: every pixel costs the same fragment work, and a phone has
// many pixels and a small graphics chip. Measured on the development machine,
// High at 1x pixels 10.7 ms, 1.5x 12.4 ms, 2x 14.4 ms (TODO, F4).
//
// This module is only the decision, a pure function of the frame intervals it
// is fed, so it can be tested without a browser. The renderer applies the
// scale (`GolfView.setResolutionScale`), under the tier's own ceiling: a step
// never draws MORE pixels than the tier allows, only fewer.
//
// WHAT IT AIMS FOR: 60 frames a second, or the frame cap when that is lower.
// Not the display's own rate. A 120 Hz display running an Ultra course at 90
// fps is playing smoothly, and trading its sharpness to chase 120 is exactly
// the "annoying" behaviour the owner asked to be able to switch off -- so it
// does not happen in the first place. A player who caps at 30 is asking for 30.
//
// HOW IT KNOWS THERE IS ROOM. It cannot see it: the display paces frames, so a
// frame that took 6 ms and one that took 15 ms both arrive 16.7 ms apart. So
// after a spell of frames at the target it simply tries one step sharper, and
// if that step is slow it steps back and waits twice as long before trying
// again, up to a minute. That doubling is the whole of the hysteresis: a
// machine sitting on the edge between two steps settles on the lower one
// instead of flickering, and a long quiet spell slowly earns the wait back.

// Fractions of the tier's own pixel ratio, sharpest first.
export const RESOLUTION_STEPS = [1, .85, .72, .6, .5];
// Below this the picture is too soft to aim by, whatever the frame rate.
export const MIN_PIXEL_RATIO = .5;

const WINDOW = 1000;      // ms of frames judged together
const SETTLE = 600;       // ms ignored after any change, while targets reallocate
const SLOW = 1.15;        // average interval over target by this much is slow
const STEADY = 1.06;      // ...and under this much is at the target
const FIRST_WAIT = 4000;  // ms at the target before trying a step sharper
const LONGEST_WAIT = 60000;
const BOUNCE = 3000;      // a step up undone within this long doubles the wait
// A long frame straight after a normal one is a hitch -- a probe, a tile, a
// shader -- and says nothing about the steady state, so it is not counted. A
// long frame after another long frame IS the steady state, on a machine that
// slow, and is counted: ignoring every long frame would leave the machine that
// most needs fewer pixels never getting them.
const HITCH = 200;

// `ceiling` is the tier's pixel ratio after the display's own (min of the
// two); the steps are fractions of it, clamped at MIN_PIXEL_RATIO, and steps
// that clamp to the same ratio are merged so every step changes something.
export function resolutionLadder(ceiling) {
 const out = [];
 for (const f of RESOLUTION_STEPS) {
  const ratio = Math.max(Math.min(ceiling, MIN_PIXEL_RATIO), ceiling * f);
  if (!out.length || ratio < out[out.length - 1].ratio - 1e-6) out.push({scale: ratio / ceiling, ratio});
 }
 return out;
}

export function targetInterval(frameCap) {
 return 1000 / Math.min(frameCap > 0 ? frameCap : 60, 60);
}

export function createAutoResolution() {
 let ladder = resolutionLadder(1), level = 0;
 let since = 0, windowStart = 0, sum = 0, count = 0;
 let steadySince = null, wait = FIRST_WAIT, lastUp = -Infinity, quietSince = 0, previous = 0;
 const reset = now => { since = now; windowStart = now; sum = 0; count = 0; steadySince = null; };
 return {
  // The tier changed (or the display did): start again from the sharpest.
  setCeiling(ceiling, now = 0) {
   ladder = resolutionLadder(ceiling); level = 0; wait = FIRST_WAIT; lastUp = -Infinity; quietSince = now; reset(now);
  },
  // Off, or paused (hidden page, loading screen): back to full resolution and
  // forget what was measured, so nothing stale is judged when it resumes.
  stop(now = 0) { level = 0; reset(now); },
  // Paused where frames say nothing about play (a hidden page, the loading
  // screen): keep the step, forget the half-measured window. Not `stop` -- a
  // slow phone sent back to full resolution at every new hole would stutter
  // for two seconds each time before stepping down again.
  hold(now = 0) { reset(now); },
  get scale() { return ladder[level].scale; },
  get level() { return level; },
  get steps() { return ladder.length; },
  get wait() { return wait; },
  // One rendered frame: `interval` ms since the last. Returns the scale to draw
  // at -- the same object each time until a step is taken.
  sample(interval, now, frameCap = 0) {
   if (now - since < SETTLE) { windowStart = now; sum = 0; count = 0; return ladder[level].scale; }
   const isolated = interval > HITCH && previous <= HITCH;
   previous = interval;
   if (!(interval > 0) || isolated) return ladder[level].scale;
   sum += interval; count++;
   if (now - windowStart < WINDOW) return ladder[level].scale;
   const mean = sum / count, target = targetInterval(frameCap);
   windowStart = now; sum = 0; count = 0;
   if (mean > target * SLOW) {
    steadySince = null;
    if (level < ladder.length - 1) {
     // Undoing a step up that did not hold: wait longer before the next try.
     if (now - lastUp < BOUNCE + SETTLE + WINDOW) wait = Math.min(LONGEST_WAIT, wait * 2);
     level++; quietSince = now; reset(now);
    }
    return ladder[level].scale;
   }
   if (mean < target * STEADY) {
    steadySince ??= now - WINDOW;
    // A long quiet spell earns the wait back, a halving at a time.
    if (now - quietSince > 4 * wait && wait > FIRST_WAIT) { wait = Math.max(FIRST_WAIT, wait / 2); quietSince = now; }
    if (level > 0 && now - steadySince >= wait) { level--; lastUp = now; reset(now); }
   } else steadySince = null;
   return ladder[level].scale;
  },
 };
}
