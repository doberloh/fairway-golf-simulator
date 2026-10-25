// THE NEW GROUND TYPES (the cartoon overhaul, 25 October 2026;
// docs/CARTOON_OVERHAUL.md *New ground types in play*).
//
// Until the overhaul everything unmown was `rough`. Each landscape now has
// ground of its own between the holes -- rock and scree on a mountainside,
// hardpan and dry washes in the desert, marram and heather in the dunes, pine
// straw under conifers -- and a ball that lands on it has to play off it. So
// a ground type is not paint: it is a surface, in every table that asks what
// a ball is lying on. This module is the ONE place each type is described,
// and every one of those tables takes its rows from here:
//
//   physics.js    the bounce (`contact`: restitution, tilt, friction, how
//                 deep it ploughs, how much spin it takes) and whether it
//                 kills the spin outright as sand does (`killsSpin`)
//   turf.js       how fast a rolling ball slows (`roll`, m/s^2, against
//                 rough's 3.8) and how hard a skidding one grabs (`slide`)
//   swing-meter   the share of ball speed the lie keeps (`lie`)
//   relief.js     where it ranks among places a golfer would rather drop
//   roll-hop.js   how high a rolling ball hops on it (`hop`, metres)
//   audio.js      which signed-off contact sound it makes (`sound`)
//   shot-data.js  the word on the shot card (`word`), main.js the HUD label
//   course-map.js the colour on the maps (`map`)
//
// All of them are IN PLAY. No ground type is a penalty area or out of
// bounds: a desert course's "desert rule" (Troon North drops a ball beside the
// nearest grass for a stroke; REFERENCES) is a local rule, not a law of the
// ground, and this game's rules are the same on every landscape. PLACED.
//
// EVERY NUMBER HERE IS PLACED (RESEARCH, *The overhaul's ground types*): no
// source gives a golf ball's restitution on scree or its lie in heather. They
// are set against the fitted surfaces either side -- a rock is harder than a
// fairway and less than a cart path; heather grabs harder than rough -- and
// tuned by eye in play, as the turf's own were. `tests/grounds.test.mjs`
// holds the orderings that must survive any tuning.
//
// Pure: no three.js, no DOM.

