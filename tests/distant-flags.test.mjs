import test from 'node:test';
import assert from 'node:assert/strict';
import {saveGraphics} from '../src/graphics.js';

// "Larger flags far away" (renderer.js, FLAGSTICKS STAY VISIBLE FROM ANYWHERE):
// off unless the player turns it on, including for a record saved before the
// switch existed (the owner, 14 October 2026).
test('distant flags stay to size unless switched on', () => {
 assert.equal(saveGraphics({}).distantFlags, false);
 assert.equal(saveGraphics({quality: 'high', floodlightShadows: true}).distantFlags, false);
 assert.equal(saveGraphics({distantFlags: true}).distantFlags, true);
 assert.equal(saveGraphics({distantFlags: 'yes'}).distantFlags, false);
});
