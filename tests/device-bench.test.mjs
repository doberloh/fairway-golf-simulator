import test from 'node:test';
import assert from 'node:assert/strict';
import {runBench, readingOf, formatBench, BENCH, BENCH_SPOTS, BENCH_PARTS, BENCH_HOLD} from '../src/device-bench.js';
import {diagnosticReport} from '../src/diagnostic.js';

// MEASURE THIS DEVICE (src/device-bench.js): the tour a phone runs on itself.
// What is held here is the order of the tour and the report; what the numbers
// are is the device's.
const fakeIo = ({throwOn = null} = {}) => {
 const log = [];
 let hidden = new Set(), n = 0;
 return {
  log,
  place: pose => log.push(['place', pose]),
  frames: async k => log.push(['frames', k]),
  measure: async () => { n++; log.push(['measure', [...hidden]]); return {fps: 30, worstMs: 50, workMs: hidden.size ? 20 : 40, scriptMs: 5, draws: 300 - hidden.size * 100, triangles: 1e7, heavy: [{name: 'redwood leaf', triangles: 4.2e6, held: 120}, {name: 'ground, fine', triangles: 3e5, held: 9}], at: 2 * n, state: n < 5 ? 'hour 10.0, sun 30 deg' : 'hour 10.1, sun 31 deg'}; },
  hide: id => { if (id === throwOn) throw Error('cannot hide ' + id); hidden.add(id); log.push(['hide', id]); return () => { hidden.delete(id); log.push(['show', id]); }; },
  restore: () => log.push(['restore']),
  get readings() { return n; },
 };
};

test('the tour reads every place, and takes the frame apart at the tee and from above, a whole frame between every two parts', async () => {
 const io = fakeIo(), steps = [];
 const rows = await runBench(io, {hole: 3, length: 400, onStep: (i, n) => steps.push([i, n])});
 const withParts = BENCH_SPOTS.filter(s => s.parts).length;
 const held = BENCH_HOLD.cycles * (1 + BENCH_HOLD.parts.length);
 assert.equal(rows.length, BENCH_SPOTS.length + withParts * BENCH_PARTS.length + 1 + held, 'one row a place, one a part, one a held reading, and the first place again');
 assert.equal(io.readings, BENCH_SPOTS.length + withParts * BENCH_PARTS.length * 2 + 1 + held + 1, 'a whole-frame reading after every part, and one after the hold');
 // THE HOLD: straight after the first reading, before any part is switched.
 assert.ok(rows.slice(1, 1 + held).every(r => r.part === 'hold' && r.spot === 'tee'), 'the hold comes first');
 assert.deepEqual(rows.slice(1, 1 + 1 + BENCH_HOLD.parts.length).map(r => r.hold), [null, ...BENCH_HOLD.parts.map(p => p.id)]);
 assert.equal(rows[held].cycle, BENCH_HOLD.cycles);
 assert.deepEqual([rows.at(-1).spot, rows.at(-1).part], ['tee', 'again'], 'the tee read again at the end, to show any drift');
 // The camera is put on the hole being played, never another.
 for (const [kind, pose] of io.log.filter(e => e[0] === 'place')) assert.equal(pose.hole, 3, kind);
 // Never two parts off at once, and each is back on before the next reading of the whole.
 const measures = io.log.filter(e => e[0] === 'measure');
 assert.ok(measures.every(m => m[1].length <= 1), 'one part at a time');
 let i = 0;
 for (const e of io.log) { if (e[0] === 'hide') i++; if (e[0] === 'show') i--; assert.ok(i >= 0 && i <= 1); }
 assert.equal(i, 0, 'every part switched back on');
 assert.deepEqual(io.log.at(-1), ['restore'], 'the camera is put back last');
 // A part's row is compared with the whole frame either side of it.
 const part = rows.find(r => r.part === 'planting');
 assert.equal(part.workMs, 20); assert.equal(part.baseWork, 40);
 assert.equal(steps.at(-1)[0], steps.at(-1)[1], 'the progress line reaches the end');
 assert.ok(BENCH.settle > 0 && BENCH.settlePart > 0);
});

