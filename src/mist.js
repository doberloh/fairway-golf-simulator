import * as T from 'three';

// Height fog, and the mist that pools in the hollows at dawn.
//
// Two layers, both analytic, both in one fragment patch. No render pass: the
// scene's existing distance fog runs first and this is layered over it, so the
// cost is a handful of instructions plus one small noise on every fragment that
// already had fog.
//
// Chunk ownership is now four deep. CSM holds <lights_pars_begin> and
// <lights_fragment_begin>; ground.js holds <common>, <color_fragment> and
// <begin_vertex>; cloud-shadows.js holds <lights_fragment_end> and
// <project_vertex>; this holds <fog_vertex> and <fog_fragment>. Check that list
// before adding a fifth patch, and note that <project_vertex> is already
// contested -- windMaterial REPLACES it outright, so anything matching on it
// after a wind material has been built finds nothing left to match.

// A note on what this cost, because the symptom was so misleading.
//
// The first version named a local variable "patch". That is a RESERVED WORD in
// GLSL ES 3.0, held for tessellation, so every fragment shader carrying this
// code failed to compile:
//   ERROR: 0:196: 'patch' : Illegal use of reserved word
//
// A fragment shader that fails to compile does not draw and does not complain
// in any way you would notice: three logged nothing, and the WebGL warnings it
// did produce were suppressed after the first few. The scene rendered as a flat
// wash of sky, with only the objects this patch SKIPS -- the Line2 aim line,
// the cloud meshes -- still drawing. The terrain geometry was there the whole
// time; the aim line proved it by following the contours of ground you could
// not see.
//
// Two things to remember from it. Making the offending function a no-op does
// NOT isolate the fault, because dead code still has to parse -- that false
// negative sent the search in the wrong direction for hours. And the error is
// only reachable from gl.getShaderInfoLog() on a program whose LINK_STATUS is
// false; nothing else surfaces it. tests/glsl-reserved.test.mjs now scans for
// the whole reserved list.

// How much mist each landscape holds. Bottled at the biome rather than derived,
// because this is the difference between a place that gets fog and a place that
// does not, and no formula over temperature and altitude was going to tell me
// that the desert should stay clear while the Sound fills to the treetops.
const PROFILES = {
 // Cool, wet coastal air off the Pacific. The tag promises it; the fog delivers.
 pnw: {haze: 1, sheet: 1, water: 1},
 // Fog sits in the valley and the peaks stand clear above it, which is the whole
 // reason height fog is worth having.
 mountain: {haze: 1, sheet: .92, water: .6},
 // Sea fret rather than valley fog: thinner, but it comes in off the water.
 links: {haze: .72, sheet: .55, water: .85},
 midwest: {haze: .62, sheet: .62, water: .7},
 // Still, cold mornings. The best mist on the course.
 autumn: {haze: .75, sheet: .78, water: 1},
 // Warm and humid reads as haze, not as a cold sheet lying on the ground.
 island: {haze: .48, sheet: .22, water: .35},
 // Dry air. A little distance haze for depth and nothing on the ground at all --
 // pooled fog over a saguaro would read as a mistake, not as weather.
 desert: {haze: .26, sheet: 0, water: 0},
};

export const profileFor = biome => PROFILES[biome] || PROFILES.midwest;

// Densities, derived from how far you should be able to SEE rather than picked
// by eye.
//
// The first attempt was guessed, and it painted the whole frame one flat colour:
// a sheet density of .055 is an optical depth of 3 over 55 metres, so everything
// past a wedge shot was solid fog. Extinction is not a feel knob -- it has units,
// and the sane way to choose it is to name a visibility and divide.
//
// Optical depth 3 leaves about 5% of the original colour, which is the usual
// definition of visual range. So density = 3 / metres.
const RANGE = d => 3 / d;

// Clear midday air still has some depth to it, or distant hills look pasted on.
const HAZE_CLEAR = RANGE(15000);
// Damp pre-dawn air, thick enough to read as weather and still leave the hole
// playable. A golf sim you cannot aim in is not atmospheric, it is broken.
const HAZE_DAMP = RANGE(5000);
// The ground sheet at its worst, at average patchiness. Reference photographs of
// PNW courses at dawn put trees a hundred-odd metres away at ghost silhouettes,
// which is far denser than the first pass and is the point of this number.
const SHEET_DAMP = RANGE(260);
// Over the water itself, thicker again than the valley sheet -- this is the bank
// of fog sitting on a pond at first light.
const WATER_DAMP = RANGE(150);

