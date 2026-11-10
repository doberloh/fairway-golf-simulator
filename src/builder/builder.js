// FAIRWAY COURSE BUILDER: the program's front (docs/COURSE_BUILDER.md).
//
// Three ways in (*Two front doors*): generate a course and take it over,
// build one from real land (LIDAR and a picture), or open a course file. Each
// ends in the editor. This file is the shell -- screens and their order; the
// work is in the modules beside it, each pure where it can be.
import './builder.css';
import {BIOMES} from '../biomes.js';
import {BIOME_KEYS} from '../settings-schema.js';
import {readBuiltFile, isBuiltFile, builderPart, textOf} from '../course-doc.js';
import {readCourseFile} from '../course-file.js';
import {saveBytes, saveHow, lastSave} from './saving.js';
import {isDraft, readDraft, DRAFT_EXT} from './draft.js';
import {tipFor} from './tips.js';
import {menuBarEl, keySheetEl, setMenus, showKeys} from './menu.js';

const root = document.getElementById('builder');
const el = (tag, attrs = {}, ...kids) => {
 const n = document.createElement(tag);
 // A button made without a tooltip takes its own from tips.js.
 if (tag === 'button' && attrs.title == null) { const t = tipFor(attrs, kids); if (t) n.title = t; }
 for (const [k, v] of Object.entries(attrs)) {
  if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
 }
 for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
 return n;
};
// WHEN THE WINDOW CHANGES (the owner, 1 November 2026: "window needs to
// properly resize when its moved or changed"): `f` called when the window is
// resized and when it moves to a screen of another pixel density (a laptop's
// screen and a monitor beside it) -- which changes no element's size, so a
// ResizeObserver alone never hears of it. Returns a function that stops it.
export function onWindowChange(f) {
 let mq = null, stopped = false;
 const watch = () => { mq?.removeEventListener('change', fire); if (stopped) return; mq = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`); mq.addEventListener('change', fire); };
 function fire() { if (stopped) return; watch(); f(); }
 addEventListener('resize', f); watch();
 return () => { stopped = true; removeEventListener('resize', f); mq?.removeEventListener('change', fire); };
}
export const ui = {el, root, onWindowChange};

const top = el('header', {class: 'cb-top'}, el('span', {class: 'cb-brand'}, 'Fairway ', el('b', {}, 'Course Builder')), menuBarEl, el('span', {class: 'cb-title', id: 'cbTitle'}), el('span', {class: 'cb-spacer'}), el('span', {class: 'cb-savenote', id: 'cbSaveNote'}), el('button', {class: 'cb-btn cb-hot', type: 'button', id: 'cbSave', hidden: true, title: 'Ctrl+S', onclick: () => saveNow()}, 'Save'), el('span', {id: 'cbTopTools'}));
const main = el('main', {class: 'cb-main', id: 'cbMain'});
// THE WAIT, for everything that takes a moment (the owner, 5 November 2026: "we
// need to indicate processing or progress of some sort"). A spinner the browser
// turns by itself, so it keeps moving while the page is working; the words; and,
// when the job can say how far along it is or be stopped, a bar and a Cancel.
const busyWords = el('span', {class: 'cb-busywords'}), busyFill = el('i', {}), busyBar = el('div', {class: 'cb-busybar', hidden: true}, busyFill);
const busyStop = el('button', {class: 'cb-btn', type: 'button', hidden: true}, 'Cancel');
const busy = el('div', {class: 'cb-busy', hidden: true, role: 'status'}, el('span', {class: 'cb-spinner', 'aria-hidden': 'true'}), busyWords, busyBar, busyStop);
root.append(top, main, busy, keySheetEl);

export function setTitle(t) { document.getElementById('cbTitle').textContent = t || ''; }
// `share`: 0 to 1, how far along. `cancel`: what the Cancel button does.
export function setBusy(text, {share = null, cancel = null} = {}) {
 busyWords.textContent = text || ''; busy.hidden = !text;
 busyBar.hidden = share == null; if (share != null) busyFill.style.width = `${Math.round(share * 100)}%`;
 busyStop.hidden = !cancel; busyStop.onclick = cancel;
}
export function topTools(...nodes) { const t = document.getElementById('cbTopTools'); t.replaceChildren(...nodes.filter(n => n != null)); }   // a tool left out (null) is no tool, not the word
export function show(node) { main.replaceChildren(node); }

// SAVE, ON EVERY SCREEN (saving.js): the screen says what it would save --
// {key, name(), file(), bytes(), said?(result)} -- or null where there is
// nothing yet. The button says "Save again" when one click goes to the same
// file; Ctrl+S does the same.
let saver = null;
export function setSaver(s) { saver = s; refreshSave(); }
export function refreshSave() {
 const b = document.getElementById('cbSave'), note = document.getElementById('cbSaveNote'), last = lastSave();
 b.hidden = !saver;
 if (!saver) { note.textContent = ''; return; }
 const again = saveHow(last, {key: saver.key, name: saver.name()}, {canPick: typeof window.showSaveFilePicker === 'function'}) === 'overwrite';
 b.textContent = again ? 'Save again' : 'Save';
 note.textContent = last?.key === saver.key ? `Saved as ${last.file}${last.name !== saver.name() ? ' -- renamed, Save makes a new file' : ''}` : '';
}
export async function saveNow() {
 if (!saver) return;
 setBusy('Saving…');
 try {
  const bytes = await saver.bytes(), r = await saveBytes(bytes, {key: saver.key, name: saver.name(), file: saver.file()});
  if (r.how !== 'cancelled') { window.fairwayBuilder.lastSaved = bytes; saver.said?.(r, bytes); }
 } catch (e) { saver.said?.({how: 'failed', error: e}); document.getElementById('cbSaveNote').textContent = 'Could not save: ' + e.message; return; }
 finally { setBusy(''); }
 refreshSave();
}
// THE MENUS EVERY SCREEN SHARES (menu.js; the builder-ux goal): File starts
// with Save and Save as, Help ends the bar. A screen adds its own: `file`
// items after Save, then Edit, View and Tools as it has them. `keys`: lines
// for the shortcuts sheet that are not commands (the view's mouse and keys).
export function useMenus({file = [], edit = null, view = null, tools = null, help = [], keys = []} = {}) {
 const canSave = () => !!saver;
 setMenus([
  {name: 'File', items: [
   {label: () => document.getElementById('cbSave')?.textContent === 'Save again' ? 'Save again' : 'Save', key: 'Ctrl+S', enabled: canSave, run: () => saveNow()},
   ...file,
   {sep: true}, {label: 'Open a course file…', key: 'Ctrl+O', run: () => openFile()},
   {label: 'The builder\'s start', run: () => (window.fairwayBuilder.leave ?? home)()}]},
  ...(edit ? [{name: 'Edit', items: edit}] : []), ...(view ? [{name: 'View', items: view}] : []), ...(tools ? [{name: 'Tools', items: tools}] : []),
  {name: 'Help', items: [{label: 'Keyboard shortcuts', key: '?', run: showKeys}, ...help, {label: 'The builder guide', title: 'Fairway Builder Guide.html, beside the builder in the download', run: () => { const m = document.getElementById('cbSaveNote'); if (m) m.textContent = 'The guide is Fairway Builder Guide.html, beside the builder in your download: open it in your browser.'; }}]},
 ], keys);
}

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
 if (isBuiltFile(bytes)) return {kind: 'built', doc: await readBuiltFile(bytes), builder: await builderPart(bytes)};
 return {kind: 'seeded', course: readCourseFile(textOf(bytes))};
}

const doors = [
 // PLAIN WORDS, AND WHICH DOOR FOR WHAT (the builder-ux goal, items 13 and 14):
 // each door says what it is for in a player's words; door 1 is where a
 // first visit tries every tool, with nothing to download (PLACED: it is the
 // sample course -- a grown course needs no file and no connection).
 {key: 'generate', title: 'Generate and modify a course', text: 'A made-up course in a minute: pick a landscape, grow it, take it over and change anything. New here? Start with this one -- nothing to download.', go: () => import('./door-generate.js').then(m => m.open())},
 {key: 'real', title: 'Generate a real life course', text: 'A real course from its laser survey (LIDAR), aerial photo and map. Type its name and Build it for me does the steps -- or do each step yourself.', go: () => import('./door-real.js').then(m => m.open())},
 {key: 'open', title: 'Open a course file', text: 'Carry on with a course or a draft you saved, or open a .fairway file somebody gave you.', go: openFile},
];

export function home() {
 setTitle(''); topTools(); setSaver(null); window.fairwayBuilder.leave = null; useMenus();
 const msg = el('p', {class: 'cb-note', id: 'cbHomeMsg'});
 show(el('section', {class: 'cb-doors'},
  el('h1', {}, 'Build a ', el('b', {}, 'course')),
  el('p', {}, 'Every course you build here is a .fairway file that Fairway plays, and that you can give to anybody else who has Fairway. Help > Keyboard shortcuts (or ?) lists every key.'),
  el('div', {class: 'cb-door-row'}, doors.map(d => el('button', {class: 'cb-door', type: 'button', onclick: () => d.go().catch(e => { msg.textContent = e.message; msg.classList.add('cb-err'); })},
   el('strong', {}, d.title), el('span', {}, d.text), el('em', {}, 'Start')))),
  msg,
  el('p', {class: 'cb-note'}, `Offline: the builder reads only the files you give it. Landscapes: ${BIOME_KEYS.map(k => BIOMES[k].name).join(', ')}.`)));
}

async function openFile() {
 const [file] = await pickFile('.fairway,' + DRAFT_EXT + ',application/zip,application/json');
 if (!file) return;
 setBusy('Opening ' + file.name);
 try {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (await isDraft(bytes)) { await (await import('./door-real.js')).openSaved(await readDraft(bytes)); return; }
  const got = await readCourseAny(file);
  // A course saved from the editor brings its builder's section (course-doc.js),
  // unpacked only when Back to 2D or Save wants it.
  let draft = null;
  if (got.kind === 'built') (await import('./editor.js')).openEditor(got.doc, {work: got.builder ? {draft: () => draft ??= readDraft(got.builder)} : null});
  else (await import('./door-generate.js')).open(got.course);
 } finally { setBusy(''); }
}

// The test harness (tools/smoke.mjs) and the console reach the builder here.
window.fairwayBuilder = {home, readCourseAny, saveNow};
home();
