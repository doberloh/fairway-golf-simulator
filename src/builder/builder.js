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
import {saveBytes, saveHow, lastSave, coursesFolder, useFolder, setClashAsk, openedFrom, forgetOpened} from './saving.js';
import {recallCourses, pickCourses, listCourses} from './courses-folder.js';
import {allowed, canPick} from './lidar-folder.js';
import {isDraft, readDraft, draftVersion, DRAFT_EXT} from './draft.js';
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
 const again = saveHow(last, {key: saver.key, name: saver.name()}, {canPick: typeof window.showSaveFilePicker === 'function' || !!last?.folder}) === 'overwrite';
 b.textContent = again ? 'Save again' : 'Save';
 const mine = last && (last.key === saver.key || last.key == null);
 note.textContent = mine ? `${last.key == null ? 'Opened' : 'Saved as'} ${last.file}${last.folder && coursesFolder() ? ` in ${coursesFolder().name}` : ''}${last.name !== saver.name() ? ' -- renamed, Save makes a new file' : ''}` : '';
}
// THE COURSES FOLDER (courses-folder.js; the owner, 23 November 2026), made
// ready for a save or an open: the one remembered, with leave to use it --
// asked for (`ask`) only inside a press, as a browser allows. Null where the
// browser cannot pick a folder or none is chosen yet.
async function readyFolder(ask = false) {
 if (!canPick()) return null;
 const dir = coursesFolder() ?? await recallCourses();
 if (!dir) return null;
 try { if (await allowed(dir, ask)) { useFolder(dir); return dir; } } catch { /* asked outside a press */ }
 return null;
}
// Before any save: the courses folder ready, or the save box asking for one
// (and for the course's name, `needName`). False: the player cancelled.
export async function savePlace({needName = false, name = '', rename = null} = {}) {
 const dir = await readyFolder(true);
 if (!needName && (dir || !canPick())) return true;
 return saveBox({needName, name, rename, dir});
}
export async function saveNow() {
 if (!saver) return;
 if (!await savePlace({needName: !!saver.named && !saver.named(), name: saver.name(), rename: saver.rename})) return;
 setBusy('Saving…');
 try {
  const bytes = await saver.bytes(), r = await saveBytes(bytes, {key: saver.key, name: saver.name(), file: saver.file()});
  if (r.how !== 'cancelled') { window.fairwayBuilder.lastSaved = bytes; saver.said?.(r, bytes); }
 } catch (e) { saver.said?.({how: 'failed', error: e}); document.getElementById('cbSaveNote').textContent = 'Could not save: ' + e.message; return; }
 finally { setBusy(''); }
 refreshSave();
}
// A box over the builder (the shortcuts sheet's look): `build(close)` makes
// its inside; `close(v)` takes it down and answers the promise with v. Esc is
// Cancel (null).
function askBox(build) {
 return new Promise(done => {
  const sheet = el('div', {class: 'cb-keysheet cb-asksheet', role: 'dialog', 'aria-modal': 'true'});
  const close = v => { sheet.remove(); window.removeEventListener('keydown', esc, true); done(v); };
  const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
  sheet.append(el('div', {class: 'cb-keyinner cb-askbox'}, ...build(close)));
  window.addEventListener('keydown', esc, true);
  document.body.append(sheet);
  sheet.querySelector('input, button.cb-hot')?.focus();
 });
}
// THE SAVE BOX: the course's name when it has not been named yet (the owner:
// "We should also ask the user to name the course if they are saving from a
// step before they named it"), and the courses folder when none is chosen.
async function saveBox({needName, name, rename, dir}) {
 let chosen = dir;
 const ok = await askBox(close => {
  const input = needName ? el('input', {class: 'cb-askname', value: name, maxlength: 60, 'aria-label': 'Course name', onkeydown: e => { if (e.key === 'Enter') go(); }}) : null;
  const where = el('small', {class: 'cb-askwhere'}), said = el('small', {class: 'cb-askerr'});
  const show = () => { where.textContent = chosen ? `Saves to your courses folder: ${chosen.name}.` : canPick() ? 'Pick a courses folder once: every Save goes there, and Open a course file lists what is in it.' : 'Your browser saves the file to its downloads.'; pick.textContent = chosen ? 'Change folder' : 'Choose courses folder'; };
  const pick = el('button', {class: 'cb-btn', type: 'button', 'data-ask': 'folder', hidden: !canPick(), onclick: async () => { try { chosen = await pickCourses(); useFolder(chosen); said.textContent = ''; show(); } catch { /* closed */ } }});
  async function go() {
   if (input && !input.value.trim()) { said.textContent = 'Give the course a name.'; input.focus(); return; }
   if (!chosen && canPick()) { try { chosen = await pickCourses(); useFolder(chosen); } catch { said.textContent = 'Choose a courses folder to save into.'; show(); return; } }
   if (input) rename?.(input.value.trim());
   close(true);
  }
  show();
  return [el('h3', {}, 'Save the course'),
   input ? el('label', {class: 'cb-opt'}, 'Course name', input) : null,
   el('div', {class: 'cb-field'}, el('b', {}, 'Courses folder'), where, pick), said,
   el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-ask': 'save', onclick: go}, 'Save'), el('button', {class: 'cb-btn', type: 'button', 'data-ask': 'cancel', onclick: () => close(null)}, 'Cancel'))];
 });
 refreshSave();
 return !!ok;
}
// ANOTHER COURSE OF THE SAME NAME in the folder: replaced only when the player says.
setClashAsk((file, beside) => askBox(close => [el('h3', {}, 'Already in the folder'),
 el('small', {}, `${file} is already in your courses folder, and it is not the one you are working on.`),
 el('div', {class: 'cb-btns'}, el('button', {class: 'cb-btn cb-hot', type: 'button', 'data-ask': 'beside', onclick: () => close('beside')}, `Save as ${beside}`),
  el('button', {class: 'cb-btn', type: 'button', 'data-ask': 'replace', onclick: () => close('replace')}, 'Replace it'),
  el('button', {class: 'cb-btn', type: 'button', 'data-ask': 'cancel', onclick: () => close('cancel')}, 'Cancel'))]).then(v => v ?? 'cancel'));
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
 {key: 'real', title: 'Generate a real life course', text: 'Build a real course from its laser survey (LIDAR), aerial photo and map. Find it by name, box it on the map, then build it automatically or step by step.', go: () => import('./door-real.js').then(m => m.open())},
 {key: 'open', title: 'Open a course file', text: 'Carry on with a course or a draft you saved, or open a .fairway file somebody gave you.', go: openFile},
];

