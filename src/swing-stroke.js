// THE PULL-AND-PUSH SWING (branch pull-push-swing, 15-16 November 2026): how a
// golfer strikes the ball with a finger, a mouse or a controller's right stick.
// The owner asked for a swing that does not mean stopping a moving piece on a
// line, because on the iPhone (held to 30 frames a second) the Swing Meter's
// marker moved in jumps; then for the bar to go entirely, and for the shot's
// curve and height to come from the swing itself. Nothing moves unless the
// thumb moves it:
//
//   1. Put the thumb down. Where it lands is the STRIKE LINE.
//   2. Pull it down. How far sets the distance, on the old bar's own scale: a
//      pull of `fullPx` is the club's full carry, deeper is overswing. Hold as
//      long as you like, slide to adjust. Letting go here is no stroke.
//   3. Push it back up across the strike line. That is the strike -- its
//      line, tempo and curve are read there.
//   4. Follow through. How far past the line the push carries on sets the
//      HEIGHT: stopped short is Low (a punch), on to about the aim arrow is
//      Normal, well past it is High. The ball leaves once the follow-through
//      ends: the thumb stops or lifts, or `STROKE.throughMax` ms pass.
//
// WHAT IS JUDGED, by difficulty:
//   - LINE (every difficulty): the START of the push against the AIM LINE drawn
//     under the thumb. Right of it starts the ball right, left starts it left.
//     On a side slope the aim line leans (`leanFor`): the ball follows the
//     ground, so the straight push leans uphill.
//   - CURVE (every difficulty; the owner, 16 November 2026, in place of the
//     Curve box): the bend at the END of the push picks the shape. Kept
//     straight, it is Straight; bent into the draw lane (a hook at the finish,
//     left) it is a clean Draw, into the fade lane a clean Fade -- each started
//     the other way so it lands on the aim, as the Curve box's did. A bend
//     between the lanes, or past one, is a miss toward the nearest shape.
//     Difficulty sets how wide the lanes are.
//   - TEMPO (Normal, Hard): the push's pace. Rushed goes left, low and hot;
//     lazy comes up short and drifts right. Overswing narrows its window.
//   - HEIGHT (every difficulty; in place of the Height box): the follow-through,
//     a choice not a judgement -- there is no miss in it.
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
// stroke sampled at 30 and 120 a second. (A controller's stick is read once a
// frame, so its tempo does depend on the frame rate.)
//
// Pure: no DOM. It hands back what swing-meter.js `strikeEffect` hands back
// (hla, axis, speed, miss, perfect) plus a launch change and the shape it
// picked, and swing-meter.js `swingLaunch` does the rest.
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
 // Degrees of drift that match one length of the meter's strike zone, so
 // Normal's zone (0.065) is about 8 degrees each side and its perfect band
 // about 2.
 degPerBar: 120,
 // A start line off the aim: degrees of launch direction per zone width.
 lineHla: 2.5,
 // The draw and fade lanes sit this many degrees of bend either side of
 // straight; a bend that misses them adds this much spin axis per lane width.
 laneAt: 22, laneMissAxis: 3,
 // The ideal push for a full pull, ms; a pull of nothing would be `short` of it.
 tempo: 250, tempoShort: .6,
 // The same for a controller's right stick, which travels a short way fast.
 tempoPad: 150,
 // Side slope to aim-line lean: degrees of lean per degree of ground, and the most.
 leanPerDegree: 1.5, leanMax: 15,
 // THE FOLLOW-THROUGH, in shares of a full pull past the strike line: under
 // `lowBelow` is Low, from `highFrom` High, Normal between. It ends when the
 // thumb has not moved for `settle` ms, at `throughMax` ms after the strike,
 // at `throughCap` (nothing more to learn), or when the thumb lifts.
 lowBelow: .2, highFrom: .55, throughCap: .9, settle: 90, throughMax: 600,
};

