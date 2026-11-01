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

const {el} = ui;
export let current = null;   // {editor, view} while the editor is open (tests and the console)
let opened = 0;               // each course opened is its own piece of work for Save

// The tools: what a click or a drag on the ground does.
const SHAPES = [['raise', 'Raise'], ['lower', 'Lower'], ['smooth', 'Smooth'], ['flatten', 'Flatten'], ['ramp', 'Ramp'], ['roughen', 'Roughen'], ['restore', 'Restore']];
const label = k => GROUNDS[k]?.label ?? (k[0].toUpperCase() + k.slice(1));

export function openEditor(doc, {from = 'file'} = {}) {
 current?.view.dispose();
 const editor = createEditor(doc), s = editor.state;
 setTitle(s.name);
 const wrap = el('div', {class: 'cb-view'}), status = el('div', {class: 'cb-status'}, 'Right-drag to turn, wheel to zoom, left-drag to move. Pick a tool on the left.');
 const tools = el('div', {class: 'cb-tools'}), side = el('div', {class: 'cb-side'});
 show(el('div', {style: 'position:absolute;inset:0'}, wrap, tools, side, status));
 const view = createView(wrap, editor);
 current = {editor, view};
 // The smoke journeys look (never drive) through this, as the game's do through lab.
 window.fairwayBuilder.editor = current;

 let tool = {kind: 'navigate'}, radius = 8, strength = .5, selected = 0, draft = [], down = null, rampA = null;
 const setTool = t => {
  tool = t; draft = []; rampA = null; view.draft([]); view.setToolActive(t.kind !== 'navigate');
  for (const b of tools.querySelectorAll('[data-tool]')) b.classList.toggle('cb-on', b.dataset.tool === toolKey(t));
  status.textContent = HINT[t.kind]?.(t) ?? '';
 };
 const toolKey = t => [t.kind, t.op || t.surface || t.set || ''].join(':');
 const HINT = {
  navigate: () => 'Left-drag moves, right-drag turns, the wheel zooms.',
  shape: t => t.op === 'ramp' ? 'Click the low end, then the high end: the ground between is graded.' : `${t.op[0].toUpperCase() + t.op.slice(1)}: drag over the ground. Size and strength on the left.`,
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
  moveShape: () => 'Drag a green, bunker, fairway, pond, tree or house to move it whole; Undo puts it back.',
  turnShape: () => 'Press on a green, bunker, pond or house and drag round its middle to turn it; Undo puts it back.',
 };
 // Each tool's tooltip is its hint (HINT), as the status line gives it.
 const button = (text, t, extra = {}) => el('button', {class: 'cb-btn', type: 'button', 'data-tool': toolKey(t), title: HINT[t.kind]?.(t) ?? text, onclick: () => setTool(t), ...extra}, text);
 const range = (labelText, min, max, step, value, onInput) => el('label', {}, labelText, el('input', {type: 'range', min, max, step, value, oninput: e => onInput(+e.target.value)}));
 const landscapeKinds = () => PAINT.filter(k => k !== 'water');
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
 tools.replaceChildren(
  el('div', {class: 'cb-group'}, el('b', {}, 'View'), el('div', {class: 'cb-btns'},
   button('Move', {kind: 'navigate'}),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => view.planView()}, 'From above'),
   el('button', {class: 'cb-btn', type: 'button', onclick: () => view.frameHole(selected)}, 'This hole'),
   el('button', {class: 'cb-btn', type: 'button', onclick: undo}, 'Undo'),
   el('button', {class: 'cb-btn', type: 'button', onclick: redo}, 'Redo'))),
  el('div', {class: 'cb-group'}, el('b', {}, 'Brush'),
   range('Size', 1, 60, 1, radius, v => { radius = v; }), range('Strength', .05, 1, .05, strength, v => { strength = v; })),
  el('div', {class: 'cb-group'}, el('b', {}, 'Shape the ground'), el('div', {class: 'cb-btns'}, SHAPES.map(([op, t]) => button(t, {kind: 'shape', op})))),
  el('div', {class: 'cb-group'}, el('b', {}, 'Paint'), paintButtons('paint')),
  el('div', {class: 'cb-group'}, el('b', {}, 'Outline'), paintButtons('outline')),
  el('div', {class: 'cb-group cb-layers'}, el('b', {}, 'Layers'), el('small', {}, 'Top first. Show or hide one; Erase takes it off under the brush.'), layerList),
  el('div', {class: 'cb-group'}, el('b', {}, 'Water and trees'), el('div', {class: 'cb-btns'},
   button('Draw a pond', {kind: 'pond'}), button('Draw a creek', {kind: 'creek'}), button('Dig a bunker', {kind: 'bunker'}),
   button('Plant trees', {kind: 'plant'}), button('Clear trees', {kind: 'clear'}), button('House', {kind: 'house'}), button('Clear houses', {kind: 'clearHomes'}), button('Move shape', {kind: 'moveShape'}), button('Turn shape', {kind: 'turnShape'}))),
 );

 // ---- the right: the course, its holes, the checks, Save.
 const nameInput = el('input', {value: s.name, maxlength: 60, oninput: e => { s.name = e.target.value.trim() || s.name; setTitle(s.name); refreshSave(); }});
 const landscape = el('select', {onchange: e => { editor.setLandscape(e.target.value); view.refreshAll(); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === s.landscape}, BIOMES[k].name)));
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
 const holeTools = el('div', {class: 'cb-btns'},
  button('Back tee', {kind: 'tee', set: 'back'}), button('Middle tee', {kind: 'tee', set: 'middle'}), button('Front tee', {kind: 'tee', set: 'front'}),
  button('Green', {kind: 'green'}), button('Add a bend', {kind: 'bend'}),
  el('button', {class: 'cb-btn', type: 'button', onclick: () => { editor.setPar(selected, s.holes[selected].par >= 6 ? 3 : s.holes[selected].par + 1); refreshHoles(); }}, 'Par +'));
 function refreshHoles() {
  holeList.replaceChildren(...s.holes.map((h, i) => {
   const len = h.line.reduce((d, p, k) => k ? d + Math.hypot(p[0] - h.line[k - 1][0], p[1] - h.line[k - 1][1]) : 0, 0);
   return el('li', {style: i === selected ? 'color:var(--hot)' : '', onclick: () => { selected = i; refreshHoles(); view.frameHole(i); }}, `Hole ${h.number} · par ${h.par} · ${Math.round(len / .9144)} yd`);
  }));
  view.refreshHoles(selected);
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
 topTools(
  el('button', {class: 'cb-btn', type: 'button', onclick: () => { if (!s.changed || confirm('Leave this course? Anything not saved is lost.')) { current?.view.dispose(); current = null; home(); } }}, 'Close'));

 // ---- the mouse on the ground.
 const canvas = view.canvas;
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
  else if (tool.kind === 'moveShape' || tool.kind === 'turnShape') down.last = p;
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
  if (tool.kind === 'turnShape') {
   const pick = editor.pickAt({x: p.x, z: p.z}); if (!pick || pick.type === 'tree') { status.textContent = pick ? 'A tree is round: nothing to turn.' : 'Nothing to turn there: only rough.'; return; }
   const r = editor.state.raster; let mid = pick.type === 'home' ? editor.state.homes[pick.index] : null;
   if (!mid) { let sx = 0, sz = 0; for (const k of pick.cells) { sx += r.x0 + (k % r.nx + .5) * r.cell; sz += r.z0 + (Math.floor(k / r.nx) + .5) * r.cell; } mid = {x: sx / pick.cells.length, z: sz / pick.cells.length}; }
   down = {pick, turn: true, mid: {x: mid.x, z: mid.z}, start: p, last: p}; return;
  }
  if (tool.kind === 'moveShape') { const pick = editor.pickAt({x: p.x, z: p.z}); if (!pick) { status.textContent = 'Nothing to move there: only rough.'; return; } down = {pick, start: p, last: p}; status.textContent = `Moving the ${pick.type === 'shape' ? pick.kind : pick.type === 'home' ? 'house' : 'tree'}: let go where it belongs.`; return; }
  down = {group: {}, last: p}; apply(p, true);
 });
 let pending = null;
 canvas.addEventListener('pointermove', e => {
  const p = view.pick(e);
  if (p) {
   view.cursor(['shape', 'paint', 'erase', 'clear', 'plant', 'clearHomes'].includes(tool.kind) ? p.x : null, p.z, radius);
   status.textContent = `${editor.surfaceAt(p.x, p.z)} · ${p.y.toFixed(1)} m · ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`;
  }
  if (down && p && !pending) { pending = p; requestAnimationFrame(() => { if (down && pending) apply(pending, false); pending = null; }); }
 });
 canvas.addEventListener('pointerup', () => { if (down?.pick) { const {pick, start, last, turn, mid} = down; down = null; const box = turn ? editor.turnShape(pick, Math.atan2(start.x - mid.x, start.z - mid.z) - Math.atan2(last.x - mid.x, last.z - mid.z)) : editor.moveShape(pick, last.x - start.x, last.z - start.z); if (box) { view.refreshSurface(box); refreshLayers(); } else if (pick.type === 'tree') view.refreshTrees(); else if (pick.type === 'home') view.refreshHomes(); status.textContent = turn ? HINT.turnShape() : HINT.moveShape(); return; } if (down) { down = null; if (tool.kind === 'shape') { view.refreshHoles(selected); view.refreshTrees(); } if (tool.kind === 'paint' || tool.kind === 'erase') refreshLayers(); } });
 const finishOutline = () => {
  if (draft.length < (tool.kind === 'creek' ? 2 : 3)) return;
  if (tool.kind === 'creek') { if (draft.length < 2) return; const b = editor.addCreek({points: draft, width: Math.max(1.5, Math.min(12, radius / 2))}); view.refreshLand(b); view.refreshWater(); draft = []; view.draft([]); return; }
  if (tool.kind === 'pond') { editor.addPond({ring: draft}); view.refreshWater(); }
  else editor.fillOutline({kind: tool.surface, ring: draft});
  const xs = draft.map(q => q[0]), zs = draft.map(q => q[1]);
  view.refreshSurface([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  draft = []; view.draft([]); refreshLayers();
 };
 canvas.addEventListener('dblclick', () => { if (tool.kind === 'outline' || tool.kind === 'pond' || tool.kind === 'creek') { draft.pop(); finishOutline(); } });
 const onKey = e => {
  if (!current || current.editor !== editor || e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter') finishOutline();
  else if (e.key === 'Escape') { draft = []; view.draft([]); setTool({kind: 'navigate'}); }
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
 function undo() { after(editor.undo()); }
 function redo() { after(editor.redo()); }

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
