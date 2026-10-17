// THE 1.0 INTERFACE'S LAYOUT RULES (approved 17 October 2026, after twelve
// rounds of mockups; docs/PROJECT_HANDOFF.md, *The 1.0 interface: layout rules*).
//
// Every screen is drawn on a design canvas 1280 wide and as tall as the
// screen's shape needs -- 720 on 16:9, 800 on 16:10, 960 on 4:3 -- scaled to
// fill the screen. Taller screens get more room, never black bars. On it:
//
//   - a header band from 24 to 64 (logo, screen name, Esc);
//   - a footer band 80 from the bottom, 56 tall (keys left, main button right);
//   - the content in between, from 96 to 104 above the bottom, which LEANS AS
//     ONE SHEET: the whole band is skewed 12 degrees about its middle line, and
//     the boxes in it never lean on their own. So every left edge in a column
//     lies on one slanted line and every gap is equal from top to bottom.
//     (Leaning each box on its own gave the jagged edges of rounds 7 and 8.)
//   - a grid of 12 columns with 14 between, measured across the middle of the
//     sheet. The column width is worked out from the sheet's height so the
//     leaning sheet's corners land exactly on the 60 px margins: the bottom-left
//     corner at 60, the top-right at width - 60. That puts the middle-line
//     margin at 60 + (sheet height / 2) x tan 12 degrees, about 115 on 16:9,
//     and the columns at about 74.6.
//
// Pure arithmetic, no DOM, so tests/ui-layout.test.mjs can hold every screen
// shape to the rule. The kit (ui-kit.js) places boxes with `span`.

export const TILT_DEG = 12;
export const TILT = Math.tan(TILT_DEG * Math.PI / 180);

export const CANVAS_WIDTH = 1280;
// The canvas height for each screen shape the mockups were drawn at.
export const SHAPES = {'16:9': 720, '16:10': 800, '4:3': 960};
const SHORTEST = 720, TALLEST = 960;

export const MARGIN = 60, GUTTER = 14, COLUMNS = 12;
export const BANDS = {headerTop: 24, headerBottom: 64, contentTop: 96, contentGap: 104, footerFromBottom: 80, footerHeight: 56};

// Sizes every screen keeps to (the kit reads them).
export const TYPE = {label: 13, body: 18, value: 24, title: 36, hero: 56};
export const PANEL_PAD = {y: 16, x: 36};
export const HEIGHTS = {row: 48, item: 56, tile: 96};
// Phones (phase 5): drawn at their real size.
export const PHONE = {margin: 16, touch: 44, smallestLabel: 11};

// THE CANVAS FOR A SCREEN SHAPE (width / height).
//   16:9 and wider: 720 tall, and a wider screen gets a wider canvas (21:9 is
//     1680 x 720) rather than black bars at the sides;
//   between 16:9 and 4:3: 1280 wide, and the height follows the shape;
//   narrower than 4:3: 960 tall and narrower than 1280 -- an upright phone or a
//     tall window. `narrow` says so; the 12-column sheet is not defined there
//     (phones lean row by row instead, phase 5), and `gridFor` returns null.
export function canvasFor(aspect) {
 const a = Number(aspect);
 if (!(a > 0) || !Number.isFinite(a)) return {width: CANVAS_WIDTH, height: SHORTEST, narrow: false};
 if (a >= CANVAS_WIDTH / SHORTEST) return {width: Math.round(SHORTEST * a), height: SHORTEST, narrow: false};
 if (a >= CANVAS_WIDTH / TALLEST) return {width: CANVAS_WIDTH, height: Math.round(CANVAS_WIDTH / a), narrow: false};
 return {width: Math.round(TALLEST * a), height: TALLEST, narrow: true};
}

// The three bands of a canvas `height` tall, as top/bottom pairs.
export function bandsFor(height) {
 return {
  header: {top: BANDS.headerTop, bottom: BANDS.headerBottom},
  content: {top: BANDS.contentTop, bottom: height - BANDS.contentGap},
  footer: {top: height - BANDS.footerFromBottom, bottom: height - BANDS.footerFromBottom + BANDS.footerHeight},
 };
}

