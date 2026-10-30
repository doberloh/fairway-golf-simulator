import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWindow} from '../src/ui-windows.js';

// A stand-in for the few DOM calls makeWindow makes.
function fakeDoc() {
 const make = tag => {
  const e = {tagName: tag.toUpperCase(), children: [], attrs: {}, dataset: {}, className: '', innerHTML: '', id: '', type: '', onclick: null,
   append(...cs) { e.children.push(...cs); }, setAttribute(k, v) { e.attrs[k] = v; }};
  return e;
 };
 return {createElement: make};
}

// The windows are square since 28 October 2026 (the owner); what is left is
// the window itself: a title, a line, and a row per choice, the main one hot.
test('a window is a title, its line and a row per choice, the main one marked', () => {
 let pressed = null;
 const w = makeWindow({id: 'pause', title: 'Paused <now>', line: 'Pick one', rows: [
  {id: 'resume', label: 'Resume', key: 'Esc', hot: true, act: () => { pressed = 'resume'; }},
  {id: 'leave', label: 'Leave', sub: 'Back to the menu'},
 ]}, fakeDoc());
 assert.equal(w.id, 'pause');
 assert.equal(w.attrs.role, 'dialog');
 assert.equal(w.attrs['aria-label'], 'Paused <now>');
 assert.deepEqual(w.children.map(c => c.className), ['w13-title', 'w13-line', 'w13-row hot', 'w13-row']);
 assert.equal(w.children[0].innerHTML, 'Paused &lt;now&gt;', 'the title is escaped');
 assert.match(w.children[2].innerHTML, /<kbd>Esc<\/kbd>/);
 assert.match(w.children[3].innerHTML, /<small>Back to the menu<\/small>/);
 assert.equal(w.children[2].dataset.row, 'resume');
 w.children[2].onclick();
 assert.equal(pressed, 'resume');
 w.children[3].onclick();
 assert.equal(pressed, 'resume', 'a row without an action does nothing');
});
