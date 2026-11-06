// The builder's Save (src/builder/saving.js `saveHow`): one click to the same
// file once saved; a new file only for a new name or other work; a download
// where the browser cannot write a file it was given.
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveHow} from '../src/builder/saving.js';

test('the first save asks where; the same work and name save again with one click; a new name or other work ask again', () => {
 const work = {key: 'door2-1', name: 'Worthington'};
 assert.equal(saveHow(null, work), 'pick');
 const last = {...work, file: 'Worthington.fairway-draft', handle: {}};
 assert.equal(saveHow(last, work), 'overwrite');
 assert.equal(saveHow(last, {...work, name: 'Worthington CC'}), 'pick', 'renamed: a new file');
 assert.equal(saveHow(last, {key: 'editor-2', name: 'Worthington'}), 'pick', 'another piece of work never overwrites this one');
 assert.equal(saveHow({...last, handle: null}, work), 'pick', 'a download leaves nothing to write to');
 assert.equal(saveHow(last, work, {canPick: false}), 'download', 'no save dialog in this browser');
});
