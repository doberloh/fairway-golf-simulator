// The two things the renderer needs to know about a body of water that are not
// geometry, kept free of three so both can be tested without a GPU.
//
// This file replaces `water-reflector.js`, which existed to decide which single
// pond got the one planar mirror the frame budget could afford. That decision
// was the source of the worst thing about the water: the mirror was handed from
// body to body as the camera moved, and every handoff was one pond turning from
// water into varnish and another turning back. There is no mirror now, so there
// is nothing to choose between -- every body reflects its own surroundings from
// its own cubemap probe, always, and nothing changes under the camera.

// HIDING THE WATER WHILE A PROBE IS TAKEN, AND GIVING IT BACK.
//
// A probe that can see other water surfaces bakes them into the reflection, and
// one that can see its own is a feedback loop, so every body is hidden for the
// capture. The restore is the half that went wrong once: a water body is a
// WRAPPER around its mesh, and writing `visible` on the wrapper sets a property
// nothing reads. Every pond stayed hidden, and what showed through was the
// water-coloured ground underneath -- which looks exactly like a flat texture
// laid over the pond.
export function hideForProbe(bodies = []) {
 const hidden = bodies.filter(b => b?.mesh?.visible);
 for (const b of hidden) b.mesh.visible = false;
 return hidden;
}

export function restoreAfterProbe(hidden = []) {
 for (const b of hidden) if (b?.mesh) b.mesh.visible = true;
 return hidden.length;
}

// HOW FAST THE SURFACE TRAVELS, AND WHICH WAY.
//
// Still water does not travel at all: a pond's ripples move but the field they
// move through stays put, so the flow is zero and the shader takes its cheap
// path. A creek does travel, and it travels along its own channel.
//
// Metres per second. Slow on purpose -- the visible speed of a stream surface
// is mostly its ripples, and pushing the whole field faster than this reads as
// a texture being dragged rather than as water moving.
// Halved from 0.25 after the owner found rivers and creeks far too busy.
export const STREAM_FLOW = .12;

// WHICH WAY IS DOWNSTREAM, AND HOW FAR ALONG, AT EVERY STATION. The water used
// to take one direction for the whole channel, first station to last, so where
// a river bent back on itself the ripples and the foam kept going the way it
// started -- across the bank, or upstream (the owner). Each station now carries
// its own downstream tangent (from its neighbours) and its distance along the
// channel, and the shader works in those. Downstream is toward the lower end:
// the station order is not promised to run with the water.
export function streamFrame(path) {
 const n = path?.length ?? 0;
 if (n < 2) return [];
 const down = (path[n - 1].level ?? 0) <= (path[0].level ?? 0) ? 1 : -1;
 const order = down > 0 ? path.map((_, i) => i) : path.map((_, i) => n - 1 - i);
 const out = new Array(n);
 let s = 0;
 for (let k = 0; k < n; k++) {
  const i = order[k], a = path[order[Math.max(0, k - 1)]], b = path[order[Math.min(n - 1, k + 1)]];
  if (k) { const q = path[order[k - 1]]; s += Math.hypot(path[i].x - q.x, path[i].z - q.z); }
  let tx = b.x - a.x, tz = b.z - a.z; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
  out[i] = {tx, tz, s};
 }
 return out;
}
export function flowFor(body) {
 const path = body?.stream;
 if (!Array.isArray(path) || path.length < 2) return {x: 0, y: 0};
 // First to last, not segment by segment: one direction for the whole body,
 // because the body is drawn with one material and carries one uniform.
 const a = path[0], b = path[path.length - 1];
 const dx = (b?.x ?? 0) - (a?.x ?? 0), dz = (b?.z ?? 0) - (a?.z ?? 0);
 const len = Math.hypot(dx, dz);
 // A channel that starts and ends in the same place has no direction to give.
 if (!(len > 1e-6)) return {x: 0, y: 0};
 return {x: dx / len * STREAM_FLOW, y: dz / len * STREAM_FLOW};
}
