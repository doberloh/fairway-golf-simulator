// Device-local rendering preferences.
//
// Deliberately kept out of the course settings and the save record. A quality
// tier belongs to the machine you are playing on, not to the course: putting it
// in courseSettings would stamp your GPU into every saved course, and
// GENERATOR_VERSION would then treat a tier change as a different landscape.
// Nothing here may ever affect world.height, hazards or any played surface --
// these are display knobs only, so two players on different tiers play the
// identical course.
const KEY = 'fairway-graphics-v1';

export const QUALITY = ['low', 'medium', 'high', 'ultra'];
// 0 means uncapped, which in practice means the display's own refresh rate.
export const FRAME_CAPS = [0, 30, 60, 120, 144];

export const QUALITY_LABELS = {
 low: 'Low · older laptops and integrated graphics',
 medium: 'Medium · the balanced default',
 high: 'High · discrete GPU',
 ultra: 'Ultra · everything, for a card with room to spare',
};

// Medium is exactly what the renderer did before tiers existed. Every number in
// it is the literal that used to be hardcoded, so an existing player sees no
// change at all until they opt into another tier. Do not "improve" medium.
export const TIERS = {
 // LOW IS FOR A MACHINE WITH NO GRAPHICS CARD, so it spends where a weak
 // device actually loses time: pixels and shadow-map fill. Measured on this
 // renderer, dropping the pixel ratio from 2 to 1 gave back 26% of the frame.
 // Below 1 the renderer draws smaller than the display and upscales, which is
 // what phone games have always done and the only fill lever left once the
 // ratio is already 1.
 //
 // What it deliberately does NOT do is thin the planting. A tier may not
 // change a played surface and trunks are collidable, so two players on
 // different tiers must hit the same trees. See TODO: the honest fix is a
 // tier-driven draw distance, and it does not exist yet.
 low: {
  pixelRatio: .75,
  shadow: {size: 512, radius: 1},
  fog: {near: 900, far: 3500, overviewNear: 3000, overviewFar: 10000},
  grass: .35,
  foliage: .55,
  // Sixteen is free on a real card and is not free without one.
  anisotropy: 2,
  // Shadow frustum around the camera, in metres. Smaller is crisper but covers
  // less ground; a fragment outside it is simply lit.
  shadowSpan: {half: 140, top: 190, bottom: -120, far: 700},
  shadowBias: {normal: .15, constant: -.0002},
  // Cascades off: one shadow frustum that follows the camera, so ground beyond
  // it is simply lit. Medium has always worked this way.
  cascades: 0, shadowFar: 0, overviewShadowFar: 0,
  godRays: 0,
  clouds: 0,
  mist: 0,
  // FLOODLIGHT SHADOWS ARE OFF ON EVERY TIER, and not because of frame time.
  //
  // Every shadow-casting spot light costs a texture sampler in EVERY lit
  // fragment shader, and the scene has one unit of headroom against the
  // MAX_TEXTURE_IMAGE_UNITS of 16 that WebGL guarantees: three CSM cascades, the
  // toon gradient, the environment map and the ground's own data atlases spend
  // the rest. Measured by walking the count up on a night course -- one caster
  // links, TWO does not, and a program that fails to link does not draw, so the
  // ground itself disappeared.
  //
  // Frame time was never the binding constraint: six casters at 512 measured 8.3
  // ms against 8.4 in daylight. Freeing a unit is what this needs -- a cascade
  // fewer on high, or packing the ground atlases -- not a smaller cap.
  floodShadows: 0,
  bloom: 0,
  // Smaller, not off. Measured: switching reflections off does not stop the
  // reflection pass -- the same 210 draws happen either way -- so the buffer
  // size is the only part of it a tier can currently reach. See TODO.
  reflection: 256,
 },
 medium: {
  pixelRatio: 1.75,
  shadow: {size: 2048, radius: 1},
  fog: {near: 1300, far: 5500, overviewNear: 4500, overviewFar: 14000},
  grass: 1,
  foliage: 1,
  anisotropy: 16,
  shadowSpan: {half: 185, top: 250, bottom: -160, far: 900},
  shadowBias: {normal: .15, constant: -.0002},
  cascades: 0, shadowFar: 0, overviewShadowFar: 0,
  godRays: 0,
  clouds: 0,
  mist: 0,
  floodShadows: 0,
  bloom: 0,
  reflection: 768,
 },
 high: {
  pixelRatio: 2,
  // three removed PCFSoftShadowMap: it warns and silently falls back to hard
  // PCF. Softness now comes from shadow.radius, which the PCF chunk spreads
  // over a Vogel disk. Medium keeps radius 1, which is three's default and
  // exactly the edge it has always had.
  shadow: {size: 4096, radius: 3.5},
  // Fog must reach full density before the landscape's outer ring, which sits
  // 13000 m past the course perimeter -- otherwise the terrain runs out while
  // the air is still clear and the edge of the world shows. 9000 leaves a wide
  // margin while still seeing far past medium's 5500.
  fog: {near: 2800, far: 9000, overviewNear: 6000, overviewFar: 16000},
  grass: 2,
  foliage: 1.8,
  anisotropy: 16,
  // Four times the texels of medium over the same ground, so the bias that
  // hid medium's acne can come down and contact shadows tighten up.
  shadowSpan: {half: 185, top: 250, bottom: -160, far: 900},
  shadowBias: {normal: .055, constant: -.00008},
  // Three cascades out to 2.5 km, so a tree casts a shadow wherever it stands
  // rather than only inside a 370 m box around the camera.
  cascades: 3, shadowFar: 2500, overviewShadowFar: 0,
  // Shafts are composited additively over the finished frame, so this is how
  // bright they get, not how much of the picture they replace.
  godRays: .85,
  // How much of the sun a drifting cloud takes at its darkest.
  clouds: .55,
  // Height fog and the dawn sheet. A fragment patch over the fog the scene
  // already had, so this is strength, not a new pass.
  mist: 1,
  // How dark a crease gets where geometry meets geometry.
  floodShadows: 0,
  bloom: 0,
  // The planar reflector is shared by every water body and redrawn each frame,
  // so this is the one knob that costs a whole extra scene render per step up.
  reflection: 1536,
 },
 ultra: {
  pixelRatio: 2,
  // three removed PCFSoftShadowMap: it warns and silently falls back to hard
  // PCF. Softness now comes from shadow.radius, which the PCF chunk spreads
  // over a Vogel disk. Medium keeps radius 1, which is three's default and
  // exactly the edge it has always had.
  // ULTRA'S SHADOWS ARE ITS POINT. It used to be high with a glow on it --
  // bloom, a bigger reflection buffer and overview shadows were the whole
  // difference, and measured they came to nothing: 12.64 ms against high's
  // 12.69. The extra goes into shadow resolution and reach instead.
  //
  // NOT A FOURTH CASCADE, however tempting. Three already spend 15 of the 16
  // texture units the real GPU reports, alongside the toon gradient, the
  // environment map and the ground's own atlases -- which is why floodlight
  // shadows are off on every tier. A fourth would take the last unit or
  // overflow it, and a program that fails to link draws nothing at all.
  // Resolution and distance cost fill and geometry, not samplers.
  shadow: {size: 6144, radius: 4},
  // Fog must reach full density before the landscape's outer ring, which sits
  // 13000 m past the course perimeter -- otherwise the terrain runs out while
  // the air is still clear and the edge of the world shows. 9000 leaves a wide
  // margin while still seeing far past medium's 5500.
  fog: {near: 2800, far: 9000, overviewNear: 6000, overviewFar: 16000},
  grass: 2,
  foliage: 1.8,
  anisotropy: 16,
  // Four times the texels of medium over the same ground, so the bias that
  // hid medium's acne can come down and contact shadows tighten up.
  shadowSpan: {half: 185, top: 250, bottom: -160, far: 900},
  shadowBias: {normal: .055, constant: -.00008},
  // Three cascades out to 2.5 km, so a tree casts a shadow wherever it stands
  // rather than only inside a 370 m box around the camera.
  // Three cascades reaching 3.5 km rather than high's 2.5, at half again the
  // texels: the far hills keep their shadows and the near ones sharpen.
  cascades: 3, shadowFar: 3500,
  // Zoomed all the way out the whole course should keep its shadows. The
  // cascades stop at shadowFar to hold resolution up close, but in overview
  // there is no close, so they stretch to cover everything instead.
  overviewShadowFar: 9000,
  // Shafts are composited additively over the finished frame, so this is how
  // bright they get, not how much of the picture they replace.
  godRays: .85,
  // How much of the sun a drifting cloud takes at its darkest.
  clouds: .55,
  // Height fog and the dawn sheet. A fragment patch over the fog the scene
  // already had, so this is strength, not a new pass.
  mist: 1,
  // How dark a crease gets where geometry meets geometry.
  // Ultra is where the passes that need the frame itself live. Measured
  // together they take high from about 6 ms to 8.3 ms of an 8.33 ms budget at
  // 120 Hz, which is why they are not simply part of high.
  floodShadows: 0,
  bloom: .14,
  // The planar reflector is shared by every water body and redrawn each frame,
  // so this is the one knob that costs a whole extra scene render per step up.
  reflection: 2048,
 },
};

