// DOOR 1, "GENERATE AND MODIFY A COURSE" (the course builder, stage 3;
// docs/COURSE_BUILDER.md, *Two front doors*). Every studio setting, from the
// game's own schema (settings-schema.js), so a new generation setting reaches
// the builder with no second list; grow it as often as wanted and look at it
// from above; then *Take it over*: the world is frozen (freeze.js) and the
// editor opens on it. Nothing is edited until then, so nothing is lost by
// growing again.
import {show, setTitle, setBusy, topTools, home, ui, setSaver} from './builder.js';
import {courseFile, fileName} from '../course-file.js';
import {SETTINGS, CATEGORIES, DEFAULT_COURSE, validateSettings, bound} from '../settings-schema.js';
import {BIOMES} from '../biomes.js';
import {generateWorldSteps} from '../course.js';
import {freezeWorld} from '../freeze.js';
import {GROUNDS} from '../grounds.js';
import {openEditor} from './editor.js';

const {el} = ui;
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

// The world for `settings`, grown in slices so the page keeps painting.
export async function grow(settings, onStep = () => {}) {
 const it = generateWorldSteps(settings);
 let step = it.next(), mark = performance.now();
 while (!step.done) {
  if (performance.now() - mark > 40) { onStep(typeof step.value === 'number' ? step.value : null); await frame(); mark = performance.now(); }
  step = it.next();
 }
 return step.value;
}

// A picture of a world from above, in its own map colours, for the preview.
function picture(w, size = 900) {
 const c = el('canvas', {width: size, height: Math.round(size * w.halfZ / w.halfX)}), ctx = c.getContext('2d');
 const img = ctx.createImageData(c.width, c.height), bio = w.bio, mt = bio.mapTurf || {};
 const col = {green: mt.green ?? bio.green, fringe: mt.green ?? bio.fringe, fairway: mt.fairway ?? bio.fairway, tee: mt.fairway ?? bio.fairway, semi: mt.semi ?? bio.semi, rough: bio.rough, sand: bio.sand, water: bio.mapWater ?? '#70a6aa'};
 const rgb = {}; const toRgb = h => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
 for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
  const x = (i / c.width * 2 - 1) * w.halfX, z = (j / c.height * 2 - 1) * w.halfZ, s = w.surface(x, z);
  const hex = col[s] ?? GROUNDS[s]?.map ?? bio.rough, v = rgb[hex] ??= toRgb(hex), k = (j * c.width + i) * 4;
  img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = 255;
 }
 ctx.putImageData(img, 0, 0);
 ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui';
 for (const h of w.holes) { const g = h.worldGreen, x = (g.x / w.halfX + 1) / 2 * c.width, y = (g.z / w.halfZ + 1) / 2 * c.height; ctx.fillText(String(h.hole + 1), x + 4, y - 4); }
 c.style.maxWidth = '100%'; c.style.border = '1px solid var(--line)';
 return c;
}

function field(f, s, onChange) {
 const v = s[f.key], id = 'set-' + f.key;
 let input;
 if (f.kind === 'choice') input = el('select', {id, onchange: e => onChange(f.options.find(o => String(o) === e.target.value))}, f.options.map(o => el('option', {value: o, selected: o === v}, f.names?.[o] ?? (f.key === 'biome' ? BIOMES[o].name : o))));
 else if (f.kind === 'toggle') input = el('input', {id, type: 'checkbox', checked: !!v, onchange: e => onChange(e.target.checked)});
 else if (f.kind === 'text') input = el('input', {id, value: v, maxlength: f.max, onchange: e => onChange(e.target.value)});
 else {
  const min = typeof f.min === 'function' ? f.min(s) : f.min, max = typeof f.max === 'function' ? f.max(s) : f.max;
  const out = el('small', {}, `${v}${f.unit || ''}`);
  input = el('input', {id, type: 'range', min, max, step: f.step ?? 1, value: v, oninput: e => { out.textContent = `${e.target.value}${f.unit || ''}`; }, onchange: e => onChange(+e.target.value)});
  return el('div', {class: 'cb-field', title: f.tip || ''}, el('label', {for: id}, f.label), input, out);
 }
 return el('div', {class: 'cb-field', title: f.tip || ''}, el('label', {for: id}, f.label), input, f.tip ? el('small', {}, f.tip.length > 120 ? f.tip.slice(0, 117) + '…' : f.tip) : null);
}

