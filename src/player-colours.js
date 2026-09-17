// A colour per golfer, so four people's shots can be told apart.
//
// The tracers at the end of a hole were all one amber. With one player that is
// fine; with four it is a plate of spaghetti, and the question the summary orbit
// exists to answer -- who went where -- cannot be answered from it at all.
//
// The colour belongs to the PLAYER, not to the shot, so the same golfer's tracer,
// their chip on the course card and their row on the scorecard are the same
// colour. Assigned by position in the group rather than hashed from the name,
// because a golfer renaming themselves should not change colour, and because
// four positions can be spaced around the wheel deliberately where four hashes
// cannot.
//
// RED AND GREEN ARE RESERVED. `parTint` paints over-par red and under-par green
// on the same cards these colours appear on, so a player whose colour was either
// would be reporting a score they had not shot. Those two hues are named here
// and the spacing is asserted in a test rather than left to whoever picks the
// next colour.
export const PAR_OVER_HUE = 6;    // rgba(193,57,42) from `parTint`
export const PAR_UNDER_HUE = 132; // rgba(64,146,80)

// Gold, cyan, indigo, magenta. Four hues, none of them within 35 degrees of
// either reserved hue and none within 50 of each other.
const HUES = [43, 190, 255, 315];
export const PLAYER_HUES = HUES;
export const MAX_PLAYERS = HUES.length;

// Wraps rather than throwing. A group is capped at four, but a colour lookup is
// not the place to discover that a fifth appeared.
const at = i => HUES[((Math.trunc(i) || 0) % HUES.length + HUES.length) % HUES.length];
export const playerHue = at;

// Hex rather than an `hsl()` string because THREE.Color parses hex on every
// version and space-separated hsl on none of them, and one format everywhere
// means the tracer and the chip cannot drift apart.
function hex(h, s, l) {
 const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
 const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
  : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
 return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

// The identity colour: the chip on the course card, the dot on the scorecard.
export const playerColour = i => hex(at(i), 0.66, 0.55);
// The tracer, lifted and desaturated a little. A line a couple of pixels wide
// seen against grass, water and sky needs more light than a filled chip does.
export const playerTracer = i => hex(at(i), 0.82, 0.66);
// What goes ON a chip. One ink for all four: each colour above is dark enough at
// 55% lightness to carry it, and a per-colour ink is a second thing to keep true.
export const PLAYER_INK = '#12201a';
