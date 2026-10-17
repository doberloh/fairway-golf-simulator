import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFocus, reachable, lineOf, dirOfKey, dirOfPad, DIRS} from '../src/ui-focus.js';

const box = (x, y, w = 300, h = 56) => ({x, y, w, h});
// The layouts the menus use: the main menu (a column of nine and a row of
// five links under it, the golfer card off to the right), the pause list (two
// columns of rows), a grid of cards (locker, saved courses), tabs over a list.
const LAYOUTS = {
 column: Array.from({length: 9}, (_, i) => box(60, 160 + 64 * i)),
 'main menu': [...Array.from({length: 9}, (_, i) => box(60, 160 + 64 * i)),
  ...Array.from({length: 5}, (_, i) => box(60 + 150 * i, 760, 140, 32)), box(880, 160, 340, 300)],
 pause: [...Array.from({length: 8}, (_, i) => box(100, 140 + 56 * i, 380, 48)), ...Array.from({length: 7}, (_, i) => box(530, 140 + 56 * i, 380, 48)),
  ...Array.from({length: 5}, (_, i) => box(530 + 76 * i, 560, 70, 36))],
 grid: Array.from({length: 20}, (_, i) => box(400 + (i % 5) * 120, 150 + Math.floor(i / 5) * 110, 110, 100)),
 'tabs over rows': [...Array.from({length: 6}, (_, i) => box(380 + 130 * i, 96, 120, 40)), ...Array.from({length: 7}, (_, i) => box(380, 152 + 56 * i, 600, 48))],
 'two buttons': [box(100, 600, 200, 56), box(320, 600, 200, 56)],
 one: [box(100, 100)],
};

test('every control can be reached from every other, in every layout', () => {
 for (const [name, rects] of Object.entries(LAYOUTS))
  for (let i = 0; i < rects.length; i++)
   assert.equal(reachable(rects, i).size, rects.length, `${name}: from ${i}`);
});

test('nothing traps the focus: every control has a way out, unless it is alone', () => {
 for (const [name, rects] of Object.entries(LAYOUTS)) {
  if (rects.length < 2) { assert.equal(nextFocus(rects, 0, 'down'), 0); continue; }
  rects.forEach((_, i) => assert.ok(Object.keys(DIRS).some(d => nextFocus(rects, i, d) !== i), `${name}: ${i} is a dead end`));
 }
});

test('down goes to the next row, not to something far below and a little nearer sideways', () => {
 const col = LAYOUTS.column;
 assert.equal(nextFocus(col, 0, 'down'), 1);
 assert.equal(nextFocus(col, 4, 'up'), 3);
 const g = LAYOUTS.grid;
 assert.equal(nextFocus(g, 0, 'right'), 1);
 assert.equal(nextFocus(g, 0, 'down'), 5);
 assert.equal(nextFocus(g, 7, 'down'), 12);
 assert.equal(nextFocus(g, 7, 'left'), 6);
});

test('a single column or row wraps at its ends; a grid stays put', () => {
 const col = LAYOUTS.column;
 assert.equal(lineOf(col), 'column');
 assert.equal(nextFocus(col, 8, 'down'), 0);
 assert.equal(nextFocus(col, 0, 'up'), 8);
 const row = LAYOUTS['two buttons'];
 assert.equal(lineOf(row), 'row');
 assert.equal(nextFocus(row, 1, 'right'), 0);
 assert.equal(lineOf(LAYOUTS.grid), null);
 assert.equal(nextFocus(LAYOUTS.grid, 4, 'right'), 4);
});

test('from the menu list, right reaches the golfer card; down from the list reaches the links', () => {
 const m = LAYOUTS['main menu'];
 assert.equal(nextFocus(m, 0, 'right'), 14);
 const below = nextFocus(m, 8, 'down');
 assert.ok(below >= 9 && below <= 13, `down from the list went to ${below}`);
});

test('keys and a controller give directions; nonsense gives none', () => {
 assert.equal(dirOfKey('ArrowUp'), 'up');
 assert.equal(dirOfKey('KeyW'), null);
 assert.equal(dirOfPad({buttons: Array.from({length: 16}, (_, i) => ({pressed: i === 13})), axes: [0, 0]}), 'down');
 assert.equal(dirOfPad({buttons: [], axes: [.9, 0]}), 'right');
 assert.equal(dirOfPad({buttons: [], axes: [.2, -.2]}), null);
 assert.equal(dirOfPad(null), null);
 assert.equal(nextFocus([], 0, 'up'), 0);
 assert.equal(nextFocus(LAYOUTS.column, -1, 'up'), 0);
 assert.equal(nextFocus(LAYOUTS.column, 2, 'sideways'), 2);
});