export function tierOf(name) {
 return TIERS[name] || TIERS.medium;
}

// HOW THE GROUND SHOWS ITS SHAPE. Three cues, each switchable, because they are
// taste as much as technique: one player wants the course to look like a
// photograph and another wants to read every roll from the tee.
//
// They are settings rather than tiers because none of them costs anything worth
// measuring -- they are arithmetic on values the shader already has. Nobody
// should have to drop to Low to turn a look off.
//
// `contours` defaults OFF. The other two are how the ground has looked since
// they landed; banding the whole course at a fixed height interval is a
// deliberate, and deliberately artificial, choice.
export const GROUND_CUES = {relief: true, slopeTint: true, contours: false, stripes: true};

// GREEN DEFINITION. A green is the flattest thing on the course by design, and
// every shading cue is proportional to slope, so the one surface a player has to
// read has the least to read from -- measured, a green's shading spans .129 of
// brightness against the .240 ordinary terrain gets.
//
// The slider raises two things together because they are one perceptual thing:
// how far the shading NORMAL is tilted from vertical, and how much the mow bands
// bend to follow the surface. 70 is the setting chosen from the comparison, and
// the mapping puts it exactly on the numbers that were judged there.
//
// `bands` is separate because it is taste rather than legibility: softening the
// mowing bands measurably helps the shape read -- a strong regular pattern is
// the first thing the eye locks onto -- but fainter bands are a different look.
export const GREEN_READ = {definition: 70, bands: 60, sun: 60, slopeShade: 0, grain: 0};
// ONE mapping from slider to uniform, so the panel, the renderer and any dev
// switch cannot drift apart. At definition 70 this is lift 3.2 and bend 3.5.
export function greenCues(g) {
 const d = clampPct(g?.greenDefinition, GREEN_READ.definition) / 100;
 return {
  greenLift: d * 4.571,
  greenBend: 1 + d * 3.571,
  greenBandSoft: clampPct(g?.greenBands, GREEN_READ.bands) / 100,
  // THE ONE THAT REACHES THE LIGHT. Everything else tints the grass; this tilts
  // the normal the sun and sky actually shade with, which is measured at 4.2x
  // the variation in sunlight across a green. Same 0-100 slider, same ceiling.
  greenSun: clampPct(g?.greenSun, GREEN_READ.sun) / 100 * 4.571,
  // Both measured as no help on this generator's greens, kept on sliders rather
  // than deleted so they can be judged on screen. Default 0: nothing changes
  // unless they are moved.
  greenSlopeShade: clampPct(g?.greenSlopeShade, GREEN_READ.slopeShade) / 100,
  greenGrain: clampPct(g?.greenGrain, GREEN_READ.grain) / 100,
 };
}
const clampPct = (v, fallback) =>
 typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback;

