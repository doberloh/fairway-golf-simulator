// THE STEADIED BRUSH (the builder-ux goal, 10 November 2026; the owner:
// "Paint brushing is great, but can result in really squiggly lines"). The
// brush trails the pointer on a string: it moves only when the pointer pulls
// the string tight, and then straight towards it, so the small shakes of a
// hand on a mouse never reach the paint -- the "lazy mouse" of paint programs.
// Along the brush's path, dabs are laid evenly, so a quick drag leaves no gaps
// between the pointer's events (the brush used to lay one disc an event).
// Pure; tests/builder-steady.test.mjs.
//
// `string`: how far the pointer may wander before the brush follows, in the
// plan's units (metres; the caller turns screen pixels into metres). 0 is the
// plain brush. `spacing`: how far apart the dabs are.
export function createSteady({string = 0, spacing = 1} = {}) {
 let brush = null, last = null;
 const along = (to, out) => {
  const dx = to.x - last.x, dz = to.z - last.z, d = Math.hypot(dx, dz);
  if (d < spacing) return out;
  const n = Math.floor(d / spacing);
  for (let i = 1; i <= n; i++) out.push({x: last.x + dx * i / n * (n * spacing / d), z: last.z + dz * i / n * (n * spacing / d)});
  last = out.length ? out[out.length - 1] : last;
  return out;
 };
 return {
  // The press: a dab where it is.
  down(p) { brush = {x: p.x, z: p.z}; last = {...brush}; return [{...brush}]; },
  // The pointer moved: the dabs to lay now (perhaps none).
  move(p) {
   if (!brush) return this.down(p);
   const dx = p.x - brush.x, dz = p.z - brush.z, d = Math.hypot(dx, dz);
   if (d <= string) return [];
   const k = (d - string) / d;
   brush = {x: brush.x + dx * k, z: brush.z + dz * k};
   return along(brush, []);
  },
  // Where the brush is (for drawing its circle), or null between strokes.
  get at() { return brush; },
  // Let go: the brush catches up to where the pointer was let go, laying its
  // dabs on the way, so a stroke shorter than the string still paints (the
  // builder-door-2 journey's 10 m stroke painted nothing until it did).
  up(p) {
   const out = brush && last && p ? along(p, []) : [];
   if (brush && last && p && Math.hypot(p.x - last.x, p.z - last.z) > 1e-9) out.push({x: p.x, z: p.z});
   brush = null; last = null; return out;
  },
 };
}
