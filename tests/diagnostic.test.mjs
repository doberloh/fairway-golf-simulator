// The diagnostic block a tester pastes into a bug report.
//
// What is worth testing here is not the gathering -- that needs a browser and
// a GPU -- but the two things that make a report useless: a missing reading
// rendering as "undefined" so nobody can tell absent from broken, and the
// assembly throwing while somebody is already having a problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStamp, buildLabel, deviceFacts, webglFacts, frameMeter, errorLog, diagnosticReport}
 from '../src/diagnostic.js';

test('an unstamped build reports itself rather than throwing', () => {
 // __FAIRWAY_BUILD__ is injected by vite and is NOT defined under the test
 // runner. A bare reference to an undefined define is a ReferenceError, which
 // would take the whole module down on import; this is the guard for that.
 const stamp = buildStamp();
 assert.equal(stamp.source, 'unstamped');
 assert.equal(stamp.commit, null);
 assert.equal(buildLabel(), 'unknown build');
});

test('a build label prefers the commit and keeps the date readable', () => {
 assert.equal(buildLabel({commit: 'abc1234', built: '2026-09-25T13:40:11.000Z'}),
  'abc1234 (2026-09-25 13:40)');
 assert.equal(buildLabel({commit: 'abc1234', built: null}), 'abc1234');
 assert.match(buildLabel({commit: null, built: '2026-09-25T13:40:11.000Z'}), /^unversioned build, /);
});

test('every missing reading prints as unknown, never as undefined or zero', () => {
 const text = diagnosticReport({});
 assert.ok(!text.includes('undefined'), 'no undefined leaked into the report');
 assert.ok(!text.includes('null'), 'no null leaked into the report');
 assert.ok(text.includes('unknown'));
 // A reading that is genuinely absent must not be reported as a measurement.
 assert.match(text, /fps\s+not measured yet/);
});

test('the report names the build, the versions and where the player was', () => {
 const text = diagnosticReport({
  build: {label: 'abc1234 (2026-09-25 13:40)'},
  app: {generator: 32, schema: 8, mode: 'play', course: 'Sitka Bluff', hole: '7 of 18',
        biome: 'pnw', tier: 'high', frameCap: 60},
 });
 assert.match(text, /version\s+abc1234/);
 assert.match(text, /generator\s+32/);
 assert.match(text, /schema\s+8/);
 assert.match(text, /hole\s+7 of 18/);
 assert.match(text, /tier\s+high/);
 assert.match(text, /frame cap\s+60 fps/);
});

test('no frame cap reads as following the display, not as zero', () => {
 assert.match(diagnosticReport({app: {frameCap: 0}}), /frame cap\s+follow display/);
});

test('the errors and course-code sections appear only when there is something to say', () => {
 const bare = diagnosticReport({});
 assert.ok(!bare.includes('ERRORS'));
 assert.ok(!bare.includes('COURSE CODE'));
 const full = diagnosticReport({errors: ['TypeError: x is not a function'], courseCode: 'FW1.abc.def123'});
 assert.match(full, /ERRORS/);
 assert.match(full, /TypeError: x is not a function/);
 assert.match(full, /FW1\.abc\.def123/);
});

test('a row that does not apply is dropped; a row the browser refused says unknown', () => {
 // Two kinds of missing, and confusing them sends whoever reads the report
 // hunting for a fault that was never there. Sitting in the menu there is no
 // course and no hole -- those rows go. The GPU is always asked for, and a
 // browser that withholds it (Firefox under resistFingerprinting) is itself
 // worth knowing, so that row stays and says so.
 const menu = diagnosticReport({app: {mode: 'menu'}});
 assert.ok(!menu.includes('course'), 'no course row while in the menu');
 assert.ok(!menu.includes('hole'), 'no hole row while in the menu');
 assert.match(menu, /mode\s+menu/);
 assert.match(menu, /gpu\s+unknown/);
 assert.match(menu, /browser\s+unknown/);
 const playing = diagnosticReport({app: {mode: 'play', course: 'Sitka Bluff', hole: '7 of 18'}});
 assert.match(playing, /course\s+Sitka Bluff/);
 assert.match(playing, /hole\s+7 of 18/);
});

test('a report carries the time it was taken, when it is given one', () => {
 assert.match(diagnosticReport({takenAt: '2026-09-25T22:18:04.221Z'}), /2026-09-25 22:18:04 UTC/);
 assert.ok(!diagnosticReport({}).includes('UTC'));
});

test('the report says plainly that nothing was transmitted', () => {
 // The project publishes a verified claim of zero runtime network requests.
 // The line is in the report so the person pasting it knows what they hold.
 assert.match(diagnosticReport({}), /Nothing in this report was sent anywhere/);
});

