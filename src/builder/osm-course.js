// A COURSE'S HOLES FROM OPENSTREETMAP, LINED UP WITH THE GROUND (the owner, 1
// November 2026: "Prefer open street map tracing with LiDAR cleanup when
// building courses. Make sure that open street maps holes actually line up
// with the holes on the real courses"). osm.js reads the map; this picks the
// course and makes its holes play where the course is:
//
// - WHICH COURSE: a club often has two or three (TPC Scottsdale's Stadium and
//   Champions, Sahalee's three nines), each a leisure=golf_course of its own
//   with holes numbered 1 to 18 -- read together, one course's hole 7
//   overwrote the other's. `osmCourses` lists them with how many numbered
//   holes lie in each; `osmHoles(feats, {within})` takes only one's. Where
//   one boundary holds two (Troon North's Monument and Pinnacle), the hole
//   lines' `golf:course:name` splits it, and `{only}` takes one name's.
// - MOVED WITH THE MAP: refining lines the map up with the LIDAR by a shift
//   (trace.js refineTrace.lastShift); the holes, drawn on the same map, move
//   with it (`shiftHoles`) -- until this day they stayed where the map was.
// - ON THEIR GREENS AND TEES: a hole line is drawn by hand, its ends near the
//   green and the back tee; `fitHoles` puts each green mark on the traced
//   green it reaches (its middle when the mark was off it or by its edge),
//   and gives each hole the tee boxes along its first stretch -- the farthest
//   its back tee, the nearest its front, the rest middle -- so a hole has the
//   tees the course has, not one point.
// Pure (no DOM); tests/osm-course.test.mjs.
import {TRACE} from '../lidar/trace.js';

// A ring's middle: the mean of its points, the closing one counted once.
const ringMiddle = ring => { const r = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring; return {x: r.reduce((s, p) => s + p[0], 0) / r.length, z: r.reduce((s, p) => s + p[1], 0) / r.length}; };
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
export const insideRing = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [bx, bz] = ring[i]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) c = !c; } return c; };

// Each leisure=golf_course way or relation as rings in local metres (a
// relation's outer ways joined end to end).
function courseRings(e, toLocal) {
 const key = p => `${p.lat},${p.lon}`, out = [];
 if (e.type === 'way' && e.geometry?.length > 3) out.push(e.geometry);
 if (e.type === 'relation') {
  const segs = (e.members || []).filter(m => m.role !== 'inner' && m.geometry?.length >= 2).map(m => [...m.geometry]);
  while (segs.length) {
   const ring = segs.shift();
   for (let grew = true; grew && key(ring[0]) !== key(ring.at(-1));) {
    grew = false;
    for (let i = 0; i < segs.length; i++) {
     const sg = segs[i], end = key(ring.at(-1));
     if (key(sg[0]) === end) ring.push(...sg.slice(1)); else if (key(sg.at(-1)) === end) ring.push(...sg.reverse().slice(1)); else continue;
     segs.splice(i, 1); grew = true; break;
    }
   }
   if (ring.length > 3 && key(ring[0]) === key(ring.at(-1))) out.push(ring);
  }
 }
 return out.map(r => r.map(p => { const q = toLocal(p.lat, p.lon); return [q.x, q.z]; }));
}

// The numbered hole lines of a feature list (osm.js osmFeatures).
const holeLines = feats => feats.lines.filter(l => l.tags.golf === 'hole' && /^\d+$/.test(l.tags.ref || ''));
// Whether a hole line belongs to a course's rings: most of its points inside.
const lineIn = (rings, pts) => pts.filter(([x, z]) => rings.some(r => insideRing(r, x, z))).length * 2 > pts.length;

