// The processor's share of an Ultra frame. For tools/frame-variants.mjs; `v`
// is the renderer (GolfView).
export const variants = [
 // holdFlagsticks reads the canvas's clientHeight every frame; after any change
 // to the page that read lays the page out there and then. Answered from a
 // stored number instead, the layout either goes away or moves to the end of
 // the frame -- which of the two is the question.
 {name: 'canvas size read without layout',
  apply: 'const c = v.canvas; v._ch = [c.clientWidth, c.clientHeight]; Object.defineProperty(c, "clientHeight", {configurable: true, get: () => v._ch[1]}); Object.defineProperty(c, "clientWidth", {configurable: true, get: () => v._ch[0]});',
  undo: 'delete v.canvas.clientHeight; delete v.canvas.clientWidth;'},
 {name: 'shadow maps frozen (all)', apply: 'for (const l of v.csm.lights) l.shadow.autoUpdate = false;', undo: 'for (const l of v.csm.lights) l.shadow.autoUpdate = true;'},
];
