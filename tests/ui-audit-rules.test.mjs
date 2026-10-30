// The interface audit's rules (tools/ui-audit-rules.mjs): each one shown a
// layout made up to break it, and one that keeps to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {overlaps, clipped, offscreen, offCentre, highlights, targets, readable, body, glyphs, explained, LINES, textLine} from '../tools/ui-audit-rules.mjs';

const R = (x, y, w, h) => ({x, y, w, h});
let n = 0;
const rec = (o = {}) => ({i: n++, parent: -1, path: `el${n}`, rect: R(0, 0, 100, 40), skew: 0, interactive: false, text: '', ...o});
const rules = list => list.map(f => f.rule);

test('two controls on top of each other overlap; neighbours and a control holding its own label do not', () => {
 n = 0;
 const a = rec({interactive: true, rect: R(0, 0, 100, 40)}), b = rec({interactive: true, rect: R(50, 10, 100, 40)});
 assert.deepEqual(rules(overlaps([a, b])), ['overlap']);
 const c = rec({interactive: true, rect: R(110, 0, 100, 40)});
 assert.deepEqual(overlaps([a, c]), []);
 const label = rec({parent: a.i, text: 'Play', textRect: R(10, 10, 40, 20)});
 assert.deepEqual(overlaps([a, label]), [], 'text inside a control is the control');
});

test('leaning neighbours are compared at their middle, so their slanted corners do not count', () => {
 n = 0;
 // Two 40-tall boxes leaning 12 degrees, 4 px apart: their bounding boxes
 // overlap by the lean (about 8.5 px across a 40 px height) but the boxes do not.
 const lean = Math.tan(12 * Math.PI / 180), w = 120 + 40 * lean;
 const a = rec({interactive: true, skew: -lean, rect: R(0, 0, w, 40)}), b = rec({interactive: true, skew: -lean, rect: R(124, 0, w, 40)});
 assert.ok(a.rect.x + a.rect.w > b.rect.x, 'the bounding boxes overlap');
 assert.deepEqual(overlaps([a, b]), []);
 assert.ok(Math.abs(body(a).w - 120) < 1e-9);
});

test('two lines of text set tight touch boxes, not letters; lines over each other overlap', () => {
 n = 0;
 const top = rec({text: 'ALEX', textRect: R(0, 0, 60, 30)}), under = rec({text: 'CLUB REGULAR', textRect: R(0, 26, 80, 14)});
 assert.deepEqual(overlaps([top, under]), [], 'four pixels of font box');
 const over = rec({text: 'KELPIE BEND', textRect: R(0, 10, 80, 30)});
 assert.deepEqual(rules(overlaps([top, over])), ['overlap']);
 assert.deepEqual(glyphs(R(0, 0, 10, 100)), R(0, 20, 10, 65));
});

test('content under a fixed foot that can scroll clear of it is not an overlap; content that cannot is', () => {
 n = 0;
 const foot = rec({interactive: true, fixed: true, rect: R(250, 700, 100, 33)});
 const card = rec({interactive: true, rect: R(200, 650, 160, 80), scrollRoom: 90});
 assert.deepEqual(overlaps([foot, card]), []);
 assert.deepEqual(rules(overlaps([foot, {...card, scrollRoom: 10}])), ['overlap']);
});

test('covered things are not compared: a sheet over the round screen is not an overlap', () => {
 n = 0;
 const a = rec({interactive: true, covered: true}), b = rec({interactive: true, rect: R(10, 10, 100, 40)});
 assert.deepEqual(overlaps([a, b]), []);
});

test('text past the box that hides its overflow is clipped; an ellipsis is reported apart', () => {
 n = 0;
 const cut = rec({text: 'Saved courses', textRect: R(0, 0, 120, 20), clip: R(0, 0, 100, 20)});
 assert.deepEqual(rules(clipped([cut])), ['clipped']);
 assert.deepEqual(rules(clipped([{...cut, ellipsis: true}])), ['ellipsis']);
 assert.deepEqual(clipped([{...cut, textRect: R(0, 0, 101, 20)}]), [], 'a pixel of antialiasing is not a cut');
 // A box that scrolls down between the text and its clip: below it is reached
 // by scrolling, but past its side it is still cut off.
 const below = rec({text: 'Surprise me', textRect: R(0, 140, 80, 20), clip: {...R(0, 0, 100, 100), reach: {x: false, y: true}}});
 assert.deepEqual(clipped([below]), [], 'scrolled to, not cut');
 assert.deepEqual(rules(clipped([{...below, textRect: R(0, 140, 130, 20)}])), ['clipped'], 'too wide is still cut');
});

test('off the screen with no scroll to reach it is a finding; inside a scroll box on screen is not', () => {
 n = 0;
 const view = {width: 390, height: 844};
 const gone = rec({interactive: true, rect: R(300, 820, 120, 48)});
 assert.deepEqual(rules(offscreen([gone], view)), ['offscreen']);
 assert.deepEqual(offscreen([{...gone, scroll: R(0, 100, 390, 700)}], view), []);
 assert.deepEqual(offscreen([rec({interactive: true, rect: R(10, 10, 100, 40)})], view), []);
});

test('content off the middle of a centring button is off-centre, past the line', () => {
 n = 0;
 const b = rec({interactive: true, centreX: true, centreY: true, content: R(0, 0, 100, 40), inner: R(36, 10, 40, 20)});
 assert.deepEqual(rules(offCentre([b])), ['off-centre'], '6 px right');
 assert.deepEqual(offCentre([{...b, inner: R(31, 10, 40, 20)}]), [], '1 px is within the line');
 assert.deepEqual(rules(offCentre([{...b, inner: R(30, 4, 40, 20)}])), ['off-centre'], '6 px high');
 assert.deepEqual(offCentre([{...b, centreX: false, centreY: false, inner: R(0, 0, 40, 20)}]), [], 'a left-aligned control is not centring');
});

