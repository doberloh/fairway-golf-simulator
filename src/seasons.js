// SEASONS (the US landscapes goal, 2 November 2026; PLAN.md section 3, local).
// Which season a date falls in, which season a round is played in, and what
// a landscape looks like then. Pure: no DOM, no three.js; tests/seasons.test.mjs.
//
// The owner's answers: a round's season is chosen when it starts -- today's
// (from the date, the default) or one the player picks -- and saved with the
// round, so a resumed round looks as it did. Snow is for looks only: a season
// never changes how a ball plays. Autumn is a season everywhere.
//
// Meteorological seasons, by whole months (PLACED: simpler than the
// equinoxes and what weather services report): spring March-May, summer
// June-August, autumn September-November, winter December-February. A
// tropical landscape (the record's `tropical`: the Keys, Hawaii) has one
// green look the year round, so its season is always summer and only its
// flowering would change.
//
// All four are drawn since the goal's step 9 (3 November 2026): each species
// in its own season's colours (src/season-tints.js, from the packs' specs),
// deciduous trees bare in winter, the ground's turf and snow by region
// (`seasonPalette`, below). Looks only: a season never changes a ball.

import {GROUND_TINT} from './grounds.js';
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
// The seasons the game can draw so far. Step 9 lists all four.
export const DRAWN = SEASONS;

const BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

// The season on a date in the northern hemisphere (every landscape so far is
// north of the equator; `south` flips it for one that is not).
export function seasonOf(date = new Date(), {south = false} = {}) {
 const s = BY_MONTH[date.getMonth()];
 return south ? SEASONS[(SEASONS.indexOf(s) + 2) % 4] : s;
}

// A round's season: `choice` is 'today' or one of SEASONS; anything else is
// today's. A tropical landscape is always summer. The answer is a season the
// game can draw (DRAWN), so an old or hand-made save never asks for a look
// that does not exist.
export function roundSeason(choice = 'today', {date = new Date(), tropical = false} = {}) {
 if (tropical) return 'summer';
 const s = SEASONS.includes(choice) ? choice : seasonOf(date);
 return DRAWN.includes(s) ? s : 'summer';
}

// Is `choice` something a round may carry: 'today' or a season.
export const validSeasonChoice = choice => choice === 'today' || SEASONS.includes(choice);

// What a landscape record changes in a season: a partial record laid over it
// (the turf, the leaves, the light), from the record's own `seasons` table.
// Summer is the record itself.
export function seasonLook(record, season) {
 if (season === 'summer' || !record?.seasons) return {};
 return record.seasons[season] || {};
}

// WINTER BY REGION (PLAN.md section 3: snow, frost, dormant or green; PLACED
// from the regions' climates). Snow lies on the rough of the north and the
// mountains, frost greys the turf of the mild north-west and the uplands,
// the South's and the deserts' bermuda goes dormant straw-gold, and the
// tropics stay green (they never leave summer: roundSeason).
export const WINTER = {
 alaska: 'snow', mountain: 'snow', northwoods: 'snow', northeast: 'snow', midwest: 'snow', plains: 'snow', lakeshore: 'snow',
 appalachia: 'frost', highdesert: 'frost', pnw: 'frost', redwood: 'frost', links: 'frost',
 south: 'dormant', texas: 'dormant', desert: 'dormant', california: 'dormant',
 florida: 'green', hawaii: 'green',
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// THE GROUND IN A SEASON: the record's turf and tree colours moved toward the
// season's (fractions PLACED from the pictures): spring a fresher green,
// autumn the rough gone gold, winter by the region's WINTER -- snow whitens
// the rough (fairways and greens are kept clear, so only a touch reaches
// them), frost greys it, dormant turns it straw. Summer is the record.
const SPRING = '#7ab84a', AUTUMN = '#c09a4a', SNOW = '#eef2f4', FROST = '#b8c0b4', STRAW = '#c8b47a';
export function seasonPalette(bio, season, region) {
 if (!bio || season === 'summer') return {};
 const out = {}, put = (k, to, t) => { if (/^#[0-9a-f]{6}$/i.test(bio[k] || '')) out[k] = mix(bio[k].toLowerCase(), to, t); };
 if (season === 'spring') { put('rough', SPRING, .18); put('semi', SPRING, .12); put('fairway', SPRING, .08); }
 else if (season === 'autumn') { put('rough', AUTUMN, .3); put('semi', AUTUMN, .12); }
 else if (season === 'winter') {
  const w = WINTER[region] || 'frost';
  if (w === 'snow') {
   put('rough', SNOW, .85); put('semi', SNOW, .45); put('bank', SNOW, .6); put('fairway', FROST, .15);
   // The natural grounds under the snow too (grounds.js GROUND_TINT and the
   // record's groundTints): a winter with orange leaf litter under bare
   // trees read as autumn through the snow (3 November 2026). Rock keeps
   // more of itself. Fractions PLACED from the New England picture.
   out.groundTints = Object.fromEntries(Object.entries({...GROUND_TINT, ...(bio.groundTints || {})})
    .map(([k, v]) => [k, mix(v.toLowerCase(), SNOW, k === 'rock' || k === 'scree' ? .35 : .75)]));
  }
  else if (w === 'frost') { put('rough', FROST, .35); put('semi', FROST, .2); put('fairway', FROST, .1); }
  else if (w === 'dormant') { put('rough', STRAW, .45); put('semi', STRAW, .3); put('fairway', STRAW, .18); }
 }
 const woods = farWoodsInSeason(bio, season, region);
 if (woods) out.farForest = woods;
 return out;
}
// The far woods of a broadleaf forest turn with it: gold-brown in autumn,
// bare grey-brown in winter (PLACED). A conifer forest's stay green.
const BROADLEAF_WOODS = new Set(['northeast', 'midwest', 'appalachia', 'south', 'texas', 'plains', 'lakeshore']);
export function farWoodsInSeason(bio, season, region) {
 const f = bio?.farForest;
 if (!f?.colors || !BROADLEAF_WOODS.has(region) || (season !== 'autumn' && season !== 'winter')) return null;
 // Winter at .85: New England's summer record is already its autumn, and
 // .55 of the way from orange still read orange (3 November 2026).
 const to = season === 'autumn' ? '#b0703a' : '#7a6e62', t = season === 'autumn' ? .45 : .85;
 return {...f, colors: f.colors.map(c => (/^#[0-9a-f]{6}$/i.test(c) ? mix(c.toLowerCase(), to, t) : c))};
}
// Bare in winter: a broadleaf tree that drops its leaves -- not an evergreen,
// a palm, a cactus or a ground plant (each set is the caller's: vegetation.js
// knows its species). Drawn with no leaf or flower parts, the limbs only.
export const bareInWinter = (kind, {evergreen, palms, ground}) => !evergreen.has(kind) && !palms.has(kind) && !ground.has(kind);
