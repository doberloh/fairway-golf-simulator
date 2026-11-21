// EVERY MESSAGE IS SEALED (online play; PLAN.md *Security design*).
//
// XChaCha20-Poly1305 from @noble/ciphers, the game's own code rather than the
// browser's crypto.subtle, which a phone that loaded the game over plain http
// from run_fairway_server does not have (RESEARCH, *Online play*). A sealed
// message is base64 of a 24-byte random nonce and the ciphertext with its
// 16-byte tag. The room's id is bound in as associated data, so a box from
// one room cannot be replayed into another. Opening a forged, altered or
// foreign box returns null, never throws. Pure; `random(n)` is the caller's.
// tests/online-seal.test.mjs.
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {utf8ToBytes, bytesToUtf8} from '@noble/ciphers/utils.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function toBase64(bytes) {
 let out = '', i = 0;
 for (; i + 2 < bytes.length; i += 3) {
  const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
  out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
 }
 const left = bytes.length - i;
 if (left === 1) { const n = bytes[i] << 16; out += B64[n >> 18] + B64[(n >> 12) & 63] + '=='; }
 else if (left === 2) { const n = (bytes[i] << 16) | (bytes[i + 1] << 8); out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '='; }
 return out;
}

export function fromBase64(text) {
 if (typeof text !== 'string' || text.length % 4) return null;
 const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
 const out = new Uint8Array(text.length / 4 * 3 - pad);
 let o = 0;
 for (let i = 0; i < text.length; i += 4) {
  let n = 0;
  for (let k = 0; k < 4; k++) {
   const c = text.charCodeAt(i + k);
   const v = text[i + k] === '=' && i + k >= text.length - pad ? 0 : c < 128 ? LOOKUP[c] : -1;
   if (v < 0) return null;
   n = (n << 6) | v;
  }
  if (o < out.length) out[o++] = n >> 16;
  if (o < out.length) out[o++] = (n >> 8) & 255;
  if (o < out.length) out[o++] = n & 255;
 }
 return out;
}

// `message`: anything JSON can carry. `room`: the room's id (room-code.js).
export function seal(key, room, message, random) {
 const nonce = random(24);
 const box = xchacha20poly1305(key, nonce, utf8ToBytes(room)).encrypt(utf8ToBytes(JSON.stringify(message)));
 const all = new Uint8Array(24 + box.length);
 all.set(nonce); all.set(box, 24);
 return toBase64(all);
}

export function open(key, room, sealed) {
 const all = fromBase64(sealed);
 if (!all || all.length < 24 + 16) return null;
 try {
  const plain = xchacha20poly1305(key, all.subarray(0, 24), utf8ToBytes(room)).decrypt(all.subarray(24));
  return JSON.parse(bytesToUtf8(plain));
 } catch { return null; }
}
