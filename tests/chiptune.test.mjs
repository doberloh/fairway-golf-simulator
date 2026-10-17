import test from 'node:test';
import assert from 'node:assert/strict';
import {CHIP_INTERFACE, CHIP_MOMENTS, VOICES, chipForScore, tuneLength, midiHz, sixteenth, playChip} from '../src/chiptune.js';

const ALL = {...CHIP_INTERFACE, ...CHIP_MOMENTS};

test('every tune is well formed: known voices, real times, notes a guitar can play', () => {
 for (const [id, tune] of Object.entries(ALL)) {
  assert.ok(tune.name && tune.how, `${id} is named and described`);
  assert.ok(tune.bpm >= 60 && tune.bpm <= 240, `${id} tempo ${tune.bpm}`);
  assert.ok(tune.seq.length > 0, `${id} plays something`);
  for (const e of tune.seq) {
   assert.ok(VOICES.includes(e.v), `${id}: voice ${e.v}`);
   assert.ok(Number.isFinite(e.t) && e.t >= 0, `${id}: start ${e.t}`);
   assert.ok(Number.isFinite(e.d) && e.d > 0, `${id}: length ${e.d}`);
   for (const n of [].concat(e.n ?? [])) assert.ok(Number.isInteger(n) && n >= 24 && n <= 100, `${id}: note ${n}`);
  }
 }
});

test('the moments are the plan\'s eight, and none outstays the banner much', () => {
 assert.deepEqual(Object.keys(CHIP_MOMENTS).sort(), ['ace', 'birdie', 'bogey', 'eagle', 'level', 'par', 'round', 'xp']);
 for (const [id, tune] of Object.entries(CHIP_MOMENTS)) assert.ok(tuneLength(tune) <= 7, `${id} lasts ${tuneLength(tune).toFixed(2)} s`);
 // The score stings rank: the bigger the moment, the longer it plays.
 const len = id => tuneLength(CHIP_MOMENTS[id]);
 assert.ok(len('ace') > len('eagle') && len('eagle') > len('birdie'));
});

test('the interface sounds are short, so a run of key presses never piles up', () => {
 for (const [id, tune] of Object.entries(CHIP_INTERFACE)) assert.ok(tuneLength(tune) <= 1.2, `${id} lasts ${tuneLength(tune).toFixed(2)} s`);
});

test('a finished hole plays the right moment', () => {
 assert.equal(chipForScore(1, 3), 'ace');
 assert.equal(chipForScore(2, 5), 'eagle');
 assert.equal(chipForScore(1, 4), 'ace');
 assert.equal(chipForScore(3, 4), 'birdie');
 assert.equal(chipForScore(4, 4), 'par');
 assert.equal(chipForScore(7, 4), 'bogey');
 assert.equal(chipForScore(NaN, 4), null);
});

test('pitch and tempo arithmetic', () => {
 assert.equal(midiHz(69), 440);
 assert.ok(Math.abs(midiHz(81) - 880) < 1e-9);
 assert.equal(sixteenth(120), .125);
});

test('the player never schedules in the past, and asks for nothing it cannot make', () => {
 // A pretend audio context that records every start time.
 const starts = [], node = () => ({connect() {}, gain: param(), frequency: param(), detune: param(), delayTime: param(), threshold: param(), ratio: param(), Q: param(),
  start: t => starts.push(t), stop() {}, setPeriodicWave() {}, set type(_) {}, set buffer(_) {}, set curve(_) {}});
 function param() { return {value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}}; }
 const ctx = {currentTime: 10, sampleRate: 8000, destination: node(),
  createGain: node, createOscillator: node, createBiquadFilter: node, createDelay: node, createDynamicsCompressor: node, createWaveShaper: node, createBufferSource: node,
  createPeriodicWave: () => ({}), createBuffer: (c, len) => ({getChannelData: () => new Float32Array(len)})};
 for (const tune of Object.values(ALL)) for (const tone of ['clean', 'drive']) {
  starts.length = 0;
  const len = playChip(ctx, ctx.destination, tune, {tone, at: 3});
  assert.ok(len > 0);
  assert.ok(starts.every(t => t >= 10), 'a start time in the past');
 }
 assert.equal(playChip(null, null, CHIP_MOMENTS.par), 0);
});
