// How much of a searched square the LIDAR covers, and a USGS square built from
// what is already saved (src/builder/lidar-coverage.js, lidar-search.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageOf, coverageWords, percent, squareOfName, unionBox, boxOfGeometry, overlaps} from '../src/builder/lidar-coverage.js';
import {coverFor, coverTogether, tilesOf, squareAround, squareName, downloadLidar, growBox, keepBytes, eptFileSource} from '../src/builder/lidar-search.js';
import {readZip, writeZip} from '../src/zip.js';
import {lonLatToMerc} from '../src/lidar/ept.js';

const box = {lon0: 0, lat0: 0, lon1: 1, lat1: 1}, west = {lon0: -1, lat0: -1, lon1: .5, lat1: 2}, east = {lon0: .5, lat0: -1, lon1: 2, lat1: 2};

test('a box over half the square covers half of it', () => {
 const c = coverageOf(box, {boxes: [west]});
 assert.ok(Math.abs(c.share - .5) < .03); assert.equal(c.heldShare, 0);
 assert.equal(coverageOf(box, {boxes: [west, east]}).share, 1);
 assert.equal(coverageOf(box).share, 0);
});

test('a survey\'s outline counts, holes and all', () => {
 const ring = [[-1, -1], [2, -1], [2, 2], [-1, 2], [-1, -1]], hole = [[.25, .25], [.75, .25], [.75, .75], [.25, .75], [.25, .25]];
 const c = coverageOf(box, {polys: [[ring, hole]]});
 assert.ok(Math.abs(c.share - .75) < .04, `${c.share}`);
});

test('what is saved shows apart from what would download', () => {
 const c = coverageOf(box, {boxes: [west, east], held: [west]}, 4);
 assert.ok(Math.abs(c.heldShare - .5) < .01); assert.equal(c.share, 1);
 assert.equal(c.grid[0], 2); assert.equal(c.grid[3], 1);
 assert.equal(coverageOf(box, {}, 4).grid[0], 0);
});

test('the words say so plainly, and nearly all never reads as all', () => {
 assert.equal(percent(1), 100); assert.equal(percent(.996), 99);
 assert.match(coverageWords({share: 1, heldShare: 0}, 1.5), /^Covers all of the 1\.5 km square\.$/);
 assert.match(coverageWords({share: .72, heldShare: 0}, 1.5), /72%.*no data/);
 assert.match(coverageWords({share: 1, heldShare: .4}, 3), /40% already saved/);
 assert.match(coverageWords({share: 0, heldShare: 0}, 1), /Nothing over/);
 assert.equal(coverageWords({share: 1, heldShare: 0}, 'the box'), 'Covers all of the box.');
});

test('a kept square\'s name says its survey and where it is', () => {
 const b = squareAround(-122.4, 47.6, 1500), name = squareName({id: 'WA_King_2021'}, b), q = squareOfName(name);
 assert.equal(q.id, 'WA_King_2021'); assert.ok(overlaps(q.box, b));
 assert.ok(Math.abs(q.box.lon0 - b.lon0) < .001);
 assert.equal(squareOfName('USGS_tile_1.laz'), null);
 // A square keeps its old name; a box drawn round a course says both sides,
 // and reads back as the box it was (it read back as a square before).
 assert.match(name, /_1500m\.ept\.zip$/);
 const r = {lon0: -122.41, lat0: 47.595, lon1: -122.39, lat1: 47.603}, rn = squareName({id: 'S'}, r), rq = squareOfName(rn);
 assert.match(rn, /_1501x891m\.ept\.zip$/);
 for (const k of ['lon0', 'lat0', 'lon1', 'lat1']) assert.ok(Math.abs(rq.box[k] - r[k]) < 2e-5, k);
 assert.deepEqual(unionBox([box, east]), {lon0: 0, lat0: -1, lon1: 2, lat1: 2});
 assert.deepEqual(boxOfGeometry({type: 'MultiPolygon', coordinates: [[[[1, 2], [3, 2], [3, 5], [1, 2]]]]}), {lon0: 1, lat0: 2, lon1: 3, lat1: 5});
 assert.equal(boxOfGeometry(null), null);
});

