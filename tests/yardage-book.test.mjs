import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {yardageBook} from '../src/yardage-book.js';
import {holeNames} from '../src/hole-names.js';

// PHASE 7: THE YARDAGE BOOK (architect-courses; yardage-book.js): a page a
// hole of an Architect course -- the plan, the carries, the architect's notes
// -- as a well-formed PDF.

// The same structural check as tests/range-report.test.mjs: every offset in
// the cross-reference table lands on its object, every stream is the length
// it says.
function checkPdf(bytes) {
 const text = Array.from(bytes, b => String.fromCharCode(b)).join('');
 assert.ok(text.startsWith('%PDF-1.4\n'));
 const start = Number(text.match(/startxref\n([0-9]+)\n%%EOF/)[1]);
 assert.equal(text.slice(start, start + 4), 'xref');
 const [, count] = text.slice(start).match(/xref\n0 ([0-9]+)\n/);
 text.slice(start).split('\n').slice(3, 3 + Number(count) - 1).forEach((e, i) => {
  const at = Number(e.slice(0, 10));
  assert.equal(text.slice(at, at + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`);
 });
 for (const m of text.matchAll(/<< \/Length ([0-9]+) >>\nstream\n/g)) {
  const body = m.index + m[0].length;
  assert.equal(text.slice(body + Number(m[1]), body + Number(m[1]) + 10), '\nendstream');
 }
 return text;
}

test('a page a hole, well formed, with each hole\'s name, par, note and carries', () => {
 const w = world({seed: 'BOOK-T', holes: 9, biome: 'midwest', designer: 'architect'});
 const doc = yardageBook(w);
 assert.equal(doc.pages.length, 9);
 const text = checkPdf(doc.bytes()), names = holeNames(w.holes, w.settings);
 for (let i = 0; i < 9; i++) {
  assert.ok(text.includes(`(Hole ${i + 1})`), `hole ${i + 1}'s number`);
  assert.ok(text.includes(`(${names[i]})`), `hole ${i + 1}'s name`);
  assert.ok(text.includes(`(Par ${w.holes[i].par})`));
 }
 assert.ok(text.includes('(The architect)'));
 assert.ok(/to carry\./.test(text), 'carries to the hazards');
 assert.ok(/to go\)/.test(text), 'what is left from the landing zones');
});
