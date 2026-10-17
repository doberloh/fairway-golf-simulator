// The driving range.
//
// A range is not a golf hole with the bends taken out. A hole is generated --
// its corridor wanders, its width is drawn from a random field, its fairway
// starts where the tee shot is expected to land and necks down into an approach
// at the green. Every one of those is right for a hole and wrong for a practice
// ground, where the whole point is that the surface is the SAME everywhere so
// the only thing changing between two shots is the shot.
//
// So this is a hand-built rectangle: 500 yards deep, 100 yards wide, dead flat,
// mown from behind the mats to the back fence. Nothing is drawn from a seed. Two
// visits to the range are the same range, which is what makes it usable as an
// instrument -- the lab fires its approach presets down this.
//
// WHY IT IS STILL A HOLE OBJECT. The painted ground is GLSL in ground.js, and it
// does not ask a hole what surface it is: it reads per-hole data textures built
// from `center(z)`, `fairwayWidth(h,z,...)`, the tee positions and the green.
// That shader is entirely generic over those, so a hole that fills them honestly
// paints correctly with no shader work at all -- and, more to the point, the
// painted ground and the classified lie cannot disagree, because both sides read
// the same functions. Writing a bespoke `surface()` that the shader knew nothing
// about would put the two out of step, and the ground would then lie about the
// lie. That is the whole reason this file builds a hole instead of a new thing.
import {localSurface, greenDistance, greenRadius, TEE_PAD, BIOMES} from './course.js';
import {greenContour, rng} from './course-plan.js';
import {DEFAULT_COURSE} from './settings-schema.js';

const YARD = 0.9144;

// The field. A real range runs 250-350 yd for most golfers; 500 is past what
// anyone carries on purpose, which is the point -- nothing should ever land on
// the back fence, so a shot is never measured against the end of the property.
export const RANGE_DEPTH = 500 * YARD;
export const RANGE_WIDTH = 100 * YARD;
const HALF_WIDTH = RANGE_WIDTH / 2;

// Mowing starts BEHIND the mats, not at them. `fairwayWidth` rounds the corner
// over its first 12 m so a corridor does not begin as a square-ended strip, and
// with the mats at z = 0 that roundover would have left the hitting line itself
// on unmown ground. Starting 20 m back puts the mats on full-width turf.
const MOW_START = -20;

// Three mats across the hitting line. Spaced wider than TEE_PAD so they read as
// separate stations rather than one long strip.
//
// Read inside the function, never at module top level. course.js imports this
// file and this file imports course.js, so the two are a cycle: function
// declarations hoist and are safe to call later, but a `const` like TEE_PAD is
// still uninitialised while this module's top level runs. Touching it out here
// throws "Cannot access 'TEE_PAD' before initialization" the moment anything
// imports course.js first -- which is everything.
const matSpacing = () => TEE_PAD.x * 2.5;
// Same rule, same reason: BIOMES is a const in the other half of the cycle, so
// it is read inside the builder and never at this module's top level.
const biomeOf = key => BIOMES[key] || BIOMES.pnw;

// Where the real green sits, in yards from the mats, and how far the tools
// slider may move it. The near end is a pitch and the far end is a long iron;
// past that it stops being an approach and becomes a drive at a green.
// The far end is set by the longest approach the lab fires, not by taste: a
// driver preset carries 240 yd and lands 60 short, so the green has to reach
// 300. The extra 50 is headroom for a bag that has been turned UP -- club
// yardages are editable, and a preset clamped short would quietly stop landing
// where it says it lands.
// How many past tracers stay on the field.
//
// A session leaves one line per shot. Left alone that is an unreadable mat of
// them after twenty minutes, and a Line2 held for every shot ever hit. So the
// count is a preference with a hard ceiling, and the CEILING is what the trail
// store keeps -- there is no point holding a trail the setting can never show.
export const SHOT_LINE_MAX = 50;
export const SHOT_LINE_DEFAULT = 10;
const LINES_KEY = 'fairway-range-lines-v1';
// Device-local, like the graphics tier: how much you want on screen belongs to
// the screen you are looking at, not to a course or a saved round. It is also
// why this does NOT go in `settings` -- leaving the range rebuilds that object
// from `courseFallback`, which would drop it every time.
export const cleanShotLines = n =>
 Number.isFinite(Number(n)) && n !== null && n !== ''
  ? Math.min(SHOT_LINE_MAX, Math.max(0, Math.round(Number(n))))
  : SHOT_LINE_DEFAULT;
