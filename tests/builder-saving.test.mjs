// The builder's Save (src/builder/saving.js `saveHow`): one click to the same
// file once saved; a new file only for a new name or other work; a download
// where the browser cannot write a file it was given.
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveHow, folderPlan, freeName, saveBytes, useFolder, setClashAsk, openedFrom, forgetOpened, forgetSave, lastSave} from '../src/builder/saving.js';
import {listCourses} from '../src/builder/courses-folder.js';

// A folder as the browser gives one (showDirectoryPicker), in memory.
function fakeFolder(name = 'Courses') {
 const files = new Map(), stamp = new Map(); let clock = 1;
 const handle = n => ({kind: 'file', name: n, getFile: async () => Object.assign(new File([files.get(n) ?? new Uint8Array()], n), {}), createWritable: async () => { const parts = []; return {write: async b => { parts.push(b); }, close: async () => { files.set(n, new Uint8Array(await new Blob(parts).arrayBuffer())); stamp.set(n, clock++); }}; }});
 return {name, kind: 'directory', files, stamp,
  async getFileHandle(n, {create = false} = {}) { if (!files.has(n) && !create) throw Object.assign(Error('NotFound'), {name: 'NotFoundError'}); return handle(n); },
  async *entries() { for (const n of files.keys()) yield [n, handle(n)]; }};
}
const bytes = s => new TextEncoder().encode(s), text = (dir, n) => new TextDecoder().decode(dir.files.get(n));

test('the first save asks where; the same work and name save again with one click; a new name or other work ask again', () => {
 const work = {key: 'door2-1', name: 'Worthington'};
 assert.equal(saveHow(null, work), 'pick');
 const last = {...work, file: 'Worthington.fairway-draft', handle: {}};
 assert.equal(saveHow(last, work), 'overwrite');
 assert.equal(saveHow(last, {...work, name: 'Worthington CC'}), 'pick', 'renamed: a new file');
 assert.equal(saveHow(last, {key: 'editor-2', name: 'Worthington'}), 'pick', 'another piece of work never overwrites this one');
 assert.equal(saveHow({...last, handle: null}, work), 'pick', 'a download leaves nothing to write to');
 assert.equal(saveHow(last, work, {canPick: false}), 'download', 'no save dialog in this browser');
});

// THE COURSES FOLDER (the owner, 23 November 2026).
test('the folder\'s rule: again for the same work and name; new for a new name; never over another course unasked', () => {
 const work = {key: 'door2-1', name: 'Worthington', file: 'Worthington.fairway-draft'};
 assert.equal(folderPlan(null, work, false), 'new');
 assert.equal(folderPlan(null, work, true), 'clash', 'a file of that name this work did not write');
 const last = {...work, asked: work.file, folder: true};
 assert.equal(folderPlan(last, work, true), 'overwrite');
 assert.equal(folderPlan(last, {...work, name: 'Worthington CC', file: 'Worthington-CC.fairway-draft'}, false), 'new');
 assert.equal(folderPlan(last, {...work, key: 'door2-2'}, true), 'clash', 'other work of the same name');
 assert.equal(folderPlan({...last, key: null}, {...work, key: 'editor-7'}, true), 'overwrite', 'a course opened from the folder is written back to');
 assert.equal(freeName('Worthington.fairway', f => f === 'Worthington-2.fairway'), 'Worthington-3.fairway');
});

test('saving into the folder: no dialog, again to the same file, a clash asked, a renamed course a new file', async () => {
 const dir = fakeFolder(); forgetSave(); useFolder(dir);
 let asked = 0; setClashAsk(async () => { asked++; return 'beside'; });
 const work = {key: 'door2-1', name: 'Worthington', file: 'Worthington.fairway-draft'};
 let r = await saveBytes(bytes('one'), work);
 assert.deepEqual([r.how, r.file, r.folder], ['new', 'Worthington.fairway-draft', 'Courses']);
 r = await saveBytes(bytes('two'), work);
 assert.equal(r.how, 'overwrite'); assert.equal(text(dir, 'Worthington.fairway-draft'), 'two');
 // Another piece of work of the same name: asked, and saved beside it.
 r = await saveBytes(bytes('other'), {...work, key: 'door2-2'});
 assert.equal(asked, 1); assert.equal(r.file, 'Worthington-2.fairway-draft'); assert.equal(text(dir, 'Worthington.fairway-draft'), 'two', 'the first course untouched');
 r = await saveBytes(bytes('other again'), {...work, key: 'door2-2'});
 assert.equal(asked, 1, 'asked once'); assert.equal(r.file, 'Worthington-2.fairway-draft');
 // Replace and Cancel.
 setClashAsk(async () => 'cancel');
 r = await saveBytes(bytes('x'), {...work, key: 'door2-3'}); assert.equal(r.how, 'cancelled'); assert.equal(text(dir, 'Worthington.fairway-draft'), 'two');
 setClashAsk(async () => 'replace');
 r = await saveBytes(bytes('replaced'), {...work, key: 'door2-3'}); assert.equal(r.how, 'overwrite'); assert.equal(text(dir, 'Worthington.fairway-draft'), 'replaced');
 // A new name: a new file.
 r = await saveBytes(bytes('cc'), {key: 'door2-3', name: 'Worthington CC', file: 'Worthington-CC.fairway-draft'});
 assert.equal(r.how, 'new'); assert.equal(dir.files.size, 3);
 useFolder(null); setClashAsk(null); forgetSave();
});

test('a course opened from the folder is saved back to; going home lets an unclaimed one go', async () => {
 const dir = fakeFolder(); useFolder(dir);
 await (await dir.getFileHandle('Hill.fairway', {create: true}).then(h => h.createWritable())).close();
 openedFrom({handle: await dir.getFileHandle('Hill.fairway'), file: 'Hill.fairway', name: 'Hill'});
 setClashAsk(async () => { throw Error('should not ask'); });
 const r = await saveBytes(bytes('edited'), {key: 'editor-1', name: 'Hill', file: 'Hill.fairway'});
 assert.equal(r.how, 'overwrite'); assert.equal(text(dir, 'Hill.fairway'), 'edited');
 assert.equal(lastSave().key, 'editor-1', 'claimed by the work that saved it');
 forgetOpened(); assert.ok(lastSave(), 'a claimed save is kept');
 openedFrom({handle: null, file: 'Other.fairway', name: 'Other'}); forgetOpened(); assert.equal(lastSave(), null);
 useFolder(null); setClashAsk(null);
});

test('the folder\'s courses and drafts listed newest first, nothing else', async () => {
 const dir = fakeFolder();
 for (const n of ['Old.fairway', 'notes.txt', 'Draft.fairway-draft', 'New.fairway']) { const w = await (await dir.getFileHandle(n, {create: true})).createWritable(); await w.write(bytes(n)); await w.close(); }
 // The fake's files carry no date: give each its order written.
 const orig = dir.getFileHandle.bind(dir);
 dir.entries = async function* () { for (const n of dir.files.keys()) { const h = await orig(n); const f = await h.getFile(); yield [n, {...h, getFile: async () => Object.defineProperty(f, 'lastModified', {value: dir.stamp.get(n)})}]; } };
 const got = await listCourses(dir);
 assert.deepEqual(got.map(c => c.name), ['New.fairway', 'Draft.fairway-draft', 'Old.fairway']);
 assert.deepEqual(got.map(c => c.draft), [false, true, false]);
});
