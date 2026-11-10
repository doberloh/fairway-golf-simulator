// THE EDITOR both doors end in (the course builder, stages 3-5;
// docs/COURSE_BUILDER.md, *The editor*): the view (view.js), the tools down
// the left, the holes and the course on the right, undo, and Save. Every
// change goes through the editing model (editing.js), which is tested in
// Node; this file only turns the mouse and keys into its calls and tells the
// view what to redraw.
import {show, setTitle, setBusy, topTools, home, ui, setSaver, refreshSave, useMenus} from './builder.js';
import {penCurve} from './pen.js';
import {eyeButton} from './icons.js';
import {createSteady} from './steady.js';
import {createEditor, PAINT} from './editing.js';
import {createView} from './view.js';
import {writeBuiltFile, validateDoc} from '../course-doc.js';
import {writeDraft} from './draft.js';
import {withEditorWork} from './round-trip.js';
import {saveBytes} from './saving.js';
import {BUILT_VERSION, BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {fileName} from '../course-file.js';
import {GROUNDS} from '../grounds.js';
import {checkCourse} from './checks.js';
import {testRound} from './test-round.js';
import {layersFor, LAYER_ORDER} from './layers.js';
import {coverOptions, coverByKey, COVER_RANGE, treeChoices} from './cover.js';
import {preview} from './preview.js';
import {treePlanControls} from './tree-plan.js';
import {changeMark, sameMark, poseFrom} from './game-look.js';

const {el} = ui;
export let current = null;   // {editor, view} while the editor is open (tests and the console)
let opened = 0;               // each course opened is its own piece of work for Save

// The tools: what a click or a drag on the ground does.
const SHAPES = [['raise', 'Raise'], ['lower', 'Lower'], ['smooth', 'Smooth'], ['flatten', 'Flatten'], ['ramp', 'Ramp'], ['roughen', 'Roughen'], ['restore', 'Restore'], ['fill', 'Fill to surrounding']];
const label = k => GROUNDS[k]?.label ?? (k[0].toUpperCase() + k.slice(1));

// `back`: door 2's way back to its own steps (the owner, 1 November 2026:
// "add a button to go back to the 2d editor from the 3d editor"), when the
// course came from there.
// `work`: the door 2 session behind this course, {draft()} giving it as a draft
// (draft.js) -- door 2's own when the course came from there, or the one in the
// file it was opened from. Save puts it in the course file with this editor's
// work added (round-trip.js `withEditorWork`), and Back to 2D opens it, so a
// course reopened from a file has everything it had. None on a generated course
// or a file from before 5 November 2026.
export function openEditor(doc, {from = 'file', back = null, work = null} = {}) {
 current?.view.dispose();
 const editor = createEditor(doc), s = editor.state;
 setTitle(s.name);
 const wrap = el('div', {class: 'cb-view'}), status = el('div', {class: 'cb-status'}, 'Right-drag to turn, wheel to zoom, left-drag to move. Pick a tool on the left.');
 const tools = el('div', {class: 'cb-tools'}), side = el('div', {class: 'cb-side'});
 const page = el('div', {style: 'position:absolute;inset:0'}, wrap, tools, side, status);
 show(page);
 preview().mount(page);
 const view = createView(wrap, editor, {onWindowChange: ui.onWindowChange});
 current = {editor, view};
 const canvas = view.canvas;
 // What is selected: its outline and anchors (view.js), a pick (editing.js).
 let chosen = null;
 const nameOf = c => c.type === 'shape' ? label(c.kind) : c.type === 'home' ? 'House' : c.type === 'rock' ? 'Rock' : c.type === 'creek' ? 'Creek' : 'Tree';
 const choose = c => { chosen = c; view.select(c ? {rings: editor.ringsOf(c), mid: editor.middleOf(c), anchors: c.type === 'shape' || c.type === 'home'} : null); };
 // The smoke journeys look (never drive) through this, as the game's do through lab.
 window.fairwayBuilder.editor = current;

 // The pen's sharp nodes (Shift-click), by index in the draft.
 const sharp = new Set();
 // The steadied brush's string (0-100, a string of 0 to 30 screen pixels) and
 // whether a stroke's edge is smoothed when let go (steady.js; as door 2's).
 let steadiness = 50, smoothStroke = true;
 const STEADIED = new Set(['paint', 'erase', 'eraseAll']);
 let tool = {kind: 'navigate'}, radius = 8, strength = .5, selected = 0, draft = [], down = null, rampA = null;
 // The layer the clean-up tools work on, the tree tools' numbers, how thick
 // ground cover lies, and Extrapolate's. As door 2's (PLACED there).
 let treeKind = '', layer = 'fairway', treeH = 15, zoneDensity = 120, coverThick = .5, exTo = 'semi', exWidth = 4;
 const OUTLINES = new Set(['outline', 'pond', 'treeZone', 'homeZone']);
 // Ground cover's two sizes, one pair for each kind of cover (PLACED: where
 // cover.js starts them), kept as the brush changes hands.
 const coverSizes = Object.fromEntries(Object.entries(COVER_RANGE).map(([k, r]) => [k, {min: r.from[0], max: r.from[1]}]));
 // The model of what the tool paints or places (preview.js).
 const ITEM = {paint: t => ({kind: 'surface', surface: t.surface}), outline: t => ({kind: 'surface', surface: t.surface}), pond: () => ({kind: 'pond'}), creek: () => ({kind: 'creek'}), bunker: () => ({kind: 'bunker'}), placeTree: () => ({kind: 'tree', species: treeKind || null, height: treeH}), treeZone: () => ({kind: 'tree'}), house: () => ({kind: 'house'}), homeZone: () => ({kind: 'house'}),
  cover: t => ({kind: 'cover', cover: t.cover, ...coverSizes[t.cover]})};
 const showModel = () => preview().show(ITEM[tool.kind]?.(tool) ?? null, s.landscape);
 const setTool = t => {
  tool = t; draft = []; sharp.clear(); rampA = null; view.draft([]); view.setToolActive(t.kind !== 'navigate');
  if (t.kind !== 'sizeTree') { unpick(); view.cursor(null); }
  if (t.kind !== 'select') choose(null);
  // Only what the tool in hand uses (`data-for`; the owner, 4 November 2026).
  for (const n of tools.querySelectorAll('[data-for]')) n.hidden = !n.dataset.for.split(' ').includes(t.kind);
  for (const b of tools.querySelectorAll('[data-tool]')) b.classList.toggle('cb-on', b.dataset.tool === toolKey(t) || (b.dataset.tool === 'brush' && t.kind === 'paint') || (b.dataset.tool === 'pen' && t.kind === 'outline'));
  status.textContent = HINT[t.kind]?.(t) ?? '';
  canvas.style.cursor = '';
  refreshCoverSizes(); showModel();
 };
 const toolKey = t => [t.kind, t.op || t.surface || t.set || t.cover || ''].join(':');
 const HINT = {
  navigate: () => 'Left-drag moves, right-drag turns, the wheel zooms.',
  shape: t => t.op === 'ramp' ? 'Click the low end, then the high end: the ground between is graded.' : t.op === 'fill' ? 'Fill to surrounding: brush over a hole, wider than it, and it rises smoothly to the ground round it. It never lowers anything.' : `${t.op[0].toUpperCase() + t.op.slice(1)}: drag over the ground. Size and strength on the left.`,
  paint: t => `Paint ${label(t.surface)}: drag over the ground. It goes on the ${label(t.surface).toLowerCase()} layer and covers nothing beneath it.`,
  erase: () => layer === 'rough' ? 'Erase brush: drag to take every layer off.' : `Erase the ${label(layer).toLowerCase()} layer: drag over the ground; what lies under it shows.`,
  eraseAll: () => 'Erase all layers: drag to take every layer off, down to rough.',
  smoothEdges: () => `Smooth edges: drag along a ragged edge of the ${layer === 'rough' ? 'layers' : label(layer).toLowerCase()} to round it.`,
  outline: t => `Outline ${label(t.surface)}: click its corners, double-click or press Enter to fill it.`,
  pond: () => 'Draw a pond: click its edge, double-click or press Enter. Its level is set just under its lowest bank.',
  creek: () => 'Draw a creek from its head to its foot: click along it, double-click or press Enter. Its channel is cut and its water falls downstream.',
  bunker: () => 'Click to dig a bunker the size of the brush.',
  tee: t => `Click where hole ${selected + 1}'s ${t.set} tee goes.`,
  green: () => `Click where hole ${selected + 1}'s green goes.`,
  bend: () => `Click to add a bend to hole ${selected + 1}'s line.`,
  marks: () => 'Drag markers: press on any tee, bend or green and drag it. The hole\'s line follows; Undo puts it back.',
  placeTree: () => `Place tree: pick the tree, then click to stand one ${treeH} m tall, not on turf, sand, water, a path or a road.`,
  treeZone: () => `Tree zone: click round it, then double-click or press Enter. It fills with ${zoneDensity} trees a hectare.`,
  homeZone: () => 'House zone: click round it, then double-click or press Enter. Houses line it 42 m apart, each facing the course.',
  clear: () => 'Drag to take trees out.',
  house: () => 'Click to stand a house: it faces the nearest fairway, green or tee.',
  clearHomes: () => 'Drag to take houses out.',
  select: () => 'Click a green, bunker, fairway, pond, rock, tree or house to select it. Drag inside its outline to move it, or an anchor at a corner to turn it. Undo puts it back.',
  cover: t => t.cover === 'trees' ? 'Tree brush: drag to scatter the landscape\'s trees across the brush, not on turf, sand, water, a path or a road.' : `Paint ${coverLabel(t.cover).toLowerCase()}: drag over open ground.`,
  clearCover: () => 'Drag to take rocks and low plants off. Trees stay.',
  sizeTree: () => 'Click a tree, then size it with This tree: its height, crown and trunk together. Undo puts it back.',
 };
 // Each tool's tooltip is its hint (HINT), as the status line gives it.
 const coverLabel = key => coverByKey(BIOMES[s.landscape], key)?.label ?? key;
 const button = (text, t, extra = {}) => el('button', {class: 'cb-btn', type: 'button', 'data-tool': toolKey(t), title: HINT[t.kind]?.(t) ?? text, onclick: () => setTool(t), ...extra}, text);
 const range = (labelText, min, max, step, value, onInput) => el('label', {}, labelText, el('input', {type: 'range', min, max, step, value, oninput: e => onInput(+e.target.value)}));
 // ONLY THE LANDSCAPE'S OWN (the owner, 1 November 2026: "Only allow the
 // user to paint or place ground and objects from that biome"): the turf,
 // sand and path layers and the landscape's own ground types (layers.js
 // layersFor, as door 2's trace offers them); water by its own tools. The
 // trees planted are the landscape's own (a tree record's kind -1: the game
 // grows the landscape's species). Another landscape picked, the tools change
 // with it; a layer already painted from another stays in the Layers list.
 const landscapeKinds = () => { const own = layersFor(BIOMES[s.landscape]); return PAINT.filter(k => own.includes(k)); };
 // THE LAYERS (the owner, 1 November 2026: "exposed in the editor as well in
 // real time"): every surface the course holds, top first, its area kept up
 // to date as it is painted; the eye hides one from the view (the course
 // keeps it); Erase takes one off under the brush.
 const layerList = el('ul', {style: 'list-style:none;padding:0;margin:0;font-size:12px'});
 function refreshLayers() {
  const a = s.raster.cell ** 2;
  underLine.replaceChildren(...underWords());
  layerList.replaceChildren(...editor.layersPresent().map(k => { const m = s.raster.layers.masks.get(k), n = m.reduce((t, v) => t + v, 0), hid = editor.isHidden(k);
   return el('li', {'data-layer': k, class: k === layer ? 'cb-chosen' : '', title: `Click to paint ${label(k).toLowerCase()}`, style: 'display:flex;gap:4px;align-items:center;margin:2px 0;cursor:pointer', onclick: () => chooseLayer(k)},
    eyeButton(document, k, label(k), hid, () => { editor.setHidden(k, !hid); view.refreshLayers(); refreshLayers(); }),
    el('span', {style: 'flex:1'}, `${label(k)} ${(n * a / 1e4).toFixed(2)} ha`),
    el('button', {class: 'cb-btn', type: 'button', style: 'padding:2px 5px;font-size:11px', title: `Erase the ${label(k).toLowerCase()} layer under the brush`, onclick: () => { layer = k; layerPick.value = k; setTool({kind: 'erase'}); }}, 'Erase')); }));
 }
 // The tree height scale, as the slider is dragged (editing.js treeScale).
 const scaleText = el('span', {}, `${s.treeScale.toFixed(2)}x`);
 let scaling = 0;
 const treeScale = el('input', {type: 'range', min: .5, max: 2, step: .05, value: s.treeScale, class: 'cb-treescale', title: 'Every tree\'s size -- height, crown width and trunk together -- as drawn and as saved', oninput: e => {
  editor.setTreeScale(+e.target.value); scaleText.textContent = `${s.treeScale.toFixed(2)}x`; refreshSave();
  if (sizing) sizeText();
  if (!scaling) scaling = requestAnimationFrame(() => { scaling = 0; view.refreshTrees(); if (sizing) showPicked(); });
 }});
 // One tree's size (editing.js sizeTree): Size a tree picks one, This tree
 // sizes it from what it was when picked; one Undo for the drag. The picked
 // tree is ringed. Undo, Redo or another tool lets it go.
 let sizing = null;
 const oneText = el('span', {}, '');
 const showPicked = () => { const t = sizing && s.trees[sizing.index]; view.cursor(t ? t[0] : null, t?.[1], Math.max(1.5, (t?.[3] ?? 0) * s.treeScale)); };
 const sizeText = () => { const t = s.trees[sizing.index], f = s.treeScale; oneText.textContent = `${(+oneTree.value).toFixed(2)}x · ${Math.round(t[2] * f)} m tall, ${Math.round(t[3] * f * 2)} m across`; };
 const oneTree = el('input', {type: 'range', min: .25, max: 3, step: .05, value: 1, disabled: true, class: 'cb-onetree', title: 'The picked tree\'s size -- height, crown and trunk together -- from what it was when picked', oninput: e => {
  if (!sizing) return;
  editor.sizeTree(sizing.index, sizing.base, +e.target.value, !sizing.started); sizing.started = true; sizeText(); refreshSave();
  if (!scaling) scaling = requestAnimationFrame(() => { scaling = 0; view.refreshTrees(); showPicked(); });
 }});
 function pickTree(p) {
  const i = editor.treeAt(p);
  if (i < 0) { status.textContent = 'No tree there: click on a tree\'s crown.'; return; }
  sizing = {index: i, base: [...s.trees[i]], started: false};
  oneTree.disabled = false; oneTree.value = 1; sizeText(); showPicked();
  status.textContent = 'Size it with This tree on the left; Undo puts it back.';
 }
 function unpick() { sizing = null; oneTree.disabled = true; oneTree.value = 1; oneText.textContent = ''; }
 // SKIN FROM THE LAND (skin.js; the owner, 3 November 2026): the
 // landscape's rock painted on the steep ground and its apron below it, read
 // from the land as shaped now; painting by hand still works over it, and
 // Undo takes it back in one step.
 function skinLand() {
  // A real survey takes 5 to 10 seconds here (seen on Chambers Bay and Bully
  // Pulpit): say so first, or the page just stops.
  status.textContent = 'Reading the land…';
  setTimeout(() => {
   const got = editor.skinFromLand({bio: BIOMES[s.landscape]});
   view.refreshAll(); refreshLayers(); refreshSave();
   const name = k => GROUNDS[k]?.label?.toLowerCase?.() || k;
   status.textContent = got.cells.face || got.cells.apron
    ? `Skinned from the land: ${name(got.kinds.face)} on the steep ground${got.kinds.apron ? `, ${name(got.kinds.apron)} below it` : ''}. Paint over it or Undo.`
    : 'Nothing here is steep enough to skin; paint the ground by hand instead.';
  }, 40);
 }
 // GROUND COVER (cover.js; the owner, 4 November 2026): the landscape's own
 // rocks and low plants, with the smallest and largest each brush lays. The
 // two sliders push each other along, so the smallest is never past the
 // largest. They and the preview follow the cover in hand.
 const coverMinText = el('span', {}), coverMaxText = el('span', {});
 const coverSize = which => el('input', {type: 'range', min: .1, max: 6, step: .1, class: `cb-cover${which}`, oninput: e => {
  if (tool.kind !== 'cover') return;
  const c = coverSizes[tool.cover], v = +e.target.value;
  c[which] = v; if (c.min > c.max) c[which === 'min' ? 'max' : 'min'] = v;
  refreshCoverSizes(); showModel();
 }});
 const coverMin = coverSize('min'), coverMax = coverSize('max');
 function refreshCoverSizes() {
  const on = tool.kind === 'cover', c = on ? coverSizes[tool.cover] : null, r = on ? COVER_RANGE[tool.cover] : null;
  for (const [input, text, v] of [[coverMin, coverMinText, c?.min], [coverMax, coverMaxText, c?.max]]) {
   if (on) { input.min = r.low; input.max = r.high; input.step = r.high > 10 ? .5 : .1; input.value = v; }
   text.textContent = on ? `${v.toFixed(1)} m` : '';
  }
 }
 const coverButtons = () => el('div', {class: 'cb-btns'}, coverOptions(BIOMES[s.landscape]).map(c => button(c.label, {kind: 'cover', cover: c.key})), button('Clear cover', {kind: 'clearCover'}));
 // THE CLEAN-UP, as door 2's. Whole-course ones redraw the whole sheet.
 const layerNow = () => layer === 'rough' ? null : layer;
 const layerPick = el('select', {class: 'cb-layerpick', style: 'width:100%', title: 'The layer the brush, the pen, Erase, Smooth edges, Tidy and Extrapolate work on (Rough: every layer)', onchange: e => chooseLayer(e.target.value)});
 // The layer chosen: the brush and the pen in hand go on painting it.
 function chooseLayer(k) {
  layer = k; layerPick.value = k;
  if (tool.kind === 'paint' || tool.kind === 'outline') setTool({...tool, surface: k}); else status.textContent = HINT[tool.kind]?.(tool) ?? '';
  refreshLayers();
 }
 // WHAT A STROKE GOES UNDER (as door 2's): the layers above the chosen one
 // that hold something stay on top of it.
 const underLine = el('small', {class: 'cb-under'});
 function underWords() {
  if (layer === 'rough') return ['Rough takes every layer off where you paint it.'];
  const order = editor.layersPresent(), i = order.indexOf(layer), above = (i < 0 ? order.filter(k => LAYER_ORDER.indexOf(k) < LAYER_ORDER.indexOf(layer)) : order.slice(0, i)).filter(k => k !== 'rough');
  return above.length ? [`${label(layer)} goes under `, el('b', {}, above.map(k => label(k)).join(', ')), ', which stay on top where they are painted.'] : [`${label(layer)} is the top layer painted here: it shows wherever you paint it.`];
 }
 const fillLayerPick = () => { layerPick.replaceChildren(...[...new Set([...landscapeKinds(), ...editor.layersPresent()])].map(k => el('option', {value: k, selected: k === layer}, label(k)))); };
 function cleaned() { const w = editor.settleWater(); if (w) view.refreshLand(w); view.refreshWater(); view.refreshLayers(); refreshLayers(); refreshSave(); }
 function clearTurfTrees() {
  unpick(); showPicked();
  const got = editor.clearTreesFromTurf(); view.refreshTrees();
  status.textContent = got.shrunk || got.removed ? `Off the greens and tees: ${got.shrunk.toLocaleString()} crowns drawn in, ${got.removed.toLocaleString()} trees with no room taken out. Undo puts them back.` : 'No tree reaches over a green or a tee.';
 }
 const buildTools = () => { fillLayerPick(); tools.replaceChildren(
  el('div', {class: 'cb-group'}, el('b', {}, 'View'), el('div', {class: 'cb-btns'},
   button('Move', {kind: 'navigate'}), button('Select shape', {kind: 'select'}),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => view.planView()}, 'From above'),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => view.frameHole(selected)}, 'This hole'),
   el('button', {class: 'cb-btn', type: 'button', onclick: undo}, 'Undo'),
   el('button', {class: 'cb-btn', type: 'button', onclick: redo}, 'Redo'))),
  el('div', {class: 'cb-group', 'data-for': 'shape paint erase eraseAll smoothEdges clear clearHomes bunker creek cover clearCover'}, el('b', {}, 'Brush'),
   range('Size', 1, 60, 1, radius, v => { radius = v; }),
   // THE STEADIED BRUSH (steady.js), as door 2's.
   el('div', {'data-for': 'paint erase eraseAll'}, range('Steadiness', 0, 100, 1, steadiness, v => { steadiness = v; }),
    el('label', {'data-for': 'paint erase', title: 'Round the stroke\'s edge when you let go'}, el('input', {type: 'checkbox', class: 'cb-smoothstroke', checked: smoothStroke, onchange: e => { smoothStroke = e.target.checked; }}), ' Smooth the edge when I let go')), el('div', {'data-for': 'shape'}, range('Strength', .05, 1, .05, strength, v => { strength = v; }))),
  // The sizes the brush in hand lays, for ground cover and trees alike.
  el('div', {class: 'cb-group', 'data-for': 'cover'}, el('b', {}, 'What it lays'),
   el('label', {}, 'Smallest ', coverMinText, coverMin), el('label', {}, 'Largest ', coverMaxText, coverMax),
   range('How thick', .05, 1, .05, coverThick, v => { coverThick = v; })),
  el('div', {class: 'cb-group'}, el('b', {}, 'Shape the ground'), el('div', {class: 'cb-btns'}, SHAPES.map(([op, t]) => button(t, {kind: 'shape', op})))),
  // ONE BRUSH AND ONE PEN, ON THE LAYER CHOSEN (the builder-ux goal, 10
  // November 2026): the layer is the paint program's colour, chosen here or by
  // clicking it in Layers. Replaced a Paint and an Outline button for each of
  // the landscape's surfaces -- 22 buttons that were really two tools.
  el('div', {class: 'cb-group cb-surfaces'}, el('b', {}, 'Surfaces'),
   el('label', {}, 'Layer ', layerPick),
   el('div', {class: 'cb-btns'},
    el('button', {class: 'cb-btn', type: 'button', 'data-tool': 'brush', title: 'Paint brush (B): drag to paint the chosen layer', onclick: () => setTool({kind: 'paint', surface: layer})}, 'Paint brush'),
    el('button', {class: 'cb-btn', type: 'button', 'data-tool': 'pen', title: 'Pen (P): click nodes round a shape -- the curve shown is what fills -- then click the first node, double-click or press Enter to fill the chosen layer', onclick: () => setTool({kind: 'outline', surface: layer})}, 'Pen'),
    button('Erase brush', {kind: 'erase'}), button('Erase all layers', {kind: 'eraseAll'}), button('Smooth edges', {kind: 'smoothEdges'})),
   underLine,
   el('button', {class: 'cb-btn', type: 'button', style: 'width:100%;margin-top:4px', onclick: skinLand,
    title: "Paint the steep ground the landscape's rock and the ground below it its apron, read from the land's heights -- a best effort; paint over it, or Undo"}, 'Skin from the land')),
  el('div', {class: 'cb-group'}, el('b', {}, 'Clean up'), el('div', {class: 'cb-btns'},
    el('button', {class: 'cb-btn', type: 'button', onclick: () => { editor.smoothEdges({radius: 1.5, kind: layerNow()}); cleaned(); }}, 'Smooth all edges'),
    el('button', {class: 'cb-btn', type: 'button', onclick: () => { editor.tidy({kind: layerNow()}); cleaned(); }}, 'Tidy specks')),
   el('small', {}, 'Extrapolate the layer above: lay another round it, a width out.'),
   el('div', {class: 'cb-btns'}, el('select', {class: 'cb-exto', onchange: e => { exTo = e.target.value; }}, landscapeKinds().filter(k => k !== 'rough').map(k => el('option', {value: k, selected: k === exTo}, label(k)))),
    el('input', {type: 'number', class: 'cb-exwidth', min: .5, max: 40, step: .5, value: exWidth, title: 'metres', oninput: e => { exWidth = +e.target.value || 4; }})),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => { if (editor.extrapolate({from: layer, to: exTo, width: exWidth})) cleaned(); else status.textContent = 'Pick a layer that holds something, and another to lay round it.'; }}, 'Extrapolate')),
  el('div', {class: 'cb-group'}, el('b', {}, 'Ground cover'), coverButtons()),
  el('div', {class: 'cb-group cb-layers'}, el('b', {}, 'Layers'), el('small', {}, 'Top first. Show or hide one; Erase takes it off under the brush.'), layerList),
  el('div', {class: 'cb-group'}, el('b', {}, 'Water and sand'), el('div', {class: 'cb-btns'},
   button('Draw a pond', {kind: 'pond'}), button('Draw a creek', {kind: 'creek'}), button('Dig a bunker', {kind: 'bunker'}))),
  el('div', {class: 'cb-group'}, el('b', {}, 'Trees'), el('div', {class: 'cb-btns'},
   button('Place tree', {kind: 'placeTree'}), button('Tree brush', {kind: 'cover', cover: 'trees'}), button('Tree zone', {kind: 'treeZone'}), button('Clear trees', {kind: 'clear'}), button('Size a tree', {kind: 'sizeTree'})),
   el('label', {'data-for': 'placeTree'}, 'Which tree ', el('select', {class: 'cb-treekind', style: 'width:100%', title: 'The tree to place, from those this landscape grows', onchange: e => { treeKind = e.target.value; showModel(); }}, el('option', {value: ''}, 'Any of the landscape\'s'), ...treeChoices(BIOMES[s.landscape]).map(([k, name]) => el('option', {value: k, selected: k === treeKind}, name)))),
   el('label', {'data-for': 'placeTree'}, 'Tree height, metres ', el('input', {type: 'number', class: 'cb-treeh', min: 3, max: 60, value: treeH, oninput: e => { treeH = +e.target.value || 15; showModel(); }})),
   el('label', {'data-for': 'treeZone'}, 'Trees a hectare ', el('input', {type: 'number', class: 'cb-density', min: 10, max: 600, value: zoneDensity, oninput: e => { zoneDensity = +e.target.value || 120; }})),
   el('button', {class: 'cb-btn', type: 'button', style: 'width:100%', onclick: clearTurfTrees}, 'Clear trees from tees and greens'),
   el('label', {title: 'Every tree on the course together'}, 'Every tree\'s size ', scaleText, treeScale),
   el('label', {'data-for': 'sizeTree'}, 'This tree ', oneText, oneTree),
   // Live: the trees redraw as it is ticked, and Game view shows them next.
   treePlanControls(el, BIOMES[s.landscape], s.treePlan, plan => { editor.setTreePlan(plan); view.refreshTrees(); refreshSave(); })),
  el('div', {class: 'cb-group'}, el('b', {}, 'Houses'), el('div', {class: 'cb-btns'}, button('House', {kind: 'house'}), button('House zone', {kind: 'homeZone'}), button('Clear houses', {kind: 'clearHomes'}))),
 ); };
 buildTools();

 // ---- the right: the course, its holes, the checks, Save.
 const nameInput = el('input', {value: s.name, maxlength: 60, oninput: e => { s.name = e.target.value.trim() || s.name; setTitle(s.name); refreshSave(); }});
 const landscape = el('select', {onchange: e => { editor.setLandscape(e.target.value); if (!treeChoices(BIOMES[s.landscape]).some(([k]) => k === treeKind)) treeKind = ''; view.refreshAll(); buildTools(); setTool({kind: 'navigate'}); refreshLayers(); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === s.landscape}, BIOMES[k].name)));
 const holeList = el('ul');
 const checkList = el('ul'), roundList = el('ul');
 async function runTest() {
  roundList.replaceChildren(el('li', {}, 'The virtual golfers are playing\u2026'));
  const lines = [];
  try {
   const r = await testRound(editor.toDoc(), {onHole: h => { lines.push(el('li', {onclick: () => h.stuck && view.controls.target.set(h.stuck.x, editor.height(h.stuck.x, h.stuck.z), h.stuck.z)}, `Hole ${h.number} (par ${h.par}): ${h.strokes.join(' and ')}${h.stuck ? ` -- stuck on ${h.stuck.on}` : ''}`)); roundList.replaceChildren(...lines); }, pause: () => new Promise(res => setTimeout(res, 0))});
   lines.unshift(el('li', {style: 'color:var(--hot)'}, `${r.total.toFixed(1)} on average against par ${r.par}`)); roundList.replaceChildren(...lines);
  } catch (e) { roundList.replaceChildren(el('li', {}, 'Could not play it: ' + e.message)); }
 }
 const parSelect = el('select', {class: 'cb-epar', title: 'The picked hole\'s par', onchange: e => { editor.setPar(selected, +e.target.value); refreshHoles(); }}, [3, 4, 5, 6].map(v => el('option', {value: v}, `Par ${v}`)));
 const holeTools = el('div', {class: 'cb-btns'},
  button('Back tee', {kind: 'tee', set: 'back'}), button('Middle tee', {kind: 'tee', set: 'middle'}), button('Front tee', {kind: 'tee', set: 'front'}),
  button('Green', {kind: 'green'}), button('Add a bend', {kind: 'bend'}), button('Drag markers', {kind: 'marks'}),
  // Par set by hand, hole by hole (the owner, 1 November 2026: "let the user
  // set the par. per hole"); the yards are the line's, not typed.
  parSelect);
 function refreshHoles() {
  holeList.replaceChildren(...s.holes.map((h, i) => {
   const len = h.line.reduce((d, p, k) => k ? d + Math.hypot(p[0] - h.line[k - 1][0], p[1] - h.line[k - 1][1]) : 0, 0);
   return el('li', {style: i === selected ? 'color:var(--hot)' : '', onclick: () => { selected = i; refreshHoles(); view.frameHole(i); }}, `Hole ${h.number} · par ${h.par} · ${Math.round(len / .9144)} yd`);
  }));
  view.refreshHoles(selected);
  parSelect.value = String(s.holes[selected]?.par ?? 4);
 }
 function runChecks() {
  const found = checkCourse(editor);
  checkList.replaceChildren(...(found.length ? found.map(c => el('li', {onclick: () => c.at && view.camera && view.controls.target.set(c.at.x, editor.height(c.at.x, c.at.z), c.at.z)}, c.text)) : [el('li', {}, 'Nothing breaks a rule.')]));
 }
 side.replaceChildren(
  el('h4', {}, 'The course'), el('div', {class: 'cb-field'}, el('label', {}, 'Name'), nameInput),
  el('div', {class: 'cb-field'}, el('label', {}, 'Landscape (the look; the land and lies stay)'), landscape),
  el('h4', {style: 'margin-top:10px'}, 'Holes'), holeList, holeTools,
  el('h4', {style: 'margin-top:10px'}, 'Checks'), el('button', {class: 'cb-btn', type: 'button', onclick: runChecks}, 'Check the course'), checkList,
  el('h4', {style: 'margin-top:10px'}, 'Test round'), el('button', {class: 'cb-btn', type: 'button', onclick: runTest}, 'Play a test round'), roundList);
 refreshHoles(); refreshLayers();
 // CLOSE ASKS TWICE (the owner, 1 November 2026: "close needs a double
 // confirm if its going to fully close the project in the builder"): Close
 // ends the course and goes back to the builder's start, so it asks, and
 // then asks again -- the second time saying what is not saved.
 const leave = () => { game?.dispose(); game = null; current?.view.dispose(); current = null; document.removeEventListener('keydown', onKey); };
 // GAME VIEW (game-view.js; the owner, 4 November 2026): the course in the
 // game's own picture, with no tools, and back. The game's drawing code loads
 // at the first press. The editor keeps everything while it shows, and draws
 // nothing. Built again only when something changed since the last look.
 let game = null, gameMark = null, opening = false;
 const gameButton = el('button', {class: 'cb-btn', type: 'button', 'data-gameview': '', title: 'See this course in the game\'s own picture, to fly round and look at. Nothing can be edited there. G goes there and back.', onclick: () => toggleGame()}, 'Game view');
 async function toggleGame() {
  if (opening) return;
  if (game?.showing) { game.hide(); view.pause(false); gameButton.textContent = 'Game view'; gameButton.classList.remove('cb-on'); return; }
  opening = true;
  try {
   setBusy('Opening the game\'s picture…');
   await new Promise(r => setTimeout(r, 30));
   const mine = current?.editor === editor; if (!mine) return;
   if (!game) { const {createGameView} = await import('./game-view.js'); game = createGameView(page, {onBack: toggleGame, busy: setBusy}); }
   const mark = changeMark(s), doc = sameMark(mark, gameMark) ? null : (setBusy('Gathering your changes…'), await new Promise(r => setTimeout(r, 30)), editor.toDoc());
   const {eye, look} = view.eye();
   view.pause(true);
   await game.show({doc, pose: poseFrom(eye, look)});
   gameMark = mark; gameButton.textContent = 'Back to editor'; gameButton.classList.add('cb-on');
  } catch (e) {
   view.pause(false); setBusy(''); status.textContent = 'Could not open Game view: ' + e.message;
  } finally { opening = false; }
 }
 topTools(
  // Back to 2D takes what was done here with it (door-real.js remount,
  // round-trip.js), so it asks nothing. On every course since 4 November 2026:
  // one that did not come from door 2's steps goes there as a draft made from
  // the course itself (draft-from-doc.js).
  el('button', {class: 'cb-btn', type: 'button', title: back ? 'Back to door 2\'s steps, taking what you changed here with you: painted layers, shaping, holes, trees and houses' : 'To the 2D plan of this course: its layers, holes, trees and houses, as they stand here', onclick: async () => {
   if (back) { leave(); back(editor); return; }
   setBusy('Laying the course out in 2D…');
   await new Promise(r => setTimeout(r, 30));
   try {
    const [{open, openSaved}, {draftFromDoc}] = await Promise.all([import('./door-real.js'), import('./draft-from-doc.js')]);
    if (work) { const made = withEditorWork(await work.draft(), editorWork(editor.toDoc())); leave(); await openSaved(made); return; }
    const made = draftFromDoc(editor.toDoc());
    leave(); open(made);
   } catch (e) { status.textContent = 'Could not lay it out in 2D: ' + e.message; } finally { setBusy(''); }
  }}, 'Back to 2D'),
  work ? el('button', {class: 'cb-btn', type: 'button', title: 'A copy of this course to give to someone: what the game plays, without the pictures, the map data and the rest of your builder work', onclick: shareCopy}, 'Save a copy to share') : null,
  gameButton,
  el('button', {class: 'cb-btn', type: 'button', onclick: () => closeCourse()}, 'Close'));
 function closeCourse() {
  if (!confirm('Close this course and go back to the builder\'s start?')) return;
  if (!confirm(s.changed ? 'Are you sure? It has changes that are not saved, and they will be lost.' : 'Are you sure? The course closes (anything saved stays in its file).')) return;
  leave(); home();
 }

 // ---- the mouse on the ground.
 // One dab of a steadied brush, and the stroke's box grown to hold it.
 const dab = q => {
  const box = tool.kind === 'paint' ? editor.paint({kind: tool.surface, x: q.x, z: q.z, radius, group: down.group}) : editor.erase({kind: tool.kind === 'erase' ? layerNow() : undefined, x: q.x, z: q.z, radius, group: down.group});
  view.refreshSurface(box);
  const b = down.box; down.box = b ? [Math.min(b[0], q.x), Math.max(b[1], q.x), Math.min(b[2], q.z), Math.max(b[3], q.z)] : [q.x, q.x, q.z, q.z];
 };
 const apply = (p, first) => {
  if (tool.kind === 'shape' && tool.op !== 'ramp') {
   if (first) down.level = editor.height(p.x, p.z);
   view.refreshLand(editor.shape({op: tool.op, x: p.x, z: p.z, radius, strength, level: down.level, group: down.group}));
  } else if (STEADIED.has(tool.kind) && down.steady) {
   down.lastP = p;
   for (const q of first ? down.steady.down(p) : down.steady.move(p)) dab(q);
  } else if (tool.kind === 'paint') view.refreshSurface(editor.paint({kind: tool.surface, x: p.x, z: p.z, radius, group: down.group}));
  else if (tool.kind === 'erase') view.refreshSurface(editor.erase({kind: layerNow(), x: p.x, z: p.z, radius, group: down.group}));
  else if (tool.kind === 'eraseAll') view.refreshSurface(editor.erase({x: p.x, z: p.z, radius, group: down.group}));
  else if (tool.kind === 'smoothEdges') view.refreshSurface(editor.smoothEdges({x: p.x, z: p.z, radius: Math.max(1, radius / 3), area: radius, kind: layerNow(), group: down.group}));
  else if (tool.kind === 'placeTree' && first) {
   if (editor.treeFits(p.x, p.z)) { editor.placeTree({x: p.x, z: p.z, h: treeH, species: treeKind || null}); view.refreshTrees(); }
   else status.textContent = `A tree cannot stand on ${editor.surfaceAt(p.x, p.z)}.`;
  } else if (tool.kind === 'clear') { editor.removeTrees({x: p.x, z: p.z, radius}); view.refreshTrees(); }
  else if (tool.kind === 'house' && first) { if (editor.addHome({x: p.x, z: p.z})) view.refreshHomes(); else status.textContent = 'A house needs open ground all round it -- not turf, sand, water or a path.'; }
  else if (tool.kind === 'select') carryTo(p);
  else if (tool.kind === 'marks') { down.hold.set(p.x, p.z); view.refreshHoles(selected); }
  else if (tool.kind === 'cover') {
   if (!first && Math.hypot(p.x - down.last.x, p.z - down.last.z) < Math.max(1.5, radius * .5)) return;
   const c = coverByKey(BIOMES[s.landscape], tool.cover), {min, max} = coverSizes[tool.cover];
   if (editor.paintCover({cover: c, x: p.x, z: p.z, radius, min, max, density: coverThick, group: down.group})) { view.refreshTrees(); view.refreshRocks(); }
   down.last = p;
  } else if (tool.kind === 'clearCover') { if (editor.clearCover({x: p.x, z: p.z, radius, group: down.group})) { view.refreshTrees(); view.refreshRocks(); } }
  else if (tool.kind === 'clearHomes') { if (editor.removeHomes({x: p.x, z: p.z, radius})) view.refreshHomes(); }
 };
 canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || tool.kind === 'navigate') return;
  const p = view.pick(e); if (!p) return;
  canvas.setPointerCapture(e.pointerId);
  // THE PEN (pen.js; the builder-ux goal): a click on the first node closes
  // the shape and fills it; any other click adds a node (Shift: a sharp
  // corner). The curve drawn is the one filled.
  if (OUTLINES.has(tool.kind) || tool.kind === 'creek') {
   const first = draft.length >= 3 && OUTLINES.has(tool.kind) ? view.screenOf(draft[0][0], draft[0][1]) : null;
   if (first && Math.hypot(first.x - e.clientX, first.y - e.clientY) <= 12) { finishOutline(); return; }
   draft.push([p.x, p.z]); if (e.shiftKey) sharp.add(draft.length - 1); showDraft(); return;
  }
  if (tool.kind === 'bunker') { const b = editor.digBunker({x: p.x, z: p.z, radius: Math.max(2, radius)}); view.refreshLand(b); view.refreshSurface(b); return; }
  if (tool.kind === 'tee') { editor.setTee(selected, tool.set, p.x, p.z); refreshHoles(); return; }
  if (tool.kind === 'green') { editor.setGreen(selected, p.x, p.z); refreshHoles(); return; }
  if (tool.kind === 'bend') { editor.addBend(selected, p.x, p.z); refreshHoles(); return; }
  if (tool.kind === 'shape' && tool.op === 'ramp') {
   if (!rampA) { rampA = p; status.textContent = 'Now click the high end.'; return; }
   view.refreshLand(editor.shape({op: 'ramp', a: rampA, b: p, radius, strength})); rampA = null; status.textContent = HINT.shape(tool); return;
  }
  if (tool.kind === 'select') {
   // On an anchor it turns, inside the outline it moves; anywhere else is a
   // new choice. The first click only ever selects.
   const anchor = chosen ? view.anchorAt(e) : -1;
   if (chosen && (anchor >= 0 || editor.onPick(chosen, p.x, p.z))) { down = {carry: true, turn: anchor >= 0, pick: chosen, mid: editor.middleOf(chosen), start: p, hold: null, dx: 0, dz: 0, angle: 0}; return; }
   choose(editor.pickAt({x: p.x, z: p.z}));
   status.textContent = chosen ? `${nameOf(chosen)} selected. Drag inside the outline to move it${chosen.type === 'shape' || chosen.type === 'home' ? ', or an anchor to turn it' : ''}.` : 'Nothing there to select: only rough.';
   return;
  }
  if (tool.kind === 'sizeTree') { pickTree(p); return; }
  if (tool.kind === 'marks') {
   const g = markUnder(e); if (!g) { status.textContent = 'No marker there: press on a tee, bend or green.'; return; }
   if (g.hole !== selected) { selected = g.hole; refreshHoles(); }
   down = {hold: editor.holdMark(g.hole, g)}; canvas.style.cursor = 'grabbing'; return;
  }
  down = {group: {}, last: p};
  if (STEADIED.has(tool.kind)) {
   const a = view.screenOf(p.x, p.z), b = view.screenOf(p.x + 1, p.z), perM = a && b ? Math.max(.05, Math.hypot(b.x - a.x, b.y - a.y)) : 1;
   down.steady = createSteady({string: steadiness / 100 * 30 / perM, spacing: Math.max(s.raster.cell * .5, radius * .25)});
  }
  apply(p, true);
 });
 let pending = null;
 canvas.addEventListener('pointermove', e => {
  const p = view.pick(e);
  if (p) {
   if (tool.kind === 'sizeTree') showPicked();
   else view.cursor(['shape', 'paint', 'erase', 'eraseAll', 'smoothEdges', 'clear', 'clearHomes', 'cover', 'clearCover'].includes(tool.kind) ? p.x : null, p.z, radius);
   status.textContent = `${editor.surfaceAt(p.x, p.z)} · ${p.y.toFixed(1)} m · ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`;
   if (draft.length && (OUTLINES.has(tool.kind) || tool.kind === 'creek')) showDraft(p);
  }
  if (tool.kind === 'marks' && !down) canvas.style.cursor = markUnder(e) ? 'grab' : '';
  if (tool.kind === 'select' && !down) canvas.style.cursor = !chosen ? '' : view.anchorAt(e) >= 0 ? 'grab' : p && editor.onPick(chosen, p.x, p.z) ? 'move' : '';
  // A frame's worth of moves is one: the latest, and what is still waiting when
  // the button comes up is applied first, or a quick drag lands short of where
  // it was let go (the smoke's builder-tools, 5 November 2026, on a busy card:
  // a bunker carried a few metres of a hundred).
  if (down && p) { if (!pending) requestAnimationFrame(() => { if (down && pending) apply(pending, false); pending = null; }); pending = p; }
 });
 // The tee, bend or green under the mouse (within 14 pixels, PLACED), the hole in
 // hand first, then any other. {hole, kind, index}, or null.
 function markUnder(e) {
  const near = i => { let got = null, d0 = 14; for (const m of editor.marksOf(i)) { const q = view.screenOf(m.x, m.z); if (!q) continue; const d = Math.hypot(q.x - e.clientX, q.y - e.clientY); if (d <= d0) { d0 = d; got = {...m, hole: i}; } } return got; };
  const here = near(selected); if (here) return here;
  for (let i = 0; i < s.holes.length; i++) { if (i === selected) continue; const m = near(i); if (m) return m; }
  return null;
 }
 // CARRYING WHAT IS SELECTED. The first real move picks it up (what lay under
 // it shows, and its filled picture takes its place); each move after only
 // lays that picture and outline on the land, so even a whole fairway follows
 // the pointer frame by frame. A press with no move is not a pick-up at all.
 function carryTo(p) {
  const d = down;
  if (!d.hold) {
   if (Math.hypot(p.x - d.start.x, p.z - d.start.z) < .3) return;
   d.hold = editor.holdShape(d.pick);
   if (d.hold.box) { view.refreshSurface(d.hold.box); view.ghost(d.pick.kind); }
  }
  if (d.turn) { d.angle = Math.atan2(d.start.x - d.mid.x, d.start.z - d.mid.z) - Math.atan2(p.x - d.mid.x, p.z - d.mid.z); }
  else { d.dx = p.x - d.start.x; d.dz = p.z - d.start.z; }
  view.carry(d.dx, d.dz, d.angle);
  d.hold.set(d.dx, d.dz, d.angle);
  if (d.pick.type === 'tree') view.placeTree(d.pick.index);
  else if (d.pick.type === 'rock') view.placeRock(d.pick.index);
  else if (d.pick.type === 'home') view.refreshHomes();
 }
 canvas.addEventListener('pointerup', () => { if (down && pending) { apply(pending, false); pending = null; } if (down?.hold && tool.kind === 'marks') { down.hold.done(); down = null; canvas.style.cursor = ''; refreshHoles(); refreshSave(); return; } if (down?.carry) {
   const {hold, dx, dz, angle, pick} = down; down = null;
   if (!hold) return;
   const got = hold.drop(dx, dz, angle);
   view.ghost(null); view.carry(0, 0, 0);
   if (got.water) { view.refreshLand(got.box); view.refreshWater(); }
   if (got.box) { view.refreshSurface(got.box); refreshLayers(); }
   else if (pick.type === 'tree') view.refreshTrees(); else if (pick.type === 'rock') view.refreshRocks(); else if (pick.type === 'home') view.refreshHomes();
   choose(got.pick); refreshSave(); return;
  } if (down?.steady) {
   for (const q of down.steady.up(down.lastP ?? null)) dab(q);
   if (down.box && smoothStroke && tool.kind !== 'eraseAll' && (tool.kind === 'paint' ? tool.surface : layer) !== 'rough') {
    const [x0, x1, z0, z1] = down.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, area = Math.hypot(x1 - x0, z1 - z0) / 2 + radius + 2;
    view.refreshSurface(editor.smoothEdges({x: cx, z: cz, radius: 1.5, area, kind: tool.kind === 'paint' ? tool.surface : layerNow(), group: down.group}));
   }
  } if (down) { down = null; if (tool.kind === 'shape') { view.refreshHoles(selected); view.refreshTrees(); } if (['paint', 'erase', 'eraseAll', 'smoothEdges'].includes(tool.kind)) { const w = editor.settleWater(); if (w) view.refreshLand(w); view.refreshWater(); refreshLayers(); } } });
 // The pen's curve through the nodes (and the pointer, while drawing), closed
 // for a shape and open for a creek, as view.draft draws it.
 const penOf = (nodes, open) => { const pts = penCurve(nodes, {closed: !open, sharp: [...sharp], step: Math.max(.5, s.raster.cell)}); return open || pts.length < 3 ? pts : [...pts, pts[0]]; };
 function showDraft(hover = null) { const nodes = hover ? [...draft, [hover.x, hover.z]] : draft; view.draft(nodes.length > 1 ? penOf(nodes, tool.kind === 'creek') : nodes); }
 const finishOutline = () => {
  if (draft.length < (tool.kind === 'creek' ? 2 : 3)) return;
  // What is filled is the pen's curve, the line that was shown.
  { const curve = penCurve(draft, {closed: tool.kind !== 'creek', sharp: [...sharp], step: Math.max(.5, s.raster.cell)}); draft = curve; sharp.clear(); }
  if (tool.kind === 'creek') { const b = editor.addCreek({points: draft, width: Math.max(1.5, Math.min(12, radius / 2))}); view.refreshLand(b); view.refreshWater(); draft = []; view.draft([]); return; }
  if (tool.kind === 'treeZone' || tool.kind === 'homeZone') {
   const seed = s.undo.length + 1, n = tool.kind === 'treeZone' ? editor.treeZone(draft, {density: zoneDensity, seed}) : editor.homeZone(draft, {seed});
   status.textContent = n ? `${n} ${tool.kind === 'treeZone' ? 'tree' : 'house'}${n === 1 ? '' : tool.kind === 'treeZone' ? 's' : 's'} in the zone. Undo takes them out.` : 'Nothing fits there: it needs open ground.';
   if (tool.kind === 'treeZone') view.refreshTrees(); else view.refreshHomes();
   draft = []; view.draft([]); return;
  }
  if (tool.kind === 'pond') { editor.addPond({ring: draft}); view.refreshLand(s.undo.at(-1).box); view.refreshWater(); }
  else { editor.fillOutline({kind: tool.surface, ring: draft}); const w = editor.settleWater(); if (w) view.refreshLand(w); view.refreshWater(); }
  const xs = draft.map(q => q[0]), zs = draft.map(q => q[1]);
  view.refreshSurface([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  draft = []; view.draft([]); refreshLayers();
 };
 canvas.addEventListener('dblclick', () => { if (OUTLINES.has(tool.kind) || tool.kind === 'creek') { draft.pop(); finishOutline(); } });
 const onKey = e => {
  if (!current || current.editor !== editor || e.target.tagName === 'INPUT') return;
  // G (Game view), Ctrl+Z and Ctrl+Y are the menus' now (useMenus below).
  if (game?.showing) { if (e.key === 'Escape') toggleGame(); return; }
  if (e.key === 'Enter') finishOutline();
  else if (e.key === 'Escape') { if (chosen) { choose(null); return; } draft = []; sharp.clear(); view.draft([]); setTool({kind: 'navigate'}); }
  else if (e.key === 'Backspace' && draft.length) { e.preventDefault(); sharp.delete(draft.length - 1); draft.pop(); showDraft(); }
 };
 document.addEventListener('keydown', onKey);
 function after(step) {
  if (!step) return;
  if (step.parts) view.refreshLand(step.box);
  if (step.cells) { view.refreshSurface(step.box); refreshLayers(); }
  if (step.snapshot) { landscape.value = s.landscape; view.refreshAll(); refreshHoles(); }
  else if (step.parts && step.cells) view.refreshSurface(step.box);
  else if (step.parts) { view.refreshHoles(selected); view.refreshTrees(); }
 }
 function undo() { unpick(); showPicked(); choose(null); after(editor.undo()); }
 function redo() { unpick(); showPicked(); choose(null); after(editor.redo()); }

 // What the editor hands the door 2 session behind this course.
 function editorWork(now) { return {base: doc, now, changed: editor.changedLayers(), hidden: editor.hiddenLayers()}; }
 async function shareCopy() {
  setBusy('Saving a copy to share…');
  try {
   await new Promise(r => setTimeout(r, 30));
   const bytes = await writeBuiltFile(validateDoc(editor.toDoc()), BUILT_VERSION);
   const r = await saveBytes(bytes, {key: `share-${opened}`, name: s.name, file: fileName(s.name).replace(/\.fairway$/, '-share.fairway'), remember: false});
   if (r.how !== 'cancelled') status.textContent = `A copy to share: ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB), the course without your pictures and builder work.`;
  } catch (e) { status.textContent = 'Could not save the copy: ' + e.message; } finally { setBusy(''); }
 }
 // Save (the top bar's, and Ctrl+S): the course as a .fairway file, with the
 // door 2 session behind it; once saved, again to the same file until it is
 // renamed (saving.js).
 setSaver({
  key: `editor-${++opened}`, name: () => s.name, file: () => fileName(s.name),
  async bytes() {
   await new Promise(r => setTimeout(r, 30));
   const now = editor.toDoc({onStep: what => setBusy(`Saving the course… ${what}`)}), course = validateDoc(now);
   if (!work) return writeBuiltFile(course, BUILT_VERSION);
   setBusy('Saving the land, the map data and the pictures…');
   return writeBuiltFile(course, BUILT_VERSION, {builder: await writeDraft(withEditorWork(await work.draft(), editorWork(now)))});
  },
  said(r, bytes) {
   if (r.how === 'failed') { status.textContent = 'Could not save: ' + r.error.message; return; }
   s.changed = false;
   status.textContent = `${r.how === 'overwrite' ? 'Saved again to' : 'Saved'} ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB). Open it in Fairway: Saved courses, Import courses from a file.${work ? ' It keeps everything the builder needs, your pictures too: to give the course to someone, use Save a copy to share.' : ''}`;
  },
 });
 setTool({kind: 'navigate'});
 // THE 3D EDITOR'S MENUS (menu.js; the builder-ux goal). Its keys leave W, A,
 // S, D, Q and E to the camera's flying (view.js), so Erase and Smooth edges
 // have none here; G is Game view, as before.
 const surfaceTool = kind => () => setTool({kind, surface: layer});
 const shapeTool = op => () => setTool({kind: 'shape', op});
 const backBtn = () => [...document.querySelectorAll('#cbTopTools .cb-btn')].find(b => b.textContent === 'Back to 2D');
 const notGame = () => !game?.showing;
 useMenus({
  file: [{label: 'Save a copy to share…', enabled: () => !!work, run: () => shareCopy()}, {sep: true}, {label: 'Back to 2D', run: () => backBtn()?.click()}, {label: 'Close the course', run: () => closeCourse()}],
  edit: [{label: 'Undo', key: 'Ctrl+Z', enabled: notGame, run: () => undo()}, {label: 'Redo', key: ['Ctrl+Y', 'Ctrl+Shift+Z'], enabled: notGame, run: () => redo()}, {sep: true},
   // DELETE (item 9): a pond with its water, a creek, a shape, a tree, a rock, a house.
   {label: 'Delete what is selected', key: 'Delete', enabled: () => notGame() && !!chosen, run: () => deleteChosen()}],
  view: [{label: 'From above', key: 'F', enabled: notGame, run: () => view.planView()}, {label: 'This hole', enabled: notGame, run: () => view.frameHole(selected)}, {sep: true}, {label: 'Game view', key: 'G', checked: () => !!game?.showing, run: () => toggleGame()}],
  tools: [
   {label: 'Move the view', key: 'H', enabled: notGame, checked: () => tool.kind === 'navigate', run: () => setTool({kind: 'navigate'})},
   {label: 'Select shape', key: 'V', enabled: notGame, checked: () => tool.kind === 'select', run: () => setTool({kind: 'select'})},
   {sep: true},
   {label: 'Paint brush (the chosen layer)', key: 'B', enabled: notGame, checked: () => tool.kind === 'paint', run: surfaceTool('paint')},
   {label: 'Pen (the chosen layer)', key: 'P', enabled: notGame, checked: () => tool.kind === 'outline', run: surfaceTool('outline')},
   {label: 'Erase brush', enabled: notGame, checked: () => tool.kind === 'erase', run: () => setTool({kind: 'erase'})},
   {label: 'Smooth edges', enabled: notGame, checked: () => tool.kind === 'smoothEdges', run: () => setTool({kind: 'smoothEdges'})},
   {sep: true},
   {label: 'Raise the ground', key: 'R', enabled: notGame, run: shapeTool('raise')},
   {label: 'Lower the ground', key: 'L', enabled: notGame, run: shapeTool('lower')},
   {sep: true},
   {label: 'Draw a creek', key: 'C', enabled: notGame, run: () => setTool({kind: 'creek'})},
   {label: 'Dig a bunker', key: 'U', enabled: notGame, run: () => setTool({kind: 'bunker'})},
   {label: 'Place tree', key: 'T', enabled: notGame, run: () => setTool({kind: 'placeTree'})},
   {label: 'House', key: 'O', enabled: notGame, run: () => setTool({kind: 'house'})},
   {sep: true},
   {label: 'Smaller brush', key: '[', enabled: notGame, run: () => sizeBrush(-1)}, {label: 'Larger brush', key: ']', enabled: notGame, run: () => sizeBrush(1)},
  ],
  keys: [{group: 'The 3D view', label: 'Move, turn', key: 'Left-drag, right-drag'}, {group: 'The 3D view', label: 'Zoom', key: 'Wheel'}, {group: 'The 3D view', label: 'Fly', key: 'W A S D, Q down, E up'}, {group: 'The 3D view', label: 'Close a shape and fill it', key: 'Enter, double-click, or the first node'}, {group: 'The 3D view', label: 'Take the last node off', key: 'Backspace'}, {group: 'The 3D view', label: 'Drop a shape or a selection', key: 'Esc'}],
 });
 function deleteChosen() {
  if (!chosen) return;
  const what = nameOf(chosen), type = chosen.type, kind = chosen.kind, box = editor.removePick(chosen);
  choose(null);
  if (box) { view.refreshSurface(box); refreshLayers(); }
  if (type === 'creek' || kind === 'water') { view.refreshWater(); }
  if (type === 'tree') view.refreshTrees(); else if (type === 'rock') view.refreshRocks(); else if (type === 'home') view.refreshHomes();
  refreshSave();
  status.textContent = `${what} deleted${type === 'creek' || kind === 'water' ? ': its channel or bed stays in the land -- Fill to surrounding raises it' : ''}. Undo puts it back.`;
 }
 function sizeBrush(d) { radius = Math.max(1, Math.min(60, Math.round(radius * (d > 0 ? 1.25 : .8)) + (d > 0 ? 1 : 0))); const r = tools.querySelector('.cb-group input[type=range]'); if (r) r.value = radius; status.textContent = `Brush ${radius} m round.`; }
 status.textContent = from === 'generated' ? 'Taken over: everything here is yours to change. Save keeps it as a .fairway file Fairway plays.' : HINT.navigate();
 return current;
}
