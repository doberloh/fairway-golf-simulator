import * as T from 'three';

// A live clock, and the light that follows from it.
//
// Deliberately outside courseSettings. The hour you play at belongs to the
// session, not to the landscape: putting it in the course would stamp a time
// into every save and let a shared course dictate your lighting. It is stored
// per device, exactly like the graphics tier, and for the same reason.
//
// The hard rule, held by tests/daylight.test.mjs: nothing here may ever reach
// the generator. No seeded stream reads the clock, so one seed builds identical
// terrain, planting and hazards at dawn and at midnight. That is what keeps
// GENERATOR_VERSION out of this feature entirely.
//
// Everything below is a pure function of (hour, biome sun) so it can be tested
// without a canvas. The renderer only applies what it is handed.

const KEY = 'fairway-time-v1';

// 0 freezes the clock wherever it stands -- what you want for a screenshot, or
// for judging anything else we build without the light moving underneath it.
// 1 is real time: one wall-clock second is one course second.
export const TIME_RATES = [0, 1, 2, 5, 10];
export const RATE_LABELS = {0: 'Frozen', 1: 'Real time', 2: '2× faster', 5: '5× faster', 10: '10× faster'};

// Sunrise and sunset hold at the same hours in every biome; only the noon
// height changes. Real day length swings with latitude and season, but varying
// it here would land a fixed preset ("golden hour") somewhere different in each
// biome, for a difference nobody would notice and a control nobody could aim.
export const SUNRISE = 6, SUNSET = 19.5;

// Hours, not phases: a preset has to land somewhere you can point at. Dusk sits
// just inside sunset rather than past it, where the sun is already properly down
// and the label would be lying.
export const PRESETS = [
 ['Dawn', 6.15], ['Morning', 8.5], ['Midday', 12.75],
 ['Afternoon', 15.5], ['Golden hour', 18.9], ['Dusk', 19.45], ['Night', 23],
];

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
export const wrapHour = h => ((h % 24) + 24) % 24;

// The biome's `sun` field used to be a fixed elevation held all day. It becomes
// the noon peak instead, lifted into a range a real midday reaches -- otherwise
// autumn's 19 would read as permanent dusk rather than as the low northern
// light it is meant to be.
export const peakElevation = biomeSun => 35 + biomeSun * .6;

// Where the old renderer actually put the sun. It built (-.6, sin(e), -.5) and
// then normalised, which quietly raised the angle: pnw's 28 landed nearer 31.
// Reproducing the true figure is what lets a biome's default hour match the
// light it has always had.
export const legacyElevation = biomeSun =>
 Math.atan2(Math.sin(biomeSun * Math.PI / 180), Math.hypot(.6, .5)) * 180 / Math.PI;

// Day runs phase 0..PI, night PI..2PI. Both halves end on sin = 0, so elevation
// is continuous through sunrise and sunset however unequal the two spans are.
export function solarPhase(hour) {
 const h = wrapHour(hour), day = SUNSET - SUNRISE;
 if (h >= SUNRISE && h < SUNSET) return (h - SUNRISE) / day * Math.PI;
 const since = h >= SUNSET ? h - SUNSET : h + 24 - SUNSET;
 return Math.PI + since / (24 - day) * Math.PI;
}

// Hour whose phase puts the sun at a given elevation, taking the afternoon
// solution. Used to give each biome a default hour that reproduces the light it
// shipped with, so nobody's course changes until they move the slider.
export function hourForElevation(elevation, peak) {
 const phase = Math.PI - Math.asin(clamp(elevation / peak, -1, 1));
 return SUNRISE + phase / Math.PI * (SUNSET - SUNRISE);
}

export const defaultHour = biomeSun => hourForElevation(legacyElevation(biomeSun), peakElevation(biomeSun));

// Azimuth sweeps east through south to west across the day and carries on
// round through the night, so shadows rake one way at breakfast and the other
// way at supper. That sweep is most of what sells a moving sun.
const directionAt = (phase, elevation) => {
 const az = (90 + phase / Math.PI * 180) * Math.PI / 180, el = elevation * Math.PI / 180;
 return new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
};

const SUN_HIGH = new T.Color('#fff0d6'), SUN_WARM = new T.Color('#ffb168'), SUN_LOW = new T.Color('#ff7a42');
const MOON = new T.Color('#b9cdf2');
// What the air is pulled toward, and how far. Returned as a tint rather than as
// finished colours so the renderer keeps its own daytime palette as the base:
// the biome sky, the fog and the hemisphere light all start somewhere different
// and all have to come back to exactly where they started by morning.
const DUSK = new T.Color('#e8925c'), NIGHT = new T.Color('#16233f'), GROUND_NIGHT = new T.Color('#1b2334');
// The sky and the ground do NOT take the same dusk colour, and using one for
// both was the bug behind tall grass glowing after sunset.
//
// DUSK is a lit sky: luminance .385, more than twice the daytime hemisphere
// ground colour (#777855, .180). Mixing the ground toward it made bounce light
// BRIGHTER as the sun went down -- 62% above its noon value just before sunset.
// Bounce only ever diminishes: the ground is going dark, not catching fire.
//
// It showed only on upright surfaces because a vertical normal draws about half
// its hemisphere light from the ground colour and a flat one draws none. Same
// material, same light, same frame -- the short grass was fine and the tall
// grass beside it glowed, which is the signature of this and nothing else.
const DUSK_GROUND = new T.Color('#6b4526');

