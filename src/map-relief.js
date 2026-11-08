// RELIEF SHADING ON THE MAPS (the owner, 8 November 2026: "add the relief shading into the in game
// map"). The maps coloured the ground by its type and a touch brighter with height, so a mountain read
// as a flat brown patch; the views from straight above that the owner liked were lit from one side.
// This is that light: from the top left of the screen and above, the way maps have long been shaded,
// so slopes facing it brighten and slopes turned away darken. Flat ground is left exactly as it was.
//
// Worked in SCREEN terms, because the maps turn the world (the course map through 180 degrees, the
// hole map to point its hole up): the caller passes the height under a pixel, under the pixel to its
// right and under the pixel below, and the ground distance between them.
//
// Pure, no DOM or three.js (tests/map-relief.test.mjs). Every number PLACED.

// Toward the light: left on the screen, up out of it, toward the top. Unit length.
const LX = -.6, LY = .7, LZ = -.4, LN = Math.hypot(LX, LY, LZ);
const FLAT = LY / LN;
export const RELIEF = {strength: .9, min: .6, max: 1.3};

// The multiplier for a pixel's colour: 1 on flat ground.
export function reliefShade(h, hRight, hDown, step, {strength = RELIEF.strength, min = RELIEF.min, max = RELIEF.max} = {}) {
 if (!(step > 0) || ![h, hRight, hDown].every(Number.isFinite)) return 1;
 const gx = (hRight - h) / step, gy = (hDown - h) / step;
 // The ground's normal in screen terms is (-gx, 1, -gy).
 const lit = Math.max(0, (-gx * LX + LY - gy * LZ) / (Math.hypot(gx, 1, gy) * LN));
 return Math.min(max, Math.max(min, 1 + strength * (lit / FLAT - 1)));
}

// The same as an overlay over a ground already painted: black to darken, white to lighten, with the
// alpha that gives about the same change.
export function reliefOverlay(mult) {
 return mult < 1 ? [0, 0, 0, Math.min(1, 1 - mult)] : [255, 255, 255, Math.min(1, (mult - 1) * .8)];
}
