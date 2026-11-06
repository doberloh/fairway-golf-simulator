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
export function saveHow(last, {key, name}, {canPick = true} = {}) {
 if (!canPick) return 'download';
 if (last?.handle && last.key === key && last.name === name) return 'overwrite';
 return 'pick';
}

// The file for this session: {key, name, file, handle}. `key` tells one
// piece of work from another (a course opened, a door started), so a second
// course never overwrites the first's file.
let last = null;
export const lastSave = () => last;
export function forgetSave() { last = null; }

const TYPES = {
 '.fairway': {description: 'Fairway course', accept: {'application/zip': ['.fairway']}},
 '.fairway-draft': {description: 'Fairway Course Builder draft', accept: {'application/zip': ['.fairway-draft']}},
};

// Saves `bytes` as `file` (a file name with its extension) for the work
// `key` named `name`. Returns {how, file}: 'overwrite', 'pick', 'download',
// or 'cancelled' when the player closed the dialog. `remember` false: a copy on
// the side (Save a copy to share), which the next Save does not go to.
export async function saveBytes(bytes, {key, name, file, remember = true}) {
 const canPick = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
 let how = saveHow(last, {key, name}, {canPick});
 if (how === 'overwrite') {
  try { await write(last.handle, bytes); last = {...last, file: last.handle.name ?? file}; return {how, file: last.file}; }
  catch { how = 'pick'; }   // the file was moved or the permission lapsed: ask again
 }
 if (how === 'pick') {
  const ext = file.slice(file.indexOf('.')), type = TYPES[ext];
  let handle;
  try { handle = await window.showSaveFilePicker({suggestedName: file, types: type ? [type] : undefined}); }
  catch (e) { if (e?.name === 'AbortError') return {how: 'cancelled', file}; how = 'download'; }
  if (handle) { await write(handle, bytes); if (remember) last = {key, name, file: handle.name ?? file, handle}; return {how, file: handle.name ?? file}; }
 }
 const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'})), a = document.createElement('a');
 a.href = url; a.download = file; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
 if (remember) last = {key, name, file, handle: null};
 return {how: 'download', file};
}
async function write(handle, bytes) { const w = await handle.createWritable(); await w.write(bytes); await w.close(); }