test('a survey\'s coverage knows which tiles are saved, whole', () => {
 const found = {id: 'S', tileUrls: [{url: 'u/a.laz', name: 'a.laz', bytes: 10, box: west}, {url: 'u/b.laz', name: 'b.laz', bytes: 20, box: east}]};
 const c = coverFor(found, box, new Map([['a.laz', 10]]));
 assert.equal(c.tiles, 2); assert.equal(c.tilesSaved, 1); assert.ok(c.known); assert.equal(c.share, 1); assert.ok(Math.abs(c.heldShare - .5) < .03);
 assert.equal(coverFor(found, box, new Map([['a.laz', 9]])).tilesSaved, 0, 'a part download is not a tile');
 assert.equal(coverFor({id: 'S', urls: ['x/a.copc.laz'], boxes: [null]}, box).known, false, 'not known is not nothing');
 assert.deepEqual(tilesOf({urls: ['x/a.copc.laz'], boxes: [west]}), [{url: 'x/a.copc.laz', name: 'a.copc.laz', bytes: 0, box: west}]);
 assert.equal(coverTogether([{id: 'A', polys: []}, found], box).share, 1);
});

test('a square saved earlier counts toward a bigger one of the same survey', () => {
 const small = squareAround(-122.4, 47.6, 1000), big = squareAround(-122.4, 47.6, 2000), name = squareName({id: 'S'}, small);
 const found = {id: 'S', polys: [[[[-123, 47], [-122, 47], [-122, 48], [-123, 48], [-123, 47]]]], ept: 'x'};
 const c = coverFor(found, big, new Map([[name, 100]]));
 assert.equal(c.share, 1); assert.ok(Math.abs(c.heldShare - .25) < .03, `${c.heldShare}`);
 assert.equal(coverFor({...found, id: 'Other'}, big, new Map([[name, 100]])).heldShare, 0);
});

// A fake Entwine survey whose cube is centred on (lon, lat), so a square off in
// one quarter needs the root and one child, and a square round the middle all.
function survey(lon = -122.4, lat = 47.6) {
 const asked = [], {x, y} = lonLatToMerc(lon, lat), D = 50000, bounds = [x - D, y - D, -D, x + D, y + D, D];
 const hierarchy = {'0-0-0-0': 40, '1-0-0-0': 10, '1-1-0-0': 10, '1-0-1-0': 10, '1-1-1-0': 10};
 const get = async url => {
  if (url.endsWith('ept.json')) return {ok: true, json: async () => ({dataType: 'laszip', bounds, span: 256})};
  if (url.includes('ept-hierarchy')) return {ok: true, json: async () => hierarchy};
  asked.push(url.split('/').pop());
  return {ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3, url.length]).buffer};
 };
 return {get, asked};
}
const folder = () => { const files = new Map(); return {files, kept: async n => files.get(n) ?? null, list: async () => [...files.keys()]}; };

test('a square again: read from the folder, nothing downloaded', async () => {
 const s = survey(), f = folder(), found = {source: 'usgs', id: 'S', title: 'S', ept: 'https://x/ept.json'}, b = squareAround(-122.4, 47.6, 1500);
 const [first] = await downloadLidar(found, b, {get: s.get, ...f});
 assert.ok(first.keep); assert.equal(first.keep.replaces.length, 0);
 const n = s.asked.length; assert.ok(n > 0);
 f.files.set(first.keep.name, (await keepBytes(first.keep)));
 const [again] = await downloadLidar(found, b, {get: async () => { throw Error('online'); }, ...f});
 assert.ok(again.kept); assert.equal(again.keptAs, first.keep.name); assert.equal(s.asked.length, n);
});