// What each difficulty judges and allows. `straight` and `lane` are half-widths
// in degrees of the straight band and the draw and fade lanes; `tempoZone` and
// `tempoPerfect` the ratios of the push's time to the ideal that bound the
// tempo zone and its perfect band. `cue` shows the ideal pace at the top.
export const STROKE_LAYERS = {
 easy: {tempo: false, lean: .5, straight: 8, lane: 12, showWhilePulling: true, cue: true},
 normal: {tempo: true, lean: .75, straight: 6, lane: 9, tempoZone: 1.6, tempoPerfect: 1.15, showWhilePulling: true, cue: true},
 hard: {tempo: true, lean: 1, straight: 4, lane: 6, tempoZone: 1.35, tempoPerfect: 1.08, showWhilePulling: false, cue: false},
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

// The ideal push, ms, for a pull of `share` with this stroke's full ideal.
export const idealPush = (share, full = STROKE.tempo) => full * (STROKE.tempoShort + (1 - STROKE.tempoShort) * Math.min(1, share));

// A STROKE IN PROGRESS. Times in ms on the input's clock, positions in CSS px.
// `tempo` is the ideal full push for this input (STROKE.tempoPad for a stick).
export function startStroke(t, x, y, {fullPx, difficulty, putt = false, lean = 0, tempo = STROKE.tempo}) {
 return {t0: t, x0: x, y0: y, fullPx, difficulty, putt, lean, tempo, pts: [{t, x, y}], deep: 0, done: false, result: null, follow: 0, movedAt: t, crossT: null};
}
// How far the thumb is pulled now, as a share of a full swing (overswing past 1).
export const pullShare = (st, y) => clamp((y - st.y0) / st.fullPx, 0, 1 + OVERSWING);
// Is the thumb pulled far enough to count as a swing?
export const pulled = st => st.deep >= Math.max(STROKE.start, STROKE.minShare * st.fullPx);
// How far the follow-through has carried past the strike line, in full pulls.
export const followShare = st => Math.max(0, st.follow / st.fullPx);
// The height the follow-through picks.
export function heightOf(st) {
 const f = followShare(st);
 return f < STROKE.lowBelow ? 'low' : f >= STROKE.highFrom ? 'high' : 'normal';
}

// A pointer sample. Returns 'pull' before the strike, 'crossed' on the sample
// that crossed the strike line from a real pull, 'through' while following
// through, and 'done' when the follow-through has gone as far as it can.
// Samples out of time order are held to the last one's time.
export function strokeMove(st, t, x, y) {
 if (st.done) return 'done';
 const last = st.pts.at(-1), tt = Math.max(t, last.t);
 st.pts.push({t: tt, x, y});
 if (Math.hypot(x - last.x, y - last.y) > STROKE.stillPx / 2) st.movedAt = tt;
 if (st.result) {
  st.follow = Math.max(st.follow, st.y0 - y);
  if (followShare(st) >= STROKE.throughCap) { st.done = true; return 'done'; }
  return 'through';
 }
 if (y - st.y0 > st.deep) st.deep = y - st.y0;
 if (y <= st.y0 && last.y > st.y0 && pulled(st)) {
  const r = readStroke(st);
  if (r.share >= STROKE.minShare) { st.result = r; st.crossT = r.strike.t; st.follow = st.y0 - y; st.movedAt = tt; return 'crossed'; }
  // Crossed back from a pull too small to be a swing: start again from here.
  st.deep = 0; st.pts = [st.pts.at(-1)];
 }
 return 'pull';
}
// Is the follow-through over by time t? The thumb has stopped, or long enough
// has passed since the strike. (A lift ends it too: `endStroke`.)
export function throughDone(st, t) {
 if (!st.result) return false;
 if (!st.done && (t - st.movedAt >= STROKE.settle || t - st.crossT >= STROKE.throughMax)) st.done = true;
 return st.done;
}
// The thumb lifted: a stroke that had struck is finished; one that had not is
// no stroke (false).
export function endStroke(st) {
 if (st.result) st.done = true;
 return st.done;
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
 const ideal = idealPush(share, st.tempo ?? STROKE.tempo);
 const leg = Math.max(1, edge - st.y0) / Math.max(1, pullPx);
 const time = Math.max(1, strike.t - from.t);
 return {share, pullPx, line, start, curve: finish - start, time, ideal: ideal * leg, idealFull: ideal, tempo: time / (ideal * leg), from, strike, top, samples: p.length};
}

// How far outside the perfect band, in zone widths, capped at 4 -- the meter's
// own measure, so a miss here costs what the same miss cost on the bar.
const missOf = (a, perfect, zone) => a <= perfect ? 0 : Math.min(4, (a - perfect) / Math.max(1e-6, zone - perfect));

// THE SHAPE A BEND PICKS. `bend` is the push's finish against its start,
// degrees, negative left (a hook: a draw). Inside the straight band: Straight.
// Inside a lane: a clean Draw or Fade. Anywhere else: the nearest shape, with
// `miss` lane widths of error (to 4) and `extra` the side the error bends
// (+1 right, -1 left): short of a lane bends back toward straight, past it
// bends further.
export function curveOf(bend, difficulty) {
 const L = strokeLayers(difficulty), a = Math.abs(bend), side = bend < 0 ? -1 : 1;
 const lo = STROKE.laneAt - L.lane, hi = STROKE.laneAt + L.lane, laned = side < 0 ? 'draw' : 'fade';
 if (a <= L.straight) return {shape: 'straight', miss: 0, extra: 0};
 if (a >= lo && a <= hi) return {shape: laned, miss: 0, extra: 0};
 if (a > hi) return {shape: laned, miss: Math.min(4, (a - hi) / L.lane), extra: side};
 const toStraight = a - L.straight, toLane = lo - a;
 return toStraight <= toLane ? {shape: 'straight', miss: Math.min(4, toStraight / L.lane), extra: side}
  : {shape: laned, miss: Math.min(4, toLane / L.lane), extra: -side};
}

// THE STRIKE. `zones` is the meter's strikeZone for this swing (in lengths of a
// full swing), so everything that narrows it -- the lie, spin, a flop,
// overswing, a short shot -- narrows the push's allowance the same way.
export function strokeEffect(r, zones, {difficulty, putt = false, lean = 0}) {
 const L = strokeLayers(difficulty);
 const zDeg = zones.zone * STROKE.degPerBar, pDeg = zones.perfect * STROKE.degPerBar;
 const tempoOn = L.tempo && !putt;
 // The line: the start of the push against the (leaning) aim line.
 const lineErr = r.start - lean;
 const ml = missOf(Math.abs(lineErr), pDeg, zDeg), sl = Math.sign(lineErr);
 let hla = sl * ml * (putt ? .5 : STROKE.lineHla), axis = 0, speed = 1, vla = 0;
 // The curve: the shape the bend picked, and any miss of it.
 const cv = putt ? null : curveOf(r.curve, difficulty);
 if (cv) axis += cv.extra * cv.miss * STROKE.laneMissAxis;
 let mt = 0, st = 0;
 if (tempoOn) {
  const lr = Math.log(r.tempo);st = Math.sign(lr);
  // Overswing narrows the tempo window as it narrows the line's: to half at the end of it.
  const k = r.share > 1 ? 1 - .5 * clamp((r.share - 1) / OVERSWING, 0, 1) : 1;
  mt = missOf(Math.abs(lr), Math.log(L.tempoPerfect) * k, Math.log(L.tempoZone) * k);
  if (st < 0) { hla -= mt * .75; axis -= mt * 3; vla -= mt * 1.2; speed *= 1 + .01 * Math.min(mt, 2); }
  else if (st > 0) { hla += mt * .75; axis += mt * 3; speed *= 1 - .03 * mt; }
 }
 const miss = Math.max(ml, cv?.miss ?? 0, mt);
 return {hla, axis, speed, vla, miss, perfect: miss === 0, curve: cv?.shape ?? 'straight',
  parts: {line: {side: sl, miss: ml, deg: lineErr}, curve: cv ? {...cv, deg: r.curve} : null,
   tempo: tempoOn || !putt ? {side: tempoOn ? st : 0, miss: mt, ratio: r.tempo, judged: tempoOn, ms: r.time, ideal: r.ideal} : null}};
}

// What the stroke did, in words, for the line after it.
export function strokeWords(fx, {putt = false, height = null, heightWord = null} = {}) {
 const out = [], {line, curve, tempo} = fx.parts;
 if (fx.perfect) out.push(putt ? 'Perfect stroke' : 'Perfect strike');
 if (!putt && curve) {
  const w = curveWord(curve.shape);
  if (!curve.miss) out.push(w);
  else if (curve.shape === 'straight') out.push(curve.extra < 0 ? 'Straight, hooked a touch' : 'Straight, sliced a touch');
  // Bent the lane's way past it is too much; short of it, not enough.
  else out.push(`${w}, ${curve.extra === (curve.shape === 'draw' ? -1 : 1) ? 'too much' : 'not enough'}`);
 }
 if (!putt && height) out.push(heightWord || height[0].toUpperCase() + height.slice(1));
 if (line.miss > 0) out.push(line.miss <= 1 ? (line.side > 0 ? 'a touch right' : 'a touch left') : (line.side > 0 ? 'pushed right' : 'pulled left'));
 if (tempo?.judged && tempo.miss > 0) out.push(tempo.side < 0 ? (tempo.miss <= 1 ? 'a touch quick' : 'rushed') : (tempo.miss <= 1 ? 'a touch slow' : 'lazy'));
 const s = out.join(' · ') || 'Good strike';
 return s[0].toUpperCase() + s.slice(1);
}
const curveWord = s => ({draw: 'Draw', fade: 'Fade', straight: 'Straight'}[s]);

// WHERE THE TEMPO SAT, for the gauge after a stroke: -1 at the quick end of
// the zone, 0 ideal, +1 at the slow end (beyond is clamped to 1.4 either way),
// and the perfect band's half-width on the same scale.
export function tempoGauge(ratio, difficulty) {
 const L = STROKE_LAYERS[difficulty]?.tempo ? STROKE_LAYERS[difficulty] : STROKE_LAYERS.normal;
 const z = Math.log(L.tempoZone);
 return {at: clamp(Math.log(ratio) / z, -1.4, 1.4), perfect: Math.log(L.tempoPerfect) / z};
}