const bool = (v, fallback) => typeof v === 'boolean' ? v : fallback;
const clean = g => ({
 quality: QUALITY.includes(g?.quality) ? g.quality : 'medium',
 frameCap: FRAME_CAPS.includes(g?.frameCap) ? g.frameCap : 0,
 relief: bool(g?.relief, GROUND_CUES.relief),
 slopeTint: bool(g?.slopeTint, GROUND_CUES.slopeTint),
 contours: bool(g?.contours, GROUND_CUES.contours),
 stripes: bool(g?.stripes, GROUND_CUES.stripes),
 terrainShadows: bool(g?.terrainShadows, true),
 reflections: bool(g?.reflections, true),
 greenDefinition: clampPct(g?.greenDefinition, GREEN_READ.definition),
 greenBands: clampPct(g?.greenBands, GREEN_READ.bands),
 greenSun: clampPct(g?.greenSun, GREEN_READ.sun),
 greenSlopeShade: clampPct(g?.greenSlopeShade, GREEN_READ.slopeShade),
 greenGrain: clampPct(g?.greenGrain, GREEN_READ.grain),
});


export function loadGraphics() {
 try {
  return clean(JSON.parse(localStorage.getItem(KEY) || 'null'));
 } catch {
  return clean(null);
 }
}

export function saveGraphics(graphics) {
 const next = clean(graphics);
 try {
  localStorage.setItem(KEY, JSON.stringify(next));
 } catch {}
 return next;
}

// Only grass density and foliage detail are baked into the scene graph, so only
// those two force the course to be rebuilt when the tier changes. Everything
// else is applied live.
export function needsRebuild(a, b) {
 const x = tierOf(a), y = tierOf(b);
 if ((x.godRays > 0) !== (y.godRays > 0)) return true;
 if ((x.clouds > 0) !== (y.clouds > 0)) return true;
 if ((x.mist > 0) !== (y.mist > 0)) return true;
 if ((x.bloom > 0) !== (y.bloom > 0)) return true;
 if (x.reflection !== y.reflection) return true;
 // Cascades are built with the course and register themselves against every
 // material in it, so turning them on or off needs the scene built again.
 return x.grass !== y.grass || x.foliage !== y.foliage || x.cascades !== y.cascades;
}
