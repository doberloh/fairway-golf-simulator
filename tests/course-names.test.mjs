import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestCourseName, NAME_WORDS} from '../src/course-names.js';
import {BIOMES, DEFAULT_COURSE} from '../src/course.js';
import {exportCourse, importCourse, MAX_NAME} from '../src/course-library.js';

const biomes = Object.keys(BIOMES);

test('every biome has names of its own', () => {
 // A links course must not be called "Saguaro" anything. This catches a biome
 // added to biomes.js and not to the word lists -- it would fall back to the
 // generic set, which nobody would notice until the names read oddly.
 for (const biome of biomes) {
  assert.ok(NAME_WORDS[biome], `${biome} has no words of its own`);
  const names = new Set();
  for (let i = 0; i < 60; i++) names.add(suggestCourseName({biome, seed: `SEED-${i}`}));
  assert.ok(names.size > 20, `${biome} only produced ${names.size} names in 60 tries`);
 }
});

test('no two biomes can produce the same name', () => {
 // Checked against the LISTS rather than against a sample, because a sample
 // that happens not to collide today is not the rule. Two biomes may share a
 // first word or a second word -- cedar and hollow each genuinely belong in
 // more than one landscape -- but never both, or the same name comes out of two
 // different places. "Cedar Hollow" was reachable from both the Pacific
 // Northwest and the Midwest until this test said so.
 const entries = Object.entries(NAME_WORDS);
 for (const [a, [firstA, secondA]] of entries) for (const [b, [firstB, secondB]] of entries) {
  if (a >= b) continue;
  const first = firstA.filter(w => firstB.includes(w));
  const second = secondA.filter(w => secondB.includes(w));
  assert.ok(!first.length || !second.length,
   `${a} and ${b} can both produce "${first[0]} ${second[0]}"`);
 }
});

test('the same course always suggests the same name', () => {
 // A name declined once and accepted a minute later has to be the same name,
 // and two people holding the same code must see the same suggestion.
 for (const biome of biomes) {
  const s = {biome, seed: 'HORIZON-4946'};
  assert.equal(suggestCourseName(s), suggestCourseName({...s}));
 }
 // Changing either half changes the answer, or the name says nothing about
 // which course it belongs to.
 assert.notEqual(suggestCourseName({biome: 'links', seed: 'A'}),
  suggestCourseName({biome: 'links', seed: 'B'}));
 assert.notEqual(suggestCourseName({biome: 'links', seed: 'A'}),
  suggestCourseName({biome: 'desert', seed: 'A'}));
});

test('a suggested name is always a name the library will accept', () => {
 // It goes straight into a box whose only validation is 1-40 characters, and
 // Surprise me does not even show the box -- it takes the suggestion.
 for (const biome of [...biomes, undefined, 'a biome that does not exist']) {
  for (let i = 0; i < 40; i++) {
   const name = suggestCourseName({biome, seed: `S${i}`});
   assert.ok(name.trim().length > 0, 'empty name');
   assert.ok(name.length <= MAX_NAME, `"${name}" is ${name.length} characters`);
   assert.equal(name, name.trim());
   assert.ok(!/ {2}/.test(name), `"${name}" has a double space`);
   // "Mesa Mesa" -- both lists share some words on purpose, because the word is
   // good in either position, so the collision is resolved rather than pruned.
   const [a, b] = name.split(' ');
   assert.notEqual(a, b, `"${name}" repeats its own word`);
  }
 }
});

test('a course code carries the name, which is the point of naming it', () => {
 const name = suggestCourseName({biome: 'links', seed: 'HORIZON-4946'});
 const code = exportCourse({name, settings: {...DEFAULT_COURSE, biome: 'links', seed: 'HORIZON-4946'}});
 assert.equal(importCourse(code).name, name);
});

test('a course cannot be saved or shared without a name', () => {
 // The box is pre-filled so this is not something a player hits by accident,
 // but an empty one must not produce a course called "".
 for (const bad of ['', '   ', null, undefined]) {
  assert.throws(() => exportCourse({name: bad, settings: DEFAULT_COURSE}), /name/i);
 }
 assert.throws(() => exportCourse({name: 'x'.repeat(MAX_NAME + 1), settings: DEFAULT_COURSE}), /name/i);
});
