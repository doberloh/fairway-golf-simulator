// THE PICTURE LIFTED ON A PHONE (UI/UX pass V3, 21 October 2026; the owner:
// "the swing meter in phone mode covers the ball. Rearrange in a way that
// nothing covers the ball or the aiming line"). The play camera puts the ball
// low in the middle of the frame, which on a phone is exactly where the swing
// meter has to sit. The picture is moved up instead -- the camera does not
// turn, the image slides (three.js setViewOffset, renderer.js applyLensShift)
// -- so the ball stands above the controls, and the aim line, which runs up
// from the ball, crosses nothing.
//
// The shapes are round-phone.css's: held sideways is a height of 500 or less;
// upright is a width of 560 or less, taller than wide. PLACED from the
// measured layouts: sideways the ball sat at 79% of the height with the meter
// from 69% down, so a fifth of the height lifts it clear; upright the lie and
// shot-shape rows go under the ball as well, which needs 24%. Pure.

export const LIFT_SIDEWAYS = .2, LIFT_UPRIGHT = .24;

// Pixels to move the picture up for a window `w` by `h` CSS pixels; 0 off a phone.
export function phoneLift(w, h) {
 if (!(w > 0 && h > 0)) return 0;
 if (h <= 500 && w > h) return Math.round(h * LIFT_SIDEWAYS);
 if (w <= 560 && h > 500) return Math.round(h * LIFT_UPRIGHT);
 return 0;
}

// The camera views that are lifted: the ones about the ball (renderer.js
// config.mode). The overview, free flight and the hole-out flyover frame the
// course, not the ball.
export const liftsView = mode => !['overview', 'free', 'holeout'].includes(mode);
