// THE 1.0 INTERFACE'S SOUNDS: CHIPTUNE, PROG METAL, CLEAN TONE, FAMILY C
// (phase 4 of the 1.0 interface, 17 October 2026; the owner's pick in the
// mockup rounds: "a half-time groove with an echoing lead", a melody of its
// own for each moment).
//
// WIRED IN (17 October 2026). Built first for listening in the sound lab
// (tools/sound-lab/chiptune.html); then the owner said, of the sounds they had
// picked in the mockups, "you can also wire all the new sounds i agreed on" --
// their sign-off for exactly the tunes below (CHIP_SIGNED_OFF), and the marimba
// stings were deleted (sound.js). audio.js plays them: the five score moments,
// a new level, round complete, XP counting, and the six interface sounds. The
// families and tones the owner did not pick (A, B, drive) are not here.
//
// Ported from the approved mockup page (its `rock` player and the round-6
// MOMENTS table, column C, plus the round-4 interface set, clean). Everything
// is synthesised: pulse waves for the guitars and leads, a triangle bass,
// noise for the drums, a dotted-eighth echo on the marked leads. No recording.
//
// A tune is {bpm, seq}: `seq` is a list of events timed in sixteenth notes at
// the tune's own tempo -- {v: voice, t: start, d: length, n: MIDI note(s)}.

// --------------------------------------------------------------- the notation
const P5 = r => [r, r + 7, r + 12];
const G = (n, t, d, pm) => ({v: 'gtr', n: Array.isArray(n) ? n : P5(n), t, d, ...(pm ? {pm: 1} : {})});
const L = (n, t, d, o) => ({v: 'lead', n, t, d, ...(o || {})});
const LE = (n, t, d, o) => ({...L(n, t, d, o), dly: 1});
const D = (v, t, d = 1) => ({v, t, d});
const B = (n, t, d) => ({v: 'bass', n, t, d});
const H = (n, t, d, o) => ({v: 'horn', n, t, d, ...(o || {})});
const T = (f, t, g = 1) => ({v: 'tom', f, t, g, d: 1});
const Sn = (t, g = 1) => ({v: 'snare', t, g, d: 1});
const cat = (...a) => [].concat(...a);
function Pat(root, base, pos, bassNote) {
 const out = [];
 for (const p of pos) { out.push(G(root, base + p, .5, 1), D('kick', base + p)); if (bassNote) out.push(B(bassNote, base + p, .5)); }
 return out;
}
function Hats(a0, a1, step) { const o = []; for (let t = a0; t < a1 - 1e-6; t += step) o.push(D('hat', t)); return o; }
function Kroll(a0, a1) { const o = []; for (let t = a0; t < a1 - 1e-6; t += .5) o.push(D('kick', t)); return o; }
function Stab(ch, pos) { const o = []; for (const p of pos) o.push(G(ch, p, .7), D('kick', p)); return o; }
const EMAJ = [40, 44, 47, 52], AMAJ = [45, 49, 52, 57], BMAJ = [47, 51, 54, 59];

// --------------------------------------------------------------- the tunes
// The interface: short, so they never sit on top of each other.
export const CHIP_INTERFACE = {
 move: {name: 'Menu move', how: 'A muted chug for each step through a list', bpm: 180, seq: [G(40, 0, .5, 1), D('hat', 0)]},
 select: {name: 'Select', how: 'Power-chord stab and a step up', bpm: 200, seq: [G(45, 0, 1), G(52, 1, 2), D('kick', 0), D('hat', 1)]},
 back: {name: 'Back', how: 'The same, stepping down', bpm: 200, seq: [G(52, 0, 1), G(45, 1, 2, 1), D('kick', 0)]},
 toggle: {name: 'Toggle', how: 'A setting or a map layer switched', bpm: 210, seq: [L(76, 0, .7), L(83, .7, 1), D('hat', 0)]},
 locked: {name: 'Locked', how: 'Not unlocked yet: a sour chug', bpm: 170, seq: [G([40, 46], 0, 1, 1), G([40, 46], 1.5, 2.5), D('kick', 0), D('kick', 1.5)]},
 ready: {name: 'Monitor ready', how: 'Dun-dun: armed for the next swing', bpm: 160, seq: [G(40, 0, .8, 1), G(40, 1, .8, 1), D('kick', 0), D('kick', 1), B(28, 0, 2)]},
};

