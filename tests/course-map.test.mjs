// Map pan and zoom. The arithmetic only -- a wrong sign here puts the map under
// your finger instead of following it, and a wrong inverse puts a click-to-aim
// somewhere the player did not click, which is far worse than a map that looks
// odd.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mapLayout, mapPoint, mapPosition, zoomAbout, panBy,
 clampZoom, tilePlacement, MAP_ZOOM_MIN, MAP_ZOOM_MAX, MAP_NAV_NONE} from '../src/course-map.js';
import {generateWorld} from '../src/course.js';
import {RANGE_SETTINGS} from '../src/range.js';

const world = generateWorld(RANGE_SETTINGS);
const hole = world.holes[0];
const W = 440, H = 580;
const layout = (nav, full = false) => mapLayout(hole, W, H, full, hole.tee, nav);

test('no nav is exactly the map as it was', () => {
 const bare = mapLayout(hole, W, H, false, hole.tee);
 const none = layout(MAP_NAV_NONE);
 for (const k of ['cx', 'cz', 'scale']) {
  assert.ok(Math.abs(bare[k] - none[k]) < 1e-12, `${k} drifted: ${bare[k]} vs ${none[k]}`);
 }
 assert.equal(none.zoom, 1);
});

test('click-to-aim survives any pan and zoom', () => {
 // mapPosition is the inverse of mapPoint, and the whole aiming interaction
 // rests on that staying true once the frame can move.
 for (const nav of [MAP_NAV_NONE, {zoom: 3, x: 12, z: -40}, {zoom: 9.5, x: -30, z: 55}]) {
  const m = layout(nav);
  for (const p of [{x: 0, z: 0}, {x: 14, z: 220}, {x: -22, z: 90}]) {
   const [sx, sy] = mapPoint(m, p);
   const back = mapPosition(m, sx, sy);
   assert.ok(Math.hypot(back.x - p.x, back.z - p.z) < 1e-9,
    `zoom ${nav.zoom}: ${JSON.stringify(p)} round-tripped to ${JSON.stringify(back)}`);
  }
 }
});

test('zoom multiplies the fitted scale and nothing else', () => {
 const fit = layout(MAP_NAV_NONE);
 for (const zoom of [1, 2.5, 7, MAP_ZOOM_MAX]) {
  const m = layout({zoom, x: 0, z: 0});
  assert.ok(Math.abs(m.scale - fit.scale * zoom) < 1e-9, `zoom ${zoom} gave scale ${m.scale}`);
 }
});

test('zoom is clamped at both ends', () => {
 assert.equal(clampZoom(0.01), MAP_ZOOM_MIN, 'you cannot zoom out past the fitted frame');
 assert.equal(clampZoom(1e6), MAP_ZOOM_MAX);
 assert.equal(clampZoom(NaN), 1, 'a bad value falls back to fitted, not to NaN');
 assert.equal(clampZoom(undefined), 1);
});

test('zooming about a point keeps that point still', () => {
 // The whole reason zoomAbout exists: zooming about the centre makes the map
 // crawl away from whatever you were trying to look at.
 //
 // Asserted from a zoomed-in start, because that is where the gesture is used
 // and where it can hold exactly. From the FITTED frame the pan clamp pins an
 // axis whose content already fits the viewport, so a corner there cannot stay
 // put -- correctly, and the test below states that case separately rather than
 // pretending this one covers it.
 for (const [px, py] of [[W / 2, H / 2], [70, 90], [W - 70, H - 90]]) {
  let nav = {zoom: 4, x: 0, z: 0};
  let m = layout(nav);
  const before = mapPosition(m, px, py);
  for (const factor of [1.25, 1.25, 0.8]) {
   nav = zoomAbout(m, nav, px, py, factor);
   m = layout(nav);
   const after = mapPosition(m, px, py);
   assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 1e-6,
    `point under (${px},${py}) moved ${Math.hypot(after.x - before.x, after.z - before.z).toFixed(4)} m`);
  }
 }
});

test('zooming about the centre holds exactly, at any zoom', () => {
 // The centre needs no pan at all, so the clamp can never interfere with it --
 // which makes this the case that isolates the zoom arithmetic from the clamp.
 for (const start of [1, 2, 6, MAP_ZOOM_MAX]) {
  let nav = {zoom: start, x: 0, z: 0};
  let m = layout(nav);
  const before = mapPosition(m, W / 2, H / 2);
  nav = zoomAbout(m, nav, W / 2, H / 2, 1.5);
  const after = mapPosition(layout(nav), W / 2, H / 2);
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 1e-9,
   `centre drifted from zoom ${start}`);
 }
});

test('the map follows the drag rather than running away from it', () => {
 const nav = {zoom: 4, x: 0, z: 0};
 const m = layout(nav);
 const held = {x: hole.pin.x, z: hole.pin.z};
 const [sx, sy] = mapPoint(m, held);
 const dx = 30, dy = -18;
 const after = layout(panBy(m, nav, dx, dy));
 const [nx, ny] = mapPoint(after, held);
 assert.ok(Math.abs(nx - (sx + dx)) < 1e-6 && Math.abs(ny - (sy + dy)) < 1e-6,
  `dragged (${dx},${dy}) but the point moved (${(nx - sx).toFixed(2)},${(ny - sy).toFixed(2)})`);
});

