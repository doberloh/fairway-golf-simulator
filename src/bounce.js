// THE BOUNCE. One impact of a spinning ball on the ground, as an impulse.
//
// Three things happen in the half millisecond a ball spends in the turf, and
// each is one line of physics with one measured constant:
//
// 1. THE GROUND GIVES. The ball digs a pitch mark and pushes against its front
//    wall, so the surface it actually bounces off is tilted back toward where
//    it came from (Penner 2002, after Haake's measurements on greens). The tilt
//    grows with impact speed and with how glancing the arrival is, and is
//    nothing for a ball dropped straight down. It is what turns a drive's
//    forward speed into a high first bounce, and what stands a wedge up.
//
// 2. IT COMES BACK SLOWER. Restitution along that tilted normal falls from
//    about a half for a gentle hop to about an eighth for a full shot, because
//    a hard impact spends its energy making the pitch mark (turf.js
//    `restitution`). That is why a ball bounces several times, each bounce a
//    larger share of the last.
//
// 3. THE TURF GRABS THE SPIN -- AS HARD AS IT CAN AND NO HARDER. Friction acts
//    on the point of the ball touching the ground, against the way that point
//    is sliding. For a ball with backspin that point is sliding FORWARD faster
//    than the ball is travelling, so friction slows the ball and takes off
//    backspin together. Friction is limited to `mu` times how hard the ball is
//    pressed in (Coulomb). Either:
//      - the limit is enough to stop the sliding: the ball GRIPS and leaves
//        rolling off the tilted surface. All the backspin was spent in one
//        bite. With a lot of spin and a steep arrival that leaves it going
//        backwards -- the wedge that zips back on a soft green.
//      - or it is not: the ball SKIDS through the bounce, keeps some of its
//        backspin and hops forward. The NEXT, gentler bounce grips, and that is
//        the hop-and-check.
//    Which of the two happens is not chosen anywhere. It falls out of the
//    spin, the speed, the angle and the surface.
//
// On top of that, long grass swallows a share of whatever is left (`grab`),
// and sand takes all the spin.
//
// Pure: arrays in, arrays out, no course. physics.js calls `bounce` at every
// touchdown; tests/bounce.test.mjs and tools/ball-bench.mjs call it directly.
// docs/BALL_PHYSICS.md, *The bounce*.
import {restitution, TILT_SPEED, TILT_ANGLE} from './turf.js';

const R = 0.021335, DEG = Math.PI / 180;
// The reference impact's speed INTO the ground: the pitch mark is as deep as the
// ball arrives hard, so the tilt scales with this and not with the ball's whole
// speed. A ball skipping along at a shallow angle barely marks the turf.
const TILT_NORMAL = TILT_SPEED * Math.cos(TILT_ANGLE * DEG);
// The tilt is capped a little short of the arrival angle itself: a surface
// tilted further than the ball is coming in at would be facing away from it.
const TILT_SHARE = .8, TILT_MAX = 32;

// `v` velocity (m/s), `w` angular velocity (rad/s), `n` the unit ground normal,
// `row` a turf.js row. Returns {v, w, gripped, tilt (deg), e, normalSpeed}.
// `v` and `w` are not modified.
export function bounce(v, w, n, row) {
 const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
 const tx = v[0] - vn * n[0], ty = v[1] - vn * n[1], tz = v[2] - vn * n[2];
 const ts = Math.hypot(tx, ty, tz), speed = Math.hypot(v[0], v[1], v[2]);
 // Angle of arrival measured from the normal: 0 straight down, 90 grazing.
 const incidence = Math.atan2(ts, Math.max(-vn, 1e-9)) / DEG;
 const tilt = row.hard || ts < 1e-6 ? 0
  : Math.min(row.tilt * (-vn / TILT_NORMAL) * (incidence / TILT_ANGLE), incidence * TILT_SHARE, TILT_MAX);
 const c = Math.cos(tilt * DEG), s = Math.sin(tilt * DEG), inv = ts > 1e-9 ? 1 / ts : 0;
 // The effective normal: leaned back against the direction of travel.
 const nx = n[0] * c - tx * inv * s, ny = n[1] * c - ty * inv * s, nz = n[2] * c - tz * inv * s;
 const vnn = v[0] * nx + v[1] * ny + v[2] * nz;
 const e = restitution(row, vnn);
 const jn = Math.max(0, -(1 + e) * vnn);
 // Velocity of the ball's contact point along the surface: its travel, less
 // what its spin carries the bottom of the ball backwards (or, with backspin,
 // plus what it carries it forwards).
 const cx = w[1] * nz - w[2] * ny, cy = w[2] * nx - w[0] * nz, cz = w[0] * ny - w[1] * nx;
 const sx = v[0] - vnn * nx - R * cx, sy = v[1] - vnn * ny - R * cy, sz = v[2] - vnn * nz - R * cz;
 const slip = Math.hypot(sx, sy, sz);
 // A solid sphere (I = 2/5 m r^2): stopping the slip takes slip / 3.5.
 const need = slip / 3.5, can = row.mu * jn, jt = Math.min(need, can);
 const ux = slip > 1e-9 ? sx / slip : 0, uy = slip > 1e-9 ? sy / slip : 0, uz = slip > 1e-9 ? sz / slip : 0;
 const out = [v[0] + jn * nx - jt * ux, v[1] + jn * ny - jt * uy, v[2] + jn * nz - jt * uz];
 const k = 2.5 * jt / R;
 const spin = [w[0] + k * (ny * uz - nz * uy), w[1] + k * (nz * ux - nx * uz), w[2] + k * (nx * uy - ny * ux)];
 // Long grass and sand swallow travel and spin beyond what friction took.
 if (row.grab > 0) {
  const on = out[0] * n[0] + out[1] * n[1] + out[2] * n[2], keep = 1 - row.grab;
  for (let i = 0; i < 3; i++) { out[i] = on * n[i] + (out[i] - on * n[i]) * keep; spin[i] *= keep; }
 }
 if (row.killsSpin) spin[0] = spin[1] = spin[2] = 0;
 // Never leaves into the ground.
 const on = out[0] * n[0] + out[1] * n[1] + out[2] * n[2];
 if (on < 0) for (let i = 0; i < 3; i++) out[i] -= on * n[i];
 return {v: out, w: spin, gripped: need <= can, tilt, e, normalSpeed: -vnn};
}