// The golf courses in an Overpass answer: [{id ('way/123'), name, rings
// (outer first, largest), area (m²), holes (numbered hole lines in it)}],
// most holes first, then largest.
export function osmCourses(json, toLocal, feats) {
 const lines = holeLines(feats), out = [];
 for (const e of json?.elements || []) {
  if (e.tags?.leisure !== 'golf_course') continue;
  const rings = courseRings(e, toLocal).sort((a, b) => ringArea(b) - ringArea(a));
  if (!rings.length) continue;
  const mine = lines.filter(l => lineIn(rings, l.points)), area = rings.reduce((s, r) => s + ringArea(r), 0), club = e.tags.name || 'A golf course';
  // TWO COURSES IN ONE BOUNDARY (Troon North, 9 November 2026: one
  // leisure=golf_course round the Monument and the Pinnacle, each numbered 1
  // to 18): when its hole lines name two courses or more
  // (`golf:course:name`), each is a course of its own (`only`).
  const names = [...new Set(mine.map(l => l.tags['golf:course:name']).filter(Boolean))];
  if (names.length >= 2) {
   for (const only of names) out.push({id: `${e.type}/${e.id}:${only}`, name: `${club}: ${only}`, only, rings, area, holes: new Set(mine.filter(l => l.tags['golf:course:name'] === only).map(l => +l.tags.ref)).size});
   continue;
  }
  out.push({id: `${e.type}/${e.id}`, name: club, rings, area, holes: new Set(mine.map(l => +l.tags.ref)).size});
 }
 return out.sort((a, b) => b.holes - a.holes || b.area - a.area);
}

