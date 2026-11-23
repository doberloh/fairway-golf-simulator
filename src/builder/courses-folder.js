// THE COURSES FOLDER (the owner, 23 November 2026: "When saving a course from
// any step, can we make it so that the user picks a 'courses folder' and we
// save and load from there?"). One folder on the player's own disk, picked
// once and remembered as the LIDAR folder is (lidar-folder.js: the browser
// keeps its handle in IndexedDB and asks again for leave to use it on a later
// visit). Every Save in the builder -- a door 2 draft from any step, a course
// from the editor or door 1, Save course file -- writes into it without a
// save dialog, and Open a course file lists what is in it. Where the browser
// cannot pick a folder (Firefox, Safari), saving and opening work as before:
// a download, and the browser's file picker.
//
// Pure but for the browser's own objects, passed in: tests/courses-folder.test.mjs.
import {recallFolder, rememberFolder} from './lidar-folder.js';

export const COURSE_FILE = /\.(fairway|fairway-draft)$/i;
const KEY = 'courses-folder';
export const recallCourses = () => recallFolder(KEY);
export async function pickCourses() {
 const dir = await globalThis.showDirectoryPicker({id: 'fairway-courses', mode: 'readwrite', startIn: 'documents'});
 await rememberFolder(dir, KEY);
 return dir;
}

// The courses and drafts in the folder (not its sub-folders), newest first:
// [{name, handle, file, draft, size, modified}].
export async function listCourses(dir) {
 const out = [];
 for await (const [name, h] of dir.entries()) {
  if (h.kind !== 'file' || !COURSE_FILE.test(name)) continue;
  const file = await h.getFile();
  out.push({name, handle: h, file, draft: /\.fairway-draft$/i.test(name), size: file.size, modified: file.lastModified ?? 0});
 }
 return out.sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
}