test('the frame meter reports a median and a worst case, not a mean', () => {
 const m = frameMeter(64);
 assert.equal(m.read(), null, 'too few samples is not a reading');
 for (let i = 0; i < 40; i++) m.sample(16.7);
 // One catastrophic frame. A mean would bury it; the worst case is the point.
 m.sample(250);
 const r = m.read();
 assert.equal(r.median, 60);
 assert.equal(r.worstMs, 250);
 assert.equal(r.frames, 41);
});

test('the frame meter ignores a backgrounded tab', () => {
 // A hidden tab stops painting, and folding that gap in would make every
 // report look catastrophic.
 const m = frameMeter(64);
 for (let i = 0; i < 20; i++) m.sample(16.7);
 m.sample(45000);
 m.sample(-3);
 m.sample(0);
 const r = m.read();
 assert.equal(r.frames, 20);
 assert.equal(r.worstMs, 17);
});

test('the error log bounds itself, counts repeats and keeps the newest', () => {
 const log = errorLog(3);
 log.push('first');
 // A broken frame throws sixty times a second; it must not fill the report.
 for (let i = 0; i < 60; i++) log.push('every frame');
 log.push('second');
 log.push('third');
 log.push('fourth');
 const read = log.read();
 assert.equal(read.length, 3);
 assert.deepEqual(read, ['second', 'third', 'fourth']);
 const counted = errorLog(3);
 counted.push('boom');
 counted.push('boom');
 counted.push('boom');
 assert.deepEqual(counted.read(), ['boom  (x3)']);
});

test('the error log survives rubbish and truncates a novel', () => {
 const log = errorLog();
 log.push(null);
 log.push(undefined);
 log.push('   ');
 assert.deepEqual(log.read(), [], 'nothing empty is recorded');
 log.push('x'.repeat(5000));
 assert.equal(log.read()[0].length, 300);
});

test('console.error is wrapped, never swallowed', () => {
 const seen = [];
 const fake = {console: {error: (...a) => seen.push(a.join(' '))}, addEventListener() {}};
 const log = errorLog();
 log.install(fake);
 fake.console.error('something broke', new Error('and here is why'));
 assert.equal(seen.length, 1, 'the original console.error still ran');
 assert.match(log.read()[0], /something broke/);
 assert.match(log.read()[0], /and here is why/);
});

test('device and webgl facts never throw on a hostile or absent host', () => {
 assert.doesNotThrow(() => deviceFacts(undefined));
 assert.doesNotThrow(() => deviceFacts({}));
 assert.equal(deviceFacts({}).agent, null);
 // A browser that withholds the renderer is a normal answer, not a failure:
 // Firefox does it under resistFingerprinting.
 assert.deepEqual(webglFacts(null), {renderer: null, vendor: null, version: null});
 assert.deepEqual(webglFacts({getExtension() { throw new Error('denied'); }}),
  {renderer: null, vendor: null, version: null});
 const gl = {getExtension: () => ({UNMASKED_RENDERER_WEBGL: 1, UNMASKED_VENDOR_WEBGL: 2}),
             getParameter: p => ({1: 'Apple M2', 2: 'Apple'}[p] ?? 'WebGL 2.0')};
 assert.equal(webglFacts(gl).renderer, 'Apple M2');
 assert.equal(webglFacts(gl).vendor, 'Apple');
});

test('a report assembled from real-shaped facts holds together', () => {
 const m = frameMeter();
 for (let i = 0; i < 30; i++) m.sample(16.7);
 const text = diagnosticReport({
  build: {label: 'abc1234 (2026-09-25 13:40)'},
  app: {generator: 32, schema: 8, mode: 'play', course: 'Leeward Cay', hole: '3 of 9',
        biome: 'island', tier: 'medium', frameCap: 0},
  device: deviceFacts({navigator: {userAgent: 'TestBrowser/1.0', hardwareConcurrency: 8,
                                   maxTouchPoints: 0, language: 'en-GB'},
                       screen: {width: 2560, height: 1440}, innerWidth: 1280, innerHeight: 720,
                       devicePixelRatio: 2}),
  webgl: {renderer: 'Apple M2', vendor: 'Apple', version: 'WebGL 2.0'},
  frames: m.read(),
  errors: [],
  courseCode: 'FW1.eyJ2Ijo4fQ.ab12cd',
 });
 assert.ok(!text.includes('undefined'));
 assert.match(text, /browser\s+TestBrowser\/1\.0/);
 assert.match(text, /gpu\s+Apple M2/);
 assert.match(text, /screen\s+2560x1440/);
 assert.match(text, /viewport\s+1280x720/);
 assert.match(text, /touch\s+no/);
 assert.match(text, /fps\s+60 median/);
 assert.match(text, /FW1\./);
});
