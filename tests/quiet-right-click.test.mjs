// Right click does nothing in the game (src/quiet-right-click.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {quietRightClick} from '../src/quiet-right-click.js';

class Press extends Event {
 constructor(type, button, extra = {}) { super(type, {cancelable: true, bubbles: true}); this.button = button; Object.assign(this, extra); }
}
function page() {
 const t = new EventTarget(), heard = [];
 quietRightClick(t);
 for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'contextmenu']) t.addEventListener(type, e => heard.push(`${type}:${e.button}`));
 return {t, heard};
}

test('a right press and its release reach nothing, and the menu stays shut', () => {
 const {t, heard} = page();
 for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick']) { const e = new Press(type, 2); t.dispatchEvent(e); assert.ok(e.defaultPrevented, type); }
 const menu = new Press('contextmenu', 2); t.dispatchEvent(menu);
 assert.ok(menu.defaultPrevented, 'no browser menu');
 assert.deepEqual(heard, []);
});

test('the left button is untouched', () => {
 const {t, heard} = page();
 for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) t.dispatchEvent(new Press(type, 0));
 assert.deepEqual(heard, ['pointerdown:0', 'mousedown:0', 'pointerup:0', 'mouseup:0']);
});

test('a left drag that ends on the right button still ends', () => {
 const {t, heard} = page();
 t.dispatchEvent(new Press('pointerdown', 0));
 // The right was pressed during the drag (no press event for it), and the
 // pointer's only release is the right button's.
 t.dispatchEvent(new Press('pointerup', 2));
 assert.deepEqual(heard, ['pointerdown:0', 'pointerup:2']);
});

test('a box being typed in keeps its menu', () => {
 const t = new EventTarget(); quietRightClick(t);
 const input = new EventTarget(); input.tagName = 'INPUT';
 const e = new Press('contextmenu', 2);
 Object.defineProperty(e, 'target', {value: input});
 t.dispatchEvent(e);
 assert.equal(e.defaultPrevented, false);
});
