import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanTextSize, arcminPerPixel, baySuggestion, maxTextSize, effectiveTextSize, LAPTOP_ARCMIN_PER_PX, TEXT_SIZE} from '../src/ui-scale.js';
import {saveGraphics} from '../src/graphics.js';

test('the setting is automatic unless a size was chosen, and a chosen size is kept in range and in steps', () => {
 assert.equal(cleanTextSize(undefined), 'auto');
 assert.equal(cleanTextSize('auto'), 'auto');
 assert.equal(cleanTextSize('big'), 'auto');
 assert.equal(cleanTextSize(150), 150);
 assert.equal(cleanTextSize(152), 150);
 assert.equal(cleanTextSize(10), TEXT_SIZE.min);
 assert.equal(cleanTextSize(900), TEXT_SIZE.max);
 assert.equal(saveGraphics({}).textSize, 'auto');
 assert.equal(saveGraphics({textSize: 130}).textSize, 130);
});

test('how big a pixel of text looks from the bay', () => {
 // The default bay -- a 138" 16:9 screen, 8 ft back -- with a 1080p projector:
 // 120.3" across 1920 px is 0.0627" a pixel, which at 96" is 2.24 arcmin.
 const bay = {diagonal: 138, aspect: '16:9', standFeet: 8};
 assert.ok(Math.abs(arcminPerPixel(bay, 1920) - 2.245) < .01);
 // Twice the pixels across, half the angle; twice as far back, about half too.
 assert.ok(Math.abs(arcminPerPixel(bay, 3840) - arcminPerPixel(bay, 1920) / 2) < .01);
 assert.ok(Math.abs(arcminPerPixel({...bay, standFeet: 16}, 1920) - arcminPerPixel(bay, 1920) / 2) < .01);
 assert.equal(arcminPerPixel({...bay, standFeet: 0}, 1920), null);
});

test('the bay suggestion keeps text as legible as a laptop, and never shrinks it', () => {
 const bay = {diagonal: 138, aspect: '16:9', standFeet: 8};
 // 1080p: text already looks bigger than on a laptop; it stays at 100%.
 assert.equal(baySuggestion(bay, 1920), 100);
 // A 4K projector at 100% scaling: each pixel half the angle, so text is
 // scaled up to look at least laptop-sized again.
 const fourK = baySuggestion(bay, 3840);
 assert.ok(fourK > 100 && fourK <= TEXT_SIZE.max, `4K suggests ${fourK}`);
 assert.ok(arcminPerPixel(bay, 3840) * fourK / 100 >= LAPTOP_ARCMIN_PER_PX * .95);
 // Further back, bigger.
 assert.ok(baySuggestion({...bay, standFeet: 14}, 3840) >= fourK);
});

test('a size is never more than the screen can hold, but a small one is never refused', () => {
 assert.equal(maxTextSize(1920, 1080), 150);
 assert.equal(maxTextSize(2560, 1440), 200);
 assert.equal(maxTextSize(3840, 2160), 200);
 assert.equal(maxTextSize(1366, 768), 105);
 assert.equal(maxTextSize(1024, 600), 100, 'never capped below 100%');
 assert.equal(effectiveTextSize(200, {sim: false}, 1920, 1080), 150);
 assert.equal(effectiveTextSize(75, {sim: false}, 1024, 600), 75);
});

test('automatic is 100% at a desk and the bay suggestion in simulator mode', () => {
 const bay = {sim: true, diagonal: 138, aspect: '16:9', standFeet: 8};
 assert.equal(effectiveTextSize('auto', {sim: false}, 3840, 2160), 100);
 assert.equal(effectiveTextSize('auto', bay, 3840, 2160), baySuggestion(bay, 3840));
 // A size chosen by hand wins over the bay.
 assert.equal(effectiveTextSize(120, bay, 3840, 2160), 120);
});