test('a bigger square downloads only the pieces missing, and combines them', async () => {
 const s = survey(), f = folder(), found = {source: 'usgs', id: 'S', title: 'S', ept: 'https://x/ept.json'};
 const small = squareAround(-122.38, 47.615, 500), big = squareAround(-122.4, 47.6, 3000);
 const [one] = await downloadLidar(found, small, {get: s.get, ...f});
 f.files.set(one.keep.name, (await keepBytes(one.keep)));
 const first = [...s.asked];
 assert.equal(first.length, 2, 'the root and one quarter');
 s.asked.length = 0;
 const [two] = await downloadLidar(found, big, {get: s.get, ...f});
 assert.equal(s.asked.length, 3, 'only the other three quarters');
 assert.ok(s.asked.every(n => !first.includes(n)), 'nothing fetched twice');
 assert.equal(two.reused, 2); assert.equal(two.fetched, 3); assert.equal(two.pieces, 5, 'the source reads all five');
 assert.deepEqual(two.keep.replaces, [one.keep.name], 'the old square is named to go');
 const zip = await readZip((await keepBytes(two.keep))), meta = JSON.parse(new TextDecoder().decode(zip.get('fairway-ept.json')));
 assert.equal([...zip.keys()].filter(n => n.endsWith('.laz')).length, 5, 'one ZIP holds them all');
 assert.equal(meta.squares.length, 2, 'both squares are listed');
 assert.ok(squareOfName(two.keep.name).box.lon1 >= big.lon1 - 1e-4, 'named for the whole extent');
 // The small one asked for again, offline, from the combined file.
 f.files.clear(); f.files.set(two.keep.name, (await keepBytes(two.keep)));
 const [back] = await downloadLidar(found, small, {get: async () => { throw Error('online'); }, ...f});
 assert.ok(back.kept); assert.equal(back.pieces, 2, 'only its own pieces are read');
 // And nothing new needed: a square inside what is held downloads nothing.
 s.asked.length = 0;
 const [inner] = await downloadLidar(found, squareAround(-122.4, 47.6, 2000), {get: s.get, ...f});
 assert.equal(s.asked.length, 0); assert.ok(inner.kept); assert.equal(inner.keep, undefined);
});

test('a square of another survey is left alone', async () => {
 const s = survey(), f = folder(), b = squareAround(-122.4, 47.6, 1000);
 const [other] = await downloadLidar({source: 'usgs', id: 'Other', title: 'O', ept: 'https://x/ept.json'}, b, {get: s.get, ...f});
 f.files.set(other.keep.name, (await keepBytes(other.keep))); s.asked.length = 0;
 const [mine] = await downloadLidar({source: 'usgs', id: 'Mine', title: 'M', ept: 'https://x/ept.json'}, b, {get: s.get, ...f});
 assert.ok(s.asked.length > 0); assert.deepEqual(mine.keep.replaces, []);
});

// FULL DETAIL INSIDE THE OUTLINE (22 November 2026). A survey of three depths
// over a cube 8 km (Web Mercator) round the place: one node, four, sixteen,
// 1,000 points each. Over a 3 km box the top two depths give about 1.7e-4
// points a square metre, the third brings it to 7.2e-4; asking 2e-4 outside
// (70% of it reached at depth 1) keeps depths 0 and 1 everywhere and depth 2
// only under the outline.
function deepSurvey(lon = -122.4, lat = 47.6) {
 const asked = [], {x, y} = lonLatToMerc(lon, lat), D = 4000, bounds = [x - D, y - D, -D, x + D, y + D, D];
 const hierarchy = {'0-0-0-0': 1000};
 for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) hierarchy[`1-${i}-${j}-0`] = 1000;
 for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) hierarchy[`2-${i}-${j}-0`] = 1000;
 const get = async url => {
  if (url.endsWith('ept.json')) return {ok: true, json: async () => ({dataType: 'laszip', bounds, span: 256})};
  if (url.includes('ept-hierarchy')) return {ok: true, json: async () => hierarchy};
  asked.push(url.split('/').pop().replace('.laz', ''));
  return {ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3, url.length]).buffer};
 };
 return {get, asked};
}
// A square ring `m` metres either side of a point `e` metres east and north of the place.
const ringAt = (e, m, lon = -122.4, lat = 47.6) => { const dLon = 1 / (111320 * Math.cos(lat * Math.PI / 180)), dLat = 1 / 111320; return [[-m, -m], [m, -m], [m, m], [-m, m]].map(([a, b]) => [lon + (e + a) * dLon, lat + (e + b) * dLat]); };

