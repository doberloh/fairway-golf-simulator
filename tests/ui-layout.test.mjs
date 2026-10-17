import test from 'node:test';
import assert from 'node:assert/strict';
import {TILT, CANVAS_WIDTH, SHAPES, MARGIN, GUTTER, COLUMNS, MIN_CANVAS_WIDTH, canvasFor, bandsFor, gridFor, canvasFrame} from '../src/ui-layout.js';

const close = (a, b, eps = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} is not ${b}`);
const SCREENS = {'16:9': 16 / 9, '16:10': 16 / 10, '4:3': 4 / 3, '21:9': 21 / 9};

test('the canvas is 1280 wide and as tall as the screen shape needs, never letterboxed', () => {
 assert.deepEqual(canvasFor(16 / 9), {width: 1280, height: 720, narrow: false});
 assert.deepEqual(canvasFor(16 / 10), {width: 1280, height: 800, narrow: false});
 assert.deepEqual(canvasFor(4 / 3), {width: 1280, height: 960, narrow: false});
 for (const [shape, h] of Object.entries(SHAPES)) assert.equal(canvasFor(SCREENS[shape]).height, h);
 // Wider than 16:9 gains width, not bars.
 assert.deepEqual(canvasFor(21 / 9), {width: 1680, height: 720, narrow: false});
 // An upright phone is narrow: the sheet does not apply there (phase 5).
 assert.equal(canvasFor(390 / 844).narrow, true);
 assert.equal(gridFor(canvasFor(390 / 844)), null);
 // Nonsense falls back to 16:9 rather than NaN.
 assert.deepEqual(canvasFor(0), {width: 1280, height: 720, narrow: false});
 assert.deepEqual(canvasFor(NaN), {width: 1280, height: 720, narrow: false});
});

test('the bands: header 24-64, content 96 to 104 from the bottom, footer 80 from the bottom', () => {
 assert.deepEqual(bandsFor(720), {header: {top: 24, bottom: 64}, content: {top: 96, bottom: 616}, footer: {top: 640, bottom: 696}});
 assert.deepEqual(bandsFor(960).content, {top: 96, bottom: 856});
 assert.deepEqual(bandsFor(960).footer, {top: 880, bottom: 936});
});

test('the leaning sheet\'s corners land on the 60 px margins on every screen shape', () => {
 for (const [name, aspect] of Object.entries(SCREENS)) {
  const c = canvasFor(aspect), g = gridFor(c);
  const top = g.sheet.top, bottom = g.sheet.top + g.sheet.height;
  // The first column's left edge, at the bottom of the sheet, sits on the left margin;
  // the last column's right edge, at the top, on the right margin.
  close(g.at(g.left(0), bottom), MARGIN, 1e-9, `${name} bottom-left`);
  const last = g.span(COLUMNS - 1);
  close(g.at(last.left + last.width, top), c.width - MARGIN, 1e-9, `${name} top-right`);
  // ...and nothing on the sheet pokes outside the margins at any height.
  for (let y = top; y <= bottom; y += 13) {
   assert.ok(g.at(g.left(0), y) >= MARGIN - 1e-9, `${name} left edge at ${y}`);
   assert.ok(g.at(last.left + last.width, y) <= c.width - MARGIN + 1e-9, `${name} right edge at ${y}`);
  }
 }
});

test('16:9 gives the mockup\'s grid: about 74.6 px columns from about 115 px', () => {
 const g = gridFor(canvasFor(16 / 9));
 close(g.inset, 60 + 260 * TILT, 1e-9);
 assert.equal(Math.round(g.inset), 115);
 assert.equal(Math.round(g.column * 10) / 10, 74.6);
 // A taller screen leans further over its height, so its columns are narrower.
 assert.ok(gridFor(canvasFor(4 / 3)).column < gridFor(canvasFor(16 / 10)).column);
 assert.ok(gridFor(canvasFor(16 / 10)).column < g.column);
});

test('columns never overlap, gutters are all 14, and spans start and end on column edges', () => {
 for (const [name, aspect] of Object.entries(SCREENS)) {
  const c = canvasFor(aspect), g = gridFor(c);
  assert.equal(g.columns, COLUMNS);
  assert.ok(g.column > 0, `${name} has room for columns`);
  for (let i = 0; i < COLUMNS - 1; i++) {
   const a = g.span(i), b = g.span(i + 1);
   close(b.left - (a.left + a.width), GUTTER, 1e-9, `${name} gutter ${i}`);
  }
  // A span of n columns covers exactly those columns and the gutters between them.
  const s = g.span(3, 5);
  close(s.left, g.left(3), 1e-9);
  close(s.left + s.width, g.span(7).left + g.span(7).width, 1e-9);
  // The whole width, on the middle line, is the canvas less the two insets.
  const all = g.span(0, COLUMNS);
  close(all.width, c.width - 2 * g.inset, 1e-9);
 }
});

test('the canvas fills the screen at 100%, scaled up or down to fit', () => {
 const f = canvasFrame({width: 1920, height: 1080});
 assert.deepEqual([f.canvas.width, f.canvas.height], [1280, 720]);
 assert.equal(f.drawn, 1.5);
 assert.equal(f.scale, 1.5);
 const t = canvasFrame({width: 1024, height: 768});
 assert.deepEqual([t.canvas.width, t.canvas.height], [1280, 960]);
 assert.equal(t.drawn, .8);
 // A 4K screen with 150% Windows scaling reports 2560 x 1440 CSS pixels.
 assert.equal(canvasFrame({width: 2560, height: 1440}).drawn, 2);
});

test('Text size multiplies the canvas and the canvas gives up room, so it still fills the screen', () => {
 const screen = {width: 1920, height: 1080};
 for (const zoom of [.75, 1, 1.1, 1.25]) {
  const f = canvasFrame({...screen, zoom});
  close(f.drawn, 1.5 * zoom, 1e-9, `drawn at ${zoom}`);
  // Exactly the screen, in both directions: no bars, nothing off the edge.
  close(f.canvas.width * f.drawn, screen.width, 1e-6, `width at ${zoom}`);
  close(f.canvas.height * f.drawn, screen.height, 1e-6, `height at ${zoom}`);
  // #app already zooms by the Text size; the canvas root adds only the rest.
  close(f.scale * zoom, f.drawn, 1e-9);
  assert.ok(f.grid, `a grid at ${zoom}`);
 }
 // Smaller text: more room on the canvas.
 assert.ok(canvasFrame({...screen, zoom: .75}).canvas.width > CANVAS_WIDTH);
});

test('past the floor, a larger Text size stops shrinking the canvas', () => {
 const f = canvasFrame({width: 1920, height: 1080, zoom: 2});
 close(f.canvas.width, MIN_CANVAS_WIDTH, 1e-9);
 close(f.drawn, 1.5 * CANVAS_WIDTH / MIN_CANVAS_WIDTH, 1e-9);
 close(f.scale * 2, f.drawn, 1e-9);
 close(f.canvas.width * f.drawn, 1920, 1e-6);
 // Still a usable grid at the floor, on every shape.
 for (const aspect of Object.values(SCREENS)) {
  const g = canvasFrame({width: 1000 * aspect, height: 1000, zoom: 2}).grid;
  assert.ok(g && g.column > 40, `columns at the floor for ${aspect.toFixed(2)}: ${g?.column}`);
 }
});

test('a phone held upright gets no sheet and no Text size on the canvas yet', () => {
 const f = canvasFrame({width: 390, height: 844, zoom: 1.5});
 assert.equal(f.canvas.narrow, true);
 assert.equal(f.grid, null);
 assert.equal(f.text, 1);
 // Nonsense in, a 16:9 canvas out.
 const n = canvasFrame({width: 0, height: 0});
 assert.deepEqual([n.canvas.width, n.canvas.height, n.drawn], [1280, 720, 1]);
});
