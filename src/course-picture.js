// A COURSE'S PICTURE, DRAWN FROM ITS OWN PLAN (round 13, the owner, 17 October
// 2026: "course pictures are drawn top-down from each course's plan in its
// biome's colours: no 3D render needed").
//
// The holes are the generator's own: each one from generateCourse and routed
// across the property by routeHoles, exactly as generateWorld lays them out --
// the same seed gives the same picture as the course it names. No terrain, no
// planting, no world: a nine takes a few tens of milliseconds and an eighteen
// about a tenth of a second, so pictures are made one at a time, off the
// first frame (`pictureQueue`), and kept by settings (`layoutFor`).
//
// Drawn like the round's map (renderer.js drawMap) and in the same colours:
// the biome's rough as the ground, `mapTurf` for semi-rough, fairway and green,
// ponds and bunkers in the map's own blue and sand, the tees as dots.

import {generateCourse, DEFAULT_COURSE, random, BIOMES, fairwayWidth, greenRadius, ovalRadius} from './course.js';
import {routeHoles} from './routing.js';

const TAU = Math.PI * 2;

// The holes of a course, routed. Pure (no DOM).
export function courseLayout(settings = {}) {
 const s = {...DEFAULT_COURSE, ...settings, courseYards: settings.courseYards ?? (settings.holes === 18 ? 6480 : 3240)};
 s.holes = s.holes === 18 ? 18 : s.holes === 1 ? 1 : 9;
 const holes = Array.from({length: s.holes}, (_, i) => generateCourse(s, i));
 routeHoles(holes, s, random);
 // The box every tee, fairway and green falls in.
 let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
 const grow = p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); };
 for (const h of holes) for (let z = 0; z <= h.length; z += 20) grow(h.toWorld({x: h.center(z), z}));
 for (const h of holes) grow(h.toWorld(h.green ?? h.pin));
 return {settings: s, holes, bounds: {minX, maxX, minZ, maxZ}};
}

const cache = new Map();
const keyOf = s => JSON.stringify([s.seed, s.biome, s.holes, s.courseYards, s.footprint, s.spacing, s.doglegs, s.fairwayWidth, s.par3s]);
// Kept by settings, so a list drawn twice routes each course once.
export function layoutFor(settings) {
 const k = keyOf({...DEFAULT_COURSE, ...settings});
 if (!cache.has(k)) { if (cache.size > 60) cache.delete(cache.keys().next().value); cache.set(k, courseLayout(settings)); }
 return cache.get(k);
}

// Where the layout sits on a canvas of w x h: turned a quarter if that fills
// it better, centred, with a margin. Pure.
export function fitLayout(bounds, w, h, pad = 0.08) {
 const bw = Math.max(1, bounds.maxX - bounds.minX), bh = Math.max(1, bounds.maxZ - bounds.minZ);
 const turn = (bw >= bh) !== (w >= h);
 const lw = turn ? bh : bw, lh = turn ? bw : bh;
 const scale = Math.min(w * (1 - 2 * pad) / lw, h * (1 - 2 * pad) / lh);
 const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
 const at = p => turn
  ? [w / 2 + (p.z - cz) * scale, h / 2 + (p.x - cx) * scale]
  : [w / 2 + (p.x - cx) * scale, h / 2 - (p.z - cz) * scale];
 return {scale, turn, at};
}