export function open(start = null) {
 setTitle('Generate and modify');
 let s = validateSettings({...DEFAULT_COURSE, ...(start?.settings || {})});
 let world = null;
 const preview = el('div', {class: 'cb-row'}), facts = el('p', {class: 'cb-note', style: 'text-align:left'});
 const form = el('div');
 const take = el('button', {class: 'cb-btn cb-hot', type: 'button', disabled: true, onclick: takeOver}, 'Take it over');
 const growBtn = el('button', {class: 'cb-btn cb-hot', type: 'button', onclick: growNow}, 'Grow this course');
 const set = (k, v) => { try { s = validateSettings({...s, [k]: v}); } catch (e) { facts.textContent = e.message; } world = null; take.disabled = true; render(); };
 function render() {
  const groups = CATEGORIES.map(([cat, title, note]) => {
   const fs = SETTINGS.filter(f => f.category === cat);
   if (!fs.length) return null;
   return el('section', {}, el('h3', {}, title), note ? el('p', {class: 'cb-note', style: 'text-align:left'}, note) : null, el('div', {class: 'cb-grid'}, fs.map(f => field(f, s, v => set(f.key, v)))));
  });
  form.replaceChildren(...groups.filter(Boolean));
 }
 async function growNow() {
  setBusy('Growing the course…');
  try {
   await frame();
   world = await grow({...s}, f => f != null && setBusy(`Growing the course… ${Math.round(f * 100)}%`));
   preview.replaceChildren(picture(world));
   facts.textContent = `${BIOMES[s.biome].name} · ${world.holes.length} holes · par ${world.holes.reduce((a, h) => a + h.par, 0)} · ${Math.round(world.holes.reduce((a, h) => a + h.tees.blue.yards, 0))} yards from the back · seed ${s.seed}. Grow again with other settings, or take it over to change anything.`;
   take.disabled = false;
  } catch (e) { facts.textContent = 'Could not grow this course: ' + e.message; }
  finally { setBusy(''); }
 }
 async function takeOver() {
  if (!world) return;
  setBusy('Taking it over…');
  try {
   await frame();
   const name = courseName();
   const doc = freezeWorld(world, {name, onStep: what => setBusy(`Taking it over… ${what}`)});
   await frame();
   openEditor(doc, {from: 'generated'});
  } catch (e) { facts.textContent = 'Could not take this course over: ' + e.message; }
  finally { setBusy(''); }
 }
 // Save (the top bar's): the course as its settings, a seeded .fairway file
 // the game plays and Open a course file brings back here.
 const courseName = () => (start?.name || s.courseName || `${BIOMES[s.biome].name} ${s.seed}`).slice(0, 60);
 setSaver({key: `door1-${++opened}`, name: courseName, file: () => fileName(courseName()), bytes: async () => new TextEncoder().encode(courseFile({name: courseName(), settings: s})),
  said: r => { facts.textContent = r.how === 'failed' ? 'Could not save: ' + r.error.message : `${r.how === 'overwrite' ? 'Saved again to' : 'Saved as'} ${r.file}: the course as its settings, which Fairway grows the same every time. Take it over to change the ground itself.`; }});
 render();
 topTools(el('button', {class: 'cb-btn', type: 'button', onclick: home}, 'Back'), growBtn, take);
 show(el('section', {class: 'cb-sheet'},
  el('h2', {}, 'Generate and modify a course'),
  el('p', {class: 'cb-note', style: 'text-align:left;max-width:900px'}, 'Every setting the game\'s course studio has. Grow the course, look at it from above, grow it again until it is close; then take it over, and the ground, the surfaces, the holes, the water and the trees are yours to change. A course taken over keeps its land: a later Fairway never grows it differently.'),
  el('div', {class: 'cb-row'}, growBtn.cloneNode(true), take.cloneNode(true)), preview, facts, form));
 // The copies above the form act as the originals.
 const row = document.querySelector('.cb-sheet .cb-row');
 row.children[0].onclick = growNow; row.children[1].onclick = takeOver;
 const sync = () => { row.children[1].disabled = take.disabled; requestAnimationFrame(sync); };
 sync();
 void bound;
}

let opened = 0;   // each door 1 opened is its own piece of work for Save
