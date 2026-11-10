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
import {show, setTitle, setBusy, topTools, home, pickFile, ui, setSaver, refreshSave, useMenus} from './builder.js';
import {icon, eyeButton} from './icons.js';
import {penCurve, closesOn, nodeAt} from './pen.js';
import {createSteady} from './steady.js';
import {keepDraft, keptDraft, dropDraft} from './autosave.js';
import {readDraft} from './draft.js';
import {blobs, checkHoles, mapVerdict, mapHas, bendFor, cardFrom} from './map-checks.js';
import {writeDraft, DRAFT_EXT} from './draft.js';
import {fromEditor} from './round-trip.js';
import {preview} from './preview.js';
import {coverOptions, coverByKey, COVER_RANGE, treeChoices} from './cover.js';
import {cornersOf, anchorHit} from './layer-ops.js';
import {markNear, moveMark, pressOn} from './hole-marks.js';
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
import {PROVIDERS, providersAt, mosaic, tilePixel, metresPerPixel} from './imagery.js';
import {packPictures, unpackPictures} from './picture-file.js';
import {treePlanControls} from './tree-plan.js';
import {treeAt} from '../built-world.js';
import {sourcesAt, squareAround, searchLidar, downloadLidar, isEptZip, eptZipSource, gridByName, coverFor, coverTogether, tilesOf} from './lidar-search.js';
import {coverageWords, percent} from './lidar-coverage.js';
import {canPick, recallFolder, pickFolder, allowed, fileIn, bytesIn, saveIn, saveAsDownload, listIn, overPlace, removeIn} from './lidar-folder.js';
import {readZip} from '../zip.js';
import {createPlanView} from './plan-view.js';
import {validateDoc, writeBuiltFile} from '../course-doc.js';
import {saveBytes} from './saving.js';
import {BIOME_KEYS, BUILT_VERSION} from '../settings-schema.js';
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
// THE TRACE STEP'S TOOLS, in the palette's order, with their keys (the
// builder-ux goal): [key, name, shortcut, the palette's group].
const TOOL_LIST = [['move', 'Move the view', 'H', 0], ['select', 'Select shape', 'V', 0],
 ['brush', 'Paint brush', 'B', 1], ['erase', 'Erase brush', 'E', 1], ['eraseAll', 'Erase all layers', 'Shift+E', 1], ['outline', 'Outline fill', 'P', 1], ['smooth', 'Smooth edges', 'S', 1],
 ['creek', 'Draw a creek', 'C', 2], ['bunker', 'Dig a bunker', 'U', 2],
 ['tree', 'Place tree', 'T', 3], ['treeBrush', 'Tree brush', 'Shift+T', 3], ['treeZone', 'Tree zone', 'Z', 3], ['treeErase', 'Clear trees', 'X', 3], ['sizeTree', 'Size a tree', null, 3],
 ['cover', 'Ground cover', 'G', 4], ['coverErase', 'Clear cover', 'Shift+G', 4],
 ['home', 'House', 'O', 5], ['homeZone', 'House zone', 'Shift+O', 5], ['homeErase', 'Clear houses', null, 5],
 ['measure', 'Measure', 'M', 6]];
// The tools that draw with the pen (pen.js), and how near the first node a
// click closes the shape, in screen pixels.
const PEN_TOOLS = ['outline', 'treeZone', 'boundary', 'homeZone', 'creek'], PEN_REACH = 10;
// The brushes that are steadied (steady.js) and smooth their edge when let go.
const STEADIED = ['brush', 'erase', 'eraseAll'];
const STEPS = ['1 LIDAR', '2 Land', '3 Trace', '4 Holes', '5 Name', '6 Review'];
const KEYS = 'fairway-builder-imagery-keys';
// Imagery fetched this session, by provider and place (fetchImagery): kept
// across door 2's steps, the land rebuilt and door 2 opened again.
const IMAGERY = new Map();
const BRUSHES = ['brush', 'erase', 'eraseAll', 'smooth', 'treeErase', 'homeErase', 'cover', 'coverErase', 'treeBrush'];

// A saved draft, its pictures unpacked first (picture-file.js).
export async function openSaved(draft) {
 const pics = await unpackPictures(draft.pics ?? [], {onStep: label => setBusy(`Opening the pictures… ${label}`)});
 return open({...draft, pics});
}

