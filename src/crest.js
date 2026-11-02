// A COURSE'S IDENTITY (architect-courses, phase 2; the study, workstream P):
// a crest drawn from its name and landscape, and -- for an Architect course,
// which has a style, a club and an age -- the year it was founded and the
// architect who laid it out. The crest is a free extra both designers get;
// the year and the architect only Architect has the facts for.
//
// Nothing here is generated ground: it is read from settings and a name, so
// nothing is fingerprinted or versioned. Pure (an SVG string, no DOM):
// tests/crest.test.mjs.
//
// THE ARCHITECTS ARE MADE UP. No real architect's name appears: a style is
// whose HAND it is, never a claim that a real person drew this course. The
// names below were chosen to sound of their era and searched with "golf
// course architect" to rule out a real one (RESEARCH *Architect courses:
// people*).
import {rng} from './course-plan.js';
import {BIOMES} from './biomes.js';
import {styleOf} from './architect-styles.js';
import {isArchitect} from './settings-schema.js';

const ARCHITECTS = {
 golden: ['Alastair Penrose', 'Hollis Wren', 'C. Everard Maitland'],
 raynor: ['Josiah Harrow', 'Cornelius Tate', 'R. Whitcombe Dunn'],
 links: ['Old Ewan Baird', 'Tam Drummond', 'Hector Lyall'],
 heathland: ['Harold Fenwick', 'Clement Ashdown', 'E. Lindsay Rowe'],
 sandhills: ['Wes Calder', 'June Merriman', 'Dale Ostrow'],
 parkland: ['Edwin Harcourt', 'Bertram Lisle', 'Arthur Penhallow'],
 modern: ['Brent Kessler', 'Lauren Voss', 'Grant Ellery'],
 stadium: ['Pierce Dalton', 'Rhett Mallory', 'Kip Varden'],
 minimalist: ['Nell Ashby', 'Ross Whitlow', 'Ada Kinloch'],
 desert: ['Tomas Vela', 'Ray Calloway', 'Dina Sorrell'],
 mountain: ['Anton Brekke', 'Lise Halvorsen', 'Moritz Fahl'],
 tropical: ['Kai Mahoe', 'Celia Barrow', 'Rafael Quinto'],
};
// The year a course was founded, by its age (PLACED): a new course this
// century, a mature one mid-century, an old one in golf's first boom, a
// restored one an old one brought back.
const YEARS = {new: [2005, 2024], mature: [1955, 1995], old: [1895, 1932], restored: [1898, 1930]};

export function courseIdentity(settings = {}) {
 if (!isArchitect(settings)) return {year: null, architect: null};
 const r = rng(`${settings.seed || 'EVERGREEN'}|identity|${settings.biome || ''}`);
 const [lo, hi] = YEARS[settings.archAge] || YEARS.mature, list = ARCHITECTS[styleOf(settings)] || ARCHITECTS.modern;
 return {year: Math.round(lo + r() * (hi - lo)), architect: list[Math.floor(r() * list.length)]};
}

// A motif per landscape, drawn in a 40 x 40 box centred on 50,52.
const MOTIFS = {
 pnw: 'M50 30 L62 50 L56 50 L66 64 L54 64 L54 72 L46 72 L46 64 L34 64 L44 50 L38 50 Z',
 desert: 'M30 70 L36 46 L48 46 L52 58 L58 40 L70 40 L74 70 Z',
 mountain: 'M28 70 L44 40 L52 52 L60 36 L76 70 Z',
 links: 'M28 60 Q36 50 44 60 T60 60 T76 60 L76 66 Q68 58 60 66 T44 66 T28 66 Z M44 36 L44 58 M44 36 L56 41 L44 46',
 midwest: 'M50 34 C64 34 70 44 66 52 C70 58 62 64 56 60 L54 72 L46 72 L44 60 C38 64 30 58 34 52 C30 44 36 34 50 34 Z',
 island: 'M48 72 Q50 54 54 42 M54 42 Q42 36 34 44 M54 42 Q64 34 72 42 M54 42 Q48 30 40 32 M54 42 Q62 30 70 32',
 redwood: 'M46 72 L46 40 L50 28 L54 40 L54 72 Z M42 46 L58 46 M40 54 L60 54',
 autumn: 'M50 30 L54 42 L66 38 L58 48 L68 56 L55 56 L52 70 L48 70 L45 56 L32 56 L42 48 L34 38 L46 42 Z',
 lakeshore: 'M46 72 L48 40 L52 40 L54 72 Z M44 40 L56 40 L54 34 L46 34 Z M46 34 L50 28 L54 34 M30 72 Q40 66 50 72 T70 72',
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// Up to two letters from the course's name: its first two words' initials.
export function monogram(name = '') {
 const words = String(name).replace(/[^A-Za-z' ]/g, ' ').split(/\s+/).filter(w => w && !/^(the|of|at|and)$/i.test(w));
 return (words.slice(0, 2).map(w => w[0]).join('') || 'F').toUpperCase();
}

// The crest as an SVG string: a shield in the landscape's colours, a band, the
// motif, the monogram and -- for an Architect course -- the year.
export function crestSvg({name = '', settings = {}, size = 64} = {}) {
 const bio = BIOMES[settings.biome] || BIOMES.pnw, id = courseIdentity(settings);
 const r = rng(`${settings.seed || 'EVERGREEN'}|crest|${name}`);
 const field = bio.fairway, band = bio.green, ink = '#fbf6e6', edge = bio.tree;
 const diagonal = r() < .5;
 const shield = 'M14 10 L86 10 L86 52 C86 76 66 88 50 96 C34 88 14 76 14 52 Z';
 const bandPath = diagonal ? 'M14 66 L86 30 L86 44 L14 80 Z' : 'M14 58 L86 58 L86 68 L14 68 Z';
 const motif = MOTIFS[settings.biome] || MOTIFS.pnw;
 const filled = !['links', 'island'].includes(settings.biome);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 106" width="${size}" height="${Math.round(size * 1.06)}" role="img" aria-label="${esc(name)} crest">`
  + `<path d="${shield}" fill="${field}" stroke="${edge}" stroke-width="5"/>`
  + `<path d="${bandPath}" fill="${band}" opacity=".85"/>`
  + `<path d="${motif}" transform="translate(0 -6) scale(1)" fill="${filled ? ink : 'none'}" stroke="${ink}" stroke-width="${filled ? 0 : 3}" stroke-linecap="round" opacity=".95"/>`
  + `<text x="50" y="${id.year ? 84 : 88}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="15" fill="${ink}">${esc(monogram(name))}</text>`
  + (id.year ? `<text x="50" y="22" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="8" fill="${ink}" opacity=".9">EST. ${id.year}</text>` : '')
  + `</svg>`;
}
