// A COURSE'S IDENTITY (architect-courses, phase 2; the study, workstream P):
// a crest drawn from its name and landscape. (An Architect course's crest
// also said the year it was founded, and its results the made-up architect
// who laid it out, until the designer was removed, 2 November 2026.)
//
// Nothing here is generated ground: it is read from settings and a name, so
// nothing is fingerprinted or versioned. Pure (an SVG string, no DOM):
// tests/hole-names.test.mjs.
import {rng} from './course-plan.js';
import {biomeOf} from './biomes.js';

// A motif per landscape, drawn in a 40 x 40 box centred on 50,52.
const MOTIFS = {
 puget: 'M50 30 L62 50 L56 50 L66 64 L54 64 L54 72 L46 72 L46 64 L34 64 L44 50 L38 50 Z',
 sonoran: 'M30 70 L36 46 L48 46 L52 58 L58 40 L70 40 L74 70 Z',
 rockies: 'M28 70 L44 40 L52 52 L60 36 L76 70 Z',
 links: 'M28 60 Q36 50 44 60 T60 60 T76 60 L76 66 Q68 58 60 66 T44 66 T28 66 Z M44 36 L44 58 M44 36 L56 41 L44 46',
 heartland: 'M50 34 C64 34 70 44 66 52 C70 58 62 64 56 60 L54 72 L46 72 L44 60 C38 64 30 58 34 52 C30 44 36 34 50 34 Z',
 keys: 'M48 72 Q50 54 54 42 M54 42 Q42 36 34 44 M54 42 Q64 34 72 42 M54 42 Q48 30 40 32 M54 42 Q62 30 70 32',
 redwood: 'M46 72 L46 40 L50 28 L54 40 L54 72 Z M42 46 L58 46 M40 54 L60 54',
 newengland: 'M50 30 L54 42 L66 38 L58 48 L68 56 L55 56 L52 70 L48 70 L45 56 L32 56 L42 48 L34 38 L46 42 Z',
 lakedunes: 'M46 72 L48 40 L52 40 L54 72 Z M44 40 L56 40 L54 34 L46 34 Z M46 34 L50 28 L54 34 M30 72 Q40 66 50 72 T70 72',
 // Phase 3: a grain elevator, a windmill, an oak leaf, a pitch pine, a peak and spruce.
 highplains: 'M40 72 L40 38 L50 30 L60 38 L60 72 Z M60 50 L72 50 L72 72 L60 72 M28 72 L76 72',
 badlands: 'M24 72 L34 40 L40 52 L50 26 L60 50 L66 42 L76 72 Z M30 58 L70 58 M36 48 L64 48',
 sandhills: 'M49 72 L49 42 M51 72 L51 42 M50 40 L50 26 M50 40 L64 34 M50 40 L58 52 M50 40 L42 52 M50 40 L36 34 M28 72 Q40 62 52 72 Q64 64 74 72',
 parkland: 'M50 74 L50 58 M50 58 C36 58 30 46 36 38 C34 28 44 22 50 22 C56 22 66 28 64 38 C70 46 64 58 50 58 Z M34 74 L66 74',
 oldnortheast: 'M50 74 L50 62 M50 62 C40 62 32 54 36 46 C30 42 34 32 42 34 C42 26 50 24 50 24 C50 24 58 26 58 34 C66 32 70 42 64 46 C68 54 60 62 50 62 Z',
 pinebarrens: 'M50 74 L50 50 M50 50 L38 44 L46 42 L36 34 L48 34 L50 26 L52 34 L64 34 L54 42 L62 44 Z M30 74 L70 74',
 alaska: 'M26 72 L46 34 L56 50 L62 40 L76 72 Z M40 44 L46 34 L52 44 M64 72 L64 60 M64 60 L58 64 L64 52 L70 64 Z',
 // Phase 5: a longleaf, a magnolia bloom, a mossy live oak, a cypress in water, a palm over palmetto.
 southpines: 'M50 74 L50 30 M50 30 C42 30 36 26 38 22 C42 18 58 18 62 22 C64 26 58 30 50 30 Z M34 74 L66 74',
 longleaf: 'M50 74 L50 36 M50 36 L42 30 L46 28 L40 24 L50 26 L52 20 L56 26 L62 24 L56 30 L60 32 Z M30 74 L70 74',
 piedmont: 'M50 66 C40 66 32 58 36 50 C30 44 38 36 46 40 C46 30 54 30 54 40 C62 36 70 44 64 50 C68 58 60 66 50 66 Z M50 66 L50 74',
 lowgulf: 'M48 74 L48 52 C36 52 26 48 26 40 C26 32 40 30 50 32 C60 30 74 32 74 40 C74 48 64 52 52 52 L52 74',
 lowcountry: 'M48 74 L48 52 C36 52 26 48 26 40 C26 32 40 30 50 32 C60 30 74 32 74 40 C74 48 64 52 52 52 L52 74 M34 48 L34 58 M44 50 L44 62 M58 50 L58 60 M68 46 L68 56',
 bayou: 'M46 70 L48 34 L52 34 L54 70 Z M40 34 L60 34 L56 26 L44 26 Z M28 72 Q38 68 48 72 T70 72 M38 70 L40 64 L42 70 M60 70 L62 64 L64 70',
 flatwoods: 'M50 74 L52 34 M52 34 L40 28 M52 34 L64 28 M52 34 L44 22 M52 34 L60 22 M30 74 L36 64 L42 74 M58 74 L64 64 L70 74',
 // Phase 6: a live oak on limestone, a bluebonnet spike, a pine by the bay,
 // a Joshua tree, a fan palm, a sotol fountain.
 hillcountry: 'M50 74 L50 56 C34 56 24 50 28 42 C32 34 44 36 50 40 C56 36 68 34 72 42 C76 50 66 56 50 56 M24 74 L76 74 L72 68 L28 68 Z',
 bluebonnet: 'M50 74 L50 30 M50 32 L44 36 L50 40 L56 36 Z M50 42 L43 46 L50 50 L57 46 Z M50 52 L42 56 L50 60 L58 56 Z M40 74 L46 66 M60 74 L54 66',
 gulfcoast: 'M50 66 L50 28 M50 30 L42 38 L58 38 Z M50 38 L40 48 L60 48 Z M50 48 L38 58 L62 58 Z M26 72 Q38 66 50 72 T74 72',
 mojave: 'M50 74 L50 50 M50 50 L38 40 L36 30 M50 50 L60 42 L64 32 M50 56 L44 48 M36 30 L32 26 L36 24 L40 26 Z M64 32 L60 28 L64 24 L68 28 Z M44 48 L40 44 L44 42 L48 44 Z',
 desertresort: 'M50 74 L50 26 M50 26 L38 42 L62 42 Z M50 40 L34 58 L66 58 Z M30 74 L70 74',
 palms: 'M50 74 L50 34 M50 34 L36 28 M50 34 L64 28 M50 34 L40 22 M50 34 L60 22 M50 34 L50 20 M46 40 L54 40 M46 46 L54 46 M30 74 L70 74',
 chihuahuan: 'M50 72 L50 60 M50 60 L36 34 M50 60 L42 30 M50 60 L50 26 M50 60 L58 30 M50 60 L64 34 M50 26 L50 16 M28 72 L72 72',
 // Phase 7: a lone cypress on its rock, a barranca's sycamore, a vine row,
 // a snow cone, a granite dome, a tall ponderosa.
 monterey: 'M44 74 L48 56 L56 56 L60 74 Z M52 56 L50 42 M50 42 C38 42 30 36 34 30 C42 26 58 26 66 30 C70 36 62 42 50 42 M24 74 Q34 70 44 74 M60 74 Q70 70 78 74',
 socal: 'M24 74 L38 50 L46 58 L54 44 L64 56 L76 74 Z M50 74 L50 60 M50 60 C42 60 38 54 42 50 C46 46 54 46 58 50 C62 54 58 60 50 60',
 winecountry: 'M28 70 L72 70 M28 58 L72 58 M28 46 L72 46 M32 70 L32 44 M50 70 L50 44 M68 70 L68 44 M40 54 L42 50 L44 54 Z M58 66 L60 62 L62 66 Z',
 cascades: 'M20 74 L44 34 L50 28 L56 34 L80 74 Z M44 34 L48 40 L52 36 L56 42 L56 34 M30 74 L30 64 L26 66 L30 58 L34 66 Z',
 sierra: 'M22 74 C22 50 34 34 50 34 C66 34 78 50 78 74 Z M50 34 L50 74 M36 74 L36 66 L32 68 L36 60 L40 68 Z',
 ponderosa: 'M50 74 L50 30 M50 30 L40 38 L60 38 Z M50 40 L38 50 L62 50 Z M50 52 L40 60 L60 60 Z M28 74 L72 74',
 // Phase 8a: a sage clump under a rim, a hoodoo, a pump jack.
 sagebrush: 'M20 44 L80 44 L80 50 L20 50 Z M50 74 C36 74 30 66 36 60 C40 56 46 58 50 54 C54 58 60 56 64 60 C70 66 64 74 50 74',
 redrock: 'M42 74 L44 52 L40 48 L46 42 L44 34 L50 26 L56 34 L54 42 L60 48 L56 52 L58 74 Z M36 36 L64 36',
 crosstimbers: 'M24 74 L76 74 M34 74 L42 50 L50 74 M42 50 L66 40 M66 40 L70 44 L66 50 L62 44 Z M28 50 L46 46',
 // Phase 8b: ridges fading back, a bluff over a spring, a horse fence.
 blueridge: 'M18 70 L34 48 L48 60 L64 40 L82 70 Z M18 58 L30 44 L44 52 L58 34 L76 50',
 ozarks: 'M24 74 L24 40 L52 40 L52 50 L60 50 L60 74 M64 74 Q70 66 76 74 M30 40 L30 30 M30 30 L24 36 L36 36 Z',
 bluegrass: 'M18 50 L82 50 M18 58 L82 58 M18 66 L82 66 M18 74 L82 74 M26 44 L26 76 M50 44 L50 76 M74 44 L74 76',
 // Phase 8c: a red pine over a dock, a wind-shaped shore pine on a dune, a
 // monkeypod's umbrella over lava.
 northwoods: 'M40 74 L40 34 M40 34 L32 40 L48 40 Z M40 42 L30 50 L50 50 Z M50 66 L80 66 M56 66 L56 72 M66 66 L66 72 M76 66 L76 72',
 oregondunes: 'M20 74 Q40 56 60 64 T84 74 Z M46 60 L48 40 M48 40 L30 34 L60 30 L66 36 Z',
 hawaii: 'M50 74 L50 44 M50 44 C34 44 22 38 28 32 C38 26 62 26 72 32 C78 38 66 44 50 44 M22 74 L34 68 L46 74 L58 68 L72 74',
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// Up to two letters from the course's name: its first two words' initials.
export function monogram(name = '') {
 const words = String(name).replace(/[^A-Za-z' ]/g, ' ').split(/\s+/).filter(w => w && !/^(the|of|at|and)$/i.test(w));
 return (words.slice(0, 2).map(w => w[0]).join('') || 'F').toUpperCase();
}

// The crest as an SVG string: a shield in the landscape's colours, a band, the
// motif and the monogram.
export function crestSvg({name = '', settings = {}, size = 64} = {}) {
 const bio = biomeOf(settings.biome);
 const r = rng(`${settings.seed || 'EVERGREEN'}|crest|${name}`);
 const field = bio.fairway, band = bio.green, ink = '#fbf6e6', edge = bio.tree;
 const diagonal = r() < .5;
 const shield = 'M14 10 L86 10 L86 52 C86 76 66 88 50 96 C34 88 14 76 14 52 Z';
 const bandPath = diagonal ? 'M14 66 L86 30 L86 44 L14 80 Z' : 'M14 58 L86 58 L86 68 L14 68 Z';
 const motif = MOTIFS[biomeOf(settings.biome).key] || MOTIFS.puget;
 const filled = !['links', 'keys'].includes(settings.biome);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 106" width="${size}" height="${Math.round(size * 1.06)}" role="img" aria-label="${esc(name)} crest">`
  + `<path d="${shield}" fill="${field}" stroke="${edge}" stroke-width="5"/>`
  + `<path d="${bandPath}" fill="${band}" opacity=".85"/>`
  + `<path d="${motif}" transform="translate(0 -6) scale(1)" fill="${filled ? ink : 'none'}" stroke="${ink}" stroke-width="${filled ? 0 : 3}" stroke-linecap="round" opacity=".95"/>`
  + `<text x="50" y="88" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="15" fill="${ink}">${esc(monogram(name))}</text>`
  + `</svg>`;
}

// For tests/landscapes-complete.test.mjs: every landscape has its motif.
export {MOTIFS};
