// The 1.0 drop-down's pure parts (round 14, ui-dropdown.js): its rows from a
// select's options and groups, and how the cursor moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {listRows, stepCursor} from '../src/ui-dropdown.js';

// A select as the browser gives it: options, some in groups.
const opt = (value, text, {group = null, disabled = false, right = '', earn = ''} = {}, index) => ({
 value, textContent: text, disabled, index, dataset: {right, earn},
 parentElement: group ? {tagName: 'OPTGROUP', label: group} : {tagName: 'SELECT'},
});
const select = list => ({options: list.map((o, i) => opt(...o, i))});

test('rows keep the options in order, with a header where each group starts', () => {
 const rows = listRows(select([
  ['', 'None'],
  ['weekend', 'Weekend golfer', {group: 'From levels', right: 'LV 4'}],
  ['rat', 'Range rat', {group: 'From levels', disabled: true, earn: 'LV 9'}],
  ['owl', 'Night owl', {group: 'From achievements', right: 'A round under the lights'}],
 ]));
 assert.deepEqual(rows.map(r => r.head ?? r.value), ['', 'From levels', 'weekend', 'rat', 'From achievements', 'owl']);
 const rat = rows.find(r => r.value === 'rat');
 assert.equal(rat.disabled, true);
 assert.equal(rat.earn, 'LV 9');
 assert.equal(rows.find(r => r.value === 'weekend').right, 'LV 4');
});

test('the cursor moves a row at a time, rests on a locked one, and stays in the list', () => {
 const items = [{disabled: false}, {disabled: true}, {disabled: true}, {disabled: false}];
 assert.equal(stepCursor(items, 0, 1), 1);
 assert.equal(stepCursor(items, 1, 1), 2);
 assert.equal(stepCursor(items, 3, 1), 3);
 assert.equal(stepCursor(items, 0, -1), 0);
});
