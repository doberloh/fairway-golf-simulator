// The landscape pictures' loop (src/picture-loop.js): its schedule, and the
// DOM side against a small stand-in document.
import test from 'node:test';
import assert from 'node:assert/strict';
import {nextIndex, startIndex, createPictureLoop, HOLD_MS, FADE_MS} from '../src/picture-loop.js';

test('the loop steps through every picture and comes round again', () => {
 const seen = [];
 for (let i = 0, k = 0; k < 8; k++, i = nextIndex(i, 4)) seen.push(i);
 assert.deepEqual(seen, [0, 1, 2, 3, 0, 1, 2, 3]);
 assert.equal(nextIndex(0, 1), 0);
 assert.equal(nextIndex(3, 0), 0);
});

test('a card starts on the same picture every time, and neighbours differ', () => {
 assert.equal(startIndex('saved:c1', 4), startIndex('saved:c1', 4));
 const starts = new Set(['week', 'endless', 'saved:a', 'saved:b', 'land:pnw', 'land:desert', 'land:links', 'land:island'].map(k => startIndex(k, 4)));
 assert.ok(starts.size > 1, 'eight cards do not all start on one picture');
 for (const k of ['a', 'b', 'c']) assert.ok(startIndex(k, 5) >= 0 && startIndex(k, 5) < 5);
 assert.equal(startIndex('x', 0), 0);
});

test('a picture holds long enough to see, and the fade is short of it', () => {
 assert.ok(HOLD_MS >= 3000 && HOLD_MS <= 8000);
 assert.ok(FADE_MS >= 600 && FADE_MS < HOLD_MS / 2);
});

// A stand-in for the few DOM calls the loop makes.
function fakeDoc() {
 const make = tag => {
  const e = {tagName: tag.toUpperCase(), children: [], classList: null, isConnected: true, parent: null, attrs: {},
   append(...cs) { for (const c of cs) { c.parent = e; e.children.push(c); } },
   remove() { if (e.parent) e.parent.children = e.parent.children.filter(c => c !== e); e.parent = null; e.isConnected = false; },
   setAttribute(k, v) { e.attrs[k] = v; },
   querySelector(sel) {
    if (sel === ':scope>.pic-loop') return e.children.find(c => c.className === 'pic-loop') || null;
    if (sel === 'img.on') return e.children.find(c => c.tagName === 'IMG' && c.classList.contains('on')) || null;
    return null;
   },
   getBoundingClientRect: () => ({width: 200, top: 10, bottom: 110}),
  };
  let cls = new Set();
  Object.defineProperty(e, 'className', {get: () => [...cls].join(' '), set: v => { cls = new Set(String(v).split(' ').filter(Boolean)); }});
  e.classList = {add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c)};
  return e;
 };
 return {createElement: make};
}
function fakeWin() {
 const w = {innerHeight: 800, intervals: 0, frames: [], timeouts: [],
  setInterval: () => (++w.intervals), clearInterval: () => { w.intervals = 0; },
  requestAnimationFrame: f => w.frames.push(f), setTimeout: f => w.timeouts.push(f)};
 w.flush = () => { for (const f of w.frames.splice(0)) f(); for (const f of w.timeouts.splice(0)) f(); };
 return w;
}

test('a card gets one picture at first, and the next only when it fades in', () => {
 const doc = fakeDoc(), win = fakeWin(), card = doc.createElement('div');
 const loop = createPictureLoop({pictures: () => ['a.webp', 'b.webp', 'c.webp', 'd.webp'], doc, win});
 loop.queue([{el: card, key: 'k'}]);
 const box = card.children[0];
 assert.equal(box.className, 'pic-loop');
 assert.equal(box.children.length, 1, 'only the picture on show is loaded');
 assert.equal(win.intervals, 1, 'one timer');
 loop.tick();
 assert.equal(box.children.length, 2, 'the next is added to fade in');
 win.flush();
 assert.equal(box.children.length, 1, 'the one that faded out is gone');
 assert.ok(box.children[0].classList.contains('on'));
});

test('reduced motion holds a card still; a card taken off the page stops the timer', () => {
 const doc = fakeDoc(), win = fakeWin(), card = doc.createElement('div');
 const loop = createPictureLoop({pictures: () => ['a', 'b'], still: () => true, doc, win});
 loop.queue([{el: card, key: 'k'}]);
 const first = card.children[0].children[0].src;
 loop.tick(); win.flush();
 assert.equal(card.children[0].children.length, 1);
 assert.equal(card.children[0].children[0].src, first);
 card.children[0].isConnected = false;
 loop.tick();
 assert.equal(loop.size, 0);
 assert.equal(win.intervals, 0, 'no card, no timer');
});

test('drawing a card again replaces its loop rather than stacking a second', () => {
 const doc = fakeDoc(), win = fakeWin(), card = doc.createElement('div');
 const loop = createPictureLoop({pictures: () => ['a', 'b'], doc, win});
 loop.queue([{el: card, key: 'k'}]);
 loop.queue([{el: card, key: 'k'}]);
 assert.equal(card.children.filter(c => c.className === 'pic-loop').length, 1);
 assert.equal(loop.size, 1);
});

test('one card changes at a time, in turn, so no tick decodes many pictures at once', () => {
 const doc = fakeDoc(), win = fakeWin();
 const cards = [doc.createElement('div'), doc.createElement('div'), doc.createElement('div')];
 const loop = createPictureLoop({pictures: () => ['a', 'b', 'c'], doc, win});
 loop.queue(cards.map((el, i) => ({el, key: 'k' + i})));
 const count = () => cards.map(c => c.children[0].children.length);
 loop.tick();
 assert.equal(count().filter(n => n === 2).length, 1, 'one card fading in its next picture');
 win.flush();
 loop.tick(); win.flush(); loop.tick();
 assert.equal(count().filter(n => n === 2).length, 1, 'again one, the next in turn');
});