// The moments, family C: half-time grooves with an echoing lead.
export const CHIP_MOMENTS = {
 ace: {name: 'Hole in one', how: 'A slow heavy groove with an echoing melody, B major', bpm: 120,
  seq: cat(Pat(35, 0, [0, 1.5, 3, 4.5, 6, 9, 10.5, 12, 13.5]), [Sn(8)], Hats(0, 16, 2),
   [LE(71, 0, 3), LE(78, 3, 3), LE(83, 6, 2), LE(81, 8, 2), LE(85, 10, 2), LE(83, 12, 4)],
   [G(BMAJ, 16, 12), B(35, 16, 12), H(75, 16, 12), H(78, 16, 12, {vib: 1}), LE(87, 16, 10, {vib: 1}), D('crash', 16)], Kroll(16, 18))},
 eagle: {name: 'Eagle', how: 'Stabs in 5/8, an echoing climb, A major', bpm: 120,
  seq: cat(Stab([45, 52, 57], [0, 1.5, 2.5, 5, 6.5, 7.5]), [Sn(4), Sn(9)],
   [LE(76, 0, 2), LE(79, 2.5, 2), LE(83, 5, 2), LE(86, 7.5, 2.5)], [G(AMAJ, 10, 8), B(33, 10, 8), LE(88, 10, 8, {vib: 1}), D('crash', 10)])},
 birdie: {name: 'Birdie', how: 'Two stabs and an echoing arpeggio', bpm: 130,
  seq: cat(Stab([40, 47, 52], [0]), Stab([43, 50, 55], [1.5]), [LE(76, 2, 1), LE(79, 3, 1), LE(83, 4, 1), LE(88, 5, 3, {vib: 1}), D('hat', 2), D('hat', 4)])},
 par: {name: 'Par', how: 'A chug, a ringing chord, one echoing note', bpm: 130,
  seq: cat(Pat(40, 0, [0]), [G(52, 1, 6), LE(83, 1, 4)])},
 bogey: {name: 'Bogey', how: 'One low chug, an echo that sags', bpm: 90,
  seq: cat(Pat(35, 0, [0]), [G([35, 41], 1, 4, 1), LE(77, 1, 5, {slide: -1})])},
 level: {name: 'Level up', how: 'A heavy half-time bar, echoing lead, B major', bpm: 110,
  seq: cat(Pat(35, 0, [0, 1.5, 3, 6, 7.5, 9, 10.5]), [Sn(8)], Hats(0, 12, 2),
   [LE(78, 0, 3), LE(83, 4, 3), LE(81, 8, 2), LE(85, 10, 2)], [G(BMAJ, 12, 10), B(35, 12, 10), LE(87, 12, 8, {vib: 1}), D('crash', 12), D('kick', 12)])},
 round: {name: 'Round complete', how: 'Half-time groove, an echoing melody that turns major', bpm: 115,
  seq: cat(Pat(40, 0, [0, 1.5, 3, 6, 7.5, 9, 12, 13.5], 28), [Sn(8)], Hats(0, 16, 2),
   [LE(76, 0, 4), LE(83, 4, 4), LE(81, 8, 4), LE(80, 12, 4)], [G(EMAJ, 16, 10), B(28, 16, 10), LE(88, 16, 8, {vib: 1}), D('crash', 16), D('kick', 16)])},
 xp: {name: 'XP counting up', how: 'Sparse pings, the echo fills the gaps', bpm: 200,
  seq: cat([76, 79, 81, 83, 86, 88].map((n, i) => LE(n, i, .6)), Hats(0, 6, 1))},
};

// THE OWNER'S SIGN-OFF (17 October 2026): every tune above, in the clean tone,
// as ported from the approved mockup. tests/chiptune.test.mjs holds the game to
// playing only these.
// How loud the game plays them (audio.js, and check.mjs measures the same):
// the tunes are mixed hot, with the mockup's compressor inside playChip.
// PLACED by ear from the mockup; check.mjs compares them with the other sounds.
export const CHIP_LEVELS = {moment: .32, ui: .22};
export const CHIP_SIGNED_OFF = {
 by: 'the owner', on: '2026-10-17', words: 'you can also wire all the new sounds i agreed on', tone: 'clean',
 moments: Object.keys(CHIP_MOMENTS), interface: Object.keys(CHIP_INTERFACE),
};

