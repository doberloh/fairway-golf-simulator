import test from 'node:test';
import assert from 'node:assert/strict';
import {secondRecorder, runWatch, speedOf, formatWatch, WATCH_SCRIPT, PROBE_EVERY} from '../src/device-watch.js';
import {diagnosticReport} from '../src/diagnostic.js';

// WATCH THIS DEVICE (src/device-watch.js): the recorder that measures play,
// and the scripted watch that asks the phone what it is doing.

test('the recorder keeps one line a second: frames, the slowest gap, the view and what happened', () => {
 const r = secondRecorder(3);
 r.event('touch');                         // before any frame: held for the first line
 for (let t = 1000; t < 2000; t += 50) r.frame(t, {view: 'player'});
 r.event('shot'); r.event('shot');         // once, however often
 r.frame(2100, {view: 'chase'});           // a 100 ms gap opens the next second
 r.frame(2150, {view: 'chase'});
 r.frame(3010);                            // closes 2 s
 const [a, b] = r.read();
 assert.deepEqual([a.t, a.frames, a.view, a.events], [1, 20, 'player', ['touch', 'shot']]);
 assert.deepEqual([b.t, b.frames, b.worstMs, b.view], [2, 2, 150, 'chase']);
 for (let t = 4000; t < 9000; t += 1000) r.frame(t);
 assert.equal(r.length, 3, 'five minutes and no more (here, three seconds)');
 assert.deepEqual(r.read(6, 8).map(l => l.t), [6, 7]);
 // A gap over a second is the page put away, not a slow frame.
 assert.ok(r.read().every(l => l.worstMs <= 1000));
});

test('the second\'s slowest gap keeps what that frame did, and the most triangles drawn', () => {
 const r = secondRecorder();
 r.frame(1000, {tris: 1.2e6});
 r.frame(1033, {cause: null, tris: 1.4e6});
 r.frame(1300, {cause: 'painted 32 m, 2 grass tiles made', tris: 1.3e6});  // the 267 ms gap: the frame before it painted
 r.frame(1333, {cause: 'trees re-sorted'});
 r.frame(2000);
 const [line] = r.read();
 assert.equal(line.worstMs, 267);
 assert.equal(line.cause, 'painted 32 m, 2 grass tiles made');
 assert.equal(line.tris, 1.4e6);
 const text = formatWatch({seconds: 1, before: [{...line, events: []}], during: [], probes: []});
 assert.match(text, /267 +1\.4M +; slowest: painted 32 m, 2 grass tiles made|267 +1\.4M +[^\n]*slowest: painted 32 m/);
});

test('the watch runs its script in order, probes every two seconds where asked, and always puts things back', async () => {
 const log = [];
 const io = {
  start: async () => log.push('start'),
  phase: async s => log.push('phase ' + s.id),
  seconds: async n => log.push('wait ' + n),
  rest: async n => log.push('rest ' + n),
  probe: async () => ({trip: 9, math: 2, memory: 3, cpu: 1}),
  restore: async () => log.push('restore'),
 };
 const steps = [];
 const w = await runWatch(io, {onStep: (i, n) => steps.push([i, n])});
 assert.equal(log[0], 'start'); assert.equal(log.at(-1), 'restore');
 assert.deepEqual(log.filter(e => e.startsWith('phase')).map(e => e.slice(6)), WATCH_SCRIPT.map(s => s.id));
 assert.deepEqual(log.filter(e => /^rest [0-9]/.test(e)), ['rest 1', 'rest 3', 'rest 6']);
 // The rests come late: after the first minute and a half, when every run so
 // far had been fast for a minute.
 assert.ok(WATCH_SCRIPT.findIndex(s => s.rest) >= 3 && WATCH_SCRIPT.slice(0, 3).reduce((n, s) => n + s.seconds, 0) >= 70);
 const probed = WATCH_SCRIPT.filter(s => s.probes).reduce((n, s) => n + Math.ceil(s.seconds / PROBE_EVERY), 0);
 assert.equal(w.probes.length, probed, 'no probe in the untouched first phase');
 assert.ok(!w.probes.some(p => p.phase === 'play'));
 assert.equal(w.seconds, WATCH_SCRIPT.reduce((n, s) => n + s.seconds + (s.rest ?? 0), 0));
 assert.ok(w.seconds >= 120 && w.seconds <= 180, `about two and a half minutes: ${w.seconds} s`);
 assert.deepEqual(steps.at(-1), [WATCH_SCRIPT.length, WATCH_SCRIPT.length]);
 // Whatever goes wrong, restore runs.
 const broken = {...io, phase: async () => { throw Error('no flyover'); }};
 log.length = 0;
 await assert.rejects(runWatch(broken), /no flyover/);
 assert.equal(log.at(-1), 'restore');
});

test('fast and slow are told by the graphics probe against the run\'s own best', () => {
 const s = speedOf([{at: 2, phase: 'a', math: 1}, {at: 4, phase: 'a', math: 1.5}, {at: 6, phase: 'b', math: 4}, {at: 8, phase: 'b'}]);
 assert.deepEqual(s.map(p => p.slow), [false, false, true]);
 assert.equal(speedOf([]), null);
});

test('the report shows play before the tap, the watch a probe a line, and the changes of speed', () => {
 const before = Array.from({length: 25}, (_, i) => ({t: 100 + i, frames: i < 10 ? 30 : 18, worstMs: i === 12 ? 140 : 40, view: 'player', events: i === 14 ? ['shot'] : []}));
 const during = [{at: 1, phase: 'play', frames: 29, events: []}, {at: 2, phase: 'play', frames: 31, events: []},
  {at: 31, phase: 'probed', frames: 30, events: ['touch']}, {at: 32, phase: 'probed', frames: 30, events: []},
  {at: 33, phase: 'probed', frames: 14, events: []}, {at: 34, phase: 'probed', frames: 15, events: []}];
 const probes = [{at: 32, phase: 'probed', trip: 9.2, math: 1.1, memory: 2.4, cpu: 1.3}, {at: 34, phase: 'probed', trip: 9.4, math: 5.6, memory: 14.2, cpu: 1.4},
  {at: 36, phase: 'flyover', failed: 'no float targets'}];
 const text = formatWatch({seconds: 155, cap: 30, reps: {math: 16, memory: 8}, course: 'Cascade View Forest, hole 4', before, during, probes});
 assert.match(text, /probe sizes +math 16 passes, memory 8 passes/, 'how big each probe was made, Safari counting whole milliseconds');
 assert.match(text, /SPEED WATCH/);
 assert.match(text, /frame cap +30 fps, lifted for the watch/);
 assert.match(text, /play before the tap \(25 s recorded\):/);
 assert.match(text, /\n +-24 +30 +30 +40 +- +player\n/, 'ten seconds a line, timed back from the tap');
 assert.match(text, /\n +-14 +18 +18 +140 +- +player; shot\n/);
 assert.match(text, /32 +your view, probed +30 +9\.2 +1\.1 +2\.4 +1\.3 +touch/);
 assert.match(text, /34 +your view, probed +15 +9\.4 +5\.6 +14 +1\.4/);
 assert.match(text, /probe failed: no float targets/);
 assert.match(text, /your view without probes: 31 fps median, 29 slowest second, over 2 s/);
 assert.match(text, /speed changes +slow at 34 s \(probed\)/);
 assert.equal(formatWatch(null), '');
 const report = diagnosticReport({build: {label: 'x'}, app: {}, device: {}, webgl: {}, frames: null, errors: [], watch: {seconds: 1, probes: [], before: [], during: []}});
 assert.match(report, /SPEED WATCH/, 'the diagnostic carries it');
});
