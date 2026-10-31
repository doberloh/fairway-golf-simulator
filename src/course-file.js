// A SAVED COURSE AS A FILE, WITH ITS PICTURE (the 1.0 polish, 27 October 2026;
// docs/UI_POLISH.md, *A picture for every saved course*).
//
// Saving in the studio now takes a picture of the course (main.js, the save
// box's picture step), and the picture is shown on the course's card wherever
// saved courses appear. A course code (course-library.js) is a few hundred
// characters and stays exactly as it was -- a picture in it would make it tens
// of thousands -- so a course that travels WITH its picture travels as a file:
// `<name>.fairway`, plain JSON. Pure: no DOM, no storage, tested in Node
// (tests/course-file.test.mjs). The picture itself is kept beside the library
// (course-pictures.js), not in it.
import {SCHEMA_VERSION, generatorFor, validateSettings, migrateSettings} from './settings-schema.js';
import {courseSettings, MAX_NAME} from './course-library.js';

export const FILE_KIND = 'fairway-course';
export const FILE_VERSION = 1;
export const FILE_EXT = '.fairway';
// The picture a saved course carries: 16:9, small enough that two hundred of
// them sit comfortably in the browser's storage (PLACED: 640 x 360 WebP at 0.72
// is about 25-40 KB; a picture longer than this, as a data URL, is dropped).
export const PICTURE = {width: 640, height: 360, quality: .72, maxChars: 160000};

const PICTURE_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/;
export const pictureOk = url => typeof url === 'string' && url.length <= PICTURE.maxChars && PICTURE_RE.test(url);

const plainName = n => { const s = String(n ?? '').trim(); if (!s.length || s.length > MAX_NAME) throw Error(`This course file has no usable name (1–${MAX_NAME} characters).`); return s; };

// The file for a saved course record ({name, settings, generator}) and its
// picture (a data URL, or null).
export function courseFile(record, picture = null) {
 const settings = courseSettings(validateSettings(record?.settings || {}));
 return JSON.stringify({kind: FILE_KIND, version: FILE_VERSION, name: plainName(record?.name), schema: SCHEMA_VERSION,
  generator: record?.generator ?? generatorFor(settings), settings, picture: pictureOk(picture) ? picture : null}, null, 1);
}

// A course from a file's text: {name, settings, generator, picture} not yet
// stored, so the caller can show it first. Refused in plain words when it is
// not one of ours, comes from a newer Fairway, or holds settings that do not
// validate; a damaged or oversized picture is dropped, the course kept.
export function readCourseFile(text) {
 let d;
 try { d = JSON.parse(String(text ?? '')); } catch { throw Error('This is not a Fairway course file.'); }
 if (!d || typeof d !== 'object' || d.kind !== FILE_KIND) throw Error('This is not a Fairway course file.');
 if (!Number.isInteger(d.version) || d.version > FILE_VERSION) throw Error('This course file was made by a newer version of Fairway. Update Fairway, then open it again.');
 const schema = Number.isInteger(d.schema) ? d.schema : 1;
 if (schema > SCHEMA_VERSION) throw Error('This course file was made by a newer version of Fairway. Update Fairway, then open it again.');
 const settings = courseSettings(validateSettings(migrateSettings(d.settings || {}, schema)));
 return {name: plainName(d.name), settings, generator: Number.isInteger(d.generator) ? d.generator : 0, picture: pictureOk(d.picture) ? d.picture : null};
}

// A file name for a course: its name, safe on every system, and the extension.
export function fileName(name) {
 const base = String(name ?? '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'course';
 return base + FILE_EXT;
}

// THE PICTURE STEP'S SUGGESTED VIEWS, as lab.camera poses (main.js
// `placePose`): the whole course from above, hole 1 from behind its tee, and
// the first par 3 (else hole 2) from behind its green -- a short hole shows
// its green and what guards it. `world` needs halfX, halfZ and holes[].par.
export function pictureViews(world) {
 const holes = world?.holes || [];
 const par3 = holes.findIndex(h => h.par === 3), pick = par3 >= 0 ? par3 : Math.min(1, holes.length - 1);
 const views = [
  {id: 'above', label: 'From above', pose: {x: -(world?.halfX || 300) * .2, z: -(world?.halfZ || 300) * 1.05, yaw: 15, height: 240, pitch: -26}},
  {id: 'tee', label: 'The first tee', pose: {hole: 0, along: -8, height: 3, look: 'pin', pitch: -4}},
 ];
 if (pick > 0) views.push({id: 'hole', label: `Hole ${pick + 1}`, pose: {hole: pick, fromPin: 80, around: 170, height: 30, pitch: -17}});
 return views;
}