export function loadShotLines() {
 try { return cleanShotLines(JSON.parse(localStorage.getItem(LINES_KEY))); }
 catch { return SHOT_LINE_DEFAULT; }
}
export function saveShotLines(n) {
 const v = cleanShotLines(n);
 try { localStorage.setItem(LINES_KEY, JSON.stringify(v)); } catch {}
 return v;
}

export const GREEN_RANGE = [30, 350];
export const DEFAULT_GREEN_YARDS = 150;

// The green itself. Fixed rather than drawn, for the same reason as everything
// else here: a target that changes shape between sessions is not a target. The
// waves are small and non-zero -- a perfect ellipse reads as a decal, and the
// shader wants the same three coefficients every hole carries.
const GREEN_SIZE = 17, GREEN_ASPECT = 1.17;
const GREEN_WAVE2 = 0, GREEN_WAVE3 = .05, GREEN_WAVE5 = .03;

// Settings the range imposes, whatever the player last used on a course. The
// landscape ones matter: elevation drives the world's landform, and anything
// above zero would tilt the field.
export const RANGE_SETTINGS = {
 ...DEFAULT_COURSE,
 seed: 'RANGE',
 holes: 1,
 range: true,
 elevation: 0,
 greenDifficulty: 0,
 raisedGreens: 0,
 sunkenGreens: 0,
 falseFronts: 0,
 landform: 0,
 trees: 0,
 water: 0,
 rivers: 0,
 creeks: 0,
 lakes: 0,
 homes: false,
 wind: 0,
 bunkerCount: 0,
 fairwayBunkers: 0,
};

// THE GREENS. Every putting surface on the range, as one list.
//
// The range used to know one green -- the movable one on the centre line -- and
// six coloured discs that were scenery: a ball landing on the 150 target
// bounced as range turf, because the ground shader and `localSurface` both read
// exactly one green per hole. Since 16 October 2026 they read a LIST: the cup
// atlas carries the extra greens (HOLE_ATLAS.greens in ground.js) and the shader
// loops over them, and `greenDistance` takes the nearest green of a hole that
// has `greens`. So every target is a real green now, mown, with a fringe and a
// cup, and it plays exactly as a green on a course does.
//
// Three kinds, in this order (the first is always the centre):
//   centre -- the movable green on the centre line, which a slider slides;
//   target -- the six distance greens, fixed, each on its own number;
//   short  -- the short-game green beside the mats, for chipping and putting.
//
// Each green is a small hole-shaped record ({green, pin, greenSize,
// greenAspect, greenWave2/3/5, phase}) so `greenDistance` and `greenRadius`
// work on it unchanged; that is the whole trick of the list.
export const TARGET_YARDS = [50, 100, 150, 200, 250, 300];

// Colour by distance, warm to cool, so a glance at a flag tells you the number
// before you read the sign. Two constraints shaped this ramp, both learned by
// putting it on screen:
//
//   NOT BLUE OR CYAN. A flat green already renders as a blue disc under the
//   slope-reading overlay, so a blue-green target reads as the same fault, or as
//   water.
//   NOT EARTHY. The first ramp opened on a soft yellow and amber, and at midday
//   on green turf those two read as SAND -- the near targets looked like enormous
//   waste bunkers rather than markings. These are saturated past anything
//   agronomic on purpose: a target is paint, and it should look like paint.
// Since the targets became greens the colour is on the flag, the sign and a
// painted ring just outside the fringe; the putting surface itself is green.
export const TARGET_COLORS = ['#ffd400', '#ff7a14', '#e8342e', '#e01a86', '#9b30d9', '#4b3fd6'];

