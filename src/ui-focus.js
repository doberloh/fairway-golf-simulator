// ARROWS, A CONTROLLER AND TAB BETWEEN CONTROLS (phase 3 of the 1.0
// interface, 17 October 2026; the plan's `ui-focus.js`).
//
// A sim bay is driven from the mat, often with a controller or a wireless
// keyboard's arrows, never a mouse. So every menu screen must be drivable by
// direction: press right and the focus goes to the control that is to the
// right, the way a console menu does.
//
// The rule, from the controls' boxes alone (no DOM here, so it is tested in
// Node): of the controls whose centre lies in the pressed direction, take the
// one nearest along that direction, with sideways distance counting double --
// so "down" in a column goes to the next row, not to a control far below and
// slightly nearer sideways. Nothing in that direction: in a single column or
// row the focus wraps to the other end; on a grid it stays where it is.
// Either way every control can be reached from every other (the test walks
// every layout the menus use), and no control is a dead end.

export const DIRS = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
const KEY_DIR = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'};
export const dirOfKey = code => KEY_DIR[code] || null;
// A standard gamepad's d-pad buttons (12-15) and its left stick past half way.
export function dirOfPad(pad) {
 if (!pad) return null;
 const b = i => !!pad.buttons?.[i]?.pressed, ax = pad.axes?.[0] || 0, ay = pad.axes?.[1] || 0;
 if (b(12) || ay < -.5) return 'up';
 if (b(13) || ay > .5) return 'down';
 if (b(14) || ax < -.5) return 'left';
 if (b(15) || ax > .5) return 'right';
 return null;
}

const centre = r => ({x: r.x + r.w / 2, y: r.y + r.h / 2});

// Whether the boxes are one column (or one row): then the ends wrap.
export function lineOf(rects) {
 if (rects.length < 2) return null;
 const cs = rects.map(centre), xs = cs.map(c => c.x), ys = cs.map(c => c.y);
 const spread = a => Math.max(...a) - Math.min(...a), w = Math.min(...rects.map(r => r.w)), h = Math.min(...rects.map(r => r.h));
 if (spread(xs) < w / 2) return 'column';
 if (spread(ys) < h / 2) return 'row';
 return null;
}

// The index the focus moves to from `from` in `dir`, among `rects`
// ({x, y, w, h}); `from` itself when nothing qualifies.
export function nextFocus(rects, from, dir) {
 const d = DIRS[dir];
 if (!d || !rects?.length) return from;
 if (!(from >= 0 && from < rects.length)) return 0;
 const a = centre(rects[from]);
 let best = -1, score = Infinity;
 rects.forEach((r, i) => {
  if (i === from) return;
  const c = centre(r), along = (c.x - a.x) * d[0] + (c.y - a.y) * d[1];
  if (along <= .5) return;
  const across = Math.abs((c.x - a.x) * d[1]) + Math.abs((c.y - a.y) * d[0]);
  const s = along + 2 * across;
  if (s < score) { score = s; best = i; }
 });
 if (best >= 0) return best;
 // Wrap along a single line: down from the last goes to the first.
 const line = lineOf(rects);
 if ((line === 'column' && d[1]) || (line === 'row' && d[0])) {
  const key = line === 'column' ? (r => centre(r).y) : (r => centre(r).x);
  const order = rects.map((r, i) => i).sort((i, j) => key(rects[i]) - key(rects[j]));
  return d[0] + d[1] > 0 ? order[0] : order[order.length - 1];
 }
 return from;
}

// Every control reachable from every other by arrows alone: the set reached
// from `start` by any sequence of moves.
export function reachable(rects, start = 0) {
 const seen = new Set([start]), todo = [start];
 while (todo.length) {
  const i = todo.pop();
  for (const dir of Object.keys(DIRS)) {
   const j = nextFocus(rects, i, dir);
   if (!seen.has(j)) { seen.add(j); todo.push(j); }
  }
 }
 return seen;
}