// Draws the picture on a 2D context of w x h.
export function drawCoursePicture(ctx, layout, w, h) {
 const bio = BIOMES[layout.settings.biome] || BIOMES.pnw, turf = bio.mapTurf || {};
 const {scale, at} = fitLayout(layout.bounds, w, h);
 ctx.fillStyle = bio.mapGround ?? bio.rough ?? '#7a9d44';
 ctx.fillRect(0, 0, w, h);
 ctx.lineJoin = 'round'; ctx.lineCap = 'round';
 const outline = (h0, margin) => {
  const mow = h0.mowStart ?? h0.fairwayStart ?? 0, pts = [];
  for (const side of [1, -1]) for (let i = 0; i <= 24; i++) {
   const t = side === 1 ? i / 24 : 1 - i / 24, z = mow - margin + (h0.length + 8 - mow + 2 * margin) * t;
   pts.push(at(h0.toWorld({x: h0.center(z) + side * fairwayWidth(h0, z, margin, side), z})));
  }
  return pts;
 };
 const fill = (pts, colour) => { ctx.fillStyle = colour; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); };
 const oval = (h0, o, colour) => fill(Array.from({length: 24}, (_, i) => { const v = ovalRadius(o, i / 24 * TAU); return at(h0.toWorld({x: o.x + v.x, z: o.z + v.z})); }), colour);
 for (const h0 of layout.holes) fill(outline(h0, layout.settings.semiRough ?? 6), turf.semi ?? '#a1b481');
 for (const h0 of layout.holes) fill(outline(h0, 0), turf.fairway ?? '#608449');
 // A small picture still reads as golf holes: every hole's line is stroked at
 // least a few pixels wide over its true shape, tee to green.
 ctx.strokeStyle = turf.fairway ?? '#608449'; ctx.lineWidth = Math.max(3.5, 30 * scale);
 for (const h0 of layout.holes) {
  ctx.beginPath();
  for (let z = 0; z <= h0.length; z += 12) { const p = at(h0.toWorld({x: h0.center(z), z})); z ? ctx.lineTo(...p) : ctx.moveTo(...p); }
  ctx.stroke();
 }
 for (const h0 of layout.holes) {
  for (const p of h0.ponds || []) oval(h0, p, '#70a6aa');
  for (const b of h0.bunkers || []) oval(h0, b, '#efe0b9');
  const c = h0.green ?? h0.pin;
  fill(Array.from({length: 24}, (_, i) => { const a = i / 24 * TAU, r = greenRadius(h0, a); return at(h0.toWorld({x: c.x + Math.cos(a) * r * (h0.greenAspect ?? 1), z: c.z + Math.sin(a) * r})); }), turf.green ?? '#b3cc86');
  const [tx, ty] = at(h0.toWorld(h0.tee));
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.2, 3.5 * scale), 0, TAU); ctx.fill();
 }
}

// A picture as an image URL, w x h at the device's pixel ratio. Browser only.
export function coursePictureURL(settings, w = 200, h = 120, doc = globalThis.document) {
 const r = Math.min(2, globalThis.devicePixelRatio || 1), c = doc.createElement('canvas');
 c.width = Math.round(w * r); c.height = Math.round(h * r);
 const ctx = c.getContext('2d'); ctx.scale(r, r);
 drawCoursePicture(ctx, layoutFor(settings), w, h);
 return c.toDataURL();
}

// Pictures for a list, one per frame or idle moment, so a menu opens at once
// and fills in. `items` [{el, settings}]: each el gets the picture as `--pic`
// (CSS puts it where the element's slanted shape is) and the class has-picture. A newer call cancels an older one still running.
let queueId = 0;
const urls = new Map();
export function pictureQueue(items, w = 200, h = 120) {
 const id = ++queueId, list = [...items];
 const later = globalThis.requestIdleCallback ? f => globalThis.requestIdleCallback(f, {timeout: 120}) : f => setTimeout(f, 16);
 const next = () => {
  if (id !== queueId || !list.length) return;
  const {el, settings} = list.shift();
  try {
   const k = keyOf({...DEFAULT_COURSE, ...settings}) + `|${w}x${h}`;
   if (!urls.has(k)) urls.set(k, coursePictureURL(settings, w, h));
   el.style.setProperty('--pic', `url(${urls.get(k)})`);
   el.classList.add('has-picture');
  } catch { /* a picture is decoration: a course that will not route keeps its colours */ }
  later(next);
 };
 later(next);
}