// THE NUMBER IS THE DISTANCE FROM THE MAT, ALONG THE AIM ARC (the owner, 16
// October 2026). The targets used to stand at z = their number, a fixed 33 m
// to the side -- so the "50" was really 62 yards from the mat and the 100 was
// 106. Now each green's centre is exactly its number from the centre mat, where
// every golfer on the range stands (enterRange puts everyone on white): the
// target is turned off the centre line rather than pushed sideways. Off the line
// by at most TARGET_LATERAL, and by less close in, where 30 m would swing the 50
// almost 45 degrees off the line of play. PLACED by eye on screen.
export const TARGET_LATERAL = 30;
const TARGET_SWING = .45;
// A green's size grows with its number: a 50-yard target is a pitch to a small
// green, a 300-yard one a drive at a big one. Real ranges size them the same
// way, for the same reason -- the target should be about as hard to hit at any
// distance. PLACED: 7 m at 50 yd up to 12 m at 300.
export const targetSize = yards => 6 + yards / 50;
const TARGET_WAVE3 = .04, TARGET_WAVE5 = .03;
// How far a target's green reaches from its centre at most, in metres.
export const targetReach = yards => targetSize(yards) * (1 + TARGET_WAVE3 + TARGET_WAVE5);

// Where each target stands, with the colour and the number its sign carries.
// Alternating sides, the first on the golfer's right (local -x).
export function rangeTargets() {
 return TARGET_YARDS.map((yards, i) => {
  const side = i % 2 === 0 ? -1 : 1, d = yards * YARD;
  const lateral = Math.min(TARGET_LATERAL, d * TARGET_SWING);
  return {
   yards, side,
   x: side * lateral,
   z: Math.sqrt(d * d - lateral * lateral),
   radius: targetReach(yards),
   color: TARGET_COLORS[i % TARGET_COLORS.length],
  };
 });
}

// THE SHORT-GAME GREEN. Beside the mats on the golfer's right, off the side of
// the field, so a ball hit down the range never lands on it and a chip played to
// it never runs into the field. Far enough out that its fringe and collar clear
// the mown field by a stride; close enough to aim at from the mats (about 90
// yards, turned hard right). PLACED.
export const SHORT_GREEN = {x: -80, z: 18, size: 14, aspect: 1.15, wave2: .06, wave3: .04, wave5: .03, phase: 1.3};

