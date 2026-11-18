// A TOUR AS ONE FILE (src/tour-file.js; the fairway-tour goal). Written and
// read back the same; someone else's damaged or doctored file refused in
// plain words; the ZIP64 records a real 3 GB season needs, exercised on a
// small file by lowering the size they start at.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeTourFile, readTourFile, sharedTour, builtHashes} from '../src/tour-file.js';
import {newTour, eventCourse, startEvent} from '../src/tour.js';
import {hashOf} from '../src/built-store.js';
import {writeZip} from '../src/zip.js';

// Two "built courses": bytes whose hash is their name, as the store keeps them.
const fake = async n => { const b = new Uint8Array(5000 + n * 777).map((_, i) => (i * 31 + n) & 255); return {bytes: b, hash: await hashOf(b)}; };
async function tourWithBuilt() {
 const a = await fake(1), b = await fake(2);
 const built = (x, name) => ({name, settings: {seed: '', holes: 18, built: x.hash}, built: x.hash});
 const t = newTour({name: 'Friends Tour', seed: 'F', events: [
  {name: 'Built One', course: built(a, 'Worthington')}, {name: 'Generated', course: eventCourse('pacnw', 'G1')},
  {name: 'Built Two', course: built(b, 'Druids Glen'), major: true}, {name: 'Generated Two', course: eventCourse('seaside', 'G2')}]});
 return {t, store: new Map([[a.hash, a.bytes], [b.hash, b.bytes]])};
}

test('a tour with two built and two generated events, written and read back the same', async () => {
 const {t, store} = await tourWithBuilt();
 // A season in progress: none of it travels.
 startEvent(t, {personIndex: 9}); t.results.push({id: 'x', rows: []});
 const blob = await writeTourFile(t, {builtBytes: async h => store.get(h)});
 const back = await readTourFile(blob, {hashOf});
 assert.equal(back.tour.name, 'Friends Tour');
 assert.deepEqual(back.tour.events.map(e => e.name), t.events.map(e => e.name));
 assert.deepEqual(back.tour.events.map(e => e.course.settings), t.events.map(e => e.course.settings));
 assert.equal(back.tour.results.length, 0, 'no results travel (Q6)');
 assert.equal(back.tour.current, null);
 assert.equal(back.courses.length, 2);
 for (const c of back.courses) assert.deepEqual(await c.read(), store.get(c.hash));
 assert.ok(back.bytes > 10000);
 assert.deepEqual(builtHashes(back.tour).sort(), [...store.keys()].sort());
 assert.ok(sharedTour(t).roster.length === t.members.length, 'the rivals travel whole');
});

test('the large-file records (ZIP64), forced on a small file, read back the same', async () => {
 const {t, store} = await tourWithBuilt();
 const blob = await writeTourFile(t, {builtBytes: async h => store.get(h), zip64At: 100});
 const back = await readTourFile(blob, {hashOf});
 for (const c of back.courses) assert.deepEqual(await c.read(), store.get(c.hash));
 assert.equal(back.tour.events.length, 4);
});

test('refused in plain words: damaged, doctored, a course missing, a newer version, a strange entry', async () => {
 const {t, store} = await tourWithBuilt();
 const good = new Uint8Array(await (await writeTourFile(t, {builtBytes: async h => store.get(h)})).arrayBuffer());
 await assert.rejects(readTourFile(new Blob([good.slice(0, good.length - 30)]), {hashOf}), /no ZIP directory|damaged/);
 await assert.rejects(readTourFile(new Blob([new Uint8Array(100)]), {hashOf}), /not a Fairway tour file/);
 // A built course's bytes swapped for another's: the hash does not match.
 const [h1, h2] = [...store.keys()];
 const swapped = await writeTourFile(t, {builtBytes: async h => store.get(h === h1 ? h2 : h1)});
 const read = await readTourFile(swapped, {hashOf});
 await assert.rejects(read.courses[0].read(), /not the course it says/);
 // A course the calendar plays, left out.
 await assert.rejects(writeTourFile(t, {builtBytes: async h => h === h1 ? null : store.get(h)}), /not on this device/);
 const noCourse = await writeZip([{name: 'tour.json', data: JSON.stringify(sharedTour(t)), store: true}]);
 await assert.rejects(readTourFile(new Blob([noCourse]), {hashOf}), /does not carry/);
 const newer = await writeZip([{name: 'tour.json', data: JSON.stringify({...sharedTour(t), v: 9}), store: true}]);
 await assert.rejects(readTourFile(new Blob([newer]), {hashOf}), /newer version/);
 const strange = await writeZip([{name: '../evil.js', data: 'x', store: true}, {name: 'tour.json', data: JSON.stringify(sharedTour(t)), store: true}]);
 await assert.rejects(readTourFile(new Blob([strange]), {hashOf}), /holds something a tour does not/);
});
