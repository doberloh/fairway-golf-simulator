// WHERE THE MAP AND THE SHOT NUMBERS SIT, when the player has moved them (the
// owner, 18 October 2026: "I want to be able to move at least the map and the
// shot data around"). Round 13 fixed the round screen's layout; these two came
// back as the exceptions. Pure: no DOM. main.js drags them and draws them.
//
// A place is the piece's top-left corner as a fraction of the playing area,
// so a place made in a small window still means the same spot in a big one.
// Drawn, it is held fully on screen: a piece moved to the edge of a wide
// window and then shown in a narrow one slides back in rather than off.

export const PIECES = ['map', 'tiles'];
export const KEY = 'fairway-hud-places-v1';

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Only well-formed places of known pieces survive a load; anything else is
// as if the piece had never been moved.
export function cleanPlaces(raw) {
 const out = {};
 if (!raw || typeof raw !== 'object') return out;
 for (const k of PIECES) {
  const p = raw[k], x = num(p?.x), y = num(p?.y);
  if (x !== null && y !== null) out[k] = {x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y))};
 }
 return out;
}

// The place (fractions) a drag leaves: the box's left and top over the area.
export function placeFrom(box, area) {
 const W = area.w || 1, H = area.h || 1;
 const c = clampBox(box, area);
 return {x: c.left / W, y: c.top / H};
}

// Where a stored place draws, in pixels of the area, kept on screen. `size` is
// the piece's drawn width and height in the same pixels.
export function placeIn(place, size, area, margin = 8) {
 return clampBox({left: place.x * area.w, top: place.y * area.h, w: size.w, h: size.h}, area, margin);
}

// A box held inside the area, `margin` from each edge where it fits; a box
// bigger than the area keeps its top-left corner on screen.
export function clampBox(box, area, margin = 0) {
 const maxL = Math.max(margin, area.w - box.w - margin), maxT = Math.max(margin, area.h - box.h - margin);
 return {left: Math.min(maxL, Math.max(margin, box.left)), top: Math.min(maxT, Math.max(margin, box.top))};
}

export function loadPlaces(store = globalThis.localStorage) {
 try { return cleanPlaces(JSON.parse(store?.getItem(KEY) ?? 'null')); } catch { return {}; }
}
export function savePlaces(places, store = globalThis.localStorage) {
 const clean = cleanPlaces(places);
 try { if (Object.keys(clean).length) store?.setItem(KEY, JSON.stringify(clean)); else store?.removeItem(KEY); } catch {}
 return clean;
}
