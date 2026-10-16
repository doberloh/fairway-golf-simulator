// WHERE A CHALLENGE'S BALLS GO, AND WHICH HOLE IT USES (16 October 2026).
//
// Pure: a hole is asked about through a small adapter, the way upDownSpots
// always was --
//   {pin, tee, length, surface(x, z), edge(x, z), center(z)}
// with `edge` metres from the green's edge (negative on the green) and
// `center(z)` the hole's centre line, in the hole's own frame (+z down the
// hole). main.js builds one from a course hole; the tests build them from the
// shared test worlds.
//
// The same course, hole and challenge always give the same spots: every draw
// comes from a hash of `seed` (main.js passes "<course seed>:<hole>:<id>").
// Every rule here is PLACED (RESEARCH.md *Challenges and medals*).

import {greenDistance} from './course.js';

const YARD = .9144, FOOT = .3048;

// The adapter for a generated hole (course.js), played from tee set `tee`.
export function holeAdapter(h, tee = 'white') {
 const t = h.tees?.[tee] || Object.values(h.tees || {})[0] || {x: 0, z: 0};
 return {pin: h.pin, tee: {x: t.x, z: t.z}, length: h.length, surface: (x, z) => h.surface(x, z), edge: (x, z) => greenDistance(h, x, z), center: z => h.center(z)};
}

