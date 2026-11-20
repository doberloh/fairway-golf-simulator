import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal, open, toBase64, fromBase64} from '../src/online/seal.js';
import {newRoomCode, roomId, roomKey} from '../src/online/room-code.js';

// EVERY MESSAGE IS SEALED (online play, 19 November 2026).
const random = n => new Uint8Array(randomBytes(n));
const code = newRoomCode(random), room = roomId(code), key = roomKey(code);

test('base64 round-trips every length and refuses junk', () => {
 for (let n = 0; n < 40; n++) {
  const b = random(n);
  assert.equal(toBase64(b), Buffer.from(b).toString('base64'), `length ${n}`);
  assert.deepEqual(fromBase64(toBase64(b)), b);
 }
 assert.equal(fromBase64('abc'), null);
 assert.equal(fromBase64('ab!d'), null);
});

test('a sealed message opens in the room, and only there', () => {
 const msg = {t: 'shot', n: 3, launch: {speed: 61.2, vla: 11.4, hla: -1.2, spin: 2650, axis: 4}, name: 'Sam ⛳'};
 const box = seal(key, room, msg, random);
 assert.equal(typeof box, 'string');
 assert.ok(!box.includes('shot') && !box.includes('Sam'), 'nothing readable');
 assert.deepEqual(open(key, room, box), msg);
 assert.notEqual(seal(key, room, msg, random), box, 'a fresh nonce every time');
 const other = newRoomCode(random);
 assert.equal(open(roomKey(other), room, box), null, 'another code cannot open it');
 assert.equal(open(key, roomId(other), box), null, 'nor can it be replayed into another room');
});

test('a box altered by one bit, cut short, or made up opens to nothing', () => {
 const box = seal(key, room, {t: 'hello'}, random);
 const bytes = fromBase64(box);
 for (const at of [0, 23, 24, bytes.length - 1]) {
  const bad = bytes.slice(); bad[at] ^= 1;
  assert.equal(open(key, room, toBase64(bad)), null, `bit at ${at}`);
 }
 assert.equal(open(key, room, toBase64(bytes.slice(0, 30))), null);
 assert.equal(open(key, room, 'not a box'), null);
 assert.equal(open(key, room, toBase64(random(80))), null);
});
