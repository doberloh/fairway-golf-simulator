import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestCourseName, NAME_WORDS, nameCount} from '../src/course-names.js';
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
 // Kept by one mechanism: every FIRST word is unique to its biome, so the
 // first-word intersection of any two biomes is empty and the second words can
 // be shared freely. The original lists let both halves overlap and "Cedar
 // Hollow" was reachable from both the Pacific Northwest and the Midwest.
 const home = new Map();
 for (const [biome, [first]] of Object.entries(NAME_WORDS)) for (const w of first) {
  assert.ok(!home.has(w), `"${w}" is a first word in both ${home.get(w)} and ${biome}`);
  home.set(w, biome);
 }
});

test('NO NAME IS A REAL GOLF DESTINATION', () => {
 // The lists carried Bandon, Dornoch, Kintyre and Saguaro, and the biome
 // titles carried Bandon Ridge, Turtle Bay and Saguaro Dunes. A place name is
 // weak as a mark; a real resort's name on a course inside a golf product being
 // sold is not the same thing. This is the rule written down so it cannot come
 // back by accident -- it is not a complete list of golf resorts and cannot be,
 // so search a new word together with "golf" before adding it.
 const marks = ['bandon', 'dornoch', 'kintyre', 'saguaro', 'turnberry', 'troon',
  'carnoustie', 'muirfield', 'prestwick', 'portrush', 'lytham', 'birkdale',
  'hoylake', 'brora', 'nairn', 'gullane', 'pebble', 'augusta', 'pinehurst',
  'shinnecock', 'merion', 'oakmont', 'winged foot', 'whistling', 'kiawah',
  'sawgrass', 'torrey', 'riviera', 'medinah', 'olympic club', 'valhalla',
  'erin hills', 'chambers bay', 'streamsong', 'sand valley', 'cabot',
  'turtle bay', 'we-ko-pa', 'ocotillo', 'sandwich', 'royal county'];
 const offenders = [];
 for (const [biome, [first, second]] of Object.entries(NAME_WORDS))
  for (const w of [...first, ...second])
   if (marks.some(m => w.toLowerCase() === m || w.toLowerCase().includes(m)))
    offenders.push(`${biome}: ${w}`);
 assert.deepEqual(offenders, [], 'word names a real golf destination');
});

test('the lists are big enough to stop repeating themselves', () => {
 // "There aren't very many combinations" was the report that grew these from
 // roughly 100 per biome. A number, so the next person can judge rather than
 // guess.
 for (const biome of Object.keys(NAME_WORDS))
  assert.ok(nameCount(biome) >= 1500, `${biome} can only make ${nameCount(biome)} names`);
 const total = Object.keys(NAME_WORDS).reduce((n, b) => n + nameCount(b), 0);
 assert.ok(total >= 15000, `only ${total} names across every biome`);
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
 // EXHAUSTIVE over the lists, not sampled: the box it fills accepts 1-40
 // characters, Surprise me does not even show the box, and a sample that
 // happens to miss the longest pair is not a check.
 for (const [biome, [first, second]] of Object.entries(NAME_WORDS))
  for (const a of first) for (const b of second) {
   const longest = `${a} ${b} Country Club`;
   assert.ok(longest.length <= MAX_NAME, `"${longest}" is ${longest.length} characters`);
   assert.equal(longest, longest.trim());
   assert.ok(!/ {2}/.test(longest), `"${longest}" has a double space`);
   assert.ok(/^[A-Za-z][A-Za-z ]*$/.test(`${a} ${b}`), `"${a} ${b}" has odd characters`);
  }
 // And the generator's own output, including the unknown-biome fallback.
 for (const biome of [...biomes, undefined, 'a biome that does not exist'])
  for (let i = 0; i < 40; i++) {
   const name = suggestCourseName({biome, seed: `S${i}`});
   assert.ok(name.trim().length > 0 && name.length <= MAX_NAME, name);
   const [a, b] = name.split(' ');
   assert.notEqual(a, b, `"${name}" repeats its own word`);
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
