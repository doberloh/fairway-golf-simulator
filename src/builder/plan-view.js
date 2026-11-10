// DOOR 2'S PLAN: the land from above, zoomed and dragged (the owner's amended
// goal, 31 October 2026: "allow zoom, and drag on the tracing and lidar view
// so that users can be more precise"). The wheel zooms about the pointer; the
// right or middle button -- or the left with Space held, or the Move tool --
// drags the view; every other press goes to the step's tool in local metres.
//
// Layers, each drawn once at the land's own cells into a canvas of its own
// and then scaled onto the screen (pixel-sharp when zoomed in): the shaded
// relief, the picture over it (which can be shifted while it is dragged into
// line), and the trace's surfaces; over them, drawn each frame by the step,
// the trees, the property box, the holes and whatever the tool is drawing.
// Last, at review, the course as it will be built ('course'). Each layer has
// an opacity (`setAlpha`), and the relief and the picture can trade places
// (`setOrder`): the LIDAR seen through the picture or over it, to line the
// two up (the owner, 1 November 2026). Over the relief at step 1, where the
// LIDAR files reach, in yellow ('coverage'; the owner, 1 November 2026).
const ORDER = ['relief', 'coverage', 'picture', 'codes', 'course'];

export function createPlanView(canvas, {onTool = null, overlay = null, onWindowChange = null} = {}) {
 const ctx = canvas.getContext('2d');
 const v = {scale: 1, cx: 0, cz: 0, land: null, layers: {}, show: {relief: true, coverage: true, picture: true, codes: true, course: true}, alpha: {}, order: ORDER.slice(), shift: {}, tool: 'move', space: false};
 let raf = 0, drag = null;
 const size = () => { const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1, w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } };
 const fitScale = () => Math.min(canvas.width / (2 * v.land.halfX), canvas.height / (2 * v.land.halfZ)) * .98;
 const api = {
  view: v,
  // Local metres to canvas pixels, and back.
  toScreen: (x, z) => [canvas.width / 2 + (x - v.cx) * v.scale, canvas.height / 2 + (z - v.cz) * v.scale],
  toWorld: (px, py) => ({x: v.cx + (px - canvas.width / 2) / v.scale, z: v.cz + (py - canvas.height / 2) / v.scale}),
  at(e) { const r = canvas.getBoundingClientRect(), d = canvas.width / r.width; return api.toWorld((e.clientX - r.left) * d, (e.clientY - r.top) * d); },
  // Canvas pixels for a CSS pixel (for line widths and handles).
  get px() { const r = canvas.getBoundingClientRect(); return canvas.width / (r.width || 1); },
  // The land to show ({nx, nz, cell, halfX, halfZ}).
  setLand(land) { v.land = land; v.layers = {}; v.shift = {}; api.fit(); },
  fit() { if (!v.land) return; size(); v.cx = 0; v.cz = 0; v.scale = fitScale(); api.draw(); },
  // A layer, painted one RGBA texel a cell: `paint(rgba, nx, nz)`.
  setLayer(name, paint) {
   const {nx, nz} = v.land, c = document.createElement('canvas'); c.width = nx; c.height = nz;
   const cx = c.getContext('2d'), id = cx.createImageData(nx, nz); paint(id.data, nx, nz); cx.putImageData(id, 0, 0);
   v.layers[name] = c; api.draw();
  },
  clearLayer(name) { delete v.layers[name]; api.draw(); },
  // Part of a layer repainted: `paint(rgba, i0, j0, w, h)` for that box.
  patchLayer(name, i0, j0, w, h, paint) {
   const c = v.layers[name]; if (!c) return;
   i0 = Math.max(0, Math.floor(i0)); j0 = Math.max(0, Math.floor(j0)); w = Math.min(v.land.nx - i0, Math.ceil(w)); h = Math.min(v.land.nz - j0, Math.ceil(h)); if (w <= 0 || h <= 0) return;
   const id = c.getContext('2d').createImageData(w, h); paint(id.data, i0, j0, w, h); c.getContext('2d').putImageData(id, i0, j0); api.draw();
  },
  showLayer(name, on) { v.show[name] = on; api.draw(); },
  // How a layer looks while drawn: a CSS filter ('brightness(1.2) contrast(1.1)'), or null.
  setFilter(name, f) { (v.filter ??= {})[name] = f || 'none'; api.draw(); },
  setAlpha(name, a) { v.alpha[name] = Math.max(0, Math.min(1, a)); api.draw(); },
  // The layers' drawing order, bottom first (names left out keep their place).
  setOrder(names) { v.order = [...names, ...ORDER.filter(n => !names.includes(n))]; api.draw(); },
  // A layer drawn `x`, `z` metres off its place (the picture while dragged).
  shiftLayer(name, x, z) { v.shift[name] = {x, z}; api.draw(); },
  setTool(t) { v.tool = t; canvas.style.cursor = t === 'move' ? 'grab' : 'crosshair'; },
  zoomBy(f, px = canvas.width / 2, py = canvas.height / 2) {
   if (!v.land) return;
   const before = api.toWorld(px, py);
   v.scale = Math.max(fitScale() * .5, Math.min(32 / v.land.cell, v.scale * f));
   const after = api.toWorld(px, py); v.cx += before.x - after.x; v.cz += before.z - after.z; api.draw();
  },
  // Centres the view on a point at a scale (pixels a metre).
  look(x, z, scale = v.scale) { v.cx = x; v.cz = z; v.scale = scale; api.draw(); },
  draw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintNow(); }); },
  drawNow: () => paintNow(),
 };
 function paintNow() {
  size();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1f1c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!v.land) return;
  const {cell, halfX, halfZ} = v.land;
  ctx.imageSmoothingEnabled = v.scale * cell < 2;
  for (const name of v.order) {
   const c = v.layers[name], a = v.alpha[name] ?? 1; if (!c || !v.show[name] || a <= 0) continue;
   const s = v.shift[name] ?? {x: 0, z: 0}, [x0, y0] = api.toScreen(-halfX - cell / 2 + s.x, -halfZ - cell / 2 + s.z);
   // A layer's look (the picture's brightness and contrast, builder-ux item
   // 20): a canvas filter while it is drawn, the layer itself unchanged.
   ctx.filter = v.filter?.[name] ?? 'none';
   ctx.globalAlpha = a; ctx.setTransform(v.scale * cell, 0, 0, v.scale * cell, x0, y0); ctx.drawImage(c, 0, 0);
   ctx.filter = 'none';
  }
  ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
  overlay?.(ctx, api);
 }
 // The pointer: drag the view, or hand the press to the tool.
 const panning = e => e.button === 1 || e.button === 2 || (e.button === 0 && (v.space || v.tool === 'move'));
 canvas.addEventListener('contextmenu', e => e.preventDefault());
 canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  if (panning(e)) { drag = {x: e.clientX, y: e.clientY, cx: v.cx, cz: v.cz}; canvas.style.cursor = 'grabbing'; return; }
  onTool?.('down', api.at(e), e);
 });
 canvas.addEventListener('pointermove', e => {
  if (drag) { const d = api.px; v.cx = drag.cx - (e.clientX - drag.x) * d / v.scale; v.cz = drag.cz - (e.clientY - drag.y) * d / v.scale; api.draw(); return; }
  onTool?.(e.buttons & 1 ? 'drag' : 'hover', api.at(e), e);
 });
 const up = e => { if (drag) { drag = null; api.setTool(v.tool); return; } onTool?.('up', api.at(e), e); };
 canvas.addEventListener('pointerup', up);
 canvas.addEventListener('dblclick', e => onTool?.('double', api.at(e), e));
 canvas.addEventListener('wheel', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(), d = canvas.width / r.width; api.zoomBy(Math.exp(-e.deltaY * .0015), (e.clientX - r.left) * d, (e.clientY - r.top) * d); }, {passive: false});
 window.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) { v.space = true; e.preventDefault(); } });
 window.addEventListener('keyup', e => { if (e.code === 'Space') v.space = false; });
 new ResizeObserver(() => api.draw()).observe(canvas);
 // A window moved to a screen of another pixel density changes no size:
 // drawn again (size() takes the new density), the view kept on its middle.
 api.stopWatching = onWindowChange?.(() => api.draw());
 return api;
}
