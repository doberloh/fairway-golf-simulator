// DOOR 2, "GENERATE A REAL LIFE COURSE" (the course builder, stage 7;
// docs/COURSE_BUILDER.md, *Two front doors*): LIDAR files of a real place,
// the property chosen on its relief, the land built, a picture laid on it, the
// holes marked by hand, the auto trace (LIDAR first, the picture as fallback),
// a landscape -- then the editor. The steps are real-course.js's, which the
// scripted build of a real course (tools/real-course.mjs) runs too; this file
// is their screens and the plan view they are worked on.
import {show, setTitle, setBusy, topTools, home, pickFile, ui} from './builder.js';
import {openSource, formOf} from '../lidar/formats.js';
import {readGeoTiffRgb} from '../lidar/geotiff.js';
import {converter} from '../lidar/geo.js';
import {crsOf, toMetres} from '../lidar/las.js';
import {createGridder} from '../lidar/land.js';
import {trace, TRACE, SOURCE} from '../lidar/trace.js';
import {sourcesBox, crsOfSources, landFromSources, pictureOnLand, affineFromPairs, docFromLand, MAX_PROPERTY} from './real-course.js';
import {validateDoc} from '../course-doc.js';
import {BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {openEditor} from './editor.js';

const {el} = ui;
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const TRACE_COLOUR = {rough: null, fairway: [70, 150, 60], semi: [140, 180, 100], tee: [120, 200, 120], green: [170, 230, 140], sand: [240, 225, 180], water: [60, 120, 200], path: [200, 195, 185]};
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i, WORLD = /\.(pgw|jgw|tfw|wld|j2w|bpw|gfw)$/i;

export function open() {
 setTitle('Real life course');
 const st = {sources: [], files: [], box: null, preview: null, land: null, gridder: null, trees: [], picture: null, holes: [], hole: 0, holesN: 18, mark: 'back', traced: null, mode: 'both', overlay: true, showPicture: true, landscape: 'midwest', name: 'My real course', credits: '', align: null};
 window.fairwayBuilder.door2 = st;
 const plan = el('canvas', {class: 'cb-plan', width: 900, height: 900, style: 'width:100%;max-width:900px;border:1px solid var(--line);background:#0b1f1c;cursor:crosshair;touch-action:none'});
 const notes = el('div', {class: 'cb-note', style: 'text-align:left'});
 const say = (t, err = false) => { notes.textContent = t; notes.classList.toggle('cb-err', err); };
 const steps = el('div', {style: 'display:flex;flex-direction:column;gap:12px;max-width:430px'});
 show(el('section', {class: 'cb-sheet'}, el('h2', {}, 'Generate a real life course'),
  el('div', {style: 'display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap'}, steps, el('div', {style: 'flex:1;min-width:420px'}, plan, notes))));
 topTools(el('button', {class: 'cb-btn', type: 'button', onclick: home}, 'Back'));

 // ---- the plan: local metres onto the canvas.
 const ctx = plan.getContext('2d');
 const view = () => {
  if (st.land) return {halfX: st.land.halfX, halfZ: st.land.halfZ};
  if (st.preview) return {halfX: st.preview.land.halfX, halfZ: st.preview.land.halfZ};
  return null;
 };
 const toCanvas = (x, z) => { const v = view(), s = Math.min(plan.width / (2 * v.halfX), plan.height / (2 * v.halfZ)); return [plan.width / 2 + x * s, plan.height / 2 + z * s]; };
 const fromCanvas = (cx, cy) => { const v = view(), s = Math.min(plan.width / (2 * v.halfX), plan.height / (2 * v.halfZ)); return {x: (cx - plan.width / 2) / s, z: (cy - plan.height / 2) / s}; };
 st.toCanvas = toCanvas;
 // A land as shaded relief, its picture and its trace under the marks.
 function draw() {
  ctx.fillStyle = '#0b1f1c'; ctx.fillRect(0, 0, plan.width, plan.height);
  const L = st.land || st.preview?.land; if (!L) return;
  const img = ctx.createImageData(plan.width, plan.height), {nx, nz, cell, ground} = L;
  for (let py = 0; py < plan.height; py++) for (let px = 0; px < plan.width; px++) {
   const {x, z} = fromCanvas(px + .5, py + .5), i = Math.round((x + L.halfX) / cell), j = Math.round((z + L.halfZ) / cell);
   if (i < 1 || j < 1 || i >= nx - 1 || j >= nz - 1) continue;
   const k = j * nx + i, dx = (ground[k + 1] - ground[k - 1]) / (2 * cell), dz = (ground[k + nx] - ground[k - nx]) / (2 * cell);
   let shade = Math.max(0, Math.min(1, .62 - (dx * .7 + dz * -.7) * 1.8)), c = [shade * 230, shade * 235, shade * 225];
   if (st.picture && st.showPicture && st.picture.has[k]) c = [st.picture.rgb[k * 3] * (.6 + shade * .5), st.picture.rgb[k * 3 + 1] * (.6 + shade * .5), st.picture.rgb[k * 3 + 2] * (.6 + shade * .5)];
   if (st.traced && st.overlay) { const t = TRACE_COLOUR[TRACE[st.traced.codes[k]]]; if (t) c = c.map((v, q) => v * .35 + t[q] * .65); }
   if (L.canopy[k] > 2 && !(st.picture && st.showPicture)) c = c.map((v, q) => v * .5 + [30, 90, 40][q] * .5);
   const o = (py * plan.width + px) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // The property box (on the preview), the holes' marks and lines.
  if (st.preview && !st.land && st.box) {
   const g = st.preview.gridder, a = g.local(st.box.x0, st.box.y1), b = g.local(st.box.x1, st.box.y0), [ax, ay] = toCanvas(a.x, a.z), [bx, by] = toCanvas(b.x, b.z);
   ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.strokeRect(ax, ay, bx - ax, by - ay);
  }
  ctx.font = 'bold 13px system-ui';
  st.holes.forEach((h, n) => {
   if (!h) return;
   const on = n === st.hole;
   if (h.green && h.tees.length) { ctx.strokeStyle = on ? '#fde68a' : 'rgba(255,255,255,.7)'; ctx.lineWidth = on ? 2 : 1; ctx.beginPath(); ctx.moveTo(...toCanvas(h.tees[0].x, h.tees[0].z)); ctx.lineTo(...toCanvas(h.green.x, h.green.z)); ctx.stroke(); }
   for (const t of h.tees) { const [x, y] = toCanvas(t.x, t.z); ctx.fillStyle = {back: '#4385d5', middle: '#f4f2e7', front: '#d75c52'}[t.set]; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
   if (h.green) { const [x, y] = toCanvas(h.green.x, h.green.z); ctx.fillStyle = on ? '#fde68a' : '#d4443a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(String(n + 1), x + 8, y - 6); }
  });
  if (st.align?.pairs) for (const p of st.align.pairs) { const [x, y] = toCanvas(p.local.x, p.local.z); ctx.strokeStyle = '#ff6bd6'; ctx.strokeRect(x - 5, y - 5, 10, 10); }
 }

 // ---- 1. the land's files.
 const fileList = el('ul');
 const step1 = el('div', {class: 'cb-field'}, el('label', {}, '1. Bring the land'),
  el('small', {}, 'LIDAR of the place: LAS, LAZ, COPC, E57, PLY, PTS, PTX, XYZ/TXT/CSV point files, or height grids (GeoTIFF, ASCII grid, float grid with its .hdr, BIL, SRTM HGT). Several tiles at once; a .prj or .hdr beside a file is read with it.'),
  el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: chooseLand}, 'Choose LIDAR files'), fileList);
 async function chooseLand() {
  const files = await pickFile('', true); if (!files.length) return;
  setBusy('Reading the files…');
  try {
   const side = new Map(files.filter(f => /\.(prj|hdr)$/i.test(f.name)).map(f => [f.name.replace(/\.[^.]+$/, '').toLowerCase() + f.name.slice(-4).toLowerCase(), f]));
   let laz = null;
   for (const f of files) {
    if (/\.(prj|hdr)$/i.test(f.name)) continue;
    const head = new Uint8Array(await f.slice(0, 64).arrayBuffer()), form = formOf(f.name, head), base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    try {
     if (form === 'laz' && !laz) laz = await (await import('../lidar/laz.js')).lazModule();
     const bytes = new Uint8Array(await f.arrayBuffer());
     const prj = side.get(base + '.prj') ? await side.get(base + '.prj').text() : null, hdr = side.get(base + '.hdr') ? await side.get(base + '.hdr').text() : null;
     const src = {...(await openSource(f.name, bytes, {lazModule: laz, sidecar: hdr, prj})), name: f.name, surface: /dsm|surface/i.test(f.name)};
     st.sources.push(src);
     const crs = src.kind === 'points' ? src.crs : src.raster.crs;
     fileList.append(el('li', {}, `${f.name}: ${src.form.toUpperCase()}, ${src.kind === 'points' ? src.count.toLocaleString() + ' points' : `${src.raster.width} x ${src.raster.height} heights`}, ${crs.epsg ? 'EPSG ' + crs.epsg : 'no map grid stated'}, ${crs.units.h === 'metre' && crs.units.v === 'metre' ? 'metres' : `${crs.units.h} across, ${crs.units.v} up (converted to metres)`}`));
    } catch (e) { fileList.append(el('li', {class: 'cb-err'}, `${f.name}: ${e.message}`)); }
   }
   if (st.sources.length) await previewLand();
  } finally { setBusy(''); }
 }
 // ---- 2. the property, dragged on a quick relief of everything brought.
 async function previewLand() {
  const box = sourcesBox(st.sources), unit = toMetres(crsOfSources(st.sources));
  const w = (box.x1 - box.x0) * unit.h, h = (box.y1 - box.y0) * unit.h, cell = Math.max(2, Math.sqrt(w * h / 6e5));
  const g = createGridder({box, cell, unit});
  const total = st.sources.reduce((s, x) => s + (x.count || 0), 0), every = Math.max(1, Math.floor(total / 4e6));
  for (const s of st.sources) {
   if (s.kind === 'points') await s.each(p => g.add(p), {every, pause: frame, onProgress: f => setBusy(`A first look at the land… ${Math.round(f * 100)}%`)});
   else g.addRaster(s.raster, {rasterUnit: toMetres(s.raster.crs)});
  }
  st.preview = {land: g.finish(), gridder: g};
  // The property: the whole of it, or the middle 3 km of it.
  const cap = MAX_PROPERTY / unit.h, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  st.box = {x0: Math.max(box.x0, cx - cap / 2), x1: Math.min(box.x1, cx + cap / 2), y0: Math.max(box.y0, cy - cap / 2), y1: Math.min(box.y1, cy + cap / 2)};
  draw(); boxInfo();
  say('Drag a box on the relief round the course (it is the property; 150 m past it are built too, for the land beyond). Then build the land.');
 }
 const boxText = el('small');
 const boxInfo = () => { const u = toMetres(crsOfSources(st.sources)); boxText.textContent = st.box ? `The property: ${((st.box.x1 - st.box.x0) * u.h).toFixed(0)} x ${((st.box.y1 - st.box.y0) * u.h).toFixed(0)} m.` : ''; };
 const step2 = el('div', {class: 'cb-field'}, el('label', {}, '2. The property'), boxText, el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: buildLand}, 'Build the land'));
 let drag = null;
 plan.addEventListener('pointerdown', e => {
  const b = plan.getBoundingClientRect(), cx = (e.clientX - b.left) * plan.width / b.width, cy = (e.clientY - b.top) * plan.height / b.height;
  if (!view()) return;
  const p = fromCanvas(cx, cy);
  if (!st.land && st.preview) { drag = p; plan.setPointerCapture(e.pointerId); return; }
  if (st.align?.waiting === 'land') { st.align.local = p; st.align.waiting = 'picture'; say('Now click the same point on the picture below.'); return; }
  if (st.land) markAt(p);
 });
 plan.addEventListener('pointermove', e => {
  if (!drag) return;
  const b = plan.getBoundingClientRect(), p = fromCanvas((e.clientX - b.left) * plan.width / b.width, (e.clientY - b.top) * plan.height / b.height), g = st.preview.gridder;
  const m0 = g.map(Math.min(drag.x, p.x), Math.min(drag.z, p.z)), m1 = g.map(Math.max(drag.x, p.x), Math.max(drag.z, p.z)), u = toMetres(crsOfSources(st.sources)), cap = MAX_PROPERTY / u.h;
  st.box = {x0: m0.x, x1: Math.min(m1.x, m0.x + cap), y0: Math.max(m1.y, m0.y - cap), y1: m0.y};
  draw(); boxInfo();
 });
 plan.addEventListener('pointerup', () => { drag = null; });
 // ---- 3. the land.
 async function buildLand() {
  if (!st.box) return say('Bring the land first.', true);
  setBusy('Building the land…');
  try {
   const r = await landFromSources(st.sources, st.box, {pause: frame, onStep: (what, f) => setBusy(`Building the land… ${what} ${Math.round(f * 100)}%`)});
   Object.assign(st, r);
   // The LIDAR's own colour or brightness is the first picture: lined up by
   // construction.
   const N = r.land.nx * r.land.nz, rgb = new Uint8Array(N * 3), has = new Uint8Array(N);
   for (let k = 0; k < N; k++) { if (r.land.rgb) { rgb.set(r.land.rgb.subarray(k * 3, k * 3 + 3), k * 3); has[k] = r.land.rgb[k * 3] || r.land.rgb[k * 3 + 1] ? 1 : 0; } else if (Number.isFinite(r.land.intensity[k])) { const v = Math.round(r.land.intensity[k] * 255); rgb[k * 3] = rgb[k * 3 + 1] = rgb[k * 3 + 2] = v; has[k] = 1; } }
   // A colourised survey's colour is a picture the trace can use; its laser
   // brightness is not (the trace reads that from the land already).
   st.lidarPicture = {rgb, nir: null, has, fromLidar: true, colour: !!r.land.rgb};
   say(`The land: ${(2 * r.land.halfX).toFixed(0)} x ${(2 * r.land.halfZ).toFixed(0)} m at ${r.land.cell} m, ground ${r.land.method === 'classified' ? 'from the survey\'s own classes' : 'found by a ground filter (the survey had no classes)'}, ${(100 * r.land.filled.reduce((s, v) => s + v, 0) / r.land.filled.length).toFixed(1)}% filled where no ground return came back, ${r.trees.length.toLocaleString()} trees found. Add a picture, or mark the holes on the relief.`);
   draw();
  } catch (e) { say('Could not build the land: ' + e.message, true); }
  finally { setBusy(''); }
 }
 // ---- 4. a picture.
 const picCanvas = el('canvas', {width: 420, height: 420, style: 'width:100%;border:1px solid var(--line);display:none;cursor:crosshair'});
 const step4 = el('div', {class: 'cb-field'}, el('label', {}, '3. A picture (optional)'),
  el('small', {}, 'An aerial picture to trace over: a GeoTIFF orthophoto, or a PNG, JPEG or WebP with its world file (.pgw, .jgw, .wld...) and .prj. Lined up by its own position where it has one; otherwise click three or more matching points. Google, Bing and Esri imagery may forbid tracing into other products -- read their terms; NAIP (US) is public domain. The picture is never saved in the course.'),
  el('div', {class: 'cb-row'}, el('button', {class: 'cb-btn', type: 'button', onclick: choosePicture}, 'Choose a picture'),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.picture = st.lidarPicture; draw(); say(st.land?.rgb ? 'Using the LIDAR\'s own colour.' : 'Using the laser\'s brightness: sand and paths bright, water dark.'); }}, 'Use the LIDAR\'s own'),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.showPicture = !st.showPicture; draw(); }}, 'Picture on/off')), picCanvas);
 let pendingPic = null;
 async function choosePicture() {
  if (!st.land) return say('Build the land first.', true);
  const files = await pickFile('', true), main = files.find(f => /\.(tiff?|png|jpe?g|webp|gif|bmp)$/i.test(f.name)); if (!main) return;
  setBusy('Laying the picture on the land…');
  try {
   const base = main.name.replace(/\.[^.]+$/, '').toLowerCase(), world = files.find(f => WORLD.test(f.name) && f.name.toLowerCase().startsWith(base)), prj = files.find(f => /\.prj$/i.test(f.name) && f.name.toLowerCase().startsWith(base));
   const landCrs = crsOfSources(st.sources);
   let pic;
   if (IMAGE.test(main.name)) {
    const bmp = await createImageBitmap(main), c = new OffscreenCanvas(bmp.width, bmp.height), cx = c.getContext('2d'); cx.drawImage(bmp, 0, 0);
    const d = cx.getImageData(0, 0, bmp.width, bmp.height).data, rgb = new Uint8Array(bmp.width * bmp.height * 3);
    for (let k = 0; k < bmp.width * bmp.height; k++) { rgb[k * 3] = d[k * 4]; rgb[k * 3 + 1] = d[k * 4 + 1]; rgb[k * 3 + 2] = d[k * 4 + 2]; }
    pic = {width: bmp.width, height: bmp.height, rgb, nir: null};
    if (world) { const [A, , , E, C, F] = (await world.text()).trim().split(/\s+/).map(Number); Object.assign(pic, {dx: A, dy: E, x0: C, y0: F, crs: prj ? crsOf({wkt: await prj.text()}) : landCrs}); }
   } else {
    const bytes = new Uint8Array(await main.arrayBuffer()), head = await readGeoTiffRgb(bytes, {box: {x0: 0, x1: 1, y0: 0, y1: 1}}).catch(() => null);
    const conv = head ? converter(landCrs, head.crs.epsg ? head.crs : landCrs) : null;
    if (conv) { const c0 = conv(...Object.values(st.gridder.map(-st.land.halfX, st.land.halfZ))), c1 = conv(...Object.values(st.gridder.map(st.land.halfX, -st.land.halfZ)));
     pic = await readGeoTiffRgb(bytes, {box: {x0: Math.min(c0.x, c1.x), x1: Math.max(c0.x, c1.x), y0: Math.min(c0.y, c1.y), y1: Math.max(c0.y, c1.y)}}); }
    else pic = await readGeoTiffRgb(bytes);
    if (!pic.rgb) throw Error('This GeoTIFF has no colour bands: it is a height grid, which goes with the LIDAR files.');
   }
   const conv = pic.x0 != null ? converter(landCrs, pic.crs ?? landCrs) : null;
   if (conv) {
    st.picture = pictureOnLand(st.land, st.gridder, pic, {toPicture: conv, into: st.picture && !st.picture.fromLidar ? st.picture : null});
    say(`The picture is lined up by its own position: it covers ${(100 * st.picture.has.reduce((s, v) => s + v, 0) / st.picture.has.length).toFixed(0)}% of the land. Add another tile to fill the rest, or mark the holes.`);
   } else {
    // Matched by hand: a point on the relief, then the same on the picture.
    pendingPic = pic; st.align = {pairs: [], waiting: 'land'};
    picCanvas.style.display = ''; picCanvas.width = 420; picCanvas.height = Math.round(420 * pic.height / pic.width);
    const pc = picCanvas.getContext('2d'), id = pc.createImageData(picCanvas.width, picCanvas.height);
    for (let y = 0; y < picCanvas.height; y++) for (let x = 0; x < picCanvas.width; x++) { const s = Math.floor(y * pic.height / picCanvas.height) * pic.width + Math.floor(x * pic.width / picCanvas.width), o = (y * picCanvas.width + x) * 4; id.data[o] = pic.rgb[s * 3]; id.data[o + 1] = pic.rgb[s * 3 + 1]; id.data[o + 2] = pic.rgb[s * 3 + 2]; id.data[o + 3] = 255; }
    pc.putImageData(id, 0, 0);
    say('This picture says nothing of where it is. Click a point on the relief (a green\'s back, a bunker\'s corner), then the same point on the picture; three or more pairs, spread out.');
   }
   draw();
  } catch (e) { say('Could not use that picture: ' + e.message, true); }
  finally { setBusy(''); }
 }
 picCanvas.addEventListener('click', e => {
  if (st.align?.waiting !== 'picture' || !pendingPic) return;
  const b = picCanvas.getBoundingClientRect(), col = (e.clientX - b.left) / b.width * pendingPic.width, row = (e.clientY - b.top) / b.height * pendingPic.height;
  st.align.pairs.push({local: st.align.local, pixel: {col, row}}); st.align.waiting = 'land';
  if (st.align.pairs.length >= 3) {
   try { const fit = affineFromPairs(st.align.pairs); st.picture = pictureOnLand(st.land, st.gridder, pendingPic, {affine: fit.map}); say(`Lined up from ${st.align.pairs.length} points: the worst is ${fit.worst.toFixed(1)} m off. Add points to improve it, or carry on.`); draw(); }
   catch (e) { say(e.message, true); }
  } else say(`${st.align.pairs.length} of 3: click the next point on the relief.`);
 });
 // ---- 5. the holes.
 const holeList = el('ul'), holesN = el('select', {onchange: e => { st.holesN = +e.target.value; refresh(); }}, [18, 9].map(n => el('option', {value: n}, `${n} holes`)));
 const markBtns = ['back', 'middle', 'front', 'green'].map(m => el('button', {class: 'cb-btn', type: 'button', 'data-mark': m, onclick: () => { st.mark = m; refresh(); }}, m === 'green' ? 'Green' : `${m[0].toUpperCase() + m.slice(1)} tee`));
 const step5 = el('div', {class: 'cb-field'}, el('label', {}, '4. Mark the holes'),
  el('small', {}, 'For each hole in turn: its tees (the back tee at least) and its green, clicked on the plan. Then Next hole.'), holesN,
  el('div', {class: 'cb-row'}, ...markBtns, el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => { st.hole = Math.min(st.holesN - 1, st.hole + 1); st.mark = 'back'; refresh(); }}, 'Next hole')), holeList);
 function markAt(p) {
  const h = st.holes[st.hole] ??= {tees: [], green: null};
  if (st.mark === 'green') { h.green = p; st.mark = 'back'; }
  else { h.tees = h.tees.filter(t => t.set !== st.mark); h.tees.push({...p, set: st.mark}); h.tees.sort((a, b) => ['back', 'middle', 'front'].indexOf(a.set) - ['back', 'middle', 'front'].indexOf(b.set)); st.mark = st.mark === 'back' ? 'green' : st.mark; }
  st.traced = null; refresh();
 }
 function refresh() {
  for (const b of markBtns) b.classList.toggle('cb-on', b.dataset.mark === st.mark);
  holeList.replaceChildren(...Array.from({length: st.holesN}, (_, n) => { const h = st.holes[n]; return el('li', {style: n === st.hole ? 'color:var(--hot)' : '', onclick: () => { st.hole = n; refresh(); }}, `Hole ${n + 1}: ${h?.tees.length ? h.tees.length + ' tee' + (h.tees.length > 1 ? 's' : '') : 'no tee'}, ${h?.green ? 'green marked' : 'no green'}`); }));
  draw();
 }
 // ---- 6. the trace.
 const step6 = el('div', {class: 'cb-field'}, el('label', {}, '5. Trace the course (optional)'),
  el('small', {}, 'A starting point the editor lets you correct: the greens and tees round your marks, the fairways along the holes, the sand, the water. From the LIDAR first, the picture where the LIDAR cannot tell.'),
  el('div', {class: 'cb-row'}, ...[['both', 'LIDAR first'], ['lidar', 'LIDAR alone'], ['picture', 'Picture alone']].map(([m, t]) => el('button', {class: 'cb-btn', type: 'button', onclick: () => runTrace(m)}, t)),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.overlay = !st.overlay; draw(); }}, 'Trace on/off')));
 const marked = () => st.holes.slice(0, st.holesN).filter(h => h?.green && h.tees.length);
 async function runTrace(mode) {
  if (!st.land) return say('Build the land first.', true);
  if (!marked().length) return say('Mark at least one hole first.', true);
  setBusy('Tracing…'); await frame();
  try {
   st.mode = mode; st.traced = trace(st.land, {picture: st.picture && (!st.picture.fromLidar || st.picture.colour) ? st.picture : null, holes: marked(), mode});
   const n = st.traced.codes.length, src = [0, 0, 0, 0]; for (let k = 0; k < n; k++) if (st.traced.codes[k]) src[st.traced.source[k]]++;
   const all = src.reduce((a, b) => a + b, 0) || 1;
   say(`Traced: of the ground given a surface, ${Math.round(100 * (src[SOURCE.lidar] + src[SOURCE.both]) / all)}% decided by the LIDAR, ${Math.round(100 * src[SOURCE.picture] / all)}% by the picture.`);
   draw();
  } finally { setBusy(''); }
 }
 // ---- 7. the landscape, the name, and on to the editor.
 const step7 = el('div', {class: 'cb-field'}, el('label', {}, '6. The landscape and the name'),
  el('select', {onchange: e => { st.landscape = e.target.value; }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === st.landscape}, BIOMES[k].name))),
  el('input', {value: st.name, maxlength: 60, oninput: e => { st.name = e.target.value; }}),
  el('input', {placeholder: 'Credit for the data (e.g. USGS 3D Elevation Program)', oninput: e => { st.credits = e.target.value; }}),
  el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: toEditor}, 'Open in the editor'));
 async function toEditor() {
  const holes = st.holes.slice(0, st.holesN).map((h, n) => h?.green && h.tees.length ? {number: n + 1, tees: h.tees, green: h.green} : null);
  if (holes.some(h => !h)) return say(`Every hole needs a tee and a green: ${holes.map((h, n) => h ? null : n + 1).filter(Boolean).join(', ')} not marked.`, true);
  setBusy('Making the course…'); await frame();
  try {
   const doc = validateDoc(docFromLand({land: st.land, traced: st.traced, holes, trees: st.trees, name: st.name.trim() || 'My real course', landscape: st.landscape,
    credits: st.credits.trim() ? [st.credits.trim()] : [], source: {files: st.sources.map(s => s.name), epsg: crsOfSources(st.sources)?.epsg ?? null, trace: st.traced ? st.mode : 'none'}}));
   openEditor(doc, {from: 'real'});
  } catch (e) { say('Could not make the course: ' + e.message, true); }
  finally { setBusy(''); }
 }
 steps.append(step1, step2, step4, step5, step6, step7);
 refresh();
 say('Start with the LIDAR files.');
}
