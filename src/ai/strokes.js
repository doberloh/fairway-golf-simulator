// STROKES TO HOLE OUT (the fairway-tour goal, 17 November 2026; RESEARCH
// *How a golfer of each handicap misses*).
//
// How many strokes a golfer needs, on average, to finish a hole from a lie
// and a distance. The computer golfer plans with it (which club, which
// target, go or lay up), strokes gained scores a shot with it, and a
// tournament's field is drawn from it. Pure.
//
// THE TOUR TABLE is Broadie's (2012, Interfaces 42(2), Table B.1): PGA Tour
// golfers, over eight million ShotLink shots 2003-2010, from the tee,
// fairway, rough, sand and a recovery lie, 10 to 600 yards. Taken whole.
//
// PUTTING is Broadie's putts-to-hole-out curve for the tour, anchored where
// the papers state it: half one-putted from about 8 ft, two putts on average
// from 33 ft (2012) or 30 ft (2008). The points between are PLACED to pass
// through those anchors with the curve's published shape.
//
// A GOLFER OF A HANDICAP is the tour table plus what Broadie (2008, Table 4)
// measured such golfers losing a round, spread over the round's shots in
// each part of the game -- PLACED: lost strokes shared out evenly across a
// part's shots, which is what "strokes lost per shot" means on average.

const YARD = .9144, FOOT = .3048;
const LIES = ['tee', 'fairway', 'rough', 'sand', 'recovery'];
// Yards; null where the table has no entry (no tee shot under 100 yards).
const TABLE = [
 [10, null, 2.18, 2.34, 2.43, 3.45], [20, null, 2.40, 2.59, 2.53, 3.51], [30, null, 2.52, 2.70, 2.66, 3.57], [40, null, 2.60, 2.78, 2.82, 3.71],
 [50, null, 2.66, 2.87, 2.92, 3.79], [60, null, 2.70, 2.91, 3.15, 3.83], [70, null, 2.72, 2.93, 3.21, 3.84], [80, null, 2.75, 2.96, 3.24, 3.84],
 [90, null, 2.77, 2.99, 3.24, 3.82], [100, 2.92, 2.80, 3.02, 3.23, 3.80], [120, 2.99, 2.85, 3.08, 3.21, 3.78], [140, 2.97, 2.91, 3.15, 3.22, 3.80],
 [160, 2.99, 2.98, 3.23, 3.28, 3.81], [180, 3.05, 3.08, 3.31, 3.40, 3.82], [200, 3.12, 3.19, 3.42, 3.55, 3.87], [220, 3.17, 3.32, 3.53, 3.70, 3.92],
 [240, 3.25, 3.45, 3.64, 3.84, 3.97], [260, 3.45, 3.58, 3.74, 3.93, 4.03], [280, 3.65, 3.69, 3.83, 4.00, 4.10], [300, 3.71, 3.78, 3.90, 4.04, 4.20],
 [320, 3.79, 3.84, 3.95, 4.12, 4.31], [340, 3.86, 3.88, 4.02, 4.26, 4.44], [360, 3.92, 3.95, 4.11, 4.41, 4.56], [380, 3.96, 4.03, 4.21, 4.55, 4.66],
 [400, 3.99, 4.11, 4.30, 4.69, 4.75], [420, 4.02, 4.19, 4.40, 4.83, 4.84], [440, 4.08, 4.27, 4.49, 4.97, 4.94], [460, 4.17, 4.34, 4.58, 5.11, 5.03],
 [480, 4.28, 4.42, 4.68, 5.25, 5.13], [500, 4.41, 4.50, 4.77, 5.40, 5.22], [520, 4.54, 4.58, 4.87, 5.54, 5.32], [540, 4.65, 4.66, 4.96, 5.68, 5.41],
 [560, 4.74, 4.74, 5.06, 5.82, 5.51], [580, 4.79, 4.82, 5.15, 5.96, 5.60], [600, 4.82, 4.89, 5.25, 6.10, 5.70]];
// Feet, tour putts to hole out. 8 ft -> 1.5 and 33 ft -> 2.0 are the papers';
// the rest PLACED along the curve's shape (a tap-in is 1.0, long lags rise
// slowly past two).
const PUTTS = [[0, 1], [1, 1.001], [2, 1.01], [3, 1.05], [4, 1.13], [5, 1.23], [6, 1.33], [8, 1.5], [10, 1.61], [15, 1.78], [20, 1.87], [25, 1.93], [33, 2.0], [40, 2.05], [50, 2.12], [60, 2.18], [90, 2.33], [120, 2.45]];

