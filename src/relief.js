// PENALTY RELIEF: where a golfer may play from after the ball finds water or
// goes out of bounds, under the Rules of Golf (2023).
//
// A ball in a penalty area (Rule 17.1d) gets three options, one penalty stroke
// each: stroke and distance, back-on-the-line, and -- red penalty areas only --
// lateral relief within two club-lengths. Every water body here is red: the
// Committee marks nothing, and an unmarked penalty area is treated as red (the
// definition of Penalty Area).
//
// A ball out of bounds (Rule 18.2b) is stroke and distance, one penalty stroke.
// A round can instead play Model Local Rule E-5, the alternative for general
// play: two penalty strokes and a drop between the line through where the ball
// went out and the line through the nearest fairway, never nearer the hole.
//
// Pure: everything about the course comes in through `ground`, so the rules
// can be tested against a drawn map. Sources and every placed number are in
// RESEARCH.md, *Penalty relief*.

const INCH = 0.0254;
// A club-length is the player's longest club other than the putter. A typical
// driver is 45.5 inches; the Equipment Rules allow 48 and Model Local Rule G-10
// 46. Placed, not measured from anyone's bag.
export const CLUB_LENGTH = 45.5 * INCH;
// How far inside the relief area a drop is placed, so a ball is never set
// exactly on a penalty-area line or a boundary.
const MARGIN = 0.3;

// The kinds of trouble physics.js reports, and the round options that change
// what is offered.
export const WATER = 'Water', OUT = 'Out of bounds';
export const OB_RULES = {
 stroke: {label: 'Stroke and distance (Rules of Golf)', short: 'Rules of Golf'},
 e5: {label: 'Drop near where it went out, two strokes (Local Rule E-5)', short: 'Local Rule E-5'},
};

// Where a lie stands among the places a golfer would rather drop. The game
// picks the best spot it can for the player inside each relief area -- the
// rules let them drop anywhere in it -- and a better lie wins over a few yards.
const LIE = {green: 0, fairway: 0, fringe: 1, tee: 1, semi: 2, rough: 3, sand: 4};
const lieRank = s => LIE[s] ?? 5;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// WHERE THE BALL LAST CROSSED THE EDGE. The path is walked back from where it
// stopped to the last point outside the trouble, and the edge is found between
// that point and the next by halving -- a flight sampled every few metres would
// otherwise put the edge metres from where it is. `inside(p)` says whether a
// point is in the trouble. A path that never left it returns its first point.
export function crossingPoint(points, inside) {
 if (!points?.length) return null;
 let k = points.length - 1;
 while (k >= 0 && inside(points[k])) k--;
 if (k < 0) return {x: points[0].x, z: points[0].z};
 if (k === points.length - 1) return {x: points[k].x, z: points[k].z};
 let a = points[k], b = points[k + 1];
 for (let i = 0; i < 18; i++) {
  const m = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
  if (inside(m)) b = m; else a = m;
 }
 return {x: a.x, z: a.z};
}

// A spot a ball can be dropped on: dry, in bounds, not inside a trunk or a
// house, and clear of the water by the margin all round.
function playable(ground, p) {
 if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
 if (ground.out(p.x, p.z) || ground.blocked?.(p.x, p.z)) return false;
 for (const [dx, dz] of [[0, 0], [MARGIN, 0], [-MARGIN, 0], [0, MARGIN], [0, -MARGIN]])
  if (ground.surface(p.x + dx, p.z + dz) === 'water') return false;
 return true;
}

// BACK ON THE LINE (Rule 17.1d(2)). Keep the crossing point between the hole
// and the drop, as far back as the player likes. The reference point is the
// first playable ground on that line beyond the edge, plus `back` metres if the
// player asks to go further; a stretch of the line still over water or out of
// bounds is skipped. Null when the line never reaches playable ground.
export function backOnLine(ground, cross, pin, back = 0) {
 const len = dist(cross, pin);
 const ux = len > 1e-6 ? (cross.x - pin.x) / len : 0, uz = len > 1e-6 ? (cross.z - pin.z) / len : 1;
 let first = null;
 for (let t = MARGIN; t < 400; t += 0.25) {
  const p = {x: cross.x + ux * t, z: cross.z + uz * t};
  if (!playable(ground, p)) { if (first !== null && t > first + back) break; continue; }
  if (first === null) first = t;
  if (t >= first + back) return {x: p.x, z: p.z};
 }
 return null;
}

// The best spot in a disc: playable, passing `allowed`, best lie first, then
// nearest the hole.
function bestIn(ground, centre, radius, pin, allowed) {
 let best = null;
 for (let r = 0; r <= radius + 1e-9; r += radius / 8) {
  for (let a = 0; a < 360; a += r ? 10 : 360) {
   const p = {x: centre.x + r * Math.sin(a * Math.PI / 180), z: centre.z + r * Math.cos(a * Math.PI / 180)};
   if (!playable(ground, p) || !allowed(p)) continue;
   const s = ground.surface(p.x, p.z), score = [lieRank(s), dist(p, pin)];
   if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) best = {p, score, surface: s};
  }
 }
 return best && {x: best.p.x, z: best.p.z};
}

