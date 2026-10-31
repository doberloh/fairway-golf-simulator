// What tests/clubhouse.test.mjs reads from each course, measured on the
// thread that built it (worlds.mjs `measured`).
import {inBuilding, inForecourt} from '../../src/clubhouse.js';

export function measure(w, {biome}) {
 const b = w.buildings[0], m = {buildings: w.buildings.length, clear: []};
 m.building = b ? {kind: b.kind, club: !!b.club, width: b.width, depth: b.depth, height: b.height} : null;
 // Does the nine come home: its last green within 200 m of the first tee.
 const t = w.holes[0].toWorld(w.holes[0].tees.blue), g = w.holes[w.holes.length - 1].worldGreen;
 m.home = Math.hypot(g.x - t.x, g.z - t.z) <= 200;
 if (!b) return m;
 // It stands on clear ground, faces the first tee, nothing grows on it or its lawn.
 const h = w.holes[0], tee = h.toWorld(h.tees.blue);
 for (const tr of w.trees) if (!tr.under && (inBuilding(b, tr.x, tr.z, 3) || inForecourt(b, tr.x, tr.z))) m.clear.push(`${biome}: a ${tr.kind} on the clubhouse or its lawn`);
 for (const home of w.homes) if (inBuilding(b, home.x, home.z, 10)) m.clear.push(`${biome}: a house on the clubhouse`);
 // Its front (local -z) points at the tee.
 const fx = -Math.sin(b.rotation), fz = -Math.cos(b.rotation), tx = tee.x - b.x, tz = tee.z - b.z, l = Math.hypot(tx, tz);
 if (!((fx * tx + fz * tz) / l > .99)) m.clear.push(`${biome}: not facing the first tee`);
 // Not on a green, tee, sand or water.
 for (const [dx] of [[0, 0], [b.width / 2, 0], [-b.width / 2, 0]]) {
  const s = w.surface(b.x + dx * Math.cos(b.rotation), b.z - dx * Math.sin(b.rotation));
  if (['green', 'tee', 'sand', 'water'].includes(s)) m.clear.push(`${biome}: the clubhouse on ${s}`);
 }
 return m;
}
