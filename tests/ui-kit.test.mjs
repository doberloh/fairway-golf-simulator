import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TYPE, PANEL_PAD, HEIGHTS, canvasFrame, gridFor, canvasFor} from '../src/ui-layout.js';
import {screenPalette} from '../src/ui-palette.js';
import * as kit from '../src/ui-kit.js';

const CSS = fs.readFileSync(new URL('../src/ui-kit.css', import.meta.url), 'utf8');
// The stylesheet's rules as [selector list, body], comments and @font-face aside.
const RULES = [...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
 .map(m => [m[1].trim(), m[2]]).filter(([s]) => !s.startsWith('@font-face'));
const bodyOf = sel => RULES.filter(([s]) => s.split(',').map(x => x.trim()).includes(sel)).map(([, b]) => b).join(';');

// Every builder, with sample arguments, for the checks that apply to all of them.
const grid = gridFor(canvasFor(16 / 9));
const SAMPLES = {
 kitRoot: kit.kitRoot(screenPalette({screen: 'menu'}), 'x', {frame: canvasFrame({width: 1920, height: 1080})}),
 sheet: kit.sheet(grid, 'x'),
 place: kit.place(grid, 0, 4, 96, 'x'),
 type: kit.type('value', '289', {unit: 'YD', under: true}),
 labelled: kit.labelled('Carry', '268', {unit: 'YD'}),
 panel: kit.panel('x', {hl: true, on: true}),
 ghost: kit.panel('x', {ghost: true}),
 row: kit.row('a', 'b'),
 item: kit.item('a', 'b', {on: true}),
 tile: kit.tile('x'),
 stack: kit.stack(['a', 'b'], {gap: 4}),
 upright: kit.upright('x'),
 toggle: kit.toggle(true, {label: 'Auto resolution'}),
 picker: kit.picker('HIGH'),
 segments: kit.segments(5, 0, 8),
 tabs: kit.tabs(['OVERVIEW', 'LOCKER'], 'LOCKER'),
 chip: kit.chip('Draw', {hot: true}),
 level: kit.level(23),
 keyHint: kit.keyHint('ESC', 'BACK'),
};

test('every class the kit writes starts uk-, so it cannot restyle the old interface', () => {
 for (const [name, html] of Object.entries(SAMPLES))
  for (const m of html.matchAll(/class="([^"]*)"/g))
   for (const c of m[1].split(/\s+/).filter(Boolean))
    assert.ok(c === 'uk' || c.startsWith('uk-'), `${name} writes class "${c}"`);
});

test('every rule in the kit\'s stylesheet is scoped to .uk', () => {
 assert.ok(RULES.length > 20);
 for (const [sel] of RULES)
  for (const one of sel.split(',').map(s => s.trim()))
   assert.match(one, /^\.uk(?=[ .{>:]|$)/, `"${one}" is not scoped to .uk`);
});

test('the straightening wrappers never carry a colour, or the boxes would stand upright', () => {
 for (const [sel, body] of RULES) {
  const last = sel.split(',').map(s => s.trim().split(/[ >]+/).pop());
  if (last.some(s => /\.uk-(pi|u)$/.test(s))) assert.doesNotMatch(body, /background/, `${sel} sets a background`);
 }
 // The panel leans -12 and its wrapper +12; inside the sheet the panel does not lean.
 assert.match(bodyOf('.uk .uk-p'), /skewX\(-12deg\)/);
 assert.match(bodyOf('.uk .uk-pi'), /skewX\(12deg\)/);
 assert.match(bodyOf('.uk .uk-sheet'), /skewX\(-12deg\).*transform-origin:0 50%/);
 assert.match(bodyOf('.uk .uk-sheet .uk-p'), /transform:none/);
});

test('the stylesheet keeps the layout rules\' sizes', () => {
 for (const [name, size] of Object.entries(TYPE)) assert.match(bodyOf(`.uk .uk-${name}`), new RegExp(`font-size:${size}px`), name);
 assert.match(bodyOf('.uk .uk-p'), new RegExp(`padding:${PANEL_PAD.y}px ${PANEL_PAD.x}px`));
 assert.match(bodyOf('.uk .uk-p.uk-row'), new RegExp(`height:${HEIGHTS.row}px`));
 assert.match(bodyOf('.uk .uk-p.uk-item'), new RegExp(`height:${HEIGHTS.item}px`));
 assert.match(bodyOf('.uk .uk-p.uk-tile'), new RegExp(`height:${HEIGHTS.tile}px`));
 // Selection follows the slanted shape: shadows of the box, not a border or inner box.
 assert.match(bodyOf('.uk .uk-p.uk-on'), /drop-shadow/);
 assert.doesNotMatch(bodyOf('.uk .uk-p.uk-on'), /border|outline/);
 // The old stylesheet turns synthesis off page-wide; the kit needs the slant back.
 assert.match(bodyOf('.uk'), /font-synthesis:style/);
});

test('the typeface ships inside the build: two local woff2 files, nothing fetched', () => {
 const faces = [...CSS.matchAll(/@font-face\{([^}]*)\}/g)].map(m => m[1]);
 assert.deepEqual(faces.map(f => /font-weight:(\d+)/.exec(f)[1]).sort(), ['700', '800']);
 for (const f of faces) {
  assert.match(f, /font-family:"Saira Condensed"/);
  const url = /url\("([^"]+)"\)/.exec(f)[1];
  assert.match(url, /^\.\/fonts\/[a-z0-9-]+\.woff2$/, 'a file beside the source, which the build inlines');
  const bytes = fs.readFileSync(new URL(url, new URL('../src/', import.meta.url)));
  assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', `${url} is a woff2 file`);
  assert.ok(bytes.length < 40000, `${url} stays a Latin subset (${bytes.length} bytes)`);
 }
 assert.doesNotMatch(CSS, /https?:\/\//);
 // The licence travels with the files.
 assert.match(fs.readFileSync(new URL('../src/fonts/OFL.txt', import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
});

test('text is escaped; a golfer named <b> stays a name', () => {
 assert.equal(kit.esc(`<b>"Ann" & 'Ben'</b>`), '&lt;b&gt;&quot;Ann&quot; &amp; &#39;Ben&#39;&lt;/b&gt;');
 assert.doesNotMatch(kit.type('title', '<img src=x>'), /<img/);
 assert.doesNotMatch(kit.chip('<script>'), /<script/);
 assert.doesNotMatch(kit.picker('<i>'), /<i>/);
 assert.doesNotMatch(kit.tabs(['<b>'], '<b>'), /<b>/);
 assert.throws(() => kit.type('huge', 'x'));
});

test('the root wears the palette and the canvas frame', () => {
 const p = screenPalette({screen: 'round', course: {biome: 'haunted'}});
 const html = kit.kitRoot(p, '', {frame: canvasFrame({width: 1920, height: 1080})});
 assert.match(html, /class="uk uk-canvas"/);
 assert.match(html, /--panel:rgba\(26,12,42,\.9\)/);
 assert.match(html, /--on-hot:#1a0a2e/);
 assert.match(html, /width:1280px;height:720px;transform:scale\(1\.5\)/);
 assert.match(kit.kitRoot(null, ''), /^<div class="uk" style="">/);
});

test('boxes go where the grid says, and controls say what they are', () => {
 const s = grid.span(4, 8);
 const html = kit.place(grid, 4, 8, 152, 'x');
 assert.match(html, new RegExp(`left:${Math.round(s.left * 100) / 100}px;top:56px;width:${Math.round(s.width * 100) / 100}px`));
 assert.match(kit.toggle(true), /role="switch" aria-checked="true".*>ON</);
 assert.match(kit.toggle(false), /aria-checked="false".*>OFF</);
 assert.equal((kit.segments(5, 0, 8).match(/uk-seg-on/g) || []).length, 5);
 assert.equal((kit.segments(99, 0, 8).match(/uk-seg-on/g) || []).length, 8);
 assert.equal((kit.segments(-1, 0, 8).match(/uk-seg-on/g) || []).length, 0);
 assert.equal((kit.segments(3, 0, 0).match(/uk-seg-on/g) || []).length, 0);
 assert.equal((kit.segments(.5, 0, 1, {count: 16}).match(/<b/g) || []).length, 16);
 const t = kit.tabs(['A', 'B', 'C'], 'B');
 assert.equal((t.match(/aria-selected="true"/g) || []).length, 1);
 assert.equal((t.match(/uk-hl/g) || []).length, 1);
 assert.match(kit.type('value', '-2', {under: true}), /uk-value uk-under/);
});
