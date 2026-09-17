// Turf firmness.
//
// Firmness is a different axis from green speed, and conflating the two is the
// usual mistake: a green can be quick and soft -- a Stimp 12 surface that still
// takes a pitch mark -- or slow and baked hard. Speed is what a ball does once
// it is rolling; firmness is what happens the moment it lands. They are kept
// separate here, and `rollDeceleration` in turf.js still owns the first.
//
// THE UNIT IS THE INSTRUMENT'S. The USGA's TruFirm, and the GS3 ball that
// replaced it, measure firmness by dropping a golf-ball-shaped hemisphere from a
// fixed height and recording how far it penetrates the surface, in inches --
// lower is firmer. The device exists specifically to "recreate the effect of
// golf ball impacts", which is exactly the quantity this model needs, so
// firmness here IS that penetration depth and nothing is invented to hold it.
// The instrument reads 0.1 in to 1.5 in, and the presets sit inside that.
//
// The four depths are the USGA's own published bands, not chosen numbers, and
// the SCALE is pinned by making Normal reproduce the bounce the model already
// had -- so an existing course plays exactly as it did and every other setting
// is relative to it.
//
// One thing the published ranges do NOT cover: they are for PUTTING GREENS,
// measured after morning maintenance. Fairways are not measured with this
// instrument at all, and a baked links fairway in August is firmer than any
// maintained green ever reads. One value serves the whole course here, so the
// firm end is honest for a green and conservative for a fairway. See RESEARCH.md.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// The instrument's own working range, and the floor and ceiling for any number
// this module will accept. The TruFirm reads 0.1 to 1.5 in; the GS3's published
// reference bands for putting greens occupy a much narrower slice of that, and
// the four presets sit on those bands rather than spanning the whole device.
export const FIRMNESS_RANGE = [0.10, 1.50];
// Straight off the USGA's published GS3 reference ranges (Green Section Record
// vol. 62 no. 22, 5 December 2024), which give a typical range of 0.300-0.500 in
// and name the bands inside it. These are not chosen numbers any more. The page
// 403s to automated fetch; the saved copy is in reference/.
export const FIRMNESS_PRESETS = {
 // The bottom of the typical range: "Extremely Firm" is 0.300-0.350 in, and the
 // article notes championship values are "typically inappropriate for daily
 // play" -- which is exactly what this setting is for.
 Burnt: 0.30,
 // Mid of the published "Firm" band, 0.350-0.400 in.
 Firm: 0.37,
 // Mid of "Likely suitable for most facilities", 0.400-0.500 in. Also what the
 // model has always done, so every other value stays relative to this one.
 Normal: 0.45,
 // "Receptive" is anything over 0.500 in. Far enough past it to read as a soft
 // morning without leaving the ground the article describes.
 Soft: 0.60,
};
// What the LAB's slider spans, which is not the same as what the model accepts.
// The clamp above is the instrument's full 1.40 in of travel, because that is
// what the device reads. The four presets occupy 0.30 in of that -- barely a
// fifth -- so a slider spanning the whole device would put every setting a course
// is ever at inside a thumb's width, and spend the rest on ground nobody plays.
// This is 0.55 in: wide enough to overshoot both extremes and see what lies past
// them, tight enough that a pixel of drag is a usable step.
export const LAB_FIRMNESS_RANGE = [0.20, 0.75];
export const FIRMNESS_NAMES = Object.keys(FIRMNESS_PRESETS);
export const NORMAL_FIRMNESS = FIRMNESS_PRESETS.Normal;

// A name, a number, or nothing, to a number. The settings offer the four names;
// the lab drives the number directly, because the point of the lab is to
// see the ground between them.
export function firmnessValue(input) {
 if (typeof input === 'number' && Number.isFinite(input)) return clamp(input, ...FIRMNESS_RANGE);
 const named = FIRMNESS_PRESETS[input];
 return named === undefined ? NORMAL_FIRMNESS : named;
}
// The nearest name, for a readout. The lab shows the number AND what it is near,
// because "0.38 in" means nothing to most people and "Firm" means nothing precise.
export function firmnessName(value) {
 const depth = firmnessValue(value);
 return FIRMNESS_NAMES.reduce((best, name) =>
  Math.abs(FIRMNESS_PRESETS[name] - depth) < Math.abs(FIRMNESS_PRESETS[best] - depth) ? name : best,
 FIRMNESS_NAMES[0]);
}