// The holes OpenStreetMap numbers -- each golf=hole line, tee first, green
// last, with its bends and par -- as door 2's markers ({tees: [{x, z, set}],
// aims, green, par}), by its `ref`; only those of `within` (a course's rings)
// when given. A line drawn green-first is turned round by the green nearest
// one of its ends. Returns the holes (index = number - 1) and `doubled`, the
// numbers more than one line claimed (the first kept).
export function osmHoles(feats, {within = null, only = null, codes = null, land = null, card = null} = {}) {
 const greens = feats.areas.filter(a => a.tags.golf === 'green').map(a => ringMiddle(a.rings[0]));
 const holes = [], doubled = [];
 for (const l of holeLines(feats)) {
  if (within && !lineIn(within, l.points)) continue;
  if (only && l.tags['golf:course:name'] !== only) continue;
  let pts = l.points;
  const near = p => Math.min(Infinity, ...greens.map(g => Math.hypot(g.x - p[0], g.z - p[1])));
  if (greens.length && near(pts[0]) < near(pts.at(-1))) pts = [...pts].reverse();
  const n = +l.tags.ref;
  if (n < 1 || n > 18) continue;
  if (holes[n - 1]) { doubled.push(n); continue; }
  holes[n - 1] = {tees: [{x: pts[0][0], z: pts[0][1], set: 'back'}], aims: pts.slice(1, -1).map(([x, z]) => ({x, z})), green: {x: pts.at(-1)[0], z: pts.at(-1)[1]}, par: +l.tags.par || null};
 }
 // NUMBERED GREENS (Worthington's map numbers its eighteen greens and draws
 // one hole line): a number no line gave takes its green's middle, and the
 // tee box -- numbered the same, else the likeliest -- for its tee. The
 // likeliest: one no hole has, nearest the green before (a round walks from
 // a green to the next tee), between 80 and 580 m from this green (PLACED:
 // shorter than a short par 3's back tee, longer than a long par 5's).
 const mid = ringMiddle;
 const mine = a => !within || within.some(r => insideRing(r, mid(a.rings[0]).x, mid(a.rings[0]).z));
 const numbered = feats.areas.filter(a => a.tags.golf === 'green' && /^\d+$/.test(a.tags.ref || '') && mine(a));
 const teeAreas = feats.areas.filter(a => a.tags.golf === 'tee' && mine(a)).map(a => ({...mid(a.rings[0]), ref: /^\d+$/.test(a.tags.ref || '') ? +a.tags.ref : null}));
 const taken = new Set(teeAreas.filter(t => holes.some(h => h && Math.hypot(h.tees[0].x - t.x, h.tees[0].z - t.z) < 15)));
 // The numbers to give, each its green and the green before it (hole 1's is
 // the eighteenth's: most rounds start and end by the clubhouse).
 const greenOf = n => holes[n - 1]?.green ?? (a => a ? mid(a.rings[0]) : null)(numbered.find(q => +q.tags.ref === n));
 const want = []; for (let n = 1; n <= 18; n++) if (!holes[n - 1] && greenOf(n)) want.push({n, g: greenOf(n), prev: greenOf(n === 1 ? 18 : n - 1)});
 // Each tee against each green at once (assign, below) rather than hole by
 // hole: first come took the tee nearest the green before even when it was
 // the next hole's (Worthington: seven holes of eighteen wrong against the
 // card, hole 18 581 yards for 390). A pairing costs the walk from the green
 // before (a metre is 1/150), the share of the line to the green that is not
 // mown (a hole is played down its fairway; times 3, and only past 230 m --
 // a par 3 carries rough), and 10 outside 80 to 580 m. A tee numbered for a
 // hole is that hole's. PLACED, all of it; tests/osm-course.test.mjs.
 const free = teeAreas.filter(t => !taken.has(t));
 // Along the line from a tee to a green: the share mown, and the share under
 // trees (the survey's canopy over 4 m).
 const shares = (t, g) => {
  if (!codes || !land) return {mown: 1, trees: 0};
  const {nx, nz, cell, halfX, halfZ} = land, d = Math.hypot(g.x - t.x, g.z - t.z), n = Math.max(2, Math.round(d / 5)); let m = 0, tr = 0;
  for (let s = 1; s < n; s++) { const x = t.x + (g.x - t.x) * s / n, z = t.z + (g.z - t.z) * s / n, i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); if (i < 0 || j < 0 || i >= nx || j >= nz) continue; const k = j * nx + i; if (MOWN.has(codes[k])) m++; if ((land.canopy?.[k] ?? 0) > 4) tr++; }
  return {mown: m / (n - 1), trees: tr / (n - 1)};
 };
 // THE HOLE'S FAIRWAY, where the map draws one: the fairway reaching within
 // 35 m of the green and running 100 m or more away from it. A tee stands
 // back past its far end, over the carry of rough in front of a tee (70 m,
 // PLACED: Worthington's fairway ends lay 55 to 110 m short of its card's
 // tees). A tee box is then judged by how near that point it stands (a metre
 // is 1/40) instead of by the mown share, and the hole may take a tee of its
 // own there (cost 2) when the map drew none: Worthington's map draws 25 tee
 // boxes for 18 holes, some holes none. PLACED.
 const fair = codes && land ? patches(codes, land, TRACE.indexOf('fairway'), 40) : [];
 const ends = want.map(({g}) => {
  let best = null;
  for (const f of fair) { if (f.near(g.x, g.z) > 35) continue; const far = f.farthest(g.x, g.z); if (far.d >= 100 && (!best || far.d > best.d)) best = far; }
  return best && {x: best.x + (best.x - g.x) / best.d * 70, z: best.z + (best.z - g.z) / best.d * 70};
 });
 const own = want.map((w, r) => ends[r] && {x: ends[r].x, z: ends[r].z, ref: null, made: true});
 const cols = [...free, ...own.filter(Boolean)];
 const cost = want.map(({n, g, prev}, r) => cols.map(t => {
  if (t.made) return t === own[r] ? 2 + (prev ? Math.hypot(t.x - prev.x, t.z - prev.z) / 150 : 0) : 1e6;
  if (t.ref === n) return -100;
  const d = Math.hypot(t.x - g.x, t.z - g.z), sh = shares(t, g);
  // A scorecard, when there is one, settles it: its back-tee yards for the
  // hole against the straight distance (a dogleg's card is measured round
  // the bend, so a tee nearer than the card costs less than one farther).
  const yd = card?.blue?.[n - 1];
  if (yd) { const want = yd * .9144, e = d > want ? 1.5 * (d - want) / want : (want - d) / want; return 10 * e + (prev ? Math.hypot(t.x - prev.x, t.z - prev.z) / 400 : 0); }
  return (d < 80 || d > 580 ? 10 : 0) + (prev ? Math.hypot(t.x - prev.x, t.z - prev.z) / 150 : 0) + 4 * sh.trees
   + (ends[r] ? Math.hypot(t.x - ends[r].x, t.z - ends[r].z) / 40 : 3 * (1 - sh.mown) * (d > 230 ? 1 : .3));
 }));
 const pick = assign(cost), fromGreens = [];
 want.forEach(({n, g}, r) => {
  const t = cols[pick[r]]; if (!t) return;
  const a = numbered.find(q => +q.tags.ref === n);
  holes[n - 1] = {tees: [{x: t.x, z: t.z, set: 'back'}], aims: [], green: g, par: +a?.tags.par || null, guessed: true};
  fromGreens.push(n);
 });
 holes.doubled = doubled; holes.fromGreens = fromGreens;
 return holes;
}
const MOWN = new Set(['fairway', 'green', 'tee', 'semi'].map(k => TRACE.indexOf(k)));

