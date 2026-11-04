// THE COUNTRY IS ONE SURFACE (the owner, 4 November 2026: "each hole exists in
// sort of a bowl with a creased rise of land between them"). The hills and the
// landforms used to be multiplied by a fade that was nothing on a corridor and
// grew with the distance from it, which could only raise the ground away from
// a hole, so every hole lay in a trough; and the distance to the nearest
// corridor peaks in a sharp line halfway between two of them, which was the
// crease. Now a hole lies on the country's own long shape (`softField` of the
// heights), the ground rising on one side and falling on the other as it does
// beside a real hole, and the fade is read from a softened distance with no
// line in it.
//
// A pure grid: nothing here knows about holes or three.js.

// `sample(x, z)` on a grid of `cell` metres over the box, softened by three
// passes of a box `radius` metres to each side (so felt out to about three
// times that), and read back bilinearly; outside the box it holds the edge.
export function softField(x0, z0, x1, z1, cell, sample, radius) {
 const nx = Math.ceil((x1 - x0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1, a = new Float32Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) a[i + j * nx] = sample(x0 + i * cell, z0 + j * cell);
 const r = Math.max(1, Math.round(radius / cell));
 for (let pass = 0; pass < 3; pass++) {
  smear(a, nx, nz, 1, nx, r);
  smear(a, nz, nx, nx, 1, r);
 }
 return (x, z) => {
  const u = Math.min(nx - 1.001, Math.max(0, (x - x0) / cell)), v = Math.min(nz - 1.001, Math.max(0, (z - z0) / cell));
  const i = Math.floor(u), j = Math.floor(v), s = u - i, t = v - j, at = i + j * nx;
  return (a[at] * (1 - s) + a[at + 1] * s) * (1 - t) + (a[at + nx] * (1 - s) + a[at + nx + 1] * s) * t;
 };
}

// One box pass along every line of a grid: `n` cells a line, `lines` of them,
// `step` between cells and `next` between lines. The line's ends are held, so
// a field does not sag toward nothing at the edge of the box.
function smear(a, n, lines, step, next, r) {
 const line = new Float32Array(n);
 for (let l = 0; l < lines; l++) {
  const at = l * next;
  for (let i = 0; i < n; i++) line[i] = a[at + i * step];
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += line[Math.min(n - 1, Math.max(0, i))];
  for (let i = 0; i < n; i++) {
   a[at + i * step] = sum / (2 * r + 1);
   sum += line[Math.min(n - 1, i + r + 1)] - line[Math.max(0, i - r)];
  }
 }
}

// The mean of a field over the box, on its own grid of `cell` metres.
export function fieldMean(x0, z0, x1, z1, cell, field) {
 let sum = 0, n = 0;
 for (let z = z0; z <= z1; z += cell) for (let x = x0; x <= x1; x += cell) { sum += field(x, z); n++; }
 return n ? sum / n : 0;
}