// HOW A GREEN IS SET UP. The centre green and the short-game green each carry
// one; the targets are always flat.
//   flat    -- dead level;
//   ltr     -- one plane falling from the golfer's left to right, as seen from
//              the mats (local +x is the left), so a putt breaks left to right;
//   rtl     -- the mirror;
//   random  -- contours grown the way a course's greens are (`greenContour`),
//              from a seed, with a contour slider; "New green" draws another.
// `tilt` is the plane's fall in per cent; `contour` the course's green slope
// setting (0-100) a random green is grown at; `seed` which random green; `cup`
// which hole location (0 is the most central level spot).
export const SLOPES = ['flat', 'ltr', 'rtl', 'random'];
export const SLOPE_NAMES = {flat: 'Flat', ltr: 'Left to right', rtl: 'Right to left', random: 'Random contours'};
export const TILT = {min: .5, max: 4, step: .5, def: 1.5};
export const CONTOUR = {min: 10, max: 90, step: 5, def: 45};
export const DEFAULT_SETUP = {
 centre: {slope: 'flat', tilt: TILT.def, contour: CONTOUR.def, seed: 1, cup: 0},
 short: {slope: 'random', tilt: TILT.def, contour: CONTOUR.def, seed: 1, cup: 0},
};
const clampTo = (v, {min, max}, def) => Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : def;
const wholeOr = (v, def) => Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : def;
// Anything the browser hands back, made into a set-up the builder can use.
export function cleanSetup(v, fallback = DEFAULT_SETUP.centre) {
 const o = v && typeof v === 'object' ? v : {};
 return {
  slope: SLOPES.includes(o.slope) ? o.slope : fallback.slope,
  tilt: clampTo(o.tilt, TILT, fallback.tilt),
  contour: clampTo(o.contour, CONTOUR, fallback.contour),
  seed: wholeOr(o.seed, fallback.seed),
  cup: wholeOr(o.cup, fallback.cup),
 };
}
// THE CENTRE GREEN'S SET-UP, including the bench's old way of asking for one.
// `lab.green({difficulty})` and the tests set `greenDifficulty` on the range's
// settings; that still means "contours at this difficulty, grown from the
// range's own seed", and it grows exactly the green it always did (same seed,
// same size, same phase), so the lab's measurements did not move.
export function centreSetup(s = {}) {
 if (s.rangeCentre) return cleanSetup(s.rangeCentre, DEFAULT_SETUP.centre);
 if ((s.greenDifficulty ?? 0) > 0) return {...DEFAULT_SETUP.centre, slope: 'random', contour: s.greenDifficulty, legacy: true};
 return {...DEFAULT_SETUP.centre};
}
export const shortSetup = (s = {}) => cleanSetup(s.rangeShort, DEFAULT_SETUP.short);
// A set-up that puts anything into the ground. A flat green regrows nothing.
export const shapes = setup => !!setup && setup.slope !== 'flat';

// Device-local, like the shot lines: the greens the player last practised on.
const GREENS_KEY = 'fairway-range-greens-v1';
export function loadRangeSetup() {
 let raw = null;
 try { raw = JSON.parse(localStorage.getItem(GREENS_KEY)); } catch {}
 return {centre: cleanSetup(raw?.centre, DEFAULT_SETUP.centre), short: cleanSetup(raw?.short, DEFAULT_SETUP.short)};
}
export function saveRangeSetup(v) {
 const clean = {centre: cleanSetup(v?.centre, DEFAULT_SETUP.centre), short: cleanSetup(v?.short, DEFAULT_SETUP.short)};
 try { localStorage.setItem(GREENS_KEY, JSON.stringify(clean)); } catch {}
 return clean;
}

// The slope a green's set-up puts at a point, in metres above the green's own
// centre, in the HOLE's local frame. Zero for a flat green. Inside the green
// this IS the putting surface; course.js fades it out beyond the collar.
export function rangeContour(g, x, z) {
 const s = g.setup;
 if (!shapes(s)) return 0;
 const dx = x - g.green.x, dz = z - g.green.z;
 if (s.slope === 'ltr') return s.tilt / 100 * dx;
 if (s.slope === 'rtl') return -s.tilt / 100 * dx;
 return greenContour(contourHole(g), dx, dz);
}
// The hole-shaped record a random green is grown from. Kept on the green, so
// `greenRecipe` (a WeakMap on this object) draws it once.
function contourHole(g) {
 const s = g.setup, key = `${s.contour}:${s.seed}:${s.legacy ? 'L' : ''}`;
 if (g._contour?.key === key) return g._contour.hole;
 const hole = {
  // The legacy bench seed is the range's own, hole 0 -- what greenContour(h)
  // was handed before the greens were a list.
  seed: s.legacy ? g.rangeSeed : `RANGE-${g.id}-${s.seed}`, hole: 0,
  greenSize: g.greenSize, phase: g.phase, green: {x: 0, z: 0},
  settings: {greenDifficulty: s.contour, falseFronts: 0, raisedGreens: 0, sunkenGreens: 0},
 };
 Object.defineProperty(g, '_contour', {value: {key, hole}, writable: true, configurable: true, enumerable: false});
 return hole;
}
// Slope under a point of a green, in per cent.
export function slopeOf(g, x, z) {
 const e = .4;
 return 100 * Math.hypot((rangeContour(g, x + e, z) - rangeContour(g, x - e, z)) / (2 * e),
  (rangeContour(g, x, z + e) - rangeContour(g, x, z - e)) / (2 * e));
}

