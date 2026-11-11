// KEYBOARD SHORTCUTS AND MENUS, as rules (the builder-ux goal, 10 November
// 2026: "more like an MS Paint/real 3d editor"). A screen gives its menus as
// data -- [{name, items: [{label, key?, run, enabled?, checked?} | {sep: true}]}]
// -- and every command with a key is reached by that key too, the way a paint
// program's are. Pure; tests/builder-shortcuts.test.mjs. The menu bar that
// draws them is menu.js.

// 'Ctrl+Shift+Z', 'B', '[', 'Delete', '?' -> {ctrl, shift, alt, key}.
export function parseKey(spec) {
 const parts = spec.split('+'), key = parts.pop() || '+';
 const has = m => parts.some(p => p.toLowerCase() === m);
 return {ctrl: has('ctrl'), shift: has('shift'), alt: has('alt'), key: key.length === 1 ? key.toLowerCase() : key};
}
// Does a keydown match a spec? Ctrl means Ctrl or the Mac's Command. A
// printable key that needs Shift to type ('?', '{') matches whatever Shift
// says; a plain letter wants no Ctrl or Alt, so B is a tool and Ctrl+B is not.
export function matches(spec, e) {
 const k = parseKey(spec), ctrl = !!(e.ctrlKey || e.metaKey), key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
 if (k.ctrl !== ctrl || k.alt !== !!e.altKey) return false;
 const shifted = k.key.length === 1 && !/[a-z0-9]/.test(k.key);
 if (!shifted && k.shift !== !!e.shiftKey) return false;
 return key === k.key;
}
// The command a keydown runs, or null. Typing in a box keeps its keys, but
// the Ctrl shortcuts (save, undo) still work from anywhere but a text box,
// where the box's own undo wins.
export function commandFor(menus, e, {typing = false} = {}) {
 for (const m of menus) for (const it of m.items) {
  if (!it.key || it.sep) continue;
  for (const spec of [].concat(it.key)) {
   if (!matches(spec, e)) continue;
   if (typing && !parseKey(spec).ctrl) continue;
   if (typing && parseKey(spec).ctrl && /^[zyacvx]$/.test(parseKey(spec).key)) continue;
   return it;
  }
 }
 return null;
}
// How a key reads in a menu or the shortcuts sheet: 'Ctrl+Shift+Z'.
export const keyLabel = spec => [].concat(spec)[0].split('+').map(p => p.length === 1 ? p.toUpperCase() : p).join('+');
// The shortcuts sheet: every command with a key, by menu, then the extra
// lines a screen adds (the view's own controls, which are not commands).
export function shortcutRows(menus, extra = []) {
 const rows = [];
 for (const m of menus) for (const it of m.items) if (it.key && !it.sep) rows.push({group: m.name, label: it.label, key: keyLabel(it.key)});
 return [...rows, ...extra];
}
