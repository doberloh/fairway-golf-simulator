import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS_CATEGORIES, SETTINGS_SCREENS} from '../src/ui-settings.js';

// The settings screen's category list opens real sheets, and the screens it
// lays out are among them -- a category naming a panel that does not exist
// would be a dead button on every settings screen.
test('every settings screen is in the category list, and the list opens known sheets', () => {
 const names = SETTINGS_CATEGORIES.map(c => c[0]);
 for (const s of SETTINGS_SCREENS) assert.ok(names.includes(s), s);
 assert.deepEqual(names, ['camera', 'graphics', 'sound', 'monitor', 'help']);
 assert.equal(new Set(names).size, names.length);
});
