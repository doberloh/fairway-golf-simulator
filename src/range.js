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
import {localSurface, TEE_PAD, BIOMES} from './course.js';
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

// The aiming targets.
//
// These are NOT putting surfaces, and that is a deliberate limit rather than an
// oversight. Both the ground shader and `localSurface` know exactly one green
// per hole -- the green's position, size and shape come from a single row of the
// cup atlas -- so a second real green needs a GLSL loop over an extended atlas
// and a matching loop on the CPU. Until that exists, a ball landing on the 150
// target bounces as range turf, which is honest: they are mown circles with a
// flag in them, and the movable real green is what covers green behaviour.
//
// Six of them, alternating sides, so the field reads as a range rather than a
// corridor with a green at the end.
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
export const TARGET_COLORS = ['#ffd400', '#ff7a14', '#e8342e', '#e01a86', '#9b30d9', '#4b3fd6'];

// Every target is the same size. Growing them with distance is tempting -- it
// keeps their apparent size even from the mats -- but a target whose size
// encodes nothing is one less thing to misjudge a yardage against.
export const TARGET_RADIUS = 9;

// How far off the centre line they sit. This is not a taste number. The real
// green is movable along the centre line all the way to 300 yd and its own
// half-width is greenSize * greenAspect plus its waves, so the targets have to
// clear that at every green position or the slider will eventually drive the
// green straight through one.
const GREEN_REACH = GREEN_SIZE * GREEN_ASPECT * (1 + GREEN_WAVE3 + GREEN_WAVE5);
const TARGET_GAP = 3;
export const TARGET_OFFSET = GREEN_REACH + TARGET_RADIUS + TARGET_GAP;

// Where each target stands, with the colour and the number its sign carries.
// Alternating sides, first one left.
export function rangeTargets() {
 return TARGET_YARDS.map((yards, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  return {
   yards,
   side,
   x: side * TARGET_OFFSET,
   z: yards * YARD,
   radius: TARGET_RADIUS,
   color: TARGET_COLORS[i % TARGET_COLORS.length],
  };
 });
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
 const greenZ = rangeGreenYards(s) * YARD;
 const green = {x: 0, z: greenZ};
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
 };
 h.toWorld = p => ({...p});
 h.toLocal = p => ({...p});
 h.rotation = 0;
 // The cup sits in the middle of the green rather than being cut from contours:
 // the green is flat, so every location on it is the same location.
 h.pin = {x: green.x, z: green.z};
 h.surface = (x, z) => localSurface(h, x, z);
 h.height = () => 0;
 return h;
}

// Where the green can be put, as the slider sees it. Moving it rewrites four
// floats in the cup atlas and nothing else -- the shader reads the green's
// position from there, not from the hole's length, so the field stays mown to
// 500 yd wherever the green is standing.
export function moveRangeGreen(h, yards) {
 const z = Math.min(GREEN_RANGE[1], Math.max(GREEN_RANGE[0], yards)) * YARD;
 h.green = {x: 0, z};
 h.pin = {x: 0, z};
 // `worldPin` and `worldGreen` are CACHED by routeHoles at generation time, not
 // derived on read. Half the scene reads them rather than h.green -- the
 // flagstick, the green-reading mesh, the overview camera -- so a green moved
 // without refreshing these leaves the flag standing where the green used to be.
 if (h.toWorld) {
  h.worldPin = h.toWorld(h.pin);
  h.worldGreen = h.toWorld(h.green);
 }
 // Every mat is on the same line, so every mat reads the same new number.
 for (const tee of Object.values(h.tees || {})) tee.yards = z / YARD;
 h.settings = {...h.settings, rangeGreen: z / YARD};
 return z / YARD;
}
