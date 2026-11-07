import test from 'node:test';
import assert from 'node:assert/strict';
import {project, inset, shapePath, landscapeAt, landscapeAtPoint, MAP_W, MAP_H} from '../src/landscape-map.js';
import {US_SHAPES} from '../src/us-map-data.js';
import {LANDSCAPES} from '../src/regions.js';
import {globeSvg, clipRing} from '../src/globe.js';

test('the projection puts the USA on the picture, Alaska and Hawaii in their insets', () => {
 for (const [k, l] of Object.entries(LANDSCAPES)) {
  if (!l.us) continue;
  const [x, y] = project(...l.where);
  assert.ok(x > 0 && x < MAP_W && y > 0 && y < MAP_H, `${k} at ${x}, ${y}`);
 }
 assert.equal(inset(61.2, -149.9), 'alaska');
 assert.equal(inset(52, 178), 'alaska', 'the Aleutians past 180');
 assert.equal(inset(21.3, -157.8), 'hawaii');
 assert.equal(inset(25.8, -81.7), 'lower48');
 // West is left and north is up.
 const [sx] = project(47.6, -122.3), [bx] = project(42.4, -71.1);
 assert.ok(sx < bx);
 const [, my] = project(45, -93), [, ny] = project(30, -90);
 assert.ok(my < ny);
});

test('a reference course for each landscape finds its landscape on the map', () => {
 const at = {
  puget: [47.2, -122.57], monterey: [36.57, -121.95], sonoran: [33.64, -111.91], rockies: [43.59, -110.82],
  parkland: [41.93, -91.66], keys: [24.56, -81.77], lakedunes: [44.5, -86.23],
  hawaii: [20.65, -156.44], alaska: [61.18, -149.86], lowgulf: [32.61, -80.02], redrock: [34.86, -111.8],
  palms: [33.72, -116.37], southpines: [39.85, -74.68], sandhills: [41.65, -101.0],
 };
 for (const [k, [lat, lon]] of Object.entries(at)) assert.equal(landscapeAt(US_SHAPES, lat, lon), k, `${k} at ${lat}, ${lon}`);
 // Every landscape's own place is inside its own shape or nearest it.
 let own = 0;
 for (const [k, l] of Object.entries(LANDSCAPES)) if (l.us && landscapeAt(US_SHAPES, ...l.where) === k) own++;
 const us = Object.values(LANDSCAPES).filter(l => l.us).length;
 assert.ok(own >= us - 1, `${own} of ${us} landscapes find themselves at their own place`);
 // Far out at sea, or abroad, is nowhere.
 assert.equal(landscapeAt(US_SHAPES, 35, -40), null);
 assert.equal(landscapeAt(US_SHAPES, 56.3, -2.8), null);
});

test('an overlay wins over the shape under it, and a click off the map is nothing', () => {
 const [x, y] = project(36.57, -121.95);
 assert.equal(landscapeAtPoint(US_SHAPES, x, y), 'monterey');
 assert.equal(landscapeAtPoint(US_SHAPES, 5, 5), null);
 const d = shapePath(US_SHAPES[0].rings);
 assert.match(d, /^M[0-9.]+,[0-9.]+L/);
 assert.ok(d.endsWith('Z'));
});

test('the globe is an SVG with its dot, and land cut at the horizon never floods the disc', () => {
 const s = globeSvg([20.8, -156.3], {size: 48, title: 'Hawaii'});
 assert.match(s, /^<svg class="globe"[^>]*width="48"/);
 assert.match(s, /aria-label="Hawaii"/);
 assert.ok(s.endsWith('</svg>'));
 // A square of land half behind the horizon: its seen half is cut on the rim,
 // and the loop stays inside the disc.
 const ring = [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, -.5], [-.5, .5, -.5]].map(([x, y, z]) => { const n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; });
 const loops = clipRing(ring);
 assert.equal(loops.length, 1);
 for (const [x, y] of loops[0]) assert.ok(Math.hypot(x, y) <= 1 + 1e-9);
 assert.deepEqual(clipRing(ring.map(([x, y, z]) => [x, y, -Math.abs(z) - .1])), [], 'all behind: nothing');
 // Hawaii's globe is mostly sea: the land path covers well under the disc.
 const land = s.match(/<path d="([^"]+)" fill="#cfe3b4"/)[1];
 let area = 0;
 for (const part of land.split('Z').filter(Boolean)) {
  const pts = part.slice(1).split('L').map(p => p.split(',').map(Number));
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
 }
 assert.ok(Math.abs(area / 2) < Math.PI * .5, `land ${Math.abs(area / 2).toFixed(2)} of ${Math.PI.toFixed(2)}`);
});
