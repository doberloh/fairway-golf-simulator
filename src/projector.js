// The field of view a simulator bay actually has.
//
// A field-of-view slider is a look. In a bay it is a measurement: the screen is
// a window, the golfer stands a known distance from it, and there is exactly one
// vertical angle that makes what is drawn on the glass line up with what would
// be there if the wall were not. Set it wider and the course reads as further
// away than it is; set it narrower and a pitch shot looks like a drive.
//
// vertical FOV = 2 * atan((screen height / 2) / distance to the screen)
//
// Three.js takes the VERTICAL angle, and the horizontal one follows from the
// canvas aspect -- which is right as long as the projector fills the screen and
// the canvas fills the projector. Nothing here can check that; it is stated in
// the panel instead.

// How people describe a screen. Width over height.
export const ASPECTS = {'16:9': 16 / 9, '16:10': 16 / 10, '4:3': 4 / 3, '21:9': 21 / 9, '1:1': 1};
export const DEFAULT_ASPECT = '16:9';

export const INCHES_PER_FOOT = 12;
export const METRES_PER_INCH = 0.0254;

// A diagonal is what a screen is sold by; the height is what the angle needs.
// h = d / sqrt(1 + r^2) with r the width/height ratio, straight from Pythagoras.
// Kept for reading settings saved as a diagonal.
export function screenHeight(diagonal, aspect = DEFAULT_ASPECT) {
 const r = ASPECTS[aspect] ?? ASPECTS[DEFAULT_ASPECT];
 return Math.max(0, diagonal) / Math.sqrt(1 + r * r);
}

// Both measurements in the same unit -- the angle is a ratio, so inches against
// inches and metres against metres give the same answer.
//
// Clamped at both ends. A bay measured wrong (a zero distance, a screen entered
// in metres against a distance in feet) would otherwise ask three.js for a
// degenerate projection, and a camera that renders nothing is a worse answer
// than one that is merely not to scale.
export const FOV_MIN = 10, FOV_MAX = 140;
export function fovForScreen(height, distance) {
 if (!(height > 0) || !(distance > 0)) return null;
 const deg = 2 * Math.atan((height / 2) / distance) * 180 / Math.PI;
 return Math.min(FOV_MAX, Math.max(FOV_MIN, Math.round(deg * 10) / 10));
}

// THE SCREEN AS TWO MEASURED SIDES (the owner, 5 October). It used to be a
// diagonal and a shape picked from a list, which is how a screen is SOLD; a bay
// owner holds a tape measure to the one on the wall, and an impact screen is
// often no stock shape at all. The height is what the angle needs and the width
// gives the shape, so both are asked for directly and the shape is worked out.
// A diagonal and shape still work as input: that is how a setting saved before
// this change arrives (camera-prefs.js turns it into sides once).
const heightOf = ({screenHeight: h, diagonal, aspect = DEFAULT_ASPECT}) =>
 Number(h) > 0 ? Number(h) : screenHeight(diagonal, aspect);

// What the panel asks for: the screen's height in inches, and how far back the
// golfer stands in feet. Anything unusable comes back null so the caller can say
// so rather than silently rendering at some default.
export function projectorFov({standFeet, ...screen} = {}) {
 return fovForScreen(heightOf(screen), Number(standFeet) * INCHES_PER_FOOT);
}

// The two sides a diagonal and a stock shape describe: how an old setting
// becomes the new one.
export function sidesFromDiagonal(diagonal, aspect = DEFAULT_ASPECT) {
 const h = screenHeight(diagonal, aspect), r = ASPECTS[aspect] ?? ASPECTS[DEFAULT_ASPECT];
 return {screenWidth: Math.round(h * r * 2) / 2, screenHeight: Math.round(h * 2) / 2};
}

// The shape, worked out from the sides, named the way people name screens when
// it is one of the stock shapes (within 1.5%) and as a ratio when it is not.
export function aspectOf(width, height) {
 const w = Number(width), h = Number(height);
 return w > 0 && h > 0 ? w / h : null;
}
export function aspectName(width, height) {
 const r = aspectOf(width, height);
 if (!r) return '';
 for (const [name, v] of Object.entries(ASPECTS)) if (Math.abs(r / v - 1) < .015) return name;
 return `${r.toFixed(2)}:1`;
}

// The reverse, for showing what a bay WOULD have to look like to justify a field
// of view -- useful when someone has an angle they like and wants to know where
// to stand. Returns feet, to match the input above.
export function standForFov({fov, ...screen} = {}) {
 const h = heightOf(screen), a = Number(fov) * Math.PI / 180;
 if (!(h > 0) || !(a > 0) || a >= Math.PI) return null;
 return Math.round((h / 2) / Math.tan(a / 2) / INCHES_PER_FOOT * 10) / 10;
}

// WHERE THE MAT IS, LEFT OR RIGHT OF THE SCREEN'S CENTRE (the owner, 1 October).
//
// Hitting mats are often off-centre: a bay built for right- and left-handers, a
// projector that could not go dead centre. The golfer still looks straight down
// the target line, but the screen is no longer centred on that line, so the
// correct view is an OFF-AXIS one -- the same frustum, shifted sideways the way a
// projector's lens shift moves the picture without turning it. Sliding the camera
// sideways instead would be wrong in a different way: it moves where you are
// standing on the course, not where the window is.
//
// The shift, as a fraction of the distance to the screen: a mat `side` feet to
// the right of centre puts the screen's centre that far to your LEFT, so the
// picture moves left by side / stand (in the same units as the frustum's
// half-width at one unit of depth). Negative is left. Clamped so a mistyped bay
// cannot ask for a frustum that points somewhere else entirely.
export const SIDE_MAX_FEET = 15;
export function lensShift({standFeet, sideFeet} = {}) {
 const stand = Number(standFeet), side = Number(sideFeet) || 0;
 if (!(stand > 0)) return 0;
 return side ? Math.max(-1.5, Math.min(1.5, -side / stand)) : 0;
}

// A default bay: a 10-foot-wide 16:9 impact screen, standing eight feet back.
// Round numbers rather than a measurement of anything in particular -- it is a
// starting point to correct, and it is stated as one in the panel. (It was
// 138" on the diagonal, which is the same screen to within half an inch.)
export const DEFAULT_BAY = {screenWidth: 120, screenHeight: 67.5, standFeet: 8};
