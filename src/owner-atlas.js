// WHICH HOLE OWNS EACH PATCH OF GROUND, as the ground shader reads it -- the
// size of that atlas and the questions each texel asks, in one place, because
// two threads now fill it (B2c in TODO): the generation workers compute the
// expensive channels while the course is still being planted, and the main
// thread fills the rest when it builds the ground material. Kept free of three
// so the worker can carry it. See the long note on the atlas in ground.js.
export const OWNER_TEXEL = 1.75, OWNER_MAX = 1 << 20;
export function ownerAtlasSize(ex, ez) {
 let Sx = Math.max(256, Math.ceil(ex * 2 / OWNER_TEXEL)), Sz = Math.max(256, Math.ceil(ez * 2 / OWNER_TEXEL));
 if (Sx * Sz > OWNER_MAX) {const k = Math.sqrt(OWNER_MAX / (Sx * Sz)); Sx = Math.max(256, Math.round(Sx * k)); Sz = Math.max(256, Math.round(Sz * k));}
 return {Sx, Sz};
}
// Rows j0..j1-1: channel 0 the owning hole, 2 the stream's id + 1, 3 whether a
// large lake owns it. Channel 1 (straw) needs the finished world and is filled
// by `strawChannel`. Each texel asks in the order it always did -- the lake,
// then the nearest hole, once -- so a serial pass is the pass it replaced.
export function ownerRows(q, ex, ez, Sx, Sz, j0, j1) {
 const out = new Float32Array((j1 - j0) * Sx * 4);
 for (let j = j0; j < j1; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez, k = ((j - j0) * Sx + i) * 4;
  const lake = q.lakeOwner(x, z, 7);
  out[k] = (lake || q.nearest(x, z).h).hole;
  out[k + 2] = (q.streamAt(x, z)?.id ?? -1) + 1;
  out[k + 3] = lake ? 1 : 0;
 }
 return out;
}
// A BUILT COURSE'S MOWN TURF HAS ONE OWNER A PIECE (the owner, 23 November
// 2026: fairway stripes on a built course "broken", bands meeting in chevrons
// and torn, with stepped seams). The atlas gives each texel its nearest hole,
// and a fairway's bands run along its owner's line (ground.js, A FAIRWAY'S
// BANDS IN THE WORLD) -- so where a traced fairway ran nearer another hole's
// line than its own, part of it was mown at that hole's angle, and the two
// met along the atlas's texel staircase (1.75 m steps). A generated fairway
// is cut from its own hole's corridor and never crosses that boundary; a
// traced one does wherever two holes run close (Troon North: 257 seam cells
// of 2 m, at twelve places; Alpine Lake: 67, at three).
//
// So, for a built course only: every connected piece of fairway, of green
// with its fringe, and of tee is given ONE hole -- a green the hole whose pin
// is on it, a tee the hole whose tee is on it, otherwise the hole that owned
// most of the piece -- and that hole is carried `grow` texels out into the
// unmown ground round it, so the shader's resolve at an owner boundary
// (ground.js, OWNERSHIP, RESOLVED WHERE IT MATTERS) happens in the rough,
// where nothing is drawn by the owner's line. Paint only: the lie reads the
// built field, never this atlas. Two holes' fairways joined into one piece
// are mown as one, in the larger share's direction, as a shared fairway is.
//
// `kindAt(x, z)`: 0 unmown, 1 fairway, 2 green or fringe, 3 tee (the built
// field's order: green before tee before fairway). `anchors`: [{hole, x, z,
// kind}], the pins (kind 2) and tees (kind 3). Mutates channel 0 of `owners`
// and returns how many texels changed hole.
export function builtMowOwners(owners, Sx, Sz, ex, ez, kindAt, anchors = [], grow = 2) {
 const N = Sx * Sz, kind = new Uint8Array(N), piece = new Int32Array(N).fill(-1);
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) kind[j * Sx + i] = kindAt(((i + .5) / Sx * 2 - 1) * ex, ((j + .5) / Sz * 2 - 1) * ez);
 const texelOf = (x, z) => { const i = Math.floor((x / ex + 1) * .5 * Sx), j = Math.floor((z / ez + 1) * .5 * Sz); return i >= 0 && j >= 0 && i < Sx && j < Sz ? j * Sx + i : -1; };
 const anchorAt = new Map();
 for (const a of anchors) { const k = texelOf(a.x, a.z); if (k >= 0 && kind[k] === a.kind && !anchorAt.has(k)) anchorAt.set(k, a.hole); }
 const stack = new Int32Array(N), label = [];
 let pieces = 0, changed = 0;
 for (let s = 0; s < N; s++) {
  if (!kind[s] || piece[s] >= 0) continue;
  // One piece: flood the texels of this kind joined edge to edge.
  const members = [], votes = new Map(), k0 = kind[s];
  let top = 0, anchor;
  stack[top++] = s; piece[s] = pieces;
  while (top) {
   const k = stack[--top]; members.push(k);
   const h = owners[k * 4]; votes.set(h, (votes.get(h) ?? 0) + 1);
   if (anchor === undefined && anchorAt.has(k)) anchor = anchorAt.get(k);
   const i = k % Sx;
   for (const n of [i > 0 ? k - 1 : -1, i < Sx - 1 ? k + 1 : -1, k >= Sx ? k - Sx : -1, k < N - Sx ? k + Sx : -1])
    if (n >= 0 && kind[n] === k0 && piece[n] < 0) { piece[n] = pieces; stack[top++] = n; }
  }
  let best = anchor;
  if (best === undefined) { let most = -1; for (const [h, c] of votes) if (c > most || (c === most && h < best)) { most = c; best = h; } }
  label.push(best);
  for (const k of members) if (owners[k * 4] !== best) { owners[k * 4] = best; changed++; }
  pieces++;
 }
 // Out into the unmown ground, nearest piece first, `grow` texels.
 let front = [];
 for (let k = 0; k < N; k++) if (piece[k] >= 0) front.push(k);
 for (let step = 0; step < grow && front.length; step++) {
  const next = [];
  for (const k of front) {
   const i = k % Sx;
   for (const n of [i > 0 ? k - 1 : -1, i < Sx - 1 ? k + 1 : -1, k >= Sx ? k - Sx : -1, k < N - Sx ? k + Sx : -1]) {
    if (n < 0 || piece[n] >= 0 || owners[n * 4 + 3] > .5) continue;
    piece[n] = piece[k]; next.push(n);
    const h = label[piece[k]]; if (owners[n * 4] !== h) { owners[n * 4] = h; changed++; }
   }
  }
  front = next;
 }
 return changed;
}
export function strawChannel(owners, groundCover, ex, ez, Sx, Sz) {
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez;
  owners[(j * Sx + i) * 4 + 1] = groundCover(x, z) === 'straw' ? 1 : 0;
 }
 return owners;
}
