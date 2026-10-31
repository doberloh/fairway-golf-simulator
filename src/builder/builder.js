// FAIRWAY COURSE BUILDER: the program's front (docs/COURSE_BUILDER.md).
//
// Three ways in (*Two front doors*): generate a course and take it over,
// build one from real land (LIDAR and a picture), or open a course file. Each
// ends in the editor. This file is the shell -- screens and their order; the
// work is in the modules beside it, each pure where it can be.
import './builder.css';
import {BIOMES} from '../biomes.js';
import {BIOME_KEYS} from '../settings-schema.js';
import {readBuiltFile, isBuiltFile, textOf} from '../course-doc.js';
import {readCourseFile} from '../course-file.js';

const root = document.getElementById('builder');
const el = (tag, attrs = {}, ...kids) => {
 const n = document.createElement(tag);
 for (const [k, v] of Object.entries(attrs)) {
  if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
 }
 for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
 return n;
};
export const ui = {el, root};

const top = el('header', {class: 'cb-top'}, el('span', {class: 'cb-brand'}, 'Fairway ', el('b', {}, 'Course Builder')), el('span', {class: 'cb-title', id: 'cbTitle'}), el('span', {class: 'cb-spacer'}), el('span', {id: 'cbTopTools'}));
const main = el('main', {class: 'cb-main', id: 'cbMain'});
const busy = el('div', {class: 'cb-busy', hidden: true, role: 'status'});
root.append(top, main, busy);

export function setTitle(t) { document.getElementById('cbTitle').textContent = t || ''; }
export function setBusy(text) { busy.textContent = text || ''; busy.hidden = !text; }
export function topTools(...nodes) { const t = document.getElementById('cbTopTools'); t.replaceChildren(...nodes); }
export function show(node) { main.replaceChildren(node); }

// Opens a file the player picks: a built course (a ZIP) or a seeded one
// (JSON text), told apart by their first bytes.
export function pickFile(accept, multiple = false) {
 return new Promise(resolve => {
  const input = el('input', {type: 'file', accept, multiple});
  input.addEventListener('change', () => resolve([...input.files]));
  input.click();
 });
}
export async function readCourseAny(file) {
 const bytes = new Uint8Array(await file.arrayBuffer());
 if (isBuiltFile(bytes)) return {kind: 'built', doc: await readBuiltFile(bytes)};
 return {kind: 'seeded', course: readCourseFile(textOf(bytes))};
}

const doors = [
 {key: 'generate', title: 'Generate and modify a course', text: 'Pick a landscape, a designer and every studio setting; grow it, then take it over and reshape anything.', go: () => import('./door-generate.js').then(m => m.open())},
 {key: 'real', title: 'Generate a real life course', text: 'Bring LIDAR of a real place and an aerial picture; mark the tees and greens, let the auto trace start the rest.', go: () => import('./door-real.js').then(m => m.open())},
 {key: 'open', title: 'Open a course file', text: 'Carry on with a course you saved, or open a .fairway file somebody gave you.', go: openFile},
];

export function home() {
 setTitle(''); topTools();
 const msg = el('p', {class: 'cb-note', id: 'cbHomeMsg'});
 show(el('section', {class: 'cb-doors'},
  el('h1', {}, 'Build a ', el('b', {}, 'course')),
  el('p', {}, 'Every course you build here is a .fairway file that Fairway plays, and that you can give to anybody else who has Fairway.'),
  el('div', {class: 'cb-door-row'}, doors.map(d => el('button', {class: 'cb-door', type: 'button', onclick: () => d.go().catch(e => { msg.textContent = e.message; msg.classList.add('cb-err'); })},
   el('strong', {}, d.title), el('span', {}, d.text), el('em', {}, 'Start')))),
  msg,
  el('p', {class: 'cb-note'}, `Offline: the builder reads only the files you give it. Landscapes: ${BIOME_KEYS.map(k => BIOMES[k].name).join(', ')}.`)));
}

async function openFile() {
 const [file] = await pickFile('.fairway,application/zip,application/json');
 if (!file) return;
 setBusy('Opening ' + file.name);
 try {
  const got = await readCourseAny(file);
  if (got.kind === 'built') (await import('./editor.js')).openEditor(got.doc);
  else (await import('./door-generate.js')).open(got.course);
 } finally { setBusy(''); }
}

// The test harness (tools/smoke.mjs) and the console reach the builder here.
window.fairwayBuilder = {home, readCourseAny};
home();
