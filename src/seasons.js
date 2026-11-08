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
// A landscape that winters unlike its region: a Las Vegas resort is overseeded and
// stays green (the owner, 5 November 2026: "Winter should stay green"; the USGA
// says water limits are ending full overseeding there: RESEARCH).
export const WINTER_OF = {desertresort: 'green'};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// HOW GREEN EACH LANDSCAPE'S ROUGH IS, SPRING, SUMMER AND AUTUMN (the owner, 4
// November 2026: "Grasses in certain regions would be much greener. For example
// california wine country. Pass over all landscapes and determine if the rough
// needs to be a more rich green in spring. do the same for summer and fall as
// well"). A record's rough was one colour, picked as the land's summer look,
// and straw where the wild hills go straw: but a golf course's rough is watered
// and mown. The share of the way to RICH green, by season, one landscape at a
// time, from when its rain falls and whether its rough is really wild ground
// (all PLACED; RESEARCH.md *How green the rough is*):
//   California   greenest of all in spring, its winter rain just over, and held
//                by water through the summer
//   the wet East and South   rain all year: richest in spring, rich in summer,
//                turning in autumn. Bluegrass the greenest of them
//   the Plains and Texas     a real spring flush, cured by July
//   the mountains and the far north   green late, right through summer
//   the coasts of the North-west and the links   hold their green, but a
//                links' fescue is meant to be tawny
//   the deserts  the rough IS the desert floor: a touch of spring and no more;
//                their spring is the bloom
// New England's record is its autumn (`leafFall`), so its autumn is the record
// and its summer is drawn green here (`realSummer`); the tropics have only
// their summer.
export const RICH = '#4f8a34';
export const GREEN = {
 winecountry: [.85, .6, .35], monterey: [.7, .35, .25], calcoast: [.7, .35, .25], socal: [.6, .3, .2],
 bluegrass: [.65, .5, .3], piedmont: [.55, .4, .15], southpines: [.55, .4, .15], lowcountry: [.55, .4, .2], lowgulf: [.55, .4, .2], bayou: [.55, .45, .25], gulfcoast: [.55, .35, .2], longleaf: [.45, .3, .1], flatwoods: [.45, .35, .2],
 blueridge: [.55, .4, .15], ozarks: [.55, .4, .15], oldnortheast: [.5, .35, .1], parkland: [.5, .35, .1], pinebarrens: [.35, .2, .05], newengland: [.3, .55, 0], heartland: [.5, .35, .1], lakedunes: [.45, .3, .1], northwoods: [.5, .4, .1],
 hillcountry: [.6, .15, .05], bluebonnet: [.6, .15, .05], crosstimbers: [.55, .2, .05], highplains: [.55, .12, 0], sandhills: [.55, .15, 0], badlands: [.45, .08, 0],
 rockies: [.45, .35, .05], sierra: [.5, .3, .05], cascades: [.45, .35, .1], ponderosa: [.45, .2, .05], alaska: [.4, .35, .05],
 puget: [.45, .2, .15], pacnw: [.45, .2, .15], redwood: [.4, .2, .15], oregondunes: [.35, .1, .05], links: [.3, .1, 0], seaside: [.3, .1, 0],
 sagebrush: [.25, .02, 0], redrock: [.15, 0, 0], sonoran: [.12, 0, 0], dmountain: [.12, 0, 0], mojave: [.1, 0, 0], palms: [.15, 0, 0], desertresort: [.2, .25, .1], dresort: [.2, .25, .1], chihuahuan: [.15, .05, .05],
 keys: [0, .25, 0], flpalms: [0, .25, 0], hawaii: [0, .2, 0], hiresort: [0, .2, 0],
};
export const roughGreen = (key, season) => GREEN[key]?.[['spring', 'summer', 'autumn'].indexOf(season)] ?? 0;
// THE GROUND IN A SEASON: the record's turf and tree colours moved toward the
// season's (fractions PLACED from the pictures): spring a fresher green,
// autumn the rough gone gold, winter by the region's WINTER -- snow whitens
// the rough (fairways and greens are kept clear, so only a touch reaches
// them), frost greys it, dormant turns it straw. Summer is the record, with its
// rough as green as GREEN says. Spring went further on 4 November 2026 (the
// owner: "Spring doesnt look too much different across the landscapes"): at
// .18 of the way to fresh green its rough could not be told from summer's.
const SPRING = '#7ab84a', AUTUMN = '#c09a4a', SNOW = '#eef2f4', FROST = '#b8c0b4', STRAW = '#c8b47a';
// A REAL SUMMER FOR A LANDSCAPE BUILT AS ITS AUTUMN (the owner, 4 November 2026:
// "For new england summer make it not autumn. make it real summer. Autumn can
// just be real autumn"): everything in the record that is October. The hills
// the woods' summer green, the low orange sun a day's white, the purple autumn
// shade Appalachia's, the banks grass, no drifts of fallen leaves in the rough
// and a brown forest floor under the trees. The trees take their own summer
// colours (vegetation.js). Colours PLACED, from Old Northeast's summer record
// beside it.
function realSummer(bio) {
 const tints = {...bio.groundTints, litter: mix((bio.groundTints?.litter ?? GROUND_TINT.litter).toLowerCase(), '#8a7452', .75)};
 const out = {sunColor: '#fff0dc', litter: null, litterVary: 0, groundTints: tints, light: {...bio.light, shade: '#8a96bc'}};
 if (bio.bank) out.bank = mix(bio.bank.toLowerCase(), '#6a7a48', .75);
 if (bio.farForest?.colors) out.farForest = {...bio.farForest, colors: ['#3f6a30', '#4a7436', '#56803a', '#3f5a34']};
 return out;
}
export function seasonPalette(bio, season, region) {
 if (!bio) return {};
 const green = season === 'winter' ? 0 : roughGreen(bio.key, season);
 // The rough and the pale tint the ground lays over it (renderer.js) as green
 // as the season has them; the season's own colour goes on top of that.
 const base = k => mix(bio[k].toLowerCase(), RICH, k === 'semi' ? green * .5 : green);
 // A landscape built as its autumn is simply that in autumn.
 if (season === 'autumn' && bio.leafFall) return {};
 if (season === 'summer') {
  if (!green) return {};
  const summer = {rough: base('rough'), semi: base('semi'), roughTint: mix((bio.roughTint ?? '#b6bc65').toLowerCase(), '#8fb855', green)};
  return bio.leafFall ? {...summer, ...realSummer(bio)} : summer;
 }
 const out = {}, put = (k, to, t) => { if (/^#[0-9a-f]{6}$/i.test(bio[k] || '')) out[k] = mix(green && (k === 'rough' || k === 'semi') ? base(k) : bio[k].toLowerCase(), to, t); };
 if (green) out.roughTint = mix((bio.roughTint ?? '#b6bc65').toLowerCase(), '#8fb855', green);
 if (season === 'spring') {
  // A landscape whose record IS its autumn (`leafFall`, New England) goes much
  // further: at .18 its spring had a gold rough, orange litter and orange
  // hills (PLACED, from the first spring picture).
  const autumnal = !!bio.leafFall;
  // Fresher in a dry landscape too (PLACED: a share of the way, less where the
  // rough is a desert's or a links' own colour and not grass).
  const fresh = autumnal ? .6 : green < .2 ? .12 : .32;
  put('rough', SPRING, fresh); put('semi', SPRING, autumnal ? .4 : fresh * .7); put('fairway', SPRING, .16); put('fringe', SPRING, .14);
  // The wild ground in flower from far off, as Bluebonnet Prairie's drifts
  // are all summer: half of the way to the bloom's colour at most (PLACED).
  // `bloom` itself goes to the ground shader, which paints drifts of it in
  // the rough (ground.js): the flowers proper are too small and stop too near
  // to show a landscape in flower.
  const bloom = bloomIn(bio.key, season), native = bio.groundTints?.native ?? GROUND_TINT.native;
  const tints = {...bio.groundTints};
  if (bloom) { tints.native = mix(native.toLowerCase(), bloom.colours[0], .5 * bloom.amount); out.bloom = {...bloom, amount: Math.min(1, bloom.amount * 1.4)}; }
  if (autumnal) tints.litter = mix((tints.litter ?? GROUND_TINT.litter).toLowerCase(), '#8a7452', .75);
  if (Object.keys(tints).length) out.groundTints = tints;
 }
 else if (season === 'autumn') { put('rough', AUTUMN, .3); put('semi', AUTUMN, .12); }
 else if (season === 'winter') {
  const w = WINTER_OF[bio.key] ?? WINTER[region] ?? 'frost';
  if (w === 'snow') {
   // A landscape whose record IS its autumn goes further, as in spring: at
   // .85 and .75 its snow was cream with orange showing through (4 November
   // 2026, the picture of a New England wall; PLACED).
   const autumnal = !!bio.leafFall;
   // No leaf litter through it either (ground.js litterAmount), and the
   // fallen leaves' patches one colour under it (ground.js litterVary): their
   // pink and yellow tiles showed on snow.
   out.litter = null; out.litterVary = 0;
   // New England's low orange sun is its autumn: a winter's is whiter (PLACED).
   if (autumnal) out.sunColor = '#fff0dc';
   put('rough', SNOW, autumnal ? .96 : .85); put('semi', SNOW, autumnal ? .6 : .45); put('bank', SNOW, .6); put('fairway', FROST, .15);
   // The natural grounds under the snow too (grounds.js GROUND_TINT and the
   // record's groundTints): a winter with orange leaf litter under bare
   // trees read as autumn through the snow (3 November 2026). Rock keeps
   // more of itself. Fractions PLACED from the New England picture.
   out.groundTints = Object.fromEntries(Object.entries({...GROUND_TINT, ...(bio.groundTints || {})})
    .map(([k, v]) => [k, mix(v.toLowerCase(), SNOW, k === 'rock' || k === 'scree' ? .35 : autumnal ? .94 : .75)]));
  }
  else if (w === 'frost') { put('rough', FROST, .35); put('semi', FROST, .2); put('fairway', FROST, .1); }
  else if (w === 'dormant') { put('rough', STRAW, .45); put('semi', STRAW, .3); put('fairway', STRAW, .18); }
 }
 const woods = farWoodsInSeason(bio, season, region);
 if (woods) out.farForest = woods;
 return out;
}
// EACH LANDSCAPE'S SPRING BLOOM (3 November 2026; RESEARCH.md *The spring
// bloom*): its wildflower months, first and last, 1-12, and their colours,
// the first the one seen from far off. The packs' spring colours flower each
// species (season-tints.js: a redbud pink, a dogwood white); this is the
// place's own bloom in the rough, the long grass and the wild ground, which
// comes when the place's spring does. The Sonoran's is over by May; the
// Rockies' does not begin until June, so a Rockies spring has none. Months
// anchored on a source are in RESEARCH; the rest, and every colour, PLACED.
// The tropics have no spring (roundSeason), so no entry.
export const BLOOM = {
 puget: [4, 5, '#6a6ad0', '#f2efe0'], pacnw: [4, 5, '#6a6ad0', '#f2efe0'], redwood: [3, 5, '#f2efe0', '#e0a0b8', '#8a6ac8'],
 cascades: [7, 8, '#f2efe0', '#6a5ac8'], sierra: [6, 8, '#e8c030', '#6a5ac8'], rockies: [6, 8, '#6a5ac8', '#e8c030'], ponderosa: [5, 7, '#d8402e', '#e8c030'],
 sagebrush: [4, 5, '#e8c030', '#6a5ac8'], redrock: [4, 5, '#e0782e', '#d8402e'],
 sonoran: [3, 4, '#f0a020', '#6a5ac8', '#c85aa0'], dmountain: [3, 4, '#f0a020', '#6a5ac8', '#c85aa0'], mojave: [3, 5, '#f0d040', '#b85ab0'], desertresort: [3, 5, '#f0d040', '#b85ab0'], dresort: [3, 5, '#f0d040', '#b85ab0'], palms: [2, 4, '#b85ab0', '#f2efe0'], chihuahuan: [3, 5, '#3a5ac8', '#f0c020'],
 monterey: [3, 5, '#f08a20', '#6a5ac8'], calcoast: [3, 5, '#f08a20', '#6a5ac8'], socal: [3, 4, '#f08a20', '#6a7ad0'], winecountry: [3, 4, '#e8d030', '#f08a20'],
 heartland: [4, 5, '#f2efe0', '#e8c850', '#a080d0'], sandhills: [5, 7, '#8a7ad0', '#f0d040'], highplains: [5, 6, '#e8b040', '#b05aa8'], crosstimbers: [4, 5, '#d8502e', '#f0c020'], badlands: [5, 6, '#b090d0', '#f0e040'],
 hillcountry: [3, 4, '#3a5ac8', '#d8502e'], bluebonnet: [3, 4, '#3a5ac8', '#d8502e'], gulfcoast: [3, 4, '#e8a0c0', '#3a5ac8'],
 longleaf: [3, 5, '#e8c840', '#f0d8e0'], southpines: [3, 4, '#f2efe0', '#e070a0'], piedmont: [3, 4, '#f2efe0', '#e070a0'], lowcountry: [3, 4, '#e070a0', '#f2efe0'], lowgulf: [3, 4, '#9fb05c', '#f2efe0'], bayou: [3, 4, '#6a4ac0', '#e8c840'], flatwoods: [3, 5, '#f0e040', '#f2efe0'],
 blueridge: [4, 5, '#f2efe0', '#8a7ad0'], ozarks: [4, 5, '#f2efe0', '#9a7ad0'], bluegrass: [4, 5, '#f0e040', '#f2efe0'],
 newengland: [5, 6, '#f2efe0', '#f0d040', '#e0a0c8'], oldnortheast: [4, 5, '#f0d040', '#a080d0'], parkland: [4, 5, '#f0d040', '#a080d0'], pinebarrens: [5, 6, '#f2efe0', '#e0a0c8'],
 northwoods: [5, 6, '#f2efe0', '#e0a0c8'], lakedunes: [5, 6, '#f0d040', '#a080d0'], oregondunes: [4, 6, '#f0c020', '#e0a0c8'], seaside: [4, 6, '#f0c020', '#e0a0c8'], alaska: [6, 7, '#6a5ac8', '#c8288a'], links: [5, 6, '#e0a0c8', '#f0d040'],
};
// A landscape's bloom in a season: how much of it falls in the spring months
// (`amount`, 0-1) and its colours; null out of spring, or when none of it
// does. Spring's look is one peak, not a date: a round is played in a season
// (PLACED), so a window half in June is half a bloom.
export function bloomIn(key, season) {
 const w = BLOOM[key];
 if (!w || season !== 'spring') return null;
 const [first, last, ...colours] = w;
 let spring = 0;
 for (let m = first; m <= last; m++) if (m >= 3 && m <= 5) spring++;
 return spring ? {amount: spring / (last - first + 1), colours} : null;
}

// The far woods of a broadleaf forest turn with it: gold-brown in autumn,
// bare grey-brown in winter (PLACED). A conifer forest's stay green.
const BROADLEAF_WOODS = new Set(['northeast', 'midwest', 'appalachia', 'south', 'texas', 'plains', 'lakeshore']);
export function farWoodsInSeason(bio, season, region) {
 const f = bio?.farForest;
 // Every broadleaf forest's far woods in new leaf in spring, paler and fresher
 // than summer's (4 November 2026; before, only New England's changed).
 const springGreen = season === 'spring';
 if (!f?.colors || !BROADLEAF_WOODS.has(region) || (season !== 'autumn' && season !== 'winter' && !springGreen)) return null;
 // Winter at .85: New England's summer record is already its autumn, and
 // .55 of the way from orange still read orange (3 November 2026). Its spring
 // woods are green for the same reason (PLACED).
 // Under snow they are paler than bare wood alone (PLACED).
 const to = springGreen ? (bio.leafFall ? '#7c9c52' : '#8fb05a') : season === 'autumn' ? '#b0703a' : WINTER[region] === 'snow' ? '#a9a6a0' : '#7a6e62', t = season === 'autumn' ? .45 : springGreen && !bio.leafFall ? .4 : .85;
 return {...f, colors: f.colors.map(c => (/^#[0-9a-f]{6}$/i.test(c) ? mix(c.toLowerCase(), to, t) : c))};
}
// Bare in winter: a broadleaf tree that drops its leaves -- not an evergreen,
// a palm, a cactus or a ground plant (each set is the caller's: vegetation.js
// knows its species). Drawn with no leaf or flower parts, the limbs only.
export const bareInWinter = (kind, {evergreen, palms, ground}) => !evergreen.has(kind) && !palms.has(kind) && !ground.has(kind);
// THE WILD GROUND IN A SNOW WINTER (4 November 2026, the first pictures of a
// wall: orange bracken stood a metre wide on the snow, and lime shrubs and
// yellow huckleberry flowers with it). A fern lies flat under the snow, so it
// is not drawn; a plant with no winter of its own in its pack goes dull, with
// no flower or berry. Drawing only: nothing a ball meets moves. PLACED.
export const UNDER_SNOW = new Set(['fern', 'swordfern', 'bracken', 'sorrel']);
export const dullInWinter = leaf => mix(leaf.toLowerCase(), '#6e6a54', .65);
// Long grass with no winter of its own, in a snowy one: cured to pale straw,
// its heads with it, and knocked down to this share of its height (PLACED: it
// stood in New England's snow in the landscape's autumn orange, the Badlands'
// wheatgrass green).
export const curedInWinter = hex => mix(hex.toLowerCase(), '#c4b48c', .8);
export const SNOW_GRASS_HEIGHT = .6;
