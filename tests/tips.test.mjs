// The loading tips (src/tips.js): every key a tip names is a key the game
// answers to (keys.js), and the splash shows the list the build writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TIPS} from '../src/tips.js';
import {ROUND_KEYS} from '../src/keys.js';

const known = new Set(ROUND_KEYS.flatMap(k => k.keys));

test('every key a tip names is in the game\'s key table', () => {
 for (const t of TIPS) for (const k of t.keys || []) assert.ok(known.has(k), `"${t.text}" names ${k}, which keys.js does not list`);
});

test('a tip that names a key in its words lists that key', () => {
 // A capital letter standing alone at the start, or Esc / Tab / ?, is a key.
 for (const t of TIPS) {
  const named = [...t.text.matchAll(/(?:^|[ (])(Esc|Tab|\?|[A-Z])(?= (?:and|again|opens|shows|looks|flies|hides|lists|pauses|change)\b)/g)].map(m => m[1]);
  for (const k of named) assert.ok((t.keys || []).includes(k), `"${t.text}" mentions ${k} but does not list it`);
 }
});

test('the tips are short, plain sentences, each one different', () => {
 assert.ok(TIPS.length >= 10 && TIPS.length <= 15, `${TIPS.length} tips (10-15, docs/reports/ui-polish-goal.md)`);
 assert.equal(new Set(TIPS.map(t => t.text)).size, TIPS.length);
 for (const t of TIPS) {
  assert.ok(t.text.length <= 100, `"${t.text}" is longer than 100 characters`);
  assert.match(t.text, /\.$/, `"${t.text}" ends in a full stop`);
  assert.doesNotMatch(t.text, /!/, `"${t.text}": no exclamation marks`);
 }
});

test('the splash takes its tips from the build, not a list of its own', () => {
 const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
 assert.match(html, /var tips=S\.tips\|\|\[\];/);
 const config = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
 assert.match(config, /tips:\$\{JSON\.stringify\(TIPS\.map\(t => t\.text\)\)\}/);
});
