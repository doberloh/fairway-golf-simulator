import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsChanges, changeLine, changedText} from '../src/ui-studio.js';
import {SETTINGS, DEFAULT_COURSE} from '../src/settings-schema.js';

// The studio's "N settings changed" and its what-changed column compare what
// the controls say with the settings the landscape was grown from.
test('a moved slider, a flipped switch and a new choice are changes; untouched controls are not', () => {
 const fields = [{key: 'width', kind: 'range', label: 'Typical fairway width', unit: ' m'}, {key: 'houses', kind: 'toggle', label: 'Houses'}, {key: 'wind', kind: 'choice', label: 'Wind'}, {key: 'seed', kind: 'text', label: 'Seed'}];
 const applied = {width: 38, houses: true, wind: 'calm', seed: 'A'};
 assert.deepEqual(settingsChanges(fields, applied, k => ({width: '38', houses: true, wind: 'calm', seed: 'B'})[k]), []);
 const list = settingsChanges(fields, applied, k => ({width: '32', houses: false, wind: 'breezy'})[k]);
 assert.deepEqual(list.map(c => c.key), ['width', 'houses', 'wind']);
 assert.equal(changeLine(list[0]), 'TYPICAL FAIRWAY WIDTH 38 → 32 M');
 assert.equal(changeLine(list[1]), 'HOUSES ON → OFF');
 assert.equal(changedText(1), '1 SETTING CHANGED');
 assert.equal(changedText(2), '2 SETTINGS CHANGED');
});

test('a control not on the page is no change, and the real schema reads clean against itself', () => {
 assert.deepEqual(settingsChanges(SETTINGS, DEFAULT_COURSE, () => undefined), []);
 const same = settingsChanges(SETTINGS, DEFAULT_COURSE, k => DEFAULT_COURSE[k]);
 assert.deepEqual(same, []);
});