export function home() {
 setTitle(''); topTools(); setSaver(null); forgetOpened(); window.fairwayBuilder.leave = null; useMenus();
 const msg = el('p', {class: 'cb-note', id: 'cbHomeMsg'});
 show(el('section', {class: 'cb-doors'},
  el('h1', {}, 'Build a ', el('b', {}, 'course')),
  el('p', {}, 'Every course you build here is a .fairway file that Fairway plays, and that you can give to anybody else who has Fairway. Help > Keyboard shortcuts (or ?) lists every key.'),
  el('div', {class: 'cb-door-row'}, doors.map(d => el('button', {class: 'cb-door', type: 'button', onclick: () => d.go().catch(e => { msg.textContent = e.message; msg.classList.add('cb-err'); })},
   el('strong', {}, d.title), el('span', {}, d.text), el('em', {}, 'Start')))),
  msg,
  el('p', {class: 'cb-note'}, `Offline: the builder reads only the files you give it. Landscapes: ${BIOME_KEYS.map(k => BIOMES[k].name).join(', ')}.`)));
}

// OPEN A COURSE FILE: with a courses folder, what is in it, newest first, a
// click each (and Open another file for one elsewhere); without one, the
// browser's file picker as before.
async function openFile() {
 if (!canPick()) return openPicked();
 const dir = await readyFolder(true);
 const list = el('ul', {class: 'cb-courselist'}), head = el('small', {}), msg = el('small', {class: 'cb-askerr'});
 let shut = null;
 const fill = async d => {
  head.textContent = d ? `Your courses folder: ${d.name}` : 'No courses folder yet: choose the folder your courses are saved in, and they are listed here every time.';
  if (!d) { list.replaceChildren(); return; }
  const got = await listCourses(d).catch(e => { msg.textContent = 'Could not read the folder: ' + e.message; return []; });
  list.replaceChildren(...(got.length ? got.map(c => el('li', {}, el('button', {class: 'cb-btn cb-course', type: 'button', 'data-course': c.name, title: `Open ${c.name}`, onclick: () => shut({file: c.file, handle: c.handle})},
   el('strong', {}, c.name.replace(/\.fairway(-draft)?$/i, '')), el('small', {}, `${c.draft ? 'draft, opens at its step' : 'course'} · ${(c.size / 1e6).toFixed(1)} MB · ${new Date(c.modified).toLocaleString()}`)))) : [el('li', {}, el('small', {}, `Nothing saved in ${d.name} yet.`))]));
 };
 const folderBtn = el('button', {class: 'cb-btn', type: 'button', 'data-open': 'folder', onclick: async () => { try { const d = await pickCourses(); useFolder(d); folderBtn.textContent = 'Change folder'; await fill(d); } catch { /* closed */ } }}, dir ? 'Change folder' : 'Choose courses folder');
 const shown = fill(dir);
 const pick = await askBox(close => { shut = close; return [el('h3', {}, 'Open a course'), head, list, msg,
  el('div', {class: 'cb-btns'}, folderBtn, el('button', {class: 'cb-btn', type: 'button', 'data-open': 'other', title: 'A .fairway or draft file somewhere else', onclick: () => close('other')}, 'Open another file…'), el('button', {class: 'cb-btn', type: 'button', 'data-open': 'cancel', onclick: () => close(null)}, 'Cancel'))]; });
 await shown;
 if (pick === 'other') return openPicked();
 if (pick) await openOne(pick.file, pick.handle);
}
async function openPicked() {
 const [file] = await pickFile('.fairway,' + DRAFT_EXT + ',application/zip,application/json');
 if (file) await openOne(file);
}
// One file opened; from the courses folder (`handle`), it is where Save writes back to.
async function openOne(file, handle = null) {
 setBusy('Opening ' + file.name);
 try {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (await isDraft(bytes)) { const d = await readDraft(bytes); if (handle) openedFrom({handle, file: file.name, name: d.name}); await (await import('./door-real.js')).openSaved(d); return; }
  const got = await readCourseAny(file);
  if (handle) openedFrom({handle, file: file.name, name: got.kind === 'built' ? got.doc.name : got.course.name});
  // A course saved from the editor brings its builder's section (course-doc.js),
  // unpacked only when Back to 2D or Save wants it.
  let draft = null;
  // SMOOTHED ONCE (the owner, 25 November 2026: "Make sure this applies to
  // all traced. Painted. and imported surfaces in the builder!"): a course
  // the builder saved before outlines (its section a draft of version 3 or
  // older) holds outlines traced round squares, waves and all; they are
  // smoothed as it opens (Smooth edges on every layer, corners kept; Undo
  // takes it back). One saved since opens exactly as saved, and a file with
  // no builder section (a generated course taken over) is left as it is.
  const old = got.kind === 'built' && got.builder ? (await draftVersion(got.builder)) < 4 : false;
  if (got.kind === 'built') (await import('./editor.js')).openEditor(got.doc, {work: got.builder ? {draft: () => draft ??= readDraft(got.builder)} : null, smoothOld: old});
  else (await import('./door-generate.js')).open(got.course);
 } finally { setBusy(''); refreshSave(); }
}

// The test harness (tools/smoke.mjs) and the console reach the builder here.
window.fairwayBuilder = {home, readCourseAny, saveNow};
home();
