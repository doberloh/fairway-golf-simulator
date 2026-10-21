import test from 'node:test';
import assert from 'node:assert/strict';
import {optionWords, courseFacts, FORMAT_TILE, nameSize, GAME_TYPES, GAME_STEP, playSteps} from '../src/ui-lobby.js';
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

test('a seat name steps down in size as it gets longer (round 14)', () => {
 assert.equal(nameSize('BEN'), 'nm-24');
 assert.equal(nameSize('MAXIMILIAN'), 'nm-20');
 assert.equal(nameSize('ALEXANDRA-JANE'), 'nm-17');
 assert.equal(nameSize('BARTHOLOMEW-SMYTHE'), 'nm-15');
 assert.equal(nameSize(''), 'nm-24');
});

test('Play opens on the game type, then its own step, then the same three (UI/UX pass V2)', () => {
 assert.deepEqual(GAME_TYPES, ['weekly', 'endless', 'saved', 'friend', 'surprise']);
 for (const g of GAME_TYPES) assert.ok(g in GAME_STEP, g);
 assert.deepEqual(playSteps('weekly'), ['Game', 'The week', 'Golfers', 'Format', 'Rules']);
 assert.deepEqual(playSteps('saved'), ['Game', 'Course', 'Golfers', 'Format', 'Rules']);
 // Surprise me has no step of its own: its course is shown on Rules.
 assert.deepEqual(playSteps('surprise'), ['Game', 'Golfers', 'Format', 'Rules']);
 for (const g of GAME_TYPES) assert.deepEqual(playSteps(g).slice(-3), ['Golfers', 'Format', 'Rules']);
});
