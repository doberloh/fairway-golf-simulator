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
export function strawChannel(owners, groundCover, ex, ez, Sx, Sz) {
 for (let j = 0; j < Sz; j++) for (let i = 0; i < Sx; i++) {
  const x = ((i + .5) / Sx * 2 - 1) * ex, z = ((j + .5) / Sz * 2 - 1) * ez;
  owners[(j * Sx + i) * 4 + 1] = groundCover(x, z) === 'straw' ? 1 : 0;
 }
 return owners;
}