test('whatever goes wrong, the part is switched back on and the camera put back', async () => {
 const io = fakeIo({throwOn: 'ground'});
 await assert.rejects(runBench(io, {hole: 0}), /cannot hide ground/);
 assert.deepEqual(io.log.at(-1), ['restore']);
 const open = io.log.filter(e => e[0] === 'hide').length - io.log.filter(e => e[0] === 'show').length;
 assert.equal(open, 0, 'nothing left switched off');
});

test('a reading is the median frame, the slowest frame, the median work and the median script', () => {
 const r = readingOf([16, 17, 33, 16, 100], [8, 9, 10, 40], {draws: 412, triangles: 13.5e6}, [2, 3, 4]);
 assert.equal(r.fps, 59, '1000 / the median gap of 17 ms');
 assert.equal(r.worstMs, 100);
 assert.equal(r.workMs, 10);
 assert.equal(r.scriptMs, 3, 'the game\'s own code: the rest of the work is the wait for the chip');
 assert.equal(r.draws, 412);
 assert.deepEqual(readingOf([], [], {}), {fps: null, worstMs: null, workMs: null, scriptMs: null, draws: null, triangles: null});
});

test('the report says what each part costs, and rides in the diagnostic', async () => {
 const rows = await runBench(fakeIo(), {hole: 0});
 const text = formatBench({rows, tier: 'medium', ratio: 1.75, canvas: [770, 1565], seconds: 71, course: 'Ridgeline Timbers, hole 1'});
 assert.match(text, /DEVICE BENCHMARK/);
 assert.match(text, /tier +medium/);
 assert.match(text, /1\.75 pixel ratio, 770x1565/);
 assert.match(text, /tee +no trees or plants +30 +50 +20 +5 +40\.0 +-50%/);
 assert.match(text, /tee +no trees, plants or ground +30 +50 +20 +5 +40\.0 +-50%/, 'the floor under the trees and the ground');
 // What the triangles are, once a place read as drawn, and never for a part or the re-read.
 assert.match(text, /heaviest held at the tee:\n +redwood leaf +4\.2 M +x120\n +ground, fine +0\.3 M +x9/);
 assert.equal(text.match(/heaviest held/g).length, BENCH_SPOTS.length);
 // The what-ifs price the next levers in the same run.
 for (const what of ['ground in plain paint']) assert.match(text, new RegExp(`tee +${what} `));
 // When each reading was taken: a slowdown by time is the device, by place the scene.
 assert.match(text, /draws +tris +at s\n +tee +as drawn +30 +50 +40 +5 +300 +10\.0 M +2\n/);
 assert.match(text, /tee +as drawn, at the end/);
 assert.match(text, /tee +hold 1: as drawn +30/);
 assert.match(text, /tee +hold 5: nothing drawn +30/);
 // The game's light, once and wherever it changed.
 assert.match(text, /state at 2 s: hour 10\.0[^\n]*\n +changed at 10 s: hour 10\.1/);
 assert.equal(text.match(/changed at/g).length, 1);
 assert.match(text, /250 m up +as drawn/);
 assert.equal(formatBench(null), '');
 assert.match(formatBench({rows, tier: 'medium', notes: ['the page was put away during the run']}), /note +the page was put away/, 'what may have spoiled it is said');
 const report = diagnosticReport({build: {label: 'x'}, app: {}, device: {}, webgl: {}, frames: null, errors: [], bench: {rows, tier: 'low'}});
 assert.match(report, /DEVICE BENCHMARK/, 'the diagnostic carries it');
 assert.doesNotMatch(diagnosticReport({build: {label: 'x'}, app: {}, device: {}, webgl: {}, frames: null, errors: []}), /DEVICE BENCHMARK/, 'and nothing when none was run');
});
