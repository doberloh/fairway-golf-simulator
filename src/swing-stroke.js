// THE PULL-AND-PUSH SWING (branch pull-push-swing, 15 November 2026): a second
// way to strike with a finger or a mouse, beside the Swing Meter's three taps.
// The owner asked for a swing that does not mean stopping a moving piece on a
// line, because on the iPhone (held to 30 frames a second) the marker moves in
// jumps. Here nothing moves unless the thumb moves it:
//
//   1. Put the thumb down. Where it lands is the STRIKE LINE.
//   2. Pull it down. How far sets the distance, on the meter's own scale: a pull
//      of `fullPx` is the club's full carry, deeper is the overswing zone.
//      Hold as long as you like, slide to adjust. Letting go here is no stroke.
//   3. Push it back up across the strike line. That is the strike.
//
// WHAT THE PUSH IS JUDGED ON, by difficulty (the owner chose these layers):
//   - LINE (every difficulty): the push's direction against the AIM LINE drawn
//     under the thumb. Right of it sends the ball right, left sends it left.
//     On a side slope the aim line leans (`leanFor`): the ball follows the
//     ground, so the straight push leans uphill.
//   - TEMPO (Normal, Hard): the push's pace. Rushed goes left, low and hot;
//     lazy comes up short and drifts right.
//   - CURVE (Hard): the line is read from the START of the push, and the bend
//     at its END curves the ball -- a hook at the finish draws it left, a
//     slice fades it right. On Easy and Normal the whole push is one line.
//
// TEMPO IS THE PUSH'S OWN PACE, not the 3:1 back-to-through ratio first
// proposed: the thumb may hold and adjust at the top for as long as it likes,
// which leaves no backswing time to compare against. The ideal push takes
// `STROKE.tempo` ms for a full pull and a little less for a short one.
//
// FRAME RATE NEVER DECIDES: every judgement is made from the pointer's own
// samples (`event.timeStamp`, with the coalesced moves where the browser has
// them), and the two moments that matter -- leaving the top and crossing the
// strike line -- are interpolated between samples, so a slow screen only
// spaces the samples further apart. tests/swing-stroke.test.mjs plays the same
// stroke sampled at 30 and 120 a second.
//
// Pure: no DOM. It hands back what the Swing Meter's `strikeEffect` hands
// back (hla, axis, speed, miss, perfect) plus a launch change, and
// swing-meter.js `swingLaunch` does the rest exactly as for a meter swing.
//
// EVERY NUMBER HERE IS PLACED -- chosen to be tuned on the owner's phone, not
// taken from a source. RESEARCH.md, *The pull-and-push swing*.
import {clamp} from './physics.js';
import {OVERSWING} from './swing-meter.js';

export const STROKE = {
 // A thumb must move this far (px) down before a pull has begun.
 start: 6,
 // A pull shorter than this share of a full swing is not a swing: crossing
 // back over the line from it is ignored, so a thumb wobbling on the line
 // does not hit the ball.
 minShare: .04,
 // The top of the swing is where the push leaves this band below the deepest
 // point: a tenth of the pull, at least 4 px. Measuring from the edge of the
 // band, not the deepest sample, keeps a hold at the top out of the push.
 band: .1, bandMin: 4,
 // A rest at the top: the thumb within `stillPx` for `pause` ms.
 pause: 80, stillPx: 3,
 // Degrees of drift that match one bar length of the meter's strike zone, so
 // Normal's zone (0.065 of the bar) is about 8 degrees each side and its
 // perfect band about 2.
 degPerBar: 120,
 // The curve layer's zone is this much wider than the line's: a thumb's swipe
 // bends a little on its own.
 curveWiden: 1.5,
 // The ideal push for a full pull, ms; a pull of nothing would be `short` of it.
 tempo: 250, tempoShort: .6,
 // Side slope to aim-line lean: degrees of lean per degree of ground, and the most.
 leanPerDegree: 1.5, leanMax: 15,
};

// What each difficulty judges. `tempo` and `perfectTempo` are the ratios of the
// push's time to the ideal that bound the tempo zone and its perfect band.
export const STROKE_LAYERS = {
 easy: {tempo: false, curve: false, lean: .5, showWhilePulling: true},
 normal: {tempo: true, curve: false, lean: .75, tempoZone: 1.6, tempoPerfect: 1.15, showWhilePulling: true},
 hard: {tempo: true, curve: true, lean: 1, tempoZone: 1.35, tempoPerfect: 1.08, showWhilePulling: false},
};
export const strokeLayers = id => STROKE_LAYERS[id] || STROKE_LAYERS.normal;

