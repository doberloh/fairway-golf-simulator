import test from 'node:test';
import assert from 'node:assert/strict';
import {monitorSteps, monitorLight, lastShotLine, RELA_MONITORS, RELA_DOCS} from '../src/ui-monitor-setup.js';

// The setup screen's three steps tick in order: the bridge, then a connector
// talking to it, then the Arm switch. A step after an undone one cannot be
// done -- armed with no bridge is not "armed for live shots".
test('the steps tick as the monitor comes up', () => {
 const done = s => monitorSteps(s).map(x => x.done);
 assert.deepEqual(done({}), [false, false, false]);
 assert.deepEqual(done({connected: true}), [true, false, false]);
 assert.deepEqual(done({connected: true, device: {ballDetected: false}}), [true, true, false]);
 assert.deepEqual(done({connected: true, device: {}, armed: true}), [true, true, true]);
 assert.deepEqual(done({connected: false, device: {}, armed: true}), [false, false, false]);
});

test('the ball light says what the round screen says', () => {
 assert.equal(monitorLight({}).title, 'NO MONITOR');
 assert.equal(monitorLight({connected: true}).state, 'red');
 assert.equal(monitorLight({connected: true, device: {ballDetected: false}}).title, 'FINDING BALL');
 assert.equal(monitorLight({connected: true, device: {ballDetected: true}}).title, 'READY');
});

test('the last shot reads in miles per hour, degrees and rpm', () => {
 assert.equal(lastShotLine({speed: 156.2 * 0.44704, vla: 11.8, spin: 2610}), '156.2 MPH · 11.8° · 2,610 RPM');
 assert.equal(lastShotLine(null), '—');
 assert.equal(lastShotLine({speed: 40}), '89.5 MPH');
});

test('the monitors the setup screen lists are rēlā\'s, once each (UI/UX pass V3)', () => {
 assert.ok(RELA_MONITORS.length >= 9);
 assert.equal(new Set(RELA_MONITORS).size, RELA_MONITORS.length);
 for (const m of ['Garmin R10', 'SkyTrak', 'Foresight GC2', 'Full Swing KIT']) assert.ok(RELA_MONITORS.includes(m), m);
 // Not a promise rēlā makes, so not listed.
 assert.ok(!RELA_MONITORS.includes('Other'));
 assert.match(RELA_DOCS, /^https:\/\/docs\.rela\.golf\//);
});
