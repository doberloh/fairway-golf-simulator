import test from 'node:test';
import assert from 'node:assert/strict';
import {FLOW_SPEED, SLOPE_BANDS, slopeBand, flowSpeed, slopeColor} from '../src/green-reading.js';

// THE FLOW'S SPEED SAYS HOW MUCH BREAK (the owner, 15 November 2026: "A gentle
// break needs to have the indicator move slower than a fast break"): faster on
// every steeper band, and far faster on the steepest than the gentlest.
test('the downhill markers run faster on every steeper band, fifteen times from gentlest to steepest', () => {
 for (let i = 1; i < FLOW_SPEED.length; i++) assert.ok(FLOW_SPEED[i] > FLOW_SPEED[i - 1] * 1.5, `band ${i} clearly faster than band ${i - 1}`);
 assert.ok(FLOW_SPEED.at(-1) / FLOW_SPEED[0] >= 10);
 assert.deepEqual([.005, .015, .025, .04, .08].map(slopeBand), [0, 1, 2, 3, 4]);
 assert.equal(flowSpeed(.005), FLOW_SPEED[0]);
 assert.equal(flowSpeed(.2), FLOW_SPEED[4]);
 // The same bands as the grid's colours.
 assert.equal(SLOPE_BANDS.length + 1, FLOW_SPEED.length);
 assert.notEqual(slopeColor(.009).getHex(), slopeColor(.011).getHex());
});