export function open(draft = null) {
 setTitle('Real life course');
 const st = {step: 0, treePlan: null, sources: [], preview: null, box: null, land: null, gridder: null, trees: [], pics: [], offset: {x: 0, z: 0}, picture: null, geo: null,
  model: null, traceMode: null, tool: 'move', kind: 'fairway', size: 4, outline: [], sharp: new Set(), penEdit: false, penDrag: -1, steadiness: 50, smoothStroke: true, hover: null, holes: [], hole: 0, holesN: 18, mark: 'back',
  name: 'My real course', landscape: 'parkland', credits: [], align: null, smoothView: true, traceOn: true, vec: null, boundary: null, exTo: 'semi', exWidth: 4,
  chosen: null, carry: null, sizing: null, treeScale: 1, treeKind: '', cover: 'rocks', coverThick: .5, coverSizes: Object.fromEntries(Object.entries(COVER_RANGE).map(([k, r]) => [k, {min: r.from[0], max: r.from[1]}])), picShow: null, picOffsets: {}, landEdits: null, creeks: [], rocks: [], lidarView: 'relief', lidarAlpha: 1, picAlpha: 1, traceAlpha: 120 / 255, lidarOnTop: false, picLocked: true};
 window.fairwayBuilder.door2 = st;
 const canvas = el('canvas', {class: 'cb-plan'});
 const notes = el('div', {class: 'cb-note', role: 'status'});
 const say = (t, err = false) => { notes.textContent = t; notes.title = t; notes.classList.toggle('cb-err', err); };
 const zoomText = el('span', {class: 'cb-stat'}), posText = el('span', {class: 'cb-stat'}), hintBar = el('div', {class: 'cb-toolhint', hidden: true});
 // NAMED UNDO (item 11): the trace's undo steps carry no names, so a list of
 // names is kept beside them -- each change named after the tool or button
 // that made it -- for "Undo Outline fill" and the History section.
 const names = {undo: [], redo: []};
 st.names = names;   // for the smoke journeys
 const historyList = el('ol', {class: 'cb-history', reversed: true});
 function refreshHistory() {
  const n = names.undo.length, shown = names.undo.slice(-15).map((w, i, a) => ({w, k: n - a.length + i}));
  historyList.replaceChildren(...shown.reverse().map(({w, k}) => el('li', {}, el('span', {}, w), k < n - 1 ? el('button', {class: 'cb-btn', type: 'button', 'data-history': k, title: `Undo every change after this one (${n - 1 - k})`, onclick: () => { for (let q = n - 1; q > k; q--) undoNow(); }}, 'Back to here') : el('small', {}, 'latest'))));
  const sum = historyList.closest('details')?.querySelector('summary small'); if (sum) sum.textContent = n ? `${n} change${n === 1 ? '' : 's'}` : 'nothing yet';
 }
 function nameNew(before, what) {
  const u = st.model?.state.undo.length ?? 0;
  if (u > before) { for (let k = before; k < u; k++) names.undo.push(what); names.redo.length = 0; }
  while (names.undo.length > u) names.undo.shift();
  refreshHistory?.();
 }
 const named = (what, run) => () => { const before = st.model?.state.undo.length ?? 0; run(); nameNew(before, what); };
 let toolBefore = null;
 const namedTool = (type, p, e) => {
  if (type === 'down' || type === 'double') toolBefore = st.model?.state.undo.length ?? 0;
  onTool(type, p, e);
  if ((type === 'up' || type === 'double' || (type === 'down' && !BRUSHES.includes(st.tool))) && toolBefore != null) nameNew(toolBefore, (TOOL_LIST.find(t => t[0] === st.tool)?.[1]) ?? (st.tool === 'mark' ? 'Hole marks' : st.tool === 'boundary' ? 'Course boundary' : 'A change'));
 };
 const plan = createPlanView(canvas, {onTool: namedTool, overlay, onWindowChange: ui.onWindowChange});
 st.plan = plan;
 st.toCanvas = (x, z) => plan.toScreen(x, z);
 // THE WORKSPACE (the builder-ux goal, 10 November 2026; DESIGN in the
 // goal's brief): the steps along the top with the one Next button, the tool
 // palette down the left (the trace step), the plan, the step's panel on the
 // right -- tool options, layers, then folding sections -- and a status bar
 // with what the tool does, where the pointer is and what just happened.
 // Replaced a 400-pixel column holding everything, about three screens tall
 // in the trace step, with Next at its foot.
 const panel = el('div', {style: 'display:flex;flex-direction:column;gap:10px'});
 // THE OVERVIEW MAP (item 19): the whole land, small, in the plan's corner,
 // with the part in view outlined; a click there moves the view to it. Its
 // picture is taken whenever the whole land is in view (Whole land, F).
 const mini = el('canvas', {class: 'cb-mini', width: 180, height: 180, hidden: true, title: 'The whole land: the outline is what is in view; click to go there'});
 const miniPic = document.createElement('canvas'); miniPic.width = 180; miniPic.height = 180;
 mini.addEventListener('click', e => { const land = L(); if (!land) return; const r = mini.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fz = (e.clientY - r.top) / r.height; plan.look(-land.halfX + fx * 2 * land.halfX, -land.halfZ + fz * 2 * land.halfZ); });
 const stepChips = el('div', {class: 'cb-stepchips'}), stepNeeds = el('div', {class: 'cb-stepneeds', role: 'status'});
 const nextBtn = el('button', {class: 'cb-btn cb-hot cb-next', type: 'button'}, 'Next');
 const palette = el('nav', {class: 'cb-palette', 'aria-label': 'Tools', hidden: true});
 const undoBtn = el('button', {class: 'cb-btn', type: 'button', title: 'Undo (Ctrl+Z)', onclick: () => undoNow()}, 'Undo'), redoBtn = el('button', {class: 'cb-btn', type: 'button', title: 'Redo (Ctrl+Y)', onclick: () => undoNow(true)}, 'Redo');
 const section = el('section', {class: 'cb-door2 cb-ws'},
  el('div', {class: 'cb-stepbar'}, stepChips, stepNeeds, nextBtn),
  palette,
  el('div', {class: 'cb-planbox'}, canvas, mini),
  el('aside', {class: 'cb-sidepanel cb-steps', 'aria-label': 'This step'}, panel),
  el('footer', {class: 'cb-statusbar'}, undoBtn, redoBtn, hintBar, notes, posText, zoomText,
   el('button', {class: 'cb-btn', type: 'button', title: 'Zoom in (+)', onclick: () => plan.zoomBy(1.5)}, 'Zoom in'), el('button', {class: 'cb-btn', type: 'button', title: 'Zoom out (-)', onclick: () => plan.zoomBy(1 / 1.5)}, 'Zoom out'),
   el('button', {class: 'cb-btn', type: 'button', title: 'The whole land in view (F)', onclick: () => plan.fit()}, 'Whole land')));
 show(section);
 section.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !st.model || b.closest('.cb-statusbar') || b.dataset.history != null) return; const before = st.model.state.undo.length, what = b.getAttribute('aria-label') || b.textContent.trim(); setTimeout(() => nameNew(before, what), 250); }, true);
 window.addEventListener('keydown', e => { if (e.key !== 'Enter' || !st.model || !document.body.contains(canvas)) return; const before = st.model.state.undo.length, what = TOOL_LIST.find(t => t[0] === st.tool)?.[1] ?? 'A shape'; setTimeout(() => nameNew(before, what), 0); }, true);
 function undoNow(redo = false) {
  if (!st.model) return; st.chosen = st.sizing = null;
  const what = redo ? names.redo.at(-1) : names.undo.at(-1);
  if (redo) { if (st.model.redo() && names.redo.length) names.undo.push(names.redo.pop()); } else if (st.model.undo() && names.undo.length) names.redo.push(names.undo.pop());
  paintCodes(); refreshCount(); plan.draw(); refreshHistory();
  if (what) say(`${redo ? 'Redone' : 'Undone'}: ${what}.`);
 }
 preview().mount(section.querySelector('.cb-planbox'));
 // THE MODEL OF WHAT THE TOOL PAINTS OR PLACES (preview.js; the owner, 4
 // November 2026), for the trace's tools; the other steps show none.
 // The cover in hand, or the landscape's first if it does not offer that one.
 const coverNow = () => { const o = coverOptions(BIOMES[st.landscape]); return o.find(c => c.key === st.cover) ?? o[0]; };
 const showModel = () => {
  const item = st.step === 2 ? ({brush: {kind: 'surface', surface: st.kind}, outline: {kind: 'surface', surface: st.kind}, tree: {kind: 'tree', species: st.treeKind || null, height: st.treeH}, treeZone: {kind: 'tree'}, home: {kind: 'house'}, homeZone: {kind: 'house'}, creek: {kind: 'creek'}, bunker: {kind: 'bunker'}, cover: {kind: 'cover', cover: coverNow().key, ...st.coverSizes[coverNow().key]}, treeBrush: {kind: 'cover', cover: 'trees', ...st.coverSizes.trees}})[st.tool] ?? null : null;
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
 const plan2d = () => { plan.draw(); refreshSave(); };
 // A tree's crown under the course's plan, as the game will size it: held per
 // tree and plan, as this is read for every tree at every redraw.
 const planCrowns = new WeakMap();
 const planCrown = t => {
  const key = st.landscape + JSON.stringify(st.treePlan), had = planCrowns.get(t);
  if (had?.key === key) return had.crown;
  const crown = treeAt(BIOMES[st.landscape], st.treePlan, false, t.kind, (t.role ?? (t.crown / t.h < .2 ? 1 : 2)) | (t.placed ? 32 : 0), t.h, t.crown, t.trunk ?? .3, t.x, t.z).crown;
  planCrowns.set(t, {key, crown});
  return crown;
 };

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
 function lookPicture() { plan.setFilter('picture', `brightness(${st.picLight ?? 1}) contrast(${st.picContrast ?? 1})`); }
 function viewLayers() {
  plan.setAlpha('relief', st.lidarAlpha); plan.setAlpha('picture', st.picAlpha); plan.setAlpha('codes', st.traceAlpha);
  plan.setOrder(st.lidarOnTop ? ['picture', 'relief'] : ['relief', 'picture']);
 }
 // THE PICTURE AS SHARP AS ITS SOURCE ON THE PLAN (the builder-ux goal, item
 // 7; the owner: "our images ... are not very high resolution"): the trace
 // reads the picture on the land's cells (st.picture), but the plan draws it
 // on a grid of its own, as fine as the photograph -- 30 cm for USGS NAIP --
 // never coarser than the land, and at most about 36 million pixels (PLACED;
 // a 1.8 km land at 30 cm). Before, a 1 m land showed a 30 cm photograph at
 // 1 m. The picture's own drawing is laid on the grid the same way, through
 // its placing (`toPixel`, with the offset dragged).
 function finePicture() {
  const shown = st.pics.filter(q => q.group === st.picShow && q.toPixel);
  if (!shown.length || !st.land) return null;
  const land = st.land, c = lonLatOfLocal()?.(0, 0);
  // The zoom it was fetched at: on the picture when fetched, in its `place` when reopened.
  const zoomOf = q => q.pic?.tile?.z ?? (q.place?.kind === 'tiles' ? q.place.z : null);
  const src = Math.min(...shown.map(q => zoomOf(q) != null && c ? metresPerPixel(c.lat, zoomOf(q)) : land.cell));
  let cell = Math.max(.3, Math.min(land.cell, src));
  const w = 2 * land.halfX, d = 2 * land.halfZ;
  if (w * d / (cell * cell) > 36e6) cell = Math.sqrt(w * d / 36e6);
  if (cell >= land.cell * .95) return null;
  const nx = Math.ceil(w / cell) + 1, nz = Math.ceil(d / cell) + 1, grid = {nx, nz, cell, halfX: land.halfX, halfZ: land.halfZ};
  // Over a land a few kilometres across the picture's placing is very nearly a
  // flat map (a turn, a scale, a shift): fitted from a 5 by 5 grid of exact
  // points, it is quick enough for millions of pixels (the exact placing a
  // pixel at a time took seconds).
  let pic = null;
  for (const p of shown) {
   const pairs = [];
   for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { const x = -land.halfX + i / 4 * w, z = -land.halfZ + j / 4 * d, [col, row] = p.toPixel(x - st.offset.x, z - st.offset.z); pairs.push({local: {x, z}, pixel: {col, row}}); }
   const flat = affineFromPairs(pairs);
   pic = pictureOnLand(grid, st.gridder, p.pic, {affine: flat.map, into: pic});
  }
  const canvas = document.createElement('canvas'); canvas.width = nx; canvas.height = nz;
  const g = canvas.getContext('2d'), img = g.createImageData(nx, nz), dd = img.data;
  for (let k = 0; k < nx * nz; k++) if (pic.has[k]) { dd[k * 4] = pic.rgb[k * 3]; dd[k * 4 + 1] = pic.rgb[k * 3 + 1]; dd[k * 4 + 2] = pic.rgb[k * 3 + 2]; dd[k * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return {canvas, cell};
 }
 function paintPicture() {
  if (!st.land || !st.picture) { plan.clearLayer('picture'); return; }
  const fine = st.picShow !== 'lidar' ? finePicture() : null;
  if (fine) { plan.setLayerCanvas('picture', fine.canvas, fine.cell); plan.shiftLayer('picture', 0, 0); return; }
  const p = st.picture;
  plan.setLayer('picture', (d, nx, nz) => { for (let k = 0; k < nx * nz; k++) if (p.has[k]) { d[k * 4] = p.rgb[k * 3]; d[k * 4 + 1] = p.rgb[k * 3 + 1]; d[k * 4 + 2] = p.rgb[k * 3 + 2]; d[k * 4 + 3] = 255; } });
  plan.shiftLayer('picture', 0, 0);
 }
 const codeTexel = (d, o, c) => { const col = COLOUR[PALETTE[c]]; if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; } else d[o + 3] = 0; };
 function paintCodes() {
  if (!st.land || !st.model) { plan.clearLayer('codes'); return; }
  const c = st.compareSkin && st.preSkin ? st.preSkin : st.model.state.layers.view;
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
 function showCodes() { plan.view.show.codes = st.traceOn && st.step !== 5 && (!(st.smoothView && st.vec) || !!st.compareSkin); plan.draw(); }
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
  const k = LABEL(st.kind).toLowerCase(), r = st.size, view = 'Right-drag or Space-drag moves the view; the wheel zooms.', corners = n => st.penEdit ? 'closed: drag a node to adjust it; Enter fills it, Esc drops it.' : `${n} node${n === 1 ? '' : 's'}: click to add more${n >= 3 ? ', click the first node to close' : ''}; Enter fills, Backspace takes the last off, Esc drops it.`;
  let t = '';
  if (st.step === 0) t = st.preview ? `Drag a box round the property on the relief. ${view}` : '';
  else if (st.step === 3) t = `Hole ${st.hole + 1}: click to place its ${MARK_NAME[st.mark] ?? st.mark}, or drag any mark to move it. ${view}`;
  else if (st.step === 2 && !st.model && st.tool !== 'align') t = st.land ? 'Fetch OpenStreetMap, or press Auto trace or Manual trace, to start.' : '';
  else if (st.step === 2) {
   const all = st.kind === 'rough';
   t = ({
    move: 'Move the view: drag to move it; the wheel zooms. Pick a tool to paint.',
    brush: all ? `Paint brush, rough (${r} m round): drag to take every layer off.` : `Paint brush: drag to paint ${k} (${r} m round).`,
    erase: all ? `Erase brush (${r} m round): drag to take every layer off.` : `Erase brush: drag to take ${k} off (${r} m round); whatever lies under it shows.`,
    eraseAll: `Erase all layers (${r} m round): drag to take every layer off, down to rough.`,
    outline: st.outline.length ? `Outline fill, ${k}: ${corners(st.outline.length)}` : `Outline fill, ${k}: click round the shape, node by node; the curve follows.`,
    smooth: `Smooth brush (${r} m round): drag along a ragged edge to round it.`,
    tree: `Place tree: click to stand a ${st.treeH} m tree (not on mown ground, sand, water or a path).`,
    treeBrush: `Tree brush: drag to scatter the landscape's trees (${r} m round), from ${st.coverSizes.trees.min.toFixed(1)} to ${st.coverSizes.trees.max.toFixed(1)} m tall.`,
    sizeTree: st.sizing ? 'Size it with This tree; click another to pick it.' : 'Size a tree: click a tree, then size it with This tree.',
    creek: st.outline.length ? `Draw a creek: ${st.outline.length} point${st.outline.length === 1 ? '' : 's'}; double-click or Enter ends it. Its channel is cut when the course is made.` : 'Draw a creek: click along it from its head to its foot.',
    bunker: `Dig a bunker: click to dig one ${r} m round; sand, and a hollow when the course is made.`,
    select: st.carry?.hold ? (st.carry.turn ? `Turning the ${st.chosen.what}: ${Math.round(st.carry.angle * 180 / Math.PI)} degrees; let go to set it.` : `Moving the ${st.chosen.what}: let go where it belongs. Undo puts it back.`) : st.chosen ? `${st.chosen.what[0].toUpperCase() + st.chosen.what.slice(1)} selected: drag inside the outline to move it${st.chosen.corners.length ? ', or an anchor to turn it' : ''}.` : `Select shape: click a green, bunker, fairway, pond, tree or house -- the ${k} layer where it lies.`,
    treeZone: st.outline.length ? `Tree zone: ${corners(st.outline.length)}` : `Tree zone: click round the zone, node by node; the curve follows; it fills with ${st.density} trees a hectare.`,
    boundary: st.outline.length ? `Course boundary: ${corners(st.outline.length)}` : 'Course boundary: click round the course, node by node; the curve follows; outside it becomes the landscape\'s wood.',
    home: 'House: click to stand a house; it faces the nearest fairway, green or tee.',
    homeZone: st.outline.length ? `House zone: ${corners(st.outline.length)}` : 'House zone: click round a street or estate, node by node; the curve follows; houses line it 42 m apart, each facing the course.',
    homeErase: `Clear houses: drag to take houses off (${r} m round).`,
    cover: `Ground cover, ${coverNow().label.toLowerCase()}: drag over open ground (${r} m round), from ${st.coverSizes[coverNow().key].min.toFixed(1)} to ${st.coverSizes[coverNow().key].max.toFixed(1)} m. Not on turf, sand, water, paths or roads.`,
    coverErase: `Clear cover: drag to take rocks and low plants off (${r} m round). Trees stay.`,
    treeErase: `Clear trees: drag to take trees off (${r} m round).`,
    measure: st.measure?.b ? 'Measure: click to start another.' : st.measure?.a ? 'Measure: move to the far point and click; the yards follow the pointer.' : 'Measure: click a point, then another -- the yards, metres and the rise or fall between them.',
    align: `Picture unlocked: drag it into line with the LIDAR, or nudge it with the arrow keys (a quarter metre; Shift, a metre). It is ${st.offset.x.toFixed(2)} m east, ${(-st.offset.z).toFixed(2)} m north of where its position put it. Lock it when it is right.`,
   })[st.tool] ?? '';
   if (t && st.tool !== 'move') t += ' ' + view;
  }
  if (hintBar.textContent !== t) { hintBar.textContent = t; hintBar.title = t; }
  hintBar.hidden = !t;
 }

 // --------------------------------------------------------------- overlay
 function overlay(ctx, p) {
  const px = p.px; if (!L()) return;
  queueMicrotask(() => drawMini(ctx, p));
  zoomText.textContent = `${(px / p.view.scale).toFixed(2)} m a screen pixel`;
  showHint();
  if (st.vec && st.smoothView && st.traceOn && st.step < 5 && st.land && !st.compareSkin) drawVec(ctx, p);
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
   const sized = st.treePlan?.sizes === 'landscape';
   for (const t of trees) { const [x, y] = p.toScreen(t.x, t.z), r = Math.max(1.5 * px, (sized ? planCrown(t) : t.crown * st.treeScale) * p.view.scale); if (x < -r || y < -r || x > ctx.canvas.width + r || y > ctx.canvas.height + r) continue; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); if (r > 3 * px) ctx.stroke(); }
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
  if (st.step === 3 && st.doubts?.length) {
   ctx.save(); ctx.strokeStyle = '#ff5a4f'; ctx.lineWidth = 2.5 * px; ctx.setLineDash([5 * px, 4 * px]);
   for (const q of st.doubts) if (q.at) { const [x, y] = p.toScreen(q.at.x, q.at.z); ctx.beginPath(); ctx.arc(x, y, 14 * px, 0, 7); ctx.stroke(); }
   ctx.restore();
  }
  // The measure, and the yards from the tee while placing a hole's marks.
  if (st.step === 2 && st.tool === 'measure' && st.measure?.a) { const b = st.measure.b ?? st.hover; if (b) rulerLine(ctx, p, st.measure.a, b, measureWords(st.measure.a, b)); }
  if (st.step === 3 && st.hover && st.land) {
   const h = st.holes[st.hole], back = h?.tees.find(t => t.set === 'back') ?? h?.tees[0], from = st.mark === 'aim' || st.mark === 'green' ? (h?.aims.at(-1) ?? back) : null;
   if (from) rulerLine(ctx, p, from, st.hover, `${measureWords(from, st.hover)}${st.mark === 'green' && h.aims.length ? ` (${Math.round((holeLine({...h, green: st.hover}).reduce((t, q, k, A) => k ? t + Math.hypot(q[0] - A[k - 1][0], q[1] - A[k - 1][1]) : 0, 0)) / .9144)} yd along the hole)` : ''}`);
  }
  if (st.boundary && st.step >= 2 && st.step < 5) { ctx.save(); ctx.setLineDash([10 * px, 6 * px]); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2.5 * px; ctx.beginPath(); st.boundary.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); if (q) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  // THE PEN (pen.js): the curve that will be filled, drawn live through the
  // nodes and on to the pointer; a node at every click; the first node grows
  // when the pointer is on it, as a click there closes the shape; once closed,
  // the shape is filled faintly and its nodes can be dragged before Enter.
  if (st.outline.length) {
   const closedTool = st.tool !== 'creek', reach = PEN_REACH * px / p.view.scale, hov = st.hover ? [st.hover.x, st.hover.z] : null;
   const closing = closedTool && !st.penEdit && hov && closesOn(st.outline, hov, reach);
   const nodes = st.penEdit || closing || !hov ? st.outline : [...st.outline, hov];
   const pts = penCurve(nodes, {closed: closedTool && (st.penEdit || closing), sharp: [...st.sharp]});
   const path = () => { ctx.beginPath(); pts.forEach(([x, z], q) => { const [sx, sy] = p.toScreen(x, z); q ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); };
   if (closedTool && (st.penEdit || closing)) { path(); ctx.closePath(); ctx.fillStyle = 'rgba(255,107,214,.18)'; ctx.fill(); }
   ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4 * px; path(); if (closedTool && (st.penEdit || closing)) ctx.closePath(); ctx.stroke();
   ctx.strokeStyle = '#ff6bd6'; ctx.lineWidth = 2 * px; path(); if (closedTool && (st.penEdit || closing)) ctx.closePath(); ctx.stroke();
   // While drawing a shape, a faint line from the pointer back to the first node.
   if (closedTool && !st.penEdit && !closing && hov && st.outline.length >= 2) { ctx.save(); ctx.setLineDash([6 * px, 6 * px]); ctx.strokeStyle = 'rgba(255,107,214,.55)'; ctx.lineWidth = 1.5 * px; ctx.beginPath(); ctx.moveTo(...p.toScreen(hov[0], hov[1])); ctx.lineTo(...p.toScreen(st.outline[0][0], st.outline[0][1])); ctx.stroke(); ctx.restore(); }
   st.outline.forEach(([x, z], q) => {
    const [sx, sy] = p.toScreen(x, z), first = q === 0 && closedTool, big = first && (closing || st.outline.length >= 3);
    ctx.fillStyle = first && closing ? '#fde68a' : '#ffffff'; ctx.strokeStyle = '#3b0f30'; ctx.lineWidth = 1.5 * px; ctx.beginPath();
    if (st.sharp.has(q)) ctx.rect(sx - 4.5 * px, sy - 4.5 * px, 9 * px, 9 * px); else ctx.arc(sx, sy, (big ? (closing ? 9 : 6.5) : 4.5) * px, 0, 7);
    ctx.fill(); ctx.stroke();
   });
  }
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
  // A stroke that went under a higher layer, flashing where it went (underNote).
  if (st.ghost) {
   const left = (st.ghost.until - performance.now()) / 1800;
   if (left > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, left * 1.5) * .9; ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.5 * px; for (const q of st.ghost.dabs.filter((_, i, a) => i % 3 === 0 || i === a.length - 1)) { const [x, y] = p.toScreen(q.x, q.z); ctx.beginPath(); ctx.arc(x, y, st.ghost.r * p.view.scale, 0, 7); ctx.stroke(); } ctx.restore(); }
  }
  // The brush's circle at its size; while a steadied stroke is painted, the
  // circle sits where the brush is and a line (the string) runs to the pointer.
  if (st.hover && st.step === 2 && BRUSHES.includes(st.tool)) {
   const at = st.steady?.at ?? st.hover, [x, y] = p.toScreen(at.x, at.z);
   ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3 * px; ctx.beginPath(); ctx.arc(x, y, st.size * p.view.scale, 0, 7); ctx.stroke();
   ctx.strokeStyle = '#fff'; ctx.lineWidth = px; ctx.beginPath(); ctx.arc(x, y, st.size * p.view.scale, 0, 7); ctx.stroke();
   if (st.steady?.at) { const [hx, hy] = p.toScreen(st.hover.x, st.hover.z); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([3 * px, 3 * px]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]); }
  }
  if (st.align?.pairs) for (const q of st.align.pairs) { const [x, y] = p.toScreen(q.local.x, q.local.z); ctx.strokeStyle = '#ff6bd6'; ctx.strokeRect(x - 5 * px, y - 5 * px, 10 * px, 10 * px); }
 }
 const holeLine = h => { const back = h.tees.find(t => t.set === 'back') ?? h.tees[0]; return [...(back ? [[back.x, back.z]] : []), ...h.aims.map(a => [a.x, a.z]), ...(h.green ? [[h.green.x, h.green.z]] : [])]; };

 // ----------------------------------------------------------------- tools
 let dragFrom = null;
 function onTool(type, p, e) {
  st.hover = p;
  // Where the pointer is, and the ground's height there (metres), in the status bar.
  const land = L();
  if (p && land?.ground) { const i = Math.round((p.x + land.halfX) / land.cell), j = Math.round((p.z + land.halfZ) / land.cell), g = i >= 0 && j >= 0 && i < land.nx && j < land.nz ? land.ground[j * land.nx + i] : NaN; posText.textContent = `${p.x.toFixed(0)}, ${(-p.z).toFixed(0)} m${Number.isFinite(g) ? ` · ground ${g.toFixed(1)} m` : ''}`; }
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
    // THE STEADIED BRUSH (steady.js): the surface brushes trail the pointer on
    // a string set by Steadiness, and lay their dabs evenly along the way; on
    // letting go, the stroke's edge is smoothed inside the stroke only.
    const steadied = STEADIED.includes(t);
    if (type === 'down') { m.beginStroke(); st.coverAt = null; st.steady = createSteady({string: steadied ? st.steadiness / 100 * 30 * plan.px / plan.view.scale : 0, spacing: Math.max(st.land.cell * .5, st.size * .25)}); st.strokeBox = null; st.strokeDabs = []; }
    if (steadied && st.steady) {
     // On letting go the brush catches up to the pointer (steady.js `up`).
     const dabs = type === 'down' ? st.steady.down(p) : type === 'drag' ? st.steady.move(p) : type === 'up' ? st.steady.up(p) : [];
     for (const q of dabs) {
      if (t === 'brush') m.paint({x: q.x, z: q.z, radius: st.size, kind: st.kind});
      else if (t === 'erase') m.erase({x: q.x, z: q.z, radius: st.size, kind: st.kind === 'rough' ? null : st.kind});
      else m.erase({x: q.x, z: q.z, radius: st.size});
      patchCodes(q.x, q.z, st.size + 2); st.strokeDabs?.push(q);
      const b = st.strokeBox; st.strokeBox = b ? {x0: Math.min(b.x0, q.x), x1: Math.max(b.x1, q.x), z0: Math.min(b.z0, q.z), z1: Math.max(b.z1, q.z)} : {x0: q.x, x1: q.x, z0: q.z, z1: q.z};
     }
     if (type !== 'up') { plan.draw(); return; }
    }
    if (type === 'up' && steadied && st.strokeBox && st.smoothStroke && t !== 'eraseAll' && st.kind !== 'rough') {
     const b = st.strokeBox, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, reach = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2 + st.size + 2;
     m.smooth({x: cx, z: cz, radius: 1.5, area: reach, kind: st.kind});
     patchCodes(cx, cz, reach + 2);
    }
    if (type === 'up' && t === 'brush') underNote(st.strokeBox);
    if (type === 'up') st.steady?.up();
    if ((type === 'down' || type === 'drag') && !steadied) {
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
   if (PEN_TOOLS.includes(t)) {
    // THE PEN (pen.js): a click adds a node (Shift: a sharp corner); a click on
    // the first node closes the shape, whose nodes can then be dragged; Enter
    // or a double-click fills it (a creek: ends it).
    const reach = PEN_REACH * plan.px / plan.view.scale, hit = [p.x, p.z], min = t === 'creek' ? 2 : 3;
    if (st.penEdit) {
     if (type === 'down') st.penDrag = nodeAt(st.outline, hit, reach);
     if (type === 'drag' && st.penDrag >= 0) st.outline[st.penDrag] = hit;
     if (type === 'up') st.penDrag = -1;
     plan.draw(); return;
    }
    if (type === 'down') {
     if (t !== 'creek' && closesOn(st.outline, hit, reach, min)) { st.penEdit = true; st.penDrag = -1; say('Closed. Drag any node to adjust it, then press Enter (or Apply) to fill; Esc drops it.'); showToolOptions(); }
     else { st.outline.push(hit); if (e?.shiftKey) st.sharp.add(st.outline.length - 1); }
    }
    if (type === 'double' && st.outline.length >= min) closeOutline();
    plan.draw(); return;
   }
   // SELECT SHAPE, as in the 3D editor (the owner, 4 November 2026): the first
   // click selects and outlines; a drag inside moves, a drag on an anchor turns,
   // following the pointer; what lay under it shows while it is carried.
   if (t === 'select') {
    if (type === 'down') {
     const c = st.chosen, near = c ? anchorHit(c.corners.map(([x, z]) => plan.toScreen(x, z)), ...plan.toScreen(p.x, p.z), 11 * plan.px) : -1;
     if (c && c.pick.type === 'creek' && onChosen(p)) say('A creek is not moved: Delete takes it away, and the pen draws it again.');
     else if (c && (near >= 0 || onChosen(p))) st.carry = {turn: near >= 0, from: p, a0: Math.atan2(p.x - c.mid.x, p.z - c.mid.z), dx: 0, dz: 0, angle: 0, hold: null};
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
   // MEASURE (item 17): a click, then another; the line and its yards follow
   // the pointer between them.
   if (t === 'measure') {
    if (type === 'down') st.measure = !st.measure?.a || st.measure.b ? {a: {x: p.x, z: p.z}, b: null} : {...st.measure, b: {x: p.x, z: p.z}};
    if (type === 'down' && st.measure.b) say(measureWords(st.measure.a, st.measure.b));
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
    else { m.addTree({x: p.x, z: p.z, h: st.treeH, crown: st.treeH * .28, species: st.treeKind || null}); refreshCount(); }
    plan.draw(); return;
   }
  }
  // THE MARKS DRAG (the owner, 5 November 2026): a press on any tee, aim point or
  // green picks it up, on any hole; a press on open ground places the mark in
  // hand, as before. The hole's line follows as it moves; the yards when it lands.
  // ANOTHER HOLE'S MARK MOVES ONLY WHEN DRAGGED (the builder-ux goal, 10
  // November 2026): a press near another hole's mark used to pick it up at
  // once and make that hole the current one, so placing the 10th tee beside
  // the 9th green took the 9th green instead -- at Worthington, nine of the
  // eighteen holes could not be marked. Now a press there waits: a drag of
  // more than a few pixels picks the other hole's mark up; a click places the
  // mark in hand on the hole being marked. The current hole's own marks pick
  // up at once, as before.
  if (st.step === 3 && st.land) {
   const reach = 12 * plan.px / plan.view.scale, holes = st.holes.slice(0, st.holesN), under = () => markNear(holes, st.hole, p, reach);
   if (type === 'down') {
    const press = pressOn(holes, st.hole, p, reach);
    if (press.act === 'take') { st.dragMark = press.mark; canvas.style.cursor = 'grabbing'; plan.draw(); return; }
    if (press.act === 'wait') { st.dragMark = {...press.mark, waiting: true, from: p, px: [e.clientX, e.clientY]}; return; }
    markAt(p); return;
   }
   if (type === 'drag' && st.dragMark?.waiting) {
    if (Math.hypot(e.clientX - st.dragMark.px[0], e.clientY - st.dragMark.px[1]) < 5) return;
    st.dragMark.waiting = false; st.hole = st.dragMark.hole; canvas.style.cursor = 'grabbing';
   }
   if (type === 'drag' && st.dragMark) { moveMark(st.holes[st.dragMark.hole], st.dragMark, p); st.dragMark.moved = true; plan.draw(); return; }
   if (type === 'up' && st.dragMark?.waiting) { const at = st.dragMark.from; st.dragMark = null; markAt(at); return; }
   if (type === 'up' && st.dragMark) { st.dragMark = null; canvas.style.cursor = ''; go(3); return; }
   if (type === 'hover') canvas.style.cursor = under() ? 'grab' : '';
  }
  plan.draw();
 }
 st.treeH = 15; st.density = 120;
 // PAINTED UNDER (the builder-ux goal; the owner: "the way i can paint things
 // on to a layer without bleeding through to the one on top of it is great. Its
 // just not clear thats how it works"): when a brush stroke went in under a
 // higher layer, its path flashes faintly where it went and the status bar
 // says which layer stayed on top -- the first time with the rule in words.
 function underNote(box) {
  if (!box || st.kind === 'rough') return;
  const {cell, halfX, halfZ, nx, nz} = st.land, Ls = st.model.state.layers, m = Ls.masks.get(st.kind), v = Ls.view, code = PALETTE.indexOf(st.kind), r = st.size + 1;
  if (!m || code < 0) return;
  const i0 = Math.max(0, Math.floor((box.x0 - r + halfX) / cell)), i1 = Math.min(nx - 1, Math.ceil((box.x1 + r + halfX) / cell)), j0 = Math.max(0, Math.floor((box.z0 - r + halfZ) / cell)), j1 = Math.min(nz - 1, Math.ceil((box.z1 + r + halfZ) / cell));
  const over = new Map();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (m[k] && v[k] !== code && PALETTE[v[k]]) over.set(PALETTE[v[k]], (over.get(PALETTE[v[k]]) ?? 0) + 1); }
  if (!over.size) return;
  const tops = [...over.keys()].map(k => LABEL(k).toLowerCase()), what = LABEL(st.kind).toLowerCase();
  say(`The ${what} went in under the ${tops.join(' and ')}, which ${tops.length > 1 ? 'stay' : 'stays'} on top: the ${what} is there underneath.${st.toldUnder ? '' : ' Each layer paints under the ones above it in the Layers list.'}`);
  st.toldUnder = true;
  st.ghost = {dabs: st.strokeDabs ?? [], r: st.size, until: performance.now() + 1800};
  const tick = () => { plan.draw(); if (st.ghost && performance.now() < st.ghost.until) requestAnimationFrame(tick); else st.ghost = null; };
  requestAnimationFrame(tick);
 }
 function endCompare() { if (!st.compareSkin) return; st.compareSkin = false; paintCodes(); showCodes(); }
 // THE YARDS BETWEEN TWO POINTS, and the rise or fall from the land.
 const groundAt = q => { const land = L(); if (!land?.ground) return null; const i = Math.round((q.x + land.halfX) / land.cell), j = Math.round((q.z + land.halfZ) / land.cell); return i >= 0 && j >= 0 && i < land.nx && j < land.nz ? land.ground[j * land.nx + i] + (st.landEdits?.[j * land.nx + i] ?? 0) : null; };
 function measureWords(a, b) {
  const m = Math.hypot(b.x - a.x, b.z - a.z), ga = groundAt(a), gb = groundAt(b), dh = ga != null && gb != null ? gb - ga : null;
  return `${Math.round(m / .9144)} yd (${m.toFixed(1)} m)${dh != null ? `, ${dh >= 0 ? 'up' : 'down'} ${Math.abs(dh).toFixed(1)} m` : ''}`;
 }
 function rulerLine(ctx, p, a, b, words, colour = '#fde68a') {
  const [ax, ay] = p.toScreen(a.x, a.z), [bx, by] = p.toScreen(b.x, b.z), px = p.px;
  ctx.save(); ctx.lineWidth = 2 * px; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = colour; ctx.setLineDash([6 * px, 4 * px]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
  for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, 3.5 * px, 0, 7); ctx.fill(); }
  ctx.font = `700 ${13 * px}px system-ui`; const w = ctx.measureText(words).width, lx = (ax + bx) / 2 + 10 * px, ly = (ay + by) / 2 - 10 * px;
  ctx.fillStyle = 'rgba(3,12,10,.85)'; ctx.fillRect(lx - 5 * px, ly - 14 * px, w + 10 * px, 20 * px); ctx.fillStyle = '#ffffff'; ctx.fillText(words, lx, ly);
  ctx.restore();
 }
 function drawMini(ctx, p) {
  const land = L(); if (!land || st.step === 0) { mini.hidden = true; return; }
  const W = ctx.canvas.width, H = ctx.canvas.height, [ax, ay] = p.toScreen(-land.halfX, -land.halfZ), [bx, by] = p.toScreen(land.halfX, land.halfZ);
  const whole = ax >= -2 && ay >= -2 && bx <= W + 2 && by <= H + 2;
  if (whole) { const g = miniPic.getContext('2d'); g.clearRect(0, 0, 180, 180); g.drawImage(ctx.canvas, ax, ay, bx - ax, by - ay, 0, 0, 180, 180); st.miniTaken = true; st.miniDirty = false; }
  mini.hidden = whole || !st.miniTaken;
  if (mini.hidden) return;
  const g = mini.getContext('2d'); g.clearRect(0, 0, 180, 180); g.drawImage(miniPic, 0, 0);
  const w0 = p.toWorld?.(0, 0) ?? plan.toWorld(0, 0), w1 = plan.toWorld(W, H), m = (x, z) => [(x + land.halfX) / (2 * land.halfX) * 180, (z + land.halfZ) / (2 * land.halfZ) * 180];
  const [x0, y0] = m(w0.x, w0.z), [x1, y1] = m(w1.x, w1.z);
  g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.strokeStyle = '#fde68a'; g.lineWidth = 1.5; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
 }
 // FRAMING A HOLE (item 19): its tees, aim points and green in view with room round them.
 function frameHole(n) {
  const h = st.holes[n], pts = h ? [...h.tees, ...h.aims, ...(h.green ? [h.green] : [])] : [];
  if (!pts.length) return false;
  const xs = pts.map(q => q.x), zs = pts.map(q => q.z), pad = 45, w = Math.max(...xs) - Math.min(...xs) + 2 * pad, d = Math.max(...zs) - Math.min(...zs) + 2 * pad;
  plan.look((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2, Math.min(canvas.width / w, canvas.height / d));
  return true;
 }
 function goHole(n) { if (!st.holesN) return; st.hole = (n + st.holesN) % st.holesN; if (st.step === 3) go(3); frameHole(st.hole); say(`Hole ${st.hole + 1}${st.holes[st.hole]?.green ? '' : ': not marked yet'}.`); }
 // The pen put down: no nodes, not closed.
 function dropPen() { st.outline = []; st.sharp = new Set(); st.penEdit = false; st.penDrag = -1; }
 function closeOutline() {
  // A double-click adds its own two clicks as nodes; they are one point. The
  // shape filled is the pen's curve through the nodes (pen.js), the very
  // points the plan showed while drawing.
  const keep = st.outline.map((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > .05);
  const nodes = st.outline.filter((_, i) => keep[i]), sharp = [];
  st.outline.forEach((_, i) => { if (keep[i] && st.sharp.has(i)) sharp.push(keep.slice(0, i).filter(Boolean).length); });
  const ring = nodes.length >= (st.tool === 'creek' ? 2 : 3) ? penCurve(nodes, {closed: st.tool !== 'creek', sharp, step: Math.max(.5, st.land.cell)}) : nodes;
  dropPen();
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
  if (e.key === 'Escape') { dropPen(); chooseShape(null); plan.draw(); }
  // Backspace takes the last node off a shape being drawn (the pen).
  if (e.key === 'Backspace' && st.outline.length && !st.penEdit) { e.preventDefault(); st.sharp.delete(st.outline.length - 1); st.outline.pop(); plan.draw(); }
  // The unlocked picture nudged: a quarter metre a press, a metre with Shift.
  const nudge = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (nudge && st.step === 2 && st.tool === 'align' && !st.picLocked) { e.preventDefault(); const s = e.shiftKey ? 1 : .25; st.offset = {x: st.offset.x + nudge[0] * s, z: st.offset.z + nudge[1] * s}; relay(); }
  // Undo and Redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z) are the Edit menu's now (menus()).
 };
 window.addEventListener('keydown', onKey);

 // ----------------------------------------------------------------- steps
 const steps = [stepLidar, stepLand, stepTrace, stepHoles, stepName, stepReview];
 const can = n => n === 0 || (n === 1 && (!!st.preview || !!st.land)) || (n >= 2 && !!st.land && (n < 3 || !!st.model) && (n < 4 || st.holes.slice(0, st.holesN).every(h => h?.green && h.tees.length)) && (n !== 2 || true));
 function go(n) {
  if (!can(n)) return;
  st.step = n; dropPen();
  if (n !== 5) { plan.clearLayer('course'); st.doc = null; }
  plan.showLayer('picture', n !== 5 && st.picOn !== false); plan.showLayer('coverage', n === 0); showCodes();
  stepBar();
  palette.hidden = true;
  if (n > 0) keepNow();
  panel.replaceChildren(introFor(n), ...steps[n]().filter(Boolean));
  menus();
  // Step 1's left drag draws the property box and step 4's left click places
  // a marker (the view drags with the right button or Space there); step 3
  // keeps its tool; the rest only move the view. (First built with Move on
  // every step but the trace, and the owner found no way to box the course.)
  setTool(n === 0 ? 'box' : n === 3 ? 'mark' : n === 2 && st.model ? st.traceTool ?? 'brush' : 'move');
  plan.draw();
 }
 st.go = go;
 // THE STEP BAR (the builder-ux goal; the owner: "The 'flow' through the steps
 // isnt always clear"): each step a chip -- ticked when done, filled where you
 // are, dimmed with the reason when it cannot be reached yet -- what this step
 // still needs, and one Next button, always in the same place. Replaced six
 // equal buttons in a grid and a Next at the foot of a long column.
 // WHAT EACH STEP IS FOR, in a line at the top of its panel (the builder-ux
 // goal; the owner: "We might need different UI elements to help guide the
 // player").
 const INTRO = [
  "Bring the LIDAR, the laser survey of the ground: search for it by the course's name, or open files you have. Then drag a box round the property on the relief.",
  "Build the land: the ground's heights, the trees and the water, read from the survey. It takes from a few seconds to a minute.",
  "Draw the course over the aerial picture: lay OpenStreetMap's version if the club is mapped, then fix it with the tools on the left -- or draw it yourself.",
  'Mark each hole: its back tee (and the others if you like), any bends, and its green, then Next hole. The scorecard below fills itself in.',
  'Name the course, and credit the survey and the picture you used.',
  'Look the course over as it will play. Open it in the editor to shape it in 3D, or save it now.'];
 // FIRST-VISIT TIPS (item 13): each step's line is a tip until it is closed
 // with Got it, remembered in this browser; after that the step opens on its
 // work. Help > Show the step tips again brings them back.
 const TIPS_KEY = 'fairway-builder-tips-seen';
 const tipsSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(TIPS_KEY) || '[]')); } catch { return new Set(); } };
 function introFor(n) {
  if (tipsSeen().has(n)) return null;
  return el('div', {class: 'cb-intro'}, el('b', {}, STEPS[n].slice(2)), el('span', {}, INTRO[n]),
   el('button', {class: 'cb-btn cb-gotit', type: 'button', title: 'Close this tip; it will not show again (Help > Show the step tips again)', onclick: e => { const seen = tipsSeen(); seen.add(n); try { localStorage.setItem(TIPS_KEY, JSON.stringify([...seen])); } catch { /* private window */ } e.target.closest('.cb-intro').remove(); }}, 'Got it'));
 }
 st.showTipsAgain = () => { try { localStorage.removeItem(TIPS_KEY); } catch { /* none kept */ } go(st.step); };
 const NEXT = ['Next: build the land', 'Next: trace the course', 'Next: the holes', 'Next: the name', 'Next: review the course', null];
 const BLOCKED = ['', 'Choose LIDAR files first', 'Build the land first', 'Start the trace first', 'Every hole needs a tee and a green first', 'Every hole needs a tee and a green first'];
 function needs(n) {
  if (n === 0) return !st.preview && !st.land ? 'Choose LIDAR files, search for LIDAR, or load them from your folder.' : !st.box && !st.land ? 'Drag a box round the property on the relief.' : '';
  if (n === 1) return st.land ? '' : 'Build the land from the LIDAR.';
  if (n === 2) return st.model ? '' : 'Start the trace: lay OpenStreetMap\'s course, or draw it yourself.';
  if (n === 3) {
   const missing = st.holes.slice(0, st.holesN).map((h, i) => !h?.tees.length || !h?.green ? i + 1 : 0).filter(Boolean);
   return missing.length ? `${missing.length === 1 ? 'Hole' : 'Holes'} ${missing.length > 4 ? missing.slice(0, 4).join(', ') + ` and ${missing.length - 4} more` : missing.join(', ')} still ${missing.length === 1 ? 'needs' : 'need'} a tee and a green.` : '';
  }
  if (n === 4) return st.name?.trim() ? '' : 'Give the course a name.';
  return '';
 }
 function stepBar() {
  const n = st.step, done = i => i < n && can(i + 1);
  stepChips.replaceChildren(...STEPS.flatMap((s, i) => [
   i ? el('span', {class: 'cb-steparrow', 'aria-hidden': 'true'}, '›') : null,
   el('button', {class: 'cb-stepchip' + (i === n ? ' cb-here' : done(i) ? ' cb-done' : ''), type: 'button', disabled: !can(i), title: can(i) ? s.slice(2) : BLOCKED[i], 'aria-current': i === n ? 'step' : null, onclick: () => go(i)},
    el('i', {}, done(i) ? '✓' : String(i + 1)), s.slice(2))].filter(Boolean)));
  stepNeeds.textContent = needs(n);
  nextBtn.hidden = !NEXT[n];
  if (NEXT[n]) { nextBtn.textContent = NEXT[n]; nextBtn.classList.toggle('cb-wait', !can(n + 1)); nextBtn.title = can(n + 1) ? '' : BLOCKED[n + 1]; nextBtn.onclick = () => { if (can(n + 1)) go(n + 1); else say(n + 1 === 4 ? 'Every hole needs a tee and a green.' : needs(n) || 'Finish this step first.', true); }; }
 }
 st.stepBar = stepBar;
 // DOOR 2'S MENUS (menu.js): Edit's undo, View's zoom and what is shown, every
 // trace tool with its key, and the experimental auto trace.
 const tracing = () => st.step === 2 && !!st.model;
 function menus() {
  const toolItems = TOOL_LIST.map(([k, label, key]) => ({label, key, enabled: tracing, checked: () => st.tool === k, run: () => setTool(k)}));
  useMenus({
   edit: [{label: () => names.undo.length ? `Undo ${names.undo.at(-1)}` : 'Undo', key: 'Ctrl+Z', enabled: () => !!st.model, run: () => undoNow()}, {label: () => names.redo.length ? `Redo ${names.redo.at(-1)}` : 'Redo', key: ['Ctrl+Y', 'Ctrl+Shift+Z'], enabled: () => !!st.model, run: () => undoNow(true)}, {sep: true},
    // COPY, PASTE, DUPLICATE, DELETE (item 18): what Select shape has chosen.
    {label: 'Copy', key: 'Ctrl+C', enabled: () => tracing() && !!st.chosen, run: () => { st.clip = {pick: st.chosen.pick, mid: {...st.chosen.mid}, what: st.chosen.what}; say(`Copied the ${st.chosen.what}: Paste (Ctrl+V) puts it where the pointer is.`); }},
    // Named like a tool's change, so History and "Undo Duplicate" show them
    // (found by the evidence pictures, 10 November 2026: a key or menu
    // change went into the undo with no name, and History said nothing yet).
    {label: 'Paste at the pointer', key: 'Ctrl+V', enabled: () => tracing() && !!st.clip, run: named('Paste', () => pasteAt(st.hover ?? {x: st.clip.mid.x + 20, z: st.clip.mid.z + 20}))},
    {label: 'Duplicate', key: 'Ctrl+D', enabled: () => tracing() && !!st.chosen, run: named('Duplicate', () => { st.clip = {pick: st.chosen.pick, mid: {...st.chosen.mid}, what: st.chosen.what}; pasteAt({x: st.chosen.mid.x + 15, z: st.chosen.mid.z + 15}); })},
    {label: 'Delete', key: 'Delete', enabled: () => tracing() && !!st.chosen, run: named('Delete', () => { const what = st.chosen.what; st.model.remove(st.chosen.pick); st.chosen = null; paintCodes(); refreshCount(); plan.draw(); say(`The ${what} deleted. Undo puts it back.`); })}],
   view: [{label: 'Zoom in', key: ['=', '+'], run: () => plan.zoomBy(1.5)}, {label: 'Zoom out', key: '-', run: () => plan.zoomBy(1 / 1.5)}, {label: 'Whole land', key: 'F', run: () => { st.miniDirty = true; plan.fit(); }}, {sep: true},
    // THE HOLE NAVIGATOR (item 19).
    {label: 'This hole, framed', key: 'Shift+F', enabled: () => st.step >= 2 && !!st.holes[st.hole]?.tees?.length, run: () => frameHole(st.hole)},
    {label: 'Next hole', key: '.', enabled: () => st.step >= 2 && st.holes.some(h => h?.tees?.length), run: () => goHole(st.hole + 1)},
    {label: 'Previous hole', key: ',', enabled: () => st.step >= 2 && st.holes.some(h => h?.tees?.length), run: () => goHole(st.hole - 1)}, {sep: true},
    {label: 'The picture', checked: () => st.picOn !== false, run: () => { st.picOn = st.picOn === false; plan.showLayer('picture', st.picOn); }},
    {label: 'The trace', checked: () => !!st.traceOn, run: () => { st.traceOn = !st.traceOn; showCodes(); }},
    {label: 'The trace as it will play (smooth)', checked: () => !!st.smoothView, run: () => { st.smoothView = !st.smoothView; if (st.smoothView) buildVec(); else { st.vec = null; showCodes(); } }},
    {label: 'The LIDAR over the picture', checked: () => !!st.lidarOnTop, run: () => { st.lidarOnTop = !st.lidarOnTop; viewLayers(); go(st.step); }}],
   tools: [...toolItems, {sep: true}, {label: 'Smaller brush', key: '[', enabled: tracing, run: () => brushSize(-1)}, {label: 'Larger brush', key: ']', enabled: tracing, run: () => brushSize(1)},
    {sep: true}, {heading: 'Experimental'}, {label: 'Auto trace (a rough start to fix by hand)', enabled: () => st.step === 2 && !!st.land, run: () => autoTrace()}],
   help: [{label: 'Show the step tips again', run: () => st.showTipsAgain()}],
   keys: [{group: 'The plan', label: 'Move the view', key: 'Right-drag or Space+drag'}, {group: 'The plan', label: 'Zoom', key: 'Wheel'}, {group: 'The plan', label: 'Close an outline', key: 'Enter or double-click'}, {group: 'The plan', label: 'Drop an outline or a selection', key: 'Esc'}, {group: 'The plan', label: 'Nudge the unlocked picture', key: 'Arrows (Shift: 1 m)'}],
  });
 }
 function pasteAt(at) {
  const c = st.clip; if (!c || !st.model) return;
  const dx = at.x - c.mid.x, dz = at.z - c.mid.z;
  st.model.copy(c.pick, dx, dz);
  paintCodes(); refreshCount();
  // The copy selected, ready to move.
  if (st.tool !== 'select') setTool('select');
  chooseShape(c.pick.type === 'shape' ? st.model.pickAt({x: at.x, z: at.z, kind: c.pick.kind}) : c.pick.type === 'tree' ? {type: 'tree', index: st.model.state.trees.length - 1} : {type: 'home', index: st.model.state.homes.length - 1});
  plan.draw(); say(`A copy of the ${c.what}, selected: drag it where it belongs. Undo takes it back.`);
 }
 function brushSize(d) { st.size = Math.max(1, Math.min(60, Math.round(st.size * (d > 0 ? 1.25 : .8)) + (d > 0 ? 1 : 0))); const r = panel.querySelector('.cb-brushsize'); if (r) r.value = st.size; showHint(); plan.draw(); }
 const toolSet = (title, keys) => el('div', {class: 'cb-toolset'}, title ? el('b', {}, title) : null, el('div', {class: 'cb-btns'}, ...toolButtons.filter(b => keys.includes(b.dataset.tool))));
 const toolOption = (keys, ...nodes) => el('div', {class: 'cb-toolopt', 'data-for': keys.join(' ')}, ...nodes);
 function showToolOptions() {
  if (st.toolTitle) st.toolTitle.textContent = (TOOL_LIST.find(t => t[0] === st.tool)?.[1]) ?? (st.tool === 'boundary' ? 'Course boundary' : st.tool === 'align' ? 'Lining up the picture' : 'Tools'); for (const n of panel.querySelectorAll('[data-for]')) n.hidden = !n.dataset.for.split(' ').includes(st.tool); st.coverPut?.(); }
 // What is selected, with its outline and anchors. A tree is round: no anchors.
 function chooseShape(pick) {
  if (!pick) { st.chosen = null; return; }
  const {nx, nz, cell, halfX, halfZ} = st.land, m = st.model.state;
  let rings, mid, what;
  if (pick.type === 'shape') {
   const mask = new Uint8Array(nx * nz); let sx = 0, sz = 0;
   for (const k of pick.cells) { mask[k] = 1; sx += -halfX + (k % nx) * cell; sz += -halfZ + Math.floor(k / nx) * cell; }
   rings = layerRings(mask, st.land).sort((a, b) => b.length - a.length); mid = {x: sx / pick.cells.length, z: sz / pick.cells.length}; what = LABEL(pick.kind).toLowerCase();
  } else if (pick.type === 'creek') {
   const c = m.creekLines[pick.index].points; rings = [[...c, ...c.slice().reverse()]]; mid = {x: c[Math.floor(c.length / 2)][0], z: c[Math.floor(c.length / 2)][1]}; what = 'creek';
  } else if (pick.type === 'home') {
   const h = m.homes[pick.index], c = Math.cos(h.rotation), sn = Math.sin(h.rotation), a = h.width / 2, b = h.depth / 2;
   rings = [[[-a, -b], [a, -b], [a, b], [-a, b]].map(([u, v]) => [h.x + u * c + v * sn, h.z - u * sn + v * c])]; mid = {x: h.x, z: h.z}; what = 'house';
  } else {
   const t = m.trees[pick.index], r = Math.max(1.5, t.crown * st.treeScale);
   rings = [Array.from({length: 24}, (_, k) => [t.x + Math.cos(k / 24 * Math.PI * 2) * r, t.z + Math.sin(k / 24 * Math.PI * 2) * r])]; mid = {x: t.x, z: t.z}; what = 'tree';
  }
  if (!rings.length) { st.chosen = null; return; }
  st.chosen = {pick, rings, mid, what, corners: pick.type === 'tree' || pick.type === 'creek' ? [] : cornersOf(rings[0]), cells: pick.type === 'shape' ? new Set(pick.cells) : null};
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
   const before = Uint8Array.from(st.model.state.layers.view);
   const g = st.landEdits ? Float32Array.from(st.land.ground, (v, k) => v + st.landEdits[k]) : st.land.ground, got = st.model.skin({bio: BIOMES[st.landscape], ground: g}), name = k => LABEL(k).toLowerCase();
   const ha = n => `${(n * st.land.cell ** 2 / 1e4).toFixed(1)} ha`;
   if (got.cells.face || got.cells.apron) { st.preSkin = before; st.compareSkin = false; }
   paintCodes(); refreshCount(); plan.draw(); go(2);
   say(got.cells.face || got.cells.apron ? `Skinned from the land: ${name(got.kinds.face)} on ${ha(got.cells.face)} of steep ground${got.kinds.apron ? `, ${name(got.kinds.apron)} on ${ha(got.cells.apron)} below it` : ''}. Hold Before to compare; paint over it or Undo.` : 'Nothing here is steep enough to skin; paint the ground by hand instead.');
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
 // The Next button lives in the step bar now (stepBar); a step's panel ends without one.
 const next = () => null;
 let toolButtons = [];
 // The picture is unlocked only while the Align tool is held: any other tool
 // locks it again, so a brush stroke never drags it.
 function setTool(t) {
  if (t !== 'align') st.picLocked = true;
  if (t !== 'select') { st.chosen = null; st.carry = null; }
  if (t !== 'sizeTree') st.sizing = null;
  st.tool = t; if (st.step === 2 && t !== 'align') st.traceTool = t; plan.setTool(t === 'move' ? 'move' : 'draw'); dropPen();
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
    rows.length > 1 ? el('div', {class: 'cb-btns'},
     el('button', {class: 'cb-btn', type: 'button', 'data-folder': 'all', title: 'Tick every file in the list', onclick: () => ticks.forEach(t => { t.checked = true; })}, 'Tick all'),
     el('button', {class: 'cb-btn', type: 'button', 'data-folder': 'none', title: 'Untick every file in the list', onclick: () => ticks.forEach(t => { t.checked = false; })}, 'Untick all')) : null,
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
 // BUILD IT FOR ME (the builder-ux goal, item 6; the owner: "A real course for
 // me depending on if there is open street map data can be like 15 mins. Its
 // really fast and i like that"): door 2's own steps, run one after another
 // from a course's name -- the place, the newest USGS survey that covers the
 // most of the square, the land, the sharpest picture, OpenStreetMap's course
 // lined up with the LIDAR, its holes and its name -- stopping only to ask what
 // it cannot decide (which place of several) or when something is missing (no
 // survey that downloads here, a course not on the map). Every step stays
 // there to do by hand, and everything it did can be changed after.
 function buildField() {
  const name = el('input', {class: 'cb-buildname', placeholder: 'A golf course, by name (and town)', value: st.find?.label ?? '', onkeydown: e => { if (e.key === 'Enter') buildForMe(name.value); }});
  return el('div', {class: 'cb-field cb-buildme'}, el('label', {}, 'Build it for me'),
   el('small', {}, 'Type the course\'s name and the builder does the steps for you: finds it, downloads the USGS LIDAR, builds the land, fetches the aerial picture, lays the course from OpenStreetMap and lines it up, and marks the holes. United States courses; it goes online as it works. You can change everything after.'),
   el('div', {class: 'cb-row', style: 'margin:4px 0'}, name, el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-build': 'go', title: 'Run every step for this course', onclick: () => buildForMe(name.value)}, 'Build it for me')), buildList);
 }
 const buildList = el('ul');
 async function buildForMe(text, place = null) {
  if (!place && !text.trim()) return say('Type the course\'s name first.', true);
  // The folder first, while the press still counts as one (a browser asks for
  // leave to use a folder only inside a click).
  const dir = await ensureFolder();
  const t0 = Date.now(), took = () => `${Math.round((Date.now() - t0) / 1000)} s`, done = [];
  const log = line => { done.push(line); say(line); };
  if (!place) {
   setBusy(`Finding ${text.trim()}…`);
   let found = [];
   try { found = await PROVIDERS.usgs.search(null, text.trim()); } catch (e) { setBusy(''); return say('The search failed: ' + e.message, true); }
   setBusy('');
   if (!found.length) return say(`Nothing found called ${text.trim()}. Try the name with its town.`, true);
   // A golf course on the map wins over the town it is named after; one golf
   // course is taken without asking. Otherwise the player picks, golf courses
   // first, and the build goes on.
   const golf = found.filter(f => f.golf);
   if (golf.length === 1) found = golf; else if (golf.length > 1) found = [...golf, ...found.filter(f => !f.golf)];
   if (found.length > 1 && golf.length !== 1) { resultList(buildList, found, f => { buildList.replaceChildren(); buildForMe(text, f); }); return say(`${found.length} places found: click the one you mean, and the build goes on.`); }
   place = found[0];
  }
  st.find = place; st.findSize ??= 1500;
  // 1. The newest USGS survey that covers the most of the square.
  setBusy(`Searching USGS for LIDAR round ${place.label.split(',')[0]}…`);
  const box = squareAround(place.lon, place.lat, st.findSize); st.findBox = box;
  let surveys = [];
  try { surveys = (await searchLidar('usgs', box)).filter(f => f.ept); } catch (e) { setBusy(''); return say('The LIDAR search failed: ' + e.message, true); }
  setBusy('');
  if (!surveys.length) { go(0); await searchAll(); return say('No USGS survey here downloads in the builder. The sources that cover the place are listed under Find LIDAR: download one, load it, and carry on by hand.', true); }
  const ranked = surveys.map(f => ({f, share: coverFor(f, box).share ?? 0, date: String(f.date ?? '')})).sort((a, b) => b.share - a.share || b.date.localeCompare(a.date));
  const pick = ranked[0].f;
  const before = st.sources.length;
  await fetchLidar(pick);
  if (st.sources.length === before) return;
  log(`LIDAR: ${pick.title} (${took()}).`);
  // 2. The land.
  await buildLand();
  if (!st.land) return;
  log(`The land built (${took()}).`);
  go(2);
  // 3. The sharpest picture this place has.
  const offer = providersAt(place.lon, place.lat).filter(k => PROVIDERS[k].free);
  if (offer.length) { await fetchImagery(offer[0], '', {}); if (st.pics.length) log(`The picture: ${PROVIDERS[offer[0]].name} (${took()}).`); }
  // 4. OpenStreetMap's course, lined up with the LIDAR.
  st.osmFailed = null;
  await loadOsm();
  // OpenStreetMap did not answer (a busy server): say so, and leave the trace
  // step ready to ask again -- not a blank trace, which would read as no map.
  if (st.osmFailed) { go(2); return say(`OpenStreetMap did not answer (${st.osmFailed}), ${took()} in. The land and the picture are ready: press Fetch OpenStreetMap to ask again, or draw the course yourself.`, true); }
  const laid = st.osm?.laid ? Object.values(st.osm.laid).reduce((a, b) => a + b, 0) : 0;
  if (!st.model || !laid) {
   if (!st.model) manualTrace();
   return say(`OpenStreetMap has no course drawn here (${took()}): the land and the picture are ready -- draw the course with the tools, then mark the holes.`, true);
  }
  await refineOsm('lidar');
  const course = st.osm.courses.find(c => c.id === st.osm.course);
  // The map's own name for the course; 'A golf course' is osm-course.js's word
  // for one the map leaves unnamed, so the place's name is used instead.
  if (course?.name && course.name !== 'A golf course' && (!st.name || st.name === 'My real course')) st.name = course.name;
  else if (!st.name || st.name === 'My real course') st.name = place.label.split(',')[0];
  const marked = st.holes.slice(0, st.holesN).filter(h => h?.green && h.tees.length).length;
  log(`The course from OpenStreetMap, lined up with the LIDAR: ${marked} of ${st.holesN} holes marked (${took()}).`);
  st.built = {took: (Date.now() - t0) / 1000, steps: done};
  const bends = addBends(.4);
  if (bends) log(`${bends} dogleg${bends === 1 ? '' : 's'} found down the fairways (${took()}).`);
  const doubts = mapDoubts(), verdict = mapVerdict(st.holes.slice(0, st.holesN), doubts);
  st.built.doubts = doubts.length;
  if (doubts.length) { go(3); say(`Built in ${took()}: ${st.name}, ${marked} of ${st.holesN} holes from OpenStreetMap -- ${verdict.words} The list is under Checking the map; the red rings show where.`, verdict.unreliable); }
  else if (marked === st.holesN && can(5)) { go(4); go(5); say(`Built in ${took()}: ${st.name}, ${st.holesN} holes. Look it over here; open it in the editor, or go back to any step to change it.`); }
  else { go(3); say(`Built in ${took()}, but OpenStreetMap leaves ${st.holesN - marked} of ${st.holesN} holes without a tee or a green: mark them here (Next hole), then the name and the review.`, true); }
 }
 // A KEPT DRAFT OFFERED BACK, on a fresh door 2 (item 12).
 const recoverBox = el('div');
 if (!draft) keptDraft().then(k => {
  if (!k || st.land) return;
  const when = new Date(k.at).toLocaleString(undefined, {weekday: 'short', hour: '2-digit', minute: '2-digit'});
  recoverBox.replaceChildren(el('div', {class: 'cb-field cb-recover'}, el('div', {class: 'cb-panehead'}, 'Work kept from last time', el('small', {}, when)),
   el('small', {}, `${k.name || 'A course'}, at step ${(k.step ?? 0) + 1}, kept in this browser ${when}. Bring it back to carry on, or discard it.`),
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-recover': 'yes', onclick: async () => { setBusy('Bringing it back…'); try { await openSaved(await readDraft(k.bytes)); } catch (e) { say('Could not bring it back: ' + e.message, true); } finally { setBusy(''); } }}, 'Bring it back'),
    el('button', {class: 'cb-btn', type: 'button', 'data-recover': 'no', onclick: () => { dropDraft(); recoverBox.replaceChildren(); say('The kept work is discarded.'); }}, 'Discard'))));
 });
 function stepLidar() {
  return [recoverBox, buildField(), findField(), folderField(), el('div', {class: 'cb-field'}, el('label', {}, 'Load the LIDAR'),
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
 const countText = el('small'), layerBox = el('ul', {class: 'cb-layers', style: 'list-style:none;padding:0'}), underLine = el('div', {class: 'cb-under'});
 // THE LAYERS (the owner, 1 November 2026): each surface its own, top first;
 // click one to paint it, the eye to hide it from view.
 // The layers offered: the landscape's own (layersFor) and any other that
 // holds something, in the game's order, rough last.
 const kindsShown = () => { const own = layersFor(BIOMES[st.landscape]), have = st.model?.layersPresent() ?? []; return [...LAYER_ORDER.filter(k => own.includes(k) || have.includes(k)), 'rough']; };
 // WHAT A STROKE GOES UNDER (the builder-ux goal): the layers above the one
 // being painted that hold something stay on top of it, so say which.
 function underWords() {
  const all = kindsShown(), i = all.indexOf(st.kind);
  if (st.kind === 'rough') return ['Rough takes every layer off where you paint it.'];
  const Ls = st.model.state.layers, above = all.slice(0, Math.max(0, i)).filter(k => k !== 'rough' && Ls.masks.get(k)?.some(v => v));
  return above.length ? [`${LABEL(st.kind)} goes under `, el('b', {}, above.map(k => LABEL(k)).join(', ')), ', which stay on top where they are painted.'] : [`${LABEL(st.kind)} is the top layer painted here: it shows wherever you paint it.`];
 }
 function layersList() {
  if (!st.model) return;
  underLine.replaceChildren(...underWords());
  const L = st.model.state.layers, a = st.land.cell ** 2, own = layersFor(BIOMES[st.landscape]);
  layerBox.replaceChildren(...kindsShown().map(k => {
   const rough = k === 'rough', m = L.masks.get(k), n = rough ? L.codes.reduce((t, c) => t + (c ? 0 : 1), 0) : m ? m.reduce((t, v) => t + v, 0) : 0;
   const col = rough ? hex(BIOMES[st.landscape].rough ?? '#5f7f3f') : COLOUR[k] ?? [128, 128, 128], ha = `${(n * a / 1e4).toFixed(2)} ha`;
   return el('li', {class: (k === st.kind ? 'cb-cur cb-chosen' : '') + (n ? '' : ' cb-empty'), 'data-layer': k, style: 'display:flex;gap:6px;align-items:center;cursor:pointer;padding:2px 0', onclick: () => { st.kind = k; const sel = panel.querySelector('.cb-kind'); if (sel) sel.value = k; layersList(); showHint(); showModel(); }},
    rough ? el('span', {style: 'width:28px;flex:none'}) : eyeButton(document, k, LABEL(k), L.hidden.has(k), () => { st.model.setHidden(k, !L.hidden.has(k)); paintCodes(); layersList(); }),
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
 st.surveyPlace = surveyPlace;   // for the smoke journeys and bench/shots/build-for-me.mjs
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
  // THE PALETTE (the builder-ux goal): every tool an icon with its key, in
  // groups, down the left of the plan; the name on hover and in the status
  // bar. The buttons keep the tools' names, for a screen reader and the tests.
  toolButtons = TOOL_LIST.map(([k, t, key]) => el('button', {class: 'cb-tool' + (st.tool === k ? ' cb-on' : ''), type: 'button', 'data-tool': k, 'aria-label': t, title: key ? `${t} (${key})` : t, onclick: () => setTool(k)}));
  toolButtons.forEach((b, i) => { b.innerHTML = icon(TOOL_LIST[i][0]); if (TOOL_LIST[i][2]) b.append(el('kbd', {'aria-hidden': 'true'}, TOOL_LIST[i][2].replace('Shift+', '⇧'))); });
  palette.replaceChildren(...toolButtons.flatMap((b, i) => i && TOOL_LIST[i][3] !== TOOL_LIST[i - 1][3] ? [el('hr'), b] : [b]));
  palette.hidden = !st.model;
  // LOCK AND UNLOCK (the owner, 1 November 2026: "drag the satellite picture
  // to align and lock/unlock it"): unlocked, a left drag or the arrow keys
  // move the picture; locked -- as it starts, and as any other tool leaves it
  // -- nothing moves it.
  const alignBtn = el('button', {class: 'cb-btn' + (st.tool === 'align' ? ' cb-on' : ''), type: 'button', 'data-tool': 'align', onclick: () => {
   if (!st.picLocked) { setTool(st.model ? st.traceTool ?? 'brush' : 'move'); return say(`The picture is locked, ${Math.hypot(st.offset.x, st.offset.z).toFixed(2)} m from where its position put it.`); }
   if (!st.pics.length || st.picShow === 'lidar') return say(st.pics.length ? 'Show a fetched picture or a file first (Showing): the LIDAR\'s own needs no lining up.' : 'Bring a picture with a position first.', true);
   st.picLocked = false; setTool('align'); say('Unlocked: drag the picture into line with the LIDAR -- see-through, or the LIDAR over it, makes it easier (Viewing).');
  }}, st.picLocked ? 'Unlock the picture' : 'Lock the picture');
  toolButtons.push(alignBtn);
  const pct = (key, after) => el('input', {type: 'range', min: 0, max: 100, value: Math.round(st[key] * 100), 'data-alpha': key, oninput: e => { st[key] = +e.target.value / 100; viewLayers(); after?.(); }});
  // FOLDING SECTIONS (the builder-ux goal): the step's own business, each one
  // a line until opened; which are open is kept for the session. Picture and
  // OpenStreetMap start open until there is a picture and a trace.
  const fold = (key, title, note, open, ...kids) => {
   const d = el('details', {class: 'cb-fold' + (key === 'experimental' ? ' cb-experimental' : ''), 'data-fold': key}, el('summary', {}, title, note ? el('small', {}, note) : null), el('div', {class: 'cb-foldbody'}, ...kids));
   d.open = st.folds?.[key] ?? open;
   d.addEventListener('toggle', () => { (st.folds ??= {})[key] = d.open; });
   return d;
  };
  const picture = fold('picture', 'Picture', st.pics.length ? (st.picLocked ? 'locked' : 'unlocked') : 'none yet', !st.pics.length,
   el('small', {}, 'An aerial photo to trace over, fetched for this land or from a file. If it sits off, unlock it and drag it into line with the LIDAR, then lock it. Kept in your saved file, never drawn in the game, and left out of a copy made to share.'),
   prov, keyIn, howTo, terms,
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => fetchImagery(prov.value, keyIn.value.trim(), keys)}, 'Fetch imagery for this land'),
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: choosePicture}, 'A picture file'), el('button', {class: 'cb-btn', type: 'button', onclick: useLidarColour}, 'The LIDAR\'s own'),
    alignBtn, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.offset = {x: 0, z: 0}; relay(); showHint(); }}, 'Back to its position')),
   st.pics.length ? el('small', {}, 'Showing (every picture fetched or brought is kept, each with its own lining up)') : null,
   ...st.pics.filter(q => q.pic?.date).map(q => el('small', {class: 'cb-picdate'}, `${q.label}: photographed ${new Date(q.pic.date).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}.`)),
   st.pics.length ? el('select', {class: 'cb-picshow', onchange: e => showPic(e.target.value)}, [...new Map(st.pics.map(p => [p.group, p.label])), ['lidar', 'The LIDAR\'s own']].map(([g, label]) => el('option', {value: g, selected: g === st.picShow}, label + (g === 'files' ? ` (${st.pics.filter(p => p.group === 'files').length})` : '')))) : null,
   ll ? null : el('div', {class: 'cb-row', style: 'margin:4px 0'}, place, el('button', {class: 'cb-btn', type: 'button', onclick: () => searchPlace(prov.value, keyIn.value.trim(), place.value, found)}, 'Find')), found);
  // THE LIDAR AND THE PICTURE TOGETHER (the owner, 1 November 2026): each
  // with its own opacity, either on top.
  const viewing = fold('viewing', 'Viewing', 'what shows, how strongly', false, el('div', {class: 'cb-viewing', style: 'display:flex;flex-direction:column;gap:4px'},
   el('small', {}, 'The LIDAR as'), el('select', {class: 'cb-lidarview', onchange: e => { st.lidarView = e.target.value; paintLidar(); }}, LIDAR_VIEWS.map(k => el('option', {value: k, selected: k === st.lidarView}, {relief: 'Shaded relief', brightness: 'The laser\'s brightness', slope: 'Slope (edges bright)'}[k]))),
   el('small', {}, 'LIDAR opacity'), pct('lidarAlpha'),
   el('small', {}, 'Picture opacity'), pct('picAlpha'),
   el('small', {}, 'Trace opacity'), pct('traceAlpha', () => plan.draw()),
   // THE PICTURE'S BRIGHTNESS AND CONTRAST (item 20): how it is drawn here
   // only; the picture kept in the file is unchanged.
   el('small', {}, 'Picture brightness'), el('input', {type: 'range', min: 50, max: 180, value: Math.round((st.picLight ?? 1) * 100), 'data-look': 'brightness', oninput: e => { st.picLight = +e.target.value / 100; lookPicture(); }}),
   el('small', {}, 'Picture contrast'), el('input', {type: 'range', min: 50, max: 200, value: Math.round((st.picContrast ?? 1) * 100), 'data-look': 'contrast', oninput: e => { st.picContrast = +e.target.value / 100; lookPicture(); }}),
   el('button', {class: 'cb-btn', type: 'button', title: 'The picture as fetched', onclick: () => { st.picLight = st.picContrast = 1; lookPicture(); go(2); }}, 'Reset the picture\'s look'),
   el('button', {class: 'cb-btn cb-lidartop', type: 'button', onclick: e => { st.lidarOnTop = !st.lidarOnTop; viewLayers(); e.target.textContent = st.lidarOnTop ? 'Picture on top' : 'LIDAR on top'; }}, st.lidarOnTop ? 'Picture on top' : 'LIDAR on top')));
  // OPENSTREETMAP FIRST (the owner, 1 November 2026): the course as mappers
  // have drawn it, kept as it is or refined from the picture or the LIDAR.
  const osmBits = [
   el('small', {}, 'Many courses are already drawn in OpenStreetMap: greens, fairways, tees, bunkers, water, paths, woods and numbered holes, laid as layers and markers. Credited in the course (ODbL). Goes online only when pressed. It can be incomplete or wrong: check it against the picture.'),
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => loadOsm()}, 'Fetch OpenStreetMap'), el('button', {class: 'cb-btn', type: 'button', onclick: () => loadOsm(true)}, 'An OpenStreetMap file')),
   st.osm ? el('small', {}, st.osm.said) : null,
   // WHICH COURSE (osm-course.js osmCourses): a club with two or more, each
   // its own holes and boundary.
   st.osm?.courses?.length > 1 ? el('small', {}, 'Course') : null,
   st.osm?.courses?.length > 1 ? el('select', {class: 'cb-osmcourse', style: 'width:100%', title: 'Which of the club\'s courses to build: its holes and its boundary', onchange: e => pickCourse(e.target.value)},
    st.osm.courses.map(c => el('option', {value: c.id, selected: c.id === st.osm.course}, `${c.name} (${c.holes} hole${c.holes === 1 ? '' : 's'} numbered)`))) : null,
   // WHOSE TREES (osm.js mergeTrees; the owner, 1 November 2026).
   // Not on a draft from before version 3, which has no map trees to choose:
   // the choice would have dropped them.
   st.osm?.osmTrees ? el('small', {}, 'Trees') : null,
   st.osm?.osmTrees ? el('select', {class: 'cb-treesfrom', style: 'width:100%', title: 'Which trees the course keeps: the LIDAR\'s measured trees, OpenStreetMap\'s, or both', onchange: e => treesFrom(e.target.value)},
    [['merge', 'Both: the LIDAR\'s, and OpenStreetMap\'s where it has none'], ['lidar', 'The LIDAR\'s only'], ['osm', 'OpenStreetMap\'s only']].map(([v, t]) => el('option', {value: v, selected: v === (st.treesFrom ?? 'merge')}, t))) : null,
   st.osm ? el('div', {class: 'cb-btns'},
    el('button', {class: 'cb-btn', type: 'button', onclick: () => refineOsm('picture')}, 'Refine with the picture'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => refineOsm('lidar')}, 'Refine with the LIDAR'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => keepOsm()}, 'Keep it as drawn')) : null,
   st.osm ? el('small', {}, 'Refining lines the map up with the ground (LIDAR) or the picture by its bunkers, ponds and greens -- OpenStreetMap is often a metre or three off -- and adds clear greens it left out; its shapes are kept as drawn. With a survey, Refine with the LIDAR is the recommended path.') : null];
  // THE AUTO TRACE IS EXPERIMENTAL (the owner, 10 November 2026: "put it into
  // an 'experimental' drop down so that users dont think its going to do a
  // good job"). It stays, folded away with what to expect.
  const experimental = fold('experimental', 'Experimental', 'a rough start', false,
   el('small', {}, 'The auto trace guesses greens, tees, fairways, sand and water from the LIDAR and the picture. It is a rough start you will need to fix by hand -- far from a finished course. OpenStreetMap, where the course is mapped, is a much better start.'),
   el('button', {class: 'cb-btn', type: 'button', onclick: autoTrace}, st.traceMode === 'auto' ? 'Auto trace again' : 'Auto trace'));
  if (!st.model) return [
   // NOT STARTED: the two good ways in, then the rest folded.
   el('div', {class: 'cb-field'}, el('label', {}, 'Start the course'),
    el('small', {}, 'Lay the course from OpenStreetMap if it is mapped there (most clubs are, at least in part), or draw it yourself with the tools: brush, pen, trees and houses.'),
    ...osmBits,
    el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: manualTrace}, 'Draw it myself')),
   picture, viewing, experimental];
  // THE TOOL IN HAND'S OPTIONS, AND ONLY THEM (the owner, 4 November 2026:
  // "This is confusing and is always showing"): each option shows while its
  // tool is held (`data-for`, showToolOptions).
  const toolTitle = el('span', {class: 'cb-tooltitle'});
  const options = el('div', {class: 'cb-field cb-tooloptions'}, el('div', {class: 'cb-panehead'}, toolTitle, el('small', {}, 'Tool options')),
   toolOption(['move'], el('small', {}, 'Drag to move the view; the wheel zooms. Pick a tool on the left to paint.')),
   toolOption(['select'], el('small', {}, 'Click a shape, tree or house to select it; drag inside to move it, an anchor to turn it. Esc lets go.')),
   toolOption(['measure'], el('small', {}, 'Click a point, then another: the yards and metres between them, and how much the ground rises or falls. The holes step shows the yards from the tee as you place a hole\'s marks.')),
   toolOption(PEN_TOOLS, el('small', {}, 'Click to add nodes; the line between them is the curve that will be filled. Click the first node to close the shape, then drag any node to adjust it. Shift-click makes a sharp corner. A creek is an open line: Enter ends it.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', title: 'Fill the shape (Enter)', onclick: () => { if (st.outline.length >= (st.tool === 'creek' ? 2 : 3)) closeOutline(); else say(st.tool === 'creek' ? 'A creek needs two points.' : 'A shape needs three nodes.', true); }}, 'Apply'),
     el('button', {class: 'cb-btn', type: 'button', title: 'Take the last node off (Backspace)', onclick: () => { if (st.outline.length && !st.penEdit) { st.sharp.delete(st.outline.length - 1); st.outline.pop(); plan.draw(); } }}, 'Remove last node'),
     el('button', {class: 'cb-btn', type: 'button', title: 'Drop the shape (Esc)', onclick: () => { dropPen(); plan.draw(); }}, 'Drop'))),
   toolOption([...BRUSHES, 'bunker', 'creek'], el('label', {class: 'cb-opt'}, 'Brush size, metres round', el('input', {type: 'range', class: 'cb-brushsize', min: 1, max: 60, value: st.size, oninput: e => { st.size = +e.target.value; showHint(); plan.draw(); }}))),
   // THE STEADIED BRUSH's two settings (steady.js; the owner: "can result in really squiggly lines").
   toolOption(STEADIED, el('label', {class: 'cb-opt'}, 'Steadiness', el('input', {type: 'range', class: 'cb-steady', min: 0, max: 100, value: st.steadiness, title: 'How far the pointer may wander before the brush follows: higher draws smoother lines, 0 paints right under the pointer', oninput: e => { st.steadiness = +e.target.value; }}))),
   toolOption(['brush', 'erase'], el('label', {class: 'cb-opt'}, 'Smooth the edge when I let go', el('input', {type: 'checkbox', class: 'cb-smoothstroke', checked: st.smoothStroke, onchange: e => { st.smoothStroke = e.target.checked; }}))),
   toolOption(['tree'], el('small', {}, 'Which tree'), el('select', {class: 'cb-treekind', style: 'width:100%', title: 'The tree to place, from those this landscape grows', onchange: e => { st.treeKind = e.target.value; showModel(); }}, el('option', {value: ''}, 'Any of the landscape\'s'), ...treeChoices(BIOMES[st.landscape]).map(([k, name]) => el('option', {value: k, selected: k === st.treeKind}, name)))),
   toolOption(['tree'], el('label', {class: 'cb-opt'}, 'Tree height, metres', el('input', {type: 'number', class: 'cb-treeh', min: 3, max: 60, value: st.treeH, oninput: e => { st.treeH = +e.target.value || 15; showHint(); showModel(); }}))),
   toolOption(['treeZone'], el('label', {class: 'cb-opt'}, 'Trees a hectare', el('input', {type: 'number', class: 'cb-density', min: 10, max: 600, value: st.density, oninput: e => { st.density = +e.target.value || 120; showHint(); }}))),
   ...coverControls(),
   toolOption(['tree', 'treeBrush', 'treeZone', 'treeErase', 'sizeTree'], el('label', {class: 'cb-opt'}, 'Every tree\'s size', el('input', {type: 'range', class: 'cb-treescale', min: .5, max: 2, step: .05, value: st.treeScale, title: 'Every tree on the course together', oninput: e => { st.treeScale = +e.target.value; plan.draw(); refreshSave(); }}))),
   toolOption(['tree', 'treeBrush', 'treeZone', 'treeErase', 'sizeTree'], treePlanControls(el, BIOMES[st.landscape], st.treePlan, plan => { st.treePlan = plan; plan2d(); })),
   toolOption(['sizeTree'], el('label', {class: 'cb-opt'}, 'This tree', el('input', {type: 'range', class: 'cb-onetree', min: .25, max: 3, step: .05, value: 1, disabled: !st.sizing, oninput: e => { const z = st.sizing; if (!z) return; st.model.sizeTree(z.index, z.base, +e.target.value, !z.started); z.started = true; plan.draw(); refreshSave(); }}))));
  st.toolTitle = toolTitle;
  // THE LAYERS (the owner: "the way i can paint things on to a layer without
  // bleeding through to the one on top of it is great. Its just not clear thats
  // how it works"): the list top first, the chosen one marked, and in words what
  // a stroke on it goes under.
  const layers = el('div', {class: 'cb-field cb-layerpanel'}, el('div', {class: 'cb-panehead'}, 'Layers', el('small', {}, 'top of the list is on top')),
   el('label', {class: 'cb-opt'}, 'Painting', el('select', {class: 'cb-kind', title: 'The layer the brush, the outline, the eraser and smoothing work on -- or click a layer below', onchange: e => { st.kind = e.target.value; layersList(); showHint(); showModel(); }}, kindsShown().map(k => el('option', {value: k, selected: k === st.kind}, LABEL(k))))),
   underLine, layerBox,
   el('small', {}, 'Click a layer to paint it. The eye hides it from view only; the course keeps it.'), countText);
  // SKIN FROM THE LAND (the owner: "amazing, sets it apart"): its own place.
  const skin = el('div', {class: 'cb-field cb-skin'}, el('div', {class: 'cb-panehead'}, 'Skin from the land', el('small', {}, 'reads the slopes')),
   el('small', {}, 'Paints the landscape\'s rock on the steep ground and its apron below, read from the land\'s heights. Paint over it, or Undo.'),
   el('div', {class: 'cb-btns'},
    el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: skinLand, title: 'Paint the steep ground the landscape\'s rock and the ground below it its apron, read from the land\'s heights -- a best effort; paint over it, or Undo'}, 'Skin from the land'),
    // BEFORE AND AFTER (item 4): held down, the trace as it was before the skin.
    el('button', {class: 'cb-btn cb-compare', type: 'button', disabled: !st.preSkin, title: 'Hold to see the course as it was before Skin from the land; let go to see it after',
     onpointerdown: () => { if (!st.preSkin) return; st.compareSkin = true; paintCodes(); showCodes(); }, onpointerup: endCompare, onpointerleave: endCompare, onkeydown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); st.compareSkin = !st.compareSkin; paintCodes(); showCodes(); } }}, 'Before (hold)')));
  return [options, layers, skin,
   fold('osm', 'OpenStreetMap', st.osm ? 'laid' : 'not fetched', false, ...osmBits),
   picture, viewing,
   // THE LANDSCAPE, chosen here (the owner, 1 November 2026: "User should
   // select biome in the tracing step"): it decides which ground types the
   // layers offer, and is step 5's look.
   fold('landscape', 'Landscape', BIOMES[st.landscape]?.name ?? '', !st.landscapePicked,
    el('small', {}, 'Which ground types the layers offer -- rock and scree in the mountains, heather and native grass on a links -- and the course\'s look.'),
    suggestionLine() ? el('small', {class: 'cb-suggest'}, suggestionLine()) : null,
    landscapeMap(document, {built: BIOME_KEYS, chosen: st.landscape, mark: (c => c && [c.lat, c.lon])(surveyPlace()), onPick: k => { st.landscape = k; st.landscapePicked = true; go(2); }}).el,
    el('select', {class: 'cb-landscape', onchange: e => { st.landscape = e.target.value; st.landscapePicked = true; go(2); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === st.landscape}, BIOMES[k].name)))),
   // THE COURSE BOUNDARY (the owner, 1 November 2026).
   fold('boundary', 'Course boundary', st.boundary ? `${(ringArea(st.boundary) / 1e4).toFixed(1)} ha` : 'not drawn', false,
    el('small', {}, st.boundary ? `Set: ${(ringArea(st.boundary) / 1e4).toFixed(1)} ha (the dashed line). Fill outside it: the landscape's ground and a wood go in, thinning in from the line, and what is already there -- surfaces, houses and trees, the survey's too -- is removed first or kept (the choice beside it). Past the land the game's landscape carries on.` : 'Draw a line round the course (OpenStreetMap\'s comes with its outlines when it has one). Outside it becomes the landscape\'s ground and wood; what is already there -- OpenStreetMap\'s roads, ponds and houses -- removed or kept, as you choose.'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn' + (st.tool === 'boundary' ? ' cb-on' : ''), type: 'button', 'data-tool': 'boundary', onclick: () => setTool('boundary')}, st.boundary ? 'Draw it again' : 'Draw the boundary'),
     el('select', {class: 'cb-outside', title: 'What happens to the surfaces and houses already outside the line (OpenStreetMap\'s roads, ponds and buildings, or your own)', onchange: e => { st.outsideKeep = e.target.value === 'keep'; }},
      el('option', {value: 'remove', selected: !st.outsideKeep}, 'Remove everything there'), el('option', {value: 'keep', selected: !!st.outsideKeep}, 'Keep what is there')),
     el('button', {class: 'cb-btn', type: 'button', disabled: !st.boundary, title: 'Lay the landscape\'s ground and a wood outside the line; one Undo takes it back', onclick: fillOutsideNow}, 'Fill outside it'))),
   // HISTORY (item 11): the last changes, newest first; a click undoes back to there.
   fold('history', 'History', names.undo.length ? `${names.undo.length} change${names.undo.length === 1 ? '' : 's'}` : 'nothing yet', false, historyList),
   // CLEAN-UP: what works on the whole trace at once.
   fold('cleanup', 'Clean up', 'edges, specks, semi-rough', false,
    el('small', {}, 'Extrapolate: lay a layer round the one being painted, a width out -- semi-rough round a fairway. (The game mows a fringe round every green by itself.)'),
    el('div', {class: 'cb-btns'}, el('select', {class: 'cb-exto', onchange: e => { st.exTo = e.target.value; }}, kindsShown().filter(k => k !== 'rough').map(k => el('option', {value: k, selected: k === st.exTo}, LABEL(k)))),
     el('input', {type: 'number', class: 'cb-exwidth', min: .5, max: 40, step: .5, value: st.exWidth, title: 'metres', oninput: e => { st.exWidth = +e.target.value || 4; }})),
    el('button', {class: 'cb-btn', type: 'button', onclick: extrapolateNow}, 'Extrapolate'),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.smooth({radius: 1.5}); paintCodes(); refreshCount(); }}, 'Smooth all edges'),
     el('button', {class: 'cb-btn', type: 'button', onclick: () => { st.model.tidy(); paintCodes(); refreshCount(); }}, 'Tidy specks'),
     el('button', {class: 'cb-btn', type: 'button', onclick: clearTurfTreesNow}, 'Clear trees from tees and greens'))),
   experimental];
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
   // At 30 cm a pixel, as many tiles as the cap allows (640): the plan draws
   // the picture on a grid of its own (finePicture), so it is not held to the
   // land's cells -- an earlier version of this goal fetched at the land's
   // cell, which on a 1 m land threw the sharper source away.
   const pic = kept ?? await mosaic(await p.start(apiKey), box, {want: .3, onProgress: f => setBusy(`Fetching ${p.name} imagery… ${Math.round(f * 100)}%`)});
   IMAGERY.set(cacheKey, pic);
   // The photograph's date, where the source can say (USGS NAIP).
   if (p.dateAt && !pic.date) { const c = ll(0, 0); pic.date = await p.dateAt(c.lon, c.lat).catch(() => null); }
   st.pics = st.pics.filter(q => q.group !== key).concat([{group: key, label: p.name, pic, provider: key, place: {kind: 'tiles', ...pic.tile}, toPixel: (x, z) => { const g = ll(x, z); return pic.toPixel(g.lon, g.lat); }}]);
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
    st.pics.push({group: 'files', label: 'Picture files', file: main.name, pic, place: {kind: 'map', x0: pic.x0, y0: pic.y0, dx: pic.dx, dy: pic.dy, crs: pic.crs ?? null}, toPixel: (x, z) => { const m = st.gridder.map(x, z), q = conv(m.x, m.y); return [(q.x - pic.x0) / pic.dx, (q.y - pic.y0) / pic.dy]; }});
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
   if (st.align.pairs.length >= 3) { try { const fit = affineFromPairs(st.align.pairs); st.pics = st.pics.filter(q => q.group !== 'matched').concat([{group: 'matched', label: 'Matched by points', pic, place: {kind: 'pairs', pairs: st.align.pairs.map(q => ({...q}))}, toPixel: fit.map}]); showPic('matched', {offset: {x: 0, z: 0}, render: false}); say(`Lined up from ${st.align.pairs.length} points: the worst ${fit.worst.toFixed(1)} m off. Add points, or unlock it and drag it.`); } catch (er) { say(er.message, true); } }
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
  // THE WAIT, stage by stage (the owner, 5 November 2026). The server can take
  // a minute and a half and says nothing until it answers, so the seconds count
  // up and it can be cancelled; then the bytes, then each step of laying it out,
  // with a breath between so the words are seen.
  const stop = new AbortController(), t0 = Date.now(), cancel = () => stop.abort();
  const stage = async (words, share) => { setBusy(words, {share}); await new Promise(r => setTimeout(r, 30)); };
  const waiting = () => setBusy(`Asking OpenStreetMap… ${Math.round((Date.now() - t0) / 1000)} s (a busy server can take over a minute)`, {share: .05, cancel});
  let ticking = fromFile ? 0 : setInterval(waiting, 1000);
  if (fromFile) setBusy('Reading the OpenStreetMap file…'); else waiting();
  try {
   let json;
   if (fromFile) { const [file] = await pickFile('.json,application/json'); if (!file) return; json = JSON.parse(await file.text()); }
   else { const {halfX, halfZ} = st.land, c = [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]].map(([x, z]) => ll(x, z)); json = await fetchOsm([Math.min(...c.map(p => p.lon)), Math.min(...c.map(p => p.lat)), Math.max(...c.map(p => p.lon)), Math.max(...c.map(p => p.lat))], fetch, {signal: stop.signal, onBytes: n => { clearInterval(ticking); ticking = 0; setBusy(`Receiving the map… ${(n / 1e6).toFixed(1)} MB`, {share: .3, cancel}); }}); }
   clearInterval(ticking); ticking = 0;
   await stage('Reading what the map holds…', .5);
   const feats = osmFeatures(json, toLocal), courses = osmCourses(json, toLocal, feats), edge = osmBoundary(json, toLocal);
   await stage('Laying the greens, fairways and water…', .65);
   st.model = createTrace(st.land, {rocks: st.model?.state.rocks ?? st.rocks, bunkers: st.model?.state.bunkers ?? [], creekLines: st.model?.state.creekLines ?? [], trees: []}); st.traceMode = 'openstreetmap';
   const laid = layOsm(st.model, feats), osmTrees = st.model.state.trees;
   // Whose trees (osm.js mergeTrees): the LIDAR's and the map's, by the choice.
   st.model.state.trees = mergeTrees(st.trees, osmTrees, st.treesFrom ?? 'merge');
   st.model.state.undo.length = 0;
   if (!st.credits.includes(OSM_CREDIT)) st.credits.push(OSM_CREDIT);
   st.osm = {raw: json, codes: Uint8Array.from(st.model.state.codes), osmTrees, trees: st.model.state.trees.map(t => ({...t})), homes: st.model.state.homes.map(h => ({...h})), feats, edge,
    courses: courses.map(c => ({id: c.id, name: c.name, only: c.only ?? null, holes: c.holes, rings: c.rings})), course: courses[0]?.id ?? null, shift: {x: 0, z: 0}, laid};
   await stage('Finding the holes…', .85);
   const n = osmCourseHoles();
   await stage('Drawing the trace…', .95);
   st.osm.said = `Laid: ${Object.entries(laid).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing -- this course is not drawn in OpenStreetMap'}; ${n} holes numbered${courses.length > 1 ? ` on ${courses[0].name} (${courses.length} courses here: pick below)` : ''}${st.boundary ? '; the course boundary' : ''}.`;
   paintCodes(); st.traceTool = 'brush'; go(2); refreshCount();
   say(st.osm.said);
  } catch (e) { st.osmFailed = e.name === 'AbortError' ? 'stopped' : e.message; if (e.name === 'AbortError') say('Stopped: nothing was changed.'); else say('OpenStreetMap: ' + e.message, true); }
  finally { clearInterval(ticking); setBusy(''); }
 }
 function treesFrom(how) {
  st.treesFrom = how; if (!st.osm?.osmTrees) return;
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
  // A draft from before version 3 kept the map's trace, not its features
  // (draft.js): its holes stay as marked.
  const o = st.osm; if (!o?.feats) return 0;
  const c = o.courses.find(q => q.id === o.course), sh = o.shift ?? {x: 0, z: 0};
  const ring = c?.rings[0] ?? o.edge;
  st.boundary = ring ? ring.map(([x, z]) => [x + sh.x, z + sh.z]) : st.boundary;
  const raw = osmHoles(o.feats, {within: c?.rings ?? null, only: c?.only ?? null, codes: o.codes, land: st.land});
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
  setBusy(`Lining the map up with the ${mode === 'picture' ? 'picture' : 'LIDAR'}…`); await frame();
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
   el('td', {style: 'cursor:pointer', title: 'Mark this hole', onclick: () => { st.hole = n; go(3); frameHole(n); }}, n + 1),
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
  const list = el('ul', {}, Array.from({length: st.holesN}, (_, n) => { const h = st.holes[n], sk = cardOf(h)?.skipped; return el('li', {class: n === st.hole ? 'cb-cur' : '', style: 'cursor:pointer', onclick: () => { st.hole = n; go(3); frameHole(n); }}, `Hole ${n + 1}: ${h?.tees.length ? h.tees.map(t => t.set).join(', ') + ' tee' : 'no tee'}, ${h?.aims.length ? h.aims.length + ' aim point' + (h.aims.length > 1 ? 's' : '') + (sk ? ` (${sk} skipped by the game)` : '') : 'straight'}, ${h?.green ? 'green' : 'no green'}`); }));
  const marks = [['back', 'Back tee'], ['middle', 'Middle tee'], ['front', 'Front tee'], ['aim', 'Aim point'], ['green', 'Green']].map(([m, t]) => el('button', {class: 'cb-btn' + (st.mark === m ? ' cb-on' : ''), type: 'button', 'data-mark': m, onclick: () => { st.mark = m; go(3); }}, t));
  return [checkBox(), el('div', {class: 'cb-field'}, el('label', {}, `Hole ${st.hole + 1}`),
   el('small', {}, 'Drag any tee, aim point or green to move it, on any hole. Click the plan to place: the back tee (the middle and front if you like), any aim points where the hole bends, in order from the tee, and the green. The game draws the hole\'s line through every aim point in turn -- two make a double dogleg -- measures the yards along it, and aims the tee shot at the first; an aim point no farther on than the one before is skipped.'),
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
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', title: 'Put each green mark on its traced green and give each hole the tee boxes along its line', onclick: fitToTrace}, 'Fit holes to the trace'),
    el('button', {class: 'cb-btn', type: 'button', title: 'For each hole with no aim point whose straight line leaves the fairway, put an aim point at the bend that keeps it on the fairway', onclick: () => { const n = addBends(); go(3); say(n ? `${n} hole${n === 1 ? '' : 's'} given a bend down the fairway. Drag an aim point to move it; Drop last aim takes one off.` : 'No hole needs a bend: each runs down its fairway, or has its aim points already.'); }}, 'Find the doglegs')), list),
  scorecard(),
  next(4, 'Next: the name')];
 }
 // CHECKING THE MAP (map-checks.js; item 24): the holes as marked, read
 // against the greens and tees traced under them and the boundary.
 function mapDoubts() {
  if (!st.model || !st.land) return [];
  const Ls = st.model.state.layers, none = new Uint8Array(st.land.nx * st.land.nz);
  const greens = blobs(Ls.masks.get('green') ?? none, st.land), tees = blobs(Ls.masks.get('tee') ?? none, st.land);
  const played = playedFn(), doubts = checkHoles(st.holes.slice(0, st.holesN), {greens, tees, boundary: st.boundary, played, card: st.card ?? null});
  // A line off the fairway with no other fix is offered a bend down it.
  for (const q of doubts) if (q.kind === 'offPlay' && !q.fix) { const b = bendFor(st.holes[q.hole], played); if (b) { q.fix = {kind: 'aim', to: {x: b.x, z: b.z}, text: 'Bend it down the fairway'}; q.text += ` A bend down the fairway (${Math.round(b.share * 100)}% on) is offered.`; } }
  return doubts;
 }
 // Fairway or semi-rough under a spot, as traced (the line down the fairway).
 function playedFn() {
  const {nx, nz, cell, halfX, halfZ} = st.land, codes = st.model.state.codes, fair = new Set(['fairway', 'semi'].map(k => PALETTE.indexOf(k)));
  return (x, z) => { const i = Math.round((x + halfX) / cell), j = Math.round((z + halfZ) / cell); return i >= 0 && j >= 0 && i < nx && j < nz && fair.has(codes[j * nx + i]); };
 }
 // THE DOGLEGS (item 10; map-checks.js bendFor): each hole with no aim point
 // whose straight line leaves the fairway gets the bend that keeps it on.
 // `least`: only holes whose straight line is at least this much on the
 // fairway already -- Build it for me's 0.4, so a hole the map drew to the
 // wrong green is not bent into looking right (it is flagged, the bend offered
 // as its fix); the button's 0, every hole.
 function addBends(least = 0) {
  if (!st.model || !st.land) return 0;
  const played = playedFn(); let n = 0;
  st.holes.slice(0, st.holesN).forEach(h => { const b = h && bendFor(h, played); if (b && b.was >= least) { h.aims = [{x: b.x, z: b.z}]; n++; } });
  return n;
 }
 function applyFix(q) {
  const h = st.holes[q.hole]; if (!h || !q.fix) return;
  if (q.fix.kind === 'green') h.green = {...q.fix.to};
  else if (q.fix.kind === 'aim') h.aims = [{...q.fix.to}];
  else { const t = h.tees.find(t => t.set === q.fix.set); if (t) Object.assign(t, q.fix.to); }
 }
 function checkBox() {
  const doubts = st.doubts = mapDoubts(), verdict = mapVerdict(st.holes.slice(0, st.holesN), doubts), fixable = doubts.filter(q => q.fix);
  const has = st.osm ? mapHas(st.osm.laid, st.holes, st.holesN) : null;
  const show = q => { st.hole = q.hole; st.mark = q.kind === 'noTee' || q.kind === 'teeOff' ? 'back' : q.kind === 'noGreen' || q.kind === 'greenOff' ? 'green' : st.mark; go(3); if (q.at) plan.look(q.at.x, q.at.z, Math.max(plan.view.scale, 1.2)); say(q.text); };
  return el('div', {class: 'cb-field cb-checks' + (verdict.unreliable ? ' cb-warnbox' : '')}, el('div', {class: 'cb-panehead'}, 'Checking the map', el('small', {}, doubts.length ? `${doubts.length} to check` : 'all clear')),
   el('small', {}, st.osm ? 'OpenStreetMap can be incomplete or wrong. Each hole is checked against the greens and tees traced under it.' : 'Each hole is checked against the greens and tees traced under it.'),
   el('div', {class: verdict.unreliable ? 'cb-coverwarn' : ''}, verdict.words),
   has ? el('ul', {class: 'cb-has'}, has.filter(r => r.want != null).map(r => el('li', {class: r.have < r.want ? 'cb-short' : ''}, `${r.what}: ${r.have} of ${r.want}`))) : null,
   doubts.length ? el('ul', {class: 'cb-doubts'}, doubts.slice(0, 30).map(q => el('li', {}, el('span', {}, q.text),
    el('span', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', title: 'Go to this hole and look at it', onclick: () => show(q)}, 'Show'),
     q.fix ? el('button', {class: 'cb-btn', type: 'button', title: q.fix.text, onclick: () => { applyFix(q); go(3); say(`${q.fix.text}: hole ${q.hole + 1}. Drag the mark if it is not right.`); }}, 'Fix') : null)))) : null,
   fixable.length > 1 ? el('button', {class: 'cb-btn', type: 'button', title: 'Take every fix offered -- guesses from the traced fairways and greens, to check against the picture: marks moved onto the nearest green or tee, lines turned down the fairway', onclick: () => { let taken = 0; for (let round = 0, q = fixable; round < 3 && q.length; round++) { q.forEach(applyFix); taken += q.length; q = mapDoubts().filter(x => x.fix); } go(3); say(`${taken} fixes taken. Check each hole against the picture; Next thing to check shows what is left.`); }}, `Take the ${fixable.length} fixes offered`) : null,
   doubts.length ? el('button', {class: 'cb-btn', type: 'button', title: 'Go to the first thing to check', onclick: () => show(doubts[0])}, 'Next thing to check') : null,
   // THE CARD AS A WITNESS (item 24): the club's yards pasted, and every hole
   // more than 12% (and 40 yards) off them is listed.
   el('details', {class: 'cb-cardbox', open: !!st.card}, el('summary', {}, st.card ? `Checked against the card (${st.card.length} holes)` : 'Check against the scorecard'),
    el('small', {}, 'Paste or type the yards from the back tees, hole by hole, from the club\'s card or website -- any layout. Holes far off them are listed above.'),
    el('textarea', {class: 'cb-cardtext', rows: 3, placeholder: '349 173 390 328 426 ...', style: 'width:100%;background:#03100e;border:1px solid var(--line);color:inherit'}, st.cardText ?? ''),
    el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn', type: 'button', 'data-card': 'check', title: 'Check every hole\'s length against these yards', onclick: e => { const t = e.target.closest('details').querySelector('textarea').value; const c = cardFrom(t, st.holesN); if (!c) return say('No yards found there: paste the yards hole by hole.', true); st.card = c; st.cardText = t; go(3); say(`Checked against the card: ${c.length} holes.`); }}, 'Check against the card'),
     st.card ? el('button', {class: 'cb-btn', type: 'button', title: 'Stop checking against the card', onclick: () => { st.card = null; go(3); }}, 'Forget the card') : null)));
 }
 function fitToTrace() {
  if (!st.model) return;
  const want = st.holes.slice(0, st.holesN), fit = fitHoles(want.map(h => h?.green && h.tees.length ? h : null), st.model.state.codes, st.land);
  let greens = 0, tees = 0;
  fit.forEach((h, n) => { if (!h) return; if (h.fit.green === 'moved') greens++; tees += h.fit.tees; st.holes[n] = {tees: h.tees, aims: h.aims, green: h.green, par: h.par ?? null, index: want[n].index ?? null}; });
  go(3); say(`Fitted: ${greens} green mark${greens === 1 ? '' : 's'} moved onto a green; ${tees} tee boxes given to holes. Drag any mark to move it.`);
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
   el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: () => st.doc && openEditor(st.doc, {from: 'real', back: remount, work: {draft: whole}})}, 'Open in the editor')),
   // FROM THE BUILDER INTO THE GAME (item 21): the course as a .fairway file
   // from here, and what to do with it in Fairway. (Save in the top bar writes
   // door 2's draft, which the builder reopens and the game does not.)
   el('div', {class: 'cb-field cb-togame'}, el('div', {class: 'cb-panehead'}, 'Play it in Fairway', el('small', {}, 'two steps')),
    el('ol', {class: 'cb-steps-list'},
     el('li', {}, el('b', {}, 'Save the course for Fairway'), ' (below): a .fairway file, with your builder work inside it so the builder can open it again.'),
     el('li', {}, 'Open ', el('b', {}, 'Fairway.html'), ' (beside the builder in the download), then ', el('b', {}, 'Saved courses'), ' > ', el('b', {}, 'Import courses from a file'), ' -- or drop the file on that screen. The course joins your shelf; play it from Play > a saved course.')),
    el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-togame': 'save', title: 'Write the course as a .fairway file the game opens', onclick: saveForGame}, 'Save the course for Fairway'),
    el('small', {class: 'cb-togamesaid'}))];
 }
 async function saveForGame() {
  if (!st.doc) return say('The course is still being painted: a moment.', true);
  setBusy('Saving the course for Fairway…');
  try {
   const bytes = await writeBuiltFile(validateDoc(st.doc), BUILT_VERSION, {builder: await writeDraft(await whole())});
   const r = await saveBytes(bytes, {key: `door2-course-${st.name}`, name: st.name, file: fileName(st.name)});
   if (r.how === 'cancelled') return;
   const said = `Saved ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB). Now open Fairway.html: Saved courses > Import courses from a file.`;
   say(said); const n = panel.querySelector('.cb-togamesaid'); if (n) n.textContent = said;
   window.fairwayBuilder.lastSaved = bytes;
  } catch (e) { say('Could not save the course: ' + e.message, true); }
  finally { setBusy(''); }
 }
 // The course made (docFromLand) and drawn from the world the game will
 // build from it, so what is shown is what will be played.
 async function paintCourse(card, found) {
  const holes = st.holes.slice(0, st.holesN).map((h, n) => ({number: n + 1, par: h.par ?? null, index: h.index ?? null, tees: h.tees, green: h.green, line: holeLine(h)}));
  setBusy('Painting the course…'); await frame();
  try {
   const doc = st.doc = validateDoc(docFromLand({treePlan: st.treePlan, land: st.land, traced: {layers: st.model.state.layers}, holes, trees: st.model.state.trees.map(t => st.treeScale === 1 ? t : {...t, h: t.h * st.treeScale, crown: t.crown * st.treeScale, ...(t.trunk ? {trunk: t.trunk * st.treeScale} : {})}), homes: st.model.state.homes, bunkers: st.model.state.bunkers, creekLines: st.model.state.creekLines, name: st.name.trim() || 'My real course', landscape: st.landscape, credits: st.credits, landEdits: st.landEdits, creeks: st.creeks, rocks: st.model?.state.rocks ?? st.rocks,
    source: {files: st.sources.map(s => s.name), epsg: crsOfSources(st.sources)?.epsg ?? null, crs: crsOfSources(st.sources) ?? null, geo: st.geo, origin: {x: st.gridder.center.x, y: st.gridder.center.y}, trace: st.traceMode, picture: st.picShow === 'lidar' ? 'lidar' : st.picture ? 'placed' : 'none'}}));
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
  view: {lidarView: st.lidarView, lidarAlpha: st.lidarAlpha, picAlpha: st.picAlpha, traceAlpha: st.traceAlpha, lidarOnTop: st.lidarOnTop, smoothView: st.smoothView, treeScale: st.treeScale, treesFrom: st.treesFrom},
  geo: st.geo, picShow: st.picShow, treePlan: st.treePlan,
  picOffsets: {...st.picOffsets, ...(st.picShow && st.picShow !== 'lidar' ? {[st.picShow]: st.offset} : {})}, osm: st.osm, trees: st.trees, land: st.land, landEdits: st.landEdits, creeks: st.creeks, rocks: st.model?.state.rocks ?? st.rocks,
  trace: st.model ? {masks: st.model.state.layers.masks, hidden: [...st.model.state.layers.hidden], trees: st.model.state.trees, homes: st.model.state.homes, bunkers: st.model.state.bunkers, creekLines: st.model.state.creekLines} : null});
 // Everything, the pictures packed as a file holds them (picture-file.js).
 const whole = async () => ({...snapshot(), pics: await packPictures(st.pics, {onStep: label => setBusy(`Saving the pictures… ${label}`)})});
 const saver = {key: `door2-${++opened}`, name: () => st.name, file: () => fileName(st.name).replace(/\.fairway$/, DRAFT_EXT), bytes: async () => writeDraft(await whole()),
  said: (r, bytes) => r.how === 'failed' ? say('Could not save: ' + r.error.message, true) : say(`${r.how === 'overwrite' ? 'Saved again to' : 'Saved as'} ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB): a draft that opens back at this step (Open a course file). The playable course is saved from the editor.`)};
 setSaver(saver);
 // THE KEPT DRAFT (autosave.js; item 12): door 2's draft written to this
 // browser's storage at each step and every 3 minutes once there is land,
 // quietly (no wait shown); a later visit offers it back. A Save to a file
 // drops it, as the file holds the work.
 let keptMark = '', keeping = false, again = false;
 const markNow = () => JSON.stringify([st.step, st.name, st.holes.length, st.holes.map(h => h ? [h.tees.length, h.aims.length, h.green?.x] : 0), st.model?.state.undo.length ?? -1, st.pics.length, !!st.land]);
 async function keepNow() {
  if (!st.land) return;
  // A keep asked for while one is being written runs once it is done, so the
  // latest state is the one kept.
  if (keeping) { again = true; return; }
  const mark = markNow(); if (mark === keptMark) return;
  keeping = true;
  try { const bytes = writeDraft({...snapshot(), pics: await packPictures(st.pics, {onStep: () => {}})}); if (await keepDraft(await bytes, {name: st.name, step: st.step})) keptMark = mark; }
  catch { /* the next try */ } finally { keeping = false; if (again) { again = false; keepNow(); } }
 }
 st.keepNow = keepNow;
 const keepTimer = setInterval(() => { if (!document.body.contains(canvas)) return; keepNow(); }, 3 * 60e3);
 window.addEventListener('pagehide', () => { if (document.body.contains(canvas)) keepNow(); });
 const saidBefore = saver.said;
 saver.said = (r, bytes) => { saidBefore(r, bytes); if (r.how !== 'failed') dropDraft(); };
 void keepTimer;
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
   Object.assign(st, {creeks: got.creeks, rocks: got.rocks, name: got.name, landscape: got.landscape, treePlan: editor.state.treePlan ?? null});
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
  // anew needs the files again. Everything else comes back as it was left.
  Object.assign(st, {name: d.name, landscape: d.landscape, credits: d.credits ?? [], holes: d.holes ?? [], holesN: d.holesN ?? 18, hole: d.hole ?? 0, boundary: d.boundary, traceMode: d.traceMode, box: d.box,
   sources: (d.sources ?? []).map(s => ({name: s.name, kind: 'points', crs: s.crs, restored: true})), picOffsets: d.picOffsets ?? {}, trees: d.trees ?? [], landEdits: d.landEdits ?? null, creeks: d.creeks ?? [], rocks: d.rocks ?? [], geo: d.geo ?? null, treePlan: d.treePlan ?? null, ...(d.view ?? {})});
  let lostPics = 0;
  if (d.land) {
   const L = d.land, u = L.unit ?? {h: 1, v: 1};
   st.land = L;
   st.gridder = createGridder({box: {x0: L.center.x - L.halfX / u.h, x1: L.center.x + L.halfX / u.h, y0: L.center.y - L.halfZ / u.h, y1: L.center.y + L.halfZ / u.h}, cell: L.cell, unit: u});
   if (d.osm?.codes) { st.osm = d.osm; backOsm(); }
   for (const p of d.pics ?? []) { const live = !p.failed && livePicture(p); if (live) st.pics.push(live); else lostPics++; }
   if (d.trace) {
    st.model = createTrace(st.land, {rocks: st.rocks, bunkers: d.trace.bunkers ?? [], creekLines: d.trace.creekLines ?? [], trees: d.trace.trees, homes: d.trace.homes});
    const Ls = st.model.state.layers;
    for (const [k, m] of d.trace.masks) Ls.mask(k, true).set(m);
    for (const k of d.trace.hidden ?? []) Ls.hidden.add(k);
    Ls.recompose();
   }
   paintRelief();
   if (d.picShow === 'lidar' || st.pics.some(p => p.group === d.picShow)) { st.picShow = d.picShow; st.offset = st.picOffsets[d.picShow] ?? {x: 0, z: 0}; relay(); }
  }
  setTitle('Real life course');
  go(Math.min(d.step ?? 0, st.land ? (st.model ? 5 : 2) : 0));
  if (st.step === 5 && !can(5)) go(st.model ? 3 : 2);
  say(`Opened "${d.name}" at step ${st.step + 1}. ${!st.land ? 'Bring the LIDAR files again to build the land.' : st.pics.length || st.osm ? 'The land, the trace, the map data and the pictures are as saved.' : 'The land and the trace are as saved.'}${lostPics ? ` ${lostPics} picture${lostPics === 1 ? '' : 's'} could not be read: fetch or bring ${lostPics === 1 ? 'it' : 'them'} again.` : ''}`);
 }
 // The map's features again from its download as it came (draft.js): what the
 // course picker, the boundary and the holes are made from.
 function backOsm() {
  const o = st.osm, toLocal = o.raw && localOfLonLat();
  if (!toLocal) return;
  const json = JSON.parse(o.raw), feats = osmFeatures(json, toLocal), courses = osmCourses(json, toLocal, feats);
  Object.assign(o, {feats, edge: osmBoundary(json, toLocal), courses: courses.map(c => ({id: c.id, name: c.name, only: c.only ?? null, holes: c.holes, rings: c.rings})), shift: o.shift ?? {x: 0, z: 0}});
 }
 // A saved picture placed on this land again (picture-file.js `place`); null
 // when it cannot be, as a tile mosaic on land that no longer says where it is.
 function livePicture(p) {
  const {pic, place} = p, crs = crsOfSources(st.sources);
  if (place?.kind === 'tiles') {
   const ll = lonLatOfLocal(), at = tilePixel(place);
   return ll && {...p, pic: {...pic, toPixel: at}, toPixel: (x, z) => { const g = ll(x, z); return at(g.lon, g.lat); }};
  }
  if (place?.kind === 'map' && crs) {
   const conv = converter(crs, place.crs ?? crs);
   return {...p, pic: {...pic, x0: place.x0, y0: place.y0, dx: place.dx, dy: place.dy, crs: place.crs}, toPixel: (x, z) => { const m = st.gridder.map(x, z), q = conv(m.x, m.y); return [(q.x - place.x0) / place.dx, (q.y - place.y0) / place.dy]; }};
  }
  if (place?.kind === 'pairs') return {...p, toPixel: affineFromPairs(place.pairs).map};
  return null;
 }
}
let opened = 0;   // each door 2 opened is its own piece of work for Save
let lidarFolder = null;   // the player's LIDAR folder (lidar-folder.js), once picked or recalled