// A full pull in CSS pixels for a screen this tall: about a third of it, so
// the distance a thumb learns is the same on every screen it plays on.
export const pullLength = height => clamp(Math.round(height * .3), 100, 260);

// THE AIM LINE'S LEAN on a side slope, in degrees, positive leaning right.
// `fallRight` is how many degrees the ground falls away to the right of the
// aim line at the ball. The ball follows the ground -- from either side of the
// ball, a golfer on a slope falling right sends it right (ball below a right
// hander's feet, above a left hander's) -- so the straight push leans the
// other way, uphill. Putts never lean: reading a green is the putt's job.
export function leanFor(fallRight, difficulty, {putt = false} = {}) {
 if (putt || !Number.isFinite(fallRight)) return 0;
 return clamp(-fallRight * STROKE.leanPerDegree * strokeLayers(difficulty).lean, -STROKE.leanMax, STROKE.leanMax);
}

// A STROKE IN PROGRESS. Times in ms on the input's clock, positions in CSS px.
export function startStroke(t, x, y, {fullPx, difficulty, putt = false, lean = 0}) {
 return {t0: t, x0: x, y0: y, fullPx, difficulty, putt, lean, pts: [{t, x, y}], deep: 0, done: false, result: null};
}
// How far the thumb is pulled now, as a share of a full swing (overswing past 1).
export const pullShare = (st, y) => clamp((y - st.y0) / st.fullPx, 0, 1 + OVERSWING);
// Is the thumb pulled far enough to count as a swing?
export const pulled = st => st.deep >= Math.max(STROKE.start, STROKE.minShare * st.fullPx);

// A pointer sample. Returns 'struck' when this sample crossed the strike line
// from a real pull, otherwise 'pull'. Samples out of time order are held to
// the last one's time.
export function strokeMove(st, t, x, y) {
 if (st.done) return 'struck';
 const last = st.pts.at(-1);
 st.pts.push({t: Math.max(t, last.t), x, y});
 if (y - st.y0 > st.deep) st.deep = y - st.y0;
 if (y <= st.y0 && last.y > st.y0 && pulled(st)) {
  const r = readStroke(st);
  if (r.share >= STROKE.minShare) { st.result = r; st.done = true; return 'struck'; }
  // Crossed back from a pull too small to be a swing: start again from here.
  st.deep = 0; st.pts = [st.pts.at(-1)];
 }
 return 'pull';
}

// Interpolate along the sample path where it first reaches height `y` at or
// after index `from`, going up the screen.
function upAt(p, from, y) {
 for (let i = Math.max(1, from); i < p.length; i++) {
  if (p[i].y <= y && p[i - 1].y > y) {
   const f = (p[i - 1].y - y) / (p[i - 1].y - p[i].y);
   return {t: p[i - 1].t + (p[i].t - p[i - 1].t) * f, x: p[i - 1].x + (p[i].x - p[i - 1].x) * f, y};
  }
 }
 return null;
}
const angleUp = (a, b) => Math.atan2(b.x - a.x, Math.max(1e-6, a.y - b.y)) * 180 / Math.PI;

// WHAT THE THUMB DID, read from the samples once it crossed the line: the
// pull (the deepest point of the final push), the push's line, its bend, and
// its pace against the ideal.
export function readStroke(st) {
 const p = st.pts, n = p.length - 1;
 // The final push: walk back from the crossing to where it began -- where the
 // thumb was last coming DOWN (a turn), or where it last rested (`pause` ms
 // within `stillPx`). The rest matters: a thumb that pulls deep, slides back
 // up to adjust and rests there pushes from where it rested, not from the
 // deeper point. Sliding up and pushing without a rest is one push.
 let i = n - 1, still = i;
 while (i > 0) {
  const a = p[i - 1];
  if (a.y < p[i].y - 1) break;
  if (Math.abs(a.y - p[still].y) > STROKE.stillPx) still = i - 1;
  else if (p[still].t - a.t >= STROKE.pause) { i = still; break; }
  i--;
 }
 let top = -Infinity;
 for (let k = i; k < n; k++) top = Math.max(top, p[k].y);
 const pullPx = top - st.y0, share = clamp(pullPx / st.fullPx, 0, 1 + OVERSWING);
 // Leaving the top: the last sample in the band, then interpolated out of it.
 const band = Math.max(STROKE.bandMin, STROKE.band * pullPx), edge = top - band;
 let k = n - 1;
 while (k > i && p[k].y < edge) k--;
 const from = upAt(p, k + 1, edge) || {t: p[k].t, x: p[k].x, y: p[k].y};
 const strike = upAt(p, k + 1, st.y0) || p[n];
 const mid = upAt(p, k + 1, (edge + st.y0) / 2) || strike;
 const line = angleUp(from, strike), start = angleUp(from, mid), finish = angleUp(mid, strike);
 // The pace: the time over the measured leg, against the ideal for this pull
 // scaled to the same leg.
 const ideal = STROKE.tempo * (STROKE.tempoShort + (1 - STROKE.tempoShort) * Math.min(1, share));
 const leg = Math.max(1, edge - st.y0) / Math.max(1, pullPx);
 const time = Math.max(1, strike.t - from.t);
 return {share, pullPx, line, start, curve: finish - start, time, ideal: ideal * leg, tempo: time / (ideal * leg), from, strike, top, samples: p.length};
}