// How the sheet varies between a gap and the heart of a bank.
//
// This is what "thicker patches" actually means. Real morning fog is not an even
// depth of grey; it lies in banks with clear air between, and the reference
// shots show a fairway you can see across running into a treeline you cannot.
// The first version ranged only about 3.7x from thinnest to thickest, which
// reads as a wash. These give roughly 17x.
export const SHEET_GAP = .12, SHEET_BANK = 2.05;
// Where the noise turns into a bank. Tightening these two toward each other
// hardens the edge between fog and clear air.
export const BANK_EDGE = [.30, .70];

// Pure, so tests can assert the visibility these produce instead of trusting
// that numbers in a shader look about right.
export function mistDensities(profile, damp, strength = 1) {
 const p = profile || PROFILES.midwest;
 return {
  haze: p.haze * strength * (HAZE_CLEAR + (HAZE_DAMP - HAZE_CLEAR) * damp),
  sheet: p.sheet * strength * SHEET_DAMP * damp,
  water: (p.water ?? 0) * strength * WATER_DAMP * damp,
 };
}

// The visibility a density buys, in metres. The inverse of RANGE, exported so a
// test can state its expectations in metres rather than in extinction units.
export const visibilityOf = density => density > 0 ? 3 / density : Infinity;

// Fog gathers over water long after it has lifted off the fairway, so the mist
// needs to know where the water is. Baked once, at course build, into a small
// field sampled by world XZ.
//
// A texture rather than the ground shader's existing hazard lookup, because mist
// over a pond has to fog a TREE STANDING BEHIND IT too -- the effect belongs to
// the air above the water, not to the water surface, so it cannot live in
// ground-only plumbing.
export const WATER_FIELD_SIZE = 128;
// How far the mist reaches out from the bank, in metres. Short enough that it
// reads as sitting ON the water rather than as a general dampness.
const WATER_REACH = 95;

export function bakeWaterField(world) {
 // Large lakes are ponds attached to a hole, so one pass over the holes covers
 // both; streams are line segments and need the distance to the segment.
 const discs = [];
 for (const hole of world.holes) {
  for (const pond of hole.ponds) {
   const p = hole.toWorld({x: pond.x, z: pond.z});
   discs.push({x: p.x, z: p.z, r: Math.max(pond.rx, pond.rz)});
  }
 }
 const segments = (world.streams?.segments || []).map(seg => ({
  ax: seg.a.x, az: seg.a.z, bx: seg.b.x, bz: seg.b.z,
  r: Math.max(seg.a.width, seg.b.width) * .5,
 }));
 if (!discs.length && !segments.length) return null;

 const size = WATER_FIELD_SIZE, spanX = world.halfX, spanZ = world.halfZ;

 // Bucketed by reach, because a river is hundreds of short segments and testing
 // every texel against every one of them took 274 ms of a course build. A
 // segment can only matter to texels within its own width plus WATER_REACH, so
 // each one is filed into the cells it could reach and a texel tests only its
 // own cell. Same answer, about fifty times less arithmetic.
 const cell = WATER_REACH;
 const cols = Math.max(1, Math.ceil(spanX * 2 / cell)), rows = Math.max(1, Math.ceil(spanZ * 2 / cell));
 const buckets = Array.from({length: cols * rows}, () => []);
 const colOf = x => Math.min(cols - 1, Math.max(0, Math.floor((x + spanX) / cell)));
 const rowOf = z => Math.min(rows - 1, Math.max(0, Math.floor((z + spanZ) / cell)));
 for (const g of segments) {
  const pad = g.r + WATER_REACH;
  const c0 = colOf(Math.min(g.ax, g.bx) - pad), c1 = colOf(Math.max(g.ax, g.bx) + pad);
  const r0 = rowOf(Math.min(g.az, g.bz) - pad), r1 = rowOf(Math.max(g.az, g.bz) + pad);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) buckets[r * cols + c].push(g);
 }

 const data = new Uint8Array(size * size);
 for (let j = 0; j < size; j++) {
  const z = ((j + .5) / size * 2 - 1) * spanZ;
  const bucketRow = rowOf(z) * cols;
  for (let i = 0; i < size; i++) {
   const x = ((i + .5) / size * 2 - 1) * spanX;
   let nearest = Infinity;
   for (const d of discs) nearest = Math.min(nearest, Math.hypot(x - d.x, z - d.z) - d.r);
   for (const g of buckets[bucketRow + colOf(x)]) {
    const dx = g.bx - g.ax, dz = g.bz - g.az;
    const len2 = dx * dx + dz * dz;
    const t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((x - g.ax) * dx + (z - g.az) * dz) / len2));
    nearest = Math.min(nearest, Math.hypot(x - (g.ax + dx * t), z - (g.az + dz * t)) - g.r);
   }
   // 1 over the water, easing to 0 by WATER_REACH out from the bank.
   const near = 1 - Math.min(1, Math.max(0, nearest) / WATER_REACH);
   data[j * size + i] = Math.round(255 * near * near * (3 - 2 * near));
  }
 }
 return {data, size, extent: [spanX, spanZ]};
}

