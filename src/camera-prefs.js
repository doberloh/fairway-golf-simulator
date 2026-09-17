// How you look at the course, kept on this device.
//
// These used to live in the round's own autosave, which made them a property of
// the round: discard the round and your bay setup went with it, and a round
// shared with someone else arrived carrying their screen size. A camera is a
// property of the ROOM you are standing in, so it belongs with graphics, the
// panel layout and the clock -- device preferences, never travelling with a
// course or a round.
import {projectorFov, DEFAULT_BAY, DEFAULT_ASPECT, ASPECTS} from './projector.js';

const KEY = 'fairway-camera-v1';

export const DEFAULT_CAMERA = {
 mode: 'player',
 // The broadcast rig: high and well back, which is what reads on a laptop.
 height: 9, offset: 0, distance: 23, fov: 53,
 follow: true, freeSpeed: 45,
 // The simulator rig. Off by default -- most people are not standing in a bay,
 // and switching somebody's field of view to a measurement of a screen they do
 // not have would be worse than a look they did not choose.
 sim: false,
 // Where the golfer's eyes are, and how far in front of them the ball sits.
 // 1.75 m is eye height for a person of about 1.88 m; the ball is a little under
 // a metre away at address.
 eyeHeight: 1.75, ballAhead: 0.9,
 ...DEFAULT_BAY,
};

const NUMBERS = {
 height: [0.2, 60], offset: [-40, 40], distance: [0.1, 120], fov: [10, 140],
 freeSpeed: [1, 400], eyeHeight: [0.5, 3], ballAhead: [0.1, 8],
 diagonal: [20, 400], standFeet: [1, 60],
};
const MODES = ['player', 'overview', 'green', 'free'];

// Anything unreadable falls back to the default for that field alone, so one bad
// number cannot cost you the rest of the setup.
export function validateCamera(raw = {}) {
 const out = {...DEFAULT_CAMERA};
 for (const [key, [lo, hi]] of Object.entries(NUMBERS)) {
  const v = Number(raw[key]);
  if (Number.isFinite(v)) out[key] = Math.min(hi, Math.max(lo, v));
 }
 if (MODES.includes(raw.mode)) out.mode = raw.mode;
 if (raw.aspect in ASPECTS) out.aspect = raw.aspect;
 if (typeof raw.follow === 'boolean') out.follow = raw.follow;
 if (typeof raw.sim === 'boolean') out.sim = raw.sim;
 return out;
}

export const CAMERA_KEYS = Object.keys(DEFAULT_CAMERA);

export function loadCamera() {
 try { return validateCamera(JSON.parse(localStorage.getItem(KEY)) || {}); }
 catch { return {...DEFAULT_CAMERA}; }
}

// Only the camera's own keys are written. `view.config` also carries the green
// reading flags and the free-flight floor, which belong to the round and the
// session rather than to the room.
export function saveCamera(config = {}) {
 const keep = {};
 for (const k of CAMERA_KEYS) if (config[k] !== undefined) keep[k] = config[k];
 const clean = validateCamera(keep);
 try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch {}
 return clean;
}

// THE RIG THE PLAYER CAMERA ACTUALLY USES.
//
// In simulator mode the three numbers that place the camera stop being taste and
// become measurements: the eye is at eye height, the ball sits its own distance
// in front, the lateral offset is zero because a golfer stands behind the ball
// and not beside it, and the field of view is whatever the bay's geometry says.
// The ball may fall below the bottom of the frame at that height, which is
// correct -- it is below your eyeline in the room too.
//
// If the bay measurements cannot produce an angle, the chosen field of view is
// kept rather than the view collapsing.
export function cameraRig(config = {}) {
 const c = {...DEFAULT_CAMERA, ...config};
 if (!c.sim) return {height: c.height, offset: c.offset, distance: c.distance, fov: c.fov};
 return {
  height: c.eyeHeight,
  offset: 0,
  distance: c.ballAhead,
  fov: projectorFov({diagonal: c.diagonal, aspect: c.aspect, standFeet: c.standFeet}) ?? c.fov,
 };
}

export {DEFAULT_ASPECT, ASPECTS};