// How a landing reacts, as three multipliers on what the surface already does.
// All three are 1 at Normal by construction, so firmness cannot quietly restate
// the model -- it can only move around it.
//
// BOUNCE. The turf absorbs the energy it takes to make the crater, so a deeper
// crater returns less. Restitution goes as the square root of the depth ratio
// because restitution is a velocity ratio and the energy is the square of it:
// half the penetration returns about 1.4 times the speed.
export const bounceScale = depth => Math.sqrt(NORMAL_FIRMNESS / firmnessValue(depth));
// TILT. Penner's effective contact plane tilts because the ball has to climb out
// of the depression it is making, and the depth of that depression is precisely
// what the instrument measures. Straight proportional: this is the same crater,
// read as an angle instead of a depth.
export const tiltScale = depth => firmnessValue(depth) / NORMAL_FIRMNESS;
// GRIP. Soft turf closes around the ball and gives the tangential impulse more to
// work against; baked ground lets it skid.
//
// Weakly, because the Coulomb limit is already bounded by the normal impulse,
// which firmness has moved as well -- leaving this at 1 would still produce most
// of the effect.
//
// A STRONG VERSION OF THIS WAS TRIED AND REVERTED. Raising the exponent to 1.245
// let firmness drive how much forward speed survives a bounce, which produced a
// firm green that skips a ball forward and then rips it back hardest. That is
// the wrong way round: Titleist's slow-motion work and every coaching source
// agree a SOFT, receptive green grips a spinning ball best, while a firm one
// makes it harder to check because the ball bounces and rolls forward. Firmness
// belongs on ploughing, which takes forward speed WITHOUT taking the spin that
// brings a ball home; friction takes both at once and cannot express it.
export const gripScale = depth => (firmnessValue(depth) / NORMAL_FIRMNESS) ** .35;
// SPIN SCRUBBING. How much of the tangential impulse is turned into spin change
// rather than just slowing the ball -- and therefore how much backspin the ball
// still has when it settles, which is the only thing that can bring it home.
//
// FIRMER SCRUBS MORE. A ball skids across hard, tight turf and the surface takes
// the spin off it; a soft green closes round the ball and cushions the contact,
// so the spin survives. That is the mechanism behind the thing every coaching
// source says and this model used to have backwards: a soft, receptive green
// grips a spinning ball and checks it, while a firm one is harder to hold
// because the ball bounces and runs.
//
// Fitted against a full 56 degree wedge -- 10,000 rpm, which is an ordinary tour
// number for that club, where the 10,400 rpm 7 iron this was previously tuned
// against is a shot nobody hits.
export const SPIN_SCRUB = 0.558;
export const spinScale = depth => (NORMAL_FIRMNESS / firmnessValue(depth)) ** SPIN_SCRUB;

// FIRMNESS IS A GREENS MEASUREMENT, so it moves greens and their collars and
// nothing else.
//
// The unit here is inches of penetration read by a TruFirm or a GS3, and both of
// those are greens instruments -- the USGA bands this scale is anchored to are
// greens bands. Sand was already excluded on exactly that reasoning: a bunker is
// not turf, its condition is raked state and moisture, and the instrument is not
// used on it. The same sentence is true of a fairway and truer of rough, so the
// exclusion now extends to them.
//
// It also removes something that played badly. A soft setting used to reverse a
// well-struck ball off FAIRWAY, SEMI AND ROUGH -- a 10,400 rpm 7 iron hopped
// backwards out of all three, and at stock 6,500 rpm it still came back off a
// soft fairway. Nothing short of mud does that, and no amount of refitting the
// green's numbers was going to fix a surface the instrument never measured.
//
// What is NOT lost: the fairway, semi and rough roll percentages are a separate
// control and are untouched, so a course can still be set to run. They move a
// driver about nine yards across their range. They do very little to an iron,
// whose release is nearly all bounce -- that variation is genuinely gone.
export const firmnessApplies = surface => surface === 'green' || surface === 'fringe';
