// THE EDITOR both doors end in (the course builder, stages 3-5;
// docs/COURSE_BUILDER.md, *The editor*): the view (view.js), the tools down
// the left, the holes and the course on the right, undo, and Save. Every
// change goes through the editing model (editing.js), which is tested in
// Node; this file only turns the mouse and keys into its calls and tells the
// view what to redraw.
import {show, setTitle, setBusy, topTools, home, ui} from './builder.js';
import {createEditor, PAINT} from './editing.js';
import {createView} from './view.js';
import {writeBuiltFile, validateDoc} from '../course-doc.js';
import {BUILT_VERSION, BIOME_KEYS} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {fileName} from '../course-file.js';
import {GROUNDS} from '../grounds.js';
import {checkCourse} from './checks.js';

const {el} = ui;
export let current = null;   // {editor, view} while the editor is open (tests and the console)

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
  paint: t => `Paint ${label(t.surface)}: drag over the ground.`,
  outline: t => `Outline ${label(t.surface)}: click its corners, double-click or press Enter to fill it.`,
  pond: () => 'Draw a pond: click its edge, double-click or press Enter. Its level is set just under its lowest bank.',
  tee: t => `Click where hole ${selected + 1}'s ${t.set} tee goes.`,
  green: () => `Click where hole ${selected + 1}'s green goes.`,
  bend: () => `Click to add a bend to hole ${selected + 1}'s line.`,
  plant: () => 'Click to plant a tree. Drag to plant a wood.',
  clear: () => 'Drag to take trees out.',
 };
 const button = (text, t, extra = {}) => el('button', {class: 'cb-btn', type: 'button', 'data-tool': toolKey(t), onclick: () => setTool(t), ...extra}, text);
 const range = (labelText, min, max, step, value, onInput) => el('label', {}, labelText, el('input', {type: 'range', min, max, step, value, oninput: e => onInput(+e.target.value)}));
 const landscapeKinds = () => PAINT.filter(k => k !== 'water');
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
  el('div', {class: 'cb-group'}, el('b', {}, 'Water and trees'), el('div', {class: 'cb-btns'},
   button('Draw a pond', {kind: 'pond'}), button('Plant trees', {kind: 'plant'}), button('Clear trees', {kind: 'clear'}))),
 );

 // ---- the right: the course, its holes, the checks, Save.
 const nameInput = el('input', {value: s.name, maxlength: 60, oninput: e => { s.name = e.target.value.trim() || s.name; setTitle(s.name); }});
 const landscape = el('select', {onchange: e => { editor.setLandscape(e.target.value); view.refreshAll(); }}, BIOME_KEYS.map(k => el('option', {value: k, selected: k === s.landscape}, BIOMES[k].name)));
 const holeList = el('ul');
 const checkList = el('ul');
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
  el('h4', {style: 'margin-top:10px'}, 'Checks'), el('button', {class: 'cb-btn', type: 'button', onclick: runChecks}, 'Check the course'), checkList);
 refreshHoles();
 topTools(
  el('button', {class: 'cb-btn', type: 'button', onclick: () => { if (!s.changed || confirm('Leave this course? Anything not saved is lost.')) { current?.view.dispose(); current = null; home(); } }}, 'Close'),
  el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: save}, 'Save as a .fairway file'));

 // ---- the mouse on the ground.
 const canvas = view.canvas;
 const apply = (p, first) => {
  if (tool.kind === 'shape' && tool.op !== 'ramp') {
   if (first) down.level = editor.height(p.x, p.z);
   view.refreshLand(editor.shape({op: tool.op, x: p.x, z: p.z, radius, strength, level: down.level, group: down.group}));
  } else if (tool.kind === 'paint') view.refreshSurface(editor.paint({kind: tool.surface, x: p.x, z: p.z, radius, group: down.group}));
  else if (tool.kind === 'plant') {
   if (!first && Math.hypot(p.x - down.last.x, p.z - down.last.z) < Math.max(4, radius * .6)) return;
   const h = 10 + strength * 20;
   editor.addTree([p.x, p.z, h, h * .3, Math.min(.8, h * .027), 2, -1]); down.last = p; view.refreshTrees();
  } else if (tool.kind === 'clear') { editor.removeTrees({x: p.x, z: p.z, radius}); view.refreshTrees(); }
 };
 canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || tool.kind === 'navigate') return;
  const p = view.pick(e); if (!p) return;
  canvas.setPointerCapture(e.pointerId);
  if (tool.kind === 'outline' || tool.kind === 'pond') { draft.push([p.x, p.z]); view.draft([...draft, draft[0]]); return; }
  if (tool.kind === 'tee') { editor.setTee(selected, tool.set, p.x, p.z); refreshHoles(); return; }
  if (tool.kind === 'green') { editor.setGreen(selected, p.x, p.z); refreshHoles(); return; }
  if (tool.kind === 'bend') { editor.addBend(selected, p.x, p.z); refreshHoles(); return; }
  if (tool.kind === 'shape' && tool.op === 'ramp') {
   if (!rampA) { rampA = p; status.textContent = 'Now click the high end.'; return; }
   view.refreshLand(editor.shape({op: 'ramp', a: rampA, b: p, radius, strength})); rampA = null; status.textContent = HINT.shape(tool); return;
  }
  down = {group: {}, last: p}; apply(p, true);
 });
 let pending = null;
 canvas.addEventListener('pointermove', e => {
  const p = view.pick(e);
  if (p) {
   view.cursor(['shape', 'paint', 'clear', 'plant'].includes(tool.kind) ? p.x : null, p.z, radius);
   status.textContent = `${editor.surfaceAt(p.x, p.z)} · ${p.y.toFixed(1)} m · ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`;
  }
  if (down && p && !pending) { pending = p; requestAnimationFrame(() => { if (down && pending) apply(pending, false); pending = null; }); }
 });
 canvas.addEventListener('pointerup', () => { if (down) { down = null; if (tool.kind === 'shape') { view.refreshHoles(selected); view.refreshTrees(); } } });
 const finishOutline = () => {
  if (draft.length < 3) return;
  if (tool.kind === 'pond') { editor.addPond({ring: draft}); view.refreshWater(); }
  else editor.fillOutline({kind: tool.surface, ring: draft});
  const xs = draft.map(q => q[0]), zs = draft.map(q => q[1]);
  view.refreshSurface([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  draft = []; view.draft([]);
 };
 canvas.addEventListener('dblclick', () => { if (tool.kind === 'outline' || tool.kind === 'pond') { draft.pop(); finishOutline(); } });
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
  if (step.cells) view.refreshSurface(step.box);
  if (step.snapshot) { landscape.value = s.landscape; view.refreshAll(); refreshHoles(); }
  else if (step.parts) { view.refreshHoles(selected); view.refreshTrees(); }
 }
 function undo() { after(editor.undo()); }
 function redo() { after(editor.redo()); }

 async function save() {
  setBusy('Saving the course…');
  try {
   await new Promise(r => setTimeout(r, 30));
   const out = validateDoc(editor.toDoc({onStep: what => setBusy(`Saving the course… ${what}`)}));
   const bytes = await writeBuiltFile(out, BUILT_VERSION);
   const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'})), a = el('a', {href: url, download: fileName(out.name)});
   document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
   s.changed = false;
   status.textContent = `Saved ${fileName(out.name)} (${(bytes.length / 1e6).toFixed(1)} MB). Open it in Fairway: Saved courses, Import courses from a file.`;
   window.fairwayBuilder.lastSaved = bytes;
  } catch (e) { status.textContent = 'Could not save: ' + e.message; }
  finally { setBusy(''); }
 }
 setTool({kind: 'navigate'});
 status.textContent = from === 'generated' ? 'Taken over: everything here is yours to change. Save keeps it as a .fairway file Fairway plays.' : HINT.navigate();
 return current;
}
