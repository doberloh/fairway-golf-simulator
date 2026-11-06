// A saved course as a file with its picture (src/course-file.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {courseFile, readCourseFile, fileName, pictureOk, pictureViews, FILE_KIND, FILE_VERSION, PICTURE} from '../src/course-file.js';
import {DEFAULT_COURSE, SCHEMA_VERSION, GENERATOR_VERSION} from '../src/settings-schema.js';
import {exportCourse, importCourse} from '../src/course-library.js';

const PIC = 'data:image/webp;base64,' + 'UklGRh'.repeat(200);
const rec = {name: 'Cliffs at Dawn', settings: {...DEFAULT_COURSE, biome: 'rockies', seed: 'SUMMIT', holes: 18, courseYards: 6400}, generator: GENERATOR_VERSION};

test('a course and its picture come back from the file as they went in', () => {
 const back = readCourseFile(courseFile(rec, PIC));
 assert.equal(back.name, rec.name);
 assert.equal(back.picture, PIC);
 assert.equal(back.generator, GENERATOR_VERSION);
 for (const k of ['biome', 'seed', 'holes', 'courseYards']) assert.equal(back.settings[k], rec.settings[k], k);
 const d = JSON.parse(courseFile(rec, PIC));
 assert.equal(d.kind, FILE_KIND); assert.equal(d.version, FILE_VERSION); assert.equal(d.schema, SCHEMA_VERSION);
});

test('play settings never travel: a file carries the course, not the author\'s clubs', () => {
 const d = JSON.parse(courseFile({...rec, settings: {...rec.settings, carryDriver: 300}}, null));
 assert.equal(d.settings.carryDriver, undefined);
});

test('the course code is unchanged and still valid beside the file', () => {
 const code = exportCourse(rec);
 assert.ok(code.length < 600, 'a code stays short');
 assert.equal(importCourse(code).settings.seed, 'SUMMIT');
});

test('anything that is not a course file is refused in plain words', () => {
 assert.throws(() => readCourseFile('hello'), /not a Fairway course file/);
 assert.throws(() => readCourseFile(JSON.stringify({kind: 'something-else'})), /not a Fairway course file/);
 assert.throws(() => readCourseFile(''), /not a Fairway course file/);
 assert.throws(() => readCourseFile(JSON.stringify({kind: FILE_KIND, version: FILE_VERSION + 1, name: 'x', settings: {}})), /newer version/);
 assert.throws(() => readCourseFile(JSON.stringify({kind: FILE_KIND, version: 1, schema: SCHEMA_VERSION + 1, name: 'x', settings: {}})), /newer version/);
 assert.throws(() => readCourseFile(JSON.stringify({kind: FILE_KIND, version: 1, name: '', settings: {}})), /no usable name/);
});

test('a damaged or oversized picture is dropped and the course kept', () => {
 const bad = JSON.parse(courseFile(rec, PIC));
 bad.picture = 'javascript:alert(1)';
 assert.equal(readCourseFile(JSON.stringify(bad)).picture, null);
 bad.picture = 'data:image/webp;base64,' + 'A'.repeat(PICTURE.maxChars);
 assert.equal(readCourseFile(JSON.stringify(bad)).picture, null);
 assert.equal(readCourseFile(JSON.stringify({...bad, picture: undefined})).picture, null);
 assert.ok(pictureOk(PIC));
 assert.ok(!pictureOk('data:image/svg+xml;base64,PHN2Zz4='), 'no SVG: it can carry script');
});

test('an old file loads: an earlier schema is migrated, a missing generator reads as 0', () => {
 const old = {kind: FILE_KIND, version: 1, schema: 1, name: 'Old one', settings: {seed: 'OLD', holes: 9}};
 const back = readCourseFile(JSON.stringify(old));
 assert.equal(back.settings.seed, 'OLD');
 assert.equal(back.generator, 0);
 assert.equal(back.picture, null);
});

test('a file name is safe everywhere and ends .fairway', () => {
 assert.equal(fileName('Cliffs at Dawn'), 'Cliffs-at-Dawn.fairway');
 assert.equal(fileName('a/b\\c:d*?"<>|'), 'abcd.fairway');
 assert.equal(fileName(''), 'course.fairway');
 assert.ok(fileName('x'.repeat(200)).length <= 48);
});

test('the picture step offers above, the first tee, and a short hole', () => {
 const v = pictureViews({halfX: 500, halfZ: 400, holes: [{par: 4}, {par: 5}, {par: 3}, {par: 4}]});
 assert.deepEqual(v.map(x => x.id), ['above', 'tee', 'hole']);
 assert.equal(v[2].label, 'Hole 3');
 assert.equal(v[2].pose.hole, 2);
 assert.equal(pictureViews({halfX: 1, halfZ: 1, holes: [{par: 4}, {par: 4}]})[2].pose.hole, 1, 'no par 3: hole 2');
 assert.equal(pictureViews({holes: [{par: 4}]}).length, 2, 'a one-hole course has no third view');
});
