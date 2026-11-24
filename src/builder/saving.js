// SAVING FROM ANYWHERE (the owner, 1 November 2026: "need to be able to save
// from any point in the builder. once a course is saved, make it single click
// to save again. Only new file if renamed"). Every builder screen gives the
// top bar's Save (and Ctrl+S) what it would save -- the editor its course,
// door 1 its seeded course, door 2 a draft that opens back at its step -- and
// this keeps the file it went to.
//
// `saveHow` is the rule, pure (tests/builder-saving.test.mjs): the same file
// again when the work and its name are those of the last save there; a new
// file -- the save dialog -- for the first save or a new name; and where the
// browser cannot write to a file it was given (Firefox, Safari: no
// showSaveFilePicker), a download every time, which the browser may name
// "course (1).fairway".
//
// THE COURSES FOLDER (courses-folder.js; the owner, 23 November 2026): once
// one is in use (`useFolder`), every save goes into it, named from the
// course, with no dialog. `folderPlan` is its rule, pure: the same file again
// for the same work and name; a new file for a new name; and a file of that
// name already there that this work did not write -- another course called
// the same -- is never written over unasked (`setClashAsk`: replace it, save
// beside it as name-2, or cancel; with nobody to ask, beside it).
//
// A course OPENED from the folder (`openedFrom`) is this session's file at
// once, claimed by the first work that saves under its name, so opening a
// course and pressing Save writes back to it rather than beside it. Going
// back to the builder's start lets an unclaimed one go (`forgetOpened`).
export function saveHow(last, {key, name}, {canPick = true} = {}) {
 if (!canPick) return 'download';
 if (last?.handle && (last.key === key || last.key == null) && last.name === name) return 'overwrite';
 return 'pick';
}
export function folderPlan(last, {key, name, file}, exists) {
 if (last?.folder && last.asked === file && last.name === name && (last.key === key || last.key == null)) return 'overwrite';
 return exists ? 'clash' : 'new';
}
// A file name not taken: name-2.fairway, name-3.fairway, ...
export function freeName(file, taken) {
 const dot = file.indexOf('.'), base = dot < 0 ? file : file.slice(0, dot), ext = dot < 0 ? '' : file.slice(dot);
 for (let n = 2; ; n++) { const f = `${base}-${n}${ext}`; if (!taken(f)) return f; }
}

// The file for this session: {key, name, file, asked, handle, folder}. `key`
// tells one piece of work from another (a course opened, a door started), so
// a second course never overwrites the first's file; `asked` is the name the
// work asked for (`file` may be name-2 beside another course's).
let last = null, folder = null, clashAsk = null;
export const lastSave = () => last;
export function forgetSave() { last = null; }
export const coursesFolder = () => folder;
export function useFolder(dir) { folder = dir ?? null; }
export function setClashAsk(f) { clashAsk = f; }
export function openedFrom({handle, file, name}) { last = {key: null, name, file, asked: file, handle, folder: true}; }
export function forgetOpened() { if (last && last.key == null) last = null; }

const TYPES = {
 '.fairway': {description: 'Fairway course', accept: {'application/zip': ['.fairway']}},
 '.fairway-draft': {description: 'Fairway Course Builder draft', accept: {'application/zip': ['.fairway-draft']}},
};

// Saves `bytes` as `file` (a file name with its extension) for the work
// `key` named `name`. Returns {how, file, folder}: 'overwrite', 'new' (into
// the courses folder), 'pick', 'download', or 'cancelled' when the player
// closed the dialog. `remember` false: a copy on the side (Save a copy to
// share), which the next Save does not go to.
export async function saveBytes(bytes, {key, name, file, remember = true}) {
 if (folder) {
  try { return await intoFolder(bytes, {key, name, file, remember}); }
  catch (e) { if (e?.cancelled) return {how: 'cancelled', file}; folder = null; }   // leave withdrawn, the folder gone: as without one
 }
 const canPick = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
 let how = last?.folder ? (canPick ? 'pick' : 'download') : saveHow(last, {key, name}, {canPick});
 if (how === 'overwrite') {
  try { await write(last.handle, bytes); last = {...last, key, file: last.handle.name ?? file}; return {how, file: last.file}; }
  catch { how = 'pick'; }   // the file was moved or the permission lapsed: ask again
 }
 if (how === 'pick') {
  const ext = file.slice(file.indexOf('.')), type = TYPES[ext];
  let handle;
  try { handle = await window.showSaveFilePicker({suggestedName: file, types: type ? [type] : undefined}); }
  catch (e) { if (e?.name === 'AbortError') return {how: 'cancelled', file}; how = 'download'; }
  if (handle) { await write(handle, bytes); if (remember) last = {key, name, file: handle.name ?? file, asked: file, handle}; return {how, file: handle.name ?? file}; }
 }
 const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'})), a = document.createElement('a');
 a.href = url; a.download = file; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
 if (remember) last = {key, name, file, asked: file, handle: null};
 return {how: 'download', file};
}
async function intoFolder(bytes, {key, name, file, remember}) {
 const names = new Set(); for await (const [n] of folder.entries()) names.add(n);
 let plan = folderPlan(last, {key, name, file}, names.has(file)), target = plan === 'overwrite' ? last.file : file;
 if (plan === 'clash') {
  const beside = freeName(file, f => names.has(f)), answer = clashAsk ? await clashAsk(file, beside) : 'beside';
  if (answer === 'cancel') throw {cancelled: true};
  target = answer === 'replace' ? file : beside; plan = answer === 'replace' ? 'overwrite' : 'new';
 }
 const handle = await folder.getFileHandle(target, {create: true});
 await write(handle, bytes);
 if (remember) last = {key, name, file: target, asked: file, handle, folder: true};
 return {how: plan === 'overwrite' ? 'overwrite' : 'new', file: target, folder: folder.name};
}
async function write(handle, bytes) { const w = await handle.createWritable(); await w.write(bytes); await w.close(); }