export const mistUniforms = () => ({
 mistColor: {value: new T.Color('#c9d6e0')},
 // Everything below is measured from here, so a course that sits at altitude
 // still gets its fog at ground level rather than far beneath it.
 mistBase: {value: 0},
 // Metres over which the broad haze thins by 1/e.
 mistScale: {value: 70},
 mistDensity: {value: 0},
 // The low sheet. Much shorter, so it hugs the ground and fills the hollows
 // while anything with height stands out of it.
 // 20 m, not 9: in the reference the fog swallows whole trunks and leaves only
 // canopies showing, so the layer has to have real vertical reach. Raising this
 // does not change visibility at ground level -- for a ray at the base the depth
 // is density times distance whatever the scale height -- it only decides how
 // far up the fog still bites.
 sheetScale: {value: 20},
 sheetDensity: {value: 0},
 mistTime: {value: 0},
 // Where the water is. A 1x1 black stand-in until a course is built, so a dry
 // course and a course before its field is baked both simply have no water mist
 // rather than sampling a null texture.
 waterField: {value: blankField()},
 waterExtent: {value: new T.Vector2(1, 1)},
 waterDensity: {value: 0},
 // Hugs the surface more tightly than the valley sheet: river fog is a low
 // ribbon you look over from the bank, not a layer filling the whole hollow.
 waterScale: {value: 13},
});

function blankField() {
 const t = new T.DataTexture(new Uint8Array([0]), 1, 1, T.RedFormat);
 t.needsUpdate = true;
 return t;
}

// Upload a baked field, or leave the blank one in place for a dry course.
export function setWaterField(uniforms, field) {
 if (!uniforms || !field) return null;
 const texture = new T.DataTexture(field.data, field.size, field.size, T.RedFormat);
 texture.minFilter = texture.magFilter = T.LinearFilter;
 texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
 texture.needsUpdate = true;
 uniforms.waterField.value = texture;
 uniforms.waterExtent.value.set(field.extent[0], field.extent[1]);
 return texture;
}