const mix = (a, b, t) => a.clone().lerp(b, t);

// Everything the renderer needs for one instant, derived from sun elevation
// rather than from the clock. Keying off elevation means a biome with a high
// noon and one with a low noon both get a correct dusk without a special case.
export function solarState(hour, biomeSun) {
 const peak = peakElevation(biomeSun), phase = solarPhase(hour);
 const elevation = Math.sin(phase) * peak;
 // The moon rides the opposite half of the same arc, so it is up exactly when
 // the sun is down and no second clock is needed.
 const moonPhase = phase + Math.PI, moonElevation = Math.sin(moonPhase) * peak * .8;

 const dayness = smoothstep(-5, 7, elevation);
 // Warmth follows how much atmosphere the light is crossing: strongest on the
 // horizon, gone by the time the sun is properly up.
 const warmth = 1 - smoothstep(1, 26, elevation);
 const night = 1 - dayness;

 const sunUp = elevation > moonElevation;

 // Warm first, then blue: the air goes orange as the sun drops and only turns
 // over to night once it is properly down, which is the order it happens in.
 //
 // The warm half tracks warmth alone. Scaling it by night as well -- the first
 // thing I tried -- cancelled the sunset out, because the air is at its most
 // orange while it is still unmistakably day.
 //
 // The cold half is keyed straight off elevation rather than through dayness.
 // dayness only bottoms out five degrees under the horizon, which left a band
 // just below it where the sun had stopped contributing entirely but the ambient
 // was still at dusk brightness and dusk colour. Flat ground went dark on cue;
 // anything standing upright stayed lit, because a vertical surface draws about
 // half its hemisphere light from the ground colour and that colour was still a
 // lit warm brown. Tall links grass showed it worst -- a field of bright gold
 // blades over black turf -- while the near-flat short grass beside it looked
 // fine, which is exactly the tell for a hemisphere-ground problem.
 // Finishes by three and a half degrees under. Civil twilight runs to six, but
 // this is a cartoon sky over a dark course, not an atmosphere sim: holding any
 // dusk warmth past about three degrees leaves the sky reading as night while
 // the ambient is still lighting upright surfaces for a sunset that is over.
 const nightness = smoothstep(1.5, -3.5, elevation);
 const tint = mix(DUSK, NIGHT, nightness);
 // Reaches a full 1. The old ceiling of .92 left eight percent of the daytime
 // sky blue mixed into the ambient permanently, so night never quite arrived.
 const tintAmount = Math.max(warmth * .55, nightness);

 return {
  hour: wrapHour(hour), phase, elevation, moonElevation, dayness, warmth, sunUp, nightness,
  // The key light is whichever body is higher. They swap within a degree or two
  // of the horizon, where both are near zero intensity, so it is not a pop.
  direction: sunUp ? directionAt(phase, elevation) : directionAt(moonPhase, moonElevation),
  // The key light is tinted from whatever colour the renderer already uses, so
  // a biome that ships a warm sun -- autumn's #ffcc8e -- keeps it, and reddens
  // from there rather than being overwritten by a generic one.
  keyTint: sunUp ? (warmth < .5 ? mix(SUN_HIGH, SUN_WARM, warmth * 2) : mix(SUN_WARM, SUN_LOW, (warmth - .5) * 2)) : MOON.clone(),
  keyTintAmount: sunUp ? warmth : 1,
  // Scale, not an absolute: at full day this is exactly 1, so the default hour
  // reproduces the light the renderer has always had. Moonlight is not a dim
  // sun -- cool, soft, about an eighth as bright -- so it is its own number.
  keyScale: sunUp ? dayness : 0,
  moonIntensity: sunUp ? 0 : .34 * smoothstep(-2, 10, moonElevation),
  tint, tintAmount,
  groundTint: mix(DUSK_GROUND, GROUND_NIGHT, nightness),
  // Also a scale reaching exactly 1 by day. Ambient never falls to zero: a
  // course you cannot read is a bug, not a mood, and the glow ball only solves
  // finding the ball.
  hemiScale: .30 + .70 * dayness,
  // Opening up after dark keeps dusk moody rather than merely dim.
  exposureScale: 1 + .22 * night,
  // Crossfaded so twilight is not a switch. Drives stars and the heavier night
  // mist.
  starness: smoothstep(2, -6, elevation),
  // When artificial light is wanted. Comes up earlier than starness on purpose:
  // you reach for a light while there is still colour in the sky, well before
  // the first star shows.
  lamplight: smoothstep(10, -2, elevation),
 };
}

