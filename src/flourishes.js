// HOLE-OUT FLOURISHES (Phase 6, 14 October 2026; the agreed spec, 7.4).
//
// Visual only -- the owner: no new sounds. Sparkles, confetti, fireworks, a
// golden ring burst and a sky lantern, at the green when a golfer holes out
// with one earned (rewards.js `flourishFor` picks which).
//
// DRAWN FLAT, ON A 2D CANVAS OVER THE COURSE, NOT IN THE 3D SCENE. A particle
// system in the scene would be new shaders (a frozen frame the first time one
// plays -- B7) and frame cost to profile; a flat overlay is neither, costs a
// few hundred canvas draws a frame for three or four seconds, and stops
// completely when it is done. It is anchored at the cup: `origin()` is asked
// every frame where the cup is on screen and every particle is drawn
// relative to it, so the whole burst follows the cup as the camera pulls back
// into the hole summary. Considered and rejected: three.js
// Points at the green, for the reasons above.
//
// Skipped entirely for a player who asks for reduced motion.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const CONFETTI = ['#ff5a5f', '#ffd166', '#06d6a0', '#4dc3ff', '#b388ff', '#ff9f43', '#ffffff'];
const GOLD = ['#ffe58a', '#f5c542', '#d9a21b', '#fff3c4', '#c88a12'];

// Each effect: `spawn(o, t)` adds particles while it runs, `life` its length in
// seconds. Particles carry their own draw. PLACED by eye: counts, speeds,
// gravity, lengths.
// `pal`, when set (level 50: everything in gold), replaces each effect's
// colours.
const EFFECTS = {
 'sparkle-par': {life: 2.2, spawn: sparkles()},
 'confetti-birdie': {life: 3.2, spawn: confetti(CONFETTI, 140)},
 'fireworks-eagle': {life: 3.6, spawn: fireworks(4)},
 'fireworks-birdie': {life: 3.2, spawn: fireworks(3)},
 'ring-chip-in': {life: 2.6, spawn: rings()},
 'lantern-ace': {life: 4.8, spawn: lantern()},
};
// A PAR'S SPARKLES: the simplest -- a soft rise of twinkling stars for under a
// second, gone in two. PLACED.
function sparkles() {
 return (ps, o, t, first, fx) => {
  if (t > .9) return;
  const pal = fx.pal || ['#fff6c8', '#ffe58a', '#ffffff', '#cfefff'];
  for (let k = 0; k < 2; k++) if (Math.random() < .55) ps.push({x: o.x + rnd(-36, 36), y: o.y + rnd(-8, 4), vx: rnd(-18, 18), vy: rnd(-130, -55), g: -8, drag: .6, life: rnd(.8, 1.3), c: pick(pal), r: rnd(1.6, 3.2), tw: rnd(0, TAU),
   draw(ctx, p, k2) { const s = p.r * (.6 + .4 * Math.sin(p.age * 14 + p.tw)); ctx.globalAlpha = k2; ctx.fillStyle = p.c; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? s * .35 : s * 1.6; ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }});
 };
}
export const FLOURISH_IDS = Object.keys(EFFECTS);

