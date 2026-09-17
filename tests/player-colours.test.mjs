// A colour per golfer. The constraint that matters is not aesthetic: these
// colours sit on the same cards `parTint` paints red and green, so one of them
// straying into either hue would read as a score nobody shot.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYER_HUES, MAX_PLAYERS, playerHue, playerColour, playerTracer,
 PLAYER_INK, PAR_OVER_HUE, PAR_UNDER_HUE} from '../src/player-colours.js';
import {parTint} from '../src/scoring.js';

// Hue of a '#rrggbb' or 'rgba(r,g,b,a)' string, in degrees.
function hueOf(colour) {
 const m = colour.startsWith('#')
  ? [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16) / 255)
  : colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255);
 const [r, g, b] = m, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
 if (!d) return 0;
 const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
 return (h * 60 + 360) % 360;
}
const apart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

test('the reserved hues are the ones parTint actually paints', () => {
 // Named constants drift from the thing they describe. These are checked against
 // `parTint` itself, so changing the tint fails here rather than silently making
 // a player's colour collide with it.
 assert.ok(apart(hueOf(parTint(3, 9)), PAR_OVER_HUE) < 3, `over-par tint is hue ${hueOf(parTint(3, 9)).toFixed(0)}`);
 assert.ok(apart(hueOf(parTint(-3, 9)), PAR_UNDER_HUE) < 3, `under-par tint is hue ${hueOf(parTint(-3, 9)).toFixed(0)}`);
});

test('no player colour strays into over-par red or under-par green', () => {
 for (let i = 0; i < MAX_PLAYERS; i++) {
  for (const [name, reserved] of [['over-par red', PAR_OVER_HUE], ['under-par green', PAR_UNDER_HUE]]) {
   for (const [what, colour] of [['chip', playerColour(i)], ['tracer', playerTracer(i)]]) {
    const gap = apart(hueOf(colour), reserved);
    assert.ok(gap >= 35, `player ${i + 1}'s ${what} ${colour} is ${gap.toFixed(0)}° from ${name}`);
   }
  }
 }
});

test('four golfers are told apart from each other', () => {
 // The point of the feature: four tracers over one fairway. Colours 50 degrees
 // apart survive being thin lines against grass and sky.
 for (let i = 0; i < MAX_PLAYERS; i++) for (let j = i + 1; j < MAX_PLAYERS; j++) {
  const gap = apart(PLAYER_HUES[i], PLAYER_HUES[j]);
  assert.ok(gap >= 50, `players ${i + 1} and ${j + 1} are only ${gap}° apart`);
 }
});

test('a colour belongs to a seat, not to a name or a shot', () => {
 // Assigned by position, so renaming a golfer does not change their colour and
 // the same golfer's chip, dot and tracer always agree.
 assert.equal(playerColour(0), playerColour(0));
 // Within a degree: both are rounded to 8-bit channels, so they land either
 // side of the exact hue rather than on it.
 assert.ok(apart(hueOf(playerColour(2)), hueOf(playerTracer(2))) < 1, 'chip and tracer must be the same hue');
 for (let i = 0; i < MAX_PLAYERS; i++) assert.equal(playerHue(i), PLAYER_HUES[i]);
});

test('an index off the end wraps instead of throwing', () => {
 // A group is capped at four, but a colour lookup is not where that should be
 // discovered -- an undefined colour would paint a tracer black.
 for (const i of [4, 7, -1, -4, 1.7, NaN, undefined]) {
  const c = playerColour(i);
  assert.match(c, /^#[0-9a-f]{6}$/, `index ${i} gave ${c}`);
 }
 assert.equal(playerColour(4), playerColour(0));
});

test('every colour is a real hex string, and the ink is dark enough to read', () => {
 const lum = c => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
  return .2126 * r + .7152 * g + .0722 * b; };
 assert.match(PLAYER_INK, /^#[0-9a-f]{6}$/);
 for (let i = 0; i < MAX_PLAYERS; i++) {
  assert.match(playerColour(i), /^#[0-9a-f]{6}$/);
  assert.ok(lum(playerColour(i)) - lum(PLAYER_INK) > 0.2,
   `player ${i + 1}'s chip is too dark for the ink on it`);
 }
});
