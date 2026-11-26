// THE GREEN COLOUR LAB'S ARITHMETIC (the owner, 26 November 2026: "I feel
// like the greens in parkland are way too pale. Can you give me an in game
// interactive picker with sliders that lets me tune the colors of the greens
// in each biome with the ability to copy settings back out to you to
// implement?"). Pure: no DOM, no three.js (ui-colour-lab.js is the window).
//
// A pick is a landscape's BASE colour for a surface -- the colour biomes.js
// writes, before the turf grade (textures.js turfGrade) tones every turf
// colour down -- so what is copied out is the very value to put in
// biomes.js. The green, and the fringe round it: darken a green and its
// collar reads pale beside it (the first pictures, the same day).

export const LAB_STORE = 'fairway-colour-lab';
export const LAB_SURFACES = ['green', 'fringe'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hex2 = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
export const isHex = s => /^#[0-9a-f]{6}$/i.test(String(s ?? ''));

// '#rrggbb' to {h: 0-360, s: 0-100, l: 0-100}.
export function hexToHsl(hex) {
 const n = parseInt(String(hex).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
 const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
 let h = 0, s = 0;
 if (d) {
  s = d / (1 - Math.abs(2 * l - 1));
  h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
 }
 return {h: Math.round(h * 10) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10};
}
// {h, s, l} back to '#rrggbb'.
export function hslToHex({h, s, l}) {
 const S = clamp(s, 0, 100) / 100, L = clamp(l, 0, 100) / 100, C = (1 - Math.abs(2 * L - 1)) * S, H = ((h % 360) + 360) % 360 / 60, X = C * (1 - Math.abs(H % 2 - 1)), m = L - C / 2;
 const [r, g, b] = H < 1 ? [C, X, 0] : H < 2 ? [X, C, 0] : H < 3 ? [0, C, X] : H < 4 ? [0, X, C] : H < 5 ? [X, 0, C] : [C, 0, X];
 return '#' + hex2((r + m) * 255) + hex2((g + m) * 255) + hex2((b + m) * 255);
}

// The picks kept on this device: {landscapeKey: {green?, fringe?}}, anything
// else dropped, so a hand-edited or old store never breaks the window.
export function readPicks(raw) {
 let o; try { o = JSON.parse(raw ?? '{}'); } catch { return {}; }
 if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
 const out = {};
 for (const [k, v] of Object.entries(o)) {
  if (!/^[a-z0-9]+$/.test(k) || !v || typeof v !== 'object') continue;
  const one = Object.fromEntries(LAB_SURFACES.filter(s => isHex(v[s])).map(s => [s, v[s].toLowerCase()]));
  if (Object.keys(one).length) out[k] = one;
 }
 return out;
}

// What the owner copies back: every pick that differs from what the
// landscape has now, with its name, key, surface, the new base colour and
// the old one. `biomes`: {key: {name, green, fringe}}.
export function labText(picks, biomes, version = '') {
 const rows = [];
 for (const [k, one] of Object.entries(picks)) {
  if (!biomes[k]) continue;
  for (const s of LAB_SURFACES) if (one[s] && one[s].toLowerCase() !== String(biomes[k][s]).toLowerCase()) rows.push(`- ${biomes[k].name} (${k}): ${s} ${one[s]} (was ${String(biomes[k][s]).toLowerCase()})`);
 }
 if (!rows.length) return '';
 // (Since the one-hue turf, turf-ladder.js, a green or fringe here is read
 // as a wish for that landscape's ladder, not a colour to write in.)
 return [`Fairway green colour lab${version ? ` (${version})` : ''}: base turf colours, before the turf grade, as tried in the game`, ...rows].join('\n');
}