test('two in a list outlined alike are the double yellow boxes; chosen yellow beside a white cursor is not', () => {
 n = 0;
 const list = rec();
 const card = (o) => rec({interactive: true, parent: list.i, ...o});
 const chosen = card({ring: 'hot'}), cursor = card({ring: 'hot', focused: true});
 assert.deepEqual(rules(highlights([list, chosen, cursor])), ['two-highlights']);
 const cursorWhite = card({ring: 'white', focused: true});
 assert.deepEqual(highlights([list, chosen, cursorWhite]), []);
 // A white ring away from the focus does not follow the keys.
 const stray = card({ring: 'white'}), focusElsewhere = card({focused: true});
 assert.deepEqual(rules(highlights([list, stray, focusElsewhere])), ['highlight-not-focus']);
 // Two filled as chosen in one list.
 assert.deepEqual(rules(highlights([list, card({fill: true}), card({fill: true})])), ['two-chosen']);
 // Check boxes take several.
 assert.deepEqual(highlights([list, card({ring: 'hot', multi: true}), card({ring: 'hot', multi: true})]), []);
});

test('two white cursors in different places on one screen are two cursors', () => {
 n = 0;
 const a = rec({interactive: true, ring: 'white', focused: true}), b = rec({interactive: true, ring: 'white'});
 assert.ok(rules(highlights([a, b])).includes('two-highlights'));
});

test('touch targets: under 44 px is small, under 24 px tiny; a control inside a larger one is its part', () => {
 n = 0;
 const small = rec({interactive: true, rect: R(0, 0, 100, 36)}), tiny = rec({interactive: true, rect: R(0, 0, 20, 20)});
 assert.deepEqual(rules(targets([small, tiny], {touch: true})), ['small-target', 'tiny-target']);
 assert.deepEqual(targets([small, tiny], {touch: false}), [], 'a mouse needs no 44 px');
 const big = rec({interactive: true, rect: R(0, 0, 200, 60)}), inner = rec({interactive: true, parent: big.i, rect: R(5, 5, 20, 20)});
 assert.deepEqual(targets([big, inner], {touch: true}), []);
 assert.deepEqual(targets([{...tiny, disabled: true}], {touch: true}), []);
});

test('contrast against what the text sits on, with the large-text line; small type against the kit\'s floor', () => {
 n = 0;
 const view = {width: 1280, height: 720};
 const faint = rec({text: 'Choose', color: 'rgb(120,120,120)', bg: 'rgb(90,90,90)', fontPx: 14});
 assert.deepEqual(rules(readable([faint], view)), ['contrast']);
 const strong = rec({text: 'Choose', color: 'rgb(255,255,255)', bg: 'rgb(20,30,25)', fontPx: 14});
 assert.deepEqual(readable([strong], view), []);
 // 3.5:1 passes as large text only.
 const mid = {color: 'rgb(255,255,255)', bg: 'rgb(130,130,130)'};
 assert.deepEqual(rules(readable([rec({text: 'x', ...mid, fontPx: 16})], view)), ['contrast']);
 assert.deepEqual(readable([rec({text: 'x', ...mid, fontPx: 28})], view), []);
 // Words under something else (a phone sheet's foot) are judged where they
 // are scrolled to, not read through the foot.
 assert.deepEqual(readable([rec({text: 'x', ...mid, fontPx: 16, textCovered: true})], view), []);
 // Words scrolled out of the box that clips them are not drawn: no contrast.
 assert.deepEqual(readable([rec({text: 'x', ...mid, fontPx: 16, textRect: R(0, 300, 40, 20), clip: R(0, 0, 100, 200)})], view), []);
 assert.deepEqual(readable([rec({text: 'x', ...mid, fontPx: 16, textRect: R(0, 300, 40, 20), clip: R(0, 290, 100, 60), scroll: R(0, 0, 100, 200)})], view), [], 'scrolled out of its column');
 assert.deepEqual(rules(readable([rec({text: 'LV 14', ...strong, fontPx: 10})], view)), ['small-text']);
 assert.equal(textLine({height: 2160}), LINES.text * 2, 'scaled with the screen above 1080p');
 assert.equal(textLine({height: 844}, {touch: true}), LINES.phoneText);
 assert.deepEqual(readable([rec({text: 'LV 14', ...strong, fontPx: 11})], {width: 390, height: 844}, {touch: true}), []);
});

test('a known finding is matched by rule and a piece of its path, and optionally its screen and size', () => {
 const f = {rule: 'small-text', path: 'div.rh-mc-xp > span "LEVEL 14"', screen: 'main-menu', size: '1280x720'};
 assert.ok(explained(f, [{rule: 'small-text', path: 'rh-mc-xp', why: 'x'}]));
 assert.equal(explained(f, [{rule: 'contrast', path: 'rh-mc-xp', why: 'x'}]), null);
 assert.equal(explained(f, [{rule: 'small-text', path: 'rh-mc-xp', size: '390x844', why: 'x'}]), null);
 // A group: several rules, any path, screens by prefix, a list of sizes.
 const group = {rules: ['small-text', 'contrast'], screens: ['round'], sizes: [f.size], why: 'x'};
 assert.equal(explained({...f, screen: 'round-pause'}, [group]), group);
 assert.equal(explained({...f, screen: 'play'}, [group]), null, 'another screen');
 assert.equal(explained({...f, screen: 'round', size: '1x1'}, [group]), null, 'another size');
 assert.ok(explained(f, [{rule: 'small-text', path: 'rh-mc-xp', screen: 'main', why: 'x'}]));
});