// The cheapest way to give each row a column of its own (rows no more than
// columns; the Hungarian method): returns the column of each row, -1 where
// there are too few.
export function assign(cost) {
 const n = cost.length, m = cost[0]?.length ?? 0;
 if (!n || !m) return cost.map(() => -1);
 if (n > m) { const t = assign(cost[0].map((_, j) => cost.map(r => r[j]))), out = cost.map(() => -1); t.forEach((r, j) => { if (r >= 0) out[r] = j; }); return out; }
 const INF = 1e18, u = new Float64Array(n + 1), v = new Float64Array(m + 1), p = new Int32Array(m + 1), way = new Int32Array(m + 1);
 for (let i = 1; i <= n; i++) {
  p[0] = i; let j0 = 0; const minv = new Float64Array(m + 1).fill(INF), used = new Uint8Array(m + 1);
  do {
   used[j0] = 1; const i0 = p[j0]; let delta = INF, j1 = 0;
   for (let j = 1; j <= m; j++) if (!used[j]) { const c = cost[i0 - 1][j - 1] - u[i0] - v[j]; if (c < minv[j]) { minv[j] = c; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } }
   for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
   j0 = j1;
  } while (p[j0] !== 0);
  do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
 }
 const out = new Array(n).fill(-1); for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
 return out;
}

// Holes moved by the map's shift (metres).
export const shiftHoles = (holes, {x = 0, z = 0} = {}) => holes.map(h => h && {...h, tees: h.tees.map(t => ({...t, x: t.x + x, z: t.z + z})), aims: h.aims.map(a => ({x: a.x + x, z: a.z + z})), green: {x: h.green.x + x, z: h.green.z + z}});

// The connected patches of one code on the trace (`codes`, TRACE's codes on
// `land`'s grid): [{cells, x, z (middle), near(x, z) -> metres to its nearest
// cell, has(x, z), farthest(x, z)}]. Patches under `minCells` are left out.
function patches(codes, land, code, minCells = 4) {
 const {nx, nz, cell, halfX, halfZ} = land, N = nx * nz, seen = new Uint8Array(N), out = [];
 for (let s = 0; s < N; s++) {
  if (seen[s] || codes[s] !== code) continue;
  const list = [s]; seen[s] = 1;
  for (let q = 0; q < list.length; q++) { const k = list[q], i = k % nx; for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (n >= 0 && n < N && !seen[n] && codes[n] === code) { seen[n] = 1; list.push(n); } }
  if (list.length < minCells) continue;
  let sx = 0, sz = 0; for (const k of list) { sx += k % nx; sz += Math.floor(k / nx); }
  const ci = sx / list.length, cj = sz / list.length;
  // Its middle: the cell nearest the mean (a kidney's mean can fall off it).
  let mid = list[0], md = Infinity; for (const k of list) { const d = (k % nx - ci) ** 2 + (Math.floor(k / nx) - cj) ** 2; if (d < md) { md = d; mid = k; } }
  const set = new Set(list), at = (x, z) => Math.round((z + halfZ) / cell) * nx + Math.round((x + halfX) / cell);
  const pts = list.filter((_, q) => q % Math.max(1, Math.floor(list.length / 400)) === 0).map(k => [-halfX + (k % nx) * cell, -halfZ + Math.floor(k / nx) * cell]);
  out.push({cells: list.length, x: -halfX + (mid % nx) * cell, z: -halfZ + Math.floor(mid / nx) * cell, has: (x, z) => set.has(at(x, z)), near: (x, z) => set.has(at(x, z)) ? 0 : Math.min(...pts.map(([px, pz]) => Math.hypot(px - x, pz - z))),
   // Its point farthest from (x, z): {x, z, d}.
   farthest: (x, z) => pts.reduce((b, [px, pz]) => { const d = Math.hypot(px - x, pz - z); return d > b.d ? {x: px, z: pz, d} : b; }, {x, z, d: 0})});
 }
 return out;
}

