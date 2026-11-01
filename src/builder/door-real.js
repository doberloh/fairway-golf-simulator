// DOOR 2, "GENERATE A REAL LIFE COURSE" (the course builder, stage 7, in the
// order the owner set after testing it, 31 October 2026; docs/COURSE_BUILDER.md
// *The amended goal*):
//
//   1 Load the LIDAR     the files, and the property dragged round the course
//   2 Build the land     the ground, the canopy and the trees
//   3 Trace              a picture to trace over (a file, the survey's own
//                        colour, or imagery fetched from a provider and sized
//                        onto the land by itself, dragged into line by hand);
//                        then the AUTO trace or a MANUAL one, and the same tools
//                        to correct either: brushes, outlines, smoothing, tree
//                        zones, single trees, water, every ground type
//   4 Holes              each hole's tees, aim points and green
//   5 Name               the course, its landscape, the credits
//   6 Review             the whole course painted as it will be built --
//                        its surfaces in the landscape's colours, trees,
//                        holes, the card and the checks -- then the editor
//                        (the owner: "the user should be able to see the
//                        entire painted course before they load in the editor")
//
// Every step works on one plan of the land (plan-view.js) that zooms with the
// wheel and drags with the right button, Space or the Move tool. The steps'
// work is in pure modules beside this one: real-course.js (land, picture,
// course), trace-edit.js (the trace being drawn), imagery.js (fetched
// pictures), lidar/trace.js (the auto trace).
import {show, setTitle, setBusy, topTools, home, pickFile, ui} from './builder.js';
import {openSource, formOf} from '../lidar/formats.js';
import {readGeoTiffRgb} from '../lidar/geotiff.js';
import {converter} from '../lidar/geo.js';
import {crsOf, toMetres} from '../lidar/las.js';
import {createGridder} from '../lidar/land.js';
import {trace} from '../lidar/trace.js';
import {sourcesBox, crsOfSources, landFromSources, pictureOnLand, affineFromPairs, docFromLand, MAX_PROPERTY} from './real-course.js';
import {createTrace, PALETTE} from './trace-edit.js';
import {LAYER_ORDER} from './layers.js';
import {PROVIDERS, providersAt, mosaic} from './imagery.js';
import {createPlanView} from './plan-view.js';
import {validateDoc} from '../course-doc.js';
import {BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {GROUNDS} from '../grounds.js';
import {openEditor} from './editor.js';
import {worldFromDoc} from '../built-world.js';
import {createEditor} from './editing.js';
import {checkCourse} from './checks.js';

const {el} = ui;
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const hex = h => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const OWN = {fairway: [70, 170, 60], semi: [150, 200, 100], tee: [120, 220, 150], green: [150, 245, 150], sand: [245, 228, 175], water: [60, 120, 220], path: [210, 205, 195]};
const COLOUR = Object.fromEntries(PALETTE.map(k => [k, k === 'rough' ? null : OWN[k] ?? hex(GROUNDS[k]?.map ?? '#888888')]));
const LABEL = k => ({rough: 'Rough', fairway: 'Fairway', semi: 'Semi-rough', tee: 'Tee', green: 'Green', sand: 'Sand', water: 'Water', path: 'Cart path'})[k] ?? GROUNDS[k]?.label ?? k;
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i, WORLD = /\.(pgw|jgw|tfw|wld|j2w|bpw|gfw)$/i;
const STEPS = ['1 LIDAR', '2 Land', '3 Trace', '4 Holes', '5 Name', '6 Review'];
const KEYS = 'fairway-builder-imagery-keys';
const BRUSHES = ['brush', 'erase', 'eraseAll', 'smooth', 'treeErase'];

export function open() {
 setTitle('Real life course');
 const st = {step: 0, sources: [], preview: null, box: null, land: null, gridder: null, trees: [], pics: [], offset: {x: 0, z: 0}, picture: null, geo: null,
  model: null, traceMode: null, tool: 'move', kind: 'fairway', size: 4, outline: [], hover: null, holes: [], hole: 0, holesN: 18, mark: 'back',
  name: 'My real course', landscape: 'midwest', credits: [], align: null};
 window.fairwayBuilder.door2 = st;
 const canvas = el('canvas', {class: 'cb-plan'});
 const notes = el('div', {class: 'cb-note', style: 'text-align:left;padding:6px 10px;max-width:none'});
 const say = (t, err = false) => { notes.textContent = t; notes.classList.toggle('cb-err', err); };
 const zoomText = el('span');
 const plan = createPlanView(canvas, {onTool, overlay});
 st.plan = plan;
 st.toCanvas = (x, z) => plan.toScreen(x, z);
 const panel = el('div', {style: 'display:flex;flex-direction:column;gap:10px'}), nav = el('div', {class: 'cb-stepnav'});
 show(el('section', {class: 'cb-door2'},
  el('div', {class: 'cb-steps'}, el('h2', {style: 'font:800 22px/1 var(--head);text-transform:uppercase;margin:0'}, 'A real life course'), nav, panel),
  el('div', {class: 'cb-planbox'}, canvas,
   el('div', {class: 'cb-planbar'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.zoomBy(1.5)}, 'Zoom in'), el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.zoomBy(1 / 1.5)}, 'Zoom out'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.fit()}, 'Whole land'), el('span', {}, 'Wheel zooms; right-drag, Space-drag or Move drags the view.'), zoomText),
   notes)));
 topTools(el('button', {class: 'cb-btn', type: 'button', onclick: home}, 'Back'));
 const L = () => st.land ?? st.preview?.land;

 // ---------------------------------------------------------------- layers
 function paintRelief() {
  const land = L(); if (!land) return;
  plan.setLand(land);
  const g = land.ground, N = land.nx * land.nz, nx = land.nx;
  plan.setLayer('relief', d => {
   for (let k = 0; k < N; k++) {
    const a = g[Math.min(N - 1, k + 1)] - g[Math.max(0, k - 1)], b = g[Math.min(N - 1, k + nx)] - g[Math.max(0, k - nx)];
    const s = Math.max(.15, Math.min(1, .62 - (a * .7 - b * .7) / (2 * land.cell) * 1.8));
    let c = [s * 230, s * 235, s * 225];
    if (land.canopy?.[k] > 2) c = c.map((v, q) => v * .5 + [30, 90, 40][q] * .5);
    d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = 255;
   }
  });
  paintPicture(); paintCodes();
 }
 function paintPicture() {
  if (!st.land || !st.picture) { plan.clearLayer('picture'); return; }
  const p = st.picture;
  plan.setLayer('picture', (d, nx, nz) => { for (let k = 0; k < nx * nz; k++) if (p.has[k]) { d[k * 4] = p.rgb[k * 3]; d[k * 4 + 1] = p.rgb[k * 3 + 1]; d[k * 4 + 2] = p.rgb[k * 3 + 2]; d[k * 4 + 3] = 255; } });
  plan.shiftLayer('picture', 0, 0);
 }
 const codeTexel = (d, o, c) => { const col = COLOUR[PALETTE[c]]; if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 120; } else d[o + 3] = 0; };
 function paintCodes() {
  if (!st.land || !st.model) { plan.clearLayer('codes'); return; }
  const c = st.model.state.layers.view;
  plan.setLayer('codes', (d, nx, nz) => { for (let k = 0; k < nx * nz; k++) codeTexel(d, k * 4, c[k]); });
 }
 function patchCodes(x, z, r) {
  const {cell, halfX, halfZ, nx} = st.land, c = st.model.state.layers.view, w = 2 * r / cell + 4;
  plan.patchLayer('codes', (x - r + halfX) / cell - 2, (z - r + halfZ) / cell - 2, w, w, (d, a, b, W, H) => { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) codeTexel(d, (j * W + i) * 4, c[(b + j) * nx + a + i]); });
 }

 // --------------------------------------------------------------- overlay
 function overlay(ctx, p) {
  const px = p.px; if (!L()) return;
  zoomText.textContent = `${(px / p.view.scale).toFixed(2)} m a screen pixel`;
  if (st.step === 0 && st.box && st.preview) {
   const g = st.preview.gridder, a = g.local(st.box.x0, st.box.y1), b = g.local(st.box.x1, st.box.y0), [ax, ay] = p.toScreen(a.x, a.z), [bx, by] = p.toScreen(b.x, b.z);
   ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2 * px; ctx.strokeRect(ax, ay, bx - ax, by - ay);
  }
  // Trees: their crowns when near enough to see, dots when not.
  const trees = st.model?.state.trees ?? st.trees;
  if (st.land && trees.length) {
   ctx.strokeStyle = 'rgba(20,70,30,.9)'; ctx.fillStyle = 'rgba(40,110,50,.45)'; ctx.lineWidth = px;
   for (const t of trees) { const [x, y] = p.toScreen(t.x, t.z), r = Math.max(1.5 * px, t.crown * p.view.scale); if (x < -r || y < -r || x > ctx.canvas.width + r || y > ctx.canvas.height + r) continue; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); if (r > 3 * px) ctx.stroke(); }
  }
  if (st.step >= 3) st.holes.slice(0, st.holesN).forEach((h, n) => {
   if (!h) return;
   const on = n === st.hole, line = holeLine(h);
   if (line.length >= 2) { ctx.strokeStyle = on ? '#fde68a' : 'rgba(255,255,255,.75)'; ctx.lineWidth = (on ? 2 : 1.2) * px; ctx.beginPath(); line.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); q ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); }
   for (const t of h.tees) { const [x, y] = p.toScreen(t.x, t.z); ctx.fillStyle = {back: '#4385d5', middle: '#f4f2e7', front: '#d75c52'}[t.set]; ctx.beginPath(); ctx.arc(x, y, 5 * px, 0, 7); ctx.fill(); }
   for (const a of h.aims) { const [x, y] = p.toScreen(a.x, a.z); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(x, y, 6 * px, 0, 7); ctx.moveTo(x - 9 * px, y); ctx.lineTo(x + 9 * px, y); ctx.moveTo(x, y - 9 * px); ctx.lineTo(x, y + 9 * px); ctx.stroke(); }
   if (h.green) { const [x, y] = p.toScreen(h.green.x, h.green.z); ctx.fillStyle = on ? '#fde68a' : '#d4443a'; ctx.beginPath(); ctx.arc(x, y, 6 * px, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * px}px system-ui`; ctx.fillText(String(n + 1), x + 8 * px, y - 6 * px); }
  });
  if (st.outline.length) { ctx.strokeStyle = '#ff6bd6'; ctx.lineWidth = 2 * px; ctx.beginPath(); st.outline.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); q ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); if (st.hover) ctx.lineTo(...p.toScreen(st.hover.x, st.hover.z)); ctx.stroke(); }
  if (st.hover && st.step === 2 && BRUSHES.includes(st.tool)) { const [x, y] = p.toScreen(st.hover.x, st.hover.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = px; ctx.beginPath(); ctx.arc(x, y, st.size * p.view.scale, 0, 7); ctx.stroke(); }
  if (st.align?.pairs) for (const q of st.align.pairs) { const [x, y] = p.toScreen(q.local.x, q.local.z); ctx.strokeStyle = '#ff6bd6'; ctx.strokeRect(x - 5 * px, y - 5 * px, 10 * px, 10 * px); }
 }
 const holeLine = h => { const back = h.tees.find(t => t.set === 'back') ?? h.tees[0]; return [...(back ? [[back.x, back.z]] : []), ...h.aims.map(a => [a.x, a.z]), ...(h.green ? [[h.green.x, h.green.z]] : [])]; };

 // ----------------------------------------------------------------- tools
 let dragFrom = null;
 function onTool(type, p) {
  st.hover = p;
  const t = st.tool;
  if (st.step === 0 && st.preview) {
   if (type === 'down') dragFrom = p;
   if ((type === 'drag' || type === 'up') && dragFrom) {
    const g = st.preview.gridder, u = toMetres(crsOfSources(st.sources)).h, cap = MAX_PROPERTY / u;
    const m0 = g.map(Math.min(dragFrom.x, p.x), Math.min(dragFrom.z, p.z)), m1 = g.map(Math.max(dragFrom.x, p.x), Math.max(dragFrom.z, p.z));
    st.box = {x0: m0.x, x1: Math.min(m1.x, m0.x + cap), y0: Math.max(m1.y, m0.y - cap), y1: m0.y}; boxInfo();
    if (type === 'up') dragFrom = null;
   }
   plan.draw(); return;
  }
  if (st.step === 2 && st.land) {
   if (t === 'align') {
    if (type === 'down') dragFrom = {...p, ox: st.offset.x, oz: st.offset.z};
    if (type === 'drag' && dragFrom) plan.shiftLayer('picture', p.x - dragFrom.x, p.z - dragFrom.z);
    if (type === 'up' && dragFrom) { st.offset = {x: dragFrom.ox + p.x - dragFrom.x, z: dragFrom.oz + p.z - dragFrom.z}; dragFrom = null; relay(); say(`The picture is ${Math.hypot(st.offset.x, st.offset.z).toFixed(1)} m from where its position put it.`); }
    return;
   }
   if (st.align?.waiting === 'land' && type === 'down') { st.align.local = p; st.align.waiting = 'picture'; say('Now click the same point on the picture in the left panel.'); plan.draw(); return; }
   const m = st.model;
   if (!m) { plan.draw(); return; }
   if (BRUSHES.includes(t)) {
    if (type === 'down') m.beginStroke();
    if (type === 'down' || type === 'drag') {
     if (t === 'brush') m.paint({x: p.x, z: p.z, radius: st.size, kind: st.kind});
     else if (t === 'erase') m.erase({x: p.x, z: p.z, radius: st.size, kind: st.kind === 'rough' ? null : st.kind});
     else if (t === 'eraseAll') m.erase({x: p.x, z: p.z, radius: st.size});
     else if (t === 'smooth') m.smooth({x: p.x, z: p.z, radius: Math.max(1, st.size / 3), area: st.size});
     else m.removeTrees({x: p.x, z: p.z, radius: st.size});
     if (t !== 'treeErase') patchCodes(p.x, p.z, st.size + 2);
    }
    if (type === 'up') { m.endStroke(); refreshCount(); }
    plan.draw(); return;
   }
   if (t === 'outline' || t === 'treeZone') {
    if (type === 'down') st.outline.push([p.x, p.z]);
    if (type === 'double' && st.outline.length >= 3) closeOutline();
    plan.draw(); return;
   }
   if (t === 'tree' && type === 'down') {
    const here = m.kindAt(p.x, p.z);
    if (['fairway', 'green', 'tee', 'water', 'sand', 'path'].includes(here)) say(`A tree cannot stand on ${LABEL(here).toLowerCase()}.`, true);
    else { m.addTree({x: p.x, z: p.z, h: st.treeH, crown: st.treeH * .28}); refreshCount(); }
    plan.draw(); return;
   }
  }
  if (st.step === 3 && st.land && type === 'down') { markAt(p); return; }
  plan.draw();
 }
 st.treeH = 15; st.density = 120;
 function closeOutline() {
  // A double-click adds its own two clicks as corners; they are one point.
  const ring = st.outline.filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > .05); st.outline = [];
  if (ring.length < 3) return;
  if (st.tool === 'treeZone') { st.model.treeZone(ring, {density: st.density, seed: st.model.state.undo.length + 1}); say(`Trees: ${st.model.state.trees.length.toLocaleString()} in all.`); }
  else { st.model.fill([ring], st.kind); paintCodes(); }
  refreshCount(); plan.draw();
 }
 const onKey = e => {
  if (!document.body.contains(canvas)) { window.removeEventListener('keydown', onKey); return; }
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'Enter' && st.outline.length >= 3) closeOutline();
  if (e.key === 'Escape') { st.outline = []; plan.draw(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && st.model) { st.model.undo(); paintCodes(); refreshCount(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && st.model) { st.model.redo(); paintCodes(); refreshCount(); }
 };
 window.addEventListener('keydown', onKey);

 // ----------------------------------------------------------------- steps
 const steps = [stepLidar, stepLand, stepTrace, stepHoles, stepName, stepReview];
 const can = n => n === 0 || (n === 1 && !!st.preview) || (n >= 2 && !!st.land && (n < 3 || !!st.model) && (n < 4 || st.holes.slice(0, st.holesN).every(h => h?.green && h.tees.length)) && (n !== 2 || true));
 function go(n) {
  if (!can(n)) return;
  st.step = n; st.outline = [];
  if (n !== 5) { plan.clearLayer('course'); st.doc = null; }
  plan.showLayer('codes', n !== 5); plan.showLayer('picture', n !== 5 && st.picOn !== false);
  nav.replaceChildren(...STEPS.map((s, i) => el('button', {class: 'cb-btn' + (i === n ? ' cb-on' : ''), type: 'button', disabled: !can(i), onclick: () => go(i)}, s)));
  panel.replaceChildren(...steps[n]().filter(Boolean));
  // Step 1's left drag draws the property box and step 4's left click places
  // a marker (the view drags with the right button or Space there); step 3
  // keeps its tool; the rest only move the view. (First built with Move on
  // every step but the trace, and the owner found no way to box the course.)
  setTool(n === 0 ? 'box' : n === 3 ? 'mark' : n === 2 && st.model ? st.traceTool ?? 'brush' : 'move');
  plan.draw();
 }
 st.go = go;
 const next = (n, text) => el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => { if (can(n)) go(n); else say(n === 4 ? 'Every hole needs a tee and a green.' : 'Finish this step first.', true); }}, text);
 let toolButtons = [];
 function setTool(t) { st.tool = t; if (st.step === 2) st.traceTool = t; plan.setTool(t === 'move' ? 'move' : 'draw'); st.outline = []; toolButtons.forEach(b => b.classList.toggle('cb-on', b.dataset.tool === t)); }

 // 1. The LIDAR, and the property.
 const fileList = el('ul'), boxText = el('small');
 const boxInfo = () => { const crs = crsOfSources(st.sources), u = crs ? toMetres(crs) : {h: 1}; boxText.textContent = st.box ? `The property: ${((st.box.x1 - st.box.x0) * u.h).toFixed(0)} x ${((st.box.y1 - st.box.y0) * u.h).toFixed(0)} m. Drag on the relief for another.` : ''; };
 function stepLidar() {
  return [el('div', {class: 'cb-field'}, el('label', {}, 'Load the LIDAR'),
   el('small', {}, 'LAS, LAZ, COPC, E57, PLY, PTS, PTX, XYZ/TXT/CSV points, or height grids (GeoTIFF, ASCII grid, float grid with its .hdr, BIL, SRTM HGT). Several tiles at once; a .prj or .hdr beside a file is read with it.'),
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: chooseLand}, 'Choose LIDAR files'), fileList),
  el('div', {class: 'cb-field'}, el('label', {}, 'The property'), el('small', {}, 'Drag a box on the relief round the course with the left button (up to 3 x 3 km); 150 m past it are built too, for the land beyond. The wheel zooms; the right button or Space drags the view.'), boxText),
  next(1, 'Next: build the land')];
 }
 async function chooseLand() {
  const files = await pickFile('', true); if (!files.length) return;
  setBusy('Reading the files…');
  try {
   const side = new Map(files.filter(f => /\.(prj|hdr)$/i.test(f.name)).map(f => [f.name.toLowerCase(), f]));
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
 async function previewLand() {
  const box = sourcesBox(st.sources), unit = toMetres(crsOfSources(st.sources));
  const w = (box.x1 - box.x0) * unit.h, h = (box.y1 - box.y0) * unit.h, cell = Math.max(2, Math.sqrt(w * h / 6e5));
  const g = createGridder({box, cell, unit}), total = st.sources.reduce((s, x) => s + (x.count || 0), 0), every = Math.max(1, Math.floor(total / 4e6));
  for (const s of st.sources) {
   if (s.kind === 'points') await s.each(p => g.add(p), {every, pause: frame, onProgress: f => setBusy(`A first look at the land… ${Math.round(f * 100)}%`)});
   else g.addRaster(s.raster, {rasterUnit: toMetres(s.raster.crs)});
  }
  st.preview = {land: g.finish(), gridder: g};
  const cap = MAX_PROPERTY / unit.h, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  st.box = {x0: Math.max(box.x0, cx - cap / 2), x1: Math.min(box.x1, cx + cap / 2), y0: Math.max(box.y0, cy - cap / 2), y1: Math.min(box.y1, cy + cap / 2)};
  paintRelief(); boxInfo(); go(0);
  say('Drag a box on the relief round the course, then build the land.');
 }

 // 2. The land.
 const landText = el('small');
 function stepLand() {
  return [el('div', {class: 'cb-field'}, el('label', {}, 'Build the land'), el('small', {}, 'The ground the ball meets, the canopy, and the trees, from every point inside the property.'),
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: buildLand}, st.land ? 'Build it again' : 'Build the land'), landText), next(2, 'Next: trace the course')];
 }
 async function buildLand() {
  if (!st.box) return say('Load the LIDAR first.', true);
  setBusy('Building the land…');
  try {
   const r = await landFromSources(st.sources, st.box, {pause: frame, onStep: (what, f) => setBusy(`Building the land… ${what} ${Math.round(f * 100)}%`)});
   Object.assign(st, {land: r.land, gridder: r.gridder, trees: r.trees, model: null, pics: [], picture: null, offset: {x: 0, z: 0}});
   landText.textContent = `${(2 * r.land.halfX).toFixed(0)} x ${(2 * r.land.halfZ).toFixed(0)} m at ${r.land.cell} m; ground ${r.land.method === 'classified' ? 'from the survey\'s own classes' : 'found by a ground filter'}; ${(100 * r.land.filled.reduce((s, v) => s + v, 0) / r.land.filled.length).toFixed(1)}% filled where no laser reached the ground; ${r.trees.length.toLocaleString()} trees.`;
   say(landText.textContent);
   paintRelief(); go(1);
  } catch (e) { say('Could not build the land: ' + e.message, true); }
  finally { setBusy(''); }
 }

 // 3. Trace: the picture, then auto or manual, then the tools.
 const countText = el('small'), layerBox = el('ul', {class: 'cb-layers', style: 'list-style:none;padding:0'});
 // THE LAYERS (the owner, 1 November 2026): each surface its own, top first;
 // click one to paint it, the eye to hide it from view.
 function layersList() {
  if (!st.model) return;
  const L = st.model.state.layers, a = st.land.cell ** 2, shown = [...new Set([...L.present(), st.kind].filter(k => k !== 'rough'))].sort((p, q) => LAYER_ORDER.indexOf(p) - LAYER_ORDER.indexOf(q));
  layerBox.replaceChildren(...shown.map(k => { const m = L.masks.get(k), n = m ? m.reduce((t, v) => t + v, 0) : 0, col = COLOUR[k] ?? [128, 128, 128];
   return el('li', {class: k === st.kind ? 'cb-cur' : '', 'data-layer': k, style: 'display:flex;gap:6px;align-items:center;cursor:pointer;padding:2px 0', onclick: () => { st.kind = k; const sel = panel.querySelector('.cb-kind'); if (sel) sel.value = k; layersList(); }},
    el('button', {class: 'cb-btn', type: 'button', 'data-eye': k, style: 'padding:2px 6px;font-size:11px', onclick: e => { e.stopPropagation(); st.model.setHidden(k, !L.hidden.has(k)); paintCodes(); layersList(); }}, L.hidden.has(k) ? 'hidden' : 'shown'),
    el('span', {class: 'cb-swatch', style: `background:rgb(${col.join(',')})`}), `${LABEL(k)} ${(n * a / 1e4).toFixed(2)} ha`); }));
 }
 const refreshCount = () => { if (!st.model) return; layersList(); const n = new Map(); for (const c of st.model.state.codes) n.set(c, (n.get(c) || 0) + 1); const a = st.land.cell ** 2; countText.textContent = [...n].filter(([c]) => c).sort((p, q) => q[1] - p[1]).slice(0, 6).map(([c, v]) => `${LABEL(PALETTE[c])} ${(v * a / 1e4).toFixed(2)} ha`).join(' · ') + ` · ${st.model.state.trees.length.toLocaleString()} trees`; };
 // Local metres to degrees: by the survey's map grid, or round a place the
 // player searched for when the survey states none.
 const lonLatOfLocal = () => {
  const crs = crsOfSources(st.sources), conv = crs?.epsg ? converter(crs, {epsg: 4326, geographic: true}) : null;
  if (conv) return (x, z) => { const m = st.gridder.map(x, z), q = conv(m.x, m.y); return {lon: q.x, lat: q.y}; };
  if (st.geo) return (x, z) => ({lat: st.geo.lat - z / 111320, lon: st.geo.lon + x / (111320 * Math.cos(st.geo.lat * Math.PI / 180))});
  return null;
 };
 st.lonLatOfLocal = lonLatOfLocal;
 function stepTrace() {
  const ll = lonLatOfLocal(), centre = ll ? ll(0, 0) : null, offer = centre ? providersAt(centre.lon, centre.lat) : Object.keys(PROVIDERS);
  let keys = {}; try { keys = JSON.parse(localStorage.getItem(KEYS) || '{}'); } catch { /* private window */ }
  const prov = el('select', {class: 'cb-provider'}, offer.map(k => el('option', {value: k}, PROVIDERS[k].name + (PROVIDERS[k].free ? ' -- free' : ' -- your key'))));
  const keyIn = el('input', {type: 'password', placeholder: 'Your key (kept in this browser only)', autocomplete: 'off'}), terms = el('small');
  const showProv = () => { const p = PROVIDERS[prov.value]; keyIn.hidden = !!p.free; keyIn.value = keys[prov.value] || ''; terms.textContent = `${p.free ? '' : p.keyHelp + ' '}${p.terms}`; };
  prov.onchange = showProv; showProv();
  const place = el('input', {placeholder: 'A place: the survey does not say where it is'}), found = el('ul');
  const tools = [['move', 'Move'], ['brush', 'Brush'], ['erase', 'Erase layer'], ['eraseAll', 'Erase all'], ['outline', 'Outline'], ['smooth', 'Smooth brush'], ['tree', 'Tree'], ['treeZone', 'Tree zone'], ['treeErase', 'Clear trees']];
  toolButtons = tools.map(([k, t]) => el('button', {class: 'cb-btn' + (st.tool === k ? ' cb-on' : ''), type: 'button', 'data-tool': k, onclick: () => setTool(k)}, t));
  const alignBtn = el('button', {class: 'cb-btn' + (st.tool === 'align' ? ' cb-on' : ''), type: 'button', 'data-tool': 'align', onclick: () => { if (!st.pics.length) return say('Bring a picture with a position first.', true); setTool('align'); say('Drag the picture into line with the relief (Move, the wheel and right-drag still move the view).'); }}, 'Align (drag)');
  toolButtons.push(alignBtn);
  return [
   el('div', {class: 'cb-field'}, el('label', {}, 'A picture to trace over'),
    el('small', {}, 'Fetched for this land and placed by itself, or a file. Drag it into line with Align if it sits off. It is never saved in the course.'),
    prov, keyIn, terms,
    el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => fetchImagery(prov.value, keyIn.value.trim(), keys)}, 'Fetch imagery for this land'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: choosePicture}, 'A picture file'), el('button', {class: 'cb-btn', type: 'button', onclick: useLidarColour}, 'The LIDAR\'s own'),
     alignBtn, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.offset = {x: 0, z: 0}; relay(); }}, 'Undo align')),
    ll ? null : el('div', {class: 'cb-row', style: 'margin:4px 0'}, place, el('button', {class: 'cb-btn', type: 'button', onclick: () => searchPlace(prov.value, keyIn.value.trim(), place.value, found)}, 'Find')), found),
   el('div', {class: 'cb-field'}, el('label', {}, 'Trace the course'),
    el('small', {}, 'Auto: greens, tees, fairways, sand and water found for you to correct. Manual: draw them yourself. The same tools either way.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: autoTrace}, st.traceMode === 'auto' ? 'Auto trace again' : 'Auto trace'), el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: manualTrace}, 'Manual trace'))),
   st.model ? el('div', {class: 'cb-field'}, el('label', {}, 'Tools'), el('div', {class: 'cb-btns'}, ...toolButtons.slice(0, -1)),
    el('small', {}, 'The layer you paint, outline, erase and smooth'), el('select', {class: 'cb-kind', onchange: e => { st.kind = e.target.value; layersList(); }}, LAYER_ORDER.map(k => el('option', {value: k, selected: k === st.kind}, LABEL(k)))),
    el('small', {}, 'Layers (top first; the eye hides one from view, the course keeps it)'), layerBox,
    el('small', {}, 'Brush size (metres)'), el('input', {type: 'range', min: 1, max: 40, value: st.size, oninput: e => { st.size = +e.target.value; }}),
    el('small', {}, 'A tree\'s height, and a zone\'s trees a hectare'),
    el('div', {class: 'cb-btns'}, el('input', {type: 'number', min: 3, max: 60, value: st.treeH, oninput: e => { st.treeH = +e.target.value || 15; }}), el('input', {type: 'number', min: 10, max: 600, value: st.density, oninput: e => { st.density = +e.target.value || 120; }})),
    el('small', {}, 'Outline and Tree zone: click the corners; double-click or Enter closes, Esc drops.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.smooth({radius: 1.5}); paintCodes(); refreshCount(); }}, 'Smooth all edges'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.tidy(); paintCodes(); refreshCount(); }}, 'Tidy specks'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.undo(); paintCodes(); refreshCount(); plan.draw(); }}, 'Undo'), el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.redo(); paintCodes(); refreshCount(); plan.draw(); }}, 'Redo'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.picOn = st.picOn === false; plan.showLayer('picture', st.picOn); }}, 'Picture on/off'), el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.showLayer('codes', !plan.view.show.codes)}, 'Trace on/off')),
    countText) : null,
   next(3, 'Next: the holes')];
 }
 async function fetchImagery(key, apiKey, keys) {
  const ll = lonLatOfLocal();
  if (!ll) return say('The survey does not say where it is: find the place first.', true);
  const p = PROVIDERS[key];
  if (!p.free && !apiKey) return say(`${p.name} needs your key.`, true);
  if (!p.free) { keys[key] = apiKey; try { localStorage.setItem(KEYS, JSON.stringify(keys)); } catch { /* private window */ } }
  setBusy(`Asking ${p.name} for the imagery…`);
  try {
   const {halfX, halfZ} = st.land, corners = [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]].map(([x, z]) => ll(x, z));
   const box = {lon0: Math.min(...corners.map(c => c.lon)), lon1: Math.max(...corners.map(c => c.lon)), lat0: Math.min(...corners.map(c => c.lat)), lat1: Math.max(...corners.map(c => c.lat))};
   const session = await p.start(apiKey);
   const pic = await mosaic(session, box, {onProgress: f => setBusy(`Fetching ${p.name} imagery… ${Math.round(f * 100)}%`)});
   st.pics = [{pic, provider: key, toPixel: (x, z) => { const g = ll(x, z); return pic.toPixel(g.lon, g.lat); }}];
   st.offset = {x: 0, z: 0};
   if (!st.credits.includes(pic.credit)) st.credits.push(pic.credit);
   relay();
   say(`${p.name}: ${pic.width} x ${pic.height} pixels at zoom ${pic.z}${pic.missing ? `, ${pic.missing} tiles missing` : ''}, sized and placed by position. If it sits off, drag it with Align.`);
  } catch (e) { say(`${p.name}: ${e.message}`, true); }
  finally { setBusy(''); }
 }
 async function searchPlace(key, apiKey, text, list) {
  if (!text.trim()) return;
  try {
   const r = await PROVIDERS[key].search(apiKey, text);
   list.replaceChildren(...r.map(f => el('li', {style: 'cursor:pointer', onclick: () => { st.geo = f; say(`The land's middle is now ${f.label}. Fetch the imagery, then align it.`); go(2); }}, f.label)));
   if (!r.length) say('Nothing found by that name.', true);
  } catch (e) { say('The search failed: ' + e.message, true); }
 }
 function relay() {
  let picture = null;
  for (const p of st.pics) picture = pictureOnLand(st.land, st.gridder, p.pic, {affine: (x, z) => p.toPixel(x - st.offset.x, z - st.offset.z), into: picture});
  st.picture = picture; paintPicture();
 }
 function useLidarColour() {
  const {land} = st, N = land.nx * land.nz, rgb = new Uint8Array(N * 3), has = new Uint8Array(N);
  for (let k = 0; k < N; k++) { if (land.rgb) { rgb.set(land.rgb.subarray(k * 3, k * 3 + 3), k * 3); has[k] = land.rgb[k * 3] || land.rgb[k * 3 + 1] ? 1 : 0; } else if (Number.isFinite(land.intensity[k])) { const v = Math.round(land.intensity[k] * 255); rgb[k * 3] = rgb[k * 3 + 1] = rgb[k * 3 + 2] = v; has[k] = 1; } }
  st.pics = []; st.picture = {rgb, nir: null, has, fromLidar: true, colour: !!land.rgb}; paintPicture();
  say(land.rgb ? 'The survey\'s own colour.' : 'The laser\'s brightness: sand and paths bright, water dark.');
 }
 async function choosePicture() {
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
    const conv = head && landCrs ? converter(landCrs, head.crs.epsg ? head.crs : landCrs) : null;
    if (conv) { const c0 = conv(...Object.values(st.gridder.map(-st.land.halfX, st.land.halfZ))), c1 = conv(...Object.values(st.gridder.map(st.land.halfX, -st.land.halfZ)));
     pic = await readGeoTiffRgb(bytes, {box: {x0: Math.min(c0.x, c1.x), x1: Math.max(c0.x, c1.x), y0: Math.min(c0.y, c1.y), y1: Math.max(c0.y, c1.y)}}); }
    else pic = await readGeoTiffRgb(bytes);
    if (!pic.rgb) throw Error('This GeoTIFF has no colour bands: it is a height grid, which goes with the LIDAR files.');
   }
   const conv = pic.x0 != null && landCrs ? converter(landCrs, pic.crs ?? landCrs) : null;
   if (conv) {
    st.pics = st.pics.filter(p => !p.provider).concat([{pic, toPixel: (x, z) => { const m = st.gridder.map(x, z), q = conv(m.x, m.y); return [(q.x - pic.x0) / pic.dx, (q.y - pic.y0) / pic.dy]; }}]);
    relay();
    say(`Placed by its own position: the pictures cover ${(100 * st.picture.has.reduce((s, v) => s + v, 0) / st.picture.has.length).toFixed(0)}% of the land. Add another tile to fill the rest.`);
   } else {
    st.align = {pairs: [], waiting: 'land', pic};
    say('This picture does not say where it is: click a point on the land, then the same point on the picture in the left panel; three or more pairs, spread out.');
    alignWindow(pic);
   }
  } catch (e) { say('Could not use that picture: ' + e.message, true); }
  finally { setBusy(''); }
 }
 function alignWindow(pic) {
  const pc = el('canvas', {width: 380, height: Math.round(380 * pic.height / pic.width), style: 'width:100%;border:1px solid var(--line);cursor:crosshair'}), cx = pc.getContext('2d'), id = cx.createImageData(pc.width, pc.height);
  for (let y = 0; y < pc.height; y++) for (let x = 0; x < pc.width; x++) { const s = Math.floor(y * pic.height / pc.height) * pic.width + Math.floor(x * pic.width / pc.width), o = (y * pc.width + x) * 4; id.data[o] = pic.rgb[s * 3]; id.data[o + 1] = pic.rgb[s * 3 + 1]; id.data[o + 2] = pic.rgb[s * 3 + 2]; id.data[o + 3] = 255; }
  cx.putImageData(id, 0, 0);
  pc.addEventListener('click', e => {
   if (st.align?.waiting !== 'picture') return;
   const b = pc.getBoundingClientRect();
   st.align.pairs.push({local: st.align.local, pixel: {col: (e.clientX - b.left) / b.width * pic.width, row: (e.clientY - b.top) / b.height * pic.height}}); st.align.waiting = 'land';
   if (st.align.pairs.length >= 3) { try { const fit = affineFromPairs(st.align.pairs); st.pics = [{pic, toPixel: fit.map}]; relay(); say(`Lined up from ${st.align.pairs.length} points: the worst ${fit.worst.toFixed(1)} m off. Add points, or drag it with Align.`); } catch (er) { say(er.message, true); } }
   else say(`${st.align.pairs.length} of 3: click the next point on the land.`);
   plan.draw();
  });
  panel.append(pc);
 }
 async function autoTrace() {
  if (!st.land) return;
  setBusy('Tracing…'); await frame();
  try {
   const picture = st.picture && (!st.picture.fromLidar || st.picture.colour) ? st.picture : null;
   const r = trace(st.land, {picture, holes: [], mode: picture ? 'both' : 'lidar'});
   st.model = createTrace(st.land, {codes: r.codes, trees: st.trees}); st.traceMode = 'auto';
   paintCodes(); go(2); refreshCount();
   say(`Traced ${picture ? 'from the LIDAR first, the picture where it cannot tell' : 'from the LIDAR alone (no picture)'}. Correct it with the tools; the holes come next.`);
  } finally { setBusy(''); }
 }
 function manualTrace() {
  if (!st.land) return;
  if (st.model && !confirm('Start a blank trace? What is traced now is dropped.')) return;
  st.model = createTrace(st.land, {trees: st.trees}); st.traceMode = 'manual';
  paintCodes(); st.traceTool = 'brush'; go(2); refreshCount();
  say('A blank trace (the LIDAR\'s trees kept; Clear trees takes them off). Paint or outline each surface.');
 }

 // 4. Holes.
 function stepHoles() {
  const list = el('ul', {}, Array.from({length: st.holesN}, (_, n) => { const h = st.holes[n]; return el('li', {class: n === st.hole ? 'cb-cur' : '', style: 'cursor:pointer', onclick: () => { st.hole = n; go(3); }}, `Hole ${n + 1}: ${h?.tees.length ? h.tees.map(t => t.set).join(', ') + ' tee' : 'no tee'}, ${h?.aims.length ? h.aims.length + ' aim point' + (h.aims.length > 1 ? 's' : '') : 'straight'}, ${h?.green ? 'green' : 'no green'}`); }));
  const marks = [['back', 'Back tee'], ['middle', 'Middle tee'], ['front', 'Front tee'], ['aim', 'Aim point'], ['green', 'Green']].map(([m, t]) => el('button', {class: 'cb-btn' + (st.mark === m ? ' cb-on' : ''), type: 'button', 'data-mark': m, onclick: () => { st.mark = m; go(3); }}, t));
  return [el('div', {class: 'cb-field'}, el('label', {}, `Hole ${st.hole + 1}`),
   el('small', {}, 'Click the plan: the back tee (the middle and front if you like), any aim points where the hole bends, in order, and the green.'),
   el('select', {class: 'cb-holes', onchange: e => { st.holesN = +e.target.value; go(3); }}, [18, 9].map(n => el('option', {value: n, selected: n === st.holesN}, `${n} holes`))),
   el('div', {class: 'cb-btns'}, ...marks),
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.hole = Math.max(0, st.hole - 1); st.mark = 'back'; go(3); }}, 'Previous hole'),
    el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => { st.hole = Math.min(st.holesN - 1, st.hole + 1); st.mark = 'back'; go(3); }}, 'Next hole'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.holes[st.hole] = {tees: [], aims: [], green: null}; go(3); }}, 'Clear this hole'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.holes[st.hole]?.aims.pop(); go(3); }}, 'Drop last aim')), list),
  next(4, 'Next: the name')];
 }
 function markAt(p) {
  const h = st.holes[st.hole] ??= {tees: [], aims: [], green: null};
  if (st.mark === 'green') { h.green = {x: p.x, z: p.z}; st.mark = 'back'; }
  else if (st.mark === 'aim') h.aims.push({x: p.x, z: p.z});
  else { h.tees = h.tees.filter(t => t.set !== st.mark); h.tees.push({x: p.x, z: p.z, set: st.mark}); h.tees.sort((a, b) => ['back', 'middle', 'front'].indexOf(a.set) - ['back', 'middle', 'front'].indexOf(b.set)); if (st.mark === 'back') st.mark = 'green'; }
  go(3);
 }

 // 5. Name; 6. Edit.
 function stepName() {
  return [el('div', {class: 'cb-field'}, el('label', {}, 'The course'),
   el('small', {}, 'Name'), el('input', {class: 'cb-name', value: st.name, maxlength: 60, oninput: e => { st.name = e.target.value; }}),
   el('small', {}, 'Landscape (the look; the land and lies stay)'), el('select', {onchange: e => { st.landscape = e.target.value; }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === st.landscape}, BIOMES[k].name))),
   el('small', {}, 'Credits for the data (one a line)'), el('textarea', {class: 'cb-credits', rows: 4, style: 'background:#03100e;border:1px solid var(--line);color:inherit', oninput: e => { st.credits = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); }}, st.credits.join('\n'))),
  next(5, 'Next: review the course')];
 }
 function stepReview() {
  const card = el('div'), found = el('ul');
  queueMicrotask(() => paintCourse(card, found));
  return [el('div', {class: 'cb-field'}, el('label', {}, 'The course, painted'),
   el('small', {}, 'Every surface as the course will have it -- the outlines smoothed, the specks gone -- in the landscape\'s colours, with the trees and the holes. Go back to any step to change it.'),
   card, el('small', {}, 'Checks'), found,
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => st.doc && openEditor(st.doc, {from: 'real'})}, 'Open in the editor'))];
 }
 // The course made (docFromLand) and drawn from the world the game will
 // build from it, so what is shown is what will be played.
 async function paintCourse(card, found) {
  const holes = st.holes.slice(0, st.holesN).map((h, n) => ({number: n + 1, tees: h.tees, green: h.green, line: holeLine(h)}));
  setBusy('Painting the course…'); await frame();
  try {
   const doc = st.doc = validateDoc(docFromLand({land: st.land, traced: {layers: st.model.state.layers}, holes, trees: st.model.state.trees, name: st.name.trim() || 'My real course', landscape: st.landscape, credits: st.credits,
    source: {files: st.sources.map(s => s.name), epsg: crsOfSources(st.sources)?.epsg ?? null, origin: {x: st.gridder.center.x, y: st.gridder.center.y}, trace: st.traceMode, picture: st.pics.length ? 'placed' : st.picture ? 'lidar' : 'none'}}));
   const w = worldFromDoc(doc), bio = BIOMES[st.landscape], mt = bio.mapTurf || {};
   const col = {green: hex(mt.green ?? bio.green), fringe: hex(bio.fringe ?? mt.green ?? bio.green), fairway: hex(mt.fairway ?? bio.fairway), tee: hex(mt.fairway ?? bio.fairway), semi: hex(mt.semi ?? bio.semi), rough: hex(bio.rough), sand: hex(bio.sand), water: [52, 104, 160], path: [205, 200, 190]};
   const {nx, nz, cell, halfX, halfZ, ground: g} = st.land, N = nx * nz;
   plan.setLayer('course', d => {
    for (let k = 0; k < N; k++) {
     const x = -halfX + (k % nx) * cell, z = -halfZ + Math.floor(k / nx) * cell, s = w.surface(x, z), c = col[s] ?? hex(GROUNDS[s]?.map ?? bio.rough);
     const a = g[Math.min(N - 1, k + 1)] - g[Math.max(0, k - 1)], b = g[Math.min(N - 1, k + nx)] - g[Math.max(0, k - nx)], sh = Math.max(.55, Math.min(1.15, .9 - (a * .7 - b * .7) / (2 * cell) * 1.2));
     d[k * 4] = c[0] * sh; d[k * 4 + 1] = c[1] * sh; d[k * 4 + 2] = c[2] * sh; d[k * 4 + 3] = 255;
    }
   });
   const rows = w.holes.map(h => `${h.number}: par ${h.par}, ${Math.round(h.tees.blue?.yards ?? h.tees.white?.yards ?? 0)} yd`);
   card.replaceChildren(el('small', {}, `${doc.holes.length} holes, par ${w.holes.reduce((a, h) => a + h.par, 0)}, ${Math.round(w.holes.reduce((a, h) => a + (h.tees.blue?.yards ?? 0), 0)).toLocaleString()} yards from the back; ${(doc.trees.length / 7).toLocaleString()} trees, ${doc.water.length} ponds.`), el('ul', {}, rows.map(r => el('li', {}, r))));
   const issues = checkCourse(createEditor(doc));
   found.replaceChildren(...(issues.length ? issues.map(c => el('li', {style: c.at ? 'cursor:pointer' : '', onclick: () => c.at && plan.look(c.at.x, c.at.z, Math.max(plan.view.scale, 2))}, c.text)) : [el('li', {}, 'Nothing breaks a rule.')]));
   say('The course as it will be built. Open it in the editor, or go back to change anything.');
  } catch (e) { say('Could not make the course: ' + e.message, true); }
  finally { setBusy(''); }
 }
 go(0);
 say('Start with the LIDAR files.');
}
