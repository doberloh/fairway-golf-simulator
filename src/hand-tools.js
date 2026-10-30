// THE ARCHITECT'S HAND TOOLS (the owner's review, 30 October 2026: "Let it
// hand make bunkers, as well as greens, slopes, fairways ... Make sure we
// don't break classic mode"; and "I want the generator to be able to use them
// as well. So that we have really unique courses.").
//
// Four shapes, each a small record in a hole's own frame -- `at` metres from
// the back tee along the hole's line, `off` metres right of the centre line
// (negative: left) -- so a feature stays where it was put however the hole is
// routed:
//
//   bunker   a bunker: `size` its long radius (m), `shape` how round
//            (0.35 a long trap, 1 a circle), `lobes` 0-3 smaller bunkers
//            joined to it
//   green    the green itself: `size` a scale on the designed green (0.7-1.4),
//            `shape` its aspect, `contour` one of CONTOURS
//   slope    the ground: a mound (`rise` > 0) or hollow (< 0), `size` its
//            radius (m) -- a ridge, a saddle, a punchbowl's rim
//   fairway  the fairway's width over a stretch: `width` metres more (or,
//            negative, less) across the whole fairway, `length` m along it
//
// The SAME records come from two places: the person, in the course studio's
// Hand tools (saved as the `archHand` setting, so a saved course, a course
// code and a course file carry them), and the generator, which picks a
// hand-made signature for some holes from the seed (`designerHand` below).
// applyHand lays them on an Architect hole in architectCourse (course.js) --
// a Classic hole never reaches it, so Classic cannot change.
//
// Pure: no DOM, no three.js (tests/hand-tools.test.mjs). Every limit below
// is PLACED.

export const HAND_KINDS = ['bunker', 'green', 'slope', 'fairway'];
export const CONTOURS = ['designed', 'tilted', 'tiered', 'ridged', 'crowned', 'bowl', 'punchbowl', 'raised'];
export const MAX_HAND = 80;