// WHERE THE CUP IS CUT. On a flat or tilted green every spot is the same spot,
// so cup 0 is the middle and the others walk round it. On a random green the
// candidates are the level-enough places with room round them -- the USGA's
// guidance a course's cups follow (choosePin in course.js), relaxed to the
// flattest fifth when a severe green has nowhere under 2.5%.
export function cupOf(g, n = 0) {
 const reach = g.greenSize, inside = (x, z) => greenDistance(g, x, z) < -3;
 const spots = [];
 // A grid through the green's own centre, so a level green's cup 0 is exactly
 // the middle and slides with it.
 const n2 = Math.ceil(reach * 1.2 / 1.2);
 for (let i = -n2; i <= n2; i++)
  for (let j = -n2; j <= n2; j++) {
   const dx = i * 1.2, dz = j * 1.2, x = g.green.x + dx, z = g.green.z + dz;
   if (!inside(x, z)) continue;
   spots.push({x, z, r: Math.hypot(dx, dz), slope: slopeOf(g, x, z)});
  }
 if (!spots.length) return {...g.green};
 let fit = g.setup?.slope === 'random' ? spots.filter(p => p.slope <= 2.5) : spots;
 if (!fit.length) fit = [...spots].sort((a, b) => a.slope - b.slope).slice(0, Math.max(1, Math.ceil(spots.length / 5)));
 fit.sort((a, b) => a.r - b.r);
 if (!n) return {x: fit[0].x, z: fit[0].z};
 const pick = fit[Math.floor(rng(`RANGE-cup-${g.id}-${n}`)() * fit.length)];
 return {x: pick.x, z: pick.z};
}

function makeGreen(base, s) {
 const g = {
  id: base.id, kind: base.kind, name: base.name, yards: base.yards ?? null, color: base.color ?? null,
  green: {x: base.x, z: base.z}, greenSize: base.size, greenAspect: base.aspect,
  greenWave2: base.wave2, greenWave3: base.wave3, greenWave5: base.wave5, phase: base.phase,
  setup: base.setup ?? {...DEFAULT_SETUP.centre, slope: 'flat'}, hidden: false, rangeSeed: s.seed,
 };
 g.pin = cupOf(g, g.setup.cup);
 // Kept as an offset so the cup slides with the centre green.
 g.cupOffset = {x: g.pin.x - g.green.x, z: g.pin.z - g.green.z};
 return g;
}

// Every green, in the order the atlas carries them: centre first.
export function rangeGreens(s = {}) {
 const greenZ = rangeGreenYards(s) * YARD;
 const list = [makeGreen({id: 'centre', kind: 'centre', name: 'Centre green', x: 0, z: greenZ,
  size: GREEN_SIZE, aspect: GREEN_ASPECT, wave2: GREEN_WAVE2, wave3: GREEN_WAVE3, wave5: GREEN_WAVE5, phase: 0,
  setup: centreSetup(s)}, s)];
 rangeTargets().forEach((t, i) => list.push(makeGreen({id: `t${t.yards}`, kind: 'target', name: `${t.yards} yard target`,
  yards: t.yards, color: t.color, x: t.x, z: t.z, size: targetSize(t.yards), aspect: 1,
  wave2: 0, wave3: TARGET_WAVE3, wave5: TARGET_WAVE5, phase: .9 + i * 1.7}, s)));
 const q = SHORT_GREEN;
 list.push(makeGreen({id: 'short', kind: 'short', name: 'Short-game green', x: q.x, z: q.z, size: q.size,
  aspect: q.aspect, wave2: q.wave2, wave3: q.wave3, wave5: q.wave5, phase: q.phase, setup: shortSetup(s)}, s));
 return list;
}