function confetti(colours, n) {
 return (ps, o, t, first, fx) => {
  if (!first) return;
  colours = fx.pal || colours;
  for (let i = 0; i < n; i++) {
   const a = rnd(-Math.PI * .85, -Math.PI * .15), v = rnd(260, 620);
   ps.push({x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, drag: 1.6, w: rnd(5, 9), h: rnd(3, 6), rot: rnd(0, TAU), spin: rnd(-9, 9), c: pick(colours), life: rnd(2.2, 3.1),
    draw(ctx, p, k) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 1.7)); ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }});
  }
 };
}
function fireworks(bursts) {
 return (ps, o, t, first, fx) => {
  if (first) fx.at = Array.from({length: bursts}, (_, i) => ({when: .15 + i * .45, dx: rnd(-160, 160), up: rnd(150, 260), c: pick(fx.pal || ['#ffd166', '#ff5a5f', '#4dc3ff', '#b388ff', '#06d6a0'])}));
  for (const b of fx.at) if (!b.done && t >= b.when) {
   b.done = true;
   const cx = o.x + b.dx, cy = o.y - b.up;
   for (let i = 0; i < 70; i++) {
    const a = i / 70 * TAU + rnd(-.05, .05), v = rnd(150, 300);
    ps.push({x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 180, drag: 2.2, c: b.c, life: rnd(1.1, 1.6), px: cx, py: cy,
     draw(ctx, p, k) { ctx.globalAlpha = k; ctx.strokeStyle = p.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke(); p.px = p.x - p.vx * .03; p.py = p.y - p.vy * .03; }});
   }
  }
  // The rocket trails rising to each burst.
  for (const b of fx.at) if (!b.done && t >= b.when - .3 && !b.rocket) {
   b.rocket = true;
   ps.push({x: o.x + b.dx * .2, y: o.y, vx: b.dx * 2.6, vy: -b.up / .3, g: 0, drag: 0, c: '#fff6d8', life: .3,
    draw(ctx, p, k) { ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, TAU); ctx.fill(); }});
  }
 };
}
function rings() {
 return (ps, o, t, first) => {
  if (!first) return;
  for (let i = 0; i < 3; i++) ps.push({x: o.x, y: o.y, vx: 0, vy: 0, g: 0, drag: 0, life: 1.4, delay: i * .25, r: 0,
   draw(ctx, p, k) { if (p.age < p.delay) return; const a = (p.age - p.delay) / (p.life - p.delay); ctx.globalAlpha = Math.max(0, 1 - a); ctx.strokeStyle = '#ffd86b'; ctx.lineWidth = 4 * (1 - a) + 1; ctx.beginPath(); ctx.ellipse(o.x, o.y, 20 + a * 170, 8 + a * 60, 0, 0, TAU); ctx.stroke(); }});
  for (let i = 0; i < 40; i++) { const a = rnd(0, TAU), v = rnd(120, 260); ps.push({x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .45 - 60, g: 120, drag: 1.8, life: rnd(.9, 1.4), c: pick(GOLD),
   draw(ctx, p, k) { ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, TAU); ctx.fill(); }}); }
 };
}
function lantern() {
 return (ps, o, t, first) => {
  if (!first) return;
  ps.push({x: o.x, y: o.y - 10, vx: 0, vy: -55, g: 0, drag: 0, life: 4.7, sway: rnd(0, TAU),
   draw(ctx, p, k) {
    const x = p.x + Math.sin(p.sway + p.age * 1.3) * 14, y = p.y, fade = Math.min(1, p.age * 2) * Math.min(1, (p.life - p.age) * 1.2);
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 70); glow.addColorStop(0, 'rgba(255,190,90,.55)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.globalAlpha = fade; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(x - 13, y - 18); ctx.lineTo(x + 13, y - 18); ctx.lineTo(x + 10, y + 16); ctx.lineTo(x - 10, y + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.ellipse(x, y + 12, 5, 3, 0, 0, TAU); ctx.fill();
   }});
  for (let i = 0; i < 26; i++) ps.push({x: o.x + rnd(-30, 30), y: o.y, vx: rnd(-20, 20), vy: rnd(-90, -40), g: -10, drag: .3, life: rnd(1.5, 3), c: pick(GOLD), delay: rnd(0, 1.5),
   draw(ctx, p, k) { if (p.age < p.delay) return; ctx.globalAlpha = k * .9; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, TAU); ctx.fill(); }});
 };
}

// Play one. `canvas` covers the course; `origin()` returns where the cup is in
// the canvas's CSS pixels, or null when it is off screen (the burst then stays
// where it last was). Returns a stop function. One at a time: a new one ends
// the last.
const ZERO = {x: 0, y: 0};
let running = null;
export function playFlourish(canvas, id, origin, {gold = false} = {}) {
 const fx = EFFECTS[id];
 if (!fx || !canvas) return () => {};
 if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
 running?.();
 const ctx = canvas.getContext('2d'), ps = [], state = {pal: gold ? GOLD : null};
 let start = null, last = null, alive = true, o = origin() || {x: canvas.clientWidth / 2, y: canvas.clientHeight * .6};
 const fit = () => { const d = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) { canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); } ctx.setTransform(d, 0, 0, d, 0, 0); };
 canvas.hidden = false;
 const stop = () => { alive = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.hidden = true; if (running === stop) running = null; };
 running = stop;
 const frame = now => {
  if (!alive) return;
  start ??= now; const t = (now - start) / 1000, dt = Math.min(.05, last == null ? 0 : (now - last) / 1000); last = now;
  const at = origin(); if (at) o = at;
  fit(); ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  // EVERY PARTICLE LIVES RELATIVE TO THE CUP: spawned about a zero origin and
  // drawn shifted to wherever the cup is this frame, so the whole burst moves
  // with it as the camera pulls back. Spawned at the cup's first screen place
  // and left there, a burst that began with the cup off screen flew up out of
  // view and drew nothing (smoke, 15 October 2026).
  fx.spawn(ps, ZERO, t, t === 0 || !state.started, state); state.started = true;
  for (let i = ps.length - 1; i >= 0; i--) {
   const p = ps[i]; p.age = (p.age || 0) + dt;
   if (p.age > p.life) { ps.splice(i, 1); continue; }
   p.vx *= Math.max(0, 1 - p.drag * dt); p.vy = p.vy * Math.max(0, 1 - p.drag * dt) + p.g * dt;
   p.x += p.vx * dt; p.y += p.vy * dt; if (p.spin) p.rot += p.spin * dt;
   ctx.save(); ctx.translate(o.x, o.y); p.draw(ctx, p, Math.min(1, (p.life - p.age) / .6)); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // What it is doing, for a test to read: where the cup is, and how many
  // particles are alive.
  canvas.dataset.at = `${Math.round(o.x)},${Math.round(o.y)}`; canvas.dataset.parts = ps.length; canvas.dataset.size = `${canvas.clientWidth}x${canvas.clientHeight}`;
  if (t < fx.life || ps.length) requestAnimationFrame(frame); else stop();
 };
 requestAnimationFrame(frame);
 return stop;
}
