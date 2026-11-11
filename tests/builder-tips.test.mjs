// Every button in the builder has a tooltip (src/builder/tips.js; the owner,
// 1 November 2026: "can we add on hover tooltips for buttons?"): one made
// without a `title` of its own takes one from tips.js by its tool or its
// label, so every fixed label in the builder's source must be there. Read
// from the source, as the buttons are made only in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TIPS, TOOL_TIPS, tipFor} from '../src/builder/tips.js';

const DIR = new URL('../src/builder/', import.meta.url);
// Each el('button', {...}, label) in a file: its attributes' text and its label's.
function buttons(src) {
 const out = [];
 for (let at = 0; ; ) {
  const i = src.indexOf("el('button'", at); if (i < 0) break; at = i + 1;
  let k = src.indexOf('{', i), depth = 0; const j = k;
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}' && !--depth) break; }
  const attrs = src.slice(j, k + 1), m = src.slice(k + 1, k + 300).match(/^\s*,\s*([^\n]*)/);
  out.push({attrs, label: m ? m[1] : ''});
 }
 return out;
}
const words = label => [...label.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'"));

test('every fixed button label in the builder has a tooltip, by its tool or its words', () => {
 const missing = [];
 for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(new URL(f, DIR), 'utf8');
  for (const b of buttons(src)) {
   if (/title:/.test(b.attrs) || /'data-tool'/.test(b.attrs)) continue;
   // A label from a variable (a list mapped to buttons) is checked from its list below.
   const lit = b.label.match(/^(?:[a-zA-Z.]+ \? )?'/) ? words(b.label.split(/\)\)|\), /)[0]) : [];
   for (const w of lit) if (!TIPS[w]) missing.push(`${f}: ${w}`);
  }
  for (const m of src.matchAll(/next\(\d, '([^']+)'\)/g)) if (!TIPS[m[1]]) missing.push(`${f}: ${m[1]}`);
 }
 assert.deepEqual(missing, []);
});

test('door 2\'s step, tool and mark buttons, made from lists, have theirs', () => {
 const src = fs.readFileSync(new URL('door-real.js', DIR), 'utf8');
 const steps = JSON.parse(src.match(/const STEPS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
 for (const s of steps) assert.ok(TIPS[s], s);
 // The palette's tools (TOOL_LIST, the builder-ux goal; it was `const tools`).
 for (const [, key] of src.match(/const TOOL_LIST = (\[\[[\s\S]*?\]\]);/)[1].matchAll(/\['(\w+)'/g)) assert.ok(TOOL_TIPS[key], key);
 // The marks: the six tee sets (each its own title, tees.js), then these.
 const marks = src.match(/const marks = \[\.\.\.TEE_ORDER\.map\(m => \[m, teeName\(m\)\]\), (.*?)\]\.map/);
 assert.ok(marks && /title: TEE_COLOURS\[m\] \?/.test(src), 'the tee marks carry a title');
 for (const [, label] of marks[1].matchAll(/, '([^']+)'\]/g)) assert.ok(TIPS[label], label);
});

test('a tool\'s tip before its label\'s; a label given as a single string only', () => {
 assert.equal(tipFor({'data-tool': 'brush'}, ['Paint brush']), TOOL_TIPS.brush);
 assert.equal(tipFor({}, ['Undo']), TIPS.Undo);
 assert.equal(tipFor({}, ['Undo', 'more']), null);
 assert.equal(tipFor({}, ['No such label']), null);
});