// A TARGET THE CENTRE GREEN IS SITTING ON GIVES WAY TO IT. The centre green
// slides the whole centre line and the targets stand beside it, so at some
// distances the two would overlap. Rather than push the targets so wide that
// the near ones sit off at 60 degrees, the target steps aside while the centre
// green is on it -- slide the green to 150 and the 150 target is replaced by
// the green you put there. The gap is the two fringes and a stride.
export function hideCovered(greens, fringe = 2) {
 const centre = greens[0];
 for (const g of greens) {
  if (g.kind !== 'target') continue;
  const reach = targetReach(g.yards);
  let near = Infinity;
  for (let k = 0; k < 32; k++) {
   const a = k / 32 * Math.PI * 2;
   near = Math.min(near, greenDistance(centre, g.green.x + Math.cos(a) * reach, g.green.z + Math.sin(a) * reach));
  }
  g.hidden = near < 2 * fringe + 2;
 }
 return greens;
}

// How far a shot finished from the line it was AIMED down, in metres, positive
// to the right of that line.
//
// Measured across the aim line and not from the green, because those are
// different questions: aiming at the 250 target and finishing beside it is a
// straight shot, and calling it thirty yards offline because the green is
// elsewhere would be measuring the wrong thing.
//
// Extracted from the range readout purely so it can be tested. A shot-direction
// sign error has been shipped four separate times in this project -- it is
// invisible until somebody notices a fade reported as a draw -- so the rotation
// is pinned by assertion rather than by reading it and being satisfied.
export function offlineOf(origin, end, aimDegrees) {
 // Positive is the golfer's right, which is local -x (physics.js, simulateShot).
 const a = aimDegrees * Math.PI / 180;
 const dx = end.x - origin.x, dz = end.z - origin.z;
 return dz * Math.sin(a) - dx * Math.cos(a);
}

// How far out the real green sits, clamped to what the slider allows.
export const rangeGreenYards = s =>
 Math.min(GREEN_RANGE[1], Math.max(GREEN_RANGE[0], Number(s?.rangeGreen) || DEFAULT_GREEN_YARDS));

// One hole object, filling the same contract `generateCourse` returns, so
// everything downstream -- renderer, physics, map, floodlights, firmness --
// works untouched.
export function buildRange(settings = {}, hole = 0) {
 const s = {...RANGE_SETTINGS, ...settings, range: true, holes: 1};
 const length = RANGE_DEPTH;
 const greens = hideCovered(rangeGreens(s), s.fringe ?? 2);
 const centre = greens[0], greenZ = centre.green.z;
 const green = {...centre.green};
 // Straight, and the same width the whole way. Both are functions because that
 // is what the rest of the code expects to call.
 const center = () => 0;
 const side = () => HALF_WIDTH;
 const spacing = matSpacing();
 // Every mat is on the same line, so every mat is the same distance from the
 // green. `yards` is what the hole card prints; leaving it at zero had the card
 // reading "0 yd" beside a green plainly 150 yards away.
 const yards = greenZ / YARD;
 const tees = {
  blue: {x: -spacing, z: 0, yards},
  white: {x: 0, z: 0, yards},
  red: {x: spacing, z: 0, yards},
 };
 const h = {
  // The hole's own green fields are the CENTRE green's, always: the ground
  // shader's route texel reads them as the first green of the list. `green` and
  // `pin` below are the green being PLAYED TO, which moves (setActiveGreen).
  greenSize: GREEN_SIZE, greenAspect: GREEN_ASPECT,
  greenWave2: GREEN_WAVE2, greenWave3: GREEN_WAVE3, greenWave5: GREEN_WAVE5,
  fairwayStart: MOW_START, mowStart: MOW_START,
  tees, turnFraction: .5, routeLength: length,
  // A real biome, NOT null. The HUD reads `course.bio.name` and `.temperature`,
  // and the flight model reads `.altitude` -- a null here threw inside loadCourse
  // before it reached setMode('play'), so the range built, drew, and left the
  // main menu sitting on top of it. The range borrows its surroundings from
  // whatever biome is selected; only the ground under it is fixed.
  settings: s, bio: biomeOf(s.biome), par: 4, length,
  tee: {x: 0, z: 0}, green,
  bounds: {x: Math.max(220, HALF_WIDTH + 140), minZ: -90, maxZ: length + 120},
  center, width: side, leftWidth: side, rightWidth: side,
  ponds: [], bunkers: [], trees: [],
  seed: s.seed, hole, phase: 0, doglegAngle: 0,
  // Tells `fairwayWidth` not to neck the corridor into an approach at the green.
  // A hole narrows there because an approach is a different shot; a range does
  // not, and without this the back of the field would pinch to green width.
  noNeck: true,
  // Marks the hole as practice ground for everything that needs to know there is
  // no round being played here.
  range: true,
  greens, active: 'centre',
 };
 h.toWorld = p => ({...p});
 h.toLocal = p => ({...p});
 h.rotation = 0;
 h.pin = {...centre.pin};
 h.surface = (x, z) => localSurface(h, x, z);
 h.height = () => 0;
 return h;
}

