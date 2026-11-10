// CHECKING THE MAP, NOT TRUSTING IT (the builder-ux goal, item 24; the owner,
// 10 November 2026: "We will need to come up with a solution for incomplete
// OSM data", and "The OSM data for worthington is completely wrong. Many
// holes pointing to the wrong place"). OpenStreetMap's holes come with a
// number, a line from tee to green and a par; mappers leave some out and
// draw some wrong. These checks read the holes door 2 marked from the map
// against the course traced under them, and say what looks wrong, where, and
// the fix that suits it -- for the player to take or leave. Pure; no DOM;
// tests/builder-map-checks.test.mjs.
//
// Every threshold is PLACED (10 November 2026), for the owner to overrule.
export const LIMITS = {
 onGreen: 15,      // a green mark further than this (m) from any green
 onTee: 20,        // a tee mark further than this (m) from any tee
 shared: 12,       // two holes' greens nearer than this (m) share one
 walk: 350,        // a tee further than this (m) from the last hole's green
 // Yards a par is played over, from the back tee (the USGA's guidance for men
 // is par 3 to 260, par 4 240-490, par 5 450-710; widened a little either side).
 par: {3: [70, 290], 4: [220, 520], 5: [400, 720], 6: [580, 900]},
 unreliable: .5,   // a map is unreliable when this share of its holes has a doubt
 onPlay: .4,       // a hole longer than par 3's whose line's middle runs on fairway or semi less than this
 crossEnds: .12,   // two holes' lines crossing, away from their ends by this share of each
};
const YD = .9144;
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The pieces of one surface as blobs: [{x, z, cells, r}] (centre, size in
// cells, a radius of the same area). `mask` a cell grid (1 where the surface is).
export function blobs(mask, {nx, nz, cell, halfX, halfZ}, {min = 4} = {}) {
 const seen = new Uint8Array(nx * nz), out = [], stack = [];
 for (let k0 = 0; k0 < nx * nz; k0++) {
  if (!mask[k0] || seen[k0]) continue;
  let n = 0, sx = 0, sz = 0; stack.push(k0); seen[k0] = 1;
  while (stack.length) {
   const k = stack.pop(), i = k % nx, j = (k - i) / nx; n++; sx += i; sz += j;
   for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const q = b * nx + a; if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); } }
  }
  if (n >= min) out.push({x: -halfX + sx / n * cell, z: -halfZ + sz / n * cell, cells: n, r: Math.sqrt(n / Math.PI) * cell});
 }
 return out;
}
const nearest = (list, p) => list.reduce((best, b) => { const dd = Math.max(0, d(b, p) - b.r); return !best || dd < best.d ? {b, d: dd} : best; }, null);
// The line a hole is played along: back tee, aim points, green.
const lineOf = h => { const back = h.tees.find(t => t.set === 'back') ?? h.tees[0]; return [...(back ? [back] : []), ...(h.aims ?? []), ...(h.green ? [h.green] : [])]; };
const lengthOf = h => { const L = lineOf(h); let s = 0; for (let i = 1; i < L.length; i++) s += d(L[i - 1], L[i]); return s; };
const inRing = (ring, p) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > p.z) !== (zj > p.z) && p.x < (xj - xi) * (p.z - zi) / (zj - zi) + xi) c = !c; } return c; };

