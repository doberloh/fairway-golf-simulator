// Map grids (src/lidar/geo.js): UTM, and any Lambert conformal conic or
// transverse Mercator grid worked from the file's own WKT, against IOGP
// Guidance Note 7-2's worked examples (Coordinate Conversions and
// Transformations including Formulas, sections 3.2.1.1 and 3.2.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import {converter, projectionOf, toUtm, fromUtm} from '../src/lidar/geo.js';

const WGS = {epsg: 4326, geographic: true};
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);

test('a Lambert conformal conic grid from its WKT: NAD27 / Texas South Central (IOGP 7-2)', () => {
 const wkt = 'PROJCS["NAD27 / Texas South Central",GEOGCS["NAD27",DATUM["North_American_Datum_1927",SPHEROID["Clarke 1866",6378206.4,294.978698213898]]],PROJECTION["Lambert_Conformal_Conic_2SP"],PARAMETER["standard_parallel_1",28.3833333333333],PARAMETER["standard_parallel_2",30.2833333333333],PARAMETER["latitude_of_origin",27.8333333333333],PARAMETER["central_meridian",-99],PARAMETER["false_easting",2000000],PARAMETER["false_northing",0],UNIT["US survey foot",0.304800609601219],AUTHORITY["EPSG","32040"]]';
 const p = projectionOf({wkt}), q = p.fromGeo(28.5, -96);
 near(q.x, 2963503.91, .02, 'easting, US feet'); near(q.y, 254759.80, .02, 'northing, US feet');
 const g = p.toGeo(2963503.91, 254759.80);
 near(g.lat, 28.5, 1e-7, 'latitude back'); near(g.lon, -96, 1e-7, 'longitude back');
 // Through the converter, to degrees and to UTM 14N.
 const c = converter({epsg: 32040, wkt}, WGS)(2963503.91, 254759.80);
 near(c.y, 28.5, 1e-7, 'converter latitude');
 const u = converter({epsg: 32040, wkt}, {epsg: 26914})(2963503.91, 254759.80), t = toUtm(28.5, -96, 14);
 near(u.x, t.x, .001, 'to UTM easting'); near(u.y, t.y, .001, 'to UTM northing');
});

test('a transverse Mercator grid from its WKT: the British National Grid (IOGP 7-2)', () => {
 const wkt = 'PROJCS["OSGB 1936 / British National Grid",GEOGCS["OSGB 1936",DATUM["OSGB_1936",SPHEROID["Airy 1830",6377563.396,299.3249646]]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",49],PARAMETER["central_meridian",-2],PARAMETER["scale_factor",0.9996012717],PARAMETER["false_easting",400000],PARAMETER["false_northing",-100000],UNIT["metre",1],AUTHORITY["EPSG","27700"]]';
 const p = projectionOf({wkt}), q = p.fromGeo(50.5, .5);
 near(q.x, 577274.99, .02, 'easting'); near(q.y, 69740.50, .02, 'northing');
 const g = p.toGeo(577274.99, 69740.50);
 near(g.lat, 50.5, 1e-7, 'latitude back'); near(g.lon, .5, 1e-7, 'longitude back');
});

test('the owner\'s Washington South State Plane (US feet, a vertical part after it) places as degrees', () => {
 const wkt = 'PROJCS["NAD83(HARN) / Washington South (ftUS)",GEOGCS["NAD83(HARN)",DATUM["NAD83 (High Accuracy Reference Network)",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],TOWGS84[0,0,0,0,0,0,0]],UNIT["degree",0.0174532925199433]],PROJECTION["Lambert_Conformal_Conic_2SP"],PARAMETER["standard_parallel_1",47.33333333333334],PARAMETER["standard_parallel_2",45.83333333333334],PARAMETER["latitude_of_origin",45.33333333333334],PARAMETER["central_meridian",-120.5],PARAMETER["false_easting",1640416.667],PARAMETER["false_northing",0],UNIT["US survey foot",0.3048006096012192,AUTHORITY["EPSG","9003"]],AXIS["X",EAST],AXIS["Y",NORTH],AUTHORITY["EPSG","2927"]],VERT_CS["NAVD88 height (ftUS)",VERT_DATUM["North American Vertical Datum 1988",2005],UNIT["US survey foot",0.3048006096012192],AXIS["Up",UP]]';
 const c = converter({epsg: 2927, wkt}, WGS), back = converter(WGS, {epsg: 2927, wkt});
 // The grid's own origin: on the central meridian at the latitude of origin, 1640416.667 ft east.
 const o = c(1640416.667, 0); near(o.x, -120.5, 1e-9, 'origin longitude'); near(o.y, 45.3333333, 1e-6, 'origin latitude');
 const g = c(1100000, 700000), r = back(g.x, g.y);
 near(r.x, 1100000, .01, 'round trip x'); near(r.y, 700000, .01, 'round trip y');
});

test('UTM both ways, and a grid Fairway cannot work says so', () => {
 const p = toUtm(43.62, -95.6, 15), g = fromUtm(p.x, p.y, 15);
 near(g.lat, 43.62, 1e-8, 'latitude'); near(g.lon, -95.6, 1e-8, 'longitude');
 assert.equal(converter({epsg: 3035, wkt: 'PROJCS["ETRS89 / LAEA Europe",PROJECTION["Lambert_Azimuthal_Equal_Area"]]'}, WGS), null);
 assert.equal(projectionOf({epsg: 2927}), null, 'no WKT, no working');
});