export const greenById = (h, id) => h?.greens?.find(g => g.id === id) ?? null;
export const activeGreen = h => greenById(h, h?.active) ?? h?.greens?.[0] ?? null;

// THE GREEN BEING PLAYED TO. One cup at a time is live, because the physics
// capture the ball in `course.pin` and nowhere else: so `h.green`, `h.pin` and
// their cached world copies follow whichever green is being played -- the one
// nearest the aim from the mats, or the green a chip or putt is played on. The
// flag, the yardage, "look at the green" and the putting aids all follow it.
export function setActiveGreen(h, id) {
 const g = greenById(h, id);
 if (!g || g.hidden) return activeGreen(h);
 h.active = g.id;
 h.green = {...g.green};
 h.pin = {...g.pin};
 if (h.toWorld) { h.worldPin = h.toWorld(h.pin); h.worldGreen = h.toWorld(h.green); }
 return g;
}
// The green a point is aimed at: the nearest, by distance to its edge.
export function nearestGreen(h, p) {
 let best = null, d = Infinity;
 for (const g of h?.greens || []) {
  if (g.hidden) continue;
  const e = greenDistance(g, p.x, p.z);
  if (e < d) { d = e; best = g; }
 }
 return best;
}

// Where the green can be put, as the slider sees it. Moving it rewrites the
// cup atlas and nothing else -- the shader reads the green's position from
// there, not from the hole's length, so the field stays mown to 500 yd wherever
// the green is standing.
export function moveRangeGreen(h, yards) {
 const z = Math.min(GREEN_RANGE[1], Math.max(GREEN_RANGE[0], yards)) * YARD;
 const centre = h.greens?.[0];
 if (centre) {
  centre.green = {x: 0, z};
  centre.pin = {x: centre.cupOffset.x, z: z + centre.cupOffset.z};
  hideCovered(h.greens, h.settings?.fringe ?? 2);
 }
 // `worldPin` and `worldGreen` are CACHED by routeHoles at generation time, not
 // derived on read. Half the scene reads them rather than h.green -- the
 // flagstick, the green-reading mesh, the overview camera -- so a green moved
 // without refreshing these leaves the flag standing where the green used to be.
 if (!centre || h.active === 'centre') {
  h.green = {x: 0, z};
  h.pin = centre ? {...centre.pin} : {x: 0, z};
  if (h.toWorld) {
   h.worldPin = h.toWorld(h.pin);
   h.worldGreen = h.toWorld(h.green);
  }
 }
 // A target the green now covers cannot be the one being played to.
 if (greenById(h, h.active)?.hidden) setActiveGreen(h, 'centre');
 // Every mat is on the same line, so every mat reads the same new number.
 for (const tee of Object.values(h.tees || {})) tee.yards = z / YARD;
 h.settings = {...h.settings, rangeGreen: z / YARD};
 return z / YARD;
}
// Cut the cup somewhere else on one green. The ground does not change, so this
// is a few floats and a flag, like sliding a flat green.
export function moveCup(h, id, n) {
 const g = greenById(h, id);
 if (!g) return null;
 g.setup = {...g.setup, cup: n};
 g.pin = cupOf(g, n);
 g.cupOffset = {x: g.pin.x - g.green.x, z: g.pin.z - g.green.z};
 if (h.active === id) setActiveGreen(h, id);
 return g.pin;
}

