// THE GROUND PAINTED ONCE, FOR A PHONE (branch phone-performance, 15 November
// 2026; the owner: "Ok let's do all three phone only now"). On the owner's
// iPhone the ground's program costs a third of a frame in the chip's
// sustained state, and no one part of it does: plain paint, the same squares
// in a tiny program, saved 33 to 39% where cutting any one of the painter's
// parts saved 2 to 4% (RESEARCH, *The painting's parts, on the iPhone*). So
// on the Phone tier the painter runs into pictures, now and then, and the
// ground is drawn from them, lit and shadowed as before.
//
// THE PICTURES ARE NESTED SQUARES ROUND THE CAMERA, not one over the course or
// the hole: a phone draws 1,564 lines over 53 degrees, so the ground a few
// metres ahead is a few millimetres a pixel, and a picture laid over a hole
// (10 to 15 cm a texel) turned an edge by the ball into a smear tens of pixels
// wide. Three squares of 1,024 texels -- 32 m (about 3 cm a texel), 128 m
// (12.5 cm) and 512 m (50 cm) -- each set a little ahead of the camera along
// its view, and a fourth of 2,048 over the whole course (about 1.3 m). A
// pixel takes the finest square it lies in, blended into the next across the
// last few percent of its edge so no seam shows.
//
// WHAT IS PAINTED IS THE TURF, before light: everything ground.js works out
// for a pixel's colour (classification, mowing, ground types, relief, slope
// drying, shade under trees). The light, the shadows and the fog stay live.
// Two of the painter's touches look at the sun or the camera: the raking
// light is painted with the sun as it is and repainted when the sun has
// turned (BAKE.sunTurn); the grass sheen looks at the camera, which while
// painting is straight overhead, and is left out of the painting.
//
// Pure: numbers in, numbers out, and the shader text; no three.js. The
// renderer (renderer.js `updateGroundBake`) does the painting.

export const BAKE = Object.freeze({
 texels: 1024,              // a near square's side, in texels
 levels: Object.freeze([32, 128, 512]),  // the near squares' sides, metres
 courseTexels: 2048,        // the course's square
 ahead: .35,                // a square's centre this share of its side ahead of the camera
 stale: .25,                // repainted once its centre is this share of its side off
 every: 200,                // ms between repaints while the camera is moving
 fast: 10,                  // m/s: past it the finest square is not repainted
 sunTurn: 2,                // degrees of sun before everything is repainted
 edge: .06,                 // the share of a square's half-width blended into the next
 mipsFrom: 2,               // the first square with mipmaps: the 512 m one (renderer.js `target`)
 strips: 8,                 // bands a near square is repainted in, one a frame
 courseStrips: 16,          // and the course's square
});
// PLACED, every number above: the sizes from the arithmetic in this file's
// head, the rest to be read on the phone (Measure this device's "ground
// without the bake", and the owner's eye).

// Where a near square of side `size` should sit: `ahead` of the camera along
// its view, flattened onto the ground. `forward` need not be unit length.
export function levelCenter(camera, forward, size, ahead = BAKE.ahead) {
 const l = Math.hypot(forward.x, forward.z);
 if (!(l > 1e-6)) return {x: camera.x, z: camera.z};
 return {x: camera.x + forward.x / l * size * ahead, z: camera.z + forward.z / l * size * ahead};
}

// The course's square: centred on the ground grid (which runs -halfX..halfX,
// -halfZ..halfZ), its side the longer of the two.
export function courseSquare(halfX, halfZ) { return {x: 0, z: 0, size: 2 * Math.max(halfX, halfZ)}; }

// A point of the world in a square's picture, as the painting camera (an
// orthographic camera straight overhead, its up pointing to -z: renderer.js)
// lays it out: u along +x, v along -z, (0.5, 0.5) at the centre.
// tests/ground-bake.test.mjs holds this against three's own camera.
export function bakeUV(square, x, z) { return {u: (x - square.x) / square.size + .5, v: -(z - square.z) / square.size + .5}; }

// Whether a square painted at `painted` (null: never) is stale for `want`.
export function isStale(painted, want, size, stale = BAKE.stale) {
 return !painted || Math.hypot(painted.x - want.x, painted.z - want.z) > size * stale;
}

// Which square to repaint now, or -1. `squares`: [{painted, want, size,
// dirty}] (`dirty`: the sun turned or a cue changed since it was painted),
// finest first. Never painted: at once, coarsest first (a frame with the
// course's square missing would draw nothing). Otherwise at most one every
// `every` ms; the finest is skipped while the camera moves faster than
// `fast` (it would be stale again before it was seen). Coarsest stale first:
// it is what a pixel falls back to.
export function pickRepaint(squares, {now, last = -Infinity, speed = 0} = {}, rules = BAKE) {
 for (let i = squares.length - 1; i >= 0; i--) if (!squares[i].painted) return i;
 if (now - last < rules.every) return -1;
 for (let i = squares.length - 1; i >= 0; i--) {
  if (i === 0 && speed > rules.fast) continue;
  const s = squares[i];
  if (s.want && (s.dirty || isStale(s.painted, s.want, s.size, rules.stale))) return i;
 }
 return -1;
}

// THE PAINTED COLOUR IS STORED AS sqrt(c / 2) in eight bits a channel and read
// back as 2 s^2: the turf can run a little over 1 (its multipliers reach
// 1.3), and the square root spends the eight bits where the eye sees them.
export const encodeTurf = c => Math.sqrt(Math.min(1, Math.max(0, c / 2)));
export const decodeTurf = s => 2 * s * s;

// The baked material's fragment: the four squares sampled, each always (a
// texture read inside a branch has no mip level at a square's edge), weighted
// by whether the pixel lies in it and how far inside, finest last; the cup cut
// as the painter cuts it. `bakeRect[i]`: (centre x, centre z, side, painted).
// Square 3 is the course's.
export function bakeFragment(cupRadius) {
 return `
 vec2 bwp=groundPoint.xz;
 vec3 bc=vec3(.5);
 {vec4 r=bakeRect[3];vec4 s=texture2D(bake3,vec2((bwp.x-r.x)/r.z+.5,-(bwp.y-r.y)/r.z+.5));bc=2.*s.rgb*s.rgb;}
 #define BAKE_SQUARE(T,R) {vec4 r=R;vec2 uv=vec2((bwp.x-r.x)/r.z+.5,-(bwp.y-r.y)/r.z+.5);vec4 s=texture2D(T,uv);float e=.5-max(abs(uv.x-.5),abs(uv.y-.5));float w=r.w*smoothstep(0.,${BAKE.edge.toFixed(3)},e);bc=mix(bc,2.*s.rgb*s.rgb,w);}
 BAKE_SQUARE(bake2,bakeRect[2])
 BAKE_SQUARE(bake1,bakeRect[1])
 BAKE_SQUARE(bake0,bakeRect[0])
 diffuseColor.rgb=bc;
 if(distance(bwp,bakePin)<${cupRadius.toFixed(6)})discard;
`;
}