// The night sky turns once a day, around the celestial pole rather than around
// straight up: a vertical axis would spin the stars about the zenith like a
// planetarium parked at the north pole. Tilting it toward north puts the stars
// on the same east-to-west arc the sun takes, which is what it looks like from
// anywhere people actually play golf.
//
// Kept here rather than in the shader so it is one testable number, and so the
// period stays tied to the same 24 hours the sun uses. Negative because the sky
// wheels the same way the sun travels.
export const starRotation = hour => -wrapHour(hour) / 24 * Math.PI * 2;

// North is +Z in the sun path above, so the pole leans that way, lifted to a
// mid-latitude. Already unit length.
export const STAR_AXIS = [0, .7071, .7071];

// How much mist the ground is holding, on a scale of 0 to 1.
//
// Keyed off the clock rather than off sun elevation, unlike everything else
// here, because mist is a story about heat rather than about light. The ground
// radiates warmth away through the night, the air over it reaches dew point
// before dawn, and then the first hours of sun burn it off. That schedule is
// about hours since sunrise, not about how high the sun happens to be.
export function mistAmount(hour) {
 const h = wrapHour(hour);
 // Burning off: thickest right at first light, gone a few hours later.
 const sinceSunrise = wrapHour(h - SUNRISE);
 const burningOff = 1 - smoothstep(.4, 3.2, sinceSunrise);
 // Re-forming: nothing at sunset, building through the night.
 const nightLength = 24 - (SUNSET - SUNRISE);
 const sinceSunset = wrapHour(h - SUNSET);
 const forming = sinceSunset <= nightLength ? smoothstep(0, nightLength * .7, sinceSunset) : 0;
 return Math.max(burningOff, forming);
}

export function formatClock(hour) {
 // Round to whole minutes first. Taking the fraction and flooring it reads 6.15
 // as 6:08, because .15 of an hour is 8.999999999999995 minutes in binary.
 const total = Math.round(wrapHour(hour) * 60) % 1440;
 const whole = Math.floor(total / 60), minute = total % 60;
 return `${whole % 12 === 0 ? 12 : whole % 12}:${String(minute).padStart(2, '0')} ${whole < 12 ? 'AM' : 'PM'}`;
}

export function phaseName(state) {
 if (state.elevation < -3) return 'night';
 if (state.elevation < 8) return state.phase < Math.PI / 2 ? 'dawn' : 'dusk';
 return 'day';
}

export const PHASE_ICONS = {dawn: 'sunrise', day: 'sun', dusk: 'sunset', night: 'moon'};

const clean = t => ({
 hour: Number.isFinite(t?.hour) ? wrapHour(t.hour) : null,
 rate: TIME_RATES.includes(t?.rate) ? t.rate : 1,
 syncToLocal: !!t?.syncToLocal,
 // On by default, and not only because it looks good: a white ball on an unlit
 // course at midnight cannot be found. The glow is what makes night playable.
 glowBall: t?.glowBall !== false,
 // Off by default. Floodlit golf is a deliberate thing to ask for, not what a
 // course looks like, and the poles are a skyline change as much as a lighting
 // one -- nothing is shown and nothing is lit until it is switched on.
 floodlights: !!t?.floodlights,
 // On by default: the haze is what gives distance its depth, and a course
 // without it reads as a diorama. This is the first weather control rather than
 // a lighting one -- when there are more of them they belong together.
 fog: t?.fog !== false,
 // The two strength sliders, as multiples of the tuned brightness: 0 to 2, 1
 // being exactly what Fairway drew before they existed.
 floodStrength: strength(t?.floodStrength),
 glowStrength: strength(t?.glowStrength),
});
function strength(v) {
 return Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 1;
}

export function loadDaylight() {
 try {
  return clean(JSON.parse(localStorage.getItem(KEY) || 'null'));
 } catch {
  return clean(null);
 }
}

export function saveDaylight(t) {
 const next = clean(t);
 try {
  localStorage.setItem(KEY, JSON.stringify(next));
 } catch {}
 return next;
}

export const localHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };

// Advance the clock. Rate is a multiplier on real time, so rate 1 moves the
// hour by dt seconds. Rate 0 holds.
export const advance = (hour, rate, dt) => wrapHour(hour + rate * dt / 3600);

// The hours the main menu shows its showcase hole at, and whether each is dark
// enough to want the floodlights on.
//
// The menu is a shop window: it should show a hole at a flattering and DIFFERENT
// time each visit. It used to inherit the player's clock, so somebody who had
// been putting at one in the morning saw nothing but dark holes from then on --
// and once floodlights existed, nothing but dark FLOODLIT holes.
//
// Weighted toward daylight, because that is what a golf course looks like, with
// enough dusk and night in the rotation that a floodlit hole comes round as one
// of the looks rather than all of them.
export const MENU_HOURS = [
 [6.4, false], [8.2, false], [10.5, false], [12.6, false], [15.1, false],
 [17.8, false], [19.4, false], [20.6, true], [22.3, true], [1.4, true],
];
// Takes a number in [0,1) rather than a seed, so the caller owns the stream and
// this stays testable without pulling the generator in.
export const showcaseHour = r => MENU_HOURS[Math.min(MENU_HOURS.length - 1, Math.floor(r * MENU_HOURS.length))];
