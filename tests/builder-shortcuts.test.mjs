// The builder's keyboard shortcuts and menus as rules (src/builder/shortcuts.js;
// the builder-ux goal).
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKey, matches, commandFor, keyLabel, shortcutRows} from '../src/builder/shortcuts.js';

const key = (k, o = {}) => ({key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o});

test('a key spec reads as its parts', () => {
 assert.deepEqual(parseKey('Ctrl+Shift+Z'), {ctrl: true, shift: true, alt: false, key: 'z'});
 assert.deepEqual(parseKey('B'), {ctrl: false, shift: false, alt: false, key: 'b'});
 assert.deepEqual(parseKey('Delete'), {ctrl: false, shift: false, alt: false, key: 'Delete'});
});

test('a plain letter is a tool; with Ctrl it is not', () => {
 assert.ok(matches('B', key('b')));
 assert.ok(matches('B', key('B')), 'Caps Lock still picks the brush');
 assert.ok(!matches('B', key('b', {ctrlKey: true})));
 assert.ok(!matches('B', key('b', {shiftKey: true})));
});

test('Ctrl is Ctrl or Command, and Shift tells undo from redo', () => {
 assert.ok(matches('Ctrl+Z', key('z', {ctrlKey: true})));
 assert.ok(matches('Ctrl+Z', key('z', {metaKey: true})));
 assert.ok(!matches('Ctrl+Z', key('Z', {ctrlKey: true, shiftKey: true})));
 assert.ok(matches('Ctrl+Shift+Z', key('Z', {ctrlKey: true, shiftKey: true})));
});

test('a key typed with Shift (? and the brackets) matches either way', () => {
 assert.ok(matches('?', key('?', {shiftKey: true})));
 assert.ok(matches('[', key('[')));
});

const menus = [
 {name: 'Edit', items: [{label: 'Undo', key: 'Ctrl+Z', run: () => 'undo'}, {sep: true}, {label: 'Redo', key: ['Ctrl+Y', 'Ctrl+Shift+Z'], run: () => 'redo'}]},
 {name: 'Tools', items: [{label: 'Brush', key: 'B', run: () => 'brush'}, {label: 'Nothing'}]},
];

test('a keydown finds its command, either of two keys included', () => {
 assert.equal(commandFor(menus, key('z', {ctrlKey: true})).label, 'Undo');
 assert.equal(commandFor(menus, key('Z', {ctrlKey: true, shiftKey: true})).label, 'Redo');
 assert.equal(commandFor(menus, key('y', {ctrlKey: true})).label, 'Redo');
 assert.equal(commandFor(menus, key('b')).label, 'Brush');
 assert.equal(commandFor(menus, key('q')), null);
});

test('typing in a box keeps the letters and the box\'s own undo', () => {
 assert.equal(commandFor(menus, key('b'), {typing: true}), null);
 assert.equal(commandFor(menus, key('z', {ctrlKey: true}), {typing: true}), null);
 assert.equal(commandFor([{name: 'File', items: [{label: 'Save', key: 'Ctrl+S'}]}], key('s', {ctrlKey: true}), {typing: true}).label, 'Save');
});

test('the shortcuts sheet lists every command with a key, then the extra lines', () => {
 const rows = shortcutRows(menus, [{group: 'View', label: 'Pan', key: 'Space+drag'}]);
 assert.deepEqual(rows.map(r => `${r.group}: ${r.label} ${r.key}`), ['Edit: Undo Ctrl+Z', 'Edit: Redo Ctrl+Y', 'Tools: Brush B', 'View: Pan Space+drag']);
 assert.equal(keyLabel('Ctrl+Shift+z'), 'Ctrl+Shift+Z');
});