// How far outside the perfect band, in zone widths, capped at 4 -- the meter's
// own measure, so a miss here costs what the same miss costs on the bar.
const missOf = (a, perfect, zone) => a <= perfect ? 0 : Math.min(4, (a - perfect) / Math.max(1e-6, zone - perfect));

// THE STRIKE. `zones` is the meter's strikeZone for this swing (bar lengths),
// so everything that narrows the meter's zone -- the lie, added spin, a flop,
// overswing, a short shot -- narrows the push's allowance the same way.
export function strokeEffect(r, zones, {difficulty, putt = false, lean = 0}) {
 const L = strokeLayers(difficulty);
 const zDeg = zones.zone * STROKE.degPerBar, pDeg = zones.perfect * STROKE.degPerBar;
 const curveOn = L.curve && !putt, tempoOn = L.tempo && !putt;
 // The line: the whole push, or on Hard the start of it.
 const lineErr = (curveOn ? r.start : r.line) - lean;
 const ml = missOf(Math.abs(lineErr), pDeg, zDeg), sl = Math.sign(lineErr);
 let hla, axis = 0, speed = 1, vla = 0;
 if (putt) hla = sl * ml * .5;
 else if (curveOn) hla = sl * ml * 1.25;
 // Easy and Normal: one line, judged as the meter judges a strike, start and curve together.
 else { hla = sl * ml * 1.25; axis = sl * ml * 5; }
 let mc = 0, sc = 0;
 if (curveOn) {
  mc = missOf(Math.abs(r.curve), pDeg * STROKE.curveWiden, zDeg * STROKE.curveWiden);sc = Math.sign(r.curve);
  axis += sc * mc * 5;
 }
 let mt = 0, st = 0;
 if (tempoOn) {
  const lr = Math.log(r.tempo);st = Math.sign(lr);
  mt = missOf(Math.abs(lr), Math.log(L.tempoPerfect), Math.log(L.tempoZone));
  if (st < 0) { hla -= mt * .75; axis -= mt * 3; vla -= mt * 1.2; speed *= 1 + .01 * Math.min(mt, 2); }
  else if (st > 0) { hla += mt * .75; axis += mt * 3; speed *= 1 - .03 * mt; }
 }
 const miss = Math.max(ml, mc, mt);
 return {hla, axis, speed, vla, miss, perfect: miss === 0,
  parts: {line: {side: sl, miss: ml, deg: lineErr}, curve: curveOn ? {side: sc, miss: mc, deg: r.curve} : null, tempo: tempoOn ? {side: st, miss: mt, ratio: r.tempo} : null}};
}

// What the stroke did, in words, for the line over the bar after it.
export function strokeWords(fx, {putt = false} = {}) {
 if (fx.perfect) return putt ? 'Perfect stroke' : 'Perfect strike';
 const out = [], {line, curve, tempo} = fx.parts;
 if (line.miss > 0) out.push(line.miss <= 1 ? (line.side > 0 ? 'a touch right' : 'a touch left') : (line.side > 0 ? 'pushed right' : 'pulled left'));
 if (curve?.miss > 0) out.push(curve.side < 0 ? (curve.miss <= 1 ? 'a little hook at the finish' : 'hooked at the finish') : (curve.miss <= 1 ? 'a little slice at the finish' : 'sliced at the finish'));
 if (tempo?.miss > 0) out.push(tempo.side < 0 ? (tempo.miss <= 1 ? 'a touch quick' : 'rushed') : (tempo.miss <= 1 ? 'a touch slow' : 'lazy'));
 const s = out.join(', ') || 'Good strike';
 return s[0].toUpperCase() + s.slice(1);
}
