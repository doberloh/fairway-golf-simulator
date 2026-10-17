import test from 'node:test';
import assert from 'node:assert/strict';
import {optionWords, courseFacts, FORMAT_TILE} from '../src/ui-lobby.js';
import {OB_RULES} from '../src/relief.js';

// The lobby's pickers show a short value and a line under it, cut from the
// drop-down's own option text -- so the words a player reads in the picker
// are the words the old drop-down used, and a new option needs no table here.
test('a picker cuts an option into its value and its line', () => {
 assert.deepEqual(optionWords('Stroke and distance (Rules of Golf)'), {value: 'Rules of Golf', sub: 'Stroke and distance'});
 assert.deepEqual(optionWords('Hole out · make every putt'), {value: 'Hole out', sub: 'make every putt'});
 assert.deepEqual(optionWords('On: rough and sand cost ball speed'), {value: 'On', sub: 'rough and sand cost ball speed'});
 assert.deepEqual(optionWords('Blue tees'), {value: 'Blue tees', sub: ''});
 assert.deepEqual(optionWords(''), {value: '', sub: ''});
});

test('every out-of-bounds rule reads as its short name', () => {
 for (const r of Object.values(OB_RULES)) assert.equal(optionWords(r.label).value, r.short);
});

test("the course panel reads the course drop-down's option", () => {
 assert.deepEqual(courseFacts('Hemlock Head · 18 holes · Midwest'), {name: 'Hemlock Head', holes: '18 holes', biome: 'Midwest'});
 assert.deepEqual(courseFacts('No saved courses yet'), {name: 'No saved courses yet', holes: '', biome: ''});
});

test('the four format tiles are the four formats', async () => {
 const {FORMATS} = await import('../src/game.js');
 assert.deepEqual(Object.keys(FORMAT_TILE).sort(), [...FORMATS].sort());
});
