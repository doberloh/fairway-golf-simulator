import test from 'node:test';
import assert from 'node:assert/strict';
import {BIOMES} from '../src/biomes.js';
import {BIOME_KEYS} from '../src/settings-schema.js';
import {weeklyBiome} from '../src/weekly.js';
import {PALETTE_KEYS, UNDER_PAR, screenBiome, screenPalette, paletteVars, parseColour, contrast, contrastProblems} from '../src/ui-palette.js';

test('every biome carries a complete interface palette of real colours', () => {
 // A new biome without its own palette must fail here, not wear another's.
 assert.deepEqual(Object.keys(BIOMES).sort(), [...BIOME_KEYS].sort());
 for (const key of BIOME_KEYS) {
  const ui = BIOMES[key].ui;
  assert.ok(ui && typeof ui === 'object', `${key} has no ui palette`);
  assert.deepEqual(Object.keys(ui).sort(), [...PALETTE_KEYS].sort(), `${key}'s palette names exactly the six colours`);
  for (const k of PALETTE_KEYS) assert.doesNotThrow(() => parseColour(ui[k]), `${key}.ui.${k} = ${ui[k]}`);
  // The panel is see-through over the course, but never so thin text loses it.
  const a = parseColour(ui.panel)[3];
  assert.ok(a >= .8 && a < 1, `${key}'s panel is see-through but solid enough (${a})`);
 }
});

test('no two biomes share a palette', () => {
 const seen = new Map();
 for (const key of BIOME_KEYS) {
  const sig = JSON.stringify(BIOMES[key].ui);
  assert.ok(!seen.has(sig), `${key} wears the same palette as ${seen.get(sig)}`);
  seen.set(sig, key);
 }
});

test('every palette keeps its text readable, over a light picture and a dark one', () => {
 for (const key of BIOME_KEYS) {
  const problems = contrastProblems({...BIOMES[key].ui, under: UNDER_PAR});
  assert.deepEqual(problems, [], `${key}: ${problems.map(p => `${p.what} over ${p.backdrop} is ${p.ratio}, needs ${p.min}`).join('; ')}`);
 }
});

test('the contrast ratio is the WCAG one, with see-through colours laid over the backdrop', () => {
 assert.equal(Math.round(contrast('#000000', '#ffffff') * 10) / 10, 21);
 assert.equal(contrast('#777777', '#777777'), 1);
 // A fully transparent panel is the backdrop itself.
 assert.equal(contrast('#ffffff', 'rgba(0,0,0,0)', '#ffffff'), 1);
 assert.equal(Math.round(contrast('#ffffff', 'rgba(0,0,0,0)', '#000000') * 10) / 10, 21);
 assert.throws(() => parseColour('green'));
});

test('a round wears its course, the lobby and studio the course being chosen, the rest the week', () => {
 const date = new Date(2026, 9, 17);
 const week = weeklyBiome(date);
 const other = BIOME_KEYS.find(b => b !== week);
 assert.equal(screenBiome({screen: 'round', course: {biome: other}, date}), other);
 assert.equal(screenBiome({screen: 'range', course: {biome: other}, date}), other);
 assert.equal(screenBiome({screen: 'lobby', chosen: {biome: other}, date}), other);
 assert.equal(screenBiome({screen: 'studio', chosen: {biome: other}, date}), other);
 for (const screen of ['menu', 'profile', 'settings', 'challenges', undefined])
  assert.equal(screenBiome({screen, course: {biome: other}, chosen: {biome: other}, date}), week, `${screen} wears the week`);
 // Nothing known to wear: the week, never a fixed colour or a crash.
 assert.equal(screenBiome({screen: 'round', course: {biome: 'atlantis'}, date}), week);
 assert.equal(screenBiome({screen: 'lobby', date}), week);
});

test('the menus change colour with the week, through every biome', () => {
 const seen = new Set();
 for (let w = 0; w < BIOME_KEYS.length; w++) {
  const date = new Date(2026, 9, 19 + 7 * w); // Mondays from 19 October 2026
  const p = screenPalette({screen: 'menu', date});
  assert.equal(p.biome, weeklyBiome(date));
  // Same week, same colours, Monday to Sunday.
  assert.equal(screenPalette({screen: 'menu', date: new Date(2026, 9, 25 + 7 * w)}).biome, p.biome);
  seen.add(p.biome);
 }
 // Every landscape but Haunted Hollow, whose turn in these weeks falls out of
 // its season and wears Autumn's colours (seasons.js, weekly.js).
 for (const k of BIOME_KEYS.filter(k => k !== 'haunted')) assert.ok(seen.has(k), k);
});

test('a palette becomes the kit\'s custom properties, with the one shared under-par red', () => {
 const p = screenPalette({screen: 'round', course: {biome: 'redwood'}});
 const vars = paletteVars(p);
 assert.equal(vars['--panel'], BIOMES.redwood.ui.panel);
 assert.equal(vars['--on-hot'], BIOMES.redwood.ui.onHot);
 assert.equal(vars['--under'], UNDER_PAR);
 for (const key of BIOME_KEYS) assert.equal(screenPalette({screen: 'round', course: {biome: key}}).under, UNDER_PAR);
});
