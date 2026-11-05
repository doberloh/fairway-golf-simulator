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
import {fromEditor} from './round-trip.js';
import {preview} from './preview.js';
import {coverOptions, coverByKey, COVER_RANGE} from './cover.js';
import {cornersOf} from './layer-ops.js';
import {fileName} from '../course-file.js';
import {openSource, formOf} from '../lidar/formats.js';
import {readGeoTiffRgb} from '../lidar/geotiff.js';
import {converter} from '../lidar/geo.js';
import {crsOf, toMetres, parseHeader} from '../lidar/las.js';
import {createGridder} from '../lidar/land.js';
import {trace, refineTrace} from '../lidar/trace.js';
import {fetchOsm, osmFeatures, layOsm, osmBoundary, mergeTrees, OSM_CREDIT} from './osm.js';
import {osmCourses, osmHoles, shiftHoles, fitHoles} from './osm-course.js';
import {sourceBox, sourcesBox, crsOfSources, landFromSources, pictureOnLand, affineFromPairs, docFromLand, layerRings, lidarTexels, coverage, parFor, LIDAR_VIEWS, MAX_PROPERTY} from './real-course.js';
import {createTrace, PALETTE, SPECK, POCK} from './trace-edit.js';
import {LAYER_ORDER, layersFor, tidyMask} from './layers.js';
import {PROVIDERS, providersAt, mosaic} from './imagery.js';
import {sourcesAt, squareAround, searchLidar, downloadLidar, isEptZip, eptZipSource, gridByName, coverFor, coverTogether, tilesOf} from './lidar-search.js';
import {coverageWords, percent} from './lidar-coverage.js';
import {canPick, recallFolder, pickFolder, allowed, fileIn, bytesIn, saveIn, saveAsDownload, listIn, overPlace, removeIn} from './lidar-folder.js';
import {readZip} from '../zip.js';
import {createPlanView} from './plan-view.js';
import {validateDoc} from '../course-doc.js';
import {BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {GROUNDS} from '../grounds.js';
import {openEditor} from './editor.js';
import {worldFromDoc, builtLine, GRID_MARGIN} from '../built-world.js';
import {createEditor} from './editing.js';
import {checkCourse} from './checks.js';
import {clearTrees} from './tree-clear.js';
import {regionOf, LANDSCAPES} from '../regions.js';
import {landscapeAt} from '../landscape-map.js';
import {US_SHAPES} from '../us-map-data.js';
import {landscapeMap} from '../ui-map.js';

const {el} = ui;
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const hex = h => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const OWN = {fairway: [70, 170, 60], semi: [150, 200, 100], tee: [120, 220, 150], green: [150, 245, 150], sand: [245, 228, 175], water: [60, 120, 220], path: [210, 205, 195]};
const COLOUR = Object.fromEntries(PALETTE.map(k => [k, k === 'rough' ? null : OWN[k] ?? hex(GROUNDS[k]?.map ?? '#888888')]));
const LABEL = k => ({rough: 'Rough', fairway: 'Fairway', semi: 'Semi-rough', tee: 'Tee', green: 'Green', sand: 'Sand', water: 'Water', path: 'Cart path'})[k] ?? GROUNDS[k]?.label ?? k;
// What a ZIP may hold that door 2 reads (a portal's notes and READMEs left out).
const LIDAR_IN_ZIP = /\.(las|laz|e57|ply|pts|ptx|xyz|tif|tiff|asc|flt|bil|hgt|prj|hdr)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i, WORLD = /\.(pgw|jgw|tfw|wld|j2w|bpw|gfw)$/i;
// OUTSIDE THE BOUNDARY (the owner, 1 November 2026): the landscape's own
// floor -- what falls under its trees, its desert floor, its native grass --
// or rough; and a wood as thick as the landscape grows one: 150 trees a
// hectare where needles or leaves fall, 15 on a links, a desert or an island,
// 80 elsewhere (PLACED: by eye against the generated courses' edges).
const outsideGround = bio => bio.fallen?.kind ?? bio.landform?.kinds?.floor ?? (['native', 'heather'].includes(bio.landform?.kinds?.a) ? bio.landform.kinds.a : null);
const outsideTrees = key => BIOMES[key].fallen ? 150 : ['links', 'desert', 'florida'].includes(regionOf(key)) ? 15 : 80;
const MARK_NAME = {back: 'back tee', middle: 'middle tee', front: 'front tee', aim: 'aim point', green: 'green'};
const STEPS = ['1 LIDAR', '2 Land', '3 Trace', '4 Holes', '5 Name', '6 Review'];
const KEYS = 'fairway-builder-imagery-keys';
// Imagery fetched this session, by provider and place (fetchImagery): kept
// across door 2's steps, the land rebuilt and door 2 opened again.
const IMAGERY = new Map();
const BRUSHES = ['brush', 'erase', 'eraseAll', 'smooth', 'treeErase', 'homeErase', 'cover', 'coverErase', 'treeBrush'];

export function open(draft = null) {
 setTitle('Real life course');
 const st = {step: 0, sources: [], preview: null, box: null, land: null, gridder: null, trees: [], pics: [], offset: {x: 0, z: 0}, picture: null, geo: null,
  model: null, traceMode: null, tool: 'move', kind: 'fairway', size: 4, outline: [], hover: null, holes: [], hole: 0, holesN: 18, mark: 'back',
  name: 'My real course', landscape: 'heartland', credits: [], align: null, smoothView: true, traceOn: true, vec: null, boundary: null, exTo: 'semi', exWidth: 4,
  chosen: null, carry: null, sizing: null, treeScale: 1, cover: 'rocks', coverThick: .5, coverSizes: Object.fromEntries(Object.entries(COVER_RANGE).map(([k, r]) => [k, {min: r.from[0], max: r.from[1]}])), picShow: null, picOffsets: {}, landEdits: null, creeks: [], rocks: [], lidarView: 'relief', lidarAlpha: 1, picAlpha: 1, traceAlpha: 120 / 255, lidarOnTop: false, picLocked: true};
 window.fairwayBuilder.door2 = st;
 const canvas = el('canvas', {class: 'cb-plan'});
 const notes = el('div', {class: 'cb-note', style: 'text-align:left;padding:6px 10px;max-width:none'});
 const say = (t, err = false) => { notes.textContent = t; notes.classList.toggle('cb-err', err); };
 const zoomText = el('span'), hintBar = el('div', {class: 'cb-toolhint', hidden: true});
 const plan = createPlanView(canvas, {onTool, overlay, onWindowChange: ui.onWindowChange});
 st.plan = plan;
 st.toCanvas = (x, z) => plan.toScreen(x, z);
 const panel = el('div', {style: 'display:flex;flex-direction:column;gap:10px'}), nav = el('div', {class: 'cb-stepnav'});
 const section = el('section', {class: 'cb-door2'},
  el('div', {class: 'cb-steps'}, el('h2', {style: 'font:800 22px/1 var(--head);text-transform:uppercase;margin:0'}, 'A real life course'), nav, panel),
  el('div', {class: 'cb-planbox'}, canvas, hintBar,
   el('div', {class: 'cb-planbar'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.zoomBy(1.5)}, 'Zoom in'), el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.zoomBy(1 / 1.5)}, 'Zoom out'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => plan.fit()}, 'Whole land'), el('span', {}, 'Wheel zooms; right-drag, Space-drag or Move the view drags it.'), zoomText),
   notes));
 show(section);
 preview().mount(section.querySelector('.cb-planbox'));
 // THE MODEL OF WHAT THE TOOL PAINTS OR PLACES (preview.js; the owner, 4
 // November 2026), for the trace's tools; the other steps show none.
 // The cover in hand, or the landscape's first if it does not offer that one.
 const coverNow = () => { const o = coverOptions(BIOMES[st.landscape]); return o.find(c => c.key === st.cover) ?? o[0]; };
 const showModel = () => {
  const item = st.step === 2 ? ({brush: {kind: 'surface', surface: st.kind}, outline: {kind: 'surface', surface: st.kind}, tree: {kind: 'tree'}, treeZone: {kind: 'tree'}, home: {kind: 'house'}, homeZone: {kind: 'house'}, creek: {kind: 'creek'}, bunker: {kind: 'bunker'}, cover: {kind: 'cover', cover: coverNow().key, ...st.coverSizes[coverNow().key]}, treeBrush: {kind: 'cover', cover: 'trees', ...st.coverSizes.trees}})[st.tool] ?? null : null;
  preview().show(item, st.landscape);
 };
 // Back to the builder's start ends this course, so with work in it, it asks
 // twice (the owner, 1 November 2026: a double confirm on fully closing).
 const backButton = () => el('button', {class: 'cb-btn', type: 'button', onclick: () => {
  if (st.sources.length || st.land) {
   if (!confirm('Leave this course and go back to the builder\'s start?')) return;
   if (!confirm('Are you sure? What is not saved (Save keeps a draft) is lost.')) return;
  }
  home();
 }}, 'Back');
 topTools(backButton());
 const L = () => st.land ?? st.preview?.land;

 // ---------------------------------------------------------------- layers
 function paintRelief() {
  const land = L(); if (!land) return;
  plan.setLand(land);
  paintLidar(); paintCoverage(); viewLayers(); paintPicture(); paintCodes();
 }
 // WHERE THE FILES REACH, yellow over the relief at step 1 (the owner, 1
 // November 2026: "When loading LIDAR files in step 1. Show the coverage of
 // the files in highlighted yellow"): every cell near one a point or height
 // landed in (real-course.js coverage); each file's own box is outlined over
 // it (overlay).
 function paintCoverage() {
  const land = L(); if (!land?.noReturns) return plan.clearLayer('coverage');
  const on = coverage(land);
  plan.setLayer('coverage', d => { for (let k = 0; k < on.length; k++) if (on[k]) { d[4 * k] = 253; d[4 * k + 1] = 224; d[4 * k + 2] = 71; d[4 * k + 3] = 110; } });
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
    tree: `Place tree: click to stand a ${st.treeH} m tree (not on mown ground, sand, water or a path).`,
    treeBrush: `Tree brush: drag to scatter the landscape's trees (${r} m round), from ${st.coverSizes.trees.min.toFixed(1)} to ${st.coverSizes.trees.max.toFixed(1)} m tall.`,
    sizeTree: st.sizing ? 'Size it with This tree; click another to pick it.' : 'Size a tree: click a tree, then size it with This tree.',
    creek: st.outline.length ? `Draw a creek: ${st.outline.length} point${st.outline.length === 1 ? '' : 's'}; double-click or Enter ends it. Its channel is cut when the course is made.` : 'Draw a creek: click along it from its head to its foot.',
    bunker: `Dig a bunker: click to dig one ${r} m round; sand, and a hollow when the course is made.`,
    select: st.carry?.hold ? (st.carry.turn ? `Turning the ${st.chosen.what}: ${Math.round(st.carry.angle * 180 / Math.PI)} degrees; let go to set it.` : `Moving the ${st.chosen.what}: let go where it belongs. Undo puts it back.`) : st.chosen ? `${st.chosen.what[0].toUpperCase() + st.chosen.what.slice(1)} selected: drag inside the outline to move it${st.chosen.corners.length ? ', or an anchor to turn it' : ''}.` : `Select shape: click a green, bunker, fairway, pond, tree or house -- the ${k} layer where it lies.`,
    treeZone: st.outline.length ? `Tree zone: ${corners(st.outline.length)}` : `Tree zone: click round the zone, corner by corner; it fills with ${st.density} trees a hectare.`,
    boundary: st.outline.length ? `Course boundary: ${corners(st.outline.length)}` : 'Course boundary: click round the course, corner by corner; outside it becomes the landscape\'s wood.',
    home: 'House: click to stand a house; it faces the nearest fairway, green or tee.',
    homeZone: st.outline.length ? `House zone: ${corners(st.outline.length)}` : 'House zone: click round a street or estate, corner by corner; houses line it 42 m apart, each facing the course.',
    homeErase: `Clear houses: drag to take houses off (${r} m round).`,
    cover: `Ground cover, ${coverNow().label.toLowerCase()}: drag over open ground (${r} m round), from ${st.coverSizes[coverNow().key].min.toFixed(1)} to ${st.coverSizes[coverNow().key].max.toFixed(1)} m. Not on turf, sand, water, paths or roads.`,
    coverErase: `Clear cover: drag to take rocks and low plants off (${r} m round). Trees stay.`,
    treeErase: `Clear trees: drag to take trees off (${r} m round).`,
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
  if (st.step === 0 && st.preview) {
   // Each file's box in yellow with its name, the property in white.
   const g = st.land ? st.gridder : st.preview.gridder, rect = b => { const a = g.local(b.x0, b.y1), c = g.local(b.x1, b.y0), [ax, ay] = p.toScreen(a.x, a.z), [cx, cy] = p.toScreen(c.x, c.z); return [ax, ay, cx - ax, cy - ay]; };
   ctx.strokeStyle = 'rgba(253,224,71,.95)'; ctx.fillStyle = '#fde047'; ctx.lineWidth = 1.5 * px; ctx.font = `600 ${11 * px}px system-ui`;
   for (const src of st.sources) { if (!src.bounds && !src.raster) continue; const [x, y, w, h] = rect(sourceBox(src)); ctx.strokeRect(x, y, w, h); if (w > 80 * px) ctx.fillText(src.name.length > 40 ? src.name.slice(0, 38) + '…' : src.name, x + 4 * px, y + 13 * px); }
   if (st.box) { const [x, y, w, h] = rect(st.box); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4 * px; ctx.strokeRect(x, y, w, h); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * px; ctx.strokeRect(x, y, w, h); }
  }
  // Trees: their crowns when near enough to see, dots when not.
  const trees = st.model?.state.trees ?? st.trees;
  if (st.land && trees.length) {
   ctx.strokeStyle = 'rgba(20,70,30,.9)'; ctx.fillStyle = 'rgba(40,110,50,.45)'; ctx.lineWidth = px;
   for (const t of trees) { const [x, y] = p.toScreen(t.x, t.z), r = Math.max(1.5 * px, t.crown * st.treeScale * p.view.scale); if (x < -r || y < -r || x > ctx.canvas.width + r || y > ctx.canvas.height + r) continue; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); if (r > 3 * px) ctx.stroke(); }
  }
  // Rocks painted as ground cover: grey, at their size.
  const rocks = st.model?.state.rocks;
  if (st.land && rocks?.length) {
   ctx.fillStyle = 'rgba(150,146,138,.9)'; ctx.strokeStyle = 'rgba(40,38,34,.9)'; ctx.lineWidth = px;
   for (const q of rocks) { const [x, y] = p.toScreen(q[0], q[1]), r = Math.max(1.5 * px, q[2] / 2 * p.view.scale); if (x < -r || y < -r || x > ctx.canvas.width + r || y > ctx.canvas.height + r) continue; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); }
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
  // Creeks drawn here, as lines (the course cuts them when it is made), and
  // bunkers dug.
  for (const c of st.model?.state.creekLines ?? []) { ctx.strokeStyle = 'rgba(60,120,220,.95)'; ctx.lineWidth = Math.max(2 * px, c.width * p.view.scale); ctx.beginPath(); c.points.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); q ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); }
  // WHAT IS SELECTED, as in the 3D editor: its outline and anchors, and while it
  // is carried a filled picture of it, turned and moved.
  if (st.chosen) {
   const {rings, mid, corners} = st.chosen, c = st.carry, dx = c?.dx ?? 0, dz = c?.dz ?? 0, a = c?.angle ?? 0, co = Math.cos(a), sn = Math.sin(a);
   const at = ([x, z]) => { const u = x - mid.x, v = z - mid.z; return p.toScreen(mid.x + u * co - v * sn + dx, mid.z + u * sn + v * co + dz); };
   ctx.strokeStyle = '#fde68a'; ctx.fillStyle = 'rgba(253,230,138,.3)'; ctx.lineWidth = 2 * px; ctx.beginPath();
   for (const r of rings) { r.forEach((q, n) => { const [sx, sy] = at(q); if (n) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); }
   if (c?.hold) ctx.fill('evenodd');
   ctx.stroke();
   ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3b2f10'; ctx.lineWidth = px;
   for (const q of corners) { const [sx, sy] = at(q), h = 6 * px; ctx.beginPath(); ctx.rect(sx - h, sy - h, 2 * h, 2 * h); ctx.fill(); ctx.stroke(); }
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
    if (type === 'down') { m.beginStroke(); st.coverAt = null; }
    if (type === 'down' || type === 'drag') {
     if (t === 'cover' || t === 'treeBrush') {
      // A dab each half a brush along, as in the 3D editor.
      if (!st.coverAt || Math.hypot(p.x - st.coverAt.x, p.z - st.coverAt.z) >= Math.max(1.5, st.size * .5)) { const c = t === 'cover' ? coverNow() : coverByKey(BIOMES[st.landscape], 'trees'); m.paintCover({cover: c, x: p.x, z: p.z, radius: st.size, density: st.coverThick, ...st.coverSizes[c.key]}); st.coverAt = p; }
     }
     else if (t === 'coverErase') m.clearCover({x: p.x, z: p.z, radius: st.size});
     else if (t === 'brush') m.paint({x: p.x, z: p.z, radius: st.size, kind: st.kind});
     else if (t === 'erase') m.erase({x: p.x, z: p.z, radius: st.size, kind: st.kind === 'rough' ? null : st.kind});
     else if (t === 'eraseAll') m.erase({x: p.x, z: p.z, radius: st.size});
     else if (t === 'smooth') m.smooth({x: p.x, z: p.z, radius: Math.max(1, st.size / 3), area: st.size});
     else if (t === 'homeErase') m.removeHomes({x: p.x, z: p.z, radius: st.size});
     else m.removeTrees({x: p.x, z: p.z, radius: st.size});
     if (t !== 'treeErase' && t !== 'homeErase' && t !== 'cover' && t !== 'coverErase' && t !== 'treeBrush') patchCodes(p.x, p.z, st.size + 2);
    }
    if (type === 'up') { m.endStroke(); refreshCount(); }
    plan.draw(); return;
   }
   if (t === 'outline' || t === 'treeZone' || t === 'boundary' || t === 'homeZone' || t === 'creek') {
    if (type === 'down') st.outline.push([p.x, p.z]);
    if (type === 'double' && st.outline.length >= (t === 'creek' ? 2 : 3)) closeOutline();
    plan.draw(); return;
   }
   // SELECT SHAPE, as in the 3D editor (the owner, 4 November 2026): the first
   // click selects and outlines; a drag inside moves, a drag on an anchor turns,
   // following the pointer; what lay under it shows while it is carried.
   if (t === 'select') {
    if (type === 'down') {
     const c = st.chosen, near = c ? c.corners.findIndex(([x, z]) => { const [ax, ay] = plan.toScreen(x, z), [bx, by] = plan.toScreen(p.x, p.z); return Math.hypot(ax - bx, ay - by) <= 11 * plan.px; }) : -1;
     if (c && (near >= 0 || onChosen(p))) st.carry = {turn: near >= 0, from: p, a0: Math.atan2(p.x - c.mid.x, p.z - c.mid.z), dx: 0, dz: 0, angle: 0, hold: null};
     else { chooseShape(m.pickAt({x: p.x, z: p.z, kind: st.kind})); if (!st.chosen) say('Nothing to select there: only rough under the pointer.'); }
    }
    if (type === 'drag' && st.carry) {
     const c = st.carry;
     if (!c.hold && Math.hypot(p.x - c.from.x, p.z - c.from.z) >= .3) { c.hold = m.hold(st.chosen.pick); if (st.chosen.pick.type === 'shape') paintCodes(); }
     if (c.hold) {
      if (c.turn) c.angle = c.a0 - Math.atan2(p.x - st.chosen.mid.x, p.z - st.chosen.mid.z);
      else { c.dx = p.x - c.from.x; c.dz = p.z - c.from.z; }
      c.hold.set(c.dx, c.dz, c.angle); showHint();
     }
    }
    if (type === 'up' && st.carry) {
     const {hold, dx, dz, angle} = st.carry, what = st.chosen.what; st.carry = null;
     if (hold) { const got = hold.drop(dx, dz, angle); if (st.chosen.pick.type === 'shape') paintCodes(); refreshCount(); chooseShape(got); if (dx || dz || angle) say(`The ${what} ${angle ? `turned ${Math.round(angle * 180 / Math.PI)} degrees` : `moved ${Math.hypot(dx, dz).toFixed(1)} m`}. Undo puts it back.`); }
     showHint();
    }
    plan.draw(); return;
   }
   if (t === 'sizeTree' && type === 'down') {
    const pick = m.pickAt({x: p.x, z: p.z});
    if (pick?.type !== 'tree') { st.sizing = null; say('No tree there: click on a tree\'s crown.'); }
    else { st.sizing = {index: pick.index, base: {...m.state.trees[pick.index]}, started: false}; say('Size it with This tree; Undo puts it back.'); }
    const slider = panel.querySelector('.cb-onetree'); if (slider) { slider.value = 1; slider.disabled = !st.sizing; }
    plan.draw(); return;
   }
   if (t === 'bunker' && type === 'down') { m.digBunker({x: p.x, z: p.z, radius: Math.max(2, st.size)}); patchCodes(p.x, p.z, st.size + 2); refreshCount(); plan.draw(); return; }
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
  if (st.tool === 'creek') { if (ring.length >= 2) { st.model.addCreekLine({points: ring, width: Math.max(1.5, Math.min(12, st.size / 2))}); refreshCount(); plan.draw(); } return; }
  if (ring.length < 3) return;
  if (st.tool === 'boundary') { st.boundary = ring; say(`The course boundary: ${(ringArea(ring) / 1e4).toFixed(1)} ha. Fill outside it when it is right.`); setTool('move'); go(2); return; }
  if (st.tool === 'homeZone') { const n = st.model.homeZone(ring, {seed: st.model.state.undo.length + 1}); say(n ? `${n} house${n === 1 ? '' : 's'} in the zone, each facing the nearest fairway, green or tee.` : 'No house fits there: each needs open ground all round it.', !n); refreshCount(); plan.draw(); return; }
  if (st.tool === 'treeZone') { st.model.treeZone(ring, {density: st.density, seed: st.model.state.undo.length + 1}); say(`Trees: ${st.model.state.trees.length.toLocaleString()} in all.`); }
  else { st.model.fill([ring], st.kind); paintCodes(); }
  refreshCount(); plan.draw();
 }
 const onKey = e => {
  if (!document.body.contains(canvas)) return;   // door 2 not shown (the editor over it, or another door): kept, as it may come back
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'Enter' && st.outline.length >= (st.tool === 'creek' ? 2 : 3)) closeOutline();
  if (e.key === 'Escape') { st.outline = []; chooseShape(null); plan.draw(); }
  // The unlocked picture nudged: a quarter metre a press, a metre with Shift.
  const nudge = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (nudge && st.step === 2 && st.tool === 'align' && !st.picLocked) { e.preventDefault(); const s = e.shiftKey ? 1 : .25; st.offset = {x: st.offset.x + nudge[0] * s, z: st.offset.z + nudge[1] * s}; relay(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && st.model) { e.preventDefault(); st.chosen = st.sizing = null; if (e.shiftKey) st.model.redo(); else st.model.undo(); paintCodes(); refreshCount(); plan.draw(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && st.model) { e.preventDefault(); st.chosen = st.sizing = null; st.model.redo(); paintCodes(); refreshCount(); plan.draw(); }
 };
 window.addEventListener('keydown', onKey);

 // ----------------------------------------------------------------- steps
 const steps = [stepLidar, stepLand, stepTrace, stepHoles, stepName, stepReview];
 const can = n => n === 0 || (n === 1 && (!!st.preview || !!st.land)) || (n >= 2 && !!st.land && (n < 3 || !!st.model) && (n < 4 || st.holes.slice(0, st.holesN).every(h => h?.green && h.tees.length)) && (n !== 2 || true));
 function go(n) {
  if (!can(n)) return;
  st.step = n; st.outline = [];
  if (n !== 5) { plan.clearLayer('course'); st.doc = null; }
  plan.showLayer('picture', n !== 5 && st.picOn !== false); plan.showLayer('coverage', n === 0); showCodes();
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
 const toolSet = (title, keys) => el('div', {class: 'cb-toolset'}, title ? el('b', {}, title) : null, el('div', {class: 'cb-btns'}, ...toolButtons.filter(b => keys.includes(b.dataset.tool))));
 const toolOption = (keys, ...nodes) => el('div', {class: 'cb-toolopt', 'data-for': keys.join(' ')}, ...nodes);
 function showToolOptions() { for (const n of panel.querySelectorAll('[data-for]')) n.hidden = !n.dataset.for.split(' ').includes(st.tool); st.coverPut?.(); }
 // What is selected, with its outline and anchors. A tree is round: no anchors.
 function chooseShape(pick) {
  if (!pick) { st.chosen = null; return; }
  const {nx, nz, cell, halfX, halfZ} = st.land, m = st.model.state;
  let rings, mid, what;
  if (pick.type === 'shape') {
   const mask = new Uint8Array(nx * nz); let sx = 0, sz = 0;
   for (const k of pick.cells) { mask[k] = 1; sx += -halfX + (k % nx) * cell; sz += -halfZ + Math.floor(k / nx) * cell; }
   rings = layerRings(mask, st.land).sort((a, b) => b.length - a.length); mid = {x: sx / pick.cells.length, z: sz / pick.cells.length}; what = LABEL(pick.kind).toLowerCase();
  } else if (pick.type === 'home') {
   const h = m.homes[pick.index], c = Math.cos(h.rotation), sn = Math.sin(h.rotation), a = h.width / 2, b = h.depth / 2;
   rings = [[[-a, -b], [a, -b], [a, b], [-a, b]].map(([u, v]) => [h.x + u * c + v * sn, h.z - u * sn + v * c])]; mid = {x: h.x, z: h.z}; what = 'house';
  } else {
   const t = m.trees[pick.index], r = Math.max(1.5, t.crown * st.treeScale);
   rings = [Array.from({length: 24}, (_, k) => [t.x + Math.cos(k / 24 * Math.PI * 2) * r, t.z + Math.sin(k / 24 * Math.PI * 2) * r])]; mid = {x: t.x, z: t.z}; what = 'tree';
  }
  if (!rings.length) { st.chosen = null; return; }
  st.chosen = {pick, rings, mid, what, corners: pick.type === 'tree' ? [] : cornersOf(rings[0]), cells: pick.type === 'shape' ? new Set(pick.cells) : null};
 }
 function onChosen(p) {
  const c = st.chosen, {nx, nz, cell, halfX, halfZ} = st.land;
  if (c.cells) { const i = Math.round((p.x + halfX) / cell), j = Math.round((p.z + halfZ) / cell); return i >= 0 && j >= 0 && i < nx && j < nz && c.cells.has(j * nx + i); }
  const g = st.model.pickAt({x: p.x, z: p.z}); return g?.type === c.pick.type && g.index === c.pick.index;
 }
 // SKIN FROM THE LAND, as the 3D editor's (trace-edit.js skin): the ground as it
 // stands, what the 3D editor shaped included.
 function skinLand() {
  say('Reading the land…');
  setTimeout(() => {
   const g = st.landEdits ? Float32Array.from(st.land.ground, (v, k) => v + st.landEdits[k]) : st.land.ground, got = st.model.skin({bio: BIOMES[st.landscape], ground: g}), name = k => LABEL(k).toLowerCase();
   paintCodes(); refreshCount(); plan.draw();
   say(got.cells.face || got.cells.apron ? `Skinned from the land: ${name(got.kinds.face)} on the steep ground${got.kinds.apron ? `, ${name(got.kinds.apron)} below it` : ''}. Paint over it or Undo.` : 'Nothing here is steep enough to skin; paint the ground by hand instead.');
  }, 40);
 }
 // GROUND COVER (cover.js): what to lay, its two sizes and how thick. The
 // sliders push each other along and follow the cover chosen.
 function coverControls() {
  const minText = el('span'), maxText = el('span'), keyNow = () => st.tool === 'treeBrush' ? 'trees' : coverNow().key;
  const put = () => { const c = st.coverSizes[keyNow()], r = COVER_RANGE[keyNow()]; for (const [input, text, v] of [[minIn, minText, c.min], [maxIn, maxText, c.max]]) { input.min = r.low; input.max = r.high; input.step = r.high > 10 ? .5 : .1; input.value = v; text.textContent = ` ${v.toFixed(1)} m`; } };
  st.coverPut = () => put();
  const size = which => el('input', {type: 'range', step: .1, class: `cb-cover${which}`, oninput: e => {
   const c = st.coverSizes[keyNow()], v = +e.target.value; c[which] = v; if (c.min > c.max) c[which === 'min' ? 'max' : 'min'] = v;
   put(); showHint(); showModel();
  }});
  const minIn = size('min'), maxIn = size('max');
  put();
  return [toolOption(['cover'], el('small', {}, 'Ground cover: what the brush lays'),
   el('select', {class: 'cb-coverkind', style: 'width:100%', onchange: e => { st.cover = e.target.value; put(); showHint(); setTool('cover'); }}, coverOptions(BIOMES[st.landscape]).map(c => el('option', {value: c.key, selected: c.key === coverNow().key}, c.label)))),
   toolOption(['cover', 'treeBrush'], el('small', {}, 'Smallest', minText), minIn, el('small', {}, 'Largest', maxText), maxIn,
    el('small', {}, 'How thick it lies'), el('input', {type: 'range', min: .05, max: 1, step: .05, value: st.coverThick, oninput: e => { st.coverThick = +e.target.value; }}))];
 }
 const next = (n, text) => el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => { if (can(n)) go(n); else say(n === 4 ? 'Every hole needs a tee and a green.' : 'Finish this step first.', true); }}, text);
 let toolButtons = [];
 // The picture is unlocked only while the Align tool is held: any other tool
 // locks it again, so a brush stroke never drags it.
 function setTool(t) {
  if (t !== 'align') st.picLocked = true;
  if (t !== 'select') { st.chosen = null; st.carry = null; }
  if (t !== 'sizeTree') st.sizing = null;
  st.tool = t; if (st.step === 2 && t !== 'align') st.traceTool = t; plan.setTool(t === 'move' ? 'move' : 'draw'); st.outline = [];
  toolButtons.forEach(b => b.classList.toggle('cb-on', b.dataset.tool === t));
  showModel(); showToolOptions();
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
  const place = el('input', {class: 'cb-lidarplace', placeholder: 'A course or a place, by name', value: st.find?.label ?? '', onkeydown: e => { if (e.key === 'Enter') findPlace(place.value); }}), size = el('select', {class: 'cb-lidarsize', title: 'How much ground round the place to search and download'}, [1000, 1500, 2000, 3000].map(m => el('option', {value: m, selected: m === (st.findSize ?? 1500)}, `${m / 1000} km square`)));
  size.onchange = () => { st.findSize = +size.value; };
  return el('div', {class: 'cb-field'}, el('label', {}, 'Find LIDAR'),
   el('small', {}, 'Search by name, pick the place, then search every source that covers it: USGS 3DEP, IGN LiDAR HD and swisstopo download here; state and national portals open in a new tab. Goes online only when pressed.'),
   el('div', {class: 'cb-row', style: 'margin:4px 0'}, place, el('button', {class: 'cb-btn', type: 'button', title: 'Look the name up (the National Map\'s place search)', onclick: () => findPlace(place.value)}, 'Find')), findList,
   el('div', {class: 'cb-btns'}, size, el('button', {class: 'cb-btn cb-hot', type: 'button', disabled: !st.find, 'data-find': 'search', title: st.find ? `Ask every source that covers ${st.find.label} what it holds there` : 'Find a place and pick it first', onclick: () => searchAll()}, 'Search for LIDAR')), findOut);
 }
 async function findPlace(text) {
  if (!text.trim()) return;
  try {
   const r = await PROVIDERS.usgs.search(null, text);
   resultList(findList, r, f => { st.find = f; findList.replaceChildren(); go(0); say(`${f.label}: search for LIDAR round it.`); });
   if (!r.length) say('Nothing found by that name.', true);
  } catch (e) { say('The search failed: ' + e.message, true); }
 }
 // What is in the LIDAR folder, without asking for leave: a search must not
 // open a prompt. Name -> size; empty until the folder is open this visit.
 async function savedInFolder() {
  if (!lidarFolder) return new Map();
  try { if (!await allowed(lidarFolder)) return new Map(); return new Map((await listIn(lidarFolder, 0)).map(e => [e.name, e.file.size])); } catch { return new Map(); }
 }
 // The square as a small map, north up: green saved, gold to download, dark
 // nothing there.
 function coverMap({n, grid}) {
  const c = el('canvas', {class: 'cb-covermap', width: n, height: n, title: 'The square, north up: green is saved, gold would download, dark has no data'}), g = c.getContext('2d');
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = ['#3a1c1c', '#c9a227', '#3fae6a'][grid[j * n + i]]; g.fillRect(i, n - 1 - j, 1, 1); }
  return c;
 }
 async function searchAll() {
  if (!st.find) return;
  const box = squareAround(st.find.lon, st.find.lat, st.findSize ?? 1500), here = sourcesAt(st.find.lon, st.find.lat);
  st.findBox = box; findOut.replaceChildren(el('small', {}, 'Searching…'));
  const rows = [], everything = [], km = (st.findSize ?? 1500) / 1000, saved = await savedInFolder();
  for (const s of here.filter(s => s.online)) {
   try {
    const found = await searchLidar(s.key, box);
    everything.push(...found);
    rows.push(el('div', {class: 'cb-field', style: 'padding:6px'}, el('label', {}, s.name), el('small', {}, s.licence),
     found.length ? el('ul', {}, found.map(f => {
      // HOW MUCH THIS SURVEY COVERS, AND WHAT IS ALREADY SAVED, before anything
      // is downloaded (the owner, 5 November 2026; lidar-coverage.js).
      const c = coverFor(f, box, saved), left = c.tiles - c.tilesSaved, whole = c.known && c.share >= .995;
      const squareWord = !s.key.startsWith('usgs') ? (c.tilesSaved ? (left ? `Download ${left} missing tile${left === 1 ? '' : 's'}` : 'Load the saved tiles') : 'Download here') : c.heldShare ? (c.heldShare >= c.share ? 'Load the saved square' : 'Download what is missing') : 'Download the square here';
      const tileWord = c.tilesSaved ? (left ? `Download ${left} missing tile${left === 1 ? '' : 's'}` : 'Load the saved tiles') : 'Download all tiles';
      return el('li', {}, `${f.title}${f.date ? ', ' + String(f.date).slice(0, 10) : ''}: ${f.tiles ? `${f.tiles} tile${f.tiles === 1 ? '' : 's'}` : 'its square copy only'}${f.bytes ? `, ${(f.bytes / 1e6).toFixed(0)} MB as tiles` : f.points ? `, ${(f.points / 1e6).toFixed(1)} M points` : ''} `,
       c.known ? el('div', {class: 'cb-cover'}, coverMap(c), el('small', {class: whole ? '' : 'cb-coverwarn'}, coverageWords(c, km), c.tiles ? ` ${c.tilesSaved} of ${c.tiles} tile${c.tiles === 1 ? '' : 's'} saved.` : '', c.cut ? ' The search stopped at 200 tiles, so there may be more.' : '')) : el('small', {}, 'How much of the square it covers is not known: its source does not say.'),
       el('div', {class: 'cb-btns'}, f.ept || s.key !== 'usgs' ? el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-download': f.id, title: s.key === 'usgs' ? 'Only the survey\'s points over the square that are not already saved -- combined with them in your LIDAR folder' : 'Every tile over the square that is not already saved -- to your LIDAR folder', onclick: () => fetchLidar(f)}, squareWord) : el('small', {}, 'No copy that downloads by the square yet.'),
        f.tileUrls?.length ? el('button', {class: 'cb-btn', type: 'button', 'data-rocky': f.id, title: `USGS's own LAZ tiles, whole (${(f.bytes / 1e6).toFixed(0)} MB): your browser downloads those not already saved, and the builder reads them from your LIDAR folder`, onclick: () => viaDownloads(f)}, tileWord) : null));
     })) : el('small', {}, 'Nothing over this square.')));
   } catch (e) { rows.push(el('small', {class: 'cb-err'}, `${s.name}: ${e.message}`)); }
  }
  // Can the square be covered at all, by every survey together?
  if (everything.some(f => tilesOf(f).some(t => t.box) || f.polys?.length)) { const all = percent(coverTogether(everything, box).share); rows.unshift(el('small', {class: all < 100 ? 'cb-coverwarn' : ''}, all === 100 ? `These surveys cover all of the ${km} km square.` : `Together these surveys cover ${all}% of the ${km} km square. If the course runs past that, it has no LIDAR here, or another source below holds it.`)); }
  const links = here.filter(s => s.link);
  // A portal opened: what to do with what it gives (the owner, 1 November
  // 2026: "builder needs to tell the user to put the files in the folder
  // once they are done downloading").
  const portalOpened = s => say(`${s.name} opened in a new tab. When its download finishes, put the files -- a ZIP is fine, the builder unpacks it -- in your LIDAR folder${lidarFolder ? ` (${lidarFolder.name})` : ''}, then press Load from the folder.`);
  if (links.length) rows.push(el('div', {class: 'cb-field', style: 'padding:6px'}, el('label', {}, 'Also covering this place'), el('ul', {}, links.map(s => el('li', {}, el('a', {href: s.at?.(st.find.lon, st.find.lat) ?? s.link, target: '_blank', rel: 'noopener', title: s.at ? 'Opens the portal on this place' : 'Opens the portal\'s own page', onclick: () => portalOpened(s)}, s.name), s.note ? ` -- ${s.note}` : '')))));
  findOut.replaceChildren(...rows);
 }
 // A list of places found, each a button (the owner, 1 November 2026: "Make
 // it clear the results can be clicked").
 function resultList(list, found, pick) {
  list.replaceChildren(...(found.length ? [el('li', {class: 'cb-resulthead'}, `${found.length} found -- click one to use it:`)] : []),
   ...found.map(f => el('li', {}, el('button', {class: 'cb-btn cb-result', type: 'button', title: `Use ${f.label}`, onclick: () => pick(f)}, el('span', {}, f.label), el('span', {class: 'cb-resultgo'}, 'Use ›')))));
 }
 st.resultList = resultList;

 // THE LIDAR FOLDER (lidar-folder.js): picked once, remembered, every
 // download saved there and read back from there.
 const folderText = el('small', {class: 'cb-foldername'}), folderList = el('div', {class: 'cb-folderlist'});
 const showFolder = () => { folderText.textContent = !canPick() ? 'This browser cannot pick a folder (Chrome and Edge can): each download is saved to its download folder; bring them back with Choose LIDAR files.' : lidarFolder ? `Saving to, and reading from: ${lidarFolder.name}` : 'None chosen yet: the builder asks for one the first time it downloads.'; };
 showFolder(); recallFolder().then(d => { if (d && !lidarFolder) { lidarFolder = d; showFolder(); } });
 // The folder, with leave to use it (asked inside a press). Null where the
 // browser cannot pick one, or the player says no.
 async function ensureFolder() {
  if (!canPick()) return null;
  if (lidarFolder) { try { if (await allowed(lidarFolder, true)) return lidarFolder; } catch { /* asked outside a press */ } return null; }
  try { lidarFolder = await pickFolder(); showFolder(); return lidarFolder; } catch { return null; }
 }
 function folderField() {
  return el('div', {class: 'cb-field'}, el('label', {}, 'Your LIDAR folder'),
   el('small', {}, 'Every LIDAR the builder downloads is saved here as it arrives, and read from here instead of downloaded again. USGS\'s whole tiles and the state portals\' files come through your browser\'s own download folder, so Downloads is the easy choice; any other folder works if you move them in.'),
   folderText,
   canPick() ? el('div', {class: 'cb-btns'},
    el('button', {class: 'cb-btn', type: 'button', title: 'Pick the folder downloads are saved to and read from (remembered next time)', onclick: async () => { try { lidarFolder = await pickFolder(); showFolder(); say(`Your LIDAR folder is ${lidarFolder.name}.`); } catch { /* closed */ } }}, lidarFolder ? 'Change the folder' : 'Choose the folder'),
    el('button', {class: 'cb-btn', type: 'button', 'data-folder': 'load', title: 'List the LIDAR files in the folder, ticking those over the place searched for', onclick: () => loadFromFolder()}, 'Load from the folder')) : null,
   folderList);
 }
 async function loadFromFolder() {
  const dir = await ensureFolder(); if (!dir) return say('No LIDAR folder to read: choose one first.', true);
  setBusy('Reading your LIDAR folder…');
  try {
   const all = await listIn(dir), side = all.filter(e => /\.(prj|hdr)$/i.test(e.name));
   const toDegrees = crs => { if (!crs?.epsg && !crs?.wkt) return null; try { return converter(crs, {epsg: 4326, geographic: true}); } catch { return null; } };
   const rows = [];
   for (const e of all.filter(e => !/\.(prj|hdr)$/i.test(e.name))) rows.push({e, over: st.findBox ? await overPlace(e, st.findBox, {parseHeader, toDegrees}) : null});
   if (!rows.length) { folderList.replaceChildren(el('small', {}, 'No LIDAR files in it yet.')); return; }
   const ticks = rows.map(r => el('input', {type: 'checkbox', checked: r.over === true}));
   folderList.replaceChildren(el('small', {}, st.findBox ? 'Ticked: those over the place searched for.' : 'Tick the files to load.'),
    el('ul', {class: 'cb-folderfiles', style: 'list-style:none;padding:0;margin:4px 0'}, rows.map((r, q) => el('li', {}, el('label', {style: 'display:flex;gap:6px;align-items:center;cursor:pointer'}, ticks[q],
     el('span', {}, `${r.e.path} (${(r.e.file.size / 1e6).toFixed(0)} MB)${r.over === true ? ' -- over this place' : r.over === false ? ' -- elsewhere' : ''}`))))),
    el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-folder': 'read', title: 'Read the ticked files (and any .prj or .hdr beside them)', onclick: async () => {
     const pick = rows.filter((r, q) => ticks[q].checked).map(r => r.e);
     if (!pick.length) return say('Tick a file first.', true);
     const bases = new Set(pick.map(e => e.path.replace(/\.[^.]+$/, '').toLowerCase()));
     folderList.replaceChildren();
     await readFiles([...pick, ...side.filter(e => bases.has(e.path.replace(/\.[^.]+$/, '').toLowerCase()))].map(e => e.file));
    }}, 'Load the ticked'));
  } finally { setBusy(''); }
 }
 // Each download written to the folder (or, with none, saved the browser's
 // way): never kept only in the page. Returns the names written.
 async function keepAll(got, dir) {
  const done = new Set();
  for (const s of got) {
   if (!s.keep || done.has(s.keep.name)) { delete s.keep; continue; }
   setBusy(`Saving ${s.keep.name} to your ${dir ? 'LIDAR' : 'download'} folder…`);
   if (dir) await saveIn(dir, s.keep.name, s.keep.bytes); else saveAsDownload(s.keep.name, s.keep.bytes);
   // The squares combined into it go, once it is there whole.
   if (dir && s.keep.replaces?.length && await fileIn(dir, s.keep.name, s.keep.bytes.length)) for (const n of s.keep.replaces) await removeIn(dir, n);
   done.add(s.keep.name); delete s.keep;
  }
  return [...done];
 }
 const keptSaid = (names, dir) => names.length ? `Saved to ${dir ? `your LIDAR folder (${dir.name})` : 'your browser\'s download folder'}: ${names.join(', ')}. ` : '';
 async function fetchLidar(found) {
  const dir = await ensureFolder();
  setBusy('Downloading the LIDAR…');
  try {
   const lazModule = await (await import('../lidar/laz.js')).lazModule();
   // The square and the land built past it (GRID_MARGIN each side).
   const wide = squareAround(st.find.lon, st.find.lat, (st.findSize ?? 1500) + 2 * GRID_MARGIN);
   const got = await downloadLidar(found, wide, {lazModule, kept: name => bytesIn(dir, name), list: async () => dir ? (await listIn(dir, 0)).map(e => e.name) : [], onProgress: (f, what) => setBusy(`Downloading the LIDAR… ${what} (${Math.round(f * 100)}%)`)});
   const names = await keepAll(got, dir);
   for (const src of got) { st.sources.push(src); fileList.append(el('li', {}, `${src.name}: ${src.kept ? `read from your LIDAR folder (${src.keptAs}), nothing downloaded` : src.reused ? `${src.fetched} piece${src.fetched === 1 ? '' : 's'} downloaded, ${src.reused} already saved, combined` : 'downloaded'}, ${src.count.toLocaleString()} points${src.bytes ? `, ${(src.bytes / 1e6).toFixed(0)} MB` : ''}`)); }
   await previewLand(st.findBox);
   say(`${keptSaid(names, dir)}${got.every(s => s.kept) ? 'Read from your LIDAR folder: nothing downloaded. ' : ''}Drag a box on the relief round the course, then build the land.`);
  } catch (e) { say('Could not download it: ' + e.message, true); }
  finally { setBusy(''); }
 }
 // ROCKYWEB'S WHOLE TILES (the owner, 1 November 2026: "figure out how to
 // gain access to rockyweb for LIDAR. there has to be a way"). Rockyweb lets
 // no page read it (no Access-Control-Allow-Origin; its preflight answers
 // 405), but a browser DOWNLOADS from it like any site. So the tiles are
 // downloaded as files, a few seconds apart (rockyweb answers 429 to a rush),
 // into the browser's download folder, and read from the LIDAR folder as each
 // arrives there -- at once when the LIDAR folder is Downloads, or when the
 // player moves them in. Tiles already in the LIDAR folder are not
 // downloaded again. First, Fairway's bridge if it is running (the launch
 // monitor's helper, bridge/server.mjs `/lidar`): it fetches rockyweb for the
 // page, and the tiles are written to the LIDAR folder.
 async function viaBridge(tiles, dir) {
  const base = 'http://127.0.0.1:1922';
  try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500); if (!(await fetch(base + '/health', {signal: ctl.signal})).ok) return null; } catch { return null; }
  const lazModule = await (await import('../lidar/laz.js')).lazModule(), names = [];
  for (const [n, t] of tiles.entries()) {
   const r = await fetch(`${base}/lidar?url=${encodeURIComponent(t.url)}`);
   if (!r.ok) throw Error(`USGS would not give ${t.name} through the bridge (${r.status}).`);
   const total = +r.headers.get('content-length') || t.bytes, parts = [], reader = r.body.getReader(); let got = 0;
   for (;;) { const {done, value} = await reader.read(); if (done) break; parts.push(value); got += value.length; setBusy(`Downloading ${t.name} through Fairway's bridge (${n + 1} of ${tiles.length}): ${Math.round(100 * got / total)}%`); }
   const bytes = new Uint8Array(got); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
   const src = {...(await openSource(t.name, bytes, {lazModule})), name: t.name, downloaded: true, keep: {name: t.name, bytes}};
   names.push(...await keepAll([src], dir));
   st.sources.push(src); fileList.append(el('li', {}, `${t.name}: from USGS through the bridge, ${src.count.toLocaleString()} points`));
  }
  return names;
 }
 async function viaDownloads(found) {
  const tiles = found.tileUrls, dir = await ensureFolder(), n = tiles.length;
  const inFolder = new Map();
  for (const t of tiles) { const f = await fileIn(dir, t.name, t.bytes || null); if (f) inFolder.set(t.name, f); }
  const missing = tiles.filter(t => !inFolder.has(t.name));
  if (!missing.length) { await readFiles([...inFolder.values()]); return say(`All ${n} tile${n === 1 ? ' was' : 's were'} already in your LIDAR folder: read from there, nothing downloaded.`); }
  setBusy('Looking for Fairway\'s bridge…');
  try {
   const names = await viaBridge(missing, dir);
   if (names) { setBusy(''); if (inFolder.size) await readFiles([...inFolder.values()]); else await previewLand(st.findBox); return say(`${keptSaid(names, dir)}Drag a box on the relief round the course, then build the land.`); }
  } catch (e) { setBusy(''); return say(e.message, true); }
  setBusy('');
  for (const [q, t] of missing.entries()) {
   const a = el('a', {href: t.url, download: t.name}); document.body.append(a); a.click(); a.remove();
   say(`Downloading ${t.name} from USGS (${q + 1} of ${missing.length}, ${(t.bytes / 1e6).toFixed(0)} MB). Your browser may ask once to allow several downloads.`);
   await new Promise(r => setTimeout(r, 4000));
  }
  const where = `${missing.length} tile${missing.length === 1 ? '' : 's'} downloading from USGS into your browser's download folder`;
  if (!dir) return say(`${where}. When they finish, bring them with Choose LIDAR files.`);
  const isDownloads = /^downloads$/i.test(dir.name);
  // Each tile read once it is whole in the LIDAR folder (the browser writes
  // a .crdownload and renames it when done), for up to an hour; the page
  // stays usable meanwhile.
  const got = new Map(inFolder), t0 = Date.now();
  const tell = () => say(`${where}. ${isDownloads ? `They arrive in your LIDAR folder (${dir.name}) and are read as each finishes` : `When each finishes, put it in your LIDAR folder (${dir.name}): the builder reads it as it arrives`} -- ${got.size - inFolder.size} of ${missing.length} so far.`);
  tell();
  while (got.size < n && Date.now() - t0 < 60 * 60e3) {
   await new Promise(r => setTimeout(r, 2000));
   for (const t of missing) if (!got.has(t.name)) { const f = await fileIn(dir, t.name, t.bytes || null); if (f) { got.set(t.name, f); tell(); } }
  }
  if (got.size < n) return say(`Only ${got.size} of ${n} tiles reached your LIDAR folder (${dir.name}) within the hour. Put them there and press Load from the folder.`, true);
  await readFiles([...got.values()]);
  say(`All ${n} tiles read from your LIDAR folder (${dir.name}): they stay there for next time. Drag a box on the relief round the course, then build the land.`);
 }
 function stepLidar() {
  return [findField(), folderField(), el('div', {class: 'cb-field'}, el('label', {}, 'Load the LIDAR'),
   el('small', {}, 'LAS, LAZ, COPC, E57, PLY, PTS, PTX, XYZ/TXT/CSV points, height grids (GeoTIFF, ASCII grid, float grid with its .hdr, BIL, SRTM HGT), or a ZIP of them (a state portal\'s download). Several at once; a .prj or .hdr beside a file is read with it. Their coverage shows yellow on the relief.'),
   el('button', {class: 'cb-btn cb-hot', type: 'button', title: 'Pick LIDAR files from anywhere on this computer', onclick: chooseLand}, 'Choose LIDAR files'), fileList),
  el('div', {class: 'cb-field'}, el('label', {}, 'The property'), el('small', {}, 'Drag a box on the relief round the course with the left button (up to 3 x 3 km); 150 m past it are built too, for the land beyond. The wheel zooms; the right button or Space drags the view.'), boxText),
  next(1, 'Next: build the land')];
 }
 async function chooseLand() {
  const files = await pickFile('', true); if (!files.length) return;
  await readFiles(files);
 }
 // A ZIP's LIDAR files as files of their own (a state portal's download, a
 // swisstopo tile), each remembering the ZIP it came from; a kept USGS
 // square (lidar-search.js eptZipSource) as the source it was.
 async function unzipped(files, laz) {
  const out = [];
  for (const f of files) {
   if (!/\.zip$/i.test(f.name)) { out.push(f); continue; }
   setBusy(`Unpacking ${f.name}…`);
   const parts = await readZip(new Uint8Array(await f.arrayBuffer()));
   if (isEptZip(parts)) { const src = {...eptZipSource(parts, await laz()), kept: true, keptAs: f.name}; st.sources.push(src); fileList.append(el('li', {}, `${f.name}: a square kept from USGS, ${src.count.toLocaleString()} points`)); continue; }
   let any = false;
   for (const [path, bytes] of parts) { const name = path.split('/').pop(); if (!name || /\.zip$/i.test(name) || !LIDAR_IN_ZIP.test(name)) continue; const g = new File([bytes], name); g.zip = f.name; out.push(g); any = true; }
   if (!any) fileList.append(el('li', {class: 'cb-err'}, `${f.name}: no LIDAR files in it`));
  }
  return out;
 }
 async function readFiles(files) {
  setBusy('Reading the files…');
  try {
   let laz = null; const lazNow = async () => laz ??= await (await import('../lidar/laz.js')).lazModule();
   files = await unzipped(files, lazNow);
   const side = new Map(files.filter(f => /\.(prj|hdr)$/i.test(f.name)).map(f => [f.name.toLowerCase(), f]));
   for (const f of files) {
    if (/\.(prj|hdr)$/i.test(f.name)) continue;
    const head = new Uint8Array(await f.slice(0, 64).arrayBuffer()), form = formOf(f.name, head), base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    try {
     if (form === 'laz') await lazNow();
     const bytes = new Uint8Array(await f.arrayBuffer());
     const prj = side.get(base + '.prj') ? await side.get(base + '.prj').text() : null, hdr = side.get(base + '.hdr') ? await side.get(base + '.hdr').text() : null;
     const src = {...(await openSource(f.name, bytes, {lazModule: laz, sidecar: hdr, prj})), name: f.name, surface: /dsm|surface/i.test(f.name)};
     // A file that states no map grid, placed by its own name or its ZIP's.
     const own = src.kind === 'points' ? src.crs : src.raster?.crs, byName = gridByName(f.zip ?? '') ?? gridByName(f.name);
     if (own && !own.epsg && !own.wkt && byName) Object.assign(own, byName);
     st.sources.push(src);
     const crs = src.kind === 'points' ? src.crs : src.raster.crs;
     fileList.append(el('li', {}, `${f.zip ? f.zip + ' / ' : ''}${f.name}: ${src.form.toUpperCase()}, ${src.kind === 'points' ? src.count.toLocaleString() + ' points' : `${src.raster.width} x ${src.raster.height} heights`}, ${crs.epsg ? 'EPSG ' + crs.epsg : 'no map grid stated'}, ${crs.units.h === 'metre' && crs.units.v === 'metre' ? 'metres' : `${crs.units.h} across, ${crs.units.v} up (converted to metres)`}`));
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
   Object.assign(st, {land: r.land, gridder: r.gridder, trees: r.trees, model: null, landEdits: null, creeks: [], pics: st.pics.filter(p => p.provider || p.file), picture: null});
   suggestLandscape();
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
   return el('li', {class: (k === st.kind ? 'cb-cur' : '') + (n ? '' : ' cb-empty'), 'data-layer': k, style: 'display:flex;gap:6px;align-items:center;cursor:pointer;padding:2px 0', onclick: () => { st.kind = k; const sel = panel.querySelector('.cb-kind'); if (sel) sel.value = k; layersList(); showHint(); showModel(); }},
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
   const homes = st.model.state.homes.length, keep = !!st.outsideKeep;
   const trees0 = st.model.state.trees.length;
   const n = st.model.fillOutside(st.boundary, {ground, density, keep, seed: st.model.state.undo.length + 1}), gone = homes - st.model.state.homes.length, treesGone = trees0 - (st.model.state.trees.length - n);
   paintCodes(); refreshCount(); plan.draw();
   say(`Outside the boundary: ${keep ? 'what was there kept (OpenStreetMap\'s and yours), ' : `everything taken off first (every surface${gone ? `, ${gone} house${gone === 1 ? '' : 's'}` : ''}${treesGone ? `, ${treesGone.toLocaleString()} trees` : ''}), then `}${ground ? LABEL(ground).toLowerCase() : 'rough'}${keep ? ' on the bare ground' : ''} and ${n.toLocaleString()} trees (${density} a hectare, thinning in from the line). Past the land the game's landscape carries on, as round a generated course. Undo takes it back.`);
  } finally { setBusy(''); }
 }
 // CLEAR TREES FROM TEES AND GREENS (tree-clear.js): every crown reaching
 // over one drawn in, a tree with no room taken out; one undo step.
 function clearTurfTreesNow() {
  const {nx, nz, cell, halfX, halfZ} = st.land, N = nx * nz, mask = new Uint8Array(N), M = st.model.state.layers.masks;
  for (const k of ['green', 'tee']) { const m = M.get(k); if (m) for (let q = 0; q < N; q++) if (m[q]) mask[q] = 1; }
  if (!mask.some(v => v)) return say('No greens or tees traced yet to clear trees from.', true);
  const got = clearTrees(st.model.state.trees, {nx, nz, cell, x0: -halfX, z0: -halfZ}, mask);
  if (got.shrunk || got.removed) st.model.setTrees(got.trees);
  plan.draw(); refreshCount();
  say(got.shrunk || got.removed ? `Off the greens and tees: ${got.shrunk.toLocaleString()} crowns drawn in, ${got.removed.toLocaleString()} trees with no room taken out. Undo puts them back.` : 'No tree reaches over a green or a tee.');
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
 // THE LANDSCAPE SUGGESTED FROM WHERE THE SURVEY LIES (the US landscapes goal,
 // PLAN.md section 2): the map's landscape at the land's centre, taken as the
 // course's landscape when the land is built unless the player has already
 // chosen one. A place outside the map, or a landscape not built yet, leaves
 // the choice as it was and says so.
 const surveyPlace = () => { const ll = lonLatOfLocal(); return ll ? ll(0, 0) : null; };
 const suggestion = () => { const c = surveyPlace(); return c ? landscapeAt(US_SHAPES, c.lat, c.lon) : null; };
 const suggestLandscape = () => { const k = suggestion(); if (k && BIOME_KEYS.includes(k) && !st.landscapePicked) st.landscape = k; };
 const suggestionLine = () => {
  const k = suggestion();
  if (!k) return surveyPlace() ? 'This survey lies outside the map of the landscapes: choose the look nearest it.' : null;
  const name = LANDSCAPES[k].name;
  return BIOME_KEYS.includes(k) ? `Where the survey lies: ${name}.` : `Where the survey lies: ${name}, not built yet -- choose the look nearest it.`;
 };
 function stepTrace() {
  const ll = lonLatOfLocal(), centre = ll ? ll(0, 0) : null, offer = centre ? providersAt(centre.lon, centre.lat) : Object.keys(PROVIDERS);
  let keys = {}; try { keys = JSON.parse(localStorage.getItem(KEYS) || '{}'); } catch { /* private window */ }
  const prov = el('select', {class: 'cb-provider'}, offer.map(k => el('option', {value: k}, PROVIDERS[k].name + (PROVIDERS[k].free ? ' -- free' : ' -- your key'))));
  const keyIn = el('input', {type: 'password', placeholder: 'Your key (kept in this browser only)', autocomplete: 'off'}), terms = el('small'), howTo = el('details', {class: 'cb-howto'});
  const showProv = () => { const p = PROVIDERS[prov.value]; keyIn.hidden = !!p.free; keyIn.value = keys[prov.value] || ''; terms.textContent = `${p.free ? '' : p.keyHelp + ' '}${p.terms}`; howTo.hidden = !p.howTo; howTo.replaceChildren(el('summary', {}, `How to get a ${p.name} key`), el('ol', {}, (p.howTo ?? []).map(t => el('li', {}, t)))); };
  prov.onchange = showProv; showProv();
  const place = el('input', {placeholder: 'A place: the survey does not say where it is'}), found = el('ul');
  const tools = [['move', 'Move the view'], ['select', 'Select shape'], ['brush', 'Paint brush'], ['erase', 'Erase brush'], ['eraseAll', 'Erase all layers'], ['outline', 'Outline fill'], ['smooth', 'Smooth edges'], ['creek', 'Draw a creek'], ['bunker', 'Dig a bunker'], ['tree', 'Place tree'], ['treeBrush', 'Tree brush'], ['treeZone', 'Tree zone'], ['treeErase', 'Clear trees'], ['sizeTree', 'Size a tree'], ['cover', 'Ground cover'], ['coverErase', 'Clear cover'], ['home', 'House'], ['homeZone', 'House zone'], ['homeErase', 'Clear houses']];
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
    // WHICH COURSE (osm-course.js osmCourses): a club with two or more, each
    // its own holes and boundary.
    st.osm?.courses?.length > 1 ? el('small', {}, 'Course') : null,
    st.osm?.courses?.length > 1 ? el('select', {class: 'cb-osmcourse', style: 'width:100%', title: 'Which of the club\'s courses to build: its holes and its boundary', onchange: e => pickCourse(e.target.value)},
     st.osm.courses.map(c => el('option', {value: c.id, selected: c.id === st.osm.course}, `${c.name} (${c.holes} hole${c.holes === 1 ? '' : 's'} numbered)`))) : null,
    // WHOSE TREES (osm.js mergeTrees; the owner, 1 November 2026).
    st.osm ? el('small', {}, 'Trees') : null,
    st.osm ? el('select', {class: 'cb-treesfrom', style: 'width:100%', title: 'Which trees the course keeps: the LIDAR\'s measured trees, OpenStreetMap\'s, or both', onchange: e => treesFrom(e.target.value)},
     [['merge', 'Both: the LIDAR\'s, and OpenStreetMap\'s where it has none'], ['lidar', 'The LIDAR\'s only'], ['osm', 'OpenStreetMap\'s only']].map(([v, t]) => el('option', {value: v, selected: v === (st.treesFrom ?? 'merge')}, t))) : null,
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
    suggestionLine() ? el('small', {class: 'cb-suggest'}, suggestionLine()) : null,
    landscapeMap(document, {built: BIOME_KEYS, chosen: st.landscape, mark: (c => c && [c.lat, c.lon])(surveyPlace()), onPick: k => { st.landscape = k; st.landscapePicked = true; go(2); }}).el,
    el('select', {class: 'cb-landscape', onchange: e => { st.landscape = e.target.value; st.landscapePicked = true; go(2); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === st.landscape}, BIOMES[k].name)))) : null,
   // THE TOOLS IN SECTIONS, AND ONLY THE TOOL IN HAND'S OPTIONS (the owner, 4
   // November 2026: "This is confusing and is always showing"). A tree's height
   // and a zone's density sat as two unlabelled numbers whatever the tool. Now
   // each option has its name and shows while its tool is held (`data-for`,
   // showToolOptions); the banner over the plan says how to use the tool, so
   // the note on clicking corners went.
   st.model ? el('div', {class: 'cb-field'}, el('label', {}, 'Tools'),
    toolSet(null, ['move', 'select']), toolSet('Surfaces', ['brush', 'erase', 'eraseAll', 'outline', 'smooth']),
    el('button', {class: 'cb-btn', type: 'button', style: 'width:100%;margin-top:4px', onclick: skinLand, title: 'Paint the steep ground the landscape\'s rock and the ground below it its apron, read from the land\'s heights -- a best effort; paint over it, or Undo'}, 'Skin from the land'),
    toolSet('Water and sand', ['creek', 'bunker']), toolSet('Trees', ['tree', 'treeBrush', 'treeZone', 'treeErase', 'sizeTree']),
    toolSet('Ground cover', ['cover', 'coverErase']), toolSet('Houses', ['home', 'homeZone', 'homeErase']),
    toolOption([...BRUSHES, 'bunker', 'creek'], el('label', {class: 'cb-opt'}, 'Brush size, metres round', el('input', {type: 'range', min: 1, max: 60, value: st.size, oninput: e => { st.size = +e.target.value; showHint(); plan.draw(); }}))),
    toolOption(['tree'], el('label', {class: 'cb-opt'}, 'Tree height, metres', el('input', {type: 'number', class: 'cb-treeh', min: 3, max: 60, value: st.treeH, oninput: e => { st.treeH = +e.target.value || 15; showHint(); }}))),
    toolOption(['treeZone'], el('label', {class: 'cb-opt'}, 'Trees a hectare', el('input', {type: 'number', class: 'cb-density', min: 10, max: 600, value: st.density, oninput: e => { st.density = +e.target.value || 120; showHint(); }}))),
    ...coverControls(),
    toolOption(['tree', 'treeBrush', 'treeZone', 'treeErase', 'sizeTree'], el('label', {class: 'cb-opt'}, 'Every tree\'s size', el('input', {type: 'range', class: 'cb-treescale', min: .5, max: 2, step: .05, value: st.treeScale, title: 'Every tree on the course together', oninput: e => { st.treeScale = +e.target.value; plan.draw(); refreshSave(); }}))),
    toolOption(['sizeTree'], el('label', {class: 'cb-opt'}, 'This tree', el('input', {type: 'range', class: 'cb-onetree', min: .25, max: 3, step: .05, value: 1, disabled: !st.sizing, oninput: e => { const z = st.sizing; if (!z) return; st.model.sizeTree(z.index, z.base, +e.target.value, !z.started); z.started = true; plan.draw(); refreshSave(); }}))),
    el('small', {}, 'The layer you paint, outline, erase and smooth (Rough takes every layer off)'), el('select', {class: 'cb-kind', onchange: e => { st.kind = e.target.value; layersList(); showHint(); showModel(); }}, kindsShown().map(k => el('option', {value: k, selected: k === st.kind}, LABEL(k)))),
    el('small', {}, 'Layers, top first: one higher in the list shows over one lower (sand painted on rough or fairway is sand). The eye hides one from view; the course keeps it.'), layerBox,
    el('small', {}, 'Extrapolate: lay a layer round the one picked above, a width out -- semi-rough round a fairway. (The game mows a fringe round every green by itself.)'),
    el('div', {class: 'cb-btns'}, el('select', {class: 'cb-exto', onchange: e => { st.exTo = e.target.value; }}, kindsShown().filter(k => k !== 'rough').map(k => el('option', {value: k, selected: k === st.exTo}, LABEL(k)))),
     el('input', {type: 'number', class: 'cb-exwidth', min: .5, max: 40, step: .5, value: st.exWidth, title: 'metres', oninput: e => { st.exWidth = +e.target.value || 4; }})),
    el('button', {class: 'cb-btn', type: 'button', onclick: extrapolateNow}, 'Extrapolate'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.smooth({radius: 1.5}); paintCodes(); refreshCount(); }}, 'Smooth all edges'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.tidy(); paintCodes(); refreshCount(); }}, 'Tidy specks'),
     el('button', {class: 'cb-btn', type: 'button', onclick: clearTurfTreesNow}, 'Clear trees from tees and greens'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.chosen = st.sizing = null; st.model.undo(); paintCodes(); refreshCount(); plan.draw(); }}, 'Undo'), el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.chosen = st.sizing = null; st.model.redo(); paintCodes(); refreshCount(); plan.draw(); }}, 'Redo'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.picOn = st.picOn === false; plan.showLayer('picture', st.picOn); }}, 'Picture on/off'), el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.traceOn = !st.traceOn; showCodes(); }}, 'Trace on/off'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.smoothView = !st.smoothView; if (st.smoothView) buildVec(); else { st.vec = null; showCodes(); } say(st.smoothView ? 'Smooth view: the trace drawn as the course will have it.' : 'Cell view: the trace\'s cells as painted.'); }}, 'Smooth / cell view')),
    countText) : null,
   // THE COURSE BOUNDARY (the owner, 1 November 2026).
   st.model ? el('div', {class: 'cb-field'}, el('label', {}, 'Course boundary'),
    el('small', {}, st.boundary ? `Set: ${(ringArea(st.boundary) / 1e4).toFixed(1)} ha (the dashed line). Fill outside it: the landscape's ground and a wood go in, thinning in from the line, and what is already there -- surfaces, houses and trees, the survey's too -- is removed first or kept (the choice beside it). Past the land the game's landscape carries on.` : 'Draw a line round the course (OpenStreetMap\'s comes with its outlines when it has one). Outside it becomes the landscape\'s ground and wood; what is already there -- OpenStreetMap\'s roads, ponds and houses -- removed or kept, as you choose.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn' + (st.tool === 'boundary' ? ' cb-on' : ''), type: 'button', 'data-tool': 'boundary', onclick: () => setTool('boundary')}, st.boundary ? 'Draw it again' : 'Draw the boundary'),
     el('select', {class: 'cb-outside', title: 'What happens to the surfaces and houses already outside the line (OpenStreetMap\'s roads, ponds and buildings, or your own)', onchange: e => { st.outsideKeep = e.target.value === 'keep'; }},
      el('option', {value: 'remove', selected: !st.outsideKeep}, 'Remove everything there'), el('option', {value: 'keep', selected: !!st.outsideKeep}, 'Keep what is there')),
     el('button', {class: 'cb-btn', type: 'button', disabled: !st.boundary, title: 'Lay the landscape\'s ground and a wood outside the line; one Undo takes it back', onclick: fillOutsideNow}, 'Fill outside it'))) : null,
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
   resultList(list, r, f => { st.geo = f; say(`The land's middle is now ${f.label}. Fetch the imagery, then align it.`); go(2); });
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
   const feats = osmFeatures(json, toLocal), courses = osmCourses(json, toLocal, feats), edge = osmBoundary(json, toLocal);
   st.model = createTrace(st.land, {rocks: st.model?.state.rocks ?? st.rocks, bunkers: st.model?.state.bunkers ?? [], creekLines: st.model?.state.creekLines ?? [], trees: []}); st.traceMode = 'openstreetmap';
   const laid = layOsm(st.model, feats), osmTrees = st.model.state.trees;
   // Whose trees (osm.js mergeTrees): the LIDAR's and the map's, by the choice.
   st.model.state.trees = mergeTrees(st.trees, osmTrees, st.treesFrom ?? 'merge');
   st.model.state.undo.length = 0;
   if (!st.credits.includes(OSM_CREDIT)) st.credits.push(OSM_CREDIT);
   st.osm = {codes: Uint8Array.from(st.model.state.codes), osmTrees, trees: st.model.state.trees.map(t => ({...t})), homes: st.model.state.homes.map(h => ({...h})), feats, edge,
    courses: courses.map(c => ({id: c.id, name: c.name, holes: c.holes, rings: c.rings})), course: courses[0]?.id ?? null, shift: {x: 0, z: 0}, laid};
   const n = osmCourseHoles();
   st.osm.said = `Laid: ${Object.entries(laid).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing -- this course is not drawn in OpenStreetMap'}; ${n} holes numbered${courses.length > 1 ? ` on ${courses[0].name} (${courses.length} courses here: pick below)` : ''}${st.boundary ? '; the course boundary' : ''}.`;
   paintCodes(); st.traceTool = 'brush'; go(2); refreshCount();
   say(st.osm.said);
  } catch (e) { say('OpenStreetMap: ' + e.message, true); }
  finally { setBusy(''); }
 }
 function treesFrom(how) {
  st.treesFrom = how; if (!st.osm) return;
  const list = mergeTrees(st.trees, st.osm.osmTrees ?? [], how), was = st.model?.state.trees.length ?? 0;
  st.osm.trees = list;
  if (st.model) { st.model.setTrees(list); plan.draw(); refreshCount(); }
  say(`Trees: ${{merge: 'the LIDAR\'s, and OpenStreetMap\'s where it has none', lidar: 'the LIDAR\'s only', osm: 'OpenStreetMap\'s only'}[how]} -- ${list.length.toLocaleString()} (${st.trees.length.toLocaleString()} from the LIDAR, ${(st.osm.osmTrees ?? []).length.toLocaleString()} from OpenStreetMap; ${was.toLocaleString()} before). Undo takes it back.`);
 }
 // THE CHOSEN COURSE'S HOLES AND BOUNDARY (osm-course.js): its numbered holes
 // (hole lines, else numbered greens and the tees that fit them), moved by the
 // map's shift when it was refined, then put on the trace's greens and tees.
 // Returns how many holes. Replaces the marks only when the map numbers some.
 function osmCourseHoles() {
  // A draft keeps the map's trace, not its features (draft.js): its holes
  // stay as marked.
  const o = st.osm; if (!o?.feats) return 0;
  const c = o.courses.find(q => q.id === o.course), sh = o.shift ?? {x: 0, z: 0};
  const ring = c?.rings[0] ?? o.edge;
  st.boundary = ring ? ring.map(([x, z]) => [x + sh.x, z + sh.z]) : st.boundary;
  const raw = osmHoles(o.feats, {within: c?.rings ?? null, codes: o.codes, land: st.land});
  const holes = fitHoles(shiftHoles(raw, sh), st.model.state.codes, st.land), n = holes.filter(Boolean).length;
  // Eighteen when all eighteen are numbered; nine when 1 to 9 are and the
  // back nine is not (a club's nine with a stray number beside it).
  if (n) { st.holes = holes.map(h => h ? {tees: h.tees, aims: h.aims, green: h.green, par: h.par ?? null} : undefined); st.holesN = holes.slice(0, 18).filter(Boolean).length < 18 && holes.slice(0, 9).filter(Boolean).length === 9 ? 9 : holes.length > 9 ? 18 : 9; }
  return n;
 }
 function pickCourse(id) {
  if (!st.osm) return;
  st.osm.course = id; const n = osmCourseHoles(), c = st.osm.courses.find(q => q.id === id);
  go(2); say(`${c?.name ?? 'The course'}: ${n} holes numbered, and its boundary.`);
 }
 function keepOsm() { if (!st.osm) return; st.model = createTrace(st.land, {rocks: st.model?.state.rocks ?? st.rocks, bunkers: st.model?.state.bunkers ?? [], creekLines: st.model?.state.creekLines ?? [], codes: st.osm.codes, trees: st.osm.trees, homes: st.osm.homes}); st.traceMode = 'openstreetmap'; st.osm.shift = {x: 0, z: 0}; osmCourseHoles(); paintCodes(); go(2); refreshCount(); say('OpenStreetMap\'s trace, as drawn: correct it with the tools, then the holes.'); }
 async function refineOsm(mode) {
  if (!st.osm) return;
  if (mode === 'picture' && !st.picture) return say('Bring a picture first.', true);
  setBusy('Refining…'); await frame();
  try {
   const codes = refineTrace(st.land, st.osm.codes, {picture: st.picture, mode});
   st.model = createTrace(st.land, {rocks: st.model?.state.rocks ?? st.rocks, bunkers: st.model?.state.bunkers ?? [], creekLines: st.model?.state.creekLines ?? [], codes, trees: st.osm.trees, homes: st.osm.homes}); st.traceMode = 'openstreetmap+' + mode;
   // The holes and the boundary were drawn on the same map: they move with it
   // (until 1 November 2026 they stayed where the map lay).
   const sh = refineTrace.lastShift;
   st.osm.shift = sh ?? {x: 0, z: 0}; osmCourseHoles();
   paintCodes(); go(2); refreshCount();
   say(`Refined from the ${mode === 'picture' ? 'picture' : 'LIDAR'}${sh ? `: the map, its holes and its boundary moved ${Math.hypot(sh.x, sh.z).toFixed(1)} m to line up` : ''}. Keep it as drawn puts OpenStreetMap's back.`);
  } finally { setBusy(''); }
 }
 async function autoTrace() {
  if (!st.land) return;
  setBusy('Tracing…'); await frame();
  try {
   const picture = st.picture && (!st.picture.fromLidar || st.picture.colour) ? st.picture : null;
   const r = trace(st.land, {picture, holes: [], mode: picture ? 'both' : 'lidar'});
   st.model = createTrace(st.land, {rocks: st.model?.state.rocks ?? st.rocks, bunkers: st.model?.state.bunkers ?? [], creekLines: st.model?.state.creekLines ?? [], codes: r.codes, trees: st.trees}); st.traceMode = 'auto';
   paintCodes(); go(2); refreshCount();
   say(`Traced ${picture ? 'from the LIDAR first, the picture where it cannot tell' : 'from the LIDAR alone (no picture)'}. Correct it with the tools; the holes come next.`);
  } finally { setBusy(''); }
 }
 function manualTrace() {
  if (!st.land) return;
  if (st.model && !confirm('Start a blank trace? What is traced now is dropped.')) return;
  st.model = createTrace(st.land, {rocks: st.model?.state.rocks ?? st.rocks, bunkers: st.model?.state.bunkers ?? [], creekLines: st.model?.state.creekLines ?? [], trees: st.trees}); st.traceMode = 'manual';
  paintCodes(); st.traceTool = 'brush'; go(2); refreshCount();
  say('A blank trace (the LIDAR\'s trees kept; Clear trees takes them off). Paint or outline each surface.');
 }

 // 4. Holes.
 // THE SCORECARD (the owner, 1 November 2026: "We need to add a scorecard
 // section to the 'holes' step"; "let the user set the par. per hole and
 // edit the card (not yardage tho)"): each hole's par and handicap index, set
 // by hand, and its yards from the three tee sets -- not editable: AS THE GAME
 // WILL MEASURE THEM (built-world.js builtLine: along the line through the aim
 // points, blue the farthest tee, white and red the nearer; players start on
 // white). Par is worked from the blue yards until set; the index runs 1 to
 // 18 down the card until set.
 const cardOf = h => { if (!h?.green || !h.tees.length) return null; const L = builtLine({tees: h.tees, green: h.green, line: holeLine(h)}); return {...L.yards, skipped: L.skipped, par: h.par ?? parFor(L.yards.blue), auto: h.par == null}; };
 function scorecard() {
  const rows = Array.from({length: st.holesN}, (_, n) => ({n, h: st.holes[n], c: cardOf(st.holes[n])}));
  const yd = v => v == null ? '--' : Math.round(v);
  const sum = (list, f) => list.reduce((t, x) => t + (f(x) ?? 0), 0);
  const total = (label, list) => el('tr', {class: 'cb-cardsum'}, el('td', {}, label), el('td', {}, sum(list, x => x.c?.par)), el('td'), ...['blue', 'white', 'red'].map(k => el('td', {}, Math.round(sum(list, x => x.c?.[k])))));
  const body = rows.map(({n, h, c}) => el('tr', {class: n === st.hole ? 'cb-cur' : ''},
   el('td', {style: 'cursor:pointer', title: 'Mark this hole', onclick: () => { st.hole = n; go(3); }}, n + 1),
   el('td', {}, el('select', {class: 'cb-par', 'data-hole': n, disabled: !c, title: 'This hole\'s par: worked from the blue yards (*), or set by hand', onchange: e => { if (!h) return; h.par = e.target.value === 'auto' ? null : +e.target.value; go(3); }},
    el('option', {value: 'auto', selected: !c || c.auto}, c ? `${parFor(c.blue)}*` : '--'), [3, 4, 5, 6].map(v => el('option', {value: v, selected: !!c && !c.auto && c.par === v}, v)))),
   el('td', {}, el('select', {class: 'cb-index', 'data-hole': n, disabled: !c, title: 'This hole\'s handicap index: 1 the hardest, where strokes are given first', onchange: e => { if (!h) return; h.index = e.target.value === 'auto' ? null : +e.target.value; go(3); }},
    el('option', {value: 'auto', selected: h?.index == null}, `${n + 1}*`), Array.from({length: st.holesN}, (_, q) => q + 1).map(v => el('option', {value: v, selected: h?.index === v}, v)))),
   el('td', {}, yd(c?.blue)), el('td', {}, yd(c?.white)), el('td', {}, yd(c?.red))));
  const half = st.holesN === 18 ? [total('Out', rows.slice(0, 9)), ...body.slice(9), total('In', rows.slice(9))] : [];
  const skipped = rows.filter(x => x.c?.skipped);
  const used = rows.map(x => x.h?.index ?? x.n + 1), twice = [...new Set(used.filter((v, q) => used.indexOf(v) !== q))].sort((p, q) => p - q);
  return el('div', {class: 'cb-field cb-card'}, el('label', {}, 'Scorecard'),
   el('small', {}, 'Set each hole\'s par and handicap index. The yards are the game\'s own, measured along each hole\'s line through its aim points; to change them, move the tees, the aim points or the green. Blue, white and red are the game\'s names for the back, middle and front tees -- players start on white -- and a hole with one tee plays the same from all three. * = worked out for you.'),
   el('table', {}, el('thead', {}, el('tr', {}, ...['Hole', 'Par', 'Index', 'Blue', 'White', 'Red'].map(t => el('th', {}, t)))),
    el('tbody', {}, ...(st.holesN === 18 ? [...body.slice(0, 9), ...half] : body), total('Total', rows))),
   twice.length ? el('small', {class: 'cb-err'}, `Handicap index on more than one hole: ${twice.join(', ')} -- each hole needs its own.`) : null,
   skipped.length ? el('small', {class: 'cb-err'}, `The game skips an aim point that is no farther on than the one before (or is at the green): ${skipped.map(x => `hole ${x.n + 1} (${x.c.skipped})`).join(', ')}.`) : null);
 }
 function stepHoles() {
  const list = el('ul', {}, Array.from({length: st.holesN}, (_, n) => { const h = st.holes[n], sk = cardOf(h)?.skipped; return el('li', {class: n === st.hole ? 'cb-cur' : '', style: 'cursor:pointer', onclick: () => { st.hole = n; go(3); }}, `Hole ${n + 1}: ${h?.tees.length ? h.tees.map(t => t.set).join(', ') + ' tee' : 'no tee'}, ${h?.aims.length ? h.aims.length + ' aim point' + (h.aims.length > 1 ? 's' : '') + (sk ? ` (${sk} skipped by the game)` : '') : 'straight'}, ${h?.green ? 'green' : 'no green'}`); }));
  const marks = [['back', 'Back tee'], ['middle', 'Middle tee'], ['front', 'Front tee'], ['aim', 'Aim point'], ['green', 'Green']].map(([m, t]) => el('button', {class: 'cb-btn' + (st.mark === m ? ' cb-on' : ''), type: 'button', 'data-mark': m, onclick: () => { st.mark = m; go(3); }}, t));
  return [el('div', {class: 'cb-field'}, el('label', {}, `Hole ${st.hole + 1}`),
   el('small', {}, 'Click the plan: the back tee (the middle and front if you like), any aim points where the hole bends, in order from the tee, and the green. The game draws the hole\'s line through every aim point in turn -- two make a double dogleg -- measures the yards along it, and aims the tee shot at the first; an aim point no farther on than the one before is skipped.'),
   el('select', {class: 'cb-holes', onchange: e => { st.holesN = +e.target.value; go(3); }}, [18, 9].map(n => el('option', {value: n, selected: n === st.holesN}, `${n} holes`))),
   el('div', {class: 'cb-btns'}, ...marks),
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.hole = Math.max(0, st.hole - 1); st.mark = 'back'; go(3); }}, 'Previous hole'),
    el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => { st.hole = Math.min(st.holesN - 1, st.hole + 1); st.mark = 'back'; go(3); }}, 'Next hole'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.holes[st.hole] = {tees: [], aims: [], green: null}; go(3); }}, 'Clear this hole'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.holes[st.hole]?.aims.pop(); go(3); }}, 'Drop last aim')),
   // FIT TO THE TRACE (osm-course.js fitHoles): every hole's green mark on
   // the traced green it reaches, and the tee boxes along its line as its
   // back, middle and front tees -- after an auto trace, a hand correction or
   // holes marked by hand. One Undo-free step; marks can be moved after.
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', title: 'Put each green mark on its traced green and give each hole the tee boxes along its line', onclick: fitToTrace}, 'Fit holes to the trace')), list),
  scorecard(),
  next(4, 'Next: the name')];
 }
 function fitToTrace() {
  if (!st.model) return;
  const want = st.holes.slice(0, st.holesN), fit = fitHoles(want.map(h => h?.green && h.tees.length ? h : null), st.model.state.codes, st.land);
  let greens = 0, tees = 0;
  fit.forEach((h, n) => { if (!h) return; if (h.fit.green === 'moved') greens++; tees += h.fit.tees; st.holes[n] = {tees: h.tees, aims: h.aims, green: h.green, par: h.par ?? null, index: want[n].index ?? null}; });
  go(3); say(`Fitted: ${greens} green mark${greens === 1 ? '' : 's'} moved onto a green; ${tees} tee boxes given to holes. Move any mark by clicking again.`);
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
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => st.doc && openEditor(st.doc, {from: 'real', back: remount})}, 'Open in the editor'))];
 }
 // The course made (docFromLand) and drawn from the world the game will
 // build from it, so what is shown is what will be played.
 async function paintCourse(card, found) {
  const holes = st.holes.slice(0, st.holesN).map((h, n) => ({number: n + 1, par: h.par ?? null, index: h.index ?? null, tees: h.tees, green: h.green, line: holeLine(h)}));
  setBusy('Painting the course…'); await frame();
  try {
   const doc = st.doc = validateDoc(docFromLand({land: st.land, traced: {layers: st.model.state.layers}, holes, trees: st.model.state.trees.map(t => st.treeScale === 1 ? t : {...t, h: t.h * st.treeScale, crown: t.crown * st.treeScale, ...(t.trunk ? {trunk: t.trunk * st.treeScale} : {})}), homes: st.model.state.homes, bunkers: st.model.state.bunkers, creekLines: st.model.state.creekLines, name: st.name.trim() || 'My real course', landscape: st.landscape, credits: st.credits, landEdits: st.landEdits, creeks: st.creeks, rocks: st.model?.state.rocks ?? st.rocks,
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
   say(st.cameBack ?? 'The course as it will be built. Open it in the editor, or go back to change anything.'); st.cameBack = null;
  } catch (e) { say('Could not make the course: ' + e.message, true); }
  finally { setBusy(''); }
 }
 // SAVE FROM ANY STEP (the owner, 1 November 2026): door 2 saves a draft
 // (draft.js) that opens back here at the same step; the playable course is
 // saved from the editor. Pictures are not in it, but each one's lining up is.
 const snapshot = () => ({step: st.step, name: st.name, landscape: st.landscape, credits: st.credits, holes: st.holes, holesN: st.holesN, hole: st.hole, boundary: st.boundary, traceMode: st.traceMode, box: st.box,
  sources: st.sources.map(s => ({name: s.name, crs: s.kind === 'points' ? s.crs : s.raster?.crs ?? s.crs ?? null})),
  view: {lidarView: st.lidarView, lidarAlpha: st.lidarAlpha, picAlpha: st.picAlpha, traceAlpha: st.traceAlpha, lidarOnTop: st.lidarOnTop, smoothView: st.smoothView, treeScale: st.treeScale},
  picOffsets: {...st.picOffsets, ...(st.picShow && st.picShow !== 'lidar' ? {[st.picShow]: st.offset} : {})}, osm: st.osm, trees: st.trees, land: st.land, landEdits: st.landEdits, creeks: st.creeks, rocks: st.model?.state.rocks ?? st.rocks,
  trace: st.model ? {masks: st.model.state.layers.masks, hidden: [...st.model.state.layers.hidden], trees: st.model.state.trees, homes: st.model.state.homes, bunkers: st.model.state.bunkers, creekLines: st.model.state.creekLines} : null});
 const saver = {key: `door2-${++opened}`, name: () => st.name, file: () => fileName(st.name).replace(/\.fairway$/, DRAFT_EXT), bytes: () => writeDraft(snapshot()),
  said: (r, bytes) => r.how === 'failed' ? say('Could not save: ' + r.error.message, true) : say(`${r.how === 'overwrite' ? 'Saved again to' : 'Saved as'} ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB): a draft that opens back at this step (Open a course file). The playable course is saved from the editor.`)};
 setSaver(saver);
 // BACK FROM THE 3D EDITOR (the owner, 1 November 2026: "add a button to go
 // back to the 2d editor from the 3d editor", then "go back and forth between
 // 2d and 3d work. while keeping changes made in both directions"): door 2
 // shown again -- the same plan, pictures and steps -- with the editor's work
 // taken into the trace (round-trip.js fromEditor): the layers it changed,
 // its shaping (st.landEdits, added when the course is made), holes, trees,
 // houses, creeks, name and landscape. Then at the review.
 function remount(editor = null) {
  show(section); preview().mount(section.querySelector('.cb-planbox')); setTitle('Real life course'); topTools(backButton()); setSaver(saver);
  let told = 'the trace as you left it';
  if (editor && st.doc && st.model) {
   const got = fromEditor({base: st.doc, now: editor.toDoc(), grid: st.land, changed: editor.changedLayers(), holesBefore: st.holes, ownCreeks: st.creeks.length}), L = st.model.state.layers;
   st.treeScale = 1;
   for (const [kind, m] of got.masks) L.masks.set(kind, m);
   L.hidden = new Set(editor.hiddenLayers()); L.recompose(); st.model.state.codes = L.codes;
   if (got.landEdits) { if (st.landEdits) for (let k = 0; k < got.landEdits.length; k++) st.landEdits[k] += got.landEdits[k]; else st.landEdits = got.landEdits; }
   st.holes.splice(0, got.holes.length, ...got.holes); st.holesN = got.holes.length;
   st.model.setTrees(got.trees); st.model.state.homes = got.homes; st.model.state.rocks = got.rocks;
   Object.assign(st, {creeks: got.creeks, rocks: got.rocks, name: got.name, landscape: got.landscape});
   told = [got.masks.size ? `${got.masks.size} layer${got.masks.size === 1 ? '' : 's'} as painted there` : '', got.landEdits ? 'the ground as shaped' : '', 'the holes, trees and houses'].filter(Boolean).join(', ');
   dirtyVec(); refreshSave();
  }
  // Said now, and again by the review once it has painted (paintCourse).
  st.cameBack = `Back from the 3D editor with ${told}. Change anything in the steps; Open in the editor makes the course from both.`;
  say(st.cameBack);
  go(can(5) ? 5 : 3); plan.fit();
 }
 if (draft) restore(draft);
 else { go(0); say('Start with the LIDAR files.'); }

 function restore(d) {
  // The LIDAR files are not in a draft: stand-ins carry their names and map
  // grid, so the place is known (imagery, OpenStreetMap); building the land
  // anew needs the files again.
  Object.assign(st, {name: d.name, landscape: d.landscape, credits: d.credits ?? [], holes: d.holes ?? [], holesN: d.holesN ?? 18, hole: d.hole ?? 0, boundary: d.boundary, traceMode: d.traceMode, box: d.box,
   sources: (d.sources ?? []).map(s => ({name: s.name, kind: 'points', crs: s.crs, restored: true})), picOffsets: d.picOffsets ?? {}, trees: d.trees ?? [], landEdits: d.landEdits ?? null, creeks: d.creeks ?? [], rocks: d.rocks ?? [], ...(d.view ?? {})});
  if (d.land) {
   const L = d.land, u = L.unit ?? {h: 1, v: 1};
   st.land = L;
   st.gridder = createGridder({box: {x0: L.center.x - L.halfX / u.h, x1: L.center.x + L.halfX / u.h, y0: L.center.y - L.halfZ / u.h, y1: L.center.y + L.halfZ / u.h}, cell: L.cell, unit: u});
   if (d.osm?.codes) st.osm = d.osm;
   if (d.trace) {
    st.model = createTrace(st.land, {rocks: st.rocks, bunkers: d.trace.bunkers ?? [], creekLines: d.trace.creekLines ?? [], trees: d.trace.trees, homes: d.trace.homes});
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
let lidarFolder = null;   // the player's LIDAR folder (lidar-folder.js), once picked or recalled
