// The last few per cent (run 14 of the frame-rate goal). For
// tools/frame-variants.mjs; `v` is the renderer, at checkpoint 4.
export const variants = [
 // Middle cascade (100-500 m) every fourth frame instead of every other, on
 // the frames neither the far one nor it drew before. Diagnostic wrap: it
 // also overrides a forced redraw, which the built version would not.
 {name: 'middle cascade every 4th frame', apply: 'v._sched = v.scheduleCascades; v.scheduleCascades = function () { v._sched.call(this); const l = this.csm.lights[1]; if (this.cascadeFrame % 4 !== 3 && l.shadow.map) l.shadow.autoUpdate = false; else l.shadow.autoUpdate = true; };',
  undo: 'v.scheduleCascades = v._sched;'},
 // What the mist's distance tint costs on every pixel (diagnostic: a look).
 {name: 'aerial tint off (diagnostic)', apply: 'v._ae = v.mistUniforms.aerialStrength.value; v.mistUniforms.aerialStrength.value = 0;', undo: 'v.mistUniforms.aerialStrength.value = v._ae;'},
];