// Each field: [min, max, default]. Out-of-range values are clamped, unknown
// fields dropped, a record of an unknown kind dropped.
export const HAND_FIELDS = {
 bunker: {hole: [0, 17, 0], at: [20, 600, 200], off: [-60, 60, 15], size: [2.5, 30, 7], shape: [.35, 1, .7], lobes: [0, 3, 0]},
 green: {hole: [0, 17, 0], size: [.7, 1.4, 1], shape: [.6, 1.6, 1]},
 slope: {hole: [0, 17, 0], at: [0, 650, 200], off: [-80, 80, 0], size: [5, 45, 14], rise: [-4, 4, 1.5]},
 fairway: {hole: [0, 17, 0], at: [30, 600, 200], width: [-24, 30, 10], length: [20, 160, 60]},
};
const INTS = new Set(['hole', 'lobes']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function cleanFeature(f) {
 if (!f || typeof f !== 'object' || !HAND_FIELDS[f.kind]) return null;
 const out = {kind: f.kind};
 for (const [k, [lo, hi, def]] of Object.entries(HAND_FIELDS[f.kind])) {
  const v = Number.isFinite(+f[k]) && f[k] !== null && f[k] !== '' ? +f[k] : def;
  out[k] = INTS.has(k) ? Math.round(clamp(v, lo, hi)) : Math.round(clamp(v, lo, hi) * 100) / 100;
 }
 if (f.kind === 'green') out.contour = CONTOURS.includes(f.contour) ? f.contour : 'designed';
 return out;
}

// A list as stored: at most MAX_HAND clean records.
export function cleanHand(list) {
 return (Array.isArray(list) ? list : []).map(cleanFeature).filter(Boolean).slice(0, MAX_HAND);
}

// Whether a stored value is a hand list at all (validateSettings).
export const isHandList = v => Array.isArray(v) && v.length <= MAX_HAND && v.every(f => cleanFeature(f) !== null);

const smooth = u => { const t = clamp(u, 0, 1); return t * t * (3 - 2 * t); };

// The green contours, as the overrides course-plan.js's greenRecipe reads
// from `design.green` (the Architect seam that already carries a Redan's or a
// Biarritz's green).
const CONTOUR_PLAN = {
 tilted: {character: 'rolling', tiltAway: true},
 tiered: {character: 'tiered'},
 ridged: {character: 'ridged'},
 crowned: {character: 'crowned'},
 bowl: {character: 'bowl'},
 punchbowl: {pedestal: 'sunken', character: 'bowl'},
 raised: {pedestal: 'raised'},
};

// Lays `list`'s records for hole `h` on it. `h` is an Architect hole in its
// own frame (course.js architectCourse), before routing. Mutates the hole:
// bunkers added, the green resized and contoured, the fairway's widths
// wrapped; mounds and hollows are returned as h.handMounds (local) for the
// world's earth field. `who` names the hand in the yardage book's reasons.
export function applyHand(h, list, {insideOval, who = 'hand'} = {}) {
 const mine = cleanHand(list).filter(f => f.hole === h.hole);
 if (!mine.length) return h;
 const reasons = h.design?.reasons;
 const say = (kind, i, why) => reasons?.push({kind, i, why});
 const byHand = who === 'hand';
 for (const f of mine.filter(f => f.kind === 'green')) {
  h.greenSize = clamp(h.greenSize * f.size, 9, 32);
  h.greenAspect = clamp(f.shape, .6, 1.6);
  if (f.contour !== 'designed' && h.design) h.design.green = {...(h.design.green || {}), ...CONTOUR_PLAN[f.contour]};
  if (h.design) h.design.hand = true;
 }
 for (const f of mine.filter(f => f.kind === 'fairway')) {
  const z0 = clamp(f.at, 0, h.length), half = f.length / 2, dw = f.width / 2;
  const bump = z => { const u = Math.abs(z - z0) / half; return u >= 1 ? 0 : 1 - smooth(u); };
  const L = h.leftWidth, R = h.rightWidth;
  h.leftWidth = z => Math.max(5, L(z) + dw * bump(z));
  h.rightWidth = z => Math.max(5, R(z) + dw * bump(z));
  h.width = z => Math.max(h.leftWidth(z), h.rightWidth(z));
 }
 const tees = Object.values(h.tees || {});
 const clearOfPlay = (x, z, r) => Math.hypot(x - h.green.x, z - h.green.z) > h.greenSize * Math.max(1, h.greenAspect) + r + 3
  && !tees.some(t => Math.hypot(t.x - x, t.z - z) < r + 10);
 let seed = 0;
 for (const f of mine.filter(f => f.kind === 'bunker')) {
  const z = clamp(f.at, 20, h.length + 20), x = h.center(clamp(z, 0, h.length)) + f.off;
  const rz = f.size, rx = f.size * f.shape;
  if (!clearOfPlay(x, z, Math.max(rx, rz))) continue;
  const wave = k => ((Math.sin((++seed) * 12.9898 + f.at * .1 + f.off) * 43758.5453) % 1 + 1) % 1 * k;
  const main = {x, z, rx, rz, phase: wave(6.28), wave2: wave(.1) - .05, wave3: .03 + wave(.07), hand: true};
  h.bunkers.push(main);
  say('bunker', h.bunkers.length - 1, byHand ? 'Shaped by hand in the course studio.' : 'The architect\'s own shape, made for this hole.');
  for (let k = 0; k < f.lobes; k++) {
   const a = (k + 1) * 2.1 + f.off * .05, d = rz * .85;
   const l = {x: x + Math.cos(a) * d * f.shape, z: z + Math.sin(a) * d, rx: rx * .55, rz: rz * .55, phase: wave(6.28), wave2: 0, wave3: .05, lobe: true, hand: true};
   // Every hazard has its reason (the bench's invariant: the lobes had none,
   // nine of them on PNW).
   if (clearOfPlay(l.x, l.z, Math.max(l.rx, l.rz))) { h.bunkers.push(l); say('bunker', h.bunkers.length - 1, 'A lobe of the bunker beside it, shaped with it.'); }
  }
 }
 h.handMounds = h.handMounds || [];
 for (const f of mine.filter(f => f.kind === 'slope')) {
  const z = f.at, x = h.center(clamp(z, 0, h.length)) + f.off;
  h.handMounds.push({x, z, r: f.size, h: f.rise, hand: true});
 }
 return h;
}

// THE GENERATOR'S OWN HAND: for some holes, from the seed, a signature built
// from the same records -- so two courses of one style differ in more than
// where the usual hazards fall. By style, PLACED:
//
//   waste      a long sandy waste area down one side, three or four bunkers
//              run together (Sandhills, Desert, Heathland, Golden Age)
//   hogsback   a spine of mounds down the drive zone, the fairway pinched
//              round it (Links, Minimalist, Golden Age, Raynor)
//   saddle     the fairway narrowed between two framing mounds (Parkland,
//              Modern, Stadium, Tropical)
//   spectacles two bunkers side by side across the fairway short of the
//              green (Raynor, Golden Age, Heathland)
//   punchbowl  the green sunk in a bowl with a rim of mounds (Golden Age,
//              Raynor, Links)
//   tiered     a two-level green, bigger, the fairway widened before it
//              (Modern, Stadium, Parkland, Mountain)
export const SIGNATURES = {
 waste: ['sandhills', 'desert', 'heathland', 'golden'],
 hogsback: ['links', 'minimalist', 'golden', 'raynor'],
 saddle: ['parkland', 'modern', 'stadium', 'tropical'],
 spectacles: ['raynor', 'golden', 'heathland'],
 punchbowl: ['golden', 'raynor', 'links'],
 tiered: ['modern', 'stadium', 'parkland', 'mountain'],
};

// `rnd` a seeded stream for the hole; `style` the course's style key; `line`
// {par, length, side, edge} with side +1 or -1 for the bail-out side and
// `edge(z)` the fairway's half-width there (a waste area hugs it: iteration
// 5 put one 30-36 m off the line, under the trees beyond a narrow fairway). Returns hand
// records (possibly none) for this hole. A third of holes get one.
export function designerHand(rnd, style, hole, {par, length, side = 1, odds = .34, edge = () => 18}) {
 if (rnd() >= odds) return [];
 const menu = Object.entries(SIGNATURES).filter(([, styles]) => styles.includes(style)).map(([k]) => k);
 if (!menu.length || par === 3 && length < 140) return [];
 const pick = menu[Math.floor(rnd() * menu.length)];
 const drive = clamp(length * (par === 3 ? .45 : par === 4 ? .6 : .48), 90, length - 60);
 const out = [];
 const add = f => out.push(cleanFeature({...f, hole}));
 if (pick === 'waste' && par !== 3) {
  const n = 3 + (rnd() < .5 ? 1 : 0), start = drive - 45;
  for (let k = 0; k < n; k++) { const at = start + k * 24, size = 11 + rnd() * 5, shape = .45 + rnd() * .2; add({kind: 'bunker', at, off: -side * (edge(at) + size * shape * .55 + rnd() * 3), size, shape, lobes: rnd() < .5 ? 1 : 0}); }
 } else if (pick === 'hogsback' && par !== 3) {
  for (let k = -1; k <= 1; k++) add({kind: 'slope', at: drive + k * 22, off: 0, size: 13, rise: 1.3 - Math.abs(k) * .3});
  add({kind: 'fairway', at: drive, width: 10, length: 90});
 } else if (pick === 'saddle' && par !== 3) {
  for (const s of [-1, 1]) add({kind: 'slope', at: drive + 10, off: s * (edge(drive + 10) + 14), size: 16, rise: 2.4});
  add({kind: 'fairway', at: drive + 10, width: -8, length: 50});
 } else if (pick === 'spectacles' && length > 200) {
  for (const s of [-1, 1]) add({kind: 'bunker', at: length - 75, off: s * 9, size: 6, shape: .9, lobes: 0});
 } else if (pick === 'punchbowl') {
  add({kind: 'green', size: 1.05, shape: 1, contour: 'punchbowl'});
  for (let k = 0; k < 4; k++) { const a = Math.PI * (.15 + k * .23); add({kind: 'slope', at: length + Math.sin(a) * 34 - 10, off: Math.cos(a) * 34 * (k % 2 ? 1 : -1), size: 12, rise: 1.8}); }
 } else if (pick === 'tiered') {
  add({kind: 'green', size: 1.2, shape: 1.25, contour: 'tiered'});
  add({kind: 'fairway', at: length - 70, width: 8, length: 60});
 }
 return out.filter(Boolean);
}
