import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROUND_KEYS, TOOLS, toolsFor, helpKeys, swingStrip, COACH_STEPS} from '../src/keys.js';

test('every key is listed once, and Tab is the numbers, ? is the list', () => {
 const caps = ROUND_KEYS.map(k => k.keys.join(' '));
 assert.equal(new Set(caps).size, caps.length);
 assert.match(ROUND_KEYS.find(k => k.keys[0] === 'Tab').words, /number/i);
 assert.match(ROUND_KEYS.find(k => k.keys[0] === '?').words, /list/i);
 assert.equal(ROUND_KEYS.filter(k => k.keys.includes('Esc')).length, 1);
});

test('every tool has a key, and the keys it drives say the same', () => {
 for (const t of TOOLS) assert.ok(t.key && t.label);
 for (const k of ROUND_KEYS.filter(k => k.tool)) {
  const t = TOOLS.find(x => x.id === k.tool);
  assert.ok(t, k.tool);
  assert.equal(t.key, k.keys[0].toUpperCase());
 }
 assert.ok(!toolsFor().some(t => t.id === 'range'));
 assert.ok(toolsFor({range: true}).some(t => t.id === 'range'));
});

test('the swing strip says how to swing, by input', () => {
 assert.deepEqual(swingStrip()[0], ['SPACE', 'SWING']);
 assert.equal(swingStrip({putting: true})[2][1], 'LENGTH');
 assert.match(swingStrip({touch: true})[0].join(' '), /TAP/);
 assert.ok(!swingStrip({monitor: true}).some(([k]) => k === 'SPACE'));
 assert.equal(COACH_STEPS.length, 3);
});

test('Help lists the round keys, and the main.js key handler answers each', () => {
 const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
 assert.equal(helpKeys().length, ROUND_KEYS.length);
 for (const code of ['KeyC', 'KeyG', 'KeyV', 'KeyM', 'KeyH', 'KeyA', 'Tab', 'Slash', 'Space', 'Enter'])
  assert.ok(main.includes(`e.code==='${code}'`), code);
});

test('a step passed without what it needs is not ticked (Play with no course)', async () => {
 const {stepMarks} = await import('../src/ui-steps.js');
 const chosen = {v: ''};
 const steps = [{label: 'Course', done: () => !!chosen.v}, {label: 'Golfers'}, {label: 'Rules'}];
 assert.deepEqual(stepMarks(steps, 2), ['missing', 'done', 'on']);
 chosen.v = 'weekly';
 assert.deepEqual(stepMarks(steps, 2), ['done', 'done', 'on']);
 assert.deepEqual(stepMarks(steps, 0), ['on', 'todo', 'todo']);
});
