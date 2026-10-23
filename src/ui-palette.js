// WHICH COLOURS A SCREEN WEARS (the 1.0 interface, approved 17 October 2026;
// docs/PROJECT_HANDOFF.md, *The 1.0 interface: layout rules*).
//
// One layout, nine palettes: the panel tint and the highlight colours come from
// a biome, and each biome carries its own (`ui` in src/biomes.js). Which biome a
// screen takes:
//
//   - in a round (and on the range, and in a challenge): the course being played;
//   - in the lobby and the course studio: the course being chosen or shaped, so
//     the screen changes colour as the choice changes;
//   - everywhere else (main menu, profile, settings...): this week's course of
//     the week, so the menus change colour every Monday, the same on every copy.
//
// Pure: no DOM. The kit (ui-kit.js) turns a palette into CSS custom properties.

import {BIOMES, biomeOf} from './biomes.js';
import {weeklyBiome} from './weekly.js';

// Red for under par, the same in every biome: a score must read the same on
// every course. Giant Redwood's own accent (#f87171) sits close to it, which is
// why under-par numbers are only ever written on a panel, never on an accent.
// GREEN SINCE 21 OCTOBER 2026 (the owner: "green as on the scorecard"), whose
// to-par cells were green under and red over while the round screen's scores
// were pink-red under. One colour for under par everywhere now.
export const UNDER_PAR = '#6ee38c';

// The six colours every palette must name.
export const PALETTE_KEYS = ['panel', 'a1', 'a2', 'hot', 'soft', 'onHot'];

// Screens that wear the course in play, and screens that wear the course being
// chosen. Anything else wears the week.
const PLAYING = new Set(['round', 'range', 'challenge', 'pause', 'scorecard', 'results']);
const CHOOSING = new Set(['lobby', 'studio']);

// The biome key a screen wears. `course` is the course in play and `chosen` the
// one being chosen or shaped (settings objects, or anything with `.biome`);
// `date` decides the week. An unknown or missing biome falls through to the
// week rather than to a fixed colour, so a half-built lobby still looks like
// the rest of the menus.
export function screenBiome({screen, course, chosen, date = new Date()} = {}) {
 const known = b => (b && BIOMES[b] ? b : null);
 if (PLAYING.has(screen)) { const b = known(course?.biome); if (b) return b; }
 if (CHOOSING.has(screen)) { const b = known(chosen?.biome) || known(course?.biome); if (b) return b; }
 return weeklyBiome(date);
}

// The palette itself, with the biome it came from and the shared under-par red.
export function screenPalette(opts = {}) {
 const biome = screenBiome(opts);
 return {biome, ...biomeOf(biome).ui, under: UNDER_PAR};
}

// The palette as CSS custom properties, for the kit's root element.
export function paletteVars(p) {
 return {'--panel': p.panel, '--a1': p.a1, '--a2': p.a2, '--hot': p.hot, '--soft': p.soft, '--on-hot': p.onHot, '--under': p.under ?? UNDER_PAR};
}

// ---------------------------------------------------------------- contrast
// The WCAG 2 contrast ratio, with transparent colours laid over what is behind
// them first: a panel is see-through, so what a label sits on depends on the
// picture under it. The test lays every panel over white, the worst case for
// light text, and over black.

// '#rgb', '#rrggbb', 'rgb(...)' or 'rgba(...)' into [r, g, b, a], 0-255 and 0-1.
export function parseColour(c) {
 if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] ?? 1];
 const s = String(c).trim().toLowerCase();
 let m = /^#([0-9a-f]{3})$/.exec(s);
 if (m) return [...m[1]].map(h => parseInt(h + h, 16)).concat(1);
 m = /^#([0-9a-f]{6})$/.exec(s);
 if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
 m = /^rgba?\(([^)]*)\)$/.exec(s);
 if (m) {
  const p = m[1].split(',').map(v => Number(v.trim()));
  if ((p.length === 3 || p.length === 4) && p.every(Number.isFinite)) return [p[0], p[1], p[2], p.length === 4 ? p[3] : 1];
 }
 throw new Error(`not a colour: ${c}`);
}

// A colour laid over an opaque backdrop.
export function over(fg, backdrop = '#ffffff') {
 const [r, g, b, a] = parseColour(fg), [R, G, B] = parseColour(backdrop);
 return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
}

const channel = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
export function luminance(rgb) {
 const [r, g, b] = Array.isArray(rgb) ? rgb : parseColour(rgb);
 return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
}

// Text `fg` on `bg`, `bg` itself laid over `backdrop` when it is see-through.
export function contrast(fg, bg, backdrop = '#ffffff') {
 const under = over(bg, backdrop), a = luminance(over(fg, under)), b = luminance(under);
 return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

// What has to be readable, and how readable. 4.5 is WCAG AA for ordinary text;
// 3 is AA for large text (24 px, or 18.7 px bold) and is used only where the
// text is always that large -- the hero numbers and the under-par scores.
// Everything on a panel is checked over white and over black.
export const CONTRAST_RULES = [
 {text: '#ffffff', on: 'panel', min: 4.5, what: 'white text on a panel'},
 {text: 'soft', on: 'panel', min: 4.5, what: 'labels on a panel'},
 {text: 'a1', on: 'panel', min: 4.5, what: 'accent text on a panel'},
 {text: 'hot', on: 'panel', min: 4.5, what: 'highlighted text on a panel'},
 {text: 'under', on: 'panel', min: 3, what: 'an under-par score on a panel'},
 {text: 'onHot', on: 'hot', min: 4.5, what: 'text on the hot colour'},
 {text: 'onHot', on: 'a1', min: 4.5, what: 'text on a highlighted box (light end)'},
];

// Every rule a palette breaks, with the ratio it reached. Empty means readable.
export function contrastProblems(p, backdrops = ['#ffffff', '#000000']) {
 const pick = k => (k.startsWith('#') ? k : k === 'under' ? (p.under ?? UNDER_PAR) : p[k]);
 const out = [];
 for (const r of CONTRAST_RULES) for (const back of backdrops) {
  const ratio = contrast(pick(r.text), pick(r.on), back);
  if (ratio < r.min) out.push({...r, backdrop: back, ratio: Math.round(ratio * 100) / 100});
 }
 return out;
}