test('with an outline: every depth under it, the thin layer elsewhere; kept with its outline; a wider one fetches only what it lacks', async () => {
 const s = deepSurvey(), f = folder(), found = {source: 'usgs', id: 'S', title: 'S', ept: 'https://x/ept.json'}, box = squareAround(-122.4, 47.6, 3000);
 const small = {ring: ringAt(1000, 200), perM2: 2e-4};
 const [one] = await downloadLidar(found, box, {get: s.get, ...f, detail: small});
 assert.deepEqual(s.asked.filter(k => k.startsWith('2-')), ['2-2-2-0'], 'the one deepest piece under the outline');
 assert.equal(s.asked.length, 1 + 4 + 1); assert.equal(one.thinned.depth, 1);
 f.files.set(one.keep.name, await keepBytes(one.keep));
 // Again with the same outline, offline: from the folder.
 const [again] = await downloadLidar(found, box, {get: async () => { throw Error('online'); }, ...f, detail: small});
 assert.ok(again.kept); assert.equal(again.pieces, 6);
 // A wider outline: only the deeper pieces it adds.
 s.asked.length = 0;
 const wide = {ring: ringAt(1000, 1500), perM2: 2e-4};
 const [two] = await downloadLidar(found, box, {get: s.get, ...f, detail: wide});
 assert.ok(s.asked.length > 0 && s.asked.every(k => k.startsWith('2-') && k !== '2-2-2-0'), `only new deep pieces: ${s.asked}`);
 assert.equal(two.reused, 6);
 // The kept file, opened from the folder, thinned to the small outline: no
 // download, none missing; asked for the whole survey: the pieces it lacks counted.
 const bytes = await keepBytes(two.keep), src = await eptFileSource(bytes, null);
 const thin = src.choose(small);
 assert.equal(thin.missing, 0); assert.equal(thin.source.pieces, 6);
 assert.equal(src.choose({ring: ringAt(-1000, 1500), perM2: 2e-4}).missing > 0, true, 'an outline elsewhere needs pieces not kept');
 // An older kept square (no outline, no record of the survey's pieces): read whole, as before.
 const made = await readZip(await keepBytes((await downloadLidar(found, squareAround(-122.4, 47.6, 1000), {get: deepSurvey().get, ...folder()}))[0].keep));
 const meta = JSON.parse(new TextDecoder().decode(made.get('fairway-ept.json'))); delete meta.cube; delete meta.points;
 const oldBytes = await writeZip([{name: 'fairway-ept.json', data: JSON.stringify(meta)}, ...[...made].filter(([n]) => n.endsWith('.laz')).map(([name, data]) => ({name, data, store: true}))]);
 const old = await eptFileSource(oldBytes, null), kept = old.choose(small);
 assert.equal(kept.source, old, 'read whole'); assert.equal(kept.missing, 0);
});

test('the LIDAR is downloaded 150 m past the box, as past a square', () => {
 const sq = squareAround(-95.62, 43.63, 1500), wide = growBox(sq, 150), was = squareAround(-95.62, 43.63, 1800);
 for (const k of ['lon0', 'lat0', 'lon1', 'lat1']) assert.ok(Math.abs(wide[k] - was[k]) < 1e-9, k);
});
