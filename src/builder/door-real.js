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
import {show, setTitle, setBusy, topTools, home, pickFile, ui, setSaver, refreshSave} from './builder.js';
import {writeDraft, DRAFT_EXT} from './draft.js';
import {fileName} from '../course-file.js';
import {openSource, formOf} from '../lidar/formats.js';
import {readGeoTiffRgb} from '../lidar/geotiff.js';
import {converter} from '../lidar/geo.js';
import {crsOf, toMetres} from '../lidar/las.js';
import {createGridder} from '../lidar/land.js';
import {trace, refineTrace} from '../lidar/trace.js';
import {fetchOsm, osmFeatures, layOsm, osmHoles, osmBoundary, OSM_CREDIT} from './osm.js';
import {sourcesBox, crsOfSources, landFromSources, pictureOnLand, affineFromPairs, docFromLand, layerRings, lidarTexels, LIDAR_VIEWS, MAX_PROPERTY} from './real-course.js';
import {createTrace, PALETTE, SPECK, POCK} from './trace-edit.js';
import {LAYER_ORDER, layersFor, tidyMask} from './layers.js';
import {PROVIDERS, providersAt, mosaic} from './imagery.js';
import {sourcesAt, squareAround, searchLidar, downloadLidar} from './lidar-search.js';
import {createPlanView} from './plan-view.js';
import {validateDoc} from '../course-doc.js';
import {BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {GROUNDS} from '../grounds.js';
import {openEditor} from './editor.js';
import {worldFromDoc, GRID_MARGIN} from '../built-world.js';
import {createEditor} from './editing.js';
import {checkCourse} from './checks.js';

const {el} = ui;
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const hex = h => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const OWN = {fairway: [70, 170, 60], semi: [150, 200, 100], tee: [120, 220, 150], green: [150, 245, 150], sand: [245, 228, 175], water: [60, 120, 220], path: [210, 205, 195]};
const COLOUR = Object.fromEntries(PALETTE.map(k => [k, k === 'rough' ? null : OWN[k] ?? hex(GROUNDS[k]?.map ?? '#888888')]));
const LABEL = k => ({rough: 'Rough', fairway: 'Fairway', semi: 'Semi-rough', tee: 'Tee', green: 'Green', sand: 'Sand', water: 'Water', path: 'Cart path'})[k] ?? GROUNDS[k]?.label ?? k;
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i, WORLD = /\.(pgw|jgw|tfw|wld|j2w|bpw|gfw)$/i;
// OUTSIDE THE BOUNDARY (the owner, 1 November 2026): the landscape's own
// floor -- what falls under its trees, its desert floor, its native grass --
// or rough; and a wood as thick as the landscape grows one: 150 trees a
// hectare where needles or leaves fall, 15 on a links, a desert or an island,
// 80 elsewhere (PLACED: by eye against the generated courses' edges).
const outsideGround = bio => bio.fallen?.kind ?? bio.landform?.kinds?.floor ?? (['native', 'heather'].includes(bio.landform?.kinds?.a) ? bio.landform.kinds.a : null);
const outsideTrees = key => BIOMES[key].fallen ? 150 : ['links', 'desert', 'island'].includes(key) ? 15 : 80;
const MARK_NAME = {back: 'back tee', middle: 'middle tee', front: 'front tee', aim: 'aim point', green: 'green'};
const STEPS = ['1 LIDAR', '2 Land', '3 Trace', '4 Holes', '5 Name', '6 Review'];
const KEYS = 'fairway-builder-imagery-keys';
// Imagery fetched this session, by provider and place (fetchImagery): kept
// across door 2's steps, the land rebuilt and door 2 opened again.
const IMAGERY = new Map();
const BRUSHES = ['brush', 'erase', 'eraseAll', 'smooth', 'treeErase', 'homeErase'];

export function open(draft = null) {
 setTitle('Real life course');
 const st = {step: 0, sources: [], preview: null, box: null, land: null, gridder: null, trees: [], pics: [], offset: {x: 0, z: 0}, picture: null, geo: null,
  model: null, traceMode: null, tool: 'move', kind: 'fairway', size: 4, outline: [], hover: null, holes: [], hole: 0, holesN: 18, mark: 'back',
  name: 'My real course', landscape: 'midwest', credits: [], align: null, smoothView: true, traceOn: true, vec: null, boundary: null, exTo: 'semi', exWidth: 4,
  picShow: null, picOffsets: {}, lidarView: 'relief', lidarAlpha: 1, picAlpha: 1, traceAlpha: 120 / 255, lidarOnTop: false, picLocked: true};
 window.fairwayBuilder.door2 = st;
 const canvas = el('canvas', {class: 'cb-plan'});
 const notes = el('div', {class: 'cb-note', style: 'text-align:left;padding:6px 10px;max-width:none'});
 const say = (t, err = false) => { notes.textContent = t; notes.classList.toggle('cb-err', err); };
 const zoomText = el('span'), hintBar = el('div', {class: 'cb-toolhint', hidden: true});
 const plan = createPlanView(canvas, {onTool, overlay});
 st.plan = plan;
 st.toCanvas = (x, z) => plan.toScreen(x, z);
 const panel = el('div', {style: 'display:flex;flex-direction:column;gap:10px'}), nav = el('div', {class: 'cb-stepnav'});
 show(el('section', {class: 'cb-door2'},
  el('div', {class: 'cb-steps'}, el('h2', {style: 'font:800 22px/1 var(--head);text-transform:uppercase;margin:0'}, 'A real life course'), nav, panel),
  el('div', {class: 'cb-planbox'}, canvas, hintBar,
   el('div', {class: 'cb-planbar'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.zoomBy(1.5)}, 'Zoom in'), el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.zoomBy(1 / 1.5)}, 'Zoom out'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.fit()}, 'Whole land'), el('span', {}, 'Wheel zooms; right-drag, Space-drag or Move the view drags it.'), zoomText),
   notes)));
 topTools(el('button', {class: 'cb-btn', type: 'button', onclick: home}, 'Back'));
 const L = () => st.land ?? st.preview?.land;

 // ---------------------------------------------------------------- layers
 function paintRelief() {
  const land = L(); if (!land) return;
  plan.setLand(land);
  paintLidar(); viewLayers(); paintPicture(); paintCodes();
 }
 // The LIDAR as the relief, its brightness or its slope (lidarTexels).
 function paintLidar() { const land = L(); if (land) plan.setLayer('relief', d => lidarTexels(land, st.lidarView, d)); }
 // Each layer's opacity, and the LIDAR under the picture or over it.
 function viewLayers() {
  plan.setAlpha('relief', st.lidarAlpha); plan.setAlpha('picture', st.picAlpha); plan.setAlpha('codes', st.traceAlpha);
  plan.setOrder(st.lidarOnTop ? ['picture', 'relief'] : ['relief', 'picture']);
 }
 function paintPicture() {
  if (!st.land || !st.picture) { plan.clearLayer('picture'); return; }
  const p = st.picture;
  plan.setLayer('picture', (d, nx, nz) => { for (let k = 0; k < nx * nz; k++) if (p.has[k]) { d[k * 4] = p.rgb[k * 3]; d[k * 4 + 1] = p.rgb[k * 3 + 1]; d[k * 4 + 2] = p.rgb[k * 3 + 2]; d[k * 4 + 3] = 255; } });
  plan.shiftLayer('picture', 0, 0);
 }
 const codeTexel = (d, o, c) => { const col = COLOUR[PALETTE[c]]; if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; } else d[o + 3] = 0; };
 function paintCodes() {
  if (!st.land || !st.model) { plan.clearLayer('codes'); return; }
  const c = st.model.state.layers.view;
  plan.setLayer('codes', (d, nx, nz) => { for (let k = 0; k < nx * nz; k++) codeTexel(d, k * 4, c[k]); });
  dirtyVec();
 }
 function patchCodes(x, z, r) {
  const {cell, halfX, halfZ, nx} = st.land, c = st.model.state.layers.view, w = 2 * r / cell + 4;
  plan.patchLayer('codes', (x - r + halfX) / cell - 2, (z - r + halfZ) / cell - 2, w, w, (d, a, b, W, H) => { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) codeTexel(d, (j * W + i) * 4, c[(b + j) * nx + a + i]); });
  dirtyVec();
 }
 // THE TRACE AS IT WILL PLAY (the owner, 1 November 2026: "It gets really
 // pixellated in the tracer. will the game smooth those lines out?"). It
 // does: each layer goes into the course as smoothed outlines (layerRings,
 // after the specks and pocks are tidied), so the trace is drawn that way
 // too, a moment after each change. While a stroke is being painted its cells
 // show; Smooth view off shows the cells always.
 let vecTimer = 0;
 const vecCanvas = document.createElement('canvas');
 function dirtyVec() { st.vec = null; clearTimeout(vecTimer); if (st.smoothView) vecTimer = setTimeout(buildVec, 250); showCodes(); }
 function buildVec() {
  if (!st.model || !st.land || !st.smoothView) return;
  if (st.model.state.stroke) { vecTimer = setTimeout(buildVec, 250); return; }
  const Ls = st.model.state.layers, {nx, nz, cell} = st.land, speck = Math.round(SPECK / (cell * cell)), pock = Math.round(POCK / (cell * cell));
  st.vec = LAYER_ORDER.filter(k => Ls.masks.has(k) && !Ls.hidden.has(k)).reverse().map(k => { const c = Uint8Array.from(Ls.masks.get(k)); tidyMask(c, nx, nz, speck, pock); return {kind: k, rings: layerRings(c, st.land)}; });
  showCodes();
 }
 function showCodes() { plan.view.show.codes = st.traceOn && st.step !== 5 && !(st.smoothView && st.vec); plan.draw(); }
 function drawVec(ctx, p) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (vecCanvas.width !== W || vecCanvas.height !== H) { vecCanvas.width = W; vecCanvas.height = H; }
  const v = vecCanvas.getContext('2d'); v.clearRect(0, 0, W, H); v.lineWidth = p.px; v.strokeStyle = 'rgba(0,0,0,.45)';
  for (const {kind, rings} of st.vec) {
   const col = COLOUR[kind]; if (!col) continue;
   v.fillStyle = `rgb(${col.join(',')})`; v.beginPath();
   for (const r of rings) { r.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); if (q) v.lineTo(sx, sy); else v.moveTo(sx, sy); }); v.closePath(); }
   v.fill('evenodd'); v.stroke();
  }
  ctx.globalAlpha = st.traceAlpha; ctx.drawImage(vecCanvas, 0, 0); ctx.globalAlpha = 1;
 }
 // WHAT THE TOOL DOES, top middle of the view for as long as it is held (the
 // owner, 1 November 2026: "It needs to be more clear what you are doing").
 function showHint() {
  const k = LABEL(st.kind).toLowerCase(), r = st.size, view = 'Right-drag or Space-drag moves the view; the wheel zooms.', corners = n => `${n} corner${n === 1 ? '' : 's'} so far: click more; double-click or Enter closes it, Esc drops it.`;
  let t = '';
  if (st.step === 0) t = st.preview ? `Drag a box round the property on the relief. ${view}` : '';
  else if (st.step === 3) t = `Hole ${st.hole + 1}: click to place its ${MARK_NAME[st.mark] ?? st.mark}. ${view}`;
  else if (st.step === 2 && !st.model && st.tool !== 'align') t = st.land ? 'Fetch OpenStreetMap, or press Auto trace or Manual trace, to start.' : '';
  else if (st.step === 2) {
   const all = st.kind === 'rough';
   t = ({
    move: 'Move the view: drag to move it; the wheel zooms. Pick a tool to paint.',
    brush: all ? `Paint brush, rough (${r} m round): drag to take every layer off.` : `Paint brush: drag to paint ${k} (${r} m round).`,
    erase: all ? `Erase brush (${r} m round): drag to take every layer off.` : `Erase brush: drag to take ${k} off (${r} m round); whatever lies under it shows.`,
    eraseAll: `Erase all layers (${r} m round): drag to take every layer off, down to rough.`,
    outline: st.outline.length ? `Outline fill, ${k}: ${corners(st.outline.length)}` : `Outline fill, ${k}: click round the shape, corner by corner.`,
    smooth: `Smooth brush (${r} m round): drag along a ragged edge to round it.`,
    tree: `Tree: click to stand a ${st.treeH} m tree (not on mown ground, sand, water or a path).`,
    treeZone: st.outline.length ? `Tree zone: ${corners(st.outline.length)}` : `Tree zone: click round the zone, corner by corner; it fills with ${st.density} trees a hectare.`,
    boundary: st.outline.length ? `Course boundary: ${corners(st.outline.length)}` : 'Course boundary: click round the course, corner by corner; outside it becomes the landscape\'s wood.',
    home: 'House: click to stand a house; it faces the nearest fairway, green or tee.',
    homeZone: st.outline.length ? `House zone: ${corners(st.outline.length)}` : 'House zone: click round a street or estate, corner by corner; houses line it 42 m apart, each facing the course.',
    homeErase: `Clear houses: drag to take houses off (${r} m round).`,
    treeErase: `Clear trees: drag to take trees off (${r} m round).`,
    turnShape: st.turning ? `Turning the ${st.turning.what}: ${Math.round(st.turning.angle * 180 / Math.PI)} degrees; let go to set it.` : `Turn shape: press on a green, bunker, pond or house and drag round its middle to turn it -- the ${k} layer where it lies under the pointer, else the topmost shown.`,
    shape: st.moving ? `Moving the ${st.moving.what}: let go where it belongs. Undo puts it back.` : `Move shape: drag a green, bunker, fairway, pond, tree or house to move it whole -- the ${k} layer where it lies under the pointer, else the topmost shown.`,
    align: `Picture unlocked: drag it into line with the LIDAR, or nudge it with the arrow keys (a quarter metre; Shift, a metre). It is ${st.offset.x.toFixed(2)} m east, ${(-st.offset.z).toFixed(2)} m north of where its position put it. Lock it when it is right.`,
   })[st.tool] ?? '';
   if (t && st.tool !== 'move') t += ' ' + view;
  }
  if (hintBar.textContent !== t) hintBar.textContent = t;
  hintBar.hidden = !t;
 }

 // --------------------------------------------------------------- overlay
 function overlay(ctx, p) {
  const px = p.px; if (!L()) return;
  zoomText.textContent = `${(px / p.view.scale).toFixed(2)} m a screen pixel`;
  showHint();
  if (st.vec && st.smoothView && st.traceOn && st.step < 5 && st.land) drawVec(ctx, p);
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
  const homes = st.model?.state.homes;
  if (st.land && homes?.length) for (const h of homes) {
   const c = Math.cos(h.rotation), sn = Math.sin(h.rotation), pt = (a, b) => p.toScreen(h.x + a * c + b * sn, h.z - a * sn + b * c), w = h.width / 2, d = h.depth / 2;
   ctx.fillStyle = 'rgba(214,120,96,.85)'; ctx.strokeStyle = '#3b1d14'; ctx.lineWidth = px; ctx.beginPath();
   [[-w, -d], [w, -d], [w, d], [-w, d]].forEach(([a, b], q) => { const [x, y] = pt(a, b); if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
   ctx.strokeStyle = '#fff4d6'; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.moveTo(...pt(-w, d)); ctx.lineTo(...pt(w, d)); ctx.stroke();
  }
  if (st.step >= 3) st.holes.slice(0, st.holesN).forEach((h, n) => {
   if (!h) return;
   const on = n === st.hole, line = holeLine(h);
   if (line.length >= 2) { ctx.strokeStyle = on ? '#fde68a' : 'rgba(255,255,255,.75)'; ctx.lineWidth = (on ? 2 : 1.2) * px; ctx.beginPath(); line.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); q ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); }
   for (const t of h.tees) { const [x, y] = p.toScreen(t.x, t.z); ctx.fillStyle = {back: '#4385d5', middle: '#f4f2e7', front: '#d75c52'}[t.set]; ctx.beginPath(); ctx.arc(x, y, 5 * px, 0, 7); ctx.fill(); }
   for (const a of h.aims) { const [x, y] = p.toScreen(a.x, a.z); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(x, y, 6 * px, 0, 7); ctx.moveTo(x - 9 * px, y); ctx.lineTo(x + 9 * px, y); ctx.moveTo(x, y - 9 * px); ctx.lineTo(x, y + 9 * px); ctx.stroke(); }
   if (h.green) { const [x, y] = p.toScreen(h.green.x, h.green.z); ctx.fillStyle = on ? '#fde68a' : '#d4443a'; ctx.beginPath(); ctx.arc(x, y, 6 * px, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * px}px system-ui`; ctx.fillText(String(n + 1), x + 8 * px, y - 6 * px); }
  });
  if (st.boundary && st.step >= 2 && st.step < 5) { ctx.save(); ctx.setLineDash([10 * px, 6 * px]); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2.5 * px; ctx.beginPath(); st.boundary.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); if (q) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  if (st.outline.length) { ctx.strokeStyle = '#ff6bd6'; ctx.lineWidth = 2 * px; ctx.beginPath(); st.outline.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); q ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); if (st.hover) ctx.lineTo(...p.toScreen(st.hover.x, st.hover.z)); ctx.stroke(); }
  // The shape being moved, drawn where it would go.
  if (st.moving && (st.moving.dx || st.moving.dz)) {
   const {pick, dx, dz} = st.moving, m = st.model.state; ctx.strokeStyle = '#ff6bd6'; ctx.fillStyle = 'rgba(255,107,214,.25)'; ctx.lineWidth = 2 * px; ctx.beginPath();
   if (pick.type === 'tree') { const t = m.trees[pick.index], [x, y] = p.toScreen(t.x + dx, t.z + dz); ctx.arc(x, y, Math.max(3 * px, t.crown * p.view.scale), 0, 7); }
   else if (pick.type === 'home') { const h = m.homes[pick.index], [x, y] = p.toScreen(h.x + dx, h.z + dz), r = Math.max(h.width, h.depth) / 2 * p.view.scale; ctx.rect(x - r, y - r, 2 * r, 2 * r); }
   else for (const r of st.moving.rings) { r.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x + dx, z + dz); if (q) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); }
   ctx.fill('evenodd'); ctx.stroke();
  }
  // The shape being turned, drawn as it would lie.
  if (st.turning && st.turning.angle) {
   const {pick, angle, mid, rings} = st.turning, c = Math.cos(angle), sn = Math.sin(angle), m = st.model.state;
   const rot = ([x, z]) => p.toScreen(mid.x + (x - mid.x) * c - (z - mid.z) * sn, mid.z + (x - mid.x) * sn + (z - mid.z) * c);
   ctx.strokeStyle = '#ff6bd6'; ctx.fillStyle = 'rgba(255,107,214,.25)'; ctx.lineWidth = 2 * px; ctx.beginPath();
   if (pick.type === 'home') { const h = m.homes[pick.index], r = h.rotation - angle, hc = Math.cos(r), hs = Math.sin(r), w = h.width / 2, d = h.depth / 2; [[-w, -d], [w, -d], [w, d], [-w, d]].forEach(([a, b], q) => { const [sx, sy] = p.toScreen(h.x + a * hc + b * hs, h.z - a * hs + b * hc); if (q) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); }
   else for (const r of rings) { r.forEach((pt, q) => { const [sx, sy] = rot(pt); if (q) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); }
   ctx.fill('evenodd'); ctx.stroke();
  }
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
    if (st.picLocked) return;
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
     else if (t === 'homeErase') m.removeHomes({x: p.x, z: p.z, radius: st.size});
     else m.removeTrees({x: p.x, z: p.z, radius: st.size});
     if (t !== 'treeErase' && t !== 'homeErase') patchCodes(p.x, p.z, st.size + 2);
    }
    if (type === 'up') { m.endStroke(); refreshCount(); }
    plan.draw(); return;
   }
   if (t === 'outline' || t === 'treeZone' || t === 'boundary' || t === 'homeZone') {
    if (type === 'down') st.outline.push([p.x, p.z]);
    if (type === 'double' && st.outline.length >= 3) closeOutline();
    plan.draw(); return;
   }
   // MOVE SHAPE (the owner, 1 November 2026): one shape, tree or house
   // picked up and put down whole (trace-edit.js pickAt and move).
   if (t === 'shape') {
    if (type === 'down') {
     const pick = m.pickAt({x: p.x, z: p.z, kind: st.kind});
     if (!pick) { say('Nothing to move there: only rough under the pointer.', true); return; }
     let rings = [];
     if (pick.type === 'shape') { const mask = new Uint8Array(st.land.nx * st.land.nz); for (const k of pick.cells) mask[k] = 1; rings = layerRings(mask, st.land); }
     st.moving = {pick, from: p, dx: 0, dz: 0, rings, what: pick.type === 'shape' ? LABEL(pick.kind).toLowerCase() : pick.type === 'tree' ? 'tree' : 'house'};
    }
    if (type === 'drag' && st.moving) { st.moving.dx = p.x - st.moving.from.x; st.moving.dz = p.z - st.moving.from.z; }
    if (type === 'up' && st.moving) {
     const {pick, dx, dz, what} = st.moving; st.moving = null;
     if (Math.hypot(dx, dz) >= st.land.cell / 2) { m.move(pick, dx, dz); if (pick.type === 'shape') paintCodes(); refreshCount(); say(`The ${what} moved ${Math.hypot(dx, dz).toFixed(1)} m. Undo puts it back.`); }
    }
    plan.draw(); return;
   }
   // TURN SHAPE: the same pick, turned about its middle by the angle the
   // pointer sweeps round it (trace-edit.js turn).
   if (t === 'turnShape') {
    if (type === 'down') {
     const pick = m.pickAt({x: p.x, z: p.z, kind: st.kind});
     if (!pick || pick.type === 'tree') { say(pick ? 'A tree is round: nothing to turn.' : 'Nothing to turn there: only rough under the pointer.', true); return; }
     let mid = pick.type === 'home' ? {x: m.state.homes[pick.index].x, z: m.state.homes[pick.index].z} : null, rings = [];
     if (!mid) { const {nx, cell, halfX, halfZ} = st.land; let sx = 0, sz = 0; for (const k of pick.cells) { sx += -halfX + (k % nx) * cell; sz += -halfZ + Math.floor(k / nx) * cell; } mid = {x: sx / pick.cells.length, z: sz / pick.cells.length}; const mask = new Uint8Array(st.land.nx * st.land.nz); for (const k of pick.cells) mask[k] = 1; rings = layerRings(mask, st.land); }
     st.turning = {pick, mid, a0: Math.atan2(p.x - mid.x, p.z - mid.z), angle: 0, rings, what: pick.type === 'home' ? 'house' : LABEL(pick.kind).toLowerCase()};
    }
    if (type === 'drag' && st.turning) st.turning.angle = st.turning.a0 - Math.atan2(p.x - st.turning.mid.x, p.z - st.turning.mid.z);
    if (type === 'up' && st.turning) {
     const {pick, angle, what} = st.turning; st.turning = null;
     if (Math.abs(angle) > .01) { m.turn(pick, angle); if (pick.type === 'shape') paintCodes(); refreshCount(); say(`The ${what} turned ${Math.round(angle * 180 / Math.PI)} degrees. Undo puts it back.`); }
    }
    plan.draw(); return;
   }
   if (t === 'home' && type === 'down') {
    const h = m.homeAt({x: p.x, z: p.z});
    if (!m.homeFits(h)) say('A house needs open ground all round it -- not turf, sand, water, a path or another house.', true);
    else { m.addHome(h); refreshCount(); }
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
  if (st.tool === 'boundary') { st.boundary = ring; say(`The course boundary: ${(ringArea(ring) / 1e4).toFixed(1)} ha. Fill outside it when it is right.`); setTool('move'); go(2); return; }
  if (st.tool === 'homeZone') { const n = st.model.homeZone(ring, {seed: st.model.state.undo.length + 1}); say(n ? `${n} house${n === 1 ? '' : 's'} in the zone, each facing the nearest fairway, green or tee.` : 'No house fits there: each needs open ground all round it.', !n); refreshCount(); plan.draw(); return; }
  if (st.tool === 'treeZone') { st.model.treeZone(ring, {density: st.density, seed: st.model.state.undo.length + 1}); say(`Trees: ${st.model.state.trees.length.toLocaleString()} in all.`); }
  else { st.model.fill([ring], st.kind); paintCodes(); }
  refreshCount(); plan.draw();
 }
 const onKey = e => {
  if (!document.body.contains(canvas)) { window.removeEventListener('keydown', onKey); return; }
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'Enter' && st.outline.length >= 3) closeOutline();
  if (e.key === 'Escape') { st.outline = []; plan.draw(); }
  // The unlocked picture nudged: a quarter metre a press, a metre with Shift.
  const nudge = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (nudge && st.step === 2 && st.tool === 'align' && !st.picLocked) { e.preventDefault(); const s = e.shiftKey ? 1 : .25; st.offset = {x: st.offset.x + nudge[0] * s, z: st.offset.z + nudge[1] * s}; relay(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && st.model) { st.model.undo(); paintCodes(); refreshCount(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && st.model) { st.model.redo(); paintCodes(); refreshCount(); }
 };
 window.addEventListener('keydown', onKey);

 // ----------------------------------------------------------------- steps
 const steps = [stepLidar, stepLand, stepTrace, stepHoles, stepName, stepReview];
 const can = n => n === 0 || (n === 1 && (!!st.preview || !!st.land)) || (n >= 2 && !!st.land && (n < 3 || !!st.model) && (n < 4 || st.holes.slice(0, st.holesN).every(h => h?.green && h.tees.length)) && (n !== 2 || true));
 function go(n) {
  if (!can(n)) return;
  st.step = n; st.outline = [];
  if (n !== 5) { plan.clearLayer('course'); st.doc = null; }
  plan.showLayer('picture', n !== 5 && st.picOn !== false); showCodes();
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
 // The picture is unlocked only while the Align tool is held: any other tool
 // locks it again, so a brush stroke never drags it.
 function setTool(t) {
  if (t !== 'align') st.picLocked = true;
  st.tool = t; if (st.step === 2 && t !== 'align') st.traceTool = t; plan.setTool(t === 'move' ? 'move' : 'draw'); st.outline = [];
  toolButtons.forEach(b => b.classList.toggle('cb-on', b.dataset.tool === t));
  const lockBtn = toolButtons.find(b => b.dataset.tool === 'align'); if (lockBtn) lockBtn.textContent = st.picLocked ? 'Unlock the picture' : 'Lock the picture';
 }

 // 1. The LIDAR, and the property.
 const fileList = el('ul'), boxText = el('small');
 const boxInfo = () => { const crs = crsOfSources(st.sources), u = crs ? toMetres(crs) : {h: 1}; boxText.textContent = st.box ? `The property: ${((st.box.x1 - st.box.x0) * u.h).toFixed(0)} x ${((st.box.y1 - st.box.y0) * u.h).toFixed(0)} m. Drag on the relief for another.` : ''; };
 // FIND LIDAR FOR A PLACE (the owner, 1 November 2026; lidar-search.js): a
 // place by name, a square round it, every source that covers it. Online
 // only when pressed.
 const findList = el('ul', {class: 'cb-found'}), findOut = el('div', {class: 'cb-lidarfound'});
 function findField() {
  const place = el('input', {class: 'cb-lidarplace', placeholder: 'A course or a place, by name', value: st.find?.label ?? ''}), size = el('select', {class: 'cb-lidarsize'}, [1000, 1500, 2000, 3000].map(m => el('option', {value: m, selected: m === (st.findSize ?? 1500)}, `${m / 1000} km square`)));
  size.onchange = () => { st.findSize = +size.value; };
  return el('div', {class: 'cb-field'}, el('label', {}, 'Find LIDAR'),
   el('small', {}, 'Search by name, pick the place, then search every source that covers it: USGS 3DEP, IGN LiDAR HD and swisstopo download here; state and national portals open in a new tab. Goes online only when pressed.'),
   el('div', {class: 'cb-row', style: 'margin:4px 0'}, place, el('button', {class: 'cb-btn', type: 'button', onclick: () => findPlace(place.value)}, 'Find')), findList,
   el('div', {class: 'cb-btns'}, size, el('button', {class: 'cb-btn cb-hot', type: 'button', disabled: !st.find, 'data-find': 'search', onclick: () => searchAll()}, 'Search for LIDAR')), findOut);
 }
 async function findPlace(text) {
  if (!text.trim()) return;
  try {
   const r = await PROVIDERS.usgs.search(null, text);
   findList.replaceChildren(...r.map(f => el('li', {style: 'cursor:pointer', onclick: () => { st.find = f; findList.replaceChildren(); go(0); say(`${f.label}: search for LIDAR round it.`); }}, f.label)));
   if (!r.length) say('Nothing found by that name.', true);
  } catch (e) { say('The search failed: ' + e.message, true); }
 }
 async function searchAll() {
  if (!st.find) return;
  const box = squareAround(st.find.lon, st.find.lat, st.findSize ?? 1500), here = sourcesAt(st.find.lon, st.find.lat);
  st.findBox = box; findOut.replaceChildren(el('small', {}, 'Searching…'));
  const rows = [];
  for (const s of here.filter(s => s.online)) {
   try {
    const found = await searchLidar(s.key, box);
    rows.push(el('div', {class: 'cb-field', style: 'padding:6px'}, el('label', {}, s.name), el('small', {}, s.licence),
     found.length ? el('ul', {}, found.map(f => el('li', {}, `${f.title}${f.date ? ', ' + String(f.date).slice(0, 10) : ''}: ${f.tiles ? `${f.tiles} tile${f.tiles === 1 ? '' : 's'}` : 'its square copy only'}${f.bytes ? `, ${(f.bytes / 1e6).toFixed(0)} MB as tiles` : f.points ? `, ${(f.points / 1e6).toFixed(1)} M points` : ''} `,
      el('div', {class: 'cb-btns'}, f.ept || s.key !== 'usgs' ? el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-download': f.id, onclick: () => fetchLidar(f)}, s.key === 'usgs' ? 'Download the square here' : 'Download here') : el('small', {}, 'No copy that downloads by the square yet.'),
       f.tileUrls?.length ? el('button', {class: 'cb-btn', type: 'button', 'data-rocky': f.id, onclick: () => viaDownloads(f)}, 'Download its whole tiles (to your Downloads)') : null)))) : el('small', {}, 'Nothing over this square.')));
   } catch (e) { rows.push(el('small', {class: 'cb-err'}, `${s.name}: ${e.message}`)); }
  }
  const links = here.filter(s => s.link);
  if (links.length) rows.push(el('div', {class: 'cb-field', style: 'padding:6px'}, el('label', {}, 'Also covering this place'), el('ul', {}, links.map(s => el('li', {}, el('a', {href: s.link, target: '_blank', rel: 'noopener'}, s.name), s.note ? ` -- ${s.note}` : '')))));
  findOut.replaceChildren(...rows);
 }
 async function fetchLidar(found) {
  setBusy('Downloading the LIDAR…');
  try {
   const lazModule = await (await import('../lidar/laz.js')).lazModule();
   // The square and the land built past it (GRID_MARGIN each side).
   const wide = squareAround(st.find.lon, st.find.lat, (st.findSize ?? 1500) + 2 * GRID_MARGIN);
   const got = await downloadLidar(found, wide, {lazModule, onProgress: (f, what) => setBusy(`Downloading the LIDAR… ${what} (${Math.round(f * 100)}%)`)});
   for (const src of got) { st.sources.push(src); fileList.append(el('li', {}, `${src.name}: downloaded, ${src.count.toLocaleString()} points${src.bytes ? `, ${(src.bytes / 1e6).toFixed(0)} MB` : ''}`)); }
   await previewLand(st.findBox);
  } catch (e) { say('Could not download it: ' + e.message, true); }
  finally { setBusy(''); }
 }
 // ROCKYWEB'S WHOLE TILES (the owner, 1 November 2026: "figure out how to
 // gain access to rockyweb for LIDAR. there has to be a way"). Rockyweb lets
 // no page read it (no Access-Control-Allow-Origin; its preflight answers
 // 405), but a browser DOWNLOADS from it like any site. So the tiles are
 // downloaded as files, a few seconds apart (rockyweb answers 429 to a rush),
 // and read back from the downloads folder the player picks once
 // (showDirectoryPicker: Chrome and Edge). Where the browser cannot pick a
 // folder, the player brings the downloaded files with Choose LIDAR files.
 // First, Fairway's bridge if it is running (the launch monitor's helper,
 // bridge/server.mjs `/lidar`): it fetches rockyweb for the page.
 async function viaBridge(tiles) {
  const base = 'http://127.0.0.1:1922';
  try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500); if (!(await fetch(base + '/health', {signal: ctl.signal})).ok) return false; } catch { return false; }
  const lazModule = await (await import('../lidar/laz.js')).lazModule();
  for (const [n, t] of tiles.entries()) {
   const r = await fetch(`${base}/lidar?url=${encodeURIComponent(t.url)}`);
   if (!r.ok) throw Error(`USGS would not give ${t.name} through the bridge (${r.status}).`);
   const total = +r.headers.get('content-length') || t.bytes, parts = [], reader = r.body.getReader(); let got = 0;
   for (;;) { const {done, value} = await reader.read(); if (done) break; parts.push(value); got += value.length; setBusy(`Downloading ${t.name} through Fairway's bridge (${n + 1} of ${tiles.length}): ${Math.round(100 * got / total)}%`); }
   const bytes = new Uint8Array(got); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
   const src = {...(await openSource(t.name, bytes, {lazModule})), name: t.name, downloaded: true};
   st.sources.push(src); fileList.append(el('li', {}, `${t.name}: from USGS through the bridge, ${src.count.toLocaleString()} points`));
  }
  return true;
 }
 async function viaDownloads(found) {
  const tiles = found.tileUrls;
  setBusy('Looking for Fairway\'s bridge…');
  try { if (await viaBridge(tiles)) { setBusy(''); await previewLand(st.findBox); return; } }
  catch (e) { setBusy(''); return say(e.message, true); }
  setBusy('');
  let dir = downloadsDir;
  if (!dir && typeof window.showDirectoryPicker === 'function') {
   say('Pick the folder your browser downloads to (usually Downloads): the builder reads the tiles from there once they arrive.');
   try { dir = downloadsDir = await window.showDirectoryPicker({id: 'fairway-downloads', mode: 'read', startIn: 'downloads'}); } catch { return say('No folder picked: nothing downloaded.', true); }
  }
  const have = async t => { if (!dir) return null; try { const f = await (await dir.getFileHandle(t.name)).getFile(); return !t.bytes || f.size === t.bytes ? f : null; } catch { return null; } };
  for (const [n, t] of tiles.entries()) {
   if (await have(t)) continue;
   const a = el('a', {href: t.url, download: t.name}); document.body.append(a); a.click(); a.remove();
   say(`Downloading ${t.name} from USGS (${n + 1} of ${tiles.length}, ${(t.bytes / 1e6).toFixed(0)} MB). Your browser may ask once to allow several downloads.`);
   await new Promise(r => setTimeout(r, 4000));
  }
  if (!dir) return say(`${tiles.length} tile${tiles.length === 1 ? '' : 's'} downloading from USGS. When they finish, bring them with Choose LIDAR files.`);
  // Each tile read once it is whole in the folder (the browser writes a
  // .crdownload and renames it when done).
  const got = new Map(), t0 = Date.now();
  while (got.size < tiles.length && Date.now() - t0 < 60 * 60e3) {
   for (const t of tiles) if (!got.has(t.name)) { const f = await have(t); if (f) got.set(t.name, f); }
   setBusy(`Waiting for the downloads: ${got.size} of ${tiles.length} tiles whole in the folder…`);
   if (got.size < tiles.length) await new Promise(r => setTimeout(r, 2000));
  }
  setBusy('');
  if (got.size < tiles.length) return say(`Only ${got.size} of ${tiles.length} tiles arrived in that folder within the hour. Bring them with Choose LIDAR files when they are done.`, true);
  await readFiles([...got.values()]);
  if (st.findBox && st.preview) await previewLand(st.findBox);
 }
 function stepLidar() {
  return [findField(), el('div', {class: 'cb-field'}, el('label', {}, 'Load the LIDAR'),
   el('small', {}, 'LAS, LAZ, COPC, E57, PLY, PTS, PTX, XYZ/TXT/CSV points, or height grids (GeoTIFF, ASCII grid, float grid with its .hdr, BIL, SRTM HGT). Several tiles at once; a .prj or .hdr beside a file is read with it.'),
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: chooseLand}, 'Choose LIDAR files'), fileList),
  el('div', {class: 'cb-field'}, el('label', {}, 'The property'), el('small', {}, 'Drag a box on the relief round the course with the left button (up to 3 x 3 km); 150 m past it are built too, for the land beyond. The wheel zooms; the right button or Space drags the view.'), boxText),
  next(1, 'Next: build the land')];
 }
 async function chooseLand() {
  const files = await pickFile('', true); if (!files.length) return;
  await readFiles(files);
 }
 async function readFiles(files) {
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
   if (st.sources.length) await previewLand(st.findBox);
  } finally { setBusy(''); }
 }
 // `degrees`: the square searched for ({lon0, lat0, lon1, lat1}), made the property.
 async function previewLand(degrees = null) {
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
  const conv = degrees ? converter({epsg: 4326, geographic: true}, crsOfSources(st.sources)) : null;
  if (conv) {
   const c = [[degrees.lon0, degrees.lat0], [degrees.lon1, degrees.lat0], [degrees.lon0, degrees.lat1], [degrees.lon1, degrees.lat1]].map(([x, y]) => conv(x, y)), xs = c.map(q => q.x), ys = c.map(q => q.y);
   const sq = {x0: Math.max(box.x0, Math.min(...xs)), x1: Math.min(box.x1, Math.max(...xs)), y0: Math.max(box.y0, Math.min(...ys)), y1: Math.min(box.y1, Math.max(...ys))};
   if (sq.x1 > sq.x0 && sq.y1 > sq.y0) st.box = sq;
  }
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
  if (st.sources.some(s => s.restored)) return say('This draft keeps the land it built, not the LIDAR files: bring them again in step 1 to build the land anew.', true);
  setBusy('Building the land…');
  try {
   const r = await landFromSources(st.sources, st.box, {pause: frame, onStep: (what, f) => setBusy(`Building the land… ${what} ${Math.round(f * 100)}%`)});
   // The pictures stay (the owner, 1 November 2026: keep the imagery when
   // the mode changes): placed by position, they lie on new land as on old;
   // one lined up by matched points was matched to the old land, and goes.
   Object.assign(st, {land: r.land, gridder: r.gridder, trees: r.trees, model: null, pics: st.pics.filter(p => p.provider || p.file), picture: null});
   if (st.picShow === 'matched') st.picShow = null;
   landText.textContent = `${(2 * r.land.halfX).toFixed(0)} x ${(2 * r.land.halfZ).toFixed(0)} m at ${r.land.cell} m; ground ${r.land.method === 'classified' ? 'from the survey\'s own classes' : 'found by a ground filter'}; ${(100 * r.land.filled.reduce((s, v) => s + v, 0) / r.land.filled.length).toFixed(1)}% filled where no laser reached the ground; ${r.trees.length.toLocaleString()} trees.`;
   say(landText.textContent);
   paintRelief(); if (st.picShow) relay(); go(1);
  } catch (e) { say('Could not build the land: ' + e.message, true); }
  finally { setBusy(''); }
 }

 // 3. Trace: the picture, then auto or manual, then the tools.
 const countText = el('small'), layerBox = el('ul', {class: 'cb-layers', style: 'list-style:none;padding:0'});
 // THE LAYERS (the owner, 1 November 2026): each surface its own, top first;
 // click one to paint it, the eye to hide it from view.
 // The layers offered: the landscape's own (layersFor) and any other that
 // holds something, in the game's order, rough last.
 const kindsShown = () => { const own = layersFor(BIOMES[st.landscape]), have = st.model?.layersPresent() ?? []; return [...LAYER_ORDER.filter(k => own.includes(k) || have.includes(k)), 'rough']; };
 function layersList() {
  if (!st.model) return;
  const L = st.model.state.layers, a = st.land.cell ** 2, own = layersFor(BIOMES[st.landscape]);
  layerBox.replaceChildren(...kindsShown().map(k => {
   const rough = k === 'rough', m = L.masks.get(k), n = rough ? L.codes.reduce((t, c) => t + (c ? 0 : 1), 0) : m ? m.reduce((t, v) => t + v, 0) : 0;
   const col = rough ? hex(BIOMES[st.landscape].rough ?? '#5f7f3f') : COLOUR[k] ?? [128, 128, 128], ha = `${(n * a / 1e4).toFixed(2)} ha`;
   return el('li', {class: (k === st.kind ? 'cb-cur' : '') + (n ? '' : ' cb-empty'), 'data-layer': k, style: 'display:flex;gap:6px;align-items:center;cursor:pointer;padding:2px 0', onclick: () => { st.kind = k; const sel = panel.querySelector('.cb-kind'); if (sel) sel.value = k; layersList(); showHint(); }},
    rough ? el('span', {style: 'width:52px;flex:none'}) : el('button', {class: 'cb-btn', type: 'button', 'data-eye': k, style: 'padding:2px 6px;font-size:11px;width:52px;flex:none', onclick: e => { e.stopPropagation(); st.model.setHidden(k, !L.hidden.has(k)); paintCodes(); layersList(); }}, L.hidden.has(k) ? 'hidden' : 'shown'),
    el('span', {class: 'cb-swatch', style: `background:rgb(${col.join(',')})`}), el('span', {style: 'flex:1'}, LABEL(k) + (rough || own.includes(k) ? '' : ' (not this landscape\'s)')),
    el('small', {}, rough ? `${ha}, under no layer` : n ? ha : 'empty'));
  }));
 }
 const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
 function fillOutsideNow() {
  if (!st.boundary) return say('Draw the boundary first, or fetch OpenStreetMap\'s.', true);
  const bio = BIOMES[st.landscape], ground = outsideGround(bio), density = outsideTrees(st.landscape);
  setBusy('Filling outside the boundary…');
  try {
   const n = st.model.fillOutside(st.boundary, {ground, density, seed: st.model.state.undo.length + 1});
   paintCodes(); refreshCount(); plan.draw();
   say(`Outside the boundary: ${ground ? LABEL(ground).toLowerCase() : 'rough'} and ${n.toLocaleString()} trees (${density} a hectare, thinning in from the line). Past the land the game's landscape carries on, as round a generated course. Undo takes it back.`);
  } finally { setBusy(''); }
 }
 function extrapolateNow() {
  const from = st.kind, to = st.exTo;
  if (from === 'rough' || !st.model.state.layers.masks.get(from)?.some(v => v)) return say(`Pick a layer with something on it to extrapolate from; ${LABEL(from).toLowerCase()} has nothing.`, true);
  if (to === from) return say('Pick another layer to lay round it.', true);
  st.model.extrapolate({from, to, width: st.exWidth}); paintCodes(); refreshCount();
  say(`${LABEL(to)} laid ${st.exWidth} m round the ${LABEL(from).toLowerCase()}. Undo takes it back.`);
 }
 const refreshCount = () => { if (!st.model) return; layersList(); const n = new Map(); for (const c of st.model.state.codes) n.set(c, (n.get(c) || 0) + 1); const a = st.land.cell ** 2; countText.textContent = [...n].filter(([c]) => c).sort((p, q) => q[1] - p[1]).slice(0, 6).map(([c, v]) => `${LABEL(PALETTE[c])} ${(v * a / 1e4).toFixed(2)} ha`).join(' · ') + ` · ${st.model.state.trees.length.toLocaleString()} trees · ${st.model.state.homes.length} house${st.model.state.homes.length === 1 ? '' : 's'}`; };
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
  const keyIn = el('input', {type: 'password', placeholder: 'Your key (kept in this browser only)', autocomplete: 'off'}), terms = el('small'), howTo = el('details', {class: 'cb-howto'});
  const showProv = () => { const p = PROVIDERS[prov.value]; keyIn.hidden = !!p.free; keyIn.value = keys[prov.value] || ''; terms.textContent = `${p.free ? '' : p.keyHelp + ' '}${p.terms}`; howTo.hidden = !p.howTo; howTo.replaceChildren(el('summary', {}, `How to get a ${p.name} key`), el('ol', {}, (p.howTo ?? []).map(t => el('li', {}, t)))); };
  prov.onchange = showProv; showProv();
  const place = el('input', {placeholder: 'A place: the survey does not say where it is'}), found = el('ul');
  const tools = [['move', 'Move the view'], ['brush', 'Paint brush'], ['erase', 'Erase brush'], ['eraseAll', 'Erase all layers'], ['outline', 'Outline fill'], ['smooth', 'Smooth brush'], ['tree', 'Tree'], ['treeZone', 'Tree zone'], ['treeErase', 'Clear trees'], ['home', 'House'], ['homeZone', 'House zone'], ['homeErase', 'Clear houses'], ['shape', 'Move shape'], ['turnShape', 'Turn shape']];
  toolButtons = tools.map(([k, t]) => el('button', {class: 'cb-btn' + (st.tool === k ? ' cb-on' : ''), type: 'button', 'data-tool': k, onclick: () => setTool(k)}, t));
  // LOCK AND UNLOCK (the owner, 1 November 2026: "drag the satellite picture
  // to align and lock/unlock it"): unlocked, a left drag or the arrow keys
  // move the picture; locked -- as it starts, and as any other tool leaves it
  // -- nothing moves it.
  const alignBtn = el('button', {class: 'cb-btn' + (st.tool === 'align' ? ' cb-on' : ''), type: 'button', 'data-tool': 'align', onclick: () => {
   if (!st.picLocked) { setTool(st.model ? st.traceTool ?? 'brush' : 'move'); return say(`The picture is locked, ${Math.hypot(st.offset.x, st.offset.z).toFixed(2)} m from where its position put it.`); }
   if (!st.pics.length || st.picShow === 'lidar') return say(st.pics.length ? 'Show a fetched picture or a file first (Showing): the LIDAR\'s own needs no lining up.' : 'Bring a picture with a position first.', true);
   st.picLocked = false; setTool('align'); say('Unlocked: drag the picture into line with the LIDAR -- see-through, or the LIDAR over it, makes it easier (Viewing, below).');
  }}, st.picLocked ? 'Unlock the picture' : 'Lock the picture');
  toolButtons.push(alignBtn);
  const pct = (key, after) => el('input', {type: 'range', min: 0, max: 100, value: Math.round(st[key] * 100), 'data-alpha': key, oninput: e => { st[key] = +e.target.value / 100; viewLayers(); after?.(); }});
  return [
   el('div', {class: 'cb-field'}, el('label', {}, 'A picture to trace over'),
    el('small', {}, 'Fetched for this land and placed by itself, or a file. If it sits off, unlock it and drag it into line with the LIDAR, then lock it. It is never saved in the course.'),
    prov, keyIn, howTo, terms,
    el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => fetchImagery(prov.value, keyIn.value.trim(), keys)}, 'Fetch imagery for this land'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: choosePicture}, 'A picture file'), el('button', {class: 'cb-btn', type: 'button', onclick: useLidarColour}, 'The LIDAR\'s own'),
     alignBtn, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.offset = {x: 0, z: 0}; relay(); showHint(); }}, 'Back to its position')),
    st.pics.length ? el('small', {}, 'Showing (every picture fetched or brought is kept, each with its own lining up)') : null,
    st.pics.length ? el('select', {class: 'cb-picshow', onchange: e => showPic(e.target.value)}, [...new Map(st.pics.map(p => [p.group, p.label])), ['lidar', 'The LIDAR\'s own']].map(([g, label]) => el('option', {value: g, selected: g === st.picShow}, label + (g === 'files' ? ` (${st.pics.filter(p => p.group === 'files').length})` : '')))) : null,
    ll ? null : el('div', {class: 'cb-row', style: 'margin:4px 0'}, place, el('button', {class: 'cb-btn', type: 'button', onclick: () => searchPlace(prov.value, keyIn.value.trim(), place.value, found)}, 'Find')), found),
   // THE LIDAR AND THE PICTURE TOGETHER (the owner, 1 November 2026): each
   // with its own opacity, either on top.
   el('div', {class: 'cb-field cb-viewing'}, el('label', {}, 'Viewing'),
    el('small', {}, 'The LIDAR as'), el('select', {class: 'cb-lidarview', onchange: e => { st.lidarView = e.target.value; paintLidar(); }}, LIDAR_VIEWS.map(k => el('option', {value: k, selected: k === st.lidarView}, {relief: 'Shaded relief', brightness: 'The laser\'s brightness', slope: 'Slope (edges bright)'}[k]))),
    el('small', {}, 'LIDAR opacity'), pct('lidarAlpha'),
    el('small', {}, 'Picture opacity'), pct('picAlpha'),
    el('small', {}, 'Trace opacity'), pct('traceAlpha', () => plan.draw()),
    el('button', {class: 'cb-btn cb-lidartop', type: 'button', onclick: e => { st.lidarOnTop = !st.lidarOnTop; viewLayers(); e.target.textContent = st.lidarOnTop ? 'Picture on top' : 'LIDAR on top'; }}, st.lidarOnTop ? 'Picture on top' : 'LIDAR on top')),
   // OPENSTREETMAP FIRST (the owner, 1 November 2026): the course as mappers
   // have drawn it, kept as it is or refined from the picture or the LIDAR.
   el('div', {class: 'cb-field'}, el('label', {}, 'OpenStreetMap'),
    el('small', {}, 'Many courses are already drawn in OpenStreetMap: its greens, fairways, tees, bunkers, water, paths, woods and numbered holes, laid as layers and markers. Credited in the course (ODbL). Goes online only when pressed.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => loadOsm()}, 'Fetch OpenStreetMap'), el('button', {class: 'cb-btn', type: 'button', onclick: () => loadOsm(true)}, 'An OpenStreetMap file')),
    st.osm ? el('small', {}, st.osm.said) : null,
    st.osm ? el('div', {class: 'cb-btns'},
     el('button', {class: 'cb-btn', type: 'button', onclick: () => refineOsm('picture')}, 'Refine with the picture'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => refineOsm('lidar')}, 'Refine with the LIDAR'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => keepOsm()}, 'Keep it as drawn')) : null,
    st.osm ? el('small', {}, 'Refining lines the map up with the ground (LIDAR) or the picture by its bunkers, ponds and greens -- OpenStreetMap is often a metre or three off -- and adds clear greens it left out; its shapes are kept as drawn. With a survey, Refine with the LIDAR is the recommended path.') : null),
   el('div', {class: 'cb-field'}, el('label', {}, 'Trace the course'),
    el('small', {}, 'Auto: greens, tees, fairways, sand and water found for you to correct. Manual: draw them yourself. The same tools either way.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: autoTrace}, st.traceMode === 'auto' ? 'Auto trace again' : 'Auto trace'), el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: manualTrace}, 'Manual trace'))),
   // THE LANDSCAPE, chosen here (the owner, 1 November 2026: "User should
   // select biome in the tracing step"): it decides which ground types the
   // layers offer, and is step 5's look.
   st.model ? el('div', {class: 'cb-field'}, el('label', {}, 'Landscape'),
    el('small', {}, 'Which ground types the layers offer -- rock and scree in the mountains, heather and native grass on a links -- and the course\'s look.'),
    el('select', {class: 'cb-landscape', onchange: e => { st.landscape = e.target.value; go(2); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === st.landscape}, BIOMES[k].name)))) : null,
   st.model ? el('div', {class: 'cb-field'}, el('label', {}, 'Tools'), el('div', {class: 'cb-btns'}, ...toolButtons.slice(0, -1)),
    el('small', {}, 'The layer you paint, outline, erase and smooth (Rough takes every layer off)'), el('select', {class: 'cb-kind', onchange: e => { st.kind = e.target.value; layersList(); showHint(); }}, kindsShown().map(k => el('option', {value: k, selected: k === st.kind}, LABEL(k)))),
    el('small', {}, 'Layers, top first: one higher in the list shows over one lower (sand painted on rough or fairway is sand). The eye hides one from view; the course keeps it.'), layerBox,
    el('small', {}, 'Extrapolate: lay a layer round the one picked above, a width out -- semi-rough round a fairway. (The game mows a fringe round every green by itself.)'),
    el('div', {class: 'cb-btns'}, el('select', {class: 'cb-exto', onchange: e => { st.exTo = e.target.value; }}, kindsShown().filter(k => k !== 'rough').map(k => el('option', {value: k, selected: k === st.exTo}, LABEL(k)))),
     el('input', {type: 'number', class: 'cb-exwidth', min: .5, max: 40, step: .5, value: st.exWidth, title: 'metres', oninput: e => { st.exWidth = +e.target.value || 4; }})),
    el('button', {class: 'cb-btn', type: 'button', onclick: extrapolateNow}, 'Extrapolate'),
    el('small', {}, 'Brush size (metres round)'), el('input', {type: 'range', min: 1, max: 40, value: st.size, oninput: e => { st.size = +e.target.value; showHint(); plan.draw(); }}),
    el('small', {}, 'A tree\'s height, and a zone\'s trees a hectare'),
    el('div', {class: 'cb-btns'}, el('input', {type: 'number', min: 3, max: 60, value: st.treeH, oninput: e => { st.treeH = +e.target.value || 15; }}), el('input', {type: 'number', min: 10, max: 600, value: st.density, oninput: e => { st.density = +e.target.value || 120; }})),
    el('small', {}, 'Outline and Tree zone: click the corners; double-click or Enter closes, Esc drops.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.smooth({radius: 1.5}); paintCodes(); refreshCount(); }}, 'Smooth all edges'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.tidy(); paintCodes(); refreshCount(); }}, 'Tidy specks'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.undo(); paintCodes(); refreshCount(); plan.draw(); }}, 'Undo'), el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.redo(); paintCodes(); refreshCount(); plan.draw(); }}, 'Redo'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.picOn = st.picOn === false; plan.showLayer('picture', st.picOn); }}, 'Picture on/off'), el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.traceOn = !st.traceOn; showCodes(); }}, 'Trace on/off'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.smoothView = !st.smoothView; if (st.smoothView) buildVec(); else { st.vec = null; showCodes(); } say(st.smoothView ? 'Smooth view: the trace drawn as the course will have it.' : 'Cell view: the trace\'s cells as painted.'); }}, 'Smooth / cell view')),
    countText) : null,
   // THE COURSE BOUNDARY (the owner, 1 November 2026).
   st.model ? el('div', {class: 'cb-field'}, el('label', {}, 'Course boundary'),
    el('small', {}, st.boundary ? `Set: ${(ringArea(st.boundary) / 1e4).toFixed(1)} ha (the dashed line). Fill outside it: every surface there comes off, the landscape's ground and a wood go in, thinning in from the line; the survey's trees stay. Past the land the game's landscape carries on.` : 'Draw a line round the course (OpenStreetMap\'s comes with its outlines when it has one). Outside it becomes the landscape\'s ground and wood -- the neighbours\' gardens and roads gone.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn' + (st.tool === 'boundary' ? ' cb-on' : ''), type: 'button', 'data-tool': 'boundary', onclick: () => setTool('boundary')}, st.boundary ? 'Draw it again' : 'Draw the boundary'),
     el('button', {class: 'cb-btn', type: 'button', disabled: !st.boundary, onclick: fillOutsideNow}, 'Fill outside it'))) : null,
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
   // Fetched once a session for this provider and place: asked again (the
   // land rebuilt, door 2 opened again), it comes from memory, not the network.
   const cacheKey = `${key}:${[box.lon0, box.lon1, box.lat0, box.lat1].map(v => v.toFixed(5)).join(',')}`, kept = IMAGERY.get(cacheKey);
   const pic = kept ?? await mosaic(await p.start(apiKey), box, {onProgress: f => setBusy(`Fetching ${p.name} imagery… ${Math.round(f * 100)}%`)});
   IMAGERY.set(cacheKey, pic);
   st.pics = st.pics.filter(q => q.group !== key).concat([{group: key, label: p.name, pic, provider: key, toPixel: (x, z) => { const g = ll(x, z); return pic.toPixel(g.lon, g.lat); }}]);
   if (!st.credits.includes(pic.credit)) st.credits.push(pic.credit);
   showPic(key, {offset: {x: 0, z: 0}});
   say(`${p.name}: ${pic.width} x ${pic.height} pixels at zoom ${pic.z}${pic.missing ? `, ${pic.missing} tiles missing` : ''}, ${kept ? 'kept from earlier -- nothing downloaded' : 'sized and placed by position'}. If it sits off, unlock it and drag it into line with the LIDAR.`);
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
 // EVERY PICTURE KEPT (the owner, 1 November 2026: "once the google/bing/usgs
 // images are downloaded. if the user changes modes keep the images"): each
 // provider's, the files placed by position (tiles filling each other's
 // gaps) and one matched by points are kept side by side as groups, each
 // with its own drag into line; one is shown -- or the LIDAR's own -- and
 // switching back fetches nothing.
 function showPic(group, {offset = null, render = true} = {}) {
  if (st.picShow && st.picShow !== 'lidar') st.picOffsets[st.picShow] = st.offset;
  st.picShow = group; st.offset = offset ?? st.picOffsets[group] ?? {x: 0, z: 0};
  relay(); if (render && st.step === 2) go(2);
 }
 function relay() {
  if (st.picShow === 'lidar') return lidarPicture();
  let picture = null;
  for (const p of st.pics.filter(q => q.group === st.picShow)) picture = pictureOnLand(st.land, st.gridder, p.pic, {affine: (x, z) => p.toPixel(x - st.offset.x, z - st.offset.z), into: picture});
  st.picture = picture; paintPicture();
 }
 function lidarPicture() {
  const {land} = st, N = land.nx * land.nz, rgb = new Uint8Array(N * 3), has = new Uint8Array(N);
  for (let k = 0; k < N; k++) { if (land.rgb) { rgb.set(land.rgb.subarray(k * 3, k * 3 + 3), k * 3); has[k] = land.rgb[k * 3] || land.rgb[k * 3 + 1] ? 1 : 0; } else if (Number.isFinite(land.intensity[k])) { const v = Math.round(land.intensity[k] * 255); rgb[k * 3] = rgb[k * 3 + 1] = rgb[k * 3 + 2] = v; has[k] = 1; } }
  st.picture = {rgb, nir: null, has, fromLidar: true, colour: !!land.rgb}; paintPicture();
 }
 function useLidarColour() {
  showPic('lidar');
  say((st.land.rgb ? 'The survey\'s own colour.' : 'The laser\'s brightness: sand and paths bright, water dark.') + (st.pics.length ? ' The fetched pictures are kept: pick one under Showing.' : ''));
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
    st.pics.push({group: 'files', label: 'Picture files', file: main.name, pic, toPixel: (x, z) => { const m = st.gridder.map(x, z), q = conv(m.x, m.y); return [(q.x - pic.x0) / pic.dx, (q.y - pic.y0) / pic.dy]; }});
    showPic('files');
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
   if (st.align.pairs.length >= 3) { try { const fit = affineFromPairs(st.align.pairs); st.pics = st.pics.filter(q => q.group !== 'matched').concat([{group: 'matched', label: 'Matched by points', pic, toPixel: fit.map}]); showPic('matched', {offset: {x: 0, z: 0}, render: false}); say(`Lined up from ${st.align.pairs.length} points: the worst ${fit.worst.toFixed(1)} m off. Add points, or unlock it and drag it.`); } catch (er) { say(er.message, true); } }
   else say(`${st.align.pairs.length} of 3: click the next point on the land.`);
   plan.draw();
  });
  panel.append(pc);
 }
 // Local metres from degrees: by the survey's map grid, or round the place found.
 const localOfLonLat = () => {
  const crs = crsOfSources(st.sources), conv = crs?.epsg ? converter({epsg: 4326, geographic: true}, crs) : null;
  if (conv) return (lat, lon) => { const m = conv(lon, lat); return st.gridder.local(m.x, m.y); };
  if (st.geo) return (lat, lon) => ({x: (lon - st.geo.lon) * 111320 * Math.cos(st.geo.lat * Math.PI / 180), z: -(lat - st.geo.lat) * 111320});
  return null;
 };
 async function loadOsm(fromFile = false) {
  if (!st.land) return;
  const toLocal = localOfLonLat(), ll = lonLatOfLocal();
  if (!toLocal || !ll) return say('The survey does not say where it is: find the place first.', true);
  setBusy(fromFile ? 'Reading the OpenStreetMap file…' : 'Asking OpenStreetMap…');
  try {
   let json;
   if (fromFile) { const [file] = await pickFile('.json,application/json'); if (!file) return; json = JSON.parse(await file.text()); }
   else { const {halfX, halfZ} = st.land, c = [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]].map(([x, z]) => ll(x, z)); json = await fetchOsm([Math.min(...c.map(p => p.lon)), Math.min(...c.map(p => p.lat)), Math.max(...c.map(p => p.lon)), Math.max(...c.map(p => p.lat))]); }
   const feats = osmFeatures(json, toLocal), edge = osmBoundary(json, toLocal);
   if (edge) st.boundary = edge;
   st.model = createTrace(st.land, {trees: []}); st.traceMode = 'openstreetmap';
   const laid = layOsm(st.model, feats);
   // The LIDAR's trees where the map has none of its own.
   if (!laid.trees && !laid.woods) for (const t of st.trees) st.model.state.trees.push({...t});
   st.model.state.undo.length = 0;
   const holes = osmHoles(feats);
   if (holes.filter(Boolean).length) { st.holes = holes.map(h => h ? {tees: h.tees, aims: h.aims, green: h.green} : undefined); st.holesN = holes.length > 9 ? 18 : 9; }
   if (!st.credits.includes(OSM_CREDIT)) st.credits.push(OSM_CREDIT);
   st.osm = {codes: Uint8Array.from(st.model.state.codes), trees: st.model.state.trees.map(t => ({...t})), homes: st.model.state.homes.map(h => ({...h})), said: `Laid: ${Object.entries(laid).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing -- this course is not drawn in OpenStreetMap'}; ${holes.filter(Boolean).length} holes numbered${edge ? '; the course boundary' : ''}.`};
   paintCodes(); st.traceTool = 'brush'; go(2); refreshCount();
   say(st.osm.said);
  } catch (e) { say('OpenStreetMap: ' + e.message, true); }
  finally { setBusy(''); }
 }
 function keepOsm() { if (!st.osm) return; st.model = createTrace(st.land, {codes: st.osm.codes, trees: st.osm.trees, homes: st.osm.homes}); st.traceMode = 'openstreetmap'; paintCodes(); go(2); refreshCount(); say('OpenStreetMap\'s trace, as drawn: correct it with the tools, then the holes.'); }
 async function refineOsm(mode) {
  if (!st.osm) return;
  if (mode === 'picture' && !st.picture) return say('Bring a picture first.', true);
  setBusy('Refining…'); await frame();
  try {
   const codes = refineTrace(st.land, st.osm.codes, {picture: st.picture, mode});
   st.model = createTrace(st.land, {codes, trees: st.osm.trees, homes: st.osm.homes}); st.traceMode = 'openstreetmap+' + mode;
   paintCodes(); go(2); refreshCount();
   const sh = refineTrace.lastShift;
   say(`Refined from the ${mode === 'picture' ? 'picture' : 'LIDAR'}${sh ? `: the map moved ${Math.hypot(sh.x, sh.z).toFixed(1)} m to line up` : ''}. Keep it as drawn puts OpenStreetMap's back.`);
  } finally { setBusy(''); }
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
   el('small', {}, 'Name'), el('input', {class: 'cb-name', value: st.name, maxlength: 60, oninput: e => { st.name = e.target.value; refreshSave(); }}),
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
   const doc = st.doc = validateDoc(docFromLand({land: st.land, traced: {layers: st.model.state.layers}, holes, trees: st.model.state.trees, homes: st.model.state.homes, name: st.name.trim() || 'My real course', landscape: st.landscape, credits: st.credits,
    source: {files: st.sources.map(s => s.name), epsg: crsOfSources(st.sources)?.epsg ?? null, origin: {x: st.gridder.center.x, y: st.gridder.center.y}, trace: st.traceMode, picture: st.picShow === 'lidar' ? 'lidar' : st.picture ? 'placed' : 'none'}}));
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
 // SAVE FROM ANY STEP (the owner, 1 November 2026): door 2 saves a draft
 // (draft.js) that opens back here at the same step; the playable course is
 // saved from the editor. Pictures are not in it, but each one's lining up is.
 const snapshot = () => ({step: st.step, name: st.name, landscape: st.landscape, credits: st.credits, holes: st.holes, holesN: st.holesN, hole: st.hole, boundary: st.boundary, traceMode: st.traceMode, box: st.box,
  sources: st.sources.map(s => ({name: s.name, crs: s.kind === 'points' ? s.crs : s.raster?.crs ?? s.crs ?? null})),
  view: {lidarView: st.lidarView, lidarAlpha: st.lidarAlpha, picAlpha: st.picAlpha, traceAlpha: st.traceAlpha, lidarOnTop: st.lidarOnTop, smoothView: st.smoothView},
  picOffsets: {...st.picOffsets, ...(st.picShow && st.picShow !== 'lidar' ? {[st.picShow]: st.offset} : {})}, osm: st.osm, trees: st.trees, land: st.land,
  trace: st.model ? {masks: st.model.state.layers.masks, hidden: [...st.model.state.layers.hidden], trees: st.model.state.trees, homes: st.model.state.homes} : null});
 setSaver({key: `door2-${++opened}`, name: () => st.name, file: () => fileName(st.name).replace(/\.fairway$/, DRAFT_EXT), bytes: () => writeDraft(snapshot()),
  said: (r, bytes) => r.how === 'failed' ? say('Could not save: ' + r.error.message, true) : say(`${r.how === 'overwrite' ? 'Saved again to' : 'Saved as'} ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB): a draft that opens back at this step (Open a course file). The playable course is saved from the editor.`)});
 if (draft) restore(draft);
 else { go(0); say('Start with the LIDAR files.'); }

 function restore(d) {
  // The LIDAR files are not in a draft: stand-ins carry their names and map
  // grid, so the place is known (imagery, OpenStreetMap); building the land
  // anew needs the files again.
  Object.assign(st, {name: d.name, landscape: d.landscape, credits: d.credits ?? [], holes: d.holes ?? [], holesN: d.holesN ?? 18, hole: d.hole ?? 0, boundary: d.boundary, traceMode: d.traceMode, box: d.box,
   sources: (d.sources ?? []).map(s => ({name: s.name, kind: 'points', crs: s.crs, restored: true})), picOffsets: d.picOffsets ?? {}, trees: d.trees ?? [], ...(d.view ?? {})});
  if (d.land) {
   const L = d.land, u = L.unit ?? {h: 1, v: 1};
   st.land = L;
   st.gridder = createGridder({box: {x0: L.center.x - L.halfX / u.h, x1: L.center.x + L.halfX / u.h, y0: L.center.y - L.halfZ / u.h, y1: L.center.y + L.halfZ / u.h}, cell: L.cell, unit: u});
   if (d.osm?.codes) st.osm = d.osm;
   if (d.trace) {
    st.model = createTrace(st.land, {trees: d.trace.trees, homes: d.trace.homes});
    const Ls = st.model.state.layers;
    for (const [k, m] of d.trace.masks) Ls.mask(k, true).set(m);
    for (const k of d.trace.hidden ?? []) Ls.hidden.add(k);
    Ls.recompose();
   }
   paintRelief();
  }
  setTitle('Real life course');
  go(Math.min(d.step ?? 0, st.land ? (st.model ? 5 : 2) : 0));
  if (st.step === 5 && !can(5)) go(st.model ? 3 : 2);
  say(`Opened the draft "${d.name}" at step ${st.step + 1}. ${st.land ? 'The land and the trace are as saved; pictures are fetched or brought again (each keeps its lining up).' : 'Bring the LIDAR files again to build the land.'}`);
 }
}
let opened = 0;   // each door 2 opened is its own piece of work for Save
let downloadsDir = null;   // the folder the browser downloads to, once picked (viaDownloads)