// Where along a polyline a point lies: {along (metres from its start), off
// (metres from it)}.
function along(pts, x, z) {
 let best = {along: 0, off: Infinity}, run = 0;
 for (let i = 1; i < pts.length; i++) {
  const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (L * L))), off = Math.hypot(ax + dx * t - x, az + dz * t - z);
  if (off < best.off) best = {along: run + t * L, off};
  run += L;
 }
 return best;
}
const lineOf = h => [[h.tees[0].x, h.tees[0].z], ...h.aims.map(a => [a.x, a.z]), [h.green.x, h.green.z]];
const lengthOf = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);

// THE HOLES ON THE GROUND: each green mark on the traced green it reaches
// within `reach` metres, each hole given the tee boxes along its first
// stretch. PLACED: a green mark is moved to its green's middle when it was off
// the green or within 3 m of its edge; a tee box is a hole's when its middle
// lies within 25 m of the hole's line, no farther along it than 60% of the
// hole (forward tees stand well up the fairway) and no more than 40 m behind
// its start, and that hole's line passes nearest it. Returns the holes (new
// objects) with a `fit` note each: {green: 'on'|'moved'|'none', moved (m),
// tees: n}.
export function fitHoles(holes, codes, land, {reach = 25} = {}) {
 const G = patches(codes, land, TRACE.indexOf('green')), T = patches(codes, land, TRACE.indexOf('tee'));
 const lines = holes.map(h => h && lineOf(h));
 // Each tee box to the one hole it belongs to.
 const teesOf = holes.map(() => []);
 // A hole's line run BACK_REACH metres behind its tee, the way it is played,
 // so a back tee behind the one the map gave is found (a numbered green's tee
 // is often its nearest box to the green before, a forward one).
 // Only a guessed tee (a numbered green's) looks that far; a hole line is
 // drawn from its back tee, so it looks 40 m (Sahalee's hole 2 took another
 // hole's box 150 m back: 665 yards).
 const BACK_REACH = 150, reachOf = h => h?.guessed ? 150 : 40;
 const backed = lines.map(p => { if (!p) return p; const [ax, az] = p[0], [bx, bz] = p[1], l = Math.hypot(bx - ax, bz - az) || 1; return [[ax - (bx - ax) / l * BACK_REACH, az - (bz - az) / l * BACK_REACH], ...p]; });
 for (const t of T) {
  let best = -1, bo = Infinity;
  holes.forEach((h, i) => { if (!h) return; const L = lengthOf(lines[i]), a = along(backed[i], t.x, t.z), at = a.along - BACK_REACH, lim = at < 0 ? 15 : 25; if (a.off < lim && at >= -reachOf(h) && at <= .6 * L && a.off < bo) { bo = a.off; best = i; } });
  if (best >= 0) teesOf[best].push(t);
 }
 return holes.map((h, i) => {
  if (!h) return h;
  const out = {...h, tees: h.tees.map(t => ({...t})), aims: h.aims.map(a => ({...a})), green: {...h.green}, fit: {green: 'none', moved: 0, tees: 0}};
  const g = G.map(p => ({p, d: p.near(h.green.x, h.green.z)})).filter(o => o.d <= reach).sort((a, b) => a.d - b.d)[0]?.p;
  if (g) {
   const on = g.has(h.green.x, h.green.z), edge = on && [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dz]) => !g.has(h.green.x + dx, h.green.z + dz));
   if (!on || edge) { out.fit.moved = Math.hypot(g.x - h.green.x, g.z - h.green.z); out.green = {x: g.x, z: g.z}; out.fit.green = 'moved'; } else out.fit.green = 'on';
  }
  // No tee box that makes the hole longer than its par allows (PLACED: par 3
  // to 250 yards, par 4 to 500, par 5 to 640 -- straight to the green).
  const cap = {3: 250, 4: 500, 5: 640}[h.par] ?? 640;
  const boxes = teesOf[i].filter(t => Math.hypot(t.x - out.green.x, t.z - out.green.z) / .9144 <= cap).sort((a, b) => Math.hypot(b.x - out.green.x, b.z - out.green.z) - Math.hypot(a.x - out.green.x, a.z - out.green.z));
  if (boxes.length) {
   out.tees = boxes.map((t, k) => ({x: t.x, z: t.z, set: k === 0 ? 'back' : k === boxes.length - 1 ? 'front' : 'middle'}));
   out.fit.tees = boxes.length;
  }
  return out;
 });
}
