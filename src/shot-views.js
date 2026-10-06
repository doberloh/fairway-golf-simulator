// A shot seen flat: side on, and from above.
//
// The 3D view is the shot as you stood over it, which is the wrong shape for two
// questions people actually ask a practice ground. "How high did that go, and
// where did it stop climbing" is a height-against-distance curve, and "how far
// left did that finish" is a ground track. Both are unreadable from behind the
// ball, because the camera is looking down the one axis each of them measures.
//
// Nothing here simulates anything. It reduces a trajectory the physics already
// produced to two numbers per sample and draws them. If a view and the readouts
// ever disagree, the view is wrong -- they are the same data.

// Down-the-line and across-the-line, measured against the line the shot was
// AIMED down rather than against the green. A shot aimed at the 250 target and
// finishing beside it is straight, and a plan view that bent it toward the green
// would be drawing a miss that did not happen. `off` matches `offlineOf` in
// range.js exactly -- positive is right of the aim -- so the plot and the OFFLINE
// column in the shot list can never tell different stories.
export function shotProfile(points, origin, aimDegrees = 0, groundAt = null) {
 const a = aimDegrees * Math.PI / 180, sin = Math.sin(a), cos = Math.cos(a);
 return points.map(p => {
  const dx = p.x - origin.x, dz = p.z - origin.z;
  return {
   along: dx * sin + dz * cos,
   // The golfer's right is local -x (physics.js, simulateShot).
   off: dz * sin - dx * cos,
   // Height above the turf under the ball, not above sea level. On a range they
   // are the same number; on a course they are not, and the one that means
   // anything is the clearance.
   height: Math.max(0, p.y - (groundAt ? groundAt(p.x, p.z) : 0)),
   t: p.t ?? 0,
  };
 });
}

// The bounds a plot needs, with the cross-axis forced symmetric so the aim line
// sits down the middle. An asymmetric plan view would put a dead straight shot
// hard against one edge and read as a miss.
export function profileBounds(profile, {symmetric = false, pad = 0.08} = {}) {
 if (!profile.length) return {min: 0, max: 1, alongMax: 1};
 const alongMax = Math.max(1, ...profile.map(p => p.along));
 const values = profile.map(p => (symmetric ? p.off : p.height));
 let min = Math.min(0, ...values), max = Math.max(...values);
 if (symmetric) {
  // A floor on the width, or a shot that never left the line is drawn at a
  // scale where a centimetre of wobble looks like forty yards of slice.
  const reach = Math.max(2, Math.abs(min), Math.abs(max));
  min = -reach; max = reach;
 }
 const span = Math.max(1e-6, max - min);
 return {min: min - span * pad, max: max + span * pad, alongMax};
}

const YARD = 0.9144, FOOT = 0.3048;

// Shared frame: axes, a ground line, and the distance ticks both views use. Drawn
// from the canvas's own pixel size so a resized popup redraws correctly.
function frame(ctx, w, h, {alongMax, min, max, ticks, label, zero = false}) {
 ctx.clearRect(0, 0, w, h);
 const L = 34, R = 8, T = 10, B = 18;
 const px = a => L + (a / alongMax) * (w - L - R);
 const py = v => T + (1 - (v - min) / (max - min)) * (h - T - B);

 ctx.strokeStyle = 'rgba(236,243,230,.14)';
 ctx.lineWidth = 1;
 ctx.font = '9px ui-monospace,Menlo,monospace';
 ctx.fillStyle = 'rgba(236,243,230,.45)';
 ctx.textAlign = 'center';
 for (const yd of ticks) {
  const d = yd * YARD;
  if (d > alongMax) continue;
  ctx.beginPath(); ctx.moveTo(px(d), T); ctx.lineTo(px(d), h - B); ctx.stroke();
  ctx.fillText(String(yd), px(d), h - 6);
 }
 // The zero line is the aim line on a plan view and the turf on a side view.
 ctx.strokeStyle = zero ? 'rgba(236,243,230,.38)' : 'rgba(177,188,103,.6)';
 ctx.lineWidth = zero ? 1 : 1.5;
 if (zero) ctx.setLineDash([5, 5]);
 ctx.beginPath(); ctx.moveTo(L, py(0)); ctx.lineTo(w - R, py(0)); ctx.stroke();
 ctx.setLineDash([]);

 ctx.textAlign = 'left';
 ctx.fillStyle = 'rgba(236,243,230,.55)';
 ctx.fillText(label, 3, T + 8);
 return {px, py, L, R, T, B};
}

