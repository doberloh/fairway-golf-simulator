// How the same trees and ground could be drawn for less (run 6 of the
// frame-rate goal). For tools/frame-variants.mjs; `v` is the renderer.
const resize = (size, radius) => `const l = v.csm.lights[0]; l.shadow.mapSize.set(${size}, ${size}); l.shadow.radius = ${radius}; l.shadow.map?.dispose(); l.shadow.map = null; v.cascadeForce = true;`;
export const variants = [
 // Opaque things are drawn in the order three sorts them, and every tree
 // mesh spans the course, so the ground can be shaded under trees that then
 // cover it. Drawn last, the depth test skips it wherever a tree stands.
 {name: 'ground drawn after the trees', apply: 'v._ro = [v.terrain.renderOrder, v.landscape?.renderOrder]; v.terrain.renderOrder = 1; if (v.landscape) v.landscape.renderOrder = 1;',
  undo: 'v.terrain.renderOrder = v._ro[0]; if (v.landscape) v.landscape.renderOrder = v._ro[1];'},
 // Diagnostics, not candidates: what the ground's and the trees' shading cost.
 {name: 'ground flat-shaded (diagnostic)', apply: 'v._gm = v.terrain.material; v.terrain.material = new v.ballRing.material.constructor({color: 0x557744});',
  undo: 'v.terrain.material.dispose(); v.terrain.material = v._gm;'},
 {name: 'trees flat-shaded (diagnostic)', apply: 'v._tm = []; const m = new v.ballRing.material.constructor({color: 0x335522}); v.group.traverse(o => { if (o.isInstancedMesh && o.userData.cullTotal !== undefined) { v._tm.push([o, o.material]); o.material = m; } });',
  undo: 'for (const [o, m] of v._tm) o.material = m;'},
 {name: 'near map 4096, same blur', apply: resize(4096, 2.67), undo: resize(6144, 4)},
 {name: 'pixel ratio 1.5 (diagnostic)', apply: 'v.renderer.setPixelRatio(1.5);', undo: 'v.renderer.setPixelRatio(2);'},
];