// Which moment a finished hole plays: the same judgement as the marimba's
// (sound.js `scoreSting`) -- a hole in one, an eagle or better, a birdie, par,
// and a bogey or worse.
export function chipForScore(strokes, par) {
 if (!Number.isFinite(strokes) || !Number.isFinite(par)) return null;
 if (strokes === 1) return 'ace';
 const d = Math.round(strokes - par);
 return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : 'bogey';
}

export const VOICES = ['gtr', 'lead', 'bass', 'kick', 'snare', 'hat', 'crash', 'horn', 'tom'];
export const sixteenth = bpm => 60 / bpm / 4;
// How long a tune sounds, in seconds, tails and echoes included (the player's
// own rule: every note's end, a release, and the echo's ring).
export function tuneLength({bpm, seq}) {
 const s16 = sixteenth(bpm);
 let end = 0;
 for (const e of seq) {
  const du = (e.d || 1) * s16;
  end = Math.max(end, e.t * s16 + du + .4);
  if (e.v === 'crash') end = Math.max(end, e.t * s16 + 1);
  if (e.dly) end = Math.max(end, e.t * s16 + du + 1.6);
 }
 return end;
}
export const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);

// --------------------------------------------------------------- the player
// Web Audio. `out` is where it goes (the game's master, or the context's
// destination in the lab); `at` a context time, never in the past (a time in
// the past makes Web Audio play the whole tune late, all at once -- the
// owner's rule from the sound lab). Returns the tune's length in seconds.
const waves = new WeakMap();
function pulse(ctx, duty) {
 let m = waves.get(ctx); if (!m) waves.set(ctx, m = {});
 if (m[duty]) return m[duty];
 const n = 40, re = new Float32Array(n), im = new Float32Array(n);
 for (let k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty);
 return m[duty] = ctx.createPeriodicWave(re, im);
}
const noises = new WeakMap();
function noise(ctx) {
 if (noises.has(ctx)) return noises.get(ctx);
 const len = ctx.sampleRate, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
 // A fixed sequence rather than Math.random, so a tune sounds the same twice.
 let v = 0, s = 12345;
 for (let i = 0; i < len; i++) { if (i % 3 === 0) { s = (s * 1103515245 + 12345) >>> 0; v = s / 2147483648 - 1; } d[i] = v; }
 noises.set(ctx, b);
 return b;
}
function shaper(ctx) {
 const s = ctx.createWaveShaper(), n = 1024, c = new Float32Array(n);
 for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(2.6 * x) / Math.tanh(2.6); }
 s.curve = c;
 return s;
}
export function playChip(ctx, out, tune, {tone = 'clean', at, gain = .5} = {}) {
 if (!ctx || !tune) return 0;
 const s16 = sixteenth(tune.bpm), t0 = Math.max(at ?? 0, ctx.currentTime) + .04;
 const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(out || ctx.destination);
 const master = ctx.createGain(); master.gain.value = gain; master.connect(comp);
 // The echo: a dotted eighth, as prog players use.
 const dIn = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
 dl.delayTime.value = Math.min(.9, s16 * 3); fb.gain.value = .38; wet.gain.value = .5;
 dIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
 const gtrBus = ctx.createGain(); gtrBus.gain.value = tone === 'drive' ? .55 : .8;
 if (tone === 'drive') { const sh = shaper(ctx), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; gtrBus.connect(sh); sh.connect(lp); lp.connect(master); }
 else gtrBus.connect(master);
 const env = (g, st, du, peak, rel, decayTo = .75) => {
  g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(peak, st + .004);
  g.gain.linearRampToValueAtTime(peak * decayTo, st + Math.max(.01, du)); g.gain.linearRampToValueAtTime(0, st + du + rel);
 };
 const noiseHit = (st, type, level, dec, freq) => {
  const src = ctx.createBufferSource(); src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(level, st); g.gain.exponentialRampToValueAtTime(.001, st + dec);
  src.connect(f); f.connect(g); g.connect(master); src.start(st); src.stop(st + dec + .02);
 };
 const vibrato = (osc, st, du, depth, rate) => {
  const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate;
  lg.gain.setValueAtTime(0, st); lg.gain.linearRampToValueAtTime(depth, st + Math.max(.05, du * .6));
  l.connect(lg); lg.connect(osc.frequency); l.start(st); l.stop(st + du + .12);
 };
 for (const e of tune.seq) {
  const st = t0 + e.t * s16, du = (e.d || 1) * s16;
  if (e.v === 'gtr') {
   for (const n of e.n) for (const [duty, det] of [[.25, -7], [.125, 7]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.setPeriodicWave(pulse(ctx, duty)); o.frequency.value = midiHz(n); o.detune.value = det;
    if (e.pm) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; g.connect(f); f.connect(gtrBus); } else g.connect(gtrBus);
    env(g, st, e.pm ? Math.min(du, .07) : du, .14, e.pm ? .02 : .05, e.pm ? .3 : .7);
    o.connect(g); o.start(st); o.stop(st + du + .12);
   }
  } else if (e.v === 'lead') {
   const o = ctx.createOscillator(), g = ctx.createGain();
   o.setPeriodicWave(pulse(ctx, .125)); o.frequency.setValueAtTime(midiHz(e.n), st);
   if (e.slide) { o.frequency.setValueAtTime(midiHz(e.n), st + du * .5); o.frequency.linearRampToValueAtTime(midiHz(e.n + e.slide), st + du); }
   if (e.vib) vibrato(o, st, du, midiHz(e.n) * .012, 6.5);
   env(g, st, du, .16, .04, .85); o.connect(g); g.connect(master); if (e.dly) g.connect(dIn);
   o.start(st); o.stop(st + du + .08);
  } else if (e.v === 'bass') {
   const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = midiHz(e.n);
   env(g, st, du, .5, .03, .8); o.connect(g); g.connect(master); o.start(st); o.stop(st + du + .06);
  } else if (e.v === 'horn') {
   const g = ctx.createGain();
   [.5, .25].forEach((duty, j) => {
    const o = ctx.createOscillator(); o.setPeriodicWave(pulse(ctx, duty));
    o.frequency.setValueAtTime(midiHz(e.n - 1), st); o.frequency.linearRampToValueAtTime(midiHz(e.n), st + .03);
    if (j) o.detune.value = 5;
    if (e.vib) vibrato(o, st, du, midiHz(e.n) * .01, 5.5);
    o.connect(g); o.start(st); o.stop(st + du + .1);
   });
   g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(.11, st + .025); g.gain.setValueAtTime(.11, st + du * .6);
   g.gain.linearRampToValueAtTime(.08, st + du); g.gain.linearRampToValueAtTime(0, st + du + .07); g.connect(master);
  } else if (e.v === 'kick') {
   const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
   o.frequency.setValueAtTime(170, st); o.frequency.exponentialRampToValueAtTime(42, st + .08);
   g.gain.setValueAtTime(.9, st); g.gain.exponentialRampToValueAtTime(.001, st + .16); o.connect(g); g.connect(master); o.start(st); o.stop(st + .18);
  } else if (e.v === 'tom') {
   const o = ctx.createOscillator(), g = ctx.createGain(), f0 = e.f || 110; o.type = 'triangle';
   o.frequency.setValueAtTime(f0, st); o.frequency.exponentialRampToValueAtTime(f0 * .55, st + .16);
   g.gain.setValueAtTime(.8 * (e.g || 1), st); g.gain.exponentialRampToValueAtTime(.001, st + .26); o.connect(g); g.connect(master); o.start(st); o.stop(st + .28);
   noiseHit(st, 'lowpass', .12 * (e.g || 1), .05, 900);
  } else if (e.v === 'snare') {
   noiseHit(st, 'bandpass', .55 * (e.g || 1), .14, 1700);
   const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
   o.frequency.setValueAtTime(200, st); o.frequency.exponentialRampToValueAtTime(110, st + .06);
   g.gain.setValueAtTime(.4 * (e.g || 1), st); g.gain.exponentialRampToValueAtTime(.001, st + .08); o.connect(g); g.connect(master); o.start(st); o.stop(st + .1);
  } else if (e.v === 'hat') noiseHit(st, 'highpass', .22, .035, 8000);
  else if (e.v === 'crash') noiseHit(st, 'highpass', .35, .9, 4200);
 }
 return tuneLength(tune);
}