// Restitution (`cor`) is the elasto-plastic value; physics multiplies it by up
// to ELASTIC_GAIN (3.5) for a slow contact, so anything above about 0.24 would
// return more than it was dropped from. Rock sits just under that ceiling.
export const GROUNDS = {
 rock: {label: 'Rock', word: 'rock', like: 'rough', sound: 'rock', map: '#9a958a', relief: 4,
  contact: {cor: .22, tilt: .10, mu: .30, ground: .020, canopy: .000, spin: 2.5},
  roll: 1.0, slide: .35, lie: .82, hop: .14},
 // Ironshore: limestone and coral, sharp and pitted. Plays as rock, rolls less.
 coral: {label: 'Coral rock', word: 'coral', like: 'rough', sound: 'rock', map: '#d9d2bf', relief: 4,
  contact: {cor: .20, tilt: .12, mu: .38, ground: .020, canopy: .000, spin: 2.5},
  roll: 2.0, slide: .45, lie: .8, hop: .12},
 // Loose stones below a cliff: hard, but they move and grab.
 scree: {label: 'Scree', word: 'scree', like: 'rough', sound: 'rock', map: '#a8a397', relief: 4,
  contact: {cor: .12, tilt: .16, mu: .55, ground: .060, canopy: .030, spin: 2.5},
  roll: 4.5, slide: .8, lie: .82, hop: .1},
 // The desert floor beyond the turf, and Pinehurst's hardpan: firmer than a
 // fairway, a tight bare lie, a ball runs on it.
 hardpan: {label: 'Hardpan', word: 'hardpan', like: 'fairway', sound: 'tee', map: '#c9ae80', relief: 2,
  contact: {cor: .155, tilt: .12, mu: .40, ground: .045, canopy: .005, spin: 2.5},
  roll: 1.15, slide: .38, lie: .93, hop: .06},
 // Open sand that is not a bunker: a dry wash, a sandy waste area. Firmer than
 // a bunker's raked sand, and it takes the spin the same way.
 waste: {label: 'Waste sand', word: 'waste', like: 'sand', sound: 'sand', map: '#e3cf9f', relief: 4,
  contact: {cor: .06, tilt: .02, mu: .62, ground: .110, canopy: .350, spin: 2.5},
  roll: 5.0, slide: .9, lie: .86, hop: 0, killsSpin: true},
 // Fallen needles under conifers: soft, and a ball sits down in it.
 pinestraw: {label: 'Pine straw', word: 'pine straw', like: 'rough', sound: 'rough', map: '#9c7a4c', relief: 3,
  contact: {cor: .075, tilt: .07, mu: .56, ground: .100, canopy: .200, spin: 2.5},
  roll: 4.2, slide: .7, lie: .88, hop: .03},
 // Fallen leaves under hardwoods: as pine straw.
 litter: {label: 'Leaves', word: 'leaves', like: 'rough', sound: 'rough', map: '#a7703f', relief: 3,
  contact: {cor: .075, tilt: .07, mu: .56, ground: .100, canopy: .200, spin: 2.5},
  roll: 4.2, slide: .7, lie: .88, hop: .03},
 // Heather: woody, wiry and the worst lie on a heath.
 heather: {label: 'Heather', word: 'heather', like: 'rough', sound: 'rough', map: '#7d6378', relief: 4,
  contact: {cor: .055, tilt: .06, mu: .62, ground: .105, canopy: .380, spin: 2.5},
  roll: 6.5, slide: .9, lie: .78, hop: 0},
 // Unmown native grass: marram on a dune, prairie in the Midwest, fescue on a
 // links. Deeper than rough.
 native: {label: 'Native grass', word: 'native grass', like: 'rough', sound: 'rough', map: '#b7a46a', relief: 4,
  contact: {cor: .06, tilt: .07, mu: .60, ground: .105, canopy: .320, spin: 2.5},
  roll: 6.0, slide: .85, lie: .82, hop: 0},
};

export const GROUND_KINDS = Object.keys(GROUNDS);
const WILD = new Set(GROUND_KINDS);
export const isGround = s => WILD.has(s);
// Natural, unmaintained ground: the rough and every ground type. Most
// questions that used to be `surface === 'rough'` (may a bush grow here, may a
// boulder sit here) are really this one; `allows` says which of them each
// ground answers yes to.
export const isNatural = s => s === 'rough' || WILD.has(s);
// What may stand on a ground. Trees and boulders keep off bare rock faces
// (a boulder on a rock face is the face); nothing tall grows in a dry wash.
const ALLOWS = {
 rock: {trees: false, boulders: true, grass: false, shrubs: false},
 coral: {trees: false, boulders: true, grass: false, shrubs: false},
 scree: {trees: false, boulders: true, grass: false, shrubs: false},
 hardpan: {trees: true, boulders: true, grass: false, shrubs: true},
 waste: {trees: false, boulders: false, grass: false, shrubs: false},
 pinestraw: {trees: true, boulders: true, grass: false, shrubs: true},
 litter: {trees: true, boulders: true, grass: false, shrubs: true},
 heather: {trees: true, boulders: true, grass: false, shrubs: true},
 native: {trees: true, boulders: true, grass: true, shrubs: true},
};
export const allows = (surface, what) => surface === 'rough' || !!ALLOWS[surface]?.[what];

// The label on the HUD and the word on the shot card, for any surface.
const BASE_LABEL = {tee: 'Tee box', semi: 'Semi-rough'};
export const surfaceLabel = s => GROUNDS[s]?.label ?? BASE_LABEL[s] ?? (s ? s[0].toUpperCase() + s.slice(1) : '');
// The surface whose behaviour stands in for this one anywhere a table has no
// row of its own (a challenge's list of chip lies, say).
export const groundLike = s => GROUNDS[s]?.like ?? s;
