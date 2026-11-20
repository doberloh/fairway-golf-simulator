import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {newRoomCode, readRoomCode, showRoomCode, roomId, roomKey, ALPHABET, CODE_LENGTH} from '../src/online/room-code.js';

// A ROOM'S CODE IS ITS SECRET (online play, 19 November 2026).
const random = n => new Uint8Array(randomBytes(n));

test('a new code is sixteen characters of the alphabet, its last a check', () => {
 const seen = new Set();
 for (let i = 0; i < 500; i++) {
  const c = newRoomCode(random);
  assert.equal(c.length, CODE_LENGTH);
  for (const ch of c) assert.ok(ALPHABET.includes(ch), ch);
  assert.equal(readRoomCode(c), c, 'reads back as itself');
  seen.add(c);
 }
 assert.equal(seen.size, 500, 'no repeats in 500');
 assert.ok(!/[ILOU]/.test(ALPHABET), 'nothing misread aloud');
});

test('typing is forgiving: case, dashes, spaces, O for 0, I and L for 1', () => {
 const fixed = () => new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x10, 0x32]);
 const c = newRoomCode(fixed);
 const shown = showRoomCode(c);
 assert.match(shown, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
 assert.equal(readRoomCode(shown.toLowerCase()), c);
 assert.equal(readRoomCode(' ' + shown.replace(/-/g, ' ') + ' '), c);
 const withO = c.replace(/0/g, 'O').replace(/1/g, 'l');
 assert.equal(readRoomCode(withO), c);
});

test('a mistyped code is refused, not taken to an empty room', () => {
 let refused = 0, tries = 0;
 for (let i = 0; i < 200; i++) {
  const c = newRoomCode(random);
  const at = i % 15, swap = ALPHABET[(ALPHABET.indexOf(c[at]) + 1 + (i % 30)) % 32];
  const typo = c.slice(0, at) + swap + c.slice(at + 1);
  if (typo === c) continue;
  tries++;
  if (readRoomCode(typo) === null) refused++;
 }
 // One check character catches 31 in 32 single typos.
 assert.ok(refused / tries > 0.9, `${refused} of ${tries}`);
 assert.equal(readRoomCode(''), null);
 assert.equal(readRoomCode('K7Q2-M9XD'), null, 'too short');
 assert.equal(readRoomCode('UUUU-UUUU-UUUU-UUUU'), null, 'U is not in the alphabet');
});

test('the relay sees only a hash; the key is separate and fixed by the code', () => {
 const c = newRoomCode(random), d = newRoomCode(random);
 assert.match(roomId(c), /^[0-9a-f]{32}$/);
 assert.ok(!roomId(c).toUpperCase().includes(c.slice(0, 6)));
 assert.equal(roomId(c), roomId(c));
 assert.notEqual(roomId(c), roomId(d));
 assert.equal(roomKey(c).length, 32);
 assert.deepEqual(roomKey(c), roomKey(c));
 assert.notDeepEqual(roomKey(c), roomKey(d));
});