const MIST_GLSL = `
uniform vec3 mistColor;
uniform float mistBase,mistScale,mistDensity,sheetScale,sheetDensity,mistTime;
uniform sampler2D waterField;
uniform vec2 waterExtent;
uniform float waterDensity,waterScale;
varying vec3 vMistWorld;
float mistHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float mistNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mistHash(i),mistHash(i+vec2(1,0)),f.x),mix(mistHash(i+vec2(0,1)),mistHash(i+1.),f.x),f.y);
}
float mistFbm(vec2 p){
 float v=0.,a=.5;
 for(int i=0;i<3;i++){v+=a*mistNoise(p);p=p*2.07+1.7;a*=.5;}
 return v;
}
// Optical depth through a medium that thins exponentially with height,
// integrated along the view ray.
//
// Closed form rather than marched: both ends of the ray are known, so the
// integral of exp(-y/scale) along it has an exact answer and costs two exps.
// This is what makes fog pool in a hollow and thin out over a ridge instead of
// lying on the picture as a flat wash keyed to distance.
float mistDepth(float yCam,float yFrag,float len,float scale){
 float dy=yFrag-yCam;
 float fc=exp(-yCam/scale);
 if(abs(dy)<.001)return fc*len;
 return (fc-exp(-yFrag/scale))*scale*len/dy;
}
vec3 applyMist(vec3 color){
 float len=distance(vMistWorld,cameraPosition);
 if(len<.01)return color;
 // Clamped so a camera or a fragment far below the base cannot drive exp() to
 // infinity and paint the frame solid.
 float yc=clamp(cameraPosition.y-mistBase,-30.,4000.);
 float yf=clamp(vMistWorld.y-mistBase,-30.,4000.);
 float depth=mistDepth(yc,yf,len,mistScale)*mistDensity;
 // The sheet is broken up and drifting. A uniform low layer reads as a bug in
 // the near clip plane; a patchy one reads as weather.
 //
 // Named puff, NOT patch. 'patch' is a reserved word in GLSL ES 3.0, kept for
 // tessellation, so using it as a variable name is a hard compile error:
 //   ERROR: 0:196: 'patch' : Illegal use of reserved word
 // A fragment shader that fails to compile does not draw and does not obviously
 // complain, so the scene just renders as flat sky. It cost an evening.
 float puff=mistFbm(vMistWorld.xz*.0032+vec2(mistTime*.004,mistTime*.0025));
 // Sharpened into banks. Raw fbm is too even to read as weather; pushing it
 // through a smoothstep gives fog with clear air between it.
 float bank=smoothstep(${BANK_EDGE[0]},${BANK_EDGE[1]},puff);
 depth+=mistDepth(yc,yf,len,sheetScale)*sheetDensity*(${SHEET_GAP}+${(SHEET_BANK - SHEET_GAP).toFixed(3)}*bank);
 // Fog gathers on water and stays there after it has lifted off the fairway.
 // Sampled at the fragment rather than at the camera, so a pond fogs the trees
 // standing behind it and not just its own surface.
 float wet=texture2D(waterField,vMistWorld.xz/waterExtent*.5+.5).r;
 depth+=mistDepth(yc,yf,len,waterScale)*waterDensity*wet*(.55+.75*puff);
 return mix(color,mistColor,clamp(1.-exp(-max(depth,0.)),0.,1.));
}
`;

export function applyMistTo(material, uniforms) {
 if (!material || material.userData.mist || material.userData.clouds) return;
 const previous = material.onBeforeCompile;
 material.onBeforeCompile = function (shader, renderer) {
  // Same discipline as the cloud shadows: CSM and windMaterial both ASSIGN
  // onBeforeCompile rather than wrapping it, so whatever was here first has to
  // be called explicitly or it is silently lost.
  previous?.call(this, shader, renderer);
  // Sprites and Line2 both include <fog_vertex> but neither includes
  // <begin_vertex>, so `transformed` does not exist in them and referencing it
  // fails to compile -- and only when the ball halo or the shot trail first
  // becomes visible, mid-round.
  if (!shader.vertexShader.includes('#include <begin_vertex>')
   || !shader.vertexShader.includes('#include <fog_vertex>')
   || !shader.fragmentShader.includes('#include <fog_fragment>')) return;
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nvarying vec3 vMistWorld;')
   // <fog_vertex> rather than <project_vertex>, which windMaterial replaces
   // outright. `transformed` is still in scope here, and instanceMatrix has to
   // be applied or every instance but the first reports the wrong position.
   .replace('#include <fog_vertex>', `#include <fog_vertex>
   #ifdef USE_INSTANCING
    vMistWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
   #else
    vMistWorld=(modelMatrix*vec4(transformed,1.)).xyz;
   #endif`);
  // KNOWN BROKEN -- this half blanks the scene. See the note at the top of the
  // file. The vertex half above is proven innocent; the cause is somewhere in
  // the two replacements below.
  shader.fragmentShader = shader.fragmentShader
   .replace('#include <common>', '#include <common>' + MIST_GLSL)
   // After the scene's own distance fog, so the two compose rather than fight.
   .replace('#include <fog_fragment>',
    '#include <fog_fragment>\ngl_FragColor.rgb=applyMist(gl_FragColor.rgb);');
 };
 material.userData.mist = true;
 material.needsUpdate = true;
}
