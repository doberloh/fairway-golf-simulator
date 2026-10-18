import test from 'node:test';
import assert from 'node:assert/strict';
import {leanOffsets} from '../src/ui-windows.js';

// A window leans as one block: every row turns about the column's middle, so
// a row above the middle is pushed down by as much as its middle sits above it.
test('each row is turned about the middle of the whole column', () => {
 const rows = [{top: 0, height: 40}, {top: 46, height: 40}, {top: 92, height: 40}];
 assert.deepEqual(leanOffsets(rows), [46, 0, -46]);
 assert.deepEqual(leanOffsets([]), []);
 // A zoomed column reports screen pixels; the offset is in the row's own.
 assert.deepEqual(leanOffsets([{top: 0, height: 28, scale: .7}, {top: 32, height: 28, scale: .7}]), [16 / .7, -16 / .7]);
});