// THE SHORT GAME: where a chip or a putt is played from.
//
// A chip is `yards` from the cup on ground that is NOT green -- fringe, collar,
// rough or the range's own turf -- so a chip never quietly becomes a long putt.
// A putt is `feet` from the cup ON the green, with half a metre of green behind
// it. `n` picks a different spot at the same distance: 0 is straight in from the
// front (the side the mats are on), and each n after that walks round the cup.
// `ok(x, z)` is the hole's own say (no ball on another green, none off the
// property); the first spot that passes is used.
const GOLDEN = 2.399963229728653;
function aroundCup(g, metres, n, accept) {
 const start = n ? rng(`RANGE-spot-${g.id}-${n}`)() * Math.PI * 2 : Math.PI;
 for (let k = 0; k < 48; k++) {
  const a = start + k * GOLDEN;
  const p = {x: g.pin.x + Math.sin(a) * metres, z: g.pin.z + Math.cos(a) * metres};
  if (accept(p)) return p;
 }
 return null;
}
export function chipSpot(h, id, yards, n = 0) {
 const g = greenById(h, id);
 if (!g) return null;
 const fringe = h.settings?.fringe ?? 2;
 const off = p => greenDistance(h, p.x, p.z) > fringe * .5 && Math.abs(p.x) < h.bounds.x - 10 && p.z > h.bounds.minZ + 10;
 return aroundCup(g, yards * YARD, n, off)
  ?? aroundCup(g, greenRadius(g, 0) * g.greenAspect + fringe + 2, n, off);
}
export function puttSpot(h, id, feet, n = 0) {
 const g = greenById(h, id);
 if (!g) return null;
 const on = p => greenDistance(g, p.x, p.z) < -.5;
 for (let m = feet * .3048; m > .3; m *= .85) {
  const p = aroundCup(g, m, n, on);
  if (p) return p;
 }
 return {...g.pin};
}
export const CHIP_YARDS = {min: 5, max: 60, step: 1, def: 20};
export const PUTT_FEET = {min: 3, max: 80, step: 1, def: 15};

// THE CUP ATLAS COLUMNS for the range (ground.js HOLE_ATLAS). The centre green
// takes the slots every hole has -- its shape in `cups`, its own cup in
// `cups + 1` -- so the route texel's outline (the hole's own waves) describes
// it. The visible others follow in `greens`, three texels each, and the count
// rides in the third channel of the pin texel. `put(column, [r, g, b, a])`.
export function writeRangeGreens(h, put, cols = {cups: 9, greens: 35, max: 8}) {
 const [centre, ...rest] = h.greens, shown = rest.filter(g => !g.hidden).slice(0, cols.max);
 put(cols.cups, [centre.green.x, centre.green.z, centre.greenSize, centre.greenAspect]);
 put(cols.cups + 1, [centre.pin.x, centre.pin.z, shown.length, 0]);
 shown.forEach((g, i) => {
  const c = cols.greens + i * 3;
  put(c, [g.green.x, g.green.z, g.greenSize, g.greenAspect]);
  put(c + 1, [g.greenWave2, g.greenWave3, g.greenWave5, g.phase]);
  put(c + 2, [g.pin.x, g.pin.z, 0, 0]);
 });
 // Columns a hidden green used to fill are left as they were: the count is
 // what the shader reads, so stale texels past it are never sampled.
 return shown.length;
}