// A seeded stream of numbers in [0, 1), from any string.
export function seeded(seed) {
 let h = 2166136261;
 for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
 return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CHIP = ['fringe', 'semi', 'rough', 'fairway', 'sand'], GRASS = ['fringe', 'semi', 'rough', 'fairway'], LIE = ['fairway', 'semi'];
const crosses = (hole, a, b, kind, from = .05, to = .95) => {
 for (let i = 0; i <= 24; i++) { const f = from + (to - from) * i / 24; if (hole.surface(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f) === kind) return true; }
 return false;
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ROUND THE GREEN: `n` spots off the putting surface by `lo` to `hi` yards, on
// ground a chip is played from, spread round the green rather than bunched.
// (What upDownSpots did, unchanged for up and down's 3 to 18 yards.) Bunkers
// and short sides are not spread -- a green may have sand on one side only --
// but kept 3 m apart.
export function aroundGreen(hole, rnd, n, {lo = 3, hi = 18, ok = CHIP, test = null, reach = 40, spread = true} = {}) {
 const out = [];
 for (let k = 0; k < n; k++) {
  for (let tries = 0; tries < (spread ? 200 : 600); tries++) {
   const a = (spread ? (k + rnd()) / n : rnd()) * Math.PI * 2, r = 4 + rnd() * reach;
   const p = {x: hole.pin.x + Math.sin(a) * r, z: hole.pin.z + Math.cos(a) * r}, e = hole.edge(p.x, p.z);
   if (e >= lo * YARD && e <= hi * YARD && ok.includes(hole.surface(p.x, p.z)) && (spread || out.every(q => dist(p, q) >= 3)) && (!test || test(p))) { out.push(p); break; }
  }
 }
 return out;
}
// ON THE CENTRE LINE, `yards` from the pin back toward the tee, on the fairway
// or the first cut; nudged sideways up to 12 m, then along by up to 5 yards,
// when the line itself is not mown there. Null when nothing fits.
export function onLine(hole, yards, ok = LIE) {
 const want = yards * YARD;
 let lo = -60, hi = hole.pin.z;
 for (let i = 0; i < 40; i++) { const z = (lo + hi) / 2, d = Math.hypot(hole.center(z) - hole.pin.x, z - hole.pin.z); if (d > want) lo = z; else hi = z; }
 const z0 = (lo + hi) / 2;
 for (const along of [0, 2, -2, 4, -4]) for (const side of [0, 3, -3, 6, -6, 9, -9, 12, -12]) {
  const z = z0 + along * YARD, p = {x: hole.center(z) + side, z};
  if (ok.includes(hole.surface(p.x, p.z))) return p;
 }
 return null;
}
// ON THE GREEN, `feet` from the hole: `angles` 'seeded' (each its own),
// 'compass' (eight points, starting from the line back to the tee), 'line'
// (one angle for all, the one with room for the longest). On the green with
// a foot to spare. `shrink`: a putt with no room at its length is brought in
// a tenth at a time until it fits. Null for any that will not fit.
export function onGreen(hole, rnd, feet, {angles = 'seeded', shrink = false} = {}) {
 const fits = p => hole.surface(p.x, p.z) === 'green' && hole.edge(p.x, p.z) <= -FOOT;
 const at = (a, f) => ({x: hole.pin.x + Math.sin(a) * f * FOOT, z: hole.pin.z + Math.cos(a) * f * FOOT, feet: f});
 const back = Math.atan2(hole.tee.x - hole.pin.x, hole.tee.z - hole.pin.z);
 if (angles === 'compass') return feet.map((f, k) => { const p = at(back + k * Math.PI / 4, f); return fits(p) ? p : null; });
 if (angles === 'line') {
  const longest = Math.max(...feet);let best = null, reach = 0;
  for (let i = 0; i < 48; i++) { const a = rnd() * Math.PI * 2;let f = 0; for (const x of [...feet].sort((p, q) => p - q)) { if (fits(at(a, x))) f = x; else break; } if (f > reach) { reach = f;best = a; } if (reach >= longest) break; }
  return feet.map(f => best != null && f <= reach ? at(best, f) : null);
 }
 return feet.map(f => {
  for (let len = f; len >= Math.min(f, 6); len = shrink ? Math.round(len * .9) : -1) {
   for (let i = 0; i < 48; i++) { const p = at(rnd() * Math.PI * 2, len); if (fits(p)) return p; }
   if (!shrink) break;
  }
  return null;
 });
}

// THE SPOTS FOR A CHALLENGE on a hole. `def` is its challenges.js row;
// `ctx` {driver}. An empty list for a tee or range challenge; null when the
// hole cannot host it.
export function spotsFor(def, hole, seed) {
 const s = def.spot;
 if (!s) return [];
 const rnd = seeded(seed), n = def.balls;
 let out;
 if (s.kind === 'around') out = aroundGreen(hole, rnd, n, {lo: s.lo, hi: s.hi, ok: s.grass ? GRASS : CHIP});
 else if (s.kind === 'bunker') out = aroundGreen(hole, rnd, n, {lo: .5, hi: 20, ok: ['sand'], reach: 45, spread: false});
 // A BUNKER BETWEEN BALL AND PIN, and the ball on grass just beyond it.
 else if (s.kind === 'shortSide') out = aroundGreen(hole, rnd, n, {lo: 2, hi: 22, ok: ['fringe', 'semi', 'rough'], test: p => crosses(hole, p, hole.pin, 'sand'), reach: 55, spread: false});
 else if (s.kind === 'line') out = s.yards.map(y => onLine(hole, y));
 // OVER THE WATER: on the fairway 100 to 170 yards out, with water on the way
 // to the pin. The same spot for every ball when only one fits.
 else if (s.kind === 'water') {
  const found = [];
  for (let y = 100; y <= 170 && found.length < n; y += 10) {
   const p = onLine(hole, y + Math.floor(rnd() * 5));
   if (p && crosses(hole, p, hole.pin, 'water') && !found.some(q => dist(p, q) < 8)) found.push(p);
  }
  out = found.length ? Array.from({length: n}, (_, k) => found[k % found.length]) : [];
 } else if (s.kind === 'putt') out = onGreen(hole, rnd, s.feet, {angles: s.angles, shrink: s.shrink});
 else throw Error(`No spot kind called ${s.kind}.`);
 // The putting ladder may stop short of 30 feet on a small green; anything
 // else needs every spot.
 if (def.order === 'streak') { const k = out.findIndex(p => !p); out = k < 0 ? out : out.slice(0, k); return out.length >= 3 ? out : null; }
 return out.length === n && out.every(Boolean) ? out : null;
}

// FIND THE ZONE: the middle of the fairway where this golfer's driver reaches
// -- 85% of its carry from the tee, so most drives can get there -- or the
// nearest mown ground to it. PLACED.
export function zoneFor(hole, driverYards) {
 const want = Math.min(driverYards * .85, (hole.length || 400) / YARD * .75) * YARD;
 for (const along of [0, 5, -5, 10, -10, 15, -15]) {
  const z = hole.tee.z + want + along * YARD, p = {x: hole.center(z), z};
  if (hole.surface(p.x, p.z) === 'fairway') return p;
 }
 return null;
}

// THE CALLS: draw or fade and high or low alternate from a seeded start;
// carries are seeded between 60 yards and the golfer's reach (80% of their
// driver), in fives, and never the same twice running.
export function callsFor(def, seed, {driver = 250} = {}) {
 const rnd = seeded(seed + ':calls'), n = def.balls;
 if (def.calls === 'shape' || def.calls === 'height') {
  const pair = def.calls === 'shape' ? ['draw', 'fade'] : ['high', 'low'], first = rnd() < .5 ? 0 : 1;
  return Array.from({length: n}, (_, k) => pair[(first + k) % 2]);
 }
 if (def.calls === 'carry') {
  const top = Math.max(80, Math.min(200, Math.round(driver * .8 / 5) * 5)), out = [];
  for (let k = 0; k < n; k++) { let c; do c = 60 + 5 * Math.floor(rnd() * ((top - 60) / 5 + 1)); while (out.length && c === out.at(-1)); out.push(c); }
  return out;
 }
 return [];
}

// WHICH HOLE. `holes` are [{par, length}] in course order; `spotsOn(i)` asks
// for the challenge's spots on hole i (null when it cannot host it). The rule
// orders the candidates; the first whose spots fit is played. 'bigGreen' takes
// the green with room for the most putting. Null when no hole will do.
export function chooseHole(def, holes, spotsOn) {
 const idx = holes.map((h, i) => ({...h, i})), byLength = list => [...list].sort((a, b) => (b.length || 0) - (a.length || 0));
 const par = p => idx.filter(h => h.par === p);
 let order;
 if (def.hole === 'par3') order = par(3);
 else if (def.hole === 'shortPar3') order = [...par(3)].sort((a, b) => (a.length || 0) - (b.length || 0));
 else if (def.hole === 'longest') order = [...byLength(par(5)), ...byLength(par(4))];
 else if (def.hole === 'longPar4') order = [...byLength(par(4)), ...byLength(par(5))];
 else if (def.hole === 'par4') order = [...par(4), ...par(5)];
 else if (def.hole === 'spots') order = idx;
 else if (def.hole === 'bigGreen') {
  let best = null, room = -1;
  for (const h of idx) { const s = spotsOn(h.i); if (!s) continue; const r = s.reduce((a, p) => a + (p.feet || 0), 0); if (r > room) { room = r;best = {hole: h.i, spots: s}; } }
  return best;
 } else throw Error(`No hole rule called ${def.hole}.`);
 for (const h of order) { const s = spotsOn(h.i); if (s) return {hole: h.i, spots: s}; }
 return null;
}
