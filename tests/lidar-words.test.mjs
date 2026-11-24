// What went wrong reading a LIDAR file, in the player's words
// (src/builder/lidar-words.js; the owner's 6.2 GB West Virginia ZIP of zLAS
// files, 21 November 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {ZLAS, zlasWords, readProblem, ONE_PIECE} from '../src/builder/lidar-words.js';

test('zLAS files are named, with what to do instead', () => {
 assert.ok(ZLAS.test('17SPD270665.zlas') && ZLAS.test('A.ZLAS') && !ZLAS.test('a.laz') && !ZLAS.test('zlas.las'));
 const many = zlasWords(['a.zlas', 'b.zlas', 'c.zlas', 'd.zlas', 'e.zlas']);
 assert.match(many, /^these 5 files are zLAS \(a\.zlas, b\.zlas, c\.zlas, and 2 more\)/);
 assert.match(many, /Esri's own compressed LIDAR, which Fairway cannot read/);
 assert.match(many, /LAS Optimizer/);
 assert.match(many, /search the map/);
 assert.match(zlasWords(['x.zlas'], {start: true}), /^This is a zLAS file \(x\.zlas\)/);
});

test('a file too big to read in one piece is said so, with its size; other failures keep their words', () => {
 const unreadable = new DOMException('The requested file could not be read', 'NotReadableError');
 assert.match(readProblem(unreadable, {size: 6201257648}), /^it is 5\.8 GB, more than a browser will read in one piece/);
 assert.match(readProblem(unreadable, {size: ONE_PIECE - 1}), /could not read it\. If it is still downloading/);
 assert.match(readProblem(new RangeError('Array buffer allocation failed'), {size: 3 * 2 ** 30}), /3\.0 GB/);
 assert.equal(readProblem(Error('This file is damaged: x does not check out.')), 'This file is damaged: x does not check out.');
});