const interp = (rows, x, col) => {
 const live = rows.filter(r => r[col] != null);
 if (x <= live[0][0]) return live[0][col];
 for (let i = 1; i < live.length; i++) if (x <= live[i][0]) { const a = live[i - 1], b = live[i], t = (x - a[0]) / (b[0] - a[0]); return a[col] + t * (b[col] - a[col]); }
 const a = live[live.length - 2], b = live[live.length - 1];
 return b[col] + (x - b[0]) * (b[col] - a[col]) / (b[0] - a[0]);
};

// Which column a game surface reads as. Green is putting; semi-rough is
// between fairway and rough; the ground types (rock, hardpan, pine straw...)
// play as rough, waste sand as sand. PLACED.
export function lieClass(surface) {
 if (surface === 'green') return 'green';
 if (surface === 'tee') return 'tee';
 if (surface === 'fairway' || surface === 'fringe' || surface === 'apron') return 'fairway';
 if (surface === 'semi') return 'semi';
 if (surface === 'sand' || surface === 'waste') return 'sand';
 if (surface === 'recovery') return 'recovery';
 return 'rough';
}

// Tour strokes to hole out from `metres` on `surface`.
export function tourStrokes(surface, metres) {
 const lie = lieClass(surface);
 if (lie === 'green') return interp(PUTTS, Math.max(0, metres) / FOOT, 1);
 const yd = Math.max(0, metres) / YARD;
 if (lie === 'semi') return (tourStrokes('fairway', metres) + tourStrokes('rough', metres)) / 2;
 const col = 1 + LIES.indexOf(lie === 'tee' && yd < 100 ? 'fairway' : lie);
 return interp(TABLE, yd, col);
}

// WHERE A GOLFER LOSES STROKES TO A SCRATCH GOLFER, a round (Broadie 2008,
// Table 4), by handicap through the same anchors as skill.js; and how many
// shots of each kind a round holds (PLACED from the same paper's counts:
// about 30 putts, 14 long tee shots and 18 more over 100 yd, 8 short-game
// shots, 1.5 from sand, for a middle handicap).
const LOSS = [ // handicap, putting, long, short, sand (strokes a round against scratch)
 [-4, 1.4, 7.1, .6, .5], [3, -.8, -2.2, -.8, -.2], [15, -2.3, -9.3, -3.4, -.6], [32, -5.1, -17.5, -7.3, -1.1]];
const SHOTS = {putting: 31, long: 32, short: 8, sand: 1.5};
// The scratch golfer is the tour less Pro1's gain over scratch, spread the
// same way.
export function lossPerShot(handicap) {
 const col = k => interp(LOSS, handicap, k), s = {putting: col(1), long: col(2), short: col(3), sand: col(4)};
 const pro = {putting: LOSS[0][1], long: LOSS[0][2], short: LOSS[0][3], sand: LOSS[0][4]};
 return Object.fromEntries(Object.keys(SHOTS).map(k => [k, (pro[k] - s[k]) / SHOTS[k]]));
}
const partOf = (surface, metres) => lieClass(surface) === 'green' ? 'putting' : lieClass(surface) === 'sand' && metres < 50 * YARD ? 'sand' : metres < 100 * YARD ? 'short' : 'long';

// Strokes to hole out for a golfer of `handicap`: the tour's, plus what such
// a golfer loses on each shot still to play. The shots still to play are
// read from the tour figure itself (one in each part it passes through).
export function strokesFor(handicap, surface, metres) {
 const base = tourStrokes(surface, metres), loss = lossPerShot(handicap);
 const lie = lieClass(surface);
 if (lie === 'green') return base * (1 + loss.putting);
 // Off the green: the shot from here, then about one more of each part
 // closer in, then the putts (about 1.9 of them for the tour).
 const here = partOf(surface, metres);
 let extra = loss[here] + loss.putting * 1.9;
 if (here === 'long') extra += loss.short * Math.max(0, base - 2.9) + loss.long * Math.max(0, base - 3.9);
 else if (here === 'short' || here === 'sand') extra += loss.short * Math.max(0, base - 2.9);
 return base + extra;
}

// A scratch golfer's strokes, the baseline strokes gained is measured
// against for amateurs (RESEARCH; PLACED: scratch, as Broadie's Golfmetrics
// used).
export const scratchStrokes = (surface, metres) => strokesFor(0, surface, metres);
