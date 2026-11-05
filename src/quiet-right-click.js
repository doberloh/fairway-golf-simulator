// RIGHT CLICK DOES NOTHING IN THE GAME (the owner, 4 November 2026: "right
// click should not do anything in the actual game"). Before this, a right
// press opened the browser's menu over the course, dragged the free camera,
// picked up the map and closed menus, because those listen for any button.
//
// So the press is stopped before anything hears it, in one place, rather than
// by a guard in each listener (a new listener would have forgotten it). The
// release of that press goes with it, or a listener would see an end to
// something that never began. A left button held at the same time is left
// alone: the browser sends no press for a second button, so a left drag ends
// with the release it always had.
//
// The menu stays in a box being typed in: paste and spelling are the player's.
// The builder is another page and keeps its right drag. Takes its target, so
// Node tests it (tests/quiet-right-click.test.mjs).
const TYPING = /^(INPUT|TEXTAREA)$/;
const typedIn = t => TYPING.test(t?.tagName || '') || !!t?.isContentEditable;

export function quietRightClick(target) {
 let held = false;
 const swallow = e => { e.stopImmediatePropagation(); e.preventDefault(); };
 const press = e => { if (e.button !== 2) return; held = true; swallow(e); };
 const release = e => { if (e.button !== 2 || !held) return; held = false; swallow(e); };
 const opts = {capture: true};
 target.addEventListener('pointerdown', press, opts);
 target.addEventListener('mousedown', press, opts);
 target.addEventListener('pointerup', release, opts);
 target.addEventListener('mouseup', e => { if (e.button === 2) swallow(e); }, opts);
 target.addEventListener('auxclick', e => { if (e.button === 2) swallow(e); }, opts);
 target.addEventListener('contextmenu', e => { if (!typedIn(e.target)) swallow(e); }, opts);
}