// LATERAL (Rule 17.1d(3), red penalty areas). Within two club-lengths of where
// the ball last crossed the edge, not nearer the hole than that point, outside
// the penalty area. Null when all of it is water or out of bounds.
export function lateral(ground, cross, pin) {
 const limit = dist(cross, pin) - 1e-6;
 return bestIn(ground, cross, 2 * CLUB_LENGTH, pin, p => dist(p, pin) >= limit);
}

// MODEL LOCAL RULE E-5. The ball reference point is where the ball crossed the
// boundary; the fairway reference point is the nearest point of fairway OF THE
// HOLE BEING PLAYED -- grass cut to fairway height or lower, so the fringe
// counts -- not nearer the hole than the ball reference point. There is no limit
// on how far that is: a boundary can be a long way from any fairway, and the
// first version, which searched outward from the ball and gave up at 250 m,
// quietly fell back to stroke and distance on exactly those holes. So the hole's
// own area (`ground.area`) is searched instead, on a 2 m grid and then to 25 cm
// round the best point.
//
// The drop is placed at the fairway reference point, which is in the relief
// area by construction, or the best spot within two club-lengths of it if that
// point itself is blocked. It must be in the general area: not a green, a
// bunker, a tee or water. Null when the hole has no qualifying fairway.
export function e5(ground, ballRef, pin) {
 const limit = dist(ballRef, pin) - 1e-6;
 const general = p => !['green', 'sand', 'tee', 'water'].includes(ground.surface(p.x, p.z));
 // THIS hole's fairway: in a shared landscape the next hole's fairway can be
 // nearer, and the first draft dropped a ball behind the tee on someone else's.
 // `ownFairway` asks the hole itself; without it every fairway counts.
 const fairway = p => ['fairway', 'fringe'].includes(ground.surface(p.x, p.z)) && (!ground.ownFairway || ground.ownFairway(p.x, p.z)) && dist(p, pin) >= limit && !ground.out(p.x, p.z);
 const a = ground.area || {minX: ballRef.x - 300, maxX: ballRef.x + 300, minZ: ballRef.z - 300, maxZ: ballRef.z + 300};
 let ref = null, best = Infinity;
 const look = (x, z) => { const p = {x, z}, dd = dist(p, ballRef); if (dd < best && fairway(p)) { best = dd; ref = p; } };
 for (let x = a.minX; x <= a.maxX; x += 2) for (let z = a.minZ; z <= a.maxZ; z += 2) look(x, z);
 // A 2 m grid can step over a thin strip -- a fringe a metre wide behind a
 // green, the only qualifying ground when a ball goes out just past it. When the
 // coarse pass finds nothing, the 30 m round the ball is searched at 50 cm.
 if (!ref) for (let x = ballRef.x - 30; x <= ballRef.x + 30; x += 0.5) for (let z = ballRef.z - 30; z <= ballRef.z + 30; z += 0.5) look(x, z);
 if (!ref) return null;
 const c = ref;
 for (let x = c.x - 2; x <= c.x + 2; x += 0.25) for (let z = c.z - 2; z <= c.z + 2; z += 0.25) look(x, z);
 const at = playable(ground, ref) && general(ref) ? ref : bestIn(ground, ref, 2 * CLUB_LENGTH, pin, p => general(p) && dist(p, pin) >= limit);
 return at && {x: at.x, z: at.z};
}

// EVERYTHING A GOLFER MAY CHOOSE, in the order a card lists them. `trouble` is
// what the round recorded: {hazard, from, cross}. `outRule` is the round's
// out-of-bounds rule. Each option carries the spot and the penalty strokes; an
// option the ground makes impossible is left out rather than offered and refused.
export function reliefOptions(ground, trouble, pin, {outRule = 'stroke', back = 0} = {}) {
 const {hazard, from, cross} = trouble;
 const options = [{id: 'stroke', label: 'Stroke and distance', detail: 'Play again from where you hit', penalty: 1, spot: {x: from.x, z: from.z}}];
 const where = cross || from;
 if (hazard === WATER) {
  const line = backOnLine(ground, where, pin, back);
  if (line) options.push({id: 'line', label: 'Back on the line', detail: 'Keep where it crossed into the water between you and the hole', penalty: 1, spot: line});
  const side = lateral(ground, where, pin);
  if (side) options.push({id: 'lateral', label: 'Lateral relief', detail: 'Within two club-lengths of where it crossed, no nearer the hole', penalty: 1, spot: side});
 } else if (hazard === OUT && outRule === 'e5') {
  const drop = e5(ground, where, pin);
  if (drop) options.push({id: 'e5', label: 'Drop near where it went out', detail: 'Local Rule E-5: two strokes, toward the fairway, no nearer the hole', penalty: 2, spot: drop});
 }
 return options;
}