// The doubts about the holes: [{hole, kind, text, at: {x, z}, fix?: {kind, to}}],
// hole 0-based. `greens`, `tees`: blobs(); `boundary`: a ring or null; `card`:
// [{par, yards}] the player typed, or null.
// `played(x, z)`: whether that spot is fairway or semi-rough (the traced
// course), for the line that runs off the fairways.
export function checkHoles(holes, {greens = [], tees = [], boundary = null, card = null, played = null, limits = LIMITS} = {}) {
 const out = [], claimed = new Map();
 holes.forEach((h, n) => {
  const no = `Hole ${n + 1}`;
  if (!h || !h.green) { out.push({hole: n, kind: 'noGreen', text: `${no} has no green on the map: click where it is.`, at: h?.tees?.[0] ?? null}); }
  if (!h || !h.tees?.length) { out.push({hole: n, kind: 'noTee', text: `${no} has no tee on the map: click where it is.`, at: h?.green ?? null}); }
  if (!h) return;
  if (h.green && greens.length) {
   const g = nearest(greens, h.green);
   if (g.d > limits.onGreen) out.push({hole: n, kind: 'greenOff', text: `${no}'s green mark is ${Math.round(g.d)} m from any green.`, at: h.green, fix: {kind: 'green', to: {x: g.b.x, z: g.b.z}, text: 'Move it to the nearest green'}});
   else claimed.set(n, g.b);
  }
  for (const t of h.tees ?? []) {
   if (!tees.length) break;
   const q = nearest(tees, t);
   if (q.d > limits.onTee) { out.push({hole: n, kind: 'teeOff', text: `${no}'s ${t.set} tee is ${Math.round(q.d)} m from any tee.`, at: t, fix: {kind: 'tee', set: t.set, to: {x: q.b.x, z: q.b.z}, text: 'Move it to the nearest tee'}}); }
  }
  if (h.green && h.tees?.length) {
   const yd = lengthOf(h) / YD, par = h.par ?? null, span = par ? limits.par[par] : null;
   if (span && (yd < span[0] || yd > span[1])) out.push({hole: n, kind: 'length', text: `${no} measures ${Math.round(yd)} yards: long for a par ${par}`.replace('long', yd < span[0] ? 'short' : 'long') + '.', at: h.green});
   const want = card?.[n]?.yards;
   if (want && Math.abs(yd - want) > Math.max(40, want * .12)) out.push({hole: n, kind: 'card', text: `${no} measures ${Math.round(yd)} yards; the card says ${Math.round(want)}.`, at: h.green});
   if (boundary && lineOf(h).some(p => !inRing(boundary, p))) out.push({hole: n, kind: 'outside', text: `${no}'s line leaves the course boundary.`, at: h.green});
   // A line POINTING THE WRONG WAY runs across the rough, not down a fairway:
   // the middle of the line (its first and last fifth left out: tee and green
   // surrounds), sampled every 4 m.
   if (played && (h.par ?? 4) >= 4) {
    const L = lineOf(h), on = [], len = lengthOf(h);
    let walked = 0;
    for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], seg = d(a, b); for (let s = 0; s < seg; s += 4) { const at = walked + s; if (at > len * .2 && at < len * .8) on.push(played(a.x + (b.x - a.x) * s / seg, a.z + (b.z - a.z) * s / seg)); } walked += seg; }
    const share = on.length ? on.filter(Boolean).length / on.length : 1;
    if (on.length >= 5 && share < limits.onPlay) {
     out.push({hole: n, kind: 'offPlay', text: `${no}'s line runs mostly off the fairways (${Math.round(share * 100)}% on): it may point to the wrong green or come from the wrong tee.`, at: L[Math.floor(L.length / 2)] ?? h.green});
    }
   }
  }
 });
 // Two holes on one green.
 for (const [a, ga] of claimed) for (const [b, gb] of claimed) if (a < b && ga === gb && holes[a].green && holes[b].green && d(holes[a].green, holes[b].green) < Math.max(limits.shared, ga.r)) out.push({hole: b, other: a, kind: 'shared', text: `Holes ${a + 1} and ${b + 1} finish on the same green.`, at: holes[b].green});
 // Two holes' lines crossing, away from their ends: one of them is likely wrong.
 const cross = (a, b, c, e) => { const den = (b.x - a.x) * (e.z - c.z) - (b.z - a.z) * (e.x - c.x); if (!den) return null; const t = ((c.x - a.x) * (e.z - c.z) - (c.z - a.z) * (e.x - c.x)) / den, u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / den; return t > 0 && t < 1 && u > 0 && u < 1 ? {t, u, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t} : null; };
 const ends = limits.crossEnds;
 for (let a = 0; a < holes.length; a++) for (let b = a + 1; b < holes.length; b++) {
  const A = holes[a]?.green && holes[a].tees?.length ? lineOf(holes[a]) : null, B = holes[b]?.green && holes[b].tees?.length ? lineOf(holes[b]) : null;
  if (!A || !B) continue;
  let hit = null;
  for (let i = 1; i < A.length && !hit; i++) for (let j = 1; j < B.length && !hit; j++) { const q = cross(A[i - 1], A[i], B[j - 1], B[j]); if (q && (A.length > 2 || (q.t > ends && q.t < 1 - ends)) && (B.length > 2 || (q.u > ends && q.u < 1 - ends))) hit = q; }
  if (hit) out.push({hole: b, other: a, kind: 'crossing', text: `Holes ${a + 1} and ${b + 1} cross each other: one of them may point the wrong way.`, at: {x: hit.x, z: hit.z}});
 }
 // Playing order: each tee near the last green.
 for (let n = 1; n < holes.length; n++) {
  const prev = holes[n - 1]?.green, h = holes[n], back = h?.tees?.find(t => t.set === 'back') ?? h?.tees?.[0];
  if (prev && back && d(prev, back) > limits.walk) out.push({hole: n, kind: 'order', text: `Hole ${n + 1} starts ${Math.round(d(prev, back))} m from hole ${n}'s green: the map's numbers may be out of order.`, at: back});
 }
 // THE FIX FOR A HOLE POINTING THE WRONG WAY (off the fairways, sharing a
 // green, crossing another): the line from its tee to each green, and to its
 // green from each tee, at a length a par 3 to 5 is played over, scored by how
 // much of its middle runs on fairway; offered when clearly better than the
 // line it has (at least 60% on, and a quarter more than now). For two lines
 // crossing, both holes are tried and the better fix is offered.
 if (played) {
  const spanYd = [limits.par[3][0], limits.par[5][1]];
  const run = (a, b) => { const len = d(a, b), yd = len / YD; if (yd < spanYd[0] || yd > spanYd[1]) return -1; let k = 0, m = 0; for (let t = len * .2; t < len * .8; t += 4) { m++; if (played(a.x + (b.x - a.x) * t / len, a.z + (b.z - a.z) * t / len)) k++; } return m >= 5 ? k / m : -1; };
  // A green another hole finishes on is not offered (two holes on one green
  // was a fix that made new doubts, on Worthington).
  const owner = new Map();
  holes.forEach((h, n) => { if (!h?.green || !greens.length) return; const g = nearest(greens, h.green); if (g.d <= limits.onGreen) owner.set(g.b, [...(owner.get(g.b) ?? []), n]); });
  const better = (h, n) => {
   if (!h?.green || !h.tees?.length) return null;
   const back = h.tees.find(t => t.set === 'back') ?? h.tees[0], now = Math.max(0, run(back, h.green)), floor = Math.max(.6, now + .25);
   let best = null;
   for (const g of greens) { if ((owner.get(g) ?? []).some(m => m !== n)) continue; const r = run(back, g); if (r >= floor && r > (best?.r ?? 0)) best = {r, gain: r - now, fix: {kind: 'green', to: {x: g.x, z: g.z}, text: 'Aim it at the green down the fairway'}}; }
   for (const t of tees) { const r = run(t, h.green); if (r >= floor && r > (best?.r ?? 0)) best = {r, gain: r - now, fix: {kind: 'tee', set: back.set, to: {x: t.x, z: t.z}, text: 'Start it from the tee up the fairway'}}; }
   return best;
  };
  const tried = new Map(), bestOf = n => { if (!tried.has(n)) tried.set(n, better(holes[n], n)); return tried.get(n); };
  for (const q of out) {
   if (q.fix || !['offPlay', 'shared', 'crossing'].includes(q.kind)) continue;
   let pick = null;
   for (const n of q.other != null ? [q.hole, q.other] : [q.hole]) { const b = bestOf(n); if (b && (!pick || b.gain > pick.gain)) pick = {...b, n}; }
   if (pick) { q.hole = pick.n; q.fix = pick.fix; q.text += ` For hole ${pick.n + 1}, a line ${Math.round(pick.r * 100)}% on the fairway is offered.`; }
  }
 }
 return out.sort((a, b) => a.hole - b.hole);
}

