// Door 2's LIDAR search (src/builder/lidar-search.js): which sources cover a
// place, the National Map's tiles grouped into surveys with their Entwine
// copies and rockyweb tiles, IGN's tiles by mission -- against a fake fetch.
// The live download is checked by tools/lidar-search.mjs (Worthington: the
// Entwine square against the owner's tiles, ground equal to 0.1 cm at 95%).
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcesAt, squareAround, searchLidar, LIDAR_SOURCES} from '../src/builder/lidar-search.js';

const answer = j => ({ok: true, status: 200, json: async () => j});

test('the sources over a place: 3DEP, NOAA and the state\'s own portal in Minnesota; IGN in France; links checked', () => {
 const mn = sourcesAt(-95.628, 43.6286).map(s => s.key);
 for (const k of ['usgs', 'noaa', 'state-MN', 'opentopo']) assert.ok(mn.includes(k), k);
 for (const k of ['ign', 'nrcan', 'state-IA', 'state-WA']) assert.ok(!mn.includes(k), `not ${k}`);
 const wa = sourcesAt(-122.23, 48.05).map(s => s.key);
 assert.ok(wa.includes('state-WA') && wa.includes('usgs') && wa.includes('nrcan') === false);
 assert.ok(sourcesAt(2.35, 48.85).some(s => s.key === 'ign'));
 for (const s of LIDAR_SOURCES) assert.ok(s.online || /^https:\/\//.test(s.link), `${s.key} has a link`);
 const sq = squareAround(-95.628, 43.6286, 1000);
 assert.ok(Math.abs((sq.lat1 - sq.lat0) * 111320 - 1000) < 1);
 assert.ok(Math.abs((sq.lon1 - sq.lon0) * 111320 * Math.cos(43.6286 * Math.PI / 180) - 1000) < 1);
});

test('USGS: the tiles grouped by survey, newest first, with the Entwine copy and the rockyweb tiles', async () => {
 const T = (unit, n, date, size) => ({publicationDate: date, sizeInBytes: size, downloadLazURL: `https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/P_${unit}/${unit}/LAZ/USGS_LPC_${unit}_${n}.laz`});
 let asked = '';
 const got = await searchLidar('usgs', squareAround(-95.628, 43.6286, 1000), {get: async url => { asked = url; return answer({items: [T('OLD_2010', 1, '2016-02-26', 100), T('MN_NEW_B21', 1, '2023-02-10', 60e6), T('MN_NEW_B21', 2, '2023-02-10', 70e6)]}); }});
 assert.match(asked, /tnmaccess\.nationalmap\.gov.*Lidar%20Point%20Cloud.*bbox=-95\.63/);
 assert.deepEqual(got.map(g => g.id), ['MN_NEW_B21', 'OLD_2010']);
 assert.equal(got[0].tiles, 2); assert.equal(got[0].bytes, 130e6);
 assert.equal(got[0].ept, 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/MN_NEW_B21/ept.json');
 assert.deepEqual(got[0].tileUrls.map(t => t.name), ['USGS_LPC_MN_NEW_B21_1.laz', 'USGS_LPC_MN_NEW_B21_2.laz']);
});

test('IGN: the LiDAR HD tiles by mission, their COPC addresses on https', async () => {
 const got = await searchLidar('ign', squareAround(2.35, 48.85, 1000), {get: async () => answer({features: [
  {properties: {code_mission: '23LHD1', date_fin_acquisition: '2023-09-27Z', nombre_points: 1000, url_npl: 'http://data.geopf.fr/telechargement/download/x/LHD_1.copc.laz'}},
  {properties: {code_mission: '23LHD1', date_fin_acquisition: '2023-09-27Z', nombre_points: 2000, url_npl: 'http://data.geopf.fr/telechargement/download/x/LHD_2.copc.laz'}}]})});
 assert.equal(got.length, 1); assert.equal(got[0].points, 3000); assert.equal(got[0].date, '2023-09-27');
 assert.ok(got[0].urls.every(u => u.startsWith('https://')));
});
