// The ground drawn coarser (ground-lod.js `groundTolerance`, pixels): what
// each step buys on a large built course (the frame-rate goal, 9 November 2026).
const tol = px => ({name: `ground tolerance ${px} px`, apply: `v._tol = v.quality.groundTolerance; v.quality.groundTolerance = ${px}; v.groundLod.key = '';`, undo: `v.quality.groundTolerance = v._tol; v.groundLod.key = '';`});
export const variants = [
 tol(2), tol(4), tol(8),
 {name: 'no ground drawn', apply: 'v.groundLod.group.visible = false;', undo: 'v.groundLod.group.visible = true;'},
 {name: 'ground, coarse squares only', apply: 'v._fine = []; for (const [n, p] of v.groundLod.meshes) if (p.fine && p.fine.visible) { v._fine.push(p.fine); p.fine.visible = false; }', undo: 'for (const m of v._fine) m.visible = true;'},
];
