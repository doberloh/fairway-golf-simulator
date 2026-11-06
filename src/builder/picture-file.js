// A PICTURE IN A SAVED FILE (the owner, 5 November 2026: "the satellite pictures.
// We should save that also"). A picture door 2 holds is its pixels, 3 bytes each,
// and a function that finds a place on it. Neither goes into a file as it is: the
// pixels go as a JPEG (a tenth of the size and more; PLACED, quality .9, tracing
// needs edges rather than exact colours), and the function as what it was made
// from, `place`:
//
//   {kind: 'tiles', z, x0, y0}          fetched: Web Mercator tiles (imagery.js)
//   {kind: 'map', x0, y0, dx, dy, crs}  brought with its own position
//   {kind: 'pairs', pairs}              lined up by hand (real-course.js
//                                       `affineFromPairs` fits them again)
//
// A picture too large for a canvas is kept as its plain pixels instead, which the
// file's deflate packs as well as it can. `pack` is held on the picture once made,
// so a second save does not encode it again. Encoding and decoding need a browser;
// `tooBig` and the pixel conversions are pure (tests/builder-draft.test.mjs).

// PLACED: the browsers' canvas limits are 16,384 a side (Safari's area is about
// 268 million pixels on a desktop, less on a phone), kept well inside.
export const tooBig = (width, height) => width > 16000 || height > 16000 || width * height > 1.2e8;
const QUALITY = .9;

export function rgbaOf(rgb, width, height, into = new Uint8ClampedArray(width * height * 4)) {
 for (let k = 0, n = width * height; k < n; k++) { into[k * 4] = rgb[k * 3]; into[k * 4 + 1] = rgb[k * 3 + 1]; into[k * 4 + 2] = rgb[k * 3 + 2]; into[k * 4 + 3] = 255; }
 return into;
}
export function rgbOf(rgba, width, height) {
 const n = width * height, rgb = new Uint8Array(n * 3);
 for (let k = 0; k < n; k++) { rgb[k * 3] = rgba[k * 4]; rgb[k * 3 + 1] = rgba[k * 4 + 1]; rgb[k * 3 + 2] = rgba[k * 4 + 2]; }
 return rgb;
}

async function jpegOf({width, height, rgb}) {
 const canvas = new OffscreenCanvas(width, height), cx = canvas.getContext('2d'), image = cx.createImageData(width, height);
 rgbaOf(rgb, width, height, image.data); cx.putImageData(image, 0, 0);
 return new Uint8Array(await (await canvas.convertToBlob({type: 'image/jpeg', quality: QUALITY})).arrayBuffer());
}
async function pixelsOf(jpeg, width, height) {
 const bitmap = await createImageBitmap(new Blob([jpeg], {type: 'image/jpeg'}), {colorSpaceConversion: 'none'});
 const canvas = new OffscreenCanvas(width, height), cx = canvas.getContext('2d', {willReadFrequently: true});
 cx.drawImage(bitmap, 0, 0); bitmap.close?.();
 return rgbOf(cx.getImageData(0, 0, width, height).data, width, height);
}

// What door 2's pictures become in a draft (draft.js `pics`).
export async function packPictures(pics, {onStep = () => {}} = {}) {
 const out = [];
 for (const p of pics) {
  if (!p.pack) {
   onStep(p.label);
   const {pic} = p, big = tooBig(pic.width, pic.height);
   p.pack = {type: big ? 'rgb' : 'jpeg', image: big ? Uint8Array.from(pic.rgb) : await jpegOf(pic), nir: pic.nir ? Uint8Array.from(pic.nir) : null};
  }
  out.push({group: p.group, label: p.label, provider: p.provider, file: p.file, width: p.pic.width, height: p.pic.height, credit: p.pic.credit, place: p.place, pack: p.pack});
 }
 return out;
}

// A draft's pictures with their pixels back; one that cannot be read comes back
// with `failed` set, so the rest still open and the player is told.
export async function unpackPictures(saved, {onStep = () => {}} = {}) {
 const out = [];
 for (const p of saved) {
  onStep(p.label);
  try {
   const rgb = p.pack.type === 'jpeg' ? await pixelsOf(p.pack.image, p.width, p.height) : p.pack.image;
   out.push({...p, pic: {width: p.width, height: p.height, rgb, nir: p.pack.nir, credit: p.credit}});
  } catch { out.push({...p, failed: true}); }
 }
 return out;
}
