// THE EDITOR both doors end in (the course builder, stages 3-5;
// docs/COURSE_BUILDER.md, *The editor*): the view (view.js), the tools down
// the left, the holes and the course on the right, undo, and Save. Every
// change goes through the editing model (editing.js), which is tested in
// Node; this file only turns the mouse and keys into its calls and tells the
// view what to redraw.
import {show, setTitle, setBusy, topTools, home, ui, setSaver, refreshSave} from './builder.js';
import {createEditor, PAINT} from './editing.js';
import {createView} from './view.js';
import {writeBuiltFile, validateDoc} from '../course-doc.js';
import {BUILT_VERSION, BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {fileName} from '../course-file.js';
import {GROUNDS} from '../grounds.js';
import {checkCourse} from './checks.js';
import {testRound} from './test-round.js';
import {layersFor} from './layers.js';
import {coverOptions, COVER_RANGE} from './cover.js';
import {preview} from './preview.js';
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
export function openEditor(doc, {from = 'file', back = null} = {}) {
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
 const nameOf = c => c.type === 'shape' ? label(c.kind) : c.type === 'home' ? 'House' : c.type === 'rock' ? 'Rock' : 'Tree';
 const choose = c => { chosen = c; view.select(c ? {rings: editor.ringsOf(c), mid: editor.middleOf(c), anchors: c.type === 'shape' || c.type === 'home'} : null); };
 // The smoke journeys look (never drive) through this, as the game's do through lab.
 window.fairwayBuilder.editor = current;

 let tool = {kind: 'navigate'}, radius = 8, strength = .5, selected = 0, draft = [], down = null, rampA = null;
 // Ground cover's two sizes, one pair for each kind of cover (PLACED: where
 // cover.js starts them), kept as the brush changes hands.
 const coverSizes = Object.fromEntries(Object.entries(COVER_RANGE).map(([k, r]) => [k, {min: r.from[0], max: r.from[1]}]));
 // The model of what the tool paints or places (preview.js).
 const ITEM = {paint: t => ({kind: 'surface', surface: t.surface}), outline: t => ({kind: 'surface', surface: t.surface}), pond: () => ({kind: 'pond'}), creek: () => ({kind: 'creek'}), bunker: () => ({kind: 'bunker'}), plant: () => ({kind: 'tree'}), house: () => ({kind: 'house'}),
  cover: t => ({kind: 'cover', cover: t.cover, ...coverSizes[t.cover]})};
 const showModel = () => preview().show(ITEM[tool.kind]?.(tool) ?? null, s.landscape);
 const setTool = t => {
  tool = t; draft = []; rampA = null; view.draft([]); view.setToolActive(t.kind !== 'navigate');
  if (t.kind !== 'sizeTree') { unpick(); view.cursor(null); }
  if (t.kind !== 'select') choose(null);
  // Only what the tool in hand uses (`data-for`; the owner, 4 November 2026).
  for (const n of tools.querySelectorAll('[data-for]')) n.hidden = !n.dataset.for.split(' ').includes(t.kind);
  for (const b of tools.querySelectorAll('[data-tool]')) b.classList.toggle('cb-on', b.dataset.tool === toolKey(t));
  status.textContent = HINT[t.kind]?.(t) ?? '';
  canvas.style.cursor = '';
  refreshCoverSizes(); showModel();
 };
 const toolKey = t => [t.kind, t.op || t.surface || t.set || t.cover || ''].join(':');
 const HINT = {
  navigate: () => 'Left-drag moves, right-drag turns, the wheel zooms.',
  shape: t => t.op === 'ramp' ? 'Click the low end, then the high end: the ground between is graded.' : t.op === 'fill' ? 'Fill to surrounding: brush over a hole, wider than it, and it rises smoothly to the ground round it. It never lowers anything.' : `${t.op[0].toUpperCase() + t.op.slice(1)}: drag over the ground. Size and strength on the left.`,
  paint: t => `Paint ${label(t.surface)}: drag over the ground. It goes on the ${label(t.surface).toLowerCase()} layer and covers nothing beneath it.`,
  erase: t => `Erase the ${label(t.surface).toLowerCase()} layer: drag over the ground; what lies under it shows.`,
  outline: t => `Outline ${label(t.surface)}: click its corners, double-click or press Enter to fill it.`,
  pond: () => 'Draw a pond: click its edge, double-click or press Enter. Its level is set just under its lowest bank.',
  creek: () => 'Draw a creek from its head to its foot: click along it, double-click or press Enter. Its channel is cut and its water falls downstream.',
  bunker: () => 'Click to dig a bunker the size of the brush.',
  tee: t => `Click where hole ${selected + 1}'s ${t.set} tee goes.`,
  green: () => `Click where hole ${selected + 1}'s green goes.`,
  bend: () => `Click to add a bend to hole ${selected + 1}'s line.`,
  plant: () => 'Click to plant a tree. Drag to plant a wood.',
  clear: () => 'Drag to take trees out.',
  house: () => 'Click to stand a house: it faces the nearest fairway, green or tee.',
  clearHomes: () => 'Drag to take houses out.',
  select: () => 'Click a green, bunker, fairway, pond, rock, tree or house to select it. Drag inside its outline to move it, or an anchor at a corner to turn it. Undo puts it back.',
  cover: t => `Paint ${coverLabel(t.cover).toLowerCase()}: drag over open ground. Their sizes on the left, and Strength for how thick they lie.`,
  clearCover: () => 'Drag to take rocks and low plants off. Trees stay.',
  sizeTree: () => 'Click a tree, then size it with This tree: its height, crown and trunk together. Undo puts it back.',
 };
 // Each tool's tooltip is its hint (HINT), as the status line gives it.
 const coverLabel = key => coverOptions(BIOMES[s.landscape]).find(c => c.key === key)?.label ?? key;
 const button = (text, t, extra = {}) => el('button', {class: 'cb-btn', type: 'button', 'data-tool': toolKey(t), title: HINT[t.kind]?.(t) ?? text, onclick: () => setTool(t), ...extra}, text);
 const range = (labelText, min, max, step, value, onInput) => el('label', {}, labelText, el('input', {type: 'range', min, max, step, value, oninput: e => onInput(+e.target.value)}));
 // ONLY THE LANDSCAPE'S OWN (the owner, 1 November 2026: "Only allow the
 // user to paint or place ground and objects from that biome"): the turf,
 // sand and path layers and the landscape's own ground types (layers.js
 // layersFor, as door 2's trace offers them); water by its own tools. The
 // trees planted are the landscape's own (a tree record's kind -1: the game
 // grows the landscape's species). Another landscape picked, the tools change
 // with it; a layer already painted from another stays in the Layers list.
 const landscapeKinds = () => { const own = layersFor(BIOMES[s.landscape]); return PAINT.filter(k => k !== 'water' && own.includes(k)); };
 // THE LAYERS (the owner, 1 November 2026: "exposed in the editor as well in
 // real time"): every surface the course holds, top first, its area kept up
 // to date as it is painted; the eye hides one from the view (the course
 // keeps it); Erase takes one off under the brush.
 const layerList = el('ul', {style: 'list-style:none;padding:0;margin:0;font-size:12px'});
 function refreshLayers() {
  const a = s.raster.cell ** 2;
  layerList.replaceChildren(...editor.layersPresent().map(k => { const m = s.raster.layers.masks.get(k), n = m.reduce((t, v) => t + v, 0), hid = editor.isHidden(k);
   return el('li', {'data-layer': k, style: 'display:flex;gap:4px;align-items:center;margin:2px 0'},
    el('button', {class: 'cb-btn', type: 'button', 'data-eye': k, style: 'padding:2px 5px;font-size:11px', onclick: () => { editor.setHidden(k, !hid); view.refreshLayers(); refreshLayers(); }}, hid ? 'hidden' : 'shown'),
    el('span', {style: 'flex:1'}, `${label(k)} ${(n * a / 1e4).toFixed(2)} ha`),
    button('Erase', {kind: 'erase', surface: k}, {style: 'padding:2px 5px;font-size:11px'})); }));
 }
 const paintButtons = (kind) => el('div', {class: 'cb-btns'}, landscapeKinds().map(k => button(label(k), {kind, surface: k})));
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
 const coverSize = which => el('input', {type: 'range', min: .1, max: 6, step: .1, class: `cb-cover${which}`, disabled: true, oninput: e => {
  if (tool.kind !== 'cover') return;
  const c = coverSizes[tool.cover], v = +e.target.value;
  c[which] = v; if (c.min > c.max) c[which === 'min' ? 'max' : 'min'] = v;
  refreshCoverSizes(); showModel();
 }});
 const coverMin = coverSize('min'), coverMax = coverSize('max');
 function refreshCoverSizes() {
  const on = tool.kind === 'cover', c = on ? coverSizes[tool.cover] : null, r = on ? COVER_RANGE[tool.cover] : null;
  for (const [input, text, v] of [[coverMin, coverMinText, c?.min], [coverMax, coverMaxText, c?.max]]) {
   input.disabled = !on;
   if (on) { input.min = r.low; input.max = r.high; input.value = v; }
   text.textContent = on ? `${v.toFixed(1)} m` : '';
  }
 }
 const coverButtons = () => el('div', {class: 'cb-btns'}, coverOptions(BIOMES[s.landscape]).map(c => button(c.label, {kind: 'cover', cover: c.key})), button('Clear cover', {kind: 'clearCover'}));
 function clearTurfTrees() {
  unpick(); showPicked();
  const got = editor.clearTreesFromTurf(); view.refreshTrees();
  status.textContent = got.shrunk || got.removed ? `Off the greens and tees: ${got.shrunk.toLocaleString()} crowns drawn in, ${got.removed.toLocaleString()} trees with no room taken out. Undo puts them back.` : 'No tree reaches over a green or a tee.';
 }
 const buildTools = () => tools.replaceChildren(
  el('div', {class: 'cb-group'}, el('b', {}, 'View'), el('div', {class: 'cb-btns'},
   button('Move', {kind: 'navigate'}), button('Select shape', {kind: 'select'}),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => view.planView()}, 'From above'),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => view.frameHole(selected)}, 'This hole'),
   el('button', {class: 'cb-btn', type: 'button', onclick: undo}, 'Undo'),
   el('button', {class: 'cb-btn', type: 'button', onclick: redo}, 'Redo'))),
  el('div', {class: 'cb-group', 'data-for': 'shape paint erase plant clear clearHomes bunker creek cover clearCover'}, el('b', {}, 'Brush'),
   range('Size', 1, 60, 1, radius, v => { radius = v; }), range('Strength', .05, 1, .05, strength, v => { strength = v; })),
  el('div', {class: 'cb-group'}, el('b', {}, 'Shape the ground'), el('div', {class: 'cb-btns'}, SHAPES.map(([op, t]) => button(t, {kind: 'shape', op})))),
  el('div', {class: 'cb-group'}, el('b', {}, 'Paint'), paintButtons('paint'),
   el('button', {class: 'cb-btn', type: 'button', style: 'width:100%;margin-top:4px', onclick: skinLand,
    title: "Paint the steep ground the landscape's rock and the ground below it its apron, read from the land's heights -- a best effort; paint over it, or Undo"}, 'Skin from the land')),
  el('div', {class: 'cb-group'}, el('b', {}, 'Outline'), paintButtons('outline')),
  el('div', {class: 'cb-group'}, el('b', {}, 'Ground cover'), coverButtons(),
   el('label', {'data-for': 'cover'}, 'Smallest ', coverMinText, coverMin), el('label', {'data-for': 'cover'}, 'Largest ', coverMaxText, coverMax)),
  el('div', {class: 'cb-group cb-layers'}, el('b', {}, 'Layers'), el('small', {}, 'Top first. Show or hide one; Erase takes it off under the brush.'), layerList),
  el('div', {class: 'cb-group'}, el('b', {}, 'Water and sand'), el('div', {class: 'cb-btns'},
   button('Draw a pond', {kind: 'pond'}), button('Draw a creek', {kind: 'creek'}), button('Dig a bunker', {kind: 'bunker'}))),
  el('div', {class: 'cb-group'}, el('b', {}, 'Trees'), el('div', {class: 'cb-btns'},
   button('Plant trees', {kind: 'plant'}), button('Clear trees', {kind: 'clear'}), button('Size a tree', {kind: 'sizeTree'})),
   el('button', {class: 'cb-btn', type: 'button', style: 'width:100%', onclick: clearTurfTrees}, 'Clear trees from tees and greens'),
   el('label', {title: 'Every tree on the course together'}, 'Every tree\'s size ', scaleText, treeScale),
   el('label', {'data-for': 'sizeTree'}, 'This tree ', oneText, oneTree)),
  el('div', {class: 'cb-group'}, el('b', {}, 'Houses'), el('div', {class: 'cb-btns'}, button('House', {kind: 'house'}), button('Clear houses', {kind: 'clearHomes'}))),
 );
 buildTools();

 // ---- the right: the course, its holes, the checks, Save.
 const nameInput = el('input', {value: s.name, maxlength: 60, oninput: e => { s.name = e.target.value.trim() || s.name; setTitle(s.name); refreshSave(); }});
 const landscape = el('select', {onchange: e => { editor.setLandscape(e.target.value); view.refreshAll(); buildTools(); setTool({kind: 'navigate'}); refreshLayers(); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === s.landscape}, BIOMES[k].name)));
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
  button('Green', {kind: 'green'}), button('Add a bend', {kind: 'bend'}),
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
    const [{open}, {draftFromDoc}] = await Promise.all([import('./door-real.js'), import('./draft-from-doc.js')]);
    const made = draftFromDoc(editor.toDoc());
    leave(); open(made);
   } catch (e) { status.textContent = 'Could not lay it out in 2D: ' + e.message; } finally { setBusy(''); }
  }}, 'Back to 2D'),
  gameButton,
  el('button', {class: 'cb-btn', type: 'button', onclick: () => {
   if (!confirm('Close this course and go back to the builder\'s start?')) return;
   if (!confirm(s.changed ? 'Are you sure? It has changes that are not saved, and they will be lost.' : 'Are you sure? The course closes (anything saved stays in its file).')) return;
   leave(); home();
  }}, 'Close'));

 // ---- the mouse on the ground.
 const apply = (p, first) => {
  if (tool.kind === 'shape' && tool.op !== 'ramp') {
   if (first) down.level = editor.height(p.x, p.z);
   view.refreshLand(editor.shape({op: tool.op, x: p.x, z: p.z, radius, strength, level: down.level, group: down.group}));
  } else if (tool.kind === 'paint') view.refreshSurface(editor.paint({kind: tool.surface, x: p.x, z: p.z, radius, group: down.group}));
  else if (tool.kind === 'erase') view.refreshSurface(editor.erase({kind: tool.surface, x: p.x, z: p.z, radius, group: down.group}));
  else if (tool.kind === 'plant') {
   if (!first && Math.hypot(p.x - down.last.x, p.z - down.last.z) < Math.max(4, radius * .6)) return;
   const h = 10 + strength * 20;
   editor.addTree([p.x, p.z, h, h * .3, Math.min(.8, h * .027), 2, -1]); down.last = p; view.refreshTrees();
  } else if (tool.kind === 'clear') { editor.removeTrees({x: p.x, z: p.z, radius}); view.refreshTrees(); }
  else if (tool.kind === 'house' && first) { if (editor.addHome({x: p.x, z: p.z})) view.refreshHomes(); else status.textContent = 'A house needs open ground all round it -- not turf, sand, water or a path.'; }
  else if (tool.kind === 'select') carryTo(p);
  else if (tool.kind === 'cover') {
   if (!first && Math.hypot(p.x - down.last.x, p.z - down.last.z) < Math.max(1.5, radius * .5)) return;
   const c = coverOptions(BIOMES[s.landscape]).find(o => o.key === tool.cover), {min, max} = coverSizes[tool.cover];
   if (editor.paintCover({cover: c, x: p.x, z: p.z, radius, min, max, density: strength, group: down.group})) { view.refreshTrees(); view.refreshRocks(); }
   down.last = p;
  } else if (tool.kind === 'clearCover') { if (editor.clearCover({x: p.x, z: p.z, radius, group: down.group})) { view.refreshTrees(); view.refreshRocks(); } }
  else if (tool.kind === 'clearHomes') { if (editor.removeHomes({x: p.x, z: p.z, radius})) view.refreshHomes(); }
 };
 canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || tool.kind === 'navigate') return;
  const p = view.pick(e); if (!p) return;
  canvas.setPointerCapture(e.pointerId);
  if (tool.kind === 'outline' || tool.kind === 'pond') { draft.push([p.x, p.z]); view.draft([...draft, draft[0]]); return; }
  if (tool.kind === 'creek') { draft.push([p.x, p.z]); view.draft(draft); return; }
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
  down = {group: {}, last: p}; apply(p, true);
 });
 let pending = null;
 canvas.addEventListener('pointermove', e => {
  const p = view.pick(e);
  if (p) {
   if (tool.kind === 'sizeTree') showPicked();
   else view.cursor(['shape', 'paint', 'erase', 'clear', 'plant', 'clearHomes', 'cover', 'clearCover'].includes(tool.kind) ? p.x : null, p.z, radius);
   status.textContent = `${editor.surfaceAt(p.x, p.z)} · ${p.y.toFixed(1)} m · ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`;
  }
  if (tool.kind === 'select' && !down) canvas.style.cursor = !chosen ? '' : view.anchorAt(e) >= 0 ? 'grab' : p && editor.onPick(chosen, p.x, p.z) ? 'move' : '';
  if (down && p && !pending) { pending = p; requestAnimationFrame(() => { if (down && pending) apply(pending, false); pending = null; }); }
 });
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
 canvas.addEventListener('pointerup', () => { if (down?.carry) {
   const {hold, dx, dz, angle, pick} = down; down = null;
   if (!hold) return;
   const got = hold.drop(dx, dz, angle);
   view.ghost(null); view.carry(0, 0, 0);
   if (got.water) { view.refreshLand(got.box); view.refreshWater(); }
   if (got.box) { view.refreshSurface(got.box); refreshLayers(); }
   else if (pick.type === 'tree') view.refreshTrees(); else if (pick.type === 'rock') view.refreshRocks(); else if (pick.type === 'home') view.refreshHomes();
   choose(got.pick); refreshSave(); return;
  } if (down) { down = null; if (tool.kind === 'shape') { view.refreshHoles(selected); view.refreshTrees(); } if (tool.kind === 'paint' || tool.kind === 'erase') refreshLayers(); } });
 const finishOutline = () => {
  if (draft.length < (tool.kind === 'creek' ? 2 : 3)) return;
  if (tool.kind === 'creek') { if (draft.length < 2) return; const b = editor.addCreek({points: draft, width: Math.max(1.5, Math.min(12, radius / 2))}); view.refreshLand(b); view.refreshWater(); draft = []; view.draft([]); return; }
  if (tool.kind === 'pond') { editor.addPond({ring: draft}); view.refreshLand(s.undo.at(-1).box); view.refreshWater(); }
  else editor.fillOutline({kind: tool.surface, ring: draft});
  const xs = draft.map(q => q[0]), zs = draft.map(q => q[1]);
  view.refreshSurface([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  draft = []; view.draft([]); refreshLayers();
 };
 canvas.addEventListener('dblclick', () => { if (tool.kind === 'outline' || tool.kind === 'pond' || tool.kind === 'creek') { draft.pop(); finishOutline(); } });
 const onKey = e => {
  if (!current || current.editor !== editor || e.target.tagName === 'INPUT') return;
  if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleGame(); return; }
  if (game?.showing) { if (e.key === 'Escape') toggleGame(); return; }
  if (e.key === 'Enter') finishOutline();
  else if (e.key === 'Escape') { if (chosen) { choose(null); return; } draft = []; view.draft([]); setTool({kind: 'navigate'}); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
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

 // Save (the top bar's, and Ctrl+S): the course as a .fairway file; once
 // saved, again to the same file until it is renamed (saving.js).
 setSaver({
  key: `editor-${++opened}`, name: () => s.name, file: () => fileName(s.name),
  async bytes() {
   await new Promise(r => setTimeout(r, 30));
   return writeBuiltFile(validateDoc(editor.toDoc({onStep: what => setBusy(`Saving the course… ${what}`)})), BUILT_VERSION);
  },
  said(r, bytes) {
   if (r.how === 'failed') { status.textContent = 'Could not save: ' + r.error.message; return; }
   s.changed = false;
   status.textContent = `${r.how === 'overwrite' ? 'Saved again to' : 'Saved'} ${r.file} (${(bytes.length / 1e6).toFixed(1)} MB). Open it in Fairway: Saved courses, Import courses from a file.`;
  },
 });
 setTool({kind: 'navigate'});
 status.textContent = from === 'generated' ? 'Taken over: everything here is yours to change. Save keeps it as a .fairway file Fairway plays.' : HINT.navigate();
 return current;
}
