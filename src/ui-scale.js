// TEXT SIZE: the whole on-screen interface drawn larger or smaller (the owner, 1
// October, for projector bays). Device-local, with the graphics settings.
//
// Every size in the stylesheet is a fixed pixel size made for a laptop, mostly
// 8-12 px, so this scales the interface as a whole rather than the type alone --
// scaled type in unscaled panels would overflow them. It is CSS `zoom` on the
// app (style.css, the last rule): drawn `z` times larger and made `z` times
// smaller in CSS pixels, so it still fills the screen and lays itself out as the
// browser's own page zoom would, with the size rules written as container
// queries on the app so they see the zoomed size rather than the screen's.
//
// Three things outside CSS have to know: the 3D canvas (renderer.js sizes it
// from its container and multiplies its pixel ratio by the zoom, so the course
// is exactly as sharp at any text size), and the two pieces of code that turn
// pointer movement into panel positions (layout.js, popups.js), which divide
// screen pixels by the zoom.

export const TEXT_SIZE = {min: 75, max: 200, step: 5};

export function cleanTextSize(v) {
 if (v === 'auto' || v === undefined || v === null) return 'auto';
 const n = Number(v);
 if (!Number.isFinite(n)) return 'auto';
 return Math.round(Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, n)) / TEXT_SIZE.step) * TEXT_SIZE.step;
}

// HOW BIG TEXT LOOKS FROM WHERE YOU STAND. The angle one CSS pixel subtends:
// the screen's width over the browser's width in CSS pixels, over the distance.
// The reference is a laptop: a 14-inch 1920-pixel screen at 150% scaling,
// 20 inches away, 1.6 minutes of arc a pixel. That is a PLACED number -- it is
// one ordinary desk, not a published legibility standard -- and what it is for
// is "text as easy to read in the bay as at a desk".
export const LAPTOP_ARCMIN_PER_PX = 1.6;
export function arcminPerPixel({diagonal, aspect = 16 / 9, standFeet}, cssWidth) {
 const r = typeof aspect === 'number' ? aspect : ({'16:9': 16 / 9, '16:10': 1.6, '4:3': 4 / 3, '21:9': 21 / 9, '1:1': 1}[aspect] ?? 16 / 9);
 const width = Number(diagonal) * r / Math.sqrt(1 + r * r), distance = Number(standFeet) * 12;
 if (!(width > 0) || !(distance > 0) || !(cssWidth > 0)) return null;
 return Math.atan(width / cssWidth / distance) * 180 / Math.PI * 60;
}
// The size that keeps a bay's text at least as legible as a laptop's. Never
// below 100%: a projected picture is softer and dimmer than a panel, so even a
// bay that makes text look bigger than a laptop does gets no smaller text.
export function baySuggestion(bay, cssWidth) {
 const a = arcminPerPixel(bay, cssWidth);
 if (!a) return 100;
 return cleanTextSize(Math.max(100, 100 * LAPTOP_ARCMIN_PER_PX / a));
}

// NO LARGER THAN THE SCREEN CAN HOLD. A text size of z lays the interface out as
// a window z times smaller would be, and the smallest desktop window the layout
// is checked at (the smoke test's hud-reachable) is 1280x720 -- below that, shot
// controls start to fall off the bottom on the laptop layout. So the size is
// capped where the screen would shrink past that: 150% on a 1080p screen, 200%
// on a 4K or 2560-wide one. Never capped below 100%.
export const FIT = {width: 1280, height: 720};
export function maxTextSize(cssWidth, cssHeight) {
 if (!(cssWidth > 0) || !(cssHeight > 0)) return TEXT_SIZE.max;
 const fit = Math.floor(100 * Math.min(cssWidth / FIT.width, cssHeight / FIT.height) / TEXT_SIZE.step) * TEXT_SIZE.step;
 return Math.max(100, Math.min(TEXT_SIZE.max, fit));
}
// What is actually drawn: a number chosen by hand, or automatic -- 100% at a
// desk, the bay's suggestion in simulator mode -- within what the screen holds.
export function effectiveTextSize(setting, camera, cssWidth, cssHeight) {
 const s = cleanTextSize(setting);
 const want = s !== 'auto' ? s : camera?.sim ? baySuggestion(camera, cssWidth) : 100;
 return want <= 100 ? want : Math.min(want, maxTextSize(cssWidth, cssHeight));
}

// The zoom as the stylesheet sees it. Read back from the document so the drag
// code needs no wiring to the setting.
export function uiZoom(doc = globalThis.document) {
 const v = doc ? parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--ui-zoom')) : NaN;
 return v > 0 ? v : 1;
}
export function applyTextSize(percent, doc = globalThis.document) {
 doc?.documentElement.style.setProperty('--ui-zoom', String(percent / 100));
}