// The map as a whole: is it worth starting from? {holes, doubtful, share,
// unreliable, words}.
export function mapVerdict(holes, doubts, {limits = LIMITS} = {}) {
 const n = holes.length, doubtful = new Set(doubts.map(q => q.hole)).size, share = n ? doubtful / n : 1;
 const words = !n ? 'The map numbers no holes here.' : !doubtful ? `The map's ${n} holes all check out.` : `${doubtful} of the map's ${n} holes ${doubtful === 1 ? 'has' : 'have'} something to check.${share >= limits.unreliable ? ' The map is unreliable here: check every hole against the picture.' : ''}`;
 return {holes: n, doubtful, share, unreliable: share >= limits.unreliable, words};
}

// What the map holds against what a course of `holesN` needs:
// [{what, have, want}] for the checklist (the owner: incomplete data).
export function mapHas(laid = {}, holes = [], holesN = 18) {
 const marked = holes.slice(0, holesN), with_ = f => marked.filter(f).length;
 return [
  {what: 'holes numbered', have: with_(Boolean), want: holesN},
  {what: 'holes with a green', have: with_(h => h?.green), want: holesN},
  {what: 'holes with a tee', have: with_(h => h?.tees?.length), want: holesN},
  {what: 'greens drawn', have: laid.green ?? 0, want: holesN},
  {what: 'tees drawn', have: laid.tee ?? 0, want: holesN},
  {what: 'fairways drawn', have: laid.fairway ?? 0, want: Math.round(holesN * 14 / 18)},
  {what: 'bunkers drawn', have: laid.sand ?? 0, want: null},
 ];
}