// THE GRID ON THE LEANING SHEET of a canvas {width, height}.
//   sheet   the content band: top, height, and `middle`, the line it leans about
//   inset   the margin measured along the middle line (60 + half-height x tan 12)
//   pitch   one column plus one gutter; `column` the column's own width
//   left(c) where column c starts on the middle line (0-based)
//   span(c, n)  a box from column c across n columns: {left, width}, on the
//           middle line; inside the sheet, which is skewed about that line,
//           this is all a box needs
//   at(x, y)    where a point drawn at x on the middle line lands at height y
//           once the sheet leans (y in canvas pixels)
// Null for a narrow canvas, or one so short or narrow that columns vanish.
export function gridFor({width, height, narrow = false}) {
 if (narrow) return null;
 const b = bandsFor(height), sheetH = b.content.bottom - b.content.top;
 const inset = MARGIN + sheetH / 2 * TILT;
 const pitch = (width - 2 * inset + GUTTER) / COLUMNS, column = pitch - GUTTER;
 if (!(sheetH > 0) || !(column > 0)) return null;
 const middle = b.content.top + sheetH / 2;
 const left = c => inset + c * pitch;
 return {
  sheet: {top: b.content.top, height: sheetH, middle},
  inset, pitch, column, gutter: GUTTER, columns: COLUMNS, margin: MARGIN,
  left,
  span: (c, n = 1) => ({left: left(c), width: n * pitch - GUTTER}),
  at: (x, y) => x - (y - middle) * TILT,
 };
}

// THE CANVAS ON A SCREEN, WITH THE TEXT SIZE (src/ui-scale.js).
//
// `width` and `height` are the screen's size in CSS pixels (innerWidth and
// innerHeight), `zoom` the Text size as a multiplier (1 = 100%).
//
// At 100% the canvas for the screen's shape is scaled to fill it: `drawn` CSS
// pixels per design pixel (1.5 on a 1920 x 1080 screen). Text size multiplies
// that, and the canvas gives up design room by the same factor so it still
// fills the screen exactly -- the same rule the Text size has always followed
// ("lays itself out as a window z times smaller would"), and why it can't
// simply scale the 1280 canvas up: that would run off the screen. Below 100%
// the canvas gains room instead.
//
// There is a floor. A 12-column screen designed at 1280 can give up only so
// much before its rows stop holding their text, so the canvas never gets
// narrower than MIN_CANVAS_WIDTH; above that, a larger Text size still
// enlarges the old interface but no longer the canvas. 1024 (125% on a 16:9
// canvas) is PLACED, not measured: the first screen that overflows at it
// moves it.
//
// The canvas lives inside #app, which the stylesheet already zooms by the Text
// size; `scale` is the transform the canvas root takes inside #app (drawn /
// zoom), so the two never multiply twice. A pointer's design position is
// (clientX - rootLeft) / drawn.
export const MIN_CANVAS_WIDTH = 1024;
export function canvasFrame({width, height, zoom = 1}) {
 const w = Number(width), h = Number(height);
 const z = Number(zoom) > 0 ? Number(zoom) : 1;
 const shape = canvasFor(w > 0 && h > 0 ? w / h : 16 / 9);
 const fit = w > 0 && h > 0 ? Math.min(w / shape.width, h / shape.height) : 1;
 // The largest text multiplier the canvas accepts before it falls below the floor.
 const most = Math.max(1, shape.narrow ? 1 : shape.width / MIN_CANVAS_WIDTH);
 const text = Math.min(z, most);
 const canvas = {width: shape.width / text, height: shape.height / text, narrow: shape.narrow};
 const drawn = fit * text;
 return {canvas, drawn, scale: drawn / z, text, fit, bands: bandsFor(canvas.height), grid: gridFor(canvas)};
}
