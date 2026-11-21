// A ROOM'S CODE IS ITS SECRET (online play, 19 November 2026; the owner
// signed off the design in docs/studies/online-play/PLAN.md).
//
// Sixteen characters from Crockford's base32 (no I, L, O or U, so nothing is
// misread aloud), shown in fours: K7Q2-M9XD-4RTP-8WNB. Fifteen carry 75 random
// bits (PLACED: far past guessing at the relay's rate limits, short enough to
// read out); the sixteenth is a check, so a mistyped code is refused at once
// instead of opening an empty room. From the code, one way each:
// - the relay's room number (`roomId`): the relay sees only this;
// - the sealing key (`roomKey`): the relay never sees it, so it cannot read
//   or forge a message (seal.js).
// Pure; the randomness is the caller's `random(n)` (crypto.getRandomValues,
// which a plain-http page has too). tests/online-room-code.test.mjs.
import {sha256} from '@noble/hashes/sha2.js';
import {hkdf} from '@noble/hashes/hkdf.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_DATA = 15;
export const CODE_LENGTH = 16;

const checkOf = data => ALPHABET[sha256(utf8ToBytes('fairway-code-check:' + data))[0] & 31];

// A fresh code from `random(n)`, n random bytes (10 here: 80 bits, 75 used).
export function newRoomCode(random) {
 const bytes = random(10);
 let bits = 0, acc = 0, out = '';
 for (const b of bytes) {
  acc = (acc << 8) | b; bits += 8;
  while (bits >= 5 && out.length < CODE_DATA) { bits -= 5; out += ALPHABET[(acc >> bits) & 31]; }
  acc &= (1 << bits) - 1;
 }
 return out + checkOf(out);
}

// What a person typed, as the code it means, or null. Spaces, dashes and case
// are ignored; O reads as 0, I and L as 1 (Crockford's own rule).
export function readRoomCode(typed) {
 const s = String(typed ?? '').toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
 if (s.length !== CODE_LENGTH) return null;
 for (const c of s) if (!ALPHABET.includes(c)) return null;
 return checkOf(s.slice(0, CODE_DATA)) === s[CODE_DATA] ? s : null;
}

export const showRoomCode = code => code.match(/.{1,4}/g).join('-');

// The relay's name for the room: 32 hex characters of a hash of the code.
export const roomId = code => bytesToHex(sha256(utf8ToBytes('fairway-online-room-v1:' + code))).slice(0, 32);

// The room's sealing key: 32 bytes.
export const roomKey = code => hkdf(sha256, utf8ToBytes(code), utf8ToBytes('fairway-online-v1'), utf8ToBytes('seal'), 32);
