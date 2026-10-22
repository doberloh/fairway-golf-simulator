import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneLift, liftsView, LIFT_SIDEWAYS, LIFT_UPRIGHT} from '../src/phone-view.js';

// The ball and the aim line clear of the phone's controls (UI/UX pass V3).
test('the picture lifts on a phone, both ways up, and nowhere else', () => {
 assert.equal(phoneLift(844, 390), Math.round(390 * LIFT_SIDEWAYS));
 assert.equal(phoneLift(390, 844), Math.round(844 * LIFT_UPRIGHT));
 assert.equal(phoneLift(1920, 1080), 0);
 assert.equal(phoneLift(1366, 768), 0);
 // A tablet held upright is wider than a phone: not lifted.
 assert.equal(phoneLift(768, 1024), 0);
 assert.equal(phoneLift(0, 0), 0);
 // Measured sideways: the ball at y 309 of 390, the meter from 268 down.
 assert.ok(309 - phoneLift(844, 390) < 268);
 // Measured upright: the ball at y 670 of 844; the lie row now starts at 490.
 assert.ok(670 - phoneLift(390, 844) < 490);
});

test('only the views that follow the ball are lifted', () => {
 for (const m of ['player', 'target', 'green']) assert.ok(liftsView(m), m);
 for (const m of ['overview', 'free', 'holeout']) assert.ok(!liftsView(m), m);
});
