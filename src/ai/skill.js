// A COMPUTER GOLFER'S SKILL (the fairway-tour goal, 17 November 2026;
// RESEARCH *How a golfer of each handicap misses*). Pure.
//
// A golfer is a handicap and ten traits. `skillFor` turns them into the
// spreads its shots are drawn from. The handicap sets every spread to what
// Broadie (2008) measured for golfers of that standard; each trait moves its
// own spreads up to a fifth either way (PLACED), so two 12s do not play
// alike.
//
// THE ANCHORS. Broadie's groups by score are mapped to handicaps (PLACED:
// RESEARCH says how): Pro -4, Am1 3, Am2 15, Am3 32. Figures between are
// joined in straight lines by handicap, and held flat outside them.
//
// THE CALIBRATION. What the papers measured is where balls finished; what a
// golfer here controls is how the ball leaves the club. `CAL` turns one into
// the other, and is fitted by tools/ai-bench.mjs against the targets below
// (its date and figures are in RESEARCH). Never change CAL by hand without
// running the bench.

export const ANCHORS = [-4, 3, 15, 32];
// What the papers measured, at each anchor.
export const TARGETS = {
 drive75: [297, 248, 237, 216],        // yd, 75th percentile tee shot (Broadie 2008, Table 1)
 driveDir: [4.0, 5.4, 6.4, 8.1],       // deg, standard deviation of a long tee shot's direction (Table 1)
 approachFRL: [.056, .087, .120, .173],// median fraction left from 100-150 yd, fairway (Table 2; Pro1 and Pro2 averaged)
 shortFRL: [.083, .138, .169, .203],   // the same from 20-60 yd (Table 2)
 sandFRL: [.16, .30, .40, .49],        // the same from greenside sand (Table 1)
 onePutt50: [8.2, 5.8, 5.1, 3.8],      // ft, half one-putted from here (Table 1)
 twoPutt: [30, 25, 19, 12],            // ft, two putts on average from here (Table 1)
 awful: [.1, 1.9, 4.1, 9.3],           // awful shots a round (Table 3)
};
// The fitted conversions, one number per anchor (see the top). Each is the
// launch spread that gives the measured finish on the game's own ground.
export const CAL = {
 // A full shot's start-line spread as a share of the measured finish
 // spread (the rest comes from curve and the ground).
 dir: [.82, .82, .76, .76],
 // Long-game error along the line against across it (Broadie's figure 5:
 // the ellipses from 100-150 yd are longer than wide). Fitted.
 longWide: [1.4, 1.5, 1.7, 1.6],
 // Short game and sand: long against wide, Broadie's ratio.
 shortRatio: [1.5, 3.2, 3.3, 3.1],
 // An approach's struck spread against Broadie's finished median: the
 // game's slopes, roll, lies and wind add their own (measured: finishes ran
 // 1.25-1.5 times the struck spread). Fitted.
 approachScale: [.62, .66, .88, 1],
 // The short game's spread against Broadie's median (the game's lies and
 // greens hold a chip differently from his courses). Fitted.
 shortScale: [.6, .55, .72, .7],
 // The same for greenside sand. Fitted.
 sandScale: [.75, .75, .62, .65],
 // Speed spread per unit of distance spread (the ball runs on after
 // landing, so less speed error is needed than distance error).
 speed: [.8, .8, .8, .8],
 // The driver's carry against the measured 75th-percentile drive (the ball
 // runs on, and a full swing is the golfer's usual one). Fitted.
 carry: [.92, .90, .87, .845],
 // Putting: start-line spread (deg) and pace spread (share of the roll).
 puttLine: [1.1, 1.6, 1.9, 3.1],
 puttPace: [.06, .08, .08, .11],
 // How much of a putt's break the golfer plays (Broadie 2008: the high
 // handicapper misses low 60% of the time).
 read: [.95, .8, .7, .5],
 // A proper miss (thin, fat, block, shank) per full or short shot.
 mishit: [.003, .025, .08, .26],
};

const lerp = (row, h) => {
 if (h <= ANCHORS[0]) return row[0];
 for (let i = 1; i < ANCHORS.length; i++) if (h <= ANCHORS[i]) { const t = (h - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1]); return row[i - 1] + t * (row[i] - row[i - 1]); }
 return row[row.length - 1];
};

export const TRAITS = ['power', 'accuracy', 'distance', 'shortGame', 'putting', 'mishits', 'nerve', 'aggression'];
export const SHAPES = ['draw', 'straight', 'fade'];
const SWAY = .2; // a trait moves its spreads up to a fifth (PLACED)
// A trait is 0..1, 0.5 average for the handicap.
const tr = (t, k) => Math.min(1, Math.max(0, Number.isFinite(t?.[k]) ? t[k] : .5));
const better = (t, k) => 1 - SWAY * (tr(t, k) - .5) * 2; // < 1 is tighter

export const MIN_HANDICAP = -6, MAX_HANDICAP = 40;
export function skillFor(handicap, traits = {}) {
 const h = Math.min(MAX_HANDICAP, Math.max(MIN_HANDICAP, Number(handicap) || 0));
 const at = row => lerp(row, h);
 const power = 1 + SWAY * (tr(traits, 'power') - .5) * 2 * .5; // a tenth either way in distance
 const drive75 = at(TARGETS.drive75) * power;
 return {
  handicap: h,
  shape: SHAPES.includes(traits.shape) ? traits.shape : 'straight',
  // The bag: the stock bag's carries scaled to this golfer's drive.
  driveCarry: drive75 * at(CAL.carry), // yd; the 75th percentile is a total
  driveDir: at(TARGETS.driveDir) * at(CAL.dir) * better(traits, 'accuracy'),
  approachFRL: at(TARGETS.approachFRL) * at(CAL.approachScale) * better(traits, 'distance'),
  longWide: at(CAL.longWide),
  shortFRL: at(TARGETS.shortFRL) * at(CAL.shortScale) * better(traits, 'shortGame'),
  sandFRL: at(TARGETS.sandFRL) * at(CAL.sandScale) * better(traits, 'shortGame'),
  shortRatio: at(CAL.shortRatio),
  speed: at(CAL.speed),
  puttLine: at(CAL.puttLine) * better(traits, 'putting'),
  puttPace: at(CAL.puttPace) * better(traits, 'putting'),
  read: Math.min(1, at(CAL.read) / better(traits, 'putting')),
  mishit: at(CAL.mishit) * better(traits, 'mishits'),
  nerve: tr(traits, 'nerve'),
  aggression: tr(traits, 'aggression'),
 };
}