test('a pan cannot throw the course off the map', () => {
 // Unclamped, a hard drag loses the map entirely and nothing on screen says
 // which way to drag back. The rule is that the content must still overlap the
 // viewport by at least half a screen -- NOT that the centre stays inside the
 // content, which was the first version and stopped a fitted hole map dead after
 // about fifty pixels of drag.
 for (const full of [false, true]) for (const zoom of [1, 4, MAP_ZOOM_MAX]) {
  const far = mapLayout(hole, W, H, full, hole.tee, {zoom, x: 1e6, z: -1e6});
  const fit = mapLayout(hole, W, H, full, hole.tee, {zoom, x: 0, z: 0});
  const halfViewX = (W / 2) / far.scale, halfViewZ = (H / 2) / far.scale;
  // Content edge nearest the viewport, against the viewport's own near edge.
  const gapX = Math.abs(far.cx - fit.cx) - far.halfX;
  const gapZ = Math.abs(far.cz - fit.cz) - far.halfZ;
  assert.ok(gapX <= halfViewX, `x panned ${gapX.toFixed(1)} m clear of a ${halfViewX.toFixed(1)} m half-view`);
  assert.ok(gapZ <= halfViewZ, `z panned ${gapZ.toFixed(1)} m clear of a ${halfViewZ.toFixed(1)} m half-view`);
 }
});

test('a fitted map can be dragged a long way before it stops', () => {
 // The bug this pins: the clamp used to bind after about fifty pixels on a
 // fitted hole map, which reads as the drag breaking rather than as a limit.
 let nav = {zoom: 1, x: 0, z: 0};
 let m = layout(nav);
 const start = mapPoint(m, hole.pin)[0];
 // Twenty 10-pixel drags. Any usable map survives two hundred pixels of pull.
 for (let i = 0; i < 20; i++) { nav = panBy(m, nav, 10, 0); m = layout(nav); }
 const moved = mapPoint(m, hole.pin)[0] - start;
 assert.ok(moved > 150, `200 px of drag moved the map only ${moved.toFixed(0)} px`);
});

test('the whole-course map takes a nav too, which is what studio uses', () => {
 const fit = mapLayout(hole, W, H, true);
 const zoomed = mapLayout(hole, W, H, true, hole.tee, {zoom: 5, x: 10, z: 10});
 assert.ok(Math.abs(zoomed.scale - fit.scale * 5) < 1e-9, 'the full-course map must zoom as well');
 assert.equal(zoomed.full, true);
});

test('a raster tile stays locked to the course through zoom and pan', () => {
 // The full-course terrain background was drawn at `w/2 - halfX*scale`, which
 // assumes the map is centred on the world origin. It is -- until you touch it.
 // `withNav` moves the centre for pan, and `zoomAbout` sets a pan whenever you
 // zoom about anything but the exact middle, which is what a mouse wheel does.
 // So the terrain scaled about the canvas while every fairway, pond and bunker
 // translated about the map centre, and they slid apart: measured at 95 px of
 // drift after one wheel notch and 882 px by zoom 6.5, on a map 376 px wide.
 //
 // It was correct at rest, which is exactly why it survived so long.
 const W = 376, H = 490, halfX = 600, halfZ = 900;
 const layout = nav => {
  const fit = {full: true, w: W, h: H, cx: 0, cz: 0,
   scale: Math.min((W - 24) / (halfX * 2), (H - 24) / (halfZ * 2)), halfX, halfZ};
  const zoom = clampZoom(nav?.zoom);
  const scale = fit.scale * zoom;
  const lx = fit.halfX + (fit.w / 2) / scale / 2, lz = fit.halfZ + (fit.h / 2) / scale / 2;
  const x = Math.min(lx, Math.max(-lx, nav?.x || 0));
  const z = Math.min(lz, Math.max(-lz, nav?.z || 0));
  return {...fit, cx: x, cz: z, scale, zoom};
 };

 let nav = {...MAP_NAV_NONE};
 for (let step = 0; step < 6; step++) {
  const m = layout(nav);
  const bg = tilePlacement(m, {x: 0, z: 0, rx: halfX, rz: halfZ}, 150, 150);
  // The tile's two opposite pixel corners must land exactly where the same two
  // world corners are drawn. Deriving the placement from `mapPoint` is what
  // makes that true; any hand-rolled rectangle is free to drift.
  for (const [px, py, world] of [[0, 0, {x: -halfX, z: -halfZ}], [150, 150, {x: halfX, z: halfZ}]]) {
   const placed = [bg.x + bg.sx * px, bg.y + bg.sy * py];
   const drawn = mapPoint(m, world);
   assert.ok(Math.abs(placed[0] - drawn[0]) < 1e-9 && Math.abs(placed[1] - drawn[1]) < 1e-9,
    `zoom ${m.zoom.toFixed(2)}: tile corner ${placed} against ${drawn}`);
  }
  // Zoom about a point well away from the centre, as a wheel over the map does.
  nav = zoomAbout(m, nav, 90, 120, 1.6);
 }
});
