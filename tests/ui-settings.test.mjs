import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS_CATEGORIES, SETTINGS_SCREENS} from '../src/ui-settings.js';

// The settings screen's category list opens real sheets, and the screens it
// lays out are among them -- a category naming a panel that does not exist
// would be a dead button on every settings screen.
test('every settings screen is in the category list, and the list opens known sheets', () => {
 const names = SETTINGS_CATEGORIES.map(c => c[0]);
 for (const s of SETTINGS_SCREENS) assert.ok(names.includes(s), s);
 // Help left the list on 21 October 2026: it is not a setting.
 assert.deepEqual(names, ['camera', 'graphics', 'sound', 'monitor']);
 assert.equal(new Set(names).size, names.length);
});

test('in a round every setting is a tab of one Settings window; only the monitor opens a screen', async () => {
 const {SETTINGS_TABS, WINDOW_SETTINGS} = await import('../src/ui-settings.js');
 const tabs = SETTINGS_TABS.map(t => t[0]);
 assert.equal(new Set(tabs).size, tabs.length);
 for (const k of ['camera', 'graphics', 'time', 'shot', 'putting', 'sound']) assert.ok(WINDOW_SETTINGS.has(k), k);
 assert.ok(tabs.includes('monitor') && !WINDOW_SETTINGS.has('monitor'));
});