// Distance ticks that suit the shot rather than a fixed grid: a 12 ft putt and a
// 280 yd drive cannot share one set of gridlines.
//
// The ladder is picked so the step is never LARGER than the shot. A fixed 5-yard
// step left a four-yard putt with no gridlines whatsoever -- a bare axis, which
// reads as a broken plot rather than as a short shot.
export function distanceTicks(alongMax) {
 const yards = alongMax / YARD;
 const LADDER = [1, 2, 5, 10, 25, 50, 100];
 const step = LADDER.find(v => yards / v <= 8) ?? LADDER[LADDER.length - 1];
 const out = [];
 for (let d = step; d <= yards + 1e-9; d += step) out.push(+d.toFixed(6));
 return out;
}

function trace(ctx, profile, map, valueOf, colour) {
 ctx.strokeStyle = colour;
 ctx.lineWidth = 2;
 ctx.lineJoin = 'round';
 ctx.lineCap = 'round';
 ctx.beginPath();
 profile.forEach((p, i) => {
  const q = [map.px(p.along), map.py(valueOf(p))];
  i ? ctx.lineTo(...q) : ctx.moveTo(...q);
 });
 ctx.stroke();
}

// The ball at rest, so the end of the line reads as a finish rather than as the
// plot running out of canvas.
function endPoint(ctx, profile, map, valueOf) {
 const last = profile[profile.length - 1];
 if (!last) return;
 ctx.fillStyle = '#fff';
 ctx.strokeStyle = '#31503c';
 ctx.lineWidth = 1.2;
 ctx.beginPath();
 ctx.arc(map.px(last.along), map.py(valueOf(last)), 3, 0, Math.PI * 2);
 ctx.fill(); ctx.stroke();
}

// Height against distance. The apex is marked because it is the number a player
// reads a flight by, and it is the one thing a down-the-line camera cannot show.
export function drawSideView(canvas, profile) {
 const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
 if (!profile.length) { ctx.clearRect(0, 0, w, h); return; }
 const b = profileBounds(profile);
 const map = frame(ctx, w, h, {...b, ticks: distanceTicks(b.alongMax), label: 'HEIGHT'});
 trace(ctx, profile, map, p => p.height, '#ffe0a0');

 const apex = profile.reduce((best, p) => (p.height > best.height ? p : best), profile[0]);
 if (apex.height > 0.5) {
  ctx.strokeStyle = 'rgba(255,224,160,.35)';
  ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(map.px(apex.along), map.py(apex.height));
  ctx.lineTo(map.px(apex.along), map.py(0));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,224,160,.85)';
  ctx.font = '9px ui-monospace,Menlo,monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(apex.height / FOOT)} ft`, map.px(apex.along), map.py(apex.height) - 4);
 }
 endPoint(ctx, profile, map, p => p.height);
}

// The ground track, aim line down the middle. Left of the line is L and right is
// R, which is the convention the shot list already reports offline in.
export function drawPlanView(canvas, profile) {
 const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
 if (!profile.length) { ctx.clearRect(0, 0, w, h); return; }
 const b = profileBounds(profile, {symmetric: true});
 const map = frame(ctx, w, h, {...b, ticks: distanceTicks(b.alongMax), label: 'OFFLINE', zero: true});
 trace(ctx, profile, map, p => p.off, '#9fd0ff');

 const last = profile[profile.length - 1];
 if (Math.abs(last.off) > 0.3) {
  ctx.fillStyle = 'rgba(159,208,255,.85)';
  ctx.font = '9px ui-monospace,Menlo,monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${(Math.abs(last.off) / YARD).toFixed(1)} ${last.off >= 0 ? 'R' : 'L'}`,
   w - 10, map.py(last.off) - 5);
 }
 endPoint(ctx, profile, map, p => p.off);
}
